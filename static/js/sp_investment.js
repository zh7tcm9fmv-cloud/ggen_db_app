(function () {
  'use strict';

  const BUCKET_ORDER = ['no_regrets', 'good', 'better_options', 'dont'];
  const BREAKDOWN_LABELS = {
    tags: 'Tags',
    terrain_dual: 'Space + Land deploy',
    terrain_niche: 'Perfect niche terrain',
    transform: 'Transform',
    map: 'MAP ammo',
    abilities: 'Abilities',
    linked_pilot: 'Linked pilot',
    max_tension_weapon: 'Max-tension weapon',
    preemptive: 'Preemptive Strike',
    rare_debuff: 'Rare debuff',
    extra_life: 'Extra life',
    support_r4_debuffs: 'Support debuffs @ range 4+',
    hp: 'HP',
    atk: 'ATK',
    def: 'DEF',
    mob: 'MOB',
    shield: 'Shield',
    movement: 'Movement',
    weapon_range: 'Weapon range',
    weapon_power: 'Weapon power',
    max_debuff: 'Max debuff level',
    ssp_weapon_conditional: 'SSP weapon conditional',
  };

  let payload = null;
  let board = 'sp';
  let role = 'Attack';
  let showLowRarity = false;
  let mapOnly = false;
  let hasSpOnly = true;
  let sourceFilter = 'all';
  let searchQuery = '';
  let rowById = new Map();

  const $ = (sel) => document.querySelector(sel);
  const grid = $('#spiGrid');
  const statusEl = $('#spiStatus');

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function thumbHtml(row) {
    const src = row.thumb || '';
    const fallback = row.rarity_icon || row.role_icon || '';
    if (src) {
      const fb = fallback ? ` data-fallback="${esc(fallback)}"` : '';
      return `<img class="spi-card-thumb" src="${esc(src)}" alt="" loading="lazy"${fb} onerror="window.__spiThumbFallback(this)">`;
    }
    if (fallback) {
      return `<img class="spi-card-thumb" src="${esc(fallback)}" alt="" loading="lazy">`;
    }
    return '<div class="spi-card-thumb placeholder" aria-hidden="true">?</div>';
  }

  window.__spiThumbFallback = function (img) {
    const fb = img.getAttribute('data-fallback');
    if (fb && img.src !== fb) {
      img.src = fb;
      img.removeAttribute('onerror');
      return;
    }
    const d = document.createElement('div');
    d.className = 'spi-card-thumb placeholder';
    d.setAttribute('aria-hidden', 'true');
    d.textContent = '?';
    img.replaceWith(d);
  };

  function rarityOk(row) {
    const r = String(row.rarity || '').toUpperCase();
    if (showLowRarity) return true;
    return r === 'SSR' || r === 'UR' || !!row.is_ultimate;
  }

  function passesFilters(row) {
    if ((row.role || '') !== role) return false;
    if (!rarityOk(row)) return false;
    if (hasSpOnly && !row.has_sp) return false;
    if (mapOnly && !row.has_map) return false;
    if (sourceFilter !== 'all' && (row.source || '') !== sourceFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const name = String(row.name || '').toLowerCase();
      const tags = (row.tags || []).join(' ').toLowerCase();
      if (!name.includes(q) && !tags.includes(q) && !String(row.id).includes(q)) return false;
    }
    return true;
  }

  function renderScoringGuide() {
    const g = (payload && payload.scoring_guide) || {};
    $('#spiScoringIntro').textContent = g.intro || 'Point-sum investment heuristic.';
    const ov = $('#spiScoringOverrides');
    ov.innerHTML = (g.overrides || []).map((t) => `<li>${esc(t)}</li>`).join('');
    const gaps = $('#spiScoringGaps');
    gaps.innerHTML = (g.gaps || []).map((t) => `<li>${esc(t)}</li>`).join('');
    const cuts = $('#spiLetterCutoffs');
    const labels = g.bucket_labels || payload.bucket_labels || {};
    const letterBits = (g.letter_cutoffs || [])
      .map((c) => `<span class="spi-letter-chip">${esc(c.letter)} ≥ ${esc(c.min)}</span>`)
      .join('');
    const bucketBits = Object.keys(labels)
      .map((k) => `<span class="spi-letter-chip">${esc(labels[k])}</span>`)
      .join('');
    cuts.innerHTML = letterBits + bucketBits;
  }

  function render() {
    if (!payload) return;
    const buckets = payload[board] || {};
    const labels = payload.bucket_labels || {};
    const order = payload.bucket_order || BUCKET_ORDER;
    rowById = new Map();
    let shown = 0;
    let html = '';
    order.forEach((bk) => {
      const rows = (buckets[bk] || []).filter(passesFilters);
      rows.forEach((r) => rowById.set(String(r.id), r));
      shown += rows.length;
      const cards = rows
        .map((r) => {
          return `<button type="button" class="spi-card" data-id="${esc(r.id)}">
            ${thumbHtml(r)}
            <div class="spi-card-name">${esc(r.name || r.id)}</div>
            <div class="spi-card-meta">
              <span class="spi-chip letter">${esc(r.letter || '?')}</span>
              <span class="spi-chip score">${esc(r.total)}</span>
              <span class="spi-chip">${esc(r.rarity || '')}</span>
            </div>
          </button>`;
        })
        .join('');
      html += `<section class="spi-bucket">
        <div class="spi-bucket-head" data-bucket="${esc(bk)}">
          <h3>${esc(labels[bk] || bk)}</h3>
          <span class="spi-bucket-count">${rows.length}</span>
        </div>
        <div class="spi-cards">${cards || '<p class="spi-status">No units in this bucket for current filters.</p>'}</div>
      </section>`;
    });
    grid.innerHTML = html;
    grid.setAttribute('aria-busy', 'false');
    const totalBoard = (payload.counts && payload.counts[board]) || 0;
    statusEl.textContent = `Showing ${shown} of ${totalBoard} on ${board.toUpperCase()} · ${role}`;
  }

  function openModal(row) {
    if (!row) return;
    const heuristic = new Set(((row.meta && row.meta.heuristic_keys) || []));
    const bd = row.breakdown || {};
    const rows = Object.keys(BREAKDOWN_LABELS)
      .filter((k) => bd[k] != null)
      .map((k) => {
        const cls = heuristic.has(k) ? ' class="heuristic"' : '';
        const v = bd[k];
        const sign = Number(v) > 0 ? `+${v}` : String(v);
        return `<tr${cls}><td>${esc(BREAKDOWN_LABELS[k])}</td><td>${esc(sign)}</td></tr>`;
      })
      .join('');
    const stats = row.stats || {};
    $('#spiModalBody').innerHTML = `
      <h3 class="spi-modal-title" id="spiModalTitle">${esc(row.name || row.id)}</h3>
      <p class="spi-modal-sub">${esc(row.role)} · ${esc(row.rarity)} · ${esc(row.letter)} · total ${esc(row.total)} · ${esc(row.mode || board).toUpperCase()}</p>
      <p class="spi-modal-sub">HP ${esc(stats.HP)} · ATK ${esc(stats.ATK)} · DEF ${esc(stats.DEF)} · MOB ${esc(stats.MOB)} · MOV ${esc(stats.MOV)}</p>
      <table class="spi-breakdown"><tbody>${rows}</tbody></table>
      <div class="spi-modal-actions">
        <a href="/u/${encodeURIComponent(row.id)}" target="_blank" rel="noopener">Open in database</a>
      </div>`;
    $('#spiModal').hidden = false;
  }

  function closeModal() {
    $('#spiModal').hidden = true;
  }

  function bindControls() {
    document.querySelectorAll('.spi-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.spi-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
        board = btn.dataset.board || 'sp';
        render();
      });
    });
    document.querySelectorAll('.spi-role-tabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.spi-role-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
        role = btn.dataset.role || 'Attack';
        render();
      });
    });
    $('#spiShowLowRarity').addEventListener('change', (e) => {
      showLowRarity = !!e.target.checked;
      render();
    });
    $('#spiMapOnly').addEventListener('change', (e) => {
      mapOnly = !!e.target.checked;
      render();
    });
    $('#spiHasSpOnly').addEventListener('change', (e) => {
      hasSpOnly = !!e.target.checked;
      render();
    });
    $('#spiSourceFilter').addEventListener('change', (e) => {
      sourceFilter = e.target.value || 'all';
      render();
    });
    let t = null;
    $('#spiSearch').addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => {
        searchQuery = e.target.value || '';
        render();
      }, 120);
    });
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.spi-card');
      if (!card) return;
      openModal(rowById.get(String(card.dataset.id)));
    });
    $('#spiModal').addEventListener('click', (e) => {
      if (e.target && e.target.getAttribute('data-close')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
    $('#spiScoringToggle').addEventListener('click', () => {
      const body = $('#spiScoringBody');
      const collapsed = body.classList.toggle('is-collapsed');
      $('#spiScoringToggle').setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
  }

  async function boot() {
    statusEl.textContent = 'Loading rankings…';
    bindControls();
    try {
      const r = await fetch('/api/sp_investment');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      payload = await r.json();
      if (payload.error) throw new Error(payload.error);
      renderScoringGuide();
      render();
    } catch (err) {
      statusEl.textContent = 'Failed to load: ' + (err && err.message ? err.message : err);
      grid.innerHTML = '';
    }
  }

  boot();
})();
