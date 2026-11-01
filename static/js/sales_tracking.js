/* /tracking — live country App Store sales-rank trail */
(function () {
  'use strict';

  var T = {
    EN: {
      eyebrow: 'Live · Store sales',
      title: 'Sales Rank Tracking',
      sub: 'Track Eternal’s App Store top-grossing rank by country during a new Unit Assembly window (about 24 hours).',
      note: 'Trail = Apple App Store top-grossing (iOS only — not Android / not official gem #1). Game-i 「本日」 = gem-race cross-check. Apple #1 alone ≠ confirmed gem #1.',
      chartLbl: 'Chart',
      overall: 'Overall',
      games: 'Games',
      windowLbl: 'Window',
      h24: '24h',
      h36: '36h',
      chartTitle: 'Rank over time',
      chartHint: 'Solid = Apple App Store · dashed = Game-i 「本日」 · top = #1 · hover for both',
      empty: 'Collecting samples… denser on Unit Assembly day (+ ~3 days); otherwise ~every 10 min.',
      updated: 'Updated',
      gamei: 'Game-i today',
      apple: 'Apple',
      out: 'Out of top 200',
      statusIdle: 'Auto: ~every 10 min · page refreshes every 60s.',
      statusActive: 'Dense sampling (gacha window, ~5 min) · page refreshes every 60s.',
      statusErr: 'Last sampler note',
      legendToggle: 'Toggle series',
      legendKey: 'Solid Apple · dashed Game-i',
      navTracking: 'Tracking',
      back: 'Back',
      hoverWas: 'was',
      hoverNow: 'now',
      gemWarn: 'Game-i not #1 — don’t claim gem #1 yet'
    },
    TW: {
      eyebrow: '即時 · 商店銷售',
      title: '銷售排名追蹤',
      sub: '在新機體補給開放約 24 小時內，追蹤各地 App Store 銷售排行。',
      note: '軌跡＝Apple App Store 銷售榜（僅 iOS，不含 Android，亦非官方寶石第 1 判定）。Game-i「本日」＝寶石活動對照。單看 Apple #1 ≠ 已確認。',
      chartLbl: '榜單',
      overall: '綜合',
      games: '遊戲',
      windowLbl: '區間',
      h24: '24小時',
      h36: '36小時',
      chartTitle: '排名軌跡',
      chartHint: '實線＝Apple App Store · 虛線＝Game-i「本日」 · 最上＝第 1 · 懸停看兩者',
      empty: '正在蒐集樣本…機體補給當日（＋約 3 天）取樣更密；平時約每 10 分鐘。',
      updated: '更新',
      gamei: 'Game-i 本日',
      apple: 'Apple',
      out: '未進前 200',
      statusIdle: '自動：約每 10 分鐘取樣 · 本頁每 60 秒刷新。',
      statusActive: '密集取樣中（卡池窗口，約 5 分鐘）· 本頁每 60 秒刷新。',
      statusErr: '取樣備註',
      legendToggle: '顯示／隱藏',
      legendKey: '實線 Apple · 虛線 Game-i',
      navTracking: '追蹤',
      back: '返回',
      hoverWas: '前次',
      hoverNow: '當下',
      gemWarn: 'Game-i 非第 1 — 先別宣稱寶石第 1'
    },
    HK: {
      eyebrow: '即時 · 商店銷售',
      title: '銷售排名追蹤',
      sub: '喺新機體補給開放約 24 小時內，追蹤各地 App Store 銷售排行。',
      note: '軌跡＝Apple App Store 銷售榜（淨係 iOS，唔包 Android，亦唔係官方寶石第 1）。Game-i「本日」＝寶石活動對照。淨係 Apple #1 ≠ 已確認。',
      chartLbl: '榜單',
      overall: '綜合',
      games: '遊戲',
      windowLbl: '區間',
      h24: '24小時',
      h36: '36小時',
      chartTitle: '排名軌跡',
      chartHint: '實線＝Apple App Store · 虛線＝Game-i「本日」 · 最上＝第 1 · 懸停睇兩者',
      empty: '正在收集樣本…機體補給當日（＋約 3 日）更密；平時約每 10 分鐘。',
      updated: '更新',
      gamei: 'Game-i 本日',
      apple: 'Apple',
      out: '未入前 200',
      statusIdle: '自動：約每 10 分鐘取樣 · 本頁每 60 秒刷新。',
      statusActive: '密集取樣中（卡池窗口，約 5 分鐘）· 本頁每 60 秒刷新。',
      statusErr: '取樣備註',
      legendToggle: '顯示／隱藏',
      legendKey: '實線 Apple · 虛線 Game-i',
      navTracking: '追蹤',
      back: '返回',
      hoverWas: '前次',
      hoverNow: '當下',
      gemWarn: 'Game-i 唔係第 1 — 唔好即認寶石第 1'
    },
    JA: {
      eyebrow: 'ライブ · セールス',
      title: 'セルラン追跡',
      sub: '新ユニットアセンブリ開始から約24時間、国別App Storeトップセールス順位を追跡します。',
      note: 'トレイル＝Apple App Store売上（iOSのみ／Android含まず／公式ダイヤ1位判定ではない）。Game-i「本日」＝ダイヤ判定の照合。Apple単独#1＝確定ではない。',
      chartLbl: 'チャート',
      overall: '総合',
      games: 'ゲーム',
      windowLbl: '期間',
      h24: '24時間',
      h36: '36時間',
      chartTitle: '順位トレイル',
      chartHint: '実線＝Apple · 破線＝Game-i「本日」 · 最上＝1位 · ホバーで両方',
      empty: 'サンプル収集中…ユニットアセンブリ当日（＋約3日）は密。平時は約10分ごと。',
      updated: '更新',
      gamei: 'Game-i 本日',
      apple: 'Apple',
      out: 'トップ200外',
      statusIdle: '自動：約10分ごと · ページは60秒更新。',
      statusActive: '密サンプリング中（ガチャ窓・約5分）· ページは60秒更新。',
      statusErr: 'サンプラーメモ',
      legendToggle: '表示切替',
      legendKey: '実線 Apple · 破線 Game-i',
      navTracking: '追跡',
      back: '戻る',
      hoverWas: '直前',
      hoverNow: '現在',
      gemWarn: 'Game-iが1位でない — ダイヤ1位と断定しない'
    }
  };
  T.KR = Object.assign({}, T.EN);

  var state = {
    lang: 'EN',
    chart: 'overall',
    hours: 24,
    hidden: {},
    data: null,
    timer: null,
    drawing: false,
    bound: false,
    booted: false,
    chartHit: null
  };

  function readLang() {
    try {
      var l = String(localStorage.getItem('ggen_lang') || 'EN').trim().toUpperCase();
      if (l === 'JP') l = 'JA';
      if (l === 'HR') l = 'KR';
      if (!T[l]) l = 'EN';
      return l;
    } catch (_) {
      return 'EN';
    }
  }

  function t(key) {
    var pack = T[state.lang] || T.EN;
    return pack[key] != null ? pack[key] : (T.EN[key] || key);
  }

  function applyCopy() {
    var map = {
      trkEyebrow: 'eyebrow',
      trkTitle: 'title',
      trkSub: 'sub',
      trkNote: 'note',
      trkChartLbl: 'chartLbl',
      trkChipOverall: 'overall',
      trkChipGames: 'games',
      trkWindowLbl: 'windowLbl',
      trkChip24: 'h24',
      trkChip36: 'h36',
      trkChartTitle: 'chartTitle',
      trkChartHint: 'chartHint'
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = t(map[id]);
    });
    var back = document.getElementById('trkBackBtn');
    if (back) back.textContent = t('back');
  }

  function sortCountriesByRank(countries, latest) {
    latest = latest || {};
    return (countries || []).slice().sort(function (a, b) {
      var ra = (latest[a.code] || {}).rank;
      var rb = (latest[b.code] || {}).rank;
      var aOut = ra == null;
      var bOut = rb == null;
      if (aOut !== bOut) return aOut ? 1 : -1;
      if (!aOut && !bOut && ra !== rb) return ra - rb;
      return String(a.code).localeCompare(String(b.code));
    });
  }

  function applyOutOfChartDefaults(data) {
    if (state._dimDefaultsDone) return;
    var latest = (data && data.latest) || {};
    ['sg', 'kr'].forEach(function (code) {
      var row = latest[code] || {};
      if (row.rank == null && !Object.prototype.hasOwnProperty.call(state.hidden, code)) {
        state.hidden[code] = true;
      }
    });
    state._dimDefaultsDone = true;
  }

  function fmtTime(ms) {
    if (!ms) return '—';
    try {
      return new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return String(ms);
    }
  }

  function countryLabel(c) {
    var code = c.code;
    var label = state.lang === 'JA' ? c.label_ja : c.label_en;
    if (state.lang === 'TW' || state.lang === 'HK') {
      if (code === 'hk') label = '香港';
      else if (code === 'mo') label = '澳門';
      else if (code === 'tw') label = state.lang === 'HK' ? '台灣' : '台灣';
      else if (code === 'jp') label = '日本';
      else if (code === 'sg') label = '新加坡';
      else if (code === 'kr') label = '韓國';
    }
    return label;
  }

  function haroUrl(rank) {
    var A = window.__TRK_ASSETS__ || {};
    if (rank === 1) return A.haroGold || '';
    if (rank === 2) return A.haroSilver || '';
    if (rank === 3) return A.haroBronze || '';
    return '';
  }

  function renderLiveCards(data) {
    var root = document.getElementById('trkLive');
    if (!root) return;
    var latest = (data && data.latest) || {};
    var countries = sortCountriesByRank((data && data.countries) || [], latest);
    var html = '';
    countries.forEach(function (c) {
      var code = c.code;
      var row = latest[code] || {};
      var rank = row.rank;
      var isTop = rank === 1;
      var gemDisagree = isTop && row.gamei_today != null && row.gamei_today !== 1;
      var label = countryLabel(c);
      var rankTxt = rank != null ? '#' + rank : t('out');
      var metaBits = [];
      if (rank != null) metaBits.push(t('apple'));
      if (row.gamei_today != null) metaBits.push(t('gamei') + ' #' + row.gamei_today);
      else if (rank == null && row.t) metaBits.push(t('updated') + ' ' + fmtTime(row.t));
      if (gemDisagree) metaBits.push(t('gemWarn'));
      var meta = metaBits.join(' · ');
      var haro = haroUrl(rank);
      html +=
        '<article class="trk-live-card' +
        (isTop ? ' is-top1' : '') +
        (gemDisagree ? ' is-gem-warn' : '') +
        '" data-code="' +
        code +
        '"' +
        (rank != null ? ' data-rank="' + rank + '"' : '') +
        '>' +
        '<div class="trk-live-plate" aria-hidden="true"></div>' +
        '<div class="trk-live-body">' +
        '<div class="trk-live-cc">' +
        esc(label) +
        '</div>' +
        '<div class="trk-live-rank-row">' +
        (haro
          ? '<img class="trk-haro" src="' + esc(haro) + '" alt="" width="36" height="36" decoding="async">'
          : '') +
        '<div class="trk-live-rank' +
        (rank == null ? ' is-null' : '') +
        '">' +
        esc(rankTxt) +
        '</div></div>' +
        (meta ? '<div class="trk-live-meta">' + esc(meta) + '</div>' : '') +
        '</div></article>';
    });
    root.innerHTML = html;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderLegend(data) {
    var root = document.getElementById('trkLegend');
    if (!root) return;
    var latest = (data && data.latest) || {};
    var countries = sortCountriesByRank((data && data.countries) || [], latest);
    var key =
      '<span class="trk-legend-key" aria-hidden="true">' +
      '<span class="trk-legend-swatch"></span><span class="trk-legend-swatch trk-legend-swatch--dash"></span>' +
      esc(t('legendKey')) +
      '</span>';
    root.innerHTML =
      key +
      countries
        .map(function (c) {
          var off = state.hidden[c.code] ? ' is-off' : '';
          var oot = (latest[c.code] || {}).rank == null ? ' is-oot' : '';
          var label = countryLabel(c);
          return (
            '<button type="button" class="trk-legend-item' +
            off +
            oot +
            '" data-code="' +
            c.code +
            '" title="' +
            esc(t('legendToggle')) +
            '"><span class="trk-legend-swatch" aria-hidden="true"></span>' +
            esc(label) +
            '</button>'
          );
        })
        .join('');
  }

  function buildPath(pts, x0, y0, w, h, tMin, tMax, rMax, rankKey) {
    rankKey = rankKey || 'rank';
    var usable = pts.filter(function (p) {
      return p && p[rankKey] != null && p.t != null;
    });
    if (usable.length < 1) return { d: '', last: null };
    var spanT = Math.max(1, tMax - tMin);
    var spanR = Math.max(1, rMax - 1);
    var d = '';
    var last = null;
    usable.forEach(function (p, i) {
      var rk = p[rankKey];
      var x = x0 + ((p.t - tMin) / spanT) * w;
      // Exact rank Y — never fake-offset (so #2 never sits on the #1 grid).
      var y = y0 + ((rk - 1) / spanR) * h;
      last = { x: x, y: y, rank: rk };
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    });
    return { d: d, last: last };
  }

  function renderChart(data) {
    var wrap = document.getElementById('trkChart');
    var empty = document.getElementById('trkEmpty');
    if (!wrap) return;
    var series = (data && data.series) || {};
    var countries = (data && data.countries) || [];
    var allPts = [];
    countries.forEach(function (c) {
      if (state.hidden[c.code]) return;
      (series[c.code] || []).forEach(function (p) {
        if (!p || p.t == null) return;
        if (p.rank != null) allPts.push({ t: p.t, rank: p.rank });
        if (p.gamei_today != null) allPts.push({ t: p.t, rank: p.gamei_today });
      });
    });
    if (!allPts.length) {
      wrap.innerHTML = '';
      if (empty) {
        empty.hidden = false;
        empty.textContent = t('empty');
      }
      return;
    }
    if (empty) empty.hidden = true;

    var host = wrap.parentElement && wrap.parentElement.classList.contains('trk-chart-wrap') ? wrap.parentElement : wrap;
    var W = Math.max(320, Math.floor(host.clientWidth || wrap.clientWidth || 800));
    var H = Math.max(280, Math.floor(host.clientHeight || wrap.clientHeight || 360));
    var padL = 40;
    // Extra right gutter so end labels (#2 vs #3) can sit past the line without colliding.
    var padR = 72;
    var padT = 16;
    var padB = 28;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var tMin = Math.min.apply(
      null,
      allPts.map(function (p) {
        return p.t;
      })
    );
    var tMax = Math.max.apply(
      null,
      allPts.map(function (p) {
        return p.t;
      })
    );
    if (tMax <= tMin) tMax = tMin + 1;
    var rMax = 1;
    allPts.forEach(function (p) {
      if (p.rank > rMax) rMax = p.rank;
    });
    rMax = Math.max(5, Math.ceil(rMax / 5) * 5);

    var grid = '';
    var yTicks = [1];
    var step = rMax <= 20 ? 5 : rMax <= 50 ? 10 : 25;
    for (var r = step; r <= rMax; r += step) yTicks.push(r);
    if (yTicks[yTicks.length - 1] !== rMax) yTicks.push(rMax);
    yTicks.forEach(function (rk) {
      var y = padT + ((rk - 1) / Math.max(1, rMax - 1)) * plotH;
      grid +=
        '<line x1="' +
        padL +
        '" y1="' +
        y.toFixed(1) +
        '" x2="' +
        (padL + plotW) +
        '" y2="' +
        y.toFixed(1) +
        '"/>';
      grid +=
        '<text class="trk-y" x="' +
        (padL - 8) +
        '" y="' +
        (y + 4).toFixed(1) +
        '" text-anchor="end" fill="#9eb6d4">#' +
        rk +
        '</text>';
    });
    var xLabels = '';
    for (var i = 0; i < 4; i++) {
      var tt = tMin + ((tMax - tMin) * i) / 3;
      var x = padL + ((tt - tMin) / (tMax - tMin)) * plotW;
      xLabels +=
        '<text class="trk-x" x="' +
        x.toFixed(1) +
        '" y="' +
        (H - 8) +
        '" text-anchor="middle" fill="#9eb6d4">' +
        esc(fmtTime(tt)) +
        '</text>';
    }

    var fillMap = {
      hk: '#00d4ff',
      mo: '#e8c56a',
      tw: '#ff9d00',
      jp: '#ff5c7a',
      sg: '#3ddc97',
      kr: '#a78bfa'
    };
    var trails = '';
    var endMarks = [];
    var hitSeries = {};
    var spanT = Math.max(1, tMax - tMin);
    var spanR = Math.max(1, rMax - 1);
    countries.forEach(function (c) {
      if (state.hidden[c.code]) return;
      var raw = series[c.code] || [];
      var pts = raw.filter(function (p) {
        return p && p.rank != null && p.t != null;
      });
      var gPts = raw.filter(function (p) {
        return p && p.gamei_today != null && p.t != null;
      });
      var built = buildPath(pts, padL, padT, plotW, plotH, tMin, tMax, rMax, 'rank');
      var gBuilt = buildPath(gPts, padL, padT, plotW, plotH, tMin, tMax, rMax, 'gamei_today');
      var col = fillMap[c.code] || '#00d4ff';
      var sw = c.code === 'hk' || c.code === 'mo' ? '3.25' : '2.5';
      if (gBuilt.d) {
        // Game-i under Apple so solid country lines stay readable.
        trails +=
          '<path class="trk-trail trk-trail--gamei trk-trail--' +
          c.code +
          '" data-code="' +
          c.code +
          '" data-src="gamei" fill="none" stroke="' +
          col +
          '" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5 4" opacity="0.72" d="' +
          gBuilt.d +
          '" />';
      }
      if (built.d) {
        trails +=
          '<path class="trk-trail trk-trail--' +
          c.code +
          '" data-code="' +
          c.code +
          '" data-src="apple" fill="none" stroke="' +
          col +
          '" stroke-width="' +
          sw +
          '" stroke-linecap="round" stroke-linejoin="round" d="' +
          built.d +
          '" />';
      }
      if (!built.d && !gBuilt.d) return;
      hitSeries[c.code] = {
        label: countryLabel(c),
        col: col,
        pts: pts.map(function (p) {
          return {
            t: p.t,
            rank: p.rank,
            gamei: p.gamei_today,
            x: padL + ((p.t - tMin) / spanT) * plotW,
            y: padT + ((p.rank - 1) / spanR) * plotH
          };
        }),
        gPts: gPts.map(function (p) {
          return {
            t: p.t,
            rank: p.gamei_today,
            x: padL + ((p.t - tMin) / spanT) * plotW,
            y: padT + ((p.gamei_today - 1) / spanR) * plotH
          };
        })
      };
      if (built.last) {
        endMarks.push({ code: c.code, col: col, x: built.last.x, y: built.last.y, rank: built.last.rank });
      }
    });
    endMarks.sort(function (a, b) {
      return a.y - b.y || a.rank - b.rank;
    });
    var placed = [];
    endMarks.forEach(function (m) {
      var labelX = m.x + 14;
      var labelY = m.y - 6;
      placed.forEach(function (p) {
        if (Math.abs(labelY - p.y) < 16 && Math.abs(labelX - p.x) < 36) {
          labelX = Math.max(labelX, p.x + 34);
        }
      });
      labelX = Math.min(labelX, padL + plotW + padR - 8);
      placed.push({ x: labelX, y: labelY });
      trails +=
        '<circle class="trk-dot" cx="' +
        m.x.toFixed(1) +
        '" cy="' +
        m.y.toFixed(1) +
        '" r="5" fill="' +
        m.col +
        '" stroke="#061018" stroke-width="1.5"/>';
      trails +=
        '<text class="trk-end-label" x="' +
        labelX.toFixed(1) +
        '" y="' +
        labelY.toFixed(1) +
        '" fill="' +
        m.col +
        '">#' +
        m.rank +
        '</text>';
    });

    state.chartHit = {
      tMin: tMin,
      tMax: tMax,
      padL: padL,
      padT: padT,
      plotW: plotW,
      plotH: plotH,
      W: W,
      H: H,
      series: hitSeries
    };

    wrap.innerHTML =
      '<svg viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '" width="' +
      W +
      '" height="' +
      H +
      '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
      esc(t('chartTitle')) +
      '">' +
      '<g class="trk-grid">' +
      grid +
      '</g>' +
      '<g class="trk-axis">' +
      xLabels +
      '</g>' +
      trails +
      '<line class="trk-hover-x" id="trkHoverX" x1="0" y1="' +
      padT +
      '" x2="0" y2="' +
      (padT + plotH) +
      '" stroke="rgba(0,212,255,.55)" stroke-width="1" stroke-dasharray="4 3" visibility="hidden"/>' +
      '<g id="trkHoverDots"></g>' +
      '</svg>';
    hideHoverTip();
  }

  function hideHoverTip() {
    var tip = document.getElementById('trkHoverTip');
    if (tip) tip.hidden = true;
    var line = document.getElementById('trkHoverX');
    if (line) line.setAttribute('visibility', 'hidden');
    var dots = document.getElementById('trkHoverDots');
    if (dots) dots.innerHTML = '';
  }

  function nearestSample(pts, t) {
    if (!pts || !pts.length) return null;
    var best = pts[0];
    var bestD = Math.abs(pts[0].t - t);
    var bestI = 0;
    for (var i = 1; i < pts.length; i++) {
      var d = Math.abs(pts[i].t - t);
      if (d < bestD) {
        bestD = d;
        best = pts[i];
        bestI = i;
      }
    }
    var prev = bestI > 0 ? pts[bestI - 1] : null;
    return { cur: best, prev: prev };
  }

  function onChartPointer(ev) {
    var hit = state.chartHit;
    var wrap = document.getElementById('trkChart');
    var tip = document.getElementById('trkHoverTip');
    if (!hit || !wrap || !tip) return;
    var svg = wrap.querySelector('svg');
    if (!svg) return;
    var rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var mx = ((ev.clientX - rect.left) / rect.width) * hit.W;
    if (mx < hit.padL || mx > hit.padL + hit.plotW) {
      hideHoverTip();
      return;
    }
    var tAt = hit.tMin + ((mx - hit.padL) / Math.max(1, hit.plotW)) * (hit.tMax - hit.tMin);
    var line = document.getElementById('trkHoverX');
    if (line) {
      line.setAttribute('x1', mx.toFixed(1));
      line.setAttribute('x2', mx.toFixed(1));
      line.setAttribute('visibility', 'visible');
    }
    var rows = [];
    var dotsHtml = '';
    var ranked = [];
    Object.keys(hit.series).forEach(function (code) {
      var s = hit.series[code];
      var n = nearestSample(s.pts, tAt);
      var gNear = nearestSample(s.gPts, tAt);
      if ((!n || !n.cur) && (!gNear || !gNear.cur)) return;
      var sortRank =
        n && n.cur && n.cur.rank != null
          ? n.cur.rank
          : gNear && gNear.cur
            ? gNear.cur.rank
            : 9999;
      ranked.push({ code: code, s: s, n: n, gNear: gNear, sortRank: sortRank });
    });
    ranked.sort(function (a, b) {
      return a.sortRank - b.sortRank || String(a.code).localeCompare(String(b.code));
    });
    ranked.forEach(function (item) {
      var s = item.s;
      var n = item.n;
      var gNear = item.gNear;
      var appleTxt = '';
      if (n && n.cur && n.cur.rank != null) {
        var was =
          n.prev && n.prev.rank != null
            ? t('hoverWas') + ' #' + n.prev.rank
            : '—';
        appleTxt =
          '<strong>' +
          t('apple') +
          ' #' +
          n.cur.rank +
          '</strong> <em>(' +
          esc(was) +
          ')</em>';
      }
      var gTxt =
        gNear && gNear.cur && gNear.cur.rank != null
          ? t('gamei') + ' #' + gNear.cur.rank
          : '';
      if (!appleTxt && !gTxt) return;
      rows.push(
        '<div class="trk-hover-row" style="color:' +
          esc(s.col) +
          '"><span class="trk-hover-name">' +
          esc(s.label) +
          '</span><span class="trk-hover-ranks">' +
          (appleTxt || '—') +
          (gTxt ? (appleTxt ? ' · ' : '') + esc(gTxt) : '') +
          '</span></div>'
      );
      if (n && n.cur) {
        dotsHtml +=
          '<circle cx="' +
          n.cur.x.toFixed(1) +
          '" cy="' +
          n.cur.y.toFixed(1) +
          '" r="4.5" fill="' +
          s.col +
          '" stroke="#061018" stroke-width="1.5"/>';
      }
      if (gNear && gNear.cur) {
        dotsHtml +=
          '<circle cx="' +
          gNear.cur.x.toFixed(1) +
          '" cy="' +
          gNear.cur.y.toFixed(1) +
          '" r="3.25" fill="none" stroke="' +
          s.col +
          '" stroke-width="1.5" stroke-dasharray="2 1" opacity="0.9"/>';
      }
    });
    var dots = document.getElementById('trkHoverDots');
    if (dots) dots.innerHTML = dotsHtml;
    tip.innerHTML =
      '<div class="trk-hover-time">' +
      esc(fmtTime(tAt)) +
      '</div>' +
      rows.join('');
    tip.hidden = false;
    var host = tip.parentElement;
    var hostW = host ? host.clientWidth : 320;
    var left = Math.min(Math.max(8, mx * (rect.width / hit.W) + 12), hostW - 180);
    tip.style.left = left + 'px';
    tip.style.top = '12px';
  }

  function renderStatus(data) {
    var el = document.getElementById('trkStatus');
    if (!el) return;
    var meta = (data && data.meta) || {};
    var sampling = (data && data.sampling) || {};
    var modeLine =
      sampling.mode === 'active' || sampling.mode === 'always'
        ? t('statusActive')
        : t('statusIdle');
    var bits = [modeLine, t('updated') + ' ' + fmtTime(meta.last_ok_ms)];
    if (meta.last_err) bits.push(t('statusErr') + ': ' + meta.last_err);
    bits.push('n=' + (data && data.sample_count != null ? data.sample_count : 0));
    el.textContent = bits.join(' · ');
  }

  function paint() {
    var data = state.data;
    if (!data) return;
    applyOutOfChartDefaults(data);
    renderLiveCards(data);
    renderLegend(data);
    renderChart(data);
    renderStatus(data);
  }

  function syncLangBtns() {
    document.querySelectorAll('.trk-lang-btn').forEach(function (b) {
      var on = (b.getAttribute('data-lang') || '') === state.lang;
      b.classList.toggle('is-active', on);
    });
  }

  async function load(opts) {
    opts = opts || {};
    var q =
      '/api/sales_rank_tracking?chart=' +
      encodeURIComponent(state.chart) +
      '&hours=' +
      encodeURIComponent(String(state.hours));
    if (opts.fresh) q += '&fresh=1';
    try {
      var r = await fetch(q, { cache: 'no-store', credentials: 'same-origin' });
      var data = await r.json();
      if (!r.ok || !data || data.ok === false) throw new Error((data && data.error) || 'HTTP ' + r.status);
      state.data = data;
      paint();
    } catch (e) {
      var empty = document.getElementById('trkEmpty');
      if (empty) {
        empty.hidden = false;
        empty.textContent = String(e && e.message ? e.message : e);
      }
    }
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;
    document.querySelectorAll('[data-trk-chart]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.chart = btn.getAttribute('data-trk-chart') || 'overall';
        try {
          localStorage.setItem('ggen_trk_chart', state.chart);
        } catch (_) {}
        document.querySelectorAll('[data-trk-chart]').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        load();
      });
    });
    document.querySelectorAll('[data-trk-hours]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.hours = Number(btn.getAttribute('data-trk-hours')) || 24;
        document.querySelectorAll('[data-trk-hours]').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        load();
      });
    });
    var legend = document.getElementById('trkLegend');
    if (legend) {
      legend.addEventListener('click', function (ev) {
        var item = ev.target.closest('.trk-legend-item[data-code]');
        if (!item) return;
        var code = item.getAttribute('data-code');
        state.hidden[code] = !state.hidden[code];
        paint();
      });
    }
    document.querySelectorAll('.trk-lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = (btn.getAttribute('data-lang') || 'EN').toUpperCase();
        if (lang === 'JP') lang = 'JA';
        if (!T[lang]) lang = 'EN';
        state.lang = lang;
        try {
          localStorage.setItem('ggen_lang', lang === 'JA' ? 'JA' : lang);
        } catch (_) {}
        document.documentElement.setAttribute('data-ui-lang', state.lang);
        applyCopy();
        syncLangBtns();
        paint();
      });
    });
    var chartHost = document.getElementById('trkChart');
    if (chartHost) {
      chartHost.addEventListener('pointermove', onChartPointer, { passive: true });
      chartHost.addEventListener('pointerleave', hideHoverTip, { passive: true });
    }
    window.addEventListener(
      'resize',
      function () {
        if (state.data) renderChart(state.data);
      },
      { passive: true }
    );
  }

  function syncChartChips() {
    document.querySelectorAll('[data-trk-chart]').forEach(function (b) {
      var on = (b.getAttribute('data-trk-chart') || '') === state.chart;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function boot(opts) {
    opts = opts || {};
    if (!document.getElementById('trkLive')) return;
    state.lang = readLang();
    if (!state.booted) {
      state.chart = 'overall';
      try {
        var q = new URLSearchParams(location.search || '');
        var cq = (q.get('chart') || '').toLowerCase();
        if (cq === 'games' || cq === 'overall') state.chart = cq;
        else {
          var saved = String(localStorage.getItem('ggen_trk_chart') || '').toLowerCase();
          if (saved === 'games' || saved === 'overall') state.chart = saved;
        }
      } catch (_) {}
    }
    document.documentElement.setAttribute('data-ui-lang', state.lang);
    applyCopy();
    syncChartChips();
    syncLangBtns();
    bind();
    if (!state.booted) {
      state.booted = true;
      load({ fresh: true });
      if (!state.timer) {
        state.timer = setInterval(function () {
          load();
        }, 60000);
      }
    } else if (opts.force) {
      load({ fresh: true });
    } else if (state.data) {
      paint();
    } else {
      load({ fresh: true });
    }
  }

  window.GgenSalesTracking = {
    boot: boot,
    reload: function () {
      return load({ fresh: true });
    },
    applyLang: function () {
      state.lang = readLang();
      applyCopy();
      syncLangBtns();
      paint();
    }
  };

  // Standalone /tracking page auto-boots; SPA waits for loadSalesTracking().
  var spaRoot = document.getElementById('trkSpaRoot');
  var embedded = spaRoot && spaRoot.getAttribute('data-trk-embedded') === '1';
  if (!embedded) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {
      boot();
    });
    else boot();
  }
})();
