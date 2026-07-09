(function (global) {
  'use strict';

  var SHINN_EX_CHAR_ID = '1330000103';
  var shinnPortraitUrl = '';

  var RANK_MODES = ['super_crit', 'crit', 'normal'];
  var RANK_MODE_DMG = {
    super_crit: 'super_crit_dmg',
    crit: 'crit_dmg',
    normal: 'normal_dmg'
  };
  var RANK_MODE_LABEL = {
    super_crit: 'msy_metric_super_crit',
    crit: 'msy_metric_crit',
    normal: 'msy_metric_normal'
  };
  var RANK_MODE_ICON = {
    super_crit: '/static/images/UI/UI_Tention_Up_03.webp',
    crit: '/static/images/UI/UI_Battle_MapUI_Label_Critical.webp',
    normal: '/static/images/UI/UI_Tention_Up_02.webp'
  };
  // Always show Critical label icon on the metric dropdown toggle.
  var METRIC_TOGGLE_ICON = '/static/images/UI/UI_Battle_MapUI_Label_Critical.webp';
  var ATTACK_ROLE_ID = '1';

  var state = {
    open: false,
    unitId: null,
    loading: false,
    loaded: false,
    loadGen: 0,
    excludeUr: false,
    excludeShinn: false,
    sameRole: false,
    rankMode: 'super_crit',
    // unitId -> { modes: { super_crit, crit, normal }, ... }
    cache: {},
    // unitId -> in-flight Promise<entry|null> (shared by prefetch + panel open)
    inflight: {},
    defenderTiers: null,
    defenderTiersPromise: null
  };

  function t(key) {
    return typeof global.t === 'function' ? global.t(key) : key;
  }

  function esc(s) {
    return typeof global.esc === 'function' ? global.esc(s) : String(s || '');
  }

  function escAttr(s) {
    return typeof global.escAttr === 'function' ? global.escAttr(s) : String(s || '');
  }

  function escJs(s) {
    return typeof global.escJs === 'function' ? global.escJs(s) : String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function fmtN(n) {
    return typeof global.fmtN === 'function' ? global.fmtN(n) : String(n);
  }

  function imgUrl(path) {
    return typeof global.imgUrl === 'function' ? global.imgUrl(path) : path;
  }

  function isEligible(d) {
    return !!(d && d.best_synergy_pilot_eligible && !d.detail_npc_context);
  }

  function hasRecPilot(d) {
    if (!d || d.detail_npc_context) return false;
    var rc = d.recommend_character;
    return !!(rc && rc.id);
  }


  function renderTriggerBtn() {
    var icon = imgUrl('/static/images/UI/UI_Common_Tmb_PriorPilot_Icon.webp');
    var title = t('unit_best_pilot_btn') || 'Top 10 Damage Pilot';
    return '<button type="button" class="unit-best-pilot-btn' + (state.open ? ' is-active' : '')
      + '" data-unit-best-pilot-toggle title="' + escAttr(title)
      + '" aria-label="' + escAttr(title) + '" aria-expanded="' + (state.open ? 'true' : 'false') + '">'
      + '<img class="unit-best-pilot-btn-icon" src="' + icon + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
      + '</button>';
  }

  function bindClickDelegation() {
    if (global.document._unitBestPilotBound) return;
    global.document._unitBestPilotBound = 1;
    global.document.addEventListener('click', function (ev) {
      var metricItem = ev.target.closest('#ubpMetricDdMenu [data-ubp-metric]');
      if (metricItem) {
        ev.preventDefault();
        ev.stopPropagation();
        setRankMode(metricItem.getAttribute('data-ubp-metric'));
        return;
      }
      var metricToggle = ev.target.closest('#ubpMetricDdToggle, #ubpMetricCycleBtn');
      if (metricToggle) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleMetricDropdown();
        return;
      }
      // Click outside closes metric dropdown.
      if (!ev.target.closest('#ubpMetricDropdown')) closeMetricDropdown();
      var filterBtn = ev.target.closest('[data-ubp-filter]');
      if (filterBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleFilter(filterBtn.getAttribute('data-ubp-filter'));
        return;
      }
      var btn = ev.target.closest('[data-unit-best-pilot-toggle], .unit-best-pilot-btn');
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      toggle();
    }, true);
  }

  function updateShinnFilterIcon() {
    var shBtn = global.document.getElementById('ubpExcludeShinnBtn');
    if (!shBtn || !shinnPortraitUrl) return;
    var icon = shBtn.querySelector('.msy-exclude-shinn-icon');
    if (!icon) return;
    var imgHtml = typeof global.pictureRasterHtml === 'function'
      ? global.pictureRasterHtml(shinnPortraitUrl, {
          cls: 'msy-exclude-shinn-portrait',
          loading: 'lazy',
          alt: 'Shinn',
          lazy: false
        })
      : '<img class="msy-exclude-shinn-portrait" src="' + escAttr(imgUrl(shinnPortraitUrl))
        + '" alt="Shinn" width="18" height="18" loading="lazy" decoding="async">';
    icon.innerHTML = imgHtml + '<span class="msy-exclude-shinn-x" aria-hidden="true"></span>';
  }

  function ensureShinnFilterIcon() {
    if (shinnPortraitUrl) {
      updateShinnFilterIcon();
      return Promise.resolve(shinnPortraitUrl);
    }
    var lang = (global.S && global.S.lang) || 'EN';
    return fetch('/api/character/' + encodeURIComponent(SHINN_EX_CHAR_ID)
      + '?lang=' + encodeURIComponent(lang) + '&view=ranking', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        shinnPortraitUrl = (d && (d.thum || d.portrait)) || '';
        updateShinnFilterIcon();
        return shinnPortraitUrl;
      })
      .catch(function () { return ''; });
  }

  function unitRoleId() {
    var d = global.S && global.S.currentDetailData;
    if (!d) return null;
    if (d.role_id != null && d.role_id !== '') return String(d.role_id);
    return null;
  }

  function isAttackUnit() {
    return unitRoleId() === ATTACK_ROLE_ID;
  }

  function shinnFilterRelevant() {
    // Shinn is Attack-role; same-role on Defense/Support already excludes him.
    if (state.excludeUr) return false;
    if (state.sameRole && !isAttackUnit()) return false;
    return true;
  }

  function syncFilterButtons() {
    var urBtn = global.document.getElementById('ubpExcludeUrBtn');
    var shBtn = global.document.getElementById('ubpExcludeShinnBtn');
    var roleBtn = global.document.getElementById('ubpSameRoleBtn');
    if (urBtn) {
      urBtn.classList.toggle('is-active', !!state.excludeUr);
      urBtn.classList.toggle('active', !!state.excludeUr);
      urBtn.setAttribute('aria-pressed', state.excludeUr ? 'true' : 'false');
      urBtn.title = state.excludeUr
        ? (t('msy_exclude_ur_on') || 'Showing non-UR pilots only')
        : (t('msy_exclude_ur') || 'Exclude UR pilots');
    }
    if (shBtn) {
      // Defense/Support + same-role already excludes Attack-role Shinn.
      if (state.sameRole && !isAttackUnit()) state.excludeShinn = false;
      var showShinn = shinnFilterRelevant();
      shBtn.style.display = showShinn ? '' : 'none';
      shBtn.setAttribute('aria-hidden', showShinn ? 'false' : 'true');
      if (showShinn) {
        shBtn.classList.toggle('is-active', !!state.excludeShinn);
        shBtn.classList.toggle('active', !!state.excludeShinn);
        shBtn.setAttribute('aria-pressed', state.excludeShinn ? 'true' : 'false');
        shBtn.title = state.excludeShinn
          ? (t('msy_exclude_shinn_on') || 'Hiding Shinn Asuka (EX)')
          : (t('msy_exclude_shinn') || 'Exclude Shinn Asuka (EX)');
        ensureShinnFilterIcon();
      }
    }
    if (roleBtn) {
      roleBtn.classList.toggle('is-active', !!state.sameRole);
      roleBtn.classList.toggle('active', !!state.sameRole);
      roleBtn.setAttribute('aria-pressed', state.sameRole ? 'true' : 'false');
      roleBtn.title = state.sameRole
        ? (t('msy_same_role_on') || 'Showing same-role pilots only')
        : (t('msy_same_role') || 'Same Role Characters Only');
    }
    syncMetricButtons();
  }

  function metricLabel(mode) {
    var labelKey = RANK_MODE_LABEL[mode] || 'msy_metric_super_crit';
    return t(labelKey) || ({
      super_crit: 'Super Critical',
      crit: 'Critical',
      normal: 'Normal'
    })[mode] || mode;
  }

  function fmtDef(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    try {
      return Math.round(v).toLocaleString();
    } catch (_) {
      return String(Math.round(v));
    }
  }

  function panelSubtitleHtml() {
    var ms = 25072;
    var pilot = 705;
    var tiers = state.defenderTiers;
    if (tiers && (tiers['3'] || tiers[3])) {
      var row = tiers['3'] || tiers[3];
      if (row.unit_def != null) ms = row.unit_def;
      if (row.char_def != null) pilot = row.char_def;
    }
    var tpl = t('unit_best_pilot_note')
      || 'Eternal Expert: MS DEF: {ms} Pilot DEF: {pilot}';
    return esc(tpl.replace('{ms}', fmtDef(ms)).replace('{pilot}', fmtDef(pilot)));
  }

  function syncPanelSubtitle() {
    var el = global.document.querySelector('#unitBestPilotPanelWrap .unit-best-pilot-panel-note');
    if (el) el.innerHTML = panelSubtitleHtml();
  }

  async function ensureDefenderTiers() {
    if (state.defenderTiers) {
      syncPanelSubtitle();
      return state.defenderTiers;
    }
    if (state.defenderTiersPromise) return state.defenderTiersPromise;
    var lang = (global.S && global.S.lang) || 'EN';
    state.defenderTiersPromise = (async function () {
      try {
        var res = await fetch('/api/meta_synergy_dc/bootstrap?lang=' + encodeURIComponent(lang)
          + '&lb_tier=3&def_tier=3&rank_mode=super_crit&top_pilots=10&bsp=1', {
          credentials: 'same-origin'
        });
        if (res.ok) {
          var data = await res.json();
          if (data && data.defender_tiers) {
            state.defenderTiers = data.defender_tiers;
            syncPanelSubtitle();
            return state.defenderTiers;
          }
        }
      } catch (_) {}
      state.defenderTiers = {
        '3': { unit_def: 25072, char_def: 705, label: 'Eternal Expert' }
      };
      syncPanelSubtitle();
      return state.defenderTiers;
    })();
    return state.defenderTiersPromise;
  }

  function closeMetricDropdown() {
    var dd = global.document.getElementById('ubpMetricDropdown');
    if (dd) dd.classList.remove('is-open');
    var btn = global.document.getElementById('ubpMetricDdToggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleMetricDropdown() {
    var dd = global.document.getElementById('ubpMetricDropdown');
    if (!dd) return;
    var open = !dd.classList.contains('is-open');
    dd.classList.toggle('is-open', open);
    var btn = global.document.getElementById('ubpMetricDdToggle');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function syncMetricButtons() {
    var mode = state.rankMode || 'super_crit';
    var label = metricLabel(mode);
    var btn = global.document.getElementById('ubpMetricDdToggle');
    if (btn) {
      btn.setAttribute('data-ubp-metric', mode);
      btn.setAttribute('aria-label', label);
      btn.title = label;
      var img = btn.querySelector('.ubp-metric-icon');
      if (img) {
        var url = typeof global.imgUrl === 'function' ? global.imgUrl(METRIC_TOGGLE_ICON) : METRIC_TOGGLE_ICON;
        if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      }
      var lab = btn.querySelector('.ubp-metric-label');
      if (lab) lab.textContent = label;
      btn.classList.add('is-active');
      btn.classList.add('active');
    }
    global.document.querySelectorAll('#ubpMetricDdMenu [data-ubp-metric]').forEach(function (el) {
      var on = el.getAttribute('data-ubp-metric') === mode;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      var itemLab = el.querySelector('span');
      if (itemLab) {
        var m = el.getAttribute('data-ubp-metric');
        if (m) itemLab.textContent = metricLabel(m);
      }
    });
  }

  function setRankMode(mode) {
    if (RANK_MODES.indexOf(mode) < 0) return;
    closeMetricDropdown();
    if (state.rankMode === mode) return;
    state.rankMode = mode;
    syncMetricButtons();
    renderActivePanel();
  }

  function toggleFilter(kind) {
    if (kind === 'no_ur') {
      state.excludeUr = !state.excludeUr;
      if (state.excludeUr) state.excludeShinn = true;
    } else if (kind === 'no_shinn') {
      if (!shinnFilterRelevant()) return;
      state.excludeShinn = !state.excludeShinn;
    } else if (kind === 'same_role') {
      state.sameRole = !state.sameRole;
      // Defense/Support same-role already excludes Attack-role Shinn.
      if (state.sameRole && !isAttackUnit()) state.excludeShinn = false;
    } else {
      return;
    }
    syncFilterButtons();
    renderActivePanel();
  }

  function filterPilotsLocal(pilots, noUr, noShinn, sameRole) {
    if (!pilots || !pilots.length) return [];
    if (noUr) noShinn = true;
    var unitRole = sameRole ? unitRoleId() : null;
    if (!noUr && !noShinn && !sameRole) return pilots.slice();
    return pilots.filter(function (p) {
      var ch = (p && p.char) || {};
      var rarity = String(ch.rarity || '');
      var cid = String(ch.id || '');
      if (noUr && rarity === 'UR') return false;
      if (noShinn && cid === SHINN_EX_CHAR_ID) return false;
      if (sameRole && unitRole != null && String(ch.role_id || '') !== unitRole) return false;
      return true;
    });
  }

  function modeEntry(entry) {
    if (!entry) return null;
    var mode = state.rankMode || 'super_crit';
    if (entry.modes && entry.modes[mode]) return entry.modes[mode];
    return entry;
  }

  function pilotsForView(entry) {
    var board = modeEntry(entry);
    if (!board) return { pilots: [], partial: false };
    var noUr = !!state.excludeUr;
    // Same-role on non-Attack already excludes Shinn — don't apply No Shinn on top.
    var noShinn = noUr || (!!state.excludeShinn && shinnFilterRelevant());
    var sameRole = !!state.sameRole;
    var rows = [];
    var partial = false;
    var mode = state.rankMode || 'super_crit';

    function take(list, markPartial) {
      rows = list || [];
      partial = !!markPartial;
    }

    // Prefer dedicated calculator boards. Combined filters start from the richest
    // matching board, then apply the remaining constraints (never invent damage).
    if (sameRole && noUr) {
      // Prefer same-role board (deeper store) then strip UR — fills Support/Defense lists.
      if (board.pilots_same_role && board.pilots_same_role.length) {
        take(filterPilotsLocal(board.pilots_same_role, true, true, false), !!board.same_role_partial);
      } else if (board.pilots_no_ur && board.pilots_no_ur.length) {
        take(filterPilotsLocal(board.pilots_no_ur, false, false, true), !!board.no_ur_partial);
      } else {
        take(filterPilotsLocal(board.pilots || [], true, true, true), true);
      }
      // If intersection is still thin, try the other dedicated board as a second pass.
      if (rows.length < 10 && board.pilots_no_ur && board.pilots_no_ur.length) {
        var alt = filterPilotsLocal(board.pilots_no_ur, false, false, true);
        if (alt.length > rows.length) take(alt, !!board.no_ur_partial);
      }
    } else if (sameRole && noShinn) {
      // Attack + same-role + No Shinn: filter Shinn out of the same-role board.
      if (board.pilots_same_role && board.pilots_same_role.length) {
        take(filterPilotsLocal(board.pilots_same_role, false, true, false), !!board.same_role_partial);
      } else if (board.pilots_no_shinn && board.pilots_no_shinn.length) {
        take(filterPilotsLocal(board.pilots_no_shinn, false, false, true), !!board.no_shinn_partial);
      } else {
        take(filterPilotsLocal(board.pilots || [], false, true, true), true);
      }
    } else if (sameRole) {
      if (board.pilots_same_role && board.pilots_same_role.length) {
        take(board.pilots_same_role, !!board.same_role_partial && board.pilots_same_role.length < 10);
      } else {
        take(filterPilotsLocal(board.pilots || [], false, false, true), true);
      }
    } else if (noUr) {
      if (board.pilots_no_ur && board.pilots_no_ur.length) {
        take(board.pilots_no_ur, !!board.no_ur_partial && board.pilots_no_ur.length < 10);
      } else {
        take(filterPilotsLocal(board.pilots || [], true, true, false), true);
      }
    } else if (noShinn) {
      if (board.pilots_no_shinn && board.pilots_no_shinn.length) {
        take(board.pilots_no_shinn, !!board.no_shinn_partial && board.pilots_no_shinn.length < 10);
      } else {
        take(filterPilotsLocal(board.pilots || [], false, true, false), true);
      }
    } else {
      rows = board.pilots || [];
    }
    return {
      pilots: sortPilotsByCalcDamage(rows, mode).slice(0, 10),
      partial: partial && rows.length < 10
    };
  }

  function forEachBoard(entry, fn) {
    if (!entry || typeof fn !== 'function') return;
    fn(entry);
    if (entry.modes) {
      RANK_MODES.forEach(function (mode) {
        var board = entry.modes[mode];
        if (board && board !== entry) fn(board);
      });
    }
  }

  function applyAffinityToEntry(entry, affinityMap, unitId) {
    if (!entry || !affinityMap) return;
    var uid = String(unitId || state.unitId || '');
    function enrich(list) {
      (list || []).forEach(function (p) {
        var cid = String(((p && p.char) || {}).id || '');
        if (!cid) return;
        var key = uid + ':' + cid;
        if (Object.prototype.hasOwnProperty.call(affinityMap, key)) {
          p.affinity_matches = affinityMap[key] || [];
        }
      });
    }
    forEachBoard(entry, function (board) {
      enrich(board.pilots);
      enrich(board.pilots_no_ur);
      enrich(board.pilots_no_shinn);
      enrich(board.pilots_same_role);
    });
  }

  async function enrichAffinityMatches(entry, unitId, lang) {
    if (!entry) return entry;
    var seen = {};
    var charIds = [];
    var pairs = [];
    function collect(list) {
      (list || []).forEach(function (p) {
        var cid = String(((p && p.char) || {}).id || '');
        if (!cid || seen[cid]) return;
        seen[cid] = 1;
        charIds.push(cid);
        pairs.push(String(unitId) + ':' + cid);
      });
    }
    forEachBoard(entry, function (board) {
      collect(board.pilots);
      collect(board.pilots_no_ur);
      collect(board.pilots_no_shinn);
      collect(board.pilots_same_role);
    });
    if (!charIds.length) return entry;
    try {
      var q = 'lang=' + encodeURIComponent(lang || 'EN')
        + '&char_ids=' + encodeURIComponent(charIds.join(','))
        + '&pairs=' + encodeURIComponent(pairs.join(','));
      var res = await fetch('/api/meta_synergy_pilot_skills?' + q, { credentials: 'same-origin' });
      if (!res.ok) return entry;
      var data = await res.json();
      applyAffinityToEntry(entry, data.affinity_by_pair || {}, unitId);
      var skills = data.skills_by_char || {};
      function attachSkills(list) {
        (list || []).forEach(function (p) {
          var cid = String(((p && p.char) || {}).id || '');
          if (cid && skills[cid] && !p.active_skills) p.active_skills = skills[cid];
        });
      }
      forEachBoard(entry, function (board) {
        attachSkills(board.pilots);
        attachSkills(board.pilots_no_ur);
        attachSkills(board.pilots_no_shinn);
        attachSkills(board.pilots_same_role);
      });
    } catch (_) {}
    return entry;
  }

  function renderActivePanel() {
    if (!state.open || !state.unitId) return;
    var entry = state.cache[String(state.unitId)];
    if (!entry) return;
    var view = pilotsForView(entry);
    var pilots = view.pilots || [];
    if (!pilots.length) {
      setPanelHtml('<div class="unit-best-pilot-empty">'
        + esc(t('msy_no_eligible_pilots') || 'No eligible pilots for this filter.')
        + '</div>');
      return;
    }
    var note = '';
    if (view.partial) {
      note = '<div class="unit-best-pilot-filter-note">'
        + esc(t('unit_best_pilot_filter_partial')
          || 'Showing calculator pilots that match this filter from the main top 10. A full non-UR / No-Shinn top 10 needs a dedicated calculator rebuild.')
        + '</div>';
    }
    setPanelHtml(note + renderPilotGrid(pilots, state.unitId));
  }

  function hideTriggers() {
    global.document.querySelectorAll('.unit-best-pilot-btn-slot').forEach(function (slot) {
      slot.innerHTML = '';
    });
  }

  function syncTriggerActive() {
    global.document.querySelectorAll('.unit-best-pilot-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', !!state.open);
      btn.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    });
  }

  function renderSkeletonGrid() {
    var cards = [];
    for (var i = 0; i < 6; i++) {
      cards.push(
        '<div class="msy-pilot-card msy-pilot-card--skeleton" aria-hidden="true">'
        + '<span class="msy-pilot-rank msy-skel-bar"></span>'
        + '<div class="msy-pilot-skel-body">'
        + '<div class="msy-pilot-skel-thumb"></div>'
        + '<div class="msy-pilot-skel-lines">'
        + '<div class="msy-skel-line"></div><div class="msy-skel-line msy-skel-line--short"></div>'
        + '</div></div>'
        + '<div class="msy-skel-dmg"></div>'
        + '</div>'
      );
    }
    var mid = Math.ceil(cards.length / 2);
    return '<div class="msy-pilot-grid msy-pilot-grid--loading" aria-busy="true">'
      + '<div class="msy-pilot-col">' + cards.slice(0, mid).join('') + '</div>'
      + '<div class="msy-pilot-col">' + cards.slice(mid).join('') + '</div>'
      + '</div>';
  }

  function apiQuery() {
    var lang = (global.S && global.S.lang) || 'EN';
    return 'lang=' + encodeURIComponent(lang)
      + '&lb_tier=3&def_tier=3&rank_mode=' + encodeURIComponent(state.rankMode || 'super_crit')
      + '&top_pilots=10&bsp=1&all_modes=1';
  }

  function pilotThumb(c) {
    if (!c) return '';
    var row = {
      thum: c.thum || c.portrait || '',
      rarity: c.rarity || 'N'
    };
    var inner = typeof global.renderTagModalThumb === 'function'
      ? global.renderTagModalThumb(row, 'char')
      : (typeof global.renderListThumb === 'function'
        ? global.renderListThumb(row, 'char', 64, { pickerThumb: true }) : '');
    var rarity = String(c.rarity || '');
    var spBadge = '';
    // Non-UR pilots are ranked on SP stats — badge so users know.
    if (rarity && rarity !== 'UR') {
      var spIcon = imgUrl('/static/images/UI/UI_Common_Icon_Sp.webp');
      spBadge = '<span class="msy-pilot-sp-badge" title="'
        + escAttr(t('unit_best_pilot_sp_stats') || 'Ranked with SP stats')
        + '" aria-label="'
        + escAttr(t('unit_best_pilot_sp_stats') || 'Ranked with SP stats')
        + '"><img src="' + escAttr(spIcon) + '" alt="SP" loading="lazy" decoding="async" onerror="this.parentNode.style.display=\'none\'"></span>';
    }
    return '<div class="tag-unit-icon-wrapper msy-pilot-thumb-wrap">' + inner + spBadge + '</div>';
  }

  function pilotActiveSkillIconsHtml(pilot) {
    var skills = (pilot && pilot.active_skills) || [];
    var active = skills.filter(function (sk) { return sk && sk.active; });
    if (!active.length) return '';
    var html = '<div class="msy-pilot-skills msy-pilot-skills--dmg" title="'
      + escAttr(t('unit_best_pilot_active_skills') || 'Active skills used in ranking')
      + '">';
    active.forEach(function (sk) {
      html += '<span class="msy-pilot-skill msy-pilot-skill--active" title="' + escAttr(sk.name || '') + '">';
      if (sk.icon) {
        html += '<img class="msy-pilot-skill-ic" src="' + escAttr(imgUrl(sk.icon)) + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">';
      } else {
        html += '<span class="msy-pilot-skill-fallback">' + esc((sk.name || '?').charAt(0)) + '</span>';
      }
      html += '</span>';
    });
    html += '</div>';
    return html;
  }

  function roleIconHtml(c) {
    if (!c || !c.role_icon) return '';
    return '<img src="' + escAttr(imgUrl(c.role_icon)) + '" alt="" style="width:14px;height:14px;flex-shrink:0" loading="lazy" onerror="this.style.display=\'none\'">';
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

  function pilotFormulaStatHtml(pilot) {
    if (!pilot) return '';
    var parts = '';
    if (pilot.char_atk != null) {
      var statKey = { Ranged: 'stat_ranged', Melee: 'stat_melee', Awaken: 'stat_awaken' };
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
      parts += '<div class="msy-pilot-formula-stat">' + esc(line) + '</div>';
    }
    if (pilot.dmg_dealt_pct != null && pilot.dmg_dealt_pct !== '') {
      var passive = pilot.dmg_dealt_pct | 0;
      var dmgLine = 'Damage Dealt: ' + passive + '%';
      var title = 'Damage Dealt Up % from DC formula';
      if (pilot.pair_ok) title += ' (includes affinity match)';
      parts += '<div class="msy-pilot-dmg-dealt-pct" title="' + escAttr(title) + '">'
        + esc(dmgLine) + '</div>';
    }
    if (pilot.pair_ok) {
      parts += '<div class="msy-pilot-affinity-flag">'
        + esc(t('msy_affinity_match') || 'Affinity match') + '</div>';
    }
    return parts;
  }

  function pilotDamage(pilot, modeOverride) {
    if (!pilot) return 0;
    var mode = modeOverride || state.rankMode || 'super_crit';
    var field = RANK_MODE_DMG[mode] || 'super_crit_dmg';
    var cr = pilot.crit_rate | 0;
    var gc = !!(pilot.guaranteed_crit || cr >= 100);
    var canCrit = gc || cr > 0;
    if ((mode === 'super_crit' || mode === 'crit') && !canCrit) {
      return pilot.normal_dmg || pilot.score || 0;
    }
    return pilot[field] || pilot.peak_dmg || pilot.score || pilot.max_damage || 0;
  }

  function sortPilotsByCalcDamage(pilots, modeOverride) {
    if (!pilots || !pilots.length) return pilots || [];
    var mode = modeOverride || state.rankMode || 'super_crit';
    return pilots.slice().sort(function (a, b) {
      return pilotDamage(b, mode) - pilotDamage(a, mode);
    }).map(function (p, i) {
      var row = Object.assign({}, p);
      row.rank = i + 1;
      return row;
    });
  }

  function renderPilotCard(unitId, pilot) {
    var c = pilot.char || {};
    var dmg = pilotDamage(pilot);
    var sub = '';
    var critPct = pilot.crit_rate | 0;
    var isGc = !!(pilot.guaranteed_crit || critPct >= 100);
    var crTpl = t('msy_crit_rate') || '{n}% crit';
    if (isGc) {
      sub += '<div class="msy-pilot-sub msy-pilot-sub--gc">' + esc(t('msy_guaranteed_crit') || 'Guaranteed Crit') + '</div>';
      sub += '<div class="msy-pilot-sub">' + esc(crTpl.replace('{n}', '100')) + '</div>';
    } else {
      // Always show crit % (including 0) so non-Shinn rates are visible.
      sub += '<div class="msy-pilot-sub">' + esc(crTpl.replace('{n}', String(critPct))) + '</div>';
    }
    return '<div class="msy-pilot-card">'
      + '<span class="msy-pilot-rank">' + esc(String(pilot.rank || '')) + '</span>'
      + '<button type="button" class="msy-pilot-open" title="' + escAttr(t('msy_open_char') || 'Open pilot') + '" onclick="openDetail(\'character\',\'' + escJs(String(c.id)) + '\')">'
      + '<div class="msy-pilot-thumb">' + pilotThumb(c) + '</div>'
      + '<div class="msy-pilot-body">'
      + '<div class="msy-pilot-name-row">' + roleIconHtml(c)
      + '<span class="msy-pilot-name" title="' + escAttr(c.name || '') + '">' + esc(c.name || '') + '</span>'
      + '</div>'
      + sub
      + pilotAffinityHtml(pilot)
      + '</div></button>'
      + '<div class="msy-pilot-dmg-col"><div class="msy-pilot-dmg">' + fmtN(dmg) + '</div>'
      + pilotFormulaStatHtml(pilot)
      + pilotActiveSkillIconsHtml(pilot)
      + '</div></div>';
  }

  function renderPilotGrid(pilots, unitId) {
    if (!pilots || !pilots.length) {
      return '<div class="unit-best-pilot-empty">' + esc(t('unit_best_pilot_empty') || 'No eligible pilots found.') + '</div>';
    }
    var mid = Math.ceil(pilots.length / 2);
    var left = pilots.slice(0, mid).map(function (p) { return renderPilotCard(unitId, p); }).join('');
    var right = pilots.slice(mid).map(function (p) { return renderPilotCard(unitId, p); }).join('');
    return '<div class="msy-pilot-grid">'
      + '<div class="msy-pilot-col">' + left + '</div>'
      + '<div class="msy-pilot-col">' + right + '</div>'
      + '</div>';
  }

  function setPanelHtml(html) {
    var panel = global.document.getElementById('unitBestPilotPanel');
    if (panel) panel.innerHTML = html;
  }

  function showLoading() {
    setPanelHtml('<div class="unit-best-pilot-loading"><div class="spinner" style="width:18px;height:18px;border-width:2px"></div>'
      + esc(t('unit_best_pilot_loading') || 'Loading top 10 damage pilots…') + '</div>'
      + renderSkeletonGrid());
  }

  function scriptVersion() {
    var el = global.document.querySelector('script[src*="unit_best_pilots.js"]');
    if (!el || !el.src) return '';
    var m = el.src.match(/[?&]v=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }

  function loadScriptOnce(src) {
    return new Promise(function (resolve, reject) {
      var base = src.split('?')[0];
      var existing = global.document.querySelector('script[src="' + src + '"]')
        || global.document.querySelector('script[src^="' + base + '"]');
      if (existing) {
        resolve();
        return;
      }
      var s = global.document.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('script load failed: ' + src)); };
      global.document.head.appendChild(s);
    });
  }

  var dcEnginePromise = null;
  function ensureDcEngine() {
    if (global.MsyDcEngine) {
      return global.MsyDcEngine.ensureReady().then(function () { return global.MsyDcEngine; });
    }
    if (!dcEnginePromise) {
      var ver = scriptVersion();
      var src = '/static/js/msy_dc_engine.js' + (ver ? '?v=' + encodeURIComponent(ver) : '');
      dcEnginePromise = loadScriptOnce(src).then(function () {
        if (!global.MsyDcEngine) throw new Error('MsyDcEngine not loaded');
        return global.MsyDcEngine.ensureReady().then(function () { return global.MsyDcEngine; });
      });
    }
    return dcEnginePromise;
  }

  function boardFromPayload(payload, modeHint) {
    if (!payload || !payload.pilots || !payload.pilots.length || payload.pending) return null;
    var mode = modeHint || payload.rank_mode || 'super_crit';
    return {
      pilots: sortPilotsByCalcDamage(payload.pilots, mode),
      pilots_no_ur: sortPilotsByCalcDamage(payload.pilots_no_ur || [], mode),
      pilots_no_shinn: sortPilotsByCalcDamage(payload.pilots_no_shinn || [], mode),
      pilots_same_role: sortPilotsByCalcDamage(payload.pilots_same_role || [], mode),
      no_ur_partial: !!payload.no_ur_partial,
      no_shinn_partial: !!payload.no_shinn_partial,
      same_role_partial: !!payload.same_role_partial,
      source: payload.source || 'published_dc',
      rank_mode: mode
    };
  }

  function entryFromPayload(payload) {
    var primary = boardFromPayload(payload, payload.rank_mode || 'super_crit');
    if (!primary) return null;
    var modes = {};
    if (payload.modes && typeof payload.modes === 'object') {
      RANK_MODES.forEach(function (mode) {
        var board = boardFromPayload(payload.modes[mode], mode);
        if (board) modes[mode] = board;
      });
    }
    if (!modes.super_crit) modes.super_crit = primary;
    return {
      pilots: primary.pilots,
      pilots_no_ur: primary.pilots_no_ur,
      pilots_no_shinn: primary.pilots_no_shinn,
      pilots_same_role: primary.pilots_same_role,
      no_ur_partial: primary.no_ur_partial,
      no_shinn_partial: primary.no_shinn_partial,
      same_role_partial: primary.same_role_partial,
      source: primary.source,
      modes: modes
    };
  }

  function entryFromUnitDetail(d) {
    if (!d || !d.best_synergy_pilots) return null;
    return entryFromPayload(d.best_synergy_pilots);
  }

  async function fetchPublishedPilots(unitId, lang) {
    var q = 'lang=' + encodeURIComponent(lang)
      + '&lb_tier=3&def_tier=3&rank_mode=' + encodeURIComponent(state.rankMode || 'super_crit')
      + '&top_pilots=10&all_modes=1';
    var res = await fetch('/api/unit/' + encodeURIComponent(unitId) + '/best_synergy_pilots?' + q, {
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var payload = await res.json();
    if (payload.error) throw new Error(payload.detail || payload.error);
    return entryFromPayload(payload);
  }

  async function warmPublishedPilots(unitId, pilots, lang) {
    if (!pilots || !pilots.length) return;
    var q = 'lang=' + encodeURIComponent(lang)
      + '&lb_tier=3&def_tier=3&rank_mode=super_crit&top_pilots=10';
    try {
      await fetch('/api/unit/' + encodeURIComponent(unitId) + '/best_synergy_pilots/warm?' + q, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pilots: pilots })
      });
    } catch (_) {}
  }

  async function loadRankingsViaDc(unitId, lang) {
    var engine = await ensureDcEngine();
    var bootRes = await fetch('/api/meta_synergy_dc/bootstrap?' + apiQuery(), {
      credentials: 'same-origin'
    });
    if (!bootRes.ok) throw new Error('HTTP ' + bootRes.status);
    var bootstrap = await bootRes.json();
    if (bootstrap.error) throw new Error(bootstrap.detail || bootstrap.error);
    var defTiers = bootstrap.defender_tiers || {};
    var candRes = await fetch('/api/meta_synergy_dc/candidates?unit_id=' + encodeURIComponent(unitId) + '&' + apiQuery(), {
      credentials: 'same-origin'
    });
    if (!candRes.ok) throw new Error('HTTP ' + candRes.status);
    var candData = await candRes.json();
    var pilotIds = candData.pilot_ids || [];
    if (!pilotIds.length) return [];
    if (bootstrap.cache_version && engine.ensureCacheVersion) {
      await engine.ensureCacheVersion(bootstrap.cache_version);
    }
    var raw = await engine.evalUnit(unitId, pilotIds, defTiers, {
      lang: lang,
      cpOn: true,
      pepOn: true,
      appJsVersion: bootstrap.cache_version || scriptVersion()
    });
    if (!raw || raw.error || !raw.byTier) throw new Error('eval failed');
    var asmRes = await fetch('/api/meta_synergy_dc/assemble?' + apiQuery(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit_id: unitId,
        pairs_by_tier: raw.byTier,
        lang: lang,
        top_pilots: 10,
        rank_mode: 'super_crit',
        def_tier: 3,
        cp_on: true,
        pep_on: true
      })
    });
    if (!asmRes.ok) throw new Error('HTTP ' + asmRes.status);
    var payload = await asmRes.json();
    if (payload.error) throw new Error(payload.detail || payload.error);
    var group = payload.group || {};
    function boardFromMode(mode) {
      var block = ((group.rankings || {})[mode]) || {};
      var pilots = sortPilotsByCalcDamage(block.pilots || (mode === 'super_crit' ? (group.pilots || []) : []), mode);
      if (!pilots.length && mode === 'super_crit') {
        pilots = sortPilotsByCalcDamage(group.pilots || [], mode);
      }
      if (!pilots.length) return null;
      var noUrBlock = ((group.rankings_no_ur || {})[mode]) || {};
      var noShinnBlock = ((group.rankings_no_shinn || {})[mode]) || {};
      var sameRoleBlock = ((group.rankings_same_role || {})[mode]) || {};
      return {
        pilots: pilots,
        pilots_no_ur: sortPilotsByCalcDamage(noUrBlock.pilots || filterPilotsLocal(pilots, true, true), mode),
        pilots_no_shinn: sortPilotsByCalcDamage(noShinnBlock.pilots || filterPilotsLocal(pilots, false, true), mode),
        pilots_same_role: sortPilotsByCalcDamage(sameRoleBlock.pilots || filterPilotsLocal(pilots, false, false, true), mode),
        no_ur_partial: !(noUrBlock.pilots && noUrBlock.pilots.length >= 10),
        no_shinn_partial: !(noShinnBlock.pilots && noShinnBlock.pilots.length >= 10),
        same_role_partial: !(sameRoleBlock.pilots && sameRoleBlock.pilots.length >= 10),
        source: 'client_dc',
        rank_mode: mode
      };
    }
    var modes = {};
    RANK_MODES.forEach(function (mode) {
      var board = boardFromMode(mode);
      if (board) modes[mode] = board;
    });
    var primary = modes.super_crit || modes[state.rankMode] || null;
    if (!primary) return null;
    if (!modes.super_crit) modes.super_crit = primary;
    return {
      pilots: primary.pilots,
      pilots_no_ur: primary.pilots_no_ur,
      pilots_no_shinn: primary.pilots_no_shinn,
      pilots_same_role: primary.pilots_same_role,
      no_ur_partial: primary.no_ur_partial,
      no_shinn_partial: primary.no_shinn_partial,
      same_role_partial: primary.same_role_partial,
      source: 'client_dc',
      modes: modes
    };
  }

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error(label || 'timeout'));
      }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  function commitEntry(unitId, entry, gen) {
    if (gen !== state.loadGen) return;
    if (!entry || !entry.pilots || !entry.pilots.length) {
      state.loaded = true;
      setPanelHtml('<div class="unit-best-pilot-empty">' + esc(t('unit_best_pilot_empty') || 'No eligible pilots found.') + '</div>');
      return;
    }
    state.cache[String(unitId)] = entry;
    state.loaded = true;
    state.loading = false;
    syncFilterButtons();
    renderActivePanel();
    if (state.open) scheduleScrollToPanel();
    // Affinity details are secondary — never block the top-10 paint.
    var lang = (global.S && global.S.lang) || 'EN';
    void enrichAffinityMatches(entry, unitId, lang).then(function () {
      if (gen !== state.loadGen) return;
      if (state.open && String(state.unitId) === String(unitId)) renderActivePanel();
    });
  }

  async function loadRankings(unitId) {
    var gen = ++state.loadGen;
    state.loading = true;
    var uid = String(unitId);
    if (state.cache[uid] && state.cache[uid].pilots && state.cache[uid].pilots.length) {
      commitEntry(unitId, state.cache[uid], gen);
      return;
    }
    showLoading();
    try {
      var lang = (global.S && global.S.lang) || 'EN';
      var entry = null;
      // Reuse background prefetch if already in flight.
      if (state.inflight[uid]) {
        entry = await state.inflight[uid];
      } else {
        entry = await fetchPublishedPilots(unitId, lang);
      }
      if (gen !== state.loadGen) return;
      if (!entry) {
        // Only fall back to live /cal when published cache truly has no row.
        entry = await withTimeout(
          loadRankingsViaDc(unitId, lang),
          120000,
          'dc_timeout'
        );
        if (gen !== state.loadGen) return;
        if (entry && entry.pilots && entry.pilots.length) {
          warmPublishedPilots(unitId, entry.pilots, lang);
        }
      }
      commitEntry(unitId, entry, gen);
    } catch (err) {
      if (gen !== state.loadGen) return;
      var msg = (err && err.message === 'dc_timeout')
        ? (t('unit_best_pilot_pending') || 'Rankings not cached yet — try again shortly.')
        : (t('unit_best_pilot_error') || 'Could not load rankings.');
      setPanelHtml('<div class="unit-best-pilot-empty">' + esc(msg) + '</div>');
      console.error('GgenUnitBestPilots', err);
    } finally {
      if (gen === state.loadGen) state.loading = false;
    }
  }

  function syncUi(d) {
    if (!isEligible(d)) {
      hideTriggers();
      return;
    }
    if (String(d.id) !== state.unitId) onDetailOpen(d);
    syncPanelSubtitle();
    void ensureDefenderTiers();
    var onRec = hasRecPilot(d);
    global.document.querySelectorAll('#unitBestPilotBtnSlotPortrait').forEach(function (slot) {
      slot.innerHTML = onRec ? '' : renderTriggerBtn();
    });
    global.document.querySelectorAll('[data-unit-best-pilot-rec]').forEach(function (slot) {
      slot.innerHTML = onRec ? renderTriggerBtn() : '';
    });
  }

  function canScrollY(node) {
    if (!node || typeof node.scrollTop !== 'number') return false;
    try {
      var style = global.getComputedStyle(node);
      var oy = style && style.overflowY;
      if (!(oy === 'auto' || oy === 'scroll' || oy === 'overlay')) return false;
      return node.scrollHeight > node.clientHeight + 1;
    } catch (_) {
      return false;
    }
  }

  function findScrollParent(el) {
    var node = el && el.parentElement;
    while (node && node !== global.document.body && node !== global.document.documentElement) {
      if (canScrollY(node)) return node;
      node = node.parentElement;
    }
    // Unit detail: #modalContent and/or #detailModal may be the scroller.
    var mc = global.document.getElementById('modalContent');
    if (canScrollY(mc)) return mc;
    var m = global.document.getElementById('detailModal');
    if (canScrollY(m)) return m;
    return mc || m || global.document.scrollingElement || global.document.documentElement;
  }

  function collectScrollTargets(wrap) {
    var seen = [];
    function add(node) {
      if (!node || seen.indexOf(node) >= 0) return;
      if (canScrollY(node) || node === global.document.getElementById('modalContent')
        || node === global.document.getElementById('detailModal')) {
        seen.push(node);
      }
    }
    add(findScrollParent(wrap));
    add(global.document.getElementById('modalContent'));
    add(global.document.getElementById('detailModal'));
    return seen;
  }

  function chromeOffsetPx(scroller) {
    var chrome = global.document.getElementById('modalDetailChrome');
    if (!chrome || !scroller || !scroller.contains(chrome)) return 12;
    try {
      return Math.max(12, Math.ceil(chrome.getBoundingClientRect().height) + 8);
    } catch (_) {
      return 56;
    }
  }

  function scrollNodeToWrap(scroller, wrap) {
    if (!scroller || !wrap) return false;
    try {
      var wrapRect = wrap.getBoundingClientRect();
      var scrollerRect = scroller.getBoundingClientRect
        ? scroller.getBoundingClientRect()
        : { top: 0 };
      var pad = chromeOffsetPx(scroller);
      var nextTop = scroller.scrollTop + (wrapRect.top - scrollerRect.top) - pad;
      nextTop = Math.max(0, nextTop);
      // Instant only — smooth + instant fights on Safari/Firefox and can no-op.
      scroller.scrollTop = nextTop;
      if (typeof scroller.scrollTo === 'function') {
        try { scroller.scrollTo(0, nextTop); } catch (_) {}
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  function scrollPanelIntoView() {
    var wrap = global.document.getElementById('unitBestPilotPanelWrap');
    if (!wrap || !wrap.classList.contains('is-open')) return;
    // Force layout so max-height:none expansion is measurable before scroll.
    try { void wrap.offsetHeight; } catch (_) {}
    var targets = collectScrollTargets(wrap);
    var ok = false;
    for (var i = 0; i < targets.length; i++) {
      if (scrollNodeToWrap(targets[i], wrap)) ok = true;
    }
    if (ok) return;
    try {
      wrap.scrollIntoView(true);
    } catch (_) {
      try { wrap.scrollIntoView({ block: 'start', inline: 'nearest' }); } catch (__) {}
    }
  }

  function scheduleScrollToPanel() {
    // Multiple passes: open class, layout expand, font/image paint, slow browsers.
    var run = function () {
      if (typeof global.requestAnimationFrame === 'function') {
        global.requestAnimationFrame(function () {
          scrollPanelIntoView();
        });
      } else {
        scrollPanelIntoView();
      }
    };
    var delays = [0, 40, 120, 280, 480, 800];
    delays.forEach(function (ms) {
      global.setTimeout(run, ms);
    });
  }

  function openPanel() {
    state.open = true;
    var wrap = global.document.getElementById('unitBestPilotPanelWrap');
    if (wrap) {
      wrap.classList.add('is-open');
      wrap.setAttribute('aria-hidden', 'false');
    }
    syncTriggerActive();
    syncFilterButtons();
    syncPanelSubtitle();
    void ensureDefenderTiers();
    scheduleScrollToPanel();
    var d = global.S && global.S.currentDetailData;
    if (!d) return;
    if (state.unitId !== String(d.id)) {
      state.unitId = String(d.id);
      state.loaded = false;
    }
    if (state.cache[state.unitId]) {
      state.loaded = true;
      renderActivePanel();
      scheduleScrollToPanel();
      // Re-fetch affinity details if a prior load skipped them.
      var cached = state.cache[state.unitId];
      var needsAff = (cached.pilots || []).some(function (p) {
        return p && p.affinity_matches === undefined;
      });
      if (needsAff) {
        var lang = (global.S && global.S.lang) || 'EN';
        void enrichAffinityMatches(cached, state.unitId, lang).then(function () {
          if (state.open && String(state.unitId) === String(d.id)) renderActivePanel();
        });
      }
      return;
    }
    if (!state.loading) void loadRankings(d.id);
  }

  function closePanel() {
    state.open = false;
    closeMetricDropdown();
    var wrap = global.document.getElementById('unitBestPilotPanelWrap');
    if (wrap) {
      wrap.classList.remove('is-open');
      wrap.setAttribute('aria-hidden', 'true');
    }
    syncTriggerActive();
  }

  function toggle() {
    if (state.open) closePanel();
    else openPanel();
  }

  function scheduleIdle(fn) {
    // Prefer next frame so detail paint wins, then prefetch starts immediately.
    if (typeof global.requestAnimationFrame === 'function') {
      global.requestAnimationFrame(function () {
        global.setTimeout(fn, 0);
      });
    } else {
      global.setTimeout(fn, 0);
    }
  }

  function prefetchRankings(unitId) {
    var uid = String(unitId);
    if (state.cache[uid] && state.cache[uid].pilots && state.cache[uid].pilots.length) return;
    if (state.inflight[uid]) return;
    var lang = (global.S && global.S.lang) || 'EN';
    var promise = fetchPublishedPilots(unitId, lang).then(function (entry) {
      delete state.inflight[uid];
      if (!entry || !entry.pilots || !entry.pilots.length) return null;
      // Keep result even if user navigated away — next open of same unit is instant.
      state.cache[uid] = entry;
      // Affinity is secondary; warm it in idle time without blocking panel paint.
      scheduleIdle(function () {
        void enrichAffinityMatches(entry, unitId, lang);
      });
      return entry;
    }).catch(function () {
      delete state.inflight[uid];
      return null;
    });
    state.inflight[uid] = promise;
  }

  function onDetailOpen(d) {
    state.open = false;
    closeMetricDropdown();
    state.unitId = d ? String(d.id) : null;
    state.loaded = false;
    state.loading = false;
    state.loadGen++;
    var wrap = global.document.getElementById('unitBestPilotPanelWrap');
    if (wrap) {
      wrap.classList.remove('is-open');
      wrap.setAttribute('aria-hidden', 'true');
    }
    setPanelHtml('');
    syncPanelSubtitle();
    void ensureDefenderTiers();
    if (d && isEligible(d)) {
      // After detail paints: prefetch Top 10 from published cache (does not block /api/unit).
      scheduleIdle(function () {
        if (String(state.unitId) !== String(d.id)) return;
        prefetchRankings(d.id);
      });
    }
  }

  function onDetailClose() {
    state.open = false;
    state.unitId = null;
    state.loaded = false;
    state.loading = false;
    state.loadGen++;
  }

  bindClickDelegation();

  global.GgenUnitBestPilots = {
    syncUi: syncUi,
    toggle: toggle,
    openPanel: openPanel,
    closePanel: closePanel,
    onDetailOpen: onDetailOpen,
    onDetailClose: onDetailClose
  };
})(window);
