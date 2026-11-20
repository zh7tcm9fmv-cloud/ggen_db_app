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
    /* Collections / MLS battle: only aggressive scroll-up (or true top + intent) reveals.
       Possession % uses a separate compact sticky bar in collections.js. */
    var col = isCollectionsPage();
    var mls = isMlsBattleFocus();
    if (shortLandscape) {
      /* MLS mid-page: same flick as browse; collections stay pickier. Top always reveals. */
      return { HIDE_AFTER: 4, REVEAL_UP: col ? 240 : 160, TOP_SHOW: 16 };
    }
    /* Normal browse / MLS mid-page: ~280px flick. Collections stay pickier. */
    return { HIDE_AFTER: 10, REVEAL_UP: col ? 420 : 280, TOP_SHOW: 40 };
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

  function setNavTabsCollapsed(collapsed) {
    /* /tm and /dm use their own board-scroll chrome hide */
    if (isMatrixBoardPage()) return;
    if (overlayUnlockFreeze) return;
    var want = !!collapsed;
    var already = document.body.classList.contains('nav-tabs-collapsed') === want;
    var y = pageScrollY();
    var t = thresholds();
    var mls = isMlsBattleFocus();
    var col = isCollectionsPage();
    if (!already) {
      document.body.classList.toggle('nav-tabs-collapsed', want);
      /* Height snaps instantly; opacity fades — ignore layout / smooth-scroll noise */
      bumpIgnore(col ? 700 : mls ? 900 : 320);
    }
    /* Pin so programmatic scroll-up (MLS battle into view / collections chrome) cannot reveal. */
    if (want && (mls || (col && y > t.TOP_SHOW))) {
      pinnedCollapsed = true;
    }
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
       * True / near page top: always show nav — including MLS battle focus.
       * Mid-page MLS still needs aggressive REVEAL_UP (you cannot accumulate
       * upward dy once rubber-banded at y≈0, which left /mls stuck collapsed).
       */
      if (y <= t.TOP_SHOW) {
        upAccum = 0;
        pinnedCollapsed = false;
        setNavTabsCollapsed(false);
        return;
      }
      if (mls && (pinnedCollapsed || document.body.classList.contains('nav-tabs-collapsed'))) {
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
      var col = isCollectionsPage();
      /* Collections: collapsing tall intro can land in TOP_SHOW — need upward intent
         unless we are truly at the page top (owner: top always reveals nav). */
      if (pinnedCollapsed && col && y > 2) {
        if (dy < -10) {
          pinnedCollapsed = false;
          setNavTabsCollapsed(false);
        }
        return;
      }
      /* Normal browse TOP_SHOW: always show nav tabs. */
      pinnedCollapsed = false;
      setNavTabsCollapsed(false);
    }

    function onScroll() {
      var y = pageScrollY();
      if (hardLocked()) {
        /* Keep lastY frozen while detail locks the page. Syncing to lock-time Y
           (often ~0 under position:fixed) makes unlock look like a huge dy and
           flips nav hide/show → Esc flicker. */
        return;
      }
      var t = thresholds();
      var mls = isMlsBattleFocus();
      /* Soft ignore must NOT block "scrolled all the way to top" — except hold
         MLS pin through Open-battle scroll-into-view debounce (~900ms). */
      if (y <= t.TOP_SHOW) {
        var dyTop = y - lastY;
        lastY = y;
        if (mls && pinnedCollapsed && softIgnored()) return;
        revealAtTop(y, t, mls, dyTop);
        return;
      }
      if (softIgnored()) return;
      var dy = y - lastY;
      lastY = y;
      /* Collections: leave synthetic top → unpin. MLS battle: keep pin mid-page
         until aggressive REVEAL_UP (or leave battle / return to top). */
      if (!mls && y > t.TOP_SHOW + 64) pinnedCollapsed = false;
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
        /* Top reveal ignores soft post-hide debounce (MLS included — cannot
           pull content further up once already at y≈0). */
        if (fingerUp < -28 && y <= t.TOP_SHOW) {
          upAccum = 0;
          pinnedCollapsed = false;
          setNavTabsCollapsed(false);
          touchY0 = cy;
          return;
        }
        if (softIgnored()) return;
        if (fingerUp > 12 && y > t.TOP_SHOW) {
          upAccum = 0;
          setNavTabsCollapsed(true);
          touchY0 = cy;
        } else if (fingerUp < -28) {
          /* finger moves down → content scrolls up */
          upAccum += -fingerUp;
          if (upAccum >= t.REVEAL_UP) {
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
