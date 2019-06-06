const fs = require('fs');

const onnx = require('onnxjs-node');

const { Tensor, InferenceSession } = onnx;

let session = null;
let labels = null;

module.exports = async function (inputString) {

  if (session === null) {

    session = new InferenceSession();

    labels = fs.readFileSync('./labels.txt', 'utf8')
      .split('\n')
      .filter(e => e); // trim empty string

    await session.loadModel('./cnn_model.onnx');

  }

  const inputArray = new Float32Array(inputString.split('').map(digit => (digit === '1' ? 1 : 0)));

  const inputTensor = new Tensor(inputArray, 'float32', [1, 1, 64, 64]);

  const outputMap = await session.run([inputTensor]);

  const rawValues = Array.from(outputMap.values())[0].data;

  // Implementation detail with this particular network- we need to compute softmax
  const exponents = rawValues.map(Math.exp);
  const exponentSum = exponents.reduce((acc, e) => acc + e, 0);
  const softmax = exponents.map(e => e / exponentSum);

  const valueByLabel = labels.reduce((acc, e, i) => {
    acc[e] = softmax[i];
    return acc;
  }, {});
  const sortedLabels = [...labels].sort((e1, e2) => valueByLabel[e2] - valueByLabel[e1]);
  // Return top ten
  return sortedLabels.slice(0, 10).map((label => ({ value: label, count: Math.round(1000 * valueByLabel[label]) })));
};
