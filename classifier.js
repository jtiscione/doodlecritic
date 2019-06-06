const fs = require('fs');
const util = require('util');

const fetch = require('node-fetch');

const onnx = require('onnxjs-node');

const { Tensor, InferenceSession } = onnx;

const ONNX_FILE = 'cnn_model.onnx';
const LABELS_FILE = 'labels.txt';

const S3_BUCKET = 'https://onnx.s3-us-west-2.amazonaws.com';

module.exports = {

  labels: null,
  session: null,

  async init() {
    // Helper; downloads labels.txt and cnn_model.onnx files from S3 and write them to disk if we don't have them.
    // (The onnxjs module proper wants to be given a URL, but onnxjs-node wants a filename.)
    // Using onnx-node since local files are easier to work with than S3 for debugging.
    checkFile = async (filename) => {
      const present = await util.promisify(fs.exists)('./' + filename);
      if (!present) {
        const response = await fetch(S3_BUCKET + '/' + filename, { method: 'GET' });
        const buffer = await response.buffer();
        await util.promisify(fs.writeFile)('./' + filename, buffer, 'binary');
        console.log(`Wrote file ./${filename}.`);
      } else {
        console.log(`Found file ./${filename}.`)
      }
    };

    await checkFile(LABELS_FILE);
    await checkFile(ONNX_FILE);

    this.labels = fs.readFileSync('./' + LABELS_FILE, 'utf8')
      .split('\n')
      .filter(e => e); // trim empty string

    this.session = new InferenceSession();
    await this.session.loadModel('./' + ONNX_FILE);
  },

  async classify(inputString) {

    if (this.session === null) {
      this.session = new InferenceSession();
      await this.session.loadModel('./cnn_model.onnx');
    }

    const inputArray = new Float32Array(inputString.split('').map(digit => (digit === '1' ? 1 : 0)));

    const inputTensor = new Tensor(inputArray, 'float32', [1, 1, 64, 64]);

    const outputMap = await this.session.run([inputTensor]);

    const rawValues = Array.from(outputMap.values())[0].data;

    // Implementation detail with this particular network- we need to compute softmax
    const exponents = rawValues.map(Math.exp);
    const exponentSum = exponents.reduce((acc, e) => acc + e, 0);
    const softmax = exponents.map(e => e / exponentSum);

    const valueByLabel = this.labels.reduce((acc, e, i) => {
      acc[e] = softmax[i];
      return acc;
    }, {});
    const sortedLabels = [...this.labels].sort((e1, e2) => valueByLabel[e2] - valueByLabel[e1]);
    // Return top ten
    return sortedLabels.slice(0, 10).map((label => ({ value: label, count: Math.round(1000 * valueByLabel[label]) })));
  }
};
