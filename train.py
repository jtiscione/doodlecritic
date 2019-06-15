import sys
import os
from os.path import expanduser
import pickle
import torch
import torch.nn as nn
import torch.optim as optim
import torch.utils.data
import torch.onnx
import re
import json
from PIL import Image, ImageDraw
import torch
import numpy as np

# Training script- trains a Pytorch model against the Google Quickdraw dataset:
# https://github.com/googlecreativelab/quickdraw-dataset
#
# This script uses the "simplified Drawing files" available at
#
# https://console.cloud.google.com/storage/browser/quickdraw_dataset/full/simplified
#
# Also see https://www.kaggle.com/google/tinyquickdraw for a single downloadable tar file with about 50 million samples
# separated into 343 classes.
#
# Model used here is a convolutional neural network accepting 1x64x64 inputs
# (i.e. black-and-white 64x64 images). Output is 344 neurons (i.e. one per label) with an extra neuron
# corresponding to label "nothing".
#
# If cnn_model.pth is found (typically saved from a previous run), it will be loaded into the current model;
# otherwise the network will start with a set of random weights. File size is approx. 300 MB.
#
# While this is running, the model will be periodically saved as cnn_model.pth (and exported to cnn_model.onnx)
# at the end of each training epoch, and also whenever those files are found to be missing.
# (To get the up-to-date versions of these files, delete the current ones while the script is running.)
#
# If SAVE_BACKUP_FILES is set to True, the script will save backups as training progresses.
# Each time performance reaches a new record, a file will be saved with a number in the filename
# indicating the new record number of correct responses. This is to avoid losing progress if the script crashes.
# (Raising the batch size too high can cause spurious out-of-memory errors at random times.)

# Specify data folder as command line argument; default is ~/data/quickdraw
DATA_DIRECTORY = expanduser('~/data/quickdraw')
if (len(sys.argv) > 1):
    DATA_DIRECTORY = sys.argv[1]

# This is a safe batch size to use on an RTX 2060 with 6 GB.
BATCH_SIZE = 1000

# Hyperparameters
OPTIMIZER_NAME = 'SGD'

SGD_LEARNING_RATE = 0.01
SGD_MOMENTUM = 0

ADAM_LEARNING_RATE = 0.001
ADAM_BETAS = (0.9, 0.99)
ADAM_EPSILON = 0.0001

INDEX_CACHE_FILE = './index_cache.pkl'
LABELS_FILE = './labels.txt'

STATE_DICT_FILE = './cnn_model.pth'
ONNX_FILE = './cnn_model.onnx'

SAVE_BACKUP_FILES = True
NUMBERED_STATE_DICT_FILE_TEMPLATE = './cnn_model_{}.pth'

DEVICE = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")

# If it's installed, turn this on to enable NVidia's AMP Pytorch extension on an RTX card
# Compiling and installing it involves NVidia's CUDA Toolkit to be installed on the system so I will default to False
MIXED_PRECISION = False

if MIXED_PRECISION and torch.cuda.is_available():
    # See if NVidia's Apex AMP Pytorch extension has been installed to leverage RTX tensor cores
    # by performing FP16 calculations; otherwise stick to standard FP32.
    # If we are using mixed precision we can raise the batch size but keep it a multiple of 8.
    try:
        from apex import amp, optimizers
        MIXED_PRECISION = True
        BATCH_SIZE = int(BATCH_SIZE * 1.6)
        print('Using mixed precision.')
    except ImportError:
        MIXED_PRECISION = False


# This is a torch DataSet implementation that makes the following assumptions:
#
# 1. Data consists of a set of text files with ".ndjson" extensions in the specified directory.
# 2. Each line in the .ndjson file is a JSON string with all data for a single sample.
# 3. Each line of JSON has the following format (omitting extraneous fields):
#    {"word":"elephant","drawing":[[[0, 1, 10],[25, 103, 163]],[[4,15,134,234,250],[27,22,6,4,0]]]}
#    Array "drawing" has the brush strokes, each stroke a pair of arrays with x and y coordinates on a 256x256 grid.
# 4. We can build our label list by only looking at the first line of each file. (All lines have same value for "word".)
class QuickDrawDataset(torch.utils.data.Dataset):

    # Take the batch size, so we know how much to pad with all-zero samples mapping to the "blank" channel.
    # This way we ensure we deliver full-sized batches interspersed with a few blank samples mapping to label "nothing".
    def __init__(self, dataDir, batch_size):
        super(QuickDrawDataset, self).__init__()
        print('Data folder: ' + dataDir)
        self.dataDir = dataDir
        self.filenames = list(filter(lambda x: x.endswith(".ndjson"), sorted(os.listdir(dataDir)))) #[1:20]
        self.filenameByIndex = []
        self.fileByteOffsetByIndex = []
        self.labelListIndices = {}
        self.labelList = []

        for filename in self.filenames:
            print('Indexing ' + filename)
            file = open(dataDir + "/" + filename, "r")
            byte_offset = 0
            word = None
            for line in file:
                if (word == None):
                    words = re.findall('\"word\":\"([\w\s-]+)\"', line)
                    word = words[0]
                    self.labelListIndices[word] = len(self.labelList)
                    self.labelList.append(word)
                # Only use the ones Google recognizes
                if (len(re.findall('\"recognized\":true', line)) > 0):
                    self.filenameByIndex.append(filename)
                    self.fileByteOffsetByIndex.append(byte_offset)
                byte_offset += len(line)
            file.close()

        self.labelListIndices['nothing'] = len(self.labelList)
        self.labelList.append('nothing')
        if MIXED_PRECISION:
          # NVidia really wants tensor dimensions to be multiples of 8, make sure here
          extra_nothings = 0
          while len(self.labelList) % 8 > 0:
            extra_nothings += 1
            self.labelListIndices['nothing_{}'.format(extra_nothings)] = len(self.labelList)
            self.labelList.append('nothing_{}'.format(extra_nothings))

        self.paddingLength = batch_size - (len(self.filenameByIndex) % batch_size)
        print('padding length {}'.format(self.paddingLength))

    def __len__(self):
        return len(self.filenameByIndex) + self.paddingLength

    def __getitem__(self, idx):
        if idx >= len(self.filenameByIndex):
            # NULL sample
            return torch.zeros(1, 64, 64, dtype=torch.float), self.labelListIndices['nothing']
        filename = self.filenameByIndex[idx]
        byte_offset = self.fileByteOffsetByIndex[idx]
        file = open(self.dataDir + '/' + filename, 'r')
        file.seek(byte_offset)
        line = file.readline()
        file.close()
        # Convert line containing brush stroke coordinate list to a 256x256 image tensor using PIL
        entry = json.loads(line)
        drawing = entry.get('drawing')
        im = Image.new("L", (256, 256))
        draw = ImageDraw.Draw(im)
        for stroke in drawing:
            x_coords = stroke[0]
            y_coords = stroke[1]
            for i in range(len(x_coords) - 1):
                draw.line((x_coords[i], y_coords[i], x_coords[i + 1], y_coords[i + 1]), fill=255, width=5)
        im = im.resize((64, 64), Image.ANTIALIAS)
        word = entry.get('word')
        imageTensor = torch.tensor(np.array(im) / 256, dtype=torch.float)

        # Alter image slightly to look like the inputs we're eventually going to get from the client.
        # This is a limitation imposed by JavaScript which implements "antialiasing" on downsized canvases by
        # nearest-neighbor downsampling smoothed onscreen by a WebGL filter that doesn't write to the image data,
        # so we only get two-color jagged images.
        #
        # Tedious workarounds are possible: https://stackoverflow.com/questions/2303690/resizing-an-image-in-an-html5-canvas
        THRESHOLD = 0.1
        imageTensor[imageTensor >= THRESHOLD] = 1.0
        imageTensor[imageTensor < THRESHOLD] = 0.0

        imageTensor = imageTensor.unsqueeze(0)

        return imageTensor, self.labelListIndices.get(word)

# Takes input of size Nx1x64x64, a batch of N black and white 64x64 images.
# Applies two convolutional layers and three fully connected layers.

class CNNModel(nn.Module):

    # input_size is 64 (input samples are 64x64 images); num_classes is 344
    def __init__(self, input_size, num_classes):
        super(CNNModel, self).__init__()
        self.layer1 = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=5, stride=1, padding=2, bias=False),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2))
        self.layer2 = nn.Sequential(
            nn.Conv2d(32, 64, kernel_size=5, stride=1, padding=2, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(kernel_size=2, stride=2))
        dimension = int(64 * pow(input_size / 4, 2))
        self.fc1 = nn.Sequential(nn.Linear(dimension, int(dimension / 4)), nn.Dropout(0.25))
        self.fc2 = nn.Sequential(nn.Linear(int(dimension / 4), int(dimension / 8)), nn.Dropout(0.25))
        self.fc3 = nn.Sequential(nn.Linear(int(dimension / 8), num_classes))

    def forward(self, x):
        out = self.layer1(x)
        out = self.layer2(out)
        out = out.view(out.size(0), -1)
        out = self.fc1(out)
        out = self.fc2(out)
        out = self.fc3(out)
        return out

# Main part
if __name__ == '__main__':

    if os.path.isfile(INDEX_CACHE_FILE):
        print("Loading {}".format(INDEX_CACHE_FILE))
        infile = open(INDEX_CACHE_FILE, 'rb')
        dataSet = pickle.load(infile)
        infile.close()
    else:
        dataSet = QuickDrawDataset(DATA_DIRECTORY, BATCH_SIZE)
        outfile = open(INDEX_CACHE_FILE, 'wb')
        pickle.dump(dataSet, outfile)
        outfile.close()
        print("Saved {}".format(INDEX_CACHE_FILE))

    if (os.path.isfile(LABELS_FILE) == False):
        with open(LABELS_FILE, 'w') as f:
            for label in dataSet.labelList:
                f.write("%s\n" % label)
            f.close()
        print("Saved {}".format(LABELS_FILE))

    print('Total number of labels: {}'.format(len(dataSet.labelList)))
    print('Total number of samples: {}'.format(len(dataSet)))

    randomSampler = torch.utils.data.RandomSampler(dataSet)
    dataLoader = torch.utils.data.DataLoader(dataSet, batch_size = BATCH_SIZE, sampler = randomSampler, num_workers=4, pin_memory=True)

    model = CNNModel(input_size=64, num_classes=len(dataSet.labelList)).to(DEVICE)

    if (os.path.isfile(STATE_DICT_FILE)):
        # We found an existing cnn_model.pth file! Instead of starting from scratch we'll load this one.
        # and continue training it.
        print("Loading {}".format(STATE_DICT_FILE))
        state_dict = torch.load(STATE_DICT_FILE)
        model.load_state_dict(state_dict)

    optimizer = None
    if (OPTIMIZER_NAME == 'SGD'):
        optimizer = optim.SGD(model.parameters(), lr = SGD_LEARNING_RATE, momentum=SGD_MOMENTUM)
        print('Using SGD with learning rate {} and momentum {}'.format(SGD_LEARNING_RATE, SGD_MOMENTUM))
    elif (OPTIMIZER_NAME == 'Adam'):
        if MIXED_PRECISION:
            optimizer = optim.Adam(model.parameters(), lr = ADAM_LEARNING_RATE, betas = ADAM_BETAS, eps = ADAM_EPSILON)
        else:
            optimizer = optim.Adam(model.parameters(), lr = ADAM_LEARNING_RATE)
        print('Using Adam with learning rate {}'.format(ADAM_LEARNING_RATE))
    else:
        print('No optimizer specified!')

    if MIXED_PRECISION:
        # Using NVidia's AMP Pytorch extension
        model, optimizer = amp.initialize(model, optimizer, opt_level="O1")

    criterion = nn.CrossEntropyLoss()

    ROLLING_AVERAGE_RUN_LENGTH = 100
    rolling = np.zeros(0)
    record_rolling_average = 0
    count = 0

    # On my computer each epoch takes about 4 hours; the script consumes ~250 watts or about 1 kWh per epoch.
    # Performance reaches a plateau after 3-4 epochs.
    for epoch in range(4):
        print('Epoch: {}'.format(epoch))
        batch_number = 0
        for i, (images, labels) in enumerate(dataLoader):
            count = count + 1
            images = images.to(DEVICE)
            labels = labels.to(DEVICE)
            optimizer.zero_grad()
            outputs = model(images)
            _, predicted = torch.max(outputs.data, 1)
            correct = (predicted == labels).sum().item()
            if (count < ROLLING_AVERAGE_RUN_LENGTH):
                rolling = np.insert(rolling, 0, correct)
            else:
                rolling = np.roll(rolling, 1)
                rolling[0] = correct
            rolling_average = int(np.mean(rolling))
            loss = criterion(outputs, labels)
            if MIXED_PRECISION:
                # Use of FP16 requires loss scaling, due to underflow error.
                # See https://devblogs.nvidia.com/mixed-precision-training-deep-neural-networks/
                with amp.scale_loss(loss, optimizer) as scaled_loss:
                    scaled_loss.backward()
            else:
                loss.backward()
            optimizer.step()
            print('EPOCH: {}  BATCH: {}  SIZE: {}  CORRECT: {}  (ROLLING AVG: {})'.format(epoch, batch_number, BATCH_SIZE, correct, rolling_average))
            batch_number += 1
            # print(loss.item())

            # To be safe, save model whenever performance reaches a new high
            if (count < 2 * ROLLING_AVERAGE_RUN_LENGTH):  # (once rolling average has had time to stabilize)
                record_rolling_average = max(rolling_average, record_rolling_average)
            else:
                if (rolling_average > record_rolling_average):
                    # Save model with a munged filename; e.g. cnn_model_706.pth
                    if (SAVE_BACKUP_FILES):
                        torch.save(model.state_dict(), NUMBERED_STATE_DICT_FILE_TEMPLATE.format(rolling_average))
                        print('Saved model file (ROLLING AVG: {})'.format(rolling_average))
                        # Delete the last backup we wrote to avoid filling up the drive with 300 MB files
                        if (record_rolling_average > 0):
                            old_file = NUMBERED_STATE_DICT_FILE_TEMPLATE.format(record_rolling_average)
                            if os.path.exists(old_file):
                                os.remove(old_file)
                    record_rolling_average = rolling_average

            # Deleting the model file during training triggers a fresh rewrite:
            if (os.path.isfile(STATE_DICT_FILE) == False):
                torch.save(model.state_dict(), STATE_DICT_FILE)
                print('Saved model file {}'.format(STATE_DICT_FILE))
            # ONNX: same policy
            if (os.path.isfile(ONNX_FILE) == False):
                if MIXED_PRECISION:
                    with amp.disable_casts():
                        dummy_input = torch.randn(1, 1, 64, 64).to(DEVICE)
                        torch.onnx.export(model, dummy_input, ONNX_FILE, verbose=True)
                else:
                    dummy_input = torch.randn(1, 1, 64, 64).to(DEVICE)
                    torch.onnx.export(model, dummy_input, ONNX_FILE, verbose=True)
                print('Exported ONNX file {}'.format(ONNX_FILE))
        # Epoch finished
        # Save the current model at the end of an epoch
        torch.save(model.state_dict(), STATE_DICT_FILE)
        # Export ONNX
        if (MIXED_PRECISION):
            with amp.disable_casts():
                dummy_input = torch.randn(1, 1, 64, 64).to(DEVICE)
                torch.onnx.export(model, dummy_input, ONNX_FILE, verbose=True)
        else:
            dummy_input = torch.randn(1, 1, 64, 64).to(DEVICE)
            torch.onnx.export(model, dummy_input, ONNX_FILE, verbose=True)
        print('EPOCH {} FINISHED, SAVED MODEL FILES'.format(epoch))
