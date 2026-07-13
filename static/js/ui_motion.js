/* Rubber-band overshoot for site range inputs (design-only). */
(function () {
  'use strict';

  var RUBBER = 0.32;
  var reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function setOx(input, px) {
    input.style.setProperty('--ui-range-ox', (px || 0) + 'px');
  }

  function enhance(input) {
    if (!input || input.nodeName !== 'INPUT' || input.type !== 'range') return;
    if (input.dataset.uiRubber === '1') return;
    input.dataset.uiRubber = '1';
    input.classList.add('ui-range');
    if (reduced || input.disabled) return;

    var dragging = false;
    var pointerId = null;

    function overshootFromEvent(e) {
      var rect = input.getBoundingClientRect();
      var w = Math.max(1, rect.width);
      var raw = (e.clientX - rect.left) / w;
      var clamped = clamp01(raw);
      var rubber = clamped + (raw - clamped) * RUBBER;
      return (rubber - clamped) * w;
    }

    function onPointerDown(e) {
      if (input.disabled) return;
      dragging = true;
      pointerId = e.pointerId;
      input.classList.remove('ui-range-snap');
      setOx(input, overshootFromEvent(e));
      try {
        input.setPointerCapture(e.pointerId);
      } catch (err) {}
    }

    function onPointerMove(e) {
      if (!dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      setOx(input, overshootFromEvent(e));
    }

    function onPointerUp(e) {
      if (!dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      input.classList.add('ui-range-snap');
      setOx(input, 0);
      window.setTimeout(function () {
        input.classList.remove('ui-range-snap');
      }, 520);
    }

    input.addEventListener('pointerdown', onPointerDown);
    input.addEventListener('pointermove', onPointerMove);
    input.addEventListener('pointerup', onPointerUp);
    input.addEventListener('pointercancel', onPointerUp);
    input.addEventListener('lostpointercapture', onPointerUp);
  }

  function scan(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.nodeName === 'INPUT' && scope.type === 'range') {
      enhance(scope);
      return;
    }
    var list = scope.querySelectorAll('input[type="range"]');
    for (var i = 0; i < list.length; i++) enhance(list[i]);
  }

  function boot() {
    scan(document);
    if (typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var n = m.addedNodes[j];
            if (n.nodeType !== 1) continue;
            if (n.matches && n.matches('input[type="range"]')) enhance(n);
            else if (n.querySelectorAll) scan(n);
          }
        } else if (m.type === 'attributes' && m.target) {
          if (m.target.matches && m.target.matches('input[type="range"]')) enhance(m.target);
        }
      }
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['type']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.GgenUiMotion = { enhanceRange: enhance, scan: scan };
})();
