const util = require('util');
const fs = require('fs');

const onnx = require('onnxjs-node');
const { Tensor, InferenceSession } = onnx;

async function main() {

  const session = new InferenceSession();

  const labels = fs.readFileSync('/home/jason/repo/convolutional/labels.txt', 'utf8')
    .split('\n')
    .filter(e => e); // trim empty string

  await session.loadModel('/home/jason/repo/convolutional/cnn_model.onnx');

  const x = new Float32Array(1 * 1 * 64 * 64).fill(0);
  const input = new Tensor(x, 'float32', [1, 1, 64, 64]);

  const outputMap = await session.run([input]);
  const values = Array.from(outputMap.values())[0].data;
  const valueByLabel = labels.reduce((acc, e, i) => {
    acc[e] = values[i];
    return acc;
  }, {});

  const sortedLabels = labels.sort((e1, e2) => valueByLabel[e1] - valueByLabel[e2]);

  console.dir(sortedLabels);
}

main()
  .then(console.log)
  .catch(console.error);
