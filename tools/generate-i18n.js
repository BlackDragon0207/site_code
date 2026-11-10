/**
 * generate-i18n.js
 *
 * views/index.html, views/index2.html, views/index3.html 을 파싱해
 * 번역 사전(public/i18n-data.js)을 생성/검증합니다.
 *
 * 사용법:
 *   npm install            (최초 1회 — jsdom 포함)
 *   node tools/generate-i18n.js
 *
 * [동작 방식]
 * 페이지는 한국어 HTML 하나입니다. 실제 번역문은 public/i18n-data.js 의
 * 사전에 들어 있습니다. 이 스크립트는:
 *   1) 각 페이지의 요소/텍스트 개수와 순번이 사전 인덱스와 일치하는지 검증하고
 *   2) DYN(동적 문자열) 사전을 최신 상태로 다시 씁니다.
 *
 * 즉, 한국어 페이지 구조가 바뀌면(요소 추가/삭제) 인덱스가 밀리므로
 * 이 스크립트를 실행해 검증해야 합니다.
 *
 * [번역문 수정 방법]
 * views/ja · views/en 폴더는 더 이상 존재하지 않습니다.
 * 문구를 고칠 때는 public/i18n-data.js 의 해당 항목(ja/en 값)을 직접 수정하세요.
 * 인덱스(el###, tx###)는 문서 순서이므로 구조가 그대로면 유지됩니다.
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const VIEWS = path.join(__dirname, '..', 'views');
const OUT = path.join(__dirname, '..', 'public', 'i18n-data.js');

const PAGES = ['index.html', 'index2.html', 'index3.html'];

// lang.js 가 사용하는 동적(스크립트 생성) 문자열 사전
const DYN = {
  channelLabel: { ko: '흑룡 BLACKDRAGON', ja: '黒龍 BLACKDRAGON', en: 'BlackDragon' },
  subsPrefix:   { ko: '구독자 ', ja: '登録者 ', en: 'Subscribers ' },
  subsUnit:     { ko: '명', ja: '人', en: '' },
  subsHidden:   { ko: '구독자 비공개', ja: '登録者非公開', en: 'Subscribers Hidden' },
  vidPrefix:    { ko: '동영상 ', ja: '動画 ', en: 'Videos ' },
  vidUnit:      { ko: '개', ja: '本', en: '' },
  statsLoading: { ko: '구독자 · 동영상 정보를 불러오는 중…', ja: '登録者・動画情報を読み込み中…', en: 'Loading subscriber & video info…' },
  statsError:   { ko: '구독자 · 동영상 정보를 불러오지 못했습니다', ja: '登録者・動画情報を読み込めませんでした', en: 'Could not load subscriber & video info' },
  cat2: { ko: '쇼츠', ja: 'ショーツ', en: 'Shorts' },
  cat1: { ko: '저챗', ja: '雑談', en: 'Just Chatting' },
  cat3: { ko: '종합게임', ja: '総合ゲーム', en: 'Variety Games' },
  cat4: { ko: '발로란트', ja: 'ヴァロラント', en: 'VALORANT' },
  cat5: { ko: '노래 PV', ja: '歌PV', en: 'Song PVs' },
  cat6: { ko: '모션그래픽', ja: 'モーショングラフィックス', en: 'Motion Graphics' },
  repPrev: { ko: '이전 대표작', ja: '前の代表作', en: 'Previous featured works' },
  repNext: { ko: '다음 대표작', ja: '次の代表作', en: 'Next featured works' },
  placeholder: { ko: '준비중', ja: '準備中', en: 'Coming Soon' }
};

// 언어와 무관하게 같은 값이어야 하는 속성 (번역 대상 아님)
const ATTR_DENY = new Set(['href', 'src', 'srcset', 'action', 'style', 'id', 'class', 'data-i18n', 'data-lang-btn']);

// ---------- 문서 순회 ----------
// lang.js 와 완전히 동일한 규칙:
//   - 루트는 document.documentElement(<html>) — <html> 자신은 세지 않음
//   - script/style 은 FILTER_REJECT (하위 트리 전체 제외)
//   - 요소(open 태그)와 텍스트 노드를 각각 문서 순서대로 번호 부여
function collect(doc) {
  const els = [];
  const texts = [];
  const walker = doc.createTreeWalker(
    doc.documentElement,
    /* SHOW_ELEMENT */ 1 | /* SHOW_TEXT */ 4,
    {
      acceptNode(node) {
        if (node.nodeType === 1) {
          const tag = node.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style') return 2; // FILTER_REJECT
          return 1;
        }
        return 1;
      }
    }
  );
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === 1) els.push(node);
    else texts.push(node);
  }
  return { els, texts };
}

function loadKo(file) {
  const p = path.join(VIEWS, file);
  const html = fs.readFileSync(p, 'utf8');
  return new JSDOM(html).window.document;
}

// ---------- 페이지 검증 ----------
// 기존 사전(public/i18n-data.js)을 읽어온다.
function loadExistingDict() {
  const src = fs.readFileSync(OUT, 'utf8');
  const sandbox = { window: {} };
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.__I18N__;
}

// 한국어 페이지의 요소/텍스트 개수가 사전 인덱스와 맞는지 검증한다.
function validatePage(pageFile, dict) {
  const doc = loadKo(pageFile);
  const ko = collect(doc);

  const problems = [];

  if (dict._e !== ko.els.length) {
    problems.push(`요소 개수 불일치 (사전 _e=${dict._e}, 실제=${ko.els.length})`);
  }
  if (dict._t !== ko.texts.length) {
    problems.push(`텍스트 개수 불일치 (사전 _t=${dict._t}, 실제=${ko.texts.length})`);
  }

  // 인덱스 범위를 벗어난 항목이 있는지 확인
  for (const k of Object.keys(dict.a)) {
    const i = Number(k);
    if (!(i < ko.els.length)) problems.push(`속성 인덱스 el${k} 가 요소 범위를 벗어남`);
  }
  for (const k of Object.keys(dict.t)) {
    const i = Number(k);
    if (!(i < ko.texts.length)) problems.push(`텍스트 인덱스 tx${k} 가 텍스트 범위를 벗어남`);
  }

  return { ko, problems };
}

// ---------- 메인 ----------
console.log('번역 사전 검증\n');

const existing = loadExistingDict();
let failed = false;

for (const file of PAGES) {
  const dict = existing.pages[file];
  if (!dict) {
    console.error(`[오류] ${file}: 사전에 항목이 없습니다`);
    failed = true;
    continue;
  }
  const { ko, problems } = validatePage(file, dict);
  const a = Object.keys(dict.a).length;
  const t = Object.keys(dict.t).length;
  if (problems.length) {
    failed = true;
    console.error(`[실패] ${file}`);
    problems.forEach(p => console.error('   - ' + p));
  } else {
    console.log(`[정상] ${file}: 요소 ${ko.els.length}개 / 텍스트 ${ko.texts.length}개 / 번역 속성 ${a}개 / 번역 텍스트 ${t}개`);
  }
}

if (failed) {
  console.error('\n구조가 바뀌어 인덱스가 어긋났습니다. 사전을 다시 만들어야 합니다.');
  console.error('views/ja · views/en 번역 원본 폴더가 없으므로, 해당 문구를 수동으로 다시 채워 넣어야 합니다.');
  process.exitCode = 1;
} else {
  // DYN(동적 문자열) 사전만 최신 상태로 다시 쓴다. 번역문(a/t)은 그대로 보존한다.
  const pages = existing.pages;
  const output =
    '/* 이 파일은 tools/generate-i18n.js 에 의해 생성됩니다. 번역문은 직접 수정해도 됩니다. */\n' +
    'window.__I18N__ = ' + JSON.stringify({ pages: pages, dyn: DYN }) + ';\n';

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, output, 'utf8');
  console.log(`\n검증 통과. 사전 갱신: ${OUT} (${(Buffer.byteLength(output) / 1024).toFixed(1)}KB)`);
  console.log(`동적 문자열 ${Object.keys(DYN).length}개 (DYN 설정)`);
}
