(function () {
  'use strict';

  const BUCKET_ORDER = ['recommended', 'solid', 'situational', 'niche'];
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

  const BREAKDOWN_META = {
    tags: {
      label: 'Tag count',
      tip: 'Count of scored tags. Currently set to always give 0 points — tag value is handled under Strategic tags instead.',
      hideIfZero: true,
    },
    tags_weight: {
      label: 'Combat tags (old rule)',
      tip: 'Older fixed tag bonus. Unused when Strategic tags are enabled — usually 0.',
      hideIfZero: true,
    },
    tags_strategic: {
      label: 'Strategic tags',
      tip: 'Bonus from tags that show up often on UR units (especially limited URs). More common combat tags score higher, with a small cap.',
    },
    er_access: {
      label: 'Eternal Road Expert access',
      tip: 'How many Eternal Road Expert stages this unit or pilot can enter. Under 2 is −1; 2–4 is +1; 5 or more is +2.',
    },
    large_footprint: {
      label: 'Large footprint',
      tip: '2×2 units get +1 — wider MAP and buff coverage usually outweighs the placement inconvenience.',
    },
    terrain: {
      label: 'Terrain coverage',
      tip: 'Need Space plus Land or Atmospheric for a neutral score (Space+Atmos with no Land is OK). Extra terrains add points. Missing Space, or both Land and Atmospheric, is a penalty.',
    },
    rarity: {
      label: 'Rarity',
      tip: 'N/R/SR get a penalty so they do not share top letters with SSR. SSR and UR start even before other axes.',
    },
    transform: {
      label: 'Transform advantage',
      tip: 'Only counts when the alternate form unlocks deployable terrain, higher MOV, longer range, higher weapon power, or adds a MAP vs the base form. Transforming alone is not a bonus.',
    },
    map: {
      label: 'MAP weapons',
      tip: 'Any MAP +1. Dash/MovingAttack +1 more. Ammo 2+ and wider coverage add points. Attack can score up to +4; Defense/Support cap at +2 so MAP does not dominate those roles.',
    },
    abilities: {
      label: 'Abilities',
      tip: 'Role-relevant ability effects (damage, defense, support tools, movement tricks). Permanent plain stat ups with no condition score 0 here.',
    },
    skills_abilities: {
      label: 'Skills & abilities',
      tip: 'Pilot active skills plus passive ability effects that help their role.',
    },
    series_affinity: {
      label: 'Series affinity',
      tip: 'Points for series / faction affinity abilities.',
    },
    recommend_ms: {
      label: 'Recommended Mobile Suits',
      tip: 'Bonus from this pilot’s best recommended MS letter on this guide (B+ and up), plus a small multi-match bonus.',
    },
    linked_pilot: {
      label: 'Affinity pilot pool',
      tip: 'How many SSR+ pilots have piloting-tag / EX-pair affinity for this MS. A deep pool is better than one official linked recommend.',
    },
    max_tension_weapon: {
      label: 'Max Vigor weapon',
      tip: 'Their strongest weapon is Max Vigor only and beats the best unrestricted weapon.',
    },
    preemptive: {
      label: 'Preemptive Strike',
      tip: 'Weapon strikes first in the exchange.',
    },
    rare_debuff: {
      label: 'Rare range-down',
      tip: 'Weapon can cut enemy physical or beam range — uncommon and valuable.',
    },
    extra_life: {
      label: 'Unbreakable',
      tip: 'Survives a lethal hit once (Unbreakable). Defense values this more.',
    },
    support_r4_debuffs: {
      label: 'Debuffs at range',
      tip: 'Defense/Support only. Defense counts useful debuff kinds from range 4+ (light). Support needs range 5+ kinds — none is a penalty; two or more is a bonus. Not scored for Attack.',
    },
    hp: { label: 'HP', tip: 'SP-grown HP band for this role.' },
    atk: { label: 'ATK', tip: 'SP-grown ATK band for this role.' },
    def: { label: 'DEF', tip: 'SP-grown DEF band for this role.' },
    mob: { label: 'MOB', tip: 'SP-grown Mobility band for this role.' },
    shield: {
      label: 'Shield',
      tip: 'Has a shield mechanism (~20% damage neglect). Defense units lose points if they lack one.',
    },
    movement: { label: 'Move', tip: 'Movement range. Higher Move helps Attack/Defense/Support differently — Defense cares most for support-defense coverage.' },
    movement_followup: {
      label: 'Movement follow-up',
      tip: 'After-move MAP and/or Chance Step-style follow-up movement (can stack, capped).',
    },
    weapon_range: {
      label: 'Weapon range',
      tip: 'Longest non-MAP weapon range. Support baseline is range 5 (lower is weaker). Short range is a big Attack penalty.',
    },
    weapon_power: {
      label: 'Weapon power',
      tip: 'Strongest non-MAP Lv5 weapon power on this SP or SSP board.',
    },
    weapon_bonus: {
      label: 'Weapon bonus',
      tip: 'Conditional weapon boosts such as crit, high HP power, range scaling, or stronger DEF-down.',
    },
    max_debuff: {
      label: 'Debuff strength',
      tip: 'Defense/Support only: lasting DEF-down % or instant pierce on weapons (stronger = more points). Not scored for Attack.',
    },
    ranged: { label: 'Ranged', tip: 'Pilot Ranged after SP growth.' },
    melee: { label: 'Melee', tip: 'Pilot Melee after SP growth.' },
    awaken: { label: 'Awaken', tip: 'Pilot Awaken after SP growth.' },
    defense: { label: 'Defense', tip: 'Pilot Defense after SP growth.' },
    reaction: { label: 'Reaction', tip: 'Pilot Reaction after SP growth.' },
  };

  const CHAR_STAT_KEYS = ['Ranged', 'Melee', 'Awaken', 'Defense', 'Reaction'];
  const UNIT_STAT_KEYS = ['HP', 'EN', 'ATK', 'DEF', 'MOB'];
  const UNIT_STAT_LABELS = {
    HP: 'HP',
    EN: 'EN',
    ATK: 'Attack',
    DEF: 'Defense',
    MOB: 'Mobility',
  };
  const _spiRankIndexByKey = Object.create(null);
  const _spiRankIndexPromises = Object.create(null);
  let _spiModalEntityKey = '';

  function fmtN(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return Math.round(v).toLocaleString('en-US');
  }

  function uiLang() {
    return String(document.documentElement.getAttribute('data-ui-lang') || 'EN').toUpperCase() || 'EN';
  }

  function entityStatKeys(kind) {
    return kind === 'character' ? CHAR_STAT_KEYS : UNIT_STAT_KEYS;
  }

  function entityStatLabel(kind, key) {
    if (kind === 'character') return key;
    return UNIT_STAT_LABELS[key] || key;
  }

  function entityStatValue(row, key) {
    const stats = row && row.stats;
    if (stats && stats[key] != null) return Number(stats[key]) || 0;
    // Unit payload uses ATK; ranking API also uses ATK.
    if (key === 'ATK' && stats && stats.Attack != null) return Number(stats.Attack) || 0;
    if (key === 'DEF' && stats && stats.Defense != null) return Number(stats.Defense) || 0;
    if (key === 'MOB' && stats && stats.Mobility != null) return Number(stats.Mobility) || 0;
    if (row && row[key] != null) return Number(row[key]) || 0;
    return null;
  }

  function rankIndexCacheKey(kind) {
    if (kind === 'character') return 'characters:sp';
    return `units:${board === 'ssp' ? 'ssp' : 'sp'}`;
  }

  function renderInlineRankRadial(meta) {
    if (!meta || !meta.rank || !meta.total) {
      return `<div class="stat-inline-rank is-loading"><div class="radial-loading">...</div></div>`;
    }
    const rk = Math.max(1, Number(meta.rank) || 1);
    const tt = Math.max(1, Number(meta.total) || 1);
    const pct = Math.max(1, Math.min(100, Math.round((rk / tt) * 100)));
    const progressPercent = Math.max(5, 95 - ((rk - 1) / tt) * 90);
    const fillRatio = Math.max(0.05, Math.min(0.95, progressPercent / 100));
    const r = 25;
    const c = Math.PI * 2 * r;
    const off = c * (1 - fillRatio);
    let tone = '#94a3b8';
    let pctText = `TOP ${pct}%`;
    let leakCls = '';
    if (rk === 1) {
      tone = '#fbbf24';
      pctText = 'Top 1';
      leakCls = 'leak-shadow-strong';
    } else if (rk <= 3) {
      tone = '#22d3ee';
      pctText = `Top ${rk}`;
      leakCls = 'leak-shadow';
    } else if (rk <= 10) {
      tone = '#22d3ee';
      pctText = `Top ${rk}`;
      leakCls = 'leak-shadow-soft';
    } else if (rk <= 20) {
      tone = '#22d3ee';
      pctText = `Top ${rk}`;
    } else if (rk <= tt * 0.05) {
      tone = '#34d399';
    } else if (rk <= tt * 0.25) {
      tone = '#60a5fa';
    } else if (rk > tt * 0.9) {
      tone = '#f87171';
      pctText = `BOTTOM ${Math.max(0, 100 - pct)}%`;
    } else {
      tone = '#a5b4fc';
    }
    return `<div class="stat-inline-rank ${leakCls}" style="--sir-c:${c.toFixed(2)};--sir-o:${off.toFixed(2)};--rank-tone:${tone}">
      <svg class="radial-svg" viewBox="0 0 74 74" aria-hidden="true">
        <circle class="progress-circle" cx="37" cy="37" r="${r}"></circle>
        <circle class="progress-fill" cx="37" cy="37" r="${r}"></circle>
      </svg>
      <div class="inner-circle">
        <div class="rank-wrap">
          <div class="rank-label">RANK</div>
          <div class="rank-text">${rk}</div>
          <div class="total">/ ${fmtN(tt)}</div>
          <div class="percentile">${esc(pctText)}</div>
        </div>
      </div>
    </div>`;
  }

  function kickRankRadialAnimation(root) {
    if (!root || !root.classList || root.classList.contains('is-loading')) return;
    const f = root.querySelector('.progress-fill');
    if (!f) return;
    f.style.strokeDashoffset = 'var(--sir-c)';
    setTimeout(() => {
      if (root.isConnected) f.style.strokeDashoffset = 'var(--sir-o)';
    }, 100);
  }

  function renderEntityStatCard(kind, key, value, meta, highlight) {
    const label = entityStatLabel(kind, key);
    const valHtml = value == null ? '…' : fmtN(value);
    const hi = highlight ? 'spi-stat-specialty' : '';
    return `<div class="stat-card ${hi}" data-stat="${esc(key)}">
      <div class="stat-card-label">${esc(label)}</div>
      <div class="stat-card-value-row">
        <div class="stat-card-value">${valHtml}</div>
      </div>
      ${renderInlineRankRadial(meta)}
    </div>`;
  }

  function renderEntityStatsBlock(row, kind) {
    const keys = entityStatKeys(kind);
    const hasAny = keys.some((k) => entityStatValue(row, k) != null);
    // Units may lack EN in published payload — still show the grid and fill from ranking.
    if (!hasAny && kind === 'character') return '';
    const specialty = kind === 'character' ? row.specialty : '';
    const cards = keys
      .map((k) => renderEntityStatCard(kind, k, entityStatValue(row, k), null, specialty && k === specialty))
      .join('');
    const modeNote =
      kind === 'character'
        ? `SP-grown totals · specialty for MS matching: <strong>${esc(specialty || '·')}</strong>`
        : `${String(row.mode || board || 'sp').toUpperCase()} board stats · same ranking pool as the database detail page`;
    return `<section class="spi-dossier-section spi-entity-stats-block" id="spiEntityStats">
      <div class="spi-dossier-section-head">
        <h4 class="spi-dossier-h">Stats <span class="spi-dossier-h-sub">global ranking</span></h4>
      </div>
      <p class="spi-dossier-note">${modeNote}</p>
      <div class="stats-grid spi-stats-grid">${cards}</div>
    </section>`;
  }

  function patchEntityStatCards(host, byStat, kind, specialty) {
    if (!host) return;
    host.querySelectorAll('.stat-card[data-stat]').forEach((card) => {
      const key = card.getAttribute('data-stat');
      const meta = byStat && byStat[key];
      const valEl = card.querySelector('.stat-card-value');
      if (meta && meta.value != null && valEl) valEl.textContent = fmtN(meta.value);
      const old = card.querySelector('.stat-inline-rank');
      if (old) old.remove();
      if (meta && meta.rank && meta.total) {
        card.insertAdjacentHTML('beforeend', renderInlineRankRadial(meta));
        kickRankRadialAnimation(card.querySelector('.stat-inline-rank'));
      } else {
        card.insertAdjacentHTML(
          'beforeend',
          `<div class="stat-inline-rank"><div class="radial-loading">—</div></div>`
        );
      }
      card.classList.toggle('spi-stat-specialty', !!(specialty && key === specialty));
    });
  }

  function rankingStatValueFromRow(row, sk) {
    if (!row) return 0;
    const v = row[sk];
    if (v != null && v !== '') return Number(v) || 0;
    if (sk === 'ATK') return Number(row.Attack != null ? row.Attack : row.ATK) || 0;
    if (sk === 'DEF') return Number(row.Defense != null ? row.Defense : row.DEF) || 0;
    if (sk === 'MOB') return Number(row.Mobility != null ? row.Mobility : row.MOB) || 0;
    return 0;
  }

  function countRowsAheadSorted(rows, sk, myVal, myName, myId) {
    let ahead = 0;
    const nm = String(myName || '');
    const tid = String(myId || '');
    if (!rows || !rows.length) return ahead;
    for (let i = 0; i < rows.length; i++) {
      const x = rows[i];
      const xv = rankingStatValueFromRow(x, sk);
      if (xv > myVal) {
        ahead++;
        continue;
      }
      if (xv < myVal) continue;
      const xn = String((x && x.name) || '');
      const xid = String((x && x.id) || '');
      if (xn < nm) {
        ahead++;
        continue;
      }
      if (xn > nm) continue;
      if (xid.localeCompare(tid) < 0) ahead++;
    }
    return ahead;
  }

  async function fetchUnitRowForRanks(id) {
    const lang = uiLang();
    const mode = board === 'ssp' ? 'ssp' : 'sp';
    // id search includes transform alternates that ranking_bulk otherwise skips.
    const url =
      `/api/units?lang=${encodeURIComponent(lang)}` +
      `&q=${encodeURIComponent(id)}&stat_mode=${mode}&per_page=20&page=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const rows = Array.isArray(d && d.rows) ? d.rows : [];
    return rows.find((x) => String(x && x.id) === String(id)) || null;
  }

  async function warmSpiRankIndex(kind) {
    const ck = rankIndexCacheKey(kind);
    if (_spiRankIndexByKey[ck]) return _spiRankIndexByKey[ck];
    if (_spiRankIndexPromises[ck]) return _spiRankIndexPromises[ck];
    _spiRankIndexPromises[ck] = (async () => {
      const lang = uiLang();
      const keys = entityStatKeys(kind);
      let url;
      if (kind === 'character') {
        url =
          `/api/characters?lang=${encodeURIComponent(lang)}` +
          `&sort=Ranged&dir=desc&sp=1&stat_bounds=1&ranking_bulk=1&per_page=50000&page=1`;
      } else {
        const mode = board === 'ssp' ? 'ssp' : 'sp';
        url =
          `/api/units?lang=${encodeURIComponent(lang)}` +
          `&sort=HP&dir=desc&stat_mode=${mode}&stat_bounds=1&ranking_bulk=1&per_page=50000&page=1`;
      }
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const all = Array.isArray(d && d.rows) ? d.rows : [];
      const total = Number((d && d.total) || 0) || all.length;
      const out = {};
      keys.forEach((sk) => {
        const arr = all.slice().sort((a, b) => {
          const av = rankingStatValueFromRow(a, sk);
          const bv = rankingStatValueFromRow(b, sk);
          if (bv !== av) return bv - av;
          const an = String((a && a.name) || '');
          const bn = String((b && b.name) || '');
          if (an !== bn) return an.localeCompare(bn);
          return String((a && a.id) || '').localeCompare(String((b && b.id) || ''));
        });
        const byId = new Map();
        arr.forEach((x, i) => {
          byId.set(String((x && x.id) || ''), {
            rank: i + 1,
            value: rankingStatValueFromRow(x, sk),
            total: total || arr.length,
          });
        });
        out[sk] = { total: total || arr.length, byId, orderedRows: arr };
      });
      _spiRankIndexByKey[ck] = out;
      return out;
    })().finally(() => {
      delete _spiRankIndexPromises[ck];
    });
    return _spiRankIndexPromises[ck];
  }

  async function loadEntityStatRanks(row, kind) {
    if (!row || !row.id) return;
    const id = String(row.id);
    const modalKey = `${kind}:${id}:${rankIndexCacheKey(kind)}`;
    _spiModalEntityKey = modalKey;
    try {
      const idx = await warmSpiRankIndex(kind);
      if (_spiModalEntityKey !== modalKey) return;
      const keys = entityStatKeys(kind);
      const missingFromList = keys.some((sk) => !(idx[sk] && idx[sk].byId.has(id)));
      let apiRow = null;
      if (missingFromList && kind === 'unit') {
        try {
          apiRow = await fetchUnitRowForRanks(id);
        } catch (_) {
          apiRow = null;
        }
        if (_spiModalEntityKey !== modalKey) return;
      }
      const byStat = {};
      keys.forEach((sk) => {
        const hit = idx[sk] && idx[sk].byId.get(id);
        if (hit) {
          byStat[sk] = {
            rank: hit.rank,
            total: hit.total || (idx[sk] && idx[sk].total) || 0,
            value: hit.value,
          };
          return;
        }
        // Transform alts are omitted from /api/units ranking_bulk — insert by value like detail page.
        let myVal = entityStatValue(row, sk);
        if (myVal == null && apiRow) myVal = rankingStatValueFromRow(apiRow, sk);
        if (myVal == null || !idx[sk] || !idx[sk].orderedRows) return;
        const ord = idx[sk].orderedRows;
        const total = idx[sk].total || ord.length;
        const rank = countRowsAheadSorted(ord, sk, myVal, row.name || '', id) + 1;
        byStat[sk] = { rank, total, value: myVal };
      });
      patchEntityStatCards(
        $('#spiEntityStats'),
        byStat,
        kind,
        kind === 'character' ? row.specialty : ''
      );
    } catch (_) {
      const host = $('#spiEntityStats');
      if (host && _spiModalEntityKey === modalKey) {
        const note = host.querySelector('.spi-dossier-note');
        if (note) note.textContent = 'Stats shown. Ranking unavailable right now.';
        host.querySelectorAll('.stat-inline-rank.is-loading').forEach((el) => {
          el.innerHTML = `<div class="radial-loading">—</div>`;
        });
      }
    }
  }

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
    if (r === 'SSR' || r === 'UR' || !!row.is_ultimate) return true;
    // Pilots: many SRs compete with SSRs — show SR by default; N/R still opt-in.
    if (entity === 'characters' && r === 'SR') return true;
    return false;
  }

  function syncLowRarityLabel() {
    const low = $('#spiShowLowRarity');
    if (!low) return;
    const wrap = low.closest('label');
    if (!wrap) return;
    const text = entity === 'characters' ? ' Show N/R' : ' Show N/R/SR';
    // Keep the checkbox as first child; replace trailing label text nodes.
    const nodes = Array.from(wrap.childNodes);
    nodes.forEach((n) => {
      if (n.nodeType === 3) wrap.removeChild(n);
    });
    wrap.appendChild(document.createTextNode(text));
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
    // Role 0 = NPC / story-only — never show on this guide.
    if (String(row.role_id || '') === '0') return false;
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

  const SOURCE_OPTS = [
    { value: 'all', label: 'All sources' },
    { value: 'gacha', label: 'Gacha' },
    { value: 'event', label: 'Event / other' },
    { value: 'dev', label: 'Development' },
  ];

  function closeSpiFilterPanels() {
    ['spiSource', 'spiTag', 'spiEr'].forEach((pfx) => {
      const panel = document.getElementById(pfx + 'FilterPanel');
      const btn = document.getElementById(pfx + 'FilterBtn');
      if (panel) panel.hidden = true;
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.toggle('active', pfx === 'spiSource' ? sourceFilter !== 'all' : pfx === 'spiTag' ? !!tagFilter : !!erFilter);
      }
    });
  }

  function toggleSpiFilterPanel(pfx, ev) {
    if (ev) ev.stopPropagation();
    const panel = document.getElementById(pfx + 'FilterPanel');
    const btn = document.getElementById(pfx + 'FilterBtn');
    if (!panel || !btn) return;
    const willOpen = panel.hidden;
    closeSpiFilterPanels();
    if (willOpen) {
      panel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      btn.classList.add('active');
      if (pfx === 'spiTag' || pfx === 'spiEr') {
        const search = panel.querySelector('.filter-dd-search');
        if (search) {
          search.value = '';
          filterDdRows(panel, '');
          setTimeout(() => search.focus(), 0);
        }
      }
    }
  }

  function filterDdRows(panel, q) {
    const needle = String(q || '')
      .trim()
      .toLowerCase();
    const rows = panel.querySelectorAll('.rarity-filter-row[data-filter-text]');
    let shown = 0;
    rows.forEach((row) => {
      const ok = !needle || String(row.dataset.filterText || '').includes(needle);
      row.hidden = !ok;
      if (ok) shown += 1;
    });
    const empty = panel.querySelector('.spi-dd-empty');
    if (empty) empty.hidden = shown > 0 || !needle;
  }

  function setFilterBtnLabel(labelEl, text, active) {
    if (!labelEl) return;
    labelEl.innerHTML = `<span class="source-filter-btn-plain">${esc(text)}</span>`;
    const btn = labelEl.closest('.rarity-filter-btn');
    if (btn) btn.classList.toggle('active', !!active);
  }

  function updateSourceFilterLabel() {
    const opt = SOURCE_OPTS.find((o) => o.value === sourceFilter) || SOURCE_OPTS[0];
    setFilterBtnLabel($('#spiSourceFilterLabel'), opt.label, sourceFilter !== 'all');
  }

  function updateTagFilterLabel() {
    setFilterBtnLabel($('#spiTagFilterLabel'), tagFilter || 'No tag filter', !!tagFilter);
  }

  function updateErFilterLabel() {
    let text = 'No ER Expert filter';
    if (erFilter && payload) {
      const ers = payload.er_expert_filters || [];
      const hit = ers.find((e) => String(e.id) === String(erFilter));
      if (hit) {
        text =
          entity === 'characters'
            ? hit.character_label || hit.label || hit.id
            : hit.unit_label || hit.label || hit.id;
      } else {
        text = String(erFilter);
      }
    }
    setFilterBtnLabel($('#spiErFilterLabel'), text, !!erFilter);
  }

  function ddRowHtml(value, label, checked, group) {
    const id = `spiDd_${group}_${String(value).replace(/[^a-zA-Z0-9_-]/g, '_') || 'all'}`;
    return `<label class="rarity-filter-row" data-filter-text="${esc(String(label).toLowerCase())}">
      <input type="radio" name="spiDd_${esc(group)}" id="${esc(id)}" value="${esc(value)}" ${checked ? 'checked' : ''}>
      <span class="rarity-filter-all-label">${esc(label)}</span>
    </label>`;
  }

  function fillSourcePanel() {
    const panel = $('#spiSourceFilterPanel');
    if (!panel) return;
    panel.innerHTML = SOURCE_OPTS.map((o) => ddRowHtml(o.value, o.label, sourceFilter === o.value, 'source')).join('');
    panel.querySelectorAll('input[type="radio"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        sourceFilter = inp.value || 'all';
        updateSourceFilterLabel();
        closeSpiFilterPanels();
        render();
      });
    });
  }

  function fillTagPanel() {
    const panel = $('#spiTagFilterPanel');
    if (!panel) return;
    const tags = (payload && payload.tag_catalog) || [];
    const rows =
      ddRowHtml('', 'No tag filter', !tagFilter, 'tag') +
      tags.map((t) => ddRowHtml(t, t, tagFilter === t, 'tag')).join('');
    panel.innerHTML = `<input type="search" class="filter-dd-search" placeholder="Search tags…" aria-label="Search tags" autocomplete="off">
      <div class="spi-dd-scroll">${rows}<div class="spi-dd-empty" hidden>No matching tags</div></div>`;
    const search = panel.querySelector('.filter-dd-search');
    if (search) {
      search.addEventListener('input', () => filterDdRows(panel, search.value));
      search.addEventListener('click', (e) => e.stopPropagation());
    }
    panel.querySelectorAll('input[type="radio"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        tagFilter = inp.value || '';
        updateTagFilterLabel();
        closeSpiFilterPanels();
        render();
      });
    });
  }

  function fillErPanel() {
    const panel = $('#spiErFilterPanel');
    if (!panel) return;
    const ers = (payload && payload.er_expert_filters) || [];
    const rows =
      ddRowHtml('', 'No ER Expert filter', !erFilter, 'er') +
      ers
        .map((e) => {
          const label =
            entity === 'characters'
              ? e.character_label || e.label || e.id
              : e.unit_label || e.label || e.id;
          return ddRowHtml(String(e.id), label, String(erFilter) === String(e.id), 'er');
        })
        .join('');
    panel.innerHTML = `<input type="search" class="filter-dd-search" placeholder="Search ER Expert…" aria-label="Search ER Expert stages" autocomplete="off">
      <div class="spi-dd-scroll">${rows}<div class="spi-dd-empty" hidden>No matching stages</div></div>`;
    const search = panel.querySelector('.filter-dd-search');
    if (search) {
      search.addEventListener('input', () => filterDdRows(panel, search.value));
      search.addEventListener('click', (e) => e.stopPropagation());
    }
    panel.querySelectorAll('input[type="radio"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        erFilter = inp.value || '';
        updateErFilterLabel();
        closeSpiFilterPanels();
        render();
      });
    });
  }

  function fillFilterSelects() {
    fillSourcePanel();
    fillTagPanel();
    fillErPanel();
    updateSourceFilterLabel();
    updateTagFilterLabel();
    updateErFilterLabel();
  }

  function renderScoringGuide() {
    const g = (payload && payload.scoring_guide) || {};
    $('#spiScoringIntro').textContent = g.intro || 'Point-sum investment guide for SP/SSP chips.';
    const ov = $('#spiScoringOverrides');
    ov.innerHTML = (g.overrides || []).map((t) => `<li>${esc(t)}</li>`).join('');
    const gaps = $('#spiScoringGaps');
    gaps.innerHTML = (g.gaps || []).map((t) => `<li>${esc(t)}</li>`).join('');
    const criteriaEl = $('#spiCriteria');
    if (criteriaEl) {
      const applyFilter = entity === 'characters' ? 'pilots' : 'units';
      const roleFilter = entity === 'characters' ? null : role;
      const visible = (g.criteria || []).filter((c) => {
        if (String(c.id || '') === 'not_scored') return false;
        const apps = c.applies || [];
        if (apps.length && !apps.includes(applyFilter)) return false;
        if (roleFilter) {
          const roles = c.roles || [];
          if (roles.length && !roles.includes(roleFilter) && !roles.includes('all')) return false;
        }
        return true;
      });
      criteriaEl.innerHTML = visible
        .map((c) => {
          const obj = c.objective !== false;
          const badge = obj
            ? `<span class="spi-criteria-badge">Objective</span>`
            : `<span class="spi-criteria-badge spi-criteria-badge--soft">Estimate</span>`;
          const applies = (c.applies || [])
            .map((a) => `<span class="spi-criteria-badge spi-criteria-badge--soft">${esc(a)}</span>`)
            .join('');
          const roleBadges = (c.roles || [])
            .filter((r) => r && r !== 'all')
            .map((r) => `<span class="spi-criteria-badge spi-criteria-badge--soft">${esc(r)}</span>`)
            .join('');
          const rows = (c.rows || [])
            .map(
              (r) => `<tr><th scope="row">${esc(r.when || '')}</th><td>${esc(r.result || r.points || '')}</td></tr>`
            )
            .join('');
          const title = String(c.title || c.id || '')
            .replace(/\bTraitType\b/g, 'effect')
            .replace(/\bCharacterSkillTraitType\b/g, 'skill effect');
          const summary = String(c.summary || '')
            .replace(/\bTraitType\b/g, 'effect')
            .replace(/\bCharacterSkillTraitType\b/g, 'skill effect')
            .replace(/\bWeaponTraitType\b/g, 'weapon effect')
            .replace(/\bOccupiedAreaId\b/g, 'footprint');
          return `<article class="spi-criteria-block" data-criteria="${esc(c.id || '')}">
            <div class="spi-criteria-head">
              <h3 class="spi-criteria-title">${esc(title)}</h3>
              ${badge}${applies}${roleBadges}
            </div>
            ${summary ? `<p class="spi-criteria-summary">${esc(summary)}</p>` : ''}
            ${rows ? `<table class="spi-criteria-table"><tbody>${rows}</tbody></table>` : ''}
          </article>`;
        })
        .join('');
    }
    const cuts = $('#spiLetterCutoffs');
    const labels = g.bucket_labels || payload.bucket_labels || {};
    const isPilot = entity === 'characters';
    const spCuts = isPilot
      ? g.pilot_letter_cutoffs || g.letter_cutoffs || []
      : g.letter_cutoffs || [];
    const urCuts = isPilot
      ? g.ur_pilot_letter_cutoffs || []
      : g.ur_letter_cutoffs || [];
    const fmtCuts = (rows, title) => {
      if (!rows || !rows.length) return '';
      const bits = rows
        .map((c) => `<span class="spi-letter-chip ${letterClass(c.letter)}">${esc(c.letter)} ≥ ${esc(c.min)}</span>`)
        .join('');
      return `<div class="spi-cutoff-group"><span class="spi-cutoff-group-label">${esc(title)}</span>${bits}</div>`;
    };
    const bucketBits = Object.keys(labels)
      .map((k) => `<span class="spi-letter-chip">${esc(labels[k])}</span>`)
      .join('');
    cuts.innerHTML =
      fmtCuts(spCuts, 'SP-eligible grades') +
      fmtCuts(urCuts, 'UR / Ultimate grades') +
      `<div class="spi-cutoff-group"><span class="spi-cutoff-group-label">Buckets</span>${bucketBits}</div>`;
  }

  function syncBoardTabsVisibility() {
    const boardTabs = $('#spiBoardTabs');
    const mapWrap = $('#spiMapOnlyWrap');
    if (entity === 'characters') {
      if (boardTabs) boardTabs.style.display = 'none';
      board = 'sp';
      if (mapWrap) mapWrap.style.display = 'none';
    } else {
      if (boardTabs) boardTabs.style.display = '';
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
              <span class="spi-chip letter ${letterClass(r.letter)}">${esc(r.letter || '?')}</span>
              <span class="spi-chip score">${esc(r.total)} Pt</span>
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
    const cohortNote = !hasSpOnly ? ' · UR/Ultimate use a separate grade scale' : '';
    statusEl.textContent = `Showing ${shown} of ${totalBoard} · ${label} · ${role}${cohortNote}`;
  }

  function ptsBadge(pts) {
    const n = Number(pts) || 0;
    const sign = n > 0 ? `+${n}` : String(n);
    let tone = 'zero';
    if (n > 0) tone = 'pos';
    else if (n < 0) tone = 'neg';
    return `<span class="spi-pts spi-pts-${tone}">${esc(sign)}</span>`;
  }

  function letterClass(letter) {
    const L = String(letter || '').trim();
    if (L === 'S+') return 'letter-S-plus';
    if (L === 'S') return 'letter-S';
    if (L === 'A+') return 'letter-A-plus';
    if (L === 'A') return 'letter-A';
    if (L === 'B+') return 'letter-B-plus';
    if (L === 'B') return 'letter-B';
    if (L === 'C') return 'letter-C';
    if (L === 'D') return 'letter-D';
    return 'letter-E';
  }

  function letterChip(letter) {
    const L = letter || '?';
    return `<span class="spi-chip letter ${letterClass(L)}" title="Grade ${esc(L)}">${esc(L)}</span>`;
  }

  function tipAttr(text) {
    return text ? ` title="${esc(text)}" data-tip="${esc(text)}"` : '';
  }

  function breakdownEntries(bd) {
    const out = [];
    Object.keys(BREAKDOWN_META).forEach((k) => {
      if (bd[k] == null) return;
      const meta = BREAKDOWN_META[k];
      const pts = Number(bd[k]) || 0;
      if (meta.hideIfZero && pts === 0) return;
      out.push({ key: k, label: meta.label, tip: meta.tip || '', pts });
    });
    // Include any unknown keys that actually scored
    Object.keys(bd || {}).forEach((k) => {
      if (BREAKDOWN_META[k]) return;
      const pts = Number(bd[k]) || 0;
      if (!pts) return;
      out.push({ key: k, label: k.replace(/_/g, ' '), tip: '', pts });
    });
    out.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts) || a.label.localeCompare(b.label));
    return out;
  }

  function renderScoreViz(row) {
    const entries = breakdownEntries(row.breakdown || {});
    if (!entries.length) {
      return `<p class="spi-dossier-empty">No scored axes for this entry.</p>`;
    }
    const maxAbs = Math.max(1, ...entries.map((e) => Math.abs(e.pts)));
    const bars = entries
      .map((e) => {
        const pct = Math.round((Math.abs(e.pts) / maxAbs) * 100);
        const tone = e.pts > 0 ? 'pos' : e.pts < 0 ? 'neg' : 'zero';
        return `<div class="spi-bar-row" ${tipAttr(e.tip)}>
          <span class="spi-bar-label">${esc(e.label)}</span>
          <div class="spi-bar-track"><span class="spi-bar-fill spi-bar-${tone}" style="width:${pct}%"></span></div>
          ${ptsBadge(e.pts)}
        </div>`;
      })
      .join('');
    return `<div class="spi-score-viz">
      <div class="spi-score-bars" aria-label="Score contribution chart">${bars}</div>
    </div>`;
  }

  function renderRecommendedUnits(row) {
    if (row.is_sd_linked) {
      return `<section class="spi-dossier-section">
        <h4 class="spi-dossier-h">Recommended Mobile Suits</h4>
        <p class="spi-dossier-empty">SD characters are permanently linked to their Mobile Suit and are not interchangeable; no recommendation list.</p>
      </section>`;
    }
    const units = row.recommended_units || [];
    const recPts = (row.breakdown && row.breakdown.recommend_ms) || 0;
    if (!units.length && !recPts) {
      return `<section class="spi-dossier-section">
        <h4 class="spi-dossier-h">Recommended Mobile Suits</h4>
        <p class="spi-dossier-empty">No B+ or higher matches from this pilot’s tag / series gates and specialty.</p>
      </section>`;
    }
    const cards = units
      .map((u) => {
        const thumb = renderFramedThumb(u, 'unit');
        return `<a class="spi-rec-card" href="/u/${encodeURIComponent(u.id)}" target="_blank" rel="noopener">
          ${thumb}
          <div class="spi-rec-meta">
            <span class="spi-rec-name">${esc(u.name || u.id)}</span>
            <span class="spi-chip letter ${letterClass(u.letter)}">${esc(u.letter || '?')}</span>
          </div>
        </a>`;
      })
      .join('');
    return `<section class="spi-dossier-section">
      <div class="spi-dossier-section-head">
        <h4 class="spi-dossier-h">Recommended Mobile Suits <span class="spi-dossier-h-sub">B+ and up</span></h4>
        ${ptsBadge(recPts)}
      </div>
      <p class="spi-dossier-note">Matched by ability tag/series gates and pilot specialty${row.specialty ? ` (${esc(row.specialty)})` : ''}. Defense units skip the specialty check.</p>
      <div class="spi-rec-grid">${cards || '<p class="spi-dossier-empty">None on the current board.</p>'}</div>
    </section>`;
  }

  function syncSearchClear() {
    const input = $('#spiSearch');
    const clearBtn = $('#spiSearchClear');
    const wrap = input && input.closest('.filter-input-wrap');
    const has = !!(input && String(input.value || '').trim());
    if (wrap) wrap.classList.toggle('has-value', has);
    if (clearBtn) clearBtn.hidden = !has;
  }

  function applyFilterDom() {
    document.querySelectorAll('.role-filter-btn[data-entity]').forEach((b) => {
      b.classList.toggle('active', b.dataset.entity === entity);
    });
    document.querySelectorAll('#spiBoardTabs .role-filter-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.board === board);
    });
    document.querySelectorAll('.spi-role-seg .role-filter-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.role === role);
    });
    const low = $('#spiShowLowRarity');
    if (low) low.checked = showLowRarity;
    syncLowRarityLabel();
    const map = $('#spiMapOnly');
    if (map) map.checked = mapOnly;
    const sp = $('#spiHasSpOnly');
    if (sp) sp.checked = hasSpOnly;
    updateSourceFilterLabel();
    updateTagFilterLabel();
    updateErFilterLabel();
    const search = $('#spiSearch');
    if (search) search.value = searchQuery;
    syncSearchClear();
    syncBoardTabsVisibility();
  }

  function resetFilters() {
    board = 'sp';
    role = 'Attack';
    showLowRarity = false;
    mapOnly = false;
    hasSpOnly = true;
    sourceFilter = 'all';
    tagFilter = '';
    erFilter = '';
    searchQuery = '';
    applyFilterDom();
    fillFilterSelects();
    render();
  }

  function openModal(row) {
    if (!row) return;
    const isPilot = entity === 'characters';
    const detailPath = isPilot ? '/c/' : '/u/';
    const kind = isPilot ? 'character' : 'unit';
    const card = $('#spiModal').querySelector('.spi-modal-card');
    if (card) {
      card.classList.add('spi-modal-card--wide');
      card.classList.toggle('spi-modal-card--pilot', isPilot);
    }

    const cohort =
      row.letter_cohort === 'ur'
        ? '<span class="spi-chip spi-chip-cohort">UR / Ultimate scale</span>'
        : row.has_sp
          ? '<span class="spi-chip spi-chip-cohort">SP-eligible scale</span>'
          : '';

    const header = `<div class="spi-dossier-head">
      <div class="spi-dossier-thumb">${renderFramedThumb(row, kind)}</div>
      <div class="spi-dossier-head-text">
        <h3 class="spi-modal-title" id="spiModalTitle">${esc(row.name || row.id)}</h3>
        <p class="spi-modal-sub">${esc(row.role)}${isPilot && row.specialty ? ` · ${esc(row.specialty)}` : ''} · ${esc((row.mode || board) || '').toUpperCase()}</p>
        <div class="spi-dossier-badges">
          ${letterChip(row.letter)}
          <span class="spi-chip score">Total: ${esc(row.total)} Pt</span>
          ${cohort}
        </div>
      </div>
    </div>`;

    const specialtyBlock = renderEntityStatsBlock(row, kind);

    const scoreBlock = `<section class="spi-dossier-section spi-dossier-section--score">
      <h4 class="spi-dossier-h">Score breakdown <span class="spi-dossier-h-sub">hover a bar for details</span></h4>
      ${renderScoreViz(row)}
    </section>`;

    const recBlock = isPilot ? renderRecommendedUnits(row) : '';

    $('#spiModalBody').innerHTML = `
      ${header}
      ${specialtyBlock}
      ${scoreBlock}
      ${recBlock}
      <div class="spi-modal-actions">
        <a href="${detailPath}${encodeURIComponent(row.id)}" target="_blank" rel="noopener">Open in database</a>
      </div>`;
    $('#spiModal').hidden = false;
    void loadEntityStatRanks(row, kind);
  }

  function closeModal() {
    _spiModalEntityKey = '';
    $('#spiModal').hidden = true;
  }

  function bindControls() {
    document.querySelectorAll('.role-filter-btn[data-entity]').forEach((btn) => {
      btn.addEventListener('click', () => {
        entity = btn.dataset.entity || 'units';
        applyFilterDom();
        fillFilterSelects();
        renderScoringGuide();
        render();
      });
    });
    document.querySelectorAll('#spiBoardTabs .role-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        board = btn.dataset.board || 'sp';
        applyFilterDom();
        render();
      });
    });
    document.querySelectorAll('.spi-role-seg .role-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        role = btn.dataset.role || 'Attack';
        applyFilterDom();
        renderScoringGuide();
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
    $('#spiSourceFilterBtn').addEventListener('click', (e) => toggleSpiFilterPanel('spiSource', e));
    $('#spiTagFilterBtn').addEventListener('click', (e) => toggleSpiFilterPanel('spiTag', e));
    $('#spiErFilterBtn').addEventListener('click', (e) => toggleSpiFilterPanel('spiEr', e));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#spiSourceWrap, #spiTagWrap, #spiErWrap')) closeSpiFilterPanels();
    });
    let t = null;
    $('#spiSearch').addEventListener('input', (e) => {
      syncSearchClear();
      clearTimeout(t);
      t = setTimeout(() => {
        searchQuery = e.target.value || '';
        render();
      }, 120);
    });
    const clearBtn = $('#spiSearchClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchQuery = '';
        const input = $('#spiSearch');
        if (input) input.value = '';
        syncSearchClear();
        render();
        if (input) input.focus();
      });
    }
    const resetBtn = $('#spiResetFilters');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.spi-card');
      if (!card) return;
      openModal(rowById.get(String(card.dataset.id)));
    });
    $('#spiModal').addEventListener('click', (e) => {
      if (e.target && e.target.getAttribute('data-close')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSpiFilterPanels();
        closeModal();
      }
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
      const apiUrl = window.__SPI_PREVIEW__ ? '/api/sp_investment?preview=1' : '/api/sp_investment';
      const r = await fetch(apiUrl);
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
