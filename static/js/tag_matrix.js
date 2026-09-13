/**
 * Tag Matrix — live board with framed thumbs, support skill kinds, hover cards.
 */
(function () {
  'use strict';

  var STORAGE_LANG = 'ggen_lang';
  var cacheByLang = {};
  var rows = [];
  var loadSeq = 0;

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
    group: 'all',
    role: 'ALL',
    rarity: 'UR',
    exclusive: true,
    search: '',
    selectedIds: {},
    /* First right-click unit + its tag — Object.keys order is NOT click order for numeric ids. */
    anchorUnitId: null,
    anchorTagId: null
  };

  /* In-memory payload + O(1) hover lookup (avoid baking hover HTML into every tile). */
  var matrixPayload = null;
  var itemByKey = Object.create(null);
  var searchDebounceTimer = null;
  var hoverPortalEl = null;
  var hoverPortalKey = null;
  var EAGER_THUMB_BUDGET = 24;

  var I18N = {
    EN: {
      nav: 'Tag Matrix',
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
      searchHint: 'Filters tag rows only — not unit names. Matches any locale name / id / alias.',
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
      statusFocus: 'Focus {k} · {n} tags · Esc clears · right-click to multi-select',
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
      limited: 'Limited'
    },
    JA: {
      nav: 'タグ対応表',
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
      searchHint: 'タグ行のみ絞り込み（ユニット名ではない）。全言語名／ID／別名。',
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
      statusFocus: 'フォーカス {k} · {n} タグ · Escで解除 · 右クリックで複数選択',
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
      limited: '期間限定'
    },
    TW: {
      nav: '標籤對照表',
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
      searchHint: '只篩選標籤列，不是單位名稱。可用各語名稱／ID／別名。',
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
      statusFocus: '焦點 {k} · {n} 標籤 · Esc 清除 · 右鍵多選',
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
      limited: '期間限定'
    },
    HK: {
      nav: '標籤對照表',
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
      searchHint: '只篩選標籤列，不是單位名稱。可用各語名稱／ID／別名。',
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
      statusFocus: '焦點 {k} · {n} 標籤 · Esc 清除 · 右鍵多選',
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
      limited: '期間限定'
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

  function limitedBadgeHtml(kind) {
    var cls = kind === 'supporter' ? 'tm-lim--supp' : 'tm-lim--unit';
    return (
      '<div class="tm-lim ' +
      cls +
      '" aria-hidden="true"><span class="tm-lim-inner">' +
      esc(t('limited')) +
      '</span></div>'
    );
  }

  function framedThumbHtml(item, kind, size, opts) {
    opts = opts || {};
    var rarity = String(item.rarity || 'N').toUpperCase();
    if (!RARITY_BASE[rarity]) rarity = 'N';
    var isSupp = kind === 'supporter';
    var sz = size || 33;
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
      item.is_limited_time && !opts.skipLimBadge ? limitedBadgeHtml(kind) : '';
    var icons = '';
    if (!isSupp && item.is_ultimate) {
      icons +=
        '<span class="tm-ft-ic"><img src="' +
        escAttr(cdnPath(ULT_ICON)) +
        '" alt="ULT" loading="lazy"></span>';
    }
    if (item.acquisition_icon) {
      icons +=
        '<span class="tm-ft-ic"><img src="' +
        escAttr(cdnPath(item.acquisition_icon)) +
        '" alt="" loading="lazy"></span>';
    }
    var iconsWrap = icons ? '<span class="tm-ft-icons">' + icons + '</span>' : '';
    var hit =
      '<a class="tm-ft-hit" href="' +
      escAttr(href) +
      '" target="_blank" rel="noopener" aria-label="' +
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

  function hoverCardInnerHtml(item, kind) {
    var limBar = item.is_limited_time ? limitedBadgeHtml(kind) : '';
    var thumb = framedThumbHtml(item, kind, 56, { skipLimBadge: true, eager: true });
    var metaBits = [];
    if (item.rarity) metaBits.push(esc(item.rarity));
    if (item.is_ultimate) metaBits.push('ULT');
    var skills = '';
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
      var uStrip = '';
      if (item.is_ultimate) {
        uStrip +=
          '<span class="tm-hover-skill"><img src="' +
          escAttr(cdnPath(ULT_ICON)) +
          '" alt="ULT"></span>';
      }
      if (item.acquisition_icon) {
        uStrip +=
          '<span class="tm-hover-skill"><img src="' +
          escAttr(cdnPath(item.acquisition_icon)) +
          '" alt=""></span>';
      }
      if (uStrip) skills = '<div class="tm-hover-skills">' + uStrip + '</div>';
    }
    return (
      '<div class="tm-hover-thumb">' +
      limBar +
      thumb +
      '</div>' +
      '<div class="tm-hover-name">' +
      esc(item.name || '') +
      '</div>' +
      skills +
      (metaBits.length
        ? '<div class="tm-hover-meta">' + metaBits.join(' · ') + '</div>'
        : '')
    );
  }

  function rebuildItemIndex() {
    itemByKey = Object.create(null);
    rows.forEach(function (row) {
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
    renderBoard();
  }

  function clearSelection() {
    if (!selectedCount()) return;
    state.selectedIds = {};
    state.anchorTagId = null;
    state.anchorUnitId = null;
    renderBoard();
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

  /* True when this tag row lists every currently selected unit. */
  function rowHasAllSelectedUnits(row) {
    var ids = Object.keys(state.selectedIds);
    if (!ids.length) return false;
    for (var i = 0; i < ids.length; i++) {
      if (!rowHasUnitId(row, ids[i])) return false;
    }
    return true;
  }

  /* Some tag row (anywhere in catalog) contains every selected unit → shared supporters. */
  function selectionSharesSupporters() {
    if (selectedCount() <= 1) return true;
    for (var i = 0; i < rows.length; i++) {
      if (rowHasAllSelectedUnits(rows[i])) return true;
    }
    return false;
  }

  /*
    Blue = sole pick, or multi-select that still shares at least one supporter row.
    Red = later picks when no tag row holds every selected unit (diverging supporters).
  */
  function selectTargetForUnit(unitId) {
    unitId = String(unitId || '');
    if (selectedCount() <= 1) return SELECT_TARGET_BLUE;
    if (selectionSharesSupporters()) return SELECT_TARGET_BLUE;
    if (unitId && unitId === String(state.anchorUnitId || '')) return SELECT_TARGET_BLUE;
    return SELECT_TARGET_RED;
  }

  function unitCellHtml(item, focusOn, eager) {
    var id = String(item.id || '');
    var sel = isSelected(id);
    var cls = 'tm-tile';
    if (sel) cls += ' tm-tile--selected';
    else if (focusOn) cls += ' tm-tile--dim';
    var target = sel
      ? '<img class="tm-select-target" src="' +
        escAttr(cdnPath(selectTargetForUnit(id))) +
        '" alt="" aria-hidden="true">'
      : '';
    return (
      '<span class="' +
      cls +
      '" data-kind="unit" data-id="' +
      escAttr(id) +
      '" data-item-key="u:' +
      escAttr(id) +
      '">' +
      framedThumbHtml(item, 'unit', 33, { eager: !!eager }) +
      target +
      '</span>'
    );
  }

  function suppCellHtml(item, focusOn, suppHit, eager) {
    var kind = resolveSkillKind(item);
    var cls = 'tm-tile tm-tile--supp';
    if (focusOn && suppHit) cls += ' tm-tile--supp-hit';
    else if (focusOn) cls += ' tm-tile--dim';
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
      '<span class="' +
      cls +
      '" data-kind="supporter" data-skill-kind="' +
      escAttr(kind) +
      '" data-id="' +
      escAttr(sid) +
      '" data-item-key="s:' +
      escAttr(sid) +
      '">' +
      '<span class="tm-supp-stack">' +
      framedThumbHtml(item, 'supporter', 33, { eager: !!eager }) +
      badge +
      '</span>' +
      '</span>'
    );
  }

  function supportsCellHtml(list, focusOn, suppHit, eagerBudget) {
    var items = filterList(list).slice().sort(function (a, b) {
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
      '<div class="tm-supp' +
      (focusOn && suppHit ? ' tm-supp--hit' : '') +
      '" role="cell"><div class="tm-chip-strip tm-chip-strip--supp">' +
      items
        .map(function (it) {
          return suppCellHtml(it, focusOn, suppHit, takeEager(eagerBudget));
        })
        .join('') +
      '</div></div>'
    );
  }

  function unitsHtml(list, focusOn, eagerBudget) {
    var items = filterList(list);
    if (!items.length) return '';
    return (
      '<div class="tm-chip-strip">' +
      items
        .map(function (it) {
          return unitCellHtml(it, focusOn, takeEager(eagerBudget));
        })
        .join('') +
      '</div>'
    );
  }

  function roleUnitsHtml(row, roleKey, focusOn, eagerBudget) {
    if (state.role !== 'ALL' && state.role !== roleKey) return '';
    return unitsHtml(row.units && row.units[roleKey], focusOn, eagerBudget);
  }

  function buildHeadHtml() {
    var html = '';
    html += '<div class="tm-head-rail" role="columnheader"></div>';
    html +=
      '<div class="tm-head-supp" role="columnheader">' + esc(t('headSupp')) + '</div>';
    html += '<div class="tm-head-tag" role="columnheader">' + esc(t('headTag')) + '</div>';
    html +=
      '<div class="tm-head-role tm-head-role--1" role="columnheader"><img src="' +
      roleIcon(1) +
      '" alt="">' +
      esc(t('headAtk')) +
      '</div>';
    html +=
      '<div class="tm-head-role tm-head-role--3" role="columnheader"><img src="' +
      roleIcon(3) +
      '" alt="">' +
      esc(t('headSup')) +
      '</div>';
    html +=
      '<div class="tm-head-role tm-head-role--2" role="columnheader"><img src="' +
      roleIcon(2) +
      '" alt="">' +
      esc(t('headDur')) +
      '</div>';
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

  function rowMatches(row) {
    if (state.group !== 'all' && row.group !== state.group) return false;
    var q = state.search.trim().toLowerCase();
    if (!q) return true;
    return rowSearchBlob(row).indexOf(q) >= 0;
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
      supports += filterList(row.supports).length;
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
      maxSupp = Math.max(maxSupp, filterList(row.supports || []).length);
    }
    /* At least 1fr so empty roles still leave a slim column */
    page.style.setProperty('--tm-fr-atk', Math.max(1, maxAtk) + 'fr');
    page.style.setProperty('--tm-fr-role-sup', Math.max(1, maxRoleSup) + 'fr');
    page.style.setProperty('--tm-fr-dur', Math.max(1, maxDur) + 'fr');
    /* Supports: prefer content, hard-cap so the board never spills */
    var suppSlot = 48;
    var suppW = Math.min(120, Math.max(52, (Math.min(maxSupp, 3) || 1) * suppSlot));
    page.style.setProperty('--tm-w-supp', suppW + 'px');
    page.style.setProperty('--tm-w-tag', state.lang === 'EN' ? '100px' : '112px');
  }

  function renderBoard() {
    var board = document.getElementById('tmBoard');
    var head = document.getElementById('tmStickyHead');
    if (!board) return;
    syncDensityClass();
    board.className = 'tm-board';
    if (state.role !== 'ALL') board.classList.add('tm-role-filter-' + state.role);
    document.body.classList.toggle('tm-focus-on', selectedCount() > 0);

    var focusOn = selectedCount() > 0;
    var visible = [];
    rows.forEach(function (row) {
      if (!rowMatches(row)) return;
      var rowHit = focusOn && rowHasSelectedUnit(row);
      if (focusOn && !rowHit) return;
      visible.push(row);
    });
    syncBoardColumnWidths(visible);

    if (head) head.innerHTML = buildHeadHtml();

    var excl = t('exclusiveLabel');
    var eagerBudget = { n: EAGER_THUMB_BUDGET };

    function renderRowInner(row, alt) {
      var rowHit = focusOn && rowHasSelectedUnit(row);
      var suppHit = focusOn && rowHasAllSelectedUnits(row);
      var h =
        '<div class="tm-row tm-row--no-rail' +
        (alt ? ' tm-row--alt' : '') +
        (rowHit ? ' tm-row--hit' : '') +
        (suppHit ? ' tm-row--supp-shared' : '') +
        '" role="row" data-group="' +
        escAttr(row.group) +
        '" data-tag-id="' +
        escAttr(row.id) +
        '">';
      h += supportsCellHtml(row.supports, focusOn, suppHit, eagerBudget);
      h +=
        '<div class="tm-tag-cell" role="cell"><span class="tm-tag-name">' +
        esc(row.name || row.id) +
        '</span></div>';
      h +=
        '<div class="tm-units tm-units--1" role="cell">' +
        roleUnitsHtml(row, '1', focusOn, eagerBudget) +
        '</div>';
      h +=
        '<div class="tm-units tm-units--3" role="cell">' +
        roleUnitsHtml(row, '3', focusOn, eagerBudget) +
        '</div>';
      h +=
        '<div class="tm-units tm-units--2" role="cell">' +
        roleUnitsHtml(row, '2', focusOn, eagerBudget) +
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

    var c = countVisible();
    if (!c.tags && state.search.trim()) {
      html +=
        '<div class="tm-empty-board" role="status">' + esc(t('noMatch')) + '</div>';
    } else     if (focusOn && !html) {
      html +=
        '<div class="tm-empty-board" role="status">' + esc(t('noMatch')) + '</div>';
    }

    hideHoverPortal();
    board.innerHTML = html;
    bindBoardInteractions(board);
    fitExclusiveRails();
    var st = document.getElementById('tmStatus');
    if (st) {
      if (focusOn) {
        st.textContent = t('statusFocus')
          .replace('{k}', String(selectedCount()))
          .replace('{n}', String(c.tags));
      } else {
        st.textContent = t('status')
          .replace('{n}', String(c.tags))
          .replace('{u}', String(c.units))
          .replace('{s}', String(c.supports));
      }
    }
    syncPageFlags();
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
        /* Fit full Exclusive / 互斥 into the rail height — never expand the row */
        var fs = Math.max(5, Math.min(n <= 2 ? 14 : 11, Math.floor(avail / n)));
        bar.style.fontSize = fs + 'px';
        bar.style.justifyContent =
          n * fs > avail * 0.88 ? 'space-between' : 'space-evenly';
      });
    });
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
    var tr = tile.getBoundingClientRect();
    var cw = card.offsetWidth || 150;
    var ch = card.offsetHeight || 120;
    var gap = 6;
    var preferBelow = tr.top < ch + 24;
    var top = preferBelow ? tr.bottom + gap : tr.top - ch - gap;
    var left = tr.left + tr.width / 2 - cw / 2;
    left = Math.max(4, Math.min(left, window.innerWidth - cw - 4));
    top = Math.max(4, Math.min(top, window.innerHeight - ch - 4));
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
    if (preferBelow) tile.classList.add('tm-hover-below');
    tile.classList.add('tm-hover-placed');
    card.classList.add('tm-hover-card--open');
  }

  function bindBoardInteractions(board) {
    if (!board) return;
    var wrap = document.querySelector('.tm-board-wrap');
    if (!board._tmHoverBound) {
      board._tmHoverBound = 1;
      board.addEventListener(
        'pointerenter',
        function (ev) {
          var tile = ev.target.closest('.tm-tile');
          if (!tile || !board.contains(tile)) return;
          placeHoverCard(tile);
        },
        true
      );
      board.addEventListener(
        'pointerleave',
        function (ev) {
          var tile = ev.target.closest('.tm-tile');
          if (!tile || !board.contains(tile)) return;
          var to = ev.relatedTarget;
          if (to && (tile.contains(to) || (hoverPortalEl && hoverPortalEl.contains(to)))) return;
          clearHoverPlacement(tile);
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
          },
          { passive: true }
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

  function applyCopy() {
    var map = [
      ['tmNavLabel', 'nav'],
      ['tmNavUnits', 'tabUnits'],
      ['tmNavSupporters', 'tabSupporters'],
      ['tmNavCollections', 'tabCollections'],
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
      ['tmFoot', 'foot']
    ];
    map.forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.textContent = t(pair[1]);
    });
    var search = document.getElementById('tmSearch');
    if (search) {
      search.placeholder = t('searchPh');
      search.setAttribute('aria-label', t('searchPh'));
      search.title = t('searchHint');
    }
    var hint = document.getElementById('tmSearchHint');
    if (hint) hint.textContent = t('searchHint');
    var allChip = document.querySelector('#tmGroupTabs [data-group="all"]');
    if (allChip) allChip.textContent = t('all');
    var groupNav = document.getElementById('tmGroupTabs');
    if (groupNav) groupNav.setAttribute('aria-label', t('group'));
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
        '/api/tag_matrix?lang=' + encodeURIComponent(lang) + '&sv=6',
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
    if (!btn || !dd) return;
    function closeDd() {
      dd.classList.remove('active');
      dd.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', 'false');
    }
    function openDd() {
      dd.classList.add('active');
      dd.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
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
    bindChips(document.getElementById('tmGroupTabs'), 'data-group', function (g) {
      state.group = g || 'all';
      renderBoard();
    });
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
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') clearSelection();
    });
    loadMatrix();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
