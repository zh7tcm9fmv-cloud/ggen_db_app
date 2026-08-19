/**
 * Ko-fi donate promo — speech bubble near #kofiHeaderLink with a random portrait.
 * Portrait: 90% sd_story_event_shop_gm (SD event); 10% random from images/Popup + original Maria.
 * Shows 2 minutes after page load. Snoozed for 24h after close (X), swipe up (touch), or Ko-fi header click
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
  var PROMO_FAVORED_IMG = '/static/images/Popup/sd_story_event_shop_gm.webp';
  /** Keep in sync with image_index.json → "images/Popup". */
  var PROMO_POPUP_FILES = [
    'sd_story_event_shop_gm.webp',
    'win_g0010c00403_01.webp',
    'win_g0010c00403_02.webp',
    'win_g0010c01700_01.webp',
    'win_g0010c01700_03.webp',
    'win_g0010c01901_03.webp',
    'win_g0310c01500_01.webp',
    'win_g0550c00400_01.webp',
    'win_g0800c01800_02.webp',
    'win_g0950c00700_02.webp',
    'win_g0950c04000_02.webp',
    'win_g1250c00301_03.webp',
    'win_g1250n00011_02.webp',
    'win_g1440c00500_03.webp',
    'win_g1440n00400_01.webp',
    'win_g1440n00400_02.webp',
    'win_g1440n00400_03.webp',
    'win_g2000c00100_03.webp',
    'win_g2000c00700_01.webp',
    'win_g2100n00400_01.webp',
    'win_g3000c00802_01.webp',
    'win_g3000c01901_05.webp',
    'win_g3050c01400_01.webp',
    'win_g3060c00100_01.webp',
    'win_g3060c00100_03.webp',
    'win_g3700c01001_03.webp',
    'win_g3700c01200_01.webp',
    'win_g3700c01200_02.webp',
    'win_g3700c01300_02.webp',
    'win_g3700n00015_01.webp',
    'win_g5010c03000_03.webp',
    'win_g7050c00900_01.webp',
    'win_g8500c01501_01.webp',
    'win_g8500n00100_02.webp',
  ];
  var PROMO_TEXT_FALLBACK =
    'Thank you for visiting! \uD83D\uDC99\nIf you enjoy our site, please support us on Ko-fi to help keep it free. In return, you\u2019ll receive exclusive sneak peeks and bonus content.';
  var PROMO_NOTICE_LINE_FALLBACK =
    'I have added a red notification dot that will appear when new exclusive content is available.';

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

  function pickPromoPortraitPath() {
    // 90% SD event shop art; 10% uniform from Popup pool + original Maria.
    if (Math.random() < 0.9) return PROMO_FAVORED_IMG;
    var pool = PROMO_POPUP_FILES.map(function (name) {
      return '/static/images/Popup/' + name;
    });
    pool.push(MARIA_IMG);
    return pool[Math.floor(Math.random() * pool.length)] || PROMO_FAVORED_IMG;
  }

  function applyPromoPortrait() {
    var img = document.querySelector('#kofiDonatePromo .kofi-donate-promo-maria');
    if (!img) return;
    var path = pickPromoPortraitPath();
    var src = promoImgUrl(path);
    if (!src) return;
    img.src = src;
    img.onerror = function () {
      if (typeof global.gameImageUrlFallback === 'function') {
        global.gameImageUrlFallback(img);
        return;
      }
      img.onerror = null;
      var fb = promoImgUrl(MARIA_IMG);
      if (fb) img.src = fb;
    };
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

  function getPromoNoticeLine() {
    return promoT('kofi_promo_notice_line', PROMO_NOTICE_LINE_FALLBACK);
  }

  function isKofiNoticeEnabled() {
    try {
      if (global.GgenContentNotices && typeof global.GgenContentNotices.isKofiNoticeEnabled === 'function') {
        return global.GgenContentNotices.isKofiNoticeEnabled();
      }
    } catch (_) {}
    return false;
  }

  async function ensureKofiNoticeStatus() {
    try {
      if (global.GgenContentNotices && typeof global.GgenContentNotices.bootstrapKofiNotice === 'function') {
        await global.GgenContentNotices.bootstrapKofiNotice();
      }
    } catch (_) {}
  }

  function getPromoLines() {
    var lines = splitPromoLines(getPromoText());
    if (isKofiNoticeEnabled()) {
      var noticeLine = String(getPromoNoticeLine() || '').trim();
      if (noticeLine) lines.push(noticeLine);
    }
    return lines;
  }

  function getPromoAriaLabel(lines) {
    return (lines || getPromoLines()).join(' ');
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

  function appendSlotLine(parent, lineHtmlOrText, delay, asHtml, extraClass) {
    var lineEl = document.createElement('span');
    lineEl.className = 'kofi-promo-slot-line' + (extraClass ? ' ' + extraClass : '');
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

    var lines = getPromoLines();
    textEl.textContent = '';
    textEl.setAttribute('aria-label', getPromoAriaLabel(lines));
    if (root) {
      root.classList.toggle('has-notice-line', lines.length > 2);
    }

    lines.forEach(function (line, i) {
      var delay = 0.58 + i * 0.26;
      var extraClass = i >= 2 ? 'kofi-promo-slot-line--notice' : '';
      if (isPerksLine(line)) {
        appendSlotLine(textEl, wrapPerkKeywords(line), delay, true, extraClass);
      } else {
        appendSlotLine(textEl, line, delay, false, extraClass);
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

    applyPromoPortrait();

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

  async function openKofiDonatePromoAsync() {
    await ensureKofiNoticeStatus();
    openKofiDonatePromo();
  }

  function scheduleShow() {
    if (!document.getElementById('kofiDonatePromo') || !document.getElementById('kofiHeaderLink')) return;
    if (isSnoozed()) return;

    cancelShowTimer();
    var delay = forceShowFromQuery() ? 0 : KOFI_PROMO_DELAY_MS;
    _showTimer = global.setTimeout(function () {
      void openKofiDonatePromoAsync();
    }, delay);
  }

  function bindSwipeUpDismiss(panel) {
    if (!panel) return;
    var minDy = 52;
    var startY = 0;
    var startX = 0;
    var tracking = false;
    var dragging = false;
    var pointerId = null;

    function resetSwipeVisual() {
      dragging = false;
      panel.classList.remove('is-swipe-dismissing');
      panel.style.transform = '';
      panel.style.opacity = '';
    }

    panel.addEventListener('pointerdown', function (ev) {
      if (ev.pointerType !== 'touch') return;
      tracking = true;
      dragging = false;
      pointerId = ev.pointerId;
      startY = ev.clientY;
      startX = ev.clientX;
    }, { passive: true });

    panel.addEventListener('pointermove', function (ev) {
      if (!tracking || ev.pointerId !== pointerId || ev.pointerType !== 'touch') return;
      var dy = startY - ev.clientY;
      var dx = Math.abs(ev.clientX - startX);
      if (dy < 6 && dx < 6) return;
      if (dy > 10 && dy > dx * 1.15) {
        dragging = true;
        panel.classList.add('is-swipe-dismissing');
        var offset = Math.min(dy, 140);
        panel.style.transform = 'translateY(' + (-offset) + 'px)';
        panel.style.opacity = String(Math.max(0.25, 1 - offset / 180));
      } else if (dx > dy && dx > 12) {
        tracking = false;
        resetSwipeVisual();
      }
    }, { passive: true });

    function finishSwipe(ev) {
      if (!tracking || ev.pointerId !== pointerId) return;
      tracking = false;
      var dy = startY - ev.clientY;
      var dx = Math.abs(ev.clientX - startX);
      if (dragging && dy >= minDy && dy > dx) {
        resetSwipeVisual();
        closeKofiDonatePromo(true);
        return;
      }
      resetSwipeVisual();
    }

    panel.addEventListener('pointerup', finishSwipe, { passive: true });
    panel.addEventListener('pointercancel', finishSwipe, { passive: true });
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
      bindSwipeUpDismiss(panel);
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
    void ensureKofiNoticeStatus().then(function () {
      renderSlotText(false);
      if (document.getElementById('kofiDonatePromo') && document.getElementById('kofiDonatePromo').classList.contains('is-visible')) {
        startSlotTextAnimation();
        requestAnimationFrame(positionPromo);
      }
    });
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
  global.openKofiDonatePromo = openKofiDonatePromoAsync;
  global.KofiDonatePromo = {
    close: closeKofiDonatePromo,
    open: openKofiDonatePromoAsync,
    reposition: positionPromo,
    syncI18n: syncPromoI18n,
    refreshNoticeLine: function () {
      renderSlotText(false);
      if (document.getElementById('kofiDonatePromo') && document.getElementById('kofiDonatePromo').classList.contains('is-visible')) {
        startSlotTextAnimation();
        requestAnimationFrame(positionPromo);
      }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
