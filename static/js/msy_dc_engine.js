(function (global) {
  'use strict';

  var VIGORS = ['super', 'max', 'high'];
  var charCache = {};
  var unitCache = {};

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

  function buildMsySlot(ud, cd, vigor, cpEnabled) {
    var slot = global._dcCreateEmptyAttackerSlot();
    var charMode = msyCharStatMode(cd);
    slot.atkUnit = String(ud.id);
    slot.atkChar = String(cd.id);
    slot.atkUnitData = ud;
    slot.atkCharData = cd;
    var bw = global._dcPickBestWeaponIndices(ud);
    slot.wpnIdx = bw.wpnIdx;
    slot.wpnLv = bw.wpnLv;
    slot.lbTier = 3;
    slot.unitStatMode = 'normal';
    slot.unitCondPassive = cpEnabled;
    slot.charStatMode = charMode;
    slot.mpLevel = global._dcNormMpLevel(vigor);
    slot.terrainMode = 'normal';
    slot.terrain = 0;
    slot.optionParts = [];
    slot.supporters = [];
    slot.supportCounterAtk = false;
    slot.finalWpnPow = 0;
    slot.applyAdvantageEnemyTag = true;
    slot.charCondPassive = cpEnabled && (typeof global._dcShouldAutoCharCondPassive === 'function'
      ? global._dcShouldAutoCharCondPassive(cd, ud) : true);
    slot.dcSuperchargedExTier = 0;
    if (slot.charCondPassive && cd.ex_supercharged_tiers && cd.ex_supercharged_tiers.length > 1
        && global._dcNormMpLevel(vigor) === 'super') {
      slot.dcSuperchargedExTier = cd.ex_supercharged_tiers.length - 1;
    }
    var S = global.S;
    S.dc.atkCharData = cd;
    S.dc.atkUnitData = ud;
    S.dc.charStatMode = charMode;
    S.dc._activeSkills = {};
    if (typeof global._dcAutoEnableMaxDamageSkills === 'function') {
      global._dcAutoEnableMaxDamageSkills();
    }
    slot._activeSkills = Object.assign({}, S.dc._activeSkills || {});
    return slot;
  }

  function evalPair(ud, cd, uDef, cDef, vigor, cpEnabled) {
    var S = global.S;
    S.dc.defTargetMode = 'custom';
    S.dc.defNpc = defNpc(uDef, cDef);
    var slot = buildMsySlot(ud, cd, vigor, cpEnabled);
    if (!S.dc.atkSlots || !Array.isArray(S.dc.atkSlots)) S.dc.atkSlots = [null, null, null];
    S.dc.atkSlotIndex = 0;
    S.dc.atkSlots[0] = slot;
    var r = null;
    try { r = global._dcCalculateDamageWithSlot(0); } catch (_) { r = null; }
    if (!r) return null;
    var critRate = Math.min(100, Math.max(0, r.critical | 0));
    var gc = typeof global._dcCharGuaranteedCritActive === 'function'
      ? global._dcCharGuaranteedCritActive() : false;
    var normalDmg = r.normalDmg | 0;
    var critDmgVal = r.critDmg | 0;
    var expected = Math.floor(normalDmg * (100 - critRate) / 100 + critDmgVal * critRate / 100);
    var peak = gc ? critDmgVal : Math.max(critDmgVal, expected);
    var pairOk = typeof global._dcUnitCharPairMatch === 'function'
      ? global._dcUnitCharPairMatch(cd, ud) : false;
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
      crit_dmg: critDmgVal,
      super_crit_dmg: critDmgVal
    };
    if (vigor === 'high') row.normal_dmg = normalDmg;
    else if (vigor === 'max') row.crit_dmg = critDmgVal;
    else row.super_crit_dmg = critDmgVal;
    return row;
  }

  async function loadUnit(unitId, lang) {
    var key = String(unitId) + ':' + lang;
    if (unitCache[key]) return unitCache[key];
    var ud = await fetch('/api/unit/' + encodeURIComponent(unitId) + '?lang=' + encodeURIComponent(lang) + '&lb_tier=3')
      .then(function (r) { return r.json(); });
    unitCache[key] = ud;
    return ud;
  }

  async function loadChar(charId, lang) {
    var key = String(charId) + ':' + lang;
    if (charCache[key]) return charCache[key];
    var cd = await fetch('/api/character/' + encodeURIComponent(charId) + '?lang=' + encodeURIComponent(lang))
      .then(function (r) { return r.json(); });
    charCache[key] = cd;
    return cd;
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

  async function evalUnit(unitId, pilotIds, defTiers, opts) {
    opts = opts || {};
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

  function ensureReady() {
    if (typeof global.initDmgCalc === 'function') {
      if (!global.S || !global.S.dc || !global.S.dc.atkSlots) global.initDmgCalc();
    }
    if (typeof global._dcCalculateDamageWithSlot !== 'function'
        || typeof global._dcCreateEmptyAttackerSlot !== 'function') {
      return Promise.reject(new Error('Damage Calculator not loaded'));
    }
    return Promise.resolve(true);
  }

  function clearCaches() {
    charCache = {};
    unitCache = {};
  }

  global.MsyDcEngine = {
    ensureReady: ensureReady,
    evalUnit: evalUnit,
    clearCaches: clearCaches,
    msyCharStatMode: msyCharStatMode
  };
})(typeof window !== 'undefined' ? window : globalThis);
