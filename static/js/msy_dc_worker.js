/* global S, _dcCreateEmptyAttackerSlot, _dcPickBestWeaponIndices, _dcNormMpLevel,
          _dcShouldAutoCharCondPassive, _dcMsyAutoEnableSkills, _dcMsyUnitStatMode,
          _dcMsySkillCritRate, _dcMsyAffinityWeaponCrit, _dcCalculateDamageWithSlot,
          _dcCharGuaranteedCritActive, _dcUnitCharPairMatch, _dcManualDefNpcFromDefC */
(function () {
  'use strict';

  var VIGORS = ['super', 'max', 'high'];
  var ready = false;
  var readyError = null;

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

  function initWorkerDc() {
    if (!S) throw new Error('S missing after app.js load');
    if (!S.dc) S.dc = {};
    S.lang = S.lang || 'EN';
    S.pilotConditionalPassiveActive = false;
    S.pilotCondCharData = null;
    S.pilotCondStackCount = 0;
    S.currentDetailData = null;
    Object.assign(S.dc, {
      atkSlots: [null, null, null],
      atkSlotIndex: 0,
      lbTier: 3,
      defTargetMode: 'custom',
      defNpc: null,
      atkUnitData: null,
      atkCharData: null,
      wpnIdx: 0,
      wpnLv: 0,
      terrainMode: 'normal',
      terrain: 0,
      mpLevel: 'medium',
      defending: false,
      shield: false,
      finalWpnPow: 0,
      dmgIncrease: 0,
      critDmgUp: 0,
      exSquadAtkPct: 0,
      squadCondAtkPct: 0,
      squadCondDefPct: 0,
      unitStatMode: 'normal',
      charStatMode: 'normal',
      unitCondPassive: false,
      charCondPassive: false,
      dcSuperchargedExTier: 0,
      optionParts: [],
      supporters: [],
      supportCounterAtk: false,
      applyAdvantageEnemyTag: true,
      dmgTakenDownPilot: 0,
      dmgTakenDownUnit: 0,
      _activeSkills: {},
      _wpnCritDmgUp: 0,
      _integratedWpnCritDmgUp: 0,
      _pilotDmgCritExplicit: false
    });
  }

  function defNpc(uDef, cDef) {
    return _dcManualDefNpcFromDefC({
      un: 'Defender (MSY)', cn: 'Defender Pilot (MSY)',
      uHP: 0, uATK: 0, uDEF: uDef, uMOB: 0,
      cRNG: 0, cMEL: 0, cAWK: 0, cDEF: cDef, cREA: 0
    });
  }

  function applyPepState(ud, pepOn, pepState) {
    pepState = pepState || {};
    S.pilotConditionalPassiveActive = !!pepOn;
    if (pepOn && ud && ud.has_pilot_cond_passive) {
      S.currentDetailData = ud;
      S.pilotCondCharData = pepState.pilotCondCharData || null;
      S.pilotCondStackCount = pepState.pilotCondStackCount | 0;
    } else {
      S.pilotCondCharData = null;
      S.pilotCondStackCount = 0;
      S.currentDetailData = pepOn ? ud : null;
    }
  }

  function buildMsySlot(ud, cd, vigor, cpEnabled) {
    var slot = _dcCreateEmptyAttackerSlot();
    var charMode = msyCharStatMode(cd);
    slot.atkUnit = String(ud.id);
    slot.atkChar = String(cd.id);
    slot.atkUnitData = ud;
    slot.atkCharData = cd;
    var bw = _dcPickBestWeaponIndices(ud);
    slot.wpnIdx = bw.wpnIdx;
    slot.wpnLv = bw.wpnLv;
    slot.lbTier = 3;
    slot.unitStatMode = typeof _dcMsyUnitStatMode === 'function' ? _dcMsyUnitStatMode(ud) : 'normal';
    slot.unitCondPassive = cpEnabled;
    slot.charStatMode = charMode;
    slot.mpLevel = _dcNormMpLevel(vigor);
    S.dc.mpLevel = slot.mpLevel;
    S.dc.atkCharData = cd;
    S.dc.atkUnitData = ud;
    slot.terrainMode = 'normal';
    slot.terrain = 0;
    slot.optionParts = [];
    slot.supporters = [];
    slot.supportCounterAtk = false;
    slot.finalWpnPow = 0;
    slot.applyAdvantageEnemyTag = true;
    slot.charCondPassive = cpEnabled && (typeof _dcShouldAutoCharCondPassive === 'function'
      ? _dcShouldAutoCharCondPassive(cd, ud) : true);
    slot.dcSuperchargedExTier = 0;
    if (slot.charCondPassive && cd.ex_supercharged_tiers && cd.ex_supercharged_tiers.length > 1
        && _dcNormMpLevel(vigor) === 'super') {
      slot.dcSuperchargedExTier = cd.ex_supercharged_tiers.length - 1;
    }
    S.dc.atkCharData = cd;
    S.dc.atkUnitData = ud;
    S.dc.charStatMode = charMode;
    S.dc._activeSkills = {};
    if (typeof _dcMsyAutoEnableSkills === 'function') {
      _dcMsyAutoEnableSkills(ud, cd);
    } else if (typeof _dcAutoEnableMaxDamageSkills === 'function') {
      _dcAutoEnableMaxDamageSkills();
    }
    slot._activeSkills = Object.assign({}, S.dc._activeSkills || {});
    return slot;
  }

  function formulaStatKeyForPair(wpn) {
    if (!wpn || typeof _dcWeaponAtkStatKeys !== 'function') return 'Ranged';
    var charStats = typeof _dcGetCharStats === 'function' ? _dcGetCharStats() : null;
    if (!charStats) return 'Ranged';
    var sk = typeof _dcGetActiveSkillStatPct === 'function' ? _dcGetActiveSkillStatPct() : {};
    var atkTypes = _dcWeaponAtkStatKeys(wpn);
    var unique = [];
    atkTypes.forEach(function (k) {
      if (unique.indexOf(k) < 0) unique.push(k);
    });
    if (!unique.length) return 'Ranged';
    var val = function (k) {
      if (k === 'Awaken') {
        return typeof _dcPilotAwakenAdjustedForDc === 'function'
          ? _dcPilotAwakenAdjustedForDc(charStats, sk[k] || 0) : 0;
      }
      return typeof _dcPilotSkillAdjustedStat === 'function'
        ? _dcPilotSkillAdjustedStat(charStats, k, sk[k] || 0) : 0;
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
    var gc = typeof _dcCharGuaranteedCritActive === 'function'
      ? _dcCharGuaranteedCritActive() : false;
    var r = null;
    try { r = _dcCalculateDamageWithSlot(0); } catch (_) { r = null; }
    if (!r) return null;
    var weaponCrit = r.critical | 0;
    var critRate = weaponCrit;
    if (typeof _dcMsySkillCritRate === 'function') {
      critRate += _dcMsySkillCritRate(slot, cd) | 0;
    }
    if (typeof _dcMsyAffinityWeaponCrit === 'function') {
      critRate += _dcMsyAffinityWeaponCrit(ud, cd) | 0;
    }
    critRate = Math.min(100, Math.max(0, critRate));
    if (gc) critRate = 100;
    var normalDmg = r.normalDmg | 0;
    var critDmgVal = r.critDmg | 0;
    var canCrit = gc || critRate > 0;
    var rankSuperCrit = canCrit ? critDmgVal : normalDmg;
    var rankCrit = canCrit ? critDmgVal : normalDmg;
    var expected = Math.floor(normalDmg * (100 - critRate) / 100 + critDmgVal * critRate / 100);
    // 0% crit cannot land a crit — never rank them on theoretical critDmg (~1.3x).
    var peak = !canCrit ? normalDmg : (gc ? critDmgVal : Math.max(critDmgVal, expected));
    var pairOk = typeof _dcUnitCharPairMatch === 'function'
      ? _dcUnitCharPairMatch(cd, ud) : false;
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

  function enrichPairRow(row, dt, stats) {
    if (!row || !stats) return row;
    return Object.assign({}, row, {
      def_tier: parseInt(dt, 10),
      def_unit_def: stats.unit_def,
      def_char_def: stats.char_def,
      def_label: stats.label || ''
    });
  }

  function evalUnitJob(job) {
    var ud = job.unitData;
    var pilotIds = job.pilotIds || [];
    var pilots = job.pilots || {};
    var defTiers = job.defTiers || {};
    var cpOn = job.cpOn !== false;
    var pepOn = job.pepOn !== false;
    if (!ud || ud.error) return { error: ud && ud.error, unitId: job.unitId };
    applyPepState(ud, pepOn, job.pepState || {});
    try {
      var byTier = {};
      var tierKeys = Object.keys(defTiers);
      for (var ti = 0; ti < tierKeys.length; ti++) {
        var dt = tierKeys[ti];
        var stats = defTiers[dt];
        var tierPairs = [];
        for (var pi = 0; pi < pilotIds.length; pi++) {
          var cid = String(pilotIds[pi]);
          var cd = pilots[cid];
          if (!cd || cd.error) continue;
          var byVigor = {};
          for (var vi = 0; vi < VIGORS.length; vi++) {
            var v = VIGORS[vi];
            var d = evalPair(ud, cd, stats.unit_def, stats.char_def, v, cpOn);
            if (d) byVigor[v] = enrichPairRow(d, dt, stats);
          }
          if (Object.keys(byVigor).length) tierPairs.push([cid, byVigor]);
        }
        byTier[dt] = tierPairs;
      }
      return { unitId: job.unitId, unitName: ud.name, byTier: byTier };
    } finally {
      S.pilotConditionalPassiveActive = false;
      S.pilotCondCharData = null;
      S.pilotCondStackCount = 0;
      S.currentDetailData = null;
    }
  }

  function boot(appVer) {
    try {
      importScripts('/static/js/msy_dc_worker_shim.js');
      importScripts('/static/js/app.js?v=' + encodeURIComponent(appVer || ''));
      if (typeof _dcCalculateDamageWithSlot !== 'function'
          || typeof _dcCreateEmptyAttackerSlot !== 'function') {
        throw new Error('DC functions missing in worker');
      }
      initWorkerDc();
      ready = true;
      readyError = null;
    } catch (e) {
      ready = false;
      readyError = String(e && e.message ? e.message : e);
    }
  }

  var bootMatch = (typeof self.location !== 'undefined' && self.location.href)
    ? self.location.href.match(/[?&]v=([^&]+)/) : null;
  boot(bootMatch ? decodeURIComponent(bootMatch[1]) : '');

  self.onmessage = function (ev) {
    var msg = ev.data || {};
    if (msg.type === 'ping') {
      self.postMessage({ type: 'pong', ready: ready, error: readyError });
      return;
    }
    if (!ready) {
      self.postMessage({ type: 'eval_result', jobId: msg.jobId, error: readyError || 'worker not ready' });
      return;
    }
    if (msg.type === 'eval_unit') {
      try {
        var result = evalUnitJob(msg);
        self.postMessage({ type: 'eval_result', jobId: msg.jobId, result: result });
      } catch (e) {
        self.postMessage({ type: 'eval_result', jobId: msg.jobId, error: String(e) });
      }
    }
  };
})();
