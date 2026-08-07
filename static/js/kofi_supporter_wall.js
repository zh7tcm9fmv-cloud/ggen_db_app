/**
 * Ko-fi supporter wall — Character / Unit / Supporter tabs, above About footer.
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
    if (typeof global.imgUrlPreferCdn === 'function' && /\/static\/images\/UI\//.test(p)) {
      return global.imgUrlPreferCdn(p);
    }
    if (typeof global.imgUrl === 'function' && p.indexOf('/static/images/') === 0) {
      // Custom KofiSupporters stay on site /static; UI fallback may use CDN helper above.
      if (p.indexOf('/static/images/KofiSupporters/') === 0) return p;
      return global.imgUrl(p);
    }
    return p;
  }

  function currentTab() {
    if (global.S && S.currentTab) return S.currentTab;
    var active = document.querySelector('.nav-tab.active');
    return (active && active.dataset && active.dataset.tab) || 'characters';
  }

  function setVisible(show) {
    if (!root) root = $('kofiSupporterWall');
    if (!root) return;
    if (show) {
      root.hidden = false;
      root.setAttribute('aria-hidden', 'false');
    } else {
      root.hidden = true;
      root.setAttribute('aria-hidden', 'true');
    }
  }

  function syncVisibility(tab) {
    var t = tab || currentTab();
    setVisible(!!WALL_TABS[t]);
  }

  function render(payload) {
    if (!root) root = $('kofiSupporterWall');
    if (!root || !payload) return;
    var n = payload.count != null ? payload.count : (payload.supporters || []).length;
    var titleTpl = payload.title || 'Thank you to {n} folks keeping this open.';
    var title = String(titleTpl).replace(/\{n\}/g, String(n));
    var joinLabel = payload.join_label || 'Join the wall';
    var joinHref =
      (payload.join_url ||
        (global.__GGEN_KOFI_PAGE_URL__ || '') ||
        'https://ko-fi.com/E1E21WL8RV').trim();

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
            ? '<span class="kofi-supporter-crown" title="Top supporter" aria-hidden="true">👑</span>'
            : '') +
          '<img class="kofi-supporter-avatar' +
          (isFallback ? ' kofi-supporter-avatar--fallback' : '') +
          '" src="' +
          escAttr(src) +
          '" alt="" width="52" height="52" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' +
          escAttr(thumbUrl(FALLBACK)) +
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
      ' →</a>' +
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

  function patchSwitchTab() {
    var orig = global.switchTab;
    if (typeof orig !== 'function' || orig.__kofiWallPatched) return;
    function wrapped(tab, opts) {
      var ret = orig.apply(this, arguments);
      try {
        if (WALL_TABS[tab]) ensure().then(function () { syncVisibility(tab); });
        else syncVisibility(tab);
      } catch (_) {}
      return ret;
    }
    wrapped.__kofiWallPatched = true;
    global.switchTab = wrapped;
  }

  function init() {
    root = $('kofiSupporterWall');
    if (!root) return;
    patchSwitchTab();
    if (WALL_TABS[currentTab()]) ensure();
    else syncVisibility(currentTab());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.GgenKofiSupporterWall = { ensure: ensure, syncVisibility: syncVisibility };
})(typeof window !== 'undefined' ? window : this);
