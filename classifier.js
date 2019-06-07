const fs = require('fs');
const util = require('util');

const fetch = require('node-fetch');

const onnx = require('onnxjs-node');

const { Tensor, InferenceSession } = onnx;

const ONNX_FILE = 'cnn_model.onnx';
const LABELS_FILE = 'labels.txt';

const S3_BUCKET = 'https://onnx.s3-us-west-2.amazonaws.com';

/*
 * This object will load the ONNX module and provide the interface to it.
 * First call init(), then make calls to classify().
 */
module.exports = {

  labels: null,
  session: null,

  /*
   * Initial setup
   */
  async init() {

    /*
     * Helper: if a specified file is not here, download and save a copy from S3
     */
    const checkFile = async (filename) => {
      const present = await util.promisify(fs.exists)('./' + filename);
      if (!present) {
        console.log(`Fetching ${S3_BUCKET} from S3...`);
        const response = await fetch(S3_BUCKET + '/' + filename, { method: 'GET' });
        const buffer = await response.buffer();
        await util.promisify(fs.writeFile)('./' + filename, buffer, 'binary');
        console.log(`Wrote file ./${filename}.`);
      } else {
        console.log(`Found file ./${filename}.`);
      }
    };

    // Download labels if necessary
    await checkFile(LABELS_FILE);

    // Read labels.txt
    this.labels = fs.readFileSync('./' + LABELS_FILE, 'utf8')
      .split('\n').filter(e => e); // trim empty string

    // Download ONNX if necessary
    await checkFile(ONNX_FILE);

    // Create an InferenceSession and load the ONNX model
    this.session = new InferenceSession();
    await this.session.loadModel('./' + ONNX_FILE);
  },

  /*
   * Classifier method:
   * [Assume] inputString is 4096 bytes long and consists of zeroes and ones.
   */
  async classify(inputString, limit = 10) {

    console.log(inputString.match(/.{1,64}/g).join('\n'));

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
    const topmost = sortedLabels.slice(0, limit).map((label => ({ label, value: valueByLabel[label] })));
    console.dir(topmost);
    return topmost;
  },
};
