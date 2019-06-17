# Doodle Critic
#### GET IMMEDIATE AI FEEDBACK ON YOUR ART.

Draw something in the canvas, and a neural network will guess what it is!

It has been trained using Google's [The Quick, Draw! Dataset](https://quickdraw.withgoogle.com/data), a data set of
50 million doodles separated into 343 classes. Google uses a recurrent neural network that pays attention to the order 
and timing of your strokes as you draw. This one has a simpler design that only looks at the image.

Try to be patient with its poor vision; it's only 70% as accurate as Google's. They have server farms and I have an 
RTX 2060 card with 6 GB. So you will have to draw carefully for it. In many cases I have no clue what this thing is looking for.
 
Keep in mind that it has only seen doodles people have drawn in 20 seconds or less, and most people can't draw.
As soon as Google recognizes a doodle, they snatch the canvas away and move on to the next. Therefore your doodle 
should look like it took you less than 20 seconds.

***

# PROJECT DETAILS

### PYTHON STUFF (training phase)

You can use the Python script `train.py` to create your own network, possibly with a different design.

This Python script will train a neural network and write the model files to the project folder.
 
Using it to train a network using Google's data set will require a GPU, a full day, and several kilowatt hours.
(A CPU will take a week.)

You will need to download about 20 GB of data from Google, specifically the ["simplified drawing files](https://github.com/googlecreativelab/quickdraw-dataset).
You can download them from Google Cloud Storage or from [Kaggle](https://www.kaggle.com/google/tinyquickdraw).

By default, `train.py` will look for Google's data files within a `data/quickdraw` directory in your home folder. 
If you put them somewhere else, supply the path as a command line argument.

Install Python on your system, then install numpy, PIL (Python Image Library), and Pytorch, using `pip install`.

If you're running Linux on a system with an RTX card you can install [NVidia's CUDA Toolkit](https://developer.nvidia.com/cuda-downloads),
and follow their instructions for installing their [Automatic Mixed Precision libary](https://nvidia.github.io/apex/amp.html)
which is a Pytorch extension for performing float-16 arithmetic on the GPU using NVidia's Tensor Cores. If you do this, 
then initialize `MIXED_PRECISION` to `True` in `train.py`. This will cut down on training time and tight memory constraints.

Once trained, the network can discriminate among 344 different classes (including a"nothing" channel
with all-zero samples). If you're not interested in discriminating among that many classes,
remove their data files before starting the training script.

While the script is running, deleting `doodles.onnx` (or `doodles.pth`) will trigger a replacement with fresh versions.
This way you can see how the network is behaving at various phases of training by periodically deleting the existing
`doodles.onnx` and running the JavaScript webapp using the new version that appears.

### JAVASCRIPT STUFF (deployment phase)

Unlike training, deploying a neural network requires little computing power. A Raspberry Pi can handle it easily.
The network is deployed as a Node.js webapp, using Express on the server and React on the client.

In general, neural networks can be downloaded in ONNX format and run in the client's browser, but not this one-
`doodles.onnx` is 300 MB and must stay on the server. Upon startup the server will load the file 
(or download it from S3 if it's missing) and initialize the network. Clients then communicate with it using a REST API
that accepts a 64x64 black and white image and responds with a list of guesses. 

If you start the server without `doodles.onnx` present, it will download a copy from a bucket I left on S3.
A much smaller file (`labels.txt`) will also be downloaded from S3 if it is not present. In general these two
files are a matched set generated by the Python training script. Both are included in `.gitignore`.

### Available Scripts

In the project directory, you can run:

#### `npm run build`

Builds the app for production to the `build` folder.

It correctly bundles React in production mode and optimizes the build for the best performance.
The app is now ready to be deployed using `npm start`.

#### `npm run clean`

Blows away the `build` folder.

#### `npm start`

Starts the Express server listening on port 8000. (This basically means running `node ./server.js`.)

If `npm run build` has been executed, a build folder will be found, and its contents will be served as static files.
Otherwise the server will warn you that you need to run the `webpack-dev-server` script.


#### `npm run webpack-dev-server`.

Runs the app in development mode (for React development). This needs to be run alongside `npm start` and after `npm run clean`.
The app will then be visible on port 3000. The page will reload if you make edits.

#### `npm run eject`

This is a one-way, irreversible operation. Run this if you like dealing with Webpack files.
