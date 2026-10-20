/** Auto-hide #navTabsShell on scroll-down; reveal after a strong scroll-up. Brand row stays
 *  (except /collections mobile, which also hides brand + intro — see pinnedCollapsed). */
(function (global) {
  var ignoreUntil = 0;
  var inited = false;
  /* Collections: collapsing tall intro drops scrollY into TOP_SHOW → hide↔reveal loop.
     Keep collapsed until user leaves the synthetic top or shows upward intent. */
  var pinnedCollapsed = false;

  function isMatrixBoardPage() {
    var b = document.body;
    return !!(b && (b.classList.contains('tm-page') || b.classList.contains('dm-page')));
  }

  function isCollectionsPage() {
    return !!(document.body && document.body.classList.contains('collections-page'));
  }

  function thresholds() {
    var shortLandscape = false;
    try {
      shortLandscape = global.matchMedia('(orientation: landscape) and (max-height: 520px)').matches;
    } catch (_) {}
    /* Collections: intro/disclaimer only on aggressive scroll-up (or true top).
       Possession % uses a separate compact sticky bar in collections.js. */
    var col = isCollectionsPage();
    if (shortLandscape) {
      return { HIDE_AFTER: 4, REVEAL_UP: col ? 260 : 220, TOP_SHOW: 16 };
    }
    return { HIDE_AFTER: 10, REVEAL_UP: col ? 480 : 400, TOP_SHOW: 40 };
  }

  function pageScrollY() {
    var w = global.scrollY || 0;
    var d = document.documentElement ? document.documentElement.scrollTop : 0;
    var b = document.body ? document.body.scrollTop : 0;
    var vv = 0;
    try {
      if (global.visualViewport) vv = global.visualViewport.pageTop || 0;
    } catch (_) {}
    return Math.max(w, d, b, vv) || 0;
  }

  function setNavTabsCollapsed(collapsed) {
    /* /tm and /dm use their own board-scroll chrome hide */
    if (isMatrixBoardPage()) return;
    var want = !!collapsed;
    if (document.body.classList.contains('nav-tabs-collapsed') === want) return;
    var y = pageScrollY();
    var t = thresholds();
    document.body.classList.toggle('nav-tabs-collapsed', want);
    /* Height snaps instantly; opacity fades up to 600ms on collections — ignore layout noise */
    ignoreUntil = Date.now() + (isCollectionsPage() ? 700 : 320);
    try {
      if (global.S) global.S._navTabsScrollIgnoreUntil = ignoreUntil;
    } catch (_) {}
    if (want && isCollectionsPage() && y > t.TOP_SHOW) {
      pinnedCollapsed = true;
    }
    if (!want) pinnedCollapsed = false;
    if (typeof global.scheduleSyncListTheadStickyTop === 'function') {
      global.scheduleSyncListTheadStickyTop();
      requestAnimationFrame(function () {
        global.scheduleSyncListTheadStickyTop();
        setTimeout(global.scheduleSyncListTheadStickyTop, 120);
      });
    }
  }

  function initNavTabsAutoHide() {
    if (inited) return;
    inited = true;
    if (!document.getElementById('navTabs') || isMatrixBoardPage()) return;

    var lastY = pageScrollY();
    var upAccum = 0;
    var touchY0 = null;

    function locked() {
      return (
        document.documentElement.classList.contains('page-scroll-lock') ||
        document.body.classList.contains('detail-modal-open') ||
        document.body.classList.contains('search-spotlight-open') ||
        document.body.classList.contains('gacha-sim-stage-open') ||
        (ignoreUntil && Date.now() < ignoreUntil)
      );
    }

    function onScroll() {
      var y = pageScrollY();
      if (locked()) {
        lastY = y;
        return;
      }
      var dy = y - lastY;
      lastY = y;
      var t = thresholds();
      if (y > t.TOP_SHOW + 64) pinnedCollapsed = false;
      if (y <= t.TOP_SHOW) {
        upAccum = 0;
        /* Synthetic top after tall chrome hide — do not auto-reveal (loop) */
        if (pinnedCollapsed) {
          if (dy < -10) {
            pinnedCollapsed = false;
            setNavTabsCollapsed(false);
          }
          return;
        }
        setNavTabsCollapsed(false);
        return;
      }
      if (dy > 0) {
        upAccum = 0;
        if (dy >= t.HIDE_AFTER || y > t.TOP_SHOW + 24) setNavTabsCollapsed(true);
        return;
      }
      if (dy < 0) {
        upAccum += -dy;
        if (upAccum >= t.REVEAL_UP) {
          upAccum = 0;
          pinnedCollapsed = false;
          setNavTabsCollapsed(false);
        }
      }
    }

    global.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    try {
      if (global.visualViewport) {
        global.visualViewport.addEventListener('scroll', onScroll, { passive: true });
        global.visualViewport.addEventListener('resize', onScroll, { passive: true });
      }
    } catch (_) {}
    global.addEventListener(
      'touchstart',
      function (ev) {
        try {
          touchY0 = ev.touches && ev.touches[0] ? ev.touches[0].clientY : null;
        } catch (_) {
          touchY0 = null;
        }
      },
      { passive: true }
    );
    global.addEventListener(
      'touchmove',
      function (ev) {
        if (touchY0 == null || locked()) return;
        var cy = null;
        try {
          cy = ev.touches && ev.touches[0] ? ev.touches[0].clientY : null;
        } catch (_) {}
        if (cy == null) return;
        var fingerUp = touchY0 - cy;
        var y = pageScrollY();
        var t = thresholds();
        if (fingerUp > 12 && y > t.TOP_SHOW) {
          upAccum = 0;
          setNavTabsCollapsed(true);
          touchY0 = cy;
        } else if (fingerUp < -28) {
          if (pinnedCollapsed && y <= t.TOP_SHOW + 8) {
            upAccum = 0;
            pinnedCollapsed = false;
            setNavTabsCollapsed(false);
          }
          touchY0 = cy;
        }
      },
      { passive: true }
    );
    global.addEventListener(
      'touchend',
      function () {
        touchY0 = null;
      },
      { passive: true }
    );
    global.addEventListener(
      'orientationchange',
      function () {
        upAccum = 0;
        pinnedCollapsed = false;
        setNavTabsCollapsed(false);
      },
      { passive: true }
    );
  }

  global.GgenNavTabsAutoHide = {
    init: initNavTabsAutoHide,
    setCollapsed: setNavTabsCollapsed,
  };
  global.setNavTabsCollapsed = setNavTabsCollapsed;
  global.initNavTabsAutoHide = initNavTabsAutoHide;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavTabsAutoHide);
  } else {
    initNavTabsAutoHide();
  }
})(window);
