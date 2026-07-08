(function (global) {
  'use strict';

  var DB_NAME = 'ggen-msy-cache';
  var STORE = 'kv';
  var dbPromise = null;
  var cachedVersion = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!global.indexedDB) {
        reject(new Error('indexedDB unavailable'));
        return;
      }
      var req = global.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(STORE)) {
          req.result.createObjectStore(STORE);
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('idb open failed')); };
    });
    return dbPromise;
  }

  function withStore(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var store = tx.objectStore(STORE);
        var out;
        try { out = fn(store); } catch (e) { reject(e); return; }
        tx.oncomplete = function () { resolve(out); };
        tx.onerror = function () { reject(tx.error || new Error('idb tx failed')); };
        tx.onabort = function () { reject(tx.error || new Error('idb tx aborted')); };
      });
    });
  }

  function get(key) {
    return withStore('readonly', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function put(key, value) {
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.put(value, key);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function getMany(keys) {
    keys = keys || [];
    if (!keys.length) return Promise.resolve({});
    return withStore('readonly', function (store) {
      return Promise.all(keys.map(function (key) {
        return new Promise(function (resolve) {
          var req = store.get(key);
          req.onsuccess = function () { resolve([key, req.result || null]); };
          req.onerror = function () { resolve([key, null]); };
        });
      })).then(function (rows) {
        var out = {};
        rows.forEach(function (row) { out[row[0]] = row[1]; });
        return out;
      });
    });
  }

  function putMany(entries) {
    entries = entries || [];
    if (!entries.length) return Promise.resolve(0);
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var done = 0;
        var total = entries.length;
        entries.forEach(function (entry) {
          var req = store.put(entry.value, entry.key);
          req.onsuccess = function () {
            done++;
            if (done >= total) resolve(total);
          };
          req.onerror = function () { reject(req.error); };
        });
      });
    });
  }

  function remove(key) {
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.delete(key);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function clearAll() {
    cachedVersion = null;
    return withStore('readwrite', function (store) {
      return new Promise(function (resolve, reject) {
        var req = store.clear();
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function charKey(charId, lang) {
    return 'c:' + String(lang || 'EN') + ':' + String(charId);
  }

  function unitKey(unitId, lang) {
    return 'u:' + String(lang || 'EN') + ':' + String(unitId);
  }

  function evalKey(contextKey, unitId) {
    return 'eval:' + String(contextKey) + ':' + String(unitId);
  }

  function metaKey() {
    return 'meta:version';
  }

  function pilotsWarmKey(lang, version) {
    return 'warm:pilots:' + String(lang || 'EN') + ':' + String(version || '');
  }

  async function ensureVersion(version) {
    if (!version) return false;
    if (cachedVersion === version) return true;
    try {
      var row = await get(metaKey());
      if (row && row.version === version) {
        cachedVersion = version;
        return true;
      }
      await clearAll();
      await put(metaKey(), { version: version, at: Date.now() });
      cachedVersion = version;
      return true;
    } catch (_) {
      cachedVersion = null;
      return false;
    }
  }

  function isSupported() {
    return !!global.indexedDB;
  }

  global.MsyIdbCache = {
    isSupported: isSupported,
    get: get,
    put: put,
    getMany: getMany,
    putMany: putMany,
    remove: remove,
    clearAll: clearAll,
    ensureVersion: ensureVersion,
    charKey: charKey,
    unitKey: unitKey,
    evalKey: evalKey,
    metaKey: metaKey,
    pilotsWarmKey: pilotsWarmKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
