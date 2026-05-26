/** Shared Game News read-state (localStorage key must match app.js). */
const GAME_NEWS_SEEN_KEY = 'ggen_game_news_seen';

function normalizeGameNewsLangKey(lang) {
  const k = String(lang || 'EN').trim().toUpperCase() || 'EN';
  return k === 'JA' ? 'JP' : k;
}

function readGameNewsSeenState(lang) {
  const k = normalizeGameNewsLangKey(lang);
  try {
    const all = JSON.parse(localStorage.getItem(GAME_NEWS_SEEN_KEY) || '{}');
    const row = all[k] || all[k === 'JP' ? 'JA' : ''];
    return row && typeof row === 'object'
      ? { at: Number(row.at) || 0, fp: String(row.fp || '') }
      : { at: 0, fp: '' };
  } catch (_) {
    return { at: 0, fp: '' };
  }
}

function writeGameNewsSeenState(lang, patch) {
  const k = normalizeGameNewsLangKey(lang);
  try {
    const all = JSON.parse(localStorage.getItem(GAME_NEWS_SEEN_KEY) || '{}');
    const prev = all[k] && typeof all[k] === 'object' ? all[k] : {};
    all[k] = {
      at: Number(patch && patch.at != null ? patch.at : prev.at) || 0,
      fp: String(patch && patch.fp != null ? patch.fp : prev.fp || ''),
    };
    localStorage.setItem(GAME_NEWS_SEEN_KEY, JSON.stringify(all));
  } catch (_) {}
}

async function markGameNewsSeenForLang(lang) {
  const lc = normalizeGameNewsLangKey(lang);
  try {
    const r = await fetch('/api/game_news/status?lang=' + encodeURIComponent(lc), {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!r.ok) return;
    const d = await r.json();
    writeGameNewsSeenState(lc, {
      at: Number(d.latest_at) || 0,
      fp: String(d.content_fp || d.fingerprint || ''),
    });
  } catch (_) {}
}
