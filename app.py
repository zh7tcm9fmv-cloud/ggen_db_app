from flask import Flask, render_template, jsonify, request
import json
import os
import re
import math
import sys

app = Flask(__name__)

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
    }
}
UNIT_ROLE_TYPE_LANG_MAP = {'EN': {'1': 'Attack Type', '2': 'Defense Type', '3': 'Support Type'}, 'TW': {'1': '攻擊型', '2': '防禦型', '3': '支援型'}}
ROLE_NAME_MAP_CHARS = {'EN': {'Attack': 'Attack', 'Defense': 'Defense', 'Support': 'Support'}, 'TW': {'Attack': '攻擊型', 'Defense': '防禦型', 'Support': '支援型'}}
STAGE_TERRAIN_MAP = {'1': {'EN': 'Space', 'TW': '宇宙'}, '2': {'EN': 'Atmospheric', 'TW': '空中'}, '3': {'EN': 'Ground', 'TW': '地上'}, '5': {'EN': 'Amphibious', 'TW': '水陸'}}

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
_ALT_LANG_PREFIX = {'TW': 'Lang_MasterData_TW_'}
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
ROLE_MAP = {'0': 'NPC', '1': 'Attack', '2': 'Defense', '3': 'Support'}
ROLE_SORT = {'1': 0, '2': 1, '3': 2, '0': 3}
GROWTH_MAP = {'1': 60, '2': 70, '3': 80, '4': 90, '5': 100}
TERRAIN_SYMBOLS = {'0': '-', '1': '-', '2': '▲', '3': '●'}
CHAR_STAT_ORDER = ['Ranged', 'Melee', 'Awaken', 'Defense', 'Reaction']
UNIT_STAT_ORDER = ['HP', 'EN', 'Attack', 'Defense', 'Mobility', 'Move']

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
    0: 'UI_Common_TerrainIcon_Hyphen.png',
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
    '3': '/static/images/UI/UI_Common_TypeIcon_Ranged_M.png',
}
EX_ABILITY_PATTERNS = ['ex character ability','ex機體能力','ex角色能力','exキャラクターアビリティ']
MECH_MAP_TABLE = {'1': ['1'], '2': ['2'], '3': ['1', '2'], '5': ['2x2', '4'], '6': ['1', '5'], '7': ['2x2', '6'], '8': ['1', '7'], '9': ['1', '6']}

def _is_conditional_stat_text(t):
    tl = (t or '').lower()
    for kw in ['when ', 'if ', 'during ', 'at the start', 'each time', 'every time', 'each time you', 'every time you']:
        if kw in tl: return True
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
    Find portrait using IMAGE_INDEX.
    portrait_folder_key: e.g., 'images/portraits' or 'images/unit_portraits'
    Prefers filenames without ' #' (space+hash) suffix for CDN compatibility.
    """
    if not IMAGE_INDEX:
        return None

    def pick_best(matches):
        """Prefer filename without ' #' suffix (cleaner for URLs/CDN)."""
        if not matches:
            return None
        clean = [m for m in matches if ' #' not in m]
        return clean[0] if clean else matches[0]

    candidates = []
    if isinstance(resource_ids, list):
        candidates = [str(r).strip() for r in resource_ids if r and str(r).strip() and str(r).strip() != '0']
    elif resource_ids:
        r = str(resource_ids).strip()
        if r and r != '0':
            candidates = [r]

    files = IMAGE_INDEX.get(portrait_folder_key, [])

    # Try resource IDs first
    for rid in candidates:
        rl = rid.lower()
        matches = [fn for fn in files if rl in fn.lower()]
        best = pick_best(matches)
        if best:
            return f"/static/{portrait_folder_key}/{best}"

    # Try entity ID
    if entity_id:
        eid = str(entity_id).strip()
        el = eid.lower()
        matches = [fn for fn in files if el in fn.lower()]
        best = pick_best(matches)
        if best:
            return f"/static/{portrait_folder_key}/{best}"

        # Try suffixes
        for slen in [8, 7, 6, 5, 4]:
            if len(eid) >= slen:
                suffix = eid[-slen:].lower()
                matches = [fn for fn in files if suffix in fn.lower()]
                best = pick_best(matches)
                if best:
                    return f"/static/{portrait_folder_key}/{best}"

    return None

def find_series_icon(series_id):
    """Find series icon using IMAGE_INDEX."""
    if not series_id or not IMAGE_INDEX:
        return ''
    
    sid = str(series_id).strip()
    if not sid or sid == '0':
        return ''
    
    sl = sid.lower()
    for fn in IMAGE_INDEX.get('images/Logo-Series', []):
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

def find_supporter_portrait(resource_id, supporter_id):
    """Find supporter thumbnail using IMAGE_INDEX (images/Trait/thum)."""
    candidates = [str(resource_id).strip()] if resource_id and str(resource_id).strip() != '0' else []
    if supporter_id: candidates.append(str(supporter_id).strip())
    for rid in candidates:
        if not rid: continue
        rl = rid.lower()
        for fn in IMAGE_INDEX.get('images/Trait/thum', []):
            if rl in fn.lower():
                return f"/static/images/Trait/thum/{fn}"
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
        lookup[tid] = {'desc_lang_id': normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId')), 'active_cond_id': normalize_id(item.get('ActiveConditionSetId') or item.get('activeConditionSetId') or item.get('ActiveConditionId')), 'target_cond_id': normalize_id(item.get('TargetConditionSetId') or item.get('targetConditionSetId') or item.get('TargetConditionId'))}
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

def resolve_condition_tags(cond_id, trait_condition_raw_map, lineage_lookup, series_name_map, lang_code='EN'):
    if cond_id == '0': return []
    raw = trait_condition_raw_map.get(cond_id, {}); res = []; seen = set()
    def at(tid, tn, tt):
        if tn and tn not in seen: res.append({'id': tid, 'name': tn, 'type': tt}); seen.add(tn)
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
    for t in raw.get('unit_tags', []): n = fn(t, lineage_lookup, series_name_map); (n and at(t, n, 'unit'))
    for t in raw.get('char_tags', []): n = fn(t, lineage_lookup, series_name_map); (n and at(t, n, 'character'))
    for t in raw.get('group_tags', []): n = fn(t, lineage_lookup, series_name_map); (n and at(t, n, 'group'))
    for s in raw.get('series', []): n = fn(s, series_name_map); (n and at(s, n, 'series'))
    rtm = UNIT_ROLE_TYPE_LANG_MAP.get(lang_code, UNIT_ROLE_TYPE_LANG_MAP['EN'])
    for t in raw.get('types', []): n = rtm.get(t); (n and at('role_' + t, n, 'character'))
    return res

def create_char_info_map(m):
    lookup = {}
    for item in extract_data_list(m):
        if isinstance(item, dict):
            cid = normalize_id(item.get('id') or item.get('Id'))
            if cid != '0':
                acq = normalize_id(item.get('CharacterAcquisitionRouteTypeIndex') or item.get('characterAcquisitionRouteTypeIndex'), '0')
                rids = []
                for rk in ['ResourceId','resourceId','CutInResourceId','cutInResourceId','BromideResourceId','bromideResourceId','IconResourceId','iconResourceId']:
                    rv = str(item.get(rk) or '').strip()
                    if rv and rv != '0' and rv not in rids: rids.append(rv)
                lookup[cid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'acquisition_route': acq, 'resource_ids': rids}
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
                lookup[s] = {'rarity': normalize_id(item.get('RarityIndex') or item.get('rarityIndex'), '1'), 'hp_add': int(item.get('MaxHpAdditionValue') or item.get('maxHpAdditionValue') or 0), 'atk_add': int(item.get('MaxAttackAdditionValue') or item.get('maxAttackAdditionValue') or 0), 'resource_id': str(item.get('ResourceId') or item.get('resourceId') or '')}
    return lookup

def create_supporter_leader_skill_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        si = str(item.get('SupporterLeaderSkillContentSetId') or item.get('supporterLeaderSkillContentSetId') or item.get('Id') or item.get('id') or '')
        if not si: continue
        if si.endswith('03') or si.endswith('3'):
            sp = str(item.get('SupporterId') or item.get('supporterId') or si[:10])
            lookup.setdefault(sp, []).append({'set_id': si, 'desc_lang_id': normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId')), 'trait_cond_id': normalize_id(item.get('TraitConditionSetId') or item.get('traitConditionSetId')), 'sort': int(item.get('SortOrder') or item.get('sortOrder') or 0)})
    for k in lookup: lookup[k].sort(key=lambda x: x['sort'])
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
        entry = {'id': nid, 'map_stage_id': msid, 'x': safe_int(item.get('X'), 0), 'y': safe_int(item.get('Y'), 0)}
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
                lookup[uid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'model': str(item.get('ModelNumber') or item.get('modelNumber') or ''), 'series_set': normalize_id(item.get('SeriesSetId') or item.get('seriesSetId')), 'terrain_set': normalize_id(item.get('TerrainCapabilitySetId') or item.get('terrainCapabilitySetId')), 'mechanism_set_id': normalize_id(item.get('MechanismSetId') or item.get('mechanismSetId')), 'is_ultimate': is_ult, 'acquisition_route': acq, 'bromide_resource_id': bid, 'resource_ids': rids}
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
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('TerrainCapabilitySetId') or item.get('id') or item.get('Id'))
        if sid != '0': lookup[sid] = {'Space': int(item.get('SpaceIndex') or 0), 'Atmospheric': int(item.get('AtmosphericIndex') or 0), 'Ground': int(item.get('GroundIndex') or 0), 'Sea': int(item.get('SurfaceIndex') or 0), 'Underwater': int(item.get('UnderwaterIndex') or 0)}
    return lookup

def create_unit_lineage_link_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId')); lid = normalize_id(item.get('LineageId') or item.get('lineageId'))
        if uid != '0' and lid != '0': lookup.setdefault(uid, []); (lid not in lookup[uid] and lookup[uid].append(lid))
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
        active_cid = t_data.get('active_cond_id', '0'); target_cid = t_data.get('target_cond_id', '0'); trait_conds = []
        for cid in [active_cid, target_cid]:
            for c in resolve_condition_tags(cid, trait_condition_raw_map, lineage_lookup, series_name_map, lang_code):
                if c not in trait_conds: trait_conds.append(c)
        trait_info.append({'display_text': display_text, 'en_text': en_text, 'conditions': trait_conds})
    details = []
    for i, info in enumerate(trait_info):
        display_text = info['display_text']; en_text = info['en_text']; conds = list(info['conditions'])
        if display_text:
            en_text_lower = en_text.lower() if en_text else ''
            cond_matches = re.findall(r'\[condition\s*(\d+)\]', en_text_lower)
            if cond_matches:
                max_cond_num = max(int(mv) for mv in cond_matches); needed = max_cond_num - len(conds); lai = i + 1
                while needed > 0 and lai < len(trait_info):
                    for c in trait_info[lai]['conditions']:
                        if c not in conds: conds.append(c); needed -= 1
                        if needed <= 0: break
                    lai += 1
            existing = None
            for d2 in details:
                if d2['text'] == display_text: existing = d2; break
            if existing:
                for c in conds:
                    if c not in existing['conditions']: existing['conditions'].append(c)
            else: details.append({'text': display_text, 'conditions': conds})
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
trait_cond_data_r = load_json(os.path.join(BASE_DIR, "m_trait_condition.json"))
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

trait_set_traits_map = create_trait_set_to_traits_map(trait_set_data)
trait_data_map = create_trait_data_map(trait_logic_data)
trait_condition_raw_map = create_trait_condition_raw_map(trait_cond_data_r)
char_info_map = create_char_info_map(char_master); char_stat_map = create_char_status_map(char_status)
char_lin_map = create_char_lineage_link_map(char_lineage_data)
supporter_info_map = create_supporter_info_map(supporter_master) if supporter_master else {}
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
unit_lin_map = create_unit_lineage_link_map(unit_lineage_data); unit_ter_map = create_terrain_map(unit_terrain_data)
unit_abil_map = create_unit_ability_map(unit_abil_data); unit_weapon_map = create_unit_weapon_map(unit_weapon_data)
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
if ssp_abil_replace_data:
    for item in extract_data_list(ssp_abil_replace_data):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId'))
        if uid == '0':
            uid_raw = str(normalize_id(item.get('Id') or item.get('id')) or '')
            uid = uid_raw[:-2] if len(uid_raw) > 2 else '0'
        b_id = normalize_id(item.get('BeforeAbilityId') or item.get('beforeAbilityId')); a_id = normalize_id(item.get('AfterAbilityId') or item.get('afterAbilityId'))
        if uid != '0' and b_id != '0' and a_id != '0': unit_ssp_abil_replace_map.setdefault(uid, {})[b_id] = a_id

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
                    for rk in ['ResourceId','resourceId','CutInResourceId','cutInResourceId']:
                        rv = str(item.get(rk) or '').strip()
                        if rv and rv != '0' and rv not in rids: rids.append(rv)
                    char_info_map[cid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'acquisition_route': normalize_id(item.get('CharacterAcquisitionRouteTypeIndex'),'0'), 'resource_ids': rids}
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
                    unit_info_map[uid] = {'rarity': normalize_id(item.get('RarityTypeIndex'),'1'), 'role': normalize_id(item.get('RoleTypeIndex'),'0'), 'model': str(item.get('ModelNumber') or ''), 'series_set': normalize_id(item.get('SeriesSetId') or item.get('seriesSetId')), 'terrain_set': normalize_id(item.get('TerrainCapabilitySetId') or item.get('terrainCapabilitySetId')), 'is_ultimate': is_ult, 'acquisition_route': normalize_id(item.get('UnitAcquisitionRouteTypeIndex'),'0'), 'bromide_resource_id': bid, 'resource_ids': rids}
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
    
    LANG_DATA[lang_code] = {'abil_name_map': anm, 'abil_desc_map': adm, 'lineage_list': ll, 'lineage_lookup': llk, 'series_name_map': snm, 'lang_text_map': ltm, 'char_id_map': cim, 'char_text_map': ctm, 'char_ser_map': csm, 'ser_set_map': ssm, 'series_list': sl, 'skill_text_map': stm, 'skill_resource_map': srm, 'unit_id_map': uim, 'unit_text_map': utm, 'supporter_id_map': supp_im, 'supporter_text_map': supp_tm, 'supporter_leader_text_map': supp_leader_tm, 'supporter_active_text_map': supp_active_tm, 'stage_text_map': stage_text_map, 'stage_condition_text_map': stage_condition_text_map, 'weapon_text_map': wtm2, 'weapon_trait_map': wtrm, 'weapon_capability_map': wcam, 'weapon_trait_detail_map': wtdm, 'mechanism_map': mech_map}
    print(f"  {lang_code}: {len(ctm)} chars, {len(utm)} units")

print("Database ready!")
print("=" * 60)

# ═══════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════

def get_lang_data(lc): return LANG_DATA.get(lc, LANG_DATA.get(DEFAULT_LANG, {}))
def get_calc_lang_data(): return LANG_DATA.get(CALC_LANG, {})

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
    if nlid and nlid != '0':
        entries = stm.get(nlid)
        if entries and isinstance(entries, list) and len(entries) > 0: name = entries[0].get('text', '')
    if dlid and dlid != '0':
        entries = stm.get(dlid)
        if entries and isinstance(entries, list) and len(entries) > 0: desc = entries[0].get('text', '')
    if name == 'Unknown':
        bi = sid[:-2] if len(sid) > 2 else sid
        for k in [bi, sid, sid[-9:] if len(sid) >= 9 else None]:
            if k and k in stm:
                entries = stm[k]; name = entries[0]['text']; desc = '\n'.join([x['text'] for x in entries[1:]]) if len(entries) > 1 else ''
                break
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
    if lc not in LANG_DATA: lc = DEFAULT_LANG
    return lc

def sort_rows(rows, sort_by, sort_dir, valid_sorts, default_sort='rarity'):
    if sort_by not in valid_sorts: sort_by = default_sort
    if sort_by == 'rarity':
        if sort_dir == 'asc': rows.sort(key=lambda r: (-r['rarity_sort'], r['name'].lower()))
        else: rows.sort(key=lambda r: (r['rarity_sort'], r['name'].lower()))
    elif sort_by == 'name':
        if sort_dir == 'asc': rows.sort(key=lambda r: (r['rarity_sort'], r['name'].lower()))
        else: rows.sort(key=lambda r: (r['rarity_sort'], r['name'].lower())); rows.sort(key=lambda r: r['name'].lower(), reverse=True); rows.sort(key=lambda r: r['rarity_sort'])
    elif sort_by == 'role':
        if sort_dir == 'desc': rows.sort(key=lambda r: (r['rarity_sort'], r.get('role_sort',3), r['name'].lower()))
        else: rows.sort(key=lambda r: (r['rarity_sort'], -r.get('role_sort',3), r['name'].lower()))
    else:
        if sort_dir == 'desc': rows.sort(key=lambda r: (r['rarity_sort'], -r.get(sort_by, 0), r['name'].lower()))
        else: rows.sort(key=lambda r: (r['rarity_sort'], r.get(sort_by, 0), r['name'].lower()))
    return rows

# ═══════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════

@app.route('/')
def index(): 
    return render_template('index.html', image_cdn=IMAGE_CDN or '')

@app.route('/api/languages')
def get_languages(): 
    return jsonify(convert_image_urls({'languages': list(LANG_DATA.keys()), 'default': DEFAULT_LANG}))

@app.route('/api/tag_units')
def get_tag_units():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); ts = request.args.get('tags', '').strip(); op = request.args.get('op', 'and').lower()
        if not ts: return jsonify({'1': [], '2': [], '3': []})
        tl = [t.strip().lower() for t in ts.split(',') if t.strip()]; ck = f"tag_units_{ts}_{op}_{lc}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); results = {'1': [], '2': [], '3': []}
        rnm = UNIT_ROLE_TYPE_LANG_MAP.get(lc, UNIT_ROLE_TYPE_LANG_MAP['EN']); rnm_en = UNIT_ROLE_TYPE_LANG_MAP.get('EN', {})
        for uid, info in unit_info_map.items():
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']: continue
            lid = ld.get('unit_id_map', {}).get(uid, ''); name = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
            if not name: continue
            tset = set([t.get('name', '').lower() for t in resolve_tags(unit_lin_map, uid, lc, 'unit')] + [s.get('name', '').lower() for s in resolve_series(unit_ser_map.get(uid, ''), lc)])
            if rnm.get(ri2): tset.add(rnm[ri2].lower())
            if rnm_en.get(ri2): tset.add(rnm_en[ri2].lower())
            if lc != 'EN':
                tset.update([t.get('name', '').lower() for t in resolve_tags(unit_lin_map, uid, 'EN', 'unit')])
                tset.update([s.get('name', '').lower() for s in resolve_series(unit_ser_map.get(uid, ''), 'EN')])
            match = all(t in tset for t in tl) if op == 'and' else any(t in tset for t in tl)
            if match:
                ri = info.get('rarity', '1'); thum = find_portrait(info.get('resource_ids', []), uid, 'images/unit_portraits')
                results[ri2].append({'id': uid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': info.get('acquisition_route', '0')})
        for r in results: results[r].sort(key=lambda x: (x['rarity_sort'], x['name']))
        set_cached_response(ck, results); return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'1': [], '2': [], '3': []}), 500

@app.route('/api/tag_characters')
def get_tag_characters():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); ts = request.args.get('tags', '').strip(); op = request.args.get('op', 'and').lower()
        if not ts: return jsonify({'1': [], '2': [], '3': []})
        tl = [t.strip().lower() for t in ts.split(',') if t.strip()]; ck = f"tag_chars_{ts}_{op}_{lc}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); results = {'1': [], '2': [], '3': []}
        rlm = ROLE_NAME_MAP_CHARS.get(lc, ROLE_NAME_MAP_CHARS['EN']); rlm_en = ROLE_NAME_MAP_CHARS.get('EN', {})
        for cid, info in char_info_map.items():
            ri2 = str(info.get('role', '0'))
            if ri2 not in ['1', '2', '3']: continue
            lid = ld.get('char_id_map', {}).get(cid, ''); name = ld.get('char_text_map', {}).get(lid, '') if lid else ''
            if not name: name = f"Unknown ({cid})"
            tset = set([t.get('name', '').lower() for t in resolve_tags(char_lin_map, cid, lc, 'character')] + [s.get('name', '').lower() for s in resolve_series(ld.get('char_ser_map', {}).get(cid, ''), lc)])
            br = ROLE_MAP.get(ri2, '')
            if br and rlm.get(br): tset.add(rlm[br].lower())
            if br and rlm_en.get(br): tset.add(rlm_en[br].lower())
            if lc != 'EN':
                tset.update([t.get('name', '').lower() for t in resolve_tags(char_lin_map, cid, 'EN', 'character')])
                tset.update([s.get('name', '').lower() for s in resolve_series(ld.get('char_ser_map', {}).get(cid, ''), 'EN')])
            match = all(t in tset for t in tl) if op == 'and' else any(t in tset for t in tl)
            if match:
                ri = info.get('rarity', '1'); thum = find_portrait(info.get('resource_ids', []), cid, 'images/portraits')
                results[ri2].append({'id': cid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_sort': RARITY_SORT.get(ri, 4), 'thum': thum or '', 'acquisition_route': info.get('acquisition_route', '0')})
        for r in results: results[r].sort(key=lambda x: (x['rarity_sort'], x['name']))
        set_cached_response(ck, results); return jsonify(convert_image_urls(results))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'1': [], '2': [], '3': []}), 500

@app.route('/api/characters')
def list_characters():
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
    pp = min(100, max(10, int(request.args.get('per_page', 50)))); sb = request.args.get('sort', 'rarity'); sd = request.args.get('dir', 'desc')
    sq = request.args.get('q', '').strip().lower(); rf = request.args.get('role', '').strip(); ck = f"cl_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{rf}"
    cached = get_cached_response(ck)
    if cached: return jsonify(cached)
    ld = get_lang_data(lc); rows = []
    for cid, info in char_info_map.items():
        ri = info.get('rarity','1'); role_id = info.get('role','0')
        if role_id == '0': continue
        if rf and rf != role_id: continue
        lid = ld['char_id_map'].get(cid, ''); name = ld['char_text_map'].get(lid, '') if lid else ''
        if not name: name = f"Unknown ({cid})"
        if sq:
            ss = f"{name} {cid} " + " ".join([t['name'] for t in resolve_tags(char_lin_map, cid, lc, 'character')]) + " " + " ".join([s['name'] for s in resolve_series(ld.get('char_ser_map', {}).get(cid, ''), lc)])
            if sq not in ss.lower(): continue
        raw = char_stat_map.get(cid, {}); t = lambda s: raw.get(s, (0,0,0)); grown = {s: calc_growth_char(t(s)[0], t(s)[1], ri) for s in CHAR_STAT_ORDER}
        thum = find_portrait(info.get('resource_ids', []), cid, 'images/portraits')
        rows.append({'id': cid, 'name': name, 'role': ROLE_MAP.get(role_id,'NPC'), 'role_id': role_id, 'role_sort': ROLE_SORT.get(role_id,3), 'role_icon': ROLE_ICON_MAP.get(role_id,''), 'rarity': RARITY_MAP.get(ri,'N'), 'rarity_id': ri, 'rarity_sort': RARITY_SORT.get(ri,4), 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'thum': thum or '', 'Ranged': grown.get('Ranged',0), 'Melee': grown.get('Melee',0), 'Awaken': grown.get('Awaken',0), 'Defense': grown.get('Defense',0), 'Reaction': grown.get('Reaction',0)})
    rows = sort_rows(rows, sb, sd, {'name','role','rarity','Ranged','Melee','Awaken','Defense','Reaction'})
    total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
    start = (page - 1) * pp; pr = rows[start:start + pp]
    result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd, 'role_filter': rf}
    set_cached_response(ck, result); return jsonify(convert_image_urls(result))

@app.route('/api/units')
def list_units():
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
    pp = min(100, max(10, int(request.args.get('per_page', 50)))); sb = request.args.get('sort', 'rarity'); sd = request.args.get('dir', 'desc')
    sq = request.args.get('q', '').strip().lower(); rf = request.args.get('role', '').strip(); ck = f"ul_{lc}_{page}_{pp}_{sb}_{sd}_{sq}_{rf}"
    cached = get_cached_response(ck)
    if cached: return jsonify(cached)
    ld = get_lang_data(lc); rows = []
    for uid, info in unit_info_map.items():
        ri = info.get('rarity','1'); role_id = info.get('role','0')
        if role_id == '0': continue
        if rf and rf != role_id: continue
        lid = ld['unit_id_map'].get(uid, ''); name = ld['unit_text_map'].get(lid, '') if lid else ''
        if not name: continue
        if sq:
            ss = f"{name} {uid} " + " ".join([t['name'] for t in resolve_tags(unit_lin_map, uid, lc, 'unit')]) + " " + " ".join([s['name'] for s in resolve_series(unit_ser_map.get(uid, ''), lc)])
            if sq not in ss.lower(): continue
        raw = unit_stat_map.get(uid, {}); fs = {}
        if raw:
            for s in ['HP','EN','Attack','Defense','Mobility']:
                st = raw.get(s, (0,0,0)); st = (st[0], st[1], st[2]) if len(st) >= 3 else (st[0], st[1], st[1] if len(st) > 1 else st[0])
                fs[s] = calc_growth_unit(st[0], st[1], ri)
            mov = raw.get('Move', (0,0)); mov = (mov[0], mov[1]) if isinstance(mov, (list, tuple)) and len(mov) >= 2 else (mov if isinstance(mov, (int, float)) else 0, mov if isinstance(mov, (int, float)) else 0)
            fs['Move'] = mov[0] if isinstance(mov, (list, tuple)) else mov
        acq = info.get('acquisition_route','0'); ai = ACQUISITION_ROUTE_ICONS.get(acq,''); si = []
        if info.get('is_ultimate', False): si.append(ULT_ICON)
        if ai: si.append(ai)
        portrait = find_portrait(info.get('resource_ids', []), uid, 'images/unit_portraits')
        rows.append({'id': uid, 'name': name, 'role': ROLE_MAP.get(role_id,'NPC'), 'role_id': role_id, 'role_sort': ROLE_SORT.get(role_id,3), 'role_icon': ROLE_ICON_MAP.get(role_id,''), 'rarity': RARITY_MAP.get(ri,'N'), 'rarity_id': ri, 'rarity_sort': RARITY_SORT.get(ri,4), 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'special_icons': si, 'thum': portrait or '', 'ATK': fs.get('Attack',0), 'DEF': fs.get('Defense',0), 'MOB': fs.get('Mobility',0), 'HP': fs.get('HP',0), 'EN': fs.get('EN',0), 'MOV': fs.get('Move',0)})
    rows = sort_rows(rows, sb, sd, {'name','role','rarity','ATK','DEF','MOB','HP','EN','MOV'})
    total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
    start = (page - 1) * pp; pr = rows[start:start + pp]
    result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd, 'role_filter': rf}
    set_cached_response(ck, result); return jsonify(convert_image_urls(result))

@app.route('/api/supporters')
def list_supporters():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
        pp = min(100, max(10, int(request.args.get('per_page', 50)))); sb = request.args.get('sort', 'rarity'); sd = request.args.get('dir', 'desc')
        sq = request.args.get('q', '').strip().lower(); ck = f"sl_{lc}_{page}_{pp}_{sb}_{sd}_{sq}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); rows = []
        for sid, info in supporter_info_map.items():
            ri = info.get('rarity','1'); lid = ld.get('supporter_id_map', {}).get(sid, ''); name = ld.get('supporter_text_map', {}).get(lid, '') if lid else ''
            if not name: continue
            lsr = supporter_leader_map.get(sid, []); all_tags = []; descs = []; std = []
            for ls in lsr:
                desc = ld.get('supporter_leader_text_map', {}).get(ls.get('desc_lang_id', ''), '')
                tags = resolve_condition_tags(ls.get('trait_cond_id', '0'), trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), lc)
                if desc: descs.append(desc)
                sep = 'and' if '44%' in desc else ('or' if '36%' in desc else 'default')
                if tags: std.append({'tags': tags, 'separator': sep})
                for t in tags:
                    if not any(x['name'] == t['name'] for x in all_tags): all_tags.append(t)
            sts = ", ".join([t['name'] for t in all_tags]); cb = "\n".join(descs)
            if sq and sq not in name.lower() and sq not in sid and sq not in sts.lower() and sq not in cb.lower(): continue
            thum = find_supporter_portrait(info.get('resource_id'), sid)
            aic = ''
            ask = supporter_active_map.get(sid, [])
            if ask:
                icf = find_trait_icon(ask[0].get('resource_id', ''))
                if icf: aic = f"/static/images/Trait/{icf}"
            rows.append({'id': sid, 'name': name, 'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_id': ri, 'rarity_sort': RARITY_SORT.get(ri, 4), 'rarity_icon': RARITY_ICON_MAP.get(ri, ''), 'thum': thum or '', 'skill_tag_data': std, 'series_tag': sts, 'boost': cb, 'active_icon': aic})
        rows = sort_rows(rows, sb, sd, {'name', 'rarity', 'series_tag', 'boost'})
        total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
        start = (page - 1) * pp; pr = rows[start:start + pp]
        result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'rows': [], 'total': 0, 'page': 1, 'per_page': 50, 'total_pages': 1}), 500

@app.route('/api/supporter/<supporter_id>')
def get_supporter(supporter_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); ck = f"s_{supporter_id}_{lc}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); supporter_id = normalize_id(supporter_id); info = supporter_info_map.get(supporter_id)
        if not info: return jsonify({'error': f'Supporter {supporter_id} not found'}), 404
        ri = info.get('rarity', '1'); lid = ld.get('supporter_id_map', {}).get(supporter_id, ""); cn = ld.get('supporter_text_map', {}).get(lid, "Unknown") if lid else "Unknown"
        hps = math.floor(info.get('hp_add', 0) * 1.4); atks = math.floor(info.get('atk_add', 0) * 1.4)
        ls = []
        for l in supporter_leader_map.get(supporter_id, []):
            desc = ld.get('supporter_leader_text_map', {}).get(l.get('desc_lang_id', ''), '')
            tags = resolve_condition_tags(l.get('trait_cond_id', '0'), trait_condition_raw_map, ld.get('lineage_lookup', {}), ld.get('series_name_map', {}), lc)
            sep = 'and' if '44%' in desc else ('or' if '36%' in desc else 'default')
            ls.append({'desc': desc, 'tags': tags, 'separator': sep})
        asks = []
        for a in supporter_active_map.get(supporter_id, []):
            an = ld.get('supporter_active_text_map', {}).get(a.get('name_lang_id', ''), ''); ad = ld.get('supporter_active_text_map', {}).get(a.get('desc_lang_id', ''), '')
            icf = find_trait_icon(a.get('resource_id', ''))
            asks.append({'name': an, 'desc': ad, 'icon': f"/static/images/Trait/{icf}" if icf else ''})
        portrait = find_supporter_portrait(info.get('resource_id'), supporter_id)
        result = {'id': supporter_id, 'name': cn, 'rarity': RARITY_MAP.get(ri, "Unknown"), 'rarity_id': ri, 'rarity_icon': RARITY_ICON_MAP.get(ri, ''), 'hp_support': hps, 'atk_support': atks, 'leader_skills': ls, 'active_skills': asks, 'portrait': portrait, 'lang': lc}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

@app.route('/api/stages')
def list_stages():
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); page = max(1, int(request.args.get('page', 1)))
        pp = min(100, max(10, int(request.args.get('per_page', 50)))); sq = request.args.get('q', '').strip().lower(); ck = f"stages_{lc}_{page}_{pp}_{sq}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); rows = []
        for sid, est in eternal_stage_map.items():
            sn = est.get('stage_number', 0); sname = ld.get('stage_text_map', {}).get(est.get('stage_name_lang_id', ''), '') or f"Unknown ({sid})"
            if sq and sq not in f"{sid} {sname} {sn}".lower(): continue
            sm = stage_map.get(sid, {}); diff = get_stage_difficulty(sid, lc)
            duid = est.get('display_unit_id', '0'); portrait = ''
            if duid != '0':
                uinfo = unit_info_map.get(duid, {}); portrait = find_portrait(uinfo.get('resource_ids', []), duid, 'images/unit_portraits') or ''
            rows.append({'id': sid, 'stage_number': sn, 'name': sname, 'recommended_cp': sm.get('recommended_cp', 0), 'terrain': resolve_stage_terrain_name(sm.get('terrain_type_index', '0'), lc), 'difficulty_code': diff['code'], 'difficulty_name': diff['name'], 'portrait': portrait})
        rows.sort(key=lambda x: (x['stage_number'], x['id']))
        total = len(rows); tp = max(1, math.ceil(total / pp)); page = min(page, tp)
        start = (page - 1) * pp; pr = rows[start:start + pp]
        result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'rows': [], 'total': 0, 'page': 1, 'per_page': 50, 'total_pages': 1}), 500

@app.route('/api/stage/<stage_id>')
def get_stage(stage_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); stage_id = normalize_id(stage_id); ck = f"stage_{stage_id}_{lc}"
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
                me = {'npc_id': nid, 'name': dn, 'portrait': dp, 'x': npc.get('x', 0), 'y': npc.get('y', 0), 'is_large': il, 'side': 'enemy'}
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
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); ck = f"c_{char_id}_{lc}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); ldc = get_calc_lang_data(); char_id = normalize_id(char_id); info = char_info_map.get(char_id)
        if not info: return jsonify({'error': f'Character {char_id} not found'}), 404
        ri = info.get('rarity','1'); lid = ld['char_id_map'].get(char_id, ""); cn = ld['char_text_map'].get(lid, "Unknown") if lid else "Unknown"
        raw = char_stat_map.get(char_id, {}); has_sp = int(ri) <= 4
        def rv(s): t = raw.get(s, (0,0,0)); return (t[0], t[1], t[2] if len(t) >= 3 else t[1])
        grown = {s: calc_growth_char(rv(s)[0], rv(s)[1], ri) for s in CHAR_STAT_ORDER}
        grown_sp = {s: calc_growth_char(rv(s)[0], rv(s)[2], ri) for s in CHAR_STAT_ORDER}
        fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId','')) == char_id]
        def build_ab(ab, lang=lc):
            bid = normalize_id(ab.get('AbilityId','')); spid = normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
            bab = build_ability_entry(bid, ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=int(ab.get('SortOrder',0)), lang_code=lang)
            if spid and spid != '0' and spid != 'None' and spid != bid:
                bab['sp_replacement'] = build_ability_entry(spid, ld['abil_name_map'], abil_link_map, trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'], trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'], ability_resource_map, ld['abil_desc_map'], sort_order=int(ab.get('SortOrder',0)), lang_code=lang)
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
        result = {'id': char_id, 'name': cn, 'rarity': RARITY_MAP.get(ri,"Unknown"), 'rarity_id': ri, 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'role': ROLE_MAP.get(info.get('role','0'),"Unknown"), 'role_id': info.get('role','0'), 'role_icon': ROLE_ICON_MAP.get(info.get('role','0'),''), 'stats': stats, 'stats_with_ex': stats_with_ex, 'has_ex_stats': has_ex_stats, 'has_sp': has_sp, 'sp_stats': sp_stats, 'sp_stats_with_ex': sp_stats_with_ex, 'tags': resolve_tags(char_lin_map, char_id, lc, 'character'), 'series': resolve_series(ld['char_ser_map'].get(char_id, ''), lc), 'abilities': abilities, 'skills': skills, 'portrait': portrait, 'lang': lc}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

@app.route('/api/unit/<unit_id>')
def get_unit(unit_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG)); ck = f"u_{unit_id}_{lc}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc); ldc = get_calc_lang_data(); unit_id = normalize_id(unit_id); info = unit_info_map.get(unit_id)
        if not info: return jsonify({'error': f'Unit {unit_id} not found'}), 404
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
        spb = {s: 0 for s in UNIT_STAT_ORDER}
        spc = {s: 0 for s in UNIT_STAT_ORDER}
        sspb = {s: 0 for s in UNIT_STAT_ORDER}
        sspc = {s: 0 for s in UNIT_STAT_ORDER}
        nxs = {s: 0 for s in UNIT_STAT_ORDER}
        nxss = {s: 0 for s in UNIT_STAT_ORDER}
        spb_move_flat = [0]; spc_move_flat = [0]; sspb_move_flat = [0]; sspc_move_flat = [0]

        def _ability_has_condition_word(ad):
            name = (ad.get('name') or '').lower()
            cond_words = ('condition', 'when countering', 'when counter')
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
                for part in parts:
                    itc = _is_conditional_stat_text(part)
                    flat_move = _extract_stat_flat_move(part, skip_conditional=False)
                    if flat_move:
                        if inx:
                            pass
                        elif ability_cond or hc or ie or itc:
                            cd_move_flat[0] += flat_move
                        else:
                            bd_move_flat[0] += flat_move
                    for s, pct in _extract_stat_percent_unit(part, skip_conditional=False).items():
                        if s == 'Move': continue
                        if unit_id == '1400000550' and s == 'HP' and pct == 5:
                            bd[s] = bd.get(s, 0) + pct
                            continue
                        if inx:
                            nd[s] = max(nd.get(s, 0), pct)
                        elif ability_cond or hc or ie or itc:
                            cd[s] = cd.get(s, 0) + pct
                        else:
                            bd[s] = bd.get(s, 0) + pct

        for ab in ac:
            ep(ab, spb, spc, nxs, spb_move_flat, spc_move_flat)
            if 'ssp_replacement' in ab:
                ep(ab['ssp_replacement'], sspb, sspc, nxss, sspb_move_flat, sspc_move_flat)
            else:
                ep(ab, sspb, sspc, nxss, sspb_move_flat, sspc_move_flat)
        for s in UNIT_STAT_ORDER:
            spc[s] = spc.get(s, 0) + nxs.get(s, 0)
            sspc[s] = sspc.get(s, 0) + nxss.get(s, 0)
        hcond = any(spc.get(s, 0) > 0 for s in UNIT_STAT_ORDER) or any(sspc.get(s, 0) > 0 for s in UNIT_STAT_ORDER)
        has_cond_ability = False
        for ab in ac:
            if _ability_has_condition_word(ab): has_cond_ability = True; break
            if 'ssp_replacement' in ab and _ability_has_condition_word(ab['ssp_replacement']): has_cond_ability = True; break
        hcond = hcond or has_cond_ability
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
        ubr = info.get('bromide_resource_id', '') or (info.get('resource_ids', [''])[0] if info.get('resource_ids') else '')
        td = unit_ter_map.get(info.get('terrain_set',''), {}); terrain = []
        terrain_levels = {tn: int(td.get(tn, 0) or 0) for tn in ['Space','Atmospheric','Ground','Sea','Underwater']}
        for tn in ['Space','Atmospheric','Ground','Sea','Underwater']:
            lv = terrain_levels.get(tn, 0)
            terrain.append({'name': tn, 'symbol': TERRAIN_SYMBOLS.get(str(lv),'-'), 'level': lv, 'type_icon': f"/static/images/Terrain/{TERRAIN_TYPE_ICON_MAP.get(tn,'')}" if TERRAIN_TYPE_ICON_MAP.get(tn) else '', 'level_icon': f"/static/images/Terrain/{TERRAIN_LEVEL_ICON_MAP.get(lv, TERRAIN_LEVEL_ICON_MAP[0])}"})
        terr_ssp_levels = dict(terrain_levels)
        if has_sp and ssp_core.get('terrain_upgrades'):
            for tn, fr, to in ssp_core['terrain_upgrades']:
                cur = int(terr_ssp_levels.get(tn, 0) or 0)
                terr_ssp_levels[tn] = to if cur == fr else max(cur, to)
        terr_ssp = [{'name': tn, 'symbol': TERRAIN_SYMBOLS.get(str(terr_ssp_levels.get(tn,0)),'-'), 'level': terr_ssp_levels.get(tn,0), 'type_icon': f"/static/images/Terrain/{TERRAIN_TYPE_ICON_MAP.get(tn,'')}" if TERRAIN_TYPE_ICON_MAP.get(tn) else '', 'level_icon': f"/static/images/Terrain/{TERRAIN_LEVEL_ICON_MAP.get(terr_ssp_levels.get(tn,0), TERRAIN_LEVEL_ICON_MAP[0])}"} for tn in ['Space','Atmospheric','Ground','Sea','Underwater']]
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
        mm = ld.get('mechanism_map', {})
        for mid in mids:
            if mid == '2x2': continue
            for rmm in mm.get(mid, []):
                if rmm.get('id') == mid:
                    icf = find_mechanism_icon(rmm.get('resource_id', ''))
                    mechs.append({'name': rmm.get('name', 'Unknown'), 'description': rmm.get('description', ''), 'icon': f"/static/images/mechanism/{icf}" if icf else ''})
                    break
        has_terrain_enh = bool(has_sp and ssp_core.get('terrain_upgrades'))
        result = {'id': unit_id, 'name': un, 'rarity': RARITY_MAP.get(ri,"Unknown"), 'rarity_id': ri, 'rarity_icon': RARITY_ICON_MAP.get(ri,''), 'role': ROLE_MAP.get(info.get('role','0'),"Unknown"), 'role_id': info.get('role','0'), 'role_icon': ROLE_ICON_MAP.get(info.get('role','0'),''), 'model': info.get('model',''), 'stats': stats, 'lb_data': lb_data, 'terrain': terrain, 'terrain_ssp': terr_ssp, 'has_terrain_enhancement': has_terrain_enh, 'tags': resolve_tags(unit_lin_map, unit_id, lc, 'unit'), 'series': resolve_series(unit_ser_map.get(unit_id,''), lc), 'abilities': abilities, 'mechanisms': mechs, 'weapons': weapons, 'portrait': portrait, 'lang': lc, 'is_ultimate': info.get('is_ultimate', False), 'acquisition_route': acq, 'acquisition_icon': ai2 or ACQUISITION_ROUTE_ICONS.get(acq, ''), 'special_icons': sicons, 'has_sp': has_sp, 'has_cond_stats': hcond, 'is_large': il}
        set_cached_response(ck, result); return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback; traceback.print_exc(); return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    for d in ["static/images/portraits","static/images/unit_portraits","static/images/Trait","static/images/Trait/thum","static/images/Terrain","static/images/WeaponIcon","static/images/UI","static/images/Logo-Series","static/images/Background","static/images/Rarity"]:
        os.makedirs(d, exist_ok=True)
    app.run(debug=True, port=5000)