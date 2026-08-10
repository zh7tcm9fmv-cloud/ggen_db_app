/**
 * Investment Guide (/ig) UI strings.
 * Prefer official in-game terms from m_help / unit type labels:
 * Units, Characters, MAP Weapon, SP/SSP Conversion, Ultimate Units,
 * Eternal Road, Attack/Defense/Support Type, Vigor (JA: テンション), Tags/Series.
 */
(function (global) {
  'use strict';

  const ROLE = {
    EN: { Attack: 'Attack Type', Defense: 'Defense Type', Support: 'Support Type' },
    JA: { Attack: '攻撃型', Defense: '耐久型', Support: '支援型' },
    TW: { Attack: '攻擊型', Defense: '耐久型', Support: '支援型' },
    HK: { Attack: '攻擊型', Defense: '耐久型', Support: '支援型' },
  };

  const BUCKET = {
    EN: {
      recommended: 'Recommended',
      solid: 'Solid',
      situational: 'Situational',
      niche: 'Niche',
    },
    JA: {
      recommended: '推奨',
      solid: '堅実',
      situational: '状況次第',
      niche: 'ニッチ',
    },
    TW: {
      recommended: '推薦',
      solid: '穩健',
      situational: '看場合',
      niche: '小眾',
    },
    HK: {
      recommended: '推薦',
      solid: '穩健',
      situational: '睇場合',
      niche: '小眾',
    },
  };

  /** Shared page chrome — keys used by template data-i18n and JS t(). */
  const UI = {
    EN: {
      page_title: 'Investment Guide - GGen Eternal Database',
      brand_sub: 'Investment Guide',
      back_db: '← Database',
      preview_banner:
        'Friends preview · live at /IG, not in the main nav yet. Tell us what looks wrong.',
      preview_strong: 'Friends preview',
      hero_kicker: 'SP Conversion & SSP Conversion priorities',
      hero_title: 'Investment Guide',
      hero_lead:
        'Should you invest SP Conversion or SSP Conversion materials on this Unit or Character? Neutral shortlist buckets: Recommended, Solid, Situational, Niche. Not a damage calculator. Unit SP and SSP boards use separate weapon baselines.',
      buckets_aria: 'Shortlist buckets',
      scoring_title: 'How scoring works',
      scoring_loading: 'Loading…',
      known_limits: 'Known limits',
      letter_cutoffs: 'Letter cutoffs',
      search_ph: 'Search name or tag…',
      search_aria: 'Search',
      clear_search: 'Clear search',
      clear_filters: 'Clear',
      entity_aria: 'Entity',
      board_aria: 'Board',
      role_aria: 'Unit Types / Character Types',
      units: 'Units',
      characters: 'Characters',
      show_low_rarity_units: ' Show N/R/SR',
      show_low_rarity_chars: ' Show N/R',
      map_only: 'MAP Weapon only',
      sp_eligible_only: 'SP Conversion targets only (Ultimate Units stay)',
      all_sources: 'All sources',
      source_gacha: 'Units from Unit Assembly',
      source_event: 'Other',
      source_dev: 'Development Unit',
      no_tag_filter: 'No tag filter',
      no_er_filter: 'No Eternal Road Expert filter',
      er_filter_title: 'Eternal Road Expert',
      tag_filter_title: 'Tag',
      source_filter_title: 'Acquisition',
      stat_mob: 'MOB',
      stat_mob_full: 'Mobility',
      stat_atk: 'ATK',
      stat_def: 'DEF',
      stat_mov: 'MOV',
      foot:
        'This page is not affiliated with Bandai Namco Entertainment Inc. Scoring is a neutral point-sum guide; letters may not match other lists.',
      close: 'Close',
      loading: 'Loading…',
      showing: 'Showing {shown} of {total} · {board} · {role}',
      cohort_ultimate: ' · Ultimate Units use a separate grade scale',
      adv_note: ' · Ultimate Advantage on matching series tags',
      pilots_sp: 'Characters SP',
      sp_grades: 'SP Conversion grades',
      ultimate_grades: 'Ultimate Unit grades',
      buckets_label: 'Buckets',
      score_breakdown: 'Score breakdown',
      score_breakdown_sub: 'hover a bar for details',
      open_in_db: 'Open in database',
      total_pt: 'Total: {n} Pt',
      cohort_sp: 'SP Conversion scale',
      cohort_ult: 'Ultimate scale',
      peaks_ur_pilot: 'Peaks with UR Character',
      peaks_ur_pilot_tip:
        'Recommend Character is UR — peak kit often assumes that Character. Still usable with SSR affinity Characters.',
      adv_on: 'Advantage +{n} (tag match)',
      adv_off: 'Advantage +{n} in-series only',
      adv_chip: '+{n} Adv',
      recommend_ms: 'Recommended Units',
      recommend_ms_sub: 'A and up',
      recommend_ms_note:
        'Matched by ability tag/series gates and Character specialty{spec}. Defense Type Units skip the specialty check.',
      recommend_none: 'None on the current board.',
      recommend_sd:
        'SD Characters are permanently linked to their Unit and are not interchangeable; no recommendation list.',
      no_bucket: 'No Units in this bucket for current filters.',
      status_error: 'Could not load Investment Guide data.',
      guide_title: 'How Investment Guide scoring works',
      guide_intro:
        'Point-sum shortlist for SP Conversion / SSP Conversion investment on Units and Characters (Attack Type / Defense Type / Support Type). Units have separate SP and SSP boards; Characters use SP only. Criteria favor practical sortie tools (MAP Weapon, mobility follow-ups, weapon power) and a deep affinity Character pool over a single linked recommend. Minor Attack Type stats (HP, SSP EN) are upside-only — no floor punishment. Close letters still need a human look.',
      criteria_aria: 'Objective scoring criteria',
      applies_units: 'Units',
      applies_characters: 'Characters',
      lang_aria: 'Language',
    },
    JA: {
      page_title: '投資ガイド - GGen Eternal Database',
      brand_sub: '投資ガイド',
      back_db: '← データベース',
      preview_banner: 'フレンド向けプレビュー · /IG で公開中（メインナビ未掲載）。気になる点があれば教えてください。',
      preview_strong: 'フレンド向けプレビュー',
      hero_kicker: 'SP化・SSP化の優先度',
      hero_title: '投資ガイド',
      hero_lead:
        'このユニット／キャラクターに SP化・SSP化の素材を使うべきか？ 中立の候補区分：推奨・堅実・状況次第・ニッチ。ダメージ計算機ではありません。ユニットの SP / SSP 盤は武装基準が別です。',
      buckets_aria: '候補区分',
      scoring_title: 'スコアの仕組み',
      scoring_loading: '読み込み中…',
      known_limits: '既知の限界',
      letter_cutoffs: 'レター基準',
      search_ph: '名前またはタグで検索…',
      search_aria: '検索',
      clear_search: '検索をクリア',
      clear_filters: 'クリア',
      entity_aria: '対象',
      board_aria: 'ボード',
      role_aria: 'ユニットタイプ / キャラクタータイプ',
      units: 'ユニット',
      characters: 'キャラクター',
      show_low_rarity_units: ' N/R/SR を表示',
      show_low_rarity_chars: ' N/R を表示',
      map_only: 'MAP兵器のみ',
      sp_eligible_only: 'SP化対象のみ（アルティメットユニットは残す）',
      all_sources: 'すべての入手元',
      source_gacha: 'ユニット補給',
      source_event: 'その他',
      source_dev: '開発ユニット',
      no_tag_filter: 'タグフィルタなし',
      no_er_filter: 'エターナルロード Expert フィルタなし',
      er_filter_title: 'エターナルロード Expert',
      tag_filter_title: 'タグ',
      source_filter_title: '入手元',
      stat_mob: '機動力',
      stat_mob_full: '機動力',
      stat_atk: '攻撃力',
      stat_def: '防御力',
      stat_mov: '移動力',
      foot:
        '本ページはバンダイナムコエンターテインメント非公式です。スコアは中立の点加算ガイドであり、他リストの評価と一致しない場合があります。',
      close: '閉じる',
      loading: '読み込み中…',
      showing: '{shown} / {total} 件表示 · {board} · {role}',
      cohort_ultimate: ' · アルティメットユニットは別グレード表',
      adv_note: ' · シリーズ一致タグでアルティメットの Advantage を加算',
      pilots_sp: 'キャラクター SP',
      sp_grades: 'SP化グレード',
      ultimate_grades: 'アルティメットユニット グレード',
      buckets_label: '区分',
      score_breakdown: 'スコア内訳',
      score_breakdown_sub: 'バーにホバーで詳細',
      open_in_db: 'データベースで開く',
      total_pt: '合計: {n} Pt',
      cohort_sp: 'SP化スケール',
      cohort_ult: 'アルティメットスケール',
      peaks_ur_pilot: 'URキャラ前提が強い',
      peaks_ur_pilot_tip:
        '推奨キャラクターが UR — ピーク性能はそのキャラ前提が多いです。SSRアフィニティキャラでも運用可。',
      adv_on: 'Advantage +{n}（タグ一致）',
      adv_off: 'Advantage +{n}（シリーズ内のみ）',
      adv_chip: '+{n} Adv',
      recommend_ms: '推奨ユニット',
      recommend_ms_sub: 'A以上',
      recommend_ms_note:
        'アビリティのタグ／シリーズ条件とキャラクター適性で照合{spec}。耐久型ユニットは適性チェックを省略します。',
      recommend_none: '現在のボードに該当なし。',
      recommend_sd:
        'SDキャラクターはユニットと固定リンクのため入れ替え不可です。推奨リストはありません。',
      no_bucket: 'この区分に、現在のフィルタ条件のユニットはありません。',
      status_error: '投資ガイドデータを読み込めませんでした。',
      guide_title: '投資ガイドのスコアリング',
      guide_intro:
        'ユニット／キャラクター（攻撃型・耐久型・支援型）への SP化・SSP化投資の点加算ショートリストです。ユニットは SP / SSP 別ボード、キャラクターは SP のみ。MAP兵器・追加行動・武装威力など実戦向きの要素と、深いアフィニティ候補を重視します。',
      criteria_aria: '客観スコア基準',
      applies_units: 'ユニット',
      applies_characters: 'キャラクター',
      lang_aria: '言語',
    },
    TW: {
      page_title: '投資指南 - GGen Eternal Database',
      brand_sub: '投資指南',
      back_db: '← 資料庫',
      preview_banner: '好友預覽 · 已在 /IG 上線，尚未放入主選單。有問題請告訴我們。',
      preview_strong: '好友預覽',
      hero_kicker: 'SP化與 SSP化優先度',
      hero_title: '投資指南',
      hero_lead:
        '該不該把 SP化／SSP化素材投在這名單位或角色上？中立候選分桶：推薦、穩健、看場合、小眾。不是傷害計算器。單位的 SP／SSP 盤使用不同武裝基準。',
      buckets_aria: '候選分桶',
      scoring_title: '評分方式',
      scoring_loading: '載入中…',
      known_limits: '已知限制',
      letter_cutoffs: '字母門檻',
      search_ph: '搜尋名稱或標籤…',
      search_aria: '搜尋',
      clear_search: '清除搜尋',
      clear_filters: '清除',
      entity_aria: '對象',
      board_aria: '看板',
      role_aria: '單位類型 / 角色類型',
      units: '單位',
      characters: '角色',
      show_low_rarity_units: ' 顯示 N/R/SR',
      show_low_rarity_chars: ' 顯示 N/R',
      map_only: '僅 MAP兵器',
      sp_eligible_only: '僅 SP化對象（保留終極單位）',
      all_sources: '全部取得來源',
      source_gacha: '單位補給獲得單位',
      source_event: '其他',
      source_dev: '開發單位',
      no_tag_filter: '無標籤篩選',
      no_er_filter: '無永恆之路 Expert 篩選',
      er_filter_title: '永恆之路 Expert',
      tag_filter_title: '標籤',
      source_filter_title: '取得來源',
      stat_mob: '機動力',
      stat_mob_full: '機動力',
      stat_atk: '攻擊力',
      stat_def: '防禦力',
      stat_mov: '移動力',
      foot:
        '本頁非萬代南夢宮娛樂官方。評分為中立加分指南，字母等級可能與其他榜單不同。',
      close: '關閉',
      loading: '載入中…',
      showing: '顯示 {shown} / {total} · {board} · {role}',
      cohort_ultimate: ' · 終極單位使用另一套等級表',
      adv_note: ' · 系列相符標籤時套用終極單位 Advantage',
      pilots_sp: '角色 SP',
      sp_grades: 'SP化等級',
      ultimate_grades: '終極單位等級',
      buckets_label: '分桶',
      score_breakdown: '分數明細',
      score_breakdown_sub: '將游標移到長條可看詳情',
      open_in_db: '在資料庫開啟',
      total_pt: '合計：{n} Pt',
      cohort_sp: 'SP化量表',
      cohort_ult: '終極單位量表',
      peaks_ur_pilot: '偏 UR 角色',
      peaks_ur_pilot_tip:
        '推薦角色為 UR — 峰值常假設該角色。仍可用 SSR 親和角色。',
      adv_on: 'Advantage +{n}（標籤相符）',
      adv_off: 'Advantage +{n}（僅系列內）',
      adv_chip: '+{n} Adv',
      recommend_ms: '推薦單位',
      recommend_ms_sub: 'A 以上',
      recommend_ms_note:
        '依能力的標籤／系列條件與角色適性比對{spec}。耐久型單位略過適性檢查。',
      recommend_none: '目前看板沒有符合項目。',
      recommend_sd: 'SD 角色與單位永久綁定、不可互換，因此沒有推薦清單。',
      no_bucket: '此分桶在目前篩選下沒有單位。',
      status_error: '無法載入投資指南資料。',
      guide_title: '投資指南評分說明',
      guide_intro:
        '單位／角色（攻擊型／耐久型／支援型）的 SP化／SSP化投資加分清單。單位分 SP／SSP 看板，角色僅 SP。偏重 MAP兵器、追加行動、武裝威力，以及較深的親和角色池。',
      criteria_aria: '客觀評分條件',
      applies_units: '單位',
      applies_characters: '角色',
      lang_aria: '語言',
    },
    HK: {
      page_title: '投資指南 - GGen Eternal Database',
      brand_sub: '投資指南',
      back_db: '← 資料庫',
      preview_banner: '好友預覽 · 已在 /IG 上線，尚未放入主選單。有問題請話我哋知。',
      preview_strong: '好友預覽',
      hero_kicker: 'SP化同 SSP化優先度',
      hero_title: '投資指南',
      hero_lead:
        '應唔應該將 SP化／SSP化素材投喺呢個單位或角色？中立候選分桶：推薦、穩健、睇場合、小眾。唔係傷害計算器。單位嘅 SP／SSP 盤用唔同武裝基準。',
      buckets_aria: '候選分桶',
      scoring_title: '評分方式',
      scoring_loading: '載入中…',
      known_limits: '已知限制',
      letter_cutoffs: '字母門檻',
      search_ph: '搜尋名稱或標籤…',
      search_aria: '搜尋',
      clear_search: '清除搜尋',
      clear_filters: '清除',
      entity_aria: '對象',
      board_aria: '看板',
      role_aria: '單位類型 / 角色類型',
      units: '單位',
      characters: '角色',
      show_low_rarity_units: ' 顯示 N/R/SR',
      show_low_rarity_chars: ' 顯示 N/R',
      map_only: '只顯示 MAP兵器',
      sp_eligible_only: '只顯示 SP化對象（保留終極單位）',
      all_sources: '全部取得來源',
      source_gacha: '單位補給獲得單位',
      source_event: '其他',
      source_dev: '開發單位',
      no_tag_filter: '無標籤篩選',
      no_er_filter: '無永恆之路 Expert 篩選',
      er_filter_title: '永恆之路 Expert',
      tag_filter_title: '標籤',
      source_filter_title: '取得來源',
      stat_mob: '機動力',
      stat_mob_full: '機動力',
      stat_atk: '攻擊力',
      stat_def: '防禦力',
      stat_mov: '移動力',
      foot:
        '本頁非萬代南夢宮娛樂官方。評分為中立加分指南，字母等級可能同其他榜單唔一樣。',
      close: '關閉',
      loading: '載入中…',
      showing: '顯示 {shown} / {total} · {board} · {role}',
      cohort_ultimate: ' · 終極單位用另一套等級表',
      adv_note: ' · 系列相符標籤時套用終極單位 Advantage',
      pilots_sp: '角色 SP',
      sp_grades: 'SP化等級',
      ultimate_grades: '終極單位等級',
      buckets_label: '分桶',
      score_breakdown: '分數明細',
      score_breakdown_sub: '將游標移到長條可睇詳情',
      open_in_db: '喺資料庫開啟',
      total_pt: '合計：{n} Pt',
      cohort_sp: 'SP化量表',
      cohort_ult: '終極單位量表',
      peaks_ur_pilot: '偏 UR 角色',
      peaks_ur_pilot_tip:
        '推薦角色係 UR — 峰值多數假設嗰個角色。仍然可以用 SSR 親和角色。',
      adv_on: 'Advantage +{n}（標籤相符）',
      adv_off: 'Advantage +{n}（只限系列內）',
      adv_chip: '+{n} Adv',
      recommend_ms: '推薦單位',
      recommend_ms_sub: 'A 或以上',
      recommend_ms_note:
        '按能力嘅標籤／系列條件同角色適性比對{spec}。耐久型單位會略過適性檢查。',
      recommend_none: '而家看板冇符合項目。',
      recommend_sd: 'SD 角色同單位永久綁定、唔可互換，所以冇推薦清單。',
      no_bucket: '呢個分桶喺而家篩選下冇單位。',
      status_error: '載入唔到投資指南資料。',
      guide_title: '投資指南評分說明',
      guide_intro:
        '單位／角色（攻擊型／耐久型／支援型）嘅 SP化／SSP化投資加分清單。單位分 SP／SSP 看板，角色淨係 SP。偏重 MAP兵器、追加行動、武裝威力，同埋較深嘅親和角色池。',
      criteria_aria: '客觀評分條件',
      applies_units: '單位',
      applies_characters: '角色',
      lang_aria: '語言',
    },
  };

  /** Breakdown axis labels/tips — game terms where possible. */
  const BREAKDOWN = {
    EN: {
      tags: { label: 'Tag count', tip: 'Count of scored tags. Currently 0 — value is under Strategic tags.' },
      tags_strategic: {
        label: 'Strategic tags',
        tip: 'Bonus from tags that show up often on UR Units (especially limited). Cap applies.',
      },
      er_access: {
        label: 'Eternal Road Expert access',
        tip: 'How many Eternal Road Expert stages this Unit or Character can enter. Under 2 is −1; 2–4 is +1; 5+ is +2.',
      },
      terrain: {
        label: 'Terrain Capability',
        tip: 'Need Space plus Land or Atmospheric for neutral (0). Missing Space, or both Land and Atmospheric, is −3.',
      },
      rarity: {
        label: 'Rarity',
        tip: 'Units: N/R/SR are penalized vs SSR. Characters use a softer table. SSR and Ultimate Units start even. Non-Ultimate UR kits are omitted.',
      },
      transform: {
        label: 'Transform advantage',
        tip: 'Only when the alternate form unlocks Terrain Capability, higher MOV, longer range, higher weapon power, or a MAP Weapon.',
      },
      map: {
        label: 'MAP Weapon',
        tip: 'Any MAP Weapon +1. Dash/Moving Attack +1 more. Ammo 2+ and coverage add points. Attack Type up to +4; Defense/Support Type cap +2.',
      },
      abilities: {
        label: 'Unit Ability',
        tip: 'Role-relevant Unit Ability effects. Permanent plain stat ups with no condition score 0 here.',
      },
      skills_abilities: {
        label: 'Character Skills & Abilities',
        tip: 'Character Skills plus Character Abilities that help their type.',
      },
      series_affinity: {
        label: 'Series affinity',
        tip: 'Points for series / faction affinity abilities.',
      },
      recommend_ms: {
        label: 'Recommended Units',
        tip: 'Bonus from this Character’s best matching Unit letter on this guide (A / A+ / S / S+ only).',
      },
      linked_pilot: {
        label: 'Affinity Character pool',
        tip: 'How many same-type SSR+ Characters have piloting-tag / EX-pair affinity for this Unit.',
      },
      ur_pilot_dependence: {
        label: 'UR Character dependence',
        tip: 'Mild −1 when the Unit’s recommend Character is UR / Ultimate tier.',
      },
      max_tension_weapon: {
        label: 'Max Vigor weapon',
        tip: 'Strongest weapon is Max Vigor only (Vigor and MP gated) — mild penalty vs always-usable power.',
      },
      preemptive: { label: 'Preemptive Strike', tip: 'Weapon strikes first in the exchange.' },
      rare_debuff: { label: 'Rare range-down', tip: 'Weapon can cut enemy physical or beam range.' },
      extra_life: {
        label: 'Unbreakable',
        tip: 'Survives a lethal hit once (Unbreakable). Defense Type values this more.',
      },
      shield: {
        label: 'Shield',
        tip: 'Has a shield mechanism (~20% damage neglect). Defense Type Units lose points if they lack one.',
      },
      movement: {
        label: 'Move',
        tip: 'MOV 5 is the modern baseline. Defense Type still values high Move for Support Defense coverage.',
      },
      weapon_range: {
        label: 'Weapon range',
        tip: 'Longest non-MAP Weapon range. Support Type baseline is range 5.',
      },
      atk: { label: 'ATK', tip: 'SP-grown ATK for this type. Attack Type scores this heavily.' },
      def: { label: 'DEF', tip: 'SP-grown DEF. Scored for Defense Type (and lightly for Support Type).' },
      hp: {
        label: 'HP',
        tip: 'Attack/Support Type: upside-only. Defense Type still taxes low HP.',
      },
      en: {
        label: 'EN',
        tip: 'SSP Attack Type only — high EN upside. Not scored on SP.',
      },
      mob: {
        label: 'MOB',
        tip: 'Mobility (MOB). Affects Accuracy and Evasion. Scored from SP-grown MOB for this Unit Type — Support Type values it more; Attack Type treats it as a softer secondary vs ATK.',
      },
      source: {
        label: 'Acquisition',
        tip: 'How the Unit is obtained: Development Unit and Other get +1; Units from Unit Assembly stay 0.',
      },
      movement_followup: {
        label: 'Movement follow-up',
        tip: 'After-move MAP Weapon and/or Chance Step-style follow-up movement (can stack, capped).',
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
        tip: 'Strongest attack uses 2+ of Ranged/Melee/Awaken.',
      },
      signature_weapon: {
        label: 'Signature kit',
        tip: 'Allowlisted Lupus / Lupus Rex family bonus for their uniquely strong weapon kits.',
      },
      support_r4_debuffs: {
        label: 'Debuffs at range',
        tip: 'Defense/Support Type only. Distinct useful debuff kinds by weapon range.',
      },
      max_debuff: {
        label: 'Debuff strength',
        tip: 'Defense/Support Type only: lasting DEF-down % or instant pierce.',
      },
      stat_outlier: {
        label: 'Stat outlier',
        tip: 'Small niche bonus when a secondary stat is clearly exceptional for the type.',
      },
      special_defense: {
        label: 'Special defense',
        tip: 'Presence bonus for mitigation beyond the shield mechanism (damage taken down, barriers, negation).',
      },
      ranged: { label: 'Ranged', tip: 'Character Ranged after SP growth.' },
      melee: { label: 'Melee', tip: 'Character Melee after SP growth.' },
      awaken: { label: 'Awaken', tip: 'Character Awaken after SP growth.' },
      defense: { label: 'Defense', tip: 'Character Defense after SP growth.' },
      reaction: { label: 'Reaction', tip: 'Character Reaction after SP growth.' },
    },
    JA: {
      tags: { label: 'タグ数', tip: 'スコア対象タグ数。現状は常に 0 — 価値は戦略タグ側。' },
      tags_strategic: {
        label: '戦略タグ',
        tip: 'URユニット（特に限定）に多いタグへの加点。上限あり。',
      },
      er_access: {
        label: 'エターナルロード Expert 適性',
        tip: '出撃可能なエターナルロード Expert ステージ数。2未満 −1、2–4 +1、5以上 +2。',
      },
      terrain: {
        label: '地形適性',
        tip: '宇宙＋地上または空中で中立（0）。宇宙欠如、または地上と空中の両方欠如は −3。',
      },
      rarity: {
        label: 'レアリティ',
        tip: 'ユニット：N/R/SR は SSR より減点。キャラクターは緩め。SSR とアルティメットユニットは同起点。通常 UR は本ガイド対象外。',
      },
      transform: {
        label: '変形メリット',
        tip: '変形先が地形適性・MOV・射程・威力・MAP兵器のいずれかを解放する場合のみ加点。',
      },
      map: {
        label: 'MAP兵器',
        tip: 'MAP兵器あり +1。ダッシュ／移動攻撃さらに +1。弾数・範囲加点。攻撃型最大 +4、耐久／支援型は上限 +2。',
      },
      abilities: {
        label: 'ユニットアビリティ',
        tip: 'タイプに効くユニットアビリティ。無条件の単純ステータス上昇はここでは 0。',
      },
      skills_abilities: {
        label: 'キャラクタースキル・アビリティ',
        tip: 'キャラクタースキルと、タイプに効くキャラクターアビリティ。',
      },
      series_affinity: {
        label: 'シリーズアフィニティ',
        tip: 'シリーズ／勢力アフィニティアビリティの加点。',
      },
      recommend_ms: {
        label: '推奨ユニット',
        tip: 'このキャラクターに合う本ガイドのユニット評価（A / A+ / S / S+ のみ）。',
      },
      linked_pilot: {
        label: 'アフィニティキャラ候補',
        tip: '同タイプ SSR+ で、搭乗タグ／EXペア親和があるキャラクター数。',
      },
      ur_pilot_dependence: {
        label: 'URキャラ依存',
        tip: '推奨キャラクターが UR／アルティメット帯のとき軽い −1。',
      },
      max_tension_weapon: {
        label: '最大テンション武装',
        tip: '最強武装が最大テンション限定（テンションとMP条件）— 常時使える火力より軽い減点。',
      },
      preemptive: { label: '先制攻撃', tip: '交戦で先に攻撃する武装。' },
      rare_debuff: { label: '稀少レンジダウン', tip: '敵の実弾／ビーム射程を下げる武装効果。' },
      extra_life: {
        label: '不屈',
        tip: '致命打を一度耐える（不屈）。耐久型でより重視。',
      },
      shield: {
        label: 'シールド',
        tip: 'シールド機構（約20%ダメージ無効）。耐久型は無いと減点。',
      },
      movement: {
        label: '移動力',
        tip: 'MOV 5 が現代の基準。耐久型は援護防御の範囲のため高移動を評価。',
      },
      weapon_range: {
        label: '武装射程',
        tip: '非 MAP兵器の最大射程。支援型の基準は射程 5。',
      },
      atk: { label: '攻撃力', tip: 'SP成長後の攻撃力。攻撃型で大きく加点。' },
      def: { label: '防御力', tip: 'SP成長後の防御力。耐久型（支援型は軽め）で加点。' },
      hp: { label: 'HP', tip: '攻撃／支援型は上方のみ。耐久型は低 HP を減点。' },
      en: { label: 'EN', tip: 'SSP 攻撃型のみ — 高 EN を加点。SP 盤では非対象。' },
      mob: {
        label: '機動力',
        tip: '機動力は命中率・回避率に影響します。SP成長後の機動力を採点。支援型で重視、攻撃型では攻撃力より弱い副次。',
      },
      source: {
        label: '入手元',
        tip: '開発ユニット・その他は +1。ユニット補給は 0。',
      },
      movement_followup: {
        label: '追加行動・追撃移動',
        tip: '移動後MAP兵器やチャンスステップ系の追撃移動（重複可・上限あり）。',
      },
      weapon_power: {
        label: '武装威力',
        tip: 'この SP／SSP 盤の非 MAP 武装の最強 Lv5 威力。',
      },
      weapon_bonus: {
        label: '武装ボーナス',
        tip: '最強攻撃のみの条件ブースト。クリティカルダメージは軽め、クリティカル率は約20%+、確定クリティカルはより強い。',
      },
      dual_attack_attr: {
        label: '複合適性武装',
        tip: '最強攻撃が射撃／格闘／覚醒のうち2種以上。',
      },
      signature_weapon: {
        label: 'シグネチャキット',
        tip: 'バルバトスルプス／ルプスレクス系統の特別加点。',
      },
      support_r4_debuffs: {
        label: '射程内弱体',
        tip: '耐久／支援型のみ。有用な弱体の種類を射程条件で数える。',
      },
      max_debuff: {
        label: '弱体強度',
        tip: '耐久／支援型のみ：持続DEF低下％または即時貫通。',
      },
      stat_outlier: {
        label: 'ステ突出',
        tip: 'タイプの副次ステが突出しているときの軽い加点。',
      },
      special_defense: {
        label: '特殊防御',
        tip: 'シールド以外の軽減（被ダメージ減・バリア・無効化）の存在加点。',
      },
      ranged: { label: '射撃値', tip: 'SP成長後の射撃値。' },
      melee: { label: '格闘値', tip: 'SP成長後の格闘値。' },
      awaken: { label: '覚醒値', tip: 'SP成長後の覚醒値。' },
      defense: { label: '守備値', tip: 'SP成長後の守備値。' },
      reaction: { label: '反応値', tip: 'SP成長後の反応値。' },
    },
    TW: {
      tags: { label: '標籤數', tip: '計分標籤數。目前固定 0 — 價值改由戰略標籤處理。' },
      tags_strategic: {
        label: '戰略標籤',
        tip: '常出現在 UR 單位（尤其限定）上的標籤加分，有上限。',
      },
      er_access: {
        label: '永恆之路 Expert 適性',
        tip: '可出擊的永恆之路 Expert 關卡數。少於 2 −1；2–4 +1；5 以上 +2。',
      },
      terrain: {
        label: '地形適性',
        tip: '需宇宙＋地面或空中才為中立（0）。缺宇宙，或地面與空中皆缺為 −3。',
      },
      rarity: {
        label: '稀有度',
        tip: '單位：N/R/SR 相對 SSR 扣分。角色較寬鬆。SSR 與終極單位同起跑。一般 UR 不列入本指南。',
      },
      transform: {
        label: '變形優勢',
        tip: '僅在變形後解鎖地形適性、更高移動力、更長射程、更高威力或 MAP兵器 時加分。',
      },
      map: {
        label: 'MAP兵器',
        tip: '有 MAP兵器 +1。衝刺／移動攻擊再 +1。彈數與範圍加分。攻擊型最高 +4；耐久／支援型上限 +2。',
      },
      abilities: {
        label: '單位能力',
        tip: '對該類型有用的單位能力。無條件純數值提升此處為 0。',
      },
      skills_abilities: {
        label: '角色技能與能力',
        tip: '角色技能，以及對類型有幫助的角色能力。',
      },
      series_affinity: {
        label: '系列親和',
        tip: '系列／勢力親和能力加分。',
      },
      recommend_ms: {
        label: '推薦單位',
        tip: '此角色在本指南中最匹配的單位字母（僅 A / A+ / S / S+）。',
      },
      linked_pilot: {
        label: '親和角色池',
        tip: '同類型 SSR+，且具駕駛標籤／EX 配對親和的角色數。',
      },
      ur_pilot_dependence: {
        label: 'UR 角色依賴',
        tip: '單位推薦角色為 UR／終極單位帶時輕微 −1。',
      },
      max_tension_weapon: {
        label: '最大戰意武裝',
        tip: '最強武裝僅最大戰意可用（戰意與 MP 條件）— 相對常駐火力輕微扣分。',
      },
      preemptive: { label: '先制攻擊', tip: '交戰時先出手的武裝。' },
      rare_debuff: { label: '稀有射程下降', tip: '可降低敵方實彈或光束射程的武裝效果。' },
      extra_life: {
        label: '不屈',
        tip: '可承受一次致命傷害（不屈）。耐久型更看重。',
      },
      shield: {
        label: '護盾',
        tip: '具護盾機構（約 20% 傷害無視）。耐久型沒有會扣分。',
      },
      movement: {
        label: '移動力',
        tip: 'MOV 5 為現行基準。耐久型仍重視高移動以利援護防禦覆蓋。',
      },
      weapon_range: {
        label: '武裝射程',
        tip: '非 MAP兵器 的最長射程。支援型基準為射程 5。',
      },
      atk: { label: '攻擊力', tip: 'SP 成長後攻擊力。攻擊型權重高。' },
      def: { label: '防禦力', tip: 'SP 成長後防禦力。耐久型（支援型較輕）計分。' },
      hp: { label: 'HP', tip: '攻擊／支援型只加高不扣低。耐久型仍扣低 HP。' },
      en: { label: 'EN', tip: '僅 SSP 攻擊型 — 高 EN 加分。SP 盤不計。' },
      mob: {
        label: '機動力',
        tip: '機動力影響命中率及閃避率。依 SP 成長後機動力計分；支援型較重視，攻擊型相對攻擊力為較弱次要項。',
      },
      source: {
        label: '取得來源',
        tip: '開發單位與其他 +1；單位補給獲得單位為 0。',
      },
      movement_followup: {
        label: '追加行動／追擊移動',
        tip: '移動後 MAP兵器 與／或額外行動類追擊移動（可疊加、有上限）。',
      },
      weapon_power: {
        label: '武裝威力',
        tip: '此 SP／SSP 盤非 MAP 武裝的最強 Lv5 威力。',
      },
      weapon_bonus: {
        label: '武裝加成',
        tip: '僅最強攻擊的條件加成。爆擊損傷較輕；爆擊率約需 20%+；必定爆擊較強。',
      },
      dual_attack_attr: {
        label: '複合適性武裝',
        tip: '最強攻擊具備射擊／格鬥／覺醒中兩種以上。',
      },
      signature_weapon: {
        label: '招牌武裝套件',
        tip: '巴巴托斯狼王／狼王 Rex 系列特別加分。',
      },
      support_r4_debuffs: {
        label: '射程內弱化',
        tip: '僅耐久／支援型。依射程條件計算有用弱化種類。',
      },
      max_debuff: {
        label: '弱化強度',
        tip: '僅耐久／支援型：持續 DEF 下降％或即時貫穿。',
      },
      stat_outlier: {
        label: '數值突出',
        tip: '次要數值對該類型明顯突出時的輕微加分。',
      },
      special_defense: {
        label: '特殊防禦',
        tip: '護盾以外的減傷（受傷降低、屏障、無效化）存在加分。',
      },
      ranged: { label: '射擊值', tip: 'SP 成長後射擊值。' },
      melee: { label: '格鬥值', tip: 'SP 成長後格鬥值。' },
      awaken: { label: '覺醒值', tip: 'SP 成長後覺醒值。' },
      defense: { label: '守備值', tip: 'SP 成長後守備值。' },
      reaction: { label: '反應值', tip: 'SP 成長後反應值。' },
    },
  };
  BREAKDOWN.HK = Object.assign({}, BREAKDOWN.TW, {
    er_access: {
      label: '永恆之路 Expert 適性',
      tip: '可出擊嘅永恆之路 Expert 關卡數。少過 2 −1；2–4 +1；5 或以上 +2。',
    },
    map: {
      label: 'MAP兵器',
      tip: '有 MAP兵器 +1。衝刺／移動攻擊再 +1。彈數同範圍加分。攻擊型最高 +4；耐久／支援型上限 +2。',
    },
    mob: {
      label: '機動力',
      tip: '機動力影響命中率同閃避率。跟 SP 成長後機動力計分；支援型較睇重，攻擊型相對攻擊力係較弱次要項。',
    },
    source: {
      label: '取得來源',
      tip: '開發單位同其他 +1；單位補給獲得單位係 0。',
    },
  });

  function normLang(lang) {
    const k = String(lang || 'EN').toUpperCase();
    if (k === 'JP') return 'JA';
    if (k === 'JA' || k === 'TW' || k === 'HK' || k === 'EN') return k;
    return 'EN';
  }

  function t(lang, key, vars) {
    const lc = normLang(lang);
    const pack = UI[lc] || UI.EN;
    let s = pack[key];
    if (s == null) s = UI.EN[key];
    if (s == null) return key;
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((k) => {
        s = String(s).split(`{${k}}`).join(String(vars[k]));
      });
    }
    return s;
  }

  function tRole(lang, roleKey) {
    const lc = normLang(lang);
    const m = ROLE[lc] || ROLE.EN;
    return m[roleKey] || ROLE.EN[roleKey] || roleKey;
  }

  function tBucket(lang, key) {
    const lc = normLang(lang);
    const m = BUCKET[lc] || BUCKET.EN;
    return m[key] || BUCKET.EN[key] || key;
  }

  function breakdownMeta(lang, key) {
    const lc = normLang(lang);
    const pack = BREAKDOWN[lc] || BREAKDOWN.EN;
    return pack[key] || BREAKDOWN.EN[key] || null;
  }

  global.SpiI18n = {
    ROLE,
    BUCKET,
    UI,
    BREAKDOWN,
    normLang,
    t,
    tRole,
    tBucket,
    breakdownMeta,
  };
})(typeof window !== 'undefined' ? window : globalThis);
