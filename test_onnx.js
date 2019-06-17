const fs = require('fs');

const onnx = require('onnxjs-node');

const { Tensor, InferenceSession } = onnx;

/*
 * Basic test of the ONNX API and the model file
 */
async function main() {

  const session = new InferenceSession();

  const labels = fs.readFileSync('./labels.txt', 'utf8')
    .split('\n')
    .filter(e => e); // trim empty string

  await session.loadModel('./doodles.onnx');

  // Present it with a random image
  // Dimension 1 is batch dimension (number of images), here we only have one
  // Dimension 2 is number of colors, always one for this network
  // Dimension 3 and 4 are width and height of images
  const x = new Float32Array(1 * 1 * 64 * 64).fill(Math.random());
  const input = new Tensor(x, 'float32', [1, 1, 64, 64]);
  const outputMap = await session.run([input]);
  const rawValues = Array.from(outputMap.values())[0].data;

  // Implementation detail: Need to apply softmax to outputs with this particular model, so test that here:

  const exponents = rawValues.map(Math.exp);
  const exponentSum = exponents.reduce((acc, e) => acc + e, 0);
  const softmax = exponents.map(e => e / exponentSum);

  // Now softmax is an array of values between 0 and 1.

  const valueByLabel = labels.reduce((acc, e, i) => {
    acc[e] = softmax[i];
    return acc;
  }, {});

  labels.sort((e1, e2) => valueByLabel[e2] - valueByLabel[e1]);
  return labels;
}

main()
  .then(console.dir)
  .catch(console.error);
