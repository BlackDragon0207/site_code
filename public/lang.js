/**
 * lang.js — 페이지 새로고침 없이 한국어 / 日本語 / English 를 즉시 전환하는 엔진
 *
 * public/i18n-data.js (tools/generate-i18n.js 로 생성) 의 사전을 사용합니다.
 *
 * [동작 방식]
 * 1. 현재 문서의 요소(open 태그)와 텍스트 노드를 문서 순서대로 세어 인덱스를 부여합니다.
 *    (script/style 내부는 세지 않음 — 도구 스크립트의 인덱싱과 동일한 규칙)
 * 2. HTML 에는 한국어 원문이 남아 있으므로, 최초 실행 시 한국어 원문을 그대로 캡처합니다.
 * 3. 언어를 바꾸면 캡처한 한국어 원문 + 사전 값으로 텍스트/속성을 다시 씁니다.
 * 4. 즉, 뼈대 파일은 한국어 원문을 유지하고, 번역은 이 스크립트가 담당합니다.
 *    문구를 수정한 뒤에는 `node tools/generate-i18n.js` 로 사전만 다시 만들면 됩니다.
 *
 * 언어가 바뀌면 document 에 i18n:changed 이벤트가 발생합니다.
 * data-i18n="키" 속성이 있는 요소에는 window.__I18N__.dyn 의 동적 문자열이 적용됩니다.
 */
(function () {
  'use strict';

  var DATA = window.__I18N__;
  if (!DATA || !DATA.pages) {
    console.error('[lang] i18n-data.js 를 찾을 수 없습니다.');
    return;
  }

  var STORAGE_KEY = 'pf-lang';
  var SUPPORTED = ['ko', 'ja', 'en'];
  var DEFAULT_LANG = 'ko';
  var LANG_ATTR = { ko: 'ko', ja: 'ja', en: 'en' };

  // ---------- 페이지 사전 결정 ----------
  function resolvePage() {
    var p = location.pathname.replace(/\/+$/, '');
    if (/\/index2(\.html)?$/i.test(p)) return DATA.pages['index2.html'];
    if (p.indexOf('/plugin') !== -1 || /\/index3(\.html)?$/i.test(p)) return DATA.pages['index3.html'];
    return DATA.pages['index.html'];
  }
  var dict = resolvePage();

  // ---------- 언어 결정 (쿠키 > 브라우저 언어 > 기본값) ----------
  function readCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function writeCookie(name, value) {
    var d = new Date();
    d.setTime(d.getTime() + 365 * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + encodeURIComponent(value) +
      ';path=/;expires=' + d.toUTCString() + ';SameSite=Lax';
  }
  function detectLang() {
    var saved = readCookie(STORAGE_KEY);
    if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
    var list = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).toLowerCase();
      if (code.indexOf('ko') === 0) return 'ko';
      if (code.indexOf('ja') === 0) return 'ja';
      if (code.indexOf('en') === 0) return 'en';
    }
    return DEFAULT_LANG;
  }

  var currentLang = detectLang();

  // ---------- 수집 ----------
  var elRecords = [];   // { el, attrs: { name: {ko, ja, en} } }
  var textRecords = []; // { node, text: {ko, ja, en} }
  var langButtons = [];
  var bound = false;

  function acceptNode(node) {
    if (node.nodeType === 1 && (node.tagName === 'SCRIPT' || node.tagName === 'STYLE')) {
      return NodeFilter.FILTER_REJECT;
    }
    return NodeFilter.FILTER_ACCEPT;
  }

  function collect() {
    // tools/generate-i18n.js 와 동일하게 documentElement(<html>)를 루트로 순회한다.
    // (<html> 자신은 nextNode() 로 반환되지 않으므로 세지 않는다.)
    // 이렇게 해야 <title> / meta description 등 head 쪽 텍스트도 함께 번역된다.
    var walker = document.createTreeWalker(
      document.documentElement,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      { acceptNode: acceptNode }
    );

    var elIdx = -1;
    var textIdx = -1;
    var node = walker.nextNode();

    while (node) {
      if (node.nodeType === 1) {
        elIdx++;
        var attrDict = dict.a[elIdx];
        var record = { el: node, attrs: null };
        if (attrDict) {
          record.attrs = {};
          for (var name in attrDict) {
            if (!Object.prototype.hasOwnProperty.call(attrDict, name)) continue;
            record.attrs[name] = {
              ko: node.getAttribute(name),
              ja: attrDict[name].ja,
              en: attrDict[name].en
            };
          }
        }
        elRecords.push(record);
        if (node.hasAttribute && node.hasAttribute('data-lang-btn')) langButtons.push(node);
      } else {
        textIdx++;
        var entry = dict.t[textIdx];
        if (entry) {
          textRecords.push({
            node: node,
            text: { ko: node.nodeValue, ja: entry.ja, en: entry.en }
          });
        }
      }
      node = walker.nextNode();
    }
  }

  // ---------- 적용 ----------
  function pick(values, lang) {
    var v = values[lang];
    return (v === undefined || v === null) ? values.ko : v;
  }

  function applyStatic(lang) {
    var i, name;
    for (i = 0; i < elRecords.length; i++) {
      var record = elRecords[i];
      if (!record.attrs) continue;
      for (name in record.attrs) {
        if (!Object.prototype.hasOwnProperty.call(record.attrs, name)) continue;
        record.el.setAttribute(name, pick(record.attrs[name], lang));
      }
    }
    for (i = 0; i < textRecords.length; i++) {
      var t = textRecords[i];
      var next = pick(t.text, lang);
      if (t.node.nodeValue !== next) t.node.nodeValue = next;
    }
  }

  // data-i18n="키" (동적 문자열) 적용
  function applyDataI18nKeys(lang) {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var entry = DATA.dyn[nodes[i].getAttribute('data-i18n')];
      if (!entry) continue;
      nodes[i].textContent = entry[lang] !== undefined ? entry[lang] : entry.ko;
    }
  }

  function updateLangButtons() {
    for (var i = 0; i < langButtons.length; i++) {
      var btn = langButtons[i];
      var active = btn.getAttribute('data-lang-btn') === currentLang;
      // 스타일은 CSS(#lang-dialog [data-lang-btn][aria-current="true"])가 담당한다.
      // 인라인 스타일로 덮어쓰면 호버 애니메이션이 동작하지 않으므로 속성만 갱신한다.
      btn.setAttribute('aria-current', active ? 'true' : 'false');
      if (active) btn.setAttribute('data-active', 'true');
      else btn.removeAttribute('data-active');
    }
  }

  function setLang(lang, persist) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
    currentLang = lang;
    if (persist !== false) writeCookie(STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', LANG_ATTR[lang]);
    applyStatic(lang);
    applyDataI18nKeys(lang);
    updateLangButtons();
    document.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: lang } }));
  }

  // 카드 생성 스크립트용 접근자
  function t(key) {
    var entry = DATA.dyn[key];
    if (!entry) return '';
    return entry[currentLang] !== undefined ? entry[currentLang] : entry.ko;
  }

  // 클릭 위임: 버튼이 나중에 추가/교체되어도 항상 동작하도록 document 에 위임한다.
  // (개별 addEventListener 방식은 DOM 이 다시 그려지면 리스너가 사라질 수 있다)
  function bindLangButtons() {
    if (bound) return;
    bound = true;

    document.addEventListener('click', function (event) {
      var target = event.target;
      // 버튼 자체 또는 그 안쪽 요소를 클릭한 경우를 모두 처리
      var btn = null;
      while (target && target !== document) {
        if (target.nodeType === 1 && target.hasAttribute && target.hasAttribute('data-lang-btn')) {
          btn = target;
          break;
        }
        target = target.parentNode;
      }
      if (!btn) return;

      event.preventDefault();
      setLang(btn.getAttribute('data-lang-btn'), true);

      var dialog = btn.closest ? btn.closest('dialog') : null;
      if (dialog && typeof dialog.close === 'function' && dialog.open) dialog.close();
    }, true); // 캡처 단계: 다른 핸들러가 이벤트를 막아도 동작
  }

  window.Lang = {
    set: setLang,
    get: function () { return currentLang; },
    t: t,
    supported: SUPPORTED.slice()
  };

  var initialized = false;

  function init() {
    if (initialized) return;
    initialized = true;
    collect();
    bindLangButtons();
    setLang(currentLang, false);
  }

  // </body> 직전에 로드되므로 보통 readyState 는 'interactive' → 즉시 init().
  // 혹시 로딩 중이라면 DOMContentLoaded 를 "캡처" 단계에서 잡아
  // 페이지 자체 스크립트(대표작 카드 생성 등)보다 먼저 번역을 적용한다.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, true);
  } else {
    init();
  }
})();
