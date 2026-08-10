(function () {
  'use strict';

  const BUCKET_ORDER = ['priority', 'recommended', 'solid', 'situational', 'niche'];
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
  const RARITY_FILTER_ICONS = {
    UR: '/static/images/Rarity/UI_Common_RarityIcon_UR.webp',
    SSR: '/static/images/Rarity/UI_Common_RarityIcon_SSR.webp',
    SR: '/static/images/Rarity/UI_Common_RarityIcon_SR.webp',
    R: '/static/images/Rarity/UI_Common_RarityIcon_R.webp',
    N: '/static/images/Rarity/UI_Common_RarityIcon_N.webp',
  };
  const SPI_SKILL_FILTER_ICON = '/static/images/Trait/trait_10150101.webp';
  const SPI_ABIL_FILTER_ICON = '/static/images/Trait/trait_10190102.webp';

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
      label: '2×2',
      tip: 'Occupied area is 2×2. Mild upside (+1) — wider MAP and buff coverage usually outweighs placement inconvenience.',
      hideIfZero: true,
    },
    terrain: {
      label: 'Terrain coverage',
      tip: 'Need Space plus Land or Atmospheric for a neutral (0) score — Space+Atmos with no Land is OK (e.g. Byarlant). Extra terrains add points. Missing Space, or both Land and Atmospheric, is −3. A 0 here still means the floor was met; it is not skipped.',
    },
    rarity: {
      label: 'Rarity',
      tip: 'Units: N/R/SR get a penalty so they do not share top letters with SSR. Pilots use a softer table — SR is not buried. SSR and Ultimate start even before other axes. Non-Ultimate UR kits are omitted from this guide.',
    },
    transform: {
      label: 'Transform advantage',
      tip: 'Only counts when the alternate form unlocks deployable terrain, higher MOV, longer range, higher weapon power, or adds a MAP vs the base form. Transforming alone is not a bonus.',
    },
    map: {
      label: 'MAP weapons',
      tip: 'Damage MAP +1 presence; dash/MovingAttack, ammo 2+, and coverage add more. Recovery / ally-support MAP (MP supply) scores +1 separately — not as a damage MAP. Attack can score up to +4; Defense/Support cap at +2.',
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
      tip: 'Bonus from this pilot’s best matching MS letter on this guide (A / A+ / S / S+ only — B+ no longer scores), plus a small multi-match bonus.',
    },
    linked_pilot: {
      label: 'Affinity pilot pool',
      tip: 'How many same-role SSR+ pilots have piloting-tag / EX-pair affinity for this MS. Defenders do not count for attacker MS.',
    },
    ur_pilot_dependence: {
      label: 'UR pilot dependence',
      tip: 'Mild −1 when the MS recommend pilot is UR/Ultimate (peak kit often assumes that pilot). Still usable with SSR affinity pilots.',
      hideIfZero: true,
    },
    max_tension_weapon: {
      label: 'Max Vigor weapon',
      tip: 'Strongest weapon is Max Vigor only (beats unrestricted best) — MP/pilot-gated, so it is a mild penalty vs always-usable power.',
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
    hp: {
      label: 'HP',
      tip: 'Attack/Support: upside-only (high HP helps, low HP is not punished). Defense still taxes low HP.',
    },
    en: {
      label: 'EN',
      tip: 'SSP Attack only — upside for high EN so juice-hungry kits are rewarded. Not scored on SP, and never a penalty.',
      hideIfZero: true,
    },
    atk: { label: 'ATK', tip: 'SP-grown ATK band for this role. Attack units score this heavily.' },
    def: {
      label: 'DEF',
      tip: 'SP-grown DEF band. Scored for Defense (and lightly for Support); not scored for Attack.',
      hideIfZero: true,
    },
    mob: {
      label: 'MOB',
      tip: 'Mobility (MOB). Affects Accuracy and Evasion. Scored from SP-grown MOB for this Unit Type — Support Type values it more; Attack Type treats it as a softer secondary vs ATK.',
    },
    stat_outlier: {
      label: 'Stat outlier',
      tip: 'Small niche bonus when a secondary stat is clearly exceptional for the role (e.g. very high Attack HP/EN). Cap +2.',
      hideIfZero: true,
    },
    special_defense: {
      label: 'Special defense',
      tip: 'Presence bonus for ability mitigation beyond the shield mechanism (damage taken down, barriers, negation). No missing penalty.',
      hideIfZero: true,
    },
    shield: {
      label: 'Shield',
      tip: 'Has a shield mechanism (~20% damage neglect). Defense units lose points if they lack one.',
    },
    movement: { label: 'Move', tip: 'MOV 5 is the modern baseline; 4 is below average. Defense still values high Move for support-defense coverage.' },
    movement_followup: {
      label: 'Movement follow-up',
      tip: 'After-move MAP and/or Chance Step-style follow-up movement (can stack, capped).',
    },
    weapon_range: {
      label: 'Weapon range',
      tip: 'Longest non-MAP weapon range. Short max range is a soft penalty (−1 to −3). Support baseline is range 5.',
    },
    weapon_power: {
      label: 'Weapon power',
      tip: 'Strongest non-MAP Lv5 weapon power on this SP or SSP board.',
    },
    weapon_bonus: {
      label: 'Weapon bonus',
      tip: 'Conditional boost on the strongest attack only. Crit damage is mild; crit rate needs ~20%+; guaranteed crit is stronger.',
    },
    dual_attack_attr: {
      label: 'Multi-type weapon',
      tip: 'Strongest attack uses 2+ of Ranged/Melee/Awaken (e.g. Enhanced ZZ).',
    },
    signature_weapon: {
      label: 'Signature kit',
      tip: 'Allowlisted Lupus / Lupus Rex family bonus for their uniquely strong weapon kits.',
    },
    source: {
      label: 'Acquisition',
      tip: 'How the Unit is obtained: Development Unit and Other get +1; Units from Unit Assembly stay 0.',
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
  let _spiRestoreRow = null;
  let _spiOpeningDetail = false;

  function fmtN(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return Math.round(v).toLocaleString('en-US');
  }

  const LANG_STORAGE_KEY = 'ggen_lang';

  function persistLang(l) {
    try {
      if (l) localStorage.setItem(LANG_STORAGE_KEY, String(l));
    } catch (e) {}
  }

  function readPersistedLang() {
    try {
      return localStorage.getItem(LANG_STORAGE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function uiLang() {
    let raw = '';
    if (isEmbedded() && window.S && S.lang) raw = S.lang;
    else raw = document.documentElement.getAttribute('data-ui-lang') || readPersistedLang() || 'EN';
    if (window.SpiI18n && typeof SpiI18n.normLang === 'function') return SpiI18n.normLang(raw);
    const k = String(raw || 'EN').toUpperCase();
    if (k === 'JP') return 'JA';
    if (k === 'JA' || k === 'TW' || k === 'HK' || k === 'EN') return k;
    return 'EN';
  }

  function t(key, vars) {
    return (window.SpiI18n && SpiI18n.t(uiLang(), key, vars)) || key;
  }

  function tRole(roleKey) {
    return (window.SpiI18n && SpiI18n.tRole(uiLang(), roleKey)) || roleKey;
  }

  function tBucket(key) {
    return (window.SpiI18n && SpiI18n.tBucket(uiLang(), key)) || key;
  }

  function breakdownMetaFor(key) {
    const base = BREAKDOWN_META[key] || {};
    const i18nMeta = (window.SpiI18n && SpiI18n.breakdownMeta(uiLang(), key)) || null;
    return Object.assign({}, base, i18nMeta || {});
  }

  function isEmbedded() {
    return !!document.getElementById('panel-investment_priority');
  }

  function spiRoot() {
    return document.getElementById('panel-investment_priority') || document.querySelector('.spi-shell') || document;
  }

  function applyLangStatic() {
    const lc = uiLang();
    if (!isEmbedded()) {
      document.documentElement.setAttribute('data-ui-lang', lc);
      const htmlLang = lc === 'JA' ? 'ja' : lc === 'TW' || lc === 'HK' ? 'zh' : 'en';
      document.documentElement.setAttribute('lang', htmlLang);
      document.title = t('page_title');
    }

    const root = spiRoot();
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });
    root.querySelectorAll('[data-i18n-bucket]').forEach((el) => {
      const key = el.getAttribute('data-i18n-bucket');
      if (key) el.textContent = tBucket(key);
    });
    root.querySelectorAll('[data-i18n-role]').forEach((el) => {
      const key = el.getAttribute('data-i18n-role');
      if (key) el.textContent = tRole(key);
    });

    updateRarityFilterLabel();

    root.querySelectorAll('.spi-lang-btn').forEach((btn) => {
      const btnLang =
        window.SpiI18n && typeof SpiI18n.normLang === 'function'
          ? SpiI18n.normLang(btn.getAttribute('data-lang'))
          : String(btn.getAttribute('data-lang') || '').toUpperCase();
      btn.classList.toggle('active', btnLang === lc);
      btn.setAttribute('aria-pressed', btnLang === lc ? 'true' : 'false');
    });

    updateSourceFilterLabel();
    updateTagFilterLabel();
    updateSkillFilterLabel();
    updateAbilFilterLabel();
    updateErFilterLabel();
  }

  async function setLang(lc) {
    const norm =
      window.SpiI18n && typeof SpiI18n.normLang === 'function'
        ? SpiI18n.normLang(lc)
        : String(lc || 'EN').toUpperCase();
    if (norm === uiLang() && document.documentElement.getAttribute('data-ui-lang') === norm) {
      applyLangStatic();
      return;
    }
    persistLang(norm);
    document.documentElement.setAttribute('data-ui-lang', norm);
    tagFilter = '';
    updateTagFilterLabel();
    applyLangStatic();
    await fetchPayload();
  }

  function entityStatKeys(kind) {
    return kind === 'character' ? CHAR_STAT_KEYS : UNIT_STAT_KEYS;
  }

  function entityStatLabel(kind, key) {
    if (kind === 'character') return key;
    if (key === 'MOB') return t('stat_mob') || 'MOB';
    if (key === 'ATK') return t('stat_atk') || 'ATK';
    if (key === 'DEF') return t('stat_def') || 'DEF';
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

  function roleApiId(rowOrRole) {
    if (rowOrRole && typeof rowOrRole === 'object') {
      const rid = String(rowOrRole.role_id || '').trim();
      if (rid === '1' || rid === '2' || rid === '3') return rid;
      return roleApiId(rowOrRole.role);
    }
    const map = { Attack: '1', Defense: '2', Support: '3' };
    return map[String(rowOrRole || '').trim()] || '';
  }

  function rankIndexCacheKey(kind, roleId) {
    const rid = String(roleId || '').trim();
    const rolePart = rid === '1' || rid === '2' || rid === '3' ? rid : 'all';
    if (kind === 'character') return `characters:sp:${rolePart}`;
    return `units:${board === 'ssp' ? 'ssp' : 'sp'}:${rolePart}`;
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
    const roleLabel = tRole(row.role) || row.role || '';
    const cards = keys
      .map((k) => renderEntityStatCard(kind, k, entityStatValue(row, k), null, specialty && k === specialty))
      .join('');
    const modeNote =
      kind === 'character'
        ? `${esc(t('stats_note_pilot', { role: roleLabel, specialty: specialty || '·' }))}`
        : `${esc(t('stats_note_unit', { mode: String(row.mode || board || 'sp').toUpperCase(), role: roleLabel }))}`;
    return `<section class="spi-dossier-section spi-entity-stats-block" id="spiEntityStats">
      <div class="spi-dossier-section-head">
        <h4 class="spi-dossier-h">${esc(t('stats_heading'))} <span class="spi-dossier-h-sub">${esc(t('stats_rank_within_role', { role: roleLabel }))}</span></h4>
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

  async function fetchUnitRowForRanks(id, roleId) {
    const lang = uiLang();
    const mode = board === 'ssp' ? 'ssp' : 'sp';
    const roleQ = roleId ? `&role=${encodeURIComponent(roleId)}` : '';
    // id search includes transform alternates that ranking_bulk otherwise skips.
    const url =
      `/api/units?lang=${encodeURIComponent(lang)}` +
      `&q=${encodeURIComponent(id)}&stat_mode=${mode}${roleQ}&per_page=20&page=1`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const d = await r.json();
    const rows = Array.isArray(d && d.rows) ? d.rows : [];
    return rows.find((x) => String(x && x.id) === String(id)) || null;
  }

  async function warmSpiRankIndex(kind, roleId) {
    const ck = rankIndexCacheKey(kind, roleId);
    if (_spiRankIndexByKey[ck]) return _spiRankIndexByKey[ck];
    if (_spiRankIndexPromises[ck]) return _spiRankIndexPromises[ck];
    _spiRankIndexPromises[ck] = (async () => {
      const lang = uiLang();
      const keys = entityStatKeys(kind);
      const roleQ =
        roleId === '1' || roleId === '2' || roleId === '3'
          ? `&role=${encodeURIComponent(roleId)}`
          : '';
      let url;
      if (kind === 'character') {
        url =
          `/api/characters?lang=${encodeURIComponent(lang)}` +
          `&sort=Ranged&dir=desc&sp=1&stat_bounds=1&ranking_bulk=1${roleQ}&per_page=50000&page=1`;
      } else {
        const mode = board === 'ssp' ? 'ssp' : 'sp';
        url =
          `/api/units?lang=${encodeURIComponent(lang)}` +
          `&sort=HP&dir=desc&stat_mode=${mode}&stat_bounds=1&ranking_bulk=1${roleQ}&per_page=50000&page=1`;
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
    const roleId = roleApiId(row);
    const modalKey = `${kind}:${id}:${rankIndexCacheKey(kind, roleId)}`;
    _spiModalEntityKey = modalKey;
    try {
      const idx = await warmSpiRankIndex(kind, roleId);
      if (_spiModalEntityKey !== modalKey) return;
      const keys = entityStatKeys(kind);
      const missingFromList = keys.some((sk) => !(idx[sk] && idx[sk].byId.has(id)));
      let apiRow = null;
      if (missingFromList && kind === 'unit') {
        try {
          apiRow = await fetchUnitRowForRanks(id, roleId);
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
        if (note) note.textContent = t('stats_rank_unavailable');
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
  let raritySel = new Set(['SSR']);
  let mapOnly = false;
  let hasSpOnly = true;
  let showUlt = false;
  let sourceFilter = 'all';
  let tagFilter = '';
  let erFilter = '';
  let skillFilterIds = [];
  let abilFilterIds = [];
  let searchQuery = '';
  let rowById = new Map();
  let _payloadLang = '';
  let _controlsBound = false;
  let grid = null;
  let statusEl = null;

  const $ = (sel) => spiRoot().querySelector(sel);

  function resolveDom() {
    if (!grid) grid = document.getElementById('spiGrid');
    if (!statusEl) statusEl = document.getElementById('spiStatus');
    return !!(grid && statusEl);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
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

  function rarityIndex(row) {
    const rid = Number(row && row.rarity_id);
    if (Number.isFinite(rid) && rid > 0) return rid;
    const map = { N: 1, R: 2, SR: 3, SSR: 4, UR: 5 };
    return map[String((row && row.rarity) || '').toUpperCase()] || 0;
  }

  function isUltimateRow(row) {
    return row && (row.is_ultimate === true || row.is_ultimate === 1);
  }

  function rarityLetter(row) {
    const letter = String((row && row.rarity) || '').toUpperCase();
    if (letter && letter !== 'NONE' && letter !== 'NULL') return letter;
    const map = { 1: 'N', 2: 'R', 3: 'SR', 4: 'SSR', 5: 'UR' };
    return map[rarityIndex(row)] || '';
  }

  function rarityKeysForEntity() {
    // Units: no UR option — Ultimate Units use the ULT toggle. Characters: no UR.
    return ['SSR', 'SR', 'R', 'N'];
  }

  function defaultRaritySel() {
    return new Set(['SSR']);
  }

  function rarityOk(row) {
    // Ultimate Units are gated by the ULT toggle, not the rarity multi-select.
    if (entity === 'units' && isUltimateRow(row)) return true;
    const letter = rarityLetter(row);
    if (!letter) return false;
    // Guide omits non-Ultimate UR pilots; characters never include UR here.
    if (entity === 'characters' && (letter === 'UR' || rarityIndex(row) >= 5)) return false;
    if (entity === 'units' && letter === 'UR') return false;
    return raritySel.has(letter);
  }

  function seriesAdvantageApplies(row) {
    const adv = row && row.series_advantage;
    if (!adv || !tagFilter) return false;
    const tag = String(tagFilter).trim().toLowerCase();
    if (!tag) return false;
    const matchTags = (adv.match_tags || []).map((t) => String(t).trim().toLowerCase());
    if (matchTags.includes(tag)) return true;
    const series = String(adv.series_name || '').trim().toLowerCase();
    if (!series) return false;
    const tagCore = tag.replace(/\s+series\s*$/i, '').trim();
    const generic = new Set([
      'gundam', 'mobile suit', 'mobile', 'suit', 'ms', 'unit', 'series',
      'alternative', 'rival', 'red', 'blue', 'white', 'black', 'ultimate',
    ]);
    if (tagCore.length < 3 || generic.has(tagCore)) return false;
    if (series.includes(tagCore)) return true;
    return false;
  }

  function letterFromTotal(total, cohort) {
    const g = (payload && payload.scoring_guide) || {};
    const cuts =
      cohort === 'ur'
        ? g.ur_letter_cutoffs || g.letter_cutoffs || []
        : g.letter_cutoffs || [];
    const n = Number(total) || 0;
    for (let i = 0; i < cuts.length; i++) {
      if (n >= Number(cuts[i].min)) return String(cuts[i].letter || 'E');
    }
    return 'E';
  }

  function bucketFromLetter(letter) {
    const g = (payload && payload.scoring_guide) || {};
    const map = g.bucket_by_letter || payload.bucket_by_letter || {};
    return map[letter] || 'niche';
  }

  /** Base published row + Ultimate series Advantage when the active tag matches. */
  function effectiveRow(row) {
    if (!row) return row;
    const adv = row.series_advantage;
    const apply = seriesAdvantageApplies(row) && Number((adv && adv.points) || 0) > 0;
    if (!apply) {
      return row._advantage_active ? { ...row, _advantage_active: false } : row;
    }
    const total = Number(row.total || 0) + Number(adv.points || 0);
    const cohort = row.letter_cohort || (row.has_sp ? 'sp' : 'ur');
    const letter = letterFromTotal(total, cohort);
    return {
      ...row,
      total,
      letter,
      bucket: bucketFromLetter(letter),
      _advantage_active: true,
      _advantage_points: Number(adv.points || 0),
    };
  }

  function rarityIconHtml(keys) {
    return (keys || [])
      .map((k) => {
        const path = RARITY_FILTER_ICONS[k];
        if (!path) return '';
        return `<img class="filter-inline-icon rarity-filter-chip" src="${esc(imgUrl(path))}" alt="" role="presentation" loading="lazy" decoding="async" onerror="gameImageUrlFallback(this)">`;
      })
      .join('');
  }

  function isRarityFilterDefault() {
    const def = defaultRaritySel();
    if (raritySel.size !== def.size) return false;
    for (const k of def) if (!raritySel.has(k)) return false;
    return true;
  }

  function updateRarityFilterLabel() {
    const label = $('#spiRarityFilterLabel');
    const btn = $('#spiRarityFilterBtn');
    if (!label) return;
    const keys = rarityKeysForEntity().filter((k) => raritySel.has(k));
    if (!keys.length) {
      label.textContent = '—';
    } else {
      label.innerHTML = rarityIconHtml(keys);
    }
    if (btn) btn.classList.toggle('active', !isRarityFilterDefault() || keys.length === 0);
  }

  function syncLowRarityLabel() {
    updateRarityFilterLabel();
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

  function rowMatchesSearch(row, q) {
    if (!q) return true;
    const name = String(row.name || '').toLowerCase();
    const tags = (row.tags || []).join(' ').toLowerCase();
    const tagsEn = (row.tags_en || row.tags || []).join(' ').toLowerCase();
    const id = String(row.id || '').toLowerCase();
    return name.includes(q) || tags.includes(q) || tagsEn.includes(q) || id.includes(q);
  }

  function syncSearchFromInput() {
    const input = $('#spiSearch');
    if (input) searchQuery = String(input.value || '');
  }

  function passesFilters(row) {
    // Role 0 = NPC / story-only — never show on this guide.
    if (String(row.role_id || '') === '0') return false;
    if ((row.role || '') !== role) return false;
    if (!rarityOk(row)) return false;
    const ult = isUltimateRow(row);
    // Ultimate Units only when the ULT toggle is on (Units board).
    if (entity === 'units' && ult && !showUlt) return false;
    // SP-eligible filter; Ultimate Units use the ULT toggle instead of has_sp.
    if (hasSpOnly && !row.has_sp && !ult) return false;
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
    if (entity === 'characters' && skillFilterIds.length) {
      const have = new Set((row.skills || []).map((s) => String((s && s.id) || '')));
      if (!skillFilterIds.every((id) => have.has(String(id)))) return false;
    }
    if (abilFilterIds.length) {
      const have = new Set((row.abilities || []).map((a) => String((a && a.id) || '')));
      if (!abilFilterIds.every((id) => have.has(String(id)))) return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (q && !rowMatchesSearch(row, q)) return false;
    return true;
  }

  function sourceOpts() {
    return [
      { value: 'all', label: t('all_sources') },
      { value: 'gacha', label: t('source_gacha') },
      { value: 'event', label: t('source_event') },
      { value: 'dev', label: t('source_dev') },
    ];
  }

  function closeSpiFilterPanels() {
    ['spiRarity', 'spiSource', 'spiTag', 'spiSkill', 'spiAbil', 'spiEr'].forEach((pfx) => {
      const panel = document.getElementById(pfx + 'FilterPanel');
      const btn = document.getElementById(pfx + 'FilterBtn');
      if (panel) panel.hidden = true;
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        if (pfx === 'spiRarity') btn.classList.toggle('active', !isRarityFilterDefault() || raritySel.size === 0);
        else if (pfx === 'spiSkill') btn.classList.toggle('active', skillFilterIds.length > 0);
        else if (pfx === 'spiAbil') btn.classList.toggle('active', abilFilterIds.length > 0);
        else
          btn.classList.toggle(
            'active',
            pfx === 'spiSource' ? sourceFilter !== 'all' : pfx === 'spiTag' ? !!tagFilter : !!erFilter
          );
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
      if (pfx === 'spiTag' || pfx === 'spiEr' || pfx === 'spiSkill' || pfx === 'spiAbil') {
        if (pfx === 'spiSkill' && !panel.querySelector('input[type="checkbox"]')) fillSkillPanel();
        if (pfx === 'spiAbil' && !panel.querySelector('input[type="checkbox"]')) fillAbilPanel();
        const search = panel.querySelector('.filter-dd-search');
        if (search) {
          search.value = '';
          filterDdRows(panel, '');
          const clearBtn = panel.querySelector('.spi-dd-search-clear');
          if (clearBtn) clearBtn.hidden = true;
          setTimeout(() => search.focus(), 0);
        }
      }
    }
  }

  function filterDdRows(panel, q) {
    const needle = String(q || '')
      .trim()
      .toLowerCase();
    // Use getAttribute + style.display — author CSS sets .rarity-filter-row{display:flex}
    // which can override the [hidden] attribute in practice (same pattern as browse filters).
    const rows = panel.querySelectorAll('.rarity-filter-row[data-filter-text]');
    let shown = 0;
    rows.forEach((row) => {
      const hay = String(row.getAttribute('data-filter-text') || '').toLowerCase();
      const ok = !needle || hay.includes(needle);
      row.style.display = ok ? '' : 'none';
      if (ok) shown += 1;
    });
    const empty = panel.querySelector('.spi-dd-empty');
    if (empty) empty.hidden = shown > 0 || !needle;
  }

  function spiDdSearchWrapHtml(placeholder, aria) {
    return `<div class="spi-dd-search-wrap">
      <input type="search" class="filter-dd-search" placeholder="${escAttr(placeholder)}" aria-label="${escAttr(aria)}" autocomplete="off">
      <button type="button" class="filter-input-clear spi-dd-search-clear" aria-label="${escAttr(t('clear_search'))}" hidden>×</button>
    </div>`;
  }

  function spiDdFooterHtml() {
    return `<div class="filter-panel-clear-wrap spi-dd-footer" data-footer-ready="1">
      <div class="filter-panel-footer-left"></div>
      <div class="filter-panel-footer-right">
        <button type="button" class="filter-panel-esc-btn" data-filter-esc="1">${esc(t('filter_esc'))}</button>
        <button type="button" class="filter-panel-clear-btn" data-filter-clear="1">${esc(t('filter_clear'))}</button>
      </div>
    </div>`;
  }

  function bindSpiDdSearch(panel) {
    const search = panel.querySelector('.filter-dd-search');
    const clearBtn = panel.querySelector('.spi-dd-search-clear');
    if (!search) return;
    const syncClear = () => {
      const has = !!String(search.value || '').trim();
      if (clearBtn) clearBtn.hidden = !has;
    };
    search.addEventListener('input', () => {
      filterDdRows(panel, search.value);
      syncClear();
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (String(search.value || '').trim()) {
          search.value = '';
          filterDdRows(panel, '');
          syncClear();
        } else {
          closeSpiFilterPanels();
        }
      }
    });
    search.addEventListener('click', (e) => e.stopPropagation());
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        search.value = '';
        filterDdRows(panel, '');
        syncClear();
        search.focus();
      });
    }
    syncClear();
  }

  function bindSpiDdFooter(panel, onClear) {
    const escBtn = panel.querySelector('[data-filter-esc]');
    const clrBtn = panel.querySelector('[data-filter-clear]');
    if (escBtn) {
      escBtn.textContent = t('filter_esc');
      escBtn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        closeSpiFilterPanels();
      };
    }
    if (clrBtn) {
      clrBtn.textContent = t('filter_clear');
      clrBtn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
          onClear && onClear();
        } catch (_) {}
      };
    }
  }

  function setFilterBtnLabel(labelEl, text, active) {
    if (!labelEl) return;
    labelEl.innerHTML = `<span class="source-filter-btn-plain">${esc(text)}</span>`;
    const btn = labelEl.closest('.rarity-filter-btn');
    if (btn) btn.classList.toggle('active', !!active);
  }

  function updateSourceFilterLabel() {
    const opts = sourceOpts();
    const opt = opts.find((o) => o.value === sourceFilter) || opts[0];
    setFilterBtnLabel($('#spiSourceFilterLabel'), opt.label, sourceFilter !== 'all');
  }

  function updateTagFilterLabel() {
    setFilterBtnLabel($('#spiTagFilterLabel'), tagFilter || t('no_tag_filter'), !!tagFilter);
  }

  function updateErFilterLabel() {
    let text = t('no_er_filter');
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

  function collectKitCatalog(kind) {
    const key = kind === 'skill' ? 'skills' : 'abilities';
    const byId = new Map();
    let buckets = {};
    if (entity === 'characters') {
      buckets = ((payload && payload.characters) || {}).sp || {};
    } else {
      const units = (payload && payload.units) || {};
      buckets = units[board] || units.sp || {};
    }
    Object.keys(buckets).forEach((bk) => {
      (buckets[bk] || []).forEach((row) => {
        (row[key] || []).forEach((it) => {
          if (!it || !it.id) return;
          const id = String(it.id);
          if (!byId.has(id)) {
            byId.set(id, {
              id,
              name: String(it.name || id),
              icon: String(it.icon || ''),
            });
          }
        });
      });
    });
    return Array.from(byId.values()).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''))
    );
  }

  function kitFilterChipHtml(iconPath, label) {
    const ic = iconPath
      ? `<img class="skill-filter-toolbar-ic" src="${esc(imgUrl(iconPath))}" alt="" role="presentation" loading="lazy" decoding="async" onerror="gameImageUrlFallback(this)">`
      : '';
    return `<span class="skill-filter-toolbar-label">${ic}<span class="source-filter-btn-plain">${esc(label)}</span></span>`;
  }

  function updateSkillFilterLabel() {
    const label = $('#spiSkillFilterLabel');
    const btn = $('#spiSkillFilterBtn');
    if (!label) return;
    const lead = SPI_SKILL_FILTER_ICON;
    if (!skillFilterIds.length) {
      label.innerHTML = kitFilterChipHtml(lead, t('no_skill_filter'));
      if (btn) btn.classList.remove('active');
      return;
    }
    if (btn) btn.classList.add('active');
    if (skillFilterIds.length === 1) {
      const cat = collectKitCatalog('skill');
      const hit = cat.find((x) => String(x.id) === String(skillFilterIds[0]));
      const name = (hit && hit.name) || skillFilterIds[0];
      const icon = (hit && hit.icon) || lead;
      label.innerHTML = kitFilterChipHtml(icon, name);
      return;
    }
    label.innerHTML = kitFilterChipHtml(lead, t('skill_filter_n', { n: skillFilterIds.length }));
  }

  function abilFilterTitleKey() {
    return entity === 'characters' ? 'abil_filter_title' : 'unit_abil_filter_title';
  }

  function noAbilFilterKey() {
    return entity === 'characters' ? 'no_abil_filter' : 'no_unit_abil_filter';
  }

  function abilFilterNKey() {
    return entity === 'characters' ? 'abil_filter_n' : 'unit_abil_filter_n';
  }

  function updateAbilFilterLabel() {
    const label = $('#spiAbilFilterLabel');
    const btn = $('#spiAbilFilterBtn');
    if (!label) return;
    const lead = SPI_ABIL_FILTER_ICON;
    if (btn) btn.setAttribute('title', t(abilFilterTitleKey()));
    if (!abilFilterIds.length) {
      label.innerHTML = kitFilterChipHtml(lead, t(noAbilFilterKey()));
      if (btn) btn.classList.remove('active');
      return;
    }
    if (btn) btn.classList.add('active');
    if (abilFilterIds.length === 1) {
      const cat = collectKitCatalog('ability');
      const hit = cat.find((x) => String(x.id) === String(abilFilterIds[0]));
      const name = (hit && hit.name) || abilFilterIds[0];
      const icon = (hit && hit.icon) || lead;
      label.innerHTML = kitFilterChipHtml(icon, name);
      return;
    }
    label.innerHTML = kitFilterChipHtml(lead, t(abilFilterNKey(), { n: abilFilterIds.length }));
  }

  function kitFilterRowHtml(item, group, checked) {
    const id = `spiKit_${group}_${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const ft = String(item.name || '').toLowerCase();
    const ic = item.icon
      ? `<img class="skill-browse-ic" src="${esc(imgUrl(item.icon))}" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback(this)">`
      : '';
    return `<label class="rarity-filter-row list-filter-tag-item skill-browse-row" data-filter-text="${escAttr(ft)}">
      <input type="checkbox" id="${escAttr(id)}" value="${escAttr(item.id)}" ${checked ? 'checked' : ''}>
      <span class="tag-composite list-filter-tag-composite skill-browse-row-inner">
        <span class="tag-part-icon">${ic}</span>
        <span class="tag-part-value">${esc(item.name)}</span>
      </span>
    </label>`;
  }

  function fillSkillPanel() {
    const panel = $('#spiSkillFilterPanel');
    if (!panel) return;
    const rows = collectKitCatalog('skill')
      .map((it) => kitFilterRowHtml(it, 'skill', skillFilterIds.includes(String(it.id))))
      .join('');
    panel.innerHTML = `${spiDdSearchWrapHtml(t('skill_search_ph'), t('skill_search_aria'))}
      <div class="spi-dd-scroll">${rows || ''}<div class="spi-dd-empty" hidden>${esc(t('skill_search_empty'))}</div></div>
      ${spiDdFooterHtml()}`;
    bindSpiDdSearch(panel);
    panel.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        skillFilterIds = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map((x) =>
          String(x.value)
        );
        updateSkillFilterLabel();
        render();
      });
    });
    bindSpiDdFooter(panel, () => {
      skillFilterIds = [];
      updateSkillFilterLabel();
      fillSkillPanel();
      closeSpiFilterPanels();
      render();
    });
  }

  function fillAbilPanel() {
    const panel = $('#spiAbilFilterPanel');
    if (!panel) return;
    const rows = collectKitCatalog('ability')
      .map((it) => kitFilterRowHtml(it, 'abil', abilFilterIds.includes(String(it.id))))
      .join('');
    const searchPh = entity === 'characters' ? t('abil_search_ph') : t('unit_abil_search_ph');
    const searchAria = entity === 'characters' ? t('abil_search_aria') : t('unit_abil_search_aria');
    const emptyMsg = entity === 'characters' ? t('abil_search_empty') : t('unit_abil_search_empty');
    panel.innerHTML = `${spiDdSearchWrapHtml(searchPh, searchAria)}
      <div class="spi-dd-scroll">${rows || ''}<div class="spi-dd-empty" hidden>${esc(emptyMsg)}</div></div>
      ${spiDdFooterHtml()}`;
    bindSpiDdSearch(panel);
    panel.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        abilFilterIds = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map((x) =>
          String(x.value)
        );
        updateAbilFilterLabel();
        render();
      });
    });
    bindSpiDdFooter(panel, () => {
      abilFilterIds = [];
      updateAbilFilterLabel();
      fillAbilPanel();
      closeSpiFilterPanels();
      render();
    });
  }

  function renderEntityKitHtml(row, isPilot) {
    const abilities = Array.isArray(row && row.abilities) ? row.abilities : [];
    const skills = isPilot && Array.isArray(row && row.skills) ? row.skills : [];
    if (!abilities.length && !skills.length) {
      return `<div class="spi-dossier-kit spi-dossier-kit--empty" aria-hidden="true"></div>`;
    }
    const chip = (it) => {
      const ic = it.icon
        ? `<img class="spi-kit-ic" src="${esc(imgUrl(it.icon))}" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback(this)">`
        : '';
      return `<span class="spi-kit-chip" title="${escAttr(it.name || '')}">${ic}<span class="spi-kit-name">${esc(it.name || '')}</span></span>`;
    };
    const abilLabel = isPilot ? t('kit_abilities') : t('kit_unit_abilities');
    const abilBlock = abilities.length
      ? `<div><p class="spi-kit-group-label">${esc(abilLabel)}</p><div class="spi-kit-row">${abilities.map(chip).join('')}</div></div>`
      : '';
    const skillBlock = skills.length
      ? `<div><p class="spi-kit-group-label">${esc(t('kit_skills'))}</p><div class="spi-kit-row">${skills.map(chip).join('')}</div></div>`
      : '';
    const aria = isPilot ? t('kit_aria') : t('kit_unit_aria');
    return `<div class="spi-dossier-kit" aria-label="${escAttr(aria)}">${abilBlock}${skillBlock}</div>`;
  }

  function ddRowHtml(value, label, checked, group, filterText) {
    const id = `spiDd_${group}_${String(value).replace(/[^a-zA-Z0-9_-]/g, '_') || 'all'}`;
    const ft = filterText != null ? filterText : String(label).toLowerCase();
    return `<label class="rarity-filter-row" data-filter-text="${escAttr(ft)}">
      <input type="radio" name="spiDd_${escAttr(group)}" id="${escAttr(id)}" value="${escAttr(value)}" ${checked ? 'checked' : ''}>
      <span class="rarity-filter-all-label">${esc(label)}</span>
    </label>`;
  }

  function fillRarityPanel() {
    const panel = $('#spiRarityFilterPanel');
    if (!panel) return;
    const keys = rarityKeysForEntity();
    const rows = keys
      .map((k) => {
        const id = `spiRarity_${k}`;
        const checked = raritySel.has(k) ? 'checked' : '';
        return `<label class="rarity-filter-row">
      <input type="checkbox" id="${escAttr(id)}" value="${escAttr(k)}" ${checked}>
      <span class="rarity-row-hit"><span class="rarity-row-one-icon">${rarityIconHtml([k])}</span></span>
    </label>`;
      })
      .join('');
    panel.innerHTML = `<div class="spi-dd-scroll">${rows}</div>${spiDdFooterHtml()}`;
    panel.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        const next = new Set();
        panel.querySelectorAll('input[type="checkbox"]').forEach((box) => {
          if (box.checked) next.add(box.value);
        });
        raritySel = next;
        updateRarityFilterLabel();
        render();
      });
    });
    bindSpiDdFooter(panel, () => {
      raritySel = new Set(rarityKeysForEntity());
      updateRarityFilterLabel();
      fillRarityPanel();
      closeSpiFilterPanels();
      render();
    });
  }

  function fillSourcePanel() {
    const panel = $('#spiSourceFilterPanel');
    if (!panel) return;
    const rows = sourceOpts().map((o) => ddRowHtml(o.value, o.label, sourceFilter === o.value, 'source')).join('');
    panel.innerHTML = `<div class="spi-dd-scroll">${rows}</div>${spiDdFooterHtml()}`;
    panel.querySelectorAll('input[type="radio"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        sourceFilter = inp.value || 'all';
        updateSourceFilterLabel();
        closeSpiFilterPanels();
        render();
      });
    });
    bindSpiDdFooter(panel, () => {
      sourceFilter = 'all';
      updateSourceFilterLabel();
      fillSourcePanel();
      closeSpiFilterPanels();
      render();
    });
  }

  function fillTagPanel() {
    const panel = $('#spiTagFilterPanel');
    if (!panel) return;
    const tags = (payload && payload.tag_catalog) || [];
    const tagsEn = (payload && payload.tag_catalog_en) || tags;
    const rows =
      ddRowHtml('', t('no_tag_filter'), !tagFilter, 'tag') +
      tags
        .map((tagName, i) => {
          const en = tagsEn[i] || tagName;
          const ft = `${tagName} ${en}`.toLowerCase();
          return ddRowHtml(tagName, tagName, tagFilter === tagName, 'tag', ft);
        })
        .join('');
    panel.innerHTML = `${spiDdSearchWrapHtml(t('tag_search_ph'), t('tag_search_aria'))}
      <div class="spi-dd-scroll">${rows}<div class="spi-dd-empty" hidden>${esc(t('tag_search_empty'))}</div></div>
      ${spiDdFooterHtml()}`;
    bindSpiDdSearch(panel);
    panel.querySelectorAll('input[type="radio"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        tagFilter = inp.value || '';
        updateTagFilterLabel();
        closeSpiFilterPanels();
        render();
      });
    });
    bindSpiDdFooter(panel, () => {
      tagFilter = '';
      updateTagFilterLabel();
      fillTagPanel();
      closeSpiFilterPanels();
      render();
    });
  }

  function fillErPanel() {
    const panel = $('#spiErFilterPanel');
    if (!panel) return;
    const ers = (payload && payload.er_expert_filters) || [];
    const rows =
      ddRowHtml('', t('no_er_filter'), !erFilter, 'er') +
      ers
        .map((e) => {
          const label =
            entity === 'characters'
              ? e.character_label || e.label || e.id
              : e.unit_label || e.label || e.id;
          const en = e.label || e.unit_label || e.character_label || e.id;
          const ft = `${label} ${en} ${e.id}`.toLowerCase();
          return ddRowHtml(String(e.id), label, String(erFilter) === String(e.id), 'er', ft);
        })
        .join('');
    panel.innerHTML = `${spiDdSearchWrapHtml(t('er_search_ph'), t('er_search_aria'))}
      <div class="spi-dd-scroll">${rows}<div class="spi-dd-empty" hidden>${esc(t('er_search_empty'))}</div></div>
      ${spiDdFooterHtml()}`;
    bindSpiDdSearch(panel);
    panel.querySelectorAll('input[type="radio"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        erFilter = inp.value || '';
        updateErFilterLabel();
        closeSpiFilterPanels();
        render();
      });
    });
    bindSpiDdFooter(panel, () => {
      erFilter = '';
      updateErFilterLabel();
      fillErPanel();
      closeSpiFilterPanels();
      render();
    });
  }

  function fillFilterSelects() {
    fillRarityPanel();
    fillSourcePanel();
    fillTagPanel();
    fillSkillPanel();
    fillAbilPanel();
    fillErPanel();
    updateRarityFilterLabel();
    updateSourceFilterLabel();
    updateTagFilterLabel();
    updateSkillFilterLabel();
    updateAbilFilterLabel();
    updateErFilterLabel();
  }

  function renderScoringGuide() {
    const g = (payload && payload.scoring_guide) || {};
    const guide = window.SpiI18nGuide;
    const lc = uiLang();
    const guideTitle = t('guide_title');
    const guideIntro = t('guide_intro');
    const titleEl = $('#spiScoringTitle');
    if (titleEl) titleEl.textContent = guideTitle !== 'guide_title' ? guideTitle : t('scoring_title');
    $('#spiScoringIntro').textContent =
      guideIntro !== 'guide_intro' ? guideIntro : g.intro || t('scoring_loading');

    const ovLines =
      guide && typeof guide.overrides === 'function' ? guide.overrides(lc) : g.overrides || [];
    const gapLines = guide && typeof guide.gaps === 'function' ? guide.gaps(lc) : g.gaps || [];
    const ov = $('#spiScoringOverrides');
    ov.innerHTML = (ovLines || []).map((line) => `<li>${esc(line)}</li>`).join('');
    const gaps = $('#spiScoringGaps');
    gaps.innerHTML = (gapLines || []).map((line) => `<li>${esc(line)}</li>`).join('');

    const badgeObjective =
      guide && typeof guide.badgeObjective === 'function' ? guide.badgeObjective(lc) : 'Objective';
    const badgeEstimate =
      guide && typeof guide.badgeEstimate === 'function' ? guide.badgeEstimate(lc) : 'Estimate';

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
          const cid = String(c.id || '');
          const loc = guide && typeof guide.criteria === 'function' ? guide.criteria(lc, cid) : null;
          const obj = c.objective !== false;
          const badge = obj
            ? `<span class="spi-criteria-badge">${esc(badgeObjective)}</span>`
            : `<span class="spi-criteria-badge spi-criteria-badge--soft">${esc(badgeEstimate)}</span>`;
          const applies = (c.applies || [])
            .map((a) => {
              const label =
                a === 'units'
                  ? t('applies_units')
                  : a === 'pilots' || a === 'characters'
                    ? t('applies_characters')
                    : a;
              return `<span class="spi-criteria-badge spi-criteria-badge--soft">${esc(label)}</span>`;
            })
            .join('');
          const roleBadges = (c.roles || [])
            .filter((r) => r && r !== 'all')
            .map((r) => `<span class="spi-criteria-badge spi-criteria-badge--soft">${esc(tRole(r))}</span>`)
            .join('');
          const rows = (c.rows || [])
            .map((r) => {
              let when = String(r.when || '');
              let result = String(r.result != null ? r.result : r.points != null ? r.points : '');
              if (guide && typeof guide.localizeRow === 'function') {
                const lr = guide.localizeRow(lc, cid, when, result) || {};
                when = lr.when != null ? lr.when : when;
                result = lr.result != null ? lr.result : result;
              }
              when = when
                .replace(/\bTraitType\b/g, 'effect')
                .replace(/\bCharacterSkillTraitType\b/g, 'skill effect')
                .replace(/\bWeaponTraitType\b/g, 'weapon effect');
              result = result
                .replace(/\bTraitType\b/g, 'effect')
                .replace(/\bCharacterSkillTraitType\b/g, 'skill effect')
                .replace(/\bWeaponTraitType\b/g, 'weapon effect');
              return `<tr><th scope="row">${esc(when)}</th><td>${esc(result)}</td></tr>`;
            })
            .join('');
          let title = loc && loc.title ? String(loc.title) : String(c.title || c.id || '');
          let summary = loc && loc.summary ? String(loc.summary) : String(c.summary || '');
          title = title
            .replace(/\bTraitType\b/g, 'effect')
            .replace(/\bCharacterSkillTraitType\b/g, 'skill effect');
          summary = summary
            .replace(/\bTraitType\b/g, 'effect')
            .replace(/\bCharacterSkillTraitType\b/g, 'skill effect')
            .replace(/\bWeaponTraitType\b/g, 'weapon effect')
            .replace(/\bOccupiedAreaId\b/g, 'footprint');
          return `<article class="spi-criteria-block" data-criteria="${esc(cid)}">
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
    const bucketBits = BUCKET_ORDER.map((k) => {
      const label = labels[k] || tBucket(k);
      return `<span class="spi-letter-chip">${esc(label)}</span>`;
    }).join('');
    cuts.innerHTML =
      fmtCuts(spCuts, t('sp_grades')) +
      fmtCuts(urCuts, t('ultimate_grades')) +
      `<div class="spi-cutoff-group"><span class="spi-cutoff-group-label">${esc(t('buckets_label'))}</span>${bucketBits}</div>`;
  }

  function syncBoardTabsVisibility() {
    const boardTabs = $('#spiBoardTabs');
    const mapWrap = $('#spiMapOnlyWrap');
    const skillWrap = $('#spiSkillWrap');
    const abilWrap = $('#spiAbilWrap');
    const shell = spiRoot();
    if (shell && shell.classList) {
      shell.classList.toggle('spi-entity-characters', entity === 'characters');
      shell.classList.toggle('spi-entity-units', entity !== 'characters');
      shell.setAttribute('data-spi-entity', entity === 'characters' ? 'characters' : 'units');
    }
    if (entity === 'characters') {
      if (boardTabs) boardTabs.style.display = 'none';
      board = 'sp';
      showUlt = false;
      if (mapWrap) mapWrap.style.display = 'none';
      if (skillWrap) {
        skillWrap.hidden = false;
        skillWrap.style.display = '';
      }
    } else {
      if (boardTabs) boardTabs.style.display = '';
      if (mapWrap) mapWrap.style.display = '';
      if (skillWrap) {
        skillWrap.hidden = true;
        skillWrap.style.display = 'none';
      }
      skillFilterIds = [];
    }
    // Unit Ability / Character Abilities filter is available on both boards.
    if (abilWrap) {
      abilWrap.hidden = false;
      abilWrap.style.display = '';
    }
  }

  function render() {
    if (!payload) return;
    if (!resolveDom()) return;
    syncSearchFromInput();
    syncBoardTabsVisibility();
    const buckets = currentBuckets();
    const labels = payload.bucket_labels || {};
    const order = payload.bucket_order || BUCKET_ORDER;
    const kind = entity === 'characters' ? 'character' : 'unit';
    rowById = new Map();

    const byBucket = {};
    order.forEach((bk) => {
      byBucket[bk] = [];
    });
    Object.keys(buckets || {}).forEach((bk) => {
      (buckets[bk] || []).forEach((raw) => {
        if (!passesFilters(raw)) return;
        const r = effectiveRow(raw);
        rowById.set(String(raw.id), r);
        const dest = r.bucket || 'niche';
        if (!byBucket[dest]) byBucket[dest] = [];
        byBucket[dest].push(r);
      });
    });
    order.forEach((bk) => {
      (byBucket[bk] || []).sort(
        (a, b) =>
          Number(b.total || 0) - Number(a.total || 0) ||
          String(a.name || '').localeCompare(String(b.name || ''))
      );
    });

    let shown = 0;
    let html = '';
    order.forEach((bk) => {
      const rows = byBucket[bk] || [];
      shown += rows.length;
      const cards = rows
        .map((r) => {
          const advNote = r._advantage_active
            ? `<span class="spi-chip spi-chip-adv" title="${esc(t('adv_on', { n: r._advantage_points }))}">${esc(t('adv_chip', { n: r._advantage_points }))}</span>`
            : '';
          return `<button type="button" class="spi-card" data-id="${esc(r.id)}">
            <div class="spi-card-thumb-wrap">${renderFramedThumb(r, kind)}</div>
            <div class="spi-card-name">${esc(r.name || r.id)}</div>
            <div class="spi-card-meta">
              <span class="spi-chip letter ${letterClass(r.letter)}">${esc(r.letter || '?')}</span>
              <span class="spi-chip score">${esc(r.total)} Pt</span>
              ${advNote}
            </div>
          </button>`;
        })
        .join('');
      html += `<section class="spi-bucket">
        <div class="spi-bucket-head" data-bucket="${esc(bk)}">
          <h3>${esc(labels[bk] || tBucket(bk) || bk)}</h3>
          <span class="spi-bucket-count">${rows.length}</span>
        </div>
        <div class="spi-cards">${cards || `<p class="spi-status">${esc(t('no_bucket'))}</p>`}</div>
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
    const label = entity === 'characters' ? t('pilots_sp') : board.toUpperCase();
    const cohortNote = showUlt ? t('cohort_ultimate') : '';
    const advNote = tagFilter ? t('adv_note') : '';
    statusEl.textContent =
      t('showing', { shown, total: totalBoard, board: label, role: tRole(role) }) + cohortNote + advNote;
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

  function collapseSpiBarTips(exceptRow) {
    const modal = $('#spiModal');
    if (!modal) return false;
    let closed = false;
    modal.querySelectorAll('.spi-bar-row[aria-expanded="true"], .spi-bar-row.is-open').forEach((row) => {
      if (exceptRow && row === exceptRow) return;
      row.classList.remove('is-open');
      row.setAttribute('aria-expanded', 'false');
      const tip = row.querySelector('.spi-bar-tip');
      if (tip) tip.hidden = true;
      closed = true;
    });
    return closed;
  }

  function toggleSpiBarTip(row) {
    if (!row || !row.classList.contains('spi-bar-row') || row.classList.contains('spi-bar-row--static')) {
      return;
    }
    const wasOpen = row.getAttribute('aria-expanded') === 'true';
    collapseSpiBarTips();
    if (wasOpen) return;
    row.classList.add('is-open');
    row.setAttribute('aria-expanded', 'true');
    const tip = row.querySelector('.spi-bar-tip');
    if (tip) tip.hidden = false;
  }

  function breakdownEntries(bd) {
    const out = [];
    Object.keys(BREAKDOWN_META).forEach((k) => {
      if (bd[k] == null) return;
      const meta = breakdownMetaFor(k);
      const pts = Number(bd[k]) || 0;
      if (meta.hideIfZero && pts === 0) return;
      out.push({ key: k, label: meta.label || k, tip: meta.tip || '', pts });
    });
    // Include any unknown keys that actually scored
    Object.keys(bd || {}).forEach((k) => {
      if (BREAKDOWN_META[k]) return;
      const pts = Number(bd[k]) || 0;
      if (!pts) return;
      const meta = breakdownMetaFor(k);
      out.push({ key: k, label: meta.label || k.replace(/_/g, ' '), tip: meta.tip || '', pts });
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
      .map((e, i) => {
        const pct = Math.round((Math.abs(e.pts) / maxAbs) * 100);
        const tone = e.pts > 0 ? 'pos' : e.pts < 0 ? 'neg' : 'zero';
        const main = `<span class="spi-bar-label">${esc(e.label)}</span>
          <div class="spi-bar-track"><span class="spi-bar-fill spi-bar-${tone}" style="width:${pct}%"></span></div>
          ${ptsBadge(e.pts)}`;
        if (!e.tip) {
          return `<div class="spi-bar-row spi-bar-row--static">${main}</div>`;
        }
        const tipId = `spiBarTip_${i}`;
        return `<div class="spi-bar-row" role="button" tabindex="0" aria-expanded="false" aria-controls="${escAttr(tipId)}" ${tipAttr(e.tip)}>
          ${main}
          <div class="spi-bar-tip" id="${escAttr(tipId)}" hidden>${esc(e.tip)}</div>
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
        <h4 class="spi-dossier-h">${esc(t('recommend_ms'))}</h4>
        <p class="spi-dossier-empty">${esc(t('recommend_sd'))}</p>
      </section>`;
    }
    const units = row.recommended_units || [];
    const recPts = (row.breakdown && row.breakdown.recommend_ms) || 0;
    if (!units.length && !recPts) {
      return `<section class="spi-dossier-section">
        <h4 class="spi-dossier-h">${esc(t('recommend_ms'))}</h4>
        <p class="spi-dossier-empty">${esc(t('recommend_none'))}</p>
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
    const spec = row.specialty ? ` (${row.specialty})` : '';
    return `<section class="spi-dossier-section">
      <div class="spi-dossier-section-head">
        <h4 class="spi-dossier-h">${esc(t('recommend_ms'))} <span class="spi-dossier-h-sub">${esc(t('recommend_ms_sub'))}</span></h4>
        ${ptsBadge(recPts)}
      </div>
      <p class="spi-dossier-note">${esc(t('recommend_ms_note', { spec }))}</p>
      <div class="spi-rec-grid">${cards || `<p class="spi-dossier-empty">${esc(t('recommend_none'))}</p>`}</div>
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
    syncBoardTabsVisibility();
    document.querySelectorAll('.role-filter-btn[data-entity]').forEach((b) => {
      b.classList.toggle('active', b.dataset.entity === entity);
    });
    document.querySelectorAll('#spiBoardTabs .role-filter-btn[data-board]').forEach((b) => {
      b.classList.toggle('active', b.dataset.board === board);
    });
    document.querySelectorAll('.spi-role-seg .role-filter-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.role === role);
    });
    const ultBtn = $('#spiUltToggle');
    if (ultBtn) {
      ultBtn.classList.toggle('active', showUlt);
      ultBtn.setAttribute('aria-pressed', showUlt ? 'true' : 'false');
    }
    updateRarityFilterLabel();
    const map = $('#spiMapOnly');
    if (map) map.checked = mapOnly;
    const sp = $('#spiHasSpOnly');
    if (sp) sp.checked = hasSpOnly;
    updateSourceFilterLabel();
    updateTagFilterLabel();
    updateSkillFilterLabel();
    updateAbilFilterLabel();
    updateErFilterLabel();
    const search = $('#spiSearch');
    if (search) search.value = searchQuery;
    syncSearchClear();
  }

  function resetFilters() {
    board = 'sp';
    role = 'Attack';
    raritySel = defaultRaritySel();
    mapOnly = false;
    hasSpOnly = true;
    showUlt = false;
    sourceFilter = 'all';
    tagFilter = '';
    erFilter = '';
    skillFilterIds = [];
    abilFilterIds = [];
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
        ? `<span class="spi-chip spi-chip-cohort">${esc(t('cohort_ult'))}</span>`
        : row.has_sp
          ? `<span class="spi-chip spi-chip-cohort">${esc(t('cohort_sp'))}</span>`
          : '';
    const urPilotBadge =
      !isPilot && row.peaks_with_ur_pilot
        ? `<span class="spi-chip spi-chip-warn" title="${esc(t('peaks_ur_pilot_tip'))}">${esc(t('peaks_ur_pilot'))}</span>`
        : '';
    const adv = row.series_advantage;
    const advActive = !!row._advantage_active;
    const advBadge =
      !isPilot && adv
        ? advActive
          ? `<span class="spi-chip spi-chip-adv" title="${esc(adv.ability_name || '')}">${esc(t('adv_on', { n: adv.points }))}</span>`
          : `<span class="spi-chip spi-chip-muted" title="${esc(adv.ability_name || '')}">${esc(t('adv_off', { n: adv.points }))}</span>`
        : '';

    const header = `<div class="spi-dossier-head">
      <div class="spi-dossier-thumb">${renderFramedThumb(row, kind)}</div>
      <div class="spi-dossier-head-text">
        <h3 class="spi-modal-title" id="spiModalTitle">${esc(row.name || row.id)}</h3>
        <p class="spi-modal-sub">${esc(tRole(row.role) || row.role)}${isPilot && row.specialty ? ` · ${esc(row.specialty)}` : ''} · ${esc((row.mode || board) || '').toUpperCase()}</p>
        <div class="spi-dossier-badges">
          ${letterChip(row.letter)}
          <span class="spi-chip score">${esc(t('total_pt', { n: row.total }))}</span>
          ${cohort}
          ${urPilotBadge}
          ${advBadge}
        </div>
      </div>
      ${renderEntityKitHtml(row, isPilot)}
    </div>`;

    const specialtyBlock = renderEntityStatsBlock(row, kind);

    const scoreBlock = `<section class="spi-dossier-section spi-dossier-section--score">
      <h4 class="spi-dossier-h">${esc(t('score_breakdown'))}
        <span class="spi-dossier-h-sub spi-dossier-h-sub--fine">${esc(t('score_breakdown_sub'))}</span>
        <span class="spi-dossier-h-sub spi-dossier-h-sub--coarse">${esc(t('score_breakdown_sub_touch'))}</span>
      </h4>
      ${renderScoreViz(row)}
    </section>`;

    const recBlock = isPilot ? renderRecommendedUnits(row) : '';

    $('#spiModalBody').innerHTML = `
      ${header}
      ${specialtyBlock}
      ${scoreBlock}
      ${recBlock}
      <div class="spi-modal-actions">
        <a href="${detailPath}${encodeURIComponent(row.id)}"${isEmbedded() ? ` data-spi-open-db="${escAttr(kind)}:${escAttr(row.id)}"` : ' target="_blank" rel="noopener"'}>${esc(t('open_in_db'))}</a>
      </div>`;
    $('#spiModal').hidden = false;
    document.body.classList.add('spi-modal-open');
    document.documentElement.classList.add('spi-modal-open');
    const openDb = $('#spiModalBody').querySelector('[data-spi-open-db]');
    if (openDb) {
      openDb.addEventListener('click', (e) => {
        e.preventDefault();
        openDbDetail(kind, row);
      });
    }
    void loadEntityStatRanks(row, kind);
  }

  function openDbDetail(kind, row) {
    if (!row || !isEmbedded()) return;
    _spiRestoreRow = row;
    _spiOpeningDetail = true;
    closeModal();
    _spiOpeningDetail = false;
    if (typeof openDetail === 'function') {
      void openDetail(kind, String(row.id));
    }
  }

  function onAppDetailClosed() {
    if (!_spiRestoreRow) return;
    const row = _spiRestoreRow;
    _spiRestoreRow = null;
    if (!isEmbedded()) return;
    try {
      if (window.S && S.currentTab && S.currentTab !== 'investment_priority') return;
    } catch (_) {}
    const panel = document.getElementById('panel-investment_priority');
    if (panel && !panel.classList.contains('active')) return;
    openModal(row);
  }

  function closeModal() {
    collapseSpiBarTips();
    _spiModalEntityKey = '';
    if (!_spiOpeningDetail) _spiRestoreRow = null;
    $('#spiModal').hidden = true;
    document.body.classList.remove('spi-modal-open');
    document.documentElement.classList.remove('spi-modal-open');
  }

  function bindControls() {
    document.querySelectorAll('.role-filter-btn[data-entity]').forEach((btn) => {
      btn.addEventListener('click', () => {
        entity = btn.dataset.entity || 'units';
        raritySel = defaultRaritySel();
        skillFilterIds = [];
        abilFilterIds = [];
        applyFilterDom();
        fillFilterSelects();
        updateSkillFilterLabel();
        updateAbilFilterLabel();
        renderScoringGuide();
        render();
      });
    });
    document.querySelectorAll('#spiBoardTabs .role-filter-btn[data-board]').forEach((btn) => {
      btn.addEventListener('click', () => {
        board = btn.dataset.board || 'sp';
        abilFilterIds = [];
        applyFilterDom();
        fillAbilPanel();
        updateAbilFilterLabel();
        render();
      });
    });
    const ultToggle = $('#spiUltToggle');
    if (ultToggle) {
      ultToggle.addEventListener('click', () => {
        showUlt = !showUlt;
        applyFilterDom();
        render();
      });
    }
    document.querySelectorAll('.spi-role-seg .role-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        role = btn.dataset.role || 'Attack';
        applyFilterDom();
        renderScoringGuide();
        render();
      });
    });
    $('#spiRarityFilterBtn').addEventListener('click', (e) => toggleSpiFilterPanel('spiRarity', e));
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
    const skillBtn = $('#spiSkillFilterBtn');
    if (skillBtn) skillBtn.addEventListener('click', (e) => toggleSpiFilterPanel('spiSkill', e));
    const abilBtn = $('#spiAbilFilterBtn');
    if (abilBtn) abilBtn.addEventListener('click', (e) => toggleSpiFilterPanel('spiAbil', e));
    $('#spiErFilterBtn').addEventListener('click', (e) => toggleSpiFilterPanel('spiEr', e));
    document.addEventListener('click', (e) => {
      if (
        !e.target.closest(
          '#spiRarityWrap, #spiSourceWrap, #spiTagWrap, #spiSkillWrap, #spiAbilWrap, #spiErWrap'
        )
      )
        closeSpiFilterPanels();
    });
    let searchTimer = null;
    $('#spiSearch').addEventListener('input', (e) => {
      syncSearchClear();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
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
      if (e.target && e.target.getAttribute('data-close')) {
        closeModal();
        return;
      }
      const row = e.target.closest && e.target.closest('.spi-bar-row');
      const body = $('#spiModalBody');
      if (row && body && body.contains(row) && !row.classList.contains('spi-bar-row--static')) {
        e.preventDefault();
        toggleSpiBarTip(row);
        return;
      }
      if (body && e.target && body.contains(e.target)) {
        collapseSpiBarTips();
      }
    });
    $('#spiModal').addEventListener('keydown', (e) => {
      const row = e.target && e.target.closest && e.target.closest('.spi-bar-row');
      if (!row || row.classList.contains('spi-bar-row--static')) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSpiBarTip(row);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSpiFilterPanels();
        const modal = $('#spiModal');
        if (modal && !modal.hidden && collapseSpiBarTips()) return;
        closeModal();
      }
    });
    $('#spiScoringToggle').addEventListener('click', () => {
      const body = $('#spiScoringBody');
      const collapsed = body.classList.toggle('is-collapsed');
      $('#spiScoringToggle').setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    });
    spiRoot().querySelectorAll('.spi-lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lc = btn.getAttribute('data-lang') || 'EN';
        void setLang(lc);
      });
    });
  }

  function spiApiUrl() {
    const lang = uiLang();
    if (window.__SPI_PREVIEW__) {
      return `/api/sp_investment?preview=1&lang=${encodeURIComponent(lang)}`;
    }
    return `/api/sp_investment?lang=${encodeURIComponent(lang)}`;
  }

  async function fetchPayload() {
    if (!resolveDom()) return;
    statusEl.textContent = t('loading');
    grid.setAttribute('aria-busy', 'true');
    try {
      const r = await fetch(spiApiUrl());
      if (!r.ok) throw new Error('HTTP ' + r.status);
      payload = await r.json();
      if (payload.error) throw new Error(payload.error);
      _payloadLang = uiLang();
      applyLangStatic();
      fillFilterSelects();
      renderScoringGuide();
      render();
    } catch (err) {
      statusEl.textContent = t('status_error');
      grid.innerHTML = '';
      grid.setAttribute('aria-busy', 'false');
    }
  }

  async function boot() {
    if (!resolveDom()) return;
    applyLangStatic();
    if (!_controlsBound) {
      bindControls();
      _controlsBound = true;
    }
    syncSearchFromInput();
    if (_payloadLang === uiLang() && payload) {
      renderScoringGuide();
      render();
      return;
    }
    statusEl.textContent = t('loading');
    await fetchPayload();
  }

  async function onLangChange() {
    if (!resolveDom()) return;
    const lc = uiLang();
    if (_payloadLang === lc && payload) {
      tagFilter = '';
      applyLangStatic();
      renderScoringGuide();
      render();
      return;
    }
    tagFilter = '';
    applyLangStatic();
    await fetchPayload();
  }

  window.GgenSpInvestment = {
    _ready: false,
    boot,
    onTabShown: boot,
    onLangChange,
    onAppDetailClosed,
  };

  if (document.body.classList.contains('spi-page')) {
    boot().then(() => {
      window.GgenSpInvestment._ready = true;
    });
  }
})();
