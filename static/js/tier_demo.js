(function () {
  'use strict';

  const TIERS = ['SSS', 'SS', 'S', 'A'];

  const UNIT_SUB_KEYS = {
    Attack: [
      { key: 'sortie', label: 'Sortie', max: 30 },
      { key: 'terrain', label: 'Terrain', max: 8 },
      { key: 'stats', label: 'Stats', max: 15 },
      { key: 'weapons', label: 'Weapons', max: 34 },
      { key: 'peak_damage', label: 'Peak EX', max: 20 },
      { key: 'abilities', label: 'Abilities', max: 6 },
      { key: 'team_synergy', label: 'Team', max: 18 },
      { key: 'crit_synergy', label: 'Crit syn', max: 8 },
    ],
    Defense: [
      { key: 'sortie', label: 'Sortie', max: 30 },
      { key: 'terrain', label: 'Terrain', max: 8 },
      { key: 'stats', label: 'Stats', max: 20 },
      { key: 'weapons', label: 'Weapons', max: 14 },
      { key: 'abilities', label: 'Abilities', max: 10 },
      { key: 'team_synergy', label: 'Team', max: 18 },
    ],
    Support: [
      { key: 'sortie', label: 'Sortie', max: 30 },
      { key: 'terrain', label: 'Terrain', max: 8 },
      { key: 'stats', label: 'Stats', max: 10 },
      { key: 'weapons', label: 'Weapons', max: 14 },
      { key: 'abilities', label: 'Abilities', max: 12 },
      { key: 'team_synergy', label: 'Team', max: 18 },
    ],
  };

  let payload = null;
  let activeCategory = 'units';
  let activeRole = 'Attack';
  let tierMode = 'meta';
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
      return `<div class="tier-card-subscores">
        <div class="tier-sub-row">
          <span class="tier-sub-label">Leader</span>
          <div class="tier-sub-bar"><span style="width:${Math.min(100, lp.max_leader_pct || 0)}%"></span></div>
          <span class="tier-sub-val">${lp.max_leader_pct || 0}%</span>
        </div>
        <div class="tier-sub-row">
          <span class="tier-sub-label">Coverage</span>
          <div class="tier-sub-bar"><span style="width:${Math.min(100, lp.matching_units_pct || 0)}%"></span></div>
          <span class="tier-sub-val">${(lp.matching_units_pct || 0).toFixed(0)}%</span>
        </div>
      </div>`;
    }
    return '';
  }

  function renderCard(row, kind) {
    const chips = [];
    if (row.is_limited_time) chips.push(chip('limited', 'Limited'));
    if (kind === 'units' && row.weapons && row.weapons.max_power >= 7500) {
      chips.push(chip('peak', `EX ${row.weapons.max_power}`));
    }
    if (kind === 'characters') {
      const sp = row.special || {};
      if (sp.guaranteed_crit) chips.push(chip('crit', 'Guaranteed Crit'));
      if (sp.supercharged_ex && !sp.guaranteed_crit) chips.push(chip('crit', 'Supercharged EX'));
      if (sp.chance_step_x2) chips.push(chip('', 'Chance Step ×2'));
    }
    if (kind === 'units' && row.top_pilots && row.top_pilots[0]) {
      const p = row.top_pilots[0];
      chips.push(chip('pilot', p.name.split(' ')[0]));
      if (p.guaranteed_crit) chips.push(chip('crit', 'Crit pilot'));
    }

    const bullets = (row.bullets || []).slice(0, 2);
    const bulletHtml = bullets.length
      ? `<ul class="tier-card-bullets">${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`
      : '';

    const tierLabel = tierMode === 'meta' ? row.tier_meta : row.tier;
    const sub = [row.role || kind.slice(0, -1), row.rarity || ''].filter(Boolean).join(' · ');

    return `
      <article class="tier-card" data-id="${esc(row.id)}">
        <div class="tier-card-top">
          ${thumbHtml(row)}
          <div class="tier-card-meta">
            <h3 class="tier-card-name">${esc(row.name)}</h3>
            <p class="tier-card-sub">${esc(sub)}</p>
            <div class="tier-card-score">Score ${esc(row.score)} · ${esc(tierLabel)}</div>
          </div>
        </div>
        <div class="tier-card-chips">${chips.join('')}</div>
        ${renderSubscores(row, kind)}
        ${bulletHtml}
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

    const catLabel = activeCategory === 'units' ? 'UR gacha units' : activeCategory === 'characters' ? 'pilots' : 'UR supporters';
    intro.textContent = `Each ${catLabel} (${activeCategory === 'supporters' ? 'all roles' : activeRole}) earns up to 100 points from the pillars below, then limited-time bonuses may apply.`;

    modesEl.innerHTML = (guide.tier_modes || [])
      .map((m) => `<div class="tier-scoring-mode"><strong>${esc(m.label)}</strong>${esc(m.detail)}</div>`)
      .join('');

    let pillars = [];
    if (activeCategory === 'units') {
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

    const mods = guide.global_modifiers || [];
    globalEl.innerHTML = mods.length
      ? `<strong>Global modifiers:</strong> ${mods.map((m) => `${esc(m.label)} (${esc(m.points)}) — ${esc(m.detail)}`).join(' · ')}`
      : '';
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
      const t = tierMode === 'meta' ? r.tier_meta : r.tier;
      if (byTier[t]) byTier[t].push(r);
    });
    TIERS.forEach((t) => {
      byTier[t].sort((a, b) => (b.score || 0) - (a.score || 0));
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

    statusEl.textContent = `${rows.length} ${activeCategory} · ${tierMode === 'meta' ? 'meta percentile' : 'absolute score'} tiers`;
  }

  async function load() {
    grid.innerHTML = '<p class="tier-demo-loading">Loading tier data…</p>';
    try {
      const res = await fetch('/api/tier_mockup');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      payload = await res.json();
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
      roleWrap.style.display = activeCategory === 'supporters' ? 'none' : '';
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

  $('#tierMode').addEventListener('change', (e) => {
    tierMode = e.target.value;
    render();
  });

  $('#tierSearch').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
  });

  load();
})();
