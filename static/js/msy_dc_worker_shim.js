/* MSY DC Web Worker — browser API shims before loading app.js */
(function () {
  var g = typeof self !== 'undefined' ? self : this;
  g.window = g;
  g.globalThis = g;

  g.__GGEN_IMAGE_CDN__ = g.__GGEN_IMAGE_CDN__ || '';
  g.__GGEN_VIDEO_CDN__ = g.__GGEN_VIDEO_CDN__ || '';
  g.__GGEN_VIDEO_FILE_EXT__ = g.__GGEN_VIDEO_FILE_EXT__ || 'mp4';
  g.__GGEN_VIDEO_HASH_SUFFIX__ = g.__GGEN_VIDEO_HASH_SUFFIX__ || '';
  g.__GGEN_VIDEO_UNIT_SUBDIR__ = g.__GGEN_VIDEO_UNIT_SUBDIR__ || 'unit';
  g.__GGEN_GAME_IMAGES_USE_CDN__ = !!g.__GGEN_GAME_IMAGES_USE_CDN__;

  var noop = function () {};
  var elStub = function () {
    return {
      style: {},
      value: '',
      checked: false,
      hidden: true,
      classList: { add: noop, remove: noop, toggle: noop, contains: function () { return false; } },
      setAttribute: noop,
      getAttribute: function () { return null; },
      appendChild: noop,
      insertAdjacentHTML: noop,
      addEventListener: noop,
      removeEventListener: noop,
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      focus: noop,
      click: noop
    };
  };

  g.document = {
    getElementById: function () { return elStub(); },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    createElement: elStub,
    addEventListener: function () {
      // Do not run app.js DOMContentLoaded handlers inside MSY worker.
    },
    removeEventListener: noop,
    body: { classList: { add: noop, remove: noop } }
  };

  g.navigator = { userAgent: 'MSY-DC-Worker', maxTouchPoints: 0, platform: 'Worker' };
  g.location = { origin: '', pathname: '/msy-worker', search: '', href: '/msy-worker' };
  g.localStorage = { getItem: function () { return null; }, setItem: noop, removeItem: noop };
  g.sessionStorage = g.localStorage;
  g.visualViewport = null;
  g.innerWidth = 1280;
  g.innerHeight = 720;
  g.scrollTo = noop;
  g.requestAnimationFrame = function (fn) { return setTimeout(fn, 0); };
  g.cancelAnimationFrame = function (id) { clearTimeout(id); };
  g.matchMedia = function () {
    return { matches: false, addEventListener: noop, removeEventListener: noop };
  };
  g.addEventListener = noop;
  g.removeEventListener = noop;
  g.fetch = g.fetch || function () {
    return Promise.reject(new Error('fetch disabled in MSY worker'));
  };
})();
