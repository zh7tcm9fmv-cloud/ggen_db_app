/**
 * Ko-fi donate promo — Maria + speech bubble near #kofiHeaderLink.
 * Shows 2 minutes after page load. Snoozed for 24h after close (X) or Ko-fi header click
 * on the same page visit — a full reload clears the snooze.
 */
(function (global) {
  'use strict';

  var KOFI_PROMO_DELAY_MS = 120000;
  var KOFI_PROMO_SNOOZE_MS = 24 * 60 * 60 * 1000;
  var LEGACY_KEYS = [
    'ggen_kofi_donate_promo_v1',
    'ggen_kofi_donate_promo_v2',
    'ggen_kofi_donate_promo_v3',
    'ggen_kofi_promo_engaged_ms_v2',
    'ggen_kofi_promo_snooze_until',
  ];
  var MARIA_IMG = '/static/images/UI/UI_TacticalTraining_Logo_maria.webp';
  var PROMO_TEXT_FALLBACK =
    'Thanks for stopping by! \uD83D\uDC99\nIf you enjoy our site, support us on Ko-fi to help keep it free \u2014 and get exclusive sneak peeks + bonus content in return!';

  var PERK_PHRASE_KEYS = [
    { key: 'kofi_promo_kw_sneak', fb: 'exclusive sneak peeks' },
    { key: 'kofi_promo_kw_bonus', fb: 'bonus content' },
  ];

  function getPerkPhrases() {
    return PERK_PHRASE_KEYS.map(function (item) {
      return promoT(item.key, item.fb);
    }).filter(function (p) {
      return p && String(p).trim();
    });
  }

  function escRegex(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  var _shown = false;
  var _snoozedUntil = 0;
  var _showTimer = null;
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

  function clearLegacyStorage() {
    try {
      LEGACY_KEYS.forEach(function (key) {
        global.localStorage.removeItem(key);
        global.sessionStorage.removeItem(key);
      });
    } catch (_) {}
  }

  function forceShowFromQuery() {
    try {
      return new URLSearchParams(global.location.search).get('kofi_promo') === '1';
    } catch (_) {
      return false;
    }
  }

  function isSnoozed() {
    if (forceShowFromQuery()) return false;
    return _snoozedUntil > global.Date.now();
  }

  function snoozePromo() {
    _snoozedUntil = global.Date.now() + KOFI_PROMO_SNOOZE_MS;
    cancelShowTimer();
  }

  function cancelShowTimer() {
    if (_showTimer) {
      global.clearTimeout(_showTimer);
      _showTimer = null;
    }
  }

  function getPromoText() {
    return promoT('kofi_donate_promo_text', PROMO_TEXT_FALLBACK);
  }

  function splitPromoLines(text) {
    var t = String(text || '').trim();
    if (!t) return [''];
    if (t.indexOf('\n') >= 0) {
      return t.split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
    }
    var m = t.match(/^(.+?[.!?！？。])\s*(.+)$/s);
    if (m) return [m[1], m[2]];
    return [t];
  }

  function isPerksLine(line) {
    var s = String(line || '').toLowerCase();
    return getPerkPhrases().some(function (p) {
      return s.indexOf(String(p).toLowerCase()) >= 0;
    });
  }

  function wrapPerkKeywords(text) {
    var s = String(text || '');
    if (!s) return '';
    var hits = [];
    getPerkPhrases().forEach(function (phrase) {
      var re = new RegExp(escRegex(phrase), 'gi');
      var m;
      while ((m = re.exec(s)) !== null) {
        hits.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
      }
    });
    if (!hits.length) return escHtml(s);
    hits.sort(function (a, b) { return a.start - b.start; });
    var merged = [];
    hits.forEach(function (h) {
      var last = merged[merged.length - 1];
      if (last && h.start < last.end) return;
      merged.push(h);
    });
    var out = '';
    var pos = 0;
    merged.forEach(function (h, i) {
      out += escHtml(s.slice(pos, h.start));
      out += '<span class="kofi-promo-kw">' + escHtml(h.text) + '</span>';
      pos = h.end;
    });
    out += escHtml(s.slice(pos));
    return out;
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function appendSlotLine(parent, lineHtmlOrText, delay, asHtml) {
    var lineEl = document.createElement('span');
    lineEl.className = 'kofi-promo-slot-line';
    lineEl.style.setProperty('--kofi-slot-delay', delay + 's');
    var inner = document.createElement('span');
    inner.className = 'kofi-promo-slot-inner';
    if (asHtml) inner.innerHTML = lineHtmlOrText;
    else inner.textContent = lineHtmlOrText;
    lineEl.appendChild(inner);
    parent.appendChild(lineEl);
  }

  function renderSlotText(restart) {
    var root = document.getElementById('kofiDonatePromo');
    var textEl = document.getElementById('kofiDonatePromoText');
    if (!textEl) return;

    var full = getPromoText();
    var lines = splitPromoLines(full);
    textEl.textContent = '';
    textEl.setAttribute('aria-label', full);

    lines.forEach(function (line, i) {
      var delay = 0.58 + i * 0.26;
      if (isPerksLine(line)) {
        appendSlotLine(textEl, wrapPerkKeywords(line), delay, true);
      } else {
        appendSlotLine(textEl, line, delay, false);
      }
    });

    if (root) {
      root.classList.remove('is-text-ready');
      if (restart !== false && root.classList.contains('is-visible')) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (root.classList.contains('is-visible')) root.classList.add('is-text-ready');
          });
        });
      }
    }
  }

  function startSlotTextAnimation() {
    var root = document.getElementById('kofiDonatePromo');
    if (!root || !root.classList.contains('is-visible')) return;
    root.classList.remove('is-text-ready', 'is-text-fallback');
    void root.offsetHeight;
    requestAnimationFrame(function () {
      if (!root.classList.contains('is-visible')) return;
      root.classList.add('is-text-ready');
      global.setTimeout(function () {
        if (root.classList.contains('is-visible')) root.classList.add('is-text-fallback');
      }, 1600);
    });
  }

  function isPanelEnterAnimation(name) {
    return name === 'kofi-promo-panel-enter' || name === 'kofi-promo-panel-enter-touch';
  }

  function onPanelAnimationEnd(ev) {
    var name = ev.animationName || ev.webkitAnimationName || '';
    if (isPanelEnterAnimation(name)) clearEnteringState();
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

    var bubble = els.root.querySelector('.kofi-donate-promo-bubble');
    if (!bubble) return;

    var gap = 10;
    var top = tr.bottom + gap + 8;
    var panelH = els.panel.offsetHeight || 140;
    if (top + panelH > global.innerHeight - 12) {
      top = Math.max(tr.top - panelH - gap - 8, 72);
    }

    els.root.style.left = '0px';
    els.root.style.top = Math.round(top) + 'px';

    var br = bubble.getBoundingClientRect();
    var adjust = tr.right - br.right;
    var left = (els.root.offsetLeft || 0) + adjust;
    var rootW = els.root.offsetWidth || els.panel.offsetWidth || 360;
    left = Math.max(12, Math.min(left, global.innerWidth - rootW - 12));
    els.root.style.left = Math.round(left) + 'px';

    br = bubble.getBoundingClientRect();
    adjust = tr.right - br.right;
    if (Math.abs(adjust) > 0.5) {
      left += adjust;
      left = Math.max(12, Math.min(left, global.innerWidth - rootW - 12));
      els.root.style.left = Math.round(left) + 'px';
    }

    var panelW = els.panel.offsetWidth || 360;
    var targetCx = tr.left + tr.width * 0.5;
    var targetCy = tr.top + tr.height * 0.5;
    var rootRect = els.root.getBoundingClientRect();
    var originX = ((targetCx - rootRect.left) / panelW) * 100;
    var originY = ((targetCy - rootRect.top) / panelH) * 100;
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

  function closeKofiDonatePromo(snooze) {
    var els = getEls();
    if (!els.root || !els.root.classList.contains('is-visible')) return;
    els.root.classList.remove('is-visible', 'is-entering', 'is-text-ready', 'is-text-fallback');
    els.root.setAttribute('aria-hidden', 'true');
    els.root.hidden = true;
    setTargetHighlight(false);
    var panel = els.root.querySelector('.kofi-donate-promo-panel');
    if (panel) panel.classList.remove('is-close-visible');
    if (snooze !== false) snoozePromo();
  }

  function openKofiDonatePromo() {
    if (_shown || isSnoozed()) return;

    var els = getEls();
    if (!els.root || !els.panel || !els.target) return;

    var maria = els.root.querySelector('.kofi-donate-promo-maria');
    if (maria && !maria.getAttribute('src')) maria.src = promoImgUrl(MARIA_IMG);

    renderSlotText(false);

    _shown = true;
    cancelShowTimer();
    els.root.hidden = false;
    els.root.classList.add('is-visible', 'is-entering');
    els.root.setAttribute('aria-hidden', 'false');
    startSlotTextAnimation();
    requestAnimationFrame(function () {
      positionPromo();
      requestAnimationFrame(positionPromo);
    });
    global.setTimeout(clearEnteringState, 1050);
    global.setTimeout(positionPromo, 1300);
  }

  function scheduleShow() {
    if (!document.getElementById('kofiDonatePromo') || !document.getElementById('kofiHeaderLink')) return;
    if (isSnoozed()) return;

    cancelShowTimer();
    var delay = forceShowFromQuery() ? 0 : KOFI_PROMO_DELAY_MS;
    _showTimer = global.setTimeout(openKofiDonatePromo, delay);
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
      panel.addEventListener('touchstart', function () {
        panel.classList.add('is-close-visible');
      }, { passive: true });
      panel.addEventListener('animationend', onPanelAnimationEnd);
      panel.addEventListener('webkitAnimationEnd', onPanelAnimationEnd);
    }

    var kofiLink = document.getElementById('kofiHeaderLink');
    if (kofiLink) {
      kofiLink.addEventListener('click', function () {
        if (global.GgenContentNotices && typeof global.GgenContentNotices.markKofiPostSeen === 'function') {
          global.GgenContentNotices.markKofiPostSeen();
        }
        snoozePromo();
        if (root.classList.contains('is-visible')) closeKofiDonatePromo(false);
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
  }

  function syncPromoI18n() {
    var closeBtn = document.querySelector('#kofiDonatePromo .kofi-donate-promo-close');
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', promoT('whats_new_close', 'Close'));
    }
    renderSlotText(false);
    if (document.getElementById('kofiDonatePromo') && document.getElementById('kofiDonatePromo').classList.contains('is-visible')) {
      startSlotTextAnimation();
      requestAnimationFrame(positionPromo);
    }
  }

  function init() {
    clearLegacyStorage();
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
