(function () {
  var CELL_FALLBACK = 96;
  var LS_SERIES = 'ggen_develop_series_id';
  var LS_DIAGRAM = 'ggen_develop_diagram';
  var state = { series: [], map: null, diagram: 0, selected: null, detailUnitId: null, cell: CELL_FALLBACK };
  var seriesId = String(window.__DEV_SERIES__ || '4000');
  var boundDismiss = false;
  var hoverCapable = false;
  try {
    hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch (_) {}
  /* Hover popup: delay-clear so the pointer can move onto the card and scroll long capture lists. */
  var hoverClearTimer = null;
  var hoverDetailBound = false;
  /* Mobile / coarse pointer: pan · swipe · pinch the board at readable cell size. */
  var boardView = { x: 0, y: 0, scale: 1, key: '' };
  var panMetrics = { w: 0, h: 0 };
  var gestureBound = false;
  var gesture = null;
  /*
    Instant diagram switches: keep painted boards in-DOM (parked) so ogk/wires
    are not torn down on every tab click. Keyed by series + frame layout.
  */
  var boardPark = Object.create(null);
  var boardParkSeries = '';
  var boardParkLayout = '';
  var boardWarmTimer = 0;
  var mapCache = Object.create(null);
  var mapCacheOrder = [];
  var MAP_CACHE_MAX = 12;

  function isTouchBoard() {
    try {
      return window.matchMedia('(max-width: 820px), ((hover: none) and (pointer: coarse))').matches;
    } catch (_) {
      return false;
    }
  }

  function recallSeriesId() {
    try {
      var v = String(localStorage.getItem(LS_SERIES) || '').trim();
      return v || '';
    } catch (_) {
      return '';
    }
  }

  function recallDiagramIndex(forSeriesId) {
    try {
      if (String(localStorage.getItem(LS_SERIES) || '') !== String(forSeriesId || '')) return 0;
      var n = parseInt(localStorage.getItem(LS_DIAGRAM) || '0', 10);
      return isFinite(n) && n > 0 ? n : 0;
    } catch (_) {
      return 0;
    }
  }

  function persistDevelopView() {
    try {
      if (seriesId) localStorage.setItem(LS_SERIES, String(seriesId));
      localStorage.setItem(LS_DIAGRAM, String(state.diagram | 0));
    } catch (_) {}
  }

  function lang() {
    try {
      var l = String(localStorage.getItem('ggen_lang') || 'EN').toUpperCase();
      if (l === 'JP') l = 'JA';
      if (l === 'KR') l = 'HR';
      if (l === 'EN' || l === 'JA' || l === 'TW' || l === 'HK' || l === 'HR') return l;
    } catch (_) {}
    return 'EN';
  }

  function $(id) { return document.getElementById(id); }

  function api(path) {
    /* sv= busts stale public max-age=3600 develop JSON (e.g. series_name "320"). */
    var q = (path.indexOf('?') >= 0 ? '&' : '?')
      + 'lang=' + encodeURIComponent(lang())
      + '&sv=dev25';
    return fetch(path + q, {
      headers: { Accept: 'application/json' },
      /* Allow HTTP cache — server already sends ETag + max-age=3600. */
    }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
  }

  function mapCacheKey(sid) {
    return String(sid || '') + '|' + lang();
  }

  function rememberMap(sid, map) {
    var key = mapCacheKey(sid);
    if (!mapCache[key]) {
      mapCacheOrder.push(key);
      while (mapCacheOrder.length > MAP_CACHE_MAX) {
        var drop = mapCacheOrder.shift();
        if (drop) delete mapCache[drop];
      }
    }
    mapCache[key] = map;
  }

  function clearBoardPark() {
    if (boardWarmTimer) {
      try { clearTimeout(boardWarmTimer); } catch (_) {}
      boardWarmTimer = 0;
    }
    var scroll = $('devScroll');
    Object.keys(boardPark).forEach(function (k) {
      var entry = boardPark[k];
      var el = entry && entry.el;
      if (el && el.parentNode) {
        try { el.parentNode.removeChild(el); } catch (_) {}
      }
    });
    boardPark = Object.create(null);
    boardParkSeries = '';
    boardParkLayout = '';
    if (scroll && !$('devBoard')) {
      var fresh = document.createElement('div');
      fresh.className = 'dev-board';
      fresh.id = 'devBoard';
      scroll.appendChild(fresh);
    }
  }

  function demoteBoardEl(el) {
    if (!el) return;
    el.removeAttribute('id');
    el.classList.add('is-parked');
    el.setAttribute('aria-hidden', 'true');
    try { el.style.transform = ''; } catch (_) {}
  }

  function promoteBoardEntry(entry) {
    if (!entry || !entry.el) return null;
    var scroll = $('devScroll');
    var cur = $('devBoard');
    if (cur && cur !== entry.el) demoteBoardEl(cur);
    entry.el.id = 'devBoard';
    entry.el.classList.remove('is-parked');
    entry.el.removeAttribute('aria-hidden');
    if (scroll && entry.el.parentNode !== scroll) {
      scroll.appendChild(entry.el);
    }
    return entry.el;
  }

  function applyParkedBoardChrome(entry) {
    var main = document.querySelector('.dev-main');
    var scroll = $('devScroll');
    if (main && entry) {
      if (entry.cell) main.style.setProperty('--dev-cell', entry.cell + 'px');
      if (entry.koma) main.style.setProperty('--dev-koma', entry.koma + 'px');
      if (entry.baseFrac != null) main.style.setProperty('--dev-base', String(entry.baseFrac));
      main.classList.toggle('is-touch-board', !!entry.touchPan);
    }
    if (scroll && entry) {
      scroll.classList.remove('is-board-center');
      scroll.classList.toggle('is-board-center-y', !!entry.centerY);
      scroll.classList.toggle('is-ult-board', !!entry.isUlt);
      scroll.classList.toggle('is-panable', !!entry.touchPan);
      scroll.classList.remove('is-panning');
      try { scroll.scrollLeft = 0; } catch (_) {}
    }
    if (entry) {
      state.cell = entry.cell || state.cell;
      panMetrics = { w: entry.w || 0, h: entry.h || 0 };
    }
  }

  function scheduleWarmSiblingBoards() {
    if (boardWarmTimer) {
      try { clearTimeout(boardWarmTimer); } catch (_) {}
      boardWarmTimer = 0;
    }
    var diagrams = (state.map && state.map.diagrams) || [];
    if (diagrams.length <= 1) return;
    boardWarmTimer = setTimeout(function () {
      boardWarmTimer = 0;
      if (!isDevelopActive() || !state.map) return;
      var i;
      for (i = 0; i < diagrams.length; i++) {
        if (!boardPark[i]) {
          warmDiagramBoard(i);
          return;
        }
      }
    }, 140);
  }

  function warmDiagramBoard(di) {
    if (!isDevelopActive() || !state.map) return;
    if (boardPark[di]) {
      scheduleWarmSiblingBoards();
      return;
    }
    var saved = state.diagram;
    var savedSel = state.selected;
    state.diagram = di;
    state.selected = null;
    try {
      renderBoard({ parkOnly: true, skipWarm: true });
    } catch (_) {}
    state.diagram = saved;
    state.selected = savedSel;
    /* Restore the board the user is actually viewing. */
    if (boardPark[saved]) {
      promoteBoardEntry(boardPark[saved]);
      applyParkedBoardChrome(boardPark[saved]);
      finishParkedBoardInteraction(boardPark[saved]);
    }
    scheduleWarmSiblingBoards();
  }

  function finishParkedBoardInteraction(entry) {
    var board = entry && entry.el;
    var scroll = $('devScroll');
    if (!board || !scroll) return;
    clearDevelopScrollExperiments();
    if (entry.touchPan) {
      panMetrics = { w: entry.w || 0, h: entry.h || 0 };
      var viewKey = seriesId + ':' + state.diagram + ':' + (entry.w || 0) + 'x' + (entry.h || 0);
      if (boardView.key !== viewKey) {
        boardView.key = viewKey;
        resetBoardView(scroll, entry.w || 0, entry.h || 0);
      } else {
        clampBoardView(scroll.clientWidth || 0, scroll.clientHeight || 0, entry.w || 0, entry.h || 0);
      }
      applyBoardView(board);
      ensureBoardGestures(scroll);
    } else {
      board.style.transform = '';
      board.style.transformOrigin = '';
      boardView.key = '';
    }
  }

  function ui() {
    return (state.map && state.map.ui) || {};
  }

  function cssUrl(u) {
    if (!u) return 'none';
    var src = String(u);
    try {
      if (typeof window.imgUrlPreferCdn === 'function') src = window.imgUrlPreferCdn(src) || src;
      else if (typeof window.imgUrl === 'function') src = window.imgUrl(src) || src;
    } catch (_) {}
    return 'url("' + src.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
  }

  /** Strip leftover lock / inline hacks from earlier scroll experiments. */
  function clearDevelopScrollExperiments() {
    try { document.documentElement.classList.remove('develop-scroll-lock'); } catch (_) {}
    try { if (document.body) document.body.classList.remove('develop-diagram-focus'); } catch (_) {}
    var frame = document.querySelector('#panel-develop .dev-board-frame') || document.querySelector('.dev-board-frame');
    var scroll = $('devScroll');
    [frame, scroll].forEach(function (el) {
      if (!el || !el.style) return;
      try {
        el.style.removeProperty('overflow');
        el.style.removeProperty('max-height');
        el.style.removeProperty('min-height');
        el.style.removeProperty('height');
      } catch (_) {}
    });
  }

  function ensurePatternOverlay(scroll, pack) {
    if (!scroll) return;
    var ov = $('devPatternOverlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'devPatternOverlay';
      ov.setAttribute('aria-hidden', 'true');
      scroll.insertBefore(ov, scroll.firstChild);
    }
    /* Inline styles — survives stale develop.css cache in Simple Browser. */
    ov.style.cssText = [
      'position:absolute',
      'inset:0',
      'z-index:0',
      'pointer-events:none',
      'opacity:0.26',
      'background-image:' + cssUrl(pack.pt_treebg) + ',' + cssUrl(pack.pt_dots),
      /* TreeBG + Dots tiled smaller → denser field */
      'background-size:100px 100px,56px 56px',
      'background-position:0 0,8px 6px',
      'background-repeat:repeat,repeat'
    ].join(';');
  }

  /** Chronicle Diagram ↔ Complete — slow opacity crossfade on the frame (not the scroll). */
  function ensureBgCrossfade(frame, pack) {
    if (!frame) return;
    var stack = $('devBgStack');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'devBgStack';
      stack.className = 'dev-bg-stack';
      stack.setAttribute('aria-hidden', 'true');
      frame.insertBefore(stack, frame.firstChild);
      var a = document.createElement('div');
      a.className = 'dev-bg-layer dev-bg-layer--a';
      var b = document.createElement('div');
      b.className = 'dev-bg-layer dev-bg-layer--b';
      stack.appendChild(a);
      stack.appendChild(b);
    }
    var aEl = stack.querySelector('.dev-bg-layer--a');
    var bEl = stack.querySelector('.dev-bg-layer--b');
    var srcA = pack.bg_chronicle || pack.bg_base || '';
    var srcB = pack.bg_chronicle_complete || srcA;
    if (aEl) aEl.style.backgroundImage = cssUrl(srcA);
    if (bEl) bEl.style.backgroundImage = cssUrl(srcB);
  }

  function applyBoardChrome() {
    var scroll = $('devScroll');
    if (!scroll) return;
    var pack = ui();
    var frame = null;
    try {
      frame = scroll.closest ? scroll.closest('.dev-board-frame') : null;
    } catch (_) {}
    if (!frame && scroll.parentElement) frame = scroll.parentElement;
    ensureBgCrossfade(frame, pack);
    scroll.style.setProperty('--dev-bg-base', 'none');
    scroll.style.setProperty('--dev-pt-dots', cssUrl(pack.pt_dots));
    scroll.style.setProperty('--dev-pt-treebg', cssUrl(pack.pt_treebg));
    scroll.style.setProperty('--dev-text-bg', cssUrl(pack.text_bg));
    /* Plates live on #devBgStack; scroll stays transparent over them. */
    scroll.style.backgroundImage = 'none';
    scroll.style.backgroundColor = 'transparent';
    ensurePatternOverlay(scroll, pack);
    clearDevelopScrollExperiments();
    var vig = $('devVignette');
    if (vig) {
      vig.style.setProperty('--dev-bg-vignette', 'none');
      vig.hidden = true;
    }
  }

  /**
   * Size the MD grid.
   * Desktop: fit WIDTH (bake into cell size — no CSS scale).
   * Touch / narrow: keep readable cells; pan · pinch handles overflow.
   */
  function layoutMetrics(scroll, maxC, maxR, leftReserve, opts) {
    var cols = maxC + 1;
    var rows = maxR + 1;
    var left = Math.max(0, leftReserve | 0);
    var touchPan = !!(opts && opts.touchPan);
    /* Frame width — never scroll.clientWidth (overflow:visible inflates with the board). */
    var frame = null;
    try {
      frame = scroll && (scroll.closest ? scroll.closest('.dev-board-frame') : null);
    } catch (_) {}
    if (!frame && scroll && scroll.parentElement) frame = scroll.parentElement;
    var availW = Math.max(220, ((frame && frame.clientWidth) || (scroll && scroll.clientWidth) || 640) - 4);
    var CELL_MAX = 78;
    var CELL_SOFT_MIN = 52;
    var CELL_HARD_MIN = 28;
    var CELL_TOUCH = 56;

    function packFor(cell) {
      var koma = Math.round(Math.min(Math.max(cell * 1.68, Math.min(108, cell * 1.7)), cell * 1.82));
      var pad = Math.round(koma * 0.72);
      var padL = left > 0 ? left : pad;
      /* Tight right edge — reclaim width for columns */
      var padR = Math.max(10, Math.min(pad, Math.round(pad * 0.4)));
      return {
        cell: cell,
        koma: koma,
        pad: pad,
        padL: padL,
        padR: padR,
        baseFrac: 0.52,
        boardW: padL + padR + cols * cell,
        boardH: pad * 2 + rows * cell,
        availW: availW
      };
    }

    if (touchPan) {
      /* Readable units — board may be wider/taller than the viewport. */
      var tCell = CELL_TOUCH;
      if (cols <= 6) {
        var roomy = Math.floor((availW - left - 12) / Math.max(cols, 1));
        if (roomy >= 52) tCell = Math.min(CELL_MAX, Math.max(CELL_TOUCH, roomy));
      }
      return packFor(tCell);
    }

    /* Width-first: size cells from remaining width after the switcher. */
    var cell = Math.floor((availW - left - 10) / Math.max(cols, 1));
    if (cell > CELL_MAX) cell = CELL_MAX;
    if (cell < CELL_HARD_MIN) cell = CELL_HARD_MIN;

    /* Soft min only when the wider cells still fit the frame. */
    if (cell < CELL_SOFT_MIN && packFor(CELL_SOFT_MIN).boardW <= availW) {
      cell = CELL_SOFT_MIN;
    }

    var m = packFor(cell);
    while (m.boardW > availW && cell > CELL_HARD_MIN) {
      cell -= 1;
      m = packFor(cell);
    }
    return m;
  }

  function clampBoardView(vw, vh, boardW, boardH) {
    var s = boardView.scale;
    if (!(s > 0)) s = 1;
    var worldW = boardW * s;
    var worldH = boardH * s;
    if (worldW <= vw) boardView.x = (vw - worldW) / 2;
    else boardView.x = Math.min(0, Math.max(vw - worldW, boardView.x));
    if (worldH <= vh) boardView.y = (vh - worldH) / 2;
    else boardView.y = Math.min(0, Math.max(vh - worldH, boardView.y));
  }

  function applyBoardView(board) {
    if (!board) return;
    board.style.transformOrigin = '0 0';
    board.style.transform = 'translate3d('
      + boardView.x.toFixed(2) + 'px,'
      + boardView.y.toFixed(2) + 'px,0) scale('
      + boardView.scale + ')';
  }

  function clearSelectedNodeFromDock(anchorEl) {
    if (!anchorEl || !isTouchBoard()) return;
    var scroll = $('devScroll');
    var board = $('devBoard');
    var box = $('devDetail');
    if (!scroll || !board || !box || box.hidden) return;
    if (!scroll.classList.contains('is-panable')) return;
    var nr = anchorEl.getBoundingClientRect();
    var br = box.getBoundingClientRect();
    var overlap = nr.bottom - br.top;
    if (!(overlap > 8)) return;
    boardView.y -= (overlap + 16);
    clampBoardView(scroll.clientWidth || 0, scroll.clientHeight || 0, panMetrics.w, panMetrics.h);
    applyBoardView(board);
  }

  function resetBoardView(scroll, boardW, boardH) {
    var vw = Math.max(1, (scroll && scroll.clientWidth) || 1);
    var vh = Math.max(1, (scroll && scroll.clientHeight) || 1);
    var fit = Math.min(vw / Math.max(boardW, 1), vh / Math.max(boardH, 1));
    /* Start readable (1×). Only zoom out when the board already fits. */
    boardView.scale = fit >= 1 ? Math.min(1.15, fit) : 1;
    boardView.x = 0;
    boardView.y = 0;
    clampBoardView(vw, vh, boardW, boardH);
  }

  function touchDist(a, b) {
    var dx = a.clientX - b.clientX;
    var dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy) || 1;
  }

  function touchMid(a, b) {
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    };
  }

  function ensureBoardGestures(scroll) {
    if (gestureBound || !scroll) return;
    gestureBound = true;
    var suppressClick = false;

    function minScale() {
      var vw = Math.max(1, scroll.clientWidth || 1);
      var vh = Math.max(1, scroll.clientHeight || 1);
      var fit = Math.min(vw / Math.max(panMetrics.w, 1), vh / Math.max(panMetrics.h, 1));
      return Math.max(0.28, Math.min(1, fit * 0.92));
    }

    function onTouchStart(e) {
      if (!scroll.classList.contains('is-panable')) return;
      if (!e.touches || !e.touches.length) return;
      var board = $('devBoard');
      if (!board) return;
      scroll.classList.add('is-panning');
      if (e.touches.length >= 2) {
        var mid = touchMid(e.touches[0], e.touches[1]);
        var rect = scroll.getBoundingClientRect();
        gesture = {
          mode: 'pinch',
          dist0: touchDist(e.touches[0], e.touches[1]),
          scale0: boardView.scale,
          midX: mid.x - rect.left,
          midY: mid.y - rect.top,
          x0: boardView.x,
          y0: boardView.y,
          moved: true,
        };
      } else {
        gesture = {
          mode: 'pan',
          x0: boardView.x,
          y0: boardView.y,
          px: e.touches[0].clientX,
          py: e.touches[0].clientY,
          moved: false,
        };
      }
    }

    function onTouchMove(e) {
      if (!gesture || !scroll.classList.contains('is-panable')) return;
      var board = $('devBoard');
      if (!board) return;
      if (gesture.mode === 'pinch' && e.touches && e.touches.length >= 2) {
        try { e.preventDefault(); } catch (_) {}
        var dist = touchDist(e.touches[0], e.touches[1]);
        var next = gesture.scale0 * (dist / (gesture.dist0 || 1));
        next = Math.max(minScale(), Math.min(2.8, next));
        var mid = touchMid(e.touches[0], e.touches[1]);
        var rect = scroll.getBoundingClientRect();
        var mx = mid.x - rect.left;
        var my = mid.y - rect.top;
        /* Keep the pinch midpoint locked to the same board point. */
        var worldX = (gesture.midX - gesture.x0) / (gesture.scale0 || 1);
        var worldY = (gesture.midY - gesture.y0) / (gesture.scale0 || 1);
        boardView.scale = next;
        boardView.x = mx - worldX * next;
        boardView.y = my - worldY * next;
        clampBoardView(scroll.clientWidth, scroll.clientHeight, panMetrics.w, panMetrics.h);
        applyBoardView(board);
        return;
      }
      if (gesture.mode === 'pan' && e.touches && e.touches.length === 1) {
        var dx = e.touches[0].clientX - gesture.px;
        var dy = e.touches[0].clientY - gesture.py;
        if (!gesture.moved && Math.hypot(dx, dy) < 4) return;
        gesture.moved = true;
        try { e.preventDefault(); } catch (_) {}
        boardView.x = gesture.x0 + dx;
        boardView.y = gesture.y0 + dy;
        clampBoardView(scroll.clientWidth, scroll.clientHeight, panMetrics.w, panMetrics.h);
        applyBoardView(board);
      }
    }

    function onTouchEnd(e) {
      if (!gesture) return;
      if (e.touches && e.touches.length >= 1) {
        /* Still fingers down — re-arm from remaining touches. */
        var wasMoved = !!gesture.moved;
        onTouchStart(e);
        if (gesture) gesture.moved = wasMoved || !!gesture.moved;
        return;
      }
      if (gesture.moved) suppressClick = true;
      gesture = null;
      scroll.classList.remove('is-panning');
    }

    scroll.addEventListener('touchstart', onTouchStart, { passive: true });
    scroll.addEventListener('touchmove', onTouchMove, { passive: false });
    scroll.addEventListener('touchend', onTouchEnd, { passive: true });
    scroll.addEventListener('touchcancel', onTouchEnd, { passive: true });
    scroll.addEventListener('click', function (e) {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  function ptKey(x, y) {
    return Math.round(x) + ',' + Math.round(y);
  }

  function segKey(x1, y1, x2, y2) {
    var a = ptKey(x1, y1);
    var b = ptKey(x2, y2);
    return a < b ? a + '|' + b : b + '|' + a;
  }

  /**
   * Soft-filleted ortho pipe along route cells (in-game DevelopTree).
   * Follows grid corridors: horizontal/vertical runs + wide rounded shoulders.
   * No start→end skewered cubic; no sharp 90° corners.
   */
  function softFilletOrtho(pts, radius) {
    var cleaned = [];
    (pts || []).forEach(function (pt) {
      if (!pt) return;
      if (!cleaned.length) {
        cleaned.push({ x: pt.x, y: pt.y });
        return;
      }
      var prev = cleaned[cleaned.length - 1];
      if (Math.hypot(pt.x - prev.x, pt.y - prev.y) > 0.75) {
        cleaned.push({ x: pt.x, y: pt.y });
      }
    });
    // Collapse collinear middle points so fillets only sit on real turns.
    var p = [];
    cleaned.forEach(function (pt, i) {
      if (i === 0 || i === cleaned.length - 1) {
        p.push(pt);
        return;
      }
      var a = cleaned[i - 1];
      var c = cleaned[i + 1];
      var cross = (pt.x - a.x) * (c.y - pt.y) - (pt.y - a.y) * (c.x - pt.x);
      if (Math.abs(cross) > 0.5) p.push(pt);
    });
    if (p.length < 2) return '';
    if (p.length === 2) {
      return 'M ' + p[0].x + ' ' + p[0].y + ' L ' + p[1].x + ' ' + p[1].y;
    }
    var d = 'M ' + p[0].x + ' ' + p[0].y;
    for (var i = 1; i < p.length - 1; i++) {
      var a = p[i - 1];
      var b = p[i];
      var c = p[i + 1];
      var v1x = b.x - a.x;
      var v1y = b.y - a.y;
      var v2x = c.x - b.x;
      var v2y = c.y - b.y;
      var len1 = Math.hypot(v1x, v1y) || 1;
      var len2 = Math.hypot(v2x, v2y) || 1;
      // In-game shoulders are wide but stay inside each leg (~half cell+).
      var r = Math.min(radius, len1 * 0.48, len2 * 0.48);
      if (r < 4) {
        d += ' L ' + b.x + ' ' + b.y;
        continue;
      }
      var u1x = v1x / len1;
      var u1y = v1y / len1;
      var u2x = v2x / len2;
      var u2y = v2y / len2;
      var enterX = b.x - u1x * r;
      var enterY = b.y - u1y * r;
      var leaveX = b.x + u2x * r;
      var leaveY = b.y + u2y * r;
      d += ' L ' + enterX + ' ' + enterY;
      // Cubic fillet: handles along each leg → soft shoulder, still LTR/forward.
      var h = r * 0.55;
      d += ' C '
        + (enterX + u1x * h) + ' ' + (enterY + u1y * h) + ' '
        + (leaveX - u2x * h) + ' ' + (leaveY - u2y * h) + ' '
        + leaveX + ' ' + leaveY;
    }
    d += ' L ' + p[p.length - 1].x + ' ' + p[p.length - 1].y;
    return d;
  }

  function shrinkPolylineEnds(pts, dockR) {
    if (!pts || pts.length < 2) return pts || [];
    var out = pts.map(function (pt) { return { x: pt.x, y: pt.y }; });
    var a = out[0];
    var b = out[1];
    var len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    var pull = Math.min(dockR, Math.max(0, len * 0.42));
    out[0] = { x: a.x + ((b.x - a.x) / len) * pull, y: a.y + ((b.y - a.y) / len) * pull };
    var c = out[out.length - 2];
    var d = out[out.length - 1];
    len = Math.hypot(d.x - c.x, d.y - c.y) || 1;
    pull = Math.min(dockR, Math.max(0, len * 0.42));
    out[out.length - 1] = {
      x: d.x - ((d.x - c.x) / len) * pull,
      y: d.y - ((d.y - c.y) / len) * pull,
    };
    return out;
  }

  /**
   * In-game wire rules:
   * - Stroke follows route.cells (ortho corridors), soft-filleted corners
   * - Fan-in (multi=false): N spaced tips + N arrows
   * - Joint (multi=true): N strokes → same tip + 1 arrow
   * - Fork-out: shared stem cells then branch (MD already encodes the fan)
   */
  function routeWireDraws(routes, cellX, cellY, cell, pieceKeys, dockR, pieceAt) {
    var out = [];
    var arrows = [];
    var endBuckets = Object.create(null);
    var jointTipDone = Object.create(null);
    /* Cap fillet to cell — tiny cells + huge radius made ULT short hops look broken. */
    var radius = Math.max(8, Math.min(cell * 0.42, cell * 0.48));

    (routes || []).forEach(function (rt, ri) {
      var cells = rt.cells || [];
      if (cells.length < 2) return;
      var end = cells[cells.length - 1];
      var ek = end.col + ',' + end.row;
      if (!endBuckets[ek]) endBuckets[ek] = [];
      endBuckets[ek].push(ri);
    });

    function endMode(endKey) {
      var n = (endBuckets[endKey] || []).length;
      if (n <= 1) return 'single';
      var piece = pieceAt && pieceAt[endKey];
      if (piece && piece.multi) return 'joint';
      return 'fan';
    }

    // Fan-in (multi=false, N parents): N separate tips near the rim (in-game).
    // Keep same-row approaches at tip offset 0 so Spallow→Assault stays flat;
    // other parents fan above/below with a tight gap.
    var fanSlot = Object.create(null);
    Object.keys(endBuckets).forEach(function (ek) {
      if (endMode(ek) !== 'fan') return;
      var list = (endBuckets[ek] || []).slice();
      if (list.length <= 1) return;
      list.sort(function (a, b) {
        var ca = ((routes[a] || {}).cells || [])[0] || {};
        var cb = ((routes[b] || {}).cells || [])[0] || {};
        return cellY(ca.row) - cellY(cb.row);
      });
      var endCell = ((routes[list[0]] || {}).cells || []);
      endCell = endCell[endCell.length - 1] || {};
      var endRow = endCell.row;
      var gap = Math.max(11, Math.min(18, cell * 0.16));
      list.forEach(function (ri, slot) {
        fanSlot[ri] = (slot - (list.length - 1) / 2) * gap;
      });
      var zeroRi = null;
      list.forEach(function (ri) {
        var cells = (routes[ri] || {}).cells || [];
        var start = cells[0] || {};
        if (start.row === endRow && zeroRi == null) zeroRi = ri;
      });
      if (zeroRi != null && fanSlot[zeroRi] != null) {
        var adj = fanSlot[zeroRi];
        list.forEach(function (ri) { fanSlot[ri] -= adj; });
      }
    });

    (routes || []).forEach(function (rt, ri) {
      var cells = rt.cells || [];
      if (cells.length < 2) return;
      var end = cells[cells.length - 1];
      var ek = end.col + ',' + end.row;
      var mode = endMode(ek);
      var pts = cells.map(function (c) {
        return { x: cellX(c.col), y: cellY(c.row) };
      });
      if (mode === 'fan' && fanSlot[ri] != null && Math.abs(fanSlot[ri]) > 0.5) {
        var tipOff = fanSlot[ri];
        var baseEndY = pts[pts.length - 1].y;
        pts[pts.length - 1].y = baseEndY + tipOff;
        // Only the final horizontal stub rides tipY (corridor stays on MD row).
        for (var j = pts.length - 2; j >= 0; j--) {
          if (Math.abs(pts[j].y - baseEndY) > 1.25) break;
          if (Math.abs(pts[j].x - pts[j + 1].x) < 1.25) break;
          // Short stub only — stop after one horizontal predecessor.
          pts[j].y = baseEndY + tipOff;
          break;
        }
      }
      // Undocked end = cell center (base sits here); keep for arrow placement.
      var endCx = pts[pts.length - 1].x;
      var endCy = pts[pts.length - 1].y;
      var preDock = pts.length >= 2 ? pts[pts.length - 2] : pts[0];
      pts = shrinkPolylineEnds(pts, dockR);
      var d = softFilletOrtho(pts, radius);
      if (d) out.push({ d: d, arrow: null });
      var last = pts[pts.length - 1];
      var prev = pts[pts.length - 2] || last;
      var tipArrow = {
        x0: prev.x + (last.x - prev.x) * 0.55,
        y0: prev.y + (last.y - prev.y) * 0.55,
        x1: last.x,
        y1: last.y,
        endCx: endCx,
        endCy: endCy,
        fromX: preDock.x,
        fromY: preDock.y,
      };
      if (mode === 'joint') {
        if (!jointTipDone[ek]) {
          jointTipDone[ek] = 1;
          arrows.push(tipArrow);
        }
      } else {
        arrows.push(tipArrow);
      }
    });

    arrows.forEach(function (a) {
      out.push({ d: null, arrow: a });
    });
    return out;
  }

  function pieceById(diagram, id) {
    var list = diagram.pieces || [];
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }

  function rarityKey(rarity) {
    return String(rarity || '').toUpperCase();
  }

  function frameFor(mapKey, rarity) {
    var pack = ui();
    var bucket = pack[mapKey] || {};
    var key = rarityKey(rarity);
    return bucket[key] || bucket.N || '';
  }

  function mkImg(cls, src) {
    var img = document.createElement('img');
    img.className = cls;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.src = src;
    return img;
  }

  /** Capturable marker — EventExchangeItem shape, green-tinted (no official capture-unit icon). */
  var CAPTURE_ICON_PATH = '/static/images/UI/UI_Common_Icon_Capturable.webp';

  function captureLegendLabel() {
    var pack = ui();
    return pack.capture_legend || pack.capture_title || 'Capturable Unit';
  }

  function captureIconSrc() {
    var pack = ui();
    var src = pack.capture_icon || CAPTURE_ICON_PATH;
    try {
      if (typeof window.imgUrlPreferCdn === 'function') src = window.imgUrlPreferCdn(src) || src;
      else if (typeof window.imgUrl === 'function') src = window.imgUrl(src) || src;
    } catch (_) {}
    return src;
  }

  function syncCaptureLegend() {
    var legend = $('devCaptureLegend');
    var icon = $('devCaptureLegendIcon');
    var label = $('devCaptureLegendLabel');
    var text = captureLegendLabel();
    if (label) label.textContent = text;
    if (legend) legend.setAttribute('aria-label', text);
    if (icon) {
      var src = captureIconSrc();
      if (icon.getAttribute('src') !== src) icon.src = src;
    }
  }

  function mkCaptureIcon(title) {
    var wrap = document.createElement('span');
    wrap.className = 'dev-capture-flare';
    wrap.title = title || captureLegendLabel();
    var img = document.createElement('img');
    img.className = 'dev-capture-flare-icon';
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    img.src = captureIconSrc();
    wrap.appendChild(img);
    return wrap;
  }

  function currentDiagram() {
    var map = state.map;
    return (map && map.diagrams && map.diagrams[state.diagram]) || null;
  }

  function setNodeHighlight(pieceId, hoverOnly) {
    var board = $('devBoard');
    if (!board) return;
    var nodes = board.querySelectorAll('.dev-node');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var id = n.getAttribute('data-piece-id');
      var on = pieceId != null && String(id) === String(pieceId);
      if (hoverOnly) {
        n.classList.toggle('is-hover', on);
      } else {
        n.classList.toggle('is-selected', on);
        if (!on) n.classList.remove('is-hover');
      }
    }
  }

  function cancelHoverClear() {
    if (hoverClearTimer != null) {
      clearTimeout(hoverClearTimer);
      hoverClearTimer = null;
    }
  }

  function clearHoverDetail() {
    cancelHoverClear();
    if (state.selected != null) return;
    setNodeHighlight(null, true);
    renderDetail(null, null);
  }

  function scheduleHoverClear() {
    if (state.selected != null) return;
    cancelHoverClear();
    hoverClearTimer = setTimeout(function () {
      hoverClearTimer = null;
      clearHoverDetail();
    }, 160);
  }

  function bindHoverDetailBridge() {
    if (hoverDetailBound || !hoverCapable) return;
    hoverDetailBound = true;
    var detail = $('devDetail');
    if (!detail) return;
    detail.addEventListener('pointerenter', function () {
      cancelHoverClear();
    });
    detail.addEventListener('pointerleave', function () {
      scheduleHoverClear();
    });
    /*
      Floating detail wheel must never chain to the page (that toggles nav hide
      and resizes the board). Always consume + scroll the card itself.
    */
    detail.addEventListener('wheel', function (e) {
      if (detail.hidden || detail.classList.contains('is-sheet')) return;
      e.preventDefault();
      e.stopPropagation();
      detail.scrollTop += e.deltaY;
    }, { passive: false });
  }

  /** While hovering a node, wheel scrolls the open detail card (long capture lists). */
  function forwardWheelToDetail(e) {
    var box = $('devDetail');
    if (!box || box.hidden || box.classList.contains('is-sheet')) return;
    e.preventDefault();
    e.stopPropagation();
    box.scrollTop += e.deltaY;
  }

  function closeUnitSheet() {
    var box = $('devDetail');
    var backdrop = $('devSheetBackdrop');
    var closeBtn = $('devDetailClose');
    var openFull = $('devDetailOpenFullWrap');
    if (box) {
      box.classList.remove('is-open', 'is-sheet', 'is-floating', 'is-mobile-dock', 'is-viewport-fixed');
      box.hidden = true;
      box.setAttribute('hidden', '');
      box.style.left = '';
      box.style.top = '';
      box.style.right = '';
      box.style.bottom = '';
      box.style.width = '';
      box.style.maxWidth = '';
      box.style.maxHeight = '';
      box.style.position = '';
    }
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.hidden = true;
      backdrop.setAttribute('hidden', '');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (closeBtn) {
      closeBtn.hidden = true;
      closeBtn.setAttribute('hidden', '');
    }
    if (openFull) {
      openFull.hidden = true;
      openFull.setAttribute('hidden', '');
    }
  }

  function clearSelection() {
    state.selected = null;
    state.detailUnitId = null;
    setNodeHighlight(null, false);
    closeUnitSheet();
    renderDetail(null, null);
  }

  function openUnitDetailPage(unit) {
    if (!unit || unit.unknown) return false;
    var id = unit.id || state.detailUnitId || '';
    if (id && typeof window.openDetail === 'function') {
      try {
        window.openDetail('unit', id);
        return true;
      } catch (_) {}
    }
    var href = unit.href || (id ? ('/u/' + id) : '');
    if (href && href !== '#') {
      window.location.href = href;
      return true;
    }
    return false;
  }

  function showPieceDetail(piece, opts) {
    opts = opts || {};
    var diagram = currentDiagram();
    if (!piece) {
      clearSelection();
      return;
    }
    if (opts.pin) {
      state.selected = piece.id;
      setNodeHighlight(piece.id, false);
    } else if (hoverCapable) {
      if (state.selected != null) return;
      setNodeHighlight(piece.id, true);
    }
    renderDetail(diagram, piece, opts);
  }

  function placeDetailPopup(box, opts) {
    opts = opts || {};
    var frame = document.querySelector('.dev-board-frame');
    if (!box || !frame) return;
    box.classList.add('is-floating');
    box.classList.remove('is-sheet', 'is-open');
    /*
      Touch pinned: dock to the bottom of the frame so the ogk stays tappable
      for a second tap (floating near the node covered it).
    */
    if (opts.mode === 'dock' || (opts.pin && !hoverCapable)) {
      box.classList.add('is-mobile-dock');
      box.classList.remove('is-viewport-fixed');
      box.style.position = 'absolute';
      box.style.left = '8px';
      box.style.right = '8px';
      box.style.top = 'auto';
      box.style.bottom = '8px';
      box.style.width = 'auto';
      box.style.maxHeight = '';
      box.style.maxWidth = '';
      return;
    }
    box.classList.remove('is-mobile-dock');
    /* Fixed to the viewport — board-frame overflow:hidden must not clip the card. */
    box.classList.add('is-viewport-fixed');
    box.style.position = 'fixed';

    var pad = 8;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var fr = frame.getBoundingClientRect();
    /* Sticky .app-header (z-index 100) covers the top — never park the card under it. */
    var headerEl = document.querySelector('.app-header');
    var headerBottom = 0;
    if (headerEl) {
      try {
        headerBottom = headerEl.getBoundingClientRect().bottom || 0;
      } catch (_) {
        headerBottom = 0;
      }
    }
    var safeTop = Math.max(pad, headerBottom + pad);
    var safeBottom = Math.max(safeTop + 160, vh - pad);
    /* Prefer staying over the board, but stay inside the safe viewport band. */
    var viewLeft = Math.max(pad, Math.min(fr.left, vw - pad));
    var viewTop = Math.max(safeTop, Math.min(Math.max(fr.top, safeTop), safeBottom - pad));
    var viewRight = Math.max(viewLeft + 120, Math.min(fr.right, vw - pad));
    var viewBottom = Math.max(viewTop + 160, Math.min(fr.bottom, safeBottom));
    /* If the frame is mostly off-screen, fall back to the safe viewport band. */
    if (viewRight - viewLeft < 160 || viewBottom - viewTop < 180) {
      viewLeft = pad;
      viewTop = safeTop;
      viewRight = vw - pad;
      viewBottom = safeBottom;
    }
    var availW = Math.max(120, viewRight - viewLeft);
    var availH = Math.max(160, viewBottom - viewTop);
    var maxW = Math.min(340, availW);
    var maxH = Math.max(160, availH);

    box.style.maxWidth = Math.round(maxW) + 'px';
    box.style.width = '';
    box.style.maxHeight = Math.round(maxH) + 'px';
    box.style.left = Math.round(viewLeft) + 'px';
    box.style.top = Math.round(viewTop) + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';

    var bw = Math.min(box.offsetWidth || maxW, maxW);
    var naturalH = Math.max(box.scrollHeight || 0, box.offsetHeight || 0);
    var bh = Math.min(naturalH, maxH);

    var minX = viewLeft;
    var minY = viewTop;
    var maxX = viewRight - bw;
    var maxY = viewBottom - bh;
    if (maxX < minX) maxX = minX;
    if (maxY < minY) maxY = minY;

    var x = minX;
    var y = minY;
    var gap = 12;
    var cursorMode = opts.mode === 'cursor' && opts.clientX != null;
    if (cursorMode) {
      x = opts.clientX + gap;
      y = opts.clientY + gap;
      if (x + bw > viewRight) x = opts.clientX - bw - gap;
      if (y + bh > viewBottom) y = opts.clientY - bh - gap;
    } else if (opts.anchorEl) {
      var ar = opts.anchorEl.getBoundingClientRect();
      var cy = ar.top + ar.height * 0.5;
      var nodeGap = Math.max(gap, Math.max(ar.width, ar.height) * 0.28);
      /* Prefer right of node; flip left if needed. */
      x = ar.right + nodeGap;
      if (x + bw > viewRight) x = ar.left - nodeGap - bw;
      /* Prefer align near node; if tall, pin just under the header so the title stays visible. */
      if (bh >= maxH * 0.72 || naturalH > maxH * 0.6) {
        y = minY;
      } else {
        y = cy - bh * 0.25;
        if (y + bh > viewBottom) y = viewBottom - bh;
        if (y < minY) y = minY;
      }
    }

    if (x > maxX) x = maxX;
    if (x < minX) x = minX;
    if (y > maxY) y = maxY;
    if (y < minY) y = minY;

    box.style.left = Math.round(x) + 'px';
    box.style.top = Math.round(y) + 'px';
    box.style.right = 'auto';
    box.style.bottom = 'auto';
  }

  function openUnitSheet(box) {
    var backdrop = $('devSheetBackdrop');
    var closeBtn = $('devDetailClose');
    var openFull = $('devDetailOpenFullWrap');
    if (!box) return;
    box.classList.remove('is-floating', 'is-mobile-dock', 'is-viewport-fixed');
    box.classList.add('is-sheet');
    box.style.left = '';
    box.style.top = '';
    box.style.right = '';
    box.style.bottom = '';
    box.style.width = '';
    box.style.maxWidth = '';
    box.style.maxHeight = '';
    box.style.position = '';
    box.hidden = false;
    box.removeAttribute('hidden');
    if (closeBtn) {
      closeBtn.hidden = false;
      closeBtn.removeAttribute('hidden');
    }
    if (openFull) {
      openFull.hidden = false;
      openFull.removeAttribute('hidden');
    }
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.removeAttribute('hidden');
      backdrop.setAttribute('aria-hidden', 'false');
      // Next frame so enter transition runs.
      requestAnimationFrame(function () {
        box.classList.add('is-open');
        backdrop.classList.add('is-open');
      });
    } else {
      requestAnimationFrame(function () { box.classList.add('is-open'); });
    }
  }

  function renderDetail(diagram, piece, opts) {
    opts = opts || {};
    var box = $('devDetail');
    if (!box) return;
    if (!piece) {
      state.detailUnitId = null;
      if (!opts.keepSheet) closeUnitSheet();
      else {
        box.hidden = true;
        box.classList.remove('is-floating');
      }
      return;
    }
    var asSheet = !!opts.sheet;
    box.hidden = false;
    box.removeAttribute('hidden');
    var unit = piece.unit || {};
    var pack = ui();
    var unknown = !!unit.unknown;
    state.detailUnitId = (!unknown && unit.id) ? String(unit.id) : null;
    $('devDetailName').textContent = unknown
      ? '???'
      : (unit.name || unit.id || '');

    var rarImg = $('devDetailRarity');
    if (rarImg) {
      if (!unknown && unit.rarity_icon) {
        rarImg.hidden = false;
        rarImg.removeAttribute('hidden');
        rarImg.src = unit.rarity_icon;
        rarImg.alt = unit.rarity || '';
      } else {
        rarImg.hidden = true;
        rarImg.setAttribute('hidden', '');
        rarImg.removeAttribute('src');
        rarImg.alt = '';
      }
    }
    var metaText = $('devDetailMetaText');
    if (metaText) {
      metaText.textContent = unknown
        ? ''
        : ['Lv ' + (piece.level || 0), unit.role || '', unit.id || '']
          .filter(Boolean).join(' · ');
    }

    var link = $('devDetailLink');
    var thum = $('devDetailThum');
    var openFullA = $('devDetailOpenFull');
    var href = (!unknown && (unit.href || unit.id)) ? (unit.href || ('/u/' + unit.id)) : '#';
    if (link) {
      link.href = href;
      link.title = unit.name || '';
      if (unknown || href === '#') link.removeAttribute('href');
      else link.href = href;
    }
    if (openFullA) {
      if (unknown || href === '#') {
        openFullA.removeAttribute('href');
        openFullA.setAttribute('aria-disabled', 'true');
      } else {
        openFullA.href = href;
        openFullA.removeAttribute('aria-disabled');
      }
    }
    if (thum) {
      // List thum first; unknown → Secret_Reward placeholder (never map ogk).
      var src = '';
      if (unknown) src = pack.secret_icon || '';
      else src = unit.thum || '';
      if (src) {
        thum.hidden = false;
        thum.removeAttribute('hidden');
        thum.style.display = 'block';
        thum.alt = unit.name || '';
        if (thum.getAttribute('src') !== src) thum.src = src;
        thum.onerror = function () {
          var fallback = pack.secret_icon || '';
          if (fallback && thum.getAttribute('src') !== fallback) thum.src = fallback;
        };
      } else {
        thum.hidden = true;
        thum.setAttribute('hidden', '');
        thum.removeAttribute('src');
      }
    }
    if (asSheet) openUnitSheet(box);
    else placeDetailPopup(box, opts);

    /* After bottom-dock, nudge the pan so the selected ogk is not under the card. */
    if (!asSheet && (opts.mode === 'dock' || (opts.pin && !hoverCapable)) && opts.anchorEl) {
      requestAnimationFrame(function () {
        clearSelectedNodeFromDock(opts.anchorEl);
      });
    }

    var matTitle = $('devMatTitle');
    if (matTitle) {
      matTitle.textContent = pack.materials_title || 'Required Materials';
      /* Secret nodes: hide develop mats (spoilers); capture stages still shown. */
      if (unknown) {
        matTitle.hidden = true;
        matTitle.setAttribute('hidden', '');
      } else {
        matTitle.hidden = false;
        matTitle.removeAttribute('hidden');
      }
    }

    // Capital (m_unit.DevelopCapital) — always first under Required Materials.
    var capitalAmt = unknown ? 0 : Number(piece.capital || 0);
    var capitalIcon = pack.capital_icon || '';
    var capitalLabel = pack.capital_label || 'Capital';
    if (!capitalAmt && !unknown && piece.materials) {
      for (var ci = 0; ci < piece.materials.length; ci++) {
        var cm = piece.materials[ci];
        if (cm && (cm.is_capital || String(cm.item_id) === 'capital')) {
          capitalAmt = Number(cm.count || 0);
          if (cm.icon) capitalIcon = cm.icon;
          if (cm.name) capitalLabel = cm.name;
          break;
        }
      }
    }
    function appendMatChip(parent, iconSrc, label, amount) {
      if (!parent) return;
      var row = document.createElement(parent.tagName === 'UL' ? 'li' : 'div');
      row.className = 'dev-mat-row';
      var icon = mkImg('dev-mat-icon', iconSrc || '');
      icon.width = 22;
      icon.height = 22;
      icon.setAttribute('width', '22');
      icon.setAttribute('height', '22');
      if (!iconSrc) {
        icon.classList.add('is-missing');
      } else {
        icon.onerror = function () {
          icon.classList.add('is-missing');
        };
      }
      row.appendChild(icon);
      var lbl = document.createElement('span');
      lbl.className = 'dev-mat-label';
      var n = Number(amount || 0);
      lbl.textContent = label + ' × ' + (n ? n.toLocaleString() : String(amount || ''));
      row.appendChild(lbl);
      parent.appendChild(row);
    }
    /** One cell: Capital + item mats as the same list rows (no separate capital box). */
    function fillMatsList(listEl, materials, stepCapital) {
      if (!listEl) return { capAmt: 0, listLen: 0 };
      var capAmt = Number(stepCapital || 0);
      var capIconSrc = capitalIcon;
      var capName = capitalLabel;
      var list = [];
      (materials || []).forEach(function (m) {
        if (!m) return;
        if (m.is_capital || String(m.item_id) === 'capital') {
          if (!capAmt) capAmt = Number(m.count || 0);
          if (m.icon) capIconSrc = m.icon;
          if (m.name) capName = m.name;
          return;
        }
        list.push(m);
      });
      listEl.innerHTML = '';
      if (capAmt > 0) appendMatChip(listEl, capIconSrc, capName, capAmt);
      list.forEach(function (m) {
        appendMatChip(listEl, m.icon || '', m.name || m.item_id, m.count);
      });
      if (!list.length && capAmt <= 0) {
        var empty = document.createElement(listEl.tagName === 'UL' ? 'li' : 'div');
        empty.className = 'dev-mat-row';
        empty.textContent = '—';
        listEl.appendChild(empty);
      }
      return { capAmt: capAmt, listLen: list.length };
    }
    function hideLegacyCap(el) {
      if (!el) return;
      el.innerHTML = '';
      el.hidden = true;
      el.setAttribute('hidden', '');
      el.style.display = 'none';
    }
    hideLegacyCap($('devDetailCapital'));
    var matsEl = $('devMats');
    if (unknown) {
      if (matsEl) matsEl.innerHTML = '';
    } else {
      fillMatsList(matsEl, piece.materials, capitalAmt);
    }

    // Bulk Development = MD path total (this step + all prior units on the lineage).
    var bulkTitle = $('devBulkTitle');
    var bulkNote = $('devBulkNote');
    var bulk = unknown ? [] : (piece.bulk_materials || []);
    var bulkHas = !unknown && bulk.length > 0;
    var bulkSteps = unknown ? 0 : Number(piece.bulk_steps || 0);
    if (bulkTitle) {
      bulkTitle.textContent = pack.bulk_title || 'Bulk Development';
      if (bulkHas) {
        bulkTitle.hidden = false;
        bulkTitle.removeAttribute('hidden');
      } else {
        bulkTitle.hidden = true;
        bulkTitle.setAttribute('hidden', '');
      }
    }
    if (bulkNote) {
      if (bulkHas && bulkSteps > 1) {
        bulkNote.hidden = false;
        bulkNote.removeAttribute('hidden');
        var noteBase = pack.bulk_note || 'Path total';
        var unitsWord = pack.bulk_units_word || 'units';
        bulkNote.textContent = noteBase + ' · ' + bulkSteps + ' ' + unitsWord;
      } else if (bulkHas) {
        bulkNote.hidden = false;
        bulkNote.removeAttribute('hidden');
        bulkNote.textContent = pack.bulk_note_single || pack.bulk_note || 'Path total';
      } else {
        bulkNote.hidden = true;
        bulkNote.setAttribute('hidden', '');
        bulkNote.textContent = '';
      }
    }
    hideLegacyCap($('devDetailBulkCapital'));
    if (bulkHas) {
      fillMatsList($('devBulkMats'), bulk, 0);
    } else {
      var bMats = $('devBulkMats');
      if (bMats) bMats.innerHTML = '';
    }

    // Capturable stages (m_capturable_unit) — include secret/unknown develop nodes.
    var capTitle = $('devCaptureTitle');
    var capList = $('devCaptureStages');
    var capStages = Array.isArray(piece.capture_stages) ? piece.capture_stages : [];
    var capHas = !!(piece.capturable || capStages.length);
    if (capTitle) {
      capTitle.replaceChildren();
      if (capHas) {
        var capTitleIcon = document.createElement('img');
        capTitleIcon.className = 'dev-capture-title-icon';
        capTitleIcon.alt = '';
        capTitleIcon.decoding = 'async';
        capTitleIcon.draggable = false;
        capTitleIcon.src = captureIconSrc();
        capTitle.appendChild(capTitleIcon);
        capTitle.appendChild(document.createTextNode(pack.capture_title || 'Capturing Units'));
        capTitle.hidden = false;
        capTitle.removeAttribute('hidden');
      } else {
        capTitle.textContent = pack.capture_title || 'Capturing Units';
        capTitle.hidden = true;
        capTitle.setAttribute('hidden', '');
      }
    }
    if (capList) {
      capList.innerHTML = '';
      if (capHas) {
        capList.hidden = false;
        capList.removeAttribute('hidden');
        capStages.forEach(function (st) {
          if (!st) return;
          var li = document.createElement('li');
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dev-capture-row';
          var sid = String(st.stage_id || '');
          btn.setAttribute('data-stage-id', sid);
          var nameEl = document.createElement('span');
          nameEl.className = 'dev-capture-row-name';
          nameEl.textContent = st.name || sid;
          btn.appendChild(nameEl);
          var metaParts = [];
          if (st.series_name) metaParts.push(String(st.series_name));
          if (st.stage_number != null && Number(st.stage_number) > 0) {
            metaParts.push('#' + String(st.stage_number));
          }
          if (metaParts.length) {
            var metaEl = document.createElement('span');
            metaEl.className = 'dev-capture-row-meta';
            metaEl.textContent = metaParts.join(' · ');
            btn.appendChild(metaEl);
          }
          var tags = document.createElement('span');
          tags.className = 'dev-capture-tags';
          var anyTag = false;
          /* No Featured/pickup tag — IsStageSelectPickupCaptureUnit is not a useful UI signal. */
          if (st.is_hard) {
            var tHard = document.createElement('span');
            tHard.className = 'dev-capture-tag is-hard';
            tHard.textContent = pack.capture_hard || 'HARD';
            tags.appendChild(tHard);
            anyTag = true;
          }
          if (st.is_secret_battle_pickup || st.has_secret_battle) {
            var tSec = document.createElement('span');
            tSec.className = 'dev-capture-tag is-secret';
            tSec.textContent = pack.capture_secret_battle || 'Secret battle';
            tags.appendChild(tSec);
            anyTag = true;
          }
          if (st.is_story_event) {
            var tStory = document.createElement('span');
            tStory.className = 'dev-capture-tag is-story';
            tStory.textContent = pack.capture_story_event || 'Story Event';
            tags.appendChild(tStory);
            anyTag = true;
          }
          if (anyTag) btn.appendChild(tags);
          btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            if (!sid) return;
            if (typeof window.openDetail === 'function') {
              try { window.openDetail('stage', sid); } catch (_) {}
            }
          });
          li.appendChild(btn);
          capList.appendChild(li);
        });
      } else {
        capList.hidden = true;
        capList.setAttribute('hidden', '');
      }
    }

    // Re-place after content sized (mats / capture rows / images).
    if (!asSheet) {
      placeDetailPopup(box, opts);
      requestAnimationFrame(function () {
        placeDetailPopup(box, opts);
      });
    }
  }

  function bindDismissOnce() {
    if (boundDismiss) return;
    boundDismiss = true;
    var scroll = $('devScroll');
    var board = $('devBoard');
    var detail = $('devDetail');
    var backdrop = $('devSheetBackdrop');
    var closeBtn = $('devDetailClose');
    if (detail) {
      detail.addEventListener('click', function (e) { e.stopPropagation(); });
      detail.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    }
    function onEmpty(e) {
      var t = e.target;
      if (t && t.closest && t.closest('.dev-node')) return;
      if (t && t.closest && t.closest('.dev-detail')) return;
      clearSelection();
    }
    if (scroll) scroll.addEventListener('click', onEmpty);
    if (board) board.addEventListener('click', onEmpty);
    if (backdrop) backdrop.addEventListener('click', function () { clearSelection(); });
    if (closeBtn) closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      clearSelection();
    });
    /* Thum / “Open unit page” → same unit dossier as desktop (SPA openDetail). */
    function onOpenUnit(e) {
      var id = state.detailUnitId;
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      openUnitDetailPage({ id: id, href: '/u/' + id });
    }
    var link = $('devDetailLink');
    var openFull = $('devDetailOpenFull');
    if (link) link.addEventListener('click', onOpenUnit);
    if (openFull) openFull.addEventListener('click', onOpenUnit);
  }

  function renderBoard(opts) {
    opts = opts || {};
    var parkOnly = !!opts.parkOnly;
    var skipWarm = !!opts.skipWarm;
    var forceRebuild = !!opts.force;
    var map = state.map;
    var di = state.diagram | 0;
    var diagram = (map && map.diagrams && map.diagrams[di]) || null;
    var scroll = $('devScroll');
    var main = document.querySelector('.dev-main');
    if (!scroll) return;
    if (!diagram) {
      var emptyBoard = $('devBoard');
      if (emptyBoard && !parkOnly) emptyBoard.innerHTML = '';
      return;
    }
    bindDismissOnce();
    bindHoverDetailBridge();

    var touchPan = isTouchBoard();
    var bar = $('devDiagramBar');
    var barW = (bar && !bar.hidden) ? (bar.offsetWidth || 0) : 0;
    /*
      Desktop: budget full switcher width, then center the tree in the remainder.
      Touch: compact tabs overlay the board — only a thin gutter so units stay large.
    */
    var tabW = 0;
    if (bar && !bar.hidden) {
      tabW = touchPan
        ? Math.ceil(Math.min(barW || 118, 124) + 4)
        : Math.ceil((barW || 218) + 6);
    }
    var frameEl = (scroll.closest && scroll.closest('.dev-board-frame')) || scroll.parentElement;
    var availWProbe = Math.max(220, (frameEl && frameEl.clientWidth ? frameEl.clientWidth : scroll.clientWidth) - 4);
    var layoutSig = (touchPan ? 't' : 'd') + ':' + Math.round(availWProbe) + ':' + tabW;

    if (!parkOnly && (boardParkSeries !== String(seriesId) || boardParkLayout !== layoutSig)) {
      clearBoardPark();
      boardParkSeries = String(seriesId);
      boardParkLayout = layoutSig;
    } else if (parkOnly && !boardParkSeries) {
      boardParkSeries = String(seriesId);
      boardParkLayout = layoutSig;
    }

    /* Instant path: promote an already-painted sibling diagram. */
    if (!forceRebuild && !parkOnly && boardPark[di] && boardPark[di].el) {
      var hit = boardPark[di];
      promoteBoardEntry(hit);
      applyParkedBoardChrome(hit);
      try {
        hit.el.querySelectorAll('.dev-node.is-selected').forEach(function (n) {
          n.classList.remove('is-selected');
        });
      } catch (_) {}
      renderDetail(diagram, null);
      finishParkedBoardInteraction(hit);
      if (!skipWarm) scheduleWarmSiblingBoards();
      return;
    }

    var board;
    if (parkOnly) {
      board = document.createElement('div');
      board.className = 'dev-board is-parked';
      board.setAttribute('data-dev-di', String(di));
      board.setAttribute('aria-hidden', 'true');
      scroll.appendChild(board);
    } else {
      board = $('devBoard');
      if (!board) {
        board = document.createElement('div');
        board.className = 'dev-board';
        board.id = 'devBoard';
        scroll.appendChild(board);
      } else if (board.classList.contains('is-parked')) {
        board = document.createElement('div');
        board.className = 'dev-board';
        board.id = 'devBoard';
        scroll.appendChild(board);
      } else {
        var curDi = board.getAttribute('data-dev-di');
        if (curDi != null && Number(curDi) !== di && boardPark[Number(curDi)] && boardPark[Number(curDi)].el === board) {
          demoteBoardEl(board);
          board = document.createElement('div');
          board.className = 'dev-board';
          board.id = 'devBoard';
          scroll.appendChild(board);
        }
      }
      board.innerHTML = '';
      board.id = 'devBoard';
      board.classList.remove('is-parked');
      board.removeAttribute('aria-hidden');
    }
    board.setAttribute('data-dev-di', String(di));

    var maxC = 0;
    var maxR = 0;
    (diagram.pieces || []).forEach(function (p) {
      if (p.col > maxC) maxC = p.col;
      if (p.row > maxR) maxR = p.row;
    });
    (diagram.routes || []).forEach(function (rt) {
      (rt.cells || []).forEach(function (c) {
        if (c.col > maxC) maxC = c.col;
        if (c.row > maxR) maxR = c.row;
      });
    });

    var isUlt = !!(diagram && diagram.ultimate);
    var metrics = layoutMetrics(scroll, maxC, maxR, tabW, { touchPan: touchPan });
    var cell = metrics.cell;
    var pad = metrics.pad || Math.round(metrics.koma * 0.55);
    var padR = (metrics.padR != null) ? metrics.padR : pad;
    var padT = pad;
    var padB = pad;
    var availW = (metrics.availW != null)
      ? metrics.availW
      : Math.max(220, ((scroll.closest && scroll.closest('.dev-board-frame')) || scroll).clientWidth - 4);
    var contentW = (maxC + 1) * cell + padR;
    var regionW = Math.max(160, availW - tabW);
    var extraL = touchPan ? 0 : Math.max(0, Math.floor((regionW - contentW) / 2));
    var padL = tabW + extraL;
    if (!parkOnly) state.cell = cell;
    if (main && !parkOnly) {
      main.style.setProperty('--dev-cell', cell + 'px');
      main.style.setProperty('--dev-koma', metrics.koma + 'px');
      main.style.setProperty('--dev-base', String(metrics.baseFrac || 0.52));
      main.classList.toggle('is-touch-board', touchPan);
    }

    function cellX(col) { return padL + col * cell + cell / 2; }
    function cellY(row) { return padT + row * cell + cell / 2; }

    var w = padL + padR + (maxC + 1) * cell;
    var h = padT + padB + (maxR + 1) * cell;
    board.style.width = w + 'px';
    board.style.height = h + 'px';
    board.style.marginBottom = '';
    board.style.marginRight = '';
    if (availW > 0 && !parkOnly) lastLayoutFrameW = Math.round(availW + 4);
    var frameH = (frameEl && frameEl.clientHeight) || 0;
    var centerY = !touchPan && frameH > 0 && h < frameH - 12;
    if (!parkOnly) {
      scroll.classList.remove('is-board-center');
      scroll.classList.toggle('is-board-center-y', !!centerY);
      scroll.classList.toggle('is-ult-board', !!isUlt);
      scroll.classList.toggle('is-panable', touchPan);
      scroll.classList.remove('is-panning');
      try {
        scroll.scrollLeft = 0;
      } catch (_) {}
      if (!touchPan) {
        board.style.transform = '';
        board.style.transformOrigin = '';
        boardView.key = '';
      }
    }

    var wiresLayer = document.createElement('div');
    wiresLayer.className = 'dev-wires-layer';
    wiresLayer.setAttribute('aria-hidden', 'true');

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'dev-wires');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(h));

    var pieceKeys = Object.create(null);
    var pieceAt = Object.create(null);
    (diagram.pieces || []).forEach(function (p) {
      pieceKeys[p.col + ',' + p.row] = 1;
      pieceAt[p.col + ',' + p.row] = p;
    });
    // Dock to the compact base rim — must stay < ~0.4 cell so short ULT hops don't collapse.
    var basePx = metrics.koma * (metrics.baseFrac || 0.52);
    var dockR = Math.min(cell * 0.36, Math.max(8, basePx * 0.42));
    var draws = routeWireDraws(diagram.routes, cellX, cellY, cell, pieceKeys, dockR, pieceAt);
    var lineSrc = ui().line || '';
    var defs = '';
    /* Skip patterned stroke on touch — extra image paint + blend is costly on phones. */
    if (lineSrc && !touchPan) {
      defs = '<defs><pattern id="devLinePattern" patternUnits="userSpaceOnUse" width="8" height="46">'
        + '<image href="' + String(lineSrc).replace(/"/g, '') + '" x="2" y="0" width="4" height="46" '
        + 'preserveAspectRatio="none"/></pattern></defs>';
    }
    var glow = '';
    var over = '';
    var tex = '';
    var core = '';
    /* CSS comet only (soft + head). No SMIL — dual drivers fought and jerked. */
    draws.forEach(function (draw) {
      if (!draw || !draw.d) return;
      glow += '<path class="dev-wire-glow" d="' + draw.d + '"/>'
        + '<path class="dev-wire-glow-inner" d="' + draw.d + '"/>';
      over += '<path class="dev-wire" d="' + draw.d + '"/>';
      if (lineSrc && !touchPan) tex += '<path class="dev-wire-tex" d="' + draw.d + '"/>';
      core += '<path class="dev-wire-core-soft" d="' + draw.d + '"/>'
        + '<path class="dev-wire-core" d="' + draw.d + '"/>';
    });
    svg.innerHTML = defs + glow + over + tex + core;
    wiresLayer.appendChild(svg);

    board.appendChild(wiresLayer);

    // Tip = UI_Deverop_Route_Arrow_Normal_Posi — own layer above nodes so
    // SSR/UR rings + large ogk never bury the arrow (all rarities).
    var arrowSrc = ui().route_arrow || ui().arrow || '';
    var arrowsLayer = document.createElement('div');
    arrowsLayer.className = 'dev-arrows-layer';
    arrowsLayer.setAttribute('aria-hidden', 'true');
    if (arrowSrc) {
      draws.forEach(function (draw) {
        var a = draw.arrow;
        if (!a) return;
        // Aim from approach → unit cell center; tip sits just outside the base rim.
        var ex = a.endCx != null ? a.endCx : a.x1;
        var ey = a.endCy != null ? a.endCy : a.y1;
        var fx = a.fromX != null ? a.fromX : a.x0;
        var fy = a.fromY != null ? a.fromY : a.y0;
        var dx = ex - fx;
        var dy = ey - fy;
        var dist = Math.hypot(dx, dy) || 1;
        var ux = dx / dist;
        var uy = dy / dist;
        // Barely touching: place arrow center so glyph tip sits on Enable rim (~11px half-icon).
        var gap = Math.max(basePx * 0.5 + 10, 22);
        var ax = ex - ux * gap;
        var ay = ey - uy * gap;
        // Keep arrow on ortho pipe centerline.
        if (Math.abs(dy) <= Math.abs(dx) * 0.25) ay = ey;
        if (Math.abs(dx) <= Math.abs(dy) * 0.25) ax = ex;
        var img = mkImg('dev-route-arrow', arrowSrc);
        img.style.left = ax + 'px';
        img.style.top = ay + 'px';
        img.style.transform = 'translate(-50%,-50%) rotate(' + (Math.atan2(dy, dx) * 180 / Math.PI) + 'deg)';
        arrowsLayer.appendChild(img);
      });
    }
    board.appendChild(arrowsLayer);

    var pack = ui();
    (diagram.pieces || []).forEach(function (p) {
      var unit = p.unit || {};
      var selected = state.selected && String(state.selected) === String(p.id);
      var urStage = Number(unit.ur_stage || 0);
      var unknown = !!unit.unknown;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dev-node'
        + (unit.rarity === 'UR' ? ' is-ur' : '')
        + (urStage === 2 ? ' is-ur2' : '')
        + (urStage === 1 ? ' is-ur1' : '')
        + (unknown ? ' is-unknown' : '')
        + (p.multi ? ' is-multi' : '')
        + (selected ? ' is-selected' : '');
      btn.setAttribute('data-piece-id', String(p.id));
      btn.setAttribute('aria-label', unknown ? '???' : (unit.name || unit.id || 'unit'));
      btn.style.left = cellX(p.col) + 'px';
      btn.style.top = cellY(p.row) + 'px';
      btn.title = unknown ? '???' : (unit.name || '');

      var art = document.createElement('span');
      art.className = 'dev-node-art';

      var rar = rarityKey(unit.rarity);
      var base = document.createElement('span');
      base.className = 'dev-base' + (urStage === 2 ? ' is-ur2' : '');
      if (rar) base.setAttribute('data-rarity', rar);
      // Glow = Enable_Blur only (never Disable_Blur).
      var blurUrl = frameFor('frames_blur', unit.rarity);
      if (blurUrl) base.appendChild(mkImg('dev-base-blur', blurUrl));
      var disk = document.createElement('span');
      disk.className = 'dev-base-disk';
      if (pack.frame_core) disk.appendChild(mkImg('dev-base-core', pack.frame_core));
      // Base plate = rarity Enable (KomaFrame_*_Enable) — never Disable.
      var enableUrl = frameFor('frames', unit.rarity) || pack.frame_none || '';
      if (enableUrl) {
        disk.appendChild(mkImg('dev-base-enable', enableUrl));
      } else {
        disk.classList.add('is-fallback');
      }
      base.appendChild(disk);

      // SSR/UR: Enable_ring sits outside the rarity frame and pulses gently.
      // UR2 (final ULT) gets a second brighter glow layer.
      if (rar === 'UR' && (pack.ur_ring || pack.ring_anim_glow_ur)) {
        var urRing = mkImg('dev-base-rarity-ring is-ur' + (urStage === 2 ? ' is-ur2' : ''), pack.ur_ring || pack.ring_anim_glow_ur);
        base.appendChild(urRing);
        /* Skip second UR2 glow layer on touch — halves animated ring paint on phones. */
        if (!touchPan && urStage === 2 && pack.ring_anim_glow_ur) {
          var urGlow = mkImg('dev-base-rarity-ring is-ur is-ur2-glow', pack.ring_anim_glow_ur);
          base.appendChild(urGlow);
        }
      } else if (rar === 'SSR' && (pack.ssr_ring || pack.ring_anim_glow)) {
        var ssrRing = mkImg('dev-base-rarity-ring is-ssr', pack.ssr_ring || pack.ring_anim_glow);
        base.appendChild(ssrRing);
      }
      art.appendChild(base);

      // Unknowns: Secret_Reward only — never a wrong ogk, never detail popup.
      var komaSrc = unknown
        ? (pack.secret_icon || '')
        : (unit.image || '');
      if (!komaSrc && pack.secret_icon) {
        komaSrc = pack.secret_icon;
        unknown = true;
        btn.classList.add('is-unknown');
      }
      if (komaSrc) {
        var komaImg = mkImg('dev-koma' + (unknown || !unit.image ? ' is-secret' : ''), komaSrc);
        if (touchPan) {
          try { komaImg.loading = 'lazy'; } catch (_) {}
        }
        var ogkScale = Number(unit.ogk_scale);
        if (!unknown && unit.image && ogkScale > 0 && Math.abs(ogkScale - 1) > 0.02) {
          komaImg.style.setProperty('--ogk-norm', String(ogkScale));
        }
        if (!unknown && unit.image) {
          komaImg.onerror = function () {
            var secret = pack.secret_icon || '';
            if (!secret) return;
            komaImg.classList.add('is-secret');
            komaImg.style.removeProperty('--ogk-norm');
            komaImg.src = secret;
            btn.classList.add('is-unknown');
          };
        }
        art.appendChild(komaImg);
      }

      btn.appendChild(art);

      var capturable = !!(p.capturable || (p.capture_stages && p.capture_stages.length));
      if (capturable) btn.classList.add('is-capturable');

      var badges = document.createElement('span');
      badges.className = 'dev-badges';
      var badgeRow = document.createElement('span');
      badgeRow.className = 'dev-badges-row';
      if (!unknown && unit.rarity_icon) badgeRow.appendChild(mkImg('dev-badge', unit.rarity_icon));
      if (!unknown && unit.role_icon) badgeRow.appendChild(mkImg('dev-badge', unit.role_icon));
      if (badgeRow.childNodes.length) badges.appendChild(badgeRow);
      if (capturable) {
        badges.appendChild(mkCaptureIcon(pack.capture_legend || pack.capture_title || 'Capturable Unit'));
      }
      if (badges.childNodes.length) btn.appendChild(badges);

      function goUnitPage() {
        openUnitDetailPage(unit);
      }
      function openCaptureOrClear() {
        if (capturable) {
          showPieceDetail(p, {
            pin: true,
            mode: hoverCapable ? 'anchor' : 'dock',
            anchorEl: btn,
          });
          state.selected = p.id;
          return;
        }
        clearSelection();
      }
      if (unknown && !capturable) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          clearSelection();
        });
      } else if (unknown && capturable) {
        /* Secret node that is still capturable — show stage list, keep identity hidden. */
        if (hoverCapable) {
          btn.addEventListener('pointerenter', function () {
            if (state.selected != null) return;
            cancelHoverClear();
            showPieceDetail(p, {
              pin: false,
              mode: 'anchor',
              anchorEl: btn,
            });
          });
          btn.addEventListener('pointerleave', function () {
            scheduleHoverClear();
          });
          btn.addEventListener('wheel', forwardWheelToDetail, { passive: false });
        }
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          openCaptureOrClear();
        });
      } else if (hoverCapable) {
        btn.addEventListener('pointerenter', function () {
          if (state.selected != null) return;
          cancelHoverClear();
          /* Anchor (not cursor-follow) so the card stays put and can be scrolled / entered. */
          showPieceDetail(p, {
            pin: false,
            mode: 'anchor',
            anchorEl: btn,
          });
        });
        btn.addEventListener('pointerleave', function () {
          scheduleHoverClear();
        });
        btn.addEventListener('wheel', forwardWheelToDetail, { passive: false });
        btn.addEventListener('focus', function () {
          if (state.selected != null) return;
          cancelHoverClear();
          showPieceDetail(p, { pin: false, mode: 'anchor', anchorEl: btn });
        });
        btn.addEventListener('blur', function () {
          scheduleHoverClear();
        });
        // Desktop: hover = develop mats; click ogk → unit detail page.
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          goUnitPage();
        });
      } else {
        /*
          Touch: 1st tap = pin + develop materials (floating; board stays tappable);
          2nd tap on the same ogk = unit detail page (thum does the same).
          Avoid full-screen sheet/backdrop — it ate the second ogk tap.
        */
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          if (state.selected != null && String(state.selected) === String(p.id)) {
            goUnitPage();
            return;
          }
          showPieceDetail(p, {
            pin: true,
            mode: 'dock',
            anchorEl: btn,
          });
        });
      }
      board.appendChild(btn);
    });

    boardPark[di] = {
      el: board,
      cell: cell,
      koma: metrics.koma,
      baseFrac: metrics.baseFrac || 0.52,
      w: w,
      h: h,
      centerY: !!centerY,
      isUlt: !!isUlt,
      touchPan: !!touchPan,
    };

    if (parkOnly) {
      demoteBoardEl(board);
      return;
    }

    var sel = null;
    if (state.selected) sel = pieceById(diagram, state.selected);
    if (sel) {
      var selBtn = board.querySelector('.dev-node[data-piece-id="' + String(sel.id) + '"]');
      renderDetail(diagram, sel, hoverCapable
        ? { mode: 'cursor', anchorEl: selBtn }
        : { pin: true, mode: 'dock', anchorEl: selBtn });
    } else {
      renderDetail(diagram, null);
    }
    clearDevelopScrollExperiments();

    if (touchPan) {
      panMetrics = { w: w, h: h };
      var viewKey = seriesId + ':' + state.diagram + ':' + w + 'x' + h;
      if (boardView.key !== viewKey) {
        boardView.key = viewKey;
        resetBoardView(scroll, w, h);
      } else {
        clampBoardView(scroll.clientWidth || 0, scroll.clientHeight || 0, w, h);
      }
      applyBoardView(board);
      ensureBoardGestures(scroll);
    }
    if (!skipWarm) scheduleWarmSiblingBoards();
  }

  function diagramTabBannerUrl(diagram, ordinal) {
    var pack = ui() || {};
    if (diagram && diagram.ultimate) {
      return pack.tab_banner_ult || '';
    }
    var list = pack.tab_banners || [];
    if (!list.length) return '';
    var idx = Math.max(0, Math.min(list.length - 1, ordinal | 0));
    return list[idx] || list[0] || '';
  }

  function preferImgUrl(src) {
    if (!src) return '';
    try {
      if (typeof window.imgUrlPreferCdn === 'function') return window.imgUrlPreferCdn(src) || src;
      if (typeof window.imgUrl === 'function') return window.imgUrl(src) || src;
    } catch (_) {}
    return src;
  }

  /**
   * Split official diagram titles so the faction line sits on its own row.
   * LANG uses a newline before [Faction] / 【陣營】 (EN/HR vs JA/TW/HK).
   */
  function splitDiagramTabLabel(label) {
    var raw = String(label || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    var nl = raw.indexOf('\n');
    if (nl >= 0) {
      return {
        main: raw.slice(0, nl).replace(/\s+/g, ' ').trim(),
        sub: raw.slice(nl + 1).replace(/\s+/g, ' ').trim(),
      };
    }
    var m = raw.match(/^(.*?)(\[[^\]]*\]|【[^】]*】)\s*$/);
    if (!m) return { main: raw, sub: '' };
    return { main: String(m[1] || '').trim(), sub: String(m[2] || '').trim() };
  }

  function applySeriesChrome(pack) {
    pack = pack || {};
    var seriesTitle = pack.series_title || '';
    var seriesSearch = pack.series_search || '';
    var lbl = $('devSeriesLbl');
    var title = $('devSeriesPanelTitle');
    var search = $('devSeriesSearch');
    var grid = $('devSeriesGrid');
    if (seriesTitle) {
      if (lbl) lbl.textContent = seriesTitle;
      if (title) title.textContent = seriesTitle;
      if (grid) grid.setAttribute('aria-label', seriesTitle);
    }
    if (search && seriesSearch) {
      search.placeholder = seriesSearch;
      var wrap = search.closest('label');
      var hidden = wrap && wrap.querySelector('.visually-hidden');
      if (hidden) hidden.textContent = seriesSearch;
    }
  }

  function fillDiagramTabLabel(span, label) {
    var parts = splitDiagramTabLabel(label);
    span.textContent = '';
    var main = document.createElement('span');
    main.className = 'dev-diagram-tab-main';
    main.textContent = parts.main || label;
    span.appendChild(main);
    if (parts.sub) {
      var sub = document.createElement('span');
      sub.className = 'dev-diagram-tab-sub';
      sub.textContent = parts.sub;
      span.appendChild(sub);
    }
  }

  function ensureDiagramBar() {
    var host = $('devDiagramBar');
    if (host) return host;
    var frame = document.querySelector('#panel-develop .dev-board-frame') || document.querySelector('.dev-board-frame');
    if (!frame) return null;
    host = document.createElement('div');
    host.className = 'dev-diagram-float';
    host.id = 'devDiagramBar';
    frame.insertBefore(host, frame.firstChild);
    return host;
  }

  function renderTabs() {
    // Always show faction/diagram tab chrome (even for a single diagram).
    var legacy = $('devTabs');
    if (legacy) {
      legacy.innerHTML = '';
      legacy.hidden = true;
      legacy.setAttribute('hidden', '');
    }
    var host = ensureDiagramBar();
    if (!host) return;
    host.innerHTML = '';
    var map = state.map || {};
    var diagrams = map.diagrams || [];
    var row = seriesById(map.series_id || seriesId);
    var logo = preferImgUrl((map && map.logo) || (row && row.logo) || '');
    var pack = ui() || {};
    var tab0 = preferImgUrl((pack.tab_banners && pack.tab_banners[0]) || '');

    if (!diagrams.length) {
      host.hidden = true;
      host.setAttribute('hidden', '');
      return;
    }

    host.hidden = false;
    host.removeAttribute('hidden');
    host.setAttribute('aria-hidden', 'false');
    /* Width from CSS (218 desktop / ~108–118 mobile) — do not inline-lock 218. */
    host.style.removeProperty('width');
    host.style.removeProperty('max-width');
    host.style.boxSizing = 'border-box';
    host.classList.toggle('is-compact', isTouchBoard());

    var tabs = document.createElement('div');
    tabs.className = 'dev-diagram-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Diagram');
    tabs.style.width = '100%';
    var normalOrd = 0;
    var factionCount = 0;
    diagrams.forEach(function (d) {
      if (!(d && d.ultimate)) factionCount += 1;
    });
    /* In-game: multi-faction trees = words on every tab; single-faction = logo on
       the normal tab(s), words on Ultimate. */
    var multiFaction = factionCount > 1;
    diagrams.forEach(function (d, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dev-diagram-tab' + (i === state.diagram ? ' is-active' : '');
      if (d && d.ultimate) btn.classList.add('is-ult');
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === state.diagram ? 'true' : 'false');
      btn.dataset.diagramIndex = String(i);
      var label = (d && (d.name || d.id)) || ('Diagram ' + (i + 1));
      btn.title = label;
      /* Size from CSS (desktop 83 / mobile compact) — do not inline-lock height. */
      btn.style.width = '100%';
      btn.style.boxSizing = 'border-box';
      var isUltTab = !!(d && d.ultimate);
      var banner = preferImgUrl(diagramTabBannerUrl(d, isUltTab ? 0 : normalOrd));
      if (!isUltTab) normalOrd += 1;
      if (banner) {
        btn.style.setProperty('--dev-tab-banner', 'url("' + String(banner).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")');
      }
      /* Plate carries banner + clip; ::before behind it = chamfer border rim */
      var plate = document.createElement('span');
      plate.className = 'dev-diagram-tab-plate';
      plate.setAttribute('aria-hidden', 'true');
      btn.appendChild(plate);
      var useLogo = !!(logo && !multiFaction && !isUltTab);
      if (useLogo) {
        btn.classList.add('has-series-logo', 'is-logo-plate');
        var logoImg = document.createElement('img');
        logoImg.className = 'dev-diagram-tab-logo';
        logoImg.alt = '';
        logoImg.decoding = 'async';
        logoImg.draggable = false;
        logoImg.src = logo;
        btn.appendChild(logoImg);
      }
      var span = document.createElement('span');
      span.className = 'dev-diagram-tab-label';
      fillDiagramTabLabel(span, label);
      btn.appendChild(span);
      btn.addEventListener('click', function () {
        if (state.diagram === i) return;
        switchToDiagram(i);
      });
      tabs.appendChild(btn);
    });
    host.appendChild(tabs);
  }

  function syncDiagramTabActive() {
    var host = $('devDiagramBar');
    if (!host) return;
    var tabs = host.querySelectorAll('.dev-diagram-tab');
    var di = state.diagram | 0;
    tabs.forEach(function (btn, i) {
      var on = i === di;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function switchToDiagram(i) {
    var diagrams = (state.map && state.map.diagrams) || [];
    if (i < 0 || i >= diagrams.length || i === state.diagram) return;
    var cur = $('devBoard');
    var curDi = state.diagram | 0;
    if (cur && cur.getAttribute('data-dev-di') != null) {
      if (!boardPark[curDi] || boardPark[curDi].el !== cur) {
        boardPark[curDi] = boardPark[curDi] || {
          el: cur,
          cell: state.cell,
          koma: null,
          baseFrac: 0.52,
          w: panMetrics.w || 0,
          h: panMetrics.h || 0,
          centerY: !!( $('devScroll') && $('devScroll').classList.contains('is-board-center-y') ),
          isUlt: !!( $('devScroll') && $('devScroll').classList.contains('is-ult-board') ),
          touchPan: isTouchBoard(),
        };
        boardPark[curDi].el = cur;
      }
      demoteBoardEl(cur);
    }
    state.diagram = i;
    state.selected = null;
    persistDevelopView();
    syncDiagramTabActive();
    renderBoard();
  }

  function seriesById(id) {
    var list = state.series || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i];
    }
    return null;
  }

  function mkBannerImg(cls, src) {
    var img = document.createElement('img');
    img.className = cls;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    // Panel opens from off-screen (translateY); lazy often never fires → blank cards.
    img.loading = 'eager';
    img.src = src;
    return img;
  }

  function buildSeriesBannerEl(row, compact) {
    var wrap = document.createElement('span');
    wrap.className = 'dev-series-banner';
    var kind = (row && row.banner_kind) || 'logo';
    var logoSrc = (row && row.logo) || '';
    if (kind === 'story' && row.banner) {
      wrap.classList.add('is-story');
      wrap.appendChild(mkBannerImg('dev-series-banner-full', row.banner));
      return wrap;
    }
    if ((kind === 'composite' || kind === 'logo') && (row.banner_base || row.banner_unit || logoSrc)) {
      if (row.banner_base || row.banner_unit) {
        wrap.classList.add('is-composite');
        if (row.banner_base) {
          wrap.appendChild(mkBannerImg('dev-series-banner-base', row.banner_base));
        }
        if (row.banner_unit) {
          wrap.appendChild(mkBannerImg('dev-series-banner-unit', row.banner_unit));
        }
      } else {
        wrap.classList.add('is-logo-only');
      }
      if (logoSrc) {
        wrap.appendChild(mkBannerImg('dev-series-banner-logo', logoSrc));
      }
      return wrap;
    }
    wrap.classList.add('is-logo-only');
    if (logoSrc) {
      wrap.appendChild(mkBannerImg('dev-series-banner-logo', logoSrc));
    }
    return wrap;
  }

  function syncSeriesBtn() {
    var row = seriesById(seriesId);
    var art = $('devSeriesBtnArt');
    var nameEl = $('devSeriesBtnName');
    var countEl = $('devSeriesBtnCount');
    var titleName = (state.map && state.map.series_name) || (row && row.name) || seriesId;
    if (nameEl) nameEl.textContent = titleName;
    if (countEl) {
      var n = row && row.diagrams != null ? row.diagrams : '';
      countEl.textContent = n !== '' ? (n + ' diagram' + (n === 1 ? '' : 's')) : '';
    }
    if (art) {
      art.innerHTML = '';
      if (row) art.appendChild(buildSeriesBannerEl(row, true));
    }
  }

  function seriesQueryMatch(row, q) {
    if (!q) return true;
    var hay = ((row.name || '') + ' ' + (row.id || '')).toLowerCase();
    return hay.indexOf(q) >= 0;
  }

  function renderSeriesGrid(filterText) {
    var host = $('devSeriesGrid');
    if (!host) return;
    host.innerHTML = '';
    var q = String(filterText || '').trim().toLowerCase();
    var shown = 0;
    (state.series || []).forEach(function (s) {
      if (!seriesQueryMatch(s, q)) return;
      shown += 1;
      var card = document.createElement('button');
      card.type = 'button';
      var kind = String(s.banner_kind || 'logo');
      card.className = 'dev-series-card'
        + (kind === 'story' ? ' is-story' : '')
        + (kind === 'composite' || kind === 'logo' ? ' is-composite' : '')
        + (String(s.id) === String(seriesId) ? ' is-active' : '');
      card.setAttribute('role', 'option');
      card.setAttribute('aria-selected', String(s.id) === String(seriesId) ? 'true' : 'false');
      card.dataset.seriesId = String(s.id);
      card.setAttribute('aria-label', s.name || String(s.id));
      card.title = s.name || String(s.id);
      var art = document.createElement('span');
      art.className = 'dev-series-card-art';
      art.appendChild(buildSeriesBannerEl(s, false));
      card.appendChild(art);
      card.addEventListener('click', function () {
        closeSeriesPanel();
        if (String(s.id) === String(seriesId)) {
          persistDevelopView();
          return;
        }
        loadSeries(s.id, true);
      });
      host.appendChild(card);
    });
    /* Native reflow: denser / roomier grid from filter hit count. */
    host.dataset.resultCount = String(shown);
    host.classList.toggle('is-filtered', !!q);
    host.classList.toggle('is-sparse', shown > 0 && shown <= 8);
  }

  function resetSeriesGridScroll() {
    var grid = $('devSeriesGrid');
    if (grid) grid.scrollTop = 0;
    var card = document.querySelector('#devSeriesPanel .dev-series-panel-card');
    if (card) card.scrollTop = 0;
  }

  function openSeriesPanel() {
    var panel = $('devSeriesPanel');
    var btn = $('devSeriesBtn');
    var search = $('devSeriesSearch');
    if (!panel) return;
    try {
      if (document.body) document.body.classList.add('dev-series-panel-open');
    } catch (_) {}
    panel.hidden = false;
    panel.removeAttribute('hidden');
    panel.setAttribute('aria-hidden', 'false');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (search) search.value = '';
    renderSeriesGrid('');
    resetSeriesGridScroll();
    requestAnimationFrame(function () {
      panel.classList.add('is-open');
      resetSeriesGridScroll();
      if (search) {
        try { search.focus({ preventScroll: true }); } catch (_) {
          try { search.focus(); } catch (_) {}
        }
      }
      requestAnimationFrame(resetSeriesGridScroll);
    });
  }

  function closeSeriesPanel() {
    var panel = $('devSeriesPanel');
    var btn = $('devSeriesBtn');
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    try {
      if (document.body) document.body.classList.remove('dev-series-panel-open');
    } catch (_) {}
    persistDevelopView();
    window.setTimeout(function () {
      if (!panel.classList.contains('is-open')) {
        panel.hidden = true;
        panel.setAttribute('hidden', '');
      }
    }, 340);
  }

  function bindSeriesPicker() {
    var btn = $('devSeriesBtn');
    var panel = $('devSeriesPanel');
    var backdrop = $('devSeriesPanelBackdrop');
    var closeBtn = $('devSeriesPanelClose');
    var search = $('devSeriesSearch');
    if (btn) {
      btn.addEventListener('click', function () {
        if (panel && !panel.hidden && panel.classList.contains('is-open')) closeSeriesPanel();
        else openSeriesPanel();
      });
    }
    if (backdrop) backdrop.addEventListener('click', closeSeriesPanel);
    if (closeBtn) closeBtn.addEventListener('click', closeSeriesPanel);
    if (search) {
      search.addEventListener('input', function () {
        renderSeriesGrid(search.value);
        resetSeriesGridScroll();
        requestAnimationFrame(resetSeriesGridScroll);
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (panel && !panel.hidden) {
          closeSeriesPanel();
          e.preventDefault();
          return;
        }
        if (state.selected != null) {
          clearSelection();
          e.preventDefault();
        }
      }
    });
  }

  function applyMap(map) {
    clearBoardPark();
    state.map = map;
    var diagrams = (map && map.diagrams) || [];
    var restored = recallDiagramIndex(map && map.series_id);
    state.diagram = Math.max(0, Math.min(restored, Math.max(diagrams.length - 1, 0)));
    state.selected = null;
    closeUnitSheet();
    applySeriesChrome(map && map.ui);
    $('devKicker').textContent = map.title || 'Development Diagram';
    var resolvedName = String((map && map.series_name) || '').trim();
    if (resolvedName && resolvedName !== String(map.series_id || '')) {
      var row = seriesById(map.series_id);
      if (row) row.name = resolvedName;
    }
    $('devSeriesName').textContent = resolvedName || map.series_id;
    document.title = (map.title || 'Development Diagram') + ' — ' + (resolvedName || map.series_id || '');
    var logo = $('devLogo');
    if (map.logo) {
      logo.hidden = false;
      logo.src = map.logo;
    } else {
      logo.hidden = true;
    }
    if (map && map.series_id) seriesId = String(map.series_id);
    persistDevelopView();
    syncSeriesBtn();
    syncCaptureLegend();
    applyBoardChrome();
    renderTabs();
    renderBoard();
    try {
      if (window.GgenNavTabsAutoHide && typeof window.GgenNavTabsAutoHide.syncDevelop === 'function') {
        window.GgenNavTabsAutoHide.syncDevelop();
      }
    } catch (_) {}
  }

  function pushDevelopPath(sid) {
    var path = '/develop/' + encodeURIComponent(String(sid || seriesId || '4000'));
    if (typeof window.pushHistoryToBrowsePath === 'function') {
      try {
        window.pushHistoryToBrowsePath(path);
        return;
      } catch (_) {}
    }
    if (history && history.pushState) {
      history.pushState({ series: String(sid || seriesId) }, '', path);
    }
  }

  function loadSeries(id, push) {
    seriesId = String(id || '4000');
    if (push) pushDevelopPath(seriesId);
    var cached = mapCache[mapCacheKey(seriesId)];
    if (cached) {
      applyMap(cached);
      return Promise.resolve(cached);
    }
    return api('/api/develop/' + encodeURIComponent(seriesId)).then(function (map) {
      rememberMap(seriesId, map);
      applyMap(map);
      return map;
    });
  }

  var resizeTimer = 0;
  var lastLayoutFrameW = 0;
  function onResize(force) {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!state.map) return;
      /*
        Only rebuild when the frame WIDTH changes. Nav-tab collapse on scroll
        toggles body class / vertical chrome — that used to re-render the board
        and restart every route-line animation (felt like jerking on mobile).
      */
      var frame = document.querySelector('#panel-develop .dev-board-frame')
        || document.querySelector('.dev-board-frame');
      var w = frame ? Math.round(frame.clientWidth || 0) : 0;
      if (!force && w > 0 && Math.abs(w - lastLayoutFrameW) < 2) {
        /* Height-only (nav collapse): re-clamp pan, do not rebuild wires. */
        if (isTouchBoard()) {
          var sc = $('devScroll');
          var bd = $('devBoard');
          if (sc && bd && sc.classList.contains('is-panable') && panMetrics.w) {
            clampBoardView(sc.clientWidth || 0, sc.clientHeight || 0, panMetrics.w, panMetrics.h);
            applyBoardView(bd);
          }
        }
        return;
      }
      if (w > 0) lastLayoutFrameW = w;
      /* Width change invalidates cell layout — drop parked boards and rebuild. */
      clearBoardPark();
      renderBoard({ force: true });
    }, 160);
  }

  var pickerBound = false;
  var resizeBound = false;
  var headerChromeBound = false;
  var panelObserver = null;
  var frameRo = null;
  var booted = false;

  function isDevelopActive() {
    var pan = $('panel-develop');
    if (pan) return pan.classList.contains('active');
    return !!document.body && document.body.classList.contains('dev-page');
  }

  function clearDevelopHeaderChrome() {
    clearDevelopScrollExperiments();
  }

  function ensureChromeBound() {
    if (!resizeBound) {
      resizeBound = true;
      window.addEventListener('resize', function () {
        onResize(false);
      });
      try {
        window.addEventListener('orientationchange', function () {
          onResize(true);
        });
      } catch (_) {}
      /* Width-only reflow — ignore nav collapse / height chrome while scrolling. */
      try {
        if (typeof ResizeObserver === 'function') {
          frameRo = new ResizeObserver(function (entries) {
            if (!isDevelopActive() || !state.map) return;
            var entry = entries && entries[0];
            var w = entry && entry.contentRect ? Math.round(entry.contentRect.width) : 0;
            if (w > 0 && Math.abs(w - lastLayoutFrameW) < 2) return;
            onResize(false);
          });
          var frame = document.querySelector('#panel-develop .dev-board-frame')
            || document.querySelector('.dev-board-frame');
          if (frame) frameRo.observe(frame);
        }
      } catch (_) {}
    }
    if (!pickerBound) {
      pickerBound = true;
      bindSeriesPicker();
    }
    if (!headerChromeBound) {
      headerChromeBound = true;
      clearDevelopScrollExperiments();
    }
  }

  function boot(opts) {
    opts = opts || {};
    ensureChromeBound();
    clearDevelopScrollExperiments();
    var pathMatch = String(location.pathname || '').match(/\/develop\/([^/]+)/);
    var pathSeries = pathMatch && pathMatch[1] ? String(pathMatch[1]) : '';
    var remembered = recallSeriesId();
    /* Prefer: explicit opts → URL → last viewed → server default. */
    if (opts.seriesId) seriesId = String(opts.seriesId);
    else if (pathSeries) seriesId = pathSeries;
    else if (remembered) seriesId = remembered;
    else if (window.__DEV_SERIES__) seriesId = String(window.__DEV_SERIES__);
    /*
      Series picker: only on a true first visit (no URL series, no memory),
      or when caller forces it. Returning to /develop restores the last tree.
    */
    var openPicker = false;
    if (opts.openSeriesPanel === true) openPicker = true;
    else if (opts.openSeriesPanel === false) openPicker = false;
    else openPicker = !(pathSeries || remembered || opts.seriesId);
    var needSeriesList = !(state.series && state.series.length);
    var p = needSeriesList
      ? api('/api/develop/series').then(function (pack) {
          state.series = pack.series || [];
          applySeriesChrome(pack);
          if (pack.title) {
            var kick = $('devKicker');
            if (kick && !String(kick.textContent || '').trim()) kick.textContent = pack.title;
          }
          syncSeriesBtn();
        })
      : Promise.resolve();
    return p.then(function () {
      syncSeriesBtn();
      return loadSeries(seriesId, false);
    }).then(function () {
      booted = true;
      requestAnimationFrame(function () {
        clearDevelopScrollExperiments();
        onResize(true);
        if (openPicker) openSeriesPanel();
        else closeSeriesPanel();
      });
    }).catch(function (err) {
      var el = $('devSeriesName');
      if (el) el.textContent = 'Failed to load (' + (err && err.message ? err.message : err) + ')';
    });
  }

  window.GgenDevelop = {
    onTabShown: function (opts) {
      clearDevelopScrollExperiments();
      return boot(opts || {}).then(function () {
        requestAnimationFrame(function () {
          clearDevelopScrollExperiments();
          onResize(true);
        });
      });
    },
    onTabHidden: function () {
      clearDevelopScrollExperiments();
    },
    applySeries: function (sid) {
      if (!sid) return boot();
      seriesId = String(sid);
      if (!booted) return boot({ seriesId: sid });
      return loadSeries(sid, false);
    },
    syncHeaderChrome: clearDevelopScrollExperiments,
    _ready: false,
  };

  // Standalone /develop.html only (no SPA panel).
  var embedded = !!document.getElementById('panel-develop');
  if (!embedded) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(); });
    else boot();
  }
})();
