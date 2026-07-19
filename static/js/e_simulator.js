/* E Simulator — simple route list UI (GTower-style) */
(function (global) {
  'use strict';

  var PAYLOAD_VERSION = 16;
  var REWARD_ICON_SIZE = 56;
  var state = {
    data: null,
    lang: null,
    diagramId: null,
    docDetail: null,
    panel: 'stages', // stages | missions | progress | complete | event
    progressTab: 'story', // story | report | mission — Progress Rewards sub-tabs
  };

  function t(k) {
    return (typeof global.t === 'function' ? global.t(k) : '') || k;
  }
  function esc(s) {
    return typeof global.esc === 'function' ? global.esc(s) : String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function imgUrl(path) {
    if (typeof global.imgUrlPreferCdn === 'function') return global.imgUrlPreferCdn(path);
    if (typeof global.imgUrl === 'function') return global.imgUrl(path);
    return path || '';
  }

  function ensureDom() {
    var panel = document.getElementById('panel-stages');
    if (!panel) return null;
    var wrap = document.getElementById('eSimulatorWrap');
    if (wrap) return wrap;
    wrap = document.createElement('div');
    wrap.id = 'eSimulatorWrap';
    wrap.innerHTML = '<div id="eSimulatorRoot" class="esim-root" aria-label="E Simulator"></div>';
    var list = document.getElementById('stageListViewArea');
    if (list && list.parentNode) list.parentNode.insertBefore(wrap, list);
    else panel.appendChild(wrap);
    return wrap;
  }

  function setActive(on) {
    var panel = document.getElementById('panel-stages');
    var wrap = ensureDom();
    if (panel) panel.classList.toggle('esim-active', !!on);
    if (wrap) wrap.style.display = on ? 'block' : 'none';
  }

  function currentDiagram() {
    if (!state.data || !state.data.diagrams) return null;
    var id = String(state.diagramId || '');
    for (var i = 0; i < state.data.diagrams.length; i++) {
      if (String(state.data.diagrams[i].id) === id) return state.data.diagrams[i];
    }
    return state.data.diagrams[0] || null;
  }

  function findDocument(docId) {
    var docs = (state.data && state.data.documents) || [];
    for (var i = 0; i < docs.length; i++) {
      if (String(docs[i].id) === String(docId)) return docs[i];
    }
    return null;
  }

  function divergenceLabel(div) {
    var d = Number(div) || 0;
    if (d === 1) return t('esim_div_original') || 'Original';
    if (d === 2) return t('esim_div_turning_point') || 'Turning Point';
    if (d === 3) return t('esim_div_if') || 'What If';
    return '';
  }

  /** Expand multi-battle nodes (Original + Turning Point) into separate stage cards. */
  function playableNodes(diagram) {
    var nodes = (diagram && diagram.nodes) || [];
    var out = [];
    nodes.forEach(function (n) {
      var vt = n.view_type || '';
      if (vt === 'story' || vt === 'document') {
        out.push({
          id: n.id,
          content_id: (n.primary && n.primary.id) || '',
          scenario_stage_id: (n.primary && n.primary.scenario_stage_id) || '',
          divergence: Number((n.primary && n.primary.divergence) || 0),
          number: n.number,
          title: n.title,
          description: n.description,
          recommend_order: Number(n.recommend_order) || 0,
          view_type: vt,
          thumb: n.thumb,
          thumb_detail: n.thumb_detail || n.thumb,
          primary: n.primary,
          source: n,
        });
        return;
      }
      if (vt !== 'battle') return;
      var battles = (n.contents || []).filter(function (c) {
        return c && c.type === 'battle' && c.scenario_stage_id;
      });
      if (!battles.length) {
        var p0 = n.primary || null;
        if (!p0) return;
        battles = [p0];
      }
      battles.sort(function (a, b) {
        var da = Number(a.divergence) || 0;
        var db = Number(b.divergence) || 0;
        if (da !== db) return da - db;
        return String(a.id || '').localeCompare(String(b.id || ''));
      });
      var multiBattle = battles.length > 1;
      battles.forEach(function (c, idx) {
        var div = Number(c.divergence) || 0;
        // Badge Original only when the node also has Turning Point / IF siblings;
        // always badge Turning Point (2) and What If (3).
        var showDiv = multiBattle || div === 2 || div === 3;
        out.push({
          id: n.id,
          content_id: c.id || '',
          scenario_stage_id: c.scenario_stage_id || '',
          divergence: div,
          show_divergence: showDiv,
          number: n.number,
          title: n.title,
          description: n.description,
          recommend_order: (Number(n.recommend_order) || 0) + idx * 0.01,
          view_type: 'battle',
          thumb: c.thumb || n.thumb,
          thumb_detail: c.thumb_detail || c.thumb || n.thumb_detail || n.thumb,
          primary: c,
          source: n,
        });
      });
    });
    return out.sort(function (a, b) {
      return (Number(a.recommend_order) || 0) - (Number(b.recommend_order) || 0);
    });
  }

  function openNode(n) {
    if (!n) return;
    var p = n.primary || (n.source && n.source.primary) || null;
    var sid = n.scenario_stage_id || (p && p.scenario_stage_id) || '';
    var ptype = (p && p.type) || n.view_type || '';
    if ((ptype === 'battle' || ptype === 'story' || n.view_type === 'battle' || n.view_type === 'story')
        && sid && typeof global.openDetail === 'function') {
      global.openDetail('stage', String(sid));
      return;
    }
    if (ptype === 'document' || n.view_type === 'document') {
      var doc = findDocument((p && p.document_id) || '') || {};
      var src = n.source || n;
      state.docDetail = {
        id: (p && p.document_id) || doc.id || '',
        number: n.number || doc.number || (p && p.document_number) || '',
        title: n.title || doc.title || '',
        description: n.description || src.description || doc.description || '',
        hint: (p && p.document_hint) || doc.hint || '',
        thumb: n.thumb_detail || n.thumb || (p && (p.thumb_detail || p.thumb)) || doc.thumb || '',
      };
      render();
    }
  }

  function rewardQty(r) {
    if (!r) return '';
    if (r.count != null && r.count !== '') return String(r.count);
    if (r.quantity != null && r.quantity !== '') return String(r.quantity);
    return '';
  }

  function rewardDetailMeta(r) {
    if (typeof global.rewardRowDetailClickMeta === 'function') {
      return global.rewardRowDetailClickMeta(r);
    }
    var rt = String((r && r.reward_type_index) || '');
    var type = (r && r.detail_type) || (rt === '30' ? 'profile_title' : '');
    var id = (r && (r.detail_id || r.target_id)) || '';
    if (type && id && String(id) !== '0') return { type: type, id: String(id) };
    return null;
  }

  /** Series SSP: base → frame → series logo on top (extrudes). Unit SP: hex portrait under frame. */
  function rewardThumbHtml(r, sz) {
    sz = sz || REWARD_ICON_SIZE;
    var name = (r && (r.name || r.label)) || '';
    var base = r && r.sp_chip_base ? String(r.sp_chip_base) : '';
    var unit = r && r.sp_chip_unit ? String(r.sp_chip_unit) : '';
    var frame = r && r.sp_chip_frame ? String(r.sp_chip_frame) : '';
    if (unit && (base || frame)) {
      var isSeriesLogo = /Logo-Series|logo_l_series/i.test(unit) || /Ssp_Frame|Ssp_Bg/i.test(frame + base);
      var layers = '';
      if (base) {
        layers +=
          '<img class="esim-chip-layer esim-chip-base" src="' + esc(imgUrl(base)) +
          '" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">';
      }
      if (isSeriesLogo) {
        if (frame) {
          layers +=
            '<img class="esim-chip-layer esim-chip-frame" src="' + esc(imgUrl(frame)) +
            '" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">';
        }
        layers +=
          '<img class="esim-chip-layer esim-chip-logo" src="' + esc(imgUrl(unit)) +
          '" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">';
        return (
          '<div class="esim-chip-thumb esim-chip-thumb--ssp" style="width:' + sz + 'px;height:' + sz + 'px">' +
          layers + '</div>'
        );
      }
      layers +=
        '<img class="esim-chip-layer esim-chip-logo" src="' + esc(imgUrl(unit)) +
        '" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">';
      if (frame) {
        layers +=
          '<img class="esim-chip-layer esim-chip-frame" src="' + esc(imgUrl(frame)) +
          '" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">';
      }
      return (
        '<div class="esim-chip-thumb esim-chip-thumb--uexp" style="width:' + sz + 'px;height:' + sz + 'px">' +
        layers + '</div>'
      );
    }
    var emedal = (state.data && state.data.e_medal_icon) || '/static/images/Item/event_exchange_item_0006.webp';
    var icon = (r && (r.icon || r.image)) || '';
    var tid = String((r && (r.target_id || r.detail_id)) || '');
    var isEmedal = tid === '291000250001'
      || /e[\s-]?medal/i.test(name)
      || /^E\s*(獎章|奖章|メダル)/.test(name)
      || name === 'E獎章' || name === 'E奖章' || name === 'Eメダル';
    if (isEmedal) icon = emedal;
    // Wrong Master League path for E-Medal (asset is under Item/).
    if (icon && /Master(?:%20| )?League\/event_exchange_item_0006/i.test(icon)) icon = emedal;
    if (!icon) {
      return '<span class="esim-reward-fallback" style="width:' + sz + 'px;height:' + sz + 'px"></span>';
    }
    return (
      '<div class="esim-chip-thumb esim-chip-thumb--plain" style="width:' + sz + 'px;height:' + sz + 'px">' +
      '<img class="esim-chip-layer esim-chip-plain" src="' + esc(imgUrl(icon)) +
      '" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">' +
      '</div>'
    );
  }

  function rewardRowHtml(r) {
    var qty = rewardQty(r);
    var meta = rewardDetailMeta(r);
    var clickCls = meta ? ' esim-reward-row--clickable' : '';
    var clickAttrs = meta
      ? (' data-detail-type="' + esc(meta.type) + '" data-detail-id="' + esc(meta.id) +
         '" role="button" tabindex="0"')
      : '';
    return (
      '<div class="esim-progress-reward-row' + clickCls + '"' + clickAttrs + '>' +
      rewardThumbHtml(r, REWARD_ICON_SIZE) +
      '<div class="esim-mission-body"><b>' + esc(r.name || r.label || 'Reward') + '</b>' +
      (qty ? '<span class="esim-mission-desc">×' + esc(qty) + '</span>' : '') +
      '</div></div>'
    );
  }

  function progressRewardRowsHtml(rows) {
    if (!(rows || []).length) {
      return '<div class="esim-side-hint">' + esc(t('none') || 'None') + '</div>';
    }
    return rows.map(function (rw) {
      var rate = Math.round(Number(rw.complete_rate) || 0);
      var rewards = rw.rewards || [];
      var body = rewards.length
        ? rewards.map(rewardRowHtml).join('')
        : '<div class="esim-side-hint">Reward set ' + esc(String(rw.reward_set_id || '')) + '</div>';
      return (
        '<div class="esim-reward-tier">' +
        '<div class="esim-reward-tier-rate">' + esc(String(rate)) + '%</div>' +
        '<div class="esim-reward-tier-body">' + body + '</div></div>'
      );
    }).join('');
  }

  function stageCardHtml(n) {
    var p = n.primary || {};
    var vt = n.view_type || p.type || '';
    var thumb = n.thumb || p.thumb || '';
    var div = Number(n.divergence || p.divergence || 0);
    var divLbl = (vt === 'battle' && n.show_divergence) ? divergenceLabel(div) : '';
    var label = ((n.number ? String(n.number) + ' ' : '') + (n.title || '')).trim() || vt;
    if (divLbl) label = label + ' (' + divLbl + ')';
    var typeLbl = vt === 'document' ? (t('esim_type_report') || 'Report')
      : vt === 'story' ? (t('esim_type_story') || 'Story')
      : (t('esim_type_stage') || 'Stage');
    var divCls = div === 1 ? ' esim-stage-div--original'
      : div === 2 ? ' esim-stage-div--turning'
      : div === 3 ? ' esim-stage-div--if' : '';
    var branchIcon = (div === 2 && state.data && state.data.branch_icon) ? state.data.branch_icon : '';
    return (
      '<button type="button" class="esim-stage-card" data-node-id="' + esc(String(n.id)) +
      '" data-content-id="' + esc(String(n.content_id || p.id || '')) +
      '" data-stage-id="' + esc(String(n.scenario_stage_id || p.scenario_stage_id || '')) +
      '" title="' + esc(label) + '">' +
      '<div class="esim-stage-thumb-wrap">' +
      (thumb
        ? '<img class="esim-stage-thumb" src="' + esc(imgUrl(thumb)) + '" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">'
        : '<div class="esim-stage-thumb esim-stage-thumb--empty"></div>') +
      '<span class="esim-stage-type">' + esc(typeLbl) + '</span>' +
      (divLbl
        ? '<span class="esim-stage-div' + divCls + '">' +
          (branchIcon
            ? '<img class="esim-stage-div-icon" src="' + esc(imgUrl(branchIcon)) + '" alt="" loading="lazy" decoding="async">'
            : '') +
          esc(divLbl) + '</span>'
        : '') +
      '</div>' +
      '<div class="esim-stage-meta">' +
      (n.number ? '<span class="esim-stage-num">' + esc(String(n.number)) + '</span>' : '') +
      '<span class="esim-stage-title">' + esc(n.title || label) + '</span></div></button>'
    );
  }

  function renderDocDetail() {
    var d = state.docDetail;
    if (!d) return '';
    var thumb = d.thumb ? imgUrl(d.thumb) : '';
    var title = (d.number ? (String(d.number) + ' ') : '') + (d.title || 'Report');
    return (
      '<div class="modal-overlay active esim-modal-overlay" data-close="doc">' +
      '<div class="modal-content esim-detail-modal" role="dialog" aria-label="' + esc(title) + '" onclick="event.stopPropagation()">' +
      '<div class="esim-side-head"><h3>' + esc(title) + '</h3>' +
      '<button type="button" class="esim-side-close" data-close="doc" aria-label="Close">×</button></div>' +
      '<div class="esim-detail-body">' +
      '<div class="esim-doc-art">' +
      (thumb
        ? '<img class="esim-doc-thumb" src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">'
        : '') +
      '</div>' +
      (d.description ? '<p class="esim-doc-desc">' + esc(d.description) + '</p>' : '') +
      (d.hint ? '<p class="esim-doc-hint">' + esc(d.hint) + '</p>' : '') +
      '</div></div></div>'
    );
  }

  function currentMissionTab(diagram) {
    var tabs = (state.data && state.data.mission_tabs) || [];
    var did = diagram ? String(diagram.id) : '';
    for (var i = 0; i < tabs.length; i++) {
      if (String(tabs[i].id) === did) return tabs[i];
    }
    return tabs[0] || null;
  }

  function renderPanelBody(diagram) {
    var panel = state.panel || 'stages';
    if (panel === 'missions') {
      var tab = currentMissionTab(diagram);
      var missions = (tab && tab.missions) || [];
      if (!missions.length) return '<div class="esim-side-hint">' + esc(t('none') || 'None') + '</div>';
      return '<div class="esim-mission-list">' + missions.map(function (m, idx) {
        return (
          '<div class="esim-mission-item">' +
          '<div class="esim-mission-idx">' + esc(String(idx + 1)) + '</div>' +
          '<div class="esim-mission-body"><b>' + esc(m.title || ('Mission ' + m.id)) + '</b>' +
          (m.description ? '<span class="esim-mission-desc">' + esc(m.description) + '</span>' : '') +
          '<div class="esim-mission-rewards">' + (m.rewards || []).map(rewardRowHtml).join('') + '</div></div></div>'
        );
      }).join('') + '</div>';
    }
    if (panel === 'progress') {
      var progressTab = state.progressTab || 'story';
      var storyRows = (state.data && (state.data.story_progress_rewards || state.data.story_rewards)) || [];
      var reportRows = (state.data && (state.data.report_progress_rewards || state.data.document_rewards)) || [];
      var missionRows = (state.data && (state.data.mission_progress_rewards || state.data.mission_complete_rewards)) || [];
      var subTabs = [
        { id: 'story', label: t('esim_progress_story') || 'Story Progress Rewards' },
        { id: 'report', label: t('esim_progress_report') || 'Report Progress Rewards' },
        { id: 'mission', label: t('esim_progress_mission') || 'Mission Progress Rewards' },
      ].map(function (tb) {
        var active = progressTab === tb.id;
        return (
          '<button type="button" class="stage-source-toggle-btn' + (active ? ' active' : '') +
          '" data-esim-progress-tab="' + tb.id + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
          esc(tb.label) + '</button>'
        );
      }).join('');
      var rows = progressTab === 'report' ? reportRows : (progressTab === 'mission' ? missionRows : storyRows);
      return (
        '<div class="stage-source-toggle-wrap esim-progress-tabs" role="group" aria-label="Progress reward categories">' +
        subTabs + '</div>' + progressRewardRowsHtml(rows)
      );
    }
    if (panel === 'complete') {
      var complete = (diagram && diagram.complete_rewards) || [];
      if (!complete.length) return '<div class="esim-side-hint">' + esc(t('none') || 'None') + '</div>';
      return '<div class="esim-complete-list">' + complete.map(rewardRowHtml).join('') + '</div>';
    }
    if (panel === 'event') {
      var eventRows = (state.data && (state.data.event_wide_progress_rewards || state.data.total_rewards)) || [];
      return progressRewardRowsHtml(eventRows);
    }
    var nodes = playableNodes(diagram);
    if (!nodes.length) return '<div class="esim-side-hint">' + esc(t('none') || 'None') + '</div>';
    return '<div class="esim-stage-grid">' + nodes.map(stageCardHtml).join('') + '</div>';
  }

  function render() {
    var root = document.getElementById('eSimulatorRoot');
    if (!root || !state.data) return;
    var data = state.data;
    var diagram = currentDiagram();
    if (!diagram && data.diagrams && data.diagrams[0]) {
      state.diagramId = data.diagrams[0].id;
      diagram = data.diagrams[0];
    }
    var routeTabs = (data.diagrams || []).map(function (d) {
      var active = String(d.id) === String(state.diagramId);
      return (
        '<button type="button" class="stage-source-toggle-btn esim-route-btn' + (active ? ' active' : '') +
        '" data-diagram-id="' + esc(String(d.id)) + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
        (d.tab_thumb
          ? '<img class="esim-route-thumb" src="' + esc(imgUrl(d.tab_thumb)) + '" alt="" loading="lazy">'
          : '') +
        '<span>' + esc(d.name || d.id) + '</span></button>'
      );
    }).join('');

    var panels = [
      { id: 'stages', label: t('esim_panel_stages') || 'Stages' },
      { id: 'missions', label: t('stage_missions') || 'Missions' },
      { id: 'progress', label: t('esim_panel_progress') || 'Progress Rewards' },
      { id: 'complete', label: t('esim_panel_complete') || 'Completion Rewards' },
      { id: 'event', label: t('esim_panel_event_wide') || 'Event-Wide Progress Rewards' },
    ].map(function (p) {
      var active = state.panel === p.id;
      return (
        '<button type="button" class="stage-source-toggle-btn' + (active ? ' active' : '') +
        '" data-esim-panel="' + p.id + '" aria-pressed="' + (active ? 'true' : 'false') + '">' +
        esc(p.label) + '</button>'
      );
    }).join('');

    root.innerHTML =
      '<div class="esim-toolbar">' +
      '<div class="stage-source-toggle-wrap esim-route-tabs" id="esimTabs" role="group" aria-label="Routes">' +
      routeTabs +
      '</div>' +
      '<div class="stage-source-toggle-wrap esim-panel-tabs" id="esimPanels" role="group" aria-label="E Simulator panels">' +
      panels +
      '</div></div>' +
      '<div class="esim-body">' + renderPanelBody(diagram) + '</div>' +
      renderDocDetail();

    bind();
    if (typeof global.syncStageEsimSourceButton === 'function') global.syncStageEsimSourceButton();
  }

  function bind() {
    document.querySelectorAll('#esimTabs [data-diagram-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.diagramId = btn.getAttribute('data-diagram-id');
        state.docDetail = null;
        if (state.panel === 'event') { /* keep */ }
        else state.panel = state.panel || 'stages';
        render();
      });
    });
    document.querySelectorAll('#esimPanels [data-esim-panel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.panel = btn.getAttribute('data-esim-panel') || 'stages';
        state.docDetail = null;
        render();
      });
    });
    document.querySelectorAll('[data-esim-progress-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.progressTab = btn.getAttribute('data-esim-progress-tab') || 'story';
        state.docDetail = null;
        render();
      });
    });
    document.querySelectorAll('.esim-stage-card').forEach(function (el) {
      el.addEventListener('click', function () {
        var sid = el.getAttribute('data-stage-id');
        if (sid && typeof global.openDetail === 'function') {
          global.openDetail('stage', String(sid));
          return;
        }
        var diagram = currentDiagram();
        var nid = el.getAttribute('data-node-id');
        var cid = el.getAttribute('data-content-id');
        var entries = playableNodes(diagram);
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (String(e.id) === String(nid)
              && (!cid || String(e.content_id || '') === String(cid))) {
            openNode(e);
            return;
          }
        }
      });
    });
    document.querySelectorAll('.esim-side-close, .esim-modal-overlay').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        if (btn.classList.contains('esim-modal-overlay') && ev.target !== btn) return;
        if (btn.getAttribute('data-close') === 'doc') {
          state.docDetail = null;
          render();
        }
      });
    });
    document.querySelectorAll('.esim-reward-row--clickable').forEach(function (row) {
      row.addEventListener('click', function () {
        var type = row.getAttribute('data-detail-type');
        var id = row.getAttribute('data-detail-id');
        if (type && id && typeof global.openDetail === 'function') global.openDetail(type, id);
      });
    });
  }

  async function load() {
    ensureDom();
    setActive(true);
    var root = document.getElementById('eSimulatorRoot');
    var lang = (global.S && global.S.lang) || 'EN';
    if (state.data && state.lang === lang && Number(state.data.payload_version) === PAYLOAD_VERSION) {
      render();
      return;
    }
    if (root) root.innerHTML = '<div class="esim-loading">Loading E Simulator…</div>';
    try {
      var r = await fetch('/api/e_simulator?lang=' + encodeURIComponent(lang), { credentials: 'same-origin' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      if (data.error) throw new Error(data.error);
      state.data = data;
      state.lang = lang;
      if (!state.diagramId && data.diagrams && data.diagrams[0]) state.diagramId = data.diagrams[0].id;
      state.panel = 'stages';
      render();
    } catch (e) {
      if (root) root.innerHTML = '<div class="esim-loading esim-loading--err">E Simulator: ' + esc(String(e.message || e)) + '</div>';
    }
  }

  function hide() {
    setActive(false);
  }

  global.ESimulator = {
    load: load,
    hide: hide,
    setActive: setActive,
    getLogoUrl: function () { return (state.data && state.data.logo) || ''; },
    invalidate: function () { state.data = null; state.lang = null; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
