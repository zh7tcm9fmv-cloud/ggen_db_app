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
      back: '← Database',
      eyebrow: 'UR Acquisition Review',
      title: 'Hangar Collection',
      sub: 'Track UR unit and supporter possession\nTap a portrait to cycle not possessed → Limit Break 0 → Limit Break 3.\nPossessing a unit covers its character',
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
        'Sorted least → most collected (left → right). Height = total possession points in the census (not possessed = 0 · Max Limit Break = 4). Hover a bar (or long-press on mobile) for kit details.',
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
      default_save_name: 'Collection {i}'
    },
    JA: {
      page_title: '格納庫コレクション — GGen Eternal Database',
      back: '← データベース',
      eyebrow: 'UR取得進捗',
      title: '格納庫コレクション',
      sub: 'URユニット／サポーターの所持を記録\nタップで未所持 → 限界突破0 → 限界突破3。\nユニット所持はキャラクター所持も含みます',
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
      share_code: '共有コード',
      share_code_ph: 'コードを貼り付けてインポート…',
      copy_share_code: '共有コードを生成',
      import_share_code: 'インポート',
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
        '所持ポイントが少ない順（左→右）。高さ＝センサス内の合計所持ポイント（未所持=0・限界突破MAX=4）。棒にホバー（スマホは長押し）で詳細表示。',
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
      default_save_name: 'コレクション {i}'
    },
    TW: {
      page_title: '格納庫收藏 — GGen Eternal Database',
      back: '← 資料庫',
      eyebrow: 'UR獲取進度',
      title: '格納庫收藏',
      sub: '記錄 UR 單位與支援人員持有狀態\n點選肖像可循環：未持有 → 突破界限 0 → 突破界限 3。\n持有單位即視為持有角色',
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
      share_code: '分享代碼',
      share_code_ph: '貼上代碼以匯入…',
      copy_share_code: '產生分享代碼',
      import_share_code: '匯入',
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
        '依持有點數由低到高（左→右）。高度＝普查內合計持有點數（未持有=0・突破界限 MAX=4）。懸停長條（手機長按）可查看詳情。',
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
      default_save_name: '收藏 {i}'
    },
    HK: {
      page_title: '格納庫收藏 — GGen Eternal Database',
      back: '← 資料庫',
      eyebrow: 'UR獲取進度',
      title: '格納庫收藏',
      sub: '記錄 UR 單位與支援人員持有狀態\n點選肖像可循環：未持有 → 突破界限 0 → 突破界限 3。\n持有單位即視為持有角色',
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
      share_code: '分享代碼',
      share_code_ph: '貼上代碼以匯入…',
      copy_share_code: '產生分享代碼',
      import_share_code: '匯入',
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
        '依持有點數由低到高（左→右）。高度＝普查內合計持有點數（未持有=0・突破界限 MAX=4）。懸停長條（手機長按）可查看詳情。',
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
      default_save_name: '收藏 {i}'
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
    var lbMax = total * MAX_LB;
    return {
      total: total,
      owned: owned,
      maxed: maxed,
      limTotal: limTotal,
      limOwned: limOwned,
      byRole: byRole,
      pct: pct,
      lbTotal: lbSum,
      lbMax: lbMax
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
    var playerName = currentUsername();
    var pctTop = pad + (playerName ? 86 : 78);
    var ownedY = pctTop + 62;
    if (perfect) ownedY = Math.max(ownedY, pad + 142);
    var subY = ownedY + 20;
    var subH = 44;
    var headerH = subY + subH + 16;
    var rowsN = Math.max(1, Math.ceil((rows.length || 1) / cols));
    var gridW = cols * cell + (cols - 1) * gap;
    var gridH = rowsN * cell + (rowsN - 1) * gap;
    var W = gridW + pad * 2;
    var H = headerH + gridH + pad + 40;
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
    ctx.fillText(pctStr, pad, pctTop);
    var pctW = ctx.measureText(pctStr).width;
    ctx.fillStyle = perfect ? '#ffd700' : complete ? '#7af0ff' : '#00d4ff';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('%', pad + pctW + 4, pctTop + 28);

    if (complete) {
      var badge = perfect ? t('complete_max') : t('complete');
      ctx.font = 'bold 11px sans-serif';
      var bw = Math.max(perfect ? 118 : 72, ctx.measureText(badge).width + 22);
      var bx = pad + pctW + 28;
      var by = pctTop + 14;
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
        var sby = by + 26;
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
      t('owned_line', { owned: st.owned, total: st.total, lb: st.lbTotal, lbMax: st.lbMax }),
      pad,
      ownedY
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
    subStats.forEach(function (item, i) {
      var x = pad + i * subW;
      var y = subY;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, subW - 4, subH);
      ctx.strokeStyle = perfect
        ? 'rgba(255,215,0,0.5)'
        : complete
          ? 'rgba(255,215,0,0.28)'
          : '#1e293b';
      ctx.strokeRect(x, y, subW - 4, subH);
      ctx.fillStyle = perfect && i === 0 ? '#ffd700' : '#00d4ff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.v, x + (subW - 4) / 2, y + 7);
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.fillText(item.l, x + (subW - 4) / 2, y + 26);
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

    /* Match .col-card.is-unowned: opacity .3 + grayscale(.65) brightness(.45) on the whole cell */
    var UNOWNED_FILTER = 'grayscale(0.65) brightness(0.45)';
    var UNOWNED_ALPHA = 0.3;
    var cellCanvas = document.createElement('canvas');
    cellCanvas.width = cell;
    cellCanvas.height = cell;
    var cctx = cellCanvas.getContext('2d');

    var gridY = headerH;
    rows.forEach(function (row, i) {
      var col = i % cols;
      var rowIdx = Math.floor(i / cols);
      var x = pad + col * (cell + gap);
      var y = gridY + rowIdx * (cell + gap);
      var lb = getLb(row.id);
      var im = thumbs[i];
      var owned = lb >= 0;

      cctx.clearRect(0, 0, cell, cell);
      cctx.fillStyle = '#0b1220';
      cctx.fillRect(0, 0, cell, cell);

      if (isSupp) {
        if (suppBaseImg) cctx.drawImage(suppBaseImg, 0, 0, cell, cell);
        if (im) {
          var insetX = cell * 0.14;
          var insetY = cell * 0.085;
          cctx.save();
          cctx.beginPath();
          cctx.rect(insetX, insetY, cell - insetX * 2, cell - insetY * 2);
          cctx.clip();
          cctx.drawImage(im, insetX, insetY, cell - insetX * 2, cell - insetY * 2);
          cctx.restore();
        }
        if (suppLrImg) {
          var sideW = cell * 0.27;
          cctx.drawImage(suppLrImg, 0, 0, sideW, cell);
          cctx.save();
          cctx.translate(cell, 0);
          cctx.scale(-1, 1);
          cctx.drawImage(suppLrImg, 0, 0, sideW, cell);
          cctx.restore();
        }
        if (suppTbImg) {
          var endH = cell * 0.085;
          var endW = cell * 0.88;
          var endX = (cell - endW) / 2;
          cctx.drawImage(suppTbImg, endX, 0, endW, endH);
          cctx.drawImage(suppTbImg, endX, cell - endH, endW, endH);
        }
      } else {
        if (unitBaseImg) cctx.drawImage(unitBaseImg, 0, 0, cell, cell);
        if (im) {
          var padIn = cell * 0.1;
          cctx.save();
          cctx.beginPath();
          cctx.rect(padIn, padIn, cell - padIn * 2, cell - padIn * 2 - 2);
          cctx.clip();
          cctx.drawImage(im, padIn, padIn, cell - padIn * 2, cell - padIn * 2 - 2);
          cctx.restore();
        }
        if (unitFrameImg) cctx.drawImage(unitFrameImg, 0, 0, cell, cell);
      }

      cctx.strokeStyle = lbBorderColor(lb);
      cctx.lineWidth = lb >= 3 ? 2.5 : 1.5;
      drawRoundRect(cctx, 0.5, 0.5, cell - 1, cell - 1, 6);
      cctx.stroke();

      if (row.is_limited_time) {
        var limGrad = cctx.createLinearGradient(0, 0, cell, 0);
        if (isSupp) {
          limGrad.addColorStop(0, '#0e7490');
          limGrad.addColorStop(0.45, '#155e75');
          limGrad.addColorStop(1, '#b8954a');
        } else {
          limGrad.addColorStop(0, '#be185d');
          limGrad.addColorStop(0.55, '#a855f7');
          limGrad.addColorStop(1, '#1d4ed8');
        }
        cctx.fillStyle = limGrad;
        cctx.fillRect(0, 0, cell, 14);
        cctx.fillStyle = '#fff';
        cctx.font = 'bold 8px sans-serif';
        cctx.textAlign = 'center';
        cctx.textBaseline = 'top';
        cctx.fillText(limitedWord(), cell / 2, 3);
        cctx.textAlign = 'left';
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
        var sx0 = (cell - totalW) / 2;
        var sy = cell - 16;
        slots.forEach(function (ic, si) {
          if (ic) cctx.drawImage(ic, sx0 + si * (iw + gapI), sy, iw, iw);
        });
      }

      ctx.save();
      if (!owned) {
        try {
          ctx.filter = UNOWNED_FILTER;
        } catch (_) {}
        ctx.globalAlpha = UNOWNED_ALPHA;
      }
      ctx.drawImage(cellCanvas, x, y);
      ctx.restore();
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
    var langIcon = await loadImage(imgUrl('/static/images/UI/UI_Common_MenuIcon_Language.webp'));
    var footIcon = 14;
    var footGap = 5;
    var footTextX = pad;
    if (langIcon) {
      ctx.drawImage(langIcon, pad, footY + 10, footIcon, footIcon);
      footTextX = pad + footIcon + footGap;
    }
    ctx.fillText(foot, footTextX, footY + 12);

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
    var original = btn ? btn.textContent : '';
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
        btn.textContent = original || t('share_x');
      }
    }
  }

  state.lang = normLang(state.lang);
  applyUiLang();
  bind();
  loadCatalog().then(function () {
    return maybeImportShareCodeFromUrl();
  }).then(function () {
    return loadCensusStats();
  });
})();
