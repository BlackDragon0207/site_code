require('dotenv').config();
const express = require('express');
const path = require('path');
const { getChannelStats } = require('./lib/stats');
const app = express();
const port = 3000;

// 번역 사전(i18n-data.js)과 언어 전환 엔진(lang.js)
app.use('/js', express.static(path.join(__dirname, 'public'), {
  setHeaders(res) { res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate'); }
}));
app.use('/img', express.static(path.join(__dirname, 'img'), {
  setHeaders(res) { res.setHeader('Cache-Control', 'public, max-age=604800'); }
}));

app.get('/api/channel-stats', async (req, res) => {
  res.json(await getChannelStats());
});

// 언어별 파일 구분 없이 하나의 HTML 을 제공하고, 번역은 lang.js 가 담당한다.
// HTML 은 항상 저장하지 않게(no-store) 해서 수정 내용이 즉시 반영되도록 한다.
const send = (file) => (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(file, { root: path.join(__dirname, 'views') });
};

app.get(['/', '/index.html'], send('index.html'));
app.get(['/index2', '/index2.html'], send('index2.html'));
app.get(['/index3', '/index3.html', '/plugin', '/plugin.html'], send('index3.html'));

// 예전 언어별 주소(/en, /ja, /en/plugin ...)는 그대로 같은 페이지를 제공한다.
// (기존 링크/북마크 호환용 — 쿠키에 저장된 언어로 번역되어 표시됨)
app.get(['/en', '/en/', '/en/index.html', '/ja', '/ja/', '/ja/index.html'], send('index.html'));
app.get(['/en/index2', '/en/index2.html', '/ja/index2', '/ja/index2.html'], send('index2.html'));
app.get(
  ['/en/index3', '/en/index3.html', '/en/plugin', '/en/plugin.html',
   '/ja/index3', '/ja/index3.html', '/ja/plugin', '/ja/plugin.html'],
  send('index3.html')
);

if (require.main === module) {
  app.listen(port, () => {
    console.log(`app listening on port ${port}`);
  });
}

module.exports = app;
