(function (global) {
  'use strict';

  var RANK_MODES = [
    { id: 'super_crit', labelKey: 'msy_rank_super_crit', metricKey: 'msy_metric_super_crit', dmgField: 'super_crit_dmg', icon: '/static/images/UI/UI_Tention_Up_03.webp' },
    { id: 'crit', labelKey: 'msy_rank_crit', metricKey: 'msy_metric_crit', dmgField: 'crit_dmg', icon: '/static/images/UI/UI_Tention_Up_01.webp' },
    { id: 'normal', labelKey: 'msy_rank_normal', metricKey: 'msy_metric_normal', dmgField: 'normal_dmg', icon: '/static/images/UI/UI_Tention_Up_02.webp' }
  ];

  var state = {
    loading: false,
    groups: [],
    total: 0,
    totalPages: 1,
    settings: null,
    rankMode: 'super_crit',
    vigor: 'super',
    defTier: 3,
    topPilots: 10,
    unitQ: '',
    page: 1,
    perPage: 50,
    cacheKey: null
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

  function sleep(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function rankModeDef(modeId) {
    for (var i = 0; i < RANK_MODES.length; i++) {
      if (RANK_MODES[i].id === modeId) return RANK_MODES[i];
    }
    return RANK_MODES[0];
  }

  function unitThumb(entity) {
    if (!entity) return '';
    var row = {
      thum: entity.thum || '',
      rarity: entity.rarity || 'N',
      role_icon: entity.role_icon || '',
      acquisition_icon: entity.acquisition_icon || '',
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
      rarity: entity.rarity || 'N',
      role_icon: entity.role_icon || ''
    };
    var inner = global.renderListThumb(row, 'char', null);
    return '<div class="msy-pilot-thumb-slot">' + inner + '</div>';
  }

  function roleIconHtml(entity) {
    if (!entity || !entity.role_icon) return '';
    if (typeof global.pictureRasterHtml === 'function') {
      return global.pictureRasterHtml(entity.role_icon, {
        cls: 'msy-role-icon',
        loading: 'lazy',
        decoding: 'async',
        alt: '',
        lazy: false
      });
    }
    return '<img class="msy-role-icon" src="' + escAttr(imgUrl(entity.role_icon)) + '" alt="" loading="lazy" decoding="async">';
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
    return parts.filter(Boolean).join('&');
  }

  function buildApiUrl() {
    var lang = (global.S && global.S.lang) || 'EN';
    var fq = buildFilterQuery();
    var q = [
      'lang=' + encodeURIComponent(lang),
      'vigor=' + encodeURIComponent(state.vigor),
      'def_tier=' + encodeURIComponent(String(state.defTier)),
      'lb_tier=3',
      'top_pilots=' + encodeURIComponent(String(state.topPilots)),
      'unit_q=' + encodeURIComponent(state.unitQ || ''),
      'rank_mode=' + encodeURIComponent(state.rankMode),
      'page=' + encodeURIComponent(String(state.page)),
      'per_page=' + encodeURIComponent(String(state.perPage))
    ];
    if (fq) q.push(fq);
    return '/api/meta_synergy_rankings?' + q.join('&');
  }

  function cacheKeyForState() {
    return [
      (global.S && global.S.lang) || 'EN',
      buildFilterQuery(),
      state.vigor,
      state.defTier,
      state.topPilots,
      state.unitQ,
      state.rankMode,
      state.page
    ].join('|');
  }

  function renderRankModes() {
    var host = document.getElementById('msyRankModes');
    if (!host) return;
    var html = '';
    RANK_MODES.forEach(function (m) {
      var active = state.rankMode === m.id;
      html += '<button type="button" class="msy-rank-mode' + (active ? ' active' : '') + '" role="tab" aria-selected="' + (active ? 'true' : 'false') + '" data-msy-rank-mode="' + escAttr(m.id) + '" onclick="GgenMetaSynergy.setRankMode(\'' + escJs(m.id) + '\')">';
      html += '<img class="msy-rank-mode-icon" src="' + escAttr(imgUrl(m.icon)) + '" alt="" width="28" height="28" loading="lazy" decoding="async">';
      html += '<span class="msy-rank-mode-label">' + esc(t(m.labelKey)) + '</span>';
      html += '</button>';
    });
    host.innerHTML = html;
  }

  function applyLangStatic() {
    var el = document.getElementById('msyHeroSub');
    if (el) el.textContent = t('msy_hero_sub');
    el = document.getElementById('msySearchInput');
    if (el) el.placeholder = t('msy_search_ph');
    el = document.getElementById('msyEmptyText');
    if (el) el.textContent = t('msy_empty');
    renderRankModes();
  }

  function initFilterLabels() {
    if (typeof global.fillRolePanelIcons === 'function') global.fillRolePanelIcons('msyUnit');
    if (typeof global.fillRarityPanelIcons === 'function') global.fillRarityPanelIcons('msyUnit');
    if (typeof global.fillSourcePanel === 'function') global.fillSourcePanel('msyUnit');
    if (typeof global.updateRoleFilterButtonLabel === 'function') global.updateRoleFilterButtonLabel('msyUnit');
    if (typeof global.updateRarityFilterButtonLabel === 'function') global.updateRarityFilterButtonLabel('msyUnit');
    if (typeof global.updateSourceFilterButtonLabel === 'function') global.updateSourceFilterButtonLabel('msyUnit');
    if (typeof global.updateSeriesFilterButtonLabel === 'function') global.updateSeriesFilterButtonLabel('msyUnit');
    var clr = document.getElementById('msyUnitBrowseFiltersClearBtn');
    if (clr && typeof global.t === 'function') clr.title = t('filter_clear_all');
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
    el.innerHTML =
      '<span class="msy-status-chip">' + esc(t('msy_status_units').replace('{n}', fmtN(state.total))) + '</span>' +
      '<span class="msy-status-chip">' + esc(t('msy_status_metric').replace('{m}', t(mode.metricKey))) + '</span>' +
      '<span class="msy-status-chip">' + esc(t('msy_status_vigor').replace('{v}', t('dc_vigor_super'))) + '</span>' +
      (note ? '<span class="msy-status-note">' + esc(note) + '</span>' : '');
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
        '<div class="msy-pilot-thumb">' + pilotThumb(c) + '</div>' +
        '<div class="msy-pilot-body">' +
          '<div class="msy-pilot-name-row">' +
            roleIconHtml(c) +
            '<span class="msy-pilot-name" title="' + escAttr(c.name || '') + '">' + esc(c.name) + '</span>' +
          '</div>' +
          sub +
        '</div>' +
        '<div class="msy-pilot-dmg">' + fmtN(dmg) + '</div>' +
        '<div class="msy-pilot-actions">' +
          '<button type="button" class="msy-act-btn" title="' + escAttr(t('msy_open_sim')) + '" onclick="GgenMetaSynergy.openInSimulator(\'' + escJs(unitId) + '\',\'' + escJs(c.id) + '\')">↗</button>' +
          '<button type="button" class="msy-act-btn" title="' + escAttr(t('msy_open_char')) + '" onclick="GgenMetaSynergy.openDetailChar(\'' + escJs(c.id) + '\')">P</button>' +
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
      var rank = (startRank || 0) + gi + 1;
      var u = g.unit || {};
      html += '<article class="msy-unit-card">';
      html += '<header class="msy-unit-head">';
      html += '<span class="msy-unit-rank">' + rank + '</span>';
      html += '<div class="msy-unit-thumb">' + unitThumb(u) + '</div>';
      html += '<div class="msy-unit-main">';
      html += '<div class="msy-unit-name-row">';
      html += roleIconHtml(u);
      html += '<span class="msy-unit-name">' + esc(u.name) + '</span>';
      html += '</div>';
      if (g.weapon_elems) {
        html += '<div class="msy-unit-elem">&lt;' + esc(g.weapon_elems) + '&gt;</div>';
      }
      html += '</div>';
      html += '<div class="msy-unit-peak">';
      html += '<div class="msy-unit-peak-val">' + fmtN(g.max_damage) + '</div>';
      html += '<div class="msy-unit-peak-lbl">' + esc(t(mode.metricKey)) + '</div>';
      html += '</div>';
      html += '</header>';
      html += renderPilotGrid(g.pilots, u.id, mode);
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

  async function loadRankings(force) {
    var key = cacheKeyForState();
    if (!force && state.cacheKey === key && state.groups.length) {
      renderContent();
      return;
    }
    setLoading(true, false);
    var warming = false;
    try {
      while (true) {
        var r = await fetch(buildApiUrl(), { credentials: 'same-origin' });
        if (r.status === 202) {
          var warmData = await r.json();
          warming = true;
          setLoading(true, true);
          await sleep(Math.max(1000, (warmData.retry_after || 3) * 1000));
          continue;
        }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var d = await r.json();
        state.groups = d.groups || [];
        state.total = d.total || 0;
        state.totalPages = d.total_pages || 1;
        state.page = d.page || state.page;
        state.settings = d.settings || null;
        state.cacheKey = key;
        renderContent();
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

  function scheduleReload() {
    clearTimeout(state._reloadTimer);
    state._reloadTimer = setTimeout(function () {
      state.cacheKey = null;
      state.page = 1;
      loadRankings(true);
    }, 320);
  }

  function setRankMode(modeId) {
    if (!rankModeDef(modeId)) return;
    state.rankMode = modeId;
    state.page = 1;
    state.cacheKey = null;
    renderRankModes();
    loadRankings(true);
  }

  function onTabShown() {
    applyLangStatic();
    initFilterLabels();
    loadRankings(false);
  }

  function goPage(p) {
    state.page = Math.max(1, p | 0);
    state.cacheKey = null;
    loadRankings(true);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
  }

  function openDetailUnit(id) {
    if (typeof global.openDetail === 'function') global.openDetail('unit', id);
  }

  function openDetailChar(id) {
    if (typeof global.openDetail === 'function') global.openDetail('character', id);
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
      if (typeof global.setDcMp === 'function') global.setDcMp(state.vigor || 'super');
      if (global.S.dc.atkCharData && global.S.dc.atkCharData.ex_supercharged_tiers &&
          global.S.dc.atkCharData.ex_supercharged_tiers.length > 1 && global.S.dc.charCondPassive) {
        global.S.dc.dcSuperchargedExTier = global.S.dc.atkCharData.ex_supercharged_tiers.length - 1;
      }
      if (typeof global.renderDcAtkUnit === 'function') global.renderDcAtkUnit();
      if (typeof global.renderDcAtkChar === 'function') global.renderDcAtkChar();
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
        scheduleReload();
      });
    }
    var defSel = document.getElementById('msyDefTierSelect');
    if (defSel) {
      defSel.addEventListener('change', function () {
        state.defTier = Math.max(1, Math.min(3, parseInt(defSel.value, 10) || 3));
        state.cacheKey = null;
        state.page = 1;
        loadRankings(true);
      });
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
    scheduleReload: scheduleReload
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
