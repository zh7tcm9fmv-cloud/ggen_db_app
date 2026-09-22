/**
 * Debuff Matrix — lineage tag rows (like Tag Matrix) × Inflict debuff columns.
 * Left: exclusive rail | supporters | tag. Top: debuff types (not role headers).
 */
(function () {
  'use strict';

  var STORAGE_LANG = 'ggen_lang';
  var cacheByLang = {};
  var rows = [];
  var debuffDefs = [];
  var loadSeq = 0;
  var EAGER_THUMB_BUDGET = 24;
  var API_SV = 13;
  var itemByKey = Object.create(null);
  var hoverPortalEl = null;
  var hoverPortalKey = null;

  var TERRAIN_TYPE_ICONS = {
    Space: '/static/images/Terrain/UI_Common_TerrainIcon_Space.webp',
    Atmospheric: '/static/images/Terrain/UI_Common_TerrainIcon_Sky.webp',
    Ground: '/static/images/Terrain/UI_Common_TerrainIcon_Ground.webp',
    Sea: '/static/images/Terrain/UI_Common_TerrainIcon_Aquatic.webp',
    Underwater: '/static/images/Terrain/UI_Common_TerrainIcon_Underwater.webp'
  };
  var TERRAIN_LEVEL_ICONS = {
    1: '/static/images/Terrain/UI_Common_TerrainIcon_Hyphen.webp',
    2: '/static/images/Terrain/UI_Common_TerrainIcon_Triangle.webp',
    3: '/static/images/Terrain/UI_Common_TerrainIcon_Circle.webp'
  };
  var TERRAIN_ORDER = ['Space', 'Atmospheric', 'Ground', 'Sea', 'Underwater'];

  var RARITY_BASE = {
    UR: '/static/images/UI/UI_Common_Tmb_Square_UR_Base.webp',
    SSR: '/static/images/UI/UI_Common_Tmb_Square_SSR_Base.webp',
    SR: '/static/images/UI/UI_Common_Tmb_Square_SR_Base.webp',
    R: '/static/images/UI/UI_Common_Tmb_Square_R_Base.webp',
    N: '/static/images/UI/UI_Common_Tmb_Square_None_Base.webp'
  };
  var RARITY_FRAME = {
    UR: '/static/images/UI/UI_Common_Tmb_Square_UR_Frame.webp',
    SSR: '/static/images/UI/UI_Common_Tmb_Square_SSR_Frame.webp',
    SR: '/static/images/UI/UI_Common_Tmb_Square_SR_Frame.webp',
    R: '/static/images/UI/UI_Common_Tmb_Square_R_Frame.webp',
    N: '/static/images/UI/UI_Common_Tmb_Square_None_Frame%20%236338.webp'
  };
  var SUPP_TB_FRAME = {
    UR: {
      lr: '/static/images/UI/UI_Common_Tmb_Supporter_UR_Frame_01.webp',
      tb: '/static/images/UI/UI_Common_Tmb_Supporter_UR_Frame_02.webp'
    },
    SSR: {
      lr: '/static/images/UI/UI_Common_Tmb_Supporter_SSR_Frame_01.webp',
      tb: '/static/images/UI/UI_Common_Tmb_Supporter_SSR_Frame_02.webp'
    },
    SR: {
      lr: '/static/images/UI/UI_Common_Tmb_Supporter_SR_Frame_01.webp',
      tb: '/static/images/UI/UI_Common_Tmb_Supporter_SR_Frame_02.webp'
    },
    R: {
      lr: '/static/images/UI/UI_Common_Tmb_Supporter_R_Frame_01.webp',
      tb: '/static/images/UI/UI_Common_Tmb_Supporter_R_Frame_02.webp'
    },
    N: {
      lr: '/static/images/UI/UI_Common_Tmb_Supporter_N_Frame_01.webp',
      tb: '/static/images/UI/UI_Common_Tmb_Supporter_N_Frame_02.webp'
    }
  };
  var TB_SUPP_BASE = '/static/images/UI/UI_Common_Tmb_Supporter_Base.webp';
  var ULT_ICON = '/static/images/UI/UI_Common_Icon_ULT.webp';
  var SKILL_KIND_ICON = {
    hp: '/static/images/Trait/trait_10010401.webp',
    en: '/static/images/Trait/trait_10020501.webp',
    hybrid: '/static/images/Trait/trait_10780401.webp'
  };
  var SKILL_KIND_ORDER = ['hp', 'en', 'hybrid', ''];
  var RARITY_FILTER_ICONS = {
    UR: '/static/images/Rarity/UI_Common_RarityIcon_UR.webp',
    SSR: '/static/images/Rarity/UI_Common_RarityIcon_SSR.webp',
    SR: '/static/images/Rarity/UI_Common_RarityIcon_SR.webp',
    R: '/static/images/Rarity/UI_Common_RarityIcon_R.webp',
    N: '/static/images/Rarity/UI_Common_RarityIcon_N.webp'
  };
  var RARITY_PRESET_ICONS = {
    ALL: ['UR', 'SSR', 'SR', 'R', 'N'],
    UR: ['UR'],
    'SSR+': ['UR', 'SSR'],
    'SSR-': ['SSR', 'SR', 'R', 'N']
  };

  /* Tag rails — same taxonomy as /tm */
  var TAG_GROUP_ORDER = ['four', 'six', 'new', 'other', 'series'];
  /* Debuff chips — Stats → Power Type → Range Type → Special */
  var DEBUFF_GROUP_ORDER = ['stat', 'power', 'range', 'special'];

  /* Fallback order when API debuff_defs is empty */
  var KNOWN_DEBUFF_SPEC = [
    ['stat', 'def_dn'],
    ['stat', 'dmg_beam'],
    ['stat', 'dmg_phys'],
    ['stat', 'dmg_spec'],
    ['stat', 'atk_dn'],
    ['stat', 'mob_dn'],
    ['stat', 'acc_dn'],
    ['power', 'wp_beam'],
    ['power', 'wp_phys'],
    ['power', 'wp_spec'],
    ['range', 'range_beam'],
    ['range', 'range_phys'],
    ['special', 'mp_1'],
    ['special', 'enemy_def_atk']
  ];
  var KNOWN_DEBUFF_KEYS = KNOWN_DEBUFF_SPEC.map(function (p) {
    return p[1];
  });
  /*
    Column header icons — game Trait ResourceIds (CDN Trait/).
    Typed power/range columns use beam/phys/spec icons so columns stay distinct.
  */
  var DEBUFF_TRAIT_ICON = {
    def_dn: '/static/images/Trait/trait_10050200.webp',
    dmg_beam: '/static/images/Trait/trait_10600200.webp',
    dmg_phys: '/static/images/Trait/trait_10640200.webp',
    dmg_spec: '/static/images/Trait/trait_10680200.webp',
    atk_dn: '/static/images/Trait/trait_10030200.webp',
    mob_dn: '/static/images/Trait/trait_10060200.webp',
    acc_dn: '/static/images/Trait/trait_10150200.webp',
    wp_beam: '/static/images/Trait/trait_10600200.webp',
    wp_phys: '/static/images/Trait/trait_10640200.webp',
    wp_spec: '/static/images/Trait/trait_10680200.webp',
    /* Same in-game Range Down ResourceId; small beam/phys badge distinguishes the pair. */
    range_beam: '/static/images/Trait/trait_10280200.webp',
    range_phys: '/static/images/Trait/trait_10280200.webp',
    mp_1: '/static/images/Trait/trait_10120300.webp',
    enemy_def_atk: '/static/images/Trait/trait_10050200.webp'
  };
  var DEBUFF_TRAIT_BADGE = {
    range_beam: '/static/images/Trait/trait_10600200.webp',
    range_phys: '/static/images/Trait/trait_10640200.webp'
  };

  var KNOWN_KEY_GROUP = {};
  KNOWN_DEBUFF_SPEC.forEach(function (p) {
    KNOWN_KEY_GROUP[p[1]] = p[0];
  });

  var DEBUFF_SHORT = {
    def_dn: 'Defense Down',
    dmg_beam: 'Beam Damage Up',
    dmg_phys: 'Physical Damage Up',
    dmg_spec: 'Special Damage Up',
    atk_dn: 'Attack Down',
    mob_dn: 'Mobility Down',
    acc_dn: 'Accuracy Down',
    wp_beam: 'Beam Weapon Power Down',
    wp_phys: 'Physical Weapon Power Down',
    wp_spec: 'Special Weapon Power Down',
    range_beam: 'Beam Weapon Range Down',
    range_phys: 'Physical Weapon Range Down',
    mp_1: 'MP −1',
    enemy_def_atk: 'Reduce Enemy DEF (this attack)'
  };

  /* Extra roman / alias tokens — copy from tag_matrix */
  var TAG_SEARCH_ALIASES = {
    '1081': ['lightning', 'denko', '電光石火'],
    '1082': ['one-shot', 'oneshot', 'hissatsu', '一擊必殺', '一撃必殺'],
    '1083': ['tough', 'kenrou', '堅牢'],
    '1084': ['unstoppable', 'toppa', '突破力'],
    '1007': ['specialized', 'senyou', '專用機', '専用機'],
    '1010': ['test type', 'prototype', 'shisaku', '試作機'],
    '1067': ['large', 'oogata', '大型機'],
    '1091': ['ace', '王牌', 'エース'],
    '1092': ['commander', 'shiki', '指揮官'],
    '1094': ['newtype', 'newtype machine', '新人類'],
    '1132': ['shippu', 'shippujinrai', 'gale', '疾風迅雷', '疾風'],
    '1133': ['tenacious', 'fukutsu', '不屈', '不撓不屈', '不屈不撓'],
    '1011': ['psycommu', 'brainwave', '腦波', 'サイコミュ'],
    '1006': ['rival', '勁敵', 'ライバル'],
    '1004': ['monoeye', 'mono-eye', '單眼', 'モノアイ']
  };

  var state = {
    lang: 'EN',
    tagGroups: { four: 1, six: 1, new: 1, other: 1 },
    debuffGroups: {
      stat: 1,
      power: 1,
      range: 0,
      special: 0
    },
    role: 'ALL',
    rarity: 'UR',
    search: ''
  };

  var I18N = {
    EN: {
      navChar: 'Characters',
      navUnit: 'Units',
      navSupp: 'Supporters',
      navRanking: 'Ranking',
      navMod: 'Modifications',
      navStage: 'Stages',
      navMasterLeague: 'Master League',
      navCalc: 'Damage Simulator',
      navTb: 'Team Builder',
      navLatest: 'Latest Release',
      navBanner: 'Unit Assembly',
      navInvestment: 'Investment Priority',
      navCollections: 'Collections',
      navGameNews: 'Game News',
      navTagMatrix: 'Tag Matrix',
      navDebuffMatrix: 'Debuff Matrix',
      navSection: 'Section',
      eyebrow: 'Impairing Type · live',
      title: 'Debuff Matrix',
      sub: 'Supporters + lineage tags on the left; units by Inflict weapon effect. Default columns: Stats + Power Type (toggle Range Type / Special when needed).',
      note: 'Inside each column: exact max kit % (e.g. 40%, 35%), including recommend-pilot PEP when present.',
      tagGroup: 'Tag group',
      debuffGroup: 'Debuff type',
      role: 'Type',
      rarity: 'Rarity',
      all: 'All',
      four: 'Four',
      six: 'Six',
      new: 'New',
      other: 'Other',
      series: 'Other - Series',
      stat: 'Stats',
      power: 'Power Type',
      range: 'Range Type',
      special: 'Special',
      headSupp: 'Supporters',
      headTag: 'Tag',
      searchPh: 'Find tag...',
      loading: 'Loading…',
      err: 'Failed to load',
      empty: '—',
      noMatch: 'No matching tags / debuffers',
      status: '{n} tags · {u} debuffers',
      foot: '/dm · /api/debuff_matrix',
      rotateHint: 'Rotate to landscape for a better viewing',
      exclusiveLabel: 'Exclusive',
      kindHp: 'HP Repair',
      kindEn: 'EN Charge',
      kindHybrid: 'HP & EN Restoration',
      kindOther: 'Other',
      limited: 'Limited',
      legStat: 'Stats',
      legPierce: 'Special',
      legPower: 'Power Type'
    },
    JA: {
      navChar: 'キャラクター',
      navUnit: 'ユニット',
      navSupp: 'サポーター',
      navRanking: 'ランキング',
      navMod: 'オプションパーツ',
      navStage: 'ステージ',
      navMasterLeague: 'マスターリーグ',
      navCalc: 'ダメージシミュレーター',
      navTb: 'チーム編成',
      navLatest: '最新登場',
      navBanner: 'ピックアップガシャ',
      navInvestment: '投資優先度',
      navCollections: 'コレクション',
      navGameNews: 'ゲームニュース',
      navTagMatrix: 'タグ対応表',
      navDebuffMatrix: 'マイナス効果対応表',
      navSection: 'セクション',
      eyebrow: '弱体系 · ライブ',
      title: 'マイナス効果対応表',
      sub: '左列はサポーター＋系統タグ。初期表示はステータス＋威力（射程／特殊は切替）。',
      note: '列内は正確な％（例: 40%、35%）。推奨パイロットの武装効果加算を含む。',
      tagGroup: 'タグ分類',
      debuffGroup: 'デバフ種類',
      role: 'タイプ',
      rarity: 'レアリティ',
      all: 'すべて',
      four: '四大',
      six: '六大',
      new: '新',
      other: 'その他',
      series: 'その他 - シリーズ',
      stat: 'ステータス',
      power: '威力',
      range: '射程',
      special: '特殊',
      headSupp: 'サポーター',
      headTag: 'タグ',
      searchPh: 'タグ検索...',
      loading: '読み込み中…',
      err: '読み込み失敗',
      empty: '—',
      noMatch: '該当なし',
      status: '{n} タグ · デバッファー {u}',
      foot: '/dm · /api/debuff_matrix',
      rotateHint: 'Rotate to landscape for a better viewing',
      exclusiveLabel: '互斥',
      kindHp: 'HPリペア',
      kindEn: 'ENチャージ',
      kindHybrid: 'HP&EN回復',
      kindOther: 'その他',
      limited: '期間限定',
      legStat: 'ステータス',
      legPierce: '特殊',
      legPower: '威力'
    },
    TW: {
      navChar: '角色',
      navUnit: '單位',
      navSupp: '支援人員',
      navRanking: '排行',
      navMod: '選擇性零件',
      navStage: '關卡',
      navMasterLeague: '大師聯盟',
      navCalc: '損傷模擬器',
      navTb: '隊伍編成',
      navLatest: '最新登場',
      navBanner: '機體補給',
      navInvestment: '投資優先度',
      navCollections: '收藏',
      navGameNews: '遊戲公告',
      navTagMatrix: '標籤對照表',
      navDebuffMatrix: '負面效果對應表',
      navSection: '區塊',
      eyebrow: '弱化系 · 即時',
      title: '負面效果對應表',
      sub: '左欄為支援卡＋系統標籤。預設欄位：能力＋威力（射程／特殊可切換）。',
      note: '欄內依精確％分組（如 40%、35%），含推薦駕駛員武裝效果加算。',
      tagGroup: '標籤分類',
      debuffGroup: '減益種類',
      role: '類型',
      rarity: '稀有度',
      all: '全部',
      four: '四大',
      six: '六大',
      new: '新',
      other: '其他',
      series: '其他 - 系列',
      stat: '能力',
      power: '威力',
      range: '射程',
      special: '特殊',
      headSupp: '支援人員',
      headTag: '標籤',
      searchPh: '搜尋標籤...',
      loading: '載入中…',
      err: '載入失敗',
      empty: '—',
      noMatch: '無符合項目',
      status: '{n} 標籤 · 減益單位 {u}',
      foot: '/dm · /api/debuff_matrix',
      rotateHint: 'Rotate to landscape for a better viewing',
      exclusiveLabel: '互斥',
      kindHp: 'HP修復',
      kindEn: 'EN填充',
      kindHybrid: 'HP&EN恢復',
      kindOther: '其他',
      limited: '期間限定',
      legStat: '能力',
      legPierce: '特殊',
      legPower: '威力'
    },
    HK: {
      navChar: '角色',
      navUnit: '單位',
      navSupp: '支援人員',
      navRanking: '排行',
      navMod: '選擇性零件',
      navStage: '關卡',
      navMasterLeague: '大師聯盟',
      navCalc: '損傷模擬器',
      navTb: '隊伍編成',
      navLatest: '最新登場',
      navBanner: '機體補給',
      navInvestment: '投資優先度',
      navCollections: '收藏',
      navGameNews: '遊戲公告',
      navTagMatrix: '標籤對照表',
      navDebuffMatrix: '負面效果對應表',
      navSection: '區塊',
      eyebrow: '弱化系 · 即時',
      title: '負面效果對應表',
      sub: '左欄為支援卡＋系統標籤。預設欄位：能力＋威力（射程／特殊可切換）。',
      note: '欄內依精確％分組（如 40%、35%），含推薦駕駛員武裝效果加算。',
      tagGroup: '標籤分類',
      debuffGroup: '減益種類',
      role: '類型',
      rarity: '稀有度',
      all: '全部',
      four: '四大',
      six: '六大',
      new: '新',
      other: '其他',
      series: '其他 - 系列',
      stat: '能力',
      power: '威力',
      range: '射程',
      special: '特殊',
      headSupp: '支援人員',
      headTag: '標籤',
      searchPh: '搜尋標籤...',
      loading: '載入中…',
      err: '載入失敗',
      empty: '—',
      noMatch: '無符合項目',
      status: '{n} 標籤 · 減益單位 {u}',
      foot: '/dm · /api/debuff_matrix',
      rotateHint: 'Rotate to landscape for a better viewing',
      exclusiveLabel: '互斥',
      kindHp: 'HP修復',
      kindEn: 'EN填充',
      kindHybrid: 'HP&EN恢復',
      kindOther: '其他',
      limited: '期間限定',
      legStat: '能力',
      legPierce: '特殊',
      legPower: '威力'
    }
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }
  function t(key) {
    var pack = I18N[state.lang] || I18N.EN;
    return pack[key] != null ? pack[key] : I18N.EN[key] || key;
  }
  function cdnPath(p) {
    if (!p) return '';
    var s = String(p);
    if (/^https?:\/\//i.test(s)) return s;
    var cdn = String(window.__DM_CDN__ || window.__GGEN_IMAGE_CDN__ || '').replace(/\/+$/, '');
    if (!cdn) return s;
    if (s.indexOf('/static/images/') === 0) return cdn + s.replace('/static/images', '/images');
    if (s.indexOf('/images/') === 0) return cdn + s;
    return s;
  }
  function readLang() {
    try {
      var L = (localStorage.getItem(STORAGE_LANG) || 'EN').toUpperCase();
      if (L === 'JP') L = 'JA';
      if (L !== 'EN' && L !== 'JA' && L !== 'TW' && L !== 'HK') L = 'EN';
      return L;
    } catch (_) {
      return 'EN';
    }
  }
  function writeLang(L) {
    try {
      localStorage.setItem(STORAGE_LANG, L);
    } catch (_) {}
  }

  function rarityOk(r) {
    var letter = String((r && r.rarity) || '').toUpperCase();
    if (state.rarity === 'UR') return letter === 'UR';
    if (state.rarity === 'SSR+') return letter === 'UR' || letter === 'SSR';
    if (state.rarity === 'SSR-') {
      return letter === 'SSR' || letter === 'SR' || letter === 'R' || letter === 'N';
    }
    return true;
  }
  function roleOk(card) {
    if (state.role === 'ALL') return true;
    return String((card && card.role) || '') === String(state.role);
  }
  function filterUnits(list) {
    return (list || []).filter(function (u) {
      return rarityOk(u) && roleOk(u);
    });
  }

  function normalizeDebuffGroup(g) {
    g = String(g || '');
    if (g === 'taken') return 'stat';
    if (g === 'other' || g === 'pierce') return 'special';
    return g || 'stat';
  }
  function activeDefs() {
    var defs = debuffDefs && debuffDefs.length ? debuffDefs : null;
    if (!defs) {
      return KNOWN_DEBUFF_SPEC.map(function (p) {
        return { key: p[1], group: p[0], name: DEBUFF_SHORT[p[1]] || p[1], names: {} };
      });
    }
    return defs.map(function (d) {
      return {
        key: d.key,
        group: normalizeDebuffGroup(d.group),
        name: d.name,
        names: d.names || {}
      };
    });
  }
  function visibleDebuffDefs() {
    return activeDefs().filter(function (d) {
      return d && d.key && state.debuffGroups[d.group];
    });
  }
  function debuffKeyGroup(key) {
    for (var i = 0; i < debuffDefs.length; i++) {
      if (debuffDefs[i].key === key) return debuffDefs[i].group;
    }
    return KNOWN_KEY_GROUP[key] || '';
  }
  function shortLabel(key) {
    return DEBUFF_SHORT[key] || String(key || '');
  }
  function fullDebuffName(def) {
    if (!def) return '';
    var names = def.names || {};
    return names[state.lang] || def.name || shortLabel(def.key) || def.key || '';
  }
  /** Visible column tip / aria — prefer locale full name; strip leading EN “Inflict ”. */
  function headerLabel(def) {
    var n = fullDebuffName(def);
    if (!n) return shortLabel(def && def.key);
    if (state.lang === 'EN' && n.indexOf('Inflict ') === 0) n = n.slice(8);
    return n;
  }
  function debuffTraitIcon(key) {
    return DEBUFF_TRAIT_ICON[key] || '';
  }

  /** Normalize API by_debuff cell → band list [{tier,pct,label,units}] (exact %). */
  function normalizeDebuffBands(cell, debuffKey) {
    if (!cell) return [];
    if (Array.isArray(cell)) {
      if (cell.length && cell[0] && Array.isArray(cell[0].units)) {
        return cell;
      }
      /* Legacy flat unit list → group by exact max_pct */
      if (!cell.length) return [];
      if (debuffKey === 'mp_1') return [{ tier: 'all', pct: null, label: '', units: cell }];
      var byPct = {};
      cell.forEach(function (u) {
        var p = intPct(u && (u.max_pct != null ? u.max_pct : (u.debuff_pct || {})[debuffKey]));
        if (!byPct[p]) byPct[p] = [];
        byPct[p].push(u);
      });
      return Object.keys(byPct)
        .map(function (k) {
          return intPct(k);
        })
        .sort(function (a, b) {
          return b - a;
        })
        .map(function (p) {
          return {
            tier: String(p),
            pct: p,
            label: p > 0 ? p + '%' : '',
            units: byPct[p]
          };
        });
    }
    if (Array.isArray(cell.bands)) return cell.bands;
    return [];
  }
  function intPct(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }
  function bandLabel(band) {
    if (!band) return '';
    if (band.label) return band.label;
    var p = intPct(band.pct != null ? band.pct : band.tier);
    if (band.tier === 'all' || band.pct == null && band.tier === 'all') return '';
    if (p > 0) return p + '%';
    return '';
  }
  function bandToneClass(band) {
    var p = intPct(band && (band.pct != null ? band.pct : band.tier));
    if (p >= 35) return 'hi';
    if (p >= 25) return 'mid';
    return 'lo';
  }
  function eachBandUnit(cell, debuffKey, fn) {
    var bands = normalizeDebuffBands(cell, debuffKey);
    for (var i = 0; i < bands.length; i++) {
      var units = bands[i].units || [];
      for (var j = 0; j < units.length; j++) fn(units[j], bands[i]);
    }
  }

  /** Build by_debuff from units[].debuffs when API field is missing. */
  function ensureByDebuff(row) {
    if (row && row.by_debuff && typeof row.by_debuff === 'object') {
      return row.by_debuff;
    }
    var out = {};
    var keys = KNOWN_DEBUFF_KEYS.slice();
    activeDefs().forEach(function (d) {
      if (d.key && keys.indexOf(d.key) < 0) keys.push(d.key);
    });
    keys.forEach(function (k) {
      out[k] = [];
    });
    var seen = {};
    keys.forEach(function (k) {
      seen[k] = {};
    });
    function addCard(card) {
      if (!card) return;
      var cid = String(card.id || '');
      if (!cid) return;
      var list = card.debuffs || [];
      for (var i = 0; i < list.length; i++) {
        var dk = list[i];
        if (!out[dk]) {
          out[dk] = [];
          seen[dk] = {};
        }
        if (seen[dk][cid]) continue;
        seen[dk][cid] = 1;
        out[dk].push(card);
      }
    }
    if (row && row.units) {
      ['1', '2', '3'].forEach(function (r) {
        (row.units[r] || []).forEach(addCard);
      });
    }
    return out;
  }

  function localizedName(row) {
    if (!row) return '';
    var names = row.names || {};
    return names[state.lang] || row.name || row.id || '';
  }

  function rowSearchBlob(row) {
    var parts = [
      String(row.id || ''),
      String(row.raw_id || ''),
      String(row.name || '')
    ];
    var names = row.names || {};
    ['EN', 'JA', 'TW', 'HK'].forEach(function (lc) {
      if (names[lc]) parts.push(String(names[lc]));
    });
    var aliases = TAG_SEARCH_ALIASES[String(row.id)] || [];
    for (var i = 0; i < aliases.length; i++) parts.push(aliases[i]);
    if (row.raw_id) {
      var rawAliases = TAG_SEARCH_ALIASES[String(row.raw_id)] || [];
      for (var j = 0; j < rawAliases.length; j++) parts.push(rawAliases[j]);
    }
    return parts.join(' ').toLowerCase();
  }

  function rowGroupOk(row) {
    var g = String(row.group || 'other');
    if (g === 'series') return !!state.tagGroups.series;
    return !!state.tagGroups[g];
  }

  function rowHasVisibleUnits(row) {
    var by = ensureByDebuff(row);
    var defs = visibleDebuffDefs();
    for (var i = 0; i < defs.length; i++) {
      var found = false;
      eachBandUnit(by[defs[i].key], defs[i].key, function (card) {
        if (!found && rarityOk(card) && roleOk(card)) found = true;
      });
      if (found) return true;
    }
    return false;
  }

  function rowHasSupports(row) {
    return !!(row && row.supports && row.supports.length);
  }

  function rowMatches(row) {
    if (!rowGroupOk(row)) return false;
    var q = String(state.search || '')
      .trim()
      .toLowerCase();
    if (q && rowSearchBlob(row).indexOf(q) < 0) return false;
    /* Keep tag + supporter shell like /tm even when rarity hides every unit cell. */
    return rowHasVisibleUnits(row) || rowHasSupports(row);
  }

  function resolveSkillKind(item) {
    var k = String((item && item.skill_kind) || '')
      .toLowerCase()
      .trim();
    if (k === 'hp' || k === 'en' || k === 'hybrid') return k;
    var ic = String((item && item.active_icon) || '');
    if (/10010401|trait_100104/i.test(ic)) return 'hp';
    if (/10020501|trait_100205/i.test(ic)) return 'en';
    if (/10780401|trait_107804/i.test(ic)) return 'hybrid';
    return '';
  }
  function kindLabel(kind) {
    if (kind === 'hp') return t('kindHp');
    if (kind === 'en') return t('kindEn');
    if (kind === 'hybrid') return t('kindHybrid');
    return t('kindOther');
  }

  var BOARD_THUMB_PX = 38;
  var LIMITED_UR_LABEL_BASE = '/static/images/UI/UI_Gasha_Label_UR_Base.webp';

  /** Official gacha Limited plate — same art/locales as browse + /tm. */
  function limitedBadgeHtml(kind, size) {
    var lbl = t('limited');
    var sz = size || 'tile';
    var kindCls = kind === 'supporter' ? ' dm-lim-badge--supp' : ' dm-lim-badge--unit';
    return (
      '<span class="limited-ur-badge limited-ur-badge--' +
      escAttr(sz) +
      ' dm-lim-badge' +
      kindCls +
      '" role="img" aria-label="' +
      escAttr(lbl) +
      '"><img class="limited-ur-badge-base" src="' +
      escAttr(cdnPath(LIMITED_UR_LABEL_BASE)) +
      '" alt="" loading="lazy" decoding="async" onerror="this.style.display=\'none\'"><span class="limited-ur-badge-text">' +
      esc(lbl) +
      '</span></span>'
    );
  }

  function framedThumbHtml(item, kind, size, opts) {
    opts = opts || {};
    var rarity = String(item.rarity || 'N').toUpperCase();
    if (!RARITY_BASE[rarity]) rarity = 'N';
    var isSupp = kind === 'supporter';
    var sz = size || BOARD_THUMB_PX;
    var eager = !!opts.eager;
    var loadAttr = eager ? 'eager' : 'lazy';
    var prioAttr = eager ? ' fetchpriority="high"' : '';
    var href = isSupp
      ? '/s/' + encodeURIComponent(item.id)
      : '/u/' + encodeURIComponent(item.id);
    var src = cdnPath(item.thum || '');
    var portrait = src
      ? '<img class="dm-ft-portrait" src="' +
        escAttr(src) +
        '" alt="" loading="' +
        loadAttr +
        '" decoding="async"' +
        prioAttr +
        ' width="' +
        sz +
        '" height="' +
        sz +
        '" onerror="this.style.visibility=\'hidden\'">'
      : '';
    var limRibbon =
      item.is_limited_time && opts.showLimBadge ? limitedBadgeHtml(kind) : '';
    var icons = '';
    if (!isSupp && item.is_ultimate) {
      icons +=
        '<span class="dm-ft-ic"><img src="' +
        escAttr(cdnPath(ULT_ICON)) +
        '" alt="" loading="lazy"></span>';
    }
    if (item.acquisition_icon && !opts.skipAcqIcon) {
      icons +=
        '<span class="dm-ft-ic"><img src="' +
        escAttr(cdnPath(item.acquisition_icon)) +
        '" alt="" loading="lazy"></span>';
    }
    var iconsWrap = icons ? '<span class="dm-ft-icons">' + icons + '</span>' : '';
    var hit =
      '<a class="dm-ft-hit" href="' +
      escAttr(href) +
      '" aria-label="' +
      escAttr(item.name || '') +
      '"></a>';

    if (isSupp) {
      var fr = SUPP_TB_FRAME[rarity] || SUPP_TB_FRAME.N;
      return (
        '<span class="dm-ft dm-ft--supp dm-ft--tb' +
        (item.is_limited_time ? ' dm-ft--limited' : '') +
        '" style="width:' +
        sz +
        'px;height:' +
        sz +
        'px">' +
        limRibbon +
        '<img class="dm-ft-base" src="' +
        escAttr(cdnPath(TB_SUPP_BASE)) +
        '" alt="" loading="lazy" decoding="async">' +
        '<span class="dm-ft-port-wrap">' +
        portrait +
        '</span>' +
        '<img class="dm-ft-tb dm-ft-tb--l" src="' +
        escAttr(cdnPath(fr.lr)) +
        '" alt="" loading="lazy">' +
        '<img class="dm-ft-tb dm-ft-tb--r" src="' +
        escAttr(cdnPath(fr.lr)) +
        '" alt="" loading="lazy">' +
        '<img class="dm-ft-tb dm-ft-tb--t" src="' +
        escAttr(cdnPath(fr.tb)) +
        '" alt="" loading="lazy">' +
        '<img class="dm-ft-tb dm-ft-tb--b" src="' +
        escAttr(cdnPath(fr.tb)) +
        '" alt="" loading="lazy">' +
        iconsWrap +
        hit +
        '</span>'
      );
    }

    var base = cdnPath(RARITY_BASE[rarity]);
    var frame = cdnPath(RARITY_FRAME[rarity] || RARITY_FRAME.N);
    return (
      '<span class="dm-ft dm-ft--unit dm-ft--framed' +
      (item.is_limited_time ? ' dm-ft--limited' : '') +
      '" style="width:' +
      sz +
      'px;height:' +
      sz +
      'px">' +
      limRibbon +
      '<img class="dm-ft-base" src="' +
      escAttr(base) +
      '" alt="" loading="lazy" decoding="async">' +
      '<span class="dm-ft-port-wrap">' +
      portrait +
      '</span>' +
      '<img class="dm-ft-frame" src="' +
      escAttr(frame) +
      '" alt="" loading="lazy" decoding="async">' +
      iconsWrap +
      hit +
      '</span>'
    );
  }

  function takeEager(budget) {
    if (!budget || budget.n <= 0) return false;
    budget.n--;
    return true;
  }

  function rebuildItemIndex() {
    itemByKey = Object.create(null);
    rows.forEach(function (row) {
      ['1', '2', '3'].forEach(function (r) {
        ((row.units && row.units[r]) || []).forEach(function (u) {
          if (u && u.id != null) itemByKey['u:' + u.id] = u;
        });
      });
      var by = row.by_debuff || {};
      Object.keys(by).forEach(function (dk) {
        eachBandUnit(by[dk], dk, function (u) {
          if (u && u.id != null) itemByKey['u:' + u.id] = u;
        });
      });
      (row.supports || []).forEach(function (s) {
        if (s && s.id != null) itemByKey['s:' + s.id] = s;
      });
    });
  }

  function terrainRowHtml(item) {
    var list = (item && item.terrain) || [];
    if (!list.length) {
      /* Synthesize from levels map if present */
      return '';
    }
    var parts = [];
    for (var i = 0; i < list.length; i++) {
      var tr = list[i] || {};
      var name = String(tr.name || TERRAIN_ORDER[i] || '');
      var lv = intPct(tr.level);
      if (lv < 1) lv = 1;
      if (lv > 3) lv = 3;
      var typeIc = tr.type_icon || TERRAIN_TYPE_ICONS[name] || '';
      var levelIc = tr.level_icon || TERRAIN_LEVEL_ICONS[lv] || '';
      var dim = lv < 2 ? ' dm-hover-terrain-item--dim' : '';
      parts.push(
        '<span class="dm-hover-terrain-item' +
          dim +
          '" title="' +
          escAttr(name) +
          '">' +
          (typeIc
            ? '<img class="dm-hover-terrain-type" src="' +
              escAttr(cdnPath(typeIc)) +
              '" alt="" loading="lazy">'
            : '') +
          (levelIc
            ? '<img class="dm-hover-terrain-lv" src="' +
              escAttr(cdnPath(levelIc)) +
              '" alt="" loading="lazy">'
            : '') +
          '</span>'
      );
    }
    if (!parts.length) return '';
    return '<div class="dm-hover-terrain" aria-label="Terrain">' + parts.join('') + '</div>';
  }

  function hoverCardInnerHtml(item, kind) {
    /* Limited = Collections plate style, stacked above the thumb (hover is too small to overlay). */
    var limBar = item.is_limited_time
      ? '<div class="bt-limited-topbar dm-hover-lim" aria-hidden="true">' +
        limitedBadgeHtml(kind, 'tile') +
        '</div>'
      : '';
    var thumb = framedThumbHtml(item, kind, 56, { eager: true, skipAcqIcon: true });
    var metaBits = [];
    var skills = '';
    var terrain = '';
    if (kind === 'supporter') {
      var sk = resolveSkillKind(item);
      var kindIc = sk ? SKILL_KIND_ICON[sk] : '';
      var strip = '';
      var showIc = item.active_icon || (kindIc ? cdnPath(kindIc) : '');
      if (showIc) {
        strip +=
          '<span class="dm-hover-skill" title="' +
          escAttr(kindLabel(sk)) +
          '"><img src="' +
          escAttr(cdnPath(showIc)) +
          '" alt=""></span>';
      }
      if (strip) skills = '<div class="dm-hover-skills">' + strip + '</div>';
      var tags = [];
      (item.skill_tag_data || []).forEach(function (skRow) {
        (skRow.tags || []).forEach(function (tg) {
          if (tg && tg.name) tags.push(tg.name);
        });
      });
      if (tags.length) {
        var sep =
          item.skill_tag_data &&
          item.skill_tag_data[0] &&
          item.skill_tag_data[0].separator === 'and'
            ? ' + '
            : ' / ';
        metaBits.push(tags.slice(0, 4).join(sep));
      }
    } else {
      terrain = terrainRowHtml(item);
    }
    return (
      '<div class="dm-hover-thumb' +
      (item.is_limited_time ? ' dm-hover-thumb--lt' : '') +
      '">' +
      limBar +
      thumb +
      '</div>' +
      '<div class="dm-hover-name">' +
      esc(item.name || '') +
      '</div>' +
      skills +
      terrain +
      (metaBits.length
        ? '<div class="dm-hover-meta">' + metaBits.join(' · ') + '</div>'
        : '')
    );
  }

  function isTouchUi() {
    try {
      return window.matchMedia('(hover: none), (pointer: coarse)').matches;
    } catch (_) {
      return 'ontouchstart' in window;
    }
  }

  function ensureHoverPortal() {
    if (hoverPortalEl && hoverPortalEl.isConnected) return hoverPortalEl;
    hoverPortalEl = document.createElement('div');
    hoverPortalEl.className = 'dm-hover-card dm-hover-card--portal';
    hoverPortalEl.setAttribute('role', 'tooltip');
    hoverPortalEl.setAttribute('aria-hidden', 'true');
    hoverPortalEl.hidden = true;
    document.body.appendChild(hoverPortalEl);
    return hoverPortalEl;
  }

  function hideHoverPortal() {
    if (!hoverPortalEl) return;
    hoverPortalEl.classList.remove('dm-hover-card--open');
    hoverPortalEl.hidden = true;
    hoverPortalEl.style.left = '';
    hoverPortalEl.style.top = '';
    hoverPortalKey = null;
    document.querySelectorAll('.dm-hover-placed').forEach(function (tile) {
      tile.classList.remove(
        'dm-hover-below',
        'dm-hover-left',
        'dm-hover-right',
        'dm-hover-placed'
      );
      tile._dmHoverCard = null;
    });
  }

  function clearHoverPlacement(tile) {
    if (!tile) {
      hideHoverPortal();
      return;
    }
    tile.classList.remove(
      'dm-hover-below',
      'dm-hover-left',
      'dm-hover-right',
      'dm-hover-placed'
    );
    tile._dmHoverCard = null;
    if (hoverPortalEl) {
      hoverPortalEl.classList.remove('dm-hover-card--open');
      hoverPortalEl.hidden = true;
    }
    hoverPortalKey = null;
  }

  function hoverChromeTopInset() {
    var bottom = 4;
    var h = document.querySelector('.app-header');
    if (h) bottom = Math.max(bottom, h.getBoundingClientRect().bottom);
    var nav = document.getElementById('navTabsShell');
    if (nav && !nav.hasAttribute('hidden')) {
      bottom = Math.max(bottom, nav.getBoundingClientRect().bottom);
    }
    var tb = document.querySelector('.dm-toolbar');
    if (tb && !document.body.classList.contains('dm-filters-collapsed')) {
      var tbr = tb.getBoundingClientRect();
      if (tbr.height > 2) bottom = Math.max(bottom, tbr.bottom);
    }
    var head = document.querySelector('.dm-sticky-head');
    if (head) {
      var hr = head.getBoundingClientRect();
      if (hr.height > 2) bottom = Math.max(bottom, hr.bottom);
    }
    return Math.ceil(bottom) + 4;
  }

  function placeHoverCard(tile) {
    if (!tile) return;
    var key = tile.getAttribute('data-item-key') || '';
    var item = key ? itemByKey[key] : null;
    if (!item) return;
    var kind = tile.getAttribute('data-kind') === 'supporter' ? 'supporter' : 'unit';
    var card = ensureHoverPortal();
    if (hoverPortalKey !== key) {
      card.innerHTML = hoverCardInnerHtml(item, kind);
      hoverPortalKey = key;
      card.querySelectorAll('img').forEach(function (img) {
        if (img.complete) return;
        img.addEventListener(
          'load',
          function () {
            if (tile.classList.contains('dm-hover-placed') && hoverPortalKey === key) {
              placeHoverCard(tile);
            }
          },
          { once: true }
        );
      });
    }
    document.querySelectorAll('.dm-hover-placed').forEach(function (prev) {
      if (prev !== tile) {
        prev.classList.remove(
          'dm-hover-below',
          'dm-hover-left',
          'dm-hover-right',
          'dm-hover-placed'
        );
        prev._dmHoverCard = null;
      }
    });
    tile._dmHoverCard = card;
    card.hidden = false;
    card.classList.add('dm-hover-card--open');
    var tr = tile.getBoundingClientRect();
    var cw = card.offsetWidth || 150;
    var ch = card.offsetHeight || 120;
    var gap = 6;
    var topMin = hoverChromeTopInset();
    var preferBelow = tr.top < topMin + ch + gap + 8;
    var top = preferBelow ? tr.bottom + gap : tr.top - ch - gap;
    var left = tr.left + tr.width / 2 - cw / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - cw - 4));
    top = Math.max(topMin, Math.min(top, window.innerHeight - ch - 4));
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
    if (preferBelow) tile.classList.add('dm-hover-below');
    else tile.classList.remove('dm-hover-below');
    tile.classList.add('dm-hover-placed');
  }

  function bindBoardInteractions(board) {
    if (!board) return;
    var wrap = document.querySelector('.dm-board-wrap');
    if (!board._dmHoverBound) {
      board._dmHoverBound = 1;
      board.addEventListener(
        'pointerenter',
        function (ev) {
          if (isTouchUi()) return;
          var tile = ev.target.closest('.dm-tile');
          if (!tile || !board.contains(tile)) return;
          placeHoverCard(tile);
        },
        true
      );
      board.addEventListener(
        'pointerleave',
        function (ev) {
          if (isTouchUi()) return;
          var tile = ev.target.closest('.dm-tile');
          if (!tile || !board.contains(tile)) return;
          var to = ev.relatedTarget;
          if (to && (tile.contains(to) || (hoverPortalEl && hoverPortalEl.contains(to)))) return;
          clearHoverPlacement(tile);
        },
        true
      );
      /* Touch: first tap shows hover card; second tap on same tile follows /u or /s. */
      board.addEventListener(
        'click',
        function (ev) {
          if (!isTouchUi()) return;
          var tile = ev.target.closest('.dm-tile');
          if (!tile || !board.contains(tile)) return;
          var key = tile.getAttribute('data-item-key') || '';
          if (
            key &&
            hoverPortalKey === key &&
            hoverPortalEl &&
            !hoverPortalEl.hidden
          ) {
            return;
          }
          ev.preventDefault();
          placeHoverCard(tile);
        },
        true
      );
      if (wrap && !wrap._dmScrollHover) {
        wrap._dmScrollHover = 1;
        wrap.addEventListener(
          'scroll',
          function () {
            hideHoverPortal();
          },
          { passive: true }
        );
      }
      if (!window._dmHoverResize) {
        window._dmHoverResize = 1;
        window.addEventListener(
          'resize',
          function () {
            hideHoverPortal();
            syncRotateHint();
          },
          { passive: true }
        );
        window.addEventListener(
          'orientationchange',
          function () {
            hideHoverPortal();
            syncRotateHint();
          },
          { passive: true }
        );
      }
      if (!window._dmTouchDismissHover) {
        window._dmTouchDismissHover = 1;
        document.addEventListener(
          'pointerdown',
          function (ev) {
            if (!isTouchUi()) return;
            if (!hoverPortalEl || hoverPortalEl.hidden) return;
            var t = ev.target;
            if (t.closest && t.closest('.dm-tile')) return;
            if (hoverPortalEl.contains(t)) return;
            hideHoverPortal();
          },
          true
        );
      }
    }
  }

  function unitTileHtml(item, eagerBudget) {
    var id = String(item.id || '');
    return (
      '<span class="dm-tile" data-kind="unit" data-id="' +
      escAttr(id) +
      '" data-item-key="u:' +
      escAttr(id) +
      '">' +
      framedThumbHtml(item, 'unit', BOARD_THUMB_PX, { eager: takeEager(eagerBudget) }) +
      '</span>'
    );
  }

  function suppCellHtml(item, eager) {
    var kind = resolveSkillKind(item);
    var kindIc = kind && SKILL_KIND_ICON[kind] ? SKILL_KIND_ICON[kind] : '';
    var badge = kindIc
      ? '<img class="dm-supp-kind-badge" src="' +
        escAttr(cdnPath(kindIc)) +
        '" alt="' +
        escAttr(kindLabel(kind)) +
        '" title="' +
        escAttr(kindLabel(kind)) +
        '">'
      : '';
    var sid = String(item.id || '');
    return (
      '<span class="dm-tile dm-tile--supp" data-kind="supporter" data-skill-kind="' +
      escAttr(kind) +
      '" data-id="' +
      escAttr(sid) +
      '" data-item-key="s:' +
      escAttr(sid) +
      '">' +
      '<span class="dm-supp-stack">' +
      framedThumbHtml(item, 'supporter', BOARD_THUMB_PX, { eager: !!eager }) +
      badge +
      '</span>' +
      '</span>'
    );
  }

  function supportsCellHtml(list, eagerBudget) {
    /* Rarity filter is for units only — keep SR/R supports visible. */
    var items = (list || []).slice().sort(function (a, b) {
      var ka = SKILL_KIND_ORDER.indexOf(resolveSkillKind(a));
      var kb = SKILL_KIND_ORDER.indexOf(resolveSkillKind(b));
      if (ka < 0) ka = 99;
      if (kb < 0) kb = 99;
      if (ka !== kb) return ka - kb;
      return (a.rarity_sort | 0) - (b.rarity_sort | 0);
    });
    if (!items.length) {
      return '<div class="dm-supp dm-supp--empty" role="cell"></div>';
    }
    return (
      '<div class="dm-supp" role="cell"><div class="dm-chip-strip dm-chip-strip--supp">' +
      items
        .map(function (it) {
          return suppCellHtml(it, takeEager(eagerBudget));
        })
        .join('') +
      '</div></div>'
    );
  }

  function debuffUnitsHtml(cell, eagerBudget, debuffKey) {
    var bands = normalizeDebuffBands(cell, debuffKey);
    var parts = [];
    for (var i = 0; i < bands.length; i++) {
      var band = bands[i];
      var items = filterUnits(band.units || []);
      if (!items.length) continue;
      var lab = bandLabel(band);
      var tone = bandToneClass(band);
      var head =
        lab && band.tier !== 'all'
          ? '<div class="dm-pct-band-lab dm-pct-band-lab--' +
            escAttr(tone) +
            '">' +
            esc(lab) +
            '</div>'
          : '';
      parts.push(
        '<div class="dm-pct-band dm-pct-band--' +
          escAttr(tone) +
          '" data-pct="' +
          escAttr(band.pct != null ? band.pct : '') +
          '">' +
          head +
          '<div class="dm-chip-strip">' +
          items
            .map(function (u) {
              return unitTileHtml(u, eagerBudget);
            })
            .join('') +
          '</div></div>'
      );
    }
    if (!parts.length) {
      return '<span class="dm-empty">' + esc(t('empty')) + '</span>';
    }
    return '<div class="dm-pct-bands">' + parts.join('') + '</div>';
  }

  function buildHeadHtml(visibleDefs) {
    var html = '';
    /* Group band */
    html += '<div class="dm-head-groups" role="row">';
    html += '<div class="dm-head-rail" role="presentation"></div>';
    html += '<div class="dm-head-supp dm-head-supp--pad" role="presentation"></div>';
    html += '<div class="dm-head-tag dm-head-tag--pad" role="presentation"></div>';
    var i = 0;
    while (i < visibleDefs.length) {
      var g = String(visibleDefs[i].group || 'stat');
      var span = 1;
      while (i + span < visibleDefs.length && String(visibleDefs[i + span].group) === g) {
        span++;
      }
      html +=
        '<div class="dm-head-group dm-head-group--' +
        escAttr(g) +
        '" role="columnheader" style="grid-column:span ' +
        span +
        '"><span class="dm-head-group-label">' +
        esc(t(g) || g) +
        '</span></div>';
      i += span;
    }
    html += '</div>';
    /* Debuff name row */
    html += '<div class="dm-head-keys" role="row">';
    html += '<div class="dm-head-rail" role="columnheader"></div>';
    html +=
      '<div class="dm-head-supp" role="columnheader">' + esc(t('headSupp')) + '</div>';
    html += '<div class="dm-head-tag" role="columnheader">' + esc(t('headTag')) + '</div>';
    for (i = 0; i < visibleDefs.length; i++) {
      var d = visibleDefs[i];
      var label = headerLabel(d);
      var icon = debuffTraitIcon(d.key);
      html +=
        '<button type="button" class="dm-head-debuff dm-head-debuff--' +
        escAttr(d.group || 'other') +
        '" role="columnheader" data-debuff-key="' +
        escAttr(d.key) +
        '" aria-label="' +
        escAttr(label) +
        '" aria-expanded="false" title="' +
        escAttr(label) +
        '">';
      if (icon) {
        html += '<span class="dm-head-debuff-icon-wrap" aria-hidden="true">';
        html +=
          '<img class="dm-head-debuff-icon" src="' +
          escAttr(cdnPath(icon)) +
          '" alt="" width="28" height="28" decoding="async" loading="lazy">';
        var badge = DEBUFF_TRAIT_BADGE[d.key];
        if (badge) {
          html +=
            '<img class="dm-head-debuff-badge" src="' +
            escAttr(cdnPath(badge)) +
            '" alt="" width="14" height="14" decoding="async" loading="lazy">';
        }
        html += '</span>';
      }
      html +=
        '<span class="dm-head-debuff-tip" role="tooltip">' +
        esc(label) +
        '</span>';
      if (!icon) {
        html += '<span class="dm-head-debuff-fallback">' + esc(label) + '</span>';
      }
      html += '</button>';
    }
    html += '</div>';
    return html;
  }

  function syncBoardColumnWidths(visibleDefs, visibleRows) {
    var page = document.body;
    if (!page) return;
    var n = Math.max(1, (visibleDefs && visibleDefs.length) || 1);
    /* Equal-share tracks — never force a min width that creates horizontal scroll. */
    var debuffTracks = [];
    for (var i = 0; i < n; i++) debuffTracks.push('minmax(0,1fr)');
    var debuffPart = debuffTracks.join(' ');
    page.style.setProperty(
      '--dm-cols',
      'var(--dm-rail-w) var(--dm-w-supp) var(--dm-w-tag) ' + debuffPart
    );
    page.style.setProperty(
      '--dm-cols-body',
      'var(--dm-w-supp) var(--dm-w-tag) ' + debuffPart
    );

    var maxSupp = 0;
    for (var r = 0; r < (visibleRows || []).length; r++) {
      maxSupp = Math.max(maxSupp, ((visibleRows[r].supports || []).length));
    }
    /* Compact left columns so debuff names keep room inside the viewport. */
    var suppSlot = 40;
    var suppW = Math.min(120, Math.max(72, (Math.min(maxSupp, 2) || 1) * suppSlot + 8));
    page.style.setProperty('--dm-w-supp', suppW + 'px');
    page.style.setProperty('--dm-w-tag', state.lang === 'EN' ? '72px' : '80px');
    page.style.setProperty('--dm-debuff-n', String(n));
    page.style.setProperty('--dm-debuff-min', '0px');
  }

  function renderBoard() {
    var board = document.getElementById('dmBoard');
    var head = document.getElementById('dmStickyHead');
    if (!board) return;
    board.className = 'dm-board';
    if (state.role !== 'ALL') board.classList.add('dm-role-filter-' + state.role);

    var visibleDefs = visibleDebuffDefs();
    var visible = [];
    rows.forEach(function (row) {
      if (!rowMatches(row)) return;
      visible.push(row);
    });
    syncBoardColumnWidths(visibleDefs, visible);
    if (head) head.innerHTML = buildHeadHtml(visibleDefs);

    var eagerBudget = { n: EAGER_THUMB_BUDGET };
    var excl = t('exclusiveLabel');

    function renderRowInner(row, alt) {
      var by = ensureByDebuff(row);
      var h =
        '<div class="dm-row dm-row--no-rail' +
        (alt ? ' dm-row--alt' : '') +
        '" role="row" data-group="' +
        escAttr(row.group) +
        '" data-tag-id="' +
        escAttr(row.id) +
        '">';
      h += supportsCellHtml(row.supports, eagerBudget);
      h +=
        '<div class="dm-tag-cell" role="cell"><span class="dm-tag-name" title="' +
        escAttr(localizedName(row)) +
        '">' +
        esc(localizedName(row)) +
        '</span></div>';
      for (var i = 0; i < visibleDefs.length; i++) {
        var d = visibleDefs[i];
        h +=
          '<div class="dm-units dm-units--debuff dm-units--' +
          escAttr(d.group || 'other') +
          '" role="cell" data-debuff-key="' +
          escAttr(d.key) +
          '">' +
          debuffUnitsHtml(by[d.key], eagerBudget, d.key) +
          '</div>';
      }
      h += '</div>';
      return h;
    }

    var html = '';
    var rowIx = 0;
    var i = 0;
    while (i < visible.length) {
      var g = String(visible[i].group || 'other');
      var block = [visible[i]];
      /* Merge consecutive exclusive-group tags into one shared Exclusive rail */
      if (g === 'four' || g === 'six' || g === 'new') {
        while (i + 1 < visible.length && String(visible[i + 1].group) === g) {
          i++;
          block.push(visible[i]);
        }
      }
      var labelRaw = g === 'other' || g === 'series' ? '·' : excl;
      var title = g === 'other' || g === 'series' ? '' : escAttr(excl);
      var labelHtml = Array.from(String(labelRaw))
        .map(function (ch) {
          return '<span class="dm-rail-group-ch">' + esc(ch) + '</span>';
        })
        .join('');
      html +=
        '<div class="dm-rail-group dm-rail-group--' +
        escAttr(g) +
        '" data-group="' +
        escAttr(g) +
        '" data-count="' +
        block.length +
        '">';
      html +=
        '<div class="dm-rail-group-bar" title="' +
        title +
        '" role="presentation">' +
        labelHtml +
        '</div>';
      html += '<div class="dm-rail-group-rows">';
      for (var b = 0; b < block.length; b++) {
        html += renderRowInner(block[b], rowIx % 2 === 1);
        rowIx++;
      }
      html += '</div></div>';
      i++;
    }

    if (!visible.length) {
      html +=
        '<div class="dm-empty-board" role="status">' + esc(t('noMatch')) + '</div>';
    }
    board.innerHTML = html;
    rebuildItemIndex();
    bindBoardInteractions(board);
    hideHoverPortal();
    syncStatusBar(visible, visibleDefs);
    fitRails();
  }

  function fitRails() {
    requestAnimationFrame(function () {
      document.querySelectorAll('.dm-rail-group-bar').forEach(function (bar) {
        var chars = bar.querySelectorAll('.dm-rail-group-ch');
        var n = chars.length;
        if (!n) return;
        var h = bar.clientHeight;
        if (h < 8) return;
        var avail = Math.max(0, h - 4);
        var maxFs = n <= 2 ? 14 : n >= 9 ? 11 : 12;
        var fs = Math.max(6, Math.min(maxFs, Math.floor(avail / n)));
        bar.style.fontSize = fs + 'px';
        bar.style.justifyContent = 'center';
        bar.style.gap = n > 1 ? '1px' : '0';
      });
    });
  }

  function syncStatusBar(visible, visibleDefs) {
    var st = document.getElementById('dmStatus');
    if (!st) return;
    var seen = Object.create(null);
    var u = 0;
    (visible || []).forEach(function (row) {
      var by = ensureByDebuff(row);
      (visibleDefs || []).forEach(function (d) {
        eachBandUnit(by[d.key], d.key, function (card) {
          if (!rarityOk(card) || !roleOk(card)) return;
          var id = String(card.id || '');
          if (!id || seen[id]) return;
          seen[id] = 1;
          u++;
        });
      });
    });
    st.textContent = t('status')
      .replace('{n}', String((visible || []).length))
      .replace('{u}', String(u));
  }

  function applyNavTabLabels() {
    var map = {
      '/c': 'navChar',
      '/u': 'navUnit',
      '/s': 'navSupp',
      '/rk': 'navRanking',
      '/op': 'navMod',
      '/st': 'navStage',
      '/ml': 'navMasterLeague',
      '/cal': 'navCalc',
      '/tb': 'navTb',
      '/new': 'navLatest',
      '/tl': 'navBanner',
      '/ip': 'navInvestment',
      '/collections': 'navCollections',
      '/game-news': 'navGameNews',
      '/tm': 'navTagMatrix',
      '/dm': 'navDebuffMatrix'
    };
    document.querySelectorAll('#navTabs .nav-tab').forEach(function (a) {
      var path = String(a.getAttribute('href') || '').split('?')[0].replace(/\/+$/, '');
      var key = map[path];
      if (!key) return;
      var lab = a.querySelector('.nav-tab-label');
      if (lab) lab.textContent = t(key);
    });
    var tabs = document.getElementById('navTabs');
    if (tabs) tabs.setAttribute('aria-label', t('navSection'));
  }

  function applyStaticI18n() {
    var map = {
      dmEyebrow: 'eyebrow',
      dmTitle: 'title',
      dmSub: 'sub',
      dmNote: 'note',
      dmTagGroupLbl: 'tagGroup',
      dmDebuffGroupLbl: 'debuffGroup',
      dmRoleLbl: 'role',
      dmRarityLbl: 'rarity',
      dmRoleAll: 'all',
      dmChipFour: 'four',
      dmChipSix: 'six',
      dmChipNew: 'new',
      dmChipOther: 'other',
      dmChipSeries: 'series',
      dmChipStat: 'stat',
      dmChipPower: 'power',
      dmChipRange: 'range',
      dmChipSpecial: 'special',
      dmRotateCopy: 'rotateHint',
      dmFoot: 'foot',
      dmLegStat: 'legStat',
      dmLegPierce: 'legPierce',
      dmLegPower: 'legPower'
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = t(map[id]);
    });
    applyNavTabLabels();
    var search = document.getElementById('dmSearch');
    if (search) {
      search.placeholder = t('searchPh');
      search.setAttribute('aria-label', t('searchPh'));
      search.setAttribute('title', t('searchPh'));
    }
    var lab = document.getElementById('dmLangLabel');
    if (lab) lab.textContent = state.lang;
    document.documentElement.setAttribute('data-ui-lang', state.lang);
    document.documentElement.lang =
      state.lang === 'JA' ? 'ja' : state.lang === 'TW' || state.lang === 'HK' ? 'zh-Hant' : 'en';
    try {
      document.title = t('navDebuffMatrix') + ' — GGen Eternal Database';
    } catch (_) {}
  }

  function paintRarityIcons() {
    document.querySelectorAll('.dm-rarity-btn-icons').forEach(function (wrap) {
      var key = wrap.getAttribute('data-icons') || 'ALL';
      var ids = RARITY_PRESET_ICONS[key] || RARITY_PRESET_ICONS.ALL;
      wrap.innerHTML = ids
        .map(function (r) {
          return (
            '<img class="filter-inline-icon rarity-filter-chip" src="' +
            escAttr(cdnPath(RARITY_FILTER_ICONS[r])) +
            '" alt="' +
            escAttr(r) +
            '" width="16" height="16" loading="lazy" decoding="async">'
          );
        })
        .join('');
    });
  }

  function syncChipUi() {
    document.querySelectorAll('#dmTagGroupTabs .dm-chip').forEach(function (btn) {
      var g = btn.getAttribute('data-tag-group');
      var on = !!state.tagGroups[g];
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('#dmDebuffGroupTabs .dm-chip').forEach(function (btn) {
      var g = btn.getAttribute('data-debuff-group');
      var on = !!state.debuffGroups[g];
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    document.querySelectorAll('#dmRoleTabs [data-role]').forEach(function (btn) {
      var on = String(btn.getAttribute('data-role')) === String(state.role);
      btn.classList.toggle('is-active', on);
      if (btn.getAttribute('role') === 'tab') btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('#dmRarityTabs [data-rarity]').forEach(function (btn) {
      var on = String(btn.getAttribute('data-rarity')) === String(state.rarity);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  async function loadMatrix() {
    var seq = ++loadSeq;
    var st = document.getElementById('dmStatus');
    if (st) st.textContent = t('loading');
    var lang = state.lang;
    if (cacheByLang[lang]) {
      rows = cacheByLang[lang].rows || [];
      debuffDefs = cacheByLang[lang].debuff_defs || [];
      if (seq === loadSeq) renderBoard();
      return;
    }
    try {
      var res = await fetch(
        '/api/debuff_matrix?lang=' + encodeURIComponent(lang) + '&sv=' + API_SV,
        {
          credentials: 'same-origin',
          cache: 'default'
        }
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (seq !== loadSeq) return;
      rows = Array.isArray(data.rows) ? data.rows : [];
      debuffDefs = Array.isArray(data.debuff_defs) ? data.debuff_defs : [];
      if (!debuffDefs.length) {
        try {
          console.warn('[dm] debuff_defs empty — using known keys');
        } catch (_) {}
      }
      cacheByLang[lang] = { rows: rows, debuff_defs: debuffDefs, v: data.v || API_SV };
      renderBoard();
    } catch (err) {
      if (seq !== loadSeq) return;
      if (st) st.textContent = t('err');
      try {
        console.error('[dm]', err);
      } catch (_) {}
    }
  }

  function bindFilters() {
    var tagTabs = document.getElementById('dmTagGroupTabs');
    if (tagTabs) {
      tagTabs.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('[data-tag-group]') : null;
        if (!btn || !tagTabs.contains(btn)) return;
        var g = btn.getAttribute('data-tag-group');
        if (!g) return;
        state.tagGroups[g] = state.tagGroups[g] ? 0 : 1;
        var any = TAG_GROUP_ORDER.some(function (k) {
          return state.tagGroups[k];
        });
        if (!any) state.tagGroups[g] = 1;
        syncChipUi();
        renderBoard();
      });
    }
    var debTabs = document.getElementById('dmDebuffGroupTabs');
    if (debTabs) {
      debTabs.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('[data-debuff-group]') : null;
        if (!btn || !debTabs.contains(btn)) return;
        var g = btn.getAttribute('data-debuff-group');
        if (!g) return;
        state.debuffGroups[g] = state.debuffGroups[g] ? 0 : 1;
        var any = DEBUFF_GROUP_ORDER.some(function (k) {
          return state.debuffGroups[k];
        });
        if (!any) state.debuffGroups[g] = 1;
        syncChipUi();
        renderBoard();
      });
    }
    var roles = document.getElementById('dmRoleTabs');
    if (roles) {
      roles.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('[data-role]') : null;
        if (!btn || !roles.contains(btn)) return;
        state.role = btn.getAttribute('data-role') || 'ALL';
        syncChipUi();
        renderBoard();
      });
    }
    var rarity = document.getElementById('dmRarityTabs');
    if (rarity) {
      rarity.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('[data-rarity]') : null;
        if (!btn || !rarity.contains(btn)) return;
        state.rarity = btn.getAttribute('data-rarity') || 'UR';
        syncChipUi();
        renderBoard();
      });
    }
    var search = document.getElementById('dmSearch');
    var searchTimer = null;
    if (search) {
      search.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          state.search = search.value || '';
          renderBoard();
        }, 120);
      });
    }
  }

  function bindLang() {
    var btn = document.getElementById('dmLangBtn');
    var drop = document.getElementById('dmLangDropdown');
    if (!btn || !drop || btn._dmLangBound) return;
    btn._dmLangBound = 1;
    function close() {
      drop.classList.remove('active');
      drop.hidden = true;
      drop.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('dm-lang-open');
    }
    function open() {
      drop.classList.add('active');
      drop.hidden = false;
      drop.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('dm-lang-open');
    }
    function setLang(L) {
      L = String(L || 'EN').toUpperCase();
      if (L === 'JP') L = 'JA';
      if (L !== 'EN' && L !== 'JA' && L !== 'TW' && L !== 'HK') L = 'EN';
      state.lang = L;
      writeLang(L);
      close();
      hideHoverPortal();
      applyStaticI18n();
      try {
        if (typeof window.__ggenInjectBrandFonts === 'function') {
          window.__ggenInjectBrandFonts();
        }
      } catch (_) {}
      loadMatrix();
    }
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (drop.classList.contains('active')) close();
      else open();
    });
    drop.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var opt = ev.target && ev.target.closest ? ev.target.closest('[data-lang]') : null;
      if (!opt) return;
      setLang(opt.getAttribute('data-lang'));
    });
    document.addEventListener('click', function (ev) {
      if (!drop.classList.contains('active')) return;
      if (ev.target && ev.target.closest && ev.target.closest('.lang-selector')) return;
      close();
    });
  }

  function syncRotateHint() {
    var hint = document.getElementById('dmRotateHint');
    if (!hint) return;
    var narrow = false;
    try {
      narrow = window.matchMedia('(orientation: portrait) and (max-width: 720px)').matches;
    } catch (_) {}
    hint.hidden = !narrow;
    hint.setAttribute('aria-hidden', narrow ? 'false' : 'true');
  }

  /*
    Forward wheel/touch from chrome (toolbar, intro, brand header, margins)
    onto .dm-board-wrap. Board itself uses native scroll — do not intercept.
  */
  function bindBoardVerticalScroll() {
    var wrap = document.querySelector('.dm-board-wrap');
    var main = document.querySelector('.dm-main');
    if (!wrap || wrap._dmVertScroll) return;
    wrap._dmVertScroll = 1;

    function maxScroll() {
      return Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    }

    /* 1:1 apply — no artificial momentum (that felt like tiny incremental steps). */
    function applyDy(dy) {
      if (!dy) return false;
      var max = maxScroll();
      if (max <= 2) return false;
      wrap.scrollTop = Math.max(0, Math.min(max, wrap.scrollTop + dy));
      return true;
    }

    function isNavStrip(el) {
      return !!(
        el &&
        el.closest &&
        el.closest('#navTabs, .nav-tabs, .nav-tabs-shell, .nav-tabs-edge-hint')
      );
    }

    function isEditable(el) {
      return !!(
        el &&
        el.closest &&
        el.closest('input, textarea, select, [contenteditable="true"], .lang-dropdown')
      );
    }

    function onBoard(el) {
      return !!(el && el.closest && el.closest('.dm-board-wrap'));
    }

    function shouldForwardVerticalWheel(ev) {
      if (!document.body.classList.contains('dm-page')) return false;
      if (isEditable(ev.target)) return false;
      if (isNavStrip(ev.target)) return false;
      /* Already over the board scroller → leave native scrolling alone */
      if (onBoard(ev.target)) return false;
      var dy = ev.deltaY;
      var dx = ev.deltaX;
      if (!dy && !dx) return false;
      if (Math.abs(dx) > Math.abs(dy) * 1.15) return false;
      return !!dy;
    }

    document.addEventListener(
      'wheel',
      function (ev) {
        if (!shouldForwardVerticalWheel(ev)) return;
        if (!applyDy(ev.deltaY)) return;
        ev.preventDefault();
      },
      { passive: false, capture: true }
    );

    var touch = null;
    function touchOnBoard(el) {
      return onBoard(el);
    }
    function touchBlocked(el) {
      if (!el || !el.closest) return true;
      if (isNavStrip(el)) return true;
      if (isEditable(el)) return true;
      if (el.closest('button, a, .dm-chip, .dm-role-btn, .dm-rarity-btn')) return true;
      if (el.closest('.app-header .header-controls, .header-15-slot')) return true;
      return false;
    }

    document.addEventListener(
      'touchstart',
      function (ev) {
        if (!document.body.classList.contains('dm-page')) return;
        if (ev.touches.length !== 1) {
          touch = null;
          return;
        }
        var tEl = ev.target;
        if (touchOnBoard(tEl) || touchBlocked(tEl)) {
          touch = null;
          return;
        }
        if (maxScroll() <= 2) {
          touch = null;
          return;
        }
        var t = ev.touches[0];
        touch = { y: t.clientY, top: wrap.scrollTop };
      },
      { passive: true, capture: true }
    );

    document.addEventListener(
      'touchmove',
      function (ev) {
        if (!touch || ev.touches.length !== 1) return;
        var t = ev.touches[0];
        var dy = touch.y - t.clientY;
        if (Math.abs(dy) < 2) return;
        var max = maxScroll();
        wrap.scrollTop = Math.max(0, Math.min(max, touch.top + dy));
        ev.preventDefault();
      },
      { passive: false, capture: true }
    );

    document.addEventListener(
      'touchend',
      function () {
        touch = null;
      },
      { passive: true, capture: true }
    );
    document.addEventListener(
      'touchcancel',
      function () {
        touch = null;
      },
      { passive: true, capture: true }
    );

    if (main) {
      main.style.touchAction = 'pan-y';
    }
  }

  /*
    Auto-hide Debuff Matrix chrome (nav tabs + filters) while scrolling the board.
    Brand header stays. Reveal only near top or after a strong upward swipe.
    Same behaviour as Tag Matrix /tm.
  */
  function setFiltersCollapsed(collapsed) {
    document.body.classList.toggle('dm-filters-collapsed', !!collapsed);
  }

  function filtersHaveFocus() {
    var toolbar = document.querySelector('.dm-toolbar');
    if (!toolbar) return false;
    var ae = document.activeElement;
    return !!(ae && toolbar.contains(ae));
  }

  function bindFiltersAutoHide() {
    var wrap = document.querySelector('.dm-board-wrap');
    if (!wrap || wrap._dmFiltersAutoHide) return;
    wrap._dmFiltersAutoHide = 1;

    var lastY = wrap.scrollTop || 0;
    var upAccum = 0;
    var ignoreUntil = 0;
    var HIDE_AFTER = 48;
    var REVEAL_UP = 120;
    var TOP_SHOW = 12;

    function boardCanScroll() {
      return wrap.scrollHeight > wrap.clientHeight + 24;
    }

    function setCollapsed(collapsed) {
      var want = !!collapsed;
      if (document.body.classList.contains('dm-filters-collapsed') === want) return;
      setFiltersCollapsed(want);
      ignoreUntil = Date.now() + 320;
    }

    function onScroll() {
      var y = wrap.scrollTop || 0;
      var canScroll = boardCanScroll();
      if (y <= TOP_SHOW) {
        upAccum = 0;
        lastY = y;
        if (canScroll) setCollapsed(false);
        return;
      }
      if (Date.now() < ignoreUntil) {
        lastY = y;
        return;
      }
      var dy = y - lastY;
      lastY = y;

      if (filtersHaveFocus()) {
        upAccum = 0;
        setCollapsed(false);
        return;
      }

      if (dy > 0) {
        upAccum = 0;
        if (dy >= HIDE_AFTER || y > TOP_SHOW + 24) {
          setCollapsed(true);
        }
        return;
      }
      if (dy < 0) {
        upAccum += -dy;
        if (upAccum >= REVEAL_UP) {
          upAccum = 0;
          if (canScroll) setCollapsed(false);
        }
      }
    }

    wrap.addEventListener('scroll', onScroll, { passive: true });

    var toolbar = document.querySelector('.dm-toolbar');
    if (toolbar && !toolbar._dmFiltersFocus) {
      toolbar._dmFiltersFocus = 1;
      toolbar.addEventListener(
        'focusin',
        function () {
          setCollapsed(false);
        },
        true
      );
    }
  }

  /* Icon headers: hover (CSS) + tap/click toggles wording tip on touch devices. */
  function bindDebuffHeaderTips() {
    var head = document.getElementById('dmStickyHead');
    if (!head || head._dmDebuffTips) return;
    head._dmDebuffTips = 1;

    function closeAll(except) {
      head.querySelectorAll('.dm-head-debuff.is-tip-open').forEach(function (el) {
        if (except && el === except) return;
        el.classList.remove('is-tip-open');
        el.setAttribute('aria-expanded', 'false');
      });
    }

    head.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.dm-head-debuff') : null;
      if (!btn || !head.contains(btn)) return;
      ev.preventDefault();
      ev.stopPropagation();
      var open = btn.classList.contains('is-tip-open');
      closeAll();
      if (!open) {
        btn.classList.add('is-tip-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    document.addEventListener(
      'click',
      function (ev) {
        if (ev.target && ev.target.closest && ev.target.closest('.dm-head-debuff')) return;
        closeAll();
      },
      true
    );

    head.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      closeAll();
    });
  }

  function init() {
    try { localStorage.setItem('ggen_visited_dm', '1'); } catch (_) {}
    state.lang = readLang();
    applyStaticI18n();
    try {
      if (typeof window.__ggenInjectBrandFonts === 'function') {
        window.__ggenInjectBrandFonts();
      }
    } catch (_) {}
    paintRarityIcons();
    syncChipUi();
    bindFilters();
    bindLang();
    bindBoardVerticalScroll();
    bindFiltersAutoHide();
    bindDebuffHeaderTips();
    syncRotateHint();
    window.addEventListener('resize', syncRotateHint);
    loadMatrix();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
