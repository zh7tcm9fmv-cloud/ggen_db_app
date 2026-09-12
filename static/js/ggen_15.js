/**
 * 1.5 Anniversary Special Design — site-wide toggle + chrome.
 * Soft toggle (no full reload). Does not touch browse list paint path.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ggen_design_15';
  var LEGACY_KEYS = ['ggen_units_mock15', 'ggen_collections_mock15'];
  var TEKO_LINK_ID = 'ggen15Fonts';

  function preferDesignOn() {
    try {
      var params = new URLSearchParams(location.search || '');
      var q = params.get('design') || params.get('mock');
      if (q === '15') return true;
      if (q === 'classic') return false;
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === '0' || stored === '1') return stored === '1';
      for (var i = 0; i < LEGACY_KEYS.length; i++) {
        var legacy = localStorage.getItem(LEGACY_KEYS[i]);
        if (legacy === '0') return false;
        if (legacy === '1') return true;
      }
      return true;
    } catch (_) {
      return true;
    }
  }

  function designOn() {
    return !!window.__GGEN_DESIGN_15__;
  }

  function setDesignPreference(on) {
    window.__GGEN_DESIGN_15__ = !!on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch (_) {}
    try {
      var url = new URL(location.href);
      url.searchParams.delete('mock');
      url.searchParams.set('design', on ? '15' : 'classic');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    } catch (_) {}
    applyChrome();
  }

  function ensureTekoLink(enable) {
    var link = document.getElementById(TEKO_LINK_ID);
    if (!enable) {
      if (link) {
        link.disabled = true;
        link.media = 'print';
      }
      return;
    }
    if (!link) {
      link = document.createElement('link');
      link.id = TEKO_LINK_ID;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&display=swap';
      link.media = 'print';
      link.onload = function () {
        this.media = 'all';
      };
      document.head.appendChild(link);
    }
    link.disabled = false;
    link.media = 'all';
  }

  function langCode() {
    try {
      var L = (
        localStorage.getItem('ggen_lang') ||
        document.documentElement.getAttribute('data-ui-lang') ||
        'EN'
      ).toUpperCase();
      if (L === 'JP') L = 'JA';
      if (L !== 'EN' && L !== 'JA' && L !== 'TW' && L !== 'HK') L = 'EN';
      return L;
    } catch (_) {
      return 'EN';
    }
  }

  function syncSpecialIcon() {
    var img = document.getElementById('ggen15OnImg');
    var btn = document.getElementById('ggen15On');
    var L = langCode();
    var src = '/static/images/UI/collections_15_special_design_' + L + '.webp';
    var label =
      L === 'JA' ? '特設デザイン' : L === 'TW' || L === 'HK' ? '特設設計' : 'Special Design';
    if (img) {
      img.src = src;
      img.alt = label;
    }
    if (btn) btn.setAttribute('aria-label', label);
  }

  function applyChrome() {
    var on = designOn();
    document.documentElement.classList.toggle('ggen-15', on);
    document.documentElement.classList.toggle('ggen-classic', !on);
    document.body.classList.toggle('collections-15', on);
    document.body.classList.toggle('collections-classic', !on);
    ensureTekoLink(on);
    var onBtn = document.getElementById('ggen15On');
    var offBtn = document.getElementById('ggen15Off');
    if (onBtn) onBtn.classList.toggle('is-active', on);
    if (offBtn) offBtn.classList.toggle('is-active', !on);
    syncSpecialIcon();
    try {
      if (typeof window.syncNavTabsOverflowHints === 'function') {
        requestAnimationFrame(function () {
          window.syncNavTabsOverflowHints();
        });
      }
    } catch (_) {}
  }

  function bindNavHorizontalScroll() {
    var nav = document.getElementById('navTabs');
    if (!nav || nav.dataset.g15Wheel === '1') return;
    nav.dataset.g15Wheel = '1';
    nav.addEventListener(
      'wheel',
      function (ev) {
        if (!designOn()) return;
        var dx = ev.deltaX;
        var dy = ev.deltaY;
        if (Math.abs(dx) < Math.abs(dy)) dx = dy;
        if (!dx) return;
        var max = nav.scrollWidth - nav.clientWidth;
        if (max <= 2) return;
        var next = Math.max(0, Math.min(max, nav.scrollLeft + dx));
        if (next === nav.scrollLeft) return;
        nav.scrollLeft = next;
        ev.preventDefault();
      },
      { passive: false }
    );
  }

  function bind() {
    var onBtn = document.getElementById('ggen15On');
    var offBtn = document.getElementById('ggen15Off');
    if (onBtn) {
      onBtn.addEventListener('click', function () {
        if (!designOn()) setDesignPreference(true);
      });
    }
    if (offBtn) {
      offBtn.addEventListener('click', function () {
        if (designOn()) setDesignPreference(false);
      });
    }
    bindNavHorizontalScroll();
    document.addEventListener(
      'click',
      function (ev) {
        var t = ev.target;
        if (!t || !t.closest) return;
        if (t.closest('.nav-tab[data-tab]')) setTimeout(applyChrome, 0);
      },
      true
    );
    window.addEventListener('popstate', function () {
      setTimeout(applyChrome, 0);
    });
    var nav = document.getElementById('navTabs');
    if (nav && typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(function () {
        applyChrome();
      });
      mo.observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }
  }

  window.__GGEN_DESIGN_15__ = preferDesignOn();
  /* Compat aliases for collections.js during transition */
  window.__GGEN_BROWSE_MOCK15__ = window.__GGEN_DESIGN_15__;
  window.__GGEN_COLLECTIONS_MOCK15__ = window.__GGEN_DESIGN_15__;

  function boot() {
    bind();
    applyChrome();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
