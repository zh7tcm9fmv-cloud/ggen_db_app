const LANG_STORAGE_KEY = 'ggen_lang';
/** Global / EN / TW / HK official site host */
const GAME_NEWS_BASE_GL = 'https://web.gl.eternal.channel.or.jp';
/** Japan locale host (official JP site) */
const GAME_NEWS_BASE_JP = 'https://web.jp.eternal.channel.or.jp';

const S = { lang: 'EN', languages: [] };

const UI = {
  EN: {
    page_title: 'Game News',
    nav_home: '← GGen Database',
    iframe_title: 'SD Gundam G Generation ETERNAL — update information',
    close: 'Close',
  },
  TW: {
    page_title: '遊戲公告',
    nav_home: '← GGen 資料庫',
    iframe_title: 'SD鋼彈 G世代 永恆 — 更新資訊',
    close: '關閉',
  },
  HK: {
    page_title: '遊戲公告',
    nav_home: '← GGen 資料庫',
    iframe_title: 'SD高達 G世代 永恆 — 更新資訊',
    close: '關閉',
  },
  JP: {
    page_title: 'ゲームニュース',
    nav_home: '← GGen Database',
    iframe_title: 'SDガンダム ジージェネ エターナル — 更新情報',
    close: '閉じる',
  },
};

const ALIPAY_MODAL = {
  EN: { title: 'AlipayHK', hint: 'Scan the QR code with AlipayHK to pay HK$50.00.' },
  TW: { title: 'AlipayHK', hint: '請使用 AlipayHK 掃描二維碼付款（港幣 50.00 元）。' },
  HK: { title: 'AlipayHK', hint: '請使用 AlipayHK 掃描二維碼付款（港幣 50.00 元）。' },
  JP: { title: 'AlipayHK', hint: 'AlipayHKアプリでQRコードを読み取り、HK$50.00をお支払いください。' },
};

const HEADER = {
  EN: { alipay: 'Support on AlipayHK', kofi: 'Support on Ko-fi' },
  TW: { alipay: '以 AlipayHK 支持', kofi: '在 Ko-fi 支持' },
  HK: { alipay: '以 AlipayHK 支持', kofi: '在 Ko-fi 支持' },
  JP: { alipay: 'AlipayHKで支援', kofi: 'Ko-fiで支援' },
};

function readPersistedLang() {
  try {
    const s = localStorage.getItem(LANG_STORAGE_KEY);
    return s && String(s).trim() ? String(s).trim() : '';
  } catch (_) {
    return '';
  }
}

function persistLang(l) {
  try {
    if (l) localStorage.setItem(LANG_STORAGE_KEY, String(l));
  } catch (_) {}
}

function tUi(lang) {
  const k = (lang || 'EN').toUpperCase();
  if (k === 'JA') return UI.JP;
  return UI[k] || UI.EN;
}

function tHeader(lang) {
  const k = (lang || 'EN').toUpperCase();
  if (k === 'JA') return HEADER.JP;
  return HEADER[k] || HEADER.EN;
}

function gameNewsUrlForLang(lang) {
  const k = (lang || 'EN').toUpperCase();
  let seg = 'en';
  if (k === 'TW') seg = 'tw';
  else if (k === 'HK') seg = 'hk';
  else if (k === 'JP' || k === 'JA') {
    return `${GAME_NEWS_BASE_JP}/ja/information/update.html`;
  }
  const base = GAME_NEWS_BASE_GL;
  return `${base}/${seg}/information/update.html`;
}

let _scrollLock = 0;
function applyBackgroundScrollLock() {
  if (_scrollLock === 0) document.documentElement.classList.add('page-scroll-lock');
  _scrollLock++;
}
function releaseBackgroundScrollLock() {
  if (_scrollLock <= 0) {
    _scrollLock = 0;
    document.documentElement.classList.remove('page-scroll-lock');
    return;
  }
  _scrollLock--;
  if (_scrollLock === 0) document.documentElement.classList.remove('page-scroll-lock');
}

async function ensureJpModeUnlockedForSwitch(l) {
  const lc = (l || '').toUpperCase();
  if (lc !== 'JP' && lc !== 'JA') return true;
  const msg =
    'We apologize for the inconvenience.\nDue to unforeseen conflicts, the Japan version is currently locked.\nThank you for your understanding.';
  try {
    const st = await fetch('/api/jp_mode/status', { credentials: 'same-origin' }).then((r) => r.json());
    if (!st || !st.password_required || st.unlocked) return true;
    alert(st.message || msg);
    const pw = window.prompt('Enter JP mode password');
    if (!pw) return false;
    const rr = await fetch('/api/jp_mode/unlock', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (!rr.ok) {
      alert('Incorrect password.');
      return false;
    }
    return true;
  } catch (_) {
    alert(msg);
    return false;
  }
}

function applyGameNewsUi() {
  const lang = S.lang || 'EN';
  const u = tUi(lang);
  const h = tHeader(lang);
  const titleEl = document.getElementById('gameNewsPageTitle');
  if (titleEl) titleEl.textContent = u.page_title;
  const navCur = document.getElementById('gameNewsNavCurrent');
  if (navCur) {
    const lbl = navCur.querySelector('.nav-tab-label');
    if (lbl) lbl.textContent = u.page_title;
    else navCur.textContent = u.page_title;
  }
  document.title = `${u.page_title} — GGen Database`;
  const navEl = document.getElementById('gameNewsNavHome');
  if (navEl) {
    const lbl = navEl.querySelector('.nav-tab-label');
    if (lbl) lbl.textContent = u.nav_home;
    else navEl.textContent = u.nav_home;
  }
  const ifr = document.getElementById('gameNewsFrame');
  if (ifr) {
    ifr.title = u.iframe_title;
    const next = gameNewsUrlForLang(lang);
    if (ifr.src !== next) ifr.src = next;
  }
  const apL = document.getElementById('alipayhkHeaderLabel');
  if (apL) apL.textContent = h.alipay;
  const kL = document.getElementById('kofiHeaderLabel');
  if (kL) kL.textContent = h.kofi;
  const apB = document.getElementById('alipayhkHeaderBtn');
  if (apB) {
    apB.title = h.alipay;
    apB.setAttribute('aria-label', h.alipay);
  }
  const kA = document.getElementById('kofiHeaderLink');
  if (kA) {
    kA.setAttribute('aria-label', h.kofi);
    kA.title = h.kofi;
  }
  const am = ALIPAY_MODAL[lang] || ALIPAY_MODAL.EN;
  const mt = document.getElementById('alipayhkModalTitle');
  if (mt) mt.textContent = am.title;
  const mh = document.getElementById('alipayhkModalHint');
  if (mh) mh.textContent = am.hint;
  const mq = document.getElementById('alipayhkModalQr');
  if (mq) mq.setAttribute('alt', am.hint);
  const mcb = document.getElementById('alipayhkModalCloseBtn');
  if (mcb) mcb.setAttribute('aria-label', u.close);
}

function renderLangDD() {
  const dd = document.getElementById('langDropdown');
  if (!dd) return;
  dd.innerHTML = S.languages
    .map(
      (l) =>
        `<div class="lang-option ${l === S.lang ? 'selected' : ''}" onclick="gameNewsSelLang('${l}')">${l}</div>`
    )
    .join('');
}

function toggleLangDropdown() {
  const dd = document.getElementById('langDropdown');
  if (dd) dd.classList.toggle('active');
}

async function gameNewsSelLang(l) {
  if (!(await ensureJpModeUnlockedForSwitch(l))) return;
  S.lang = l;
  persistLang(l);
  const lab = document.getElementById('langLabel');
  if (lab) lab.textContent = l;
  const dd = document.getElementById('langDropdown');
  if (dd) dd.classList.remove('active');
  renderLangDD();
  applyGameNewsUi();
  void markGameNewsSeenForLang(l);
}

async function loadLangs() {
  try {
    const r = await fetch('/api/languages');
    const d = await r.json();
    S.languages = d.languages || ['EN'];
    const def = d.default || 'EN';
    const saved = readPersistedLang();
    S.lang = saved && S.languages.includes(saved) ? saved : def;
    const lab = document.getElementById('langLabel');
    if (lab) lab.textContent = S.lang;
    renderLangDD();
    applyGameNewsUi();
  } catch (_) {
    S.languages = ['EN'];
    const saved = readPersistedLang();
    S.lang = saved && S.languages.includes(saved) ? saved : 'EN';
    const lab = document.getElementById('langLabel');
    if (lab) lab.textContent = S.lang;
    renderLangDD();
    applyGameNewsUi();
  }
}

function openAlipayhkModal() {
  const ov = document.getElementById('alipayhkOverlay');
  if (!ov) return;
  const dd = document.getElementById('langDropdown');
  if (dd) dd.classList.remove('active');
  applyGameNewsUi();
  ov.classList.add('active');
  ov.setAttribute('aria-hidden', 'false');
  applyBackgroundScrollLock();
}

function closeAlipayhkModal() {
  const ov = document.getElementById('alipayhkOverlay');
  if (!ov || !ov.classList.contains('active')) return;
  ov.classList.remove('active');
  ov.setAttribute('aria-hidden', 'true');
  releaseBackgroundScrollLock();
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.lang-selector')) {
    const dd = document.getElementById('langDropdown');
    if (dd) dd.classList.remove('active');
  }
});

window.addEventListener('storage', (e) => {
  if (e.key !== LANG_STORAGE_KEY || e.newValue == null) return;
  const v = String(e.newValue).trim();
  if (S.languages.length && !S.languages.includes(v)) return;
  S.lang = v;
  const lab = document.getElementById('langLabel');
  if (lab) lab.textContent = v;
  renderLangDD();
  applyGameNewsUi();
});

document.addEventListener('DOMContentLoaded', () => {
  loadLangs().then(() => {
    void markGameNewsSeenForLang(S.lang || 'EN');
  });
});

window.toggleLangDropdown = toggleLangDropdown;
window.gameNewsSelLang = gameNewsSelLang;
window.openAlipayhkModal = openAlipayhkModal;
window.closeAlipayhkModal = closeAlipayhkModal;
