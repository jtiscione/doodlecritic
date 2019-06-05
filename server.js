const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const classify = require('./classify');

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
  console.log('/paint');
  const { body } = req;
  const topFive = await classify(body.input);
  console.dir(topFive);
  res.send(200, { top_five: topFive });
});


app.get('/', (req, res) => {
  res.send('HEY again.');
});

if (haveBuildFolder){
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

app.listen(process.env.PORT || 8080);
console.log('Listening on port 8080');
