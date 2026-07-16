/* E Simulator (Chronicle Event) Stages panel */
(function (global) {
  'use strict';

  var PAYLOAD_VERSION = 7;
  var state = {
    data: null,
    lang: null,
    diagramId: null,
    docDetail: null,
    missionsOpen: false,
    missionTabId: null,
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

  /** Unity-style &lt;color=#RRGGBB&gt;…&lt;/color&gt; → HTML spans (escaped text). */
  function formatPromoHtml(raw) {
    var s = String(raw || '').replace(/\r?\n/g, ' ').trim();
    if (!s) return '';
    var out = '';
    var re = /<color\s*=\s*#([0-9A-Fa-f]{6})\s*>([\s\S]*?)<\/color>/g;
    var last = 0;
    var m;
    while ((m = re.exec(s))) {
      out += esc(s.slice(last, m.index));
      out += '<span style="color:#' + m[1] + '">' + esc(m[2]) + '</span>';
      last = m.index + m[0].length;
    }
    out += esc(s.slice(last));
    return out;
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

  function nodeById(diagram, nid) {
    var nodes = (diagram && diagram.nodes) || [];
    for (var i = 0; i < nodes.length; i++) {
      if (String(nodes[i].id) === String(nid)) return nodes[i];
    }
    return null;
  }

  function closeSidePanels(except) {
    if (except !== 'doc') state.docDetail = null;
    if (except !== 'missions') state.missionsOpen = false;
  }

  function findDocument(docId) {
    var docs = (state.data && state.data.documents) || [];
    for (var i = 0; i < docs.length; i++) {
      if (String(docs[i].id) === String(docId)) return docs[i];
    }
    return null;
  }

  function openNode(n) {
    if (!n) return;
    var p = n.primary || (n.contents && n.contents[0]) || null;
    if (!p) return;
    if ((p.type === 'battle' || p.type === 'story') && p.scenario_stage_id && typeof global.openDetail === 'function') {
      global.openDetail('stage', String(p.scenario_stage_id));
      return;
    }
    if (p.type === 'document') {
      var doc = findDocument(p.document_id) || {};
      state.docDetail = {
        id: p.document_id || doc.id || '',
        number: n.number || doc.number || p.document_number || '',
        title: n.title || doc.title || '',
        description: n.description || doc.description || '',
        hint: p.document_hint || doc.hint || '',
        thumb: n.thumb_detail || n.thumb || p.thumb_detail || p.thumb || doc.thumb || '',
      };
      closeSidePanels('doc');
      state.missionsOpen = false;
      render();
    }
  }

  function mapFitScale(bounds) {
    var b = bounds || {};
    var panel = document.getElementById('panel-stages') || document.getElementById('eSimulatorWrap');
    var panelW = Math.max(280, ((panel && panel.clientWidth) || window.innerWidth || 900) - 24);
    var narrow = panelW < 640;
    /* Pixel insets so centered cards stay inside the shell. */
    var edgePadX = narrow ? 48 : Math.max(72, Math.min(120, Math.round(panelW * 0.1)));
    var edgePadY = narrow ? 40 : 52;
    var availW = Math.max(200, panelW - edgePadX * 2);
    var spanX = Math.max(1, b.width || 8000);
    var spanY = Math.max(1, b.height || 2500);
    var roughX = availW / spanX;
    var padX = Math.max(280, Math.ceil(edgePadX / Math.max(0.04, roughX)));
    var padY = Math.max(260, Math.ceil(edgePadY / 0.18));
    var gw = spanX + padX * 2;
    var gh = spanY + padY * 2;
    /* Icon-only nodes are small — prefer fitting width; keep Y readable. */
    var scaleX = Math.max(0.045, Math.min(availW / gw, narrow ? 0.14 : 0.17));
    var scaleY = Math.max(narrow ? 0.16 : 0.18, Math.min(0.28, scaleX * (narrow ? 2.4 : 2.6)));
    var mapW = Math.min(availW, Math.ceil(gw * scaleX));
    var mapH = Math.ceil(gh * scaleY);
    var nodeScale = 1;
    return {
      scaleX: mapW / gw,
      scaleY: scaleY,
      padX: padX,
      padY: padY,
      availW: availW,
      mapW: mapW,
      mapH: mapH,
      nodeScale: nodeScale,
      edgePadX: edgePadX,
      edgePadY: edgePadY,
      shellH: mapH + edgePadY * 2,
      narrow: narrow,
    };
  }

  function thumbHtml(thumbPath, bgPath) {
    var thumb = thumbPath ? imgUrl(thumbPath) : '';
    if (!thumb) return '<div class="esim-thumb"></div>';
    var img =
      '<img class="esim-thumb" src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async" ' +
      'onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">';
    if (!bgPath) return img;
    return (
      '<div class="esim-thumb-stack esim-thumb-stack--large">' +
      '<img class="esim-thumb-bg" src="' + esc(imgUrl(bgPath)) + '" alt="" loading="lazy" decoding="async" ' +
      'onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">' +
      '<div class="esim-thumb-fg">' + img + '</div></div>'
    );
  }

  function renderMap(diagram) {
    if (!diagram) return '';
    var b = diagram.bounds || {};
    var fit = mapFitScale(b);
    var scaleX = fit.scaleX, scaleY = fit.scaleY;
    var padX = fit.padX, padY = fit.padY;
    var w = fit.mapW;
    var h = fit.mapH;
    var minX = b.min_x || 0;
    var maxY = b.max_y || 0;

    function px(x) { return Math.round((x - minX + padX) * scaleX); }
    function py(y) { return Math.round((maxY - y + padY) * scaleY); }

    var nodePos = {};
    (diagram.nodes || []).forEach(function (n) {
      nodePos[String(n.id)] = { x: px(n.x | 0), y: py(n.y | 0), n: n };
    });

    var edges = [];
    (diagram.edges || []).forEach(function (e) {
      var a = nodePos[String(e.from)], c = nodePos[String(e.to)];
      if (!a || !c) return;
      var branch = Math.abs((a.n.y | 0) - (c.n.y | 0)) > 200;
      edges.push(
        '<line class="esim-edge' + (branch ? ' esim-edge-branch' : '') +
        '" x1="' + a.x + '" y1="' + a.y + '" x2="' + c.x + '" y2="' + c.y + '"></line>'
      );
    });

    var branchIcon = (state.data && state.data.branch_icon) || '/static/images/Chronicle/UI_Chronicle_Icon_Branch_RedPurple.webp';
    var nodesHtml = [];
    (diagram.nodes || []).forEach(function (n) {
      var pos = nodePos[String(n.id)];
      if (!pos) return;
      var vt = n.view_type || 'unknown';
      var size = n.size || 's';
      var cls = 'esim-node esim-node--' + size + ' esim-node--' + vt;
      if (n.is_flavor_text) cls += ' esim-node--flavor_text';
      if (n.is_recommend) cls += ' esim-node--recommend';
      if (n.thumb_large || n.thumb_bg) cls += ' esim-node--art-l';
      var label = [n.number, n.title].filter(Boolean).join(' ').trim() || vt;
      var style = 'left:' + pos.x + 'px;top:' + pos.y + 'px';
      var body;
      if (n.is_flavor_text || vt === 'flavor_middle' || vt === 'flavor_end') {
        body = '<div class="esim-pill">' + esc(n.title || n.number || '…') + '</div>';
      } else if (vt === 'flavor_start') {
        body =
          '<div class="esim-card esim-card--flavor">' +
          thumbHtml(n.thumb, n.thumb_bg) +
          '<div class="esim-meta"><div class="esim-name">' + esc(n.title || '') + '</div></div></div>';
      } else {
        body =
          '<div class="esim-card esim-card--icon' + (n.thumb_bg ? ' esim-card--art-l' : '') + '">' +
          thumbHtml(n.thumb, n.thumb_bg) +
          '</div>';
        if ((n.y | 0) !== 0 && (vt === 'document' || vt === 'battle')) {
          body +=
            '<img class="esim-branch-mark" src="' + esc(imgUrl(branchIcon)) + '" alt="Branch" ' +
            'loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">';
        }
      }
      nodesHtml.push(
        '<div class="' + cls + '" style="' + style + '" data-node-id="' + esc(String(n.id)) +
        '" role="button" tabindex="0" title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
        body + '</div>'
      );
    });

    var bg = diagram.background ? imgUrl(diagram.background) : '';
    var ns = (Math.round(fit.nodeScale * 1000) / 1000).toFixed(3);
    return (
      '<div class="esim-map-shell' + (fit.narrow ? ' esim-map-shell--narrow' : '') +
      '" id="esimMapShell" style="height:' + fit.shellH + 'px;padding:' +
      fit.edgePadY + 'px ' + fit.edgePadX + 'px;--esim-node-scale:' + ns + '">' +
      '<div class="esim-map" id="esimMap" style="width:' + w + 'px;height:' + h + 'px">' +
      '<div class="esim-bg" style="' + (bg ? 'background-image:url(\'' + esc(bg) + '\')' : '') + '"></div>' +
      '<svg class="esim-edges" width="' + w + '" height="' + h + '" aria-hidden="true">' + edges.join('') + '</svg>' +
      '<div class="esim-nodes">' + nodesHtml.join('') + '</div>' +
      '</div></div>'
    );
  }

  function rewardChips(rewards) {
    var emedal = (state.data && state.data.e_medal_icon) || '/static/images/Item/event_exchange_item_0006.webp';
    return (rewards || []).slice(0, 4).map(function (r) {
      var name = r.name || r.label || '';
      var icon = r.icon || r.image || '';
      if (/e[\s-]?medal/i.test(name) || (!icon && /medal/i.test(name))) icon = emedal;
      var qty = r.quantity != null ? r.quantity : (r.count != null ? r.count : '');
      return (
        '<span class="esim-reward">' +
        (icon ? '<img src="' + esc(imgUrl(icon)) + '" alt="">' : '') +
        '<span>' + esc(name) + (qty !== '' && qty != null ? ' ×' + esc(String(qty)) : '') + '</span></span>'
      );
    }).join('');
  }

  function renderDocDetail() {
    var d = state.docDetail;
    if (!d) return '';
    var thumb = d.thumb ? imgUrl(d.thumb) : '';
    var title = (d.number ? (String(d.number) + ' ') : '') + (d.title || 'Report');
    return (
      '<div class="esim-side-backdrop" data-close="doc"></div>' +
      '<div class="esim-side-panel esim-doc-panel open" id="esimDocPanel" role="dialog" aria-label="Report detail">' +
      '<div class="esim-side-head"><h3>' + esc(title) + '</h3>' +
      '<button type="button" class="esim-side-close" data-close="doc" aria-label="Close">×</button></div>' +
      '<div class="esim-doc-art">' +
      (thumb
        ? '<img class="esim-doc-thumb" src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback&&gameImageUrlFallback(this)">'
        : '') +
      '</div>' +
      (d.description ? '<p class="esim-doc-desc">' + esc(d.description) + '</p>' : '') +
      (d.hint ? '<p class="esim-doc-hint">' + esc(d.hint) + '</p>' : '') +
      '</div>'
    );
  }

  function renderMissions() {
    var tabs = (state.data && state.data.mission_tabs) || [];
    var openCls = state.missionsOpen ? ' open' : '';
    var backdrop = state.missionsOpen
      ? '<div class="esim-side-backdrop" id="esimMissionsBackdrop" data-close="missions"></div>'
      : '';
    if (!tabs.length) {
      return (
        backdrop +
        '<div class="esim-side-panel esim-missions-panel' + openCls + '" id="esimMissionsPanel" role="dialog" aria-label="Missions">' +
        '<div class="esim-side-head"><h3>Missions</h3>' +
        '<button type="button" class="esim-side-close" data-close="missions" aria-label="Close">×</button></div>' +
        '<div class="esim-side-hint">No mission data found (m_chronicle_event_mission*).</div></div>'
      );
    }
    var tabId = state.missionTabId != null ? String(state.missionTabId) : String(tabs[0].id);
    var active = null;
    for (var i = 0; i < tabs.length; i++) {
      if (String(tabs[i].id) === tabId) { active = tabs[i]; break; }
    }
    if (!active) active = tabs[0];
    var tabBtns = tabs.map(function (tb) {
      var n = (tb.missions || []).length;
      return (
        '<button type="button" class="esim-mini-tab' + (String(tb.id) === String(active.id) ? ' active' : '') +
        '" data-mission-tab="' + esc(String(tb.id)) + '">' + esc(tb.name || tb.id) +
        ' (' + esc(String(n)) + ')</button>'
      );
    }).join('');
    var missions = active.missions || [];
    var rows = missions.map(function (m, idx) {
      return (
        '<div class="esim-mission-item">' +
        '<div class="esim-mission-idx">' + esc(String(idx + 1)) + '</div>' +
        '<div class="esim-mission-body"><b>' + esc(m.title || ('Mission ' + m.id)) + '</b>' +
        (m.description ? '<span class="esim-mission-desc">' + esc(m.description) + '</span>' : '') +
        '<div class="esim-mission-rewards">' + rewardChips(m.rewards) + '</div></div></div>'
      );
    }).join('') || '<div class="esim-side-hint">No missions in this tab.</div>';
    var hint = state.data.mission_unlock_hint
      ? '<div class="esim-side-hint">In-game unlock: ' + esc(state.data.mission_unlock_hint) + '</div>'
      : '';
    var complete = (state.data.mission_complete_rewards || []).map(function (rw) {
      return (
        '<div class="esim-mission-item esim-mission-complete">' +
        '<div class="esim-mission-idx">' + esc(String(rw.complete_rate | 0)) + '%</div>' +
        '<div class="esim-mission-body"><b>Mission progress ' + esc(String(rw.complete_rate)) + '%</b>' +
        '<div class="esim-mission-rewards">' + rewardChips(rw.rewards) + '</div></div></div>'
      );
    }).join('');
    var completeBlock = complete
      ? '<div class="esim-side-subhead">Completion rewards</div>' + complete
      : '';
    return (
      backdrop +
      '<div class="esim-side-panel esim-missions-panel' + openCls + '" id="esimMissionsPanel" role="dialog" aria-label="Missions">' +
      '<div class="esim-side-head"><h3>Missions (' + esc(String(missions.length)) + ')</h3>' +
      '<button type="button" class="esim-side-close" data-close="missions" aria-label="Close">×</button></div>' +
      hint +
      '<div class="esim-mini-tabs">' + tabBtns + '</div>' +
      rows + completeBlock + '</div>'
    );
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
    var tabs = (data.diagrams || []).map(function (d) {
      var active = String(d.id) === String(state.diagramId);
      return (
        '<button type="button" class="esim-tab' + (active ? ' active' : '') + '" data-diagram-id="' + esc(String(d.id)) + '">' +
        (d.tab_thumb ? '<img src="' + esc(imgUrl(d.tab_thumb)) + '" alt="">' : '') +
        '<span>' + esc(d.name || d.id) + '</span></button>'
      );
    }).join('');

    var logo = data.logo ? '<img class="esim-logo" src="' + esc(imgUrl(data.logo)) + '" alt="E Simulator">' : '';
    var missionN = data.mission_total != null
      ? data.mission_total
      : (data.mission_tabs || []).reduce(function (sum, tb) { return sum + ((tb.missions || []).length); }, 0);

    root.innerHTML =
      '<div class="esim-header">' +
      '<div class="esim-title-row">' + logo + '</div>' +
      '</div>' +
      '<div class="esim-tabs" id="esimTabs">' + tabs + '</div>' +
      renderMap(diagram) +
      renderDocDetail() +
      renderMissions() +
      '<div class="esim-footer">' +
      '<div class="esim-actions">' +
      '<div><span class="esim-btn-note">' + esc(String(missionN)) + '</span>' +
      '<button type="button" class="esim-btn' + (state.missionsOpen ? ' active' : '') + '" id="esimMissionsBtn">Missions</button></div>' +
      '</div>' +
      '<div class="esim-ticker">' + formatPromoHtml(data.promotion_text || '') + '</div>' +
      '</div>';

    bind();
    if (typeof global.syncStageEsimSourceButton === 'function') global.syncStageEsimSourceButton();
  }

  function bind() {
    var tabs = document.getElementById('esimTabs');
    if (tabs) {
      tabs.querySelectorAll('.esim-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.diagramId = btn.getAttribute('data-diagram-id');
          closeSidePanels();
          render();
        });
      });
    }
    document.querySelectorAll('#esimMap .esim-node').forEach(function (el) {
      el.addEventListener('click', function () {
        var diagram = currentDiagram();
        openNode(nodeById(diagram, el.getAttribute('data-node-id')));
      });
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          el.click();
        }
      });
    });
    var mb = document.getElementById('esimMissionsBtn');
    if (mb) {
      mb.addEventListener('click', function () {
        var next = !state.missionsOpen;
        closeSidePanels(next ? 'missions' : null);
        state.missionsOpen = next;
        if (next && !state.missionTabId && state.data && state.data.mission_tabs && state.data.mission_tabs[0]) {
          state.missionTabId = String(state.data.mission_tabs[0].id);
        }
        render();
      });
    }
    document.querySelectorAll('.esim-side-close, .esim-side-backdrop').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var which = btn.getAttribute('data-close');
        if (which === 'doc') state.docDetail = null;
        if (which === 'missions') state.missionsOpen = false;
        render();
      });
    });
    document.querySelectorAll('[data-mission-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.missionTabId = btn.getAttribute('data-mission-tab');
        state.missionsOpen = true;
        render();
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
    if (root) root.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(200,230,255,.7)">Loading E Simulator…</div>';
    try {
      var r = await fetch('/api/e_simulator?lang=' + encodeURIComponent(lang), { credentials: 'same-origin' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      if (data.error) throw new Error(data.error);
      state.data = data;
      state.lang = lang;
      if (!state.diagramId && data.diagrams && data.diagrams[0]) state.diagramId = data.diagrams[0].id;
      if (data.mission_tabs && data.mission_tabs[0]) {
        state.missionTabId = String(data.mission_tabs[0].id);
      }
      render();
    } catch (e) {
      if (root) root.innerHTML = '<div style="padding:40px;color:#f88">E Simulator: ' + esc(String(e.message || e)) + '</div>';
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
