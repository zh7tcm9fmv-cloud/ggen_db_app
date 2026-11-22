/** Auto-hide #navTabsShell on scroll-down; reveal after a strong scroll-up. Brand row stays
 *  except /collections mobile (brand + intro) and MLS battle focus (brand via CSS) —
 *  see pinnedCollapsed. */
(function (global) {
  var ignoreUntil = 0;
  var inited = false;
  /* Collections: collapsing tall intro drops scrollY into TOP_SHOW → hide↔reveal loop.
     Keep collapsed until user leaves the synthetic top or shows upward intent. */
  var pinnedCollapsed = false;
  var lastY = 0;
  var upAccum = 0;
  /** Snapshot of .nav-tabs-collapsed before detail/spotlight overlay; restored on close. */
  var overlayCollapsedSnap = null;
  /** True from prepareUnlock until settle — blocks auto-hide + CSS transition flicker. */
  var overlayUnlockFreeze = false;
  var overlayUnlockSettleTimer = null;

  function isMatrixBoardPage() {
    var b = document.body;
    return !!(b && (b.classList.contains('tm-page') || b.classList.contains('dm-page')));
  }

  function isCollectionsPage() {
    return !!(document.body && document.body.classList.contains('collections-page'));
  }

  /** MLS battle map: collapse on Open battle map; keep pinned through scroll-into-view. */
  function isMlsBattleFocus() {
    return !!(document.body && document.body.classList.contains('mls-battle-focus'));
  }

  function thresholds() {
    var shortLandscape = false;
    try {
      shortLandscape = global.matchMedia('(orientation: landscape) and (max-height: 520px)').matches;
    } catch (_) {}
    /* Once collapsed, only aggressive scroll-up (or absolute page top) reveals —
       small trackpad/inertia upward must not flash the tab bar (layout jank). */
    var col = isCollectionsPage();
    if (shortLandscape) {
      return { HIDE_AFTER: 4, REVEAL_UP: col ? 320 : 280, TOP_SHOW: 16 };
    }
    /* ~480px upward flick; collections stay pickier. */
    return { HIDE_AFTER: 10, REVEAL_UP: col ? 520 : 480, TOP_SHOW: 40 };
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

  function bumpIgnore(ms) {
    ignoreUntil = Date.now() + (ms || 320);
    try {
      if (global.S) global.S._navTabsScrollIgnoreUntil = ignoreUntil;
    } catch (_) {}
  }

  function setOverlayFreezeClass(on) {
    try {
      if (!document.body) return;
      document.body.classList.toggle('nav-tabs-overlay-freeze', !!on);
    } catch (_) {}
  }

  /** Phone portrait chrome stays put — collapsing the tab bar shifts the page on Android. */
  function keepNavStatic() {
    try {
      return global.matchMedia('(max-width: 820px)').matches;
    } catch (_) {
      return false;
    }
  }

  /** Narrow phones: hide Special/Classic/calendar row on scroll-down (support chips stay). */
  function setHeader15Collapsed(collapsed) {
    if (!keepNavStatic()) {
      try {
        if (document.body) document.body.classList.remove('header-15-collapsed');
      } catch (_) {}
      return;
    }
    if (isMatrixBoardPage()) return;
    if (overlayUnlockFreeze) return;
    try {
      if (!document.body) return;
      document.body.classList.toggle('header-15-collapsed', !!collapsed);
    } catch (_) {}
  }

  function setNavTabsCollapsed(collapsed) {
    /* /tm and /dm use their own board-scroll chrome hide */
    if (isMatrixBoardPage()) return;
    if (keepNavStatic()) collapsed = false;
    /* /develop: hide tabs on scroll-down (board is page-scrolled; no snap lock). */
    if (overlayUnlockFreeze) return;
    var want = !!collapsed;
    var already = document.body.classList.contains('nav-tabs-collapsed') === want;
    var y = pageScrollY();
    var t = thresholds();
    var mls = isMlsBattleFocus();
    var col = isCollectionsPage();
    if (!already) {
      document.body.classList.toggle('nav-tabs-collapsed', want);
      /* Height snaps instantly; opacity fades — ignore layout / inertia noise longer. */
      bumpIgnore(col ? 700 : mls ? 900 : 520);
    }
    /* Pin whenever collapsed so only aggressive upward (or absolute top) can reveal. */
    if (want) pinnedCollapsed = true;
    if (!want) pinnedCollapsed = false;
    /*
     * MLS: after Open-battle settle, if we are still at page top (cannot scroll
     * further up), expand chrome — otherwise nav stays stuck collapsed at y≈0.
     */
    if (want && mls) {
      setTimeout(function () {
        try {
          if (!isMlsBattleFocus() || !pinnedCollapsed) return;
          var tt = thresholds();
          if (pageScrollY() <= tt.TOP_SHOW) {
            pinnedCollapsed = false;
            if (document.body.classList.contains('nav-tabs-collapsed')) {
              document.body.classList.remove('nav-tabs-collapsed');
              if (typeof global.scheduleSyncListTheadStickyTop === 'function') {
                global.scheduleSyncListTheadStickyTop();
              }
            }
          }
        } catch (_) {}
      }, 950);
    }
    if (already) return;
    if (typeof global.scheduleSyncListTheadStickyTop === 'function') {
      global.scheduleSyncListTheadStickyTop();
      requestAnimationFrame(function () {
        global.scheduleSyncListTheadStickyTop();
        setTimeout(global.scheduleSyncListTheadStickyTop, 120);
      });
    }
  }

  /** Call when opening detail (or similar overlay) — remember nav chrome state. */
  function snapshotForOverlay() {
    if (isMatrixBoardPage()) return;
    overlayCollapsedSnap = document.body.classList.contains('nav-tabs-collapsed');
    lastY = pageScrollY();
    upAccum = 0;
    bumpIgnore(1200);
  }

  function _applyOverlaySnap(clearSnap) {
    if (typeof overlayCollapsedSnap !== 'boolean') return;
    var want = overlayCollapsedSnap;
    if (clearSnap) overlayCollapsedSnap = null;
    var already = document.body.classList.contains('nav-tabs-collapsed') === want;
    if (!already) {
      document.body.classList.toggle('nav-tabs-collapsed', want);
      if (!want) pinnedCollapsed = false;
      if (typeof global.scheduleSyncListTheadStickyTop === 'function') {
        global.scheduleSyncListTheadStickyTop();
        requestAnimationFrame(function () {
          global.scheduleSyncListTheadStickyTop();
          setTimeout(global.scheduleSyncListTheadStickyTop, 120);
        });
      }
    }
  }

  /**
   * Call BEFORE removing page-scroll-lock / applying browse Y.
   * Freezes auto-hide + disables nav opacity transition so unlock scroll cannot flicker chrome.
   */
  function prepareUnlock() {
    if (isMatrixBoardPage()) return;
    if (typeof overlayCollapsedSnap !== 'boolean') {
      overlayCollapsedSnap = document.body.classList.contains('nav-tabs-collapsed');
    }
    overlayUnlockFreeze = true;
    setOverlayFreezeClass(true);
    bumpIgnore(2500);
    upAccum = 0;
    _applyOverlaySnap(false);
  }

  /**
   * End overlay freeze after detail exit wash is fully gone.
   * Do NOT unfreeze mid-fade — toggling nav/header height under a translucent wash
   * looks like .header-inner “trying to hide.”
   */
  function releaseOverlayFreeze(opts) {
    opts = opts || {};
    if (overlayUnlockSettleTimer) {
      try {
        clearTimeout(overlayUnlockSettleTimer);
      } catch (_) {}
      overlayUnlockSettleTimer = null;
    }
    if (!overlayUnlockFreeze && !document.body.classList.contains('nav-tabs-overlay-freeze')) {
      if (opts.forceTopReveal) {
        try {
          var t0 = thresholds();
          if (pageScrollY() <= t0.TOP_SHOW && !isMlsBattleFocus()) {
            pinnedCollapsed = false;
            setHeader15Collapsed(false);
            if (document.body.classList.contains('nav-tabs-collapsed')) {
              document.body.classList.remove('nav-tabs-collapsed');
              if (typeof global.scheduleSyncListTheadStickyTop === 'function') {
                global.scheduleSyncListTheadStickyTop();
              }
            }
          }
        } catch (_) {}
      }
      return;
    }
    bumpIgnore(280);
    _applyOverlaySnap(true);
    lastY = pageScrollY();
    upAccum = 0;
    overlayUnlockFreeze = false;
    setOverlayFreezeClass(false);
    try {
      var t = thresholds();
      if (pageScrollY() <= t.TOP_SHOW && !isMlsBattleFocus()) {
        pinnedCollapsed = false;
        setHeader15Collapsed(false);
        if (document.body.classList.contains('nav-tabs-collapsed')) {
          document.body.classList.remove('nav-tabs-collapsed');
          if (typeof global.scheduleSyncListTheadStickyTop === 'function') {
            global.scheduleSyncListTheadStickyTop();
          }
        }
      }
    } catch (_) {}
  }

  /** Call after detail close + browse scroll restore — put nav back as it was. */
  function restoreAfterOverlay() {
    if (isMatrixBoardPage()) return;
    overlayUnlockFreeze = true;
    setOverlayFreezeClass(true);
    bumpIgnore(2500);
    upAccum = 0;
    _applyOverlaySnap(false);
    lastY = pageScrollY();
    if (overlayUnlockSettleTimer) {
      try {
        clearTimeout(overlayUnlockSettleTimer);
      } catch (_) {}
      overlayUnlockSettleTimer = null;
    }
    /* Safety only — normal path releases from _finishDetailOverlayGone after exit motion. */
    overlayUnlockSettleTimer = setTimeout(function () {
      overlayUnlockSettleTimer = null;
      releaseOverlayFreeze();
    }, 2400);
  }

  function initNavTabsAutoHide() {
    if (inited) return;
    inited = true;
    if (!document.getElementById('navTabs') || isMatrixBoardPage()) return;

    lastY = pageScrollY();
    upAccum = 0;
    var touchY0 = null;

    function hardLocked() {
      /* Stuck freeze after detail exit (history.back re-armed prepareUnlock): if the
         modal is gone and unlock flag was cleared, drop the CSS class so scroll can
         reveal nav again. */
      try {
        if (
          document.body.classList.contains('nav-tabs-overlay-freeze') &&
          !overlayUnlockFreeze &&
          !document.body.classList.contains('detail-modal-open') &&
          !document.documentElement.classList.contains('page-scroll-lock')
        ) {
          setOverlayFreezeClass(false);
        }
      } catch (_) {}
      return (
        overlayUnlockFreeze ||
        document.documentElement.classList.contains('page-scroll-lock') ||
        document.body.classList.contains('detail-modal-open') ||
        document.body.classList.contains('search-spotlight-open') ||
        document.body.classList.contains('gacha-sim-stage-open') ||
        document.body.classList.contains('nav-tabs-overlay-freeze')
      );
    }

    function softIgnored() {
      return !!(ignoreUntil && Date.now() < ignoreUntil);
    }

    function locked() {
      return hardLocked() || softIgnored();
    }

    function revealAtTop(y, t, mls, dy) {
      /*
       * Absolute top (y≈0): always show — otherwise rubber-band can trap chrome.
       * Near TOP_SHOW while pinned: still require aggressive upward (same as mid-page).
       */
      var collapsed = pinnedCollapsed || document.body.classList.contains('nav-tabs-collapsed');
      if (y <= 2) {
        upAccum = 0;
        pinnedCollapsed = false;
        setNavTabsCollapsed(false);
        return;
      }
      if (collapsed) {
        if (dy < 0) {
          upAccum += -dy;
          if (upAccum >= t.REVEAL_UP) {
            upAccum = 0;
            pinnedCollapsed = false;
            setNavTabsCollapsed(false);
          }
        } else if (dy > 0) {
          upAccum = 0;
        }
        return;
      }
      upAccum = 0;
      pinnedCollapsed = false;
      setNavTabsCollapsed(false);
    }

    /** Capture-phase scroll also fires for overflow:auto panels (develop detail, etc.).
     *  Those must not drive nav hide/show — only document/page scroll should. */
    function isNestedScrollerScroll(ev) {
      try {
        var t = ev && ev.target;
        if (!t || t === document || t === document.documentElement || t === document.body || t === global) {
          return false;
        }
        return t.nodeType === 1;
      } catch (_) {
        return false;
      }
    }

    function onScroll(ev) {
      if (isNestedScrollerScroll(ev)) return;
      var phoneChrome = keepNavStatic();
      if (phoneChrome) {
        if (document.body.classList.contains('nav-tabs-collapsed')) {
          pinnedCollapsed = false;
          document.body.classList.remove('nav-tabs-collapsed');
        }
      }
      var y = pageScrollY();
      if (hardLocked()) {
        /* Keep lastY frozen while detail locks the page. Syncing to lock-time Y
           (often ~0 under position:fixed) makes unlock look like a huge dy and
           flips nav hide/show → Esc flicker. */
        return;
      }
      var t = thresholds();
      var mls = isMlsBattleFocus();
      /* Soft ignore must NOT block absolute top reveal — except hold MLS pin
         through Open-battle scroll-into-view debounce (~900ms). */
      if (y <= t.TOP_SHOW) {
        var dyTop = y - lastY;
        lastY = y;
        if (phoneChrome) {
          /* Phone: absolute top shows 1.5 row; near-top while collapsed needs intent. */
          if (y <= 2 || !document.body.classList.contains('header-15-collapsed')) {
            upAccum = 0;
            setHeader15Collapsed(false);
          } else if (dyTop < 0) {
            upAccum += -dyTop;
            if (upAccum >= Math.min(t.REVEAL_UP, 200)) {
              upAccum = 0;
              setHeader15Collapsed(false);
            }
          } else if (dyTop > 0) {
            upAccum = 0;
          }
          return;
        }
        if (mls && pinnedCollapsed && softIgnored() && y > 2) return;
        revealAtTop(y, t, mls, dyTop);
        return;
      }
      if (softIgnored()) return;
      var dy = y - lastY;
      lastY = y;
      if (phoneChrome) {
        /* Support cluster only — aggressive upward to reveal (same class as desktop). */
        if (dy > 0) {
          upAccum = 0;
          if (dy >= t.HIDE_AFTER || y > t.TOP_SHOW + 24) setHeader15Collapsed(true);
          return;
        }
        if (dy < 0) {
          upAccum += -dy;
          if (upAccum >= Math.min(t.REVEAL_UP, 200)) {
            upAccum = 0;
            setHeader15Collapsed(false);
          }
        }
        return;
      }
      /* Stay pinned while collapsed — do not unpin just for leaving TOP_SHOW band. */
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
        if (touchY0 == null || hardLocked()) return;
        var cy = null;
        try {
          cy = ev.touches && ev.touches[0] ? ev.touches[0].clientY : null;
        } catch (_) {}
        if (cy == null) return;
        var fingerUp = touchY0 - cy;
        var y = pageScrollY();
        var t = thresholds();
        var mls = isMlsBattleFocus();
        /* Absolute top only — near-top still needs aggressive upward. */
        if (fingerUp < -28 && y <= 2) {
          upAccum = 0;
          pinnedCollapsed = false;
          setNavTabsCollapsed(false);
          setHeader15Collapsed(false);
          touchY0 = cy;
          return;
        }
        if (softIgnored()) return;
        if (fingerUp > 12 && y > t.TOP_SHOW) {
          upAccum = 0;
          if (keepNavStatic()) setHeader15Collapsed(true);
          else setNavTabsCollapsed(true);
          touchY0 = cy;
        } else if (fingerUp < -28) {
          /* finger moves down → content scrolls up */
          upAccum += -fingerUp;
          var needUp = keepNavStatic() ? Math.min(t.REVEAL_UP, 200) : t.REVEAL_UP;
          if (upAccum >= needUp) {
            upAccum = 0;
            pinnedCollapsed = false;
            setNavTabsCollapsed(false);
            setHeader15Collapsed(false);
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
        setHeader15Collapsed(false);
      },
      { passive: true }
    );
  }

  global.GgenNavTabsAutoHide = {
    init: initNavTabsAutoHide,
    setCollapsed: setNavTabsCollapsed,
    setHeader15Collapsed: setHeader15Collapsed,
    snapshotForOverlay: snapshotForOverlay,
    prepareUnlock: prepareUnlock,
    restoreAfterOverlay: restoreAfterOverlay,
    releaseOverlayFreeze: releaseOverlayFreeze,
  };
  global.setNavTabsCollapsed = setNavTabsCollapsed;
  global.initNavTabsAutoHide = initNavTabsAutoHide;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavTabsAutoHide);
  } else {
    initNavTabsAutoHide();
  }
})(window);
