/**
 * /profile — LANG-first Profile Insights (OCR → confirm → analyze)
 */
(function () {
  'use strict';

  /** Proof the browser loaded this file (not a cached old copy). */
  var PROFILE_JS_BUILD = '2026-10-16-parked-18';
  try {
    window.__PROFILE_JS_BUILD__ = PROFILE_JS_BUILD;
  } catch (_) {}

  var LANG_KEY = 'ggen_profile_ocr_lang';
  var CDN = (typeof window !== 'undefined' && window.__GGEN_IMAGE_CDN__) || '';
  var USE_CDN = !!(typeof window !== 'undefined' && window.__GGEN_GAME_IMAGES_USE_CDN__);

  var SLOT_KEYS = [
    'main',
    'units_1_10',
    'units_11_20',
    'chars_1_10',
    'chars_11_20',
    'haro',
    'battle'
  ];
  var SLOT_LABELS = {
    main: 'Profile · Main',
    units_1_10: 'Units #1–10',
    units_11_20: 'Units #11–20',
    chars_1_10: 'Characters #1–10',
    chars_11_20: 'Characters #11–20',
    haro: 'Haro Trophy',
    battle: 'Battle Results'
  };
  var CLOSE_ICON = '/static/images/UI/close-50.webp';
  /** RoleTypeIndex: 1 Attack (red), 2 Durability (blue), 3 Support (yellow) */
  var ROLE_LABEL = { '1': 'Attack', '2': 'Durability', '3': 'Support' };
  var ROLE_ICON = {
    '1': '/static/images/UI/UI_Common_TypeIcon_Attack_M.webp',
    '2': '/static/images/UI/UI_Common_TypeIcon_Defense_M.webp',
    '3': '/static/images/UI/UI_Common_TypeIcon_Support_M.webp'
  };

  var state = {
    lang: '',
    slots: {
      main: null,
      units_1_10: null,
      units_11_20: null,
      chars_1_10: null,
      chars_11_20: null,
      battle: [],
      haro: null
    },
    slotOcr: {
      main: '',
      units_1_10: '',
      units_11_20: '',
      chars_1_10: '',
      chars_11_20: '',
      battle: [],
      haro: ''
    },
    unsorted: [],
    snapshot: null,
    unitRows: [],
    charRows: [],
    mainMeta: null,
    battleResults: null,
    ocrEngine: null,
    topN: 20
  };

  function profileAsset(name) {
    return imgUrl('/static/images/UI/Profile/' + name);
  }

  var T = {
    EN: {
      status_need_lang: 'Select screenshot language first.',
      status_need_units: 'Need Sorties · Units #1–10 — place that shot in its slot.',
      status_inbox: 'Added {n} to inbox — assign each shot below.',
      status_placed: 'Assigned to {slot}.',
      status_ocr: 'Reading screenshots ({n})…',
      status_ocr_got: 'Reading Sorties (local experiment OCR)…',
      status_match: 'Matching names in {lang}…',
      status_ready: 'Confirm matches, then Analyze.',
      status_analyze: 'Analyzing…',
      status_done: 'Insights ready.',
      status_err: 'Error: {err}',
      status_wrong_screen:
        'Wrong shot for Units #1–10 — that looks like {kind}, not Profile → Sorties → Units.',
      status_ocr_weak:
        'OCR could not read unit names on Units #1–10. Use a sharp full-screen Sorties list (name + Sorties column visible).',
      slot_empty: 'No shot yet',
      assign_label: 'Assign to…',
      assign_placeholder: 'Choose category',
      inbox_title: 'Inbox — assign each shot',
      inbox_hint: 'Large preview so you can tell which screen it is. Pick a category, then confirm in Assigned.',
      assigned_title: 'Assigned — confirm before reading',
      assigned_hint: 'Only categories you picked appear here. Click preview to zoom. Change or remove if wrong.',
      up_title: 'Upload & assign screenshots',
      up_hint: 'Units #1–10 is required. Other categories only appear after you assign them.',
      flow1: 'Upload all Profile screenshots',
      flow2: 'Assign each shot (large preview) to a category',
      flow3: 'Confirm assigned previews, then Read screenshots',
      change_slot: 'Change category',
      remove_shot: 'Remove',
      slot_taken: 'That category already has a shot — replace it?',
      assign: 'Place in…',
      conc: 'Sorties concentration',
      conc_metric: '{pct}%',
      conc_of: 'of listed Sorties',
      conc_lead: 'Your #1–#3 units’ Sorties add up to {pct}% of the Sorties sum on your list ({sum} total across {n} units).',
      conc_formula: '(#1 + #2 + #3 Sorties) ÷ (sum of all {n} listed units’ Sorties)',
      conc_not: 'Not account Total Sorties from Battle Results.',
      conc_more: 'Top 5 · {t5}%   Top 10 · {t10}%   #1 alone · {t1}%',
      top3_tags: 'Tags on your listed units',
      tags: 'Most cross-referenced tags',
      tags_hint: 'Share of listed Sorties on units that carry each Tag (top 10 or 20 from your upload).',
      portrait_chars: 'Your characters',
      portrait_chars_sub: 'Active Skills, Abilities, and Series weighted by Sorties.',
      top_abilities: 'Top Abilities',
      top_skills: 'Top Active Skills',
      top_skill_families: 'Skill families',
      top_char_series: 'Top Series (characters)',
      playstyle: 'Pilot playstyle',
      playstyle_hint: 'How many of your listed pilots carry these Active Skills.',
      portrait_units: 'Your units',
      top_unit_series: 'Top Series (units)',
      top_mechs: 'Mechanisms',
      col_lb: 'Limit Break vs Collections',
      col_lb_hint: 'Matched from your local /collections unit board.',
      col_lb_miss: 'Not in Collections',
      col_lb_none: 'No Collections data in this browser — open /collections and mark ownership first.',
      gallery: 'Sorties lineup',
      terrain: 'Terrain capability (●)',
      terrain_hint: 'Best-tier (●) terrains on your list, weighted by Sorties.',
      rates: 'Lineup & rates',
      rates_hint: 'Top-list composition (Limited / EX / Ultimate) plus ratios that share a real link — not everything ÷ Sorties.',
      supp: 'Supporters that help your favorites most',
      supp_hint: 'Ranked by how many of your top list units share a Tag with the leader skill.',
      supp_cover: 'covers {pct}% of top {total} · {n} / {total} units',
      roles: 'Role mix',
      main_slot: 'Profile · Main',
      role_detected: 'Role from icon',
      progress: 'Player progress',
      progress_hint: 'From Profile main + Battle Results · EXP curve from MasterData.',
      exp_to_next: 'EXP to next Rank',
      days_eta: 'Days to next Rank (scenarios)',
      clears_eta: 'Stage clears / skips @ 50 EXP',
      title_pts: 'Title Pts',
      haro: 'Haro Trophy',
      finger: 'Battle Results',
      finger_hint: 'Cumulative records vs a published sample (percentile).',
      census_pct: 'Higher than {p}% of sample',
      partial_note: 'Partial upload: insights only use the slots you filled.'
    },
    JA: {
      status_need_lang: '先にスクリーンショットの言語を選んでください。',
      status_need_units: 'ユニット出撃 #1–10 を割り当ててください。',
      status_inbox: '{n} 枚を受信箱へ — 下で割り当ててください。',
      status_placed: '{slot} に割り当てました。',
      status_ocr: 'スクリーンショットを読み取り中 ({n})…',
      status_ocr_got: 'Sorties を読み取り中（ローカル実験）…',
      status_match: '{lang} で名称を照合中…',
      status_ready: '照合を確認してから分析してください。',
      status_analyze: '分析中…',
      status_done: '分析結果を表示しました。',
      status_err: 'エラー: {err}',
      status_wrong_screen:
        'Units #1–10 のショットが違います — {kind} の画面です。プロフィール→出撃→ユニットを指定してください。',
      status_ocr_weak:
        'Units #1–10 からユニット名を読めませんでした。出撃リスト全体（名称＋出撃回数）が写った鮮明なスクショを使ってください。',
      slot_empty: '未配置',
      assign_label: '割り当て',
      assign_placeholder: 'カテゴリを選択',
      inbox_title: '受信箱 — 各ショットを割り当て',
      inbox_hint: '大きいプレビューで画面を確認し、カテゴリを選んでください。',
      assigned_title: '割り当て済み — 読み取り前に確認',
      assigned_hint: '選んだカテゴリだけ表示。プレビューをクリックで拡大。',
      up_title: 'アップロードして割り当て',
      up_hint: 'ユニット上位1–10は必須。他は割り当てたときだけ表示。',
      flow1: 'プロフィールのスクショをすべてアップロード',
      flow2: '大きいプレビューを見ながらカテゴリへ割り当て',
      flow3: '割り当てを確認してから読み取り',
      change_slot: 'カテゴリ変更',
      remove_shot: '削除',
      slot_taken: 'このカテゴリには既にショットがあります。差し替えますか？',
      assign: '配置先…',
      conc: '出撃の集中度',
      conc_metric: '{pct}%',
      conc_of: 'リスト出撃合計のうち',
      conc_lead: '1〜3位の出撃合計は、リスト {n} 機の出撃合計（{sum}）の {pct}% です。',
      conc_formula: '（1〜3位の出撃）÷（リスト {n} 機の出撃合計）',
      conc_not: '総出撃数ではありません。',
      conc_more: '上位5 · {t5}%   上位10 · {t10}%   1位 · {t1}%',
      top3_tags: 'リスト機体のタグ',
      tags: 'よく重なるタグ',
      tags_hint: 'そのタグを持つ機体の出撃がリスト合計に占める割合（上位10/20）。',
      portrait_chars: 'キャラクター傾向',
      portrait_chars_sub: '出撃で重み付けしたアクティブスキル・アビリティ・シリーズ。',
      top_abilities: '多いアビリティ',
      top_skills: '多いアクティブスキル',
      top_skill_families: 'スキル系統',
      top_char_series: '多いシリーズ（キャラ）',
      playstyle: 'パイロットの傾向',
      playstyle_hint: 'リスト内で該当アクティブスキルを持つ人数。',
      portrait_units: 'ユニット傾向',
      top_unit_series: '多いシリーズ（ユニット）',
      top_mechs: '機構',
      col_lb: '限界突破（コレクション照合）',
      col_lb_hint: 'このブラウザの /collections 所持データと照合。',
      col_lb_miss: 'コレクション未登録',
      col_lb_none: 'コレクションデータなし — 先に /collections で所持を付けてください。',
      gallery: '出撃ラインナップ',
      terrain: '地形適性（●）',
      terrain_hint: 'リスト機体の●地形を出撃で重み付け。',
      rates: '編成と比率',
      rates_hint: 'リスト内の限定/(EX)/ULT構成と、意味のある組み合わせの比率のみ。',
      supp: 'お気に入り向けサポーター',
      supp_hint: 'リーダースキルタグが重なるリスト機数で順位付け。',
      supp_cover: '上位 {total} 機の {pct}% をカバー · {n} / {total}',
      roles: 'ロール構成',
      main_slot: 'プロフィール · メイン',
      role_detected: 'ロールアイコン',
      progress: 'プレイヤー進捗',
      progress_hint: 'プロフィール本体 + バトル結果 · EXPはマスターデータ準拠。',
      exp_to_next: '次のランクまでのEXP',
      days_eta: '次ランクまでの日数（想定）',
      clears_eta: 'ステージクリア/スキップ @ 50 EXP',
      title_pts: '称号Pts',
      haro: 'ハロトロフィー',
      finger: '戦績',
      finger_hint: '累計記録と公開サンプルの百分位。',
      census_pct: 'サンプルの {p}% より高い',
      partial_note: '一部のみアップロード：埋めた枠だけ分析します。'
    },
    TW: {
      status_need_lang: '請先選擇螢幕截圖的語言。',
      status_need_units: '請指定「出擊 · 單位 #1–10」截圖。',
      status_inbox: '已加入收件匣 {n} 張——請在下方分配。',
      status_placed: '已指定到 {slot}。',
      status_ocr: '正在讀取截圖 ({n})…',
      status_ocr_got: '正在讀取 Sorties（本機實驗）…',
      status_match: '以 {lang} 名稱比對中…',
      status_ready: '請確認比對結果後再分析。',
      status_analyze: '分析中…',
      status_done: '分析完成。',
      status_err: '錯誤：{err}',
      status_wrong_screen:
        'Units #1–10 截圖不對 — 這像是 {kind}，不是 簡介→出擊→單位。',
      status_ocr_weak:
        '無法從 Units #1–10 讀出單位名稱。請用清楚的出擊清單全螢幕（名稱＋出擊次數欄都看得到）。',
      slot_empty: '尚未放置',
      assign_label: '指定到…',
      assign_placeholder: '選擇類別',
      inbox_title: '收件匣 — 為每張指定類別',
      inbox_hint: '用大預覽確認是哪一頁，再選類別。',
      assigned_title: '已指定 — 讀取前請確認',
      assigned_hint: '只顯示你選過的類別。點預覽可放大。',
      up_title: '上傳並指定截圖',
      up_hint: '單位前 1–10 為必填。其他類別只有指定後才會出現。',
      flow1: '上傳所有簡介截圖',
      flow2: '看大預覽後指定類別',
      flow3: '確認已指定的預覽後再讀取',
      change_slot: '變更類別',
      remove_shot: '移除',
      slot_taken: '此類別已有截圖，要取代嗎？',
      assign: '放到…',
      conc: '出擊集中度',
      conc_metric: '{pct}%',
      conc_of: '佔列表出擊加總',
      conc_lead: '第 1～3 名出擊合計，佔列表 {n} 台出擊加總（{sum}）的 {pct}%。',
      conc_formula: '（第 1～3 名出擊）÷（列表 {n} 台出擊加總）',
      conc_not: '不是帳號「總出擊數」。',
      conc_more: '前 5 · {t5}%   前 10 · {t10}%   第 1 名 · {t1}%',
      top3_tags: '列表單位的標籤',
      tags: '最常對到的標籤',
      tags_hint: '帶有該標籤的單位出擊，佔列表出擊加總的比例（前 10／20）。',
      portrait_chars: '角色傾向',
      portrait_chars_sub: '依出擊加權的主動技能、能力、系列。',
      top_abilities: '常見能力',
      top_skills: '常見主動技能',
      top_skill_families: '技能系統',
      top_char_series: '常見系列（角色）',
      playstyle: '駕駛傾向',
      playstyle_hint: '列表中持有這些主動技能的人數。',
      portrait_units: '單位傾向',
      top_unit_series: '常見系列（單位）',
      top_mechs: '裝置',
      col_lb: '突破界限（對照收藏）',
      col_lb_hint: '對照本機 /collections 單位持有資料。',
      col_lb_miss: '收藏未登錄',
      col_lb_none: '沒有收藏資料——請先到 /collections 標記持有。',
      gallery: '出擊名單',
      terrain: '地形適性（●）',
      terrain_hint: '列表單位的 ● 地形，依出擊加權。',
      rates: '編制與比率',
      rates_hint: '列表內限定/(EX)/ULT構成，加上有實際關聯的比率——不是一律÷出擊次數。',
      supp: '常用機適合的支援人員',
      supp_hint: '依隊長技能標籤能覆蓋列表幾台單位排序。',
      supp_cover: '覆蓋前 {total} 台的 {pct}% · {n} / {total}',
      roles: '角色類型分布',
      main_slot: '簡介 · 主頁',
      role_detected: '類型圖示',
      progress: '玩家進度',
      progress_hint: '來自簡介主頁 + 戰鬥結果 · EXP 依 MasterData。',
      exp_to_next: '距下一等級 EXP',
      days_eta: '距下一等級天數（情境）',
      clears_eta: '關卡通關／略過 @ 50 EXP',
      title_pts: '稱號 Pts',
      haro: '哈囉獎盃',
      finger: '戰鬥成績',
      finger_hint: '累計紀錄與公開樣本百分位。',
      census_pct: '高於樣本 {p}%',
      partial_note: '部分上傳：只分析你有填的欄位。'
    },
    HK: {}
  };
  T.HK = Object.assign({}, T.TW, T.HK);

  function t(key, vars) {
    var pack = T[state.lang] || T.EN;
    var s = pack[key] || T.EN[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return s;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(msg, opts) {
    var el = $('pfStatus');
    if (!el) return;
    opts = opts || {};
    if (opts.loading) {
      el.classList.add('is-loading');
      el.innerHTML =
        '<span class="profile-loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
        '<span class="profile-status-msg">' +
        esc(msg || '') +
        '</span>';
    } else {
      el.classList.remove('is-loading');
      el.textContent = msg || '';
    }
  }

  function imgUrl(path) {
    var p = String(path || '');
    if (!p) return '';
    if (/^https?:\/\//i.test(p)) return p;
    if (USE_CDN && CDN && p.indexOf('/static/images/') === 0) {
      return CDN + p.replace(/^\/static/, '');
    }
    return p;
  }

  function tessLangFor(uiLang) {
    if (uiLang === 'JA') return 'jpn+eng';
    if (uiLang === 'TW' || uiLang === 'HK') return 'chi_tra+eng';
    return 'eng';
  }

  /** Main Profile may show a JP/TW/HK/KR player name even when UI LANG is EN. */
  function tessLangForPlayerName() {
    return 'jpn+chi_tra+eng';
  }

  /** Per-slot RapidOCR ordered rows — never share Main ↔ Sorties. */
  var _ocrRowsBySlot = {};

  function looksLikeSortiesOcr(text) {
    var raw = String(text || '');
    var ex = (raw.match(/\(EX\)|\(SP\)|（EX）|（SP）/gi) || []).length;
    var hasSorties = /sorties|出撃|出擊|総出撃/i.test(raw);
    var hasUnits = /\bunits?\b|\bcharacters?\b|ユニット|キャラ|單位|機體/i.test(raw);
    var numbered = (raw.match(/^\s*\d{1,2}[\.\)\s：:\-]+/gm) || []).length;
    var bigNums = (raw.match(/(?:^|[^A-Za-z0-9])([1-9]\d{2,4})(?![A-Za-z0-9])/g) || [])
      .length;
    var kitish = (
      raw.match(
        /gundam|zaku|sazabi|unicorn|qubeley|exia|aerial|destiny|zeta|freedom|phenex|\(EX\)|\(SP\)/gi
      ) || []
    ).length;
    if ((ex >= 3 && (hasSorties || hasUnits)) || ex >= 5) return true;
    if (hasSorties && (numbered >= 4 || bigNums >= 5 || kitish >= 3 || ex >= 2))
      return true;
    if ((hasSorties || hasUnits) && numbered >= 5 && bigNums >= 4) return true;
    if (numbered >= 7 && bigNums >= 5 && kitish >= 2) return true;
    if (numbered >= 5 && kitish >= 4) return true;
    return false;
  }

  function looksLikeProfileMainOcr(text) {
    var raw = String(text || '');
    if (looksLikeSortiesOcr(raw)) return false;
    var hits = 0;
    if (/\b(fadm|adm|vadm|radm|cdre|capt|cdr|lcdr|ltjg|\bens\b|cpo|po\d)\b/i.test(raw))
      hits += 2;
    if (/\d{1,5}\s*(?:pts?|pt|points?|點|点)\b|(?:pts?|點|点)\s*[:：]?\s*\d/i.test(raw))
      hits += 1;
    if (/\b(gold|silver|bronze|ゴールド|シルバー|ブロンズ)\b|[金銀銅]/i.test(raw)) hits += 1;
    if (/(?:player\s*)?rank\s*[:：]?\s*\d{1,3}\b|レベル\s*\d|等級\s*\d/i.test(raw)) hits += 1;
    return hits >= 2;
  }

  /**
   * Prefer server RapidOCR (.venv-paddle locally) for Sorties / Main / Battle / Haro.
   * Falls back to null so caller can use Tesseract.
   * Returns text only; ordered Sorties rows are stored under _ocrRowsBySlot[slot].
   */
  async function ocrViaServer(file, slot) {
    var tick = null;
    var t0 = Date.now();
    var sk0 = String(slot || '');
    var isSorties = /^(units|chars)/.test(sk0);
    try {
      var fd = new FormData();
      fd.append('file', file, file.name || 'shot.png');
      if (slot) fd.append('slot', slot);
      // GOT Sorties can take ~1–3 min cold; RapidOCR fallback is faster
      tick = setInterval(function () {
        var sec = Math.round((Date.now() - t0) / 1000);
        var label = isSorties
          ? t('status_ocr_got') + ' · ' + (slot || '') + ' · ' + sec + 's'
          : t('status_ocr', { n: 1 }) +
            ' · RapidOCR ' +
            (slot || '') +
            ' · ' +
            sec +
            's';
        setStatus(label, { loading: true });
      }, 1000);
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timeoutMs = isSorties ? 200000 : 120000;
      var to = setTimeout(function () {
        try {
          if (ctrl) ctrl.abort();
        } catch (_) {}
      }, timeoutMs);
      var res = await fetch('/api/profile_insights/ocr', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
        signal: ctrl ? ctrl.signal : undefined
      });
      clearTimeout(to);
      if (!res.ok) return null;
      var data = await res.json();
      if (!data || !data.text) return null;
      state.ocrEngine = data.engine || 'rapidocr';
      var sk = String(slot || '');
      // Ordered Sorties rows ONLY for units/chars slots — never stash on main/haro/battle
      if (
        /^(units|chars)/.test(sk) &&
        data.rows &&
        data.rows.length &&
        data.screen_kind === 'sorties'
      ) {
        _ocrRowsBySlot[sk] = data.rows;
      } else if (sk) {
        delete _ocrRowsBySlot[sk];
      }
      // Legacy alias used only inside the same Sorties read
      ocrViaServer.lastRows = _ocrRowsBySlot[sk] || null;
      return String(data.text || '');
    } catch (_) {
      return null;
    } finally {
      if (tick) clearInterval(tick);
    }
  }

  async function parseScreensOnServer(mainOcr, battleOcr, haroOcr) {
    try {
      var res = await fetch('/api/profile_insights/parse_screens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          lang: state.lang,
          main_ocr: mainOcr || '',
          battle_ocr: battleOcr || '',
          haro_ocr: haroOcr || ''
        })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  function selectLang(lang) {
    state.lang = String(lang || '').toUpperCase();
    if (state.lang === 'JP') state.lang = 'JA';
    try {
      localStorage.setItem(LANG_KEY, state.lang);
    } catch (_) {}
    document.querySelectorAll('.profile-lang-btn').forEach(function (btn) {
      btn.classList.toggle('is-on', btn.getAttribute('data-lang') === state.lang);
      btn.classList.remove('is-hint');
    });
    var upload = $('pfStepUpload');
    if (upload) upload.hidden = !state.lang;
    if (!state.lang) setStatus(t('status_need_lang'));
    else setStatus('');
    applyUploadCopy();
    updateRunEnabled();
  }

  function bindLang() {
    var grid = $('pfLangGrid');
    if (!grid) return;
    grid.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('.profile-lang-btn');
      if (!btn) return;
      selectLang(btn.getAttribute('data-lang'));
    });
    var saved = '';
    try {
      saved = localStorage.getItem(LANG_KEY) || '';
    } catch (_) {}
    if (saved && ['EN', 'JA', 'TW', 'HK'].indexOf(saved) >= 0) {
      document.querySelectorAll('.profile-lang-btn').forEach(function (btn) {
        btn.classList.toggle('is-hint', btn.getAttribute('data-lang') === saved);
      });
    }
  }

  function updateRunEnabled() {
    var run = $('pfRunOcr');
    if (!run) return;
    run.disabled = !state.lang || !state.slots.units_1_10;
  }

  function slotIsFilled(slotKey) {
    if (slotKey === 'battle') return (state.slots.battle || []).length > 0;
    return !!state.slots[slotKey];
  }

  function anySlotFilled() {
    return SLOT_KEYS.some(slotIsFilled);
  }

  function updateAssignedVisibility() {
    var wrap = $('pfAssigned');
    if (wrap) wrap.hidden = !anySlotFilled();
    SLOT_KEYS.forEach(function (k) {
      var article = document.querySelector('.profile-slot[data-slot="' + k + '"]');
      if (!article) return;
      var filled = slotIsFilled(k);
      article.hidden = !filled;
      article.classList.toggle('has-file', filled);
    });
  }

  function applyUploadCopy() {
    var setTxt = function (id, key) {
      var el = $(id);
      if (el) el.textContent = t(key);
    };
    setTxt('pfUpTitle', 'up_title');
    setTxt('pfUpHint', 'up_hint');
    setTxt('pfFlow1', 'flow1');
    setTxt('pfFlow2', 'flow2');
    setTxt('pfFlow3', 'flow3');
    setTxt('pfInboxTitle', 'inbox_title');
    setTxt('pfInboxHint', 'inbox_hint');
    setTxt('pfAssignedTitle', 'assigned_title');
    setTxt('pfAssignedHint', 'assigned_hint');
  }

  function renderAllSlots() {
    applyUploadCopy();
    SLOT_KEYS.forEach(renderSlotBody);
    updateAssignedVisibility();
    renderUnsorted();
    bindSlotDropTargets();
    updateRunEnabled();
  }

  function dragPayload(obj) {
    return JSON.stringify(obj);
  }

  function readDragPayload(ev) {
    try {
      var raw = ev.dataTransfer.getData('application/x-ggen-profile-shot') || ev.dataTransfer.getData('text/plain');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function takeShotFromSource(payload) {
    if (!payload) return null;
    if (payload.from === 'unsorted') {
      var item = state.unsorted[payload.index];
      if (!item) return null;
      state.unsorted.splice(payload.index, 1);
      return { file: item.file, text: item.text || '', url: item.url || '' };
    }
    if (payload.from === 'slot') {
      var sk = payload.slot;
      if (sk === 'battle') {
        var bi = payload.battleIndex;
        var f = state.slots.battle[bi];
        if (!f) return null;
        state.slots.battle.splice(bi, 1);
        var t = '';
        if (Array.isArray(state.slotOcr.battle)) {
          t = state.slotOcr.battle[bi] || '';
          state.slotOcr.battle.splice(bi, 1);
        }
        return { file: f, text: t, url: '' };
      }
      var file = state.slots[sk];
      if (!file) return null;
      var text = state.slotOcr[sk] || '';
      state.slots[sk] = null;
      state.slotOcr[sk] = '';
      return { file: file, text: text, url: '' };
    }
    return null;
  }

  function moveShotToSlot(payload, toSlot) {
    if (!payload || !toSlot) return;
    if (toSlot !== 'battle' && state.slots[toSlot]) {
      if (!window.confirm(t('slot_taken'))) return;
    }
    var shot = takeShotFromSource(payload);
    if (!shot) return;
    if (toSlot === 'battle') {
      placeInSlot('battle', shot.file, shot.text);
    } else if (state.slots[toSlot]) {
      state.unsorted.push({
        file: state.slots[toSlot],
        text: state.slotOcr[toSlot] || '',
        url: ''
      });
      state.slots[toSlot] = shot.file;
      state.slotOcr[toSlot] = shot.text || '';
    } else {
      placeInSlot(toSlot, shot.file, shot.text);
    }
    renderAllSlots();
    setStatus(t('status_placed', { slot: SLOT_LABELS[toSlot] || toSlot }));
  }

  function makeShotEl(file, slotKey, battleIndex) {
    var wrap = document.createElement('div');
    wrap.className = 'profile-shot profile-shot--assigned';
    var img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name || slotKey;
    img.loading = 'lazy';
    img.draggable = false;
    img.title = 'Click to zoom';
    img.addEventListener('click', function () {
      openZoom(img.src);
    });
    var tools = document.createElement('div');
    tools.className = 'profile-shot-tools';
    var sel = document.createElement('select');
    sel.className = 'profile-shot-reassign';
    sel.setAttribute('aria-label', t('change_slot'));
    sel.innerHTML =
      '<option value="">' +
      esc(t('change_slot')) +
      '</option>' +
      SLOT_KEYS.map(function (k) {
        return (
          '<option value="' +
          k +
          '"' +
          (k === slotKey ? ' selected' : '') +
          '>' +
          esc(SLOT_LABELS[k]) +
          '</option>'
        );
      }).join('');
    sel.addEventListener('change', function () {
      var k = sel.value;
      if (!k || k === slotKey) {
        sel.value = slotKey;
        return;
      }
      moveShotToSlot({ from: 'slot', slot: slotKey, battleIndex: battleIndex }, k);
    });
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'profile-shot-x';
    btn.setAttribute('aria-label', t('remove_shot'));
    btn.innerHTML =
      '<img src="' +
      escAttr(imgUrl(CLOSE_ICON)) +
      '" alt="" width="22" height="22" decoding="async">';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var shot = takeShotFromSource({
        from: 'slot',
        slot: slotKey,
        battleIndex: battleIndex
      });
      if (shot) {
        state.unsorted.push({ file: shot.file, text: shot.text || '', url: shot.url || '' });
      }
      renderAllSlots();
    });
    tools.appendChild(sel);
    tools.appendChild(btn);
    wrap.appendChild(img);
    wrap.appendChild(tools);
    return wrap;
  }

  function renderSlotBody(slotKey) {
    var article = document.querySelector('.profile-slot[data-slot="' + slotKey + '"]');
    var body = article && article.querySelector('[data-slot-body="' + slotKey + '"]');
    if (!body || !article) return;
    body.innerHTML = '';
    if (!slotIsFilled(slotKey)) {
      article.hidden = true;
      article.classList.remove('has-file');
      return;
    }
    article.hidden = false;
    article.classList.add('has-file');
    if (slotKey === 'battle') {
      var arr = state.slots.battle || [];
      var row = document.createElement('div');
      row.className = 'profile-slot-shots';
      arr.forEach(function (f, i) {
        row.appendChild(makeShotEl(f, 'battle', i));
      });
      body.appendChild(row);
      return;
    }
    var f = state.slots[slotKey];
    var row2 = document.createElement('div');
    row2.className = 'profile-slot-shots';
    row2.appendChild(makeShotEl(f, slotKey, -1));
    body.appendChild(row2);
  }

  function clearSlotShot(slotKey, battleIndex) {
    if (slotKey === 'battle') {
      state.slots.battle.splice(battleIndex, 1);
      if (Array.isArray(state.slotOcr.battle)) state.slotOcr.battle.splice(battleIndex, 1);
    } else {
      state.slots[slotKey] = null;
      state.slotOcr[slotKey] = '';
    }
    renderAllSlots();
  }

  function placeInSlot(slotKey, file, ocrText) {
    if (slotKey === 'battle') {
      state.slots.battle.push(file);
      if (!Array.isArray(state.slotOcr.battle)) state.slotOcr.battle = [];
      state.slotOcr.battle.push(ocrText || '');
      return true;
    }
    if (state.slots[slotKey]) {
      return false;
    }
    state.slots[slotKey] = file;
    state.slotOcr[slotKey] = ocrText || '';
    return true;
  }

  function openZoom(src) {
    var z = $('pfZoom');
    var zi = $('pfZoomImg');
    if (!z || !zi || !src) return;
    zi.src = src;
    z.hidden = false;
    document.documentElement.classList.add('page-scroll-lock');
  }

  function closeZoom() {
    var z = $('pfZoom');
    var zi = $('pfZoomImg');
    if (z) z.hidden = true;
    if (zi) zi.removeAttribute('src');
    document.documentElement.classList.remove('page-scroll-lock');
  }

  function bindZoom() {
    var z = $('pfZoom');
    var closeBtn = $('pfZoomClose');
    if (closeBtn) closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeZoom();
    });
    if (z) {
      z.addEventListener('click', function (e) {
        if (e.target === z) closeZoom();
      });
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeZoom();
    });
  }

  function renderUnsorted() {
    var host = $('pfUnsorted');
    var row = $('pfUnsortedRow');
    if (!host || !row) return;
    host.hidden = !state.unsorted.length;
    var title = $('pfInboxTitle');
    var hint = $('pfInboxHint');
    if (title) title.textContent = t('inbox_title');
    if (hint) hint.textContent = t('inbox_hint');
    row.innerHTML = '';
    state.unsorted.forEach(function (item, idx) {
      var card = document.createElement('article');
      card.className = 'profile-inbox-card';
      var preview = document.createElement('button');
      preview.type = 'button';
      preview.className = 'profile-inbox-preview';
      preview.title = 'Click to zoom';
      var img = document.createElement('img');
      img.src = item.url || URL.createObjectURL(item.file);
      item.url = img.src;
      img.alt = item.file.name || 'Screenshot';
      img.draggable = false;
      preview.appendChild(img);
      preview.addEventListener('click', function () {
        openZoom(img.src);
      });
      var side = document.createElement('div');
      side.className = 'profile-inbox-side';
      var name = document.createElement('div');
      name.className = 'profile-inbox-name';
      name.textContent = item.file.name || 'Screenshot ' + (idx + 1);
      var lab = document.createElement('label');
      lab.className = 'profile-inbox-assign-lab';
      lab.textContent = t('assign_label');
      var sel = document.createElement('select');
      sel.className = 'profile-inbox-assign';
      sel.setAttribute('aria-label', t('assign_label'));
      sel.innerHTML =
        '<option value="">' +
        esc(t('assign_placeholder')) +
        '</option>' +
        SLOT_KEYS.map(function (k) {
          var taken = slotIsFilled(k) && k !== 'battle';
          return (
            '<option value="' +
            k +
            '">' +
            esc(SLOT_LABELS[k]) +
            (taken ? ' ✓' : '') +
            '</option>'
          );
        }).join('');
      sel.addEventListener('change', function () {
        var k = sel.value;
        if (!k) return;
        moveShotToSlot({ from: 'unsorted', index: idx }, k);
      });
      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'profile-btn profile-btn--ghost profile-inbox-rm';
      rm.textContent = t('remove_shot');
      rm.addEventListener('click', function () {
        state.unsorted.splice(idx, 1);
        renderAllSlots();
      });
      side.appendChild(name);
      side.appendChild(lab);
      side.appendChild(sel);
      side.appendChild(rm);
      card.appendChild(preview);
      card.appendChild(side);
      row.appendChild(card);
    });
  }

  function ingestBulkFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return f && f.type && f.type.indexOf('image/') === 0;
    });
    if (!files.length) return;
    if (!state.lang) {
      setStatus(t('status_need_lang'));
      return;
    }
    // Reverse of FileList / picker order (last selected → top of inbox)
    for (var i = 0; i < files.length; i++) {
      state.unsorted.unshift({
        file: files[i],
        text: '',
        url: URL.createObjectURL(files[i])
      });
    }
    renderAllSlots();
    setStatus(t('status_inbox', { n: files.length }));
    var bulk = $('pfBulkDrop');
    if (bulk) {
      bulk.classList.remove('is-lift');
      bulk.classList.add('is-settle');
      setTimeout(function () {
        bulk.classList.remove('is-settle');
      }, 450);
    }
  }

  function bindSlotDropTargets() {
    document.querySelectorAll('.profile-slot').forEach(function (article) {
      if (article._pfDropBound) return;
      article._pfDropBound = true;
      var slotKey = article.getAttribute('data-slot');
      article.addEventListener('dragenter', function (e) {
        e.preventDefault();
        article.classList.add('is-drop-target');
      });
      article.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        article.classList.add('is-drop-target');
      });
      article.addEventListener('dragleave', function (e) {
        if (!article.contains(e.relatedTarget)) article.classList.remove('is-drop-target');
      });
      article.addEventListener('drop', function (e) {
        e.preventDefault();
        article.classList.remove('is-drop-target');
        // OS files dropped on a slot
        var files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) {
          var imgs = Array.prototype.slice.call(files).filter(function (f) {
            return f.type && f.type.indexOf('image/') === 0;
          });
          if (imgs.length) {
            if (slotKey === 'battle') {
              imgs.forEach(function (f) {
                placeInSlot('battle', f, '');
              });
            } else {
              // First fills slot; extras → inbox
              if (!state.slots[slotKey]) {
                placeInSlot(slotKey, imgs[0], '');
                imgs.slice(1).forEach(function (f) {
                  state.unsorted.push({ file: f, text: '', url: URL.createObjectURL(f) });
                });
              } else {
                imgs.forEach(function (f) {
                  state.unsorted.push({ file: f, text: '', url: URL.createObjectURL(f) });
                });
              }
            }
            renderAllSlots();
            setStatus(t('status_placed', { slot: SLOT_LABELS[slotKey] || slotKey }));
            return;
          }
        }
        var payload = readDragPayload(e);
        if (!payload) return;
        // Ignore drop onto same slot
        if (payload.from === 'slot' && payload.slot === slotKey && slotKey !== 'battle') return;
        moveShotToSlot(payload, slotKey);
      });
    });
  }

  function bindSlots() {
    var bulkDrop = $('pfBulkDrop');
    var bulkFile = $('pfBulkFile');
    if (bulkDrop && bulkFile) {
      bulkDrop.addEventListener('click', function () {
        bulkFile.click();
      });
      bulkDrop.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          bulkFile.click();
        }
      });
      bulkDrop.addEventListener('dragenter', function (e) {
        e.preventDefault();
        bulkDrop.classList.add('is-lift');
      });
      bulkDrop.addEventListener('dragover', function (e) {
        e.preventDefault();
        bulkDrop.classList.add('is-lift');
      });
      bulkDrop.addEventListener('dragleave', function (e) {
        if (!bulkDrop.contains(e.relatedTarget)) bulkDrop.classList.remove('is-lift');
      });
      bulkDrop.addEventListener('drop', function (e) {
        e.preventDefault();
        bulkDrop.classList.remove('is-lift');
        // If dragging an assigned shot back to inbox
        var payload = readDragPayload(e);
        if (payload && payload.from === 'slot') {
          var shot = takeShotFromSource(payload);
          if (shot) {
            state.unsorted.push({ file: shot.file, text: shot.text || '', url: shot.url || '' });
            renderAllSlots();
            setStatus(t('status_inbox', { n: 1 }));
          }
          return;
        }
        ingestBulkFiles(e.dataTransfer && e.dataTransfer.files);
      });
      bulkFile.addEventListener('change', function () {
        ingestBulkFiles(bulkFile.files);
        bulkFile.value = '';
      });
    }

    renderAllSlots();

    var run = $('pfRunOcr');
    var demo = $('pfLoadDemo');
    if (run) run.addEventListener('click', runOcrPipeline);
    if (demo) demo.addEventListener('click', loadDemo);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error('script_fail'));
      };
      document.head.appendChild(s);
    });
  }

  async function ensureTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
    if (!window.Tesseract) throw new Error('tesseract_missing');
    return window.Tesseract;
  }

  function parseOcrNum(raw) {
    var s = String(raw || '')
      .replace(/[０-９]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30);
      })
      .replace(/[，]/g, ',')
      .replace(/[．]/g, '.');
    // Strip thousands separators (1,234 / 1.234 / 1 234)
    if (/^\d{1,3}([,.\s]\d{3})+$/.test(s.trim())) {
      s = s.replace(/[,.\s]/g, '');
    } else {
      s = s.replace(/,/g, '');
    }
    var n = parseInt(s, 10);
    return Number.isFinite(n) ? n : NaN;
  }

  function isOcrJunkName(name) {
    var n = String(name || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!n || n.length < 2) return true;
    // Single UI glyphs / bracket markers from Profile · Main
    if (/^[\[\(]?[A-Z][\]\)]?$/i.test(n)) return true;
    if (
      /^(sorties|sortie|battle|rank|player|profile|database|results|units?|characters?|total|lv\.?|level|pts?|points?|haro|trophy|gold|silver|bronze|favorites?|holo-?actor)$/i.test(
        n
      )
    )
      return true;
    // Profile · Main chrome OCR (often glued): "CPLAYERPROFILE DATABASE", "Player Rank"
    if (
      /player\s*profile|cplayerprofile|profile\s*data\s*base|data\s*base|player\s*rank|battle\s*results|cumulative\s*record|achievement|出撃数|プロフィール|簡介|資料庫|データベース/i.test(
        n
      )
    )
      return true;
    if (/sorties|battle results|database|player rank|profile/i.test(n) && n.length < 36)
      return true;
    // Military title alone is not a kit
    if (/^(fadm|adm|vadm|radm|cdre|capt|cdr|lcdr|ltjg|lt|ens|cpo|po\d)(\s*\d)?$/i.test(n))
      return true;
    return false;
  }

  function cleanOcrKitName(name) {
    var n = String(name || '')
      .replace(/^[\d#.\s):：\-]+/, '')
      .replace(/^(?:BN|RN|SR|SSR|UR|N)\s*\d{0,2}\s+/i, '')
      .replace(/^[a-z](?=[A-Z])/, '')
      .replace(/\s+/g, ' ')
      .trim();
    var parts = n.split(' ');
    while (
      parts.length > 2 &&
      parts[0].replace(/[^A-Za-z0-9]/g, '').length <= 3 &&
      !/gundam|zaku|exia|nu|wing|freedom|justice|destiny|unicorn|zeta|xi|00|sazabi|qubeley|aerial|burning/i.test(
        parts[0]
      )
    ) {
      parts.shift();
    }
    return parts.join(' ').trim();
  }

  /** Profile · Main chrome — detect even when OCR also spuriously finds (EX). */
  function hasProfileMainChrome(text) {
    var raw = String(text || '');
    if (!raw.trim()) return false;
    var hits = 0;
    if (/player\s*profile\s*data\s*base|cplayerprofile|プロフィール|プレイヤープロフィール|簡介/i.test(raw))
      hits += 3;
    if (/\b(fadm|adm|vadm|radm|cdre|capt|cdr|lcdr|ltjg|\bens\b|cpo|po\d)\b/i.test(raw))
      hits += 2;
    if (/\d{1,5}\s*(?:pts?|pt|points?|點|点)\b|(?:pts?|點|点)\s*[:：]?\s*\d/i.test(raw))
      hits += 1;
    if (/\b(gold|silver|bronze|ゴールド|シルバー|ブロンズ)\b|[金銀銅]/i.test(raw)) hits += 1;
    if (/(?:player\s*)?rank\s*[:：]?\s*\d{1,3}\b|レベル\s*\d|等級\s*\d/i.test(raw)) hits += 1;
    if (/\bharo\b|ハロ|trophy/i.test(raw)) hits += 1;
    return hits >= 3;
  }

  function detectWrongSortieScreen(text) {
    var blob = String(text || '');
    if (/unit\s*assembly\s*results|assemble\s*again|until\s*guaranteed/i.test(blob)) {
      return 'Unit Assembly Results (gacha)';
    }
    if (/exchange\s*pts/i.test(blob) && /time\(s\)/i.test(blob) && !/\(EX\)/i.test(blob)) {
      return 'Unit Assembly Results (gacha)';
    }
    // Never require !EX — Profile · Main chrome must not seed Sorties ranks
    if (hasProfileMainChrome(blob)) {
      return 'Profile · Main';
    }
    if (/player\s*profile\s*data\s*base|cplayerprofile|holo-actor|favorites/i.test(blob)) {
      var ex = (blob.match(/\(EX\)|\(SP\)/gi) || []).length;
      if (ex < 3) return 'Profile · Main';
    }
    if (/battle\s*results|cumulative\s*record/i.test(blob) && /total\s*sorties/i.test(blob) && !/\(EX\)/i.test(blob)) {
      return 'Battle Results';
    }
    return null;
  }

  /** Drop Profile · Main / HUD lines from Sorties ordered rows (keep real kits). */
  function filterSortieKitRows(rows) {
    return (rows || []).filter(function (r) {
      var n = String((r && r.name) || '').trim();
      if (!n || isOcrJunkName(n)) return false;
      var s = Number(r.sorties) || 0;
      // Keep (EX)/(SP) even if count weak (Unicorn glue); else need a real Sorties count
      if (/\(EX\)|\(SP\)|（EX）|（SP）/i.test(n)) return true;
      return s >= 80;
    });
  }

  function scoreOcrForSorties(text) {
    var rows = parseOcrText(text);
    var ex = (String(text).match(/\(EX\)|\(SP\)/gi) || []).length;
    var nums = (String(text).match(/\d{1,3}(?:[,.\s]\d{3})+|\d{4,7}/g) || []).length;
    var wrong = detectWrongSortieScreen(text);
    if (wrong) return rows.length * 10 - 500;
    return rows.length * 100 + ex * 15 + Math.min(nums, 20);
  }

  /** Fallback when Tess jams icons/UI chrome into one noisy blob. */
  function parseOcrTextLoose(text) {
    var blob = String(text || '')
      .replace(/[０-９]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30);
      })
      .replace(/[·•|]/g, ' ')
      .replace(/\s+/g, ' ');
    var names = [];
    // Prefer (EX)/(SP) kit names — most reliable signal in Sorties OCR junk
    var nameRe =
      /([A-Za-z][A-Za-z0-9][\w .'/\-]{0,55}?\((?:EX|SP)\))/gi;
    var m;
    while ((m = nameRe.exec(blob)) !== null) {
      var name = cleanOcrKitName(m[1]);
      if (isOcrJunkName(name) || name.length < 3) continue;
      // Dedupe overlapping matches
      if (names.length && Math.abs(names[names.length - 1].index - m.index) < 3) continue;
      names.push({ name: name, index: m.index });
    }
    var nums = [];
    var numRe = /(\d{1,3}(?:[,.\s]\d{3})+|\d{4,7})/g;
    while ((m = numRe.exec(blob)) !== null) {
      var n = parseOcrNum(m[1]);
      // Sorties counts are typically hundreds–tens of thousands
      if (!Number.isFinite(n) || n < 80 || n > 500000) continue;
      nums.push({ value: n, index: m.index });
    }
    if (!names.length || !nums.length) return [];
    var used = {};
    var rows = [];
    names.forEach(function (nm, i) {
      var best = -1;
      var bestDist = 1e9;
      for (var j = 0; j < nums.length; j++) {
        if (used[j]) continue;
        var d = nums[j].index - nm.index;
        // Prefer a count shortly after the name
        if (d < -8 || d > 140) continue;
        if (d < bestDist) {
          bestDist = d;
          best = j;
        }
      }
      if (best < 0) {
        for (var k = 0; k < nums.length; k++) {
          if (!used[k]) {
            best = k;
            break;
          }
        }
      }
      if (best < 0) return;
      used[best] = true;
      rows.push({
        rank: i + 1,
        name: nm.name,
        sorties: nums[best].value,
        _line: -1
      });
    });
    return rows;
  }

  function parseOcrText(text) {
    var lines = String(text || '')
      .split(/\r?\n/)
      .map(function (l) {
        return l
          .replace(/[０-９]/g, function (ch) {
            return String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30);
          })
          .trim();
      })
      .filter(Boolean);
    var rows = [];
    // Same-line: optional rank + name + Sorties count
    var reSame =
      /^(\d{1,2})?[.\s):：\-]*(.+?)\s+(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7})$/;
    // Number-only line (optional "1. " rank prefix — require separator so "2,828" stays intact)
    var reNumOnly = /^(?:#?\d{1,2}[.)]\s+)?(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7})$/;
    var reRankOnly = /^#?\d{1,2}[.)]?$/;
    var pending = null;

    function pushRow(rank, name, sorties, lineIdx) {
      name = cleanOcrKitName(name);
      if (isOcrJunkName(name)) return false;
      if (!Number.isFinite(sorties) || sorties < 10) return false;
      rows.push({
        rank: rank || rows.length + 1,
        name: name,
        sorties: sorties,
        _line: lineIdx
      });
      return true;
    }

    lines.forEach(function (line, i) {
      if (reRankOnly.test(line)) return;
      var mSame = line.match(reSame);
      if (mSame) {
        var sortiesSame = parseOcrNum(mSame[3]);
        var rankSame = mSame[1] ? parseInt(mSame[1], 10) : rows.length + 1;
        if (pushRow(rankSame, mSame[2], sortiesSame, i)) pending = null;
        return;
      }
      var mNum = line.match(reNumOnly);
      if (mNum && pending) {
        var sortiesOnly = parseOcrNum(mNum[1]);
        if (pushRow(pending.rank, pending.name, sortiesOnly, pending.line)) {
          pending = null;
        }
        return;
      }
      if (mNum) return; // stray count with no name — skip
      // Name-only line (Sorties often OCR'd on the next line)
      if (/[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af(]/.test(line)) {
        var rankHint = null;
        var namePart = line;
        var mRank = line.match(/^(\d{1,2})[.\s):：\-]+(.+)$/);
        if (mRank) {
          rankHint = parseInt(mRank[1], 10);
          namePart = mRank[2];
        }
        namePart = namePart.replace(/\s+/g, ' ').trim();
        if (!isOcrJunkName(namePart) && namePart.length >= 2) {
          pending = { rank: rankHint, name: namePart, line: i };
        }
      }
    });

    // Noisy single-blob OCR (icons + HUD) — recover (EX) names + nearby counts
    if (rows.length < 3) {
      var loose = parseOcrTextLoose(text);
      if (loose.length > rows.length) rows = loose;
    }

    rows.sort(function (a, b) {
      return b.sorties - a.sorties;
    });
    return rows;
  }

  function extractPlayerNameLocal(text) {
    if (looksLikeSortiesOcr(text) && !looksLikeProfileMainOcr(text)) return null;
    var lines = String(text || '')
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    var block = /^(sorties|units?|characters?|profile|player\s*rank|battle\s*results|database|haro|trophy|gold|silver|bronze|total|rank|level|pts?|出撃|ユニット|キャラ|プロフィール|戦績|ハロ|出擊|簡介|資料庫|等級|級別)$/i;
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < Math.min(lines.length, 40); i++) {
      var s = lines[i].replace(/\s+/g, ' ').replace(/^[·|•\-–—:\s]+|[·|•\-–—:\s]+$/g, '');
      if (s.length < 1 || s.length > 24) continue;
      if (block.test(s)) continue;
      if (/^[\d\s,./]+$/.test(s)) continue;
      if (/^(fadm|adm|vadm|radm|cdre|capt|cdr|lcdr|ltjg|lt|ens|cpo|po\d)\b/i.test(s)) continue;
      if (/\(EX\)|\(SP\)|（EX）|（SP）/i.test(s)) continue;
      if (/gundam|zaku|sazabi|unicorn|qubeley|exia|aerial|destiny|zeta|freedom/i.test(s))
        continue;
      if (/^\d{1,2}\s+\S/.test(s)) continue;
      var hasCjk = /[\u3040-\u30ff\u3400-\u9fff]/.test(s);
      var hasHangul = /[\uac00-\ud7af]/.test(s);
      var hasLatin = /[A-Za-z]/.test(s);
      var score = 0;
      if (hasCjk) score += 100;
      if (hasHangul) score += 100;
      if (hasLatin && !hasCjk && !hasHangul) {
        if (!/^[A-Za-z][A-Za-z0-9_\-]{1,15}$/.test(s)) continue;
        score += 40;
      }
      if (!hasCjk && !hasHangul && !hasLatin) continue;
      if (/\(|（/i.test(s)) score -= 50;
      score += Math.max(0, 30 - i);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  }

  function parseMainProfileOcr(text) {
    var raw = String(text || '');
    var lines = raw
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    var blob = lines.join('\n');
    var out = {
      player_name: null,
      player_level: null,
      profile_rank_title: null,
      achievement_pts: null,
      achievement_pts_next: null,
      haro: { gold: null, silver: null, bronze: null },
      wrong_screen: null
    };
    if (looksLikeSortiesOcr(raw) && !looksLikeProfileMainOcr(raw)) {
      out.wrong_screen = 'sorties';
      return out;
    }
    out.player_name = extractPlayerNameLocal(raw);
    var m;
    var lvPats = [
      /(?:player\s*)?rank\s*[:：]?\s*(\d{1,3})\b/i,
      /\blv\.?\s*(\d{1,3})\b/i,
      /\blevel\s*[:：]?\s*(\d{1,3})\b/i,
      /レベル\s*(\d{1,3})/,
      /等級\s*(\d{1,3})/,
      /級別\s*(\d{1,3})/
    ];
    for (var i = 0; i < lvPats.length; i++) {
      m = blob.match(lvPats[i]);
      if (m) {
        var lv = parseInt(m[1], 10);
        if (lv >= 1 && lv <= 300) {
          out.player_level = lv;
          break;
        }
      }
    }
    var titles = [
      'FADM 5',
      'FADM 4',
      'FADM 3',
      'FADM 2',
      'FADM 1',
      'FADM',
      'ADM',
      'VADM',
      'RADM',
      'CDRE',
      'CAPT',
      'CDR',
      'LCDR',
      'LTJG',
      'LT',
      'ENS',
      'CPO',
      'PO1',
      'PO2'
    ];
    var upper = blob.toUpperCase();
    for (var ti = 0; ti < titles.length; ti++) {
      var t0 = titles[ti];
      if (new RegExp('\\b' + t0.replace(/\s+/g, '\\s+') + '\\b').test(upper)) {
        out.profile_rank_title = t0;
        break;
      }
    }
    m = blob.match(/(\d{1,5})\s*\/\s*(\d{1,5})\s*(?:pts?|pt|點|点)/i);
    if (m) {
      out.achievement_pts = parseInt(m[1], 10);
      out.achievement_pts_next = parseInt(m[2], 10);
    } else {
      m = blob.match(/(?:pts?|pt|points?|點|点)\s*[:：]?\s*(\d{1,5})/i);
      if (!m) m = blob.match(/(\d{1,5})\s*(?:pts?|pt|points?|點|点)\b/i);
      if (m) out.achievement_pts = parseInt(m[1], 10);
    }
    function nearCount(pats) {
      for (var li = 0; li < lines.length; li++) {
        var low = lines[li].toLowerCase();
        var hit = pats.some(function (p) {
          return p.test(low);
        });
        if (!hit) continue;
        var chunk = lines.slice(li, li + 3).join(' ');
        var nums = chunk.match(/\b(\d{1,4})\b/g) || [];
        for (var ni = 0; ni < nums.length; ni++) {
          var v = parseInt(nums[ni], 10);
          if (v >= 0 && v <= 999) return v;
        }
      }
      return null;
    }
    out.haro.gold = nearCount([/gold/, /ゴールド/, /金/]);
    out.haro.silver = nearCount([/silver/, /シルバー/, /銀/]);
    out.haro.bronze = nearCount([/bronze/, /ブロンズ/, /銅/]);
    return out;
  }

  function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var d = max - min;
    var h = 0;
    var s = max === 0 ? 0 : d / max;
    var v = max;
    if (d > 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { h: h * 360, s: s, v: v };
  }

  /** Map saturated role-icon color → RoleTypeIndex (Attack red / Durability blue / Support yellow). */
  function roleIdFromHue(h, s, v) {
    if (s < 0.28 || v < 0.18) return null;
    if (h < 28 || h >= 340) return '1'; // red → Attack
    if (h >= 28 && h < 78) return '3'; // yellow → Support
    if (h >= 175 && h < 265) return '2'; // blue → Durability
    return null;
  }

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('img_load_fail'));
      };
      img.src = url;
    });
  }

  /**
   * Sample each Sorties list row for role-icon hue + thumb average RGB.
   * Layout assumption: header ~12% top, footer ~6%; list rows equal height;
   * role icon ~6–14% from left; portrait ~14–28% from left.
   */
  async function detectRowVisuals(file, rowCount) {
    var n = Math.max(1, Math.min(12, rowCount | 0));
    var out = [];
    try {
      var img = await loadImageFromFile(file);
      var canvas = document.createElement('canvas');
      var w = img.naturalWidth || img.width;
      var h = img.naturalHeight || img.height;
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      var top = Math.floor(h * 0.12);
      var bottom = Math.floor(h * 0.94);
      var listH = Math.max(1, bottom - top);
      var rowH = listH / n;
      for (var i = 0; i < n; i++) {
        var y0 = top + rowH * i;
        var y1 = top + rowH * (i + 1);
        var cy = Math.floor((y0 + y1) / 2);
        var roleBand = sampleRegionAvg(ctx, w, Math.floor(w * 0.05), Math.floor(w * 0.13), Math.floor(y0 + rowH * 0.2), Math.floor(y1 - rowH * 0.2));
        var thumbBand = sampleRegionAvg(ctx, w, Math.floor(w * 0.13), Math.floor(w * 0.28), Math.floor(y0 + rowH * 0.12), Math.floor(y1 - rowH * 0.12));
        var hsv = rgbToHsv(roleBand.r, roleBand.g, roleBand.b);
        var roleId = roleIdFromHue(hsv.h, hsv.s, hsv.v);
        out.push({
          role_id: roleId,
          role_hsv: hsv,
          thumb_rgb: thumbBand,
          _cy: cy
        });
      }
    } catch (_) {
      for (var z = 0; z < n; z++) out.push({ role_id: null, thumb_rgb: null });
    }
    return out;
  }

  function sampleRegionAvg(ctx, imgW, x0, x1, y0, y1) {
    x0 = Math.max(0, Math.min(imgW - 1, x0));
    x1 = Math.max(x0 + 1, Math.min(imgW, x1));
    y0 = Math.max(0, y0);
    y1 = Math.max(y0 + 1, y1);
    var sw = x1 - x0;
    var sh = y1 - y0;
    var data;
    try {
      data = ctx.getImageData(x0, y0, sw, sh).data;
    } catch (_) {
      return { r: 0, g: 0, b: 0 };
    }
    var r = 0;
    var g = 0;
    var b = 0;
    var c = 0;
    for (var i = 0; i < data.length; i += 4) {
      var a = data[i + 3];
      if (a < 80) continue;
      // Prefer saturated pixels (role icons) when sampling role band
      var rr = data[i];
      var gg = data[i + 1];
      var bb = data[i + 2];
      var mx = Math.max(rr, gg, bb);
      var mn = Math.min(rr, gg, bb);
      if (mx < 30) continue;
      var sat = mx === 0 ? 0 : (mx - mn) / mx;
      var wgt = 1 + sat * 3;
      r += rr * wgt;
      g += gg * wgt;
      b += bb * wgt;
      c += wgt;
    }
    if (!c) return { r: 0, g: 0, b: 0 };
    return { r: Math.round(r / c), g: Math.round(g / c), b: Math.round(b / c) };
  }

  function colorDist(a, b) {
    if (!a || !b) return 9999;
    var dr = (a.r || 0) - (b.r || 0);
    var dg = (a.g || 0) - (b.g || 0);
    var db = (a.b || 0) - (b.b || 0);
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  function isIosSafariUi() {
    var ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
    if (/iPad|iPhone|iPod/i.test(ua)) return true;
    // iPadOS desktop UA
    if (
      typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1
    )
      return true;
    return false;
  }

  function loadImageUrl(url, timeoutMs) {
    return new Promise(function (resolve) {
      if (!url) {
        resolve(null);
        return;
      }
      var done = false;
      var ms = timeoutMs == null ? 1600 : timeoutMs;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try {
          img.src = '';
        } catch (_) {}
        resolve(null);
      }, ms);
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(null);
      };
      img.src = url;
    });
  }

  async function avgRgbOfUrl(url) {
    var img = await loadImageUrl(url, 1600);
    if (!img) return null;
    var c = document.createElement('canvas');
    var tw = 32;
    var th = 32;
    c.width = tw;
    c.height = th;
    var ctx = c.getContext('2d', { willReadFrequently: true });
    try {
      ctx.drawImage(img, 0, 0, tw, th);
      return sampleRegionAvg(ctx, tw, 0, tw, 0, th);
    } catch (_) {
      return null;
    }
  }

  /** Re-rank candidates: name score + role match + thumb color proximity. */
  async function rerankByThumbAndRole(cands, roleId, thumbRgb) {
    var list = (cands || []).slice();
    if (!list.length) return list;
    // Unique exact name lock (e.g. Sazabi (EX) score≥1200) — MasterData role wins;
    // mis-sampled Durability icon must not demote Attack kits.
    var topName = Number(list[0] && list[0].score) || 0;
    var secondName = Number(list[1] && list[1].score) || 0;
    var uniqueNameLock = topName >= 1200 && topName - secondName >= 400;
    // iOS Safari: CDN crossOrigin portrait loads often never settle → hung "Matching…".
    // Role-only re-rank is enough there; desktop keeps thumb color for Unicorn/Amuro.
    var wantThumb = !!(thumbRgb && !uniqueNameLock && !isIosSafariUi());
    var thumbBudget = wantThumb ? 4 : 0;
    var withAvg = [];
    for (var i = 0; i < Math.min(list.length, 12); i++) {
      var c = list[i];
      var avg = null;
      if (wantThumb && i < thumbBudget && c.thumb) {
        try {
          avg = await avgRgbOfUrl(c.thumb);
        } catch (_) {
          avg = null;
        }
      }
      var score = Number(c.score) || 0;
      if (!uniqueNameLock) {
        if (roleId && c.role_id === roleId) score += 200;
        else if (roleId && c.role_id && c.role_id !== roleId) score -= 250;
      }
      if (avg && thumbRgb) {
        var d = colorDist(avg, thumbRgb);
        // closer = better; typical same portrait ~0–40, different ~80+
        // Cap thumb influence so it cannot overturn a unique name lock
        var thumbBoost = Math.max(0, 180 - d * 2);
        if (uniqueNameLock) thumbBoost = Math.min(thumbBoost, 40);
        score += thumbBoost;
        c._thumb_dist = Math.round(d);
      }
      c._final = score;
      withAvg.push(c);
    }
    // Keep remaining unscored at end
    for (var j = 12; j < list.length; j++) {
      list[j]._final = Number(list[j].score) || 0;
      withAvg.push(list[j]);
    }
    withAvg.sort(function (a, b) {
      return (b._final || 0) - (a._final || 0);
    });
    return withAvg;
  }

  function loadFileAsImage(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  /** Mild variants only — harsh contrast preprocess destroyed Sorties text. */
  function buildOcrVariants(img) {
    var variants = [];
    if (!img) return variants;
    function canvasFrom(sx, sy, sw, sh, scale, gray) {
      var w = Math.max(1, Math.round(sw * scale));
      var h = Math.max(1, Math.round(sh * scale));
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      if (gray) {
        var id = ctx.getImageData(0, 0, w, h);
        var d = id.data;
        for (var i = 0; i < d.length; i += 4) {
          var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          d[i] = d[i + 1] = d[i + 2] = g;
        }
        ctx.putImageData(id, 0, 0);
      }
      return c;
    }
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var scale = iw < 900 ? 2 : iw > 1600 ? 1400 / iw : 1.25;
    // Full frame
    variants.push(canvasFrom(0, 0, iw, ih, scale, false));
    // Name+Sorties band (drop left thumbs ~22%, drop top chrome ~8%)
    var cx = Math.round(iw * 0.22);
    var cy = Math.round(ih * 0.08);
    variants.push(canvasFrom(cx, cy, iw - cx, ih - cy, scale, false));
    variants.push(canvasFrom(cx, cy, iw - cx, ih - cy, scale, true));
    return variants;
  }

  async function recognizeOnce(Tess, source, langPack) {
    var result = await Tess.recognize(source, langPack, { logger: function () {} });
    return (result && result.data && result.data.text) || '';
  }

  /** Right-side Sorties digit column — Tess often drops numbers in full-frame OCR. */
  async function ocrSortiesDigitColumn(Tess, file) {
    var img = await loadFileAsImage(file);
    if (!img) return [];
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    var left = Math.floor(iw * 0.78);
    var top = Math.floor(ih * 0.1);
    var bottom = Math.floor(ih * 0.94);
    var c = document.createElement('canvas');
    var scale = 2.5;
    c.width = Math.max(1, Math.round((iw - left) * scale));
    c.height = Math.max(1, Math.round((bottom - top) * scale));
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#0a1224';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, left, top, iw - left, bottom - top, 0, 0, c.width, c.height);
    // Mild boost — keep digits bright
    try {
      var id = ctx.getImageData(0, 0, c.width, c.height);
      var d = id.data;
      for (var i = 0; i < d.length; i += 4) {
        var g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        g = g > 110 ? 255 : g < 70 ? 0 : g;
        d[i] = d[i + 1] = d[i + 2] = g;
      }
      ctx.putImageData(id, 0, 0);
    } catch (_) {}
    var text = '';
    try {
      var result = await Tess.recognize(c, 'eng', {
        logger: function () {},
        tessedit_char_whitelist: '0123456789,'
      });
      text = (result && result.data && result.data.text) || '';
    } catch (_) {
      text = await recognizeOnce(Tess, c, 'eng');
    }
    var nums = [];
    var re = /(\d{1,3}(?:,\d{3})+|\d{3,7})/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var n = parseOcrNum(m[1]);
      if (Number.isFinite(n) && n >= 80 && n <= 500000) nums.push(n);
    }
    return nums;
  }

  function mergeDigitColumnIntoRows(rows, digits) {
    if (!rows || !rows.length || !digits || !digits.length) return rows;
    // Never index-zip a short digit column onto rows — that shifts every count
    // (missing top 2828 → Sazabi gets Hi-Nu's 2800).
    if (digits.length < rows.length) {
      var used = {};
      rows.forEach(function (r) {
        if (r.sorties >= 80) used[r.sorties] = true;
      });
      var pool = digits
        .slice()
        .sort(function (a, b) {
          return b - a;
        })
        .filter(function (d) {
          return !used[d];
        });
      var pi = 0;
      return rows.map(function (r) {
        if (r.sorties >= 80) return r;
        if (pi >= pool.length) return r;
        var d = pool[pi++];
        return Object.assign({}, r, { sorties: d });
      });
    }
    // Prefer filling missing/weak counts; if every row already has a solid count, keep them.
    var weak = rows.filter(function (r) {
      return !r.sorties || r.sorties < 80;
    }).length;
    if (weak === 0 && rows.length >= 5) {
      // Repair off-by-one: screen order must be descending
      var cur = rows.map(function (r) {
        return r.sorties || 0;
      });
      var desc = cur.slice().sort(function (a, b) {
        return b - a;
      });
      var mono = cur.every(function (v, i) {
        return i === 0 || cur[i - 1] >= v;
      });
      if (!mono && desc.length === cur.length) {
        return rows.map(function (r, idx) {
          return Object.assign({}, r, { sorties: desc[idx] });
        });
      }
      return rows;
    }
    var sortedDigits = digits.slice().sort(function (a, b) {
      return b - a;
    });
    return rows.map(function (r, idx) {
      var d = sortedDigits[idx];
      if (d == null) return r;
      if (!r.sorties || r.sorties < 80) {
        return Object.assign({}, r, { sorties: d });
      }
      return r;
    });
  }

  async function ocrFile(Tess, file, langPack, opts) {
    opts = opts || {};
    var slot = String(opts.slot || '');
    var isSortiesSlot = /^(units|chars)/.test(slot);
    // Prefer server RapidOCR when available (Sorties / Main / Battle / Haro)
    if (opts.preferServer !== false) {
      var rapid = await ocrViaServer(file, slot);
      if (rapid && rapid.length >= 8) {
        if (isSortiesSlot) {
          if (scoreOcrForSorties(rapid) >= 300) return rapid;
        } else if (slot === 'main') {
          // Never feed a Sorties list OCR into Profile · Main parsers
          // (detector OR high Sorties parse score — OCR often drops the word "Sorties")
          if (ocrIsSortiesNotMain(rapid)) return '';
          return rapid;
        } else if (slot === 'haro' || slot === 'battle') {
          if (!ocrIsSortiesNotMain(rapid)) return rapid;
        } else if (scoreOcrForSorties(rapid) >= 300) {
          return rapid;
        }
      }
    }
    // Fast path: original bytes first
    var bestText = await recognizeOnce(Tess, file, langPack);
    if (isSortiesSlot) {
      var bestScore = scoreOcrForSorties(bestText);
      if (bestScore >= 500) return bestText;
      var img = await loadFileAsImage(file);
      var variants = buildOcrVariants(img);
      for (var i = 0; i < variants.length; i++) {
        try {
          var text = await recognizeOnce(Tess, variants[i], langPack);
          var sc = scoreOcrForSorties(text);
          if (sc > bestScore) {
            bestScore = sc;
            bestText = text;
          }
          if (bestScore >= 800) break;
        } catch (_) {}
      }
      return bestText;
    }
    // Main / Haro / Battle: reject Tess if it is a Sorties board
    if (
      (slot === 'main' || slot === 'haro' || slot === 'battle') &&
      ocrIsSortiesNotMain(bestText)
    ) {
      return '';
    }
    return bestText;
  }

  /** True when blob is a Sorties Units/Chars list, not Profile · Main. */
  function ocrIsSortiesNotMain(text) {
    var raw = String(text || '');
    if (!raw.trim()) return false;
    if (looksLikeProfileMainOcr(raw)) return false;
    if (looksLikeSortiesOcr(raw)) return true;
    // RapidOCR often garbles the "Sorties" header but still yields 5+ kit rows
    if (scoreOcrForSorties(raw) >= 450) return true;
    var rows = parseOcrText(raw);
    if (rows && rows.length >= 5) return true;
    return false;
  }

  /** Parse one Sorties list row crop (name + count, noisy OK). */
  function parseSingleSortieRow(text) {
    var blob = String(text || '')
      .replace(/[０-９]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30);
      })
      .replace(/[·•|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!blob) return null;
    // Prefer last (EX)/(SP) kit — walk back from suffix so junk prefixes don't stick
    var exHits = [];
    var endRe = /\((?:EX|SP)\)/gi;
    var em;
    while ((em = endRe.exec(blob)) !== null) {
      var end = em.index + em[0].length;
      var before = blob.slice(Math.max(0, em.index - 56), em.index).trim();
      var toks = before.split(/\s+/).filter(Boolean);
      // Trailing window: first real kit token → (EX) (keeps "Hi-Nu Gundam", drops scrap)
      var win = toks.slice(Math.max(0, toks.length - 6));
      // Keep only the trailing run of plausible name tokens (reset on OCR scrap)
      var goodRun = [];
      for (var ti = 0; ti < win.length; ti++) {
        var tok = win[ti];
        var bare = tok.replace(/[^A-Za-z0-9\-]/g, '');
        var paren = /^\([A-Za-z0-9]+\)$/.test(tok);
        var ok =
          paren ||
          (/^[A-Z][A-Za-z\-]{1,}$/.test(bare) &&
            bare.length >= 2 &&
            (/[a-z]/.test(bare) || bare.length >= 4) &&
            !/\d/.test(bare) &&
            !/(.)\1\1/i.test(bare) &&
            !(bare.length >= 6 && !/[aeiouy]/i.test(bare)));
        if (ok) goodRun.push(tok);
        else goodRun = [];
      }
      toks = goodRun;
      if (!toks.length) continue;
      var kitName = cleanOcrKitName(toks.join(' ') + ' ' + em[0]);
      if (isOcrJunkName(kitName)) continue;
      exHits.push({
        name: kitName,
        index: em.index - before.length,
        end: end
      });
    }
    if (exHits.length) {
      var hit = exHits[exHits.length - 1];
      var after = blob.slice(hit.end);
      var numAfter = after.match(/(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7})/);
      var numTok = numAfter && numAfter[1];
      if (!numTok) {
        var beforeNums = blob.slice(0, hit.index).match(/(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7})/g);
        if (beforeNums && beforeNums.length) numTok = beforeNums[beforeNums.length - 1];
      }
      if (numTok) {
        var sEx = parseOcrNum(numTok);
        if (hit.name && !isOcrJunkName(hit.name) && sEx >= 10) {
          return { name: hit.name, sorties: sEx };
        }
      }
    }
    var fromList = parseOcrText(blob);
    if (fromList.length === 1) {
      return { name: fromList[0].name, sorties: fromList[0].sorties };
    }
    if (fromList.length > 1) {
      var prefer =
        fromList.find(function (r) {
          return /\((?:EX|SP)\)/i.test(r.name);
        }) || fromList[0];
      return { name: prefer.name, sorties: prefer.sorties };
    }
    var loose = parseOcrTextLoose(blob);
    if (loose.length) {
      return { name: loose[loose.length - 1].name, sorties: loose[loose.length - 1].sorties };
    }
    var m = blob.match(/^(.*?)(\d{1,3}(?:[,.\s]\d{3})+|\d{2,7})\s*$/);
    if (!m) return null;
    var name = cleanOcrKitName(m[1]);
    var sorties = parseOcrNum(m[2]);
    if (isOcrJunkName(name) || !Number.isFinite(sorties) || sorties < 10) return null;
    return { name: name, sorties: sorties };
  }

  /**
   * Expert OCR path for Profile → Sorties lists.
   * Rank = on-screen row order (1…10). Never re-rank by OCR'd Sorties —
   * misread digits were promoting e.g. Exia above Sazabi.
   * Crops only the middle list (ignore left rank badge + right featured art).
   * Per row: name band + digits-only Sorties band.
   */
  async function ocrSortiesListByRows(Tess, file, langPack, opts) {
    opts = opts || {};
    var expected = Math.max(5, Math.min(12, opts.expectedRows || 10));
    var baseRank = opts.baseRank || 1;
    var onProgress = opts.onProgress;
    var img = await loadFileAsImage(file);
    if (!img) {
      var fallbackText = await ocrFile(Tess, file, langPack);
      var loose = parseOcrText(fallbackText).slice(0, expected);
      return {
        rows: loose.map(function (r, i) {
          return {
            rank: baseRank + i,
            name: r.name,
            sorties: r.sorties
          };
        }),
        rawText: fallbackText
      };
    }
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    // Middle list only — skip left rank/thumb chrome and right portrait art
    var listLeft = Math.floor(iw * 0.28);
    var listRight = Math.floor(iw * 0.72);
    var nameRight = Math.floor(iw * 0.58);
    var top = Math.floor(ih * 0.11);
    var bottom = Math.floor(ih * 0.94);
    var listH = Math.max(1, bottom - top);
    var rowH = listH / expected;

    function cropBand(x0, x1, y0, bandH, scale) {
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round((x1 - x0) * scale));
      c.height = Math.max(1, Math.round(bandH * scale));
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = '#0a1224';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, x0, y0, x1 - x0, bandH, 0, 0, c.width, c.height);
      return c;
    }

    async function ocrDigitsCanvas(c) {
      try {
        var result = await Tess.recognize(c, 'eng', {
          logger: function () {},
          tessedit_char_whitelist: '0123456789,'
        });
        return (result && result.data && result.data.text) || '';
      } catch (_) {
        return recognizeOnce(Tess, c, 'eng');
      }
    }

    var rows = [];
    var rawChunks = [];
    for (var i = 0; i < expected; i++) {
      if (typeof onProgress === 'function') onProgress(i + 1, expected);
      var y0 = top + rowH * i;
      var bandH = Math.max(28, Math.floor(rowH * 0.9));
      var scale = 2.4;
      var nameCanvas = cropBand(listLeft, nameRight, y0, bandH, scale);
      var digCanvas = cropBand(nameRight, listRight, y0, bandH, scale * 1.1);
      var nameText = await recognizeOnce(Tess, nameCanvas, langPack);
      var digText = await ocrDigitsCanvas(digCanvas);
      rawChunks.push(nameText + ' ' + digText);

      var parsed = parseSingleSortieRow(nameText + ' ' + digText);
      var digNums = [];
      var dm;
      var digRe = /(\d{1,3}(?:,\d{3})+|\d{3,7})/g;
      while ((dm = digRe.exec(String(digText || ''))) !== null) {
        var dn = parseOcrNum(dm[1]);
        if (Number.isFinite(dn) && dn >= 80 && dn <= 500000) digNums.push(dn);
      }
      var sorties = parsed && parsed.sorties >= 80 ? parsed.sorties : digNums[0] || 0;
      var name = parsed ? parsed.name : '';
      if (!name || isOcrJunkName(name)) {
        // Keep a cleaned name line even when Sorties parse failed
        var looseName = cleanOcrKitName(
          String(nameText || '')
            .replace(/\d{1,3}(?:,\d{3})+|\d{3,7}/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        );
        if (looseName && !isOcrJunkName(looseName)) name = looseName;
      }
      rows.push({
        rank: baseRank + i,
        name: name || '',
        sorties: sorties || 0,
        ocr_raw: String(nameText || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 100)
      });
    }

    return { rows: rows, rawText: rawChunks.join('\n') };
  }

  async function runOcrPipeline() {
    if (!state.lang) {
      setStatus(t('status_need_lang'));
      return;
    }
    if (!state.slots.units_1_10) {
      setStatus(t('status_need_units'));
      return;
    }
    try {
      // Fresh OCR every Read — clear Sorties text + per-slot row cache (no Main crosstalk)
      ['units_1_10', 'units_11_20', 'chars_1_10', 'chars_11_20', 'main', 'haro'].forEach(
        function (k) {
          state.slotOcr[k] = '';
        }
      );
      state.slotOcr.battle = [];
      _ocrRowsBySlot = {};
      ocrViaServer.lastRows = null;

      var Tess = await ensureTesseract();
      var langPack = tessLangFor(state.lang);

      var nFiles =
        (state.slots.main ? 1 : 0) +
        (state.slots.units_1_10 ? 1 : 0) +
        (state.slots.units_11_20 ? 1 : 0) +
        (state.slots.chars_1_10 ? 1 : 0) +
        (state.slots.chars_11_20 ? 1 : 0) +
        (state.slots.haro ? 1 : 0) +
        (state.slots.battle || []).length;
      setStatus(t('status_ocr', { n: nFiles }), { loading: true });

      async function textForSlot(key) {
        if (!state.slots[key]) return '';
        if (state.slotOcr[key]) return state.slotOcr[key];
        var pack =
          key === 'main' ? tessLangForPlayerName() : langPack;
        var text = await ocrFile(Tess, state.slots[key], pack, { slot: key });
        // Main: second pass with name-friendly pack if Rapid missed CJK name
        if (key === 'main' && text) {
          var hasCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text);
          if (!hasCjk && !extractPlayerNameLocal(text)) {
            try {
              var namePass = await recognizeOnce(Tess, state.slots[key], tessLangForPlayerName());
              if (namePass) text = text + '\n' + namePass;
            } catch (_) {}
          }
        }
        state.slotOcr[key] = text;
        return text;
      }

      // Main Profile page → name / level / title / pts / Haro
      state.mainMeta = null;
      state.battleResults = null;
      var mainText = '';
      var haroText = '';
      if (state.slots.main) {
        setStatus(t('status_ocr', { n: nFiles }) + ' · Main', { loading: true });
        mainText = await textForSlot('main');
        if (ocrIsSortiesNotMain(mainText)) {
          setStatus(
            t('status_wrong_screen', { kind: 'Sorties · Units/Characters' }) +
              ' → Profile · Main'
          );
          state.mainMeta = { wrong_screen: 'sorties' };
          mainText = '';
        } else {
          state.mainMeta = parseMainProfileOcr(mainText);
        }
      }
      if (state.slots.haro) {
        setStatus(t('status_ocr', { n: nFiles }) + ' · Haro', { loading: true });
        haroText = await textForSlot('haro');
        var haroParsed = parseMainProfileOcr(haroText);
        if (!state.mainMeta) state.mainMeta = haroParsed;
        else if (haroParsed.haro) {
          state.mainMeta.haro = state.mainMeta.haro || {};
          ['gold', 'silver', 'bronze'].forEach(function (k) {
            if (state.mainMeta.haro[k] == null && haroParsed.haro[k] != null) {
              state.mainMeta.haro[k] = haroParsed.haro[k];
            }
          });
          if (!state.mainMeta.player_name && haroParsed.player_name) {
            state.mainMeta.player_name = haroParsed.player_name;
          }
        }
      }

      var battleText = '';
      for (var bi = 0; bi < (state.slots.battle || []).length; bi++) {
        setStatus(
          t('status_ocr', { n: nFiles }) + ' · Battle ' + (bi + 1),
          { loading: true }
        );
        var bt = await ocrFile(Tess, state.slots.battle[bi], langPack, {
          slot: 'battle'
        });
        if (!Array.isArray(state.slotOcr.battle)) state.slotOcr.battle = [];
        state.slotOcr.battle[bi] = bt;
        battleText += '\n' + bt;
      }
      state._battleOcr = battleText;

      // Server LANG-aware parse for name / battle metrics / Haro
      setStatus(t('status_ocr', { n: nFiles }) + ' · parse', { loading: true });
      var parsedScreens = await parseScreensOnServer(mainText, battleText, haroText);
      if (parsedScreens) {
        if (parsedScreens.meta) {
          if (parsedScreens.meta.wrong_screen === 'sorties') {
            // Server refused Sorties-as-Main — wipe any client-side name/rank pollution
            state.mainMeta = {
              wrong_screen: 'sorties',
              player_name: null,
              player_level: null,
              rank: null,
              profile_rank_title: null,
              achievement_pts: null,
              haro: (state.mainMeta && state.mainMeta.haro) || {
                gold: null,
                silver: null,
                bronze: null
              }
            };
          } else {
            state.mainMeta = state.mainMeta || {};
            Object.keys(parsedScreens.meta).forEach(function (k) {
              if (parsedScreens.meta[k] != null && parsedScreens.meta[k] !== '') {
                state.mainMeta[k] = parsedScreens.meta[k];
              }
            });
          }
        }
        if (parsedScreens.battle_results && Object.keys(parsedScreens.battle_results).length) {
          state.battleResults = parsedScreens.battle_results;
        }
        if (parsedScreens.haro_trophies) {
          state.mainMeta = state.mainMeta || {};
          state.mainMeta.haro = state.mainMeta.haro || {};
          ['gold', 'silver', 'bronze'].forEach(function (k) {
            if (
              state.mainMeta.haro[k] == null &&
              parsedScreens.haro_trophies[k] != null
            ) {
              state.mainMeta.haro[k] = parsedScreens.haro_trophies[k];
            }
          });
        }
      }

      await matchAndShow([], []);
      return;
    } catch (err) {
      setStatus(t('status_err', { err: (err && err.message) || String(err) }));
    }
  }

  async function matchAndShow(units, chars) {
    // units/chars args unused — Sorties slots are OCR'd here (fixture path).
    void units;
    void chars;

    /** Match already-parsed name+sorties rows (demo shape) to catalog ids. */
    async function matchKind(kind, rows, preferBlob) {
      if (!rows.length) return [];
      var res = await fetch('/api/profile_insights/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: state.lang,
          kind: kind,
          mode: preferBlob ? 'ocr_blob' : '',
          names: rows.map(function (r) {
            var nm = String(r.name || '').trim();
            var raw = String(r.ocr_raw || '').trim();
            // Ordered RapidOCR often recovers a full (EX)/(SP) name while ocr_raw is
            // still glued ("Destroy Mo2…"). Matching the glued blob + wrong role icon
            // flips Awakened → plain Destroy Mode. Prefer the solid kit name.
            var solidKit =
              /\(EX\)|\(SP\)|（EX）|（SP）/i.test(nm) &&
              nm.length >= 8 &&
              !/\d{3,}/.test(nm);
            return {
              name: nm,
              ocr_raw: solidKit ? '' : preferBlob ? raw || nm : '',
              sorties: r.sorties,
              rank: r.rank,
              role: r.role_id || undefined,
              role_id: r.role_id || undefined
            };
          })
        })
      }).then(function (r) {
        return r.json();
      });
      var out = [];
      var nRes = (res.results || []).length;
      for (var i = 0; i < nRes; i++) {
        if (i === 0 || i % 3 === 0) {
          setStatus(
            t('status_match', { lang: state.lang }) +
              ' · ' +
              kind +
              ' ' +
              (i + 1) +
              '/' +
              nRes,
            { loading: true }
          );
        }
        var block = res.results[i];
        var base = rows[i] || {};
        var cands = block.candidates || [];
        if (base.role_id || base.thumb_rgb) {
          try {
            cands = await rerankByThumbAndRole(cands, base.role_id, base.thumb_rgb);
          } catch (_) {
            /* keep server order */
          }
        }
        var best = cands[0] || null;
        var bestScore = best ? Number(best._final || best.score) || 0 : 0;
        // NEVER take match-API sorties (extract used to return max() across the blob).
        // Screen-order OCR row owns the count.
        var sorties = Number(base.sorties);
        if (!Number.isFinite(sorties) || sorties < 80) sorties = 0;
        // Long Unicorn rows: role+thumb already re-ranked — lock a bit earlier
        var unicornish = /unicorn|ユニコーン|獨角獸|独角兽|phenex|フェネクス|destroy\s*mo|デストロイ|毀滅|破壞/i.test(
          String(base.name || base.ocr_raw || '')
        );
        var lockFloor = preferBlob ? 280 : 450;
        if (unicornish && (base.role_id || base.thumb_rgb) && bestScore >= 350) {
          lockFloor = 350;
        }
        // Clean LANG name when catalog lock is solid (same as demo confirm)
        var locked = best && bestScore >= lockFloor;
        var slimCands = (cands || []).slice(0, locked ? 4 : 6);
        // Locked kit → always show MasterData role (never mis-sampled icon color)
        var catalogRole =
          (best && best.role_id) || null;
        var visualRole = base.role_id || block.role_hint || null;
        out.push({
          rank: base.rank || i + 1,
          name: locked && best ? best.name : base.name || '',
          sorties: sorties || '',
          ocr_raw: base.ocr_raw || '',
          role_id: locked && catalogRole ? catalogRole : visualRole || catalogRole,
          role_hint: locked && catalogRole ? catalogRole : visualRole || catalogRole,
          thumb_rgb: base.thumb_rgb || null,
          candidates: slimCands,
          id: locked && best ? best.id : '',
          matched_name: locked && best ? best.name : '',
          matched_thumb: locked && best ? best.thumb : '',
          score: bestScore
        });
      }
      return out;
    }

    /**
     * Primary: per-row middle-list OCR (screen rank order).
     * Fallback: full-frame parse / catalog scan only when bands are empty.
     */
    async function readSortieSlot(kind, slotKey, baseRank) {
      var file = state.slots[slotKey];
      if (!file) return [];
      var Tess = window.Tesseract || (await ensureTesseract());
      var langPack = tessLangFor(state.lang);

      setStatus(t('status_ocr', { n: 1 }) + ' · role icons ' + slotKey, {
        loading: true
      });
      var visRows = await detectRowVisuals(file, 10);

      // A0) Server RapidOCR (local experiment only) + ordered rows (keep role_id)
      setStatus(t('status_ocr_got') + ' · ' + slotKey, { loading: true });
      var rapidText = await ocrViaServer(file, slotKey);
      if (rapidText) {
        state.slotOcr[slotKey] = rapidText;
        var wrongR = detectWrongSortieScreen(rapidText);
        // All Sorties slots (units_1_10 / _11_20 / chars_*) — not only units_1*
        if (wrongR && /^(units|chars)/.test(slotKey)) {
          // Pure Profile · Main in a Sorties slot → empty. Mixed chrome+kits → filter junk below.
          var kitProbe = filterSortieKitRows(
            (_ocrRowsBySlot[slotKey] || parseOcrText(rapidText) || []).slice(0, 15)
          );
          if (kitProbe.length < 5) {
            setStatus(t('status_wrong_screen', { kind: wrongR }));
            return [];
          }
        }
        // Prefer worker rows (GOT/layout already parsed + role_id). Re-parse text only if missing.
        var ordered = _ocrRowsBySlot[slotKey] || null;
        if (!ordered || ordered.length < 5) {
          try {
            var pr = await fetch('/api/profile_insights/parse_sorties', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ text: rapidText })
            }).then(function (r) {
              return r.json();
            });
            if (pr && pr.rows && pr.rows.length) ordered = pr.rows;
          } catch (_) {}
        }
        var rapidParsed = filterSortieKitRows(
          ordered && ordered.length
            ? ordered.map(function (r) {
                return {
                  rank: r.rank,
                  name: r.name || '',
                  sorties: r.sorties || 0,
                  ocr_raw: r.ocr_raw || r.name || '',
                  role_id: r.role_id || null
                };
              })
            : parseOcrText(rapidText)
        );
        // Do NOT re-zip digit streams here — Unicorn #6 glue (Mode↔2,183 overlap)
        // poisons appearance-order counts and shifts every row from #6 down.
        rapidParsed = rapidParsed.slice(0, 10);
        if (rapidParsed.length >= 5) {
          var seededRapid = rapidParsed.map(function (r, idx) {
            var vis = visRows[idx] || {};
            // Prefer server column-OCR role (same fixed UI x/y) over client sample
            return {
              rank: baseRank + idx,
              name: r.name || '',
              sorties: r.sorties || 0,
              ocr_raw: r.ocr_raw || r.name || '',
              role_id: r.role_id || vis.role_id || null,
              thumb_rgb: vis.thumb_rgb || null
            };
          });
          // Prefer blob match so truncated Unicorn + role can still lock
          setStatus(t('status_match', { lang: state.lang }) + ' · ' + kind, {
            loading: true
          });
          return await matchKind(kind, seededRapid, true);
        }
      }

      setStatus(t('status_ocr', { n: 1 }) + ' · rows ' + slotKey, { loading: true });
      var bandPack = await ocrSortiesListByRows(Tess, file, langPack, {
        expectedRows: 10,
        baseRank: baseRank,
        onProgress: function (cur, total) {
          setStatus(
            t('status_ocr', { n: 1 }) + ' · ' + slotKey + ' ' + cur + '/' + total,
            { loading: true }
          );
        }
      });
      state.slotOcr[slotKey] = (state.slotOcr[slotKey] || '') + '\n' + (bandPack.rawText || '');

      var wrong = detectWrongSortieScreen(bandPack.rawText || '');
      if (wrong && /^(units|chars)/.test(slotKey)) {
        var bandProbe = filterSortieKitRows(bandPack.rows || []);
        if (bandProbe.length < 5) {
          setStatus(t('status_wrong_screen', { kind: wrong }));
          return [];
        }
      }

      var bandRows = filterSortieKitRows(bandPack.rows || []);
      var solidBands = bandRows.length;

      // A) Screen-order bands — this is the expert OCR path (Sazabi stays #1)
      if (solidBands >= 5) {
        var seeded = bandRows.slice(0, 10).map(function (r, idx) {
          var vis = visRows[idx] || {};
          return {
            rank: baseRank + idx,
            name: r.name || '',
            sorties: r.sorties || 0,
            ocr_raw: r.ocr_raw || '',
            role_id: vis.role_id || null,
            thumb_rgb: vis.thumb_rgb || null
          };
        });
        setStatus(t('status_match', { lang: state.lang }) + ' · ' + kind, {
          loading: true
        });
        return await matchKind(kind, seeded, false);
      }

      // B) Full-frame parse — keep screen order via sorties only as weak fill
      setStatus(t('status_ocr', { n: 1 }) + ' · full ' + slotKey, { loading: true });
      var fullText = await ocrFile(Tess, file, langPack);
      if (fullText) state.slotOcr[slotKey] = (state.slotOcr[slotKey] || '') + '\n' + fullText;
      var parsed = filterSortieKitRows(parseOcrText(fullText));
      try {
        parsed = filterSortieKitRows(
          mergeDigitColumnIntoRows(parsed, await ocrSortiesDigitColumn(Tess, file))
        );
      } catch (_) {}
      parsed = parsed.slice(0, 10);
      if (parsed.length >= 5) {
        // Pure full-frame kit rows only (never pad with Profile · Main chrome)
        var seededFull = parsed.map(function (r, idx) {
          var vis = visRows[idx] || {};
          return {
            rank: baseRank + idx,
            name: r.name || '',
            sorties: r.sorties || 0,
            ocr_raw: r.ocr_raw || '',
            role_id: vis.role_id || null,
            thumb_rgb: vis.thumb_rgb || null
          };
        });
        setStatus(t('status_match', { lang: state.lang }) + ' · ' + kind, {
          loading: true
        });
        return await matchKind(kind, seededFull, false);
      }

      // C) Catalog scan — last resort; still assign ranks by sorties desc
      setStatus(t('status_match', { lang: state.lang }) + ' · scan ' + kind, {
        loading: true
      });
      var res = await fetch('/api/profile_insights/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: state.lang,
          kind: kind,
          mode: 'scan',
          limit: 12,
          names: [{ ocr_raw: fullText || bandPack.rawText || '', name: fullText || '' }]
        })
      }).then(function (r) {
        return r.json();
      });
      var scanned = ((res.results || [])[0] || {}).rows || [];
      if (scanned.length >= 3) {
        return scanned.slice(0, 10).map(function (c, idx) {
          var vis = visRows[idx] || {};
          return {
            rank: baseRank + idx,
            name: c.name || '',
            sorties: c.sorties || 0,
            ocr_raw: '',
            role_id: vis.role_id || c.role_id || null,
            role_hint: vis.role_id || c.role_id || null,
            thumb_rgb: vis.thumb_rgb || null,
            candidates: [c],
            id: c.id || '',
            matched_name: c.name || '',
            matched_thumb: c.thumb || '',
            score: c.score || 900
          };
        });
      }

      if (bandRows.length) {
        return await matchKind(
          kind,
          (bandPack.rows || []).map(function (r, idx) {
            var vis = visRows[idx] || {};
            return {
              rank: baseRank + idx,
              name: r.name || '',
              sorties: r.sorties || 0,
              ocr_raw: r.ocr_raw || '',
              role_id: vis.role_id || null,
              thumb_rgb: vis.thumb_rgb || null
            };
          }),
          true
        );
      }
      return [];
    }

    var unitRows = []
      .concat(await readSortieSlot('unit', 'units_1_10', 1))
      .concat(await readSortieSlot('unit', 'units_11_20', 11));
    var charRows = []
      .concat(await readSortieSlot('character', 'chars_1_10', 1))
      .concat(await readSortieSlot('character', 'chars_11_20', 11));

    state.unitRows = unitRows;
    state.charRows = charRows;

    if (!state.unitRows.length && state.slots.units_1_10) {
      var rawU = state.slotOcr.units_1_10 || '';
      var wk = detectWrongSortieScreen(rawU);
      if (wk) {
        setStatus(t('status_wrong_screen', { kind: wk }));
        return;
      }
      setStatus(t('status_ocr_weak'));
      return;
    }

    renderConfirmTables();
    renderConfirmMeta();
    $('pfStepConfirm').hidden = false;
    var pn = (state.mainMeta && state.mainMeta.player_name) || '';
    // Fingerprint so we can see if confirm used live OCR (not a stale tab)
    var uFp = (state.unitRows || [])
      .slice(0, 7)
      .map(function (r) {
        return '#' + r.rank + '=' + (r.sorties || '?');
      })
      .join(' ');
    var uNames = (state.unitRows || [])
      .slice(0, 6)
      .map(function (r) {
        return (
          '#' +
          r.rank +
          ':' +
          String(r.matched_name || r.name || '?')
            .replace(/\s*\((?:EX|SP)\)\s*$/i, '')
            .slice(0, 18)
        );
      })
      .join(' · ');
    var fpEl = $('pfConfirmFp');
    if (fpEl) {
      fpEl.textContent =
        'confirm fp: ' +
        PROFILE_JS_BUILD +
        (uFp ? ' · ' + uFp : '') +
        (uNames ? ' · ' + uNames : '');
    }
    setStatus(
      t('status_ready') +
        ' · ' +
        PROFILE_JS_BUILD +
        (pn ? ' · ' + pn : '') +
        ' · units ' +
        state.unitRows.length +
        '/20 · chars ' +
        state.charRows.length +
        '/20' +
        (uFp ? ' · ' + uFp : '') +
        (state.ocrEngine ? ' · ' + state.ocrEngine : '') +
        (state.battleResults && Object.keys(state.battleResults).length
          ? ' · battle ' + Object.keys(state.battleResults).length
          : '')
    );
  }

  function renderConfirmMeta() {
    var host = $('pfConfirmMeta');
    if (!host) return;
    var mm = state.mainMeta || {};
    var parts = [];
    if (mm.player_name) {
      parts.push(
        '<div class="profile-confirm-meta-name">' + esc(mm.player_name) + '</div>'
      );
    }
    if (mm.player_level != null || mm.rank != null) {
      parts.push(
        '<div class="profile-confirm-meta-stat">Rank ' +
          esc(mm.player_level != null ? mm.player_level : mm.rank) +
          '</div>'
      );
    }
    if (mm.profile_rank_title) {
      parts.push(
        '<div class="profile-confirm-meta-stat">' +
          esc(mm.profile_rank_title) +
          '</div>'
      );
    }
    if (mm.haro && (mm.haro.gold != null || mm.haro.silver != null || mm.haro.bronze != null)) {
      parts.push(
        '<div class="profile-confirm-meta-stat">Haro ' +
          esc(mm.haro.gold != null ? mm.haro.gold : '—') +
          '/' +
          esc(mm.haro.silver != null ? mm.haro.silver : '—') +
          '/' +
          esc(mm.haro.bronze != null ? mm.haro.bronze : '—') +
          '</div>'
      );
    }
    if (state.battleResults && state.battleResults.total_sorties != null) {
      parts.push(
        '<div class="profile-confirm-meta-stat">Σ Sorties ' +
          esc(String(state.battleResults.total_sorties)) +
          '</div>'
      );
    }
    host.innerHTML = parts.length
      ? '<div class="profile-confirm-meta">' + parts.join('') + '</div>'
      : '';
    host.hidden = !parts.length;
  }

  async function rematchConfirmRow(kind, idx, query) {
    var list = kind === 'character' ? state.charRows : state.unitRows;
    var row = list[idx];
    if (!row) return;
    query = String(query || '').trim();
    row.name = query;
    if (query.length < 2) {
      row.candidates = [];
      row.id = '';
      row.matched_name = '';
      row.matched_thumb = '';
      row.score = 0;
      renderConfirmTables();
      return;
    }
    setStatus(t('status_match', { lang: state.lang }), { loading: true });
    var res = await fetch('/api/profile_insights/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lang: state.lang,
        kind: kind,
        names: [
          {
            name: query,
            // Prefer MasterData role already on the row after a prior lock
            role: row.role_hint || row.role_id || undefined,
            role_id: row.role_hint || row.role_id || undefined
          }
        ]
      })
    }).then(function (r) {
      return r.json();
    });
    var block = (res.results || [])[0] || {};
    var cands = block.candidates || [];
    if (row.role_hint || row.role_id || row.thumb_rgb) {
      cands = await rerankByThumbAndRole(
        cands,
        row.role_hint || row.role_id,
        row.thumb_rgb
      );
    }
    var best = cands[0] || null;
    var sc = best ? Number(best._final || best.score) || 0 : 0;
    row.candidates = cands;
    row.id = best && sc >= 500 ? best.id : '';
    row.matched_name = row.id && best ? best.name : '';
    row.matched_thumb = row.id && best ? best.thumb : '';
    row.score = sc;
    if (best && best.role_id) {
      row.role_id = best.role_id;
      row.role_hint = best.role_id;
    }
    // Sorties never change on rematch — only identity
    renderConfirmTables();
    setStatus(t('status_ready'));
  }

  function renderConfirmTables() {
    function fill(tableId, rows, kind) {
      var tb = $(tableId) && $(tableId).querySelector('tbody');
      if (!tb) return;
      tb.innerHTML = '';
      rows.forEach(function (row, idx) {
        var tr = document.createElement('tr');
        var locked = !!(row.id && (row.score >= 500 || row.matched_name));
        // Same display-name kits (Amuro ×2) — short variant list only
        var sameName = (row.candidates || []).filter(function (c) {
          var a = String(c.name || '')
            .toLowerCase()
            .replace(/\s*\((?:ex|sp)\)\s*$/i, '')
            .trim();
          var b = String(row.matched_name || row.name || '')
            .toLowerCase()
            .replace(/\s*\((?:ex|sp)\)\s*$/i, '')
            .trim();
          return a && b && (a === b || a.indexOf(b) >= 0 || b.indexOf(a) >= 0);
        });
        var variantPick = locked && kind === 'character' && sameName.length > 1;
        var candsForSelect = !locked
          ? (row.candidates || []).slice(0, 8)
          : variantPick
            ? sameName.slice(0, 6)
            : row.id
              ? (row.candidates || []).filter(function (c) {
                  return String(c.id) === String(row.id);
                }).slice(0, 1)
              : [];
        var opts = candsForSelect
          .map(function (c) {
            var label =
              esc(c.name) +
              (!locked || variantPick ? ' · ' + esc(c.id) : '');
            if (c.variant) label += ' ★';
            return (
              '<option value="' +
              escAttr(c.id) +
              '"' +
              (c.id === row.id ? ' selected' : '') +
              '>' +
              label +
              '</option>'
            );
          })
          .join('');
        var cls = row.score >= 700 ? 'profile-match-ok' : 'profile-match-warn';
        var rid = row.role_hint || row.role_id || '';
        var ricSrc = ROLE_ICON[rid] ? imgUrl(ROLE_ICON[rid]) : '';
        var roleCell = ricSrc
          ? '<td><img class="profile-role-ic" src="' +
            escAttr(ricSrc) +
            '" alt="" width="22" height="22"></td>'
          : '<td></td>';
        var thumbCell = row.matched_thumb
          ? '<img class="profile-match-th" src="' +
            escAttr(row.matched_thumb) +
            '" alt="" loading="lazy">'
          : '';
        var shownName = row.matched_name || row.name || '';
        var nameCell;
        if (locked) {
          nameCell =
            '<span class="profile-match-locked">' +
            esc(shownName) +
            '</span>' +
            '<button type="button" class="profile-match-edit" data-idx="' +
            idx +
            '" data-kind="' +
            kind +
            '" title="Edit">✎</button>';
        } else {
          nameCell =
            '<input class="profile-match-q" data-idx="' +
            idx +
            '" data-kind="' +
            kind +
            '" value="' +
            escAttr(shownName) +
            '" placeholder="' +
            escAttr(row.ocr_raw || 'Type kit name') +
            '">';
        }
        // No Find button — dropdown + Enter/blur rematch only
        var pickCell = thumbCell;
        if (!locked || variantPick) {
          pickCell +=
            '<select data-idx="' +
            idx +
            '" data-kind="' +
            kind +
            '"' +
            (variantPick ? ' title="Same name — pick kit"' : '') +
            '>' +
            '<option value=""' +
            (row.id ? '' : ' selected') +
            '>— pick —</option>' +
            (opts || '') +
            '</select>';
        } else if (row.id) {
          pickCell +=
            '<span class="profile-match-id" title="' +
            escAttr(row.id) +
            '">✓</span>';
        }
        tr.innerHTML =
          '<td>' +
          esc(row.rank) +
          '</td><td class="' +
          cls +
          '">' +
          nameCell +
          '</td>' +
          roleCell +
          '<td>' +
          esc(row.sorties || '') +
          '</td><td class="profile-match-pick">' +
          pickCell +
          '</td>';
        tb.appendChild(tr);
      });
      tb.querySelectorAll('select').forEach(function (sel) {
        sel.addEventListener('change', function () {
          var i = parseInt(sel.getAttribute('data-idx'), 10);
          var k = sel.getAttribute('data-kind');
          var list = k === 'character' ? state.charRows : state.unitRows;
          if (!list[i]) return;
          list[i].id = sel.value;
          var opt = sel.options[sel.selectedIndex];
          var txt = opt ? opt.textContent : '';
          list[i].matched_name = (txt.split(' · ')[0] || txt)
            .replace(/\s*\[[^\]]+\]\s*$/, '')
            .trim();
          var cand = (list[i].candidates || []).find(function (c) {
            return String(c.id) === String(sel.value);
          });
          list[i].matched_thumb = cand ? cand.thumb : '';
          var img = sel.parentElement && sel.parentElement.querySelector('.profile-match-th');
          if (img && list[i].matched_thumb) img.src = list[i].matched_thumb;
        });
      });
      function runRematch(el) {
        var i = parseInt(el.getAttribute('data-idx'), 10);
        var k = el.getAttribute('data-kind');
        var qEl = tb.querySelector(
          '.profile-match-q[data-idx="' + i + '"][data-kind="' + k + '"]'
        );
        rematchConfirmRow(k, i, qEl ? qEl.value : '');
      }
      tb.querySelectorAll('.profile-match-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var i = parseInt(btn.getAttribute('data-idx'), 10);
          var k = btn.getAttribute('data-kind');
          var list = k === 'character' ? state.charRows : state.unitRows;
          if (!list[i]) return;
          // Unlock for manual edit — keep OCR name and Sorties
          list[i].score = 0;
          list[i].id = '';
          list[i].matched_name = '';
          list[i].matched_thumb = '';
          renderConfirmTables();
          var fresh = document
            .getElementById(tableId)
            .querySelector(
              '.profile-match-q[data-idx="' + i + '"][data-kind="' + k + '"]'
            );
          if (fresh) fresh.focus();
        });
      });
      tb.querySelectorAll('.profile-match-q').forEach(function (inp) {
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            runRematch(inp);
          }
        });
        inp.addEventListener('blur', function () {
          runRematch(inp);
        });
      });
    }
    fill('pfUnitTable', state.unitRows, 'unit');
    fill('pfCharTable', state.charRows, 'character');
  }

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

  function tagCompositeHtml(tg, withShare) {
    var tt = (tg && tg.type) || 'unit';
    var icon =
      tt === 'character'
        ? '/static/images/UI/UI_Common_Icon_Category_Chara_Main.webp'
        : '/static/images/UI/UI_Common_Icon_Category_MS_Main.webp';
    var share =
      withShare && tg.share_pct != null
        ? '<span class="profile-tag-pct" aria-label="' +
          escAttr(String(tg.share_pct) + '%') +
          '">' +
          esc(tg.share_pct) +
          '%</span>'
        : '';
    return (
      '<div class="profile-tag-item">' +
      '<div class="tag-composite tag-composite--lg" title="' +
      escAttr(tg.name || '') +
      '"><div class="tag-part-icon"><img class="tag-icon-fg" src="' +
      escAttr(imgUrl(icon)) +
      '" alt=""></div><div class="tag-part-value">' +
      esc(tg.name || '') +
      '</div></div>' +
      share +
      '</div>'
    );
  }

  async function loadDemo() {
    if (!state.lang) {
      setStatus(t('status_need_lang'));
      return;
    }
    try {
      setStatus(t('status_match', { lang: state.lang }));
      var snap = await fetch('/api/profile_insights/demo').then(function (r) {
        return r.json();
      });
      snap.lang = state.lang;
      state.snapshot = snap;
      state.mainMeta = {
        player_level: (snap.meta && snap.meta.rank) || null,
        profile_rank_title: (snap.meta && snap.meta.profile_rank_title) || null,
        achievement_pts: (snap.meta && snap.meta.achievement_pts) || null,
        haro: snap.haro_trophies || null
      };
      state.unitRows = (snap.sortie_units || []).map(function (u) {
        return {
          rank: u.rank,
          name: u.name,
          sorties: u.sorties,
          id: u.unit_id,
          matched_name: u.name,
          score: 1000,
          candidates: [{ id: u.unit_id, name: u.name, score: 1000 }]
        };
      });
      // Expand character candidates with same-name variants via match API
      var charBase = snap.sortie_chars || [];
      var matchRes = await fetch('/api/profile_insights/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: state.lang,
          kind: 'character',
          names: charBase.map(function (c) {
            return { name: c.name, sorties: c.sorties, rank: c.rank };
          })
        })
      }).then(function (r) {
        return r.json();
      });
      state.charRows = charBase.map(function (c, i) {
        var block = (matchRes.results || [])[i] || {};
        var cands = block.candidates || [];
        // Prefer fixture id if present in candidates
        var pick = cands.find(function (x) {
          return String(x.id) === String(c.character_id);
        });
        if (!pick) {
          cands = [{ id: c.character_id, name: c.name, score: 1000 }].concat(cands);
          pick = cands[0];
        }
        return {
          rank: c.rank,
          name: c.name,
          sorties: c.sorties,
          id: pick.id,
          matched_name: pick.name,
          score: pick.score || 1000,
          candidates: cands
        };
      });
      renderConfirmTables();
      $('pfStepConfirm').hidden = false;
      setStatus(t('status_ready'));
    } catch (err) {
      setStatus(t('status_err', { err: (err && err.message) || String(err) }));
    }
  }

  function buildSnapshotFromConfirm() {
    var battle = Object.assign(
      {},
      (state.snapshot && state.snapshot.battle_results) || {},
      state.battleResults || {}
    );
    var haro = (state.snapshot && state.snapshot.haro_trophies) || {};
    var meta = Object.assign({}, (state.snapshot && state.snapshot.meta) || {});
    var mm = state.mainMeta || {};
    if (mm.player_name) meta.player_name = mm.player_name;
    if (mm.player_level != null) {
      meta.rank = mm.player_level;
      meta.player_level = mm.player_level;
    }
    if (mm.profile_rank_title) meta.profile_rank_title = mm.profile_rank_title;
    if (mm.achievement_pts != null) meta.achievement_pts = mm.achievement_pts;
    if (mm.achievement_pts_next != null) {
      meta.achievement_pts_next = mm.achievement_pts_next;
    }
    if (mm.haro) {
      haro = {
        gold: mm.haro.gold != null ? mm.haro.gold : haro.gold,
        silver: mm.haro.silver != null ? mm.haro.silver : haro.silver,
        bronze: mm.haro.bronze != null ? mm.haro.bronze : haro.bronze
      };
    }
    return {
      schema: 'profile_insights_v1',
      lang: state.lang,
      meta: meta,
      sortie_units: state.unitRows.map(function (r) {
        return {
          rank: r.rank,
          unit_id: r.id,
          name: r.matched_name || r.name,
          sorties: r.sorties
        };
      }),
      sortie_chars: state.charRows.map(function (r) {
        return {
          rank: r.rank,
          character_id: r.id,
          name: r.matched_name || r.name,
          sorties: r.sorties,
          role_id: r.role_id || r.role_hint || undefined
        };
      }),
      battle_results: battle,
      haro_trophies: haro
    };
  }

  function readCollectionsOwned() {
    try {
      var raw = localStorage.getItem('ggen_collections_v1');
      if (!raw) return { units: {} };
      var o = JSON.parse(raw);
      return { units: o.units || {}, supporters: o.supporters || {} };
    } catch (_) {
      return { units: {} };
    }
  }

  async function analyze() {
    if (!state.lang) {
      setStatus(t('status_need_lang'));
      return;
    }
    try {
      setStatus(t('status_analyze'));
      var snap = buildSnapshotFromConfirm();
      var res = await fetch('/api/profile_insights/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot: snap,
          top_n: state.topN || 20,
          collections_owned: readCollectionsOwned()
        })
      }).then(function (r) {
        return r.json();
      });
      if (res.error) throw new Error(res.detail || res.error);
      renderInsights(res);
      $('pfStepInsights').hidden = false;
      setStatus(t('status_done'));
    } catch (err) {
      setStatus(t('status_err', { err: (err && err.message) || String(err) }));
    }
  }

  function renderInsights(data) {
    var host = $('pfInsights');
    if (!host) return;
    var c = data.concentration || {};
    var extra = data.extra_insights || {};
    var listedN = c.listed_count || (data.units_resolved || []).length;
    var html = '';
    var fmt = function (n) {
      if (n == null) return '—';
      if (typeof n === 'number' && Math.abs(n) >= 1000 && n % 1 === 0) {
        return n.toLocaleString ? n.toLocaleString() : String(n);
      }
      return String(n);
    };

    // Player progress (main Profile page)
    var prog = data.player_progress || {};
    if (
      prog.player_level != null ||
      prog.profile_rank_title ||
      prog.exp_to_next != null
    ) {
      html +=
        '<article class="profile-card profile-card--wide"><h3><img class="profile-h3-ic" src="' +
        escAttr(profileAsset('profile_rank_icon_silver_2.webp')) +
        '" alt=""> ' +
        esc(t('progress')) +
        '</h3><p class="profile-explain">' +
        esc(t('progress_hint')) +
        '</p><div class="profile-progress-grid">';
      var snapName =
        (data.meta && data.meta.player_name) ||
        (state.mainMeta && state.mainMeta.player_name) ||
        '';
      if (snapName) {
        html +=
          '<div class="profile-progress-stat"><div class="profile-progress-val">' +
          esc(snapName) +
          '</div><div class="profile-progress-lab">Player name</div></div>';
      }
      html +=
        '<div class="profile-progress-stat"><div class="profile-progress-val">Rank ' +
        esc(prog.player_level != null ? prog.player_level : '—') +
        '</div><div class="profile-progress-lab">Player level</div></div>';
      html +=
        '<div class="profile-progress-stat">' +
        (prog.profile_rank_icon
          ? '<img class="profile-progress-rankic" src="' +
            escAttr(prog.profile_rank_icon) +
            '" alt="">'
          : '') +
        '<div class="profile-progress-val">' +
        esc(prog.profile_rank_title || '—') +
        '</div><div class="profile-progress-lab">Title' +
        (prog.profile_rank_next
          ? ' → ' + esc(prog.profile_rank_next)
          : '') +
        '</div></div>';
      if (prog.achievement_pts != null || prog.pts_to_next_title != null) {
        html +=
          '<div class="profile-progress-stat"><div class="profile-progress-val">' +
          esc(fmt(prog.achievement_pts)) +
          (prog.pts_to_next_title != null
            ? ' <span class="profile-progress-sub">(+'+
              esc(fmt(prog.pts_to_next_title)) +
              ' pts)</span>'
            : '') +
          '</div><div class="profile-progress-lab">' +
          esc(t('title_pts')) +
          '</div></div>';
      }
      if (prog.exp_to_next != null) {
        html +=
          '<div class="profile-progress-stat"><div class="profile-progress-val">' +
          esc(fmt(prog.exp_to_next)) +
          '</div><div class="profile-progress-lab">' +
          esc(t('exp_to_next')) +
          (prog.clears_to_next_at_50 != null
            ? ' · ~' + esc(fmt(prog.clears_to_next_at_50)) + ' ×50'
            : '') +
          '</div></div>';
      }
      html += '</div>';
      if ((prog.days_scenarios || []).length) {
        html +=
          '<h4 class="profile-h4">' +
          esc(t('days_eta')) +
          '</h4><div class="profile-eta-row">';
        prog.days_scenarios.forEach(function (sc) {
          html +=
            '<div class="profile-eta"><div class="profile-eta-days">' +
            esc(sc.days) +
            'd</div><div class="profile-eta-lab">' +
            esc(fmt(sc.exp_per_day)) +
            ' EXP/day<br>~' +
            esc(sc.clears_per_day_at_50) +
            ' clears</div></div>';
        });
        html += '</div>';
      }
      html += '</article>';
    }

    // Concentration — graphic ring + clear “of listed Sorties”
    var concPct = Number(c.top3_share_pct) || 0;
    var listedSum = c.total_listed_sorties || 0;
    html += '<article class="profile-card profile-card--hero">';
    html +=
      '<h3><img class="profile-h3-ic" src="' +
      escAttr(profileAsset('profile_achievements_list_icon_stage.webp')) +
      '" alt=""> ' +
      esc(t('conc')) +
      '</h3>';
    html +=
      '<div class="profile-conc-hero"><div class="profile-conc-ring" style="--pf-conc:' +
      Math.min(100, concPct) +
      '" role="img" aria-label="' +
      escAttr(t('conc_metric', { pct: concPct }) + ' ' + t('conc_of')) +
      '"><div class="profile-conc-ring-inner"><div class="profile-metric">' +
      esc(t('conc_metric', { pct: concPct })) +
      '</div><div class="profile-metric-of">' +
      esc(t('conc_of')) +
      '</div></div></div><div class="profile-conc-copy"><p class="profile-explain profile-explain--lead">' +
      esc(
        t('conc_lead', {
          pct: concPct,
          sum: fmt(listedSum),
          n: listedN
        })
      ) +
      '</p><p class="profile-explain profile-explain--muted">' +
      esc(t('conc_formula', { n: listedN })) +
      '</p><p class="profile-explain profile-explain--muted">' +
      esc(t('conc_not')) +
      '</p></div></div>';
    html += '<div class="profile-unit-bars">';
    (extra.top3_units || data.units_resolved || []).slice(0, 3).forEach(function (u, i) {
      var pct = u.share_pct != null ? u.share_pct : 0;
      html +=
        '<div class="profile-unit-bar"><div class="profile-unit-bar-lab"><span>#' +
        (i + 1) +
        '</span> ' +
        esc(u.name) +
        '</div><div class="profile-unit-bar-track"><span style="width:' +
        Math.min(100, Math.max(4, pct * (100 / Math.max(concPct, 1)))) +
        '%"></span></div><div class="profile-unit-bar-val">' +
        esc(pct) +
        '% of list · ' +
        fmt(u.sorties) +
        ' Sorties</div></div>';
    });
    html +=
      '</div><div class="profile-conc-chips"><span>Top 5 · <strong>' +
      esc(c.top5_share_pct) +
      '%</strong></span><span>Top 10 · <strong>' +
      esc(c.top10_share_pct) +
      '%</strong></span><span>#1 · <strong>' +
      esc(c.top1_share_pct) +
      '%</strong></span></div></article>';

    function rankBars(rows, opts) {
      opts = opts || {};
      var out = '<div class="profile-rank-bars">';
      (rows || []).forEach(function (row, i) {
        var pct = Number(row.share_pct) || 0;
        out +=
          '<div class="profile-rank-bar"><span class="profile-rank-n">' +
          (i + 1) +
          '</span>' +
          (row.icon
            ? '<img class="profile-rank-ic" src="' + escAttr(row.icon) + '" alt="" loading="lazy">'
            : '<span class="profile-rank-ic profile-rank-ic--ph"></span>') +
          '<div class="profile-rank-body"><div class="profile-rank-name">' +
          esc(row.name || '') +
          '</div><div class="profile-rank-track"><span style="width:' +
          Math.min(100, pct) +
          '%"></span></div></div><strong class="profile-rank-pct">' +
          esc(pct) +
          '%</strong></div>';
      });
      if (!(rows || []).length) out += '<span class="profile-supp-meta">—</span>';
      out += '</div>';
      return out;
    }

    function entityStrip(rows, kind) {
      var out = '<div class="profile-entity-strip">';
      (rows || []).slice(0, 20).forEach(function (row) {
        var lb = row.collections_lb;
        var lbHtml = '';
        if (kind === 'unit') {
          if (row.collections_owned) {
            lbHtml =
              '<span class="profile-entity-lb">LB' + esc(lb != null ? lb : '?') + '</span>';
          } else {
            lbHtml =
              '<span class="profile-entity-lb profile-entity-lb--miss">' +
              esc(t('col_lb_miss')) +
              '</span>';
          }
        }
        out +=
          '<div class="profile-entity">' +
          (row.thumb
            ? '<img src="' + escAttr(row.thumb) + '" alt="" loading="lazy">'
            : '<div class="profile-entity-ph"></div>') +
          '<div class="profile-entity-meta"><span class="profile-entity-rank">#' +
          esc(row.rank || '') +
          '</span><span class="profile-entity-name">' +
          esc(row.name || '') +
          '</span><span class="profile-entity-sorties">' +
          fmt(row.sorties) +
          '</span>' +
          lbHtml +
          '</div></div>';
      });
      out += '</div>';
      return out;
    }

    // Lineup gallery
    html +=
      '<article class="profile-card"><h3><img class="profile-h3-ic" src="' +
      escAttr(profileAsset('profile_achievements_list_icon_unit.webp')) +
      '" alt=""> ' +
      esc(t('gallery')) +
      '</h3><div class="profile-gallery-grid"><div><h4 class="profile-h4">Units</h4>' +
      entityStrip(data.units_resolved || [], 'unit') +
      '</div><div><h4 class="profile-h4">Characters</h4>' +
      entityStrip(data.chars_resolved || data.chars || [], 'char') +
      '</div></div></article>';

    // Collections LB summary
    var col = (data.unit_portrait && data.unit_portrait.collections) || extra.collections_overlay || {};
    html +=
      '<article class="profile-card"><h3><img class="profile-h3-ic" src="' +
      escAttr(profileAsset('profile_achievements_list_icon_enhance.webp')) +
      '" alt=""> ' +
      esc(t('col_lb')) +
      '</h3><p class="profile-explain">' +
      esc(t('col_lb_hint')) +
      '</p>';
    if (col.units_matched) {
      html +=
        '<div class="profile-col-stats"><div class="profile-col-stat"><div class="profile-col-val">' +
        esc(col.units_matched) +
        '/' +
        esc(col.units_total) +
        '</div><div class="profile-col-lab">matched</div></div><div class="profile-col-stat"><div class="profile-col-val">' +
        esc(col.avg_lb) +
        '</div><div class="profile-col-lab">avg LB</div></div><div class="profile-col-stat"><div class="profile-col-val">' +
        esc(col.lb3_count) +
        '</div><div class="profile-col-lab">LB3+</div></div></div>';
    } else {
      html += '<p class="profile-explain profile-explain--muted">' + esc(t('col_lb_none')) + '</p>';
    }
    html += '</article>';

    // Cross-ref tags — full list (top 10/20)
    html +=
      '<article class="profile-card"><h3>' +
      esc(t('tags')) +
      '</h3><p class="profile-explain">' +
      esc(t('tags_hint')) +
      '</p><div class="profile-tag-row profile-tag-row--roomy">';
    (data.list_tags || data.top_tags || []).slice(0, 12).forEach(function (tg) {
      html += tagCompositeHtml(tg, true);
    });
    if (!(data.list_tags || data.top_tags || []).length) {
      html += '<span class="profile-supp-meta">—</span>';
    }
    html += '</div></article>';

    // Character portrait
    var cp = data.char_portrait || {};
    html +=
      '<article class="profile-card profile-card--wide"><h3><img class="profile-h3-ic" src="' +
      escAttr(profileAsset('profile_achievements_list_icon_character.webp')) +
      '" alt=""> ' +
      esc(t('portrait_chars')) +
      '</h3><p class="profile-explain">' +
      esc(t('portrait_chars_sub')) +
      '</p>';

    html += '<h4 class="profile-h4">' + esc(t('playstyle')) + '</h4><p class="profile-explain profile-explain--muted">' + esc(t('playstyle_hint')) + '</p><div class="profile-playstyle">';
    (cp.playstyle || []).forEach(function (ps) {
      html +=
        '<div class="profile-play-card"><div class="profile-play-top"><strong>' +
        esc(ps.label) +
        '</strong><span>' +
        esc(ps.char_count) +
        ' / ' +
        esc(ps.char_total) +
        ' · ' +
        esc(ps.share_pct) +
        '%</span></div><div class="profile-supp-bar"><span style="width:' +
        Math.min(100, Number(ps.share_pct) || 0) +
        '%"></span></div><div class="profile-play-thumbs">';
      (ps.characters || []).slice(0, 6).forEach(function (ch) {
        html += ch.thumb
          ? '<img src="' + escAttr(ch.thumb) + '" alt="' + escAttr(ch.name) + '" title="' + escAttr(ch.name + (ch.lv != null ? ' LV' + ch.lv : '')) + '" loading="lazy">'
          : '';
      });
      html += '</div></div>';
    });
    if (!(cp.playstyle || []).length) html += '<span class="profile-supp-meta">—</span>';
    html += '</div>';

    html +=
      '<div class="profile-portrait-grid"><div><h4 class="profile-h4">' +
      esc(t('top_skills')) +
      '</h4>' +
      rankBars(cp.skills || extra.top_char_skills) +
      '</div><div><h4 class="profile-h4">' +
      esc(t('top_abilities')) +
      '</h4>' +
      rankBars(cp.abilities || extra.top_char_abilities) +
      '</div><div><h4 class="profile-h4">' +
      esc(t('top_char_series')) +
      '</h4>' +
      rankBars(cp.series || extra.top_char_series) +
      '</div></div></article>';

    // Unit portrait
    var up = data.unit_portrait || {};
    html +=
      '<article class="profile-card profile-card--wide"><h3><img class="profile-h3-ic" src="' +
      escAttr(profileAsset('profile_achievements_list_icon_unit.webp')) +
      '" alt=""> ' +
      esc(t('portrait_units')) +
      '</h3><div class="profile-portrait-grid"><div><h4 class="profile-h4">' +
      esc(t('top_unit_series')) +
      '</h4>' +
      rankBars(up.series || extra.top_unit_series) +
      '</div><div><h4 class="profile-h4">' +
      esc(t('top_mechs')) +
      '</h4>' +
      rankBars(up.mechanisms || extra.top_mechanisms) +
      '</div></div></article>';

    // Terrain
    html +=
      '<article class="profile-card"><h3>' +
      esc(t('terrain')) +
      '</h3><p class="profile-explain">' +
      esc(t('terrain_hint')) +
      '</p><div class="profile-terrain-row">';
    var terr = (data.terrain_caps && data.terrain_caps.best_circle) || [];
    terr.forEach(function (tr) {
      html +=
        '<div class="profile-terrain">' +
        (tr.type_icon ? '<img src="' + escAttr(tr.type_icon) + '" alt="">' : '') +
        (tr.level_icon ? '<img src="' + escAttr(tr.level_icon) + '" alt="">' : '') +
        '<span>' +
        esc(tr.name) +
        '</span><strong>' +
        esc(tr.share_pct) +
        '%</strong></div>';
    });
    if (!terr.length) html += '<span class="profile-supp-meta">—</span>';
    html += '</div></article>';

    // Rates
    html +=
      '<article class="profile-card"><h3><img class="profile-h3-ic" src="' +
      escAttr(profileAsset('profile_achievements_list_icon_enhance.webp')) +
      '" alt=""> ' +
      esc(t('rates')) +
      '</h3><p class="profile-explain">' +
      esc(t('rates_hint')) +
      '</p><div class="profile-rate-grid">';
    (extra.rates || []).forEach(function (r) {
      var lab = r.label || r.label_en || r.key || '';
      html +=
        '<div class="profile-rate">' +
        (r.icon
          ? '<img class="profile-rate-ic" src="' +
            escAttr(profileAsset(r.icon)) +
            '" alt="">'
          : '') +
        '<div class="profile-rate-val">' +
        esc(r.value) +
        (r.unit ? '<span class="profile-rate-unit">' + esc(r.unit) + '</span>' : '') +
        '</div><div class="profile-rate-lab">' +
        esc(lab) +
        '</div><div class="profile-rate-hint">' +
        esc(r.hint || '') +
        '</div></div>';
    });
    if (!(extra.rates || []).length) html += '<span class="profile-supp-meta">—</span>';
    html += '</div></article>';

    // Supporters
    html +=
      '<article class="profile-card"><h3>' +
      esc(t('supp')) +
      '</h3><p class="profile-explain">' +
      esc(t('supp_hint')) +
      '</p><ol class="profile-supp-rank">';
    (data.supporter_recommendations || []).slice(0, 8).forEach(function (s, i) {
      var total = s.units_total || data.top_n || 20;
      html +=
        '<li class="profile-supp">' +
        '<span class="profile-supp-rankn">' +
        (s.rank || i + 1) +
        '</span>' +
        (s.thumb
          ? '<img src="' + escAttr(s.thumb) + '" alt="" loading="lazy">'
          : '<div class="profile-supp-ph"></div>') +
        '<div class="profile-supp-body"><div class="profile-supp-name">' +
        esc(s.name) +
        '</div><div class="profile-supp-cover">' +
        esc(
          t('supp_cover', {
            n: s.units_covered,
            total: total,
            pct: s.cover_pct
          })
        ) +
        '</div><div class="profile-supp-bar" aria-hidden="true"><span style="width:' +
        Math.min(100, Number(s.cover_pct) || 0) +
        '%"></span></div>';
      if (s.leader_pct) {
        html +=
          '<div class="profile-supp-meta">Leader skill ' + esc(s.leader_pct) + '%</div>';
      }
      html += '</div></li>';
    });
    if (!(data.supporter_recommendations || []).length) {
      html += '<li class="profile-supp-meta">—</li>';
    }
    html += '</ol></article>';

    // Roles
    html +=
      '<article class="profile-card"><h3>' +
      esc(t('roles')) +
      '</h3><div class="profile-role-row">';
    (data.roles || []).forEach(function (r) {
      html +=
        '<div class="profile-role">' +
        (r.role_icon ? '<img src="' + escAttr(r.role_icon) + '" alt="">' : '') +
        '<div><div>' +
        esc(r.role) +
        '</div><div class="profile-role-pct">' +
        esc(r.share_pct) +
        '%</div></div></div>';
    });
    html += '</div></article>';

    // Haro Trophy
    var haro = data.haro_trophies || {};
    html +=
      '<article class="profile-card"><h3><img class="profile-h3-ic" src="' +
      escAttr(profileAsset('UI_Profile_Achievements_Icon.webp')) +
      '" alt=""> ' +
      esc(t('haro')) +
      '</h3><div class="profile-haro-row">';
    [
      ['gold', 'UI_Common_Icon_Haro_Gold.webp', haro.gold],
      ['silver', 'UI_Common_Icon_Haro_Silver.webp', haro.silver],
      ['bronze', 'UI_Common_Icon_Haro_Bronze.webp', haro.bronze]
    ].forEach(function (row) {
      html +=
        '<div class="profile-haro"><img src="' +
        escAttr(profileAsset(row[1])) +
        '" alt=""><strong>' +
        fmt(row[2] || 0) +
        '</strong></div>';
    });
    html += '</div></article>';

    // Battle Results (cumulative records)
    var census = data.census_compare || [];
    var FINGER_ICONS = {
      total_sorties: 'profile_achievements_list_icon_stage.webp',
      stages_cleared: 'profile_achievements_list_icon_stage_main.webp',
      total_skips: 'profile_achievements_list_icon_stage.webp',
      skip_per_sortie: 'profile_achievements_list_icon_stage.webp',
      max_damage: 'profile_achievements_list_icon_enhance.webp',
      max_combat_power: 'profile_achievements_list_icon_enhance.webp',
      unit_sp: 'profile_achievements_list_icon_unit_sp.webp',
      unit_ssp: 'profile_achievements_list_icon_unit_ssp.webp',
      unit_limit_breaks: 'profile_achievements_list_icon_enhance.webp',
      database_units: 'profile_achievements_list_icon_unit.webp',
      database_characters: 'profile_achievements_list_icon_character.webp',
      skip_great_success: 'profile_achievements_list_icon_stage.webp',
      haro_cruises: 'profile_achievements_list_icon_warship_haro.webp',
      total_captures: 'profile_achievements_list_icon_unit.webp',
      dismantled_units: 'profile_achievements_list_icon_unit.webp',
      char_sp: 'profile_achievements_list_icon_character_sp.webp'
    };
    html +=
      '<article class="profile-card"><h3><img class="profile-h3-ic" src="' +
      escAttr(profileAsset('UI_Profile_Achievements_Icon.webp')) +
      '" alt=""> ' +
      esc(t('finger')) +
      '</h3><p class="profile-explain">' +
      esc(t('finger_hint')) +
      '</p><div class="profile-census-list">';
    if (census.length) {
      census.forEach(function (row) {
        var ic = FINGER_ICONS[row.key] || 'profile_achievements_list_icon_stage.webp';
        var barW = Math.min(100, Math.max(4, Number(row.percentile) || 0));
        html +=
          '<div class="profile-census-row"><span class="profile-census-lab"><img src="' +
          escAttr(profileAsset(ic)) +
          '" alt=""><span class="profile-census-name">' +
          esc(row.label) +
          '</span><strong class="profile-census-val">' +
          fmt(row.value) +
          '</strong></span><div class="profile-census-right"><div class="profile-census-bar" aria-hidden="true"><span style="width:' +
          barW +
          '%"></span></div><span class="profile-census-pct">' +
          esc(t('census_pct', { p: row.percentile })) +
          '</span></div></div>';
      });
    } else {
      html += '<p class="profile-supp-meta">—</p>';
    }
    html += '</div></article>';

    host.innerHTML = html;
  }

  function bindTopN() {
    function setTopN(n) {
      state.topN = n === 10 ? 10 : 20;
      var b10 = $('pfTop10');
      var b20 = $('pfTop20');
      if (b10) b10.classList.toggle('is-on', state.topN === 10);
      if (b20) b20.classList.toggle('is-on', state.topN === 20);
    }
    var b10 = $('pfTop10');
    var b20 = $('pfTop20');
    if (b10)
      b10.addEventListener('click', function () {
        setTopN(10);
      });
    if (b20)
      b20.addEventListener('click', function () {
        setTopN(20);
      });
  }

  function bindAnalyze() {
    var btn = $('pfAnalyze');
    if (btn) btn.addEventListener('click', analyze);
  }

  function init() {
    bindLang();
    bindSlots();
    bindZoom();
    bindTopN();
    bindAnalyze();
    var badge = $('pfBuildBadge');
    if (badge) badge.textContent = 'build: ' + PROFILE_JS_BUILD;
    if (!state.lang) setStatus(t('status_need_lang') + ' · ' + PROFILE_JS_BUILD);
    else setStatus(PROFILE_JS_BUILD);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
