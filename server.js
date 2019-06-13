const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const classifier = require('./classifier');

const buildFolderPath = path.join(__dirname, 'build');
const haveBuildFolder = fs.existsSync(buildFolderPath);

const app = express();

if (haveBuildFolder) {
  app.use(express.static(buildFolderPath));
} else {
  console.log('Need to start webpack-dev-server ')
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/labels', async (req, res) => {
  res.send(classifier.labels);
});

app.post('/paint', async (req, res) => {
  const { body: { input = null } = {} } = req;
  if (!input) {
    res.status(400).send('Invalid request');
    return;
  }
  const output = await classifier.classify(input);
  res.send({ input, output });
});

app.get('/readme', async (req, res) => {
  res.sendFile(path.join(__dirname, '/README.md'));
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
