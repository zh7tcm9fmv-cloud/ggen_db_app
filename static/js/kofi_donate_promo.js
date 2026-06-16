/**
 * Ko-fi donate promo — Maria mascot + speech bubble pointing at #kofiHeaderLink.
 * Preview: KOFI_PROMO_DELAY_MS = 0, KOFI_PROMO_PREVIEW = true (shows every visit).
 * Production: set DELAY_MS = 120000, PREVIEW = false.
 */
(function (global) {
  'use strict';

  var KOFI_PROMO_DELAY_MS = 0;
  var KOFI_PROMO_PREVIEW = true;
  var KOFI_PROMO_STORAGE_KEY = 'ggen_kofi_donate_promo_v1';
  var MARIA_IMG = '/static/images/UI/UI_TacticalTraining_Logo_maria.webp';
  var KOFI_URL = 'https://ko-fi.com/E1E21WL8RV';
  var KOFI_IC = 'https://storage.ko-fi.com/cdn/cup-border.png';

  var _shown = false;
  var _resizeTimer = null;

  function promoImgUrl(path) {
    if (typeof global.imgUrl === 'function') return global.imgUrl(path);
    var p = String(path || '');
    if (!p.startsWith('/static/images/')) return p;
    var cdn = global.__GGEN_IMAGE_CDN__;
    if (cdn) {
      return cdn + p.replace(/^\/static\/images/, '/images').replace(/\.(png|jpe?g)$/i, '.webp');
    }
    return p;
  }

  function promoT(key, fallback) {
    try {
      if (typeof global.t === 'function') {
        var v = global.t(key);
        if (v && v !== key) return v;
      }
    } catch (_) {}
    return fallback;
  }

  function isDismissed() {
    if (KOFI_PROMO_PREVIEW) return false;
    try {
      if (global.sessionStorage.getItem(KOFI_PROMO_STORAGE_KEY) === '1') return true;
      if (localStorage.getItem(KOFI_PROMO_STORAGE_KEY) === '1') return true;
    } catch (_) {}
    return false;
  }

  function markDismissed() {
    if (KOFI_PROMO_PREVIEW) return;
    try {
      sessionStorage.setItem(KOFI_PROMO_STORAGE_KEY, '1');
      localStorage.setItem(KOFI_PROMO_STORAGE_KEY, '1');
    } catch (_) {}
  }

  function forceShowFromQuery() {
    try {
      return new URLSearchParams(global.location.search).get('kofi_promo') === '1';
    } catch (_) {
      return false;
    }
  }

  function getEls() {
    return {
      root: document.getElementById('kofiDonatePromo'),
      panel: document.querySelector('#kofiDonatePromo .kofi-donate-promo-panel'),
      connector: document.getElementById('kofiDonatePromoConnector'),
      line: document.getElementById('kofiDonatePromoLine'),
      dot: document.getElementById('kofiDonatePromoDot'),
      target: document.getElementById('kofiHeaderLink'),
    };
  }

  function positionPromo() {
    var els = getEls();
    if (!els.root || !els.panel || !els.target || !els.root.classList.contains('is-visible')) return;

    var tr = els.target.getBoundingClientRect();
    if (!tr.width || !tr.height) return;

    var panelW = els.panel.offsetWidth || 320;
    var panelH = els.panel.offsetHeight || 120;
    var gap = 10;
    var left = tr.left + tr.width * 0.5 - panelW * 0.72;
    var top = tr.bottom + gap + 12;

    left = Math.max(12, Math.min(left, global.innerWidth - panelW - 12));
    if (top + panelH > global.innerHeight - 12) {
      top = Math.max(tr.top - panelH - gap - 8, 72);
    }

    els.root.style.left = Math.round(left) + 'px';
    els.root.style.top = Math.round(top) + 'px';

    var pr = els.panel.getBoundingClientRect();
    var x1 = pr.right - 36;
    var y1 = pr.top + 6;
    var x2 = tr.left + tr.width * 0.5;
    var y2 = tr.top + tr.height * 0.5;

    if (els.line) {
      els.line.setAttribute('x1', String(x1));
      els.line.setAttribute('y1', String(y1));
      els.line.setAttribute('x2', String(x2));
      els.line.setAttribute('y2', String(y2));
    }
    if (els.dot) {
      els.dot.setAttribute('cx', String(x2));
      els.dot.setAttribute('cy', String(y2));
    }
  }

  function setTargetHighlight(on) {
    var target = document.getElementById('kofiHeaderLink');
    if (target) target.classList.toggle('kofi-donate-promo-target-highlight', !!on);
  }

  function closeKofiDonatePromo(persist) {
    var els = getEls();
    if (!els.root || !els.root.classList.contains('is-visible')) return;
    els.root.classList.remove('is-visible');
    els.root.setAttribute('aria-hidden', 'true');
    if (els.connector) els.connector.hidden = true;
    setTargetHighlight(false);
    if (persist !== false) markDismissed();
  }

  function openKofiDonatePromo() {
    var els = getEls();
    if (!els.root || !els.panel || !els.target || _shown) return;
    if (!forceShowFromQuery() && isDismissed()) return;

    var maria = els.root.querySelector('.kofi-donate-promo-maria');
    if (maria && !maria.getAttribute('src')) maria.src = promoImgUrl(MARIA_IMG);

    _shown = true;
    els.root.hidden = false;
    els.root.classList.add('is-visible');
    els.root.setAttribute('aria-hidden', 'false');
    if (els.connector) els.connector.hidden = false;
    setTargetHighlight(true);
    requestAnimationFrame(function () {
      positionPromo();
      requestAnimationFrame(positionPromo);
    });
  }

  function scheduleShow() {
    if (!document.getElementById('kofiDonatePromo') || !document.getElementById('kofiHeaderLink')) return;
    if (!forceShowFromQuery() && isDismissed()) return;
    global.setTimeout(openKofiDonatePromo, Math.max(0, KOFI_PROMO_DELAY_MS));
  }

  function bindEvents() {
    var root = document.getElementById('kofiDonatePromo');
    if (!root) return;

    var closeBtn = root.querySelector('.kofi-donate-promo-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        closeKofiDonatePromo(true);
      });
    }

    global.addEventListener('resize', function () {
      clearTimeout(_resizeTimer);
      _resizeTimer = global.setTimeout(positionPromo, 80);
    });
    global.addEventListener('scroll', function () {
      if (!root.classList.contains('is-visible')) return;
      requestAnimationFrame(positionPromo);
    }, { passive: true });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') closeKofiDonatePromo(true);
    });
  }

  function syncPromoI18n() {
    var text = document.getElementById('kofiDonatePromoText');
    var cta = document.getElementById('kofiDonatePromoCta');
    var closeBtn = document.querySelector('#kofiDonatePromo .kofi-donate-promo-close');
    if (text) {
      text.textContent = promoT(
        'kofi_donate_promo_text',
        'Thank you for visiting! If you\u2019ve found our website useful, please consider donating to help us keep it free and accessible.'
      );
    }
    if (cta) {
      var lbl = promoT('support_kofi_btn', 'Support on Ko-fi');
      cta.setAttribute('aria-label', lbl);
      var span = cta.querySelector('.kofi-donate-promo-cta-label');
      if (span) span.textContent = lbl;
    }
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', promoT('whats_new_close', 'Close'));
    }
  }

  function init() {
    bindEvents();
    syncPromoI18n();
    scheduleShow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.closeKofiDonatePromo = closeKofiDonatePromo;
  global.openKofiDonatePromo = openKofiDonatePromo;
  global.KofiDonatePromo = {
    close: closeKofiDonatePromo,
    open: openKofiDonatePromo,
    reposition: positionPromo,
    syncI18n: syncPromoI18n,
  };
})(typeof window !== 'undefined' ? window : globalThis);
