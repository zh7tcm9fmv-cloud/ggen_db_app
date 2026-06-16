/**
 * Ko-fi donate promo — Maria mascot + speech bubble pointing at #kofiHeaderLink.
 * Production: 2 min on site; defers while a detail modal is open.
 */
(function (global) {
  'use strict';

  var KOFI_PROMO_DELAY_MS = 120000;
  var KOFI_PROMO_PREVIEW = false;
  var KOFI_PROMO_DEFER_AFTER_DETAIL_MS = 500;
  var KOFI_PROMO_STORAGE_KEY = 'ggen_kofi_donate_promo_v1';
  var MARIA_IMG = '/static/images/UI/UI_TacticalTraining_Logo_maria.webp';
  var PROMO_TEXT_FALLBACK =
    'Thank you for visiting! If you\u2019ve found our website useful, please consider donating to help us keep it free and accessible.';

  var _shown = false;
  var _promoDue = false;
  var _resizeTimer = null;
  var _deferTimer = null;
  var _detailObs = null;

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

  function isDetailModalOpen() {
    var modal = document.getElementById('detailModal');
    return !!(modal && modal.classList.contains('active'));
  }

  function getPromoText() {
    return promoT('kofi_donate_promo_text', PROMO_TEXT_FALLBACK);
  }

  function splitPromoLines(text) {
    var t = String(text || '').trim();
    if (!t) return [''];
    var m = t.match(/^(.+?[.!?])\s+(.+)$/);
    if (m) return [m[1], m[2]];
    return [t];
  }

  function renderSlotText(restart) {
    var root = document.getElementById('kofiDonatePromo');
    var textEl = document.getElementById('kofiDonatePromoText');
    if (!textEl) return;

    var full = getPromoText();
    textEl.textContent = '';
    textEl.setAttribute('aria-label', full);

    splitPromoLines(full).forEach(function (line, i) {
      var lineEl = document.createElement('span');
      lineEl.className = 'kofi-promo-slot-line';
      lineEl.style.setProperty('--kofi-slot-delay', (0.38 + i * 0.16) + 's');
      var inner = document.createElement('span');
      inner.className = 'kofi-promo-slot-inner';
      inner.textContent = line;
      lineEl.appendChild(inner);
      textEl.appendChild(lineEl);
    });

    if (root) {
      root.classList.remove('is-text-ready');
      if (restart !== false) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (root.classList.contains('is-visible')) root.classList.add('is-text-ready');
          });
        });
      }
    }
  }

  function canShowPromoNow() {
    if (_shown) return false;
    if (!forceShowFromQuery() && isDismissed()) return false;
    if (!document.getElementById('kofiDonatePromo')) return false;
    if (!document.getElementById('kofiHeaderLink')) return false;
    if (isDetailModalOpen()) return false;
    return _promoDue || forceShowFromQuery();
  }

  function tryShowPromo() {
    if (!canShowPromoNow()) {
      if (isDetailModalOpen() && (_promoDue || forceShowFromQuery())) _promoDue = true;
      return;
    }
    openKofiDonatePromo();
  }

  function onPromoTimerFire() {
    if (_shown || isDismissed()) return;
    _promoDue = true;
    tryShowPromo();
  }

  function onDetailModalClosed() {
    if (!_promoDue || _shown || isDismissed()) return;
    clearTimeout(_deferTimer);
    _deferTimer = global.setTimeout(tryShowPromo, KOFI_PROMO_DEFER_AFTER_DETAIL_MS);
  }

  function getEls() {
    return {
      root: document.getElementById('kofiDonatePromo'),
      panel: document.querySelector('#kofiDonatePromo .kofi-donate-promo-panel'),
      target: document.getElementById('kofiHeaderLink'),
    };
  }

  function positionPromo() {
    var els = getEls();
    if (!els.root || !els.panel || !els.target || !els.root.classList.contains('is-visible')) return;

    var tr = els.target.getBoundingClientRect();
    if (!tr.width || !tr.height) return;

    var panelW = els.panel.offsetWidth || 360;
    var panelH = els.panel.offsetHeight || 140;
    var gap = 10;
    var left = tr.left + tr.width * 0.5 - panelW * 0.72;
    var top = tr.bottom + gap + 12;

    left = Math.max(12, Math.min(left, global.innerWidth - panelW - 12));
    if (top + panelH > global.innerHeight - 12) {
      top = Math.max(tr.top - panelH - gap - 8, 72);
    }

    els.root.style.left = Math.round(left) + 'px';
    els.root.style.top = Math.round(top) + 'px';

    var targetCx = tr.left + tr.width * 0.5;
    var targetCy = tr.top + tr.height * 0.5;
    var originX = ((targetCx - left) / panelW) * 100;
    var originY = ((targetCy - top) / panelH) * 100;
    originX = Math.max(8, Math.min(originX, 92));
    originY = Math.max(0, Math.min(originY, 35));
    els.panel.style.setProperty('--kofi-promo-origin-x', originX.toFixed(1) + '%');
    els.panel.style.setProperty('--kofi-promo-origin-y', originY.toFixed(1) + '%');
    setTargetHighlight(true);
  }

  function clearEnteringState() {
    var root = document.getElementById('kofiDonatePromo');
    if (root) root.classList.remove('is-entering');
  }

  function setTargetHighlight(on) {
    var target = document.getElementById('kofiHeaderLink');
    if (target) target.classList.toggle('kofi-donate-promo-target-highlight', !!on);
  }

  function closeKofiDonatePromo(persist) {
    var els = getEls();
    if (!els.root || !els.root.classList.contains('is-visible')) return;
    els.root.classList.remove('is-visible', 'is-entering', 'is-text-ready');
    els.root.setAttribute('aria-hidden', 'true');
    setTargetHighlight(false);
    if (persist !== false) markDismissed();
  }

  function openKofiDonatePromo() {
    var els = getEls();
    if (!els.root || !els.panel || !els.target || _shown) return;
    if (!forceShowFromQuery() && isDismissed()) return;
    if (isDetailModalOpen()) {
      _promoDue = true;
      return;
    }

    var maria = els.root.querySelector('.kofi-donate-promo-maria');
    if (maria && !maria.getAttribute('src')) maria.src = promoImgUrl(MARIA_IMG);

    renderSlotText(true);

    _shown = true;
    els.root.hidden = false;
    els.root.classList.add('is-visible', 'is-entering');
    els.root.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function () {
      positionPromo();
      requestAnimationFrame(positionPromo);
    });
    global.setTimeout(clearEnteringState, 650);
  }

  function scheduleShow() {
    if (!document.getElementById('kofiDonatePromo') || !document.getElementById('kofiHeaderLink')) return;
    if (!forceShowFromQuery() && isDismissed()) return;
    if (forceShowFromQuery()) {
      _promoDue = true;
      global.setTimeout(tryShowPromo, 0);
      return;
    }
    global.setTimeout(onPromoTimerFire, Math.max(0, KOFI_PROMO_DELAY_MS));
  }

  function watchDetailModal() {
    var modal = document.getElementById('detailModal');
    if (!modal || _detailObs) return;
    _detailObs = new MutationObserver(function () {
      if (isDetailModalOpen()) return;
      onDetailModalClosed();
    });
    _detailObs.observe(modal, { attributes: true, attributeFilter: ['class'] });
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

    var panel = root.querySelector('.kofi-donate-promo-panel');
    if (panel) {
      panel.addEventListener('animationend', function (ev) {
        if (ev.animationName === 'kofi-promo-panel-enter') clearEnteringState();
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
      if (ev.key === 'Escape' && root.classList.contains('is-visible')) closeKofiDonatePromo(true);
    });

    watchDetailModal();
  }

  function syncPromoI18n() {
    var closeBtn = document.querySelector('#kofiDonatePromo .kofi-donate-promo-close');
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', promoT('whats_new_close', 'Close'));
    }
    renderSlotText(!!(document.getElementById('kofiDonatePromo') && document.getElementById('kofiDonatePromo').classList.contains('is-visible')));
  }

  function init() {
    bindEvents();
    renderSlotText(false);
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
