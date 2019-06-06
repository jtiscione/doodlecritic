const fs = require('fs');

const onnx = require('onnxjs-node');
const { Tensor, InferenceSession } = onnx;

async function main() {

  const session = new InferenceSession();

  const labels = fs.readFileSync('./labels.txt', 'utf8')
    .split('\n')
    .filter(e => e); // trim empty string

  await session.loadModel('./cnn_model.onnx');

  const x = new Float32Array(1 * 1 * 64 * 64).fill(0);
  const input = new Tensor(x, 'float32', [1, 1, 64, 64]);

  const outputMap = await session.run([input]);
  const rawValues = Array.from(outputMap.values())[0].data;
  const exponents = rawValues.map(Math.exp);
  const exponentSum = exponents.reduce((acc, e) => acc + e, 0);
  const softmax = exponents.map(e => e / exponentSum);

  const valueByLabel = labels.reduce((acc, e, i) => {
    acc[e] = softmax[i];
    return acc;
  }, {});

  const sortedLabels = labels.sort((e1, e2) => valueByLabel[e2] - valueByLabel[e1]);

  console.dir(sortedLabels);
}

main()
  .then(console.log)
  .catch(console.error);
