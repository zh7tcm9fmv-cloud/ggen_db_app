(function (global) {
  'use strict';

  var RANK_MODES = [
    { id: 'super_crit', labelKey: 'msy_rank_super_crit', metricKey: 'msy_metric_super_crit', dmgField: 'super_crit_dmg', vigor: 'super', vigorLabelKey: 'dc_vigor_super', icon: '/static/images/UI/UI_Tention_Up_03.webp' },
    { id: 'crit', labelKey: 'msy_rank_crit', metricKey: 'msy_metric_crit', dmgField: 'crit_dmg', vigor: 'max', vigorLabelKey: 'dc_vigor_max', icon: '/static/images/UI/UI_Tention_Up_01.webp' },
    { id: 'normal', labelKey: 'msy_rank_normal', metricKey: 'msy_metric_normal', dmgField: 'normal_dmg', vigor: 'high', vigorLabelKey: 'dc_vigor_high', icon: '/static/images/UI/UI_Tention_Up_02.webp' }
  ];

  var UR_ICON = '/static/images/UI/UI_Common_RarityIcon_UR.webp';
  var SHINN_EX_CHAR_ID = '1330000103';
  var shinnPortraitUrl = '';
  var MSY_PER_PAGE_OPTIONS = [10, 20, 40];
  var MSY_PER_PAGE_STORAGE_KEY = 'ggen_msy_per_page';

  var state = {
    loading: false,
    groups: [],
    total: 0,
    totalPages: 1,
    settings: null,
    defenderTiers: null,
    filteredBrowse: false,
    rankMode: 'super_crit',
    defTier: 3,
    topPilots: 10,
    unitQ: '',
    page: 1,
    perPage: 10,
    cacheKey: null,
    tierCache: {},
    charCondPassiveOn: true,
    pilotCondPassiveOn: true,
    excludeUrGlobal: false,
    excludeShinnGlobal: false,
    sameRoleOnly: false,
    cacheIncomplete: false,
    pageCache: {},
    _fetchCtrl: null,
    _loadGen: 0,
    _lastRenderSig: '',
    _contentRenderTimer: null,
    _skillsRenderTimer: null,
  };

  function t(key) {
    return typeof global.t === 'function' ? global.t(key) : key;
  }

  function esc(s) {
    return typeof global.esc === 'function' ? global.esc(s) : String(s || '');
  }

  function escAttr(s) {
    return typeof global.escAttr === 'function' ? global.escAttr(s) : esc(s);
  }

  function escJs(s) {
    return typeof global.escJs === 'function' ? global.escJs(s) : esc(s);
  }

  function fmtN(n) {
    return typeof global.fmtN === 'function' ? global.fmtN(n) : String(n);
  }

  function imgUrl(path) {
    return typeof global.imgUrl === 'function' ? global.imgUrl(path) : path;
  }

  function rankModeIconHtml(path) {
    var src = path && path.indexOf('/static/') === 0 ? path : '/static/images/UI/UI_Tention_Up_01.webp';
    return '<img class="msy-rank-mode-icon" src="' + escAttr(src) + '" width="28" height="28" alt="" decoding="async" loading="eager" onerror="this.onerror=null;if(typeof gameImageUrlFallback===\'function\')gameImageUrlFallback(this)">';
  }

  function rasterImg(path, opts) {
    if (typeof global.pictureRasterHtml === 'function') {
      return global.pictureRasterHtml(path, opts || {});
    }
    return '<img src="' + escAttr(imgUrl(path)) + '" alt="">';
  }

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function rankModeDef(modeId) {
    for (var i = 0; i < RANK_MODES.length; i++) {
      if (RANK_MODES[i].id === modeId) return RANK_MODES[i];
    }
    return RANK_MODES[0];
  }

  var RARITY_ID_TO_LETTER = { '6': 'UR', '5': 'SSR', '4': 'SR', '3': 'R', '2': 'N', '1': 'N' };

  function pilotRarityLetter(c) {
    if (!c) return 'N';
    var letter = String(c.rarity || '').trim().toUpperCase();
    if (letter && letter !== 'N') return letter;
    return RARITY_ID_TO_LETTER[String(c.rarity_id || '').trim()] || letter || 'N';
  }

  function pilotMatchesExclusions(pilot, noUr, noShinn) {
    if (!pilot) return false;
    var c = pilot.char || {};
    var cid = String(c.id || '');
    if (noShinn && cid === SHINN_EX_CHAR_ID) return false;
    if (noUr && pilotRarityLetter(c) === 'UR') return false;
    return true;
  }

  function rerankPilotBlock(block, modeId, noUr, noShinn) {
    if (!block) return null;
    if (!noUr && !noShinn) return block;
    var mode = rankModeDef(modeId);
    var scored = (block.pilots || []).filter(function (p) {
      return pilotMatchesExclusions(p, noUr, noShinn);
    }).map(function (p) {
      return { pilot: p, score: pilotDamage(p, mode) };
    }).filter(function (x) { return x.score > 0; });
    scored.sort(function (a, b) { return b.score - a.score || String(a.pilot.char.id).localeCompare(String(b.pilot.char.id)); });
    if (!scored.length) return null;
    var pilots = scored.map(function (x, i) {
      var row = Object.assign({}, x.pilot, { rank: i + 1, score: x.score });
      return row;
    });
    return { max_damage: scored[0].score, pilots: pilots, vigor: block.vigor };
  }

  function blockHasPilots(block) {
    return !!(block && block.pilots && block.pilots.length);
  }

  function fullGroupBlock(g, modeId) {
    if (!g) return null;
    var block = null;
    if (!state.charCondPassiveOn && !state.pilotCondPassiveOn && g.rankings_no_cp_pep) {
      var offBlock = (g.rankings_no_cp_pep || {})[modeId];
      if (blockHasPilots(offBlock)) block = offBlock;
    } else if (!state.charCondPassiveOn && g.rankings_no_cp) {
      var cpBlock = (g.rankings_no_cp || {})[modeId];
      if (blockHasPilots(cpBlock)) block = cpBlock;
    } else if (!state.pilotCondPassiveOn && g.rankings_no_pep) {
      var pepBlock = (g.rankings_no_pep || {})[modeId];
      if (blockHasPilots(pepBlock)) block = pepBlock;
    }
    if (!block) {
      block = (g.rankings || {})[modeId];
    }
    if (!block && state.charCondPassiveOn && state.pilotCondPassiveOn && modeId === 'super_crit' && g.pilots) {
      block = { max_damage: g.max_damage, pilots: g.pilots };
    }
    return block || null;
  }

  function pilotGroupBlock(g, modeId, noUr, noShinn) {
    if (!g) return null;
    if (noUr) noShinn = true;
    if (!noUr && !noShinn) return fullGroupBlock(g, modeId);
    if (noUr && g.rankings_no_ur) {
      var urBlock = (g.rankings_no_ur || {})[modeId];
      if (urBlock && (urBlock.pilots || []).length) {
        if (noShinn) return rerankPilotBlock(urBlock, modeId, false, true) || urBlock;
        return urBlock;
      }
    }
    if (noShinn && g.rankings_no_shinn) {
      var shBlock = (g.rankings_no_shinn || {})[modeId];
      if (shBlock) return shBlock;
    }
    var base = fullGroupBlock(g, modeId);
    if (!base) return null;
    return rerankPilotBlock(base, modeId, noUr, noShinn);
  }

  function groupBlock(g, modeId, noUr, noShinn) {
    return pilotGroupBlock(g, modeId, noUr, noShinn);
  }

  function pilotsForGroup(g, modeId) {
    if (!g) return [];
    var noUr = state.excludeUrGlobal;
    var noShinn = state.excludeShinnGlobal;
    var pilotBlock = pilotGroupBlock(g, modeId, noUr, noShinn);
    if (pilotBlock && pilotBlock.pilots && pilotBlock.pilots.length) return pilotBlock.pilots;
    if (g.pilots && g.pilots.length) return g.pilots;
    var block = g.rankings && g.rankings[modeId];
    if (block && block.pilots && block.pilots.length) return block.pilots;
    return [];
  }

  function viewGroup(g, modeId) {
    if (!g || !g.unit) return null;
    var noUr = state.excludeUrGlobal;
    var noShinn = state.excludeShinnGlobal;
    var fullBlock = fullGroupBlock(g, modeId);
    var pilotBlock = pilotGroupBlock(g, modeId, noUr, noShinn);
    return {
      unit: g.unit,
      weapon_elems: g.weapon_elems,
      weapon_info: g.weapon_info,
      max_damage: (noUr || noShinn)
        ? ((pilotBlock && blockHasPilots(pilotBlock) && pilotBlock.max_damage) || g.max_damage || 0)
        : ((fullBlock && fullBlock.max_damage) || g.max_damage || 0),
      pilots: pilotsForGroup(g, modeId),
      is_sd: g.is_sd,
      rankings: g.rankings,
      rankings_no_ur: g.rankings_no_ur,
      rankings_no_shinn: g.rankings_no_shinn,
      rankings_no_cp: g.rankings_no_cp,
      rankings_no_pep: g.rankings_no_pep,
      rankings_no_cp_pep: g.rankings_no_cp_pep
    };
  }

  function expandedUnitSearchQuery(q) {
    if (typeof global.expandUnitSearchQuery === 'function') {
      return global.expandUnitSearchQuery(q || '');
    }
    return String(q || '').trim();
  }

  function unitThumb(entity) {
    if (!entity) return '';
    var row = {
      thum: entity.thum || '',
      rarity: entity.rarity || 'N',
      is_ultimate: entity.is_ultimate
    };
    if (typeof global.renderListThumb === 'function') {
      return global.renderListThumb(row, 'unit', 48);
    }
    return '';
  }

  function pilotThumb(entity) {
    if (!entity || typeof global.renderListThumb !== 'function') return '';
    var row = {
      thum: entity.portrait || entity.thum || '',
      rarity: entity.rarity || 'N'
    };
    return global.renderListThumb(row, 'char', 44);
  }

  function roleIconHtml(entity) {
    if (!entity || !entity.role_icon) return '';
    return rasterImg(entity.role_icon, {
      cls: 'msy-role-icon',
      loading: 'lazy',
      decoding: 'async',
      alt: '',
      lazy: false
    });
  }

  function msyRoleFilterQuery() {
    var ids = ['1', '2', '3'];
    var sel = [];
    var missing = false;
    ids.forEach(function (id) {
      var el = document.getElementById('msyUnitRole' + id);
      if (!el) missing = true;
      else if (el.checked) sel.push(id);
    });
    if (missing) {
      if (typeof global.getRoleQuerySuffix === 'function') {
        return global.getRoleQuerySuffix('msyUnit').replace(/^&/, '');
      }
      return '';
    }
    if (!sel.length) return 'role=__NONE__';
    if (sel.length === ids.length) return '';
    return 'role=' + encodeURIComponent(sel.join(','));
  }

  function hasActiveBrowseFilters() {
    if ((state.unitQ || '').trim()) return true;
    var roleQ = msyRoleFilterQuery();
    if (roleQ) return true;
    var parts = [];
    if (typeof global.getRarityQuerySuffix === 'function') {
      parts.push(global.getRarityQuerySuffix('msyUnit').replace(/^&/, ''));
    }
    if (typeof global.getSourceQuerySuffix === 'function') {
      parts.push(global.getSourceQuerySuffix('msyUnit').replace(/^&/, ''));
    }
    if (typeof global.getSeriesQuerySuffix === 'function') {
      parts.push(global.getSeriesQuerySuffix('msyUnit').replace(/^&/, ''));
    }
    if (typeof global.getLineageQuerySuffix === 'function') {
      parts.push(global.getLineageQuerySuffix('msyUnit').replace(/^&/, ''));
    }
    return parts.some(Boolean);
  }

  function buildFilterQuery() {
    var parts = [];
    var roleQ = msyRoleFilterQuery();
    if (roleQ) parts.push(roleQ);
    if (typeof global.getRarityQuerySuffix === 'function') {
      parts.push(global.getRarityQuerySuffix('msyUnit').replace(/^&/, ''));
    }
    if (typeof global.getSourceQuerySuffix === 'function') {
      parts.push(global.getSourceQuerySuffix('msyUnit').replace(/^&/, ''));
    }
    if (typeof global.getSeriesQuerySuffix === 'function') {
      parts.push(global.getSeriesQuerySuffix('msyUnit').replace(/^&/, ''));
    }
    if (typeof global.getSeriesOpSuffix === 'function') {
      parts.push(global.getSeriesOpSuffix('msyUnit').replace(/^&/, ''));
    }
    if (typeof global.getLineageQuerySuffix === 'function') {
      parts.push(global.getLineageQuerySuffix('msyUnit').replace(/^&/, ''));
    }
    if (typeof global.getLineageOpSuffix === 'function') {
      parts.push(global.getLineageOpSuffix('msyUnit').replace(/^&/, ''));
    }
    return parts.filter(Boolean).join('&');
  }

  function readStoredPerPage() {
    try {
      var v = parseInt(localStorage.getItem(MSY_PER_PAGE_STORAGE_KEY), 10);
      if (MSY_PER_PAGE_OPTIONS.indexOf(v) >= 0) return v;
    } catch (_) {}
    return 10;
  }

  function syncPerPageToDom() {
    var el = document.getElementById('msyPerPage');
    if (!el) return;
    var val = String(state.perPage);
    if (el.value !== val) el.value = val;
  }

  function cacheKeyBase() {
    return [
      (global.S && global.S.lang) || 'EN',
      state.topPilots,
      state.charCondPassiveOn ? 'cp1' : 'cp0',
      state.pilotCondPassiveOn ? 'pep1' : 'pep0',
      state.sameRoleOnly ? 'sr1' : 'sr0',
      'pp:' + state.perPage,
      buildFilterQuery()
    ].join('|');
  }

  function cacheKeyForState() {
    return cacheKeyBase() + '|rm:' + state.rankMode + '|dt:' + state.defTier + '|pg:' + state.page + '|q:' + (state.unitQ || '');
  }

  function buildApiUrl(opts) {
    opts = opts || {};
    var lang = (global.S && global.S.lang) || 'EN';
    var fq = buildFilterQuery();
    var defTier = opts.defTier != null ? opts.defTier : state.defTier;
    var page = opts.page != null ? opts.page : state.page;
    var q = [
      'lang=' + encodeURIComponent(lang),
      'def_tier=' + encodeURIComponent(String(defTier)),
      'lb_tier=3',
      'top_pilots=' + encodeURIComponent(String(state.topPilots)),
      'unit_q=' + encodeURIComponent(state.unitQ || ''),
      'rank_mode=' + encodeURIComponent(opts.rankMode != null ? opts.rankMode : state.rankMode),
      'page=' + encodeURIComponent(String(page)),
      'per_page=' + encodeURIComponent(String(state.perPage)),
      'include_skills=0'
    ];
    if (state.sameRoleOnly) q.push('same_role_only=1');
    if (!state.charCondPassiveOn) q.push('cp_on=0');
    if (!state.pilotCondPassiveOn) q.push('pep_on=0');
    if (opts.summary) q.push('summary=1');
    if (fq) q.push(fq);
    return '/api/meta_synergy_rankings?' + q.join('&');
  }

  function tierCacheKey(defTier, rankMode) {
    return cacheKeyForState().replace(/\|pg:\d+/, '|pg:1').replace(
      /\|rm:[^|]+/,
      '|rm:' + (rankMode || state.rankMode)
    ).replace(/\|dt:\d+/, '|dt:' + (defTier != null ? defTier : state.defTier));
  }

  function clearPageCache() {
    state.pageCache = {};
  }

  function rememberPagePayload(key, payload) {
    if (!key || !payload) return;
    if (payload.cache_incomplete) return;
    if ((payload.groups || []).some(function (g) { return g && (g.pending || g.pilot_preview); })) return;
    state.pageCache[key] = payload;
    var keys = Object.keys(state.pageCache);
    while (keys.length > 20) {
      delete state.pageCache[keys.shift()];
    }
  }

  function sameGroupIdSet(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    var idsA = a.map(function (g) { return g && g.unit ? String(g.unit.id) : ''; }).sort().join('\0');
    var idsB = b.map(function (g) { return g && g.unit ? String(g.unit.id) : ''; }).sort().join('\0');
    return idsA === idsB && idsA.length > 0;
  }

  function mergeGroupsByUnit(prev, next) {
    if (!next || !next.length) return prev || [];
    if (!prev || !prev.length) return next;
    if (!sameGroupIdSet(prev, next)) return next;
    var nextBy = {};
    next.forEach(function (g) {
      if (g && g.unit && g.unit.id != null) nextBy[String(g.unit.id)] = g;
    });
    var merged = [];
    prev.forEach(function (g) {
      if (!g || !g.unit) return;
      var id = String(g.unit.id);
      var n = nextBy[id];
      if (!n) return;
      if (g.pending && !n.pending && !n.pilot_preview) merged.push(n);
      else if (g.pilot_preview && !n.pilot_preview && !n.pending) merged.push(n);
      else if (!g.pending && !g.pilot_preview && (n.pending || n.pilot_preview)) merged.push(g);
      else merged.push(n);
    });
    return merged.length ? merged : next;
  }

  function pilotListSignature(pilots, mode) {
    return (pilots || []).slice(0, 10).map(function (p) {
      var c = p.char || {};
      return [
        c.id || '',
        pilotDamage(p, mode),
        (p.active_skills && p.active_skills.length) || 0,
        (p.affinity_matches && p.affinity_matches.length) || 0
      ].join(':');
    }).join(',');
  }

  function groupsRenderSignature(groups, mode) {
    if (!mode) return '';
    return (groups || []).map(function (g) {
      if (!g || !g.unit) return '';
      var row = viewGroup(g, mode.id);
      return [
        g.unit.id,
        g.pending ? 'p' : '',
        g.pilot_preview ? 'v' : '',
        row ? row.max_damage : 0,
        row ? pilotListSignature(row.pilots, mode) : ''
      ].join('|');
    }).join(';') + '::' + state.page + '::' + mode.id + '::' +
      (state.charCondPassiveOn ? 'cp1' : 'cp0') + (state.pilotCondPassiveOn ? 'pep1' : 'pep0');
  }

  function scheduleContentRender(immediate) {
    clearTimeout(state._contentRenderTimer);
    if (immediate) {
      state._contentRenderTimer = null;
      renderContent(true);
      return;
    }
    state._contentRenderTimer = setTimeout(function () {
      state._contentRenderTimer = null;
      renderContent(false);
    }, 240);
  }

  function invalidateRenderSignature() {
    state._lastRenderSig = '';
  }

  function patchPilotEnrichment(groups, mode) {
    var host = document.getElementById('msyContent');
    if (!host || !mode) return false;
    var articles = host.querySelectorAll('.msy-unit-card');
    if (!articles.length) return false;
    var patched = 0;
    var gi = 0;
    (groups || []).forEach(function (g) {
      if (!g || !g.unit) return;
      var row = viewGroup(g, mode.id);
      if (!row) return;
      var art = articles[gi++];
      if (!art) return;
      var cards = art.querySelectorAll('.msy-pilot-card:not(.msy-pilot-card--skeleton)');
      var pilots = pilotsForGroup(g, mode.id).slice(0, 10);
      pilots.forEach(function (p, pi) {
        var card = cards[pi];
        if (!card) return;
        var dmgCol = card.querySelector('.msy-pilot-dmg-col');
        if (dmgCol) {
          var fsHtml = pilotFormulaStatHtml(p);
          if (fsHtml && !dmgCol.querySelector('.msy-pilot-formula-stat')) {
            dmgCol.insertAdjacentHTML('beforeend', fsHtml);
            patched += 1;
          }
        }
        var open = card.querySelector('.msy-pilot-open .msy-pilot-body');
        if (!open) return;
        var skHtml = pilotSkillsHtml(p);
        var affHtml = pilotAffinityHtml(p);
        if (skHtml && !open.querySelector('.msy-pilot-skills')) {
          var nameRow = open.querySelector('.msy-pilot-name-row');
          if (nameRow) {
            nameRow.insertAdjacentHTML('afterend', skHtml);
            patched += 1;
          }
        }
        if (affHtml && !open.querySelector('.msy-pilot-affinity')) {
          var anchor = open.querySelector('.msy-pilot-skills') || open.querySelector('.msy-pilot-name-row');
          if (anchor) {
            anchor.insertAdjacentHTML('afterend', affHtml);
            patched += 1;
          }
        }
      });
    });
    return patched > 0;
  }

  function applyPayload(d, defTier) {
    var hadGroups = !!(state.groups && state.groups.length);
    var incoming = d.groups || [];
    if (!incoming.length && state.groups && state.groups.length && (d.cache_incomplete || d.summary)) {
      incoming = state.groups;
    } else if (incoming.length && state.groups && state.groups.length && sameGroupIdSet(state.groups, incoming)) {
      incoming = mergeGroupsByUnit(state.groups, incoming);
    }
    state.groups = incoming;
    state.total = d.total || 0;
    state.totalPages = d.total_pages || 1;
    state.page = d.page || state.page;
    state.filteredBrowse = !!d.filtered_browse;
    state.settings = d.settings || null;
    if (d.defender_tiers) {
      state.defenderTiers = d.defender_tiers;
      populateDefTierSelect(d.defender_tiers);
    }
    state.cacheKey = cacheKeyForState();
    state.cacheIncomplete = !!d.cache_incomplete;
    var tk = tierCacheKey(defTier != null ? defTier : state.defTier, state.rankMode);
    state.tierCache[tk] = {
      cacheKey: cacheKeyForState().replace(/\|pg:\d+/, '|pg:1'),
      groups: state.groups,
      total: state.total,
      totalPages: state.totalPages,
      page: state.page,
      settings: state.settings
    };
    var immediate = (!hadGroups && state.groups.length) || state.filteredBrowse;
    scheduleContentRender(immediate);
    if (d.cache_incomplete) {
      showWarmingBanner(true, t('msy_warming_partial') || t('msy_warming') || 'Updating rankings…');
    } else if (!d.warming) {
      showWarmingBanner(false);
    }
  }

  function collectPilotSkillPairs(groups) {
    var pairs = [];
    var charIds = [];
    var seenPair = {};
    var seenChar = {};
    function addPilot(unitId, p) {
      var id = p && p.char && p.char.id;
      if (!id || !unitId) return;
      var cid = String(id);
      var uid = String(unitId);
      var pairKey = uid + ':' + cid;
      var needsSkills = !(p.active_skills && p.active_skills.length);
      var needsAffinity = p.affinity_matches === undefined;
      if (!needsSkills && !needsAffinity) return;
      if (!seenPair[pairKey]) {
        seenPair[pairKey] = 1;
        pairs.push({ unitId: uid, charId: cid });
      }
      if (needsSkills && !seenChar[cid]) {
        seenChar[cid] = 1;
        charIds.push(cid);
      }
    }
    (groups || []).forEach(function (g) {
      var unitId = g.unit && g.unit.id;
      if (!unitId) return;
      (g.pilots || []).forEach(function (p) { addPilot(unitId, p); });
      ['rankings', 'rankings_no_cp', 'rankings_no_pep', 'rankings_no_cp_pep', 'rankings_no_ur', 'rankings_no_shinn'].forEach(function (key) {
        var block = g[key];
        if (!block || typeof block !== 'object') return;
        Object.keys(block).forEach(function (modeKey) {
          var modeBlock = block[modeKey];
          ((modeBlock && modeBlock.pilots) || []).forEach(function (p) { addPilot(unitId, p); });
        });
      });
    });
    return { pairs: pairs, charIds: charIds };
  }

  function applySkillsToGroups(groups, map, affinityMap) {
    if (!map && !affinityMap) return;
    (groups || []).forEach(function (g) {
      var unitId = g.unit && String(g.unit.id || '');
      function patchPilot(p) {
        if (!p || !p.char) return;
        var id = String(p.char.id || '');
        if (map && map[id]) p.active_skills = map[id];
        if (affinityMap && unitId) {
          var pairKey = unitId + ':' + id;
          if (Object.prototype.hasOwnProperty.call(affinityMap, pairKey)) {
            p.affinity_matches = affinityMap[pairKey];
          }
        }
      }
      (g.pilots || []).forEach(patchPilot);
      ['rankings', 'rankings_no_cp', 'rankings_no_pep', 'rankings_no_cp_pep', 'rankings_no_ur', 'rankings_no_shinn'].forEach(function (key) {
        var block = g[key];
        if (!block || typeof block !== 'object') return;
        Object.keys(block).forEach(function (modeKey) {
          var modeBlock = block[modeKey];
          ((modeBlock && modeBlock.pilots) || []).forEach(patchPilot);
        });
      });
    });
  }

  function scheduleSkillsRender() {
    clearTimeout(state._skillsRenderTimer);
    state._skillsRenderTimer = setTimeout(function () {
      var mode = rankModeDef(state.rankMode);
      if (patchPilotEnrichment(state.groups, mode)) {
        state._lastRenderSig = groupsRenderSignature(state.groups, mode);
        return;
      }
      scheduleContentRender(false);
    }, 300);
  }

  async function fetchPilotSkillsBatch(groups) {
    var req = collectPilotSkillPairs(groups);
    if (!req.charIds.length && !req.pairs.length) return;
    var lang = (global.S && global.S.lang) || 'EN';
    var gen = state._loadGen;
    var charParam = req.charIds.join(',');
    if (!req.pairs.length) {
      for (var ci = 0; ci < req.charIds.length; ci += 80) {
        if (gen !== state._loadGen) return;
        var charSlice = req.charIds.slice(ci, ci + 80);
        try {
          var r0 = await fetch('/api/meta_synergy_pilot_skills?lang=' + encodeURIComponent(lang) + '&char_ids=' + encodeURIComponent(charSlice.join(',')), { credentials: 'same-origin' });
          if (!r0.ok) continue;
          var d0 = await r0.json();
          if (gen !== state._loadGen) return;
          applySkillsToGroups(state.groups, d0.skills_by_char || {}, d0.affinity_by_pair || {});
          scheduleSkillsRender();
        } catch (_) {}
      }
      return;
    }
    for (var i = 0; i < req.pairs.length; i += 40) {
      if (gen !== state._loadGen) return;
      var chunkPairs = req.pairs.slice(i, i + 40);
      var q = ['lang=' + encodeURIComponent(lang)];
      if (charParam) q.push('char_ids=' + encodeURIComponent(charParam));
      q.push('pairs=' + encodeURIComponent(chunkPairs.map(function (x) {
        return x.unitId + ':' + x.charId;
      }).join(',')));
      try {
        var r = await fetch('/api/meta_synergy_pilot_skills?' + q.join('&'), { credentials: 'same-origin' });
        if (!r.ok) continue;
        var d = await r.json();
        if (gen !== state._loadGen) return;
        applySkillsToGroups(state.groups, d.skills_by_char || {}, d.affinity_by_pair || {});
        scheduleSkillsRender();
      } catch (_) {}
    }
  }

  function syncGlobalFilterButtons() {
    var cpBtn = document.getElementById('msyCpToggleBtn');
    if (cpBtn) {
      cpBtn.title = state.charCondPassiveOn ? t('msy_cp_on') : t('msy_cp_off');
      cpBtn.setAttribute('aria-pressed', state.charCondPassiveOn ? 'true' : 'false');
      cpBtn.classList.toggle('active', state.charCondPassiveOn);
    }
    var pepBtn = document.getElementById('msyPepToggleBtn');
    if (pepBtn) {
      pepBtn.title = state.pilotCondPassiveOn ? t('msy_pep_on') : t('msy_pep_off');
      pepBtn.setAttribute('aria-pressed', state.pilotCondPassiveOn ? 'true' : 'false');
      pepBtn.classList.toggle('active', state.pilotCondPassiveOn);
    }
    var urBtn = document.getElementById('msyExcludeUrBtn');
    if (urBtn) {
      urBtn.title = state.excludeUrGlobal ? t('msy_exclude_ur_on') : t('msy_exclude_ur');
      urBtn.setAttribute('aria-pressed', state.excludeUrGlobal ? 'true' : 'false');
      urBtn.classList.toggle('active', state.excludeUrGlobal);
    }
    var shBtn = document.getElementById('msyExcludeShinnBtn');
    if (shBtn) {
      var hideShinn = state.excludeUrGlobal;
      shBtn.style.display = hideShinn ? 'none' : '';
      shBtn.setAttribute('aria-hidden', hideShinn ? 'true' : 'false');
      if (!hideShinn) {
        shBtn.title = state.excludeShinnGlobal ? t('msy_exclude_shinn_on') : t('msy_exclude_shinn');
        shBtn.setAttribute('aria-pressed', state.excludeShinnGlobal ? 'true' : 'false');
        shBtn.classList.toggle('active', state.excludeShinnGlobal);
      }
    }
    var srBtn = document.getElementById('msySameRoleBtn');
    if (srBtn) {
      srBtn.title = state.sameRoleOnly ? t('msy_same_role_on') : t('msy_same_role');
      srBtn.setAttribute('aria-label', state.sameRoleOnly ? t('msy_same_role_on') : t('msy_same_role'));
      srBtn.setAttribute('aria-pressed', state.sameRoleOnly ? 'true' : 'false');
      srBtn.classList.toggle('active', state.sameRoleOnly);
      var srGlyph = srBtn.querySelector('.msy-same-role-glyph');
      if (srGlyph) {
        srGlyph.textContent = state.sameRoleOnly ? '=' : '≠';
        srGlyph.classList.toggle('is-on', state.sameRoleOnly);
        srGlyph.classList.toggle('is-off', !state.sameRoleOnly);
      }
    }
  }

  function renderRankModes() {
    var host = document.getElementById('msyRankModes');
    if (!host) return;
    var html = '';
    RANK_MODES.forEach(function (m) {
      var active = state.rankMode === m.id;
      html += '<button type="button" class="msy-rank-mode' + (active ? ' active' : '') + '" role="tab" aria-selected="' + (active ? 'true' : 'false') + '" data-msy-rank-mode="' + escAttr(m.id) + '" onclick="GgenMetaSynergy.setRankMode(\'' + escJs(m.id) + '\')">';
      html += rankModeIconHtml(m.icon);
      html += '<span class="msy-rank-mode-label">' + esc(t(m.labelKey)) + '</span>';
      html += '</button>';
    });
    host.innerHTML = html;
  }

  function applyLangStatic() {
    var el = document.getElementById('msySearchInput');
    if (el) el.placeholder = t('msy_search_ph');
    el = document.getElementById('msyEmptyText');
    if (el) el.textContent = t('msy_empty');
    el = document.getElementById('msyDefTierLabel');
    if (el) el.textContent = t('msy_def_difficulty');
    syncGlobalFilterButtons();
    renderRankModes();
  }

  function populateDefTierSelect(tiers) {
    var sel = document.getElementById('msyDefTierSelect');
    if (!sel || !tiers) return;
    var cur = String(state.defTier || '3');
    var labels = {
      1: t('msy_def_hard3'),
      2: t('msy_def_challenge'),
      3: t('msy_def_eternal')
    };
    sel.innerHTML = '';
    ['1', '2', '3'].forEach(function (k) {
      var row = tiers[k] || tiers[String(k)] || {};
      var lbl = labels[k] || row.label || ('Tier ' + k);
      var opt = document.createElement('option');
      opt.value = k;
      opt.textContent = lbl;
      if (k === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function initFilterLabels() {
    if (typeof global.ensureUnitUltRarityRow === 'function') global.ensureUnitUltRarityRow('msyUnit');
    if (typeof global.fillRolePanelIcons === 'function') global.fillRolePanelIcons('msyUnit');
    if (typeof global.fillRarityPanelIcons === 'function') global.fillRarityPanelIcons('msyUnit');
    if (typeof global.fillSourcePanel === 'function') global.fillSourcePanel('msyUnit');
    if (typeof global.updateRoleFilterButtonLabel === 'function') global.updateRoleFilterButtonLabel('msyUnit');
    if (typeof global.updateRarityFilterButtonLabel === 'function') global.updateRarityFilterButtonLabel('msyUnit');
    if (typeof global.updateSourceFilterButtonLabel === 'function') global.updateSourceFilterButtonLabel('msyUnit');
    if (typeof global.updateSeriesFilterButtonLabel === 'function') global.updateSeriesFilterButtonLabel('msyUnit');
    if (typeof global.updateLineageFilterButtonLabel === 'function') global.updateLineageFilterButtonLabel('msyUnit');
    var clr = document.getElementById('msyUnitBrowseFiltersClearBtn');
    if (clr) {
      clr.textContent = t('browse_filters_clear');
      clr.title = t('filter_clear_all');
      clr.setAttribute('aria-label', t('filter_clear_all'));
    }
    var defLbl = document.getElementById('msyDefTierLabel');
    if (defLbl) defLbl.textContent = t('msy_def_difficulty');
  }

  function updateDefTierStats() {
    var sel = document.getElementById('msyDefTierSelect');
    var lbl = document.querySelector('.msy-def-tier-lbl');
    var tiers = state.defenderTiers || {};
    var dt = String(state.defTier || '1');
    var row = tiers[dt] || tiers[String(dt)];
    if (!row) {
      if (sel) sel.removeAttribute('title');
      if (lbl) lbl.title = t('msy_def_difficulty') || 'Defender difficulty';
      return;
    }
    var tip = (row.label || '') + ' — MS DEF ' + fmtN(row.unit_def) + ' · Pilot DEF ' + fmtN(row.char_def);
    if (sel) sel.title = tip;
    if (lbl) lbl.title = tip;
  }

  function renderStatus() {
    var mode = rankModeDef(state.rankMode);
    var el = document.getElementById('msyStatus');
    var countEl = document.getElementById('msyToolbarCount');
    if (countEl) countEl.style.display = 'none';
    if (!el) return;
    var vigorLbl = t(mode.vigorLabelKey || 'dc_vigor_super');
    var chips = '';
    if (state.filteredBrowse || hasActiveBrowseFilters()) {
      chips += '<span class="msy-status-chip">' + esc(t('msy_status_match').replace('{n}', fmtN(state.total))) + '</span>';
    }
    chips += '<span class="msy-status-chip">' + esc(t('msy_status_vigor').replace('{v}', vigorLbl)) + '</span>';
    el.innerHTML = chips;
    updateDefTierStats();
  }

  function weaponSubtitleHtml(g, row) {
    if (row.is_sd) {
      return '<div class="msy-unit-elem msy-unit-elem--sd">' + esc(t('msy_sd_note')) + '</div>';
    }
    var wi = g.weapon_info;
    if (!wi) {
      if (g.weapon_elems) {
        return '<div class="msy-unit-elem">&lt;' + esc(g.weapon_elems) + '&gt;</div>';
      }
      return '';
    }
    var parts = [];
    if (wi.name) parts.push(String(wi.name));
    if (wi.weapon_type) parts.push(String(wi.weapon_type));
    if (wi.attribute) parts.push('<' + wi.attribute + '>');
    if (wi.attack_types && wi.attack_types.length) parts.push(wi.attack_types.join('/'));
    if (wi.power) parts.push(fmtN(wi.power) + ' PWR');
    return '<div class="msy-unit-weapon">' + esc(parts.join(' · ')) + '</div>';
  }

  function pilotSkillsHtml(pilot) {
    var skills = pilot.active_skills || [];
    var active = skills.filter(function (sk) { return sk && sk.active; });
    if (!active.length && !skills.length) return '';
    var html = '<div class="msy-pilot-skills">';
    skills.forEach(function (sk) {
      html += '<span class="msy-pilot-skill' + (sk.active ? ' msy-pilot-skill--active' : '') + '" title="' + escAttr(sk.name || '') + '">';
      if (sk.icon) {
        html += rasterImg(sk.icon, { cls: 'msy-pilot-skill-ic', loading: 'lazy', alt: '', lazy: true });
      } else {
        html += '<span class="msy-pilot-skill-fallback">' + esc((sk.name || '?').charAt(0)) + '</span>';
      }
      html += '</span>';
    });
    if (active.length) {
      html += '<div class="msy-pilot-skill-lines">';
      active.forEach(function (sk) {
        var nm = String(sk.name || '').replace(/\s*LV\s*\d+\s*$/i, '').trim();
        var lv = sk.level ? ('LV ' + sk.level) : (/\bLV\s*\d+\b/i.test(sk.name || '') ? String(sk.name).match(/\bLV\s*\d+\b/i)[0] : '');
        var detail = (sk.details && sk.details[0]) || sk.desc || '';
        html += '<div class="msy-pilot-skill-line">';
        html += '<span class="msy-pilot-skill-name">' + esc(nm || sk.name || '') + '</span>';
        if (lv) html += '<span class="msy-pilot-skill-lv">' + esc(lv) + '</span>';
        if (detail) html += '<div class="msy-pilot-skill-desc">' + esc(detail) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function pilotAffinityHtml(pilot) {
    var aff = pilot.affinity_matches || [];
    if (!aff.length) return '';
    var html = '<div class="msy-pilot-affinity">';
    aff.forEach(function (row) {
      html += '<div class="msy-pilot-affinity-row">';
      if (row.ability) {
        html += '<div class="msy-pilot-affinity-ability">' + esc(row.ability) + '</div>';
      }
      if (row.tags && row.tags.length) {
        html += '<div class="msy-pilot-affinity-tags">' + row.tags.map(function (tag) {
          return '<span class="msy-pilot-affinity-tag">' + esc(tag) + '</span>';
        }).join('') + '</div>';
      }
      if (row.detail) {
        html += '<div class="msy-pilot-affinity-detail">' + esc(row.detail) + '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function pilotDamage(pilot, mode) {
    if (!pilot) return 0;
    if (mode.dmgField && pilot[mode.dmgField]) return pilot[mode.dmgField];
    return pilot.score || 0;
  }

  function pilotFormulaStatHtml(pilot) {
    if (!pilot || pilot.char_atk == null) return '';
    var statKey = {
      Ranged: 'stat_ranged',
      Melee: 'stat_melee',
      Awaken: 'stat_awaken'
    };
    var label = '';
    if (pilot.formula_stat) {
      var fk = statKey[pilot.formula_stat] || '';
      label = fk ? (t(fk) || pilot.formula_stat) : pilot.formula_stat;
    } else {
      label = t('stat_atk') || 'ATK';
    }
    var line = t('msy_formula_stat')
      ? t('msy_formula_stat').replace('{stat}', label).replace('{val}', fmtN(pilot.char_atk))
      : (label + ': ' + fmtN(pilot.char_atk));
    return '<div class="msy-pilot-formula-stat">' + esc(line) + '</div>';
  }

  function renderPilotCard(unitId, pilot, mode) {
    var c = pilot.char || {};
    var dmg = pilotDamage(pilot, mode);
    var sub = '';
    if (pilot.guaranteed_crit) {
      sub += '<div class="msy-pilot-sub msy-pilot-sub--gc">' + esc(t('msy_guaranteed_crit')) + '</div>';
    } else if (pilot.crit_rate) {
      sub += '<div class="msy-pilot-sub">' + esc(t('msy_crit_rate')).replace('{n}', String(pilot.crit_rate)) + '</div>';
    }
    return (
      '<div class="msy-pilot-card">' +
        '<span class="msy-pilot-rank">' + (pilot.rank || '') + '</span>' +
        '<button type="button" class="msy-pilot-open" title="' + escAttr(t('msy_open_char')) + '" onclick="GgenMetaSynergy.openDetailChar(\'' + escJs(c.id) + '\')">' +
          '<div class="msy-pilot-thumb">' + pilotThumb(c) + '</div>' +
          '<div class="msy-pilot-body">' +
            '<div class="msy-pilot-name-row">' +
              roleIconHtml(c) +
              '<span class="msy-pilot-name" title="' + escAttr(c.name || '') + '">' + esc(c.name) + '</span>' +
            '</div>' +
            pilotSkillsHtml(pilot) +
            pilotAffinityHtml(pilot) +
            sub +
          '</div>' +
        '</button>' +
        '<div class="msy-pilot-dmg-col">' +
          '<div class="msy-pilot-dmg">' + fmtN(dmg) + '</div>' +
          pilotFormulaStatHtml(pilot) +
        '</div>' +
      '</div>'
    );
  }

  function renderPilotSkeletonCard() {
    return (
      '<div class="msy-pilot-card msy-pilot-card--skeleton" aria-hidden="true">' +
        '<span class="msy-pilot-rank msy-skel-bar"></span>' +
        '<div class="msy-pilot-skel-body">' +
          '<div class="msy-pilot-skel-thumb"></div>' +
          '<div class="msy-pilot-skel-lines">' +
            '<div class="msy-skel-line"></div>' +
            '<div class="msy-skel-line msy-skel-line--short"></div>' +
          '</div>' +
        '</div>' +
        '<div class="msy-skel-dmg"></div>' +
      '</div>'
    );
  }

  function renderPilotSkeletonGrid() {
    var half = 5;
    var left = [];
    var right = [];
    var i;
    for (i = 0; i < half; i++) left.push(renderPilotSkeletonCard());
    for (i = 0; i < half; i++) right.push(renderPilotSkeletonCard());
    return (
      '<div class="msy-pilot-grid msy-pilot-grid--loading" aria-busy="true">' +
        '<div class="msy-pilot-col">' + left.join('') + '</div>' +
        '<div class="msy-pilot-col">' + right.join('') + '</div>' +
      '</div>'
    );
  }

  function renderPilotGrid(pilots, unitId, mode) {
    var list = (pilots || []).slice(0, 10);
    var half = Math.ceil(list.length / 2);
    var left = list.slice(0, half);
    var right = list.slice(half);
    function col(items) {
      return '<div class="msy-pilot-col">' + items.map(function (p) {
        return renderPilotCard(unitId, p, mode);
      }).join('') + '</div>';
    }
    return '<div class="msy-pilot-grid">' + col(left) + col(right) + '</div>';
  }

  function renderGroups(groups, startRank, mode) {
    var html = '<div class="msy-groups">';
    groups.forEach(function (g, gi) {
      if (!g || !g.unit) return;
      var row = viewGroup(g, mode.id);
      if (!row) return;
      var rank = (startRank || 0) + gi + 1;
      var u = row.unit;
      html += '<article class="msy-unit-card' + (row.is_sd ? ' msy-unit-card--sd' : '') + '">';
      html += '<header class="msy-unit-head" role="button" tabindex="0" title="' + escAttr(t('msy_open_unit') || 'Unit') + '" onclick="GgenMetaSynergy.openDetailUnit(\'' + escJs(u.id) + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();GgenMetaSynergy.openDetailUnit(\'' + escJs(u.id) + '\')}">';
      html += '<span class="msy-unit-rank">' + rank + '</span>';
      html += '<div class="msy-unit-thumb">' + unitThumb(u) + '</div>';
      html += '<div class="msy-unit-main">';
      html += '<div class="msy-unit-name-row">';
      html += roleIconHtml(u);
      html += '<span class="msy-unit-name">' + esc(u.name) + '</span>';
      html += '</div>';
      html += weaponSubtitleHtml(g, row);
      html += '</div>';
      html += '<div class="msy-unit-peak">';
      html += '<div class="msy-unit-peak-val">' + fmtN(row.max_damage) + '</div>';
      html += '</div>';
      html += '</header>';
      var gridPilots = pilotsForGroup(g, mode.id);
      if (gridPilots.length) {
        html += renderPilotGrid(gridPilots, u.id, mode);
      } else if (g.pending) {
        html += renderPilotSkeletonGrid();
      } else if (!g.pending && (state.excludeUrGlobal || state.excludeShinnGlobal || state.sameRoleOnly)) {
        html += '<div class="msy-pilot-empty">' + esc(t('msy_no_eligible_pilots') || 'No eligible pilots for this filter.') + '</div>';
      }
      html += '</article>';
    });
    html += '</div>';
    return html;
  }

  function renderPagination() {
    var host = document.getElementById('msyPagination');
    if (!host) return;
    var page = Math.max(1, state.page | 0);
    var totalPages = Math.max(1, state.totalPages | 0);
    if (totalPages <= 1) {
      host.innerHTML = '';
      return;
    }
    var h = '';
    h += '<button type="button" class="page-btn' + (page <= 1 ? ' disabled' : '') + '"' +
      (page > 1 ? ' onclick="GgenMetaSynergy.goPage(' + (page - 1) + ')"' : '') + '>◀</button>';
    var mx = 7;
    var sp = Math.max(1, page - Math.floor(mx / 2));
    var ep = Math.min(totalPages, sp + mx - 1);
    if (ep - sp < mx - 1) sp = Math.max(1, ep - mx + 1);
    if (sp > 1) {
      h += '<button type="button" class="page-btn" onclick="GgenMetaSynergy.goPage(1)">1</button>';
      if (sp > 2) h += '<span class="page-info">…</span>';
    }
    for (var i = sp; i <= ep; i++) {
      h += '<button type="button" class="page-btn' + (i === page ? ' active' : '') +
        '" onclick="GgenMetaSynergy.goPage(' + i + ')">' + i + '</button>';
    }
    if (ep < totalPages) {
      if (ep < totalPages - 1) h += '<span class="page-info">…</span>';
      h += '<button type="button" class="page-btn" onclick="GgenMetaSynergy.goPage(' + totalPages + ')">' + totalPages + '</button>';
    }
    h += '<button type="button" class="page-btn' + (page >= totalPages ? ' disabled' : '') + '"' +
      (page < totalPages ? ' onclick="GgenMetaSynergy.goPage(' + (page + 1) + ')"' : '') + '>▶</button>';
    host.innerHTML = h;
  }

  function renderContent(force) {
    var mode = rankModeDef(state.rankMode);
    renderStatus();
    var sig = groupsRenderSignature(state.groups, mode);
    if (!force && sig === state._lastRenderSig) {
      renderPagination();
      return;
    }
    state._lastRenderSig = sig;
    var startRank = (state.page - 1) * state.perPage;
    var host = document.getElementById('msyContent');
    var empty = document.getElementById('msyEmpty');
    if (!host) return;
    if (!state.groups.length) {
      host.innerHTML = '';
      if (empty) empty.style.display = state.loading ? 'none' : '';
      renderPagination();
      return;
    }
    if (empty) empty.style.display = 'none';
    host.innerHTML = renderGroups(state.groups, startRank, mode);
    renderPagination();
  }

  function setLoading(on, warming) {
    state.loading = !!on;
    var el = document.getElementById('msyLoading');
    if (!el) return;
    el.style.display = on ? 'flex' : 'none';
    var msg = el.querySelector('.msy-loading-text');
    if (msg) {
      msg.textContent = warming ? (t('msy_warming') || 'Computing rankings…') : (t('loading') || 'Loading…');
    }
  }

  function showWarmingBanner(on, text) {
    var host = document.getElementById('msyWarmingBanner');
    if (!host) return;
    if (!on) {
      host.style.display = 'none';
      host.textContent = '';
      return;
    }
    host.style.display = '';
    host.textContent = text || t('msy_warming_partial') || t('msy_warming') || 'Updating rankings…';
  }

  function syncSearchFromDom() {
    var el = document.getElementById('msySearchInput');
    if (el) state.unitQ = expandedUnitSearchQuery(el.value.trim());
  }

  function groupNeedsPilotBuild(g) {
    return !!(g && g.pending);
  }

  function hasPendingPilotGroups() {
    return (state.groups || []).some(groupNeedsPilotBuild);
  }

  var MAX_LOAD_POLLS = 8;
  var MSY_PILOT_FETCH_MS = 90000;
  var MSY_DEFAULT_FETCH_MS = 60000;

  function hasPreviewPilotGroups() {
    return (state.groups || []).some(function (g) {
      return !!(g && g.pilot_preview);
    });
  }

  async function loadRankingsPilotsBackground(loadGen) {
    var poll = 0;
    var maxPilotPolls = 20;
    while (poll < maxPilotPolls) {
      if (loadGen !== state._loadGen) return;
      if (!hasPendingPilotGroups() && !hasPreviewPilotGroups()) {
        showWarmingBanner(false);
        return;
      }
      showWarmingBanner(true, t('msy_pilot_loading') || t('msy_warming_partial') || 'Loading pilots…');
      try {
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timeoutId = setTimeout(function () {
          if (ctrl) {
            try { ctrl.abort(); } catch (_) {}
          }
        }, MSY_PILOT_FETCH_MS);
        var fetchOpts = { credentials: 'same-origin' };
        if (ctrl) fetchOpts.signal = ctrl.signal;
        var r = await fetch(buildApiUrl(), fetchOpts);
        clearTimeout(timeoutId);
        if (loadGen !== state._loadGen) return;
        if (!r.ok) break;
        var d = await r.json();
        if (d && d.error) break;
        if (d) {
          applyPayload(d, state.defTier);
          rememberPagePayload(cacheKeyForState(), d);
          renderContent(true);
          void fetchPilotSkillsBatch(state.groups);
          if (!hasPendingPilotGroups() && !hasPreviewPilotGroups()) {
            showWarmingBanner(false);
            return;
          }
        }
        poll++;
        await sleep(Math.max(800, (d && d.retry_after) ? d.retry_after * 1000 : 1200));
      } catch (e) {
        if (e && e.name === 'AbortError') {
          poll++;
          continue;
        }
        showWarmingBanner(false);
        return;
      }
    }
    showWarmingBanner(false);
  }

  async function loadRankings(force) {
    syncSearchFromDom();
    var key = cacheKeyForState();
    var cachedPayload = !force && state.pageCache[key];
    if (cachedPayload) {
      applyPayload(cachedPayload, state.defTier);
      void fetchPilotSkillsBatch(state.groups);
      if (hasPendingPilotGroups() || hasPreviewPilotGroups()) {
        void loadRankingsPilotsBackground(state._loadGen);
      }
      return;
    }
    if (!force && state.cacheKey === key && state.groups.length && !state.cacheIncomplete) {
      renderContent(false);
      return;
    }
    if (state._fetchCtrl) {
      try { state._fetchCtrl.abort(); } catch (_) {}
    }
    state._fetchCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var loadGen = ++state._loadGen;
    clearTimeout(state._contentRenderTimer);
    clearTimeout(state._skillsRenderTimer);
    state._contentRenderTimer = null;
    state._skillsRenderTimer = null;
    setLoading(true, false);
    showWarmingBanner(false);
    var poll = 0;
    var skillsFetched = false;
    var maxPolls = MAX_LOAD_POLLS;
    var fetchMs = MSY_DEFAULT_FETCH_MS;
    try {
      if (poll === 0) {
        var summaryOpts = { credentials: 'same-origin' };
        if (state._fetchCtrl) summaryOpts.signal = state._fetchCtrl.signal;
        try {
          var sumRes = await fetch(buildApiUrl({ summary: true }), summaryOpts);
          if (sumRes.ok && loadGen === state._loadGen) {
            var sumData = await sumRes.json();
            if (sumData && sumData.groups && sumData.groups.length) {
              applyPayload(sumData, state.defTier);
              setLoading(false, false);
              showWarmingBanner(true, t('msy_pilot_loading') || t('msy_warming_partial') || 'Loading pilots…');
            }
          }
        } catch (sumErr) {
          if (!(sumErr && sumErr.name === 'AbortError')) { /* continue to full fetch */ }
          else return;
        }
      }
      while (poll <= maxPolls) {
        if (loadGen !== state._loadGen) return;
        var fetchOpts = { credentials: 'same-origin' };
        if (state._fetchCtrl) fetchOpts.signal = state._fetchCtrl.signal;
        var timeoutMs = MSY_DEFAULT_FETCH_MS;
        var timeoutId = setTimeout(function () {
          if (state._fetchCtrl) {
            try { state._fetchCtrl.abort(); } catch (_) {}
          }
        }, timeoutMs);
        var r;
        try {
          r = await fetch(buildApiUrl(), fetchOpts);
        } finally {
          clearTimeout(timeoutId);
        }
        var d = null;
        if (r.status === 202 || r.ok) {
          d = await r.json();
        }
        if (loadGen !== state._loadGen) return;
        if (d && d.error) throw new Error(d.detail || d.error);
        if (!r.ok && !d) throw new Error('HTTP ' + r.status);

        var hasGroups = d && d.groups && d.groups.length;
        if (d) {
          applyPayload(d, state.defTier);
          rememberPagePayload(cacheKeyForState(), d);
        }
        if (hasGroups) setLoading(false, false);

        if (d && d.warming) {
          showWarmingBanner(true, hasGroups
            ? (t('msy_warming_partial') || t('msy_warming') || 'Updating rankings…')
            : (t('msy_warming_slow') || 'Rankings are still building. Results may be incomplete — try refreshing in a minute.'));
          poll++;
          if (poll > MAX_LOAD_POLLS) break;
          await sleep(Math.max(1200, (d.retry_after || 2) * 1000));
          continue;
        }

        if (d && d.cache_incomplete && poll < maxPolls) {
          showWarmingBanner(true, t('msy_warming_partial') || t('msy_warming') || 'Updating rankings…');
          poll++;
          await sleep(1400);
          continue;
        }
        if (hasPendingPilotGroups() || hasPreviewPilotGroups()) {
          break;
        }
        break;
      }
      if (!skillsFetched && state.groups.length) {
        skillsFetched = true;
        void fetchPilotSkillsBatch(state.groups);
      }
    } catch (e) {
      if (e && e.name === 'AbortError') {
        if (hasPendingPilotGroups() || hasPreviewPilotGroups()) {
          void loadRankingsPilotsBackground(loadGen);
        }
        return;
      }
      state.groups = [];
      var host = document.getElementById('msyContent');
      if (host) {
        host.innerHTML = '<div class="msy-error">' + esc(String(e)) + '</div>';
      }
    } finally {
      if (loadGen === state._loadGen) {
        setLoading(false, false);
        if (hasPendingPilotGroups() || hasPreviewPilotGroups()) {
          void loadRankingsPilotsBackground(loadGen);
        }
      }
    }
  }

  function scheduleSearchReload() {
    clearTimeout(state._searchTimer);
    state._searchTimer = setTimeout(function () {
      state.page = 1;
      state.cacheKey = null;
      state.groups = [];
      state.total = 0;
      clearPageCache();
      invalidateRenderSignature();
      setLoading(true, false);
      renderContent(true);
      loadRankings(true);
    }, 300);
  }

  function scheduleReload() {
    clearTimeout(state._reloadTimer);
    state._reloadTimer = setTimeout(function () {
      state.page = 1;
      state.cacheKey = null;
      state.groups = [];
      state.total = 0;
      clearPageCache();
      invalidateRenderSignature();
      setLoading(true, false);
      renderContent(true);
      loadRankings(true);
    }, 250);
  }

  function setRankMode(modeId) {
    if (!rankModeDef(modeId)) return;
    if (state.rankMode === modeId && state.groups.length) {
      renderRankModes();
      renderContent(true);
      return;
    }
    state.rankMode = modeId;
    renderRankModes();
    state.page = 1;
    state.cacheKey = null;
    clearPageCache();
    loadRankings(false);
  }

  function toggleSameRoleOnly() {
    state.sameRoleOnly = !state.sameRoleOnly;
    syncGlobalFilterButtons();
    scheduleReload();
  }

  function toggleExcludeShinn() {
    state.excludeShinnGlobal = !state.excludeShinnGlobal;
    syncGlobalFilterButtons();
    invalidateRenderSignature();
    renderContent(true);
  }

  function toggleExcludeUr() {
    state.excludeUrGlobal = !state.excludeUrGlobal;
    if (state.excludeUrGlobal) state.excludeShinnGlobal = true;
    syncGlobalFilterButtons();
    invalidateRenderSignature();
    renderContent(true);
  }

  function passiveToggleNeedsRefetch() {
    var modeId = state.rankMode;
    return (state.groups || []).some(function (g) {
      if (!g || g.pending) return true;
      if (!state.charCondPassiveOn && !state.pilotCondPassiveOn) {
        var offBlk = g.rankings_no_cp_pep && g.rankings_no_cp_pep[modeId];
        return !(offBlk && offBlk.pilots && offBlk.pilots.length);
      }
      if (!state.charCondPassiveOn) {
        var cpBlk = g.rankings_no_cp && g.rankings_no_cp[modeId];
        return !(cpBlk && cpBlk.pilots && cpBlk.pilots.length);
      }
      if (!state.pilotCondPassiveOn) {
        var pepBlk = g.rankings_no_pep && g.rankings_no_pep[modeId];
        return !(pepBlk && pepBlk.pilots && pepBlk.pilots.length);
      }
      var onBlk = (g.rankings && g.rankings[modeId]) || null;
      if (onBlk && onBlk.pilots && onBlk.pilots.length) return false;
      return !(g.pilots && g.pilots.length);
    });
  }

  function toggleCharCondPassive() {
    state.charCondPassiveOn = !state.charCondPassiveOn;
    syncGlobalFilterButtons();
    invalidateRenderSignature();
    clearPageCache();
    state.cacheKey = null;
    loadRankings(false);
  }

  function togglePilotCondPassive() {
    state.pilotCondPassiveOn = !state.pilotCondPassiveOn;
    syncGlobalFilterButtons();
    invalidateRenderSignature();
    clearPageCache();
    state.cacheKey = null;
    loadRankings(false);
  }

  function findGroup(unitId) {
    for (var i = 0; i < state.groups.length; i++) {
      if (state.groups[i].unit && state.groups[i].unit.id === unitId) return state.groups[i];
    }
    return null;
  }

  function updateGlobalShinnBtn() {
    var btn = document.getElementById('msyExcludeShinnBtn');
    if (!btn || !shinnPortraitUrl) return;
    var icon = btn.querySelector('.msy-exclude-shinn-icon');
    if (!icon) return;
    icon.innerHTML = rasterImg(shinnPortraitUrl, { cls: 'msy-exclude-shinn-portrait', loading: 'lazy', alt: 'Shinn', lazy: false }) +
      '<span class="msy-exclude-shinn-x" aria-hidden="true"></span>';
  }

  function ensureShinnPortrait() {
    if (shinnPortraitUrl) {
      updateGlobalShinnBtn();
      return Promise.resolve(shinnPortraitUrl);
    }
    var lang = (global.S && global.S.lang) || 'EN';
    return fetch('/api/character/' + encodeURIComponent(SHINN_EX_CHAR_ID) + '?lang=' + encodeURIComponent(lang) + '&view=ranking')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        shinnPortraitUrl = (d && (d.thum || d.portrait)) || '';
        updateGlobalShinnBtn();
        return shinnPortraitUrl;
      })
      .catch(function () { return ''; });
  }

  function onTabShown() {
    applyLangStatic();
    initFilterLabels();
    if (typeof global.updateRoleFilterButtonLabel === 'function') {
      global.updateRoleFilterButtonLabel('msyUnit');
    }
    if (typeof global.ensureMsyBrowseFilters === 'function') {
      void global.ensureMsyBrowseFilters();
    }
    loadRankings(false);
  }

  function goPage(p) {
    var totalPages = Math.max(1, state.totalPages | 0);
    var next = Math.max(1, Math.min(totalPages, p | 0));
    if (next === state.page && state.groups.length && !state.loading) return;
    state.page = next;
    state.cacheKey = null;
    state.groups = [];
    invalidateRenderSignature();
    renderContent(true);
    setLoading(true, false);
    loadRankings(false);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
  }

  function setPerPage(n) {
    n = parseInt(n, 10);
    if (MSY_PER_PAGE_OPTIONS.indexOf(n) < 0) return;
    if (state.perPage === n && state.groups.length && !state.loading) return;
    state.perPage = n;
    syncPerPageToDom();
    try { localStorage.setItem(MSY_PER_PAGE_STORAGE_KEY, String(n)); } catch (_) {}
    state.page = 1;
    state.cacheKey = null;
    clearPageCache();
    state.groups = [];
    invalidateRenderSignature();
    renderContent(true);
    setLoading(true, false);
    loadRankings(true);
  }

  function openDetailUnit(id) {
    if (typeof global.openDetail === 'function') global.openDetail('unit', id);
  }

  function openDetailChar(id) {
    if (typeof global.openDetail === 'function') global.openDetail('character', id);
  }

  function bindControls() {
    if (state._bound) return;
    state._bound = true;
    var search = document.getElementById('msySearchInput');
    if (search) {
      search.addEventListener('input', function () {
        state.unitQ = expandedUnitSearchQuery(search.value.trim());
        scheduleSearchReload();
      });
    }
    var defSel = document.getElementById('msyDefTierSelect');
    if (defSel) {
      defSel.addEventListener('change', function () {
        var nextTier = Math.max(1, Math.min(3, parseInt(defSel.value, 10) || 1));
        state.defTier = nextTier;
        state.page = 1;
        state.cacheKey = null;
        clearPageCache();
        updateDefTierStats();
        loadRankings(true);
      });
    }
  }

  function init() {
    state.perPage = readStoredPerPage();
    syncPerPageToDom();
    bindControls();
    applyLangStatic();
    void ensureShinnPortrait();
  }

  global.GgenMetaSynergy = {
    init: init,
    onTabShown: onTabShown,
    applyLangStatic: applyLangStatic,
    setRankMode: setRankMode,
    goPage: goPage,
    setPerPage: setPerPage,
    openDetailUnit: openDetailUnit,
    openDetailChar: openDetailChar,
    loadRankings: loadRankings,
    scheduleReload: scheduleReload,
    toggleExcludeUr: toggleExcludeUr,
    toggleExcludeShinn: toggleExcludeShinn,
    toggleSameRoleOnly: toggleSameRoleOnly,
    toggleCharCondPassive: toggleCharCondPassive,
    togglePilotCondPassive: togglePilotCondPassive
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
