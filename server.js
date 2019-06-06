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
/*
app.use((req, res, _next) => {
  res.header('Access-Control-Allow-Origin', '*');
});
*/
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.post('/paint', async (req, res) => {
  const { body } = req;
  const topmost = await classifier.classify(body.input);
  res.status(200).send({ tags: topmost });
});

if (haveBuildFolder){
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send(`Listening on port ${ process.env.PORT || 8000 }.`);
  });
}

classifier.init();

app.listen(process.env.PORT || 8000);
console.log('Listening on port 8000');
