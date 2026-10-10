const express = require('express');
const app = express();
const port = 3000;

app.use('/img', express.static('img'));

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile('index.html', { root: 'views' });
});

app.get(['/index2', '/index2.html'], (req, res) => {
  res.sendFile('index2.html', { root: 'views' });
});

app.get(['/index3', '/index3.html', '/plugin', '/plugin.html'], (req, res) => {
  res.sendFile('index3.html', { root: 'views' });
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});