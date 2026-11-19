"""Unique meta titles/descriptions for indexed pages — EN, TW, HK, JA, KR.

TW 《SD鋼彈 G世代 永恆》; HK 《SD高達 G世代 永恆》;
JA 「SDガンダム Gジェネレーション エターナル」; KR 「SD건담 G 제네레이션 이터널」 (in-game LANG).
Hub labels follow the site UI strings.
"""

GAME = {
    'EN': 'SD Gundam G Generation ETERNAL',
    'TW': 'SD鋼彈 G世代 永恆',
    'HK': 'SD高達 G世代 永恆',
    'JA': 'SDガンダム Gジェネレーション エターナル',
    'KR': 'SD건담 G 제네레이션 이터널',
}

# path -> (en_title, en_desc, zh_title, zh_desc_with_{game})
# zh_desc is formatted with game=GAME[TW|HK] so the two locales are not duplicates.
_HUBS = {
    '/': (
        'GGen Eternal Database',
        'GGen Eternal Database — units, pilots, supporters, stages, and tools for SD Gundam G Generation ETERNAL.',
        'GGen Eternal Database',
        'GGen Eternal Database：《{game}》角色、單位、支援人員、關卡與損傷模擬、機體補給情報。',
    ),
    '/c': (
        'Characters — GGen Eternal Database',
        'Browse playable pilots in SD Gundam G Generation ETERNAL — stats, skills, abilities, Limit Break, and series.',
        '角色 — GGen Eternal Database',
        '瀏覽《{game}》可使用角色：能力值、技能、能力、突破界限與系列。',
    ),
    '/u': (
        'Units — GGen Eternal Database',
        'Browse mobile suits in SD Gundam G Generation ETERNAL — weapons, traits, terrain, and best synergy pilots.',
        '單位 — GGen Eternal Database',
        '瀏覽《{game}》單位：武裝、特性、地形適性與最佳協同駕駛。',
    ),
    '/s': (
        'Supporters — GGen Eternal Database',
        'Browse supporters in SD Gundam G Generation ETERNAL — leader skills, actives, and tags.',
        '支援人員 — GGen Eternal Database',
        '瀏覽《{game}》支援人員：隊長技能、主動技能與標籤。',
    ),
    '/st': (
        'Eternal Road Stages — GGen Eternal Database',
        'Eternal Road stage list for SD Gundam G Generation ETERNAL — rewards, enemies, and clear info.',
        '永恆之路 — GGen Eternal Database',
        '《{game}》永恆之路關卡一覽：報酬、敵方與通關資訊。',
    ),
    '/gtower': (
        'GTower Stages — GGen Eternal Database',
        'Generation Tower floors and rewards for SD Gundam G Generation ETERNAL.',
        '世代之塔 — GGen Eternal Database',
        '《{game}》世代之塔樓層、敵方與報酬。',
    ),
    '/challenge': (
        'Challenge Stages — GGen Eternal Database',
        'Challenge series stages for SD Gundam G Generation ETERNAL — series rewards and enemy lists.',
        '挑戰關卡 — GGen Eternal Database',
        '《{game}》挑戰系列關卡：系列報酬與敵方編成。',
    ),
    '/go': (
        'Grand Offensive — GGen Eternal Database',
        'Grand Offensive Score Attack stages for SD Gundam G Generation ETERNAL — score rules and rewards.',
        '大規模攻略戰 — GGen Eternal Database',
        '《{game}》大規模攻略戰積分挑戰：積分規則與報酬。',
    ),
    '/special': (
        'Special Stages — GGen Eternal Database',
        'Special stages for SD Gundam G Generation ETERNAL — event maps outside Eternal Road.',
        '特別關卡 — GGen Eternal Database',
        '《{game}》特別關卡：永恆之路以外的活動地圖與報酬。',
    ),
    '/collab': (
        'Collaboration Stages — GGen Eternal Database',
        'Collaboration stages for SD Gundam G Generation ETERNAL — crossover maps and rewards.',
        '聯動關卡 — GGen Eternal Database',
        '《{game}》聯動關卡：合作地圖與通關報酬。',
    ),
    '/op': (
        'Option Parts — GGen Eternal Database',
        'Modifications (option parts) for SD Gundam G Generation ETERNAL — effects, tags, and filters.',
        '選擇性零件 — GGen Eternal Database',
        '《{game}》選擇性零件：效果、標籤與篩選。',
    ),
    '/cal': (
        'Damage Simulator — GGen Eternal Database',
        'Damage Simulator for SD Gundam G Generation ETERNAL — unit and pilot combos versus Eternal Road and Score Attack.',
        '損傷模擬器 — GGen Eternal Database',
        '《{game}》損傷模擬器：試算單位與角色組合對永恆之路、積分挑戰的輸出。',
    ),
    '/tb': (
        'Team Builder — GGen Eternal Database',
        'Team Builder for SD Gundam G Generation ETERNAL — squads with units, pilots, supporters, and option parts.',
        '隊伍編成 — GGen Eternal Database',
        '《{game}》隊伍編成：組合單位、角色、支援人員與選擇性零件。',
    ),
    '/tl': (
        'Unit Assembly — GGen Eternal Database',
        'Unit Assembly timeline for SD Gundam G Generation ETERNAL — featured kits, dates, and official drop rates.',
        '機體補給 — GGen Eternal Database',
        '《{game}》機體補給時間軸：主打機體、檔期與官方機率。',
    ),
    '/ml': (
        'Master League — GGen Eternal Database',
        'Master League schedule, boost tags, and ranks for SD Gundam G Generation ETERNAL.',
        '大師聯盟 — GGen Eternal Database',
        '《{game}》大師聯盟：檔期、加成標籤與段位報酬。',
    ),
    '/mls': (
        'Master League Simulator — GGen Eternal Database',
        'Master League formation and turn battle simulator for SD Gundam G Generation ETERNAL.',
        '大師聯盟模擬 — GGen Eternal Database',
        '《{game}》大師聯盟編制與回合戰鬥模擬。',
    ),
    '/estscore': (
        'MAX SS Pt Estimate — GGen Eternal Database',
        'Master League MAX SS / Event Estimated Score calculator for SD Gundam G Generation ETERNAL.',
        'MAX SS Pt 預估 — GGen Eternal Database',
        '《{game}》大師聯盟 MAX SS／活動預估分數計算機。',
    ),
    '/rk': (
        'Ranking — GGen Eternal Database',
        'Character and unit ranking lists for SD Gundam G Generation ETERNAL.',
        '排行 — GGen Eternal Database',
        '《{game}》角色與單位排行清單。',
    ),
    '/new': (
        'Latest Release — GGen Eternal Database',
        'Latest release units and characters for SD Gundam G Generation ETERNAL.',
        '最新登場 — GGen Eternal Database',
        '《{game}》最新登場的單位與角色。',
    ),
    '/esim': (
        'E-Simulator — GGen Eternal Database',
        'E-Simulator for SD Gundam G Generation ETERNAL stage runs and reward planning.',
        'E-Simulator — GGen Eternal Database',
        '《{game}》關卡運行與報酬規劃用的 E-Simulator。',
    ),
    '/gacha-sim': (
        'Gacha Simulator — GGen Eternal Database',
        'Unit Assembly gacha simulator for SD Gundam G Generation ETERNAL — official proportion tables.',
        '機體補給模擬 — GGen Eternal Database',
        '《{game}》機體補給模擬：使用官方機率表試抽。',
    ),
    '/roadmap': (
        '1.5 Anniversary Calendar — GGen Eternal Database',
        '1.5 anniversary calendar and roadmap for SD Gundam G Generation ETERNAL.',
        '1.5 週年曆 — GGen Eternal Database',
        '《{game}》1.5 週年活動曆與行程。',
    ),
    '/ip': (
        'Investment Priority — GGen Eternal Database',
        'Investment Priority guide for SD Gundam G Generation ETERNAL — which kits to raise with SP first.',
        '投資優先度 — GGen Eternal Database',
        '《{game}》投資優先度：建議先用 SP 培養的機體與角色。',
    ),
    '/collections': (
        'Collections — GGen Eternal Database',
        'Hangar collection tracker for SD Gundam G Generation ETERNAL — UR units, supporters, and Limit Break progress.',
        '收藏 — GGen Eternal Database',
        '《{game}》收藏追蹤：UR 單位、支援人員與突破界限進度。',
    ),
    '/game-news': (
        'Game News — GGen Eternal Database',
        'Official game news for SD Gundam G Generation ETERNAL — maintenance, campaigns, and update notes.',
        '遊戲公告 — GGen Eternal Database',
        '《{game}》官方遊戲公告：維護、活動與更新說明。',
    ),
    '/tm': (
        'Tag Matrix — GGen Eternal Database',
        'Tag Matrix for SD Gundam G Generation ETERNAL — supporters and units that share each series tag.',
        '標籤對照表 — GGen Eternal Database',
        '《{game}》標籤對照表：各系列標籤共通的支援人員與單位。',
    ),
    '/dm': (
        'Debuff Matrix — GGen Eternal Database',
        'Debuff Matrix for SD Gundam G Generation ETERNAL — who inflicts DEF Down and other weapon debuffs.',
        '負面效果對應表 — GGen Eternal Database',
        '《{game}》負面效果對應表：誰能造成防禦下降等武裝負面效果。',
    ),
    '/tracking': (
        'Sales Rank Tracking — GGen Eternal Database',
        'App Store top-grossing ranks for SD Gundam G Generation ETERNAL by country during Unit Assembly windows.',
        '銷售排行追蹤 — GGen Eternal Database',
        '《{game}》各國 App Store 暢銷排行，對照機體補給期間。',
    ),
    '/about': (
        'About — GGen Eternal Database',
        'About GGen Eternal Database — a fan reference for SD Gundam G Generation ETERNAL units, pilots, and tools.',
        '關於 — GGen Eternal Database',
        '關於 GGen Eternal Database：玩家製作的《{game}》單位、角色與工具資料站。',
    ),
    '/feedback': (
        'Feedback — GGen Eternal Database',
        'Rate GGen Eternal Database — navigation, design, content, and tools for SD Gundam G Generation ETERNAL.',
        '意見回饋 — GGen Eternal Database',
        '為 GGen Eternal Database 評分：導覽、設計、內容，以及《{game}》相關工具。',
    ),
    '/privacy-policy': (
        'Privacy Policy — GGen Eternal Database',
        'Privacy policy for GGen Eternal Database — analytics, cookies, and what this SD Gundam G Generation ETERNAL fan site stores.',
        '隱私權政策 — GGen Eternal Database',
        'GGen Eternal Database 隱私權政策：分析、Cookie，以及本《{game}》資料站保存的資料。',
    ),
}

KIND_LABEL = {
    'EN': {
        'unit': 'unit',
        'character': 'character',
        'supporter': 'supporter',
        'stage': 'stage',
        'option_part': 'option part',
    },
    'TW': {
        'unit': '單位',
        'character': '角色',
        'supporter': '支援人員',
        'stage': '關卡',
        'option_part': '選擇性零件',
    },
    'HK': {
        'unit': '單位',
        'character': '角色',
        'supporter': '支援人員',
        'stage': '關卡',
        'option_part': '選擇性零件',
    },
    'JA': {
        'unit': 'ユニット',
        'character': 'キャラクター',
        'supporter': 'サポーター',
        'stage': 'ステージ',
        'option_part': 'オプションパーツ',
    },
    'KR': {
        'unit': '유닛',
        'character': '캐릭터',
        'supporter': '서포터',
        'stage': '스테이지',
        'option_part': '옵션 파츠',
    },
}

KIND_TITLE = {
    'EN': {
        'unit': 'Unit',
        'character': 'Character',
        'supporter': 'Supporter',
        'stage': 'Stage',
        'option_part': 'Option Part',
    },
    'TW': {
        'unit': '單位',
        'character': '角色',
        'supporter': '支援人員',
        'stage': '關卡',
        'option_part': '選擇性零件',
    },
    'HK': {
        'unit': '單位',
        'character': '角色',
        'supporter': '支援人員',
        'stage': '關卡',
        'option_part': '選擇性零件',
    },
    'JA': {
        'unit': 'ユニット',
        'character': 'キャラクター',
        'supporter': 'サポーター',
        'stage': 'ステージ',
        'option_part': 'オプションパーツ',
    },
    'KR': {
        'unit': '유닛',
        'character': '캐릭터',
        'supporter': '서포터',
        'stage': '스테이지',
        'option_part': '옵션 파츠',
    },
}

# JA / KR hub copy. Descriptions use {game}. Titles match site UI strings.
_JA = {
    '/': ('GGen Eternal Database', 'GGen Eternal Database：「{game}」のユニット、キャラクター、サポーター、ステージ、ダメージシミュレーター、ピックアップガシャ。'),
    '/c': ('キャラクター — GGen Eternal Database', '「{game}」のプレイアブルキャラクター：ステータス、スキル、アビリティ、限界突破、シリーズ。'),
    '/u': ('ユニット — GGen Eternal Database', '「{game}」のユニット：武装、特性、地形適性、ベストシナジーパイロット。'),
    '/s': ('サポーター — GGen Eternal Database', '「{game}」のサポーター：リーダースキル、アクティブ、タグ。'),
    '/st': ('エターナルロード — GGen Eternal Database', '「{game}」エターナルロードのステージ一覧：報酬、敵、クリア情報。'),
    '/gtower': ('ジェネレーションタワー — GGen Eternal Database', '「{game}」ジェネレーションタワーの階層、敵、報酬。'),
    '/challenge': ('チャレンジ — GGen Eternal Database', '「{game}」チャレンジシリーズのステージ：シリーズ報酬と敵編成。'),
    '/go': ('大規模攻略戦スコアアタック — GGen Eternal Database', '「{game}」大規模攻略戦スコアアタック：スコアルールと報酬。'),
    '/special': ('特別レベル — GGen Eternal Database', '「{game}」特別レベル：エターナルロード以外のイベントマップと報酬。'),
    '/collab': ('コラボステージ — GGen Eternal Database', '「{game}」コラボステージ：コラボマップとクリア報酬。'),
    '/op': ('オプションパーツ — GGen Eternal Database', '「{game}」オプションパーツ：効果、タグ、絞り込み。'),
    '/cal': ('ダメージシミュレーター — GGen Eternal Database', '「{game}」ダメージシミュレーター：ユニットとキャラの組み合わせをエターナルロード／スコアアタックで試算。'),
    '/tb': ('チーム編成 — GGen Eternal Database', '「{game}」チーム編成：ユニット、キャラクター、サポーター、オプションパーツ。'),
    '/tl': ('ピックアップガシャ — GGen Eternal Database', '「{game}」ピックアップガシャの時系列：注目機体、期間、公式排出率。'),
    '/ml': ('マスターリーグ — GGen Eternal Database', '「{game}」マスターリーグ：スケジュール、ブーストタグ、ランク報酬。'),
    '/mls': ('マスターリーグシミュレーター — GGen Eternal Database', '「{game}」マスターリーグの編成とバトルシミュレーション。'),
    '/estscore': ('MAX SS Pt予想 — GGen Eternal Database', '「{game}」マスターリーグ MAX SS／イベント予想スコア計算機。'),
    '/rk': ('ランキング — GGen Eternal Database', '「{game}」キャラクターとユニットのランキング。'),
    '/new': ('最新登場 — GGen Eternal Database', '「{game}」最新登場のユニットとキャラクター。'),
    '/esim': ('E-Simulator — GGen Eternal Database', '「{game}」のステージ進行と報酬計画用 E-Simulator。'),
    '/gacha-sim': ('ガチャシミュ — GGen Eternal Database', '「{game}」ガチャシミュ：公式の排出割合表で試行。'),
    '/roadmap': ('1.5周年カレンダー — GGen Eternal Database', '「{game}」1.5周年カレンダーとスケジュール。'),
    '/ip': ('投資優先度 — GGen Eternal Database', '「{game}」投資優先度：SPを先に使う機体とキャラクター。'),
    '/collections': ('コレクション — GGen Eternal Database', '「{game}」コレクション：URユニット、サポーター、限界突破の進捗。'),
    '/game-news': ('ゲームニュース — GGen Eternal Database', '「{game}」公式ゲームニュース：メンテナンス、キャンペーン、更新。'),
    '/tm': ('タグ対応表 — GGen Eternal Database', '「{game}」タグ対応表：同じシリーズタグのサポーターとユニット。'),
    '/dm': ('マイナス効果対応表 — GGen Eternal Database', '「{game}」マイナス効果対応表：DEF低下など武装デバフを付与できる機体。'),
    '/tracking': ('セルラン追跡 — GGen Eternal Database', '「{game}」各国App Store売上順位。ピックアップガシャ期間と対照。'),
    '/about': ('このサイトについて — GGen Eternal Database', 'GGen Eternal Databaseについて：ファン制作の「{game}」ユニット・キャラクター・ツール資料。'),
    '/feedback': ('フィードバック — GGen Eternal Database', 'GGen Eternal Databaseの評価：ナビ、デザイン、内容、「{game}」向けツール。'),
    '/privacy-policy': ('プライバシーポリシー — GGen Eternal Database', 'GGen Eternal Databaseのプライバシーポリシー：解析、Cookie、この「{game}」資料サイトが保存する情報。'),
}

_KR = {
    '/': ('GGen Eternal Database', 'GGen Eternal Database: 「{game}」 유닛, 캐릭터, 서포터, 스테이지, 대미지 시뮬레이터, 배너 타임라인.'),
    '/c': ('캐릭터 — GGen Eternal Database', '「{game}」 플레이어블 캐릭터: 스탯, 스킬, 어빌리티, 한계 돌파, 시리즈.'),
    '/u': ('유닛 — GGen Eternal Database', '「{game}」 유닛: 무장, 특성, 지형 적성, 베스트 시너지 파일럿.'),
    '/s': ('서포터 — GGen Eternal Database', '「{game}」 서포터: 리더 스킬, 액티브, 태그.'),
    '/st': ('이터널 로드 — GGen Eternal Database', '「{game}」 이터널 로드 스테이지: 보상, 적, 클리어 정보.'),
    '/gtower': ('제네레이션 타워 — GGen Eternal Database', '「{game}」 제네레이션 타워 층, 적, 보상.'),
    '/challenge': ('챌린지 — GGen Eternal Database', '「{game}」 챌린지 시리즈 스테이지: 시리즈 보상과 적 편성.'),
    '/go': ('대규모 공략전 스코어 어택 — GGen Eternal Database', '「{game}」 대규모 공략전 스코어 어택: 점수 규칙과 보상.'),
    '/special': ('특별 스테이지 — GGen Eternal Database', '「{game}」 특별 스테이지: 이터널 로드 밖의 이벤트 맵과 보상.'),
    '/collab': ('콜라보 스테이지 — GGen Eternal Database', '「{game}」 콜라보 스테이지: 콜라보 맵과 클리어 보상.'),
    '/op': ('옵션 파츠 — GGen Eternal Database', '「{game}」 옵션 파츠: 효과, 태그, 필터.'),
    '/cal': ('대미지 시뮬레이터 — GGen Eternal Database', '「{game}」 대미지 시뮬레이터: 유닛과 캐릭터 조합을 이터널 로드·스코어 어택에서 계산.'),
    '/tb': ('팀 빌더 — GGen Eternal Database', '「{game}」 팀 빌더: 유닛, 캐릭터, 서포터, 옵션 파츠.'),
    '/tl': ('배너 타임라인 — GGen Eternal Database', '「{game}」 배너 타임라인: 픽업 기체, 기간, 공식 배출률.'),
    '/ml': ('마스터 리그 — GGen Eternal Database', '「{game}」 마스터 리그: 일정, 부스트 태그, 랭크 보상.'),
    '/mls': ('마스터 리그 시뮬레이터 — GGen Eternal Database', '「{game}」 마스터 리그 편성과 턴 배틀 시뮬레이터.'),
    '/estscore': ('MAX SS Pt 예상 — GGen Eternal Database', '「{game}」 마스터 리그 MAX SS / 이벤트 예상 점수 계산기.'),
    '/rk': ('랭킹 — GGen Eternal Database', '「{game}」 캐릭터와 유닛 랭킹.'),
    '/new': ('최신 등장 — GGen Eternal Database', '「{game}」 최신 등장 유닛과 캐릭터.'),
    '/esim': ('E-Simulator — GGen Eternal Database', '「{game}」 스테이지 진행과 보상 계획용 E-Simulator.'),
    '/gacha-sim': ('가챠 시뮬 — GGen Eternal Database', '「{game}」 가챠 시뮬: 공식 배출 비율표로 시험 뽑기.'),
    '/roadmap': ('1.5주년 캘린더 — GGen Eternal Database', '「{game}」 1.5주년 캘린더와 일정.'),
    '/ip': ('투자 우선도 — GGen Eternal Database', '「{game}」 투자 우선도: SP를 먼저 투자할 기체와 캐릭터.'),
    '/collections': ('컬렉션 — GGen Eternal Database', '「{game}」 컬렉션: UR 유닛, 서포터, 한계 돌파 진행도.'),
    '/game-news': ('게임 뉴스 — GGen Eternal Database', '「{game}」 공식 게임 뉴스: 점검, 캠페인, 업데이트.'),
    '/tm': ('태그 매트릭스 — GGen Eternal Database', '「{game}」 태그 매트릭스: 같은 시리즈 태그의 서포터와 유닛.'),
    '/dm': ('디버프 매트릭스 — GGen Eternal Database', '「{game}」 디버프 매트릭스: 방어력 하락 등 무장 디버프를 거는 기체.'),
    '/tracking': ('세일즈 추적 — GGen Eternal Database', '「{game}」 국가별 App Store 매출 순위. 배너 기간과 대조.'),
    '/about': ('소개 — GGen Eternal Database', 'GGen Eternal Database 소개: 팬이 만든 「{game}」 유닛·캐릭터·도구 자료.'),
    '/feedback': ('피드백 — GGen Eternal Database', 'GGen Eternal Database 평가: 탐색, 디자인, 내용, 「{game}」 도구.'),
    '/privacy-policy': ('개인정보 처리방침 — GGen Eternal Database', 'GGen Eternal Database 개인정보 처리방침: 분석, 쿠키, 이 「{game}」 자료 사이트가 저장하는 정보.'),
}

HREFLANG = (
    ('en', 'EN'),
    ('zh-Hant-TW', 'TW'),
    ('zh-Hant-HK', 'HK'),
    ('ja', 'JA'),
    ('ko', 'KR'),
    ('x-default', 'EN'),
)


def normalize_lang(raw):
    lang = str(raw or '').strip().upper()
    if lang in ('JP', 'JA'):
        return 'JA'
    if lang in ('KR', 'HR'):
        return 'KR'
    if lang in ('EN', 'TW', 'HK'):
        return lang
    return 'EN'


def html_lang(lang):
    lang = normalize_lang(lang)
    if lang in ('TW', 'HK'):
        return 'zh-Hant'
    if lang == 'JA':
        return 'ja'
    if lang == 'KR':
        return 'ko'
    return 'en'


def hub_meta(path, lang):
    row = _HUBS.get(path)
    if not row:
        return None
    en_title, en_desc, zh_title, zh_desc = row
    lang = normalize_lang(lang)
    if lang == 'EN':
        return en_title, en_desc
    if lang in ('TW', 'HK'):
        return zh_title, zh_desc.format(game=GAME[lang])
    pack = _JA if lang == 'JA' else _KR
    title, desc = pack[path]
    return title, desc.format(game=GAME[lang])


def default_meta(lang):
    return hub_meta('/', lang)


def entity_meta(lang, kind, name, rarity, series, eid):
    """Unique sentence per entity. TW/HK differ by the official game title."""
    lang = normalize_lang(lang)
    label = (KIND_LABEL.get(lang) or KIND_LABEL['EN']).get(kind) or kind
    title_label = (KIND_TITLE.get(lang) or KIND_TITLE['EN']).get(kind) or label
    game = GAME.get(lang) or GAME['EN']
    rarity = str(rarity or '').strip()
    series = str(series or '').strip()
    name = str(name or '').strip()
    eid = str(eid or '').strip()
    if lang == 'EN':
        if kind == 'stage':
            shown = name or f'Stage {eid}'
            desc = f'{shown} is a stage in {game}.'
            title_name = name or f'Stage {eid}'
        elif not name:
            desc = f'{title_label} {eid} in {game} — GGen Eternal Database.'
            title_name = f'{title_label} {eid}'
        else:
            rarity_bit = f'{rarity} ' if rarity else ''
            if series:
                desc = f'{name} is a {rarity_bit}{label} from {series} in {game}.'
            elif rarity:
                desc = f'{name} is a {rarity} {label} in {game}.'
            else:
                desc = f'{name} is a {label} in {game}.'
            title_name = name
        return f'{title_name} — {title_label} | GGen Eternal Database', desc
    shown = name or f'{title_label} {eid}'
    if lang == 'JA':
        if kind == 'stage':
            desc = f'{shown}は「{game}」のステージです。'
        elif rarity and series:
            desc = f'{shown}は「{game}」の{rarity}{label}です。シリーズ：{series}。'
        elif rarity:
            desc = f'{shown}は「{game}」の{rarity}{label}です。'
        elif series:
            desc = f'{shown}は「{game}」の{label}です。シリーズ：{series}。'
        else:
            desc = f'{shown}は「{game}」の{label}です。'
        return f'{shown} — {title_label} | GGen Eternal Database', desc
    if lang == 'KR':
        rarity_bit = f'{rarity} ' if rarity else ''
        if kind == 'stage':
            desc = f'{shown} — 「{game}」 스테이지.'
        elif series:
            desc = f'{shown} — 「{game}」 {rarity_bit}{label}. 시리즈: {series}.'
        else:
            desc = f'{shown} — 「{game}」 {rarity_bit}{label}.'
        return f'{shown} — {title_label} | GGen Eternal Database', desc
    if kind == 'stage':
        desc = f'{shown}是《{game}》的關卡。'
    elif rarity and series:
        desc = f'{shown}是《{game}》的{rarity}{label}，所屬系列：{series}。'
    elif rarity:
        desc = f'{shown}是《{game}》的{rarity}{label}。'
    elif series:
        desc = f'{shown}是《{game}》的{label}，所屬系列：{series}。'
    else:
        desc = f'{shown}是《{game}》的{label}。'
    return f'{shown} — {title_label} | GGen Eternal Database', desc


def gacha_pool_meta(lang, eid):
    lang = normalize_lang(lang)
    game = GAME[lang]
    eid = str(eid or '').strip()
    if lang == 'EN':
        return (
            f'Gacha {eid} — GGen Eternal Database',
            f'Unit Assembly simulator pool {eid} for {game}, using the official proportion table.',
        )
    if lang == 'JA':
        return (
            f'ガチャ {eid} — GGen Eternal Database',
            f'「{game}」ガチャシミュのプール {eid}。公式の排出割合表を使用。',
        )
    if lang == 'KR':
        return (
            f'가챠 {eid} — GGen Eternal Database',
            f'「{game}」 가챠 시뮬 풀 {eid}. 공식 배출 비율표.',
        )
    return (
        f'機體補給 {eid} — GGen Eternal Database',
        f'《{game}》機體補給模擬卡池 {eid}，使用官方機率表。',
    )
