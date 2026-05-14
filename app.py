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
from werkzeug.exceptions import NotFound
import json
import re
import math
import unicodedata
import hashlib
import sys
from urllib.parse import quote
import secrets
import time
from datetime import datetime, timezone, timedelta
try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None  # pragma: no cover

app = Flask(__name__)

# Bust cache when static/js/app.js changes (content-addressed tag from mtime+size).
# IMPORTANT: compute at HTML render time, not only at process import — otherwise Flask
# keeps serving the same ?v= after app.js edits until the server restarts, and browsers
# keep an old cached bundle (users never see DC / weapon UI fixes).
def _app_js_bundle_version_tag():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'js', 'app.js')
    try:
        st = os.stat(p)
        return hashlib.sha256(f'{st.st_mtime_ns}:{st.st_size}'.encode()).hexdigest()[:16]
    except OSError:
        return '0'

# Optional: set INDEX_HTML_CACHE_CONTROL e.g. "public, max-age=120" in production so repeat visits skip re-downloading HTML shell.
INDEX_HTML_CACHE_CONTROL = (os.environ.get('INDEX_HTML_CACHE_CONTROL') or '').strip()

# Sessions (Latest Release password gate). Set FLASK_SECRET_KEY in production.
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'ggen-dev-secret-change-in-production')
if os.environ.get('FLASK_SESSION_SECURE', '').lower() in ('1', 'true', 'yes'):
    app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Long-lived browser cache for game images (WebP, etc.). Set STATIC_CACHE_MAX_AGE=0 to disable during asset work.
_STATIC_CACHEABLE_EXT = frozenset(
    ('.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff2', '.woff', '.ttf', '.eot', '.js')
)
_STATIC_CACHE_MAX_AGE = int(os.environ.get('STATIC_CACHE_MAX_AGE', '31536000') or '0')


@app.after_request
def _apply_static_cache_headers(response):
    if _STATIC_CACHE_MAX_AGE <= 0:
        return response
    try:
        path = request.path or ''
    except RuntimeError:
        return response
    if not path.startswith('/static/'):
        return response
    ext = os.path.splitext(path)[1].lower()
    if ext not in _STATIC_CACHEABLE_EXT:
        return response
    response.headers.setdefault('Cache-Control', f'public, max-age={_STATIC_CACHE_MAX_AGE}')
    return response

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
# Eternal Road: ETERNAL_STAGE_LOCK_UNTIL_MS locks specific stage IDs until a UTC date (YYYY-MM-DD) or epoch ms. See _parse_eternal_stage_lock_until_map().
# ETERNAL_STAGE_LOCK_RESPECT_LR_UNLOCK=1 (default): Latest Release session unlock also bypasses schedule/env locks (early access for testers).
_eslr = (os.environ.get('ETERNAL_STAGE_LOCK_RESPECT_LR_UNLOCK') or '1').strip().lower()
ETERNAL_STAGE_LOCK_RESPECT_LR_UNLOCK = _eslr not in ('0', 'false', 'no', 'off')
# Eternal Road: schedule lock uses m_stage.json ScheduleId → m_schedule.json StartDatetime (epoch ms; same master values as Latest Release / JST display).
# Before that start time, the stage is gated. Set ETERNAL_STAGE_PASSWORD so users can unlock early for the session after entering the password.
ETERNAL_STAGE_PASSWORD = (os.environ.get('ETERNAL_STAGE_PASSWORD') or '').strip()
# NPC visibility lock (separate from Latest Release): set NPC_VIEW_PASSWORD to require unlock before NPC rows/details are shown.
NPC_VIEW_PASSWORD = (os.environ.get('NPC_VIEW_PASSWORD') or '').strip()
# JP mode lock (separate): set JP_MODE_PASSWORD to require unlock before using JP/JA language mode.
JP_MODE_PASSWORD = (os.environ.get('JP_MODE_PASSWORD') or '').strip()

# ═══════════════════════════════════════════════════════
# IMAGE CDN CONFIGURATION & FILE INDEX
# ═══════════════════════════════════════════════════════

IMAGE_CDN = os.environ.get('IMAGE_CDN', '').rstrip('/')


def _env_flag(val, default=False):
    if val is None or str(val).strip() == '':
        return default
    return str(val).strip().lower() in ('1', 'true', 'yes', 'on')


# When True (and IMAGE_CDN is set), API JSON rewrites /static/images/* to the CDN.
# If IMAGE_CDN is set but GAME_IMAGES_USE_CDN is unset, default True so deploys (e.g. Railway) offload
# thumbnails/portraits to the CDN instead of hammering the app server. Set GAME_IMAGES_USE_CDN=0 to force
# same-origin /static/images (e.g. local edits without a CDN mirror).
_gicdn_env = os.environ.get('GAME_IMAGES_USE_CDN')
if _gicdn_env is None or str(_gicdn_env).strip() == '':
    GAME_IMAGES_USE_CDN = bool(IMAGE_CDN)
else:
    GAME_IMAGES_USE_CDN = bool(IMAGE_CDN) and _env_flag(_gicdn_env, default=False)


def convert_image_urls(obj):
    """Recursively replace /static/images/ paths with CDN URLs when GAME_IMAGES_USE_CDN is enabled."""
    if not IMAGE_CDN or not GAME_IMAGES_USE_CDN:
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


def game_image_public_url(path):
    """Resolve /static/images/* to an absolute CDN URL when IMAGE_CDN and GAME_IMAGES_USE_CDN are set."""
    if not path or not isinstance(path, str):
        return path
    if not path.startswith('/static/images/'):
        return path
    if IMAGE_CDN and GAME_IMAGES_USE_CDN:
        return IMAGE_CDN.rstrip('/') + '/images/' + path[len('/static/images/'):]
    return path

# Load the image map
IMAGE_INDEX_PATH = os.path.join(os.path.dirname(__file__), 'image_index.json')
IMAGE_INDEX = {}
if os.path.exists(IMAGE_INDEX_PATH):
    with open(IMAGE_INDEX_PATH, 'r') as f:
        IMAGE_INDEX = json.load(f)
    print(f"Loaded image index with {len(IMAGE_INDEX)} folders")
else:
    print("⚠ Warning: image_index.json not found")

if IMAGE_CDN and not GAME_IMAGES_USE_CDN:
    print("  Image URLs: /static/images/* served from this app (GAME_IMAGES_USE_CDN=0). Remove it or set to 1 to use IMAGE_CDN for game assets.")

STATIC_ROOT = os.path.join(os.path.dirname(__file__), 'static')
# (mtime, merged filenames) per folder under static/images/* — invalidated when that folder changes
_MERGED_IMAGE_FOLDER_CACHE = {}


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


def _merged_index_disk(folder_key):
    """Union of image_index.json filenames and actual files under static/<folder_key> (WebP uploads, etc.)."""
    indexed = IMAGE_INDEX.get(folder_key, []) or []
    d = os.path.join(STATIC_ROOT, *folder_key.split('/'))
    try:
        mtime = os.path.getmtime(d)
    except OSError:
        mtime = 0
    cached = _MERGED_IMAGE_FOLDER_CACHE.get(folder_key)
    if cached and cached[0] == mtime:
        return cached[1]
    disk = _list_disk_image_files(folder_key)
    seen = set()
    merged = []
    for fn in indexed + disk:
        if fn not in seen:
            seen.add(fn)
            merged.append(fn)
    _MERGED_IMAGE_FOLDER_CACHE[folder_key] = (mtime, merged)
    return merged


def _merged_portrait_files(portrait_folder_key):
    """Character and unit portraits: index + on-disk files (so .webp on disk works when index still lists .png)."""
    if portrait_folder_key not in ('images/portraits', 'images/unit_portraits'):
        return IMAGE_INDEX.get(portrait_folder_key, []) or []
    return _merged_index_disk(portrait_folder_key)


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
        'restriction_recover_hp': 'Recovers {}% HP when used.',
        'restriction_recover_en': 'Recovers {}% EN when used.',
        'restriction_recover_mp': 'Recovers {} MP when used.',
        'stage_recommended_cp': 'Recommended CP: {}', 'stage_no_prefix': 'No. {}', 'sortie_group': 'Sortie Group {}',
        'restriction_applies_unit': 'Applies to Units', 'restriction_applies_both': 'Applies to Units & Characters',
        'restriction_applies_characters': 'Applies to Characters',
        'terrain_space': 'Space', 'terrain_atmospheric': 'Atmospheric', 'terrain_ground': 'Ground', 'terrain_amphibious': 'Amphibious', 'terrain_unknown': 'Unknown',
        'victory_conditions': 'Victory Conditions', 'defeat_conditions': 'Defeat Conditions', 'none': 'None',
        'difficulty_normal': 'Normal', 'difficulty_hard': 'Hard', 'difficulty_expert': 'Expert',
    },
    'TW': {
        'restriction_before_moving': '僅限移動前使用。',
        'restriction_tension_max': '鬥志Max以上時可使用。',
        'restriction_mp': '消耗{}MP時可使用。',
        'restriction_hp': '消耗{}%HP時可使用。',
        'restriction_recover_hp': '使用時恢復{}%HP。',
        'restriction_recover_en': '使用時恢復{}%EN。',
        'restriction_recover_mp': '使用時恢復{}MP。',
        'stage_recommended_cp': '推薦戰力：{}', 'stage_no_prefix': 'No. {}', 'sortie_group': '出擊群組 {}',
        'restriction_applies_unit': '僅適用於機體', 'restriction_applies_both': '適用於機體與角色',
        'restriction_applies_characters': '適用於角色',
        'terrain_space': '宇宙', 'terrain_atmospheric': '空中', 'terrain_ground': '地上', 'terrain_amphibious': '水陸', 'terrain_unknown': '未知',
        'victory_conditions': '勝利條件', 'defeat_conditions': '敗北條件', 'none': '無',
        'difficulty_normal': '普通', 'difficulty_hard': '困難', 'difficulty_expert': '專家',
    },
    'JA': {
        'restriction_before_moving': '移動前のみ使用可能。',
        'restriction_tension_max': 'テンションMax以上で使用可能。',
        'restriction_mp': '{}MP消費時に使用可能。',
        'restriction_hp': '{}%HP消費時に使用可能。',
        'restriction_recover_hp': '使用時、HPを{}%回復する。',
        'restriction_recover_en': '使用時、ENを{}%回復する。',
        'restriction_recover_mp': '使用時、{}MP回復する。',
        'stage_recommended_cp': '推奨戦力: {}', 'stage_no_prefix': 'No. {}', 'sortie_group': '出撃グループ {}',
        'restriction_applies_unit': '機体に適用', 'restriction_applies_both': '機体とキャラに適用',
        'restriction_applies_characters': 'キャラクターに適用',
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
# Indices align with StageTerrainTypeIndex in m_stage / m_help five terrain types (EN: Space, Atmospheric, Land, Sea, Underwater).
STAGE_TERRAIN_MAP = {
    '1': {'EN': 'Space', 'TW': '宇宙', 'JA': '宇宙'},
    '2': {'EN': 'Atmospheric', 'TW': '空中', 'JA': '空中'},
    '3': {'EN': 'Ground', 'TW': '地上', 'JA': '地上'},
    '4': {'EN': 'Sea', 'TW': '水面', 'JA': '水上'},
    '5': {'EN': 'Amphibious', 'TW': '水陸', 'JA': '水陸'},
}
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

def _jst_year_from_epoch_ms(ms):
    """Calendar year in Asia/Tokyo for epoch milliseconds (banner schedule semantics)."""
    if ms is None or ms <= 0:
        return None
    try:
        if ZoneInfo is not None:
            dt = datetime.fromtimestamp(ms / 1000.0, tz=timezone.utc).astimezone(ZoneInfo('Asia/Tokyo'))
        else:
            dt = datetime.utcfromtimestamp(ms / 1000.0) + timedelta(hours=9)
        return int(dt.year)
    except Exception:
        return None

def normalize_id(value, default='0', debug_context=None):
    if value is None or value == '' or value == 'None': return default
    try:
        if isinstance(value, (int, float)): return str(int(value))
        elif isinstance(value, str):
            value = value.strip()
            if value == '' or value.lower() == 'none': return default
            # Digit-only strings: parse with int() so language IDs > 2^53 stay exact (float() rounds).
            if value.isdigit():
                return str(int(value))
            if value.startswith('-') and value[1:].isdigit():
                return str(int(value))
            try: return str(int(float(value)))
            except ValueError: return value
        return str(value)
    except (ValueError, TypeError): return default


def _parse_eternal_stage_lock_until_map():
    """Parse ETERNAL_STAGE_LOCK_UNTIL_MS: comma/newline-separated stageId=value. Value = epoch ms (digits) or YYYY-MM-DD (UTC 00:00:00)."""
    raw = (os.environ.get('ETERNAL_STAGE_LOCK_UNTIL_MS') or '').strip()
    out = {}
    if not raw:
        return out
    for part in re.split(r'[\s,;]+', raw):
        part = part.strip()
        if not part or '=' not in part:
            continue
        a, b = part.split('=', 1)
        sid = normalize_id(a.strip())
        b = b.strip()
        if not sid or sid == '0':
            continue
        if b.isdigit():
            out[sid] = int(b)
            continue
        try:
            dpart = b[:10]
            dt = datetime.strptime(dpart, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            out[sid] = int(dt.timestamp() * 1000)
        except (ValueError, TypeError):
            pass
    return out


ETERNAL_STAGE_LOCK_UNTIL_MS_MAP = _parse_eternal_stage_lock_until_map()

# ═══════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════

RARITY_MAP = {'1': 'N', '2': 'R', '3': 'SR', '4': 'SSR', '5': 'UR'}
RARITY_SORT = {'5': 0, '4': 1, '3': 2, '2': 3, '1': 4}
RARITY_LETTERS = frozenset(RARITY_MAP.values())
# ULT rarity filter alone (no star-tier checkboxes): same idea as Limited alone — restrict to top rarities (SSR + UR).
ULT_FILTER_DEFAULT_STAR_LETTERS = frozenset({'SSR', 'UR'})

# m_series Id=10 / ResourceId series_0010 — original "Mobile Suit Gundam" (1979). Used to add search alias `msg`
# so series:msg targets this series only, not every title containing "Gundam".
SERIES_ID_MOBILE_SUIT_GUNDAM = '10'
# m_series Id=130 — "Mobile Suit Gundam: The 08th MS Team". Display text uses "08th" so plain "08 ms" never
# substring-matches; add shorthand aliases for search (same idea as msg).
SERIES_ID_08TH_MS_TEAM = '130'
# m_series Id=2300 — "After War Gundam X" (SeriesSetId …02300). series:dx / series:12300 resolve here (all locales).
SERIES_ID_AFTER_WAR_GUNDAM_X = '2300'
# Appended to unit list search text (all q_scope values, including name_id) for names that lack English
# substring tokens (e.g. "god" → Burning Gundam).
UNIT_SEARCH_HAYSTACK_EXTRA_BY_ID = {
    '1200003900': ' god',
    '1200003950': ' god',
}

# A search box query that is only the token "dx" (DX ≡ Double X) returns exactly these roster rows; locale-agnostic.
DOUBLE_X_DX_TOKEN_UNIT_IDS = frozenset({'1230003800', '1230003850', '1230005300'})
# Query "00" only: these unit rows only (by id), not every title in m_series 3700 — keeps browse aligned with name/id intent.
UNIT_SEARCH_SHORTHAND_00_UNIT_IDS = frozenset({'1370006200', '1370005700', '1370005900', '1370005950'})

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
    tuple (letters, need_limited, need_ultimate, exclude_limited) = star tiers + LT / ULT / NLT.
    Unit lists: ULT always OR's in every SSR/UR is_ultimate row. Star tiers use LT / non-LT rules on non-ultimate rows
    only (see _unit_row_matches_rarity_tuple). LT+ULT with no stars = all limited OR SSR/UR ultimates."""
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
    exclude_limited = 'NLT' in parts
    if has_lt and exclude_limited:
        return set()
    letters = {p for p in parts if p in RARITY_LETTERS}
    if any(p not in RARITY_LETTERS and p not in ('LT', 'ULT', 'NLT') for p in parts):
        return set()
    if has_lt and has_ult and letters == RARITY_LETTERS:
        return None
    if letters == RARITY_LETTERS and not has_lt and not has_ult and not exclude_limited:
        return None
    if not letters and not has_lt and not has_ult and not exclude_limited:
        return set()
    return (frozenset(letters), has_lt, has_ult, exclude_limited)


def _unit_row_matches_rarity_tuple(letters_f, need_lt, need_ult, exclude_limited, letter, is_limited, is_ultimate):
    """Unit list: if ULT is on, every SSR/UR ultimate row matches regardless of star checkboxes.
    Remaining rows: per selected tier L — no LT = L and not ultimate and not limited; +LT = L and not ultimate.
    LT+ULT with no star checkboxes = all limited OR SSR/UR ultimates (ult branch already handled first for those)."""
    if exclude_limited and is_limited:
        return False
    letters = set(letters_f)

    if need_ult and is_ultimate and letter in ULT_FILTER_DEFAULT_STAR_LETTERS:
        return True

    if need_lt and not letters and not need_ult:
        return is_limited

    if need_lt and not letters and need_ult:
        if is_limited:
            return True
        return False

    if need_ult and not letters:
        return False

    if not letters:
        return False

    for L in letters:
        if need_lt:
            ok = letter == L and not is_ultimate
        else:
            ok = letter == L and not is_ultimate and not is_limited
        if ok:
            return True
    return False


def row_matches_rarity_filter(rf, letter, is_limited, is_ultimate=False):
    """Apply parse_list_rarity_filter result. Characters, units, and supporters share MS-list LT/UR/NLT semantics; pass is_ultimate only for units (False for char/supp)."""
    if rf is None:
        return True
    if rf == set():
        return False
    if isinstance(rf, tuple):
        letters, need_lt, need_ult = rf[0], rf[1], rf[2]
        exclude_limited = rf[3] if len(rf) > 3 else False
        return _unit_row_matches_rarity_tuple(
            letters, need_lt, need_ult, exclude_limited, letter, is_limited, is_ultimate,
        )
    return letter in rf


def rarity_filter_cache_fragment(rf):
    if rf is None:
        return 'all'
    if not rf:
        return 'none'
    if isinstance(rf, tuple):
        letters, need_lt, need_ult = rf[0], rf[1], rf[2]
        exclude_limited = rf[3] if len(rf) > 3 else False
        core = ','.join(sorted(letters)) if letters else '*'
        frag = core
        if need_lt:
            frag += '_lt'
        if need_ult:
            frag += '_ult'
        if exclude_limited:
            frag += '_nlt'
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


def normalize_filter_combine_op(raw, default):
    """browse filter combine mode: 'and' | 'or'. Invalid / missing uses default."""
    s = (raw or '').strip().lower()
    if s == 'or':
        return 'or'
    if s == 'and':
        return 'and'
    d = (default or 'and').strip().lower()
    return d if d in ('and', 'or') else 'and'


def browse_combo_from_character_args(args):
    if not isinstance(args, dict):
        args = {}
    return {
        'lineage_combine': normalize_filter_combine_op(args.get('lineage_op'), 'and'),
        'series_combine': normalize_filter_combine_op(args.get('series_op'), 'or'),
        'skill_combine': normalize_filter_combine_op(args.get('skill_op'), 'and'),
        'trait_combine': normalize_filter_combine_op(args.get('ability_op'), 'and'),
    }


def browse_combo_from_unit_args(args):
    if not isinstance(args, dict):
        args = {}
    return {
        'lineage_combine': normalize_filter_combine_op(args.get('lineage_op'), 'and'),
        'series_combine': normalize_filter_combine_op(args.get('series_op'), 'or'),
        'ability_combine': normalize_filter_combine_op(args.get('ability_op'), 'and'),
        'terrain_combine': normalize_filter_combine_op(args.get('terrain_op'), 'and'),
        'weapon_debuff_combine': normalize_filter_combine_op(args.get('weapon_debuff_op'), 'and'),
        'weapon_range_combine': normalize_filter_combine_op(args.get('weapon_range_op'), 'and'),
    }


def parse_list_lineage_filter(val):
    """Optional lineage/tag id(s); None = no filter. Multiple ids matched per lineage_op (UI: AND/OR). Keep string vs frozenset."""
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
    """Ability filter expression (also used for character skill_id — same pipe/comma rules as the browse UI).

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
    "Space:3,Underwater:2". Levels 1 (hyphen), 2 (triangle), and 3 (circle) are accepted.
    A trailing + on the level means "this tier or higher", e.g. "Ground:2+" excludes
    hyphen-only (tier 1) on that terrain.
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
        lv_part = str(lv_raw or '').strip()
        ge = lv_part.endswith('+')
        if ge:
            lv_part = lv_part[:-1].strip()
        lv = str(normalize_id(lv_part, '0')).strip()
        if name not in allowed_names:
            continue
        if lv not in ('1', '2', '3'):
            continue
        k = (name, int(lv), ge)
        if k not in seen:
            seen.add(k)
            out.append(k)
    if not out:
        return None
    return tuple(out)


def parse_list_series_filter(val):
    """Optional series filter; None = no filter; frozenset = OR (entity matches any selected id).
    Comma- or semicolon-separated ids in the query string; single id unchanged for callers."""
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    seen = []
    seen_set = set()
    for token in [p.strip() for p in s.replace(';', ',').split(',') if p.strip()]:
        nid = normalize_id(token)
        if not nid or nid == '0' or nid in seen_set:
            continue
        seen_set.add(nid)
        seen.append(nid)
    if not seen:
        return None
    if len(seen) == 1:
        return seen[0]
    return frozenset(seen)


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
    for item in expr:
        if len(item) == 3:
            name, lv, ge = item
        else:
            name, lv = item
            ge = False
        xs.append(f'{name}:{int(lv)}{"+" if ge else ""}')
    xs.sort()
    return ('t' + '__'.join(xs))[:220]



UNIT_WEAPON_DEBUFF_FILTER_KEYS = frozenset({
    'atk_dn', 'def_dn', 'mob_dn', 'acc_dn',
    'dmg_phys', 'dmg_beam', 'dmg_spec',
    'wp_phys', 'wp_beam', 'wp_spec',
    'range_beam', 'range_phys',
    'range_6',
    'mp_1',
    'preemptive',
    'map_weapon',
    'enemy_def_atk',
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


def parse_unit_weapon_range_filter(val):
    """Comma-separated highest weapon range values (1..6)."""
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    out = []
    seen = set()
    for token in [p.strip() for p in s.replace(';', ',').split(',') if p.strip()]:
        try:
            rv = int(token)
        except Exception:
            continue
        if rv < 1 or rv > 6:
            continue
        if rv not in seen:
            seen.add(rv)
            out.append(rv)
    if not out:
        return None
    return tuple(out)


def unit_weapon_range_filter_cache_fragment(expr):
    if expr is None:
        return 'wr0'
    xs = []
    for x in expr:
        try:
            xs.append(str(int(x)))
        except Exception:
            continue
    if not xs:
        return 'wr0'
    return ('wr' + '__'.join(xs))[:220]

def iter_unit_weapon_trait_texts(uid, ld, lang_code, stat_mode='normal'):
    """Resolved weapon trait / SSP weapon effect lines (same coverage as collect_unit_weapons_search_text)."""
    sm = (stat_mode or 'normal').strip().lower()
    if sm not in ('normal', 'sp', 'ssp'):
        sm = 'normal'
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
        # SSP custom-core weapon effect lines apply only when stat_mode=ssp.
        if sm == 'ssp':
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
    compact_sl = re.sub(r'\s+', ' ', sl)

    # On attack: reduce enemy DEF by X% for this attack (weapon trait; EN/JA/TW phrasing).
    enemy_def_on_atk = False
    if re.search(r"when this unit attacks,\s*reduce enemy'?s\s+def\s+by\s+\d+\s*%", compact_sl) and 'for this attack' in compact_sl:
        keys.add('enemy_def_atk')
        enemy_def_on_atk = True
    if re.search(r'自身の攻撃時、敵の防御力を\d+[%％]減少させた状態で攻撃', s):
        keys.add('enemy_def_atk')
        enemy_def_on_atk = True
    if re.search(r'自身攻擊時，以敵方防禦力減少\d+%的狀態攻擊', s):
        keys.add('enemy_def_atk')
        enemy_def_on_atk = True

    if re.search(r'decrease\s+mp\s+by\s+1\.?', sl) or 'mpが1減少' in sl or re.search(r'mp減少1(?!\d)', sl) or re.search(r'decreased\s+mp\s+lv\s*1\b', sl) or re.search(r'mp減少\s*lv\s*1\b', sl):
        keys.add('mp_1')

    if (
        re.search(r'decreased\s+atk\b', sl)
        or re.search(r'\batk\s+down\b', sl)
        or '攻撃力減少' in s
        or '攻擊力減少' in s
        or re.search(r'攻撃力.*減少', s)
        or re.search(r'攻擊力.*減少', s)
    ):
        keys.add('atk_dn')
    if not enemy_def_on_atk:
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
        or '遭鐳射武裝攻擊時' in s
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
        or '鐳射武裝power下降' in sl
        or '鐳射武裝POWER下降' in s
        or '鐳射武裝power減少' in sl
        or '鐳射武裝POWER減少' in s
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
        or '鐳射武裝最大射程' in s
        or '鐳射武裝的最大射程' in s
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

    # Preemptive Strike (often on SSP weapon lines; EN / JA+TW data use mixed phrasing)
    if _trait_text_indicates_preemptive_strike(s):
        keys.add('preemptive')

    return frozenset(keys)


def _trait_text_indicates_preemptive_strike(text):
    """True if trait line names the preemptive-strike weapon effect (EN / JA / zh-Hant / zh-Hans)."""
    if not text:
        return False
    s = str(text).strip()
    sl = s.lower()
    return (
        'preemptive strike' in sl
        or '先發攻擊' in s
        or '先发攻击' in s
        or '先制' in s
    )


def _strip_custom_core_trait_prefix_for_dc(text):
    if not text:
        return ''
    s = str(text).strip()
    for pref in ('[Custom Core Effect] ', '[Custom Core效果] '):
        if s.startswith(pref):
            s = s[len(pref):].lstrip()
            break
    return s


def _trait_line_is_vigor_supercharged_gate(line_lower, line_orig):
    if 'vigor is supercharged' in line_lower and 'higher' in line_lower:
        return True
    if 'テンションが' in line_orig and '超一撃' in line_orig and '以上' in line_orig:
        return True
    if '戰意為' in line_orig and '超一擊' in line_orig and '以上' in line_orig:
        return True
    return False


def _enemy_def_debuff_pct_from_single_trait_line(line):
    if not line:
        return 0
    ll = line.lower()
    compact = re.sub(r'\s+', ' ', ll)
    m = re.search(r"when this unit attacks,\s*reduce enemy'?s\s+def\s+by\s+(\d+)\s*%", compact)
    if m and 'for this attack' in compact:
        return min(100, max(0, safe_int(m.group(1), 0)))
    m = re.search(r'自身の攻撃時、敵の防御力を(\d+)[%％]減少させた状態で攻撃', line)
    if m:
        return min(100, max(0, safe_int(m.group(1), 0)))
    m = re.search(r'自身攻擊時，以敵方防禦力減少(\d+)%的狀態攻擊', line)
    if m:
        return min(100, max(0, safe_int(m.group(1), 0)))
    m = re.search(r'自身攻击时，以敌方防御力减少(\d+)%的状态攻击', line)
    if m:
        return min(100, max(0, safe_int(m.group(1), 0)))
    return 0


def _enemy_def_pct_from_custom_core_effect_value_blob(blob):
    """
    SSP [Custom Core Effect] lines only: enemy DEF reduction bundled with Weapon Effect Value Up.
    Do not treat 'Maximum Up' / 最大値上昇 (weapon effect cap buff) as DEF debuff — only explicit DEF Down / 防御力減少.
    """
    if not blob:
        return 0
    best = 0
    patterns = (
        (r'Weapon Effect Value Up\s*\(\s*&\s*DEF Down\s*(\d+)\s*%\s*\)', re.I),
        (r'武装効果の効果値UP（さらに防御力(\d+)%減少）', 0),
        (r'武裝效果的效果值UP（且防禦力減少(\d+)%）', 0),
        (r'武装效果的效果值UP（且防御力减少(\d+)%）', 0),
    )
    for pat, flags in patterns:
        for m in re.finditer(pat, blob, flags):
            best = max(best, min(100, safe_int(m.group(1), 0)))
    return best


def parse_enemy_def_debuff_pcts_from_trait_text(text):
    """
    Parse on-attack enemy unit DEF reduction from one weapon / SSP trait blob (multi-line OK).
    Returns (always_on_pct, supercharged_vigor_only_pct). Supercharged line applies only when DC vigor is Supercharged.
    """
    raw = str(text or '')
    had_custom_core_prefix = raw.lstrip().startswith(('[Custom Core Effect] ', '[Custom Core效果] '))
    s = _strip_custom_core_trait_prefix_for_dc(raw)
    if not s:
        return (0, 0)
    unconditional = 0
    vigor_only = 0
    pending_vigor = False
    for raw_ln in s.split('\n'):
        line = raw_ln.strip()
        if not line:
            continue
        ll = line.lower()
        if _trait_line_is_vigor_supercharged_gate(ll, line):
            pending_vigor = True
            continue
        p = _enemy_def_debuff_pct_from_single_trait_line(line)
        if p > 0:
            if pending_vigor:
                vigor_only = max(vigor_only, p)
                pending_vigor = False
            else:
                unconditional = max(unconditional, p)
        else:
            pending_vigor = False
    if had_custom_core_prefix:
        unconditional = max(unconditional, _enemy_def_pct_from_custom_core_effect_value_blob(s))
    return (unconditional, vigor_only)


def enrich_weapon_levels_with_enemy_def_debuff(levels, ssp_trait_lines):
    out = []
    ssp_list = [x for x in (ssp_trait_lines or []) if x]
    for lev in levels or []:
        base_m, vig_m = 0, 0
        for t in lev.get('traits') or []:
            b, v = parse_enemy_def_debuff_pcts_from_trait_text(t)
            base_m = max(base_m, b)
            vig_m = max(vig_m, v)
        for st in ssp_list:
            b, v = parse_enemy_def_debuff_pcts_from_trait_text(st)
            base_m = max(base_m, b)
            vig_m = max(vig_m, v)
        d = dict(lev)
        d['enemy_def_debuff_base_pct'] = base_m
        d['enemy_def_debuff_supercharged_pct'] = vig_m
        out.append(d)
    return out


def _lang_data_for_weapon_debuff_filter(ld_request, lc_request):
    """Use EN trait/capability text for debuff filter matching so TW/HK/JP match EN results."""
    ld_en = LANG_DATA.get('EN')
    if ld_en:
        return ld_en, 'EN'
    return ld_request, lc_request


def collect_unit_weapon_trait_only_debuff_keys(uid, ld, lc, stat_mode='normal'):
    """Weapon debuff categories from trait / effect text (+ map_weapon); excludes numeric range tiers."""
    acc = set()
    for line in iter_unit_weapon_trait_texts(uid, ld, lc, stat_mode=stat_mode):
        acc |= set(classify_unit_weapon_trait_debuff_keys(line))
    for wp in unit_weapon_map.get(uid, []):
        wid = wp['id']
        wm = weapon_info_map.get(wid, {})
        wt = str(wm.get('weapon_type', '1') or '1')
        if wt == '3':
            acc.add('map_weapon')
            break
    return frozenset(acc)


def unit_has_non_map_weapon_max_range_ge(uid, ld, lc, stat_mode='normal', need_max=6):
    """True if any grid (non-MAP) weapon has max_range + SSP range bonus ≥ need_max under stat_mode."""
    sm = (stat_mode or 'normal').strip().lower()
    if sm not in ('normal', 'sp', 'ssp'):
        sm = 'normal'
    uid = normalize_id(uid)
    wtm = ld.get('weapon_trait_map', {}) or {}
    wcm = ld.get('weapon_capability_map', {}) or {}
    wtdm = ld.get('weapon_trait_detail_map', {}) or {}
    for wp in unit_weapon_map.get(uid, []) or []:
        wid = normalize_id(wp.get('id'))
        if not wid or wid == '0':
            continue
        wm = weapon_info_map.get(wid, {})
        wt = str(wm.get('weapon_type', '1') or '1')
        if wt == '3':
            continue
        ws = resolve_weapon_stats(
            wm, weapon_status_map, weapon_correction_map,
            wtm, wcm, growth_pattern_map, weapon_trait_change_map, wtdm,
            wid=wid, lang_code=lc, unit_id=uid,
        )
        rx = int(ws.get('range_max', 0) or 0)
        bonus = 0
        if sm == 'ssp':
            mwid = normalize_id(wm.get('main_weapon_id', '0') or '0')
            for cid in (wid, mwid):
                if not cid or cid == '0':
                    continue
                enh_list = unit_ssp_weapon_enhance_map.get(cid)
                if not enh_list:
                    continue
                for enh in enh_list:
                    if str(enh.get('type')) == '4':
                        bonus += int(enh.get('value', 0) or 0)
                break
        if rx + bonus >= int(need_max):
            return True
    return False


def unit_highest_damage_weapon_max_range(uid, ld, lc, stat_mode='normal'):
    """Effective max range of the highest-damage non-MAP weapon."""
    sm = (stat_mode or 'normal').strip().lower()
    if sm not in ('normal', 'sp', 'ssp'):
        sm = 'normal'
    uid = normalize_id(uid)
    wtm = ld.get('weapon_trait_map', {}) or {}
    wcm = ld.get('weapon_capability_map', {}) or {}
    wtdm = ld.get('weapon_trait_detail_map', {}) or {}
    best_power = None
    best_range = 0
    for wp in unit_weapon_map.get(uid, []) or []:
        wid = normalize_id(wp.get('id'))
        if not wid or wid == '0':
            continue
        wm = weapon_info_map.get(wid, {})
        wt = str(wm.get('weapon_type', '1') or '1')
        if wt == '3':
            continue
        ws = resolve_weapon_stats(
            wm, weapon_status_map, weapon_correction_map,
            wtm, wcm, growth_pattern_map, weapon_trait_change_map, wtdm,
            wid=wid, lang_code=lc, unit_id=uid,
        )
        rx = int(ws.get('range_max', 0) or 0)
        bonus = 0
        if sm == 'ssp':
            mwid = normalize_id(wm.get('main_weapon_id', '0') or '0')
            for cid in (wid, mwid):
                if not cid or cid == '0':
                    continue
                enh_list = unit_ssp_weapon_enhance_map.get(cid)
                if not enh_list:
                    continue
                for enh in enh_list:
                    if str(enh.get('type')) == '4':
                        bonus += int(enh.get('value', 0) or 0)
                break
        levels = ws.get('levels', [])
        if isinstance(levels, dict):
            p5 = (levels.get(5, {}) or {}).get('power', ws.get('power', 0))
        elif isinstance(levels, list):
            p5 = ws.get('power', 0)
            for lv in levels:
                if not isinstance(lv, dict):
                    continue
                try:
                    p5 = max(int(p5 or 0), int(lv.get('power', 0) or 0))
                except Exception:
                    continue
        else:
            p5 = ws.get('power', 0)
        try:
            power = int(p5 or 0)
        except Exception:
            power = 0
        eff_range = max(0, rx + bonus)
        if best_power is None or power > best_power or (power == best_power and eff_range > best_range):
            best_power = power
            best_range = eff_range
    return int(best_range or 0)


def unit_matches_weapon_range_filter(uid, ld, lc, want_filter, stat_mode='normal', combine='and'):
    if want_filter is None:
        return True
    got = unit_highest_damage_weapon_max_range(uid, ld, lc, stat_mode)
    if combine == 'or':
        return any(got == int(x) for x in want_filter)
    return all(got == int(x) for x in want_filter)


def collect_unit_weapon_range_debuff_keys(uid, ld, lc, stat_mode='normal'):
    """Tiered max-range filter; range_6 includes SSP Custom Core range (type 4) when listing with stat_mode=ssp."""
    if unit_has_non_map_weapon_max_range_ge(uid, ld, lc, stat_mode=stat_mode, need_max=6):
        return frozenset({'range_6'})
    return frozenset()


def collect_unit_weapon_debuff_keys(uid, ld, lc, stat_mode='normal'):
    ld_f, lc_f = _lang_data_for_weapon_debuff_filter(ld, lc)
    acc = set(collect_unit_weapon_trait_only_debuff_keys(uid, ld_f, lc_f, stat_mode=stat_mode))
    acc |= set(collect_unit_weapon_range_debuff_keys(uid, ld_f, lc_f, stat_mode))
    return frozenset(acc)


def unit_matches_weapon_debuff_filter(uid, ld, lc, want_filter, _memo=None, stat_mode='normal', combine='and'):
    if want_filter is None:
        return True
    if _memo is None:
        _memo = {}
    if uid not in _memo:
        _memo[uid] = collect_unit_weapon_debuff_keys(uid, ld, lc, stat_mode)
    have = _memo[uid]
    if combine == 'or':
        return any(k in have for k in want_filter)
    for k in want_filter:
        if k not in have:
            return False
    return True


def series_filter_cache_fragment(sid):
    if sid is None:
        return 's0'
    if isinstance(sid, (frozenset, set)):
        xs = sorted(str(x).replace('%', '')[:48] for x in sid if str(x).strip())
        if not xs:
            return 's0'
        return ('s' + '__'.join(xs))[:220]
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


def entity_matches_lineage(lin_map, eid, want_lid, combine='and'):
    """combine 'and': every selected tag · 'or': any selected tag (multi-id only)."""
    if want_lid is None:
        return True
    if isinstance(want_lid, (frozenset, set, list, tuple)):
        if not want_lid:
            return True
        if combine == 'or':
            return any(_entity_matches_one_lineage(lin_map, eid, w) for w in want_lid)
        return all(_entity_matches_one_lineage(lin_map, eid, w) for w in want_lid)
    return _entity_matches_one_lineage(lin_map, eid, want_lid)


def entity_matches_series(ser_set_id, want_series_id, lc, combine='or'):
    if want_series_id is None:
        return True
    resolved = resolve_series(ser_set_id or '', lc)
    if isinstance(want_series_id, (frozenset, set, list, tuple)):
        if not want_series_id:
            return True
        want_ids = {normalize_id(w) for w in want_series_id if str(w).strip()}
        want_ids.discard('')
        want_ids.discard('0')
        if not want_ids:
            return True
        entity_ids = {normalize_id(s.get('id', '')) for s in resolved if s.get('id')}
        if combine == 'and':
            return want_ids.issubset(entity_ids)
        return not entity_ids.isdisjoint(want_ids)
    ws = normalize_id(want_series_id)
    for s in resolved:
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


def supporter_matches_lineage_filter(sid, want_lid, ld, lang_code, combine='and'):
    """combine 'and' / 'or' for multi-tag selection (leader skill tag resolution)."""
    if want_lid is None:
        return True
    if isinstance(want_lid, (frozenset, set, list, tuple)):
        if not want_lid:
            return True
        wants = want_lid
    else:
        wants = (want_lid,)
    tag_ids = supporter_leader_tag_ids(sid, ld, lang_code)
    if combine == 'or':
        return any(_tag_id_list_matches_lineage_want(tag_ids, w) for w in wants)
    return all(_tag_id_list_matches_lineage_want(tag_ids, w) for w in wants)


def trait_condition_item_field_vectors(item):
    """Single m_trait_condition row -> tag/series/role lists (AND within this row)."""
    if not isinstance(item, dict):
        return [], [], [], [], [], []
    ut, gt, ser, ct, tp = [], [], [], [], []
    for key in ['UnitTags', 'unitTags']:
        val = str(item.get(key) or '')
        if val and val != '0':
            for v in val.split(','):
                v = v.strip()
                if v and v != '0' and v not in ut:
                    ut.append(v)
    for key in ['GroupTags', 'groupTags', 'GroupTag', 'groupTag']:
        val = str(item.get(key) or '')
        if val and val != '0':
            for v in val.split(','):
                v = v.strip()
                if v and v != '0' and v not in gt:
                    gt.append(v)
    for key in ['CharacterTags', 'characterTags']:
        val = str(item.get(key) or '')
        if val and val != '0':
            for v in val.split(','):
                v = v.strip()
                if v and v != '0' and v not in ct:
                    ct.append(v)
    char_series = []
    for key in ['CharacterSeries', 'characterSeries']:
        val = str(item.get(key) or '')
        if val and val != '0':
            for v in val.split(','):
                v = v.strip()
                if v and v != '0' and v not in char_series:
                    char_series.append(v)
    for key in ['UnitSeries', 'unitSeries']:
        val = str(item.get(key) or '')
        if val and val != '0':
            for v in val.split(','):
                v = v.strip()
                if v and v != '0' and v not in ser:
                    ser.append(v)
    for key in ['UnitRoleTypes', 'unitRoleTypes']:
        val = str(item.get(key) or '')
        if val and val != '0':
            for v in val.split(','):
                v = v.strip()
                if v and v != '0' and v not in tp:
                    tp.append(v)
    return ut, gt, ser, ct, tp, char_series


def trait_condition_vectors_match_unit(ut, gt, ser, tp, ct, uid, ld, lc, char_id=None, character_series=None):
    """AND across non-empty fields on one trait-condition row."""
    uid = normalize_id(uid)
    character_series = list(character_series) if character_series else []
    if not any([ut, gt, tp, ser, ct, character_series]):
        return True
    ok = True
    if ut:
        uls = unit_lin_map.get(uid, [])
        ok = ok and bool(uls) and any(_tag_id_list_matches_lineage_want(ut, ul) for ul in uls)
    if gt:
        uls = unit_lin_map.get(uid, [])
        ok = ok and bool(uls) and any(_tag_id_list_matches_lineage_want(gt, ul) for ul in uls)
    if tp:
        urole = str(unit_info_map.get(uid, {}).get('role', '0'))
        ok = ok and (urole in [str(x) for x in tp])
    if ser:
        sset = unit_ser_map.get(uid, '')
        unit_sids = set()
        if sset and sset != '0':
            for sid in ld.get('ser_set_map', {}).get(sset, []):
                unit_sids.add(normalize_id(sid))
        ok = ok and any(normalize_id(s) in unit_sids for s in ser)
    if character_series:
        if not char_id or str(char_id).strip() in ('', '0'):
            ok = ok and False
        else:
            cmap = ld.get('char_ser_map', {})
            cid = normalize_id(char_id)
            char_ss = normalize_id(str(cmap.get(cid, '') or '0'))
            char_sids = set()
            if char_ss and char_ss != '0':
                for sid in ld.get('ser_set_map', {}).get(char_ss, []) or []:
                    char_sids.add(normalize_id(sid))
            ok = ok and bool(char_sids) and any(normalize_id(s) in char_sids for s in character_series)
    if ct and char_id and str(char_id).strip() not in ('', '0'):
        cid = normalize_id(char_id)
        cls = char_lin_map.get(cid, [])
        ok = ok and bool(cls) and any(_tag_id_list_matches_lineage_want(ct, cl) for cl in cls)
    return ok


def trait_condition_matches_unit(cond_id, uid, ld, lc, char_id=None):
    """Whether trait condition set applies: OR across rows in m_trait_condition with same TraitConditionSetId.

    Merging all rows into one map incorrectly ANDs unrelated rows (e.g. series OR unit tag for Neo Zeon leaders).
    """
    cond_id = normalize_id(cond_id)
    if not cond_id or cond_id == '0':
        return True
    uid = normalize_id(uid)
    rows = trait_condition_rows_by_set_id.get(cond_id) if trait_condition_rows_by_set_id else None
    if not rows:
        raw = trait_condition_raw_map.get(str(cond_id), {})
        return trait_condition_vectors_match_unit(
            raw.get('unit_tags') or [], raw.get('group_tags') or [],
            raw.get('series') or [], raw.get('types') or [], raw.get('char_tags') or [],
            uid, ld, lc, char_id, raw.get('character_series') or [])
    for item in rows:
        ut, gt, ser, ct, tp, cser = trait_condition_item_field_vectors(item)
        if trait_condition_vectors_match_unit(ut, gt, ser, tp, ct, uid, ld, lc, char_id, cser):
            return True
    return False


def supporter_leader_applies_to_unit(sid, uid, ld, lc, char_id=None):
    """True if at least one tier-3 leader skill applies to the unit (OR across tier-3 rows)."""
    uid = normalize_id(uid)
    if uid == '0' or uid not in unit_info_map:
        return True
    lsr = supporter_leader_map.get(sid, [])
    tier3 = [ls for ls in lsr if ls.get('tier') == 3]
    if not tier3:
        return True
    for ls in tier3:
        if trait_condition_matches_unit(ls.get('trait_cond_id', '0'), uid, ld, lc, char_id):
            return True
    return False


def option_part_matches_unit(opid, uid, lc=None):
    """Whether an option part applies to this unit when browsing with unit_id filter.

    Uses master data only (not display names): m_option_parts_lineage and SeriesId.
    If neither lineage nor SeriesId is set, the part applies to any unit.
    If only lineage: unit must match at least one lineage id (OR).
    If only SeriesId: unit's SeriesSet must include that series id.
    If both: unit matches if lineage OR series matches.
    """
    opid = normalize_id(opid)
    uid = normalize_id(uid)
    if uid == '0' or uid not in unit_info_map:
        return True
    lids = option_parts_lineage_map.get(opid, [])
    part_series = option_part_series_map.get(opid, '0')
    if not part_series or part_series == '0':
        part_series = '0'
    has_lineage = bool(lids)
    has_series = part_series != '0'
    if not has_lineage and not has_series:
        return True
    lang = lc if lc else DEFAULT_LANG
    lineage_ok = bool(has_lineage and any(_entity_matches_one_lineage(unit_lin_map, uid, pl) for pl in lids))
    series_ok = bool(has_series and entity_matches_series(unit_ser_map.get(uid, ''), part_series, lang))
    if has_lineage and has_series:
        return lineage_ok or series_ok
    if has_lineage:
        return lineage_ok
    return series_ok


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
# Parsed from unit ability text; not a real stat key in UNIT_STAT_ORDER (handled separately for crit DMG in API/DC).
UNIT_ABILITY_PASSIVE_CRIT_DMG_PCT_KEY = '__crit_dmg_pct__'
# List API: sort by these columns using stat value as primary key (not rarity), so SP / SSP toggles reorder correctly.
LIST_STAT_SORT_PRIMARY = frozenset(
    ['Ranged', 'Melee', 'Awaken', 'Defense', 'Reaction', 'HP', 'EN', 'ATK', 'DEF', 'MOB', 'MOV']
)

TERRAIN_TYPE_ICON_MAP = {
    'Space': 'UI_Common_TerrainIcon_Space.webp',
    'Atmospheric': 'UI_Common_TerrainIcon_Sky.webp',
    'Ground': 'UI_Common_TerrainIcon_Ground.webp',
    'Sea': 'UI_Common_TerrainIcon_Aquatic.webp',
    'Underwater': 'UI_Common_TerrainIcon_Underwater.webp',
}
TERRAIN_LEVEL_ICON_MAP = {
    3: 'UI_Common_TerrainIcon_Circle.webp',
    2: 'UI_Common_TerrainIcon_Triangle.webp',
    1: 'UI_Common_TerrainIcon_Hyphen.webp',
}
WEAPON_ATTR_MAP = {
    '1': {'label': 'Physical', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_02.webp'},
    '2': {'label': 'Beam', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_01.webp'},
    '3': {'label': 'Special', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_03.webp'},
    '4': {'label': 'Beam/Physical', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.webp'},
    '5': {'label': 'Physical/Special', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.webp'},
    '6': {'label': 'Beam/Special', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.webp'},
    '7': {'label': 'Beam/Physical/Special', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.webp'},
    '8': {'label': 'Beam/Physical', 'icon': '/static/images/WeaponIcon/UI_Common_WeaponIcon_04.webp'},
}
MAP_WEAPON_ICON = '/static/images/WeaponIcon/UI_Common_WeaponIcon_map.webp'
# Wing Gundam Zero (EW): playable 1219000150 / MAP 121900015005; NPC shell 1219000151 / MAP 121900015105 (same after-move MAP treatment).
MAP_WEAPON_AFTER_MOVE_PAIRS = frozenset({
    ('1219000150', '121900015005'),
    ('1219000151', '121900015105'),
})
MAP_WEAPON_AFTER_MOVE_ICON = '/static/images/UI/UI_Common_WeaponIcon_map_after_move.webp'
# Recovery/supply MAP (e.g. Lacus): standard blue MAP icon + "Supply Type: MP" in the header (not the attack-attribute row).
MAP_WEAPON_RECOVERY_SUPPLY_MP_PAIRS = frozenset({('1330005900', '133000590003')})
MAP_WEAPON_SUPPLY_TYPE_MP_ICON = '/static/images/UI/Sprite/UI_Common_Icon_MapWeapon_Mp.webp'
# Lacus (1330005900) MAP: in-game battle UI blue MAP art (CDN /static/images mirror — use game_image_public_url).
MAP_WEAPON_BLUE_BATTLE_UI_ICON = '/static/images/UI/UI_Battle_MapUI_MapWeapon_Icon_Blue.webp'
MAP_WEAPON_BLUE_BATTLE_UI_PAIRS = frozenset({('1330005900', '133000590003')})


def is_map_weapon_blue_battle_ui(unit_id, wid, wt):
    wts = str(wt) if wt is not None else ''
    if wts != '3':
        return False
    u = normalize_id(unit_id) if unit_id else ''
    w = normalize_id(wid) if wid else ''
    return bool(u and w and (u, w) in MAP_WEAPON_BLUE_BATTLE_UI_PAIRS)


def is_map_weapon_recovery_supply_mp(unit_id, wid, wt):
    wts = str(wt) if wt is not None else ''
    if wts != '3':
        return False
    u = normalize_id(unit_id) if unit_id else ''
    w = normalize_id(wid) if wid else ''
    return bool(u and w and (u, w) in MAP_WEAPON_RECOVERY_SUPPLY_MP_PAIRS)


def is_map_weapon_after_move_unit_weapon(unit_id, wid, wt):
    wts = str(wt) if wt is not None else ''
    if wts != '3':
        return False
    u = normalize_id(unit_id) if unit_id else ''
    w = normalize_id(wid) if wid else ''
    return bool(u and w and (u, w) in MAP_WEAPON_AFTER_MOVE_PAIRS)
EX_WEAPON_OVERLAY = '/static/images/WeaponIcon/UI_Battle_Button_FooterList_IconBaseEX_MiniIcon.webp'
ABILITY_FRAME_OVERLAY = '/static/images/UI/UI_CharaAbilities_Tmb_Square_Normal_Frame.webp'
DEFAULT_CORRECTION = {'power_rate': 120, 'en_rate': 90, 'hit_rate': 100, 'crit_rate': 100, 'map_ammo': 1}
ATTACK_ATTR_TYPES = {
    '1': [{'label': 'Ranged', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.webp'}],
    '2': [{'label': 'Melee', 'icon': '/static/images/UI/UI_Common_TypeIcon_Melee_S.webp'}],
    '3': [{'label': 'Awaken', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.webp'}],
    '4': [{'label': 'Ranged', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.webp'}, {'label': 'Melee', 'icon': '/static/images/UI/UI_Common_TypeIcon_Melee_S.webp'}],
    '5': [{'label': 'Ranged', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.webp'}, {'label': 'Awaken', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.webp'}],
    '6': [{'label': 'Melee', 'icon': '/static/images/UI/UI_Common_TypeIcon_Melee_S.webp'}, {'label': 'Awaken', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.webp'}],
    '7': [{'label': 'Ranged', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Ranged_S.webp'}, {'label': 'Melee', 'icon': '/static/images/UI/UI_Common_TypeIcon_Melee_S.webp'}, {'label': 'Awaken', 'icon': '/static/images/WeaponIcon/UI_Common_TypeIcon_Awaken_S.webp'}],
}
MP_CONSUMPTION_WEAPON_IDS = {'120000395006': 5}
MP_CONSUMPTION_UNIT_EX = {'1330000750': 2}
HP_CONSUMPTION_UNIT_EX = {'1501002250': 10}
ACQUISITION_ROUTE_ICONS = {
    '1': '/static/images/UI/UI_Common_Icon_Source_Gasha.webp',
    '2': '',
    '3': '/static/images/UI/UI_Common_Icon_Source_Event.webp',
}
ULT_ICON = '/static/images/UI/UI_Common_Icon_ULT.webp'
RARITY_ICON_MAP = {
    '1': '/static/images/Rarity/UI_Common_RarityIcon_N.webp',
    '2': '/static/images/Rarity/UI_Common_RarityIcon_R.webp',
    '3': '/static/images/Rarity/UI_Common_RarityIcon_SR.webp',
    '4': '/static/images/Rarity/UI_Common_RarityIcon_SSR.webp',
    '5': '/static/images/Rarity/UI_Common_RarityIcon_UR.webp',
}
ROLE_ICON_MAP = {
    '1': '/static/images/UI/UI_Common_TypeIcon_Attack_M.webp',
    '2': '/static/images/UI/UI_Common_TypeIcon_Defense_M.webp',
    '3': '/static/images/UI/UI_Common_TypeIcon_Support_M.webp',
}
# Substrings in trait/ability *names* from master data (not necessarily the same as on-screen UI copy).
EX_ABILITY_PATTERNS = [
    'ex character ability', 'ex ability', 'ex機體能力', 'ex角色能力', 'exキャラクターアビリティ',
]


def ex_character_ability_display_label(lang_code):
    """Short **trait/ability card** title for renamed EX-style rows in API `display_name` only.

    Do not use this for stats toggles, list CP buttons, or other UI chrome — those use the
    front-end i18n key `conditional_passive` (EN: 'Conditional Passive'), which must stay
    independent of master-data strings and of this shorthand.
    """
    lc = (lang_code or 'EN').upper()
    if lc in ('TW', 'HK'):
        return 'EX角色能力'
    if lc in ('JA', 'JP'):
        return 'EXキャラクターアビリティ'
    return 'EX ability'


# Unit IDs whose EX-framed tag/squad trait is shown as **Conditional Passive** in-game (not the generic EX-ability title).
UNIT_IDS_CONDITIONAL_PASSIVE_TRAIT_TITLE = frozenset({'1370005950'})


def conditional_passive_trait_display_label(lang_code):
    """Localized title for UNIT_IDS_CONDITIONAL_PASSIVE_TRAIT_TITLE (e.g. 00 Raiser)."""
    lc = (lang_code or 'EN').upper()
    if lc in ('TW', 'HK'):
        return '條件被動'
    if lc in ('JA', 'JP'):
        return '条件パッシブ'
    return 'Conditional Passive'


def is_ex_character_ability_frame(ab_name):
    """Square EX frame on trait icon: only when the trait title is the EX character-ability type (EX_ABILITY_PATTERNS).

    Series- and tag-condition passives (e.g. \"(Series conditions) …\") use a normal frame in-game; do not
    treat those titles as EX-framed. Body text that references piloting a named (EX) unit still adds the
    frame via ability_details_imply_ex_piloting_ex_unit in build_ability_entry.
    """
    return bool(ab_name and is_ex_ability(ab_name))


def _is_official_ex_slot_umbrella_title(ab_name):
    """m_trait_set_detail umbrella row (e.g. id …202450100) — must show verbatim, not shortened to 'EX ability'."""
    n = ' '.join((ab_name or '').strip().split()).lower()
    return n == 'ex character ability'


def is_ex_character_ability_rename(ab_name):
    """Rename only true EX-slot *wording* from master (see EX_ABILITY_PATTERNS), not conditioned-trait prefixes.

    m_trait_set_detail names like \"(Tag conditions) Support Attack LV 1\" are full in-game titles; they must stay
    verbatim. The old \"(tag conditions) substring\" shortcut incorrectly collapsed those to ``EX ability``.
    """
    if _is_official_ex_slot_umbrella_title(ab_name):
        return False
    return bool(ab_name and is_ex_ability(ab_name))


def ability_details_imply_ex_piloting_ex_unit(details):
    """EX frame when description ties the effect to piloting a named (EX) unit (game spells this in body text, not the title)."""
    if not details:
        return False
    parts = []
    for d in details:
        if not isinstance(d, dict):
            continue
        t = (d.get('text') or '').strip()
        if t:
            parts.append(t)
    blob = '\n'.join(parts)
    if not blob:
        return False
    low = blob.lower()
    if '(ex)' not in low and '（ex）' not in blob:
        return False
    if re.search(r'(?:when|if|while)\s+piloting\s+.{1,400}?(?:\(ex\)|（ex）)', low, re.IGNORECASE | re.DOTALL):
        return True
    if re.search(r'\bpiloting\s+.{1,400}?(?:\(ex\)|（ex）)', low, re.IGNORECASE | re.DOTALL):
        return True
    if re.search(r'駕駛.{1,400}?（\s*ex\s*）', blob, re.IGNORECASE | re.DOTALL):
        return True
    if re.search(r'搭乘.{1,400}?（\s*ex\s*）', blob, re.IGNORECASE | re.DOTALL):
        return True
    if re.search(r'搭乘.{1,400}?\(ex\)', blob, re.IGNORECASE | re.DOTALL):
        return True
    if re.search(r'搭乗.{1,400}?（\s*ex\s*）', blob, re.IGNORECASE | re.DOTALL):
        return True
    if re.search(r'搭乗.{1,400}?\(ex\)', blob, re.IGNORECASE | re.DOTALL):
        return True
    return False

# MechanismSetId -> mechanism fragment ids for browse filter. Do not embed synthetic '2x2' here:
# large footprint is determined only by OccupiedAreaId==2 (same as get_unit is_large / mechanism banner).
MECH_MAP_TABLE = {'1': ['1'], '2': ['2'], '3': ['1', '2'], '5': ['4'], '6': ['1', '5'], '7': ['6'], '8': ['1', '7'], '9': ['1', '6']}
# '3' = m_mechanism SD (not assigned via m_mechanism_set); tied to body type / legacy unit-id prefixes (see _unit_has_sd_mechanism).
ALL_MECHANISM_FILTER_IDS = frozenset(m for mids in MECH_MAP_TABLE.values() for m in mids) | frozenset({'2x2', '3'})


def _unit_has_sd_mechanism(info, uid=None):
    """SD (m_mechanism id 3) is not in m_mechanism_set rows; infer from legacy id prefixes or roster body type (not map NPC shells)."""
    if not info:
        return False
    u = normalize_id(uid or '')
    if u.startswith('17090') or u.startswith('17050') or u.startswith('17250'):
        return True
    if str(info.get('body_type', '1')) == '3' and u and u in unit_list_playable_ids:
        return True
    return False


def collect_unit_mechanism_mids(info, uid=None):
    """Mechanism fragment ids for filtering. '2x2' iff OccupiedAreaId is 2; '3' (SD) from body type / SD unit ids."""
    if not info:
        return frozenset()
    msid = str(info.get('mechanism_set_id', '0'))
    mids = [m for m in MECH_MAP_TABLE.get(msid, []) if m != '2x2']
    if safe_int(info.get('occupied_area_id'), 1) == 2:
        mids.append('2x2')
    if _unit_has_sd_mechanism(info, uid) and '3' not in mids:
        mids.append('3')
    return frozenset(mids)


def parse_unit_mechanism_filter(val):
    """Comma-separated mechanism ids (MECH_MAP_TABLE); unit must have every selected mechanism (AND)."""
    if val is None:
        return None
    s = (val or '').strip()
    if not s or s.upper() == 'ALL':
        return None
    out = []
    seen = set()
    for token in [p.strip() for p in s.replace(';', ',').split(',') if p.strip()]:
        if token not in ALL_MECHANISM_FILTER_IDS:
            continue
        if token not in seen:
            seen.add(token)
            out.append(token)
    if not out:
        return None
    return frozenset(out)


def unit_mechanism_filter_cache_fragment(expr):
    if expr is None:
        return 'm0'
    return ('m' + '__'.join(sorted(expr)))[:220]


def unit_matches_mechanism_filter(info, want_filter, uid=None, combine='and'):
    if not want_filter:
        return True
    have = collect_unit_mechanism_mids(info, uid)
    if combine == 'or':
        return not have.isdisjoint(want_filter)
    return want_filter.issubset(have)


def _is_conditional_stat_text(t):
    tl = (t or '').lower()
    for kw in ['when ', 'if ', 'during ', 'at the start', 'each time', 'every time', 'each time you', 'every time you']:
        if kw in tl:
            return True
    raw = t or ''
    # JA / TW / HK: gated squad / series lines (split by newline in data; single-line still flagged).
    if '包含上述' in raw or 'を含む時' in raw or '含む時' in raw:
        return True
    return False


def trait_title_implies_conditional_stat_bonuses(name):
    """m_trait_set_detail title marks in-game gated passives; body text may be a bare '%' line without 'when/if'.

    Those bonuses belong in the conditional-passive / has_cond pool only (not base list stats)."""
    if not name:
        return False
    low = name.lower()
    en_markers = (
        '(battle conditions)', '(tag conditions)', '(series conditions)',
        '(hp conditions)', '(vigor conditions)', '(no. of battles conditions)',
        '(when supporting)', '(map conditions)', '(ally conditions)',
    )
    if any(m in low for m in en_markers):
        return True
    cjk_markers = (
        '（戰鬥條件）', '（战斗条件）', '（標籤條件）', '（标签条件）',
        '（系列條件）', '（系列条件）', '（戰鬥次數條件）', '（战斗次数条件）',
        '（體力條件）', '（体力条件）', '（氣勢條件）', '（气势条件）',
        '（支援時', '（選擇閃避開始戰鬥時）',
    )
    if any(m in name for m in cjk_markers):
        return True
    if any(m in name for m in ('シリーズ条件', 'タグ条件', '戦闘条件', '戦闘回数条件', 'HP条件', '気力条件', '支援時')):
        return True
    return False


def _char_trait_title_counts_as_conditional_bucket(bab):
    """(Battle/tag/… conditions) in the trait *name* counts toward the CP bucket only if details back it up.

    Structured condition tags, [Condition N] placeholders, or when/if-style lines count; a bare \"%\" line
    under a condition-style title does not (matches in-game: title is categorical, stats are always on)."""
    if not bab or not isinstance(bab, dict):
        return False
    name = bab.get('name') or ''
    if not trait_title_implies_conditional_stat_bonuses(name):
        return False
    for d2 in bab.get('details', []) or []:
        if not isinstance(d2, dict):
            continue
        if d2.get('conditions') or d2.get('condition_groups'):
            return True
        txt = (d2.get('text') or '').strip()
        if not txt:
            continue
        if '[condition' in txt.lower():
            return True
        for ln in re.split(r'\r?\n+', txt):
            ln = (ln or '').strip()
            if not ln:
                continue
            if _is_conditional_stat_text(ln):
                return True
    return False


def ability_name_implies_unit_stat_conditional_bucket(ad):
    """True when the ability *title* gates the whole trait behind conditional stats / CP toggle.

    Do not scan ability body text here: phrases like \"at the start of every turn\" on one line
    would incorrectly force unconditional stat lines in the same ability (e.g. Mobility %) into
    the conditional bucket. Per-sentence routing uses _is_conditional_stat_text inside ep()."""
    if not ad or not isinstance(ad, dict):
        return False
    name = (ad.get('name') or '').strip()
    if not name:
        return False
    if trait_title_implies_conditional_stat_bonuses(name):
        return True
    low = name.lower()
    if 'unconditional' in low:
        return False
    if 'condition' in low or 'conditional' in low:
        return True
    if re.search(r'(?<![a-z])when(?![a-z])', low):
        return True
    for w in ('when countering', 'when counter', 'when attacking', 'when attacked', 'during battle'):
        if w in low:
            return True
    return False


def _char_detail_is_conditional(d2, txt):
    """True if this trait line uses structured tags or conditional wording (CP must be on to apply)."""
    if isinstance(d2, dict):
        if d2.get('conditions'):
            return True
        for cg in d2.get('condition_groups') or []:
            if isinstance(cg, dict) and (cg.get('conditions') or []):
                return True
    return _is_conditional_stat_text(txt or '')

def _char_trait_text_is_support_defense_action(txt):
    """True when text is about executing Support Defense (in-combat action). Not a passive — exclude from trait % stat totals."""
    if not txt or not isinstance(txt, str):
        return False
    t = txt.lower()
    if 'support defense' not in t:
        return False
    return 'execut' in t

_SHORT_PILOT_STAT_LINE_ONLY = re.compile(
    # Allow trailing clauses like "(up to 15%)" — still a single-line squad/stack ATK buff, not dossier pilot stats.
    r'^\s*Increase\s+(?:own\s+)?(?:Melee|Ranged|Range|Defense|Reaction|Awaken|ATK|DEF|Attack)\s+by\s+\d+%(?:\s*\([^)]*\))*\s*\.?\s*$',
    re.IGNORECASE,
)


def _blob_has_squad_unit_stat_context(blob):
    """True when trait text reads like buffing allied/squad units' MS stats.

    Generic ATK/DEF there refer to unit combat stats, not pilot dossier Ranged/Melee/Defense."""
    if not blob or not isinstance(blob, str):
        return False
    bl = blob.lower()
    if 'same squad' in bl or 'units bearing' in bl:
        return True
    if 'for each unit' in bl:
        return True
    if ' for units' in bl and ('squad' in bl or 'tag' in bl):
        return True
    # JA/TW/HK: per-unit-in-squad wording; 攻撃力/攻擊力 lines are MS ATK, not pilot shooting/fighting stats.
    if '同部隊' in blob or '部隊内' in blob:
        return True
    if '每有1架' in blob or 'ユニット1体につき' in blob:
        return True
    return False


def _ability_has_squad_unit_stat_context(bab):
    """True when ability text describes buffing allied/squad units' MS stats (not the pilot's Ranged/Melee)."""
    if not bab or not isinstance(bab, dict):
        return False
    parts = []
    for d2 in bab.get('details', []) or []:
        if isinstance(d2, dict):
            parts.append(d2.get('text') or '')
        else:
            parts.append(str(d2))
    blob = ' '.join(parts)
    return _blob_has_squad_unit_stat_context(blob)

def _char_trait_line_is_squad_unit_effect(line, bab):
    """Stat lines that buff squad/allied units (or MS other than pilot stats) must not count toward pilot Ranged/Melee totals."""
    if not line or not isinstance(line, str):
        return False
    tl = line.lower()
    if 'same squad' in tl or 'units bearing' in tl:
        return True
    if ' for units' in tl or ' allied units' in tl:
        return True
    if ' for unit ' in tl and 'pilot' not in tl:
        return True
    if bab is not None and _SHORT_PILOT_STAT_LINE_ONLY.match(line) and _ability_has_squad_unit_stat_context(bab):
        return True
    return False

def _clean_supercharged_ex_tier_label(lb):
    s = (lb or '').strip().strip('"').strip("'")
    s = re.sub(r'\s*\(?\s*1\s*turn\s*\)?\.?\s*$', '', s, flags=re.IGNORECASE)
    return s.strip().strip('"').strip("'")


def _slice_supercharged_ex_tier_sections(blob):
    """Split EX trait text at Supercharged EX 1 / 2 (EN) or 超一擊EX1 / 2 (ZH) headers. Returns [(tier, label, chunk), ...]."""
    if not blob or not isinstance(blob, str):
        return []
    rx = re.compile(r'(?:Supercharged\s+EX|超一擊EX)\s*([12])\b', re.IGNORECASE)
    matches = list(rx.finditer(blob))
    if len(matches) < 2:
        return []
    out = []
    for i, m in enumerate(matches):
        tier = int(m.group(1))
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(blob)
        chunk = blob[start:end]
        line_end = blob.find('\n', m.start())
        if line_end == -1 or line_end > end:
            line_end = min(m.end(), end)
        label = blob[m.start():line_end].strip().strip('"').strip("'")
        out.append((tier, label, chunk))
    return out


def _extract_supercharged_ex_tier_chunk_stat_pct(chunk, char_id, bab):
    pct = {s: 0 for s in CHAR_STAT_ORDER}
    if not chunk:
        return pct
    lines = [ln.strip() for ln in re.split(r'\r?\n+', chunk) if ln.strip()] or [chunk]
    for line in lines:
        if _char_trait_line_is_squad_unit_effect(line, bab):
            continue
        for s, p in extract_stat_percent_char(line, chunk, char_id=char_id).items():
            if s in CHAR_STAT_ORDER:
                pct[s] += p
    return pct


def collect_supercharged_ex_stat_tiers(ac, char_id):
    """Per-tier EX % for abilities whose description contains Supercharged EX 1 and 2 (mutually exclusive in-game)."""
    merged = {}
    for bab in ac:
        if not bab.get('is_ex'):
            continue
        for d2 in bab.get('details', []) or []:
            txt = (d2.get('text') or '').strip()
            if not txt:
                continue
            slices = _slice_supercharged_ex_tier_sections(txt)
            if len(slices) < 2:
                continue
            for tier, label, chunk in slices:
                add_pct = _extract_supercharged_ex_tier_chunk_stat_pct(chunk, char_id, bab)
                if tier not in merged:
                    merged[tier] = {'label': label or '', 'ex_pct': {s: 0 for s in CHAR_STAT_ORDER}}
                for s in CHAR_STAT_ORDER:
                    merged[tier]['ex_pct'][s] += add_pct[s]
                if label and len(label) > len(merged[tier]['label'] or ''):
                    merged[tier]['label'] = label
    if len(merged) < 2:
        return []
    return [{'tier': t, 'label': _clean_supercharged_ex_tier_label(merged[t]['label']), 'ex_pct': dict(merged[t]['ex_pct'])} for t in sorted(merged.keys())]


def _strip_trailing_ex_markers_from_unit_title(name):
    s = (name or '').strip()
    if not s:
        return ''
    s = re.sub(r'\s*\(\s*EX\s*\)\s*$', '', s, flags=re.IGNORECASE)
    s = re.sub(r'（EX）\s*$', '', s)
    return s.strip()


def _unit_display_core_key(disp):
    return _strip_trailing_ex_markers_from_unit_title(str(disp or '').strip()).lower()


def _piloting_named_ex_fragment_from_trait_blob(txt):
    """Return (ms_title_fragment or None, prefer_ex_variant) for piloting-a-specific-(EX)-MS clauses."""
    if not txt or not isinstance(txt, str):
        return None, False
    t = txt.replace('\r', '')
    m = re.search(r'when\s+piloting\s+(.+?)\s*\(\s*EX\s*\)', t, re.IGNORECASE | re.DOTALL)
    if m:
        frag = re.sub(r'\s+', ' ', m.group(1)).strip()
        fl = frag.lower()
        if fl.startswith('units') or (fl.startswith('unit ') and 'specified' in fl):
            return None, False
        if 'specified tags' in fl or 'specified series' in fl:
            return None, False
        return frag, True
    ja_m = re.search(r'「([^」]+)」搭乗時', t)
    if ja_m:
        inner = _strip_trailing_ex_markers_from_unit_title(ja_m.group(1))
        return (inner or None), True
    return None, False


def _resolve_unit_id_from_pilot_display_fragment(fragment, ldc, prefer_ex_variant=False):
    """Match trait pilot clause to a unit using calc-lang display names (exact core title)."""
    if not fragment or not isinstance(ldc, dict):
        return None
    frag_key = _unit_display_core_key(fragment)
    if not frag_key:
        return None
    uim = ldc.get('unit_id_map') or {}
    utm = ldc.get('unit_text_map') or {}
    hits = []
    for uid_raw, lid in uim.items():
        uid = normalize_id(uid_raw)
        if uid == '0':
            continue
        disp = utm.get(lid)
        if not disp:
            continue
        if _unit_display_core_key(disp) == frag_key:
            hits.append((uid, str(disp).strip()))
    if not hits:
        return None
    if len(hits) == 1:
        return hits[0][0]
    if prefer_ex_variant:
        for uid, disp in hits:
            dl = disp.lower()
            if '(ex)' in dl or '（ex）' in disp:
                return uid
    return hits[0][0]


def _trait_blob_piloting_named_ex_unit_id(txt, ldc):
    frag, prefer_ex = _piloting_named_ex_fragment_from_trait_blob(txt)
    if not frag:
        return None
    return _resolve_unit_id_from_pilot_display_fragment(frag, ldc, prefer_ex_variant=prefer_ex)


def _add_char_trait_pct_to_buckets(bab, d2, u_map, c_map, pair_c_map, ex_map, pair_ex_map, carry_ref, char_id=None, ldc=None, trait_pair_unit_ids=None):
    """carry_ref[0] is True when a prior line/detail set up a conditional clause (e.g. 'When Vigor…' then stat line)."""
    if not isinstance(d2, dict):
        return
    txt = (d2.get('text') or '').strip()
    if not txt:
        return
    pair_uid = _trait_blob_piloting_named_ex_unit_id(txt, ldc) if ldc else None
    if pair_uid and trait_pair_unit_ids is not None:
        trait_pair_unit_ids.add(pair_uid)
    if _char_trait_text_is_support_defense_action(txt):
        carry_ref[0] = False
        return
    if bab.get('is_ex', False):
        if len(_slice_supercharged_ex_tier_sections(txt)) >= 2:
            carry_ref[0] = False
            return
        lines = [ln.strip() for ln in re.split(r'\r?\n+', txt) if ln.strip()]
        if not lines:
            lines = [txt]
        tgt_ex = pair_ex_map if pair_uid else ex_map
        for line in lines:
            if _char_trait_line_is_squad_unit_effect(line, bab):
                continue
            bonuses = extract_stat_percent_char(line, txt, char_id=char_id)
            if not bonuses:
                continue
            for s, p in bonuses.items():
                tgt_ex[s] += p
        return
    lines = [ln.strip() for ln in re.split(r'\r?\n+', txt) if ln.strip()]
    if not lines:
        return
    for line in lines:
        if _char_trait_line_is_squad_unit_effect(line, bab):
            if _is_conditional_stat_text(line) or _char_detail_is_conditional(d2, line):
                carry_ref[0] = True
            continue
        bonuses = extract_stat_percent_char(line, txt, char_id=char_id)
        if not bonuses:
            if _is_conditional_stat_text(line) or _char_detail_is_conditional(d2, line):
                carry_ref[0] = True
            continue
        if pair_uid:
            tgt = pair_c_map
        else:
            title_c = _char_trait_title_counts_as_conditional_bucket(bab)
            is_cond = title_c or carry_ref[0] or _char_detail_is_conditional(d2, txt) or _is_conditional_stat_text(line)
            tgt = c_map if is_cond else u_map
        for s, p in bonuses.items():
            tgt[s] += p
        carry_ref[0] = False


def _accumulate_character_trait_percent_buckets(ac, char_id=None, ldc=None):
    """Same rules as get_character: split unconditional / conditional non-EX / EX trait % (+ pair-gated pilot bonuses)."""
    if ldc is None:
        ldc = get_calc_lang_data() or {}
    spbn_u = {s: 0 for s in CHAR_STAT_ORDER}
    spbn_c = {s: 0 for s in CHAR_STAT_ORDER}
    spbn_pair = {s: 0 for s in CHAR_STAT_ORDER}
    spen = {s: 0 for s in CHAR_STAT_ORDER}
    spen_pair = {s: 0 for s in CHAR_STAT_ORDER}
    spbs_u = {s: 0 for s in CHAR_STAT_ORDER}
    spbs_c = {s: 0 for s in CHAR_STAT_ORDER}
    spbs_pair = {s: 0 for s in CHAR_STAT_ORDER}
    spes = {s: 0 for s in CHAR_STAT_ORDER}
    spes_pair = {s: 0 for s in CHAR_STAT_ORDER}
    trait_pair_unit_ids = set()
    for bab in ac:
        carry = [False]
        for d2 in bab.get('details', []):
            _add_char_trait_pct_to_buckets(bab, d2, spbn_u, spbn_c, spbn_pair, spen, spen_pair, carry, char_id, ldc, trait_pair_unit_ids)
        carry[0] = False
        sab = bab.get('sp_replacement', bab)
        for d2 in sab.get('details', []):
            _add_char_trait_pct_to_buckets(sab, d2, spbs_u, spbs_c, spbs_pair, spes, spes_pair, carry, char_id, ldc, trait_pair_unit_ids)
    return spbn_u, spbn_c, spbn_pair, spen, spen_pair, spbs_u, spbs_c, spbs_pair, spes, spes_pair, trait_pair_unit_ids


def _character_trait_pair_gate(char_id, trait_pair_unit_ids):
    """Whether CP pair-gated trait bonuses apply: recommend unit visible and listed in manual ∪ trait-derived pilot-(EX) ids."""
    rec = normalize_id(CHAR_RECOMMEND_UNIT_MAP.get(char_id, '0'))
    if rec != '0':
        ui = unit_info_map.get(rec)
        if not ui or entity_hidden_by_lr_schedule_lock(ui.get('schedule_id', '0')):
            rec = '0'
    pu = _char_pair_conditional_unit_ids(char_id) | set(trait_pair_unit_ids or ())
    ok = bool(pu) and rec != '0' and rec in pu
    return ok, pu, rec


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


def _unit_vigor_normal_baseline_stat_line(part):
    """Paired vigor traits: synthetic copy like 'When Vigor is Normal, increase ATK by 10%.' (_augment_bare_vigor_lines_next_to_supercharged).

    That tier is always active outside Supercharged; it must use the unconditional (stats_no_cond) bucket, not CP."""
    t = (part or '').strip()
    if not t:
        return False
    tl = t.lower()
    if 'when vigor is normal' in tl or 'when vigor is regular' in tl:
        return True
    if '戰意為一般' in t or '战意为一般' in t:
        return True
    if 'テンションが「超一撃」未満' in t:
        return True
    return False


def _unit_vigor_pair_bare_first_line_unconditional(ad, detail_idx, part):
    """Master pair: bare own-stat % on detail[0], Supercharged line on detail[1]. Tags set hc=True but the first row is still base vigor."""
    if detail_idx != 0:
        return False
    dets = [x for x in (ad.get('details') or []) if isinstance(x, dict)]
    if len(dets) < 2:
        return False
    t_next = (dets[1].get('text') or '').replace('\r', '')
    if 'supercharged' not in t_next.lower() and '超一擊' not in t_next and '超一撃' not in t_next:
        return False
    p = (part or '').strip()
    if re.match(
            r'^\s*Increase\s+(?:own\s+)?(ATK|Attack|DEF|Defense|Mobility|MOB|Move)\s+by\s+\d+%\s*\.?\s*$',
            p, re.I):
        return True
    if re.match(r'^\s*自身(攻擊力|防禦力|機動力|移動力)提升\d+%\s*$', p):
        return True
    if re.match(r'^\s*自身の(攻撃力|防禦力|機動力|移動力)が\d+%上昇\s*$', p):
        return True
    return False


_UNIT_BARE_UNCONDITIONAL_MS_STAT_PCT_LINE = re.compile(
    r'^\s*Increases?\s+(?:own\s+)?(?:squad\s+)?(?:MS\s+)?'
    r'(?:HP|Max HP|EN|Max EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move|Movement)\s+by\s+\d+%\s*\.?\s*$',
    re.IGNORECASE,
)


def _unit_bare_unconditional_ms_stat_percent_line(part, is_cond, ability_cond):
    """One always-on 'Increase … by N%' sentence can share an ability with rows that have ActiveConditionSetId.

    ep() sets hc=True when *any* detail carries structured tags, which incorrectly forced the bare line into the CP
    bucket (e.g. Increased ATK & Advantage: Principality of Zeon — first line is global +5% ATK)."""
    if is_cond or ability_cond:
        return False
    p = (part or '').strip()
    return bool(_UNIT_BARE_UNCONDITIONAL_MS_STAT_PCT_LINE.match(p))


def _unit_line_ms_stats_conditional_bucket(part, hc, ie, is_cond, ability_cond, ad=None, detail_idx=None):
    """Structured trait tags set hc=True for the whole ability; vigor-normal baseline % must still use the unconditional bucket."""
    if _unit_vigor_normal_baseline_stat_line(part):
        return False
    if ad is not None and detail_idx is not None and _unit_vigor_pair_bare_first_line_unconditional(ad, detail_idx, part):
        return False
    if _unit_bare_unconditional_ms_stat_percent_line(part, is_cond, ability_cond):
        return False
    return bool(hc or ie or is_cond or ability_cond)


def _parse_hp_or_above_atk_tiers_from_trait_text(txt):
    """Extract (threshold_pct, atk_bonus_pct) for HP-or-above ATK lines (EN/JA). Used to fix CP bucket split."""
    if not txt:
        return []
    t = txt.replace('\r', '')
    out = []
    for m in re.finditer(r'when\s+hp\s+is\s+(\d+)%\s+or\s+above', t, re.IGNORECASE):
        chunk = t[m.end():m.end() + 220]
        m2 = re.search(
            r'(?:increase(?:s)?\s+)?(?:own\s+)?(?:squad\s+)?(?:ms\s+)?atk\s+by\s+(\d+)%',
            chunk, re.IGNORECASE)
        if m2:
            out.append((int(m.group(1)), int(m2.group(1))))
    for m in re.finditer(r'hpが(\d+)%以上', t, re.IGNORECASE):
        chunk = t[m.end():m.end() + 220]
        m2 = re.search(r'攻撃力が(\d+)%上昇', chunk)
        if m2:
            out.append((int(m.group(1)), int(m2.group(1))))
    return out


def _unit_adjust_hp_condition_increased_atk_buckets(ad, spb, spc):
    """(HP conditions) Increased ATK: ability_cond forces lines into spc, stacking 75%/10% and 50%/5%.

    In-game only one tier applies at a time. At assumed full HP, stats_no_cond should use the highest
    threshold (10%); stats_with_cond should reflect the weakest tier (5%) via spb + spc net."""
    name = (ad.get('name') or '').strip()
    if not name:
        return
    nl = name.lower()
    if ('(hp conditions)' not in nl and 'hp条件' not in name.lower()
            and '體力條件' not in name and '体力条件' not in name):
        return
    if ('increased atk' not in nl and '攻撃力上昇' not in name
            and '攻擊力上昇' not in name):
        return
    chunks = []
    for d2 in ad.get('details', []) or []:
        if isinstance(d2, dict):
            chunks.append(d2.get('text') or '')
    blob = '\n'.join(chunks)
    tiers = _parse_hp_or_above_atk_tiers_from_trait_text(blob)
    if not tiers:
        return
    by_th = {}
    for th, pct in tiers:
        by_th[th] = max(by_th.get(th, 0), pct)
    uniq = sorted(by_th.items(), key=lambda x: -x[0])
    wrong = sum(p for _, p in uniq)
    atk_key = 'Attack'
    if spc.get(atk_key, 0) < wrong:
        return
    if len(uniq) == 1:
        lone = uniq[0][1]
        spc[atk_key] = spc.get(atk_key, 0) - lone
        spb[atk_key] = spb.get(atk_key, 0) + lone
        return
    hi_pct = uniq[0][1]
    lo_pct = uniq[-1][1]
    spc[atk_key] = spc.get(atk_key, 0) - wrong
    spb[atk_key] = spb.get(atk_key, 0) + hi_pct
    spc[atk_key] = spc.get(atk_key, 0) + (lo_pct - hi_pct)


def _extract_stat_percent_unit_cjk(text):
    """JA/TW/HK MS stat % lines (aligned with front-end _dcParseOptionPartBonuses)."""
    bonuses = {}
    if not text:
        return bonuses
    ja_map = {'最大HP': 'HP', '最大EN': 'EN', '攻撃力': 'Attack', '防御力': 'Defense', '機動力': 'Mobility', '移動力': 'Move'}
    ja_one = '(最大HP|最大EN|攻撃力|防御力|機動力|移動力)'
    for m in re.finditer(r'(?:自部隊の|自身の)' + ja_one + r'と' + ja_one + r'が(\d+)(%?)(上昇|減少)', text):
        v = int(m.group(3))
        if m.group(5) == '減少':
            v = -v
        for gi in (1, 2):
            k = ja_map.get(m.group(gi))
            if k:
                bonuses[k] = bonuses.get(k, 0) + v
    for m in re.finditer(r'(?:自部隊の|自身の)' + ja_one + r'が(\d+)(%?)(上昇|減少)', text):
        v = int(m.group(2))
        if m.group(4) == '減少':
            v = -v
        k = ja_map.get(m.group(1))
        if k:
            bonuses[k] = bonuses.get(k, 0) + v
    tw_map = {'最大HP': 'HP', '最大EN': 'EN', '攻擊力': 'Attack', '防禦力': 'Defense', '機動力': 'Mobility', '移動力': 'Move'}
    tw_one = '(最大HP|最大EN|攻擊力|防禦力|機動力|移動力)'
    for m in re.finditer(r'自身' + tw_one + r'及' + tw_one + r'(提升|減少)(\d+)(%?)', text):
        v = int(m.group(4))
        if m.group(3) == '減少':
            v = -v
        for gi in (1, 2):
            k = tw_map.get(m.group(gi))
            if k:
                bonuses[k] = bonuses.get(k, 0) + v
    for m in re.finditer(r'(?:自身所屬部隊|自身)' + tw_one + r'(提升|減少)(\d+)(%?)', text):
        v = int(m.group(3))
        if m.group(2) == '減少':
            v = -v
        k = tw_map.get(m.group(1))
        if k:
            bonuses[k] = bonuses.get(k, 0) + v
    return bonuses


def _extract_stat_percent_unit(text, skip_conditional=True):
    bonuses = {}
    sn = r"(?:HP|Max HP|EN|Max EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move|Movement)"
    if skip_conditional and _is_conditional_stat_text(text): return bonuses
    # "Increase own ATK and Critical Damage by 10%." — generic ({sn}) pattern fails on second stat; handle explicitly (EN / TW / HK / JA).
    mcd = re.search(
        r"Increases? (?:own )?(?:squad )?(?:MS )?(?:Attack|ATK) and Critical Damage by (\d+)%",
        text, re.IGNORECASE)
    if not mcd:
        mcd = re.search(r"自身攻擊力及爆擊損傷提升(\d+)%", text)
    if not mcd:
        mcd = re.search(r"自身の攻撃力とクリティカルダメージが(\d+)%上昇", text)
    if mcd:
        pct = int(mcd.group(1))
        up_to = re.search(r'[\(\s]up to (\d+)%', text, re.IGNORECASE)
        if up_to:
            pct = max(pct, int(up_to.group(1)))
        bonuses['Attack'] = bonuses.get('Attack', 0) + pct
        bonuses[UNIT_ABILITY_PASSIVE_CRIT_DMG_PCT_KEY] = bonuses.get(UNIT_ABILITY_PASSIVE_CRIT_DMG_PCT_KEY, 0) + pct
        return bonuses
    m = re.search(fr"Increases? (?:own )?(?:squad )?({sn})(?: and ({sn}))? by (\d+)%", text, re.IGNORECASE)
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
    else:
        for k, v in _extract_stat_percent_unit_cjk(text).items():
            bonuses[k] = bonuses.get(k, 0) + v
    return bonuses

def _unit_enemy_specified_tags_clause_part(part):
    """True for 'when enemies are from the specified tags' (not series). Those ATK/DEF bonuses apply in battle only."""
    low = (part or '').lower()
    if 'specified series' in low:
        return False
    return 'when enemies' in low and 'specified tag' in low

def _strip_enemy_tag_advantage_atk_def_if_following(part_stats, prev_clause):
    """When not handled by `_unit_enemy_tag_equal_atk_def_boost`: strip duplicate routing (legacy) or clear prev after strip."""
    if not prev_clause or not part_stats:
        return part_stats, False
    atk = part_stats.get('Attack')
    de = part_stats.get('Defense')
    if atk is not None and de is not None and atk == de:
        out = {k: v for k, v in part_stats.items() if k not in ('Attack', 'Defense')}
        return out, False
    return part_stats, prev_clause


def _unit_enemy_tag_equal_atk_def_boost(part_stats, prev_enemy_tag_clause):
    """True if this line is the equal ATK+DEF % bump that follows enemy specified-tags wording (battle condition).

    Those lines must go into the conditional passive bucket (`spc` / `stats_with_cond`) so the UI shows a CP toggle."""
    if not prev_enemy_tag_clause or not part_stats:
        return False
    atk = part_stats.get('Attack')
    de = part_stats.get('Defense')
    return atk is not None and de is not None and atk == de

def _extract_stat_flat_move(text, skip_conditional=True):
    """Extract flat Move/MOV/Movement bonus (e.g. 'Increase own MOV by 1' or 'by1')."""
    if skip_conditional and _is_conditional_stat_text(text): return 0
    m = re.search(r"Increases?\s+(?:own\s+)?(?:squad\s+)?(?:Move|Movement|MOV)\s+by\s*(\d+)(?!%)", text, re.IGNORECASE)
    return int(m.group(1)) if m else 0

def _extract_weapon_stat_percent_unit(text, skip_conditional=True):
    """Parse passive % bonuses that apply to weapon display (ACC, Critical, Power)."""
    bonuses = {}
    if skip_conditional and _is_conditional_stat_text(text):
        return bonuses
    tl = (text or '').strip()
    # "Increase own ACC and EVA by 5%" — ACC affects weapons; EVA does not
    m = re.search(r'Increases? own (ACC|Accuracy) and (EVA|EVADE|Evasion) by (\d+)%', tl, re.IGNORECASE)
    if m:
        bonuses['Accuracy'] = bonuses.get('Accuracy', 0) + int(m.group(3))
        return bonuses
    # "Increase own ACC and Critical by 5%"
    m = re.search(r'Increases? own (ACC|Accuracy) and (Critical|CRIT) by (\d+)%', tl, re.IGNORECASE)
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
    # Generic "Increases Accuracy/Critical/Power by N%" applies to weapon sheet display when parsed from unit
    # passives (e.g. Increased ACC LV) — additive with base ACC/CRIT/Power % in UI; do not exclude bare wording.
    sn = r"(?:ACC|Accuracy|Critical|CRIT|Crit\.?|Power)"
    m = re.search(fr'Increases? (?:own )?(?:squad )?({sn})(?: and ({sn}))? by (\d+)%', tl, re.IGNORECASE)
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

# Character id -> static URL for character list/detail only (images/portraits); units keep normal ub_/ms_ lookup.
MANUAL_CHARACTER_PORTRAIT_OVERRIDE = {
    '1305001200': '/static/images/portraits/' + quote('Easter Egg Mina.gif'),
}

def find_portrait(resource_ids, entity_id, portrait_folder_key, debug_label=''):
    """
    Find portrait using image_index.json merged with files on disk under static/images/portraits and
    static/images/unit_portraits (WebP and other uploads are picked up without regenerating the index).
    portrait_folder_key: e.g., 'images/portraits' or 'images/unit_portraits'
    Game files often use cb_<ResourceId>.webp (characters) or ub_/ms_ (units); ResourceId alone is not the filename.
    Prefers filenames without ' #' (space+hash) suffix for CDN compatibility.
    """
    eid_ov = normalize_id(entity_id) if entity_id else ''
    if portrait_folder_key == 'images/portraits' and eid_ov in MANUAL_CHARACTER_PORTRAIT_OVERRIDE:
        return MANUAL_CHARACTER_PORTRAIT_OVERRIDE[eid_ov]
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
            ub_pref = f'ub_{rle}.'
            ub_ok = [m for m in matches if m.lower().startswith(ub_pref)]
            if ub_ok:
                ub_ok.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, x.lower()))
                return ub_ok[0]
            ms_pref = f'ms_{rle}.'
            ms_ok = [m for m in matches if m.lower().startswith(ms_pref)]
            if ms_ok:
                ms_ok.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, x.lower()))
                return ms_ok[0]
            exact = [
                m for m in matches
                if m.lower().startswith(rle + '.') or m.lower() in (rle + '.webp', rle + '.png', rle + '.jpg', rle + '.jpeg')
            ]
            if exact:
                exact.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, x.lower()))
                return exact[0]
        clean = [m for m in matches if ' #' not in m]
        if not clean:
            return matches[0]
        clean.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, x.lower()))
        return clean[0]

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
    """Find trait/ability icon under images/Trait (and thum/). Uses index + on-disk files like portraits.

    Master `ResourceId` values (e.g. trait_11430103) match filenames; many WebP uploads are not in image_index.json.
    """
    if not resource_id or str(resource_id) == '0':
        return None
    rid = str(resource_id).strip()
    if not rid:
        return None
    rl = rid.lower()

    trait_files = _merged_index_disk('images/Trait')
    thum_files = _merged_index_disk('images/Trait/thum')

    def _exact_stem(files, stem_lower):
        for ext in ('.webp', '.png', '.jpg', '.jpeg'):
            want = stem_lower + ext
            for fn in files:
                if fn.lower() == want:
                    return fn
        return None

    hit = _exact_stem(trait_files, rl)
    if hit:
        return hit

    hit = _exact_stem(thum_files, f'thum_{rl}')
    if hit:
        return f'thum/{hit}'

    matches = [fn for fn in trait_files if rl in fn.lower()]
    if matches:
        matches.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, len(x)))
        return matches[0]

    matches = [fn for fn in thum_files if rl in fn.lower()]
    if matches:
        matches.sort(key=lambda x: (0 if x.lower().endswith('.webp') else 1, len(x)))
        return f'thum/{matches[0]}'

    return None


def _find_trait_thum_list_asset(resource_ids, entity_id):
    """images/Trait/thum/thum_<ResourceId>.* — list/grid prefers this over full cb_/ub_ portraits when present."""
    files = _merged_index_disk('images/Trait/thum')
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
    eid_ov = normalize_id(entity_id) if entity_id else ''
    if portrait_folder_key == 'images/portraits' and eid_ov in MANUAL_CHARACTER_PORTRAIT_OVERRIDE:
        return MANUAL_CHARACTER_PORTRAIT_OVERRIDE[eid_ov]
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
    """Find supporter thumbnail using images/Trait/thum (index + on-disk WebP)."""
    files = _merged_index_disk('images/Trait/thum')
    if not files:
        return None
    candidates = [str(resource_id).strip()] if resource_id and str(resource_id).strip() != '0' else []
    if supporter_id:
        candidates.append(str(supporter_id).strip())
    for rid in candidates:
        if not rid:
            continue
        rl = rid.lower()
        for fn in files:
            if rl in fn.lower():
                return f"/static/images/Trait/thum/{fn}"
    return None

def find_supporter_full_portrait(resource_id):
    """Find full supporter portrait (900x504) under images/Supporters (index + on-disk)."""
    if not resource_id or str(resource_id).strip() == '0':
        return None
    rid = str(resource_id).strip().lower()
    files = _merged_index_disk('images/Supporters')
    if not files:
        return None
    for ext in ('.webp', '.png', '.jpg', '.jpeg'):
        expected = f"sb_{rid}{ext}"
        for fn in files:
            if fn.lower() == expected:
                return f"/static/images/Supporters/{fn}"
    for fn in files:
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

# Dict keys in LANG_DATA whose values are language-id → display string maps. TW/HK/JA bundles often ship
# slightly behind EN after client updates; filling blanks from EN avoids empty titles in zh locales.
_LANG_DISPLAY_FALLBACK_KEYS = (
    'char_text_map', 'unit_text_map', 'supporter_text_map',
    'series_name_map', 'lang_text_map', 'lineage_lookup',
    'abil_name_map', 'abil_desc_map',
    'supporter_leader_text_map', 'supporter_active_text_map',
    'stage_text_map', 'tower_event_text_map', 'tower_stage_group_text_map', 'tower_stage_text_map', 'special_event_stage_text_map',
    'stage_master_text_map', 'stage_condition_text_map',
    'weapon_text_map', 'op_text_map',
)


def _is_blank_lang_display_val(val):
    if val is None:
        return True
    if isinstance(val, str):
        return not val.strip()
    return False


def _merge_flat_lang_display_maps(dst_ld, en_ld):
    for key in _LANG_DISPLAY_FALLBACK_KEYS:
        dm = dst_ld.get(key)
        sm = en_ld.get(key)
        if not isinstance(dm, dict) or not isinstance(sm, dict):
            continue
        for lid, val in sm.items():
            if _is_blank_lang_display_val(dm.get(lid)):
                dm[lid] = val


def _merge_skill_text_map_lang_fallback(dst_ld, en_ld):
    dm = dst_ld.get('skill_text_map')
    sm = en_ld.get('skill_text_map')
    if not isinstance(dm, dict) or not isinstance(sm, dict):
        return
    for key, src_entries in sm.items():
        if not isinstance(src_entries, list):
            continue
        cur = dm.get(key)
        if not isinstance(cur, list) or len(cur) == 0:
            dm[key] = [{'full_id': e.get('full_id'), 'text': e.get('text', '')} for e in src_entries if isinstance(e, dict)]
            continue
        have = {x.get('full_id') for x in cur if isinstance(x, dict)}
        for e in src_entries:
            if not isinstance(e, dict):
                continue
            fid = e.get('full_id')
            if fid and fid not in have:
                cur.append({'full_id': fid, 'text': e.get('text', '')})
                have.add(fid)
        cur.sort(key=lambda x: x.get('full_id', ''))


def _merge_tuple_label_lists_from_en(dst_ld, en_ld, list_key):
    """series_list / lineage_list: [(language_row_id, label), ...] used when suffix-matching ids."""
    dl = dst_ld.get(list_key)
    el = en_ld.get(list_key)
    if not isinstance(dl, list) or not isinstance(el, list):
        return
    have_nonempty = set()
    for item in dl:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            lid, val = item[0], item[1]
            if not _is_blank_lang_display_val(val):
                have_nonempty.add(str(lid))
    for item in el:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        lid, val = item[0], item[1]
        ls = str(lid)
        if ls not in have_nonempty and not _is_blank_lang_display_val(val):
            dl.append((lid, val))
            have_nonempty.add(ls)


def apply_en_lang_data_fallback(dst_ld, en_ld):
    """Fill blank localized strings using EN so zh/JA locales never show empty labels when EN has text."""
    if not dst_ld or not en_ld or dst_ld is en_ld:
        return
    _merge_flat_lang_display_maps(dst_ld, en_ld)
    _merge_skill_text_map_lang_fallback(dst_ld, en_ld)
    _merge_tuple_label_lists_from_en(dst_ld, en_ld, 'series_list')
    _merge_tuple_label_lists_from_en(dst_ld, en_ld, 'lineage_list')


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
            if rid != '0' and val:
                name_map[rid] = val
                # Legacy shortcut for AbilityId-style lookups; multiple detail ids can share the same
                # last-7 slice (e.g. 140100000202450100 vs 140100000202450103 → 2024501). First wins.
                if len(rid) > 9:
                    short = rid[:-2][-7:]
                    if short:
                        name_map.setdefault(short, val)
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

# m_trait_set_detail.json name row ids are 140100000 + m_trait_set.Id (see master TraitSetId / ability link).
TRAIT_SET_DETAIL_NAME_ID_PREFIX = '140100000'


def trait_set_detail_name_lang_id(trait_set_id):
    ts = normalize_id(trait_set_id)
    if not ts or ts == '0' or not ts.isdigit():
        return ''
    return f'{TRAIT_SET_DETAIL_NAME_ID_PREFIX}{ts}'


def resolve_ability_display_name_from_maps(ab_id, abil_name_map, abil_link_map):
    """Ability title from m_trait_set_detail via TraitSetId; avoids ambiguous 7-digit alias collisions."""
    aid = normalize_id(ab_id)
    if not aid or aid == '0':
        return None
    trait_set_id = normalize_id(abil_link_map.get(aid, aid))
    lookup_id = trait_set_id[:-2] if len(trait_set_id) > 2 else trait_set_id
    detail_nid = trait_set_detail_name_lang_id(trait_set_id)
    for key in (trait_set_id, detail_nid, lookup_id, aid):
        if not key:
            continue
        v = abil_name_map.get(key)
        if v:
            return v
    return None


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

def create_trait_condition_raw_map(d, key_field=None):
    raw = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        if key_field:
            sid = normalize_id(item.get(key_field) or item.get('Id') or item.get('id'))
        else:
            sid = normalize_id(item.get('TraitConditionSetId') or item.get('traitConditionSetId') or item.get('Id') or item.get('id'))
        if sid == '0': continue
        if sid not in raw: raw[sid] = {'char_tags': [], 'unit_tags': [], 'group_tags': [], 'series': [], 'character_series': [], 'types': [], 'target_types': [], 'unit_ids': [], 'character_ids': []}
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
        for key in ['CharacterSeries', 'characterSeries']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v != '0' and v not in raw[sid]['character_series']: raw[sid]['character_series'].append(v)
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
        for key in ['TargetTypes', 'targetTypes']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v not in raw[sid]['target_types']: raw[sid]['target_types'].append(v)
        for key in ['UnitIds', 'unitIds']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = normalize_id(v.strip())
                    if v and v != '0' and v not in raw[sid]['unit_ids']:
                        raw[sid]['unit_ids'].append(v)
        for key in ['CharacterIds', 'characterIds']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = normalize_id(v.strip())
                    if v and v != '0' and v not in raw[sid]['character_ids']:
                        raw[sid]['character_ids'].append(v)
    return raw

def merge_trait_condition_raw_maps(*maps):
    out = {}
    for mp in maps:
        if not isinstance(mp, dict):
            continue
        for sid, row in mp.items():
            if sid not in out:
                out[sid] = {'char_tags': [], 'unit_tags': [], 'group_tags': [], 'series': [], 'character_series': [], 'types': [], 'target_types': [], 'unit_ids': [], 'character_ids': []}
            for k in ['char_tags', 'unit_tags', 'group_tags', 'series', 'character_series', 'types', 'target_types', 'unit_ids', 'character_ids']:
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
    for s in raw.get('character_series') or []: n = fn(s, series_name_map); (n and at(s, n, 'series', 'character_series'))
    for t in raw.get('char_tags', []): n = fn(t, lineage_lookup, series_name_map); (n and at(t, n, 'character', 'char_tags'))
    for t in raw.get('group_tags', []): n = fn(t, lineage_lookup, series_name_map); (n and at(t, n, 'group', 'group_tags'))
    for s in raw.get('series', []): n = fn(s, series_name_map); (n and at(s, n, 'series', 'series'))
    rtm = UNIT_ROLE_TYPE_LANG_MAP.get(lang_code, UNIT_ROLE_TYPE_LANG_MAP['EN'])
    for t in raw.get('types', []): n = rtm.get(t); (n and at('role_' + t, n, 'unit_role', 'types'))
    seen_pair = set()
    ld = LANG_DATA.get(lang_code) or LANG_DATA.get(DEFAULT_LANG) or {}
    utm, uim = ld.get('unit_text_map') or {}, ld.get('unit_id_map') or {}
    ctm, cim = ld.get('char_text_map') or {}, ld.get('char_id_map') or {}
    for uid in raw.get('unit_ids') or []:
        uid = normalize_id(str(uid))
        if not uid or uid == '0':
            continue
        pk = ('u', uid)
        if pk in seen_pair:
            continue
        seen_pair.add(pk)
        ulid = uim.get(uid, '')
        nm = utm.get(ulid, '') if ulid else uid
        if not nm:
            nm = uid
        res.append({'id': uid, 'name': nm, 'type': 'unit', 'source': 'unit_ids'})
    for chid in raw.get('character_ids') or []:
        chid = normalize_id(str(chid))
        if not chid or chid == '0':
            continue
        pk = ('c', chid)
        if pk in seen_pair:
            continue
        seen_pair.add(pk)
        clid = cim.get(chid, '')
        nm = ctm.get(clid, '') if clid else chid
        if not nm:
            nm = chid
        res.append({'id': chid, 'name': nm, 'type': 'character', 'source': 'character_ids'})
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
        lookup[sid] = {'group1_set_id': normalize_id(item.get('Group1SortieRestrictionSetId') or item.get('group1SortieRestrictionSetId')), 'group2_set_id': normalize_id(item.get('Group2SortieRestrictionSetId') or item.get('group2SortieRestrictionSetId')), 'recommended_cp': safe_int(item.get('RecommendedCombatPower'), 0), 'terrain_type_index': normalize_id(item.get('StageTerrainTypeIndex') or item.get('stageTerrainTypeIndex')), 'battle_condition_set_id': normalize_id(item.get('StageBattleConditionSetId') or item.get('stageBattleConditionSetId')), 'schedule_id': normalize_id(item.get('ScheduleId') or item.get('scheduleId'), '0')}
    return lookup

def create_eternal_stage_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('StageId') or item.get('stageId') or item.get('Id') or item.get('id'))
        if sid == '0': continue
        lookup[sid] = {
            'stage_id': sid,
            'stage_number': safe_int(item.get('StageNumber'), 0),
            'stage_name_lang_id': normalize_id(item.get('StageNameLanguageId') or item.get('stageNameLanguageId')),
            'display_unit_id': normalize_id(item.get('DisplayUnitId') or item.get('displayUnitId')),
            'stage_difficulty_type_index': safe_int(item.get('StageDifficultyTypeIndex') or item.get('stageDifficultyTypeIndex'), 1),
            'strategy_info_schedule_id': normalize_id(item.get('StrategyInfoScheduleId') or item.get('strategyInfoScheduleId') or '0'),
        }
    return lookup

def create_stage_name_lang_lookup(stage_master):
    lk = {}
    for item in extract_data_list(stage_master):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('Id') or item.get('id'))
        if sid == '0': continue
        lk[sid] = normalize_id(item.get('StageNameLanguageId') or item.get('stageNameLanguageId'))
    return lk

def create_map_event_score_attack_stage_map(score_data, stage_master):
    name_by_stage = create_stage_name_lang_lookup(stage_master) if stage_master else {}
    lookup = {}
    seq = 0
    for item in extract_data_list(score_data):
        if not isinstance(item, dict): continue
        stid = normalize_id(item.get('StageId') or item.get('stageId'))
        if stid == '0': continue
        boss = normalize_id(item.get('BossMapNpcId') or item.get('bossMapNpcId'))
        snlid = name_by_stage.get(stid, '0')
        seq += 1
        lookup[stid] = {
            'boss_map_npc_id': boss,
            'stage_name_lang_id': snlid,
            'score_attack_row_id': normalize_id(item.get('Id') or item.get('id')),
            'list_seq': seq,
        }
    return lookup

def create_special_event_stage_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('StageId') or item.get('stageId'))
        if sid == '0': continue
        lookup[sid] = {
            'stage_id': sid,
            'row_id': normalize_id(item.get('Id') or item.get('id')),
            'special_event_group_id': normalize_id(item.get('SpecialEventGroupId') or item.get('specialEventGroupId')),
            'priority': safe_int(item.get('Priority'), 0),
            'stage_name_lang_id': normalize_id(item.get('StageNameLanguageId') or item.get('stageNameLanguageId')),
            'thumbnail_resource_id': str(item.get('ThumbnailResourceId') or item.get('thumbnailResourceId') or '').strip(),
        }
    return lookup

def create_tower_event_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        eid = normalize_id(item.get('EventId') or item.get('eventId') or item.get('Id') or item.get('id'))
        if eid == '0':
            continue
        lookup[eid] = {
            'event_id': eid,
            'update_info_language_id': normalize_id(item.get('UpdateInfoLanguageId') or item.get('updateInfoLanguageId')),
            'tower_event_stage_group_id': normalize_id(item.get('TowerEventStageGroupId') or item.get('towerEventStageGroupId')),
            'sort_order': safe_int(item.get('SortOrder') or item.get('sortOrder'), 0),
            'resource_id': str(item.get('ResourceId') or item.get('resourceId') or '').strip(),
        }
    return lookup

def create_tower_event_stage_group_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        gid = normalize_id(item.get('Id') or item.get('id'))
        if gid == '0':
            continue
        lookup[gid] = {
            'id': gid,
            'tower_name_lang_id': normalize_id(item.get('TowerNameLanguageId') or item.get('towerNameLanguageId')),
            'last_floor_tower_event_stage_id': normalize_id(item.get('LastFloorTowerEventStageId') or item.get('lastFloorTowerEventStageId')),
            'resource_id': str(item.get('ResourceId') or item.get('resourceId') or '').strip(),
        }
    return lookup

def create_tower_event_stage_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        tid = normalize_id(item.get('Id') or item.get('id'))
        if tid == '0':
            continue
        lookup[tid] = {
            'row_id': tid,
            'tower_event_stage_group_id': normalize_id(item.get('TowerEventStageGroupId') or item.get('towerEventStageGroupId')),
            'stage_id': normalize_id(item.get('StageId') or item.get('stageId')),
            'stage_name_lang_id': normalize_id(item.get('StageNameLanguageId') or item.get('stageNameLanguageId')),
            'floor_count': safe_int(item.get('FloorCount') or item.get('floorCount'), 0),
            'tower_event_stage_type_index': safe_int(item.get('TowerEventStageTypeIndex') or item.get('towerEventStageTypeIndex'), 0),
            'floor_bromide_unit_id': normalize_id(item.get('FloorBromideUnitId') or item.get('floorBromideUnitId')),
        }
    return lookup

def create_map_stage_meta_by_stage_id(d):
    """First m_map_stage row per StageId (for StageDifficultyTypeIndex when stage id is not 905x-prefixed)."""
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('StageId') or item.get('stageId'))
        if sid == '0' or sid in lk: continue
        lk[sid] = {
            'map_stage_id': normalize_id(item.get('Id') or item.get('id')),
            'map_id': normalize_id(item.get('MapId') or item.get('mapId')),
            'stage_difficulty_type_index': safe_int(item.get('StageDifficultyTypeIndex') or item.get('stageDifficultyTypeIndex'), 1),
        }
    return lk

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
        lk.setdefault(sid, []).append({
            'weapon_id': normalize_id(item.get('WeaponId') or item.get('weaponId')),
            'power': safe_int(item.get('Power'), 0), 'en': safe_int(item.get('En'), 0),
            'hit_rate': safe_int(item.get('HitRate'), 0), 'critical_rate': safe_int(item.get('CriticalRate'), 0),
            'range_min': safe_int(item.get('RangeMin'), 0), 'range_max': safe_int(item.get('RangeMax'), 0),
            'trait_set_id': normalize_id(item.get('MapNpcWeaponTraitSetId') or item.get('mapNpcWeaponTraitSetId') or '0'),
            'override_ammo': safe_int(item.get('OverrideAmmoCapacity'), 0),
            'sort_order': safe_int(item.get('SortOrder'), 0),
        })
    for k in lk: lk[k].sort(key=lambda x: x['sort_order'])
    return lk

def create_map_npc_weapon_trait_set_lookup(d):
    """MapNpcWeaponTraitSetId -> ordered WeaponTraitId list (m_map_npc_unit_weapon_trait_set_content)."""
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('MapNpcWeaponTraitSetId') or item.get('mapNpcWeaponTraitSetId'))
        tid = normalize_id(item.get('WeaponTraitId') or item.get('weaponTraitId'))
        if sid == '0' or tid == '0': continue
        sort = safe_int(item.get('SortOrder'), 0)
        lk.setdefault(sid, []).append({'id': tid, 'sort': sort})
    for k in lk:
        lk[k].sort(key=lambda x: x['sort'])
        lk[k] = [x['id'] for x in lk[k]]
    return lk

def _weapon_trait_detail_lookup_text(wtdm, tid):
    if not tid or tid == '0':
        return ''
    m = wtdm or {}
    txt = m.get(tid, '')
    if txt:
        return str(txt)
    for k, v in m.items():
        if k == tid or (len(tid) >= 6 and str(k).endswith(tid)):
            return str(v or '')
    return ''

def _apply_map_npc_weapon_row_stats(levels, row, base_levels):
    """Apply m_map_npc_unit_weapon_set_content Power/En/Hit/Crit per level (Lv5 matches row; lower levels follow growth curve)."""
    if not levels or not base_levels or len(levels) != len(base_levels):
        return
    i5 = min(4, len(base_levels) - 1)
    b5 = base_levels[i5]

    def apply_key(row_key, lev_key):
        if row.get(row_key) is None:
            return
        rv = safe_int(row.get(row_key), 0)
        b5v = b5.get(lev_key)
        b5v = 0 if b5v is None else b5v
        for i, lev in enumerate(levels):
            bi = base_levels[i]
            bv = bi.get(lev_key)
            bv = 0 if bv is None else bv
            if b5v > 0:
                lev[lev_key] = max(0, int(round(rv * bv / b5v)))
            else:
                lev[lev_key] = max(0, int(rv))

    apply_key('power', 'power')
    apply_key('en', 'en')
    apply_key('hit_rate', 'accuracy')
    apply_key('critical_rate', 'critical')

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

def _char_support_counter_atk_excluded_from_dossier_stats(full_text):
    """Support Attack/Counter ATK% lines are combat-only; do not add to dossier pilot Ranged/Melee % totals."""
    if not full_text or not isinstance(full_text, str):
        return False
    tl = full_text.lower()
    support_ctx = (
        'support attack/counter' in tl
        or '支援攻擊' in full_text
        or '支援反擊' in full_text
        or '支援攻撃' in full_text
        or '支援反撃' in full_text
    )
    if not support_ctx:
        return False
    atk_pct = bool(re.search(r'increases?\s+atk\b', tl))
    atk_pct = atk_pct or '攻擊力' in full_text or '攻击力' in full_text or '攻撃力' in full_text
    return atk_pct


def _extract_char_dossier_decrease_pct_en(text):
    """EN lines like \"but decrease Defense by 25%\" paired with vigor / conditional buffs."""
    bonuses = {}
    if not text or not isinstance(text, str):
        return bonuses
    stat_alt = r'(?:Defense|Reaction|Awaken|Melee|Ranged)'
    pat = re.compile(
        rf'\b(?:but\s+|,\s*)?(?:decrease(?:s)?|reduce(?:s)?)\s+(?:own\s+)?({stat_alt}(?:\s+and\s+{stat_alt})*)\s+by\s*(\d+)%',
        re.IGNORECASE)
    canon = {'defense': 'Defense', 'reaction': 'Reaction', 'awaken': 'Awaken', 'melee': 'Melee', 'ranged': 'Ranged'}
    for m in pat.finditer(text):
        pct = int(m.group(2))
        chunk = m.group(1)
        parts = re.split(r'\s+and\s+', chunk, flags=re.IGNORECASE)
        for raw in parts:
            key = canon.get((raw or '').strip().lower())
            if key:
                bonuses[key] = bonuses.get(key, 0) - pct
    return bonuses


def _extract_stat_percent_char_cjk(text):
    """Pilot stat % for map NPCs / traits in JA and TW/HK (EN handled by extract_stat_percent_char)."""
    bonuses = {}
    if not text:
        return bonuses
    ja_map = {'射撃値': 'Ranged', '格闘値': 'Melee', '覚醒値': 'Awaken', '回避値': 'Reaction', '防御力': 'Defense'}
    ja_one = '(射撃値|格闘値|覚醒値|回避値|防御力)'
    for m in re.finditer(r'自身の' + ja_one + r'と' + ja_one + r'が(\d+)%上昇', text):
        p = int(m.group(3))
        for gi in (1, 2):
            k = ja_map.get(m.group(gi))
            if k:
                bonuses[k] = bonuses.get(k, 0) + p
    for m in re.finditer(r'自身の' + ja_one + r'が(\d+)%上昇', text):
        p = int(m.group(2))
        k = ja_map.get(m.group(1))
        if k:
            bonuses[k] = bonuses.get(k, 0) + p
    zh_map = {'射擊值': 'Ranged', '格鬥值': 'Melee', '覺醒值': 'Awaken'}
    mc = re.search(r'自身(射擊值|格鬥值|覺醒值)((?:及(?:射擊值|格鬥值|覺醒值))*)提升(\d+)%', text)
    if mc:
        p = int(mc.group(3))
        k0 = zh_map.get(mc.group(1))
        if k0:
            bonuses[k0] = bonuses.get(k0, 0) + p
        rest = mc.group(2) or ''
        for mm in re.finditer(r'及(射擊值|格鬥值|覺醒值)', rest):
            kk = zh_map.get(mm.group(1))
            if kk:
                bonuses[kk] = bonuses.get(kk, 0) + p
    for mm in re.finditer(r'自身射擊值提升(\d+)%', text):
        bonuses['Ranged'] = bonuses.get('Ranged', 0) + int(mm.group(1))
    for mm in re.finditer(r'自身格鬥值提升(\d+)%', text):
        bonuses['Melee'] = bonuses.get('Melee', 0) + int(mm.group(1))
    for mm in re.finditer(r'自身覺醒值提升(\d+)%', text):
        bonuses['Awaken'] = bonuses.get('Awaken', 0) + int(mm.group(1))
    return bonuses


def extract_stat_percent_char(text, full_detail_text=None, char_id=None):
    bonuses = {}; tl = text.lower()
    for kw in ['when piloting','when supporting','when executing','if vigor']:
        if kw in tl: return bonuses
    # MS combat lines use abbreviated ATK/DEF (word boundary so pilot "own Defense" is not skipped).
    if re.search(r'\bown\s+atk\b', tl) or re.search(r'\bown\s+attack\b', tl):
        return bonuses
    if re.search(r'\bown\s+def\b', tl):
        return bonuses
    # Triple: "Increase own Critical Rate, Melee, and Reaction by 20%" (Supercharged EX; Critical is not a dossier stat).
    m3 = re.search(
        r"Increases? own Critical Rate,\s*(Melee|Ranged|Awaken)\s*,\s*and\s+(Melee|Ranged|Defense|Reaction|Awaken)\s+by\s*(\d+)%",
        text, re.IGNORECASE)
    if m3:
        p = int(m3.group(3))
        for gi in (1, 2):
            raw = m3.group(gi)
            if not raw:
                continue
            n = raw.title()
            bonuses[n] = bonuses.get(n, 0) + p
        return bonuses
    # "Increase" alone matches only the 7-letter prefix of "increases", leaving a stray "s" — use Increases?
    m = re.search(r"Increases? (?:own )?(Melee|Ranged|Range|Defense|Reaction|Awaken|ATK|DEF)(?: and (Melee|Ranged|Range|Defense|Reaction|Awaken|ATK|DEF))? by\s*(\d+)%", text, re.IGNORECASE)
    if m:
        p = int(m.group(3))
        for s in [m.group(1), m.group(2)]:
            if not s:
                continue
            u = s.title().upper()
            # Bare EN "ATK/Attack" often means combined pilot shooting/fighting on buff cards.
            # Same trait blob must not treat squad/per-unit MS ATK as dossier Ranged/Melee (_blob_has_squad_unit_stat_context).
            if u in ("ATK", "ATTACK"):
                ctx = full_detail_text if full_detail_text is not None else text
                # Support Attack/Counter ATK% is not part of dossier pilot Ranged/Melee (in-combat only).
                if _char_support_counter_atk_excluded_from_dossier_stats(ctx):
                    continue
                # Squad/per-allied-unit "ATK" is the MS attack stat; pilots have Ranged/Melee on the dossier, not ATK.
                if _blob_has_squad_unit_stat_context(ctx):
                    continue
                bonuses["Melee"] = bonuses.get("Melee", 0) + p
                bonuses["Ranged"] = bonuses.get("Ranged", 0) + p
            elif u == "DEF":
                bonuses["Defense"] = bonuses.get("Defense", 0) + p
            elif u == "RANGE":
                bonuses["Ranged"] = bonuses.get("Ranged", 0) + p
            else:
                n = s.title()
                bonuses[n] = bonuses.get(n, 0) + p
    else:
        for k, v in _extract_stat_percent_char_cjk(text).items():
            bonuses[k] = bonuses.get(k, 0) + v
    for k, v in _extract_char_dossier_decrease_pct_en(text).items():
        bonuses[k] = bonuses.get(k, 0) + v
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
                body_type = normalize_id(item.get('UnitBodyTypeIndex') or item.get('unitBodyTypeIndex'), '1')
                oaid = item.get('OccupiedAreaId') if item.get('OccupiedAreaId') is not None else item.get('occupiedAreaId')
                occupied_area_id = safe_int(oaid, 1)
                if occupied_area_id < 1:
                    occupied_area_id = 1
                main_uid = normalize_id(item.get('MainUnitId') or item.get('mainUnitId') or uid)
                if main_uid == '0':
                    main_uid = uid
                lookup[uid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'model': str(item.get('ModelNumber') or item.get('modelNumber') or ''), 'series_set': normalize_id(item.get('SeriesSetId') or item.get('seriesSetId')), 'terrain_set': normalize_id(item.get('TerrainCapabilitySetId') or item.get('terrainCapabilitySetId')), 'mechanism_set_id': normalize_id(item.get('MechanismSetId') or item.get('mechanismSetId')), 'profile_lang_id': normalize_id(item.get('ProfileLanguageId') or item.get('profileLanguageId') or '0'), 'is_ultimate': is_ult, 'acquisition_route': acq, 'bromide_resource_id': bid, 'resource_ids': rids, 'recommend_character_id': rec_cid, 'body_type': body_type, 'schedule_id': normalize_id(item.get('ScheduleId') or item.get('scheduleId'), '0'), 'occupied_area_id': occupied_area_id, 'main_unit_id': main_uid}
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
    mcd = re.search(
        r"Increases? (?:own )?(?:squad )?(?:MS )?(?:Attack|ATK) and Critical Damage by (\d+)%",
        text, re.IGNORECASE)
    if not mcd:
        mcd = re.search(r"自身攻擊力及爆擊損傷提升(\d+)%", text)
    if not mcd:
        mcd = re.search(r"自身の攻撃力とクリティカルダメージが(\d+)%上昇", text)
    if mcd:
        pct = int(mcd.group(1))
        b_atk = math.floor(fs.get('Attack', 0) * pct / 100)
        bonuses['Attack'] = bonuses.get('Attack', 0) + b_atk
        return bonuses
    sn = r"(?:HP|Max HP|EN|Max EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move|Movement)"
    m = re.search(fr"Increases? (?:own )?({sn})(?: and ({sn}))? by (\d+)%", text, re.IGNORECASE)
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
            wsid = normalize_id(item.get('WeaponStatusId') or item.get('weaponStatusId'))
            if wsid == '0':
                wsid = wid
            lookup[wid] = {'name_lang_id': normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId')), 'attribute': normalize_id(item.get('WeaponAttributeSetId') or item.get('weaponAttributeSetId')), 'weapon_type': normalize_id(item.get('WeaponTypeIndex') or item.get('weaponTypeIndex'), '1'), 'main_weapon_id': normalize_id(item.get('MainWeaponId') or item.get('mainWeaponId')), 'weapon_status_id': wsid, 'attack_attribute': normalize_id(item.get('AttackAttributeSetId') or item.get('attackAttributeSetId')), 'capability_set_id': normalize_id(item.get('WeaponCapabilitySetId') or item.get('weaponCapabilitySetId')), 'tension_type': normalize_id(item.get('TensionTypeIndex') or item.get('tensionTypeIndex'), '0'), 'map_range_type': normalize_id(item.get('MapWeaponRangeTypeIndex') or item.get('mapWeaponRangeTypeIndex'), '0'), 'hp_cost_rate': hp_cost}
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

MAP_FOOTPRINT_2X2_DXDY = ((0, 0), (1, 0), (0, -1), (1, -1))


def minkowski_map_coords_with_2x2_footprint(coords):
    """Union of base cells translated by 2×2 unit footprint (anchor-relative)."""
    if not coords:
        return coords
    seen = set()
    out = []
    for c in coords:
        for dx, dy in MAP_FOOTPRINT_2X2_DXDY:
            nx, ny = c['x'] + dx, c['y'] + dy
            if (nx, ny) not in seen:
                seen.add((nx, ny))
                out.append({'x': nx, 'y': ny})
    return out


def augment_map_coords_for_occupied_area_2(coords, unit_id):
    """Add tiles for 2×2 units (m_unit OccupiedAreaId 2): each row gets (max_x + 1, y) if missing."""
    if not coords:
        return coords
    uid = normalize_id(unit_id) if unit_id else '0'
    if uid == '0':
        return coords
    info = unit_info_map.get(uid) or {}
    if safe_int(info.get('occupied_area_id'), 1) != 2:
        return coords
    out = [{'x': c['x'], 'y': c['y']} for c in coords]
    seen = {(c['x'], c['y']) for c in out}
    by_y = {}
    for c in out:
        by_y.setdefault(c['y'], []).append(c['x'])
    for y, xs in sorted(by_y.items()):
        nx, ny = max(xs) + 1, y
        if (nx, ny) not in seen:
            seen.add((nx, ny))
            out.append({'x': nx, 'y': ny})
    return out


def augment_map_shooting_dual_line_for_occupied_area_2(scc, unit_id):
    """MAP dash line weapons: duplicate a single-column shooting path at x+1 for 2×2 units (two lanes)."""
    if not scc or len(scc) < 2:
        return scc, False
    uid = normalize_id(unit_id) if unit_id else '0'
    if uid == '0':
        return scc, False
    info = unit_info_map.get(uid) or {}
    if safe_int(info.get('occupied_area_id'), 1) != 2:
        return scc, False
    xs_set = {c['x'] for c in scc}
    if len(xs_set) != 1:
        return scc, False
    x0 = next(iter(xs_set))
    out = [{'x': c['x'], 'y': c['y']} for c in scc]
    seen = {(c['x'], c['y']) for c in out}
    for c in scc:
        nx, ny = x0 + 1, c['y']
        if (nx, ny) not in seen:
            seen.add((nx, ny))
            out.append({'x': nx, 'y': ny})
    return out, True


# GP03 dual-line MAP: 2×2 landing band above the path (path tops out at y=4 in master data).
MAP_GP03_DASH_END_COORDS = ((0, 5), (1, 5), (0, 6), (1, 6))


def append_gp03_map_dash_end_cells(scc, unit_id, map_dash_dual_wide):
    """Append 2×2 end tiles (0,5)(1,5)(0,6)(1,6) for GP03 dual-line dash MAP."""
    if not map_dash_dual_wide or not scc:
        return scc
    uid = normalize_id(unit_id) if unit_id else '0'
    if uid not in ('1060000500', '1060000550'):
        return scc
    out = [{'x': c['x'], 'y': c['y']} for c in scc]
    seen = {(c['x'], c['y']) for c in out}
    for nx, ny in MAP_GP03_DASH_END_COORDS:
        if (nx, ny) not in seen:
            seen.add((nx, ny))
            out.append({'x': nx, 'y': ny})
    return out


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
            lookup.setdefault(sid, {})[lv] = {
                'power_rate': int(item.get('PowerCorrectionRate') or item.get('powerCorrectionRate') or 100),
                'en_rate': int(item.get('EnCorrectionRate') or item.get('enCorrectionRate') or 100),
                'hit_rate': int(item.get('HitRateCorrectionRate') or item.get('hitRateCorrectionRate') or 100),
                'crit_rate': int(item.get('CriticalRateCorrectionRate') or item.get('criticalRateCorrectionRate') or 100),
                'map_ammo': int(item.get('MapWeaponAmmoCapacity') or item.get('mapWeaponAmmoCapacity') or 0),
                'mp_consumption': int(item.get('MpConsumptionValue') or item.get('mpConsumptionValue') or 0),
                'hp_consumption_rate': int(item.get('HpConsumptionRate') or item.get('hpConsumptionRate') or 0),
                'hp_recovery_rate': int(item.get('HpRecoveryRate') or item.get('hpRecoveryRate') or 0),
                'en_recovery_rate': int(item.get('EnRecoveryRate') or item.get('enRecoveryRate') or 0),
                'mp_recovery': int(item.get('MpRecoveryValue') or item.get('mpRecoveryValue') or 0),
            }
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


def mechanism_list_filter_rows_from_ids(mids_union, ld):
    """Labels/icons for unit browse mechanism filter — same ids as MECH_MAP_TABLE."""
    rows = []
    for mid in mids_union:
        mid = str(mid)
        if mid == '2x2':
            rows.append({'id': '2x2', 'name': '2x2', 'icon': '/static/images/mechanism/mechanism_0002.webp'})
            continue
        mm = ld.get('mechanism_map', {})
        hit = None
        for rmm in mm.get(mid, []):
            if str(rmm.get('id')) == str(mid):
                hit = rmm
                break
        if hit:
            icf = find_mechanism_icon(hit.get('resource_id', ''))
            icon = f"/static/images/mechanism/{icf}" if icf else ''
            rows.append({'id': mid, 'name': (hit.get('name') or '').strip() or mid, 'icon': icon})
        else:
            rows.append({'id': mid, 'name': mid, 'icon': ''})
    rows.sort(key=lambda x: (x.get('name') or '').lower())
    return rows


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

def resolve_weapon_icon(wt, ai, ubr, extra_ex_icon_candidates=None, wid=None, unit_id=None):
    wts = str(wt) if wt is not None else ''
    if wts == '3':
        if is_map_weapon_after_move_unit_weapon(unit_id, wid, wts):
            return {'icon': game_image_public_url(MAP_WEAPON_AFTER_MOVE_ICON), 'overlay': '', 'is_ex': False, 'is_map': True}
        if is_map_weapon_blue_battle_ui(unit_id, wid, wts):
            return {'icon': game_image_public_url(MAP_WEAPON_BLUE_BATTLE_UI_ICON), 'overlay': '', 'is_ex': False, 'is_map': True}
        return {'icon': MAP_WEAPON_ICON, 'overlay': '', 'is_ex': False, 'is_map': True}
    if wts == '2':
        cands = []
        if ubr:
            cands.append(str(ubr).strip())
        if isinstance(extra_ex_icon_candidates, (list, tuple)):
            for x in extra_ex_icon_candidates:
                s = str(x).strip() if x is not None else ''
                if s and s != '0' and s not in cands:
                    cands.append(s)
        tf = None
        for cand in cands:
            tf = find_trait_icon(cand)
            if tf:
                break
        return {'icon': f"/static/images/Trait/{tf}" if tf else '', 'overlay': EX_WEAPON_OVERLAY, 'is_ex': True, 'is_map': False}
    ai2 = WEAPON_ATTR_MAP.get(ai, {'label':'Unknown','icon':''})
    return {'icon': ai2['icon'], 'overlay': '', 'is_ex': False, 'is_map': False}

def resolve_weapon_stats(wm, wsm, wcm, wtm, wcam, gpm, wtcm, wtdm, wid='', lang_code='EN', unit_id=''):
    mwid = wm.get('main_weapon_id','0'); csid = wm.get('capability_set_id','0')
    tt = wm.get('tension_type','0'); wt = wm.get('weapon_type','1')
    zl = [{'level':i,'power':0,'en':0,'accuracy':0,'critical':0,'ammo':0,'traits':[]} for i in range(1,6)]
    dr = {'range_min':0,'range_max':0,'power':0,'en':0,'accuracy':0,'critical':0,'ammo':0,'traits':[],'levels':zl,'usage_restrictions':[],'map_coords':[],'shooting_coords':[],'is_dash':False,'map_dash_dual_wide':False,'map_dash_dual_end_coords':[],'map_single_pou':False}
    wid_norm = normalize_id(wid) if wid else '0'
    wsid = normalize_id(wm.get('weapon_status_id') or '0')
    if wsid == '0':
        wsid = wid_norm
    # Use m_weapon.WeaponStatusId (or weapon id) for m_weapon_status rows. Do not prefer MainWeaponId:
    # transform alternates share MainWeaponId with the base weapon but have their own status (lower power, etc.).
    tid = '0'
    if wsid != '0' and wsm.get(wsid):
        tid = wsid
    elif wid_norm != '0' and wsm.get(wid_norm):
        tid = wid_norm
    elif mwid != '0' and wsm.get(mwid):
        tid = mwid
    else:
        tid = wsid if wsid != '0' else wid_norm
    if tid == '0': return dr
    ws = wsm.get(tid)
    if not ws: return dr
    bp,be,bh,bc = ws.get('power',0),ws.get('en',0),ws.get('hit_rate',0),ws.get('critical_rate',0)
    rn,rx = ws.get('range_min',0),ws.get('range_max',0)
    csi = ws.get('override_correction_id','0'); tsi = ws.get('trait_correction_id','0'); gi = ws.get('growth_pattern_id','0')
    gd = {}; ug = gi and gi != '0'
    if ug: gd = gpm.get(gi, {})
    def def_corr():
        return {
            'power_rate': 100, 'en_rate': 100, 'hit_rate': 100, 'crit_rate': 100, 'map_ammo': 0,
            'mp_consumption': 0, 'hp_consumption_rate': 0, 'hp_recovery_rate': 0, 'en_recovery_rate': 0, 'mp_recovery': 0,
        }
    btl = []
    fids = []
    if wid and wid != '0': fids.extend([wid, wid[:-2] if len(wid) > 2 else None, wid[:-4] if len(wid) > 4 else None])
    if tid and tid != '0' and tid != wid: fids.extend([tid, tid[:-2] if len(tid) > 2 else None])
    for k in fids:
        if k and wtm.get(k): btl = wtm[k]; break
    levels = []
    usage_corr = def_corr()
    for lv in range(1, 6):
        corr = def_corr()
        spi = '0'
        if csi and csi != '0': spi = csi
        elif ug: spi = gd.get('status_change_set_id','0')
        if spi != '0':
            pc = wcm.get(spi, {})
            lv_corr = pc.get(lv) if isinstance(pc, dict) else None
            if lv_corr: corr = {**def_corr(), **lv_corr}
        if lv == 5:
            usage_corr = corr
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
    wts = str(wt) if wt is not None else ''
    if wts != '3':
        for lev in levels:
            lev['ammo'] = 0
    rest = []
    widn = normalize_id(wid) if wid else '0'
    after_move_map = is_map_weapon_after_move_unit_weapon(unit_id, wid, wts)
    if wts == '3' and not after_move_map:
        rest.append(get_ui_label(lang_code, 'restriction_before_moving'))
    if tt == '4': rest.append(get_ui_label(lang_code, 'restriction_tension_max'))
    pat_mpc = int(usage_corr.get('mp_consumption', 0) or 0)
    mpc = pat_mpc if pat_mpc > 0 else MP_CONSUMPTION_WEAPON_IDS.get(wid, 0)
    if mpc <= 0 and unit_id in MP_CONSUMPTION_UNIT_EX and wts == '2': mpc = MP_CONSUMPTION_UNIT_EX[unit_id]
    if mpc > 0 and not after_move_map:
        rest.append(get_ui_label(lang_code, 'restriction_mp').format(mpc))
    pat_hp = int(usage_corr.get('hp_consumption_rate', 0) or 0)
    hp_rate = int(wm.get('hp_cost_rate', 0) or 0)
    if pat_hp > 0:
        hp_rate = pat_hp
    if hp_rate <= 0 and unit_id in HP_CONSUMPTION_UNIT_EX and wts == '2': hp_rate = HP_CONSUMPTION_UNIT_EX[unit_id]
    if hp_rate > 0: rest.append(get_ui_label(lang_code, 'restriction_hp').format(hp_rate))
    rh = int(usage_corr.get('hp_recovery_rate', 0) or 0)
    if rh > 0:
        rest.append(get_ui_label(lang_code, 'restriction_recover_hp').format(rh))
    re_en = int(usage_corr.get('en_recovery_rate', 0) or 0)
    if re_en > 0:
        rest.append(get_ui_label(lang_code, 'restriction_recover_en').format(re_en))
    rmp = int(usage_corr.get('mp_recovery', 0) or 0)
    if rmp > 0:
        rest.append(get_ui_label(lang_code, 'restriction_recover_mp').format(rmp))
    if csid != '0':
        ct = wcam.get(csid, "None")
        if ct and ct != "None": rest.append(ct)
    if after_move_map:
        mpc_am = pat_mpc if pat_mpc > 0 else mpc
        rest.append(get_ui_label(lang_code, 'restriction_mp').format(mpc_am))
    mc = ws.get('map_coords', []); scc = ws.get('shooting_coords', []); isd = ws.get('is_dash', False)
    map_dash_dual_wide = False
    map_dash_dual_end_coords = []
    map_single_pou = False
    uidn = normalize_id(unit_id) if unit_id else '0'
    if wts == '3':
        if uidn == '1001002700':
            mc = minkowski_map_coords_with_2x2_footprint([dict(c) for c in (ws.get('map_coords') or [])])
            map_single_pou = True
        else:
            mc = augment_map_coords_for_occupied_area_2(mc, unit_id)
        scc, map_dash_dual_wide = augment_map_shooting_dual_line_for_occupied_area_2(scc, unit_id)
        if not map_dash_dual_wide:
            scc = augment_map_coords_for_occupied_area_2(scc, unit_id)
        else:
            scc = append_gp03_map_dash_end_cells(scc, unit_id, map_dash_dual_wide)
            if uidn in ('1060000500', '1060000550'):
                map_dash_dual_end_coords = [{'x': x, 'y': y} for x, y in MAP_GP03_DASH_END_COORDS]
        isd = bool(mc and scc and len(mc) == len(scc) and {(c['x'], c['y']) for c in mc} == {(c['x'], c['y']) for c in scc})
        if map_dash_dual_wide:
            isd = True
    l5 = levels[4] if len(levels) >= 5 else levels[-1] if levels else {}
    return {'range_min':rn,'range_max':rx,'power':l5.get('power',0),'en':l5.get('en',0),'accuracy':l5.get('accuracy',0),'critical':l5.get('critical',0),'ammo':l5.get('ammo',0),'traits':l5.get('traits',[]),'levels':levels,'usage_restrictions':rest,'map_coords':mc,'shooting_coords':scc,'is_dash':isd,'map_dash_dual_wide': map_dash_dual_wide,'map_dash_dual_end_coords': map_dash_dual_end_coords,'map_single_pou': map_single_pou}

def get_ability_name_for_search(ab_id, abil_name_map, abil_link_map):
    if not ab_id or normalize_id(ab_id) == '0':
        return ''
    return resolve_ability_display_name_from_maps(ab_id, abil_name_map, abil_link_map) or ''

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

def collect_unit_model_search_text(info):
    """Model number only for list search (profile / collection-book flavor text is not searchable)."""
    m = info.get('model') or ''
    return str(m).strip() if m else ''

def collect_unit_mechanism_search_text(info, ld, uid=None):
    """Mechanism names and descriptions for list search."""
    msid = str(info.get('mechanism_set_id', '0'))
    mids = [m for m in MECH_MAP_TABLE.get(msid, []) if m != '2x2']
    if safe_int(info.get('occupied_area_id'), 1) == 2:
        mids.append('2x2')
    if _unit_has_sd_mechanism(info, uid) and '3' not in mids:
        mids.append('3')
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


def _augment_bare_vigor_lines_next_to_supercharged(details, lang_code):
    """Pair traits use a bare stat line (normal vigor) + a Supercharged line. The bare line has no
    vigor wording in master data; add explicit normal-vigor scope so both +X% lines read clearly."""
    if not details or len(details) < 2:
        return
    lc = (lang_code or 'EN').upper()

    def _pct_in_text(pct, blob):
        return bool(re.search(rf'(?:{re.escape(pct)})\s*%', blob))

    for i in range(len(details) - 1):
        d1 = details[i]
        d2 = details[i + 1]
        if not isinstance(d1, dict) or not isinstance(d2, dict):
            continue
        t1 = (d1.get('text') or '').strip()
        t2 = (d2.get('text') or '').strip()
        if not t1 or not t2:
            continue

        if lc in ('EN',):
            m1 = re.match(
                r'^\s*Increase\s+(?:own\s+)?(ATK|Attack|DEF|Defense|Mobility|MOB|Move)\s+by\s+(\d+)%\s*\.?\s*$',
                t1, re.I)
            if not m1:
                continue
            if 'supercharged' not in t2.lower():
                continue
            st_raw, pct = m1.group(1), m1.group(2)
            if not _pct_in_text(pct, t2):
                continue
            st_key = st_raw.strip().lower()
            disp = {'atk': 'ATK', 'attack': 'ATK', 'def': 'DEF', 'defense': 'DEF',
                    'mob': 'Mobility', 'mobility': 'Mobility', 'move': 'Move'}.get(st_key, st_raw.upper())
            t2_low = t2.lower()
            if st_key in ('attack', 'atk') and 'atk' not in t2_low and 'attack' not in t2_low:
                continue
            if st_key in ('defense', 'def') and 'def' not in t2_low and 'defense' not in t2_low:
                continue
            if st_key in ('mobility', 'mob') and 'mob' not in t2_low and 'mobility' not in t2_low:
                continue
            if st_key == 'move' and 'move' not in t2_low and 'movement' not in t2_low:
                continue
            d1['text'] = f'When Vigor is Normal, increase {disp} by {pct}%.'
        elif lc in ('TW', 'HK'):
            m1 = re.match(
                r'^\s*自身(攻擊力|防禦力|機動力|移動力|最大HP|最大EN)提升(\d+)%\s*$',
                t1)
            if not m1:
                continue
            if '超一擊' not in t2:
                continue
            stat_zh, pct = m1.group(1), m1.group(2)
            if f'提升{pct}%' not in t2.replace(' ', '') and f'{pct}%' not in t2:
                continue
            if stat_zh not in t2:
                continue
            d1['text'] = f'自身戰意為一般時，\n自身{stat_zh}提升{pct}%'
        elif lc in ('JA', 'JP'):
            m1 = re.match(
                r'^\s*自身の(攻撃力|防禦力|機動力|移動力|最大HP|最大EN)が(\d+)%上昇\s*$',
                t1)
            if not m1:
                continue
            if '超一撃' not in t2:
                continue
            stat_ja, pct = m1.group(1), m1.group(2)
            if f'{pct}%' not in t2 or stat_ja not in t2:
                continue
            d1['text'] = f'自身のテンションが「超一撃」未満の時\n自身の{stat_ja}が{pct}%上昇'


def trait_text_implies_show_target_condition_tags(en_text, display_text):
    """True when trait copy points at TargetConditionSetId scope (tags or series).

    Master text often says \"above tags\" / \"specified tags\" or the series equivalent
    (\"above series\", JA 上記シリーズ, ZH 上述…系列). Without this, target-only conditions
    (e.g. UnitSeries on the squad scope) never merge into displayed tags.
    """
    blob = ((en_text or '') + '\n' + (display_text or '')).strip()
    if not blob:
        return False
    low = blob.lower()
    if 'above tag' in low or 'specified tag' in low:
        return True
    if 'above series' in low or 'specified series' in low:
        return True
    if '上記シリーズ' in blob or '指定シリーズ' in blob:
        return True
    if '上述' in blob and '系列' in blob:
        return True
    return False


def build_ability_entry(ab_id, abil_name_map, abil_link_map, trait_set_traits_map, trait_data_map, lang_text_map, en_lang_text_map, trait_condition_raw_map, lineage_lookup, series_name_map, ability_resource_map, abil_desc_map, sort_order=0, lang_code='EN', unit_id=None):
    trait_set_id = normalize_id(abil_link_map.get(ab_id, ab_id))
    lookup_id = trait_set_id[:-2] if len(trait_set_id) > 2 else trait_set_id
    ab_name = resolve_ability_display_name_from_maps(ab_id, abil_name_map, abil_link_map) or 'Unknown'
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
        _boost_map = trait_boost_condition_raw_map if 'trait_boost_condition_raw_map' in globals() else trait_condition_raw_map
        boost_conds = resolve_condition_tags(boost_cid, _boost_map, lineage_lookup, series_name_map, lang_code)
        boost_conds_snap = list(boost_conds)
        io_alt_squad_tags = False
        # Io EX atlas passive (202570101): squad OR-scope is authored on TraitBoostConditionSetId 1000006
        # (EN tag ids 1114+1131 → Underwater/Land; JP GroupId 「地上用 or 水中用」). SameGroup row 1000545 can
        # still list 1115+1114 (Aerial/Underwater) from an older schema — prefer boost when present so UI
        # matches in-game. Fall back to 1000545 only if boost resolves empty (partial master dump).
        if str(tid) == '202570101' and trait_text_implies_show_target_condition_tags(en_text, display_text):
            if boost_conds_snap:
                target_conds = list(boost_conds_snap)
                io_alt_squad_tags = True
            else:
                alt_tgt = resolve_condition_tags('1000545', trait_condition_raw_map, lineage_lookup, series_name_map, lang_code)
                if alt_tgt:
                    target_conds = alt_tgt
                    io_alt_squad_tags = True
        if io_alt_squad_tags:
            boost_conds = []
        trait_conds = []
        # Display tags are sourced from active/boost conditions only.
        # TargetConditionSetId is often structural and can cause noisy tags,
        # UNLESS the text references the target scope (above/specified tags or series) —
        # then target conditions are exactly what the player needs to see.
        _include_target = target_conds and trait_text_implies_show_target_condition_tags(en_text, display_text)
        for c in active_conds:
            if c not in trait_conds:
                trait_conds.append(c)
        for c in boost_conds:
            if c not in trait_conds:
                trait_conds.append(c)
        if _include_target:
            for c in target_conds:
                if c not in trait_conds:
                    trait_conds.append(c)
        condition_groups = []
        if active_conds:
            condition_groups.append({'label': 'Condition 1', 'conditions': list(active_conds)})
        if _include_target:
            condition_groups.append({'label': 'Target Tags', 'conditions': list(target_conds)})
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
            'target_conditions': list(target_conds),
            'boost_conditions': list(boost_conds),
        })
    _preserved_target_tag_groups = []
    for _inf in trait_info:
        _preserved_target_tag_groups.append(
            [g for g in (_inf.get('condition_groups') or []) if str(g.get('label') or '').strip().lower() == 'target tags'])
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
    def collect_forward_placeholder_targets(from_idx):
        """Sibling traits often carry TargetConditionSetId on effect rows while the prose lives on another row with dummy target (common dump pattern)."""
        out = []; seen_sig = set()
        for j in range(from_idx + 1, len(trait_info)):
            tj = trait_info[j]
            if (tj.get('display_text') or '').strip():
                break
            for c in (tj.get('target_conditions') or []):
                sig = (str(c.get('id') or ''), str(c.get('name') or ''), str(c.get('type') or ''))
                if sig in seen_sig:
                    continue
                seen_sig.add(sig); out.append(c)
        return out
    carry_boost_for_next = []
    def _looks_conditional_text(info_row):
        txt = (str(info_row.get('en_text') or '') + ' ' + str(info_row.get('display_text') or '')).lower()
        if '[condition' in txt:
            return True
        # Heuristic: only attach implicit condition tags on clearly conditional lines.
        return (
            (' when ' in (' ' + txt))
            or (' if ' in (' ' + txt))
            or ('specified' in txt)
            or ('above tag' in txt)
            or ('above series' in txt)
        )
    for idx, info in enumerate(trait_info):
        nums = [n for n in (info.get('condition_nums') or []) if isinstance(n, int) and n > 0]
        groups = []
        boost_conds = list(info.get('boost_conditions') or [])
        boost_used = False
        is_conditional_line = _looks_conditional_text(info)
        if nums:
            forward_tgt = []
            if 2 in nums and not (info.get('target_conditions') or []):
                forward_tgt = collect_forward_placeholder_targets(idx)
            forward_used = False
            for n in nums:
                conds_for_n = []
                if (
                    isinstance(n, int) and n >= 2 and forward_tgt
                    and not forward_used
                    and not (info.get('target_conditions') or [])
                ):
                    conds_for_n = list(forward_tgt)
                    forward_used = True
                if not conds_for_n:
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
        # Unconsumed boost after pilot/active Condition 1 — use Condition 2 so detail merge never flattens both into one pill row.
        if boost_conds and (not boost_used) and (not carry_boost_for_next) and is_conditional_line:
            dup_c1 = any(str(g.get('label') or '').strip().lower() == 'condition 1' for g in groups)
            b_lab = 'Condition 2' if dup_c1 else 'Condition 1'
            groups.append({'label': b_lab, 'conditions': boost_conds})
        if groups:
            info['condition_groups'] = groups
            for _ptg in _preserved_target_tag_groups[idx] or []:
                info['condition_groups'].append(_ptg)
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
    _augment_bare_vigor_lines_next_to_supercharged(details, lang_code)
    res_id = coalesce_ability_resource_id(ab_id, trait_set_id)
    icon_file = find_trait_icon(res_id) if res_id else None
    has_icon = bool(icon_file)
    ex_frame = is_ex_character_ability_frame(ab_name) or ability_details_imply_ex_piloting_ex_unit(details)
    # Trait list display_name only. Stats/compare CP toggles use JS `t('conditional_passive')`, not this field.
    if is_ex_character_ability_rename(ab_name):
        uid = normalize_id(unit_id) if unit_id else ''
        if uid in UNIT_IDS_CONDITIONAL_PASSIVE_TRAIT_TITLE:
            disp_name = conditional_passive_trait_display_label(lang_code)
        else:
            disp_name = ex_character_ability_display_label(lang_code)
    else:
        disp_name = ab_name
    return {'id': ab_id, 'name': ab_name, 'display_name': disp_name, 'sort': sort_order, 'details': details, 'icon': f"/static/images/Trait/{icon_file}" if icon_file else '', 'has_icon': has_icon, 'is_ex': ex_frame, 'frame_overlay': ABILITY_FRAME_OVERLAY if (has_icon and ex_frame) else '', 'resource_id': res_id}

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
map_event_score_attack_stage_data = load_json(os.path.join(BASE_DIR, "m_map_event_score_attack_stage.json"))
special_event_stage_data = load_json(os.path.join(BASE_DIR, "m_special_event_stage.json"))
tower_event_data = load_json(os.path.join(BASE_DIR, "m_tower_event.json"))
tower_event_stage_group_data = load_json(os.path.join(BASE_DIR, "m_tower_event_stage_group.json"))
tower_event_stage_data = load_json(os.path.join(BASE_DIR, "m_tower_event_stage.json"))
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
map_npc_unit_weapon_trait_set_content_data = load_json(os.path.join(BASE_DIR, "m_map_npc_unit_weapon_trait_set_content.json"))
map_stage_group_initial_placement_data = load_json(os.path.join(BASE_DIR, "m_map_stage_group_initial_placement.json"))
char_skill_base_data = load_json(os.path.join(BASE_DIR, "m_character_skill.json"))
unit_skill_master_data = load_json(os.path.join(BASE_DIR, "m_unit_skill.json"))
unit_skill_set_content_data = load_json(os.path.join(BASE_DIR, "m_unit_skill_set_content.json"))
unit_skill_trait_master_data = load_json(os.path.join(BASE_DIR, "m_unit_skill_trait.json"))
unit_ssp_config_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_config.json"))
unit_ssp_stat_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_add_status.json"))
ssp_abil_replace_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core_ability_change.json"))
ssp_custom_core_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core.json"))
ssp_custom_core_status_up_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core_status_up.json"))
ssp_release_fn_content_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core_release_function_set_content.json"))
ssp_weap_enhance_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core_weapon_enhance_set.json"))
ssp_weap_effect_data = load_json(os.path.join(BASE_DIR, "m_unit_ssp_custom_core_weapon_effect.json"))
option_parts_data = load_json(os.path.join(BASE_DIR, "m_option_parts.json"))
option_parts_lineage_data = load_json(os.path.join(BASE_DIR, "m_option_parts_lineage.json"))
option_parts_acquisition_method_data = load_json(os.path.join(BASE_DIR, "m_option_parts_acquisition_method.json"))
schedule_master_data = load_json(os.path.join(BASE_DIR, "m_schedule.json"))
schedule_start_ms_by_id = {}
schedule_end_ms_by_id = {}
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
    try:
        schedule_end_ms_by_id[_sid] = int(_sit.get('EndDatetime') or 0)
    except (TypeError, ValueError):
        schedule_end_ms_by_id[_sid] = 0

trait_set_traits_map = create_trait_set_to_traits_map(trait_set_data)
trait_data_map = create_trait_data_map(trait_logic_data)
trait_condition_raw_map = create_trait_condition_raw_map(trait_cond_data_r)
trait_condition_rows_by_set_id = {}
for _tci in extract_data_list(trait_cond_data_r):
    if not isinstance(_tci, dict):
        continue
    _tsid = normalize_id(_tci.get('TraitConditionSetId') or _tci.get('traitConditionSetId') or '')
    if _tsid == '0':
        continue
    trait_condition_rows_by_set_id.setdefault(_tsid, []).append(_tci)
trait_boost_condition_raw_map = create_trait_condition_raw_map(trait_boost_cond_data, key_field='TraitBoostConditionSetId')
char_info_map = create_char_info_map(char_master); char_stat_map = create_char_status_map(char_status)
char_lin_map = create_char_lineage_link_map(char_lineage_data)
supporter_info_map = create_supporter_info_map(supporter_master) if supporter_master else {}
supporter_growth_map = create_supporter_growth_map(supporter_growth_data) if supporter_growth_data else {}
supporter_leader_map = create_supporter_leader_skill_map(supporter_leader_data) if supporter_leader_data else {}
supporter_active_map = create_supporter_active_skill_map(supporter_active_data) if supporter_active_data else {}
stage_map = create_stage_map(stage_master_data) if stage_master_data else {}
eternal_stage_map = create_eternal_stage_map(eternal_stage_data) if eternal_stage_data else {}
map_event_score_attack_stage_map = create_map_event_score_attack_stage_map(map_event_score_attack_stage_data, stage_master_data) if map_event_score_attack_stage_data else {}
special_event_stage_map = create_special_event_stage_map(special_event_stage_data) if special_event_stage_data else {}
tower_event_map = create_tower_event_map(tower_event_data) if tower_event_data else {}
tower_event_stage_group_map = create_tower_event_stage_group_map(tower_event_stage_group_data) if tower_event_stage_group_data else {}
tower_event_stage_map = create_tower_event_stage_map(tower_event_stage_data) if tower_event_stage_data else {}
stage_sortie_set_content_map = create_stage_sortie_set_content_map(stage_sortie_set_content_data) if stage_sortie_set_content_data else {}
stage_sortie_group_content_map = create_stage_sortie_group_content_map(stage_sortie_group_content_data) if stage_sortie_group_content_data else {}
stage_condition_map = create_stage_condition_map(stage_battle_condition_text_base_data) if stage_battle_condition_text_base_data else {}
map_stage_lookup = create_map_stage_lookup(map_stage_data) if map_stage_data else {}
map_stage_meta_by_stage_id = create_map_stage_meta_by_stage_id(map_stage_data) if map_stage_data else {}
map_master_lookup = create_map_master_lookup(map_master_data) if map_master_data else {}
map_npc_lookup, map_npc_by_map_stage = create_map_npc_lookup(map_npc_data) if map_npc_data else ({}, {})
map_npc_unit_lookup = create_map_npc_unit_lookup(map_npc_unit_data) if map_npc_unit_data else {}
map_npc_character_lookup = create_map_npc_character_lookup(map_npc_character_data) if map_npc_character_data else {}
map_npc_unit_ability_set_lookup = create_simple_set_to_ids_map(map_npc_unit_ability_set_content_data, 'MapNpcUnitAbilitySetId', 'AbilityId') if map_npc_unit_ability_set_content_data else {}
map_npc_character_ability_set_lookup = create_simple_set_to_ids_map(map_npc_character_ability_set_content_data, 'MapNpcCharacterAbilitySetId', 'AbilityId') if map_npc_character_ability_set_content_data else {}
map_npc_character_skill_set_lookup = create_simple_set_to_ids_map(map_npc_character_skill_set_content_data, 'MapNpcCharacterSkillSetId', 'CharacterSkillId') if map_npc_character_skill_set_content_data else {}
map_npc_unit_weapon_set_lookup = create_map_npc_unit_weapon_set_lookup(map_npc_unit_weapon_set_content_data) if map_npc_unit_weapon_set_content_data else {}
map_npc_weapon_trait_set_lookup = create_map_npc_weapon_trait_set_lookup(map_npc_unit_weapon_trait_set_content_data) if map_npc_unit_weapon_trait_set_content_data else {}
tower_event_group_sort_map = {}
for _tev in (tower_event_map or {}).values():
    if not isinstance(_tev, dict):
        continue
    _gid = normalize_id(_tev.get('tower_event_stage_group_id'))
    if _gid == '0':
        continue
    _sort = safe_int(_tev.get('sort_order'), 0)
    if _gid not in tower_event_group_sort_map or _sort < tower_event_group_sort_map[_gid]:
        tower_event_group_sort_map[_gid] = _sort
map_stage_group_initial_placement_lookup = {}
if map_stage_group_initial_placement_data:
    for item in extract_data_list(map_stage_group_initial_placement_data):
        if not isinstance(item, dict): continue
        msid = normalize_id(item.get('MapStageId') or item.get('mapStageId'))
        if msid == '0': continue
        map_stage_group_initial_placement_lookup.setdefault(msid, []).append({'battle_side_type': normalize_id(item.get('BattleSidePlacedTypeIndex') or item.get('battleSidePlacedTypeIndex')), 'x': safe_int(item.get('X'), 0), 'y': safe_int(item.get('Y'), 0), 'direction': normalize_id(item.get('DirectionTypeIndex') or item.get('directionTypeIndex'))})
char_skill_info_map = create_char_skill_info_map(char_skill_base_data) if char_skill_base_data else {}


def create_unit_skill_info_map(d):
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        s = normalize_id(item.get('Id') or item.get('id'))
        if s == '0':
            continue
        lk[s] = {
            'name_lang_id': normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId')),
            'desc_lang_id': normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId')),
            'resource_id': str(item.get('ResourceId') or item.get('resourceId') or ''),
            'duration': safe_int(item.get('Duration') or item.get('duration'), 0),
            'usage_limit': safe_int(item.get('UsageLimit') or item.get('usageLimit'), 0),
        }
    return lk


def create_unit_skill_set_lookup(d):
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId'))
        sid = normalize_id(item.get('UnitSkillId') or item.get('unitSkillId'))
        if uid == '0' or sid == '0':
            continue
        so = safe_int(item.get('SortOrder') or item.get('sortOrder'), 0)
        lk.setdefault(uid, []).append({'sort': so, 'unit_skill_id': sid})
    for k in lk:
        lk[k].sort(key=lambda x: x['sort'])
    return lk


def create_unit_skill_trait_by_skill_lookup(d):
    lk = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        usid = normalize_id(item.get('UnitSkillId') or item.get('unitSkillId'))
        tid = normalize_id(item.get('Id') or item.get('id'))
        if usid == '0':
            continue
        lk.setdefault(usid, []).append({
            'id': tid,
            'name_lang_id': normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId')),
            'desc_lang_id': normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId')),
            'resource_id': str(item.get('ResourceId') or item.get('resourceId') or ''),
        })
    for k in lk:
        lk[k].sort(key=lambda x: x['id'])
    return lk


unit_skill_info_map = create_unit_skill_info_map(unit_skill_master_data) if unit_skill_master_data else {}
unit_skill_set_lookup = create_unit_skill_set_lookup(unit_skill_set_content_data) if unit_skill_set_content_data else {}
unit_skill_trait_by_skill = create_unit_skill_trait_by_skill_lookup(unit_skill_trait_master_data) if unit_skill_trait_master_data else {}
unit_info_map = create_unit_info_map(unit_master_data); unit_stat_map = create_unit_status_map(unit_status_data)
LIMITED_TIME_UNIT_IDS = frozenset({
    '1150000150', '1095002550', '1200003950', '1330000750', '1114000150', '1501002250', '1430003450',
    '1080000150', '1085000450', '1330000150', '1339000150', '1400000550', '1230003850', '1125001450', '1125001150',
    '1060000550', '1060000450', '1705000550', '1060000350',
    '1219000150', '1370005950',
    # Narrative pickup: RecommendCharacterId 1144000102
    '1144000550',
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


LIMITED_TIME_CHARACTER_IDS = frozenset(_compute_limited_time_character_ids()) | frozenset({
    normalize_id('1705000200'),
})
LIMITED_TIME_SUPPORTER_IDS = frozenset(
    normalize_id(x) for x in (
        '1110000150',
        '1300000450',
        '1125000250',
        '1330000250',
        '1370000550',
    )
)
unit_lin_map = create_unit_lineage_link_map(unit_lineage_data); unit_ter_map = create_terrain_map(unit_terrain_data)
option_parts_lineage_map = create_option_parts_lineage_map(option_parts_lineage_data) if option_parts_lineage_data else {}
option_part_series_map = {}
if option_parts_data:
    for _op in extract_data_list(option_parts_data):
        if not isinstance(_op, dict):
            continue
        _opid = normalize_id(_op.get('Id') or _op.get('id'))
        if _opid == '0':
            continue
        _sid = normalize_id(_op.get('SeriesId') or _op.get('seriesId'))
        option_part_series_map[_opid] = _sid if _sid != '0' else '0'
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
weapon_info_map = create_weapon_master_map(weapon_master); weapon_status_map = create_weapon_status_map(weapon_status_data)
weapon_correction_map = create_weapon_correction_map(weapon_correction_data)
growth_pattern_map = create_growth_pattern_map(weapon_growth_data)
weapon_trait_change_map = create_weapon_trait_change_map(weapon_trait_change_data)

ability_resource_map = {}
for item in extract_data_list(ability_master):
    if isinstance(item, dict):
        ai = normalize_id(item.get('Id') or item.get('id') or item.get('AbilityId'))
        ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
        ts = normalize_id(item.get('TraitSetId') or item.get('traitSetId'))
        if ai != '0' and ri != '0':
            ability_resource_map[ai] = ri
        # Sets sometimes reference TraitSetId-adjacent ids; UR rows may only match via trait set key.
        if ts != '0' and ri != '0':
            ability_resource_map.setdefault(ts, ri)

abil_link_map = {}
for item in extract_data_list(ability_master):
    if isinstance(item, dict):
        ai = normalize_id(item.get('Id') or item.get('id')); ti = normalize_id(item.get('TraitSetId') or item.get('traitSetId'))
        if ai != '0' and ti != '0': abil_link_map[ai] = ti


def coalesce_ability_resource_id(ab_id, trait_set_id=''):
    """Pick m_ability ResourceId (trait_*) for icon lookup when AbilityId has extra suffix digits or matches TraitSetId."""
    arm = ability_resource_map

    def _get(k):
        if not k or k == '0':
            return ''
        v = arm.get(k, '')
        return str(v).strip() if v and str(v) != '0' else ''

    seen, keys = set(), []

    def _add(k):
        k = normalize_id(k) if k is not None else ''
        if k and k != '0' and k not in seen:
            seen.add(k)
            keys.append(k)

    _add(ab_id)
    _add(trait_set_id)
    _add(abil_link_map.get(normalize_id(ab_id), ''))
    for k in keys:
        hit = _get(k)
        if hit:
            return hit
    for k in keys:
        if not k.isdigit():
            continue
        b = k
        while len(b) > 6:
            b = b[:-2]
            hit = _get(b)
            if hit:
                return hit
    return ''

SDC_DETAIL_MARKER = "Can execute Support Defense when an enemy responds to an ally's attack with a counter during a fight."
SDC_EXPLICIT_IDS = {'1501000103'}
CHANCE_STEP_EX_FILTER_ID = 'chance_step_ex'
CHANCE_STEP_EX_FILTER_NAME = 'Chance Step x2'
CHANCE_STEP_PLUS_ONE_RE = re.compile(r'chance\s*step\s*\+\s*1(?!\d)', re.IGNORECASE)
SUPPORT_DEF_X2_FILTER_ID = 'support_def_x2'
SUPPORT_DEF_X2_FILTER_NAME = 'Support Defense x2'
SUPPORT_ATK_X2_FILTER_ID = 'support_atk_x2'
SUPPORT_ATK_X2_FILTER_NAME = 'Support Attack x2'
SUPPORT_DEF_PLUS_ONE_RE = re.compile(r'(support\s*defen[cs]e[\s\S]{0,24}[+＋]\s*1(?!\d))|(支援防[禦御][\s\S]{0,24}[+＋]\s*1(?!\d))', re.IGNORECASE)
SUPPORT_ATK_PLUS_ONE_RE = re.compile(r'(support\s*attack\s*[/／]\s*counter[\s\S]{0,24}[+＋]\s*1(?!\d))|(支援攻擊\s*[/／]\s*反擊[\s\S]{0,24}[+＋]\s*1(?!\d))|(支援攻撃\s*[/／]\s*反撃[\s\S]{0,24}[+＋]\s*1(?!\d))', re.IGNORECASE)
CHANCE_STEP_PLUS_ONE_REGEXES = (
    re.compile(r'chance\s*step[\s\S]{0,24}[+＋]\s*1(?!\d)', re.IGNORECASE),
    re.compile(r'チャンスステップ[\s\S]{0,24}[+＋]\s*1(?!\d)'),
    re.compile(r'額外行動[\s\S]{0,24}[+＋]\s*1(?!\d)'),
)


def _char_special_x2_filter_names(lc):
    """Localized labels for special character x2 ability filters."""
    lang = validate_lang_code(lc)
    if lang in ('TW', 'HK'):
        return {
            CHANCE_STEP_EX_FILTER_ID: '額外行動 x2',
            SUPPORT_DEF_X2_FILTER_ID: '支援防禦 x2',
            SUPPORT_ATK_X2_FILTER_ID: '支援攻擊 x2',
        }
    if lang == 'JA':
        return {
            CHANCE_STEP_EX_FILTER_ID: 'チャンスステップ x2',
            SUPPORT_DEF_X2_FILTER_ID: '支援防御 x2',
            SUPPORT_ATK_X2_FILTER_ID: '支援攻撃 x2',
        }
    return {
        CHANCE_STEP_EX_FILTER_ID: CHANCE_STEP_EX_FILTER_NAME,
        SUPPORT_DEF_X2_FILTER_ID: SUPPORT_DEF_X2_FILTER_NAME,
        SUPPORT_ATK_X2_FILTER_ID: SUPPORT_ATK_X2_FILTER_NAME,
    }

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


def unit_has_ms_ability_content(uid):
    """True if unit has MS traits from m_unit_ability and/or SSP Custom Core ability gains (not weapons-only / map NPC shells)."""
    u = normalize_id(uid)
    if unit_abil_map.get(u):
        return True
    if unit_ssp_abil_gain_list.get(u):
        return True
    return False


# Browse / filters: exclude units that only exist for maps/story (weapons but no MS abilities), same visibility as other NPCs.
# Also exclude specific roster rows that are not meant for normal browsing (still loadable via /api/unit/<id> and ID search).
UNIT_IDS_HIDDEN_FROM_UNIT_BROWSE = frozenset({normalize_id('1307000400')})
unit_list_playable_ids = {u for u in (set(unit_abil_map.keys()) | set(unit_weapon_map.keys())) if unit_has_ms_ability_content(u)}
unit_list_playable_ids -= UNIT_IDS_HIDDEN_FROM_UNIT_BROWSE


def unit_qualifies_for_unit_tag_series_modals(uid, lc):
    """Same pool as unit browse: MS abilities + resolved lineage tags (excludes map NPC shells from tag/series pickers)."""
    u = normalize_id(uid)
    if u not in unit_list_playable_ids:
        return False
    return browse_entity_has_resolved_lineage_tags(unit_lin_map, u, lc, 'unit')


unit_ssp_custom_core_group_entries = {}
if ssp_custom_core_data:
    for item in extract_data_list(ssp_custom_core_data):
        if not isinstance(item, dict): continue
        gid = normalize_id(item.get('UnitSspCustomCoreGroupId') or item.get('unitSspCustomCoreGroupId'))
        sched = normalize_id(item.get('ScheduleId') or item.get('scheduleId'))
        if sched == '9999990001': continue
        fnid = normalize_id(item.get('UnitSspCustomCoreReleaseFunctionSetId') or item.get('unitSspCustomCoreReleaseFunctionSetId'))
        if gid != '0' and fnid != '0': unit_ssp_custom_core_group_entries.setdefault(gid, set()).add(fnid)

# m_unit_ssp_custom_core_status_up: UnitStatusTypeIndex 6 = Movement; EffectValue is the real flat MOV (can be 2+).
# ReleaseFunctionTypeIndex 3 alone always added +1 and undercounted rows with EffectValue 2.
ssp_custom_core_row_move_bonus = {}
if ssp_custom_core_status_up_data:
    for item in extract_data_list(ssp_custom_core_status_up_data):
        if not isinstance(item, dict):
            continue
        cid = normalize_id(item.get('Id') or item.get('id'))
        st = normalize_id(item.get('UnitStatusTypeIndex') or item.get('unitStatusTypeIndex'))
        if cid == '0' or st != '6':
            continue
        try:
            ev = int(float(item.get('EffectValue') or item.get('effectValue') or 0))
        except (TypeError, ValueError):
            ev = 0
        if ev > 0:
            ssp_custom_core_row_move_bonus[cid] = ev

ssp_release_fn_content_by_set = {}
if ssp_release_fn_content_data:
    for item in extract_data_list(ssp_release_fn_content_data):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('UnitSspCustomCoreReleaseFunctionSetId') or item.get('unitSspCustomCoreReleaseFunctionSetId'))
        t = normalize_id(item.get('ReleaseFunctionTypeIndex') or item.get('releaseFunctionTypeIndex'))
        tid = normalize_id(item.get('TargetId') or item.get('targetId'))
        so = safe_int(item.get('SortOrder') or item.get('sortOrder'), 0)
        if sid != '0': ssp_release_fn_content_by_set.setdefault(sid, []).append({'type': t, 'target_id': tid, 'sort': so})

# Fallback when ReleaseFunctionTypeIndex=4 TargetId is not a row in m_terrain_capability_set (should be rare).
SSP_TERRAIN_TYPE4_LEGACY_MAP = {'2': ('Underwater', 1, 2), '4': ('Atmospheric', 1, 2), '6': ('Underwater', 1, 3), '9': ('Underwater', 1, 3), '28': ('Underwater', 2, 3), '29': ('Underwater', 1, 3), '32': ('Underwater', 2, 3), '12': ('Ground', 2, 3), '24': ('Ground', 1, 2), '26': ('Ground', 1, 2), '21': ('Space', 1, 2), '23': ('Space', 1, 2), '30': ('Space', 2, 3), '36': ('Space', 1, 2), '51': ('Space', 1, 2), '52': ('Space', 1, 2), '54': ('Space', 1, 2), '57': ('Space', 1, 2), '58': ('Space', 1, 2), '59': ('Space', 1, 2), '22': ('Atmospheric', 1, 2), '31': ('Atmospheric', 2, 3), '38': ('Atmospheric', 1, 2), '44': ('Atmospheric', 1, 2), '61': ('Atmospheric', 2, 3), '64': ('Atmospheric', 1, 2), '41': ('Sea', 1, 2)}

_SSP_TERRAIN_NAMES = ('Space', 'Atmospheric', 'Ground', 'Sea', 'Underwater')


def _ssp_terrain_tier_norm(v):
    try:
        n = int(v or 0)
    except Exception:
        n = 0
    if n < 1:
        return 1
    if n > 3:
        return 3
    return n


def _ssp_base_terrain_levels(info):
    td = unit_ter_map.get(info.get('terrain_set', ''), {})
    return {tn: _ssp_terrain_tier_norm(td.get(tn, 1)) for tn in _SSP_TERRAIN_NAMES}


def get_ssp_custom_core_bonuses_for_unit(unit_id):
    """SSP Custom Core: flat Move from m_unit_ssp_custom_core_status_up (per core row); terrain from release type 4."""
    out = {'move': 0, 'terrain_upgrades': []}
    uid = normalize_id(unit_id)
    if uid == '0':
        return out
    info = unit_info_map.get(uid, {})
    if ssp_custom_core_data:
        for item in extract_data_list(ssp_custom_core_data):
            if not isinstance(item, dict):
                continue
            gid = normalize_id(item.get('UnitSspCustomCoreGroupId') or item.get('unitSspCustomCoreGroupId'))
            if gid != uid:
                continue
            sched = normalize_id(item.get('ScheduleId') or item.get('scheduleId'))
            if sched == '9999990001':
                continue
            cid = normalize_id(item.get('Id') or item.get('id'))
            out['move'] += ssp_custom_core_row_move_bonus.get(cid, 0)
    fn_sets = unit_ssp_custom_core_group_entries.get(uid, set())
    type4_cap_set_ids = []
    type4_legacy_tuples = []
    for sid in sorted(fn_sets):
        items = sorted(ssp_release_fn_content_by_set.get(sid, []), key=lambda z: safe_int(z.get('sort', 0), 0))
        for it in items:
            t = it.get('type', '0')
            if t == '4':
                tid = normalize_id(it.get('target_id', '0'))
                if tid in unit_ter_map:
                    type4_cap_set_ids.append(tid)
                elif tid in SSP_TERRAIN_TYPE4_LEGACY_MAP:
                    type4_legacy_tuples.append(SSP_TERRAIN_TYPE4_LEGACY_MAP[tid])
    base = _ssp_base_terrain_levels(info)
    eff = dict(base)
    for cap_id in type4_cap_set_ids:
        tgt = unit_ter_map.get(cap_id, {})
        for tn in _SSP_TERRAIN_NAMES:
            eff[tn] = max(eff[tn], _ssp_terrain_tier_norm(tgt.get(tn, 1)))
    for tn, fr, to in type4_legacy_tuples:
        if tn not in eff:
            continue
        cur = eff[tn]
        frn = _ssp_terrain_tier_norm(fr)
        ton = _ssp_terrain_tier_norm(to)
        eff[tn] = ton if cur == frn else max(cur, ton)
    for tn in _SSP_TERRAIN_NAMES:
        if eff[tn] > base[tn]:
            out['terrain_upgrades'].append((tn, base[tn], eff[tn]))
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
                    oaid = item.get('OccupiedAreaId') if item.get('OccupiedAreaId') is not None else item.get('occupiedAreaId')
                    occupied_area_id = safe_int(oaid, 1)
                    if occupied_area_id < 1:
                        occupied_area_id = 1
                    _muid = normalize_id(item.get('MainUnitId') or item.get('mainUnitId') or uid)
                    if _muid == '0':
                        _muid = uid
                    unit_info_map[uid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'model': str(item.get('ModelNumber') or ''), 'series_set': normalize_id(item.get('SeriesSetId') or item.get('seriesSetId')), 'terrain_set': normalize_id(item.get('TerrainCapabilitySetId') or item.get('terrainCapabilitySetId')), 'mechanism_set_id': normalize_id(item.get('MechanismSetId') or item.get('mechanismSetId')), 'profile_lang_id': normalize_id(item.get('ProfileLanguageId') or item.get('profileLanguageId') or '0'), 'is_ultimate': is_ult, 'acquisition_route': normalize_id(item.get('UnitAcquisitionRouteTypeIndex'),'0'), 'bromide_resource_id': bid, 'resource_ids': rids, 'recommend_character_id': rec_cid, 'schedule_id': normalize_id(item.get('ScheduleId') or item.get('scheduleId'), '0'), 'occupied_area_id': occupied_area_id, 'main_unit_id': _muid}
                    added += 1
            if added: print(f"  +{added} units from {lang_code}")
    
    series_text = load_json(os.path.join(lang_dir, "m_series.json")); lineage_text = load_json(os.path.join(lang_dir, "m_lineage.json"))
    trait_name_data = load_json(os.path.join(lang_dir, "m_trait_set_detail.json")); trait_desc_data = load_json(os.path.join(lang_dir, "m_trait.json"))
    char_text = load_json(os.path.join(lang_dir, "m_character.json"))
    skill_trait_lang = load_json(os.path.join(lang_dir, "m_character_skill_trait.json"))
    skill_lang = load_json(os.path.join(lang_dir, "m_character_skill.json"))
    unit_skill_trait_lang = load_json(os.path.join(lang_dir, "m_unit_skill_trait.json"))
    unit_skill_lang = load_json(os.path.join(lang_dir, "m_unit_skill.json"))
    skill_text_data = (
        list(extract_data_list(skill_trait_lang))
        + list(extract_data_list(skill_lang) or [])
        + list(extract_data_list(unit_skill_trait_lang) or [])
        + list(extract_data_list(unit_skill_lang) or [])
    )
    unit_text_data = load_json(os.path.join(lang_dir, "m_unit.json")); weapon_text_data = load_json(os.path.join(lang_dir, "m_weapon.json"))
    supporter_text = load_json(os.path.join(lang_dir, "m_supporter.json")); supporter_leader_text = load_json(os.path.join(lang_dir, "m_supporter_leader_skill_content.json"))
    supporter_active_text = load_json(os.path.join(lang_dir, "m_supporter_active_skill.json"))
    stage_lang_text = load_json(os.path.join(lang_dir, "m_eternal_road_stage.json")); stage_battle_condition_text_lang = load_json(os.path.join(lang_dir, "m_stage_battle_condition_text.json"))
    tower_event_lang_text = load_json(os.path.join(lang_dir, "m_tower_event.json"))
    tower_stage_group_lang_text = load_json(os.path.join(lang_dir, "m_tower_event_stage_group.json"))
    tower_stage_lang_text = load_json(os.path.join(lang_dir, "m_tower_event_stage.json"))
    special_event_stage_lang_text = load_json(os.path.join(lang_dir, "m_special_event_stage.json"))
    stage_master_lang_text = load_json(os.path.join(lang_dir, "m_stage.json"))
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
    tower_event_text_map = create_lang_text_map(tower_event_lang_text) if tower_event_lang_text else {}
    tower_stage_group_text_map = create_lang_text_map(tower_stage_group_lang_text) if tower_stage_group_lang_text else {}
    tower_stage_text_map = create_lang_text_map(tower_stage_lang_text) if tower_stage_lang_text else {}
    special_event_stage_text_map = create_lang_text_map(special_event_stage_lang_text) if special_event_stage_lang_text else {}
    stage_master_text_map = create_lang_text_map(stage_master_lang_text) if stage_master_lang_text else {}
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
    unit_skill_name_fallback = {}
    unit_skill_desc_fallback = {}
    if unit_skill_master_data:
        for item in extract_data_list(unit_skill_master_data):
            if not isinstance(item, dict):
                continue
            sid = normalize_id(item.get('Id') or item.get('id'))
            nlid = normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId'))
            dlid = normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId'))
            if sid != '0' and nlid != '0':
                entries = stm.get(nlid)
                if entries and isinstance(entries, list) and len(entries) > 0:
                    best = next((x for x in entries if x.get('full_id') == nlid), entries[0])
                    unit_skill_name_fallback[sid] = best.get('text', '')
            if sid != '0' and dlid != '0':
                entries = stm.get(dlid)
                if entries and isinstance(entries, list) and len(entries) > 0:
                    best = next((x for x in entries if x.get('full_id') == dlid), entries[0])
                    unit_skill_desc_fallback[sid] = best.get('text', '')
    unit_skill_trait_name_fallback = {}
    unit_skill_trait_desc_fallback = {}
    if unit_skill_trait_master_data:
        for item in extract_data_list(unit_skill_trait_master_data):
            if not isinstance(item, dict):
                continue
            tid = normalize_id(item.get('Id') or item.get('id'))
            nlid = normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId'))
            dlid = normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId'))
            if tid != '0' and nlid != '0':
                entries = stm.get(nlid)
                if entries and isinstance(entries, list) and len(entries) > 0:
                    best = next((x for x in entries if x.get('full_id') == nlid), entries[0])
                    unit_skill_trait_name_fallback[tid] = best.get('text', '')
            if tid != '0' and dlid != '0':
                entries = stm.get(dlid)
                if entries and isinstance(entries, list) and len(entries) > 0:
                    best = next((x for x in entries if x.get('full_id') == dlid), entries[0])
                    unit_skill_trait_desc_fallback[tid] = best.get('text', '')
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
    if unit_skill_master_data:
        for item in extract_data_list(unit_skill_master_data):
            if isinstance(item, dict):
                si = normalize_id(item.get('Id') or item.get('id')); ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
                if si != '0' and ri != '0': srm[si] = ri
    if unit_skill_trait_master_data:
        for item in extract_data_list(unit_skill_trait_master_data):
            if isinstance(item, dict):
                si = normalize_id(item.get('Id') or item.get('id')); ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
                if si != '0' and ri != '0': srm[si] = ri
    
    LANG_DATA[lang_code] = {'abil_name_map': anm, 'abil_desc_map': adm, 'lineage_list': ll, 'lineage_lookup': llk, 'series_name_map': snm, 'lang_text_map': ltm, 'char_id_map': cim, 'char_text_map': ctm, 'char_ser_map': csm, 'ser_set_map': ssm, 'series_list': sl, 'skill_text_map': stm, 'skill_trait_name_fallback': skill_trait_name_fallback, 'skill_trait_desc_fallback': skill_trait_desc_fallback, 'unit_skill_name_fallback': unit_skill_name_fallback, 'unit_skill_desc_fallback': unit_skill_desc_fallback, 'unit_skill_trait_name_fallback': unit_skill_trait_name_fallback, 'unit_skill_trait_desc_fallback': unit_skill_trait_desc_fallback, 'skill_resource_map': srm, 'unit_id_map': uim, 'unit_text_map': utm, 'supporter_id_map': supp_im, 'supporter_text_map': supp_tm, 'supporter_leader_text_map': supp_leader_tm, 'supporter_active_text_map': supp_active_tm, 'stage_text_map': stage_text_map, 'tower_event_text_map': tower_event_text_map, 'tower_stage_group_text_map': tower_stage_group_text_map, 'tower_stage_text_map': tower_stage_text_map, 'special_event_stage_text_map': special_event_stage_text_map, 'stage_master_text_map': stage_master_text_map, 'stage_condition_text_map': stage_condition_text_map, 'weapon_text_map': wtm2, 'weapon_trait_map': wtrm, 'weapon_capability_map': wcam, 'weapon_trait_detail_map': wtdm, 'mechanism_map': mech_map, 'op_text_map': op_text_map}
    if lang_code != DEFAULT_LANG:
        apply_en_lang_data_fallback(LANG_DATA[lang_code], LANG_DATA.get(DEFAULT_LANG))
    print(f"  {lang_code}: {len(ctm)} chars, {len(utm)} units")

# Filled by _build_browse_list_performance_caches() after stat helpers are defined.
CHAR_BROWSE_LIST_ROW_CACHE = {}
UNIT_BROWSE_LIST_ROW_CACHE = {}
UNIT_MECHANISM_MIDS_CACHE = {}
UNIT_WEAPON_DEBUFF_KEYS_CACHE = {}


def build_unit_transform_partner_map():
    """Each main unit id maps to its single transform alt and vice versa (m_unit.MainUnitId)."""
    main_to_alt = {}
    for u, row in unit_info_map.items():
        mid = normalize_id(row.get('main_unit_id', u))
        if mid == '0':
            mid = u
        if u != mid:
            main_to_alt[mid] = u
    partner = {}
    for m, a in main_to_alt.items():
        partner[m] = a
        partner[a] = m
    return partner


unit_transform_partner_map = build_unit_transform_partner_map()


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


def _precompute_support_x2_character_sets():
    """Characters that effectively reach 2 support actions by role + '+1 time' ability lines."""
    ld = LANG_DATA.get(CALC_LANG, LANG_DATA.get(DEFAULT_LANG, {}))
    ldc = ld
    support_def_plus_cids = set()
    support_atk_plus_cids = set()
    seen_aids = set()
    aid_flags = {}
    for ab_row in extract_data_list(char_abil):
        cid = normalize_id(ab_row.get('CharacterId', ''))
        if not cid or cid not in char_list_playable_ids:
            continue
        role_id = normalize_id((char_info_map.get(cid) or {}).get('role', '0'))
        for key in ('AbilityId', 'SpAbilityId', 'spAbilityId'):
            aid = normalize_id(ab_row.get(key) or '')
            if not aid or aid in ('0', 'None'):
                continue
            if aid not in seen_aids:
                seen_aids.add(aid)
                has_def = False
                has_atk = False
                try:
                    bab = build_ability_entry(
                        aid, ld['abil_name_map'], abil_link_map, trait_set_traits_map,
                        trait_data_map, ld['lang_text_map'], ldc['lang_text_map'],
                        trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'],
                        ability_resource_map, ld['abil_desc_map'], sort_order=0, lang_code=CALC_LANG,
                    )
                    detail_blob = ' '.join(
                        d.get('text', '') if isinstance(d, dict) else str(d)
                        for d in (bab.get('details') or [])
                    )
                    has_def = bool(SUPPORT_DEF_PLUS_ONE_RE.search(detail_blob or ''))
                    has_atk = bool(SUPPORT_ATK_PLUS_ONE_RE.search(detail_blob or ''))
                except Exception:
                    has_def = False
                    has_atk = False
                aid_flags[aid] = (has_def, has_atk)
            has_def, has_atk = aid_flags.get(aid, (False, False))
            if has_def and role_id == '2':
                support_def_plus_cids.add(cid)
            if has_atk and role_id == '3':
                support_atk_plus_cids.add(cid)
    return support_def_plus_cids, support_atk_plus_cids


SUPPORT_DEF_X2_CHARACTER_IDS, SUPPORT_ATK_X2_CHARACTER_IDS = _precompute_support_x2_character_sets()
print(f"Support Defense x2 characters: {len(SUPPORT_DEF_X2_CHARACTER_IDS)}")
print(f"Support Attack x2 characters: {len(SUPPORT_ATK_X2_CHARACTER_IDS)}")


def _request_flag_true(v):
    s = str(v or '').strip().lower()
    return s in ('1', 'true', 'yes', 'on')


def _char_matches_special_x2_filter(cid, want, include_sp=False, include_conditional=False):
    role_id = normalize_id((char_info_map.get(cid) or {}).get('role', '0'))
    chance_by_family = {}
    def_by_family = {}
    atk_by_family = {}
    ld = LANG_DATA.get(CALC_LANG, LANG_DATA.get(DEFAULT_LANG, {}))
    ldc = ld
    for ab_row in extract_data_list(char_abil):
        if normalize_id(ab_row.get('CharacterId', '')) != cid:
            continue
        keys = ('AbilityId',)
        if include_sp:
            keys = ('AbilityId', 'SpAbilityId', 'spAbilityId')
        for key in keys:
            aid = normalize_id(ab_row.get(key) or '')
            if not aid or aid in ('0', 'None'):
                continue
            try:
                bab = build_ability_entry(
                    aid, ld['abil_name_map'], abil_link_map, trait_set_traits_map,
                    trait_data_map, ld['lang_text_map'], ldc['lang_text_map'],
                    trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'],
                    ability_resource_map, ld['abil_desc_map'], sort_order=0, lang_code=CALC_LANG,
                )
            except Exception:
                continue
            fam = (bab.get('name') or aid or '').strip().lower()
            fam = re.sub(r'\s*(?:lv\.?|level)\s*\d+\s*$', '', fam, flags=re.IGNORECASE).strip() or aid
            hit_ch = 0
            hit_df = 0
            hit_at = 0
            for d in (bab.get('details') or []):
                is_cond = isinstance(d, dict) and bool((d.get('conditions') or []))
                if is_cond and not include_conditional:
                    continue
                t = (d.get('text', '') if isinstance(d, dict) else str(d)).strip()
                if not t:
                    continue
                hit_ch += sum(len(rx.findall(t)) for rx in CHANCE_STEP_PLUS_ONE_REGEXES)
                hit_df += len(SUPPORT_DEF_PLUS_ONE_RE.findall(t))
                hit_at += len(SUPPORT_ATK_PLUS_ONE_RE.findall(t))
            if hit_ch > 0:
                chance_by_family[fam] = max(chance_by_family.get(fam, 0), hit_ch)
            if hit_df > 0:
                def_by_family[fam] = max(def_by_family.get(fam, 0), hit_df)
            if hit_at > 0:
                atk_by_family[fam] = max(atk_by_family.get(fam, 0), hit_at)
    chance_hits = sum(chance_by_family.values())
    def_hits = sum(def_by_family.values())
    atk_hits = sum(atk_by_family.values())
    if want == CHANCE_STEP_EX_FILTER_ID:
        return chance_hits >= 1
    if want == SUPPORT_DEF_X2_FILTER_ID:
        return def_hits >= 2
    if want == SUPPORT_ATK_X2_FILTER_ID:
        return atk_hits >= 2
    return False

def _precompute_weapon_debuff_keys_present_by_lang():
    """Which debuff filter keys appear on at least one unit (weapon traits); EN baseline duplicated per locale."""
    out = {}
    ld_en = LANG_DATA.get('EN')
    if ld_en:
        acc = set()
        for uid in unit_info_map:
            acc |= set(collect_unit_weapon_trait_only_debuff_keys(uid, ld_en, 'EN'))
            for sm in ('normal', 'sp', 'ssp'):
                acc |= set(collect_unit_weapon_range_debuff_keys(uid, ld_en, 'EN', sm))
        fs = frozenset(acc)
        for lc in ('EN', 'TW', 'HK', 'JA'):
            if LANG_DATA.get(lc):
                out[lc] = fs
        return out
    for lc in ('EN', 'TW', 'HK', 'JA'):
        ld = LANG_DATA.get(lc)
        if not ld:
            continue
        acc = set()
        for uid in unit_info_map:
            acc |= set(collect_unit_weapon_trait_only_debuff_keys(uid, ld, lc))
            for sm in ('normal', 'sp', 'ssp'):
                acc |= set(collect_unit_weapon_range_debuff_keys(uid, ld, lc, sm))
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

# EX abilities that buff the pilot's MS — applied to unit ATK/DEF in the damage calculator when paired.
# Keys: character_id -> unit_id -> pct (not pilot Ranged/Melee; excluded via _char_trait_line_is_squad_unit_effect).
# Do not duplicate "same squad + tag" ATK/DEF here; those are modeled by squad conditions in index.html.
CHAR_PAIR_UNIT_STAT_MOD_PCT = {}

# Characters whose conditional-passive / recommend pairing is tied to a specific unit, without a stat shortcut above.
CHAR_PAIR_CONDITIONAL_PASSIVE_UNIT_IDS = {
    '1300001801': ('1300004650',),
}

# "Increase own ATK by X% when countering" — MS Attack in combat; DC applies when user enables counter-attack mode.
CHAR_PAIR_UNIT_COUNTER_ATK_PCT = {
    '1219000201': {'1219000250': 20},
}


def _char_pair_conditional_unit_ids(char_id):
    """Unit ids that appear in CHAR_PAIR_UNIT_* maps — conditional squad/MS bonuses only apply when paired with one of these."""
    cid = normalize_id(char_id)
    out = set()
    m = CHAR_PAIR_UNIT_STAT_MOD_PCT.get(cid)
    if m:
        out.update(normalize_id(u) for u in m.keys())
    m2 = CHAR_PAIR_UNIT_COUNTER_ATK_PCT.get(cid)
    if m2:
        out.update(normalize_id(u) for u in m2.keys())
    for uid in CHAR_PAIR_CONDITIONAL_PASSIVE_UNIT_IDS.get(cid, ()):
        out.add(normalize_id(uid))
    return out


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

def _whats_new_snapshot_game_fingerprint(snap):
    """Stable hash of snapshot game payload (excludes captured_at) for deduping duplicate baselines."""
    if not isinstance(snap, dict):
        return ''
    body = {k: v for k, v in snap.items() if k != 'captured_at'}
    try:
        raw = json.dumps(body, sort_keys=True, separators=(',', ':')).encode('utf-8')
    except (TypeError, ValueError):
        return ''
    return hashlib.sha256(raw).hexdigest()

def _load_whats_new_snapshot_chain():
    """Return [oldest ... newest] baselines for history diffs.

    - Uses whats_new_history_index.json *captured_at* per archive when set (labels/sort), so tabs do not all show
      the same calendar day after multiple refresh runs rewrote embedded dates.
    - Drops consecutive archives with identical game data (e.g. duplicate refresh).
    - Omits whats_new_snapshot.json from the tail when it matches the last archive file (pending still diffs that file vs live).
    """
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
        if not snap:
            continue
        aid = (a.get('id') or fn).strip() or fn
        idx_ca = (a.get('captured_at') or '').strip()
        if idx_ca:
            snap = dict(snap)
            snap['captured_at'] = idx_ca
        loaded.append((aid, snap))
    loaded.sort(key=lambda x: ((x[1].get('captured_at') or '').strip(), x[0]))
    chain = []
    for _aid, snap in loaded:
        fp = _whats_new_snapshot_game_fingerprint(snap)
        if not fp:
            continue
        if chain and _whats_new_snapshot_game_fingerprint(chain[-1]) == fp:
            continue
        chain.append(snap)
    cur = load_whats_new_snapshot()
    if not cur:
        return []
    cur_fp = _whats_new_snapshot_game_fingerprint(cur)
    if not chain or cur_fp != _whats_new_snapshot_game_fingerprint(chain[-1]):
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
    spb_crit = [0]; spc_crit = [0]
    def ep(ad, bd, cd, nd, bd_move_flat, cd_move_flat, bd_crit, cd_crit):
        hc = any(cond for d2 in ad.get('details', []) for cond in d2.get('conditions', []))
        ie = ad.get('is_ex', False); ability_cond = ability_name_implies_unit_stat_conditional_bucket(ad)
        inx = unit_id == '1400000550' and any(kw in (ad.get('name', '') or '').lower() for kw in ['newtype', 'x-rounder', '新人類', 'x rounder'])
        for di, d2 in enumerate(ad.get('details', [])):
            txt = d2.get('text', '') if isinstance(d2, dict) else str(d2)
            parts = [p.strip() for p in re.split(r'[.\n]+', txt) if p and p.strip()]
            if not parts: parts = [txt]
            cond_prefix = False
            prev_enemy_tag_clause = False
            for part in parts:
                itc = _is_conditional_stat_text(part)
                if itc and _unit_hp_threshold_active_at_assumed_full_hp(part):
                    itc = False
                if itc and _unit_vigor_normal_baseline_stat_line(part):
                    itc = False
                part_stats = _extract_stat_percent_unit(part, skip_conditional=False)
                enemy_adv_atk_def = _unit_enemy_tag_equal_atk_def_boost(part_stats, prev_enemy_tag_clause)
                if enemy_adv_atk_def:
                    prev_enemy_tag_clause = False
                else:
                    part_stats, prev_enemy_tag_clause = _strip_enemy_tag_advantage_atk_def_if_following(part_stats, prev_enemy_tag_clause)
                if _unit_enemy_specified_tags_clause_part(part):
                    prev_enemy_tag_clause = True
                flat_move = _extract_stat_flat_move(part, skip_conditional=False)
                if itc and not part_stats and not flat_move:
                    cond_prefix = True
                is_cond = itc or cond_prefix
                line_cond = _unit_line_ms_stats_conditional_bucket(part, hc, ie, is_cond, ability_cond, ad, di)
                if enemy_adv_atk_def:
                    line_cond = True
                if flat_move:
                    if inx: pass
                    elif line_cond: cd_move_flat[0] += flat_move
                    else: bd_move_flat[0] += flat_move
                for s, pct in part_stats.items():
                    if s == UNIT_ABILITY_PASSIVE_CRIT_DMG_PCT_KEY:
                        if not inx:
                            if line_cond:
                                cd_crit[0] += pct
                            else:
                                bd_crit[0] += pct
                        continue
                    if s == 'Move': continue
                    if unit_id == '1400000550' and s == 'HP' and pct == 5: bd[s] = bd.get(s, 0) + pct; continue
                    if inx: nd[s] = max(nd.get(s, 0), pct)
                    elif line_cond: cd[s] = cd.get(s, 0) + pct
                    else: bd[s] = bd.get(s, 0) + pct
        _unit_adjust_hp_condition_increased_atk_buckets(ad, bd, cd)
    for ab in ac:
        ep(ab, spb, spc, nxs, spb_move_flat, spc_move_flat, spb_crit, spc_crit)
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
    spb_crit = [0]; spc_crit = [0]; sspb_crit = [0]; sspc_crit = [0]

    def ep(ad, bd, cd, nd, bd_move_flat, cd_move_flat, bd_crit, cd_crit):
        hc = any(cond for d2 in ad.get('details', []) for cond in d2.get('conditions', []))
        ie = ad.get('is_ex', False)
        ability_cond = ability_name_implies_unit_stat_conditional_bucket(ad)
        inx = unit_id == '1400000550' and any(kw in (ad.get('name', '') or '').lower() for kw in ['newtype', 'x-rounder', '新人類', 'x rounder'])
        for di, d2 in enumerate(ad.get('details', [])):
            txt = d2.get('text', '') if isinstance(d2, dict) else str(d2)
            parts = [p.strip() for p in re.split(r'[.\n]+', txt) if p and p.strip()]
            if not parts: parts = [txt]
            cond_prefix = False
            prev_enemy_tag_clause = False
            for part in parts:
                itc = _is_conditional_stat_text(part)
                if itc and _unit_hp_threshold_active_at_assumed_full_hp(part):
                    itc = False
                if itc and _unit_vigor_normal_baseline_stat_line(part):
                    itc = False
                part_stats = _extract_stat_percent_unit(part, skip_conditional=False)
                enemy_adv_atk_def = _unit_enemy_tag_equal_atk_def_boost(part_stats, prev_enemy_tag_clause)
                if enemy_adv_atk_def:
                    prev_enemy_tag_clause = False
                else:
                    part_stats, prev_enemy_tag_clause = _strip_enemy_tag_advantage_atk_def_if_following(part_stats, prev_enemy_tag_clause)
                if _unit_enemy_specified_tags_clause_part(part):
                    prev_enemy_tag_clause = True
                flat_move = _extract_stat_flat_move(part, skip_conditional=False)
                if itc and not part_stats and not flat_move:
                    cond_prefix = True
                is_cond = itc or cond_prefix
                line_cond = _unit_line_ms_stats_conditional_bucket(part, hc, ie, is_cond, ability_cond, ad, di)
                if enemy_adv_atk_def:
                    line_cond = True
                if flat_move:
                    if inx:
                        pass
                    elif line_cond:
                        cd_move_flat[0] += flat_move
                    else:
                        bd_move_flat[0] += flat_move
                for s, pct in part_stats.items():
                    if s == UNIT_ABILITY_PASSIVE_CRIT_DMG_PCT_KEY:
                        if not inx:
                            if line_cond:
                                cd_crit[0] += pct
                            else:
                                bd_crit[0] += pct
                        continue
                    if s == 'Move': continue
                    if unit_id == '1400000550' and s == 'HP' and pct == 5:
                        bd[s] = bd.get(s, 0) + pct
                        continue
                    if inx:
                        nd[s] = max(nd.get(s, 0), pct)
                    elif line_cond:
                        cd[s] = cd.get(s, 0) + pct
                    else:
                        bd[s] = bd.get(s, 0) + pct
        _unit_adjust_hp_condition_increased_atk_buckets(ad, bd, cd)

    for ab in ac:
        if ab.get('ssp_only'):
            ep(ab, sspb, sspc, nxss, sspb_move_flat, sspc_move_flat, sspb_crit, sspc_crit)
            continue
        ep(ab, spb, spc, nxs, spb_move_flat, spc_move_flat, spb_crit, spc_crit)
        if 'ssp_replacement' in ab:
            ep(ab['ssp_replacement'], sspb, sspc, nxss, sspb_move_flat, sspc_move_flat, sspb_crit, sspc_crit)
        else:
            ep(ab, sspb, sspc, nxss, sspb_move_flat, sspc_move_flat, sspb_crit, sspc_crit)
    for s in UNIT_STAT_ORDER:
        spc[s] = spc.get(s, 0) + nxs.get(s, 0)
        sspc[s] = sspc.get(s, 0) + nxss.get(s, 0)
    lb_data = []
    for mult in [1.0, 1.2, 1.3, 1.4]:
        _is_ult = bool(info.get('is_ultimate', False))
        cm_base = 1.0 if _is_ult else mult
        cm_sp = mult if (has_sp and _is_ult) else cm_base
        lb_fs, lb_fsp, lb_fssp = {}, {}, {}
        if raw:
            for s in ['HP', 'EN', 'Attack', 'Defense', 'Mobility']:
                st = raw.get(s, (0, 0, 0)); st = (st[0], st[1], st[2]) if len(st) >= 3 else (st[0], st[1], st[1])
                gs = calc_growth_unit_base(st[0], st[1], ri); gsp = st[2]
                sb2v, sm2v = ssp_bonus.get(s, (0, 0)); sb2v = sb2v if isinstance(sb2v, (int, float)) else 0; sm2v = sm2v if isinstance(sm2v, (int, float)) else sb2v
                scb = math.floor(sb2v + (sm2v - sb2v) * 0.5) if has_sp and ssp_bonus else 0
                lb_fs[s] = math.floor(gs * cm_base); lb_fsp[s] = math.floor(gsp * cm_sp); lb_fssp[s] = math.floor((gsp + scb) * cm_sp)
            mov = raw.get('Move', (0, 0)); mov = (mov[0], mov[1]) if isinstance(mov, (list, tuple)) and len(mov) >= 2 else (mov if isinstance(mov, (int, float)) else 0, mov if isinstance(mov, (int, float)) else 0)
            lb_fs['Move'] = mov[0] if isinstance(mov, (list, tuple)) else mov
            lb_fsp['Move'] = mov[1] if isinstance(mov, (list, tuple)) else mov[0]
            lb_fssp['Move'] = lb_fsp['Move'] + (ssp_core.get('move', 0) if has_sp else 0)
        else:
            lb_fs = {s: math.floor(fs.get(s, 0) * cm_base / 1.4) for s in UNIT_STAT_ORDER}
            lb_fsp = dict(lb_fs)
            lb_fssp = dict(lb_fs)
        snc, swc, spnc, spwc, sspnc, sspwc = [], [], [], [], [], []
        for s in UNIT_STAT_ORDER:
            if s == 'Move':
                mbase = int(lb_fsp.get('Move', 0) or 0)
                mssp = int(lb_fssp.get('Move', 0) or 0)
                mbon = max(0, mssp - mbase)
                bf = spb_move_flat[0]; cf = spc_move_flat[0]; sbf = sspb_move_flat[0]; scf = sspc_move_flat[0]
                snc.append({'name': s, 'total': lb_fs.get(s, 0) + bf, 'bonus': bf, 'base': lb_fs.get(s, 0), 'passive_pct': 0})
                swc.append({'name': s, 'total': lb_fs.get(s, 0) + bf + cf, 'bonus': bf + cf, 'base': lb_fs.get(s, 0), 'passive_pct': 0})
                spnc.append({'name': s, 'total': mbase + bf, 'bonus': bf, 'base': mbase, 'passive_pct': 0})
                spwc.append({'name': s, 'total': mbase + bf + cf, 'bonus': bf + cf, 'base': mbase, 'passive_pct': 0})
                sspnc.append({'name': s, 'total': mssp + sbf, 'bonus': mbon + sbf, 'base': mssp, 'passive_pct': 0})
                sspwc.append({'name': s, 'total': mssp + sbf + scf, 'bonus': mbon + sbf + scf, 'base': mssp, 'passive_pct': 0})
                continue
            bst = lb_fs.get(s, 0); spst = lb_fsp.get(s, 0); sspst = lb_fssp.get(s, 0)
            bb = math.floor(bst * spb.get(s, 0) / 100) if bst else 0
            cb = math.floor(bst * (spb.get(s, 0) + spc.get(s, 0)) / 100) if bst else 0
            snc.append({'name': s, 'total': bst + bb, 'bonus': bb, 'base': bst, 'passive_pct': spb.get(s, 0)})
            swc.append({'name': s, 'total': bst + cb, 'bonus': cb, 'base': bst, 'passive_pct': spb.get(s, 0) + spc.get(s, 0)})
            spbb = math.floor(spst * spb.get(s, 0) / 100) if spst else 0
            spcb = math.floor(spst * (spb.get(s, 0) + spc.get(s, 0)) / 100) if spst else 0
            spnc.append({'name': s, 'total': spst + spbb, 'bonus': spbb, 'base': spst, 'passive_pct': spb.get(s, 0)})
            spwc.append({'name': s, 'total': spst + spcb, 'bonus': spcb, 'base': spst, 'passive_pct': spb.get(s, 0) + spc.get(s, 0)})
            sspbb = math.floor(sspst * sspb.get(s, 0) / 100) if sspst else 0
            sspcb = math.floor(sspst * (sspb.get(s, 0) + sspc.get(s, 0)) / 100) if sspst else 0
            sspnc.append({'name': s, 'total': sspst + sspbb, 'bonus': sspbb, 'base': sspst, 'passive_pct': sspb.get(s, 0)})
            sspwc.append({'name': s, 'total': sspst + sspcb, 'bonus': sspcb, 'base': sspst, 'passive_pct': sspb.get(s, 0) + sspc.get(s, 0)})
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

def resolve_lineage_ids_to_tag_dicts(lineage_ids, ld, tt='group'):
    """Map LineageId values (e.g. from m_option_parts_lineage) to display names via lang m_lineage (lineage_lookup)."""
    if not lineage_ids:
        return []
    llk = ld.get('lineage_lookup', {}); ll = ld.get('lineage_list', []); tags = []; sn = set()
    for lid_raw in lineage_ids:
        lid = normalize_id(lid_raw)
        if lid == '0':
            continue
        name = llk.get(lid)
        if name:
            if name not in sn:
                tags.append({'id': lid, 'name': name, 'type': tt}); sn.add(name)
        else:
            for fid, val in ll:
                if fid.endswith(lid) and len(lid) >= 4:
                    if val not in sn:
                        tags.append({'id': fid, 'name': val, 'type': tt}); sn.add(val)
                    break
    return sorted(tags, key=lambda x: x['name'])

def resolve_series_id_to_tag(series_id_raw, ld):
    """Resolve direct SeriesId (e.g. m_option_parts.SeriesId) to a tag dict for browse/search UI."""
    sid = normalize_id(series_id_raw)
    if sid == '0':
        return None
    snm = ld.get('series_name_map', {})
    name = snm.get(sid)
    if not name:
        for k, v in snm.items():
            if k.endswith(sid):
                name = v
                break
    if not name:
        for lid, val in ld.get('series_list', []):
            if lid.endswith(sid):
                name = val
                break
    if not name:
        return None
    icon = series_id_to_icon.get(sid, '') or find_series_icon(sid)
    return {'id': sid, 'name': name, 'type': 'series', 'icon': icon}


def merge_option_part_tags_with_series(lineage_tags, series_id_raw, ld):
    """Combine lineage tags with m_option_parts.SeriesId when non-zero; avoid duplicate series or same label."""
    tags = list(lineage_tags)
    ser = resolve_series_id_to_tag(series_id_raw, ld)
    if not ser:
        return sorted(tags, key=lambda x: x['name'])
    sid = ser['id']
    if any(t.get('type') == 'series' and normalize_id(t.get('id')) == sid for t in tags):
        return sorted(tags, key=lambda x: x['name'])
    if any(t.get('name') == ser['name'] for t in tags):
        return sorted(tags, key=lambda x: x['name'])
    tags.append(ser)
    return sorted(tags, key=lambda x: x['name'])

def resolve_tags(lin_map, eid, lc, tt='group'):
    ld = get_lang_data(lc)
    return resolve_lineage_ids_to_tag_dicts(lin_map.get(eid, []), ld, tt)

def resolve_stage_terrain_name(ti, lc='EN'):
    data = STAGE_TERRAIN_MAP.get(str(ti or '0'))
    return data.get(lc, data.get('EN', 'Unknown')) if data else get_ui_label(lc, 'terrain_unknown')

def get_stage_difficulty(sid, lc='EN'):
    s = str(sid)
    if s.startswith('9050'): return {'code': 'normal', 'name': get_ui_label(lc, 'difficulty_normal')}
    if s.startswith('9051'): return {'code': 'hard', 'name': get_ui_label(lc, 'difficulty_hard')}
    if s.startswith('9052'): return {'code': 'expert', 'name': get_ui_label(lc, 'difficulty_expert')}
    return {'code': 'unknown', 'name': 'Unknown'}

def get_stage_difficulty_by_type_index(dti, lc='EN'):
    """Normalizes StageDifficultyTypeIndex from m_map_stage / eternal road (1=normal, 2=hard, 3=expert)."""
    i = safe_int(dti, 1)
    if i == 1: return {'code': 'normal', 'name': get_ui_label(lc, 'difficulty_normal')}
    if i == 2: return {'code': 'hard', 'name': get_ui_label(lc, 'difficulty_hard')}
    if i == 3: return {'code': 'expert', 'name': get_ui_label(lc, 'difficulty_expert')}
    return {'code': 'unknown', 'name': 'Unknown'}

def resolve_stage_name_from_lang_m_stage(ld, stage_name_lang_id, stage_id):
    """m_stage master StageNameLanguageId + same-locale lang m_stage.json text rows."""
    lid = normalize_id(stage_name_lang_id) or '0'
    sid = normalize_id(stage_id)
    if lid != '0':
        txt = (ld.get('stage_master_text_map') or {}).get(lid, '')
        if txt:
            return txt
    return f"Unknown ({sid})"

def resolve_special_event_stage_name(ld, stage_name_lang_id, stage_id):
    lid = normalize_id(stage_name_lang_id) or '0'
    sid = normalize_id(stage_id)
    if lid != '0':
        txt = (ld.get('special_event_stage_text_map') or {}).get(lid, '')
        if txt:
            return txt
    return f"Unknown ({sid})"

def resolve_tower_stage_group_name(ld, group_id):
    gid = normalize_id(group_id)
    if gid == '0':
        return ''
    g = (tower_event_stage_group_map or {}).get(gid, {})
    lid = normalize_id(g.get('tower_name_lang_id')) if isinstance(g, dict) else '0'
    if lid != '0':
        txt = (ld.get('tower_stage_group_text_map') or {}).get(lid, '')
        if txt:
            return txt
    return ''

def resolve_tower_event_stage_name(ld, stage_name_lang_id, stage_id, group_id='0', floor_count=0):
    lid = normalize_id(stage_name_lang_id) or '0'
    sid = normalize_id(stage_id)
    if lid != '0':
        txt = (ld.get('tower_stage_text_map') or {}).get(lid, '')
        if txt:
            return txt
    gname = resolve_tower_stage_group_name(ld, group_id)
    floor = safe_int(floor_count, 0)
    if gname and floor > 0:
        return f"{gname} {floor}F"
    if gname:
        return gname
    return f"Unknown ({sid})"

def special_event_stage_thumb_url(thumbnail_resource_id):
    """m_special_event_stage.ThumbnailResourceId → PNG path under images/Stages/Sp_stage_thum.

    List/detail use imgTag(..., webp=True), which tries .webp first then falls back to .png.
    Passing .webp as the base URL skips that fallback (see isRasterWebpCandidate in app.js).
    """
    rid = str(thumbnail_resource_id or '').strip()
    if not rid or rid == '0':
        return ''
    return f'/static/images/Stages/Sp_stage_thum/{rid}.png'

def resolve_sortie_restriction_set(set_id, lc):
    if not set_id or set_id == '0': return []
    ld = get_lang_data(lc); llk = ld.get('lineage_lookup', {}); snm = ld.get('series_name_map', {}); rows = []
    sc_list = stage_sortie_set_content_map.get(set_id, [])
    total_tag_entries = 0
    for sc in sc_list:
        gid0 = sc.get('group_id', '0')
        total_tag_entries += len(stage_sortie_group_content_map.get(gid0, []))
    for sc in sc_list:
        tt = sc.get('target_type_index', '0'); gid = sc.get('group_id', '0')
        rn = []
        for gc in stage_sortie_group_content_map.get(gid, []):
            rt = gc.get('restriction_type_index', '0'); tid = gc.get('target_id', '0')
            src = llk if rt == '2' else (snm if rt == '1' else {})
            name = src.get(tid)
            if not name:
                for k, v in src.items():
                    if k.endswith(tid): name = v; break
            if name and name not in rn: rn.append(name)
        if tt == '1':
            at = get_ui_label(lc, 'restriction_applies_unit')
        elif total_tag_entries <= 1:
            at = get_ui_label(lc, 'restriction_applies_both')
        else:
            at = get_ui_label(lc, 'restriction_applies_characters')
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

def resolve_npc_unit_abilities(asid, lc, unit_id='0'):
    """MapNpcUnitAbilitySetId -> m_map_npc_unit_ability_set_content; if 0, use m_unit_ability_set for UnitId (map NPCs often omit explicit set when kit matches the MS)."""
    ld = get_lang_data(lc); asid_n = normalize_id(asid) if asid else '0'
    if asid_n and asid_n != '0':
        entries = list(map_npc_unit_ability_set_lookup.get(asid_n, []))
        return [build_ability_entry(e['id'], ld.get('abil_name_map', {}), abil_link_map, trait_set_traits_map, trait_data_map, ld.get('lang_text_map', {}), ld.get('lang_text_map', {}), trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), ability_resource_map, ld.get('abil_desc_map', {}), sort_order=e.get('sort', 0), lang_code=lc) for e in entries]
    uid = normalize_id(unit_id)
    if uid == '0':
        return []
    entries = [{'id': x['id'], 'sort': x['sort']} for x in unit_abil_map.get(uid, [])]
    return [build_ability_entry(e['id'], ld.get('abil_name_map', {}), abil_link_map, trait_set_traits_map, trait_data_map, ld.get('lang_text_map', {}), ld.get('lang_text_map', {}), trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), ability_resource_map, ld.get('abil_desc_map', {}), sort_order=e.get('sort', 0), lang_code=lc) for e in entries]

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

def resolve_unit_skill(usid, ld, sv):
    stm = ld.get('skill_text_map', {}); info = unit_skill_info_map.get(usid, {})
    nlid = normalize_id(info.get('name_lang_id', '')); dlid = normalize_id(info.get('desc_lang_id', ''))
    name, desc = 'Unknown', ''
    fallback_name = ld.get('unit_skill_name_fallback', {}).get(usid, '')
    fallback_desc = ld.get('unit_skill_desc_fallback', {}).get(usid, '')
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
        bi = usid[:-2] if len(usid) > 2 else usid
        for k in [bi, usid, usid[-9:] if len(usid) >= 9 else None]:
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
    details = []
    blob = (desc or '').strip()
    if desc:
        details.append(desc)
    tnf = ld.get('unit_skill_trait_name_fallback', {}); tdf = ld.get('unit_skill_trait_desc_fallback', {})
    for tr in unit_skill_trait_by_skill.get(usid, []):
        tlid = normalize_id(tr.get('desc_lang_id', ''))
        tdesc = ''
        if tlid and tlid != '0':
            entries = stm.get(tlid)
            if entries and isinstance(entries, list) and len(entries) > 0:
                best = next((x for x in entries if x.get('full_id') == tlid), entries[0])
                tdesc = best.get('text', '') or ''
        tid = tr.get('id', '')
        if not tdesc:
            tdesc = tdf.get(tid, '')
        if not tdesc:
            nl = normalize_id(tr.get('name_lang_id', ''))
            if nl and nl != '0':
                entries = stm.get(nl)
                if entries and isinstance(entries, list) and len(entries) > 0:
                    best = next((x for x in entries if x.get('full_id') == nl), entries[0])
                    tdesc = best.get('text', '') or ''
        if not tdesc:
            tdesc = tnf.get(tid, '')
        tnorm = (tdesc or '').strip()
        if not tnorm or tnorm in blob:
            continue
        details.append(tdesc)
        blob = (blob + '\n' + tnorm).strip() if blob else tnorm
    ri = str(info.get('resource_id', '') or '').strip() or str(ld.get('skill_resource_map', {}).get(usid, '') or '').strip()
    icf = find_trait_icon(ri) if ri else None
    if not icf:
        for tr in unit_skill_trait_by_skill.get(usid, []):
            tri = str(tr.get('resource_id', '') or '').strip()
            if not tri:
                continue
            icf = find_trait_icon(tri)
            if icf:
                break
    return {'id': usid, 'name': name, 'sort': sv, 'details': details, 'icon': f"/static/images/Trait/{icf}" if icf else '', 'has_icon': bool(icf), 'is_ex': False, 'is_sp': False, 'frame_overlay': '', 'resource_id': ri, 'skip_skill_modal': True}

def resolve_npc_character_skills(ssid, lc):
    if not ssid or ssid == '0': return []
    ld = get_lang_data(lc)
    return [resolve_char_skill(e['id'], ld, i + 1, False) for i, e in enumerate(map_npc_character_skill_set_lookup.get(ssid, []))]

def eval_icon_color(tl, wt):
    if wt == '2': return 'ex'
    if wt == '3': return 'map'
    if not tl: return 'green'
    hp, hd = False, False
    # Weak/debuff "yellow" classification — keep in sync across EN / JA / zh-Hant (TW, HK).
    # EN uses "Decreased ATK"; JA uses shinjitai 防御・回避 (not TW 防禦・迴避); zh uses 減少/下降/賦予.
    stat_down_re = re.compile(
        r'防禦|防御|攻擊|攻撃|機動|命中|迴避|回避|(?<![a-z])(atk|def|mob|acc|eva)(?![a-z])',
        re.I,
    )
    en_stat_down_re = re.compile(
        r'\b(?:decrease|decreases|decreasing|decreased|reduce|reduces|reducing|reduced)\s+(atk|def|mob|acc|eva)\b',
        re.I,
    )
    for tr in tl:
        trl = (tr or '').lower()
        tro = tr or ''
        if 'the max range of' in trl or '最大射程' in tro:
            hp = True
            continue
        if re.search(r'(decrease|reduce)s?\s+target', trl) or 'inflict' in trl:
            hd = True
        elif en_stat_down_re.search(trl):
            hd = True
        elif re.search(r'(降低|減少|下降|賦予)', tro):
            if '敵' in tro:
                hd = True
            elif (
                not ('自身' in tro or '我方' in tro or '味方' in tro)
                and stat_down_re.search(tro)
            ):
                hd = True
            elif '賦予' in tro:
                hd = True
    if hp:
        return 'purple'
    return 'yellow' if hd else 'orange'

def resolve_npc_unit_weapons(wsid, uid, ubr, lc, extra_ex_icon_candidates=None):
    ld = get_lang_data(lc); wtdm = ld.get('weapon_trait_detail_map', {}) or {}; weapons = []
    wsid_n = normalize_id(wsid)
    rows = list(map_npc_unit_weapon_set_lookup.get(wsid_n, []))
    if not rows and wsid_n == '0':
        uid_n = normalize_id(uid)
        if uid_n != '0':
            rows = [{'weapon_id': x['id'], 'power': None, 'en': None, 'hit_rate': None, 'critical_rate': None, 'range_min': None, 'range_max': None, 'trait_set_id': '0', 'override_ammo': 0, 'sort_order': x.get('sort', 0)} for x in unit_weapon_map.get(uid_n, [])]
    for w in rows:
        wid = w.get('weapon_id', '0'); wm = weapon_info_map.get(wid, {}); wn = ld.get('weapon_text_map', {}).get(wm.get('name_lang_id', '0'), 'Unknown')
        ai = wm.get('attribute', '0'); wt = wm.get('weapon_type', '1'); ainfo = WEAPON_ATTR_MAP.get(ai, {'label': 'Unknown', 'icon': ''})
        at = ATTACK_ATTR_TYPES.get(wm.get('attack_attribute', '0'), [])
        ws = resolve_weapon_stats(wm, weapon_status_map, weapon_correction_map, ld.get('weapon_trait_map', {}), ld.get('weapon_capability_map', {}), growth_pattern_map, weapon_trait_change_map, wtdm, wid=wid, lang_code=lc, unit_id=uid)
        ic = resolve_weapon_icon(wt, ai, ubr, extra_ex_icon_candidates, wid=wid, unit_id=uid)
        if is_map_weapon_recovery_supply_mp(uid, wid, wt):
            at = [{'is_supply': True, 'icon': game_image_public_url(MAP_WEAPON_SUPPLY_TYPE_MP_ICON), 'label': 'MP'}]
        base_levels = ws.get('levels') or []
        if base_levels:
            levels = [{**lv, 'traits': list(lv.get('traits') or [])} for lv in base_levels]
        else:
            levels = [{'level': i, 'power': ws.get('power', 0), 'en': ws.get('en', 0), 'accuracy': ws.get('accuracy', 0), 'critical': ws.get('critical', 0), 'ammo': ws.get('ammo', 0) if str(wt) == '3' else 0, 'traits': list(ws.get('traits', []) or [])} for i in range(1, 6)]
            base_levels = levels
        tsid = (w.get('trait_set_id') or '0') or '0'
        if tsid != '0' and map_npc_weapon_trait_set_lookup:
            tlines = []
            for tid in map_npc_weapon_trait_set_lookup.get(tsid, []):
                tx = _weapon_trait_detail_lookup_text(wtdm, tid)
                if tx and tx not in tlines:
                    tlines.append(tx)
            if tlines:
                for lev in levels:
                    lev['traits'] = list(tlines)
        _apply_map_npc_weapon_row_stats(levels, w, base_levels)
        oa = safe_int(w.get('override_ammo'), 0) if w.get('override_ammo') is not None else 0
        if str(wt) == '3' and oa > 0:
            for lev in levels:
                lev['ammo'] = oa
        min_r = ws.get('range_min', 0) if w.get('range_min') is None else safe_int(w.get('range_min'), 0)
        max_r = ws.get('range_max', 0) if w.get('range_max') is None else safe_int(w.get('range_max'), 0)
        lv5t = levels[4]['traits'] if len(levels) > 4 else (levels[-1].get('traits', []) if levels else []); ip = any(_trait_text_indicates_preemptive_strike(tr) for tr in lv5t); icc = eval_icon_color(lv5t, wt)
        weapons.append({'id': wid, 'name': wn, 'attribute': ainfo['label'], 'attribute_id': ai, 'weapon_type': wt, 'attack_types': at, 'levels': levels, 'min_range': min_r, 'max_range': max_r, 'usage_restrictions': ws.get('usage_restrictions', []), 'sort': w.get('sort_order', 0), 'icon': ic['icon'], 'overlay': ic['overlay'], 'is_ex': ic['is_ex'], 'is_map': ic['is_map'], 'icon_color': icc, 'ssp_icon_color': icc, 'map_range_type': wm.get('map_range_type', '0'), 'map_coords': [], 'shooting_coords': [], 'is_dash': False, 'is_ssp_weapon': False, 'ssp_icon': '', 'ssp_power_bonus': 0, 'ssp_ammo_bonus': 0, 'ssp_range_bonus': 0, 'ssp_traits': [], 'is_preemptive': ip})
    weapons.sort(key=lambda x: (0 if x['weapon_type'] == '3' else 1, x['sort']))
    return weapons

def _npc_map_unit_line_is_squad_wide(line):
    """Squad / all-units MS stat % lines apply to every deployed NPC on the map stage."""
    if not line:
        return False
    low = line.lower()
    if 'squad' in low:
        return True
    if re.search(r'\ball\s+units\b', low):
        return True
    if any(x in line for x in (
        '自部隊', '部隊全', '全機', '己方', '我方全', '所屬部隊', '所属部队',
        '味方全', '味方の全', '同じ部隊', '同部隊', '全ユニット', '全機体',
        '自身所屬部隊',
    )):
        return True
    return False


def _merge_map_npc_unit_stat_pct_from_abilities(abilities, nid, squad, per_npc, squad_by_source):
    """Add unconditional MS stat % lines from unit or character abilities into squad / per-NPC buckets.

    Squad-wide lines increment the stage-wide ``squad`` total and ``squad_by_source[nid]`` (authorship)
    so each NPC can apply only its own squad-tagged passives when excluding other units' squad buffs.
    """
    if not abilities:
        return
    keys = ['HP', 'EN', 'Attack', 'Defense', 'Mobility', 'Move']
    per_npc.setdefault(nid, {k: 0 for k in keys})
    row = per_npc[nid]
    for ab in abilities:
        for d in ab.get('details', []) or []:
            txt = d.get('text', '') if isinstance(d, dict) else str(d)
            if not txt or _char_trait_text_is_support_defense_action(txt):
                continue
            lines = [ln.strip() for ln in re.split(r'\r?\n+', txt) if ln.strip()] or [txt]
            for line in lines:
                if _char_trait_line_is_squad_unit_effect(line, ab):
                    continue
                if _is_conditional_stat_text(line):
                    continue
                b = _extract_stat_percent_unit(line, skip_conditional=False)
                if not b:
                    continue
                if _npc_map_unit_line_is_squad_wide(line):
                    src_row = squad_by_source.setdefault(nid, {k: 0 for k in keys})
                    for s, pct in b.items():
                        if s in squad:
                            squad[s] = squad.get(s, 0) + pct
                            src_row[s] = src_row.get(s, 0) + pct
                else:
                    for s, pct in b.items():
                        if s in row:
                            row[s] = row.get(s, 0) + pct


def accumulate_npc_map_unit_stat_bonuses(npc_entries, lc):
    """Per eternal map stage: squad-wide % from all NPCs' unit + character abilities + each NPC's own non-squad lines.

    Returns (squad_total, per_npc_self_rows, squad_by_source) where squad_by_source[nid] is the squad-wide %
    parsed from that NPC's abilities only (for excluding other units' squad buffs per defender).

    Pilot character passives that buff squad MS stats (e.g. \"Increase squad ATK and DEF by 50%\") are included;
    previously only unit abilities were parsed here.

    Multi-line trait text must be split; a single detail blob with a conditional tail must not zero out
    unconditional stat lines (e.g. \"Increase DEF by 15%.\\nWhen ...\").
    """
    keys = ['HP', 'EN', 'Attack', 'Defense', 'Mobility', 'Move']
    squad = {k: 0 for k in keys}
    per_npc = {}
    squad_by_source = {}
    for npc in npc_entries:
        nid = npc['id']
        nu = map_npc_unit_lookup.get(nid, [])
        if not nu:
            continue
        _merge_map_npc_unit_stat_pct_from_abilities(
            resolve_npc_unit_abilities(nu[0].get('ability_set_id', '0'), lc, nu[0].get('unit_id', '0')),
            nid, squad, per_npc, squad_by_source)
        nc = map_npc_character_lookup.get(nid, [])
        if nc:
            _merge_map_npc_unit_stat_pct_from_abilities(
                resolve_npc_character_abilities(nc[0].get('ability_set_id', '0'), lc),
                nid, squad, per_npc, squad_by_source)
    return squad, per_npc, squad_by_source  # squad_by_source[nid] = squad-wide % authored by that NPC only

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
    """Browse list / table: same 5 stats as get_character default `stats` (growth + unconditional non-EX trait %).

    Delegates to _accumulate_character_trait_percent_buckets so parsing matches the character detail sheet.
    The previous implementation set a per-ability flag when *any* detail row had legacy `conditions`, then
    skipped every stat line from that ability — that dropped unconditional bonuses still present in the same
    ability (common on newer passives with condition_groups / multi-line text)."""
    fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == char_id]
    def build_ab(ab):
        bid = normalize_id(ab.get('AbilityId', '')); spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
        d = ldc
        bab = build_ability_entry(bid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        if spid and spid != '0' and spid != 'None' and spid != bid:
            bab['sp_replacement'] = build_ability_entry(spid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        return bab
    ac = [build_ab(ab) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))]
    spbn_u = _accumulate_character_trait_percent_buckets(ac, char_id, ldc)[0]
    totals = {}
    for s in CHAR_STAT_ORDER:
        bv = grown.get(s, 0)
        tb = math.floor(bv * spbn_u[s] / 100) if bv > 0 else 0
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
        if trait_title_implies_conditional_stat_bonuses((sab.get('name') or '')):
            continue
        for d2 in sab.get('details', []):
            rawt = d2.get('text', '') if isinstance(d2, dict) else str(d2)
            spl = [ln.strip() for ln in re.split(r'\r?\n+', rawt) if ln.strip()]
            if not spl:
                spl = [rawt]
            for line in spl:
                if _char_trait_line_is_squad_unit_effect(line, sab):
                    continue
                for s, p in extract_stat_percent_char(line, rawt, char_id=char_id).items():
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
    """Non-SP growth + ability bonuses matching get_character stats_with_ex (CP on: unconditional + conditional + EX trait %)."""
    fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == char_id]
    def build_ab(ab):
        bid = normalize_id(ab.get('AbilityId', '')); spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
        d = ldc
        bab = build_ability_entry(bid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        if spid and spid != '0' and spid != 'None' and spid != bid:
            bab['sp_replacement'] = build_ability_entry(spid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        return bab
    ac = [build_ab(ab) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))]
    spbn_u, spbn_c, spbn_pair, spen, spen_pair, _, _, _, _, _, trait_pair_unit_ids = _accumulate_character_trait_percent_buckets(ac, char_id, ldc)
    pair_ok, _, _ = _character_trait_pair_gate(char_id, trait_pair_unit_ids)
    totals = {}
    for s in CHAR_STAT_ORDER:
        bv = grown.get(s, 0)
        pct = spbn_u[s] + spbn_c[s] + spen[s] + ((spbn_pair[s] + spen_pair[s]) if pair_ok else 0)
        totals[s] = bv + math.floor(bv * pct / 100) if bv > 0 else 0
    return totals

def compute_char_stat_totals_sp_list_with_ex(char_id, ri, ldc, grown_sp):
    """SP growth + SP ability bonuses matching get_character sp_stats_with_ex."""
    fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == char_id]
    def build_ab(ab):
        bid = normalize_id(ab.get('AbilityId', '')); spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
        d = ldc
        bab = build_ability_entry(bid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        if spid and spid != '0' and spid != 'None' and spid != bid:
            bab['sp_replacement'] = build_ability_entry(spid, d['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, d['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, d['lineage_lookup'], d['series_name_map'], ability_resource_map, d['abil_desc_map'], sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG)
        return bab
    ac = [build_ab(ab) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))]
    _, _, _, _, _, spbs_u, spbs_c, spbs_pair, spes, spes_pair, trait_pair_unit_ids = _accumulate_character_trait_percent_buckets(ac, char_id, ldc)
    pair_ok, _, _ = _character_trait_pair_gate(char_id, trait_pair_unit_ids)
    totals = {}
    for s in CHAR_STAT_ORDER:
        sbv = grown_sp.get(s, 0)
        pct = spbs_u[s] + spbs_c[s] + spes[s] + ((spbs_pair[s] + spes_pair[s]) if pair_ok else 0)
        totals[s] = sbv + math.floor(sbv * pct / 100) if sbv > 0 else 0
    return totals


def _build_browse_list_performance_caches():
    """Precompute list-row stats and unit filter unions so /api/characters and /api/units avoid O(n) heavy work per request."""
    global CHAR_BROWSE_LIST_ROW_CACHE, UNIT_BROWSE_LIST_ROW_CACHE
    global UNIT_MECHANISM_MIDS_CACHE, UNIT_WEAPON_DEBUFF_KEYS_CACHE
    ldc = LANG_DATA.get(CALC_LANG) or LANG_DATA.get(DEFAULT_LANG) or {}
    if not ldc:
        CHAR_BROWSE_LIST_ROW_CACHE = {}
        UNIT_BROWSE_LIST_ROW_CACHE = {}
        UNIT_MECHANISM_MIDS_CACHE = {}
        UNIT_WEAPON_DEBUFF_KEYS_CACHE = {}
        print('Browse list perf caches: skipped (no calc lang data)')
        return
    t0 = time.perf_counter()
    char_cache = {}
    for cid, info in char_info_map.items():
        raw = char_stat_map.get(cid, {})
        ri = info.get('rarity', '1')
        has_sp_char = int(str(ri)) <= 4
        t = lambda s, r=raw: r.get(s, (0, 0, 0))
        grown = {s: calc_growth_char(t(s)[0], t(s)[1], ri) for s in CHAR_STAT_ORDER}
        sub = {}
        for cond in (False, True):
            if cond:
                totals = compute_char_stat_totals_detail_style(cid, ri, ldc, grown)
            else:
                totals = compute_char_stat_totals_with_abilities(cid, ri, ldc, grown)
            sub[('n', cond)] = (totals, grown)
        if has_sp_char:
            rv = lambda s, r=raw: r.get(s, (0, 0, 0))
            grown_sp = {s: (rv(s)[2] if len(rv(s)) >= 3 else rv(s)[1]) for s in CHAR_STAT_ORDER}
            for cond in (False, True):
                if cond:
                    totals = compute_char_stat_totals_sp_list_with_ex(cid, ri, ldc, grown_sp)
                else:
                    totals = compute_char_stat_totals_sp_list(cid, ri, ldc, grown_sp)
                sub[('sp', cond)] = (totals, grown_sp)
        char_cache[cid] = sub
    unit_cache = {}
    for uid, info in unit_info_map.items():
        raw = unit_stat_map.get(uid, {})
        try:
            fs_nc = compute_unit_stats_no_cond(uid, info, raw, ldc)
        except Exception:
            fs_nc = {s: 0 for s in UNIT_STAT_ORDER}
        try:
            lb = _unit_max_lb_stat_block(uid, info, raw, ldc)
        except Exception:
            lb = None
        unit_cache[uid] = {'nc': fs_nc, 'lb': lb}
    mids = {uid: collect_unit_mechanism_mids(info, uid) for uid, info in unit_info_map.items()}
    wd = {}
    ld_en = LANG_DATA.get('EN')
    if ld_en:
        d2 = {}
        for uid in unit_info_map:
            try:
                d2[uid] = collect_unit_weapon_trait_only_debuff_keys(uid, ld_en, 'EN')
            except Exception:
                d2[uid] = frozenset()
        for lc in LANG_DATA.keys():
            wd[lc] = d2
    else:
        for lc, ld in LANG_DATA.items():
            d2 = {}
            for uid in unit_info_map:
                try:
                    d2[uid] = collect_unit_weapon_trait_only_debuff_keys(uid, ld, lc)
                except Exception:
                    d2[uid] = frozenset()
            wd[lc] = d2
    CHAR_BROWSE_LIST_ROW_CACHE = char_cache
    UNIT_BROWSE_LIST_ROW_CACHE = unit_cache
    UNIT_MECHANISM_MIDS_CACHE = mids
    UNIT_WEAPON_DEBUFF_KEYS_CACHE = wd
    print(f'Browse list perf caches: {len(char_cache)} chars, {len(unit_cache)} units ({time.perf_counter() - t0:.2f}s)')


def calculate_npc_character_self_bonus_pct(abilities):
    bp = {k: 0 for k in ['Ranged', 'Melee', 'Defense', 'Reaction', 'Awaken']}
    if not abilities: return bp
    for ab in abilities:
        for d in (ab.get('details', []) if isinstance(ab, dict) else []):
            txt = d.get('text', '') if isinstance(d, dict) else str(d)
            if not txt or _char_trait_text_is_support_defense_action(txt):
                continue
            for line in [ln.strip() for ln in re.split(r'\r?\n+', txt) if ln.strip()] or [txt]:
                if _char_trait_line_is_squad_unit_effect(line, ab):
                    continue
                if _is_conditional_stat_text(line):
                    continue
                for s, p in extract_stat_percent_char(line, txt, char_id=None).items():
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
    return safe_int(ui.get('occupied_area_id'), 1) == 2

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
    """Browse list text search breadth (default: name_id).

    - name_id: display name + entity id only (default when q_scope omitted).
    - primary: also tags, series titles, series alias tokens (e.g. msg); no ability/skill/weapon text.
    - full: primary plus ability/skill/weapon search text where applicable.
    """
    v = (val or '').strip().lower()
    if v == 'primary':
        return 'primary'
    if v == 'full':
        return 'full'
    return 'name_id'


def browse_q_scope_cache_letter(q_scope):
    return 'n' if q_scope == 'name_id' else ('p' if q_scope == 'primary' else 'f')


# Whole-segment shortcuts (lowercase key → expanded positive segment text). Browse + API list search.
SEARCH_QUERY_SHORTCUTS_EXACT = {
    'fatb': 'full armor gundam thunderbolt',
    'sf': 'strike freedom',
    'god': 'burning gundam',
    'devil gundam': 'dark gundam',
    'devilgundam': 'dark gundam',
}


def _expand_search_positive_segment(sl):
    """Map a single lowercased positive segment to friendlier query text (exact segment match only)."""
    s = (sl or '').strip().lower()
    return SEARCH_QUERY_SHORTCUTS_EXACT.get(s, sl)


def parse_search_query(sq):
    """Parse list search: comma/semicolon segments. positive (must appear in haystack), negative (must not), series (substring in any series name).
    Leading '-' = exclusion. 'series:foo' = match series only (handled separately).
    'series_id:10' = exact m_series SeriesId (numeric) for that row's resolved series (no substring bleed with other Gundam titles).
    'series:dx' and 'series:12300' = same as series_id for After War Gundam X (m_series Id 2300), all locales."""
    positive, negative, series, series_ids = [], [], [], []
    if not sq or not str(sq).strip():
        return {'positive': [], 'negative': [], 'series': [], 'series_ids': []}
    segments = [t.strip() for t in re.split(r'[,;]', str(sq).strip()) if t.strip()]
    for seg in segments:
        seg = unicodedata.normalize('NFKC', seg).replace('\uff1a', ':').replace('\u3000', ' ').strip()
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
                rs = rest.strip().lower().replace(' ', '')
                if rs == 'dx' or rs == '12300':
                    series_ids.append(SERIES_ID_AFTER_WAR_GUNDAM_X)
                else:
                    series.append(rest.lower())
            continue
        positive.append(_expand_search_positive_segment(sl))
    return {'positive': positive, 'negative': negative, 'series': series, 'series_ids': series_ids}

def _positive_segment_subterms(term):
    """Split one positive segment on whitespace into AND subterms (e.g. 'wing zero' -> ['wing','zero']).
    Comma/semicolon still separate AND segments; spaces inside a segment no longer require an adjacent phrase."""
    if not term:
        return []
    parts = [p for p in str(term).split() if p]
    return parts if parts else [term]


def _search_query_is_dx_token_only(pq):
    """True if the query is only the positive token dx/DX (no series_id, series name, or negative segments)."""
    if not pq or pq.get('negative') or pq.get('series') or pq.get('series_ids'):
        return False
    pos = pq.get('positive') or []
    if len(pos) != 1:
        return False
    return (pos[0] or '').strip().lower() == 'dx'


def _search_fold(s):
    """Lowercase string with spaces, hyphens, and underscores removed so e.g. 'iron blooded' matches 'iron-blooded' and 'Alaya-Vijnana' matches 'alaya vijnana'."""
    if not s:
        return ''
    t = re.sub(r'[\s\-_]+', '', str(s).lower())
    if 'vjnana' in t:
        t = t.replace('vjnana', 'vijnana')
    return t


def _search_substring_in_haystack(t, haystack_lower):
    """Contiguous substring on raw haystack (already lowercased). Min length 2 to limit noise."""
    return len(t) >= 2 and t in haystack_lower


def _search_term_matches_in_text(term, haystack_lower, *, primary=False):
    """Match a search token against haystack (already lowercased).
    Full: len<=2 ASCII uses whole-word boundaries (except len==1 A–z uses word-start prefix); len>2 pure-digit tokens use substring (id fragments);
    len>2 otherwise uses word-start (prefix-friendly) so e.g. 'wing' does not match inside 'throwing'.
    Hyphenated compounds (e.g. 'zero-g') do not match the prefix token alone ('zero').
    Primary: ASCII len==1 letters use word-start prefix; ASCII len==2 stays whole-word; len>=3 word-start so e.g. 'wing' does not match inside 'swing'.
    Fallbacks: folded substring (hyphen/space insensitive); then plain substring (len>=2) so e.g. 'dx' matches
    localized names like 鋼彈dx on name_id (Unicode \\w blocked whole-word match before)."""
    if not term:
        return True
    t = term.lower()
    if not t.isascii() or not re.match(r'^[a-z0-9._+]+$', t):
        if t in haystack_lower:
            return True
        tf = _search_fold(t)
        hf = _search_fold(haystack_lower)
        if len(tf) >= 2 and tf in hf:
            return True
        return _search_substring_in_haystack(t, haystack_lower)
    if primary:
        # All-digit tokens shorter than 4 characters: not adjacent to other ASCII digits (avoids matching inside ids).
        # Use digit boundaries, not \\w boundaries, so "00鋼彈" / "00高達" (TW/HK) still match.
        # Longer digit runs still use prefix/substring behavior below (id fragments; see search_query_matches_entity_id).
        if t.isdigit() and len(t) < 4:
            try:
                return bool(re.search(r'(?<![0-9])' + re.escape(t) + r'(?![0-9])', haystack_lower, re.I))
            except re.error:
                return False
        if len(t) <= 2:
            try:
                # Single-letter A–z: prefix at word/start (matches "unicorn" for "u"), not standalone "u" only.
                if len(t) == 1 and t.isalpha():
                    ok = bool(re.search(r'(?<![\w])' + re.escape(t) + r'(?!-)', haystack_lower, re.I))
                else:
                    ok = bool(re.search(r'(?<![\w])' + re.escape(t) + r'(?![\w])', haystack_lower, re.I))
            except re.error:
                ok = t in haystack_lower
        else:
            try:
                ok = bool(re.search(r'(?<![\w])' + re.escape(t) + r'(?!-)', haystack_lower, re.I))
            except re.error:
                ok = t in haystack_lower
        if ok:
            return True
        tf = _search_fold(t)
        hf = _search_fold(haystack_lower)
        min_fold = 2 if len(t) <= 2 else 3
        if len(tf) >= min_fold and tf in hf:
            return True
        return _search_substring_in_haystack(t, haystack_lower)
    if len(t) <= 2:
        try:
            if len(t) == 1 and t.isalpha():
                ok = bool(re.search(r'(?<![\w])' + re.escape(t) + r'(?!-)', haystack_lower, re.I))
            else:
                ok = bool(re.search(r'(?<![\w])' + re.escape(t) + r'(?![\w])', haystack_lower, re.I))
        except re.error:
            ok = t in haystack_lower
        if ok:
            return True
        tf = _search_fold(t)
        hf = _search_fold(haystack_lower)
        if len(tf) >= 2 and tf in hf:
            return True
        return _search_substring_in_haystack(t, haystack_lower)
    if t.isdigit():
        if t in haystack_lower:
            return True
        tf = _search_fold(t)
        hf = _search_fold(haystack_lower)
        if len(tf) >= 3 and tf in hf:
            return True
        return _search_substring_in_haystack(t, haystack_lower)
    try:
        ok = bool(re.search(r'(?<![\w])' + re.escape(t) + r'(?!-)', haystack_lower, re.I))
    except re.error:
        ok = t in haystack_lower
    if ok:
        return True
    tf = _search_fold(t)
    hf = _search_fold(haystack_lower)
    if len(tf) >= 3 and tf in hf:
        return True
    return _search_substring_in_haystack(t, haystack_lower)


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
        eid_n = normalize_id(entity_id) if entity_id is not None else ''
        if _search_query_is_dx_token_only(pq):
            if not eid_n or eid_n not in DOUBLE_X_DX_TOKEN_UNIT_IDS:
                return False
        elif (
            len(pq['positive']) == 1
            and pq['positive'][0] == '00'
            and not pq['negative']
            and not pq['series']
            and not (pq.get('series_ids') or [])
            and eid_n
            and eid_n in UNIT_SEARCH_SHORTHAND_00_UNIT_IDS
        ):
            pass
        else:
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

def list_rows_stat_bounds(rows, sort_by):
    """Min/max for a numeric list sort column (used by ranking bar)."""
    if not rows or sort_by not in LIST_STAT_SORT_PRIMARY:
        return None
    nums = []
    for r in rows:
        v = r.get(sort_by)
        try:
            nums.append(float(v if v is not None else 0))
        except (TypeError, ValueError):
            nums.append(0.0)
    if not nums:
        return None
    return {'key': sort_by, 'min': min(nums), 'max': max(nums)}


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
    elif sort_by in ('series_tag', 'boost', 'details', 'tags'):
        def _str_key(r, rev=False):
            field = 'tags_join' if sort_by == 'tags' else sort_by
            s = (str(r.get(field, '') or '')).lower()
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
        game_images_use_cdn=GAME_IMAGES_USE_CDN,
        app_js_version=_app_js_bundle_version_tag(),
    ))
    if INDEX_HTML_CACHE_CONTROL:
        r.headers['Cache-Control'] = INDEX_HTML_CACHE_CONTROL
    else:
        r.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        r.headers['Pragma'] = 'no-cache'
        r.headers['Expires'] = '0'
    return r

@app.route('/')
def index(): 
    return _serve_index()


@app.route('/tl')
def banner_timeline_page():
    return _serve_index()


@app.route('/about')
def about_page():
    r = make_response(render_template('about.html'))
    r.headers['Cache-Control'] = 'public, max-age=3600'
    return r


@app.route('/privacy-policy')
def privacy_policy_page():
    r = make_response(render_template('privacy.html'))
    r.headers['Cache-Control'] = 'public, max-age=3600'
    return r


# Same destination as Support/Feedback in static/js/app.js (SUPPORT_FEEDBACK_BASE_URL).
FEEDBACK_FORM_URL = (
    'https://docs.google.com/forms/d/e/1FAIpQLScGcQn662SpeZzGXJ4-TFTSlTaItvQv1A_EJruZgH1uid5nJw/'
    'viewform?usp=send_form'
)


@app.route('/contact')
def contact_page():
    r = make_response(render_template('contact.html', feedback_form_url=FEEDBACK_FORM_URL))
    r.headers['Cache-Control'] = 'public, max-age=3600'
    return r


@app.route('/game-news')
def game_news_page():
    r = make_response(render_template(
        'game_news.html',
        image_cdn=IMAGE_CDN or '',
        game_images_use_cdn=GAME_IMAGES_USE_CDN,
    ))
    r.headers['Cache-Control'] = 'public, max-age=3600'
    return r


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
            pch = (pending or {}).get('changes') or []
            pad = (pending or {}).get('added') or []
            if pending and (pch or pad):
                pending_tab = {
                    'kind': 'pending',
                    'id': 'pending',
                    'label': date,
                    'date': date,
                    'changes': pch,
                    'added': pad,
                }
                entry_pending = {
                    'date': date,
                    'changes': pch,
                    'added': pad,
                }
        history_items = []
        chain = _load_whats_new_snapshot_chain()
        for i in range(len(chain) - 1, 0, -1):
            delta = compute_whats_new_delta_between(chain[i - 1], chain[i], lc)
            if not delta:
                continue
            # Skip no-op history pairs (e.g. duplicate baseline captured same day as current snapshot).
            _ch, _ad = delta.get('changes') or [], delta.get('added') or []
            if not _ch and not _ad:
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
        tl = [t.strip().lower() for t in ts.split(',') if t.strip()]; ck = f"tag_units_v3_{ts}_{op}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); results = {'1': [], '2': [], '3': []}
        rnm = UNIT_ROLE_TYPE_LANG_MAP.get(lc, UNIT_ROLE_TYPE_LANG_MAP['EN']); rnm_en = UNIT_ROLE_TYPE_LANG_MAP.get('EN', {})
        for uid, info in unit_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']: continue
            _muid = normalize_id(info.get('main_unit_id', uid))
            if _muid == '0':
                _muid = uid
            if uid != _muid:
                continue
            lid = ld.get('unit_id_map', {}).get(uid, ''); name = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
            if not name: continue
            if not unit_qualifies_for_unit_tag_series_modals(uid, lc):
                continue
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

# Localized "Affinity: …" trait titles in m_trait_set_detail (tag modal Affinity tab).
# TW/HK use 契合度; JP アフィニティ; some builds use 親和 / 亲和. Keep in sync with
# scripts/verify_affinity_trait_titles.py when adding a new official prefix.
_AFFINITY_TITLE_MARKERS_CJK = frozenset(('親和', '亲和', 'アフィニティ', '契合度'))


def _name_indicates_affinity_ability(ab_name):
    if not ab_name:
        return False
    n = ab_name.lower()
    if 'affinity' in n:
        return True
    return any(m in ab_name for m in _AFFINITY_TITLE_MARKERS_CJK)

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
    """Tag modal Affinity tab: from character context list units with tag; from unit context list playable
    characters (with lineage tags, same pool as browse) whose Affinity-style ability names match tag(s)."""
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        ts = request.args.get('tags', '').strip()
        op = request.args.get('op', 'and').lower()
        source = (request.args.get('source', 'character') or 'character').lower()
        if not ts:
            return jsonify({'1': [], '2': [], '3': []})
        tl = [t.strip().lower() for t in ts.split(',') if t.strip()]
        ck = f"tag_affinity_v4_{source}_{ts}_{op}_{lc}_{lr_schedule_cache_key_fragment()}"
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
                # Same pool as character browse: map/story NPCs have no m_*_lineage tags (e.g. affinity text may still mention a faction).
                if cid not in char_list_playable_ids:
                    continue
                if not browse_entity_has_resolved_lineage_tags(char_lin_map, cid, lc, 'character'):
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
                _muid = normalize_id(info.get('main_unit_id', uid))
                if _muid == '0':
                    _muid = uid
                if uid != _muid:
                    continue
                lid = ld.get('unit_id_map', {}).get(uid, '')
                name = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
                if not name:
                    continue
                if not unit_qualifies_for_unit_tag_series_modals(uid, lc):
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
        ck = f"series_units_v3_{raw_sid}_{lc}_{lr_schedule_cache_key_fragment()}"
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
            _muid = normalize_id(info.get('main_unit_id', uid))
            if _muid == '0':
                _muid = uid
            if uid != _muid:
                continue
            if not unit_qualifies_for_unit_tag_series_modals(uid, lc):
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
        ck = f"abil_units_v2_{an}_{lc}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); results = {'1': [], '2': [], '3': []}
        an_lower = an.lower()
        for uid, info in unit_info_map.items():
            if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
                continue
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']: continue
            _muid = normalize_id(info.get('main_unit_id', uid))
            if _muid == '0':
                _muid = uid
            if uid != _muid:
                continue
            if uid not in unit_list_playable_ids:
                continue
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


def entity_matches_char_skills(cid, want_lid, top_combine='and'):
    """Skill filter — same structure as ability filter (parse_list_ability_filter / browse checkboxes).

    Comma-separated = AND across groups; pipe within one value = OR (e.g. Lv.1|Lv.2|Lv.3 merged row).
    """
    if want_lid is None:
        return True
    if isinstance(want_lid, (set, frozenset)):
        if not want_lid:
            return True
        return any(_char_has_skill_id(cid, w) for w in want_lid)
    if isinstance(want_lid, (list, tuple)):
        if not want_lid:
            return True
        if top_combine == 'or':
            return any(entity_matches_char_skills(cid, w, 'and') for w in want_lid)
        return all(entity_matches_char_skills(cid, w, 'and') for w in want_lid)
    return _char_has_skill_id(cid, want_lid)


def _char_has_ability_id(cid, ability_id):
    want = normalize_id(ability_id)
    if not want:
        return False
    if want in (CHANCE_STEP_EX_FILTER_ID, SUPPORT_DEF_X2_FILTER_ID, SUPPORT_ATK_X2_FILTER_ID):
        include_sp = _request_flag_true(request.args.get('sp'))
        include_conditional = _request_flag_true(request.args.get('cond'))
        return _char_matches_special_x2_filter(cid, want, include_sp=include_sp, include_conditional=include_conditional)
    is_sdc = want in SDC_ABILITY_IDS
    for ab_row in extract_data_list(char_abil):
        if normalize_id(ab_row.get('CharacterId', '')) != cid:
            continue
        for key in ('AbilityId', 'SpAbilityId', 'spAbilityId'):
            aid = normalize_id(ab_row.get(key) or '')
            if not aid:
                continue
            if is_sdc and aid in SDC_ABILITY_IDS:
                return True
            if aid == want:
                return True
    return False


def entity_matches_char_abilities(cid, want_lid, top_combine='and'):
    """Ability filter — top_combine OR flips comma-separated groups to match-any."""
    if want_lid is None:
        return True
    if isinstance(want_lid, (set, frozenset)):
        if not want_lid:
            return True
        return any(_char_has_ability_id(cid, w) for w in want_lid)
    if isinstance(want_lid, (list, tuple)):
        if not want_lid:
            return True
        if top_combine == 'or':
            return any(entity_matches_char_abilities(cid, w, 'and') for w in want_lid)
        return all(entity_matches_char_abilities(cid, w, 'and') for w in want_lid)
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


def entity_matches_unit_abilities_filter(uid, want_lid, top_combine='and'):
    if want_lid is None:
        return True
    if isinstance(want_lid, (set, frozenset)):
        if not want_lid:
            return True
        return any(_unit_has_ability_id(uid, w) for w in want_lid)
    if isinstance(want_lid, (list, tuple)):
        if not want_lid:
            return True
        if top_combine == 'or':
            return any(entity_matches_unit_abilities_filter(uid, w, 'and') for w in want_lid)
        return all(entity_matches_unit_abilities_filter(uid, w, 'and') for w in want_lid)
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
            normalize_filter_combine_op(args.get('lineage_op'), 'and'),
        ])
    else:
        parts = [
            args.get('q', '').strip().lower(),
            args.get('q_scope', '').strip().lower(),
            args.get('role', '').strip(),
            args.get('rarity', '').strip(),
            args.get('source', '').strip(),
            args.get('lineage_id', '').strip(),
            normalize_filter_combine_op(args.get('lineage_op'), 'and'),
            args.get('series_id', '').strip(),
            normalize_filter_combine_op(args.get('series_op'), 'or'),
            args.get('skill_id', '').strip(),
            normalize_filter_combine_op(args.get('skill_op'), 'and'),
            args.get('ability_id', '').strip(),
            normalize_filter_combine_op(args.get('ability_op'), 'and'),
        ]
        if ent == 'units':
            parts.append(args.get('terrain', '').strip())
            parts.append(args.get('stat_mode', '').strip().lower())
            parts.append(normalize_filter_combine_op(args.get('terrain_op'), 'and'))
            parts.append(args.get('weapon_debuff', '').strip())
            parts.append(normalize_filter_combine_op(args.get('weapon_debuff_op'), 'and'))
            parts.append(args.get('weapon_range', '').strip())
            parts.append(normalize_filter_combine_op(args.get('weapon_range_op'), 'and'))
            parts.append(args.get('mechanism', '').strip())
            parts.append(normalize_filter_combine_op(args.get('mechanism_op'), 'and'))
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


def browse_entity_has_resolved_lineage_tags(lin_map, eid, lc, tag_type):
    """True when entity has at least one lineage tag from the link table (resolve_tags). Series alone does not count — map/story NPCs often have SeriesId but no m_*_lineage row, so they stay off the list unless id-seek."""
    return bool(resolve_tags(lin_map, eid, lc, tag_type))


def character_passes_browse_pool_filters(
    cid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
    lineage_filter, series_filter, skill_filter, ability_filter=None,
    *, q_scope='name_id', apply_lineage=True, apply_series=True, apply_skill=True, apply_ability=True,
    lineage_combine='and', series_combine='or', skill_combine='and', trait_combine='and',
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
        if not id_seek and not entity_matches_lineage(char_lin_map, cid, lineage_filter, lineage_combine):
            return False
    if apply_series and series_filter is not None:
        if not id_seek and not entity_matches_series(ld.get('char_ser_map', {}).get(cid, ''), series_filter, lc, series_combine):
            return False
    if apply_skill and skill_filter is not None:
        if not id_seek and not entity_matches_char_skills(cid, skill_filter, skill_combine):
            return False
    if apply_ability and ability_filter is not None:
        if not id_seek and not entity_matches_char_abilities(cid, ability_filter, trait_combine):
            return False
    lid = ld['char_id_map'].get(cid, '')
    name = ld['char_text_map'].get(lid, '') if lid else ''
    if not name:
        name = f'Unknown ({cid})'
    ser_list = resolve_series(ld.get('char_ser_map', {}).get(cid, ''), lc)
    ser_names_lower = series_names_lower_for_search(ser_list)
    if cid not in char_list_playable_ids and not id_seek:
        return False
    if not id_seek and not browse_entity_has_resolved_lineage_tags(char_lin_map, cid, lc, 'character'):
        return False
    if sq:
        search_chunks = []
        if q_scope == 'full':
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
        if q_scope == 'name_id':
            ss = f'{name} {cid}'.strip().lower()
        else:
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
            ).strip().lower()
        if not search_row_matches_query(sq, ss, ser_names_lower, ser_list, entity_id=cid, primary=(q_scope in ('primary', 'name_id'))):
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


def unit_matches_terrain_filter(uid, info, want_filter, stat_mode='normal', combine='and'):
    if want_filter is None:
        return True
    levels = _unit_terrain_levels_for_mode(uid, info, stat_mode)

    def _item_ok(item):
        if len(item) == 3:
            name, lv, ge = item
        else:
            name, lv = item
            ge = False
        got = _terrain_tier_norm(levels.get(name, 1))
        req = _terrain_tier_norm(lv)
        if ge:
            return got >= req
        return got == req

    if combine == 'or':
        return any(_item_ok(item) for item in want_filter)
    return all(_item_ok(item) for item in want_filter)


def unit_passes_browse_pool_filters(
    uid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
    lineage_filter, series_filter, ability_filter, terrain_filter=None, stat_mode='normal',
    weapon_debuff_filter=None,
    *, q_scope='name_id', apply_lineage=True, apply_series=True, apply_ability=True, apply_terrain=True, apply_weapon_debuff=True,
    weapon_range_filter=None, apply_weapon_range=True,
    lineage_combine='and', series_combine='or', ability_combine='and', terrain_combine='and', weapon_debuff_combine='and', weapon_range_combine='and',
):
    """list_units inclusion with optional lineage/series/ability filter steps (for scoped browse dropdowns)."""
    if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
        return False
    ri = info.get('rarity', '1')
    role_id = info.get('role', '0')
    id_seek = bool(sq and search_query_matches_entity_id(sq, uid))
    if role_id == '0' and not (id_seek and npc_password_unlocked()):
        return False
    if not unit_has_ms_ability_content(uid) and not (id_seek and npc_password_unlocked()):
        return False
    _muid = normalize_id(info.get('main_unit_id', uid))
    if _muid == '0':
        _muid = uid
    if uid != _muid and not id_seek:
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
            if not row_matches_rarity_filter(
                rarity_filter, letter, lim, bool(info.get('is_ultimate', False)),
            ):
                return False
    acq_route = str(info.get('acquisition_route', '0'))
    if source_filter is not None:
        if not id_seek and not entity_matches_source_category(acq_route, role_id, source_filter):
            return False
    if apply_terrain and terrain_filter is not None:
        if not id_seek and not unit_matches_terrain_filter(uid, info, terrain_filter, stat_mode, terrain_combine):
            return False
    if apply_lineage and lineage_filter is not None:
        if not id_seek and not entity_matches_lineage(unit_lin_map, uid, lineage_filter, lineage_combine):
            return False
    if apply_series and series_filter is not None:
        if not id_seek and not entity_matches_series(unit_ser_map.get(uid, ''), series_filter, lc, series_combine):
            return False
    if apply_ability and ability_filter is not None:
        if not id_seek and not entity_matches_unit_abilities_filter(uid, ability_filter, ability_combine):
            return False
    if apply_weapon_debuff and weapon_debuff_filter:
        if not id_seek and not unit_matches_weapon_debuff_filter(uid, ld, lc, weapon_debuff_filter, _memo=None, stat_mode=stat_mode, combine=weapon_debuff_combine):
            return False
    if apply_weapon_range and weapon_range_filter is not None:
        if not id_seek and not unit_matches_weapon_range_filter(uid, ld, lc, weapon_range_filter, stat_mode=stat_mode, combine=weapon_range_combine):
            return False
    lid = ld['unit_id_map'].get(uid, '')
    name = ld['unit_text_map'].get(lid, '') if lid else ''
    if not name:
        name = f'Unknown ({uid})'
    ser_list = resolve_series(unit_ser_map.get(uid, ''), lc)
    ser_names_lower = series_names_lower_for_search(ser_list)
    if uid not in unit_list_playable_ids and not id_seek:
        return False
    if not id_seek and not browse_entity_has_resolved_lineage_tags(unit_lin_map, uid, lc, 'unit'):
        return False
    if sq:
        search_chunks = []
        if q_scope == 'full':
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
            mod = collect_unit_model_search_text(info)
            if mod:
                search_chunks.append(mod)
            mech = collect_unit_mechanism_search_text(info, ld, uid)
            if mech:
                search_chunks.append(mech)
            wtxt = collect_unit_weapons_search_text(uid, ld, lc)
            if wtxt:
                search_chunks.append(wtxt)
        if q_scope == 'name_id':
            ss = f'{name} {uid}'.strip()
        else:
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
            ).strip()
        ss = (ss + UNIT_SEARCH_HAYSTACK_EXTRA_BY_ID.get(uid, '')).strip().lower()
        if not search_row_matches_query(sq, ss, ser_names_lower, ser_list, entity_id=uid, primary=(q_scope in ('primary', 'name_id'))):
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
    skill_filter = parse_list_ability_filter(args.get('skill_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    _cbc = browse_combo_from_character_args(args)
    short_ids = set()
    for cid, info in char_info_map.items():
        if not character_passes_browse_pool_filters(
            cid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, skill_filter, ability_filter, q_scope=_qsc, apply_lineage=False, apply_series=True, apply_skill=True,
            **_cbc,
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
    skill_filter = parse_list_ability_filter(args.get('skill_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    _cbc = browse_combo_from_character_args(args)
    ssm = ld.get('ser_set_map', {})
    sl = ld.get('series_list', [])
    cmap = ld.get('char_ser_map', {})
    seen = set()
    out = []
    for cid, info in char_info_map.items():
        if not character_passes_browse_pool_filters(
            cid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, skill_filter, ability_filter, q_scope=_qsc, apply_lineage=True, apply_series=False, apply_skill=True,
            **_cbc,
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
    weapon_range_filter = parse_unit_weapon_range_filter(args.get('weapon_range', '').strip())
    _cbu = browse_combo_from_unit_args(args)
    short_ids = set()
    for uid, info in unit_info_map.items():
        if not unit_passes_browse_pool_filters(
            uid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, ability_filter, terrain_filter, stat_mode,
            weapon_debuff_filter, weapon_range_filter=weapon_range_filter,
            q_scope=_qsc, apply_lineage=False, apply_series=True, apply_ability=True, apply_terrain=True,
            **_cbu,
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
    weapon_range_filter = parse_unit_weapon_range_filter(args.get('weapon_range', '').strip())
    _cbu = browse_combo_from_unit_args(args)
    ssm = ld.get('ser_set_map', {})
    sl = ld.get('series_list', [])
    seen = set()
    out = []
    for uid, info in unit_info_map.items():
        if not unit_passes_browse_pool_filters(
            uid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, ability_filter, terrain_filter, stat_mode,
            weapon_debuff_filter, weapon_range_filter=weapon_range_filter,
            q_scope=_qsc, apply_lineage=True, apply_series=False, apply_ability=True, apply_terrain=True,
            **_cbu,
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


def supporter_passes_browse_pool_filters(sid, info, ld, lc, sq, rarity_filter, lineage_filter, *, apply_lineage=True, lineage_combine='and'):
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
        if not id_seek and not supporter_matches_lineage_filter(sid, lineage_filter, ld, lc, lineage_combine):
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
    _slc = normalize_filter_combine_op(args.get('lineage_op'), 'and')
    llk = ld.get('lineage_lookup', {})
    ll = ld.get('lineage_list', [])
    snm = ld.get('series_name_map', {})
    by_id = {}
    for supp_id, info in supporter_info_map.items():
        if not supporter_passes_browse_pool_filters(supp_id, info, ld, lc, sq, rarity_filter, lineage_filter, apply_lineage=False, lineage_combine=_slc):
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
    skill_filter = parse_list_ability_filter(args.get('skill_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    _cbc = browse_combo_from_character_args(args)
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
            **_cbc,
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
    _x2n = _char_special_x2_filter_names(lc)
    if CHANCE_STEP_EX_ABILITY_IDS:
        seen[CHANCE_STEP_EX_FILTER_ID] = {'name': _x2n[CHANCE_STEP_EX_FILTER_ID], 'icon': CHANCE_STEP_EX_ICON}
    if SUPPORT_DEF_X2_CHARACTER_IDS:
        seen[SUPPORT_DEF_X2_FILTER_ID] = {'name': _x2n[SUPPORT_DEF_X2_FILTER_ID], 'icon': '/static/images/UI/UI_Common_BattleIcon_AssistDeffence_S.webp'}
    if SUPPORT_ATK_X2_CHARACTER_IDS:
        seen[SUPPORT_ATK_X2_FILTER_ID] = {'name': _x2n[SUPPORT_ATK_X2_FILTER_ID], 'icon': '/static/images/UI/UI_Common_BattleIcon_AssistAtack_S.webp'}
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
    skill_filter = parse_list_ability_filter(args.get('skill_id', '').strip())
    ability_filter = parse_list_ability_filter(args.get('ability_id', '').strip())
    _cbc = browse_combo_from_character_args(args)
    ldc = get_calc_lang_data()
    seen = {}
    passed_cids = set()
    failed_cids = set()
    sdc_placed = False
    chance_step_ex_present = False
    support_def_x2_present = False
    support_atk_x2_present = False
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
                lineage_filter, series_filter, skill_filter, ability_filter,
                q_scope=_qsc, apply_ability=False,
                **_cbc,
            ):
                failed_cids.add(cid)
                continue
            passed_cids.add(cid)
        if cid in SUPPORT_DEF_X2_CHARACTER_IDS:
            support_def_x2_present = True
        if cid in SUPPORT_ATK_X2_CHARACTER_IDS:
            support_atk_x2_present = True
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
    _x2n = _char_special_x2_filter_names(lc)
    if chance_step_ex_present:
        seen[CHANCE_STEP_EX_FILTER_ID] = {'name': _x2n[CHANCE_STEP_EX_FILTER_ID], 'icon': CHANCE_STEP_EX_ICON}
    if support_def_x2_present:
        seen[SUPPORT_DEF_X2_FILTER_ID] = {'name': _x2n[SUPPORT_DEF_X2_FILTER_ID], 'icon': '/static/images/UI/UI_Common_BattleIcon_AssistDeffence_S.webp'}
    if support_atk_x2_present:
        seen[SUPPORT_ATK_X2_FILTER_ID] = {'name': _x2n[SUPPORT_ATK_X2_FILTER_ID], 'icon': '/static/images/UI/UI_Common_BattleIcon_AssistAtack_S.webp'}
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
    weapon_range_filter = parse_unit_weapon_range_filter(args.get('weapon_range', '').strip())
    _cbu = browse_combo_from_unit_args(args)
    ldc = get_calc_lang_data()
    seen = {}
    for uid in unit_list_playable_ids:
        info = unit_info_map.get(uid)
        if not info:
            continue
        if not unit_passes_browse_pool_filters(
            uid, info, ld, lc, sq, role_filter, rarity_filter, source_filter,
            lineage_filter, series_filter, ability_filter, terrain_filter, stat_mode,
            weapon_debuff_filter, weapon_range_filter=weapon_range_filter,
            q_scope=_qsc, apply_ability=False, apply_terrain=True,
            **_cbu,
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
                ck = f"browse_filters_v13_{lc}_{entity}_cur_{sig}"
            else:
                ck = f"browse_filters_v13_{lc}_{entity}"
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
            ck = f"browse_filters_v13_{lc}_{entity}_cur_{sig}"
        else:
            ck = f"browse_filters_v13_{lc}_{entity}"
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
    ranking_bulk = request.args.get('ranking_bulk', '').strip().lower() in ('1', 'true', 'yes')
    if ranking_bulk:
        # Detail "show ranking" warms a full sorted pool in one round-trip (avoids dozens of capped page fetches).
        pp = min(50000, max(10, int(request.args.get('per_page', 50000))))
    else:
        pp = min(100, max(10, int(request.args.get('per_page', 50))))
    sb = request.args.get('sort', 'rarity'); sd = request.args.get('dir', 'desc')
    sq = request.args.get('q', '').strip().lower()
    q_scope = parse_q_scope(request.args.get('q_scope'))
    scope_ck = browse_q_scope_cache_letter(q_scope)
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
    skill_filter = parse_list_ability_filter(skill_arg)
    ability_arg = request.args.get('ability_id', '').strip()
    ability_filter = parse_list_ability_filter(ability_arg)
    _cbc = browse_combo_from_character_args(dict(request.args))
    lineage_ck = lineage_filter_cache_fragment(lineage_filter)
    series_ck = series_filter_cache_fragment(series_filter)
    skill_ck = ability_filter_cache_fragment(skill_filter)
    ability_ck = ability_filter_cache_fragment(ability_filter)
    grid_skills = request.args.get('grid_skills', '').strip().lower() in ('1', 'true', 'yes')
    want_stat_bounds = request.args.get('stat_bounds', '').strip().lower() in ('1', 'true', 'yes')
    sb_ck = 'sbd1' if want_stat_bounds else 'sbd0'
    rb_ck = 'rb1' if ranking_bulk else 'rb0'
    ck = f"cl32_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{scope_ck}_{role_ck}_{rk}_sp{1 if sp_list else 0}_c{1 if cond_list else 0}_{source_ck}_{lineage_ck}_{series_ck}_{skill_ck}_{ability_ck}_lop{_cbc['lineage_combine']}_sop{_cbc['series_combine']}_skop{_cbc['skill_combine']}_abop{_cbc['trait_combine']}_gs{1 if grid_skills else 0}_{sb_ck}_{rb_ck}_{lr_schedule_cache_key_fragment()}_{npc_view_cache_key_fragment()}"
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
            if not id_seek and not entity_matches_lineage(char_lin_map, cid, lineage_filter, _cbc['lineage_combine']):
                continue
        if series_filter is not None:
            if not id_seek and not entity_matches_series(ld.get('char_ser_map', {}).get(cid, ''), series_filter, lc, _cbc['series_combine']):
                continue
        if skill_filter is not None:
            if not id_seek and not entity_matches_char_skills(cid, skill_filter, _cbc['skill_combine']):
                continue
        if ability_filter is not None:
            if not id_seek and not entity_matches_char_abilities(cid, ability_filter, _cbc['trait_combine']):
                continue
        lid = ld['char_id_map'].get(cid, ''); name = ld['char_text_map'].get(lid, '') if lid else ''
        if not name: name = f"Unknown ({cid})"
        ser_list = resolve_series(ld.get('char_ser_map', {}).get(cid, ''), lc)
        ser_names_lower = series_names_lower_for_search(ser_list)
        if cid not in char_list_playable_ids and not id_seek:
            continue
        if not id_seek and not browse_entity_has_resolved_lineage_tags(char_lin_map, cid, lc, 'character'):
            continue
        if sq:
            search_chunks = []
            if q_scope == 'full':
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
            if q_scope == 'name_id':
                ss = f'{name} {cid}'.strip().lower()
            else:
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
                ).strip().lower()
            if not search_row_matches_query(sq, ss, ser_names_lower, ser_list, entity_id=cid, primary=(q_scope in ('primary', 'name_id'))):
                continue
        # Match get_character: only rarities 1–4 have SP growth / SP ability column; UR (5) always uses non-SP stats.
        has_sp_char = int(str(ri)) <= 4
        cr = CHAR_BROWSE_LIST_ROW_CACHE.get(cid)
        if cr:
            if sp_list and has_sp_char:
                totals, base_src = cr[('sp', cond_list)]
            else:
                totals, base_src = cr[('n', cond_list)]
        else:
            raw = char_stat_map.get(cid, {}); t = lambda s: raw.get(s, (0,0,0)); grown = {s: calc_growth_char(t(s)[0], t(s)[1], ri) for s in CHAR_STAT_ORDER}
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
        rows.append(row)
    rows = sort_rows(rows, sb, sd, {'name','role','rarity','Ranged','Melee','Awaken','Defense','Reaction'})
    stat_bounds = list_rows_stat_bounds(rows, sb) if want_stat_bounds else None
    total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
    start = (page - 1) * pp; pr = rows[start:start + pp]
    if grid_skills:
        for row in pr:
            _cid = row['id']
            _ri = row.get('rarity_id', '1')
            _hsp = int(str(_ri)) <= 4
            row['grid_skills'] = collect_character_grid_skills(_cid, ld, use_sp=bool(sp_list and _hsp))
    result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd, 'role_filter': role_arg, 'rarity_filter': rav, 'source_filter': source_arg, 'lineage_filter': lineage_arg, 'series_filter': series_arg, 'skill_filter': skill_arg, 'stat_bounds': stat_bounds}
    set_cached_response(ck, result); return jsonify(convert_image_urls(result))


def unit_list_recommend_character_brief(uid, info, ld, lc):
    """Minimal recommended pilot for unit list rows (Team Builder uses before full /api/unit load)."""
    rec_cid = normalize_id(info.get('recommend_character_id') or '0')
    if rec_cid == '0':
        rec_cid = normalize_id(MANUAL_UNIT_RECOMMEND_CHARACTER_MAP.get(uid, '0'))
    if rec_cid == '0' or rec_cid not in char_info_map:
        return None
    cinfo = char_info_map[rec_cid]
    if entity_hidden_by_lr_schedule_lock(cinfo.get('schedule_id', '0')):
        return None
    clid = ld.get('char_id_map', {}).get(rec_cid, '')
    cname = ld.get('char_text_map', {}).get(clid, '') if clid else ''
    if not cname:
        cname = f'Unknown ({rec_cid})'
    cthum = find_list_thumb(cinfo.get('resource_ids', []), rec_cid, 'images/portraits')
    return {'id': rec_cid, 'name': cname, 'thum': cthum or ''}


@app.route('/api/units')
def list_units():
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
    sb = request.args.get('sort', 'rarity'); sd = request.args.get('dir', 'desc')
    sq = request.args.get('q', '').strip().lower()
    q_scope = parse_q_scope(request.args.get('q_scope'))
    scope_ck = browse_q_scope_cache_letter(q_scope)
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
    weapon_range_arg = request.args.get('weapon_range', '').strip()
    weapon_range_filter = parse_unit_weapon_range_filter(weapon_range_arg)
    mechanism_arg = request.args.get('mechanism', '').strip()
    mechanism_filter = parse_unit_mechanism_filter(mechanism_arg)
    mechanism_combine = normalize_filter_combine_op(request.args.get('mechanism_op'), 'and')
    _cbu = browse_combo_from_unit_args(dict(request.args))
    lineage_ck = lineage_filter_cache_fragment(lineage_filter)
    series_ck = series_filter_cache_fragment(series_filter)
    ability_ck = ability_filter_cache_fragment(ability_filter)
    terrain_ck = unit_terrain_filter_cache_fragment(terrain_filter)
    weapon_debuff_ck = unit_weapon_debuff_filter_cache_fragment(weapon_debuff_filter)
    weapon_range_ck = unit_weapon_range_filter_cache_fragment(weapon_range_filter)
    mechanism_ck = unit_mechanism_filter_cache_fragment(mechanism_filter)
    grid_skills_u = request.args.get('grid_skills', '').strip().lower() in ('1', 'true', 'yes')
    tb_boost = normalize_id(request.args.get('tb_boost_supporter', '').strip())
    if not tb_boost or tb_boost not in supporter_info_map:
        tb_boost = None
    ranking_bulk_u = request.args.get('ranking_bulk', '').strip().lower() in ('1', 'true', 'yes')
    # Team builder: boosted-only lists can exceed 100 rows (UR first); raise cap so SSR etc. are not truncated.
    if ranking_bulk_u:
        pp = min(50000, max(10, int(request.args.get('per_page', 50000))))
    else:
        _pp_cap = 600 if tb_boost else 100
        pp = min(_pp_cap, max(10, int(request.args.get('per_page', 50))))
    tb_boost_ck = f'tb{tb_boost}' if tb_boost else 'tb0'
    want_stat_bounds_u = request.args.get('stat_bounds', '').strip().lower() in ('1', 'true', 'yes')
    sbu_ck = 'sbd1' if want_stat_bounds_u else 'sbd0'
    rb_u_ck = 'rb1' if ranking_bulk_u else 'rb0'
    ck = f"ul41_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{scope_ck}_{role_ck}_{rk}_{stat_mode}_c{1 if cond_list else 0}_{source_ck}_{lineage_ck}_{series_ck}_{ability_ck}_{terrain_ck}_{weapon_debuff_ck}_{weapon_range_ck}_{mechanism_ck}_lop{_cbu['lineage_combine']}_sop{_cbu['series_combine']}_aop{_cbu['ability_combine']}_top{_cbu['terrain_combine']}_wop{_cbu['weapon_debuff_combine']}_wrop{_cbu['weapon_range_combine']}_mop{mechanism_combine}_gs{1 if grid_skills_u else 0}_{tb_boost_ck}_{sbu_ck}_{rb_u_ck}_{lr_schedule_cache_key_fragment()}_{npc_view_cache_key_fragment()}"
    cached = get_cached_response(ck)
    if cached: return jsonify(cached)
    ld = get_lang_data(lc); ldc = get_calc_lang_data(); rows = []
    _debuff_memo = {}
    mechanism_union = set()
    for uid, info in unit_info_map.items():
        if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
            continue
        ri = info.get('rarity','1'); role_id = info.get('role','0')
        id_seek = bool(sq and search_query_matches_entity_id(sq, uid))
        if role_id == '0' and not (id_seek and npc_password_unlocked()):
            continue
        if not unit_has_ms_ability_content(uid) and not (id_seek and npc_password_unlocked()):
            continue
        _muid = normalize_id(info.get('main_unit_id', uid))
        if _muid == '0':
            _muid = uid
        if uid != _muid and not id_seek:
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
                if not row_matches_rarity_filter(
                    rarity_filter, letter, lim, bool(info.get('is_ultimate', False)),
                ):
                    continue
        acq_route = str(info.get('acquisition_route', '0'))
        if source_filter is not None:
            if not id_seek and not entity_matches_source_category(acq_route, role_id, source_filter):
                continue
        if terrain_filter is not None:
            if not id_seek and not unit_matches_terrain_filter(uid, info, terrain_filter, stat_mode, _cbu['terrain_combine']):
                continue
        if lineage_filter is not None:
            if not id_seek and not entity_matches_lineage(unit_lin_map, uid, lineage_filter, _cbu['lineage_combine']):
                continue
        if series_filter is not None:
            if not id_seek and not entity_matches_series(unit_ser_map.get(uid, ''), series_filter, lc, _cbu['series_combine']):
                continue
        if ability_filter is not None:
            if not id_seek and not entity_matches_unit_abilities_filter(uid, ability_filter, _cbu['ability_combine']):
                continue
        lid = ld['unit_id_map'].get(uid, ''); name = ld['unit_text_map'].get(lid, '') if lid else ''
        if not name:
            name = f'Unknown ({uid})'
        ser_list = resolve_series(unit_ser_map.get(uid, ''), lc)
        ser_names_lower = series_names_lower_for_search(ser_list)
        if uid not in unit_list_playable_ids and not id_seek:
            continue
        if not id_seek and not browse_entity_has_resolved_lineage_tags(unit_lin_map, uid, lc, 'unit'):
            continue
        if sq:
            search_chunks = []
            if q_scope == 'full':
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
                mod = collect_unit_model_search_text(info)
                if mod:
                    search_chunks.append(mod)
                mech = collect_unit_mechanism_search_text(info, ld, uid)
                if mech:
                    search_chunks.append(mech)
                wtxt = collect_unit_weapons_search_text(uid, ld, lc)
                if wtxt:
                    search_chunks.append(wtxt)
            if q_scope == 'name_id':
                ss = f'{name} {uid}'.strip()
            else:
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
                ).strip()
            ss = (ss + (UNIT_SEARCH_HAYSTACK_EXTRA_BY_ID.get(uid, ''))).strip().lower()
            if not search_row_matches_query(sq, ss, ser_names_lower, ser_list, entity_id=uid, primary=(q_scope in ('primary', 'name_id'))):
                continue
        _ld_f, _lc_f = _lang_data_for_weapon_debuff_filter(ld, lc)
        wmap = UNIT_WEAPON_DEBUFF_KEYS_CACHE.get(lc)
        if wmap is not None and uid in wmap:
            trait_dk = wmap[uid]
        else:
            trait_dk = collect_unit_weapon_trait_only_debuff_keys(uid, _ld_f, _lc_f)
        range_dk = collect_unit_weapon_range_debuff_keys(uid, _ld_f, _lc_f, stat_mode)
        dk = frozenset(set(trait_dk) | set(range_dk))
        _debuff_memo[uid] = dk
        if weapon_debuff_filter:
            if not id_seek and not unit_matches_weapon_debuff_filter(uid, ld, lc, weapon_debuff_filter, _debuff_memo, stat_mode, combine=_cbu['weapon_debuff_combine']):
                continue
        if weapon_range_filter is not None:
            if not id_seek and not unit_matches_weapon_range_filter(uid, ld, lc, weapon_range_filter, stat_mode, combine=_cbu['weapon_range_combine']):
                continue
        mechanism_union |= set(UNIT_MECHANISM_MIDS_CACHE.get(uid, collect_unit_mechanism_mids(info, uid)))
        if mechanism_filter:
            if not id_seek and not unit_matches_mechanism_filter(info, mechanism_filter, uid, combine=mechanism_combine):
                continue
        ue = UNIT_BROWSE_LIST_ROW_CACHE.get(uid)
        if ue:
            if stat_mode == 'normal' and not cond_list:
                fs = ue['nc']
            else:
                lb = ue['lb']
                sm = stat_mode if stat_mode != 'normal' else 'normal'
                fs = _unit_lb_row_to_api(lb, sm, cond_list) if lb else ue['nc']
        else:
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
        _rec_brief = unit_list_recommend_character_brief(uid, info, ld, lc)
        if _rec_brief:
            urow['recommend_character'] = _rec_brief
        rows.append(urow)
    if tb_boost:
        def _tb_unit_leader_boosted(row):
            uid = normalize_id(row.get('id'))
            return supporter_leader_applies_to_unit(tb_boost, uid, ld, lc, None)

        def _tb_rarity_name_key(r):
            return (-(r.get('rarity_sort') or 4), (r.get('name') or '').lower())

        if sq:
            boosted = [r for r in rows if _tb_unit_leader_boosted(r)]
            other = [r for r in rows if not _tb_unit_leader_boosted(r)]
            boosted.sort(key=_tb_rarity_name_key)
            other.sort(key=_tb_rarity_name_key)
            rows = boosted + other
        else:
            rows = [r for r in rows if _tb_unit_leader_boosted(r)]
            rows.sort(key=_tb_rarity_name_key)
    else:
        rows = sort_rows(rows, sb, sd, {'name', 'role', 'rarity', 'ATK', 'DEF', 'MOB', 'HP', 'EN', 'MOV'})
    stat_bounds = list_rows_stat_bounds(rows, sb) if want_stat_bounds_u else None
    total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
    start = (page - 1) * pp; pr = rows[start:start + pp]
    if grid_skills_u:
        for urow in pr:
            _uid = urow['id']
            urow['grid_abilities'] = collect_unit_grid_abilities(_uid, ld, ldc, lc, stat_mode)
    # Full weapon-debuff filter catalog exposed to the UI (keys omitted here are not used in-game yet).
    _wbp = sorted(UNIT_WEAPON_DEBUFF_FILTER_KEYS)
    _mech_rows = mechanism_list_filter_rows_from_ids(mechanism_union, ld)
    result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd, 'role_filter': role_arg, 'rarity_filter': rav, 'source_filter': source_arg, 'lineage_filter': lineage_arg, 'series_filter': series_arg, 'ability_filter': ability_arg, 'terrain_filter': terrain_arg, 'weapon_debuff': weapon_debuff_arg, 'weapon_range': weapon_range_arg, 'weapon_debuff_present_keys': _wbp, 'mechanism': mechanism_arg, 'mechanism_present': _mech_rows, 'stat_bounds': stat_bounds}
    set_cached_response(ck, result); return jsonify(convert_image_urls(result))

# Option part trait text → primary stat groups (matches front-end _dcParseOptionPartBonuses + TW phrasing).
_OP_PART_STAT_INCREASE_RE = re.compile(
    r'(?:Increase|Increases?)\s+(?:squad\s+)?(?:own\s+)?(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move)(?:\s*,\s*(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move))*(?:\s+and\s+(?:Max\s+)?(HP|EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move))?\s+by\s*(\d+)(%?)',
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
        thum = f"/static/images/Option-Part (Modification)/Sprite/{res_id}.webp" if res_id else ''
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
        for_unit = None
        u_arg = request.args.get('unit_id', '').strip()
        if u_arg:
            u = normalize_id(u_arg)
            if u in unit_info_map:
                for_unit = u
        uf = f"u{for_unit}" if for_unit else 'u0'
        ck = f"op6_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{rf}_{ef}_{uf}"
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
        ld = get_lang_data(lc); op_text_map = ld.get('op_text_map', {}); ltm = ld.get('lang_text_map', {})
        rows = []
        for item in extract_data_list(option_parts_data):
            if not isinstance(item, dict): continue
            opid = str(item.get('Id') or item.get('id', 0))
            if opid == '0': continue
            if for_unit and not option_part_matches_unit(opid, for_unit, lc):
                continue
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
            base_tags = resolve_lineage_ids_to_tag_dicts(lineage_ids, ld, tt='unit')
            base_tags = merge_option_part_tags_with_series(base_tags, item.get('SeriesId') or item.get('seriesId'), ld)
            variant_ids = _option_part_variant_tag_ids(opid)
            if not variant_ids:
                variant_ids = ['']
            if ef != 'ALL' and not option_part_matches_effect_filter(details, ef):
                continue
            res_id = str(item.get('ResourceId') or item.get('resourceId') or '').strip()
            icon = f"/static/images/Option-Part (Modification)/Sprite/{res_id}.webp" if res_id else ''
            for vid in variant_ids:
                tags = list(base_tags)
                vnorm = normalize_id(vid)
                if vnorm:
                    vname = (ld.get('lineage_lookup', {}) or {}).get(vnorm, '')
                    if vname and not any(normalize_id(t.get('id')) == vnorm for t in tags):
                        tags.append({'id': vnorm, 'name': vname, 'type': 'unit', 'source': 'variant'})
                tags_join = ', '.join(t['name'] for t in tags)
                tags_str = ' '.join(t['name'] for t in tags)
                if sq:
                    searchable = f"{name} {details} {tags_str}".lower()
                    tag_blob = [tags_str.lower()] if tags_str else []
                    if not search_row_matches_query(sq, searchable, tag_blob, entity_id=opid):
                        continue
                rows.append({'id': opid, 'name': name, 'details': details, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_id': ri, 'rarity_sort': RARITY_SORT.get(ri, 4), 'rarity_icon': RARITY_ICON_MAP.get(ri, ''), 'thum': icon, 'tags': tags, 'tags_join': tags_join, 'variant_tag_id': vnorm if vnorm != '0' else ''})
        rows = sort_rows(rows, sb, sd, {'name', 'rarity', 'details', 'tags'})
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


def _find_option_part_master_item(op_id_raw):
    want = normalize_id(op_id_raw)
    for item in extract_data_list(option_parts_data or []):
        if not isinstance(item, dict):
            continue
        oid = str(item.get('Id') or item.get('id', 0))
        if oid == want:
            return item
    return None


def _option_part_conditional_phrase_likely_present(text):
    blob = (text or '').lower()
    if not blob:
        return False
    hints = (
        ' when ', ' if ', '[condition',
        'when equipped',
        '當', '装备', '裝備', '時', '条件',
    )
    return any(h in blob for h in hints)


def _option_part_desc_uses_placeholder_tag_phrase(text):
    blob = (text or '').lower()
    if not blob:
        return False
    return (
        'specified tag' in blob
        or 'specified tags' in blob
        or ('指定' in (text or '') and 'タグ' in (text or ''))
        or ('指定' in (text or '') and '標籤' in (text or ''))
    )


def _option_part_condition_line_from_tags(tags, lc):
    names = [str(t.get('name') or '').strip() for t in (tags or []) if str(t.get('name') or '').strip()]
    if not names:
        return ''
    if lc in ('TW', 'HK'):
        return f"裝備於擁有以下標籤的機體時：{', '.join(names)}"
    if lc in ('JA', 'JP'):
        return f"以下タグを持つユニット装備時：{', '.join(names)}"
    return f"When equipped to a Unit possessing: {', '.join(names)}."


def _option_part_variant_tag_ids(opid):
    # No synthetic duplicates by default.
    return []


def _apply_option_part_condition_variant(opid, active_cid, cond_tags, variant_tag_id):
    out = list(cond_tags or [])
    oid = normalize_id(opid)
    vcid = normalize_id(active_cid)
    vtag = normalize_id(variant_tag_id)
    # Variant only applies to 400012 second trait condition.
    if oid == '400012' and vcid == '1000121' and vtag in ('1005', '1006'):
        out = [t for t in out if normalize_id((t or {}).get('id')) == vtag]
    return out


def _build_option_part_details(item, lc, ld, variant_tag_id=''):
    ltm = ld.get('lang_text_map', {})
    llk = ld.get('lineage_lookup', {})
    snm = ld.get('series_name_map', {})
    opid = normalize_id(item.get('Id') or item.get('id'))
    trait_set_id = normalize_id(item.get('TraitSetId') or item.get('traitSetId'))
    trait_ids = trait_set_traits_map.get(trait_set_id, [])
    lines = []
    for tid in trait_ids:
        tdata = trait_data_map.get(tid, {})
        dlid = tdata.get('desc_lang_id', '')
        desc = (ltm.get(dlid, '') or '').strip() if dlid else ''
        if not desc:
            continue
        lines.append(desc)
        active_cid = tdata.get('active_cond_id', '0')
        cond_tags = resolve_condition_tags(active_cid, trait_condition_raw_map, llk, snm, lc)
        cond_tags = _apply_option_part_condition_variant(opid, active_cid, cond_tags, variant_tag_id)
        cond_line = _option_part_condition_line_from_tags(cond_tags, lc)
        suppress_condition_line = normalize_id(opid) in ('400012', '400069')
        if (not suppress_condition_line) and cond_line and (
            (not _option_part_conditional_phrase_likely_present(desc))
            or _option_part_desc_uses_placeholder_tag_phrase(desc)
        ):
            lines.append(cond_line)
    return '\n'.join(lines).strip()


def _collect_option_part_condition_tags(item, lc, ld, variant_tag_id=''):
    llk = ld.get('lineage_lookup', {})
    snm = ld.get('series_name_map', {})
    opid = normalize_id(item.get('Id') or item.get('id'))
    trait_set_id = normalize_id(item.get('TraitSetId') or item.get('traitSetId'))
    trait_ids = trait_set_traits_map.get(trait_set_id, [])
    out = []
    seen = set()
    for tid in trait_ids:
        tdata = trait_data_map.get(tid, {})
        active_cid = tdata.get('active_cond_id', '0')
        cond_tags = resolve_condition_tags(active_cid, trait_condition_raw_map, llk, snm, lc)
        cond_tags = _apply_option_part_condition_variant(opid, active_cid, cond_tags, variant_tag_id)
        for tg in cond_tags:
            if not isinstance(tg, dict):
                continue
            k = (normalize_id(tg.get('id')), str(tg.get('name') or '').strip())
            if (k[0] == '0' and not k[1]) or k in seen:
                continue
            seen.add(k)
            out.append({'id': normalize_id(tg.get('id')), 'name': str(tg.get('name') or '').strip(), 'type': tg.get('type') or 'unit', 'source': tg.get('source') or 'condition'})
    return out


def _find_tower_event_stage_name(target_id, ld):
    tid = normalize_id(target_id)
    ttm = ld.get('tower_stage_text_map', {}) or {}
    for row in extract_data_list(tower_event_stage_data or []):
        if not isinstance(row, dict):
            continue
        rid = normalize_id(row.get('Id') or row.get('id'))
        if rid != tid:
            continue
        nlid = normalize_id(row.get('StageNameLanguageId') or row.get('stageNameLanguageId'))
        return (ttm.get(nlid, '') or '').strip()
    return ''


def _find_eternal_stage_name(target_id, ld):
    sid = normalize_id(target_id)
    est = eternal_stage_map.get(sid, {})
    nlid = normalize_id(est.get('stage_name_lang_id') if isinstance(est, dict) else '0')
    return (ld.get('stage_text_map', {}) or {}).get(nlid, '').strip()


def _extract_fierce_enemy_name(detail_text, lc):
    txt = str(detail_text or '').strip()
    if not txt:
        return ''
    if lc in ('TW', 'HK'):
        m = re.search(r'裝備於(.+?)時', txt)
        return m.group(1).strip() if m else ''
    if lc in ('JA', 'JP'):
        m = re.search(r'(.+?)に装備時', txt)
        return m.group(1).strip() if m else ''
    for line in txt.splitlines():
        if 'when equipped to' not in line.lower():
            continue
        name = re.sub(r'^.*when equipped to\s+', '', line, flags=re.IGNORECASE).strip()
        name = name.rstrip('.').strip()
        if name:
            return name
    return ''


def _option_part_acquisition_label(lc):
    if lc in ('TW', 'HK'):
        return '獲取方式'
    if lc in ('JA', 'JP'):
        return '入手方法'
    return 'Acquisition method'


def _build_option_part_acquisition_methods(opid, lc, ld, detail_text):
    methods = []
    oid = normalize_id(opid)
    for row in extract_data_list(option_parts_acquisition_method_data or []):
        if not isinstance(row, dict):
            continue
        rid = normalize_id(row.get('OptionPartsId') or row.get('optionPartsId'))
        if rid != oid:
            continue
        typ = normalize_id(row.get('AcquisitionMethodTypeIndex') or row.get('acquisitionMethodTypeIndex'))
        tid = normalize_id(row.get('TargetId') or row.get('targetId'))
        if typ == '3':
            st_name = _find_eternal_stage_name(tid, ld)
            methods.append(f'Clear Eternal Road Expert Stage "{st_name}" reward' if st_name else 'Eternal Road')
        elif typ == '14':
            methods.append('G-Shop')
        elif typ == '19':
            methods.append('Story Event Reward')
        elif typ == '21':
            st_name = _find_tower_event_stage_name(tid, ld)
            methods.append(f'Clear Stage "{st_name}"' if st_name else 'Tower Event')
        elif typ == '22':
            enemy_name = _extract_fierce_enemy_name(detail_text, lc)
            if enemy_name:
                methods.append(f'Clear Stage "Fierce Enemy Assault Vs. {enemy_name} (Challenge) Level 8"')
            else:
                methods.append('Fierce Enemy Assault (Challenge) Level 8')
    # Keep stable order while deduplicating.
    seen = set()
    out = []
    for m in methods:
        if m not in seen:
            seen.add(m)
            out.append(m)
    return out


def _option_part_detail_row(item, lc, variant_tag_id=''):
    """Single option part JSON (same shape as list rows) for detail API."""
    if not isinstance(item, dict):
        return None
    opid = str(item.get('Id') or item.get('id', 0))
    if opid == '0':
        return None
    ld = get_lang_data(lc)
    op_text_map = ld.get('op_text_map', {})
    ri = str(item.get('RarityTypeIndex') or 1)
    name_lid = normalize_id(item.get('SortNameLanguageId') or item.get('sortNameLanguageId'))
    name = op_text_map.get(name_lid, '') if name_lid else ''
    if not name:
        name = f'Option Part {opid}'
    details = _build_option_part_details(item, lc, ld, variant_tag_id)
    lineage_ids = option_parts_lineage_map.get(opid, [])
    tags = resolve_lineage_ids_to_tag_dicts(lineage_ids, ld, tt='unit')
    tags = merge_option_part_tags_with_series(tags, item.get('SeriesId') or item.get('seriesId'), ld)
    condition_tags = _collect_option_part_condition_tags(item, lc, ld, variant_tag_id)
    vtag = normalize_id(variant_tag_id)
    if vtag != '0':
        vname = (ld.get('lineage_lookup', {}) or {}).get(vtag, '')
        if vname and not any(normalize_id(t.get('id')) == vtag for t in tags):
            tags.append({'id': vtag, 'name': vname, 'type': 'unit', 'source': 'variant'})
    tags_join = ', '.join(t['name'] for t in tags)
    res_id = str(item.get('ResourceId') or item.get('resourceId') or '').strip()
    icon = f"/static/images/Option-Part (Modification)/Sprite/{res_id}.webp" if res_id else ''
    acquisition_methods = _build_option_part_acquisition_methods(opid, lc, ld, details)
    # OP fix: all Haro option parts use this acquisition method label.
    if 'haro' in (name or '').lower():
        acquisition_methods = ['Limited Time Special Character Request']
    return {
        'id': opid,
        'name': name,
        'details': details,
        'rarity': RARITY_MAP.get(ri, 'N'),
        'rarity_id': ri,
        'rarity_sort': RARITY_SORT.get(ri, 4),
        'rarity_icon': RARITY_ICON_MAP.get(ri, ''),
        'thum': icon,
        'tags': tags,
        'condition_tags': condition_tags,
        'tags_join': tags_join,
        'variant_tag_id': vtag if vtag != '0' else '',
        'acquisition_method_label': _option_part_acquisition_label(lc),
        'acquisition_methods': acquisition_methods,
        'lang': lc,
    }


@app.route('/api/option_part/<option_part_id>')
def get_option_part(option_part_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        variant_tag_id = normalize_id(request.args.get('variant_tag', '0'))
        item = _find_option_part_master_item(option_part_id)
        if not item:
            return jsonify({'error': 'Not found'}), 404
        row = _option_part_detail_row(item, lc, variant_tag_id=variant_tag_id)
        if not row:
            return jsonify({'error': 'Not found'}), 404
        return jsonify(convert_image_urls(row))
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/supporters')
def list_supporters():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
        pp = min(100, max(10, int(request.args.get('per_page', 50)))); sb = request.args.get('sort', 'rarity'); sd = request.args.get('dir', 'desc')
        sq = request.args.get('q', '').strip().lower()
        rav = request.args.get('rarity', '').strip(); rarity_filter = parse_list_rarity_filter(rav); rk = rarity_filter_cache_fragment(rarity_filter)
        lineage_arg = request.args.get('lineage_id', '').strip()
        lineage_filter = parse_list_lineage_filter(lineage_arg)
        lineage_combine_supp = normalize_filter_combine_op(request.args.get('lineage_op'), 'and')
        lineage_ck = lineage_filter_cache_fragment(lineage_filter)
        uids = []
        cids = []
        u_bulk = (request.args.get('unit_ids') or '').strip()
        c_bulk = (request.args.get('char_ids') or '').strip()
        if u_bulk:
            for part in u_bulk.split(','):
                u = normalize_id(part.strip())
                if u and u in unit_info_map:
                    uids.append(u)
            c_parts = [p.strip() for p in c_bulk.split(',')] if c_bulk else []
            for i in range(len(uids)):
                cid = None
                if i < len(c_parts) and c_parts[i]:
                    cc = normalize_id(c_parts[i])
                    if cc in char_info_map:
                        cid = cc
                cids.append(cid)
        for_unit = None
        u_arg = request.args.get('unit_id', '').strip()
        if u_arg and not uids:
            u = normalize_id(u_arg)
            if u in unit_info_map:
                for_unit = u
        for_char = None
        c_arg = request.args.get('character_id', '').strip()
        if c_arg and not uids:
            c = normalize_id(c_arg)
            if c in char_info_map:
                for_char = c
        if uids:
            uf = 'm' + hashlib.md5(
                (','.join(uids) + '|' + ','.join((c or '') for c in cids)).encode('utf-8')
            ).hexdigest()[:16]
            cf = 'c0'
        else:
            uf = f"u{for_unit}" if for_unit else 'u0'
            cf = f"c{for_char}" if for_char else 'c0'
        ck = f"sl9_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{rk}_{lineage_ck}_lc{lineage_combine_supp}_{lr_schedule_cache_key_fragment()}_{uf}_{cf}"
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
                if not id_seek and not supporter_matches_lineage_filter(sid, lineage_filter, ld, lc, lineage_combine_supp):
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
            searchable_lower = f"{name} {sts}".lower().strip()
            ser_names_lower = [t['name'].lower() for t in all_tags if t.get('name')]
            sq_matches = search_row_matches_query(sq, searchable_lower, ser_names_lower, entity_id=sid) if sq else True
            if uids:
                if not id_seek:
                    applies_any = False
                    for i, uid in enumerate(uids):
                        cid = cids[i] if i < len(cids) else None
                        if supporter_leader_applies_to_unit(sid, uid, ld, lc, cid):
                            applies_any = True
                            break
                    if not applies_any and not (sq and sq_matches):
                        continue
            elif for_unit and not id_seek:
                applies = supporter_leader_applies_to_unit(sid, for_unit, ld, lc, for_char)
                if not applies and not (sq and sq_matches):
                    continue
            if rarity_filter is not None:
                if not rarity_filter:
                    continue
                letter = RARITY_MAP.get(str(ri), 'N')
                if not row_matches_rarity_filter(rarity_filter, letter, lim):
                    continue
            if sq and not sq_matches:
                continue
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
    return latest_release_schedule_would_lock(schedule_id, start_ms)


def latest_release_schedule_would_lock(schedule_id, start_ms):
    """Same rules as LR lock, but ignores session (used for Eternal Road gated content)."""
    if not LATEST_RELEASE_PASSWORD:
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


_build_browse_list_performance_caches()


def eternal_stage_before_mstage_schedule_release(stage_id):
    """True when now is before m_schedule.StartDatetime for this stage's m_stage.ScheduleId."""
    sid = normalize_id(stage_id)
    sched = normalize_id(stage_map.get(sid, {}).get('schedule_id', '0'))
    if sched in ('0', '9999990001'):
        return False
    try:
        start_ms = int(schedule_start_ms_by_id.get(sched, 0) or 0)
    except (TypeError, ValueError):
        start_ms = 0
    if start_ms <= 0:
        return False
    return int(time.time() * 1000) < start_ms


def _any_eternal_stage_before_mstage_schedule_release():
    for _esid in eternal_stage_map.keys():
        if eternal_stage_before_mstage_schedule_release(_esid):
            return True
    return False


def eternal_stage_is_gated(stage_id, est):
    """True if this stage is behind a release gate (env date, m_stage schedule start, and/or legacy strategy schedule + LR rules), ignoring session."""
    sid = normalize_id(stage_id)
    unlock = ETERNAL_STAGE_LOCK_UNTIL_MS_MAP.get(sid)
    if unlock is not None:
        now_ms = int(time.time() * 1000)
        if now_ms < int(unlock):
            return True
    if eternal_stage_before_mstage_schedule_release(sid):
        return True
    sched = normalize_id((est or {}).get('strategy_info_schedule_id', '0'))
    if sched in ('0', '9999990001'):
        return False
    try:
        sm = int(schedule_start_ms_by_id.get(sched, 0) or 0)
    except (TypeError, ValueError):
        sm = 0
    if sm <= 0:
        return False
    return latest_release_schedule_would_lock(sched, sm)


def eternal_stage_content_visible(stage_id, est):
    """Full stage payload allowed for this request (password / LR bypass when configured)."""
    if not eternal_stage_is_gated(stage_id, est):
        return True
    if ETERNAL_STAGE_PASSWORD and session.get('eternal_stages_unlocked') is True:
        return True
    if ETERNAL_STAGE_LOCK_RESPECT_LR_UNLOCK and LATEST_RELEASE_PASSWORD and session.get('lr_unlocked') is True:
        return True
    return False


def eternal_stage_session_cache_key_fragment():
    """Vary list/detail caches when eternal stage password session toggles."""
    if not ETERNAL_STAGE_PASSWORD:
        return 'es0'
    return 'es1' if session.get('eternal_stages_unlocked') is True else 'es2'


def eternal_stage_list_cache_time_fragment():
    """Short cache buckets while a time-based ER gate may flip (env dates and/or m_stage schedule starts)."""
    parts = []
    if ETERNAL_STAGE_LOCK_UNTIL_MS_MAP:
        parts.append('t' + str(int(time.time() // 300)))
    if _any_eternal_stage_before_mstage_schedule_release():
        parts.append('s' + str(int(time.time() // 60)))
    return ('_' + '_'.join(parts)) if parts else ''


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


@app.route('/api/eternal_stages/status')
def api_eternal_stages_status():
    if not ETERNAL_STAGE_PASSWORD:
        return jsonify({'password_required': False, 'unlocked': True})
    return jsonify({'password_required': True, 'unlocked': session.get('eternal_stages_unlocked') is True})


@app.route('/api/eternal_stages/unlock', methods=['POST'])
def api_eternal_stages_unlock():
    if not ETERNAL_STAGE_PASSWORD:
        return jsonify({'ok': True, 'password_required': False})
    data = request.get_json(force=True, silent=True) or {}
    pw = (data.get('password') or '').strip()
    if pw != ETERNAL_STAGE_PASSWORD:
        return jsonify({'ok': False, 'error': 'invalid_password'}), 403
    session['eternal_stages_unlocked'] = True
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
    ck = f"lr_v8_{lc}_{wm_ck}_{scope}_{1 if unlocked else 0}"
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
        _muid = normalize_id(info.get('main_unit_id', uid))
        if _muid == '0':
            _muid = uid
        if uid != _muid:
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


def format_banner_duration_ms(delta_ms):
    """Human-readable duration from a non-negative millisecond delta."""
    if delta_ms is None:
        return ''
    try:
        dms = int(delta_ms)
    except (TypeError, ValueError):
        return ''
    if dms < 0:
        return ''
    sec = dms // 1000
    days, sec = divmod(sec, 86400)
    hours, sec = divmod(sec, 3600)
    minutes, sec = divmod(sec, 60)
    parts = []
    if days:
        parts.append(f'{days}d')
    if hours:
        parts.append(f'{hours}h')
    if minutes and not days and not hours:
        parts.append(f'{minutes}m')
    if not parts:
        parts.append(f'{sec}s' if sec else '0s')
    return ' '.join(parts)


def _banner_timeline_image_suffix(lc):
    return {'EN': 'en', 'TW': 'tw', 'HK': 'hk', 'JA': 'ja', 'JP': 'ja'}.get(lc, 'en')


def _banner_timeline_unit_item(uid, ld):
    uid = normalize_id(uid)
    info = unit_info_map.get(uid)
    if not info:
        return None
    if uid not in unit_list_playable_ids:
        return None
    if info.get('role', '0') == '0':
        return None
    _muid = normalize_id(info.get('main_unit_id', uid))
    if _muid == '0':
        _muid = uid
    if uid != _muid:
        return None
    lid = ld['unit_id_map'].get(uid, '')
    name = ld['unit_text_map'].get(lid, '') if lid else ''
    if not name:
        return None
    ri = info.get('rarity', '1')
    acq = info.get('acquisition_route', '0')
    ai = ACQUISITION_ROUTE_ICONS.get(acq, '')
    si = [ai] if ai else []
    role_id = info.get('role', '0')
    thum = find_list_thumb(info.get('resource_ids', []), uid, 'images/unit_portraits')
    return {
        'type': 'unit', 'id': uid, 'name': name, 'thum': thum or '',
        'rarity': RARITY_MAP.get(str(ri), 'N'), 'rarity_id': str(ri),
        'role_icon': ROLE_ICON_MAP.get(role_id, ''),
        'acquisition_icon': ai or '', 'special_icons': si,
        'is_ultimate': bool(info.get('is_ultimate', False)),
        'is_limited_time': uid in LIMITED_TIME_UNIT_IDS,
    }


def _banner_timeline_char_item(cid, ld):
    cid = normalize_id(cid)
    if cid not in char_info_map or cid not in char_list_playable_ids:
        return None
    info = char_info_map.get(cid, {})
    if info.get('role', '0') == '0':
        return None
    lid = ld['char_id_map'].get(cid, '')
    name = ld['char_text_map'].get(lid, '') if lid else ''
    if not name:
        return None
    ri = info.get('rarity', '1')
    acq = info.get('acquisition_route', '0')
    acq_icon = ACQUISITION_ROUTE_ICONS.get(acq, '')
    role_id = info.get('role', '0')
    thum = find_list_thumb(info.get('resource_ids', []), cid, 'images/portraits')
    return {
        'type': 'character', 'id': cid, 'name': name, 'thum': thum or '',
        'rarity': RARITY_MAP.get(str(ri), 'N'), 'rarity_id': str(ri),
        'role_icon': ROLE_ICON_MAP.get(role_id, ''),
        'acquisition_icon': acq_icon or '',
        'is_limited_time': cid in LIMITED_TIME_CHARACTER_IDS,
    }


def _banner_timeline_supporter_item(sid, ld):
    """Pickup row GashaContentDetailId starting with '2' rewards a supporter via RewardTargetId."""
    sid = normalize_id(sid)
    if sid not in supporter_info_map:
        return None
    info = supporter_info_map.get(sid, {}) or {}
    lid = ld.get('supporter_id_map', {}).get(sid, '') if ld else ''
    name = (ld.get('supporter_text_map', {}) or {}).get(lid, '') if lid else ''
    if not name:
        return None
    ri = info.get('rarity', '1')
    thum = find_supporter_portrait(info.get('resource_id'), sid)
    return {
        'type': 'supporter', 'id': sid, 'name': name, 'thum': thum or '',
        'rarity': RARITY_MAP.get(str(ri), 'N'), 'rarity_id': str(ri),
        'role_icon': '', 'acquisition_icon': '',
        'special_icons': [], 'is_ultimate': False,
        'is_limited_time': sid in LIMITED_TIME_SUPPORTER_IDS,
    }


@app.route('/api/banner_timeline')
def api_banner_timeline():
    """Gacha banner list with schedules, appeal art, and featured units/characters from master chains."""
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
    ck = f'banner_tl_v5_{lc}'
    cached = get_cached_response(ck)
    if cached:
        return jsonify(convert_image_urls(cached))

    ld = get_lang_data(lc)
    lp = LANG_PATHS.get(lc) or LANG_PATHS.get(DEFAULT_LANG)
    base = lp.get('base')
    lang_dir = lp.get('lang')
    if not base or not os.path.isdir(base):
        out = {'banners': []}
        set_cached_response(ck, out)
        return jsonify(convert_image_urls(out))

    def _master_file(name):
        p = os.path.join(base, name)
        if os.path.isfile(p):
            return p
        alt = os.path.join(app_dir, 'data', lc, 'master', name)
        if os.path.isfile(alt):
            return alt
        return p

    gasha_lang = load_json(os.path.join(lang_dir, 'm_gasha.json')) if lang_dir and os.path.isfile(os.path.join(lang_dir, 'm_gasha.json')) else None
    if not gasha_lang and os.path.isfile(os.path.join(app_dir, 'data', lc, 'lang', 'm_gasha.json')):
        gasha_lang = load_json(os.path.join(app_dir, 'data', lc, 'lang', 'm_gasha.json'))
    gasha_name_map = create_lang_text_map(gasha_lang) if gasha_lang else {}

    m_gasha = load_json(_master_file('m_gasha.json'))
    m_appeal = load_json(_master_file('m_appeal_banner.json'))
    m_pickup = load_json(_master_file('m_gasha_pickup.json'))
    m_content = load_json(_master_file('m_gasha_content_detail.json'))
    m_bonus = load_json(_master_file('m_gasha_content_detail_unit_bonus_character.json'))

    appeal_by_id = {}
    for row in extract_data_list(m_appeal):
        if not isinstance(row, dict):
            continue
        bid = normalize_id(row.get('Id') or row.get('id'))
        if bid != '0':
            appeal_by_id[bid] = row

    pickup_by_gasha = {}
    for row in extract_data_list(m_pickup):
        if not isinstance(row, dict):
            continue
        gid = normalize_id(row.get('GashaId') or row.get('gashaId'))
        if gid == '0':
            continue
        pickup_by_gasha.setdefault(gid, []).append(row)
    for _gid in pickup_by_gasha:
        pickup_by_gasha[_gid].sort(key=lambda x: safe_int(x.get('SortOrder') or x.get('sortOrder'), 0))

    content_by_id = {}
    for row in extract_data_list(m_content):
        if not isinstance(row, dict):
            continue
        cid = normalize_id(row.get('Id') or row.get('id'))
        if cid != '0':
            content_by_id[cid] = row

    bonus_by_detail = {}
    for row in extract_data_list(m_bonus):
        if not isinstance(row, dict):
            continue
        dcid = normalize_id(row.get('GashaContentDetailId') or row.get('gashaContentDetailId'))
        ch = normalize_id(row.get('CharacterId') or row.get('characterId'))
        if dcid == '0' or ch == '0':
            continue
        bonus_by_detail.setdefault(dcid, []).append(ch)

    suffix = _banner_timeline_image_suffix(lc)
    special_sched = normalize_id('9999990001')
    rows_out = []

    for gx in extract_data_list(m_gasha):
        if not isinstance(gx, dict):
            continue
        if gx.get('IsShown') is False:
            continue
        gasha_id = normalize_id(gx.get('Id') or gx.get('id'))
        if gasha_id == '0':
            continue
        name_lid = normalize_id(gx.get('NameLanguageId') or gx.get('nameLanguageId') or '0')
        name = gasha_name_map.get(name_lid, '') if name_lid != '0' else ''
        abid = normalize_id(gx.get('AppealBannerId') or gx.get('appealBannerId') or '0')
        appeal = appeal_by_id.get(abid) if abid != '0' else None
        resource_id = str((appeal or {}).get('ResourceId') or (appeal or {}).get('resourceId') or '').strip()
        banner_url = ''
        if resource_id:
            banner_url = f'/static/images/Gasha/{resource_id}_{suffix}.webp'

        gs = safe_int(gx.get('ScheduleId') or gx.get('scheduleId'), 0)
        sched = normalize_id(gs) if gs != 0 else '0'
        if sched == '0' and appeal:
            gs2 = safe_int(appeal.get('ScheduleId') or appeal.get('scheduleId'), 0)
            if gs2 != 0:
                sched = normalize_id(gs2)

        start_label = '-'
        end_label = '-'
        duration_label = '-'
        start_ms = None
        end_ms = None

        if sched == special_sched:
            start_label = '-'
            end_label = '-'
            duration_label = '-'
            start_ms = None
            end_ms = None
        elif sched != '0':
            sm = schedule_start_ms_by_id.get(sched, 0)
            em = schedule_end_ms_by_id.get(sched, 0)
            if sm > 0:
                start_ms = sm
                start_label = format_start_datetime_jst(sm) or '-'
            if em > 0:
                end_ms = em
                end_label = format_start_datetime_jst(em) or '-'
            if sm > 0 and em > 0 and em >= sm:
                if _jst_year_from_epoch_ms(em) == 2099:
                    duration_label = '-'
                else:
                    duration_label = format_banner_duration_ms(em - sm)
            elif sm > 0 and (em <= 0 or em < sm):
                duration_label = ''

        pickups = pickup_by_gasha.get(gasha_id, [])
        seen_u_set = set()
        featured_units = []
        seen_ch_set = set()
        featured_chars = []
        seen_sp_set = set()
        featured_supporters = []

        for pu in pickups:
            dcid = normalize_id(pu.get('GashaContentDetailId') or pu.get('gashaContentDetailId'))
            cdrow = content_by_id.get(dcid) if dcid != '0' else None
            detail_is_supporter = dcid != '0' and str(dcid).startswith('2')

            if dcid != '0' and not detail_is_supporter:
                for cid in bonus_by_detail.get(dcid, []):
                    if cid in seen_ch_set:
                        continue
                    ch_it = _banner_timeline_char_item(cid, ld)
                    if ch_it:
                        featured_chars.append(ch_it)
                        seen_ch_set.add(cid)

            if detail_is_supporter and cdrow:
                rst = normalize_id(cdrow.get('RewardTargetId') or cdrow.get('rewardTargetId') or '0')
                if rst != '0' and rst != 'None' and rst not in seen_sp_set:
                    sp_it = _banner_timeline_supporter_item(rst, ld)
                    if sp_it:
                        featured_supporters.append(sp_it)
                        seen_sp_set.add(rst)
                continue

            if cdrow:
                rut = normalize_id(cdrow.get('RewardTargetId') or cdrow.get('rewardTargetId') or '0')
                if rut != '0' and rut != 'None' and rut in unit_info_map:
                    ui = _banner_timeline_unit_item(rut, ld)
                    if ui and rut not in seen_u_set:
                        featured_units.append(ui)
                        seen_u_set.add(rut)

        row = {
            'gasha_id': gasha_id,
            'name': name or f'Gasha {gasha_id}',
            'banner_url': banner_url,
            'schedule_id': sched,
            'start_ms': start_ms,
            'end_ms': end_ms,
            'start_label': start_label,
            'end_label': end_label,
            'duration_label': duration_label,
            'featured_units': featured_units,
            'featured_chars': featured_chars,
            'featured_supporters': featured_supporters,
        }
        rows_out.append(row)

    def _sort_key(r):
        sm = r.get('start_ms')
        if sm is None or sm <= 0:
            return (1, 0)
        return (0, -int(sm))

    rows_out.sort(key=_sort_key)
    out = {'banners': rows_out}
    set_cached_response(ck, out)
    return jsonify(convert_image_urls(out))


@app.route('/api/supporter/<supporter_id>')
def get_supporter(supporter_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        level = min(100, max(1, int(request.args.get('level', 100))))
        lb_tier = min(3, max(0, int(request.args.get('lb_tier', 3))))
        for_uid_q = (request.args.get('for_unit_id') or '').strip()
        for_cid_q = (request.args.get('for_char_id') or '').strip()
        for_uid_key = normalize_id(for_uid_q) if for_uid_q else '0'
        for_cid_key = normalize_id(for_cid_q) if for_cid_q else '0'
        ck = f"s3_{supporter_id}_{lc}_{level}_{lb_tier}_{for_uid_key}_{for_cid_key}_{lr_schedule_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); supporter_id = normalize_id(supporter_id); info = supporter_info_map.get(supporter_id)
        if not info: return jsonify({'error': f'Supporter {supporter_id} not found'}), 404
        if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
            return jsonify({'error': f'Supporter {supporter_id} not found'}), 404
        ri = info.get('rarity', '1'); lid = ld.get('supporter_id_map', {}).get(supporter_id, ""); cn = ld.get('supporter_text_map', {}).get(lid, "Unknown") if lid else "Unknown"
        base_hp = int(info.get('hp_add', 0)); base_atk = int(info.get('atk_add', 0))
        rate = supporter_growth_map.get((level, lb_tier), 10000)
        # Flat HP/ATK support: half-up on (base * rate / 10000) matches in-game; plain floor was −1 vs client when the product is fractional.
        hps = max(0, int(base_hp * rate / 10000 + 0.5))
        atks = max(0, int(base_atk * rate / 10000 + 0.5))
        ls = []
        for l in supporter_leader_map.get(supporter_id, []):
            if l.get('tier') != lb_tier: continue
            desc = ld.get('supporter_leader_text_map', {}).get(l.get('desc_lang_id', ''), '')
            tcid = normalize_id(l.get('trait_cond_id', '0'))
            raw_c = trait_condition_raw_map.get(str(tcid), {})
            same_group = 'SameGroup' in (raw_c.get('target_types') or [])
            if for_uid_q and for_uid_key != '0':
                applies = trait_condition_matches_unit(tcid, for_uid_key, ld, lc, for_cid_key if for_cid_key and for_cid_key != '0' else None)
            else:
                applies = True
            tags = resolve_condition_tags(tcid, trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), lc)
            sep = 'and' if '44%' in desc else ('or' if '36%' in desc or len(tags) >= 2 else 'default')
            ls.append({'desc': desc, 'tags': tags, 'separator': sep, 'trait_cond_id': tcid, 'applies': applies, 'same_group': same_group})
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

@app.route('/api/dc_targets')
def list_dc_targets():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        ld = get_lang_data(lc); rows = []
        diff_order_map = {1: 0, 2: 1, 3: 2}
        for sid, est in eternal_stage_map.items():
            sn = est.get('stage_number', 0)
            sname = ld.get('stage_text_map', {}).get(est.get('stage_name_lang_id', ''), '') or f"Stage {sid}"
            diff = get_stage_difficulty(sid, lc)
            dti = safe_int(est.get('stage_difficulty_type_index'), 1)
            dord = diff_order_map.get(dti, 99)
            vis = eternal_stage_content_visible(sid, est)
            if vis:
                rows.append({
                    'id': sid, 'name': sname, 'stage_number': sn, 'difficulty': diff['name'], 'difficulty_code': diff['code'],
                    'difficulty_order': dord, 'content_locked': False, 'stage_category': 'eternal',
                })
            else:
                rows.append({
                    'id': sid, 'name': '', 'stage_number': None, 'difficulty': '', 'difficulty_code': '',
                    'difficulty_order': dord, 'content_locked': True, 'stage_category': 'eternal',
                })

        for sid, sas in (map_event_score_attack_stage_map or {}).items():
            sn = safe_int(sas.get('list_seq'), 0)
            sname = resolve_stage_name_from_lang_m_stage(ld, sas.get('stage_name_lang_id', '0'), sid)
            # Preset list: show as Score #1/#2/#3 with Expert (not map_stage difficulty).
            diff_ex = get_stage_difficulty_by_type_index(3, lc)
            dord = diff_order_map.get(3, 99)
            rows.append({
                'id': sid, 'name': sname, 'stage_number': sn, 'difficulty': diff_ex['name'], 'difficulty_code': diff_ex['code'],
                'difficulty_order': dord, 'content_locked': False, 'stage_category': 'score_attack',
                'score_attack_index': sn,
            })

        def _dc_targets_sort_key(row):
            cat = row.get('stage_category') or 'eternal'
            cat_ord = 0 if cat == 'eternal' else 1
            return (cat_ord, row.get('difficulty_order', 99), safe_int(row['id'], 0))

        rows.sort(key=_dc_targets_sort_key)
        return jsonify(rows)
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify([])

@app.route('/api/stages')
def list_stages():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
        pp = min(100, max(10, int(request.args.get('per_page', 50)))); sq = request.args.get('q', '').strip().lower()
        df = request.args.get('difficulty', 'ALL').lower(); sb = request.args.get('sort', 'stage_number'); sd = request.args.get('dir', 'asc')
        cat = (request.args.get('category') or 'eternal').strip().lower()
        if cat not in ('eternal', 'score_attack', 'special_stage', 'tower_stage'): cat = 'eternal'
        ck = f"stages8_{cat}_{lc}_{page}_{pp}_{sq}_{df}_{sb}_{sd}_{lr_schedule_cache_key_fragment()}{eternal_stage_list_cache_time_fragment()}_{eternal_stage_session_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); rows = []
        if cat == 'special_stage':
            for sid, ses in (special_event_stage_map or {}).items():
                sname = resolve_special_event_stage_name(ld, ses.get('stage_name_lang_id', '0'), sid)
                pri = safe_int(ses.get('priority'), 0)
                grp = safe_int(ses.get('special_event_group_id'), 0)
                if sq:
                    searchable = f"{sid} {sname} {pri}".lower()
                    if not search_row_matches_query(sq, searchable, None, entity_id=sid): continue
                sm = stage_map.get(sid, {})
                mmeta = map_stage_meta_by_stage_id.get(sid, {}) if map_stage_meta_by_stage_id else {}
                dti = safe_int(mmeta.get('stage_difficulty_type_index'), 1)
                diff = get_stage_difficulty_by_type_index(dti, lc)
                if df != 'all' and df != '' and diff['code'] != df: continue
                portrait = special_event_stage_thumb_url(ses.get('thumbnail_resource_id'))
                rows.append({
                    '_sn_sort': (grp, pri, safe_int(sid, 0)),
                    'id': sid, 'stage_number': pri, 'name': sname,
                    'recommended_cp': sm.get('recommended_cp', 0),
                    'terrain': resolve_stage_terrain_name(sm.get('terrain_type_index', '0'), lc),
                    'difficulty_code': diff['code'], 'difficulty_name': diff['name'], 'portrait': portrait,
                    'content_locked': False, 'stage_category': 'special_stage',
                })
        elif cat == 'score_attack':
            for sid, sas in (map_event_score_attack_stage_map or {}).items():
                sn = safe_int(sas.get('list_seq'), 0)
                sname = resolve_stage_name_from_lang_m_stage(ld, sas.get('stage_name_lang_id', '0'), sid)
                if sq:
                    searchable = f"{sid} {sname} {sn}".lower()
                    if not search_row_matches_query(sq, searchable, None, entity_id=sid): continue
                sm = stage_map.get(sid, {})
                mmeta = map_stage_meta_by_stage_id.get(sid, {}) if map_stage_meta_by_stage_id else {}
                dti = safe_int(mmeta.get('stage_difficulty_type_index'), 1)
                diff = get_stage_difficulty_by_type_index(dti, lc)
                if df != 'all' and df != '' and diff['code'] != df: continue
                boss_id = sas.get('boss_map_npc_id', '0')
                nu = map_npc_unit_lookup.get(boss_id, []) if map_npc_unit_lookup else []
                duid = nu[0].get('unit_id', '0') if nu else '0'
                portrait = ''
                if duid != '0':
                    uinfo = unit_info_map.get(duid, {}); portrait = find_portrait(uinfo.get('resource_ids', []), duid, 'images/unit_portraits') or ''
                sn_sort = sn
                rows.append({
                    '_sn_sort': sn_sort,
                    'id': sid, 'stage_number': sn, 'name': sname,
                    'recommended_cp': sm.get('recommended_cp', 0),
                    'terrain': resolve_stage_terrain_name(sm.get('terrain_type_index', '0'), lc),
                    'difficulty_code': diff['code'], 'difficulty_name': diff['name'], 'portrait': portrait,
                    'content_locked': False, 'stage_category': 'score_attack',
                })
        elif cat == 'tower_stage':
            for tid, tes in (tower_event_stage_map or {}).items():
                stid = normalize_id(tes.get('stage_id'))
                gid = normalize_id(tes.get('tower_event_stage_group_id'))
                floor = safe_int(tes.get('floor_count'), 0)
                gname = resolve_tower_stage_group_name(ld, gid)
                sname = resolve_tower_event_stage_name(
                    ld,
                    tes.get('stage_name_lang_id', '0'),
                    tid,
                    group_id=gid,
                    floor_count=floor,
                )
                if sq:
                    searchable = f"{tid} {stid} {sname} {gname} {floor}".lower()
                    if not search_row_matches_query(sq, searchable, None, entity_id=tid): continue
                sm = stage_map.get(stid, {})
                mmeta = map_stage_meta_by_stage_id.get(stid, {}) if map_stage_meta_by_stage_id else {}
                dti = safe_int(mmeta.get('stage_difficulty_type_index'), 1)
                diff = get_stage_difficulty_by_type_index(dti, lc)
                if df != 'all' and df != '' and diff['code'] != df: continue
                duid = normalize_id(tes.get('floor_bromide_unit_id'))
                portrait = ''
                if duid != '0':
                    uinfo = unit_info_map.get(duid, {})
                    portrait = find_portrait(uinfo.get('resource_ids', []), duid, 'images/unit_portraits') or ''
                gsort = safe_int(tower_event_group_sort_map.get(gid, 9999), 9999)
                sn_sort = gsort * 100000 + max(0, floor) * 10 + (safe_int(tid, 0) % 10)
                rows.append({
                    '_sn_sort': sn_sort,
                    'id': tid, 'stage_number': floor, 'name': sname,
                    'recommended_cp': sm.get('recommended_cp', 0),
                    'terrain': resolve_stage_terrain_name(sm.get('terrain_type_index', '0'), lc),
                    'difficulty_code': diff['code'], 'difficulty_name': diff['name'], 'portrait': portrait,
                    'content_locked': False, 'stage_category': 'tower_stage',
                })
        else:
            for sid, est in eternal_stage_map.items():
                sn = est.get('stage_number', 0); sname = ld.get('stage_text_map', {}).get(est.get('stage_name_lang_id', ''), '') or f"Unknown ({sid})"
                vis = eternal_stage_content_visible(sid, est)
                if sq:
                    searchable = (f"{sid} {sname} {sn}" if vis else str(sid)).lower()
                    if not search_row_matches_query(sq, searchable, None, entity_id=sid): continue
                sm = stage_map.get(sid, {}); diff = get_stage_difficulty(sid, lc)
                if df != 'all' and df != '' and diff['code'] != df: continue
                duid = est.get('display_unit_id', '0'); portrait = ''
                if vis and duid != '0':
                    uinfo = unit_info_map.get(duid, {}); portrait = find_portrait(uinfo.get('resource_ids', []), duid, 'images/unit_portraits') or ''
                sn_sort = safe_int(sn, 0)
                if vis:
                    rows.append({
                        '_sn_sort': sn_sort,
                        'id': sid, 'stage_number': sn, 'name': sname,
                        'recommended_cp': sm.get('recommended_cp', 0),
                        'terrain': resolve_stage_terrain_name(sm.get('terrain_type_index', '0'), lc),
                        'difficulty_code': diff['code'], 'difficulty_name': diff['name'], 'portrait': portrait,
                        'content_locked': False, 'stage_category': 'eternal',
                    })
                else:
                    rows.append({
                        '_sn_sort': sn_sort,
                        'id': sid, 'stage_number': None, 'name': '',
                        'recommended_cp': None, 'terrain': '',
                        'difficulty_code': '', 'difficulty_name': '', 'portrait': '',
                        'content_locked': True, 'stage_category': 'eternal',
                    })
        if sb == 'stage_number':
            if sd == 'asc': rows.sort(key=lambda x: (x['_sn_sort'], safe_int(x['id'], 0)))
            else: rows.sort(key=lambda x: (-x['_sn_sort'], safe_int(x['id'], 0)))
        else:
            rows.sort(key=lambda x: (x['_sn_sort'], safe_int(x['id'], 0)))
        total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
        start = (page - 1) * pp; pr = rows[start:start + pp]
        for _r in pr: _r.pop('_sn_sort', None)
        result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'rows': [], 'total': 0, 'page': 1, 'per_page': 50, 'total_pages': 1}), 500

@app.route('/api/stage/<stage_id>')
def get_stage(stage_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); stage_id = normalize_id(stage_id)
        ld = get_lang_data(lc)
        sas = map_event_score_attack_stage_map.get(stage_id) if map_event_score_attack_stage_map else None
        ses = special_event_stage_map.get(stage_id) if special_event_stage_map else None
        tes = tower_event_stage_map.get(stage_id) if tower_event_stage_map else None
        est_er = eternal_stage_map.get(stage_id)
        if sas:
            is_score_attack = True
            is_special_event_stage = False
            is_tower_event_stage = False
        elif ses:
            is_score_attack = False
            is_special_event_stage = True
            is_tower_event_stage = False
        elif tes:
            is_score_attack = False
            is_special_event_stage = False
            is_tower_event_stage = True
        elif est_er:
            is_score_attack = False
            is_special_event_stage = False
            is_tower_event_stage = False
        else:
            return jsonify({'error': f'Stage {stage_id} not found'}), 404
        stage_master_id = stage_id
        if is_score_attack:
            boss_id = sas.get('boss_map_npc_id', '0')
            nu = map_npc_unit_lookup.get(boss_id, []) if map_npc_unit_lookup else []
            duid_syn = nu[0].get('unit_id', '0') if nu else '0'
            mmeta = map_stage_meta_by_stage_id.get(stage_id, {}) if map_stage_meta_by_stage_id else {}
            est = {
                'stage_number': safe_int(sas.get('list_seq'), 0),
                'stage_name_lang_id': sas.get('stage_name_lang_id', '0'),
                'display_unit_id': duid_syn,
                'stage_difficulty_type_index': safe_int(mmeta.get('stage_difficulty_type_index'), 1),
            }
            vis = True
        elif is_special_event_stage:
            mmeta = map_stage_meta_by_stage_id.get(stage_id, {}) if map_stage_meta_by_stage_id else {}
            est = {
                'stage_number': safe_int(ses.get('priority'), 0),
                'stage_name_lang_id': ses.get('stage_name_lang_id', '0'),
                'display_unit_id': '0',
                'stage_difficulty_type_index': safe_int(mmeta.get('stage_difficulty_type_index'), 1),
            }
            vis = True
        elif is_tower_event_stage:
            stage_master_id = normalize_id(tes.get('stage_id'))
            mmeta = map_stage_meta_by_stage_id.get(stage_master_id, {}) if map_stage_meta_by_stage_id else {}
            est = {
                'stage_number': safe_int(tes.get('floor_count'), 0),
                'stage_name_lang_id': tes.get('stage_name_lang_id', '0'),
                'display_unit_id': tes.get('floor_bromide_unit_id', '0'),
                'stage_difficulty_type_index': safe_int(mmeta.get('stage_difficulty_type_index'), 1),
            }
            vis = True
        else:
            est = est_er
            vis = eternal_stage_content_visible(stage_id, est)
        ck_cat = 'sa' if is_score_attack else ('ses' if is_special_event_stage else ('tes' if is_tower_event_stage else 'er'))
        ck = f"stage_{stage_id}_{stage_master_id}_{lc}_{lr_schedule_cache_key_fragment()}{eternal_stage_list_cache_time_fragment()}_esv{'1' if vis else '0'}_{ck_cat}_np6"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        if not vis:
            result = {
                'content_locked': True,
                'password_required': bool(ETERNAL_STAGE_PASSWORD),
                'id': stage_id,
                'lang': lc,
            }
            set_cached_response(ck, result); return jsonify(convert_image_urls(result))
        sn = est.get('stage_number', 0)
        if is_score_attack:
            sname = resolve_stage_name_from_lang_m_stage(ld, est.get('stage_name_lang_id', '0'), stage_id)
        elif is_special_event_stage:
            sname = resolve_special_event_stage_name(ld, est.get('stage_name_lang_id', '0'), stage_id)
        elif is_tower_event_stage:
            sname = resolve_tower_event_stage_name(
                ld,
                est.get('stage_name_lang_id', '0'),
                stage_id,
                group_id=tes.get('tower_event_stage_group_id', '0'),
                floor_count=est.get('stage_number', 0),
            )
        else:
            sname = ld.get('stage_text_map', {}).get(est.get('stage_name_lang_id', ''), '') or f"Unknown ({stage_id})"
        if is_score_attack or is_special_event_stage or is_tower_event_stage:
            diff = get_stage_difficulty_by_type_index(est.get('stage_difficulty_type_index'), lc)
        else:
            diff = get_stage_difficulty(stage_id, lc)
        sm = stage_map.get(stage_master_id, {}); duid = est.get('display_unit_id', '0'); portrait = ''
        if duid != '0':
            uinfo = unit_info_map.get(duid, {}); portrait = find_portrait(uinfo.get('resource_ids', []), duid, 'images/unit_portraits') or ''
        if is_special_event_stage:
            portrait = special_event_stage_thumb_url(ses.get('thumbnail_resource_id')) or portrait
        sg = []
        for gn, gk in [(1, 'group1_set_id'), (2, 'group2_set_id')]:
            gid = sm.get(gk, '0')
            if gid != '0': sg.append({'group_no': gn, 'restrictions': resolve_sortie_restriction_set(gid, lc)})
        vc, dc = resolve_stage_conditions(stage_master_id, lc)
        md = {'width': 0, 'height': 0, 'units': []}; nd = []
        mse = map_stage_lookup.get(stage_master_id)
        if mse:
            mid = mse.get('map_id', '0'); msid = mse.get('map_stage_id', '0')
            mi = map_master_lookup.get(mid, {'width': 0, 'height': 0}); w = mi['width']; h = mi['height']
            uom = []; nt = map_npc_by_map_stage.get(msid, []); squad_tb, self_tb, squad_by_source_tb = accumulate_npc_map_unit_stat_bonuses(nt, lc)
            for npc in nt:
                nid = npc['id']; nu = map_npc_unit_lookup.get(nid, []); nc = map_npc_character_lookup.get(nid, [])
                ue = nu[0] if nu else None; ce = nc[0] if nc else None
                dn = f"NPC {nid}"; dp = ''; il = False; up = None; cp = None
                if ue:
                    uabs = resolve_npc_unit_abilities(ue.get('ability_set_id', '0'), lc, ue.get('unit_id', '0'))
                    stat_keys = ['HP', 'EN', 'Attack', 'Defense', 'Mobility', 'Move']
                    z = {k: 0 for k in stat_keys}
                    sr0 = self_tb.get(nid) or z
                    self_row = {k: sr0.get(k, 0) for k in stat_keys}
                    own_squad_row = {k: (squad_by_source_tb.get(nid) or z).get(k, 0) for k in stat_keys}
                    tb_on = {k: squad_tb.get(k, 0) + self_row.get(k, 0) for k in stat_keys}
                    tb_off = {k: self_row.get(k, 0) + own_squad_row.get(k, 0) for k in stat_keys}
                    base_stats = {'HP': ue.get('hp', 0), 'EN': ue.get('en', 0), 'Attack': ue.get('attack', 0), 'Defense': ue.get('defense', 0), 'Mobility': ue.get('mobility', 0), 'Move': ue.get('movement', 0)}
                    fst_on, tba_on = apply_team_bonus_to_unit_stats(base_stats, tb_on)
                    fst_off, tba_off = apply_team_bonus_to_unit_stats(base_stats, tb_off)
                    upuid = ue.get('unit_id', '0'); up = get_npc_unit_display(upuid, fst_on, lc); up['abilities'] = uabs
                    upui = unit_info_map.get(upuid, {}); upubr = upui.get('bromide_resource_id', '') or (upui.get('resource_ids', [''])[0] if upui.get('resource_ids') else '')
                    up['weapons'] = resolve_npc_unit_weapons(ue.get('weapon_set_id', '0'), upuid, upubr, lc, upui.get('resource_ids'))
                    up['bonus_amounts'] = tba_on
                    up['stats_raw_npc_squad_allies_off'] = fst_off
                    up['bonus_amounts_npc_squad_allies_off'] = tba_off
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
                guest_icon = '/static/images/Stages/UI_GTower_Minimap_Icon_GuestArmy.webp' if is_ally else None
                me = {'npc_id': nid, 'name': dn, 'portrait': guest_icon or dp, 'x': npc.get('x', 0), 'y': npc.get('y', 0), 'is_large': il, 'side': side, 'is_guest_ally': is_ally}
                if ue:
                    umap_uid = normalize_id(ue.get('unit_id', '0'))
                    if umap_uid != '0':
                        me['unit_id'] = umap_uid
                me['cells'] = get_large_unit_cells(npc.get('x', 0), npc.get('y', 0)) if il else [{'x': npc.get('x', 0), 'y': npc.get('y', 0)}]
                me['npc_detail_index'] = len(nd)
                uom.append(me); nd.append({'npc_id': nid, 'x': npc.get('x', 0), 'y': npc.get('y', 0), 'is_large': il, 'side': side, 'is_guest_ally': is_ally, 'unit': up, 'character': cp})
            for ally in build_ally_positions(msid):
                uom.append({'npc_id': f"ally_g{ally['group_no']}_s{ally['slot']}", 'name': f"{get_ui_label(lc, 'sortie_group').format(ally['group_no'])} #{ally['slot']}", 'portrait': '/static/images/Stages/UI_GTower_Minimap_Icon_OwnArmy.webp', 'x': ally['x'], 'y': ally['y'], 'direction': ally.get('direction', '0'), 'is_large': False, 'side': 'ally', 'cells': [{'x': ally['x'], 'y': ally['y']}]})
            max_x = max_y = 0
            for u in uom:
                for c in (u.get('cells') or [{'x': u.get('x', 0), 'y': u.get('y', 0)}]):
                    max_x = max(max_x, int(c.get('x', 0))); max_y = max(max_y, int(c.get('y', 0)))
            pad = 2; w = max(w, max_x + 1 + pad); h = max(h, max_y + 1 + pad)
            md = build_map_grid(w, h, uom)
        result = {'content_locked': False, 'id': stage_id, 'stage_number': sn, 'name': sname, 'difficulty_code': diff['code'], 'difficulty_name': diff['name'], 'portrait': portrait, 'recommended_cp': sm.get('recommended_cp', 0), 'terrain': resolve_stage_terrain_name(sm.get('terrain_type_index', '0'), lc), 'victory_conditions': vc, 'defeat_conditions': dc, 'sortie_groups': sg, 'map_data': md, 'npc_details': nd, 'lang': lc, 'stage_category': ('score_attack' if is_score_attack else ('special_stage' if is_special_event_stage else ('tower_stage' if is_tower_event_stage else 'eternal'))), 'stage_master_id': stage_master_id}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

@app.route('/api/character/<char_id>')
def get_character(char_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        view_ranking = request.args.get('view', '').strip().lower() == 'ranking'
        ck = f"c_{char_id}_{lc}_r11_{1 if view_ranking else 0}_{lr_schedule_cache_key_fragment()}_{npc_view_cache_key_fragment()}"
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
        rec_uid_for_pair = CHAR_RECOMMEND_UNIT_MAP.get(char_id)
        recommend_unit = None
        if rec_uid_for_pair and rec_uid_for_pair in unit_info_map:
            uinfo = unit_info_map[rec_uid_for_pair]
            if not entity_hidden_by_lr_schedule_lock(uinfo.get('schedule_id', '0')):
                uri = uinfo.get('rarity', '1')
                urole = uinfo.get('role', '0')
                ulid = ld.get('unit_id_map', {}).get(rec_uid_for_pair, '')
                uname = ld.get('unit_text_map', {}).get(ulid, '') if ulid else ''
                if not uname:
                    uname = f'Unknown ({rec_uid_for_pair})'
                uthum = find_list_thumb(uinfo.get('resource_ids', []), rec_uid_for_pair, 'images/unit_portraits')
                uacq = uinfo.get('acquisition_route', '0')
                uai = ACQUISITION_ROUTE_ICONS.get(uacq, '')
                recommend_unit = {'id': rec_uid_for_pair, 'name': uname, 'rarity': RARITY_MAP.get(uri, 'N'), 'rarity_icon': RARITY_ICON_MAP.get(uri, ''), 'role': ROLE_MAP.get(urole, 'NPC'), 'role_icon': ROLE_ICON_MAP.get(urole, ''), 'thum': uthum or '', 'acquisition_icon': uai or ''}
        spbn_u, spbn_c, spbn_pair, spen, spen_pair, spbs_u, spbs_c, spbs_pair, spes, spes_pair, trait_pair_unit_ids = _accumulate_character_trait_percent_buckets(ac, char_id, ldc)
        pair_ok, pair_units, _ = _character_trait_pair_gate(char_id, trait_pair_unit_ids)
        sne = []; swe = []; ssne = []; sswe = []
        for s in CHAR_STAT_ORDER:
            bv = grown.get(s, 0); bon = math.floor(bv * spbn_u[s] / 100) if bv > 0 else 0
            sne.append({'name': s, 'base': bv, 'total': bv + bon, 'bonus': bon, 'trait_pct': spbn_u[s]})
            pair_pct_n = (spbn_pair[s] + spen_pair[s]) if pair_ok else 0
            tb = math.floor(bv * (spbn_u[s] + spbn_c[s] + spen[s] + pair_pct_n) / 100) if bv > 0 else 0
            tpct_n = spbn_u[s] + spbn_c[s] + spen[s] + pair_pct_n
            swe.append({'name': s, 'base': bv, 'total': bv + tb, 'bonus': tb, 'trait_pct': tpct_n})
            sbv = grown_sp.get(s, 0); sbon = math.floor(sbv * spbs_u[s] / 100) if sbv > 0 else 0
            ssne.append({'name': s, 'base': sbv, 'total': sbv + sbon, 'bonus': sbon, 'trait_pct': spbs_u[s]})
            pair_pct_s = (spbs_pair[s] + spes_pair[s]) if pair_ok else 0
            stb = math.floor(sbv * (spbs_u[s] + spbs_c[s] + spes[s] + pair_pct_s) / 100) if sbv > 0 else 0
            tpct_s = spbs_u[s] + spbs_c[s] + spes[s] + pair_pct_s
            sswe.append({'name': s, 'base': sbv, 'total': sbv + stb, 'bonus': stb, 'trait_pct': tpct_s})
        ex_supercharged_tiers = collect_supercharged_ex_stat_tiers(ac, char_id)
        ex_supercharged_tiers_payload = []
        if ex_supercharged_tiers:
            for et in ex_supercharged_tiers:
                row = []
                for s in CHAR_STAT_ORDER:
                    bv = grown.get(s, 0)
                    pct = spbn_u[s] + spbn_c[s] + et['ex_pct'][s]
                    tbb = math.floor(bv * pct / 100) if bv > 0 else 0
                    row.append({'name': s, 'base': bv, 'total': bv + tbb, 'bonus': tbb, 'trait_pct': pct})
                ex_supercharged_tiers_payload.append({'tier': et['tier'], 'label': et['label'], 'stats': row})
            swe = ex_supercharged_tiers_payload[0]['stats']
        stats = sne; stats_with_ex = swe; sp_stats = ssne; sp_stats_with_ex = sswe
        # CP toggle when "on" state adds anything: conditional passives (e.g. Vigor) and/or EX-trait % (UR EX slot).
        has_ex_stats = bool(ex_supercharged_tiers)
        if not has_ex_stats:
            for s in CHAR_STAT_ORDER:
                if spbn_c[s] + spen[s] + ((spbn_pair[s] + spen_pair[s]) if pair_ok else 0) != 0:
                    has_ex_stats = True
                    break
                if spbs_c[s] + spes[s] + ((spbs_pair[s] + spes_pair[s]) if pair_ok else 0) != 0:
                    has_ex_stats = True
                    break
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
        pair_mod = CHAR_PAIR_UNIT_STAT_MOD_PCT.get(char_id)
        counter_atk_mod = CHAR_PAIR_UNIT_COUNTER_ATK_PCT.get(char_id)
        # pair_units / pair_ok computed above (manual CHAR_PAIR_* ∪ trait-derived pilot-(EX) gates).
        # Still show toggle for UR EX-slot % (spen/spes) when recommend does not match.
        has_ex_slot_only = any(spen[s] + (spen_pair[s] if pair_ok else 0) != 0 for s in CHAR_STAT_ORDER) or any(spes[s] + (spes_pair[s] if pair_ok else 0) != 0 for s in CHAR_STAT_ORDER) or bool(ex_supercharged_tiers)
        if pair_units and not pair_ok:
            has_conditional_passive = has_ex_slot_only
        else:
            has_conditional_passive = has_ex_stats
        result = {'id': char_id, 'name': cn, 'rarity': RARITY_MAP.get(ri,"Unknown"), 'rarity_id': ri, 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'role': ROLE_MAP.get(info.get('role','0'),"Unknown"), 'role_id': info.get('role','0'), 'role_icon': ROLE_ICON_MAP.get(info.get('role','0'),''), 'acquisition_icon': acq_icon or '', 'stats': stats, 'stats_with_ex': stats_with_ex, 'ex_supercharged_tiers': ex_supercharged_tiers_payload, 'has_ex_stats': has_ex_stats, 'has_conditional_passive': has_conditional_passive, 'has_sp': has_sp, 'sp_stats': sp_stats, 'sp_stats_with_ex': sp_stats_with_ex, 'pair_unit_stat_mod': pair_mod, 'pair_unit_counter_atk_mod': counter_atk_mod, 'tags': resolve_tags(char_lin_map, char_id, lc, 'character'), 'series': resolve_series(ld['char_ser_map'].get(char_id, ''), lc), 'abilities': abilities, 'skills': skills, 'portrait': portrait, 'thum': thum or '', 'lang': lc, 'recommend_unit': recommend_unit, 'is_limited_time': char_id in LIMITED_TIME_CHARACTER_IDS}
        if view_ranking:
            result['abilities'] = []
            result['skills'] = []
            result['view_ranking'] = True
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

@app.route('/api/unit/<unit_id>')
def get_unit(unit_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        view_ranking = request.args.get('view', '').strip().lower() == 'ranking'
        stat_mode_arg = request.args.get('stat_mode', 'normal').strip().lower()
        if stat_mode_arg not in ('normal', 'sp', 'ssp'):
            stat_mode_arg = 'normal'
        cond_for_ranking = request.args.get('cond', '').strip().lower() in ('1', 'true', 'yes')
        ck = f"u_{unit_id}_{lc}_ssp13_{stat_mode_arg}_{1 if cond_for_ranking else 0}_{1 if view_ranking else 0}_{lr_schedule_cache_key_fragment()}_{npc_view_cache_key_fragment()}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); ldc = get_calc_lang_data(); unit_id = normalize_id(unit_id); info = unit_info_map.get(unit_id)
        if not info: return jsonify({'error': f'Unit {unit_id} not found'}), 404
        if entity_hidden_by_lr_schedule_lock(info.get('schedule_id', '0')):
            return jsonify({'error': f'Unit {unit_id} not found'}), 404
        if str(info.get('role', '0')) == '0' and not npc_password_unlocked():
            return jsonify({'error': f'Unit {unit_id} not found'}), 404
        if not unit_has_ms_ability_content(unit_id) and not npc_password_unlocked():
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
            bab = build_ability_entry(str(ab['id']), ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=ab['sort'], lang_code=lc, unit_id=unit_id)
            if str(ab['id']) in rm: bab['ssp_replacement'] = build_ability_entry(rm[str(ab['id'])], ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=ab['sort'], lang_code=lc, unit_id=unit_id)
            abilities.append(bab)
        ac = []
        for ab in sorted(ua, key=lambda x: x['sort']):
            bac = build_ability_entry(str(ab['id']), ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=ab['sort'], lang_code=CALC_LANG, unit_id=unit_id)
            if str(ab['id']) in rm: bac['ssp_replacement'] = build_ability_entry(rm[str(ab['id'])], ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=ab['sort'], lang_code=CALC_LANG, unit_id=unit_id)
            ac.append(bac)
        max_ab_sort = max((int(a.get('sort', 0) or 0) for a in ua), default=0)
        if has_sp:
            for idx, gain_aid in enumerate(unit_ssp_abil_gain_list.get(unit_id, [])):
                so = max_ab_sort + idx + 1
                bab = build_ability_entry(str(gain_aid), ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=so, lang_code=lc, unit_id=unit_id)
                bab['ssp_only'] = True
                abilities.append(bab)
                bac = build_ability_entry(str(gain_aid), ldc['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'], ability_resource_map, ldc['abil_desc_map'], sort_order=so, lang_code=CALC_LANG, unit_id=unit_id)
                bac['ssp_only'] = True
                ac.append(bac)
        spb = {s: 0 for s in UNIT_STAT_ORDER}
        spc = {s: 0 for s in UNIT_STAT_ORDER}
        sspb = {s: 0 for s in UNIT_STAT_ORDER}
        sspc = {s: 0 for s in UNIT_STAT_ORDER}
        nxs = {s: 0 for s in UNIT_STAT_ORDER}
        nxss = {s: 0 for s in UNIT_STAT_ORDER}
        spb_move_flat = [0]; spc_move_flat = [0]; sspb_move_flat = [0]; sspc_move_flat = [0]
        spb_crit = [0]; spc_crit = [0]; sspb_crit = [0]; sspc_crit = [0]
        _WPN_KEYS = ('Accuracy', 'Critical', 'Power')
        wpn_spb = {k: 0 for k in _WPN_KEYS}
        wpn_spc = {k: 0 for k in _WPN_KEYS}
        wpn_sspb = {k: 0 for k in _WPN_KEYS}
        wpn_sspc = {k: 0 for k in _WPN_KEYS}
        wpn_nxs = {k: 0 for k in _WPN_KEYS}
        wpn_nxss = {k: 0 for k in _WPN_KEYS}

        def ep(ad, bd, cd, nd, bd_move_flat, cd_move_flat, wpn_bd, wpn_cd, wpn_nd, bd_crit, cd_crit):
            hc = any(cond for d2 in ad.get('details', []) for cond in d2.get('conditions', []))
            ie = ad.get('is_ex', False)
            ability_cond = ability_name_implies_unit_stat_conditional_bucket(ad)
            inx = unit_id == '1400000550' and any(kw in (ad.get('name', '') or '').lower() for kw in ['newtype', 'x-rounder', '新人類', 'x rounder'])
            for di, d2 in enumerate(ad.get('details', [])):
                txt = d2.get('text', '') if isinstance(d2, dict) else str(d2)
                parts = [p.strip() for p in re.split(r'[.\n]+', txt) if p and p.strip()]
                if not parts: parts = [txt]
                cond_prefix = False
                prev_enemy_tag_clause = False
                for part in parts:
                    itc = _is_conditional_stat_text(part)
                    if itc and _unit_hp_threshold_active_at_assumed_full_hp(part):
                        itc = False
                    if itc and _unit_vigor_normal_baseline_stat_line(part):
                        itc = False
                    part_stats = _extract_stat_percent_unit(part, skip_conditional=False)
                    enemy_adv_atk_def = _unit_enemy_tag_equal_atk_def_boost(part_stats, prev_enemy_tag_clause)
                    if enemy_adv_atk_def:
                        prev_enemy_tag_clause = False
                    else:
                        part_stats, prev_enemy_tag_clause = _strip_enemy_tag_advantage_atk_def_if_following(part_stats, prev_enemy_tag_clause)
                    if _unit_enemy_specified_tags_clause_part(part):
                        prev_enemy_tag_clause = True
                    wpn_stats = _extract_weapon_stat_percent_unit(part, skip_conditional=False)
                    flat_move = _extract_stat_flat_move(part, skip_conditional=False)
                    if itc and not part_stats and not flat_move and not wpn_stats:
                        cond_prefix = True
                    is_cond = itc or cond_prefix
                    line_cond = _unit_line_ms_stats_conditional_bucket(part, hc, ie, is_cond, ability_cond, ad, di)
                    if enemy_adv_atk_def:
                        line_cond = True
                    if flat_move:
                        if inx:
                            pass
                        elif line_cond:
                            cd_move_flat[0] += flat_move
                        else:
                            bd_move_flat[0] += flat_move
                    for s, pct in part_stats.items():
                        if s == UNIT_ABILITY_PASSIVE_CRIT_DMG_PCT_KEY:
                            if not inx:
                                if line_cond:
                                    cd_crit[0] += pct
                                else:
                                    bd_crit[0] += pct
                            continue
                        if s == 'Move': continue
                        if unit_id == '1400000550' and s == 'HP' and pct == 5:
                            bd[s] = bd.get(s, 0) + pct
                            continue
                        if inx:
                            nd[s] = max(nd.get(s, 0), pct)
                        elif line_cond:
                            cd[s] = cd.get(s, 0) + pct
                        else:
                            bd[s] = bd.get(s, 0) + pct
                    for wk, pct in wpn_stats.items():
                        if inx:
                            wpn_nd[wk] = max(wpn_nd.get(wk, 0), pct)
                        elif line_cond:
                            wpn_cd[wk] = wpn_cd.get(wk, 0) + pct
                        else:
                            wpn_bd[wk] = wpn_bd.get(wk, 0) + pct
            _unit_adjust_hp_condition_increased_atk_buckets(ad, bd, cd)

        for ab in ac:
            if ab.get('ssp_only'):
                ep(ab, sspb, sspc, nxss, sspb_move_flat, sspc_move_flat, wpn_sspb, wpn_sspc, wpn_nxss, sspb_crit, sspc_crit)
                continue
            ep(ab, spb, spc, nxs, spb_move_flat, spc_move_flat, wpn_spb, wpn_spc, wpn_nxs, spb_crit, spc_crit)
            if 'ssp_replacement' in ab:
                ep(ab['ssp_replacement'], sspb, sspc, nxss, sspb_move_flat, sspc_move_flat, wpn_sspb, wpn_sspc, wpn_nxss, sspb_crit, sspc_crit)
            else:
                ep(ab, sspb, sspc, nxss, sspb_move_flat, sspc_move_flat, wpn_sspb, wpn_sspc, wpn_nxss, sspb_crit, sspc_crit)
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
        # Use != 0 so negative spc (e.g. HP-tier ATK exclusive fix) still enables the conditional toggle.
        hcond = (any(spc.get(s, 0) != 0 for s in UNIT_STAT_ORDER) or
                 any(sspc.get(s, 0) != 0 for s in UNIT_STAT_ORDER) or
                 spc_move_flat[0] != 0 or sspc_move_flat[0] != 0 or
                 spc_crit[0] != 0 or sspc_crit[0] != 0)
        ability_passive_crit_dmg_pct = {
            'no_cond': spb_crit[0],
            'cond_only': spc_crit[0],
            'ssp_no_cond': sspb_crit[0],
            'ssp_cond_only': sspc_crit[0],
        }
        lb_data = []
        for mult in [1.0, 1.2, 1.3, 1.4]:
            _is_ult = bool(info.get('is_ultimate', False))
            cm_base = 1.0 if _is_ult else mult
            cm_sp = mult if (has_sp and _is_ult) else cm_base
            lb_fs, lb_fsp, lb_fssp = {}, {}, {}
            if raw:
                for s in ['HP','EN','Attack','Defense','Mobility']:
                    st = raw.get(s, (0,0,0)); st = (st[0], st[1], st[2]) if len(st) >= 3 else (st[0], st[1], st[1])
                    gs = calc_growth_unit_base(st[0], st[1], ri); gsp = st[2]
                    sb2v, sm2v = ssp_bonus.get(s, (0,0)); sb2v = sb2v if isinstance(sb2v, (int, float)) else 0; sm2v = sm2v if isinstance(sm2v, (int, float)) else sb2v
                    scb = math.floor(sb2v + (sm2v - sb2v) * 0.5) if has_sp and ssp_bonus else 0
                    lb_fs[s] = math.floor(gs * cm_base); lb_fsp[s] = math.floor(gsp * cm_sp); lb_fssp[s] = math.floor((gsp + scb) * cm_sp)
                mov = raw.get('Move', (0,0)); mov = (mov[0], mov[1]) if isinstance(mov, (list, tuple)) and len(mov) >= 2 else (mov if isinstance(mov, (int, float)) else 0, mov if isinstance(mov, (int, float)) else 0)
                lb_fs['Move'] = mov[0] if isinstance(mov, (list, tuple)) else mov
                lb_fsp['Move'] = mov[1] if isinstance(mov, (list, tuple)) else mov[0]
                lb_fssp['Move'] = lb_fsp['Move'] + (ssp_core.get('move', 0) if has_sp else 0)
            else:
                lb_fs = {s: math.floor(fs.get(s,0) * cm_base / 1.4) for s in UNIT_STAT_ORDER}
                lb_fsp = dict(lb_fs)
                lb_fssp = dict(lb_fs)
            snc, swc, spnc, spwc, sspnc, sspwc = [], [], [], [], [], []
            for s in UNIT_STAT_ORDER:
                if s == 'Move':
                    mbase = int(lb_fsp.get('Move', 0) or 0)
                    mssp = int(lb_fssp.get('Move', 0) or 0)
                    mbon = max(0, mssp - mbase)
                    bf = spb_move_flat[0]; cf = spc_move_flat[0]; sbf = sspb_move_flat[0]; scf = sspc_move_flat[0]
                    snc.append({'name': s, 'total': lb_fs.get(s, 0) + bf, 'bonus': bf, 'base': lb_fs.get(s, 0), 'passive_pct': 0})
                    swc.append({'name': s, 'total': lb_fs.get(s, 0) + bf + cf, 'bonus': bf + cf, 'base': lb_fs.get(s, 0), 'passive_pct': 0})
                    spnc.append({'name': s, 'total': mbase + bf, 'bonus': bf, 'base': mbase, 'passive_pct': 0})
                    spwc.append({'name': s, 'total': mbase + bf + cf, 'bonus': bf + cf, 'base': mbase, 'passive_pct': 0})
                    sspnc.append({'name': s, 'total': mssp + sbf, 'bonus': mbon + sbf, 'base': mssp, 'passive_pct': 0})
                    sspwc.append({'name': s, 'total': mssp + sbf + scf, 'bonus': mbon + sbf + scf, 'base': mssp, 'passive_pct': 0})
                    continue
                bst = lb_fs.get(s, 0); spst = lb_fsp.get(s, 0); sspst = lb_fssp.get(s, 0)
                bb = math.floor(bst * spb.get(s, 0) / 100) if bst else 0
                cb = math.floor(bst * (spb.get(s, 0) + spc.get(s, 0)) / 100) if bst else 0
                snc.append({'name': s, 'total': bst + bb, 'bonus': bb, 'base': bst, 'passive_pct': spb.get(s, 0)})
                swc.append({'name': s, 'total': bst + cb, 'bonus': cb, 'base': bst, 'passive_pct': spb.get(s, 0) + spc.get(s, 0)})
                spbb = math.floor(spst * spb.get(s, 0) / 100) if spst else 0
                spcb = math.floor(spst * (spb.get(s, 0) + spc.get(s, 0)) / 100) if spst else 0
                spnc.append({'name': s, 'total': spst + spbb, 'bonus': spbb, 'base': spst, 'passive_pct': spb.get(s, 0)})
                spwc.append({'name': s, 'total': spst + spcb, 'bonus': spcb, 'base': spst, 'passive_pct': spb.get(s, 0) + spc.get(s, 0)})
                sspbb = math.floor(sspst * sspb.get(s, 0) / 100) if sspst else 0
                sspcb = math.floor(sspst * (sspb.get(s, 0) + sspc.get(s, 0)) / 100) if sspst else 0
                sspnc.append({'name': s, 'total': sspst + sspbb, 'bonus': sspbb, 'base': sspst, 'passive_pct': sspb.get(s, 0)})
                sspwc.append({'name': s, 'total': sspst + sspcb, 'bonus': sspcb, 'base': sspst, 'passive_pct': sspb.get(s, 0) + sspc.get(s, 0)})
            lb_data.append({'stats_no_cond': snc, 'stats_with_cond': swc, 'sp_stats_no_cond': spnc, 'sp_stats_with_cond': spwc, 'ssp_stats_no_cond': sspnc, 'ssp_stats_with_cond': sspwc})
        entry_max = lb_data[3] if len(lb_data) > 3 else (lb_data[-1] if lb_data else None)
        if view_ranking and entry_max:
            fsm_rank = _unit_lb_row_to_api(entry_max, stat_mode_arg, cond_for_ranking)
            def _rank_unit_row_from_fsm(fsm_map):
                row = []
                for disp, fk in [('HP', 'HP'), ('EN', 'EN'), ('Attack', 'ATK'), ('Defense', 'DEF'), ('Mobility', 'MOB'), ('Move', 'MOV')]:
                    v = int(fsm_map.get(fk, 0))
                    row.append({'name': disp, 'total': v, 'bonus': 0, 'base': v, 'passive_pct': 0})
                return row
            stats = _rank_unit_row_from_fsm(fsm_rank)
            _dup_lb = {'stats_no_cond': stats, 'stats_with_cond': stats, 'sp_stats_no_cond': stats, 'sp_stats_with_cond': stats, 'ssp_stats_no_cond': stats, 'ssp_stats_with_cond': stats}
            lb_data = [_dup_lb, _dup_lb, _dup_lb, _dup_lb]
        else:
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
        if not view_ranking:
            for wp in unit_weapon_map.get(unit_id, []):
                wid = wp['id']; wm = weapon_info_map.get(wid, {}); wn = ld['weapon_text_map'].get(wm.get('name_lang_id','0'), 'Unknown')
                ai = wm.get('attribute','0'); wt = wm.get('weapon_type','1'); ainfo = WEAPON_ATTR_MAP.get(ai, {'label':'Unknown','icon':''})
                at = ATTACK_ATTR_TYPES.get(wm.get('attack_attribute','0'), [])
                ws = resolve_weapon_stats(wm, weapon_status_map, weapon_correction_map, ld['weapon_trait_map'], ld['weapon_capability_map'], growth_pattern_map, weapon_trait_change_map, ld['weapon_trait_detail_map'], wid, lang_code=lc, unit_id=unit_id)
                ic = resolve_weapon_icon(wt, ai, ubr, info.get('resource_ids'), wid=wid, unit_id=unit_id)
                if is_map_weapon_recovery_supply_mp(unit_id, wid, wt):
                    at = [{'label': 'MP', 'icon': game_image_public_url(MAP_WEAPON_SUPPLY_TYPE_MP_ICON), 'is_supply': True}]
                pw, en, acc, crit = ws.get('power',0), ws.get('en',0), ws.get('accuracy',0), ws.get('critical',0)
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
                levels_raw = ws.get('levels') or [{'level':i,'power':ws.get('power',0),'en':ws.get('en',0),'accuracy':ws.get('accuracy',0),'critical':ws.get('critical',0),'ammo':ws.get('ammo',0),'traits':ws.get('traits',[])} for i in range(1,6)]
                levels = enrich_weapon_levels_with_enemy_def_debuff(levels_raw, sat)
                lv5t = trl
                ip = any(_trait_text_indicates_preemptive_strike(tr) for tr in lv5t + sat)
                icc = eval_icon_color(lv5t, wt); sicc = eval_icon_color(lv5t + sat, wt)
                isw = wid.endswith('90') or wid.endswith('80')
                siu = ''
                if isw:
                    siu = ''
                    _ssp_cands = [ubr] + list(info.get('resource_ids') or [])
                    for _c in _ssp_cands:
                        _s = str(_c).strip() if _c is not None else ''
                        if not _s or _s == '0':
                            continue
                        _tf = find_trait_icon(_s)
                        if _tf:
                            siu = f"/static/images/Trait/{_tf}"
                            break
                    if not siu:
                        siu = portrait or ''
                weapons.append({'id': wid, 'name': wn, 'attribute': ainfo['label'], 'attribute_id': ai, 'weapon_type': wt, 'attack_attribute': str(wm.get('attack_attribute', '0') or '0'), 'attack_types': at, 'levels': levels, 'power': pw, 'min_range': ws['range_min'], 'max_range': ws['range_max'], 'en_cost': en, 'accuracy': acc, 'critical': crit, 'ammo': am, 'traits': trl, 'usage_restrictions': ws['usage_restrictions'], 'sort': wp['sort'], 'icon': ic['icon'], 'overlay': ic['overlay'], 'is_ex': ic['is_ex'], 'is_map': ic['is_map'], 'icon_color': icc, 'ssp_icon_color': sicc, 'map_range_type': wm.get('map_range_type', '0'), 'map_coords': ws.get('map_coords', []), 'shooting_coords': ws.get('shooting_coords', []), 'is_dash': ws.get('is_dash', False), 'map_dash_dual_wide': ws.get('map_dash_dual_wide', False), 'map_dash_dual_end_coords': ws.get('map_dash_dual_end_coords', []), 'map_single_pou': ws.get('map_single_pou', False), 'is_ssp_weapon': isw, 'ssp_icon': siu, 'ssp_power_bonus': ssp_power, 'ssp_ammo_bonus': ssp_ammo, 'ssp_range_bonus': ssp_range, 'ssp_traits': sat, 'is_preemptive': ip})
            weapons.sort(key=lambda w: (0 if w['weapon_type']=='3' else 1, w['sort']))
        sicons = []
        if info.get('is_ultimate', False): sicons.append(ULT_ICON)
        acq = info.get('acquisition_route','0'); ai2 = ACQUISITION_ROUTE_ICONS.get(acq, '')
        if ai2: sicons.append(ai2)
        msid = str(info.get('mechanism_set_id', '0'))
        il = safe_int(info.get('occupied_area_id'), 1) == 2
        mids = list(MECH_MAP_TABLE.get(msid, []))
        if _unit_has_sd_mechanism(info, unit_id) and '3' not in mids:
            mids.append('3')
        mechs = []
        if not view_ranking:
            if il:
                mechs.append({'name': '2x2', 'description': 'Deployed onto the battlefield at size 2x2.' if lc == 'EN' else '以2x2的尺寸在戰場上出擊。', 'icon': '/static/images/mechanism/mechanism_0002.webp'})
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
                    recommend_character = {'id': rec_cid, 'name': cname, 'rarity': RARITY_MAP.get(cri, 'N'), 'rarity_icon': RARITY_ICON_MAP.get(cri, ''), 'role': ROLE_MAP.get(crrole, 'NPC'), 'role_icon': ROLE_ICON_MAP.get(crrole, ''), 'thum': cthum or '', 'is_limited_time': rec_cid in LIMITED_TIME_CHARACTER_IDS}
            mm = ld.get('mechanism_map', {})
            for mid in mids:
                if mid == '2x2': continue
                for rmm in mm.get(mid, []):
                    if rmm.get('id') == mid:
                        icf = find_mechanism_icon(rmm.get('resource_id', ''))
                        mechs.append({'name': rmm.get('name', 'Unknown'), 'description': rmm.get('description', ''), 'icon': f"/static/images/mechanism/{icf}" if icf else ''})
                        break
        else:
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
                    recommend_character = {'id': rec_cid, 'name': cname, 'rarity': RARITY_MAP.get(cri, 'N'), 'rarity_icon': RARITY_ICON_MAP.get(cri, ''), 'role': ROLE_MAP.get(crrole, 'NPC'), 'role_icon': ROLE_ICON_MAP.get(crrole, ''), 'thum': cthum or '', 'is_limited_time': rec_cid in LIMITED_TIME_CHARACTER_IDS}
        has_terrain_enh = bool(has_sp and ssp_core.get('terrain_upgrades'))
        skills = [] if view_ranking else [resolve_unit_skill(row['unit_skill_id'], ld, row['sort']) for row in unit_skill_set_lookup.get(unit_id, [])]
        _tpid = unit_transform_partner_map.get(unit_id)
        _muid = normalize_id(info.get('main_unit_id', unit_id))
        if _muid == '0':
            _muid = unit_id
        result = {'id': unit_id, 'name': un, 'rarity': RARITY_MAP.get(ri,"Unknown"), 'rarity_id': ri, 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'role': ROLE_MAP.get(info.get('role','0'),"Unknown"), 'role_id': info.get('role','0'), 'role_icon': ROLE_ICON_MAP.get(info.get('role','0'),''), 'model': info.get('model',''), 'stats': stats, 'lb_data': lb_data, 'terrain': terrain, 'terrain_ssp': terr_ssp, 'has_terrain_enhancement': has_terrain_enh, 'tags': resolve_tags(unit_lin_map, unit_id, lc, 'unit'), 'series': resolve_series(unit_ser_map.get(unit_id,''), lc), 'abilities': abilities, 'skills': skills, 'mechanisms': mechs, 'weapons': weapons, 'weapon_passive_pct': weapon_passive_pct, 'ability_passive_crit_dmg_pct': ability_passive_crit_dmg_pct, 'portrait': portrait, 'thum': thum or '', 'lang': lc, 'is_ultimate': info.get('is_ultimate', False), 'acquisition_route': acq, 'acquisition_icon': ai2 or ACQUISITION_ROUTE_ICONS.get(acq, ''), 'special_icons': sicons, 'has_sp': has_sp, 'has_cond_stats': hcond, 'is_large': il, 'recommend_character': recommend_character, 'body_type': info.get('body_type', '1'), 'is_limited_time': unit_id in LIMITED_TIME_UNIT_IDS, 'main_unit_id': _muid, 'is_transform_alternate': unit_id != _muid}
        if _tpid:
            result['transform_partner_id'] = _tpid
        if view_ranking:
            result['abilities'] = []
            result['weapon_passive_pct'] = {k: {'Accuracy': 0, 'Critical': 0, 'Power': 0} for k in ('sp', 'ssp', 'sp_cond', 'ssp_cond')}
            result['ability_passive_crit_dmg_pct'] = {'no_cond': 0, 'cond_only': 0, 'ssp_no_cond': 0, 'ssp_cond_only': 0}
            result['view_ranking'] = True
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

@app.route('/<path:path>')
def serve_spa(path):
    """Serve index.html for any non-API path (SPA-style routing)."""
    if path.startswith('api/'):
        return jsonify({'error': 'Not found'}), 404
    # Do not return index.html for static files (belt-and-suspenders if routing order differs).
    if path.startswith('static/'):
        rel = path[len('static/') :].replace('\\', '/')
        if not rel or any(seg == '..' for seg in rel.split('/')):
            return jsonify({'error': 'Not found'}), 404
        try:
            return app.send_static_file(rel)
        except NotFound:
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