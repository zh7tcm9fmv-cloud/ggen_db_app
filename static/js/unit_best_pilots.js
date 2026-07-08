(function (global) {
  'use strict';

  var state = {
    open: false,
    unitId: null,
    loading: false,
    loaded: false,
    loadGen: 0,
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
    var title = t('unit_best_pilot_btn') || 'Best Synergy Pilots';
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
      var btn = ev.target.closest('[data-unit-best-pilot-toggle], .unit-best-pilot-btn');
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.stopImmediatePropagation();
      toggle();
    }, true);
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
      parts += '<div class="msy-pilot-dmg-dealt-pct" title="Damage Dealt Up %">'
        + esc('Damage Dealt: ' + (pilot.dmg_dealt_pct | 0) + '%') + '</div>';
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

  async function fetchPublishedPilots(unitId, lang) {
    var q = 'lang=' + encodeURIComponent(lang)
      + '&lb_tier=3&def_tier=3&rank_mode=super_crit&top_pilots=10';
    var res = await fetch('/api/unit/' + encodeURIComponent(unitId) + '/best_synergy_pilots?' + q, {
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var payload = await res.json();
    if (payload.error) throw new Error(payload.detail || payload.error);
    if (payload.pilots && payload.pilots.length && !payload.pending) {
      return sortPilotsByCalcDamage(payload.pilots);
    }
    return null;
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
    var pilots = (payload.group && payload.group.pilots) || [];
    return sortPilotsByCalcDamage(pilots);
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

  async function loadRankings(unitId) {
    var gen = ++state.loadGen;
    state.loading = true;
    showLoading();
    try {
      var lang = (global.S && global.S.lang) || 'EN';
      var pilots = await fetchPublishedPilots(unitId, lang);
      if (gen !== state.loadGen) return;
      if (!pilots) {
        pilots = await withTimeout(
          loadRankingsViaDc(unitId, lang),
          120000,
          'dc_timeout'
        );
        if (gen !== state.loadGen) return;
        if (pilots && pilots.length) warmPublishedPilots(unitId, pilots, lang);
      }
      if (!pilots || !pilots.length) {
        state.loaded = true;
        setPanelHtml('<div class="unit-best-pilot-empty">' + esc(t('unit_best_pilot_empty') || 'No eligible pilots found.') + '</div>');
        return;
      }
      state.cache[String(unitId)] = pilots;
      state.loaded = true;
      setPanelHtml(renderPilotGrid(pilots, unitId));
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

  function prefetchRankings(unitId) {
    var lang = (global.S && global.S.lang) || 'EN';
    void fetchPublishedPilots(unitId, lang).then(function (pilots) {
      if (!pilots || !pilots.length) return;
      if (String(state.unitId) !== String(unitId)) return;
      state.cache[String(unitId)] = pilots;
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
    if (d && isEligible(d)) prefetchRankings(d.id);
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
