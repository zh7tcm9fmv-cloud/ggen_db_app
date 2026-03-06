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

IMAGE_INDEX_PATH = os.path.join(os.path.dirname(__file__), 'image_index.json')
IMAGE_INDEX = {}
if os.path.exists(IMAGE_INDEX_PATH):
    with open(IMAGE_INDEX_PATH, 'r') as f:
        IMAGE_INDEX = json.load(f)
    print(f"Loaded image index with {len(IMAGE_INDEX)} folders")
else:
    print("Warning: image_index.json not found")

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
        'restriction_mp': 'Can be used when consuming 5 MP.',
        'restriction_hp': 'Can be used when consuming {}% HP.',
    },
    'TW': {
        'restriction_before_moving': '僅限移動前使用。',
        'restriction_tension_max': '鬥志Max以上時可使用。',
        'restriction_mp': '消耗5MP時可使用。',
        'restriction_hp': '消耗{}%HP時可使用。',
    }
}

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
MP_CONSUMPTION_WEAPON_IDS = ['120000395006']
HP_CONSUMPTION_UNIT_EX = {'1501002250': 10}
ACQUISITION_ROUTE_ICONS = {
    '1': '/static/images/UI/UI_Common_Icon_Source_Gasha.png',
    '2': '',
    '3': '/static/images/UI/UI_Common_Icon_Source_Event.png',
}
ULT_ICON = '/static/images/UI/UI_Common_Icon_ULT.png'
RARITY_ICON_MAP = {
    '1': '/static/images/UI/UI_Common_RarityIcon_N.png',
    '2': '/static/images/UI/UI_Common_RarityIcon_R.png',
    '3': '/static/images/UI/UI_Common_RarityIcon_SR.png',
    '4': '/static/images/UI/UI_Common_RarityIcon_SSR.png',
    '5': '/static/images/UI/UI_Common_RarityIcon_UR.png',
}
ROLE_ICON_MAP = {
    '1': '/static/images/UI/UI_Common_TypeIcon_Attack_M.png',
    '2': '/static/images/UI/UI_Common_TypeIcon_Defense_M.png',
    '3': '/static/images/UI/UI_Common_TypeIcon_Ranged_M.png',
}
EX_ABILITY_PATTERNS = ['ex character ability', 'ex機體能力', 'ex角色能力', 'exキャラクターアビリティ']

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
    if not IMAGE_INDEX:
        return None
    candidates = []
    if isinstance(resource_ids, list):
        candidates = [str(r).strip() for r in resource_ids if r and str(r).strip() and str(r).strip() != '0']
    elif resource_ids:
        r = str(resource_ids).strip()
        if r and r != '0':
            candidates = [r]
    for rid in candidates:
        rl = rid.lower()
        for fn in IMAGE_INDEX.get(portrait_folder_key, []):
            if rl in fn.lower():
                return f"/static/{portrait_folder_key}/{fn}"
    if entity_id:
        eid = str(entity_id).strip()
        el = eid.lower()
        for fn in IMAGE_INDEX.get(portrait_folder_key, []):
            if el in fn.lower():
                return f"/static/{portrait_folder_key}/{fn}"
        for slen in [8, 7, 6, 5, 4]:
            if len(eid) >= slen:
                suffix = eid[-slen:].lower()
                for fn in IMAGE_INDEX.get(portrait_folder_key, []):
                    if suffix in fn.lower():
                        return f"/static/{portrait_folder_key}/{fn}"
    return None

def find_series_icon(series_id):
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
    if not resource_id or str(resource_id) == '0':
        return None
    rl = str(resource_id).lower()
    for fn in IMAGE_INDEX.get('images/Trait', []):
        if rl in fn.lower():
            return fn
    for fn in IMAGE_INDEX.get('images/Trait/thum', []):
        if rl in fn.lower():
            return f"thum/{fn}"
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
            if rid != '0' and val:
                entries.append((rid, val))
                lookup[rid] = val
    for rid, val in entries:
        for sl in [4, 5, 6, 7, 8]:
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
                for sl in [4, 5, 6, 7, 8]:
                    if len(rid) >= sl:
                        s = rid[-sl:]
                        if s not in lookup: lookup[s] = val
    return lookup

def create_series_maps(master, set_data, text_data):
    char_ser_map, set_map, series_list = {}, {}, []
    for item in extract_data_list(master):
        if isinstance(item, dict):
            cid = normalize_id(item.get('id') or item.get('Id'))
            sid = normalize_id(item.get('SeriesSetId') or item.get('seriesSetId'))
            if cid != '0' and sid != '0': char_ser_map[cid] = sid
    temp = {}
    for item in extract_data_list(set_data):
        if isinstance(item, dict):
            ssid = normalize_id(item.get('SeriesSetId'))
            sid = normalize_id(item.get('SeriesId'))
            sort = int(item.get('SortOrder') or 0)
            if ssid != '0' and sid != '0':
                temp.setdefault(ssid, []).append({'id': sid, 'sort': sort})
    for k, v in temp.items():
        v.sort(key=lambda x: x['sort'])
        set_map[k] = [x['id'] for x in v]
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
                if len(rid) > 9:
                    name_map[rid[:-2][-7:]] = val
    seen = set()
    for item in extract_data_list(desc_data_lang):
        if isinstance(item, dict):
            rid = normalize_id(item.get('id') or item.get('Id'))
            val = item.get('value') or item.get('Value') or item.get('description') or item.get('Description') or item.get('text') or item.get('Text')
            if rid != '0' and val:
                val = str(val).replace("\\n", "\n")
                if (rid, val) in seen: continue
                seen.add((rid, val))
                entry = {'text': val, 'full_id': rid}
                desc_map.setdefault(rid, []).append(entry)
                if len(rid) >= 9:
                    aid = rid[:-2][-7:]
                    desc_map.setdefault(aid, [])
                    if not any(x['full_id'] == rid for x in desc_map[aid]):
                        desc_map[aid].append(entry)
    return name_map, desc_map

def create_trait_set_to_traits_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        set_id = normalize_id(item.get('TraitSetId') or item.get('traitSetId') or item.get('Id') or item.get('id'))
        trait_id = normalize_id(item.get('TraitId') or item.get('traitId'))
        sort = int(item.get('SortOrder') or item.get('sortOrder') or 0)
        if set_id != '0' and trait_id != '0':
            lookup.setdefault(set_id, []).append({'trait_id': trait_id, 'sort': sort})
    for k in lookup:
        lookup[k].sort(key=lambda x: x['sort'])
        lookup[k] = [x['trait_id'] for x in lookup[k]]
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
        }
    return lookup

def create_lang_text_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        lid = normalize_id(item.get('id') or item.get('Id'))
        val = item.get('value') or item.get('Value') or item.get('description') or item.get('Description') or item.get('text') or item.get('Text') or item.get('name') or item.get('Name')
        if lid != '0' and val:
            lookup[lid] = str(val).replace("\\n", "\n")
    return lookup

def create_trait_condition_raw_map(d):
    raw = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('TraitConditionSetId') or item.get('traitConditionSetId') or item.get('Id') or item.get('id'))
        if sid == '0': continue
        if sid not in raw:
            raw[sid] = {'tags': [], 'series': [], 'types': []}
        for key in ['UnitTags', 'unitTags', 'CharacterTags', 'characterTags', 'GroupTags', 'groupTags', 'GroupTag', 'groupTag']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v != '0' and v not in raw[sid]['tags']:
                        raw[sid]['tags'].append(v)
        for key in ['UnitSeries', 'unitSeries']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v != '0' and v not in raw[sid]['series']:
                        raw[sid]['series'].append(v)
        for key in ['UnitRoleTypes', 'unitRoleTypes']:
            val = str(item.get(key) or '')
            if val and val != '0':
                for v in val.split(','):
                    v = v.strip()
                    if v and v != '0' and v not in raw[sid]['types']:
                        raw[sid]['types'].append(v)
    return raw

UNIT_ROLE_TYPE_LANG_MAP = {
    'EN': {'1': 'Attack Type', '2': 'Defense Type', '3': 'Support Type'},
    'TW': {'1': '攻擊型', '2': '防禦型', '3': '支援型'},
}

def resolve_condition_tags(cond_id, trait_condition_raw_map, lineage_lookup, series_name_map, lang_code='EN'):
    if cond_id == '0': return []
    raw = trait_condition_raw_map.get(cond_id, {})
    resolved = []
    for tag_id in raw.get('tags', []):
        name = lineage_lookup.get(tag_id) or series_name_map.get(tag_id)
        if name and name not in resolved: resolved.append(name)
    for ser_id in raw.get('series', []):
        name = series_name_map.get(ser_id)
        if name and name not in resolved: resolved.append(name)
    rtm = UNIT_ROLE_TYPE_LANG_MAP.get(lang_code, UNIT_ROLE_TYPE_LANG_MAP['EN'])
    for type_id in raw.get('types', []):
        name = rtm.get(type_id)
        if name and name not in resolved: resolved.append(name)
    return resolved

# ═══════════════════════════════════════════════════════
# ENTITY INFO MAPS
# ═══════════════════════════════════════════════════════

def create_char_info_map(m):
    lookup = {}
    for item in extract_data_list(m):
        if isinstance(item, dict):
            cid = normalize_id(item.get('id') or item.get('Id'))
            if cid != '0':
                acq = normalize_id(item.get('CharacterAcquisitionRouteTypeIndex') or item.get('characterAcquisitionRouteTypeIndex'), '0')
                rids = []
                for rk in ['ResourceId', 'resourceId', 'CutInResourceId', 'cutInResourceId', 'BromideResourceId', 'bromideResourceId', 'IconResourceId', 'iconResourceId']:
                    rv = str(item.get(rk) or '').strip()
                    if rv and rv != '0' and rv not in rids: rids.append(rv)
                lookup[cid] = {
                    'rarity': normalize_id(item.get('RarityTypeIndex'), '1'),
                    'role': normalize_id(item.get('RoleTypeIndex'), '0'),
                    'acquisition_route': acq,
                    'resource_ids': rids,
                }
    return lookup

def create_char_status_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if isinstance(item, dict):
            cid = normalize_id(item.get('CharacterId') or item.get('characterId') or item.get('id') or item.get('Id'))
            if cid != '0':
                lookup[cid] = {
                    'Ranged': (int(item.get('Ranged') or 0), int(item.get('MaxRanged') or 0)),
                    'Melee': (int(item.get('Melee') or 0), int(item.get('MaxMelee') or 0)),
                    'Defense': (int(item.get('Defense') or 0), int(item.get('MaxDefense') or 0)),
                    'Reaction': (int(item.get('Reaction') or 0), int(item.get('MaxReaction') or 0)),
                    'Awaken': (int(item.get('Awaken') or 0), int(item.get('MaxAwaken') or 0)),
                }
    return lookup

def create_char_lineage_link_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if isinstance(item, dict):
            cid = normalize_id(item.get('CharacterId') or item.get('characterId'))
            lid = normalize_id(item.get('LineageId') or item.get('lineageId'))
            if cid != '0' and lid != '0':
                lookup.setdefault(cid, [])
                if lid not in lookup[cid]: lookup[cid].append(lid)
    return lookup

def create_skill_text_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        rid = normalize_id(item.get('id') or item.get('Id'))
        val = item.get('value') or item.get('Value') or item.get('name') or item.get('Name') or item.get('text') or item.get('Text')
        if rid != '0' and val:
            val = str(val).replace("\\n", "\n")
            entry = {"full_id": rid, "text": val}
            keys = {rid}
            for l in [6, 7, 8, 9]:
                if len(rid) >= l: keys.add(rid[-l:])
            for k in keys:
                lookup.setdefault(k, [])
                if not any(x['full_id'] == rid for x in lookup[k]):
                    lookup[k].append(entry)
    for k in lookup:
        lookup[k].sort(key=lambda x: x["full_id"])
    return lookup

# ═══════════════════════════════════════════════════════
# STAT CALCULATION FUNCTIONS (EN + TW support)
# ═══════════════════════════════════════════════════════

def calc_growth_char(base, mx, ri):
    gr = GROWTH_MAP.get(str(ri), 60)
    return math.floor(base + ((mx - base) * gr / 100))

def extract_stat_percent_char(text):
    """Extract character stat % bonuses from ability text (EN + TW)."""
    bonuses = {}
    tl = text.lower()
    for kw in ['when piloting', 'when supporting', 'when executing', 'if vigor']:
        if kw in tl: return bonuses
    for kw in ['搭乘', '支援', '出擊', '鬥志', '氣力']:
        if kw in text: return bonuses

    m = re.search(
        r"Increase (?:own )?(Melee|Ranged|Range|Defense|Reaction|Awaken|ATK|DEF)"
        r"(?: and (Melee|Ranged|Range|Defense|Reaction|Awaken|ATK|DEF))? by (\d+)%",
        text, re.IGNORECASE
    )
    if m:
        for s in [m.group(1), m.group(2)]:
            if s:
                n = s.title()
                u = n.upper()
                if u in ["ATK", "ATTACK"]: n = "Melee"
                if u == "DEF": n = "Defense"
                if u == "RANGE": n = "Ranged"
                bonuses[n] = bonuses.get(n, 0) + int(m.group(3))
        return bonuses

    tw_stat_map = {
        '射擊': 'Ranged', '格鬥': 'Melee', '覺醒': 'Awaken',
        '守備': 'Defense', '反應': 'Reaction',
        '攻擊': 'Melee', '防禦': 'Defense',
    }
    tw_stats_pattern = '|'.join(sorted(tw_stat_map.keys(), key=len, reverse=True))

    m = re.search(
        rf'(?:自身的?\s*)?({tw_stats_pattern})(?:(?:和|與|、)\s*({tw_stats_pattern}))?\s*(?:提升|上升|增加)\s*(\d+)%',
        text
    )
    if m:
        for s in [m.group(1), m.group(2)]:
            if s and s in tw_stat_map:
                en_name = tw_stat_map[s]
                bonuses[en_name] = bonuses.get(en_name, 0) + int(m.group(3))
        return bonuses

    m = re.search(rf'({tw_stats_pattern})\s*[+＋]\s*(\d+)%', text)
    if m:
        s = m.group(1)
        if s in tw_stat_map:
            en_name = tw_stat_map[s]
            bonuses[en_name] = bonuses.get(en_name, 0) + int(m.group(2))

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
                for rk in ['ResourceId', 'resourceId', 'CutInResourceId', 'cutInResourceId', 'IconResourceId', 'iconResourceId']:
                    rv = str(item.get(rk) or '').strip()
                    if rv and rv != '0' and rv not in rids: rids.append(rv)
                lookup[uid] = {
                    'rarity': normalize_id(item.get('RarityTypeIndex'), '1'),
                    'role': normalize_id(item.get('RoleTypeIndex'), '0'),
                    'model': str(item.get('ModelNumber') or item.get('modelNumber') or ''),
                    'series_set': normalize_id(item.get('SeriesSetId') or item.get('seriesSetId')),
                    'terrain_set': normalize_id(item.get('TerrainCapabilitySetId') or item.get('terrainCapabilitySetId')),
                    'is_ultimate': is_ult,
                    'acquisition_route': acq,
                    'bromide_resource_id': bid,
                    'resource_ids': rids,
                }
    return lookup

def create_unit_status_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if isinstance(item, dict):
            uid = normalize_id(item.get('UnitId') or item.get('unitId') or item.get('id') or item.get('Id'))
            if uid != '0':
                lookup[uid] = {
                    'HP': (int(item.get('Hp') or 0), int(item.get('MaxHp') or 0)),
                    'EN': (int(item.get('En') or 0), int(item.get('MaxEn') or 0)),
                    'Attack': (int(item.get('Attack') or 0), int(item.get('MaxAttack') or 0)),
                    'Defense': (int(item.get('Defense') or 0), int(item.get('MaxDefense') or 0)),
                    'Mobility': (int(item.get('Mobility') or 0), int(item.get('MaxMobility') or 0)),
                    'Move': int(item.get('MaxMovement') or 0),
                }
    return lookup

def create_terrain_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('TerrainCapabilitySetId') or item.get('id') or item.get('Id'))
        if sid != '0':
            lookup[sid] = {
                'Space': int(item.get('SpaceIndex') or 0),
                'Atmospheric': int(item.get('AtmosphericIndex') or 0),
                'Ground': int(item.get('GroundIndex') or 0),
                'Sea': int(item.get('SurfaceIndex') or 0),
                'Underwater': int(item.get('UnderwaterIndex') or 0),
            }
    return lookup

def create_unit_lineage_link_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId'))
        lid = normalize_id(item.get('LineageId') or item.get('lineageId'))
        if uid != '0' and lid != '0':
            lookup.setdefault(uid, [])
            if lid not in lookup[uid]: lookup[uid].append(lid)
    return lookup

def create_unit_ability_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId'))
        aid = normalize_id(item.get('AbilityId') or item.get('abilityId'))
        sort = int(item.get('SortOrder') or 0)
        if uid != '0' and aid != '0':
            lookup.setdefault(uid, []).append({'id': aid, 'sort': sort})
    for k in lookup:
        lookup[k].sort(key=lambda x: x['sort'])
    return lookup

def calc_growth_unit(base, mx, ri):
    gr = GROWTH_MAP.get(str(ri), 60)
    grown = math.floor(base + ((mx - base) * gr / 100))
    return math.floor(grown * 1.4)

def extract_stat_bonus_unit(text, fs):
    """Extract unit stat bonuses from ability text (EN + TW)."""
    bonuses = {}
    tl = text.lower()
    for kw in ['when ', 'if ', 'during ', 'at the start']:
        if kw in tl: return bonuses
    for kw in ['出擊時', '鬥志', '氣力', '戰鬥開始', '回合開始', '搭乘', '支援']:
        if kw in text: return bonuses

    def norm_en(name):
        n = name.strip().title().replace("Max ", "")
        if n == "Hp": n = "HP"
        if n == "En": n = "EN"
        if n == "Movement": n = "Move"
        u = n.upper()
        if u in ["ATK", "ATTACK"]: n = "Attack"
        elif u == "DEF": n = "Defense"
        elif u == "MOB": n = "Mobility"
        return n

    def add_bonus_en(name, pct):
        n = norm_en(name)
        if n == "Move": return
        base = fs.get(n, 0)
        if base > 0:
            bonuses[n] = bonuses.get(n, 0) + math.floor(base * pct / 100)

    sn = r"(?:HP|Max HP|EN|Max EN|Attack|ATK|Defense|DEF|Mobility|MOB|Move|Movement)"
    m = re.search(fr"Increase (?:own )?({sn})(?: and ({sn}))? by (\d+)%", text, re.IGNORECASE)
    if m:
        pct = int(m.group(3))
        add_bonus_en(m.group(1), pct)
        if m.group(2): add_bonus_en(m.group(2), pct)
        return bonuses

    tw_stat_map = {
        'HP': 'HP', 'EN': 'EN',
        '攻擊力': 'Attack', '攻擊': 'Attack',
        '防禦力': 'Defense', '防禦': 'Defense',
        '機動力': 'Mobility', '機動': 'Mobility',
        '移動力': 'Move', '移動': 'Move',
    }
    tw_stats_pattern = '|'.join(sorted(tw_stat_map.keys(), key=len, reverse=True))

    m = re.search(
        rf'(?:自身的?\s*)?({tw_stats_pattern})(?:(?:和|與|、)\s*({tw_stats_pattern}))?\s*(?:提升|上升|增加)\s*(\d+)%',
        text
    )
    if m:
        pct = int(m.group(3))
        for s in [m.group(1), m.group(2)]:
            if s and s in tw_stat_map:
                en_name = tw_stat_map[s]
                if en_name != "Move":
                    base = fs.get(en_name, 0)
                    if base > 0:
                        bonuses[en_name] = bonuses.get(en_name, 0) + math.floor(base * pct / 100)
        return bonuses

    m = re.search(rf'({tw_stats_pattern})\s*[+＋]\s*(\d+)%', text)
    if m:
        s = m.group(1)
        if s in tw_stat_map:
            pct = int(m.group(2))
            en_name = tw_stat_map[s]
            if en_name != "Move":
                base = fs.get(en_name, 0)
                if base > 0:
                    bonuses[en_name] = bonuses.get(en_name, 0) + math.floor(base * pct / 100)

    return bonuses

# ═══════════════════════════════════════════════════════
# WEAPON FUNCTIONS
# ═══════════════════════════════════════════════════════

def create_unit_weapon_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId'))
        wid = normalize_id(item.get('WeaponId') or item.get('weaponId'))
        sort = int(item.get('SortOrder') or item.get('sortOrder') or 0)
        if uid != '0' and wid != '0':
            lookup.setdefault(uid, []).append({'id': wid, 'sort': sort})
    for k in lookup:
        lookup[k].sort(key=lambda x: x['sort'])
    return lookup

def create_weapon_master_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        wid = normalize_id(item.get('Id') or item.get('id'))
        if wid != '0':
            hp_cost = 0
            for hp_key in ['HpCostRate', 'hpCostRate', 'HpConsumptionRate', 'hpConsumptionRate', 'UseHpRate', 'useHpRate']:
                v = item.get(hp_key)
                if v is not None and str(v).strip() not in ('', '0', 'None'):
                    try:
                        hp_cost = int(v)
                        break
                    except (ValueError, TypeError):
                        pass
            lookup[wid] = {
                'name_lang_id': normalize_id(item.get('NameLanguageId') or item.get('nameLanguageId')),
                'attribute': normalize_id(item.get('WeaponAttributeSetId') or item.get('weaponAttributeSetId')),
                'weapon_type': normalize_id(item.get('WeaponTypeIndex') or item.get('weaponTypeIndex'), '1'),
                'main_weapon_id': normalize_id(item.get('MainWeaponId') or item.get('mainWeaponId')),
                'attack_attribute': normalize_id(item.get('AttackAttributeSetId') or item.get('attackAttributeSetId')),
                'capability_set_id': normalize_id(item.get('WeaponCapabilitySetId') or item.get('weaponCapabilitySetId')),
                'tension_type': normalize_id(item.get('TensionTypeIndex') or item.get('tensionTypeIndex'), '0'),
                'hp_cost_rate': hp_cost,
            }
    return lookup

def create_weapon_status_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('Id') or item.get('id'))
        if sid != '0':
            lookup[sid] = {
                'range_min': int(item.get('RangeMin') or item.get('rangeMin') or 0),
                'range_max': int(item.get('RangeMax') or item.get('rangeMax') or 0),
                'power': int(item.get('Power') or item.get('power') or 0),
                'en': int(item.get('En') or item.get('en') or 0),
                'hit_rate': int(item.get('HitRate') or item.get('hitRate') or 0),
                'critical_rate': int(item.get('CriticalRate') or item.get('criticalRate') or 0),
                'override_correction_id': normalize_id(item.get('OverrideWeaponStatusChangePatternSetId') or item.get('overrideWeaponStatusChangePatternSetId')),
                'trait_correction_id': normalize_id(item.get('OverrideWeaponTraitChangePatternSetId') or item.get('overrideWeaponTraitChangePatternSetId')),
                'growth_pattern_id': normalize_id(item.get('WeaponLevelGrowthPatternSetId') or item.get('weaponLevelGrowthPatternSetId')),
            }
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
        level = int(item.get('CurrentWeaponLevel') or item.get('currentWeaponLevel') or 0)
        if sid != '0' and level == 5:
            lookup[sid] = {
                'power_rate': int(item.get('PowerCorrectionRate') or 100),
                'en_rate': int(item.get('EnCorrectionRate') or 100),
                'hit_rate': int(item.get('HitRateCorrectionRate') or 100),
                'crit_rate': int(item.get('CriticalRateCorrectionRate') or 100),
                'map_ammo': int(item.get('MapWeaponAmmoCapacity') or 0),
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
        if tc != '0' or sc != '0':
            lookup[sid] = {'trait_change_set_id': tc, 'status_change_set_id': sc}
    return lookup

def create_trait_change_level5_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict): continue
        sid = normalize_id(item.get('WeaponTraitChangePatternSetId') or item.get('weaponTraitChangePatternSetId'))
        level = int(item.get('CurrentWeaponLevel') or item.get('currentWeaponLevel') or 0)
        tid = normalize_id(item.get('WeaponTraitId') or item.get('weaponTraitId'))
        if sid != '0' and tid != '0' and level == 5:
            lookup.setdefault(sid, [])
            if tid not in lookup[sid]: lookup[sid].append(tid)
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
        tid = normalize_id(item.get('Id') or item.get('id'))
        dlid = normalize_id(item.get('DescriptionLanguageId') or item.get('descriptionLanguageId'))
        if tid != '0' and dlid != '0':
            t_val = lang_text.get(dlid, '')
            if t_val: lookup[tid] = t_val
    return lookup

def create_weapon_trait_map(base_dir, lang_dir):
    lookup, text_map = {}, {}
    for fn in ["m_weapon_trait.json", "m_trait.json"]:
        ld = load_json(os.path.join(lang_dir, fn))
        if ld:
            for item in extract_data_list(ld):
                if isinstance(item, dict):
                    lid = normalize_id(item.get('id') or item.get('Id'))
                    val = item.get('value') or item.get('Value') or item.get('description') or item.get('Description') or item.get('text') or item.get('Text')
                    if lid != '0' and val: text_map[lid] = str(val).replace("\\n", "\n")
    for fn in ["m_weapon_trait.json", "m_weapon_trait_change_pattern.json"]:
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
                for tl in [2, 4]:
                    if len(fid) > tl: keys.add(fid[:-tl])
            for k in keys:
                lookup.setdefault(k, [])
                if text not in lookup[k]: lookup[k].append(text)
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
    ai2 = WEAPON_ATTR_MAP.get(ai, {'label': 'Unknown', 'icon': ''})
    return {'icon': ai2['icon'], 'overlay': '', 'is_ex': False, 'is_map': False}

def resolve_weapon_stats(wm, wsm, wcm, wtm, wcam, gpm, tcl5m, wtdm, wid='', lang_code='EN', unit_id=''):
    mwid = wm.get('main_weapon_id', '0')
    csid = wm.get('capability_set_id', '0')
    tt = wm.get('tension_type', '0')
    wt = wm.get('weapon_type', '1')
    dr = {'range_min': 0, 'range_max': 0, 'power': 0, 'en': 0, 'accuracy': 0, 'critical': 0, 'ammo': 0, 'traits': [], 'usage_restrictions': []}
    if mwid == '0': return dr
    ws = wsm.get(mwid)
    if not ws: return dr
    bp, be, bh, bc = ws.get('power', 0), ws.get('en', 0), ws.get('hit_rate', 0), ws.get('critical_rate', 0)
    rn, rx = ws.get('range_min', 0), ws.get('range_max', 0)
    csi = ws.get('override_correction_id', '0')
    tsi = ws.get('trait_correction_id', '0')
    gi = ws.get('growth_pattern_id', '0')
    gd = {}
    ug = gi and gi != '0' and gi != '1'
    if ug: gd = gpm.get(gi, {})
    corr = DEFAULT_CORRECTION
    if csi and csi != '0':
        corr = wcm.get(csi, DEFAULT_CORRECTION)
    elif ug:
        gsi = gd.get('status_change_set_id', '0')
        if gsi and gsi != '0': corr = wcm.get(gsi, DEFAULT_CORRECTION)
    fp = math.floor(bp * corr.get('power_rate', 100) / 100)
    fe = math.floor(be * corr.get('en_rate', 100) / 100)
    fa = math.floor(bh * corr.get('hit_rate', 100) / 100)
    fc = math.floor(bc * corr.get('crit_rate', 100) / 100)
    ma = corr.get('map_ammo', 0)
    tl = []
    if tsi and tsi != '0':
        for tid in tcl5m.get(tsi, []):
            d2 = wtdm.get(tid, '')
            if d2 and d2 not in tl: tl.append(d2)
        if not tl:
            for k in [tsi, tsi[:-2] if len(tsi) > 2 else None, tsi[:-4] if len(tsi) > 4 else None]:
                if k and wtm.get(k): tl = wtm[k]; break
    if not tl and ug:
        gti = gd.get('trait_change_set_id', '0')
        if gti and gti != '0':
            for tid in tcl5m.get(gti, []):
                d2 = wtdm.get(tid, '')
                if d2 and d2 not in tl: tl.append(d2)
            if not tl: tl = wtm.get(gti, [])
    if not tl:
        fids = []
        if wid and wid != '0': fids.extend([wid, wid[:-2] if len(wid) > 2 else None, wid[:-4] if len(wid) > 4 else None])
        if mwid and mwid != '0': fids.extend([mwid, mwid[:-2] if len(mwid) > 2 else None])
        for k in fids:
            if k and wtm.get(k): tl = wtm[k]; break
    rest = []
    if wt == '3': rest.append(get_ui_label(lang_code, 'restriction_before_moving'))
    if tt == '4': rest.append(get_ui_label(lang_code, 'restriction_tension_max'))
    if wid in MP_CONSUMPTION_WEAPON_IDS: rest.append(get_ui_label(lang_code, 'restriction_mp'))
    hp_rate = wm.get('hp_cost_rate', 0)
    if hp_rate <= 0 and unit_id in HP_CONSUMPTION_UNIT_EX and wt == '2':
        hp_rate = HP_CONSUMPTION_UNIT_EX[unit_id]
    if hp_rate > 0:
        rest.append(get_ui_label(lang_code, 'restriction_hp').format(hp_rate))
    if csid != '0':
        ct = wcam.get(csid, "None")
        if ct and ct != "None": rest.append(ct)
    return {'range_min': rn, 'range_max': rx, 'power': fp, 'en': fe, 'accuracy': fa, 'critical': fc, 'ammo': ma, 'traits': tl, 'usage_restrictions': rest}

# ═══════════════════════════════════════════════════════
# ABILITY BUILDER
# ═══════════════════════════════════════════════════════

def build_ability_entry(ab_id, abil_name_map, abil_link_map, trait_set_traits_map, trait_data_map, lang_text_map, en_lang_text_map, trait_condition_raw_map, lineage_lookup, series_name_map, ability_resource_map, abil_desc_map, sort_order=0, lang_code='EN'):
    trait_set_id = abil_link_map.get(ab_id, ab_id)
    lookup_id = trait_set_id[:-2] if len(trait_set_id) > 2 else trait_set_id
    ab_name = abil_name_map.get(trait_set_id, abil_name_map.get(lookup_id, abil_name_map.get(ab_id, "Unknown")))
    trait_ids = trait_set_traits_map.get(trait_set_id, [])
    if not trait_ids:
        trait_ids = trait_set_traits_map.get(lookup_id, [])
    trait_info = []
    for tid in trait_ids:
        t_data = trait_data_map.get(tid, {})
        desc_lang_id = t_data.get('desc_lang_id', '0')
        display_text = lang_text_map.get(desc_lang_id, '').strip()
        en_text = en_lang_text_map.get(desc_lang_id, '').strip()
        if not display_text and en_text:
            display_text = en_text
        if display_text == ab_name.strip():
            display_text = ""
        if en_text == ab_name.strip():
            en_text = ""
        active_cid = t_data.get('active_cond_id', '0')
        target_cid = t_data.get('target_cond_id', '0')
        trait_conds = []
        for cid in [active_cid, target_cid]:
            for c in resolve_condition_tags(cid, trait_condition_raw_map, lineage_lookup, series_name_map, lang_code):
                if c not in trait_conds:
                    trait_conds.append(c)
        trait_info.append({'display_text': display_text, 'en_text': en_text, 'conditions': trait_conds})
    details = []
    for i, info in enumerate(trait_info):
        display_text = info['display_text']
        en_text = info['en_text']
        conds = list(info['conditions'])
        if display_text:
            en_text_lower = en_text.lower() if en_text else ''
            cond_matches = re.findall(r'\[condition\s*(\d+)\]', en_text_lower)
            if cond_matches:
                max_cond_num = max(int(mv) for mv in cond_matches)
                needed = max_cond_num - len(conds)
                lai = i + 1
                while needed > 0 and lai < len(trait_info):
                    for c in trait_info[lai]['conditions']:
                        if c not in conds:
                            conds.append(c)
                            needed -= 1
                        if needed <= 0: break
                    lai += 1
            existing = None
            for d2 in details:
                if d2['text'] == display_text:
                    existing = d2
                    break
            if existing:
                for c in conds:
                    if c not in existing['conditions']:
                        existing['conditions'].append(c)
            else:
                details.append({'text': display_text, 'conditions': conds})
        else:
            if details:
                for c in conds:
                    if c not in details[-1]['conditions']:
                        details[-1]['conditions'].append(c)
    if not details:
        old_descs = abil_desc_map.get(lookup_id, abil_desc_map.get(trait_set_id, []))
        for entry in old_descs:
            t_val = entry['text'].strip()
            if t_val == ab_name.strip(): continue
            details.append({'text': t_val, 'conditions': []})
    res_id = ability_resource_map.get(ab_id, '')
    icon_file = find_trait_icon(res_id)
    has_icon = bool(icon_file)
    ex_flag = is_ex_ability(ab_name)
    return {
        'id': ab_id, 'name': ab_name, 'sort': sort_order, 'details': details,
        'icon': f"/static/images/Trait/{icon_file}" if icon_file else '',
        'has_icon': has_icon, 'is_ex': ex_flag,
        'frame_overlay': ABILITY_FRAME_OVERLAY if (has_icon and ex_flag) else '',
        'resource_id': res_id,
    }

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
skill_trait_base = load_json(os.path.join(BASE_DIR, "m_character_skill_trait.json"))

trait_set_traits_map = create_trait_set_to_traits_map(trait_set_data)
trait_data_map = create_trait_data_map(trait_logic_data)
trait_condition_raw_map = create_trait_condition_raw_map(trait_cond_data_r)
char_info_map = create_char_info_map(char_master)
char_stat_map = create_char_status_map(char_status)
char_lin_map = create_char_lineage_link_map(char_lineage_data)
unit_info_map = create_unit_info_map(unit_master_data)
unit_stat_map = create_unit_status_map(unit_status_data)
unit_lin_map = create_unit_lineage_link_map(unit_lineage_data)
unit_ter_map = create_terrain_map(unit_terrain_data)
unit_abil_map = create_unit_ability_map(unit_abil_data)
unit_weapon_map = create_unit_weapon_map(unit_weapon_data)
weapon_info_map = create_weapon_master_map(weapon_master)
weapon_status_map = create_weapon_status_map(weapon_status_data)
weapon_correction_map = create_weapon_correction_map(weapon_correction_data)
growth_pattern_map = create_growth_pattern_map(weapon_growth_data)
trait_change_level5_map = create_trait_change_level5_map(weapon_trait_change_data)

ability_resource_map = {}
for item in extract_data_list(ability_master):
    if isinstance(item, dict):
        ai = normalize_id(item.get('Id') or item.get('id') or item.get('AbilityId'))
        ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
        if ai != '0' and ri != '0': ability_resource_map[ai] = ri

abil_link_map = {}
for item in extract_data_list(ability_master):
    if isinstance(item, dict):
        ai = normalize_id(item.get('Id') or item.get('id'))
        ti = normalize_id(item.get('TraitSetId') or item.get('traitSetId'))
        if ai != '0' and ti != '0': abil_link_map[ai] = ti

unit_ser_map = {}
for item in extract_data_list(unit_master_data):
    if isinstance(item, dict):
        uid = normalize_id(item.get('id') or item.get('Id'))
        sid = normalize_id(item.get('SeriesSetId') or item.get('seriesSetId'))
        if uid != '0' and sid != '0': unit_ser_map[uid] = sid

series_id_to_icon = {}
for item in extract_data_list(series_set_data):
    if isinstance(item, dict):
        series_id = normalize_id(item.get('SeriesId') or item.get('seriesId'))
        if series_id != '0':
            icon = find_series_icon(series_id)
            if icon: series_id_to_icon[series_id] = icon
print(f"Series icons mapped: {len(series_id_to_icon)}")

miss, found = 0, 0
for uid, ui in unit_info_map.items():
    if ui.get('role', '0') == '0': continue
    p = find_portrait(ui.get('resource_ids', []), uid, 'images/unit_portraits')
    if p: found += 1
    else: miss += 1
print(f"Unit portraits: {found} found, {miss} missing")

# ═══════════════════════════════════════════════════════
# LOAD LANGUAGE-SPECIFIC DATA
# ═══════════════════════════════════════════════════════

LANG_DATA = {}
for lang_code, paths in LANG_PATHS.items():
    print(f"Loading {lang_code}...")
    lang_dir = paths['lang']
    lang_base_dir = paths['base']
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
                    for rk in ['ResourceId', 'resourceId', 'CutInResourceId', 'cutInResourceId']:
                        rv = str(item.get(rk) or '').strip()
                        if rv and rv != '0' and rv not in rids: rids.append(rv)
                    char_info_map[cid] = {
                        'rarity': normalize_id(item.get('RarityTypeIndex'), '1'),
                        'role': normalize_id(item.get('RoleTypeIndex'), '0'),
                        'acquisition_route': normalize_id(item.get('CharacterAcquisitionRouteTypeIndex'), '0'),
                        'resource_ids': rids,
                    }
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
                    for rk in ['ResourceId', 'resourceId', 'CutInResourceId', 'cutInResourceId']:
                        rv = str(item.get(rk) or '').strip()
                        if rv and rv != '0' and rv not in rids: rids.append(rv)
                    unit_info_map[uid] = {
                        'rarity': normalize_id(item.get('RarityTypeIndex'), '1'),
                        'role': normalize_id(item.get('RoleTypeIndex'), '0'),
                        'model': str(item.get('ModelNumber') or ''),
                        'series_set': normalize_id(item.get('SeriesSetId') or item.get('seriesSetId')),
                        'terrain_set': normalize_id(item.get('TerrainCapabilitySetId') or item.get('terrainCapabilitySetId')),
                        'is_ultimate': is_ult,
                        'acquisition_route': normalize_id(item.get('UnitAcquisitionRouteTypeIndex'), '0'),
                        'bromide_resource_id': bid,
                        'resource_ids': rids,
                    }
                    added += 1
            if added: print(f"  +{added} units from {lang_code}")

    series_text = load_json(os.path.join(lang_dir, "m_series.json"))
    lineage_text = load_json(os.path.join(lang_dir, "m_lineage.json"))
    trait_name_data = load_json(os.path.join(lang_dir, "m_trait_set_detail.json"))
    trait_desc_data = load_json(os.path.join(lang_dir, "m_trait.json"))
    char_text = load_json(os.path.join(lang_dir, "m_character.json"))
    skill_text_data = load_json(os.path.join(lang_dir, "m_character_skill_trait.json"))
    unit_text_data = load_json(os.path.join(lang_dir, "m_unit.json"))
    weapon_text_data = load_json(os.path.join(lang_dir, "m_weapon.json"))

    anm, adm = create_ability_maps(extract_data_list(trait_name_data), extract_data_list(trait_desc_data))
    ll = create_lineage_list(lineage_text)
    llk = create_lineage_lookup(lineage_text)
    snm = create_series_name_map(series_text)
    ltm = create_lang_text_map(trait_desc_data)
    cim, ctm = create_name_lang_maps(char_master, char_text)
    csm, ssm, sl = create_series_maps(char_master, series_set_data, series_text)
    stm = create_skill_text_map(extract_data_list(skill_text_data))
    uim, utm = create_name_lang_maps(unit_master_data, unit_text_data)
    wtm2 = create_weapon_text_map(weapon_text_data)
    wtrm = create_weapon_trait_map(BASE_DIR, lang_dir)
    wcam = create_weapon_capability_map(BASE_DIR, lang_dir)
    wtdm = create_weapon_trait_detail_map(weapon_trait_base_data, lang_dir)

    srm = {}
    for item in extract_data_list(trait_set_data):
        if isinstance(item, dict):
            si = normalize_id(item.get('Id') or item.get('id') or item.get('TraitSetId'))
            ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
            if si != '0' and ri != '0': srm[si] = ri
    for item in extract_data_list(char_skill):
        if isinstance(item, dict):
            si = normalize_id(item.get('CharacterSkillId') or item.get('SkillId') or item.get('Id'))
            ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
            if si != '0' and ri != '0': srm[si] = ri
    if skill_trait_base:
        for item in extract_data_list(skill_trait_base):
            if isinstance(item, dict):
                si = normalize_id(item.get('CharacterSkillId') or item.get('SkillId') or item.get('Id'))
                ri = normalize_id(item.get('ResourceId') or item.get('resourceId'))
                if si != '0' and ri != '0':
                    srm[si] = ri
                    if len(si) > 2 and si[:-2] not in srm:
                        srm[si[:-2]] = ri

    LANG_DATA[lang_code] = {
        'abil_name_map': anm, 'abil_desc_map': adm,
        'lineage_list': ll, 'lineage_lookup': llk,
        'series_name_map': snm, 'lang_text_map': ltm,
        'char_id_map': cim, 'char_text_map': ctm,
        'char_ser_map': csm, 'ser_set_map': ssm, 'series_list': sl,
        'skill_text_map': stm, 'skill_resource_map': srm,
        'unit_id_map': uim, 'unit_text_map': utm,
        'weapon_text_map': wtm2, 'weapon_trait_map': wtrm,
        'weapon_capability_map': wcam, 'weapon_trait_detail_map': wtdm,
    }
    print(f"  {lang_code}: {len(ctm)} chars, {len(utm)} units")

print("Database ready!")
print("=" * 60)

# ═══════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════

def get_lang_data(lc):
    return LANG_DATA.get(lc, LANG_DATA.get(DEFAULT_LANG, {}))

def get_calc_lang_data():
    return LANG_DATA.get(CALC_LANG, {})

def resolve_series(ser_set_id, lc):
    ld = get_lang_data(lc)
    ssm = ld.get('ser_set_map', {})
    sl = ld.get('series_list', [])
    sd = []
    if ser_set_id and ser_set_id != '0':
        for sid in ssm.get(ser_set_id, []):
            name = None
            for lid, val in sl:
                if lid.endswith(sid):
                    name = val
                    break
            if name:
                icon = series_id_to_icon.get(sid, '') or find_series_icon(sid)
                sd.append({'id': sid, 'name': name, 'icon': icon})
    return sd

def resolve_tags(lin_map, eid, lc):
    ld = get_lang_data(lc)
    llk = ld.get('lineage_lookup', {})
    ll = ld.get('lineage_list', [])
    tags = []
    for lid in lin_map.get(eid, []):
        name = llk.get(lid)
        if name:
            if name not in tags: tags.append(name)
        else:
            for fid, val in ll:
                if fid.endswith(lid) and len(lid) >= 4:
                    if val not in tags: tags.append(val)
                    break
    return sorted(tags)

def validate_lang_code(lc):
    lc = (lc or DEFAULT_LANG).upper()
    if lc not in LANG_DATA: lc = DEFAULT_LANG
    return lc

def sort_rows(rows, sort_by, sort_dir, valid_sorts, default_sort='rarity'):
    if sort_by not in valid_sorts: sort_by = default_sort
    if sort_by == 'rarity':
        if sort_dir == 'asc':
            rows.sort(key=lambda r: (-r['rarity_sort'], r['name'].lower()))
        else:
            rows.sort(key=lambda r: (r['rarity_sort'], r['name'].lower()))
    elif sort_by == 'name':
        if sort_dir == 'asc':
            rows.sort(key=lambda r: (r['rarity_sort'], r['name'].lower()))
        else:
            rows.sort(key=lambda r: (r['rarity_sort'], r['name'].lower()))
            rows.sort(key=lambda r: r['name'].lower(), reverse=True)
            rows.sort(key=lambda r: r['rarity_sort'])
    elif sort_by == 'role':
        if sort_dir == 'desc':
            rows.sort(key=lambda r: (r['rarity_sort'], r.get('role_sort', 3), r['name'].lower()))
        else:
            rows.sort(key=lambda r: (r['rarity_sort'], -r.get('role_sort', 3), r['name'].lower()))
    else:
        if sort_dir == 'desc':
            rows.sort(key=lambda r: (r['rarity_sort'], -r.get(sort_by, 0), r['name'].lower()))
        else:
            rows.sort(key=lambda r: (r['rarity_sort'], r.get(sort_by, 0), r['name'].lower()))
    return rows

# ═══════════════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html', image_cdn=IMAGE_CDN)

@app.route('/api/languages')
def get_languages():
    return jsonify(convert_image_urls({
        'languages': list(LANG_DATA.keys()),
        'default': DEFAULT_LANG,
    }))

@app.route('/api/characters')
def list_characters():
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
    page = max(1, int(request.args.get('page', 1)))
    pp = min(100, max(10, int(request.args.get('per_page', 50))))
    sb = request.args.get('sort', 'rarity')
    sd = request.args.get('dir', 'desc')
    sq = request.args.get('q', '').strip().lower()
    ck = f"cl_{lc}_{page}_{pp}_{sb}_{sd}_{sq}"
    cached = get_cached_response(ck)
    if cached: return jsonify(cached)
    ld = get_lang_data(lc)
    ldc = get_calc_lang_data()
    rows = []
    for cid, info in char_info_map.items():
        ri = info.get('rarity', '1')
        role_id = info.get('role', '0')
        if role_id == '0': continue
        lid = ld['char_id_map'].get(cid, '')
        name = ld['char_text_map'].get(lid, '') if lid else ''
        if not name: continue
        if sq and sq not in name.lower() and sq not in cid: continue
        raw = char_stat_map.get(cid, {})
        grown = {s: calc_growth_char(*raw.get(s, (0, 0)), ri) for s in CHAR_STAT_ORDER}
        
        # Calculate ability bonuses for list display
        fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == cid]
        sp = {s: 0 for s in CHAR_STAT_ORDER}
        
        # Try EN calc first
        for ab_raw in fa:
            ab_entry = build_ability_entry(
                normalize_id(ab_raw.get('AbilityId', '')), ldc['abil_name_map'], abil_link_map,
                trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'],
                trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'],
                ability_resource_map, ldc['abil_desc_map'],
                sort_order=0, lang_code=CALC_LANG
            )
            for d2 in ab_entry.get('details', []):
                for s, p in extract_stat_percent_char(d2['text']).items():
                    sp[s] = sp.get(s, 0) + p
        
        # Fallback to display language if EN found nothing
        if all(v == 0 for v in sp.values()) and lc != CALC_LANG:
            for ab_raw in fa:
                ab_entry = build_ability_entry(
                    normalize_id(ab_raw.get('AbilityId', '')), ld['abil_name_map'], abil_link_map,
                    trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'],
                    trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'],
                    ability_resource_map, ld['abil_desc_map'],
                    sort_order=0, lang_code=lc
                )
                for d2 in ab_entry.get('details', []):
                    for s, p in extract_stat_percent_char(d2['text']).items():
                        sp[s] = sp.get(s, 0) + p
        
        final = {}
        for s in CHAR_STAT_ORDER:
            b = grown.get(s, 0)
            bn = math.floor(b * sp[s] / 100) if b > 0 and sp[s] > 0 else 0
            final[s] = b + bn

        thum = find_portrait(info.get('resource_ids', []), cid, 'images/portraits')
        rows.append({
            'id': cid, 'name': name,
            'role': ROLE_MAP.get(role_id, 'NPC'), 'role_id': role_id,
            'role_sort': ROLE_SORT.get(role_id, 3), 'role_icon': ROLE_ICON_MAP.get(role_id, ''),
            'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_id': ri,
            'rarity_sort': RARITY_SORT.get(ri, 4), 'rarity_icon': RARITY_ICON_MAP.get(ri, ''),
            'thum': thum or '',
            'Ranged': final.get('Ranged', 0), 'Melee': final.get('Melee', 0),
            'Awaken': final.get('Awaken', 0), 'Defense': final.get('Defense', 0),
            'Reaction': final.get('Reaction', 0),
        })
    rows = sort_rows(rows, sb, sd, {'name', 'role', 'rarity', 'Ranged', 'Melee', 'Awaken', 'Defense', 'Reaction'})
    total = len(rows)
    tp = max(1, math.ceil(total / pp))
    page = min(page, tp)
    start = (page - 1) * pp
    pr = rows[start:start + pp]
    result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd}
    set_cached_response(ck, result)
    return jsonify(convert_image_urls(result))

@app.route('/api/units')
def list_units():
    lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
    page = max(1, int(request.args.get('page', 1)))
    pp = min(100, max(10, int(request.args.get('per_page', 50))))
    sb = request.args.get('sort', 'rarity')
    sd = request.args.get('dir', 'desc')
    sq = request.args.get('q', '').strip().lower()
    ck = f"ul_{lc}_{page}_{pp}_{sb}_{sd}_{sq}"
    cached = get_cached_response(ck)
    if cached: return jsonify(cached)
    ld = get_lang_data(lc)
    ldc = get_calc_lang_data()
    rows = []
    for uid, info in unit_info_map.items():
        ri = info.get('rarity', '1')
        role_id = info.get('role', '0')
        if role_id == '0': continue
        lid = ld['unit_id_map'].get(uid, '')
        name = ld['unit_text_map'].get(lid, '') if lid else ''
        if not name: continue
        if sq and sq not in name.lower() and sq not in uid: continue
        raw = unit_stat_map.get(uid, {})
        fs = {}
        if raw:
            for s in ['HP', 'EN', 'Attack', 'Defense', 'Mobility']:
                fs[s] = calc_growth_unit(*raw.get(s, (0, 0)), ri)
            fs['Move'] = raw.get('Move', 0)
        
        # Calculate ability bonuses for list display
        ua = unit_abil_map.get(uid, [])
        sb2 = {s: 0 for s in UNIT_STAT_ORDER}
        
        # Try EN calc first
        for ab in ua:
            ab_entry = build_ability_entry(
                str(ab['id']), ldc['abil_name_map'], abil_link_map,
                trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'],
                trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'],
                ability_resource_map, ldc['abil_desc_map'],
                sort_order=0, lang_code=CALC_LANG
            )
            for d2 in ab_entry.get('details', []):
                for s, a in extract_stat_bonus_unit(d2['text'], fs).items():
                    sb2[s] = sb2.get(s, 0) + a
                    
        # Fallback to display language if EN found nothing
        if all(v == 0 for v in sb2.values()) and lc != CALC_LANG:
            for ab in ua:
                ab_entry = build_ability_entry(
                    str(ab['id']), ld['abil_name_map'], abil_link_map,
                    trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'],
                    trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'],
                    ability_resource_map, ld['abil_desc_map'],
                    sort_order=0, lang_code=lc
                )
                for d2 in ab_entry.get('details', []):
                    for s, a in extract_stat_bonus_unit(d2['text'], fs).items():
                        sb2[s] = sb2.get(s, 0) + a

        acq = info.get('acquisition_route', '0')
        ai = ACQUISITION_ROUTE_ICONS.get(acq, '')
        si = []
        if info.get('is_ultimate', False): si.append(ULT_ICON)
        if ai: si.append(ai)
        portrait = find_portrait(info.get('resource_ids', []), uid, 'images/unit_portraits')
        rows.append({
            'id': uid, 'name': name,
            'role': ROLE_MAP.get(role_id, 'NPC'), 'role_id': role_id,
            'role_sort': ROLE_SORT.get(role_id, 3), 'role_icon': ROLE_ICON_MAP.get(role_id, ''),
            'rarity': RARITY_MAP.get(ri, 'N'), 'rarity_id': ri,
            'rarity_sort': RARITY_SORT.get(ri, 4), 'rarity_icon': RARITY_ICON_MAP.get(ri, ''),
            'special_icons': si, 'thum': portrait or '',
            'ATK': fs.get('Attack', 0) + sb2.get('Attack', 0), 
            'DEF': fs.get('Defense', 0) + sb2.get('Defense', 0),
            'MOB': fs.get('Mobility', 0) + sb2.get('Mobility', 0), 
            'HP': fs.get('HP', 0) + sb2.get('HP', 0),
            'EN': fs.get('EN', 0) + sb2.get('EN', 0), 
            'MOV': fs.get('Move', 0),
        })
    rows = sort_rows(rows, sb, sd, {'name', 'role', 'rarity', 'ATK', 'DEF', 'MOB', 'HP', 'EN', 'MOV'})
    total = len(rows)
    tp = max(1, math.ceil(total / pp))
    page = min(page, tp)
    start = (page - 1) * pp
    pr = rows[start:start + pp]
    result = {'rows': pr, 'total': total, 'page': page, 'per_page': pp, 'total_pages': tp, 'sort': sb, 'dir': sd}
    set_cached_response(ck, result)
    return jsonify(convert_image_urls(result))

@app.route('/api/character/<char_id>')
def get_character(char_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        ck = f"c_{char_id}_{lc}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc)
        ldc = get_calc_lang_data()
        char_id = normalize_id(char_id)
        info = char_info_map.get(char_id)
        if not info: return jsonify({'error': f'Character {char_id} not found'}), 404
        ri = info.get('rarity', '1')
        lid = ld['char_id_map'].get(char_id, "")
        cn = ld['char_text_map'].get(lid, "Unknown") if lid else "Unknown"
        raw = char_stat_map.get(char_id, {})
        grown = {s: calc_growth_char(*raw.get(s, (0, 0)), ri) for s in CHAR_STAT_ORDER}
        fa = [x for x in extract_data_list(char_abil) if normalize_id(x.get('CharacterId', '')) == char_id]
        abilities = [
            build_ability_entry(
                normalize_id(ab.get('AbilityId', '')), ld['abil_name_map'], abil_link_map,
                trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'],
                trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'],
                ability_resource_map, ld['abil_desc_map'],
                sort_order=int(ab.get('SortOrder', 0)), lang_code=lc
            ) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))
        ]
        # Stat calculation: try EN first, fallback to display language
        ac_en = [
            build_ability_entry(
                normalize_id(ab.get('AbilityId', '')), ldc['abil_name_map'], abil_link_map,
                trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'],
                trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'],
                ability_resource_map, ldc['abil_desc_map'],
                sort_order=int(ab.get('SortOrder', 0)), lang_code=CALC_LANG
            ) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))
        ]
        sp = {s: 0 for s in CHAR_STAT_ORDER}
        for ab in ac_en:
            for d2 in ab.get('details', []):
                for s, p in extract_stat_percent_char(d2['text']).items():
                    sp[s] = sp.get(s, 0) + p
        # If EN calc found nothing, try with display language
        if all(v == 0 for v in sp.values()) and lc != CALC_LANG:
            for ab in abilities:
                for d2 in ab.get('details', []):
                    for s, p in extract_stat_percent_char(d2['text']).items():
                        sp[s] = sp.get(s, 0) + p
        stats = []
        for s in CHAR_STAT_ORDER:
            b = grown.get(s, 0)
            bn = math.floor(b * sp[s] / 100) if b > 0 and sp[s] > 0 else 0
            stats.append({'name': s, 'total': b + bn, 'bonus': bn})
        portrait = find_portrait(info.get('resource_ids', []), char_id, 'images/portraits')
        fs2 = [x for x in extract_data_list(char_skill) if normalize_id(x.get('CharacterId', '')) == char_id]
        skills = []
        for sk in sorted(fs2, key=lambda x: int(x.get('SortOrder', 0))):
            si = normalize_id(sk.get('CharacterSkillId', '') or sk.get('SkillId', ''))
            bi = si[:-2] if len(si) > 2 else si
            entries = []
            for k in [bi, si, si[-9:] if len(si) >= 9 else None, bi[-7:] if len(bi) >= 7 else None, bi[-6:] if len(bi) >= 6 else None]:
                if k and k in ld['skill_text_map']:
                    entries = ld['skill_text_map'][k]
                    break
            name = entries[0]["text"] if entries else "Unknown"
            details = [x["text"] for x in entries[1:]] if len(entries) > 1 else []
            rid2 = ld['skill_resource_map'].get(si, '') or ld['skill_resource_map'].get(bi, '')
            ic = find_trait_icon(rid2)
            skills.append({
                'id': si, 'name': name, 'sort': sk.get('SortOrder', 0),
                'details': details,
                'icon': f"/static/images/Trait/{ic}" if ic else '',
                'has_icon': bool(ic), 'is_ex': False, 'frame_overlay': '',
                'resource_id': rid2,
            })
        result = {
            'id': char_id, 'name': cn,
            'rarity': RARITY_MAP.get(ri, "Unknown"), 'rarity_id': ri,
            'rarity_icon': RARITY_ICON_MAP.get(ri, ''),
            'role': ROLE_MAP.get(info.get('role', '0'), "Unknown"),
            'role_id': info.get('role', '0'),
            'role_icon': ROLE_ICON_MAP.get(info.get('role', '0'), ''),
            'stats': stats,
            'tags': resolve_tags(char_lin_map, char_id, lc),
            'series': resolve_series(ld['char_ser_map'].get(char_id, ''), lc),
            'abilities': abilities, 'skills': skills,
            'portrait': portrait, 'lang': lc,
        }
        set_cached_response(ck, result)
        return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/unit/<unit_id>')
def get_unit(unit_id):
    try:
        lc = validate_lang_code(request.args.get('lang', DEFAULT_LANG))
        ck = f"u_{unit_id}_{lc}"
        cached = get_cached_response(ck)
        if cached: return jsonify(cached)
        ld = get_lang_data(lc)
        ldc = get_calc_lang_data()
        unit_id = normalize_id(unit_id)
        info = unit_info_map.get(unit_id)
        if not info: return jsonify({'error': f'Unit {unit_id} not found'}), 404
        ri = info.get('rarity', '1')
        lid = ld['unit_id_map'].get(unit_id, "")
        un = ld['unit_text_map'].get(lid, "Unknown") if lid else "Unknown"
        raw = unit_stat_map.get(unit_id, {})
        fs = {}
        if raw:
            for s in ['HP', 'EN', 'Attack', 'Defense', 'Mobility']:
                fs[s] = calc_growth_unit(*raw.get(s, (0, 0)), ri)
            fs['Move'] = raw.get('Move', 0)
        ua = unit_abil_map.get(unit_id, [])
        abilities = [
            build_ability_entry(
                str(ab['id']), ld['abil_name_map'], abil_link_map,
                trait_set_traits_map, trait_data_map, ld['lang_text_map'], ldc['lang_text_map'],
                trait_condition_raw_map, ld['lineage_lookup'], ld['series_name_map'],
                ability_resource_map, ld['abil_desc_map'],
                sort_order=ab['sort'], lang_code=lc
            ) for ab in sorted(ua, key=lambda x: x['sort'])
        ]
        # Stat calculation: try EN first, fallback to display language
        ac_en = [
            build_ability_entry(
                str(ab['id']), ldc['abil_name_map'], abil_link_map,
                trait_set_traits_map, trait_data_map, ldc['lang_text_map'], ldc['lang_text_map'],
                trait_condition_raw_map, ldc['lineage_lookup'], ldc['series_name_map'],
                ability_resource_map, ldc['abil_desc_map'],
                sort_order=ab['sort'], lang_code=CALC_LANG
            ) for ab in sorted(ua, key=lambda x: x['sort'])
        ]
        sb2 = {s: 0 for s in UNIT_STAT_ORDER}
        for ab in ac_en:
            for d2 in ab.get('details', []):
                for s, a in extract_stat_bonus_unit(d2['text'], fs).items():
                    sb2[s] = sb2.get(s, 0) + a
        # If EN calc found nothing, try with display language
        if all(v == 0 for v in sb2.values()) and lc != CALC_LANG:
            for ab in abilities:
                for d2 in ab.get('details', []):
                    for s, a in extract_stat_bonus_unit(d2['text'], fs).items():
                        sb2[s] = sb2.get(s, 0) + a
        stats = [{'name': s, 'total': fs.get(s, 0) + sb2.get(s, 0), 'bonus': sb2.get(s, 0)} for s in UNIT_STAT_ORDER]
        portrait = find_portrait(info.get('resource_ids', []), unit_id, 'images/unit_portraits', f'unit_{unit_id}')
        ubr = info.get('bromide_resource_id', '') or (info.get('resource_ids', [''])[0] if info.get('resource_ids') else '')
        td = unit_ter_map.get(info.get('terrain_set', ''), {})
        terrain = []
        for tn in ['Space', 'Atmospheric', 'Ground', 'Sea', 'Underwater']:
            lv = td.get(tn, 0)
            terrain.append({
                'name': tn, 'symbol': TERRAIN_SYMBOLS.get(str(lv), '-'), 'level': lv,
                'type_icon': f"/static/images/Terrain/{TERRAIN_TYPE_ICON_MAP.get(tn, '')}" if TERRAIN_TYPE_ICON_MAP.get(tn) else '',
                'level_icon': f"/static/images/Terrain/{TERRAIN_LEVEL_ICON_MAP.get(lv, TERRAIN_LEVEL_ICON_MAP[0])}",
            })
        weapons = []
        for wp in unit_weapon_map.get(unit_id, []):
            wid = wp['id']
            wm = weapon_info_map.get(wid, {})
            wn = ld['weapon_text_map'].get(wm.get('name_lang_id', '0'), 'Unknown')
            ai = wm.get('attribute', '0')
            wt = wm.get('weapon_type', '1')
            ainfo = WEAPON_ATTR_MAP.get(ai, {'label': 'Unknown', 'icon': ''})
            at = ATTACK_ATTR_TYPES.get(wm.get('attack_attribute', '0'), [])
            ws = resolve_weapon_stats(
                wm, weapon_status_map, weapon_correction_map,
                ld['weapon_trait_map'], ld['weapon_capability_map'],
                growth_pattern_map, trait_change_level5_map,
                ld['weapon_trait_detail_map'], wid, lang_code=lc, unit_id=unit_id
            )
            ic = resolve_weapon_icon(wt, ai, ubr)
            weapons.append({
                'id': wid, 'name': wn, 'attribute': ainfo['label'], 'attribute_id': ai,
                'weapon_type': wt, 'attack_types': at, 'power': ws['power'],
                'min_range': ws['range_min'], 'max_range': ws['range_max'],
                'en_cost': ws['en'], 'accuracy': ws['accuracy'], 'critical': ws['critical'],
                'ammo': ws['ammo'] if wt == '3' else 0,
                'traits': ws['traits'], 'usage_restrictions': ws['usage_restrictions'],
                'sort': wp['sort'], 'icon': ic['icon'], 'overlay': ic['overlay'],
                'is_ex': ic['is_ex'], 'is_map': ic['is_map'],
            })
        weapons.sort(key=lambda w: (0 if w['weapon_type'] == '3' else 1, w['sort']))
        sicons = []
        if info.get('is_ultimate', False): sicons.append(ULT_ICON)
        acq = info.get('acquisition_route', '0')
        ai2 = ACQUISITION_ROUTE_ICONS.get(acq, '')
        if ai2: sicons.append(ai2)
        result = {
            'id': unit_id, 'name': un,
            'rarity': RARITY_MAP.get(ri, "Unknown"), 'rarity_id': ri,
            'rarity_icon': RARITY_ICON_MAP.get(ri, ''),
            'role': ROLE_MAP.get(info.get('role', '0'), "Unknown"),
            'role_id': info.get('role', '0'),
            'role_icon': ROLE_ICON_MAP.get(info.get('role', '0'), ''),
            'model': info.get('model', ''), 'stats': stats, 'terrain': terrain,
            'tags': resolve_tags(unit_lin_map, unit_id, lc),
            'series': resolve_series(unit_ser_map.get(unit_id, ''), lc),
            'abilities': abilities, 'weapons': weapons,
            'portrait': portrait, 'lang': lc,
            'is_ultimate': info.get('is_ultimate', False),
            'acquisition_route': acq, 'special_icons': sicons,
        }
        set_cached_response(ck, result)
        return jsonify(convert_image_urls(result))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    for d in [
        "static/images/portraits", "static/images/unit_portraits",
        "static/images/Trait", "static/images/Trait/thum",
        "static/images/Terrain", "static/images/WeaponIcon",
        "static/images/UI", "static/images/Logo-Series",
        "static/images/Background", "static/images/Rarity",
    ]:
        os.makedirs(d, exist_ok=True)
    app.run(debug=True, port=5000)