/**
 * Ko-fi supporter wall — Character / Unit / Supporter tabs, above About in the footer.
 * Does not patch switchTab (keeps browse/nav behavior untouched).
 * Top 3 (by total) show Haro Gold / Silver / Bronze + matching avatar frames.
 */
(function (global) {
  'use strict';

  var WALL_TABS = { characters: 1, units: 1, supporters: 1 };
  var FALLBACK = '/static/images/UI/UI_Home_Menu_Icon_Shop.webp';
  var TITLE_FB = 'Thank you to {n} Newtypes keeping this database alive.';
  var JOIN_FB = 'Join the wall';
  var ARIA_FB = 'Supporters';
  var RANK_LABEL_FB = {
    1: '1st place',
    2: '2nd place',
    3: '3rd place',
  };
  var RANK_HARO = {
    1: '/static/images/UI/UI_Common_Icon_Haro_Gold.webp',
    2: '/static/images/UI/UI_Common_Icon_Haro_Silver.webp',
    3: '/static/images/UI/UI_Common_Icon_Haro_Bronze.webp',
  };
  var RANK_MOD = { 1: 'gold', 2: 'silver', 3: 'bronze' };
  var root = null;
  var loaded = false;
  var loading = null;
  var data = null;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  function wallT(key, fallback) {
    try {
      if (typeof global.t === 'function') {
        var v = global.t(key);
        if (v && v !== key) return v;
      }
    } catch (_) {}
    return fallback;
  }

  function thumbUrl(path) {
    var p = path || FALLBACK;
    try {
      if (typeof global.imgUrlPreferCdn === 'function' && p.indexOf('/static/images/') === 0) {
        var u = global.imgUrlPreferCdn(p);
        if (u) return u;
      }
      if (typeof global.imgUrl === 'function' && p.indexOf('/static/images/') === 0) {
        var u2 = global.imgUrl(p);
        if (u2) return u2;
      }
      if (/^https?:\/\//i.test(p)) return p;
    } catch (_) {}
    return p;
  }

  function supporterRank(s) {
    var r = Number(s && s.rank);
    if (r === 1 || r === 2 || r === 3) return r;
    // Legacy published JSON used crown:true for #1 only.
    if (s && s.crown) return 1;
    return 0;
  }

  function rankLabel(rank) {
    var key = rank === 1 ? 'kofi_wall_rank1' : rank === 2 ? 'kofi_wall_rank2' : 'kofi_wall_rank3';
    return wallT(key, RANK_LABEL_FB[rank] || '');
  }

  function currentTab() {
    try {
      if (global.S && global.S.currentTab) return global.S.currentTab;
    } catch (_) {}
    var active = document.querySelector('.nav-tab.active');
    return (active && active.dataset && active.dataset.tab) || 'characters';
  }

  function setVisible(show) {
    if (!root) root = $('kofiSupporterWall');
    if (!root) return;
    if (show) {
      root.hidden = false;
      root.removeAttribute('hidden');
      root.setAttribute('aria-hidden', 'false');
    } else {
      root.hidden = true;
      root.setAttribute('hidden', '');
      root.setAttribute('aria-hidden', 'true');
    }
  }

  function syncVisibility(tab) {
    var t = tab || currentTab();
    var show = !!WALL_TABS[t];
    setVisible(show);
    if (show) ensure();
  }

  function render(payload) {
    if (!root) root = $('kofiSupporterWall');
    if (!root || !payload) return;
    var n = payload.count != null ? payload.count : (payload.supporters || []).length;
    var titleTpl = wallT('kofi_wall_title', TITLE_FB);
    var title = String(titleTpl).replace(/\{n\}/g, String(n));
    var joinLabel = wallT('kofi_wall_join', JOIN_FB);
    var ariaLabel = wallT('kofi_wall_aria', ARIA_FB);
    var joinHref = String(
      payload.join_url || global.__GGEN_KOFI_PAGE_URL__ || 'https://ko-fi.com/E1E21WL8RV'
    ).trim();
    var fallbackSrc = escAttr(thumbUrl(FALLBACK));

    var cards = (payload.supporters || [])
      .map(function (s) {
        var name = s.name || 'Supporter';
        var src = thumbUrl(s.thumb || FALLBACK);
        var isFallback = !s.thumb || String(s.thumb).indexOf('UI_Home_Menu_Icon_Shop') >= 0;
        var rank = supporterRank(s);
        var mod = RANK_MOD[rank] || '';
        var haroPath = RANK_HARO[rank];
        var label = rank ? rankLabel(rank) : '';
        // Same slot as the old crown emoji (above avatar, ~1rem).
        var badge = '';
        if (haroPath) {
          var haroSrc = escAttr(thumbUrl(haroPath));
          var haroLocal = escAttr(haroPath);
          badge =
            '<span class="kofi-supporter-crown kofi-supporter-crown--' +
            mod +
            '" title="' +
            escAttr(label) +
            '" aria-label="' +
            escAttr(label) +
            '">' +
            '<img class="kofi-supporter-crown-img" src="' +
            haroSrc +
            '" alt="" width="16" height="16" loading="lazy" decoding="async" onerror="if(this.dataset.ggHaroFb!==\'1\'){this.dataset.ggHaroFb=\'1\';this.src=\'' +
            haroLocal +
            '\';}else{this.parentElement.style.display=\'none\'}">' +
            '</span>';
        }
        return (
          '<li class="kofi-supporter-card' +
          (mod ? ' kofi-supporter-card--' + mod : '') +
          '">' +
          '<div class="kofi-supporter-avatar-wrap">' +
          badge +
          '<img class="kofi-supporter-avatar' +
          (isFallback ? ' kofi-supporter-avatar--fallback' : '') +
          '" src="' +
          escAttr(src) +
          '" alt="" width="52" height="52" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' +
          fallbackSrc +
          '\';this.classList.add(\'kofi-supporter-avatar--fallback\')">' +
          '</div>' +
          '<div class="kofi-supporter-name" title="' +
          escAttr(name) +
          '">' +
          esc(name) +
          '</div>' +
          '</li>'
        );
      })
      .join('');

    root.innerHTML =
      '<div class="kofi-supporter-wall-inner">' +
      '<div class="kofi-supporter-wall-head">' +
      '<h2 class="kofi-supporter-wall-title">' +
      esc(title) +
      '</h2>' +
      '<a class="kofi-supporter-wall-join" href="' +
      escAttr(joinHref) +
      '" target="_blank" rel="noopener noreferrer">' +
      esc(joinLabel) +
      ' &rarr;</a>' +
      '</div>' +
      '<ul class="kofi-supporter-wall-grid" aria-label="' +
      escAttr(ariaLabel) +
      '">' +
      cards +
      '</ul>' +
      '</div>';
  }

  function fetchWall() {
    if (loaded && data) return Promise.resolve(data);
    if (loading) return loading;
    var bust = '';
    try {
      bust = encodeURIComponent(String(global.__GGEN_APP_VERSION__ || Date.now()));
    } catch (_) {
      bust = String(Date.now());
    }
    loading = fetch('/api/kofi/supporter-wall?v=' + bust, {
      credentials: 'same-origin',
      cache: 'no-cache',
    })
      .then(function (r) {
        if (!r.ok) throw new Error('wall ' + r.status);
        return r.json();
      })
      .then(function (json) {
        data = json || {};
        loaded = true;
        render(data);
        syncVisibility();
        return data;
      })
      .catch(function () {
        loading = null;
        setVisible(false);
        return null;
      });
    return loading;
  }

  function ensure() {
    return fetchWall();
  }

  function onLangChange() {
    if (loaded && data) render(data);
  }

  function onNavClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var tabEl = t.closest('.nav-tab');
    if (!tabEl || !tabEl.dataset) return;
    // switchTab runs on click; sync on next frame after S.currentTab updates
    setTimeout(function () {
      syncVisibility(tabEl.dataset.tab || currentTab());
    }, 0);
  }

  function init() {
    try {
      root = $('kofiSupporterWall');
      if (!root) return;
      document.addEventListener('click', onNavClick, true);
      syncVisibility(currentTab());
    } catch (_) {
      try {
        setVisible(false);
      } catch (__) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.GgenKofiSupporterWall = {
    ensure: ensure,
    syncVisibility: syncVisibility,
    onLangChange: onLangChange,
  };
})(typeof window !== 'undefined' ? window : this);
