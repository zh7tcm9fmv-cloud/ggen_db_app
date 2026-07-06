(function (global) {
  'use strict';

  var state = {
    loading: false,
    allGroups: [],
    settings: null,
    metric: 'super_crit',
    vigor: 'super',
    unitRarity: 'UR',
    unitRole: '1',
    pilotRarity: 'ALL',
    pilotRoles: ['1', '2', '3'],
    lbTier: 3,
    topPilots: 10,
    unitQ: '',
    view: 'grouped',
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

  function thumbRow(entity, kind, size) {
    if (!entity) return '';
    var row = {
      thum: entity.thum || '',
      rarity: entity.rarity || 'N',
      role_icon: entity.role_icon || '',
      acquisition_icon: entity.acquisition_icon || '',
      is_ultimate: entity.is_ultimate
    };
    if (typeof global.renderListThumb === 'function') {
      return global.renderListThumb(row, kind, size || 44);
    }
    return '';
  }

  function metaIcons(entity) {
    if (!entity) return '';
    var html = '';
    if (entity.rarity_icon) {
      html += '<img class="msy-meta-icon msy-meta-rarity" src="' + escAttr(imgUrl(entity.rarity_icon)) + '" alt="" loading="lazy" decoding="async">';
    }
    if (entity.role_icon) {
      html += '<img class="msy-meta-icon msy-meta-role" src="' + escAttr(imgUrl(entity.role_icon)) + '" alt="" loading="lazy" decoding="async">';
    }
    return html ? '<span class="msy-meta-icons">' + html + '</span>' : '';
  }

  function metricLabel(metric) {
    var map = {
      super_crit: 'msy_metric_super_crit',
      crit: 'msy_metric_crit',
      normal: 'msy_metric_normal',
      expected: 'msy_metric_expected'
    };
    return t(map[metric] || 'msy_metric_super_crit');
  }

  function metricValue(row, metric) {
    if (!row) return 0;
    if (metric === 'crit') return row.crit_dmg || 0;
    if (metric === 'normal') return row.normal_dmg || 0;
    if (metric === 'expected') return row.expected_dmg || 0;
    return row.super_crit_dmg || row.score || 0;
  }

  function paginateGroups(groups) {
    var total = groups.length;
    var page = Math.max(1, state.page | 0);
    var perPage = Math.max(1, Math.min(100, state.perPage | 0));
    var start = (page - 1) * perPage;
    return {
      groups: groups.slice(start, start + perPage),
      total: total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      page: page,
      perPage: perPage
    };
  }

  function buildApiUrl(full) {
    var lang = (global.S && global.S.lang) || 'EN';
    var q = [
      'lang=' + encodeURIComponent(lang),
      'unit_rarity=' + encodeURIComponent(state.unitRarity),
      'unit_role=' + encodeURIComponent(state.unitRole),
      'pilot_rarity=' + encodeURIComponent(state.pilotRarity),
      'pilot_roles=' + encodeURIComponent(state.pilotRoles.join(',')),
      'metric=' + encodeURIComponent(state.metric),
      'vigor=' + encodeURIComponent(state.vigor),
      'lb_tier=' + encodeURIComponent(String(state.lbTier)),
      'top_pilots=' + encodeURIComponent(String(state.topPilots)),
      'unit_q=' + encodeURIComponent(state.unitQ || ''),
      'page=1',
      'per_page=10000'
    ];
    if (full) q.push('full=1');
    return '/api/meta_synergy_rankings?' + q.join('&');
  }

  function cacheKeyForState() {
    return [
      (global.S && global.S.lang) || 'EN',
      state.unitRarity,
      state.unitRole,
      state.pilotRarity,
      state.pilotRoles.join(','),
      state.metric,
      state.vigor,
      state.lbTier,
      state.topPilots,
      state.unitQ
    ].join('|');
  }

  function applyLangStatic() {
    var el = document.getElementById('msyHeroSub');
    if (el) el.textContent = t('msy_hero_sub');
    el = document.getElementById('msySearchInput');
    if (el) el.placeholder = t('msy_search_ph');
    el = document.getElementById('msyViewGroupedBtn');
    if (el) el.textContent = t('msy_view_grouped');
    el = document.getElementById('msyViewTableBtn');
    if (el) el.textContent = t('msy_view_table');
    document.querySelectorAll('[data-msy-metric]').forEach(function (btn) {
      btn.textContent = metricLabel(btn.getAttribute('data-msy-metric'));
    });
    renderMetricPills();
  }

  function renderMetricPills() {
    document.querySelectorAll('.msy-metric-pill').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-msy-metric') === state.metric);
    });
  }

  function renderStatus(filteredTotal) {
    var el = document.getElementById('msyStatus');
    if (!el) return;
    var metric = metricLabel(state.metric);
    var vigorLbl = t('dc_vigor_super');
    if (state.vigor === 'max') vigorLbl = t('dc_vigor_max');
    else if (state.vigor === 'high') vigorLbl = t('dc_vigor_high');
    else if (state.vigor === 'medium') vigorLbl = t('dc_vigor_medium');
    var note = (state.settings && state.settings.defender_note) || '';
    el.innerHTML =
      '<span class="msy-status-chip">' + esc(t('msy_status_units').replace('{n}', fmtN(filteredTotal))) + '</span>' +
      '<span class="msy-status-chip">' + esc(t('msy_status_metric').replace('{m}', metric)) + '</span>' +
      '<span class="msy-status-chip">' + esc(t('msy_status_vigor').replace('{v}', vigorLbl)) + '</span>' +
      (note ? '<span class="msy-status-note">' + esc(note) + '</span>' : '');
  }

  function renderPilotActions(unitId, pilot) {
    var cid = pilot.char && pilot.char.id;
    return (
      '<button type="button" class="msy-act-btn" title="' + escAttr(t('msy_open_sim')) + '" onclick="GgenMetaSynergy.openInSimulator(\'' + escJs(unitId) + '\',\'' + escJs(cid) + '\')">↗</button>' +
      '<button type="button" class="msy-act-btn" title="' + escAttr(t('msy_open_unit')) + '" onclick="GgenMetaSynergy.openDetailUnit(\'' + escJs(unitId) + '\')">U</button>' +
      '<button type="button" class="msy-act-btn" title="' + escAttr(t('msy_open_char')) + '" onclick="GgenMetaSynergy.openDetailChar(\'' + escJs(cid) + '\')">P</button>'
    );
  }

  function renderGrouped(groups, startRank) {
    var metric = state.metric;
    var html = '<div class="msy-groups">';
    groups.forEach(function (g, gi) {
      var rank = (startRank || 0) + gi + 1;
      var u = g.unit || {};
      html += '<article class="msy-unit-card">';
      html += '<header class="msy-unit-head">';
      html += '<span class="msy-unit-rank">' + rank + '</span>';
      html += '<div class="msy-unit-thumb">' + thumbRow(u, 'unit', 48) + '</div>';
      html += '<div class="msy-unit-main">';
      html += '<div class="msy-unit-name-row"><span class="msy-unit-name">' + esc(u.name) + '</span>' + metaIcons(u) + '</div>';
      if (g.weapon_elems) {
        html += '<div class="msy-unit-elem">&lt;' + esc(g.weapon_elems) + '&gt;</div>';
      }
      html += '</div>';
      html += '<div class="msy-unit-peak">';
      html += '<div class="msy-unit-peak-val">' + fmtN(g.max_damage) + '</div>';
      html += '<div class="msy-unit-peak-lbl">' + esc(metricLabel(metric)) + '</div>';
      html += '</div>';
      html += '</header>';
      html += '<div class="msy-pilot-list">';
      (g.pilots || []).forEach(function (p) {
        var c = p.char || {};
        var main = metricValue(p, metric);
        html += '<div class="msy-pilot-row">';
        html += '<span class="msy-pilot-rank">' + (p.rank || '') + '</span>';
        html += '<div class="msy-pilot-thumb">' + thumbRow(c, 'char', 40) + '</div>';
        html += '<div class="msy-pilot-main">';
        html += '<div class="msy-pilot-name-row"><span class="msy-pilot-name">' + esc(c.name) + '</span>' + metaIcons(c) + '</div>';
        if (p.crit_rate) {
          html += '<div class="msy-pilot-sub">' + esc(t('msy_crit_rate')).replace('{n}', String(p.crit_rate)) + '</div>';
        }
        html += '</div>';
        html += '<div class="msy-pilot-mini">';
        html += '<span title="' + escAttr(t('msy_metric_expected')) + '">' + esc(t('msy_abbr_exp')) + ' ' + fmtN(p.expected_dmg) + '</span>';
        html += '<span title="' + escAttr(t('msy_metric_crit')) + '">' + esc(t('msy_abbr_crit')) + ' ' + fmtN(p.crit_dmg) + '</span>';
        html += '</div>';
        html += '<div class="msy-pilot-score">' + fmtN(main) + '</div>';
        html += '<div class="msy-pilot-actions">' + renderPilotActions(u.id, p) + '</div>';
        html += '</div>';
      });
      html += '</div></article>';
    });
    html += '</div>';
    return html;
  }

  function renderTable(groups, startRank) {
    var metric = state.metric;
    var html = '<div class="msy-table-wrap"><table class="msy-table"><thead><tr>';
    html += '<th>#</th><th>' + esc(t('tab_unit')) + '</th><th>' + esc(t('tab_char')) + '</th>';
    html += '<th>' + esc(metricLabel(metric)) + '</th>';
    html += '<th>' + esc(t('msy_metric_expected')) + '</th>';
    html += '<th>' + esc(t('msy_metric_crit')) + '</th>';
    html += '<th>' + esc(t('msy_metric_normal')) + '</th>';
    html += '<th></th></tr></thead><tbody>';
    var rowNum = startRank || 0;
    groups.forEach(function (g) {
      (g.pilots || []).forEach(function (p) {
        rowNum++;
        var u = g.unit || {};
        var c = p.char || {};
        html += '<tr>';
        html += '<td>' + rowNum + '</td>';
        html += '<td><div class="msy-td-entity">' + thumbRow(u, 'unit', 32) + '<span>' + esc(u.name) + '</span>' + metaIcons(u) + '</div></td>';
        html += '<td><div class="msy-td-entity">' + thumbRow(c, 'char', 32) + '<span>' + esc(c.name) + '</span>' + metaIcons(c) + '</div></td>';
        html += '<td class="msy-td-dmg">' + fmtN(metricValue(p, metric)) + '</td>';
        html += '<td>' + fmtN(p.expected_dmg) + '</td>';
        html += '<td>' + fmtN(p.crit_dmg) + '</td>';
        html += '<td>' + fmtN(p.normal_dmg) + '</td>';
        html += '<td>' + renderPilotActions(u.id, p) + '</td>';
        html += '</tr>';
      });
    });
    html += '</tbody></table></div>';
    return html;
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
    var meta = paginateGroups(state.allGroups);
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
    host.innerHTML = state.view === 'table'
      ? renderTable(meta.groups, startRank)
      : renderGrouped(meta.groups, startRank);
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

  function debouncedReload() {
    clearTimeout(state._reloadTimer);
    state._reloadTimer = setTimeout(function () {
      state.cacheKey = null;
      loadRankings(true);
    }, 320);
  }

  function onTabShown() {
    applyLangStatic();
    loadRankings(false);
  }

  function setMetric(metric) {
    state.metric = metric;
    renderMetricPills();
    renderContent();
  }

  function setVigor(vigor) {
    state.vigor = vigor;
    state.cacheKey = null;
    loadRankings(true);
  }

  function setView(view) {
    state.view = view;
    var g = document.getElementById('msyViewGroupedBtn');
    var tb = document.getElementById('msyViewTableBtn');
    if (g) g.classList.toggle('active', view === 'grouped');
    if (tb) tb.classList.toggle('active', view === 'table');
    renderContent();
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
        debouncedReload();
      });
    }
    document.querySelectorAll('[data-msy-filter]').forEach(function (el) {
      el.addEventListener('change', function () {
        var key = el.getAttribute('data-msy-filter');
        if (key === 'unit_rarity') state.unitRarity = el.value;
        else if (key === 'unit_role') state.unitRole = el.value;
        else if (key === 'pilot_rarity') state.pilotRarity = el.value;
        else if (key === 'pilot_role') {
          var roles = [];
          document.querySelectorAll('[data-msy-pilot-role]:checked').forEach(function (cb) {
            roles.push(cb.value);
          });
          state.pilotRoles = roles.length ? roles : ['1', '2', '3'];
        } else if (key === 'vigor') setVigor(el.value);
        state.cacheKey = null;
        loadRankings(true);
      });
    });
    document.querySelectorAll('.msy-metric-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setMetric(btn.getAttribute('data-msy-metric'));
      });
    });
  }

  function init() {
    bindControls();
    applyLangStatic();
  }

  global.GgenMetaSynergy = {
    init: init,
    onTabShown: onTabShown,
    applyLangStatic: applyLangStatic,
    setMetric: setMetric,
    setView: setView,
    goPage: goPage,
    openDetailUnit: openDetailUnit,
    openDetailChar: openDetailChar,
    openInSimulator: openInSimulator,
    loadRankings: loadRankings
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
