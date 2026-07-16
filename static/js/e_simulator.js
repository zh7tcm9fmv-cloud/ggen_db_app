/* E Simulator (Chronicle Event) Stages panel */
(function (global) {
  'use strict';

  var state = {
    data: null,
    lang: null,
    diagramId: null,
    reportOpen: false,
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

  function nodeById(diagram, nid) {
    var nodes = (diagram && diagram.nodes) || [];
    for (var i = 0; i < nodes.length; i++) {
      if (String(nodes[i].id) === String(nid)) return nodes[i];
    }
    return null;
  }

  function nextFocusNode(diagram) {
    if (!diagram) return null;
    var rec = null;
    var best = null;
    for (var i = 0; i < (diagram.nodes || []).length; i++) {
      var n = diagram.nodes[i];
      if (n.is_recommend) rec = n;
      if (!n.is_flavor_text && n.view_type !== 'flavor_middle' && n.view_type !== 'flavor_end') {
        if (!best || (n.recommend_order | 0) < (best.recommend_order | 0)) best = n;
      }
    }
    return rec || best;
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
      state.reportOpen = true;
      render();
      var el = document.getElementById('esimReportPanel');
      if (el) {
        var hit = el.querySelector('[data-doc-id="' + String(p.document_id || '') + '"]');
        if (hit) hit.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function renderMap(diagram) {
    if (!diagram) return '';
    var b = diagram.bounds || {};
    var padX = 220, padY = 180;
    var scale = 0.118;
    var w = Math.max(900, Math.ceil(((b.width || 8000) + padX * 2) * scale));
    var h = Math.max(420, Math.ceil(((b.height || 2500) + padY * 2) * scale));
    var minX = b.min_x || 0, minY = b.min_y || 0;

    function px(x) { return Math.round((x - minX + padX) * scale); }
    function py(y) {
      // Flip Y so game up is screen up.
      return Math.round((b.max_y - y + padY) * scale);
    }

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

    var nodesHtml = [];
    (diagram.nodes || []).forEach(function (n) {
      var pos = nodePos[String(n.id)];
      if (!pos) return;
      var vt = n.view_type || 'unknown';
      var size = n.size || 's';
      var cls = 'esim-node esim-node--' + size + ' esim-node--' + vt;
      if (n.is_flavor_text) cls += ' esim-node--flavor_text';
      if (n.is_recommend) cls += ' esim-node--recommend';
      var style = 'left:' + pos.x + 'px;top:' + pos.y + 'px';
      var body;
      if (n.is_flavor_text || vt === 'flavor_middle' || vt === 'flavor_end') {
        body = '<div class="esim-pill">' + esc(n.title || n.number || '…') + '</div>';
      } else {
        var thumb = n.thumb ? imgUrl(n.thumb) : '';
        var fallback = thumb.replace(/_l\.webp$/i, '_01.webp').replace(/_01\.webp$/i, '_02.webp');
        body =
          '<div class="esim-card">' +
          (thumb
            ? '<img class="esim-thumb" src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=\'' + esc(fallback) + '\'}else{this.style.opacity=.2}">'
            : '<div class="esim-thumb"></div>') +
          '<div class="esim-meta">' +
          (n.number ? '<div class="esim-num">' + esc(n.number) + '</div>' : '') +
          '<div class="esim-name">' + esc(n.title || '') + '</div>' +
          '</div></div>';
        if ((n.y | 0) !== 0 && (vt === 'document' || vt === 'battle')) {
          // Branch cue for off-spine nodes
          body += '<div class="esim-branch-mark">&lt; Branch</div>';
        }
      }
      nodesHtml.push(
        '<div class="' + cls + '" style="' + style + '" data-node-id="' + esc(String(n.id)) + '" role="button" tabindex="0">' +
        body + '</div>'
      );
    });

    var bg = diagram.background ? imgUrl(diagram.background) : '';
    return (
      '<div class="esim-map-shell" id="esimMapShell">' +
      '<div class="esim-map" id="esimMap" style="width:' + w + 'px;height:' + h + 'px">' +
      '<div class="esim-bg" style="' + (bg ? 'background-image:url(\'' + esc(bg) + '\')' : '') + '"></div>' +
      '<svg class="esim-edges" width="' + w + '" height="' + h + '" aria-hidden="true">' + edges.join('') + '</svg>' +
      '<div class="esim-nodes">' + nodesHtml.join('') + '</div>' +
      '</div></div>'
    );
  }

  function renderReports() {
    var docs = (state.data && state.data.documents) || [];
    var items = docs.map(function (d) {
      return (
        '<div class="esim-report-item" data-doc-id="' + esc(String(d.id)) + '">' +
        (d.thumb ? '<img src="' + esc(imgUrl(d.thumb)) + '" alt="" loading="lazy">' : '<img alt="">') +
        '<div><b>REPORT No.' + esc(String(d.number)) + '</b><span>' + esc(d.hint || '') + '</span></div></div>'
      );
    }).join('');
    return (
      '<div class="esim-report-panel' + (state.reportOpen ? ' open' : '') + '" id="esimReportPanel">' +
      '<h3>Report ' + esc(String(docs.length)) + '/' + esc(String(state.data.document_total || docs.length)) + '</h3>' +
      items + '</div>'
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

    var focus = nextFocusNode(diagram);
    var nextHtml = '';
    if (focus) {
      nextHtml =
        '<button type="button" class="esim-next" id="esimNextBtn" data-node-id="' + esc(String(focus.id)) + '">' +
        '<span class="esim-next-tag">NEXT</span>' +
        (focus.number ? '<div class="esim-next-num">' + esc(focus.number) + '</div>' : '') +
        '<div class="esim-next-name">' + esc(focus.title || '') + '</div></button>';
    }

    var logo = data.logo ? '<img class="esim-logo" src="' + esc(imgUrl(data.logo)) + '" alt="">' : '';
    var cpMax = (data.challenge_point && data.challenge_point.display_max) || 30;

    root.innerHTML =
      '<div class="esim-header">' +
      '<div class="esim-title-row">' + logo + '<div class="esim-title">' + esc(data.title || 'E Simulator') + '</div></div>' +
      '<div class="esim-cp"><span>Challenge Point</span><b>—/' + esc(String(cpMax)) + '</b></div>' +
      '</div>' +
      '<div class="esim-tabs" id="esimTabs">' + tabs + '</div>' +
      renderMap(diagram) +
      renderReports() +
      '<div class="esim-footer">' +
      '<div class="esim-story"><div class="esim-story-label">Story</div>' +
      '<div class="esim-story-bar"><div class="esim-story-fill" style="width:0%"></div></div>' +
      '<div class="esim-story-meta">Progress is account-based in-game · ' +
      esc(String((data.documents || []).length)) + ' Reports in master data</div></div>' +
      '<div class="esim-actions">' +
      '<div><span class="esim-btn-note">locked</span><button type="button" class="esim-btn is-locked" disabled><span class="esim-lock">🔒</span>Missions</button></div>' +
      '<div><span class="esim-btn-note">&nbsp;</span><button type="button" class="esim-btn" id="esimShopBtn">Shop</button></div>' +
      '<div><span class="esim-btn-note">' + esc(String((data.documents || []).length)) + '/' + esc(String(data.document_total || 0)) + '</span>' +
      '<button type="button" class="esim-btn" id="esimReportBtn">Report</button></div>' +
      '</div>' +
      nextHtml +
      '<div class="esim-ticker">' + esc((data.promotion_text || '').replace(/\n/g, ' ')) + '</div>' +
      '</div>';

    bind();
    focusRecommend();
  }

  function focusRecommend() {
    var shell = document.getElementById('esimMapShell');
    var rec = document.querySelector('#esimMap .esim-node--recommend') || document.querySelector('#esimMap .esim-node');
    if (!shell || !rec) return;
    var left = Math.max(0, rec.offsetLeft - shell.clientWidth * 0.35);
    var top = Math.max(0, rec.offsetTop - shell.clientHeight * 0.4);
    shell.scrollTo({ left: left, top: top, behavior: 'smooth' });
  }

  function bind() {
    var tabs = document.getElementById('esimTabs');
    if (tabs) {
      tabs.querySelectorAll('.esim-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.diagramId = btn.getAttribute('data-diagram-id');
          state.reportOpen = false;
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
    var next = document.getElementById('esimNextBtn');
    if (next) {
      next.addEventListener('click', function () {
        var diagram = currentDiagram();
        openNode(nodeById(diagram, next.getAttribute('data-node-id')));
      });
    }
    var rb = document.getElementById('esimReportBtn');
    if (rb) {
      rb.addEventListener('click', function () {
        state.reportOpen = !state.reportOpen;
        var panel = document.getElementById('esimReportPanel');
        if (panel) panel.classList.toggle('open', state.reportOpen);
      });
    }
    var shop = document.getElementById('esimShopBtn');
    if (shop) {
      shop.addEventListener('click', function () {
        alert(t('esim_shop_hint') || 'E Simulator Shop is in-game only for now.');
      });
    }
  }

  async function load() {
    ensureDom();
    setActive(true);
    var root = document.getElementById('eSimulatorRoot');
    var lang = (global.S && global.S.lang) || 'EN';
    if (state.data && state.lang === lang) {
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
    invalidate: function () { state.data = null; state.lang = null; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
