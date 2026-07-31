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
    super_crit: '/static/images/UI/UI_Battle_MapUI_Label_SuperCritical.webp',
    crit: '/static/images/UI/UI_Battle_MapUI_Label_Critical.webp',
    normal: '/static/images/UI/UI_Battle_MapUI_Label_Normal.webp'
  };
  var ATTACK_ROLE_ID = '1';
  var DEFENSE_ROLE_ID = '2';
  var SUPPORT_ROLE_ID = '3';
  var ROLE_FILTER_ICONS = {
    '1': '/static/images/UI/UI_Common_TypeIcon_Attack_M.webp',
    '2': '/static/images/UI/UI_Common_TypeIcon_Defense_M.webp',
    '3': '/static/images/UI/UI_Common_TypeIcon_Support_M.webp'
  };

  var state = {
    open: false,
    unitId: null,
    loading: false,
    loaded: false,
    loadGen: 0,
    excludeUr: false,
    excludeShinn: false,
    // all | same | support (support only offered on Attack units)
    roleMode: 'all',
    rankMode: 'normal',
    // Active skills in damage ranking (false = fair skills-off Top 10)
    skillsOn: true,
    // damage | defender (defender only on Defense-role units)
    boardKind: 'damage',
    isDefenseUnit: false,
    // lang:unitId -> { modes: { super_crit, crit, normal }, ... }
    cache: {},
    // lang:unitId -> in-flight Promise<entry|null> (shared by prefetch + panel open)
    inflight: {},
    defenderTiers: null,
    defenderTiersPromise: null,
    // { name, power, ... } from published BSP weapon_info
    weaponInfo: null
  };

  function currentLang() {
    return (global.S && global.S.lang) || 'EN';
  }

  function appVersion() {
    return String(global.__GGEN_APP_VERSION__ || '');
  }

  function cacheKey(unitId) {
    // Include deploy version so in-memory Top 10 entries die after Railway commits.
    return appVersion() + ':' + currentLang() + ':' + String(unitId || '');
  }

  function getCachedEntry(unitId) {
    return state.cache[cacheKey(unitId)] || null;
  }

  function setCachedEntry(unitId, entry) {
    if (!unitId || !entry) return;
    state.cache[cacheKey(unitId)] = entry;
  }

  function clearLocaleCaches() {
    state.cache = {};
    state.inflight = {};
    state.defenderTiers = null;
    state.defenderTiersPromise = null;
  }

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
    // SD / Linked Character units cannot switch pilots — no Top 10 boards.
    return !!(d && d.best_synergy_pilot_eligible && !d.is_sd && !d.detail_npc_context);
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
        closeRoleDropdown();
        toggleMetricDropdown();
        return;
      }
      var roleItem = ev.target.closest('#ubpRoleDdMenu [data-ubp-role-mode]');
      if (roleItem) {
        ev.preventDefault();
        ev.stopPropagation();
        setRoleMode(roleItem.getAttribute('data-ubp-role-mode'));
        return;
      }
      var roleToggle = ev.target.closest('#ubpRoleDdToggle');
      if (roleToggle) {
        ev.preventDefault();
        ev.stopPropagation();
        closeMetricDropdown();
        toggleRoleDropdown();
        return;
      }
      // Click outside closes dropdowns.
      if (!ev.target.closest('#ubpMetricDropdown')) closeMetricDropdown();
      if (!ev.target.closest('#ubpRoleDropdown')) closeRoleDropdown();
      var filterBtn = ev.target.closest('[data-ubp-filter]');
      if (filterBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        toggleFilter(filterBtn.getAttribute('data-ubp-filter'));
        return;
      }
      var boardBtn = ev.target.closest('[data-ubp-board]');
      if (boardBtn) {
        ev.preventDefault();
        ev.stopPropagation();
        setBoardKind(boardBtn.getAttribute('data-ubp-board'));
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
    if (d.role != null && d.role !== '' && !isNaN(parseInt(d.role, 10))) return String(d.role);
    return null;
  }

  function isAttackUnit() {
    return unitRoleId() === ATTACK_ROLE_ID;
  }

  function isDefenseUnit() {
    if (state.isDefenseUnit) return true;
    return unitRoleId() === DEFENSE_ROLE_ID;
  }

  function isDefenderBoard() {
    return state.boardKind === 'defender' && isDefenseUnit();
  }

  function isSameRoleMode() {
    return state.roleMode === 'same';
  }

  function isSupportRoleMode() {
    return state.roleMode === 'support' && isAttackUnit();
  }

  function roleIconsHtml(ids) {
    return (ids || []).map(function (id) {
      var src = ROLE_FILTER_ICONS[String(id)];
      if (!src) return '';
      return '<img class="ubp-role-icon" src="' + imgUrl(src) + '" alt="" width="16" height="16"'
        + ' loading="lazy" decoding="async" role="presentation">';
    }).join('');
  }

  function sameRoleIconsHtml() {
    var rid = unitRoleId();
    if (rid && ROLE_FILTER_ICONS[rid]) return roleIconsHtml([rid]);
    return roleIconsHtml([ATTACK_ROLE_ID]);
  }

  function roleModeIconsHtml(mode) {
    var m = mode || state.roleMode;
    if (m === 'support') return roleIconsHtml([SUPPORT_ROLE_ID]);
    if (m === 'same') return sameRoleIconsHtml();
    // Default: no role limit — all three role icons
    return roleIconsHtml([ATTACK_ROLE_ID, DEFENSE_ROLE_ID, SUPPORT_ROLE_ID]);
  }

  function roleModeTitle(mode) {
    if (mode === 'support') return t('msy_support_role_on') || 'Showing Support-role pilots only';
    if (mode === 'same') return t('msy_same_role_on') || 'Showing same-role pilots only';
    return t('msy_role_all') || 'All roles';
  }

  function roleModeAria(mode) {
    if (mode === 'support') return t('msy_support_role') || 'Supporters only';
    if (mode === 'same') return t('msy_same_role') || 'Same Role Characters Only';
    return t('msy_role_all') || 'All roles';
  }

  function shinnFilterRelevant() {
    // Shinn is Attack-role; same-role on Defense/Support and Supporters-only already exclude him.
    if (state.excludeUr) return false;
    if (isSupportRoleMode()) return false;
    if (isSameRoleMode() && !isAttackUnit()) return false;
    return true;
  }

  function syncFilterButtons() {
    var urBtn = global.document.getElementById('ubpExcludeUrBtn');
    var shBtn = global.document.getElementById('ubpExcludeShinnBtn');
    var roleDd = global.document.getElementById('ubpRoleDropdown');
    var filters = global.document.querySelector('.unit-best-pilot-filters');
    var metrics = global.document.querySelector('.unit-best-pilot-metrics');
    var defender = isDefenderBoard();
    // DEF board: keep the filter strip so Skills on/off stays reachable; hide DMG-only controls.
    if (filters) filters.style.display = '';
    if (metrics) metrics.style.display = defender ? 'none' : '';
    if (roleDd) {
      roleDd.style.display = defender ? 'none' : '';
      roleDd.setAttribute('aria-hidden', defender ? 'true' : 'false');
    }
    if (urBtn) {
      urBtn.style.display = defender ? 'none' : '';
      urBtn.setAttribute('aria-hidden', defender ? 'true' : 'false');
      urBtn.classList.toggle('is-active', !!state.excludeUr);
      urBtn.classList.toggle('active', !!state.excludeUr);
      urBtn.setAttribute('aria-pressed', state.excludeUr ? 'true' : 'false');
      urBtn.title = state.excludeUr
        ? (t('msy_exclude_ur_on') || 'Showing non-UR pilots only')
        : (t('msy_exclude_ur') || 'Exclude UR pilots');
    }
    if (shBtn) {
      if (!shinnFilterRelevant()) state.excludeShinn = false;
      var showShinn = shinnFilterRelevant() && !defender;
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
    syncRoleDropdown();
    syncMetricButtons();
    syncBoardModeButtons();
    syncSkillsToggle();
    syncPanelTitle();
  }

  function syncBoardModeButtons() {
    var wrap = global.document.getElementById('ubpBoardMode');
    var defense = isDefenseUnit();
    if (wrap) {
      wrap.hidden = !defense;
      wrap.style.display = defense ? '' : 'none';
      wrap.setAttribute('aria-hidden', defense ? 'false' : 'true');
    }
    if (!defense && state.boardKind === 'defender') state.boardKind = 'damage';
    global.document.querySelectorAll('[data-ubp-board]').forEach(function (el) {
      var kind = el.getAttribute('data-ubp-board');
      var on = kind === state.boardKind;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function syncSkillsToggle() {
    var btn = global.document.getElementById('ubpSkillsBtn');
    if (!btn) return;
    // Skills on/off applies to both Damage and Defender boards.
    btn.style.display = '';
    btn.setAttribute('aria-hidden', 'false');
    // Active = skills OFF (same pattern as No Shinn / No UR slash buttons).
    var off = !state.skillsOn;
    btn.classList.toggle('is-active', off);
    btn.classList.toggle('active', off);
    btn.setAttribute('aria-pressed', off ? 'true' : 'false');
    btn.title = off
      ? (t('unit_best_pilot_skills_off_on') || 'Showing rankings without active skills')
      : (t('unit_best_pilot_skills_off') || 'Rank without active skills');
  }

  function syncPanelTitle() {
    var el = global.document.querySelector('#unitBestPilotPanelWrap .unit-best-pilot-panel-title');
    if (!el) return;
    var title;
    var tip = '';
    if (isDefenderBoard()) {
      title = state.skillsOn
        ? (t('unit_best_pilot_title_defender') || 'Top 10 Defender Pilots')
        : (t('unit_best_pilot_title_defender_skills_off') || 'Top 10 Defender (Skills Off)');
      tip = t('unit_best_pilot_title_defender_tip') || (
        'Survivability ranking vs Destiny Gundam + Shinn (shield on, Super vigor).\n\n'
        + 'Score = Survival (~72%) + Support Defense + EN sustain + light counter damage (~5%).\n'
        + 'Survival uses hits-to-kill vs EX + next weapon (55%/45%), soft HTK, and damage-taken-down % '
        + '(affinity + Force Guard when Skills On).\n\n'
        + 'Toggle Skills to include/exclude active skills like Force Guard. Not a full PvP sim.'
      );
    } else {
      title = state.skillsOn
        ? (t('unit_best_pilot_title') || 'Top 10 Damage Pilot')
        : (t('unit_best_pilot_title_skills_off') || 'Top 10 Damage (Skills Off)');
      tip = t('unit_best_pilot_title_damage_tip') || (
        'Ranks pilots by peak pair damage vs Eternal Expert DEF (same rules as the Damage Simulator).\n\n'
        + 'Defaults: LB3, best EX weapon, Super vigor, Conditional Passive + Pilot Exclusive Passive on.\n'
        + 'Metric buttons switch Super Crit / Crit / Normal. 0% crit pilots use Normal for Crit metrics.\n\n'
        + 'Toggle Skills to include/exclude active skills (ATK buffs, damage dealt, crit rate, etc.).'
      );
    }
    el.textContent = title;
    if (tip) {
      el.setAttribute('title', tip);
      el.classList.add('unit-best-pilot-panel-title--tip');
    } else {
      el.removeAttribute('title');
      el.classList.remove('unit-best-pilot-panel-title--tip');
    }
  }

  function setBoardKind(kind) {
    var next = String(kind || 'damage');
    if (next !== 'damage' && next !== 'defender') return;
    if (next === 'defender' && !isDefenseUnit()) next = 'damage';
    if (state.boardKind === next) return;
    state.boardKind = next;
    syncFilterButtons();
    renderActivePanel();
  }

  function syncRoleDropdown() {
    // Non-Attack units cannot use Supporters-only — snap back if needed.
    if (!isAttackUnit() && state.roleMode === 'support') state.roleMode = 'all';
    var mode = state.roleMode || 'all';
    var roleBtn = global.document.getElementById('ubpRoleDdToggle')
      || global.document.getElementById('ubpSameRoleBtn');
    if (roleBtn) {
      var roleActive = mode !== 'all';
      roleBtn.classList.toggle('is-active', roleActive);
      roleBtn.classList.toggle('active', roleActive);
      var roleIcons = roleBtn.querySelector('.ubp-same-role-icons');
      if (roleIcons) roleIcons.innerHTML = roleModeIconsHtml(mode);
      roleBtn.title = roleModeTitle(mode);
      roleBtn.setAttribute('aria-label', roleModeAria(mode));
    }
    var attack = isAttackUnit();
    global.document.querySelectorAll('#ubpRoleDdMenu [data-ubp-role-mode]').forEach(function (el) {
      var m = el.getAttribute('data-ubp-role-mode');
      var on = m === mode;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      el.title = roleModeAria(m);
      el.setAttribute('aria-label', roleModeAria(m));
      if (m === 'support') {
        el.hidden = !attack;
        el.style.display = attack ? '' : 'none';
      }
      if (m === 'same') {
        var sameIcons = el.querySelector('[data-ubp-role-same-icons]') || el.querySelector('.ubp-same-role-icons');
        if (sameIcons) sameIcons.innerHTML = sameRoleIconsHtml();
      }
    });
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
    var html = '<span class="unit-best-pilot-panel-note-def">'
      + esc(tpl.replace('{ms}', fmtDef(ms)).replace('{pilot}', fmtDef(pilot)))
      + '</span>';
    var wi = state.weaponInfo;
    if (wi && wi.name) {
      var pow = wi.power != null ? fmtN(wi.power) : '';
      var wline = pow ? (String(wi.name) + ': ' + pow) : String(wi.name);
      html += '<span class="unit-best-pilot-panel-weapon">' + esc(wline) + '</span>';
    }
    return html;
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

  function closeRoleDropdown() {
    var dd = global.document.getElementById('ubpRoleDropdown');
    if (dd) dd.classList.remove('is-open');
    var btn = global.document.getElementById('ubpRoleDdToggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleRoleDropdown() {
    var dd = global.document.getElementById('ubpRoleDropdown');
    if (!dd) return;
    var open = !dd.classList.contains('is-open');
    dd.classList.toggle('is-open', open);
    var btn = global.document.getElementById('ubpRoleDdToggle');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function metricIconUrl(mode) {
    var path = RANK_MODE_ICON[mode] || RANK_MODE_ICON.normal;
    return typeof global.imgUrl === 'function' ? global.imgUrl(path) : path;
  }

  function syncMetricButtons() {
    var mode = state.rankMode || 'normal';
    var label = metricLabel(mode);
    var btn = global.document.getElementById('ubpMetricDdToggle');
    if (btn) {
      btn.setAttribute('data-ubp-metric', mode);
      btn.setAttribute('aria-label', label);
      btn.title = label;
      var img = btn.querySelector('.ubp-metric-icon');
      if (img) {
        var url = metricIconUrl(mode);
        if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      }
      btn.classList.add('is-active');
      btn.classList.add('active');
    }
    global.document.querySelectorAll('#ubpMetricDdMenu [data-ubp-metric]').forEach(function (el) {
      var m = el.getAttribute('data-ubp-metric');
      var on = m === mode;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      el.title = metricLabel(m);
      el.setAttribute('aria-label', metricLabel(m));
      var img = el.querySelector('.ubp-metric-icon');
      if (img && m) {
        var url = metricIconUrl(m);
        if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      }
    });
  }

  function setRankMode(mode) {
    if (RANK_MODES.indexOf(mode) < 0) return;
    closeMetricDropdown();
    closeRoleDropdown();
    if (state.rankMode === mode) return;
    state.rankMode = mode;
    syncMetricButtons();
    renderActivePanel();
  }

  function setRoleMode(mode) {
    var next = String(mode || 'all');
    if (next !== 'all' && next !== 'same' && next !== 'support') return;
    if (next === 'support' && !isAttackUnit()) next = 'all';
    closeRoleDropdown();
    closeMetricDropdown();
    if (state.roleMode === next) return;
    state.roleMode = next;
    if (!shinnFilterRelevant()) state.excludeShinn = false;
    syncFilterButtons();
    renderActivePanel();
  }

  function toggleFilter(kind) {
    if (kind === 'no_ur') {
      state.excludeUr = !state.excludeUr;
      if (state.excludeUr) state.excludeShinn = true;
    } else if (kind === 'no_shinn') {
      if (!shinnFilterRelevant()) return;
      state.excludeShinn = !state.excludeShinn;
    } else if (kind === 'no_skills') {
      state.skillsOn = !state.skillsOn;
    } else {
      return;
    }
    syncFilterButtons();
    renderActivePanel();
  }

  function filterPilotsLocal(pilots, noUr, noShinn, sameRole, supportRole) {
    if (!pilots || !pilots.length) return [];
    if (noUr) noShinn = true;
    var unitRole = sameRole ? unitRoleId() : null;
    if (!noUr && !noShinn && !sameRole && !supportRole) return pilots.slice();
    return pilots.filter(function (p) {
      var ch = (p && p.char) || {};
      var rarity = String(ch.rarity || '');
      var cid = String(ch.id || '');
      var role = String(ch.role_id || '');
      if (noUr && rarity === 'UR') return false;
      if (noShinn && cid === SHINN_EX_CHAR_ID) return false;
      if (supportRole && role !== SUPPORT_ROLE_ID) return false;
      if (sameRole && unitRole != null && role !== unitRole) return false;
      return true;
    });
  }

  function modeEntry(entry) {
    if (!entry) return null;
    var mode = state.rankMode || 'super_crit';
    if (entry.modes && entry.modes[mode]) return entry.modes[mode];
    return entry;
  }

  function sortPilotsByDefenderScore(pilots) {
    if (!pilots || !pilots.length) return pilots || [];
    return pilots.slice().sort(function (a, b) {
      var ds = (parseFloat(b.score) || 0) - (parseFloat(a.score) || 0);
      if (ds) return ds;
      return (parseFloat(b.ehtk) || 0) - (parseFloat(a.ehtk) || 0);
    }).map(function (p, i) {
      var row = Object.assign({}, p);
      row.rank = i + 1;
      return row;
    });
  }

  function pilotsForView(entry) {
    var board = modeEntry(entry);
    if (!board) return { pilots: [], partial: false };
    var mode = state.rankMode || 'super_crit';

    if (isDefenderBoard()) {
      var defRows = state.skillsOn
        ? (board.pilots_defender || entry.pilots_defender || [])
        : (board.pilots_defender_no_skills || entry.pilots_defender_no_skills || []);
      // Fallback if skills-off board not yet built — show skills-on list empty-handed rather than crash.
      if (!state.skillsOn && !defRows.length) {
        defRows = board.pilots_defender || entry.pilots_defender || [];
      }
      var defPartial = state.skillsOn
        ? !!(board.defender_partial || entry.defender_partial)
        : !!(board.defender_no_skills_partial || entry.defender_no_skills_partial);
      return {
        pilots: sortPilotsByDefenderScore(defRows).slice(0, 10),
        partial: defPartial && defRows.length < 10,
        defender: true,
        skillsOff: !state.skillsOn
      };
    }

    // Skills-off: dedicated fair-pool board (store depth ≥20 so No Shinn can fill Top 10).
    if (!state.skillsOn) {
      var off = board.pilots_no_active_skills || [];
      var noUrOff = !!state.excludeUr;
      var noShinnOff = noUrOff || (!!state.excludeShinn && shinnFilterRelevant());
      var sameOff = isSameRoleMode();
      var supportOff = isSupportRoleMode();
      var filteredOff = filterPilotsLocal(off, noUrOff, noShinnOff, sameOff, supportOff);
      return {
        pilots: sortPilotsByCalcDamage(filteredOff, mode).slice(0, 10),
        partial: filteredOff.length < 10,
        skillsOff: true
      };
    }

    var noUr = !!state.excludeUr;
    // Same-role on non-Attack / Supporters-only already excludes Shinn — don't apply No Shinn on top.
    var noShinn = noUr || (!!state.excludeShinn && shinnFilterRelevant());
    var sameRole = isSameRoleMode();
    var supportRole = isSupportRoleMode();
    var rows = [];
    var partial = false;

    function take(list, markPartial) {
      rows = list || [];
      partial = !!markPartial;
    }

    // Prefer dedicated calculator boards. Combined filters start from the richest
    // matching board, then apply the remaining constraints (never invent damage).
    if (supportRole && noUr) {
      if (board.pilots_support_role && board.pilots_support_role.length) {
        take(filterPilotsLocal(board.pilots_support_role, true, true, false, false), !!board.support_role_partial);
      } else if (board.pilots_no_ur && board.pilots_no_ur.length) {
        take(filterPilotsLocal(board.pilots_no_ur, false, false, false, true), !!board.no_ur_partial);
      } else {
        take(filterPilotsLocal(board.pilots || [], true, true, false, true), true);
      }
    } else if (supportRole) {
      if (board.pilots_support_role && board.pilots_support_role.length) {
        take(board.pilots_support_role, !!board.support_role_partial && board.pilots_support_role.length < 10);
      } else {
        take(filterPilotsLocal(board.pilots || [], false, false, false, true), true);
      }
    } else if (sameRole && noUr) {
      // Prefer same-role board (deeper store) then strip UR — fills Support/Defense lists.
      if (board.pilots_same_role && board.pilots_same_role.length) {
        take(filterPilotsLocal(board.pilots_same_role, true, true, false, false), !!board.same_role_partial);
      } else if (board.pilots_no_ur && board.pilots_no_ur.length) {
        take(filterPilotsLocal(board.pilots_no_ur, false, false, true, false), !!board.no_ur_partial);
      } else {
        take(filterPilotsLocal(board.pilots || [], true, true, true, false), true);
      }
      // If intersection is still thin, try the other dedicated board as a second pass.
      if (rows.length < 10 && board.pilots_no_ur && board.pilots_no_ur.length) {
        var alt = filterPilotsLocal(board.pilots_no_ur, false, false, true, false);
        if (alt.length > rows.length) take(alt, !!board.no_ur_partial);
      }
    } else if (sameRole && noShinn) {
      // Attack + same-role + No Shinn: filter Shinn out of the same-role board.
      if (board.pilots_same_role && board.pilots_same_role.length) {
        take(filterPilotsLocal(board.pilots_same_role, false, true, false, false), !!board.same_role_partial);
      } else if (board.pilots_no_shinn && board.pilots_no_shinn.length) {
        take(filterPilotsLocal(board.pilots_no_shinn, false, false, true, false), !!board.no_shinn_partial);
      } else {
        take(filterPilotsLocal(board.pilots || [], false, true, true, false), true);
      }
    } else if (sameRole) {
      if (board.pilots_same_role && board.pilots_same_role.length) {
        take(board.pilots_same_role, !!board.same_role_partial && board.pilots_same_role.length < 10);
      } else {
        take(filterPilotsLocal(board.pilots || [], false, false, true, false), true);
      }
    } else if (noUr) {
      if (board.pilots_no_ur && board.pilots_no_ur.length) {
        take(board.pilots_no_ur, !!board.no_ur_partial && board.pilots_no_ur.length < 10);
      } else {
        take(filterPilotsLocal(board.pilots || [], true, true, false, false), true);
      }
    } else if (noShinn) {
      if (board.pilots_no_shinn && board.pilots_no_shinn.length) {
        take(board.pilots_no_shinn, !!board.no_shinn_partial && board.pilots_no_shinn.length < 10);
      } else {
        take(filterPilotsLocal(board.pilots || [], false, true, false, false), true);
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
          p.affinity_matches = normalizeAffinityMatches(affinityMap[key] || []);
        }
      });
    }
    forEachBoard(entry, function (board) {
      enrich(board.pilots);
      enrich(board.pilots_no_ur);
      enrich(board.pilots_no_shinn);
      enrich(board.pilots_same_role);
      enrich(board.pilots_support_role);
      enrich(board.pilots_no_active_skills);
      enrich(board.pilots_defender);
      enrich(board.pilots_defender_no_skills);
    });
    enrich(entry.pilots_defender);
    enrich(entry.pilots_defender_no_skills);
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
      collect(board.pilots_support_role);
      collect(board.pilots_no_active_skills);
      collect(board.pilots_defender);
      collect(board.pilots_defender_no_skills);
    });
    collect(entry.pilots_defender);
    collect(entry.pilots_defender_no_skills);
    if (!charIds.length) return entry;
    try {
      // aff_v=2 busts stale browser caches of dual normal+SP affinity payloads.
      var q = 'lang=' + encodeURIComponent(lang || 'EN')
        + '&char_ids=' + encodeURIComponent(charIds.join(','))
        + '&pairs=' + encodeURIComponent(pairs.join(','))
        + '&aff_v=2';
      var res = await fetch('/api/meta_synergy_pilot_skills?' + q, { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return entry;
      var data = await res.json();
      applyAffinityToEntry(entry, data.affinity_by_pair || {}, unitId);
      var skills = data.skills_by_char || {};
      function attachSkills(list) {
        (list || []).forEach(function (p) {
          var cid = String(((p && p.char) || {}).id || '');
          // Do not overwrite DEF survival skills (or empty skills-off lists) with ATK skills.
          if (cid && skills[cid] && !p.active_skills && !p.survival_skills) {
            p.active_skills = skills[cid];
          }
        });
      }
      forEachBoard(entry, function (board) {
        attachSkills(board.pilots);
        attachSkills(board.pilots_no_ur);
        attachSkills(board.pilots_no_shinn);
        attachSkills(board.pilots_same_role);
        attachSkills(board.pilots_support_role);
        attachSkills(board.pilots_no_active_skills);
        // Defender boards ship survival skills from the server — do not attach ATK skills.
      });
    } catch (_) {}
    return entry;
  }

  function renderActivePanel() {
    if (!state.open || !state.unitId) return;
    var entry = getCachedEntry(state.unitId);
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
    } else if (view.skillsOff) {
      note = '<div class="unit-best-pilot-filter-note">'
        + esc(t('unit_best_pilot_skills_off_note')
          || 'Ranked without active skills (stats, affinity, and best weapon only).')
        + '</div>';
    }
    setPanelHtml(note + renderPilotGrid(pilots, state.unitId, view.defender));
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

  function normalizeAffinityMatches(aff) {
    // Keep one row per affinity family (strip " LV N"); prefer the highest level
    // so stale dual normal+SP payloads never paint both.
    var rows = Array.isArray(aff) ? aff : [];
    var best = {};
    var order = [];
    rows.forEach(function (row) {
      if (!row || typeof row !== 'object') return;
      var name = String(row.ability || '').trim();
      var base = name.replace(/\s*LV\s*\d+\s*$/i, '').trim().toLowerCase() || name.toLowerCase();
      var lv = 0;
      var m = name.match(/\bLV\s*(\d+)\b/i);
      if (m) lv = parseInt(m[1], 10) || 0;
      var prev = best[base];
      if (!prev) {
        best[base] = { lv: lv, row: row };
        order.push(base);
        return;
      }
      if (lv > prev.lv) best[base] = { lv: lv, row: row };
    });
    return order.map(function (k) { return best[k].row; });
  }

  function roleIconHtml(c) {
    if (!c || !c.role_icon) return '';
    return '<img src="' + escAttr(imgUrl(c.role_icon)) + '" alt="" style="width:14px;height:14px;flex-shrink:0" loading="lazy" onerror="this.style.display=\'none\'">';
  }

  function pilotAffinityHtml(pilot) {
    var aff = normalizeAffinityMatches(pilot.affinity_matches || []);
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
      // Match Damage Simulator "Damage Dealt" input / Passive Bonuses (passive only).
      // Vigor shares the same ⑨ pool in calculateDamage but is not part of this field.
      var passive = pilot.dmg_dealt_pct | 0;
      var dmgTpl = t('msy_dmg_dealt') || 'Damage Dealt: {n}%';
      var dmgLine = dmgTpl.replace('{n}', String(passive));
      var title = (t('msy_dmg_dealt_title') || 'Damage Dealt Up % (passive bonuses)')
        .replace('{p}', String(passive))
        .replace('{v}', '0');
      parts += '<div class="msy-pilot-dmg-dealt-pct" title="' + escAttr(title) + '">'
        + esc(dmgLine) + '</div>';
    }
    // Affinity match wording is redundant — tag/detail icons already indicate the match.
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

  function pilotDefenderReasonsHtml(pilot) {
    var reasons = (pilot && pilot.reasons) || [];
    // Prefer live survival-skill chips (Force Guard×15%) over stale reason text.
    var skillChips = defenderSurvivalSkills(pilot).map(formatSurvivalSkillChip).filter(Boolean);
    var skillBases = {};
    skillChips.forEach(function (chip) {
      var base = String(chip).replace(/[×x]\s*\d+\s*%\s*$/i, '').trim().toLowerCase();
      if (base) skillBases[base] = 1;
    });
    var out = [];
    reasons.forEach(function (r) {
      var label = String(r);
      // Normalize "Force Guard 15%" → "Force Guard×15%"
      var m = label.match(/^(.+?)\s+(\d+)\s*%$/);
      if (m && !/^(EHTK|DR|Atk|EN|SD|SDx2|Series SD|Revive)/i.test(m[1].trim())) {
        label = m[1].trim() + '×' + m[2] + '%';
      }
      var base = label.replace(/[×x]\s*\d+\s*%\s*$/i, '').trim().toLowerCase();
      if (skillBases[base]) return; // replaced by skillChips below
      out.push(label);
    });
    skillChips.forEach(function (chip) { out.push(chip); });
    if (!out.length) return '';
    return '<div class="msy-pilot-defender-reasons">'
      + out.map(function (label) {
        var cls = 'msy-pilot-defender-chip';
        if (/^Series SD$/i.test(label)) cls += ' msy-pilot-defender-chip--series-sd';
        else if (/^DR\s+\d+%/i.test(label)) cls += ' msy-pilot-defender-chip--dr';
        else if (/^SDx2$/i.test(label)) cls += ' msy-pilot-defender-chip--sdx2';
        else if (/[×x]\s*\d+\s*%\s*$/i.test(label) || (/\d+%\s*$/.test(label) && !/^EHTK|^Atk|^DR|^EN|^SD|^Revive/i.test(label))) {
          cls += ' msy-pilot-defender-chip--skill';
        }
        return '<span class="' + cls + '">' + esc(label) + '</span>';
      }).join('')
      + '</div>';
  }

  function formatSurvivalSkillChip(sk) {
    if (!sk) return '';
    var name = String(sk.name || '').replace(/\s*LV\s*\d+\s*$/i, '').trim() || String(sk.name || '');
    var pct = sk.taken_down_pct | 0;
    if (pct > 0) return name + '×' + pct + '%';
    return name;
  }

  function defenderSurvivalSkills(pilot) {
    if (!pilot) return [];
    if (pilot.survival_skills && pilot.survival_skills.length) return pilot.survival_skills;
    var skills = pilot.active_skills || [];
    return skills.filter(function (sk) { return sk && sk.active; });
  }

  function pilotDefenderSkillIconsHtml(pilot) {
    var active = defenderSurvivalSkills(pilot);
    if (!active.length) return '';
    var html = '<div class="msy-pilot-skills msy-pilot-skills--def" title="'
      + escAttr(t('unit_best_pilot_survival_skills') || 'Active skills used for survivability')
      + '">';
    active.forEach(function (sk) {
      var tip = formatSurvivalSkillChip(sk) || sk.name || '';
      html += '<span class="msy-pilot-skill msy-pilot-skill--active" title="' + escAttr(tip) + '">';
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

  function defenderScoreHoverTitle(pilot) {
    var parts = (pilot && pilot.score_parts) || {};
    var lines = [];
    lines.push(t('unit_best_pilot_defender_score') || 'Defender score');
    lines.push('');
    var survW = parts.survival_weight != null ? parts.survival_weight : 0.72;
    var ctrW = parts.counter_weight != null ? parts.counter_weight : 0.05;
    lines.push((t('unit_best_pilot_score_survival') || 'Survival (tankiness × {w}): {n}')
      .replace('{w}', String(survW))
      .replace('{n}', String(parts.survival != null ? parts.survival : '—')));
    lines.push((t('unit_best_pilot_score_htk_ex') || 'HTK vs Weapon A (EX): {n}')
      .replace('{n}', String(pilot.htk_ex != null ? pilot.htk_ex : '—')));
    lines.push((t('unit_best_pilot_score_htk_next') || 'HTK vs Weapon B: {n}')
      .replace('{n}', String(pilot.htk_next != null ? pilot.htk_next : '—')));
    lines.push((t('unit_best_pilot_score_ehtk') || 'Combined EHTK (0.55×A + 0.45×B): {n}')
      .replace('{n}', String(pilot.ehtk != null ? pilot.ehtk : '—')));
    if (parts.ehtk_soft != null) {
      lines.push((t('unit_best_pilot_score_ehtk_soft') || 'Soft EHTK (HP ÷ dmg taken): {n}')
        .replace('{n}', String(parts.ehtk_soft)));
    }
    lines.push((t('unit_best_pilot_score_sd') || 'Support Defense bonus: {n} (SD +{c})')
      .replace('{n}', String(parts.sd != null ? parts.sd : 0))
      .replace('{c}', String(pilot.sd_plus_count != null ? pilot.sd_plus_count : 0)));
    if (parts.series_sd_bonus) {
      lines.push((t('unit_best_pilot_score_series_sd') || 'Series Support Defense bonus: +{n}')
        .replace('{n}', String(parts.series_sd_bonus)));
    }
    var passDr = parts.passive_taken_down_pct != null
      ? parts.passive_taken_down_pct
      : (pilot.passive_taken_down_pct != null ? pilot.passive_taken_down_pct : null);
    var skillDr = parts.skill_taken_down_pct != null
      ? parts.skill_taken_down_pct
      : (pilot.skill_taken_down_pct != null ? pilot.skill_taken_down_pct : null);
    if (parts.taken_down_pct) {
      lines.push((t('unit_best_pilot_score_dr') || 'Damage taken down (total): {n}%')
        .replace('{n}', String(parts.taken_down_pct)));
    }
    if (passDr) {
      lines.push((t('unit_best_pilot_score_dr_passive') || 'Damage taken down (affinity): {n}%')
        .replace('{n}', String(passDr)));
    }
    if (skillDr) {
      lines.push((t('unit_best_pilot_score_dr_skill') || 'Damage taken down (active skills): {n}%')
        .replace('{n}', String(skillDr)));
    }
    var survSkills = defenderSurvivalSkills(pilot);
    if (survSkills.length) {
      lines.push(t('unit_best_pilot_survival_skills') || 'Active skills used for survivability');
      survSkills.forEach(function (sk) {
        lines.push('• ' + (formatSurvivalSkillChip(sk) || sk.name || '?'));
      });
    }
    lines.push((t('unit_best_pilot_score_en') || 'EN sustain: {n}')
      .replace('{n}', String(parts.en != null ? parts.en : 0)));
    lines.push((t('unit_best_pilot_score_counter') || 'Counter damage (tiebreaker × {w}): {n}')
      .replace('{w}', String(ctrW))
      .replace('{n}', String(parts.counter != null ? parts.counter : 0)));
    if (parts.revive) {
      lines.push((t('unit_best_pilot_score_revive') || 'Revive floor: +{n}')
        .replace('{n}', String(parts.revive)));
    }
    lines.push('');
    lines.push((t('unit_best_pilot_score_total') || 'Total: {n}')
      .replace('{n}', String(pilot.score != null ? pilot.score : 0)));
    lines.push(t('unit_best_pilot_defender_bully')
      || 'Inbound hits: Destiny Gundam EX + Shinn (Weapon A EX + Weapon B).');
    return lines.join('\n');
  }

  function renderPilotCard(unitId, pilot, defenderMode) {
    var c = pilot.char || {};
    if (defenderMode) {
      var score = pilot.score != null ? pilot.score : 0;
      var ehtk = pilot.ehtk != null ? pilot.ehtk : '';
      var sub = '';
      if (ehtk !== '') {
        sub += '<div class="msy-pilot-sub">' + esc((t('unit_best_pilot_ehtk') || 'EHTK {n}').replace('{n}', String(ehtk))) + '</div>';
      }
      if (pilot.out_peak_dmg) {
        sub += '<div class="msy-pilot-sub">' + esc((t('unit_best_pilot_counter_dmg') || 'Atk {n}').replace('{n}', fmtN(pilot.out_peak_dmg))) + '</div>';
      }
      var cardCls = 'msy-pilot-card msy-pilot-card--defender';
      if (pilot.series_sd) cardCls += ' msy-pilot-card--series-sd';
      var skillIcons = state.skillsOn ? pilotDefenderSkillIconsHtml(pilot) : '';
      return '<div class="' + cardCls + '">'
        + '<span class="msy-pilot-rank">' + esc(String(pilot.rank || '')) + '</span>'
        + '<button type="button" class="msy-pilot-open" title="' + escAttr(t('msy_open_char') || 'Open pilot') + '" onclick="openDetail(\'character\',\'' + escJs(String(c.id)) + '\')">'
        + '<div class="msy-pilot-thumb">' + pilotThumb(c) + '</div>'
        + '<div class="msy-pilot-body">'
        + '<div class="msy-pilot-name-row">' + roleIconHtml(c)
        + '<span class="msy-pilot-name" title="' + escAttr(c.name || '') + '">' + esc(c.name || '') + '</span>'
        + '</div>'
        + sub
        + pilotAffinityHtml(pilot)
        + pilotDefenderReasonsHtml(pilot)
        + '</div></button>'
        + '<div class="msy-pilot-dmg-col"><div class="msy-pilot-dmg" title="'
        + escAttr(defenderScoreHoverTitle(pilot)) + '">'
        + fmtN(score) + '</div>'
        + skillIcons
        + '</div></div>';
    }
    var dmg = pilotDamage(pilot);
    var subD = '';
    var critPct = pilot.crit_rate | 0;
    var isGc = !!(pilot.guaranteed_crit || critPct >= 100);
    var crTpl = t('msy_crit_rate') || '{n}% crit';
    if (isGc) {
      subD += '<div class="msy-pilot-sub msy-pilot-sub--gc">' + esc(t('msy_guaranteed_crit') || 'Guaranteed Crit') + '</div>';
      subD += '<div class="msy-pilot-sub">' + esc(crTpl.replace('{n}', '100')) + '</div>';
    } else {
      // Always show crit % (including 0) so non-Shinn rates are visible.
      subD += '<div class="msy-pilot-sub">' + esc(crTpl.replace('{n}', String(critPct))) + '</div>';
    }
    var skillIcons = state.skillsOn ? pilotActiveSkillIconsHtml(pilot) : '';
    return '<div class="msy-pilot-card">'
      + '<span class="msy-pilot-rank">' + esc(String(pilot.rank || '')) + '</span>'
      + '<button type="button" class="msy-pilot-open" title="' + escAttr(t('msy_open_char') || 'Open pilot') + '" onclick="openDetail(\'character\',\'' + escJs(String(c.id)) + '\')">'
      + '<div class="msy-pilot-thumb">' + pilotThumb(c) + '</div>'
      + '<div class="msy-pilot-body">'
      + '<div class="msy-pilot-name-row">' + roleIconHtml(c)
      + '<span class="msy-pilot-name" title="' + escAttr(c.name || '') + '">' + esc(c.name || '') + '</span>'
      + '</div>'
      + subD
      + pilotAffinityHtml(pilot)
      + '</div></button>'
      + '<div class="msy-pilot-dmg-col"><div class="msy-pilot-dmg">' + fmtN(dmg) + '</div>'
      + pilotFormulaStatHtml(pilot)
      + skillIcons
      + '</div></div>';
  }

  function renderPilotGrid(pilots, unitId, defenderMode) {
    if (!pilots || !pilots.length) {
      return '<div class="unit-best-pilot-empty">' + esc(t('unit_best_pilot_empty') || 'No eligible pilots found.') + '</div>';
    }
    var mid = Math.ceil(pilots.length / 2);
    var left = pilots.slice(0, mid).map(function (p) { return renderPilotCard(unitId, p, defenderMode); }).join('');
    var right = pilots.slice(mid).map(function (p) { return renderPilotCard(unitId, p, defenderMode); }).join('');
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
      pilots_support_role: sortPilotsByCalcDamage(payload.pilots_support_role || [], mode),
      pilots_no_active_skills: sortPilotsByCalcDamage(payload.pilots_no_active_skills || [], mode),
      pilots_defender: sortPilotsByDefenderScore(payload.pilots_defender || []),
      pilots_defender_no_skills: sortPilotsByDefenderScore(payload.pilots_defender_no_skills || []),
      no_ur_partial: !!payload.no_ur_partial,
      no_shinn_partial: !!payload.no_shinn_partial,
      same_role_partial: !!payload.same_role_partial,
      support_role_partial: !!payload.support_role_partial,
      no_active_skills_partial: !!payload.no_active_skills_partial,
      defender_partial: !!payload.defender_partial,
      defender_no_skills_partial: !!payload.defender_no_skills_partial,
      is_defense_unit: !!payload.is_defense_unit,
      source: payload.source || 'published_dc',
      rank_mode: mode,
      weapon_info: payload.weapon_info || null
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
    var wi = payload.weapon_info || primary.weapon_info || null;
    if (!wi && modes.super_crit) wi = modes.super_crit.weapon_info || null;
    var defenders = primary.pilots_defender || [];
    if (!defenders.length && payload.pilots_defender) {
      defenders = sortPilotsByDefenderScore(payload.pilots_defender);
    }
    var defendersOff = primary.pilots_defender_no_skills || [];
    if (!defendersOff.length && payload.pilots_defender_no_skills) {
      defendersOff = sortPilotsByDefenderScore(payload.pilots_defender_no_skills);
    }
    return {
      pilots: primary.pilots,
      pilots_no_ur: primary.pilots_no_ur,
      pilots_no_shinn: primary.pilots_no_shinn,
      pilots_same_role: primary.pilots_same_role,
      pilots_support_role: primary.pilots_support_role,
      pilots_no_active_skills: primary.pilots_no_active_skills,
      pilots_defender: defenders,
      pilots_defender_no_skills: defendersOff,
      no_ur_partial: primary.no_ur_partial,
      no_shinn_partial: primary.no_shinn_partial,
      same_role_partial: primary.same_role_partial,
      support_role_partial: primary.support_role_partial,
      no_active_skills_partial: primary.no_active_skills_partial,
      defender_partial: primary.defender_partial,
      defender_no_skills_partial: primary.defender_no_skills_partial,
      is_defense_unit: !!(payload.is_defense_unit || primary.is_defense_unit),
      source: primary.source,
      weapon_info: wi,
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
      + '&top_pilots=10&all_modes=1'
      + '&_v=' + encodeURIComponent(appVersion() || '0');
    var res = await fetch('/api/unit/' + encodeURIComponent(unitId) + '/best_synergy_pilots?' + q, {
      credentials: 'same-origin',
      cache: 'no-store'
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
      var supportRoleBlock = ((group.rankings_support_role || {})[mode]) || {};
      var noSkillsBlock = ((group.rankings_no_active_skills || {})[mode]) || {};
      var defRoot = group.rankings_defender || {};
      var defBlock = defRoot.defender || {};
      var defOffBlock = defRoot.defender_no_skills || {};
      return {
        pilots: pilots,
        pilots_no_ur: sortPilotsByCalcDamage(noUrBlock.pilots || filterPilotsLocal(pilots, true, true), mode),
        pilots_no_shinn: sortPilotsByCalcDamage(noShinnBlock.pilots || filterPilotsLocal(pilots, false, true), mode),
        pilots_same_role: sortPilotsByCalcDamage(sameRoleBlock.pilots || filterPilotsLocal(pilots, false, false, true), mode),
        pilots_support_role: sortPilotsByCalcDamage(
          supportRoleBlock.pilots || filterPilotsLocal(pilots, false, false, false, true), mode
        ),
        pilots_no_active_skills: sortPilotsByCalcDamage(noSkillsBlock.pilots || [], mode),
        pilots_defender: sortPilotsByDefenderScore(defBlock.pilots || []),
        pilots_defender_no_skills: sortPilotsByDefenderScore(defOffBlock.pilots || []),
        no_ur_partial: !(noUrBlock.pilots && noUrBlock.pilots.length >= 10),
        no_shinn_partial: !(noShinnBlock.pilots && noShinnBlock.pilots.length >= 10),
        same_role_partial: !(sameRoleBlock.pilots && sameRoleBlock.pilots.length >= 10),
        support_role_partial: !(supportRoleBlock.pilots && supportRoleBlock.pilots.length >= 10),
        no_active_skills_partial: !(noSkillsBlock.pilots && noSkillsBlock.pilots.length >= 10),
        defender_partial: !(defBlock.pilots && defBlock.pilots.length >= 10),
        defender_no_skills_partial: !(defOffBlock.pilots && defOffBlock.pilots.length >= 10),
        is_defense_unit: unitRoleId() === DEFENSE_ROLE_ID,
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
      pilots_support_role: primary.pilots_support_role,
      pilots_no_active_skills: primary.pilots_no_active_skills,
      pilots_defender: primary.pilots_defender,
      pilots_defender_no_skills: primary.pilots_defender_no_skills,
      no_ur_partial: primary.no_ur_partial,
      no_shinn_partial: primary.no_shinn_partial,
      same_role_partial: primary.same_role_partial,
      support_role_partial: primary.support_role_partial,
      no_active_skills_partial: primary.no_active_skills_partial,
      defender_partial: primary.defender_partial,
      defender_no_skills_partial: primary.defender_no_skills_partial,
      is_defense_unit: !!primary.is_defense_unit,
      source: 'client_dc',
      weapon_info: group.weapon_info || null,
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
      state.weaponInfo = null;
      syncPanelSubtitle();
      setPanelHtml('<div class="unit-best-pilot-empty">' + esc(t('unit_best_pilot_empty') || 'No eligible pilots found.') + '</div>');
      return;
    }
    setCachedEntry(unitId, entry);
    state.weaponInfo = entry.weapon_info || null;
    state.isDefenseUnit = !!entry.is_defense_unit || unitRoleId() === DEFENSE_ROLE_ID;
    state.loaded = true;
    state.loading = false;
    syncFilterButtons();
    syncPanelSubtitle();
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
    var ck = cacheKey(uid);
    var cached = getCachedEntry(uid);
    if (cached && cached.pilots && cached.pilots.length) {
      commitEntry(unitId, cached, gen);
      return;
    }
    showLoading();
    try {
      var lang = currentLang();
      var entry = null;
      // Reuse background prefetch if already in flight for this locale.
      if (state.inflight[ck]) {
        entry = await state.inflight[ck];
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
    var cachedOpen = getCachedEntry(state.unitId);
    if (cachedOpen) {
      state.loaded = true;
      state.weaponInfo = cachedOpen.weapon_info || null;
      state.isDefenseUnit = !!cachedOpen.is_defense_unit || unitRoleId() === DEFENSE_ROLE_ID;
      syncFilterButtons();
      syncPanelSubtitle();
      renderActivePanel();
      scheduleScrollToPanel();
      // Always refresh affinities — empty/stale rows must not stick after SP/series fixes.
      var lang = currentLang();
      void enrichAffinityMatches(cachedOpen, state.unitId, lang).then(function () {
        if (state.open && String(state.unitId) === String(d.id)) renderActivePanel();
      });
      return;
    }
    if (!state.loading) void loadRankings(d.id);
  }

  function closePanel() {
    state.open = false;
    closeMetricDropdown();
    closeRoleDropdown();
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
    var ck = cacheKey(uid);
    if (getCachedEntry(uid) && getCachedEntry(uid).pilots && getCachedEntry(uid).pilots.length) return;
    if (state.inflight[ck]) return;
    var lang = currentLang();
    var promise = fetchPublishedPilots(unitId, lang).then(function (entry) {
      delete state.inflight[ck];
      if (!entry || !entry.pilots || !entry.pilots.length) return null;
      // Keep result even if user navigated away — next open of same unit is instant.
      setCachedEntry(uid, entry);
      // Affinity is secondary; warm it in idle time without blocking panel paint.
      scheduleIdle(function () {
        void enrichAffinityMatches(entry, unitId, lang);
      });
      return entry;
    }).catch(function () {
      delete state.inflight[ck];
      return null;
    });
    state.inflight[ck] = promise;
  }

  function onLangChange() {
    clearLocaleCaches();
    if (!state.unitId) return;
    if (state.open) {
      void loadRankings(state.unitId);
    } else {
      scheduleIdle(function () {
        if (state.unitId) prefetchRankings(state.unitId);
      });
    }
  }

  function onDetailOpen(d) {
    state.open = false;
    closeMetricDropdown();
    closeRoleDropdown();
    state.unitId = d ? String(d.id) : null;
    state.loaded = false;
    state.loading = false;
    state.roleMode = 'all';
    state.skillsOn = true;
    state.boardKind = 'damage';
    state.isDefenseUnit = !!(d && String(d.role_id || '') === DEFENSE_ROLE_ID);
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
    onDetailClose: onDetailClose,
    onLangChange: onLangChange,
    clearLocaleCaches: clearLocaleCaches
  };
})(window);
