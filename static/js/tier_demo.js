(function () {
  'use strict';

  const TIERS = ['SSS', 'SS', 'S', 'A'];

  const UNIT_AXIS_KEYS = [
    { key: 'stat', label: 'Stat' },
    { key: 'damage', label: 'Dmg' },
    { key: 'ml_buff', label: 'ML' },
    { key: 'utility', label: 'Util' },
  ];

  const UNIT_SUB_KEYS = {
    Attack: [
      { key: 'sortie', label: 'Sortie', max: 30 },
      { key: 'terrain', label: 'Terrain', max: 15 },
      { key: 'stats', label: 'Stats', max: 15 },
      { key: 'weapons', label: 'Weapons', max: 34 },
      { key: 'peak_damage', label: 'Peak EX', max: 20 },
      { key: 'abilities', label: 'Abilities', max: 6 },
      { key: 'team_synergy', label: 'Team', max: 18 },
      { key: 'crit_synergy', label: 'Crit syn', max: 8 },
    ],
    Defense: [
      { key: 'sortie', label: 'Sortie', max: 30 },
      { key: 'terrain', label: 'Terrain', max: 15 },
      { key: 'stats', label: 'Stats', max: 20 },
      { key: 'weapons', label: 'Weapons', max: 14 },
      { key: 'abilities', label: 'Abilities', max: 10 },
      { key: 'team_synergy', label: 'Team', max: 18 },
    ],
    Support: [
      { key: 'sortie', label: 'Sortie', max: 30 },
      { key: 'terrain', label: 'Terrain', max: 15 },
      { key: 'stats', label: 'Stats', max: 10 },
      { key: 'weapons', label: 'Weapons', max: 14 },
      { key: 'abilities', label: 'Abilities', max: 12 },
      { key: 'team_synergy', label: 'Team', max: 18 },
    ],
  };

  let payload = null;
  let activeCategory = 'units';
  let activeRole = 'Attack';
  let activeRarity = 'UR';
  let tierMode = 'meta';
  let unitAxisView = 'overall';
  let searchQuery = '';

  const $ = (sel) => document.querySelector(sel);
  const grid = $('#tierGrid');
  const statusEl = $('#tierStatus');

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function chip(cls, label) {
    return `<span class="tier-chip ${cls}">${esc(label)}</span>`;
  }

  function thumbHtml(row) {
    const src = row.thumb || '';
    const fallback = row.rarity_icon || row.role_icon || '';
    if (src) {
      const fb = fallback ? ` data-fallback="${esc(fallback)}"` : '';
      return `<img class="tier-card-thumb" src="${esc(src)}" alt="" loading="lazy"${fb} onerror="window.__tierThumbFallback(this)">`;
    }
    if (fallback) {
      return `<img class="tier-card-thumb fallback-icon" src="${esc(fallback)}" alt="" loading="lazy">`;
    }
    return '<div class="tier-card-thumb placeholder" aria-hidden="true">?</div>';
  }

  window.__tierThumbFallback = function (img) {
    const fb = img.getAttribute('data-fallback');
    if (fb && img.src !== fb) {
      img.src = fb;
      img.classList.add('fallback-icon');
      img.removeAttribute('onerror');
      return;
    }
    img.replaceWith((() => {
      const d = document.createElement('div');
      d.className = 'tier-card-thumb placeholder';
      d.setAttribute('aria-hidden', 'true');
      d.textContent = '?';
      return d;
    })());
  };

  function scoreCap() {
    const cap = payload && payload.axes_v1 && payload.axes_v1.score_cap;
    return Number(cap) > 0 ? Number(cap) : 92;
  }

  function axisBarPct(val) {
    const cap = scoreCap();
    return Math.min(100, (Number(val || 0) / cap) * 100);
  }

  function strongestAxis(row) {
    if (!row.axes) return null;
    let best = null;
    UNIT_AXIS_KEYS.forEach((d) => {
      const ax = row.axes[d.key] || {};
      const sc = Number(ax.score || 0);
      if (sc <= 0) return;
      if (!best || sc > best.score) {
        best = { label: d.label, score: sc, tier: ax.tier || '' };
      }
    });
    return best;
  }

  function renderAxisStrip(row, highlightKey) {
    if (!row.axes) return '';
    const cells = UNIT_AXIS_KEYS.map((d) => {
      const ax = row.axes[d.key] || {};
      const val = Number(ax.score || 0);
      const tier = ax.tier || '—';
      const hi = highlightKey && d.key === highlightKey ? ' is-highlight' : '';
      return `<div class="tier-axis-cell${hi}" title="${esc(d.label)}: ${val.toFixed(0)} (${tier})">
        <span class="tier-axis-cell-label">${esc(d.label)}</span>
        <span class="tier-axis-cell-tier">${esc(tier)}</span>
        <span class="tier-axis-cell-score">${val > 0 ? val.toFixed(0) : '—'}</span>
      </div>`;
    }).join('');
    return `<div class="tier-axis-strip">${cells}</div>`;
  }

  function renderAxes(row, kind, highlightKey) {
    if (kind !== 'units' || !row.axes) return '';
    const rows = UNIT_AXIS_KEYS.map((d) => {
      const ax = row.axes[d.key] || {};
      const val = Number(ax.score || 0);
      if (val <= 0) return '';
      const tier = ax.tier || '';
      const pct = axisBarPct(val);
      const hi = highlightKey && d.key === highlightKey ? ' tier-axis-row--hi' : '';
      return `<div class="tier-axis-row${hi}">
        <span class="tier-axis-label">${esc(d.label)}</span>
        <div class="tier-axis-bar"><span style="width:${pct.toFixed(0)}%"></span></div>
        <span class="tier-axis-val">${val.toFixed(0)} · ${esc(tier)}</span>
      </div>`;
    }).filter(Boolean).join('');
    if (!rows) return '';
    return `<div class="tier-card-axes">${rows}</div>`;
  }

  function renderSubscores(row, kind) {
    if (kind === 'units' && row.subscores) {
      const defs = UNIT_SUB_KEYS[row.role] || UNIT_SUB_KEYS.Attack;
      const rows = defs
        .map((d) => {
          const val = Number(row.subscores[d.key] || 0);
          if (val <= 0) return '';
          const pct = Math.min(100, (val / d.max) * 100);
          return `<div class="tier-sub-row">
            <span class="tier-sub-label">${esc(d.label)}</span>
            <div class="tier-sub-bar"><span style="width:${pct.toFixed(0)}%"></span></div>
            <span class="tier-sub-val">${val.toFixed(1)}</span>
          </div>`;
        })
        .filter(Boolean)
        .join('');
      return rows ? `<div class="tier-card-subscores">${rows}</div>` : '';
    }
    if (kind === 'characters') {
      const sp = row.special || {};
      const parts = [];
      if (sp.guaranteed_crit) parts.push('Guaranteed Crit');
      if (sp.supercharged_ex && !sp.guaranteed_crit) parts.push('Supercharged EX');
      if (sp.chance_step_x2) parts.push('Chance Step ×2');
      if (sp.support_attack_x2) parts.push('Support Atk ×2');
      if (sp.support_defense_x2) parts.push('Support Def ×2');
      if (!parts.length) return '';
      return `<div class="tier-card-subscores"><p class="tier-pillar-detail">${esc(parts.join(' · '))}</p></div>`;
    }
    if (kind === 'supporters' && row.leader_profile) {
      const lp = row.leader_profile;
      const qualPct = Math.min(100, (lp.quality_avg || 0));
      const aceN = lp.ace_units_covered || 0;
      const sk = (lp.leader_skills && lp.leader_skills[0]) || null;
      const buffTxt = sk && sk.tag_names && sk.tag_names.length
        ? `+${sk.pct || lp.max_leader_pct}% → ${sk.tag_names.join(sk.separator === 'and' ? ' + ' : ', ')}`
        : (lp.tag_names && lp.tag_names.length ? lp.tag_names.join(', ') : '');
      return `<div class="tier-card-subscores">
        <div class="tier-sub-row">
          <span class="tier-sub-label">Leader</span>
          <div class="tier-sub-bar"><span style="width:${Math.min(100, lp.max_leader_pct || 0)}%"></span></div>
          <span class="tier-sub-val">${lp.max_leader_pct || 0}%</span>
        </div>
        ${buffTxt ? `<p class="tier-pillar-detail tier-leader-buff">${esc(buffTxt)}</p>` : ''}
        <div class="tier-sub-row">
          <span class="tier-sub-label">Quality</span>
          <div class="tier-sub-bar"><span style="width:${qualPct}%"></span></div>
          <span class="tier-sub-val">avg ${lp.quality_avg || 0}</span>
        </div>
        <div class="tier-sub-row">
          <span class="tier-sub-label">Ace MS</span>
          <div class="tier-sub-bar"><span style="width:${Math.min(100, aceN * 8)}%"></span></div>
          <span class="tier-sub-val">${aceN}</span>
        </div>
      </div>`;
    }
    return '';
  }

  function renderAdvantages(row) {
    const items = (row.rank_advantages && row.rank_advantages.length)
      ? row.rank_advantages
      : (row.bullets || []);
    if (!items.length) return '';
    const list = `<ul class="tier-card-advantages">${items.slice(0, 5).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
    return `<div class="tier-card-why">
      <div class="tier-card-why-title">Why ranked here</div>
      ${list}
    </div>`;
  }

  function rowTierLabel(row, kind) {
    if (kind === 'units' && unitAxisView !== 'overall' && row.axes && row.axes[unitAxisView]) {
      return row.axes[unitAxisView].tier || 'A';
    }
    return tierMode === 'meta' ? row.tier_meta : row.tier;
  }

  function renderCard(row, kind) {
    const chips = [];
    if (row.is_limited_time) chips.push(chip('limited', 'Limited'));

    const tierLabel = rowTierLabel(row, kind);
    const sub = [row.role || kind.slice(0, -1), row.rarity || ''].filter(Boolean).join(' · ');
    const highlightKey = kind === 'units' && unitAxisView !== 'overall' ? unitAxisView : '';
    const strong = kind === 'units' ? strongestAxis(row) : null;

    let scoreLine = '';
    if (kind === 'units' && row.axes) {
      const viewLabel = unitAxisView === 'overall'
        ? 'Overall meta'
        : (UNIT_AXIS_KEYS.find((d) => d.key === unitAxisView) || {}).label || 'Axis';
      const strongTxt = strong ? ` · best ${esc(strong.label)} ${esc(strong.tier)}` : '';
      scoreLine = `<div class="tier-card-score">${esc(viewLabel)} · ${esc(tierLabel)}${strongTxt}</div>`;
    } else {
      scoreLine = `<div class="tier-card-score">${esc(tierLabel)}${row.score != null ? ` · ${Number(row.score).toFixed(1)}` : ''}</div>`;
    }

    return `
      <article class="tier-card" data-id="${esc(row.id)}">
        <div class="tier-card-top">
          ${thumbHtml(row)}
          <div class="tier-card-meta">
            <h3 class="tier-card-name">${esc(row.name)}</h3>
            <p class="tier-card-sub">${esc(sub)}</p>
            ${scoreLine}
          </div>
        </div>
        ${chips.length ? `<div class="tier-card-chips">${chips.join('')}</div>` : ''}
        ${kind === 'units' ? renderAxisStrip(row, highlightKey) : ''}
        ${kind === 'units' ? renderAxes(row, kind, highlightKey) : renderSubscores(row, kind)}
        ${renderAdvantages(row)}
      </article>`;
  }

  function renderScoringGuide() {
    const guide = payload && payload.scoring_guide;
    const intro = $('#tierScoringIntro');
    const modesEl = $('#tierScoringModes');
    const pillarsEl = $('#tierScoringPillars');
    const globalEl = $('#tierScoringGlobal');
    if (!guide) {
      intro.textContent = 'Scoring breakdown unavailable.';
      return;
    }

    const rarityNote = activeCategory === 'supporters' ? '' : ` · ${activeRarity === 'All' ? 'SSR+ pool' : activeRarity + ' only'}`;
    const catLabel = activeCategory === 'units' ? 'units' : activeCategory === 'characters' ? 'pilots' : 'UR supporters';
    if (activeCategory === 'units') {
      intro.textContent = `Units are ranked on four independent axes — stat, damage, ML buff fit, and utility (${activeRole}${rarityNote}). Nobody tops every axis; switch the axis view to see who leads in each scenario. Overall meta tier is a summary, not a perfect score.`;
    } else {
      intro.textContent = `Each ${catLabel} (${activeCategory === 'supporters' ? 'all roles' : activeRole}${rarityNote}) is scored within the same role and rarity band. Scores reflect relative strength, not a perfect 100.`;
    }

    modesEl.innerHTML = (guide.tier_modes || [])
      .map((m) => `<div class="tier-scoring-mode"><strong>${esc(m.label)}</strong>${esc(m.detail)}</div>`)
      .join('');

    let pillars = [];
    if (activeCategory === 'units' && guide.axes_v1 && guide.axes_v1.length) {
      pillars = guide.axes_v1;
    } else if (activeCategory === 'units') {
      pillars = (guide.units && guide.units[activeRole]) || [];
    } else if (activeCategory === 'characters') {
      pillars = (guide.characters && guide.characters[activeRole]) || [];
    } else {
      pillars = guide.supporters || [];
    }

    pillarsEl.innerHTML = pillars
      .map(
        (p) => `<div class="tier-pillar">
          <div class="tier-pillar-head">
            <span class="tier-pillar-label">${esc(p.label)}</span>
            <span class="tier-pillar-max">max ${esc(p.max)}</span>
          </div>
          <p class="tier-pillar-detail">${esc(p.detail)}</p>
        </div>`
      )
      .join('');

    if (activeCategory === 'units') {
      globalEl.innerHTML = `<strong>Note:</strong> Axis scores top out below 100 — units excel in different scenarios, not across the board.`;
    } else {
      const mods = guide.global_modifiers || [];
      globalEl.innerHTML = mods.length
        ? `<strong>Global modifiers:</strong> ${mods.map((m) => `${esc(m.label)} (${esc(m.points)}) — ${esc(m.detail)}`).join(' · ')}`
        : '';
    }
  }

  function rowSortScore(row, kind) {
    if (kind === 'units' && unitAxisView !== 'overall' && row.axes && row.axes[unitAxisView]) {
      return Number(row.axes[unitAxisView].score || 0);
    }
    return Number(row.score || 0);
  }

  function flattenMetaBuckets(buckets) {
    const out = [];
    TIERS.forEach((t) => {
      (buckets[t] || []).forEach((r) => out.push(r));
    });
    return out;
  }

  function currentRows() {
    if (!payload) return [];
    let rows = [];
    if (activeCategory === 'units') {
      rows = flattenMetaBuckets(payload.units_meta || {});
      rows = rows.filter((r) => r.role === activeRole);
    } else if (activeCategory === 'characters') {
      rows = flattenMetaBuckets(payload.characters_meta || {});
      if (activeRole !== 'All') rows = rows.filter((r) => r.role === activeRole);
    } else {
      rows = flattenMetaBuckets(payload.supporters_meta || {});
    }
    if (activeCategory !== 'supporters' && activeRarity !== 'All') {
      rows = rows.filter((r) => r.rarity === activeRarity);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) rows = rows.filter((r) => (r.name || '').toLowerCase().includes(q));
    return rows;
  }

  function render() {
    if (!payload) return;
    renderScoringGuide();
    const rows = currentRows();
    const byTier = { SSS: [], SS: [], S: [], A: [] };
    rows.forEach((r) => {
      const t = rowTierLabel(r, activeCategory);
      if (byTier[t]) byTier[t].push(r);
    });
    TIERS.forEach((t) => {
      byTier[t].sort((a, b) => rowSortScore(b, activeCategory) - rowSortScore(a, activeCategory));
    });

    grid.innerHTML = TIERS.map((t) => {
      const list = byTier[t];
      const tierCls = 'tier-' + t.toLowerCase();
      const body = list.length
        ? list.map((r) => renderCard(r, activeCategory)).join('')
        : '<p class="tier-demo-empty">—</p>';
      return `
        <section class="tier-column" aria-label="${t} tier">
          <header class="tier-column-header ${tierCls}">
            ${t}
            <span class="tier-column-count">${list.length} entries</span>
          </header>
          <div class="tier-column-body">${body}</div>
        </section>`;
    }).join('');

    let status = `${rows.length} ${activeCategory}`;
    if (activeCategory === 'units' && unitAxisView !== 'overall') {
      const axLabel = (UNIT_AXIS_KEYS.find((d) => d.key === unitAxisView) || {}).label || unitAxisView;
      status += ` · ${axLabel} axis tiers`;
    } else {
      status += ` · ${tierMode === 'meta' ? 'overall meta' : 'absolute score'} tiers`;
    }
    statusEl.textContent = status;
  }

  function syncUnitAxisControl() {
    const sel = $('#unitAxisView');
    const tierSel = $('#tierMode');
    if (!sel) return;
    const show = activeCategory === 'units';
    sel.style.display = show ? '' : 'none';
    if (tierSel) tierSel.style.display = show && unitAxisView !== 'overall' ? 'none' : '';
  }

  async function load() {
    grid.innerHTML = '<p class="tier-demo-loading">Loading tier data…</p>';
    try {
      const res = await fetch('/api/tier_mockup');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      payload = await res.json();
      syncUnitAxisControl();
      render();
    } catch (e) {
      grid.innerHTML = `<p class="tier-demo-empty">Failed to load tier data: ${esc(e.message)}</p>`;
    }
  }

  document.querySelectorAll('.tier-demo-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tier-demo-tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      const roleWrap = $('#roleTabs');
      const rf = $('#rarityFilter');
      roleWrap.style.display = activeCategory === 'supporters' ? 'none' : '';
      rf.style.display = activeCategory === 'supporters' ? 'none' : '';
      if (activeCategory === 'characters') {
        activeRole = 'Attack';
        document.querySelectorAll('.tier-demo-role-tabs button').forEach((b) => {
          b.classList.toggle('active', b.dataset.role === 'Attack');
        });
      } else if (activeCategory === 'units') {
        activeRole = 'Attack';
        document.querySelectorAll('.tier-demo-role-tabs button').forEach((b) => {
          b.classList.toggle('active', b.dataset.role === 'Attack');
        });
      }
      syncUnitAxisControl();
      render();
    });
  });

  document.querySelectorAll('.tier-demo-role-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tier-demo-role-tabs button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeRole = btn.dataset.role;
      render();
    });
  });

  $('#rarityFilter').addEventListener('change', (e) => {
    activeRarity = e.target.value;
    const rf = $('#rarityFilter');
    rf.style.display = activeCategory === 'supporters' ? 'none' : '';
    render();
  });

  $('#tierMode').addEventListener('change', (e) => {
    tierMode = e.target.value;
    render();
  });

  const unitAxisEl = $('#unitAxisView');
  if (unitAxisEl) {
    unitAxisEl.addEventListener('change', (e) => {
      unitAxisView = e.target.value;
      syncUnitAxisControl();
      render();
    });
  }

  $('#tierSearch').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
  });

  load();
})();
