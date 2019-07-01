// Running "npm start" executes this script.
const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const classifier = require('./classifier');

const buildFolderPath = path.join(__dirname, 'build');
const haveBuildFolder = fs.existsSync(buildFolderPath);

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/labels', async (req, res) => {
  res.send(classifier.getLabels());
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
  // PRODUCTION: serve contents of build folder as static files on port 8000.
  // Must always run "npm run build" prior to "npm start" on production.
  app.use(express.static(buildFolderPath));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
} else if (process.env.NODE_ENV !== 'production') {
  // DEVELOPMENT: Have webpack-dev-server proxy REST API calls here.
  console.log('Run "npm run webpack-dev-server" (port 3000).');
  // Explain that to developers pointing their browsers at localhost:8000
  app.get('/', (req, res) => {
    res.send(`Not serving HTML on port ${process.env.PORT || 8000}. Run webpack-dev-server on port 3000.`);
  });
}

// Initialize classifier
classifier.init();

app.listen(process.env.PORT || 8000);
console.log('Express server listening on port 8000');
