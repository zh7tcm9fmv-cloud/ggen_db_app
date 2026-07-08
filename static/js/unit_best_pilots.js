(function (global) {
  'use strict';

  var state = {
    open: false,
    unitId: null,
    loading: false,
    loaded: false,
    loadGen: 0,
    eligible: null,
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

  function hasRecPilot(d) {
    if (!d || d.detail_npc_context) return false;
    var rc = d.recommend_character;
    return !!(rc && rc.id);
  }

  function dcQuery() {
    var lang = (global.S && global.S.lang) || 'EN';
    return 'lang=' + encodeURIComponent(lang)
      + '&lb_tier=3&def_tier=3&rank_mode=super_crit&top_pilots=10';
  }

  function renderTriggerBtn() {
    var icon = imgUrl('/static/images/UI/UI_Common_Tmb_PriorPilot_Icon.webp');
    var title = t('unit_best_pilot_btn') || 'Best Synergy Pilots';
    return '<button type="button" class="unit-best-pilot-btn' + (state.open ? ' is-active' : '')
      + '" onclick="event.stopPropagation();GgenUnitBestPilots.toggle()" title="' + escAttr(title)
      + '" aria-label="' + escAttr(title) + '" aria-expanded="' + (state.open ? 'true' : 'false') + '">'
      + '<img class="unit-best-pilot-btn-icon" src="' + icon + '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
      + '</button>';
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

  function pilotThumb(c) {
    if (!c) return '';
    var row = {
      rarity: c.rarity || 'N',
      thum: c.thum || c.portrait || '',
      role_icon: c.role_icon || '',
      acquisition_icon: ''
    };
    return typeof global.renderListThumb === 'function'
      ? global.renderListThumb(row, 'char', 44) : '';
  }

  function roleIconHtml(c) {
    if (!c || !c.role_icon) return '';
    return '<img src="' + escAttr(imgUrl(c.role_icon)) + '" alt="" style="width:14px;height:14px;flex-shrink:0" loading="lazy" onerror="this.style.display=\'none\'">';
  }

  function pilotFormulaStatHtml(pilot) {
    if (!pilot || pilot.char_atk == null) return '';
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
    var parts = '<div class="msy-pilot-formula-stat">' + esc(line) + '</div>';
    if (pilot.dmg_dealt_pct != null && pilot.dmg_dealt_pct !== '') {
      var vigor = pilot.vigor_dmg_pct | 0;
      var passive = pilot.dmg_dealt_pct | 0;
      var dmgLine = 'Damage Dealt: ' + passive + '%';
      if (vigor > 0) dmgLine += ' (+' + vigor + '% vigor)';
      parts += '<div class="msy-pilot-dmg-dealt-pct" title="Damage Dealt Up % from DC formula">' + esc(dmgLine) + '</div>';
    }
    return parts;
  }

  function pilotDamage(pilot) {
    if (!pilot) return 0;
    return pilot.super_crit_dmg || pilot.score || pilot.peak_dmg || 0;
  }

  function renderPilotCard(unitId, pilot) {
    var c = pilot.char || {};
    var dmg = pilotDamage(pilot);
    var sub = '';
    if (pilot.guaranteed_crit) {
      sub += '<div class="msy-pilot-sub msy-pilot-sub--gc">' + esc(t('msy_guaranteed_crit') || 'Guaranteed Crit') + '</div>';
    } else if (pilot.crit_rate) {
      var cr = t('msy_crit_rate') || '{n}% crit';
      sub += '<div class="msy-pilot-sub">' + esc(cr.replace('{n}', String(pilot.crit_rate))) + '</div>';
    }
    return '<div class="msy-pilot-card">'
      + '<span class="msy-pilot-rank">' + esc(String(pilot.rank || '')) + '</span>'
      + '<button type="button" class="msy-pilot-open" title="' + escAttr(t('msy_open_char') || 'Open pilot') + '" onclick="openDetail(\'character\',\'' + escJs(String(c.id)) + '\')">'
      + '<div class="msy-pilot-thumb">' + pilotThumb(c) + '</div>'
      + '<div class="msy-pilot-body">'
      + '<div class="msy-pilot-name-row">' + roleIconHtml(c)
      + '<span class="msy-pilot-name" title="' + escAttr(c.name || '') + '">' + esc(c.name || '') + '</span>'
      + '</div>' + sub + '</div></button>'
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
      + esc(t('unit_best_pilot_loading') || 'Computing best synergy pilots…') + '</div>'
      + renderSkeletonGrid());
  }

  async function ensureEligible(unitId) {
    if (state.eligible && state.eligible.unitId === String(unitId)) {
      return state.eligible.data;
    }
    var lang = (global.S && global.S.lang) || 'EN';
    var res = await fetch('/api/unit/' + encodeURIComponent(unitId) + '/best_synergy_pilots/bootstrap?lang=' + encodeURIComponent(lang), { credentials: 'same-origin' });
    if (!res.ok) return { eligible: false };
    var data = await res.json();
    state.eligible = { unitId: String(unitId), data: data };
    return data;
  }

  async function loadRankings(unitId) {
    var gen = ++state.loadGen;
    state.loading = true;
    showLoading();
    try {
      var boot = await ensureEligible(unitId);
      if (gen !== state.loadGen) return;
      if (!boot || !boot.eligible) {
        hideTriggers();
        closePanel();
        return;
      }
      if (!global.MsyDcEngine || typeof global.MsyDcEngine.ensureReady !== 'function') {
        throw new Error('DC engine unavailable');
      }
      await global.MsyDcEngine.ensureReady();
      if (gen !== state.loadGen) return;
      var pilotIds = boot.pilot_ids || [];
      var defTiers = boot.defender_tiers || {};
      var raw = await global.MsyDcEngine.evalUnit(unitId, pilotIds, defTiers, {
        lang: (global.S && global.S.lang) || 'EN',
        cpOn: true,
        pepOn: true
      });
      if (gen !== state.loadGen) return;
      if (!raw || !raw.byTier) throw new Error('eval failed');
      var asmRes = await fetch('/api/meta_synergy_dc/assemble?' + dcQuery(), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          pairs_by_tier: raw.byTier
        })
      });
      if (!asmRes.ok) throw new Error('HTTP ' + asmRes.status);
      var payload = await asmRes.json();
      if (gen !== state.loadGen) return;
      if (payload.error) throw new Error(payload.detail || payload.error);
      var group = payload.group || {};
      var pilots = group.pilots || [];
      state.cache[String(unitId)] = pilots;
      state.loaded = true;
      setPanelHtml(renderPilotGrid(pilots, unitId));
    } catch (err) {
      if (gen !== state.loadGen) return;
      setPanelHtml('<div class="unit-best-pilot-empty">' + esc(t('unit_best_pilot_error') || 'Could not load rankings.') + '</div>');
      console.error('GgenUnitBestPilots', err);
    } finally {
      if (gen === state.loadGen) state.loading = false;
    }
  }

  function syncUi(d) {
    if (!d || d.detail_npc_context) {
      hideTriggers();
      return;
    }
    if (String(d.id) !== state.unitId) onDetailOpen(d);
    var onRec = hasRecPilot(d);
    global.document.querySelectorAll('#unitBestPilotBtnSlotPortrait').forEach(function (slot) {
      slot.innerHTML = onRec ? '' : renderTriggerBtn();
    });
    global.document.querySelectorAll('#unitBestPilotBtnSlotRec').forEach(function (slot) {
      slot.innerHTML = onRec ? renderTriggerBtn() : '';
    });
    void ensureEligible(d.id).then(function (boot) {
      if (!boot || !boot.eligible) hideTriggers();
    }).catch(function () { hideTriggers(); });
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
      state.eligible = null;
    }
    if (state.cache[state.unitId] && state.loaded) {
      setPanelHtml(renderPilotGrid(state.cache[state.unitId], state.unitId));
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

  function onDetailOpen(d) {
    state.open = false;
    state.unitId = d ? String(d.id) : null;
    state.loaded = false;
    state.loading = false;
    state.eligible = null;
    state.loadGen++;
    var wrap = global.document.getElementById('unitBestPilotPanelWrap');
    if (wrap) {
      wrap.classList.remove('is-open');
      wrap.setAttribute('aria-hidden', 'true');
    }
    setPanelHtml('');
  }

  function onDetailClose() {
    state.open = false;
    state.unitId = null;
    state.loaded = false;
    state.loading = false;
    state.eligible = null;
    state.loadGen++;
  }

  global.GgenUnitBestPilots = {
    syncUi: syncUi,
    toggle: toggle,
    openPanel: openPanel,
    closePanel: closePanel,
    onDetailOpen: onDetailOpen,
    onDetailClose: onDetailClose
  };
})(window);
