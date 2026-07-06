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

  var state = {
    loading: false,
    groups: [],
    total: 0,
    totalPages: 1,
    settings: null,
    defenderTiers: null,
    rankMode: 'super_crit',
    defTier: 3,
    topPilots: 10,
    unitQ: '',
    page: 1,
    perPage: 25,
    cacheKey: null,
    tierCache: {},
    charCondPassiveOn: true,
    excludeUrGlobal: false,
    excludeShinnGlobal: false,
    cacheIncomplete: false,
    _fetchCtrl: null,
    _loadGen: 0,
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

  function pilotMatchesExclusions(pilot, noUr, noShinn) {
    if (!pilot) return false;
    var c = pilot.char || {};
    var cid = String(c.id || '');
    if (noShinn && cid === SHINN_EX_CHAR_ID) return false;
    if (noUr && String(c.rarity || '').toUpperCase() === 'UR') return false;
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

  function groupBlock(g, modeId, noUr, noShinn) {
    if (!g) return null;
    var src;
    if (!state.charCondPassiveOn && g.rankings_no_cp) src = g.rankings_no_cp;
    else if (noShinn) src = g.rankings_no_shinn || g.rankings || {};
    else if (noUr) src = g.rankings_no_ur || g.rankings || {};
    else src = g.rankings || {};
    var block = src[modeId];
    if (!block && !noUr && !noShinn && state.charCondPassiveOn && modeId === 'super_crit' && g.pilots) {
      block = { max_damage: g.max_damage, pilots: g.pilots };
    }
    if (!block) return null;
    if (noUr && noShinn) {
      return rerankPilotBlock(block, modeId, noUr, noShinn);
    }
    if (noUr && src === (g.rankings_no_ur || g.rankings)) return block;
    if (noShinn && src === (g.rankings_no_shinn || g.rankings)) return block;
    if (noUr || noShinn) {
      return rerankPilotBlock(block, modeId, noUr, noShinn);
    }
    return block;
  }

  function viewGroup(g, modeId) {
    var noUr = state.excludeUrGlobal;
    var noShinn = state.excludeShinnGlobal;
    var block = groupBlock(g, modeId, noUr, noShinn);
    if (!block) return null;
    return {
      unit: g.unit,
      weapon_elems: g.weapon_elems,
      weapon_info: g.weapon_info,
      max_damage: block.max_damage || 0,
      pilots: block.pilots || [],
      is_sd: g.is_sd,
      rankings: g.rankings,
      rankings_no_ur: g.rankings_no_ur,
      rankings_no_shinn: g.rankings_no_shinn,
      rankings_no_cp: g.rankings_no_cp
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

  function buildFilterQuery() {
    var parts = [];
    if (typeof global.getRoleQuerySuffix === 'function') {
      parts.push(global.getRoleQuerySuffix('msyUnit').replace(/^&/, ''));
    }
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

  function cacheKeyBase() {
    return [
      (global.S && global.S.lang) || 'EN',
      state.topPilots,
      state.charCondPassiveOn ? 'cp1' : 'cp0',
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
      'per_page=' + encodeURIComponent(String(state.perPage))
    ];
    if (fq) q.push(fq);
    return '/api/meta_synergy_rankings?' + q.join('&');
  }

  function tierCacheKey(defTier, rankMode) {
    return cacheKeyForState().replace(/\|pg:\d+/, '|pg:1').replace(
      /\|rm:[^|]+/,
      '|rm:' + (rankMode || state.rankMode)
    ).replace(/\|dt:\d+/, '|dt:' + (defTier != null ? defTier : state.defTier));
  }

  function applyPayload(d, defTier) {
    state.groups = d.groups || [];
    state.total = d.total || 0;
    state.totalPages = d.total_pages || 1;
    state.page = d.page || state.page;
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
    renderContent();
    if (d.cache_incomplete) {
      showWarmingBanner(true, t('msy_warming_partial') || t('msy_warming') || 'Updating rankings…');
    }
  }

  function syncGlobalFilterButtons() {
    var cpBtn = document.getElementById('msyCpToggleBtn');
    if (cpBtn) {
      cpBtn.title = state.charCondPassiveOn ? t('msy_cp_on') : t('msy_cp_off');
      cpBtn.setAttribute('aria-pressed', state.charCondPassiveOn ? 'true' : 'false');
      cpBtn.classList.toggle('active', state.charCondPassiveOn);
    }
    var urBtn = document.getElementById('msyExcludeUrBtn');
    if (urBtn) {
      urBtn.title = state.excludeUrGlobal ? t('msy_exclude_ur_on') : t('msy_exclude_ur');
      urBtn.setAttribute('aria-pressed', state.excludeUrGlobal ? 'true' : 'false');
      urBtn.classList.toggle('active', state.excludeUrGlobal);
    }
    var shBtn = document.getElementById('msyExcludeShinnBtn');
    if (shBtn) {
      shBtn.title = state.excludeShinnGlobal ? t('msy_exclude_shinn_on') : t('msy_exclude_shinn');
      shBtn.setAttribute('aria-pressed', state.excludeShinnGlobal ? 'true' : 'false');
      shBtn.classList.toggle('active', state.excludeShinnGlobal);
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
    var el = document.getElementById('msyDefTierStats');
    if (!el) return;
    var tiers = state.defenderTiers || {};
    var dt = String(state.defTier || '1');
    var row = tiers[dt] || tiers[String(dt)];
    if (!row) {
      el.textContent = '';
      return;
    }
    el.textContent = 'MS DEF ' + fmtN(row.unit_def) + ' · Pilot DEF ' + fmtN(row.char_def);
    el.title = row.label || '';
  }

  function renderStatus() {
    var mode = rankModeDef(state.rankMode);
    var el = document.getElementById('msyStatus');
    var countEl = document.getElementById('msyToolbarCount');
    if (countEl) {
      countEl.innerHTML = '<span class="result-count-num">' + fmtN(state.total) + '</span> ' + esc(t('count_unit'));
    }
    if (!el) return;
    var vigorLbl = t(mode.vigorLabelKey || 'dc_vigor_super');
    el.innerHTML =
      '<span class="msy-status-chip">' + esc(t('msy_status_units').replace('{n}', fmtN(state.total))) + '</span>' +
      '<span class="msy-status-chip">' + esc(t('msy_status_metric').replace('{m}', t(mode.metricKey))) + '</span>' +
      '<span class="msy-status-chip">' + esc(t('msy_status_vigor').replace('{v}', vigorLbl)) + '</span>';
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
    if (!skills.length) return '';
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
    html += '</div>';
    return html;
  }

  function pilotDamage(pilot, mode) {
    if (!pilot) return 0;
    if (mode.dmgField && pilot[mode.dmgField]) return pilot[mode.dmgField];
    return pilot.score || 0;
  }

  function renderPilotCard(unitId, pilot, mode) {
    var c = pilot.char || {};
    var dmg = pilotDamage(pilot, mode);
    var sub = '';
    if (pilot.guaranteed_crit) {
      sub = '<div class="msy-pilot-sub msy-pilot-sub--gc">' + esc(t('msy_guaranteed_crit')) + '</div>';
    } else if (pilot.crit_rate) {
      sub = '<div class="msy-pilot-sub">' + esc(t('msy_crit_rate')).replace('{n}', String(pilot.crit_rate)) + '</div>';
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
            sub +
          '</div>' +
        '</button>' +
        '<div class="msy-pilot-dmg">' + fmtN(dmg) + '</div>' +
        '<div class="msy-pilot-actions">' +
          '<button type="button" class="msy-act-btn" title="' + escAttr(t('msy_open_sim')) + '" onclick="GgenMetaSynergy.openInSimulator(\'' + escJs(unitId) + '\',\'' + escJs(c.id) + '\')">↗</button>' +
        '</div>' +
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
      var row = viewGroup(g, mode.id);
      if (!row || !row.unit) return;
      var rank = (startRank || 0) + gi + 1;
      var u = row.unit;
      html += '<article class="msy-unit-card' + (row.is_sd ? ' msy-unit-card--sd' : '') + '">';
      html += '<header class="msy-unit-head">';
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
      html += '<div class="msy-unit-peak-lbl">' + esc(t(mode.metricKey)) + '</div>';
      html += '</div>';
      html += '</header>';
      html += renderPilotGrid(row.pilots, u.id, mode);
      html += '</article>';
    });
    html += '</div>';
    return html;
  }

  function renderPagination() {
    var host = document.getElementById('msyPagination');
    if (!host) return;
    if (state.totalPages <= 1) {
      host.innerHTML = '';
      return;
    }
    if (typeof global.renderPagination === 'function') {
      host.innerHTML = global.renderPagination(state.page, state.totalPages, 'GgenMetaSynergy.goPage');
      return;
    }
    host.innerHTML = '<span>' + state.page + ' / ' + state.totalPages + '</span>';
  }

  function renderContent() {
    var mode = rankModeDef(state.rankMode);
    renderStatus();
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

  async function loadRankings(force) {
    syncSearchFromDom();
    var key = cacheKeyForState();
    if (!force && state.cacheKey === key && state.groups.length) {
      renderContent();
      return;
    }
    if (state._fetchCtrl) {
      try { state._fetchCtrl.abort(); } catch (_) {}
    }
    state._fetchCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var loadGen = ++state._loadGen;
    setLoading(true, false);
    showWarmingBanner(false);
    state._warmPolls = 0;
    try {
      while (true) {
        if (loadGen !== state._loadGen) return;
        var fetchOpts = { credentials: 'same-origin' };
        if (state._fetchCtrl) fetchOpts.signal = state._fetchCtrl.signal;
        var r = await fetch(buildApiUrl(), fetchOpts);
        var d = null;
        if (r.status === 202 || r.ok) {
          d = await r.json();
        }
        if (loadGen !== state._loadGen) return;
        if (d && d.warming) {
          if (d.groups && d.groups.length) {
            applyPayload(d, state.defTier);
            setLoading(false, false);
            showWarmingBanner(true);
            state._warmPolls = (state._warmPolls || 0) + 1;
            if (state._warmPolls >= 2) {
              showWarmingBanner(true, t('msy_warming_slow') || 'Rankings are still building. Results may be incomplete — try refreshing in a minute.');
              break;
            }
            await sleep(Math.max(1200, (d.retry_after || 2) * 1000));
            continue;
          }
          applyPayload(d, state.defTier);
          showWarmingBanner(true, t('msy_warming_slow') || 'Rankings are still building. Results may be incomplete — try refreshing in a minute.');
          break;
        }
        if (d && d.error) throw new Error(d.detail || d.error);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        showWarmingBanner(false);
        applyPayload(d, state.defTier);
        break;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      var host = document.getElementById('msyContent');
      if (host) {
        host.innerHTML = '<div class="msy-error">' + esc(String(e)) + '</div>';
      }
    } finally {
      if (loadGen === state._loadGen) {
        setLoading(false, false);
      }
    }
  }

  function scheduleSearchReload() {
    clearTimeout(state._searchTimer);
    state._searchTimer = setTimeout(function () {
      state.page = 1;
      state.cacheKey = null;
      loadRankings(true);
    }, 400);
  }

  function scheduleReload() {
    clearTimeout(state._reloadTimer);
    state._reloadTimer = setTimeout(function () {
      state.page = 1;
      state.cacheKey = null;
      loadRankings(true);
    }, 400);
  }

  function setRankMode(modeId) {
    if (!rankModeDef(modeId)) return;
    state.rankMode = modeId;
    renderRankModes();
    renderContent();
  }

  function toggleExcludeShinn() {
    state.excludeShinnGlobal = !state.excludeShinnGlobal;
    syncGlobalFilterButtons();
    renderContent();
  }

  function toggleExcludeUr() {
    state.excludeUrGlobal = !state.excludeUrGlobal;
    syncGlobalFilterButtons();
    renderContent();
  }

  function toggleCharCondPassive() {
    state.charCondPassiveOn = !state.charCondPassiveOn;
    applyLangStatic();
    renderContent();
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
    if (typeof global.ensureMsyBrowseFilters === 'function') {
      void global.ensureMsyBrowseFilters();
    }
    loadRankings(false);
  }

  function goPage(p) {
    state.page = Math.max(1, p | 0);
    state.cacheKey = null;
    loadRankings(false);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
  }

  function openDetailUnit(id) {
    if (typeof global.openDetail === 'function') global.openDetail('unit', id);
  }

  function openDetailChar(id) {
    if (typeof global.openDetail === 'function') global.openDetail('character', id);
  }

  function resolveDefenderStats() {
    var tiers = state.defenderTiers || {};
    var dt = String(state.defTier || '1');
    if (state.defUnitOverride && state.defCharOverride) {
      return {
        unitDef: parseInt(state.defUnitOverride, 10) || 0,
        charDef: parseInt(state.defCharOverride, 10) || 0
      };
    }
    var row = tiers[dt] || tiers[String(parseInt(dt, 10))] || {};
    return {
      unitDef: row.unit_def || 3819,
      charDef: row.char_def || 193
    };
  }

  async function openInSimulator(unitId, charId) {
    if (typeof global.switchTab !== 'function') return;
    global.switchTab('calculator');
    try {
      var lang = (global.S && global.S.lang) || 'EN';
      var ur = await fetch('/api/unit/' + encodeURIComponent(unitId) + '?lang=' + encodeURIComponent(lang));
      var ud = await ur.json();
      var cr = await fetch('/api/character/' + encodeURIComponent(charId) + '?lang=' + encodeURIComponent(lang));
      var cd = await cr.json();
      if (ud.error || cd.error) return;
      if (!global.S || !global.S.dc) return;

      var defStats = resolveDefenderStats();
      if (typeof global.setDcDefTargetMode === 'function') {
        global.setDcDefTargetMode('custom');
      }
      (function (pack) {
        function setv(id, v) {
          var el = document.getElementById(id);
          if (el) el.value = v;
        }
        setv('dcDefManual_uName', pack.un);
        setv('dcDefManual_cName', pack.cn);
        setv('dcDefManual_uHP', pack.uHP);
        setv('dcDefManual_uATK', pack.uATK);
        setv('dcDefManual_uDEF', pack.uDEF);
        setv('dcDefManual_uMOB', pack.uMOB);
        setv('dcDefManual_cRNG', pack.cRNG);
        setv('dcDefManual_cMEL', pack.cMEL);
        setv('dcDefManual_cAWK', pack.cAWK);
        setv('dcDefManual_cDEF', pack.cDEF);
        setv('dcDefManual_cREA', pack.cREA);
      })({
        un: 'Defender (MSY)',
        cn: 'Defender Pilot (MSY)',
        uHP: 0,
        uATK: 0,
        uDEF: defStats.unitDef,
        uMOB: 0,
        cRNG: 0,
        cMEL: 0,
        cAWK: 0,
        cDEF: defStats.charDef,
        cREA: 0
      });

      global.S.dc.atkUnit = unitId;
      global.S.dc.atkUnitData = ud;
      if (typeof global._dcPickBestWeaponIndices === 'function') {
        var bw = global._dcPickBestWeaponIndices(ud);
        global.S.dc.wpnIdx = bw.wpnIdx;
        global.S.dc.wpnLv = bw.wpnLv;
      }
      global.S.dc.unitStatMode = 'normal';
      global.S.dc.unitCondPassive = true;
      global.S.dc.atkChar = charId;
      global.S.dc.atkCharData = cd;
      global.S.dc.charStatMode = 'normal';
      global.S.dc.defLbTier = 3;
      var mode = rankModeDef(state.rankMode);
      if (typeof global.setDcMp === 'function') global.setDcMp(mode.vigor || 'super');
      if (typeof global._dcSyncCharCondPassiveFromPair === 'function' && state.charCondPassiveOn) {
        global._dcSyncCharCondPassiveFromPair();
      } else {
        global.S.dc.charCondPassive = !!state.charCondPassiveOn;
      }
      if (typeof global._dcSyncSuperchargedExTierForVigor === 'function') global._dcSyncSuperchargedExTierForVigor();
      if (typeof global.renderDcAtkUnit === 'function') global.renderDcAtkUnit();
      if (typeof global.renderDcAtkChar === 'function') global.renderDcAtkChar();
      if (typeof global.renderDcDefStats === 'function') global.renderDcDefStats();
      if (typeof global._dcAutoEnableMaxDamageSkills === 'function') global._dcAutoEnableMaxDamageSkills();
      if (typeof global._dcRecalcPilotBonuses === 'function') global._dcRecalcPilotBonuses(true);
      if (typeof global.onDcParamChange === 'function') global.onDcParamChange();
    } catch (_) {}
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
        updateDefTierStats();
        loadRankings(true);
      });
    }
  }

  function init() {
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
    openDetailUnit: openDetailUnit,
    openDetailChar: openDetailChar,
    openInSimulator: openInSimulator,
    loadRankings: loadRankings,
    scheduleReload: scheduleReload,
    toggleExcludeUr: toggleExcludeUr,
    toggleExcludeShinn: toggleExcludeShinn,
    toggleCharCondPassive: toggleCharCondPassive
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
