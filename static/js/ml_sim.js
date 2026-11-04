(function (global) {
  'use strict';

  var SLOT_COUNT = 5;
  var ROSTER_KEY = 'ggen_mls_roster_v3';
  var ROSTER_KEY_LEGACY = 'ggen_mls_roster_v2';
  var AURA_VIS_KEY = 'ggen_mls_aura_vis';
  var ORDER_ENEMY_KEY = 'ggen_mls_order_enemies';
  var pickerFilter = { rarity: '', role: '' };
  var DEFAULT_EVENT = '300021';
  var mlsUnlocked = false;
  var gateBound = false;

  var seasons = [];
  var board = null;
  var seasonMeta = null;
  var cache = {};
  var pickerRows = [];
  var pickerTimer = null;
  var roster = emptyRoster();
  var lastAlly = [];
  var lastEnemy = [];
  var sideSupportData = { ally: null, enemy: null };
  /* Per unit+pilot: supporter detail with leader_skills.applies resolved (for_unit_id). */
  var supporterForUnitCache = {};
  var leaderApplyCache = {};
  var leaderApplyRefreshTimer = null;
  var LEADER_BUFF_ICON = '/static/images/UI/UI_Organization_Icon_SupporterLeader_Posi.webp';
  var fightBusy = false;
  var paused = false;
  var skipAll = false;
  var pauseWait = null;
  var speedMul = 1;
  /* gge wait(ms/speed): 1× should feel readable. Was 320; owner asked ~50% slower (desktop). */
  var STEP_MS = 640;
  var MOVE_MS = 620;
  var dmgFloatSide = 0;
  var pickerCtx = null;
  var mapOrigin = { minX: 0, minY: 0 };
  var mapCellPx = 40;
  var mapBgCacheKey = '';
  var timelinePaintSig = '';
  var viewName = 'formation';
  var mapFitBound = false;
  /* Freeze camera + cell size after first battle paint — unit moves/KOs must not keep re-fitting smaller. */
  var lockedMapWindow = null;
  var lockedMapCellPx = 0;
  /*
   * Seeded RNG only while Formation Optimizer compares lineups (fair hit rolls).
   * SIMULATION START stays free Math.random — never force crit luck to “prove” a 1T.
   * Optimizer labels 1T kills that only work with crits separately (forceNoCrit pass).
   */
  var rngLocked = false;
  var rngState = 1;
  var OPTIMIZER_SEED = 1;

  function simRandom() {
    if (!rngLocked) return Math.random();
    rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
    return rngState / 4294967296;
  }

  function beginSeededFight(seed) {
    rngLocked = true;
    rngState = (seed >>> 0) || 1;
  }

  function endSeededFight() {
    rngLocked = false;
  }

  function rules() {
    var R = global.MlsRules;
    if (R && typeof R.setRandom === 'function' && !R._mlsRandomWired) {
      R.setRandom(simRandom);
      R._mlsRandomWired = true;
    }
    return R;
  }

  function emptySlots() {
    var a = [];
    var i;
    for (i = 0; i < SLOT_COUNT; i++) a.push(null);
    return a;
  }

  function emptyForce() {
    return { supporter: null, slots: emptySlots() };
  }

  function emptyRoster() {
    return { eventId: DEFAULT_EVENT, enemy: emptyForce(), ally: emptyForce() };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 894123 → 894,123 (HP / damage floats). */
  function fmtNum(n) {
    var neg, s, out;
    n = Math.round(Number(n) || 0);
    neg = n < 0;
    s = String(Math.abs(n));
    out = '';
    while (s.length > 3) {
      out = ',' + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return (neg ? '-' : '') + s + out;
  }

  function thumbUrl(raw) {
    if (!raw) return '';
    if (typeof global.imgUrl === 'function') return global.imgUrl(raw) || raw;
    return raw;
  }

  /**
   * MLS formation cards use Supporters/sb_* (detail portrait), not Trait/thum chips.
   * List/picker rows ship Trait/thum — rewrite so ally/enemy cards stay consistent.
   */
  function supporterPortraitPath(supOrPath) {
    var raw = '';
    if (supOrPath && typeof supOrPath === 'object') {
      raw = String(supOrPath.portrait || supOrPath.thum || '').trim();
    } else {
      raw = String(supOrPath || '').trim();
    }
    if (!raw) return '';
    var m = raw.match(/\/Trait\/thum\/thum_([^/?#]+)$/i)
      || raw.match(/(?:^|\/)thum_(g[\w.-]+\.(?:webp|png|jpe?g))$/i);
    if (m) {
      var file = m[1];
      if (!/^g/i.test(file) && m[0]) {
        var m2 = String(m[0]).match(/thum_(g[\w.-]+\.(?:webp|png|jpe?g))/i);
        if (m2) file = m2[1];
      }
      return '/static/images/Supporters/sb_' + file.replace(/^thum_/i, '');
    }
    return raw;
  }

  function supporterArtUrl(supOrPath) {
    return thumbUrl(supporterPortraitPath(supOrPath));
  }

  function log(text) {
    var el = document.getElementById('mlsLog');
    if (el) el.textContent = text;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      var left = ms;
      function tick() {
        if (skipAll) { resolve(); return; }
        if (!paused) {
          setTimeout(resolve, left);
          return;
        }
        pauseWait = function () {
          pauseWait = null;
          tick();
        };
      }
      tick();
    });
  }

  function mobileBattleSnappy() {
    try {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
      if (window.matchMedia && window.matchMedia('(max-width: 820px)').matches) return true;
    } catch (e0) {}
    return false;
  }

  function battlePaceMul() {
    return Math.max(1, speedMul);
  }

  function stepDelay(kind) {
    var base = STEP_MS;
    if (kind === 'move') base = MOVE_MS;
    if (kind === 'skill' || kind === 'support-def') base = Math.round(STEP_MS * 1.45);
    if (kind === 'attack' || kind === 'counter') base = Math.round(STEP_MS * 1.15);
    /* Match shelter/cover CSS ease (~380ms) so return finishes before the next beat. */
    if (kind === 'cover-return') base = Math.round(STEP_MS * 0.72);
    if (kind === 'turn') base = Math.round(STEP_MS * 1.6);
    return Math.max(50, Math.round(base / battlePaceMul()));
  }

  /** Ranged bolt / float hold — scales with speed so phones stay readable, not laggy. */
  function rangedFlightMs(distPx) {
    var raw = Math.round((distPx || 0) * 0.48 + 28);
    return Math.max(110, Math.min(300, Math.round(raw / battlePaceMul())));
  }

  function mapMeta() {
    return (board && board.map) || {};
  }

  function collectionsOwned() {
    try {
      var o = JSON.parse(localStorage.getItem('ggen_collections_v1') || 'null');
      return {
        units: (o && o.units) || {},
        supporters: (o && o.supporters) || {}
      };
    } catch (e) {
      return { units: {}, supporters: {} };
    }
  }

  function ownedMap() {
    return collectionsOwned().units;
  }

  function ownedSupportersMap() {
    return collectionsOwned().supporters;
  }

  /** Ally Collections mode: owned-only pickers/board + sync LB from Collections. */
  function wantUseCollections() {
    var el = document.getElementById('mlsUseCollections')
      || document.getElementById('mlsOwnedOnly')
      || document.getElementById('mlsShareUseColLb');
    return !!(el && el.checked);
  }

  /** Formation picker + battle board: only kits marked in Collections. */
  function wantOwnedOnly() {
    return wantUseCollections();
  }

  function unitOwnedInCollections(unitId) {
    if (unitId == null || unitId === '') return false;
    return ownedMap()[String(unitId)] != null;
  }

  function supporterOwnedInCollections(suppId) {
    if (suppId == null || suppId === '') return false;
    return ownedSupportersMap()[String(suppId)] != null;
  }

  /**
   * Ally only: slotted but not in Collections while "Only my Collections" is on
   * → grey-out on formation / omit from Battle. Enemy force is never filtered.
   */
  function slotExcludedByCollections(sl, side) {
    if (side !== 'ally') return false;
    return !!(wantOwnedOnly() && sl && sl.unitId && !unitOwnedInCollections(sl.unitId));
  }

  function supporterExcludedByCollections(sup, side) {
    if (side !== 'ally') return false;
    return !!(wantOwnedOnly() && sup && sup.id && !supporterOwnedInCollections(sup.id));
  }

  function loadRoster() {
    try {
      var raw = localStorage.getItem(ROSTER_KEY) || localStorage.getItem(ROSTER_KEY_LEGACY);
      var o = JSON.parse(raw || 'null');
      if (!o || typeof o !== 'object') return emptyRoster();
      return {
        eventId: String(o.eventId || DEFAULT_EVENT),
        enemy: normalizeForce(o.enemy),
        ally: normalizeForce(o.ally)
      };
    } catch (e) {
      return emptyRoster();
    }
  }

  function normalizeForce(force) {
    /* v2 stored a bare slot array; v3 is { supporter, slots }. */
    if (Array.isArray(force)) {
      return { supporter: null, slots: normalizeSideSlots(force) };
    }
    if (!force || typeof force !== 'object') return emptyForce();
    return {
      supporter: force.supporter && force.supporter.id ? force.supporter : null,
      slots: normalizeSideSlots(force.slots)
    };
  }

  function normalizeSideSlots(arr) {
    var out = emptySlots();
    var i;
    if (!Array.isArray(arr)) return out;
    for (i = 0; i < SLOT_COUNT; i++) {
      if (arr[i] && arr[i].unitId) out[i] = normalizeSlot(arr[i]);
    }
    return enforceSideUniqueSlots(out);
  }

  /**
   * Master League: unit + pilot are unique per side (enemy/ally separately).
   * First slot wins; later duplicate units are cleared; duplicate pilots drop charId.
   */
  function enforceSideUniqueSlots(slots) {
    var seenU = Object.create(null);
    var seenC = Object.create(null);
    var i, sl, uid, cid;
    if (!Array.isArray(slots)) return slots;
    for (i = 0; i < slots.length; i++) {
      sl = slots[i];
      if (!sl || !sl.unitId) continue;
      uid = String(sl.unitId);
      if (seenU[uid]) {
        slots[i] = null;
        continue;
      }
      seenU[uid] = 1;
      cid = sl.charId != null && String(sl.charId) !== '' ? String(sl.charId) : '';
      if (!cid) continue;
      if (seenC[cid]) {
        sl.charId = null;
        sl.charName = '';
        sl.charThum = '';
        sl.charHasSp = false;
        sl.charStatMode = '';
        sl._charStatChecked = false;
      } else {
        seenC[cid] = 1;
      }
    }
    return slots;
  }

  /** Unit ids already on this side (except the slot being edited). */
  function usedUnitIds(side, exceptIdx) {
    var used = Object.create(null);
    forceOf(side).slots.forEach(function (sl, i) {
      if (!sl || !sl.unitId) return;
      if (i === exceptIdx) return;
      used[String(sl.unitId)] = 1;
    });
    return used;
  }

  /** Pilot ids already on this side (except the slot being edited). */
  function usedCharIds(side, exceptIdx) {
    var used = Object.create(null);
    forceOf(side).slots.forEach(function (sl, i) {
      if (!sl || !sl.charId) return;
      if (i === exceptIdx) return;
      used[String(sl.charId)] = 1;
    });
    return used;
  }

  function normalizeSlot(sl) {
    var out = {
      unitId: String(sl.unitId),
      charId: sl.charId != null ? String(sl.charId) : null,
      charName: sl.charName || '',
      charThum: sl.charThum || '',
      lb: sl.lb != null ? (sl.lb | 0) : 3,
      name: sl.name || String(sl.unitId),
      thum: sl.thum || '',
      rarity: sl.rarity || '',
      roleIcon: sl.roleIcon || '',
      roleId: sl.roleId != null ? String(sl.roleId) : '',
      optionPartId: sl.optionPartId != null ? String(sl.optionPartId) : null,
      optionPartName: sl.optionPartName || '',
      optionPartThum: sl.optionPartThum || '',
      optionPartRarity: sl.optionPartRarity || '',
      /* SSR and below: normal / SP / SSP. Absent = pick the maxed kit (SSP when the unit has one). */
      unitStatMode: sl.unitStatMode === 'sp' || sl.unitStatMode === 'ssp' || sl.unitStatMode === 'normal'
        ? sl.unitStatMode : '',
      charStatMode: sl.charStatMode === 'sp' || sl.charStatMode === 'normal' ? sl.charStatMode : '',
      unitHasSp: !!sl.unitHasSp,
      charHasSp: !!sl.charHasSp
    };
    /* Optional map start override (battle-map drag). Absent = board spawn for that slot. */
    if (sl.x != null && sl.y != null && !isNaN(+sl.x) && !isNaN(+sl.y)) {
      out.x = +sl.x | 0;
      out.y = +sl.y | 0;
    }
    return out;
  }

  /** Drop battle-map x/y overrides (season change / scrub). Units stay; homes reset to board spawn. */
  function clearMapHomeOverrides() {
    ['ally', 'enemy'].forEach(function (side) {
      var force = forceOf(side);
      (force.slots || []).forEach(function (sl) {
        if (!sl) return;
        delete sl.x;
        delete sl.y;
      });
    });
  }

  /**
   * After a board loads: drop overrides that are not a spawn cell on this season
   * (stale free-place coords, or leftover from a previous map).
   */
  function scrubInvalidMapHomeOverrides() {
    ['ally', 'enemy'].forEach(function (side) {
      var force = forceOf(side);
      (force.slots || []).forEach(function (sl) {
        if (!sl || sl.x == null || sl.y == null) return;
        if (!isSideSpawnOrigin(side, sl.x, sl.y)) {
          delete sl.x;
          delete sl.y;
        }
      });
    });
  }

  function forceOf(side) {
    return roster[side] || emptyForce();
  }

  function saveRoster() {
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
    } catch (e) {}
    /* Do NOT warm on every save — phone Wi‑Fi was drowning in OP thumb re-paints. */
  }

  /**
   * Prefetch unit/char/supporter JSON into `cache` only (no paintForceSlots).
   * Call sparingly — after MLS content load / before Start — not on every roster write.
   */
  var warmArmiesTimer = null;
  function scheduleWarmArmies() {
    clearTimeout(warmArmiesTimer);
    warmArmiesTimer = setTimeout(function () {
      if (fightBusy) return;
      warmArmiesSilent().catch(function () {});
    }, mobileBattleSnappy() ? 500 : 900);
  }

  /** Build lastAlly/lastEnemy + fill fetch cache without rebuilding formation DOM. */
  function warmArmiesSilent() {
    var owned = ownedMap();
    return Promise.all([
      loadSupporter('ally'),
      loadSupporter('enemy')
    ]).then(function (sups) {
      var allySup = supporterExcludedByCollections(forceOf('ally').supporter, 'ally') ? null : sups[0];
      void allySup;
      void sups[1];
      return Promise.all([
        buildSide('ally', allyCells(), forceOf('ally').slots, owned),
        buildSide('enemy', enemyCells(), forceOf('enemy').slots, owned)
      ]);
    }).then(function (pair) {
      lastAlly = pair[0];
      lastEnemy = pair[1];
      stampSquadBuffs(lastAlly);
      stampSquadBuffs(lastEnemy);
      /* Intentionally skip paintForceSlots / paintTimeline — those re-create <img> and thrash mobile. */
    });
  }

  /** Formation + battle toggles both write ORDER_ENEMY_KEY — prefer that over a single checkbox. */
  function includeEnemyOrder() {
    try { return localStorage.getItem(ORDER_ENEMY_KEY) !== '0'; } catch (e) {
      var a = document.getElementById('mlsOrderEnemies');
      var b = document.getElementById('mlsOrderEnemiesForm');
      if (a) return !!a.checked;
      if (b) return !!b.checked;
      return true;
    }
  }

  function syncOrderToggleUi() {
    var a = document.getElementById('mlsOrderEnemies');
    var b = document.getElementById('mlsOrderEnemiesForm');
    var on = true;
    try { on = localStorage.getItem(ORDER_ENEMY_KEY) !== '0'; } catch (e) {}
    if (a) a.checked = on;
    if (b) b.checked = on;
  }

  function onOrderEnemiesChange(ev) {
    var on = !!(ev && ev.target && ev.target.checked);
    try { localStorage.setItem(ORDER_ENEMY_KEY, on ? '1' : '0'); } catch (e) {}
    syncOrderToggleUi();
    /* Reload both forces — formation picks can leave lastEnemy stale until this. */
    scheduleOrderRefresh();
  }

  function collectionsLbFromBag(bag, id) {
    try {
      if (!bag || id == null || id === '') return null;
      var v = bag[String(id)];
      if (v == null || v === '') return null;
      var n = parseInt(v, 10);
      if (isNaN(n) || n < 0) return null;
      return Math.max(0, Math.min(3, n));
    } catch (e) {
      return null;
    }
  }

  function collectionsLb(unitId) {
    return collectionsLbFromBag(ownedMap(), unitId);
  }

  function collectionsSupporterLb(suppId) {
    return collectionsLbFromBag(ownedSupportersMap(), suppId);
  }

  function wantCollectionsLbSync() {
    return wantUseCollections();
  }

  /**
   * Ally only: sync unit + supporter Limit Break from Collections (exact ids).
   * Unowned / missing ids are left alone. Returns how many entities changed.
   */
  function applyCollectionsLbToAllyForce() {
    var force, slots, i, lb, n, sup;
    if (!wantCollectionsLbSync()) return 0;
    force = forceOf('ally');
    slots = force.slots;
    n = 0;
    for (i = 0; i < slots.length; i++) {
      if (!slots[i] || !slots[i].unitId) continue;
      lb = collectionsLb(slots[i].unitId);
      if (lb == null) continue;
      if ((slots[i].lb | 0) !== lb) {
        slots[i].lb = lb;
        n++;
      }
    }
    sup = force.supporter;
    if (sup && sup.id) {
      lb = collectionsSupporterLb(sup.id);
      if (lb != null && (sup.lb | 0) !== lb) {
        sup.lb = lb;
        n++;
      }
    }
    return n;
  }

  function syncAllyLbsFromCollections(opts) {
    var n = applyCollectionsLbToAllyForce();
    opts = opts || {};
    if (n || opts.forcePaint) {
      saveRoster();
      paintForceSlots();
      fillShareBoxes();
      scheduleOrderRefresh();
      if (viewName === 'battle') {
        loadArmies().then(function () { paintBoard(); paintTimeline(); });
      }
    }
    return n;
  }

  var MLS_RARITY_ICONS = {
    UR: '/static/images/Rarity/UI_Common_RarityIcon_UR.webp',
    SSR: '/static/images/Rarity/UI_Common_RarityIcon_SSR.webp',
    SR: '/static/images/Rarity/UI_Common_RarityIcon_SR.webp',
    R: '/static/images/Rarity/UI_Common_RarityIcon_R.webp',
    N: '/static/images/Rarity/UI_Common_RarityIcon_N.webp'
  };
  var MLS_ROLE_ICONS = {
    '1': '/static/images/UI/UI_Common_TypeIcon_Attack_M.webp',
    '2': '/static/images/UI/UI_Common_TypeIcon_Defense_M.webp',
    '3': '/static/images/UI/UI_Common_TypeIcon_Support_M.webp'
  };
  var MLS_SUPP_CAT_ICON = '/static/images/UI/UI_Common_Icon_Category_Supporter_Main.webp';

  function mlsIconImg(path, cls, alt) {
    if (!path) return '';
    return '<img class="' + (cls || 'mls-ic') + '" src="' + esc(thumbUrl(path)) +
      '" alt="' + esc(alt || '') + '" width="18" height="18" loading="lazy" decoding="async">';
  }

  function rarityIconHtml(rarity, cls) {
    var key = String(rarity || '').toUpperCase();
    var path = MLS_RARITY_ICONS[key];
    return path ? mlsIconImg(path, cls || 'mls-ic mls-ic--rarity', key) : (key ? esc(key) : '');
  }

  function roleIconHtml(roleIconOrId, cls) {
    var path = '';
    var id = String(roleIconOrId || '');
    if (/^\/static\//.test(id) || /^https?:/i.test(id)) path = id;
    else if (MLS_ROLE_ICONS[id]) path = MLS_ROLE_ICONS[id];
    return path ? mlsIconImg(path, cls || 'mls-ic mls-ic--role', '') : '';
  }

  /** Compact share token: omit default LB3 and empty option part. */
  function slotShareToken(sl) {
    var lb, op, ch;
    if (!sl || !sl.unitId) return '-';
    lb = sl.lb != null ? (sl.lb | 0) : 3;
    op = sl.optionPartId || '';
    ch = sl.charId || '';
    if (!op && lb === 3) return ch ? (sl.unitId + ',' + ch) : String(sl.unitId);
    if (!op) return [sl.unitId, ch, lb].join(',');
    return [sl.unitId, ch, lb, op].join(',');
  }

  function supporterShareToken(sup) {
    var lb;
    if (!sup || !sup.id) return '-';
    lb = sup.lb != null ? (sup.lb | 0) : 3;
    return lb === 3 ? String(sup.id) : (String(sup.id) + ',' + lb);
  }

  /**
   * MLS2|supporterId[,lb]|unit;unit;… — includes supporter + unit slots.
   * MLS1|unit;… still loads (no supporter). Combined E:/A: dual codes accepted.
   */
  function exportForceCode(side) {
    var force = forceOf(side);
    var parts = force.slots.map(slotShareToken);
    while (parts.length && parts[parts.length - 1] === '-') parts.pop();
    return 'MLS2|' + supporterShareToken(force.supporter) + '|' + parts.join(';');
  }

  function parseForcePayload(text) {
    var raw = String(text || '').trim();
    var slots = emptySlots();
    var supporter = null;
    var bits, i, bit, cols, sl, pipe, supBit, sc;
    if (!raw) return { slots: slots, supporter: null };
    if (/^MLS2\|/i.test(raw)) {
      raw = raw.replace(/^MLS2\|/i, '');
      pipe = raw.indexOf('|');
      if (pipe >= 0) {
        supBit = String(raw.slice(0, pipe) || '').trim();
        raw = raw.slice(pipe + 1);
        if (supBit && supBit !== '-') {
          sc = supBit.split(',');
          if (sc[0]) {
            supporter = {
              id: String(sc[0]),
              lb: sc[1] != null && sc[1] !== '' ? (parseInt(sc[1], 10) || 0) : 3,
              name: String(sc[0]),
              thum: '',
              rarity: ''
            };
          }
        }
      }
    } else {
      raw = raw.replace(/^MLS1\|/i, '');
    }
    if (/^[EA]:/i.test(raw) && raw.indexOf('|') >= 0) return null;
    bits = raw.split(';');
    for (i = 0; i < SLOT_COUNT && i < bits.length; i++) {
      bit = String(bits[i] || '').trim();
      if (!bit || bit === '-') continue;
      cols = bit.split(',');
      if (!cols[0]) continue;
      sl = {
        unitId: cols[0],
        charId: cols[1] || null,
        lb: cols[2] != null && cols[2] !== '' ? (parseInt(cols[2], 10) || 0) : 3,
        optionPartId: cols[3] || null,
        name: cols[0],
        thum: '',
        charName: '',
        charThum: ''
      };
      slots[i] = normalizeSlot(sl);
    }
    return { slots: slots, supporter: supporter };
  }

  function parseForceCode(text) {
    var parsed = parseForcePayload(text);
    return parsed ? parsed.slots : null;
  }

  function applyShareText(side, text) {
    var raw = String(text || '').trim();
    var parsed, slots, force, synced;
    if (/^MLS[12]\|E:/i.test(raw) && /\|A:/i.test(raw)) {
      var ver = /^MLS2\|/i.test(raw) ? 'MLS2|' : 'MLS1|';
      var enemyPart = raw.replace(/^MLS[12]\|E:/i, '').split(/\|A:/i)[0];
      var allyPart = (raw.split(/\|A:/i)[1] || '');
      applyShareText('enemy', ver + enemyPart);
      applyShareText('ally', ver + allyPart);
      return;
    }
    parsed = parseForcePayload(raw);
    if (!parsed || !parsed.slots) return;
    slots = enforceSideUniqueSlots(parsed.slots);
    force = forceOf(side);
    force.slots = slots;
    force.supporter = parsed.supporter;
    synced = 0;
    if (side === 'ally') synced = applyCollectionsLbToAllyForce();
    saveRoster();
    paintForceSlots();
    shareFaceLayoutKey[side] = '';
    fillShareBoxes();
    hydrateSlotPilotsAndOps().then(function () {
      /* Re-apply after hydrate in case slot objects were replaced. */
      if (side === 'ally') applyCollectionsLbToAllyForce();
      shareFaceLayoutKey.enemy = '';
      shareFaceLayoutKey.ally = '';
      fillShareBoxes();
      scheduleOrderRefresh();
      if (viewName === 'battle') return loadArmies().then(function () { paintBoard(); paintTimeline(); });
      return null;
    });
    log('Loaded ' + side + ' from share code.' +
      (synced ? (' Synced ' + synced + ' Limit Break(s) from Collections.') : ''));
  }

  function forceHasUnits(side) {
    return forceOf(side).slots.some(function (sl) {
      return sl && sl.unitId && !slotExcludedByCollections(sl, side);
    });
  }

  var shareFaceLayoutKey = { enemy: '', ally: '' };
  var SHARE_FACE_FALLBACK = [
    '/static/images/Popup/win_g8500n00200_01.webp',
    '/static/images/Popup/win_g8500n00300_01.webp',
    '/static/images/Popup/win_g8500n00400_01.webp',
    '/static/images/Popup/win_g8500n00700_01.webp',
    '/static/images/Popup/win_g3700n00015_01.webp'
  ];

  function shareFaceImgHtml(src, cls, title) {
    return '<img' + (cls ? (' class="' + cls + '"') : '') + ' src="' + esc(src) +
      '" alt="" width="56" height="56" loading="lazy" decoding="async"' +
      (title ? (' title="' + esc(title) + '"') : '') + '>';
  }

  /**
   * Live unit/supporter thumbs in formation order (no scramble):
   * enemy → supporter, then slot 5→1 · ally → slot 1→5, then supporter.
   */
  function paintShareFaceStrip(faces, side) {
    var force, html, i, sl, src, sup, idxs;
    if (!faces) return;
    force = forceOf(side);
    html = '';
    idxs = [];
    for (i = 0; i < SLOT_COUNT; i++) idxs.push(i);
    if (side === 'enemy') idxs.reverse();

    function appendUnit(slotIdx) {
      sl = force.slots[slotIdx];
      if (!sl || !sl.unitId) return;
      src = thumbUrl(sl.thum || '');
      if (!src) return;
      html += shareFaceImgHtml(src, '', sl.name || '');
    }
    function appendSup() {
      sup = force.supporter;
      if (!sup || !sup.id) return;
      src = supporterArtUrl(sup);
      if (!src) return;
      html += shareFaceImgHtml(src, 'mls-share-face--supp', sup.name || 'Supporter');
    }

    if (side === 'enemy') {
      appendSup();
      idxs.forEach(appendUnit);
    } else {
      idxs.forEach(appendUnit);
      appendSup();
    }
    /* Haro popup art is empty-force chrome only — never after a share load that still awaits hydrate. */
    if (!html) {
      var hasIds = !!(force.supporter && force.supporter.id) ||
        force.slots.some(function (s) { return s && s.unitId; });
      if (!hasIds) {
        SHARE_FACE_FALLBACK.forEach(function (path) {
          html += shareFaceImgHtml(thumbUrl(path), '', '');
        });
      }
    }
    faces.innerHTML = html;
  }

  /** Code + live thumbs — hydrate fills thum after MLS2 load; code alone would skip the strip repaint. */
  function shareFaceLayoutSig(side) {
    var force = forceOf(side);
    var parts = [exportForceCode(side)];
    var i, sl, sup;
    for (i = 0; i < SLOT_COUNT; i++) {
      sl = force.slots[i];
      parts.push(sl && sl.unitId ? String(sl.thum || '') : '');
    }
    sup = force.supporter;
    parts.push(sup && sup.id ? String(supporterPortraitPath(sup) || '') : '');
    return parts.join('\0');
  }

  function syncShareFacesReady() {
    var eCol = document.querySelector('.mls-share-col--enemy .mls-share-faces');
    var aCol = document.querySelector('.mls-share-col--ally .mls-share-faces');
    var eReady = forceHasUnits('enemy') || !!(forceOf('enemy').supporter && forceOf('enemy').supporter.id);
    var aReady = forceHasUnits('ally') || !!(forceOf('ally').supporter && forceOf('ally').supporter.id);
    var eKey = eReady ? shareFaceLayoutSig('enemy') : '';
    var aKey = aReady ? shareFaceLayoutSig('ally') : '';
    if (eCol) {
      if (eKey !== shareFaceLayoutKey.enemy) paintShareFaceStrip(eCol, 'enemy');
      shareFaceLayoutKey.enemy = eKey;
      eCol.classList.toggle('is-ready', eReady);
    }
    if (aCol) {
      if (aKey !== shareFaceLayoutKey.ally) paintShareFaceStrip(aCol, 'ally');
      shareFaceLayoutKey.ally = aKey;
      aCol.classList.toggle('is-ready', aReady);
    }
  }

  /** Takayu-style tx-decrypt-center glyphs — only shown on Copy / Load. */
  var SHARE_CIPHER_GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789|/;:#*+-=<>';
  var shareCipherTimers = { enemy: null, ally: null };
  var shareCipherHold = { enemy: null, ally: null };
  var shareInputArmed = { enemy: false, ally: false };

  function preferReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (eRm) {
      return false;
    }
  }

  function shareCipherEl(side) {
    return document.getElementById(side === 'enemy' ? 'mlsShareEnemyCipher' : 'mlsShareAllyCipher');
  }

  function shareCipherHost(side) {
    var el = shareCipherEl(side);
    return el && el.closest ? el.closest('.mls-share-cipher-host') : null;
  }

  function shareBoxEl(side) {
    return document.getElementById(side === 'enemy' ? 'mlsShareEnemy' : 'mlsShareAlly');
  }

  function stopShareCipher(side) {
    if (shareCipherTimers[side]) {
      clearInterval(shareCipherTimers[side]);
      shareCipherTimers[side] = null;
    }
    if (shareCipherHold[side]) {
      clearTimeout(shareCipherHold[side]);
      shareCipherHold[side] = null;
    }
  }

  function randomShareGlyph() {
    return SHARE_CIPHER_GLYPHS.charAt((Math.random() * SHARE_CIPHER_GLYPHS.length) | 0);
  }

  function hideSharePanel(side, immediate) {
    var host = shareCipherHost(side);
    var box = shareBoxEl(side);
    var cipher = shareCipherEl(side);
    stopShareCipher(side);
    shareInputArmed[side] = false;
    if (!host) return;
    host.classList.remove('is-input', 'is-editing', 'is-copy-fx');
    if (cipher) cipher.classList.remove('is-decrypting', 'is-copied', 'is-prompt');
    function close() {
      host.classList.remove('is-open', 'is-fading');
      host.hidden = true;
      if (cipher) cipher.textContent = '';
      if (box && document.activeElement !== box) box.value = '';
    }
    if (immediate || preferReducedMotion() || !host.classList.contains('is-open')) {
      close();
      return;
    }
    host.classList.add('is-fading');
    shareCipherHold[side] = setTimeout(close, 280);
  }

  function openSharePanel(side, mode) {
    var host = shareCipherHost(side);
    var box = shareBoxEl(side);
    var cipher = shareCipherEl(side);
    if (!host) return;
    stopShareCipher(side);
    host.hidden = false;
    host.classList.remove('is-fading');
    host.classList.add('is-open');
    host.classList.toggle('is-input', mode === 'input');
    host.classList.toggle('is-copy-fx', mode === 'copy');
    host.classList.remove('is-editing');
    if (cipher) cipher.classList.remove('is-decrypting', 'is-copied', 'is-prompt');
    if (mode === 'input' && box) {
      box.value = '';
      shareInputArmed[side] = true;
    }
  }

  /**
   * Center-out decrypt → “Formation Copied”, then fade the panel away.
   */
  function playCopiedShareCipher(side) {
    var el = shareCipherEl(side);
    var host = shareCipherHost(side);
    var target = 'Formation Copied';
    var fieldLen, pad, finalChars, order, locked, chars, mid, step, tick, i, d, L, R;
    openSharePanel(side, 'copy');
    if (!el || !host) return;
    el.classList.remove('is-prompt');
    if (preferReducedMotion()) {
      el.textContent = target;
      el.classList.add('is-copied');
      shareCipherHold[side] = setTimeout(function () { hideSharePanel(side); }, 1100);
      return;
    }
    fieldLen = Math.max(target.length + 6, 22);
    if (fieldLen % 2 === 0) fieldLen += 1;
    pad = ((fieldLen - target.length) / 2) | 0;
    finalChars = [];
    for (i = 0; i < fieldLen; i++) {
      finalChars.push(i >= pad && i < pad + target.length ? target.charAt(i - pad) : ' ');
    }
    mid = (fieldLen - 1) / 2;
    order = [];
    for (d = 0; d <= Math.ceil(fieldLen / 2); d++) {
      L = Math.floor(mid - d);
      R = Math.ceil(mid + d);
      if (L >= 0 && order.indexOf(L) < 0) order.push(L);
      if (R < fieldLen && order.indexOf(R) < 0) order.push(R);
    }
    locked = Object.create(null);
    chars = [];
    for (i = 0; i < fieldLen; i++) chars.push(randomShareGlyph());
    step = 0;
    tick = 0;
    el.classList.add('is-decrypting');
    el.textContent = chars.join('');
    shareCipherTimers[side] = setInterval(function () {
      tick += 1;
      for (i = 0; i < fieldLen; i++) {
        if (locked[i]) continue;
        chars[i] = finalChars[i] === ' ' ? ' ' : randomShareGlyph();
      }
      if (tick > 6 && ((tick - 6) % 2) === 0 && step < order.length) {
        locked[order[step]] = true;
        chars[order[step]] = finalChars[order[step]];
        step += 1;
      }
      el.textContent = chars.join('');
      if (step >= order.length) {
        stopShareCipher(side);
        el.textContent = target;
        el.classList.remove('is-decrypting');
        el.classList.add('is-copied');
        shareCipherHold[side] = setTimeout(function () { hideSharePanel(side); }, 1200);
      }
    }, 42);
  }

  function openShareInputPanel(side) {
    var el = shareCipherEl(side);
    var box = shareBoxEl(side);
    var prompt = 'Please input the code';
    openSharePanel(side, 'input');
    if (el) {
      el.textContent = prompt;
      el.classList.add('is-prompt');
      el.classList.remove('is-decrypting', 'is-copied');
    }
    if (box) {
      try {
        box.focus();
        box.select();
      } catch (eF) { /* ignore */ }
    }
    setShareStatus(side, prompt, false);
  }

  function tryAutoLoadShareInput(side) {
    var box = shareBoxEl(side);
    var raw;
    if (!shareInputArmed[side] || !box) return;
    raw = String(box.value || '').trim();
    if (!looksLikeShareCode(raw)) return;
    shareInputArmed[side] = false;
    applyShareCode(side, raw);
  }

  function bindShareCipherHosts() {
    ['enemy', 'ally'].forEach(function (side) {
      var box = shareBoxEl(side);
      var host = shareCipherHost(side);
      if (!box || !host || host._mlsCipherBound) return;
      host._mlsCipherBound = true;
      box.addEventListener('focus', function () {
        if (!host.classList.contains('is-input')) return;
        host.classList.add('is-editing');
      });
      box.addEventListener('blur', function () {
        host.classList.remove('is-editing');
        if (host.classList.contains('is-input') && shareInputArmed[side] &&
            !looksLikeShareCode(box.value)) {
          var c = shareCipherEl(side);
          if (c) {
            c.textContent = 'Please input the code';
            c.classList.add('is-prompt');
          }
        }
      });
      box.addEventListener('input', function () { tryAutoLoadShareInput(side); });
      box.addEventListener('paste', function () {
        setTimeout(function () { tryAutoLoadShareInput(side); }, 0);
      });
    });
  }

  function fillShareBoxes() {
    bindShareCipherHosts();
    /* Keep closed by default; leave an open Copy/Load panel alone during roster refreshes. */
    ['enemy', 'ally'].forEach(function (side) {
      var host = shareCipherHost(side);
      if (host && host.classList.contains('is-open')) return;
      hideSharePanel(side, true);
    });
    syncShareFacesReady();
  }

  function shareSideLabel(side) {
    return side === 'enemy'
      ? mlsT('mls_enemy_forces', 'Enemy Forces')
      : mlsT('mls_your_forces', 'Your Forces');
  }

  function setShareStatus(side, msg, isErr) {
    var el = document.getElementById(side === 'enemy' ? 'mlsShareEnemyStatus' : 'mlsShareAllyStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-err', !!isErr);
  }

  function looksLikeShareCode(text) {
    var t = String(text || '').trim();
    return /^MLS[12]\|/i.test(t) || (/^[EA]:/i.test(t) && t.indexOf('|') >= 0);
  }

  function forceIsEmpty(side) {
    var f = forceOf(side);
    var hasUnit = f.slots.some(function (sl) { return sl && sl.unitId; });
    var hasSup = !!(f.supporter && f.supporter.id);
    return !hasUnit && !hasSup;
  }

  /**
   * Sync clipboard write — required on iOS Safari over http://LAN (no secure context;
   * navigator.clipboard.writeText is missing or always rejects). Must run inside the tap.
   */
  function copyTextToClipboardSync(text) {
    var ta, prev, okCopy;
    text = String(text || '');
    if (!text) return false;
    prev = document.activeElement;
    ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.setAttribute('aria-hidden', 'true');
    /* In-view + 16px: iOS will select; opacity 0 keeps it invisible. */
    ta.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;padding:0;margin:0;border:0;opacity:0;font-size:16px;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { ta.setSelectionRange(0, text.length); } catch (eSel) { /* ignore */ }
    okCopy = false;
    try { okCopy = !!document.execCommand('copy'); } catch (eCopy) { okCopy = false; }
    if (ta.parentNode) ta.parentNode.removeChild(ta);
    try { if (prev && typeof prev.focus === 'function') prev.focus(); } catch (eFocus) { /* ignore */ }
    return okCopy;
  }

  /** Last resort: put the code in the Load field and select it for long-press copy. */
  function revealShareCodeForManualCopy(side, text) {
    var box = shareBoxEl(side);
    var el = shareCipherEl(side);
    openSharePanel(side, 'input');
    shareInputArmed[side] = false;
    if (el) {
      el.textContent = 'Select & copy';
      el.classList.add('is-prompt');
      el.classList.remove('is-decrypting', 'is-copied');
    }
    if (!box) return;
    box.value = String(text || '');
    try {
      box.focus();
      box.select();
      box.setSelectionRange(0, box.value.length);
    } catch (eMan) { /* ignore */ }
  }

  /**
   * Copy → clipboard + short decrypt panel (“Formation Copied”) then fade away.
   * Load → open “Please input the code”; valid MLS code auto-applies (no extra click).
   */
  function copyShare(side) {
    var btn = document.getElementById(side === 'enemy' ? 'mlsShareEnemyCopy' : 'mlsShareAllyCopy');
    var text = exportForceCode(side);
    var sideLab = shareSideLabel(side);
    var msg;
    if (forceIsEmpty(side)) {
      msg = mlsT('mls_share_empty', 'Force is empty — pick units first.');
      setShareStatus(side, msg, true);
      log(msg);
      return;
    }
    function ok() {
      msg = mlsT('mls_share_copied', 'Copied {side} force code').replace('{side}', sideLab);
      setShareStatus(side, msg, false);
      log(msg);
      playCopiedShareCipher(side);
      if (btn) {
        btn.classList.add('is-flash');
        setTimeout(function () { btn.classList.remove('is-flash'); }, 450);
      }
    }
    function fail() {
      msg = mlsT('mls_share_copy_fail',
        'Clipboard blocked — code is selected below; long-press → Copy');
      setShareStatus(side, msg, true);
      log(msg);
      revealShareCodeForManualCopy(side, text);
    }
    /* 1) Sync execCommand while the tap is still “user activation” (iOS + http://192.168.x). */
    if (copyTextToClipboardSync(text)) {
      ok();
      return;
    }
    /* 2) Async Clipboard API only on HTTPS / localhost secure contexts. */
    if (typeof window !== 'undefined' && window.isSecureContext &&
        navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(ok, fail);
      return;
    }
    fail();
  }

  function applyShareCode(side, text) {
    var raw = String(text || '').trim();
    var el = shareBoxEl(side);
    var sideLab = shareSideLabel(side);
    var msg;
    if (!raw) {
      msg = mlsT('mls_share_empty', 'Force is empty — pick units first.');
      setShareStatus(side, msg, true);
      log('Share code empty.');
      return false;
    }
    if (!looksLikeShareCode(raw)) {
      msg = mlsT('mls_share_bad', 'Not an MLS share code (need MLS2|… or MLS1|…).');
      setShareStatus(side, msg, true);
      log(msg);
      return false;
    }
    if (el) el.value = raw;
    applyShareText(side, raw);
    msg = mlsT('mls_share_loaded', 'Loaded {side} force').replace('{side}', sideLab);
    setShareStatus(side, msg, false);
    hideSharePanel(side);
    return true;
  }

  function loadShareFromClipboard(side) {
    openShareInputPanel(side);
    return Promise.resolve();
  }

  function fetchJson(url) {
    if (cache[url]) return Promise.resolve(cache[url]);
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    }).then(function (j) {
      cache[url] = j;
      return j;
    });
  }

  function lang() {
    return (global.S && global.S.lang) || 'EN';
  }

  function seasonLabel(s) {
    var tags = (s.boost_tags || []).map(function (t) { return t.name; }).filter(Boolean);
    var env = s.terrain_primary || '—';
    var bits = [env].concat(tags.slice(0, 2));
    var title = s.title || ('Season ' + (s.season_number != null ? s.season_number : s.event_id));
    return title + ' (' + bits.join(' / ') + ')';
  }

  function findSeason(eventId) {
    var id = String(eventId || '');
    var i;
    for (i = 0; i < seasons.length; i++) {
      if (String(seasons[i].event_id) === id) return seasons[i];
    }
    return null;
  }

  function fillSeasonSelect() {
    var sel = document.getElementById('mlsSeasonSelect');
    if (!sel) return;
    var prefer = roster.eventId || DEFAULT_EVENT;
    var html = '';
    var sorted = seasons.slice().sort(function (a, b) {
      return (b.season_number | 0) - (a.season_number | 0);
    });
    sorted.forEach(function (s) {
      html += '<option value="' + esc(s.event_id) + '"' +
        (String(s.event_id) === String(prefer) ? ' selected' : '') + '>' +
        esc(seasonLabel(s)) + '</option>';
    });
    sel.innerHTML = html || '<option value="' + DEFAULT_EVENT + '">SEASON 18</option>';
  }

  function formationLabel() {
    if (board && board.formation === 'line') return 'LINE';
    if (board && board.formation) return String(board.formation).toUpperCase();
    return 'STANDARD';
  }

  function turnsLabel() {
    return String((board && board.limit_turns) || (seasonMeta && seasonMeta.limit_turns) || 5);
  }

  /**
   * Same boost banner as /ml (mlRenderBoostCard). Formation + turns stay as sim meta —
   * those are not on the Master League season page card.
   */
  function paintPreset() {
    var host = document.getElementById('mlsPresetBar');
    var s = seasonMeta;
    var cardHtml = '';
    var form = formationLabel();
    var turns = turnsLabel();
    if (!host) return;
    if (s && typeof global.mlRenderBoostCard === 'function') {
      try {
        cardHtml = global.mlRenderBoostCard(s) || '';
      } catch (ePaint) {
        cardHtml = '';
      }
    }
    if (!cardHtml) {
      cardHtml =
        '<div class="ml-boost-card ml-boost-card--spark-bg">' +
        '<div class="ml-boost-inner">' +
        '<div class="ml-boost-stage-row"><span class="ml-boost-stage-label">Stage: ' +
        esc((s && s.terrain_primary) || '—') + '</span></div>' +
        '<div class="ml-boost-tag-block">' +
        '<div class="ml-boost-heading">Boost: Tag</div>' +
        '<div class="ml-boost-pct">' +
        esc(
          (s && s.buff_percent != null)
            ? ('Increase all Stats by ' + s.buff_percent + '%')
            : '—'
        ) +
        '</div></div></div></div>';
    }
    host.innerHTML =
      cardHtml +
      '<div class="mls-preset-meta">' +
      '<div class="mls-preset-item"><span class="mls-lbl">FORMATION</span><strong id="mlsFormLabel">' +
      esc(form) + '</strong></div>' +
      '<div class="mls-preset-item"><span class="mls-lbl">TURNS</span><strong id="mlsTurns">' +
      esc(turns) + '</strong></div>' +
      '</div>';
  }

  function sideCells(playerSide) {
    var out = [];
    (board && board.sides || []).forEach(function (s) {
      if ((s.player_side | 0) === playerSide) out = (s.cells || []).slice();
    });
    return out;
  }

  /* Master: player_side 1 = right (ally), 2 = left (enemy). */
  function allyCells() { return sideCells(1); }
  function enemyCells() { return sideCells(2); }

  function paintForceSlots() {
    paintSupporter('mlsEnemySupp', 'enemy');
    paintSupporter('mlsAllySupp', 'ally');
    paintSlotList('mlsEnemySlots', forceOf('enemy').slots, 'enemy');
    paintSlotList('mlsAllySlots', forceOf('ally').slots, 'ally');
    fillShareBoxes();
    void renderMlsStats();
    scheduleLeaderApplyRefresh();
  }

  function sideFacing(side) {
    var want = side === 'ally' ? 1 : 2;
    var found = null;
    (board && board.sides || []).forEach(function (s) {
      if ((s.player_side | 0) === want) found = s.direction | 0;
    });
    /* MasterData: 1=Right, 3=Left. Ally faces left; enemy faces right. */
    if (found) return found;
    return side === 'ally' ? 3 : 1;
  }

  /** 2×2 expands behind facing (= outward from midfield on LINE). */
  function footprintDx(side, direction) {
    var dir = direction != null ? (direction | 0) : sideFacing(side);
    if (dir === 1) return -1;
    if (dir === 3) return 1;
    return side === 'ally' ? 1 : -1;
  }

  /* Same grade pips as detail / collections (UI_Common_Icon_Grade_M_*). */
  var MLS_LB_ICONS = {
    None: '/static/images/UI/UI_Common_Icon_Grade_M_None.webp',
    Neutral: '/static/images/UI/UI_Common_Icon_Grade_M_Neutral.webp',
    Max: '/static/images/UI/UI_Common_Icon_Grade_M_Max.webp'
  };

  function lbPipKeys(tier) {
    if (tier <= 0) return ['None', 'None', 'None'];
    if (tier === 1) return ['Neutral', 'None', 'None'];
    if (tier === 2) return ['Neutral', 'Neutral', 'None'];
    return ['Max', 'Max', 'Max'];
  }

  function lbButtonsHtml(side, idx, cur, kind) {
    var h = '';
    var i, keys, imgs;
    for (i = 0; i <= 3; i++) {
      keys = lbPipKeys(i);
      imgs = keys.map(function (k) {
        return '<img src="' + esc(thumbUrl(MLS_LB_ICONS[k])) + '" alt="" loading="lazy" decoding="async">';
      }).join('');
      h += '<button type="button" class="mls-lb-btn' + (i === cur ? ' is-on' : '') +
        '" data-mls-lb="' + side + ':' + idx + ':' + i + ':' + kind +
        '" title="LB' + i + '" aria-label="Limit Break ' + i + '">' + imgs + '</button>';
    }
    return h;
  }

  var MLS_SP_ICON = '/static/images/UI/UI_Common_Icon_Sp.webp';
  var MLS_SSP_ICON = '/static/images/UI/UI_Common_Icon_Ssp.webp';
  /** Master League SD card digit plates (slots 1–5). */
  var MLS_SLOT_NUM_BASE = '/static/images/Master League/UI_Event_SD_Card_Text_';

  function slotNumBadgeHtml(n) {
    var num = Math.max(1, Math.min(5, n | 0));
    var src = thumbUrl(MLS_SLOT_NUM_BASE + num + '.webp');
    return '<img class="mls-slot-n-img" src="' + esc(src) + '" alt="#' + num +
      '" width="22" height="22" loading="lazy" decoding="async" draggable="false">';
  }

  function statModeBtn(side, idx, kind, mode, on, icon, label) {
    return '<button type="button" class="mls-sp-btn' + (on ? ' is-on' : '') +
      '" data-mls-stat="' + side + ':' + idx + ':' + kind + ':' + mode +
      '" title="' + esc(label) + '" aria-label="' + esc(label) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
      '<img src="' + esc(thumbUrl(icon)) + '" alt=""></button>';
  }

  /** SP + SSP on the unit, same icons as /u. Hidden on UR and kits with no SP path. */
  function statModeButtonsHtml(sl, side, idx) {
    var mode, show;
    if (!sl) return '';
    show = sl._statChecked ? !!sl.unitHasSp : rarityAllowsSpSsp(sl.rarity);
    if (!show) return '';
    mode = sl.unitStatMode || '';
    return '<span class="mls-stat-modes">' +
      statModeBtn(side, idx, 'unit', 'sp', mode === 'sp', MLS_SP_ICON, 'SP') +
      statModeBtn(side, idx, 'unit', 'ssp', mode === 'ssp', MLS_SSP_ICON, 'SSP') +
      '</span>';
  }

  /** Pilot SP, same icon as /c. Hidden on UR pilots. */
  function charSpButtonHtml(sl, side, idx) {
    var show, mode;
    if (!sl || !sl.charId) return '';
    if (sl._charStatChecked) show = !!sl.charHasSp;
    else show = true;
    if (!show) return '';
    mode = sl.charStatMode || '';
    return statModeBtn(side, idx, 'char', 'sp', mode === 'sp', MLS_SP_ICON, 'Pilot SP');
  }

  function paintSupporter(hostId, side) {
    var host = document.getElementById(hostId);
    if (!host) return;
    var sup = forceOf(side).supporter;
    var lb = sup && sup.lb != null ? (sup.lb | 0) : 3;
    var catIc = mlsIconImg(MLS_SUPP_CAT_ICON, 'mls-ic mls-ic--supp', 'Supporter');
    var rarIc = rarityIconHtml(sup && sup.rarity, 'mls-ic mls-ic--rarity');
    var unowned = supporterExcludedByCollections(sup, side);
    if (sup && sup.id) {
      host.innerHTML =
        '<button type="button" class="mls-supp-card has-supp' + (unowned ? ' is-unowned' : '') +
        '" data-mls-pick-supp="' + side + '" title="' +
        (unowned
          ? 'Not in Collections — greyed out; ignored on Battle while Only my Collections is on (ally only)'
          : 'Supporter · tag-boosted unit suggestions') + '">' +
        '<img class="mls-supp-thum" src="' + esc(supporterArtUrl(sup)) + '" alt="" loading="lazy" decoding="async">' +
        '<span class="mls-supp-meta"><span class="name">' + esc(sup.name || sup.id) + '</span>' +
        '<span class="sub mls-sub-icons">' + catIc + rarIc +
        (unowned
          ? '<span class="mls-sub-hint">not in Collections</span>'
          : '<span class="mls-sub-hint">tag-boosted picks</span>') +
        '</span></span>' +
        '<span class="mls-supp-actions">' +
        '<span class="mls-supp-lb" onclick="event.stopPropagation()">' + lbButtonsHtml(side, 0, lb, 'sup') + '</span>' +
        '<button type="button" class="mls-mini-btn danger" data-mls-clear-supp="' + side + '">Clear</button>' +
        '</span></button>';
    } else {
      host.innerHTML =
        '<button type="button" class="mls-supp-card" data-mls-pick-supp="' + side + '" title="Same as /tb — units suggest from this supporter’s tags">' +
        '<span class="mls-supp-thum">＋</span>' +
        '<span class="mls-supp-meta"><span class="name">' + esc(mlsT('mls_pick_supporter', 'Pick supporter')) + '</span>' +
        '<span class="sub mls-sub-icons">' + catIc +
        '<span class="mls-sub-hint">' + esc(mlsT('mls_supporter', 'Supporters')) + '</span></span></span>' +
        '<span class="mls-slot-n">SUP</span></button>';
    }
  }

  function leaderCacheKey(side, unitId, charId) {
    return String(side || '') + ':' + String(unitId || '') + ':' + String(charId || '');
  }

  function clearLeaderApplyCaches(side) {
    var prefix, k;
    if (!side) {
      supporterForUnitCache = {};
      leaderApplyCache = {};
      return;
    }
    prefix = String(side) + ':';
    Object.keys(supporterForUnitCache).forEach(function (key) {
      if (key.indexOf(prefix) === 0) delete supporterForUnitCache[key];
    });
    Object.keys(leaderApplyCache).forEach(function (key) {
      if (key.indexOf(prefix) === 0) delete leaderApplyCache[key];
    });
  }

  function unitHasLeaderBoost(side, sl) {
    if (!sl || !sl.unitId || !forceOf(side).supporter) return false;
    return !!leaderApplyCache[leaderCacheKey(side, sl.unitId, sl.charId)];
  }

  function fetchSupporterForUnit(side, unitId, charId) {
    var ent = forceOf(side).supporter;
    var key, lb, url;
    if (!ent || !ent.id || !unitId) return Promise.resolve(null);
    if (side === 'ally' && supporterExcludedByCollections(ent, 'ally')) return Promise.resolve(null);
    key = leaderCacheKey(side, unitId, charId);
    if (Object.prototype.hasOwnProperty.call(supporterForUnitCache, key)) {
      return Promise.resolve(supporterForUnitCache[key]);
    }
    lb = ent.lb != null ? (ent.lb | 0) : 3;
    url = '/api/supporter/' + encodeURIComponent(ent.id) +
      '?lang=' + encodeURIComponent(lang()) + '&level=100&lb_tier=' + lb +
      '&for_unit_id=' + encodeURIComponent(String(unitId));
    if (charId) url += '&for_char_id=' + encodeURIComponent(String(charId));
    return fetchJson(url).then(function (d) {
      if (!d || d.error) {
        supporterForUnitCache[key] = null;
        leaderApplyCache[key] = false;
        return null;
      }
      d._dcLevel = 100;
      d._dcLbTier = lb;
      supporterForUnitCache[key] = d;
      leaderApplyCache[key] = (d.leader_skills || []).some(function (x) { return !!(x && x.applies); });
      return d;
    }).catch(function () {
      supporterForUnitCache[key] = null;
      leaderApplyCache[key] = false;
      return null;
    });
  }

  function scheduleLeaderApplyRefresh() {
    clearTimeout(leaderApplyRefreshTimer);
    leaderApplyRefreshTimer = setTimeout(refreshLeaderApplies, 80);
  }

  function refreshLeaderApplies() {
    var tasks = [];
    ['ally', 'enemy'].forEach(function (side) {
      var slots, i, sl, key;
      if (!forceOf(side).supporter || !forceOf(side).supporter.id) return;
      slots = forceOf(side).slots || [];
      for (i = 0; i < SLOT_COUNT; i++) {
        sl = slots[i];
        if (!sl || !sl.unitId) continue;
        key = leaderCacheKey(side, sl.unitId, sl.charId);
        if (Object.prototype.hasOwnProperty.call(leaderApplyCache, key)) continue;
        tasks.push(fetchSupporterForUnit(side, sl.unitId, sl.charId));
      }
    });
    if (!tasks.length) return;
    Promise.all(tasks).then(function () {
      paintForceSlots();
    });
  }

  function paintSlotList(hostId, slots, side) {
    var host = document.getElementById(hostId);
    if (!host) return;
    var html = '';
    var i, sl, thum, lb, opHtml, unowned, leaderBoost, leaderIc;
    for (i = 0; i < SLOT_COUNT; i++) {
      sl = slots[i];
      if (sl && sl.unitId) {
        thum = thumbUrl(sl.thum || '');
        lb = sl.lb != null ? (sl.lb | 0) : 3;
        unowned = slotExcludedByCollections(sl, side);
        leaderBoost = unitHasLeaderBoost(side, sl);
        leaderIc = leaderBoost
          ? ('<span class="mls-slot-leader-buff" title="Supporter leader skill applies">' +
            '<img src="' + esc(thumbUrl(LEADER_BUFF_ICON)) + '" alt="" draggable="false"></span>')
          : '';
        if (sl.optionPartId) {
          opHtml = '<span class="mls-op-chip">' +
            (sl.optionPartThum
              ? '<img src="' + esc(thumbUrl(sl.optionPartThum)) + '" alt="">'
              : '') +
            '<span class="op-name">' + esc(sl.optionPartName || sl.optionPartId) + '</span>' +
            '<button type="button" class="mls-mini-btn" data-mls-pick-op="' + side + ':' + i + '">Swap</button>' +
            '<button type="button" class="mls-mini-btn danger" data-mls-clear-op="' + side + ':' + i + '">×</button></span>';
        } else {
          opHtml = '<button type="button" class="mls-mini-btn" data-mls-pick-op="' + side + ':' + i + '">+ Option part</button>';
        }
        html += '<div class="mls-slot-block' + (unowned ? ' is-unowned' : '') +
          '" data-mls-slot="' + side + ':' + i + '" draggable="false"' +
          (unowned
            ? ' title="Not in Collections — greyed out; does not appear on Battle while Only my Collections is on (ally only)"'
            : '') + '>' +
          '<button type="button" class="mls-slot" data-mls-pick-unit="' + side + ':' + i + '">' +
          '<span class="mls-slot-thum-wrap" data-mls-drag="' + side + ':' + i +
          '" title="Drag to reorder">' +
          (thum
            ? '<img class="mls-slot-thum" src="' + esc(thum) + '" alt="" loading="lazy" decoding="async" draggable="false">'
            : '<span class="mls-slot-thum"></span>') +
          leaderIc +
          '<span class="mls-pilot-pip' + (sl.charThum ? '' : ' is-empty') +
          '" data-mls-pick-pilot="' + side + ':' + i + '" title="Change pilot" ' +
          'aria-label="Change pilot">' +
          (sl.charThum
            ? '<img src="' + esc(thumbUrl(sl.charThum)) + '" alt="" draggable="false">'
            : '+') +
          '</span></span>' +
          '<span class="mls-slot-meta"><span class="name">' + esc(sl.name || sl.unitId) + '</span>' +
          '<span class="sub mls-sub-icons" title="Tap unit name to change · drag portrait to reorder">' +
          rarityIconHtml(sl.rarity) +
          roleIconHtml(sl.roleIcon || sl.roleId) +
          (unowned ? '<span class="mls-unowned-tag">not in Collections</span>' : '') +
          '</span></span>' +
          slotNumBadgeHtml(i + 1) + '</button>' +
          '<div class="mls-slot-tools">' +
          '<button type="button" class="mls-mini-btn mls-pilot-btn" data-mls-pick-pilot="' +
          side + ':' + i + '" title="Change pilot">' +
          (sl.charName ? ('Pilot: ' + esc(sl.charName)) : 'Set pilot') +
          '</button>' +
          charSpButtonHtml(sl, side, i) +
          '<span class="mls-supp-lb">' + lbButtonsHtml(side, i, lb, 'unit') + '</span>' +
          statModeButtonsHtml(sl, side, i) +
          opHtml +
          '</div>' +
          '</div>';
      } else {
        html += '<div class="mls-slot-block" data-mls-slot="' + side + ':' + i + '">' +
          '<button type="button" class="mls-slot mls-slot-empty" data-mls-pick-unit="' + side + ':' + i + '">' +
          '<span class="mls-slot-thum-wrap"><span class="mls-slot-thum">＋</span></span>' +
          '<span class="mls-slot-meta"><span class="name">Empty slot</span>' +
          '<span class="sub">Tap to pick a unit' +
          (forceOf(side).supporter ? ' (boosted by supporter tags)' : '') +
          '</span></span>' +
          slotNumBadgeHtml(i + 1) + '</button>' +
          '</div>';
      }
    }
    host.innerHTML = html;
    bindSlotDrag(host, side);
  }

  function actorSupporterPayload(actor) {
    var key, cached;
    if (!actor || !actor.unit) return null;
    if (actor.supporter) return actor.supporter;
    key = leaderCacheKey(actor.side, actor.unit.id, actor.char && actor.char.id);
    cached = supporterForUnitCache[key];
    if (cached) return cached;
    /* Never fall back to unscoped sideSupportData (applies=true for every unit). */
    return null;
  }

  function swapForceSlots(side, fromIdx, toIdx) {
    var force, tmp, a, b;
    if (side !== 'ally' && side !== 'enemy') return;
    fromIdx |= 0;
    toIdx |= 0;
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= SLOT_COUNT || toIdx >= SLOT_COUNT) return;
    force = forceOf(side);
    tmp = force.slots[fromIdx];
    force.slots[fromIdx] = force.slots[toIdx];
    force.slots[toIdx] = tmp;
    /* Slot index owns the LINE spawn — drop map-drag homes so units don’t stack. */
    a = force.slots[fromIdx];
    b = force.slots[toIdx];
    if (a) { delete a.x; delete a.y; }
    if (b) { delete b.x; delete b.y; }
    saveRoster();
    paintForceSlots();
    fillShareBoxes();
    scheduleOrderRefresh();
  }

  /** True when (x,y) is one of this side’s board spawn origins (LINE / standard / whatever the season ships). */
  function isSideSpawnOrigin(side, x, y) {
    var cells = side === 'ally' ? allyCells() : enemyCells();
    var i, c;
    x |= 0;
    y |= 0;
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      if ((c.x | 0) === x && (c.y | 0) === y) return true;
    }
    return false;
  }

  /** Board spawn for slot index, or roster x/y override from map drag (spawn cells only). */
  function effectiveSlotHome(side, idx) {
    var cells = side === 'ally' ? allyCells() : enemyCells();
    var base = cells[idx] || { n: (idx | 0) + 1, x: 0, y: 0 };
    var sl = forceOf(side).slots[idx];
    var x = (sl && sl.x != null) ? (sl.x | 0) : (base.x | 0);
    var y = (sl && sl.y != null) ? (sl.y | 0) : (base.y | 0);
    /* Old free-place coords outside this side’s spawn set → snap back to that slot’s spawn. */
    if (sl && (sl.x != null || sl.y != null) && !isSideSpawnOrigin(side, x, y)) {
      x = base.x | 0;
      y = base.y | 0;
    }
    return {
      n: base.n | 0,
      x: x,
      y: y,
      type: base.type | 0
    };
  }

  function writeSlotHome(side, idx, x, y) {
    var sl = forceOf(side).slots[idx];
    var cells = side === 'ally' ? allyCells() : enemyCells();
    var base = cells[idx];
    if (!sl || !sl.unitId) return;
    x |= 0;
    y |= 0;
    /* Map drag may only park on this side’s board spawn origins. */
    if (!isSideSpawnOrigin(side, x, y)) return;
    if (base && (base.x | 0) === x && (base.y | 0) === y) {
      delete sl.x;
      delete sl.y;
    } else {
      sl.x = x;
      sl.y = y;
    }
  }

  function swapSlotHomes(side, aIdx, bIdx) {
    var ha, hb;
    aIdx |= 0;
    bIdx |= 0;
    if (aIdx === bIdx || aIdx < 0 || bIdx < 0) return;
    ha = effectiveSlotHome(side, aIdx);
    hb = effectiveSlotHome(side, bIdx);
    writeSlotHome(side, aIdx, hb.x, hb.y);
    writeSlotHome(side, bIdx, ha.x, ha.y);
  }

  function clientToMapCell(clientX, clientY) {
    var host = document.getElementById('mlsBoard');
    var win, rect, lx, ly, gx, gy;
    if (!host || !board) return null;
    rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    lx = clientX - rect.left;
    ly = clientY - rect.top;
    if (lx < 0 || ly < 0 || lx >= rect.width || ly >= rect.height) return null;
    win = computeMapWindow();
    gx = Math.floor(lx / Math.max(1, mapCellPx));
    gy = Math.floor(ly / Math.max(1, mapCellPx));
    gx = Math.max(0, Math.min(win.cols - 1, gx));
    gy = Math.max(0, Math.min(win.rows - 1, gy));
    return { x: win.minX + gx, y: win.maxY - gy };
  }

  /** Units overlapping a map cell at formation-home (setup), excluding skipKey. */
  function unitsFootprintAtHome(x, y, skipKey) {
    var out = [];
    var seen = {};
    lastAlly.concat(lastEnemy).forEach(function (u) {
      var key, probe, cells, hit;
      if (!u || (u.hp | 0) <= 0) return;
      key = tokenKey(u);
      if (skipKey && key === skipKey) return;
      probe = {
        x: u.homeX != null ? u.homeX : u.x,
        y: u.homeY != null ? u.homeY : u.y,
        side: u.side,
        isLarge: !!u.isLarge,
        direction: u.direction
      };
      cells = footprintCells(probe);
      hit = cells.some(function (c) {
        return (c.x | 0) === (x | 0) && (c.y | 0) === (y | 0);
      });
      if (hit && !seen[key]) {
        seen[key] = 1;
        out.push(u);
      }
    });
    return out;
  }

  /**
   * Validate placing unit u with origin (nx,ny).
   * Origin must be one of this side’s board spawn cells (no free placement on the map).
   * Returns { ok, swap: actor|null } — swap when exactly one same-side occupant.
   */
  function evaluateMapPlace(u, nx, ny) {
    var m = mapMeta();
    var probe, cells, allies, enemyHit, i, c, others, j, o, keys;
    nx |= 0;
    ny |= 0;
    if (!u || !isSideSpawnOrigin(u.side, nx, ny)) {
      return { ok: false, swap: null };
    }
    probe = {
      x: nx,
      y: ny,
      side: u.side,
      isLarge: !!u.isLarge,
      direction: u.direction
    };
    cells = footprintCells(probe);
    allies = {};
    enemyHit = false;
    for (i = 0; i < cells.length; i++) {
      c = cells[i];
      if (m.width > 0 && (c.x < 0 || c.x >= (m.width | 0))) {
        return { ok: false, swap: null };
      }
      if (m.height > 0 && (c.y < 0 || c.y >= (m.height | 0))) {
        return { ok: false, swap: null };
      }
      others = unitsFootprintAtHome(c.x, c.y, tokenKey(u));
      for (j = 0; j < others.length; j++) {
        o = others[j];
        if (o.side !== u.side) enemyHit = true;
        else allies[tokenKey(o)] = o;
      }
    }
    if (enemyHit) return { ok: false, swap: null };
    keys = Object.keys(allies);
    if (keys.length > 1) return { ok: false, swap: null };
    if (keys.length === 1) return { ok: true, swap: allies[keys[0]] };
    return { ok: true, swap: null };
  }

  function clearMapDropHints() {
    var host = document.getElementById('mlsBoard');
    if (!host) return;
    Array.prototype.forEach.call(host.querySelectorAll('.mls-cell.is-drop-ok, .mls-cell.is-drop-swap, .mls-cell.is-drop-bad'), function (el) {
      el.classList.remove('is-drop-ok', 'is-drop-swap', 'is-drop-bad');
    });
  }

  function paintMapDropHints(u, nx, ny, verdict) {
    var host = document.getElementById('mlsBoard');
    var probe, cells, cls;
    clearMapDropHints();
    if (!host || !u || nx == null || ny == null) return;
    probe = {
      x: nx | 0,
      y: ny | 0,
      side: u.side,
      isLarge: !!u.isLarge,
      direction: u.direction
    };
    cells = footprintCells(probe);
    cls = !verdict || !verdict.ok
      ? 'is-drop-bad'
      : (verdict.swap ? 'is-drop-swap' : 'is-drop-ok');
    cells.forEach(function (c) {
      var el = host.querySelector('.mls-cell[data-xy="' + (c.x | 0) + ',' + (c.y | 0) + '"]');
      if (el) el.classList.add(cls);
    });
  }

  function commitMapPlace(u, nx, ny, swapU) {
    var side = u.side;
    var fromIdx = u.slotIdx | 0;
    var toIdx;
    if (fromIdx < 0 || fromIdx >= SLOT_COUNT) return false;
    if (swapU) {
      toIdx = swapU.slotIdx | 0;
      if (toIdx < 0 || toIdx >= SLOT_COUNT || toIdx === fromIdx) return false;
      swapSlotHomes(side, fromIdx, toIdx);
    } else {
      writeSlotHome(side, fromIdx, nx, ny);
    }
    saveRoster();
    fillShareBoxes();
    scheduleOrderRefresh();
    log(swapU
      ? ('Swapped map start: ' + (u.name || u.id) + ' ↔ ' + (swapU.name || swapU.id))
      : ('Moved ' + (u.name || u.id) + ' start → (' + (nx | 0) + ',' + (ny | 0) + ')'));
    return true;
  }

  /**
   * Drag tokens on the battle map to set formation-start cells.
   * Only that side’s board spawn origins are valid (empty → place; teammate → swap).
   * Disabled while fightBusy (board gets .is-fighting).
   * iOS: claim touch on pointerdown (no long-press callout), track on document.
   */
  function bindMapTokenDrag() {
    var host = document.getElementById('mlsBoard');
    /* Desktop needs a small move before lift; touch lifts immediately. */
    var THRESH_MOUSE = 8;
    var SNAP_MS = 220;
    var OVERSHOOT = 3;
    var armed = false;
    var active = false;
    var snapping = false;
    var dragU = null;
    var originEl = null;
    var ghost = null;
    var pointerId = null;
    var startX = 0;
    var startY = 0;
    var lastX = 0;
    var lastY = 0;
    var lastClientX = 0;
    var rot = 0;
    var ghostW = 48;
    var ghostH = 48;
    var hoverCell = null;
    var hoverVerdict = null;
    var reduceMotion = false;
    var docBound = false;

    if (!host || host._mlsMapDragBound) return;
    host._mlsMapDragBound = true;

    function prefersReduce() {
      try {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (e) {
        return false;
      }
    }

    function clearNativeSelection() {
      try {
        var sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      } catch (eSel) {}
    }

    function setDraggingBody(on) {
      try {
        document.body.classList.toggle('mls-is-map-dragging', !!on);
      } catch (eBody) {}
    }

    function findActor(side, slotIdx) {
      var list = side === 'enemy' ? lastEnemy : lastAlly;
      var i;
      for (i = 0; i < list.length; i++) {
        if ((list[i].slotIdx | 0) === (slotIdx | 0)) return list[i];
      }
      return null;
    }

    function ghostPos(clientX, clientY, r) {
      lastX = clientX - ghostW / 2;
      lastY = clientY - ghostH / 2;
      rot = r || 0;
      if (!ghost) return;
      ghost.style.transform =
        'translate3d(' + lastX + 'px,' + lastY + 'px,0) scale(1.08) rotate(' + rot + 'deg)';
    }

    function destroyGhost() {
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
    }

    function unbindDoc() {
      if (!docBound) return;
      docBound = false;
      document.removeEventListener('pointermove', onDocMove, true);
      document.removeEventListener('pointerup', onDocUp, true);
      document.removeEventListener('pointercancel', onDocUp, true);
    }

    function bindDoc() {
      if (docBound) return;
      docBound = true;
      document.addEventListener('pointermove', onDocMove, { capture: true, passive: false });
      document.addEventListener('pointerup', onDocUp, true);
      document.addEventListener('pointercancel', onDocUp, true);
    }

    function hardReset() {
      clearMapDropHints();
      unbindDoc();
      setDraggingBody(false);
      if (originEl) {
        originEl.classList.remove('is-map-dragging');
        try {
          if (originEl.releasePointerCapture && pointerId != null) {
            originEl.releasePointerCapture(pointerId);
          }
        } catch (eRel) {}
      }
      destroyGhost();
      armed = false;
      active = false;
      snapping = false;
      dragU = null;
      originEl = null;
      pointerId = null;
      hoverCell = null;
      hoverVerdict = null;
      rot = 0;
    }

    function beginLift(ev) {
      var srcImg, srcRect;
      if (active || !originEl || !dragU) return;
      active = true;
      reduceMotion = prefersReduce();
      clearNativeSelection();
      setDraggingBody(true);
      originEl.classList.add('is-map-dragging');
      srcImg = originEl.querySelector('.mls-token-thum');
      srcRect = originEl.getBoundingClientRect();
      ghostW = Math.max(36, Math.round(srcRect.width) || 48);
      ghostH = Math.max(36, Math.round(srcRect.height) || 48);
      ghost = document.createElement('div');
      ghost.className = 'mls-drag-ghost' + (dragU.side === 'enemy' ? ' is-enemy' : ' is-ally');
      ghost.setAttribute('aria-hidden', 'true');
      if (srcImg && srcImg.tagName === 'IMG' && srcImg.src) {
        ghost.innerHTML = '<img src="' + esc(srcImg.src) + '" alt="" draggable="false">';
      } else {
        ghost.textContent = '◇';
      }
      ghost.style.width = ghostW + 'px';
      ghost.style.height = ghostH + 'px';
      document.body.appendChild(ghost);
      ghostPos(ev.clientX, ev.clientY, 0);
      try { originEl.setPointerCapture(ev.pointerId); } catch (eCap) {}
      if (ev && ev.cancelable) ev.preventDefault();
    }

    function updateHover(clientX, clientY) {
      var cell;
      if (ghost) ghost.style.pointerEvents = 'none';
      cell = clientToMapCell(clientX, clientY);
      hoverCell = cell;
      hoverVerdict = cell && dragU ? evaluateMapPlace(dragU, cell.x, cell.y) : null;
      if (cell && dragU) paintMapDropHints(dragU, cell.x, cell.y, hoverVerdict);
      else clearMapDropHints();
    }

    function cellCenterClient(x, y) {
      var hostEl = document.getElementById('mlsBoard');
      var win, rect, left, top;
      if (!hostEl) return null;
      win = computeMapWindow();
      rect = hostEl.getBoundingClientRect();
      left = rect.left + ((x - win.minX) + 0.5) * mapCellPx;
      top = rect.top + ((win.maxY - y) + 0.5) * mapCellPx;
      return { x: left, y: top };
    }

    function animateSnapAndCommit(cancelled) {
      var dest, endX, endY, dx, dy, len, ox, oy, anim, ms, cell, verdict, did;
      cell = hoverCell;
      verdict = hoverVerdict;
      did = !cancelled && cell && verdict && verdict.ok;
      snapping = true;
      clearMapDropHints();
      dest = did ? cellCenterClient(cell.x, cell.y) : null;
      if (!ghost) {
        if (did) commitMapPlace(dragU, cell.x, cell.y, verdict.swap);
        hardReset();
        return;
      }
      if (!dest) {
        dest = originEl ? (function () {
          var r = originEl.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })() : { x: lastX + ghostW / 2, y: lastY + ghostH / 2 };
      }
      endX = dest.x - ghostW / 2;
      endY = dest.y - ghostH / 2;
      dx = endX - lastX;
      dy = endY - lastY;
      len = Math.hypot(dx, dy) || 1;
      ox = endX + (dx / len) * OVERSHOOT;
      oy = endY + (dy / len) * OVERSHOOT;
      ms = reduceMotion ? 1 : SNAP_MS;
      try {
        anim = ghost.animate(
          [
            {
              transform: 'translate3d(' + lastX + 'px,' + lastY + 'px,0) scale(1.08) rotate(' + rot + 'deg)'
            },
            {
              transform: 'translate3d(' + ox + 'px,' + oy + 'px,0) scale(1.02) rotate(0deg)',
              offset: 0.68
            },
            {
              transform: 'translate3d(' + endX + 'px,' + endY + 'px,0) scale(1) rotate(0deg)'
            }
          ],
          {
            duration: ms,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards'
          }
        );
      } catch (eAnim) {
        anim = null;
      }
      function finish() {
        var u = dragU;
        var c = cell;
        var v = verdict;
        var ok = did;
        hardReset();
        if (ok && u && c && v) commitMapPlace(u, c.x, c.y, v.swap);
      }
      if (anim && anim.finished) anim.finished.then(finish).catch(finish);
      else setTimeout(finish, ms);
    }

    function onPointerMove(ev) {
      var dist, tilt, isTouch;
      if (!armed || snapping || (pointerId != null && ev.pointerId !== pointerId)) return;
      if (!active) {
        isTouch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
        if (!isTouch) {
          dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
          if (dist < THRESH_MOUSE) return;
        }
        beginLift(ev);
      }
      if (!active) return;
      tilt = Math.max(-10, Math.min(10, (ev.clientX - lastClientX) * 0.55));
      lastClientX = ev.clientX;
      ghostPos(ev.clientX, ev.clientY, tilt);
      updateHover(ev.clientX, ev.clientY);
      if (ev.cancelable) ev.preventDefault();
    }

    function onDocMove(ev) { onPointerMove(ev); }

    function endDrag(ev) {
      if (!armed || snapping) return;
      if (pointerId != null && ev && ev.pointerId !== pointerId) return;
      if (!active) {
        hardReset();
        return;
      }
      if (ev) updateHover(ev.clientX, ev.clientY);
      animateSnapAndCommit(!(hoverCell && hoverVerdict && hoverVerdict.ok));
    }

    function onDocUp(ev) { endDrag(ev); }

    host.addEventListener('pointerdown', function (ev) {
      var tok, side, idx, u, isTouch;
      if (fightBusy || snapping || ev.button) return;
      /* Tokens’ children are pointer-events:none — closest still works from the shell. */
      tok = ev.target && ev.target.closest && ev.target.closest('.mls-token');
      if (!tok || !host.contains(tok)) return;
      if (tok.classList.contains('is-gone') || tok.classList.contains('is-dead')) return;
      side = tok.getAttribute('data-side') || '';
      idx = parseInt(tok.getAttribute('data-slot-idx'), 10);
      if ((side !== 'ally' && side !== 'enemy') || !(idx >= 0)) return;
      u = findActor(side, idx);
      if (!u) return;
      dragU = u;
      originEl = tok;
      armed = true;
      active = false;
      pointerId = ev.pointerId;
      startX = ev.clientX;
      startY = ev.clientY;
      lastClientX = ev.clientX;
      clearNativeSelection();
      /*
       * Claim the gesture now: preventDefault + touch-action:none kills iOS
       * long-press callout / image save / text select so drag stays a drag.
       */
      try { tok.setPointerCapture(ev.pointerId); } catch (eArm) {}
      if (ev.cancelable) ev.preventDefault();
      bindDoc();
      isTouch = ev.pointerType === 'touch' || ev.pointerType === 'pen';
      if (isTouch) beginLift(ev);
    }, { passive: false });

    host.addEventListener('pointermove', onPointerMove, { passive: false });
    host.addEventListener('pointerup', endDrag);
    host.addEventListener('pointercancel', endDrag);

    host.addEventListener('contextmenu', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('.mls-token')) {
        ev.preventDefault();
      }
    });

    host.addEventListener('selectstart', function (ev) {
      if (armed || active || (ev.target && ev.target.closest && ev.target.closest('.mls-token'))) {
        ev.preventDefault();
      }
    });

    /* Extra belt for older WebKit image long-press. */
    host.addEventListener('touchstart', function (ev) {
      var tok;
      if (fightBusy) return;
      tok = ev.target && ev.target.closest && ev.target.closest('.mls-token');
      if (!tok || !host.contains(tok)) return;
      if (ev.cancelable) ev.preventDefault();
    }, { passive: false });
  }

  /**
   * Takayu drag-snap (820ms outBack / ~6px overshoot):
   * drag the unit portrait; ghost follows pointer; release → nearest slot settle.
   * Tap (no drag threshold) still opens the unit picker via the slot button.
   */
  function bindSlotDrag(host, side) {
    var THRESH = 8;
    /* Snap was 820ms — felt stuck after drop. Short settle only. */
    var SNAP_MS = 220;
    var OVERSHOOT = 3;
    var dragIdx = -1;
    var armed = false;
    var active = false;
    var snapping = false;
    var originBlock = null;
    var originWrap = null;
    var ghost = null;
    var pointerId = null;
    var startX = 0;
    var startY = 0;
    var lastX = 0;
    var lastY = 0;
    var lastClientX = 0;
    var rot = 0;
    var ghostW = 48;
    var ghostH = 48;
    var suppressClick = false;
    var reduceMotion = false;

    if (!host || host._mlsDragBound) return;
    host._mlsDragBound = true;

    function prefersReduce() {
      try {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      } catch (e) {
        return false;
      }
    }

    function clearNativeSelection() {
      try {
        var sel = window.getSelection && window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      } catch (eSel) {}
    }

    function setDraggingBody(on) {
      try {
        document.body.classList.toggle('mls-is-slot-dragging', !!on);
      } catch (eBody) {}
    }

    function clearTargets() {
      host.querySelectorAll('.mls-slot-block.is-drop-target').forEach(function (el) {
        el.classList.remove('is-drop-target');
      });
    }

    function ghostPos(clientX, clientY, r) {
      lastX = clientX - ghostW / 2;
      lastY = clientY - ghostH / 2;
      rot = r || 0;
      if (!ghost) return;
      ghost.style.transform =
        'translate3d(' + lastX + 'px,' + lastY + 'px,0) scale(1.1) rotate(' + rot + 'deg)';
    }

    function destroyGhost() {
      if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
      ghost = null;
    }

    function resetDragClasses() {
      if (originBlock) originBlock.classList.remove('is-dragging');
      if (originWrap) originWrap.classList.remove('is-drag-source');
      clearTargets();
      setDraggingBody(false);
    }

    function hardReset() {
      resetDragClasses();
      destroyGhost();
      dragIdx = -1;
      armed = false;
      active = false;
      snapping = false;
      originBlock = null;
      originWrap = null;
      pointerId = null;
      rot = 0;
    }

    function slotBlockFromPoint(clientX, clientY) {
      var el = document.elementFromPoint(clientX, clientY);
      return el && el.closest
        ? el.closest('.mls-slot-block[data-mls-slot^="' + side + ':"]')
        : null;
    }

    function beginLift(ev) {
      var srcImg, srcRect;
      if (active || !originWrap) return;
      active = true;
      suppressClick = true;
      reduceMotion = prefersReduce();
      clearNativeSelection();
      setDraggingBody(true);
      originBlock.classList.add('is-dragging');
      originWrap.classList.add('is-drag-source');
      srcImg = originWrap.querySelector('.mls-slot-thum');
      srcRect = originWrap.getBoundingClientRect();
      ghostW = Math.max(40, Math.round(srcRect.width) || 48);
      ghostH = Math.max(40, Math.round(srcRect.height) || 48);
      ghost = document.createElement('div');
      ghost.className = 'mls-drag-ghost' + (side === 'enemy' ? ' is-enemy' : ' is-ally');
      ghost.setAttribute('aria-hidden', 'true');
      if (srcImg && srcImg.tagName === 'IMG' && srcImg.src) {
        ghost.innerHTML = '<img src="' + esc(srcImg.src) + '" alt="">';
      } else {
        ghost.textContent = '◇';
      }
      ghost.style.width = ghostW + 'px';
      ghost.style.height = ghostH + 'px';
      document.body.appendChild(ghost);
      ghostPos(ev.clientX, ev.clientY, 0);
      try { originWrap.setPointerCapture(ev.pointerId); } catch (eCap) {}
      if (ev && ev.preventDefault) ev.preventDefault();
    }

    function animateSnapTo(targetWrap, toIdx, cancelled) {
      var destRect, endX, endY, dx, dy, len, ox, oy, anim, ms;
      if (!ghost) {
        if (!cancelled && toIdx >= 0 && toIdx !== dragIdx) swapForceSlots(side, dragIdx, toIdx);
        hardReset();
        return;
      }
      snapping = true;
      destRect = targetWrap
        ? targetWrap.getBoundingClientRect()
        : (originWrap && originWrap.getBoundingClientRect());
      if (!destRect) {
        destroyGhost();
        if (!cancelled && toIdx >= 0 && toIdx !== dragIdx) swapForceSlots(side, dragIdx, toIdx);
        hardReset();
        return;
      }
      endX = destRect.left + destRect.width / 2 - ghostW / 2;
      endY = destRect.top + destRect.height / 2 - ghostH / 2;
      dx = endX - lastX;
      dy = endY - lastY;
      len = Math.hypot(dx, dy) || 1;
      ox = endX + (dx / len) * OVERSHOOT;
      oy = endY + (dy / len) * OVERSHOOT;
      ms = reduceMotion ? 1 : SNAP_MS;
      clearTargets();
      if (targetWrap && !cancelled) {
        var tipBlock = targetWrap.closest('.mls-slot-block');
        if (tipBlock) tipBlock.classList.add('is-drop-target');
      }
      try {
        anim = ghost.animate(
          [
            {
              transform: 'translate3d(' + lastX + 'px,' + lastY + 'px,0) scale(1.1) rotate(' + rot + 'deg)'
            },
            {
              transform: 'translate3d(' + ox + 'px,' + oy + 'px,0) scale(1.02) rotate(0deg)',
              offset: 0.68
            },
            {
              transform: 'translate3d(' + endX + 'px,' + endY + 'px,0) scale(1) rotate(0deg)'
            }
          ],
          {
            duration: ms,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards'
          }
        );
      } catch (eAnim) {
        anim = null;
      }
      function finish() {
        var from = dragIdx;
        var host2, snapped;
        destroyGhost();
        resetDragClasses();
        if (!cancelled && toIdx >= 0 && toIdx !== from) {
          swapForceSlots(side, from, toIdx);
          setTimeout(function () {
            host2 = document.getElementById(side === 'enemy' ? 'mlsEnemySlots' : 'mlsAllySlots');
            snapped = host2 && host2.querySelector('[data-mls-slot="' + side + ':' + toIdx + '"]');
            if (snapped) {
              snapped.classList.add('is-snap');
              setTimeout(function () { snapped.classList.remove('is-snap'); }, 380);
            }
          }, 0);
        }
        dragIdx = -1;
        armed = false;
        active = false;
        snapping = false;
        originBlock = null;
        originWrap = null;
        pointerId = null;
        rot = 0;
        setTimeout(function () { suppressClick = false; }, 0);
      }
      if (anim && anim.finished) {
        anim.finished.then(finish).catch(finish);
      } else {
        setTimeout(finish, ms);
      }
    }

    host.addEventListener('pointerdown', function (ev) {
      var wrap, block, key, parts;
      if (snapping || ev.button) return;
      if (ev.target && ev.target.closest && ev.target.closest('.mls-pilot-pip')) return;
      wrap = ev.target && ev.target.closest && ev.target.closest('.mls-slot-thum-wrap[data-mls-drag]');
      if (!wrap) return;
      block = wrap.closest('.mls-slot-block');
      if (!block || block.querySelector('.mls-slot-empty')) return;
      key = wrap.getAttribute('data-mls-drag') || '';
      parts = key.split(':');
      if (parts[0] !== side) return;
      dragIdx = parseInt(parts[1], 10);
      if (!(dragIdx >= 0)) return;
      armed = true;
      active = false;
      originBlock = block;
      originWrap = wrap;
      pointerId = ev.pointerId;
      startX = ev.clientX;
      startY = ev.clientY;
      lastClientX = ev.clientX;
      clearNativeSelection();
      /*
       * Portrait is touch-action:none. preventDefault kills iOS text-select / callout
       * so the gesture stays a reorder drag. Page scroll uses the name / LB area.
       */
      try { wrap.setPointerCapture(ev.pointerId); } catch (eArm) {}
      if (ev.cancelable) ev.preventDefault();
    });

    host.addEventListener('pointermove', function (ev) {
      var dist, el, block, tilt;
      if (!armed || snapping || (pointerId != null && ev.pointerId !== pointerId)) return;
      if (!active) {
        dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (dist < THRESH) return;
        beginLift(ev);
      }
      if (!active) return;
      tilt = Math.max(-10, Math.min(10, (ev.clientX - lastClientX) * 0.55));
      lastClientX = ev.clientX;
      ghostPos(ev.clientX, ev.clientY, tilt);
      clearTargets();
      el = document.elementFromPoint(ev.clientX, ev.clientY);
      /* Ignore the floating ghost under the cursor. */
      if (ghost) ghost.style.pointerEvents = 'none';
      block = el && el.closest && el.closest('.mls-slot-block[data-mls-slot^="' + side + ':"]');
      if (block && block !== originBlock) block.classList.add('is-drop-target');
      if (ev.cancelable) ev.preventDefault();
    });

    function endDrag(ev) {
      var block, key, parts, toIdx, destWrap;
      if (!armed || snapping) return;
      if (pointerId != null && ev.pointerId !== pointerId) return;
      if (!active) {
        hardReset();
        return;
      }
      block = slotBlockFromPoint(ev.clientX, ev.clientY);
      toIdx = -1;
      destWrap = originWrap;
      if (block && block !== originBlock) {
        key = block.getAttribute('data-mls-slot') || '';
        parts = key.split(':');
        toIdx = parseInt(parts[1], 10);
        destWrap = block.querySelector('.mls-slot-thum-wrap') || block;
      } else {
        toIdx = dragIdx;
        destWrap = originWrap;
      }
      try {
        if (originWrap && originWrap.releasePointerCapture) {
          originWrap.releasePointerCapture(ev.pointerId);
        }
      } catch (eRel) {}
      animateSnapTo(destWrap, toIdx, toIdx === dragIdx || toIdx < 0);
    }

    host.addEventListener('pointerup', endDrag);
    host.addEventListener('pointercancel', endDrag);

    host.addEventListener('contextmenu', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('.mls-slot-thum-wrap[data-mls-drag]')) {
        ev.preventDefault();
      }
    });

    host.addEventListener('selectstart', function (ev) {
      if (armed || active || (ev.target && ev.target.closest &&
          ev.target.closest('.mls-slot-thum-wrap, .mls-slot-block'))) {
        ev.preventDefault();
      }
    });

    host.addEventListener('click', function (ev) {
      if (!suppressClick) return;
      ev.preventDefault();
      ev.stopPropagation();
    }, true);
  }

  /**
   * Battle view: taller map chrome. Collapse section tabs immediately on Open battle map
   * (pinned through scroll-into-view). Reveal only via aggressive scroll-up
   * (nav_tabs_auto_hide) — do not remove .app-header.
   */
  function syncMlsBattleChrome(on) {
    try {
      document.body.classList.toggle('mls-battle-focus', !!on);
      /* Class first so setCollapsed can pin MLS battle focus. */
      if (window.GgenNavTabsAutoHide && typeof window.GgenNavTabsAutoHide.setCollapsed === 'function') {
        window.GgenNavTabsAutoHide.setCollapsed(!!on);
      } else if (typeof window.setNavTabsCollapsed === 'function') {
        window.setNavTabsCollapsed(!!on);
      }
    } catch (e) { /* ignore */ }
  }

  function mlsPageScrollY() {
    return window.pageYOffset || window.scrollY || 0;
  }

  function mlsStickyHeaderPad() {
    var header = document.querySelector('header.app-header') || document.querySelector('.app-header');
    var h = 0;
    try {
      if (header && header.offsetParent !== null) h = header.getBoundingClientRect().height || 0;
    } catch (e) { /* ignore */ }
    return h + 10;
  }

  function mlsScrollToY(y) {
    y = Math.max(0, Math.round(y));
    try {
      if (typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({ top: y, left: 0, behavior: 'smooth' });
        } catch (e1) {
          window.scrollTo(0, y);
        }
      } else {
        window.scrollTo(0, y);
      }
    } catch (e) { /* ignore */ }
  }

  /** ← Formation: land on the supporter / force cards (not the share footer). */
  function scrollMlsFormationIntoView() {
    var form = document.getElementById('mlsViewFormation');
    var el;
    if (!form || form.hidden) return;
    el = document.querySelector('#mlsViewFormation .mls-forces') ||
      document.getElementById('mlsAllySupp') ||
      document.getElementById('mlsEnemySupp') ||
      form;
    if (!el) return;
    try {
      mlsScrollToY(mlsPageScrollY() + el.getBoundingClientRect().top - mlsStickyHeaderPad());
    } catch (e) { /* ignore */ }
  }

  /**
   * Open battle map: show map + SIMULATION START together.
   * If both fit, pin map near the top; if not, keep Start visible near the bottom.
   */
  function scrollMlsBattleIntoView() {
    var battle = document.getElementById('mlsViewBattle');
    var map, end, pad, winH, scrollY, mapTop, endBottom, span, y;
    if (!battle || battle.hidden) return;
    map = document.querySelector('#mlsViewBattle .mls-map-scroll') ||
      document.getElementById('mlsBoard') || battle;
    end = document.getElementById('mlsFight') ||
      document.querySelector('#mlsViewBattle .mls-controls');
    if (!map) return;
    try {
      pad = 8;
      winH = window.innerHeight || document.documentElement.clientHeight || 0;
      scrollY = mlsPageScrollY();
      mapTop = map.getBoundingClientRect().top + scrollY;
      endBottom = (end ? end.getBoundingClientRect().bottom : map.getBoundingClientRect().bottom) + scrollY;
      span = endBottom - mapTop;
      if (winH > 0 && span + pad * 2 <= winH) {
        y = mapTop - pad;
      } else if (winH > 0) {
        y = endBottom - winH + pad;
      } else {
        y = mapTop - pad;
      }
      mlsScrollToY(y);
    } catch (e) { /* ignore */ }
  }

  function setView(name) {
    viewName = name;
    var formation = document.getElementById('mlsViewFormation');
    var battle = document.getElementById('mlsViewBattle');
    var tabF = document.getElementById('mlsTabFormation');
    var tabB = document.getElementById('mlsTabBattle');
    /* New view pass — unlock so the next battle paint can size once for this lineup. */
    if (!fightBusy) clearMapCameraLock();
    if (formation) {
      formation.hidden = name !== 'formation';
      formation.classList.toggle('is-active', name === 'formation');
    }
    if (battle) {
      battle.hidden = name !== 'battle';
      battle.classList.toggle('is-active', name === 'battle');
    }
    if (tabF) tabF.classList.toggle('is-active', name === 'formation');
    if (tabB) tabB.classList.toggle('is-active', name === 'battle');
    syncMlsBattleChrome(name === 'battle');
    if (name !== 'battle' && !fightBusy) hideTurnHud();
    if (name === 'battle') {
      preloadBannerArt();
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          scrollMlsBattleIntoView();
          /* Re-pin after scroll-into-view — switchTab / smooth scroll must not leave tabs open. */
          syncMlsBattleChrome(true);
        });
      });
      /*
       * Do not race a second loadArmies→paintBoard while SIMULATION START is loading.
       * That stale paint was wiping unit thumbs under READY? GO!!.
       */
      if (fightBusy) return;
      loadArmies().then(function () {
        if (fightBusy || viewName !== 'battle') return;
        paintBoard();
        paintTimeline();
        requestAnimationFrame(function () {
          scrollMlsBattleIntoView();
          syncMlsBattleChrome(true);
        });
      });
    } else if (name === 'formation') {
      requestAnimationFrame(function () {
        requestAnimationFrame(scrollMlsFormationIntoView);
      });
    }
  }

  function openPicker(kind, side, idx) {
    pickerCtx = { kind: kind, side: side, idx: idx | 0 };
    var picker = document.getElementById('mlsPicker');
    var title = document.getElementById('mlsPickerTitle');
    var search = document.getElementById('mlsPickerSearch');
    var sideLbl = side === 'enemy'
      ? mlsT('mls_enemy', 'Enemy')
      : mlsT('mls_ally', 'Ally');
    if (title) {
      if (kind === 'supporter') {
        title.textContent = mlsT('mls_pick_supporter', 'Pick supporter') + ' · ' + sideLbl;
      } else if (kind === 'option') {
        title.textContent = mlsT('mls_pick_option', 'Pick Modification') + ' · ' + sideLbl + ' #' + ((idx | 0) + 1);
      } else if (kind === 'character') {
        title.textContent = mlsT('mls_pick_pilot', 'Pick pilot') + ' · ' + sideLbl + ' #' + ((idx | 0) + 1);
      } else {
        title.textContent = mlsT('mls_pick_unit', 'Pick unit') + ' · ' + sideLbl + ' #' + ((idx | 0) + 1);
      }
    }
    if (search) {
      search.value = '';
      search.placeholder = kind === 'supporter'
        ? mlsT('mls_search_supporter', 'Search supporter name / tags…')
        : (kind === 'option'
          ? mlsT('mls_search_option', 'Search Modification…')
          : (kind === 'character'
            ? mlsT('mls_search_pilot', 'Search pilot name…')
            : mlsT('mls_search_unit', 'Search unit name…')));
    }
    var filters = document.getElementById('mlsPickerFilters');
    if (filters) filters.hidden = !(kind === 'unit' || kind === 'character');
    if (picker) picker.hidden = false;
    runPickerSearch('').then(renderPickerRows);
    if (search) setTimeout(function () { search.focus(); }, 30);
  }

  function closePicker() {
    var picker = document.getElementById('mlsPicker');
    if (picker) picker.hidden = true;
    pickerCtx = null;
  }

  function runPickerSearch(q) {
    var kind = pickerCtx && pickerCtx.kind || 'unit';
    var side = pickerCtx && pickerCtx.side || 'ally';
    var query = String(q || '').trim();
    var url;
    var filt = '';
    if (kind === 'unit' || kind === 'character') {
      /* UR/SSR chips alone exclude Limited + ULT in list APIs — expand so the chip matches user intent. */
      if (pickerFilter.rarity) {
        var rar = String(pickerFilter.rarity).toUpperCase();
        if (rar === 'UR' || rar === 'SSR') rar = rar + ',LT,ULT';
        filt += '&rarity=' + encodeURIComponent(rar);
      }
      if (pickerFilter.role) filt += '&role=' + encodeURIComponent(pickerFilter.role);
    }
    if (kind === 'supporter') {
      url = '/api/supporters?lang=' + encodeURIComponent(lang()) +
        '&per_page=40&page=1&sort=rarity&dir=desc' +
        (query ? ('&q=' + encodeURIComponent(query)) : '') + filt;
    } else if (kind === 'character') {
      url = '/api/characters?lang=' + encodeURIComponent(lang()) +
        '&per_page=40&page=1&sort=rarity&dir=desc' +
        (query ? ('&q=' + encodeURIComponent(query)) : '') + filt;
    } else if (kind === 'option') {
      var slForOp = forceOf(side).slots[pickerCtx.idx | 0];
      var uidOp = slForOp && slForOp.unitId ? String(slForOp.unitId) : '';
      var ensure = global._tbEnsureOpRowsForUnit;
      if (typeof ensure === 'function' && uidOp && !query) {
        return ensure(uidOp).then(function (rows) {
          pickerRows = rows || [];
          return pickerRows;
        });
      }
      url = '/api/option_parts?lang=' + encodeURIComponent(lang()) +
        '&per_page=80&page=1&sort=rarity&dir=desc&rarity=ALL&effect=ALL' +
        (uidOp ? ('&unit_id=' + encodeURIComponent(uidOp)) : '') +
        (query ? ('&q=' + encodeURIComponent(query)) : '');
    } else {
      var sup = forceOf(side).supporter;
      var boost = (sup && sup.id) ? ('&tb_boost_supporter=' + encodeURIComponent(sup.id)) : '';
      var seasonLin = '';
      var pp = boost ? '80' : '40';
      /*
       * Empty search, no supporter: prefer this season’s Boost: Tag lineages (event-boosted kits),
       * same idea as /ml banner — still OR across season tags. With a supporter, API already
       * ranks by that supporter’s leader tags (search can still find any unit).
       */
      if (!boost && !query && seasonMeta && Array.isArray(seasonMeta.boost_tags)) {
        var lids = [];
        seasonMeta.boost_tags.forEach(function (t) {
          var id = t && (t.target_id != null ? String(t.target_id) : '');
          var kind = String((t && t.tag_type) || '').toLowerCase();
          if (id && id !== '0' && (kind === 'lineage' || kind === '' || t.type_index === 2)) {
            if (lids.indexOf(id) < 0) lids.push(id);
          }
        });
        if (lids.length) {
          seasonLin = '&lineage=' + encodeURIComponent(lids.join(',')) + '&lineage_op=or';
          pp = '80';
        }
      }
      url = '/api/units?lang=' + encodeURIComponent(lang()) +
        '&per_page=' + pp + '&page=1&sort=rarity&dir=desc' +
        (query ? ('&q=' + encodeURIComponent(query)) : '') + boost + seasonLin + filt;
    }
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error(kind + ' ' + r.status);
      return r.json();
    }).then(function (d) {
      pickerRows = d.rows || [];
      return pickerRows;
    });
  }

  /** Same framed-thumb cells as /cal attacker picker (+ /tb). Filters stay MLS-only. */
  function mlsPickerEntityCell(row, entityKind) {
    var th = 52;
    if (typeof global.renderEntityPickerItemCell === 'function' && (entityKind === 'unit' || entityKind === 'char')) {
      return global.renderEntityPickerItemCell(row, entityKind, th, 'data-mls-pick-id');
    }
    if (typeof global.renderSupporterPickerCell === 'function' && entityKind === 'supp') {
      return global.renderSupporterPickerCell(row, th, 'data-mls-pick-id');
    }
    if (typeof global.renderOptionPartPickerCell === 'function' && entityKind === 'mod') {
      return global.renderOptionPartPickerCell(row, th, 'data-mls-pick-id');
    }
    /* Fallback if browse helpers not loaded yet. */
    var pickArt = (pickerCtx && pickerCtx.kind === 'supporter')
      ? supporterArtUrl(row)
      : thumbUrl(row.thum || '');
    return '<div class="tb-picker-item" role="button" tabindex="0" data-mls-pick-id="' + esc(String(row.id)) + '">' +
      (pickArt ? '<img src="' + esc(pickArt) + '" alt="" width="52" height="52" loading="lazy">' : '') +
      '<span class="tb-picker-item-name">' + esc(row.name || row.id) + '</span></div>';
  }

  function renderPickerRows(rows) {
    var host = document.getElementById('mlsPickerList');
    if (!host) return;
    var kind = pickerCtx && pickerCtx.kind || 'unit';
    var side = pickerCtx && pickerCtx.side || 'ally';
    var idx = pickerCtx && pickerCtx.idx | 0;
    var owned = ownedMap();
    var ownedSupp = ownedSupportersMap();
    var usedSsr = kind === 'option' ? usedSsrOpIds(side, idx) : {};
    var usedUnits = kind === 'unit' ? usedUnitIds(side, idx) : {};
    var usedChars = kind === 'character' ? usedCharIds(side, idx) : {};
    var list = (rows || []).filter(function (u) {
      if (!u || !u.id) return false;
      /* Ally pickers only — enemy can always pick any kit. */
      if (side === 'ally' && kind === 'unit' && wantOwnedOnly() && owned[String(u.id)] == null) return false;
      if (side === 'ally' && kind === 'supporter' && wantOwnedOnly() && ownedSupp[String(u.id)] == null) return false;
      if (kind === 'option' && isSsrOpRow(u) && usedSsr[String(u.id)]) return false;
      /* Same side: one copy of each unit / pilot (enemy↔ally may still match). */
      if (kind === 'unit' && usedUnits[String(u.id)]) return false;
      if (kind === 'character' && usedChars[String(u.id)]) return false;
      return true;
    });
    var empty = '<div class="mls-note" style="padding:12px">' +
      (kind === 'option' ? 'No option parts for this unit.'
        : (kind === 'unit' || kind === 'character'
          ? 'No results (already on this side, or no match).'
          : 'No results.')) + '</div>';
    if (!list.length) {
      host.className = 'mls-picker-list';
      host.innerHTML = empty;
      return;
    }
    if (kind === 'option') {
      host.className = 'mls-picker-list mls-picker-list--rich';
      host.innerHTML = '<div class="tb-picker-option-list tb-picker-option-list--rich">' +
        list.map(function (u) { return mlsPickerEntityCell(u, 'mod'); }).join('') + '</div>';
      return;
    }
    if (kind === 'supporter') {
      host.className = 'mls-picker-list';
      host.innerHTML = '<div class="tb-picker-grid">' +
        list.map(function (u) { return mlsPickerEntityCell(u, 'supp'); }).join('') + '</div>';
      return;
    }
    /* unit / character — /cal attacker search grid */
    host.className = 'mls-picker-list';
    host.innerHTML = '<div class="tb-picker-grid">' +
      list.map(function (u) {
        return mlsPickerEntityCell(u, kind === 'character' ? 'char' : 'unit');
      }).join('') + '</div>';
  }

  function schedulePickerSearch(q) {
    if (pickerTimer) clearTimeout(pickerTimer);
    pickerTimer = setTimeout(function () {
      runPickerSearch(q).then(renderPickerRows).catch(function (e) {
        var host = document.getElementById('mlsPickerList');
        if (host) host.innerHTML = '<div class="mls-note" style="padding:12px">' + esc(String(e && e.message || e)) + '</div>';
      });
    }, 180);
  }

  function findPickerRow(id) {
    var row = null;
    (pickerRows || []).forEach(function (u) {
      if (String(u.id) === String(id)) row = u;
    });
    return row;
  }

  function applyPickerChoice(id) {
    if (!pickerCtx) return;
    var kind = pickerCtx.kind;
    var side = pickerCtx.side;
    var idx = pickerCtx.idx;
    var row = findPickerRow(id);
    closePicker();
    if (!row) return;
    if (kind === 'supporter') {
      var suppLb = 3;
      var colSuppLb;
      if (side === 'ally' && wantCollectionsLbSync()) {
        colSuppLb = collectionsSupporterLb(row.id);
        if (colSuppLb != null) suppLb = colSuppLb;
      }
      forceOf(side).supporter = {
        id: String(row.id),
        name: row.name || String(row.id),
        thum: supporterPortraitPath(row.portrait || row.thum || ''),
        portrait: supporterPortraitPath(row.portrait || row.thum || ''),
        rarity: row.rarity || '',
        lb: suppLb
      };
      clearLeaderApplyCaches(side);
      sideSupportData[side] = null;
      saveRoster();
      paintForceSlots();
      fillShareBoxes();
      scheduleOrderRefresh();
      return;
    }
    if (kind === 'option') {
      var slOp = forceOf(side).slots[idx];
      if (!slOp || !slOp.unitId) return;
      if (isSsrOpRow(row) && usedSsrOpIds(side, idx)[String(row.id)]) return;
      slOp.optionPartId = String(row.id);
      slOp.optionPartName = row.name || String(row.id);
      slOp.optionPartThum = row.thum || '';
      slOp.optionPartRarity = row.rarity || '';
      saveRoster();
      paintForceSlots();
      scheduleOrderRefresh();
      if (viewName === 'battle') loadArmies().then(paintBoard);
      return;
    }
    if (kind === 'character') {
      var slCh = forceOf(side).slots[idx];
      if (!slCh || !slCh.unitId) return;
      if (usedCharIds(side, idx)[String(row.id)]) return;
      slCh.charId = String(row.id);
      slCh.charName = row.name || String(row.id);
      slCh.charThum = row.thum || row.portrait || '';
      saveRoster();
      paintForceSlots();
      scheduleOrderRefresh();
      if (viewName === 'battle') loadArmies().then(paintBoard);
      return;
    }
    if (usedUnitIds(side, idx)[String(row.id)]) return;
    pickUnitRow(side, idx, row);
  }

  /* SSR OP uniqueness is per team only — enemy and ally may both use the same part. */
  function usedSsrOpIds(side, exceptIdx) {
    var used = {};
    forceOf(side).slots.forEach(function (sl, i) {
      if (!sl || !sl.optionPartId) return;
      if (i === exceptIdx) return;
      /* Only SSR ids block — same rule as /tb. Non-SSR may duplicate. */
      if (sl.optionPartRarity && String(sl.optionPartRarity).toUpperCase() !== 'SSR') return;
      used[String(sl.optionPartId)] = 1;
    });
    return used;
  }

  function isSsrOpRow(row) {
    if (typeof global._tbOptionPartIsSsr === 'function') return !!global._tbOptionPartIsSsr(row);
    return !!(row && String(row.rarity || '').toUpperCase() === 'SSR');
  }

  /** Same ranking path as Team Builder auto-fill when helpers are loaded. */
  function autoPickOpForSlot(side, idx, unitData, charData) {
    var sl = forceOf(side).slots[idx];
    if (!sl || !sl.unitId || sl.optionPartId) return Promise.resolve(null);
    var ensure = global._tbEnsureOpRowsForUnit;
    var rank = global._tbRankOptionForAutoFill;
    var cmp = global._tbCompareRankAuto;
    var compact = global._dcCompactOptionPartRow;
    var used = usedSsrOpIds(side, idx | 0);
    var ud = unitData || null;
    /* Keep Durability role visible to TB rank helpers (role_id 2 / Durability). */
    if (ud && sl.roleId && (ud.role_id == null || ud.role_id === '')) {
      ud = Object.assign({}, ud, { role_id: sl.roleId });
    } else if (ud && !ud.role && sl.roleId === '2') {
      ud = Object.assign({}, ud, { role: 'Durability', role_id: sl.roleId });
    }
    var pseudo = {
      unitId: sl.unitId,
      charId: sl.charId,
      unitData: ud,
      charData: charData || null,
      lbTier: sl.lb != null ? (sl.lb | 0) : 3,
      unitStatMode: 'normal',
      unitCondPassive: false,
      charCondPassive: false,
      unitTurnBuffAtk: false,
      unitTurnBuffDef: false,
      optionParts: []
    };
    var tbSide = side === 'enemy' ? 2 : 1;
    var ent = forceOf(side).supporter;
    var supP = Promise.resolve(null);
    if (ent && ent.id) {
      var lb = ent.lb != null ? (ent.lb | 0) : 3;
      var q = '/api/supporter/' + encodeURIComponent(ent.id) +
        '?lang=' + encodeURIComponent(lang()) + '&level=100&lb_tier=' + lb +
        '&for_unit_id=' + encodeURIComponent(sl.unitId) +
        (sl.charId ? ('&for_char_id=' + encodeURIComponent(sl.charId)) : '');
      supP = fetchJson(q).catch(function () { return null; });
    }
    var rowsP = typeof ensure === 'function'
      ? ensure(sl.unitId)
      : fetch('/api/option_parts?lang=' + encodeURIComponent(lang()) +
          '&page=1&per_page=100&sort=rarity&dir=desc&rarity=ALL&effect=ALL&unit_id=' +
          encodeURIComponent(sl.unitId), { credentials: 'same-origin' })
          .then(function (r) { return r.json(); })
          .then(function (d) { return d.rows || []; });

    return Promise.all([rowsP, supP]).then(function (pair) {
      var rows = pair[0] || [];
      var supFor = pair[1] && !pair[1].error ? pair[1] : null;
      var best = null;
      var bestR = null;
      var i, row, ra, part;
      for (i = 0; i < rows.length; i++) {
        row = rows[i];
        if (!row || row.id == null) continue;
        if (used[String(row.id)] && isSsrOpRow(row)) continue;
        if (typeof rank === 'function' && typeof cmp === 'function' && pseudo.unitData) {
          try {
            ra = rank(pseudo, tbSide, row, supFor);
            if (!bestR || cmp(ra, bestR) > 0) { bestR = ra; best = row; }
            continue;
          } catch (e) { /* fall through to rarity fallback */ }
        }
        if (!best) best = row;
        else if ((parseInt(row.rarity_sort, 10) || 99) < (parseInt(best.rarity_sort, 10) || 99)) best = row;
      }
      if (!best) return null;
      part = typeof compact === 'function' ? compact(best) : best;
      sl.optionPartId = String(part.id || best.id);
      sl.optionPartName = part.name || best.name || sl.optionPartId;
      sl.optionPartThum = part.thum || best.thum || '';
      sl.optionPartRarity = part.rarity || best.rarity || '';
      return sl;
    }).catch(function () { return null; });
  }

  function pickUnitRow(side, idx, row) {
    var pickLb = 3;
    var colLb;
    if (usedUnitIds(side, idx)[String(row.id)]) return;
    if (side === 'ally' && wantCollectionsLbSync()) {
      colLb = collectionsLb(row.id);
      if (colLb != null) pickLb = colLb;
    }
    loadPair(row.id, null, pickLb).then(function (loaded) {
      var charId = null;
      var u = loaded.unit || {};
      var rec = u.recommend_character;
      var usedChars;
      if (rec && rec.id) charId = rec.id;
      else if (u.recommended_character_id) charId = u.recommended_character_id;
      else if (u.default_character_id) charId = u.default_character_id;
      else if (u.pilot_id) charId = u.pilot_id;
      /* Skip recommended pilot when already fielded on this side. */
      usedChars = usedCharIds(side, idx);
      if (charId && usedChars[String(charId)]) {
        charId = null;
        rec = null;
      }
      var prev = forceOf(side).slots[idx];
      var slotLb = pickLb;
      if (!(side === 'ally' && wantCollectionsLbSync() && colLb != null) &&
          prev && prev.lb != null && String(prev.unitId) === String(row.id)) {
        slotLb = prev.lb | 0;
      }
      var slot = {
        unitId: String(row.id),
        charId: charId ? String(charId) : null,
        charName: '',
        charThum: '',
        lb: slotLb,
        name: row.name || u.name || String(row.id),
        thum: row.thum || u.thum || u.portrait || '',
        rarity: row.rarity || u.rarity || '',
        roleIcon: row.role_icon || u.role_icon || '',
        roleId: row.role_id != null ? String(row.role_id) : (u.role_id != null ? String(u.role_id) : ''),
        optionPartId: null,
        optionPartName: '',
        optionPartThum: '',
        optionPartRarity: '',
        unitHasSp: unitAllowsSpSsp(u),
        _statChecked: true,
        unitStatMode: resolveUnitStatMode(u, ''),
        charStatMode: ''
      };
      if (rec) {
        slot.charName = rec.name || '';
        slot.charThum = rec.thum || rec.portrait || '';
      }
      forceOf(side).slots[idx] = slot;
      saveRoster();
      paintForceSlots();
      var charP = charId ? fetchJson('/api/character/' + encodeURIComponent(charId) + '?lang=' + encodeURIComponent(lang())).catch(function () { return null; }) : Promise.resolve(null);
      return charP.then(function (cd) {
        if (cd && !cd.error) {
          slot.charName = cd.name || slot.charName;
          slot.charThum = cd.thum || cd.portrait || slot.charThum;
          slot.charHasSp = charAllowsSp(cd);
          slot._charStatChecked = true;
          if (!slot.charStatMode) slot.charStatMode = resolveCharStatMode(cd, '');
        }
        return autoPickOpForSlot(side, idx, u, cd);
      }).then(function () {
        saveRoster();
        paintForceSlots();
        scheduleOrderRefresh();
        if (viewName === 'battle') return loadArmies().then(paintBoard);
      });
    }).catch(function (e) {
      log(String(e && e.message || e));
    });
  }

  function setSlotLb(side, idx, tier, kind) {
    tier = Math.min(3, Math.max(0, tier | 0));
    if (kind === 'sup') {
      var sup = forceOf(side).supporter;
      if (!sup) return;
      sup.lb = tier;
      clearLeaderApplyCaches(side);
      sideSupportData[side] = null;
    } else {
      var sl = forceOf(side).slots[idx];
      if (!sl) return;
      sl.lb = tier;
    }
    saveRoster();
    paintForceSlots();
    scheduleOrderRefresh();
    if (viewName === 'battle') loadArmies().then(function () { paintBoard(); paintTimeline(); });
  }

  /** Toggle SP / SSP the same way /u and /c do: click the active mode to return to normal. */
  function setSlotStatMode(side, idx, kind, mode) {
    var sl = forceOf(side).slots[idx];
    if (!sl || !sl.unitId) return;
    if (kind === 'char') {
      if (sl._charStatChecked && !sl.charHasSp) return;
      sl.charStatMode = (sl.charStatMode === mode) ? 'normal' : mode;
    } else {
      if (sl._statChecked && !sl.unitHasSp) return;
      if (mode !== 'sp' && mode !== 'ssp') return;
      sl.unitStatMode = (sl.unitStatMode === mode) ? 'normal' : mode;
    }
    saveRoster();
    paintForceSlots();
    scheduleOrderRefresh();
    if (viewName === 'battle') loadArmies().then(function () { paintBoard(); paintTimeline(); });
  }

  function clearSupporter(side) {
    forceOf(side).supporter = null;
    sideSupportData[side] = null;
    clearLeaderApplyCaches(side);
    saveRoster();
    fillShareBoxes();
    paintForceSlots();
    scheduleOrderRefresh();
  }

  /** Wipe unit slots only — supporter stays. */
  function clearForceUnits(side) {
    var force = forceOf(side);
    if (!force) return;
    force.slots = emptySlots();
    saveRoster();
    fillShareBoxes();
    paintForceSlots();
    scheduleOrderRefresh();
    if (viewName === 'battle') {
      if (side === 'ally') lastAlly = [];
      if (side === 'enemy') lastEnemy = [];
      loadArmies().then(function () { paintBoard(); paintTimeline(); });
    }
    log('Cleared ' + side + ' units (supporter kept).');
  }

  function clearOption(side, idx) {
    var sl = forceOf(side).slots[idx];
    if (!sl) return;
    sl.optionPartId = null;
    sl.optionPartName = '';
    sl.optionPartThum = '';
    sl.optionPartRarity = '';
    saveRoster();
    paintForceSlots();
    if (viewName === 'battle') loadArmies().then(paintBoard);
  }

  /**
   * Same modified-stat panel as /tb (`tbStatsPanel`), under formation.
   * Temporarily mirrors MLS roster into S.tb so `_tbBuildSlotStatEff` + squad tags apply.
   */
  function renderMlsStats() {
    var pan = document.getElementById('mlsStatsPanel');
    if (!pan) return Promise.resolve();
    if (typeof global.initTeamBuilder !== 'function' || typeof global._tbBuildSlotStatEff !== 'function') {
      pan.innerHTML = '<div class="tb-stats-hint" style="font-size:11px;color:var(--text-muted);line-height:1.45">' +
        'Modified MS stats (Team Builder panel) need the main app calculator helpers.</div>';
      return Promise.resolve();
    }
    var S = global.S;
    var snap = null;
    try {
      global.initTeamBuilder();
      snap = {
        squads: JSON.parse(JSON.stringify(S.tb.squads)),
        supBySide: JSON.parse(JSON.stringify(S.tb.supBySide)),
        masterLeague: S.tb.masterLeague,
        terrainType: S.tb.terrainType,
        grandOffensive: S.tb.grandOffensive
      };
    } catch (e) {
      pan.innerHTML = '';
      return Promise.resolve();
    }
    S.tb.masterLeague = true;
    S.tb.grandOffensive = false;
    var terr = String((seasonMeta && seasonMeta.terrain_primary) || 'Space');
    S.tb.terrainType = /space|宇宙/i.test(terr) ? 'Space' : 'Ground';

    function fillSide(sideKey, tbSi) {
      var force = forceOf(sideKey);
      var ent = force.supporter;
      S.tb.supBySide[tbSi] = ent && ent.id
        ? { id: String(ent.id), data: sideSupportData[sideKey] || null, lbTier: ent.lb != null ? (ent.lb | 0) : 3, level: 100 }
        : { id: null, data: null, lbTier: 3, level: 100 };
      var jobs = [];
      var col;
      for (col = 0; col < SLOT_COUNT; col++) {
        (function (c) {
          var sl = force.slots[c];
          var slot = S.tb.squads[tbSi].slots[c];
          if (!slot) return;
          slot.unitId = null;
          slot.unitData = null;
          slot.charId = null;
          slot.charData = null;
          slot.optionParts = [];
          slot.lbTier = 3;
          slot.unitStatMode = 'normal';
          slot.unitCondPassive = false;
          slot.charCondPassive = false;
          slot.unitTurnBuffAtk = false;
          slot.unitTurnBuffDef = false;
          if (!sl || !sl.unitId) return;
          jobs.push(Promise.all([
            loadPair(sl.unitId, sl.charId, sl.lb != null ? sl.lb : 3),
            loadOptionPart(sl.optionPartId)
          ]).then(function (pair) {
            var ud = pair[0].unit;
            var cd = pair[0].char;
            var op = pair[1];
            if (!ud || ud.error) return;
            slot.unitId = String(sl.unitId);
            slot.unitData = ud;
            slot.charId = sl.charId ? String(sl.charId) : null;
            slot.charData = cd && !cd.error ? cd : null;
            slot.lbTier = sl.lb != null ? (sl.lb | 0) : 3;
            slot.unitStatMode = resolveUnitStatMode(ud, sl.unitStatMode);
            slot.charStatMode = resolveCharStatMode(cd, sl.charStatMode);
            slot.optionParts = op ? [op] : [];
            if (typeof global._tbSyncSlotCondPassives === 'function') {
              try { global._tbSyncSlotCondPassives(slot); } catch (_) {}
            }
          }).catch(function () {}));
        })(col);
      }
      return Promise.all(jobs);
    }

    return Promise.all([
      loadSupporter('ally'),
      loadSupporter('enemy')
    ]).then(function () {
      return Promise.all([fillSide('ally', 1), fillSide('enemy', 2)]);
    }).then(function () {
      var escFn = typeof global.esc === 'function' ? global.esc : esc;
      var tFn = typeof global.t === 'function' ? global.t : function (k) { return k; };
      var fmt = typeof global.fmtN === 'function' ? global.fmtN : String;
      var delta = typeof global._tbFmtStatDelta === 'function' ? global._tbFmtStatDelta : function () { return ''; };
      var jobs = [];
      var si, col;
      for (si = 1; si <= 2; si++) {
        for (col = 0; col < 5; col++) {
          jobs.push({ si: si, col: col, sl: S.tb.squads[si].slots[col] });
        }
      }
      var supByKey = {};
      var need = jobs.filter(function (j) {
        return j.sl && j.sl.unitData && S.tb.supBySide[j.si] && S.tb.supBySide[j.si].id;
      });
      return Promise.all(need.map(function (j) {
        var ent = S.tb.supBySide[j.si];
        var lb = Math.min(3, Math.max(0, ent.lbTier | 0));
        var q = '/api/supporter/' + encodeURIComponent(ent.id) +
          '?lang=' + encodeURIComponent(lang()) + '&level=100&lb_tier=' + lb +
          '&for_unit_id=' + encodeURIComponent(j.sl.unitId) +
          (j.sl.charId ? ('&for_char_id=' + encodeURIComponent(j.sl.charId)) : '');
        return fetchJson(q).then(function (d) {
          supByKey[j.si + ':' + j.col] = (!d || d.error) ? null : d;
        }).catch(function () { supByKey[j.si + ':' + j.col] = null; });
      })).then(function () {
        function mkRow(lbl, v, d) {
          var dn = d != null && Math.round(Number(d) || 0) < 0;
          return '<div class="tb-stats-unit-row' + (dn ? ' tb-stats-unit-row--neg' : '') +
            '"><span class="tb-sul">' + escFn(lbl) + '</span><span class="tb-suv-wrap"><span class="tb-suv">' +
            escFn(fmt(v)) + '</span>' + delta(d) + '</span></div>';
        }
        function colHtml(j) {
          var sl = j.sl;
          var labSide = j.si === 1 ? 'ALLY' : 'ENEMY';
          if (!sl || !sl.unitData) {
            return '<div class="tb-stats-unit-col"><div class="tb-stats-unit-name tb-stats-unit-name--empty">—</div></div>';
          }
          var st = global._tbBuildSlotStatEff(sl, j.si, supByKey[j.si + ':' + j.col]);
          if (!st) {
            return '<div class="tb-stats-unit-col"><div class="tb-stats-unit-name tb-stats-unit-name--empty">—</div></div>';
          }
          if (st.blocked) {
            return '<div class="tb-stats-unit-col"><div class="tb-stats-unit-name">' + escFn(st.ud.name || '') +
              '</div><div class="tb-stats-unit-warn">Cannot deploy (' + escFn(st.terrainSymbol || '-') + ')</div></div>';
          }
          return '<div class="tb-stats-unit-col" title="' + escFn(labSide) + '"><div class="tb-stats-unit-name">' +
            escFn(st.ud.name || '') + '</div><div class="tb-stats-unit-rows">' +
            mkRow(tFn('col_hp') || 'HP', st.hp, st.dHp) +
            mkRow(tFn('col_atk') || 'ATK', st.atk, st.dAtk) +
            mkRow(tFn('col_def') || 'DEF', st.def, st.dDef) +
            mkRow(tFn('col_mob') || 'MOB', st.mob, st.dMob) +
            mkRow(tFn('col_mov') || 'MOV', st.mov, st.dMov) +
            '</div></div>';
        }
        var sections = [];
        /* Match formation layout: enemy left / ally right → show ENEMY then ALLY like squad panels. */
        [[2, 'ENEMY'], [1, 'ALLY']].forEach(function (pair) {
          var cols = jobs.filter(function (j) { return j.si === pair[0]; }).map(colHtml);
          sections.push('<div class="tb-stats-squad"><div class="tb-stats-squad-h">' + escFn(pair[1]) +
            '</div><div class="tb-stats-squad-cols">' + cols.join('') + '</div></div>');
        });
        var hint = (tFn('tb_stats_hint') || '') + (tFn('tb_stats_hint_squad') || '');
        pan.innerHTML = '<div class="tb-stats-hint" style="font-size:11px;color:var(--text-muted);margin-bottom:10px;line-height:1.45">' +
          escFn(hint) + '</div><div class="tb-stats-all tb-stats-all--squads">' + sections.join('') + '</div>';
      });
    }).catch(function () {
      pan.innerHTML = '';
    }).finally(function () {
      if (!snap) return;
      try {
        S.tb.squads = snap.squads;
        S.tb.supBySide = snap.supBySide;
        S.tb.masterLeague = snap.masterLeague;
        S.tb.terrainType = snap.terrainType;
        S.tb.grandOffensive = snap.grandOffensive;
      } catch (_) {}
    });
  }

  function statOf(arr, name) {
    var i, e;
    arr = arr || [];
    for (i = 0; i < arr.length; i++) {
      e = arr[i];
      if (e && e.name === name) return Math.round(Number(e.total) || 0);
    }
    return 0;
  }

  function unitStats(ud, lb, statMode) {
    var rows = ud && ud.lb_data;
    var tier = 0;
    var row, list, key;
    if (rows && rows.length) tier = Math.min(Math.max(0, lb | 0), rows.length - 1);
    row = rows && rows[tier];
    key = 'stats_no_cond';
    if (ud && ud.has_sp && statMode === 'ssp') key = 'ssp_stats_no_cond';
    else if (ud && ud.has_sp && statMode === 'sp') key = 'sp_stats_no_cond';
    list = row ? (row[key] || row.stats_no_cond || row.stats || []) : [];
    return {
      hp: statOf(list, 'HP'),
      en: statOf(list, 'EN'),
      atk: statOf(list, 'Attack'),
      def: statOf(list, 'Defense'),
      mob: statOf(list, 'Mobility'),
      move: Math.max(1, statOf(list, 'Move') || 3)
    };
  }

  function charStats(cd, statMode) {
    var list = (statMode === 'sp' && cd && cd.sp_stats && cd.sp_stats.length)
      ? cd.sp_stats
      : ((cd && (cd.stats || cd.stats_with_ex)) || []);
    return {
      reaction: statOf(list, 'Reaction'),
      def: statOf(list, 'Defense'),
      melee: statOf(list, 'Melee'),
      ranged: statOf(list, 'Ranged'),
      awaken: statOf(list, 'Awaken')
    };
  }

  function loadPair(unitId, charId, lb) {
    var uUrl = '/api/unit/' + encodeURIComponent(unitId) + '?lang=' + encodeURIComponent(lang());
    var cUrl = charId ? ('/api/character/' + encodeURIComponent(charId) + '?lang=' + encodeURIComponent(lang())) : '';
    return Promise.all([
      fetchJson(uUrl),
      cUrl ? fetchJson(cUrl) : Promise.resolve(null)
    ]).then(function (pair) {
      return { unit: pair[0], char: pair[1], lb: lb | 0 };
    });
  }

  /** Prefetched Escape Function alternate unit JSON (id → unit detail). */
  var escapeUnitCache = Object.create(null);

  function escapeMechanismEntry(ud) {
    var list, i, m, key, nm;
    if (!ud) return null;
    list = ud.mechanisms || [];
    for (i = 0; i < list.length; i++) {
      m = list[i] || {};
      key = String(m.mechanism_type_key || m.mechanism_type_label || '');
      nm = String(m.name || '');
      if (/^Escape$/i.test(key) || /Escape\s*Function|脱出機能|脫出機能|脱逃机能/i.test(nm)) {
        return m;
      }
    }
    return null;
  }

  function unitHasEscapeMechanism(ud) {
    return !!escapeMechanismEntry(ud);
  }

  function escapeMechanismMeta(ud) {
    var m = escapeMechanismEntry(ud);
    return {
      name: (m && m.name) || 'Escape Function',
      icon: (m && m.icon) || '/static/images/mechanism/mechanism_0005.webp'
    };
  }

  /** Freeze deployed identity so Escape morph does not leak into playback start. */
  function captureFormBase(actor) {
    if (!actor) return null;
    return {
      id: String(actor.id || ''),
      name: actor.name || '',
      thum: actor.thum || '',
      unit: actor.unit || null,
      maxHp: actor.maxHp | 0,
      maxEn: actor.maxEn | 0,
      mobility: actor.mobility | 0,
      _spdMob: actor._spdMob != null ? (actor._spdMob | 0) : (actor.mobility | 0),
      _spdReact: actor._spdReact != null ? (actor._spdReact | 0) : (actor.reaction | 0),
      baseMove: actor.baseMove != null ? (actor.baseMove | 0) : (actor.move | 0),
      move: actor.move | 0,
      isLarge: !!actor.isLarge,
      size: actor.size != null ? (actor.size | 0) : (actor.isLarge ? 2 : 1),
      unitStatMode: actor.unitStatMode || 'normal',
      weapons: (actor.weapons || []).slice()
    };
  }

  /**
   * Official Escape note: if the post-evac unit’s terrain is only “dash” / ×,
   * evacuation does not occur (EN “dash” · JA 地形適正が×のみ).
   */
  function unitTerrainOnlyDash(ud) {
    var terr, i, row, sym, lv;
    terr = (ud && ud.terrain) || [];
    if (!terr.length) return false;
    for (i = 0; i < terr.length; i++) {
      row = terr[i] || {};
      sym = String(row.symbol || '').trim();
      lv = parseInt(row.level, 10);
      if (!(sym === '-' || sym === '×' || (Number.isFinite(lv) && lv <= 0))) {
        return false;
      }
    }
    return true;
  }

  function prefetchEscapePartner(ud) {
    var pid;
    if (!ud || !unitHasEscapeMechanism(ud)) return Promise.resolve(null);
    pid = ud.transform_partner_id;
    if (pid == null || pid === '') return Promise.resolve(null);
    pid = String(pid);
    if (escapeUnitCache[pid]) return Promise.resolve(escapeUnitCache[pid]);
    return fetchJson('/api/unit/' + encodeURIComponent(pid) + '?lang=' + encodeURIComponent(lang()))
      .then(function (d) {
        if (d && !d.error) escapeUnitCache[pid] = d;
        return escapeUnitCache[pid] || null;
      })
      .catch(function () { return null; });
  }

  /**
   * Escape Function: on HP 0, once/battle, morph into transform_partner_id in-place
   * (same pilot / OP / supporter / position). Returns true if transformed.
   */
  function tryEscapeTransform(actor, turn, snapshotLine) {
    var ud, pid, alt, sheet, fieldTerr, baseMove, oldName, oldId, mech;
    if (!actor || (actor.hp | 0) > 0 || actor._escapeUsed) return false;
    ud = actor.unit;
    if (!unitHasEscapeMechanism(ud)) return false;
    pid = ud.transform_partner_id;
    if (pid == null || pid === '') return false;
    alt = escapeUnitCache[String(pid)];
    if (!alt) return false;
    if (unitTerrainOnlyDash(alt)) return false;

    if (!actor._formBase) actor._formBase = captureFormBase(actor);
    mech = escapeMechanismMeta(ud);
    oldName = actor.name;
    oldId = actor.id;
    sheet = sheetCombatStats({
      unit: alt,
      char: actor.char,
      lb: actor.lb | 0,
      side: actor.side,
      unitStatMode: resolveUnitStatMode(alt, actor.unitStatMode)
    }, actor.optionParts || [], actor.supporter || null);
    fieldTerr = String(actor.fieldTerrain || (seasonMeta && seasonMeta.terrain_primary) || '');
    baseMove = sheet.move || unitStats(alt, actor.lb | 0, resolveUnitStatMode(alt, actor.unitStatMode)).move;

    actor._escapeUsed = true;
    actor._escapedThisEngagement = true;
    actor._escapedFromId = oldId;
    actor.id = String(alt.id);
    actor.name = alt.name || String(alt.id);
    actor.unit = alt;
    actor.thum = thumbUrl(alt.thum || alt.portrait || '');
    actor.maxHp = sheet.hp | 0;
    actor.hp = actor.maxHp;
    actor.ghostHp = actor.hp;
    actor.maxEn = sheet.en | 0;
    actor.currentEn = actor.maxEn;
    actor.mobility = sheet.mob | 0;
    actor._spdMob = Math.floor(
      unitStats(alt, actor.lb | 0, resolveUnitStatMode(alt, actor.unitStatMode)).mob * mlBoostMult()
    ) | 0;
    actor.baseMove = baseMove | 0;
    actor.move = applyTerrainMove(baseMove, alt, fieldTerr);
    actor.terrainMoveFactor = terrainMoveFactor(alt, fieldTerr);
    actor.occupancyMode = unitOccupancyMode(alt, fieldTerr);
    actor.isLarge = unitIsLarge(alt);
    actor.size = actor.isLarge ? 2 : 1;
    actor.weapons = weaponsOf(alt, resolveUnitStatMode(alt, actor.unitStatMode));
    actor.unitStatMode = resolveUnitStatMode(alt, actor.unitStatMode);
    actor.lingerKo = false;
    /*
     * Keep _koThisEngagement — same class as revive: escaped form does not
     * Counter / Support Counter in the engagement that dropped the prior form.
     */
    actor._koThisEngagement = true;

    if (typeof snapshotLine === 'function') {
      snapshotLine(
        'T' + turn + ' ' + mech.name + ': ' + oldName + ' → ' + actor.name +
        ' (HP ' + (actor.hp | 0) + '/' + (actor.maxHp | 0) + ')',
        {
          x: actor.x, y: actor.y,
          text: String(mech.name || 'Escape Function').slice(0, 22),
          skillName: String(mech.name || 'Escape Function').slice(0, 22),
          badge: 'SKILL',
          icon: mech.icon || '',
          cls: 'mls-float--skill'
        },
        null,
        'skill'
      );
    }
    return true;
  }

  /** ULT Alteration present → MLS treats kit as maxed Alt (full max_add_stats + ult weapons). */
  function unitHasUltAlt(ud) {
    return !!(ud && ud.ult_alteration && ud.ult_alteration.max_add_stats);
  }

  function weaponsOf(ud, statMode) {
    var ultOn = unitHasUltAlt(ud);
    var sspOn = statMode === 'ssp';
    return ((ud && ud.weapons) || []).filter(function (w) {
      if (!w) return false;
      /* Match /cal _dcNonMapWeapons: ult weapons only when ULT Alt is on. */
      if (w.is_ult_weapon && !ultOn) return false;
      /* Custom Core weapons only while the unit is in SSP. */
      if ((w.is_ssp_weapon || w.ssp_only) && !sspOn) return false;
      return true;
    }).map(function (w) {
      var levels = w.levels || [];
      var lv = levels.length ? levels[levels.length - 1] : {};
      return {
        raw: w,
        name: w.name || (w.is_ex ? 'EX' : 'Weapon'),
        icon: w.icon || w.ssp_icon || '',
        icon_color: w.icon_color || w.ssp_icon_color || '',
        min_range: w.min_range != null ? w.min_range | 0 : 1,
        max_range: w.max_range != null ? w.max_range | 0 : 1,
        power: (lv.power != null ? lv.power : w.power) | 0,
        en: (lv.en != null ? lv.en : (w.en_cost != null ? w.en_cost : w.en)) | 0,
        en_cost: (w.en_cost != null ? w.en_cost : (lv.en != null ? lv.en : w.en)) | 0,
        ammo: (lv.ammo != null ? lv.ammo : w.ammo) | 0,
        accuracy: (lv.accuracy != null ? lv.accuracy : w.accuracy) | 0,
        critical: (lv.critical != null ? lv.critical : w.critical) | 0,
        is_ex: !!w.is_ex,
        is_ssp_weapon: !!(w.is_ssp_weapon || w.ssp_only),
        is_map: !!(w.is_map || w.is_map_weapon),
        is_map_weapon: !!(w.is_map || w.is_map_weapon),
        is_ult_weapon: !!w.is_ult_weapon,
        is_preemptive: !!w.is_preemptive,
        traits: (w.traits || lv.traits || []).slice(),
        usage_restrictions: (w.usage_restrictions || []).slice(),
        map_coords: (w.map_coords || []).slice(),
        shooting_coords: (w.shooting_coords || []).slice(),
        map_single_pou: !!w.map_single_pou,
        attribute: w.attribute || '',
        weapon_type: w.weapon_type || ''
      };
    });
  }

  function actorHpPct(actor) {
    var maxHp = Math.max(1, (actor && actor.maxHp) | 0);
    return Math.max(0, Math.min(100, Math.round(100 * ((actor && actor.hp) | 0) / maxHp)));
  }

  function actorEnPct(actor) {
    var maxEn = Math.max(1, (actor && actor.maxEn) | 0);
    return Math.max(0, Math.min(100, Math.round(100 * ((actor && actor.currentEn) | 0) / maxEn)));
  }

  function abilityDetailTexts(ab) {
    var out = [];
    if (ab && ab.name) out.push(String(ab.name));
    (Array.isArray(ab && ab.details) ? ab.details : []).forEach(function (d) {
      out.push(typeof d === 'string' ? d : ((d && d.text) || ''));
    });
    return out;
  }

  function parseHpGateFromText(txt) {
    if (typeof global._dcParseOwnHpPercentGate === 'function') {
      return global._dcParseOwnHpPercentGate(txt);
    }
    var t = String(txt || '').replace(/\n/g, ' ');
    var m;
    if (!t || !/HP|ヒットポイント|耐久/i.test(t)) return null;
    m = t.match(/HP\s*(?:is\s*)?(\d+)\s*%\s*or\s+(?:above|higher|greater)/i);
    if (!m) m = t.match(/HP\s*(?:is\s*)?(?:at\s+least|≥|>=)\s*(\d+)\s*%/i);
    if (!m) m = t.match(/HP(?:が|為|为)\s*(\d+)\s*%\s*以上/);
    if (!m) m = t.match(/HP\s*(\d+)\s*%\s*以上/);
    if (m) return { dir: 'above', pct: parseInt(m[1], 10) || 0 };
    m = t.match(/HP\s*(?:is\s*)?(\d+)\s*%\s*or\s+(?:below|less|lower)/i);
    if (!m) m = t.match(/HP\s*(?:is\s*)?(?:below|under|less\s+than|≤|<=)\s*(\d+)\s*%/i);
    if (!m) m = t.match(/HP(?:が|為|为)\s*(\d+)\s*%\s*(?:以下|未満)/);
    if (!m) m = t.match(/HP\s*(\d+)\s*%\s*(?:以下|未満)/);
    if (m) return { dir: 'below', pct: parseInt(m[1], 10) || 0 };
    return null;
  }

  function parseEnGateFromText(txt) {
    if (typeof global._dcParseOwnEnPercentGate === 'function') {
      return global._dcParseOwnEnPercentGate(txt);
    }
    return null;
  }

  /** Live Cond:HP / Cond:EN — null = no gate on sheet; bool = gate result. */
  function liveOwnPercentGatesMet(abilities, hpPct, enPct) {
    var above = [], below = [], enAbove = [], enBelow = [];
    var i, texts, g;
    (abilities || []).forEach(function (ab) {
      texts = abilityDetailTexts(ab);
      for (i = 0; i < texts.length; i++) {
        g = parseHpGateFromText(texts[i]);
        if (g) {
          if (g.dir === 'above') above.push(g.pct | 0);
          else below.push(g.pct | 0);
        }
        g = parseEnGateFromText(texts[i]);
        if (g) {
          if (g.dir === 'above') enAbove.push(g.pct | 0);
          else enBelow.push(g.pct | 0);
        }
      }
    });
    if (!above.length && !below.length && !enAbove.length && !enBelow.length) return null;
    if (above.length || below.length) {
      var hpOk = false;
      if (above.length && !below.length) {
        hpOk = above.some(function (th) { return hpPct >= th; });
      } else if (below.length && !above.length) {
        hpOk = below.some(function (th) { return hpPct <= th; });
      } else {
        hpOk = above.some(function (th) { return hpPct >= th; })
          || below.some(function (th) { return hpPct <= th; });
      }
      if (!hpOk) return false;
    }
    if (enAbove.length || enBelow.length) {
      var enOk = false;
      if (enAbove.length && !enBelow.length) {
        enOk = enAbove.some(function (th) { return enPct >= th; });
      } else if (enBelow.length && !enAbove.length) {
        enOk = enBelow.some(function (th) { return enPct <= th; });
      } else {
        enOk = enAbove.some(function (th) { return enPct >= th; })
          || enBelow.some(function (th) { return enPct <= th; });
      }
      if (!enOk) return false;
    }
    return true;
  }

  /** Cond:Vigor gate from unit/char abilities (same helpers as /cal). null = no gate. */
  function liveVigorGateMet(actor, data, kind) {
    var thr = null, req, mpLv;
    if (!data) return null;
    if (kind === 'char' && typeof global._dcVigorThresholdFromChar === 'function') {
      thr = global._dcVigorThresholdFromChar(data);
    } else if (typeof global._dcVigorThresholdFromUnit === 'function') {
      thr = global._dcVigorThresholdFromUnit(data);
    }
    if (!thr) return null;
    req = typeof global._dcVigorTierMax === 'function'
      ? global._dcVigorTierMax(thr, 'max')
      : thr;
    mpLv = vigorLevelFromMp(actor && actor.mp);
    if (typeof global._dcVigorAtLeast === 'function') {
      return global._dcVigorAtLeast(mpLv, req);
    }
    return mpLv === req || mpLv === 'super' || (req === 'max' && (mpLv === 'max' || mpLv === 'super'));
  }

  /**
   * Live unit Conditional Passive for /cal sheets:
   * Cond:HP / Cond:EN / Cond:Vigor / Cond:Combat-Count / Cond:Damage taken /
   * plus always-on Series·Tag·Character·Weapon sheets once other gates pass.
   */
  function unitHasWhenAttackingCombatCond(ud) {
    if (typeof global._dcUnitWhenAttackingCombatBonuses === 'function') {
      return !!global._dcUnitWhenAttackingCombatBonuses(ud);
    }
    return ((ud && ud.abilities) || []).some(function (ab) {
      var name = String((ab && ab.name) || '');
      var blob;
      if (!/\(\s*(?:Cond|Cnd):\s*Combat\s*\)/i.test(name)) return false;
      if (/\(\s*(?:Cond|Cnd):\s*Combat\s*-\s*Count\s*\)/i.test(name)) return false;
      blob = abilityDetailTexts(ab).join(' ');
      return /when\s+attacking/i.test(blob);
    });
  }

  function unitCpIsOnlyWhenAttackingCombat(ud) {
    if (typeof global._dcUnitCpIsOnlyWhenAttackingCombat === 'function') {
      return !!global._dcUnitCpIsOnlyWhenAttackingCombat(ud);
    }
    return unitHasWhenAttackingCombatCond(ud);
  }

  /**
   * Live unit Conditional Passive for /cal sheets.
   * opts.asDefender / opts.excludeWhenAttackingCombat: suppress Cond:Combat “When attacking”
   * (DEF never while covering; ATK/DEF never on Counter / Support Attack / Support Counter).
   */
  function liveUnitCondPassive(actor, opts) {
    var ud = actor && actor.unit;
    var gate, vigor, combatMeta, dmgDefMeta, stacksCombat, stacksTaken;
    var suppressWhenAtk, combatTitleActive;
    opts = opts || {};
    if (!ud) return false;
    suppressWhenAtk = !!(opts.asDefender || opts.excludeWhenAttackingCombat) &&
      unitHasWhenAttackingCombatCond(ud) && unitCpIsOnlyWhenAttackingCombat(ud);
    if (suppressWhenAtk) return false;
    combatMeta = ud.unit_combat_count_atk;
    dmgDefMeta = ud.unit_damage_taken_def;
    stacksCombat = actor.combatCountStacks | 0;
    stacksTaken = actor.damageTakenStacks | 0;
    combatTitleActive = unitHasCondTitle(ud, /\(\s*(?:Cond|Cnd):\s*(?:Combat(?:\s*-\s*Count)?|Deals Damage|Defeat)\s*\)/i);
    if ((opts.asDefender || opts.excludeWhenAttackingCombat) && unitHasWhenAttackingCombatCond(ud) && !combatMeta) {
      /* When-attacking Cond:Combat alone must not arm CP while defending / on excluded waves. */
      combatTitleActive = unitHasCondTitle(ud, /\(\s*(?:Cond|Cnd):\s*(?:Combat\s*-\s*Count|Deals Damage|Defeat)\s*\)/i);
    }
    if (!ud.has_cond_stats) {
      /* Stack metas / Cond:Combat titles can arm CP without a with_cond sheet delta. */
      if (combatMeta && stacksCombat > 0) return true;
      if (dmgDefMeta && stacksTaken > 0) return true;
      if (stacksCombat > 0 && combatTitleActive) return true;
      if (stacksTaken > 0 && unitHasCondTitle(ud, /\(\s*(?:Cond|Cnd):\s*Damage taken\s*\)/i)) return true;
      return false;
    }
    gate = liveOwnPercentGatesMet(ud.abilities, actorHpPct(actor), actorEnPct(actor));
    if (gate === false) return false;
    vigor = liveVigorGateMet(actor, ud, 'unit');
    if (vigor === false) return false;
    if (gate === true || vigor === true) return true;
    if ((combatMeta || combatTitleActive) && stacksCombat > 0) return true;
    if ((dmgDefMeta || unitHasCondTitle(ud, /\(\s*(?:Cond|Cnd):\s*Damage taken\s*\)/i)) && stacksTaken > 0) return true;
    /* Stack-only kits stay off at 0 stacks. */
    if (combatMeta || dmgDefMeta || combatTitleActive ||
        unitHasCondTitle(ud, /\(\s*(?:Cond|Cnd):\s*Damage taken\s*\)/i)) {
      if (gate === null && vigor === null) return false;
    }
    /* Series / Tag / Character / Weapon / Range / Squad sheets — active in battle when gates allow. */
    return true;
  }

  function liveCharCondPassive(actor) {
    var cd = actor && actor.char;
    var gate, vigor;
    if (!cd) return false;
    gate = liveOwnPercentGatesMet(cd.abilities, actorHpPct(actor), actorEnPct(actor));
    if (gate === false) return false;
    vigor = liveVigorGateMet(actor, cd, 'char');
    if (vigor === false) return false;
    /* EX / Supercharged / tag CP sheets stay on unless a live gate failed. */
    return true;
  }

  function liveHpAtkTierIndex(actor) {
    var meta = actor && actor.unit && actor.unit.unit_hp_atk_tiers;
    var tiers, pct, i, best;
    if (!meta || !Array.isArray(meta.tiers) || !meta.tiers.length) return 0;
    tiers = meta.tiers;
    pct = actorHpPct(actor);
    best = 0;
    for (i = 0; i < tiers.length; i++) {
      if (pct >= ((tiers[i] && tiers[i].hp_pct) | 0)) best = i;
    }
    return best;
  }

  function liveCombatStackCount(actor) {
    var cc = actor && actor.unit && actor.unit.unit_combat_count_atk;
    var n = actor && actor.combatCountStacks | 0;
    if (!cc) return 0;
    return Math.max(0, Math.min(cc.max_stacks | 0, n));
  }

  function liveDamageTakenDefStacks(actor) {
    var dd = actor && actor.unit && actor.unit.unit_damage_taken_def;
    var n = actor && actor.damageTakenStacks | 0;
    if (!dd) return 0;
    return Math.max(0, Math.min(dd.max_stacks | 0, n));
  }

  /** Supercharged EX tier from live MP (tier list on char.ex_supercharged_tiers). */
  function liveSuperchargedExTier(actor) {
    var tiers = actor && actor.char && actor.char.ex_supercharged_tiers;
    var mpLv, max;
    if (!tiers || !tiers.length) return 0;
    max = tiers.length - 1;
    mpLv = vigorLevelFromMp(actor && actor.mp);
    if (mpLv === 'super') return max;
    if (mpLv === 'max' && max >= 1) return Math.max(0, max - 1);
    return 0;
  }

  /**
   * /cal defNpc ignores unitDamageTakenDefStacks — apply Cond:Damage taken DEF
   * onto defender Defense after _dcSyncDefNpcFromDatabase.
   */
  function applyLiveDamageTakenDefToDefNpc(defender, dc) {
    var dd, n, raw, base, pct, tot;
    dd = defender && defender.unit && defender.unit.unit_damage_taken_def;
    n = liveDamageTakenDefStacks(defender);
    if (!dd || !(dd.per > 0) || n <= 0 || !dc || !dc.defNpc || !dc.defNpc.unit) return;
    raw = dc.defNpc.unit.stats_raw || (dc.defNpc.unit.stats_raw = {});
    base = raw.Defense | 0;
    if (!(base > 0)) return;
    pct = (dd.per | 0) * n;
    tot = Math.floor(base * (100 + pct) / 100);
    raw.Defense = tot;
  }

  function unitHasCondTitle(ud, re) {
    return ((ud && ud.abilities) || []).some(function (ab) {
      return re.test(String((ab && ab.name) || ''));
    });
  }

  function bumpCondStacksAfterHit(attacker, defender) {
    var cc, dd, max, ud;
    if (attacker && attacker.unit) {
      ud = attacker.unit;
      if (ud.unit_combat_count_atk) {
        cc = ud.unit_combat_count_atk;
        max = Math.max(1, cc.max_stacks | 0);
        attacker.combatCountStacks = Math.min(max, (attacker.combatCountStacks | 0) + 1);
      } else if (unitHasCondTitle(ud, /\(\s*(?:Cond|Cnd):\s*(?:Combat(?:\s*-\s*Count)?|Deals Damage|Defeat)\s*\)/i)) {
        /* Cond:Combat / Deals Damage / Defeat — mark “has fought” for CP-on sheets. */
        attacker.combatCountStacks = Math.min(20, (attacker.combatCountStacks | 0) + 1);
      }
    }
    if (defender && defender.unit) {
      ud = defender.unit;
      if (ud.unit_damage_taken_def) {
        dd = ud.unit_damage_taken_def;
        max = Math.max(1, dd.max_stacks | 0);
        defender.damageTakenStacks = Math.min(max, (defender.damageTakenStacks | 0) + 1);
      } else if (unitHasCondTitle(ud, /\(\s*(?:Cond|Cnd):\s*Damage taken\s*\)/i)) {
        defender.damageTakenStacks = Math.min(20, (defender.damageTakenStacks | 0) + 1);
      }
    }
  }

  function weaponAttrKeys(weapon) {
    var raw = weapon && (weapon.raw || weapon);
    if (raw && typeof global._dcWeaponAttributeKeys === 'function') {
      return global._dcWeaponAttributeKeys(raw) || [];
    }
    var lab = String((raw && (raw.attribute || raw.Attribute)) || (weapon && weapon.name) || '');
    var keys = [];
    if (/\bbeam\b|ビーム|光束|鐳射|빔/i.test(lab)) keys.push('beam');
    if (/\bphysical\b|物理|물리/i.test(lab)) keys.push('physical');
    if (/\bspecial\b|特殊|특수/i.test(lab)) keys.push('special');
    return keys;
  }

  /** Ability-line DTD (Phase Shift Armor, Beam Damage Reduction, Armure Lumiere, I-Field, …) — not always in unit.skills. */
  function abilityDamageTakenDownPct(unitData, weapon) {
    var best = 0;
    var blob, m, pct, wantBeam, wantPhys, wantSpec, wantRanged, wantMelee;
    var keys, isBeam, isPhys, isSpec, isRanged;
    keys = weaponAttrKeys(weapon);
    isBeam = keys.indexOf('beam') >= 0;
    isPhys = keys.indexOf('physical') >= 0;
    isSpec = keys.indexOf('special') >= 0;
    isRanged = weaponIsRanged(weapon);
    ((unitData && unitData.abilities) || []).forEach(function (ab) {
      blob = abilityDetailTexts(ab).join(' ');
      if (!/reduce\s+damage\s+taken|被ダメージ|損傷(?:減輕|減少)/i.test(blob)) return;
      m = blob.match(/(\d+)\s*%/);
      pct = m ? (parseInt(m[1], 10) || 0) : 0;
      if (pct <= 0) return;
      /*
       * Attack-type + attribute gates (AND when both appear):
       * - Armure Lumiere: “ranged weapon” only
       * - I-Field: “beam ranged weapon” → must be beam AND ranged
       * - Plain “beam” / “physical” / “special” without ranged/melee → attribute only
       */
      wantRanged = /ranged\s+weapon|射撃武装|遠程武装|遠距離武装|當敵方以射擊|ビーム射撃|光束射擊|鐳射射擊/i.test(blob);
      wantMelee = /melee\s+weapon|格闘武装|近接武装/i.test(blob);
      wantBeam = /\bbeam\b|ビーム|光束|鐳射/i.test(blob);
      wantPhys = /\bphysical\b|物理/i.test(blob);
      wantSpec = /\bspecial\b|特殊/i.test(blob);
      if (wantRanged || wantMelee || wantBeam || wantPhys || wantSpec) {
        if (wantRanged && !isRanged) return;
        if (wantMelee && isRanged) return;
        if (wantBeam && !isBeam) return;
        if (wantPhys && !isPhys) return;
        if (wantSpec && !isSpec) return;
      }
      if (pct > best) best = pct;
    });
    return Math.min(80, best);
  }

  /** "Restore own HP and EN by 5% at the start of every turn." */
  function parseTurnStartRestore(actor) {
    var hpPct = 0, enPct = 0, found = false;
    var bags = [], i, ab, texts, t, m;
    if (actor && actor.unit && actor.unit.abilities) bags.push(actor.unit.abilities);
    if (actor && actor.char && actor.char.abilities) bags.push(actor.char.abilities);
    bags.forEach(function (list) {
      for (i = 0; i < list.length; i++) {
        ab = list[i];
        texts = abilityDetailTexts(ab);
        texts.forEach(function (raw) {
          t = String(raw || '').replace(/\n/g, ' ');
          if (!/start of every turn|毎ターン開始|每回合開始|毎回合開始/i.test(t)) return;
          if (!/restor|回復|恢復|回复/i.test(t)) return;
          m = t.match(/HP(?:\s+and\s+EN|\s*[&／/・]\s*EN)?\s+by\s+(\d+)\s*%/i)
            || t.match(/HP(?:と|及|和)EN.*?(\d+)\s*%/)
            || t.match(/耐久.*?(\d+)\s*%/);
          if (m) {
            found = true;
            hpPct = Math.max(hpPct, parseInt(m[1], 10) || 0);
            if (/EN|ENを|EN及|EN和/i.test(t)) enPct = Math.max(enPct, parseInt(m[1], 10) || 0);
          }
          m = t.match(/EN\s+by\s+(\d+)\s*%/i) || t.match(/EN.*?(\d+)\s*%/);
          if (m && /restor|回復|恢復|回复/i.test(t) && /EN/i.test(t)) {
            found = true;
            enPct = Math.max(enPct, parseInt(m[1], 10) || 0);
          }
        });
      }
    });
    return found ? { hpPct: hpPct, enPct: enPct } : null;
  }

  /** Unit ids on an ability detail's condition chips (Setsuna/Char revive gates). */
  function abilityDetailUnitIds(ab, detailIdx) {
    var out = [];
    var details, d, conds, i, c, id;
    details = Array.isArray(ab && ab.details) ? ab.details : [];
    d = details[detailIdx];
    if (!d || typeof d === 'string') return out;
    conds = [].concat(d.conditions || []);
    (Array.isArray(d.condition_groups) ? d.condition_groups : []).forEach(function (g) {
      conds = conds.concat((g && g.conditions) || []);
    });
    for (i = 0; i < conds.length; i++) {
      c = conds[i];
      if (!c) continue;
      if (String(c.type || '') === 'unit' || String(c.source || '') === 'unit_ids') {
        id = String(c.id || '');
        if (id && id !== '0') out.push(id);
      }
    }
    return out;
  }

  /**
   * Once-only (or stack) "HP falls to X% → restore Y%".
   * thr 0 = lethal revive (Char/Zeong, Setsuna/00 Raiser, …).
   * thr >0 = alive-only threshold heal (Shinn/Impulse 50%, …) — not a KO revive.
   * Prefer Master unit-id chips over localized names.
   */
  function parseHpFallRestores(actor) {
    var out = [];
    var bags = [], i, ab, di, detail, t, m, thr, heal, once, unitName, unitIds, key;
    if (actor && actor.char && actor.char.abilities) bags.push({ src: 'char', list: actor.char.abilities });
    if (actor && actor.unit && actor.unit.abilities) bags.push({ src: 'unit', list: actor.unit.abilities });
    bags.forEach(function (bag) {
      for (i = 0; i < bag.list.length; i++) {
        ab = bag.list[i];
        for (di = 0; di < (ab.details || []).length; di++) {
          detail = ab.details[di];
          t = String((typeof detail === 'string' ? detail : (detail && detail.text)) || '')
            .replace(/\n/g, ' ');
          if (!t) continue;
          if (!/HP\s+falls\s+to|HPが|HP為|HP为|自身HP|耐久.*(?:以下|以下に|降至)/i.test(t)) continue;
          if (!/restor|回復|恢復|回复/i.test(t)) continue;
          /* thr: EN "falls to 0% or below" / "falls to 0% when…"; JA 0%になった時; TW/HK 0%時 */
          m = t.match(/HP\s+falls\s+to\s+(\d+)\s*%(?:\s*or\s+below)?/i)
            || t.match(/HP(?:が|為|为)\s*(\d+)\s*%\s*(?:以下|未満|になった|になった時|時|时)/)
            || t.match(/自身HP為\s*(\d+)\s*%/)
            || t.match(/(?:降至|降到)\s*(\d+)\s*%/);
          if (!m) continue;
          thr = parseInt(m[1], 10);
          if (isNaN(thr)) continue;
          m = t.match(/restores?\s+own\s+HP\s+by\s+(\d+)\s*%/i)
            || t.match(/HP(?:を|が|為|为)?\s*(\d+)\s*%\s*回復/)
            || t.match(/HP\s*恢復\s*(\d+)\s*%/)
            || t.match(/HP\s*回复\s*(\d+)\s*%/)
            || t.match(/恢復(?:自身)?HP\s*(\d+)\s*%/)
            || t.match(/回复(?:自身)?HP\s*(\d+)\s*%/)
            || t.match(/(?:恢復|回复)\s*(\d+)\s*%/);
          if (!m) continue;
          heal = parseInt(m[1], 10) || 0;
          if (heal <= 0) continue;
          once = /once\s+only|1\s*time\s*\(\s*s\s*\)|1回のみ|一回のみ|僅一次|仅一次|\(1回\)|（1回）|\(1次\)|（1次）/i.test(t);
          unitIds = abilityDetailUnitIds(ab, di);
          unitName = '';
          m = t.match(/When\s+piloting\s+(.+?)\s+and\s+HP\s+falls/i)
            || t.match(/HP\s+falls\s+to\s+\d+\s*%(?:\s*or\s+below)?\s+when\s+piloting\s+(.+?)(?:,|\s+restores)/i)
            || t.match(/搭乗ユニットが[「『](.+?)[」』]/)
            || t.match(/搭乘單位為[「『](.+?)[」』]/)
            || t.match(/(.+?)(?:に搭乗|駕駛|驾驶).{0,12}HP/);
          if (m) unitName = String(m[1] || '').trim().replace(/[.,，、]+$/, '');
          key = bag.src + ':' + String((ab && ab.id) || (ab && ab.name) || '') +
            ':' + thr + ':' + heal + ':' + di;
          out.push({
            key: key,
            threshold: thr,
            healPct: heal,
            once: once,
            unitName: unitName,
            unitIds: unitIds
          });
        }
      }
    });
    return out;
  }

  function unitNameMatchesFilter(actor, filter) {
    var want, have, a, b;
    if (!filter) return true;
    want = String(filter).toLowerCase().replace(/\s+/g, ' ').trim();
    have = String((actor && actor.unit && actor.unit.name) || (actor && actor.name) || '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
    if (!want || !have) return !want;
    if (have === want) return true;
    a = want.replace(/[()（）]/g, '');
    b = have.replace(/[()（）]/g, '');
    return b.indexOf(a) >= 0 || a.indexOf(b) >= 0;
  }

  /** Apply revive row: Master unit-id chips win; else localized "piloting …" name. */
  function hpFallRestoreApplies(actor, row) {
    var uid, ids, i;
    if (!row) return false;
    ids = row.unitIds || [];
    if (ids.length) {
      uid = String((actor && actor.unit && actor.unit.id) || (actor && actor.id) || '');
      for (i = 0; i < ids.length; i++) {
        if (String(ids[i]) === uid) return true;
      }
      return false;
    }
    return unitNameMatchesFilter(actor, row.unitName);
  }

  function applyTurnStartRestore(actor, turn, snapshotLine) {
    var rest, healHp, healEn;
    rest = parseTurnStartRestore(actor);
    if (!rest || (actor.hp | 0) <= 0) return;
    healHp = rest.hpPct > 0 ? Math.floor((actor.maxHp | 0) * rest.hpPct / 100) : 0;
    healEn = rest.enPct > 0 ? Math.floor((actor.maxEn | 0) * rest.enPct / 100) : 0;
    if (healHp <= 0 && healEn <= 0) return;
    if (healHp > 0) {
      actor.ghostHp = actor.hp | 0;
      actor.hp = Math.min(actor.maxHp | 0, (actor.hp | 0) + healHp);
    }
    if (healEn > 0) {
      actor.currentEn = Math.min(actor.maxEn | 0, (actor.currentEn | 0) + healEn);
    }
    if (typeof snapshotLine === 'function') {
      snapshotLine(
        'T' + turn + ' Turn restore: ' + actor.name +
        (healHp > 0 ? (' +' + healHp + ' HP') : '') +
        (healEn > 0 ? (' +' + healEn + ' EN') : '') +
        ' (HP ' + (actor.hp | 0) + '/' + (actor.maxHp | 0) +
        ', EN ' + (actor.currentEn | 0) + '/' + (actor.maxEn | 0) + ')',
        healHp > 0
          ? { x: actor.x, y: actor.y, text: '+' + fmtNum(healHp), cls: 'mls-float--heal' }
          : null,
        null,
        'skill'
      );
    }
  }

  /**
   * After damage: once-only revive / threshold HP restore (Char Aznable / Shinn EX, …).
   * - threshold 0: lethal revive (Zeong 0%→5%, Setsuna, …)
   * - threshold >0: mid-fight heal only while still alive (Impulse 50%→50%).
     A hit that skips the band and goes straight to 0% does NOT trigger — not a revive.
   * Returns true only when a lethal (0% threshold) restore brought HP back above 0.
   */
  function applyHpFallRestores(actor, hpBefore, turn, snapshotLine) {
    var list, pctBefore, pctAfter, maxHp, revived, i, r, crossed, amt, isRevive;
    if (!actor) return false;
    list = parseHpFallRestores(actor);
    if (!list.length) return false;
    maxHp = Math.max(1, actor.maxHp | 0);
    pctBefore = Math.max(0, Math.min(100, Math.round(100 * (hpBefore | 0) / maxHp)));
    pctAfter = actorHpPct(actor);
    if (!actor._hpFallRestoreUsed) actor._hpFallRestoreUsed = {};
    revived = false;
    for (i = 0; i < list.length; i++) {
      r = list[i];
      if (r.once && actor._hpFallRestoreUsed[r.key]) continue;
      if (!hpFallRestoreApplies(actor, r)) continue;
      isRevive = (r.threshold | 0) <= 0;
      /*
       * Cross into ≤threshold from above.
       * Non-zero thresholds require surviving the hit (pctAfter > 0) — Shinn Impulse
       * 50% restore must not fire on a KO the way Char/Zeong 0% revive does.
       */
      crossed = pctBefore > r.threshold && pctAfter <= r.threshold;
      if (!crossed) continue;
      if (!isRevive && pctAfter <= 0) continue;
      amt = Math.floor(maxHp * r.healPct / 100);
      if (amt <= 0) continue;
      actor.ghostHp = actor.hp | 0;
      actor.hp = Math.min(maxHp, Math.max(0, actor.hp | 0) + amt);
      if (r.once) actor._hpFallRestoreUsed[r.key] = true;
      if (isRevive && (actor.hp | 0) > 0) revived = true;
      if (typeof snapshotLine === 'function') {
        snapshotLine(
          'T' + turn + ' HP restore' + (r.once ? ' (once)' : '') + ': ' + actor.name +
          ' +' + amt + ' HP' +
          (isRevive ? ' [revive]' : '') +
          ' (HP ' + (actor.hp | 0) + '/' + maxHp + ')',
          { x: actor.x, y: actor.y, text: '+' + fmtNum(amt), cls: 'mls-float--heal' },
          null,
          'skill'
        );
      }
    }
    return revived;
  }

  /**
   * Damage via /cal calculateDamage — gge-aligned flags:
   * Support Defense / AI Defend·Shield → defending (×0.8 / ×0.6).
   * Force Guard = pilot skill DTD % (1 turn), not Defend.
   * All Cond:* passives follow live battle state (HP/EN/Vigor/Combat/Damage taken/Turn).
   */
  /** TB side index used by renderMlsStats / squad scanners (ally=1, enemy=2). */
  function mlsTbSideIndex(side) {
    return side === 'enemy' ? 2 : 1;
  }

  /** UR kits have no SP/SSP conversion. SSR and below do when MasterData says so. */
  function rarityAllowsSpSsp(rarity) {
    var r = String(rarity || '').toUpperCase();
    if (!r || r === 'UR') return false;
    return true;
  }

  function unitAllowsSpSsp(ud) {
    if (!ud || !rarityAllowsSpSsp(ud.rarity)) return false;
    if (ud.has_sp) return true;
    return preferredUnitStatMode(ud) === 'ssp';
  }

  function charAllowsSp(cd) {
    if (!cd || !rarityAllowsSpSsp(cd.rarity)) return false;
    if (cd.has_sp) return true;
    return preferredCharStatMode(cd) === 'sp';
  }

  function resolveUnitStatMode(ud, explicit) {
    if (!unitAllowsSpSsp(ud)) return 'normal';
    if (explicit === 'normal' || explicit === 'sp' || explicit === 'ssp') return explicit;
    return preferredUnitStatMode(ud);
  }

  function resolveCharStatMode(cd, explicit) {
    if (!charAllowsSp(cd)) return 'normal';
    if (explicit === 'normal' || explicit === 'sp') return explicit;
    return preferredCharStatMode(cd);
  }

  /** ML assumes maxed kits: SSP when the unit has an SSP path, else normal. */
  function preferredUnitStatMode(ud) {
    var ab, wp, i;
    if (!ud || ud._manual) return 'normal';
    if (ud.has_ssp || ud.ssp_materials || (Array.isArray(ud.terrain_ssp) && ud.terrain_ssp.length)) return 'ssp';
    ab = ud.abilities || [];
    for (i = 0; i < ab.length; i++) {
      if (ab[i] && (ab[i].ssp_only || ab[i].ssp_replacement)) return 'ssp';
    }
    wp = ud.weapons || [];
    for (i = 0; i < wp.length; i++) {
      if (wp[i] && (wp[i].is_ssp_weapon || wp[i].ssp_icon)) return 'ssp';
    }
    return 'normal';
  }

  /** SP character sheet when the pilot has SP replacements. */
  function preferredCharStatMode(cd) {
    var ab, i;
    if (!cd || cd._manual) return 'normal';
    if (cd.has_sp) return 'sp';
    ab = cd.abilities || [];
    for (i = 0; i < ab.length; i++) {
      if (ab[i] && ab[i].sp_replacement) return 'sp';
    }
    return 'normal';
  }

  function actorToTbSlotShape(actor) {
    return {
      unitId: actor && actor.unit ? String(actor.unit.id) : null,
      unitData: actor && actor.unit ? actor.unit : null,
      charId: actor && actor.char ? String(actor.char.id) : null,
      charData: actor && actor.char ? actor.char : null,
      optionParts: (actor && actor.optionParts) || [],
      lbTier: actor ? (actor.lb | 0) : 3,
      unitStatMode: (actor && actor.unitStatMode) || preferredUnitStatMode(actor && actor.unit),
      charStatMode: (actor && actor.charStatMode) || preferredCharStatMode(actor && actor.char),
      unitCondPassive: actor ? liveUnitCondPassive(actor) : false,
      charCondPassive: actor ? liveCharCondPassive(actor) : false,
      unitCondStackCount: actor ? liveCombatStackCount(actor) : 0,
      unitHpAtkTierIndex: actor ? liveHpAtkTierIndex(actor) : 0,
      unitDamageTakenDefStacks: actor ? liveDamageTakenDefStacks(actor) : 0,
      unitTurnBuffAtk: false,
      unitTurnBuffDef: false,
      /* Qubeley EX stack is computed live from Neo Zeon count — seed max so TB helper can clamp. */
      exSquadAtkPct: 20
    };
  }

  /**
   * Mirror MLS side actors into S.tb.squads[si] long enough to reuse TB squad-tag scanners.
   * Restores previous slots afterwards (does not touch other TB sides).
   */
  function withMlsTbSideActors(side, sideActors, fn) {
    var S = global.S;
    var si = mlsTbSideIndex(side);
    var prevSlots;
    var i;
    var list = (sideActors || []).filter(function (a) { return a && a.unit; });
    if (typeof global.initTeamBuilder !== 'function') return fn(null, si);
    try { global.initTeamBuilder(); } catch (e) { return fn(null, si); }
    if (!S || !S.tb || !S.tb.squads || !S.tb.squads[si]) return fn(null, si);
    prevSlots = S.tb.squads[si].slots;
    try {
      S.tb.squads[si].slots = [0, 1, 2, 3, 4].map(function () {
        return typeof global._tbEmptySlot === 'function' ? global._tbEmptySlot() : {
          unitId: null, unitData: null, charId: null, charData: null, optionParts: [],
          lbTier: 3, unitStatMode: 'normal', unitCondPassive: false, charCondPassive: false,
          unitCondStackCount: 0, unitHpAtkTierIndex: 0, unitDamageTakenDefStacks: 0,
          unitTurnBuffAtk: false, unitTurnBuffDef: false, exSquadAtkPct: 0
        };
      });
      for (i = 0; i < list.length && i < 5; i++) {
        S.tb.squads[si].slots[i] = actorToTbSlotShape(list[i]);
      }
      return fn(S.tb.squads[si], si);
    } finally {
      S.tb.squads[si].slots = prevSlots;
    }
  }

  /** Same-squad ATK/DEF % + EX squad ATK % for one actor (TB scanners, live Cond flags). */
  function computeSquadBuffsForActor(actor, sideActors) {
    var z = { atk: 0, def: 0, ex: 0 };
    if (!actor || !actor.unit) return z;
    return withMlsTbSideActors(actor.side, sideActors, function (squ, si) {
      var slot;
      var idx;
      var sqP;
      if (!squ) return z;
      idx = Math.min(4, Math.max(0, actor.slotIdx | 0));
      slot = squ.slots[idx];
      if (!slot || !slot.unitData) {
        /* slotIdx missing — match by unit id. */
        for (idx = 0; idx < 5; idx++) {
          if (squ.slots[idx] && squ.slots[idx].unitData &&
              String(squ.slots[idx].unitData.id) === String(actor.unit.id)) {
            slot = squ.slots[idx];
            break;
          }
        }
      }
      if (!slot || !slot.unitData) return z;
      if (typeof global._tbComputeSquadConditionSheetPcts === 'function') {
        sqP = global._tbComputeSquadConditionSheetPcts(slot, si) || z;
        z.atk = sqP.atk | 0;
        z.def = sqP.def | 0;
      }
      if (typeof global._tbEffectiveExSquadAtkPctForTb === 'function') {
        z.ex = global._tbEffectiveExSquadAtkPctForTb(slot, si) | 0;
      }
      return z;
    });
  }

  /** Stamp formation squad buffs onto every actor (stable for the fight; dead still count). */
  function stampSquadBuffs(sideActors) {
    var list = sideActors || [];
    var i;
    var a;
    var b;
    for (i = 0; i < list.length; i++) {
      a = list[i];
      if (!a) continue;
      b = computeSquadBuffsForActor(a, list);
      a.squadCondAtkPct = b.atk | 0;
      a.squadCondDefPct = b.def | 0;
      a.exSquadAtkPct = b.ex | 0;
    }
  }

  function sideActorsOf(actor, rosterBuf) {
    var side = actor && actor.side;
    if (Array.isArray(rosterBuf) && rosterBuf.length) {
      return rosterBuf.filter(function (u) { return u && u.side === side; });
    }
    if (side === 'enemy') return lastEnemy;
    return lastAlly;
  }

  function ensureActorSquadBuffs(actor, rosterBuf) {
    var sideList;
    if (!actor) return { atk: 0, def: 0, ex: 0 };
    if (actor.squadCondAtkPct != null || actor.squadCondDefPct != null || actor.exSquadAtkPct != null) {
      return {
        atk: actor.squadCondAtkPct | 0,
        def: actor.squadCondDefPct | 0,
        ex: actor.exSquadAtkPct | 0
      };
    }
    sideList = sideActorsOf(actor, rosterBuf);
    stampSquadBuffs(sideList);
    return {
      atk: actor.squadCondAtkPct | 0,
      def: actor.squadCondDefPct | 0,
      ex: actor.exSquadAtkPct | 0
    };
  }

  function strikeDamage(attacker, defender, weapon, opts) {
    var dc, keys, snap, r, weapons, idx, lv, sup, defSup, dmg, abilDr, skillDr, R, auraPct, nullify;
    var turnBuffOn, atkSq, defSq, pilotBon, wCrit;
    opts = opts || {};
    R = rules();
    if (typeof global.calculateDamage !== 'function' || !global.S || !global.S.dc || !attacker.unit || !defender.unit) {
      return weapon.power | 0;
    }
    dc = global.S.dc;
    keys = [
      'atkUnitData', 'atkCharData', 'defUnitData', 'defCharData', 'defNpc', 'defTargetMode',
      'lbTier', 'defLbTier', 'wpnIdx', 'wpnLv', 'masterLeagueBuff', 'mpLevel', 'defending', 'shield',
      'optionParts', 'defOptionParts', 'supporters', 'defSupporters', 'terrain', 'finalWpnPow', 'unitStatMode',
      'defUnitSkillActive', 'defCharCondPassive', 'defUnitCondPassive', 'unitCondPassive', 'charCondPassive',
      'unitHpAtkTierIndex', 'unitCondStackCount', 'unitDamageTakenDefStacks', 'dcSuperchargedExTier',
      '_dcSuperchargedExManual', 'unitTurnBuffAtk', 'unitTurnBuffDef',
      'dmgTakenDownUnit', 'dmgTakenDownPilot', 'supportCounterAtk', '_supportCounterAtkPct', 'dmgIncrease',
      'critDmgUp', 'squadCondAtkPct', 'squadCondDefPct', 'exSquadAtkPct', 'exSquadAtkPctExplicitZero',
      'defSquadCondAtkPct', 'defSquadCondDefPct',
      'applyAdvantageEnemyTag', 'applyZeonEnemyTag', 'charStatMode', 'atkCounterOwnAtk', 'grandOffensiveBuff',
      'ultAltActive', 'defUltAltActive', 'supportDefenseActive', 'defInitialNullStock',
      'dtuBeam', 'dtuPhysical', 'dtuSpecial', 'defDebuffPct', '_mlsFightCalc'
    ];
    snap = {};
    keys.forEach(function (k) { snap[k] = dc[k]; });
    try {
      dc.atkUnitData = attacker.unit;
      dc.atkCharData = attacker.char;
      dc.defUnitData = defender.unit;
      dc.defCharData = defender.char;
      dc.defNpc = null;
      dc.defTargetMode = 'database';
      dc.lbTier = attacker.lb | 0;
      dc.defLbTier = defender.lb | 0;
      dc.masterLeagueBuff = true;
      dc.grandOffensiveBuff = false;
      /* Maxed ULT Alteration (alt LV cap / 100% growth flats + ult weapons). */
      dc.ultAltActive = unitHasUltAlt(attacker.unit);
      dc.defUltAltActive = unitHasUltAlt(defender.unit);
      /* Live Vigor from attacker MP — same bands as /cal DC_MP + gge getTensionString. */
      dc.mpLevel = vigorLevelFromMp(attacker.mp);
      /* gge: SD / AI Defend·Shield set defending — not Force Guard (DTD skill). */
      dc.defending = !!opts.defending;
      dc.shield = !!opts.shield;
      /* gge SA/SC: Support-role MS ATK % (role_id 3) via /cal. */
      dc.supportCounterAtk = !!opts.isSupport;
      dc._supportCounterAtkPct = 0;
      /* Durability-type pilot DEF % while covering (Support Defense) — only when SD. */
      dc.supportDefenseActive = !!opts.supportDefenseActive;
      /* “Increase own ATK when countering” — Counter + Support Counter waves. */
      dc.atkCounterOwnAtk = !!opts.isCounter;
      dc.optionParts = attacker.optionParts || [];
      dc.defOptionParts = defender.optionParts || [];
      /* Live Cond:* → /cal CP sheet + stack sliders (PEP pair ATK/DEF needs charCondPassive). */
      /*
       * Defender unit skill (type-11 DTD / initial null / turn ATK·DEF) while live.
       * Type-6 barrier uses the MLS depleting shieldBarrier pool in applyHit — do NOT
       * flip /cal defUnitSkillActive on pool alone (that re-applies full MaxHP% every hit).
       */
      dc.defUnitSkillActive = !!(defender.turnBuffActive ||
        (defender.unitSkillBeamDr | 0) > 0 ||
        defender.hasFirstStrikeBarrier);
      /* Type-8 Initial Null is one shot — only while stock remains (S.Attack consumes it too). */
      dc.defInitialNullStock = !!defender.hasFirstStrikeBarrier;
      /* Cond:Combat “When attacking … Excluding Counter / SA / Counter Support” — never while defending. */
      dc.unitCondPassive = liveUnitCondPassive(attacker, {
        excludeWhenAttackingCombat: !!(opts.isCounter || opts.isSupport)
      });
      dc.charCondPassive = liveCharCondPassive(attacker);
      dc.defUnitCondPassive = liveUnitCondPassive(defender, { asDefender: true });
      dc.defCharCondPassive = liveCharCondPassive(defender);
      dc.charStatMode = attacker.charStatMode || preferredCharStatMode(attacker.char);
      dc.unitHpAtkTierIndex = liveHpAtkTierIndex(attacker);
      dc.unitCondStackCount = liveCombatStackCount(attacker);
      /* Attacker stack slider is for own combat ATK; defender DEF patched after sync. */
      dc.unitDamageTakenDefStacks = liveDamageTakenDefStacks(attacker);
      dc.dcSuperchargedExTier = liveSuperchargedExTier(attacker);
      dc._dcSuperchargedExManual = true;
      /* Unit skill (1 turn) ATK/DEF/MOB — active while skillDmgPct buffs linger. */
      turnBuffOn = !!(attacker.turnBuffActive || ((attacker.skillDmgPct | 0) > 0 && attacker.usedSkillThisTurn));
      dc.unitTurnBuffAtk = turnBuffOn;
      dc.unitTurnBuffDef = !!defender.turnBuffActive;
      /* Leave 0 so /cal auto-parses defender pilot DTD + OP incoming DTD. */
      dc.dmgTakenDownUnit = 0;
      dc.dmgTakenDownPilot = 0;
      /*
       * Live Inflict statuses on the defender → /cal DTU sliders + DEF-debuff field.
       * Pharact EX “Damage Taken from Beam Weapons Up 35%” lands here for later Beam hits.
       */
      (function applyLiveInflictToDc() {
        var dtu = liveStatusDtu(defender);
        var statusDef = liveStatusDefDebuffPct(defender) | 0;
        dc.dtuBeam = dtu.beam | 0;
        dc.dtuPhysical = dtu.physical | 0;
        dc.dtuSpecial = dtu.special | 0;
        dc.defDebuffPct = statusDef;
        /* DEF debuff is read from S.dc while this is set — do not write /cal inputs. */
        dc._mlsFightCalc = true;
      })();
      /* Formation squad buffs (Qubeley Neo Zeon stack, Sandaime Cond1/2, Nightingale Red aura, …). */
      atkSq = ensureActorSquadBuffs(attacker, opts.auraSources);
      defSq = ensureActorSquadBuffs(defender, opts.auraSources);
      dc.squadCondAtkPct = atkSq.atk | 0;
      dc.squadCondDefPct = atkSq.def | 0;
      dc.exSquadAtkPct = atkSq.ex | 0;
      dc.exSquadAtkPctExplicitZero = false;
      dc.defSquadCondAtkPct = defSq.atk | 0;
      dc.defSquadCondDefPct = defSq.def | 0;
      /* Advantage / enemy-tag weapon lines — always on when the kit has them; /cal gates on defender tags. */
      dc.applyAdvantageEnemyTag = true;
      dc.applyZeonEnemyTag = true;
      abilDr = 0;
      /* Per-unit for_unit_id supporter only — unscoped sideSupportData would apply leader % to everyone. */
      sup = actorSupporterPayload(attacker);
      if (sup) {
        if (sup._dcLbTier == null) {
          var ent = forceOf(attacker.side).supporter;
          sup._dcLbTier = ent && ent.lb != null ? (ent.lb | 0) : 3;
          if (sup._dcLevel == null) sup._dcLevel = 100;
        }
        dc.supporters = [sup];
      } else {
        dc.supporters = [];
      }
      defSup = actorSupporterPayload(defender);
      if (defSup) {
        if (defSup._dcLbTier == null) {
          var dent = forceOf(defender.side).supporter;
          defSup._dcLbTier = dent && dent.lb != null ? (dent.lb | 0) : 3;
          if (defSup._dcLevel == null) defSup._dcLevel = 100;
        }
        dc.defSupporters = [defSup];
      } else {
        dc.defSupporters = [];
      }
      dc.terrain = terrainIndex();
      dc.finalWpnPow = 0;
      /* SSP → Custom Core / ssp_only weapons + sheets (ML maxed-kit default). */
      dc.unitStatMode = attacker.unitStatMode || preferredUnitStatMode(attacker.unit);
      if (weapon && (weapon.is_map || weapon.is_map_weapon) && attacker.unit && attacker.unit.weapons) {
        weapons = attacker.unit.weapons;
      } else {
        weapons = (typeof global._dcNonMapWeapons === 'function')
          ? global._dcNonMapWeapons(attacker.unit)
          : weaponsOf(attacker.unit, attacker.unitStatMode).filter(function (w) { return !w.is_map; }).map(function (w) { return w.raw; });
      }
      idx = weapons.indexOf(weapon.raw);
      if (idx < 0 && weapon && weapon.raw && weapon.raw.id) {
        for (var wi = 0; wi < weapons.length; wi++) {
          if (weapons[wi] && String(weapons[wi].id) === String(weapon.raw.id)) { idx = wi; break; }
        }
      }
      if (idx < 0) {
        /* Never silently fall back to weapon[0] — that made EX counters look like Claw damage. */
        return weapon.power | 0;
      }
      dc.wpnIdx = idx;
      lv = weapon.raw && weapon.raw.levels ? weapon.raw.levels.length - 1 : 0;
      dc.wpnLv = Math.max(0, lv);
      /* Pilot Damage Dealt / Crit Dmg (PEP + always-on abil) + weapon crit trait — same as /cal slot derive. */
      wCrit = 0;
      if (typeof global._dcParseWeaponTraits === 'function' && weapon && weapon.raw) {
        try { wCrit = (global._dcParseWeaponTraits(weapon.raw, dc.wpnLv).critDmgUp | 0); } catch (eW) { wCrit = 0; }
      }
      if (typeof global._dcDerivePilotDmgCritForSlotContext === 'function' && attacker.char) {
        pilotBon = global._dcDerivePilotDmgCritForSlotContext({
          atkCharData: attacker.char,
          atkUnitData: attacker.unit,
          charStatMode: attacker.charStatMode || preferredCharStatMode(attacker.char),
          _activeSkills: {}
        }, wCrit) || { dmgIncrease: 0, critDmgUp: wCrit };
        dc.dmgIncrease = (skillAndDebuffDmgPct(attacker, weapon) | 0) + (pilotBon.dmgIncrease | 0);
        dc.critDmgUp = pilotBon.critDmgUp | 0;
      } else {
        dc.dmgIncrease = skillAndDebuffDmgPct(attacker, weapon);
        dc.critDmgUp = wCrit | 0;
      }
      if (typeof global._dcSyncDefNpcFromDatabase === 'function') global._dcSyncDefNpcFromDatabase();
      applyLiveDamageTakenDefToDefNpc(defender, dc);
      if (!attacker.char) {
        /* Pilot missing → /cal returns null; keep raw power for ranking honesty. */
        attacker._lastDmgFallback = 'no-pilot';
        return weapon.power | 0;
      }
      if (!dc.defNpc) {
        /* Sync failed — never pretend sheet damage; raw PWR only + mark for the battle log. */
        attacker._lastDmgFallback = 'no-defnpc';
        return weapon.power | 0;
      }
      r = global.calculateDamage();
      dmg = opts.useCrit
        ? (r && r.critDmg != null ? (r.critDmg | 0) : 0)
        : (r && r.normalDmg != null ? (r.normalDmg | 0) : 0);
      if (!(dmg > 0) && !(r && r.unitSkillInitialNull)) {
        attacker._lastDmgFallback = 'cal-null';
        dmg = weapon.power | 0;
      } else {
        attacker._lastDmgFallback = '';
      }
      /* Cond:Area weapon-power aura (Neo Zeong −20% + Full Frontal −15% → −35%). */
      if (R && R.areaWeaponPowerAuraPct && opts.auraSources) {
        auraPct = R.areaWeaponPowerAuraPct(attacker, opts.auraSources, weapon) | 0;
        if (auraPct) dmg = Math.max(0, Math.ceil(dmg * (100 + auraPct) / 100));
      }
      /* Ability DTD (Phase Shift Armor, Beam DR, …) when not already in unit.skills type-11 via /cal. */
      skillDr = r && r.unitSkillDtdPct != null ? (r.unitSkillDtdPct | 0) : 0;
      abilDr = abilityDamageTakenDownPct(defender.unit, weapon);
      if ((defender.unitSkillBeamDr | 0) > abilDr && weaponAttrKeys(weapon).indexOf('beam') >= 0) {
        abilDr = defender.unitSkillBeamDr | 0;
      }
      nullify = /Nullify\s+Weapon\s+Attribute|武装属性.*無効|武裝屬性.*無效/i.test(
        (weapon.traits || []).join(' ') + ' ' + ((weapon.raw && weapon.raw.traits) || []).join(' ')
      );
      if (abilDr > 0 && skillDr <= 0 && !nullify) {
        dmg = Math.max(0, Math.ceil(dmg * (100 - Math.min(80, abilDr)) / 100));
      }
      /* Force Guard: “Reduce damage taken by N% (1 turn)” — stacks; never Defend ×0.8. */
      if ((defender.forceGuardDtdPct | 0) > 0 && !nullify) {
        dmg = Math.max(0, Math.ceil(dmg * (100 - Math.min(80, defender.forceGuardDtdPct | 0)) / 100));
      }
      /* Supercharged EX phase DR (gge evaluateExPhase). */
      if ((defender.exDamageTakenDown | 0) > 0) {
        dmg = Math.max(0, Math.ceil(dmg * (100 - Math.min(80, defender.exDamageTakenDown | 0)) / 100));
      }
      /* Stash /cal barrier/null so applyHit does not double-absorb. */
      defender._calSkillInitialNull = !!(r && r.unitSkillInitialNull);
      defender._calSkillBarrierAbsorb = (r && r.unitSkillBarrierAbsorb) | 0;
      return dmg;
    } catch (e) {
      return weapon.power | 0;
    } finally {
      keys.forEach(function (k) { dc[k] = snap[k]; });
    }
  }

  function chanceStepLimit(actor) {
    var R = rules();
    if (R && R.chanceStepLimit) return R.chanceStepLimit(actor) | 0;
    if (typeof global.getCharacterChanceSupportState === 'function' && actor && actor.char) {
      try {
        return (global.getCharacterChanceSupportState(actor.char).chanceCount | 0) || 1;
      } catch (e) {}
    }
    return 1;
  }

  function chanceStepIconUrl() {
    return thumbUrl('/static/images/UI/UI_Common_Icon_ChanceStep.webp');
  }
  /** Official Guaranteed Chance Step trait art (dossier ability icon). */
  function guaranteedChanceStepIconUrl() {
    return thumbUrl('/static/images/Trait/trait_10070700.webp');
  }
  function assistAtkIconUrl() {
    return thumbUrl('/static/images/UI/UI_Common_BattleIcon_AssistAtack_S.webp');
  }
  function assistDefIconUrl() {
    return thumbUrl('/static/images/UI/UI_Common_BattleIcon_AssistDeffence_S.webp');
  }
  function skillBadgeIconUrl() {
    return thumbUrl('/static/images/UI/UI_Battle_Button_Skill_Base.webp');
  }
  function preemptIconUrl() {
    return thumbUrl('/static/images/UI/UI_Common_Icon_PreemptiveAttack.webp');
  }
  function mapBadgeIconUrl() {
    /* Real MAP weapon glyph — Transform chevrons were unreadable as "MAP". */
    return thumbUrl('/static/images/UI/UI_Common_WeaponIcon_map.webp');
  }

  /** Short HUD label — official LANG Support Attack / Support Defense (m_help). */
  function badgeLabel(badge) {
    var b = String(badge || '');
    if (b === 'S.DEF') return mlsT('mls_badge_sdef', 'S. Defense');
    if (b === 'S.ATK') return mlsT('mls_badge_satk', 'S. Attack');
    if (b === 'CS') {
      try {
        var R = rules();
        var labs = R && R.chanceStepLabels && R.chanceStepLabels(lang());
        if (labs && labs.cs) return labs.cs;
      } catch (eCs) { /* ignore */ }
      return mlsT('mls_chance_step', 'Chance Step');
    }
    if (b === 'SKILL') return 'SKILL';
    if (b === 'MAP') return 'MAP';
    if (b === 'PRE' || b === 'PREEMPT') return 'PRE';
    return b;
  }

  function supportAttackLabel() {
    return mlsT('mls_support_attack', 'Support Attack');
  }
  function supportDefenseLabel() {
    return mlsT('mls_support_defense', 'Support Defense');
  }
  function supportCounterLabel() {
    return mlsT('mls_support_counter', 'Support Counter');
  }
  function supportAtkCounterLabel() {
    return mlsT('mls_support_atk_counter', 'Support Attack / Counter');
  }

  /** Badge / float → game asset + short label. */
  function badgeIconUrl(badge) {
    var b = String(badge || '');
    if (b === 'S.DEF') return assistDefIconUrl();
    if (b === 'S.ATK') return assistAtkIconUrl();
    if (b === 'CS') return chanceStepIconUrl();
    if (b === 'SKILL') return skillBadgeIconUrl();
    if (b === 'MAP') return mapBadgeIconUrl();
    if (b === 'PRE' || b === 'PREEMPT') return preemptIconUrl();
    return '';
  }

  function badgeChipHtml(badge, labelOverride, iconOverride) {
    var icon = iconOverride ? thumbUrl(iconOverride) : badgeIconUrl(badge);
    var lab = labelOverride != null && labelOverride !== '' ? String(labelOverride) : badgeLabel(badge);
    if (!badge && !lab) return '';
    if (icon) {
      return '<span class="mls-token-badge is-chip' +
        (badge === 'S.DEF' ? ' is-sdef' : '') +
        (badge === 'S.ATK' ? ' is-satk' : '') +
        (badge === 'CS' ? ' is-cs' : '') +
        (badge === 'MAP' ? ' is-map' : '') +
        (badge === 'SKILL' ? ' is-skill' : '') +
        '" title="' + esc(lab) + '">' +
        '<img src="' + esc(icon) + '" alt="">' +
        '<span class="mls-token-badge-lab">' + esc(lab) + '</span></span>';
    }
    return '<span class="mls-token-badge">' + esc(lab) + '</span>';
  }

  /**
   * Same float style as supporter skill / unit skill: icon + name on the unit that used it.
   * Weapon icons match /u: tinted silhouette via mask + icon_color (green/yellow/orange/purple).
   */
  function weaponAnnounceFloat(actor, wpn) {
    var name = String((wpn && wpn.name) || 'Weapon');
    var raw = (wpn && wpn.raw) || wpn || {};
    var usePortrait = !!(wpn && (wpn.is_ssp_weapon || wpn.is_ult_weapon));
    var icon = '';
    var iconColor = '';
    if (usePortrait) {
      /* SSP / ULT kit art is already colored — same as /u ssp-weapon-portrait. */
      icon = (raw.ssp_icon || wpn.icon || raw.icon || '') || '';
    } else {
      icon = (wpn.icon || raw.icon || raw.ssp_icon || '') || '';
      iconColor = String(wpn.icon_color || raw.icon_color || raw.ssp_icon_color || '').toLowerCase();
      /* /u: EX + MAP (+ missing color) keep full-color <img>, not mask tint. */
      if (iconColor === 'ex' || iconColor === 'map' || wpn.is_ex || wpn.is_map || wpn.is_map_weapon) {
        iconColor = '';
      }
    }
    return {
      x: actor.x | 0,
      y: actor.y | 0,
      text: name.slice(0, 22),
      skillName: name.slice(0, 22),
      badge: 'SKILL',
      icon: icon,
      iconColor: iconColor,
      cls: 'mls-float--skill'
    };
  }

  /** Chip icon HTML — tinted mask when icon_color is a /u weapon hue. */
  function floatChipIconHtml(ev) {
    var url = floatIconUrl(ev);
    var rc = String((ev && ev.iconColor) || '').toLowerCase();
    if (!url) return '';
    if (rc === 'green' || rc === 'yellow' || rc === 'orange' || rc === 'purple') {
      return '<div class="mls-float-icon weapon-icon-mask color-' + rc +
        '" style="-webkit-mask-image:url(\'' + esc(url) + '\');mask-image:url(\'' + esc(url) +
        '\');" role="img" aria-hidden="true"></div>';
    }
    return '<img class="mls-float-icon" src="' + esc(url) + '" alt="">';
  }

  /** Sticky unit-skill icon above the portrait for the rest of the fight. */
  function skillMarkHtml(u) {
    var icon, lab;
    if (!u || !u.skillMarkIcon) return '';
    icon = thumbUrl(u.skillMarkIcon) || skillBadgeIconUrl();
    lab = String(u.skillMarkText || 'SKILL').replace(/\s+LV\s*\d+/i, '');
    return '<span class="mls-token-skill-mark" title="' + esc(lab) + '" aria-label="' + esc(lab) + '">' +
      '<img src="' + esc(icon) + '" alt="" decoding="async"></span>';
  }

  /** Guaranteed CS trait icon while once/battle stock remains (not spent). */
  function guaranteedCsMarkHtml(u) {
    var icon, lab, R;
    if (!u || (u.unconditionalCSStock | 0) <= 0 || (u.hp | 0) <= 0) return '';
    icon = guaranteedChanceStepIconUrl();
    lab = 'Guaranteed Chance Step';
    try {
      R = rules();
      if (R && R.chanceStepLabels) lab = (R.chanceStepLabels(lang()).guaranteed) || lab;
    } catch (eLab) { /* ignore */ }
    return '<span class="mls-token-gcs-mark" title="' + esc(lab) + '" aria-label="' + esc(lab) + '">' +
      '<img src="' + esc(icon) + '" alt="" decoding="async"></span>';
  }

  /** Active Inflict / status debuff icons (Beam DTU, DEF down, …). */
  function statusDebuffMarksHtml(u) {
    var now, html, seen;
    if (!u || (u.hp | 0) <= 0) return '';
    now = u._simTurn | 0;
    html = '';
    seen = {};
    (u.debuffs || []).forEach(function (d) {
      var ic, lab;
      if (!debuffStillActive(d, now) || !d.icon || seen[d.type]) return;
      seen[d.type] = 1;
      ic = thumbUrl(d.icon);
      lab = String(d.label || d.type) + (d.value ? (' ' + (d.value | 0) + '%') : '');
      html += '<span class="mls-token-status-mark" title="' + esc(lab) + '" aria-label="' + esc(lab) + '">' +
        '<img src="' + esc(ic) + '" alt="" decoding="async"></span>';
    });
    return html;
  }

  /**
   * Crown icons above the portrait: unit skill + Guaranteed CS + active Inflict statuses.
   */
  function topMarksHtml(u) {
    var skill = skillMarkHtml(u);
    var gcs = guaranteedCsMarkHtml(u);
    var status = statusDebuffMarksHtml(u);
    if (!skill && !gcs && !status) return '';
    return '<div class="mls-token-top-marks">' + skill + gcs + status + '</div>';
  }

  function syncTopMarksEl(el, u) {
    var wrap = el && el.querySelector('.mls-token-top-marks');
    var html;
    if (!el) return;
    html = topMarksHtml(u);
    if (!html) {
      if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
      /* Drop legacy single skill-mark nodes from older paints. */
      Array.prototype.forEach.call(el.querySelectorAll('.mls-token-skill-mark, .mls-token-gcs-mark'), function (n) {
        if (n.parentNode && !n.parentNode.classList.contains('mls-token-top-marks')) {
          n.parentNode.removeChild(n);
        }
      });
      return;
    }
    if (wrap) wrap.outerHTML = html;
    else el.insertAdjacentHTML('afterbegin', html);
  }

  /** @deprecated use syncTopMarksEl */
  function syncSkillMarkEl(el, u) {
    syncTopMarksEl(el, u);
  }

  function floatIconUrl(ev) {
    var t, icon;
    if (!ev) return '';
    if (ev.icon) return thumbUrl(ev.icon);
    if (ev.csIcon) return chanceStepIconUrl();
    icon = badgeIconUrl(ev.badge);
    if (icon) return icon;
    t = String(ev.text || '');
    if (/支援防御|Support\s*Defen|S\.DEF|反撃支援/i.test(t)) return assistDefIconUrl();
    if (/支援攻撃|Support\s*At|Support\s*Counter|S\.ATK/i.test(t)) return assistAtkIconUrl();
    if (/Chance\s*Step|CHANCE\s*STEP|額外行動/i.test(t)) return chanceStepIconUrl();
    if (/Preemptive|先發|先制|先制攻擊/i.test(t)) return preemptIconUrl();
    if (/^MAP$/i.test(t)) return mapBadgeIconUrl();
    if (ev.badge === 'SKILL' || /SKILL|スキル|技能/i.test(t)) return skillBadgeIconUrl();
    return '';
  }

  /** Float / chip label: keep skill & MAP wording; compress SD/SA/CS only. */
  function floatLabelText(ev) {
    if (!ev) return '';
    if (ev.badge === 'SKILL' || ev.skillName) {
      return String(ev.skillName || ev.text || 'SKILL').replace(/\s+LV\s*\d+/i, '');
    }
    if (ev.badge === 'MAP') return 'MAP';
    if (ev.badge === 'S.DEF' || ev.badge === 'S.ATK' || ev.badge === 'CS' ||
        ev.badge === 'PRE' || ev.badge === 'PREEMPT') {
      return badgeLabel(ev.badge);
    }
    return String(ev.text || badgeLabel(ev.badge) || '');
  }

  function terrainIndex() {
    var t = String((seasonMeta && seasonMeta.terrain_primary) || '').toLowerCase();
    if (/space|宇宙|太空|우주/.test(t)) return 1;
    if (/atmos|空中|大氣|大气|공중/.test(t)) return 2;
    if (/ground|land|地上|地面|지상/.test(t)) return 3;
    if (/sea|水面|水上|수상|surface/.test(t)) return 4;
    if (/under|水中|수중/.test(t)) return 5;
    return 0;
  }

  /**
   * MasterData / LANG Terrain Capability (m_help):
   * ● circle = full move · ▲ triangle = half move · - dash = cannot place.
   * Season terrain_primary is often "Land" (not "Ground"). gge getTerrainSuitability
   * for 地上/Land takes the best of Ground/Land and Atmospheric.
   * Season 17 stage enables Ground + Atmospheric — Neo Zeong (EX) Atmospheric ▲ → Move 5→2.
   */
  function terrainRowLevel(unitData, aliases) {
    var rows = (unitData && unitData.terrain) || [];
    var best = 0;
    var i, row, name, lv, sym;
    var want = aliases || [];
    for (i = 0; i < rows.length; i++) {
      row = rows[i];
      if (!row) continue;
      name = String(row.name || '');
      if (want.indexOf(name) < 0) continue;
      lv = row.level != null ? (row.level | 0) : 0;
      if (!lv) {
        sym = String(row.symbol || row.mark || '');
        if (sym.indexOf('●') >= 0 || sym.indexOf('◯') >= 0 || /circle/i.test(sym)) lv = 3;
        else if (sym.indexOf('▲') >= 0 || sym.indexOf('△') >= 0 || /triangle/i.test(sym)) lv = 2;
        else if (sym === '-' || /dash|hyphen/i.test(sym)) lv = 1;
      }
      if (lv > best) best = lv;
    }
    return best;
  }

  function terrainAliasesForLabel(label) {
    var t = String(label || '').toLowerCase();
    if (/space|宇宙|太空|우주/.test(t)) return ['Space', '宇宙', '太空', '우주'];
    if (/atmos|sky|空中|大氣|大气|공중/.test(t)) return ['Atmospheric', '空中', '大氣', '大气', '공중'];
    if (/ground|land|地上|地面|지상/.test(t)) return ['Ground', 'Land', '地上', '地面', '지상'];
    if (/sea|surface|水面|水上|수상/.test(t)) return ['Sea', '水面', '水上', '수상'];
    if (/under|水中|수중/.test(t)) return ['Underwater', '水中', '수중'];
    return [String(label || '')];
  }

  function fieldIsSpace(field) {
    return /space|宇宙|太空|우주/i.test(String(field || ''));
  }

  function fieldIsLand(field) {
    return /ground|land|地上|地面|지상/i.test(String(field || ''));
  }

  /**
   * Best suitability level (1/2/3) for the season field.
   * Land/Ground (Season 17 etc.): gge max(地上, 空中) — Neo Zeong Atmospheric ▲ → half Move
   * even when Ground is dash, because the stage also allows Atmospheric.
   */
  function terrainSuitabilityLevel(unitData, field) {
    var f = field != null ? String(field) : String((seasonMeta && seasonMeta.terrain_primary) || '');
    if (fieldIsSpace(f)) return terrainRowLevel(unitData, terrainAliasesForLabel('Space'));
    if (/atmos|空中|大氣|大气|공중/i.test(f)) {
      return terrainRowLevel(unitData, terrainAliasesForLabel('Atmospheric'));
    }
    if (/sea|水面|水上|수상|surface/i.test(f)) {
      return terrainRowLevel(unitData, terrainAliasesForLabel('Sea'));
    }
    if (/under|水中|수중/i.test(f)) {
      return terrainRowLevel(unitData, terrainAliasesForLabel('Underwater'));
    }
    /* Land / Ground / empty / unknown non-space — always max(Ground, Atmospheric). */
    return Math.max(
      terrainRowLevel(unitData, terrainAliasesForLabel('Ground')),
      terrainRowLevel(unitData, terrainAliasesForLabel('Atmospheric'))
    );
  }

  function terrainMoveFactor(unitData, field) {
    var f = field != null ? String(field) : String((seasonMeta && seasonMeta.terrain_primary) || '');
    var best = terrainSuitabilityLevel(unitData, f);
    if (!((unitData && unitData.terrain) || []).length) return 1;
    if (best >= 3) return 1;
    if (best === 2) return 0.5;
    return 0;
  }

  /** LANG: triangle halves Move (floor). baseMove is pre-terrain. */
  function applyTerrainMove(baseMove, unitData, field) {
    var base = Math.max(0, baseMove | 0);
    var factor = terrainMoveFactor(unitData, field);
    if (factor <= 0) return 0;
    if (factor < 1) return Math.floor(base / 2);
    return base;
  }

  /**
   * LANG Support Defense: cannot SD into spaces the unit cannot enter (Terrain Capabilities).
   * On Land maps without per-cell terrain: land-capable allies occupy Land cells; units with
   * Ground/Land "-" that only have Atmospheric ▲/● occupy air — air-only units cannot SD land allies.
   */
  function unitOccupancyMode(unitData, field) {
    var f = field != null ? String(field) : String((seasonMeta && seasonMeta.terrain_primary) || '');
    var g, a;
    if (fieldIsSpace(f)) {
      return terrainRowLevel(unitData, terrainAliasesForLabel('Space')) >= 2 ? 'space' : 'none';
    }
    g = terrainRowLevel(unitData, terrainAliasesForLabel('Ground'));
    a = terrainRowLevel(unitData, terrainAliasesForLabel('Atmospheric'));
    if (g >= 2) return 'land';
    if (a >= 2) return 'air';
    return 'none';
  }

  function canEnterOccupancy(unitData, mode, field) {
    var f = field != null ? String(field) : String((seasonMeta && seasonMeta.terrain_primary) || '');
    if (mode === 'space' || fieldIsSpace(f)) {
      return terrainRowLevel(unitData, terrainAliasesForLabel('Space')) >= 2;
    }
    if (mode === 'land') return terrainRowLevel(unitData, terrainAliasesForLabel('Ground')) >= 2;
    if (mode === 'air') return terrainRowLevel(unitData, terrainAliasesForLabel('Atmospheric')) >= 2;
    return false;
  }

  function canSupportDefendOnTarget(guard, target) {
    var field, mode;
    if (!guard || !target) return false;
    field = String(guard.fieldTerrain || target.fieldTerrain ||
      (seasonMeta && seasonMeta.terrain_primary) || '');
    mode = unitOccupancyMode(target.unit, field);
    if (mode === 'none') return false;
    return canEnterOccupancy(guard.unit, mode, field);
  }

  function skillAndDebuffDmgPct(attacker, weapon) {
    var bonus = 0;
    var down = 0;
    var kind, ranged, i, d, now;
    if (!attacker) return 0;
    kind = attacker.skillDmgKind || '';
    ranged = weaponIsRanged(weapon);
    if (attacker.skillDmgPct) {
      if (kind === 'attack_burst' || kind === 'awaken_boost') bonus += attacker.skillDmgPct | 0;
      else if (kind === 'shooting_boost' && ranged) bonus += attacker.skillDmgPct | 0;
      else if (kind === 'melee_boost' && !ranged) bonus += attacker.skillDmgPct | 0;
    }
    now = attacker._simTurn | 0;
    for (i = 0; i < (attacker.debuffs || []).length; i++) {
      d = attacker.debuffs[i];
      if (!d || d.type !== 'weapon_power') continue;
      if (d.untilTurn != null && now > (d.untilTurn | 0)) continue;
      down += d.value | 0;
    }
    return bonus - down;
  }

  /*
   * Official m_weapon_trait.ResourceId icons (EN names: Increased Beam Damage Taken,
   * Decreased DEF / ATK / MOB / ACC, weapon Power Down, …).
   */
  var DEBUFF_ICON_BEAM = '/static/images/Trait/trait_10600200.webp';
  var DEBUFF_ICON_PHYS = '/static/images/Trait/trait_10640200.webp';
  var DEBUFF_ICON_SPEC = '/static/images/Trait/trait_10680200.webp';
  var DEBUFF_ICON_DEF = '/static/images/Trait/trait_10050200.webp';
  var DEBUFF_ICON_ATK = '/static/images/Trait/trait_10030200.webp';
  var DEBUFF_ICON_MOB = '/static/images/Trait/trait_10060200.webp';
  var DEBUFF_ICON_ACC = '/static/images/Trait/trait_10150200.webp';
  var DEBUFF_ICON_WP = '/static/images/Trait/trait_10030200.webp';

  function weaponTraitTextBlob(weapon) {
    var blob = '';
    if (!weapon) return '';
    (weapon.traits || []).forEach(function (t) {
      blob += '\n' + (typeof t === 'string' ? t : ((t && (t.text || t.name)) || ''));
    });
    if (weapon.raw && weapon.raw.traits) {
      (weapon.raw.traits || []).forEach(function (t) {
        blob += '\n' + (typeof t === 'string' ? t : ((t && (t.text || t.name)) || ''));
      });
    }
    return blob;
  }

  function parseInflictDurationTurns(chunk, fallback) {
    var m = String(chunk || '').match(/\((\d+)\s*turn/i)
      || String(chunk || '').match(/(\d+)\s*ターン/)
      || String(chunk || '').match(/(\d+)\s*回合/);
    if (m) return Math.max(1, parseInt(m[1], 10) || 1);
    return fallback != null ? fallback : 1;
  }

  function debuffStillActive(d, turnNow) {
    if (!d) return false;
    if (d.untilTurn == null) return true;
    return (turnNow | 0) <= (d.untilTurn | 0);
  }

  function pruneExpiredDebuffs(actor) {
    var now;
    if (!actor || !actor.debuffs || !actor.debuffs.length) return;
    now = actor._simTurn | 0;
    actor.debuffs = actor.debuffs.filter(function (d) { return debuffStillActive(d, now); });
  }

  /** Active Damage-Taken-Up % on defender for /cal dtuBeam / dtuPhysical / dtuSpecial. */
  function liveStatusDtu(actor) {
    var out = { beam: 0, physical: 0, special: 0 };
    var now = actor && (actor._simTurn | 0);
    (actor && actor.debuffs || []).forEach(function (d) {
      if (!debuffStillActive(d, now)) return;
      if (d.type === 'dtu_beam') out.beam = Math.max(out.beam, d.value | 0);
      else if (d.type === 'dtu_physical') out.physical = Math.max(out.physical, d.value | 0);
      else if (d.type === 'dtu_special') out.special = Math.max(out.special, d.value | 0);
    });
    return out;
  }

  /** Active Inflict DEF-down % (status) — stacked with the attacking weapon’s own DEF line in /cal. */
  function liveStatusDefDebuffPct(actor) {
    var now = actor && (actor._simTurn | 0);
    var best = 0;
    (actor && actor.debuffs || []).forEach(function (d) {
      if (!debuffStillActive(d, now)) return;
      if (d.type === 'def_dn') best = Math.max(best, d.value | 0);
    });
    return best;
  }

  /**
   * Parse weapon “Inflict …” / power-down traits into status rows.
   * Class-wide (Support / Durability kits, Pharact EX Beam DTU, …) — not id special-cases.
   */
  function parseWeaponInflictDebuffs(weapon, turnNow) {
    var blob = weaponTraitTextBlob(weapon);
    var out = [];
    var turns, pct, m, chunk;

    function push(type, value, icon, label, durChunk) {
      /* (N turn(s)) includes the apply turn — untilTurn = now + N - 1. */
      var t = Math.max(1, parseInflictDurationTurns(durChunk || blob, 1) | 0);
      if (!(value > 0)) return;
      out.push({
        type: type,
        value: value | 0,
        untilTurn: (turnNow | 0) + t - 1,
        icon: icon || '',
        label: label || type
      });
    }

    /* Damage Taken from Beam / Physical / Special Up (Inflict). */
    m = blob.match(/Inflict\s*[「"“]?Damage Taken from Beam Weapons Up\s*(\d+)\s*%[」"”]?([^\n]*)/i)
      || blob.match(/ビーム武装(?:による)?被ダメージ[^\d]{0,24}(\d+)\s*%([^\n]*)/)
      || blob.match(/遭(?:光束|鐳射)武裝攻擊時[^\d]{0,40}(\d+)\s*%([^\n]*)/);
    if (m) push('dtu_beam', parseInt(m[1], 10), DEBUFF_ICON_BEAM, 'Beam damage taken up', m[0]);

    m = blob.match(/Inflict\s*[「"“]?Damage Taken from Physical Weapons Up\s*(\d+)\s*%[」"”]?([^\n]*)/i)
      || blob.match(/物理武装(?:による)?被ダメージ[^\d]{0,24}(\d+)\s*%([^\n]*)/)
      || blob.match(/遭物理武裝攻擊時[^\d]{0,40}(\d+)\s*%([^\n]*)/);
    if (m) push('dtu_physical', parseInt(m[1], 10), DEBUFF_ICON_PHYS, 'Physical damage taken up', m[0]);

    m = blob.match(/Inflict\s*[「"“]?Damage Taken from Special Weapons Up\s*(\d+)\s*%[」"”]?([^\n]*)/i)
      || blob.match(/特殊武装(?:による)?被ダメージ[^\d]{0,24}(\d+)\s*%([^\n]*)/)
      || blob.match(/遭特殊武裝攻擊時[^\d]{0,40}(\d+)\s*%([^\n]*)/);
    if (m) push('dtu_special', parseInt(m[1], 10), DEBUFF_ICON_SPEC, 'Special damage taken up', m[0]);

    /* DEF / ATK / MOB / ACC down — EN weapon-trait wording is "DEF Down" / "MOB Down" / "ACC Down". */
    m = blob.match(/Inflict\s*[「"“]?(?:DEF|Defense|防御力|守備力|防禦力)\s*(?:Down|減少|低下)\s*(\d+)\s*%/i)
      || blob.match(/(?:DEF|Defense|防御力|守備力|防禦力)\s*(?:Down|減少|低下)\s*(\d+)\s*%[^\n]{0,40}Inflict/i);
    if (m) push('def_dn', parseInt(m[1], 10), DEBUFF_ICON_DEF, 'DEF down', m[0]);
    else {
      chunk = blob.match(/Inflict[^\n]{0,80}(?:DEF|Defense|防御力|守備力|防禦力)[^\n]{0,40}(\d+)\s*%/i);
      if (chunk) push('def_dn', parseInt(chunk[1], 10), DEBUFF_ICON_DEF, 'DEF down', chunk[0]);
    }

    m = blob.match(/Inflict\s*[「"“]?(?:ATK|Attack|攻撃力|攻擊力)\s*(?:Down|減少|低下)\s*(\d+)\s*%/i);
    if (m) push('atk_dn', parseInt(m[1], 10), DEBUFF_ICON_ATK, 'ATK down', m[0]);

    m = blob.match(/Inflict\s*[「"“]?(?:MOB|Mobility|機動力)\s*(?:Down|減少|低下)\s*(\d+)\s*%/i);
    if (m) push('mob_dn', parseInt(m[1], 10), DEBUFF_ICON_MOB, 'MOB down', m[0]);

    m = blob.match(/Inflict\s*[「"“]?(?:ACC|Accuracy|命中(?:率)?)\s*(?:Down|減少|低下|rate\s*down)\s*(\d+)\s*%/i);
    if (m) push('acc_dn', parseInt(m[1], 10), DEBUFF_ICON_ACC, 'ACC down', m[0]);

    m = blob.match(/Inflict\s*[「"“]?(?:EVA|Evasion|回避率|閃避率)\s*(?:Down|減少|低下)\s*(\d+)\s*%/i);
    if (m) push('eva_dn', parseInt(m[1], 10), DEBUFF_ICON_MOB, 'EVA down', m[0]);

    /* Weapon power down (attacker-side when they next fire). */
    if (/decreas|減少|低下|down/i.test(blob) && /weapon\s*power|武装威力|武裝威力|威力/i.test(blob)) {
      pct = 0;
      m = blob.match(/(?:weapon\s*power|武装威力|武裝威力)[^\d]{0,20}(\d+)\s*%/i)
        || blob.match(/(\d+)\s*%[^\n]{0,24}(?:weapon\s*power|武装威力)/i);
      if (m) pct = parseInt(m[1], 10) || 0;
      if (pct > 0) push('weapon_power', pct, DEBUFF_ICON_WP, 'Weapon power down', blob);
    }

    return out;
  }

  /** Apply Inflict / power-down traits from a landed hit onto the defender. */
  function applyWeaponDebuffs(defender, weapon, turnNow) {
    var list, i, neu;
    if (!defender || !weapon) return;
    list = parseWeaponInflictDebuffs(weapon, turnNow);
    if (!list.length) return;
    defender.debuffs = defender.debuffs || [];
    for (i = 0; i < list.length; i++) {
      neu = list[i];
      defender.debuffs = defender.debuffs.filter(function (d) {
        return !(d && d.type === neu.type);
      });
      defender.debuffs.push(neu);
    }
  }

  function unitIsLarge(ud) {
    return !!(ud && (ud.is_large || Number(ud.occupied_area_id) === 2));
  }

  /**
   * 2×2 footprint (HangerLab Neo Zeong / MasterData DirectionTypeIndex):
   * expands behind facing — enemy faces right → −x; ally faces left → +x;
   * + one cell down (−y). Spawn cell is the inward (front) corner.
   * LINE Y spacing is every 2 cells so adjacent 2×2s tile without overlap.
   */
  function footprintCells(u) {
    var x = u.x | 0;
    var y = u.y | 0;
    var dx;
    if (!u.isLarge) return [{ x: x, y: y }];
    dx = footprintDx(u.side, u.direction);
    return [
      { x: x, y: y },
      { x: x + dx, y: y },
      { x: x, y: y - 1 },
      { x: x + dx, y: y - 1 }
    ];
  }

  function footprintOrigin(u) {
    var cells = footprintCells(u);
    var minX = cells[0].x;
    var maxY = cells[0].y;
    cells.forEach(function (c) {
      if (c.x < minX) minX = c.x;
      if (c.y > maxY) maxY = c.y;
    });
    return { x: minX, y: maxY };
  }

  /** Manhattan to nearest footprint cell (2×2 Neo Zeong expands −y / facing). */
  function distFootprintToCell(u, x, y) {
    var best = 1e9;
    var d;
    footprintCells(u).forEach(function (c) {
      d = Math.abs((c.x | 0) - (x | 0)) + Math.abs((c.y | 0) - (y | 0));
      if (d < best) best = d;
    });
    return best;
  }

  function distFootprintToUnit(a, b) {
    var best = 1e9;
    var d;
    if (!a || !b) return best;
    footprintCells(a).forEach(function (ca) {
      footprintCells(b).forEach(function (cb) {
        d = Math.abs((ca.x | 0) - (cb.x | 0)) + Math.abs((ca.y | 0) - (cb.y | 0));
        if (d < best) best = d;
      });
    });
    return best;
  }

  var _areaAuraState = null;

  function auraVisible() {
    try {
      if (localStorage.getItem(AURA_VIS_KEY) === '0') return false;
    } catch (_) {}
    return true;
  }

  function setAuraVisible(on) {
    try { localStorage.setItem(AURA_VIS_KEY, on ? '1' : '0'); } catch (_) {}
    refreshAuraPaint();
  }

  function syncAuraToggleUi() {
    var el = document.getElementById('mlsAuraToggle');
    if (el) el.checked = auraVisible();
  }

  function refreshAuraPaint() {
    var host = document.getElementById('mlsBoard');
    var layer;
    if (host) refreshCellTints(host);
    layer = host && host.querySelector('.mls-token-layer');
    if (!layer) return;
    Array.prototype.forEach.call(layer.querySelectorAll('.mls-token'), function (el) {
      var key = el.getAttribute('data-token-key') || '';
      var u = null;
      lastAlly.concat(lastEnemy).some(function (tok) {
        if (tokenKey(tok) === key) { u = tok; return true; }
        return false;
      });
      if (u) syncAuraDebuffEl(el, u);
    });
  }

  /** Cond:Area tile keys + opposing debuff icons (Neo Zeong EX–class sim_effects). */
  function buildAreaAuraState() {
    var R = rules();
    var all = lastAlly.concat(lastEnemy);
    var tiles = {};
    var iconsByKey = {};
    var win, x0, x1, y0, y1;
    if (!R || !R.listAreaAuras) return { tiles: tiles, iconsByKey: iconsByKey };
    win = board ? computeMapWindow() : null;
    x0 = win ? win.minX : 0;
    x1 = win ? win.maxX : 20;
    y0 = win ? win.minY : 0;
    y1 = win ? win.maxY : 20;
    all.forEach(function (src) {
      var auras, i, a, rMin, rMax, x, y, d;
      if (!src || (src.hp | 0) <= 0) return;
      auras = R.listAreaAuras(src);
      if (!auras.length) return;
      for (i = 0; i < auras.length; i++) {
        a = auras[i];
        rMin = a.range_min | 0;
        rMax = a.range_max | 0;
        if (rMax <= 0) continue;
        for (y = y0; y <= y1; y++) {
          for (x = x0; x <= x1; x++) {
            d = distFootprintToCell(src, x, y);
            if (d < Math.max(1, rMin) || d > rMax) continue;
            tiles[x + ',' + y] = 1;
          }
        }
      }
      all.forEach(function (tgt) {
        var j, aura, key, ik;
        if (!tgt || tgt === src || tgt.side === src.side || (tgt.hp | 0) <= 0) return;
        d = distFootprintToUnit(src, tgt);
        for (j = 0; j < auras.length; j++) {
          aura = auras[j];
          rMin = aura.range_min | 0;
          rMax = aura.range_max | 0;
          if (d < Math.max(1, rMin) || (rMax > 0 && d > rMax)) continue;
          ik = tokenKey(tgt);
          if (!iconsByKey[ik]) iconsByKey[ik] = [];
          key = String(aura.icon || aura.name || j);
          if (iconsByKey[ik].some(function (z) { return z._k === key; })) continue;
          iconsByKey[ik].push({
            _k: key,
            icon: aura.icon || '',
            name: aura.name || 'Area debuff',
            value: aura.value | 0
          });
        }
      });
    });
    return { tiles: tiles, iconsByKey: iconsByKey };
  }

  function areaAuraState() {
    if (!_areaAuraState) _areaAuraState = buildAreaAuraState();
    return _areaAuraState;
  }

  function auraDebuffHtml(u) {
    var list;
    if (!auraVisible()) return '';
    list = (areaAuraState().iconsByKey && areaAuraState().iconsByKey[tokenKey(u)]) || [];
    if (!list.length) return '';
    return '<div class="mls-aura-debuffs" aria-hidden="true">' +
      list.map(function (a) {
        if (!a.icon) return '';
        return '<img class="mls-aura-debuff-ic" src="' + esc(thumbUrl(a.icon)) +
          '" alt="" title="' + esc(a.name) + '" loading="lazy" decoding="async">';
      }).join('') +
      '</div>';
  }

  function syncAuraDebuffEl(el, u) {
    var host, html, vig;
    if (!el || !u) return;
    host = el.querySelector('.mls-aura-debuffs');
    html = auraDebuffHtml(u);
    if (!html) {
      if (host && host.parentNode) host.parentNode.removeChild(host);
      return;
    }
    if (!host) {
      vig = el.querySelector('.mls-vigor');
      if (vig) vig.insertAdjacentHTML('beforebegin', html);
      else el.insertAdjacentHTML('afterbegin', html);
      return;
    }
    host.outerHTML = html;
  }

  function mlBoostMult() {
    var pct = seasonMeta && seasonMeta.buff_percent != null ? (seasonMeta.buff_percent | 0) : 50;
    if (pct <= 0) return 1;
    return 1 + pct / 100;
  }

  /**
   * HP/EN/MOB from the same /cal sheet path as damage (ML + OP% + leader + supporter flats).
   * Raw unitStats×ML understated HP when OP/leader were on — units died too easily.
   */
  function sheetCombatStats(loaded, optionParts, supporter) {
    var mode = loaded && loaded.unitStatMode ? loaded.unitStatMode : 'normal';
    var us = unitStats(loaded.unit, loaded.lb, mode);
    var ud = loaded.unit;
    var lb = loaded.lb | 0;
    var lbData = ud && ud.lb_data;
    var tier = lbData && lbData.length ? Math.min(lb, lbData.length - 1) : 0;
    var td = (lbData && lbData[tier]) || {};
    var statKey = 'stats_no_cond';
    if (ud && ud.has_sp && mode === 'ssp') statKey = 'ssp_stats_no_cond';
    else if (ud && ud.has_sp && mode === 'sp') statKey = 'sp_stats_no_cond';
    var stats = td[statKey] || td.stats_no_cond || td.stats || (ud && ud.stats) || [];
    var mult = mlBoostMult();
    var getSheet = global._dcGetModifiedAttackerUnitStatsFromCtx;
    var ctx, f, sup;
    if (typeof getSheet === 'function' && ud && stats && stats.length) {
      sup = supporter || null;
      if (sup && !Array.isArray(sup)) {
        if (sup._dcLbTier == null) {
          var ent = null;
          try { ent = forceOf(loaded.side || 'ally').supporter; } catch (e) { ent = null; }
          sup._dcLbTier = ent && ent.lb != null ? (ent.lb | 0) : 3;
          if (sup._dcLevel == null) sup._dcLevel = 100;
        }
      }
      ctx = {
        masterLeagueBuff: true,
        grandOffensiveBuff: false,
        optionParts: optionParts || [],
        supporters: sup ? [sup] : [],
        atkUnitData: ud,
        atkCharData: loaded.char || null,
        charCondPassive: false,
        unitTurnBuffAtk: false,
        squadCondAtkPct: 0,
        squadCondDefPct: 0,
        /* Maxed ULT Alt flats into HP/EN/ATK/DEF/MOB sheet (same as /cal when ULT toggle on). */
        ultAltActive: unitHasUltAlt(ud)
      };
      try {
        f = getSheet(ctx, stats, false);
        if (f && (f.unitHp | 0) > 0) {
          return {
            hp: f.unitHp | 0,
            en: Math.max(1, f.unitEn | 0),
            mob: f.unitMob | 0,
            move: Math.max(1, f.unitMove | 0),
            atk: f.unitAtk | 0,
            def: f.unitDefVal | 0
          };
        }
      } catch (err) { /* fall through */ }
    }
    return {
      hp: Math.floor(us.hp * mult),
      en: Math.floor((us.en || 100) * mult),
      mob: Math.floor(us.mob * mult),
      move: us.move,
      atk: Math.floor((us.atk || 0) * mult),
      def: Math.floor((us.def || 0) * mult)
    };
  }

  function makeActor(side, cell, loaded, owned, slotMeta, optionParts, supporter) {
    var uMode = resolveUnitStatMode(loaded.unit, slotMeta && slotMeta.unitStatMode);
    var cMode = resolveCharStatMode(loaded.char, slotMeta && slotMeta.charStatMode);
    if (slotMeta) {
      slotMeta.unitHasSp = unitAllowsSpSsp(loaded.unit);
      slotMeta.charHasSp = charAllowsSp(loaded.char);
      slotMeta._statChecked = true;
      slotMeta._charStatChecked = !!loaded.char;
      if (!slotMeta.unitStatMode) slotMeta.unitStatMode = uMode;
      if (!slotMeta.charStatMode) slotMeta.charStatMode = cMode;
    }
    var us = unitStats(loaded.unit, loaded.lb, uMode);
    var sheet = sheetCombatStats({
      unit: loaded.unit, char: loaded.char, lb: loaded.lb, side: side, unitStatMode: uMode
    }, optionParts, supporter);
    var cs = charStats(loaded.char, cMode);
    var id = String(loaded.unit && loaded.unit.id || '');
    var facing = sideFacing(side);
    var mob = sheet.mob;
    var fieldTerr = String((seasonMeta && seasonMeta.terrain_primary) || '');
    var baseMove = sheet.move || us.move;
    var terrMove = terrainMoveFactor(loaded.unit, fieldTerr);
    var move = applyTerrainMove(baseMove, loaded.unit, fieldTerr);
    var hp = sheet.hp;
    var en = sheet.en;
    var actor = {
      side: side,
      n: cell.n,
      x: cell.x,
      y: cell.y,
      homeX: cell.x,
      homeY: cell.y,
      id: id,
      name: (loaded.unit && loaded.unit.name) || (slotMeta && slotMeta.name) || id,
      /* Prefer live unit detail art — slot thumbs can lag / mismatch Escape partners. */
      thum: thumbUrl((loaded.unit && (loaded.unit.thum || loaded.unit.portrait)) ||
        (slotMeta && slotMeta.thum) || ''),
      roleIcon: thumbUrl((slotMeta && slotMeta.roleIcon) || ''),
      lb: loaded.lb | 0,
      hp: hp,
      maxHp: hp,
      maxEn: en,
      currentEn: en,
      mobility: mob,
      /* Turn order = unit Mobility×ML + pilot Reaction (not OP/leader sheet MOB). */
      _spdMob: Math.floor(us.mob * mlBoostMult()) | 0,
      _spdReact: cs.reaction | 0,
      baseMove: baseMove,
      move: move,
      fieldTerrain: fieldTerr,
      terrainMoveFactor: terrMove,
      occupancyMode: unitOccupancyMode(loaded.unit, fieldTerr),
      reaction: cs.reaction,
      mp: 0,
      weapons: weaponsOf(loaded.unit, uMode),
      unit: loaded.unit,
      char: loaded.char,
      optionParts: optionParts || [],
      supporter: supporter || null,
      isLarge: unitIsLarge(loaded.unit),
      size: unitIsLarge(loaded.unit) ? 2 : 1,
      direction: facing,
      unitStatMode: uMode,
      charStatMode: cMode,
      owned: owned[id] != null,
      pilotSkills: { list: [], sp: 5 },
      sp: 5,
      currentSp: 5,
      sdLimit: 0,
      sdRangeBonus: 0,
      usedSupportDefendCount: 0,
      usedSupportCount: 0,
      saLimit: 0,
      battleSupportDefendedCount: 0,
      skillUsed: false,
      usedSkillThisTurn: false,
      forceGuard: false,
      unconditionalCSStock: 0,
      hasAcquiredUnconditionalCS: false,
      activeSkills: [],
      debuffs: [],
      active: false,
      ghostHp: hp,
      badge: '',
      tension: 0,
      _hpFallRestoreUsed: {},
      _escapeUsed: false,
      combatCountStacks: 0,
      damageTakenStacks: 0,
      turnBuffActive: false
    };
    actor._formBase = captureFormBase(actor);
    syncMpDisplay(actor);
    var R = rules();
    if (R && R.buildPilotSkillKit) {
      actor.pilotSkills = R.buildPilotSkillKit(loaded.char);
      actor.sp = Math.max(5, actor.pilotSkills.sp | 0);
      actor.currentSp = actor.sp;
    }
    /* gge: SD/SA stock is the SUM of every active +N ability line, re-evaluated live
       in combat (tension / unit conditions). Do NOT use dossier getCharacterChanceSupportState
       (Math.max(role,bonus) + conditionalPassiveActive UI toggle) — that under-counts EX stacks. */
    if (R && R.supportDefendLimit) actor.sdLimit = R.supportDefendLimit(actor) | 0;
    if (R && R.supportDefendRangeBonus) actor.sdRangeBonus = R.supportDefendRangeBonus(actor) | 0;
    if (R && R.supportAttackLimit) actor.saLimit = R.supportAttackLimit(actor) | 0;
    /* /cal + gge: battle-start MP from pilot/unit passives (after unit+char attached). */
    actor.mp = (R && R.startingMpBonus) ? (R.startingMpBonus(actor) | 0) : 0;
    syncMpDisplay(actor);
    return actor;
  }

  function loadOptionPart(id) {
    if (!id) return Promise.resolve(null);
    return fetchJson('/api/option_part/' + encodeURIComponent(id) + '?lang=' + encodeURIComponent(lang()))
      .then(function (d) { return d && !d.error ? d : null; })
      .catch(function () { return null; });
  }

  function loadSupporter(side) {
    var ent = forceOf(side).supporter;
    if (!ent || !ent.id) {
      sideSupportData[side] = null;
      return Promise.resolve(null);
    }
    var lb = ent.lb != null ? (ent.lb | 0) : 3;
    var url = '/api/supporter/' + encodeURIComponent(ent.id) +
      '?lang=' + encodeURIComponent(lang()) + '&level=100&lb_tier=' + lb;
    return fetchJson(url).then(function (d) {
      if (!d || d.error) {
        sideSupportData[side] = null;
        return null;
      }
      d._dcLevel = 100;
      d._dcLbTier = lb;
      sideSupportData[side] = d;
      return d;
    }).catch(function () {
      sideSupportData[side] = null;
      return null;
    });
  }

  function buildSide(side, cells, slots, owned) {
    var jobs = [];
    var i, sl;
    /* Iterate roster slots (not spawn-cell count) so ACTION ORDER includes every filled kit. */
    for (i = 0; i < SLOT_COUNT; i++) {
      sl = slots[i];
      if (!sl || !sl.unitId) continue;
      /* Ally + Only my Collections: keep slot on formation (grey) but omit from battle map. */
      if (slotExcludedByCollections(sl, side)) continue;
      (function (slotIdx, slotMeta) {
        var home = effectiveSlotHome(side, slotIdx);
        jobs.push(Promise.all([
          loadPair(slotMeta.unitId, slotMeta.charId, slotMeta.lb != null ? slotMeta.lb : 3),
          loadOptionPart(slotMeta.optionPartId),
          fetchSupporterForUnit(side, slotMeta.unitId, slotMeta.charId)
        ]).then(function (pair) {
          var loaded = pair[0];
          var op = pair[1];
          var unitSup = pair[2];
          var actor = makeActor(side, home, loaded, owned, slotMeta, op ? [op] : [], unitSup);
          if (actor) actor.slotIdx = slotIdx;
          return prefetchEscapePartner(loaded && loaded.unit).then(function () {
            return actor;
          });
        }).catch(function () { return null; }));
      })(i, sl);
    }
    return Promise.all(jobs).then(function (rows) {
      return rows.filter(Boolean);
    });
  }

  function loadArmies() {
    var owned = ownedMap();
    return Promise.all([
      loadSupporter('ally'),
      loadSupporter('enemy')
    ]).then(function (sups) {
      var allySup = supporterExcludedByCollections(forceOf('ally').supporter, 'ally') ? null : sups[0];
      var enemySup = sups[1];
      if (allySup == null) sideSupportData.ally = null;
      /* sideSupportData stays for display; battle HP/dmg uses per-unit for_unit_id clones. */
      void enemySup;
      return Promise.all([
        buildSide('ally', allyCells(), forceOf('ally').slots, owned),
        buildSide('enemy', enemyCells(), forceOf('enemy').slots, owned)
      ]);
    }).then(function (pair) {
      lastAlly = pair[0];
      lastEnemy = pair[1];
      stampSquadBuffs(lastAlly);
      stampSquadBuffs(lastEnemy);
      paintTimeline();
      paintForceSlots();
    });
  }

  function clearMapCameraLock() {
    var host;
    lockedMapWindow = null;
    lockedMapCellPx = 0;
    mapBgCacheKey = '';
    host = document.getElementById('mlsBoard');
    if (host) host.removeAttribute('data-layout');
  }

  function finishMapWindow(minX, maxX, minY, maxY, mapW, mapH) {
    if (mapW > 0) {
      minX = Math.max(0, minX);
      maxX = Math.min(mapW - 1, maxX);
    }
    if (mapH > 0) {
      minY = Math.max(0, minY);
      maxY = Math.min(mapH - 1, maxY);
    }
    return {
      minX: minX, maxX: maxX, minY: minY, maxY: maxY,
      cols: maxX - minX + 1,
      rows: maxY - minY + 1
    };
  }

  /** Fresh bbox around spawns + current unit footprints (pad 1). */
  function computeMapWindowFresh() {
    var cells = [];
    var m = mapMeta();
    var mapW = m.width | 0;
    var mapH = m.height | 0;
    (board && board.sides || []).forEach(function (s) {
      (s.cells || []).forEach(function (c) { cells.push(c); });
    });
    lastAlly.concat(lastEnemy).forEach(function (u) {
      if (!u) return;
      /* Keep home cells in the bbox so KO / retreat does not shrink the camera. */
      cells.push({
        x: u.homeX != null ? u.homeX : u.x,
        y: u.homeY != null ? u.homeY : u.y
      });
      footprintCells(u).forEach(function (c) { cells.push(c); });
    });
    if (!cells.length) {
      if (mapW > 0 && mapH > 0) {
        return finishMapWindow(0, mapW - 1, 0, mapH - 1, mapW, mapH);
      }
      return finishMapWindow(0, 16, 0, 10, 0, 0);
    }
    var minX = cells[0].x, maxX = cells[0].x, minY = cells[0].y, maxY = cells[0].y;
    cells.forEach(function (c) {
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
    });
    /* Tight camera around the fight — not the empty full map (avoids scroll / tiny tokens). */
    minX -= 1; maxX += 1; minY -= 1; maxY += 1;
    return finishMapWindow(minX, maxX, minY, maxY, mapW, mapH);
  }

  /**
   * Stable battle camera: lock after first paint, expand if units leave the box,
   * never shrink when units move / die / swap (that was the “map keeps shrinking” bug).
   */
  function computeMapWindow() {
    var fresh = computeMapWindowFresh();
    var m, mapW, mapH;
    if (!lockedMapWindow) {
      lockedMapWindow = fresh;
      return lockedMapWindow;
    }
    if (fresh.minX < lockedMapWindow.minX || fresh.maxX > lockedMapWindow.maxX ||
        fresh.minY < lockedMapWindow.minY || fresh.maxY > lockedMapWindow.maxY) {
      m = mapMeta();
      mapW = m.width | 0;
      mapH = m.height | 0;
      lockedMapWindow = finishMapWindow(
        Math.min(lockedMapWindow.minX, fresh.minX),
        Math.max(lockedMapWindow.maxX, fresh.maxX),
        Math.min(lockedMapWindow.minY, fresh.minY),
        Math.max(lockedMapWindow.maxY, fresh.maxY),
        mapW, mapH
      );
      /* Window grew — allow a one-shot cell re-fit so tokens stay readable. */
      lockedMapCellPx = 0;
    }
    return lockedMapWindow;
  }

  function tokenKey(u) {
    return (u.side || 'x') + '-' + (u.n | 0);
  }

  function coverOffsetPx(u) {
    if (!u || !u.covering || u.coverTx == null || u.coverTy == null) {
      return { x: 0, y: 0 };
    }
    /* Full step onto the ally cell. 0.9 left a gap so the number looked like it hit the ally, not the SD. */
    return {
      x: ((u.coverTx | 0) - (u.x | 0)) * mapCellPx,
      y: ((u.y | 0) - (u.coverTy | 0)) * mapCellPx
    };
  }

  /** Protected unit steps half a tile sideways so the SD stand-in owns the cell. */
  function shelterOffsetPx(u) {
    if (!u || !u.sheltered || u.covering) return { x: 0, y: 0 };
    /* Ally force is on the right → nudge further right; enemy (left) → further left. */
    return {
      x: (u.side === 'ally' ? 1 : -1) * mapCellPx * 0.5,
      y: 0
    };
  }

  /** Visual board cell while covering (gge: damage / laser land on the cover spot). */
  function impactCell(u) {
    if (u && u.covering && u.coverTx != null && u.coverTy != null) {
      return { x: u.coverTx | 0, y: u.coverTy | 0 };
    }
    return { x: (u && u.x) | 0, y: (u && u.y) | 0 };
  }

  function weaponIsRanged(wpn) {
    var blob = '';
    var raw = wpn && (wpn.raw || wpn);
    var i, t, at;
    if (!raw && !wpn) return false;
    if (wpn && wpn.weapon_type) blob += ' ' + wpn.weapon_type;
    if (wpn && wpn.attribute) blob += ' ' + wpn.attribute;
    if (raw) {
      if (raw.weapon_type) blob += ' ' + raw.weapon_type;
      if (raw.attribute) blob += ' ' + raw.attribute;
      if (raw.attack_type) blob += ' ' + raw.attack_type;
      if (Array.isArray(raw.attack_types)) {
        for (i = 0; i < raw.attack_types.length; i++) {
          at = raw.attack_types[i];
          blob += ' ' + (typeof at === 'string' ? at : (at && (at.key || at.name)) || '');
        }
      }
      if (Array.isArray(raw.traits)) {
        for (i = 0; i < raw.traits.length; i++) {
          t = raw.traits[i];
          blob += ' ' + (typeof t === 'string' ? t : (t && (t.text || t.name)) || '');
        }
      }
    }
    if (/melee|格闘|近接/i.test(blob) && !/ranged|射撃/i.test(blob)) return false;
    return /ranged|射撃|shoot|beam|ビーム|physical|物理|funnel|ファンネル|map/i.test(blob)
      || ((wpn && (wpn.max_range | 0) > 1) && !/melee|格闘/i.test(blob));
  }

  /**
   * Vigor / Tension — EN LANG m_help + gge getTensionString + /cal DC_MP:
   * MP 0–3 Normal · 4–7 High · 8–11 Max · 12 Supercharged (cap 12).
   * Up: land a hit, SA, SD. Down: take a hit, own attack evaded. Start at 0 unless passives.
   */
  function vigorLevelFromMp(mp) {
    var m = mp | 0;
    if (m >= 12) return 'super';
    if (m >= 8) return 'max';
    if (m >= 4) return 'high';
    return 'medium';
  }

  function vigorLabelFromMp(mp) {
    var lv = vigorLevelFromMp(mp);
    if (typeof global._dcVigorLabel === 'function') return global._dcVigorLabel(lv);
    if (lv === 'high') return 'High';
    if (lv === 'max') return 'Max';
    if (lv === 'super') return 'Supercharged';
    return 'Normal';
  }

  function tensionAsset(name) {
    return thumbUrl('/static/images/Master%20League/Tension/' + name);
  }

  function syncMpDisplay(unit) {
    if (!unit) return;
    /* Legacy percent field for snapshots; HUD uses MP → Vigor bands. */
    unit.tension = Math.min(100, Math.round(((unit.mp | 0) / 12) * 100));
  }

  /** Apply MP delta; flash TENSION UP/DOWN when the Vigor band changes (gge flushMP). */
  function applyMpDelta(unit, delta) {
    var oldMp, oldLv, newLv;
    if (!unit || !delta || unit.isMpLocked) return;
    oldMp = unit.mp | 0;
    oldLv = vigorLevelFromMp(oldMp);
    unit.mp = Math.max(0, Math.min(12, oldMp + (delta | 0)));
    syncMpDisplay(unit);
    newLv = vigorLevelFromMp(unit.mp);
    if (oldLv !== newLv) {
      unit._tensionFlash = (unit.mp > oldMp) ? 'up' : 'down';
      unit._tensionFlashLevel = newLv;
    }
  }

  /**
   * Band-change FX (game Tension sheet):
   * down → down_01 | down_text + down_line under text
   * up → up_01 | up_text_01 + up_line
   * into Supercharged → up_03 | up_text_02 + up_02_line
   */
  function vigorFlashHtml(isUp, toLevel) {
    var superUp = !!(isUp && toLevel === 'super');
    var ic = isUp
      ? (superUp ? 'ui_tention_up_03.webp' : 'ui_tention_up_01.webp')
      : 'ui_tention_down_01.webp';
    var txt = isUp
      ? (superUp ? 'ui_tention_up_text_02.webp' : 'ui_tention_up_text_01.webp')
      : 'ui_tention_down_text.webp';
    var line = isUp
      ? (superUp ? 'ui_tention_up_02_line.webp' : 'ui_tention_up_line.webp')
      : 'ui_tention_down_line.webp';
    return '<div class="mls-vigor-flash is-' + (isUp ? 'up' : 'down') +
      (superUp ? ' is-super' : '') + '" aria-hidden="true">' +
      '<img class="mls-vigor-flash-ic" src="' + esc(tensionAsset(ic)) + '" alt="" decoding="async">' +
      '<span class="mls-vigor-flash-col">' +
      '<img class="mls-vigor-flash-txt" src="' + esc(tensionAsset(txt)) + '" alt="" decoding="async">' +
      '<img class="mls-vigor-flash-line" src="' + esc(tensionAsset(line)) + '" alt="" decoding="async">' +
      '</span></div>';
  }

  /** Persistent: Vigor wording only above the thumb (no sticky chevron over art). Ally + enemy. */
  function vigorHudHtml(u) {
    var lab = vigorLabelFromMp(u && u.mp);
    var lv = vigorLevelFromMp(u && u.mp);
    var flash = u && u._tensionFlash;
    var html = '<div class="mls-vigor mls-vigor--' + lv + '" title="Vigor / Tension: ' + esc(lab) +
      ' (MP ' + ((u && u.mp) | 0) + '/12)">' +
      '<span class="mls-vigor-lab">' + esc(lab) + '</span>';
    if (flash === 'up' || flash === 'down') {
      html += vigorFlashHtml(flash === 'up', u._tensionFlashLevel);
    }
    html += '</div>';
    return html;
  }

  function syncVigorHudEl(el, u) {
    var host, labEl, flashEl, lab, lv, flash;
    if (!el || !u) return;
    host = el.querySelector('.mls-vigor');
    if (!host) {
      el.insertAdjacentHTML('afterbegin', vigorHudHtml(u));
      host = el.querySelector('.mls-vigor');
      if (u._tensionFlash) {
        u._tensionFlash = '';
        u._tensionFlashLevel = '';
        flashEl = host && host.querySelector('.mls-vigor-flash');
        if (flashEl) {
          setTimeout(function () {
            if (flashEl.parentNode) flashEl.parentNode.removeChild(flashEl);
          }, 1200);
        }
      }
      return;
    }
    lab = vigorLabelFromMp(u.mp);
    lv = vigorLevelFromMp(u.mp);
    host.className = 'mls-vigor mls-vigor--' + lv;
    host.title = 'Vigor / Tension: ' + lab + ' (MP ' + ((u.mp) | 0) + '/12)';
    labEl = host.querySelector('.mls-vigor-lab');
    if (!labEl) {
      labEl = document.createElement('span');
      labEl.className = 'mls-vigor-lab';
      host.insertBefore(labEl, host.firstChild);
    }
    labEl.textContent = lab;
    flash = u._tensionFlash;
    flashEl = host.querySelector('.mls-vigor-flash');
    if (flash === 'up' || flash === 'down') {
      if (flashEl && flashEl.parentNode) flashEl.parentNode.removeChild(flashEl);
      host.insertAdjacentHTML('beforeend', vigorFlashHtml(flash === 'up', u._tensionFlashLevel));
      flashEl = host.querySelector('.mls-vigor-flash');
      u._tensionFlash = '';
      u._tensionFlashLevel = '';
      setTimeout(function () {
        if (flashEl && flashEl.parentNode) flashEl.parentNode.removeChild(flashEl);
      }, 1200);
    }
  }

  function unitTokenHtml(u, posStyle, mark, fx) {
    var maxHp = Math.max(1, u.maxHp | 0);
    var hp = Math.max(0, u.hp | 0);
    var ghostRaw = u.ghostHp != null ? (u.ghostHp | 0) : hp;
    var healing = hp > ghostRaw;
    var pct = Math.max(0, Math.min(100, Math.round(100 * hp / maxHp)));
    var ghostPct = Math.max(0, Math.min(100, Math.round(100 * (healing ? hp : Math.max(hp, ghostRaw)) / maxHp)));
    var markCls = '';
    var badge = (fx && fx.badge) || u.badge || '';
    var badgeText = (fx && fx.badgeText) || u.badgeText || '';
    var badgeIconOv = (fx && fx.badgeIcon) || u.badgeIcon || '';
    var cover = coverOffsetPx(u);
    var shelter = shelterOffsetPx(u);
    var coverStyle = '';
    if (mark === 'attacker') markCls = ' is-attacker';
    if (mark === 'target') markCls = ' is-target';
    if (fx && fx.hit) markCls += ' is-hit';
    if (fx && fx.crit) markCls += ' is-crit-flash';
    if (u.sheltered && !u.covering) markCls += ' is-sheltered';
    if (u.covering && (cover.x || cover.y)) {
      markCls += ' is-covering';
      coverStyle = ';--mls-cover-x:' + cover.x + 'px;--mls-cover-y:' + cover.y + 'px';
    } else if (shelter.x || shelter.y) {
      coverStyle = ';--mls-shelter-x:' + shelter.x + 'px;--mls-shelter-y:' + shelter.y + 'px';
    }
    var badgeHtml = badgeChipHtml(badge, badgeText, badgeIconOv);
    var moveTip = (u.baseMove != null && (u.baseMove | 0) !== (u.move | 0))
      ? ('Move ' + (u.move | 0) + ' (base ' + (u.baseMove | 0) +
        (u.terrainMoveFactor != null && u.terrainMoveFactor < 1 ? ' · terrain ▲' : '') +
        (u.fieldTerrain ? ' · ' + u.fieldTerrain : '') + ')')
      : ('Move ' + (u.move | 0));
    return '<div class="mls-token' + (u.isLarge ? ' is-large' : '') + ' ' + (u.side === 'ally' ? 'ally' : 'enemy') +
      (u.active ? ' is-active' : '') +
      (u.hp <= 0 ? (u.lingerKo ? ' is-ko-linger' : ' is-dead') : '') + markCls +
      '" data-token-key="' + esc(tokenKey(u)) + '" data-unit-id="' + esc(u.id) +
      '" data-side="' + esc(u.side || '') + '" data-slot-idx="' + (u.slotIdx | 0) +
      '" title="' + esc(moveTip) + '" aria-label="Drag to set start cell" style="' + posStyle + coverStyle + '">' +
      topMarksHtml(u) +
      badgeHtml +
      auraDebuffHtml(u) +
      vigorHudHtml(u) +
      '<div class="mls-token-frame">' +
      (u.thum
        ? '<img class="mls-token-thum" src="' + esc(u.thum) + '" alt="' + esc(u.name) +
          '" loading="eager" decoding="async" fetchpriority="high">'
        : '') +
      '</div>' +
      supportStockHtml(u) +
      '<div class="mls-token-hp" aria-hidden="true">' +
      '<i class="mls-hp-ghost" style="transform:scaleY(' + (ghostPct / 100) + ')"></i>' +
      '<i class="mls-hp-cur" style="transform:scaleY(' + (pct / 100) + ')"></i></div>' +
      '<span class="mls-token-hpnum">' + fmtNum(hp) + '</span></div>';
  }

  /** /st map-unit-support-badge style — remaining SA / SD this turn. */
  function supportStockHtml(u) {
    var R = rules();
    var saLim = R && R.effectiveSupportAttackLimit
      ? (R.effectiveSupportAttackLimit(u) | 0)
      : (u.saLimit | 0);
    var sdLim = R && R.effectiveSupportDefendLimit
      ? (R.effectiveSupportDefendLimit(u) | 0)
      : (u.sdLimit | 0);
    var saLeft = Math.max(0, saLim - ((u.usedSupportCount) | 0));
    var sdLeft = Math.max(0, sdLim - ((u.usedSupportDefendCount) | 0));
    var html = '';
    var atkIcon = thumbUrl('/static/images/UI/UI_Common_BattleIcon_AssistAtack_S.webp');
    var defIcon = thumbUrl('/static/images/UI/UI_Common_BattleIcon_AssistDeffence_S.webp');
    if (saLim > 0) {
      html += '<span class="mls-support-stock mls-support-stock--atk' +
        (saLeft <= 0 ? ' is-spent' : '') +
        '" title="' + esc(supportAtkCounterLabel()) + ' ×' + saLeft + '/' + saLim + '">' +
        '<img src="' + esc(atkIcon) + '" alt="" loading="lazy" decoding="async">' +
        '<span class="mls-support-stock-count">×' + saLeft + '</span></span>';
    }
    if (sdLim > 0) {
      html += '<span class="mls-support-stock mls-support-stock--def' +
        (sdLeft <= 0 ? ' is-spent' : '') +
        '" title="' + esc(supportDefenseLabel()) + ' ×' + sdLeft + '/' + sdLim + '">' +
        '<img src="' + esc(defIcon) + '" alt="" loading="lazy" decoding="async">' +
        '<span class="mls-support-stock-count">×' + sdLeft + '</span></span>';
    }
    if (!html) return '';
    return '<div class="mls-support-stock-row">' + html + '</div>';
  }

  function syncSupportStockEl(el, u) {
    var row = el.querySelector('.mls-support-stock-row');
    var html = supportStockHtml(u);
    var hpEl;
    if (!html) {
      if (row && row.parentNode) row.parentNode.removeChild(row);
      return;
    }
    if (!row) {
      hpEl = el.querySelector('.mls-token-hp');
      if (hpEl) hpEl.insertAdjacentHTML('beforebegin', html);
      else el.insertAdjacentHTML('beforeend', html);
      return;
    }
    row.outerHTML = html;
  }

  function cellPctBox(win, x, y, wCells, hCells) {
    var left = ((x - win.minX) / win.cols) * 100;
    var top = ((win.maxY - y) / win.rows) * 100;
    var width = (wCells / win.cols) * 100;
    var height = (hCells / win.rows) * 100;
    return 'left:' + left + '%;top:' + top + '%;width:' + width + '%;height:' + height + '%';
  }

  function fitMapCell(win) {
    var scroll = document.querySelector('#mlsViewBattle .mls-map-scroll');
    var host = document.getElementById('mlsBoard');
    var availW, availH, cell;
    if (!scroll || !host) return mapCellPx;
    if (lockedMapCellPx > 0) {
      cell = lockedMapCellPx;
    } else {
      availW = Math.max(160, scroll.clientWidth - 12);
      availH = Math.max(160, scroll.clientHeight - 12);
      cell = Math.floor(Math.min(availW / Math.max(1, win.cols), availH / Math.max(1, win.rows)));
      cell = Math.max(26, Math.min(72, cell));
      lockedMapCellPx = cell;
    }
    mapCellPx = cell;
    host.style.setProperty('--mls-cols', String(win.cols));
    host.style.setProperty('--mls-rows', String(win.rows));
    host.style.setProperty('--mls-cell', cell + 'px');
    host.style.setProperty('--mls-move-ms', Math.max(180, stepDelay('move')) + 'ms');
    host.style.width = (cell * win.cols) + 'px';
    host.style.height = (cell * win.rows) + 'px';
    return cell;
  }

  function applyMapBackground(host, win) {
    var m = mapMeta();
    var bg = (m && m.background) ||
      (seasonMeta && seasonMeta.motif_images && seasonMeta.motif_images.battle_background) || '';
    var cell = mapCellPx;
    var grid =
      'linear-gradient(rgba(120,180,255,0.12) 1px, transparent 1px),' +
      'linear-gradient(90deg, rgba(120,180,255,0.12) 1px, transparent 1px)';
    var wash = 'linear-gradient(180deg, rgba(2,8,20,0.22), rgba(2,8,20,0.55))';
    var url, mapW, mapH, fullW, fullH, offX, offY, posX, posY, cacheKey;
    if (!bg) {
      mapBgCacheKey = '';
      host.classList.remove('has-bg');
      host.style.backgroundImage = '';
      host.style.backgroundSize = '';
      host.style.backgroundPosition = '';
      return;
    }
    url = thumbUrl(bg).replace(/"/g, '\\"');
    mapW = (m.width | 0) || win.cols;
    mapH = (m.height | 0) || win.rows;
    fullW = mapW * cell;
    fullH = mapH * cell;
    offX = (m.background_offset_x | 0);
    offY = (m.background_offset_y | 0);
    posX = -(win.minX) * cell - offX;
    posY = -(mapH - 1 - win.maxY) * cell - offY;
    cacheKey = [url, cell, win.minX, win.maxY, mapW, mapH, offX, offY].join('|');
    /* Re-setting backgroundImage every step re-decodes the map art on iOS — skip when unchanged. */
    if (cacheKey === mapBgCacheKey && host.classList.contains('has-bg')) return;
    mapBgCacheKey = cacheKey;
    host.classList.add('has-bg');
    host.style.backgroundImage = grid + ',' + wash + ',url("' + url + '")';
    host.style.backgroundSize =
      cell + 'px ' + cell + 'px,' +
      cell + 'px ' + cell + 'px,' +
      'auto,' +
      fullW + 'px ' + fullH + 'px';
    host.style.backgroundPosition =
      '0 0,0 0,center,' + posX + 'px ' + posY + 'px';
  }

  function buildSpawnTints() {
    var spawn = {};
    var footTint = {};
    (board.sides || []).forEach(function (s) {
      var cls = (s.player_side | 0) === 1 ? 'spawn-ally' : 'spawn-enemy';
      (s.cells || []).forEach(function (c) {
        spawn[c.x + ',' + c.y] = cls;
      });
    });
    lastAlly.concat(lastEnemy).forEach(function (u) {
      if (!u || u.hp <= 0) return;
      var cls = u.side === 'ally' ? 'spawn-ally' : 'spawn-enemy';
      footprintCells(u).forEach(function (c) {
        var k = c.x + ',' + c.y;
        spawn[k] = cls;
        if (u.isLarge) footTint[k] = (u.side === 'ally' ? 'foot-ally' : 'foot-enemy');
      });
      if (u.isLarge) {
        var home = {
          x: u.homeX != null ? u.homeX : u.x,
          y: u.homeY != null ? u.homeY : u.y,
          side: u.side,
          isLarge: true,
          direction: u.direction
        };
        footprintCells(home).forEach(function (c) {
          var k = c.x + ',' + c.y;
          if (!spawn[k]) spawn[k] = cls;
        });
      }
    });
    return { spawn: spawn, footTint: footTint };
  }

  function cellAuraClass(key) {
    if (!auraVisible()) return '';
    return areaAuraState().tiles[key] ? ' is-area-aura' : '';
  }

  function rebuildCellGrid(host, win) {
    var tints = buildSpawnTints();
    var cellsHtml = '';
    var y, x, gx, gy, key, cls, ft;
    _areaAuraState = null;
    for (y = win.maxY; y >= win.minY; y--) {
      for (x = win.minX; x <= win.maxX; x++) {
        gx = x - win.minX;
        gy = win.maxY - y;
        key = x + ',' + y;
        cls = tints.spawn[key] || '';
        ft = tints.footTint[key] || '';
        cellsHtml += '<div class="mls-cell' + (cls ? ' ' + cls : '') + (ft ? ' ' + ft : '') +
          cellAuraClass(key) +
          '" data-xy="' + key + '" style="grid-column:' + (gx + 1) + ';grid-row:' + (gy + 1) + '"></div>';
      }
    }
    var tokenLayer = host.querySelector('.mls-token-layer');
    var keepTokens = tokenLayer ? tokenLayer.innerHTML : '';
    host.innerHTML = cellsHtml +
      '<div class="mls-token-layer">' + keepTokens + '</div>' +
      '<div class="mls-fx-layer"></div>';
    host.setAttribute('data-layout', win.minX + ':' + win.maxX + ':' + win.minY + ':' + win.maxY);
  }

  function refreshCellTints(host, mapCells) {
    var tints = buildSpawnTints();
    var mapSet = {};
    _areaAuraState = null;
    (mapCells || []).forEach(function (c) {
      if (c) mapSet[(c.x | 0) + ',' + (c.y | 0)] = 1;
    });
    Array.prototype.forEach.call(host.querySelectorAll('.mls-cell'), function (el) {
      var key = el.getAttribute('data-xy') || '';
      var cls = tints.spawn[key] || '';
      var ft = tints.footTint[key] || '';
      var nextCellCls = 'mls-cell' + (cls ? ' ' + cls : '') + (ft ? ' ' + ft : '') +
        cellAuraClass(key) + (mapSet[key] ? ' is-map-aoe' : '');
      if (el.className !== nextCellCls) el.className = nextCellCls;
    });
  }

  function flipTokenTo(el, nextTransform, animate, durationMs) {
    var first, last, dx, dy, ms;
    /* Stationary tokens must not force layout. FLIP measures only when actually moving. */
    if (!animate) {
      el.style.transition = 'none';
      el.style.left = el._mlsLeft;
      el.style.top = el._mlsTop;
      el.style.width = el._mlsW;
      el.style.height = el._mlsH;
      el.style.transform = nextTransform || 'translate3d(0,0,0)';
      return;
    }
    first = el.getBoundingClientRect();
    el.style.left = el._mlsLeft;
    el.style.top = el._mlsTop;
    el.style.width = el._mlsW;
    el.style.height = el._mlsH;
    last = el.getBoundingClientRect();
    dx = first.left - last.left;
    dy = first.top - last.top;
    ms = durationMs != null ? durationMs : Math.max(180, stepDelay('move'));
    el.style.transition = 'none';
    el.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    void el.offsetWidth;
    el.style.transition = 'transform ' + ms + 'ms var(--mls-move-ease)';
    el.style.transform = nextTransform || 'translate3d(0,0,0)';
  }

  /**
   * Same-cell cover / shelter slides — ease from the live computed transform.
   * FLIP was jerky here: clearing transform teleported the token home before the tween.
   */
  function easeTokenTransform(el, nextTransform, animate, durationMs) {
    var cur, ms;
    if (!el) return;
    el.style.left = el._mlsLeft;
    el.style.top = el._mlsTop;
    el.style.width = el._mlsW;
    el.style.height = el._mlsH;
    ms = durationMs != null ? durationMs : 380;
    if (!animate || skipAll) {
      el.style.transition = 'none';
      el.style.transform = nextTransform || 'translate3d(0,0,0)';
      return;
    }
    try { cur = window.getComputedStyle(el).transform; } catch (e1) { cur = ''; }
    el.style.transition = 'none';
    if (cur && cur !== 'none') el.style.transform = cur;
    void el.offsetWidth;
    el.style.transition = 'transform ' + ms + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
    el.style.transform = nextTransform || 'translate3d(0,0,0)';
  }

  /** Cancel a pending SD homeward step (re-cover / new fight). */
  function cancelCoverReturn(el) {
    if (!el) return;
    el._mlsCoverReturnGen = (el._mlsCoverReturnGen | 0) + 1;
    el._mlsCoverHold = 0;
    el._mlsCoverReturnScheduled = false;
  }

  /** gge playDefendCoverAnim — ease home from cover cell (no teleport). */
  function forceCoverHome(el, animate) {
    if (!el) return;
    cancelCoverReturn(el);
    el.classList.remove('is-covering', 'is-hit', 'is-crit-flash');
    el.style.removeProperty('--mls-cover-x');
    el.style.removeProperty('--mls-cover-y');
    easeTokenTransform(el, 'translate3d(0,0,0)', !!animate && !skipAll, stepDelay('cover-return'));
  }

  /** KO tokens fade out then leave the map (no lingering greyscale corpses). */
  function markTokenGone(el) {
    if (!el || el._mlsGone) return;
    el._mlsGone = true;
    el.classList.add('is-dead');
    el.classList.remove('is-active', 'is-attacker', 'is-target', 'is-covering', 'is-hit');
    setTimeout(function () {
      if (!el.parentNode) return;
      el.classList.add('is-gone');
      el.setAttribute('aria-hidden', 'true');
    }, skipAll ? 0 : Math.max(180, Math.round(420 / battlePaceMul())));
  }

  function syncTokens(host, win, floatEvt, linkEvt, animate) {
    var layer = host.querySelector('.mls-token-layer');
    if (!layer) return;
    var atkId = linkEvt && linkEvt.fromId;
    var tgtId = linkEvt && linkEvt.toId;
    var supportId = linkEvt && linkEvt.supportId;
    var seen = {};
    /*
     * Do NOT gate on prefers-reduced-motion. iOS Accessibility → Reduce Motion is
     * commonly on and was skipping muzzle / trail / shot / impact entirely, so
     * mobile fights only showed damage numbers after the fact (desktop looked fine).
     * Combat readability > OS motion preference on this board.
     */
    var doAnim = !!animate && !skipAll;

    lastAlly.concat(lastEnemy).forEach(function (u) {
      var key = tokenKey(u);
      var origin = footprintOrigin(u);
      var span = u.isLarge ? 2 : 1;
      var mark = '';
      var fx = { badge: '', hit: false, crit: !!(floatEvt && floatEvt.crit && tgtId && String(u.id) === String(tgtId)) };
      var el, cover, shelter, nextTf, badge, badgeEl, hpCur, hpGhost, hpNum, hpWrap;
      var maxHp, hp, ghost, pct, ghostPct, ten, thumEl, frameEl;
      var stillCovering, isCoverReturn, isHeal;
      seen[key] = 1;
      /* Keep SD on the cover cell for support-def AND the following hit (gge). */
      if (supportId && String(u.id) === String(supportId) && linkEvt && linkEvt.coverTo &&
          linkEvt.kind !== 'cover-return') {
        u.covering = true;
        u.coverTx = linkEvt.coverTo.x;
        u.coverTy = linkEvt.coverTo.y;
      }
      if (atkId && String(u.id) === String(atkId)) mark = 'attacker';
      else if (tgtId && String(u.id) === String(tgtId)) { mark = 'target'; fx.hit = !!(floatEvt && floatEvt.text); }
      else if (u.active) mark = 'attacker';
      if (linkEvt && linkEvt.kind === 'cover-return' && supportId && String(u.id) === String(supportId)) {
        fx.badge = '';
      } else if (supportId && String(u.id) === String(supportId)) {
        /* Opening SD float is enough — no lingering SD/SA chip on the cover unit. */
        fx.badge = (linkEvt.kind === 'support' && !linkEvt.coverTo) ? 'S.ATK' : '';
      } else if (linkEvt && linkEvt.kind === 'support' && atkId && String(u.id) === String(atkId)) {
        fx.badge = 'S.ATK';
      } else if (u.badge && u.badge !== 'S.DEF') {
        fx.badge = u.badge;
      }

      el = layer.querySelector('[data-token-key="' + key + '"]');
      if (!el) {
        /* Linger KO stays on the map until Counter finishes; otherwise never spawn a corpse. */
        if ((u.hp | 0) <= 0 && !u.lingerKo) return;
        layer.insertAdjacentHTML('beforeend', unitTokenHtml(u, cellPctBox(win, origin.x, origin.y, span, span), mark, fx));
        return;
      }

      if ((u.hp | 0) <= 0 && !u.lingerKo) {
        cancelCoverReturn(el);
        markTokenGone(el);
        return;
      }
      if (el._mlsGone) {
        el._mlsGone = false;
        el.classList.remove('is-gone', 'is-dead');
        el.removeAttribute('aria-hidden');
      }
      if (u.lingerKo && (u.hp | 0) <= 0) {
        el.classList.add('is-ko-linger');
        el.classList.remove('is-dead', 'is-gone');
        el.removeAttribute('aria-hidden');
        el._mlsGone = false;
      } else {
        el.classList.remove('is-ko-linger');
      }

      el._mlsLeft = ((origin.x - win.minX) / win.cols * 100) + '%';
      el._mlsTop = ((win.maxY - origin.y) / win.rows * 100) + '%';
      el._mlsW = (span / win.cols * 100) + '%';
      el._mlsH = (span / win.rows * 100) + '%';

      cover = coverOffsetPx(u);
      shelter = shelterOffsetPx(u);
      stillCovering = !!(u.covering && (cover.x || cover.y));
      isCoverReturn = !!(linkEvt && linkEvt.kind === 'cover-return' &&
        supportId && String(u.id) === String(supportId));
      if (stillCovering) {
        nextTf = 'translate3d(' + cover.x + 'px,' + cover.y + 'px,0) scale(1.12)';
      } else if (shelter.x || shelter.y) {
        nextTf = 'translate3d(' + shelter.x + 'px,' + shelter.y + 'px,0)';
      } else {
        nextTf = 'translate3d(0,0,0)';
      }

      if (isCoverReturn) {
        /* Explicit homeward step — ease from cover translate (no FLIP teleport). */
        forceCoverHome(el, doAnim);
      } else if (stillCovering) {
        cancelCoverReturn(el);
        el.style.setProperty('--mls-cover-x', cover.x + 'px');
        el.style.setProperty('--mls-cover-y', cover.y + 'px');
        el.style.removeProperty('--mls-shelter-x');
        el.style.removeProperty('--mls-shelter-y');
        if (doAnim && !el.classList.contains('is-covering')) {
          easeTokenTransform(el, nextTf, true, stepDelay('cover-return'));
        } else {
          el.style.transition = 'none';
          el.style.setProperty('transform', nextTf, 'important');
          el.style.left = el._mlsLeft;
          el.style.top = el._mlsTop;
          el.style.width = el._mlsW;
          el.style.height = el._mlsH;
        }
      } else {
        var wasSheltered = el.classList.contains('is-sheltered');
        var wasCovering = el.classList.contains('is-covering');
        var shelterMotion = wasSheltered || wasCovering || isCoverReturn || !!(shelter.x || shelter.y);
        if (wasCovering) forceCoverHome(el, doAnim);
        if (shelter.x || shelter.y) {
          el.style.setProperty('--mls-shelter-x', shelter.x + 'px');
          el.style.setProperty('--mls-shelter-y', shelter.y + 'px');
        } else {
          el.style.removeProperty('--mls-shelter-x');
          el.style.removeProperty('--mls-shelter-y');
        }
        /* Target backup + resume with SD return / SD KO — smooth ease, not FLIP. */
        if (shelterMotion) {
          easeTokenTransform(el, nextTf, doAnim, stepDelay('cover-return'));
        } else {
          flipTokenTo(el, nextTf, false);
        }
      }

      var nextTokCls = 'mls-token' + (u.isLarge ? ' is-large' : '') + ' ' + (u.side === 'ally' ? 'ally' : 'enemy') +
        (u.active ? ' is-active' : '') +
        (mark === 'attacker' ? ' is-attacker' : '') + (mark === 'target' ? ' is-target' : '') +
        (fx.hit ? ' is-hit' : '') + (fx.crit ? ' is-crit-flash' : '') +
        (stillCovering ? ' is-covering' : '') +
        ((u.sheltered && !stillCovering) ? ' is-sheltered' : '');
      if (el.className !== nextTokCls) el.className = nextTokCls;
      el.setAttribute('data-side', u.side || '');
      el.setAttribute('data-slot-idx', String(u.slotIdx | 0));
      el.setAttribute('title', fightBusy ? '' : 'Drag to set start cell');
      /* Slot reorder (AI Search) keeps the cell key — swap the portrait to the unit now standing there. */
      if (String(el.getAttribute('data-unit-id') || '') !== String(u.id)) {
        el.setAttribute('data-unit-id', String(u.id));
      }
      /* Always refresh portrait — stale/empty src was leaving blank thumbs after racey paints. */
      thumEl = el.querySelector('.mls-token-thum');
      if (u.thum) {
        if (!thumEl) {
          frameEl = el.querySelector('.mls-token-frame');
          if (frameEl) {
            frameEl.insertAdjacentHTML(
              'afterbegin',
              '<img class="mls-token-thum" src="' + esc(u.thum) + '" alt="' + esc(u.name || '') +
                '" loading="eager" decoding="async" fetchpriority="high">'
            );
          }
        } else {
          if (thumEl.getAttribute('src') !== u.thum) thumEl.src = u.thum;
          if (thumEl.alt !== (u.name || '')) thumEl.alt = u.name || '';
        }
      }
      syncTopMarksEl(el, u);

      maxHp = Math.max(1, u.maxHp | 0);
      hp = Math.max(0, u.hp | 0);
      ghost = u.ghostHp != null ? (u.ghostHp | 0) : hp;
      isHeal = hp > ghost;
      /* Damage: white ghost ≥ cur. Heal: ghost holds old while cur climbs to new. */
      pct = Math.max(0, Math.min(100, Math.round(100 * hp / maxHp)));
      ghostPct = Math.max(0, Math.min(100, Math.round(100 * (isHeal ? hp : Math.max(hp, ghost)) / maxHp)));
      hpWrap = el.querySelector('.mls-token-hp');
      hpCur = el.querySelector('.mls-hp-cur');
      hpGhost = el.querySelector('.mls-hp-ghost');
      hpNum = el.querySelector('.mls-token-hpnum');
      if (hpWrap) {
        if (isHeal && doAnim) {
          hpWrap.classList.add('is-healing');
          if (hpCur) {
            /* Seed at old HP, then fill up (vertical side bar). */
            hpCur.style.transition = 'none';
            hpCur.style.transform = 'scaleY(' + (Math.max(0, Math.min(100, Math.round(100 * ghost / maxHp))) / 100) + ')';
            void hpCur.offsetWidth;
            hpCur.style.transform = 'scaleY(' + (pct / 100) + ')';
          }
          if (hpGhost) hpGhost.style.transform = 'scaleY(' + (pct / 100) + ')';
        } else {
          hpWrap.classList.remove('is-healing');
          if (hpCur) {
            hpCur.style.transition = '';
            hpCur.style.transform = 'scaleY(' + (pct / 100) + ')';
          }
          if (hpGhost) hpGhost.style.transform = 'scaleY(' + (ghostPct / 100) + ')';
        }
      }
      if (hpNum) {
        var hpLabel = fmtNum(hp);
        if (hpNum.textContent !== hpLabel) hpNum.textContent = hpLabel;
      }
      syncVigorHudEl(el, u);
      syncAuraDebuffEl(el, u);
      syncSupportStockEl(el, u);

      badge = fx.badge || u.badge || '';
      badgeEl = el.querySelector('.mls-token-badge');
      if (badge) {
        if (!badgeEl) {
          badgeEl = document.createElement('span');
          el.insertBefore(badgeEl, el.firstChild);
        }
        badgeEl.outerHTML = badgeChipHtml(badge, fx.badgeText || u.badgeText || '', fx.badgeIcon || u.badgeIcon || '');
      } else if (badgeEl && badgeEl.parentNode) {
        badgeEl.parentNode.removeChild(badgeEl);
      }
    });

    Array.prototype.forEach.call(layer.querySelectorAll('.mls-token'), function (el) {
      var k = el.getAttribute('data-token-key');
      if (!seen[k] && el.parentNode) el.parentNode.removeChild(el);
    });

    /* Attack FX: no arrows. Ranged → damage-number pop; melee → hit-stop + impact (no ghost trail). */
    if (doAnim && linkEvt && linkEvt.from && linkEvt.to &&
        linkEvt.kind !== 'support-def' && linkEvt.kind !== 'cover-return' &&
        linkEvt.kind !== 'chance-step' && linkEvt.kind !== 'move') {
      playAttackFx(host, win, linkEvt, layer, atkId, tgtId);
    }
  }

  /** Impact ring at cell — Takayu impact flash without afterimage clones. */
  function spawnImpactBurst(host, win, cellPos, side, crit) {
    var layer = host && host.querySelector('.mls-fx-layer');
    var cell = mapCellPx || 40;
    var burst;
    if (!layer || !cellPos) return;
    burst = document.createElement('div');
    burst.className = 'mls-impact-burst' +
      (side === 'enemy' ? ' is-enemy' : ' is-ally') +
      (crit ? ' is-crit' : '');
    burst.style.left = (((cellPos.x - win.minX) + 0.5) * cell) + 'px';
    burst.style.top = (((win.maxY - cellPos.y) + 0.5) * cell) + 'px';
    layer.appendChild(burst);
    /* Same iOS insert→keyframe timing as damage floats. */
    void burst.offsetWidth;
    burst.classList.add('is-play');
    setTimeout(function () {
      if (burst.parentNode) burst.parentNode.removeChild(burst);
    }, 420);
  }

  /** Ranged fire: muzzle + recoil + traveling shot, then impact (damage float stays Takayu). */
  function playRangedFire(host, win, linkEvt, layer, atkId) {
    var cell = mapCellPx || 40;
    var fxLayer = host && host.querySelector('.mls-fx-layer');
    var side = linkEvt.side === 'enemy' ? 'enemy' : 'ally';
    var crit = !!(linkEvt && linkEvt.crit);
    var x1, y1, x2, y2, dx, dy, dist, ang, flightMs, atkEl, rx, ry, muzzle, trail, shot;
    if (!fxLayer || !linkEvt.from || !linkEvt.to) {
      spawnImpactBurst(host, win, linkEvt && linkEvt.to, side, crit);
      return;
    }
    x1 = ((linkEvt.from.x - win.minX) + 0.5) * cell;
    y1 = ((win.maxY - linkEvt.from.y) + 0.5) * cell;
    x2 = ((linkEvt.to.x - win.minX) + 0.5) * cell;
    y2 = ((win.maxY - linkEvt.to.y) + 0.5) * cell;
    dx = x2 - x1;
    dy = y2 - y1;
    dist = Math.sqrt(dx * dx + dy * dy) || 1;
    ang = Math.atan2(dy, dx) * 180 / Math.PI;
    flightMs = rangedFlightMs(dist);

    /* Shooter kick — briefly recoil away from the target, then settle. */
    atkEl = layer && layer.querySelector('[data-unit-id="' + String(atkId) + '"]');
    if (atkEl && !atkEl.classList.contains('is-covering')) {
      rx = -(dx / dist) * cell * 0.2;
      ry = -(dy / dist) * cell * 0.2;
      atkEl.classList.add('is-ranged-fire');
      atkEl.style.transition = 'transform 70ms cubic-bezier(0.2, 0, 0, 1)';
      atkEl.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
      setTimeout(function () {
        if (!atkEl.parentNode) return;
        atkEl.style.transition = 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)';
        atkEl.style.transform = 'translate3d(0,0,0)';
        setTimeout(function () {
          if (atkEl.parentNode) atkEl.classList.remove('is-ranged-fire');
        }, 260);
      }, 80);
    }

    muzzle = document.createElement('div');
    muzzle.className = 'mls-muzzle-flash is-' + side + (crit ? ' is-crit' : '');
    muzzle.style.left = x1 + 'px';
    muzzle.style.top = y1 + 'px';
    fxLayer.appendChild(muzzle);
    void muzzle.offsetWidth;
    muzzle.classList.add('is-play');

    trail = document.createElement('div');
    trail.className = 'mls-ranged-trail is-' + side + (crit ? ' is-crit' : '');
    trail.style.left = x1 + 'px';
    trail.style.top = y1 + 'px';
    trail.style.width = Math.max(1, dist) + 'px';
    trail.style.transform = 'rotate(' + ang + 'deg) scaleX(0)';
    fxLayer.appendChild(trail);
    void trail.offsetWidth;
    trail.style.transform = 'rotate(' + ang + 'deg) scaleX(1)';
    trail.classList.add('is-on');

    shot = document.createElement('div');
    shot.className = 'mls-ranged-shot is-' + side + (crit ? ' is-crit' : '');
    shot.style.left = x1 + 'px';
    shot.style.top = y1 + 'px';
    fxLayer.appendChild(shot);
    void shot.offsetWidth;
    shot.style.transition = 'transform ' + flightMs + 'ms linear';
    shot.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';

    setTimeout(function () {
      if (muzzle.parentNode) muzzle.parentNode.removeChild(muzzle);
    }, 260);
    setTimeout(function () {
      if (trail.parentNode) {
        trail.classList.add('is-fade');
        setTimeout(function () {
          if (trail.parentNode) trail.parentNode.removeChild(trail);
        }, 120);
      }
      if (shot.parentNode) shot.parentNode.removeChild(shot);
      spawnImpactBurst(host, win, linkEvt.to, side, crit);
    }, flightMs);
  }

  /**
   * Ranged: fire motion + Takayu damage-number float.
   * Melee: catalog-game-impact-fx-hit-stop — brief freeze+jitter on target, no ghost trait.
   */
  function playAttackFx(host, win, linkEvt, layer, atkId, tgtId) {
    var atkEl, tgtEl, lx, ly, holdMs, crit;
    crit = !!(linkEvt && linkEvt.crit);
    if (linkEvt.ranged) {
      playRangedFire(host, win, linkEvt, layer, atkId);
      return;
    }
    atkEl = layer && layer.querySelector('[data-unit-id="' + String(atkId) + '"]');
    tgtEl = layer && layer.querySelector('[data-unit-id="' + String(tgtId) + '"]');
    if (atkEl && !atkEl.classList.contains('is-covering')) {
      lx = ((linkEvt.to.x - linkEvt.from.x) * 0.22 * mapCellPx);
      ly = ((linkEvt.from.y - linkEvt.to.y) * 0.22 * mapCellPx);
      atkEl.classList.add('is-lunge');
      atkEl.style.transition = 'transform 90ms cubic-bezier(0.2, 0, 0, 1)';
      atkEl.style.transform = 'translate3d(' + lx + 'px,' + ly + 'px,0)';
      holdMs = Math.round((crit ? 140 : 80) / battlePaceMul());
      setTimeout(function () {
        if (!atkEl.parentNode) return;
        /* Hit-stop hold on attacker at contact, then ease back. */
        atkEl.style.transition = 'none';
        void atkEl.offsetWidth;
        setTimeout(function () {
          if (!atkEl.parentNode) return;
          atkEl.style.transition = 'transform ' + Math.round(200 / battlePaceMul()) +
            'ms cubic-bezier(0.22, 1, 0.36, 1)';
          atkEl.style.transform = 'translate3d(0,0,0)';
          atkEl.classList.remove('is-lunge');
        }, holdMs);
      }, Math.round(80 / battlePaceMul()));
    }
    if (tgtEl && !tgtEl.classList.contains('is-covering')) {
      tgtEl.classList.remove('is-hit-stop');
      void tgtEl.offsetWidth;
      tgtEl.classList.add('is-hit-stop');
      setTimeout(function () {
        if (tgtEl.parentNode) tgtEl.classList.remove('is-hit-stop');
      }, Math.round((crit ? 280 : 220) / battlePaceMul()));
    }
    spawnImpactBurst(host, win, linkEvt.to, linkEvt.side, crit);
  }

  function paintBoard(floatEvt, linkEvt, animate) {
    var host = document.getElementById('mlsBoard');
    var mapCells;
    if (!host || !board) return;
    var win = computeMapWindow();
    var layoutKey = win.minX + ':' + win.maxX + ':' + win.minY + ':' + win.maxY;
    mapOrigin = { minX: win.minX, minY: win.minY };
    _areaAuraState = null;
    mapCells = (linkEvt && linkEvt.kind === 'map-aoe' && linkEvt.cells) ? linkEvt.cells : null;
    fitMapCell(win);
    applyMapBackground(host, win);
    if (host.getAttribute('data-layout') !== layoutKey || !host.querySelector('.mls-token-layer')) {
      rebuildCellGrid(host, win);
      if (mapCells) refreshCellTints(host, mapCells);
    } else {
      refreshCellTints(host, mapCells);
    }
    syncTokens(host, win, floatEvt, linkEvt, !!animate);
    if (floatEvt && (floatEvt.text || floatEvt.badge || floatEvt.icon || floatEvt.csIcon)) {
      /* Ranged: hold the damage number until the shot lands (matches fire → impact). */
      var floatDelay = 0;
      var fdx, fdy, fdist;
      if (animate && linkEvt && linkEvt.ranged && linkEvt.from && linkEvt.to) {
        fdx = ((linkEvt.to.x - linkEvt.from.x) * (mapCellPx || 40));
        fdy = ((linkEvt.from.y - linkEvt.to.y) * (mapCellPx || 40));
        fdist = Math.sqrt(fdx * fdx + fdy * fdy);
        floatDelay = rangedFlightMs(fdist);
      }
      if (floatDelay) {
        setTimeout(function () { spawnFloat(floatEvt, win); }, floatDelay);
      } else {
        spawnFloat(floatEvt, win);
      }
    }
  }

  function spawnFloat(ev, win) {
    var host = document.getElementById('mlsBoard');
    var layer = host && host.querySelector('.mls-fx-layer');
    var icon, isDmg, lab;
    if (!host || !layer || !ev) return;
    var w = win || computeMapWindow();
    var el = document.createElement('div');
    var sideCls = '';
    isDmg = !!(ev.cls && String(ev.cls).indexOf('mls-float--heal') < 0 &&
      String(ev.cls).indexOf('mls-float--skill') < 0 && String(ev.cls).indexOf('mls-float--support') < 0);
    if (isDmg) {
      dmgFloatSide = 1 - dmgFloatSide;
      sideCls = dmgFloatSide ? ' is-right' : ' is-left';
    }
    el.className = 'mls-float' + sideCls + (ev.cls ? ' ' + ev.cls : '');
    icon = floatIconUrl(ev);
    lab = floatLabelText(ev) || ev.text || '';
    if (icon && !isDmg) {
      /* Asset + wording (skill name / SD / SA / …) — never icon-only. */
      el.className += ' is-chip-float';
      el.innerHTML = floatChipIconHtml(ev) +
        '<span class="mls-float-lab">' + esc(lab) + '</span>';
    } else if (icon) {
      el.innerHTML = floatChipIconHtml(ev) +
        '<span>' + esc(ev.text) + '</span>';
    } else {
      el.textContent = lab;
    }
    el.style.cssText = cellPctBox(w, ev.x | 0, ev.y | 0, 1, 1) + ';display:flex;align-items:center;justify-content:center;gap:4px';
    layer.appendChild(el);
    /* iOS Safari often skips a keyframe that starts in the same frame as insert. */
    void el.offsetWidth;
    el.classList.add('is-play');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1100);
  }

  var orderRefreshTimer = null;

  function scheduleOrderRefresh() {
    if (orderRefreshTimer) clearTimeout(orderRefreshTimer);
    orderRefreshTimer = setTimeout(function () {
      orderRefreshTimer = null;
      if (fightBusy) {
        paintTimeline();
        return;
      }
      loadArmies().then(function () {
        paintTimeline();
        if (viewName === 'battle') paintBoard();
      }).catch(function () { paintTimeline(); });
    }, 80);
  }

  /** Stable keys for the map turn-order strip (locked per fight turn). */
  var timelinePhaseKeys = null;

  function unitTlKey(u) {
    if (!u) return '';
    return String(u.side || '') + ':' + String(u.n != null ? u.n : (u.slotIdx | 0));
  }

  function clearTimelinePhase() {
    timelinePhaseKeys = null;
  }

  /** Lock strip to this turn’s action order (alive at turn start); KO mid-turn stays faded. */
  function lockTimelinePhase(allies, enemies) {
    var R = rules();
    var pool = (allies || []).concat(includeEnemyOrder() ? (enemies || []) : []);
    var order;
    if (!R) {
      timelinePhaseKeys = null;
      return;
    }
    order = R.actionOrder(pool);
    timelinePhaseKeys = order.map(unitTlKey).filter(Boolean);
  }

  function paintTimeline(opts) {
    var battleOnly = !!(opts && opts.battleOnly);
    var hosts = [
      document.getElementById('mlsTimeline'),
      battleOnly ? null : document.getElementById('mlsFormOrder')
    ].filter(Boolean);
    var R = rules();
    var pool, order, html, parts, byKey, spdFn;
    if (!hosts.length) return;
    function commitTimeline(nextHtml) {
      var sig = (battleOnly ? 'b:' : 'f:') + nextHtml;
      if (sig === timelinePaintSig) return;
      timelinePaintSig = sig;
      hosts.forEach(function (h) { h.innerHTML = nextHtml; });
    }
    if (!R || (!lastAlly.length && !lastEnemy.length)) {
      html = '<span class="mls-tl-empty">' + esc(mlsT('mls_order_empty',
        'Pick units — order is unit Mobility + pilot Reaction (high → low).')) + '</span>';
      commitTimeline(html);
      return;
    }
    pool = lastAlly.slice();
    if (includeEnemyOrder()) pool = pool.concat(lastEnemy);
    pool = pool.filter(Boolean);
    spdFn = R.unitOrderSpeed || function (u) {
      return (u.mobility | 0) + (u.reaction | 0);
    };
    if (timelinePhaseKeys && timelinePhaseKeys.length) {
      byKey = Object.create(null);
      pool.forEach(function (u) { byKey[unitTlKey(u)] = u; });
      order = timelinePhaseKeys.map(function (k) { return byKey[k]; }).filter(Boolean);
    } else if (R.displayOrder) {
      order = R.displayOrder(pool);
    } else {
      order = R.actionOrder(pool);
    }
    if (!order.length) {
      html = '<span class="mls-tl-empty">' + esc(mlsT('mls_order_empty',
        'Pick units — order is unit Mobility + pilot Reaction (high → low).')) + '</span>';
    } else {
      parts = [];
      order.forEach(function (u, i) {
        var mobPart = u._spdMob != null ? (u._spdMob | 0) : (u.mobility | 0);
        var reactPart = u._spdReact != null ? (u._spdReact | 0) : (u.reaction | 0);
        var spd = spdFn(u);
        var nm = String(u.name || '').replace(/\s*\(EX\)\s*$/i, '').slice(0, 14);
        var dead = (u.hp | 0) <= 0;
        var active = !!u.active && !dead;
        if (i) parts.push('<span class="mls-tl-arrow" aria-hidden="true">→</span>');
        parts.push(
          '<span class="mls-tl-chip ' + (u.side === 'enemy' ? 'enemy' : 'ally') +
          (dead ? ' is-dead' : '') +
          (active ? ' is-active' : '') +
          '" title="Mobility ' + mobPart + ' + Reaction ' + reactPart + ' = ' + spd + '">' +
          '<span class="mls-tl-n">' + (i + 1) + '</span>' +
          '<span class="mls-tl-body">' +
          (u.thum ? '<img src="' + esc(u.thum) + '" alt="">' : '') +
          '<span class="mls-tl-meta">' +
          '<span class="mls-tl-name">' + esc(nm) + '</span>' +
          '<span class="mls-tl-spd">' + spd + '</span>' +
          '</span></span></span>'
        );
      });
      html = parts.join('');
    }
    commitTimeline(html);
  }

  function cloneArmy(list) {
    return list.map(function (u) {
      var kit = u.pilotSkills || (rules() && rules().buildPilotSkillKit && rules().buildPilotSkillKit(u.char)) || { list: [], sp: 5 };
      var sp = u.sp != null ? (u.sp | 0) : Math.max(5, kit.sp | 0);
      /* Playback must start as the deployed form — not the post-Escape morph left on result.allies. */
      var base = u._formBase || captureFormBase(u);
      var wpnSrc = (base && base.weapons && base.weapons.length) ? base.weapons : (u.weapons || []);
      var maxHp = (base && base.maxHp) ? (base.maxHp | 0) : (u.maxHp | 0);
      var maxEn = (base && base.maxEn != null) ? (base.maxEn | 0) : (u.maxEn | 0);
      var Rclone = rules();
      var startMp = 0;
      var cloned;
      /* Seed start MP from the same passives as makeActor (Affinity MP +6 → High, …). */
      cloned = {
        side: u.side, n: u.n, slotIdx: u.slotIdx | 0,
        x: u.homeX != null ? u.homeX : u.x, y: u.homeY != null ? u.homeY : u.y,
        homeX: u.homeX != null ? u.homeX : u.x, homeY: u.homeY != null ? u.homeY : u.y,
        id: (base && base.id) || u.id,
        name: (base && base.name) || u.name,
        thum: (base && base.thum) || u.thum,
        roleIcon: u.roleIcon, lb: u.lb,
        hp: maxHp, maxHp: maxHp, ghostHp: maxHp,
        maxEn: maxEn, currentEn: maxEn,
        mobility: (base && base.mobility != null) ? (base.mobility | 0) : u.mobility,
        _spdMob: (base && base._spdMob != null) ? (base._spdMob | 0)
          : (u._spdMob != null ? (u._spdMob | 0) : (u.mobility | 0)),
        _spdReact: (base && base._spdReact != null) ? (base._spdReact | 0)
          : (u._spdReact != null ? (u._spdReact | 0) : (u.reaction | 0)),
        baseMove: (base && base.baseMove != null) ? (base.baseMove | 0)
          : (u.baseMove != null ? (u.baseMove | 0) : (u.move | 0)),
        move: (base && base.move != null) ? (base.move | 0) : u.move,
        fieldTerrain: u.fieldTerrain || String((seasonMeta && seasonMeta.terrain_primary) || ''),
        terrainMoveFactor: u.terrainMoveFactor != null ? u.terrainMoveFactor : 1,
        occupancyMode: u.occupancyMode || '',
        reaction: u.reaction,
        mp: 0,
        tension: 0,
        weapons: wpnSrc.map(function (w) {
          return {
            raw: w.raw, name: w.name, icon: w.icon || '', icon_color: w.icon_color || '',
            min_range: w.min_range, max_range: w.max_range, power: w.power,
            en: w.en | 0, en_cost: w.en_cost | 0, ammo: w.ammo | 0, accuracy: w.accuracy | 0, critical: w.critical | 0,
            is_ex: !!w.is_ex, is_ssp_weapon: !!w.is_ssp_weapon,
            is_map: !!w.is_map, is_map_weapon: !!w.is_map_weapon, is_preemptive: !!w.is_preemptive,
            traits: (w.traits || []).slice(), usage_restrictions: (w.usage_restrictions || []).slice(),
            map_coords: (w.map_coords || []).slice(), shooting_coords: (w.shooting_coords || []).slice(),
            map_single_pou: !!w.map_single_pou, attribute: w.attribute || '', weapon_type: w.weapon_type || ''
          };
        }),
        unit: (base && base.unit) || u.unit, char: u.char,
        optionParts: (u.optionParts || []).slice(),
        supporter: u.supporter || null,
        isLarge: !!(base ? base.isLarge : u.isLarge),
        size: (base && base.size != null) ? (base.size | 0)
          : (u.size != null ? (u.size | 0) : (u.isLarge ? 2 : 1)),
        direction: u.direction != null ? u.direction : sideFacing(u.side),
        unitStatMode: (base && base.unitStatMode) || u.unitStatMode,
        charStatMode: u.charStatMode || 'normal', owned: u.owned,
        pilotSkills: kit,
        sp: sp,
        currentSp: sp,
        sdLimit: u.sdLimit != null ? (u.sdLimit | 0) : (rules() && rules().supportDefendLimit ? rules().supportDefendLimit(u) : 0),
        sdRangeBonus: u.sdRangeBonus | 0,
        usedSupportDefendCount: 0,
        usedSupportCount: 0,
        saLimit: u.saLimit | 0,
        battleSupportDefendedCount: 0,
        skillUsed: false,
        usedSkillThisTurn: false,
        forceGuard: false,
        unconditionalCSStock: 0,
        hasAcquiredUnconditionalCS: false,
        hasUsedFreeAmmoSkillInBattle: false,
        _escapeUsed: false,
        _formBase: base,
        activeSkills: [],
        debuffs: [],
        chanceStepsLeft: chanceStepLimit(u),
        autoCsLeft: 0,
        active: false,
        badge: '',
        badgeText: '',
        badgeIcon: '',
        skillMarkIcon: '',
        skillMarkText: ''
      };
      startMp = (Rclone && Rclone.startingMpBonus) ? (Rclone.startingMpBonus(cloned) | 0) : 0;
      /* Prefer live board MP when already seeded (makeActor); never wipe Affinity/etc. to 0. */
      if ((u.mp | 0) > startMp) startMp = u.mp | 0;
      cloned.mp = Math.max(0, Math.min(12, startMp));
      cloned.tension = Math.min(100, Math.round((cloned.mp / 12) * 100));
      return cloned;
    });
  }

  function occupiedMap(allies, enemies, except) {
    var o = {};
    allies.concat(enemies).forEach(function (u) {
      if (!u || u.hp <= 0 || u === except) return;
      footprintCells(u).forEach(function (c) {
        o[c.x + ',' + c.y] = u;
      });
    });
    return o;
  }

  /** Full map bounds for BFS (camera window is separate). */
  function pathBounds() {
    var m = mapMeta();
    if ((m.width | 0) > 0 && (m.height | 0) > 0) {
      return { minX: 0, maxX: (m.width | 0) - 1, minY: 0, maxY: (m.height | 0) - 1 };
    }
    var win = computeMapWindow();
    return { minX: win.minX, maxX: win.maxX, minY: win.minY, maxY: win.maxY };
  }

  /** Turn a planned unit skill on. Damage math stays in /cal. */
  function applyPlannedUnitSkill(actor, phase, friends, turn, snapshotLine) {
    var plan, R, val, rMin, rMax, allyN, cands, picked, note;
    R = rules();
    if (!R || !R.planUnitSkill) return;
    plan = R.planUnitSkill(actor, phase);
    if (!plan) return;
    actor.hasUsedUnitSkill = true;
    actor.turnBuffActive = !!(plan.atkPct || plan.defPct || plan.mobPct);
    /* Sticky icon above thum for the rest of the fight (not cleared with turn badges). */
    actor.skillMarkText = String(plan.name || 'SKILL').replace(/\s+LV\s*\d+/i, '');
    actor.skillMarkIcon = plan.icon || skillBadgeIconUrl();
    actor.badge = 'SKILL';
    actor.badgeText = actor.skillMarkText;
    actor.badgeIcon = actor.skillMarkIcon;
    if (plan.mp > 0) applyMpDelta(actor, plan.mp);
    if (plan.move > 0) actor.move = (actor.move | 0) + plan.move;
    if (plan.firstStrike) {
      actor.hasFirstStrikeBarrier = true;
      /* F91 EX: MOB% lasts until Initial Null expires — keep turnBuff tied to stock. */
      if ((plan.mobPct | 0) > 0) actor._mobUntilInitialNull = true;
    }
    if (plan.beamDr > 0) actor.unitSkillBeamDr = plan.beamDr;
    if (plan.barrierPct > 0) {
      /*
       * Type-6 barrier: pool = caster Max HP × pct (in-game “this unit’s Max HP”).
       * Applies to self + up to N allies in MultiTarget range — pick lowest current HP
       * when several are in range (Nu EX: range 0–3 / allies 1–3, count 1).
       */
      val = Math.floor((actor.maxHp | 0) * plan.barrierPct / 100);
      actor.shieldBarrier = Math.max(actor.shieldBarrier | 0, val);
      rMin = plan.barrierRangeMin | 0;
      rMax = plan.barrierRangeMax | 0;
      if (!(rMax > 0)) rMax = 3;
      /* Self is always the caster; ally cells start at least distance 1. */
      if (rMin < 1) rMin = 1;
      allyN = Math.max(0, plan.barrierAllyCount | 0);
      cands = [];
      (friends || []).forEach(function (f) {
        var d;
        if (!f || f === actor || (f.hp | 0) <= 0) return;
        d = R.distance(actor, f);
        if (d < rMin || d > rMax) return;
        cands.push(f);
      });
      cands.sort(function (a, b) {
        var ha = a.hp | 0;
        var hb = b.hp | 0;
        if (ha !== hb) return ha - hb;
        return R.distance(actor, a) - R.distance(actor, b);
      });
      picked = cands.slice(0, allyN);
      picked.forEach(function (ally) {
        ally.shieldBarrier = Math.max(ally.shieldBarrier | 0, val);
      });
      note = picked.length
        ? (' barrier ' + val + ' → self + ' + picked.map(function (p) { return p.name; }).join(', '))
        : (' barrier ' + val + ' → self');
    }
    if (typeof snapshotLine === 'function') {
      snapshotLine(
        'T' + turn + ' Unit skill: ' + actor.name + ' 「' + (plan.name || 'SKILL') + '」' +
          (note || ''),
        {
          x: actor.x, y: actor.y,
          text: actor.skillMarkText,
          skillName: actor.skillMarkText,
          badge: 'SKILL',
          icon: actor.skillMarkIcon,
          cls: 'mls-float--skill'
        },
        null,
        'skill'
      );
    }
  }

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.scoreOnly] — Formation Optimizer: skip step snapshots (huge GC);
   *   returns win/turns/HP only. Playback still uses the full path.
   * @param {boolean} [opts.forceNoCrit] — never roll crits (fair 1T check).
   * @param {object} [opts.pruneScore] — current best {win,turns,turn1EnemyHp,allyHp}; abort
   *   when this fight can no longer beat it (optimizer only; ranking unchanged).
   */
  function fightSteps(allies, enemies, opts) {
    var scoreOnly = !!(opts && opts.scoreOnly);
    var forceNoCrit = !!(opts && opts.forceNoCrit);
    var pruneScore = (opts && opts.pruneScore) || null;
    var pruned = false;
    var R = rules();
    var limit = (board && board.limit_turns) || 5;
    var steps = [];
    var turn = 1;
    var turn1EnemyHp = null;
    /* Formation squad buffs once per fight (dead units still count for same-squad tags). */
    stampSquadBuffs(allies);
    stampSquadBuffs(enemies);
    /* Stable roster for the whole fight (dead stay in list with hp≤0). Avoids concat thrash. */
    var rosterBuf = allies.concat(enemies);
    /*
     * Cond:Area WP auras are distance-based. Bump this on every board move so dmgMemo
     * cannot reuse a pre-move (outside-aura) preview after a unit walks into range.
     */
    var posEpoch = 0;
    /* Memoize /cal previews — pickEngage/MAP/queue call strikeDamage dozens of times per action. */
    var dmgMemo = Object.create(null);
    function living(list) { return list.filter(function (u) { return u.hp > 0; }); }
    var supportUsed = { ally: false, enemy: false };
    /** /cal damage + Cond:Area WP auras from the opposing force. */
    function battleDamage(attacker, defender, weapon, hitOpts) {
      var ho = hitOpts || {};
      var wid = weapon && weapon.raw && weapon.raw.id != null
        ? String(weapon.raw.id)
        : String((weapon && weapon.name) || '');
      var key = (attacker && attacker.id || '') + '\0' + (defender && defender.id || '') + '\0' + wid + '\0' +
        ((attacker && attacker.hp) | 0) + '\0' + ((defender && defender.hp) | 0) + '\0' +
        ((attacker && attacker.mp) | 0) + '\0' + ((defender && defender.mp) | 0) + '\0' +
        ((attacker && attacker.currentEn) | 0) + '\0' +
        ((attacker && attacker.skillDmgPct) | 0) + '\0' +
        (attacker && attacker.turnBuffActive ? 1 : 0) + '\0' +
        (defender && defender.forceGuard ? 1 : 0) + '\0' +
        (defender && defender.turnBuffActive ? 1 : 0) + '\0' +
        (ho.defending ? 1 : 0) + '\0' + (ho.shield ? 1 : 0) + '\0' +
        (ho.useCrit ? 1 : 0) + '\0' + (ho.isSupport ? 1 : 0) + '\0' +
        (ho.isCounter ? 1 : 0) + '\0' + (ho.supportDefenseActive ? 1 : 0) + '\0' +
        (forceNoCrit ? 1 : 0) + '\0' +
        (liveCombatStackCount(attacker) | 0) + '\0' +
        (liveDamageTakenDefStacks(defender) | 0) + '\0' +
        (liveHpAtkTierIndex(attacker) | 0) + '\0' +
        ((attacker && attacker.exCritBonus) | 0) + '\0' +
        ((defender && defender.exDamageTakenDown) | 0) + '\0' +
        ((defender && defender.unitSkillBeamDr) | 0) + '\0' +
        ((defender && defender.shieldBarrier) | 0) + '\0' +
        (defender && defender.hasFirstStrikeBarrier ? 1 : 0) + '\0' +
        (defender && defender.turnBuffActive ? 1 : 0) + '\0' +
        (liveStatusDtu(defender).beam | 0) + '\0' +
        (liveStatusDtu(defender).physical | 0) + '\0' +
        (liveStatusDtu(defender).special | 0) + '\0' +
        (liveStatusDefDebuffPct(defender) | 0) + '\0' +
        (attacker && attacker.unitStatMode ? String(attacker.unitStatMode) : '') + '\0' +
        (attacker && attacker.charStatMode ? String(attacker.charStatMode) : '') + '\0' +
        (defender && defender.unitStatMode ? String(defender.unitStatMode) : '') + '\0' +
        (defender && defender.charStatMode ? String(defender.charStatMode) : '') + '\0' +
        ((attacker && attacker.squadCondAtkPct) | 0) + '\0' +
        ((attacker && attacker.exSquadAtkPct) | 0) + '\0' +
        (posEpoch | 0);
      var hit = dmgMemo[key];
      var opts;
      if (hit != null) {
        /* Restore /cal barrier meta — memo skips strikeDamage. */
        if (hit && typeof hit === 'object') {
          defender._calSkillInitialNull = !!hit.initialNull;
          defender._calSkillBarrierAbsorb = hit.barrierAbs | 0;
          return hit.dmg | 0;
        }
        return hit | 0;
      }
      opts = Object.assign({}, ho);
      opts.auraSources = rosterBuf;
      hit = strikeDamage(attacker, defender, weapon, opts);
      dmgMemo[key] = {
        dmg: hit | 0,
        initialNull: !!defender._calSkillInitialNull,
        barrierAbs: defender._calSkillBarrierAbsorb | 0
      };
      return hit | 0;
    }
    /* gge evaluateSupportSkill: once per side, only HP recovery, only if an ally in
       EffectRange is at or below the ML auto threshold (tier 2 = 50%). Not at battle start. */
    function evaluateSupportSkill(actor, friends) {
      var sup, skills, hpSkill, maxR, pct, inRange, wounded, healPct, i, ally, amt, text;
      if (!actor || supportUsed[actor.side]) return;
      if ((turn | 0) < 1) return;
      sup = sideSupportData[actor.side] || actor.supporter;
      if (!sup) return;
      skills = sup.active_skills || [];
      hpSkill = null;
      for (i = 0; i < skills.length; i++) {
        text = String((skills[i].desc || '') + ' ' + (skills[i].name || ''));
        if (/Restore\s+HP|HPを?\d|HPが.*回復|回復.*HP/i.test(text)) { hpSkill = skills[i]; break; }
      }
      if (!hpSkill) return;
      if ((hpSkill.ml_passed_turn | 0) > (turn | 0)) return;
      maxR = (hpSkill.effect_range_max | 0) > 0 ? (hpSkill.effect_range_max | 0) : 4;
      pct = 0.5;
      if ((hpSkill.ml_hp_tier | 0) >= 3) pct = 0.75;
      else if ((hpSkill.ml_hp_tier | 0) <= 1) pct = 0.25;
      inRange = (friends || []).filter(function (a) {
        return a && a.hp > 0 && R.distance(actor, a) <= maxR;
      });
      wounded = inRange.filter(function (a) {
        return (a.maxHp | 0) > 0 && (a.hp / a.maxHp) <= pct + 1e-6;
      });
      if (wounded.length < Math.max(1, hpSkill.ml_threshold | 0)) return;
      healPct = 0;
      text = String(hpSkill.desc || '');
      var hm = text.match(/(\d+)\s*%/);
      if (hm) healPct = (parseInt(hm[1], 10) || 0) / 100;
      if (healPct <= 0) return;
      supportUsed[actor.side] = true;
      snapshotLine(
        'T' + turn + ' Supporter: ' + (sup.name || 'Supporter') + ' activates 「' + (hpSkill.name || 'HP') + '」 (' + Math.round(healPct * 100) + '%)',
        {
          x: actor.x, y: actor.y,
          text: String(hpSkill.name || 'SUPPORT').slice(0, 18),
          skillName: String(hpSkill.name || 'SUPPORT').slice(0, 18),
          badge: 'SKILL',
          icon: hpSkill.icon || '',
          cls: 'mls-float--skill'
        },
        null,
        'skill'
      );
      for (i = 0; i < inRange.length; i++) {
        ally = inRange[i];
        amt = Math.floor((ally.maxHp | 0) * healPct);
        if (amt <= 0) continue;
        ally.ghostHp = ally.hp;
        ally.hp = Math.min(ally.maxHp | 0, (ally.hp | 0) + amt);
        snapshotLine(
          'T' + turn + ' Supporter heal: ' + ally.name + ' +' + amt + ' HP',
          { x: ally.x, y: ally.y, text: '+' + fmtNum(amt), cls: 'mls-float--heal' },
          null,
          'skill'
        );
      }
    }
    function snapshotLine(text, floatEvt, linkEvt, pace) {
      if (scoreOnly) return;
      steps.push({
        type: 'log',
        text: text,
        pace: pace || 'step',
        turn: turn | 0,
        float: floatEvt || null,
        link: linkEvt || null,
        ally: allies.map(function (u) {
          return {
            id: u.id, name: u.name, thum: u.thum || '',
            x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp | 0, maxEn: u.maxEn | 0,
            ghostHp: u.ghostHp, active: !!u.active,
            isLarge: !!u.isLarge, size: u.size != null ? (u.size | 0) : (u.isLarge ? 2 : 1),
            badge: u.badge || '', badgeText: u.badgeText || '', badgeIcon: u.badgeIcon || '',
            skillMarkIcon: u.skillMarkIcon || '', skillMarkText: u.skillMarkText || '',
            unconditionalCSStock: u.unconditionalCSStock | 0,
            debuffs: (u.debuffs || []).map(function (d) {
              return d ? {
                type: d.type, value: d.value | 0, untilTurn: d.untilTurn,
                icon: d.icon || '', label: d.label || ''
              } : null;
            }).filter(Boolean),
            tension: u.tension | 0, mp: u.mp | 0,
            covering: !!u.covering, coverTx: u.coverTx, coverTy: u.coverTy,
            sheltered: !!u.sheltered,
            lingerKo: !!u.lingerKo,
            usedSupportCount: u.usedSupportCount | 0,
            usedSupportDefendCount: u.usedSupportDefendCount | 0,
            saLimit: u.saLimit | 0,
            sdLimit: u.sdLimit | 0
          };
        }),
        enemy: enemies.map(function (u) {
          return {
            id: u.id, name: u.name, thum: u.thum || '',
            x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp | 0, maxEn: u.maxEn | 0,
            ghostHp: u.ghostHp, active: !!u.active,
            isLarge: !!u.isLarge, size: u.size != null ? (u.size | 0) : (u.isLarge ? 2 : 1),
            badge: u.badge || '', badgeText: u.badgeText || '', badgeIcon: u.badgeIcon || '',
            skillMarkIcon: u.skillMarkIcon || '', skillMarkText: u.skillMarkText || '',
            unconditionalCSStock: u.unconditionalCSStock | 0,
            debuffs: (u.debuffs || []).map(function (d) {
              return d ? {
                type: d.type, value: d.value | 0, untilTurn: d.untilTurn,
                icon: d.icon || '', label: d.label || ''
              } : null;
            }).filter(Boolean),
            tension: u.tension | 0, mp: u.mp | 0,
            covering: !!u.covering, coverTx: u.coverTx, coverTy: u.coverTy,
            sheltered: !!u.sheltered,
            lingerKo: !!u.lingerKo,
            usedSupportCount: u.usedSupportCount | 0,
            usedSupportDefendCount: u.usedSupportDefendCount | 0,
            saLimit: u.saLimit | 0,
            sdLimit: u.sdLimit | 0
          };
        })
      });
    }
    function releaseCover(coverActor, sheltered) {
      var from;
      if (!coverActor || !coverActor.covering) return;
      from = {
        x: coverActor.coverTx != null ? coverActor.coverTx : coverActor.x,
        y: coverActor.coverTy != null ? coverActor.coverTy : coverActor.y
      };
      coverActor.covering = false;
      coverActor.coverTx = null;
      coverActor.coverTy = null;
      coverActor.badge = '';
      coverActor.badgeText = '';
      coverActor.badgeIcon = '';
      if (sheltered) sheltered.sheltered = false;
      snapshotLine(
        'T' + turn + ' ' + supportDefenseLabel() + ': ' + coverActor.name,
        null,
        {
          kind: 'cover-return',
          fromId: coverActor.id,
          toId: coverActor.id,
          supportId: coverActor.id,
          from: from,
          to: { x: coverActor.x | 0, y: coverActor.y | 0 }
        },
        'cover-return'
      );
    }
    function clearBadges() {
      allies.concat(enemies).forEach(function (x) {
        x.badge = '';
        x.badgeText = '';
        x.badgeIcon = '';
      });
    }
    function applyHit(attacker, defender, label, kind, supportUnit, hitOpts) {
      hitOpts = hitOpts || {};
      var defAction = hitOpts.defAction || 'none';
      var isSd = !!(supportUnit && supportUnit === defender) || !!hitOpts.defending ||
        defAction === 'defend' || defAction === 'shield';
      var dmgOpts = {
        defending: isSd,
        shield: !!hitOpts.shield || defAction === 'shield',
        isSupport: !!hitOpts.isSupport,
        isCounter: kind === 'Counter' || kind === 'Support Counter' || !!hitOpts.isCounter,
        /* Pilot Support Defense DEF % (Durability Type match) while covering — not on normal hits. */
        supportDefenseActive: !!(hitOpts.isDefenderSupportDefend || (supportUnit && supportUnit === defender))
      };
      var wpn = hitOpts.weapon || null;
      var picked, dmg, floatCls, linkKind, crit, note, critRate, hit, costInfo, impact, aim;
      var calBarrierAbs, calInitialNull;
      if (!wpn) {
        picked = R.pickWeapon(attacker, defender, function (a, d, w) {
          return battleDamage(a, d, w, dmgOpts);
        });
        if (!picked) return null;
        wpn = picked.weapon;
      }
      /* Announce weapon on the shooter — same chip as supporter skill (icon + name). */
      snapshotLine(
        'T' + turn + ' Weapon: ' + attacker.name + ' 「' + ((wpn && wpn.name) || 'Weapon') + '」',
        weaponAnnounceFloat(attacker, wpn),
        null,
        'skill'
      );
      /* gge: EN/ammo consumed at wave fire (caller may pass skipCost). */
      if (!hitOpts.skipCost) {
        costInfo = R.consumeWeaponCost(attacker, wpn, !!hitOpts.isSupport);
        if (costInfo && costInfo.en > 0) {
          snapshotLine(
            'T' + turn + ' EN −' + costInfo.en + ': ' + attacker.name +
            ' (EN ' + (attacker.currentEn | 0) + '/' + (attacker.maxEn | 0) + ')',
            null, null, 'step'
          );
        }
        if (costInfo && costInfo.mp > 0) {
          snapshotLine(
            'T' + turn + ' Weapon MP −' + costInfo.mp + ': ' + attacker.name +
            ' (MP ' + (attacker.mp | 0) + ')',
            null, null, 'step'
          );
        }
      }
      hit = R.checkHit(attacker, defender, wpn, defAction, !!hitOpts.isDefenderSupportDefend);
      attacker.lastActionHit = !!hit;
      if (!hit) {
        /* gge miss: attacker −1. Evade bonus +1 goes to the covered ally when SD whiffs, else the defender. */
        var missWhy = (defender && defender._lastMissReason) ||
          (defAction === 'evade' ? 'Evade' : '');
        applyMpDelta(attacker, -1);
        if (hitOpts.isDefenderSupportDefend && hitOpts.originalTarget) applyMpDelta(hitOpts.originalTarget, 1);
        else applyMpDelta(defender, 1);
        clearBadges();
        snapshotLine(
          'T' + turn + ' ' + label + ': ' + attacker.name + ' → ' + defender.name +
          '  MISS' + (wpn && wpn.name ? ' [' + wpn.name + ']' : '') +
          (missWhy ? ' [' + missWhy + ']' : '') +
          ' · MP ' + (attacker.mp | 0) + ' (' + vigorLabelFromMp(attacker.mp) + ')',
          { x: defender.x, y: defender.y, text: missWhy === 'Sway' ? 'SWAY' : 'MISS', cls: 'mls-float--heal' },
          {
            kind: kind === 'Counter' ? 'counter' : 'attack',
            fromId: attacker.id, toId: defender.id,
            from: { x: attacker.x, y: attacker.y },
            to: { x: defender.x, y: defender.y }
          },
          'attack'
        );
        return { weapon: wpn, damage: 0, miss: true };
      }
      critRate = R.calculateCriticalRate(attacker, wpn, defender);
      /* Always burn a roll so no-crit / with-crit optimizer passes keep the same hit stream. */
      crit = (simRandom() * 100 < critRate) && !forceNoCrit;
      dmgOpts.useCrit = crit;
      defender._calSkillInitialNull = false;
      defender._calSkillBarrierAbsorb = 0;
      dmg = battleDamage(attacker, defender, wpn, dmgOpts) | 0;
      calInitialNull = !!defender._calSkillInitialNull;
      calBarrierAbs = defender._calSkillBarrierAbsorb | 0;
      /* /cal already applied type-8 null / type-6 barrier when stock was live — consume once. */
      if (calInitialNull && defender.hasFirstStrikeBarrier) {
        defender.hasFirstStrikeBarrier = false;
        if (defender._mobUntilInitialNull) {
          defender.turnBuffActive = false;
          defender._mobUntilInitialNull = false;
        }
      } else if (calBarrierAbs > 0 && (defender.shieldBarrier | 0) > 0) {
        defender.shieldBarrier = Math.max(0, (defender.shieldBarrier | 0) - calBarrierAbs);
      } else if (defender.hasFirstStrikeBarrier) {
        /* gge timing: first-strike null eats damage before HP when /cal did not (e.g. S.Attack). */
        defender.hasFirstStrikeBarrier = false;
        if (defender._mobUntilInitialNull) {
          defender.turnBuffActive = false;
          defender._mobUntilInitialNull = false;
        }
        snapshotLine(
          'T' + turn + ' First-strike barrier: ' + defender.name + ' nullifies ' + dmg,
          { x: defender.x, y: defender.y, text: 'NULL', cls: 'mls-float--heal' },
          null, 'skill'
        );
        dmg = 0;
      } else if ((defender.shieldBarrier | 0) > 0 && dmg > 0) {
        var absorbed = Math.min(defender.shieldBarrier | 0, dmg);
        defender.shieldBarrier = (defender.shieldBarrier | 0) - absorbed;
        dmg -= absorbed;
        snapshotLine(
          'T' + turn + ' Barrier: ' + defender.name + ' absorbs ' + absorbed +
          ' (left ' + (defender.shieldBarrier | 0) + ')',
          { x: defender.x, y: defender.y, text: 'BAR ' + absorbed, cls: 'mls-float--heal' },
          null, 'skill'
        );
      }
      defender.ghostHp = defender.hp | 0;
      var hpBeforeHit = defender.hp | 0;
      var alreadyDown = hpBeforeHit <= 0;
      defender.hp = Math.max(0, hpBeforeHit - dmg);
      floatCls = (defender.side === 'enemy' ? 'mls-float--enemy' : 'mls-float--ally') +
        (crit ? ' mls-float--crit' : '');
      linkKind = kind === 'Support Attack' || kind === 'Support Counter' ? 'support'
        : (kind === 'Support Defense' ? 'support-def'
          : (kind === 'Counter' ? 'counter' : (kind === 'MAP' ? 'attack' : 'attack')));
      clearBadges();
      if (kind === 'Support Attack' || kind === 'Support Counter') attacker.badge = 'S.ATK';
      if (kind === 'MAP') attacker.badge = 'MAP';
      /* SD: opening float only — cover pose without a sticky S.DEF chip. */
      if (hitOpts.isDefenderSupportDefend || (supportUnit && supportUnit === defender)) {
        defender.covering = true;
        if (hitOpts.originalTarget) {
          defender.coverTx = hitOpts.originalTarget.x;
          defender.coverTy = hitOpts.originalTarget.y;
        }
      }
      note = '';
      if (hitOpts.isDefenderSupportDefend || (supportUnit && supportUnit === defender)) {
        note = dmgOpts.shield ? ' [SD Shield ×0.6' : ' [SD ×0.8';
        if (abilityDamageTakenDownPct(defender.unit, wpn)) note += ' + DR';
        note += ']';
      } else if (defAction === 'defend' || defAction === 'shield') {
        /* gge determineDefenseAction — self-defend when a counter would get them killed. */
        note = defAction === 'shield' ? ' [AI Shield ×0.6]' : ' [AI Defend ×0.8]';
        if (abilityDamageTakenDownPct(defender.unit, wpn)) {
          note = note.replace(/\]$/, ' + DR]');
        }
      }
      if (defAction === 'evade') note += ' [Evade roll HIT]';
      if (hitOpts.wave != null) note += ' [W' + hitOpts.wave + ']';
      /* Surface silent /cal failures (raw weapon PWR) — those look like “EX barely scratched”. */
      if (attacker._lastDmgFallback) {
        note += ' [DMG FALLBACK:' + attacker._lastDmgFallback + ' PWR ' + (wpn.power | 0) + ']';
        attacker._lastDmgFallback = '';
      }
      impact = impactCell(defender);
      /* gge: laser / float aim at originalTarget (cover cell), damage lands on SD there. */
      aim = hitOpts.originalTarget && hitOpts.isDefenderSupportDefend
        ? { x: hitOpts.originalTarget.x | 0, y: hitOpts.originalTarget.y | 0 }
        : impact;
      /*
       * Arm grey-out linger BEFORE the KO snapshot — otherwise playback fades the token
       * on the KO step, then brings it back for Counter (fade → revive → fade).
       */
      var hpAfterHit = defender.hp | 0;
      if (hpAfterHit <= 0) {
        defender._koThisEngagement = true;
        defender.lingerKo = true;
      }
      /* Log hit at post-damage HP (before revive) so KO reads correctly, then restore. */
      snapshotLine(
        'T' + turn + ' ' + label + ': ' + attacker.name + ' → ' + defender.name +
        '  −' + dmg + (crit ? ' CRIT' : '') +
        (wpn && wpn.name ? ' [' + wpn.name + ']' : '') +
        note +
        (defender.hp <= 0
          ? (alreadyDown ? '  (finishing)' : '  KO')
          : ('  (HP ' + defender.hp + ')')),
        {
          x: aim.x, y: aim.y,
          text: (crit ? 'CRIT −' : '−') + fmtNum(dmg),
          cls: floatCls,
          crit: crit
        },
        {
          kind: linkKind,
          ranged: weaponIsRanged(wpn),
          side: attacker.side,
          crit: !!crit,
          fromId: attacker.id,
          toId: defender.id,
          supportId: (hitOpts.isDefenderSupportDefend || (supportUnit && supportUnit === defender))
            ? defender.id
            : (supportUnit && supportUnit !== defender ? supportUnit.id : null),
          coverTo: (hitOpts.isDefenderSupportDefend && hitOpts.originalTarget)
            ? { x: hitOpts.originalTarget.x | 0, y: hitOpts.originalTarget.y | 0 }
            : null,
          from: { x: attacker.x | 0, y: attacker.y | 0 },
          to: { x: aim.x, y: aim.y }
        },
        linkKind === 'counter' ? 'counter' : (linkKind === 'support' ? 'support' : 'attack')
      );
      /*
       * Inflict after the hit snapshot so portrait status icons appear on impact,
       * not on the pre-hit laser frame (debuffs were landing a step early).
       */
      (function applyAndAnnounceInflict() {
        var list = parseWeaponInflictDebuffs(wpn, turn);
        if (!list.length) return;
        applyWeaponDebuffs(defender, wpn, turn);
        list.forEach(function (d) {
          snapshotLine(
            'T' + turn + ' Inflict: ' + defender.name + ' ← ' +
            (d.label || d.type) + ' ' + (d.value | 0) + '%',
            {
              x: defender.x, y: defender.y,
              text: String(d.label || 'DEBUFF').slice(0, 18),
              icon: d.icon || '',
              cls: 'mls-float--skill'
            },
            null,
            'skill'
          );
        });
      })();
      /* Pilot/unit once-only revive & threshold restore (Zeong 0%→5%, Impulse 50%→50%). */
      var revived = applyHpFallRestores(defender, hpBeforeHit, turn, snapshotLine);
      /*
       * Escape Function (mechanism): HP 0 → alternate unit once/battle.
       * Runs after revive so Char/Zeong-style restore wins when both could apply.
       */
      var escaped = false;
      if (!revived && hpAfterHit <= 0 && (defender.hp | 0) <= 0) {
        escaped = tryEscapeTransform(defender, turn, snapshotLine);
      }
      /*
       * In-game: if the *active* unit is KO’d (e.g. counter) then revives / Escapes,
       * their action ends — no further move / Chance Step / attack this phase.
       * Escape is the same class as revive here.
       */
      if ((revived || escaped) && hpAfterHit <= 0 && (defender.hp | 0) > 0 && defender.active) {
        defender._endActionAfterRevive = true;
        defender.lingerKo = false;
      }
      /* Cond:Combat-Count / Cond:Damage taken — stacks rise after a landed hit (next strike uses them). */
      bumpCondStacksAfterHit(attacker, defender);
      /* LANG + gge: land hit → attacker +1; take hit → −1; SD net +2.
         Kill bonus after revive check so a revived target is not a 完全撃破.
         Escape Function still counts as destroying the pre-escape form. */
      applyMpDelta(attacker, 1);
      if (hitOpts.isDefenderSupportDefend) applyMpDelta(defender, 2);
      else if (!alreadyDown) applyMpDelta(defender, -1);
      if (hpAfterHit <= 0 && !revived) {
        if (!alreadyDown) {
          /* First killing blow: Support Counter +1, normal/Counter +4. */
          applyMpDelta(attacker, hitOpts.isSupport ? 1 : 4);
          /*
           * Shared destroy: when Support Counter KOs the active attacker and no Counter wave
           * remains in this engagement, credit the main counter unit too (in-game both gain).
           */
          if (kind === 'Support Counter' && hitOpts.shareDestroyWith &&
              (hitOpts.shareDestroyWith.hp | 0) > 0) {
            applyMpDelta(hitOpts.shareDestroyWith, 4);
          }
        } else if (kind === 'Counter') {
          /* Counter into a Support-Counter KO linger — main counterer still gets destroy tension. */
          applyMpDelta(attacker, 4);
        }
      }
      return {
        weapon: wpn, damage: dmg, miss: false, crit: crit,
        ko: hpAfterHit <= 0 && !alreadyDown && !revived,
        escaped: !!escaped
      };
    }
    var asyncTurns = !!(opts && opts.asyncTurns);
    function finalizeFightResult() {
      if (pruned) {
        return {
          steps: steps, win: false, draw: false, turns: 999,
          turn1EnemyHp: turn1EnemyHp != null ? turn1EnemyHp : 1e15,
          allies: allies, enemies: enemies, pruned: true
        };
      }
      var allyUp = living(allies).length;
      var enemyUp = living(enemies).length;
      /*
       * Early exit (KO): `turn` is the last fought turn.
       * Turn-limit exit: loop did turn++ past the last fought turn.
       */
      var turnsUsed = Math.min(limit, Math.max(1,
        (allyUp > 0 && enemyUp > 0) ? (turn - 1) : turn
      ));
      var win = enemyUp === 0 && allyUp > 0;
      var draw = allyUp > 0 && enemyUp > 0;
      if (turn1EnemyHp == null) {
        turn1EnemyHp = enemies.reduce(function (s, u) { return s + Math.max(0, u.hp | 0); }, 0);
      }
      snapshotLine(draw ? 'Time up — both sides remain' : (win ? 'Ally victory · ' + turnsUsed + ' turn(s)' : 'Ally defeat'));
      return {
        steps: steps, win: win, draw: draw, turns: turnsUsed,
        turn1EnemyHp: turn1EnemyHp, allies: allies, enemies: enemies
      };
    }
    /** One ML turn. Returns true when another turn should run. */
    function runOneFightTurn() {
      if (!(turn <= limit && living(allies).length && living(enemies).length)) return false;

      /* gge: reset per-round support-attack / support-defense uses at turn start.
         Re-sum SD/SA stock live so tension-gated +N lines unlock as MP rises. */
      allies.concat(enemies).forEach(function (x) {
        if (x.hp > 0) {
          x.usedSupportDefendCount = 0;
          x.usedSupportCount = 0;
          x.exProgressedThisTurn = false;
          if (R.supportDefendLimit) x.sdLimit = R.supportDefendLimit(x) | 0;
          if (R.supportAttackLimit) x.saLimit = R.supportAttackLimit(x) | 0;
        }
      });
      snapshotLine('— Turn ' + turn + ' —', null, null, 'turn');
      R.actionOrder(allies.concat(enemies)).forEach(function (u) {
        var foes, friends, engage, target, picked, skill, guard, supportAtk, actual;
        var allUnits, bounds, dist, nextPos, path, pi, stepCell, oldX, oldY;
        if (u.hp <= 0) return;
        allies.concat(enemies).forEach(function (x) {
          x.active = false; x.badge = ''; x.covering = false; x.sheltered = false;
        });
        u.active = true;
        if (R.evaluateExPhase) R.evaluateExPhase(u);
        u._simTurn = turn;
        pruneExpiredDebuffs(u);
        u.usedSkillThisTurn = false;
        u.usedSkillKeys = {};
        /* Unit skill (1 turn) buffs expire at the start of this unit's next action.
         * Exception: MOB% that lasts until Initial Null is spent (F91 EX). */
        if (!(u._mobUntilInitialNull && u.hasFirstStrikeBarrier)) {
          u.turnBuffActive = false;
        }
        /* Force Guard DTD lasts until this unit’s next action starts (1 turn). */
        u.forceGuardDtdPct = 0;
        u.forceGuard = false;
        u.skillDmgPct = 0;
        u.skillDmgKind = '';
        /* Fresh engagement — clear prior KO / Escape flags so revive from last fight does not linger. */
        allies.concat(enemies).forEach(function (x) {
          if (x) {
            x._koThisEngagement = false;
            x._escapedThisEngagement = false;
          }
        });
        /* Re-apply terrain Move each action (▲ → floor half). Keeps S17 Neo Zeong at 2. */
        u.move = applyTerrainMove(
          u.baseMove != null ? u.baseMove : u.move,
          u.unit,
          u.fieldTerrain || (seasonMeta && seasonMeta.terrain_primary) || ''
        );
        if (u.terrainMoveFactor == null) {
          u.terrainMoveFactor = terrainMoveFactor(
            u.unit,
            u.fieldTerrain || (seasonMeta && seasonMeta.terrain_primary) || ''
          );
        }
        syncMpDisplay(u);
        foes = u.side === 'ally' ? enemies : allies;
        friends = u.side === 'ally' ? allies : enemies;
        if (!living(foes).length) return;
        allUnits = allies.concat(enemies);
        bounds = pathBounds();

        /* gge: supporter HP skill is checked at the start of this unit's action, not at battle open. */
        evaluateSupportSkill(u, friends);

        /* Unit ability: restore HP/EN at the start of every turn (Impulse Phase Shift kits, …). */
        applyTurnStartRestore(u, turn, snapshotLine);

        /* gge: non-first-strike unit skill once, before the move. */
        applyPlannedUnitSkill(u, 'move', friends, turn, snapshotLine);

        /*
         * Pilot skills before move/attack.
         * EN help: spend SP to activate skills before acting; multiple different effects OK;
         * same effect cannot re-fire until it expires. Repair still ends the action.
         */
        u.usedSkillKeys = u.usedSkillKeys || {};
        var repairedThisAction = false;
        (function applyPilotSkillsChain() {
          var guard = 0;
          var healPct, healM, spct, mpGain;
          while (guard++ < 8) {
            skill = R.pickSkill(u, foes);
            if (!skill) break;
            u.currentSp = Math.max(0, (u.currentSp | 0) - (skill.sp | 0));
            u.usedSkillThisTurn = true;
            u.skillUsed = true;
            u.usedSkillKeys[skill.key] = 1;
            u.badge = 'SKILL';
            u.badgeText = String(skill.name || 'SKILL').replace(/\s+LV\s*\d+/i, '');
            u.badgeIcon = skill.icon || '';
            if (skill.key === 'repair') {
              healPct = 30;
              healM = String(skill.effect || '').match(/(\d+)\s*%/);
              if (healM) healPct = parseInt(healM[1], 10) || 30;
              u.ghostHp = u.hp;
              u.hp = Math.min(u.maxHp, u.hp + Math.floor((u.maxHp | 0) * healPct / 100));
              repairedThisAction = true;
            } else if (skill.key === 'range_boost') {
              u.weapons.forEach(function (w) { w.max_range += 1; });
            } else if (skill.key === 'high_speed') {
              u.move = (u.move | 0) + 1;
            } else if (skill.key === 'force_guard') {
              /* Official: Reduce damage taken by N% (1 turn) — not Defend ×0.8. */
              spct = String(skill.effect || skill.name || '').match(/(\d+)\s*%/);
              u.forceGuardDtdPct = spct ? (parseInt(spct[1], 10) || 20) : 20;
              u.forceGuard = false;
              snapshotLine(
                'T' + turn + ' Force Guard: ' + u.name + ' DTD −' + (u.forceGuardDtdPct | 0) + '% (1 turn)',
                {
                  x: u.x, y: u.y,
                  text: 'FG −' + (u.forceGuardDtdPct | 0) + '%',
                  badge: 'SKILL',
                  icon: skill.icon || '',
                  cls: 'mls-float--skill'
                },
                null,
                'skill'
              );
            } else if (skill.key === 'sway') {
              u.activeSkills = (u.activeSkills || []).concat([{ name: skill.name || 'Sway' }]);
            } else if (skill.key === 'en_free') {
              u.hasUsedFreeAmmoSkillInBattle = true;
              u.freeAmmoThisAction = true;
            } else if (skill.key === 'sd_plus') {
              u.sdLimit = (u.sdLimit | 0) + 1;
            } else if (skill.key === 'crit_boost') {
              u.skillCritBonus = 20;
            } else if (skill.key === 'mp_up') {
              mpGain = (R.parseMpUpAmount ? R.parseMpUpAmount(skill) : 3) | 0;
              applyMpDelta(u, mpGain);
            } else if (skill.key === 'attack_burst' || skill.key === 'melee_boost' ||
                skill.key === 'shooting_boost' || skill.key === 'awaken_boost') {
              spct = String(skill.effect || skill.name || '').match(/(\d+)\s*%/);
              u.skillDmgPct = spct ? (parseInt(spct[1], 10) || 0) : 10;
              u.skillDmgKind = skill.key;
              u.turnBuffActive = true;
            }
            snapshotLine(
              'T' + turn + ' Skill: ' + u.name + ' uses 「' + skill.name + '」 (SP −' + (skill.sp | 0) + ')',
              {
                x: u.x, y: u.y,
                text: u.badgeText,
                skillName: u.badgeText,
                badge: 'SKILL',
                icon: skill.icon || '',
                cls: 'mls-float--skill'
              },
              null,
              'skill'
            );
            if (repairedThisAction) break;
          }
        })();
        if (repairedThisAction) return;

        u.chanceStepsLeft = chanceStepLimit(u);
        /* Auto-CS charges this action (≤ chanceStepsLeft). Not infinite every combat. */
        u.autoCsLeft = (R.autoCsTimesAvailable ? R.autoCsTimesAvailable(u) : 0) | 0;
        if ((u.autoCsLeft | 0) > (u.chanceStepsLeft | 0)) {
          u.autoCsLeft = u.chanceStepsLeft | 0;
        }
        u.startX = u.x;
        u.startY = u.y;
        u._endActionAfterRevive = false;
        /* Weapon “CS on hit” is once per action — not every loop (0-dmg hits would spin forever). */
        u._weaponCsGrantedThisAction = false;
        /* Unlock Guaranteed CS stock before the first swing if already Supercharged. */
        if (R.checkAndAcquireUnconditionalCS(u)) {
          snapshotLine(
            'T' + turn + ' ' +
            ((R.chanceStepLabels && R.chanceStepLabels(lang()).guaranteed) || 'Guaranteed Chance Step') +
            ' stock +1: ' + u.name + ' (MP ' + (u.mp | 0) + ' · ' + vigorLabelFromMp(u.mp) + ')',
            null, null, 'skill'
          );
        }
        /* Engage loop: Chance Step / unconditional CS / weapon-on-hit CS. */
        var engageGuard = 0;
        while (u.hp > 0 && living(foes).length && engageGuard++ < 24) {
          var mapPlan, combat, qi, q, qj, waveLabel, waveKind, defAct, coverUnit, origTarget, saLim, laterCounter;
          var checkedPreWall, gotExtra, hitAny, stillCovering;
          /* Per-engage: Escape “form destroyed” only counts for this combat’s CS check. */
          allies.concat(enemies).forEach(function (x) {
            if (x) x._escapedThisEngagement = false;
          });
          allUnits = allies.concat(enemies);
          engage = R.pickEngage(u, foes, allUnits, bounds, battleDamage);
          if (!engage || !engage.target) {
            if (!(u.badge === 'CS')) snapshotLine('T' + turn + ' ' + u.name + ' — no target reachable');
            break;
          }
          target = engage.target;

          /* gge: first-strike unit skill fires when combat starts, after the move. */
          applyPlannedUnitSkill(u, 'combat', friends, turn, snapshotLine);

          /* gge MAP interrupt before normal engage (whitelist → our is_map + map_coords). */
          mapPlan = R.evaluateMapWeapon(u, target, foes, allUnits, bounds, battleDamage);
          if (mapPlan && mapPlan.weapon) {
            if (mapPlan.moveTo) {
              oldX = u.x; oldY = u.y;
              u.x = mapPlan.moveTo.x; u.y = mapPlan.moveTo.y;
              posEpoch += 1;
              snapshotLine(
                'T' + turn + ' MAP Move: ' + u.name + ' [' + oldX + ',' + oldY + '] → [' + u.x + ',' + u.y + ']',
                null, null, 'move'
              );
            }
            R.consumeWeaponCost(u, mapPlan.weapon, false);
              snapshotLine(
              'T' + turn + ' MAP: ' + u.name + ' fires 「' + mapPlan.weapon.name + '」 at ' +
              mapPlan.targets.length + ' target(s) (EN ' + (u.currentEn | 0) + ')',
              weaponAnnounceFloat(u, mapPlan.weapon),
              {
                kind: 'map-aoe',
                fromId: u.id,
                toId: (mapPlan.targets[0] && mapPlan.targets[0].id) || u.id,
                from: { x: u.x | 0, y: u.y | 0 },
                to: mapPlan.targets[0]
                  ? { x: mapPlan.targets[0].x | 0, y: mapPlan.targets[0].y | 0 }
                  : { x: u.x | 0, y: u.y | 0 },
                cells: (mapPlan.cells || []).map(function (c) {
                  return { x: c.x | 0, y: c.y | 0 };
                })
              },
              'attack'
            );
            hitAny = false;
            var mapKilled = false;
            mapPlan.targets.forEach(function (mt) {
              var expectedMap, defActMap, res;
              if ((mt.hp | 0) <= 0) return;
              /* MAP: no Support Defense / counter, but self Defend/Shield/Evade still apply. */
              expectedMap = battleDamage(u, mt, mapPlan.weapon) | 0;
              defActMap = R.determineDefenseAction
                ? R.determineDefenseAction(mt, expectedMap, false, false)
                : 'none';
              res = applyHit(u, mt, 'MAP', 'MAP', null, {
                weapon: mapPlan.weapon,
                defAction: defActMap,
                defending: defActMap === 'defend' || defActMap === 'shield',
                shield: defActMap === 'shield',
                skipCost: true
              });
              if (res && !res.miss) hitAny = true;
              if ((mt.hp | 0) <= 0 || (res && res.escaped) || (mt && mt._escapedThisEngagement)) {
                mapKilled = true;
              }
            });
            u.lastActionHit = hitAny;
            gotExtra = false;
            var csLblMap = (R.chanceStepLabels && R.chanceStepLabels(lang())) || {
              cs: 'Chance Step', guaranteed: 'Guaranteed Chance Step'
            };
            if (R.checkAndAcquireUnconditionalCS(u)) {
              snapshotLine(
                'T' + turn + ' ' + csLblMap.guaranteed + ' stock +1: ' + u.name +
                ' (MP ' + (u.mp | 0) + ')',
                null, null, 'skill'
              );
            }
            /* Official help: Auto-Chance Step does not trigger after MAP Weapons. */
            if ((u.hp | 0) > 0 && living(foes).length) {
              if (hitAny && !u._weaponCsGrantedThisAction &&
                  (u.chanceStepsLeft | 0) > 0 &&
                  R.weaponGrantsUnconditionalCsOnHit(mapPlan.weapon)) {
                /* Weapon on-hit CS still spends the phase Bonus Action budget. */
                u._weaponCsGrantedThisAction = true;
                u.chanceStepsLeft = (u.chanceStepsLeft | 0) - 1;
                gotExtra = true;
                snapshotLine(
                  'T' + turn + ' Weapon ' + csLblMap.cs + ' (on hit): ' + u.name +
                  ' (left ' + (u.chanceStepsLeft | 0) + ')',
                  null, null, 'skill'
                );
              } else if (mapKilled && (u.chanceStepsLeft | 0) > 0) {
                /* Regular kill CS from phase budget (max 2). */
                u.chanceStepsLeft = (u.chanceStepsLeft | 0) - 1;
                gotExtra = true;
                snapshotLine(
                  'T' + turn + ' ' + csLblMap.cs + ': ' + u.name + ' (' + (u.chanceStepsLeft | 0) + ')',
                  { x: u.x, y: u.y, text: csLblMap.cs, badge: 'CS', cls: 'mls-float--skill' },
                  { kind: 'chance-step', fromId: u.id, toId: u.id, from: { x: u.x, y: u.y }, to: { x: u.x, y: u.y }, csIcon: true },
                  'skill'
                );
              } else if ((u.unconditionalCSStock | 0) > 0 && (u.chanceStepsLeft | 0) > 0) {
                /*
                 * Guaranteed CS: forces one existing Bonus Action without a KO.
                 * Does not raise chanceCount — spends chanceStepsLeft.
                 */
                u.unconditionalCSStock--;
                u.chanceStepsLeft = (u.chanceStepsLeft | 0) - 1;
                gotExtra = true;
                snapshotLine(
                  'T' + turn + ' ' + csLblMap.guaranteed + ': ' + u.name +
                  ' (stock ' + (u.unconditionalCSStock | 0) + ', left ' + (u.chanceStepsLeft | 0) + ')',
                  { x: u.x, y: u.y, text: csLblMap.guaranteed, badge: 'CS', cls: 'mls-float--skill' },
                  { kind: 'chance-step', fromId: u.id, toId: u.id, from: { x: u.x, y: u.y }, to: { x: u.x, y: u.y }, csIcon: true },
                  'skill'
                );
              }
            }
            if (gotExtra) {
              u.badge = 'CS';
              continue;
            }
            break;
          }

          dist = R.distance(u, target);
          if (dist > engage.maxR || dist < engage.minR) {
            nextPos = R.getBestMoveDestination(u, target, u.move | 0, engage.minR, engage.maxR, allUnits, bounds);
            if (nextPos && nextPos.moved) {
              oldX = u.x;
              oldY = u.y;
              u.x = nextPos.x;
              u.y = nextPos.y;
              posEpoch += 1;
              snapshotLine(
                'T' + turn + ' Move: ' + u.name + ' [' + oldX + ',' + oldY + '] → [' + u.x + ',' + u.y + ']' +
                ' (dist ' + R.distance(u, target) + ', move ' + (u.move | 0) +
                (u.baseMove != null && (u.baseMove | 0) !== (u.move | 0)
                  ? ' from ' + (u.baseMove | 0) + ' · ' + (u.fieldTerrain || 'field') + ' ▲/terrain'
                  : '') + ')',
                null,
                null,
                'move'
              );
            }
          }

          if (!R.getValidWeapons(u, R.distance(u, target), false).filter(function (w) {
            return !R.isMapWeapon(w);
          }).length) {
            snapshotLine('T' + turn + ' ' + u.name + ' — still out of range / no EN after move');
            break;
          }

          combat = R.buildCombatQueue(u, target, engage.weapon, friends, foes, battleDamage);
          /*
           * In-game cover order (normal engagement):
           *   1) Defender-side S.Defense steps in for the incoming Attack (/ Support Attack)
           *   2) Those hits resolve → S.Defense returns home
           *   3) Then Counter / Support Counter fire → Counter S.Defense steps in for the attacker
           *   4) Those hits resolve → Counter S.Defense returns home
           * Never announce / move Counter S.Defense before the main attack finishes.
           * (Preemptive counter is the exception: cover is armed on the first queue entry that needs it.)
           */
          combat._defenderCoverAnnounced = false;
          combat._counterCoverAnnounced = false;

          function announceDefenderCover() {
            if (!combat.bestGuard || combat._defenderCoverAnnounced) return;
            combat._defenderCoverAnnounced = true;
            guard = combat.bestGuard;
            clearBadges();
            guard.badge = '';
            guard.covering = true;
            guard.coverTx = target.x;
            guard.coverTy = target.y;
            target.sheltered = true;
            snapshotLine(
              'T' + turn + ' ' + supportDefenseLabel() + ': ' + guard.name + ' → ' + target.name +
              ' (SD ' + (guard.usedSupportDefendCount | 0) + '/' +
              (R.supportDefendLimit ? (R.supportDefendLimit(guard) | 0) : (guard.sdLimit | 0)) + ')',
              { x: target.x, y: target.y, text: badgeLabel('S.DEF'), badge: 'S.DEF', cls: 'mls-float--support' },
              {
                kind: 'support-def',
                fromId: guard.id, toId: target.id, supportId: guard.id,
                coverFrom: { x: guard.x, y: guard.y },
                coverTo: { x: target.x, y: target.y },
                from: { x: guard.x, y: guard.y },
                to: { x: target.x, y: target.y }
              },
              'support-def'
            );
          }

          function announceCounterCover() {
            var cg = combat.counterGuard;
            if (!cg || combat._counterCoverAnnounced) return;
            /* Defender-side cover must go home before Counter S.Defense walks in. */
            if (combat.bestGuard && combat.bestGuard.covering) {
              releaseCover(combat.bestGuard, target);
            }
            combat._counterCoverAnnounced = true;
            u.sheltered = true;
            cg.covering = true;
            cg.coverTx = u.x;
            cg.coverTy = u.y;
            snapshotLine(
              'T' + turn + ' ' + mlsT('mls_counter_support_defense', 'Counter Support Defense') +
              ': ' + cg.name + ' → ' + u.name + ' (SD ' +
              (cg.usedSupportDefendCount | 0) + '/' +
              (R.supportDefendLimit ? (R.supportDefendLimit(cg) | 0) : (cg.sdLimit | 0)) + ')',
              { x: u.x, y: u.y, text: badgeLabel('S.DEF'), badge: 'S.DEF', cls: 'mls-float--support' },
              {
                kind: 'support-def',
                fromId: cg.id, toId: u.id, supportId: cg.id,
                coverFrom: { x: cg.x, y: cg.y },
                coverTo: { x: u.x, y: u.y },
                from: { x: cg.x, y: cg.y },
                to: { x: u.x, y: u.y }
              },
              'support-def'
            );
          }

          if (!combat.bestGuard && combat.defenderAction !== 'none') {
            snapshotLine(
              'T' + turn + ' AI Defend: ' + target.name + ' chooses ' +
              (combat.defenderAction === 'shield' ? 'Shield' : (combat.defenderAction === 'evade' ? 'Evade' : 'Defend')),
              null, null, 'step'
            );
          }

          checkedPreWall = false;
          for (qi = 0; qi < combat.queue.length; qi++) {
            q = combat.queue[qi];
            if ((q.wave | 0) > 0 && !checkedPreWall) {
              checkedPreWall = true;
              if ((u.hp | 0) <= 0 || (target.hp | 0) <= 0) {
                snapshotLine('T' + turn + ' Preemptive wall — remaining waves cancelled', null, null, 'step');
                break;
              }
            }
            if ((q.attacker.hp | 0) <= 0) continue;

            coverUnit = null;
            origTarget = q.originalTarget || (q.wave === 3 || q.wave === 4 ? u : target);
            /* Support Attack: skip if the unit being piled on is already KO. */
            if (q.wave === 1 && origTarget &&
                ((origTarget.hp | 0) <= 0 || origTarget._koThisEngagement)) {
              snapshotLine(
                'T' + turn + ' ' + supportAttackLabel() + ' — ' + q.attacker.name +
                ' / ' + origTarget.name,
                null, null, 'step'
              );
              continue;
            }
            /*
             * Support Counter: in-game, a kill on the defended unit ends the engagement —
             * even if they revive (Setsuna / Char). Do not fire SA/Counter after that KO.
             */
            if (q.wave === 3) {
              if (target && ((target.hp | 0) <= 0 || target._koThisEngagement)) {
                snapshotLine(
                  'T' + turn + ' ' + supportCounterLabel() + ' — ' + q.attacker.name +
                  ' / ' + target.name,
                  null, null, 'step'
                );
                continue;
              }
              if (origTarget && ((origTarget.hp | 0) <= 0 || origTarget._koThisEngagement)) {
                snapshotLine(
                  'T' + turn + ' ' + supportCounterLabel() + ' — ' + q.attacker.name +
                  ' / ' + origTarget.name,
                  null, null, 'step'
                );
                continue;
              }
            }
            /* Counter: KO’d / Escaped *countering* unit (even if revived / morph) does not swing.
             * The active attacker may already be at 0 from Support Counter — Counter still fires
             * into that linger (in-game both get destroy tension, then the portrait fades). */
            if (q.wave === 4 && q.attacker &&
                (q.attacker._koThisEngagement || q.attacker._escapedThisEngagement)) {
              snapshotLine(
                'T' + turn + ' Counter skipped: ' + q.attacker.name +
                (q.attacker._escapedThisEngagement
                  ? ' — Escaped this engagement'
                  : ' — was KO’d this engagement'),
                null, null, 'step'
              );
              continue;
            }

            /* Arm the correct cover just before the hit that needs it. */
            if (combat.bestGuard && q.defender === combat.bestGuard) announceDefenderCover();
            if (combat.counterGuard && q.defender === combat.counterGuard) announceCounterCover();

            if (q.defender !== origTarget) {
              coverUnit = q.defender;
              coverUnit.covering = true;
              coverUnit.coverTx = origTarget.x;
              coverUnit.coverTy = origTarget.y;
            }

            if (q.wave === 1 || q.wave === 3) {
              q.attacker.usedSupportCount = (q.attacker.usedSupportCount | 0) + 1;
              saLim = R.supportAttackLimit ? (R.supportAttackLimit(q.attacker) | 0) : (q.attacker.saLimit | 0);
              snapshotLine(
                'T' + turn + ' ' + (q.wave === 1 ? supportAttackLabel() : supportCounterLabel()) +
                ': ' + q.attacker.name + ' (SA ' + (q.attacker.usedSupportCount | 0) + '/' + saLim + ')',
                null, null, 'support'
              );
            }

            defAct = q.forcedDefenderAction ||
              (q.defender === combat.actualDefender ? combat.defenderAction :
                (q.defender === combat.actualCounterDefender ? combat.counterDefAction : 'none'));
            /* kind = English (combat rules); label = locale (battle log). */
            if (q.wave === 0) { waveKind = 'Preemptive'; waveLabel = 'Preemptive'; }
            else if (q.wave === 1) { waveKind = 'Support Attack'; waveLabel = supportAttackLabel(); }
            else if (q.wave === 2) { waveKind = 'Attack'; waveLabel = 'Attack'; }
            else if (q.wave === 3) { waveKind = 'Support Counter'; waveLabel = supportCounterLabel(); }
            else { waveKind = 'Counter'; waveLabel = 'Counter'; }

            /* If no Counter wave remains after this Support Counter, share destroy with the main target. */
            laterCounter = false;
            if (q.wave === 3 && combat.isTargetCountering) {
              for (qj = qi + 1; qj < combat.queue.length; qj++) {
                if ((combat.queue[qj].wave | 0) === 4) { laterCounter = true; break; }
              }
            }

            applyHit(q.attacker, q.defender, waveLabel, waveKind, coverUnit, {
              weapon: q.weapon,
              defAction: defAct,
              defending: defAct === 'defend' || defAct === 'shield',
              shield: defAct === 'shield',
              isSupport: q.wave === 1 || q.wave === 3,
              isDefenderSupportDefend: !!(coverUnit && coverUnit === q.defender),
              originalTarget: origTarget,
              wave: q.wave,
              shareDestroyWith: (q.wave === 3 && !laterCounter && combat.isTargetCountering)
                ? target
                : null
            });

            /* After SD’s last needed hit — or immediately if SD died — home + clear shelter. */
            if (coverUnit && coverUnit === q.defender && coverUnit.covering) {
              stillCovering = false;
              if ((coverUnit.hp | 0) > 0 || coverUnit.lingerKo) {
                for (qj = qi + 1; qj < combat.queue.length; qj++) {
                  if (combat.queue[qj].defender === coverUnit) {
                    stillCovering = true;
                    break;
                  }
                }
              }
              if (!stillCovering) releaseCover(coverUnit, origTarget);
            }
          }

          /* Safety: any leftover cover (miss-only / skipped waves). */
          if (combat.bestGuard) releaseCover(combat.bestGuard, target);
          if (combat.counterGuard) releaseCover(combat.counterGuard, u);

          /* After Counter / Support Counter finish — drop linger and fade defeated portraits. */
          (function clearLingerKos() {
            var faded = [];
            allies.concat(enemies).forEach(function (x) {
              if (x && x.lingerKo) {
                x.lingerKo = false;
                if ((x.hp | 0) <= 0) faded.push(x.name);
              }
            });
            if (faded.length) {
              snapshotLine(
                'T' + turn + ' Defeated: ' + faded.join(', '),
                null, null, 'step'
              );
            }
          })();
          allies.concat(enemies).forEach(function (x) {
            if (x.covering) releaseCover(x, null);
            if (x.usedSwayInCombat) {
              x.activeSkills = (x.activeSkills || []).filter(function (s) {
                return !(s && /Sway|スウェー/i.test(String(s.name || '')));
              });
              x.usedSwayInCombat = false;
            }
          });

          /*
           * Active unit KO’d then revived / Escaped (counter → Char/Zeong / Escape):
           * action ends. No further move / Chance Step / attack this phase.
           */
          if (u._endActionAfterRevive) {
            u.chanceStepsLeft = 0;
            u.unconditionalCSStock = 0;
            u._endActionAfterRevive = false;
            snapshotLine(
              'T' + turn + ' ' + u.name +
              (u._escapeUsed ? ' escaped' : ' revived') +
              ' — action ends (no further move / CS / attack)',
              null, null, 'skill'
            );
            break;
          }

          gotExtra = false;
          var csLbl = (R.chanceStepLabels && R.chanceStepLabels(lang())) || {
            cs: 'Chance Step', auto: 'Auto-Chance Step', guaranteed: 'Guaranteed Chance Step'
          };
          if (R.checkAndAcquireUnconditionalCS(u)) {
            snapshotLine(
              'T' + turn + ' ' + csLbl.guaranteed + ' stock +1: ' + u.name +
              ' (MP ' + (u.mp | 0) + ' · ' + vigorLabelFromMp(u.mp) + ')',
              null, null, 'skill'
            );
          }
          if ((u.hp | 0) > 0 && living(foes).length) {
            var defForCs = combat.actualDefender || target;
            var killedForCs = ((defForCs && (defForCs.hp | 0) <= 0) || (target.hp | 0) <= 0) ||
              !!(defForCs && defForCs._escapedThisEngagement) ||
              !!(target && target._escapedThisEngagement);
            if (u.lastActionHit && !u._weaponCsGrantedThisAction &&
                (u.chanceStepsLeft | 0) > 0 &&
                R.weaponGrantsUnconditionalCsOnHit(engage.weapon)) {
              /* Weapon on-hit CS still spends the phase Bonus Action budget. */
              u._weaponCsGrantedThisAction = true;
              u.chanceStepsLeft = (u.chanceStepsLeft | 0) - 1;
              gotExtra = true;
              snapshotLine(
                'T' + turn + ' Weapon ' + csLbl.cs + ' (on hit): ' + u.name +
                ' (left ' + (u.chanceStepsLeft | 0) + ')',
                null, null, 'skill'
              );
            } else if (killedForCs && (u.chanceStepsLeft | 0) > 0) {
              /* Phase CS budget (base 1 / +1 → max 2). Kill-gated. */
              u.chanceStepsLeft = (u.chanceStepsLeft | 0) - 1;
              gotExtra = true;
              snapshotLine(
                'T' + turn + ' ' + csLbl.cs + ': ' + u.name + ' (' + (u.chanceStepsLeft | 0) + ')',
                { x: u.x, y: u.y, text: csLbl.cs, badge: 'CS', cls: 'mls-float--skill' },
                { kind: 'chance-step', fromId: u.id, toId: u.id, from: { x: u.x, y: u.y }, to: { x: u.x, y: u.y }, csIcon: true },
                'skill'
              );
            } else if ((u.unconditionalCSStock | 0) > 0 && (u.chanceStepsLeft | 0) > 0) {
              /*
               * Guaranteed Chance Step (Uso Supercharged + League Militaire, …):
               * forces one existing Bonus Action without a KO (help: end of any action).
               * Does not raise chanceCount — spends chanceStepsLeft like kill-CS / Auto-CS.
               */
              u.unconditionalCSStock--;
              u.chanceStepsLeft = (u.chanceStepsLeft | 0) - 1;
              gotExtra = true;
              snapshotLine(
                'T' + turn + ' ' + csLbl.guaranteed + ': ' + u.name +
                ' (stock ' + (u.unconditionalCSStock | 0) + ', left ' + (u.chanceStepsLeft | 0) + ')',
                { x: u.x, y: u.y, text: csLbl.guaranteed, badge: 'CS', cls: 'mls-float--skill' },
                { kind: 'chance-step', fromId: u.id, toId: u.id, from: { x: u.x, y: u.y }, to: { x: u.x, y: u.y }, csIcon: true },
                'skill'
              );
            } else if ((u.autoCsLeft | 0) > 0 && (u.chanceStepsLeft | 0) > 0 &&
                R.grantsAutoCsAfterCombat && R.grantsAutoCsAfterCombat(u)) {
              /* Auto-CS (Mao Ex-S, …): force the existing CS if alive after combat; not +1 budget. */
              u.autoCsLeft = (u.autoCsLeft | 0) - 1;
              u.chanceStepsLeft = (u.chanceStepsLeft | 0) - 1;
              gotExtra = true;
              snapshotLine(
                'T' + turn + ' ' + csLbl.auto + ': ' + u.name +
                ' (left ' + (u.chanceStepsLeft | 0) + ')',
                { x: u.x, y: u.y, text: csLbl.auto, badge: 'CS', cls: 'mls-float--skill' },
                { kind: 'chance-step', fromId: u.id, toId: u.id, from: { x: u.x, y: u.y }, to: { x: u.x, y: u.y }, csIcon: true },
                'skill'
              );
            }
          }
          if (gotExtra) {
            u.badge = 'CS';
            continue;
          }
          break;
        }
      });
      allies.concat(enemies).forEach(function (x) {
        x.skillUsed = false;
        x.usedSkillThisTurn = false;
        x.active = false;
        x.badge = '';
        x.badgeText = '';
        x.badgeIcon = '';
        x.ghostHp = x.hp;
      });
      if (turn === 1) {
        turn1EnemyHp = enemies.reduce(function (s, u) { return s + Math.max(0, u.hp | 0); }, 0);
      }
      /*
       * Optimizer prune (same scoreBetter order): once we already have a win in T turns,
       * any fight still contested after turn T cannot beat it. Equal-or-worse leftover
       * ally HP on an already-known 1T wipe can stop immediately too.
       */
      if (scoreOnly && pruneScore && pruneScore.win) {
        var eLeftP = living(enemies).length;
        var aLeftP = living(allies).length;
        var bestT = pruneScore.turns | 0;
        if (eLeftP > 0 && turn >= bestT) {
          pruned = true;
          return false;
        }
        if (bestT === 1 && (pruneScore.turn1EnemyHp | 0) === 0 && turn === 1 &&
            eLeftP === 0 && aLeftP > 0) {
          var ahNow = allies.reduce(function (s, u) { return s + Math.max(0, u.hp | 0); }, 0);
          if (ahNow <= (pruneScore.allyHp | 0)) {
            pruned = true;
            return false;
          }
        }
      }
      /* Wipe / wipeout: stay on this turn — do not ++ or victory steps stamp TURN+1 on the HUD. */
      if (!living(allies).length || !living(enemies).length) return false;
      turn += 1;
      return true;
    }
    if (asyncTurns) {
      return (function pumpFightTurns() {
        var more;
        try {
          more = runOneFightTurn();
        } catch (fightErr) {
          return Promise.reject(fightErr);
        }
        if (!more) return Promise.resolve(finalizeFightResult());
        /* Yield between turns so Safari can composite READY — never mid-unit-action. */
        return new Promise(function (resolve) { setTimeout(resolve, 0); }).then(pumpFightTurns);
      })();
    }
    while (runOneFightTurn()) {}
    return finalizeFightResult();
  }

  function applySnapshot(allies, enemies, snap) {
    function applyOne(list, s, i) {
      var u;
      if (!list[i] || !s) return;
      u = list[i];
      /* Escape Function: restore form identity so pre-escape steps keep the parent portrait. */
      if (s.id != null) u.id = s.id;
      if (s.name != null) u.name = s.name;
      if (s.thum != null) u.thum = s.thum;
      if (s.maxHp != null) u.maxHp = s.maxHp | 0;
      if (s.maxEn != null) u.maxEn = s.maxEn | 0;
      if (s.isLarge != null) u.isLarge = !!s.isLarge;
      if (s.size != null) u.size = s.size | 0;
      u.x = s.x; u.y = s.y; u.hp = s.hp;
      u.ghostHp = s.ghostHp != null ? s.ghostHp : s.hp;
      u.active = !!s.active;
      u.badge = s.badge || '';
      u.badgeText = s.badgeText || '';
      u.badgeIcon = s.badgeIcon || '';
      u.skillMarkIcon = s.skillMarkIcon || '';
      u.skillMarkText = s.skillMarkText || '';
      if (s.unconditionalCSStock != null) u.unconditionalCSStock = s.unconditionalCSStock | 0;
      if (s.debuffs) {
        u.debuffs = (s.debuffs || []).map(function (d) {
          return d ? {
            type: d.type, value: d.value | 0, untilTurn: d.untilTurn,
            icon: d.icon || '', label: d.label || ''
          } : null;
        }).filter(Boolean);
      }
      u.tension = s.tension | 0;
      u.mp = s.mp | 0;
      u.covering = !!s.covering;
      u.coverTx = s.coverTx;
      u.coverTy = s.coverTy;
      u.sheltered = !!s.sheltered;
      u.lingerKo = !!s.lingerKo;
      u.usedSupportCount = s.usedSupportCount | 0;
      u.usedSupportDefendCount = s.usedSupportDefendCount | 0;
      if (s.saLimit != null) u.saLimit = s.saLimit | 0;
      if (s.sdLimit != null) u.sdLimit = s.sdLimit | 0;
    }
    snap.ally.forEach(function (s, i) { applyOne(allies, s, i); });
    snap.enemy.forEach(function (s, i) { applyOne(enemies, s, i); });
  }

  var BANNER_CUTIN_PATH = '/static/images/Master League/ml_skip_character_cutin_bromide_300010.webp';
  var BANNER_CUTIN_FALLBACK = '/static/images/Master%20League/ml_skip_character_cutin_bromide_300010.webp';

  function bannerCutinUrl() {
    try {
      if (typeof global.imgUrlPreferCdn === 'function') {
        return global.imgUrlPreferCdn(BANNER_CUTIN_PATH) || thumbUrl(BANNER_CUTIN_PATH);
      }
    } catch (eUrl) {}
    return thumbUrl(BANNER_CUTIN_PATH);
  }

  function sameMediaUrl(a, b) {
    var x = String(a || '');
    var y = String(b || '');
    if (x === y) return true;
    try {
      return decodeURIComponent(x) === decodeURIComponent(y);
    } catch (eDec) {
      return false;
    }
  }

  /** Cached decode of READY cutin — resolve only after load (+ decode when available). */
  var bannerCutinWarm = null;

  function preloadBannerArt() {
    var url;
    if (bannerCutinWarm) return bannerCutinWarm;
    url = bannerCutinUrl();
    bannerCutinWarm = new Promise(function (resolve) {
      var img;
      try {
        img = new Image();
        img.decoding = 'async';
        try { img.fetchPriority = 'high'; } catch (eFp) {}
        img.onload = function () {
          if (typeof img.decode === 'function') {
            img.decode().then(function () { resolve(img); }).catch(function () { resolve(img); });
          } else {
            resolve(img);
          }
        };
        img.onerror = function () {
          /* One fallback path (encoded /static); still resolve so Start is not stuck. */
          if (!sameMediaUrl(img.src, BANNER_CUTIN_FALLBACK)) {
            img.onerror = function () { resolve(null); };
            img.src = BANNER_CUTIN_FALLBACK;
            return;
          }
          resolve(null);
        };
        img.src = url;
      } catch (ePre) {
        resolve(null);
      }
    });
    return bannerCutinWarm;
  }

  /** Two paints (+ short mobile settle) so iOS actually composites the bromide before /cal work. */
  function paintReadyFrames() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (mobileBattleSnappy()) setTimeout(resolve, 50);
          else resolve();
        });
      });
    });
  }

  var BANNER_LINE_TEXT = 'READY? GO!!';

  /** Takayu tx-fade-down-out: wrap glyphs; --r = n-1-i so stagger runs from the end. */
  function prepareBannerLine(line) {
    var chars, n, i, ch, html;
    if (!line) return 0;
    chars = Array.from(BANNER_LINE_TEXT);
    n = chars.length;
    html = '';
    for (i = 0; i < n; i++) {
      ch = chars[i] === ' ' ? '\u00a0' : chars[i];
      html += '<span class="mls-banner-line-ch" style="--r:' + (n - 1 - i) + '">' + esc(ch) + '</span>';
    }
    line.innerHTML = html;
    return n;
  }

  function bannerFadeDownOutMs(charCount) {
    var n = Math.max(1, charCount | 0);
    var reduced = false;
    try {
      reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (eR) { reduced = false; }
    if (reduced) return 280;
    /* 0.6s sink + 20ms * (n-1) from-end stagger (Takayu recipe). */
    return 600 + Math.max(0, n - 1) * 20;
  }

  function hideBannerNow() {
    var el = document.getElementById('mlsBanner');
    var cutin, line;
    if (!el) return;
    cutin = el.querySelector('.mls-banner-cutin');
    if (cutin) cutin.style.opacity = '';
    line = el.querySelector('.mls-banner-line');
    if (line) line.textContent = BANNER_LINE_TEXT;
    el.hidden = true;
    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
    el.classList.remove('is-play', 'is-out');
  }

  /**
   * Cutin must be decoded before READY hold — same gate on phone and desktop.
   * Safety timeout only (2.5s); never a short “soft” abort that starts the sim blind.
   */
  function waitBannerCutin(cutin) {
    return preloadBannerArt().then(function () {
      return new Promise(function (resolve) {
        var url = bannerCutinUrl();
        var settled = false;
        var timer;
        function done() {
          if (settled) return;
          settled = true;
          try { if (timer) clearTimeout(timer); } catch (eT) {}
          resolve();
        }
        if (!cutin) {
          done();
          return;
        }
        cutin.removeAttribute('hidden');
        cutin.hidden = false;
        cutin.style.visibility = 'visible';
        cutin.style.opacity = '1';
        cutin.setAttribute('decoding', 'sync');
        cutin.setAttribute('loading', 'eager');
        try { cutin.fetchPriority = 'high'; } catch (eFp) {}
        if (!sameMediaUrl(cutin.currentSrc || cutin.src, url) &&
            !sameMediaUrl(cutin.getAttribute('src'), url)) {
          cutin.src = url;
        }
        if (cutin.complete && cutin.naturalWidth > 0) {
          if (typeof cutin.decode === 'function') {
            cutin.decode().then(done).catch(done);
          } else {
            done();
          }
          return;
        }
        timer = setTimeout(done, 2500);
        cutin.onload = function () {
          if (typeof cutin.decode === 'function') {
            cutin.decode().then(done).catch(done);
          } else {
            done();
          }
        };
        cutin.onerror = function () {
          cutin.onerror = function () { done(); };
          cutin.src = BANNER_CUTIN_FALLBACK;
        };
      });
    });
  }

  function revealBannerShell() {
    var el = document.getElementById('mlsBanner');
    var cutin, line, charCount;
    if (!el) return null;
    line = el.querySelector('.mls-banner-line');
    charCount = prepareBannerLine(line);
    cutin = el.querySelector('.mls-banner-cutin');
    if (cutin) cutin.style.opacity = '';
    el.hidden = false;
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    el.classList.remove('is-out', 'is-play', 'is-snappy');
    return { el: el, cutin: cutin, charCount: charCount };
  }

  function runBannerHold(el, charCount) {
    var holdMs, outMs;
    if (!el) return Promise.resolve();
    void el.offsetWidth;
    el.classList.add('is-play');
    /* Same READY timing phone + desktop — do not shorten the opening on mobile. */
    holdMs = Math.round(1400 / Math.max(1, speedMul));
    /* Exit: Takayu tx-fade-down-out on title (+ cutin sinks with it). */
    outMs = Math.round(bannerFadeDownOutMs(charCount) / Math.max(1, speedMul));
    return sleep(holdMs).then(function () {
      el.classList.add('is-out');
      return sleep(outMs);
    }).then(function () {
      hideBannerNow();
    });
  }

  function showBanner() {
    var shell = revealBannerShell();
    if (!shell) return Promise.resolve();
    return waitBannerCutin(shell.cutin).then(function () {
      return runBannerHold(shell.el, shell.charCount);
    });
  }

  /**
   * Yield a frame, then run the sim. Mobile uses asyncTurns so a long fight does not
   * hard-lock Safari after READY; desktop stays one-shot (usually finishes in the hold).
   */
  function computeFightAsync(allies, enemies) {
    return new Promise(function (resolve, reject) {
      requestAnimationFrame(function () {
        setTimeout(function () {
          var out;
          try {
            /* Live Start: free rolls — never replay optimizer crit luck. */
            endSeededFight();
            out = fightSteps(
              cloneArmy(allies),
              cloneArmy(enemies),
              mobileBattleSnappy() ? { asyncTurns: true } : null
            );
            if (out && typeof out.then === 'function') out.then(resolve, reject);
            else resolve(out);
          } catch (err) {
            reject(err);
          }
        }, 0);
      });
    });
  }

  /** Takayu catalog-game-cinematic-victory-title / defeat-dissolve. */
  function hideEndCard() {
    var card = document.getElementById('mlsEndCard');
    var letters = document.getElementById('mlsEndLetters');
    if (!card) return;
    card.hidden = true;
    card.classList.remove('is-victory', 'is-defeat', 'is-draw', 'is-play');
    card.setAttribute('aria-hidden', 'true');
    if (letters) letters.innerHTML = '';
  }

  function showEndCard(result) {
    var card = document.getElementById('mlsEndCard');
    var title = document.getElementById('mlsEndTitle');
    var sub = document.getElementById('mlsEndSub');
    var retry = document.getElementById('mlsEndRetry');
    var letters = document.getElementById('mlsEndLetters');
    var mode, hold, word, i, ch;
    if (!card || !title) return Promise.resolve();
    hideEndCard();
    if (result && result.win) {
      mode = 'victory';
      title.textContent = mlsT('mls_victory', 'VICTORY');
      title.hidden = false;
      if (sub) sub.textContent = mlsT('mls_battle_won', 'THE BATTLE IS WON');
      if (letters) { letters.hidden = true; letters.innerHTML = ''; }
      if (retry) retry.hidden = true;
      hold = 2800;
    } else if (result && result.draw) {
      mode = 'draw';
      title.textContent = mlsT('mls_time_up', 'TIME UP');
      title.hidden = false;
      if (sub) sub.textContent = mlsT('mls_both_remain', 'BOTH SIDES REMAIN');
      if (letters) { letters.hidden = true; letters.innerHTML = ''; }
      if (retry) retry.hidden = true;
      hold = 2200;
    } else {
      mode = 'defeat';
      title.textContent = '';
      title.hidden = true;
      if (sub) sub.textContent = '';
      /* Letter-by-letter dissolve (Takayu defeat-dissolve). */
      if (letters) {
        letters.hidden = false;
        word = 'DEFEAT';
        letters.innerHTML = '';
        for (i = 0; i < word.length; i++) {
          ch = document.createElement('span');
          ch.className = 'mls-endcard-letter';
          ch.style.setProperty('--mls-letter-i', String(i));
          ch.textContent = word.charAt(i);
          letters.appendChild(ch);
        }
      }
      if (retry) retry.hidden = false;
      hold = 2800;
    }
    card.className = 'mls-endcard is-' + mode;
    card.hidden = false;
    card.setAttribute('aria-hidden', 'false');
    void card.offsetWidth;
    card.classList.add('is-play');
    return sleep(hold).then(function () {
      /* Defeat keeps TRY AGAIN until dismissed; victory/draw auto-clear. */
      if (mode !== 'defeat') hideEndCard();
    });
  }

  function setAiProgress(done, total) {
    var wrap = document.getElementById('mlsAiProgress');
    var bar = document.getElementById('mlsAiProgressBar');
    var fill = bar && bar.querySelector('.mls-ai-progress-fill');
    var pct;
    if (!wrap) return;
    if (!total) {
      wrap.hidden = true;
      if (fill) fill.style.setProperty('--mls-ai-pct', '0');
      else if (bar) bar.style.setProperty('--mls-ai-pct', '0');
      return;
    }
    wrap.hidden = false;
    pct = Math.max(0, Math.min(100, Math.round(100 * (done | 0) / total)));
    /* Takayu progress-fill: scaleX from left (not width). */
    if (fill) fill.style.setProperty('--mls-ai-pct', String(pct / 100));
    else if (bar) bar.style.setProperty('--mls-ai-pct', String(pct / 100));
    wrap.setAttribute('aria-valuenow', String(pct));
  }

  /**
   * Let the progress bar paint without burning ~30ms/double-rAF per lineup.
   * One rAF + setTimeout(0) is enough between optimizer batches.
   */
  function yieldUi() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        setTimeout(resolve, 0);
      });
    });
  }

  function setFightControls(busy) {
    var start = document.getElementById('mlsFight');
    var pause = document.getElementById('mlsPause');
    var skip = document.getElementById('mlsSkip');
    var reset = document.getElementById('mlsReset');
    var boardEl = document.getElementById('mlsBoard');
    var shell = document.querySelector('#panel-ml_sim .mls-shell');
    if (start) {
      start.disabled = !!busy;
      start.textContent = busy ? mlsT('mls_sim_running', 'RUNNING…') : mlsT('mls_sim_start', 'SIMULATION START');
      start.style.display = busy ? 'none' : '';
    }
    if (pause) {
      pause.disabled = !busy;
      pause.style.display = busy ? '' : 'none';
      pause.textContent = paused ? mlsT('mls_resume', 'RESUME') : mlsT('mls_pause', 'PAUSE');
    }
    if (skip) skip.disabled = !busy;
    if (reset) reset.disabled = !!busy;
    if (boardEl) boardEl.classList.toggle('is-fighting', !!busy);
    if (shell) shell.classList.toggle('is-fighting', !!busy);
    try { document.body.classList.toggle('mls-is-fighting', !!busy); } catch (eFight) {}
  }

  function onResetBattle() {
    function doReset() {
      hideEndCard();
      hideTurnHud();
      fightBusy = false;
      paused = false;
      skipAll = false;
      pauseWait = null;
      clearTimelinePhase();
      setFightControls(false);
      clearMapCameraLock();
      return loadArmies().then(function () {
        paintBoard();
        paintTimeline();
        var logEl = document.getElementById('mlsLog');
        if (logEl) logEl.textContent = '';
        log('Board reset to formation start.');
      });
    }
    if (fightBusy) {
      skipAll = true;
      paused = false;
      if (pauseWait) pauseWait();
      return new Promise(function (resolve) {
        var n = 0;
        var t = setInterval(function () {
          n += 1;
          if (!fightBusy || n > 200) {
            clearInterval(t);
            resolve(doReset());
          }
        }, 40);
      });
    }
    return doReset();
  }

  function setGateVisible(show) {
    var shell = document.getElementById('mlsShell');
    var gate = document.getElementById('mlsGate');
    if (shell) shell.classList.toggle('is-locked', !!show);
    if (gate) {
      if (show) {
        gate.hidden = false;
        gate.removeAttribute('hidden');
      } else {
        gate.hidden = true;
        gate.setAttribute('hidden', '');
      }
    }
  }

  function bindGate() {
    if (gateBound) return;
    gateBound = true;
    var form = document.getElementById('mlsGateForm');
    var backBtn = document.getElementById('mlsGateBack');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        submitMlsUnlock();
      });
    }
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (typeof global.switchTab === 'function') global.switchTab('master_league');
      });
    }
  }

  function submitMlsUnlock() {
    var inp = document.getElementById('mlsGateInput');
    var err = document.getElementById('mlsGateErr');
    var btn = document.getElementById('mlsGateUnlock');
    var pw = inp ? String(inp.value || '').trim() : '';
    if (err) err.textContent = '';
    if (!pw) {
      if (err) err.textContent = 'Enter the password, then Unlock.';
      if (inp) try { inp.focus(); } catch (_) {}
      return Promise.resolve(false);
    }
    if (btn) btn.disabled = true;
    return fetch('/api/ml_sim/unlock', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        return { ok: r.ok, status: r.status, body: d };
      });
    }).then(function (pack) {
      if (!pack.ok) {
        if (err) {
          err.textContent = pack.status === 403
            ? 'Wrong password.'
            : ('Unlock failed (' + (pack.status || '?') + ').');
        }
        if (inp) {
          inp.select();
          try { inp.focus(); } catch (_) {}
        }
        return false;
      }
      mlsUnlocked = true;
      setGateVisible(false);
      if (inp) inp.value = '';
      return loadMlsContent().then(function () { return true; });
    }).catch(function (e) {
      if (err) err.textContent = String(e && e.message || e);
      return false;
    }).then(function (ok) {
      if (btn) btn.disabled = false;
      return ok;
    });
  }

  function loadMlsContent() {
    roster = loadRoster();
    preloadBannerArt();
    return fetchJson('/api/master_league?lang=' + encodeURIComponent(lang()))
      .then(function (d) {
        seasons = d.seasons || [];
        fillSeasonSelect();
        var sel = document.getElementById('mlsSeasonSelect');
        var eventId = (sel && sel.value) || roster.eventId || DEFAULT_EVENT;
        return loadBoardForEvent(eventId);
      })
      .then(function () {
        return hydrateSlotPilotsAndOps();
      })
      .then(function () {
        setView(viewName || 'formation');
        fillShareBoxes();
        scheduleOrderRefresh();
        scheduleWarmArmies();
        log('Set enemy (left) and ally (right), then SIMULATION START.');
      });
  }

  function ensureMlsUnlocked() {
    bindGate();
    return fetch('/api/ml_sim/status', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        var required = !!(d && d.password_required);
        var unlocked = !!(d && d.unlocked);
        mlsUnlocked = !required || unlocked;
        if (mlsUnlocked) {
          setGateVisible(false);
          return true;
        }
        setGateVisible(true);
        var inp = document.getElementById('mlsGateInput');
        if (inp) {
          inp.value = '';
          setTimeout(function () { try { inp.focus(); } catch (_) {} }, 60);
        }
        return false;
      })
      .catch(function () {
        /* Fail closed while gate is intended. */
        mlsUnlocked = false;
        setGateVisible(true);
        return false;
      });
  }

  function onFight() {
    if (fightBusy) return Promise.resolve();
    /* Arm busy before setView so its idle loadArmies cannot race and blank thumbs. */
    skipAll = false;
    paused = false;
    fightBusy = true;
    setFightControls(true);
    setView('battle');
    preloadBannerArt();
    log('Loading forces…');
    /*
     * Same beat phone + desktop (look/features unchanged):
     * 1) Load + paint lineup
     * 2) Decode cutin, reveal READY, paint frames (bromide on screen)
     * 3) Start hold and fightSteps together (cutin already committed by paintReadyFrames)
     *    — phone: ~8ms slices so the banner keeps compositing
     *    — desktop: one shot, usually finishes inside the hold
     * 4) playFight when hold + sim both done
     */
    return loadArmies().then(function () {
      if (!lastAlly.length || !lastEnemy.length) {
        var emptyErr = new Error('Fill both enemy (left) and ally (right) forces on the Formation tab first.');
        emptyErr.code = 'mls-empty';
        throw emptyErr;
      }
      paintBoard();
      paintTimeline();
      return preloadBannerArt();
    }).then(function () {
      var shell = revealBannerShell();
      return waitBannerCutin(shell && shell.cutin).then(function () {
        return paintReadyFrames().then(function () { return shell; });
      });
    }).then(function (shell) {
      var bannerP = runBannerHold(shell && shell.el, shell && shell.charCount);
      var simP = computeFightAsync(lastAlly, lastEnemy);
      return Promise.all([bannerP, simP]).then(function (pair) {
        return playFight(pair[1]);
      });
    }).catch(function (e) {
      hideBannerNow();
      fightBusy = false;
      paused = false;
      skipAll = false;
      clearTimelinePhase();
      setFightControls(false);
      if (e && e.code === 'mls-empty') {
        setView('formation');
        log(e.message);
        return;
      }
      log(String(e && e.message || e));
    });
  }

  function setTurnHud(turnNum, limitNum, opts) {
    var hud = document.getElementById('mlsTurnHud');
    var numEl = document.getElementById('mlsTurnHudNum');
    var maxEl = document.getElementById('mlsTurnHudMax');
    var lim = Math.max(1, limitNum | 0);
    var t = Math.max(1, Math.min(lim, turnNum | 0));
    var tick = !!(opts && opts.tick);
    if (!hud) return;
    if (numEl) numEl.textContent = String(t);
    if (maxEl) maxEl.textContent = String(lim);
    hud.hidden = false;
    hud.setAttribute('aria-label', 'Turn ' + t + ' of ' + lim);
    if (tick) {
      hud.classList.remove('is-tick');
      void hud.offsetWidth;
      hud.classList.add('is-tick');
    }
  }

  function hideTurnHud() {
    var hud = document.getElementById('mlsTurnHud');
    if (!hud) return;
    hud.hidden = true;
    hud.classList.remove('is-tick');
  }

  function playFight(result) {
    var allies = cloneArmy(result.allies);
    var enemies = cloneArmy(result.enemies);
    var turnLimit = (board && board.limit_turns) || 5;
    var shownTurn = 0;
    lastAlly = allies;
    lastEnemy = enemies;
    hideEndCard();
    lockTimelinePhase(allies, enemies);
    /*
     * cloneArmy restores home cells + full HP — repaint start thumbs instead of
     * blanking the layer (that removed portraits between READY and the first beat).
     */
    paintBoard();
    paintTimeline({ battleOnly: true });
    setTurnHud(1, turnLimit, { tick: false });
    var logLines = [];
    var i = 0;
    return new Promise(function (resolve) {
      function next() {
        if (i >= result.steps.length) {
          allies.forEach(function (u) { u.active = false; });
          enemies.forEach(function (u) { u.active = false; });
          /* End board: keep HUD on the last fought turn (not a phantom next turn). */
          if ((result.turns | 0) > 0) setTurnHud(result.turns | 0, turnLimit, { tick: false });
          clearTimelinePhase();
          paintBoard();
          paintTimeline();
          showEndCard(result).then(function () {
            fightBusy = false;
            paused = false;
            skipAll = false;
            setFightControls(false);
            resolve();
          });
          return;
        }
        var step = result.steps[i++];
        var paceKind = step.pace || (step.link && step.link.kind) || 'step';
        var stepTurn = step.turn | 0;
        var hudCap = (result.turns | 0) > 0 ? (result.turns | 0) : turnLimit;
        applySnapshot(allies, enemies, step);
        if (paceKind === 'turn' || (stepTurn > 0 && stepTurn !== shownTurn)) {
          /* Match sim: re-lock order to living units at this turn’s start. */
          lockTimelinePhase(allies, enemies);
        }
        if (stepTurn > 0 && stepTurn !== shownTurn) {
          /* Never flash TURN N+1 after a fight that ended on turn N. */
          shownTurn = Math.min(stepTurn, hudCap);
          setTurnHud(shownTurn, turnLimit, { tick: paceKind === 'turn' || shownTurn > 1 });
        }
        if (step.text) {
          logLines.push(step.text);
          if (logLines.length > 60) logLines = logLines.slice(-48);
          log(logLines.join('\n'));
        }
        paintBoard(skipAll ? null : step.float, skipAll ? null : step.link, !skipAll);
        /* Full dual-timeline rebuild every beat janks iOS — battle strip only, and not every step. */
        if (skipAll || paceKind === 'turn' || paceKind === 'attack' || paceKind === 'counter' ||
            i === result.steps.length || (i % 4) === 0) {
          paintTimeline({ battleOnly: true });
        }
        if (skipAll) {
          next();
          return;
        }
        /* Brief beat on the SD hit float, then cover-return plays immediately after. */
        var hold = (step.link && step.link.coverTo && step.float)
          ? Math.round(160 / battlePaceMul())
          : 0;
        sleep(stepDelay(paceKind) + hold).then(next);
      }
      next();
    });
  }

  function permute(arr) {
    if (arr.length <= 1) return [arr.slice()];
    var out = [];
    var i, j, rest, pref;
    for (i = 0; i < arr.length; i++) {
      rest = arr.slice(0, i).concat(arr.slice(i + 1));
      pref = permute(rest);
      for (j = 0; j < pref.length; j++) out.push([arr[i]].concat(pref[j]));
    }
    return out;
  }

  function setAiStatus(text) {
    var el = document.getElementById('mlsAiStatus');
    if (el) el.textContent = text || '';
  }

  function scoreBetter(a, b) {
    if (!b) return true;
    if (a.win !== b.win) return a.win;
    if (a.turns !== b.turns) return a.turns < b.turns;
    /* 1-turn kill: enemy HP left after turn 1 (0 = wiped). */
    if (a.turn1EnemyHp !== b.turn1EnemyHp) return a.turn1EnemyHp < b.turn1EnemyHp;
    return a.allyHp > b.allyHp;
  }

  /**
   * AI Search — permute ally LINE slots. Same RNG seed every lineup.
   * Prefer a win, then fewest turns, then a turn-1 wipe, then leftover ally HP.
   * Writes the winning order back onto the map (portraits follow the new cells).
   *
   * Speed (ranking unchanged):
   *  - one no-crit sim per lineup (crit label only on the winner)
   *  - prune fights that cannot beat the current best
   *  - sync batches + light UI yield (not per-lineup double-rAF)
   */
  function runAiSearch() {
    var force = forceOf('ally');
    var filled = [];
    var i, perms, original, best, bestScore, result, score, status, names, same;
    var aiBtn = document.getElementById('mlsAiSearch');
    var searchStarted = 0;
    if (fightBusy) return;
    for (i = 0; i < SLOT_COUNT; i++) {
      if (force.slots[i] && force.slots[i].unitId) filled.push(i);
    }
    if (filled.length < 2) {
      setAiStatus('Need ≥2 allies');
      return;
    }
    if (filled.length > 5) {
      setAiStatus('Too many filled slots');
      return;
    }
    perms = permute(filled);
    if (perms.length > 120) {
      setAiStatus('Too many orders');
      return;
    }
    original = force.slots.slice();
    best = null;
    bestScore = null;
    setAiStatus('Searching 0/' + perms.length + '…');
    setAiProgress(0, perms.length);
    setView('battle');
    if (aiBtn) aiBtn.disabled = true;

    function applyPerm(perm) {
      var next = original.slice();
      var k, sl;
      for (k = 0; k < filled.length; k++) next[filled[k]] = original[perm[k]];
      force.slots = next;
      /*
       * Slot objects carry optional map-drag x/y. Moving a unit into a new LINE index
       * must use that index’s board spawn — keep stale homes and two units stack on
       * one cell (looks like “4 units, two overlapping” for a full 5-man).
       */
      for (k = 0; k < filled.length; k++) {
        sl = force.slots[filled[k]];
        if (!sl) continue;
        delete sl.x;
        delete sl.y;
      }
    }

    function restore() {
      endSeededFight();
      force.slots = original.slice();
      saveRoster();
      paintForceSlots();
      setAiProgress(0, 0);
      if (aiBtn) aiBtn.disabled = false;
    }

    setAiStatus('Loading…');
    setAiProgress(0, perms.length);
    searchStarted = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return loadArmies().then(function () {
      var byOrigSlot = {};
      var baseEnemy = lastEnemy.slice();
      var pi = 0;
      /* Sync batch size: enough work per slice, progress still paints (~15 yields for 120). */
      var AI_BATCH = 12;
      if (!lastAlly.length || !baseEnemy.length) return;
      lastAlly.forEach(function (u) {
        if (u) byOrigSlot[u.slotIdx | 0] = u;
      });

      function alliesForPerm(perm) {
        var allies = [];
        var k, destSlot, src, home, one;
        applyPerm(perm);
        for (k = 0; k < filled.length; k++) {
          destSlot = filled[k];
          src = byOrigSlot[perm[k]];
          if (!src) continue;
          home = effectiveSlotHome('ally', destSlot);
          /* One clone here — fightSteps must not cloneArmy(allies) again. */
          one = cloneArmy([src])[0];
          one.slotIdx = destSlot;
          one.n = home.n | 0;
          one.x = home.x | 0;
          one.y = home.y | 0;
          one.homeX = home.x | 0;
          one.homeY = home.y | 0;
          allies.push(one);
        }
        return allies;
      }

      function simPerm(perm) {
        var allies = alliesForPerm(perm);
        var allyHpSum, t1NoCrit;
        if (!allies.length) return;
        try {
          /* Fair ranking = no crits. Crit label is computed once on the winner. */
          beginSeededFight(OPTIMIZER_SEED);
          result = fightSteps(allies, cloneArmy(baseEnemy), {
            scoreOnly: true,
            forceNoCrit: true,
            pruneScore: bestScore
          });
          if (result && result.pruned) return;
          t1NoCrit = result.turn1EnemyHp != null ? (result.turn1EnemyHp | 0) : 1e15;
          allyHpSum = (result.allies || []).reduce(function (s, u) { return s + Math.max(0, u.hp | 0); }, 0);
          score = {
            win: !!result.win,
            turns: result.turns | 0,
            turn1EnemyHp: t1NoCrit,
            allyHp: allyHpSum,
            needsCritFor1T: false,
            perm: perm.slice()
          };
          if (scoreBetter(score, bestScore)) {
            bestScore = score;
            best = perm.slice();
          }
        } catch (simErr) {
          log('Optimizer skip lineup ' + (pi + 1) + ': ' + String(simErr && simErr.message || simErr));
        } finally {
          endSeededFight();
        }
      }

      function runBatch() {
        var end;
        if (pi >= perms.length) return Promise.resolve();
        end = Math.min(perms.length, pi + AI_BATCH);
        while (pi < end) {
          simPerm(perms[pi]);
          pi += 1;
        }
        setAiProgress(pi, perms.length);
        setAiStatus(pi + '/' + perms.length);
        if (pi >= perms.length) return Promise.resolve();
        return yieldUi().then(runBatch);
      }

      return runBatch();
    }).then(function () {
      var alliesBest, resultCrit, t1Crit, ms, byOrig, dest, srcU, hm, unit;
      endSeededFight();
      /* One crit pass on the winner — only for the “needs crit for 1T” HUD tag. */
      if (best && bestScore && (bestScore.turn1EnemyHp | 0) > 0) {
        try {
          byOrig = {};
          lastAlly.forEach(function (u) { if (u) byOrig[u.slotIdx | 0] = u; });
          alliesBest = [];
          applyPerm(best);
          for (i = 0; i < filled.length; i++) {
            dest = filled[i];
            srcU = byOrig[best[i]];
            if (!srcU) continue;
            hm = effectiveSlotHome('ally', dest);
            unit = cloneArmy([srcU])[0];
            unit.slotIdx = dest;
            unit.n = hm.n | 0;
            unit.x = hm.x | 0;
            unit.y = hm.y | 0;
            unit.homeX = hm.x | 0;
            unit.homeY = hm.y | 0;
            alliesBest.push(unit);
          }
          if (alliesBest.length) {
            beginSeededFight(OPTIMIZER_SEED);
            resultCrit = fightSteps(alliesBest, cloneArmy(lastEnemy), {
              scoreOnly: true, forceNoCrit: false
            });
            t1Crit = resultCrit.turn1EnemyHp != null ? (resultCrit.turn1EnemyHp | 0) : 1e15;
            bestScore.needsCritFor1T = t1Crit === 0;
          }
        } catch (eCrit) {
          /* label optional */
        } finally {
          endSeededFight();
        }
      }
      if (aiBtn) aiBtn.disabled = false;
      setAiProgress(perms.length, perms.length);
      if (!best) {
        restore();
        setAiStatus('No result');
        return;
      }
      applyPerm(best);
      saveRoster();
      paintForceSlots();
      same = best.every(function (idx, k) { return idx === filled[k]; });
      names = [];
      filled.forEach(function (slotIdx) {
        var sl = force.slots[slotIdx];
        if (sl && sl.name) names.push(sl.name);
      });
      /*
       * Keep the HUD short (narrow AI cluster truncates). Full order → battle log only;
       * portraits already show the applied lineup.
       */
      if (bestScore.win) {
        if (bestScore.turn1EnemyHp === 0) status = 'Best: 1T wipe';
        else status = 'Best: win ' + bestScore.turns + 'T';
        if (bestScore.needsCritFor1T) status += ' · needs crit for 1T';
      } else {
        status = 'Best: survive ' + bestScore.turns + 'T';
        if (bestScore.needsCritFor1T) status += ' · needs crit for 1T';
      }
      if (same) status += ' · unchanged';
      else status += ' · order applied';
      ms = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) - searchStarted;
      if (ms > 0 && ms < 600000) status += ' · ' + (ms < 1000 ? Math.round(ms) + 'ms' : (ms / 1000).toFixed(1) + 's');
      setAiStatus(status);
      log('Formation Optimizer — ' + status +
        (names.length && !same ? (' · ' + names.join(' → ')) : ''));
      return loadArmies().then(function () {
        var host = document.getElementById('mlsBoard');
        var layer;
        if (host) {
          host.removeAttribute('data-layout');
          layer = host.querySelector('.mls-token-layer');
          /* Drop stale portraits. Cells were keeping the previous unit art. */
          if (layer) layer.innerHTML = '';
        }
        paintBoard();
        paintTimeline();
        return sleep(400).then(function () { setAiProgress(0, 0); });
      });
    }).catch(function (e) {
      restore();
      setAiStatus('Failed');
      log(String(e && e.message || e));
    });
  }

  function loadBoardForEvent(eventId) {
    var id = String(eventId || DEFAULT_EVENT);
    var prevId = String(roster.eventId || '');
    /*
     * Map-drag homes are absolute cells for the current board. Keeping them across a
     * season switch parks both sides on the wrong formation (user report: swap then
     * change season → both sides’ starts look wrong).
     */
    if (prevId && prevId !== id) {
      clearMapHomeOverrides();
    }
    roster.eventId = id;
    saveRoster();
    seasonMeta = findSeason(id);
    clearMapCameraLock();
    paintPreset();
    return fetchJson('/api/master_league/sim_board?event_id=' + encodeURIComponent(id) + '&lang=' + encodeURIComponent(lang()))
      .then(function (data) {
        board = data;
        scrubInvalidMapHomeOverrides();
        saveRoster();
        paintPreset();
        paintForceSlots();
        if (viewName === 'battle') {
          return loadArmies().then(paintBoard);
        }
      });
  }

  function bind() {
    var root = document.getElementById('panel-ml_sim');
    if (!root || root._mlsBound) return;
    root._mlsBound = 1;
    preloadBannerArt();

    if (!mapFitBound) {
      mapFitBound = true;
      var fitTimer = null;
      var lastScrollBox = { w: 0, h: 0 };
      function onMapFit() {
        var sc, w, h;
        if (viewName !== 'battle' || !board) return;
        sc = document.querySelector('#mlsViewBattle .mls-map-scroll');
        if (!sc) return;
        w = sc.clientWidth | 0;
        h = sc.clientHeight | 0;
        /* Ignore noise / self-inflicted layout — only real viewport changes re-fit cell size. */
        if (Math.abs(w - lastScrollBox.w) < 2 && Math.abs(h - lastScrollBox.h) < 2 && lastScrollBox.w) return;
        lastScrollBox = { w: w, h: h };
        if (fitTimer) clearTimeout(fitTimer);
        fitTimer = setTimeout(function () {
          lockedMapCellPx = 0;
          paintBoard();
        }, 80);
      }
      window.addEventListener('resize', onMapFit);
      try {
        var sc = document.querySelector('#mlsViewBattle .mls-map-scroll');
        if (sc && typeof ResizeObserver !== 'undefined') {
          lastScrollBox = { w: sc.clientWidth | 0, h: sc.clientHeight | 0 };
          new ResizeObserver(onMapFit).observe(sc);
        }
      } catch (eFit) {}
    }

    document.getElementById('mlsSeasonSelect') && document.getElementById('mlsSeasonSelect').addEventListener('change', function (e) {
      loadBoardForEvent(e.target.value).catch(function (err) { log(String(err && err.message || err)); });
    });

    document.getElementById('mlsTabFormation') && document.getElementById('mlsTabFormation').addEventListener('click', function () {
      setView('formation');
    });
    document.getElementById('mlsTabBattle') && document.getElementById('mlsTabBattle').addEventListener('click', function () {
      setView('battle');
    });
    document.getElementById('mlsGotoBattle') && document.getElementById('mlsGotoBattle').addEventListener('click', function () {
      setView('battle');
    });
    bindMapTokenDrag();
    document.getElementById('mlsBackForm') && document.getElementById('mlsBackForm').addEventListener('click', function () {
      setView('formation');
    });
    document.getElementById('mlsClearRoster') && document.getElementById('mlsClearRoster').addEventListener('click', function () {
      roster.enemy = emptyForce();
      roster.ally = emptyForce();
      saveRoster();
      paintForceSlots();
      lastAlly = [];
      lastEnemy = [];
      sideSupportData.ally = null;
      sideSupportData.enemy = null;
      clearMapCameraLock();
      paintBoard();
      paintTimeline();
      fillShareBoxes();
      log('Forces cleared.');
    });
    document.getElementById('mlsOrderEnemies') && document.getElementById('mlsOrderEnemies').addEventListener('change', onOrderEnemiesChange);
    document.getElementById('mlsOrderEnemiesForm') && document.getElementById('mlsOrderEnemiesForm').addEventListener('change', onOrderEnemiesChange);
    document.getElementById('mlsShareEnemyCopy') && document.getElementById('mlsShareEnemyCopy').addEventListener('click', function () { copyShare('enemy'); });
    document.getElementById('mlsShareAllyCopy') && document.getElementById('mlsShareAllyCopy').addEventListener('click', function () { copyShare('ally'); });
    document.getElementById('mlsShareEnemyPaste') && document.getElementById('mlsShareEnemyPaste').addEventListener('click', function () {
      loadShareFromClipboard('enemy');
    });
    document.getElementById('mlsShareAllyPaste') && document.getElementById('mlsShareAllyPaste').addEventListener('click', function () {
      loadShareFromClipboard('ally');
    });
    /* Enter in the share box applies that side’s code (manual paste path). */
    ['mlsShareEnemy', 'mlsShareAlly'].forEach(function (id) {
      var box = document.getElementById(id);
      if (!box) return;
      box.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' || ev.shiftKey) return;
        ev.preventDefault();
        applyShareCode(id === 'mlsShareEnemy' ? 'enemy' : 'ally', box.value);
      });
    });
    document.getElementById('mlsUseCollections') && document.getElementById('mlsUseCollections').addEventListener('change', function () {
      var nLb = 0;
      var nGrey = 0;
      if (this.checked) {
        nLb = syncAllyLbsFromCollections({ forcePaint: true });
      }
      forceOf('ally').slots.forEach(function (sl) {
        if (slotExcludedByCollections(sl, 'ally')) nGrey += 1;
      });
      if (supporterExcludedByCollections(forceOf('ally').supporter, 'ally')) nGrey += 1;
      paintForceSlots();
      scheduleOrderRefresh();
      if (viewName === 'battle') {
        loadArmies().then(function () { paintBoard(); paintTimeline(); });
      }
      if (this.checked) {
        log('My Collections on (ally only) — ' +
          (nLb ? (nLb + ' LB synced; ') : '') +
          (nGrey ? (nGrey + ' kit(s) greyed out (hidden on Battle).') : 'all ally kits are in Collections.') +
          ' Enemy force unchanged.');
      } else {
        log('My Collections off — full ally roster on Battle; LB no longer auto-synced.');
      }
    });
    /* Face strip click = copy (same as Copy button). */
    document.querySelectorAll('.mls-share-faces').forEach(function (faces) {
      faces.addEventListener('click', function () {
        var col = faces.closest('.mls-share-col');
        var side = col && col.classList.contains('mls-share-col--enemy') ? 'enemy' : 'ally';
        copyShare(side);
      });
    });
    document.getElementById('mlsPickerFilters') && document.getElementById('mlsPickerFilters').addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('.mls-chip');
      var row, kind, qEl;
      if (!btn) return;
      row = btn.parentElement;
      kind = row && row.getAttribute('data-mls-filter');
      if (!kind) return;
      Array.prototype.forEach.call(row.querySelectorAll('.mls-chip'), function (b) {
        b.classList.toggle('is-on', b === btn);
      });
      pickerFilter[kind] = btn.getAttribute('data-val') || '';
      qEl = document.getElementById('mlsPickerSearch');
      runPickerSearch(qEl ? qEl.value : '').then(renderPickerRows);
    });

    root.addEventListener('click', function (e) {
      var t = e.target;
      var el, parts, side, idx, tier, kind;
      el = t.closest && t.closest('[data-mls-pick-supp]');
      if (el) { openPicker('supporter', el.getAttribute('data-mls-pick-supp'), 0); return; }
      el = t.closest && t.closest('[data-mls-clear-supp]');
      if (el) { e.preventDefault(); e.stopPropagation(); clearSupporter(el.getAttribute('data-mls-clear-supp')); return; }
      el = t.closest && t.closest('[data-mls-clear-units]');
      if (el) {
        e.preventDefault();
        e.stopPropagation();
        clearForceUnits(el.getAttribute('data-mls-clear-units'));
        return;
      }
      el = t.closest && t.closest('[data-mls-pick-pilot]');
      if (el) {
        e.preventDefault(); e.stopPropagation();
        parts = String(el.getAttribute('data-mls-pick-pilot') || '').split(':');
        openPicker('character', parts[0], parseInt(parts[1], 10) || 0);
        return;
      }
      el = t.closest && t.closest('[data-mls-pick-unit]');
      if (el) {
        parts = String(el.getAttribute('data-mls-pick-unit') || '').split(':');
        openPicker('unit', parts[0], parseInt(parts[1], 10) || 0);
        return;
      }
      el = t.closest && t.closest('[data-mls-pick-op]');
      if (el) {
        parts = String(el.getAttribute('data-mls-pick-op') || '').split(':');
        openPicker('option', parts[0], parseInt(parts[1], 10) || 0);
        return;
      }
      el = t.closest && t.closest('[data-mls-clear-op]');
      if (el) {
        e.preventDefault(); e.stopPropagation();
        parts = String(el.getAttribute('data-mls-clear-op') || '').split(':');
        clearOption(parts[0], parseInt(parts[1], 10) || 0);
        return;
      }
      el = t.closest && t.closest('[data-mls-lb]');
      if (el) {
        e.preventDefault(); e.stopPropagation();
        parts = String(el.getAttribute('data-mls-lb') || '').split(':');
        side = parts[0]; idx = parseInt(parts[1], 10) || 0; tier = parseInt(parts[2], 10) || 0; kind = parts[3] || 'unit';
        setSlotLb(side, idx, tier, kind);
        return;
      }
      el = t.closest && t.closest('[data-mls-stat]');
      if (el) {
        e.preventDefault(); e.stopPropagation();
        parts = String(el.getAttribute('data-mls-stat') || '').split(':');
        setSlotStatMode(parts[0], parseInt(parts[1], 10) || 0, parts[2] || 'unit', parts[3] || 'sp');
        return;
      }
      el = t.closest && t.closest('[data-mls-pick-id]');
      if (el) {
        applyPickerChoice(el.getAttribute('data-mls-pick-id'));
      }
    });

    document.getElementById('mlsPickerClose') && document.getElementById('mlsPickerClose').addEventListener('click', closePicker);
    document.getElementById('mlsPicker') && document.getElementById('mlsPicker').addEventListener('click', function (e) {
      if (e.target && e.target.id === 'mlsPicker') closePicker();
    });
    document.getElementById('mlsPickerSearch') && document.getElementById('mlsPickerSearch').addEventListener('input', function (e) {
      schedulePickerSearch(e.target.value);
    });

    document.getElementById('mlsFight') && document.getElementById('mlsFight').addEventListener('click', function () {
      onFight();
    });
    document.getElementById('mlsPause') && document.getElementById('mlsPause').addEventListener('click', function () {
      if (!fightBusy) return;
      paused = !paused;
      setFightControls(true);
      if (!paused && pauseWait) pauseWait();
    });
    document.getElementById('mlsSkip') && document.getElementById('mlsSkip').addEventListener('click', function () {
      if (!fightBusy) return;
      skipAll = true;
      paused = false;
      if (pauseWait) pauseWait();
    });
    document.getElementById('mlsReset') && document.getElementById('mlsReset').addEventListener('click', function () {
      onResetBattle();
    });
    document.getElementById('mlsAuraToggle') && document.getElementById('mlsAuraToggle').addEventListener('change', function (e) {
      setAuraVisible(!!(e.target && e.target.checked));
    });
    document.getElementById('mlsSpeed') && document.getElementById('mlsSpeed').addEventListener('click', function () {
      speedMul = speedMul >= 3 ? 1 : speedMul + 1;
      var btn = document.getElementById('mlsSpeed');
      if (btn) btn.textContent = speedMul + '×';
    });
    document.getElementById('mlsAiSearch') && document.getElementById('mlsAiSearch').addEventListener('click', function () {
      runAiSearch();
    });
    document.getElementById('mlsEndRetry') && document.getElementById('mlsEndRetry').addEventListener('click', function () {
      hideEndCard();
      onFight();
    });
    document.getElementById('mlsEndCard') && document.getElementById('mlsEndCard').addEventListener('click', function (e) {
      if (e.target && e.target.id === 'mlsEndRetry') return;
      /* Click overlay to dismiss after result settles. */
      if (document.getElementById('mlsEndCard').classList.contains('is-play')) hideEndCard();
    });

    setFightControls(false);
    var pause = document.getElementById('mlsPause');
    if (pause) pause.style.display = 'none';
  }

  function hydrateSlotPilotsAndOps() {
    var jobs = [];
    ['ally', 'enemy'].forEach(function (side) {
      var force = forceOf(side);
      var ent = force.supporter;
      if (ent && ent.id) {
        jobs.push(
          fetchJson('/api/supporter/' + encodeURIComponent(ent.id) +
            '?lang=' + encodeURIComponent(lang()) +
            '&level=100&lb_tier=' + (ent.lb != null ? (ent.lb | 0) : 3)
          ).then(function (d) {
            if (!d || d.error) return null;
            ent.name = d.name || ent.name || String(ent.id);
            ent.thum = supporterPortraitPath(d.portrait || d.thum || ent.thum || '');
            ent.portrait = supporterPortraitPath(d.portrait || d.thum || ent.portrait || '');
            ent.rarity = d.rarity || ent.rarity || '';
            return ent;
          }).catch(function () { return null; })
        );
      }
      force.slots.forEach(function (sl, idx) {
        if (!sl || !sl.unitId) return;
        jobs.push(
          loadPair(sl.unitId, sl.charId, sl.lb != null ? sl.lb : 3).then(function (loaded) {
            var cd = loaded.char;
            var ud = loaded.unit;
            if (ud && !ud.error) {
              /* Restore display after share load (codes only carry ids). */
              sl.name = ud.name || sl.name || String(sl.unitId);
              sl.thum = ud.thum || ud.portrait || sl.thum || '';
              sl.rarity = ud.rarity || sl.rarity || '';
              sl.roleIcon = ud.role_icon || sl.roleIcon || '';
              if (ud.role_id != null && !sl.roleId) sl.roleId = String(ud.role_id);
            }
            if (cd && !cd.error) {
              sl.charName = cd.name || sl.charName || '';
              sl.charThum = cd.thum || cd.portrait || sl.charThum || '';
            } else if (ud && ud.recommend_character) {
              var recId = String(ud.recommend_character.id || '');
              if (!sl.charId && recId && !usedCharIds(side, idx)[recId]) {
                sl.charId = recId;
                sl.charName = ud.recommend_character.name || '';
                sl.charThum = ud.recommend_character.thum || '';
              }
            }
            if (sl.optionPartId && (!sl.optionPartName || !sl.optionPartThum)) {
              return loadOptionPart(sl.optionPartId).then(function (op) {
                if (op) {
                  sl.optionPartName = op.name || sl.optionPartName || sl.optionPartId;
                  sl.optionPartThum = op.thum || sl.optionPartThum || '';
                  sl.optionPartRarity = op.rarity || sl.optionPartRarity || '';
                }
                return null;
              });
            }
            if (!sl.optionPartId) return autoPickOpForSlot(side, idx, ud, cd);
            return null;
          }).catch(function () { return null; })
        );
      });
    });
    if (!jobs.length) return Promise.resolve();
    return Promise.all(jobs).then(function () {
      /* Hydrate may fill recommend pilots in parallel — collapse any side duplicates. */
      ['ally', 'enemy'].forEach(function (side) {
        enforceSideUniqueSlots(forceOf(side).slots);
      });
      saveRoster();
      paintForceSlots();
      /* Thumbs just arrived — force face-strip rebuild (sig includes thum). */
      shareFaceLayoutKey.enemy = '';
      shareFaceLayoutKey.ally = '';
      fillShareBoxes();
    });
  }

  function onTabHidden() {
    syncMlsBattleChrome(false);
  }

  /** Official LANG terms where available (Chance Step / Limit Break / Modifications / …). */
  function mlsT(key, fallback) {
    try {
      if (typeof global.t === 'function') {
        var v = global.t(key);
        if (v) return v;
      }
    } catch (e) { /* ignore */ }
    return fallback != null ? fallback : key;
  }

  function applyLang() {
    var shell = document.getElementById('mlsShell') || document.querySelector('.mls-shell');
    var root = shell && shell.parentElement ? shell.parentElement : document;
    root.querySelectorAll('[data-mls-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-mls-i18n');
      if (!key) return;
      /* Skip fight controls while busy — setFightControls owns those labels. */
      if (fightBusy && (el.id === 'mlsFight' || el.id === 'mlsPause')) return;
      var val = mlsT(key, el.textContent);
      if (el.getAttribute('data-mls-upper') === '1') val = String(val).toUpperCase();
      el.textContent = val;
    });
    root.querySelectorAll('[data-mls-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-mls-i18n-html');
      if (!key) return;
      el.innerHTML = mlsT(key, el.innerHTML);
    });
    root.querySelectorAll('[data-mls-role]').forEach(function (el) {
      var rk = el.getAttribute('data-mls-role');
      var lab = mlsT(rk, el.getAttribute('title') || '');
      el.setAttribute('title', lab);
      el.setAttribute('aria-label', lab);
    });
    function setSpanInLabel(inputId, key, fallback) {
      var inp = document.getElementById(inputId);
      var span = inp && inp.parentElement && inp.parentElement.querySelector('span');
      if (span) span.textContent = mlsT(key, fallback);
    }
    setSpanInLabel('mlsUseCollections', 'mls_owned_only', 'Sync with my collections');
    (function syncCollectionsTip() {
      var lab = document.getElementById('mlsUseCollectionsLab');
      var tip;
      if (!lab) return;
      tip = mlsT(
        'mls_use_collections_tip',
        'Ally only: pickers show your Collections kits; sync Limit Break from Collections; kits not in Collections are greyed out and omitted from Battle. Enemy force is never filtered.'
      );
      lab.setAttribute('title', tip);
    })();
    var backForm = document.getElementById('mlsBackForm');
    if (backForm) backForm.textContent = '← ' + mlsT('mls_tab_formation', 'Formation');
    var brandLink = document.querySelector('.mls-brand-link');
    if (brandLink) {
      var mlName = mlsT('tab_master_league', 'Master League');
      var simName = mlsT('tab_ml_sim', 'Master League Simulator');
      brandLink.setAttribute('title', mlName);
      brandLink.setAttribute('aria-label', simName);
    }
    var seasonSel = document.getElementById('mlsSeasonSelect');
    if (seasonSel) seasonSel.setAttribute('aria-label', mlsT('mls_season', 'Season'));
    if (!fightBusy) {
      var start = document.getElementById('mlsFight');
      if (start) start.textContent = mlsT('mls_sim_start', 'SIMULATION START');
      var pause = document.getElementById('mlsPause');
      if (pause) pause.textContent = paused ? mlsT('mls_resume', 'RESUME') : mlsT('mls_pause', 'PAUSE');
    }
  }

  function onTabShown() {
    bind();
    bindGate();
    syncAuraToggleUi();
    syncOrderToggleUi();
    applyLang();
    syncMlsBattleChrome(viewName === 'battle');
    return ensureMlsUnlocked().then(function (ok) {
      if (!ok) return null;
      return loadMlsContent();
    }).catch(function (e) { log(String(e && e.message || e)); });
  }

  global.GgenMlSim = { onTabShown: onTabShown, onTabHidden: onTabHidden, applyLang: applyLang };
})(window);
