(function () {
  'use strict';

  const BUCKET_ORDER = ['no_regrets', 'good', 'better_options', 'dont'];
  const RARITY_BASE_MAP = {
    UR: '/static/images/UI/UI_Common_Tmb_Square_UR_Base.webp',
    SSR: '/static/images/UI/UI_Common_Tmb_Square_SSR_Base.webp',
    SR: '/static/images/UI/UI_Common_Tmb_Square_SR_Base.webp',
    R: '/static/images/UI/UI_Common_Tmb_Square_R_Base.webp',
    N: '/static/images/UI/UI_Common_Tmb_Square_None_Base.webp',
  };
  const RARITY_FRAME_MAP = {
    UR: '/static/images/UI/UI_Common_Tmb_Square_UR_Frame.webp',
    SSR: '/static/images/UI/UI_Common_Tmb_Square_SSR_Frame.webp',
    SR: '/static/images/UI/UI_Common_Tmb_Square_SR_Frame.webp',
    R: '/static/images/UI/UI_Common_Tmb_Square_R_Frame.webp',
    N: '/static/images/UI/UI_Common_Tmb_Square_None_Frame%20%236338.webp',
  };

  const BREAKDOWN_LABELS = {
    tags: 'Tags',
    tags_weight: 'High-value tags',
    terrain_dual: 'Space + Land deploy',
    terrain_niche: 'Perfect niche terrain',
    transform: 'Transform',
    map: 'MAP ammo',
    abilities: 'Abilities',
    skills_abilities: 'Skills / abilities',
    series_affinity: 'Series affinity',
    recommend_ms: 'Recommended MS',
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
    weapon_bonus: 'Weapon bonus',
    max_debuff: 'Max debuff level',
    ranged: 'Ranged',
    melee: 'Melee',
    awaken: 'Awaken',
    defense: 'Defense',
    reaction: 'Reaction',
  };

  let payload = null;
  let entity = 'units';
  let board = 'sp';
  let role = 'Attack';
  let showLowRarity = false;
  let mapOnly = false;
  let hasSpOnly = true;
  let sourceFilter = 'all';
  let tagFilter = '';
  let erFilter = '';
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

  function imgUrl(path) {
    if (!path) return '';
    const p = String(path);
    if (/^https?:\/\//i.test(p)) return p;
    const cdn = String(window.__GGEN_IMAGE_CDN__ || '').replace(/\/+$/, '');
    const useCdn = window.__GGEN_GAME_IMAGES_USE_CDN__ !== false && !!cdn;
    const webp = p.replace(/\.(png|jpe?g)(?=($|[?#]))/i, '.webp');
    if (!useCdn) return webp;
    if (webp.startsWith('/static/images/')) return cdn + '/images/' + webp.slice('/static/images/'.length);
    if (webp.startsWith('/static/')) return cdn + webp.slice('/static'.length);
    return webp;
  }

  function gameImageUrlFallback(el) {
    if (!el || el.dataset.ggImgDead === '1') return;
    const step = Number(el.dataset.ggImgStep || 0);
    el.dataset.ggImgStep = String(step + 1);
    const cur = String(el.currentSrc || el.src || '');
    const cdn = String(window.__GGEN_IMAGE_CDN__ || '').replace(/\/+$/, '');
    if (step === 0 && /\.webp(\?|#|$)/i.test(cur)) {
      el.src = cur.replace(/\.webp/gi, '.png');
      return;
    }
    if (step === 1 && cdn && cur.indexOf(cdn) === 0) {
      try {
        const u = new URL(cur);
        const i = u.pathname.indexOf('/images/');
        if (i >= 0) {
          el.src = '/static/images/' + u.pathname.slice(i + '/images/'.length);
          return;
        }
      } catch (_) {}
    }
    el.dataset.ggImgDead = '1';
    el.style.display = 'none';
    const w = el.closest('.list-thumb-portrait-wrap');
    const ph = w && w.querySelector('.list-thumb-placeholder');
    if (ph) ph.style.display = 'flex';
  }
  window.gameImageUrlFallback = gameImageUrlFallback;

  function renderFramedThumb(row, kind) {
    const r = row.rarity || 'N';
    const base = RARITY_BASE_MAP[r] || RARITY_BASE_MAP.N;
    const frame = RARITY_FRAME_MAP[r] || RARITY_FRAME_MAP.N;
    const ph = kind === 'character' ? '👤' : '🤖';
    // API sets both `thum` and `thumb` after attach.
    const thum = row.thum || row.thumb || '';
    let portrait = '';
    if (thum) {
      portrait = `<img class="list-thumb-portrait" src="${esc(imgUrl(thum))}" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback(this)">`;
    }
    portrait += `<div class="list-thumb-placeholder" style="display:${thum ? 'none' : 'flex'}">${ph}</div>`;
    let icons = '';
    if (row.role_icon) {
      icons += `<span class="list-thumb-icon-wrap"><img src="${esc(imgUrl(row.role_icon))}" alt="" loading="lazy"></span>`;
    }
    if (kind === 'unit' && (row.is_ultimate === true || row.is_ultimate === 1)) {
      icons += `<span class="list-thumb-icon-wrap"><img src="${esc(imgUrl('/static/images/UI/UI_Common_Icon_ULT.webp'))}" alt="ULT" loading="lazy"></span>`;
    }
    if (row.acquisition_icon) {
      icons += `<span class="list-thumb-icon-wrap"><img src="${esc(imgUrl(row.acquisition_icon))}" alt="" loading="lazy"></span>`;
    }
    return `<div class="list-thumb-composite list-thumb-has-frame" style="width:96px;height:96px">
      <div class="list-thumb-back"><img class="list-thumb-base" src="${esc(imgUrl(base))}" alt="" loading="lazy"></div>
      <div class="list-thumb-portrait-wrap">${portrait}</div>
      <img class="list-thumb-frame" src="${esc(imgUrl(frame))}" alt="" loading="lazy">
      ${icons ? `<div class="list-thumb-icons">${icons}</div>` : ''}
    </div>`;
  }

  function rarityOk(row) {
    const r = String(row.rarity || '').toUpperCase();
    if (showLowRarity) return true;
    return r === 'SSR' || r === 'UR' || !!row.is_ultimate;
  }

  function currentBuckets() {
    if (!payload) return {};
    if (entity === 'characters') {
      return ((payload.characters || {}).sp) || {};
    }
    const units = payload.units || {};
    if (units.sp || units.ssp) return units[board] || {};
    return payload[board] || {};
  }

  function passesFilters(row) {
    if ((row.role || '') !== role) return false;
    if (!rarityOk(row)) return false;
    if (hasSpOnly && !row.has_sp) return false;
    if (entity === 'units' && mapOnly && !row.has_map) return false;
    if (sourceFilter !== 'all' && (row.source || '') !== sourceFilter) return false;
    if (tagFilter) {
      const tags = (row.tags || []).map((t) => String(t));
      if (!tags.includes(tagFilter)) return false;
    }
    if (erFilter) {
      const ids = row.er_expert_ids || [];
      if (!ids.map(String).includes(String(erFilter))) return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const name = String(row.name || '').toLowerCase();
      const tags = (row.tags || []).join(' ').toLowerCase();
      if (!name.includes(q) && !tags.includes(q) && !String(row.id).includes(q)) return false;
    }
    return true;
  }

  function fillFilterSelects() {
    const tagSel = $('#spiTagFilter');
    const erSel = $('#spiErFilter');
    const tags = payload.tag_catalog || [];
    const curTag = tagSel.value;
    tagSel.innerHTML =
      '<option value="">No tag filter</option>' +
      tags.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    if (curTag) tagSel.value = curTag;

    const ers = payload.er_expert_filters || [];
    const curEr = erSel.value;
    erSel.innerHTML =
      '<option value="">No ER Expert filter</option>' +
      ers
        .map((e) => `<option value="${esc(e.id)}">${esc(e.label || e.id)}</option>`)
        .join('');
    if (curEr) erSel.value = curEr;
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

  function syncBoardTabsVisibility() {
    const boardTabs = $('#spiBoardTabs');
    const mapWrap = $('#spiMapOnlyWrap');
    if (entity === 'characters') {
      boardTabs.style.display = 'none';
      board = 'sp';
      if (mapWrap) mapWrap.style.display = 'none';
    } else {
      boardTabs.style.display = '';
      if (mapWrap) mapWrap.style.display = '';
    }
  }

  function render() {
    if (!payload) return;
    syncBoardTabsVisibility();
    const buckets = currentBuckets();
    const labels = payload.bucket_labels || {};
    const order = payload.bucket_order || BUCKET_ORDER;
    const kind = entity === 'characters' ? 'character' : 'unit';
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
            <div class="spi-card-thumb-wrap">${renderFramedThumb(r, kind)}</div>
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
    const counts = payload.counts || {};
    const totalBoard =
      entity === 'characters'
        ? counts.characters_sp || 0
        : board === 'ssp'
          ? counts.units_ssp || counts.ssp || 0
          : counts.units_sp || counts.sp || 0;
    const label = entity === 'characters' ? 'Pilots SP' : board.toUpperCase();
    statusEl.textContent = `Showing ${shown} of ${totalBoard} · ${label} · ${role}`;
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
    let statLine = '';
    if (entity === 'characters') {
      statLine = `Ranged ${esc(stats.Ranged)} · Melee ${esc(stats.Melee)} · Awaken ${esc(stats.Awaken)} · Def ${esc(stats.Defense)} · Rea ${esc(stats.Reaction)}`;
    } else {
      statLine = `HP ${esc(stats.HP)} · ATK ${esc(stats.ATK)} · DEF ${esc(stats.DEF)} · MOB ${esc(stats.MOB)} · MOV ${esc(stats.MOV)}`;
    }
    const detailPath = entity === 'characters' ? '/c/' : '/u/';
    const rec = row.best_rec_ms_letter
      ? `<p class="spi-modal-sub">Best recommended MS letter: ${esc(row.best_rec_ms_letter)}</p>`
      : '';
    $('#spiModalBody').innerHTML = `
      <h3 class="spi-modal-title" id="spiModalTitle">${esc(row.name || row.id)}</h3>
      <p class="spi-modal-sub">${esc(row.role)} · ${esc(row.rarity)} · ${esc(row.letter)} · total ${esc(row.total)} · ${esc(row.mode || board).toUpperCase()}</p>
      <p class="spi-modal-sub">${statLine}</p>
      ${rec}
      <table class="spi-breakdown"><tbody>${rows}</tbody></table>
      <div class="spi-modal-actions">
        <a href="${detailPath}${encodeURIComponent(row.id)}" target="_blank" rel="noopener">Open in database</a>
      </div>`;
    $('#spiModal').hidden = false;
  }

  function closeModal() {
    $('#spiModal').hidden = true;
  }

  function bindControls() {
    document.querySelectorAll('.spi-tabs button[data-entity]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.spi-tabs button[data-entity]').forEach((b) => b.classList.toggle('active', b === btn));
        entity = btn.dataset.entity || 'units';
        render();
      });
    });
    document.querySelectorAll('#spiBoardTabs button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#spiBoardTabs button').forEach((b) => b.classList.toggle('active', b === btn));
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
    $('#spiTagFilter').addEventListener('change', (e) => {
      tagFilter = e.target.value || '';
      render();
    });
    $('#spiErFilter').addEventListener('change', (e) => {
      erFilter = e.target.value || '';
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
      fillFilterSelects();
      renderScoringGuide();
      render();
    } catch (err) {
      statusEl.textContent = 'Failed to load: ' + (err && err.message ? err.message : err);
      grid.innerHTML = '';
    }
  }

  boot();
})();
