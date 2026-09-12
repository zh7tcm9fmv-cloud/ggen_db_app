(function () {
  'use strict';

  var STORAGE_KEY = 'ggen_collections_v1';
  var USERNAME_KEY = 'ggen_collections_username';
  var SAVES_KEY = 'ggen_collections_saves_v1';
  var SAVE_SLOT_COUNT = 5;
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
      page_title: 'Hangar Collection — GGen Eternal Database',
      eyebrow: 'UR Acquisition Review',
      title: 'Hangar Collection',
      sub: 'Track UR unit and supporter possession\nTap a portrait to cycle not possessed → Limit Break 0 → MAX Limit Break.\nPossessing a unit covers its character',
      lang: 'Lang',
      support_alipay: 'Support on AlipayHK',
      support_kofi: 'Support on Ko-fi',
      alipay_modal_title: 'AlipayHK',
      alipay_modal_hint: 'Scan the QR code with AlipayHK to pay HK$50.00.',
      alipay_close: 'Close',
      units: 'Units',
      supporters: 'Supporters',
      role_all: 'All',
      role_attack: 'Attack Type',
      role_support: 'Support Type',
      role_durability: 'Durability Type',
      search_ph: 'Search name or ID…',
      select_lb0: 'Select All (LB0)',
      select_max: 'Select All (Max LB)',
      select_limited: 'Select All Limited (LB0)',
      reset_all: 'Reset All',
      save_image: 'Save as image',
      share_x: 'Share on {x}',
      share_code: 'Share code',
      share_code_ph: 'Paste code to import…',
      copy_share_code: 'Generate share code',
      import_share_code: 'Import',
      share_code_copied: 'Share code copied — name it to save a slot (optional).',
      share_code_fail: 'Could not create share code.\n{err}',
      share_import_ok: 'Imported {n} entries.',
      share_import_fail: 'Invalid or unknown share code.',
      share_import_confirm: 'Replace this browser’s Collections progress with the imported code?',
      share_save_name: 'Name this collection',
      share_save_slot: 'Save to slot',
      share_save_confirm: 'Save',
      share_save_skip: 'Not now',
      share_save_ok: 'Saved “{name}” to slot {i} · code {code}',
      share_save_need_name: 'Enter a collection name to save.',
      slot_empty: 'empty',
      slot_label: '{i}. {name}',
      username: 'Player name',
      username_ph: 'Your in-game name',
      share_need_name: 'Enter your player name to include it on X.',
      share_paste_hint: 'Image copied — paste it into your X post (Ctrl+V / ⌘V).',
      share_attach_hint: 'Image downloaded — attach it to your X post.',
      share_done: 'Shared.',
      share_fail: 'Could not share.\n{err}',
      share_cancel: 'Share cancelled.',
      possession: 'Possession',
      complete: 'COMPLETE',
      complete_max: 'MAX LIMIT BREAK',
      owned: 'Possessed',
      max_lb: 'Max Limit Break',
      report_max_lb: 'Max Limit Break',
      lb_progress: 'Limit Break',
      role_owned: '{role}',
      limited: 'Limited',
      skill_hp: 'HP Restoration',
      skill_en: 'EN Restoration',
      skill_hybrid: 'Hybrid',
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
      owned_line: 'Possessed {owned} / {total} · Limit Break {lb} / {lbMax}',
      share_body:
        'GGEN ETERNAL DATABASE — Collections Report\n· UR Units {u_pct}% ({u_owned}/{u_total}) · LB {u_lb}/{u_lbMax}\n· UR Supporters {s_pct}% ({s_owned}/{s_total}) · LB {s_lb}/{s_lbMax}\nTrack yours + join the anonymous census so community charts grow:\n{url}\n#GundamEternal #ジージェネエターナル',
      share_body_named:
        'GGEN ETERNAL DATABASE — Collections Report\n{name}\n· UR Units {u_pct}% ({u_owned}/{u_total}) · LB {u_lb}/{u_lbMax}\n· UR Supporters {s_pct}% ({s_owned}/{s_total}) · LB {s_lb}/{s_lbMax}\nTrack yours + join the anonymous census so community charts grow:\n{url}\n#GundamEternal #ジージェネエターナル',
      noun_units: 'units',
      noun_supporters: 'supporters',
      unowned: 'Not possessed',
      census_title: 'Community census',
      census_blurb:
        'Opt-in anonymous stats. Choose a unique display name. Graphs never show names.',
      census_optin: 'Include my Collections in the anonymous census',
      census_submit: 'Submit / update census',
      census_hist_title: 'Player collection depth',
      census_own_title: 'Most collected {type}',
      census_hist_hint:
        'Each bar = how many players whose Possession % (owned ÷ catalog) falls in that range — same as the Possession gauge. Units and Supporters each have their own chart (switch tabs).',
      census_own_hint:
        'Sorted least → most collected (left → right). Height = total possession points in the census (not possessed = 0 · Max Limit Break = 4). Hover a bar (or click on mobile) for details.',
      census_own_tip: '{pts} pts · {owned} have it · avg {avg} / 4',
      census_y_owned: 'Pts',
      census_need_optin: 'Check the opt-in box to contribute.',
      census_need_name: 'Enter a display name first (unique across contributors).',
      census_ok: 'Census saved as “{name}” · {n} snapshots.',
      census_updated: 'Census updated for “{name}” · {n} snapshots.',
      census_name_taken: 'That display name is already used. Pick another.',
      census_fail: 'Census submit failed.\n{err}',
      census_empty: 'No opt-in snapshots yet — be the first.',
      census_meta: '{n} anonymous snapshots · board: {board}',
      census_loading: 'Loading census…',
      saves_title: 'Saved Collections',
      save_slot_ph: 'Collection name',
      save_slot: 'Save',
      load_slot: 'Load',
      clear_slot: 'Clear',
      save_slot_ok: 'Saved “{name}”.',
      load_slot_ok: 'Loaded “{name}” ({n} entries).',
      load_slot_empty: 'That slot is empty.',
      load_slot_confirm: 'Replace this browser’s current Collections with “{name}”?',
      clear_slot_ok: 'Cleared slot {i}.',
      default_save_name: 'Collection {i}',
      special_design: 'Special Design',
      classic: 'Classic'
    },
    JA: {
      page_title: '格納庫コレクション — GGen Eternal Database',
      eyebrow: 'UR取得進捗',
      title: '格納庫コレクション',
      sub: 'URユニット／サポーターの所持を記録\nタップで未所持 → 限界突破0 → 限界突破MAX。\nユニット所持はキャラクター所持も含みます',
      lang: '言語',
      support_alipay: 'AlipayHKで支援',
      support_kofi: 'Ko-fiで支援',
      alipay_modal_title: 'AlipayHK',
      alipay_modal_hint: 'AlipayHKアプリでQRコードを読み取り、HK$50.00をお支払いください。',
      alipay_close: '閉じる',
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
      share_x: '{x}でシェア',
      share_code: '共有コード',
      share_code_ph: 'コードを貼り付けてインポート…',
      copy_share_code: '共有コードを生成',
      import_share_code: 'コードを引用する',
      share_code_copied: '共有コードをコピーしました — 名前を付けてスロットに保存できます。',
      share_code_fail: '共有コードを作成できませんでした。\n{err}',
      share_import_ok: '{n}件をインポートしました。',
      share_import_fail: '無効または不明な共有コードです。',
      share_import_confirm: 'このブラウザのコレクション記録をインポート内容で置き換えますか？',
      share_save_name: 'コレクション名',
      share_save_slot: '保存スロット',
      share_save_confirm: '保存',
      share_save_skip: 'いまはしない',
      share_save_ok: '「{name}」をスロット {i} に保存 · コード {code}',
      share_save_need_name: '保存するにはコレクション名を入力してください。',
      slot_empty: '空き',
      slot_label: '{i}. {name}',
      username: 'プレイヤー名',
      username_ph: 'ゲーム内のプレイヤー名',
      share_need_name: 'Xに含めるプレイヤー名を入力してください。',
      share_paste_hint: '画像をコピーしました。Xの投稿に貼り付けてください（Ctrl+V / ⌘V）。',
      share_attach_hint: '画像をダウンロードしました。Xの投稿に添付してください。',
      share_done: 'シェアしました。',
      share_fail: 'シェアできませんでした。\n{err}',
      share_cancel: 'シェアをキャンセルしました。',
      possession: '所持率',
      complete: 'コンプリート',
      complete_max: '限界突破コンプリート',
      owned: '所持',
      max_lb: '限界突破MAX',
      report_max_lb: '限界突破MAX',
      lb_progress: '限界突破',
      role_owned: '{role}',
      limited: '期間限定',
      skill_hp: 'HP回復',
      skill_en: 'EN回復',
      skill_hybrid: 'Hybrid',
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
      owned_line: '所持 {owned} / {total} · 限界突破 {lb} / {lbMax}',
      share_body:
        'GGEN ETERNAL DATABASE — コレクションレポート\n· URユニット 所持率 {u_pct}%（{u_owned}/{u_total}）· 限界突破 {u_lb}/{u_lbMax}\n· UR支援 所持率 {s_pct}%（{s_owned}/{s_total}）· 限界突破 {s_lb}/{s_lbMax}\nあなたも記録＆匿名センサスに参加してグラフを豊かに：\n{url}\n#GundamEternal #ジージェネエターナル',
      share_body_named:
        'GGEN ETERNAL DATABASE — コレクションレポート\n{name}\n· URユニット 所持率 {u_pct}%（{u_owned}/{u_total}）· 限界突破 {u_lb}/{u_lbMax}\n· UR支援 所持率 {s_pct}%（{s_owned}/{s_total}）· 限界突破 {s_lb}/{s_lbMax}\nあなたも記録＆匿名センサスに参加してグラフを豊かに：\n{url}\n#GundamEternal #ジージェネエターナル',
      noun_units: '機',
      noun_supporters: '体',
      unowned: '未所持',
      census_title: 'コミュニティセンサス',
      census_blurb:
        '任意参加の匿名統計です。表示名は一意。グラフに名前は出ません。',
      census_optin: '自分のコレクションを匿名センサスに含める',
      census_submit: 'センサスを送信／更新',
      census_hist_title: 'プレイヤーのコレクション深度',
      census_own_title: '所持が多い{type}',
      census_hist_hint:
        '各棒＝その所持％（所持数÷カタログ）帯にいる人数。上部の所持率ゲージと同じ基準。ユニット／支援はタブ切替で別集計。',
      census_own_hint:
        '所持ポイントが少ない順（左→右）。高さ＝センサス内の合計所持ポイント（未所持=0・限界突破MAX=4）。棒にホバー（スマホはタップ）で詳細表示。',
      census_own_tip: '{pts}pt · 所持 {owned}人 · 平均 {avg} / 4',
      census_y_owned: 'Pt',
      census_need_optin: '参加するにはチェックを入れてください。',
      census_need_name: '先に表示名を入力してください（他者と重複不可）。',
      census_ok: '「{name}」としてセンサスを保存しました · {n}件。',
      census_updated: '「{name}」のセンサスを更新しました · {n}件。',
      census_name_taken: 'その表示名は使用中です。別の名前を選んでください。',
      census_fail: 'センサス送信に失敗しました。\n{err}',
      census_empty: 'まだ任意参加のスナップショットがありません。',
      census_meta: '匿名スナップショット {n}件 · 対象: {board}',
      census_loading: 'センサス読み込み中…',
      saves_title: '保存したコレクション',
      save_slot_ph: 'コレクション名',
      save_slot: '保存',
      load_slot: '読込',
      clear_slot: 'クリア',
      save_slot_ok: '「{name}」を保存しました。',
      load_slot_ok: '「{name}」を読み込みました（{n}件）。',
      load_slot_empty: 'このスロットは空です。',
      load_slot_confirm: '現在のコレクションを「{name}」で置き換えますか？',
      clear_slot_ok: 'スロット {i} をクリアしました。',
      default_save_name: 'コレクション {i}',
      special_design: '特設デザイン',
      classic: 'Classic'
    },
    TW: {
      page_title: '格納庫收藏 — GGen Eternal Database',
      eyebrow: 'UR獲取進度',
      title: '格納庫收藏',
      sub: '記錄 UR 單位與支援人員持有狀態\n點選肖像可循環：未持有 → 突破界限 0 → 突破界限 MAX。\n持有單位即視為持有角色',
      lang: '語言',
      support_alipay: '以 AlipayHK 支持',
      support_kofi: '在 Ko-fi 支持',
      alipay_modal_title: 'AlipayHK',
      alipay_modal_hint: '請使用 AlipayHK 掃描二維碼付款（港幣 50.00 元）。',
      alipay_close: '關閉',
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
      share_x: '分享至 {x}',
      share_code: '分享代碼',
      share_code_ph: '貼上代碼以匯入…',
      copy_share_code: '生成分享代碼',
      import_share_code: '引用代碼',
      share_code_copied: '已複製分享代碼 — 可命名後存入欄位（選用）。',
      share_code_fail: '無法建立分享代碼。\n{err}',
      share_import_ok: '已匯入 {n} 筆。',
      share_import_fail: '無效或未知的分享代碼。',
      share_import_confirm: '要用匯入的代碼取代此瀏覽器的收藏進度嗎？',
      share_save_name: '為此收藏命名',
      share_save_slot: '存入欄位',
      share_save_confirm: '儲存',
      share_save_skip: '暫時不要',
      share_save_ok: '已將「{name}」存入欄位 {i} · 代碼 {code}',
      share_save_need_name: '請輸入收藏名稱後再儲存。',
      slot_empty: '空',
      slot_label: '{i}. {name}',
      username: '玩家名稱',
      username_ph: '遊戲內的玩家名稱',
      share_need_name: '請輸入要一併分享到 X 的玩家名稱。',
      share_paste_hint: '已複製圖片 — 請貼到 X 貼文（Ctrl+V / ⌘V）。',
      share_attach_hint: '已下載圖片 — 請附加到 X 貼文。',
      share_done: '已分享。',
      share_fail: '無法分享。\n{err}',
      share_cancel: '已取消分享。',
      possession: '持有率',
      complete: '全收集',
      complete_max: '突破界限全滿',
      owned: '持有',
      max_lb: '突破界限 MAX',
      report_max_lb: '突破界限 MAX',
      lb_progress: '突破界限',
      role_owned: '{role}',
      limited: '期間限定',
      skill_hp: 'HP恢復',
      skill_en: 'EN恢復',
      skill_hybrid: 'Hybrid',
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
      owned_line: '持有 {owned} / {total} · 突破界限 {lb} / {lbMax}',
      share_body:
        'GGEN ETERNAL DATABASE — 收藏報告\n· UR 單位 持有率 {u_pct}%（{u_owned}/{u_total}）· 突破界限 {u_lb}/{u_lbMax}\n· UR 支援人員 持有率 {s_pct}%（{s_owned}/{s_total}）· 突破界限 {s_lb}/{s_lbMax}\n一起追蹤收藏，並加入匿名普查豐富社群圖表：\n{url}\n#GundamEternal #ジージェネエターナル',
      share_body_named:
        'GGEN ETERNAL DATABASE — 收藏報告\n{name}\n· UR 單位 持有率 {u_pct}%（{u_owned}/{u_total}）· 突破界限 {u_lb}/{u_lbMax}\n· UR 支援人員 持有率 {s_pct}%（{s_owned}/{s_total}）· 突破界限 {s_lb}/{s_lbMax}\n一起追蹤收藏，並加入匿名普查豐富社群圖表：\n{url}\n#GundamEternal #ジージェネエターナル',
      noun_units: '機',
      noun_supporters: '個',
      unowned: '未持有',
      census_title: '社群普查',
      census_blurb: '自願加入的匿名統計。顯示名稱須唯一。圖表不顯示名稱。',
      census_optin: '將我的收藏納入匿名普查',
      census_submit: '送出／更新普查',
      census_hist_title: '玩家收藏深度',
      census_own_title: '最多持有{type}',
      census_hist_hint:
        '每根長條＝持有率％（持有數÷目錄）落在該區間的人數——與上方持有率量表相同。單位／支援人員請切換分頁分別查看。',
      census_own_hint:
        '依持有點數由低到高（左→右）。高度＝普查內合計持有點數（未持有=0・突破界限 MAX=4）。懸停長條（手機點擊）可查看詳情。',
      census_own_tip: '{pts} 點 · 持有 {owned} 人 · 平均 {avg} / 4',
      census_y_owned: '點',
      census_need_optin: '請先勾選同意納入普查。',
      census_need_name: '請先輸入顯示名稱（不可與其他人重複）。',
      census_ok: '已以「{name}」儲存普查 · {n} 筆快照。',
      census_updated: '已更新「{name}」的普查 · {n} 筆快照。',
      census_name_taken: '此顯示名稱已被使用，請換一個。',
      census_fail: '普查送出失敗。\n{err}',
      census_empty: '尚無自願快照 — 歡迎成為第一位。',
      census_meta: '{n} 筆匿名快照 · 板面: {board}',
      census_loading: '正在載入普查…',
      saves_title: '已儲存的收藏',
      save_slot_ph: '收藏名稱',
      save_slot: '儲存',
      load_slot: '讀取',
      clear_slot: '清除',
      save_slot_ok: '已儲存「{name}」。',
      load_slot_ok: '已讀取「{name}」（{n} 筆）。',
      load_slot_empty: '此欄位是空的。',
      load_slot_confirm: '要用「{name}」取代目前的收藏嗎？',
      clear_slot_ok: '已清除欄位 {i}。',
      default_save_name: '收藏 {i}',
      special_design: '特別設計',
      classic: 'Classic'
    },
    HK: {
      page_title: '格納庫收藏 — GGen Eternal Database',
      eyebrow: 'UR獲取進度',
      title: '格納庫收藏',
      sub: '記錄 UR 單位與支援人員持有狀態\n點選肖像可循環：未持有 → 突破界限 0 → 突破界限 MAX。\n持有單位即視為持有角色',
      lang: '語言',
      support_alipay: '以 AlipayHK 支持',
      support_kofi: '在 Ko-fi 支持',
      alipay_modal_title: 'AlipayHK',
      alipay_modal_hint: '請使用 AlipayHK 掃描二維碼付款（港幣 50.00 元）。',
      alipay_close: '關閉',
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
      share_x: '分享至 {x}',
      share_code: '分享代碼',
      share_code_ph: '貼上代碼以匯入…',
      copy_share_code: '生成分享代碼',
      import_share_code: '引用代碼',
      share_code_copied: '已複製分享代碼 — 可命名後存入欄位（選用）。',
      share_code_fail: '無法建立分享代碼。\n{err}',
      share_import_ok: '已匯入 {n} 筆。',
      share_import_fail: '無效或未知的分享代碼。',
      share_import_confirm: '要用匯入的代碼取代此瀏覽器的收藏進度嗎？',
      share_save_name: '為此收藏命名',
      share_save_slot: '存入欄位',
      share_save_confirm: '儲存',
      share_save_skip: '暫時不要',
      share_save_ok: '已將「{name}」存入欄位 {i} · 代碼 {code}',
      share_save_need_name: '請輸入收藏名稱後再儲存。',
      slot_empty: '空',
      slot_label: '{i}. {name}',
      username: '玩家名稱',
      username_ph: '遊戲內的玩家名稱',
      share_need_name: '請輸入要一併分享到 X 的玩家名稱。',
      share_paste_hint: '已複製圖片 — 請貼到 X 貼文（Ctrl+V / ⌘V）。',
      share_attach_hint: '已下載圖片 — 請附加到 X 貼文。',
      share_done: '已分享。',
      share_fail: '無法分享。\n{err}',
      share_cancel: '已取消分享。',
      possession: '持有率',
      complete: '全收集',
      complete_max: '突破界限全滿',
      owned: '持有',
      max_lb: '突破界限 MAX',
      report_max_lb: '突破界限 MAX',
      lb_progress: '突破界限',
      role_owned: '{role}',
      limited: '期間限定',
      skill_hp: 'HP恢復',
      skill_en: 'EN恢復',
      skill_hybrid: 'Hybrid',
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
      owned_line: '持有 {owned} / {total} · 突破界限 {lb} / {lbMax}',
      share_body:
        'GGEN ETERNAL DATABASE — 收藏報告\n· UR 單位 持有率 {u_pct}%（{u_owned}/{u_total}）· 突破界限 {u_lb}/{u_lbMax}\n· UR 支援人員 持有率 {s_pct}%（{s_owned}/{s_total}）· 突破界限 {s_lb}/{s_lbMax}\n一起追蹤收藏，並加入匿名普查豐富社群圖表：\n{url}\n#GundamEternal #ジージェネエターナル',
      share_body_named:
        'GGEN ETERNAL DATABASE — 收藏報告\n{name}\n· UR 單位 持有率 {u_pct}%（{u_owned}/{u_total}）· 突破界限 {u_lb}/{u_lbMax}\n· UR 支援人員 持有率 {s_pct}%（{s_owned}/{s_total}）· 突破界限 {s_lb}/{s_lbMax}\n一起追蹤收藏，並加入匿名普查豐富社群圖表：\n{url}\n#GundamEternal #ジージェネエターナル',
      noun_units: '機',
      noun_supporters: '個',
      unowned: '未持有',
      census_title: '社群普查',
      census_blurb: '自願加入的匿名統計。顯示名稱須唯一。圖表不顯示名稱。',
      census_optin: '將我的收藏納入匿名普查',
      census_submit: '送出／更新普查',
      census_hist_title: '玩家收藏深度',
      census_own_title: '最多持有{type}',
      census_hist_hint:
        '每根長條＝持有率％（持有數÷目錄）落在該區間的人數——與上方持有率量表相同。單位／支援人員請切換分頁分別查看。',
      census_own_hint:
        '依持有點數由低到高（左→右）。高度＝普查內合計持有點數（未持有=0・突破界限 MAX=4）。懸停長條（手機點擊）可查看詳情。',
      census_own_tip: '{pts} 點 · 持有 {owned} 人 · 平均 {avg} / 4',
      census_y_owned: '點',
      census_need_optin: '請先勾選同意納入普查。',
      census_need_name: '請先輸入顯示名稱（不可與其他人重複）。',
      census_ok: '已以「{name}」儲存普查 · {n} 筆快照。',
      census_updated: '已更新「{name}」的普查 · {n} 筆快照。',
      census_name_taken: '此顯示名稱已被使用，請換一個。',
      census_fail: '普查送出失敗。\n{err}',
      census_empty: '尚無自願快照 — 歡迎成為第一位。',
      census_meta: '{n} 筆匿名快照 · 板面: {board}',
      census_loading: '正在載入普查…',
      saves_title: '已儲存的收藏',
      save_slot_ph: '收藏名稱',
      save_slot: '儲存',
      load_slot: '讀取',
      clear_slot: '清除',
      save_slot_ok: '已儲存「{name}」。',
      load_slot_ok: '已讀取「{name}」（{n} 筆）。',
      load_slot_empty: '此欄位是空的。',
      load_slot_confirm: '要用「{name}」取代目前的收藏嗎？',
      clear_slot_ok: '已清除欄位 {i}。',
      default_save_name: '收藏 {i}',
      special_design: '特別設計',
      classic: 'Classic'
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
    busy: false,
    pendingShare: null
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
    var bySkill = {
      hp: { t: 0, o: 0 },
      en: { t: 0, o: 0 },
      hybrid: { t: 0, o: 0 }
    };
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
      var sk = String(row.skill_kind || '');
      if (bySkill[sk]) {
        bySkill[sk].t++;
        if (isOwned) bySkill[sk].o++;
      }
    });
    var pct = total ? Math.round((owned / total) * 1000) / 10 : 0;
    var lbMax = total * MAX_LB;
    return {
      total: total,
      owned: owned,
      maxed: maxed,
      limTotal: limTotal,
      limOwned: limOwned,
      byRole: byRole,
      bySkill: bySkill,
      pct: pct,
      lbTotal: lbSum,
      lbMax: lbMax
    };
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* Official X logo path (X Corp brand mark; viewBox 0 0 24 24). */
  var X_LOGO_SVG =
    '<svg class="collections-x-logo" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>' +
    '</svg>';

  function shareXAriaLabel() {
    return String(t('share_x') || '').replace(/\{x\}/g, 'X');
  }

  function shareXLabelHtml() {
    var raw = String(t('share_x') || '');
    var parts = raw.split('{x}');
    if (parts.length === 1) return esc(raw);
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      html += esc(parts[i]);
      if (i < parts.length - 1) html += X_LOGO_SVG;
    }
    return html;
  }

  function applyShareXBtnLabel(btn) {
    var el = btn || document.getElementById('colShareX');
    if (!el) return;
    el.innerHTML = shareXLabelHtml();
    el.setAttribute('aria-label', shareXAriaLabel());
  }

  function applyUiLang() {
    state.lang = normLang(state.lang);
    document.documentElement.setAttribute('data-ui-lang', state.lang);
    document.documentElement.lang =
      state.lang === 'JA' ? 'ja' : state.lang === 'TW' ? 'zh-Hant-TW' : state.lang === 'HK' ? 'zh-Hant-HK' : 'en';
    try {
      if (typeof window.__ggenInjectBrandFonts === 'function') window.__ggenInjectBrandFonts();
    } catch (e) {}
    document.title = t('page_title');
    setText('colEyebrow', t('eyebrow'));
    setText('colTitle', t('title'));
    setText('colSub', t('sub'));
    setText('alipayhkHeaderLabel', t('support_alipay'));
    setText('kofiHeaderLabel', t('support_kofi'));
    setText('alipayhkModalTitle', t('alipay_modal_title'));
    setText('alipayhkModalHint', t('alipay_modal_hint'));
    var alipayClose = document.getElementById('alipayhkModalCloseBtn');
    if (alipayClose) alipayClose.setAttribute('aria-label', t('alipay_close'));
    var alipayBtn = document.getElementById('alipayhkHeaderBtn');
    if (alipayBtn) alipayBtn.setAttribute('aria-label', t('support_alipay'));
    var kofiLink = document.getElementById('kofiHeaderLink');
    if (kofiLink) kofiLink.setAttribute('aria-label', t('support_kofi'));
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
    applyShareXBtnLabel();
    setText('colUsernameLabel', t('username'));
    setText('colShareCodeLabel', t('share_code'));
    setText('colCopyShareCode', t('copy_share_code'));
    setText('colImportShareCode', t('import_share_code'));
    setText('colCensusTitle', t('census_title'));
    setText('colCensusOptInLbl', t('census_optin'));
    setText('colCensusSubmit', t('census_submit'));
    setText('colCensusHistTitle', t('census_hist_title'));
    setText('colCensusOwnTitle', t('census_own_title', { type: typeTitle() }));
    setText('colCensusHistHint', t('census_hist_hint'));
    setText('colCensusOwnHint', t('census_own_hint'));
    setText('colSavesTitle', t('saves_title'));
    setText('colShareSaveNameLbl', t('share_save_name'));
    setText('colShareSaveSlotLbl', t('share_save_slot'));
    setText('colShareSaveConfirm', t('share_save_confirm'));
    setText('colShareSaveSkip', t('share_save_skip'));
    var shareSaveName = document.getElementById('colShareSaveName');
    if (shareSaveName) shareSaveName.placeholder = t('save_slot_ph');
    renderSaveSlots();
    refreshShareSaveSlotOptions();
    var codeInput = document.getElementById('colShareCode');
    if (codeInput) {
      codeInput.placeholder = t('share_code_ph');
      codeInput.setAttribute('aria-label', t('share_code'));
    }
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
    syncSpecialDesignIcon();
  }

  /** Locale WebP for Special Design mark — same-origin (custom asset, not on game CDN). */
  function specialDesignIconSrc() {
    var L = String(state.lang || 'EN').toUpperCase();
    if (L === 'JP') L = 'JA';
    if (L !== 'EN' && L !== 'JA' && L !== 'TW' && L !== 'HK') L = 'EN';
    return '/static/images/UI/collections_15_special_design_' + L + '.webp';
  }

  function syncSpecialDesignIcon() {
    var label = t('special_design');
    var img = document.getElementById('ggen15OnImg');
    var onBtn = document.getElementById('ggen15On');
    var src = specialDesignIconSrc();
    if (img) {
      img.src = src;
      img.alt = label;
    }
    if (onBtn) onBtn.setAttribute('aria-label', label);
    var offBtn = document.getElementById('ggen15Off');
    if (offBtn) offBtn.textContent = t('classic');
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

  function openAlipayhkModal() {
    var ov = document.getElementById('alipayhkOverlay');
    if (!ov) return;
    closeLangDropdown();
    ov.classList.add('active');
    ov.setAttribute('aria-hidden', 'false');
  }

  function closeAlipayhkModal() {
    var ov = document.getElementById('alipayhkOverlay');
    if (!ov || !ov.classList.contains('active')) return;
    ov.classList.remove('active');
    ov.setAttribute('aria-hidden', 'true');
  }

  window.openAlipayhkModal = openAlipayhkModal;
  window.closeAlipayhkModal = closeAlipayhkModal;

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

  var SHARE_SCENE_BGS = [
    '/static/images/Background/obg_012_garage.webp',
    '/static/images/Background/obg_021_office.webp'
  ];

  function pickShareSceneBg() {
    return SHARE_SCENE_BGS[(Math.random() * SHARE_SCENE_BGS.length) | 0];
  }

  function drawShareHeaderSceneArt(ctx, img, W, artH) {
    if (!img || !img.width || !img.height || artH <= 0) return;
    var destW = W;
    var destH = artH;
    var destX = 0;
    var destY = 0;
    var ir = img.width / img.height;
    var dr = destW / destH;
    var sx, sy, sw, sh;
    if (ir > dr) {
      sh = img.height;
      sw = sh * dr;
      sx = (img.width - sw) * 0.5;
      sy = 0;
    } else {
      sw = img.width;
      sh = sw / dr;
      sx = 0;
      sy = Math.max(0, (img.height - sh) * 0.25);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(destX, destY, destW, destH);
    ctx.clip();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(img, sx, sy, sw, sh, destX, destY, destW, destH);
    ctx.globalAlpha = 1;
    /* Even navy wash so text/gauge stay readable */
    ctx.fillStyle = 'rgba(10,14,23,0.48)';
    ctx.fillRect(destX, destY, destW, destH);
    var bottom = ctx.createLinearGradient(destX, destY + destH * 0.4, destX, destY + destH);
    bottom.addColorStop(0, 'rgba(10,14,23,0)');
    bottom.addColorStop(0.55, 'rgba(10,14,23,0.35)');
    bottom.addColorStop(1, 'rgba(10,14,23,0.95)');
    ctx.fillStyle = bottom;
    ctx.fillRect(destX, destY, destW, destH);
    ctx.restore();
  }

  var TYPE_ICON_UNIT_FILL = '/static/images/UI/UI_Gallery_Motif_MS.webp';
  var TYPE_ICON_SUPP_FILL = '/static/images/UI/wsc_g0010w00100.webp';
  var STAT_ICON_OWNED = '/static/images/UI/Ui_Secret_Clear_Icon.webp';
  var STAT_ICON_LB_MAX = '/static/images/UI/UI_Common_Icon_Grade_M_Max.webp';
  var SKILL_ICON_HP = '/static/images/Trait/trait_10010401.webp';
  var SKILL_ICON_EN = '/static/images/Trait/trait_10020501.webp';
  var SKILL_ICON_HYBRID = '/static/images/Trait/trait_10780401.webp';
  var ROLE_ICON = {
    '1': '/static/images/UI/UI_Common_TypeIcon_Attack_M.webp',
    '3': '/static/images/UI/UI_Common_TypeIcon_Support_M.webp',
    '2': '/static/images/UI/UI_Common_TypeIcon_Defense_M.webp'
  };

  var wasComplete = false;
  var wasPerfect = false;
  var lastPctKey = '';
  var successCheckTimer = null;
  var reelBlurRaf = 0;

  function prefersReducedMotion() {
    try {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function flashSuccessCheck() {
    var el = document.getElementById('colSuccessCheck');
    if (!el) return;
    if (prefersReducedMotion()) {
      el.setAttribute('data-state', 'in');
      clearTimeout(successCheckTimer);
      successCheckTimer = setTimeout(function () {
        el.setAttribute('data-state', 'out');
      }, 1400);
      return;
    }
    el.setAttribute('data-state', 'out');
    var path = el.querySelector('path');
    if (path) {
      path.style.animation = 'none';
      void path.offsetWidth;
      path.style.animation = '';
    }
    void el.offsetWidth;
    el.setAttribute('data-state', 'in');
    clearTimeout(successCheckTimer);
    successCheckTimer = setTimeout(function () {
      el.setAttribute('data-state', 'out');
    }, 2000);
  }

  function pctDisplayKey(pct) {
    var whole = Math.floor(pct);
    var frac = Math.round((pct - whole) * 10);
    return String(whole) + (frac ? '.' + frac : '');
  }

  function buildPctReelHtml(text, animate) {
    var reduce = prefersReducedMotion();
    var doSpin = !!animate && !reduce;
    var html = '<span class="t-reel" aria-label="' + esc(text) + '%">';
    var col = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '.') {
        html += '<span class="t-reel-punct">.</span>';
        continue;
      }
      var digit = parseInt(ch, 10);
      if (!Number.isFinite(digit)) continue;
      var spins = doSpin ? 2 + (col % 2) : 0;
      var fid = 'colReelBlur' + col;
      var cells = '';
      var copies = spins + 1;
      var c;
      var d;
      for (c = 0; c < copies; c++) {
        for (d = 0; d < 10; d++) {
          cells += '<span class="t-reel-digit">' + d + '</span>';
        }
      }
      html +=
        '<span class="t-reel-col">' +
        '<svg class="t-reel-svg-defs" aria-hidden="true" focusable="false">' +
        '<defs><filter id="' +
        fid +
        '" x="-20%" y="-20%" width="140%" height="140%">' +
        '<feGaussianBlur class="t-reel-fe" in="SourceGraphic" stdDeviation="0 0"/>' +
        '</filter></defs></svg>' +
        '<span class="t-reel-strip" data-spins="' +
        spins +
        '" data-digit="' +
        digit +
        '" style="filter:url(#' +
        fid +
        ')">' +
        cells +
        '</span></span>';
      col++;
    }
    html += '<span class="t-digit t-digit--pct">%</span></span>';
    return html;
  }

  function runPctReelSpin(pctEl) {
    if (!pctEl || prefersReducedMotion()) {
      if (pctEl) {
        var strips0 = pctEl.querySelectorAll('.t-reel-strip');
        for (var s0 = 0; s0 < strips0.length; s0++) {
          var dig0 = parseInt(strips0[s0].getAttribute('data-digit') || '0', 10);
          strips0[s0].style.transition = 'none';
          strips0[s0].style.transform = 'translateY(-' + dig0 + 'em)';
        }
      }
      return;
    }
    if (reelBlurRaf) {
      cancelAnimationFrame(reelBlurRaf);
      reelBlurRaf = 0;
    }
    var cols = pctEl.querySelectorAll('.t-reel-col');
    var cs = getComputedStyle(pctEl);
    var durMs = parseFloat(cs.getPropertyValue('--reel-dur')) || 980;
    if (durMs < 50) durMs = 980;
    var staggerMs = parseFloat(cs.getPropertyValue('--reel-stagger')) || 75;
    var blurMax = parseFloat(cs.getPropertyValue('--reel-spin-blur')) || 2.5;
    var ease = (cs.getPropertyValue('--reel-ease') || 'cubic-bezier(0.16, 1, 0.3, 1)').trim();
    var jobs = [];
    for (var i = 0; i < cols.length; i++) {
      var strip = cols[i].querySelector('.t-reel-strip');
      var fe = cols[i].querySelector('.t-reel-fe');
      if (!strip) continue;
      var spins = parseInt(strip.getAttribute('data-spins') || '0', 10) || 0;
      var digit = parseInt(strip.getAttribute('data-digit') || '0', 10) || 0;
      var delay = i * staggerMs;
      var target = spins * 10 + digit;
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      if (fe) fe.setAttribute('stdDeviation', '0 ' + blurMax);
      jobs.push({ strip: strip, fe: fe, target: target, delay: delay });
    }
    void pctEl.offsetWidth;
    var t0 = performance.now();
    for (var j = 0; j < jobs.length; j++) {
      var job = jobs[j];
      job.strip.style.transition =
        'transform ' + durMs + 'ms ' + ease + ' ' + job.delay + 'ms';
      job.strip.style.transform = 'translateY(-' + job.target + 'em)';
    }
    function tick(now) {
      var any = false;
      for (var k = 0; k < jobs.length; k++) {
        var jb = jobs[k];
        if (!jb.fe) continue;
        var start = t0 + jb.delay;
        var end = start + durMs;
        if (now < start) {
          jb.fe.setAttribute('stdDeviation', '0 ' + blurMax);
          any = true;
          continue;
        }
        if (now >= end) {
          jb.fe.setAttribute('stdDeviation', '0 0');
          continue;
        }
        var t = (now - start) / durMs;
        var blur = blurMax * (1 - t) * (1 - t);
        jb.fe.setAttribute('stdDeviation', '0 ' + blur.toFixed(2));
        any = true;
      }
      if (any) reelBlurRaf = requestAnimationFrame(tick);
      else reelBlurRaf = 0;
    }
    reelBlurRaf = requestAnimationFrame(tick);
  }

  function setGaugeRing(pct) {
    var ring = document.getElementById('colPctRing');
    if (!ring) return;
    var p = Math.max(0, Math.min(100, Number(pct) || 0));
    var apply = function () {
      ring.style.strokeDashoffset = String(100 - p);
    };
    if (ring.style.strokeDashoffset === '' || ring.style.strokeDashoffset === '100') {
      ring.style.strokeDashoffset = '100';
      requestAnimationFrame(apply);
    } else {
      apply();
    }
  }

  function syncGaugeTypeIcon() {
    var ic = document.getElementById('colGaugeTypeIc');
    var gauge = document.getElementById('colGauge');
    var isSupp = state.type === 'supporters';
    if (gauge) gauge.setAttribute('data-type', isSupp ? 'supporters' : 'units');
    var fillUrl = imgUrl(isSupp ? TYPE_ICON_SUPP_FILL : TYPE_ICON_UNIT_FILL);
    if (ic && ic.getAttribute('src') !== fillUrl) ic.setAttribute('src', fillUrl);
  }

  function statLeadHtml(kind, roleId) {
    if (kind === 'owned') {
      return (
        '<img class="collections-stat-k-ic collections-stat-k-ic--lg" src="' +
        esc(imgUrl(STAT_ICON_OWNED)) +
        '" alt="" width="18" height="18" loading="lazy" decoding="async">'
      );
    }
    if (kind === 'max_lb') {
      var star =
        '<img src="' +
        esc(imgUrl(STAT_ICON_LB_MAX)) +
        '" alt="" width="14" height="14" loading="lazy" decoding="async">';
      return '<span class="collections-stat-stars" aria-hidden="true">' + star + star + star + '</span>';
    }
    if (kind === 'lb_progress') {
      var lbStar =
        '<img src="' +
        esc(imgUrl(LB_ICONS.Neutral)) +
        '" alt="" width="14" height="14" loading="lazy" decoding="async">';
      return '<span class="collections-stat-stars" aria-hidden="true">' + lbStar + lbStar + lbStar + '</span>';
    }
    if (kind === 'limited') {
      return (
        '<span class="collections-stat-lim-banner" aria-hidden="true"><span>' +
        esc(limitedWord()) +
        '</span></span>'
      );
    }
    if (kind === 'role') {
      var path = ROLE_ICON[String(roleId)] || '';
      if (!path) return '';
      return (
        '<img class="collections-stat-k-ic" src="' +
        esc(imgUrl(path)) +
        '" alt="" width="16" height="16" loading="lazy" decoding="async">'
      );
    }
    if (kind === 'skill') {
      var skillPath =
        roleId === 'hp'
          ? SKILL_ICON_HP
          : roleId === 'en'
            ? SKILL_ICON_EN
            : roleId === 'hybrid'
              ? SKILL_ICON_HYBRID
              : '';
      if (!skillPath) return '';
      return (
        '<img class="collections-stat-k-ic" src="' +
        esc(imgUrl(skillPath)) +
        '" alt="" width="16" height="16" loading="lazy" decoding="async">'
      );
    }
    return '';
  }

  function waveLoaderHtml() {
    var bars = '';
    for (var i = 0; i < 12; i++) {
      bars += '<i class="collections-wave-bar" style="--i:' + i + '"></i>';
    }
    return (
      '<div class="collections-wave-loader" role="status" aria-live="polite">' +
      '<div class="collections-wave-track" aria-hidden="true">' +
      bars +
      '<span class="collections-wave-ball"></span>' +
      '</div>' +
      '<span class="collections-wave-caption">' +
      esc(t('loading')) +
      '</span>' +
      '</div>'
    );
  }

  function statBarPct(num, den) {
    if (!den || den <= 0) return 0;
    return Math.max(0, Math.min(100, (100 * num) / den));
  }

  function renderStats() {
    var rows = activeList();
    var st = computeStats(rows);
    var pctEl = document.getElementById('colPct');
    var label = document.getElementById('colPctLabel');
    var badge = document.getElementById('colCompleteBadge');
    var hud = document.getElementById('colHud');
    var gauge = document.getElementById('colGauge');
    var complete = st.total > 0 && st.owned >= st.total;
    var perfect = complete && st.maxed >= st.total;

    syncGaugeTypeIcon();

    if (pctEl) {
      var key = pctDisplayKey(st.pct);
      var changed = key !== lastPctKey;
      if (changed || !pctEl.querySelector('.t-reel')) {
        pctEl.innerHTML = buildPctReelHtml(key, changed || lastPctKey === '');
        lastPctKey = key;
        requestAnimationFrame(function () {
          runPctReelSpin(pctEl);
        });
      }
    }
    setGaugeRing(st.pct);
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
      {
        k: t('owned'),
        v: st.owned + '<em> / ' + st.total + '</em>',
        cls: 'collections-stat--accent',
        pct: statBarPct(st.owned, st.total),
        lead: 'owned'
      },
      {
        k: t('max_lb'),
        v: st.maxed + '<em> / ' + st.total + '</em>',
        cls: 'collections-stat--gold collections-stat--split',
        pct: statBarPct(st.maxed, st.total),
        lead: 'max_lb',
        splitRight: {
          k: t('lb_progress'),
          v: st.lbTotal + '<em> / ' + st.lbMax + '</em>',
          pct: statBarPct(st.lbTotal, st.lbMax),
          lead: 'lb_progress'
        }
      },
      {
        k: t('owned'),
        v: st.limOwned + '<em> / ' + st.limTotal + '</em>',
        cls: 'collections-stat--orange',
        pct: statBarPct(st.limOwned, st.limTotal),
        lead: 'limited'
      }
    ];
    if (state.type !== 'supporters') {
      ['1', '3', '2'].forEach(function (rid) {
        var b = st.byRole[rid];
        cells.push({
          k: t('role_owned', { role: roleLabel(rid) }),
          v: b.o + '<em> / ' + b.t + '</em>',
          cls: '',
          pct: statBarPct(b.o, b.t),
          lead: 'role',
          roleId: rid
        });
      });
    } else {
      [
        { id: 'hp', key: 'skill_hp' },
        { id: 'en', key: 'skill_en' },
        { id: 'hybrid', key: 'skill_hybrid' }
      ].forEach(function (sk) {
        var b = st.bySkill[sk.id] || { t: 0, o: 0 };
        cells.push({
          k: t(sk.key),
          v: b.o + '<em> / ' + b.t + '</em>',
          cls: '',
          pct: statBarPct(b.o, b.t),
          lead: 'skill',
          roleId: sk.id
        });
      });
    }
    strip.innerHTML = cells
      .map(function (c) {
        if (c.splitRight) {
          return (
            '<div class="collections-stat ' +
            c.cls +
            '"><div class="collections-stat-split">' +
            '<div class="collections-stat-half"><div class="collections-stat-k">' +
            statLeadHtml(c.lead, c.roleId) +
            '<span class="collections-stat-k-txt">' +
            esc(c.k) +
            '</span></div><div class="collections-stat-v">' +
            c.v +
            '</div><div class="collections-stat-bar" aria-hidden="true"><i style="width:0%" data-pct="' +
            (c.pct != null ? c.pct : 0) +
            '"></i></div></div>' +
            '<div class="collections-stat-half"><div class="collections-stat-k">' +
            statLeadHtml(c.splitRight.lead, c.splitRight.roleId) +
            '<span class="collections-stat-k-txt">' +
            esc(c.splitRight.k) +
            '</span></div><div class="collections-stat-v">' +
            c.splitRight.v +
            '</div><div class="collections-stat-bar" aria-hidden="true"><i style="width:0%" data-pct="' +
            (c.splitRight.pct != null ? c.splitRight.pct : 0) +
            '"></i></div></div>' +
            '</div></div>'
          );
        }
        return (
          '<div class="collections-stat ' +
          c.cls +
          '"><div class="collections-stat-k">' +
          statLeadHtml(c.lead, c.roleId) +
          '<span class="collections-stat-k-txt">' +
          esc(c.k) +
          '</span></div><div class="collections-stat-v">' +
          c.v +
          '</div><div class="collections-stat-bar" aria-hidden="true"><i style="width:0%" data-pct="' +
          (c.pct != null ? c.pct : 0) +
          '"></i></div></div>'
        );
      })
      .join('');
    requestAnimationFrame(function () {
      var fills = strip.querySelectorAll('.collections-stat-bar>i');
      for (var i = 0; i < fills.length; i++) {
        var el = fills[i];
        var pctAttr = el.getAttribute('data-pct');
        el.style.width = (pctAttr != null ? pctAttr : 0) + '%';
      }
    });
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
    var grid = document.getElementById('colGrid');
    if (status) status.textContent = t('loading');
    if (grid) {
      grid.setAttribute('aria-busy', 'true');
      grid.innerHTML = waveLoaderHtml();
    }
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
        flashSuccessCheck();
      }
      preloadChromeAssets();
    } catch (err) {
      if (status) status.textContent = t('load_fail', { err: err.message || err });
      state.catalog = { units: [], supporters: [] };
    }
    state.busy = false;
    refresh();
    loadCensusStats();
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
        loadCensusStats();
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

    var copyCodeBtn = document.getElementById('colCopyShareCode');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', function () {
        copyShareCode(copyCodeBtn);
      });
    }
    var importCodeBtn = document.getElementById('colImportShareCode');
    if (importCodeBtn) {
      importCodeBtn.addEventListener('click', function () {
        importShareCode();
      });
    }
    var codeInputEl = document.getElementById('colShareCode');
    if (codeInputEl) {
      codeInputEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          importShareCode();
        }
      });
    }

    var shareBtn = document.getElementById('colShareX');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        shareOnX(shareBtn);
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
    wireCensusUi();
    wireSaveSlots();
    renderSaveSlots();
  }

  function siteUrl() {
    try {
      return window.location.origin + '/collections';
    } catch (_) {
      return 'https://ggendb.up.railway.app/collections';
    }
  }

  var _imgCache = Object.create(null);

  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    var key = String(src);
    if (Object.prototype.hasOwnProperty.call(_imgCache, key)) {
      return _imgCache[key];
    }
    _imgCache[key] = new Promise(function (resolve) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = key;
    });
    return _imgCache[key];
  }

  function prefetchShareAssets() {
    var paths = SHARE_SCENE_BGS.concat([
      '/static/images/UI/IMG_Common_Logo_ETERNALBASE.webp',
      TYPE_ICON_UNIT_FILL,
      TYPE_ICON_SUPP_FILL,
      STAT_ICON_OWNED,
      STAT_ICON_LB_MAX,
      ROLE_ICON['1'],
      ROLE_ICON['3'],
      ROLE_ICON['2'],
      SKILL_ICON_HP,
      SKILL_ICON_EN,
      SKILL_ICON_HYBRID,
      LB_ICONS.None,
      LB_ICONS.Neutral,
      LB_ICONS.Max,
      RARITY_BASE_MAP.UR,
      RARITY_FRAME_MAP.UR,
      TB_SUPPORTER_TB_BASE,
      SUPPORTER_TB_FRAME_MAP.UR.lr,
      SUPPORTER_TB_FRAME_MAP.UR.tb,
      '/static/images/UI/UI_Common_MenuIcon_Language.webp'
    ]);
    for (var i = 0; i < paths.length; i++) {
      try {
        loadImage(imgUrl(paths[i]));
      } catch (_) {}
    }
    /* Warm list thumbs for export — same assets as live grid (already CDN-cached). */
    try {
      var rows = activeList();
      var lim = Math.min(rows.length, 64);
      for (var ti = 0; ti < lim; ti++) {
        var u = rows[ti] && (rows[ti].thum || rows[ti].art);
        if (u) loadImage(imgUrl(u));
      }
    } catch (_) {}
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

  function isCjkUiLang() {
    var L = String(state.lang || '').toUpperCase();
    return L === 'JA' || L === 'JP' || L === 'TW' || L === 'HK';
  }

  var GGEN_TEKO_FAM = 'GgenTeko';

  /** Canvas text: self-hosted GgenTeko (1.5 display) for Latin; site CJK for JA/TW/HK. */
  function uiCanvasFont(sizePx, weight) {
    var px = Number(sizePx) || 14;
    if (isCjkUiLang()) {
      px = Math.round(px * 1.12);
      var w = weight || 'bold';
      var fam =
        '"Noto Sans JP","ShinGoPr6DeBold","UDShinGoStdTCMed","Microsoft JhengHei","Yu Gothic UI","Yu Gothic","PingFang TC",sans-serif';
      return w + ' ' + px + 'px ' + fam;
    }
    var tw = weight;
    if (!tw || tw === 'bold' || tw === '700') tw = '600';
    if (tw === 'normal' || tw === '400') tw = '500';
    return tw + ' ' + px + 'px "' + GGEN_TEKO_FAM + '", Teko, sans-serif';
  }

  /**
   * Load Teko via FontFace under a unique family name so canvas never silently
   * falls back when Google Fonts CSS is print/disabled or unfinished.
   */
  async function ensureTekoForCanvas() {
    if (window.__ggenTekoCanvasOk) return true;
    if (typeof FontFace === 'undefined' || !document.fonts) return false;
    try {
      var faces = [
        new FontFace(GGEN_TEKO_FAM, "url('/static/font/Teko-SemiBold.ttf') format('truetype')", {
          style: 'normal',
          weight: '500'
        }),
        new FontFace(GGEN_TEKO_FAM, "url('/static/font/Teko-SemiBold.ttf') format('truetype')", {
          style: 'normal',
          weight: '600'
        }),
        new FontFace(GGEN_TEKO_FAM, "url('/static/font/Teko-Bold.ttf') format('truetype')", {
          style: 'normal',
          weight: '700'
        })
      ];
      var loaded = await Promise.all(
        faces.map(function (f) {
          return f.load();
        })
      );
      loaded.forEach(function (f) {
        document.fonts.add(f);
      });
      await Promise.all([
        document.fonts.load('600 13px "' + GGEN_TEKO_FAM + '"'),
        document.fonts.load('600 16px "' + GGEN_TEKO_FAM + '"'),
        document.fonts.load('600 26px "' + GGEN_TEKO_FAM + '"'),
        document.fonts.load('600 32px "' + GGEN_TEKO_FAM + '"'),
        document.fonts.load('700 32px "' + GGEN_TEKO_FAM + '"')
      ]);
      /* Width probe — Teko is much narrower than system sans for the same string */
      var probe = document.createElement('canvas').getContext('2d');
      probe.font = '600 32px "' + GGEN_TEKO_FAM + '", monospace';
      var wTeko = probe.measureText('COLLECTIONS').width;
      probe.font = '600 32px Arial, sans-serif';
      var wArial = probe.measureText('COLLECTIONS').width;
      window.__ggenTekoCanvasOk = wTeko > 0 && Math.abs(wTeko - wArial) > 8;
      return !!window.__ggenTekoCanvasOk;
    } catch (_) {
      window.__ggenTekoCanvasOk = false;
      return false;
    }
  }

  function art15ChamferPath(c, x, y, w, h) {
    var cut = Math.min(w, h) * 0.1;
    c.beginPath();
    c.moveTo(x + cut, y);
    c.lineTo(x + w, y);
    c.lineTo(x + w, y + h - cut);
    c.lineTo(x + w - cut, y + h);
    c.lineTo(x, y + h);
    c.lineTo(x, y + cut);
    c.closePath();
  }

  /** Procedural 1.5 anniversary cell backdrop (subtle hex + cyan wash). */
  function buildArt15CellBg(w, h) {
    var tile = document.createElement('canvas');
    tile.width = Math.max(1, Math.ceil(w));
    tile.height = Math.max(1, Math.ceil(h));
    var g = tile.getContext('2d');
    g.fillStyle = '#060910';
    g.fillRect(0, 0, w, h);

    var glow = g.createRadialGradient(
      w * 0.35,
      h * 0.4,
      2,
      w * 0.4,
      h * 0.48,
      Math.max(w, h) * 0.7
    );
    glow.addColorStop(0, 'rgba(0,217,255,0.1)');
    glow.addColorStop(0.5, 'rgba(0,140,255,0.035)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);

    var r = Math.min(w, h) * 0.13;
    var dx = r * Math.sqrt(3);
    var dy = r * 1.5;
    g.lineWidth = Math.max(0.6, r * 0.045);
    var row = 0;
    for (var cy = -r; cy < h + r; cy += dy, row++) {
      var ox = (row % 2) * (dx * 0.5);
      for (var cx = -r + ox; cx < w + r; cx += dx) {
        var dist = Math.hypot(cx - w * 0.35, cy - h * 0.45) / Math.max(w, h);
        var a = Math.max(0.04, 0.16 - dist * 0.22);
        g.strokeStyle = 'rgba(0,217,255,' + a.toFixed(3) + ')';
        g.beginPath();
        for (var i = 0; i < 6; i++) {
          var ang = (Math.PI / 3) * i - Math.PI / 6;
          var px = cx + r * Math.cos(ang);
          var py = cy + r * Math.sin(ang);
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.stroke();
      }
    }

    /* Tiny flecks — keep quiet so art stays primary */
    g.fillStyle = 'rgba(122,240,255,0.35)';
    var sparks = [
      [0.16, 0.2, 0.7],
      [0.78, 0.16, 0.55],
      [0.88, 0.58, 0.6]
    ];
    for (var s = 0; s < sparks.length; s++) {
      g.beginPath();
      g.arc(sparks[s][0] * w, sparks[s][1] * h, sparks[s][2], 0, Math.PI * 2);
      g.fill();
    }

    return tile;
  }

  /** Match HUD gauge: ring + type icon with drop-shadow, icon slightly over ring. */
  function drawPossessionEmblem(ctx, cx, cy, size, pct, complete, perfect, iconImg) {
    var outer = size / 2;
    var trackR = outer * 0.82;
    var stroke = Math.max(5, size * 0.055);
    var p = Math.max(0, Math.min(100, Number(pct) || 0)) / 100;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, trackR * 0.72, 0, Math.PI * 2);
    var soft = ctx.createRadialGradient(cx, cy, 4, cx, cy, trackR);
    soft.addColorStop(0, complete ? 'rgba(255,215,0,0.16)' : 'rgba(0,212,255,0.14)');
    soft.addColorStop(0.55, complete ? 'rgba(255,215,0,0.04)' : 'rgba(0,212,255,0.04)');
    soft.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = soft;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, trackR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = stroke;
    ctx.stroke();

    if (p > 0) {
      var start = -Math.PI / 2;
      var end = start + Math.PI * 2 * p;
      var grad = ctx.createLinearGradient(cx - outer, cy - outer, cx + outer, cy + outer);
      if (perfect || complete) {
        grad.addColorStop(0, '#fff4c2');
        grad.addColorStop(0.45, '#ffd700');
        grad.addColorStop(1, '#00d4ff');
      } else {
        grad.addColorStop(0, '#7af0ff');
        grad.addColorStop(0.55, '#00d4ff');
        grad.addColorStop(1, '#4a90d9');
      }
      ctx.beginPath();
      ctx.arc(cx, cy, trackR, start, end);
      ctx.strokeStyle = grad;
      ctx.lineWidth = perfect ? stroke + 1 : stroke;
      ctx.lineCap = 'round';
      ctx.shadowColor = complete ? 'rgba(255,215,0,0.35)' : 'rgba(0,212,255,0.35)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (iconImg) {
      var innerClear = (trackR - stroke * 0.5) * 2;
      var iconBox = innerClear * 1.02;
      var iw = iconImg.naturalWidth || iconImg.width || iconBox;
      var ih = iconImg.naturalHeight || iconImg.height || iconBox;
      if (!iw || !ih) {
        iw = iconBox;
        ih = iconBox;
      }
      /* object-fit: contain — never squash non-square motif art */
      var fit = Math.min(iconBox / iw, iconBox / ih);
      var dw = iw * fit;
      var dh = ih * fit;
      var ix = cx - dw / 2;
      var iy = cy - dh / 2;
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 5;
      ctx.drawImage(iconImg, ix, iy, dw, dh);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.restore();
  }

  /** Share-image possession head — mirrors live `.collections-gauge-head` (tight to content). */
  function pctShareFont(sizePx, weight) {
    var w = weight || '800';
    var px = Number(sizePx) || 42;
    return w + ' ' + px + 'px "RobotoMediumNumbers","Roboto",system-ui,sans-serif';
  }

  function measureSharePossessionHead(ctx, pctStr, complete, perfect) {
    var padX = 12;
    var padY = 10;
    var gap = 4;
    var numSize = 42;
    var pctSize = Math.round(numSize * 0.48);
    var labelSize = 12;
    var h = padY;
    ctx.font = pctShareFont(numSize, '800');
    var numW = ctx.measureText(pctStr).width;
    ctx.font = pctShareFont(pctSize, '800');
    var pctW = ctx.measureText('%').width;
    var row1W = numW + 2 + pctW;
    h += numSize + gap;
    ctx.font = uiCanvasFont(labelSize, 'bold');
    var label = (t('possession') + ' · ' + typeTitle()).toUpperCase();
    var labelW = ctx.measureText(label).width;
    h += labelSize + 6;
    var badgeW = 0;
    if (complete) {
      ctx.font = uiCanvasFont(10, 'bold');
      var badge = perfect ? t('complete_max') : t('complete');
      badgeW = Math.max(perfect ? 118 : 72, ctx.measureText(badge).width + 20);
      h += 18 + 4;
      if (perfect) {
        var subBadge = t('complete') + ' · ' + t('report_max_lb');
        badgeW = Math.max(badgeW, Math.max(140, ctx.measureText(subBadge).width + 16));
        h += 16 + 2;
      }
    }
    return {
      w: Math.max(row1W, labelW, badgeW) + padX * 2,
      h: h + padY - 2
    };
  }

  /**
   * Draw compact Possession % block like the live HUD head.
   * Returns { w, h } of the painted content box.
   */
  function drawSharePossessionHead(ctx, x, y, pctStr, complete, perfect) {
    var padX = 12;
    var padY = 10;
    var gap = 4;
    var numSize = 42;
    var pctSize = Math.round(numSize * 0.48);
    var labelSize = 12;
    var box = measureSharePossessionHead(ctx, pctStr, complete, perfect);
    var contentW = box.w;
    var contentH = box.h;

    var border =
      perfect
        ? 'rgba(255,215,0,0.45)'
        : complete
          ? 'rgba(255,215,0,0.28)'
          : 'rgba(42,54,84,0.95)';

    drawRoundRect(ctx, x, y, contentW, contentH, 10);
    ctx.fillStyle = '#1a2236';
    ctx.fill();
    var soft = ctx.createRadialGradient(
      x + contentW * 0.35,
      y + contentH,
      4,
      x + contentW * 0.35,
      y + contentH,
      contentH * 1.2
    );
    soft.addColorStop(0, complete ? 'rgba(255,215,0,0.08)' : 'rgba(0,212,255,0.07)');
    soft.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = soft;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();

    /* Corner brackets — live .collections-gauge::before/::after */
    ctx.strokeStyle = complete ? 'rgba(255,215,0,0.55)' : 'rgba(0,212,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 16);
    ctx.lineTo(x + 6, y + 6);
    ctx.lineTo(x + 16, y + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + contentW - 16, y + 6);
    ctx.lineTo(x + contentW - 6, y + 6);
    ctx.lineTo(x + contentW - 6, y + 16);
    ctx.stroke();

    var cursorY = y + padY;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    var numColor = perfect ? '#ffe566' : complete ? '#ffd700' : '#f0f2f7';
    var pctColor = perfect ? '#ffd700' : complete ? '#7af0ff' : '#00d4ff';
    ctx.fillStyle = numColor;
    ctx.font = pctShareFont(numSize, '800');
    ctx.fillText(pctStr, x + padX, cursorY);
    var numW = ctx.measureText(pctStr).width;
    ctx.fillStyle = pctColor;
    ctx.font = pctShareFont(pctSize, '800');
    ctx.fillText('%', x + padX + numW + 2, cursorY + Math.round(numSize * 0.42));
    cursorY += numSize + gap;

    ctx.fillStyle = '#8494ae';
    ctx.font = uiCanvasFont(labelSize, 'bold');
    var label = (t('possession') + ' · ' + typeTitle()).toUpperCase();
    ctx.fillText(label, x + padX, cursorY);
    cursorY += labelSize + 6;

    if (complete) {
      var badge = perfect ? t('complete_max') : t('complete');
      ctx.font = uiCanvasFont(10, 'bold');
      var badgeW = Math.max(perfect ? 118 : 72, ctx.measureText(badge).width + 20);
      var badgeH = 18;
      var bx = x + padX;
      var by = cursorY;
      var badgeGrad = ctx.createLinearGradient(bx, by, bx + badgeW, by);
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
      drawRoundRect(ctx, bx, by, badgeW, badgeH, 999);
      ctx.fillStyle = badgeGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,0,0.65)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#1a1400';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badge, bx + badgeW / 2, by + badgeH / 2 + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      cursorY += badgeH + 4;

      if (perfect) {
        var subBadge = t('complete') + ' · ' + t('report_max_lb');
        ctx.font = uiCanvasFont(10, 'bold');
        var sbw = Math.max(140, ctx.measureText(subBadge).width + 16);
        var sbh = 16;
        drawRoundRect(ctx, bx, cursorY, sbw, sbh, 8);
        ctx.fillStyle = 'rgba(15,23,42,0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,215,0,0.55)';
        ctx.stroke();
        ctx.fillStyle = '#ffd700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(subBadge, bx + sbw / 2, cursorY + sbh / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      }
    }

    return box;
  }

  /** Match HUD `.collections-stat` cards on the share/save canvas. */
  function drawShareStatBar(ctx, x, barY, barW, barH, pct, tone) {
    drawRoundRect(ctx, x, barY, barW, barH, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();
    var fillW = Math.max(0, Math.min(barW, (barW * (Number(pct) || 0)) / 100));
    if (fillW <= 0.5) return;
    var barGrad = ctx.createLinearGradient(x, barY, x + barW, barY);
    if (tone === 'accent') {
      barGrad.addColorStop(0, 'rgba(0,180,220,0.55)');
      barGrad.addColorStop(0.6, '#00d4ff');
      barGrad.addColorStop(1, '#7af0ff');
    } else if (tone === 'gold') {
      barGrad.addColorStop(0, 'rgba(184,149,74,0.7)');
      barGrad.addColorStop(0.55, '#ffd700');
      barGrad.addColorStop(1, '#ffe08a');
    } else if (tone === 'orange') {
      barGrad.addColorStop(0, 'rgba(255,120,40,0.55)');
      barGrad.addColorStop(0.6, '#ff9500');
      barGrad.addColorStop(1, '#ffc078');
    } else {
      barGrad.addColorStop(0, 'rgba(176,190,210,0.55)');
      barGrad.addColorStop(1, 'rgba(240,242,247,0.92)');
    }
    drawRoundRect(ctx, x, barY, fillW, barH, 4);
    ctx.fillStyle = barGrad;
    ctx.fill();
  }

  function drawShareStatHalf(ctx, x, y, w, h, half, imgs, numColor, tone) {
    var padX = 8;
    var leadX = x + padX;
    var leadY = y + 12;
    var labelX = leadX;
    var si;
    if (half.lead === 'max_lb' && imgs.maxLb) {
      for (si = 0; si < 3; si++) {
        ctx.drawImage(imgs.maxLb, leadX + si * 13, leadY, 13, 13);
      }
      labelX = leadX + 3 * 13 + 4;
    } else if (half.lead === 'lb_progress' && (imgs.lbNeutral || imgs.maxLb)) {
      var neu = imgs.lbNeutral || imgs.maxLb;
      for (si = 0; si < 3; si++) {
        ctx.drawImage(neu, leadX + si * 13, leadY, 13, 13);
      }
      labelX = leadX + 3 * 13 + 4;
    }
    ctx.fillStyle = '#8494ae';
    ctx.font = uiCanvasFont(12, '600');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    var labelMax = w - (labelX - x) - padX;
    var label = String(half.label || '');
    if (!isCjkUiLang()) label = label.toUpperCase();
    while (label.length > 1 && ctx.measureText(label).width > labelMax) {
      label = label.slice(0, -1);
    }
    if (label !== String(half.label || '').toUpperCase() && label.length > 1 && !isCjkUiLang()) {
      label = label.slice(0, -1) + '…';
    }
    ctx.fillText(label, labelX, leadY + 1);

    var nStr = String(half.n);
    var dStr = ' / ' + half.d;
    ctx.font = uiCanvasFont(22, '600');
    ctx.fillStyle = numColor;
    ctx.fillText(nStr, x + padX, y + 38);
    var nW = ctx.measureText(nStr).width;
    ctx.font = uiCanvasFont(14, '600');
    ctx.fillStyle = '#8494ae';
    ctx.fillText(dStr, x + padX + nW, y + 43);

    drawShareStatBar(ctx, x + padX, y + h - 18, w - padX * 2, 8, half.pct, tone);
  }

  function drawShareStatCard(ctx, x, y, w, h, card, imgs, complete, perfect) {
    var padX = 10;
    var tone = card.tone || 'neutral';
    var numColor =
      tone === 'accent'
        ? '#00d4ff'
        : tone === 'gold'
          ? '#ffd700'
          : tone === 'orange'
            ? '#ff9500'
            : '#f0f2f7';
    var border =
      perfect
        ? 'rgba(255,215,0,0.5)'
        : complete
          ? 'rgba(255,215,0,0.28)'
          : 'rgba(30,41,59,0.95)';

    drawRoundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = '#141c2b';
    ctx.fill();
    /* 1.5 cyan edge on stat cards */
    ctx.strokeStyle = perfect
      ? 'rgba(255,215,0,0.5)'
      : complete
        ? 'rgba(255,215,0,0.28)'
        : 'rgba(0,217,255,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    art15ChamferPath(ctx, x + 1, y + 1, w - 2, h - 2);
    ctx.strokeStyle = perfect ? 'rgba(255,215,0,0.25)' : 'rgba(0,217,255,0.2)';
    ctx.stroke();

    if (card.splitRight) {
      var halfW = w / 2;
      drawShareStatHalf(
        ctx,
        x,
        y,
        halfW,
        h,
        {
          label: card.label,
          n: card.n,
          d: card.d,
          pct: card.pct,
          lead: card.lead
        },
        imgs,
        numColor,
        tone
      );
      ctx.beginPath();
      ctx.moveTo(x + halfW, y + 10);
      ctx.lineTo(x + halfW, y + h - 10);
      ctx.strokeStyle = 'rgba(132,148,174,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawShareStatHalf(ctx, x + halfW, y, halfW, h, card.splitRight, imgs, numColor, tone);
      return;
    }

    var leadX = x + padX;
    var leadY = y + 12;
    var labelX = leadX;
    if (card.lead === 'owned' && imgs.owned) {
      ctx.drawImage(imgs.owned, leadX, leadY - 1, 18, 18);
      labelX = leadX + 22;
    } else if (card.lead === 'max_lb' && imgs.maxLb) {
      var si;
      for (si = 0; si < 3; si++) {
        ctx.drawImage(imgs.maxLb, leadX + si * 15, leadY, 15, 15);
      }
      labelX = leadX + 3 * 15 + 5;
    } else if (card.lead === 'limited') {
      var lim = limitedWord();
      ctx.font = uiCanvasFont(11, 'bold');
      var limW = Math.min(96, Math.max(52, ctx.measureText(lim).width + 14));
      var limH = 17;
      var limGrad = ctx.createLinearGradient(leadX, leadY, leadX + limW, leadY);
      limGrad.addColorStop(0, '#be185d');
      limGrad.addColorStop(0.55, '#a855f7');
      limGrad.addColorStop(1, '#1d4ed8');
      drawRoundRect(ctx, leadX, leadY - 1, limW, limH, 3);
      ctx.fillStyle = limGrad;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lim, leadX + limW / 2, leadY - 1 + limH / 2 + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      labelX = leadX + limW + 6;
    } else if (card.lead === 'role') {
      var roleImg =
        card.roleId === '1'
          ? imgs.role1
          : card.roleId === '3'
            ? imgs.role3
            : imgs.role2;
      if (roleImg) {
        ctx.drawImage(roleImg, leadX, leadY - 1, 17, 17);
        labelX = leadX + 22;
      }
    } else if (card.lead === 'skill') {
      var skillImg =
        card.roleId === 'hp'
          ? imgs.skillHp
          : card.roleId === 'en'
            ? imgs.skillEn
            : imgs.skillHybrid;
      if (skillImg) {
        ctx.drawImage(skillImg, leadX, leadY - 1, 17, 17);
        labelX = leadX + 22;
      }
    }

    ctx.fillStyle = '#8494ae';
    ctx.font = uiCanvasFont(13, '600');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    var labelMax = w - (labelX - x) - padX;
    var label = String(card.label || '');
    if (!isCjkUiLang()) label = label.toUpperCase();
    while (label.length > 1 && ctx.measureText(label).width > labelMax) {
      label = label.slice(0, -1);
    }
    if (label.length > 1 && ctx.measureText(label).width > labelMax) {
      label = label.slice(0, -1) + '…';
    }
    ctx.fillText(label, labelX, leadY + 1);

    var nStr = String(card.n);
    var dStr = ' / ' + card.d;
    ctx.font = uiCanvasFont(24, '600');
    ctx.fillStyle = numColor;
    ctx.fillText(nStr, x + padX, y + 38);
    var nW = ctx.measureText(nStr).width;
    ctx.font = uiCanvasFont(16, '600');
    ctx.fillStyle = '#8494ae';
    ctx.fillText(dStr, x + padX + nW, y + 44);

    drawShareStatBar(ctx, x + padX, y + h - 18, w - padX * 2, 8, card.pct, tone);
  }

  async function generateShareImage() {
    var rows = activeList();
    var st = computeStats(rows);
    var complete = st.total > 0 && st.owned >= st.total;
    var perfect = complete && st.maxed >= st.total;
    var cols = Math.min(6, Math.max(4, Math.ceil(Math.sqrt((rows.length || 1) * 0.7))));
    /* 1.5 page landscape cells — chamfer + cover art (no UR base/frame) */
    var cellW = 148;
    var cellH = Math.round((cellW * 504) / 900);
    var gapX = 12;
    var gapY = 30;
    var pad = 44;
    var playerName = currentUsername();
    var titleBottom = pad + (playerName ? 110 : 96);
    var gridW = cols * cellW + (cols - 1) * gapX;
    var W = gridW + pad * 2;
    /* Ring top-aligned with header pad (cuts empty air above). */
    var emblemSize = Math.round(Math.min(236, Math.max(196, W * 0.32)));
    var emblemTop = pad;
    var pctStr = pctDisplayKey(st.pct);

    try {
      if (!document.getElementById('ggenRobotoNumsFace')) {
        var faceStEarly = document.createElement('style');
        faceStEarly.id = 'ggenRobotoNumsFace';
        faceStEarly.textContent =
          "@font-face{font-family:'RobotoMediumNumbers';src:url('/static/font/roboto_medium_numbers.ttf') format('truetype');font-weight:normal;font-style:normal;font-display:swap}";
        document.head.appendChild(faceStEarly);
      }
      await ensureTekoForCanvas();
      if (document.fonts && document.fonts.load) {
        await document.fonts.load('800 42px RobotoMediumNumbers');
        if (isCjkUiLang()) {
          try {
            await Promise.all([
              document.fonts.load('bold 14px "ShinGoPr6DeBold"'),
              document.fonts.load('bold 16px "UDShinGoStdTCMed"'),
              document.fonts.load('bold 26px "ShinGoPr6DeBold"')
            ]);
          } catch (_) {}
        }
      }
    } catch (_) {}

    /* Compact possession head — sized to content like live .collections-gauge-head */
    var mctx = document.createElement('canvas').getContext('2d');
    var pctBox = measureSharePossessionHead(mctx, pctStr, complete, perfect);
    var pctPanelY = titleBottom + 6;
    var gaugeRowBottom = Math.max(pctPanelY + pctBox.h, emblemTop + emblemSize);
    var subY = gaugeRowBottom + 16;
    var cardColsLayout = 3;
    var cardRowsLayout = 2;
    var cardGapLayout = 10;
    var cardHLayout = 96;
    var subBlockH =
      cardRowsLayout * cardHLayout + (cardRowsLayout - 1) * cardGapLayout;
    var headerH = subY + subBlockH + 20;
    var rowsN = Math.max(1, Math.ceil((rows.length || 1) / cols));
    var gridH = rowsN * cellH + (rowsN - 1) * gapY;
    var H = headerH + gridH + pad + 48;
    /* 2× layout — crisp enough; 3× + full-art was the main save lag */
    var scale = 2;
    var canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    var ctx = canvas.getContext('2d');
    if (ctx.imageSmoothingEnabled != null) ctx.imageSmoothingEnabled = true;
    try {
      ctx.imageSmoothingQuality = 'high';
    } catch (_) {}
    ctx.scale(scale, scale);

    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, perfect ? '#221808' : complete ? '#1a1610' : '#111827');
    bg.addColorStop(0.4, '#111827');
    bg.addColorStop(1, '#0a0e17');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (complete) {
      var glowCx = W - pad - emblemSize / 2;
      var glowCy = emblemTop + emblemSize / 2;
      var glow = ctx.createRadialGradient(glowCx, glowCy, 8, glowCx, glowCy, perfect ? 300 : 240);
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

    var scenePick = pickShareSceneBg();
    var typeIconPath =
      state.type === 'supporters' ? TYPE_ICON_SUPP_FILL : TYPE_ICON_UNIT_FILL;
    var suppFr = SUPPORTER_TB_FRAME_MAP.UR;
    var isSupp = state.type === 'supporters';

    var packed = await Promise.all([
      loadImage(imgUrl(scenePick)),
      loadImage(imgUrl('/static/images/UI/IMG_Common_Logo_ETERNALBASE.webp')),
      loadImage(imgUrl(typeIconPath)),
      loadImage(imgUrl(STAT_ICON_OWNED)),
      loadImage(imgUrl(STAT_ICON_LB_MAX)),
      loadImage(imgUrl(ROLE_ICON['1'])),
      loadImage(imgUrl(ROLE_ICON['3'])),
      loadImage(imgUrl(ROLE_ICON['2'])),
      loadImage(imgUrl(SKILL_ICON_HP)),
      loadImage(imgUrl(SKILL_ICON_EN)),
      loadImage(imgUrl(SKILL_ICON_HYBRID)),
      loadImage(imgUrl(LB_ICONS.None)),
      loadImage(imgUrl(LB_ICONS.Neutral)),
      loadImage(imgUrl(LB_ICONS.Max)),
      loadImage(imgUrl(RARITY_BASE_MAP.UR)),
      loadImage(imgUrl(RARITY_FRAME_MAP.UR)),
      loadImage(imgUrl(TB_SUPPORTER_TB_BASE)),
      loadImage(imgUrl(suppFr.lr)),
      loadImage(imgUrl(suppFr.tb)),
      loadImage(imgUrl('/static/images/UI/UI_Common_MenuIcon_Language.webp')),
      Promise.all(
        rows.map(function (row) {
          return loadImage(imgUrl(row.art || row.thum || ''));
        })
      )
    ]);
    var sceneArt = packed[0];
    var logo = packed[1];
    var typeIconImg = packed[2];
    var shareStatImgs = {
      owned: packed[3],
      maxLb: packed[4],
      role1: packed[5],
      role3: packed[6],
      role2: packed[7],
      skillHp: packed[8],
      skillEn: packed[9],
      skillHybrid: packed[10],
      lbNeutral: packed[12]
    };
    var iconNone = packed[11];
    var iconNeutral = packed[12];
    var iconMax = packed[13];
    var unitBaseImg = packed[14];
    var unitFrameImg = packed[15];
    var suppBaseImg = packed[16];
    var suppLrImg = packed[17];
    var suppTbImg = packed[18];
    var langIcon = packed[19];
    var thumbs = packed[20];

    drawShareHeaderSceneArt(ctx, sceneArt, W, Math.max(120, subY - 6));

    var logoSize = 64;
    var textX = pad + (logo ? logoSize + 16 : 0);
    if (logo) {
      ctx.drawImage(logo, pad, pad, logoSize, logoSize);
    }

    ctx.textBaseline = 'top';
    ctx.fillStyle = '#f0f2f7';
    var titleStr = isCjkUiLang() ? t('report_title') : String(t('report_title') || '').toUpperCase();
    ctx.font = uiCanvasFont(32, '600');
    ctx.fillText(titleStr, textX, pad + 2);

    ctx.fillStyle = '#7af0ff';
    ctx.font = uiCanvasFont(14, '600');
    ctx.fillText(t('brand_line'), textX, pad + 38);

    if (playerName) {
      ctx.fillStyle = '#ffd700';
      ctx.font = uiCanvasFont(18, '600');
      ctx.fillText(playerName, textX, pad + 58);
      ctx.fillStyle = '#00d9ff';
      ctx.font = uiCanvasFont(16, '600');
      ctx.fillText('UR ' + typeTitle(), textX, pad + 80);
    } else {
      ctx.fillStyle = '#00d9ff';
      ctx.font = uiCanvasFont(16, '600');
      ctx.fillText('UR ' + typeTitle(), textX, pad + 58);
    }

    drawSharePossessionHead(ctx, pad, pctPanelY, pctStr, complete, perfect);

    drawPossessionEmblem(
      ctx,
      W - pad - emblemSize / 2,
      emblemTop + emblemSize / 2,
      emblemSize,
      st.pct,
      complete,
      perfect,
      typeIconImg
    );

    var shareStatCards = [
      {
        label: t('owned'),
        n: st.owned,
        d: st.total,
        pct: statBarPct(st.owned, st.total),
        tone: 'accent',
        lead: 'owned'
      },
      {
        label: t('max_lb'),
        n: st.maxed,
        d: st.total,
        pct: statBarPct(st.maxed, st.total),
        tone: 'gold',
        lead: 'max_lb',
        splitRight: {
          label: t('lb_progress'),
          n: st.lbTotal,
          d: st.lbMax,
          pct: statBarPct(st.lbTotal, st.lbMax),
          lead: 'lb_progress'
        }
      },
      {
        label: t('owned'),
        n: st.limOwned,
        d: st.limTotal,
        pct: statBarPct(st.limOwned, st.limTotal),
        tone: 'orange',
        lead: 'limited'
      }
    ];
    if (state.type !== 'supporters') {
      ['1', '3', '2'].forEach(function (rid) {
        var b = st.byRole[rid];
        shareStatCards.push({
          label: t('role_owned', { role: roleLabel(rid) }),
          n: b.o,
          d: b.t,
          pct: statBarPct(b.o, b.t),
          tone: 'neutral',
          lead: 'role',
          roleId: rid
        });
      });
    } else {
      [
        { id: 'hp', key: 'skill_hp' },
        { id: 'en', key: 'skill_en' },
        { id: 'hybrid', key: 'skill_hybrid' }
      ].forEach(function (sk) {
        var b = st.bySkill[sk.id] || { t: 0, o: 0 };
        shareStatCards.push({
          label: t(sk.key),
          n: b.o,
          d: b.t,
          pct: statBarPct(b.o, b.t),
          tone: 'neutral',
          lead: 'skill',
          roleId: sk.id
        });
      });
    }

    var cardCols = 3;
    var cardRows = Math.ceil(shareStatCards.length / cardCols);
    var cardGap = 10;
    var cardW = (gridW - cardGap * (cardCols - 1)) / cardCols;
    var cardH = 96;
    for (var sci = 0; sci < shareStatCards.length; sci++) {
      var sc = shareStatCards[sci];
      var scCol = sci % cardCols;
      var scRow = Math.floor(sci / cardCols);
      var scx = pad + scCol * (cardW + cardGap);
      var scy = subY + scRow * (cardH + cardGap);
      drawShareStatCard(ctx, scx, scy, cardW, cardH, sc, shareStatImgs, complete, perfect);
    }

    /* 1.5 page cells: hex glow bg + cover art + chamfer brackets */
    var UNOWNED_ALPHA = 0.22;
    var UNOWNED_VEIL = 'rgba(2,6,14,0.62)';
    var gridY = headerH;
    var drawBatch = 20;
    var cellBgTile = buildArt15CellBg(cellW, cellH);

    function drawCoverArt15(c, img, dx, dy, dw, dh) {
      if (!img) return;
      var iw = img.naturalWidth || img.width || 0;
      var ih = img.naturalHeight || img.height || 0;
      if (!iw || !ih) return;
      var sc = Math.max(dw / iw, dh / ih);
      var sw = dw / sc;
      var sh = dh / sc;
      var sx = (iw - sw) / 2;
      var sy = Math.max(0, (ih - sh) * 0.28);
      c.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    for (var i = 0; i < rows.length; i++) {
      if (i > 0 && i % drawBatch === 0) {
        await new Promise(function (r) {
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () {
            r();
          });
          else setTimeout(r, 0);
        });
      }
      var row = rows[i];
      var col = i % cols;
      var rowIdx = Math.floor(i / cols);
      var x = pad + col * (cellW + gapX);
      var y = gridY + rowIdx * (cellH + gapY);
      var lb = getLb(row.id);
      var im = thumbs[i];
      var owned = lb >= 0;
      var accent = !owned ? 'rgba(90,110,140,0.55)' : lb >= 3 ? '#ffd700' : '#00d9ff';

      ctx.save();
      if (!owned) {
        ctx.filter = 'grayscale(0.72) brightness(0.38)';
        ctx.globalAlpha = UNOWNED_ALPHA;
      }

      ctx.save();
      art15ChamferPath(ctx, x, y, cellW, cellH);
      ctx.clip();
      /* Quiet 1.5 plate under art — never compete with the unit */
      ctx.drawImage(cellBgTile, x, y, cellW, cellH);
      if (im) {
        drawCoverArt15(ctx, im, x, y, cellW, cellH);
        if (owned) {
          /* Owned only: whisper of hex through the portrait */
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.globalAlpha = 0.1;
          ctx.drawImage(cellBgTile, x, y, cellW, cellH);
          ctx.restore();
        } else {
          /* Unowned: heavy dark veil so owned cells pop */
          ctx.fillStyle = UNOWNED_VEIL;
          ctx.fillRect(x, y, cellW, cellH);
        }
      } else if (!owned) {
        ctx.fillStyle = UNOWNED_VEIL;
        ctx.fillRect(x, y, cellW, cellH);
      }
      ctx.restore();

      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      art15ChamferPath(ctx, x + 0.5, y + 0.5, cellW - 1, cellH - 1);
      ctx.strokeStyle = accent;
      ctx.lineWidth = lb >= 3 ? 2.5 : 1.75;
      ctx.stroke();

      var bw = cellW * 0.18;
      var bh = cellH * 0.2;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + bh);
      ctx.lineTo(x + 2, y + cellH * 0.12 + 2);
      ctx.lineTo(x + bw, y + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + cellW - bw, y + 2);
      ctx.lineTo(x + cellW - 2, y + 2);
      ctx.lineTo(x + cellW - 2, y + bh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 2, y + cellH - bh);
      ctx.lineTo(x + 2, y + cellH - 2);
      ctx.lineTo(x + bw, y + cellH - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + cellW - bw, y + cellH - 2);
      ctx.lineTo(x + cellW - 2, y + cellH - cellH * 0.12 - 2);
      ctx.lineTo(x + cellW - 2, y + cellH - bh);
      ctx.stroke();
      ctx.restore();

      if (row.is_limited_time) {
        var limLabel = limitedWord().toUpperCase();
        ctx.font = uiCanvasFont(11, '600');
        var limTw = Math.ceil(ctx.measureText(limLabel).width);
        var limPadX = 7;
        var limW = Math.min(cellW * 0.55, limTw + limPadX * 2);
        var limH = 14;
        var limX = x + 8;
        var limY = y + 6;
        var limGrad = ctx.createLinearGradient(limX, limY, limX + limW, limY);
        if (isSupp) {
          limGrad.addColorStop(0, '#0e7490');
          limGrad.addColorStop(0.45, '#155e75');
          limGrad.addColorStop(1, '#b8954a');
        } else {
          limGrad.addColorStop(0, '#be185d');
          limGrad.addColorStop(0.55, '#a855f7');
          limGrad.addColorStop(1, '#1d4ed8');
        }
        ctx.save();
        if (!owned) ctx.globalAlpha = UNOWNED_ALPHA;
        drawRoundRect(ctx, limX, limY, limW, limH, 3);
        ctx.fillStyle = limGrad;
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = uiCanvasFont(11, '600');
        ctx.fillText(limLabel, limX + limW / 2, limY + limH / 2 + 0.5);
        ctx.restore();
      }

      if (lb >= 1) {
        var slots =
          lb === 1
            ? [iconNeutral, iconNone, iconNone]
            : lb === 2
              ? [iconNeutral, iconNeutral, iconNone]
              : [iconMax, iconMax, iconMax];
        var iw = 20;
        var gapI = 3;
        var totalW = slots.length * iw + (slots.length - 1) * gapI;
        var sx0 = x + (cellW - totalW) / 2;
        var sy = y + cellH - Math.round(iw * 0.4);
        ctx.save();
        if (!owned) ctx.globalAlpha = UNOWNED_ALPHA;
        for (var si = 0; si < slots.length; si++) {
          if (slots[si]) ctx.drawImage(slots[si], sx0 + si * (iw + gapI), sy, iw, iw);
        }
        ctx.restore();
      }
    }

    var footY = gridY + gridH + 22;
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(pad, footY);
    ctx.lineTo(W - pad, footY);
    ctx.stroke();
    ctx.fillStyle = '#00d4ff';
    ctx.font = uiCanvasFont(14, 'bold');
    var foot = siteUrl().replace(/^https?:\/\//, '');
    var footIcon = 16;
    var footGap = 6;
    var footTextX = pad;
    if (langIcon) {
      ctx.drawImage(langIcon, pad, footY + 12, footIcon, footIcon);
      footTextX = pad + footIcon + footGap;
    }
    ctx.fillText(foot, footTextX, footY + 14);

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
    var objectUrl = '';
    try {
      var canvas = await generateShareImage();
      /* toBlob is async — avoids long main-thread freeze of toDataURL on tall reports */
      var blob = await canvasToPngBlob(canvas);
      objectUrl = URL.createObjectURL(blob);
      var img = document.getElementById('colPreviewImg');
      var link = document.getElementById('colDownloadLink');
      var modal = document.getElementById('colPreviewModal');
      if (img) {
        if (img.dataset && img.dataset.objectUrl) {
          try {
            URL.revokeObjectURL(img.dataset.objectUrl);
          } catch (_) {}
        }
        img.src = objectUrl;
        if (img.dataset) img.dataset.objectUrl = objectUrl;
      }
      if (link) {
        link.href = objectUrl;
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
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) {}
      }
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

  function canvasToPngBlob(canvas) {
    return new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(
          function (blob) {
            if (blob) resolve(blob);
            else reject(new Error('toBlob failed'));
          },
          'image/png'
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  function downloadBlob(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2500);
  }

  async function tryShareWithImage(text, file) {
    if (!navigator.share || typeof navigator.canShare !== 'function') return false;
    var payloads = [
      { files: [file], text: text, title: t('report_title') },
      { files: [file], text: text },
      { files: [file] }
    ];
    for (var i = 0; i < payloads.length; i++) {
      try {
        if (!navigator.canShare(payloads[i])) continue;
        await navigator.share(payloads[i]);
        return true;
      } catch (err) {
        if (err && err.name === 'AbortError') throw err;
      }
    }
    return false;
  }

  async function tryCopyImage(blob) {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch (_) {
      return false;
    }
  }


  function ownedBagsForShare() {
    function clean(bag) {
      var out = {};
      Object.keys(bag || {}).forEach(function (id) {
        var lb = bag[id] | 0;
        if (lb >= 0 && lb <= MAX_LB) out[String(id)] = lb;
      });
      return out;
    }
    return {
      v: 1,
      u: clean(state.owned.units),
      s: clean(state.owned.supporters),
      n: currentUsername() || undefined
    };
  }

  function readSaveSlots() {
    try {
      var a = JSON.parse(localStorage.getItem(SAVES_KEY) || 'null');
      if (!Array.isArray(a) || a.length < SAVE_SLOT_COUNT) throw 0;
      return a.slice(0, SAVE_SLOT_COUNT).map(function (x, i) {
        return {
          name: String((x && x.name) || '').trim() || t('default_save_name', { i: i + 1 }),
          data: x && x.data && typeof x.data === 'object' ? x.data : null,
          code: x && x.code ? String(x.code) : ''
        };
      });
    } catch (_) {
      return Array.from({ length: SAVE_SLOT_COUNT }, function (_, i) {
        return { name: t('default_save_name', { i: i + 1 }), data: null, code: '' };
      });
    }
  }

  function writeSaveSlots(arr) {
    try {
      localStorage.setItem(SAVES_KEY, JSON.stringify(arr));
    } catch (_) {}
  }

  function renderSaveSlots() {
    var host = document.getElementById('colSavesList');
    if (!host) return;
    var slots = readSaveSlots();
    host.innerHTML = slots
      .map(function (slot, i) {
        var codeNote =
          slot.data && slot.code
            ? '<span class="collections-save-code" title="' +
              esc(String(slot.code)) +
              '">' +
              esc(String(slot.code)) +
              '</span>'
            : '';
        return (
          '<div class="collections-save-row" data-slot="' +
          i +
          '">' +
          '<span class="collections-save-idx">' +
          (i + 1) +
          '.</span>' +
          '<input type="text" maxlength="80" value="' +
          esc(slot.name) +
          '" data-save-name="' +
          i +
          '" placeholder="' +
          esc(t('save_slot_ph')) +
          '" aria-label="' +
          esc(t('save_slot_ph')) +
          '">' +
          codeNote +
          '<button type="button" class="collections-btn" data-save-clear="' +
          i +
          '">' +
          esc(t('clear_slot')) +
          '</button>' +
          '<button type="button" class="collections-btn" data-save-load="' +
          i +
          '">' +
          esc(t('load_slot')) +
          '</button>' +
          '</div>'
        );
      })
      .join('');
  }

  function refreshShareSaveSlotOptions(preferredIdx) {
    var sel = document.getElementById('colShareSaveSlot');
    if (!sel) return;
    var slots = readSaveSlots();
    var pick = preferredIdx;
    if (pick == null || pick < 0 || pick >= SAVE_SLOT_COUNT) {
      pick = 0;
      for (var i = 0; i < slots.length; i++) {
        if (!slots[i].data) {
          pick = i;
          break;
        }
      }
    }
    sel.innerHTML = slots
      .map(function (slot, i) {
        var label = t('slot_label', {
          i: i + 1,
          name: slot.data ? slot.name : t('slot_empty')
        });
        return (
          '<option value="' +
          i +
          '"' +
          (i === pick ? ' selected' : '') +
          '>' +
          esc(label) +
          '</option>'
        );
      })
      .join('');
  }

  function hideShareSavePrompt() {
    state.pendingShare = null;
    var panel = document.getElementById('colShareSavePrompt');
    if (panel) panel.hidden = true;
  }

  function showShareSavePrompt(code, payload) {
    state.pendingShare = { code: code, payload: payload };
    var panel = document.getElementById('colShareSavePrompt');
    var nameInput = document.getElementById('colShareSaveName');
    if (nameInput) {
      nameInput.value =
        (payload && payload.n) || currentUsername() || nameInput.value || '';
    }
    refreshShareSaveSlotOptions();
    if (panel) {
      panel.hidden = false;
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
    }
  }

  function confirmShareSave() {
    var pending = state.pendingShare;
    if (!pending || !pending.payload) return;
    var nameInput = document.getElementById('colShareSaveName');
    var sel = document.getElementById('colShareSaveSlot');
    var name = nameInput ? String(nameInput.value || '').trim() : '';
    if (!name) {
      var statusNeed = document.getElementById('colStatus');
      if (statusNeed) statusNeed.textContent = t('share_save_need_name');
      if (nameInput) nameInput.focus();
      return;
    }
    var idx = sel ? parseInt(sel.value, 10) : 0;
    if (!(idx >= 0 && idx < SAVE_SLOT_COUNT)) idx = 0;
    var slots = readSaveSlots();
    slots[idx] = {
      name: name,
      data: {
        v: 1,
        u: pending.payload.u || {},
        s: pending.payload.s || {}
      },
      code: pending.code || ''
    };
    writeSaveSlots(slots);
    renderSaveSlots();
    var saves = document.getElementById('colSaves');
    if (saves) saves.open = true;
    hideShareSavePrompt();
    var status = document.getElementById('colStatus');
    if (status) {
      status.textContent = t('share_save_ok', {
        name: name,
        i: idx + 1,
        code: pending.code || ''
      });
    }
  }

  function persistSaveSlotName(i, name) {
    var slots = readSaveSlots();
    if (!slots[i]) return;
    slots[i].name = String(name || '').trim() || t('default_save_name', { i: i + 1 });
    writeSaveSlots(slots);
  }

  function saveCollectionSlot(i) {
    var slots = readSaveSlots();
    if (!slots[i]) return;
    var input = document.querySelector('[data-save-name="' + i + '"]');
    var name =
      (input && String(input.value || '').trim()) ||
      slots[i].name ||
      t('default_save_name', { i: i + 1 });
    var payload = ownedBagsForShare();
    slots[i] = {
      name: name,
      data: { v: 1, u: payload.u || {}, s: payload.s || {} },
      code: slots[i].code || ''
    };
    writeSaveSlots(slots);
    renderSaveSlots();
    var status = document.getElementById('colStatus');
    if (status) status.textContent = t('save_slot_ok', { name: name });
  }

  function loadCollectionSlot(i) {
    var slots = readSaveSlots();
    var slot = slots[i];
    if (!slot || !slot.data) {
      var statusEmpty = document.getElementById('colStatus');
      if (statusEmpty) statusEmpty.textContent = t('load_slot_empty');
      return;
    }
    var name = slot.name || t('default_save_name', { i: i + 1 });
    if (!window.confirm(t('load_slot_confirm', { name: name }))) return;
    var payload = { v: 1, u: slot.data.u || {}, s: slot.data.s || {} };
    var n = countOwnedInPayload(payload);
    state.owned = {
      units: Object.assign({}, payload.u || {}),
      supporters: Object.assign({}, payload.s || {})
    };
    saveOwned();
    refresh();
    if (slot.code) {
      var codeInput = document.getElementById('colShareCode');
      if (codeInput) codeInput.value = slot.code;
    }
    var status = document.getElementById('colStatus');
    if (status) status.textContent = t('load_slot_ok', { name: name, n: n });
  }

  function clearCollectionSlot(i) {
    var slots = readSaveSlots();
    if (!slots[i]) return;
    var input = document.querySelector('[data-save-name="' + i + '"]');
    var name =
      (input && String(input.value || '').trim()) ||
      slots[i].name ||
      t('default_save_name', { i: i + 1 });
    slots[i] = { name: name, data: null, code: '' };
    writeSaveSlots(slots);
    renderSaveSlots();
    refreshShareSaveSlotOptions();
    var status = document.getElementById('colStatus');
    if (status) status.textContent = t('clear_slot_ok', { i: i + 1 });
  }

  function wireSaveSlots() {
    var host = document.getElementById('colSavesList');
    if (!host || host._colSavesWired) return;
    host._colSavesWired = true;
    host.addEventListener('click', function (ev) {
      var tEl = ev.target;
      if (!tEl || !tEl.getAttribute) return;
      var wi = tEl.getAttribute('data-save-write');
      var li = tEl.getAttribute('data-save-load');
      var ci = tEl.getAttribute('data-save-clear');
      if (wi != null) saveCollectionSlot(parseInt(wi, 10));
      else if (li != null) loadCollectionSlot(parseInt(li, 10));
      else if (ci != null) clearCollectionSlot(parseInt(ci, 10));
    });
    host.addEventListener('change', function (ev) {
      var tEl = ev.target;
      if (!tEl || !tEl.getAttribute) return;
      var ni = tEl.getAttribute('data-save-name');
      if (ni != null) persistSaveSlotName(parseInt(ni, 10), tEl.value);
    });
    var confirmBtn = document.getElementById('colShareSaveConfirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        confirmShareSave();
      });
    }
    var skipBtn = document.getElementById('colShareSaveSkip');
    if (skipBtn) {
      skipBtn.addEventListener('click', function () {
        hideShareSavePrompt();
      });
    }
    var nameEl = document.getElementById('colShareSaveName');
    if (nameEl) {
      nameEl.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          confirmShareSave();
        }
      });
    }
  }

  function countOwnedInPayload(payload) {
    if (!payload) return 0;
    return Object.keys(payload.u || {}).length + Object.keys(payload.s || {}).length;
  }

  function applySharePayload(payload) {
    if (!payload || payload.v !== 1) return 0;
    var n = countOwnedInPayload(payload);
    if (!n) return 0;
    if (!window.confirm(t('share_import_confirm'))) return -1;
    state.owned = {
      units: Object.assign({}, payload.u || {}),
      supporters: Object.assign({}, payload.s || {})
    };
    saveOwned();
    if (payload.n) saveUsername(payload.n);
    refresh();
    return n;
  }

  function encodeLongShareCodeC1(payload) {
    var json = JSON.stringify({
      v: 1,
      u: payload.u || {},
      s: payload.s || {},
      n: payload.n || undefined
    });
    var b64 =
      typeof btoa === 'function'
        ? btoa(unescape(encodeURIComponent(json)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')
        : '';
    return b64 ? 'C1.' + b64 : '';
  }

  function bytesToB64url(u8) {
    var bin = '';
    var chunk = 0x8000;
    for (var i = 0; i < u8.length; i += chunk) {
      bin += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlToBytes(b64url) {
    var b64 = String(b64url || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function encodeLongShareCode(payload) {
    var json = JSON.stringify({
      v: 1,
      u: payload.u || {},
      s: payload.s || {},
      n: payload.n || undefined
    });
    try {
      if (typeof CompressionStream !== 'undefined' && typeof TextEncoder !== 'undefined') {
        var enc = new TextEncoder().encode(json);
        var stream = new Blob([enc]).stream().pipeThrough(new CompressionStream('deflate-raw'));
        var buf = await new Response(stream).arrayBuffer();
        var b64 = bytesToB64url(new Uint8Array(buf));
        if (b64) {
          var c2 = 'C2.' + b64;
          var c1 = encodeLongShareCodeC1(payload);
          // Prefer shorter of C2/C1 when both exist.
          if (!c1 || c2.length <= c1.length) return c2;
          return c1;
        }
      }
    } catch (_) {}
    return encodeLongShareCodeC1(payload);
  }

  async function decodeLongShareCode(raw) {
    var s = String(raw || '')
      .replace(/^[\s"']+|[\s"']+$/g, '')
      .replace(/\s+/g, '');
    try {
      if (s.indexOf('C2.') === 0 && typeof DecompressionStream !== 'undefined') {
        var packed = b64urlToBytes(s.slice(3));
        var stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        var text = await new Response(stream).text();
        var o2 = JSON.parse(text);
        if (!o2 || o2.v !== 1) return null;
        return { v: 1, u: o2.u || {}, s: o2.s || {}, n: o2.n };
      }
      if (s.indexOf('C1.') !== 0) return null;
      var b64 = s.slice(3).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var bin = atob(b64);
      var json;
      try {
        json = decodeURIComponent(escape(bin));
      } catch (_) {
        json = bin;
      }
      var o = JSON.parse(json);
      if (!o || o.v !== 1) return null;
      return { v: 1, u: o.u || {}, s: o.s || {}, n: o.n };
    } catch (_) {
      return null;
    }
  }

  function normalizeShortCode(raw) {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .replace(/O/g, '0')
      .replace(/[IL]/g, '1');
  }

  async function mintShortShareCode(payload) {
    var res = await fetch('/api/collections/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ payload: payload })
    });
    var data = await res.json().catch(function () {
      return null;
    });
    if (!res.ok || !data || !data.code) {
      throw new Error((data && (data.error || data.detail)) || 'HTTP ' + res.status);
    }
    return String(data.code);
  }

  async function fetchShortSharePayload(code) {
    var res = await fetch('/api/collections/share/' + encodeURIComponent(code), {
      credentials: 'same-origin'
    });
    var data = await res.json().catch(function () {
      return null;
    });
    if (!res.ok || !data || !data.payload) return null;
    return data.payload;
  }

  async function copyShareCode(btn) {
    var status = document.getElementById('colStatus');
    var original = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('generating');
    }
    try {
      var payload = ownedBagsForShare();
      if (!countOwnedInPayload(payload)) {
        if (status) status.textContent = t('share_import_fail');
        return;
      }
      var code = '';
      try {
        code = await mintShortShareCode(payload);
      } catch (err) {
        code = await encodeLongShareCode(payload);
        if (!code) throw err;
      }
      var input = document.getElementById('colShareCode');
      if (input) input.value = code;
      try {
        await navigator.clipboard.writeText(code);
      } catch (_) {}
      if (status) status.textContent = t('share_code_copied');
      try {
        var u = new URL(location.href);
        u.searchParams.set('code', code);
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      } catch (_) {}
      showShareSavePrompt(code, payload);
    } catch (err) {
      if (status) {
        status.textContent = t('share_code_fail', {
          err: (err && err.message) || String(err || 'error')
        });
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = original || t('copy_share_code');
      }
    }
  }

  async function importShareCode() {
    var status = document.getElementById('colStatus');
    var input = document.getElementById('colShareCode');
    var raw = input ? input.value : '';
    var payload = await decodeLongShareCode(raw);
    if (!payload) {
      var short = normalizeShortCode(raw);
      if (short.length === 6 || short.length === 8) {
        payload = await fetchShortSharePayload(short);
      }
    }
    if (!payload) {
      if (status) status.textContent = t('share_import_fail');
      return;
    }
    var n = applySharePayload(payload);
    if (n < 0) return;
    if (n === 0) {
      if (status) status.textContent = t('share_import_fail');
      return;
    }
    if (status) status.textContent = t('share_import_ok', { n: n });
    flashSuccessCheck();
  }

  async function maybeImportShareCodeFromUrl() {
    try {
      var u = new URL(location.href);
      var code = u.searchParams.get('code') || u.searchParams.get('c') || '';
      if (!code) return;
      var input = document.getElementById('colShareCode');
      if (input) input.value = code;
      await importShareCode();
    } catch (_) {}
  }

  function censusClientKey() {
    var key = '';
    try {
      key = localStorage.getItem('ggen_collections_census_ck') || '';
    } catch (_) {}
    if (key && key.length >= 16 && key.length <= 64) return key;
    try {
      if (window.crypto && typeof crypto.randomUUID === 'function') {
        key = 'ck_' + crypto.randomUUID().replace(/-/g, '');
      } else {
        key = 'ck_' + String(Date.now()) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      }
      localStorage.setItem('ggen_collections_census_ck', key);
    } catch (_) {}
    return key;
  }

  function loadCensusOptIn() {
    try {
      return localStorage.getItem('ggen_collections_census_optin') === '1';
    } catch (_) {
      return false;
    }
  }

  function saveCensusOptIn(on) {
    try {
      localStorage.setItem('ggen_collections_census_optin', on ? '1' : '0');
    } catch (_) {}
  }

  function catalogNameById(id) {
    var list = activeList();
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) return list[i].name || String(id);
    }
    var units = state.catalog.units || [];
    for (var u = 0; u < units.length; u++) {
      if (String(units[u].id) === String(id)) return units[u].name || String(id);
    }
    var supps = state.catalog.supporters || [];
    for (var s = 0; s < supps.length; s++) {
      if (String(supps[s].id) === String(id)) return supps[s].name || String(id);
    }
    return String(id);
  }

  function renderCensusHist(rows, snapshots) {
    var host = document.getElementById('colCensusHist');
    if (!host) return;
    var max = 1;
    (rows || []).forEach(function (r) {
      if ((r.count | 0) > max) max = r.count | 0;
    });
    if (!(snapshots > 0)) {
      host.innerHTML = '<p class="collections-census-empty">' + esc(t('census_empty')) + '</p>';
      return;
    }
    host.innerHTML = (rows || [])
      .map(function (r) {
        var pct = Math.max(0, Math.min(100, Math.round(((r.count | 0) / max) * 100)));
        return (
          '<div class="collections-census-hist-row">' +
          '<span class="collections-census-hist-lab">' +
          esc(String(r.lo) + '–' + String(r.hi) + '%') +
          '</span>' +
          '<div class="collections-census-bar"><i style="width:' +
          pct +
          '%"></i></div>' +
          '<span class="collections-census-count">' +
          esc(String(r.count | 0)) +
          '</span></div>'
        );
      })
      .join('');
  }

  function catalogRowById(id) {
    var sid = String(id);
    var lists = [activeList(), state.catalog.units || [], state.catalog.supporters || []];
    for (var L = 0; L < lists.length; L++) {
      var list = lists[L];
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id) === sid) return list[i];
      }
    }
    return null;
  }

  function censusRankColor(t) {
    /* t=0 highest (UR gold→magenta→violet), t=1 least (muted slate) */
    var stops = [
      [255, 215, 0],
      [190, 24, 93],
      [168, 85, 247],
      [29, 78, 216],
      [71, 85, 105]
    ];
    var x = Math.max(0, Math.min(1, Number(t) || 0));
    var scaled = x * (stops.length - 1);
    var i = Math.floor(scaled);
    var f = scaled - i;
    if (i >= stops.length - 1) {
      var last = stops[stops.length - 1];
      return 'rgb(' + last[0] + ',' + last[1] + ',' + last[2] + ')';
    }
    var a = stops[i];
    var b = stops[i + 1];
    var r = Math.round(a[0] + (b[0] - a[0]) * f);
    var g = Math.round(a[1] + (b[1] - a[1]) * f);
    var bl = Math.round(a[2] + (b[2] - a[2]) * f);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function renderCensusOwn(rows, snapshots) {
    var host = document.getElementById('colCensusOwn');
    if (!host) return;
    var list = (rows || []).slice();
    if (!(snapshots > 0) || !list.length) {
      host.innerHTML = '<p class="collections-census-empty">' + esc(t('census_empty')) + '</p>';
      return;
    }
    list.sort(function (a, b) {
      var ac = a.copies | 0;
      var bc = b.copies | 0;
      if (ac !== bc) return ac - bc;
      var ao = a.owned | 0;
      var bo = b.owned | 0;
      if (ao !== bo) return ao - bo;
      return String(a.id).localeCompare(String(b.id));
    });
    var maxPts = 1;
    list.forEach(function (r) {
      var c = r.copies | 0;
      if (c > maxPts) maxPts = c;
    });
    var yTop = maxPts;
    var yMid = Math.round(maxPts / 2);
    var n = list.length;
    var cols = list
      .map(function (r, idx) {
        var owned = r.owned | 0;
        var pts = r.copies | 0;
        var avg = Number(r.avg_copies != null ? r.avg_copies : 0) || 0;
        var h = Math.max(0, Math.min(100, Math.round((pts / maxPts) * 100)));
        var rankT = n <= 1 ? 0 : (n - 1 - idx) / (n - 1);
        var color = censusRankColor(rankT);
        var tip = t('census_own_tip', {
          pts: pts,
          owned: owned,
          avg: avg.toFixed(2)
        });
        var row = catalogRowById(r.id);
        var name = (row && row.name) || catalogNameById(r.id);
        var thum = row && row.thum ? imgUrl(row.thum) : '';
        var img = thum
          ? '<img src="' +
            esc(thum) +
            '" alt="' +
            esc(name) +
            '" loading="lazy" decoding="async">'
          : '';
        return (
          '<div class="collections-census-vhist-col">' +
          '<div class="collections-census-vhist-barwrap">' +
          '<div class="collections-census-vhist-detail" aria-hidden="true">' +
          '<div class="collections-census-vhist-detail-thumb">' +
          img +
          '</div>' +
          '<div class="collections-census-vhist-detail-name">' +
          esc(name) +
          '</div>' +
          '<div class="collections-census-vhist-detail-meta">' +
          esc(tip) +
          '</div></div>' +
          '<div class="collections-census-vhist-bar" style="height:' +
          h +
          '%;background:' +
          color +
          ';box-shadow:0 0 0 1px rgba(255,255,255,.12)"></div></div>' +
          '<div class="collections-census-vhist-thumb">' +
          img +
          '</div>' +
          '<span class="collections-census-vhist-val">' +
          esc(String(pts)) +
          '</span></div>'
        );
      })
      .join('');
    host.innerHTML =
      '<div class="collections-census-vhist">' +
      '<div class="collections-census-vhist-yaxis" aria-hidden="true">' +
      '<span>' +
      esc(String(yTop)) +
      '</span><span>' +
      esc(String(yMid)) +
      '</span><span>0</span></div>' +
      '<div class="collections-census-vhist-scroll">' +
      '<div class="collections-census-vhist-bars">' +
      cols +
      '</div></div></div>';
    var ownTitle = document.getElementById('colCensusOwnTitle');
    if (ownTitle) ownTitle.textContent = t('census_own_title', { type: typeTitle() });
    host.setAttribute('aria-label', t('census_own_title', { type: typeTitle() }));
    bindCensusOwnBarHold(host);
  }

  function bindCensusOwnBarHold(host) {
    if (!host || host._censusHoldBound) return;
    host._censusHoldBound = 1;
    var holdTimer = null;
    var holdCol = null;
    var clearHold = function () {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (holdCol) {
        holdCol.classList.remove('is-hold');
        holdCol = null;
      }
      host.querySelectorAll('.collections-census-vhist-col.is-hold').forEach(function (el) {
        el.classList.remove('is-hold');
      });
    };
    host.addEventListener(
      'pointerdown',
      function (e) {
        var col = e.target && e.target.closest ? e.target.closest('.collections-census-vhist-col') : null;
        if (!col || !host.contains(col)) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        clearHold();
        holdTimer = setTimeout(function () {
          holdTimer = null;
          holdCol = col;
          col.classList.add('is-hold');
        }, 420);
      },
      { passive: true }
    );
    host.addEventListener('pointerup', clearHold, { passive: true });
    host.addEventListener('pointercancel', clearHold, { passive: true });
    host.addEventListener(
      'pointermove',
      function (e) {
        if (!holdTimer) return;
        if (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 10) clearHold();
      },
      { passive: true }
    );
    host.addEventListener('contextmenu', function (e) {
      if (e.target && e.target.closest && e.target.closest('.collections-census-vhist-col')) {
        e.preventDefault();
      }
    });
  }

  async function loadCensusStats() {
    var meta = document.getElementById('colCensusMeta');
    if (meta) meta.textContent = t('census_loading');
    try {
      var board = state.type === 'supporters' ? 'supporters' : 'units';
      var res = await fetch('/api/collections/census/stats?board=' + encodeURIComponent(board) + '&top=24', {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      var data = await res.json().catch(function () {
        return null;
      });
      if (!res.ok || !data) throw new Error('HTTP ' + res.status);
      renderCensusHist(data.possession_hist || [], data.snapshots | 0);
      renderCensusOwn(data.kit_owned_hist || data.most_owned || [], data.snapshots | 0);
      if (meta) {
        meta.textContent = t('census_meta', {
          n: data.snapshots | 0,
          board: board === 'supporters' ? t('supporters') : t('units')
        });
      }
    } catch (_) {
      renderCensusHist([], 0);
      renderCensusOwn([], 0);
      if (meta) meta.textContent = t('census_empty');
    }
  }

  async function submitCensus(btn) {
    var meta = document.getElementById('colCensusMeta');
    var opt = document.getElementById('colCensusOptIn');
    if (!opt || !opt.checked) {
      if (meta) meta.textContent = t('census_need_optin');
      return;
    }
    var name = currentUsername();
    if (!name || name.length < 2) {
      if (meta) meta.textContent = t('census_need_name');
      var input = document.getElementById('colUsername');
      if (input) {
        input.focus();
        input.classList.add('is-need-name');
        setTimeout(function () {
          input.classList.remove('is-need-name');
        }, 1200);
      }
      return;
    }
    var hp = document.getElementById('colCensusHp');
    var original = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('generating');
    }
    try {
      var payload = ownedBagsForShare();
      payload.n = name;
      var res = await fetch('/api/collections/census', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          client_key: censusClientKey(),
          name: name,
          payload: payload,
          website: hp ? hp.value : ''
        })
      });
      var data = await res.json().catch(function () {
        return null;
      });
      if (res.status === 409) {
        if (meta) meta.textContent = t('census_name_taken');
        return;
      }
      if (!res.ok || !data || !data.ok) {
        throw new Error((data && data.error) || 'HTTP ' + res.status);
      }
      if (meta) {
        meta.textContent = t(data.updated ? 'census_updated' : 'census_ok', {
          name: data.name || name,
          n: data.snapshots | 0
        });
      }
      await loadCensusStats();
    } catch (err) {
      if (meta) {
        meta.textContent = t('census_fail', {
          err: (err && err.message) || String(err || 'error')
        });
      }
    } finally {
      if (btn) {
        var still = document.getElementById('colCensusOptIn');
        btn.disabled = !(still && still.checked);
        btn.textContent = original || t('census_submit');
      }
    }
  }

  function wireCensusUi() {
    var opt = document.getElementById('colCensusOptIn');
    var btn = document.getElementById('colCensusSubmit');
    if (opt) {
      opt.checked = loadCensusOptIn();
      if (btn) btn.disabled = !opt.checked;
      opt.addEventListener('change', function () {
        saveCensusOptIn(!!opt.checked);
        if (btn) btn.disabled = !opt.checked;
      });
    }
    if (btn) {
      btn.addEventListener('click', function () {
        submitCensus(btn);
      });
    }
  }

  async function shareOnX(btn) {
    var name = currentUsername();
    if (!name) {
      var input = document.getElementById('colUsername');
      var statusNeed = document.getElementById('colStatus');
      if (statusNeed) statusNeed.textContent = t('share_need_name');
      if (input) {
        input.focus();
        input.classList.add('is-need-name');
        setTimeout(function () {
          input.classList.remove('is-need-name');
        }, 1200);
      }
      return;
    }
    var uSt = computeStats(state.catalog.units || []);
    var sSt = computeStats(state.catalog.supporters || []);
    var st = computeStats(activeList());
    var text = t('share_body_named', {
      name: name,
      u_pct: uSt.pct,
      u_owned: uSt.owned,
      u_total: uSt.total,
      u_lb: uSt.lbTotal,
      u_lbMax: uSt.lbMax,
      s_pct: sSt.pct,
      s_owned: sSt.owned,
      s_total: sSt.total,
      s_lb: sSt.lbTotal,
      s_lbMax: sSt.lbMax,
      url: siteUrl()
    });
    var status = document.getElementById('colStatus');
    if (btn) {
      btn.disabled = true;
      btn.textContent = t('generating');
    }
    try {
      var canvas = await generateShareImage();
      var blob = await canvasToPngBlob(canvas);
      var fileName =
        'ggendb-collections-report-' + state.type + '-' + st.pct + 'pct.png';
      var file = new File([blob], fileName, { type: 'image/png' });

      try {
        if (await tryShareWithImage(text, file)) {
          if (status) status.textContent = t('share_done');
          return;
        }
      } catch (shareErr) {
        if (shareErr && shareErr.name === 'AbortError') {
          if (status) status.textContent = t('share_cancel');
          return;
        }
      }

      var copied = await tryCopyImage(blob);
      if (!copied) downloadBlob(blob, fileName);

      var intent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
      window.open(intent, '_blank', 'noopener,noreferrer');
      if (status) status.textContent = copied ? t('share_paste_hint') : t('share_attach_hint');
    } catch (err) {
      if (status) {
        status.textContent = t('share_fail', {
          err: (err && err.message) || String(err || 'error')
        });
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        applyShareXBtnLabel(btn);
      }
    }
  }

  state.lang = normLang(state.lang);
  applyUiLang();
  bind();
  loadCatalog().then(function () {
    return maybeImportShareCodeFromUrl();
  }).then(function () {
    try {
      if (window.requestIdleCallback) {
        requestIdleCallback(function () {
          prefetchShareAssets();
        }, { timeout: 2500 });
      } else {
        setTimeout(prefetchShareAssets, 500);
      }
    } catch (_) {
      setTimeout(prefetchShareAssets, 500);
    }
    return loadCensusStats();
  });
})();
