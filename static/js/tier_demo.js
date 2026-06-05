(function () {
  'use strict';

  const TIERS = ['SSS', 'SS', 'S', 'A'];
  const ROLE_MAP = { Attack: '1', Defense: '2', Support: '3' };

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

  function renderCard(row, kind) {
    const thumb = row.thumb
      ? `<img class="tier-card-thumb" src="${esc(row.thumb)}" alt="" loading="lazy">`
      : `<div class="tier-card-thumb placeholder" aria-hidden="true">?</div>`;
    const chips = [];
    if (row.is_limited_time) chips.push(chip('limited', 'Limited'));
    if (row.community_anchor) chips.push(chip('peak', 'Meta anchor'));
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
          ${thumb}
          <div class="tier-card-meta">
            <h3 class="tier-card-name">${esc(row.name)}</h3>
            <p class="tier-card-sub">${esc(sub)}</p>
            <div class="tier-card-score">Score ${esc(row.score)} · ${esc(tierLabel)}</div>
          </div>
        </div>
        <div class="tier-card-chips">${chips.join('')}</div>
        ${bulletHtml}
      </article>`;
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
    if (q) {
      rows = rows.filter((r) => (r.name || '').toLowerCase().includes(q));
    }
    return rows;
  }

  function render() {
    if (!payload) return;
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

    statusEl.textContent = `${rows.length} ${activeCategory} shown · ${tierMode === 'meta' ? 'meta percentile' : 'absolute score'} tiers`;
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
