(function (global) {
  'use strict';

  var VIGORS = ['super', 'max', 'high'];
  var charCache = {};
  var unitCache = {};
  var cacheVersion = null;
  var workerPool = null;
  var workerFallback = true;

  function idb() {
    return global.MsyIdbCache || null;
  }

  function msyCharStatMode(cd) {
    if (!cd) return 'normal';
    var rid = cd.rarity_id != null ? String(cd.rarity_id) : '';
    if (rid) {
      var n = parseInt(rid, 10);
      if (!isNaN(n) && n <= 4) return 'sp';
      return 'normal';
    }
    var letter = String(cd.rarity || '').toUpperCase();
    if (letter === 'N' || letter === 'R' || letter === 'SR' || letter === 'SSR') return 'sp';
    return 'normal';
  }

  function defNpc(uDef, cDef) {
    return global._dcManualDefNpcFromDefC({
      un: 'Defender (MSY)', cn: 'Defender Pilot (MSY)',
      uHP: 0, uATK: 0, uDEF: uDef, uMOB: 0,
      cRNG: 0, cMEL: 0, cAWK: 0, cDEF: cDef, cREA: 0
    });
  }

  function msyUnitStatMode(ud) {
    if (typeof global._dcMsyUnitStatMode === 'function') return global._dcMsyUnitStatMode(ud);
    if (!ud) return 'normal';
    var ri = parseInt(String(ud.rarity_id || '5'), 10);
    if (!isNaN(ri) && ri <= 4) return 'sp';
    return 'normal';
  }

  function msyAutoEnableSkills(ud, cd) {
    if (typeof global._dcMsyAutoEnableSkills === 'function') {
      global._dcMsyAutoEnableSkills(ud, cd);
      return;
    }
    if (typeof global._dcAutoEnableMaxDamageSkills === 'function') {
      global._dcAutoEnableMaxDamageSkills();
    }
  }

  function msyCritRate(ud, cd, slot, weaponCrit) {
    var crit = Math.max(0, weaponCrit | 0);
    if (typeof global._dcMsySkillCritRate === 'function') {
      crit += global._dcMsySkillCritRate(slot, cd) | 0;
    }
    if (typeof global._dcMsyAffinityWeaponCrit === 'function') {
      crit += global._dcMsyAffinityWeaponCrit(ud, cd) | 0;
    }
    return Math.min(100, Math.max(0, crit));
  }

  function buildMsySlot(ud, cd, vigor, cpEnabled) {
    var slot = global._dcCreateEmptyAttackerSlot();
    var S = global.S;
    var charMode = msyCharStatMode(cd);
    slot.atkUnit = String(ud.id);
    slot.atkChar = String(cd.id);
    slot.atkUnitData = ud;
    slot.atkCharData = cd;
    var bw = global._dcPickBestWeaponIndices(ud);
    slot.wpnIdx = bw.wpnIdx;
    slot.wpnLv = bw.wpnLv;
    slot.lbTier = 3;
    slot.unitStatMode = msyUnitStatMode(ud);
    slot.unitCondPassive = cpEnabled;
    slot.charStatMode = charMode;
    slot.mpLevel = global._dcNormMpLevel(vigor);
    // _dcShouldAutoCharCondPassive reads S.dc.mpLevel — sync before pair CP (Supercharged EX2 GC on any unit).
    S.dc.mpLevel = slot.mpLevel;
    S.dc.atkCharData = cd;
    S.dc.atkUnitData = ud;
    slot.charCondPassive = cpEnabled && (typeof global._dcShouldAutoCharCondPassive === 'function'
      ? global._dcShouldAutoCharCondPassive(cd, ud) : true);
    slot.dcSuperchargedExTier = 0;
    if (slot.charCondPassive && cd.ex_supercharged_tiers && cd.ex_supercharged_tiers.length > 1
        && global._dcNormMpLevel(vigor) === 'super') {
      slot.dcSuperchargedExTier = cd.ex_supercharged_tiers.length - 1;
    }
    S.dc.atkCharData = cd;
    S.dc.atkUnitData = ud;
    S.dc.charStatMode = charMode;
    S.dc._activeSkills = {};
    msyAutoEnableSkills(ud, cd);
    slot._activeSkills = Object.assign({}, S.dc._activeSkills || {});
    return slot;
  }

  function formulaStatKeyForPair(wpn) {
    if (!wpn || typeof global._dcWeaponAtkStatKeys !== 'function') return 'Ranged';
    var charStats = typeof global._dcGetCharStats === 'function' ? global._dcGetCharStats() : null;
    if (!charStats) return 'Ranged';
    var sk = typeof global._dcGetActiveSkillStatPct === 'function' ? global._dcGetActiveSkillStatPct() : {};
    var atkTypes = global._dcWeaponAtkStatKeys(wpn);
    var unique = [];
    atkTypes.forEach(function (k) {
      if (unique.indexOf(k) < 0) unique.push(k);
    });
    if (!unique.length) return 'Ranged';
    var val = function (k) {
      if (k === 'Awaken') {
        return typeof global._dcPilotAwakenAdjustedForDc === 'function'
          ? global._dcPilotAwakenAdjustedForDc(charStats, sk[k] || 0) : 0;
      }
      return typeof global._dcPilotSkillAdjustedStat === 'function'
        ? global._dcPilotSkillAdjustedStat(charStats, k, sk[k] || 0) : 0;
    };
    var bestKey = unique[0];
    var bestVal = val(bestKey);
    for (var i = 1; i < unique.length; i++) {
      var v = val(unique[i]);
      if (v > bestVal) {
        bestVal = v;
        bestKey = unique[i];
      }
    }
    return bestKey;
  }

  function evalPair(ud, cd, uDef, cDef, vigor, cpEnabled) {
    var S = global.S;
    S.dc.defTargetMode = 'custom';
    S.dc.defNpc = defNpc(uDef, cDef);
    var slot = buildMsySlot(ud, cd, vigor, cpEnabled);
    if (!S.dc.atkSlots || !Array.isArray(S.dc.atkSlots)) S.dc.atkSlots = [null, null, null];
    S.dc.atkSlotIndex = 0;
    S.dc.atkSlots[0] = slot;
    // Guaranteed crit (e.g. Shinn Supercharged EX2) must be read from the
    // active slot state — _dcCalculateDamageWithSlot restores the prior attacker.
    S.dc.atkCharData = cd;
    S.dc.atkUnitData = ud;
    S.dc.charCondPassive = !!slot.charCondPassive;
    S.dc.dcSuperchargedExTier = slot.dcSuperchargedExTier | 0;
    S.dc.mpLevel = slot.mpLevel;
    var gc = typeof global._dcCharGuaranteedCritActive === 'function'
      ? global._dcCharGuaranteedCritActive() : false;
    var r = null;
    try { r = global._dcCalculateDamageWithSlot(0); } catch (_) { r = null; }
    if (!r) return null;
    var weaponCrit = r.critical | 0;
    var critRate = msyCritRate(ud, cd, slot, weaponCrit);
    if (gc) critRate = 100;
    var normalDmg = r.normalDmg | 0;
    var critDmgVal = r.critDmg | 0;
    var canCrit = gc || critRate > 0;
    var rankSuperCrit = canCrit ? critDmgVal : normalDmg;
    var rankCrit = canCrit ? critDmgVal : normalDmg;
    var expected = Math.floor(normalDmg * (100 - critRate) / 100 + critDmgVal * critRate / 100);
    // 0% crit cannot land a crit — never rank them on theoretical critDmg (~1.3x).
    var peak = !canCrit ? normalDmg : (gc ? critDmgVal : Math.max(critDmgVal, expected));
    var pairOk = typeof global._dcUnitCharPairMatch === 'function'
      ? global._dcUnitCharPairMatch(cd, ud) : false;
    var wpn = ud.weapons && ud.weapons[slot.wpnIdx];
    var row = {
      expected_dmg: expected,
      peak_dmg: peak,
      guaranteed_crit: gc,
      crit_rate: critRate,
      weapon_power: r.weaponPower | 0,
      def_debuff_pct: r.defDebuffPct | 0,
      pair_ok: pairOk,
      vigor: vigor,
      normal_dmg: normalDmg,
      crit_dmg: rankCrit,
      super_crit_dmg: rankSuperCrit,
      char_atk: r.charAtk | 0,
      formula_stat: formulaStatKeyForPair(wpn),
      dmg_dealt_pct: r.userDmgIncreasePct | 0,
      vigor_dmg_pct: r.vigorDmgBonusPct | 0
    };
    if (vigor === 'high') row.normal_dmg = normalDmg;
    else if (vigor === 'max') row.crit_dmg = rankCrit;
    else row.super_crit_dmg = rankSuperCrit;
    return row;
  }

  async function ensureCacheVersion(version) {
    if (!version) return;
    cacheVersion = version;
    var store = idb();
    if (store && store.isSupported()) {
      try { await store.ensureVersion(version); } catch (_) {}
    }
  }

  async function loadUnit(unitId, lang) {
    var key = String(unitId) + ':' + lang;
    if (unitCache[key]) return unitCache[key];
    var store = idb();
    if (store && store.isSupported()) {
      try {
        var cached = await store.get(store.unitKey(unitId, lang));
        if (cached && cached.data) {
          unitCache[key] = cached.data;
          return cached.data;
        }
      } catch (_) {}
    }
    var ud = await fetch('/api/unit/' + encodeURIComponent(unitId) + '?lang=' + encodeURIComponent(lang) + '&lb_tier=3')
      .then(function (r) { return r.json(); });
    unitCache[key] = ud;
    if (store && store.isSupported() && ud && !ud.error) {
      try {
        await store.put(store.unitKey(unitId, lang), { data: ud, at: Date.now() });
      } catch (_) {}
    }
    return ud;
  }

  async function loadChar(charId, lang) {
    var key = String(charId) + ':' + lang;
    if (charCache[key]) return charCache[key];
    var store = idb();
    if (store && store.isSupported()) {
      try {
        var cached = await store.get(store.charKey(charId, lang));
        if (cached && cached.data) {
          charCache[key] = cached.data;
          return cached.data;
        }
      } catch (_) {}
    }
    var cd = await fetch('/api/character/' + encodeURIComponent(charId) + '?lang=' + encodeURIComponent(lang))
      .then(function (r) { return r.json(); });
    charCache[key] = cd;
    if (store && store.isSupported() && cd && !cd.error) {
      try {
        await store.put(store.charKey(charId, lang), { data: cd, at: Date.now() });
      } catch (_) {}
    }
    return cd;
  }

  async function capturePepState(ud, pepOn) {
    if (!pepOn || !ud) return null;
    var S = global.S;
    var snap = {
      pep: S.pilotConditionalPassiveActive,
      condData: S.pilotCondCharData,
      detail: S.currentDetailData,
      stack: S.pilotCondStackCount
    };
    S.pilotConditionalPassiveActive = true;
    if (ud.has_pilot_cond_passive && ud.recommend_character && ud.recommend_character.id) {
      if (typeof global.ensurePilotCondCharData === 'function') {
        await global.ensurePilotCondCharData(ud, true);
      }
      S.currentDetailData = ud;
      if (typeof global._detailInitPilotCondStackCount === 'function') {
        global._detailInitPilotCondStackCount(ud);
      }
    }
    var pepState = {
      pilotCondCharData: S.pilotCondCharData,
      pilotCondStackCount: S.pilotCondStackCount | 0
    };
    S.pilotConditionalPassiveActive = snap.pep;
    S.pilotCondCharData = snap.condData;
    S.currentDetailData = snap.detail;
    S.pilotCondStackCount = snap.stack;
    return pepState;
  }

  async function setupPep(ud, pepOn) {
    var S = global.S;
    var snap = {
      pep: S.pilotConditionalPassiveActive,
      condData: S.pilotCondCharData,
      detail: S.currentDetailData,
      stack: S.pilotCondStackCount
    };
    S.pilotConditionalPassiveActive = !!pepOn;
    if (pepOn && ud && ud.has_pilot_cond_passive && ud.recommend_character && ud.recommend_character.id) {
      if (typeof global.ensurePilotCondCharData === 'function') {
        await global.ensurePilotCondCharData(ud, true);
      }
      S.currentDetailData = ud;
      if (typeof global._detailInitPilotCondStackCount === 'function') {
        global._detailInitPilotCondStackCount(ud);
      }
    } else if (!pepOn) {
      S.pilotCondCharData = null;
      S.pilotCondStackCount = 0;
    }
    return function restore() {
      S.pilotConditionalPassiveActive = snap.pep;
      S.pilotCondCharData = snap.condData;
      S.currentDetailData = snap.detail;
      S.pilotCondStackCount = snap.stack;
    };
  }

  function enrichPairRow(row, dt, stats) {
    if (!row || !stats) return row;
    return Object.assign({}, row, {
      def_tier: parseInt(dt, 10),
      def_unit_def: stats.unit_def,
      def_char_def: stats.char_def,
      def_label: stats.label || ''
    });
  }

  function evalContextKey(opts) {
    opts = opts || {};
    return [
      opts.lang || (global.S && global.S.lang) || 'EN',
      opts.cpOn !== false ? 'cp1' : 'cp0',
      opts.pepOn !== false ? 'pep1' : 'pep0'
    ].join('|');
  }

  async function loadEvalFromIdb(unitId, contextKey) {
    var store = idb();
    if (!store || !store.isSupported()) return null;
    try {
      var row = await store.get(store.evalKey(contextKey, unitId));
      return row && row.data ? row.data : null;
    } catch (_) {
      return null;
    }
  }

  async function saveEvalToIdb(unitId, contextKey, data) {
    var store = idb();
    if (!store || !store.isSupported() || !data) return;
    try {
      await store.put(store.evalKey(contextKey, unitId), { data: data, at: Date.now() });
    } catch (_) {}
  }

  function createWorkerPool(size, appVer) {
    if (typeof Worker === 'undefined' || workerFallback) return null;
    var workers = [];
    var queue = [];
    var jobSeq = 0;

    function workerUrl() {
      return '/static/js/msy_dc_worker.js?v=' + encodeURIComponent(appVer || '');
    }

    function attachWorker(w) {
      w.onmessage = function (ev) {
        var msg = ev.data || {};
        if (msg.type === 'pong') {
          if (w._current) {
            var pingCb = w._current;
            w._busy = false;
            w._current = null;
            if (msg.ready) pingCb.resolve(true);
            else pingCb.reject(new Error(msg.error || 'worker boot failed'));
          }
          drain();
          return;
        }
        w._busy = false;
        if (w._current && w._current.jobId === msg.jobId) {
          var cb = w._current;
          w._current = null;
          if (msg.error) cb.reject(new Error(msg.error));
          else cb.resolve(msg.result);
        }
        drain();
      };
      w.onerror = function () {
        w._busy = false;
        if (w._current) {
          w._current.reject(new Error('worker error'));
          w._current = null;
        }
        drain();
      };
    }

    function spawn() {
      try {
        var w = new Worker(workerUrl());
        w._busy = false;
        w._current = null;
        attachWorker(w);
        return w;
      } catch (_) {
        return null;
      }
    }

    function drain() {
      for (var i = 0; i < workers.length; i++) {
        var w = workers[i];
        if (w._busy || !queue.length) continue;
        var job = queue.shift();
        w._busy = true;
        w._current = job;
        w.postMessage(job.payload);
      }
    }

    for (var i = 0; i < size; i++) {
      var w = spawn();
      if (w) workers.push(w);
    }
    if (!workers.length) return null;

    return {
      ready: Promise.all(workers.map(function (w) {
        return new Promise(function (resolve) {
          var jobId = 'ping-' + (++jobSeq);
          var timer = setTimeout(function () { resolve(false); }, 8000);
          w._busy = true;
          w._current = {
            jobId: jobId,
            resolve: function () { clearTimeout(timer); w._busy = false; w._current = null; resolve(true); },
            reject: function () { clearTimeout(timer); w._busy = false; w._current = null; resolve(false); }
          };
          w.postMessage({ type: 'ping', jobId: jobId });
        });
      })).then(function (flags) { return flags.some(Boolean); }),
      evalUnit: function (payload) {
        return new Promise(function (resolve, reject) {
          var jobId = 'job-' + (++jobSeq);
          queue.push({
            jobId: jobId,
            resolve: resolve,
            reject: reject,
            payload: Object.assign({ type: 'eval_unit', jobId: jobId }, payload)
          });
          drain();
        });
      },
      destroy: function () {
        workers.forEach(function (w) { try { w.terminate(); } catch (_) {} });
        workers = [];
        queue = [];
      }
    };
  }

  async function ensureWorkerPool(appVer) {
    if (workerPool) return workerPool;
    if (workerFallback || typeof Worker === 'undefined') return null;
    workerPool = createWorkerPool(2, appVer);
    if (!workerPool) {
      workerFallback = true;
      return null;
    }
    var ok = await workerPool.ready;
    if (!ok) {
      workerPool.destroy();
      workerPool = null;
      workerFallback = true;
      return null;
    }
    return workerPool;
  }

  async function evalUnitMainThread(unitId, pilotIds, defTiers, opts) {
    var lang = opts.lang || (global.S && global.S.lang) || 'EN';
    var cpOn = opts.cpOn !== false;
    var pepOn = opts.pepOn !== false;
    var ud = await loadUnit(unitId, lang);
    if (!ud || ud.error) return { error: ud && ud.error, unitId: unitId };
    var restorePep = await setupPep(ud, pepOn);
    try {
      var byTier = {};
      var tierKeys = Object.keys(defTiers || {});
      for (var ti = 0; ti < tierKeys.length; ti++) {
        var dt = tierKeys[ti];
        var stats = defTiers[dt];
        var tierPairs = [];
        for (var pi = 0; pi < (pilotIds || []).length; pi++) {
          var cid = pilotIds[pi];
          var cd = await loadChar(cid, lang);
          if (!cd || cd.error) continue;
          var byVigor = {};
          for (var vi = 0; vi < VIGORS.length; vi++) {
            var v = VIGORS[vi];
            var d = evalPair(ud, cd, stats.unit_def, stats.char_def, v, cpOn);
            if (d) byVigor[v] = enrichPairRow(d, dt, stats);
          }
          if (Object.keys(byVigor).length) tierPairs.push([String(cid), byVigor]);
        }
        byTier[dt] = tierPairs;
      }
      return { unitId: unitId, unitName: ud.name, byTier: byTier };
    } finally {
      restorePep();
    }
  }

  async function evalUnitWorker(pool, unitId, pilotIds, defTiers, opts) {
    var lang = opts.lang || (global.S && global.S.lang) || 'EN';
    var cpOn = opts.cpOn !== false;
    var pepOn = opts.pepOn !== false;
    var ud = await loadUnit(unitId, lang);
    if (!ud || ud.error) return { error: ud && ud.error, unitId: unitId };
    var pilots = {};
    for (var i = 0; i < (pilotIds || []).length; i++) {
      var cid = String(pilotIds[i]);
      var cd = await loadChar(cid, lang);
      if (cd && !cd.error) pilots[cid] = cd;
    }
    var pepState = pepOn ? await capturePepState(ud, true) : null;
    var raw = await pool.evalUnit({
      unitId: String(unitId),
      unitData: ud,
      pilotIds: (pilotIds || []).map(String),
      pilots: pilots,
      defTiers: defTiers,
      cpOn: cpOn,
      pepOn: pepOn,
      pepState: pepState
    });
    return raw;
  }

  async function evalUnit(unitId, pilotIds, defTiers, opts) {
    opts = opts || {};
    var ctxKey = evalContextKey(opts);
    var cached = await loadEvalFromIdb(unitId, ctxKey);
    if (cached && cached.byTier) return cached;
    var raw = await evalUnitMainThread(unitId, pilotIds, defTiers, opts);
    if (raw && raw.byTier) {
      await saveEvalToIdb(unitId, ctxKey, raw);
    }
    return raw;
  }

  function ensureReady() {
    if (typeof global.initDmgCalc === 'function') {
      if (!global.S || !global.S.dc || !global.S.dc.atkSlots) global.initDmgCalc();
    }
    if (typeof global._dcCalculateDamageWithSlot !== 'function'
        || typeof global._dcCreateEmptyAttackerSlot !== 'function') {
      return Promise.reject(new Error('Damage Calculator not loaded'));
    }
    // Override host /cal skill helpers so Boost Critical always applies
    // (Railway may still serve an older app.js during long BSP builds).
    global._dcMsySkillRelevantForSim = function (desc, skId, skName) {
      var text = String(desc || '');
      if (/(?:damage\s+dealt|造成的損傷|傷害|ダメージ)/i.test(text)) return true;
      if (typeof global._dcParseSkillDescAtkPct === 'function') {
        var add = global._dcParseSkillDescAtkPct(text, { id: skId, name: skName || '' });
        if (add && (add.Ranged || add.Melee || add.Awaken)) return true;
      }
      if (/^200170[1-5]01$/.test(String(skId || ''))) return true;
      if (/awaken\s+boost|覺醒值增幅|覚醒ブースト|boost\s+critical/i.test(String(skName || ''))) return true;
      if (/critical\s*rate|暴擊率|暴击率|爆擊率|クリティカル率/i.test(text)) return true;
      return false;
    };
    global._dcMsySkillCritRate = function (slot, cd) {
      var crit = 0;
      if (!cd || !slot || !slot._activeSkills) return 0;
      var skills = typeof global._dcPilotSkillsVisibleForDc === 'function'
        ? (global._dcPilotSkillsVisibleForDc(cd) || []) : [];
      var S = global.S;
      var saveMode = S.dc.charStatMode;
      var saveAS = S.dc._activeSkills;
      try {
        S.dc.charStatMode = slot.charStatMode || 'normal';
        S.dc._activeSkills = Object.assign({}, slot._activeSkills);
        skills.forEach(function (sk) {
          if (!slot._activeSkills[sk.id]) return;
          var rsk = typeof global._dcResolveSkillForDcMode === 'function'
            ? global._dcResolveSkillForDcMode(sk) : sk;
          var desc = [].concat(
            (rsk.details || []).map(function (d) {
              return typeof d === 'string' ? d : ((d && d.text) || '');
            }),
            [rsk.desc || '', rsk.sp_desc || '']
          ).join(' ');
          var m = desc.match(/Increases?\s+(?:own\s+)?critical\s*rate\s+by\s+(\d+)\s*%/i)
            || desc.match(/Increase\s+critical\s*rate\s+by\s+(\d+)\s*%/i)
            || desc.match(/自身(?:的)?(?:暴擊|暴击|爆擊)率提升(\d+)%/)
            || desc.match(/自身のクリティカル率が(\d+)%上昇/)
            || desc.match(/クリティカル(?:発生)?率.{0,8}?(\d+)\s*[%％]/);
          if (m) crit = Math.max(crit, parseInt(m[1], 10) || 0);
        });
      } finally {
        S.dc.charStatMode = saveMode;
        S.dc._activeSkills = saveAS;
      }
      return crit;
    };
    return Promise.resolve(true);
  }

  function clearCaches() {
    charCache = {};
    unitCache = {};
    if (workerPool) {
      workerPool.destroy();
      workerPool = null;
    }
    workerFallback = false;
  }

  async function warmPilots(pilotIds, lang, concurrency) {
    concurrency = concurrency || 4;
    var ids = (pilotIds || []).filter(Boolean).slice(0, 160);
    var missing = [];
    var store = idb();
    if (store && store.isSupported()) {
      var keys = ids.map(function (id) { return store.charKey(id, lang); });
      try {
        var cachedMap = await store.getMany(keys);
        var toPut = [];
        ids.forEach(function (id) {
          var memKey = String(id) + ':' + lang;
          var row = cachedMap[store.charKey(id, lang)];
          if (row && row.data) {
            charCache[memKey] = row.data;
          } else if (!charCache[memKey]) {
            missing.push(String(id));
          }
        });
        if (toPut.length) await store.putMany(toPut);
      } catch (_) {
        missing = ids.filter(function (id) {
          return !charCache[String(id) + ':' + lang];
        }).map(String);
      }
    } else {
      missing = ids.filter(function (id) {
        return !charCache[String(id) + ':' + lang];
      }).map(String);
    }
    if (!missing.length) return;
    var idx = 0;
    var fetched = [];
    async function worker() {
      while (idx < missing.length) {
        var my = idx++;
        var cd = await loadChar(missing[my], lang);
        if (cd && !cd.error) fetched.push(missing[my]);
      }
    }
    var workers = [];
    var n = Math.min(concurrency, missing.length);
    for (var w = 0; w < n; w++) workers.push(worker());
    await Promise.all(workers);
    if (store && store.isSupported() && cacheVersion) {
      try {
        await store.put(store.pilotsWarmKey(lang, cacheVersion), {
          pilotIds: ids.map(String),
          at: Date.now()
        });
      } catch (_) {}
    }
  }

  global.MsyDcEngine = {
    ensureReady: ensureReady,
    ensureCacheVersion: ensureCacheVersion,
    evalUnit: evalUnit,
    clearCaches: clearCaches,
    warmPilots: warmPilots,
    msyCharStatMode: msyCharStatMode,
    evalContextKey: evalContextKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
