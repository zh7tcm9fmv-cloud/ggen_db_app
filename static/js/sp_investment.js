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
  const SPI_TAG_ICON_CHAR = '/static/images/UI/UI_Common_Icon_Category_Chara_Main.webp';
  const SPI_TAG_ICON_UNIT = '/static/images/UI/UI_Common_Icon_Category_MS_Main.webp';
  const SPI_SERIES_ALL_LOGO = '/static/images/Logo-Series/logo_l_series_0010.webp';
  const SPI_CHIP_ICONS = {
    map: '/static/images/WeaponIcon/UI_Common_WeaponIcon_map.webp',
    preemptive: '/static/images/UI/UI_Common_Icon_PreemptiveAttack.webp',
    chance_step: '/static/images/UI/UI_Common_Icon_ChanceStep.webp',
    support_def: '/static/images/UI/UI_Common_BattleIcon_AssistDeffence_S.webp',
    support_atk: '/static/images/UI/UI_Common_BattleIcon_AssistAtack_S.webp',
    Ranged: '/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.webp',
    Melee: '/static/images/UI/UI_Common_TypeIcon_Melee_S.webp',
    Awaken: '/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.webp',
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
      tip: 'Bonus from tags that show up often on UR units (especially limited URs). Tags already on Expert restrictions are skipped here — Expert access covers them. Cap applies.',
    },
    limited_supporter_tags: {
      label: 'Limited-time Supporter tags',
      tip: '+1 per Tag covered by a limited-time Unit Assembly Supporter’s tier-3 leader skill, cap +2. Those Supporters are why players save gems.',
      hideIfZero: true,
    },
    er_access: {
      label: 'Eternal Road Expert access',
      tip: 'Units: Expert stages this Unit can enter (0–1 → 0; 2–6 → +1; 7+ → +2) — small eligibility gaps do not create free tiers. Characters: only character-restricted Expert stages (0 → 0; 1 → +1; 2+ → +2).',
    },
    combat_actions: {
      label: 'Combat actions',
      tip: 'Master-data Chance Step +1, Support Attack +1, or Support Defense +1 (same idea as browse ×2 filters). Role-weighted; cap +3. Not based on clear videos.',
      hideIfZero: true,
    },
    large_footprint: {
      label: '2×2',
      tip: 'Occupied area is 2×2. Mild upside (+1) — wider MAP and buff coverage usually outweighs placement inconvenience.',
      hideIfZero: true,
    },
    terrain: {
      label: 'Terrain coverage',
      tip: 'Floor: Space plus Land or Atmospheric at deploy Lv≥2. Extras need full affinity circle (Lv≥3). Terrain Capability triangle (Lv2) Space/Atmospheric each −1. Perfect bonus needs full-affinity coverage with no triangle on those keys.',
    },
    rarity: {
      label: 'Rarity',
      tip: 'Not scored — kit and other score factors carry the rank. Lower rarities usually have fewer strong skills/abilities. Non-Ultimate UR kits are omitted from this guide.',
    },
    transform: {
      label: 'Transform advantage',
      tip: 'Only counts when the alternate form unlocks deployable terrain, higher MOV, longer range, higher weapon power, or adds a MAP vs the base form. Transforming alone is not a bonus.',
    },
    map: {
      label: 'MAP weapons',
      tip: 'Damage MAP needs enough coverage cells (≥3) for presence; dash/MovingAttack, ammo 2+, and coverage add more. Tiny 1-cell MAP is not a free +1. Recovery / ally-support MAP scores +1 separately. Attack up to +4; Defense/Support cap +2.',
    },
    abilities: {
      label: 'Abilities',
      tip: 'Role-relevant ability effects. Permanent plain stats are usually 0 (Attack gets light credit for unconditional ATK%). HP/Counter-gated ATK is soft-capped. Advantage: series abilities do not score here (in-series only).',
    },
    skills_abilities: {
      label: 'Skills & abilities',
      tip: 'Role-weighted Character Skills plus Ability effects. Damage / range / mobility / survivability score highest; MP Up is moderate; EN Charge / Save EN score 0.',
    },
    series_affinity: {
      label: 'Series affinity',
      tip: 'Characters: +2 per series/faction affinity ability, cap +2. Units keep the unit affinity table.',
    },
    recommend_ms: {
      label: 'Recommended Mobile Suits',
      tip: 'Bonus from this Character’s best matching Units on this guide (top 3: A/A+ = +1, S/S+ = +2, cap +2). B+ and below do not score. Affinity-linked frames help, but do not outrank a stronger unconditional kit by themselves.',
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
      tip: 'Mobility (MOB). Raises Evasion when this unit is attacked. Scored from SP-grown MOB for this Unit Type — Support Type values it more; Attack Type treats it as a softer secondary vs ATK.',
    },
    stat_outlier: {
      label: 'Stat outlier',
      tip: 'Small niche bonus when a secondary stat is clearly exceptional for the role (e.g. very high Attack HP/EN). Cap +2.',
      hideIfZero: true,
    },
    special_defense: {
      label: 'Special defense',
      tip: 'Presence bonus for ability mitigation beyond the shield mechanism (damage taken down, barriers, negation). (Range Condition) Damage Reduction floors this at +2 even with a single kind. No missing penalty.',
      hideIfZero: true,
    },
    shield: {
      label: 'Shield',
      tip: 'Has a shield mechanism (~20% damage neglect). Defense units lose points if they lack one.',
    },
    movement: { label: 'Move', tip: 'MOV 5 is the modern baseline; 4 is below average. Defense still values high Move for support-defense coverage.' },
    movement_followup: {
      label: 'After-move MAP / Chance Step',
      tip: 'After-move MAP Weapon and/or Chance Step–style extra actions (not Increased MOV). Can stack, capped.',
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
      label: 'Multi combat specialty',
      tip: 'Strongest attack uses 2+ of Ranged/Melee/Awaken (e.g. Enhanced ZZ). Not Beam/Physical/Special.',
    },
    multi_weapon_attr: {
      label: 'Multi damage type',
      tip: 'Any weapon (including MAP) combines Beam/Physical/Special damage types (+2).',
    },
    weapon_damage_attr: {
      label: 'Special damage type',
      tip: 'Strongest non-MAP weapon includes Special damage type → +1. Beam-only or Physical-only → 0. Duals with Special count. Stacks with Multi damage type.',
      hideIfZero: true,
    },
    community: {
      label: 'Community',
      tip: 'IP-limited up/down nudge, hard-capped at ±2. Kits with no votes stay at 0.',
    },
    source: {
      label: 'Acquisition',
      tip: 'Filter only — does not change letter scores. Multi-select (OR): pick Development + Other to exclude Unit Assembly.',
      hideIfZero: true,
    },
    max_debuff: {
      label: 'ATK Down / DEF Down',
      tip: 'Defense Type: lasting ATK Down %. Support Type: lasting DEF Down % or instant pierce. Not scored for Attack.',
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
  let voteTallies = Object.create(null);
  let voteMine = Object.create(null);
  let voteBusyKey = '';
  const voteInFlight = Object.create(null);

  const SPI_VOTE_ICON_UP = '/static/images/UI/UI_Event_ML_Icon_Arrow_Blue.webp';
  const SPI_VOTE_ICON_DOWN = '/static/images/UI/UI_Event_ML_Icon_Arrow_Red.webp';

  function voteTargetKey(kind, id, boardName) {
    const k = kind === 'character' ? 'character' : 'unit';
    const b = k === 'character' ? 'sp' : String(boardName || board || 'sp');
    return `${k}:${String(id || '')}:${b}`;
  }

  function voteInfoForRow(row, kind) {
    const key = voteTargetKey(kind, row && row.id, row && (row.mode || board));
    const tall = voteTallies[key] || {};
    const up = Number(tall.up || 0) || 0;
    const down = Number(tall.down || 0) || 0;
    let adj = Number(tall.community_adj);
    if (!Number.isFinite(adj)) {
      adj = Number(row && row.community_adj);
      if (!Number.isFinite(adj)) {
        const net = up - down;
        adj = Math.max(-2, Math.min(2, net));
      }
    }
    return {
      key,
      up,
      down,
      adj,
      mine: voteMine[key] || null,
    };
  }

  function renderVoteControls(row, kind, compact) {
    const info = voteInfoForRow(row, kind);
    const upSrc = escAttr(imgUrl(SPI_VOTE_ICON_UP));
    const downSrc = escAttr(imgUrl(SPI_VOTE_ICON_DOWN));
    const upActive = info.mine === 'up' ? ' is-active' : '';
    const downActive = info.mine === 'down' ? ' is-active' : '';
    const adjN = info.adj > 0 ? `+${info.adj}` : String(info.adj || 0);
    const boardAttr = escAttr(kind === 'character' ? 'sp' : row.mode || board);
    const attrs = `data-vote-key="${escAttr(info.key)}" data-vote-kind="${escAttr(kind)}" data-vote-id="${escAttr(row.id)}" data-vote-board="${boardAttr}"`;
    if (compact) {
      // Corner icons on list cards — no nested <button> inside card button.
      return `<span class="spi-vote-corners" ${attrs}>
        <button type="button" class="spi-vote-corner spi-vote-up${upActive}" data-vote="up" title="${escAttr(t('vote_up'))}" aria-label="${escAttr(t('vote_up'))}" aria-pressed="${info.mine === 'up' ? 'true' : 'false'}">
          <img src="${upSrc}" alt="" width="22" height="22" decoding="async" onerror="gameImageUrlFallback(this)">
          <span class="spi-vote-count">${esc(String(info.up))}</span>
        </button>
        <button type="button" class="spi-vote-corner spi-vote-down${downActive}" data-vote="down" title="${escAttr(t('vote_down'))}" aria-label="${escAttr(t('vote_down'))}" aria-pressed="${info.mine === 'down' ? 'true' : 'false'}">
          <img src="${downSrc}" alt="" width="22" height="22" decoding="async" onerror="gameImageUrlFallback(this)">
          <span class="spi-vote-count">${esc(String(info.down))}</span>
        </button>
      </span>`;
    }
    return `<div class="spi-vote spi-vote--dossier" ${attrs}>
      <button type="button" class="spi-vote-btn spi-vote-up${upActive}" data-vote="up" title="${escAttr(t('vote_up'))}" aria-label="${escAttr(t('vote_up'))}" aria-pressed="${info.mine === 'up' ? 'true' : 'false'}">
        <img src="${upSrc}" alt="" width="22" height="22" decoding="async" onerror="gameImageUrlFallback(this)">
        <span class="spi-vote-count">${esc(String(info.up))}</span>
      </button>
      <button type="button" class="spi-vote-btn spi-vote-down${downActive}" data-vote="down" title="${escAttr(t('vote_down'))}" aria-label="${escAttr(t('vote_down'))}" aria-pressed="${info.mine === 'down' ? 'true' : 'false'}">
        <img src="${downSrc}" alt="" width="22" height="22" decoding="async" onerror="gameImageUrlFallback(this)">
        <span class="spi-vote-count">${esc(String(info.down))}</span>
      </button>
    </div>`;
  }

  function communityAdjLine(row, kind) {
    const info = voteInfoForRow(row, kind);
    const adjN = info.adj > 0 ? `+${info.adj}` : String(info.adj || 0);
    return `<div class="spi-card-community" title="${escAttr(t('community_tip'))}">${esc(
      t('vote_adj', { n: adjN })
    )}</div>`;
  }

  function communityAdjLabel(kind, id, boardName) {
    const info = voteInfoForRow({ id, mode: boardName }, kind);
    const adjN = info.adj > 0 ? `+${info.adj}` : String(info.adj || 0);
    return t('vote_adj', { n: adjN });
  }

  function softLiveRerank(focusId) {
    /** Re-sort / rebucket list from local totals — no API board refetch, no modal rebuild. */
    const y = window.scrollY || window.pageYOffset || 0;
    render();
    window.scrollTo(0, y);
    if (!focusId || !grid) return;
    const idSel = String(focusId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const card = grid.querySelector(`.spi-card[data-id="${idSel}"]`);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (rect.top < 72 || rect.bottom > window.innerHeight - 48) {
      try {
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (_) {
        card.scrollIntoView(false);
      }
    }
  }

  function letterFromCutoffs(cuts, total) {
    const n = Number(total) || 0;
    const list = cuts || [];
    for (let i = 0; i < list.length; i++) {
      if (n >= Number(list[i].min)) return String(list[i].letter || 'E');
    }
    return 'E';
  }

  function guideCutoffsForUnit(row) {
    const g = (payload && payload.scoring_guide) || {};
    const role = String((row && row.role) || '');
    const cohort = (row && row.letter_cohort) || ((row && row.has_sp) ? 'sp' : 'ur');
    const byRole =
      cohort === 'ur'
        ? g.ur_letter_cutoffs_by_role || {}
        : g.letter_cutoffs_by_role || {};
    const roleCuts = role && byRole[role];
    if (roleCuts && roleCuts.length) return roleCuts;
    return cohort === 'ur'
      ? g.ur_letter_cutoffs || g.letter_cutoffs || []
      : g.letter_cutoffs || [];
  }

  function guideCutoffsForCharacter(row) {
    const g = (payload && payload.scoring_guide) || {};
    const role = String((row && row.role) || '');
    const byRole = g.pilot_letter_cutoffs_by_role || {};
    const roleCuts = role && byRole[role];
    if (roleCuts && roleCuts.length) return roleCuts;
    return g.pilot_letter_cutoffs || g.letter_cutoffs || [];
  }

  function defenseUnitBbtEligible(row) {
    if (!row) return false;
    if (typeof row.bbt_eligible === 'boolean') return row.bbt_eligible;
    const g = (payload && payload.scoring_guide) || {};
    const cfg = g.defense_bbt_gate || {};
    if (cfg.enabled === false) return true;
    const bd = row.breakdown || {};
    const hp = Number(bd.hp) || 0;
    const shield = Number(bd.shield) || 0;
    const spec = Number(bd.special_defense) || 0;
    const extraLife = Number(bd.extra_life) || 0;
    const pre = Number(bd.preemptive) || 0;
    const mov = Number(bd.movement) || 0;
    const atkDn = Number(bd.max_debuff) || 0;
    const minHp = Number(cfg.min_hp_points != null ? cfg.min_hp_points : 1) || 1;
    const highHp = Number(cfg.high_hp_points != null ? cfg.high_hp_points : 2) || 2;
    const minMov = Number(cfg.min_movement_points != null ? cfg.min_movement_points : 2) || 2;
    const minAtkDn = Number(cfg.min_atk_down_points != null ? cfg.min_atk_down_points : 1) || 1;
    const tank =
      extraLife > 0 || hp >= highHp || (hp >= minHp && (shield > 0 || spec >= 1));
    const advantage =
      pre > 0 ||
      !!row.has_unit_support_defense ||
      Number(bd.unit_support_defense) > 0 ||
      mov >= minMov;
    return !!(tank && advantage && atkDn >= minAtkDn);
  }

  function supportUnitBbtEligible(row) {
    if (!row) return false;
    if (typeof row.bbt_eligible === 'boolean') return row.bbt_eligible;
    const g = (payload && payload.scoring_guide) || {};
    const cfg = g.support_bbt_gate || {};
    if (cfg.enabled === false) return true;
    const need = Number(cfg.min_max_debuff_points != null ? cfg.min_max_debuff_points : 1) || 1;
    return (Number((row.breakdown || {}).max_debuff) || 0) >= need;
  }

  function defensePilotBbtEligible(row) {
    if (!row) return false;
    if (typeof row.bbt_eligible === 'boolean') return row.bbt_eligible;
    const g = (payload && payload.scoring_guide) || {};
    const cfg = g.defense_pilot_bbt_gate || {};
    if (cfg.enabled === false) return true;
    const bd = row.breakdown || {};
    const need = Number(cfg.min_primary_stat_points != null ? cfg.min_primary_stat_points : 1) || 1;
    return Math.max(Number(bd.defense) || 0, Number(bd.reaction) || 0) >= need;
  }

  function applyBbtLetterCap(row, letter, kind) {
    const L = String(letter || 'E');
    if (L !== 'S+') return L;
    const role = String((row && row.role) || '');
    if (kind === 'character') {
      if (role === 'Defense' && !defensePilotBbtEligible(row)) return 'S';
      return L;
    }
    if (role === 'Defense' && !defenseUnitBbtEligible(row)) return 'S';
    if (role === 'Support' && !supportUnitBbtEligible(row)) return 'S';
    return L;
  }

  function letterFromTotalForKind(row, total, kind) {
    const cuts =
      kind === 'character' ? guideCutoffsForCharacter(row) : guideCutoffsForUnit(row);
    return applyBbtLetterCap(row, letterFromCutoffs(cuts, total), kind);
  }

  function clampCommunityAdj(up, down) {
    const net = (Number(up) || 0) - (Number(down) || 0);
    if (net > 2) return 2;
    if (net < -2) return -2;
    return net;
  }

  async function submitSpiVote(kind, id, boardName, vote) {
    const key = voteTargetKey(kind, id, boardName);
    if (voteBusyKey === key || voteInFlight[key]) return;
    voteBusyKey = key;
    voteInFlight[key] = true;
    const mine = voteMine[key] || null;
    let next = vote;
    if (vote === 'up' && mine === 'up') next = 'clear';
    if (vote === 'down' && mine === 'down') next = 'clear';
    // Already at requested state (e.g. duplicate click before mine synced).
    if (next === 'up' && mine === 'up') {
      voteBusyKey = '';
      delete voteInFlight[key];
      return;
    }
    if (next === 'down' && mine === 'down') {
      voteBusyKey = '';
      delete voteInFlight[key];
      return;
    }
    if (next === 'clear' && !mine) {
      voteBusyKey = '';
      delete voteInFlight[key];
      return;
    }

    const prevTall = Object.assign({}, voteTallies[key] || { up: 0, down: 0, community_adj: 0 });
    const prevMine = mine;

    // Optimistic local update so the card reacts immediately (no page refresh).
    let up = Number(prevTall.up || 0) || 0;
    let down = Number(prevTall.down || 0) || 0;
    if (prevMine === 'up') up = Math.max(0, up - 1);
    if (prevMine === 'down') down = Math.max(0, down - 1);
    if (next === 'up') up += 1;
    else if (next === 'down') down += 1;
    voteTallies[key] = {
      up,
      down,
      community_adj: clampCommunityAdj(up, down),
    };
    if (next === 'clear') delete voteMine[key];
    else voteMine[key] = next;
    applyVoteToLocalRow(kind, id, boardName, voteTallies[key]);
    softLiveRerank(id);
    patchVoteDom(kind, id, boardName);

    try {
      const r = await fetch('/api/sp_investment/vote', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, id, board: boardName, vote: next }),
        cache: 'no-store',
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const nextTall = {
        up: Number(d.up || 0) || 0,
        down: Number(d.down || 0) || 0,
        community_adj: Number(d.community_adj || 0) || 0,
      };
      const changed =
        nextTall.up !== voteTallies[key].up ||
        nextTall.down !== voteTallies[key].down ||
        nextTall.community_adj !== voteTallies[key].community_adj ||
        (d.my_vote || null) !== (voteMine[key] || null);
      voteTallies[key] = nextTall;
      if (d.my_vote) voteMine[key] = d.my_vote;
      else delete voteMine[key];
      applyVoteToLocalRow(kind, id, boardName, voteTallies[key]);
      if (changed) softLiveRerank(id);
      patchVoteDom(kind, id, boardName);
    } catch (e) {
      voteTallies[key] = prevTall;
      if (prevMine) voteMine[key] = prevMine;
      else delete voteMine[key];
      applyVoteToLocalRow(kind, id, boardName, prevTall);
      softLiveRerank(id);
      patchVoteDom(kind, id, boardName);
    } finally {
      voteBusyKey = '';
      delete voteInFlight[key];
    }
  }

  function applyVoteToLocalRow(kind, id, boardName, tally) {
    if (!payload) return;
    const adj = Number((tally && tally.community_adj) || 0) || 0;
    const boards =
      kind === 'character'
        ? [((payload.characters || {}).sp) || {}]
        : [
            ((payload.units || {}).sp) || payload.sp || {},
            ((payload.units || {}).ssp) || payload.ssp || {},
          ];
    let touched = null;
    boards.forEach((buckets) => {
      if (!buckets || typeof buckets !== 'object') return;
      Object.keys(buckets).forEach((bk) => {
        const rows = buckets[bk];
        if (!Array.isArray(rows)) return;
        rows.forEach((row) => {
          if (!row || String(row.id) !== String(id)) return;
          if (kind !== 'character' && boardName && row.mode && String(row.mode) !== String(boardName)) {
            return;
          }
          let objective = Number(
            row.total_objective != null ? row.total_objective : NaN
          );
          if (!Number.isFinite(objective)) {
            // Strip any prior community adj so we don't double-count.
            const prevAdj = Number(row.community_adj || 0) || 0;
            objective = (Number(row.total) || 0) - prevAdj;
          }
          row.total_objective = objective;
          row.community_adj = adj;
          row.total = objective + adj;
          const bd = Object.assign({}, row.breakdown || {});
          if (adj) bd.community = adj;
          else delete bd.community;
          row.breakdown = bd;
          row.letter = letterFromTotalForKind(row, row.total, kind);
          row.bucket = bucketFromLetter(row.letter);
          touched = row;
        });
      });
    });
    if (touched && rowById) rowById.set(String(id), touched);
  }

  function patchVoteDom(kind, id, boardName) {
    const info = voteInfoForRow({ id, mode: boardName }, kind);
    const adjLabel = communityAdjLabel(kind, id, boardName);
    const row = findRowById(id) || (rowById && rowById.get(String(id)));
    const total = row ? Number(row.total) || 0 : null;
    const letter = row ? row.letter || '?' : null;
    const idSel = String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

    const syncVoteWrap = (wrap) => {
      if (!wrap) return;
      const upBtn = wrap.querySelector('.spi-vote-up');
      const downBtn = wrap.querySelector('.spi-vote-down');
      if (upBtn) {
        upBtn.classList.toggle('is-active', info.mine === 'up');
        upBtn.setAttribute('aria-pressed', info.mine === 'up' ? 'true' : 'false');
        const c = upBtn.querySelector('.spi-vote-count');
        if (c) c.textContent = String(info.up);
      }
      if (downBtn) {
        downBtn.classList.toggle('is-active', info.mine === 'down');
        downBtn.setAttribute('aria-pressed', info.mine === 'down' ? 'true' : 'false');
        const c = downBtn.querySelector('.spi-vote-count');
        if (c) c.textContent = String(info.down);
      }
    };

    const root = spiRoot() || document;
    root.querySelectorAll(`.spi-card[data-id="${idSel}"]`).forEach((card) => {
      syncVoteWrap(card.querySelector('[data-vote-id]'));
      const score = card.querySelector('.spi-chip.score');
      if (score && total != null) score.textContent = `${total} Pt`;
      const lit = card.querySelector('.spi-chip.letter');
      if (lit && letter) {
        lit.textContent = letter;
        lit.className = `spi-chip letter ${letterClass(letter)}`;
      }
      const comm = card.querySelector('.spi-card-community');
      if (comm) comm.textContent = adjLabel;
    });

    const modal = $('#spiModal');
    if (modal && !modal.hidden && _spiModalEntityKey === `${kind}:${id}`) {
      const body = $('#spiModalBody');
      if (body) {
        syncVoteWrap(body.querySelector('[data-vote-id]'));
        const score = body.querySelector('.spi-dossier-badges .spi-chip.score');
        if (score && total != null) score.textContent = t('total_pt', { n: total });
        const lit = body.querySelector('.spi-dossier-badges .spi-chip.letter');
        if (lit && letter) {
          lit.textContent = letter;
          lit.className = `spi-chip letter ${letterClass(letter)}`;
          lit.setAttribute('title', `Grade ${letter}`);
        }
        const comm = body.querySelector('.spi-dossier-head-text .spi-card-community');
        if (comm) comm.textContent = adjLabel;
        const viz = body.querySelector('.spi-dossier-section--score');
        if (viz && row) {
          const next = document.createElement('div');
          next.innerHTML = `<section class="spi-dossier-section spi-dossier-section--score">
            <h4 class="spi-dossier-h">${esc(t('score_breakdown'))}
              <span class="spi-dossier-h-sub spi-dossier-h-sub--fine">${esc(t('score_breakdown_sub'))}</span>
              <span class="spi-dossier-h-sub spi-dossier-h-sub--coarse">${esc(t('score_breakdown_sub_touch'))}</span>
            </h4>
            ${renderScoreViz(row)}
          </section>`;
          const fresh = next.firstElementChild;
          if (fresh) viz.replaceWith(fresh);
        }
      }
    }
  }

  function findRowById(id) {
    const buckets = currentBoardBuckets();
    if (!buckets) return null;
    for (const bk of BUCKET_ORDER) {
      const rows = buckets[bk] || [];
      for (const r of rows) {
        if (r && String(r.id) === String(id)) return r;
      }
    }
    return null;
  }

  function currentBoardBuckets() {
    if (!payload) return null;
    if (entity === 'characters') return ((payload.characters || {}).sp) || {};
    if (board === 'ssp') return ((payload.units || {}).ssp) || payload.ssp || {};
    return ((payload.units || {}).sp) || payload.sp || {};
  }

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

  function decisionUiEnabled() {
    return !!window.__SPI_DECISION_UI__;
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
    updateSeriesFilterLabel();
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
    tagFilters = [];
    seriesFilters = [];
    updateTagFilterLabel();
    updateSeriesFilterLabel();
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
  let role = decisionUiEnabled() ? 'all' : 'Attack';
  let _unitBoardIndex = null;
  let raritySel = new Set(['SSR']);
  let mapOnly = false;
  let hasSpOnly = true;
  let showUlt = false;
  let sourceFilters = [];
  let sourceCombine = 'or';
  let tagFilters = [];
  let seriesFilters = [];
  let erFilters = [];
  let tagCombine = 'and';
  let seriesCombine = 'and';
  let erCombine = 'and';
  let skillCombine = 'and';
  let abilCombine = 'and';
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
    if (!adv || !tagFilters.length) return false;
    const matchTags = (adv.match_tags || []).map((t) => String(t).trim().toLowerCase());
    const series = String(adv.series_name || '').trim().toLowerCase();
    const generic = new Set([
      'gundam', 'mobile suit', 'mobile', 'suit', 'ms', 'unit', 'series',
      'alternative', 'rival', 'red', 'blue', 'white', 'black', 'ultimate',
    ]);
    for (const raw of tagFilters) {
      const tag = String(raw || '').trim().toLowerCase();
      if (!tag) continue;
      if (matchTags.includes(tag)) return true;
      if (!series) continue;
      const tagCore = tag.replace(/\s+series\s*$/i, '').trim();
      if (tagCore.length < 3 || generic.has(tagCore)) continue;
      if (series.includes(tagCore)) return true;
    }
    return false;
  }

  function letterFromTotal(total, cohort, row) {
    const g = (payload && payload.scoring_guide) || {};
    const role = String((row && row.role) || '');
    const byRole =
      cohort === 'ur'
        ? g.ur_letter_cutoffs_by_role || {}
        : g.letter_cutoffs_by_role || {};
    const roleCuts = role && byRole[role];
    const cuts =
      roleCuts && roleCuts.length
        ? roleCuts
        : cohort === 'ur'
          ? g.ur_letter_cutoffs || g.letter_cutoffs || []
          : g.letter_cutoffs || [];
    return applyBbtLetterCap(row, letterFromCutoffs(cuts, total), 'unit');
  }

  function bucketFromLetter(letter) {
    const g = (payload && payload.scoring_guide) || {};
    const map = g.bucket_by_letter || payload.bucket_by_letter || {};
    return map[letter] || 'niche';
  }

  /** Base published row + Ultimate series Advantage when the active tag matches. */
  function gatedErExpertIds(row) {
    const ids = Array.isArray(row && row.er_expert_ids) ? row.er_expert_ids.map(String) : [];
    if (!row) return ids;
    // SD units keep their own ER list. SD-linked characters may only keep stages
    // the paired unit can enter (no extra “pilot must hold the unit tag” filter).
    if (row.is_sd_linked) {
      const uid = String(row.linked_unit_id || row.id || '');
      const idx = unitBoardIndex();
      const unit = idx.sp.get(uid) || idx.ssp.get(uid);
      if (!unit || !Array.isArray(unit.er_expert_ids)) return ids;
      const allow = new Set(unit.er_expert_ids.map(String));
      return ids.filter((sid) => allow.has(sid));
    }
    return ids;
  }

  function effectiveRow(row) {
    if (!row) return row;
    const adv = row.series_advantage;
    const apply = seriesAdvantageApplies(row) && Number((adv && adv.points) || 0) > 0;
    let out = row;
    if (apply) {
      const total = Number(row.total || 0) + Number(adv.points || 0);
      const cohort = row.letter_cohort || (row.has_sp ? 'sp' : 'ur');
      const letter = letterFromTotal(total, cohort, row);
      out = {
        ...row,
        total,
        letter,
        bucket: bucketFromLetter(letter),
        _advantage_active: true,
        _advantage_points: Number(adv.points || 0),
      };
    } else if (row._advantage_active) {
      out = { ...row, _advantage_active: false };
    }
    if (decisionUiEnabled() && (out.is_sd_linked || out.is_sd)) {
      const gated = gatedErExpertIds(out);
      const prev = out.er_expert_ids || [];
      const changed =
        gated.length !== prev.length || gated.some((id, i) => String(id) !== String(prev[i]));
      if (changed) out = { ...out, er_expert_ids: gated };
    }
    return out;
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

  /** Browse-parity name shortcuts (SF / IJ / God / FATB / Devil / Spiegel). */
  function expandSpiSearchQuery(q) {
    let s = String(q || '').trim();
    if (!s) return '';
    s = s.replace(/\bdevil\s+gundam\b/gi, 'dark gundam');
    s = s.replace(/\bfatb\b/gi, 'full armor gundam thunderbolt');
    s = s.replace(/\bsf\b/gi, 'strike freedom');
    s = s.replace(/\bgod\b/gi, 'burning gundam');
    s = s.replace(/\bdevil\b/gi, 'dark gundam');
    s = s.replace(/\bspiegel\b/gi, 'shadow gundam');
    s = s.replace(/\bij\b/gi, 'infinite justice');
    return s.trim();
  }

  function rowMatchesSearch(row, q) {
    if (!q) return true;
    const expanded = expandSpiSearchQuery(q).toLowerCase();
    const name = String(row.name || '').toLowerCase();
    const tags = (row.tags || []).join(' ').toLowerCase();
    const tagsEn = (row.tags_en || row.tags || []).join(' ').toLowerCase();
    const id = String(row.id || '').toLowerCase();
    const hay = `${name} ${tags} ${tagsEn} ${id}`;
    if (hay.includes(expanded)) return true;
    // Multi-word expansions (e.g. "strike freedom") — require all tokens.
    const parts = expanded.split(/\s+/).filter(Boolean);
    if (parts.length > 1 && parts.every((p) => hay.includes(p))) return true;
    return false;
  }

  function syncSearchFromInput() {
    const input = $('#spiSearch');
    if (input) searchQuery = String(input.value || '');
  }

  function passesFilters(row) {
    // Role 0 = NPC / story-only — never show on this guide.
    if (String(row.role_id || '') === '0') return false;
    if (role !== 'all' && (row.role || '') !== role) return false;
    if (!rarityOk(row)) return false;
    const ult = isUltimateRow(row);
    // Ultimate Units only when the ULT toggle is on (Units board).
    if (entity === 'units' && ult && !showUlt) return false;
    // SP-eligible filter; Ultimate Units use the ULT toggle instead of has_sp.
    if (hasSpOnly && !row.has_sp && !ult) return false;
    if (entity === 'units' && mapOnly && !row.has_map) return false;
    if (sourceFilters.length) {
      const src = String(row.source || '');
      if (!spiCombineMatch(sourceFilters, (want) => src === String(want), sourceCombine)) return false;
    }
    if (tagFilters.length) {
      const tags = (row.tags || []).map((t) => String(t));
      if (!spiCombineMatch(tagFilters, (want) => tags.includes(String(want)), tagCombine)) return false;
    }
    if (seriesFilters.length) {
      const ids = (row.series_ids || []).map(String);
      if (!spiCombineMatch(seriesFilters, (want) => ids.includes(String(want)), seriesCombine)) return false;
    }
    if (erFilters.length) {
      const ids = gatedErExpertIds(row);
      if (!spiCombineMatch(erFilters, (want) => ids.includes(String(want)), erCombine)) return false;
    }
    if (entity === 'characters' && skillFilterIds.length) {
      const have = new Set((row.skills || []).map((s) => String((s && s.id) || '')));
      if (!spiCombineMatch(skillFilterIds, (id) => have.has(String(id)), skillCombine)) return false;
    }
    if (abilFilterIds.length) {
      const have = new Set((row.abilities || []).map((a) => String((a && a.id) || '')));
      if (!spiCombineMatch(abilFilterIds, (id) => have.has(String(id)), abilCombine)) return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (q && !rowMatchesSearch(row, q)) return false;
    return true;
  }

  function sourceOpts() {
    return [
      { value: 'gacha', label: t('source_gacha') },
      { value: 'event', label: t('source_event') },
      { value: 'dev', label: t('source_dev') },
    ];
  }

  function spiCombineOp(v) {
    return v === 'or' || v === 'and_or' ? v : 'and';
  }

  function nextSpiCombineMode(v) {
    const m = spiCombineOp(v);
    return m === 'and' ? 'and_or' : m === 'and_or' ? 'or' : 'and';
  }

  function spiCombineModeFromClick(ev, btn) {
    const modes = ['and', 'and_or', 'or'];
    if (!ev || !ev.detail) return nextSpiCombineMode(btn && btn.dataset.combineMode);
    const rect = btn.getBoundingClientRect();
    const idx = Math.min(2, Math.max(0, Math.floor(((ev.clientX - rect.left) / Math.max(rect.width, 1)) * 3)));
    return modes[idx];
  }

  function spiCombineMatch(items, matchOne, combine) {
    const seq = (items || []).map((x) => x).filter((x) => x != null && String(x) !== '');
    if (!seq.length) return true;
    if (seq.length === 1) return !!matchOne(seq[0]);
    const mode = spiCombineOp(combine);
    if (mode === 'or') return seq.some((x) => matchOne(x));
    if (mode === 'and_or') return matchOne(seq[0]) && seq.slice(1).some((x) => matchOne(x));
    return seq.every((x) => matchOne(x));
  }

  let _spiCombineClip = 0;
  function spiCombineSegToggleMarkup() {
    _spiCombineClip += 1;
    const cid = `spiCombClip${_spiCombineClip}`;
    const andSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" class="browse-combine-venn" viewBox="0 0 28 26" aria-hidden="true">` +
      `<defs><clipPath id="${cid}"><circle cx="10" cy="13" r="8"/></clipPath></defs>` +
      `<circle cx="10" cy="13" r="8" fill="none" stroke="currentColor" stroke-width=".85" opacity=".55"/>` +
      `<circle cx="18" cy="13" r="8" fill="none" stroke="currentColor" stroke-width=".85" opacity=".55"/>` +
      `<circle cx="18" cy="13" r="8" fill="currentColor" clip-path="url(#${cid})"/></svg>`;
    const andOrSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" class="browse-combine-venn browse-combine-venn--and-or" viewBox="0 0 41 26" aria-hidden="true">` +
      `<circle cx="10" cy="13" r="8" fill="currentColor"/>` +
      `<circle cx="10" cy="13" r="8" fill="none" stroke="currentColor" stroke-width=".85" opacity=".55"/>` +
      `<path fill="currentColor" opacity=".88" d="M22 13a5.5 5.5 0 0 1 5.5-5.5H33a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5h-5.5A5.5 5.5 0 0 1 22 13Z"/></svg>`;
    const orSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" class="browse-combine-venn" viewBox="0 0 28 26" aria-hidden="true">` +
      `<circle cx="10" cy="13" r="8" fill="currentColor" opacity=".55"/>` +
      `<circle cx="18" cy="13" r="8" fill="currentColor" opacity=".55"/></svg>`;
    return (
      `<span class="browse-combine-seg-thumb"></span>` +
      `<span class="browse-combine-seg browse-combine-seg--and">${andSvg}</span>` +
      `<span class="browse-combine-seg browse-combine-seg--and-or">${andOrSvg}</span>` +
      `<span class="browse-combine-seg browse-combine-seg--or">${orSvg}</span>`
    );
  }

  function syncSpiCombineToggleUi(btn, mode) {
    if (!btn) return;
    const m = spiCombineOp(mode);
    btn.classList.remove('browse-filter-combine-toggle--or', 'browse-filter-combine-toggle--and-or');
    if (m === 'or') btn.classList.add('browse-filter-combine-toggle--or');
    else if (m === 'and_or') btn.classList.add('browse-filter-combine-toggle--and-or');
    btn.dataset.combineMode = m;
    const tt =
      m === 'or'
        ? t('combine_tt_or')
        : m === 'and_or'
          ? t('combine_tt_and_or')
          : t('combine_tt_and');
    btn.title = tt !== 'combine_tt_and' && !String(tt).startsWith('combine_') ? tt : m === 'or' ? 'OR' : m === 'and_or' ? 'AND + OR' : 'AND';
    btn.setAttribute('aria-label', btn.title);
  }

  function closeSpiFilterPanels() {
    ['spiRarity', 'spiSource', 'spiTag', 'spiSeries', 'spiSkill', 'spiAbil', 'spiEr'].forEach((pfx) => {
      const panel = document.getElementById(pfx + 'FilterPanel');
      const btn = document.getElementById(pfx + 'FilterBtn');
      if (panel) panel.hidden = true;
      if (btn) {
        btn.setAttribute('aria-expanded', 'false');
        if (pfx === 'spiRarity') btn.classList.toggle('active', !isRarityFilterDefault() || raritySel.size === 0);
        else if (pfx === 'spiSkill') btn.classList.toggle('active', skillFilterIds.length > 0);
        else if (pfx === 'spiAbil') btn.classList.toggle('active', abilFilterIds.length > 0);
        else if (pfx === 'spiSource') btn.classList.toggle('active', sourceFilters.length > 0);
        else if (pfx === 'spiTag') btn.classList.toggle('active', tagFilters.length > 0);
        else if (pfx === 'spiSeries') btn.classList.toggle('active', seriesFilters.length > 0);
        else btn.classList.toggle('active', erFilters.length > 0);
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
      if (pfx === 'spiTag' || pfx === 'spiSeries' || pfx === 'spiEr' || pfx === 'spiSkill' || pfx === 'spiAbil') {
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
    // Lineage-style tag chips use .list-filter-tag-item without .rarity-filter-row.
    const rows = panel.querySelectorAll(
      '.rarity-filter-row[data-filter-text], .list-filter-tag-item[data-filter-text]'
    );
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

  function spiDdFooterHtml(combineKey) {
    const left = combineKey
      ? `<button type="button" class="browse-filter-combine-toggle" role="button" data-spi-combine="${escAttr(combineKey)}"><span class="browse-combine-seg-toggle" aria-hidden="true">${spiCombineSegToggleMarkup()}</span></button>`
      : '';
    return `<div class="filter-panel-clear-wrap spi-dd-footer" data-footer-ready="1"${combineKey ? ` data-spi-comb-key="${escAttr(combineKey)}"` : ''}>
      <div class="filter-panel-footer-left">${left}</div>
      <div class="filter-panel-footer-right">
        <button type="button" class="filter-panel-esc-btn" data-filter-esc="1">${esc(t('filter_esc'))}</button>
        <button type="button" class="filter-panel-clear-btn" data-filter-clear="1">${esc(t('filter_clear'))}</button>
      </div>
    </div>`;
  }

  function getSpiCombineMode(key) {
    if (key === 'tag') return tagCombine;
    if (key === 'series') return seriesCombine;
    if (key === 'er') return erCombine;
    if (key === 'skill') return skillCombine;
    if (key === 'abil') return abilCombine;
    if (key === 'source') return sourceCombine;
    return 'and';
  }

  function setSpiCombineMode(key, mode) {
    const m = spiCombineOp(mode);
    if (key === 'tag') tagCombine = m;
    else if (key === 'series') seriesCombine = m;
    else if (key === 'er') erCombine = m;
    else if (key === 'skill') skillCombine = m;
    else if (key === 'abil') abilCombine = m;
    else if (key === 'source') sourceCombine = m;
  }

  function bindSpiDdFooter(panel, onClear, combineKey) {
    const escBtn = panel.querySelector('[data-filter-esc]');
    const clrBtn = panel.querySelector('[data-filter-clear]');
    const combBtn = panel.querySelector('.browse-filter-combine-toggle');
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
    if (combBtn && combineKey) {
      syncSpiCombineToggleUi(combBtn, getSpiCombineMode(combineKey));
      combBtn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const next = spiCombineModeFromClick(ev, combBtn);
        if (getSpiCombineMode(combineKey) === next) return;
        setSpiCombineMode(combineKey, next);
        syncSpiCombineToggleUi(combBtn, next);
        render();
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
    if (!sourceFilters.length) {
      setFilterBtnLabel($('#spiSourceFilterLabel'), t('all_sources'), false);
      return;
    }
    if (sourceFilters.length === 1) {
      const opts = sourceOpts();
      const opt = opts.find((o) => o.value === sourceFilters[0]) || opts[0];
      setFilterBtnLabel($('#spiSourceFilterLabel'), opt.label, true);
      return;
    }
    const nLabel = t('source_filter_n', { n: sourceFilters.length });
    setFilterBtnLabel(
      $('#spiSourceFilterLabel'),
      nLabel.startsWith('source_filter') ? `${sourceFilters.length} sources` : nLabel,
      true
    );
  }

  function spiTagIconPath() {
    return entity === 'characters' ? SPI_TAG_ICON_CHAR : SPI_TAG_ICON_UNIT;
  }

  function setTagFilterBtnLabel(text, active) {
    const labelEl = $('#spiTagFilterLabel');
    if (!labelEl) return;
    const ic = spiTagIconPath();
    labelEl.innerHTML = `<span class="list-filter-btn-mini"><img class="filter-inline-icon role-filter-chip" src="${esc(imgUrl(ic))}" alt="" role="presentation"><span class="source-filter-btn-plain">${esc(text)}</span></span>`;
    const btn = labelEl.closest('.rarity-filter-btn');
    if (btn) btn.classList.toggle('active', !!active);
  }

  function updateTagFilterLabel() {
    if (!tagFilters.length) {
      setTagFilterBtnLabel(t('no_tag_filter'), false);
      return;
    }
    if (tagFilters.length === 1) {
      setTagFilterBtnLabel(tagFilters[0], true);
      return;
    }
    const nLabel = t('tag_filter_n', { n: tagFilters.length });
    setTagFilterBtnLabel(
      nLabel.startsWith('tag_filter') ? `${tagFilters.length} tags` : nLabel,
      true
    );
  }

  function updateErFilterLabel() {
    if (!erFilters.length) {
      setFilterBtnLabel($('#spiErFilterLabel'), t('no_er_filter'), false);
      return;
    }
    if (erFilters.length === 1) {
      const ers = (payload && payload.er_expert_filters) || [];
      const hit = ers.find((e) => String(e.id) === String(erFilters[0]));
      const text = hit
        ? entity === 'characters'
          ? hit.character_label || hit.label || hit.id
          : hit.unit_label || hit.label || hit.id
        : String(erFilters[0]);
      setFilterBtnLabel($('#spiErFilterLabel'), text, true);
      return;
    }
    const nLabel = t('er_filter_n', { n: erFilters.length });
    setFilterBtnLabel(
      $('#spiErFilterLabel'),
      nLabel.startsWith('er_filter') ? `${erFilters.length} stages` : nLabel,
      true
    );
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
    return `<label class="list-filter-tag-item skill-browse-row" data-filter-text="${escAttr(ft)}">
      <input type="checkbox" class="list-filter-sr skill-browse-item" id="${escAttr(id)}" value="${escAttr(item.id)}" ${checked ? 'checked' : ''}>
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
      <div class="filter-panel-scroll-inner spi-dd-scroll">
        <div class="skill-filter-grid-browse">${rows || ''}</div>
        <div class="spi-dd-empty" hidden>${esc(t('skill_search_empty'))}</div>
      </div>
      ${spiDdFooterHtml('skill')}`;
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
    bindSpiDdFooter(
      panel,
      () => {
        skillFilterIds = [];
        updateSkillFilterLabel();
        fillSkillPanel();
        closeSpiFilterPanels();
        render();
      },
      'skill'
    );
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
      <div class="filter-panel-scroll-inner spi-dd-scroll">
        <div class="skill-filter-grid-browse">${rows || ''}</div>
        <div class="spi-dd-empty" hidden>${esc(emptyMsg)}</div>
      </div>
      ${spiDdFooterHtml('abil')}`;
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
    bindSpiDdFooter(
      panel,
      () => {
        abilFilterIds = [];
        updateAbilFilterLabel();
        fillAbilPanel();
        closeSpiFilterPanels();
        render();
      },
      'abil'
    );
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

  function ddCheckRowHtml(value, label, checked, group, filterText) {
    const id = `spiDd_${group}_${String(value).replace(/[^a-zA-Z0-9_-]/g, '_') || 'all'}`;
    const ft = filterText != null ? filterText : String(label).toLowerCase();
    return `<label class="rarity-filter-row list-filter-tag-item" data-filter-text="${escAttr(ft)}">
      <input type="checkbox" name="spiDd_${escAttr(group)}" id="${escAttr(id)}" value="${escAttr(value)}" ${checked ? 'checked' : ''}>
      <span class="rarity-filter-all-label">${esc(label)}</span>
    </label>`;
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
    const sel = new Set(sourceFilters.map(String));
    // Compact checkbox list (not the wide 2-col chip panels) — only 3 options.
    const rows = sourceOpts()
      .map((o) => {
        const id = `spiDd_source_${String(o.value).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        return `<label class="rarity-filter-row" data-filter-text="${escAttr(String(o.label).toLowerCase())}">
      <input type="checkbox" name="spiDd_source" id="${escAttr(id)}" value="${escAttr(o.value)}" ${sel.has(String(o.value)) ? 'checked' : ''}>
      <span class="rarity-filter-all-label">${esc(o.label)}</span>
    </label>`;
      })
      .join('');
    panel.innerHTML = `<div class="spi-dd-scroll spi-source-scroll">${rows}</div>${spiDdFooterHtml('source')}`;
    panel.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        sourceFilters = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map((x) =>
          String(x.value)
        );
        updateSourceFilterLabel();
        render();
      });
    });
    bindSpiDdFooter(
      panel,
      () => {
        sourceFilters = [];
        updateSourceFilterLabel();
        fillSourcePanel();
        closeSpiFilterPanels();
        render();
      },
      'source'
    );
  }

  function tagFilterRowHtml(tagName, en, checked) {
    const ft = `${tagName} ${en || ''}`.toLowerCase();
    const ic = spiTagIconPath();
    return `<label class="list-filter-tag-item" data-filter-text="${escAttr(ft)}">
      <input type="checkbox" class="list-filter-sr" name="spiDd_tag" value="${escAttr(tagName)}" ${checked ? 'checked' : ''}>
      <span class="tag-composite list-filter-tag-composite">
        <span class="tag-part-icon"><img class="tag-icon-fg" src="${esc(imgUrl(ic))}" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback(this)"></span>
        <span class="tag-part-value">${esc(tagName)}</span>
      </span>
    </label>`;
  }

  function fillTagPanel() {
    const panel = $('#spiTagFilterPanel');
    if (!panel) return;
    const tags = (payload && payload.tag_catalog) || [];
    const tagsEn = (payload && payload.tag_catalog_en) || tags;
    const sel = new Set(tagFilters.map(String));
    const rows = tags
      .map((tagName, i) => {
        const en = tagsEn[i] || tagName;
        return tagFilterRowHtml(tagName, en, sel.has(String(tagName)));
      })
      .join('');
    // Match Units/Characters Tag (lineage) browse panel: wide + 2-col chip grid.
    panel.innerHTML = `${spiDdSearchWrapHtml(t('tag_search_ph'), t('tag_search_aria'))}
      <div class="filter-panel-scroll-inner spi-dd-scroll">
        <div class="filter-panel-grid browse-lineage-grid">${rows}</div>
        <div class="spi-dd-empty" hidden>${esc(t('tag_search_empty'))}</div>
      </div>
      ${spiDdFooterHtml('tag')}`;
    bindSpiDdSearch(panel);
    panel.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        tagFilters = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map((x) =>
          String(x.value)
        );
        updateTagFilterLabel();
        render();
      });
    });
    bindSpiDdFooter(
      panel,
      () => {
        tagFilters = [];
        updateTagFilterLabel();
        fillTagPanel();
        closeSpiFilterPanels();
        render();
      },
      'tag'
    );
  }

  function seriesCatalogRows() {
    const cat = (payload && payload.series_catalog) || [];
    const enCat = (payload && payload.series_catalog_en) || cat;
    const present = new Set();
    const buckets = currentBuckets();
    Object.keys(buckets || {}).forEach((bk) => {
      (buckets[bk] || []).forEach((row) => {
        (row.series_ids || []).forEach((sid) => present.add(String(sid)));
      });
    });
    return cat
      .map((row, i) => {
        const id = String((row && row.id) || '');
        if (!id || (present.size && !present.has(id))) return null;
        const en = enCat[i] && enCat[i].name ? String(enCat[i].name) : id;
        return {
          id,
          name: String((row && row.name) || id),
          nameEn: en,
          icon: String((row && row.icon) || ''),
        };
      })
      .filter(Boolean);
  }

  function seriesFilterRowHtml(row, checked) {
    const ft = `${row.name} ${row.nameEn || ''} ${row.id}`.toLowerCase();
    const ic = row.icon
      ? `<img class="tag-icon-fg" src="${esc(imgUrl(row.icon))}" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback(this)">`
      : `<span class="series-icon-fallback"></span>`;
    return `<label class="list-filter-tag-item" data-filter-text="${escAttr(ft)}">
      <input type="checkbox" class="list-filter-sr" name="spiDd_series" value="${escAttr(row.id)}" ${checked ? 'checked' : ''}>
      <span class="tag-composite list-filter-tag-composite list-filter-series-row">
        <span class="tag-part-icon">${ic}</span>
        <span class="tag-part-value">${esc(row.name)}</span>
      </span>
    </label>`;
  }

  function fillSeriesPanel() {
    const panel = $('#spiSeriesFilterPanel');
    if (!panel) return;
    const sel = new Set(seriesFilters.map(String));
    const rows = seriesCatalogRows()
      .map((row) => seriesFilterRowHtml(row, sel.has(String(row.id))))
      .join('');
    panel.innerHTML = `${spiDdSearchWrapHtml(t('series_search_ph'), t('series_search_aria'))}
      <div class="filter-panel-scroll-inner spi-dd-scroll">
        <div class="filter-panel-grid browse-series-grid">${rows}</div>
        <div class="spi-dd-empty" hidden>${esc(t('series_search_empty'))}</div>
      </div>
      ${spiDdFooterHtml('series')}`;
    bindSpiDdSearch(panel);
    panel.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        seriesFilters = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map((x) =>
          String(x.value)
        );
        updateSeriesFilterLabel();
        render();
      });
    });
    bindSpiDdFooter(
      panel,
      () => {
        seriesFilters = [];
        updateSeriesFilterLabel();
        fillSeriesPanel();
        closeSpiFilterPanels();
        render();
      },
      'series'
    );
  }

  function updateSeriesFilterLabel() {
    const labelEl = $('#spiSeriesFilterLabel');
    const btn = labelEl && labelEl.closest('.rarity-filter-btn');
    if (!labelEl) return;
    const allIc = `<img class="filter-inline-icon role-filter-chip" src="${esc(imgUrl(SPI_SERIES_ALL_LOGO))}" alt="" role="presentation">`;
    if (!seriesFilters.length) {
      labelEl.innerHTML = `<span class="list-filter-btn-mini series-filter-btn-all" title="${escAttr(t('no_series_filter'))}">${allIc}<span class="source-filter-btn-plain">${esc(t('no_series_filter'))}</span></span>`;
      if (btn) btn.classList.remove('active');
      return;
    }
    const cat = seriesCatalogRows();
    const rowFor = (sid) => cat.find((r) => String(r.id) === String(sid));
    if (seriesFilters.length === 1) {
      const hit = rowFor(seriesFilters[0]);
      const nm = hit ? hit.name : String(seriesFilters[0]);
      const ic = hit && hit.icon
        ? `<img class="filter-inline-icon role-filter-chip" src="${esc(imgUrl(hit.icon))}" alt="" role="presentation">`
        : allIc;
      labelEl.innerHTML = `<span class="list-filter-btn-mini">${ic}<span class="source-filter-btn-plain">${esc(nm)}</span></span>`;
      if (btn) btn.classList.add('active');
      return;
    }
    const iconsHtml = seriesFilters
      .map((sid) => {
        const hit = rowFor(sid);
        const nm = hit ? hit.name : String(sid);
        if (hit && hit.icon) {
          return `<img class="series-filter-toolbar-ic" src="${esc(imgUrl(hit.icon))}" alt="" role="presentation" title="${escAttr(nm)}">`;
        }
        return `<span class="series-filter-toolbar-fallback" title="${escAttr(nm)}"></span>`;
      })
      .join('');
    const nLabel = t('series_filter_n', { n: seriesFilters.length });
    const txt = nLabel.startsWith('series_filter') ? `${seriesFilters.length} series` : nLabel;
    labelEl.innerHTML = `<span class="series-filter-toolbar-icons">${iconsHtml}</span><span class="source-filter-btn-plain">${esc(txt)}</span>`;
    if (btn) btn.classList.add('active');
  }

  function erFilterRowHtml(e, label, en, checked) {
    const ft = `${label} ${en || ''} ${e.id}`.toLowerCase();
    const num = e.number != null ? String(e.number) : '';
    const numHtml = num
      ? `<span class="spi-er-num" aria-hidden="true">${esc(num)}</span>`
      : '';
    return `<label class="list-filter-tag-item" data-filter-text="${escAttr(ft)}">
      <input type="checkbox" class="list-filter-sr" name="spiDd_er" value="${escAttr(String(e.id))}" ${checked ? 'checked' : ''}>
      <span class="tag-composite list-filter-tag-composite">
        <span class="tag-part-icon">${numHtml}</span>
        <span class="tag-part-value">${esc(label)}</span>
      </span>
    </label>`;
  }

  function fillErPanel() {
    const panel = $('#spiErFilterPanel');
    if (!panel) return;
    const ers = (payload && payload.er_expert_filters) || [];
    const sel = new Set(erFilters.map(String));
    const rows = ers
      .map((e) => {
        const label =
          entity === 'characters'
            ? e.character_label || e.label || e.id
            : e.unit_label || e.label || e.id;
        const en = e.label || e.unit_label || e.character_label || e.id;
        return erFilterRowHtml(e, label, en, sel.has(String(e.id)));
      })
      .join('');
    panel.innerHTML = `${spiDdSearchWrapHtml(t('er_search_ph'), t('er_search_aria'))}
      <div class="filter-panel-scroll-inner spi-dd-scroll">
        <div class="filter-panel-grid browse-lineage-grid">${rows}</div>
        <div class="spi-dd-empty" hidden>${esc(t('er_search_empty'))}</div>
      </div>
      ${spiDdFooterHtml('er')}`;
    bindSpiDdSearch(panel);
    panel.querySelectorAll('input[type="checkbox"]').forEach((inp) => {
      inp.addEventListener('change', () => {
        erFilters = Array.from(panel.querySelectorAll('input[type="checkbox"]:checked')).map((x) =>
          String(x.value)
        );
        updateErFilterLabel();
        render();
      });
    });
    bindSpiDdFooter(
      panel,
      () => {
        erFilters = [];
        updateErFilterLabel();
        fillErPanel();
        closeSpiFilterPanels();
        render();
      },
      'er'
    );
  }

  function fillFilterSelects() {
    fillRarityPanel();
    fillSourcePanel();
    fillTagPanel();
    fillSeriesPanel();
    fillSkillPanel();
    fillAbilPanel();
    fillErPanel();
    updateRarityFilterLabel();
    updateSourceFilterLabel();
    updateTagFilterLabel();
    updateSeriesFilterLabel();
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
    renderChipSpend();

    const ovLines =
      guide && typeof guide.overrides === 'function' ? guide.overrides(lc) : g.overrides || [];
    const gapLines = guide && typeof guide.gaps === 'function' ? guide.gaps(lc) : g.gaps || [];
    const ov = $('#spiScoringOverrides');
    ov.innerHTML = (ovLines || []).map((line) => `<li>${esc(line)}</li>`).join('');
    const gaps = $('#spiScoringGaps');
    const gapsHeading = $('#spiGapsHeading');
    const hasGaps = Array.isArray(gapLines) && gapLines.length > 0;
    if (gaps) {
      gaps.innerHTML = hasGaps ? gapLines.map((line) => `<li>${esc(line)}</li>`).join('') : '';
      gaps.hidden = !hasGaps;
    }
    if (gapsHeading) gapsHeading.hidden = !hasGaps;

    const badgeObjective =
      guide && typeof guide.badgeObjective === 'function' ? guide.badgeObjective(lc) : 'Objective';
    const badgeEstimate =
      guide && typeof guide.badgeEstimate === 'function' ? guide.badgeEstimate(lc) : 'Estimate';

    const criteriaEl = $('#spiCriteria');
    if (criteriaEl) {
      const applyFilter = entity === 'characters' ? 'pilots' : 'units';
      const roleFilter = entity === 'characters' || role === 'all' ? null : role;
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
            ${
              cid === 'limited_supporter_tags'
                ? (() => {
                    const cat =
                      (g && g.limited_supporter_tag_catalog) ||
                      (payload && payload.limited_supporter_tag_catalog) ||
                      [];
                    if (!cat.length) {
                      return `<p class="spi-criteria-summary">${esc(t('lim_supp_tags_empty'))}</p>`;
                    }
                    const lis = cat
                      .map((row) => {
                        const nm = row.name || row.id || '';
                        const supps = (row.supporter_names || []).slice(0, 4).join(', ');
                        return `<li><strong>${esc(nm)}</strong>${supps ? ` — ${esc(supps)}` : ''}</li>`;
                      })
                      .join('');
                    return `<div class="spi-lim-supp-tags"><p class="spi-criteria-summary">${esc(
                      t('lim_supp_tags_intro')
                    )}</p><ul class="spi-lim-supp-tag-list">${lis}</ul></div>`;
                  })()
                : ''
            }
          </article>`;
        })
        .join('');
    }
    const cuts = $('#spiLetterCutoffs');
    const labels = g.bucket_labels || payload.bucket_labels || {};
    const isPilot = entity === 'characters';
    const fmtCuts = (rows, title) => {
      if (!rows || !rows.length) return '';
      const bits = rows
        .map((c) => `<span class="spi-letter-chip ${letterClass(c.letter)}">${esc(c.letter)} ≥ ${esc(c.min)}</span>`)
        .join('');
      return `<div class="spi-cutoff-group"><span class="spi-cutoff-group-label">${esc(title)}</span>${bits}</div>`;
    };
    const roleOrder = ['Attack', 'Defense', 'Support'];
    const roleLabel = (role) => tRole(role) || role;
    let cutoffHtml = '';
    if (isPilot) {
      const byRole = g.pilot_letter_cutoffs_by_role || {};
      const flat = g.pilot_letter_cutoffs || g.letter_cutoffs || [];
      roleOrder.forEach((role) => {
        const rows = byRole[role];
        if (rows && rows.length) cutoffHtml += fmtCuts(rows, `${t('sp_grades') || 'SP grades'} · ${roleLabel(role)}`);
      });
      if (!cutoffHtml) cutoffHtml = fmtCuts(flat, t('sp_grades'));
      const urPilot = g.ur_pilot_letter_cutoffs || [];
      if (urPilot.length) cutoffHtml += fmtCuts(urPilot, t('ultimate_grades'));
    } else {
      const byRole = g.letter_cutoffs_by_role || {};
      const urByRole = g.ur_letter_cutoffs_by_role || {};
      roleOrder.forEach((role) => {
        const rows = byRole[role];
        if (rows && rows.length) cutoffHtml += fmtCuts(rows, `${t('sp_grades') || 'SP Conversion grades'} · ${roleLabel(role)}`);
      });
      if (!cutoffHtml) cutoffHtml = fmtCuts(g.letter_cutoffs || [], t('sp_grades'));
      let urHtml = '';
      roleOrder.forEach((role) => {
        const rows = urByRole[role];
        if (rows && rows.length) urHtml += fmtCuts(rows, `${t('ultimate_grades') || 'Ultimate Unit grades'} · ${roleLabel(role)}`);
      });
      if (!urHtml) urHtml = fmtCuts(g.ur_letter_cutoffs || [], t('ultimate_grades'));
      cutoffHtml += urHtml;
    }
    const bucketBits = BUCKET_ORDER.map((k) => {
      const label = labels[k] || tBucket(k);
      return `<span class="spi-letter-chip">${esc(label)}</span>`;
    }).join('');
    cuts.innerHTML =
      cutoffHtml +
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

  function invalidateUnitBoardIndex() {
    _unitBoardIndex = null;
  }

  function unitBoardIndex() {
    if (_unitBoardIndex && _unitBoardIndex.payload === payload) return _unitBoardIndex;
    const sp = new Map();
    const ssp = new Map();
    const units = (payload && payload.units) || {};
    ['sp', 'ssp'].forEach((mode) => {
      const dest = mode === 'ssp' ? ssp : sp;
      const buckets = units[mode] || {};
      Object.keys(buckets).forEach((bk) => {
        (buckets[bk] || []).forEach((r) => {
          if (r && r.id) dest.set(String(r.id), r);
        });
      });
    });
    _unitBoardIndex = { payload, sp, ssp };
    return _unitBoardIndex;
  }

  function pairedBoardRow(row) {
    if (!row || entity === 'characters') return null;
    const idx = unitBoardIndex();
    const other = board === 'ssp' ? idx.sp : idx.ssp;
    return other.get(String(row.id)) || null;
  }

  function sspGainsForRow(row) {
    if (!row || entity === 'characters') return [];
    if (Array.isArray(row.ssp_gains) && row.ssp_gains.length) return row.ssp_gains;
    const idx = unitBoardIndex();
    const sp = idx.sp.get(String(row.id));
    const ssp = idx.ssp.get(String(row.id));
    if (!sp || !ssp) return [];
    const bd = (r, k) => Number((r.breakdown || {})[k]) || 0;
    const mov = (r) => Number((r.stats || {}).MOV) || 0;
    const ids = (r) =>
      new Set((r.abilities || []).map((a) => String((a && a.id) || '')).filter(Boolean));
    const gains = [];
    if (mov(ssp) > mov(sp)) gains.push({ kind: 'movement', from: mov(sp), to: mov(ssp) });
    if (!sp.has_map && ssp.has_map) gains.push({ kind: 'map_new' });
    else if (bd(ssp, 'map') > bd(sp, 'map')) gains.push({ kind: 'map_better' });
    if (bd(ssp, 'weapon_range') > bd(sp, 'weapon_range')) gains.push({ kind: 'weapon_range' });
    if (bd(ssp, 'weapon_power') > bd(sp, 'weapon_power')) gains.push({ kind: 'weapon_power' });
    if (bd(ssp, 'terrain') > bd(sp, 'terrain')) gains.push({ kind: 'terrain' });
    if (bd(ssp, 'preemptive') > bd(sp, 'preemptive')) gains.push({ kind: 'preemptive' });
    if (bd(sp, 'max_tension_weapon') < 0 && bd(ssp, 'max_tension_weapon') >= 0) {
      gains.push({ kind: 'max_tension_bypass' });
    }
    const spIds = ids(sp);
    const newAbil = (ssp.abilities || []).filter((a) => a && a.id && !spIds.has(String(a.id)));
    if (newAbil.length) {
      gains.push({
        kind: 'ability_new',
        names: newAbil.map((a) => a.name).filter(Boolean).slice(0, 4),
      });
    } else if (bd(ssp, 'abilities') > bd(sp, 'abilities')) {
      gains.push({ kind: 'abilities' });
    }
    return gains;
  }

  function _skillNameMatches(name, prefixes) {
    const n = String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\u3000/g, ' ');
    if (!n) return false;
    const compact = n.replace(/\s+/g, '');
    return prefixes.some((p) => n.startsWith(p) || compact.startsWith(p.replace(/\s+/g, '')));
  }

  function _kitItemNameMatches(name, re) {
    return re.test(String(name || ''));
  }

  function combatIconCounts(row) {
    const role = String((row && row.role) || '');
    const isDef = /defense|耐久/i.test(role);
    const isSup = /support|支援/i.test(role);
    const csRe = /chance\s*step|チャンスステップ|額外行動/i;
    const saRe = /support\s*attack|支援攻撃|支援攻擊/i;
    const sdRe = /support\s*defense|支援防御|支援防禦|支援防衛/i;
    let csPlus = 0;
    let saPlus = 0;
    let sdPlus = 0;
    const items = []
      .concat((row && row.abilities) || [])
      .concat((row && row.skills) || []);
    items.forEach((it) => {
      const name = (it && it.name) || '';
      if (_kitItemNameMatches(name, csRe)) csPlus += 1;
      if (_kitItemNameMatches(name, saRe)) saPlus += 1;
      if (_kitItemNameMatches(name, sdRe)) sdPlus += 1;
    });
    return {
      cs: Math.min(2, 1 + (csPlus > 0 ? 1 : 0)),
      sa: Math.min(5, Math.max(isSup ? 1 : 0, saPlus)),
      sd: Math.min(5, Math.max(isDef ? 1 : 0, sdPlus)),
    };
  }

  function kitHighlightChips(row) {
    if (!row) return [];
    const cap = 8;
    const chips = [];
    const add = (kind, extra) => {
      if (chips.length >= cap) return;
      if (chips.some((c) => c.kind === kind)) return;
      chips.push(Object.assign({ kind }, extra || {}));
    };
    const isChar = String(row.entity || '') === 'character' || entity === 'characters';
    const bd = row.breakdown || {};
    if (!isChar) {
      const mov = Number((row.stats || {}).MOV) || 0;
      if (mov >= 6) add('mov6', { n: mov });
      if (row.has_map) add('map', { icon: SPI_CHIP_ICONS.map, n: 1 });
      // Text label (not MAP icon) — rare after-move MAP; naming must stay explicit.
      if (row.has_after_move_map) add('after_move_map');
      if (Number(bd.max_debuff) > 0) add('debuff', { role: String(row.role || '') });
      if (Number(bd.preemptive) > 0) add('preemptive', { icon: SPI_CHIP_ICONS.preemptive, n: 1 });
    } else {
      const spec = String(row.specialty || '').trim();
      const specIcon = SPI_CHIP_ICONS[spec];
      if (spec) add('specialty', { value: spec, icon: specIcon || '', n: specIcon ? 1 : 0 });
      const combat = combatIconCounts(row);
      if (combat.cs >= 2) add('chance_step', { icon: SPI_CHIP_ICONS.chance_step, n: combat.cs });
      if (combat.sd > 0) add('support_def', { icon: SPI_CHIP_ICONS.support_def, n: combat.sd });
      if (combat.sa > 0) add('support_atk', { icon: SPI_CHIP_ICONS.support_atk, n: combat.sa });
      (row.skills || []).forEach((sk) => {
        const name = (sk && sk.name) || '';
        const icon = (sk && sk.icon) || '';
        if (_skillNameMatches(name, ['sway', 'スウェー', '搖擺閃避'])) add('sway', { icon, n: icon ? 1 : 0 });
        if (_skillNameMatches(name, ['mp up', 'mpアップ', 'mp上升', 'mp提升'])) add('mp_up', { icon, n: icon ? 1 : 0 });
      });
    }
    const erN = gatedErExpertIds(row).length;
    if (erN) add('er', { n: erN });
    return chips.slice(0, cap);
  }

  function highlightChipLabel(chip) {
    if (!chip) return '';
    switch (chip.kind) {
      case 'mov6':
        return t('why_mov6', { n: chip.n });
      case 'map':
        return t('why_map');
      case 'er':
        return t('why_er', { n: chip.n });
      case 'debuff': {
        const role = String(chip.role || '');
        if (/defense|耐久/i.test(role)) return t('why_atk_down');
        if (/support|支援/i.test(role)) return t('why_def_down');
        return t('why_debuff');
      }
      case 'after_move_map':
        return t('why_after_move_map');
      case 'followup':
        return t('why_after_move_map');
      case 'preemptive':
        return t('why_preemptive');
      case 'sway':
        return t('why_sway');
      case 'mp_up':
        return t('why_mp_up');
      case 'chance_step':
        return t('why_chance_step');
      case 'support_def':
        return t('why_support_def');
      case 'support_atk':
        return t('why_support_atk');
      case 'combat':
        return t('why_combat');
      case 'specialty':
        return chip.value || '';
      default:
        return chip.kind;
    }
  }

  function isIconHighlightChip(chip) {
    return !!(chip && chip.icon && Number(chip.n) > 0);
  }

  function highlightIconChipHtml(chip) {
    const label = highlightChipLabel(chip);
    const n = Math.max(0, Number(chip && chip.n) || 0);
    const icon = chip && chip.icon;
    const lg = chip.kind === 'preemptive' || chip.kind === 'map' ? ' spi-why-icon--lg' : '';
    const imgs = Array.from({ length: Math.max(1, n) })
      .map(
        () =>
          `<img class="spi-why-icon-img${lg}" src="${esc(imgUrl(icon))}" alt="" loading="lazy" decoding="async" onerror="gameImageUrlFallback(this)">`
      )
      .join('');
    return `<span class="spi-why-icon" title="${escAttr(label)}" aria-label="${escAttr(label)}">${imgs}</span>`;
  }

  function highlightTextChipHtml(chip) {
    return `<span class="spi-why-chip">${esc(highlightChipLabel(chip))}</span>`;
  }

  function sspGainLabel(gain) {
    if (!gain) return '';
    switch (gain.kind) {
      case 'movement':
        return t('ssp_gain_movement', { from: gain.from, to: gain.to });
      case 'map_new':
        return t('ssp_gain_map_new');
      case 'map_better':
        return t('ssp_gain_map_better');
      case 'weapon_range':
        return t('ssp_gain_weapon_range');
      case 'weapon_power':
        return t('ssp_gain_weapon_power');
      case 'terrain':
        return t('ssp_gain_terrain');
      case 'abilities':
        return t('ssp_gain_abilities');
      case 'ability_new':
        return (gain.names || []).map((n) => t('ssp_gain_ability_new', { name: n })).join(' · ');
      case 'max_tension_bypass':
        return t('ssp_gain_max_tension_bypass');
      case 'preemptive':
        return t('ssp_gain_preemptive');
      default:
        return gain.kind;
    }
  }

  function renderHighlightChips(row, extraClass) {
    if (!decisionUiEnabled()) return '';
    const chips = kitHighlightChips(row);
    if (!chips.length) return '';
    const icons = chips.filter(isIconHighlightChip);
    const texts = chips.filter((c) => !isIconHighlightChip(c));
    const iconRow = icons.length
      ? `<div class="spi-why-icons">${icons.map((c) => highlightIconChipHtml(c)).join('')}</div>`
      : '';
    const textRow = texts.length
      ? `<div class="spi-why-chips">${texts.map((c) => highlightTextChipHtml(c)).join('')}</div>`
      : '';
    return `<div class="spi-why-block${extraClass ? ` ${extraClass}` : ''}">${iconRow}${textRow}</div>`;
  }

  function renderBoardGains(row) {
    if (!decisionUiEnabled() || entity === 'characters') return '';
    if (board !== 'ssp') return '';
    const gains = sspGainsForRow(row);
    if (!gains.length) return '';
    const items = gains.map((g) => `<li>${esc(sspGainLabel(g))}</li>`).join('');
    return `<section class="spi-dossier-section spi-dossier-section--gains">
      <h4 class="spi-dossier-h">${esc(t('ssp_gains_title'))}</h4>
      <ul class="spi-gains-list">${items}</ul>
    </section>`;
  }

  function renderDualLetter(row) {
    if (!decisionUiEnabled() || entity === 'characters') return '';
    const other = pairedBoardRow(row);
    const otherLetter = (other && other.letter) || row.paired_letter || '';
    if (!otherLetter) return '';
    const otherBoard = board === 'ssp' ? 'sp' : 'ssp';
    const labelKey = otherBoard === 'ssp' ? 'dual_letter_ssp' : 'dual_letter_sp';
    return `<button type="button" class="spi-chip spi-chip-paired" data-spi-paired-board="${escAttr(otherBoard)}" title="${escAttr(t(labelKey, { letter: otherLetter }))}">${esc(t(labelKey, { letter: otherLetter }))}</button>`;
  }

  function erStageLabel(sid, row) {
    const filters = (payload && payload.er_expert_filters) || [];
    const hit = filters.find((f) => String(f.id) === String(sid));
    if (!hit) return String(sid);
    if (row && (row.is_sd_linked || row.is_sd)) {
      return hit.unit_label || hit.label || hit.character_label || String(sid);
    }
    if (entity === 'characters') {
      return hit.character_label || hit.label || hit.unit_label || String(sid);
    }
    return hit.unit_label || hit.label || hit.character_label || String(sid);
  }

  function renderErStages(row) {
    if (!decisionUiEnabled()) return '';
    const ids = gatedErExpertIds(row);
    if (!ids.length) {
      return `<section class="spi-dossier-section">
        <h4 class="spi-dossier-h">${esc(t('er_stages_title'))}</h4>
        <p class="spi-dossier-empty">${esc(t('er_stages_none'))}</p>
      </section>`;
    }
    const lis = ids
      .slice(0, 24)
      .map((sid) => `<li>${esc(erStageLabel(sid, row))}</li>`)
      .join('');
    const more = ids.length > 24 ? `<li>… +${ids.length - 24}</li>` : '';
    return `<section class="spi-dossier-section">
      <h4 class="spi-dossier-h">${esc(t('er_stages_title'))} <span class="spi-dossier-h-sub">${ids.length}</span></h4>
      <ul class="spi-er-stage-list">${lis}${more}</ul>
    </section>`;
  }

  function renderRoleGroups(rows, kind) {
    const order = ['Attack', 'Support', 'Defense'];
    const groups = { Attack: [], Support: [], Defense: [] };
    rows.forEach((r) => {
      const rk = r.role || 'Attack';
      if (!groups[rk]) groups[rk] = [];
      groups[rk].push(r);
    });
    return order
      .filter((rk) => (groups[rk] || []).length)
      .map((rk) => {
        const cards = (groups[rk] || []).map((r) => renderSpiCard(r, kind)).join('');
        return `<div class="spi-role-group">
          <h4 class="spi-role-group-h">${esc(tRole(rk))}</h4>
          <div class="spi-cards">${cards}</div>
        </div>`;
      })
      .join('');
  }

  function renderSpiCard(r, kind) {
    const advNote = r._advantage_active
      ? `<span class="spi-chip spi-chip-adv" title="${esc(t('adv_on', { n: r._advantage_points }))}">${esc(t('adv_chip', { n: r._advantage_points }))}</span>`
      : '';
    return `<div class="spi-card" role="button" tabindex="0" data-id="${esc(r.id)}">
      ${renderVoteControls(r, kind, true)}
      <div class="spi-card-thumb-wrap">${renderFramedThumb(r, kind)}</div>
      <div class="spi-card-name">${esc(r.name || r.id)}</div>
      <div class="spi-card-meta">
        <span class="spi-chip letter ${letterClass(r.letter)}">${esc(r.letter || '?')}</span>
        <span class="spi-chip score">${esc(r.total)} Pt</span>
        ${advNote}
      </div>
      ${renderHighlightChips(r, 'spi-why-block--card')}
      ${communityAdjLine(r, kind)}
    </div>`;
  }

  function ensureDecisionUiChrome() {
    if (!decisionUiEnabled()) return;
    const seg = document.querySelector('.spi-role-seg');
    if (seg && !seg.querySelector('[data-role="all"]')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'role-filter-btn';
      btn.setAttribute('data-role', 'all');
      btn.setAttribute('data-i18n-role', 'all');
      btn.title = tRole('all');
      btn.innerHTML = `<span data-i18n-role="all">${esc(tRole('all'))}</span>`;
      seg.insertBefore(btn, seg.firstChild);
    }
    const scoringBody = $('#spiScoringBody');
    if (scoringBody && !$('#spiChipSpend')) {
      const wrap = document.createElement('div');
      wrap.id = 'spiChipSpend';
      wrap.className = 'spi-chip-spend';
      scoringBody.insertBefore(wrap, scoringBody.firstChild);
    }
  }

  function renderChipSpend() {
    const el = $('#spiChipSpend');
    if (!el) return;
    if (!decisionUiEnabled()) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = `<h3 class="spi-scoring-subhead">${esc(t('chip_spend_title'))}</h3>
      <ul class="spi-scoring-list">
        <li>${esc(t('chip_spend_1'))}</li>
        <li>${esc(t('chip_spend_2'))}</li>
        <li>${esc(t('chip_spend_3'))}</li>
        <li>${esc(t('chip_spend_4'))}</li>
        <li>${esc(t('chip_spend_5'))}</li>
      </ul>`;
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
      const cards =
        decisionUiEnabled() && role === 'all'
          ? renderRoleGroups(rows, kind)
          : rows.map((r) => renderSpiCard(r, kind)).join('');
      html += `<section class="spi-bucket">
        <div class="spi-bucket-head" data-bucket="${esc(bk)}">
          <h3>${esc(labels[bk] || tBucket(bk) || bk)}</h3>
          <span class="spi-bucket-count">${rows.length}</span>
        </div>
        ${
          decisionUiEnabled() && role === 'all'
            ? cards || `<p class="spi-status">${esc(t('no_bucket'))}</p>`
            : `<div class="spi-cards">${cards || `<p class="spi-status">${esc(t('no_bucket'))}</p>`}</div>`
        }
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
    const advNote = tagFilters.length ? t('adv_note') : '';
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
      out.push({ key: k, label: meta.label || k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), tip: meta.tip || '', pts });
    });
    out.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts) || a.label.localeCompare(b.label));
    return out;
  }

  function scoreBreakdownForRow(row) {
    const bd = Object.assign({}, (row && row.breakdown) || {});
    const kind =
      String((row && row.entity) || '') === 'character' || entity === 'characters'
        ? 'character'
        : 'unit';
    const info = voteInfoForRow(row, kind);
    let adj = Number(row && row.community_adj);
    if (!Number.isFinite(adj)) adj = info.adj;
    // Show Community bar when there is a nudge or any votes (counts stay on corner icons).
    if (adj || info.up || info.down || bd.community) {
      bd.community = adj;
    } else {
      delete bd.community;
    }
    return bd;
  }

  function renderScoreViz(row) {
    const entries = breakdownEntries(scoreBreakdownForRow(row));
    if (!entries.length) {
      return `<p class="spi-dossier-empty">No score factors for this entry.</p>`;
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

  function renderRecommendedCharacters(row) {
    if (row.is_sd) {
      return `<section class="spi-dossier-section">
        <h4 class="spi-dossier-h">${esc(t('recommend_ch'))}</h4>
        <p class="spi-dossier-empty">${esc(t('recommend_sd'))}</p>
      </section>`;
    }
    const chars = row.recommended_characters || [];
    if (!chars.length) {
      return `<section class="spi-dossier-section">
        <h4 class="spi-dossier-h">${esc(t('recommend_ch'))}</h4>
        <p class="spi-dossier-empty">${esc(t('recommend_none'))}</p>
      </section>`;
    }
    const cards = chars
      .map((c) => {
        const thumb = renderFramedThumb(c, 'character');
        const specChip = c.specialty
          ? `<span class="spi-chip">${esc(c.specialty)}</span>`
          : '';
        return `<a class="spi-rec-card" href="/c/${encodeURIComponent(c.id)}" target="_blank" rel="noopener">
          ${thumb}
          <div class="spi-rec-meta">
            <span class="spi-rec-name">${esc(c.name || c.id)}</span>
            <span class="spi-chip letter ${letterClass(c.letter)}">${esc(c.letter || '?')}</span>${specChip}
          </div>
        </a>`;
      })
      .join('');
    return `<section class="spi-dossier-section">
      <div class="spi-dossier-section-head">
        <h4 class="spi-dossier-h">${esc(t('recommend_ch'))} <span class="spi-dossier-h-sub">${esc(t('recommend_ch_sub'))}</span></h4>
      </div>
      <p class="spi-dossier-note">${esc(t('recommend_ch_note'))}</p>
      <div class="spi-rec-grid">${cards}</div>
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
    updateSeriesFilterLabel();
    updateSkillFilterLabel();
    updateAbilFilterLabel();
    updateErFilterLabel();
    const search = $('#spiSearch');
    if (search) search.value = searchQuery;
    syncSearchClear();
  }

  function resetFilters() {
    board = 'sp';
    role = decisionUiEnabled() ? 'all' : 'Attack';
    raritySel = defaultRaritySel();
    mapOnly = false;
    hasSpOnly = true;
    showUlt = false;
    sourceFilters = [];
    tagFilters = [];
    seriesFilters = [];
    erFilters = [];
    tagCombine = 'and';
    seriesCombine = 'and';
    erCombine = 'and';
    skillCombine = 'and';
    abilCombine = 'and';
    sourceCombine = 'or';
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
          ${renderDualLetter(row)}
          ${cohort}
          ${urPilotBadge}
          ${advBadge}
        </div>
        ${renderHighlightChips(row, 'spi-why-block--dossier')}
        ${communityAdjLine(row, kind)}
        ${renderVoteControls(row, kind, false)}
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

    const recBlock = isPilot ? renderRecommendedUnits(row) : renderRecommendedCharacters(row);

    _spiModalEntityKey = `${kind}:${row.id}`;
    $('#spiModalBody').innerHTML = `
      ${header}
      ${specialtyBlock}
      ${renderBoardGains(row)}
      ${renderErStages(row)}
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
    const pairedBtn = $('#spiModalBody').querySelector('[data-spi-paired-board]');
    if (pairedBtn) {
      pairedBtn.addEventListener('click', () => {
        const next = pairedBtn.getAttribute('data-spi-paired-board') || 'sp';
        board = next === 'ssp' ? 'ssp' : 'sp';
        applyFilterDom();
        fillAbilPanel();
        fillSeriesPanel();
        updateAbilFilterLabel();
        updateSeriesFilterLabel();
        render();
        const idx = unitBoardIndex();
        const nextRow = (board === 'ssp' ? idx.ssp : idx.sp).get(String(row.id));
        if (nextRow) openModal(effectiveRow(nextRow));
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
        fillSeriesPanel();
        updateAbilFilterLabel();
        updateSeriesFilterLabel();
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
    const seriesBtn = $('#spiSeriesFilterBtn');
    if (seriesBtn) seriesBtn.addEventListener('click', (e) => toggleSpiFilterPanel('spiSeries', e));
    const skillBtn = $('#spiSkillFilterBtn');
    if (skillBtn) skillBtn.addEventListener('click', (e) => toggleSpiFilterPanel('spiSkill', e));
    const abilBtn = $('#spiAbilFilterBtn');
    if (abilBtn) abilBtn.addEventListener('click', (e) => toggleSpiFilterPanel('spiAbil', e));
    $('#spiErFilterBtn').addEventListener('click', (e) => toggleSpiFilterPanel('spiEr', e));
    document.addEventListener('click', (e) => {
      if (
        !e.target.closest(
          '#spiRarityWrap, #spiSourceWrap, #spiTagWrap, #spiSeriesWrap, #spiSkillWrap, #spiAbilWrap, #spiErWrap'
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
      const voteBtn = e.target.closest('.spi-vote-btn, .spi-vote-corner');
      if (voteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = voteBtn.closest('[data-vote-id]');
        if (!wrap) return;
        void submitSpiVote(
          wrap.getAttribute('data-vote-kind') || 'unit',
          wrap.getAttribute('data-vote-id'),
          wrap.getAttribute('data-vote-board') || 'sp',
          voteBtn.getAttribute('data-vote')
        );
        return;
      }
      const card = e.target.closest('.spi-card');
      if (!card) return;
      openModal(rowById.get(String(card.dataset.id)));
    });
    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('.spi-vote-btn, .spi-vote-corner')) return;
      const card = e.target.closest('.spi-card');
      if (!card || e.target !== card) return;
      e.preventDefault();
      openModal(rowById.get(String(card.dataset.id)));
    });
    $('#spiModal').addEventListener('click', (e) => {
      const voteBtn = e.target.closest('.spi-vote-btn, .spi-vote-corner');
      if (voteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = voteBtn.closest('[data-vote-id]');
        if (!wrap) return;
        void submitSpiVote(
          wrap.getAttribute('data-vote-kind') || 'unit',
          wrap.getAttribute('data-vote-id'),
          wrap.getAttribute('data-vote-board') || 'sp',
          voteBtn.getAttribute('data-vote')
        );
        return;
      }
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
      const votesP = fetch('/api/sp_investment/votes', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
        .then((r) => (r && r.ok ? r.json() : null))
        .catch(() => null);
      const r = await fetch(spiApiUrl());
      if (!r.ok) throw new Error('HTTP ' + r.status);
      payload = await r.json();
      if (payload.error) throw new Error(payload.error);
      invalidateUnitBoardIndex();
      _payloadLang = uiLang();
      const votes = await votesP;
      if (votes && typeof votes === 'object') {
        voteTallies = Object.assign(Object.create(null), votes.tallies || {});
        voteMine = Object.assign(Object.create(null), votes.mine || {});
      }
    applyLangStatic();
    applyFilterDom();
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
    ensureDecisionUiChrome();
    applyFilterDom();
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
      tagFilters = [];
      applyLangStatic();
      renderScoringGuide();
      render();
      return;
    }
    tagFilters = [];
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
