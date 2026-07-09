(function (global) {
  'use strict';

  var SHINN_EX_CHAR_ID = '1330000103';
  var shinnPortraitUrl = '';

  var state = {
    open: false,
    unitId: null,
    loading: false,
    loaded: false,
    loadGen: 0,
    excludeUr: false,
    excludeShinn: false,
    sameRole: false,
    // unitId -> { pilots, pilots_no_ur, pilots_no_shinn, pilots_same_role, ... }
    cache: {}
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
      var hideShinn = !!state.excludeUr;
      shBtn.style.display = hideShinn ? 'none' : '';
      shBtn.setAttribute('aria-hidden', hideShinn ? 'true' : 'false');
      if (!hideShinn) {
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
  }

  function toggleFilter(kind) {
    if (kind === 'no_ur') {
      state.excludeUr = !state.excludeUr;
      if (state.excludeUr) state.excludeShinn = true;
    } else if (kind === 'no_shinn') {
      if (state.excludeUr) return;
      state.excludeShinn = !state.excludeShinn;
    } else if (kind === 'same_role') {
      state.sameRole = !state.sameRole;
    } else {
      return;
    }
    syncFilterButtons();
    renderActivePanel();
  }

  function filterPilotsLocal(pilots, noUr, noShinn, sameRole) {
    if (!pilots || !pilots.length) return [];
    if (noUr) noShinn = true;
    var unitRole = null;
    if (sameRole) {
      var d = global.S && global.S.currentDetailData;
      unitRole = d && d.role_id != null ? String(d.role_id) : null;
    }
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

  function pilotsForView(entry) {
    if (!entry) return { pilots: [], partial: false };
    var noUr = !!state.excludeUr;
    var noShinn = !!state.excludeShinn || noUr;
    var sameRole = !!state.sameRole;
    var rows;
    var partial = false;
    if (sameRole && !noUr && !noShinn) {
      rows = (entry.pilots_same_role && entry.pilots_same_role.length)
        ? entry.pilots_same_role
        : filterPilotsLocal(entry.pilots || [], false, false, true);
      partial = !!entry.same_role_partial || rows.length < 10;
    } else if (noUr) {
      rows = (entry.pilots_no_ur && entry.pilots_no_ur.length)
        ? entry.pilots_no_ur
        : filterPilotsLocal(entry.pilots || [], true, true, sameRole);
      if (sameRole) rows = filterPilotsLocal(rows, false, false, true);
      partial = !!entry.no_ur_partial || rows.length < 10;
    } else if (noShinn) {
      rows = (entry.pilots_no_shinn && entry.pilots_no_shinn.length)
        ? entry.pilots_no_shinn
        : filterPilotsLocal(entry.pilots || [], false, true, sameRole);
      if (sameRole) rows = filterPilotsLocal(rows, false, false, true);
      partial = !!entry.no_shinn_partial || rows.length < 10;
    } else {
      rows = entry.pilots || [];
    }
    return {
      pilots: sortPilotsByCalcDamage(rows).slice(0, 10),
      partial: partial
    };
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
    enrich(entry.pilots);
    enrich(entry.pilots_no_ur);
    enrich(entry.pilots_no_shinn);
    enrich(entry.pilots_same_role);
  }

  async function enrichAffinityMatches(entry, unitId, lang) {
    if (!entry || !entry.pilots || !entry.pilots.length) return entry;
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
    collect(entry.pilots);
    collect(entry.pilots_no_ur);
    collect(entry.pilots_no_shinn);
    collect(entry.pilots_same_role);
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
      attachSkills(entry.pilots);
      attachSkills(entry.pilots_no_ur);
      attachSkills(entry.pilots_no_shinn);
      attachSkills(entry.pilots_same_role);
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
      + '&lb_tier=3&def_tier=3&rank_mode=super_crit&top_pilots=10&bsp=1';
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
    return '<div class="tag-unit-icon-wrapper">' + inner + '</div>';
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

  function pilotDamage(pilot) {
    if (!pilot) return 0;
    return pilot.peak_dmg || pilot.super_crit_dmg || pilot.score || pilot.max_damage || 0;
  }

  function sortPilotsByCalcDamage(pilots) {
    if (!pilots || !pilots.length) return pilots || [];
    return pilots.slice().sort(function (a, b) {
      return pilotDamage(b) - pilotDamage(a);
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
    if (isGc) {
      sub += '<div class="msy-pilot-sub msy-pilot-sub--gc">' + esc(t('msy_guaranteed_crit') || 'Guaranteed Crit') + '</div>';
      // Still show 100% crit so GC does not hide the numeric rate.
      sub += '<div class="msy-pilot-sub">' + esc((t('msy_crit_rate') || '{n}% crit').replace('{n}', '100')) + '</div>';
    } else if (critPct > 0) {
      var cr = t('msy_crit_rate') || '{n}% crit';
      sub += '<div class="msy-pilot-sub">' + esc(cr.replace('{n}', String(critPct))) + '</div>';
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
      + pilotFormulaStatHtml(pilot) + '</div></div>';
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

  function entryFromPayload(payload) {
    if (!payload || !payload.pilots || !payload.pilots.length || payload.pending) return null;
    return {
      pilots: sortPilotsByCalcDamage(payload.pilots),
      pilots_no_ur: sortPilotsByCalcDamage(payload.pilots_no_ur || []),
      pilots_no_shinn: sortPilotsByCalcDamage(payload.pilots_no_shinn || []),
      pilots_same_role: sortPilotsByCalcDamage(payload.pilots_same_role || []),
      no_ur_partial: !!payload.no_ur_partial,
      no_shinn_partial: !!payload.no_shinn_partial,
      same_role_partial: !!payload.same_role_partial,
      source: payload.source || 'published_dc'
    };
  }

  function entryFromUnitDetail(d) {
    if (!d || !d.best_synergy_pilots) return null;
    return entryFromPayload(d.best_synergy_pilots);
  }

  async function fetchPublishedPilots(unitId, lang) {
    var q = 'lang=' + encodeURIComponent(lang)
      + '&lb_tier=3&def_tier=3&rank_mode=super_crit&top_pilots=10';
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
    var pilots = sortPilotsByCalcDamage(group.pilots || []);
    var noUrBlock = (group.rankings_no_ur || {}).super_crit || {};
    var noShinnBlock = (group.rankings_no_shinn || {}).super_crit || {};
    return {
      pilots: pilots,
      pilots_no_ur: sortPilotsByCalcDamage(noUrBlock.pilots || filterPilotsLocal(pilots, true, true)),
      pilots_no_shinn: sortPilotsByCalcDamage(noShinnBlock.pilots || filterPilotsLocal(pilots, false, true)),
      no_ur_partial: !(noUrBlock.pilots && noUrBlock.pilots.length >= 10),
      no_shinn_partial: !(noShinnBlock.pilots && noShinnBlock.pilots.length >= 10),
      source: 'client_dc'
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
    // Instant path: unit detail already embedded the published top-10 (Soshage-style).
    var detail = global.S && global.S.currentDetailData;
    var embedded = (detail && String(detail.id) === String(unitId))
      ? entryFromUnitDetail(detail)
      : null;
    if (embedded) {
      commitEntry(unitId, embedded, gen);
      return;
    }
    showLoading();
    try {
      var lang = (global.S && global.S.lang) || 'EN';
      var entry = await fetchPublishedPilots(unitId, lang);
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
    var onRec = hasRecPilot(d);
    global.document.querySelectorAll('#unitBestPilotBtnSlotPortrait').forEach(function (slot) {
      slot.innerHTML = onRec ? '' : renderTriggerBtn();
    });
    global.document.querySelectorAll('[data-unit-best-pilot-rec]').forEach(function (slot) {
      slot.innerHTML = onRec ? renderTriggerBtn() : '';
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
    var d = global.S && global.S.currentDetailData;
    if (!d) return;
    if (state.unitId !== String(d.id)) {
      state.unitId = String(d.id);
      state.loaded = false;
    }
    if (state.cache[state.unitId]) {
      state.loaded = true;
      syncFilterButtons();
      renderActivePanel();
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

  function prefetchRankings(unitId) {
    if (state.cache[String(unitId)]) return;
    var detail = global.S && global.S.currentDetailData;
    var embedded = (detail && String(detail.id) === String(unitId))
      ? entryFromUnitDetail(detail)
      : null;
    if (embedded) {
      state.cache[String(unitId)] = embedded;
      return;
    }
    var lang = (global.S && global.S.lang) || 'EN';
    void fetchPublishedPilots(unitId, lang).then(function (entry) {
      if (!entry || !entry.pilots || !entry.pilots.length) return;
      if (String(state.unitId) !== String(unitId)) return;
      state.cache[String(unitId)] = entry;
    });
  }

  function onDetailOpen(d) {
    state.open = false;
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
    if (d && isEligible(d)) {
      // Prefer embedded top-10 from /api/unit — zero extra latency.
      var embedded = entryFromUnitDetail(d);
      if (embedded) state.cache[String(d.id)] = embedded;
      else prefetchRankings(d.id);
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
