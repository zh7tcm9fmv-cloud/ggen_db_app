/* E Simulator (Chronicle Event) Stages panel */
(function (global) {
  'use strict';

  var state = {
    data: null,
    lang: null,
    diagramId: null,
    reportOpen: false,
    missionsOpen: false,
    shopOpen: false,
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
    if (except !== 'report') state.reportOpen = false;
    if (except !== 'missions') state.missionsOpen = false;
    if (except !== 'shop') state.shopOpen = false;
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
      closeSidePanels('report');
      state.reportOpen = true;
      render();
      var el = document.getElementById('esimReportPanel');
      if (el) {
        var hit = el.querySelector('[data-doc-id="' + String(p.document_id || '') + '"]');
        if (hit) hit.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  function mapFitScale(bounds) {
    var b = bounds || {};
    var padX = 90, padY = 70;
    var gw = Math.max(1, (b.width || 8000) + padX * 2);
    var gh = Math.max(1, (b.height || 2500) + padY * 2);
    var panel = document.getElementById('panel-stages') || document.getElementById('eSimulatorWrap');
    var availW = Math.max(560, (panel && panel.clientWidth) || window.innerWidth || 900) - 28;
    var availH = Math.max(300, Math.min(Math.floor(window.innerHeight * 0.48), 460));
    var sx = availW / gw;
    var sy = availH / gh;
    /* Independent axes so the whole route fits without scrolling. */
    return {
      scaleX: Math.max(0.08, Math.min(sx, 0.28)),
      scaleY: Math.max(0.08, Math.min(sy, 0.32)),
      padX: padX,
      padY: padY,
      availW: availW,
      availH: availH,
    };
  }

  function thumbHtml(thumbPath, fallbackPath, bgPath) {
    var thumb = thumbPath ? imgUrl(thumbPath) : '';
    if (!thumb) return '<div class="esim-thumb"></div>';
    var fallback = fallbackPath ? imgUrl(fallbackPath) : thumb
      .replace(/_l_02\.webp$/i, '_l_01.webp')
      .replace(/_02\.webp$/i, '_01.webp');
    var img =
      '<img class="esim-thumb" src="' + esc(thumb) + '" alt="" loading="lazy" decoding="async" ' +
      'onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=\'' + esc(fallback) + '\'}else{this.style.opacity=.25}">';
    if (!bgPath) return img;
    return (
      '<div class="esim-thumb-stack">' +
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
    var w = Math.max(fit.availW, Math.ceil(((b.width || 8000) + padX * 2) * scaleX));
    var h = Math.max(fit.availH, Math.ceil(((b.height || 2500) + padY * 2) * scaleY));
    /* Prefer fitting inside the shell (no scroll) when possible. */
    w = Math.min(w, fit.availW);
    h = Math.min(h, fit.availH);
    var minX = b.min_x || 0;
    var maxY = b.max_y || 0;
    var spanX = Math.max(1, (b.width || 8000) + padX * 2);
    var spanY = Math.max(1, (b.height || 2500) + padY * 2);
    scaleX = w / spanX;
    scaleY = h / spanY;

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
      } else if (vt === 'flavor_start') {
        body =
          '<div class="esim-card esim-card--flavor">' +
          thumbHtml(n.thumb, null, n.thumb_bg) +
          '<div class="esim-meta"><div class="esim-name">' + esc(n.title || '') + '</div></div></div>';
      } else {
        body =
          '<div class="esim-card">' +
          thumbHtml(n.thumb, null, n.thumb_bg) +
          '<div class="esim-meta">' +
          (n.number ? '<div class="esim-num">' + esc(n.number) + '</div>' : '') +
          '<div class="esim-name">' + esc(n.title || '') + '</div>' +
          '</div></div>';
        if ((n.y | 0) !== 0 && (vt === 'document' || vt === 'battle')) {
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

  function rewardChips(rewards) {
    return (rewards || []).slice(0, 4).map(function (r) {
      var icon = r.icon || r.image || '';
      var name = r.name || r.label || '';
      var qty = r.quantity != null ? r.quantity : (r.count != null ? r.count : '');
      return (
        '<span class="esim-reward">' +
        (icon ? '<img src="' + esc(imgUrl(icon)) + '" alt="">' : '') +
        '<span>' + esc(name) + (qty !== '' && qty != null ? ' ×' + esc(String(qty)) : '') + '</span></span>'
      );
    }).join('');
  }

  function renderReports() {
    var docs = (state.data && state.data.documents) || [];
    var items = docs.map(function (d) {
      var thumb = d.thumb || d.thumb_small || '';
      return (
        '<div class="esim-report-item" data-doc-id="' + esc(String(d.id)) + '">' +
        (thumb ? '<img src="' + esc(imgUrl(thumb)) + '" alt="" loading="lazy">' : '<img alt="">') +
        '<div><b>REPORT No.' + esc(String(d.number)) + '</b><span>' + esc(d.hint || '') + '</span></div></div>'
      );
    }).join('');
    return (
      '<div class="esim-side-panel esim-report-panel' + (state.reportOpen ? ' open' : '') + '" id="esimReportPanel">' +
      '<div class="esim-side-head"><h3>Report ' + esc(String(docs.length)) + '/' + esc(String(state.data.document_total || docs.length)) + '</h3>' +
      '<button type="button" class="esim-side-close" data-close="report" aria-label="Close">×</button></div>' +
      items + '</div>'
    );
  }

  function renderMissions() {
    var tabs = (state.data && state.data.mission_tabs) || [];
    if (!tabs.length) {
      return '<div class="esim-side-panel' + (state.missionsOpen ? ' open' : '') + '" id="esimMissionsPanel"></div>';
    }
    var tabId = state.missionTabId || String(tabs[0].id);
    var active = null;
    for (var i = 0; i < tabs.length; i++) {
      if (String(tabs[i].id) === String(tabId)) { active = tabs[i]; break; }
    }
    if (!active) active = tabs[0];
    var tabBtns = tabs.map(function (tb) {
      return (
        '<button type="button" class="esim-mini-tab' + (String(tb.id) === String(active.id) ? ' active' : '') +
        '" data-mission-tab="' + esc(String(tb.id)) + '">' + esc(tb.name || tb.id) + '</button>'
      );
    }).join('');
    var rows = (active.missions || []).map(function (m, idx) {
      return (
        '<div class="esim-mission-item">' +
        '<div class="esim-mission-idx">' + esc(String(idx + 1)) + '</div>' +
        '<div class="esim-mission-body"><b>' + esc(m.title || ('Mission ' + m.id)) + '</b>' +
        '<div class="esim-mission-rewards">' + rewardChips(m.rewards) + '</div></div></div>'
      );
    }).join('');
    var hint = state.data.mission_unlock_hint
      ? '<div class="esim-side-hint">In-game: ' + esc(state.data.mission_unlock_hint) + '</div>'
      : '';
    return (
      '<div class="esim-side-panel' + (state.missionsOpen ? ' open' : '') + '" id="esimMissionsPanel">' +
      '<div class="esim-side-head"><h3>Missions</h3>' +
      '<button type="button" class="esim-side-close" data-close="missions" aria-label="Close">×</button></div>' +
      hint +
      '<div class="esim-mini-tabs">' + tabBtns + '</div>' +
      rows + '</div>'
    );
  }

  function renderShop() {
    var shop = (state.data && state.data.shop) || {};
    var items = shop.items || [];
    var curIcon = shop.currency_icon ? imgUrl(shop.currency_icon) : '';
    var head =
      '<div class="esim-side-head"><h3>' + esc(shop.name || 'Shop') + '</h3>' +
      '<button type="button" class="esim-side-close" data-close="shop" aria-label="Close">×</button></div>' +
      '<div class="esim-shop-currency">' +
      (curIcon ? '<img src="' + esc(curIcon) + '" alt="">' : '') +
      '<span>' + esc(shop.currency_name || 'Event Currency') + '</span>' +
      '<small>Browse-only (purchases are in-game)</small></div>';
    var rows = items.map(function (it) {
      var icon = it.icon ? imgUrl(it.icon) : '';
      return (
        '<div class="esim-shop-item">' +
        (icon ? '<img class="esim-shop-icon" src="' + esc(icon) + '" alt="">' : '<div class="esim-shop-icon"></div>') +
        '<div class="esim-shop-body"><b>' + esc(it.name || ('Item ' + it.id)) + '</b>' +
        '<div class="esim-mission-rewards">' + rewardChips(it.rewards) + '</div>' +
        '<div class="esim-shop-cost">' + esc(String(it.cost || 0)) +
        (it.purchase_limit ? ' · limit ' + esc(String(it.purchase_limit)) : '') +
        '</div></div></div>'
      );
    }).join('') || '<div class="esim-side-hint">No shop items found.</div>';
    return (
      '<div class="esim-side-panel' + (state.shopOpen ? ' open' : '') + '" id="esimShopPanel">' +
      head + rows + '</div>'
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
    var cpMax = (data.challenge_point && data.challenge_point.display_max) || 30;
    var docN = (data.documents || []).length;
    var docT = data.document_total || docN;

    root.innerHTML =
      '<div class="esim-header">' +
      '<div class="esim-title-row">' + logo + '</div>' +
      '<div class="esim-cp"><span>Challenge Point</span><b>—/' + esc(String(cpMax)) + '</b></div>' +
      '</div>' +
      '<div class="esim-tabs" id="esimTabs">' + tabs + '</div>' +
      renderMap(diagram) +
      renderReports() +
      renderMissions() +
      renderShop() +
      '<div class="esim-footer">' +
      '<div class="esim-story"><div class="esim-story-label">Story</div>' +
      '<div class="esim-story-bar"><div class="esim-story-fill" style="width:0%"></div></div>' +
      '<div class="esim-story-meta">Progress is account-based in-game · ' +
      esc(String(docN)) + ' Reports in master data</div></div>' +
      '<div class="esim-actions">' +
      '<div><button type="button" class="esim-btn' + (state.missionsOpen ? ' active' : '') + '" id="esimMissionsBtn">Missions</button></div>' +
      '<div><button type="button" class="esim-btn' + (state.shopOpen ? ' active' : '') + '" id="esimShopBtn">Shop</button></div>' +
      '<div><span class="esim-btn-note">' + esc(String(docN)) + '/' + esc(String(docT)) + '</span>' +
      '<button type="button" class="esim-btn' + (state.reportOpen ? ' active' : '') + '" id="esimReportBtn">Report</button></div>' +
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
    var rb = document.getElementById('esimReportBtn');
    if (rb) {
      rb.addEventListener('click', function () {
        var next = !state.reportOpen;
        closeSidePanels(next ? 'report' : null);
        state.reportOpen = next;
        render();
      });
    }
    var mb = document.getElementById('esimMissionsBtn');
    if (mb) {
      mb.addEventListener('click', function () {
        var next = !state.missionsOpen;
        closeSidePanels(next ? 'missions' : null);
        state.missionsOpen = next;
        render();
      });
    }
    var shop = document.getElementById('esimShopBtn');
    if (shop) {
      shop.addEventListener('click', function () {
        var next = !state.shopOpen;
        closeSidePanels(next ? 'shop' : null);
        state.shopOpen = next;
        render();
      });
    }
    document.querySelectorAll('.esim-side-close').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var which = btn.getAttribute('data-close');
        if (which === 'report') state.reportOpen = false;
        if (which === 'missions') state.missionsOpen = false;
        if (which === 'shop') state.shopOpen = false;
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
      if (!state.missionTabId && data.mission_tabs && data.mission_tabs[0]) {
        state.missionTabId = data.mission_tabs[0].id;
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
