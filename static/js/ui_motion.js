/* Rubber-band overshoot for site range inputs + pill toggles (design-only). */
(function () {
  'use strict';

  var RUBBER = 0.32;
  var SNAP_MS = 520;
  var reduced = false;
  try {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {}

  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function setOx(el, px) {
    el.style.setProperty('--ui-toggle-ox', (px || 0) + 'px');
  }

  function clearOx(el) {
    setOx(el, 0);
  }

  function enhanceRange(input) {
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

    function setRangeOx(px) {
      input.style.setProperty('--ui-range-ox', (px || 0) + 'px');
    }

    function onPointerDown(e) {
      if (input.disabled) return;
      dragging = true;
      pointerId = e.pointerId;
      input.classList.remove('ui-range-snap');
      setRangeOx(overshootFromEvent(e));
      try {
        input.setPointerCapture(e.pointerId);
      } catch (err) {}
    }

    function onPointerMove(e) {
      if (!dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      setRangeOx(overshootFromEvent(e));
    }

    function onPointerUp(e) {
      if (!dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      input.classList.add('ui-range-snap');
      setRangeOx(0);
      window.setTimeout(function () {
        input.classList.remove('ui-range-snap');
      }, SNAP_MS);
    }

    input.addEventListener('pointerdown', onPointerDown);
    input.addEventListener('pointermove', onPointerMove);
    input.addEventListener('pointerup', onPointerUp);
    input.addEventListener('pointercancel', onPointerUp);
    input.addEventListener('lostpointercapture', onPointerUp);
  }

  function enhancePillSlider(slider) {
    if (!slider || !slider.classList || !slider.classList.contains('stage-map-reinf-slider')) return;
    if (slider.dataset.uiToggleRubber === '1') return;
    slider.dataset.uiToggleRubber = '1';
    if (reduced) return;

    var label = slider.closest('label');
    var input = label && label.querySelector('.stage-map-reinf-toggle-input');
    if (!input) return;

    var TRAVEL = 20;
    var dragging = false;
    var pointerId = null;
    var startChecked = false;
    var moved = false;
    var startX = 0;

    function syncBase() {
      slider.style.setProperty('--ui-toggle-base', (input.checked ? TRAVEL : 0) + 'px');
    }

    function pctFromEvent(e) {
      var rect = slider.getBoundingClientRect();
      var w = Math.max(1, rect.width);
      var raw = (e.clientX - rect.left) / w;
      var clamped = clamp01(raw);
      var rubber = clamped + (raw - clamped) * RUBBER;
      return rubber;
    }

    function oxFromEvent(e) {
      var rubber = pctFromEvent(e);
      var basePct = startChecked ? 1 : 0;
      return (rubber - basePct) * TRAVEL;
    }

    function onPointerDown(e) {
      if (input.disabled) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      pointerId = e.pointerId;
      startChecked = !!input.checked;
      syncBase();
      slider.classList.remove('ui-toggle-snap');
      setOx(slider, 0);
      try {
        slider.setPointerCapture(e.pointerId);
      } catch (err) {}
    }

    function onPointerMove(e) {
      if (!dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      if (Math.abs(e.clientX - startX) > 3) {
        moved = true;
        e.preventDefault();
      }
      if (moved) setOx(slider, oxFromEvent(e));
    }

    function finishDrag(e) {
      if (!dragging) return;
      if (pointerId != null && e && e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      if (moved) {
        if (e) e.preventDefault();
        var pct = pctFromEvent(e);
        var next = pct >= 0.5;
        if (input.checked !== next) {
          input.checked = next;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      syncBase();
      slider.classList.add('ui-toggle-snap');
      clearOx(slider);
      window.setTimeout(function () {
        slider.classList.remove('ui-toggle-snap');
      }, SNAP_MS);
    }

    input.addEventListener('change', function () {
      if (!dragging) syncBase();
      clearOx(slider);
    });
    syncBase();

    slider.addEventListener('pointerdown', onPointerDown);
    slider.addEventListener('pointermove', onPointerMove);
    slider.addEventListener('pointerup', finishDrag);
    slider.addEventListener('pointercancel', finishDrag);
    slider.addEventListener('lostpointercapture', finishDrag);
  }

  function enhanceToggleSwitch(sw) {
    if (!sw || !sw.classList || !sw.classList.contains('toggle-switch')) return;
    if (sw.dataset.uiToggleRubber === '1') return;
    sw.dataset.uiToggleRubber = '1';
    if (reduced) return;

    var clicker = sw.closest('.toggle-clickable');
    if (!clicker) return;

    var leftOff = 2;
    var leftOn = sw.classList.contains('toggle-switch') && sw.closest('.dc-dc-cond-toggle') ? 18 : 22;
    var TRAVEL = leftOn - leftOff;
    var dragging = false;
    var pointerId = null;
    var startActive = false;
    var moved = false;
    var startX = 0;
    var suppressClick = false;

    function syncBase() {
      sw.style.setProperty('--ui-toggle-thumb-left', (clicker.classList.contains('active') ? leftOn : leftOff) + 'px');
    }

    function pctFromEvent(e) {
      var rect = sw.getBoundingClientRect();
      var w = Math.max(1, rect.width);
      var raw = (e.clientX - rect.left) / w;
      var clamped = clamp01(raw);
      return clamped + (raw - clamped) * RUBBER;
    }

    function oxFromEvent(e) {
      var rubber = pctFromEvent(e);
      var basePct = startActive ? 1 : 0;
      return (rubber - basePct) * TRAVEL;
    }

    clicker.addEventListener('click', function (e) {
      if (suppressClick) {
        e.preventDefault();
        e.stopImmediatePropagation();
        suppressClick = false;
      }
    }, true);

    function onPointerDown(e) {
      dragging = true;
      moved = false;
      startX = e.clientX;
      pointerId = e.pointerId;
      startActive = clicker.classList.contains('active');
      syncBase();
      sw.classList.remove('ui-toggle-snap');
      setOx(sw, 0);
      try {
        clicker.setPointerCapture(e.pointerId);
      } catch (err) {}
    }

    function onPointerMove(e) {
      if (!dragging) return;
      if (pointerId != null && e.pointerId !== pointerId) return;
      if (Math.abs(e.clientX - startX) > 3) {
        moved = true;
        e.preventDefault();
      }
      if (moved) setOx(sw, oxFromEvent(e));
    }

    function finishDrag(e) {
      if (!dragging) return;
      if (pointerId != null && e && e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      if (moved) {
        if (e) e.preventDefault();
        var pct = pctFromEvent(e);
        var wantActive = pct >= 0.5;
        if (clicker.classList.contains('active') !== wantActive) {
          suppressClick = true;
          clicker.click();
        }
      }
      syncBase();
      sw.classList.add('ui-toggle-snap');
      clearOx(sw);
      window.setTimeout(function () {
        sw.classList.remove('ui-toggle-snap');
      }, SNAP_MS);
    }

    var mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(function () {
      if (!dragging) syncBase();
    }) : null;
    if (mo) mo.observe(clicker, { attributes: true, attributeFilter: ['class'] });
    syncBase();

    clicker.addEventListener('pointerdown', onPointerDown);
    clicker.addEventListener('pointermove', onPointerMove);
    clicker.addEventListener('pointerup', finishDrag);
    clicker.addEventListener('pointercancel', finishDrag);
    clicker.addEventListener('lostpointercapture', finishDrag);
  }

  function scan(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.nodeName === 'INPUT' && scope.type === 'range') {
      enhanceRange(scope);
      return;
    }
    var ranges = scope.querySelectorAll ? scope.querySelectorAll('input[type="range"]') : [];
    for (var i = 0; i < ranges.length; i++) enhanceRange(ranges[i]);
    var pills = scope.querySelectorAll ? scope.querySelectorAll('.stage-map-reinf-slider') : [];
    for (var j = 0; j < pills.length; j++) enhancePillSlider(pills[j]);
    var toggles = scope.querySelectorAll ? scope.querySelectorAll('.toggle-switch') : [];
    for (var k = 0; k < toggles.length; k++) enhanceToggleSwitch(toggles[k]);
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
            if (n.matches && (n.matches('input[type="range"]') || n.matches('.stage-map-reinf-slider') || n.matches('.toggle-switch'))) {
              if (n.matches('input[type="range"]')) enhanceRange(n);
              else if (n.matches('.stage-map-reinf-slider')) enhancePillSlider(n);
              else enhanceToggleSwitch(n);
            } else if (n.querySelectorAll) scan(n);
          }
        } else if (m.type === 'attributes' && m.target) {
          if (m.target.matches && m.target.matches('input[type="range"]')) enhanceRange(m.target);
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

  window.GgenUiMotion = { enhanceRange: enhanceRange, enhancePillSlider: enhancePillSlider, enhanceToggleSwitch: enhanceToggleSwitch, scan: scan };
})();
