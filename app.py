import os

# Load .env from project folder (optional). Use this on a VPS, or pair with hosting "Environment" UI.
# PowerShell $env:... only applies to that local terminal — your online server needs vars set THERE (or .env).
try:
    from dotenv import load_dotenv
    # override=True: values in .env win over empty/stale Windows user env vars.
    # encoding=utf-8-sig: strips UTF-8 BOM so the first line is not \ufeffLATEST_...
    _env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    load_dotenv(_env_path, override=True, encoding='utf-8-sig')
except ImportError:
    pass

from flask import Flask, render_template, jsonify, request, make_response, session
import json
import re
import math
import hashlib
import sys
import secrets
import time
from datetime import datetime, timezone, timedelta
try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None  # pragma: no cover

app = Flask(__name__)

# Sessions (Latest Release password gate). Set FLASK_SECRET_KEY in production.
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'ggen-dev-secret-change-in-production')
if os.environ.get('FLASK_SESSION_SECURE', '').lower() in ('1', 'true', 'yes'):
    app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Latest Release: set LATEST_RELEASE_PASSWORD to require unlock + per-session watermark id.
LATEST_RELEASE_PASSWORD = (os.environ.get('LATEST_RELEASE_PASSWORD') or '').strip()
# Optional test pins: lock a specific schedule Id or exact StartDatetime (epoch ms) even if "now" is past start.
LATEST_RELEASE_TEST_LOCK_SCHEDULE_ID = (os.environ.get('LATEST_RELEASE_TEST_LOCK_SCHEDULE_ID') or '').strip()
_ts = (os.environ.get('LATEST_RELEASE_TEST_LOCK_START_MS') or '').strip()
LATEST_RELEASE_TEST_LOCK_START_MS = int(_ts) if _ts.isdigit() else None
# When true (default): also lock any schedule whose StartDatetime is still in the future.
# Set to 0/false to lock ONLY test pins (LATEST_RELEASE_TEST_LOCK_SCHEDULE_ID / _START_MS), not all future gachas.
_prel = (os.environ.get('LATEST_RELEASE_LOCK_FUTURE_STARTS') or '1').strip().lower()
LATEST_RELEASE_LOCK_FUTURE_STARTS = _prel not in ('0', 'false', 'no', 'off')
# NPC visibility lock (separate from Latest Release): set NPC_VIEW_PASSWORD to require unlock before NPC rows/details are shown.
NPC_VIEW_PASSWORD = (os.environ.get('NPC_VIEW_PASSWORD') or '').strip()
# JP mode lock (separate): set JP_MODE_PASSWORD to require unlock before using JP/JA language mode.
JP_MODE_PASSWORD = (os.environ.get('JP_MODE_PASSWORD') or '').strip()

# ═══════════════════════════════════════════════════════
# IMAGE CDN CONFIGURATION & FILE INDEX
# ═══════════════════════════════════════════════════════

IMAGE_CDN = os.environ.get('IMAGE_CDN', '').rstrip('/')

def convert_image_urls(obj):
    """Recursively replace /static/images/ paths with CDN URLs in API responses."""
    if not IMAGE_CDN:
        return obj
    if isinstance(obj, str):
        if obj.startswith('/static/images/'):
            return IMAGE_CDN + '/images/' + obj[len('/static/images/'):]
        return obj
    elif isinstance(obj, dict):
        return {k: convert_image_urls(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_image_urls(item) for item in obj]
    return obj

# Load the image map
IMAGE_INDEX_PATH = os.path.join(os.path.dirname(__file__), 'image_index.json')
IMAGE_INDEX = {}
if os.path.exists(IMAGE_INDEX_PATH):
    with open(IMAGE_INDEX_PATH, 'r') as f:
        IMAGE_INDEX = json.load(f)
    print(f"Loaded image index with {len(IMAGE_INDEX)} folders")
else:
    print("⚠ Warning: image_index.json not found")

STATIC_ROOT = os.path.join(os.path.dirname(__file__), 'static')
# (mtime, merged filenames) per folder — invalidated when static/<folder> changes
_PORTRAIT_FS_CACHE = {}


def _list_disk_image_files(rel_path):
    """List image filenames under static/<rel_path> (e.g. images/portraits)."""
    d = os.path.join(STATIC_ROOT, *rel_path.split('/'))
    if not os.path.isdir(d):
        return []
    out = []
    try:
        for fn in os.listdir(d):
            if fn.startswith('.') or fn.startswith('_'):
                continue
            low = fn.lower()
            if low.endswith(('.webp', '.png', '.jpg', '.jpeg')):
                out.append(fn)
    except OSError:
        return []
    return out


def _merged_portrait_files(portrait_folder_key):
    """Merge image_index.json with files on disk for character portraits only. Unit portraits use the index only."""
    indexed = IMAGE_INDEX.get(portrait_folder_key, []) or []
    if portrait_folder_key != 'images/portraits':
        return indexed
    d = os.path.join(STATIC_ROOT, *portrait_folder_key.split('/'))
    try:
        mtime = os.path.getmtime(d)
    except OSError:
        mtime = 0
    cached = _PORTRAIT_FS_CACHE.get(portrait_folder_key)
    if cached and cached[0] == mtime:
        return cached[1]
    disk = _list_disk_image_files(portrait_folder_key)
    seen = set()
    merged = []
    for fn in indexed + disk:
        if fn not in seen:
            seen.add(fn)
            merged.append(fn)
    _PORTRAIT_FS_CACHE[portrait_folder_key] = (mtime, merged)
    return merged


# m_series Id (SeriesId from sets) -> 4-digit logo pad from ResourceId "series_XXXX" (filled after m_series.json load)
M_SERIES_ID_TO_LOGO_PAD = {}

# ═══════════════════════════════════════════════════════
# LANGUAGE CONFIGURATION
# ═══════════════════════════════════════════════════════

IS_LOCAL = os.path.exists(r"C:\Users\Mikew0911\Desktop\GGen_Database")

if IS_LOCAL:
    print("Running in LOCAL mode")
    LANG_CONFIG = {
        'EN': {
            'root': r"C:\Users\Mikew0911\Desktop\GGen_Database",
            'master_prefix': "MasterData_",
            'lang_prefix': "Lang_MasterData_"
        },
        'TW': {
            'root': r"C:\Users\Mikew0911\Desktop\GGen_TW",
            'master_prefix': "MasterData_",
            'lang_prefix': "Lang_MasterData_"
        },
        'HK': {
            'root': r"C:\Users\Mikew0911\Desktop\GGen_HK",
            'master_prefix': "MasterData_",
            'lang_prefix': "Lang_MasterData_HK_"
        },
        'JA': {
            'root': r"C:\Users\Mikew0911\Desktop\GGen_JA",
            'master_prefix': "MasterData_",
            'lang_prefix': "Lang_MasterData_"
        }
    }
else:
    print("Running in DEPLOYMENT mode")
    LANG_CONFIG = {
        'EN': {
            'master_dir': os.path.join(os.path.dirname(__file__), 'data', 'EN', 'master'),
            'lang_dir': os.path.join(os.path.dirname(__file__), 'data', 'EN', 'lang'),
        },
        'TW': {
            'master_dir': os.path.join(os.path.dirname(__file__), 'data', 'TW', 'master'),
            'lang_dir': os.path.join(os.path.dirname(__file__), 'data', 'TW', 'lang'),
        },
        'HK': {
            'master_dir': os.path.join(os.path.dirname(__file__), 'data', 'HK', 'master'),
            'lang_dir': os.path.join(os.path.dirname(__file__), 'data', 'HK', 'lang'),
        },
        'JA': {
            'master_dir': os.path.join(os.path.dirname(__file__), 'data', 'JA', 'master'),
            'lang_dir': os.path.join(os.path.dirname(__file__), 'data', 'JA', 'lang'),
        }
    }

DEFAULT_LANG = 'EN'
CALC_LANG = 'EN'

# ═══════════════════════════════════════════════════════
# UI LABEL TRANSLATIONS
# ═══════════════════════════════════════════════════════

UI_LABELS = {
    'EN': {
        'restriction_before_moving': 'Useable only before moving.',
        'restriction_tension_max': 'Can be used at Tension Max or greater.',
        'restriction_mp': 'Can be used when consuming {} MP.',
        'restriction_hp': 'Can be used when consuming {}% HP.',
        'stage_recommended_cp': 'Recommended CP: {}', 'stage_no_prefix': 'No. {}', 'sortie_group': 'Sortie Group {}',
        'restriction_applies_unit': 'Applies to Units', 'restriction_applies_both': 'Applies to Units & Characters',
        'terrain_space': 'Space', 'terrain_atmospheric': 'Atmospheric', 'terrain_ground': 'Ground', 'terrain_amphibious': 'Amphibious', 'terrain_unknown': 'Unknown',
        'victory_conditions': 'Victory Conditions', 'defeat_conditions': 'Defeat Conditions', 'none': 'None',
        'difficulty_normal': 'Normal', 'difficulty_hard': 'Hard', 'difficulty_expert': 'Expert',
    },
    'TW': {
        'restriction_before_moving': '僅限移動前使用。',
        'restriction_tension_max': '鬥志Max以上時可使用。',
        'restriction_mp': '消耗{}MP時可使用。',
        'restriction_hp': '消耗{}%HP時可使用。',
        'stage_recommended_cp': '推薦戰力：{}', 'stage_no_prefix': 'No. {}', 'sortie_group': '出擊群組 {}',
        'restriction_applies_unit': '僅適用於機體', 'restriction_applies_both': '適用於機體與角色',
        'terrain_space': '宇宙', 'terrain_atmospheric': '空中', 'terrain_ground': '地上', 'terrain_amphibious': '水陸', 'terrain_unknown': '未知',
        'victory_conditions': '勝利條件', 'defeat_conditions': '敗北條件', 'none': '無',
        'difficulty_normal': '普通', 'difficulty_hard': '困難', 'difficulty_expert': '專家',
    },
    'JA': {
        'restriction_before_moving': '移動前のみ使用可能。',
        'restriction_tension_max': 'テンションMax以上で使用可能。',
        'restriction_mp': '{}MP消費時に使用可能。',
        'restriction_hp': '{}%HP消費時に使用可能。',
        'stage_recommended_cp': '推奨戦力: {}', 'stage_no_prefix': 'No. {}', 'sortie_group': '出撃グループ {}',
        'restriction_applies_unit': '機体に適用', 'restriction_applies_both': '機体とキャラに適用',
        'terrain_space': '宇宙', 'terrain_atmospheric': '空中', 'terrain_ground': '地上', 'terrain_amphibious': '水陸', 'terrain_unknown': '不明',
        'victory_conditions': '勝利条件', 'defeat_conditions': '敗北条件', 'none': 'なし',
        'difficulty_normal': '通常', 'difficulty_hard': 'ハード', 'difficulty_expert': 'エキスパート',
    }
}
UI_LABELS['HK'] = dict(UI_LABELS['TW'])
UNIT_ROLE_TYPE_LANG_MAP = {'EN': {'1': 'Attack Type', '2': 'Defense Type', '3': 'Support Type'}, 'TW': {'1': '攻擊型', '2': '耐久型', '3': '支援型'}, 'JA': {'1': '攻撃型', '2': '耐久型', '3': '支援型'}}
UNIT_ROLE_TYPE_LANG_MAP['HK'] = dict(UNIT_ROLE_TYPE_LANG_MAP['TW'])
ROLE_NAME_MAP_CHARS = {'EN': {'Attack': 'Attack', 'Defense': 'Defense', 'Support': 'Support'}, 'TW': {'Attack': '攻擊型', 'Defense': '耐久型', 'Support': '支援型'}, 'JA': {'Attack': '攻撃型', 'Defense': '耐久型', 'Support': '支援型'}}
ROLE_NAME_MAP_CHARS['HK'] = dict(ROLE_NAME_MAP_CHARS['TW'])
STAGE_TERRAIN_MAP = {'1': {'EN': 'Space', 'TW': '宇宙', 'JA': '宇宙'}, '2': {'EN': 'Atmospheric', 'TW': '空中', 'JA': '空中'}, '3': {'EN': 'Ground', 'TW': '地上', 'JA': '地上'}, '5': {'EN': 'Amphibious', 'TW': '水陸', 'JA': '水陸'}}
for _tid in STAGE_TERRAIN_MAP:
    STAGE_TERRAIN_MAP[_tid]['HK'] = STAGE_TERRAIN_MAP[_tid]['TW']

def get_ui_label(lang_code, key):
    labels = UI_LABELS.get(lang_code, UI_LABELS[DEFAULT_LANG])
    return labels.get(key, UI_LABELS[DEFAULT_LANG].get(key, key))

def get_latest_folder(base_path, prefix):
    if not os.path.exists(base_path): return None
    candidates = [f for f in os.listdir(base_path) if f.startswith(prefix) and os.path.isdir(os.path.join(base_path, f))]
    if not candidates: return None
    candidates.sort(reverse=True)
    return os.path.join(base_path, candidates[0])

def get_lang_paths(lang_code):
    config = LANG_CONFIG.get(lang_code, LANG_CONFIG[DEFAULT_LANG])
    if IS_LOCAL:
        base_dir = get_latest_folder(config['root'], config['master_prefix'])
        lang_dir = get_latest_folder(config['root'], config['lang_prefix'])
    else:
        base_dir = config.get('master_dir')
        lang_dir = config.get('lang_dir')
    return base_dir, lang_dir

LANG_PATHS = {}
for lang_code in LANG_CONFIG:
    base_dir, lang_dir = get_lang_paths(lang_code)
    LANG_PATHS[lang_code] = {'base': base_dir, 'lang': lang_dir}
    print(f"{lang_code} - BASE_DIR: {base_dir}")
    print(f"{lang_code} - LANG_DIR: {lang_dir}")

# Fallback: if a language's root is missing, try same project with lang-specific prefix (as in GUI.py)
# e.g. TW: look for GGen_Database/MasterData_*/Lang_MasterData_TW_* so character/unit names can be translated
_ALT_LANG_PREFIX = {'TW': 'Lang_MasterData_TW_', 'HK': 'Lang_MasterData_HK_', 'JA': 'Lang_MasterData_JA_'}
app_dir = os.path.dirname(os.path.abspath(__file__))
bundled_lang = lambda lc: os.path.join(app_dir, 'data', lc, 'lang')
bundled_master = lambda lc: os.path.join(app_dir, 'data', lc, 'master')
for lang_code in LANG_CONFIG:
    if lang_code == DEFAULT_LANG:
        continue
    p = LANG_PATHS[lang_code]
    if not p['base'] or not p['lang']:
        en_base = LANG_PATHS[DEFAULT_LANG]['base']
        en_lang = LANG_PATHS[DEFAULT_LANG]['lang']
        alt_prefix = _ALT_LANG_PREFIX.get(lang_code)
        lang_dir = get_latest_folder(en_base, alt_prefix) if alt_prefix and en_base else None
        if lang_dir:
            print(f"  {lang_code}: using Lang_MasterData_{lang_code}_* fallback from EN base")
        if not lang_dir and os.path.isdir(bundled_lang(lang_code)):
            lang_dir = bundled_lang(lang_code)
            print(f"  {lang_code}: using bundled data fallback")
        LANG_PATHS[lang_code] = {'base': en_base, 'lang': lang_dir or en_lang}

# HK: prefer data/HK/lang when present; otherwise deployment uses TW strings until HK client export is added.
if 'HK' in LANG_PATHS and 'TW' in LANG_PATHS:
    twp = LANG_PATHS['TW']
    hk_data_lang = os.path.join(app_dir, 'data', 'HK', 'lang')
    if os.path.isdir(hk_data_lang):
        hm = os.path.join(app_dir, 'data', 'HK', 'master')
        LANG_PATHS['HK'] = {'base': hm if os.path.isdir(hm) else twp.get('base'), 'lang': hk_data_lang}
    elif not IS_LOCAL:
        LANG_PATHS['HK'] = {'base': twp.get('base'), 'lang': twp.get('lang')}
        print("  HK: data/HK/lang not found; using TW master/lang until HK bundle is added.")
    else:
        ph = LANG_PATHS['HK']
        hk_lang = ph.get('lang')
        hk_base = ph.get('base')
        lang_ok = hk_lang and os.path.isdir(hk_lang)
        base_ok = hk_base and os.path.isdir(hk_base)
        if not lang_ok or not base_ok:
            LANG_PATHS['HK'] = {'base': twp.get('base'), 'lang': twp.get('lang')}
            print("  HK: GGen_HK or Lang_MasterData_HK_* missing; using TW client data.")

BASE_DIR = LANG_PATHS['EN']['base']
if BASE_DIR is None:
    print("CRITICAL ERROR: EN base directory not found!")
    sys.exit(1)
if LANG_PATHS['EN']['lang'] is None:
    print("CRITICAL ERROR: EN language directory not found!")
    sys.exit(1)

def load_json(path):
    if not path or not os.path.exists(path): return None
    try:
        with open(path, 'r', encoding='utf-8') as f: return json.load(f)
    except Exception as e:
        print(f"Error loading {path}: {e}")
        return None

def extract_data_list(json_data):
    if json_data is None: return []
    if isinstance(json_data, dict):
        if "data" in json_data and isinstance(json_data["data"], list): return json_data["data"]
        return list(json_data.values())
    elif isinstance(json_data, list): return json_data
    return []

def safe_int(value, default=0):
    try: return int(value)
    except (TypeError, ValueError): return default

def format_start_datetime_jst(ms):
    """Format epoch milliseconds (UTC) as JST local time string."""
    if ms is None or ms <= 0:
        return ''
    try:
        if ZoneInfo is not None:
            dt = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).astimezone(ZoneInfo('Asia/Tokyo'))
        else:
            dt = datetime.utcfromtimestamp(ms / 1000.0) + timedelta(hours=9)
        return dt.strftime('%Y-%m-%d %H:%M:%S') + ' JST'
    except Exception:
        return ''

def normalize_id(value, default='0', debug_context=None):
    if value is None or value == '' or value == 'None': return default
    try:
        if isinstance(value, (int, float)): return str(int(value))
        elif isinstance(value, str):
            value = value.strip()
            if value == '' or value.lower() == 'none': return default
            try: return str(int(float(value)))
            except ValueError: return value
        return str(value)
    except (ValueError, TypeError): return default

# ═══════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════

RARITY_MAP = {'1': 'N', '2': 'R', '3': 'SR', '4': 'SSR', '5': 'UR'}
RARITY_SORT = {'5': 0, '4': 1, '3': 2, '2': 3, '1': 4}
RARITY_LETTERS = frozenset(RARITY_MAP.values())

# m_series Id=10 / ResourceId series_0010 — original "Mobile Suit Gundam" (1979). Used to add search alias `msg`
# so series:msg targets this series only, not every title containing "Gundam".
SERIES_ID_MOBILE_SUIT_GUNDAM = '10'
# m_series Id=130 — "Mobile Suit Gundam: The 08th MS Team". Display text uses "08th" so plain "08 ms" never
# substring-matches; add shorthand aliases for search (same idea as msg).
SERIES_ID_08TH_MS_TEAM = '130'

def jst_three_month_window_start_ms():
    """First instant of JST calendar month = (current month − 2), i.e. current + 2 prior months."""
    try:
        if ZoneInfo is None:
            return 0
        tz = ZoneInfo('Asia/Tokyo')
        now = datetime.now(tz)
        y, m = now.year, now.month
        m -= 2
        while m <= 0:
            m += 12
            y -= 1
        start = datetime(y, m, 1, 0, 0, 0, tzinfo=tz)
        return int(start.timestamp() * 1000)
    except Exception:
        return 0


def sort_latest_release_group_items(items):
    """
    By rarity tier (UR first). Within each tier:
    1) Units (name order), each followed immediately by its recommended character if present in this batch.
    2) Remaining characters at that tier.
    3) Supporters at that tier.
    """
    if not items:
        return []
    for it in items:
        ri = str(it.get('rarity_id', '1'))
        it['rarity_sort'] = RARITY_SORT.get(ri, 4)
    char_by_id = {it['id']: it for it in items if it['type'] == 'character'}
    units = [it for it in items if it['type'] == 'unit']
    supporters = [it for it in items if it['type'] == 'supporter']

    def _ek(it):
        return (it['type'], str(it['id']))

    emitted = set()
    out = []
    for tier in range(5):
        tier_units = [u for u in units if u['rarity_sort'] == tier and _ek(u) not in emitted]
        tier_units.sort(key=lambda x: x['name'].lower())
        for u in tier_units:
            out.append(u)
            emitted.add(_ek(u))
            rec = str(u.get('recommend_character_id') or '0')
            cit = char_by_id.get(rec)
            if cit and _ek(cit) not in emitted:
                out.append(cit)
                emitted.add(_ek(cit))
        tier_chars = [c for c in items if c['type'] == 'character' and c['rarity_sort'] == tier and _ek(c) not in emitted]
        tier_chars.sort(key=lambda x: x['name'].lower())
        for c in tier_chars:
            out.append(c)
            emitted.add(_ek(c))
        tier_supp = [s for s in supporters if s['rarity_sort'] == tier and _ek(s) not in emitted]
        tier_supp.sort(key=lambda x: x['name'].lower())
        for s in tier_supp:
            out.append(s)
            emitted.add(_ek(s))
    for it in items:
        if _ek(it) not in emitted:
            out.append(it)
            emitted.add(_ek(it))
    return out
ROLE_FILTER_IDS = frozenset({'1', '2', '3'})


def parse_list_rarity_filter(val):
    """Multi-select rarity for list APIs. None = all; set() = none; frozenset = legacy letter-only;
    tuple (letters, need_limited, need_ultimate) = UR/SSR/... plus optional LT (limited-time) and ULT filters."""
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    if s.upper() == '__NONE__':
        return set()
    parts = [p.strip().upper() for p in s.split(',') if p.strip()]
    if not parts:
        return None
    has_lt = 'LT' in parts
    has_ult = 'ULT' in parts
    letters = {p for p in parts if p in RARITY_LETTERS}
    if any(p not in RARITY_LETTERS and p not in ('LT', 'ULT') for p in parts):
        return set()
    if has_lt and has_ult and letters == RARITY_LETTERS:
        return None
    if letters == RARITY_LETTERS and not has_lt and not has_ult:
        return None
    if not letters and not has_lt and not has_ult:
        return set()
    return (frozenset(letters), has_lt, has_ult)


def row_matches_rarity_filter(rf, letter, is_limited, is_ultimate=False):
    """Apply parse_list_rarity_filter result."""
    if rf is None:
        return True
    if rf == set():
        return False
    if isinstance(rf, tuple):
        letters, need_lt, need_ult = rf
        if need_lt and not is_limited:
            return False
        if need_ult and not is_ultimate:
            return False
        if letters:
            return letter in letters
        return True
    return letter in rf


def rarity_filter_cache_fragment(rf):
    if rf is None:
        return 'all'
    if not rf:
        return 'none'
    if isinstance(rf, tuple):
        letters, need_lt, need_ult = rf
        core = ','.join(sorted(letters)) if letters else '*'
        frag = core
        if need_lt:
            frag += '_lt'
        if need_ult:
            frag += '_ult'
        return frag
    return ','.join(sorted(rf))


def parse_list_role_filter(val):
    """Multi-select role (1/2/3) for list APIs. None = all; set() = none; nonempty set = filter."""
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    if s.upper() == '__NONE__':
        return set()
    parts = [p.strip() for p in s.split(',') if p.strip()]
    if not parts:
        return None
    out = {p for p in parts if p in ROLE_FILTER_IDS}
    if not out:
        return set()
    if out == ROLE_FILTER_IDS:
        return None
    return out


def role_filter_cache_fragment(rf):
    if rf is None:
        return 'all'
    if not rf:
        return 'none'
    return ','.join(sorted(rf))


def parse_list_source_filter(val):
    """List filter by acquisition route bucket: assembly (1), development (2, non-NPC), other (rest).
    Comma-separated values = OR (e.g. development,other). All three selected = no filter (None)."""
    if val is None:
        return None
    s = (val or '').strip().lower()
    if not s or s == 'all':
        return None
    parts = [p.strip() for p in s.replace(';', ',').split(',') if p.strip()]
    if not parts:
        return None
    ok = []
    for p in parts:
        if p in ('assembly', 'development', 'other'):
            ok.append(p)
    if not ok:
        return None
    uniq = frozenset(ok)
    if len(uniq) == 3:
        return None
    if len(uniq) == 1:
        return next(iter(uniq))
    return uniq


def source_filter_cache_fragment(sf):
    if sf is None:
        return 'all'
    if isinstance(sf, (frozenset, set)):
        return 'src_' + '_'.join(sorted(str(x) for x in sf))[:80]
    return str(sf)


def entity_matches_source_category(acq_route, role_id, sf):
    """assembly = route index 1 (gacha). development = index 2 and not NPC (scout recruitment).
    Route 3 is the event-style bucket in master data; it stays in other, not development.
    other = everything else (including route 3). sf may be a single bucket string or a frozenset (OR)."""
    if sf is None:
        return True
    if isinstance(sf, (frozenset, set)):
        if not sf:
            return True
        return any(entity_matches_source_category(acq_route, role_id, x) for x in sf)
    acq = str(acq_route or '0').strip()
    rid = str(role_id or '0').strip()
    if sf == 'assembly':
        return acq == '1'
    if sf == 'development':
        return acq == '2' and rid != '0'
    if sf == 'other':
        if acq == '1':
            return False
        if acq == '2' and rid != '0':
            return False
        return True
    return True


def parse_list_lineage_filter(val):
    """Optional lineage/tag id(s); None = no filter. Comma-separated = OR (any tag). Keep string form for ids."""
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    parts = [p.strip() for p in s.replace(';', ',').split(',') if p.strip()]
    if not parts:
        return None
    if len(parts) == 1:
        return parts[0]
    return frozenset(parts)


def parse_list_ability_filter(val):
    """Ability filter expression.

    - comma between selected entries = AND across selections
    - pipe within one selection = OR across grouped lv-tier ids
    """
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    groups = []
    for token in [p.strip() for p in s.replace(';', ',').split(',') if p.strip()]:
        if '|' in token:
            opts = [x.strip() for x in token.split('|') if x.strip()]
            if not opts:
                continue
            if len(opts) == 1:
                groups.append(opts[0])
            else:
                groups.append(frozenset(opts))
        else:
            groups.append(token)
    if not groups:
        return None
    if len(groups) == 1:
        return groups[0]
    return tuple(groups)


def parse_unit_terrain_filter(val):
    """Unit terrain filter expression from query string.

    Accepts comma-separated "TerrainName:Level" pairs (AND semantics), e.g.
    "Space:3,Underwater:2". Only levels 2 and 3 are accepted.
    """
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    allowed_names = {'Space', 'Atmospheric', 'Ground', 'Sea', 'Underwater'}
    out = []
    seen = set()
    for token in [p.strip() for p in s.replace(';', ',').split(',') if p.strip()]:
        if ':' not in token:
            continue
        name_raw, lv_raw = token.split(':', 1)
        name = str(name_raw or '').strip().title()
        lv = str(normalize_id(lv_raw, '0')).strip()
        if name not in allowed_names:
            continue
        if lv not in ('2', '3'):
            continue
        k = (name, int(lv))
        if k not in seen:
            seen.add(k)
            out.append(k)
    if not out:
        return None
    return tuple(out)


def parse_list_series_filter(val):
    """Optional series id; None = no filter."""
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    return normalize_id(s)


def lineage_filter_cache_fragment(lid):
    if lid is None:
        return 'l0'
    if isinstance(lid, (frozenset, set, list, tuple)):
        if not lid:
            return 'l0'
        xs = sorted(str(x).replace('%', '')[:48] for x in lid)
        return 'l' + '__'.join(xs)[:220]
    return 'l' + str(lid).replace('%', '')[:48]


def ability_filter_cache_fragment(expr):
    if expr is None:
        return 'a0'

    def _ser(node):
        if isinstance(node, (frozenset, set)):
            xs = sorted(_ser(x) for x in node if str(x).strip())
            return '(' + '|'.join(xs) + ')'
        if isinstance(node, (list, tuple)):
            xs = [_ser(x) for x in node if str(x).strip()]
            return ','.join(xs)
        return str(node).replace('%', '')[:48]

    return ('a' + _ser(expr))[:220]


def unit_terrain_filter_cache_fragment(expr):
    if expr is None:
        return 't0'
    xs = []
    for name, lv in expr:
        xs.append(f'{name}:{int(lv)}')
    xs.sort()
    return ('t' + '__'.join(xs))[:220]



UNIT_WEAPON_DEBUFF_FILTER_KEYS = frozenset({
    'atk_dn', 'def_dn', 'mob_dn', 'acc_dn', 'eva_dn',
    'dmg_phys', 'dmg_beam', 'dmg_spec',
    'wp_phys', 'wp_beam', 'wp_spec',
    'range_beam', 'range_phys', 'range_all',
    'mp_1', 'mp_2', 'mp_3',
})

def parse_unit_weapon_debuff_filter(val):
    """Comma-separated weapon-trait debuff keys; AND semantics (unit must match every selected key)."""
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    out = []
    seen = set()
    for token in [p.strip() for p in s.replace(';', ',').split(',') if p.strip()]:
        if token not in UNIT_WEAPON_DEBUFF_FILTER_KEYS:
            continue
        if token not in seen:
            seen.add(token)
            out.append(token)
    if not out:
        return None
    return tuple(out)

def unit_weapon_debuff_filter_cache_fragment(expr):
    if expr is None:
        return 'w0'
    return ('w' + '__'.join(expr))[:220]

def iter_unit_weapon_trait_texts(uid, ld, lang_code):
    """Resolved weapon trait / SSP weapon effect lines (same coverage as collect_unit_weapons_search_text)."""
    for wp in unit_weapon_map.get(uid, []):
        wid = wp['id']
        wm = weapon_info_map.get(wid, {})
        ws = resolve_weapon_stats(
            wm, weapon_status_map, weapon_correction_map, ld['weapon_trait_map'], ld['weapon_capability_map'],
            growth_pattern_map, weapon_trait_change_map, ld['weapon_trait_detail_map'],
            wid=wid, lang_code=lang_code, unit_id=uid,
        )
        for tr in ws.get('traits', []) or []:
            if tr:
                yield str(tr)
        for lv in ws.get('levels', []) or []:
            for tr in lv.get('traits', []) or []:
                if tr:
                    yield str(tr)
        mwid = wm.get('main_weapon_id', '0')
        for cid2 in [wid, mwid]:
            if cid2 and cid2 != '0' and cid2 in unit_ssp_weapon_effect_map:
                for tid in unit_ssp_weapon_effect_map[cid2]:
                    tt2 = (ld.get('weapon_trait_detail_map', {}) or {}).get(tid, '')
                    if tt2:
                        yield str(tt2)
                break

def classify_unit_weapon_trait_debuff_keys(line):
    """Map one trait text line to debuff filter keys (language-mixed patterns)."""
    s = (line or '').strip()
    if not s:
        return frozenset()
    keys = set()
    sl = s.lower()

    if re.search(r'decrease\s+mp\s+by\s+1\.?', sl) or 'mpが1減少' in sl or re.search(r'mp減少1(?!\d)', sl) or re.search(r'decreased\s+mp\s+lv\s*1\b', sl) or re.search(r'mp減少\s*lv\s*1\b', sl):
        keys.add('mp_1')
    if re.search(r'decrease\s+mp\s+by\s+2\.?', sl) or 'mpが2減少' in sl or re.search(r'mp減少2(?!\d)', sl) or re.search(r'decreased\s+mp\s+lv\s*2\b', sl) or re.search(r'mp減少\s*lv\s*2\b', sl):
        keys.add('mp_2')
    if re.search(r'decrease\s+mp\s+by\s+3\.?', sl) or 'mpが3減少' in sl or re.search(r'mp減少3(?!\d)', sl) or re.search(r'decreased\s+mp\s+lv\s*3\b', sl) or re.search(r'mp減少\s*lv\s*3\b', sl):
        keys.add('mp_3')

    if (
        re.search(r'decreased\s+atk\b', sl)
        or re.search(r'\batk\s+down\b', sl)
        or '攻撃力減少' in s
        or '攻擊力減少' in s
        or re.search(r'攻撃力.*減少', s)
        or re.search(r'攻擊力.*減少', s)
    ):
        keys.add('atk_dn')
    if (
        re.search(r'decreased\s+def\b', sl)
        or re.search(r'\bdef\s+down\b', sl)
        or '防御力減少' in s
        or '防禦力減少' in s
        or re.search(r'防御力.*減少', s)
        or re.search(r'防禦力.*減少', s)
    ):
        keys.add('def_dn')
    if (
        re.search(r'decreased\s+mob\b', sl)
        or re.search(r'\bmob\s+down\b', sl)
        or '機動力減少' in s
        or re.search(r'機動力.*減少', s)
    ):
        keys.add('mob_dn')
    if (
        re.search(r'decreased\s+acc\b', sl)
        or re.search(r'\bacc\s+down\b', sl)
        or '命中率減少' in s
        or re.search(r'命中率.*減少', s)
    ):
        keys.add('acc_dn')
    if (
        re.search(r'decreased\s+eva\b', sl)
        or re.search(r'\beva\s+down\b', sl)
        or '回避率減少' in s
        or '閃避率減少' in s
        or re.search(r'回避率.*減少', s)
        or re.search(r'閃避率.*減少', s)
    ):
        keys.add('eva_dn')

    # "Damage taken from X up" *inflicted on the enemy* — not weapon stat lines like TW 物理損傷提升LV1 / JA 物理被ダメージアップLV1
    # (those raise *your* damage output; the same words are reused and must not match this filter).
    if (
        'damage taken from physical' in sl
        or '遭物理武裝攻擊時' in s
        or '物理武装による被ダメージ' in s
    ):
        keys.add('dmg_phys')
    if (
        'damage taken from beam' in sl
        or '遭光束武裝攻擊時' in s
        or 'ビーム武装による被ダメージ' in s
    ):
        keys.add('dmg_beam')
    if (
        'damage taken from special' in sl
        or '遭特殊武裝攻擊時' in s
        or '特殊武装による被ダメージ' in s
    ):
        keys.add('dmg_spec')

    if (
        'physical weapon power down' in sl
        or '物理武装パワーダウン' in s
        or re.search(r'物理武装POWER\d*%減少', s)
        or '物理武裝power下降' in sl
        or '物理武裝POWER下降' in s
        or '物理武裝power減少' in sl
        or '物理武裝POWER減少' in s
    ):
        keys.add('wp_phys')
    if (
        'beam weapon power down' in sl
        or 'ビーム武装パワーダウン' in s
        or re.search(r'ビーム武装POWER\d*%減少', s)
        or '光束武裝power下降' in sl
        or '光束武裝POWER下降' in s
        or '光束武裝power減少' in sl
        or '光束武裝POWER減少' in s
    ):
        keys.add('wp_beam')
    if (
        'special weapon power down' in sl
        or '特殊武装パワーダウン' in s
        or re.search(r'特殊武装POWER\d*%減少', s)
        or '特殊武裝power下降' in sl
        or '特殊武裝POWER下降' in s
        or '特殊武裝power減少' in sl
        or '特殊武裝POWER減少' in s
    ):
        keys.add('wp_spec')

    if (
        '光束武裝最大射程' in s
        or '光束武裝的最大射程' in s
        or 'ビーム武装最大射程' in s
        or 'beam weapons max range down' in sl
        or ('max range of beam' in sl and 'decrease' in sl)
        or 'ビーム武装の最大射程' in s
    ):
        keys.add('range_beam')
    elif (
        '物理武裝最大射程' in s
        or '物理武裝的最大射程' in s
        or '物理武装最大射程' in s
        or 'physical weapons max range down' in sl
        or ('max range of physical' in sl and 'decrease' in sl)
        or '物理武装の最大射程' in s
    ):
        keys.add('range_phys')
    elif (
        ('weapons max range down' in sl and 'beam weapons max range' not in sl and 'physical weapons max range' not in sl)
        or (('武装最大射程ダウン' in s or '武裝最大射程降低' in s) and 'ビーム武装' not in s and '物理武装' not in s and '光束' not in s and '物理武裝' not in s)
        or (
            'the max range of weapon is decrease' in sl
            or '武装の最大射程が' in s
            or ('武裝的最大射程減少' in s and '光束武裝' not in s and '物理武裝' not in s)
        )
    ):
        keys.add('range_all')

    return frozenset(keys)

def collect_unit_weapon_debuff_keys(uid, ld, lc):
    acc = set()
    for line in iter_unit_weapon_trait_texts(uid, ld, lc):
        acc |= set(classify_unit_weapon_trait_debuff_keys(line))
    return frozenset(acc)

def unit_matches_weapon_debuff_filter(uid, ld, lc, want_filter, _memo=None):
    if want_filter is None:
        return True
    if _memo is None:
        _memo = {}
    if uid not in _memo:
        _memo[uid] = collect_unit_weapon_debuff_keys(uid, ld, lc)
    have = _memo[uid]
    for k in want_filter:
        if k not in have:
            return False
    return True


def series_filter_cache_fragment(sid):
    if sid is None:
        return 's0'
    return 's' + str(sid)[:32]


def _entity_matches_one_lineage(lin_map, eid, want_lid):
    """Single lineage id match; want_lid is full lineage id from m_lineage; lin_map stores short ids."""
    want = str(want_lid).strip()
    for lid in lin_map.get(eid, []):
        ln = str(lid).strip()
        if ln == want:
            return True
        if len(ln) >= 4 and want.endswith(ln):
            return True
    return False


def entity_matches_lineage(lin_map, eid, want_lid):
    """want_lid: None | str | frozenset of str — AND semantics for multiple tags (entity must match every selected tag)."""
    if want_lid is None:
        return True
    if isinstance(want_lid, (frozenset, set, list, tuple)):
        if not want_lid:
            return True
        return all(_entity_matches_one_lineage(lin_map, eid, w) for w in want_lid)
    return _entity_matches_one_lineage(lin_map, eid, want_lid)


def entity_matches_series(ser_set_id, want_series_id, lc):
    if want_series_id is None:
        return True
    ws = normalize_id(want_series_id)
    for s in resolve_series(ser_set_id or '', lc):
        if normalize_id(s.get('id', '')) == ws:
            return True
    return False


def all_series_for_browse(ld):
    """Distinct series ids from series sets with localized names and icons."""
    ssm = ld.get('ser_set_map', {})
    sl = ld.get('series_list', [])
    seen = set()
    out = []
    for ids in ssm.values():
        for sid in ids:
            sid = normalize_id(sid)
            if not sid or sid == '0' or sid in seen:
                continue
            seen.add(sid)
            name = None
            for lid, val in sl:
                if lid.endswith(sid):
                    name = val
                    break
            if not name:
                name = sid
            icon = series_id_to_icon.get(sid, '') or find_series_icon(sid)
            out.append({'id': sid, 'name': name, 'icon': icon or ''})
    out.sort(key=lambda x: x['name'].lower())
    return out


def lineages_for_entity_browse(lin_map, ld):
    """Unique lineage tags used only by entities in lin_map (character vs unit). One row per short id."""
    llk = ld.get('lineage_lookup', {})
    ll = ld.get('lineage_list', [])
    short_ids = set()
    for lids in lin_map.values():
        for lid in lids:
            s = str(lid).strip()
            if s and s != '0':
                short_ids.add(s)
    rows = []
    for sid in short_ids:
        name = llk.get(sid)
        if not name:
            for fid, val in ll:
                if str(fid).endswith(sid) and len(sid) >= 4:
                    name = val
                    break
        if not name:
            name = sid
        full_id = sid
        for fid, val in ll:
            if str(fid).endswith(sid) and len(sid) >= 4:
                full_id = str(fid)
                break
        rows.append({'id': full_id, 'name': name})
    by_id = {}
    for r in rows:
        fid = str(r['id'])
        if fid not in by_id:
            by_id[fid] = r
    return sorted(by_id.values(), key=lambda x: x['name'].lower())


def _tag_id_list_matches_lineage_want(tag_ids, want_lid):
    """Match a wanted lineage id against tag ids from conditions (same rules as _entity_matches_one_lineage)."""
    want = str(want_lid).strip()
    for lid in tag_ids:
        ln = str(lid).strip()
        if ln == want:
            return True
        if len(ln) >= 4 and want.endswith(ln):
            return True
    return False


def supporter_leader_tag_ids(sid, ld, lang_code):
    """Lineage tag ids from tier-3 leader skill conditions for one supporter."""
    out = []
    lsr = supporter_leader_map.get(sid, [])
    llk = ld.get('lineage_lookup', {})
    snm = ld.get('series_name_map', {})
    for ls in lsr:
        if ls.get('tier') != 3:
            continue
        tags = resolve_condition_tags(
            ls.get('trait_cond_id', '0'), trait_condition_raw_map, llk, snm, lang_code
        )
        for t in tags:
            tid = str(t.get('id', '')).strip()
            if tid and tid != '0':
                out.append(tid)
    return out


def supporter_matches_lineage_filter(sid, want_lid, ld, lang_code):
    """AND semantics for multiple selected tags (same as entity_matches_lineage)."""
    if want_lid is None:
        return True
    if isinstance(want_lid, (frozenset, set, list, tuple)):
        if not want_lid:
            return True
        wants = want_lid
    else:
        wants = (want_lid,)
    tag_ids = supporter_leader_tag_ids(sid, ld, lang_code)
    return all(_tag_id_list_matches_lineage_want(tag_ids, w) for w in wants)


def lineages_for_supporter_browse(ld, lang_code):
    """Distinct lineage tags that appear on supporter leader skills (tier 3).

    Names come from resolve_condition_tags (same as in-game), not a second lookup by raw id
    (short ids like 600/10 fail len>=4 lineage_list matching and were shown as numbers).
    """
    llk = ld.get('lineage_lookup', {})
    ll = ld.get('lineage_list', [])
    snm = ld.get('series_name_map', {})
    by_id = {}
    for supp_id, info in supporter_info_map.items():
        if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
            continue
        lsr = supporter_leader_map.get(supp_id, [])
        for ls in lsr:
            if ls.get('tier') != 3:
                continue
            tags = resolve_condition_tags(
                ls.get('trait_cond_id', '0'), trait_condition_raw_map, llk, snm, lang_code
            )
            for t in tags:
                tid = str(t.get('id', '')).strip()
                if not tid or tid == '0':
                    continue
                nm = (t.get('name') or '').strip()
                full_id = tid
                for fid, val in ll:
                    fu = str(fid)
                    if len(tid) >= 4 and fu.endswith(tid):
                        full_id = fu
                        break
                    if len(tid) < 4 and fu.endswith(tid.zfill(4)):
                        full_id = fu
                        break
                if not nm:
                    nm = llk.get(tid) or llk.get(full_id)
                    if not nm:
                        for fid, val in ll:
                            fu = str(fid)
                            if fu.endswith(tid) or (len(tid) < 4 and fu.endswith(tid.zfill(4))):
                                nm = val
                                break
                if not nm:
                    nm = tid
                key = str(full_id)
                if key not in by_id:
                    by_id[key] = {'id': full_id, 'name': nm}
    return sorted(by_id.values(), key=lambda x: x['name'].lower())


def series_for_entity_browse(ld, entity):
    """Series that appear on characters or units only (via their series sets)."""
    ssm = ld.get('ser_set_map', {})
    sl = ld.get('series_list', [])
    if entity == 'characters':
        cmap = ld.get('char_ser_map', {})
    else:
        cmap = unit_ser_map
    seen = set()
    out = []
    for eid, set_id in cmap.items():
        if not set_id or set_id == '0':
            continue
        for sid in ssm.get(set_id, []):
            sid = normalize_id(sid)
            if not sid or sid == '0' or sid in seen:
                continue
            seen.add(sid)
            name = None
            for lid, val in sl:
                if lid.endswith(sid):
                    name = val
                    break
            if not name:
                name = sid
            icon = series_id_to_icon.get(sid, '') or find_series_icon(sid)
            out.append({'id': sid, 'name': name, 'icon': icon or ''})
    out.sort(key=lambda x: x['name'].lower())
    return out


ROLE_MAP = {'0': 'NPC', '1': 'Attack', '2': 'Defense', '3': 'Support'}
ROLE_SORT = {'1': 0, '2': 1, '3': 2, '0': 3}
GROWTH_MAP = {'1': 60, '2': 70, '3': 80, '4': 90, '5': 100}
TERRAIN_SYMBOLS = {'1': '-', '2': '▲', '3': '●'}
CHAR_STAT_ORDER = ['Ranged', 'Melee', 'Awaken', 'Defense', 'Reaction']
UNIT_STAT_ORDER = ['HP', 'EN', 'Attack', 'Defense', 'Mobility', 'Move']
# List API: sort by these columns using stat value as primary key (not rarity), so SP / SSP toggles reorder correctly.
LIST_STAT_SORT_PRIMARY = frozenset(
    ['Ranged', 'Melee', 'Awaken', 'Defense', 'Reaction', 'HP', 'EN', 'ATK', 'DEF', 'MOB', 'MOV']
)

TERRAIN_TYPE_ICON_MAP = {
    'Space': 'UI_Common_TerrainIcon_Space.png', 
    'Atmospheric': 'UI_Common_TerrainIcon_Sky.png',
    'Ground': 'UI_Common_TerrainIcon_Ground.png', 
    'Sea': 'UI_Common_TerrainIcon_Aquatic.png',
    'Underwater': 'UI_Common_TerrainIcon_Underwater.png',
}
TERRAIN_LEVEL_ICON_MAP = {
    3: 'UI_Common_TerrainIcon_Circle.png', 
    2: 'UI_Common_TerrainIcon_Triangle.png',
    1: 'UI_Common_TerrainIcon_Hyphen.png',
}
WEAPON_ATTR_MAP = {
    '1': {'label': 'Physical', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_02.png'},
    '2': {'label': 'Beam', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_01.png'},
    '3': {'label': 'Special', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_03.png'},
    '4': {'label': 'Beam/Physical', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.png'},
    '5': {'label': 'Physical/Special', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.png'},
    '6': {'label': 'Beam/Special', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.png'},
    '7': {'label': 'Beam/Physical/Special', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.png'},
    '8': {'label': 'Beam/Physical', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.png'},
}
MAP_WEAPON_ICON = '/static/images/WeaponIcon/UI_Common_WeaponIcon_map.png'
EX_WEAPON_OVERLAY = '/static/images/WeaponIcon/UI_Battle_Button_FooterList_IconBaseEX_MiniIcon.png'
ABILITY_FRAME_OVERLAY = '/static/images/Trait/UI_CharaAbilities_Tmb_Square_Normal_Frame.png'
DEFAULT_CORRECTION = {'power_rate': 120, 'en_rate': 90, 'hit_rate': 100, 'crit_rate': 100, 'map_ammo': 1}
ATTACK_ATTR_TYPES = {
    '1': [{'label': 'Ranged', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.png'}],
    '2': [{'label': 'Melee', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Attack_S.png'}],
    '3': [{'label': 'Awaken', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.png'}],
    '4': [{'label': 'Ranged', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.png'}, {'label': 'Melee', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Attack_S.png'}],
    '5': [{'label': 'Ranged', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.png'}, {'label': 'Awaken', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.png'}],
    '6': [{'label': 'Melee', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Attack_S.png'}, {'label': 'Awaken', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.png'}],
    '7': [{'label': 'Ranged', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.png'}, {'label': 'Melee', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Attack_S.png'}, {'label': 'Awaken', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.png'}],
}
MP_CONSUMPTION_WEAPON_IDS = {'120000395006': 5}
MP_CONSUMPTION_UNIT_EX = {'1330000750': 2}
HP_CONSUMPTION_UNIT_EX = {'1501002250': 10}
ACQUISITION_ROUTE_ICONS = {
    '1': '/static/images/UI/UI_Common_Icon_Source_Gasha.png',
    '2': '',
    '3': '/static/images/UI/UI_Common_Icon_Source_Event.png',
}
ULT_ICON = '/static/images/UI/UI_Common_Icon_ULT.png'
RARITY_ICON_MAP = {
    '1': '/static/images/Rarity/UI_Common_RarityIcon_N.png', 
    '2': '/static/images/Rarity/UI_Common_RarityIcon_R.png',
    '3': '/static/images/Rarity/UI_Common_RarityIcon_SR.png', 
    '4': '/static/images/Rarity/UI_Common_RarityIcon_SSR.png',
    '5': '/static/images/Rarity/UI_Common_RarityIcon_UR.png',
}
ROLE_ICON_MAP = {
    '1': '/static/images/UI/UI_Common_TypeIcon_Attack_M.png', 
    '2': '/static/images/UI/UI_Common_TypeIcon_Defense_M.png',
    '3': '/static/images/UI/UI_Common_TypeIcon_Support_M.webp',
}
EX_ABILITY_PATTERNS = ['ex character ability','ex機體能力','ex角色能力','exキャラクターアビリティ']
MECH_MAP_TABLE = {'1': ['1'], '2': ['2'], '3': ['1', '2'], '5': ['2x2', '4'], '6': ['1', '5'], '7': ['2x2', '6'], '8': ['1', '7'], '9': ['1', '6']}

def _is_conditional_stat_text(t):
    tl = (t or '').lower()
    for kw in ['when ', 'if ', 'during ', 'at the start', 'each time', 'every time', 'each time you', 'every time you']:
        if kw in tl: return True
    return False

def _unit_hp_threshold_active_at_assumed_full_hp(part):
    """
    Unit detail/list assume full HP for displayed stats. HP-gated bonuses that apply at high or full HP
    should count toward base (non-conditional) stats; only low-HP gates stay behind the conditional toggle.
    EN e.g. 'When HP is 50% or above', 'When HP is full'; TW e.g. '以上', '全滿'.
    Low HP: 'or below', '以下', 'when hp is below ...'
    """
    t = (part or '').strip()
    if not t:
        return False
    tl = t.lower()
    if 'hp' not in tl and '體力' not in t and '体力' not in t:
        return False
    if 'or below' in tl or '以下' in t:
        return False
    if re.search(r'\bwhen\s+hp\s+is\s+below\b', tl):
        return False
    if 'or above' in tl or '以上' in t:
        return True
    if re.search(r'\bwhen\s+hp\s+is\s+full\b', tl) or re.search(r'\bhp\s+is\s+full\b', tl):
        return True
    if '全滿' in t:
        return True
    return False

def _extract_stat_percent_unit(text, skip_conditional=True):
    bonuses = {}
    sn = r"(?:HP|Max HP|EN|Max EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move|Movement)"
    if skip_conditional and _is_conditional_stat_text(text): return bonuses
    m = re.search(fr"Increase (?:own )?(?:squad )?({sn})(?: and ({sn}))? by (\d+)%", text, re.IGNORECASE)
    if m:
        pct = int(m.group(3))
        up_to = re.search(r'[\(\s]up to (\d+)%', text, re.IGNORECASE)
        if up_to: pct = max(pct, int(up_to.group(1)))
        def norm(name):
            n = name.strip().title().replace("Max ", "")
            if n == "Hp": n = "HP"
            if n == "En": n = "EN"
            if n == "Movement": n = "Move"
            u = n.upper()
            if u in ["ATK", "ATTACK"]: n = "Attack"
            elif u == "DEF": n = "Defense"
            elif u == "MOB": n = "Mobility"
            return n
        n1 = norm(m.group(1)); bonuses[n1] = bonuses.get(n1, 0) + pct
        if m.group(2): n2 = norm(m.group(2)); bonuses[n2] = bonuses.get(n2, 0) + pct
    return bonuses

def _extract_stat_flat_move(text, skip_conditional=True):
    """Extract flat Move/MOV/Movement bonus (e.g. 'Increase own MOV by 1' or 'by1')."""
    if skip_conditional and _is_conditional_stat_text(text): return 0
    m = re.search(r"Increase\s+(?:own\s+)?(?:squad\s+)?(?:Move|Movement|MOV)\s+by\s*(\d+)(?!%)", text, re.IGNORECASE)
    return int(m.group(1)) if m else 0

def _extract_weapon_stat_percent_unit(text, skip_conditional=True):
    """Parse passive % bonuses that apply to weapon display (ACC, Critical, Power)."""
    bonuses = {}
    if skip_conditional and _is_conditional_stat_text(text):
        return bonuses
    tl = (text or '').strip()
    # "Increase own ACC and EVA by 5%" — ACC affects weapons; EVA does not
    m = re.search(r'Increase own (ACC|Accuracy) and (EVA|EVADE|Evasion) by (\d+)%', tl, re.IGNORECASE)
    if m:
        bonuses['Accuracy'] = bonuses.get('Accuracy', 0) + int(m.group(3))
        return bonuses
    # "Increase own ACC and Critical by 5%"
    m = re.search(r'Increase own (ACC|Accuracy) and (Critical|CRIT) by (\d+)%', tl, re.IGNORECASE)
    if m:
        p = int(m.group(3))
        bonuses['Accuracy'] = bonuses.get('Accuracy', 0) + p
        bonuses['Critical'] = bonuses.get('Critical', 0) + p
        return bonuses
    def _normw(x):
        if not x:
            return None
        u = re.sub(r'\.', '', x.strip()).upper()
        if u in ('ACC', 'ACCURACY'):
            return 'Accuracy'
        if u in ('CRITICAL', 'CRIT'):
            return 'Critical'
        if u == 'POWER':
            return 'Power'
        return None
    sn = r"(?:ACC|Accuracy|Critical|CRIT|Crit\.?|Power)"
    m = re.search(fr'Increase (?:own )?(?:squad )?({sn})(?: and ({sn}))? by (\d+)%', tl, re.IGNORECASE)
    if m:
        pct = int(m.group(3))
        n1 = _normw(m.group(1))
        if n1:
            bonuses[n1] = bonuses.get(n1, 0) + pct
        if m.group(2):
            n2 = _normw(m.group(2))
            if n2:
                bonuses[n2] = bonuses.get(n2, 0) + pct
    return bonuses

def is_ex_ability(name):
    if not name: return False
    name_lower = name.strip().lower()
    for pattern in EX_ABILITY_PATTERNS:
        if pattern in name_lower: return True
    return False

# ═══════════════════════════════════════════════════════
# CACHING
# ═══════════════════════════════════════════════════════

_api_cache = {}
_CACHE_MAX_SIZE = 500

def get_cached_response(cache_key): 
    return _api_cache.get(cache_key)

def set_cached_response(cache_key, data):
    if len(_api_cache) >= _CACHE_MAX_SIZE:
        for k in list(_api_cache.keys())[:100]: 
            del _api_cache[k]
    _api_cache[cache_key] = data

# ═══════════════════════════════════════════════════════
# IMAGE FINDING FUNCTIONS (using IMAGE_INDEX)
# ═══════════════════════════════════════════════════════

def find_portrait(resource_ids, entity_id, portrait_folder_key, debug_label=''):
    """
    Find portrait using IMAGE_INDEX. Character portraits also merge files on disk under static/images/portraits;
    unit portraits use image_index.json only (same as before the disk merge).
    portrait_folder_key: e.g., 'images/portraits' or 'images/unit_portraits'
    Game files often use cb_<ResourceId>.webp (characters) or ub_/ms_ (units); ResourceId alone is not the filename.
    Prefers filenames without ' #' (space+hash) suffix for CDN compatibility.
    """
    files = _merged_portrait_files(portrait_folder_key)
    if not files:
        return None
    files_set = set(files)
    files_by_lower = {f.lower(): f for f in files}

    def _static(fn):
        return f"/static/{portrait_folder_key}/{fn}"

    def _resolve_exact_filename(base):
        """Return canonical filename from index if base matches case-insensitively."""
        if base in files_set:
            return base
        lo = base.lower()
        return files_by_lower.get(lo)

    def _try_exact_resource_filename(rid):
        """Match disk names: cb_<rid>.ext, ub_<rid>.ext, ms_<rid>.ext, or <rid>.ext."""
        if not rid:
            return None
        rid = str(rid).strip()
        for ext in ('.webp', '.png', '.jpg', '.jpeg'):
            for prefix in ('cb_', 'ub_', 'ms_', ''):
                fn = f'{prefix}{rid}{ext}'
                hit = _resolve_exact_filename(fn)
                if hit:
                    return hit
        return None

    def pick_best(matches, rid_for_exact=None):
        """Prefer cb_<rid>.ext, then rid.ext, then other substring matches without ' #'."""
        if not matches:
            return None
        rle = (rid_for_exact or '').lower()
        if rle:
            cb_pref = f'cb_{rle}.'
            cb_ok = [m for m in matches if m.lower().startswith(cb_pref)]
            if cb_ok:
                cb_ok.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, x.lower()))
                return cb_ok[0]
            exact = [
                m for m in matches
                if m.lower().startswith(rle + '.') or m.lower() in (rle + '.webp', rle + '.png', rle + '.jpg', rle + '.jpeg')
            ]
            if exact:
                exact.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, x.lower()))
                return exact[0]
        clean = [m for m in matches if ' #' not in m]
        return clean[0] if clean else matches[0]

    candidates = []
    if isinstance(resource_ids, list):
        candidates = [str(r).strip() for r in resource_ids if r and str(r).strip() and str(r).strip() != '0']
    elif resource_ids:
        r = str(resource_ids).strip()
        if r and r != '0':
            candidates = [r]

    # 1) Exact filename from ResourceId (e.g. cb_g2300c00202.webp)
    for rid in candidates:
        hit = _try_exact_resource_filename(rid)
        if hit:
            return _static(hit)

    # 2) Substring on resource id (prefer cb_<rid> via pick_best)
    for rid in candidates:
        rl = rid.lower()
        matches = [fn for fn in files if rl in fn.lower()]
        best = pick_best(matches, rl)
        if best:
            return _static(best)

    # 3) Full entity id in filename (rare)
    if entity_id:
        eid = str(entity_id).strip()
        el = eid.lower()
        matches = [fn for fn in files if el in fn.lower()]
        best = pick_best(matches, el)
        if best:
            return _static(best)

        # 4) Long suffixes only — short suffixes (e.g. 4 chars "0202") match unrelated portraits
        # (e.g. cb_g0800c00202 when looking up character 1230000202).
        for slen in (10, 9, 8):
            if len(eid) < slen:
                continue
            suffix = eid[-slen:].lower()
            matches = [fn for fn in files if suffix in fn.lower()]
            best = pick_best(matches, suffix)
            if best:
                return _static(best)

    return None

def build_m_series_logo_pad_map(master_data):
    """Map m_series Id -> logo filename pad (ResourceId series_XXXX → XXXX).

    SeriesId in m_series_set points at m_series.Id; logos are named from ResourceId (e.g. Id 7001 → series_7000 → logo_l_series_7000).
    """
    out = {}
    for item in extract_data_list(master_data):
        if not isinstance(item, dict):
            continue
        mid = normalize_id(item.get('Id') or item.get('id'))
        rid = str(item.get('ResourceId') or item.get('resourceId') or '').strip()
        if mid == '0' or not rid:
            continue
        rm = re.match(r'^series_(\d+)$', rid, re.I)
        if rm:
            out[mid] = f'{int(rm.group(1)):04d}'
    return out

def _series_icon_path_from_pad(pad, files):
    """Return static path for logo_l_series_PAD.* or ''."""
    if not pad or not files:
        return ''
    pat = re.compile(r'_' + re.escape(pad) + r'\.(?:png|webp|jpg|jpeg)$', re.I)
    matches = [fn for fn in files if pat.search(fn)]
    if not matches:
        return ''
    matches.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, x.lower()))
    return f"/static/images/Logo-Series/{matches[0]}"

def find_series_icon(series_id):
    """Find series icon using IMAGE_INDEX + m_series ResourceId (series_XXXX).

    Logos match m_series.ResourceId (e.g. series_7000), not necessarily the numeric Id (e.g. 7001).
    """
    if not series_id or not IMAGE_INDEX:
        return ''
    
    raw = str(series_id).strip()
    if not raw or raw == '0':
        return ''

    files = IMAGE_INDEX.get('images/Logo-Series', []) or []
    if not files:
        return ''

    # Direct ResourceId string from master
    rm = re.match(r'^series_(\d+)$', raw, re.I)
    if rm:
        pad = f'{int(rm.group(1)):04d}'
        p = _series_icon_path_from_pad(pad, files)
        if p:
            return p

    sid = normalize_id(series_id)
    if not sid or sid == '0':
        return ''
    
    pad = None
    if sid in M_SERIES_ID_TO_LOGO_PAD:
        pad = M_SERIES_ID_TO_LOGO_PAD[sid]
    elif sid.isdigit():
        ts = sid[-4:] if len(sid) > 4 else sid
        try:
            pad = f'{int(ts):04d}'
        except ValueError:
            pad = None

    if pad:
        p = _series_icon_path_from_pad(pad, files)
        if p:
            return p

    # Non-numeric ids: substring fallback
    if not sid.isdigit():
        sl = sid.lower()
        for fn in files:
            if sl in fn.lower():
                return f"/static/images/Logo-Series/{fn}"
        return ''

    # Legacy substring
    sl = sid.lower()
    for fn in files:
        if sl in fn.lower():
            return f"/static/images/Logo-Series/{fn}"
    
    return ''

def find_trait_icon(resource_id):
    """Find trait/ability icon using IMAGE_INDEX."""
    if not resource_id or str(resource_id) == '0':
        return None
    
    rl = str(resource_id).lower()
    
    # Check main trait folder
    for fn in IMAGE_INDEX.get('images/Trait', []):
        if rl in fn.lower():
            return fn
    
    # Check thum folder
    for fn in IMAGE_INDEX.get('images/Trait/thum', []):
        if rl in fn.lower():
            return f"thum/{fn}"
    
    return None


def _find_trait_thum_list_asset(resource_ids, entity_id):
    """images/Trait/thum/thum_<ResourceId>.* — list/grid prefers this over full cb_/ub_ portraits when present."""
    if not IMAGE_INDEX:
        return None
    files = IMAGE_INDEX.get('images/Trait/thum', []) or []
    if not files:
        return None
    files_by_lower = {f.lower(): f for f in files}
    candidates = []
    if isinstance(resource_ids, list):
        candidates = [str(r).strip() for r in resource_ids if r and str(r).strip() and str(r).strip() != '0']
    elif resource_ids:
        r = str(resource_ids).strip()
        if r and r != '0':
            candidates = [r]
    if entity_id:
        candidates.append(str(entity_id).strip())
    seen = set()
    for rid in candidates:
        if not rid or rid in seen:
            continue
        seen.add(rid)
        rl = rid.lower()
        for ext in ('.webp', '.png', '.jpg', '.jpeg'):
            hit = files_by_lower.get(f'thum_{rid}{ext}'.lower())
            if hit:
                return f"/static/images/Trait/thum/{hit}"
        matches = [fn for fn in files if fn.lower().startswith('thum_') and rl in fn.lower()]
        if matches:
            matches.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, x.lower()))
            return f"/static/images/Trait/thum/{matches[0]}"
    return None


def find_list_thumb(resource_ids, entity_id, portrait_folder_key):
    """List/grid thumbnails: Trait/thum (thum_<ResourceId>) first, then full portrait folder (cb_/ub_/ms_)."""
    if portrait_folder_key == 'images/unit_portraits':
        t = _find_trait_thum_list_asset(resource_ids, entity_id)
        if t:
            return t
        return find_portrait(resource_ids, entity_id, portrait_folder_key)
    if portrait_folder_key == 'images/portraits':
        t = _find_trait_thum_list_asset(resource_ids, entity_id)
        if t:
            return t
        return find_portrait(resource_ids, entity_id, portrait_folder_key)
    return None

def find_supporter_portrait(resource_id, supporter_id):
    """Find supporter thumbnail using IMAGE_INDEX (images/Trait/thum). For list view."""
    candidates = [str(resource_id).strip()] if resource_id and str(resource_id).strip() != '0' else []
    if supporter_id: candidates.append(str(supporter_id).strip())
    for rid in candidates:
        if not rid: continue
        rl = rid.lower()
        for fn in IMAGE_INDEX.get('images/Trait/thum', []):
            if rl in fn.lower():
                return f"/static/images/Trait/thum/{fn}"
    return None

def find_supporter_full_portrait(resource_id):
    """Find full supporter portrait (900x504) using IMAGE_INDEX (images/Supporters). For detail view."""
    if not resource_id or str(resource_id).strip() == '0' or not IMAGE_INDEX:
        return None
    rid = str(resource_id).strip().lower()
    expected = f"sb_{rid}.png"
    for fn in IMAGE_INDEX.get('images/Supporters', []):
        if fn.lower() == expected:
            return f"/static/images/Supporters/{fn}"
    for fn in IMAGE_INDEX.get('images/Supporters', []):
        if rid in fn.lower() and fn.lower().startswith('sb_'):
            return f"/static/images/Supporters/{fn}"
    return None

# ═══════════════════════════════════════════════════════
# DATA MAPPING FUNCTIONS
# ═══════════════════════════════════════════════════════

def create_name_lang_maps(master, text):
    id_map, text_map = {}, {}
    for item in extract_data_list(master):
        if isinstance(item, dict):
            eid = normalize_id(item.get('id') or item.get('Id'))
            lid = normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId'))
            if eid != '0' and lid != '0': id_map[eid] = lid
    for item in extract_data_list(text):
        if isinstance(item, dict):
            lid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('name') or item.get('Name') or item.get('text') or item.get('Text')
            if lid != '0' and val: text_map[lid] = val
    return id_map, text_map

def create_lineage_list(d):
    lst = []
    for item in extract_data_list(d):
        if isinstance(item, dict):
            rid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('name') or item.get('Name') or ''
            if rid != '0' and val: lst.append((rid, val))
    return lst

def create_lineage_lookup(d):
    lookup, entries = {}, []
    for item in extract_data_list(d):
        if isinstance(item, dict):
            rid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('name') or item.get('Name') or ''
            if rid != '0' and val: entries.append((rid, val)); lookup[rid] = val
    for rid, val in entries:
        for sl in [4,5,6,7,8]:
            if len(rid) >= sl:
                s = rid[-sl:]
                if s not in lookup: lookup[s] = val
    return lookup

def create_series_name_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if isinstance(item, dict):
            rid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('name') or item.get('Name') or item.get('text') or item.get('Text')
            if rid != '0' and val:
                lookup[rid] = val
                for sl in [4,5,6,7,8]:
                    if len(rid) >= sl:
                        s = rid[-sl:]
                        if s not in lookup: lookup[s] = val
    return lookup

def create_series_maps(master, set_data, text_data):
    char_ser_map, set_map, series_list = {}, {}, []
    for item in extract_data_list(master):
        if isinstance(item, dict):
            cid = normalize_id(item.get('id') or item.get('Id')); sid = normalize_id(item.get('SeriesSetId') or item.get('seriesSetId'))
            if cid != '0' and sid != '0': char_ser_map[cid] = sid
    temp = {}
    for item in extract_data_list(set_data):
        if isinstance(item, dict):
            ssid = normalize_id(item.get('SeriesSetId')); sid = normalize_id(item.get('SeriesId')); sort = int(item.get('SortOrder') or 0)
            if ssid != '0' and sid != '0': temp.setdefault(ssid, []).append({'id': sid, 'sort': sort})
    for k, v in temp.items(): v.sort(key=lambda x: x['sort']); set_map[k] = [x['id'] for x in v]
    for item in extract_data_list(text_data):
        if isinstance(item, dict):
            rid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('name') or item.get('Name') or item.get('text') or item.get('Text')
            if rid != '0' and val: series_list.append((rid, val))
    return char_ser_map, set_map, series_list

def create_ability_maps(name_data, desc_data_lang):
    name_map, desc_map = {}, {}
    for item in extract_data_list(name_data):
        if isinstance(item, dict):
            rid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('name') or item.get('Name') or item.get('text') or item.get('Text')
            if rid != '0' and val: name_map[rid] = val; (len(rid) > 9 and name_map.update({rid[:-2][-7:]: val}))
    seen = set()
    for item in extract_data_list(desc_data_lang):
        if isinstance(item, dict):
            rid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('description') or item.get('Description') or item.get('text') or item.get('Text')
            if rid != '0' and val:
                val = str(val).replace("\\n", "\n")
                if (rid, val) in seen: continue
                seen.add((rid, val)); entry = {'text': val, 'full_id': rid}
                desc_map.setdefault(rid, []).append(entry)
                if len(rid) >= 9:
                    aid = rid[:-2][-7:]; desc_map.setdefault(aid, [])
                    if not any(x['full_id'] == rid for x in desc_map[aid]): desc_map[aid].append(entry)
    return name_map, desc_map

def create_trait_set_to_traits_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        set_id = normalize_id(item.get('TraitSetId') or item.get('traitSetId') or item.get('Id') or item.get('id'))
        trait_id = normalize_id(item.get('TraitId') or item.get('traitId'))
        sort = int(item.get('SortOrder') or item.get('sortOrder') or 0)
        if set_id != '0' and trait_id != '0': lookup.setdefault(set_id, []).append({'trait_id': trait_id, 'sort': sort})
    for k in lookup: lookup[k].sort(key=lambda x: x['sort']); lookup[k] = [x['trait_id'] for x in lookup[k]]
    return lookup

def create_trait_data_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        tid = normalize_id(item.get('Id') or item.get('id'))
        if tid == '0': continue
        lookup[tid] = {
            'desc_lang_id': normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId')),
            'active_cond_id': normalize_id(item.get('ActiveConditionSetId') or item.get('activeConditionSetId') or item.get('ActiveConditionId')),
            'target_cond_id': normalize_id(item.get('TargetConditionSetId') or item.get('targetConditionSetId') or item.get('TargetConditionId')),
            'boost_cond_id': normalize_id(item.get('TraitBoostConditionSetId') or item.get('traitBoostConditionSetId')),
        }
    return lookup

def create_lang_text_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        lid = normalize_id(item.get('id') or item.get('Id'))
        val = item.get('value') or item.get('Value') or item.get('description') or item.get('Description') or item.get('text') or item.get('Text') or item.get('name') or item.get('Name')
        if lid != '0' and val: lookup[lid] = str(val).replace("\\n", "\n")
    return lookup

def create_trait_condition_raw_map(d):
    raw = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('TraitConditionSetId') or item.get('traitConditionSetId') or item.get('Id') or item.get('id'))
        if sid == '0': continue
        if sid not in raw: raw[sid] = {'char_tags': [], 'unit_tags': [], 'group_tags': [], 'series': [], 'types': []}
        for key in ['UnitTags', 'unitTags']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v != '0' and v not in raw[sid]['unit_tags']: raw[sid]['unit_tags'].append(v)
        for key in ['CharacterTags', 'characterTags']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v != '0' and v not in raw[sid]['char_tags']: raw[sid]['char_tags'].append(v)
        for key in ['GroupTags', 'groupTags', 'GroupTag', 'groupTag']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v != '0' and v not in raw[sid]['group_tags']: raw[sid]['group_tags'].append(v)
        for key in ['UnitSeries', 'unitSeries']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v != '0' and v not in raw[sid]['series']: raw[sid]['series'].append(v)
        for key in ['UnitRoleTypes', 'unitRoleTypes']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v != '0' and v not in raw[sid]['types']: raw[sid]['types'].append(v)
    return raw

def merge_trait_condition_raw_maps(*maps):
    out = {}
    for mp in maps:
        if not isinstance(mp, dict):
            continue
        for sid, row in mp.items():
            if sid not in out:
                out[sid] = {'char_tags': [], 'unit_tags': [], 'group_tags': [], 'series': [], 'types': []}
            for k in ['char_tags', 'unit_tags', 'group_tags', 'series', 'types']:
                vals = row.get(k, []) if isinstance(row, dict) else []
                for v in vals:
                    if v and v not in out[sid][k]:
                        out[sid][k].append(v)
    return out

def resolve_condition_tags(cond_id, trait_condition_raw_map, lineage_lookup, series_name_map, lang_code='EN'):
    if cond_id == '0': return []
    raw = trait_condition_raw_map.get(cond_id, {}); res = []; seen = set()
    def at(tid, tn, tt, src=''):
        if tn and tn not in seen:
            res.append({'id': tid, 'name': tn, 'type': tt, 'source': src})
            seen.add(tn)
    def fn(tid, pm, sm=None):
        n = pm.get(tid)
        if not n and sm: n = sm.get(tid)
        if not n:
            p = tid.zfill(4)
            for k, v in pm.items():
                if k.endswith(p) or k == tid: return v
            if sm:
                for k, v in sm.items():
                    if k.endswith(p) or k == tid: return v
        return n
    for t in raw.get('unit_tags', []): n = fn(t, lineage_lookup, series_name_map); (n and at(t, n, 'unit', 'unit_tags'))
    for t in raw.get('char_tags', []): n = fn(t, lineage_lookup, series_name_map); (n and at(t, n, 'character', 'char_tags'))
    for t in raw.get('group_tags', []): n = fn(t, lineage_lookup, series_name_map); (n and at(t, n, 'group', 'group_tags'))
    for s in raw.get('series', []): n = fn(s, series_name_map); (n and at(s, n, 'series', 'series'))
    rtm = UNIT_ROLE_TYPE_LANG_MAP.get(lang_code, UNIT_ROLE_TYPE_LANG_MAP['EN'])
    for t in raw.get('types', []): n = rtm.get(t); (n and at('role_' + t, n, 'unit_role', 'types'))
    return res

def create_char_info_map(m):
    lookup = {}
    for item in extract_data_list(m):
        if isinstance(item, dict):
            cid = normalize_id(item.get('id') or item.get('Id'))
            if cid != '0':
                acq = normalize_id(item.get('CharacterAcquisitionRouteTypeIndex') or item.get('characterAcquisitionRouteTypeIndex'), '0')
                rids = []
                for rk in ['ResourceId','resourceId','CutInResourceId','cutInResourceId','BromideResourceId','bromideResourceId','IconResourceId','iconResourceId','VoiceResourceId','voiceResourceId','BattleMovieId','battleMovieId']:
                    rv = str(item.get(rk) or '').strip()
                    if rv and rv != '0' and rv not in rids: rids.append(rv)
                lookup[cid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'acquisition_route': acq, 'resource_ids': rids, 'schedule_id': normalize_id(item.get('ScheduleId') or item.get('scheduleId'), '0')}
    return lookup

def create_char_status_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if isinstance(item, dict):
            cid = normalize_id(item.get('CharacterId') or item.get('characterId') or item.get('id') or item.get('Id'))
            if cid != '0':
                def cv(k, mk, smk):
                    v = int(item.get(k) or 0); m = int(item.get(mk) or 0); sm = int(item.get(smk) or item.get(mk) or 0)
                    return (v, m, sm)
                lookup[cid] = {
                    'Ranged': cv('Ranged', 'MaxRanged', 'SpMaxRanged'),
                    'Melee': cv('Melee', 'MaxMelee', 'SpMaxMelee'),
                    'Defense': cv('Defense', 'MaxDefense', 'SpMaxDefense'),
                    'Reaction': cv('Reaction', 'MaxReaction', 'SpMaxReaction'),
                    'Awaken': cv('Awaken', 'MaxAwaken', 'SpMaxAwaken'),
                }
    return lookup

def create_char_lineage_link_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if isinstance(item, dict):
            cid = normalize_id(item.get('CharacterId') or item.get('characterId')); lid = normalize_id(item.get('LineageId') or item.get('lineageId'))
            if cid != '0' and lid != '0': lookup.setdefault(cid, []); (lid not in lookup[cid] and lookup[cid].append(lid))
    return lookup

def create_supporter_info_map(m):
    lookup = {}
    for item in extract_data_list(m):
        if isinstance(item, dict):
            s = normalize_id(item.get('id') or item.get('Id'))
            if s != '0':
                lookup[s] = {'rarity': normalize_id(item.get('RarityIndex') or item.get('rarityIndex'), '1'), 'hp_add': int(item.get('MaxHpAdditionValue') or item.get('maxHpAdditionValue') or 0), 'atk_add': int(item.get('MaxAttackAdditionValue') or item.get('maxAttackAdditionValue') or 0), 'resource_id': str(item.get('ResourceId') or item.get('resourceId') or ''), 'schedule_id': normalize_id(item.get('ScheduleId') or item.get('scheduleId'), '0')}
    return lookup

def create_supporter_growth_map(d):
    """(level, limit_break_step) -> ParameterCorrectionRateBasisPoint (10000=100%)"""
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        lv = int(item.get('Level') or item.get('level') or 1)
        lb = int(item.get('LimitBreakStep') or item.get('limitBreakStep') or 0)
        rate = int(item.get('ParameterCorrectionRateBasisPoint') or item.get('parameterCorrectionRateBasisPoint') or 10000)
        lookup[(lv, lb)] = rate
    return lookup

def create_supporter_leader_skill_map(d):
    """supporter_id -> list of {tier, desc_lang_id, trait_cond_id, sort}. tier 0-3 from set_id suffix.

    Two ID schemes exist in master data:
    - 00-03: last two digits are LB tier directly (e.g. 100100015000 = LB0).
    - 01-04: last two digits are 1-4; tier = that value minus 1 (e.g. ...120000035003 = LB2, ...004 = LB3).
    Detect 01-04 scheme when any set id for that supporter ends in '04' (see 120000035001-004).
    """
    items = []
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        si = str(item.get('SupporterLeaderSkillContentSetId') or item.get('supporterLeaderSkillContentSetId') or item.get('Id') or item.get('id') or '')
        if not si or len(si) < 2: continue
        sp = str(item.get('SupporterId') or item.get('supporterId') or si[:-2])
        items.append((sp, si, item))
    scheme2 = set()
    for sp, si, _ in items:
        if si.endswith('04'):
            scheme2.add(sp)
    lookup = {}
    for sp, si, item in items:
        last2 = int(si[-2:])
        if sp in scheme2:
            tier = last2 - 1
        else:
            tier = last2
            if tier > 3:
                tier = 3
        tier = max(0, min(3, tier))
        lookup.setdefault(sp, []).append({
            'tier': tier, 'set_id': si,
            'desc_lang_id': normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId')),
            'trait_cond_id': normalize_id(item.get('TraitConditionSetId') or item.get('traitConditionSetId')),
            'sort': int(item.get('SortOrder') or item.get('sortOrder') or 0)
        })
    for k in lookup:
        lookup[k].sort(key=lambda x: (x['tier'], x['sort']))
    return lookup

def create_supporter_active_skill_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sp = str(item.get('SupporterId') or item.get('supporterId') or str(item.get('Id') or item.get('id') or '')[:10])
        lookup.setdefault(sp, []).append({'name_lang_id': normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId')), 'desc_lang_id': normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId')), 'resource_id': str(item.get('ResourceId') or item.get('resourceId') or '')})
    return lookup

def create_stage_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('Id') or item.get('id'))
        if sid == '0': continue
        lookup[sid] = {'group1_set_id': normalize_id(item.get('Group1SortieRestrictionSetId') or item.get('group1SortieRestrictionSetId')), 'group2_set_id': normalize_id(item.get('Group2SortieRestrictionSetId') or item.get('group2SortieRestrictionSetId')), 'recommended_cp': safe_int(item.get('RecommendedCombatPower'), 0), 'terrain_type_index': normalize_id(item.get('StageTerrainTypeIndex') or item.get('stageTerrainTypeIndex')), 'battle_condition_set_id': normalize_id(item.get('StageBattleConditionSetId') or item.get('stageBattleConditionSetId'))}
    return lookup

def create_eternal_stage_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('StageId') or item.get('stageId') or item.get('Id') or item.get('id'))
        if sid == '0': continue
        lookup[sid] = {'stage_id': sid, 'stage_number': safe_int(item.get('StageNumber'), 0), 'stage_name_lang_id': normalize_id(item.get('StageNameLanguageId') or item.get('stageNameLanguageId')), 'display_unit_id': normalize_id(item.get('DisplayUnitId') or item.get('displayUnitId'))}
    return lookup

def create_stage_sortie_set_content_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        si = normalize_id(item.get('StageSortieRestrictionSetId') or item.get('stageSortieRestrictionSetId') or item.get('Id') or item.get('id'))
        if si == '0': continue
        lookup.setdefault(si, []).append({'target_type_index': normalize_id(item.get('SortieRestrictionTargetTypeIndex') or item.get('sortieRestrictionTargetTypeIndex')), 'group_id': normalize_id(item.get('StageSortieRestrictionSetGroupId') or item.get('stageSortieRestrictionSetGroupId')), 'sort_order': safe_int(item.get('SortOrder'), 0)})
    for k in lookup: lookup[k].sort(key=lambda x: x['sort_order'])
    return lookup

def create_stage_sortie_group_content_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        gid = normalize_id(item.get('StageSortieRestrictionSetGroupId') or item.get('stageSortieRestrictionSetGroupId') or item.get('Id') or item.get('id'))
        if gid == '0': continue
        lookup.setdefault(gid, []).append({'restriction_type_index': normalize_id(item.get('SortieRestrictionTypeIndex') or item.get('sortieRestrictionTypeIndex')), 'target_id': normalize_id(item.get('TargetId') or item.get('targetId')), 'sort_order': safe_int(item.get('SortOrder'), 0)})
    for k in lookup: lookup[k].sort(key=lambda x: x['sort_order'])
    return lookup

def create_stage_condition_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('StageBattleConditionSetId') or item.get('stageBattleConditionSetId'))
        if sid == '0': continue
        lookup.setdefault(sid, []).append({'category_type_index': normalize_id(item.get('CategoryTypeIndex') or item.get('categoryTypeIndex')), 'text_lang_id': normalize_id(item.get('TextLanguageId') or item.get('textLanguageId')), 'sort_order': safe_int(item.get('SortOrder') or item.get('sortOrder'), 0)})
    for k in lookup: lookup[k].sort(key=lambda x: x['sort_order'])
    return lookup

def create_map_stage_lookup(d):
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('StageId') or item.get('stageId'))
        mid = normalize_id(item.get('MapId') or item.get('mapId'))
        msid = normalize_id(item.get('Id') or item.get('id'))
        if sid != '0': lk[sid] = {'map_id': mid, 'map_stage_id': msid}
    return lk

def create_map_master_lookup(d):
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        mid = normalize_id(item.get('MapId') or item.get('Id') or item.get('id'))
        if mid != '0': lk[mid] = {'width': safe_int(item.get('Width'), 0), 'height': safe_int(item.get('Height'), 0)}
    return lk

def create_map_npc_lookup(d):
    lk, bms = {}, {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        nid = normalize_id(item.get('Id') or item.get('id') or item.get('MapNpcId'))
        msid = normalize_id(item.get('MapStageId') or item.get('mapStageId'))
        if nid == '0': continue
        bst = normalize_id(item.get('BattleSideTypeIndex') or item.get('battleSideTypeIndex') or '2')
        entry = {'id': nid, 'map_stage_id': msid, 'x': safe_int(item.get('X'), 0), 'y': safe_int(item.get('Y'), 0), 'battle_side_type': bst, 'npc_unique_name': str(item.get('NpcUniqueName') or item.get('npcUniqueName') or '').lower()}
        lk[nid] = entry
        if msid != '0': bms.setdefault(msid, []).append(entry)
    return lk, bms

def create_map_npc_unit_lookup(d):
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        nid = normalize_id(item.get('MapNpcId') or item.get('mapNpcId'))
        if nid == '0': continue
        lk.setdefault(nid, []).append({'number': safe_int(item.get('Number'), 0), 'unit_id': normalize_id(item.get('UnitId') or item.get('unitId')), 'level': safe_int(item.get('Level'), 0), 'hp': safe_int(item.get('Hp'), 0), 'en': safe_int(item.get('En'), 0), 'attack': safe_int(item.get('Attack'), 0), 'defense': safe_int(item.get('Defense'), 0), 'mobility': safe_int(item.get('Mobility'), 0), 'movement': safe_int(item.get('Movement'), 0), 'ability_set_id': normalize_id(item.get('MapNpcUnitAbilitySetId') or item.get('mapNpcUnitAbilitySetId')), 'weapon_set_id': normalize_id(item.get('MapNpcUnitWeaponSetId') or item.get('mapNpcUnitWeaponSetId'))})
    for k in lk: lk[k].sort(key=lambda x: x['number'])
    return lk

def create_map_npc_character_lookup(d):
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        nid = normalize_id(item.get('MapNpcId') or item.get('mapNpcId'))
        if nid == '0': continue
        lk.setdefault(nid, []).append({'number': safe_int(item.get('Number'), 0), 'character_id': normalize_id(item.get('CharacterId') or item.get('characterId')), 'level': safe_int(item.get('Level'), 0), 'ranged': safe_int(item.get('Ranged'), 0), 'melee': safe_int(item.get('Melee'), 0), 'defense': safe_int(item.get('Defense'), 0), 'reaction': safe_int(item.get('Reaction'), 0), 'awaken': safe_int(item.get('Awaken'), 0), 'ability_set_id': normalize_id(item.get('MapNpcCharacterAbilitySetId') or item.get('mapNpcCharacterAbilitySetId')), 'skill_set_id': normalize_id(item.get('MapNpcCharacterSkillSetId') or item.get('mapNpcCharacterSkillSetId'))})
    for k in lk: lk[k].sort(key=lambda x: x['number'])
    return lk

def create_simple_set_to_ids_map(d, skn, vkn):
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get(skn)); vid = normalize_id(item.get(vkn)); sort = safe_int(item.get('SortOrder'), 0)
        if sid != '0' and vid != '0': lk.setdefault(sid, []).append({'id': vid, 'sort': sort})
    for k in lk: lk[k].sort(key=lambda x: x['sort'])
    return lk

def create_map_npc_unit_weapon_set_lookup(d):
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('MapNpcUnitWeaponSetId') or item.get('mapNpcUnitWeaponSetId'))
        if sid == '0': continue
        lk.setdefault(sid, []).append({'weapon_id': normalize_id(item.get('WeaponId') or item.get('weaponId')), 'power': safe_int(item.get('Power'), 0), 'en': safe_int(item.get('En'), 0), 'hit_rate': safe_int(item.get('HitRate'), 0), 'critical_rate': safe_int(item.get('CriticalRate'), 0), 'range_min': safe_int(item.get('RangeMin'), 0), 'range_max': safe_int(item.get('RangeMax'), 0), 'sort_order': safe_int(item.get('SortOrder'), 0)})
    for k in lk: lk[k].sort(key=lambda x: x['sort_order'])
    return lk

def create_char_skill_info_map(d):
    lk = {}
    for item in extract_data_list(d):
        if isinstance(item, dict):
            s = normalize_id(item.get('Id') or item.get('id'))
            if s != '0': lk[s] = {'name_lang_id': normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId')), 'desc_lang_id': normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId')), 'resource_id': str(item.get('ResourceId') or item.get('resourceId') or '')}
    return lk

def create_skill_text_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        rid = normalize_id(item.get('id') or item.get('Id'))
        val = item.get('value') or item.get('Value') or item.get('name') or item.get('Name') or item.get('text') or item.get('Text')
        if rid != '0' and val:
            val = str(val).replace("\\n", "\n"); entry = {"full_id": rid, "text": val}; keys = {rid}
            for l in [6,7,8,9]:
                if len(rid) >= l: keys.add(rid[-l:])
            for k in keys:
                lookup.setdefault(k, [])
                if not any(x['full_id'] == rid for x in lookup[k]): lookup[k].append(entry)
    for k in lookup: lookup[k].sort(key=lambda x: x["full_id"])
    return lookup

def calc_growth_char(base, mx, ri):
    gr = GROWTH_MAP.get(str(ri), 60); return math.floor(base + ((mx - base) * gr / 100))

def extract_stat_percent_char(text):
    bonuses = {}; tl = text.lower()
    for kw in ['when piloting','when supporting','when executing','if vigor']:
        if kw in tl: return bonuses
    m = re.search(r"Increase (?:own )?(Melee|Ranged|Range|Defense|Reaction|Awaken|ATK|DEF)(?: and (Melee|Ranged|Range|Defense|Reaction|Awaken|ATK|DEF))? by (\d+)%", text, re.IGNORECASE)
    if m:
        for s in [m.group(1), m.group(2)]:
            if s:
                n = s.title(); u = n.upper()
                if u in ["ATK","ATTACK"]: n = "Melee"
                if u == "DEF": n = "Defense"
                if u == "RANGE": n = "Ranged"
                bonuses[n] = bonuses.get(n, 0) + int(m.group(3))
    return bonuses

def create_unit_info_map(m):
    lookup = {}
    for item in extract_data_list(m):
        if isinstance(item, dict):
            uid = normalize_id(item.get('id') or item.get('Id'))
            if uid != '0':
                ult_raw = item.get('IsUltimateDevelopment') or item.get('isUltimateDevelopment')
                is_ult = ult_raw is True or str(ult_raw).lower() == 'true' or ult_raw == 1 or str(ult_raw) == '1'
                acq = normalize_id(item.get('UnitAcquisitionRouteTypeIndex') or item.get('unitAcquisitionRouteTypeIndex'), '0')
                bid = str(item.get('BromideResourceId') or item.get('bromideResourceId') or '').strip()
                if bid == '0': bid = ''
                rids = []
                if bid: rids.append(bid)
                for rk in ['ResourceId','resourceId','CutInResourceId','cutInResourceId','IconResourceId','iconResourceId']:
                    rv = str(item.get(rk) or '').strip()
                    if rv and rv != '0' and rv not in rids: rids.append(rv)
                rec_raw = item.get('RecommendCharacterId') or item.get('recommendCharacterId')
                rec_cid = normalize_id(rec_raw) if rec_raw not in (None, '', 'None') else '0'
                lookup[uid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'model': str(item.get('ModelNumber') or item.get('modelNumber') or ''), 'series_set': normalize_id(item.get('SeriesSetId') or item.get('seriesSetId')), 'terrain_set': normalize_id(item.get('TerrainCapabilitySetId') or item.get('terrainCapabilitySetId')), 'mechanism_set_id': normalize_id(item.get('MechanismSetId') or item.get('mechanismSetId')), 'profile_lang_id': normalize_id(item.get('ProfileLanguageId') or item.get('profileLanguageId') or '0'), 'is_ultimate': is_ult, 'acquisition_route': acq, 'bromide_resource_id': bid, 'resource_ids': rids, 'recommend_character_id': rec_cid, 'schedule_id': normalize_id(item.get('ScheduleId') or item.get('scheduleId'), '0')}
    return lookup

def create_unit_status_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if isinstance(item, dict):
            uid = normalize_id(item.get('UnitId') or item.get('unitId') or item.get('id') or item.get('Id'))
            if uid != '0':
                mhp = int(item.get('MaxHp') or 0); spmhp = int(item.get('SpMaxHp') or item.get('MaxHp') or 0)
                men = int(item.get('MaxEn') or 0); spmen = int(item.get('SpMaxEn') or item.get('MaxEn') or 0)
                matk = int(item.get('MaxAttack') or 0); spmatk = int(item.get('SpMaxAttack') or item.get('MaxAttack') or 0)
                mdef = int(item.get('MaxDefense') or 0); spmdef = int(item.get('SpMaxDefense') or item.get('MaxDefense') or 0)
                mmob = int(item.get('MaxMobility') or 0); spmmob = int(item.get('SpMaxMobility') or item.get('MaxMobility') or 0)
                mmov = int(item.get('MaxMovement') or 0); spmmov = int(item.get('SpMaxMovement') or item.get('MaxMovement') or 0)
                lookup[uid] = {'HP': (int(item.get('Hp') or 0), mhp, spmhp), 'EN': (int(item.get('En') or 0), men, spmen), 'Attack': (int(item.get('Attack') or 0), matk, spmatk), 'Defense': (int(item.get('Defense') or 0), mdef, spmdef), 'Mobility': (int(item.get('Mobility') or 0), mmob, spmmob), 'Move': (mmov, spmmov)}
    return lookup

def create_terrain_map(d):
    lookup = {}
    def _norm_tier(v):
        try:
            n = int(v or 0)
        except Exception:
            n = 0
        # Master terrain tiers are 1..3. Coerce missing/invalid/0 to 1 (hyphen).
        if n < 1:
            return 1
        if n > 3:
            return 3
        return n
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('TerrainCapabilitySetId') or item.get('id') or item.get('Id'))
        if sid != '0':
            lookup[sid] = {
                'Space': _norm_tier(item.get('SpaceIndex')),
                'Atmospheric': _norm_tier(item.get('AtmosphericIndex')),
                'Ground': _norm_tier(item.get('GroundIndex')),
                'Sea': _norm_tier(item.get('SurfaceIndex')),
                'Underwater': _norm_tier(item.get('UnderwaterIndex')),
            }
    return lookup

def create_unit_lineage_link_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId')); lid = normalize_id(item.get('LineageId') or item.get('lineageId'))
        if uid != '0' and lid != '0': lookup.setdefault(uid, []); (lid not in lookup[uid] and lookup[uid].append(lid))
    return lookup

def create_option_parts_lineage_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        opid = normalize_id(item.get('OptionPartsId') or item.get('optionPartsId'))
        lid = normalize_id(item.get('LineageId') or item.get('lineageId'))
        if opid != '0' and lid != '0': lookup.setdefault(opid, []); (lid not in lookup[opid] and lookup[opid].append(lid))
    return lookup

def create_unit_ability_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId')); aid = normalize_id(item.get('AbilityId') or item.get('abilityId')); sort = int(item.get('SortOrder') or 0)
        if uid != '0' and aid != '0': lookup.setdefault(uid, []).append({'id': aid, 'sort': sort})
    for k in lookup: lookup[k].sort(key=lambda x: x['sort'])
    return lookup

def calc_growth_unit_base(base, mx, ri):
    gr = GROWTH_MAP.get(str(ri), 60); return math.floor(base + ((mx - base) * gr / 100))
def calc_growth_unit(base, mx, ri):
    grown = calc_growth_unit_base(base, mx, ri); return math.floor(grown * 1.4)

def extract_stat_bonus_unit(text, fs):
    bonuses = {}; tl = text.lower()
    for kw in ['when ','if ','during ','at the start']:
        if kw in tl: return bonuses
    sn = r"(?:HP|Max HP|EN|Max EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move|Movement)"
    m = re.search(fr"Increase (?:own )?({sn})(?: and ({sn}))? by (\d+)%", text, re.IGNORECASE)
    if m:
        pct = int(m.group(3))
        def norm(name):
            n = name.strip().title().replace("Max ","")
            if n == "Hp": n = "HP"
            if n == "En": n = "EN"
            if n == "Movement": n = "Move"
            u = n.upper()
            if u in ["ATK","ATTACK"]: n = "Attack"
            elif u == "DEF": n = "Defense"
            elif u == "MOB": n = "Mobility"
            return n
        def add(name):
            n = norm(name)
            if n == "Move": return
            base = fs.get(n, 0)
            if base > 0: bonuses[n] = bonuses.get(n, 0) + math.floor(base * pct / 100)
        add(m.group(1))
        if m.group(2): add(m.group(2))
    return bonuses

def create_unit_weapon_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId')); wid = normalize_id(item.get('WeaponId') or item.get('weaponId')); sort = int(item.get('SortOrder') or item.get('sortOrder') or 0)
        if uid != '0' and wid != '0': lookup.setdefault(uid, []).append({'id': wid, 'sort': sort})
    for k in lookup: lookup[k].sort(key=lambda x: x['sort'])
    return lookup

def create_weapon_master_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        wid = normalize_id(item.get('Id') or item.get('id'))
        if wid != '0':
            hp_cost = 0
            for hp_key in ['HpCostRate','hpCostRate','HpConsumptionRate','hpConsumptionRate','UseHpRate','useHpRate']:
                v = item.get(hp_key)
                if v is not None and str(v).strip() not in ('', '0', 'None'):
                    try: hp_cost = int(v); break
                    except (ValueError, TypeError): pass
            lookup[wid] = {'name_lang_id': normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId')), 'attribute': normalize_id(item.get('WeaponAttributeSetId') or item.get('weaponAttributeSetId')), 'weapon_type': normalize_id(item.get('WeaponTypeIndex') or item.get('weaponTypeIndex'), '1'), 'main_weapon_id': normalize_id(item.get('MainWeaponId') or item.get('mainWeaponId')), 'attack_attribute': normalize_id(item.get('AttackAttributeSetId') or item.get('attackAttributeSetId')), 'capability_set_id': normalize_id(item.get('WeaponCapabilitySetId') or item.get('weaponCapabilitySetId')), 'tension_type': normalize_id(item.get('TensionTypeIndex') or item.get('tensionTypeIndex'), '0'), 'hp_cost_rate': hp_cost}
    return lookup

def create_weapon_status_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('Id') or item.get('id'))
        if sid != '0':
            mr = str(item.get('MapWeaponEffectRange') or item.get('mapWeaponEffectRange') or '')
            co = [{'x': int(x), 'y': int(y)} for x, y in re.findall(r'\((-?\d+),\s*(-?\d+)\)', mr)]
            sr = str(item.get('MapWeaponShootingRange') or item.get('mapWeaponShootingRange') or '')
            sc = [{'x': int(x), 'y': int(y)} for x, y in re.findall(r'\((-?\d+),\s*(-?\d+)\)', sr)]
            id2 = bool(co and sc and len(co) == len(sc) and ({(c['x'], c['y']) for c in co} == {(c['x'], c['y']) for c in sc}))
            lookup[sid] = {'range_min': int(item.get('RangeMin') or item.get('rangeMin') or 0), 'range_max': int(item.get('RangeMax') or item.get('rangeMax') or 0), 'power': int(item.get('Power') or item.get('power') or 0), 'en': int(item.get('En') or item.get('en') or 0), 'hit_rate': int(item.get('HitRate') or item.get('hitRate') or 0), 'critical_rate': int(item.get('CriticalRate') or item.get('criticalRate') or 0), 'override_correction_id': normalize_id(item.get('OverrideWeaponStatusChangePatternSetId') or item.get('overrideWeaponStatusChangePatternSetId')), 'trait_correction_id': normalize_id(item.get('OverrideWeaponTraitChangePatternSetId') or item.get('overrideWeaponTraitChangePatternSetId')), 'growth_pattern_id': normalize_id(item.get('WeaponLevelGrowthPatternSetId') or item.get('weaponLevelGrowthPatternSetId')), 'map_coords': co, 'shooting_coords': sc, 'is_dash': id2}
    return lookup

def create_weapon_text_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if isinstance(item, dict):
            lid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('name') or item.get('Name') or item.get('text') or item.get('Text')
            if lid != '0' and val: lookup[lid] = val
    return lookup

def create_weapon_correction_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('WeaponStatusChangePatternSetId') or item.get('weaponStatusChangePatternSetId'))
        lv = int(item.get('CurrentWeaponLevel') or item.get('currentWeaponLevel') or 1)
        if sid != '0':
            lookup.setdefault(sid, {})[lv] = {'power_rate': int(item.get('PowerCorrectionRate') or item.get('powerCorrectionRate') or 100), 'en_rate': int(item.get('EnCorrectionRate') or item.get('enCorrectionRate') or 100), 'hit_rate': int(item.get('HitRateCorrectionRate') or item.get('hitRateCorrectionRate') or 100), 'crit_rate': int(item.get('CriticalRateCorrectionRate') or item.get('criticalRateCorrectionRate') or 100), 'map_ammo': int(item.get('MapWeaponAmmoCapacity') or item.get('mapWeaponAmmoCapacity') or 0)}
    return lookup

def create_growth_pattern_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('WeaponLevelGrowthPatternSetId') or item.get('weaponLevelGrowthPatternSetId') or item.get('Id') or item.get('id'))
        if sid == '0': continue
        tc = normalize_id(item.get('WeaponTraitChangePatternSetId') or item.get('weaponTraitChangePatternSetId'))
        sc = normalize_id(item.get('WeaponStatusChangePatternSetId') or item.get('weaponStatusChangePatternSetId'))
        if tc != '0' or sc != '0': lookup[sid] = {'trait_change_set_id': tc, 'status_change_set_id': sc}
    return lookup

def create_weapon_trait_change_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('WeaponTraitChangePatternSetId') or item.get('weaponTraitChangePatternSetId'))
        lv = int(item.get('CurrentWeaponLevel') or item.get('currentWeaponLevel') or 1)
        tid = normalize_id(item.get('WeaponTraitId') or item.get('weaponTraitId'))
        if sid != '0' and tid != '0':
            lookup.setdefault(sid, {}).setdefault(lv, [])
            if tid not in lookup[sid][lv]: lookup[sid][lv].append(tid)
    return lookup

def create_weapon_trait_detail_map(base_data, lang_dir):
    lang_text = {}
    ld = load_json(os.path.join(lang_dir, "m_weapon_trait.json"))
    if ld:
        for item in extract_data_list(ld):
            if not isinstance(item, dict): continue
            lid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('description') or item.get('Description') or item.get('text') or item.get('Text') or item.get('name') or item.get('Name')
            if lid != '0' and val: lang_text[lid] = str(val).replace("\\n", "\n")
    lookup = {}
    for item in extract_data_list(base_data):
        if not isinstance(item, dict): continue
        tid = normalize_id(item.get('Id') or item.get('id')); dlid = normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId'))
        if tid != '0' and dlid != '0':
            t_val = lang_text.get(dlid, '')
            if t_val: lookup[tid] = t_val
    return lookup

def create_mechanism_map(bd, ld):
    lt = {}
    for item in extract_data_list(ld):
        if isinstance(item, dict):
            lid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('text') or item.get('Text')
            if lid != '0' and val: lt[lid] = str(val).replace("\\n", "\n")
    lk = {}
    for item in extract_data_list(bd):
        if not isinstance(item, dict): continue
        mid = normalize_id(item.get('Id') or item.get('id'))
        sid = normalize_id(item.get('MechanismSetId') or item.get('mechanismSetId'))
        nid = normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId'))
        did = normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId'))
        rid = str(item.get('ResourceId') or item.get('resourceId') or '').strip()
        e = {'id': mid, 'resource_id': rid, 'name': lt.get(nid, "Unknown"), 'description': lt.get(did, "")}
        if mid != '0': lk.setdefault(mid, []).append(e)
        if sid != '0' and sid != mid: lk.setdefault(sid, []).append(e)
    return lk

def find_mechanism_icon(resource_id):
    """Find mechanism icon using IMAGE_INDEX."""
    if not resource_id or str(resource_id) == '0': return None
    rl = str(resource_id).lower()
    for fn in IMAGE_INDEX.get('images/mechanism', []):
        if rl in fn.lower(): return fn
    return None

def create_weapon_trait_map(base_dir, lang_dir):
    lookup, text_map = {}, {}
    for fn in ["m_weapon_trait.json","m_trait.json"]:
        ld = load_json(os.path.join(lang_dir, fn))
        if ld:
            for item in extract_data_list(ld):
                if isinstance(item, dict):
                    lid = normalize_id(item.get('id') or item.get('Id'))
                    val = item.get('value') or item.get('Value') or item.get('description') or item.get('Description') or item.get('text') or item.get('Text')
                    if lid != '0' and val: text_map[lid] = str(val).replace("\\n", "\n")
    for fn in ["m_weapon_trait.json","m_weapon_trait_change_pattern.json"]:
        bd = load_json(os.path.join(base_dir, fn))
        if not bd: continue
        for item in extract_data_list(bd):
            if not isinstance(item, dict): continue
            dlid = normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId') or item.get('TraitDescriptionLanguageId'))
            text = text_map.get(dlid)
            if not text:
                d2 = item.get('Description') or item.get('description')
                if d2 and isinstance(d2, str): text = d2.replace("\\n", "\n")
            if not text: continue
            keys = set()
            sid = normalize_id(item.get('WeaponTraitChangePatternSetId') or item.get('weaponTraitChangePatternSetId'))
            if sid != '0': keys.add(sid)
            fid = normalize_id(item.get('Id') or item.get('id'))
            if fid != '0':
                keys.add(fid)
                for tl in [2,4]:
                    if len(fid) > tl: keys.add(fid[:-tl])
            for k in keys: lookup.setdefault(k, []); (text not in lookup[k] and lookup[k].append(text))
    return lookup

def create_weapon_capability_map(base_dir, lang_dir):
    lookup, text_map = {}, {}
    ld = load_json(os.path.join(lang_dir, "m_weapon_capability_set.json"))
    if ld:
        for item in extract_data_list(ld):
            if isinstance(item, dict):
                lid = normalize_id(item.get('id') or item.get('Id'))
                val = item.get('value') or item.get('Value') or item.get('description') or item.get('Description') or item.get('text') or item.get('Text')
                if lid != '0' and val: text_map[lid] = str(val).replace("\\n", "\n")
    bd = load_json(os.path.join(base_dir, "m_weapon_capability_set.json"))
    if bd:
        for item in extract_data_list(bd):
            if not isinstance(item, dict): continue
            csid = normalize_id(item.get('WeaponCapabilitySetId') or item.get('weaponCapabilitySetId') or item.get('Id') or item.get('id'))
            if csid == '0': continue
            dlid = normalize_id(item.get('DamageCapabilityDescriptionLanguageId') or item.get('damageCapabilityDescriptionLanguageId'))
            lookup[csid] = text_map.get(dlid, "None") if dlid != '0' else "None"
    return lookup

def resolve_weapon_icon(wt, ai, ubr):
    if wt == '3': return {'icon': MAP_WEAPON_ICON, 'overlay': '', 'is_ex': False, 'is_map': True}
    if wt == '2':
        tf = find_trait_icon(ubr) if ubr else None
        return {'icon': f"/static/images/Trait/{tf}" if tf else '', 'overlay': EX_WEAPON_OVERLAY, 'is_ex': True, 'is_map': False}
    ai2 = WEAPON_ATTR_MAP.get(ai, {'label':'Unknown','icon':''})
    return {'icon': ai2['icon'], 'overlay': '', 'is_ex': False, 'is_map': False}

def resolve_weapon_stats(wm, wsm, wcm, wtm, wcam, gpm, wtcm, wtdm, wid='', lang_code='EN', unit_id=''):
    mwid = wm.get('main_weapon_id','0'); csid = wm.get('capability_set_id','0')
    tt = wm.get('tension_type','0'); wt = wm.get('weapon_type','1')
    dr = {'range_min':0,'range_max':0,'levels':[{'level':i,'power':0,'en':0,'accuracy':0,'critical':0,'ammo':0,'traits':[]} for i in range(1,6)],'usage_restrictions':[],'map_coords':[],'shooting_coords':[],'is_dash':False}
    tid = mwid if mwid != '0' else wid
    if tid == '0': return dr
    ws = wsm.get(tid)
    if not ws: return dr
    bp,be,bh,bc = ws.get('power',0),ws.get('en',0),ws.get('hit_rate',0),ws.get('critical_rate',0)
    rn,rx = ws.get('range_min',0),ws.get('range_max',0)
    csi = ws.get('override_correction_id','0'); tsi = ws.get('trait_correction_id','0'); gi = ws.get('growth_pattern_id','0')
    gd = {}; ug = gi and gi != '0'
    if ug: gd = gpm.get(gi, {})
    def def_corr(): return {'power_rate':100,'en_rate':100,'hit_rate':100,'crit_rate':100,'map_ammo':0}
    btl = []
    fids = []
    if wid and wid != '0': fids.extend([wid, wid[:-2] if len(wid) > 2 else None, wid[:-4] if len(wid) > 4 else None])
    if tid and tid != '0' and tid != wid: fids.extend([tid, tid[:-2] if len(tid) > 2 else None])
    for k in fids:
        if k and wtm.get(k): btl = wtm[k]; break
    levels = []
    for lv in range(1, 6):
        corr = def_corr()
        spi = '0'
        if csi and csi != '0': spi = csi
        elif ug: spi = gd.get('status_change_set_id','0')
        if spi != '0':
            pc = wcm.get(spi, {})
            lv_corr = pc.get(lv) if isinstance(pc, dict) else None
            if lv_corr: corr = lv_corr
        fp = math.floor(bp*corr.get('power_rate',100)/100); fe = math.floor(be*corr.get('en_rate',100)/100)
        fa = math.floor(bh*corr.get('hit_rate',100)/100); fc = math.floor(bc*corr.get('crit_rate',100)/100); ma = corr.get('map_ammo',0)
        tpi = '0'
        if tsi and tsi != '0': tpi = tsi
        elif ug: tpi = gd.get('trait_change_set_id','0')
        tl = []
        if tpi != '0':
            for ti in wtcm.get(tpi, {}).get(lv, []):
                d2 = wtdm.get(ti,'')
                if d2 and d2 not in tl: tl.append(d2)
        if not tl: tl = list(btl)
        levels.append({'level':lv,'power':fp,'en':fe,'accuracy':fa,'critical':fc,'ammo':ma,'traits':tl})
    if wt != '3':
        for lev in levels:
            lev['ammo'] = 0
    rest = []
    if wt == '3': rest.append(get_ui_label(lang_code, 'restriction_before_moving'))
    if tt == '4': rest.append(get_ui_label(lang_code, 'restriction_tension_max'))
    mpc = MP_CONSUMPTION_WEAPON_IDS.get(wid, 0)
    if mpc <= 0 and unit_id in MP_CONSUMPTION_UNIT_EX and wt == '2': mpc = MP_CONSUMPTION_UNIT_EX[unit_id]
    if mpc > 0: rest.append(get_ui_label(lang_code, 'restriction_mp').format(mpc))
    hp_rate = wm.get('hp_cost_rate', 0)
    if hp_rate <= 0 and unit_id in HP_CONSUMPTION_UNIT_EX and wt == '2': hp_rate = HP_CONSUMPTION_UNIT_EX[unit_id]
    if hp_rate > 0: rest.append(get_ui_label(lang_code, 'restriction_hp').format(hp_rate))
    if csid != '0':
        ct = wcam.get(csid, "None")
        if ct and ct != "None": rest.append(ct)
    mc = ws.get('map_coords', []); scc = ws.get('shooting_coords', []); isd = ws.get('is_dash', False)
    l5 = levels[4] if len(levels) >= 5 else levels[-1] if levels else {}
    return {'range_min':rn,'range_max':rx,'power':l5.get('power',0),'en':l5.get('en',0),'accuracy':l5.get('accuracy',0),'critical':l5.get('critical',0),'ammo':l5.get('ammo',0),'traits':l5.get('traits',[]),'levels':levels,'usage_restrictions':rest,'map_coords':mc,'shooting_coords':scc,'is_dash':isd}

def get_ability_name_for_search(ab_id, abil_name_map, abil_link_map):
    if not ab_id or ab_id == '0': return ''
    trait_set_id = abil_link_map.get(ab_id, ab_id)
    lookup_id = trait_set_id[:-2] if len(trait_set_id) > 2 else trait_set_id
    return abil_name_map.get(trait_set_id, abil_name_map.get(lookup_id, abil_name_map.get(ab_id, '')))

def collect_ability_search_text(aid, ld):
    """Ability name + trait / description text for substring search (list APIs)."""
    if not aid or aid == '0': return ''
    parts = []
    n = get_ability_name_for_search(str(aid), ld['abil_name_map'], abil_link_map)
    if n: parts.append(n)
    trait_set_id = abil_link_map.get(str(aid), str(aid))
    lookup_id = trait_set_id[:-2] if len(trait_set_id) > 2 else trait_set_id
    ltm = ld.get('lang_text_map', {})
    trait_ids = trait_set_traits_map.get(trait_set_id, trait_set_traits_map.get(lookup_id, []))
    for tid in trait_ids:
        t_data = trait_data_map.get(tid, {})
        dlid = t_data.get('desc_lang_id', '0')
        if dlid and dlid != '0':
            tx = (ltm.get(dlid, '') or '').strip()
            if tx: parts.append(tx)
    adm = ld.get('abil_desc_map', {})
    for key in (lookup_id, trait_set_id):
        if not key: continue
        for entry in adm.get(key, []) or []:
            if isinstance(entry, dict):
                t = (entry.get('text') or '').strip()
            else:
                t = str(entry).strip()
            if t: parts.append(t)
    return ' '.join(parts)

def collect_skill_search_text(sid, ld):
    """Skill name + description for substring search."""
    if not sid or sid == '0': return ''
    try:
        r = resolve_char_skill(str(sid), ld, 0, False)
    except Exception:
        return ''
    parts = [(r.get('name') or '').strip()]
    for d in r.get('details', []) or []:
        if isinstance(d, str) and d.strip():
            parts.append(d.strip())
    return ' '.join(x for x in parts if x)

def collect_unit_weapons_search_text(uid, ld, lang_code):
    """Weapon names, traits, usage restriction labels, attribute labels."""
    parts = []
    for wp in unit_weapon_map.get(uid, []):
        wid = wp['id']
        wm = weapon_info_map.get(wid, {})
        wn = (ld.get('weapon_text_map', {}) or {}).get(wm.get('name_lang_id', '0'), '')
        if wn: parts.append(wn)
        ai = wm.get('attribute', '0')
        ainfo = WEAPON_ATTR_MAP.get(ai, {})
        lab = ainfo.get('label', '')
        if lab: parts.append(lab)
        ws = resolve_weapon_stats(wm, weapon_status_map, weapon_correction_map, ld['weapon_trait_map'], ld['weapon_capability_map'], growth_pattern_map, weapon_trait_change_map, ld['weapon_trait_detail_map'], wid=wid, lang_code=lang_code, unit_id=uid)
        for ur in ws.get('usage_restrictions', []) or []:
            if ur: parts.append(str(ur))
        for tr in ws.get('traits', []) or []:
            if tr: parts.append(tr)
        for lv in ws.get('levels', []) or []:
            for tr in lv.get('traits', []) or []:
                if tr: parts.append(tr)
        mwid = wm.get('main_weapon_id', '0')
        for cid2 in [wid, mwid]:
            if cid2 and cid2 != '0' and cid2 in unit_ssp_weapon_effect_map:
                for tid in unit_ssp_weapon_effect_map[cid2]:
                    tt2 = (ld.get('weapon_trait_detail_map', {}) or {}).get(tid, '')
                    if tt2:
                        parts.append(tt2)
                break
    return ' '.join(parts)

def collect_unit_profile_search_text(info, ld):
    """Unit profile / flavor text + model number (same strings as collection book / detail)."""
    utm = ld.get('unit_text_map', {})
    parts = []
    plid = normalize_id(info.get('profile_lang_id') or '0')
    if plid and plid != '0':
        t = (utm.get(plid) or '').strip()
        if t:
            parts.append(t)
    m = info.get('model') or ''
    if m:
        parts.append(str(m))
    return ' '.join(parts)

def collect_unit_mechanism_search_text(info, ld):
    """Mechanism names and descriptions for list search."""
    msid = str(info.get('mechanism_set_id', '0'))
    mids = list(MECH_MAP_TABLE.get(msid, []))
    mm = ld.get('mechanism_map', {})
    parts = []
    for mid in mids:
        if mid == '2x2':
            parts.append('2x2')
            continue
        for rmm in mm.get(mid, []):
            if str(rmm.get('id')) == str(mid):
                n = (rmm.get('name') or '').strip()
                d = (rmm.get('description') or '').strip()
                if n:
                    parts.append(n)
                if d:
                    parts.append(d)
                break
    return ' '.join(parts)

def build_ability_entry(ab_id, abil_name_map, abil_link_map, trait_set_traits_map, trait_data_map, lang_text_map, en_lang_text_map, trait_condition_raw_map, lineage_lookup, series_name_map, ability_resource_map, abil_desc_map, sort_order=0, lang_code='EN'):
    trait_set_id = abil_link_map.get(ab_id, ab_id)
    lookup_id = trait_set_id[:-2] if len(trait_set_id) > 2 else trait_set_id
    ab_name = abil_name_map.get(trait_set_id, abil_name_map.get(lookup_id, abil_name_map.get(ab_id, "Unknown")))
    trait_ids = trait_set_traits_map.get(trait_set_id, [])
    if not trait_ids: trait_ids = trait_set_traits_map.get(lookup_id, [])
    trait_info = []
    for tid in trait_ids:
        t_data = trait_data_map.get(tid, {}); desc_lang_id = t_data.get('desc_lang_id', '0')
        display_text = lang_text_map.get(desc_lang_id, '').strip(); en_text = en_lang_text_map.get(desc_lang_id, '').strip()
        if not display_text and en_text: display_text = en_text
        if display_text == ab_name.strip(): display_text = ""
        if en_text == ab_name.strip(): en_text = ""
        active_cid = t_data.get('active_cond_id', '0')
        target_cid = t_data.get('target_cond_id', '0')
        boost_cid = t_data.get('boost_cond_id', '0')
        active_conds = resolve_condition_tags(active_cid, trait_condition_raw_map, lineage_lookup, series_name_map, lang_code)
        target_conds = resolve_condition_tags(target_cid, trait_condition_raw_map, lineage_lookup, series_name_map, lang_code)
        boost_conds = resolve_condition_tags(boost_cid, trait_condition_raw_map, lineage_lookup, series_name_map, lang_code)
        trait_conds = []
        # Display tags are sourced from active/boost conditions only.
        # TargetConditionSetId is often structural and can cause noisy tags.
        for c in active_conds:
            if c not in trait_conds:
                trait_conds.append(c)
        for c in boost_conds:
            if c not in trait_conds:
                trait_conds.append(c)
        condition_groups = []
        if active_conds:
            condition_groups.append({'label': 'Condition 1', 'conditions': list(active_conds)})
        if boost_conds:
            condition_groups.append({'label': 'Boost Target', 'conditions': list(boost_conds)})
        cond_nums = []
        for mv in re.findall(r'\[condition\s*(\d+)\]', (en_text or '').lower()):
            try:
                iv = int(mv)
            except (TypeError, ValueError):
                continue
            if iv not in cond_nums:
                cond_nums.append(iv)
        trait_info.append({
            'display_text': display_text,
            'en_text': en_text,
            'conditions': trait_conds,
            'condition_groups': condition_groups,
            'condition_nums': cond_nums,
            'active_conditions': list(active_conds),
            'boost_conditions': list(boost_conds),
        })
    # Map [Condition N] placeholders to active-condition rows in order.
    # This keeps lines like "...[Condition 1]...[Condition 2]..." grouped on
    # the same sentence while allowing later sentences to start at Condition 1 again.
    active_pool = []
    for idx, info in enumerate(trait_info):
        ac = list(info.get('active_conditions') or [])
        if ac:
            active_pool.append({'idx': idx, 'conditions': ac})
    used_active_pool = set()
    def take_active_for_line(start_idx):
        for pi, p in enumerate(active_pool):
            if pi in used_active_pool:
                continue
            if p['idx'] >= start_idx:
                used_active_pool.add(pi)
                return list(p.get('conditions') or [])
        for pi, p in enumerate(active_pool):
            if pi in used_active_pool:
                continue
            used_active_pool.add(pi)
            return list(p.get('conditions') or [])
        return []
    carry_boost_for_next = []
    def _looks_conditional_text(info_row):
        txt = (str(info_row.get('en_text') or '') + ' ' + str(info_row.get('display_text') or '')).lower()
        if '[condition' in txt:
            return True
        # Heuristic: only attach implicit condition tags on clearly conditional lines.
        return (' when ' in (' ' + txt)) or (' if ' in (' ' + txt)) or ('specified' in txt)
    for idx, info in enumerate(trait_info):
        nums = [n for n in (info.get('condition_nums') or []) if isinstance(n, int) and n > 0]
        groups = []
        boost_conds = list(info.get('boost_conditions') or [])
        boost_used = False
        is_conditional_line = _looks_conditional_text(info)
        if nums:
            for n in nums:
                conds_for_n = take_active_for_line(idx)
                if (not conds_for_n) and boost_conds and (not boost_used):
                    conds_for_n = list(boost_conds)
                    boost_used = True
                if conds_for_n:
                    groups.append({'label': f"Condition {n}", 'conditions': conds_for_n})
            if boost_conds and (not boost_used):
                carry_boost_for_next = list(boost_conds)
        else:
            if carry_boost_for_next and is_conditional_line:
                groups.append({'label': 'Condition 1', 'conditions': list(carry_boost_for_next)})
                carry_boost_for_next = []
            else:
                default_conds = list(info.get('active_conditions') or [])
                if default_conds and is_conditional_line:
                    consumed = False
                    for pi, p in enumerate(active_pool):
                        if pi in used_active_pool:
                            continue
                        if p['idx'] == idx:
                            used_active_pool.add(pi)
                            consumed = True
                            break
                    if not consumed:
                        _ = take_active_for_line(idx)
                    groups.append({'label': 'Condition 1', 'conditions': default_conds})
        # Keep any unconsumed boost as generic Condition 1 on this same line.
        if boost_conds and (not boost_used) and (not carry_boost_for_next) and is_conditional_line:
            groups.append({'label': 'Condition 1', 'conditions': boost_conds})
        if groups:
            info['condition_groups'] = groups
    details = []
    for i, info in enumerate(trait_info):
        display_text = info['display_text']; en_text = info['en_text']; conds = list(info['conditions']); cond_groups = list(info.get('condition_groups', []))
        if display_text:
            existing = None
            for d2 in details:
                if d2['text'] == display_text: existing = d2; break
            if existing:
                for c in conds:
                    if c not in existing['conditions']: existing['conditions'].append(c)
                if cond_groups:
                    ex_groups = existing.setdefault('condition_groups', [])
                    for ng in cond_groups:
                        gl = str(ng.get('label') or '').strip()
                        if not gl:
                            continue
                        ex = None
                        for eg in ex_groups:
                            if str(eg.get('label') or '') == gl:
                                ex = eg
                                break
                        if ex is None:
                            ex_groups.append({'label': gl, 'conditions': list(ng.get('conditions') or [])})
                        else:
                            for cc in (ng.get('conditions') or []):
                                if cc not in ex['conditions']:
                                    ex['conditions'].append(cc)
            else:
                details.append({'text': display_text, 'conditions': conds})
                if cond_groups:
                    details[-1]['condition_groups'] = cond_groups
        else:
            if details:
                for c in conds:
                    if c not in details[-1]['conditions']: details[-1]['conditions'].append(c)
    if not details:
        old_descs = abil_desc_map.get(lookup_id, abil_desc_map.get(trait_set_id, []))
        for entry in old_descs:
            t_val = entry['text'].strip()
            if t_val == ab_name.strip(): continue
            details.append({'text': t_val, 'conditions': []})
    res_id = ability_resource_map.get(ab_id, ''); icon_file = find_trait_icon(res_id)
    has_icon = bool(icon_file); ex_flag = is_ex_ability(ab_name)
    return {'id': ab_id, 'name': ab_name, 'sort': sort_order, 'details': details, 'icon': f"/static/images/Trait/{icon_file}" if icon_file else '', 'has_icon': has_icon, 'is_ex': ex_flag, 'frame_overlay': ABILITY_FRAME_OVERLAY if (has_icon and ex_flag) else '', 'resource_id': res_id}

# ═══════════════════════════════════════════════════════
# LOAD ALL DATA
# ═══════════════════════════════════════════════════════

print("=" * 60)
print("Loading database...")

series_set_data = load_json(os.path.join(BASE_DIR, "m_series_set.json"))
series_master_data = load_json(os.path.join(BASE_DIR, "m_series.json"))
M_SERIES_ID_TO_LOGO_PAD = build_m_series_logo_pad_map(series_master_data)
trait_cond_data_r = load_json(os.path.join(BASE_DIR, "m_trait_condition.json"))
trait_boost_cond_data = load_json(os.path.join(BASE_DIR, "m_trait_boost_condition.json"))
trait_logic_data = load_json(os.path.join(BASE_DIR, "m_trait.json"))
ability_master = load_json(os.path.join(BASE_DIR, "m_ability.json"))
trait_set_data = load_json(os.path.join(BASE_DIR, "m_trait_set.json"))
char_master = load_json(os.path.join(BASE_DIR, "m_character.json"))
char_abil = load_json(os.path.join(BASE_DIR, "m_character_ability_set.json"))
char_skill = load_json(os.path.join(BASE_DIR, "m_character_skill_set.json"))
char_lineage_data = load_json(os.path.join(BASE_DIR, "m_character_lineage.json"))
char_status = load_json(os.path.join(BASE_DIR, "m_character_status.json"))
unit_master_data = load_json(os.path.join(BASE_DIR, "m_unit.json"))
unit_lineage_data = load_json(os.path.join(BASE_DIR, "m_unit_lineage.json"))
unit_terrain_data = load_json(os.path.join(BASE_DIR, "m_terrain_capability_set.json"))
unit_abil_data = load_json(os.path.join(BASE_DIR, "m_unit_ability_set.json"))
unit_status_data = load_json(os.path.join(BASE_DIR, "m_unit_status.json"))
unit_weapon_data = load_json(os.path.join(BASE_DIR, "m_unit_weapon.json"))
weapon_master = load_json(os.path.join(BASE_DIR, "m_weapon.json"))
weapon_status_data = load_json(os.path.join(BASE_DIR, "m_weapon_status.json"))
weapon_correction_data = load_json(os.path.join(BASE_DIR, "m_weapon_status_change_pattern.json"))
weapon_growth_data = load_json(os.path.join(BASE_DIR, "m_weapon_level_growth_pattern_set.json"))
weapon_trait_change_data = load_json(os.path.join(BASE_DIR, "m_weapon_trait_change_pattern.json"))
weapon_trait_base_data = load_json(os.path.join(BASE_DIR, "m_weapon_trait.json"))
mech_master = load_json(os.path.join(BASE_DIR, "m_mechanism.json"))
skill_trait_base = load_json(os.path.join(BASE_DIR, "m_character_skill_trait.json"))
supporter_master = load_json(os.path.join(BASE_DIR, "m_supporter.json"))
supporter_growth_data = load_json(os.path.join(BASE_DIR, "m_supporter_growth.json"))
supporter_leader_data = load_json(os.path.join(BASE_DIR, "m_supporter_leader_skill_content.json"))
supporter_active_data = load_json(os.path.join(BASE_DIR, "m_supporter_active_skill.json"))
eternal_stage_data = load_json(os.path.join(BASE_DIR, "m_eternal_road_stage.json"))
stage_master_data = load_json(os.path.join(BASE_DIR, "m_stage.json"))
stage_sortie_set_content_data = load_json(os.path.join(BASE_DIR, "m_stage_sortie_restriction_set_content.json"))
stage_sortie_group_content_data = load_json(os.path.join(BASE_DIR, "m_stage_sortie_restriction_set_group_content.json"))
stage_battle_condition_text_base_data = load_json(os.path.join(BASE_DIR, "m_stage_battle_condition_text.json"))
map_stage_data = load_json(os.path.join(BASE_DIR, "m_map_stage.json"))
map_master_data = load_json(os.path.join(BASE_DIR, "m_map.json"))
map_npc_data = load_json(os.path.join(BASE_DIR, "m_map_npc.json"))
map_npc_unit_data = load_json(os.path.join(BASE_DIR, "m_map_npc_unit.json"))
map_npc_character_data = load_json(os.path.join(BASE_DIR, "m_map_npc_character.json"))
map_npc_unit_ability_set_content_data = load_json(os.path.join(BASE_DIR, "m_map_npc_unit_ability_set_content.json"))
map_npc_character_ability_set_content_data = load_json(os.path.join(BASE_DIR, "m_map_npc_character_ability_set_content.json"))
map_npc_character_skill_set_content_data = load_json(os.path.join(BASE_DIR, "m_map_npc_character_skill_set_content.json"))
map_npc_unit_weapon_set_content_data = load_json(os.path.join(BASE_DIR, "m_map_npc_unit_weapon_set_content.json"))
map_stage_group_initial_placement_data = load_json(os.path.join(BASE_DIR, "m_map_stage_group_initial_placement.json"))
char_skill_base_data = load_json(os.path.join(BASE_DIR, "m_character_skill.json"))
unit_ssp_config_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_config.json"))
unit_ssp_stat_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_add_status.json"))
ssp_abil_replace_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core_ability_change.json"))
ssp_custom_core_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core.json"))
ssp_release_fn_content_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core_release_function_set_content.json"))
ssp_weap_enhance_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core_weapon_enhance_set.json"))
ssp_weap_effect_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core_weapon_effect.json"))
option_parts_data = load_json(os.path.join(BASE_DIR, "m_option_parts.json"))
option_parts_lineage_data = load_json(os.path.join(BASE_DIR, "m_option_parts_lineage.json"))
schedule_master_data = load_json(os.path.join(BASE_DIR, "m_schedule.json"))
schedule_start_ms_by_id = {}
for _sit in extract_data_list(schedule_master_data):
    if not isinstance(_sit, dict):
        continue
    _sid = normalize_id(_sit.get('Id') or _sit.get('id'))
    if _sid == '0':
        continue
    try:
        schedule_start_ms_by_id[_sid] = int(_sit.get('StartDatetime') or 0)
    except (TypeError, ValueError):
        schedule_start_ms_by_id[_sid] = 0

trait_set_traits_map = create_trait_set_to_traits_map(trait_set_data)
trait_data_map = create_trait_data_map(trait_logic_data)
trait_condition_raw_map = merge_trait_condition_raw_maps(
    create_trait_condition_raw_map(trait_cond_data_r),
    create_trait_condition_raw_map(trait_boost_cond_data),
)
char_info_map = create_char_info_map(char_master); char_stat_map = create_char_status_map(char_status)
char_lin_map = create_char_lineage_link_map(char_lineage_data)
supporter_info_map = create_supporter_info_map(supporter_master) if supporter_master else {}
supporter_growth_map = create_supporter_growth_map(supporter_growth_data) if supporter_growth_data else {}
supporter_leader_map = create_supporter_leader_skill_map(supporter_leader_data) if supporter_leader_data else {}
supporter_active_map = create_supporter_active_skill_map(supporter_active_data) if supporter_active_data else {}
stage_map = create_stage_map(stage_master_data) if stage_master_data else {}
eternal_stage_map = create_eternal_stage_map(eternal_stage_data) if eternal_stage_data else {}
stage_sortie_set_content_map = create_stage_sortie_set_content_map(stage_sortie_set_content_data) if stage_sortie_set_content_data else {}
stage_sortie_group_content_map = create_stage_sortie_group_content_map(stage_sortie_group_content_data) if stage_sortie_group_content_data else {}
stage_condition_map = create_stage_condition_map(stage_battle_condition_text_base_data) if stage_battle_condition_text_base_data else {}
map_stage_lookup = create_map_stage_lookup(map_stage_data) if map_stage_data else {}
map_master_lookup = create_map_master_lookup(map_master_data) if map_master_data else {}
map_npc_lookup, map_npc_by_map_stage = create_map_npc_lookup(map_npc_data) if map_npc_data else ({}, {})
map_npc_unit_lookup = create_map_npc_unit_lookup(map_npc_unit_data) if map_npc_unit_data else {}
map_npc_character_lookup = create_map_npc_character_lookup(map_npc_character_data) if map_npc_character_data else {}
map_npc_unit_ability_set_lookup = create_simple_set_to_ids_map(map_npc_unit_ability_set_content_data, 'MapNpcUnitAbilitySetId', 'AbilityId') if map_npc_unit_ability_set_content_data else {}
map_npc_character_ability_set_lookup = create_simple_set_to_ids_map(map_npc_character_ability_set_content_data, 'MapNpcCharacterAbilitySetId', 'AbilityId') if map_npc_character_ability_set_content_data else {}
map_npc_character_skill_set_lookup = create_simple_set_to_ids_map(map_npc_character_skill_set_content_data, 'MapNpcCharacterSkillSetId', 'CharacterSkillId') if map_npc_character_skill_set_content_data else {}
map_npc_unit_weapon_set_lookup = create_map_npc_unit_weapon_set_lookup(map_npc_unit_weapon_set_content_data) if map_npc_unit_weapon_set_content_data else {}
map_stage_group_initial_placement_lookup = {}
if map_stage_group_initial_placement_data:
    for item in extract_data_list(map_stage_group_initial_placement_data):
        if not isinstance(item, dict): continue
        msid = normalize_id(item.get('MapStageId') or item.get('mapStageId'))
        if msid == '0': continue
        map_stage_group_initial_placement_lookup.setdefault(msid, []).append({'battle_side_type': normalize_id(item.get('BattleSidePlacedTypeIndex') or item.get('battleSidePlacedTypeIndex')), 'x': safe_int(item.get('X'), 0), 'y': safe_int(item.get('Y'), 0), 'direction': normalize_id(item.get('DirectionTypeIndex') or item.get('directionTypeIndex'))})
char_skill_info_map = create_char_skill_info_map(char_skill_base_data) if char_skill_base_data else {}
unit_info_map = create_unit_info_map(unit_master_data); unit_stat_map = create_unit_status_map(unit_status_data)
LIMITED_TIME_UNIT_IDS = frozenset({
    '1150000150', '1095002550', '1200003950', '1330000750', '1114000150', '1501002250', '1430003450',
    '1080000150', '1330000150', '1339000150', '1400000550', '1230003850', '1125001450', '1125001150',
    '1060000550', '1060000450', '1705000550', '1060000350',
})


def _compute_limited_time_character_ids():
    out = set()
    for uid in LIMITED_TIME_UNIT_IDS:
        uinfo = unit_info_map.get(uid)
        if not uinfo:
            continue
        rc = normalize_id(uinfo.get('recommend_character_id') or '0')
        if rc and rc != '0':
            out.add(rc)
    return frozenset(out)


LIMITED_TIME_CHARACTER_IDS = _compute_limited_time_character_ids()
LIMITED_TIME_SUPPORTER_IDS = frozenset(
    normalize_id(x) for x in (
        '1110000150',
        '1300000450',
        '1125000250',
        '1330000250',
    )
)
unit_lin_map = create_unit_lineage_link_map(unit_lineage_data); unit_ter_map = create_terrain_map(unit_terrain_data)
option_parts_lineage_map = create_option_parts_lineage_map(option_parts_lineage_data) if option_parts_lineage_data else {}
unit_abil_map = create_unit_ability_map(unit_abil_data); unit_weapon_map = create_unit_weapon_map(unit_weapon_data)

def _build_char_list_playable_ids():
    """Character ids that have at least one non-empty ability or skill (excludes story/NPC-only entries)."""
    s = set()
    for ab in extract_data_list(char_abil):
        cid = normalize_id(ab.get('CharacterId', ''))
        if cid == '0':
            continue
        for aid in [normalize_id(ab.get('AbilityId', '')), normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))]:
            if aid and aid != '0' and aid != 'None':
                s.add(cid)
                break
    for sk in extract_data_list(char_skill):
        cid = normalize_id(sk.get('CharacterId', ''))
        if cid == '0':
            continue
        for sid in [normalize_id(sk.get('CharacterSkillId', '') or sk.get('SkillId', '')), normalize_id(sk.get('SpCharacterSkillId') or sk.get('spCharacterSkillId'))]:
            if sid and sid != '0':
                s.add(cid)
                break
    return s


char_list_playable_ids = _build_char_list_playable_ids()
unit_list_playable_ids = set(unit_abil_map.keys()) | set(unit_weapon_map.keys())
weapon_info_map = create_weapon_master_map(weapon_master); weapon_status_map = create_weapon_status_map(weapon_status_data)
weapon_correction_map = create_weapon_correction_map(weapon_correction_data)
growth_pattern_map = create_growth_pattern_map(weapon_growth_data)
weapon_trait_change_map = create_weapon_trait_change_map(weapon_trait_change_data)

ability_resource_map = {}
for item in extract_data_list(ability_master):
    if isinstance(item, dict):
        ai = normalize_id(item.get('Id') or item.get('id') or item.get('AbilityId'))
        ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
        if ai != '0' and ri != '0': ability_resource_map[ai] = ri

abil_link_map = {}
for item in extract_data_list(ability_master):
    if isinstance(item, dict):
        ai = normalize_id(item.get('Id') or item.get('id')); ti = normalize_id(item.get('TraitSetId') or item.get('traitSetId'))
        if ai != '0' and ti != '0': abil_link_map[ai] = ti

SDC_DETAIL_MARKER = "Can execute Support Defense when an enemy responds to an ally's attack with a counter during a fight."
SDC_EXPLICIT_IDS = {'1501000103'}
CHANCE_STEP_EX_FILTER_ID = 'chance_step_ex'
CHANCE_STEP_EX_FILTER_NAME = 'Chance Step EX'
CHANCE_STEP_PLUS_ONE_RE = re.compile(r'chance\s*step\s*\+\s*1(?!\d)', re.IGNORECASE)

unit_ser_map = {}
for item in extract_data_list(unit_master_data):
    if isinstance(item, dict):
        uid = normalize_id(item.get('id') or item.get('Id')); sid = normalize_id(item.get('SeriesSetId') or item.get('seriesSetId'))
        if uid != '0' and sid != '0': unit_ser_map[uid] = sid

unit_ssp_config_map = {}
if unit_ssp_config_data:
    for item in extract_data_list(unit_ssp_config_data):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId') or item.get('Id') or item.get('id'))
        sid = normalize_id(item.get('UnitSspAddStatusId') or item.get('unitSspAddStatusId') or item.get('SspAddStatusId') or item.get('sspAddStatusId') or item.get('AddStatusId') or item.get('addStatusId'))
        if uid != '0' and sid != '0': unit_ssp_config_map[uid] = sid

unit_ssp_stat_map = {}
if unit_ssp_stat_data:
    for item in extract_data_list(unit_ssp_stat_data):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('Id') or item.get('id'))
        if sid != '0': unit_ssp_stat_map[sid] = {'HP': (int(item.get('SspHp') or 0), int(item.get('SspMaxHp') or 0)), 'EN': (int(item.get('SspEn') or 0), int(item.get('SspMaxEn') or 0)), 'Attack': (int(item.get('SspAttack') or 0), int(item.get('SspMaxAttack') or 0)), 'Defense': (int(item.get('SspDefense') or 0), int(item.get('SspMaxDefense') or 0)), 'Mobility': (int(item.get('SspMobility') or 0), int(item.get('SspMaxMobility') or 0))}

unit_ssp_weapon_enhance_map = {}
if ssp_weap_enhance_data:
    for item in extract_data_list(ssp_weap_enhance_data):
        if not isinstance(item, dict): continue
        wid = normalize_id(item.get('TargetWeaponId') or item.get('targetWeaponId'))
        t_idx = str(item.get('WeaponEnhanceTypeIndex') or item.get('weaponEnhanceTypeIndex') or '1')
        try: val = int(float(item.get('EffectValue') or item.get('effectValue') or 0))
        except: val = 0
        if wid != '0': unit_ssp_weapon_enhance_map.setdefault(wid, []).append({'type': t_idx, 'value': val})

unit_ssp_weapon_effect_map = {}
if ssp_weap_effect_data:
    for item in extract_data_list(ssp_weap_effect_data):
        if not isinstance(item, dict): continue
        wid = normalize_id(item.get('TargetWeaponId') or item.get('targetWeaponId'))
        tid = normalize_id(item.get('WeaponTraitId') or item.get('weaponTraitId'))
        if wid != '0' and tid != '0': unit_ssp_weapon_effect_map.setdefault(wid, []).append(tid)

unit_ssp_abil_replace_map = {}
unit_ssp_abil_gain_list = {}
if ssp_abil_replace_data:
    for item in extract_data_list(ssp_abil_replace_data):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId'))
        if uid == '0':
            uid_raw = str(normalize_id(item.get('Id') or item.get('id')) or '')
            uid = uid_raw[:-2] if len(uid_raw) > 2 else '0'
        b_id = normalize_id(item.get('BeforeAbilityId') or item.get('beforeAbilityId')); a_id = normalize_id(item.get('AfterAbilityId') or item.get('afterAbilityId'))
        if uid != '0' and b_id != '0' and a_id != '0':
            unit_ssp_abil_replace_map.setdefault(uid, {})[b_id] = a_id
        elif uid != '0' and b_id == '0' and a_id != '0':
            lst = unit_ssp_abil_gain_list.setdefault(uid, [])
            if a_id not in lst:
                lst.append(a_id)

unit_ssp_custom_core_group_entries = {}
if ssp_custom_core_data:
    for item in extract_data_list(ssp_custom_core_data):
        if not isinstance(item, dict): continue
        gid = normalize_id(item.get('UnitSspCustomCoreGroupId') or item.get('unitSspCustomCoreGroupId'))
        sched = normalize_id(item.get('ScheduleId') or item.get('scheduleId'))
        if sched == '9999990001': continue
        fnid = normalize_id(item.get('UnitSspCustomCoreReleaseFunctionSetId') or item.get('unitSspCustomCoreReleaseFunctionSetId'))
        if gid != '0' and fnid != '0': unit_ssp_custom_core_group_entries.setdefault(gid, set()).add(fnid)

ssp_release_fn_content_by_set = {}
if ssp_release_fn_content_data:
    for item in extract_data_list(ssp_release_fn_content_data):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('UnitSspCustomCoreReleaseFunctionSetId') or item.get('unitSspCustomCoreReleaseFunctionSetId'))
        t = normalize_id(item.get('ReleaseFunctionTypeIndex') or item.get('releaseFunctionTypeIndex'))
        tid = normalize_id(item.get('TargetId') or item.get('targetId'))
        if sid != '0': ssp_release_fn_content_by_set.setdefault(sid, []).append({'type': t, 'target_id': tid})

SSP_TERRAIN_TARGET_MAP = {'2': ('Underwater', 1, 2), '4': ('Atmospheric', 1, 2), '6': ('Underwater', 1, 3), '9': ('Underwater', 1, 3), '28': ('Underwater', 2, 3), '29': ('Underwater', 1, 3), '32': ('Underwater', 2, 3), '12': ('Ground', 2, 3), '24': ('Ground', 1, 2), '26': ('Ground', 1, 2), '21': ('Space', 1, 2), '23': ('Space', 1, 2), '30': ('Space', 2, 3), '36': ('Space', 1, 2), '39': ('Space', 2, 3), '51': ('Space', 1, 2), '52': ('Space', 1, 2), '54': ('Space', 1, 2), '57': ('Space', 1, 2), '58': ('Space', 1, 2), '59': ('Space', 1, 2), '22': ('Atmospheric', 1, 2), '31': ('Atmospheric', 2, 3), '38': ('Atmospheric', 1, 2), '44': ('Atmospheric', 1, 2), '61': ('Atmospheric', 2, 3), '64': ('Atmospheric', 1, 2), '41': ('Sea', 1, 2)}

def get_ssp_custom_core_bonuses_for_unit(unit_id):
    out = {'move': 0, 'terrain_upgrades': []}
    uid = normalize_id(unit_id)
    if uid == '0': return out
    fn_sets = unit_ssp_custom_core_group_entries.get(uid, set())
    for sid in fn_sets:
        for it in ssp_release_fn_content_by_set.get(sid, []):
            t = it.get('type', '0')
            if t == '3': out['move'] += 1
            elif t == '4':
                tid = str(it.get('target_id', '0'))
                if tid in SSP_TERRAIN_TARGET_MAP and not any(x[0] == SSP_TERRAIN_TARGET_MAP[tid][0] for x in out['terrain_upgrades']):
                    out['terrain_upgrades'].append(SSP_TERRAIN_TARGET_MAP[tid])
    return out

# Build series icon to ID mapping
series_id_to_icon = {}
for item in extract_data_list(series_set_data):
    if isinstance(item, dict):
        series_id = normalize_id(item.get('SeriesId') or item.get('seriesId'))
        if series_id != '0':
            icon = find_series_icon(series_id)
            if icon: series_id_to_icon[series_id] = icon

print(f"Series icons mapped: {len(series_id_to_icon)}")

# Count portraits
miss, found = 0, 0
for uid, ui in unit_info_map.items():
    if ui.get('role','0') == '0': continue
    p = find_portrait(ui.get('resource_ids', []), uid, 'images/unit_portraits')
    if p: found += 1
    else: miss += 1
print(f"Unit portraits: {found} found, {miss} missing")

# Audit: units with SSP terrain enhancement (ReleaseFunctionTypeIndex=4 only)
_ssp_terrain_audit = {}
for uid in unit_ssp_config_map:
    core = get_ssp_custom_core_bonuses_for_unit(uid)
    _ssp_terrain_audit[uid] = bool(core.get('terrain_upgrades'))
_terrain_yes = [u for u, v in _ssp_terrain_audit.items() if v]
_terrain_no = [u for u, v in _ssp_terrain_audit.items() if not v]
print(f"SSP terrain audit: {len(_terrain_yes)} units WITH terrain enhancement (type 4), {len(_terrain_no)} without")
if '1150000100' in _ssp_terrain_audit:
    print(f"  1150000100: has_terrain_enhancement={_ssp_terrain_audit['1150000100']} (expected False)")
if '1300004300' in _ssp_terrain_audit:
    print(f"  1300004300: has_terrain_enhancement={_ssp_terrain_audit['1300004300']} (expected True - has type 4 in 130000430002)")

# ═══════════════════════════════════════════════════════
# LOAD LANGUAGE-SPECIFIC DATA
# ═══════════════════════════════════════════════════════

LANG_DATA = {}
for lang_code, paths in LANG_PATHS.items():
    print(f"Loading {lang_code}...")
    lang_dir = paths['lang']; lang_base_dir = paths['base']
    if not lang_dir: continue
    
    if lang_base_dir and lang_base_dir != BASE_DIR:
        lcm = load_json(os.path.join(lang_base_dir, "m_character.json"))
        lum = load_json(os.path.join(lang_base_dir, "m_unit.json"))
        if lcm:
            added = 0
            for item in extract_data_list(lcm):
                if not isinstance(item, dict): continue
                cid = normalize_id(item.get('id') or item.get('Id'))
                if cid != '0' and cid not in char_info_map:
                    rids = []
                    for rk in ['ResourceId','resourceId','CutInResourceId','cutInResourceId','BromideResourceId','bromideResourceId','IconResourceId','iconResourceId','VoiceResourceId','voiceResourceId','BattleMovieId','battleMovieId']:
                        rv = str(item.get(rk) or '').strip()
                        if rv and rv != '0' and rv not in rids: rids.append(rv)
                    char_info_map[cid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'acquisition_route': normalize_id(item.get('CharacterAcquisitionRouteTypeIndex'),'0'), 'resource_ids': rids, 'schedule_id': normalize_id(item.get('ScheduleId') or item.get('scheduleId'), '0')}
                    added += 1
            if added: print(f"  +{added} chars from {lang_code}")
        if lum:
            added = 0
            for item in extract_data_list(lum):
                if not isinstance(item, dict): continue
                uid = normalize_id(item.get('id') or item.get('Id'))
                if uid != '0' and uid not in unit_info_map:
                    ult_raw = item.get('IsUltimateDevelopment') or item.get('isUltimateDevelopment')
                    is_ult = ult_raw is True or str(ult_raw).lower() == 'true' or ult_raw == 1 or str(ult_raw) == '1'
                    bid = str(item.get('BromideResourceId') or item.get('bromideResourceId') or '').strip()
                    if bid == '0': bid = ''
                    rids = []
                    if bid: rids.append(bid)
                    for rk in ['ResourceId','resourceId','CutInResourceId','cutInResourceId']:
                        rv = str(item.get(rk) or '').strip()
                        if rv and rv != '0' and rv not in rids: rids.append(rv)
                    rec_raw = item.get('RecommendCharacterId') or item.get('recommendCharacterId')
                    rec_cid = normalize_id(rec_raw) if rec_raw not in (None, '', 'None') else '0'
                    unit_info_map[uid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'model': str(item.get('ModelNumber') or ''), 'series_set': normalize_id(item.get('SeriesSetId') or item.get('seriesSetId')), 'terrain_set': normalize_id(item.get('TerrainCapabilitySetId') or item.get('terrainCapabilitySetId')), 'mechanism_set_id': normalize_id(item.get('MechanismSetId') or item.get('mechanismSetId')), 'profile_lang_id': normalize_id(item.get('ProfileLanguageId') or item.get('profileLanguageId') or '0'), 'is_ultimate': is_ult, 'acquisition_route': normalize_id(item.get('UnitAcquisitionRouteTypeIndex'),'0'), 'bromide_resource_id': bid, 'resource_ids': rids, 'recommend_character_id': rec_cid, 'schedule_id': normalize_id(item.get('ScheduleId') or item.get('scheduleId'), '0')}
                    added += 1
            if added: print(f"  +{added} units from {lang_code}")
    
    series_text = load_json(os.path.join(lang_dir, "m_series.json")); lineage_text = load_json(os.path.join(lang_dir, "m_lineage.json"))
    trait_name_data = load_json(os.path.join(lang_dir, "m_trait_set_detail.json")); trait_desc_data = load_json(os.path.join(lang_dir, "m_trait.json"))
    char_text = load_json(os.path.join(lang_dir, "m_character.json"))
    skill_trait_lang = load_json(os.path.join(lang_dir, "m_character_skill_trait.json"))
    skill_lang = load_json(os.path.join(lang_dir, "m_character_skill.json"))
    skill_text_data = list(extract_data_list(skill_trait_lang)) + list(extract_data_list(skill_lang) or [])
    unit_text_data = load_json(os.path.join(lang_dir, "m_unit.json")); weapon_text_data = load_json(os.path.join(lang_dir, "m_weapon.json"))
    supporter_text = load_json(os.path.join(lang_dir, "m_supporter.json")); supporter_leader_text = load_json(os.path.join(lang_dir, "m_supporter_leader_skill_content.json"))
    supporter_active_text = load_json(os.path.join(lang_dir, "m_supporter_active_skill.json"))
    stage_lang_text = load_json(os.path.join(lang_dir, "m_eternal_road_stage.json")); stage_battle_condition_text_lang = load_json(os.path.join(lang_dir, "m_stage_battle_condition_text.json"))
    mech_lang = load_json(os.path.join(lang_dir, "m_mechanism.json"))
    op_lang_data = load_json(os.path.join(lang_dir, "m_option_parts.json"))
    
    anm, adm = create_ability_maps(extract_data_list(trait_name_data), extract_data_list(trait_desc_data))
    ll = create_lineage_list(lineage_text); llk = create_lineage_lookup(lineage_text)
    snm = create_series_name_map(series_text); ltm = create_lang_text_map(trait_desc_data)
    cim, ctm = create_name_lang_maps(char_master, char_text); csm, ssm, sl = create_series_maps(char_master, series_set_data, series_text)
    stm = create_skill_text_map(extract_data_list(skill_text_data)); uim, utm = create_name_lang_maps(unit_master_data, unit_text_data)
    supp_im, supp_tm = create_name_lang_maps(supporter_master, supporter_text) if supporter_master and supporter_text else ({}, {})
    supp_leader_tm = create_lang_text_map(supporter_leader_text) if supporter_leader_text else {}
    supp_active_tm = create_lang_text_map(supporter_active_text) if supporter_active_text else {}
    stage_text_map = create_lang_text_map(stage_lang_text) if stage_lang_text else {}
    stage_condition_text_map = {}
    for item in extract_data_list(stage_battle_condition_text_lang):
        if isinstance(item, dict):
            lid = normalize_id(item.get('id') or item.get('Id')); val = item.get('value') or item.get('Value') or item.get('text') or item.get('Text')
            if lid != '0' and val: stage_condition_text_map[lid] = str(val).replace("\\n", "\n")
    wtm2 = create_weapon_text_map(weapon_text_data); wtrm = create_weapon_trait_map(BASE_DIR, lang_dir)
    wcam = create_weapon_capability_map(BASE_DIR, lang_dir); wtdm = create_weapon_trait_detail_map(weapon_trait_base_data, lang_dir)
    mech_map = create_mechanism_map(mech_master or {}, mech_lang or {})
    op_text_map = create_lang_text_map(op_lang_data) if op_lang_data else {}
    
    skill_trait_name_fallback = {}
    skill_trait_desc_fallback = {}
    if skill_trait_base:
        for item in extract_data_list(skill_trait_base):
            if isinstance(item, dict):
                tid = normalize_id(item.get('Id') or item.get('id'))
                nlid = normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId'))
                dlid = normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId'))
                if tid != '0' and nlid != '0':
                    entries = stm.get(nlid)
                    if entries and isinstance(entries, list) and len(entries) > 0:
                        best = next((x for x in entries if x.get('full_id') == nlid), entries[0])
                        skill_trait_name_fallback[tid] = best.get('text', '')
                if tid != '0' and dlid != '0':
                    entries = stm.get(dlid)
                    if entries and isinstance(entries, list) and len(entries) > 0:
                        best = next((x for x in entries if x.get('full_id') == dlid), entries[0])
                        skill_trait_desc_fallback[tid] = best.get('text', '')
    srm = {}
    for item in extract_data_list(trait_set_data):
        if isinstance(item, dict):
            si = normalize_id(item.get('Id') or item.get('id') or item.get('TraitSetId')); ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
            if si != '0' and ri != '0': srm[si] = ri
    for item in extract_data_list(char_skill):
        if isinstance(item, dict):
            si = normalize_id(item.get('CharacterSkillId') or item.get('SkillId') or item.get('Id')); ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
            if si != '0' and ri != '0': srm[si] = ri
    if skill_trait_base:
        for item in extract_data_list(skill_trait_base):
            if isinstance(item, dict):
                si = normalize_id(item.get('CharacterSkillId') or item.get('SkillId') or item.get('Id')); ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
                if si != '0' and ri != '0': srm[si] = ri; (len(si) > 2 and si[:-2] not in srm and srm.update({si[:-2]: ri}))
    
    LANG_DATA[lang_code] = {'abil_name_map': anm, 'abil_desc_map': adm, 'lineage_list': ll, 'lineage_lookup': llk, 'series_name_map': snm, 'lang_text_map': ltm, 'char_id_map': cim, 'char_text_map': ctm, 'char_ser_map': csm, 'ser_set_map': ssm, 'series_list': sl, 'skill_text_map': stm, 'skill_trait_name_fallback': skill_trait_name_fallback, 'skill_trait_desc_fallback': skill_trait_desc_fallback, 'skill_resource_map': srm, 'unit_id_map': uim, 'unit_text_map': utm, 'supporter_id_map': supp_im, 'supporter_text_map': supp_tm, 'supporter_leader_text_map': supp_leader_tm, 'supporter_active_text_map': supp_active_tm, 'stage_text_map': stage_text_map, 'stage_condition_text_map': stage_condition_text_map, 'weapon_text_map': wtm2, 'weapon_trait_map': wtrm, 'weapon_capability_map': wcam, 'weapon_trait_detail_map': wtdm, 'mechanism_map': mech_map, 'op_text_map': op_text_map}
    print(f"  {lang_code}: {len(ctm)} chars, {len(utm)} units")

def _precompute_sdc_data():
    """Find all character ability IDs whose detail text contains the SDC marker.
    Also includes any explicitly listed IDs (e.g. EX abilities with same content).
    Returns (set_of_ids, representative_non_ex_id)."""
    sdc_ids = set(SDC_EXPLICIT_IDS)
    representative_id = ''
    ld = LANG_DATA.get(CALC_LANG, LANG_DATA.get(DEFAULT_LANG, {}))
    ldc = ld
    seen_aids = set()
    for ab_row in extract_data_list(char_abil):
        cid = normalize_id(ab_row.get('CharacterId', ''))
        if not cid or cid not in char_list_playable_ids:
            continue
        info = char_info_map.get(cid)
        if not info:
            continue
        ri = info.get('rarity', '1')
        for key in ('AbilityId', 'SpAbilityId', 'spAbilityId'):
            aid = normalize_id(ab_row.get(key) or '')
            if not aid or aid in ('0', 'None') or aid in seen_aids:
                continue
            seen_aids.add(aid)
            try:
                bab = build_ability_entry(
                    aid, ld['abil_name_map'], abil_link_map, trait_set_traits_map,
                    trait_data_map, ld['lang_text_map'], ldc['lang_text_map'],
                    trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'],
                    ability_resource_map, ld['abil_desc_map'], sort_order=0, lang_code=CALC_LANG,
                )
            except Exception:
                continue
            detail_blob = ' '.join(
                d.get('text', '') if isinstance(d, dict) else str(d)
                for d in bab.get('details', [])
            )
            if SDC_DETAIL_MARKER in detail_blob:
                sdc_ids.add(aid)
                if not bab.get('is_ex') and ri == '4' and not representative_id:
                    representative_id = aid
    return sdc_ids, representative_id

SDC_ABILITY_IDS, SDC_REPRESENTATIVE_ID = _precompute_sdc_data()
print(f"SDC abilities found: {len(SDC_ABILITY_IDS)}, representative: {SDC_REPRESENTATIVE_ID}")


def _precompute_chance_step_ex_data():
    """Find EX character abilities whose detail text contains Chance Step +1 wording."""
    ids = set()
    icon = ''
    ld = LANG_DATA.get(CALC_LANG, LANG_DATA.get(DEFAULT_LANG, {}))
    ldc = ld
    seen_aids = set()
    for ab_row in extract_data_list(char_abil):
        cid = normalize_id(ab_row.get('CharacterId', ''))
        if not cid or cid not in char_list_playable_ids:
            continue
        for key in ('AbilityId', 'SpAbilityId', 'spAbilityId'):
            aid = normalize_id(ab_row.get(key) or '')
            if not aid or aid in ('0', 'None') or aid in seen_aids:
                continue
            seen_aids.add(aid)
            try:
                bab = build_ability_entry(
                    aid, ld['abil_name_map'], abil_link_map, trait_set_traits_map,
                    trait_data_map, ld['lang_text_map'], ldc['lang_text_map'],
                    trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'],
                    ability_resource_map, ld['abil_desc_map'], sort_order=0, lang_code=CALC_LANG,
                )
            except Exception:
                continue
            if not bab.get('is_ex'):
                continue
            detail_blob = ' '.join(
                d.get('text', '') if isinstance(d, dict) else str(d)
                for d in bab.get('details', [])
            )
            if CHANCE_STEP_PLUS_ONE_RE.search(detail_blob or ''):
                ids.add(aid)
                if not icon:
                    icon = (bab.get('icon') or '').strip()
    return ids, icon


CHANCE_STEP_EX_ABILITY_IDS, CHANCE_STEP_EX_ICON = _precompute_chance_step_ex_data()
print(f"Chance Step EX abilities found: {len(CHANCE_STEP_EX_ABILITY_IDS)}")

def _precompute_weapon_debuff_keys_present_by_lang():
    """Which debuff filter keys appear on at least one unit (weapon traits), per UI language."""
    out = {}
    for lc in ('EN', 'TW', 'HK', 'JA'):
        ld = LANG_DATA.get(lc)
        if not ld:
            continue
        acc = set()
        for uid in unit_info_map:
            acc |= set(collect_unit_weapon_debuff_keys(uid, ld, lc))
        out[lc] = frozenset(acc)
    return out


WEAPON_DEBUFF_KEYS_PRESENT_BY_LANG = _precompute_weapon_debuff_keys_present_by_lang()
# Union across locales so the debuff dropdown lists the same categories in EN / TW / JP (trait
# wording differs by language; per-lang sets alone would hide most options in JA).
WEAPON_DEBUFF_KEYS_PRESENT_UNION = frozenset(
    k for fs in WEAPON_DEBUFF_KEYS_PRESENT_BY_LANG.values() for k in fs
)

print("Database ready!")
print("=" * 60)

CHAR_RECOMMEND_UNIT_MAP = {}
for _uid in sorted(unit_info_map.keys()):
    _ui = unit_info_map[_uid]
    _rid = normalize_id(_ui.get('recommend_character_id') or '0')
    if _rid != '0' and _rid not in CHAR_RECOMMEND_UNIT_MAP:
        CHAR_RECOMMEND_UNIT_MAP[_rid] = _uid

# Manual shortcut fallbacks for missing character <-> unit links.
MANUAL_SHORTCUT_PAIRS = [
    ('1725000100', '1725000150'),
    ('1700000100', '1700000100'),
    ('1705001700', '1705000400'),
    ('1705000200', '1705000550'),
    ('1705001300', '1705001200'),
    ('1705001900', '1705000100'),
    ('1705001600', '1705001510'),
    ('1705000300', '1705000600'),
    ('1705000400', '1705000700'),
    ('1705000500', '1705000800'),
    ('1705001000', '1705000900'),
    ('1705001100', '1705001000'),
    ('1705001200', '1705001100'),
    ('1705001400', '1705001300'),
    ('1705001500', '1705001400'),
    ('1709000100', '1709000100'),
]
MANUAL_CHAR_RECOMMEND_UNIT_MAP = {}
MANUAL_UNIT_RECOMMEND_CHARACTER_MAP = {}
for _cid_raw, _uid_raw in MANUAL_SHORTCUT_PAIRS:
    _cid = normalize_id(_cid_raw)
    _uid = normalize_id(_uid_raw)
    if _cid != '0' and _uid != '0':
        MANUAL_CHAR_RECOMMEND_UNIT_MAP[_cid] = _uid
        MANUAL_UNIT_RECOMMEND_CHARACTER_MAP[_uid] = _cid
        if _cid not in CHAR_RECOMMEND_UNIT_MAP:
            CHAR_RECOMMEND_UNIT_MAP[_cid] = _uid

# ═══════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════

def get_lang_data(lc): return LANG_DATA.get(lc, LANG_DATA.get(DEFAULT_LANG, {}))
def get_calc_lang_data(): return LANG_DATA.get(CALC_LANG, {})

WHATS_NEW_SNAPSHOT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'whats_new_snapshot.json')
WHATS_NEW_HISTORY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'whats_new_history_snapshots')
WHATS_NEW_HISTORY_INDEX_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'whats_new_history_index.json')

def _whats_new_master_data_date():
    """Use latest mtime among key master JSON files so the date matches the most recent import."""
    names = (
        'm_unit.json', 'm_character.json', 'm_unit_ability_set.json', 'm_unit_weapon.json',
        'm_character_ability_set.json', 'm_option_parts.json',
    )
    best_ts = None
    try:
        for name in names:
            p = os.path.join(BASE_DIR, name)
            if os.path.isfile(p):
                ts = os.path.getmtime(p)
                if best_ts is None or ts > best_ts:
                    best_ts = ts
        if best_ts is not None:
            return datetime.fromtimestamp(best_ts, tz=timezone.utc).date().isoformat()
    except Exception:
        pass
    return datetime.now(timezone.utc).date().isoformat()

def _load_whats_new_snapshot_from_path(path):
    try:
        if not os.path.isfile(path):
            return None
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict) or int(data.get('version') or 0) not in (1, 2):
            return None
        return data
    except Exception:
        return None

def load_whats_new_snapshot():
    return _load_whats_new_snapshot_from_path(WHATS_NEW_SNAPSHOT_PATH)

def _load_whats_new_history_index():
    try:
        if not os.path.isfile(WHATS_NEW_HISTORY_INDEX_PATH):
            return {'version': 1, 'archives': []}
        with open(WHATS_NEW_HISTORY_INDEX_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict) or int(data.get('version') or 0) != 1:
            return {'version': 1, 'archives': []}
        if not isinstance(data.get('archives'), list):
            data['archives'] = []
        return data
    except Exception:
        return {'version': 1, 'archives': []}

def _load_whats_new_snapshot_chain():
    """Return [oldest ... newest] snapshot dicts; newest is always whats_new_snapshot.json on disk."""
    idx = _load_whats_new_history_index()
    archives = idx.get('archives') or []
    loaded = []
    for a in archives:
        if not isinstance(a, dict):
            continue
        fn = (a.get('filename') or '').strip()
        if not fn:
            continue
        path = os.path.join(WHATS_NEW_HISTORY_DIR, fn)
        snap = _load_whats_new_snapshot_from_path(path)
        if snap:
            aid = (a.get('id') or fn).strip() or fn
            loaded.append((aid, snap))
    loaded.sort(key=lambda x: ((x[1].get('captured_at') or '').strip(), x[0]))
    chain = [x[1] for x in loaded]
    cur = load_whats_new_snapshot()
    if not cur:
        return []
    chain.append(cur)
    return chain

def _build_char_ability_effect_map_from_data(char_abil_data):
    lookup = {}
    for item in extract_data_list(char_abil_data or []):
        if not isinstance(item, dict):
            continue
        cid = normalize_id(item.get('CharacterId') or item.get('characterId'))
        aid = normalize_id(item.get('AbilityId') or item.get('abilityId'))
        sp = normalize_id(item.get('SpAbilityId') or item.get('spAbilityId') or '0')
        sort = int(item.get('SortOrder') or 0)
        if cid == '0':
            continue
        eff = sp if sp and sp != '0' else aid
        lookup.setdefault(cid, []).append({'sort': sort, 'id': eff})
    out = {}
    for cid, rows in lookup.items():
        rows.sort(key=lambda x: x['sort'])
        out[cid] = [r['id'] for r in rows]
    return out

def _build_char_ability_effect_map():
    return _build_char_ability_effect_map_from_data(char_abil)

def _collect_option_part_ids_from_data(option_parts_data_local):
    s = set()
    for item in extract_data_list(option_parts_data_local or []):
        if not isinstance(item, dict):
            continue
        opid = normalize_id(item.get('Id') or item.get('id'))
        if opid != '0':
            s.add(opid)
    return s

def _collect_option_part_ids():
    return _collect_option_part_ids_from_data(option_parts_data)

def _collect_supporter_ids_from_data(supporter_data_local):
    s = set()
    for item in extract_data_list(supporter_data_local or []):
        if not isinstance(item, dict):
            continue
        sid = normalize_id(item.get('id') or item.get('Id'))
        if sid != '0':
            s.add(sid)
    return s

def _collect_supporter_ids():
    return _collect_supporter_ids_from_data(supporter_master)

def build_whats_new_snapshot_dict_from_master_dir(master_dir):
    """Build snapshot version-1 dict from a folder of master JSON (e.g. previous day's MasterData_*)."""
    master_dir = os.path.abspath(master_dir)
    if not os.path.isdir(master_dir):
        raise FileNotFoundError(f'Not a directory: {master_dir}')
    unit_abil_data = load_json(os.path.join(master_dir, 'm_unit_ability_set.json'))
    unit_weapon_data = load_json(os.path.join(master_dir, 'm_unit_weapon.json'))
    char_abil_data = load_json(os.path.join(master_dir, 'm_character_ability_set.json'))
    unit_master_data_local = load_json(os.path.join(master_dir, 'm_unit.json'))
    char_master_data_local = load_json(os.path.join(master_dir, 'm_character.json'))
    op_data = load_json(os.path.join(master_dir, 'm_option_parts.json'))
    sup_data = load_json(os.path.join(master_dir, 'm_supporter.json'))
    uam = create_unit_ability_map(unit_abil_data)
    uwm = create_unit_weapon_map(unit_weapon_data)
    cam = _build_char_ability_effect_map_from_data(char_abil_data)
    uim = create_unit_info_map(unit_master_data_local)
    cim = create_char_info_map(char_master_data_local)
    op_ids = sorted(_collect_option_part_ids_from_data(op_data))
    sup_ids = sorted(_collect_supporter_ids_from_data(sup_data))
    return {
        'version': 2,
        'unit_abilities': {uid: [str(x['id']) for x in lst] for uid, lst in uam.items()},
        'unit_weapons': {uid: [str(x['id']) for x in lst] for uid, lst in uwm.items()},
        'char_abilities': cam,
        'option_parts': op_ids,
        'supporters': sup_ids,
        'units': sorted(uim.keys()),
        'characters': sorted(cim.keys()),
    }

def serialize_whats_new_snapshot():
    return {
        'version': 2,
        'unit_abilities': {uid: [str(x['id']) for x in lst] for uid, lst in unit_abil_map.items()},
        'unit_weapons': {uid: [str(x['id']) for x in lst] for uid, lst in unit_weapon_map.items()},
        'char_abilities': _build_char_ability_effect_map(),
        'option_parts': sorted(_collect_option_part_ids()),
        'supporters': sorted(_collect_supporter_ids()),
        'units': sorted(unit_info_map.keys()),
        'characters': sorted(char_info_map.keys()),
    }

def _wn_unit_name(uid, ld):
    lid = ld.get('unit_id_map', {}).get(uid, '')
    n = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
    return n or f'Unit {uid}'

def _wn_char_name(cid, ld):
    lid = ld.get('char_id_map', {}).get(cid, '')
    n = ld.get('char_text_map', {}).get(lid, '') if lid else ''
    return n or f'Character {cid}'

def _wn_weapon_name(wid, ld):
    wm = weapon_info_map.get(wid, {})
    return (ld.get('weapon_text_map', {}) or {}).get(wm.get('name_lang_id', '0'), '') or wid

def _wn_supporter_name(sid, ld):
    lid = ld.get('supporter_id_map', {}).get(sid, '')
    n = ld.get('supporter_text_map', {}).get(lid, '') if lid else ''
    return n or f'Supporter {sid}'

def _wn_option_part_name(opid, ld):
    for item in extract_data_list(option_parts_data or []):
        if not isinstance(item, dict):
            continue
        if normalize_id(item.get('Id') or item.get('id')) != opid:
            continue
        nlid = normalize_id(item.get('SortNameLanguageId') or item.get('sortNameLanguageId'))
        if nlid:
            n = (ld.get('op_text_map', {}) or {}).get(nlid, '')
            if n:
                return n
        return f'Option part {opid}'
    return opid

def _wn_format_unit_abilities(uid, ordered_aids, ld):
    un = _wn_unit_name(uid, ld)
    if not ordered_aids:
        return f'{un} ({uid}): (no abilities)'
    parts = []
    for i, aid in enumerate(ordered_aids):
        an = get_ability_name_for_search(str(aid), ld['abil_name_map'], abil_link_map)
        parts.append(f"{i + 1}: {an or aid}")
    return f'{un} ({uid}): ' + ' | '.join(parts)

def _wn_format_unit_weapons(uid, ordered_wids, ld):
    un = _wn_unit_name(uid, ld)
    if not ordered_wids:
        return f'{un} ({uid}): (no weapons)'
    parts = []
    for i, wid in enumerate(ordered_wids):
        wn = _wn_weapon_name(wid, ld)
        parts.append(f"{i + 1}: {wn}")
    return f'{un} ({uid}): ' + ' | '.join(parts)

def _wn_format_char_abilities(cid, ordered_aids, ld):
    cn = _wn_char_name(cid, ld)
    if not ordered_aids:
        return f'{cn} ({cid}): (no abilities)'
    parts = []
    for i, aid in enumerate(ordered_aids):
        an = get_ability_name_for_search(str(aid), ld['abil_name_map'], abil_link_map)
        parts.append(f"{i + 1}: {an or aid}")
    return f'{cn} ({cid}): ' + ' | '.join(parts)

def _wn_collect_ability_body_chunks_raw(aid, ld):
    """Trait + ability-description strings in master order (may duplicate search blob)."""
    if not aid or str(aid) in ('0', 'None', ''):
        return []
    trait_set_id = abil_link_map.get(str(aid), str(aid))
    lookup_id = trait_set_id[:-2] if len(trait_set_id) > 2 else trait_set_id
    ltm = ld.get('lang_text_map', {})
    trait_ids = trait_set_traits_map.get(trait_set_id, trait_set_traits_map.get(lookup_id, []))
    out = []
    for tid in trait_ids:
        t_data = trait_data_map.get(tid, {})
        dlid = t_data.get('desc_lang_id', '0')
        if dlid and dlid != '0':
            tx = (ltm.get(dlid, '') or '').strip()
            if tx:
                out.append(tx)
    adm = ld.get('abil_desc_map', {})
    for key in (lookup_id, trait_set_id):
        if not key:
            continue
        for entry in adm.get(key, []) or []:
            if isinstance(entry, dict):
                t = (entry.get('text') or '').strip()
            else:
                t = str(entry).strip()
            if t:
                out.append(t)
    return out


def _wn_strip_chunk_after_ability_name(chunk, name):
    """Drop redundant ability title when a chunk repeats it (e.g. 'GN Field LV 2 / When…')."""
    if not chunk:
        return ''
    c = chunk.strip()
    n = (name or '').strip()
    if not n:
        return c
    nn = re.sub(r'\s+', ' ', n)
    cn = re.sub(r'\s+', ' ', c)
    if cn == nn:
        return ''
    for sep in (' / ', '/', '／'):
        if c.startswith(n + sep):
            return c[len(n) + len(sep):].strip()
    return c


def _wn_ability_whatsnew_block(aid, ld):
    """Multiline Before/After text: title line, then description lines; dedupes identical sentences."""
    if not aid or str(aid) in ('0', 'None', ''):
        return '—'
    name = (get_ability_name_for_search(str(aid), ld['abil_name_map'], abil_link_map) or str(aid)).strip()
    raw = _wn_collect_ability_body_chunks_raw(aid, ld)
    seen_norm = set()
    lines = [name]
    for chunk in raw:
        s = _wn_strip_chunk_after_ability_name(chunk, name)
        if not s:
            continue
        norm = re.sub(r'\s+', ' ', s)
        if norm in seen_norm:
            continue
        seen_norm.add(norm)
        lines.append(s)
    return '\n'.join(lines)


def _build_ability_slot_rows(old_ids, new_ids, ld):
    old_ids = [str(x) for x in (old_ids or [])]
    new_ids = [str(x) for x in (new_ids or [])]
    n = max(len(old_ids), len(new_ids))
    rows = []
    for i in range(n):
        oa = old_ids[i] if i < len(old_ids) else None
        na = new_ids[i] if i < len(new_ids) else None
        if oa == na:
            continue
        o_name = get_ability_name_for_search(str(oa), ld['abil_name_map'], abil_link_map) if oa else ''
        n_name = get_ability_name_for_search(str(na), ld['abil_name_map'], abil_link_map) if na else ''
        o_name = o_name or (oa if oa else '—')
        n_name = n_name or (na if na else '—')
        o_text = _wn_ability_whatsnew_block(oa, ld) if oa else '—'
        n_text = _wn_ability_whatsnew_block(na, ld) if na else '—'
        rows.append({
            'slot': i + 1,
            'from': o_name,
            'to': n_name,
            'from_text': o_text,
            'to_text': n_text,
        })
    return rows

def _build_weapon_slot_rows(old_ids, new_ids, ld):
    old_ids = [str(x) for x in (old_ids or [])]
    new_ids = [str(x) for x in (new_ids or [])]
    n = max(len(old_ids), len(new_ids))
    rows = []
    for i in range(n):
        ow = old_ids[i] if i < len(old_ids) else None
        nw = new_ids[i] if i < len(new_ids) else None
        if ow == nw:
            continue
        o_name = _wn_weapon_name(ow, ld) if ow else '—'
        n_name = _wn_weapon_name(nw, ld) if nw else '—'
        rows.append({
            'slot': i + 1,
            'from': o_name,
            'to': n_name,
            'from_text': o_name,
            'to_text': n_name,
        })
    return rows

def compute_whats_new_delta_between(snap_old, snap_new, lang_code=None):
    """Diff two snapshot dicts (version 1). Used for pending (baseline vs live) and historical archive pairs."""
    if not snap_old or not snap_new:
        return None
    lc = validate_lang_code(lang_code)
    ld = get_lang_data(lc) or get_lang_data(DEFAULT_LANG)
    if not ld:
        return None
    old_units = set(snap_old.get('units') or [])
    old_chars = set(snap_old.get('characters') or [])
    changes = []
    old_ua = snap_old.get('unit_abilities') or {}
    new_ua = snap_new.get('unit_abilities') or {}
    for uid in sorted(set(old_ua.keys()) | set(new_ua.keys())):
        if uid not in old_units:
            continue
        oa = old_ua.get(uid) or []
        na = new_ua.get(uid) or []
        if oa != na:
            rows = _build_ability_slot_rows(oa, na, ld)
            if rows:
                changes.append({
                    'kind': 'unit_abilities',
                    'title': _wn_unit_name(uid, ld),
                    'link_type': 'unit',
                    'link_id': uid,
                    'rows': rows,
                })
    old_uw = snap_old.get('unit_weapons') or {}
    new_uw = snap_new.get('unit_weapons') or {}
    for uid in sorted(set(old_uw.keys()) | set(new_uw.keys())):
        if uid not in old_units:
            continue
        ow = old_uw.get(uid) or []
        nw = new_uw.get(uid) or []
        if ow != nw:
            rows = _build_weapon_slot_rows(ow, nw, ld)
            if rows:
                changes.append({
                    'kind': 'unit_weapons',
                    'title': _wn_unit_name(uid, ld),
                    'link_type': 'unit',
                    'link_id': uid,
                    'rows': rows,
                })
    old_ca = snap_old.get('char_abilities') or {}
    new_ca = snap_new.get('char_abilities') or {}
    for cid in sorted(set(old_ca.keys()) | set(new_ca.keys())):
        if cid not in old_chars:
            continue
        oa = old_ca.get(cid) or []
        na = new_ca.get(cid) or []
        if oa != na:
            rows = _build_ability_slot_rows(oa, na, ld)
            if rows:
                changes.append({
                    'kind': 'char_abilities',
                    'title': _wn_char_name(cid, ld),
                    'link_type': 'character',
                    'link_id': cid,
                    'rows': rows,
                })
    added = []
    nu = snap_new.get('units') or []
    nc = snap_new.get('characters') or []
    nop = snap_new.get('option_parts') or []
    for uid in sorted(set(nu) - old_units):
        added.append({
            'kind': 'new_unit',
            'name': _wn_unit_name(uid, ld),
            'link_type': 'unit',
            'link_id': uid,
        })
    for cid in sorted(set(nc) - old_chars):
        added.append({
            'kind': 'new_character',
            'name': _wn_char_name(cid, ld),
            'link_type': 'character',
            'link_id': cid,
        })
    old_op = set(snap_old.get('option_parts') or [])
    for opid in sorted(set(nop) - old_op):
        added.append({
            'kind': 'new_option_part',
            'name': _wn_option_part_name(opid, ld),
            'link_type': 'modification',
            'link_id': opid,
        })
    if isinstance(snap_old.get('supporters'), list) and isinstance(snap_new.get('supporters'), list):
        old_sup = set(snap_old['supporters'])
        new_sup = set(snap_new['supporters'])
        for sid in sorted(new_sup - old_sup):
            added.append({
                'kind': 'new_supporter',
                'name': _wn_supporter_name(sid, ld),
                'link_type': 'supporter',
                'link_id': sid,
            })
    if not changes and not added:
        return None
    date_str = (snap_new.get('captured_at') or '').strip() or _whats_new_master_data_date()
    return {'date': date_str, 'changes': changes, 'added': added}

def compute_whats_new_delta(lang_code=None):
    """Diff data/whats_new_snapshot.json vs EN MasterData on disk (BASE_DIR), i.e. the same tree the app loads.

    Uses build_whats_new_snapshot_dict_from_master_dir(BASE_DIR) so the pending tab always reflects the current
    master files, not only in-memory state. Run scripts/refresh_whats_new_snapshot.py after a release to reset the baseline.

    Names and ability text use *lang_code* (e.g. TW) so the What's New panel matches the UI language.
    """
    snap = load_whats_new_snapshot()
    if not snap:
        return None
    lc = validate_lang_code(lang_code)
    try:
        cur = build_whats_new_snapshot_dict_from_master_dir(BASE_DIR)
    except Exception:
        cur = serialize_whats_new_snapshot()
    out = compute_whats_new_delta_between(snap, cur, lc)
    if not out:
        return None
    out['date'] = _whats_new_master_data_date()
    return out

def compute_unit_stats_no_cond(unit_id, info, raw, ldc):
    """Compute unit stats for list view: base at max LB + non-conditional passive bonuses only."""
    ri = info.get('rarity', '1'); has_sp = int(ri) <= 4
    cm = 1.0 if info.get('is_ultimate', False) else 1.4
    lb_fs = {}
    if raw:
        ssp_id = unit_ssp_config_map.get(unit_id); ssp_bonus = unit_ssp_stat_map.get(ssp_id, {})
        ssp_core = get_ssp_custom_core_bonuses_for_unit(unit_id) if has_sp else {'move': 0, 'terrain_upgrades': []}
        for s in ['HP', 'EN', 'Attack', 'Defense', 'Mobility']:
            st = raw.get(s, (0, 0, 0)); st = (st[0], st[1], st[2]) if len(st) >= 3 else (st[0], st[1], st[1])
            gs = calc_growth_unit_base(st[0], st[1], ri)
            lb_fs[s] = math.floor(gs * cm)
        mov = raw.get('Move', (0, 0)); mov = (mov[0], mov[1]) if isinstance(mov, (list, tuple)) and len(mov) >= 2 else (mov if isinstance(mov, (int, float)) else 0, mov if isinstance(mov, (int, float)) else 0)
        lb_fs['Move'] = mov[0] if isinstance(mov, (list, tuple)) else mov
    else:
        lb_fs = {s: 0 for s in UNIT_STAT_ORDER}
    ua = unit_abil_map.get(unit_id, []); rm = unit_ssp_abil_replace_map.get(unit_id, {})
    ac = []
    for ab in sorted(ua, key=lambda x: x['sort']):
        bac = build_ability_entry(str(ab['id']), ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=ab['sort'], lang_code=CALC_LANG)
        if str(ab['id']) in rm: bac['ssp_replacement'] = build_ability_entry(rm[str(ab['id'])], ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=ab['sort'], lang_code=CALC_LANG)
        ac.append(bac)
    spb = {s: 0 for s in UNIT_STAT_ORDER}; spc = {s: 0 for s in UNIT_STAT_ORDER}; nxs = {s: 0 for s in UNIT_STAT_ORDER}
    spb_move_flat = [0]; spc_move_flat = [0]
    def _ability_has_condition_word(ad):
        name = (ad.get('name') or '').lower()
        cond_words = ('condition', 'conditional', 'when countering', 'when counter', 'when attacking', 'when attacked', 'during battle', 'at the start of', 'each time', 'every time')
        if any(w in name for w in cond_words): return True
        for d2 in ad.get('details', []):
            txt = (d2.get('text', '') if isinstance(d2, dict) else str(d2)).lower()
            if any(w in txt for w in cond_words): return True
        return False
    def ep(ad, bd, cd, nd, bd_move_flat, cd_move_flat):
        hc = any(cond for d2 in ad.get('details', []) for cond in d2.get('conditions', []))
        ie = ad.get('is_ex', False); ability_cond = _ability_has_condition_word(ad)
        inx = unit_id == '1400000550' and any(kw in (ad.get('name', '') or '').lower() for kw in ['newtype', 'x-rounder', '新人類', 'x rounder'])
        for d2 in ad.get('details', []):
            txt = d2.get('text', '') if isinstance(d2, dict) else str(d2)
            parts = [p.strip() for p in re.split(r'[.\n]+', txt) if p and p.strip()]
            if not parts: parts = [txt]
            cond_prefix = False
            for part in parts:
                itc = _is_conditional_stat_text(part)
                if itc and _unit_hp_threshold_active_at_assumed_full_hp(part):
                    itc = False
                part_stats = _extract_stat_percent_unit(part, skip_conditional=False)
                flat_move = _extract_stat_flat_move(part, skip_conditional=False)
                if itc and not part_stats and not flat_move:
                    cond_prefix = True
                is_cond = itc or cond_prefix
                if flat_move:
                    if inx: pass
                    elif hc or ie or is_cond: cd_move_flat[0] += flat_move
                    else: bd_move_flat[0] += flat_move
                for s, pct in part_stats.items():
                    if s == 'Move': continue
                    if unit_id == '1400000550' and s == 'HP' and pct == 5: bd[s] = bd.get(s, 0) + pct; continue
                    if inx: nd[s] = max(nd.get(s, 0), pct)
                    elif hc or ie or is_cond: cd[s] = cd.get(s, 0) + pct
                    else: bd[s] = bd.get(s, 0) + pct
    for ab in ac:
        ep(ab, spb, spc, nxs, spb_move_flat, spc_move_flat)
    for s in UNIT_STAT_ORDER: spc[s] = spc.get(s, 0) + nxs.get(s, 0)
    result = {}
    for s in UNIT_STAT_ORDER:
        if s == 'Move':
            result[s] = lb_fs.get(s, 0) + spb_move_flat[0]
        else:
            bst = lb_fs.get(s, 0); bb = math.floor(bst * spb.get(s, 0) / 100) if bst else 0
            result[s] = bst + bb
    return result

def _unit_max_lb_stat_block(unit_id, info, raw, ldc):
    """Max LB tier (1.4×) stat bundles — same logic as get_unit lb_data[3]. Used for list SP/SSP columns."""
    unit_id = normalize_id(unit_id)
    ri = info.get('rarity', '1')
    fs = {}
    has_sp = int(ri) <= 4
    ssp_id = unit_ssp_config_map.get(unit_id); ssp_bonus = unit_ssp_stat_map.get(ssp_id, {})
    ssp_core = get_ssp_custom_core_bonuses_for_unit(unit_id) if has_sp else {'move': 0, 'terrain_upgrades': []}
    rm = unit_ssp_abil_replace_map.get(unit_id, {})
    if raw:
        for s in ['HP', 'EN', 'Attack', 'Defense', 'Mobility']:
            st = raw.get(s, (0, 0, 0)); st = (st[0], st[1], st[2]) if len(st) >= 3 else (st[0], st[1], st[1])
            fs[s] = calc_growth_unit(st[0], st[1], ri)
        mov = raw.get('Move', (0, 0)); mov = (mov[0], mov[1]) if isinstance(mov, (list, tuple)) and len(mov) >= 2 else (mov if isinstance(mov, (int, float)) else 0, mov if isinstance(mov, (int, float)) else 0)
        fs['Move'] = mov[0] if isinstance(mov, (list, tuple)) else mov
    ua = unit_abil_map.get(unit_id, [])
    ac = []
    for ab in sorted(ua, key=lambda x: x['sort']):
        bac = build_ability_entry(str(ab['id']), ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=ab['sort'], lang_code=CALC_LANG)
        if str(ab['id']) in rm: bac['ssp_replacement'] = build_ability_entry(rm[str(ab['id'])], ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=ab['sort'], lang_code=CALC_LANG)
        ac.append(bac)
    max_ab_sort = max((int(a.get('sort', 0) or 0) for a in ua), default=0)
    if has_sp:
        for idx, gain_aid in enumerate(unit_ssp_abil_gain_list.get(unit_id, [])):
            so = max_ab_sort + idx + 1
            bac = build_ability_entry(str(gain_aid), ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=so, lang_code=CALC_LANG)
            bac['ssp_only'] = True
            ac.append(bac)
    spb = {s: 0 for s in UNIT_STAT_ORDER}
    spc = {s: 0 for s in UNIT_STAT_ORDER}
    sspb = {s: 0 for s in UNIT_STAT_ORDER}
    sspc = {s: 0 for s in UNIT_STAT_ORDER}
    nxs = {s: 0 for s in UNIT_STAT_ORDER}
    nxss = {s: 0 for s in UNIT_STAT_ORDER}
    spb_move_flat = [0]; spc_move_flat = [0]; sspb_move_flat = [0]; sspc_move_flat = [0]

    def _ability_has_condition_word(ad):
        name = (ad.get('name') or '').lower()
        cond_words = ('condition', 'conditional', 'when countering', 'when counter', 'when attacking', 'when attacked', 'during battle', 'at the start of', 'each time', 'every time')
        if any(w in name for w in cond_words): return True
        for d2 in ad.get('details', []):
            txt = (d2.get('text', '') if isinstance(d2, dict) else str(d2)).lower()
            if any(w in txt for w in cond_words): return True
        return False

    def ep(ad, bd, cd, nd, bd_move_flat, cd_move_flat):
        hc = any(cond for d2 in ad.get('details', []) for cond in d2.get('conditions', []))
        ie = ad.get('is_ex', False)
        ability_cond = _ability_has_condition_word(ad)
        inx = unit_id == '1400000550' and any(kw in (ad.get('name', '') or '').lower() for kw in ['newtype', 'x-rounder', '新人類', 'x rounder'])
        for d2 in ad.get('details', []):
            txt = d2.get('text', '') if isinstance(d2, dict) else str(d2)
            parts = [p.strip() for p in re.split(r'[.\n]+', txt) if p and p.strip()]
            if not parts: parts = [txt]
            cond_prefix = False
            for part in parts:
                itc = _is_conditional_stat_text(part)
                if itc and _unit_hp_threshold_active_at_assumed_full_hp(part):
                    itc = False
                part_stats = _extract_stat_percent_unit(part, skip_conditional=False)
                flat_move = _extract_stat_flat_move(part, skip_conditional=False)
                if itc and not part_stats and not flat_move:
                    cond_prefix = True
                is_cond = itc or cond_prefix
                if flat_move:
                    if inx:
                        pass
                    elif hc or ie or is_cond:
                        cd_move_flat[0] += flat_move
                    else:
                        bd_move_flat[0] += flat_move
                for s, pct in part_stats.items():
                    if s == 'Move': continue
                    if unit_id == '1400000550' and s == 'HP' and pct == 5:
                        bd[s] = bd.get(s, 0) + pct
                        continue
                    if inx:
                        nd[s] = max(nd.get(s, 0), pct)
                    elif hc or ie or is_cond:
                        cd[s] = cd.get(s, 0) + pct
                    else:
                        bd[s] = bd.get(s, 0) + pct

    for ab in ac:
        if ab.get('ssp_only'):
            ep(ab, sspb, sspc, nxss, sspb_move_flat, sspc_move_flat)
            continue
        ep(ab, spb, spc, nxs, spb_move_flat, spc_move_flat)
        if 'ssp_replacement' in ab:
            ep(ab['ssp_replacement'], sspb, sspc, nxss, sspb_move_flat, sspc_move_flat)
        else:
            ep(ab, sspb, sspc, nxss, sspb_move_flat, sspc_move_flat)
    for s in UNIT_STAT_ORDER:
        spc[s] = spc.get(s, 0) + nxs.get(s, 0)
        sspc[s] = sspc.get(s, 0) + nxss.get(s, 0)
    lb_data = []
    for mult in [1.0, 1.2, 1.3, 1.4]:
        cm = 1.0 if info.get('is_ultimate', False) else mult
        lb_fs, lb_fsp, lb_fssp = {}, {}, {}
        if raw:
            for s in ['HP', 'EN', 'Attack', 'Defense', 'Mobility']:
                st = raw.get(s, (0, 0, 0)); st = (st[0], st[1], st[2]) if len(st) >= 3 else (st[0], st[1], st[1])
                gs = calc_growth_unit_base(st[0], st[1], ri); gsp = st[2]
                sb2v, sm2v = ssp_bonus.get(s, (0, 0)); sb2v = sb2v if isinstance(sb2v, (int, float)) else 0; sm2v = sm2v if isinstance(sm2v, (int, float)) else sb2v
                scb = math.floor(sb2v + (sm2v - sb2v) * 0.5) if has_sp and ssp_bonus else 0
                lb_fs[s] = math.floor(gs * cm); lb_fsp[s] = math.floor(gsp * cm); lb_fssp[s] = math.floor((gsp + scb) * cm)
            mov = raw.get('Move', (0, 0)); mov = (mov[0], mov[1]) if isinstance(mov, (list, tuple)) and len(mov) >= 2 else (mov if isinstance(mov, (int, float)) else 0, mov if isinstance(mov, (int, float)) else 0)
            lb_fs['Move'] = mov[0] if isinstance(mov, (list, tuple)) else mov
            lb_fsp['Move'] = mov[1] if isinstance(mov, (list, tuple)) else mov[0]
            lb_fssp['Move'] = lb_fsp['Move'] + (ssp_core.get('move', 0) if has_sp else 0)
        else:
            lb_fs = {s: math.floor(fs.get(s, 0) * cm / 1.4) for s in UNIT_STAT_ORDER}
            lb_fsp = dict(lb_fs)
            lb_fssp = dict(lb_fs)
        snc, swc, spnc, spwc, sspnc, sspwc = [], [], [], [], [], []
        for s in UNIT_STAT_ORDER:
            if s == 'Move':
                mbase = int(lb_fsp.get('Move', 0) or 0)
                mssp = int(lb_fssp.get('Move', 0) or 0)
                mbon = max(0, mssp - mbase)
                bf = spb_move_flat[0]; cf = spc_move_flat[0]; sbf = sspb_move_flat[0]; scf = sspc_move_flat[0]
                snc.append({'name': s, 'total': lb_fs.get(s, 0) + bf, 'bonus': bf})
                swc.append({'name': s, 'total': lb_fs.get(s, 0) + bf + cf, 'bonus': bf + cf})
                spnc.append({'name': s, 'total': mbase + bf, 'bonus': bf})
                spwc.append({'name': s, 'total': mbase + bf + cf, 'bonus': bf + cf})
                sspnc.append({'name': s, 'total': mssp + sbf, 'bonus': mbon + sbf})
                sspwc.append({'name': s, 'total': mssp + sbf + scf, 'bonus': mbon + sbf + scf})
                continue
            bst = lb_fs.get(s, 0); spst = lb_fsp.get(s, 0); sspst = lb_fssp.get(s, 0)
            bb = math.floor(bst * spb.get(s, 0) / 100) if bst else 0
            cb = math.floor(bst * (spb.get(s, 0) + spc.get(s, 0)) / 100) if bst else 0
            snc.append({'name': s, 'total': bst + bb, 'bonus': bb})
            swc.append({'name': s, 'total': bst + cb, 'bonus': cb})
            spbb = math.floor(spst * spb.get(s, 0) / 100) if spst else 0
            spcb = math.floor(spst * (spb.get(s, 0) + spc.get(s, 0)) / 100) if spst else 0
            spnc.append({'name': s, 'total': spst + spbb, 'bonus': spbb})
            spwc.append({'name': s, 'total': spst + spcb, 'bonus': spcb})
            sspbb = math.floor(sspst * sspb.get(s, 0) / 100) if sspst else 0
            sspcb = math.floor(sspst * (sspb.get(s, 0) + sspc.get(s, 0)) / 100) if sspst else 0
            sspnc.append({'name': s, 'total': sspst + sspbb, 'bonus': sspbb})
            sspwc.append({'name': s, 'total': sspst + sspcb, 'bonus': sspcb})
        lb_data.append({'stats_no_cond': snc, 'stats_with_cond': swc, 'sp_stats_no_cond': spnc, 'sp_stats_with_cond': spwc, 'ssp_stats_no_cond': sspnc, 'ssp_stats_with_cond': sspwc})
    return lb_data[3] if len(lb_data) > 3 else (lb_data[-1] if lb_data else None)

def _unit_lb_row_to_api(entry, mode, include_conditional=False):
    if mode == 'normal':
        dlist = entry['stats_with_cond'] if include_conditional else entry['stats_no_cond']
    elif mode == 'sp':
        dlist = entry['sp_stats_with_cond'] if include_conditional else entry['sp_stats_no_cond']
    else:
        dlist = entry['ssp_stats_with_cond'] if include_conditional else entry['ssp_stats_no_cond']
    m = {x['name']: x['total'] for x in dlist}
    return {'HP': m.get('HP', 0), 'EN': m.get('EN', 0), 'ATK': m.get('Attack', 0), 'DEF': m.get('Defense', 0), 'MOB': m.get('Mobility', 0), 'MOV': m.get('Move', 0)}

def resolve_series(ser_set_id, lc):
    ld = get_lang_data(lc); ssm = ld.get('ser_set_map', {}); sl = ld.get('series_list', []); sd = []
    if ser_set_id and ser_set_id != '0':
        for sid in ssm.get(ser_set_id, []):
            name = None
            for lid, val in sl:
                if lid.endswith(sid): name = val; break
            if name:
                icon = series_id_to_icon.get(sid, '') or find_series_icon(sid)
                sd.append({'id': sid, 'name': name, 'icon': icon})
    return sd

def resolve_tags(lin_map, eid, lc, tt='group'):
    ld = get_lang_data(lc); llk = ld.get('lineage_lookup', {}); ll = ld.get('lineage_list', []); tags = []; sn = set()
    for lid in lin_map.get(eid, []):
        name = llk.get(lid)
        if name:
            if name not in sn: tags.append({'id': lid, 'name': name, 'type': tt}); sn.add(name)
        else:
            for fid, val in ll:
                if fid.endswith(lid) and len(lid) >= 4:
                    if val not in sn: tags.append({'id': fid, 'name': val, 'type': tt}); sn.add(val); break
    return sorted(tags, key=lambda x: x['name'])

def resolve_stage_terrain_name(ti, lc='EN'):
    data = STAGE_TERRAIN_MAP.get(str(ti or '0'))
    return data.get(lc, data.get('EN', 'Unknown')) if data else get_ui_label(lc, 'terrain_unknown')

def get_stage_difficulty(sid, lc='EN'):
    s = str(sid)
    if s.startswith('9050'): return {'code': 'normal', 'name': get_ui_label(lc, 'difficulty_normal')}
    if s.startswith('9051'): return {'code': 'hard', 'name': get_ui_label(lc, 'difficulty_hard')}
    if s.startswith('9052'): return {'code': 'expert', 'name': get_ui_label(lc, 'difficulty_expert')}
    return {'code': 'unknown', 'name': 'Unknown'}

def resolve_sortie_restriction_set(set_id, lc):
    if not set_id or set_id == '0': return []
    ld = get_lang_data(lc); llk = ld.get('lineage_lookup', {}); snm = ld.get('series_name_map', {}); rows = []
    for sc in stage_sortie_set_content_map.get(set_id, []):
        tt = sc.get('target_type_index', '0'); gid = sc.get('group_id', '0')
        at = get_ui_label(lc, 'restriction_applies_unit') if tt == '1' else get_ui_label(lc, 'restriction_applies_both')
        rn = []
        for gc in stage_sortie_group_content_map.get(gid, []):
            rt = gc.get('restriction_type_index', '0'); tid = gc.get('target_id', '0')
            src = llk if rt == '2' else (snm if rt == '1' else {})
            name = src.get(tid)
            if not name:
                for k, v in src.items():
                    if k.endswith(tid): name = v; break
            if name and name not in rn: rn.append(name)
        rows.append({'target_type_index': tt, 'applies_to': at, 'restriction_names': rn})
    return rows

def resolve_stage_conditions(sid, lc):
    ld = get_lang_data(lc); ctm = ld.get('stage_condition_text_map', {}); sm = stage_map.get(sid, {}); csid = sm.get('battle_condition_set_id', sid)
    victory, defeat = [], []
    for c in stage_condition_map.get(csid, []):
        tid = c.get('text_lang_id', ''); txt = ctm.get(tid, '')
        if not txt:
            for k, v in ctm.items():
                if k == tid or k.endswith(tid): txt = v; break
        if not txt: continue
        ct = str(c.get('category_type_index', '0'))
        if ct == '1': victory.append(txt)
        elif ct == '3': defeat.append(txt)
    return victory, defeat

def build_map_grid(w, h, u): return {'width': w, 'height': h, 'units': u}

def get_ally_formation_offsets(dt):
    d = str(dt or '1')
    if d == '2': return [{'slot': 1, 'dx': 0, 'dy': 0}, {'slot': 2, 'dx': -2, 'dy': -1}, {'slot': 3, 'dx': 2, 'dy': -1}, {'slot': 4, 'dx': -1, 'dy': -2}, {'slot': 5, 'dx': 1, 'dy': -2}]
    elif d == '4': return [{'slot': 1, 'dx': 0, 'dy': 0}, {'slot': 2, 'dx': 2, 'dy': 1}, {'slot': 3, 'dx': -2, 'dy': 1}, {'slot': 4, 'dx': 1, 'dy': 2}, {'slot': 5, 'dx': -1, 'dy': 2}]
    elif d == '1': return [{'slot': 1, 'dx': 0, 'dy': 0}, {'slot': 2, 'dx': -1, 'dy': 2}, {'slot': 3, 'dx': -1, 'dy': -2}, {'slot': 4, 'dx': -2, 'dy': 1}, {'slot': 5, 'dx': -2, 'dy': -1}]
    elif d == '3': return [{'slot': 1, 'dx': 0, 'dy': 0}, {'slot': 2, 'dx': 1, 'dy': -2}, {'slot': 3, 'dx': 1, 'dy': 2}, {'slot': 4, 'dx': 2, 'dy': -1}, {'slot': 5, 'dx': 2, 'dy': 1}]
    return [{'slot': 1, 'dx': 0, 'dy': 0}, {'slot': 2, 'dx': -2, 'dy': -1}, {'slot': 3, 'dx': 2, 'dy': -1}, {'slot': 4, 'dx': -1, 'dy': -2}, {'slot': 5, 'dx': 1, 'dy': -2}]

def build_ally_positions(msid):
    pl = map_stage_group_initial_placement_lookup.get(msid, [])
    allies = []
    for p in pl:
        bx, by, gn = p['x'], p['y'], p.get('battle_side_type', '1')
        for off in get_ally_formation_offsets(p.get('direction')):
            allies.append({'group_no': gn, 'slot': off['slot'], 'x': bx + off['dx'], 'y': by + off['dy'], 'direction': p.get('direction')})
    return allies

def resolve_npc_unit_abilities(asid, lc):
    if not asid or asid == '0': return []
    ld = get_lang_data(lc)
    return [build_ability_entry(e['id'], ld.get('abil_name_map', {}), abil_link_map, trait_set_traits_map, trait_data_map, ld.get('lang_text_map', {}), ld.get('lang_text_map', {}), trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), ability_resource_map, ld.get('abil_desc_map', {}), sort_order=e.get('sort', 0), lang_code=lc) for e in map_npc_unit_ability_set_lookup.get(asid, [])]

def resolve_npc_character_abilities(asid, lc):
    if not asid or asid == '0': return []
    ld = get_lang_data(lc)
    return [build_ability_entry(e['id'], ld.get('abil_name_map', {}), abil_link_map, trait_set_traits_map, trait_data_map, ld.get('lang_text_map', {}), ld.get('lang_text_map', {}), trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), ability_resource_map, ld.get('abil_desc_map', {}), sort_order=e.get('sort', 0), lang_code=lc) for e in map_npc_character_ability_set_lookup.get(asid, [])]

def resolve_char_skill(sid, ld, sv, isp):
    stm = ld.get('skill_text_map', {}); info = char_skill_info_map.get(sid, {})
    nlid = normalize_id(info.get('name_lang_id', '')); dlid = normalize_id(info.get('desc_lang_id', ''))
    name, desc = 'Unknown', ''
    fallback_name = ld.get('skill_trait_name_fallback', {}).get(sid, '')
    fallback_desc = ld.get('skill_trait_desc_fallback', {}).get(sid, '')
    if nlid and nlid != '0':
        entries = stm.get(nlid)
        if entries and isinstance(entries, list) and len(entries) > 0:
            best = next((x for x in entries if x.get('full_id') == nlid), entries[0])
            name = best.get('text', '')
            if fallback_name and name != fallback_name:
                name = fallback_name
    if dlid and dlid != '0':
        entries = stm.get(dlid)
        if entries and isinstance(entries, list) and len(entries) > 0:
            best = next((x for x in entries if x.get('full_id') == dlid), entries[0])
            desc = best.get('text', '') or ''
    if fallback_desc and not desc:
        desc = fallback_desc
    if name == 'Unknown':
        bi = sid[:-2] if len(sid) > 2 else sid
        for k in [bi, sid, sid[-9:] if len(sid) >= 9 else None]:
            if k and k in stm:
                entries = stm[k]
                if entries:
                    best = next((x for x in entries if x.get('full_id') == nlid), entries[0])
                    name = best.get('text', '')
                    if fallback_name and name != fallback_name:
                        name = fallback_name
                    if len(entries) > 1:
                        others = [x.get('text', '') for x in entries if x.get('full_id') == dlid]
                        if others: desc = '\n'.join(others)
                break
    if name == 'Unknown' and fallback_name:
        name = fallback_name
    ri = info.get('resource_id', '') or ld.get('skill_resource_map', {}).get(sid, ''); icf = find_trait_icon(ri)
    return {'id': sid, 'name': name, 'sort': sv, 'details': [desc] if desc else [], 'icon': f"/static/images/Trait/{icf}" if icf else '', 'has_icon': bool(icf), 'is_ex': False, 'is_sp': isp, 'frame_overlay': '', 'resource_id': ri}

def resolve_npc_character_skills(ssid, lc):
    if not ssid or ssid == '0': return []
    ld = get_lang_data(lc)
    return [resolve_char_skill(e['id'], ld, i + 1, False) for i, e in enumerate(map_npc_character_skill_set_lookup.get(ssid, []))]

def eval_icon_color(tl, wt):
    if wt == '2': return 'ex'
    if wt == '3': return 'map'
    if not tl: return 'green'
    hp, hd = False, False
    for tr in tl:
        trl = tr.lower()
        if 'the max range of' in trl or '最大射程' in trl: hp = True; continue
        if re.search(r'(decrease|reduce)s?\s+target', trl) or 'inflict' in trl: hd = True
        elif re.search(r'(降低|減少|下降|賦予)', trl):
            if '敵' in trl: hd = True
            elif not ('自身' in trl or '我方' in trl) and re.search(r'防禦|機動|攻擊|命中|迴避|en|hp', trl): hd = True
            elif '賦予' in trl: hd = True
    if hp: return 'purple'
    return 'yellow' if hd else 'orange'

def resolve_npc_unit_weapons(wsid, uid, ubr, lc):
    ld = get_lang_data(lc); weapons = []
    for w in map_npc_unit_weapon_set_lookup.get(wsid, []):
        wid = w.get('weapon_id', '0'); wm = weapon_info_map.get(wid, {}); wn = ld.get('weapon_text_map', {}).get(wm.get('name_lang_id', '0'), 'Unknown')
        ai = wm.get('attribute', '0'); wt = wm.get('weapon_type', '1'); ainfo = WEAPON_ATTR_MAP.get(ai, {'label': 'Unknown', 'icon': ''})
        at = ATTACK_ATTR_TYPES.get(wm.get('attack_attribute', '0'), [])
        ws = resolve_weapon_stats(wm, weapon_status_map, weapon_correction_map, ld.get('weapon_trait_map', {}), ld.get('weapon_capability_map', {}), growth_pattern_map, weapon_trait_change_map, ld.get('weapon_trait_detail_map', {}), wid=wid, lang_code=lc, unit_id=uid)
        ic = resolve_weapon_icon(wt, ai, ubr)
        if uid == '1330005900' and wt == '3': ic = {'icon': '/static/images/UI/UI_Battle_MapUI_MapWeapon_Icon_Blue.png', 'overlay': '', 'is_ex': False, 'is_map': True}; at = [{'is_supply': True, 'icon': '/static/images/UI/Sprite/UI_Common_Icon_MapWeapon_Mp.png', 'label': 'MP'}]
        levels = ws.get('levels', [{'level': i, 'power': ws.get('power', 0), 'en': ws.get('en', 0), 'accuracy': ws.get('accuracy', 0), 'critical': ws.get('critical', 0), 'ammo': ws.get('ammo', 0) if wt == '3' else 0, 'traits': ws.get('traits', [])} for i in range(1, 6)])
        lv5t = levels[4]['traits'] if len(levels) > 4 else []; ip = any('preemptive strike' in tr.lower() or '先制' in tr.lower() for tr in lv5t); icc = eval_icon_color(lv5t, wt)
        weapons.append({'id': wid, 'name': wn, 'attribute': ainfo['label'], 'attribute_id': ai, 'weapon_type': wt, 'attack_types': at, 'levels': levels, 'min_range': ws.get('range_min', 0), 'max_range': ws.get('range_max', 0), 'usage_restrictions': ws.get('usage_restrictions', []), 'sort': w.get('sort_order', 0), 'icon': ic['icon'], 'overlay': ic['overlay'], 'is_ex': ic['is_ex'], 'is_map': ic['is_map'], 'icon_color': icc, 'ssp_icon_color': icc, 'map_coords': [], 'shooting_coords': [], 'is_dash': False, 'is_ssp_weapon': False, 'ssp_icon': '', 'ssp_power_bonus': 0, 'ssp_ammo_bonus': 0, 'ssp_range_bonus': 0, 'ssp_traits': [], 'is_preemptive': ip})
    weapons.sort(key=lambda x: (0 if x['weapon_type'] == '3' else 1, x['sort']))
    return weapons

def calculate_npc_team_bonuses(npc_entries, lc):
    tb = {'HP': 0, 'EN': 0, 'Attack': 0, 'Defense': 0, 'Mobility': 0, 'Move': 0}
    for npc in npc_entries:
        nu = map_npc_unit_lookup.get(npc['id'], [])
        if not nu: continue
        for ab in resolve_npc_unit_abilities(nu[0].get('ability_set_id', '0'), lc):
            for d in ab.get('details', []):
                txt = d.get('text', '') if isinstance(d, dict) else str(d)
                for s, pct in _extract_stat_percent_unit(txt).items(): tb[s] = tb.get(s, 0) + pct
    return tb

def apply_team_bonus_to_unit_stats(stats, bonus):
    final, ba = {}, {}
    for k in ['HP', 'EN', 'Attack', 'Defense', 'Mobility', 'Move']:
        base = stats.get(k, 0); pct = bonus.get(k, 0)
        b = math.floor(base * pct / 100) if base > 0 and pct else 0
        final[k] = base + b; ba[k] = b
    return final, ba

def apply_bonus_to_char_stats(stats, bonus_pct):
    final, ba = {}, {}
    for k in ['Ranged', 'Melee', 'Defense', 'Reaction', 'Awaken']:
        base = stats.get(k, 0); pct = bonus_pct.get(k, 0)
        b = math.floor(base * pct / 100) if base > 0 and pct else 0
        final[k] = base + b; ba[k] = b
    return final, ba

def compute_char_stat_totals_with_abilities(char_id, ri, ldc, grown):
    """List view: main 5 stats with passive bonuses that apply without toggles — same rules as unit list.
    Excludes: EX character abilities (detail: stats vs stats_with_ex), conditional sentences, trait-condition abilities."""
    fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == char_id]
    def build_ab(ab):
        bid = normalize_id(ab.get('AbilityId', '')); spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
        d = ldc
        bab = build_ability_entry(bid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        if spid and spid != '0' and spid != 'None' and spid != bid:
            bab['sp_replacement'] = build_ability_entry(spid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        return bab
    ac = [build_ab(ab) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))]
    spbn = {s: 0 for s in CHAR_STAT_ORDER}
    for bab in ac:
        if bab.get('is_ex', False):
            continue
        hc = any(cond for d2 in bab.get('details', []) for cond in d2.get('conditions', []))
        for d2 in bab.get('details', []):
            txt = d2.get('text', '') if isinstance(d2, dict) else str(d2)
            parts = [p.strip() for p in re.split(r'[.\n]+', txt) if p and p.strip()]
            if not parts:
                parts = [txt]
            cond_prefix = False
            for part in parts:
                itc = _is_conditional_stat_text(part)
                part_stats = extract_stat_percent_char(part)
                if itc and not part_stats:
                    cond_prefix = True
                is_cond = itc or cond_prefix
                for s, pct in part_stats.items():
                    if s not in CHAR_STAT_ORDER:
                        continue
                    if hc or is_cond:
                        continue
                    spbn[s] = spbn.get(s, 0) + pct
    totals = {}
    for s in CHAR_STAT_ORDER:
        bv = grown.get(s, 0)
        tb = math.floor(bv * spbn[s] / 100) if bv > 0 else 0
        totals[s] = bv + tb
    return totals

def compute_char_stat_totals_sp_list(char_id, ri, ldc, grown_sp):
    """SP growth column + SP ability bonuses (same as get_character sp_stats / non-EX)."""
    fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == char_id]
    def build_ab(ab):
        bid = normalize_id(ab.get('AbilityId', '')); spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
        d = ldc
        bab = build_ability_entry(bid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        if spid and spid != '0' and spid != 'None' and spid != bid:
            bab['sp_replacement'] = build_ability_entry(spid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        return bab
    ac = [build_ab(ab) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))]
    spbs = {s: 0 for s in CHAR_STAT_ORDER}
    for bab in ac:
        sab = bab.get('sp_replacement', bab)
        for d2 in sab.get('details', []):
            for s, p in extract_stat_percent_char(d2['text']).items():
                if sab.get('is_ex', False):
                    continue
                spbs[s] = spbs.get(s, 0) + p
    totals = {}
    for s in CHAR_STAT_ORDER:
        sbv = grown_sp.get(s, 0)
        sbon = math.floor(sbv * spbs[s] / 100) if sbv > 0 else 0
        totals[s] = sbv + sbon
    return totals

def compute_char_stat_totals_detail_style(char_id, ri, ldc, grown):
    """Non-SP growth + ability bonuses matching get_character stats_with_ex (includes EX stat lines)."""
    fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == char_id]
    def build_ab(ab):
        bid = normalize_id(ab.get('AbilityId', '')); spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
        d = ldc
        bab = build_ability_entry(bid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        if spid and spid != '0' and spid != 'None' and spid != bid:
            bab['sp_replacement'] = build_ability_entry(spid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        return bab
    ac = [build_ab(ab) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))]
    spbn = {s: 0 for s in CHAR_STAT_ORDER}
    spen = {s: 0 for s in CHAR_STAT_ORDER}
    for bab in ac:
        for d2 in bab.get('details', []):
            for s, p in extract_stat_percent_char(d2['text']).items():
                if bab.get('is_ex', False):
                    spen[s] += p
                else:
                    spbn[s] += p
    totals = {}
    for s in CHAR_STAT_ORDER:
        bv = grown.get(s, 0)
        pct = spbn[s] + spen[s]
        totals[s] = bv + math.floor(bv * pct / 100) if bv > 0 else 0
    return totals

def compute_char_stat_totals_sp_list_with_ex(char_id, ri, ldc, grown_sp):
    """SP growth + SP ability bonuses including EX lines (sp_stats_with_ex)."""
    fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == char_id]
    def build_ab(ab):
        bid = normalize_id(ab.get('AbilityId', '')); spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
        d = ldc
        bab = build_ability_entry(bid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        if spid and spid != '0' and spid != 'None' and spid != bid:
            bab['sp_replacement'] = build_ability_entry(spid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        return bab
    ac = [build_ab(ab) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))]
    spbs = {s: 0 for s in CHAR_STAT_ORDER}
    spes = {s: 0 for s in CHAR_STAT_ORDER}
    for bab in ac:
        sab = bab.get('sp_replacement', bab)
        for d2 in sab.get('details', []):
            for s, p in extract_stat_percent_char(d2['text']).items():
                if sab.get('is_ex', False):
                    spes[s] += p
                else:
                    spbs[s] += p
    totals = {}
    for s in CHAR_STAT_ORDER:
        sbv = grown_sp.get(s, 0)
        pct = spbs[s] + spes[s]
        totals[s] = sbv + math.floor(sbv * pct / 100) if sbv > 0 else 0
    return totals

def calculate_npc_character_self_bonus_pct(abilities):
    bp = {k: 0 for k in ['Ranged', 'Melee', 'Defense', 'Reaction', 'Awaken']}
    if not abilities: return bp
    for ab in abilities:
        for d in (ab.get('details', []) if isinstance(ab, dict) else []):
            txt = d.get('text', '') if isinstance(d, dict) else str(d)
            if not txt or _is_conditional_stat_text(txt): continue
            for s, p in extract_stat_percent_char(txt).items():
                if s in bp: bp[s] = bp.get(s, 0) + p
    return bp

def get_large_unit_cells(x, y):
    return [{'x': x, 'y': y}, {'x': x + 1, 'y': y}, {'x': x, 'y': y + 1}, {'x': x + 1, 'y': y + 1}]

def is_large_map_npc(npc_id, npc_entry=None):
    if npc_entry is None: npc_entry = map_npc_lookup.get(npc_id, {})
    if str(npc_id) == '905200000102000002': return False
    if str(npc_id) == '905100000102000002': return False
    if str(npc_id) == '1095003400': return False
    nu = map_npc_unit_lookup.get(npc_id, [])
    if not nu: return False
    uid = nu[0].get('unit_id', '0')
    if uid == '905200000102000002': return False
    if uid == '905100000102000002': return False
    if uid == '1095003400': return False
    ui = unit_info_map.get(uid, {})
    msid = str(ui.get('mechanism_set_id', '0'))
    ml = MECH_MAP_TABLE.get(msid, [])
    if '2x2' in ml: return True
    ut = unit_lin_map.get(uid, [])
    for tag_id in ut:
        if tag_id == '1067' or (isinstance(tag_id, str) and tag_id.endswith('1067')): return True
    return False

def get_npc_unit_display(uid, usr, lc):
    ld = get_lang_data(lc); info = unit_info_map.get(uid, {}); lid = ld.get('unit_id_map', {}).get(uid, '')
    un = ld.get('unit_text_map', {}).get(lid, f"Unknown ({uid})") if lid else f"Unknown ({uid})"
    p = find_portrait(info.get('resource_ids', []), uid, 'images/unit_portraits')
    return {'id': uid, 'name': un, 'portrait': p or '', 'rarity': RARITY_MAP.get(info.get('rarity', '1'), 'N'), 'rarity_icon': RARITY_ICON_MAP.get(info.get('rarity', '1'), ''), 'role': ROLE_MAP.get(info.get('role', '0'), 'NPC'), 'role_icon': ROLE_ICON_MAP.get(info.get('role', '0'), ''), 'stats_raw': usr, 'tags': resolve_tags(unit_lin_map, uid, lc, 'unit'), 'series': resolve_series(unit_ser_map.get(uid, ''), lc)}

def get_npc_character_display(cid, csr, lc):
    ld = get_lang_data(lc); info = char_info_map.get(cid, {}); lid = ld.get('char_id_map', {}).get(cid, '')
    cn = ld.get('char_text_map', {}).get(lid, f"Unknown ({cid})") if lid else f"Unknown ({cid})"
    p = find_portrait(info.get('resource_ids', []), cid, 'images/portraits')
    return {'id': cid, 'name': cn, 'portrait': p or '', 'rarity': RARITY_MAP.get(info.get('rarity', '1'), 'N'), 'rarity_icon': RARITY_ICON_MAP.get(info.get('rarity', '1'), ''), 'role': ROLE_MAP.get(info.get('role', '0'), 'NPC'), 'role_icon': ROLE_ICON_MAP.get(info.get('role', '0'), ''), 'stats_raw': csr, 'tags': resolve_tags(char_lin_map, cid, lc, 'character'), 'series': resolve_series(ld.get('char_ser_map', {}).get(cid, ''), lc)}

def validate_lang_code(lc):
    lc = (lc or DEFAULT_LANG).upper()
    if lc == 'JP':
        lc = 'JA'
    if lc == 'JA' and not jp_mode_unlocked():
        return DEFAULT_LANG
    if lc not in LANG_DATA: lc = DEFAULT_LANG
    return lc

def series_names_lower_for_search(ser_list):
    """Lowercased series display names plus stable aliases for series-only search (e.g. series:msg → original Mobile Suit Gundam)."""
    names = [x['name'].lower() for x in ser_list if x.get('name')]
    sids = {normalize_id(x.get('id')) for x in ser_list if x.get('id')}
    if SERIES_ID_MOBILE_SUIT_GUNDAM in sids:
        names.append('msg')
    if SERIES_ID_08TH_MS_TEAM in sids:
        names.extend(['08 ms', '08ms', '08th ms'])
    return names

def series_alias_tokens_for_haystack(ser_list):
    """Tokens mirrored into the main searchable text so plain 'msg' matches MSG-series rows (positive terms, not only series:)."""
    sids = {normalize_id(x.get('id')) for x in ser_list if x.get('id')}
    toks = []
    if SERIES_ID_MOBILE_SUIT_GUNDAM in sids:
        toks.append('msg')
    if SERIES_ID_08TH_MS_TEAM in sids:
        toks.extend(['08 ms', '08ms', '08th ms'])
    return toks

def parse_q_scope(val):
    """Browse list text search breadth: 'full' includes abilities/skills/weapons/etc.; 'primary' is name, id, tags, series, aliases only.
    Primary also uses stricter ASCII token matching (word-start / whole short tokens) so substrings like 'wing' do not match inside unrelated words (e.g. 'swing')."""
    return 'primary' if (val or '').strip().lower() == 'primary' else 'full'


def parse_search_query(sq):
    """Parse list search: comma/semicolon segments. positive (must appear in haystack), negative (must not), series (substring in any series name).
    Leading '-' = exclusion. 'series:foo' = match series only (handled separately).
    'series_id:10' = exact m_series SeriesId (numeric) for that row's resolved series (no substring bleed with other Gundam titles)."""
    positive, negative, series, series_ids = [], [], [], []
    if not sq or not str(sq).strip():
        return {'positive': [], 'negative': [], 'series': [], 'series_ids': []}
    segments = [t.strip() for t in re.split(r'[,;]', str(sq).strip()) if t.strip()]
    for seg in segments:
        seg = seg.replace('\uff1a', ':').replace('\u3000', ' ').strip()
        sl = seg.lower()
        if sl.startswith('-') and len(sl) > 1:
            negative.append(sl[1:].strip())
            continue
        m = re.match(r'(?i)^series_id\s*:\s*(\d+)$', seg.strip())
        if m:
            series_ids.append(m.group(1))
            continue
        m = re.match(r'(?i)^series\s*:\s*(.+)$', seg.strip())
        if m:
            rest = m.group(1).strip()
            if rest:
                series.append(rest.lower())
            continue
        positive.append(sl)
    return {'positive': positive, 'negative': negative, 'series': series, 'series_ids': series_ids}

def _positive_segment_subterms(term):
    """Split one positive segment on whitespace into AND subterms (e.g. 'wing zero' -> ['wing','zero']).
    Comma/semicolon still separate AND segments; spaces inside a segment no longer require an adjacent phrase."""
    if not term:
        return []
    parts = [p for p in str(term).split() if p]
    return parts if parts else [term]


def _search_term_matches_in_text(term, haystack_lower, *, primary=False):
    """Match a search token against haystack (already lowercased).
    Full: short ASCII tokens use full word boundaries; 3+ char ASCII uses substring (prefix-friendly for names).
    Primary: ASCII tokens use word-start (or whole-word for length <=2) so e.g. 'wing' does not match inside 'swing'."""
    if not term:
        return True
    t = term.lower()
    if not t.isascii() or not re.match(r'^[a-z0-9._+]+$', t):
        return t in haystack_lower
    if primary:
        if len(t) <= 2:
            try:
                return bool(re.search(r'(?<![\w])' + re.escape(t) + r'(?![\w])', haystack_lower, re.I))
            except re.error:
                return t in haystack_lower
        try:
            return bool(re.search(r'(?<![\w])' + re.escape(t), haystack_lower, re.I))
        except re.error:
            return t in haystack_lower
    if len(t) > 2:
        return t in haystack_lower
    try:
        return bool(re.search(r'(?<![\w])' + re.escape(t) + r'(?![\w])', haystack_lower, re.I))
    except re.error:
        return t in haystack_lower

def search_row_matches_query(sq, haystack_lower, series_names_lower_list, ser_list=None, entity_id=None, primary=False):
    """AND: all positive terms match haystack; none of negative; each series term matches some series name (or combined tags string).
    series_names_lower_list: list of strings (per-series names, or one element = full tag blob for mods). None = entity type has no series data → series: terms never match.
    ser_list: optional resolved series dicts [{id, name, icon}, ...] for exact series_id: filters.
    entity_id: when set and search_query_matches_entity_id(sq, entity_id), skip positive haystack matching so ID-only / ID-targeted searches still find NPC-only rows.
    primary: browse Core scope — stricter ASCII token matching (word-start) on name/tag/series haystack."""
    if not sq or not str(sq).strip():
        return True
    pq = parse_search_query(sq)
    if not pq['positive'] and not pq['negative'] and not pq['series'] and not pq.get('series_ids'):
        return True
    id_match = entity_id is not None and search_query_matches_entity_id(sq, entity_id)
    if not id_match:
        for p in pq['positive']:
            for sub in _positive_segment_subterms(p):
                if not _search_term_matches_in_text(sub, haystack_lower, primary=primary):
                    return False
    for n in pq['negative']:
        if _search_term_matches_in_text(n, haystack_lower, primary=primary):
            return False
    for s in pq['series']:
        if series_names_lower_list is None:
            return False
        if not any((s == sn) or _search_term_matches_in_text(s, sn, primary=primary) for sn in series_names_lower_list):
            return False
    for sid in pq.get('series_ids') or []:
        if not ser_list:
            return False
        if not any(normalize_id(x.get('id')) == sid for x in ser_list if x.get('id')):
            return False
    return True

def search_query_matches_entity_id(sq, eid):
    """True when the search box is used to find an entity by id (exact or a 4+ digit fragment). Surfaces NPC-only list rows.
    Only **positive** segments contribute digit fragments; series:/negative ignored for id."""
    if not sq or not str(sq).strip():
        return False
    eid = normalize_id(eid)
    pq = parse_search_query(sq)
    terms = pq['positive']
    if not terms:
        return False
    had_digit_term = False
    for tr in terms:
        q_digits = ''.join(c for c in tr if c.isdigit())
        if not q_digits:
            continue
        had_digit_term = True
        ok = (q_digits == eid) or (len(q_digits) >= 4 and q_digits in eid)
        if not ok:
            return False
    if not had_digit_term:
        return False
    return True

def _list_row_id_tiebreak(r):
    """Secondary list sort key after rarity / stats: numeric id when possible."""
    raw = r.get('id', '')
    s = str(raw).strip()
    if s.isdigit():
        return (0, int(s))
    return (1, s.lower())

def sort_rows(rows, sort_by, sort_dir, valid_sorts, default_sort='rarity'):
    if sort_by not in valid_sorts: sort_by = default_sort
    if sort_by in LIST_STAT_SORT_PRIMARY and sort_by in valid_sorts:
        def _num(v):
            try:
                return float(v) if v is not None else 0.0
            except (TypeError, ValueError):
                return 0.0
        if sort_dir == 'desc':
            rows.sort(key=lambda r: (-_num(r.get(sort_by)), _list_row_id_tiebreak(r)))
        else:
            rows.sort(key=lambda r: (_num(r.get(sort_by)), _list_row_id_tiebreak(r)))
        return rows
    if sort_by == 'rarity':
        if sort_dir == 'asc': rows.sort(key=lambda r: (-r['rarity_sort'], _list_row_id_tiebreak(r)))
        else: rows.sort(key=lambda r: (r['rarity_sort'], _list_row_id_tiebreak(r)))
    elif sort_by == 'name':
        if sort_dir == 'asc': rows.sort(key=lambda r: (r['rarity_sort'], r['name'].lower()))
        else: rows.sort(key=lambda r: (r['rarity_sort'], r['name'].lower())); rows.sort(key=lambda r: r['name'].lower(), reverse=True); rows.sort(key=lambda r: r['rarity_sort'])
    elif sort_by == 'role':
        if sort_dir == 'desc': rows.sort(key=lambda r: (r['rarity_sort'], r.get('role_sort',3), _list_row_id_tiebreak(r)))
        else: rows.sort(key=lambda r: (r['rarity_sort'], -r.get('role_sort',3), _list_row_id_tiebreak(r)))
    elif sort_by in ('series_tag', 'boost', 'details'):
        def _str_key(r, rev=False):
            s = (str(r.get(sort_by, '') or '')).lower()
            return (r['rarity_sort'], tuple(-ord(c) for c in s) if rev else s, _list_row_id_tiebreak(r))
        if sort_dir == 'asc': rows.sort(key=lambda r: _str_key(r, False))
        else: rows.sort(key=lambda r: _str_key(r, True))
    else:
        if sort_dir == 'desc': rows.sort(key=lambda r: (r['rarity_sort'], -r.get(sort_by, 0), _list_row_id_tiebreak(r)))
        else: rows.sort(key=lambda r: (r['rarity_sort'], r.get(sort_by, 0), _list_row_id_tiebreak(r)))
    return rows

# ═══════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════

def _serve_index():
    r = make_response(render_template(
        'index.html',
        image_cdn=IMAGE_CDN or '',
    ))
    r.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    r.headers['Pragma'] = 'no-cache'
    r.headers['Expires'] = '0'
    return r

@app.route('/')
def index(): 
    return _serve_index()

_LANG_ORDER = ('EN', 'TW', 'HK', 'JA')

@app.route('/api/languages')
def get_languages():
    ordered = [lc for lc in _LANG_ORDER if lc in LANG_DATA]
    display_languages = [('JP' if lc == 'JA' else lc) for lc in ordered]
    return jsonify(convert_image_urls({'languages': display_languages, 'default': DEFAULT_LANG}))

WHATS_NEW_JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'whats_new.json')

@app.route('/api/whats_new')
def api_whats_new():
    """Changelog: pending diff vs snapshot, historical archive pairs, plus optional manual entries in data/whats_new.json.

    Tab *label* / *date* for auto entries is always the period end (newer baseline / today's data): e.g. diff 23→25 is labeled 25;
    pending diff since last snapshot on disk is labeled with today's master-data date (e.g. 27).

    History tabs require files under data/whats_new_history_snapshots/ (see refresh_whats_new_snapshot.py or
    scripts/backfill_whats_new_history.py). *tabs* / *entries* are sorted latest date first.
    """
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
    tabs = []
    entries = []
    try:
        pending_tab = None
        entry_pending = None
        snap_cur = load_whats_new_snapshot()
        if snap_cur:
            pending = compute_whats_new_delta(lc)
            date = _whats_new_master_data_date()
            pending_tab = {
                'kind': 'pending',
                'id': 'pending',
                'label': date,
                'date': date,
                'changes': (pending or {}).get('changes') or [],
                'added': (pending or {}).get('added') or [],
            }
            entry_pending = {
                'date': date,
                'changes': (pending or {}).get('changes') or [],
                'added': (pending or {}).get('added') or [],
            }
        history_items = []
        chain = _load_whats_new_snapshot_chain()
        for i in range(len(chain) - 1, 0, -1):
            delta = compute_whats_new_delta_between(chain[i - 1], chain[i], lc)
            if not delta:
                continue
            snap_newer = chain[i]
            label_date = (snap_newer.get('captured_at') or '').strip()
            if not label_date:
                label_date = (delta.get('date') or '').strip() or _whats_new_master_data_date()
            tab = {
                'kind': 'history',
                'id': 'history_%d' % i,
                'label': label_date,
                'date': label_date,
                'changes': delta.get('changes') or [],
                'added': delta.get('added') or [],
            }
            entry = {
                'date': label_date,
                'changes': delta.get('changes') or [],
                'added': delta.get('added') or [],
            }
            history_items.append((tab, entry))
        history_items.sort(key=lambda it: (it[0].get('label') or it[0].get('date') or ''))
        for tab, entry in history_items:
            tabs.append(tab)
            entries.append(entry)
        if pending_tab:
            tabs.append(pending_tab)
        if entry_pending:
            entries.append(entry_pending)
    except Exception:
        import traceback
        traceback.print_exc()
    try:
        if os.path.isfile(WHATS_NEW_JSON_PATH):
            with open(WHATS_NEW_JSON_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            manual = []
            if isinstance(data, dict) and 'entries' in data:
                manual = data['entries']
            elif isinstance(data, list):
                manual = data
            if isinstance(manual, list):
                for mi, e in enumerate(manual):
                    if isinstance(e, dict):
                        tabs.append({
                            'kind': 'manual',
                            'id': 'manual_%d' % mi,
                            'date': e.get('date'),
                            'changes': e.get('changes') or [],
                            'added': e.get('added') or [],
                        })
                        entries.append(e)
    except Exception:
        import traceback
        traceback.print_exc()
    if len(tabs) == len(entries) and tabs:

        def _wn_tab_date_key(tab):
            return ((tab.get('date') or tab.get('label') or '') if isinstance(tab, dict) else '').strip()

        pairs = list(zip(tabs, entries))
        pairs.sort(key=lambda it: _wn_tab_date_key(it[0]), reverse=True)
        tabs = [p[0] for p in pairs]
        entries = [p[1] for p in pairs]
    payload = {
        'tabs': tabs,
        'entries': entries,
        'generated_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
    }
    resp = make_response(jsonify(payload))
    resp.headers['Cache-Control'] = 'no-store'
    return resp

@app.route('/api/tag_units')
def get_tag_units():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); ts = request.args.get('tags', '').strip(); op = request.args.get('op', 'and').lower()
        if not ts: return jsonify({'1': [], '2': [], '3': []})
        tl = [t.strip().lower() for t in ts.split(',') if t.strip()]; ck = f"tag_units_{ts}_{op}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); results = {'1': [], '2': [], '3': []}
        rnm = UNIT_ROLE_TYPE_LANG_MAP.get(lc, UNIT_ROLE_TYPE_LANG_MAP['EN']); rnm_en = UNIT_ROLE_TYPE_LANG_MAP.get('EN', {})
        for uid, info in unit_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']: continue
            lid = ld.get('unit_id_map', {}).get(uid, ''); name = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
            if not name: continue
            tset = set([t.get('name', '').lower() for t in resolve_tags(unit_lin_map, uid, lc, 'unit')] + series_names_lower_for_search(resolve_series(unit_ser_map.get(uid, ''), lc)))
            if rnm.get(ri2): tset.add(rnm[ri2].lower())
            if rnm_en.get(ri2): tset.add(rnm_en[ri2].lower())
            if lc != 'EN':
                tset.update([t.get('name', '').lower() for t in resolve_tags(unit_lin_map, uid, 'EN', 'unit')])
                tset.update(series_names_lower_for_search(resolve_series(unit_ser_map.get(uid, ''), 'EN')))
            match = all(t in tset for t in tl) if op == 'and' else any(t in tset for t in tl)
            if match:
                ri = info.get('rarity', '1'); thum = find_list_thumb(info.get('resource_ids', []), uid, 'images/unit_portraits')
                acq = info.get('acquisition_route', '0'); acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
                results[ri2].append({'id': uid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': acq, 'role_icon': ROLE_ICON_MAP.get(ri2, ''), 'acquisition_icon': acq_icon or ''})
        for r in results: results[r].sort(key=lambda x: (x.get('rarity_sort', 99), safe_int(x.get('id'), 0)))
        set_cached_response(ck, results); return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'1': [], '2': [], '3': []}), 500

@app.route('/api/tag_characters')
def get_tag_characters():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); ts = request.args.get('tags', '').strip(); op = request.args.get('op', 'and').lower()
        if not ts: return jsonify({'1': [], '2': [], '3': []})
        tl = [t.strip().lower() for t in ts.split(',') if t.strip()]; ck = f"tag_chars_{ts}_{op}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); results = {'1': [], '2': [], '3': []}
        rlm = ROLE_NAME_MAP_CHARS.get(lc, ROLE_NAME_MAP_CHARS['EN']); rlm_en = ROLE_NAME_MAP_CHARS.get('EN', {})
        for cid, info in char_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']: continue
            lid = ld.get('char_id_map', {}).get(cid, ''); name = ld.get('char_text_map', {}).get(lid, '') if lid else ''
            if not name: name = f"Unknown ({cid})"
            tset = set([t.get('name', '').lower() for t in resolve_tags(char_lin_map, cid, lc, 'character')] + series_names_lower_for_search(resolve_series(ld.get('char_ser_map', {}).get(cid, ''), lc)))
            br = ROLE_MAP.get(ri2, '')
            if br and rlm.get(br): tset.add(rlm[br].lower())
            if br and rlm_en.get(br): tset.add(rlm_en[br].lower())
            if lc != 'EN':
                tset.update([t.get('name', '').lower() for t in resolve_tags(char_lin_map, cid, 'EN', 'character')])
                tset.update(series_names_lower_for_search(resolve_series(ld.get('char_ser_map', {}).get(cid, ''), 'EN')))
            match = all(t in tset for t in tl) if op == 'and' else any(t in tset for t in tl)
            if match:
                ri = info.get('rarity', '1'); thum = find_list_thumb(info.get('resource_ids', []), cid, 'images/portraits')
                acq = info.get('acquisition_route', '0'); acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
                results[ri2].append({'id': cid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': acq, 'role_icon': ROLE_ICON_MAP.get(ri2, ''), 'acquisition_icon': acq_icon or ''})
        for r in results: results[r].sort(key=lambda x: (x.get('rarity_sort', 99), safe_int(x.get('id'), 0)))
        set_cached_response(ck, results); return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'1': [], '2': [], '3': []}), 500

def _resolved_ability_name_for_tag_scan(abil_id, abnm):
    trait_set_id = abil_link_map.get(abil_id, abil_id)
    lookup_id = trait_set_id[:-2] if len(trait_set_id) > 2 else trait_set_id
    return abnm.get(trait_set_id, abnm.get(lookup_id, abnm.get(abil_id, '')))

def _name_indicates_affinity_ability(ab_name):
    if not ab_name:
        return False
    n = ab_name.lower()
    if 'affinity' in n:
        return True
    if '親和' in ab_name or 'アフィニティ' in ab_name:
        return True
    return False

def _affinity_ability_name_matches_tags(ab_name, tag_tokens_lc, op):
    if not ab_name or not _name_indicates_affinity_ability(ab_name):
        return False
    nl = ab_name.lower()
    if op == 'and':
        return all(t in nl for t in tag_tokens_lc)
    return any(t in nl for t in tag_tokens_lc)

def _character_has_affinity_tag_match(cid, tag_tokens_lc, op, ld):
    fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == cid]
    for ab in fa:
        bid = normalize_id(ab.get('AbilityId', ''))
        spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
        for aid in (bid, spid):
            if not aid or aid in ('0', 'None'):
                continue
            an = _resolved_ability_name_for_tag_scan(aid, ld['abil_name_map'])
            if _affinity_ability_name_matches_tags(an, tag_tokens_lc, op):
                return True
    return False

@app.route('/api/tag_affinity')
def get_tag_affinity():
    """Tag modal Affinity tab: from character context list units with tag; from unit context list characters with Affinity ability names matching tag(s)."""
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        ts = request.args.get('tags', '').strip()
        op = request.args.get('op', 'and').lower()
        source = (request.args.get('source', 'character') or 'character').lower()
        if not ts:
            return jsonify({'1': [], '2': [], '3': []})
        tl = [t.strip().lower() for t in ts.split(',') if t.strip()]
        ck = f"tag_affinity_{source}_{ts}_{op}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached:
            return jsonify(cached)
        ld = get_lang_data(lc)
        results = {'1': [], '2': [], '3': []}
        if source == 'unit':
            for cid, info in char_info_map.items():
                if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                    continue
                ri2 = str(info.get('role', '0'))
                if ri2 not in ['1', '2', '3']:
                    continue
                if not _character_has_affinity_tag_match(cid, tl, op, ld):
                    continue
                lid = ld.get('char_id_map', {}).get(cid, '')
                name = ld.get('char_text_map', {}).get(lid, '') if lid else ''
                if not name:
                    name = f'Unknown ({cid})'
                ri = info.get('rarity', '1')
                thum = find_list_thumb(info.get('resource_ids', []), cid, 'images/portraits')
                acq = info.get('acquisition_route', '0')
                acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
                results[ri2].append({'id': cid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': acq, 'role_icon': ROLE_ICON_MAP.get(ri2, ''), 'acquisition_icon': acq_icon or ''})
            for r in results:
                results[r].sort(key=lambda x: (x.get('rarity_sort', 99), safe_int(x.get('id'), 0)))
        else:
            rnm = UNIT_ROLE_TYPE_LANG_MAP.get(lc, UNIT_ROLE_TYPE_LANG_MAP['EN'])
            rnm_en = UNIT_ROLE_TYPE_LANG_MAP.get('EN', {})
            for uid, info in unit_info_map.items():
                if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                    continue
                ri2 = str(info.get('role', '0'))
                if ri2 not in ['1', '2', '3']:
                    continue
                lid = ld.get('unit_id_map', {}).get(uid, '')
                name = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
                if not name:
                    continue
                tset = set([t.get('name', '').lower() for t in resolve_tags(unit_lin_map, uid, lc, 'unit')] + series_names_lower_for_search(resolve_series(unit_ser_map.get(uid, ''), lc)))
                if rnm.get(ri2):
                    tset.add(rnm[ri2].lower())
                if rnm_en.get(ri2):
                    tset.add(rnm_en[ri2].lower())
                if lc != 'EN':
                    tset.update([t.get('name', '').lower() for t in resolve_tags(unit_lin_map, uid, 'EN', 'unit')])
                    tset.update(series_names_lower_for_search(resolve_series(unit_ser_map.get(uid, ''), 'EN')))
                match = all(t in tset for t in tl) if op == 'and' else any(t in tset for t in tl)
                if match:
                    ri = info.get('rarity', '1')
                    thum = find_list_thumb(info.get('resource_ids', []), uid, 'images/unit_portraits')
                    acq = info.get('acquisition_route', '0')
                    acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
                    results[ri2].append({'id': uid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': acq, 'role_icon': ROLE_ICON_MAP.get(ri2, ''), 'acquisition_icon': acq_icon or ''})
            for r in results:
                results[r].sort(key=lambda x: (x.get('rarity_sort', 99), safe_int(x.get('id'), 0)))
        set_cached_response(ck, results)
        return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'1': [], '2': [], '3': []}), 500

def _entity_has_series_id(ser_list, target_sid):
    """True if resolved series list includes m_series id target_sid."""
    sid = normalize_id(target_sid)
    if not sid or sid == '0':
        return False
    for x in ser_list or []:
        if x.get('id') and normalize_id(x.get('id')) == sid:
            return True
    return False

@app.route('/api/series_characters')
def get_series_characters():
    """Same JSON shape as /api/tag_characters: roles '1','2','3' → lists of playable characters in this series."""
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        raw_sid = request.args.get('series_id', '').strip()
        if not raw_sid:
            return jsonify({'1': [], '2': [], '3': []})
        ck = f"series_chars_{raw_sid}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached:
            return jsonify(cached)
        ld = get_lang_data(lc)
        results = {'1': [], '2': [], '3': []}
        rlm = ROLE_NAME_MAP_CHARS.get(lc, ROLE_NAME_MAP_CHARS['EN']); rlm_en = ROLE_NAME_MAP_CHARS.get('EN', {})
        for cid, info in char_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']:
                continue
            ser_list = resolve_series(ld.get('char_ser_map', {}).get(cid, ''), lc)
            if not _entity_has_series_id(ser_list, raw_sid):
                continue
            lid = ld.get('char_id_map', {}).get(cid, ''); name = ld.get('char_text_map', {}).get(lid, '') if lid else ''
            if not name:
                name = f"Unknown ({cid})"
            ri = info.get('rarity', '1'); thum = find_list_thumb(info.get('resource_ids', []), cid, 'images/portraits')
            acq = info.get('acquisition_route', '0'); acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
            results[ri2].append({'id': cid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': acq, 'role_icon': ROLE_ICON_MAP.get(ri2, ''), 'acquisition_icon': acq_icon or ''})
        for r in results:
            results[r].sort(key=lambda x: (x.get('rarity_sort', 99), safe_int(x.get('id'), 0)))
        set_cached_response(ck, results)
        return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'1': [], '2': [], '3': []}), 500

@app.route('/api/series_units')
def get_series_units():
    """Same JSON shape as /api/tag_units: roles '1','2','3' → lists of playable units in this series."""
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        raw_sid = request.args.get('series_id', '').strip()
        if not raw_sid:
            return jsonify({'1': [], '2': [], '3': []})
        ck = f"series_units_{raw_sid}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached:
            return jsonify(cached)
        ld = get_lang_data(lc)
        results = {'1': [], '2': [], '3': []}
        rnm = UNIT_ROLE_TYPE_LANG_MAP.get(lc, UNIT_ROLE_TYPE_LANG_MAP['EN']); rnm_en = UNIT_ROLE_TYPE_LANG_MAP.get('EN', {})
        for uid, info in unit_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']:
                continue
            ser_list = resolve_series(unit_ser_map.get(uid, ''), lc)
            if not _entity_has_series_id(ser_list, raw_sid):
                continue
            lid = ld.get('unit_id_map', {}).get(uid, ''); name = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
            if not name:
                continue
            ri = info.get('rarity', '1'); thum = find_list_thumb(info.get('resource_ids', []), uid, 'images/unit_portraits')
            acq = info.get('acquisition_route', '0'); acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
            results[ri2].append({'id': uid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': acq, 'role_icon': ROLE_ICON_MAP.get(ri2, ''), 'acquisition_icon': acq_icon or ''})
        for r in results:
            results[r].sort(key=lambda x: (x.get('rarity_sort', 99), safe_int(x.get('id'), 0)))
        set_cached_response(ck, results)
        return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'1': [], '2': [], '3': []}), 500

@app.route('/api/skill_characters')
def get_skill_characters():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        sn = request.args.get('skill_name', '').strip()
        if not sn: return jsonify({'1': [], '2': [], '3': []})
        ck = f"skill_chars_{sn}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); results = {'1': [], '2': [], '3': []}
        sn_lower = sn.lower()
        for cid, info in char_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']: continue
            lid = ld.get('char_id_map', {}).get(cid, ''); name = ld.get('char_text_map', {}).get(lid, '') if lid else ''
            if not name: name = f"Unknown ({cid})"
            skill_names = []
            for sk in extract_data_list(char_skill):
                if normalize_id(sk.get('CharacterId', '')) != cid: continue
                for sid in [normalize_id(sk.get('CharacterSkillId', '') or sk.get('SkillId', '')), normalize_id(sk.get('SpCharacterSkillId') or sk.get('spCharacterSkillId'))]:
                    if sid and sid != '0':
                        res = resolve_char_skill(sid, ld, 0, False)
                        if res and res.get('name'): skill_names.append(res['name'].lower())
            if sn_lower in skill_names:
                ri = info.get('rarity', '1'); thum = find_list_thumb(info.get('resource_ids', []), cid, 'images/portraits')
                acq = info.get('acquisition_route', '0'); acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
                results[ri2].append({'id': cid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': acq, 'role_icon': ROLE_ICON_MAP.get(ri2, ''), 'acquisition_icon': acq_icon or ''})
        for r in results: results[r].sort(key=lambda x: (x.get('rarity_sort', 99), safe_int(x.get('id'), 0)))
        set_cached_response(ck, results); return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'1': [], '2': [], '3': []}), 500

@app.route('/api/ability_characters')
def get_ability_characters():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        an = request.args.get('ability_name', '').strip()
        if not an: return jsonify({'1': [], '2': [], '3': []})
        ck = f"abil_chars_{an}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); results = {'1': [], '2': [], '3': []}
        an_lower = an.lower()
        for cid, info in char_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']: continue
            lid = ld.get('char_id_map', {}).get(cid, ''); name = ld.get('char_text_map', {}).get(lid, '') if lid else ''
            if not name: name = f"Unknown ({cid})"
            ab_names = []
            for ab in extract_data_list(char_abil):
                if normalize_id(ab.get('CharacterId', '')) != cid: continue
                for aid in [normalize_id(ab.get('AbilityId', '')), normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))]:
                    if aid and aid != '0' and aid != 'None':
                        n = get_ability_name_for_search(aid, ld['abil_name_map'], abil_link_map)
                        if n: ab_names.append(n.lower())
            if an_lower in ab_names:
                ri = info.get('rarity', '1'); thum = find_list_thumb(info.get('resource_ids', []), cid, 'images/portraits')
                acq = info.get('acquisition_route', '0'); acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
                results[ri2].append({'id': cid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': acq, 'role_icon': ROLE_ICON_MAP.get(ri2, ''), 'acquisition_icon': acq_icon or ''})
        for r in results: results[r].sort(key=lambda x: (x.get('rarity_sort', 99), safe_int(x.get('id'), 0)))
        set_cached_response(ck, results); return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'1': [], '2': [], '3': []}), 500

@app.route('/api/ability_units')
def get_ability_units():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        an = request.args.get('ability_name', '').strip()
        if not an: return jsonify({'1': [], '2': [], '3': []})
        ck = f"abil_units_{an}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); results = {'1': [], '2': [], '3': []}
        an_lower = an.lower()
        for uid, info in unit_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']: continue
            lid = ld.get('unit_id_map', {}).get(uid, ''); name = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
            if not name: continue
            ab_names = []
            ua = unit_abil_map.get(uid, [])
            rm = unit_ssp_abil_replace_map.get(uid, {})
            for ab in ua:
                n = get_ability_name_for_search(str(ab['id']), ld['abil_name_map'], abil_link_map)
                if n: ab_names.append(n.lower())
                if str(ab['id']) in rm:
                    rn = get_ability_name_for_search(rm[str(ab['id'])], ld['abil_name_map'], abil_link_map)
                    if rn: ab_names.append(rn.lower())
            if an_lower in ab_names:
                ri = info.get('rarity', '1'); thum = find_list_thumb(info.get('resource_ids', []), uid, 'images/unit_portraits')
                acq = info.get('acquisition_route', '0'); acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
                results[ri2].append({'id': uid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': acq, 'role_icon': ROLE_ICON_MAP.get(ri2, ''), 'acquisition_icon': acq_icon or ''})
        for r in results: results[r].sort(key=lambda x: (x.get('rarity_sort', 99), safe_int(x.get('id'), 0)))
        set_cached_response(ck, results); return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'1': [], '2': [], '3': []}), 500

def _char_has_skill_id(cid, skill_id):
    want = normalize_id(skill_id)
    if not want:
        return False
    for sk in extract_data_list(char_skill):
        if normalize_id(sk.get('CharacterId', '')) != cid:
            continue
        for key in ('CharacterSkillId', 'SkillId', 'SpCharacterSkillId', 'spCharacterSkillId'):
            sid = normalize_id(sk.get(key) or '')
            if sid and sid == want:
                return True
    return False


def entity_matches_char_skills(cid, want_lid):
    """Multi skill id filter — AND semantics (same as lineage tags)."""
    if want_lid is None:
        return True
    if isinstance(want_lid, (frozenset, set, list, tuple)):
        if not want_lid:
            return True
        return all(_char_has_skill_id(cid, w) for w in want_lid)
    return _char_has_skill_id(cid, want_lid)


def _char_has_ability_id(cid, ability_id):
    want = normalize_id(ability_id)
    if not want:
        return False
    is_sdc = want in SDC_ABILITY_IDS
    is_chance_step_ex = want == CHANCE_STEP_EX_FILTER_ID
    for ab_row in extract_data_list(char_abil):
        if normalize_id(ab_row.get('CharacterId', '')) != cid:
            continue
        for key in ('AbilityId', 'SpAbilityId', 'spAbilityId'):
            aid = normalize_id(ab_row.get(key) or '')
            if not aid:
                continue
            if is_sdc and aid in SDC_ABILITY_IDS:
                return True
            if is_chance_step_ex and aid in CHANCE_STEP_EX_ABILITY_IDS:
                return True
            if aid == want:
                return True
    return False


def entity_matches_char_abilities(cid, want_lid):
    """Ability filter with AND across selections, OR within grouped selections."""
    if want_lid is None:
        return True
    if isinstance(want_lid, (set, frozenset)):
        if not want_lid:
            return True
        return any(_char_has_ability_id(cid, w) for w in want_lid)
    if isinstance(want_lid, (list, tuple)):
        if not want_lid:
            return True
        return all(entity_matches_char_abilities(cid, w) for w in want_lid)
    return _char_has_ability_id(cid, want_lid)


def _unit_has_ability_id(uid, ab_id):
    want = normalize_id(ab_id)
    if not want:
        return False
    ua = unit_abil_map.get(uid, [])
    rm = unit_ssp_abil_replace_map.get(uid, {})
    for ab in ua:
        if normalize_id(str(ab['id'])) == want:
            return True
        if str(ab['id']) in rm and normalize_id(rm[str(ab['id'])]) == want:
            return True
    for gain_aid in unit_ssp_abil_gain_list.get(uid, []) or []:
        if normalize_id(str(gain_aid)) == want:
            return True
    return False


def entity_matches_unit_abilities_filter(uid, want_lid):
    if want_lid is None:
        return True
    if isinstance(want_lid, (set, frozenset)):
        if not want_lid:
            return True
        return any(_unit_has_ability_id(uid, w) for w in want_lid)
    if isinstance(want_lid, (list, tuple)):
        if not want_lid:
            return True
        return all(entity_matches_unit_abilities_filter(uid, w) for w in want_lid)
    return _unit_has_ability_id(uid, want_lid)


def collect_character_grid_skills(cid, ld, use_sp=False):
    """One skill per SortOrder row. When use_sp and SP skill id exists, show SP variant instead of base (never both)."""
    rows = []
    for sk in extract_data_list(char_skill):
        if normalize_id(sk.get('CharacterId', '')) != cid:
            continue
        so = int(sk.get('SortOrder', 0) or 0)
        base_id = normalize_id(sk.get('CharacterSkillId', '') or sk.get('SkillId', '')) or ''
        sp_id = normalize_id(sk.get('SpCharacterSkillId') or sk.get('spCharacterSkillId')) or ''
        if use_sp and sp_id and sp_id not in ('0', 'None'):
            sid = sp_id
            isp = True
        else:
            sid = base_id
            isp = False
        if not sid or sid in ('0', 'None'):
            continue
        try:
            r = resolve_char_skill(sid, ld, so, isp)
        except Exception:
            continue
        name = (r.get('name') or '').strip() or 'Unknown'
        detail = '\n'.join(d for d in (r.get('details') or []) if isinstance(d, str) and d.strip())
        icon = (r.get('icon') or '').strip()
        rows.append((so, name.lower(), {'name': name, 'detail': detail, 'icon': icon}))
    rows.sort(key=lambda x: (x[0], x[1]))
    return [x[2] for x in rows]


def collect_unit_grid_abilities(uid, ld, ldc, lang_code, stat_mode='normal'):
    """List browse grid icons: base abilities, or SSP replacement when stat_mode is ssp (same slot, not duplicated)."""
    ua = unit_abil_map.get(uid, []) or []
    gain_list = list(unit_ssp_abil_gain_list.get(uid, []) or [])
    # Some units have no m_unit_ability_set rows (DefaultUnitAbilitySetId 0) but only SSP custom-core
    # gains (BeforeAbilityId 0 in m_unit_ssp_custom_core_ability_change). Use those as the visible list.
    if not ua and gain_list:
        ua = [{'id': normalize_id(g), 'sort': i + 1} for i, g in enumerate(gain_list)]
        gain_list = []
    rm = unit_ssp_abil_replace_map.get(uid, {}) or {}
    sm = (stat_mode or 'normal').strip().lower()
    if sm not in ('normal', 'sp', 'ssp'):
        sm = 'normal'
    out = []
    for ab in sorted(ua, key=lambda x: int(x.get('sort', 0) or 0)):
        aid = str(ab['id'])
        use_id = rm.get(aid) if sm == 'ssp' and aid in rm else aid
        try:
            bab = build_ability_entry(use_id, ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=ab['sort'], lang_code=lang_code)
        except Exception:
            continue
        detail_parts = []
        for d2 in bab.get('details', []):
            t = (d2.get('text', '') if isinstance(d2, dict) else str(d2)).strip()
            if t:
                detail_parts.append(t)
        detail = '\n'.join(detail_parts)
        out.append({'name': bab.get('name') or 'Unknown', 'detail': detail, 'icon': bab.get('icon') or ''})
    if sm == 'ssp' and gain_list:
        max_so = max((int(x.get('sort', 0) or 0) for x in ua), default=0)
        for idx, gain_aid in enumerate(gain_list):
            try:
                bab = build_ability_entry(str(gain_aid), ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=max_so + idx + 1, lang_code=lang_code)
            except Exception:
                continue
            detail_parts = []
            for d2 in bab.get('details', []):
                t = (d2.get('text', '') if isinstance(d2, dict) else str(d2)).strip()
                if t:
                    detail_parts.append(t)
            detail = '\n'.join(detail_parts)
            out.append({'name': bab.get('name') or 'Unknown', 'detail': detail, 'icon': bab.get('icon') or ''})
    return out


def skills_for_character_browse(ld):
    seen = {}
    for sk in extract_data_list(char_skill):
        cid = normalize_id(sk.get('CharacterId', ''))
        if not cid or cid not in char_list_playable_ids:
            continue
        for key in ('CharacterSkillId', 'SkillId', 'SpCharacterSkillId', 'spCharacterSkillId'):
            sid = normalize_id(sk.get(key) or '')
            if not sid or sid in ('0', 'None') or sid in seen:
                continue
            try:
                r = resolve_char_skill(sid, ld, 0, 'Sp' in key or 'sp' in key.lower())
                name = (r.get('name') or '').strip() or sid
                icon = (r.get('icon') or '').strip()
            except Exception:
                name = sid
                icon = ''
            seen[sid] = {'name': name, 'icon': icon}
    return sorted([{'id': k, 'name': v['name'], 'icon': v['icon']} for k, v in seen.items()], key=lambda x: x['name'].lower())


def browse_filters_pool_signature(args, entity=None):
    """Stable key for current-list browse pools. Supporters only use q, rarity, lineage_id."""
    ent = (entity or '').strip().lower()
    if ent == 'supporters':
        raw = '|'.join([
            args.get('q', '').strip().lower(),
            args.get('rarity', '').strip(),
            args.get('lineage_id', '').strip(),
        ])
    else:
        parts = [
            args.get('q', '').strip().lower(),
            args.get('q_scope', '').strip().lower(),
            args.get('role', '').strip(),
            args.get('rarity', '').strip(),
            args.get('source', '').strip(),
            args.get('lineage_id', '').strip(),
            args.get('series_id', '').strip(),
            args.get('skill_id', '').strip(),
            args.get('ability_id', '').strip(),
        ]
        if ent == 'units':
            parts.append(args.get('terrain', '').strip())
            parts.append(args.get('stat_mode', '').strip().lower())
            parts.append(args.get('weapon_debuff', '').strip())
        raw = '|'.join(parts)
    return hashlib.md5(raw.encode('utf-8')).hexdigest()[:20]


def lineage_rows_from_short_ids(short_ids, ld):
    """Build lineage browse rows from a set of short tag ids (same shape as lineages_for_entity_browse)."""
    llk = ld.get('lineage_lookup', {})
    ll = ld.get('lineage_list', [])
    rows = []
    for sid in short_ids:
        name = llk.get(sid)
        if not name:
            for fid, val in ll:
                if str(fid).endswith(sid) and len(sid) >= 4:
                    name = val
                    break
        if not name:
            name = sid
        full_id = sid
        for fid, val in ll:
            if str(fid).endswith(sid) and len(sid) >= 4:
                full_id = str(fid)
                break
        rows.append({'id': full_id, 'name': name})
    by_id = {}
    for r in rows:
        fid = str(r['id'])
        if fid not in by_id:
            by_id[fid] = r
    return sorted(by_id.values(), key=lambda x: x['name'].lower())


def character_passes_browse_pool_filters(
    cid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
    lineage_filter, series_filter, skill_filter, ability_filter=None,
    *, q_scope='full', apply_lineage=True, apply_series=True, apply_skill=True, apply_ability=True,
):
    """list_characters inclusion with optional lineage/series/skill/ability filter steps (for scoped browse dropdowns)."""
    if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
        return False
    ri = info.get('rarity', '1')
    role_id = info.get('role', '0')
    id_seek = bool(sq and search_query_matches_entity_id(sq, cid))
    if role_id == '0' and not (id_seek and npc_password_unlocked()):
        return False
    if role_filter is not None:
        if not role_filter:
            return False
        if not id_seek and role_id not in role_filter:
            return False
    if rarity_filter is not None:
        if not rarity_filter:
            return False
        if not id_seek:
            letter = RARITY_MAP.get(str(ri), 'N')
            lim = cid in LIMITED_TIME_CHARACTER_IDS
            if not row_matches_rarity_filter(rarity_filter, letter, lim):
                return False
    acq_route = str(info.get('acquisition_route', '0'))
    if source_filter is not None:
        if not id_seek and not entity_matches_source_category(acq_route, role_id, source_filter):
            return False
    if apply_lineage and lineage_filter is not None:
        if not id_seek and not entity_matches_lineage(char_lin_map, cid, lineage_filter):
            return False
    if apply_series and series_filter is not None:
        if not id_seek and not entity_matches_series(ld.get('char_ser_map', {}).get(cid, ''), series_filter, lc):
            return False
    if apply_skill and skill_filter is not None:
        if not id_seek and not entity_matches_char_skills(cid, skill_filter):
            return False
    if apply_ability and ability_filter is not None:
        if not id_seek and not entity_matches_char_abilities(cid, ability_filter):
            return False
    lid = ld['char_id_map'].get(cid, '')
    name = ld['char_text_map'].get(lid, '') if lid else ''
    if not name:
        name = f'Unknown ({cid})'
    ser_list = resolve_series(ld.get('char_ser_map', {}).get(cid, ''), lc)
    ser_names_lower = series_names_lower_for_search(ser_list)
    if cid not in char_list_playable_ids and not id_seek:
        return False
    if sq:
        search_chunks = []
        if q_scope != 'primary':
            for ab in extract_data_list(char_abil):
                if normalize_id(ab.get('CharacterId', '')) != cid:
                    continue
                for aid in [normalize_id(ab.get('AbilityId', '')), normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))]:
                    if aid and aid != '0' and aid != 'None':
                        blob = collect_ability_search_text(aid, ld)
                        if blob:
                            search_chunks.append(blob)
            for sk in extract_data_list(char_skill):
                if normalize_id(sk.get('CharacterId', '')) != cid:
                    continue
                for sid in [normalize_id(sk.get('CharacterSkillId', '') or sk.get('SkillId', '')), normalize_id(sk.get('SpCharacterSkillId') or sk.get('spCharacterSkillId'))]:
                    if sid and sid != '0':
                        blob = collect_skill_search_text(sid, ld)
                        if blob:
                            search_chunks.append(blob)
        alias_h = ' '.join(series_alias_tokens_for_haystack(ser_list))
        ss = (
            f'{name} {cid} '
            + ' '.join([t['name'] for t in resolve_tags(char_lin_map, cid, lc, 'character')])
            + ' '
            + ' '.join([s['name'] for s in ser_list])
            + ' '
            + alias_h
            + ' '
            + ' '.join(search_chunks)
        )
        if not search_row_matches_query(sq, ss.lower(), ser_names_lower, ser_list, entity_id=cid, primary=(q_scope == 'primary')):
            return False
    return True


UNIT_TERRAIN_NAMES = ('Space', 'Atmospheric', 'Ground', 'Sea', 'Underwater')


def _terrain_tier_norm(v):
    try:
        n = int(v or 0)
    except Exception:
        n = 0
    if n < 1:
        return 1
    if n > 3:
        return 3
    return n


def _unit_base_terrain_levels(info):
    td = unit_ter_map.get(info.get('terrain_set', ''), {})
    return {tn: _terrain_tier_norm(td.get(tn, 1)) for tn in UNIT_TERRAIN_NAMES}


def _unit_terrain_levels_for_mode(uid, info, stat_mode='normal'):
    levels = _unit_base_terrain_levels(info)
    sm = (stat_mode or 'normal').strip().lower()
    if sm != 'ssp':
        return levels
    core = get_ssp_custom_core_bonuses_for_unit(uid)
    for tn, fr, to in core.get('terrain_upgrades', []) or []:
        if tn not in levels:
            continue
        cur = _terrain_tier_norm(levels.get(tn, 1))
        frn = _terrain_tier_norm(fr)
        ton = _terrain_tier_norm(to)
        levels[tn] = ton if cur == frn else max(cur, ton)
    return levels


def unit_matches_terrain_filter(uid, info, want_filter, stat_mode='normal'):
    if want_filter is None:
        return True
    levels = _unit_terrain_levels_for_mode(uid, info, stat_mode)
    for name, lv in want_filter:
        if _terrain_tier_norm(levels.get(name, 1)) != _terrain_tier_norm(lv):
            return False
    return True


def unit_passes_browse_pool_filters(
    uid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
    lineage_filter, series_filter, ability_filter, terrain_filter=None, stat_mode='normal',
    weapon_debuff_filter=None,
    *, q_scope='full', apply_lineage=True, apply_series=True, apply_ability=True, apply_terrain=True, apply_weapon_debuff=True,
):
    """list_units inclusion with optional lineage/series/ability filter steps (for scoped browse dropdowns)."""
    if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
        return False
    ri = info.get('rarity', '1')
    role_id = info.get('role', '0')
    id_seek = bool(sq and search_query_matches_entity_id(sq, uid))
    if role_id == '0' and not (id_seek and npc_password_unlocked()):
        return False
    if role_filter is not None:
        if not role_filter:
            return False
        if not id_seek and role_id not in role_filter:
            return False
    if rarity_filter is not None:
        if not rarity_filter:
            return False
        if not id_seek:
            letter = RARITY_MAP.get(str(ri), 'N')
            lim = uid in LIMITED_TIME_UNIT_IDS
            if not row_matches_rarity_filter(rarity_filter, letter, lim, bool(info.get('is_ultimate', False))):
                return False
    acq_route = str(info.get('acquisition_route', '0'))
    if source_filter is not None:
        if not id_seek and not entity_matches_source_category(acq_route, role_id, source_filter):
            return False
    if apply_terrain and terrain_filter is not None:
        if not id_seek and not unit_matches_terrain_filter(uid, info, terrain_filter, stat_mode):
            return False
    if apply_lineage and lineage_filter is not None:
        if not id_seek and not entity_matches_lineage(unit_lin_map, uid, lineage_filter):
            return False
    if apply_series and series_filter is not None:
        if not id_seek and not entity_matches_series(unit_ser_map.get(uid, ''), series_filter, lc):
            return False
    if apply_ability and ability_filter is not None:
        if not id_seek and not entity_matches_unit_abilities_filter(uid, ability_filter):
            return False
    if apply_weapon_debuff and weapon_debuff_filter:
        if not id_seek and not unit_matches_weapon_debuff_filter(uid, ld, lc, weapon_debuff_filter):
            return False
    lid = ld['unit_id_map'].get(uid, '')
    name = ld['unit_text_map'].get(lid, '') if lid else ''
    if not name:
        name = f'Unknown ({uid})'
    ser_list = resolve_series(unit_ser_map.get(uid, ''), lc)
    ser_names_lower = series_names_lower_for_search(ser_list)
    if uid not in unit_list_playable_ids and not id_seek:
        return False
    if sq:
        search_chunks = []
        if q_scope != 'primary':
            ua = unit_abil_map.get(uid, [])
            rm = unit_ssp_abil_replace_map.get(uid, {})
            for ab in ua:
                blob = collect_ability_search_text(str(ab['id']), ld)
                if blob:
                    search_chunks.append(blob)
                if str(ab['id']) in rm:
                    blob2 = collect_ability_search_text(rm[str(ab['id'])], ld)
                    if blob2:
                        search_chunks.append(blob2)
            for gain_aid in unit_ssp_abil_gain_list.get(uid, []) or []:
                gb = collect_ability_search_text(str(gain_aid), ld)
                if gb:
                    search_chunks.append(gb)
            prof = collect_unit_profile_search_text(info, ld)
            if prof:
                search_chunks.append(prof)
            mech = collect_unit_mechanism_search_text(info, ld)
            if mech:
                search_chunks.append(mech)
            wtxt = collect_unit_weapons_search_text(uid, ld, lc)
            if wtxt:
                search_chunks.append(wtxt)
        alias_h = ' '.join(series_alias_tokens_for_haystack(ser_list))
        ss = (
            f'{name} {uid} '
            + ' '.join([t['name'] for t in resolve_tags(unit_lin_map, uid, lc, 'unit')])
            + ' '
            + ' '.join([s['name'] for s in ser_list])
            + ' '
            + alias_h
            + ' '
            + ' '.join(search_chunks)
        )
        if not search_row_matches_query(sq, ss.lower(), ser_names_lower, ser_list, entity_id=uid, primary=(q_scope == 'primary')):
            return False
    return True


def lineages_for_character_browse_filtered(ld, lc, args):
    """Lineage tags that appear on at least one character matching filters except lineage_id."""
    sq = args.get('q', '').strip().lower()
    _qsc = parse_q_scope(args.get('q_scope'))
    role_filter = parse_list_role_filter(args.get('role', '').strip())
    rarity_filter = parse_list_rarity_filter(args.get('rarity', '').strip())
    source_filter = parse_list_source_filter(args.get('source', '').strip())
    lineage_filter = parse_list_lineage_filter(args.get('lineage_id', '').strip())
    series_filter = parse_list_series_filter(args.get('series_id', '').strip())
    skill_filter = parse_list_lineage_filter(args.get('skill_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    short_ids = set()
    for cid, info in char_info_map.items():
        if not character_passes_browse_pool_filters(
            cid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, skill_filter, ability_filter, q_scope=_qsc, apply_lineage=False, apply_series=True, apply_skill=True,
        ):
            continue
        for lid in char_lin_map.get(cid, []) or []:
            s = str(lid).strip()
            if s and s != '0':
                short_ids.add(s)
    return lineage_rows_from_short_ids(short_ids, ld)


def series_for_character_browse_filtered(ld, lc, args):
    """Series that appear on at least one character matching filters except series_id."""
    sq = args.get('q', '').strip().lower()
    _qsc = parse_q_scope(args.get('q_scope'))
    role_filter = parse_list_role_filter(args.get('role', '').strip())
    rarity_filter = parse_list_rarity_filter(args.get('rarity', '').strip())
    source_filter = parse_list_source_filter(args.get('source', '').strip())
    lineage_filter = parse_list_lineage_filter(args.get('lineage_id', '').strip())
    series_filter = parse_list_series_filter(args.get('series_id', '').strip())
    skill_filter = parse_list_lineage_filter(args.get('skill_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    ssm = ld.get('ser_set_map', {})
    sl = ld.get('series_list', [])
    cmap = ld.get('char_ser_map', {})
    seen = set()
    out = []
    for cid, info in char_info_map.items():
        if not character_passes_browse_pool_filters(
            cid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, skill_filter, ability_filter, q_scope=_qsc, apply_lineage=True, apply_series=False, apply_skill=True,
        ):
            continue
        set_id = cmap.get(cid, '')
        if not set_id or set_id == '0':
            continue
        for sid in ssm.get(set_id, []):
            sid = normalize_id(sid)
            if not sid or sid == '0' or sid in seen:
                continue
            seen.add(sid)
            name = None
            for lid, val in sl:
                if lid.endswith(sid):
                    name = val
                    break
            if not name:
                name = sid
            icon = series_id_to_icon.get(sid, '') or find_series_icon(sid)
            out.append({'id': sid, 'name': name, 'icon': icon or ''})
    out.sort(key=lambda x: x['name'].lower())
    return out


def lineages_for_unit_browse_filtered(ld, lc, args):
    """Lineage tags that appear on at least one unit matching filters except lineage_id."""
    sq = args.get('q', '').strip().lower()
    _qsc = parse_q_scope(args.get('q_scope'))
    role_filter = parse_list_role_filter(args.get('role', '').strip())
    rarity_filter = parse_list_rarity_filter(args.get('rarity', '').strip())
    source_filter = parse_list_source_filter(args.get('source', '').strip())
    lineage_filter = parse_list_lineage_filter(args.get('lineage_id', '').strip())
    series_filter = parse_list_series_filter(args.get('series_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    terrain_filter = parse_unit_terrain_filter(args.get('terrain', '').strip())
    stat_mode = (args.get('stat_mode', 'normal') or 'normal').strip().lower()
    if stat_mode not in ('normal', 'sp', 'ssp'):
        stat_mode = 'normal'
    weapon_debuff_filter = parse_unit_weapon_debuff_filter(args.get('weapon_debuff', '').strip())
    short_ids = set()
    for uid, info in unit_info_map.items():
        if not unit_passes_browse_pool_filters(
            uid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, ability_filter, terrain_filter, stat_mode,
            weapon_debuff_filter,
            q_scope=_qsc, apply_lineage=False, apply_series=True, apply_ability=True, apply_terrain=True,
        ):
            continue
        for lid in unit_lin_map.get(uid, []) or []:
            s = str(lid).strip()
            if s and s != '0':
                short_ids.add(s)
    return lineage_rows_from_short_ids(short_ids, ld)


def series_for_unit_browse_filtered(ld, lc, args):
    """Series that appear on at least one unit matching filters except series_id."""
    sq = args.get('q', '').strip().lower()
    _qsc = parse_q_scope(args.get('q_scope'))
    role_filter = parse_list_role_filter(args.get('role', '').strip())
    rarity_filter = parse_list_rarity_filter(args.get('rarity', '').strip())
    source_filter = parse_list_source_filter(args.get('source', '').strip())
    lineage_filter = parse_list_lineage_filter(args.get('lineage_id', '').strip())
    series_filter = parse_list_series_filter(args.get('series_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    terrain_filter = parse_unit_terrain_filter(args.get('terrain', '').strip())
    stat_mode = (args.get('stat_mode', 'normal') or 'normal').strip().lower()
    if stat_mode not in ('normal', 'sp', 'ssp'):
        stat_mode = 'normal'
    weapon_debuff_filter = parse_unit_weapon_debuff_filter(args.get('weapon_debuff', '').strip())
    ssm = ld.get('ser_set_map', {})
    sl = ld.get('series_list', [])
    seen = set()
    out = []
    for uid, info in unit_info_map.items():
        if not unit_passes_browse_pool_filters(
            uid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, ability_filter, terrain_filter, stat_mode,
            weapon_debuff_filter,
            q_scope=_qsc, apply_lineage=True, apply_series=False, apply_ability=True, apply_terrain=True,
        ):
            continue
        set_id = unit_ser_map.get(uid, '')
        if not set_id or set_id == '0':
            continue
        for sid in ssm.get(set_id, []):
            sid = normalize_id(sid)
            if not sid or sid == '0' or sid in seen:
                continue
            seen.add(sid)
            name = None
            for lid, val in sl:
                if lid.endswith(sid):
                    name = val
                    break
            if not name:
                name = sid
            icon = series_id_to_icon.get(sid, '') or find_series_icon(sid)
            out.append({'id': sid, 'name': name, 'icon': icon or ''})
    out.sort(key=lambda x: x['name'].lower())
    return out


def supporter_passes_browse_pool_filters(sid, info, ld, lc, sq, rarity_filter, lineage_filter, *, apply_lineage=True):
    """Same inclusion as list_supporters with optional lineage filter step."""
    if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
        return False
    nsid = normalize_id(sid)
    ri = info.get('rarity', '1')
    lid = ld.get('supporter_id_map', {}).get(sid, '')
    name = ld.get('supporter_text_map', {}).get(lid, '') if lid else ''
    if not name:
        return False
    lim = nsid in LIMITED_TIME_SUPPORTER_IDS
    id_seek = bool(sq and search_query_matches_entity_id(sq, sid))
    if apply_lineage and lineage_filter is not None:
        if not id_seek and not supporter_matches_lineage_filter(sid, lineage_filter, ld, lc):
            return False
    if rarity_filter is not None:
        if not rarity_filter:
            return False
        letter = RARITY_MAP.get(str(ri), 'N')
        if not row_matches_rarity_filter(rarity_filter, letter, lim):
            return False
    lsr = supporter_leader_map.get(sid, [])
    all_tags = []
    descs = []
    for ls in lsr:
        if ls.get('tier') != 3:
            continue
        desc = ld.get('supporter_leader_text_map', {}).get(ls.get('desc_lang_id', ''), '')
        tags = resolve_condition_tags(
            ls.get('trait_cond_id', '0'), trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), lc,
        )
        if desc:
            descs.append(desc)
        for t in tags:
            if not any(x['name'] == t['name'] for x in all_tags):
                all_tags.append(t)
    sts = ', '.join([t['name'] for t in all_tags])
    cb = '\n'.join(descs)
    ask_names = []
    for a in supporter_active_map.get(sid, []):
        an = ld.get('supporter_active_text_map', {}).get(a.get('name_lang_id', ''), '')
        if an:
            ask_names.append(an)
    ask_str = ' '.join(ask_names)
    if sq:
        searchable = f'{name} {sid} {sts} {cb} {ask_str}'.lower()
        ser_names_lower = [t['name'].lower() for t in all_tags if t.get('name')]
        if not search_row_matches_query(sq, searchable, ser_names_lower, entity_id=sid):
            return False
    return True


def lineages_for_supporter_browse_filtered(ld, lc, args):
    """Lineage tags from tier-3 leader skills for supporters matching filters except lineage_id."""
    sq = args.get('q', '').strip().lower()
    rarity_filter = parse_list_rarity_filter(args.get('rarity', '').strip())
    lineage_filter = parse_list_lineage_filter(args.get('lineage_id', '').strip())
    llk = ld.get('lineage_lookup', {})
    ll = ld.get('lineage_list', [])
    snm = ld.get('series_name_map', {})
    by_id = {}
    for supp_id, info in supporter_info_map.items():
        if not supporter_passes_browse_pool_filters(supp_id, info, ld, lc, sq, rarity_filter, lineage_filter, apply_lineage=False):
            continue
        lsr = supporter_leader_map.get(supp_id, [])
        for ls in lsr:
            if ls.get('tier') != 3:
                continue
            tags = resolve_condition_tags(
                ls.get('trait_cond_id', '0'), trait_condition_raw_map, llk, snm, lc,
            )
            for t in tags:
                tid = str(t.get('id', '')).strip()
                if not tid or tid == '0':
                    continue
                nm = (t.get('name') or '').strip()
                full_id = tid
                for fid, val in ll:
                    fu = str(fid)
                    if len(tid) >= 4 and fu.endswith(tid):
                        full_id = fu
                        break
                    if len(tid) < 4 and fu.endswith(tid.zfill(4)):
                        full_id = fu
                        break
                if not nm:
                    nm = llk.get(tid) or llk.get(full_id)
                    if not nm:
                        for fid, val in ll:
                            fu = str(fid)
                            if fu.endswith(tid) or (len(tid) < 4 and fu.endswith(tid.zfill(4))):
                                nm = val
                                break
                if not nm:
                    nm = tid
                key = str(full_id)
                if key not in by_id:
                    by_id[key] = {'id': full_id, 'name': nm}
    return sorted(by_id.values(), key=lambda x: x['name'].lower())


def skills_for_character_browse_filtered(ld, lc, args):
    """Skills that appear on at least one character matching list filters (skill_id excluded)."""
    sq = args.get('q', '').strip().lower()
    _qsc = parse_q_scope(args.get('q_scope'))
    role_filter = parse_list_role_filter(args.get('role', '').strip())
    rarity_filter = parse_list_rarity_filter(args.get('rarity', '').strip())
    source_filter = parse_list_source_filter(args.get('source', '').strip())
    lineage_filter = parse_list_lineage_filter(args.get('lineage_id', '').strip())
    series_filter = parse_list_series_filter(args.get('series_id', '').strip())
    skill_filter = parse_list_lineage_filter(args.get('skill_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    seen = {}
    for sk in extract_data_list(char_skill):
        cid = normalize_id(sk.get('CharacterId', ''))
        if not cid or cid not in char_list_playable_ids:
            continue
        info = char_info_map.get(cid)
        if not info:
            continue
        if not character_passes_browse_pool_filters(
            cid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, skill_filter, ability_filter, q_scope=_qsc, apply_skill=False,
        ):
            continue
        for key in ('CharacterSkillId', 'SkillId', 'SpCharacterSkillId', 'spCharacterSkillId'):
            sid = normalize_id(sk.get(key) or '')
            if not sid or sid in ('0', 'None') or sid in seen:
                continue
            try:
                r = resolve_char_skill(sid, ld, 0, 'Sp' in key or 'sp' in key.lower())
                name = (r.get('name') or '').strip() or sid
                icon = (r.get('icon') or '').strip()
            except Exception:
                name = sid
                icon = ''
            seen[sid] = {'name': name, 'icon': icon}
    return sorted([{'id': k, 'name': v['name'], 'icon': v['icon']} for k, v in seen.items()], key=lambda x: x['name'].lower())


def abilities_for_character_browse(ld, lc):
    """Unique non-EX abilities across playable characters.
    SDC abilities are collapsed into one representative entry."""
    seen = {}
    sdc_placed = False
    ldc = get_calc_lang_data()
    for ab_row in extract_data_list(char_abil):
        cid = normalize_id(ab_row.get('CharacterId', ''))
        if not cid or cid not in char_list_playable_ids:
            continue
        for key in ('AbilityId', 'SpAbilityId', 'spAbilityId'):
            aid = normalize_id(ab_row.get(key) or '')
            if not aid or aid in ('0', 'None') or aid in seen:
                continue
            if aid in SDC_ABILITY_IDS:
                if sdc_placed:
                    continue
                if SDC_REPRESENTATIVE_ID:
                    rep = SDC_REPRESENTATIVE_ID
                else:
                    rep = aid
                try:
                    bab = build_ability_entry(
                        rep, ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map,
                        ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'],
                        ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=0, lang_code=lc,
                    )
                    n = (bab.get('name') or '').strip() or rep
                    icon = (bab.get('icon') or '').strip()
                except Exception:
                    n = rep
                    icon = ''
                seen[rep] = {'name': n, 'icon': icon}
                sdc_placed = True
                continue
            try:
                bab = build_ability_entry(
                    aid, ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map,
                    ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'],
                    ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=0, lang_code=lc,
                )
                n = (bab.get('name') or '').strip() or aid
                icon = (bab.get('icon') or '').strip()
                if bab.get('is_ex'):
                    continue
            except Exception:
                n = aid
                icon = ''
            if n:
                seen[aid] = {'name': n, 'icon': icon}
    if CHANCE_STEP_EX_ABILITY_IDS:
        seen[CHANCE_STEP_EX_FILTER_ID] = {'name': CHANCE_STEP_EX_FILTER_NAME, 'icon': CHANCE_STEP_EX_ICON}
    return sorted([{'id': k, 'name': v['name'], 'icon': v['icon']} for k, v in seen.items()], key=lambda x: x['name'].lower())


def abilities_for_character_browse_filtered(ld, lc, args):
    """Abilities on characters matching current list filters (ability_id excluded).
    SDC abilities are collapsed into one representative entry."""
    sq = args.get('q', '').strip().lower()
    _qsc = parse_q_scope(args.get('q_scope'))
    role_filter = parse_list_role_filter(args.get('role', '').strip())
    rarity_filter = parse_list_rarity_filter(args.get('rarity', '').strip())
    source_filter = parse_list_source_filter(args.get('source', '').strip())
    lineage_filter = parse_list_lineage_filter(args.get('lineage_id', '').strip())
    series_filter = parse_list_series_filter(args.get('series_id', '').strip())
    skill_filter = parse_list_lineage_filter(args.get('skill_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    ldc = get_calc_lang_data()
    seen = {}
    passed_cids = set()
    failed_cids = set()
    sdc_placed = False
    chance_step_ex_present = False
    for ab_row in extract_data_list(char_abil):
        cid = normalize_id(ab_row.get('CharacterId', ''))
        if not cid or cid not in char_list_playable_ids:
            continue
        if cid in failed_cids:
            continue
        if cid not in passed_cids:
            info = char_info_map.get(cid)
            if not info:
                failed_cids.add(cid)
                continue
            if not character_passes_browse_pool_filters(
                cid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
                lineage_filter, series_filter, skill_filter,
                q_scope=_qsc, apply_ability=False,
            ):
                failed_cids.add(cid)
                continue
            passed_cids.add(cid)
        for key in ('AbilityId', 'SpAbilityId', 'spAbilityId'):
            aid = normalize_id(ab_row.get(key) or '')
            if not aid or aid in ('0', 'None') or aid in seen:
                if aid in CHANCE_STEP_EX_ABILITY_IDS:
                    chance_step_ex_present = True
                continue
            if aid in CHANCE_STEP_EX_ABILITY_IDS:
                chance_step_ex_present = True
            if aid in SDC_ABILITY_IDS:
                if sdc_placed:
                    continue
                rep = SDC_REPRESENTATIVE_ID or aid
                try:
                    bab = build_ability_entry(
                        rep, ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map,
                        ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'],
                        ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=0, lang_code=lc,
                    )
                    n = (bab.get('name') or '').strip() or rep
                    icon = (bab.get('icon') or '').strip()
                except Exception:
                    n = rep
                    icon = ''
                seen[rep] = {'name': n, 'icon': icon}
                sdc_placed = True
                continue
            try:
                bab = build_ability_entry(
                    aid, ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map,
                    ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'],
                    ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=0, lang_code=lc,
                )
                n = (bab.get('name') or '').strip() or aid
                icon = (bab.get('icon') or '').strip()
                if bab.get('is_ex'):
                    continue
            except Exception:
                n = aid
                icon = ''
            if n:
                seen[aid] = {'name': n, 'icon': icon}
    if chance_step_ex_present:
        seen[CHANCE_STEP_EX_FILTER_ID] = {'name': CHANCE_STEP_EX_FILTER_NAME, 'icon': CHANCE_STEP_EX_ICON}
    return sorted([{'id': k, 'name': v['name'], 'icon': v['icon']} for k, v in seen.items()], key=lambda x: x['name'].lower())


def abilities_for_unit_browse(ld, lang_code):
    """Unique abilities across playable units with display name + icon for filter dropdown."""
    seen = {}
    ldc = get_calc_lang_data()
    for uid in unit_list_playable_ids:
        for ab in unit_abil_map.get(uid, []) or []:
            aid = normalize_id(str(ab.get('id', '')))
            if not aid or aid in seen:
                continue
            sort_o = safe_int(ab.get('sort', 0), 0)
            try:
                bab = build_ability_entry(
                    str(ab['id']), ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map,
                    ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'],
                    ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=sort_o,
                    lang_code=lang_code,
                )
                n = (bab.get('name') or '').strip() or aid
                icon = (bab.get('icon') or '').strip()
            except Exception:
                n = get_ability_name_for_search(str(ab['id']), ld['abil_name_map'], abil_link_map) or aid
                icon = ''
            if n:
                seen[aid] = {'name': n, 'icon': icon}
    return sorted([{'id': k, 'name': v['name'], 'icon': v['icon']} for k, v in seen.items()], key=lambda x: x['name'].lower())


def abilities_for_unit_browse_filtered(ld, lc, args):
    """Abilities that appear on at least one unit matching list filters (ability_id excluded)."""
    sq = args.get('q', '').strip().lower()
    _qsc = parse_q_scope(args.get('q_scope'))
    role_filter = parse_list_role_filter(args.get('role', '').strip())
    rarity_filter = parse_list_rarity_filter(args.get('rarity', '').strip())
    source_filter = parse_list_source_filter(args.get('source', '').strip())
    lineage_filter = parse_list_lineage_filter(args.get('lineage_id', '').strip())
    series_filter = parse_list_series_filter(args.get('series_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    terrain_filter = parse_unit_terrain_filter(args.get('terrain', '').strip())
    stat_mode = (args.get('stat_mode', 'normal') or 'normal').strip().lower()
    if stat_mode not in ('normal', 'sp', 'ssp'):
        stat_mode = 'normal'
    weapon_debuff_filter = parse_unit_weapon_debuff_filter(args.get('weapon_debuff', '').strip())
    ldc = get_calc_lang_data()
    seen = {}
    for uid in unit_list_playable_ids:
        info = unit_info_map.get(uid)
        if not info:
            continue
        if not unit_passes_browse_pool_filters(
            uid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, ability_filter, terrain_filter, stat_mode,
            weapon_debuff_filter,
            q_scope=_qsc, apply_ability=False, apply_terrain=True,
        ):
            continue
        ua = unit_abil_map.get(uid, []) or []
        gain_list = list(unit_ssp_abil_gain_list.get(uid, []) or [])
        if not ua and gain_list:
            ua = [{'id': normalize_id(g), 'sort': i + 1} for i, g in enumerate(gain_list)]
            gain_list = []
        for ab in ua:
            aid = normalize_id(str(ab.get('id', '')))
            if not aid or aid in seen:
                continue
            sort_o = safe_int(ab.get('sort', 0), 0)
            try:
                bab = build_ability_entry(
                    str(ab['id']), ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map,
                    ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'],
                    ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=sort_o,
                    lang_code=lc,
                )
                n = (bab.get('name') or '').strip() or aid
                icon = (bab.get('icon') or '').strip()
            except Exception:
                n = get_ability_name_for_search(str(ab['id']), ld['abil_name_map'], abil_link_map) or aid
                icon = ''
            if n:
                seen[aid] = {'name': n, 'icon': icon}
        max_so = max((safe_int(x.get('sort', 0), 0) for x in ua), default=0)
        for idx, gain_aid in enumerate(gain_list):
            aid = normalize_id(str(gain_aid))
            if not aid or aid in seen:
                continue
            try:
                bab = build_ability_entry(
                    str(gain_aid), ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map,
                    ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'],
                    ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=max_so + idx + 1,
                    lang_code=lc,
                )
                n = (bab.get('name') or '').strip() or aid
                icon = (bab.get('icon') or '').strip()
            except Exception:
                n = get_ability_name_for_search(str(gain_aid), ld['abil_name_map'], abil_link_map) or aid
                icon = ''
            if n:
                seen[aid] = {'name': n, 'icon': icon}
    return sorted([{'id': k, 'name': v['name'], 'icon': v['icon']} for k, v in seen.items()], key=lambda x: x['name'].lower())


@app.route('/api/browse_filters')
def browse_filters():
    """Lineage tags, series, and skill/ability pickers for list filters — character vs unit lists do not mix."""
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        entity = (request.args.get('entity') or '').strip().lower()
        if entity not in ('characters', 'units', 'supporters'):
            entity = 'characters'
        filter_mode = (request.args.get('filter_mode') or '').strip().lower()
        if entity == 'supporters':
            if filter_mode == 'current':
                sig = browse_filters_pool_signature(request.args, 'supporters')
                ck = f"browse_filters_v10_{lc}_{entity}_cur_{sig}"
            else:
                ck = f"browse_filters_v10_{lc}_{entity}"
            cached = get_cached_response(ck)
            if cached:
                return jsonify(cached)
            ld = get_lang_data(lc)
            if filter_mode == 'current':
                lineages = lineages_for_supporter_browse_filtered(ld, lc, request.args)
            else:
                lineages = lineages_for_supporter_browse(ld, lc)
            result = {'lineages': lineages, 'series': [], 'skills': [], 'abilities': []}
            set_cached_response(ck, result)
            return jsonify(convert_image_urls(result))
        if filter_mode == 'current':
            sig = browse_filters_pool_signature(request.args, entity)
            ck = f"browse_filters_v10_{lc}_{entity}_cur_{sig}"
        else:
            ck = f"browse_filters_v10_{lc}_{entity}"
        cached = get_cached_response(ck)
        if cached:
            return jsonify(cached)
        ld = get_lang_data(lc)
        if filter_mode == 'current':
            if entity == 'characters':
                lineages = lineages_for_character_browse_filtered(ld, lc, request.args)
                series = series_for_character_browse_filtered(ld, lc, request.args)
                extra = {
                    'skills': skills_for_character_browse_filtered(ld, lc, request.args),
                    'abilities': abilities_for_character_browse_filtered(ld, lc, request.args),
                }
            else:
                lineages = lineages_for_unit_browse_filtered(ld, lc, request.args)
                series = series_for_unit_browse_filtered(ld, lc, request.args)
                extra = {'abilities': abilities_for_unit_browse_filtered(ld, lc, request.args)}
        else:
            lin_map = char_lin_map if entity == 'characters' else unit_lin_map
            lineages = lineages_for_entity_browse(lin_map, ld)
            series = series_for_entity_browse(ld, 'characters' if entity == 'characters' else 'units')
            if entity == 'characters':
                extra = {
                    'skills': skills_for_character_browse(ld),
                    'abilities': abilities_for_character_browse(ld, lc),
                }
            else:
                extra = {'abilities': abilities_for_unit_browse(ld, lc)}
        result = {'lineages': lineages, 'series': series, **extra}
        set_cached_response(ck, result)
        return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'lineages': [], 'series': [], 'skills': [], 'abilities': []}), 500

@app.route('/api/characters')
def list_characters():
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
    pp = min(100, max(10, int(request.args.get('per_page', 50)))); sb = request.args.get('sort', 'rarity'); sd = request.args.get('dir', 'desc')
    sq = request.args.get('q', '').strip().lower()
    q_scope = parse_q_scope(request.args.get('q_scope'))
    scope_ck = 'p' if q_scope == 'primary' else 'f'
    role_arg = request.args.get('role', '').strip(); role_filter = parse_list_role_filter(role_arg); role_ck = role_filter_cache_fragment(role_filter)
    rav = request.args.get('rarity', '').strip(); rarity_filter = parse_list_rarity_filter(rav); rk = rarity_filter_cache_fragment(rarity_filter)
    sp_list = request.args.get('sp', '').strip().lower() in ('1', 'true', 'yes')
    cond_list = request.args.get('cond', '').strip().lower() in ('1', 'true', 'yes')
    source_arg = request.args.get('source', '').strip()
    source_filter = parse_list_source_filter(source_arg)
    source_ck = source_filter_cache_fragment(source_filter)
    lineage_arg = request.args.get('lineage_id', '').strip()
    series_arg = request.args.get('series_id', '').strip()
    lineage_filter = parse_list_lineage_filter(lineage_arg)
    series_filter = parse_list_series_filter(series_arg)
    skill_arg = request.args.get('skill_id', '').strip()
    skill_filter = parse_list_lineage_filter(skill_arg)
    ability_arg = request.args.get('ability_id', '').strip()
    ability_filter = parse_list_ability_filter(ability_arg)
    lineage_ck = lineage_filter_cache_fragment(lineage_filter)
    series_ck = series_filter_cache_fragment(series_filter)
    skill_ck = lineage_filter_cache_fragment(skill_filter)
    ability_ck = ability_filter_cache_fragment(ability_filter)
    grid_skills = request.args.get('grid_skills', '').strip().lower() in ('1', 'true', 'yes')
    ck = f"cl22_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{scope_ck}_{role_ck}_{rk}_sp{1 if sp_list else 0}_c{1 if cond_list else 0}_{source_ck}_{lineage_ck}_{series_ck}_{skill_ck}_{ability_ck}_gs{1 if grid_skills else 0}_{lr_schedule_cache_key_fragment()}_{npc_view_cache_key_fragment()}"
    cached = get_cached_response(ck)
    if cached: return jsonify(cached)
    ld = get_lang_data(lc); ldc = get_calc_lang_data(); rows = []
    for cid, info in char_info_map.items():
        if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
            continue
        ri = info.get('rarity','1'); role_id = info.get('role','0')
        id_seek = bool(sq and search_query_matches_entity_id(sq, cid))
        # Role 0 = no combat role (NPC / story); reveal only with id search + unlocked password session.
        if role_id == '0' and not (id_seek and npc_password_unlocked()):
            continue
        if role_filter is not None:
            if not role_filter:
                continue
            if not id_seek and role_id not in role_filter:
                continue
        if rarity_filter is not None:
            if not rarity_filter:
                continue
            if not id_seek:
                letter = RARITY_MAP.get(str(ri), 'N')
                lim = cid in LIMITED_TIME_CHARACTER_IDS
                if not row_matches_rarity_filter(rarity_filter, letter, lim):
                    continue
        acq_route = str(info.get('acquisition_route', '0'))
        if source_filter is not None:
            if not id_seek and not entity_matches_source_category(acq_route, role_id, source_filter):
                continue
        if lineage_filter is not None:
            if not id_seek and not entity_matches_lineage(char_lin_map, cid, lineage_filter):
                continue
        if series_filter is not None:
            if not id_seek and not entity_matches_series(ld.get('char_ser_map', {}).get(cid, ''), series_filter, lc):
                continue
        if skill_filter is not None:
            if not id_seek and not entity_matches_char_skills(cid, skill_filter):
                continue
        if ability_filter is not None:
            if not id_seek and not entity_matches_char_abilities(cid, ability_filter):
                continue
        lid = ld['char_id_map'].get(cid, ''); name = ld['char_text_map'].get(lid, '') if lid else ''
        if not name: name = f"Unknown ({cid})"
        ser_list = resolve_series(ld.get('char_ser_map', {}).get(cid, ''), lc)
        ser_names_lower = series_names_lower_for_search(ser_list)
        if cid not in char_list_playable_ids and not id_seek:
            continue
        if sq:
            search_chunks = []
            if q_scope != 'primary':
                for ab in extract_data_list(char_abil):
                    if normalize_id(ab.get('CharacterId','')) != cid: continue
                    for aid in [normalize_id(ab.get('AbilityId','')), normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))]:
                        if aid and aid != '0' and aid != 'None':
                            blob = collect_ability_search_text(aid, ld)
                            if blob: search_chunks.append(blob)
                for sk in extract_data_list(char_skill):
                    if normalize_id(sk.get('CharacterId','')) != cid: continue
                    for sid in [normalize_id(sk.get('CharacterSkillId','') or sk.get('SkillId','')), normalize_id(sk.get('SpCharacterSkillId') or sk.get('spCharacterSkillId'))]:
                        if sid and sid != '0':
                            blob = collect_skill_search_text(sid, ld)
                            if blob: search_chunks.append(blob)
            alias_h = ' '.join(series_alias_tokens_for_haystack(ser_list))
            ss = f"{name} {cid} " + " ".join([t['name'] for t in resolve_tags(char_lin_map, cid, lc, 'character')]) + " " + " ".join([s['name'] for s in ser_list]) + " " + alias_h + " " + " ".join(search_chunks)
            if not search_row_matches_query(sq, ss.lower(), ser_names_lower, ser_list, entity_id=cid, primary=(q_scope == 'primary')): continue
        raw = char_stat_map.get(cid, {}); t = lambda s: raw.get(s, (0,0,0)); grown = {s: calc_growth_char(t(s)[0], t(s)[1], ri) for s in CHAR_STAT_ORDER}
        # Match get_character: only rarities 1–4 have SP growth / SP ability column; UR (5) always uses non-SP stats.
        has_sp_char = int(str(ri)) <= 4
        if sp_list and has_sp_char:
            rv = lambda s: raw.get(s, (0,0,0)); grown_sp = {s: (rv(s)[2] if len(rv(s)) >= 3 else rv(s)[1]) for s in CHAR_STAT_ORDER}
            totals = compute_char_stat_totals_sp_list_with_ex(cid, ri, ldc, grown_sp) if cond_list else compute_char_stat_totals_sp_list(cid, ri, ldc, grown_sp)
            base_src = grown_sp
        else:
            totals = compute_char_stat_totals_detail_style(cid, ri, ldc, grown) if cond_list else compute_char_stat_totals_with_abilities(cid, ri, ldc, grown)
            base_src = grown
        thum = find_list_thumb(info.get('resource_ids', []), cid, 'images/portraits')
        acq = acq_route; acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
        row = {'id': cid, 'name': name, 'role': ROLE_MAP.get(role_id,'NPC'), 'role_id': role_id, 'role_sort': ROLE_SORT.get(role_id,3), 'role_icon': ROLE_ICON_MAP.get(role_id,''), 'rarity': RARITY_MAP.get(ri,'N'), 'rarity_id': ri, 'rarity_sort': RARITY_SORT.get(ri,4), 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'thum': thum or '', 'acquisition_icon': acq_icon or '', 'series': ser_list, 'is_limited_time': cid in LIMITED_TIME_CHARACTER_IDS, 'Ranged': totals.get('Ranged', 0), 'Melee': totals.get('Melee', 0), 'Awaken': totals.get('Awaken', 0), 'Defense': totals.get('Defense', 0), 'Reaction': totals.get('Reaction', 0), 'Ranged_base': base_src.get('Ranged', 0), 'Melee_base': base_src.get('Melee', 0), 'Awaken_base': base_src.get('Awaken', 0), 'Defense_base': base_src.get('Defense', 0), 'Reaction_base': base_src.get('Reaction', 0)}
        if grid_skills:
            has_sp_char = int(str(ri)) <= 4
            row['grid_skills'] = collect_character_grid_skills(cid, ld, use_sp=bool(sp_list and has_sp_char))
        rows.append(row)
    rows = sort_rows(rows, sb, sd, {'name','role','rarity','Ranged','Melee','Awaken','Defense','Reaction'})
    total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
    start = (page - 1) * pp; pr = rows[start:start + pp]
    result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd, 'role_filter': role_arg, 'rarity_filter': rav, 'source_filter': source_arg, 'lineage_filter': lineage_arg, 'series_filter': series_arg, 'skill_filter': skill_arg}
    set_cached_response(ck, result); return jsonify(convert_image_urls(result))

@app.route('/api/units')
def list_units():
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
    pp = min(100, max(10, int(request.args.get('per_page', 50)))); sb = request.args.get('sort', 'rarity'); sd = request.args.get('dir', 'desc')
    sq = request.args.get('q', '').strip().lower()
    q_scope = parse_q_scope(request.args.get('q_scope'))
    scope_ck = 'p' if q_scope == 'primary' else 'f'
    role_arg = request.args.get('role', '').strip(); role_filter = parse_list_role_filter(role_arg); role_ck = role_filter_cache_fragment(role_filter)
    rav = request.args.get('rarity', '').strip(); rarity_filter = parse_list_rarity_filter(rav); rk = rarity_filter_cache_fragment(rarity_filter)
    stat_mode = request.args.get('stat_mode', 'normal').strip().lower()
    if stat_mode not in ('normal', 'sp', 'ssp'): stat_mode = 'normal'
    cond_list = request.args.get('cond', '').strip().lower() in ('1', 'true', 'yes')
    source_arg = request.args.get('source', '').strip()
    source_filter = parse_list_source_filter(source_arg)
    source_ck = source_filter_cache_fragment(source_filter)
    lineage_arg = request.args.get('lineage_id', '').strip()
    series_arg = request.args.get('series_id', '').strip()
    lineage_filter = parse_list_lineage_filter(lineage_arg)
    series_filter = parse_list_series_filter(series_arg)
    ability_arg = request.args.get('ability_id', '').strip()
    ability_filter = parse_list_ability_filter(ability_arg)
    terrain_arg = request.args.get('terrain', '').strip()
    terrain_filter = parse_unit_terrain_filter(terrain_arg)
    weapon_debuff_arg = request.args.get('weapon_debuff', '').strip()
    weapon_debuff_filter = parse_unit_weapon_debuff_filter(weapon_debuff_arg)
    lineage_ck = lineage_filter_cache_fragment(lineage_filter)
    series_ck = series_filter_cache_fragment(series_filter)
    ability_ck = ability_filter_cache_fragment(ability_filter)
    terrain_ck = unit_terrain_filter_cache_fragment(terrain_filter)
    weapon_debuff_ck = unit_weapon_debuff_filter_cache_fragment(weapon_debuff_filter)
    grid_skills_u = request.args.get('grid_skills', '').strip().lower() in ('1', 'true', 'yes')
    ck = f"ul30_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{scope_ck}_{role_ck}_{rk}_{stat_mode}_c{1 if cond_list else 0}_{source_ck}_{lineage_ck}_{series_ck}_{ability_ck}_{terrain_ck}_{weapon_debuff_ck}_gs{1 if grid_skills_u else 0}_{lr_schedule_cache_key_fragment()}_{npc_view_cache_key_fragment()}"
    cached = get_cached_response(ck)
    if cached: return jsonify(cached)
    ld = get_lang_data(lc); ldc = get_calc_lang_data(); rows = []
    _debuff_memo = {}
    _debuff_keys_union = set()
    for uid, info in unit_info_map.items():
        if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
            continue
        ri = info.get('rarity','1'); role_id = info.get('role','0')
        id_seek = bool(sq and search_query_matches_entity_id(sq, uid))
        if role_id == '0' and not (id_seek and npc_password_unlocked()):
            continue
        if role_filter is not None:
            if not role_filter:
                continue
            if not id_seek and role_id not in role_filter:
                continue
        if rarity_filter is not None:
            if not rarity_filter:
                continue
            if not id_seek:
                letter = RARITY_MAP.get(str(ri), 'N')
                lim = uid in LIMITED_TIME_UNIT_IDS
                if not row_matches_rarity_filter(rarity_filter, letter, lim, bool(info.get('is_ultimate', False))):
                    continue
        acq_route = str(info.get('acquisition_route', '0'))
        if source_filter is not None:
            if not id_seek and not entity_matches_source_category(acq_route, role_id, source_filter):
                continue
        if terrain_filter is not None:
            if not id_seek and not unit_matches_terrain_filter(uid, info, terrain_filter, stat_mode):
                continue
        if lineage_filter is not None:
            if not id_seek and not entity_matches_lineage(unit_lin_map, uid, lineage_filter):
                continue
        if series_filter is not None:
            if not id_seek and not entity_matches_series(unit_ser_map.get(uid, ''), series_filter, lc):
                continue
        if ability_filter is not None:
            if not id_seek and not entity_matches_unit_abilities_filter(uid, ability_filter):
                continue
        lid = ld['unit_id_map'].get(uid, ''); name = ld['unit_text_map'].get(lid, '') if lid else ''
        if not name:
            name = f'Unknown ({uid})'
        ser_list = resolve_series(unit_ser_map.get(uid, ''), lc)
        ser_names_lower = series_names_lower_for_search(ser_list)
        if uid not in unit_list_playable_ids and not id_seek:
            continue
        if sq:
            search_chunks = []
            if q_scope != 'primary':
                ua = unit_abil_map.get(uid, [])
                rm = unit_ssp_abil_replace_map.get(uid, {})
                for ab in ua:
                    blob = collect_ability_search_text(str(ab['id']), ld)
                    if blob: search_chunks.append(blob)
                    if str(ab['id']) in rm:
                        blob2 = collect_ability_search_text(rm[str(ab['id'])], ld)
                        if blob2: search_chunks.append(blob2)
                for gain_aid in unit_ssp_abil_gain_list.get(uid, []) or []:
                    gb = collect_ability_search_text(str(gain_aid), ld)
                    if gb: search_chunks.append(gb)
                prof = collect_unit_profile_search_text(info, ld)
                if prof: search_chunks.append(prof)
                mech = collect_unit_mechanism_search_text(info, ld)
                if mech: search_chunks.append(mech)
                wtxt = collect_unit_weapons_search_text(uid, ld, lc)
                if wtxt: search_chunks.append(wtxt)
            alias_h = ' '.join(series_alias_tokens_for_haystack(ser_list))
            ss = f"{name} {uid} " + " ".join([t['name'] for t in resolve_tags(unit_lin_map, uid, lc, 'unit')]) + " " + " ".join([s['name'] for s in ser_list]) + " " + alias_h + " " + " ".join(search_chunks)
            if not search_row_matches_query(sq, ss.lower(), ser_names_lower, ser_list, entity_id=uid, primary=(q_scope == 'primary')): continue
        if uid not in _debuff_memo:
            _debuff_memo[uid] = collect_unit_weapon_debuff_keys(uid, ld, lc)
        _debuff_keys_union |= set(_debuff_memo[uid])
        if weapon_debuff_filter:
            if not id_seek and not unit_matches_weapon_debuff_filter(uid, ld, lc, weapon_debuff_filter, _debuff_memo):
                continue
        raw = unit_stat_map.get(uid, {})
        if stat_mode == 'normal' and not cond_list:
            fs = compute_unit_stats_no_cond(uid, info, raw, ldc)
        else:
            lb = _unit_max_lb_stat_block(uid, info, raw, ldc)
            sm = stat_mode if stat_mode != 'normal' else 'normal'
            fs = _unit_lb_row_to_api(lb, sm, cond_list) if lb else compute_unit_stats_no_cond(uid, info, raw, ldc)
        acq = acq_route; ai = ACQUISITION_ROUTE_ICONS.get(acq,''); si = []
        if ai: si.append(ai)
        thum = find_list_thumb(info.get('resource_ids', []), uid, 'images/unit_portraits')
        urow = {'id': uid, 'name': name, 'role': ROLE_MAP.get(role_id,'NPC'), 'role_id': role_id, 'role_sort': ROLE_SORT.get(role_id,3), 'role_icon': ROLE_ICON_MAP.get(role_id,''), 'rarity': RARITY_MAP.get(ri,'N'), 'rarity_id': ri, 'rarity_sort': RARITY_SORT.get(ri,4), 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'special_icons': si, 'thum': thum or '', 'acquisition_icon': ai or '', 'series': ser_list, 'is_ultimate': bool(info.get('is_ultimate', False)), 'is_limited_time': uid in LIMITED_TIME_UNIT_IDS, 'ATK': fs.get('Attack', fs.get('ATK', 0)), 'DEF': fs.get('Defense', fs.get('DEF', 0)), 'MOB': fs.get('Mobility', fs.get('MOB', 0)), 'HP': fs.get('HP', 0), 'EN': fs.get('EN', 0), 'MOV': fs.get('Move', fs.get('MOV', 0))}
        if grid_skills_u:
            urow['grid_abilities'] = collect_unit_grid_abilities(uid, ld, ldc, lc, stat_mode)
        rows.append(urow)
    rows = sort_rows(rows, sb, sd, {'name','role','rarity','ATK','DEF','MOB','HP','EN','MOV'})
    total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
    start = (page - 1) * pp; pr = rows[start:start + pp]
    _wbp = sorted(k for k in _debuff_keys_union if k in UNIT_WEAPON_DEBUFF_FILTER_KEYS)
    result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd, 'role_filter': role_arg, 'rarity_filter': rav, 'source_filter': source_arg, 'lineage_filter': lineage_arg, 'series_filter': series_arg, 'ability_filter': ability_arg, 'terrain_filter': terrain_arg, 'weapon_debuff': weapon_debuff_arg, 'weapon_debuff_present_keys': _wbp}
    set_cached_response(ck, result); return jsonify(convert_image_urls(result))

# Option part trait text → primary stat groups (matches front-end _dcParseOptionPartBonuses + TW phrasing).
_OP_PART_STAT_INCREASE_RE = re.compile(
    r'(?:Increase|Increases?)\s+(?:squad\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)(?:\s*,\s*(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move))*(?:\s+and\s+(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move))?\s+by\s+(\d+)(%?)',
    re.I,
)
OPTION_PART_EFFECT_FILTERS = frozenset({'ALL', 'HP', 'EN', 'ATK', 'DEF', 'MOB', 'OTHER'})


def parse_option_part_effect_keys(details):
    """Keys: HP, EN, Attack, Defense, Mobility, Move — used for Modifications tab effect filter."""
    keys = set()
    if not details:
        return keys
    stat_map = {'ATK': 'Attack', 'DEF': 'Defense', 'MOB': 'Mobility'}
    for m in _OP_PART_STAT_INCREASE_RE.finditer(details):
        for g in (m.group(1), m.group(2), m.group(3)):
            if not g:
                continue
            k = stat_map.get(g, g)
            if k in ('HP', 'EN', 'Attack', 'Defense', 'Mobility', 'Move'):
                keys.add(k)
    if 'mobility boost' in details.lower():
        keys.add('Mobility')
    if re.search(r'最大(?:HP|hp)提升', details) or '部隊最大HP提升' in details or '所屬部隊最大HP提升' in details:
        keys.add('HP')
    if re.search(r'最大(?:EN|en)提升', details) or '部隊最大EN提升' in details or '所屬部隊最大EN提升' in details:
        keys.add('EN')
    if '攻擊力提升' in details or '部隊攻擊力提升' in details:
        keys.add('Attack')
    if '防禦力提升' in details:
        keys.add('Defense')
    if '機動力提升' in details:
        keys.add('Mobility')
    if '移動力提升' in details:
        keys.add('Move')
    return keys


def option_part_matches_effect_filter(details, effect_key):
    if not effect_key or str(effect_key).upper() == 'ALL':
        return True
    ek = str(effect_key).upper()
    keys = parse_option_part_effect_keys(details)
    core_five = {'HP', 'EN', 'Attack', 'Defense', 'Mobility'}
    if ek == 'OTHER':
        return not bool(keys & core_five)
    mapping = {'HP': 'HP', 'EN': 'EN', 'ATK': 'Attack', 'DEF': 'Defense', 'MOB': 'Mobility'}
    want = mapping.get(ek)
    if want is None:
        return True
    return want in keys


_effect_filter_icons_cache = {}


def _compute_option_part_effect_filter_icons(ld):
    """
    For each effect filter key, use the option-part sprite (thum) of the first entry in master
    order whose trait details match that filter — same matching as list_option_parts.
    """
    ltm = ld.get('lang_text_map', {})
    icons = {k: '' for k in ('HP', 'EN', 'ATK', 'DEF', 'MOB', 'OTHER')}
    if not option_parts_data:
        return icons
    for item in extract_data_list(option_parts_data):
        if not isinstance(item, dict):
            continue
        opid = str(item.get('Id') or item.get('id', 0))
        if opid == '0':
            continue
        trait_set_id = normalize_id(item.get('TraitSetId') or item.get('traitSetId'))
        trait_ids = trait_set_traits_map.get(trait_set_id, [])
        details_list = []
        for tid in trait_ids:
            tdata = trait_data_map.get(tid, {})
            dlid = tdata.get('desc_lang_id', '')
            if dlid:
                desc = ltm.get(dlid, '')
                if desc:
                    details_list.append(desc.strip())
        details = ' '.join(details_list) if details_list else ''
        res_id = str(item.get('ResourceId') or item.get('resourceId') or '').strip()
        thum = f"/static/images/Option-Part (Modification)/Sprite/{res_id}.png" if res_id else ''
        if not thum:
            continue
        for ek in ('HP', 'EN', 'ATK', 'DEF', 'MOB', 'OTHER'):
            if icons[ek]:
                continue
            if option_part_matches_effect_filter(details, ek):
                icons[ek] = thum
        if all(icons[k] for k in icons):
            break
    return icons


def get_option_part_effect_filter_icons(lc):
    lc = validate_lang_code(lc)
    if lc in _effect_filter_icons_cache:
        return _effect_filter_icons_cache[lc]
    ld = get_lang_data(lc)
    icons = _compute_option_part_effect_filter_icons(ld)
    _effect_filter_icons_cache[lc] = icons
    return icons


@app.route('/api/option_parts')
def list_option_parts():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
        pp = min(100, max(10, int(request.args.get('per_page', 50)))); sb = request.args.get('sort', 'name'); sd = request.args.get('dir', 'asc')
        sq = request.args.get('q', '').strip().lower(); rf = request.args.get('rarity', 'ALL').strip().upper()
        ef = request.args.get('effect', 'ALL').strip().upper()
        if ef not in OPTION_PART_EFFECT_FILTERS:
            ef = 'ALL'
        ck = f"op6_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{rf}_{ef}"
        cached = get_cached_response(ck)
        if cached:
            out = dict(cached)
            out['effect_filter_icons'] = get_option_part_effect_filter_icons(lc)
            return jsonify(convert_image_urls(out))
        if not option_parts_data:
            return jsonify(convert_image_urls({
                'rows': [], 'total': 0, 'page': 1, 'per_page': pp, 'total_pages': 1,
                'sort': sb, 'dir': sd, 'rarity_filter': rf, 'effect_filter': ef,
                'effect_filter_icons': get_option_part_effect_filter_icons(lc),
            }))
        ld = get_lang_data(lc); op_text_map = ld.get('op_text_map', {}); llk = ld.get('lineage_lookup', {}); ltm = ld.get('lang_text_map', {})
        rows = []
        for item in extract_data_list(option_parts_data):
            if not isinstance(item, dict): continue
            opid = str(item.get('Id') or item.get('id', 0))
            if opid == '0': continue
            ri = str(item.get('RarityTypeIndex') or 1)
            if rf != 'ALL' and RARITY_MAP.get(ri, 'N') != rf: continue
            name_lid = normalize_id(item.get('SortNameLanguageId') or item.get('sortNameLanguageId'))
            name = op_text_map.get(name_lid, '') if name_lid else ''
            if not name: name = f'Option Part {opid}'
            trait_set_id = normalize_id(item.get('TraitSetId') or item.get('traitSetId'))
            trait_ids = trait_set_traits_map.get(trait_set_id, [])
            details_list = []
            for tid in trait_ids:
                tdata = trait_data_map.get(tid, {}); dlid = tdata.get('desc_lang_id', '')
                if dlid: desc = ltm.get(dlid, ''); (desc and details_list.append(desc.strip()))
            details = ' '.join(details_list) if details_list else ''
            lineage_ids = option_parts_lineage_map.get(opid, [])
            tags = [llk.get(lid, '') for lid in lineage_ids if llk.get(lid)]
            tags_str = ' '.join(tags)
            if sq:
                searchable = f"{name} {details} {tags_str}".lower()
                tag_blob = [tags_str.lower()] if tags_str else []
                if not search_row_matches_query(sq, searchable, tag_blob, entity_id=opid): continue
            if ef != 'ALL' and not option_part_matches_effect_filter(details, ef):
                continue
            res_id = str(item.get('ResourceId') or item.get('resourceId') or '').strip()
            icon = f"/static/images/Option-Part (Modification)/Sprite/{res_id}.png" if res_id else ''
            rows.append({'id': opid, 'name': name, 'details': details, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_id': ri, 'rarity_sort': RARITY_SORT.get(ri, 4), 'rarity_icon': RARITY_ICON_MAP.get(ri, ''), 'thum': icon, 'tags': tags})
        rows = sort_rows(rows, sb, sd, {'name', 'rarity', 'details'})
        total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
        start = (page - 1) * pp; pr = rows[start:start + pp]
        result = {
            'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp,
            'sort': sb, 'dir': sd, 'rarity_filter': rf, 'effect_filter': ef,
            'effect_filter_icons': get_option_part_effect_filter_icons(lc),
        }
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'rows': [], 'total': 0, 'page': 1, 'per_page': 50, 'total_pages': 1}), 500

@app.route('/api/supporters')
def list_supporters():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
        pp = min(100, max(10, int(request.args.get('per_page', 50)))); sb = request.args.get('sort', 'rarity'); sd = request.args.get('dir', 'desc')
        sq = request.args.get('q', '').strip().lower()
        rav = request.args.get('rarity', '').strip(); rarity_filter = parse_list_rarity_filter(rav); rk = rarity_filter_cache_fragment(rarity_filter)
        lineage_arg = request.args.get('lineage_id', '').strip()
        lineage_filter = parse_list_lineage_filter(lineage_arg)
        lineage_ck = lineage_filter_cache_fragment(lineage_filter)
        ck = f"sl7_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{rk}_{lineage_ck}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); rows = []
        for sid, info in supporter_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            nsid = normalize_id(sid)
            ri = info.get('rarity','1'); lid = ld.get('supporter_id_map', {}).get(sid, ''); name = ld.get('supporter_text_map', {}).get(lid, '') if lid else ''
            if not name: continue
            lim = nsid in LIMITED_TIME_SUPPORTER_IDS
            id_seek = bool(sq and search_query_matches_entity_id(sq, sid))
            if lineage_filter is not None:
                if not id_seek and not supporter_matches_lineage_filter(sid, lineage_filter, ld, lc):
                    continue
            if rarity_filter is not None:
                if not rarity_filter:
                    continue
                letter = RARITY_MAP.get(str(ri), 'N')
                if not row_matches_rarity_filter(rarity_filter, letter, lim):
                    continue
            lsr = supporter_leader_map.get(sid, []); all_tags = []; descs = []; std = []
            for ls in lsr:
                if ls.get('tier') != 3: continue
                desc = ld.get('supporter_leader_text_map', {}).get(ls.get('desc_lang_id', ''), '')
                tags = resolve_condition_tags(ls.get('trait_cond_id', '0'), trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), lc)
                if desc: descs.append(desc)
                sep = 'and' if '44%' in desc else ('or' if '36%' in desc or len(tags) >= 2 else 'default')
                if tags: std.append({'tags': tags, 'separator': sep})
                for t in tags:
                    if not any(x['name'] == t['name'] for x in all_tags): all_tags.append(t)
            sts = ", ".join([t['name'] for t in all_tags]); cb = "\n".join(descs)
            ask_names = []
            for a in supporter_active_map.get(sid, []):
                an = ld.get('supporter_active_text_map', {}).get(a.get('name_lang_id', ''), '')
                if an: ask_names.append(an)
            ask_str = " ".join(ask_names)
            if sq:
                searchable = f"{name} {sid} {sts} {cb} {ask_str}".lower()
                ser_names_lower = [t['name'].lower() for t in all_tags if t.get('name')]
                if not search_row_matches_query(sq, searchable, ser_names_lower, entity_id=sid): continue
            thum = find_supporter_portrait(info.get('resource_id'), sid)
            aic = ''
            ask = supporter_active_map.get(sid, [])
            if ask:
                icf = find_trait_icon(ask[0].get('resource_id', ''))
                if icf: aic = f"/static/images/Trait/{icf}"
            rows.append({'id': sid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_id': ri, 'rarity_sort': RARITY_SORT.get(ri, 4), 'rarity_icon': RARITY_ICON_MAP.get(ri, ''), 'thum': thum or '', 'skill_tag_data': std, 'series_tag': sts, 'boost': cb, 'active_icon': aic, 'is_limited_time': lim})
        rows = sort_rows(rows, sb, sd, {'name', 'rarity', 'series_tag', 'boost'})
        total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
        start = (page - 1) * pp; pr = rows[start:start + pp]
        result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd, 'rarity_filter': rav}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'rows': [], 'total': 0, 'page': 1, 'per_page': 50, 'total_pages': 1}), 500

def latest_release_schedule_content_locked(schedule_id, start_ms):
    """Hide lineup when LATEST_RELEASE_PASSWORD is set, session not unlocked, and the gacha
    has not started yet (StartDatetime in the future vs now), or test env pins match."""
    if not LATEST_RELEASE_PASSWORD:
        return False
    if session.get('lr_unlocked') is True:
        return False
    sid = normalize_id(schedule_id)
    if LATEST_RELEASE_TEST_LOCK_SCHEDULE_ID and sid == normalize_id(LATEST_RELEASE_TEST_LOCK_SCHEDULE_ID):
        return True
    if LATEST_RELEASE_TEST_LOCK_START_MS is not None and int(start_ms) == int(LATEST_RELEASE_TEST_LOCK_START_MS):
        return True
    if LATEST_RELEASE_LOCK_FUTURE_STARTS:
        now_ms = int(time.time() * 1000)
        if int(start_ms) > now_ms:
            return True
    return False


def lr_schedule_cache_key_fragment():
    """Vary server-side caches when Latest Release password/session affects visible entities."""
    if not LATEST_RELEASE_PASSWORD:
        return 'lr0'
    return 'lr1' if session.get('lr_unlocked') is True else 'lr2'


def entity_hidden_by_lr_schedule_lock(schedule_id):
    """True when this schedule is locked the same way as Latest Release (hide from Characters/Units/Supporters tabs)."""
    sid = normalize_id(schedule_id or '0')
    if sid in ('0', '9999990001'):
        return False
    sm = schedule_start_ms_by_id.get(sid, 0)
    return latest_release_schedule_content_locked(sid, sm)


def npc_password_unlocked():
    """NPC visibility gate (separate password/session)."""
    if not NPC_VIEW_PASSWORD:
        return True
    return session.get('npc_view_unlocked') is True


def jp_mode_unlocked():
    if not JP_MODE_PASSWORD:
        return True
    return session.get('jp_mode_unlocked') is True


def npc_view_cache_key_fragment():
    """Vary server-side caches when NPC lock/session affects visible entities."""
    if not NPC_VIEW_PASSWORD:
        return 'npc0'
    return 'npc1' if session.get('npc_view_unlocked') is True else 'npc2'


@app.route('/api/npc_view/status')
def api_npc_view_status():
    if not NPC_VIEW_PASSWORD:
        return jsonify({'password_required': False, 'unlocked': True})
    return jsonify({'password_required': True, 'unlocked': session.get('npc_view_unlocked') is True})


@app.route('/api/npc_view/unlock', methods=['POST'])
def api_npc_view_unlock():
    if not NPC_VIEW_PASSWORD:
        return jsonify({'ok': True, 'password_required': False})
    data = request.get_json(force=True, silent=True) or {}
    pw = (data.get('password') or '').strip()
    if pw != NPC_VIEW_PASSWORD:
        return jsonify({'ok': False, 'error': 'invalid_password'}), 403
    session['npc_view_unlocked'] = True
    return jsonify({'ok': True, 'password_required': True})


@app.route('/api/jp_mode/status')
def api_jp_mode_status():
    msg = "We apologize for the inconvenience.\nDue to unforeseen conflicts, the Japan version is currently locked.\nThank you for your understanding."
    if not JP_MODE_PASSWORD:
        return jsonify({'password_required': False, 'unlocked': True, 'message': msg})
    return jsonify({'password_required': True, 'unlocked': session.get('jp_mode_unlocked') is True, 'message': msg})


@app.route('/api/jp_mode/unlock', methods=['POST'])
def api_jp_mode_unlock():
    if not JP_MODE_PASSWORD:
        return jsonify({'ok': True, 'password_required': False})
    data = request.get_json(force=True, silent=True) or {}
    pw = (data.get('password') or '').strip()
    if pw != JP_MODE_PASSWORD:
        return jsonify({'ok': False, 'error': 'invalid_password'}), 403
    session['jp_mode_unlocked'] = True
    return jsonify({'ok': True, 'password_required': True})


@app.route('/api/latest_release/status')
def api_latest_release_status():
    """Whether Latest Release requires a password and if this session is unlocked."""
    if not LATEST_RELEASE_PASSWORD:
        return jsonify({
            'password_required': False,
            'unlocked': True,
            'test_lock_schedule_id': LATEST_RELEASE_TEST_LOCK_SCHEDULE_ID or None,
        })
    return jsonify({
        'password_required': True,
        'unlocked': session.get('lr_unlocked') is True,
        # Lets you confirm the server loaded LATEST_RELEASE_TEST_LOCK_SCHEDULE_ID from .env (not secret).
        'test_lock_schedule_id': LATEST_RELEASE_TEST_LOCK_SCHEDULE_ID or None,
    })


@app.route('/api/latest_release/unlock', methods=['POST'])
def api_latest_release_unlock():
    """Unlock Latest Release for this session; returns a unique watermark id for tracing."""
    if not LATEST_RELEASE_PASSWORD:
        return jsonify({'ok': True, 'watermark': '', 'password_required': False})
    data = request.get_json(force=True, silent=True) or {}
    pw = (data.get('password') or '').strip()
    if pw != LATEST_RELEASE_PASSWORD:
        return jsonify({'ok': False, 'error': 'invalid_password'}), 403
    session['lr_unlocked'] = True
    session['lr_wm'] = secrets.token_hex(8) + '-' + str(int(time.time()))
    return jsonify({'ok': True, 'watermark': session['lr_wm'], 'password_required': True})


@app.route('/api/latest_release')
def api_latest_release():
    """Group units, characters, and supporters by gasha ScheduleId; dates from m_schedule StartDatetime (JST)."""
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
    # Do NOT return 401 for the whole tab — per-schedule lock is applied below via latest_release_schedule_content_locked().
    unlocked = session.get('lr_unlocked') is True
    wm = session.get('lr_wm', '') if (LATEST_RELEASE_PASSWORD and unlocked) else ''
    show_all = request.args.get('full', '').lower() in ('1', 'true', 'yes') or request.args.get('all', '').lower() in ('1', 'true', 'yes')
    scope = 'full' if show_all else 'recent'
    wm_ck = wm or 'na'
    ck = f"lr_v5_{lc}_{wm_ck}_{scope}_{1 if unlocked else 0}"
    cached = get_cached_response(ck)
    if cached:
        return jsonify(convert_image_urls(cached))
    ld = get_lang_data(lc)
    skip_sched = {'0', '9999990001'}
    groups = {}

    def ensure_group(sched):
        if sched not in groups:
            sm = schedule_start_ms_by_id.get(sched, 0)
            groups[sched] = {'schedule_id': sched, 'start_ms': sm, 'items': []}
        return groups[sched]

    for cid, info in char_info_map.items():
        sched = info.get('schedule_id', '0')
        if sched in skip_sched or sched not in schedule_start_ms_by_id:
            continue
        if info.get('role', '0') == '0':
            continue
        if cid not in char_list_playable_ids:
            continue
        lid = ld['char_id_map'].get(cid, '')
        name = ld['char_text_map'].get(lid, '') if lid else ''
        if not name:
            continue
        ri = info.get('rarity', '1')
        acq = info.get('acquisition_route', '0')
        acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
        role_id = info.get('role', '0')
        thum = find_list_thumb(info.get('resource_ids', []), cid, 'images/portraits')
        ensure_group(sched)['items'].append({
            'type': 'character', 'id': cid, 'name': name, 'thum': thum or '',
            'rarity': RARITY_MAP.get(str(ri), 'N'), 'rarity_id': str(ri),
            'role_icon': ROLE_ICON_MAP.get(role_id, ''),
            'acquisition_icon': acq_icon or '',
        })

    for uid, info in unit_info_map.items():
        sched = info.get('schedule_id', '0')
        if sched in skip_sched or sched not in schedule_start_ms_by_id:
            continue
        if info.get('role', '0') == '0':
            continue
        if uid not in unit_list_playable_ids:
            continue
        lid = ld['unit_id_map'].get(uid, '')
        name = ld['unit_text_map'].get(lid, '') if lid else ''
        if not name:
            continue
        ri = info.get('rarity', '1')
        acq = info.get('acquisition_route', '0')
        ai = ACQUISITION_ROUTE_ICONS.get(acq, '')
        si = []
        if ai:
            si.append(ai)
        role_id = info.get('role', '0')
        thum = find_list_thumb(info.get('resource_ids', []), uid, 'images/unit_portraits')
        rec_cid = str(info.get('recommend_character_id') or '0')
        ensure_group(sched)['items'].append({
            'type': 'unit', 'id': uid, 'name': name, 'thum': thum or '',
            'rarity': RARITY_MAP.get(str(ri), 'N'), 'rarity_id': str(ri),
            'role_icon': ROLE_ICON_MAP.get(role_id, ''),
            'acquisition_icon': ai or '', 'special_icons': si,
            'is_ultimate': bool(info.get('is_ultimate', False)),
            'recommend_character_id': rec_cid,
        })

    for sid, info in supporter_info_map.items():
        sched = info.get('schedule_id', '0')
        if sched in skip_sched or sched not in schedule_start_ms_by_id:
            continue
        lid = ld.get('supporter_id_map', {}).get(sid, '')
        name = ld.get('supporter_text_map', {}).get(lid, '') if lid else ''
        if not name:
            continue
        ri = info.get('rarity', '1')
        thum = find_supporter_portrait(info.get('resource_id'), sid)
        ensure_group(sched)['items'].append({
            'type': 'supporter', 'id': sid, 'name': name, 'thum': thum or '',
            'rarity': RARITY_MAP.get(str(ri), 'N'), 'rarity_id': str(ri),
        })

    out_list = []
    for sched, g in groups.items():
        if not g['items']:
            continue
        g['items'] = sort_latest_release_group_items(g['items'])
        for _it in g['items']:
            _it.pop('recommend_character_id', None)
        sm = g['start_ms']
        jst = format_start_datetime_jst(sm)
        g['start_datetime_jst'] = jst if jst else f'Schedule {sched}'
        if latest_release_schedule_content_locked(sched, sm):
            g['items'] = []
            g['locked'] = True
        else:
            g['locked'] = False
        del g['start_ms']
        out_list.append(g)
    out_list.sort(key=lambda x: schedule_start_ms_by_id.get(x['schedule_id'], 0), reverse=True)
    full_list = out_list
    has_more = False
    if not show_all:
        ws = jst_three_month_window_start_ms()
        if ws > 0:
            filtered = [g for g in full_list if schedule_start_ms_by_id.get(g['schedule_id'], 0) >= ws]
        else:
            filtered = list(full_list)
        has_more = len(filtered) < len(full_list)
        out_list = filtered
    result = {
        'groups': out_list,
        'has_more': has_more,
        'scope': scope,
        'has_locked_groups': any(g.get('locked') for g in out_list),
    }
    if LATEST_RELEASE_PASSWORD:
        result['watermark'] = wm
    set_cached_response(ck, result)
    return jsonify(convert_image_urls(result))

@app.route('/api/supporter/<supporter_id>')
def get_supporter(supporter_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        level = min(100, max(1, int(request.args.get('level', 100))))
        lb_tier = min(3, max(0, int(request.args.get('lb_tier', 3))))
        ck = f"s2_{supporter_id}_{lc}_{level}_{lb_tier}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); supporter_id = normalize_id(supporter_id); info = supporter_info_map.get(supporter_id)
        if not info: return jsonify({'error': f'Supporter {supporter_id} not found'}), 404
        if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
            return jsonify({'error': f'Supporter {supporter_id} not found'}), 404
        ri = info.get('rarity', '1'); lid = ld.get('supporter_id_map', {}).get(supporter_id, ""); cn = ld.get('supporter_text_map', {}).get(lid, "Unknown") if lid else "Unknown"
        base_hp = int(info.get('hp_add', 0)); base_atk = int(info.get('atk_add', 0))
        rate = supporter_growth_map.get((level, lb_tier), 10000)
        hps = math.floor(base_hp * rate / 10000); atks = math.floor(base_atk * rate / 10000)
        ls = []
        for l in supporter_leader_map.get(supporter_id, []):
            if l.get('tier') != lb_tier: continue
            desc = ld.get('supporter_leader_text_map', {}).get(l.get('desc_lang_id', ''), '')
            tags = resolve_condition_tags(l.get('trait_cond_id', '0'), trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), lc)
            sep = 'and' if '44%' in desc else ('or' if '36%' in desc or len(tags) >= 2 else 'default')
            ls.append({'desc': desc, 'tags': tags, 'separator': sep})
        asks = []
        for a in supporter_active_map.get(supporter_id, []):
            an = ld.get('supporter_active_text_map', {}).get(a.get('name_lang_id', ''), ''); ad = ld.get('supporter_active_text_map', {}).get(a.get('desc_lang_id', ''), '')
            icf = find_trait_icon(a.get('resource_id', ''))
            asks.append({'name': an, 'desc': ad, 'icon': f"/static/images/Trait/{icf}" if icf else ''})
        portrait = find_supporter_full_portrait(info.get('resource_id')) or find_supporter_portrait(info.get('resource_id'), supporter_id)
        result = {'id': supporter_id, 'name': cn, 'rarity': RARITY_MAP.get(ri, "Unknown"), 'rarity_id': ri, 'rarity_icon': RARITY_ICON_MAP.get(ri, ''), 'hp_support': hps, 'atk_support': atks, 'leader_skills': ls, 'active_skills': asks, 'portrait': portrait, 'lang': lc, 'level': level, 'lb_tier': lb_tier, 'base_hp': base_hp, 'base_atk': base_atk, 'growth_rate_basis': rate, 'is_limited_time': supporter_id in LIMITED_TIME_SUPPORTER_IDS}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

@app.route('/api/stages')
def list_stages():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
        pp = min(100, max(10, int(request.args.get('per_page', 50)))); sq = request.args.get('q', '').strip().lower()
        df = request.args.get('difficulty', 'ALL').lower(); sb = request.args.get('sort', 'stage_number'); sd = request.args.get('dir', 'asc')
        ck = f"stages4_{lc}_{page}_{pp}_{sq}_{df}_{sb}_{sd}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); rows = []
        for sid, est in eternal_stage_map.items():
            sn = est.get('stage_number', 0); sname = ld.get('stage_text_map', {}).get(est.get('stage_name_lang_id', ''), '') or f"Unknown ({sid})"
            if sq:
                searchable = f"{sid} {sname} {sn}".lower()
                if not search_row_matches_query(sq, searchable, None, entity_id=sid): continue
            sm = stage_map.get(sid, {}); diff = get_stage_difficulty(sid, lc)
            if df != 'all' and df != '' and diff['code'] != df: continue
            duid = est.get('display_unit_id', '0'); portrait = ''
            if duid != '0':
                uinfo = unit_info_map.get(duid, {}); portrait = find_portrait(uinfo.get('resource_ids', []), duid, 'images/unit_portraits') or ''
            rows.append({'id': sid, 'stage_number': sn, 'name': sname, 'recommended_cp': sm.get('recommended_cp', 0), 'terrain': resolve_stage_terrain_name(sm.get('terrain_type_index', '0'), lc), 'difficulty_code': diff['code'], 'difficulty_name': diff['name'], 'portrait': portrait})
        if sb == 'stage_number':
            if sd == 'asc': rows.sort(key=lambda x: (safe_int(x.get('stage_number', 0), 0), safe_int(x['id'], 0)))
            else: rows.sort(key=lambda x: (-safe_int(x.get('stage_number', 0), 0), safe_int(x['id'], 0)))
        else:
            rows.sort(key=lambda x: (safe_int(x.get('stage_number', 0), 0), safe_int(x['id'], 0)))
        total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
        start = (page - 1) * pp; pr = rows[start:start + pp]
        result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'rows': [], 'total': 0, 'page': 1, 'per_page': 50, 'total_pages': 1}), 500

@app.route('/api/stage/<stage_id>')
def get_stage(stage_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); stage_id = normalize_id(stage_id); ck = f"stage_{stage_id}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); est = eternal_stage_map.get(stage_id)
        if not est: return jsonify({'error': f'Stage {stage_id} not found'}), 404
        sm = stage_map.get(stage_id, {}); sn = est.get('stage_number', 0)
        sname = ld.get('stage_text_map', {}).get(est.get('stage_name_lang_id', ''), '') or f"Unknown ({stage_id})"
        diff = get_stage_difficulty(stage_id, lc); duid = est.get('display_unit_id', '0'); portrait = ''
        if duid != '0':
            uinfo = unit_info_map.get(duid, {}); portrait = find_portrait(uinfo.get('resource_ids', []), duid, 'images/unit_portraits') or ''
        sg = []
        for gn, gk in [(1, 'group1_set_id'), (2, 'group2_set_id')]:
            gid = sm.get(gk, '0')
            if gid != '0': sg.append({'group_no': gn, 'restrictions': resolve_sortie_restriction_set(gid, lc)})
        vc, dc = resolve_stage_conditions(stage_id, lc)
        md = {'width': 0, 'height': 0, 'units': []}; nd = []
        mse = map_stage_lookup.get(stage_id)
        if mse:
            mid = mse.get('map_id', '0'); msid = mse.get('map_stage_id', '0')
            mi = map_master_lookup.get(mid, {'width': 0, 'height': 0}); w = mi['width']; h = mi['height']
            uom = []; nt = map_npc_by_map_stage.get(msid, []); tb = calculate_npc_team_bonuses(nt, lc)
            for npc in nt:
                nid = npc['id']; nu = map_npc_unit_lookup.get(nid, []); nc = map_npc_character_lookup.get(nid, [])
                ue = nu[0] if nu else None; ce = nc[0] if nc else None
                dn = f"NPC {nid}"; dp = ''; il = False; up = None; cp = None
                if ue:
                    uabs = resolve_npc_unit_abilities(ue.get('ability_set_id', '0'), lc)
                    fst, tba = apply_team_bonus_to_unit_stats({'HP': ue.get('hp', 0), 'EN': ue.get('en', 0), 'Attack': ue.get('attack', 0), 'Defense': ue.get('defense', 0), 'Mobility': ue.get('mobility', 0), 'Move': ue.get('movement', 0)}, tb)
                    upuid = ue.get('unit_id', '0'); up = get_npc_unit_display(upuid, fst, lc); up['abilities'] = uabs
                    upui = unit_info_map.get(upuid, {}); upubr = upui.get('bromide_resource_id', '') or (upui.get('resource_ids', [''])[0] if upui.get('resource_ids') else '')
                    up['weapons'] = resolve_npc_unit_weapons(ue.get('weapon_set_id', '0'), upuid, upubr, lc); up['bonus_amounts'] = tba
                    dn = up['name']; dp = up['portrait']; il = is_large_map_npc(nid, npc)
                if ce:
                    cp = get_npc_character_display(ce.get('character_id', '0'), {'Ranged': ce.get('ranged', 0), 'Melee': ce.get('melee', 0), 'Defense': ce.get('defense', 0), 'Reaction': ce.get('reaction', 0), 'Awaken': ce.get('awaken', 0)}, lc)
                    cabs = resolve_npc_character_abilities(ce.get('ability_set_id', '0'), lc); csks = resolve_npc_character_skills(ce.get('skill_set_id', '0'), lc)
                    cp['abilities'] = cabs if cabs else [get_ui_label(lc, 'none')]; cp['skills'] = csks if csks else [get_ui_label(lc, 'none')]
                    if cabs:
                        bp = calculate_npc_character_self_bonus_pct(cabs)
                        boosted, bonus_amounts = apply_bonus_to_char_stats(cp.get('stats_raw', {}), bp)
                        cp['stats_raw'] = boosted; cp['bonus_amounts'] = bonus_amounts
                is_ally = npc.get('battle_side_type', '2') == '1'
                side = 'ally' if is_ally else 'enemy'
                guest_icon = '/static/images/Stages/UI_GTower_Minimap_Icon_GuestArmy.png' if is_ally else None
                me = {'npc_id': nid, 'name': dn, 'portrait': guest_icon or dp, 'x': npc.get('x', 0), 'y': npc.get('y', 0), 'is_large': il, 'side': side, 'is_guest_ally': is_ally}
                me['cells'] = get_large_unit_cells(npc.get('x', 0), npc.get('y', 0)) if il else [{'x': npc.get('x', 0), 'y': npc.get('y', 0)}]
                uom.append(me); nd.append({'npc_id': nid, 'x': npc.get('x', 0), 'y': npc.get('y', 0), 'is_large': il, 'unit': up, 'character': cp})
            for ally in build_ally_positions(msid):
                uom.append({'npc_id': f"ally_g{ally['group_no']}_s{ally['slot']}", 'name': f"{get_ui_label(lc, 'sortie_group').format(ally['group_no'])} #{ally['slot']}", 'portrait': '/static/images/Stages/UI_GTower_Minimap_Icon_OwnArmy.png', 'x': ally['x'], 'y': ally['y'], 'direction': ally.get('direction', '0'), 'is_large': False, 'side': 'ally', 'cells': [{'x': ally['x'], 'y': ally['y']}]})
            max_x = max_y = 0
            for u in uom:
                for c in (u.get('cells') or [{'x': u.get('x', 0), 'y': u.get('y', 0)}]):
                    max_x = max(max_x, int(c.get('x', 0))); max_y = max(max_y, int(c.get('y', 0)))
            pad = 2; w = max(w, max_x + 1 + pad); h = max(h, max_y + 1 + pad)
            md = build_map_grid(w, h, uom)
        result = {'id': stage_id, 'stage_number': sn, 'name': sname, 'difficulty_code': diff['code'], 'difficulty_name': diff['name'], 'portrait': portrait, 'recommended_cp': sm.get('recommended_cp', 0), 'terrain': resolve_stage_terrain_name(sm.get('terrain_type_index', '0'), lc), 'victory_conditions': vc, 'defeat_conditions': dc, 'sortie_groups': sg, 'map_data': md, 'npc_details': nd, 'lang': lc}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

@app.route('/api/character/<char_id>')
def get_character(char_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); ck = f"c_{char_id}_{lc}_r3_{lr_schedule_cache_key_fragment()}_{npc_view_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); ldc = get_calc_lang_data(); char_id = normalize_id(char_id); info = char_info_map.get(char_id)
        if not info: return jsonify({'error': f'Character {char_id} not found'}), 404
        if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
            return jsonify({'error': f'Character {char_id} not found'}), 404
        if str(info.get('role', '0')) == '0' and not npc_password_unlocked():
            return jsonify({'error': f'Character {char_id} not found'}), 404
        ri = info.get('rarity','1'); lid = ld['char_id_map'].get(char_id, ""); cn = ld['char_text_map'].get(lid, "Unknown") if lid else "Unknown"
        raw = char_stat_map.get(char_id, {}); has_sp = int(ri) <= 4
        def rv(s): t = raw.get(s, (0,0,0)); return (t[0], t[1], t[2] if len(t) >= 3 else t[1])
        grown = {s: calc_growth_char(rv(s)[0], rv(s)[1], ri) for s in CHAR_STAT_ORDER}
        grown_sp = {s: rv(s)[2] for s in CHAR_STAT_ORDER}
        fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId','')) == char_id]
        def build_ab(ab, lang=lc):
            bid = normalize_id(ab.get('AbilityId','')); spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
            d = ldc if lang == CALC_LANG else ld
            bab = build_ability_entry(bid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder',0)), lang_code=lang)
            if spid and spid != '0' and spid != 'None' and spid != bid:
                bab['sp_replacement'] = build_ability_entry(spid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder',0)), lang_code=lang)
            return bab
        abilities = [build_ab(ab) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder',0)))]
        ac = [build_ab(ab, CALC_LANG) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder',0)))]
        spbn, spen, spbs, spes = {s: 0 for s in CHAR_STAT_ORDER}, {s: 0 for s in CHAR_STAT_ORDER}, {s: 0 for s in CHAR_STAT_ORDER}, {s: 0 for s in CHAR_STAT_ORDER}
        for bab in ac:
            for d2 in bab.get('details', []):
                for s, p in extract_stat_percent_char(d2['text']).items():
                    if bab.get('is_ex', False): spen[s] += p
                    else: spbn[s] += p
            sab = bab.get('sp_replacement', bab)
            for d2 in sab.get('details', []):
                for s, p in extract_stat_percent_char(d2['text']).items():
                    if sab.get('is_ex', False): spes[s] += p
                    else: spbs[s] += p
        sne = []; swe = []; ssne = []; sswe = []
        for s in CHAR_STAT_ORDER:
            bv = grown.get(s, 0); bon = math.floor(bv * spbn[s] / 100) if bv > 0 else 0
            sne.append({'name': s, 'base': bv, 'total': bv + bon, 'bonus': bon})
            tb = math.floor(bv * (spbn[s] + spen[s]) / 100) if bv > 0 else 0
            swe.append({'name': s, 'base': bv, 'total': bv + tb, 'bonus': tb})
            sbv = grown_sp.get(s, 0); sbon = math.floor(sbv * spbs[s] / 100) if sbv > 0 else 0
            ssne.append({'name': s, 'base': sbv, 'total': sbv + sbon, 'bonus': sbon})
            stb = math.floor(sbv * (spbs[s] + spes[s]) / 100) if sbv > 0 else 0
            sswe.append({'name': s, 'base': sbv, 'total': sbv + stb, 'bonus': stb})
        stats = sne; stats_with_ex = swe; sp_stats = ssne; sp_stats_with_ex = sswe
        has_ex_stats = any(spen[s] > 0 for s in CHAR_STAT_ORDER) or any(spes[s] > 0 for s in CHAR_STAT_ORDER)
        portrait = find_portrait(info.get('resource_ids', []), char_id, 'images/portraits')
        thum = find_list_thumb(info.get('resource_ids', []), char_id, 'images/portraits')
        acq = info.get('acquisition_route', '0'); acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
        fs2 = [x for x in extract_data_list(char_skill) if normalize_id(x.get('CharacterId','')) == char_id]
        skills = []; ms = 0; spa = []; ex = set()
        for sk in sorted(fs2, key=lambda x: int(x.get('SortOrder', 0))):
            si = normalize_id(sk.get('CharacterSkillId','') or sk.get('SkillId',''))
            spsi = normalize_id(sk.get('SpCharacterSkillId') or sk.get('spCharacterSkillId'))
            sv = int(sk.get('SortOrder', 0)); ms = max(ms, sv)
            if si != '0':
                resolved = resolve_char_skill(si, ld, sv, False)
                if spsi and spsi != '0' and spsi != 'None' and spsi != si: resolved['replaced_by_sp_id'] = spsi
                skills.append(resolved); ex.add(si)
            if spsi and spsi != '0' and spsi != 'None' and spsi != si: spa.append(spsi)
        for spsi in spa:
            if spsi not in ex: ms += 1; skills.append(resolve_char_skill(spsi, ld, ms, True)); ex.add(spsi)
        spn = {sk['name'].strip().lower() for sk in skills if sk.get('is_sp')}
        for sk in skills:
            if not sk.get('is_sp'):
                if sk.get('replaced_by_sp_id'): sk['replaced_by_sp'] = True
                elif sk['name'].strip().lower() in spn: sk['replaced_by_sp'] = True
        rec_uid = CHAR_RECOMMEND_UNIT_MAP.get(char_id)
        recommend_unit = None
        if rec_uid and rec_uid in unit_info_map:
            uinfo = unit_info_map[rec_uid]
            if not entity_hidden_by_lr_schedule_lock(uinfo.get('schedule_id', '0')):
                uri = uinfo.get('rarity', '1')
                urole = uinfo.get('role', '0')
                ulid = ld.get('unit_id_map', {}).get(rec_uid, '')
                uname = ld.get('unit_text_map', {}).get(ulid, '') if ulid else ''
                if not uname:
                    uname = f'Unknown ({rec_uid})'
                uthum = find_list_thumb(uinfo.get('resource_ids', []), rec_uid, 'images/unit_portraits')
                uacq = uinfo.get('acquisition_route', '0')
                uai = ACQUISITION_ROUTE_ICONS.get(uacq, '')
                recommend_unit = {'id': rec_uid, 'name': uname, 'rarity': RARITY_MAP.get(uri, 'N'), 'rarity_icon': RARITY_ICON_MAP.get(uri, ''), 'role': ROLE_MAP.get(urole, 'NPC'), 'role_icon': ROLE_ICON_MAP.get(urole, ''), 'thum': uthum or '', 'acquisition_icon': uai or ''}
        result = {'id': char_id, 'name': cn, 'rarity': RARITY_MAP.get(ri,"Unknown"), 'rarity_id': ri, 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'role': ROLE_MAP.get(info.get('role','0'),"Unknown"), 'role_id': info.get('role','0'), 'role_icon': ROLE_ICON_MAP.get(info.get('role','0'),''), 'acquisition_icon': acq_icon or '', 'stats': stats, 'stats_with_ex': stats_with_ex, 'has_ex_stats': has_ex_stats, 'has_sp': has_sp, 'sp_stats': sp_stats, 'sp_stats_with_ex': sp_stats_with_ex, 'tags': resolve_tags(char_lin_map, char_id, lc, 'character'), 'series': resolve_series(ld['char_ser_map'].get(char_id, ''), lc), 'abilities': abilities, 'skills': skills, 'portrait': portrait, 'thum': thum or '', 'lang': lc, 'recommend_unit': recommend_unit, 'is_limited_time': char_id in LIMITED_TIME_CHARACTER_IDS}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

@app.route('/api/unit/<unit_id>')
def get_unit(unit_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); ck = f"u_{unit_id}_{lc}_ssp8_{lr_schedule_cache_key_fragment()}_{npc_view_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); ldc = get_calc_lang_data(); unit_id = normalize_id(unit_id); info = unit_info_map.get(unit_id)
        if not info: return jsonify({'error': f'Unit {unit_id} not found'}), 404
        if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
            return jsonify({'error': f'Unit {unit_id} not found'}), 404
        if str(info.get('role', '0')) == '0' and not npc_password_unlocked():
            return jsonify({'error': f'Unit {unit_id} not found'}), 404
        ri = info.get('rarity','1'); lid = ld['unit_id_map'].get(unit_id, ""); un = ld['unit_text_map'].get(lid, "Unknown") if lid else "Unknown"
        raw = unit_stat_map.get(unit_id, {}); fs = {}
        has_sp = int(ri) <= 4
        ssp_id = unit_ssp_config_map.get(unit_id); ssp_bonus = unit_ssp_stat_map.get(ssp_id, {})
        ssp_core = get_ssp_custom_core_bonuses_for_unit(unit_id) if has_sp else {'move': 0, 'terrain_upgrades': []}
        rm = unit_ssp_abil_replace_map.get(unit_id, {})
        if raw:
            for s in ['HP','EN','Attack','Defense','Mobility']:
                st = raw.get(s, (0,0,0)); st = (st[0], st[1], st[2]) if len(st) >= 3 else (st[0], st[1], st[1])
                fs[s] = calc_growth_unit(st[0], st[1], ri)
            mov = raw.get('Move', (0,0)); mov = (mov[0], mov[1]) if isinstance(mov, (list, tuple)) and len(mov) >= 2 else (mov if isinstance(mov, (int, float)) else 0, mov if isinstance(mov, (int, float)) else 0)
            fs['Move'] = mov[0] if isinstance(mov, (list, tuple)) else mov
        ua = unit_abil_map.get(unit_id, [])
        abilities = []
        for ab in sorted(ua, key=lambda x: x['sort']):
            bab = build_ability_entry(str(ab['id']), ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=ab['sort'], lang_code=lc)
            if str(ab['id']) in rm: bab['ssp_replacement'] = build_ability_entry(rm[str(ab['id'])], ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=ab['sort'], lang_code=lc)
            abilities.append(bab)
        ac = []
        for ab in sorted(ua, key=lambda x: x['sort']):
            bac = build_ability_entry(str(ab['id']), ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=ab['sort'], lang_code=CALC_LANG)
            if str(ab['id']) in rm: bac['ssp_replacement'] = build_ability_entry(rm[str(ab['id'])], ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=ab['sort'], lang_code=CALC_LANG)
            ac.append(bac)
        max_ab_sort = max((int(a.get('sort', 0) or 0) for a in ua), default=0)
        if has_sp:
            for idx, gain_aid in enumerate(unit_ssp_abil_gain_list.get(unit_id, [])):
                so = max_ab_sort + idx + 1
                bab = build_ability_entry(str(gain_aid), ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=so, lang_code=lc)
                bab['ssp_only'] = True
                abilities.append(bab)
                bac = build_ability_entry(str(gain_aid), ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=so, lang_code=CALC_LANG)
                bac['ssp_only'] = True
                ac.append(bac)
        spb = {s: 0 for s in UNIT_STAT_ORDER}
        spc = {s: 0 for s in UNIT_STAT_ORDER}
        sspb = {s: 0 for s in UNIT_STAT_ORDER}
        sspc = {s: 0 for s in UNIT_STAT_ORDER}
        nxs = {s: 0 for s in UNIT_STAT_ORDER}
        nxss = {s: 0 for s in UNIT_STAT_ORDER}
        spb_move_flat = [0]; spc_move_flat = [0]; sspb_move_flat = [0]; sspc_move_flat = [0]
        _WPN_KEYS = ('Accuracy', 'Critical', 'Power')
        wpn_spb = {k: 0 for k in _WPN_KEYS}
        wpn_spc = {k: 0 for k in _WPN_KEYS}
        wpn_sspb = {k: 0 for k in _WPN_KEYS}
        wpn_sspc = {k: 0 for k in _WPN_KEYS}
        wpn_nxs = {k: 0 for k in _WPN_KEYS}
        wpn_nxss = {k: 0 for k in _WPN_KEYS}

        def _ability_has_condition_word(ad):
            name = (ad.get('name') or '').lower()
            cond_words = ('condition', 'conditional', 'when countering', 'when counter', 'when attacking', 'when attacked', 'during battle', 'at the start of', 'each time', 'every time')
            if any(w in name for w in cond_words): return True
            for d2 in ad.get('details', []):
                txt = (d2.get('text', '') if isinstance(d2, dict) else str(d2)).lower()
                if any(w in txt for w in cond_words): return True
            return False

        def ep(ad, bd, cd, nd, bd_move_flat, cd_move_flat, wpn_bd, wpn_cd, wpn_nd):
            hc = any(cond for d2 in ad.get('details', []) for cond in d2.get('conditions', []))
            ie = ad.get('is_ex', False)
            ability_cond = _ability_has_condition_word(ad)
            inx = unit_id == '1400000550' and any(kw in (ad.get('name', '') or '').lower() for kw in ['newtype', 'x-rounder', '新人類', 'x rounder'])
            for d2 in ad.get('details', []):
                txt = d2.get('text', '') if isinstance(d2, dict) else str(d2)
                parts = [p.strip() for p in re.split(r'[.\n]+', txt) if p and p.strip()]
                if not parts: parts = [txt]
                cond_prefix = False
                for part in parts:
                    itc = _is_conditional_stat_text(part)
                    if itc and _unit_hp_threshold_active_at_assumed_full_hp(part):
                        itc = False
                    part_stats = _extract_stat_percent_unit(part, skip_conditional=False)
                    wpn_stats = _extract_weapon_stat_percent_unit(part, skip_conditional=False)
                    flat_move = _extract_stat_flat_move(part, skip_conditional=False)
                    if itc and not part_stats and not flat_move and not wpn_stats:
                        cond_prefix = True
                    is_cond = itc or cond_prefix
                    if flat_move:
                        if inx:
                            pass
                        elif hc or ie or is_cond:
                            cd_move_flat[0] += flat_move
                        else:
                            bd_move_flat[0] += flat_move
                    for s, pct in part_stats.items():
                        if s == 'Move': continue
                        if unit_id == '1400000550' and s == 'HP' and pct == 5:
                            bd[s] = bd.get(s, 0) + pct
                            continue
                        if inx:
                            nd[s] = max(nd.get(s, 0), pct)
                        elif hc or ie or is_cond:
                            cd[s] = cd.get(s, 0) + pct
                        else:
                            bd[s] = bd.get(s, 0) + pct
                    for wk, pct in wpn_stats.items():
                        if inx:
                            wpn_nd[wk] = max(wpn_nd.get(wk, 0), pct)
                        elif hc or ie or is_cond:
                            wpn_cd[wk] = wpn_cd.get(wk, 0) + pct
                        else:
                            wpn_bd[wk] = wpn_bd.get(wk, 0) + pct

        for ab in ac:
            if ab.get('ssp_only'):
                ep(ab, sspb, sspc, nxss, sspb_move_flat, sspc_move_flat, wpn_sspb, wpn_sspc, wpn_nxss)
                continue
            ep(ab, spb, spc, nxs, spb_move_flat, spc_move_flat, wpn_spb, wpn_spc, wpn_nxs)
            if 'ssp_replacement' in ab:
                ep(ab['ssp_replacement'], sspb, sspc, nxss, sspb_move_flat, sspc_move_flat, wpn_sspb, wpn_sspc, wpn_nxss)
            else:
                ep(ab, sspb, sspc, nxss, sspb_move_flat, sspc_move_flat, wpn_sspb, wpn_sspc, wpn_nxss)
        wpn_spc_pure = {k: wpn_spc.get(k, 0) for k in _WPN_KEYS}
        wpn_sspc_pure = {k: wpn_sspc.get(k, 0) for k in _WPN_KEYS}
        for k in _WPN_KEYS:
            wpn_spc[k] = wpn_spc.get(k, 0) + wpn_nxs.get(k, 0)
            wpn_sspc[k] = wpn_sspc.get(k, 0) + wpn_nxss.get(k, 0)
        weapon_passive_pct = {
            'sp': {k: wpn_spb.get(k, 0) + wpn_nxs.get(k, 0) for k in _WPN_KEYS},
            'ssp': {k: wpn_sspb.get(k, 0) + wpn_nxss.get(k, 0) for k in _WPN_KEYS},
            'sp_cond': {k: wpn_spc_pure.get(k, 0) for k in _WPN_KEYS},
            'ssp_cond': {k: wpn_sspc_pure.get(k, 0) for k in _WPN_KEYS},
        }
        for s in UNIT_STAT_ORDER:
            spc[s] = spc.get(s, 0) + nxs.get(s, 0)
            sspc[s] = sspc.get(s, 0) + nxss.get(s, 0)
        hcond = (any(spc.get(s, 0) > 0 for s in UNIT_STAT_ORDER) or
                 any(sspc.get(s, 0) > 0 for s in UNIT_STAT_ORDER) or
                 spc_move_flat[0] > 0 or sspc_move_flat[0] > 0)
        lb_data = []
        for mult in [1.0, 1.2, 1.3, 1.4]:
            cm = 1.0 if info.get('is_ultimate', False) else mult
            lb_fs, lb_fsp, lb_fssp = {}, {}, {}
            if raw:
                for s in ['HP','EN','Attack','Defense','Mobility']:
                    st = raw.get(s, (0,0,0)); st = (st[0], st[1], st[2]) if len(st) >= 3 else (st[0], st[1], st[1])
                    gs = calc_growth_unit_base(st[0], st[1], ri); gsp = st[2]
                    sb2v, sm2v = ssp_bonus.get(s, (0,0)); sb2v = sb2v if isinstance(sb2v, (int, float)) else 0; sm2v = sm2v if isinstance(sm2v, (int, float)) else sb2v
                    scb = math.floor(sb2v + (sm2v - sb2v) * 0.5) if has_sp and ssp_bonus else 0
                    lb_fs[s] = math.floor(gs * cm); lb_fsp[s] = math.floor(gsp * cm); lb_fssp[s] = math.floor((gsp + scb) * cm)
                mov = raw.get('Move', (0,0)); mov = (mov[0], mov[1]) if isinstance(mov, (list, tuple)) and len(mov) >= 2 else (mov if isinstance(mov, (int, float)) else 0, mov if isinstance(mov, (int, float)) else 0)
                lb_fs['Move'] = mov[0] if isinstance(mov, (list, tuple)) else mov
                lb_fsp['Move'] = mov[1] if isinstance(mov, (list, tuple)) else mov[0]
                lb_fssp['Move'] = lb_fsp['Move'] + (ssp_core.get('move', 0) if has_sp else 0)
            else:
                lb_fs = {s: math.floor(fs.get(s,0) * cm / 1.4) for s in UNIT_STAT_ORDER}
                lb_fsp = dict(lb_fs)
                lb_fssp = dict(lb_fs)
            snc, swc, spnc, spwc, sspnc, sspwc = [], [], [], [], [], []
            for s in UNIT_STAT_ORDER:
                if s == 'Move':
                    mbase = int(lb_fsp.get('Move', 0) or 0)
                    mssp = int(lb_fssp.get('Move', 0) or 0)
                    mbon = max(0, mssp - mbase)
                    bf = spb_move_flat[0]; cf = spc_move_flat[0]; sbf = sspb_move_flat[0]; scf = sspc_move_flat[0]
                    snc.append({'name': s, 'total': lb_fs.get(s, 0) + bf, 'bonus': bf})
                    swc.append({'name': s, 'total': lb_fs.get(s, 0) + bf + cf, 'bonus': bf + cf})
                    spnc.append({'name': s, 'total': mbase + bf, 'bonus': bf})
                    spwc.append({'name': s, 'total': mbase + bf + cf, 'bonus': bf + cf})
                    sspnc.append({'name': s, 'total': mssp + sbf, 'bonus': mbon + sbf})
                    sspwc.append({'name': s, 'total': mssp + sbf + scf, 'bonus': mbon + sbf + scf})
                    continue
                bst = lb_fs.get(s, 0); spst = lb_fsp.get(s, 0); sspst = lb_fssp.get(s, 0)
                bb = math.floor(bst * spb.get(s, 0) / 100) if bst else 0
                cb = math.floor(bst * (spb.get(s, 0) + spc.get(s, 0)) / 100) if bst else 0
                snc.append({'name': s, 'total': bst + bb, 'bonus': bb})
                swc.append({'name': s, 'total': bst + cb, 'bonus': cb})
                spbb = math.floor(spst * spb.get(s, 0) / 100) if spst else 0
                spcb = math.floor(spst * (spb.get(s, 0) + spc.get(s, 0)) / 100) if spst else 0
                spnc.append({'name': s, 'total': spst + spbb, 'bonus': spbb})
                spwc.append({'name': s, 'total': spst + spcb, 'bonus': spcb})
                sspbb = math.floor(sspst * sspb.get(s, 0) / 100) if sspst else 0
                sspcb = math.floor(sspst * (sspb.get(s, 0) + sspc.get(s, 0)) / 100) if sspst else 0
                sspnc.append({'name': s, 'total': sspst + sspbb, 'bonus': sspbb})
                sspwc.append({'name': s, 'total': sspst + sspcb, 'bonus': sspcb})
            lb_data.append({'stats_no_cond': snc, 'stats_with_cond': swc, 'sp_stats_no_cond': spnc, 'sp_stats_with_cond': spwc, 'ssp_stats_no_cond': sspnc, 'ssp_stats_with_cond': sspwc})
        stats = lb_data[3]['stats_no_cond'] if lb_data else [{'name': s, 'total': fs.get(s, 0), 'bonus': 0} for s in UNIT_STAT_ORDER]
        portrait = find_portrait(info.get('resource_ids', []), unit_id, 'images/unit_portraits', f'unit_{unit_id}')
        thum = find_list_thumb(info.get('resource_ids', []), unit_id, 'images/unit_portraits')
        ubr = info.get('bromide_resource_id', '') or (info.get('resource_ids', [''])[0] if info.get('resource_ids') else '')
        td = unit_ter_map.get(info.get('terrain_set',''), {}); terrain = []
        terrain_levels = {tn: _terrain_tier_norm(td.get(tn, 1)) for tn in ['Space','Atmospheric','Ground','Sea','Underwater']}
        for tn in ['Space','Atmospheric','Ground','Sea','Underwater']:
            lv = terrain_levels.get(tn, 1)
            terrain.append({'name': tn, 'symbol': TERRAIN_SYMBOLS.get(str(lv), TERRAIN_SYMBOLS['1']), 'level': lv, 'type_icon': f"/static/images/Terrain/{TERRAIN_TYPE_ICON_MAP.get(tn,'')}" if TERRAIN_TYPE_ICON_MAP.get(tn) else '', 'level_icon': f"/static/images/Terrain/{TERRAIN_LEVEL_ICON_MAP.get(lv, TERRAIN_LEVEL_ICON_MAP[1])}"})
        terr_ssp_levels = dict(terrain_levels)
        ssp_enhanced_terrains = set()
        if has_sp and ssp_core.get('terrain_upgrades'):
            for tn, fr, to in ssp_core['terrain_upgrades']:
                ssp_enhanced_terrains.add(tn)
                cur = int(terr_ssp_levels.get(tn, 0) or 0)
                terr_ssp_levels[tn] = to if cur == fr else max(cur, to)
        def _ssp_level_icon(tn):
            lv = terr_ssp_levels.get(tn, 1)
            # Use the actual adapted level (e.g. △ after SSP dash→triangle). Do not force ● for lv>=2.
            return f"/static/images/Terrain/{TERRAIN_LEVEL_ICON_MAP.get(lv, TERRAIN_LEVEL_ICON_MAP[1])}"
        terr_ssp = [{'name': tn, 'symbol': TERRAIN_SYMBOLS.get(str(terr_ssp_levels.get(tn,1)), TERRAIN_SYMBOLS['1']), 'level': terr_ssp_levels.get(tn,1), 'type_icon': f"/static/images/Terrain/{TERRAIN_TYPE_ICON_MAP.get(tn,'')}" if TERRAIN_TYPE_ICON_MAP.get(tn) else '', 'level_icon': _ssp_level_icon(tn), 'ssp_enhanced': tn in ssp_enhanced_terrains} for tn in ['Space','Atmospheric','Ground','Sea','Underwater']]
        weapons = []
        for wp in unit_weapon_map.get(unit_id, []):
            wid = wp['id']; wm = weapon_info_map.get(wid, {}); wn = ld['weapon_text_map'].get(wm.get('name_lang_id','0'), 'Unknown')
            ai = wm.get('attribute','0'); wt = wm.get('weapon_type','1'); ainfo = WEAPON_ATTR_MAP.get(ai, {'label':'Unknown','icon':''})
            at = ATTACK_ATTR_TYPES.get(wm.get('attack_attribute','0'), [])
            ws = resolve_weapon_stats(wm, weapon_status_map, weapon_correction_map, ld['weapon_trait_map'], ld['weapon_capability_map'], growth_pattern_map, weapon_trait_change_map, ld['weapon_trait_detail_map'], wid, lang_code=lc, unit_id=unit_id)
            ic = resolve_weapon_icon(wt, ai, ubr)
            if unit_id == '1330005900' and wt == '3': ic = {'icon': '/static/images/UI/UI_Battle_MapUI_MapWeapon_Icon_Blue.png', 'overlay': '', 'is_ex': False, 'is_map': True}; at = [{'label': 'MP', 'icon': '/static/images/UI/Sprite/UI_Common_Icon_MapWeapon_Mp.png', 'is_supply': True}]
            levels = ws.get('levels', [{'level':i,'power':ws['power'],'en':ws['en'],'accuracy':ws['accuracy'],'critical':ws['critical'],'ammo':ws.get('ammo',0),'traits':ws.get('traits',[])} for i in range(1,6)])
            pw, en, acc, crit = ws['power'], ws['en'], ws['accuracy'], ws['critical']
            am = ws['ammo'] if wt == '3' else 0
            trl = ws.get('traits', [])
            ssp_power, ssp_ammo, ssp_range = 0, 0, 0
            mwid = wm.get('main_weapon_id', '0')
            for cid in [wid, mwid]:
                if cid and cid != '0' and cid in unit_ssp_weapon_enhance_map:
                    for enh in unit_ssp_weapon_enhance_map[cid]:
                        if enh['type'] == '1': ssp_power += enh['value']
                        elif enh['type'] == '3': ssp_ammo += enh['value']
                        elif enh['type'] == '4': ssp_range += enh['value']
                    break
            if wt != '3':
                ssp_ammo = 0
            sat = []
            ccl = "[Custom Core Effect] " if lc == 'EN' else "[Custom Core效果] "
            for cid in [wid, mwid]:
                if cid and cid != '0' and cid in unit_ssp_weapon_effect_map:
                    for tid in unit_ssp_weapon_effect_map[cid]:
                        tt2 = ld.get('weapon_trait_detail_map', {}).get(tid, '')
                        if tt2:
                            ft = ccl + tt2
                            if ft not in sat: sat.append(ft)
                    break
            lv5t = trl
            ip = any('preemptive strike' in (tr or '').lower() or '先制' in (tr or '') for tr in lv5t + sat)
            icc = eval_icon_color(lv5t, wt); sicc = eval_icon_color(lv5t + sat, wt)
            isw = wid.endswith('90') or wid.endswith('80')
            siu = ''
            if isw:
                tf = find_trait_icon(ubr) if ubr else None
                siu = f"/static/images/Trait/{tf}" if tf else (portrait or '')
            weapons.append({'id': wid, 'name': wn, 'attribute': ainfo['label'], 'attribute_id': ai, 'weapon_type': wt, 'attack_types': at, 'levels': levels, 'power': pw, 'min_range': ws['range_min'], 'max_range': ws['range_max'], 'en_cost': en, 'accuracy': acc, 'critical': crit, 'ammo': am, 'traits': trl, 'usage_restrictions': ws['usage_restrictions'], 'sort': wp['sort'], 'icon': ic['icon'], 'overlay': ic['overlay'], 'is_ex': ic['is_ex'], 'is_map': ic['is_map'], 'icon_color': icc, 'ssp_icon_color': sicc, 'map_coords': ws.get('map_coords', []), 'shooting_coords': ws.get('shooting_coords', []), 'is_dash': ws.get('is_dash', False), 'is_ssp_weapon': isw, 'ssp_icon': siu, 'ssp_power_bonus': ssp_power, 'ssp_ammo_bonus': ssp_ammo, 'ssp_range_bonus': ssp_range, 'ssp_traits': sat, 'is_preemptive': ip})
        weapons.sort(key=lambda w: (0 if w['weapon_type']=='3' else 1, w['sort']))
        sicons = []
        if info.get('is_ultimate', False): sicons.append(ULT_ICON)
        acq = info.get('acquisition_route','0'); ai2 = ACQUISITION_ROUTE_ICONS.get(acq, '')
        if ai2: sicons.append(ai2)
        msid = str(info.get('mechanism_set_id', '0')); ml = MECH_MAP_TABLE.get(msid, [])
        il = '2x2' in ml
        if not il:
            ut = unit_lin_map.get(unit_id, [])
            for tag_id in ut:
                if tag_id == '1067' or (isinstance(tag_id, str) and tag_id.endswith('1067')): il = True; break
        mids = list(MECH_MAP_TABLE.get(msid, []))
        if unit_id.startswith('17090') or unit_id.startswith('17050') or unit_id.startswith('17250'):
            if '3' not in mids: mids.append('3')
        mechs = []
        if il or '2x2' in mids:
            mechs.append({'name': '2x2', 'description': 'Deployed onto the battlefield at size 2x2.' if lc == 'EN' else '以2x2的尺寸在戰場上出擊。', 'icon': '/static/images/mechanism/mechanism_0002.png'})
        rec_cid = normalize_id(info.get('recommend_character_id') or '0')
        if rec_cid == '0':
            rec_cid = MANUAL_UNIT_RECOMMEND_CHARACTER_MAP.get(unit_id, '0')
        recommend_character = None
        if rec_cid != '0' and rec_cid in char_info_map:
            cinfo = char_info_map[rec_cid]
            if not entity_hidden_by_lr_schedule_lock(cinfo.get('schedule_id', '0')):
                cri = cinfo.get('rarity', '1')
                crrole = cinfo.get('role', '0')
                clid = ld.get('char_id_map', {}).get(rec_cid, '')
                cname = ld.get('char_text_map', {}).get(clid, '') if clid else ''
                if not cname:
                    cname = f'Unknown ({rec_cid})'
                cthum = find_list_thumb(cinfo.get('resource_ids', []), rec_cid, 'images/portraits')
                recommend_character = {'id': rec_cid, 'name': cname, 'rarity': RARITY_MAP.get(cri, 'N'), 'rarity_icon': RARITY_ICON_MAP.get(cri, ''), 'role': ROLE_MAP.get(crrole, 'NPC'), 'role_icon': ROLE_ICON_MAP.get(crrole, ''), 'thum': cthum or ''}
        mm = ld.get('mechanism_map', {})
        for mid in mids:
            if mid == '2x2': continue
            for rmm in mm.get(mid, []):
                if rmm.get('id') == mid:
                    icf = find_mechanism_icon(rmm.get('resource_id', ''))
                    mechs.append({'name': rmm.get('name', 'Unknown'), 'description': rmm.get('description', ''), 'icon': f"/static/images/mechanism/{icf}" if icf else ''})
                    break
        has_terrain_enh = bool(has_sp and ssp_core.get('terrain_upgrades'))
        result = {'id': unit_id, 'name': un, 'rarity': RARITY_MAP.get(ri,"Unknown"), 'rarity_id': ri, 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'role': ROLE_MAP.get(info.get('role','0'),"Unknown"), 'role_id': info.get('role','0'), 'role_icon': ROLE_ICON_MAP.get(info.get('role','0'),''), 'model': info.get('model',''), 'stats': stats, 'lb_data': lb_data, 'terrain': terrain, 'terrain_ssp': terr_ssp, 'has_terrain_enhancement': has_terrain_enh, 'tags': resolve_tags(unit_lin_map, unit_id, lc, 'unit'), 'series': resolve_series(unit_ser_map.get(unit_id,''), lc), 'abilities': abilities, 'mechanisms': mechs, 'weapons': weapons, 'weapon_passive_pct': weapon_passive_pct, 'portrait': portrait, 'thum': thum or '', 'lang': lc, 'is_ultimate': info.get('is_ultimate', False), 'acquisition_route': acq, 'acquisition_icon': ai2 or ACQUISITION_ROUTE_ICONS.get(acq, ''), 'special_icons': sicons, 'has_sp': has_sp, 'has_cond_stats': hcond, 'is_large': il, 'recommend_character': recommend_character, 'is_limited_time': unit_id in LIMITED_TIME_UNIT_IDS}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

@app.route('/<path:path>')
def serve_spa(path):
    """Serve index.html for any non-API path (SPA-style routing)."""
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    return _serve_index()

if __name__ == '__main__':
    for d in ["static/images/portraits","static/images/unit_portraits","static/images/Trait","static/images/Trait/thum","static/images/Terrain","static/images/WeaponIcon","static/images/UI","static/images/Logo-Series","static/images/Background","static/images/Rarity"]:
        os.makedirs(d, exist_ok=True)
    # Use another port when :5000 is already serving a different app/database preview.
    # PowerShell: $env:FLASK_PORT=5001; python app.py
    _run_port = int(os.environ.get('FLASK_PORT', os.environ.get('PORT', '5000')))
    print(f'Open in browser: http://127.0.0.1:{_run_port}')
    app.run(debug=True, port=_run_port)