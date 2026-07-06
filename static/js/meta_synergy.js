(function (global) {
  'use strict';

  var RANK_MODES = [
    { id: 'super_crit', labelKey: 'msy_rank_super_crit', metricKey: 'msy_metric_super_crit', dmgField: 'super_crit_dmg', icon: '/static/images/UI/UI_Tention_Up_03.webp' },
    { id: 'crit', labelKey: 'msy_rank_crit', metricKey: 'msy_metric_crit', dmgField: 'crit_dmg', icon: '/static/images/UI/UI_Tention_Up_01.webp' },
    { id: 'normal', labelKey: 'msy_rank_normal', metricKey: 'msy_metric_normal', dmgField: 'normal_dmg', icon: '/static/images/UI/UI_Tention_Up_02.webp' }
  ];

  var state = {
    loading: false,
    allGroups: [],
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

  function buildApiUrl(full) {
    var lang = (global.S && global.S.lang) || 'EN';
    var fq = buildFilterQuery();
    var q = [
      'lang=' + encodeURIComponent(lang),
      'vigor=' + encodeURIComponent(state.vigor),
      'def_tier=' + encodeURIComponent(String(state.defTier)),
      'lb_tier=3',
      'top_pilots=' + encodeURIComponent(String(state.topPilots)),
      'unit_q=' + encodeURIComponent(state.unitQ || ''),
      'page=1',
      'per_page=10000'
    ];
    if (fq) q.push(fq);
    if (full) q.push('full=1');
    return '/api/meta_synergy_rankings?' + q.join('&');
  }

  function cacheKeyForState() {
    return [
      (global.S && global.S.lang) || 'EN',
      buildFilterQuery(),
      state.vigor,
      state.defTier,
      state.topPilots,
      state.unitQ
    ].join('|');
  }

  function normalizeGroupForMode(g, modeId) {
    var rankings = g.rankings || {};
    var block = rankings[modeId];
    if (block) {
      return {
        unit: g.unit,
        weapon_elems: g.weapon_elems,
        max_damage: block.max_damage,
        pilots: block.pilots || []
      };
    }
    if (modeId === 'super_crit' && g.pilots) {
      return {
        unit: g.unit,
        weapon_elems: g.weapon_elems,
        max_damage: g.max_damage,
        pilots: g.pilots || []
      };
    }
    return null;
  }

  function groupsForMode(groups, modeId) {
    var out = [];
    (groups || []).forEach(function (g) {
      var row = normalizeGroupForMode(g, modeId);
      if (row && row.pilots && row.pilots.length) out.push(row);
    });
    out.sort(function (a, b) {
      var da = (a.max_damage || 0) - (b.max_damage || 0);
      if (da !== 0) return da > 0 ? -1 : 1;
      var na = (a.unit && a.unit.name) || '';
      var nb = (b.unit && b.unit.name) || '';
      return na.localeCompare(nb);
    });
    return out;
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

  function renderStatus(filteredTotal) {
    var mode = rankModeDef(state.rankMode);
    var el = document.getElementById('msyStatus');
    var countEl = document.getElementById('msyToolbarCount');
    if (countEl) {
      countEl.innerHTML = '<span class="result-count-num">' + fmtN(filteredTotal) + '</span> ' + esc(t('count_unit'));
    }
    if (!el) return;
    var note = (state.settings && state.settings.defender_note) || '';
    el.innerHTML =
      '<span class="msy-status-chip">' + esc(t('msy_status_units').replace('{n}', fmtN(filteredTotal))) + '</span>' +
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

  function paginateGroups(groups) {
    var total = groups.length;
    var page = Math.max(1, state.page | 0);
    var perPage = Math.max(1, Math.min(50, state.perPage | 0));
    var start = (page - 1) * perPage;
    return {
      groups: groups.slice(start, start + perPage),
      total: total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      page: page,
      perPage: perPage
    };
  }

  function renderPagination(meta) {
    var host = document.getElementById('msyPagination');
    if (!host) return;
    if (!meta || meta.totalPages <= 1) {
      host.innerHTML = '';
      return;
    }
    if (typeof global.renderPagination === 'function') {
      host.innerHTML = global.renderPagination(meta.page, meta.totalPages, 'GgenMetaSynergy.goPage');
      return;
    }
    host.innerHTML = '<span>' + meta.page + ' / ' + meta.totalPages + '</span>';
  }

  function renderContent() {
    var mode = rankModeDef(state.rankMode);
    var ranked = groupsForMode(state.allGroups, state.rankMode);
    var meta = paginateGroups(ranked);
    renderStatus(meta.total);
    var startRank = (meta.page - 1) * meta.perPage;
    var host = document.getElementById('msyContent');
    var empty = document.getElementById('msyEmpty');
    if (!host) return;
    if (!meta.groups.length) {
      host.innerHTML = '';
      if (empty) empty.style.display = '';
      renderPagination(meta);
      return;
    }
    if (empty) empty.style.display = 'none';
    host.innerHTML = renderGroups(meta.groups, startRank, mode);
    renderPagination(meta);
  }

  function setLoading(on) {
    state.loading = !!on;
    var el = document.getElementById('msyLoading');
    if (el) el.style.display = on ? 'flex' : 'none';
  }

  async function loadRankings(force) {
    var key = cacheKeyForState();
    if (!force && state.cacheKey === key && state.allGroups.length) {
      renderContent();
      return;
    }
    setLoading(true);
    try {
      var r = await fetch(buildApiUrl(true), { credentials: 'same-origin' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var d = await r.json();
      state.allGroups = d.all_groups || d.groups || [];
      state.settings = d.settings || null;
      state.cacheKey = key;
      state.page = 1;
      renderContent();
    } catch (e) {
      var host = document.getElementById('msyContent');
      if (host) {
        host.innerHTML = '<div class="msy-error">' + esc(String(e)) + '</div>';
      }
    } finally {
      setLoading(false);
    }
  }

  function scheduleReload() {
    clearTimeout(state._reloadTimer);
    state._reloadTimer = setTimeout(function () {
      state.cacheKey = null;
      loadRankings(true);
    }, 320);
  }

  function setRankMode(modeId) {
    if (!rankModeDef(modeId)) return;
    state.rankMode = modeId;
    state.page = 1;
    renderRankModes();
    renderContent();
  }

  function onTabShown() {
    applyLangStatic();
    initFilterLabels();
    loadRankings(false);
  }

  function goPage(p) {
    state.page = Math.max(1, p | 0);
    renderContent();
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
