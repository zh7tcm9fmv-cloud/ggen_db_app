/** Shared unread-content notices (Game News, Latest Release, What's New, banner votes). */
(function (global) {
  const GAME_NEWS_SEEN_KEY = 'ggen_game_news_seen';
  const WHATS_NEW_SEEN_KEY = 'ggen_whats_new_seen';
  const LATEST_RELEASE_SEEN_KEY = 'ggen_latest_release_seen';
  const LANG_STORAGE_KEY = 'ggen_lang';
  const UI_NOTICE_FLARE_PATH = '/static/images/UI/UI_MapEventEffect_FlareCircleRed.webp';
  const BT_VOTE_DISABLED_GASHA_IDS = new Set(['2504100101', '2604300101']);

  const state = {
    lang: 'EN',
    gameNews: null,
    latestRelease: null,
    whatsNew: null,
    btVoteLoaded: false,
    btBanners: null,
    btVoteMine: {},
    btVoteTotals: {},
  };

  function readPersistedLang() {
    try {
      const s = localStorage.getItem(LANG_STORAGE_KEY);
      return s && String(s).trim() ? String(s).trim() : '';
    } catch (_) {
      return '';
    }
  }

  function currentLang() {
    if (state.lang) return state.lang;
    const saved = readPersistedLang();
    return saved || 'EN';
  }

  function normalizeGameNewsLangKey(lang) {
    const k = String(lang || 'EN').trim().toUpperCase() || 'EN';
    return k === 'JA' ? 'JP' : k;
  }

  function imgUrlPreferCdn(path) {
    const cdn = global.__GGEN_IMAGE_CDN__;
    const useCdn = global.__GGEN_GAME_IMAGES_USE_CDN__;
    if (cdn && useCdn !== false && path && path.indexOf('/static/') === 0) {
      return String(cdn) + path.slice('/static'.length);
    }
    return path;
  }

  function escAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function uiNoticeFlareHtml() {
    const src = imgUrlPreferCdn(UI_NOTICE_FLARE_PATH);
    return (
      '<span class="ui-notice-flare" aria-hidden="true"><img class="ui-notice-flare-img" src="' +
      escAttr(src) +
      '" alt="" decoding="async" onerror="this.parentElement.style.display=\'none\'"></span>'
    );
  }

  function ensureNoticeFlare(el) {
    if (!el || el.querySelector('.ui-notice-flare')) return;
    el.insertAdjacentHTML('beforeend', uiNoticeFlareHtml());
  }

  function setNotice(el, show) {
    if (!el) return;
    ensureNoticeFlare(el);
    el.classList.toggle('has-ui-notice', !!show);
  }

  function syncOverflowHints() {
    if (typeof global.syncNavTabsOverflowHints === 'function') global.syncNavTabsOverflowHints();
  }

  function readSeen(key, lang) {
    const k = normalizeGameNewsLangKey(lang);
    try {
      const all = JSON.parse(localStorage.getItem(key) || '{}');
      const row = all[k] || all[k === 'JP' ? 'JA' : ''];
      return row && typeof row === 'object'
        ? { at: Number(row.at) || 0, fp: String(row.fp || '') }
        : { at: 0, fp: '' };
    } catch (_) {
      return { at: 0, fp: '' };
    }
  }

  function readGlobalSeen(key) {
    try {
      const row = JSON.parse(localStorage.getItem(key) || '{}');
      return row && typeof row === 'object'
        ? { at: Number(row.at) || 0, fp: String(row.fp || '') }
        : { at: 0, fp: '' };
    } catch (_) {
      return { at: 0, fp: '' };
    }
  }

  function writeSeen(key, lang, patch) {
    const k = normalizeGameNewsLangKey(lang);
    try {
      const all = JSON.parse(localStorage.getItem(key) || '{}');
      const prev = all[k] && typeof all[k] === 'object' ? all[k] : {};
      all[k] = {
        at: Number(patch && patch.at != null ? patch.at : prev.at) || 0,
        fp: String(patch && patch.fp != null ? patch.fp : prev.fp || ''),
      };
      localStorage.setItem(key, JSON.stringify(all));
    } catch (_) {}
  }

  function writeGlobalSeen(key, patch) {
    try {
      const prev = JSON.parse(localStorage.getItem(key) || '{}');
      const row = prev && typeof prev === 'object' ? prev : {};
      const next = {
        at: Number(patch && patch.at != null ? patch.at : row.at) || 0,
        fp: String(patch && patch.fp != null ? patch.fp : row.fp || ''),
      };
      localStorage.setItem(key, JSON.stringify(next));
    } catch (_) {}
  }

  function updateGameNewsNotice(show) {
    setNotice(document.getElementById('navGameNewsTab'), show);
    const footer = document.querySelector('.site-footer-links a[href="/game-news"]');
    if (footer && !document.getElementById('gameNewsNavCurrent')) {
      setNotice(footer, show);
    }
    syncOverflowHints();
  }

  function updateLatestReleaseNotice(show) {
    setNotice(document.getElementById('navLatestTab'), show);
    syncOverflowHints();
  }

  function updateWhatsNewNotice(show) {
    document.querySelectorAll('.btn-whats-new').forEach((btn) => setNotice(btn, show));
    syncOverflowHints();
  }

  function updateHomeAggregateNotice(show) {
    const home = document.getElementById('gameNewsNavHome');
    if (home) setNotice(home, show);
    const back = document.querySelector('.back a[href="/"], .wrap a[href="/"]');
    if (back && !home) setNotice(back, show);
  }

  function btVoteEnabledForBanner(b) {
    if (!b) return false;
    if (b.vote_enabled === false) return false;
    const gid = String(b.gasha_id || '');
    return gid && gid !== '0' && !BT_VOTE_DISABLED_GASHA_IDS.has(gid);
  }

  function btVoteEnabledBanners() {
    return (state.btBanners || []).filter(btVoteEnabledForBanner);
  }

  function btVoteNoticeBannerIdsKey() {
    return btVoteEnabledBanners()
      .map((b) => String(b.gasha_id || ''))
      .filter(Boolean)
      .sort()
      .join(',');
  }

  function btVoteNoticeClearDismissIfBannersChanged() {
    const ids = btVoteNoticeBannerIdsKey();
    if (!ids) return;
    let prev = '';
    try {
      prev = localStorage.getItem('ggen_bt_vote_notice_off') || '';
    } catch (_) {}
    try {
      const prevIds = localStorage.getItem('ggen_bt_vote_notice_banner_ids') || '';
      if (prevIds && prevIds !== ids) {
        localStorage.removeItem('ggen_bt_vote_notice_off');
      }
      localStorage.setItem('ggen_bt_vote_notice_banner_ids', ids);
    } catch (_) {}
  }

  function btVoteNoticeDismissed() {
    try {
      return localStorage.getItem('ggen_bt_vote_notice_off') === '1';
    } catch (_) {
      return false;
    }
  }

  function btVoteMineList(gid) {
    return state.btVoteMine[gid] || [];
  }

  function btUserHasUnvotedPool() {
    return btVoteEnabledBanners().some((b) => {
      const gid = String(b.gasha_id || '');
      return gid && !btVoteMineList(gid).length;
    });
  }

  function btUserNeedsVoteNotice() {
    btVoteNoticeClearDismissIfBannersChanged();
    if (btVoteNoticeDismissed()) return false;
    if (!state.btVoteLoaded) return false;
    return btUserHasUnvotedPool();
  }

  function updateBtVoteNotices() {
    const show = btUserNeedsVoteNotice();
    setNotice(document.getElementById('navBannerTimelineTab'), show);
    document.querySelectorAll('.bt-vote-mode-btn').forEach((btn) => {
      const anchor = btn.closest('.ui-notice-anchor') || btn;
      setNotice(anchor, show && !(global.S && global.S.btVoteMode));
    });
    syncOverflowHints();
  }

  function refreshHomeAggregate() {
    const onGameNews = !!document.getElementById('gameNewsNavCurrent');
    const any =
      !!(state.gameNews && state.gameNews.has_new && !onGameNews) ||
      !!(state.latestRelease && state.latestRelease.has_new) ||
      !!(state.whatsNew && state.whatsNew.has_new) ||
      btUserNeedsVoteNotice();
    updateHomeAggregateNotice(any);
  }

  async function bootstrapGameNews() {
    ensureNoticeFlare(document.getElementById('navGameNewsTab'));
    const lang = normalizeGameNewsLangKey(currentLang());
    const seen = readSeen(GAME_NEWS_SEEN_KEY, lang);
    try {
      const r = await fetch(
        '/api/game_news/status?lang=' +
          encodeURIComponent(lang) +
          '&last_seen_at=' +
          encodeURIComponent(String(seen.at || 0)) +
          '&last_seen_fp=' +
          encodeURIComponent(seen.fp || ''),
        { credentials: 'same-origin', cache: 'no-store' }
      );
      if (!r.ok) {
        updateGameNewsNotice(false);
        return;
      }
      const d = await r.json();
      state.gameNews = d;
      updateGameNewsNotice(!!d.has_new);
      refreshHomeAggregate();
    } catch (_) {
      updateGameNewsNotice(false);
    }
  }

  async function bootstrapLatestRelease() {
    ensureNoticeFlare(document.getElementById('navLatestTab'));
    const seen = readGlobalSeen(LATEST_RELEASE_SEEN_KEY);
    try {
      const r = await fetch(
        '/api/latest_release/status?last_seen_at=' +
          encodeURIComponent(String(seen.at || 0)) +
          '&last_seen_fp=' +
          encodeURIComponent(seen.fp || ''),
        { credentials: 'same-origin', cache: 'no-store' }
      );
      if (!r.ok) {
        updateLatestReleaseNotice(false);
        return;
      }
      const d = await r.json();
      state.latestRelease = d;
      updateLatestReleaseNotice(!!d.has_new);
      refreshHomeAggregate();
    } catch (_) {
      updateLatestReleaseNotice(false);
    }
  }

  async function bootstrapWhatsNew() {
    document.querySelectorAll('.btn-whats-new').forEach(ensureNoticeFlare);
    const seen = readGlobalSeen(WHATS_NEW_SEEN_KEY);
    try {
      const r = await fetch(
        '/api/whats_new/status?last_seen_fp=' + encodeURIComponent(seen.fp || ''),
        { credentials: 'same-origin', cache: 'no-store' }
      );
      if (!r.ok) {
        updateWhatsNewNotice(false);
        return;
      }
      const d = await r.json();
      state.whatsNew = d;
      updateWhatsNewNotice(!!d.has_new);
      refreshHomeAggregate();
    } catch (_) {
      updateWhatsNewNotice(false);
    }
  }

  async function bootstrapBtVotes(lang) {
    ensureNoticeFlare(document.getElementById('navBannerTimelineTab'));
    const lc = lang || currentLang();
    try {
      const reqs = [fetch('/api/banner_timeline/votes', { credentials: 'same-origin', cache: 'no-store' })];
      if (!state.btBanners) {
        reqs.push(
          fetch('/api/banner_timeline?lang=' + encodeURIComponent(lc), {
            credentials: 'same-origin',
            cache: 'no-store',
          })
        );
      }
      const rs = await Promise.all(reqs);
      if (rs[0] && rs[0].ok) {
        const d = await rs[0].json();
        state.btVoteTotals = d.totals || {};
        state.btVoteMine = d.mine || {};
      }
      if (!state.btBanners && rs[1] && rs[1].ok) {
        state.btBanners = (await rs[1].json()).banners || [];
      }
      state.btVoteLoaded = true;
    } catch (_) {}
    updateBtVoteNotices();
    refreshHomeAggregate();
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
      writeSeen(GAME_NEWS_SEEN_KEY, lc, {
        at: Number(d.latest_at) || 0,
        fp: String(d.content_fp || d.fingerprint || ''),
      });
      state.gameNews = d;
      updateGameNewsNotice(false);
      refreshHomeAggregate();
    } catch (_) {}
  }

  async function markLatestReleaseSeen() {
    try {
      const r = await fetch('/api/latest_release/status', { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      writeGlobalSeen(LATEST_RELEASE_SEEN_KEY, {
        at: Number(d.latest_at) || 0,
        fp: String(d.content_fp || ''),
      });
      state.latestRelease = d;
      updateLatestReleaseNotice(false);
      refreshHomeAggregate();
    } catch (_) {}
  }

  async function markWhatsNewSeen() {
    try {
      const r = await fetch('/api/whats_new/status', { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      writeGlobalSeen(WHATS_NEW_SEEN_KEY, {
        at: Date.now(),
        fp: String(d.content_fp || ''),
      });
      state.whatsNew = d;
      updateWhatsNewNotice(false);
      refreshHomeAggregate();
    } catch (_) {}
  }

  function initRefreshListeners() {
    if (state.refreshInit) return;
    state.refreshInit = true;
    window.addEventListener('pageshow', (ev) => {
      if (ev.persisted) void bootstrapAll();
    });
    window.addEventListener('storage', (ev) => {
      if (
        ev.key === GAME_NEWS_SEEN_KEY ||
        ev.key === WHATS_NEW_SEEN_KEY ||
        ev.key === LATEST_RELEASE_SEEN_KEY ||
        ev.key === 'ggen_bt_vote_notice_off'
      ) {
        void bootstrapAll();
      }
    });
  }

  async function bootstrapAll(opts) {
    if (opts && opts.lang) state.lang = opts.lang;
    else if (!state.lang || state.lang === 'EN') {
      const saved = readPersistedLang();
      if (saved) state.lang = saved;
    }
    initRefreshListeners();
    await Promise.all([
      bootstrapGameNews(),
      bootstrapLatestRelease(),
      bootstrapWhatsNew(),
      bootstrapBtVotes(state.lang),
    ]);
  }

  const api = {
    bootstrapAll,
    bootstrapGameNews,
    bootstrapLatestRelease,
    bootstrapWhatsNew,
    bootstrapBtVotes,
    markGameNewsSeenForLang,
    markLatestReleaseSeen,
    markWhatsNewSeen,
    updateBtVoteNotices,
    uiNoticeFlareHtml,
    ensureNoticeFlare,
    setNotice,
    normalizeGameNewsLangKey,
    readGameNewsSeen: (lang) => readSeen(GAME_NEWS_SEEN_KEY, lang),
    writeGameNewsSeen: (lang, patch) => writeSeen(GAME_NEWS_SEEN_KEY, lang, patch),
    GAME_NEWS_SEEN_KEY,
    WHATS_NEW_SEEN_KEY,
    LATEST_RELEASE_SEEN_KEY,
    setLang(lang) {
      state.lang = lang;
    },
    setBtState(patch) {
      if (!patch) return;
      if (patch.banners) state.btBanners = patch.banners;
      if (patch.mine) state.btVoteMine = patch.mine;
      if (patch.totals) state.btVoteTotals = patch.totals;
      if (patch.loaded) state.btVoteLoaded = true;
    },
  };

  global.GgenContentNotices = api;

  // Re-export for game_news_notify.js compatibility
  global.GAME_NEWS_SEEN_KEY = GAME_NEWS_SEEN_KEY;
  global.normalizeGameNewsLangKey = normalizeGameNewsLangKey;
  global.readGameNewsSeenState = (lang) => readSeen(GAME_NEWS_SEEN_KEY, lang);
  global.writeGameNewsSeenState = (lang, patch) => writeSeen(GAME_NEWS_SEEN_KEY, lang, patch);
  global.markGameNewsSeenForLang = markGameNewsSeenForLang;

  if (document.documentElement.dataset.ggenContentNotices !== 'manual') {
    document.addEventListener('DOMContentLoaded', () => {
      void bootstrapAll();
    });
  }
})(window);
