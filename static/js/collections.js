(function () {
  'use strict';

  var STORAGE_KEY = 'ggen_collections_v1';
  var USERNAME_KEY = 'ggen_collections_username';
  var LANG_STORAGE_KEY = 'ggen_lang';
  var MAX_LB = 3; /* unowned = -1, owned LB0..LB3 */
  var EAGER_THUMB_COUNT = 16;

  var LB_ICONS = {
    None: '/static/images/UI/UI_Common_Icon_Grade_M_None.webp',
    Neutral: '/static/images/UI/UI_Common_Icon_Grade_M_Neutral.webp',
    Max: '/static/images/UI/UI_Common_Icon_Grade_M_Max.webp'
  };

  /* Same browse chrome as app.js list thumbs */
  var RARITY_BASE_MAP = {
    UR: '/static/images/UI/UI_Common_Tmb_Square_UR_Base.webp',
    SSR: '/static/images/UI/UI_Common_Tmb_Square_SSR_Base.webp',
    SR: '/static/images/UI/UI_Common_Tmb_Square_SR_Base.webp',
    R: '/static/images/UI/UI_Common_Tmb_Square_R_Base.webp',
    N: '/static/images/UI/UI_Common_Tmb_Square_None_Base.webp'
  };
  var RARITY_FRAME_MAP = {
    UR: '/static/images/UI/UI_Common_Tmb_Square_UR_Frame.webp',
    SSR: '/static/images/UI/UI_Common_Tmb_Square_SSR_Frame.webp',
    SR: '/static/images/UI/UI_Common_Tmb_Square_SR_Frame.webp',
    R: '/static/images/UI/UI_Common_Tmb_Square_R_Frame.webp',
    N: '/static/images/UI/UI_Common_Tmb_Square_None_Frame%20%236338.webp'
  };
  var TB_SUPPORTER_TB_BASE = '/static/images/UI/UI_Common_Tmb_Supporter_Base.webp';
  var SUPPORTER_TB_FRAME_MAP = {
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

  /*
   * Locale strings — game terms from data/{LOCALE}/lang (m_help) / site T.*:
   * Units/Supporters/Limit Break/roles/Limited. Tool chrome aligned with existing app.js locale overlays.
   */
  var COL_T = {
    EN: {
      page_title: 'Collections — GGen Eternal Database',
      back: '← Database',
      eyebrow: 'UR possession tracker',
      title: 'Collections',
      sub: 'Track UR unit and supporter possession. Tap a portrait to cycle not possessed → Limit Break 0 → Limit Break 3. Possessing a unit covers its character.',
      lang: 'Lang',
      units: 'Units',
      supporters: 'Supporters',
      role_all: 'All',
      role_attack: 'Attack',
      role_support: 'Support',
      role_durability: 'Durability',
      search_ph: 'Search name or ID…',
      select_lb0: 'Select All (LB0)',
      select_max: 'Select All (Max LB)',
      select_limited: 'Select All Limited (LB0)',
      reset_all: 'Reset All',
      save_image: 'Save as image',
      share_x: 'Share on X',
      username: 'Player name',
      username_ph: 'Your in-game name',
      share_need_name: 'Enter your player name to include it on X.',
      possession: 'Possession',
      complete: 'COMPLETE',
      complete_max: 'MAX LIMIT BREAK',
      owned: 'Possessed',
      max_lb: 'Max Limit Break',
      report_max_lb: 'Max Limit Break',
      limited_owned: 'Limited possessed',
      role_owned: '{role} possessed',
      limited: 'Limited',
      loading: 'Loading UR catalog…',
      load_fail: 'Catalog load failed — is the Flask app running? ({err})',
      loaded: 'Loaded {units} units · {supporters} supporters',
      showing: 'Showing {n} / {total} UR {type} · tap to cycle LB',
      no_match: 'No matches for this filter.',
      reset_confirm: 'Reset all {type} ownership on this device?',
      generating: 'Generating…',
      save_fail: 'Could not generate image.\n{err}',
      preview_msg: 'If download does not start, long-press (mobile) or right-click the image and choose Save image.',
      download: 'Download',
      close: 'Close',
      foot: 'UR units exclude Ultimate and transform alternates. Progress is saved in this browser only.',
      report_title: 'Collections Report',
      brand_line: 'GGEN ETERNAL DATABASE  ·  SD Gundam G Generation',
      owned_line: 'Possessed {owned} / {total} · Avg Limit Break {avg}',
      share_body:
        'GGEN ETERNAL DATABASE — Collections Report\nUR {type} possession {pct}% ({owned}/{total} {noun}) · Avg Limit Break {avg}\n#GundamEternal #ジージェネエターナル\n{url}',
      share_body_named:
        'GGEN ETERNAL DATABASE — Collections Report\n{name} · UR {type} possession {pct}% ({owned}/{total} {noun}) · Avg Limit Break {avg}\n#GundamEternal #ジージェネエターナル\n{url}',
      noun_units: 'units',
      noun_supporters: 'supporters',
      unowned: 'Not possessed'
    },
    JA: {
      page_title: 'コレクション — GGen Eternal Database',
      back: '← データベース',
      eyebrow: 'UR所持率トラッカー',
      title: 'コレクション',
      sub: 'URユニット／サポーターの所持を記録。タップで未所持 → 限界突破0 → 限界突破3。ユニット所持はキャラクター所持も含みます。',
      lang: '言語',
      units: 'ユニット',
      supporters: 'サポーター',
      role_all: 'すべて',
      role_attack: '攻撃型',
      role_support: '支援型',
      role_durability: '耐久型',
      search_ph: '名前またはIDで検索…',
      select_lb0: 'すべて選択（LB0）',
      select_max: 'すべて選択（限界突破MAX）',
      select_limited: '期間限定をすべて選択（LB0）',
      reset_all: 'すべてリセット',
      save_image: '画像で保存',
      share_x: 'Xでシェア',
      username: 'プレイヤー名',
      username_ph: 'ゲーム内のプレイヤー名',
      share_need_name: 'Xに含めるプレイヤー名を入力してください。',
      possession: '所持率',
      complete: 'コンプリート',
      complete_max: '限界突破コンプリート',
      owned: '所持',
      max_lb: '限界突破MAX',
      report_max_lb: '限界突破MAX',
      limited_owned: '期間限定所持',
      role_owned: '{role}所持',
      limited: '期間限定',
      loading: 'URカタログを読み込み中…',
      load_fail: 'カタログの読み込みに失敗しました（Flask起動を確認）: {err}',
      loaded: '読込 {units} ユニット · {supporters} サポーター',
      showing: '表示 {n} / {total} UR {type} · タップでLB切替',
      no_match: '条件に一致する結果がありません。',
      reset_confirm: 'この端末の{type}所持記録をすべてリセットしますか？',
      generating: '生成中…',
      save_fail: '画像を生成できませんでした。\n{err}',
      preview_msg: 'ダウンロードが始まらない場合は、長押し（スマホ）または右クリックで画像を保存してください。',
      download: 'ダウンロード',
      close: '閉じる',
      foot: 'URユニットはULT・変形形態を除外。記録はこのブラウザのみ。',
      report_title: 'コレクションレポート',
      brand_line: 'GGEN ETERNAL DATABASE  ·  SD Gundam G Generation',
      owned_line: '所持 {owned} / {total} · 平均限界突破 {avg}',
      share_body:
        'GGEN ETERNAL DATABASE — コレクションレポート\nUR {type} 所持率 {pct}%（{owned}/{total}{noun}）平均限界突破 {avg}\n#GundamEternal #ジージェネエターナル\n{url}',
      share_body_named:
        'GGEN ETERNAL DATABASE — コレクションレポート\n{name} · UR {type} 所持率 {pct}%（{owned}/{total}{noun}）平均限界突破 {avg}\n#GundamEternal #ジージェネエターナル\n{url}',
      noun_units: '機',
      noun_supporters: '体',
      unowned: '未所持'
    },
    TW: {
      page_title: '收藏 — GGen Eternal Database',
      back: '← 資料庫',
      eyebrow: 'UR 持有率追蹤',
      title: '收藏',
      sub: '記錄 UR 單位與支援人員持有狀態。點選肖像可循環：未持有 → 突破界限 0 → 突破界限 3。持有單位即視為持有角色。',
      lang: '語言',
      units: '單位',
      supporters: '支援人員',
      role_all: '全部',
      role_attack: '攻擊型',
      role_support: '支援型',
      role_durability: '耐久型',
      search_ph: '搜尋：名稱或 ID…',
      select_lb0: '全選（LB0）',
      select_max: '全選（突破界限 MAX）',
      select_limited: '全選期間限定（LB0）',
      reset_all: '全部重設',
      save_image: '儲存圖片',
      share_x: '分享至 X',
      username: '玩家名稱',
      username_ph: '遊戲內的玩家名稱',
      share_need_name: '請輸入要一併分享到 X 的玩家名稱。',
      possession: '持有率',
      complete: '全收集',
      complete_max: '突破界限全滿',
      owned: '持有',
      max_lb: '突破界限 MAX',
      report_max_lb: '突破界限 MAX',
      limited_owned: '期間限定持有',
      role_owned: '{role}持有',
      limited: '期間限定',
      loading: '正在載入 UR 目錄…',
      load_fail: '目錄載入失敗 — 請確認 Flask 是否運行（{err}）',
      loaded: '已載入 {units} 單位 · {supporters} 支援人員',
      showing: '顯示 {n} / {total} UR {type} · 點選切換突破界限',
      no_match: '沒有符合條件的結果。',
      reset_confirm: '要重設本機全部{type}持有記錄嗎？',
      generating: '產生中…',
      save_fail: '無法產生圖片。\n{err}',
      preview_msg: '若未開始下載，請長按（手機）或右鍵選擇儲存圖片。',
      download: '下載',
      close: '關閉',
      foot: 'UR 單位不含終極單位與變形形態。進度僅保存在此瀏覽器。',
      report_title: '收藏報告',
      brand_line: 'GGEN ETERNAL DATABASE  ·  SD Gundam G Generation',
      owned_line: '持有 {owned} / {total} · 平均突破界限 {avg}',
      share_body:
        'GGEN ETERNAL DATABASE — 收藏報告\nUR {type} 持有率 {pct}%（{owned}/{total}{noun}）平均突破界限 {avg}\n#GundamEternal #ジージェネエターナル\n{url}',
      share_body_named:
        'GGEN ETERNAL DATABASE — 收藏報告\n{name} · UR {type} 持有率 {pct}%（{owned}/{total}{noun}）平均突破界限 {avg}\n#GundamEternal #ジージェネエターナル\n{url}',
      noun_units: '機',
      noun_supporters: '個',
      unowned: '未持有'
    },
    HK: {
      page_title: '收藏 — GGen Eternal Database',
      back: '← 資料庫',
      eyebrow: 'UR 持有率追蹤',
      title: '收藏',
      sub: '記錄 UR 單位與支援人員持有狀態。點選肖像可循環：未持有 → 突破界限 0 → 突破界限 3。持有單位即視為持有角色。',
      lang: '語言',
      units: '單位',
      supporters: '支援人員',
      role_all: '全部',
      role_attack: '攻擊型',
      role_support: '支援型',
      role_durability: '耐久型',
      search_ph: '搜尋：名稱或 ID…',
      select_lb0: '全選（LB0）',
      select_max: '全選（突破界限 MAX）',
      select_limited: '全選期間限定（LB0）',
      reset_all: '全部重設',
      save_image: '儲存圖片',
      share_x: '分享至 X',
      username: '玩家名稱',
      username_ph: '遊戲內的玩家名稱',
      share_need_name: '請輸入要一併分享到 X 的玩家名稱。',
      possession: '持有率',
      complete: '全收集',
      complete_max: '突破界限全滿',
      owned: '持有',
      max_lb: '突破界限 MAX',
      report_max_lb: '突破界限 MAX',
      limited_owned: '期間限定持有',
      role_owned: '{role}持有',
      limited: '期間限定',
      loading: '正在載入 UR 目錄…',
      load_fail: '目錄載入失敗 — 請確認 Flask 是否運行（{err}）',
      loaded: '已載入 {units} 單位 · {supporters} 支援人員',
      showing: '顯示 {n} / {total} UR {type} · 點選切換突破界限',
      no_match: '沒有符合條件的結果。',
      reset_confirm: '要重設本機全部{type}持有記錄嗎？',
      generating: '產生中…',
      save_fail: '無法產生圖片。\n{err}',
      download: '下載',
      close: '關閉',
      preview_msg: '若未開始下載，請長按（手機）或右鍵選擇儲存圖片。',
      foot: 'UR 單位不含終極單位與變形形態。進度僅保存在此瀏覽器。',
      report_title: '收藏報告',
      brand_line: 'GGEN ETERNAL DATABASE  ·  SD Gundam G Generation',
      owned_line: '持有 {owned} / {total} · 平均突破界限 {avg}',
      share_body:
        'GGEN ETERNAL DATABASE — 收藏報告\nUR {type} 持有率 {pct}%（{owned}/{total}{noun}）平均突破界限 {avg}\n#GundamEternal #ジージェネエターナル\n{url}',
      share_body_named:
        'GGEN ETERNAL DATABASE — 收藏報告\n{name} · UR {type} 持有率 {pct}%（{owned}/{total}{noun}）平均突破界限 {avg}\n#GundamEternal #ジージェネエターナル\n{url}',
      noun_units: '機',
      noun_supporters: '個',
      unowned: '未持有'
    }
  };

  var IMAGE_CDN = (function () {
    var e = String(window.__GGEN_IMAGE_CDN__ || '').replace(/\/+$/, '');
    if (!e) return '';
    var n = e.toLowerCase();
    if (n.indexOf('file:') === 0 || /^[a-zA-Z]:[\\/]/.test(e) || e.indexOf('\\\\') === 0) return '';
    return e;
  })();
  var USE_CDN = window.__GGEN_GAME_IMAGES_USE_CDN__ !== false && !!IMAGE_CDN;

  var state = {
    lang: (function () {
      try {
        return (
          localStorage.getItem('ggen_collections_lang') ||
          localStorage.getItem(LANG_STORAGE_KEY) ||
          'EN'
        );
      } catch (e) {
        return 'EN';
      }
    })(),
    type: 'units',
    role: 'ALL',
    q: '',
    catalog: { units: [], supporters: [] },
    owned: loadOwned(),
    busy: false
  };

  function normLang(lc) {
    lc = String(lc || 'EN').toUpperCase();
    if (lc === 'JP') lc = 'JA';
    return COL_T[lc] ? lc : 'EN';
  }

  function t(key, vars) {
    var pack = COL_T[normLang(state.lang)] || COL_T.EN;
    var s = pack[key];
    if (s == null) s = COL_T.EN[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = String(s).split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  function roleLabel(rid) {
    if (rid === '1') return t('role_attack');
    if (rid === '2') return t('role_durability');
    if (rid === '3') return t('role_support');
    return '';
  }

  function imgUrl(path) {
    if (!path) return '';
    var p = String(path);
    if (/^https?:\/\//i.test(p)) return p;
    if (p.indexOf('/static/images/') === 0 && USE_CDN) {
      return IMAGE_CDN.replace(/\/$/, '') + '/images/' + p.slice('/static/images/'.length);
    }
    return p;
  }

  function loadOwned() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { units: {}, supporters: {} };
      var o = JSON.parse(raw);
      return {
        units: o.units || {},
        supporters: o.supporters || {}
      };
    } catch (_) {
      return { units: {}, supporters: {} };
    }
  }

  function saveOwned() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.owned));
    } catch (_) {}
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getLb(id) {
    var bag = state.owned[state.type] || {};
    var v = bag[String(id)];
    if (v === undefined || v === null || v === '') return -1;
    var n = parseInt(v, 10);
    if (Number.isNaN(n)) return -1;
    return Math.max(-1, Math.min(MAX_LB, n));
  }

  function setLb(id, lb) {
    var bag = state.owned[state.type] || (state.owned[state.type] = {});
    var key = String(id);
    if (lb < 0) delete bag[key];
    else bag[key] = lb;
    saveOwned();
  }

  function cycleLb(id) {
    var cur = getLb(id);
    var next = cur >= MAX_LB ? -1 : cur + 1;
    setLb(id, next);
  }

  function activeList() {
    return state.catalog[state.type] || [];
  }

  function filteredList() {
    var q = String(state.q || '').trim().toLowerCase();
    return activeList().filter(function (row) {
      if (state.type !== 'supporters' && state.role !== 'ALL') {
        if (String(row.role_id || '') !== String(state.role)) return false;
      }
      if (!q) return true;
      var hay = (String(row.name || '') + ' ' + String(row.id || '')).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function computeStats(rows) {
    var total = rows.length;
    var owned = 0;
    var maxed = 0;
    var limTotal = 0;
    var limOwned = 0;
    var lbSum = 0;
    var byRole = { '1': { t: 0, o: 0 }, '2': { t: 0, o: 0 }, '3': { t: 0, o: 0 } };
    rows.forEach(function (row) {
      var lb = getLb(row.id);
      var isOwned = lb >= 0;
      if (isOwned) {
        owned++;
        lbSum += lb;
      }
      if (lb >= MAX_LB) maxed++;
      if (row.is_limited_time) {
        limTotal++;
        if (isOwned) limOwned++;
      }
      var rid = String(row.role_id || '');
      if (byRole[rid]) {
        byRole[rid].t++;
        if (isOwned) byRole[rid].o++;
      }
    });
    var pct = total ? Math.round((owned / total) * 1000) / 10 : 0;
    var avgLb = owned ? Math.round((lbSum / owned) * 10) / 10 : 0;
    return {
      total: total,
      owned: owned,
      maxed: maxed,
      limTotal: limTotal,
      limOwned: limOwned,
      byRole: byRole,
      pct: pct,
      avgLb: avgLb
    };
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function applyUiLang() {
    state.lang = normLang(state.lang);
    document.documentElement.setAttribute('data-ui-lang', state.lang);
    document.documentElement.lang =
      state.lang === 'JA' ? 'ja' : state.lang === 'TW' ? 'zh-Hant-TW' : state.lang === 'HK' ? 'zh-Hant-HK' : 'en';
    document.title = t('page_title');
    setText('colBack', t('back'));
    setText('colEyebrow', t('eyebrow'));
    setText('colTitle', t('title'));
    setText('colSub', t('sub'));
    setText('colTabUnitsLbl', t('units'));
    setText('colTabSupportersLbl', t('supporters'));
    var unitTab = document.getElementById('colTabUnits');
    var suppTab = document.getElementById('colTabSupporters');
    if (unitTab) unitTab.setAttribute('aria-label', t('units'));
    if (suppTab) suppTab.setAttribute('aria-label', t('supporters'));
    var allBtn = document.querySelector('#colRoleTabs button[data-role="ALL"]');
    if (allBtn) {
      allBtn.textContent = t('role_all');
      allBtn.title = t('role_all');
      allBtn.setAttribute('aria-label', t('role_all'));
    }
    [
      ['1', 'role_attack'],
      ['3', 'role_support'],
      ['2', 'role_durability']
    ].forEach(function (pair) {
      var btn = document.querySelector('#colRoleTabs button[data-role="' + pair[0] + '"]');
      if (!btn) return;
      var lab = t(pair[1]);
      btn.title = lab;
      btn.setAttribute('aria-label', lab);
    });
    var search = document.getElementById('colSearch');
    if (search) search.placeholder = t('search_ph');
    setText('colOwnVisible', t('select_lb0'));
    setText('colMaxVisible', t('select_max'));
    setText('colSelectLimited', t('select_limited'));
    setText('colClearAll', t('reset_all'));
    setText('colSaveImage', t('save_image'));
    setText('colShareX', t('share_x'));
    setText('colUsernameLabel', t('username'));
    var nameInput = document.getElementById('colUsername');
    if (nameInput) {
      nameInput.placeholder = t('username_ph');
      nameInput.setAttribute('aria-label', t('username'));
      if (!nameInput.value) nameInput.value = loadUsername();
    }
    syncLangUi();
    setText('colDownloadLink', t('download'));
    setText('colClosePreview', t('close'));
    setText('colFoot', t('foot'));
    var prevMsg = document.getElementById('colPreviewMsg');
    if (prevMsg) prevMsg.textContent = t('preview_msg');
  }

  function syncLangUi() {
    var label = document.getElementById('colLangLabel');
    if (label) label.textContent = state.lang;
    document.querySelectorAll('#colLangDropdown .lang-option').forEach(function (opt) {
      var on = opt.getAttribute('data-lang') === state.lang;
      opt.classList.toggle('selected', on);
      opt.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function closeLangDropdown() {
    var dd = document.getElementById('colLangDropdown');
    var btn = document.getElementById('colLangBtn');
    if (dd) {
      dd.classList.remove('active');
      dd.hidden = true;
    }
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleLangDropdown() {
    var dd = document.getElementById('colLangDropdown');
    var btn = document.getElementById('colLangBtn');
    if (!dd) return;
    var open = !dd.classList.contains('active');
    if (open) {
      dd.hidden = false;
      dd.classList.add('active');
      if (btn) btn.setAttribute('aria-expanded', 'true');
    } else {
      closeLangDropdown();
    }
  }

  function setLang(next) {
    var lc = normLang(next);
    if (lc === state.lang) {
      closeLangDropdown();
      return;
    }
    state.lang = lc;
    try {
      localStorage.setItem('ggen_collections_lang', state.lang);
      localStorage.setItem(LANG_STORAGE_KEY, state.lang);
    } catch (e) {}
    closeLangDropdown();
    applyUiLang();
    loadCatalog();
  }

  var wasComplete = false;
  var wasPerfect = false;

  function renderStats() {
    var rows = activeList();
    var st = computeStats(rows);
    var pctEl = document.getElementById('colPct');
    var bar = document.getElementById('colPctBar');
    var label = document.getElementById('colPctLabel');
    var badge = document.getElementById('colCompleteBadge');
    var hud = document.getElementById('colHud');
    var gauge = document.getElementById('colGauge');
    var complete = st.total > 0 && st.owned >= st.total;
    var perfect = complete && st.maxed >= st.total;

    if (pctEl) {
      var whole = Math.floor(st.pct);
      var frac = Math.round((st.pct - whole) * 10);
      pctEl.innerHTML = whole + (frac ? '.' + frac : '') + '<span>%</span>';
    }
    if (bar) bar.style.width = Math.min(100, st.pct) + '%';
    if (label) label.textContent = t('possession') + ' · ' + typeTitle();
    if (badge) {
      badge.hidden = !complete;
      badge.textContent = perfect ? t('complete_max') : t('complete');
      badge.classList.toggle('is-perfect', perfect);
    }
    if (hud) {
      hud.classList.toggle('is-complete', complete);
      hud.classList.toggle('is-perfect', perfect);
    }
    if (gauge) {
      gauge.classList.toggle('is-complete', complete);
      gauge.classList.toggle('is-perfect', perfect);
      if ((perfect && !wasPerfect) || (complete && !wasComplete && !perfect)) {
        gauge.classList.remove('is-complete-pop');
        void gauge.offsetWidth;
        gauge.classList.add('is-complete-pop');
      }
    }
    wasComplete = complete;
    wasPerfect = perfect;

    var strip = document.getElementById('colStatStrip');
    if (!strip) return;
    var cells = [
      { k: t('owned'), v: st.owned + '<em> / ' + st.total + '</em>', cls: 'collections-stat--accent' },
      { k: t('max_lb'), v: st.maxed + '<em> / ' + st.total + '</em>', cls: 'collections-stat--gold' },
      { k: t('limited_owned'), v: st.limOwned + '<em> / ' + st.limTotal + '</em>', cls: 'collections-stat--orange' }
    ];
    if (state.type !== 'supporters') {
      ['1', '3', '2'].forEach(function (rid) {
        var b = st.byRole[rid];
        cells.push({
          k: t('role_owned', { role: roleLabel(rid) }),
          v: b.o + '<em> / ' + b.t + '</em>',
          cls: ''
        });
      });
    }
    strip.innerHTML = cells
      .map(function (c) {
        return (
          '<div class="collections-stat ' +
          c.cls +
          '"><div class="collections-stat-k">' +
          esc(c.k) +
          '</div><div class="collections-stat-v">' +
          c.v +
          '</div></div>'
        );
      })
      .join('');
  }

  function typeTitle() {
    return state.type === 'supporters' ? t('supporters') : t('units');
  }

  function lbIconSlots(lb) {
    if (lb <= 0) return null;
    if (lb === 1) return ['Neutral', 'None', 'None'];
    if (lb === 2) return ['Neutral', 'Neutral', 'None'];
    return ['Max', 'Max', 'Max'];
  }

  function lbIconsHtml(lb) {
    var slots = lbIconSlots(lb);
    if (!slots) return '';
    return (
      '<span class="col-card-lb-icons" aria-hidden="true">' +
      slots
        .map(function (k) {
          return '<img src="' + esc(imgUrl(LB_ICONS[k])) + '" alt="" loading="lazy" decoding="async">';
        })
        .join('') +
      '</span>'
    );
  }

  function lbTitle(lb) {
    if (lb < 0) return t('unowned');
    return 'LB' + lb;
  }

  function limitedWord() {
    return t('limited');
  }

  function rarityKey(row) {
    var r = String((row && row.rarity) || 'UR').toUpperCase();
    if (RARITY_FRAME_MAP[r]) return r;
    return 'UR';
  }

  function thumbHtml(row, idx) {
    var r = rarityKey(row);
    var thum = imgUrl(row.thum || '');
    var eager = typeof idx === 'number' && idx < EAGER_THUMB_COUNT;
    var loadAttr = eager
      ? 'loading="eager" decoding="async" fetchpriority="high"'
      : 'loading="lazy" decoding="async"';
    var chromeLoad = 'loading="lazy" decoding="async"';
    var portrait = thum
      ? '<img class="list-thumb-portrait" src="' +
        esc(thum) +
        '" alt="" ' +
        loadAttr +
        '>'
      : '<div class="list-thumb-placeholder" style="display:flex"></div>';

    if (state.type === 'supporters') {
      var fr = SUPPORTER_TB_FRAME_MAP[r] || SUPPORTER_TB_FRAME_MAP.UR;
      return (
        '<div class="tb-supp-tb-composite col-card-thumb-inner">' +
        '<div class="tb-supp-tb-back"><img class="list-thumb-base" src="' +
        esc(imgUrl(TB_SUPPORTER_TB_BASE)) +
        '" alt="" ' +
        chromeLoad +
        '></div>' +
        '<div class="list-thumb-portrait-wrap tb-supp-tb-portrait-wrap">' +
        portrait +
        '</div>' +
        '<img class="tb-supp-tb-side tb-supp-tb-side--left" src="' +
        esc(imgUrl(fr.lr)) +
        '" alt="" ' +
        chromeLoad +
        '>' +
        '<img class="tb-supp-tb-side tb-supp-tb-side--right" src="' +
        esc(imgUrl(fr.lr)) +
        '" alt="" ' +
        chromeLoad +
        '>' +
        '<img class="tb-supp-tb-end tb-supp-tb-top" src="' +
        esc(imgUrl(fr.tb)) +
        '" alt="" ' +
        chromeLoad +
        '>' +
        '<img class="tb-supp-tb-end tb-supp-tb-bottom" src="' +
        esc(imgUrl(fr.tb)) +
        '" alt="" ' +
        chromeLoad +
        '>' +
        '</div>'
      );
    }

    var basePath = RARITY_BASE_MAP[r] || RARITY_BASE_MAP.UR;
    var framePath = RARITY_FRAME_MAP[r] || RARITY_FRAME_MAP.UR;
    var baseU = imgUrl(basePath);
    var frameU = imgUrl(framePath);
    var maskCss = baseU.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return (
      '<div class="list-thumb-composite list-thumb-has-frame col-card-thumb-inner" style="--thumb-inner-mask:url(\'' +
      maskCss +
      '\')">' +
      '<div class="list-thumb-back"><img class="list-thumb-base" src="' +
      esc(baseU) +
      '" alt="" ' +
      chromeLoad +
      '></div>' +
      '<div class="list-thumb-portrait-wrap">' +
      portrait +
      '</div>' +
      '<img class="list-thumb-frame" src="' +
      esc(frameU) +
      '" alt="" ' +
      chromeLoad +
      '>' +
      '</div>'
    );
  }

  function renderGrid() {
    var grid = document.getElementById('colGrid');
    var status = document.getElementById('colStatus');
    if (!grid) return;
    var rows = filteredList();
    if (status) {
      status.textContent = t('showing', {
        n: rows.length,
        total: activeList().length,
        type: typeTitle()
      });
    }
    grid.setAttribute('aria-busy', 'false');
    if (!rows.length) {
      grid.innerHTML = '<p class="collections-status">' + esc(t('no_match')) + '</p>';
      return;
    }
    grid.innerHTML = rows
      .map(function (row, idx) {
        var lb = getLb(row.id);
        var cls = lb < 0 ? 'is-unowned' : 'lb-' + lb;
        var lim = row.is_limited_time
          ? '<div class="bt-limited-topbar col-card-lim" aria-hidden="true"><span class="bt-limited-topbar-inner">' +
            esc(limitedWord()) +
            '</span></div>'
          : '';
        var ltCls = row.is_limited_time
          ? state.type === 'supporters'
            ? ' col-card--lt-supporter'
            : ' col-card--lt-unit'
          : '';
        return (
          '<button type="button" class="col-card ' +
          cls +
          ltCls +
          '" data-id="' +
          esc(row.id) +
          '" title="' +
          esc(row.name) +
          ' · ' +
          esc(lbTitle(lb)) +
          '">' +
          '<div class="col-card-thumb">' +
          lim +
          thumbHtml(row, idx) +
          lbIconsHtml(lb) +
          '</div>' +
          '<div class="col-card-name">' +
          esc(row.name) +
          '</div>' +
          '</button>'
        );
      })
      .join('');
  }

  function patchCard(id) {
    var card = document.querySelector('#colGrid .col-card[data-id="' + String(id).replace(/"/g, '') + '"]');
    if (!card) return false;
    var lb = getLb(id);
    card.classList.remove('is-unowned', 'lb-0', 'lb-1', 'lb-2', 'lb-3');
    card.classList.add(lb < 0 ? 'is-unowned' : 'lb-' + lb);
    var nameEl = card.querySelector('.col-card-name');
    var name = nameEl ? nameEl.textContent : '';
    card.title = name + ' · ' + lbTitle(lb);
    var thumb = card.querySelector('.col-card-thumb');
    if (thumb) {
      var icons = thumb.querySelector('.col-card-lb-icons');
      var next = lbIconsHtml(lb);
      if (icons) {
        if (next) icons.outerHTML = next;
        else icons.remove();
      } else if (next) {
        thumb.insertAdjacentHTML('beforeend', next);
      }
    }
    return true;
  }

  function refresh(opts) {
    opts = opts || {};
    renderStats();
    if (opts.patchId && patchCard(opts.patchId)) {
      syncRoleTabsVisibility();
      return;
    }
    renderGrid();
    syncRoleTabsVisibility();
  }

  function syncRoleTabsVisibility() {
    var tabs = document.getElementById('colRoleTabs');
    if (!tabs) return;
    tabs.style.display = state.type === 'supporters' ? 'none' : '';
  }

  async function fetchJson(url) {
    var attempt = 0;
    while (attempt < 8) {
      attempt++;
      var r = await fetch(url, { credentials: 'same-origin' });
      if (r.status === 503) {
        var body = null;
        try {
          body = await r.json();
        } catch (e) {}
        if (body && (body.error === 'warming_up' || body.status === 'warming_up')) {
          await new Promise(function (res) {
            setTimeout(res, Math.min(2500, 200 * attempt));
          });
          continue;
        }
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }
    throw new Error('HTTP 503');
  }

  async function loadCatalog() {
    var status = document.getElementById('colStatus');
    if (status) status.textContent = t('loading');
    state.busy = true;
    var lang = encodeURIComponent(state.lang);
    try {
      var data = await fetchJson('/api/collections/catalog?lang=' + lang);
      state.catalog = {
        units: data.units || [],
        supporters: data.supporters || []
      };
      if (status) {
        status.textContent = t('loaded', {
          units: state.catalog.units.length,
          supporters: state.catalog.supporters.length
        });
      }
      preloadChromeAssets();
    } catch (err) {
      if (status) status.textContent = t('load_fail', { err: err.message || err });
      state.catalog = { units: [], supporters: [] };
    }
    state.busy = false;
    refresh();
  }

  function preloadChromeAssets() {
    var urls = [
      imgUrl(RARITY_BASE_MAP.UR),
      imgUrl(RARITY_FRAME_MAP.UR),
      imgUrl(TB_SUPPORTER_TB_BASE),
      imgUrl(SUPPORTER_TB_FRAME_MAP.UR.lr),
      imgUrl(SUPPORTER_TB_FRAME_MAP.UR.tb),
      imgUrl(LB_ICONS.None),
      imgUrl(LB_ICONS.Neutral),
      imgUrl(LB_ICONS.Max)
    ];
    urls.forEach(function (u) {
      if (!u) return;
      var im = new Image();
      im.decoding = 'async';
      im.src = u;
    });
  }

  function bind() {
    document.querySelectorAll('.collections-type-tabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.collections-type-tabs button').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });
        state.type = btn.getAttribute('data-type') || 'units';
        refresh();
      });
    });
    document.querySelectorAll('#colRoleTabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#colRoleTabs button').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        state.role = btn.getAttribute('data-role') || 'ALL';
        refresh();
      });
    });
    var search = document.getElementById('colSearch');
    if (search) {
      var tmr = null;
      search.addEventListener('input', function () {
        clearTimeout(tmr);
        tmr = setTimeout(function () {
          state.q = search.value;
          refresh();
        }, 120);
      });
    }
    var langBtn = document.getElementById('colLangBtn');
    if (langBtn) {
      langBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        toggleLangDropdown();
      });
    }
    document.querySelectorAll('#colLangDropdown .lang-option').forEach(function (opt) {
      opt.addEventListener('click', function (ev) {
        ev.stopPropagation();
        setLang(opt.getAttribute('data-lang'));
      });
    });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.lang-selector')) closeLangDropdown();
    });

    var grid = document.getElementById('colGrid');
    if (grid) {
      grid.addEventListener('click', function (ev) {
        var card = ev.target.closest('.col-card');
        if (!card) return;
        var id = card.getAttribute('data-id');
        cycleLb(id);
        refresh({ patchId: id });
      });
    }

    var ownVis = document.getElementById('colOwnVisible');
    if (ownVis) {
      ownVis.addEventListener('click', function () {
        filteredList().forEach(function (row) {
          setLb(row.id, 0);
        });
        saveOwned();
        refresh();
      });
    }
    var maxVis = document.getElementById('colMaxVisible');
    if (maxVis) {
      maxVis.addEventListener('click', function () {
        filteredList().forEach(function (row) {
          setLb(row.id, MAX_LB);
        });
        saveOwned();
        refresh();
      });
    }
    var selLim = document.getElementById('colSelectLimited');
    if (selLim) {
      selLim.addEventListener('click', function () {
        var limited = activeList().filter(function (row) {
          return !!row.is_limited_time;
        });
        if (!limited.length) return;
        var allOwned = limited.every(function (row) {
          return getLb(row.id) >= 0;
        });
        limited.forEach(function (row) {
          setLb(row.id, allOwned ? -1 : 0);
        });
        saveOwned();
        refresh();
      });
    }
    var clearAll = document.getElementById('colClearAll');
    if (clearAll) {
      clearAll.addEventListener('click', function () {
        if (!window.confirm(t('reset_confirm', { type: typeTitle() }))) return;
        state.owned[state.type] = {};
        saveOwned();
        refresh();
      });
    }

    var saveBtn = document.getElementById('colSaveImage');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        saveAsImage(saveBtn);
      });
    }
    var shareBtn = document.getElementById('colShareX');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        shareOnX();
      });
    }
    var nameInput = document.getElementById('colUsername');
    if (nameInput) {
      nameInput.value = loadUsername();
      nameInput.addEventListener('change', function () {
        saveUsername(nameInput.value);
      });
      nameInput.addEventListener('blur', function () {
        saveUsername(nameInput.value);
      });
    }
    var closePrev = document.getElementById('colClosePreview');
    if (closePrev) {
      closePrev.addEventListener('click', function () {
        closePreviewModal();
      });
    }
    var modal = document.getElementById('colPreviewModal');
    if (modal) {
      modal.addEventListener('click', function (ev) {
        if (ev.target === modal) closePreviewModal();
      });
    }
  }

  function siteUrl() {
    try {
      return window.location.origin + '/collections';
    } catch (_) {
      return 'https://ggendb.up.railway.app/collections';
    }
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) {
        resolve(null);
        return;
      }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = src;
    });
  }

  function lbBorderColor(lb) {
    if (lb < 0) return '#26323f';
    if (lb === 0) return '#3a4d63';
    if (lb === 1) return 'rgba(74,144,217,0.85)';
    if (lb === 2) return 'rgba(46,213,115,0.75)';
    return 'rgba(255,215,0,0.85)';
  }

  function drawRoundRect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  async function generateShareImage() {
    var rows = activeList();
    var st = computeStats(rows);
    var complete = st.total > 0 && st.owned >= st.total;
    var perfect = complete && st.maxed >= st.total;
    var cols = Math.min(10, Math.max(6, Math.ceil(Math.sqrt(rows.length || 1))));
    var cell = 72;
    var gap = 6;
    var pad = 36;
    var headerExtra = perfect ? 48 : complete ? 28 : 0;
    var headerH = (state.type === 'supporters' ? 268 : 308) + headerExtra;
    var rowsN = Math.max(1, Math.ceil((rows.length || 1) / cols));
    var gridW = cols * cell + (cols - 1) * gap;
    var gridH = rowsN * cell + (rowsN - 1) * gap;
    var W = gridW + pad * 2;
    var H = headerH + gridH + pad + 56;
    var scale = 2;
    var canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, perfect ? '#221808' : complete ? '#1a1610' : '#111827');
    bg.addColorStop(0.4, '#111827');
    bg.addColorStop(1, '#0a0e17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (complete) {
      var glow = ctx.createRadialGradient(pad + 90, pad + 110, 8, pad + 90, pad + 110, perfect ? 280 : 220);
      glow.addColorStop(0, perfect ? 'rgba(255,215,0,0.22)' : 'rgba(255,215,0,0.14)');
      glow.addColorStop(0.45, perfect ? 'rgba(255,180,40,0.1)' : 'rgba(0,212,255,0.06)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, headerH + 40);
    }
    if (perfect) {
      var edge = ctx.createLinearGradient(0, 0, W, 0);
      edge.addColorStop(0, 'rgba(255,215,0,0.55)');
      edge.addColorStop(0.5, 'rgba(0,212,255,0.45)');
      edge.addColorStop(1, 'rgba(255,215,0,0.55)');
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, W - 3, H - 3);
      ctx.strokeStyle = 'rgba(255,215,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(6.5, 6.5, W - 13, H - 13);
    } else {
      ctx.strokeStyle = complete ? 'rgba(255,215,0,0.45)' : '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    }

    var logo = await loadImage(imgUrl('/static/images/UI/IMG_Common_Logo_ETERNALBASE.webp'));
    var logoSize = 52;
    var textX = pad + (logo ? logoSize + 14 : 0);
    if (logo) {
      ctx.drawImage(logo, pad, pad, logoSize, logoSize);
    }

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f0f2f7';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(t('report_title'), textX, pad + 2);

    var playerName = currentUsername();
    ctx.fillStyle = '#8494ae';
    ctx.font = '11px sans-serif';
    ctx.fillText(t('brand_line'), textX, pad + 30);

    if (playerName) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(playerName, textX, pad + 46);
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('UR ' + typeTitle(), textX, pad + 66);
    } else {
      ctx.fillStyle = '#00d4ff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('UR ' + typeTitle(), textX, pad + 48);
    }

    var pctStr = String(st.pct);
    ctx.fillStyle = perfect ? '#ffe566' : complete ? '#ffd700' : '#f1f5f9';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(pctStr, pad, pad + 78);
    var pctW = ctx.measureText(pctStr).width;
    ctx.fillStyle = perfect ? '#ffd700' : complete ? '#7af0ff' : '#00d4ff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('%', pad + pctW + 4, pad + 106);

    if (complete) {
      var badge = perfect ? t('complete_max') : t('complete');
      ctx.font = 'bold 11px sans-serif';
      var bw = Math.max(perfect ? 118 : 72, ctx.measureText(badge).width + 22);
      var bx = pad + pctW + 28;
      var by = pad + 92;
      var badgeGrad = ctx.createLinearGradient(bx, by, bx + bw, by);
      if (perfect) {
        badgeGrad.addColorStop(0, '#fff4c2');
        badgeGrad.addColorStop(0.35, '#ffd700');
        badgeGrad.addColorStop(0.7, '#f0a500');
        badgeGrad.addColorStop(1, '#7af0ff');
      } else {
        badgeGrad.addColorStop(0, '#ffe08a');
        badgeGrad.addColorStop(0.45, '#ffd700');
        badgeGrad.addColorStop(1, '#00d4ff');
      }
      drawRoundRect(ctx, bx, by, bw, 22, 11);
      ctx.fillStyle = badgeGrad;
      ctx.fill();
      if (perfect) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = '#1a1400';
      ctx.textAlign = 'center';
      ctx.fillText(badge, bx + bw / 2, by + 5);
      ctx.textAlign = 'left';

      if (perfect) {
        var subBadge = t('complete') + ' · ' + t('report_max_lb');
        ctx.font = 'bold 10px sans-serif';
        var sbw = Math.max(140, ctx.measureText(subBadge).width + 18);
        var sbx = bx;
        var sby = by + 28;
        drawRoundRect(ctx, sbx, sby, sbw, 18, 9);
        ctx.fillStyle = 'rgba(15,23,42,0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,0,0.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.fillText(subBadge, sbx + sbw / 2, sby + 4);
        ctx.textAlign = 'left';
      }
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px sans-serif';
    ctx.fillText(
      t('owned_line', { owned: st.owned, total: st.total, avg: st.avgLb }),
      pad,
      pad + 156
    );

    var subStats = [
      { v: st.maxed + ' / ' + st.total, l: t('report_max_lb') },
      { v: st.limOwned + ' / ' + st.limTotal, l: t('limited') }
    ];
    if (state.type !== 'supporters') {
      subStats.push(
        { v: st.byRole['1'].o + ' / ' + st.byRole['1'].t, l: t('role_attack') },
        { v: st.byRole['3'].o + ' / ' + st.byRole['3'].t, l: t('role_support') },
        { v: st.byRole['2'].o + ' / ' + st.byRole['2'].t, l: t('role_durability') }
      );
    }
    var subW = gridW / subStats.length;
    var subYOff = perfect ? 48 : complete ? 28 : 0;
    subStats.forEach(function (item, i) {
      var x = pad + i * subW;
      var y = pad + (state.type === 'supporters' ? 186 : 196) + subYOff;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, subW - 4, 48);
      ctx.strokeStyle = perfect
        ? 'rgba(255,215,0,0.5)'
        : complete
          ? 'rgba(255,215,0,0.28)'
          : '#1e293b';
      ctx.strokeRect(x, y, subW - 4, 48);
      ctx.fillStyle = perfect && i === 0 ? '#ffd700' : '#00d4ff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.v, x + (subW - 4) / 2, y + 8);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(item.l, x + (subW - 4) / 2, y + 28);
      ctx.textAlign = 'left';
    });

    var thumbs = await Promise.all(
      rows.map(function (row) {
        return loadImage(imgUrl(row.thum || ''));
      })
    );
    var lbIconImgs = await Promise.all([
      loadImage(imgUrl(LB_ICONS.None)),
      loadImage(imgUrl(LB_ICONS.Neutral)),
      loadImage(imgUrl(LB_ICONS.Max))
    ]);
    var iconNone = lbIconImgs[0];
    var iconNeutral = lbIconImgs[1];
    var iconMax = lbIconImgs[2];

    var unitBaseImg = await loadImage(imgUrl(RARITY_BASE_MAP.UR));
    var unitFrameImg = await loadImage(imgUrl(RARITY_FRAME_MAP.UR));
    var suppBaseImg = await loadImage(imgUrl(TB_SUPPORTER_TB_BASE));
    var suppFr = SUPPORTER_TB_FRAME_MAP.UR;
    var suppLrImg = await loadImage(imgUrl(suppFr.lr));
    var suppTbImg = await loadImage(imgUrl(suppFr.tb));
    var isSupp = state.type === 'supporters';

    var gridY = headerH;
    rows.forEach(function (row, i) {
      var col = i % cols;
      var rowIdx = Math.floor(i / cols);
      var x = pad + col * (cell + gap);
      var y = gridY + rowIdx * (cell + gap);
      var lb = getLb(row.id);
      var im = thumbs[i];

      ctx.fillStyle = '#0b1220';
      ctx.fillRect(x, y, cell, cell);

      if (isSupp) {
        if (suppBaseImg) ctx.drawImage(suppBaseImg, x, y, cell, cell);
        if (im) {
          var insetX = cell * 0.14;
          var insetY = cell * 0.085;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + insetX, y + insetY, cell - insetX * 2, cell - insetY * 2);
          ctx.clip();
          ctx.globalAlpha = lb < 0 ? 0.45 : 1;
          ctx.drawImage(im, x + insetX, y + insetY, cell - insetX * 2, cell - insetY * 2);
          ctx.restore();
        }
        if (suppLrImg) {
          var sideW = cell * 0.27;
          ctx.drawImage(suppLrImg, x, y, sideW, cell);
          ctx.save();
          ctx.translate(x + cell, y);
          ctx.scale(-1, 1);
          ctx.drawImage(suppLrImg, 0, 0, sideW, cell);
          ctx.restore();
        }
        if (suppTbImg) {
          var endH = cell * 0.085;
          var endW = cell * 0.88;
          var endX = x + (cell - endW) / 2;
          ctx.drawImage(suppTbImg, endX, y, endW, endH);
          ctx.drawImage(suppTbImg, endX, y + cell - endH, endW, endH);
        }
      } else {
        if (unitBaseImg) ctx.drawImage(unitBaseImg, x, y, cell, cell);
        if (im) {
          var padIn = cell * 0.1;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + padIn, y + padIn, cell - padIn * 2, cell - padIn * 2 - 2);
          ctx.clip();
          ctx.globalAlpha = lb < 0 ? 0.45 : 1;
          ctx.drawImage(im, x + padIn, y + padIn, cell - padIn * 2, cell - padIn * 2 - 2);
          ctx.restore();
        }
        if (unitFrameImg) ctx.drawImage(unitFrameImg, x, y, cell, cell);
      }

      ctx.strokeStyle = lbBorderColor(lb);
      ctx.lineWidth = lb >= 3 ? 2.5 : 1.5;
      drawRoundRect(ctx, x + 0.5, y + 0.5, cell - 1, cell - 1, 6);
      ctx.stroke();

      if (row.is_limited_time) {
        var limGrad = ctx.createLinearGradient(x, y, x + cell, y);
        if (isSupp) {
          limGrad.addColorStop(0, '#0e7490');
          limGrad.addColorStop(0.45, '#155e75');
          limGrad.addColorStop(1, '#b8954a');
        } else {
          limGrad.addColorStop(0, '#be185d');
          limGrad.addColorStop(0.55, '#a855f7');
          limGrad.addColorStop(1, '#1d4ed8');
        }
        ctx.fillStyle = limGrad;
        ctx.fillRect(x, y, cell, 14);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(limitedWord(), x + cell / 2, y + 3);
        ctx.textAlign = 'left';
      }

      if (lb >= 1) {
        var slots =
          lb === 1
            ? [iconNeutral, iconNone, iconNone]
            : lb === 2
              ? [iconNeutral, iconNeutral, iconNone]
              : [iconMax, iconMax, iconMax];
        var iw = 12;
        var gapI = 1;
        var totalW = slots.length * iw + (slots.length - 1) * gapI;
        var sx0 = x + (cell - totalW) / 2;
        var sy = y + cell - 16;
        ctx.fillStyle = 'rgba(10,14,23,0.88)';
        ctx.fillRect(sx0 - 3, sy - 2, totalW + 6, iw + 4);
        slots.forEach(function (ic, si) {
          if (ic) ctx.drawImage(ic, sx0 + si * (iw + gapI), sy, iw, iw);
        });
      }
    });

    var footY = gridY + gridH + 18;
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(pad, footY);
    ctx.lineTo(W - pad, footY);
    ctx.stroke();
    ctx.fillStyle = '#00d4ff';
    ctx.font = '12px sans-serif';
    var foot = siteUrl().replace(/^https?:\/\//, '');
    var fw = ctx.measureText(foot).width;
    ctx.fillText(foot, W - pad - fw, footY + 12);

    return canvas;
  }

  function closePreviewModal() {
    var modal = document.getElementById('colPreviewModal');
    if (modal) modal.hidden = true;
  }

  async function saveAsImage(btn) {
    var original = t('save_image');
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('generating');
    }
    try {
      var canvas = await generateShareImage();
      var dataUrl = canvas.toDataURL('image/png');
      var img = document.getElementById('colPreviewImg');
      var link = document.getElementById('colDownloadLink');
      var modal = document.getElementById('colPreviewModal');
      if (img) img.src = dataUrl;
      if (link) {
        link.href = dataUrl;
        link.download =
          'ggendb-collections-report-' +
          state.type +
          '-' +
          String(computeStats(activeList()).pct).replace('.', '_') +
          'pct.png';
        link.textContent = t('download');
      }
      if (modal) modal.hidden = false;
      if (link) {
        try {
          link.click();
        } catch (_) {}
      }
    } catch (err) {
      window.alert(t('save_fail', { err: err && err.message ? err.message : err }));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = original;
      }
    }
  }

  function loadUsername() {
    try {
      return String(localStorage.getItem(USERNAME_KEY) || '').trim().slice(0, 32);
    } catch (e) {
      return '';
    }
  }

  function saveUsername(raw) {
    var name = String(raw || '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 32);
    try {
      if (name) localStorage.setItem(USERNAME_KEY, name);
      else localStorage.removeItem(USERNAME_KEY);
    } catch (e) {}
    var input = document.getElementById('colUsername');
    if (input && input.value !== name) input.value = name;
    return name;
  }

  function currentUsername() {
    var input = document.getElementById('colUsername');
    return saveUsername(input ? input.value : loadUsername());
  }

  function shareOnX() {
    var name = currentUsername();
    if (!name) {
      var input = document.getElementById('colUsername');
      var status = document.getElementById('colStatus');
      if (status) status.textContent = t('share_need_name');
      if (input) {
        input.focus();
        input.classList.add('is-need-name');
        setTimeout(function () {
          input.classList.remove('is-need-name');
        }, 1200);
      }
      return;
    }
    var st = computeStats(activeList());
    var text = t('share_body_named', {
      name: name,
      type: typeTitle(),
      pct: st.pct,
      owned: st.owned,
      total: st.total,
      noun: state.type === 'supporters' ? t('noun_supporters') : t('noun_units'),
      avg: st.avgLb,
      url: siteUrl()
    });
    var intent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    window.open(intent, '_blank', 'noopener,noreferrer');
  }

  state.lang = normLang(state.lang);
  applyUiLang();
  bind();
  loadCatalog();
})();
