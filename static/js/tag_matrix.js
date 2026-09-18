/**
 * Tag Matrix — live board with framed thumbs, support skill kinds, hover cards.
 */
(function () {
  'use strict';

  var STORAGE_LANG = 'ggen_lang';
  var cacheByLang = {};
  var rows = [];
  var loadSeq = 0;
  var API_SV = 7;

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
  /* Extra roman / alias tokens so “shippu” finds Shippujinrai on any locale */
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
  var SKILL_KIND_ICON = {
    hp: '/static/images/Trait/trait_10010401.webp',
    en: '/static/images/Trait/trait_10020501.webp',
    hybrid: '/static/images/Trait/trait_10780401.webp'
  };
  var ULT_ICON = '/static/images/UI/UI_Common_Icon_ULT.webp';
  var SELECT_TARGET_BLUE = '/static/images/UI/mw_blue_target1_outer.webp';
  var SELECT_TARGET_RED = '/static/images/UI/mw_red_target1_outer.webp';
  var ROTATE_PHONE = '/static/images/UI/UI_Gallery_Comics_Navi_Smartphone.webp';
  var ROTATE_ARROW = '/static/images/UI/UI_Gallery_Comics_RotationArrow_Active.webp';
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
  var SKILL_KIND_ORDER = ['hp', 'en', 'hybrid', ''];

  var state = {
    lang: 'EN',
    /* Multi-select — default majors only (no Other-Series). */
    groups: { four: 1, six: 1, new: 1, other: 1 },
    role: 'ALL',
    rarity: 'UR',
    exclusive: true,
    search: '',
    selectedIds: {},
    /* First right-click unit + its tag — Object.keys order is NOT click order for numeric ids. */
    anchorUnitId: null,
    anchorTagId: null,
    /* Mobile only: toolbar Squad toggle → tap units to multi-select (desktop keeps right-click). */
    squadMode: false
  };

  /* In-memory payload + O(1) hover lookup (avoid baking hover HTML into every tile). */
  var matrixPayload = null;
  var itemByKey = Object.create(null);
  var rowByTagId = Object.create(null);
  var searchDebounceTimer = null;
  var hoverPortalEl = null;
  var hoverPortalKey = null;
  var EAGER_THUMB_BUDGET = 24;

  var I18N = {
    EN: {
      nav: 'Tag Matrix',
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
      tabUnits: 'Units',
      tabSupporters: 'Supporters',
      tabCollections: 'Collections',
      eyebrow: 'Major Tags · live',
      title: 'Tag Matrix',
      sub: 'See which supporters and units share each Four/Six/New Major tag—filter by role and rarity, then right-click units to find kits that fit the same support pool.',
      note: 'Community taxonomy over mutually exclusive m_lineage IDs (LANG names).',
      filters: 'Filters',
      group: 'Tag group',
      role: 'Type',
      rarity: 'Rarity',
      all: 'All',
      four: 'Four',
      six: 'Six',
      new: 'New',
      other: 'Other',
      series: 'Other - Series',
      ur: 'UR',
      ssrPlus: 'SSR+',
      ssrMinus: 'SSR-',
      exclusive: 'Exclusive rails',
      supports: 'Supporters',
      searchPh: 'Find tag (shippu, 疾風…)',
      searchHint: 'Filters tag rows only — not unit names. Browse-style match: any locale / id / alias; spaces & commas = AND; -term excludes.',
      noMatch: 'No tags match that search.',
      legFour: 'Four Major',
      legSix: 'Six Major',
      legNew: 'New Major',
      headSupp: 'Supporters',
      headTag: 'Tag',
      headAtk: 'Attack Type',
      headSup: 'Support Type',
      headDur: 'Durability Type',
      roleAtk: 'Attack Type',
      roleSup: 'Support Type',
      roleDur: 'Durability Type',
      exclusiveLabel: 'Exclusive',
      exclusiveLabelShort: 'EXC',
      foot: '/tm · /api/tag_matrix',
      status: '{n} tags · {u} units · {s} supporters',
      statusFocus: 'Focus {k} · {n} tags · Esc / Clear · right-click units to multi-select',
      statusFocusTouch: 'Squad · {k} selected · {n} tags · tap units · Clear to exit',
      statusSquadIdle: 'Squad on · tap units to multi-select · Clear / Esc to exit',
      squad: 'Squad',
      clearFocus: 'Clear',
      loading: 'Loading…',
      err: 'Load failed.',
      empty: '—',
      /* m_character_skill (no LV): HP Repair / EN Charge / HP & EN Restoration */
      kindHp: 'HP Repair',
      kindEn: 'EN Charge',
      kindHybrid: 'HP & EN Restoration',
      kindHpShort: 'HP',
      kindEnShort: 'EN',
      kindHybridShort: 'Hybrid',
      kindOther: 'Other',
      limited: 'Limited',
      /* Config help uses “screen orientation” / 画面の向き / 畫面方向 */
      rotateHint: 'Rotate to landscape for a better viewing',
      rotateHintAria: 'Screen orientation — landscape recommended'
    },
    JA: {
      nav: 'タグ対応表',
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
      tabUnits: 'ユニット',
      tabSupporters: 'サポーター',
      tabCollections: 'コレクション',
      eyebrow: '系統タグ · ライブ',
      title: 'タグ対応表',
      sub: '四大／六大／新系統タグごとに対応サポーターとロール別ユニットを一覧。右クリックで複数選択し、共通サポーターを確認。',
      note: '互斥な m_lineage ID のコミュニティ分類（LANG名称）。',
      filters: '絞り込み',
      group: '区分',
      role: 'タイプ',
      rarity: 'レアリティ',
      all: 'すべて',
      four: '四大',
      six: '六大',
      new: '新しいタグ',
      other: '他',
      series: '他・シリーズ',
      ur: 'UR',
      ssrPlus: 'SSR+',
      ssrMinus: 'SSR-',
      exclusive: '互斥強調',
      supports: 'サポーター',
      searchPh: 'タグ検索（疾風…）',
      searchHint: 'タグ行のみ絞り込み（ユニット名ではない）。全言語名／ID／別名。空白・カンマはAND、先頭-で除外。',
      noMatch: '一致するタグがありません。',
      legFour: '四大',
      legSix: '六大',
      legNew: '新しいタグ',
      headSupp: 'サポーター',
      headTag: 'タグ',
      headAtk: '攻撃型',
      headSup: '支援型',
      headDur: '耐久型',
      roleAtk: '攻撃型',
      roleSup: '支援型',
      roleDur: '耐久型',
      exclusiveLabel: '互斥',
      exclusiveLabelShort: '互斥',
      foot: '/tm · /api/tag_matrix',
      status: '{n} タグ · ユニット {u} · サポーター {s}',
      statusFocus: 'フォーカス {k} · {n} タグ · Esc / Clear · 右クリックで複数選択',
      statusFocusTouch: '分隊 · {k} 選択 · {n} タグ · タップで追加 · Clear で解除',
      statusSquadIdle: '分隊オン · ユニットをタップで複数選択 · Clear / Esc で解除',
      squad: '分隊',
      clearFocus: 'Clear',
      loading: '読み込み中…',
      err: '失敗',
      empty: '—',
      /* m_character_skill: HPリペア / ENチャージ / HP&EN回復 */
      kindHp: 'HPリペア',
      kindEn: 'ENチャージ',
      kindHybrid: 'HP&EN回復',
      kindHpShort: 'HP',
      kindEnShort: 'EN',
      kindHybridShort: '回復',
      kindOther: '他',
      limited: '期間限定',
      rotateHint: 'Rotate to landscape for a better viewing',
      rotateHintAria: '画面の向き — landscape recommended'
    },
    TW: {
      nav: '標籤對照表',
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
      tabUnits: '單位',
      tabSupporters: '支援人員',
      tabCollections: '收藏',
      eyebrow: '系統標籤 · 即時',
      title: '標籤對照表',
      sub: '依四大／六大／新標籤查看對應支援人員與各角色單位；右鍵多選單位可找出共用支援池的組合。',
      note: '互斥 m_lineage ID 社群分類（LANG名稱）。',
      filters: '篩選',
      group: '分組',
      role: '類型',
      rarity: '稀有度',
      all: '全部',
      four: '四大',
      six: '六大',
      new: '新標籤',
      other: '其他',
      series: '其他・系列',
      ur: 'UR',
      ssrPlus: 'SSR+',
      ssrMinus: 'SSR-',
      exclusive: '強調互斥',
      supports: '支援人員',
      searchPh: '搜尋標籤（疾風、shippu…）',
      searchHint: '只篩選標籤列，不是單位名稱。可用各語名稱／ID／別名；空白與逗號為 AND；-關鍵字排除。',
      noMatch: '沒有符合的標籤。',
      legFour: '四大',
      legSix: '六大',
      legNew: '新標籤',
      headSupp: '支援人員',
      headTag: '標籤',
      headAtk: '攻擊型',
      headSup: '支援型',
      headDur: '耐久型',
      roleAtk: '攻擊型',
      roleSup: '支援型',
      roleDur: '耐久型',
      exclusiveLabel: '互斥',
      exclusiveLabelShort: '互斥',
      foot: '/tm · /api/tag_matrix',
      status: '{n} 標籤 · 單位 {u} · 支援人員 {s}',
      statusFocus: '焦點 {k} · {n} 標籤 · Esc / Clear · 右鍵多選',
      statusFocusTouch: '小隊 · 已選 {k} · {n} 標籤 · 點單位加入 · Clear 結束',
      statusSquadIdle: '小隊開啟 · 點單位多選 · Clear / Esc 結束',
      squad: '小隊',
      clearFocus: 'Clear',
      loading: '載入中…',
      err: '載入失敗',
      empty: '—',
      /* m_character_skill: HP修復 / EN填充 / HP&EN恢復 */
      kindHp: 'HP修復',
      kindEn: 'EN填充',
      kindHybrid: 'HP&EN恢復',
      kindHpShort: 'HP',
      kindEnShort: 'EN',
      kindHybridShort: '恢復',
      kindOther: '其他',
      limited: '期間限定',
      rotateHint: 'Rotate to landscape for a better viewing',
      rotateHintAria: '畫面方向 — landscape recommended'
    },
    HK: {
      nav: '標籤對照表',
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
      tabUnits: '單位',
      tabSupporters: '支援人員',
      tabCollections: '收藏',
      eyebrow: '系統標籤 · 即時',
      title: '標籤對照表',
      sub: '依四大／六大／新標籤查看對應支援人員與各角色單位；右鍵多選單位可找出共用支援池的組合。',
      note: '互斥 m_lineage ID 社群分類（LANG名稱）。',
      filters: '篩選',
      group: '分組',
      role: '類型',
      rarity: '稀有度',
      all: '全部',
      four: '四大',
      six: '六大',
      new: '新標籤',
      other: '其他',
      series: '其他・系列',
      ur: 'UR',
      ssrPlus: 'SSR+',
      ssrMinus: 'SSR-',
      exclusive: '強調互斥',
      supports: '支援人員',
      searchPh: '搜尋標籤（疾風、shippu…）',
      searchHint: '只篩選標籤列，不是單位名稱。可用各語名稱／ID／別名；空白與逗號為 AND；-關鍵字排除。',
      noMatch: '沒有符合的標籤。',
      legFour: '四大',
      legSix: '六大',
      legNew: '新標籤',
      headSupp: '支援人員',
      headTag: '標籤',
      headAtk: '攻擊型',
      headSup: '支援型',
      headDur: '耐久型',
      roleAtk: '攻擊型',
      roleSup: '支援型',
      roleDur: '耐久型',
      exclusiveLabel: '互斥',
      exclusiveLabelShort: '互斥',
      foot: '/tm · /api/tag_matrix',
      status: '{n} 標籤 · 單位 {u} · 支援人員 {s}',
      statusFocus: '焦點 {k} · {n} 標籤 · Esc / Clear · 右鍵多選',
      statusFocusTouch: '小隊 · 已選 {k} · {n} 標籤 · 點單位加入 · Clear 結束',
      statusSquadIdle: '小隊開啟 · 點單位多選 · Clear / Esc 結束',
      squad: '小隊',
      clearFocus: 'Clear',
      loading: '載入中…',
      err: '載入失敗',
      empty: '—',
      /* m_character_skill: HP修復 / EN填充 / HP&EN恢復 */
      kindHp: 'HP修復',
      kindEn: 'EN填充',
      kindHybrid: 'HP&EN恢復',
      kindHpShort: 'HP',
      kindEnShort: 'EN',
      kindHybridShort: '恢復',
      kindOther: '其他',
      limited: '期間限定',
      rotateHint: 'Rotate to landscape for a better viewing',
      rotateHintAria: '畫面方向 — landscape recommended'
    }
  };

  (function assertTmI18nKeys() {
    var keys = Object.keys(I18N.EN);
    ['JA', 'TW', 'HK'].forEach(function (lc) {
      keys.forEach(function (k) {
        if (I18N[lc][k] == null) {
          try {
            console.warn('[tm] missing I18N.' + lc + '.' + k);
          } catch (_) {}
        }
      });
    });
  })();

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
    var cdn = String(window.__TM_CDN__ || window.__GGEN_IMAGE_CDN__ || '').replace(/\/+$/, '');
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
  function roleIcon(role) {
    var map = {
      1: '/static/images/UI/UI_Common_TypeIcon_Attack_M.webp',
      2: '/static/images/UI/UI_Common_TypeIcon_Defense_M.webp',
      3: '/static/images/UI/UI_Common_TypeIcon_Support_M.webp'
    };
    return cdnPath(map[role] || map[1]);
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
  function filterList(list) {
    return (list || []).filter(rarityOk);
  }
  function kindLabel(kind) {
    if (kind === 'hp') return t('kindHp');
    if (kind === 'en') return t('kindEn');
    if (kind === 'hybrid') return t('kindHybrid');
    return t('kindOther');
  }

  /** Prefer API skill_kind; fall back to active/kind icon filename (stale cache safe). */
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

  function bucketSupports(list) {
    var items = filterList(list);
    var cols = { hp: [], en: [], hybrid: [] };
    items.forEach(function (it) {
      var k = resolveSkillKind(it);
      if (k === 'hp' || k === 'en' || k === 'hybrid') cols[k].push(it);
      else cols.hybrid.push(it);
    });
    return cols;
  }

  var BOARD_THUMB_PX = 38; /* was 33; +15% for tap targets */
  var LIMITED_UR_LABEL_BASE = '/static/images/UI/UI_Gasha_Label_UR_Base.webp';

  /** Official gacha Limited plate — same art as browse / detail / collections. */
  function limitedBadgeHtml(kind, size) {
    var lbl = t('limited');
    var sz = size || 'tile';
    var kindCls = kind === 'supporter' ? ' tm-lim-badge--supp' : ' tm-lim-badge--unit';
    return (
      '<span class="limited-ur-badge limited-ur-badge--' +
      escAttr(sz) +
      ' tm-lim-badge' +
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
    var href =
      kind === 'supporter'
        ? '/s/' + encodeURIComponent(item.id)
        : '/u/' + encodeURIComponent(item.id);
    var src = cdnPath(item.thum || '');
    var portrait = src
      ? '<img class="tm-ft-portrait" src="' +
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
        '<span class="tm-ft-ic"><img src="' +
        escAttr(cdnPath(ULT_ICON)) +
        '" alt="" loading="lazy"></span>';
    }
    if (item.acquisition_icon && !opts.skipAcqIcon) {
      icons +=
        '<span class="tm-ft-ic"><img src="' +
        escAttr(cdnPath(item.acquisition_icon)) +
        '" alt="" loading="lazy"></span>';
    }
    var iconsWrap = icons ? '<span class="tm-ft-icons">' + icons + '</span>' : '';
    var hit =
      '<a class="tm-ft-hit" href="' +
      escAttr(href) +
      '" aria-label="' +
      escAttr(item.name || '') +
      '"></a>';

    if (isSupp) {
      var fr = SUPP_TB_FRAME[rarity] || SUPP_TB_FRAME.N;
      return (
        '<span class="tm-ft tm-ft--supp tm-ft--tb' +
        (item.is_limited_time ? ' tm-ft--limited' : '') +
        '" style="width:' +
        sz +
        'px;height:' +
        sz +
        'px">' +
        limRibbon +
        '<img class="tm-ft-base" src="' +
        escAttr(cdnPath(TB_SUPP_BASE)) +
        '" alt="" loading="lazy" decoding="async">' +
        '<span class="tm-ft-port-wrap">' +
        portrait +
        '</span>' +
        '<img class="tm-ft-tb tm-ft-tb--l" src="' +
        escAttr(cdnPath(fr.lr)) +
        '" alt="" loading="lazy">' +
        '<img class="tm-ft-tb tm-ft-tb--r" src="' +
        escAttr(cdnPath(fr.lr)) +
        '" alt="" loading="lazy">' +
        '<img class="tm-ft-tb tm-ft-tb--t" src="' +
        escAttr(cdnPath(fr.tb)) +
        '" alt="" loading="lazy">' +
        '<img class="tm-ft-tb tm-ft-tb--b" src="' +
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
      '<span class="tm-ft tm-ft--unit tm-ft--framed' +
      (item.is_limited_time ? ' tm-ft--limited' : '') +
      '" style="width:' +
      sz +
      'px;height:' +
      sz +
      'px">' +
      limRibbon +
      '<img class="tm-ft-base" src="' +
      escAttr(base) +
      '" alt="" loading="lazy" decoding="async">' +
      '<span class="tm-ft-port-wrap">' +
      portrait +
      '</span>' +
      '<img class="tm-ft-frame" src="' +
      escAttr(frame) +
      '" alt="" loading="lazy" decoding="async">' +
      iconsWrap +
      hit +
      '</span>'
    );
  }

  function hoverCardInnerHtml(item, kind, tagId) {
    /* Limited = Collections plate style, stacked above the thumb (hover is too small to overlay). */
    var limBar = item.is_limited_time
      ? '<div class="bt-limited-topbar tm-hover-lim" aria-hidden="true">' +
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
          '<span class="tm-hover-skill" title="' +
          escAttr(kindLabel(sk)) +
          '"><img src="' +
          escAttr(cdnPath(showIc)) +
          '" alt=""></span>';
      }
      if (strip) skills = '<div class="tm-hover-skills">' + strip + '</div>';
      var tags = [];
      (item.skill_tag_data || []).forEach(function (sk) {
        (sk.tags || []).forEach(function (tg) {
          if (tg && tg.name) tags.push(tg.name);
        });
      });
      if (tags.length) {
        metaBits.push(tags.slice(0, 4).join(item.skill_tag_data && item.skill_tag_data[0] && item.skill_tag_data[0].separator === 'and' ? ' + ' : ' / '));
      }
    } else {
      terrain = terrainRowHtml(item);
    }
    return (
      '<div class="tm-hover-thumb' +
      (item.is_limited_time ? ' tm-hover-thumb--lt' : '') +
      '">' +
      limBar +
      thumb +
      '</div>' +
      '<div class="tm-hover-name">' +
      esc(item.name || '') +
      '</div>' +
      skills +
      terrain +
      (metaBits.length
        ? '<div class="tm-hover-meta">' + metaBits.join(' · ') + '</div>'
        : '')
    );
  }

  function terrainRowHtml(item) {
    var list = (item && item.terrain) || [];
    if (!list.length) return '';
    var parts = [];
    for (var i = 0; i < list.length; i++) {
      var tr = list[i] || {};
      var name = String(tr.name || TERRAIN_ORDER[i] || '');
      var lv = parseInt(tr.level, 10) || 1;
      if (lv < 1) lv = 1;
      if (lv > 3) lv = 3;
      var typeIc = tr.type_icon || TERRAIN_TYPE_ICONS[name] || '';
      var levelIc = tr.level_icon || TERRAIN_LEVEL_ICONS[lv] || '';
      var dim = lv < 2 ? ' tm-hover-terrain-item--dim' : '';
      parts.push(
        '<span class="tm-hover-terrain-item' +
          dim +
          '" title="' +
          escAttr(name) +
          '">' +
          (typeIc
            ? '<img class="tm-hover-terrain-type" src="' +
              escAttr(cdnPath(typeIc)) +
              '" alt="" loading="lazy">'
            : '') +
          (levelIc
            ? '<img class="tm-hover-terrain-lv" src="' +
              escAttr(cdnPath(levelIc)) +
              '" alt="" loading="lazy">'
            : '') +
          '</span>'
      );
    }
    if (!parts.length) return '';
    return '<div class="tm-hover-terrain" aria-label="Terrain">' + parts.join('') + '</div>';
  }

  function rebuildItemIndex() {
    itemByKey = Object.create(null);
    rowByTagId = Object.create(null);
    rows.forEach(function (row) {
      if (row && row.id != null) rowByTagId[String(row.id)] = row;
      ['1', '2', '3'].forEach(function (r) {
        ((row.units && row.units[r]) || []).forEach(function (u) {
          if (u && u.id != null) itemByKey['u:' + u.id] = u;
        });
      });
      (row.supports || []).forEach(function (s) {
        if (s && s.id != null) itemByKey['s:' + s.id] = s;
      });
    });
  }

  function takeEager(budget) {
    if (!budget || budget.n <= 0) return false;
    budget.n--;
    return true;
  }

  function selectedCount() {
    return Object.keys(state.selectedIds).length;
  }

  function isSelected(id) {
    return !!state.selectedIds[String(id)];
  }

  function toggleSelect(id, tagId) {
    id = String(id || '');
    if (!id) return;
    if (state.selectedIds[id]) {
      delete state.selectedIds[id];
      if (!selectedCount()) {
        state.anchorTagId = null;
        state.anchorUnitId = null;
      }
    } else {
      if (!selectedCount()) {
        state.anchorUnitId = id;
        state.anchorTagId = tagId != null && tagId !== '' ? String(tagId) : null;
      }
      state.selectedIds[id] = 1;
    }
    afterSelectionChange();
  }

  function clearSelection() {
    if (!selectedCount()) {
      syncStatusBar();
      return;
    }
    state.selectedIds = {};
    state.anchorTagId = null;
    state.anchorUnitId = null;
    afterSelectionChange();
  }

  function setSquadMode(on) {
    state.squadMode = !!on;
    if (!state.squadMode) {
      state.selectedIds = {};
      state.anchorUnitId = null;
      state.anchorTagId = null;
    }
    syncSquadUi();
    afterSelectionChange();
  }

  function syncSquadUi() {
    var btn = document.getElementById('tmSquadToggle');
    if (btn) {
      btn.classList.toggle('is-active', !!state.squadMode);
      btn.setAttribute('aria-pressed', state.squadMode ? 'true' : 'false');
      btn.title = t('squad');
    }
    var lab = document.getElementById('tmSquadLabel');
    if (lab) lab.textContent = t('squad');
    var lbl = document.getElementById('tmSquadLbl');
    if (lbl) lbl.textContent = t('squad');
    var clearBtn = document.getElementById('tmSquadClear');
    if (clearBtn) {
      clearBtn.textContent = t('clearFocus');
      clearBtn.title = t('clearFocus') + ' (Esc)';
      clearBtn.setAttribute('aria-label', t('clearFocus'));
    }
    document.body.classList.toggle('tm-squad-mode', !!state.squadMode && isTouchUi());
  }

  function rowDataByTagId(tagId) {
    return rowByTagId[String(tagId || '')] || null;
  }

  function patchUnitSelectTarget(tile, on, sharesCached) {
    var img = tile.querySelector('.tm-select-target');
    if (!on) {
      if (img) img.remove();
      return;
    }
    var src = cdnPath(selectTargetForUnit(tile.getAttribute('data-id'), sharesCached));
    if (!img) {
      img = document.createElement('img');
      img.className = 'tm-select-target';
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      tile.appendChild(img);
    }
    if (img.getAttribute('src') !== src) img.src = src;
  }

  /* Soft-update focus/selection classes — avoid full board HTML rebuild on each tap. */
  function syncSelectionUi() {
    var board = document.getElementById('tmBoard');
    var wrap = document.querySelector('.tm-board-wrap');
    var focusOn = selectedCount() > 0;
    document.body.classList.toggle('tm-focus-on', focusOn);
    if (!board) {
      syncStatusBar();
      return;
    }

    /* Keep viewport anchored on a selected tile / hit row while rows hide/show. */
    var anchor =
      board.querySelector('.tm-tile--selected') ||
      board.querySelector('.tm-row--hit');
    var anchorPad = null;
    if (wrap && anchor) {
      anchorPad = anchor.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
    }
    var prevTop = wrap ? wrap.scrollTop : 0;

    var sharedIds = focusOn ? sharedSupporterIds() : null;
    var shares = focusOn ? Object.keys(sharedIds || {}).length > 0 : true;

    board.querySelectorAll('.tm-row').forEach(function (rowEl) {
      var tagId = rowEl.getAttribute('data-tag-id');
      var row = rowDataByTagId(tagId);
      var rowHit = focusOn && row && rowHasSelectedUnit(row);
      var rowShared = false;
      rowEl.classList.toggle('tm-row--hit', !!rowHit);
      rowEl.classList.toggle('tm-row--focus-out', focusOn && !rowHit);

      rowEl.querySelectorAll('.tm-tile[data-kind="unit"]').forEach(function (tile) {
        var id = tile.getAttribute('data-id');
        var sel = focusOn && isSelected(id);
        tile.classList.toggle('tm-tile--selected', !!sel);
        tile.classList.toggle('tm-tile--dim', focusOn && !sel);
        patchUnitSelectTarget(tile, !!sel, shares);
      });

      rowEl.querySelectorAll('.tm-tile[data-kind="supporter"]').forEach(function (tile) {
        var sid = tile.getAttribute('data-id');
        var hit = focusOn && sharedIds && sid && !!sharedIds[String(sid)];
        if (hit) rowShared = true;
        tile.classList.toggle('tm-tile--supp-hit', !!hit);
        tile.classList.toggle('tm-tile--dim', focusOn && !hit);
      });

      rowEl.classList.toggle('tm-row--supp-shared', !!rowShared);
      var suppCell = rowEl.querySelector('.tm-supp');
      if (suppCell) {
        suppCell.classList.toggle('tm-supp--hit', !!rowShared);
      }
    });

    board.querySelectorAll('.tm-rail-group').forEach(function (group) {
      var any = false;
      group.querySelectorAll('.tm-row').forEach(function (r) {
        if (!r.classList.contains('tm-row--focus-out')) any = true;
      });
      group.classList.toggle('tm-rail-group--focus-out', focusOn && !any);
    });

    syncStatusBar();
    fitExclusiveRails();

    requestAnimationFrame(function () {
      if (!wrap) return;
      var still =
        (anchor && anchor.isConnected && board.contains(anchor)
          ? anchor
          : null) ||
        board.querySelector('.tm-tile--selected') ||
        board.querySelector('.tm-row--hit');
      if (still && anchorPad != null) {
        var nextPad = still.getBoundingClientRect().top - wrap.getBoundingClientRect().top;
        wrap.scrollTop = Math.max(0, wrap.scrollTop + (nextPad - anchorPad));
      } else {
        wrap.scrollTop = prevTop;
      }
      /* Short focused boards: collapse chrome once so the list can actually pan. */
      if (focusOn && wrap.scrollHeight <= wrap.clientHeight + 24) {
        setFiltersCollapsed(true);
      } else if (!focusOn) {
        setFiltersCollapsed(false);
      }
    });
  }

  function syncStatusBar() {
    var st = document.getElementById('tmStatus');
    if (!st) return;
    var focusOn = selectedCount() > 0;
    var c = countVisible();
    if (focusOn) {
      var focusTpl = isTouchUi() ? t('statusFocusTouch') : t('statusFocus');
      st.innerHTML =
        '<span class="tm-status-text">' +
        esc(
          focusTpl
            .replace('{k}', String(selectedCount()))
            .replace('{n}', String(c.tags))
        ) +
        '</span><button type="button" class="tm-focus-clear" id="tmFocusClear">' +
        esc(t('clearFocus')) +
        '</button>';
      var clearBtn = document.getElementById('tmFocusClear');
      if (clearBtn) {
        clearBtn.addEventListener('click', function (ev) {
          ev.preventDefault();
          clearSelection();
        });
      }
    } else if (state.squadMode && isTouchUi()) {
      st.innerHTML =
        '<span class="tm-status-text">' +
        esc(t('statusSquadIdle')) +
        '</span><button type="button" class="tm-focus-clear" id="tmFocusClear">' +
        esc(t('clearFocus')) +
        '</button>';
      var clearIdle = document.getElementById('tmFocusClear');
      if (clearIdle) {
        clearIdle.addEventListener('click', function (ev) {
          ev.preventDefault();
          setSquadMode(false);
        });
      }
    } else {
      st.textContent = t('status')
        .replace('{n}', String(c.tags))
        .replace('{u}', String(c.units))
        .replace('{s}', String(c.supports));
    }
  }

  function rowHasSelectedUnit(row) {
    if (!selectedCount()) return false;
    var roles = ['1', '2', '3'];
    for (var i = 0; i < roles.length; i++) {
      var list = (row.units && row.units[roles[i]]) || [];
      for (var j = 0; j < list.length; j++) {
        if (isSelected(list[j].id)) return true;
      }
    }
    return false;
  }

  function rowHasUnitId(row, unitId) {
    unitId = String(unitId || '');
    if (!unitId) return false;
    var roles = ['1', '2', '3'];
    for (var i = 0; i < roles.length; i++) {
      /* Raw catalog — rarity filter must not hide shared-supporter matches. */
      var list = (row.units && row.units[roles[i]]) || [];
      for (var j = 0; j < list.length; j++) {
        if (String(list[j].id) === unitId) return true;
      }
    }
    return false;
  }

  function supporterIdsOnRow(row) {
    var out = Object.create(null);
    var list = (row && row.supports) || [];
    for (var i = 0; i < list.length; i++) {
      var sid = list[i] && list[i].id != null ? String(list[i].id) : '';
      if (sid) out[sid] = 1;
    }
    return out;
  }

  /* Union of supporters on every catalog tag row that lists this unit. */
  function supporterPoolForUnit(unitId) {
    unitId = String(unitId || '');
    var out = Object.create(null);
    if (!unitId) return out;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (!rowHasUnitId(row, unitId)) continue;
      var pool = supporterIdsOnRow(row);
      Object.keys(pool).forEach(function (sid) {
        out[sid] = 1;
      });
    }
    return out;
  }

  /*
    Supporters shared by the whole squad: intersection of each pick’s tag-row
    support pools. Works across Tag Groups (Four/Six/New/Other) — not only when
    one tag row lists every selected unit.
  */
  function sharedSupporterIds() {
    var ids = Object.keys(state.selectedIds);
    if (!ids.length) return Object.create(null);
    var shared = supporterPoolForUnit(ids[0]);
    for (var i = 1; i < ids.length; i++) {
      var next = supporterPoolForUnit(ids[i]);
      Object.keys(shared).forEach(function (sid) {
        if (!next[sid]) delete shared[sid];
      });
    }
    return shared;
  }

  /* Squad shares supports when the intersection above is non-empty. */
  function selectionSharesSupporters() {
    if (selectedCount() <= 1) return true;
    return Object.keys(sharedSupporterIds()).length > 0;
  }

  /*
    Blue = sole pick, or multi-select with ≥1 shared supporter (any Tag Group).
    Red = later picks when support pools diverge (no common supporter).
  */
  function selectTargetForUnit(unitId, sharesCached) {
    unitId = String(unitId || '');
    if (selectedCount() <= 1) return SELECT_TARGET_BLUE;
    var shares =
      sharesCached != null ? !!sharesCached : selectionSharesSupporters();
    if (shares) return SELECT_TARGET_BLUE;
    if (unitId && unitId === String(state.anchorUnitId || '')) return SELECT_TARGET_BLUE;
    return SELECT_TARGET_RED;
  }

  function unitCellHtml(item, eager) {
    var id = String(item.id || '');
    return (
      '<span class="tm-tile" data-kind="unit" data-id="' +
      escAttr(id) +
      '" data-item-key="u:' +
      escAttr(id) +
      '">' +
      framedThumbHtml(item, 'unit', BOARD_THUMB_PX, { eager: !!eager }) +
      '</span>'
    );
  }

  function suppCellHtml(item, eager) {
    var kind = resolveSkillKind(item);
    var kindIc = kind && SKILL_KIND_ICON[kind] ? SKILL_KIND_ICON[kind] : '';
    var badge = kindIc
      ? '<img class="tm-supp-kind-badge" src="' +
        escAttr(cdnPath(kindIc)) +
        '" alt="' +
        escAttr(kindLabel(kind)) +
        '" title="' +
        escAttr(kindLabel(kind)) +
        '">'
      : '';
    var sid = String(item.id || '');
    return (
      '<span class="tm-tile tm-tile--supp" data-kind="supporter" data-skill-kind="' +
      escAttr(kind) +
      '" data-id="' +
      escAttr(sid) +
      '" data-item-key="s:' +
      escAttr(sid) +
      '">' +
      '<span class="tm-supp-stack">' +
      framedThumbHtml(item, 'supporter', BOARD_THUMB_PX, { eager: !!eager }) +
      badge +
      '</span>' +
      '</span>'
    );
  }

  function supportsCellHtml(list, eagerBudget) {
    /* Rarity filter is for units only — SR/R supports (e.g. Protagonist 1850000360)
       must stay visible when browsing UR kits, or Squad highlight has nothing to paint. */
    var items = (list || []).slice().sort(function (a, b) {
      var ka = SKILL_KIND_ORDER.indexOf(resolveSkillKind(a));
      var kb = SKILL_KIND_ORDER.indexOf(resolveSkillKind(b));
      if (ka < 0) ka = 99;
      if (kb < 0) kb = 99;
      if (ka !== kb) return ka - kb;
      return (a.rarity_sort | 0) - (b.rarity_sort | 0);
    });
    if (!items.length) {
      return '<div class="tm-supp tm-supp--empty" role="cell"></div>';
    }
    return (
      '<div class="tm-supp" role="cell"><div class="tm-chip-strip tm-chip-strip--supp">' +
      items
        .map(function (it) {
          return suppCellHtml(it, takeEager(eagerBudget));
        })
        .join('') +
      '</div></div>'
    );
  }

  function unitsHtml(list, eagerBudget) {
    var items = filterList(list);
    if (!items.length) return '';
    return (
      '<div class="tm-chip-strip">' +
      items
        .map(function (it) {
          return unitCellHtml(it, takeEager(eagerBudget));
        })
        .join('') +
      '</div>'
    );
  }

  function roleUnitsHtml(row, roleKey, eagerBudget) {
    if (state.role !== 'ALL' && state.role !== roleKey) return '';
    return unitsHtml(row.units && row.units[roleKey], eagerBudget);
  }

  function buildHeadHtml() {
    var html = '';
    html += '<div class="tm-head-rail" role="columnheader"></div>';
    html +=
      '<div class="tm-head-supp" role="columnheader">' + esc(t('headSupp')) + '</div>';
    html += '<div class="tm-head-tag" role="columnheader">' + esc(t('headTag')) + '</div>';
    html +=
      '<div class="tm-head-role tm-head-role--1" role="columnheader" title="' +
      escAttr(t('headAtk')) +
      '" aria-label="' +
      escAttr(t('headAtk')) +
      '"><img src="' +
      roleIcon(1) +
      '" alt=""><span class="tm-head-role-label">' +
      esc(t('headAtk')) +
      '</span></div>';
    html +=
      '<div class="tm-head-role tm-head-role--3" role="columnheader" title="' +
      escAttr(t('headSup')) +
      '" aria-label="' +
      escAttr(t('headSup')) +
      '"><img src="' +
      roleIcon(3) +
      '" alt=""><span class="tm-head-role-label">' +
      esc(t('headSup')) +
      '</span></div>';
    html +=
      '<div class="tm-head-role tm-head-role--2" role="columnheader" title="' +
      escAttr(t('headDur')) +
      '" aria-label="' +
      escAttr(t('headDur')) +
      '"><img src="' +
      roleIcon(2) +
      '" alt=""><span class="tm-head-role-label">' +
      esc(t('headDur')) +
      '</span></div>';
    return html;
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

  /* Match browse instant search: fold / word-start / multi-term AND / -exclude */
  function tmSearchFold(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\s\-_]+/g, '');
  }
  function tmAlnumCode(c) {
    return (c >= 48 && c <= 57) || (c >= 97 && c <= 122);
  }
  function tmParseQuery(sq) {
    var positive = [];
    var negative = [];
    if (!sq || !String(sq).trim()) return { positive: positive, negative: negative };
    var rawQ = String(sq);
    try {
      rawQ = rawQ.normalize('NFKC');
    } catch (_) {}
    rawQ.split(/[,;]/).forEach(function (raw) {
      var seg = String(raw || '')
        .replace(/\uFF1A/g, ':')
        .replace(/\u3000/g, ' ')
        .trim();
      if (!seg) return;
      var sl = seg.toLowerCase();
      if (sl.charAt(0) === '-' && sl.length > 1) {
        negative.push(sl.slice(1).trim());
        return;
      }
      positive.push(sl);
    });
    return { positive: positive, negative: negative };
  }
  function tmTermInHay(term, hay, hayFold) {
    if (!term) return true;
    var t = String(term).toLowerCase();
    if (!t) return true;
    var ascii = /^[a-z0-9._+]+$/.test(t);
    if (ascii) {
      if (t.length === 1) {
        var i1 = hay.indexOf(t);
        while (i1 >= 0) {
          if (i1 === 0 || !tmAlnumCode(hay.charCodeAt(i1 - 1))) return true;
          i1 = hay.indexOf(t, i1 + 1);
        }
        return false;
      }
      if (t.length === 2 && !/^\d+$/.test(t)) {
        var i2 = hay.indexOf(t);
        while (i2 >= 0) {
          var after = i2 + t.length;
          var nextOk = after >= hay.length || !tmAlnumCode(hay.charCodeAt(after));
          if ((i2 === 0 || !tmAlnumCode(hay.charCodeAt(i2 - 1))) && nextOk) return true;
          i2 = hay.indexOf(t, i2 + 1);
        }
      } else if (/^\d+$/.test(t) && t.length >= 4) {
        if (hay.indexOf(t) >= 0) return true;
      } else {
        var i3 = hay.indexOf(t);
        while (i3 >= 0) {
          if (i3 === 0 || !tmAlnumCode(hay.charCodeAt(i3 - 1))) return true;
          i3 = hay.indexOf(t, i3 + 1);
        }
      }
      var tfA = tmSearchFold(t);
      if (tfA.length >= 2 && hayFold && hayFold.indexOf(tfA) >= 0) return true;
      return t.length >= 2 && hay.indexOf(t) >= 0;
    }
    if (hay.indexOf(t) >= 0) return true;
    var tf = tmSearchFold(t);
    return tf.length >= 2 && hayFold && hayFold.indexOf(tf) >= 0;
  }
  function tmIdDigitsMatch(term, row) {
    var digits = String(term || '').replace(/\D/g, '');
    if (!digits || digits.length < 4) return false;
    var id = String(row.id || '');
    var raw = String(row.raw_id || '');
    return (
      digits === id ||
      digits === raw ||
      (id && id.indexOf(digits) >= 0) ||
      (raw && raw.indexOf(digits) >= 0)
    );
  }

  function rowGroupOk(row) {
    return !!state.groups[String(row.group || '')];
  }

  function rowSearchOk(row) {
    var q = String(state.search || '').trim();
    if (!q) return true;
    var pq = tmParseQuery(q);
    if (!pq.positive.length && !pq.negative.length) return true;
    var hay = rowSearchBlob(row);
    var hayFold = tmSearchFold(hay);
    var pi;
    for (pi = 0; pi < pq.positive.length; pi++) {
      var parts = pq.positive[pi].split(/\s+/).filter(Boolean);
      var pj;
      for (pj = 0; pj < parts.length; pj++) {
        var part = parts[pj];
        if (tmIdDigitsMatch(part, row)) continue;
        if (!tmTermInHay(part, hay, hayFold)) return false;
      }
    }
    for (pi = 0; pi < pq.negative.length; pi++) {
      var neg = pq.negative[pi];
      if (tmIdDigitsMatch(neg, row) || tmTermInHay(neg, hay, hayFold)) return false;
    }
    return true;
  }

  function rowMatches(row) {
    if (!rowGroupOk(row)) return false;
    /*
      Squad pick while searching: also surface every enabled-group tag that
      lists a selected unit (not only tags matching the search string).
    */
    if (selectedCount() > 0 && rowHasSelectedUnit(row)) return true;
    return rowSearchOk(row);
  }

  function afterSelectionChange() {
    hideHoverPortal();
    /* Search narrows the DOM; selecting a unit must rebuild so its other tags appear. */
    if (String(state.search || '').trim()) renderBoard();
    else syncSelectionUi();
  }

  function syncGroupActive() {
    var root = document.getElementById('tmGroupTabs');
    if (!root) return;
    root.querySelectorAll('[data-group]').forEach(function (el) {
      var g = el.getAttribute('data-group');
      var on = !!state.groups[g];
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function toggleGroup(g) {
    g = String(g || '');
    if (!g || g === 'all') return;
    if (state.groups[g]) {
      var left = 0;
      Object.keys(state.groups).forEach(function (k) {
        if (state.groups[k]) left++;
      });
      /* Keep at least one group on */
      if (left <= 1) return;
      delete state.groups[g];
    } else {
      state.groups[g] = 1;
    }
    syncGroupActive();
    renderBoard();
  }

  function countVisible() {
    var tags = 0;
    var units = 0;
    var supports = 0;
    var focusOn = selectedCount() > 0;
    rows.forEach(function (row) {
      if (!rowMatches(row)) return;
      if (focusOn && !rowHasSelectedUnit(row)) return;
      tags++;
      supports += (row.supports || []).length;
      ['1', '2', '3'].forEach(function (r) {
        if (state.role !== 'ALL' && state.role !== r) return;
        units += filterList((row.units && row.units[r]) || []).length;
      });
    });
    return { tags: tags, units: units, supports: supports };
  }

  function syncDensityClass() {
    document.body.classList.toggle('tm-dense', state.rarity === 'UR' || state.rarity === 'SSR+');
    document.body.classList.toggle('tm-ur-only', state.rarity === 'UR');
  }

  /*
    Role columns share leftover width proportional to densest row counts.
    Fixed rail / supports / tag; no horizontal overflow.
  */
  function syncBoardColumnWidths(visible) {
    var page = document.querySelector('.tm-page') || document.body;
    var maxAtk = 0;
    var maxRoleSup = 0;
    var maxDur = 0;
    var maxSupp = 0;
    var role = state.role;
    for (var i = 0; i < visible.length; i++) {
      var row = visible[i];
      if (role === 'ALL' || role === '1') {
        maxAtk = Math.max(maxAtk, filterList((row.units && row.units['1']) || []).length);
      }
      if (role === 'ALL' || role === '3') {
        maxRoleSup = Math.max(
          maxRoleSup,
          filterList((row.units && row.units['3']) || []).length
        );
      }
      if (role === 'ALL' || role === '2') {
        maxDur = Math.max(maxDur, filterList((row.units && row.units['2']) || []).length);
      }
      maxSupp = Math.max(maxSupp, (row.supports || []).length);
    }
    /* At least 1fr so empty roles still leave a slim column */
    page.style.setProperty('--tm-fr-atk', Math.max(1, maxAtk) + 'fr');
    page.style.setProperty('--tm-fr-role-sup', Math.max(1, maxRoleSup) + 'fr');
    page.style.setProperty('--tm-fr-dur', Math.max(1, maxDur) + 'fr');
    /* Supports: prefer content, hard-cap so the board never spills */
    var suppSlot = 48;
    var suppW = Math.min(120, Math.max(52, (Math.min(maxSupp, 3) || 1) * suppSlot));
    page.style.setProperty('--tm-w-supp', suppW + 'px');
    /* Tight tag column — leave leftover width for unit role columns */
    page.style.setProperty('--tm-w-tag', state.lang === 'EN' ? '76px' : '84px');
  }

  function renderBoard() {
    var board = document.getElementById('tmBoard');
    var head = document.getElementById('tmStickyHead');
    if (!board) return;
    syncDensityClass();
    board.className = 'tm-board';
    if (state.role !== 'ALL') board.classList.add('tm-role-filter-' + state.role);

    /* Keep all filter-matching rows in the DOM; focus only hides via syncSelectionUi. */
    var visible = [];
    rows.forEach(function (row) {
      if (!rowMatches(row)) return;
      visible.push(row);
    });
    syncBoardColumnWidths(visible);

    if (head) head.innerHTML = buildHeadHtml();

    var excl = t('exclusiveLabel');
    var eagerBudget = { n: EAGER_THUMB_BUDGET };

    function renderRowInner(row, alt) {
      var h =
        '<div class="tm-row tm-row--no-rail' +
        (alt ? ' tm-row--alt' : '') +
        '" role="row" data-group="' +
        escAttr(row.group) +
        '" data-tag-id="' +
        escAttr(row.id) +
        '">';
      h += supportsCellHtml(row.supports, eagerBudget);
      h +=
        '<div class="tm-tag-cell" role="cell"><span class="tm-tag-name">' +
        esc(row.name || row.id) +
        '</span></div>';
      h +=
        '<div class="tm-units tm-units--1" role="cell">' +
        roleUnitsHtml(row, '1', eagerBudget) +
        '</div>';
      h +=
        '<div class="tm-units tm-units--3" role="cell">' +
        roleUnitsHtml(row, '3', eagerBudget) +
        '</div>';
      h +=
        '<div class="tm-units tm-units--2" role="cell">' +
        roleUnitsHtml(row, '2', eagerBudget) +
        '</div>';
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
          return '<span class="tm-rail-group-ch">' + esc(ch) + '</span>';
        })
        .join('');
      html +=
        '<div class="tm-rail-group tm-rail-group--' +
        escAttr(g) +
        '" data-group="' +
        escAttr(g) +
        '" data-count="' +
        block.length +
        '">';
      html +=
        '<div class="tm-rail-group-bar" title="' +
        title +
        '" role="presentation">' +
        labelHtml +
        '</div>';
      html += '<div class="tm-rail-group-rows">';
      for (var b = 0; b < block.length; b++) {
        html += renderRowInner(block[b], rowIx % 2 === 1);
        rowIx++;
      }
      html += '</div></div>';
      i++;
    }

    if (!visible.length) {
      html +=
        '<div class="tm-empty-board" role="status">' + esc(t('noMatch')) + '</div>';
    }

    hideHoverPortal();
    board.innerHTML = html;
    bindBoardInteractions(board);
    syncSquadUi();
    syncSelectionUi();
    syncPageFlags();
    syncFixedChrome();
  }

  function fitExclusiveRails() {
    requestAnimationFrame(function () {
      document.querySelectorAll('.tm-rail-group-bar').forEach(function (bar) {
        var chars = bar.querySelectorAll('.tm-rail-group-ch');
        var n = chars.length;
        if (!n) return;
        var h = bar.clientHeight;
        if (h < 8) return;
        var avail = Math.max(0, h - 4);
        /* Full EXCLUSIVE / 互斥 — compact stack centered on tall Four/Six rails (no stretch) */
        var maxFs = n <= 2 ? 14 : n >= 9 ? 11 : 12;
        var fs = Math.max(6, Math.min(maxFs, Math.floor(avail / n)));
        bar.style.fontSize = fs + 'px';
        bar.style.justifyContent = 'center';
        bar.style.gap = n > 1 ? '1px' : '0';
      });
    });
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
    hoverPortalEl.className = 'tm-hover-card tm-hover-card--portal';
    hoverPortalEl.setAttribute('role', 'tooltip');
    hoverPortalEl.setAttribute('aria-hidden', 'true');
    hoverPortalEl.hidden = true;
    document.body.appendChild(hoverPortalEl);
    return hoverPortalEl;
  }

  function hideHoverPortal() {
    if (!hoverPortalEl) return;
    hoverPortalEl.classList.remove('tm-hover-card--open');
    hoverPortalEl.hidden = true;
    hoverPortalEl.style.left = '';
    hoverPortalEl.style.top = '';
    hoverPortalKey = null;
    document.querySelectorAll('.tm-hover-placed').forEach(function (tile) {
      tile.classList.remove(
        'tm-hover-below',
        'tm-hover-left',
        'tm-hover-right',
        'tm-hover-placed'
      );
      tile._tmHoverCard = null;
    });
  }

  function clearHoverPlacement(tile) {
    if (!tile) {
      hideHoverPortal();
      return;
    }
    tile.classList.remove(
      'tm-hover-below',
      'tm-hover-left',
      'tm-hover-right',
      'tm-hover-placed'
    );
    tile._tmHoverCard = null;
    if (hoverPortalEl) {
      hoverPortalEl.classList.remove('tm-hover-card--open');
      hoverPortalEl.hidden = true;
    }
    hoverPortalKey = null;
  }

  function hoverChromeTopInset(prefix) {
    var bottom = 4;
    var h = document.querySelector('.app-header');
    if (h) bottom = Math.max(bottom, h.getBoundingClientRect().bottom);
    var nav = document.getElementById('navTabsShell');
    if (nav && !nav.hasAttribute('hidden')) {
      bottom = Math.max(bottom, nav.getBoundingClientRect().bottom);
    }
    var tb = document.querySelector(prefix === 'dm' ? '.dm-toolbar' : '.tm-toolbar');
    var collapsed =
      prefix === 'dm'
        ? document.body.classList.contains('dm-filters-collapsed')
        : document.body.classList.contains('tm-filters-collapsed');
    if (tb && !collapsed) {
      var tbr = tb.getBoundingClientRect();
      if (tbr.height > 2) bottom = Math.max(bottom, tbr.bottom);
    }
    var head = document.querySelector(prefix === 'dm' ? '.dm-sticky-head' : '.tm-sticky-head');
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
    var row = tile.closest('.tm-row');
    var tagId = row && row.getAttribute('data-tag-id');
    var card = ensureHoverPortal();
    if (hoverPortalKey !== key) {
      card.innerHTML = hoverCardInnerHtml(item, kind, tagId);
      hoverPortalKey = key;
      /* Remeasure after Limited / terrain images load — tall cards were clipped. */
      card.querySelectorAll('img').forEach(function (img) {
        if (img.complete) return;
        img.addEventListener(
          'load',
          function () {
            if (tile.classList.contains('tm-hover-placed') && hoverPortalKey === key) {
              placeHoverCard(tile);
            }
          },
          { once: true }
        );
      });
    }
    document.querySelectorAll('.tm-hover-placed').forEach(function (prev) {
      if (prev !== tile) {
        prev.classList.remove(
          'tm-hover-below',
          'tm-hover-left',
          'tm-hover-right',
          'tm-hover-placed'
        );
        prev._tmHoverCard = null;
      }
    });
    tile._tmHoverCard = card;
    card.hidden = false;
    card.classList.add('tm-hover-card--open');
    var tr = tile.getBoundingClientRect();
    var cw = card.offsetWidth || 150;
    var ch = card.offsetHeight || 120;
    var gap = 6;
    var topMin = hoverChromeTopInset('tm');
    var preferBelow = tr.top < topMin + ch + gap + 8;
    var top = preferBelow ? tr.bottom + gap : tr.top - ch - gap;
    var left = tr.left + tr.width / 2 - cw / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - cw - 4));
    top = Math.max(topMin, Math.min(top, window.innerHeight - ch - 4));
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
    if (preferBelow) tile.classList.add('tm-hover-below');
    else tile.classList.remove('tm-hover-below');
    tile.classList.add('tm-hover-placed');
  }

  function bindBoardInteractions(board) {
    if (!board) return;
    var wrap = document.querySelector('.tm-board-wrap');
    if (!board._tmHoverBound) {
      board._tmHoverBound = 1;
      board.addEventListener(
        'pointerenter',
        function (ev) {
          if (isTouchUi()) return;
          var tile = ev.target.closest('.tm-tile');
          if (!tile || !board.contains(tile)) return;
          placeHoverCard(tile);
        },
        true
      );
      board.addEventListener(
        'pointerleave',
        function (ev) {
          if (isTouchUi()) return;
          var tile = ev.target.closest('.tm-tile');
          if (!tile || !board.contains(tile)) return;
          var to = ev.relatedTarget;
          if (to && (tile.contains(to) || (hoverPortalEl && hoverPortalEl.contains(to)))) return;
          clearHoverPlacement(tile);
        },
        true
      );
      /* Mobile:
         - Squad mode: tap unit toggles selection (toolbar toggle)
         - Otherwise: let .tm-ft-hit navigate same-tab → SPA detail overlay; Back returns to /tm */
      board.addEventListener(
        'click',
        function (ev) {
          if (!isTouchUi()) return;
          var tile = ev.target.closest('.tm-tile');
          if (!tile || !board.contains(tile)) return;
          var kind = tile.getAttribute('data-kind');
          if (kind === 'unit' && state.squadMode) {
            ev.preventDefault();
            var row = tile.closest('.tm-row');
            toggleSelect(
              tile.getAttribute('data-id'),
              row && row.getAttribute('data-tag-id')
            );
            hideHoverPortal();
            return;
          }
          /* Allow default navigation on .tm-ft-hit (same-tab /u or /s). */
        },
        true
      );
      if (wrap && !wrap._tmScrollHover) {
        wrap._tmScrollHover = 1;
        wrap.addEventListener(
          'scroll',
          function () {
            hideHoverPortal();
          },
          { passive: true }
        );
      }
      if (!window._tmHoverResize) {
        window._tmHoverResize = 1;
        window.addEventListener(
          'resize',
          function () {
            fitExclusiveRails();
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
      if (!window._tmTouchDismissHover) {
        window._tmTouchDismissHover = 1;
        document.addEventListener(
          'pointerdown',
          function (ev) {
            if (!isTouchUi()) return;
            if (!hoverPortalEl || hoverPortalEl.hidden) return;
            var t = ev.target;
            if (t.closest && t.closest('.tm-tile')) return;
            if (hoverPortalEl.contains(t)) return;
            hideHoverPortal();
          },
          true
        );
      }
    }
    if (!board._tmSelectBound) {
      board._tmSelectBound = 1;
      board.addEventListener('contextmenu', function (ev) {
        var tile = ev.target.closest('.tm-tile[data-kind="unit"]');
        if (!tile || !board.contains(tile)) return;
        ev.preventDefault();
        var row = tile.closest('.tm-row');
        toggleSelect(
          tile.getAttribute('data-id'),
          row && row.getAttribute('data-tag-id')
        );
      });
    }
  }

  function syncPageFlags() {
    var page = document.body;
    page.classList.add('tm-exclusive-on');
    page.classList.remove('tm-hide-supports');
    var on = !!window.__GGEN_DESIGN_15__;
    page.classList.toggle('tm-15', on);
    page.classList.toggle('tm-classic', !on);
  }

  /* Kept for resize hooks; chrome is in-flow again (no fixed landscape pad). */
  function syncFixedChrome() {
    /* no-op — landscape no longer uses --tm-fixed-chrome-h margin */
  }

  /*
    Auto-hide Tag Matrix chrome (nav tabs + filters) while scrolling the board.
    Brand header stays. Reveal only near top or after a strong upward swipe.
    Works for both portrait and landscape (board-wrap is the scroller).
  */
  function setFiltersCollapsed(collapsed) {
    document.body.classList.toggle('tm-filters-collapsed', !!collapsed);
  }

  function filtersHaveFocus() {
    var toolbar = document.querySelector('.tm-toolbar');
    if (!toolbar) return false;
    var ae = document.activeElement;
    return !!(ae && toolbar.contains(ae));
  }

  /*
    Forward wheel/touch from chrome onto .tm-board-wrap.
    Board itself uses native scroll — do not intercept.
  */
  function bindBoardVerticalScroll() {
    var wrap = document.querySelector('.tm-board-wrap');
    var main = document.querySelector('.tm-main');
    if (!wrap || wrap._tmVertScroll) return;
    wrap._tmVertScroll = 1;

    function maxScroll() {
      return Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    }

    /* 1:1 apply — no artificial momentum (tiny incremental steps). */
    function applyDy(dy) {
      if (!dy) return false;
      var max = maxScroll();
      if (max <= 2) return false;
      wrap.scrollTop = Math.max(0, Math.min(max, wrap.scrollTop + dy));
      return true;
    }

    function isNavStrip(el) {
      return !!(el && el.closest && el.closest('#navTabs, .nav-tabs, .nav-tabs-shell, .nav-tabs-edge-hint'));
    }

    function isEditable(el) {
      return !!(
        el &&
        el.closest &&
        el.closest('input, textarea, select, [contenteditable="true"], .lang-dropdown')
      );
    }

    function onBoard(el) {
      return !!(el && el.closest && el.closest('.tm-board-wrap'));
    }

    function shouldForwardVerticalWheel(ev) {
      if (!document.body.classList.contains('tm-page')) return false;
      if (isEditable(ev.target)) return false;
      if (isNavStrip(ev.target)) return false;
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

    /* Touch pan on toolbar / sticky head / margins → board (board itself stays native) */
    var touch = null;
    function touchOnBoard(el) {
      return onBoard(el);
    }

    function touchBlocked(el) {
      if (!el || !el.closest) return true;
      if (isNavStrip(el)) return true;
      if (isEditable(el)) return true;
      if (el.closest('button, a, .tm-chip, .tm-role-btn, .tm-rarity-btn, .tm-squad-btn')) return true;
      if (el.closest('.app-header .header-controls, .header-15-slot')) return true;
      return false;
    }

    document.addEventListener(
      'touchstart',
      function (ev) {
        if (!document.body.classList.contains('tm-page')) return;
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

    /* Keep main chrome from becoming a competing scrollport */
    if (main) {
      main.style.touchAction = 'pan-y';
    }
  }

  function bindFiltersAutoHide() {
    var wrap = document.querySelector('.tm-board-wrap');
    if (!wrap || wrap._tmFiltersAutoHide) return;
    wrap._tmFiltersAutoHide = 1;

    var lastY = wrap.scrollTop || 0;
    var upAccum = 0;
    var ignoreUntil = 0;
    var HIDE_AFTER = 10;
    var REVEAL_UP = 400; /* match /u aggressiveness */
    var TOP_SHOW = 12;

    function boardCanScroll() {
      return wrap.scrollHeight > wrap.clientHeight + 24;
    }

    function setCollapsed(collapsed) {
      var want = !!collapsed;
      if (document.body.classList.contains('tm-filters-collapsed') === want) return;
      setFiltersCollapsed(want);
      ignoreUntil = Date.now() + 320;
    }

    function onScroll() {
      var y = wrap.scrollTop || 0;
      var canScroll = boardCanScroll();
      if (y <= TOP_SHOW) {
        upAccum = 0;
        lastY = y;
        /*
          Expand chrome only when the board still overflows after expand.
          Otherwise focus-mode (few rows) loops: collapse → content fits →
          scrollTop clamped to 0 → expand → overflows → bounce forever.
        */
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

    var toolbar = document.querySelector('.tm-toolbar');
    if (toolbar && !toolbar._tmFiltersFocus) {
      toolbar._tmFiltersFocus = 1;
      toolbar.addEventListener(
        'focusin',
        function () {
          setCollapsed(false);
        },
        true
      );
    }
  }

  function syncRotateHint() {
    var el = document.getElementById('tmRotateHint');
    if (!el) return;
    var narrow = false;
    var portrait = false;
    try {
      narrow = window.matchMedia('(max-width: 900px)').matches;
      portrait = window.matchMedia('(orientation: portrait)').matches;
    } catch (_) {
      narrow = window.innerWidth <= 900;
      portrait = window.innerHeight >= window.innerWidth;
    }
    var show = narrow && portrait;
    el.hidden = !show;
    el.setAttribute('aria-hidden', show ? 'false' : 'true');
    document.body.classList.toggle('tm-portrait-hint', show);
    syncFixedChrome();
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
    document.querySelectorAll('#navTabs a.nav-tab[href]').forEach(function (a) {
      var path = String(a.getAttribute('href') || '').split('?')[0].replace(/\/+$/, '') || '/';
      var key = map[path];
      if (!key) return;
      var lab = a.querySelector('.nav-tab-label');
      if (lab) lab.textContent = t(key);
    });
    var tabs = document.getElementById('navTabs');
    if (tabs) tabs.setAttribute('aria-label', t('navSection'));
  }

  function applyCopy() {
    var map = [
      ['tmEyebrow', 'eyebrow'],
      ['tmTitle', 'title'],
      ['tmSub', 'sub'],
      ['tmNote', 'note'],
      ['tmGroupLbl', 'group'],
      ['tmRoleLbl', 'role'],
      ['tmRarityLbl', 'rarity'],
      ['tmChipFour', 'four'],
      ['tmChipSix', 'six'],
      ['tmChipNew', 'new'],
      ['tmChipOther', 'other'],
      ['tmChipSeries', 'series'],
      ['tmRoleAll', 'all'],
      ['tmLegFour', 'legFour'],
      ['tmLegSix', 'legSix'],
      ['tmLegNew', 'legNew'],
      ['tmFoot', 'foot'],
      ['tmRotateCopy', 'rotateHint']
    ];
    map.forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.textContent = t(pair[1]);
    });
    applyNavTabLabels();
    syncSquadUi();
    var rot = document.getElementById('tmRotateHint');
    if (rot) rot.setAttribute('aria-label', t('rotateHintAria'));
    var phone = document.querySelector('.tm-rotate-phone');
    if (phone) phone.src = cdnPath(ROTATE_PHONE);
    document.querySelectorAll('.tm-rotate-arrow').forEach(function (img) {
      img.src = cdnPath(ROTATE_ARROW);
    });
    var search = document.getElementById('tmSearch');
    if (search) {
      search.placeholder = t('searchPh');
      search.setAttribute('aria-label', t('searchPh'));
      search.title = t('searchHint');
    }
    var hint = document.getElementById('tmSearchHint');
    if (hint) hint.textContent = t('searchHint');
    var groupNav = document.getElementById('tmGroupTabs');
    if (groupNav) groupNav.setAttribute('aria-label', t('group'));
    syncGroupActive();
    var roleNav = document.getElementById('tmRoleTabs');
    if (roleNav) roleNav.setAttribute('aria-label', t('role'));
    var rarityNav = document.getElementById('tmRarityTabs');
    if (rarityNav) rarityNav.setAttribute('aria-label', t('rarity'));
    [
      ['tmRarityAll', 'all'],
      ['tmRarityUr', 'ur'],
      ['tmRaritySsr', 'ssrPlus'],
      ['tmRaritySsrMinus', 'ssrMinus']
    ].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      var label = t(pair[1]);
      el.title = label;
      el.setAttribute('aria-label', label);
    });
    var toolbar = document.querySelector('.tm-toolbar');
    if (toolbar) toolbar.setAttribute('aria-label', t('filters'));
    [
      ['1', 'roleAtk'],
      ['3', 'roleSup'],
      ['2', 'roleDur']
    ].forEach(function (pair) {
      var btn = document.querySelector('#tmRoleTabs [data-role="' + pair[0] + '"]');
      if (!btn) return;
      var label = t(pair[1]);
      btn.title = label;
      btn.setAttribute('aria-label', label);
    });
    var pageTitle = t('title') + ' — GGen Eternal Database';
    try {
      document.title = pageTitle;
    } catch (_) {}
    fillRarityChipIcons();
    syncRarityActive();
  }

  function syncHtmlLang(L) {
    var map = { EN: 'en', JA: 'ja', TW: 'zh-Hant-TW', HK: 'zh-Hant-HK' };
    var code = map[L] || 'en';
    document.documentElement.setAttribute('lang', code);
    document.documentElement.setAttribute('data-ui-lang', L);
  }

  function rarityIconsHtml(keys) {
    return (keys || [])
      .map(function (k) {
        var src = RARITY_FILTER_ICONS[k];
        if (!src) return '';
        return (
          '<img class="filter-inline-icon rarity-filter-chip" src="' +
          escAttr(cdnPath(src)) +
          '" alt="" role="presentation">'
        );
      })
      .join('');
  }

  function fillRarityChipIcons() {
    document.querySelectorAll('#tmRarityTabs [data-icons]').forEach(function (el) {
      var key = el.getAttribute('data-icons');
      el.innerHTML = rarityIconsHtml(RARITY_PRESET_ICONS[key] || []);
    });
  }

  function syncRarityActive() {
    var root = document.getElementById('tmRarityTabs');
    if (!root) return;
    root.querySelectorAll('[data-rarity]').forEach(function (el) {
      var on = el.getAttribute('data-rarity') === state.rarity;
      el.classList.toggle('is-active', on);
      if (el.getAttribute('role') === 'tab') el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  async function loadMatrix() {
    var seq = ++loadSeq;
    var st = document.getElementById('tmStatus');
    if (st) st.textContent = t('loading');
    var lang = state.lang;
    if (cacheByLang[lang] && cacheByLang[lang].length) {
      rows = cacheByLang[lang];
      rebuildItemIndex();
      renderBoard();
      /* Soft refresh in background so HTTP 304 / CDN cache can win */
    }
    try {
      var res = await fetch(
        '/api/tag_matrix?lang=' + encodeURIComponent(lang) + '&sv=' + API_SV,
        { credentials: 'same-origin' }
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (seq !== loadSeq) return;
      rows = Array.isArray(data.rows) ? data.rows : [];
      cacheByLang[lang] = rows;
      matrixPayload = data;
      rebuildItemIndex();
      renderBoard();
    } catch (e) {
      if (seq !== loadSeq) return;
      rows = cacheByLang[lang] || [];
      rebuildItemIndex();
      if (st) st.textContent = t('err');
      renderBoard();
    }
  }

  function setLang(L) {
    L = String(L || 'EN').toUpperCase();
    if (L === 'JP') L = 'JA';
    if (L !== 'EN' && L !== 'JA' && L !== 'TW' && L !== 'HK') L = 'EN';
    state.lang = L;
    try {
      localStorage.setItem(STORAGE_LANG, L);
    } catch (_) {}
    syncHtmlLang(L);
    try {
      if (typeof window.__ggenInjectBrandFonts === 'function') {
        window.__ggenInjectBrandFonts();
      }
    } catch (_) {}
    var lbl = document.getElementById('tmLangLabel');
    if (lbl) lbl.textContent = L;
    applyCopy();
    loadMatrix();
  }

  function bindChips(root, attr, onPick) {
    if (!root) return;
    root.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[' + attr + ']');
      if (!btn || !root.contains(btn)) return;
      root.querySelectorAll('[' + attr + ']').forEach(function (el) {
        el.classList.toggle('is-active', el === btn);
        if (el.getAttribute('role') === 'tab') {
          el.setAttribute('aria-selected', el === btn ? 'true' : 'false');
        }
      });
      onPick(btn.getAttribute(attr));
    });
  }

  function bindLang() {
    var btn = document.getElementById('tmLangBtn');
    var dd = document.getElementById('tmLangDropdown');
    if (!btn || !dd || btn._tmLangBound) return;
    btn._tmLangBound = 1;
    function closeDd() {
      dd.classList.remove('active');
      dd.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('tm-lang-open');
    }
    function openDd() {
      dd.classList.add('active');
      dd.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
      document.body.classList.add('tm-lang-open');
    }
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (dd.classList.contains('active')) closeDd();
      else openDd();
    });
    dd.addEventListener('click', function (ev) {
      var opt = ev.target.closest('[data-lang]');
      if (!opt) return;
      setLang(opt.getAttribute('data-lang'));
      closeDd();
    });
    document.addEventListener('click', function (ev) {
      if (ev.target.closest('.lang-selector')) return;
      closeDd();
    });
  }

  function patchGgen15BodyClass() {
    var obs = new MutationObserver(function () {
      syncPageFlags();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    document.querySelectorAll('.header-15-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setTimeout(syncPageFlags, 0);
      });
    });
  }

  function init() {
    state.lang = readLang();
    syncHtmlLang(state.lang);
    try {
      if (typeof window.__ggenInjectBrandFonts === 'function') {
        window.__ggenInjectBrandFonts();
      }
    } catch (_) {}
    var lbl = document.getElementById('tmLangLabel');
    if (lbl) lbl.textContent = state.lang;
    applyCopy();

    bindLang();
    var groupTabs = document.getElementById('tmGroupTabs');
    if (groupTabs && !groupTabs._tmGroupBound) {
      groupTabs._tmGroupBound = 1;
      groupTabs.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-group]');
        if (!btn || !groupTabs.contains(btn)) return;
        toggleGroup(btn.getAttribute('data-group'));
      });
    }
    syncGroupActive();
    bindChips(document.getElementById('tmRoleTabs'), 'data-role', function (r) {
      state.role = r || 'ALL';
      renderBoard();
    });
    bindChips(document.getElementById('tmRarityTabs'), 'data-rarity', function (r) {
      state.rarity = r || 'ALL';
      syncRarityActive();
      renderBoard();
    });
    fillRarityChipIcons();
    syncRarityActive();

    var squadBtn = document.getElementById('tmSquadToggle');
    if (squadBtn && !squadBtn._tmBound) {
      squadBtn._tmBound = 1;
      squadBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        setSquadMode(!state.squadMode);
      });
    }
    var squadClear = document.getElementById('tmSquadClear');
    if (squadClear && !squadClear._tmBound) {
      squadClear._tmBound = 1;
      squadClear.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (selectedCount()) clearSelection();
        else setSquadMode(false);
      });
    }
    syncSquadUi();

    var search = document.getElementById('tmSearch');
    if (search) {
      search.addEventListener('input', function () {
        state.search = search.value || '';
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(function () {
          searchDebounceTimer = null;
          renderBoard();
        }, 120);
      });
    }

    patchGgen15BodyClass();
    applyCopy();
    syncRotateHint();
    syncFixedChrome();
    bindFiltersAutoHide();
    bindBoardVerticalScroll();
    if (!window._tmChromeResize) {
      window._tmChromeResize = 1;
      window.addEventListener(
        'resize',
        function () {
          syncFixedChrome();
        },
        { passive: true }
      );
      window.addEventListener(
        'orientationchange',
        function () {
          setFiltersCollapsed(false);
          setTimeout(syncFixedChrome, 50);
          setTimeout(syncFixedChrome, 250);
        },
        { passive: true }
      );
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          syncFixedChrome();
        }).catch(function () {});
      }
    }
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        hideHoverPortal();
        if (state.squadMode && !selectedCount()) setSquadMode(false);
        else clearSelection();
      }
    });
    Promise.resolve(loadMatrix()).then(function () {
      syncFixedChrome();
    }).catch(function () {
      syncFixedChrome();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
