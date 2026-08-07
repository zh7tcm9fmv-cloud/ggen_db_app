/**
 * Ko-fi supporter wall — Character / Unit / Supporter tabs, above About in the footer.
 * Does not patch switchTab (keeps browse/nav behavior untouched).
 */
(function (global) {
  'use strict';

  var WALL_TABS = { characters: 1, units: 1, supporters: 1 };
  var FALLBACK = '/static/images/UI/UI_Home_Menu_Icon_Shop.webp';
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

  function thumbUrl(path) {
    var p = path || FALLBACK;
    try {
      if (p.indexOf('/static/images/KofiSupporters/') === 0) return p;
      if (typeof global.imgUrlPreferCdn === 'function' && /\/static\/images\/UI\//.test(p)) {
        return global.imgUrlPreferCdn(p);
      }
      if (typeof global.imgUrl === 'function' && p.indexOf('/static/images/') === 0) {
        return global.imgUrl(p);
      }
    } catch (_) {}
    return p;
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
    var titleTpl = payload.title || 'Thank you to {n} folks keeping this open.';
    var title = String(titleTpl).replace(/\{n\}/g, String(n));
    var joinLabel = payload.join_label || 'Join the wall';
    var joinHref = String(
      payload.join_url || global.__GGEN_KOFI_PAGE_URL__ || 'https://ko-fi.com/E1E21WL8RV'
    ).trim();
    var fallbackSrc = escAttr(thumbUrl(FALLBACK));

    var cards = (payload.supporters || [])
      .map(function (s) {
        var name = s.name || 'Supporter';
        var src = thumbUrl(s.thumb || FALLBACK);
        var isFallback = !s.thumb || String(s.thumb).indexOf('UI_Home_Menu_Icon_Shop') >= 0;
        var crown = !!s.crown;
        return (
          '<li class="kofi-supporter-card' +
          (crown ? ' kofi-supporter-card--crown' : '') +
          '">' +
          '<div class="kofi-supporter-avatar-wrap">' +
          (crown
            ? '<span class="kofi-supporter-crown" title="Top supporter" aria-label="Top supporter">&#x1F451;</span>'
            : '') +
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
      '<ul class="kofi-supporter-wall-grid" aria-label="Supporters">' +
      cards +
      '</ul>' +
      '</div>';
  }

  function fetchWall() {
    if (loaded && data) return Promise.resolve(data);
    if (loading) return loading;
    loading = fetch('/api/kofi/supporter-wall', { credentials: 'same-origin' })
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

  global.GgenKofiSupporterWall = { ensure: ensure, syncVisibility: syncVisibility };
})(typeof window !== 'undefined' ? window : this);
