(function (global) {
  'use strict';

  var RANK_MODES = [
    { id: 'super_crit', labelKey: 'msy_rank_super_crit', metricKey: 'msy_metric_super_crit', dmgField: 'super_crit_dmg', vigor: 'super', vigorLabelKey: 'dc_vigor_super', icon: '/static/images/UI/UI_Tention_Up_03.webp' },
    { id: 'crit', labelKey: 'msy_rank_crit', metricKey: 'msy_metric_crit', dmgField: 'crit_dmg', vigor: 'max', vigorLabelKey: 'dc_vigor_max', icon: '/static/images/UI/UI_Tention_Up_01.webp' },
    { id: 'normal', labelKey: 'msy_rank_normal', metricKey: 'msy_metric_normal', dmgField: 'normal_dmg', vigor: 'high', vigorLabelKey: 'dc_vigor_high', icon: '/static/images/UI/UI_Tention_Up_02.webp' }
  ];

  var UR_ICON = '/static/images/UI/UI_Common_RarityIcon_UR.webp';

  var state = {
    loading: false,
    groups: [],
    total: 0,
    totalPages: 1,
    settings: null,
    defenderTiers: null,
    rankMode: 'super_crit',
    defTier: 1,
    defUnitOverride: '',
    defCharOverride: '',
    topPilots: 20,
    unitQ: '',
    page: 1,
    perPage: 50,
    cacheKey: null,
    tierCache: {},
    excludeUrUnits: {},
    excludeGuaranteedCrit: false,
    unitViewMode: {}
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

  function groupBlock(g, modeId, noUr, noGc) {
    if (!g) return null;
    var src;
    if (noGc) src = g.rankings_no_gc || g.rankings || {};
    else if (noUr) src = g.rankings_no_ur || g.rankings || {};
    else src = g.rankings || {};
    var block = src[modeId];
    if (block) return block;
    if (!noUr && !noGc && modeId === 'super_crit' && g.pilots) {
      return { max_damage: g.max_damage, pilots: g.pilots };
    }
    return null;
  }

  function viewGroup(g, modeId) {
    var noUr = !!(g.unit && state.excludeUrUnits[g.unit.id]);
    var noGc = !!state.excludeGuaranteedCrit;
    var block = groupBlock(g, modeId, noUr, noGc);
    if (!block) return null;
    return {
      unit: g.unit,
      weapon_elems: g.weapon_elems,
      max_damage: block.max_damage || 0,
      pilots: block.pilots || [],
      is_sd: g.is_sd,
      rankings: g.rankings,
      rankings_no_ur: g.rankings_no_ur,
      rankings_no_gc: g.rankings_no_gc
    };
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
      state.defUnitOverride,
      state.defCharOverride,
      state.topPilots,
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
    if (state.defUnitOverride && state.defCharOverride) {
      q.push('def_unit=' + encodeURIComponent(String(state.defUnitOverride)));
      q.push('def_char=' + encodeURIComponent(String(state.defCharOverride)));
    }
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
    prefetchDefTiers();
    prefetchRankModes();
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
    el = document.getElementById('msyExcludeGcBtn');
    if (el) {
      el.title = state.excludeGuaranteedCrit ? t('msy_exclude_gc_on') : t('msy_exclude_gc');
      el.setAttribute('aria-pressed', state.excludeGuaranteedCrit ? 'true' : 'false');
      el.classList.toggle('active', state.excludeGuaranteedCrit);
    }
    renderRankModes();
  }

  function populateDefTierSelect(tiers) {
    var sel = document.getElementById('msyDefTierSelect');
    if (!sel || !tiers) return;
    var cur = String(state.defTier || '1');
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
    var defUnit = document.getElementById('msyDefUnitInput');
    var defChar = document.getElementById('msyDefCharInput');
    if (defUnit) defUnit.placeholder = t('msy_def_unit_ph');
    if (defChar) defChar.placeholder = t('msy_def_char_ph');
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
    var note = (state.settings && state.settings.defender_note) || '';
    var vigorLbl = t(mode.vigorLabelKey || 'dc_vigor_super');
    el.innerHTML =
      '<span class="msy-status-chip">' + esc(t('msy_status_units').replace('{n}', fmtN(state.total))) + '</span>' +
      '<span class="msy-status-chip">' + esc(t('msy_status_metric').replace('{m}', t(mode.metricKey))) + '</span>' +
      '<span class="msy-status-chip">' + esc(t('msy_status_vigor').replace('{v}', vigorLbl)) + '</span>' +
      (note ? '<span class="msy-status-note">' + esc(note) + '</span>' : '');
    updateDefTierStats();
  }

  function pilotDamage(pilot, mode) {
    if (!pilot) return 0;
    if (mode.dmgField && pilot[mode.dmgField]) return pilot[mode.dmgField];
    return pilot.score || 0;
  }

  function excludeUrBtnHtml(unitId, active, isSd) {
    if (isSd) return '';
    return (
      '<button type="button" class="msy-act-btn msy-exclude-ur-btn' + (active ? ' active' : '') + '" title="' + escAttr(active ? t('msy_exclude_ur_on') : t('msy_exclude_ur')) + '" onclick="GgenMetaSynergy.toggleExcludeUr(\'' + escJs(unitId) + '\')">' +
        '<span class="msy-exclude-ur-icon">' +
          rasterImg(UR_ICON, { cls: 'msy-exclude-ur-rarity', loading: 'lazy', alt: 'UR', lazy: false }) +
          '<span class="msy-exclude-ur-x" aria-hidden="true"></span>' +
        '</span>' +
      '</button>'
    );
  }

  function chartBtnHtml(unitId, active) {
    return (
      '<button type="button" class="msy-act-btn msy-chart-btn' + (active ? ' active' : '') + '" title="' + escAttr(t('msy_chart')) + '" aria-pressed="' + (active ? 'true' : 'false') + '" onclick="GgenMetaSynergy.toggleChartView(\'' + escJs(unitId) + '\')">' +
        '<svg class="msy-chart-btn-svg" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
          '<rect x="1" y="9" width="3" height="6" rx="0.6"></rect>' +
          '<rect x="6" y="5" width="3" height="10" rx="0.6"></rect>' +
          '<rect x="11" y="2" width="3" height="13" rx="0.6"></rect>' +
        '</svg>' +
      '</button>'
    );
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

  function renderVerticalBarChart(pilots, mode, unitId) {
    var list = (pilots || []).slice(0, 10);
    if (!list.length) return '<div class="msy-chart-empty">' + esc(t('msy_empty')) + '</div>';
    var max = 1;
    list.forEach(function (p) {
      max = Math.max(max, pilotDamage(p, mode) || 0);
    });
    var html = '<div class="msy-vbar-chart" data-msy-unit="' + escAttr(unitId) + '">';
    list.forEach(function (p, i) {
      var c = p.char || {};
      var dmg = pilotDamage(p, mode);
      var pct = Math.max(6, Math.round((dmg / max) * 100));
      html += '<div class="msy-vbar-col" style="--msy-bar-delay:' + (i * 28) + 'ms">';
      html += '<div class="msy-vbar-val">' + fmtN(dmg) + '</div>';
      html += '<div class="msy-vbar-stack"><div class="msy-vbar-fill" data-msy-height="' + pct + '" style="height:0"></div></div>';
      html += '<button type="button" class="msy-vbar-open" title="' + escAttr(c.name || '') + '" onclick="GgenMetaSynergy.openDetailChar(\'' + escJs(c.id) + '\')">';
      html += '<div class="msy-vbar-thumb">' + pilotThumb(c) + '</div>';
      html += '<div class="msy-vbar-rank">' + (p.rank || (i + 1)) + '</div>';
      html += '</button>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function animateBarFills(root) {
    if (!root) return;
    root.querySelectorAll('.msy-vbar-fill').forEach(function (el) {
      el.style.height = (el.getAttribute('data-msy-height') || '0') + '%';
    });
  }

  function renderGroups(groups, startRank, mode) {
    var html = '<div class="msy-groups">';
    groups.forEach(function (g, gi) {
      var row = viewGroup(g, mode.id);
      if (!row || !row.unit) return;
      var rank = (startRank || 0) + gi + 1;
      var u = row.unit;
      var excludeUr = !!state.excludeUrUnits[u.id];
      var chartMode = state.unitViewMode[u.id] === 'chart';
      html += '<article class="msy-unit-card' + (row.is_sd ? ' msy-unit-card--sd' : '') + (chartMode ? ' msy-unit-card--chart' : '') + '">';
      html += '<header class="msy-unit-head">';
      html += '<span class="msy-unit-rank">' + rank + '</span>';
      html += '<div class="msy-unit-thumb">' + unitThumb(u) + '</div>';
      html += '<div class="msy-unit-main">';
      html += '<div class="msy-unit-name-row">';
      html += roleIconHtml(u);
      html += '<span class="msy-unit-name">' + esc(u.name) + '</span>';
      html += '</div>';
      if (row.is_sd) {
        html += '<div class="msy-unit-elem msy-unit-elem--sd">' + esc(t('msy_sd_note')) + '</div>';
      } else if (g.weapon_elems) {
        html += '<div class="msy-unit-elem">&lt;' + esc(g.weapon_elems) + '&gt;</div>';
      }
      html += '</div>';
      html += '<div class="msy-unit-tools">';
      html += chartBtnHtml(u.id, chartMode);
      html += excludeUrBtnHtml(u.id, excludeUr, row.is_sd);
      html += '</div>';
      html += '<div class="msy-unit-peak">';
      html += '<div class="msy-unit-peak-val">' + fmtN(row.max_damage) + '</div>';
      html += '<div class="msy-unit-peak-lbl">' + esc(t(mode.metricKey)) + '</div>';
      html += '</div>';
      html += '</header>';
      if (chartMode) {
        html += renderVerticalBarChart(row.pilots, mode, u.id);
      } else {
        html += renderPilotGrid(row.pilots, u.id, mode);
      }
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
    requestAnimationFrame(function () {
      host.querySelectorAll('.msy-vbar-chart').forEach(function (el) { animateBarFills(el); });
    });
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

  function prefetchDefTiers() {
    [1, 2, 3].forEach(function (tier) {
      if (tier === state.defTier) return;
      var key = tierCacheKey(tier, state.rankMode);
      if (state.tierCache[key]) return;
      fetch(buildApiUrl({ defTier: tier, page: state.page }), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || d.warming) return;
          state.tierCache[key] = {
            cacheKey: cacheKeyForState().replace(/\|pg:\d+/, '|pg:1'),
            groups: d.groups || [],
            total: d.total || 0,
            totalPages: d.total_pages || 1,
            page: d.page || state.page,
            settings: d.settings || null
          };
        })
        .catch(function () {});
    });
  }

  function prefetchRankModes() {
    RANK_MODES.forEach(function (m) {
      if (m.id === state.rankMode) return;
      var key = tierCacheKey(state.defTier, m.id);
      if (state.tierCache[key]) return;
      fetch(buildApiUrl({ rankMode: m.id, page: state.page }), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || d.warming) return;
          state.tierCache[key] = {
            cacheKey: cacheKeyForState().replace(/\|pg:\d+/, '|pg:1'),
            groups: d.groups || [],
            total: d.total || 0,
            totalPages: d.total_pages || 1,
            page: d.page || state.page,
            settings: d.settings || null
          };
        })
        .catch(function () {});
    });
  }

  function syncSearchFromDom() {
    var el = document.getElementById('msySearchInput');
    if (el) state.unitQ = el.value.trim();
  }

  async function loadRankings(force) {
    syncSearchFromDom();
    var key = cacheKeyForState();
    if (!force && state.cacheKey === key && state.groups.length) {
      renderContent();
      return;
    }
    var tierKey = tierCacheKey(state.defTier, state.rankMode);
    if (!force && state.tierCache[tierKey] && state.tierCache[tierKey].cacheKey === cacheKeyForState().replace(/\|pg:\d+/, '|pg:1')) {
      var hit = state.tierCache[tierKey];
      state.groups = hit.groups;
      state.total = hit.total;
      state.totalPages = hit.totalPages;
      state.page = hit.page || state.page;
      state.settings = hit.settings;
      state.cacheKey = key;
      renderContent();
      return;
    }
    setLoading(true, false);
    showWarmingBanner(false);
    state._warmPolls = 0;
    try {
      while (true) {
        var r = await fetch(buildApiUrl(), { credentials: 'same-origin' });
        var d = null;
        if (r.status === 202 || r.ok) {
          d = await r.json();
        }
        if (d && d.warming) {
          if (d.groups && d.groups.length) {
            applyPayload(d, state.defTier);
            setLoading(false, false);
            showWarmingBanner(true);
          } else {
            setLoading(true, true);
            showWarmingBanner(false);
          }
          state._warmPolls = (state._warmPolls || 0) + 1;
          if (state._warmPolls >= 36) {
            showWarmingBanner(true, t('msy_warming_slow') || 'Rankings are still building. Results may be incomplete — try refreshing in a minute.');
            break;
          }
          await sleep(Math.max(3000, (d.retry_after || 5) * 1000));
          continue;
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        showWarmingBanner(false);
        applyPayload(d, state.defTier);
        prefetchDefTiers();
        break;
      }
    } catch (e) {
      var host = document.getElementById('msyContent');
      if (host) {
        host.innerHTML = '<div class="msy-error">' + esc(String(e)) + '</div>';
      }
    } finally {
      setLoading(false, false);
    }
  }

  function scheduleSearchReload() {
    clearTimeout(state._searchTimer);
    state._searchTimer = setTimeout(function () {
      state.page = 1;
      state.cacheKey = null;
      state.tierCache = {};
      loadRankings(true);
    }, 180);
  }

  function scheduleReload() {
    clearTimeout(state._reloadTimer);
    state._reloadTimer = setTimeout(function () {
      state.page = 1;
      state.cacheKey = null;
      state.tierCache = {};
      loadRankings(true);
    }, 180);
  }

  function setRankMode(modeId) {
    if (!rankModeDef(modeId)) return;
    state.rankMode = modeId;
    state.page = 1;
    renderRankModes();
    var tierKey = tierCacheKey(state.defTier, modeId);
    if (state.tierCache[tierKey] && state.tierCache[tierKey].cacheKey === cacheKeyForState().replace(/\|pg:\d+/, '|pg:1')) {
      var hit = state.tierCache[tierKey];
      state.groups = hit.groups;
      state.total = hit.total;
      state.totalPages = hit.totalPages;
      state.page = hit.page || 1;
      state.settings = hit.settings;
      state.cacheKey = cacheKeyForState();
      renderContent();
      prefetchRankModes();
      return;
    }
    state.cacheKey = null;
    loadRankings(false);
  }

  function toggleExcludeUr(unitId) {
    if (state.excludeUrUnits[unitId]) delete state.excludeUrUnits[unitId];
    else state.excludeUrUnits[unitId] = true;
    renderContent();
  }

  function toggleExcludeGuaranteedCrit() {
    state.excludeGuaranteedCrit = !state.excludeGuaranteedCrit;
    applyLangStatic();
    renderContent();
  }

  function findGroup(unitId) {
    for (var i = 0; i < state.groups.length; i++) {
      if (state.groups[i].unit && state.groups[i].unit.id === unitId) return state.groups[i];
    }
    return null;
  }

  function toggleChartView(unitId) {
    if (state.unitViewMode[unitId] === 'chart') delete state.unitViewMode[unitId];
    else state.unitViewMode[unitId] = 'chart';
    renderContent();
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
      global.S.dc.charCondPassive = true;
      global.S.dc.defLbTier = 3;
      var mode = rankModeDef(state.rankMode);
      if (typeof global.setDcMp === 'function') global.setDcMp(mode.vigor || 'super');
      if (global.S.dc.atkCharData && global.S.dc.atkCharData.ex_supercharged_tiers &&
          global.S.dc.atkCharData.ex_supercharged_tiers.length > 1 && global.S.dc.charCondPassive) {
        global.S.dc.dcSuperchargedExTier = global.S.dc.atkCharData.ex_supercharged_tiers.length - 1;
      }
      if (typeof global.setDcCharCondPassive === 'function') global.setDcCharCondPassive(true);
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
        state.unitQ = search.value.trim();
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
        var tierKey = tierCacheKey(nextTier, state.rankMode);
        if (state.tierCache[tierKey] && state.tierCache[tierKey].cacheKey === cacheKeyForState().replace(/\|pg:\d+/, '|pg:1')) {
          var cached = state.tierCache[tierKey];
          state.groups = cached.groups;
          state.total = cached.total;
          state.totalPages = cached.totalPages;
          state.settings = cached.settings;
          state.cacheKey = cacheKeyForState();
          renderContent();
          prefetchDefTiers();
          prefetchRankModes();
        } else {
          loadRankings(false);
        }
      });
    }
    var defUnit = document.getElementById('msyDefUnitInput');
    var defChar = document.getElementById('msyDefCharInput');
    function onDefOverrideChange() {
      state.defUnitOverride = defUnit && defUnit.value.trim() ? defUnit.value.trim() : '';
      state.defCharOverride = defChar && defChar.value.trim() ? defChar.value.trim() : '';
      state.cacheKey = null;
      state.tierCache = {};
      state.page = 1;
      loadRankings(true);
    }
    if (defUnit) {
      defUnit.addEventListener('change', onDefOverrideChange);
      defUnit.addEventListener('keydown', function (e) { if (e.key === 'Enter') onDefOverrideChange(); });
    }
    if (defChar) {
      defChar.addEventListener('change', onDefOverrideChange);
      defChar.addEventListener('keydown', function (e) { if (e.key === 'Enter') onDefOverrideChange(); });
    }
  }

  function init() {
    bindControls();
    applyLangStatic();
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
    toggleExcludeGuaranteedCrit: toggleExcludeGuaranteedCrit,
    toggleChartView: toggleChartView
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
