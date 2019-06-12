const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const classifier = require('./classifier');

const buildFolderPath = path.join(__dirname, 'build');
const haveBuildFolder = fs.existsSync(buildFolderPath);

console.log(haveBuildFolder);

const app = express();

if (haveBuildFolder) {
  app.use(express.static(buildFolderPath));
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/labels', async (req, res) => {
  res.status(200).send(classifier.labels);
});

app.post('/paint', async (req, res) => {
  const { body } = req;
  const output = await classifier.classify(body.input);
  res.status(200).send({ output });
});

if (haveBuildFolder) {
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`Listening on port ${process.env.PORT || 8000}.`);
  });
}

classifier.init();

app.listen(process.env.PORT || 8000);
console.log('Listening on port 8000');
