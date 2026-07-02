/** Shared unread-content notices (Game News, Latest Release, What's New, banner votes). */
(function (global) {
  const GAME_NEWS_SEEN_KEY = 'ggen_game_news_seen';
  const WHATS_NEW_SEEN_KEY = 'ggen_whats_new_seen';
  const LATEST_RELEASE_SEEN_KEY = 'ggen_latest_release_seen';
  const KOFI_NOTICE_SEEN_KEY = 'ggen_kofi_notice_seen';
  const PAGE_VISITS_KEY = 'ggen_page_visits';
  /** Nav tabs that show a notice until the user opens the page once. Bump version to re-notify everyone. */
  const PAGE_VISIT_NOTICES = [{ pageId: 'master_league', tabId: 'navMasterLeagueTab', version: '1' }];
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
    kofiNotice: null,
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
    el.classList.remove('has-ui-notice--page-visit');
  }

  function setPageVisitNotice(el, show) {
    if (!el) return;
    ensureNoticeFlare(el);
    el.classList.toggle('has-ui-notice', !!show);
    el.classList.toggle('has-ui-notice--page-visit', !!show);
  }

  function readPageVisits() {
    try {
      const row = JSON.parse(localStorage.getItem(PAGE_VISITS_KEY) || '{}');
      return row && typeof row === 'object' ? row : {};
    } catch (_) {
      return {};
    }
  }

  function writePageVisit(pageId, version) {
    try {
      const visits = readPageVisits();
      visits[pageId] = String(version || '1');
      localStorage.setItem(PAGE_VISITS_KEY, JSON.stringify(visits));
    } catch (_) {}
  }

  function pageVisitEntry(pageId) {
    return PAGE_VISIT_NOTICES.find((p) => p.pageId === pageId) || null;
  }

  function pageNeedsVisitNotice(entry) {
    if (!entry) return false;
    return String(readPageVisits()[entry.pageId] || '') !== String(entry.version || '1');
  }

  function bootstrapPageVisitNotices() {
    PAGE_VISIT_NOTICES.forEach((entry) => {
      const tab = document.getElementById(entry.tabId);
      if (!tab) return;
      setPageVisitNotice(tab, pageNeedsVisitNotice(entry));
    });
    syncOverflowHints();
  }

  function markPageVisitSeen(pageId) {
    const entry = pageVisitEntry(pageId);
    if (!entry) return;
    writePageVisit(entry.pageId, entry.version);
    setPageVisitNotice(document.getElementById(entry.tabId), false);
    syncOverflowHints();
    refreshHomeAggregate();
  }

  function hasUnreadPageVisitNotices() {
    return PAGE_VISIT_NOTICES.some(pageNeedsVisitNotice);
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

  function readKofiNoticeSeenVersion() {
    const row = readGlobalSeen(KOFI_NOTICE_SEEN_KEY);
    const v = Number(row.fp);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  }

  function updateKofiNotice(show) {
    const link = document.getElementById('kofiHeaderLink');
    if (!link) return;
    link.classList.add('ui-notice-anchor');
    setNotice(link, show);
  }

  function isKofiNoticeEnabled() {
    return !!(state.kofiNotice && state.kofiNotice.notice_enabled);
  }

  function notifyKofiPromoNoticeLine() {
    try {
      if (global.KofiDonatePromo && typeof global.KofiDonatePromo.refreshNoticeLine === 'function') {
        global.KofiDonatePromo.refreshNoticeLine();
      }
    } catch (_) {}
  }

  async function bootstrapKofiNotice() {
    const link = document.getElementById('kofiHeaderLink');
    ensureNoticeFlare(link);
    if (link && !link.dataset.kofiNoticeBound) {
      link.dataset.kofiNoticeBound = '1';
      link.addEventListener('click', () => markKofiNoticeSeen());
    }
    const seenVersion = readKofiNoticeSeenVersion();
    try {
      const r = await fetch(
        '/api/kofi/status?last_seen_version=' + encodeURIComponent(String(seenVersion)),
        { credentials: 'same-origin', cache: 'no-store' }
      );
      if (!r.ok) {
        updateKofiNotice(false);
        return;
      }
      const d = await r.json();
      state.kofiNotice = d;
      updateKofiNotice(!!d.has_new);
      notifyKofiPromoNoticeLine();
    } catch (_) {
      updateKofiNotice(false);
    }
  }

  function markKofiNoticeSeen() {
    const version =
      state.kofiNotice && state.kofiNotice.notice_version != null
        ? Math.max(0, Number(state.kofiNotice.notice_version) || 0)
        : readKofiNoticeSeenVersion();
    writeGlobalSeen(KOFI_NOTICE_SEEN_KEY, { fp: String(version), at: Date.now() });
    if (state.kofiNotice) {
      state.kofiNotice = Object.assign({}, state.kofiNotice, { has_new: false });
    }
    updateKofiNotice(false);
  }

  /** @deprecated use markKofiNoticeSeen */
  function markKofiPostSeen() {
    markKofiNoticeSeen();
  }

  /** @deprecated use bootstrapKofiNotice */
  async function bootstrapKofiPost() {
    return bootstrapKofiNotice();
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

  function isGameNewsPage() {
    return !!document.getElementById('gameNewsNavCurrent');
  }

  function updateHomeAggregateNotice(show) {
    const home = document.getElementById('gameNewsNavHome');
    if (home) setNotice(home, show);
    const back = document.querySelector('.back a[href="/"], .wrap a[href="/"]');
    if (back && !home) setNotice(back, show);
  }

  /** Back/home link badge only when main-app nav would also show something unread. */
  function mainAppHasUnreadNotices() {
    return (
      !!(state.gameNews && state.gameNews.has_new) ||
      !!(state.latestRelease && state.latestRelease.has_new) ||
      !!(state.whatsNew && state.whatsNew.has_new) ||
      btUserNeedsVoteNotice() ||
      hasUnreadPageVisitNotices()
    );
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
    if (isGameNewsPage()) {
      updateHomeAggregateNotice(false);
      return;
    }
    updateHomeAggregateNotice(mainAppHasUnreadNotices());
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
      if (isGameNewsPage()) d.has_new = false;
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
      state.gameNews = Object.assign({}, d, { has_new: false });
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
        ev.key === KOFI_NOTICE_SEEN_KEY ||
        ev.key === PAGE_VISITS_KEY ||
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
    if (isGameNewsPage()) {
      await markGameNewsSeenForLang(normalizeGameNewsLangKey(currentLang()));
    }
    await Promise.all([
      bootstrapGameNews(),
      bootstrapLatestRelease(),
      bootstrapWhatsNew(),
      bootstrapBtVotes(state.lang),
      bootstrapKofiNotice(),
    ]);
    bootstrapPageVisitNotices();
    refreshHomeAggregate();
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
    markKofiNoticeSeen,
    markKofiPostSeen,
    bootstrapKofiNotice,
    bootstrapKofiPost,
    isKofiNoticeEnabled,
    markPageVisitSeen,
    bootstrapPageVisitNotices,
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
    KOFI_NOTICE_SEEN_KEY,
    KOFI_POST_SEEN_KEY: KOFI_NOTICE_SEEN_KEY,
    PAGE_VISITS_KEY,
    PAGE_VISIT_NOTICES,
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
