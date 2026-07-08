"""
Meta Synergistic Rankings — max-damage unit × pilot pairs mirroring the Damage Simulator
(calculateDamage in static/js/app.js): CP on, max Supercharged EX tier, paired traits,
active skills, super vigor, NPC DEF tiers.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import math
import os
import re
import threading
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor, as_completed
from functools import lru_cache

_VIGOR = {
    'medium': {'dmg_bonus_pct': 0, 'crit_mult_pct': 10},
    'high': {'dmg_bonus_pct': 10, 'crit_mult_pct': 20},
    'max': {'dmg_bonus_pct': 20, 'crit_mult_pct': 20},
    'super': {'dmg_bonus_pct': 30, 'crit_mult_pct': 30},
}

_CRIT125_TRIM_MIN = 356500
_CRIT125_TRIM_DIV = 1181
_DEF_DEBUFF_CAP = 40
# Match Damage Simulator: DC_QUB_PLUS_ONE=false in static/js/app.js (disabled pending re-audit).
_MSY_QUB_PLUS_ONE = os.environ.get('MSY_QUB_PLUS_ONE', '').strip().lower() in ('1', 'true', 'yes')

_DMG_DEALT_RE = re.compile(
    r'[Ii]ncrease\s+(?:own\s+)?damage\s+dealt(?:\s+to\s+(?:the\s+)?enem(?:y|ies))?\s+(?:with\s+.+?\s+)?by\s+(\d+)%|'
    r'(\d+)\s*%\s*(?:more|additional).{0,12}damage|'
    r'与(?:え|与)(?:る|与)?.{0,8}?(\d+)\s*[%％].{0,8}?ダメージ|'
    r'造成.{0,8}?(\d+)\s*[%％].{0,8}?傷害',
    re.I,
)
_CRIT_DMG_RE = re.compile(
    r'critical damage.{0,16}(\d+)\s*%|'
    r'(\d+)\s*%\s*critical damage|'
    r'クリティカルダメージ.{0,8}?(\d+)\s*[%％]|'
    r'暴擊傷害.{0,8}?(\d+)\s*[%％]|'
    r'[Ii]ncrease\s+(?:own\s+)?(?:MS\s+)?(?:ATK|Attack)\s+and\s+[Cc]ritical\s+[Dd]amage\s+by\s+(\d+)%',
    re.I,
)
_GUARANTEED_CRIT_RE = re.compile(
    r'guaranteed\s+critical|grant\s+guaranteed\s+critical|activate\s+guaranteed\s+critical|'
    r'確定クリティカル|確定.*クリティカル',
    re.I,
)
_SKILL_DMG_RE = re.compile(
    r'[Ii]ncrease(?:s)?\s+(?:own\s+)?damage\s+dealt(?:\s+to\s+(?:the\s+)?enem(?:y|ies))?\s+(?:with\s+.+?\s+)?by\s*(\d+)%|'
    r'對敵方造成的損傷提升(\d+)%',
    re.I,
)
_SKILL_ATK_RE = re.compile(
    r'[Ii]ncreases?\s+(?:own\s+)?(?:Ranged|Melee|Awaken)\s+(?:and\s+(?:Ranged|Melee|Awaken)\s+)?by\s*(\d+)%|'
    r'自身(射擊值|格鬥值|覺醒值).{0,12}提升(\d+)%',
    re.I,
)
_SKILL_CRIT_RE = re.compile(
    r'[Ii]ncreases?\s+(?:own\s+)?critical rate by\s*(\d+)\s*%|'
    r'自身(?:的)?(?:暴擊|暴击|爆擊)率提升(\d+)%|'
    r'クリティカル(?:発生)?率.{0,8}?(\d+)\s*[%％]',
    re.I,
)

_POW_LV_MAX_PCT = (5, 7, 10, 12, 15, 17, 20, 22, 25)

_WEAPON_TRAIT_PATTERNS = (
    ('dist_en', re.compile(
        r'(?:the\s+)?(?:closer|farther|further)\s+(?:you\s+are(?:\s+(?:to|from)\s+the\s+enemy)?|the\s+enemy\s+is).*?'
        r'(?:greater|more)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)', re.I)),
    ('dist_zh', re.compile(r'距離敵方越(?:近|遠)，武裝POWER越為提升（最高提升(\d+)%）')),
    ('dist_ja', re.compile(r'敵から(?:近い|遠い)ほど武装POWERが上昇[（(]最大(\d+)%上昇[）)]')),
    ('hp_en', re.compile(
        r'(?:the\s+)?(?:lower|higher)\s+(?:(?:this\s+unit\'?s|your|own)\s+)?remaining\s+HP.*?(?:more|greater)\s+'
        r'weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)', re.I)),
    ('hp_zh', re.compile(r'自身剩餘HP越(?:高|低)，武裝POWER越為提升（最高提升(\d+)%）')),
    ('hp_ja', re.compile(r'自身の残HPが(?:多い|少ない)ほど武装POWERが上昇（最大(\d+)%上昇）')),
    ('hp_lv_en', re.compile(r'(?:With\s+More|With\s+Less)\s+Remaining\s+HP,?\s*Higher\s+Weapon\s+Power\s*LV\s*(\d+)', re.I)),
    ('hp_lv_en2', re.compile(r'Scaling\s+Weapon\s+Power\s+\((?:More|Less)\s+Remaining\s+HP\)\s*LV\s*(\d+)', re.I)),
    ('hp_lv_zh', re.compile(r'剩餘HP越(?:高|低)武裝POWER提升\s*LV\s*(\d+)', re.I)),
    ('hp_lv_ja', re.compile(r'残HP(?:多い|少ない)ほど武装POWER上昇\s*LV\s*(\d+)', re.I)),
    ('mp_en', re.compile(
        r'the\s+higher\s+(?:your|own)\s+MP\s+is,?\s*the\s+(?:greater|more)\s+weapon\s+power\s+increases?\s*\('
        r'\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)(?:\s+at\s+the\s+start\s+of\s+battle)?\.?', re.I)),
    ('mp_zh', re.compile(r'(?:戰鬥開始時，)?自身MP越高，武裝POWER越為提升（最高提升(\d+)%）')),
    ('mp_ja', re.compile(r'(?:戦闘開始時、)?自身のMPが多いほど武装POWERが上昇（最大(\d+)%上昇）')),
    ('mp_lv_en', re.compile(r'Scaling\s+Weapon\s+Power\s+\(High\s+(?:Max\s+)?MP\)(?:\s*LV\s*(\d+))?', re.I)),
    ('mp_lv_zh', re.compile(r'MP越高武裝POWER提升\s*LV\s*(\d+)', re.I)),
    ('mp_lv_ja', re.compile(r'MP(?:高い|多い)ほど武装POWER上昇\s*LV\s*(\d+)', re.I)),
    ('dist_lv_en', re.compile(r'Increased\s+(?:Close|Long)\s+Range\s+Weapon\s+Power\s*LV\s*(\d+)', re.I)),
    ('dist_lv_zh', re.compile(r'(?:近距離|遠距離)時武裝POWER提升\s*LV\s*(\d+)', re.I)),
    ('dist_lv_ja', re.compile(r'(?:近距離|遠距離)時武装POWER上昇\s*LV\s*(\d+)', re.I)),
    ('core_en', re.compile(
        r'Custom\s+Core\s+(?:Effect\s+)?(?:Maximum|Max(?:imum)?)\s+Up\s*(?:\(\s*(\d+)\s*%\s*\)|(\d+)\s*%)', re.I)),
    ('core_ja', re.compile(r'Custom\s+Core(?:效果)?.*?最大(?:値)?上昇.*?(\d+)\s*[%％]')),
)

_ATTACK_ATTR_TO_KEYS = {
    '1': ('Ranged',),
    '2': ('Melee',),
    '3': ('Awaken',),
    '4': ('Ranged', 'Melee'),
    '5': ('Ranged', 'Awaken'),
    '6': ('Melee', 'Awaken'),
    '7': ('Ranged', 'Melee', 'Awaken'),
}


def _app():
    import app as A
    return A


def _ldc(lc):
    return _app().get_lang_data(lc)


def _calc_lang_data():
    return _app().get_calc_lang_data()


def _unit_stat_mode(ri, *, wid=None, wm=None):
    """Unit stat column: SSP when ranked weapon is SSP; else ssp/sp/normal by rarity."""
    ri = str(ri or '1')
    if wid and _weapon_is_ssp_weapon(wid, wm):
        return 'ssp'
    if ri == '5':
        return 'ssp'
    if ri == '4':
        return 'sp'
    return 'normal'


def _weapon_is_ssp_weapon(wid, wm=None):
    """Custom Core SSP weapons (ids ending in 80/90) — matches API is_ssp_weapon."""
    del wm
    wid = _app().normalize_id(wid)
    return wid.endswith('90') or wid.endswith('80')


def _sim_def_after_debuff(total_def, bonus_def, pct):
    u = int(total_def or 0)
    bon = max(0, int(bonus_def or 0))
    base = max(0, u - bon)
    p = max(0, min(100, int(pct or 0)))
    if p <= 0 or u <= 0:
        return u
    reduc = (base * p) // 100 if base > 0 else 0
    return max(0, u - reduc)


def _sim_combat_weapon_power(nominal, def_debuff_pct):
    n = int(nominal) or 0
    p = int(def_debuff_pct) or 0
    if not _MSY_QUB_PLUS_ONE or p <= 35:
        return n
    return n + 1


def _calc_damage_core(unit_atk, char_atk, defender_char_def, unit_def_after, weapon_power, *,
                      def_debuff_pct=0, terrain_pct=0, extra_dmg_pct=0):
    F, C, MX, EXP = math.floor, math.ceil, max, math.exp
    wp = _sim_combat_weapon_power(weapon_power, def_debuff_pct)
    terrain_correction = 1 - terrain_pct / 100
    character_stat_ratio = MX(0, char_atk - defender_char_def) / 5000
    unit_stat_ratio = MX(0, C(unit_atk / 10 - unit_def_after / 10)) / 5000
    char_sigmoid = 1 / (EXP(250 * (defender_char_def - char_atk) / 100000) + 1)
    unit_sigmoid = 1 / (EXP(25 * (unit_def_after - unit_atk) / 100000) + 1)
    base_damage = C((character_stat_ratio + unit_stat_ratio + char_sigmoid + unit_sigmoid) * wp)
    atk_combined = C((unit_atk + 2 * char_atk) / 10)
    def_combined = C((unit_def_after + 2 * defender_char_def) / 10)
    off_exp = ((5000 - atk_combined) * 30) / 100000
    def_exp = ((5000 - def_combined) * 3) / 100000
    offense_component = 100 / (EXP(off_exp) + 1)
    defense_component = -40 / (EXP(def_exp) + 1)
    damage_correction = (offense_component + defense_component) * base_damage
    battle_damage = C((base_damage + damage_correction) * terrain_correction)
    scaled_normal = C(extra_dmg_pct * battle_damage / 100)
    normal_dmg = MX(0, C(battle_damage + scaled_normal))
    return int(normal_dmg), int(battle_damage), int(wp)


def _calc_crit_damage(battle_damage, combat_wp, *, extra_dmg_pct=0, crit_dmg_up_pct=0,
                      vigor='super', dmg_taken_up_pct=0, dmg_taken_down_pct=0):
    F, C, MX = math.floor, math.ceil, max
    vp = _VIGOR.get(vigor) or _VIGOR['super']
    vigor_dmg = vp['dmg_bonus_pct']
    vigor_crit = vp['crit_mult_pct']
    total_crit_mult = 100 + extra_dmg_pct + vigor_dmg + crit_dmg_up_pct + dmg_taken_up_pct - dmg_taken_down_pct
    scaled_crit = C(total_crit_mult * battle_damage / 100)
    crit125_trim = 0
    if total_crit_mult == 125 and battle_damage >= _CRIT125_TRIM_MIN and combat_wp > 0:
        crit125_trim = F(MX(0, battle_damage - combat_wp) / _CRIT125_TRIM_DIV)
    combined_crit = MX(0, battle_damage + scaled_crit - crit125_trim)
    super_crit = MX(0, C(combined_crit * (vigor_crit + 100) / 100 - 1e-9))
    plain_crit = MX(0, C(combined_crit - 1e-9))
    return int(plain_crit), int(super_crit)


def _stage_npc_max_defs(stage_id):
    """Highest NPC unit/character DEF on a stage (via stage detail API)."""
    A = _app()
    try:
        client = A.app.test_client()
        r = client.get(f'/api/stage/{stage_id}?lang=EN')
        if r.status_code != 200:
            return None, None
        payload = r.get_json() or {}
    except Exception:
        return None, None
    max_u = max_c = 0
    for n in payload.get('npc_details') or []:
        u = n.get('unit') or {}
        c = n.get('character') or {}
        if u:
            ud = u.get('defense') or (u.get('stats_raw') or {}).get('Defense')
            if ud:
                max_u = max(max_u, int(ud))
        if c:
            cd = c.get('defense') or (c.get('stats_raw') or {}).get('Defense')
            if cd:
                max_c = max(max_c, int(cd))
    return (max_u or None), (max_c or None)


def _psycho_gundam_stage_defs(stage_id):
    """Eternal Expert reference: Psycho Gundam unit DEF + paired pilot DEF."""
    A = _app()
    try:
        client = A.app.test_client()
        r = client.get(f'/api/stage/{stage_id}?lang=EN')
        if r.status_code != 200:
            return None, None
        payload = r.get_json() or {}
    except Exception:
        return None, None
    for n in payload.get('npc_details') or []:
        u = n.get('unit') or {}
        if 'psycho' not in str(u.get('name', '')).lower():
            continue
        c = n.get('character') or {}
        ud = u.get('defense') or (u.get('stats_raw') or {}).get('Defense')
        cd = c.get('defense') or (c.get('stats_raw') or {}).get('Defense')
        return (int(ud) if ud else None), (int(cd) if cd else None)
    return _stage_npc_max_defs(stage_id)


@lru_cache(maxsize=1)
def _defender_tiers():
    """Game-accurate DEF presets: Hard 3, Challenge Hard 3, Eternal Expert, Avg NPC."""
    A = _app()
    uall, call = [], []
    for item in A.extract_data_list(A.map_npc_unit_data):
        d = int(item.get('Defense', 0) or 0)
        if d > 0:
            uall.append(d)
    for item in A.extract_data_list(A.map_npc_character_data):
        d = int(item.get('Defense', 0) or 0)
        if d > 0:
            call.append(d)
    avg_u = int(sum(uall) / len(uall)) if uall else 4997
    avg_c = int(sum(call) / len(call)) if call else 298
    ch_u, ch_c = _stage_npc_max_defs('101701')
    et_u, et_c = _psycho_gundam_stage_defs('90520001')
    return {
        1: {'unit_def': 3819, 'char_def': 193, 'label': 'Story Hard'},
        2: {'unit_def': ch_u or 7051, 'char_def': ch_c or 509, 'label': 'Challenge Hard'},
        3: {'unit_def': et_u or 25072, 'char_def': et_c or 705, 'label': 'Eternal Expert'},
        4: {'unit_def': avg_u, 'char_def': avg_c, 'label': 'Avg NPC'},
    }


def _resolve_defender_stats(def_tier, *, def_unit_override=None, def_char_override=None):
    tiers = _defender_tiers()
    if def_unit_override is not None and def_char_override is not None:
        try:
            u = int(def_unit_override)
            c = int(def_char_override)
            if u > 0 and c > 0:
                return u, c, 'Custom'
        except (TypeError, ValueError):
            pass
    tier_key = max(1, min(4, int(def_tier or 1)))
    row = tiers.get(tier_key) or tiers[1]
    return int(row['unit_def']), int(row['char_def']), row['label']


def defender_tiers_public():
    tiers = _defender_tiers()
    return {
        str(k): {'unit_def': v['unit_def'], 'char_def': v['char_def'], 'label': v['label']}
        for k, v in tiers.items()
    }


def _resolve_unit_name(uid, lc):
    A = _app()
    ld = _ldc(lc)
    lid = ld.get('unit_id_map', {}).get(A.normalize_id(uid), '')
    name = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
    return name or f'Unknown ({uid})'


def _resolve_char_name(cid, lc):
    A = _app()
    ld = _ldc(lc)
    lid = ld.get('char_id_map', {}).get(A.normalize_id(cid), '')
    name = ld.get('char_text_map', {}).get(lid, '') if lid else ''
    return name or f'Unknown ({cid})'


def _grown_totals_for_formula(cid):
    """Base grown stats dict for formula-stat display (preview cards)."""
    grown, grown_sp, _, _ = _char_grown_bases(cid)
    A = _app()
    src = grown_sp if _msy_char_stat_mode(cid) == 'sp' else grown
    return {s: float(src.get(s, 0) or 0) for s in A.CHAR_STAT_ORDER}


def _pilot_formula_stat(totals, attack_attr, skill_atk_pct=0):
    """Return (char_atk, stat_label) used in the damage formula for this weapon attr."""
    keys = _ATTACK_ATTR_TO_KEYS.get(str(attack_attr or '1'), ('Ranged',))
    best_val = 0.0
    best_key = keys[0] if keys else 'Ranged'
    for k in keys:
        v = float(totals.get(k, 0) or 0)
        if skill_atk_pct and v > 0:
            v += math.floor(v * skill_atk_pct / 100)
        if v > best_val:
            best_val = v
            best_key = k
    return int(best_val), best_key


def _pilot_atk_for_weapon(totals, attack_attr, skill_atk_pct=0):
    val, _ = _pilot_formula_stat(totals, attack_attr, skill_atk_pct)
    return float(val)


_AWAKEN_FLOOR900_LT_RE = re.compile(r'Awaken\s+of\s+less\s+than\s+900|覺醒值未滿\s*900|覚醒値が\s*900\s*未満', re.I)
_AWAKEN_FLOOR900_TO_RE = re.compile(r'Awaken\s+to\s+900|提升至\s*900|900.*?(?:上昇|向上|する)', re.I)


def _unit_ability_text_is_awaken_floor900(txt):
    s = str(txt or '').replace('\r\n', '\n').replace('\n', ' ')
    return bool(_AWAKEN_FLOOR900_LT_RE.search(s) and _AWAKEN_FLOOR900_TO_RE.search(s))


@lru_cache(maxsize=4096)
def _unit_grants_pilot_awaken_floor900(uid, lc, stat_mode='normal'):
    """Mirror app.js _dcUnitGrantsPilotAwakenFloor900 (e.g. Ex-S ALICE LV 2)."""
    A = _app()
    uid = A.normalize_id(uid)
    ld = _ldc(lc)
    sm = str(stat_mode or 'normal').strip().lower()
    for bab in A._unit_ability_entries_for_weapon_range(uid, ld, lc, sm):
        aid = A.normalize_id(bab.get('id') or '')
        if aid == '1015102':
            return True
        for d2 in bab.get('details') or []:
            txt = str((d2 or {}).get('text') or d2 or '') if isinstance(d2, dict) else str(d2 or '')
            if _unit_ability_text_is_awaken_floor900(txt):
                return True
    return False


def _parse_skill_desc_atk_pct(blob, sid='', name=''):
    """Mirror app.js _dcParseSkillDescAtkPct for active-skill stat %."""
    out = {'Ranged': 0, 'Melee': 0, 'Awaken': 0}
    s = '\n'.join(x for x in (str(blob or ''), str(name or ''), str(sid or '')) if x)
    if not s.strip():
        return out
    pair_re = re.compile(
        r'Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s+and\s+(Ranged|Melee|Awaken)\s+by\s*(\d+)%',
        re.I,
    )
    for m in pair_re.finditer(s):
        p = int(m.group(3) or 0)
        out[m.group(1)] += p
        out[m.group(2)] += p
    m_tri = re.search(
        r'Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s*,\s*(Ranged|Melee|Awaken)\s+and\s+'
        r'(Ranged|Melee|Awaken)\s+by\s*(\d+)%',
        s, re.I,
    )
    if m_tri:
        p = int(m_tri.group(4) or 0)
        out[m_tri.group(1)] += p
        out[m_tri.group(2)] += p
        out[m_tri.group(3)] += p
    m_tri_ox = re.search(
        r'Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s*,\s*(Ranged|Melee|Awaken)\s*,\s*and\s+'
        r'(Ranged|Melee|Awaken)\s+by\s*(\d+)%',
        s, re.I,
    )
    if m_tri_ox:
        p = int(m_tri_ox.group(4) or 0)
        out[m_tri_ox.group(1)] += p
        out[m_tri_ox.group(2)] += p
        out[m_tri_ox.group(3)] += p
    for m in re.finditer(r'Increases?\s+(?:own\s+)?(Ranged|Melee|Awaken)\s+by\s*(\d+)%', s, re.I):
        out[m.group(1)] += int(m.group(2) or 0)
    m_atk = re.search(r'Increases?\s+(?:own\s+)?(?:ATK|Attack)\s+by\s*(\d+)%', s, re.I)
    if m_atk:
        p = int(m_atk.group(1) or 0)
        out['Ranged'] += p
        out['Melee'] += p
        out['Awaken'] += p
    zh_map = {'射擊值': 'Ranged', '格鬥值': 'Melee', '覺醒值': 'Awaken'}
    m_zh = re.search(r'自身(射擊值|格鬥值|覺醒值)((?:及(?:射擊值|格鬥值|覺醒值))*)提升(\d+)%', s)
    if m_zh:
        p = int(m_zh.group(3) or 0)
        k0 = zh_map.get(m_zh.group(1))
        if k0:
            out[k0] += p
        for zm in re.finditer(r'及(射擊值|格鬥值|覺醒值)', m_zh.group(2) or ''):
            kk = zh_map.get(zm.group(1))
            if kk:
                out[kk] += p
    else:
        for pat, key in (
            (r'自身射擊值提升(\d+)%', 'Ranged'),
            (r'自身格鬥值提升(\d+)%', 'Melee'),
            (r'自身[覚覺]醒值提升(\d+)%', 'Awaken'),
        ):
            m = re.search(pat, s)
            if m:
                out[key] += int(m.group(1) or 0)
    ja_map = {'射撃値': 'Ranged', '格闘値': 'Melee', '覚醒値': 'Awaken'}
    for m in re.finditer(r'自身の(射撃値|格闘値|覚醒値)が(\d+)(?:%|％)上昇', s):
        kk = ja_map.get(m.group(1))
        if kk:
            out[kk] += int(m.group(2) or 0)
    if out['Awaken'] == 0:
        for pat in (
            r'覚醒ブースト\s*LV\.?\s*(\d+)',
            r'Awaken\s+Boost\s*LV\.?\s*(\d+)',
            r'覺醒值增幅\s*LV\.?\s*(\d+)',
        ):
            m = re.search(pat, s, re.I)
            if m:
                lv = int(m.group(1) or 0)
                if 1 <= lv <= 5:
                    out['Awaken'] = lv * 5
                    break
        if out['Awaken'] == 0 and sid:
            id_m = re.match(r'^200170([1-5])01$', str(sid))
            if id_m:
                out['Awaken'] = int(id_m.group(1)) * 5
    return out


@lru_cache(maxsize=8192)
def _msy_char_stat_mode(cid):
    """Max-damage MSY uses SP stats/skills for SP-capable pilots (rarity ≤ SSR)."""
    info = _app().char_info_map.get(_app().normalize_id(cid)) or {}
    return 'sp' if int(str(info.get('rarity', '1'))) <= 4 else 'normal'


def _msy_skill_blob(resolved):
    return '\n'.join(
        str(x.get('text') if isinstance(x, dict) else x or '')
        for x in (resolved.get('details') or [])
    ) + '\n' + str(resolved.get('desc') or '')


@lru_cache(maxsize=8192)
def _msy_char_skill_rows(cid, lc):
    """Character skill rows — same shape as /api/character skills (incl. SP replacements)."""
    A = _app()
    ld = _ldc(lc)
    cid = A.normalize_id(cid)
    rows = []
    seen_ids = set()
    ms = 0
    spa = []
    fs = [x for x in A.extract_data_list(A.char_skill) if A.normalize_id(x.get('CharacterId', '')) == cid]
    for sk in sorted(fs, key=lambda x: int(x.get('SortOrder', 0))):
        sid = A.normalize_id(sk.get('CharacterSkillId') or sk.get('SkillId') or '')
        spsi = A.normalize_id(sk.get('SpCharacterSkillId') or sk.get('spCharacterSkillId'))
        sv = int(sk.get('SortOrder', 0))
        ms = max(ms, sv)
        if sid and sid != '0':
            resolved = A.resolve_char_skill(sid, ld, sv, False)
            if spsi and spsi not in ('0', 'None', sid):
                resolved['replaced_by_sp_id'] = spsi
            rows.append({'id': sid, 'resolved': resolved, 'sort': sv})
            seen_ids.add(sid)
        if spsi and spsi not in ('0', 'None', sid):
            spa.append(spsi)
    for spsi in spa:
        if spsi in seen_ids:
            continue
        ms += 1
        rows.append({
            'id': spsi,
            'resolved': A.resolve_char_skill(spsi, ld, ms, True),
            'sort': ms,
            'is_sp_only': True,
        })
        seen_ids.add(spsi)
    sp_names = {
        str(r['resolved'].get('name') or '').strip().lower()
        for r in rows if r['resolved'].get('is_sp')
    }
    for r in rows:
        res = r['resolved']
        if res.get('is_sp'):
            continue
        if res.get('replaced_by_sp_id'):
            res['replaced_by_sp'] = True
        elif str(res.get('name') or '').strip().lower() in sp_names:
            res['replaced_by_sp'] = True
    return tuple(rows)


def _msy_pilot_skills_visible(stat_mode, rows):
    """Mirror app.js _dcPilotSkillsVisibleForDc."""
    sp_on = stat_mode == 'sp'
    replaced = {
        str(r['resolved'].get('replaced_by_sp_id'))
        for r in rows
        if r['resolved'].get('replaced_by_sp_id')
    }
    out = []
    for r in rows:
        res = r['resolved']
        if res.get('is_sp'):
            if not sp_on:
                continue
            if str(r['id']) in replaced:
                continue
        out.append(r)
    return out


def _msy_resolve_skill_for_mode(row, rows, stat_mode):
    """Mirror app.js _dcResolveSkillForDcMode."""
    res = row['resolved']
    if stat_mode != 'sp':
        return res
    rid = res.get('replaced_by_sp_id')
    if not rid:
        return res
    rid = str(rid)
    for r in rows:
        if str(r['id']) == rid:
            return r['resolved']
    return res


def _msy_skill_base_name(name):
    return re.sub(r'\s*LV\s*\d+\s*$', '', str(name or ''), flags=re.I).strip().lower()


def _msy_skill_lv_from_name(name):
    lv_m = re.search(r'\bLV\s*(\d+)\b', str(name or ''), re.I)
    return int(lv_m.group(1)) if lv_m else 0


@lru_cache(maxsize=8192)
def _active_skill_stat_pct(cid, lc):
    """Sum Ranged/Melee/Awaken % from auto-enabled active skills only."""
    stat_mode = _msy_char_stat_mode(cid)
    rows = _msy_char_skill_rows(cid, lc)
    active_ids = _msy_auto_active_skill_ids(cid, lc)
    out = {'Ranged': 0, 'Melee': 0, 'Awaken': 0}
    for row in _msy_pilot_skills_visible(stat_mode, rows):
        sid = row['id']
        if sid not in active_ids:
            continue
        rsk = _msy_resolve_skill_for_mode(row, rows, stat_mode)
        name = str(rsk.get('name') or '')
        blob = _msy_skill_blob(rsk)
        add = _parse_skill_desc_atk_pct(blob, sid, name)
        for k in out:
            out[k] += add[k]
    return out


def _pilot_active_skill_pct_bonus(base, pct):
    p = max(0, int(pct or 0))
    b = max(0, int(base or 0))
    if b <= 0 or p <= 0:
        return 0
    return math.floor(b * p / 100)


def _pilot_skill_adjusted_stat(grown, totals, stat_name, pct):
    """Mirror app.js _dcPilotSkillAdjustedStat: passive total + floor(base × skill%)."""
    p = max(0, int(pct or 0))
    passive_total = int(round(float(totals.get(stat_name, 0) or 0)))
    if p <= 0:
        return passive_total
    base = max(0, int(grown.get(stat_name, 0) or 0))
    return passive_total + _pilot_active_skill_pct_bonus(base, p)


def _pilot_awaken_adjusted(grown, totals, uid, lc, stat_mode, pct):
    """Mirror app.js _dcPilotAwakenAdjustedForDc."""
    passive_total = int(round(float(totals.get('Awaken', 0) or 0)))
    if not _unit_grants_pilot_awaken_floor900(uid, lc, stat_mode):
        return _pilot_skill_adjusted_stat(grown, totals, 'Awaken', pct)
    if passive_total >= 900:
        return _pilot_skill_adjusted_stat(grown, totals, 'Awaken', pct)
    base = max(0, int(grown.get('Awaken', 0) or 0))
    p = max(0, int(pct or 0))
    return 900 + (_pilot_active_skill_pct_bonus(base, p) if p > 0 else 0)


def _char_atk_with_skills_for_pair(cid, uid, lc, attack_attr, *, cp_on=True):
    """Char ATK for damage formula — pair CP totals + active skill % + unit awaken floor."""
    totals, _ = _cached_char_pair_totals(cid, uid, lc, cp_on=cp_on)
    grown, grown_sp, _, _ = _char_grown_bases(cid)
    base_grown = grown_sp if _msy_char_stat_mode(cid) == 'sp' else grown
    sk = _active_skill_stat_pct(cid, lc)
    info = _app().unit_info_map.get(_app().normalize_id(uid)) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    keys = _ATTACK_ATTR_TO_KEYS.get(str(attack_attr or '1'), ('Ranged',))
    best_val = 0
    best_key = keys[0] if keys else 'Ranged'
    for k in keys:
        if k == 'Awaken':
            v = _pilot_awaken_adjusted(base_grown, totals, uid, lc, stat_mode, sk.get('Awaken', 0))
        else:
            v = _pilot_skill_adjusted_stat(base_grown, totals, k, sk.get(k, 0))
        if v > best_val:
            best_val = v
            best_key = k
    return int(best_val), best_key


def _formula_char_atk_for_pair(cid, uid, lc, attack_attr, *, cp_on=True):
    """Char ATK used in the damage formula (pair CP totals — matches calculateDamage charAtk)."""
    return _char_atk_with_skills_for_pair(cid, uid, lc, attack_attr, cp_on=cp_on)


def _build_char_ac_calc(cid, lc):
    A = _app()
    ldc = _calc_lang_data()
    cid = A.normalize_id(cid)
    fa = [x for x in A.extract_data_list(A.char_abil) if A.normalize_id(x.get('CharacterId', '')) == cid]

    def build_ab(ab):
        bid = A.normalize_id(ab.get('AbilityId', ''))
        spid = A.normalize_id(ab.get('SpAbilityId') or ab.get('spAbilityId'))
        bab = A.build_ability_entry(
            bid, ldc['abil_name_map'], A.abil_link_map, A.trait_set_traits_map, A.trait_data_map,
            ldc['lang_text_map'], ldc['lang_text_map'], A.trait_condition_raw_map, ldc['lineage_lookup'],
            ldc['series_name_map'], A.ability_resource_map, ldc['abil_desc_map'],
            sort_order=int(ab.get('SortOrder', 0)), lang_code=A.CALC_LANG,
        )
        if spid and spid not in ('0', 'None', bid):
            bab['sp_replacement'] = A.build_ability_entry(
                spid, ldc['abil_name_map'], A.abil_link_map, A.trait_set_traits_map, A.trait_data_map,
                ldc['lang_text_map'], ldc['lang_text_map'], A.trait_condition_raw_map, ldc['lineage_lookup'],
                ldc['series_name_map'], A.ability_resource_map, ldc['abil_desc_map'],
                sort_order=int(ab.get('SortOrder', 0)), lang_code=A.CALC_LANG,
            )
        return bab

    return [build_ab(ab) for ab in sorted(fa, key=lambda x: int(x.get('SortOrder', 0)))]


def _pair_ok_for_unit(uid, cid, trait_pair_unit_ids):
    A = _app()
    uid = A.normalize_id(uid)
    cid = A.normalize_id(cid)
    gate_ok, pu, rec = A._character_trait_pair_gate(cid, trait_pair_unit_ids)
    if not gate_ok:
        return False
    if uid not in pu:
        return False
    rec = A.normalize_id(rec or '0')
    if rec != '0' and uid != rec and uid not in (trait_pair_unit_ids or set()):
        return False
    return True


def _char_grown(cid):
    grown, _, ri, _ = _char_grown_bases(cid)
    return grown, ri


def _char_grown_bases(cid):
    """Normal growth, SP growth column, rarity, and whether pilot has SP stats."""
    A = _app()
    cid = A.normalize_id(cid)
    info = A.char_info_map.get(cid) or {}
    ri = str(info.get('rarity', '1'))
    raw = A.char_stat_map.get(cid, {})
    grown = {}
    grown_sp = {}
    for s in A.CHAR_STAT_ORDER:
        st = raw.get(s, (0, 0, 0))
        if isinstance(st, (list, tuple)) and len(st) >= 2:
            grown[s] = A.calc_growth_char(st[0], st[1], ri)
            if len(st) >= 3:
                grown_sp[s] = st[2]
            else:
                grown_sp[s] = st[1]
        else:
            grown[s] = 0
            grown_sp[s] = 0
    has_sp = int(ri) <= 4
    return grown, grown_sp, ri, has_sp


def _char_totals_for_pair_max(cid, uid, lc):
    """CP on: conditional + max trait % + pair-gated traits when unit matches."""
    A = _app()
    ldc = _calc_lang_data()
    cid = A.normalize_id(cid)
    uid = A.normalize_id(uid)
    char_mode = _msy_char_stat_mode(cid)
    grown, grown_sp, _, _ = _char_grown_bases(cid)
    base = grown_sp if char_mode == 'sp' else grown
    ac = _build_char_ac_calc(cid, lc)
    buckets = A._accumulate_character_trait_percent_buckets(ac, cid, ldc)
    spbn_u, spbn_c, spbn_pair, spen, spen_pair = buckets[0], buckets[1], buckets[2], buckets[3], buckets[4]
    spbs_u, spbs_c, spbs_pair, spes, spes_pair = buckets[5], buckets[6], buckets[7], buckets[8], buckets[9]
    trait_pair_unit_ids = buckets[10]
    pair_ok = _pair_ok_for_unit(uid, cid, trait_pair_unit_ids)
    totals = {}
    if char_mode == 'sp':
        for s in A.CHAR_STAT_ORDER:
            bv = base.get(s, 0)
            pct = spbs_u[s] + spbs_c[s] + spes[s]
            if pair_ok:
                pct += spbs_pair[s] + spes_pair[s]
            totals[s] = bv + math.floor(bv * pct / 100) if bv > 0 else 0
    else:
        ex_tiers = A.collect_supercharged_ex_stat_tiers(ac, cid)
        if ex_tiers:
            tier = ex_tiers[-1]
            for s in A.CHAR_STAT_ORDER:
                bv = base.get(s, 0)
                pct = spbn_u[s] + spbn_c[s] + tier['ex_pct'][s]
                if pair_ok:
                    pct += spbn_pair[s] + spen_pair[s]
                totals[s] = bv + math.floor(bv * pct / 100) if bv > 0 else 0
        else:
            for s in A.CHAR_STAT_ORDER:
                bv = base.get(s, 0)
                pct = spbn_u[s] + spbn_c[s] + spen[s]
                if pair_ok:
                    pct += spbn_pair[s] + spen_pair[s]
                totals[s] = bv + math.floor(bv * pct / 100) if bv > 0 else 0
    return totals, pair_ok


def _char_totals_for_pair_no_cp(cid, uid, lc):
    """CP off: growth + unconditional trait % only (matches get_character stats)."""
    A = _app()
    ldc = _calc_lang_data()
    cid = A.normalize_id(cid)
    uid = A.normalize_id(uid)
    char_mode = _msy_char_stat_mode(cid)
    grown, grown_sp, _, _ = _char_grown_bases(cid)
    base = grown_sp if char_mode == 'sp' else grown
    ac = _build_char_ac_calc(cid, lc)
    buckets = A._accumulate_character_trait_percent_buckets(ac, cid, ldc)
    trait_pair_unit_ids = buckets[10]
    pair_ok = _pair_ok_for_unit(uid, cid, trait_pair_unit_ids)
    totals = {}
    if char_mode == 'sp':
        spbs_u = buckets[5]
        for s in A.CHAR_STAT_ORDER:
            bv = base.get(s, 0)
            pct = spbs_u[s]
            totals[s] = bv + math.floor(bv * pct / 100) if bv > 0 else 0
    else:
        spbn_u = buckets[0]
        for s in A.CHAR_STAT_ORDER:
            bv = base.get(s, 0)
            pct = spbn_u[s]
            totals[s] = bv + math.floor(bv * pct / 100) if bv > 0 else 0
    return totals, pair_ok


def _char_guaranteed_crit(cid, lc, *, vigor='super', cp_on=True):
    """Guaranteed crit: passive ability, or Supercharged EX 2 at super vigor (e.g. Shinn)."""
    if not cp_on or str(vigor or 'super') != 'super':
        return False
    A = _app()
    for bab in _build_char_ac_calc(cid, lc):
        if bab.get('is_ex'):
            continue
        for blob_src in (bab, bab.get('sp_replacement') or {}):
            if not blob_src:
                continue
            parts = [str(blob_src.get('name') or '')]
            for d2 in blob_src.get('details') or []:
                parts.append(str((d2 or {}).get('text') or d2 or ''))
            if _GUARANTEED_CRIT_RE.search('\n'.join(parts)):
                return True
    for bab in _build_char_ac_calc(cid, lc):
        if not bab.get('is_ex'):
            continue
        for d2 in bab.get('details') or []:
            txt = str((d2 or {}).get('text') or d2 or '') if isinstance(d2, dict) else str(d2 or '')
            if not txt:
                continue
            for tier, _label, chunk in A._slice_supercharged_ex_tier_sections(txt):
                if tier == 2 and _GUARANTEED_CRIT_RE.search(chunk):
                    return True
    return False


def _ability_blob_lines(bab):
    lines = []
    for d2 in bab.get('details') or []:
        if isinstance(d2, dict):
            lines.append(str(d2.get('text') or ''))
        else:
            lines.append(str(d2 or ''))
    return lines


def _char_role(cid):
    info = _app().char_info_map.get(_app().normalize_id(cid)) or {}
    return str(info.get('role', '0'))


def _unit_role(uid):
    info = _app().unit_info_map.get(_app().normalize_id(uid)) or {}
    return str(info.get('role', '0'))


def _char_is_attack_role(cid):
    return _char_role(cid) == '1'


def _pilot_role_matches_unit(uid, cid):
    """Only pair pilots whose role matches the unit role (Attack↔Attack, etc.)."""
    return _char_role(cid) == _unit_role(uid)


def _same_role_only_from_kwargs(kwargs):
    v = (kwargs or {}).get('same_role_only')
    if isinstance(v, str):
        return v.lower() in ('1', 'true', 'yes')
    return bool(v)


def _msy_unit_tag_ids(uid, lc):
    A = _app()
    return {
        A.normalize_id(t.get('id'))
        for t in A.resolve_tags(A.unit_lin_map, A.normalize_id(uid), lc, 'unit')
        if t.get('id')
    }


def _msy_char_tag_ids(cid, lc):
    A = _app()
    return {
        A.normalize_id(t.get('id'))
        for t in A.resolve_tags(A.char_lin_map, A.normalize_id(cid), lc, 'char')
        if t.get('id')
    }


def _unit_series_set_id(uid, info=None):
    """SeriesSetId for a unit (global map — not per-lang LANG_DATA)."""
    A = _app()
    uid = A.normalize_id(uid)
    info = info or A.unit_info_map.get(uid) or {}
    raw = A.unit_ser_map.get(uid) or info.get('series_set') or ''
    raw = str(raw).strip()
    return raw if raw and raw not in ('0', 'None') else ''


def _msy_unit_series_ids(uid, lc):
    A = _app()
    uid = A.normalize_id(uid)
    out = set()
    for s in A.resolve_series(_unit_series_set_id(uid), lc):
        sid = A.normalize_id(s.get('id'))
        if sid and sid not in ('', '0'):
            out.add(sid)
    return out


def _msy_match_one_condition(cond, uid, cid, lc):
    A = _app()
    if not isinstance(cond, dict):
        return False
    cid = A.normalize_id(cid)
    uid = A.normalize_id(uid)
    c_id = A.normalize_id(cond.get('id'))
    src = str(cond.get('source') or '')
    typ = str(cond.get('type') or '')
    ut = _msy_unit_tag_ids(uid, lc)
    usr = _msy_unit_series_ids(uid, lc)
    ct = _msy_char_tag_ids(cid, lc)
    char_info = A.char_info_map.get(cid) or {}
    char_series = set()
    for s in (char_info.get('series') or []):
        if isinstance(s, dict) and s.get('id'):
            char_series.add(A.normalize_id(s['id']))
    if src == 'unit_ids':
        return uid == c_id
    if src == 'character_ids':
        return cid == c_id
    if src == 'character_series':
        return c_id in char_series
    if src in ('char_tags',) or typ == 'character':
        return c_id in ct
    if src in ('unit_tags', 'group_tags') or typ == 'unit':
        return c_id in ut
    if typ == 'series' or src == 'series':
        if src == 'character_series':
            return c_id in char_series
        return c_id in usr
    if typ == 'unit_role' or src == 'types':
        rid = str(c_id or '').replace('role_', '')
        info = A.unit_info_map.get(uid) or {}
        return str(info.get('role', '0')) == rid
    return False


def _msy_condition_group_matches(uid, cid, lc, grp):
    conds = (grp or {}).get('conditions') or []
    if not conds:
        return True
    tag_conds = [c for c in conds if str((c or {}).get('source') or '') in ('unit_tags', 'group_tags')]
    other = [c for c in conds if c not in tag_conds]
    tag_part = (not tag_conds) or any(_msy_match_one_condition(c, uid, cid, lc) for c in tag_conds)
    other_part = (not other) or all(_msy_match_one_condition(c, uid, cid, lc) for c in other)
    return tag_part and other_part


def _msy_ability_cond_meets(uid, cid, lc, cond_groups):
    if not cond_groups:
        return True
    return all(_msy_condition_group_matches(uid, cid, lc, grp) for grp in cond_groups)


def _pilot_tag_affinity_matches_unit(uid, lc, text, detail=None):
    A = _app()
    if not A._trait_detail_implies_piloting_tag_affinity(text):
        return False
    d = detail if isinstance(detail, dict) else {'text': text}
    names = A._collect_detail_lineage_tag_names(d)
    if names:
        return A._unit_has_any_lineage_tag(uid, lc, names)
    return False


def _pilot_bonus_text_applies(uid, cid, ld, lc, text, detail=None):
    """Whether a pilot ability line's dmg/crit bonus applies to this unit (mirrors DC)."""
    A = _app()
    uid = A.normalize_id(uid)
    txt = str(text or '')
    if not txt:
        return False
    if A._trait_line_is_supercharged_ex_section(txt):
        return True
    if _pilot_tag_affinity_matches_unit(uid, lc, txt, detail):
        return True
    if re.search(r'when piloting character', txt, re.I):
        if re.search(
            r'grant \+\d+% ATK and DEF|grants \+\d+% ATK and DEF|same squad|in your squad',
            txt, re.I,
        ):
            return True
    if not re.search(r'when piloting|搭乘|搭乗', txt, re.I):
        return True
    return A._pilot_text_targets_unit(uid, ld, txt)


def _char_pilot_dmg_bonuses(cid, uid, lc, *, cp_on=True):
    """Pilot passive dmg/crit bonuses for a specific unit×pilot pair (DC rules)."""
    A = _app()
    ld = _ldc(lc)
    uid = A.normalize_id(uid)
    cid = A.normalize_id(cid)
    is_attack = _char_is_attack_role(cid)
    unit_is_attack = _unit_role(uid) == '1'
    dmg_dealt = crit_up = 0
    for bab in _build_char_ac_calc(cid, lc):
        for src in (bab, bab.get('sp_replacement')):
            if not src:
                continue
            for d2 in src.get('details') or []:
                if isinstance(d2, dict):
                    txt = str(d2.get('text') or '')
                    cond_groups = d2.get('condition_groups') or []
                else:
                    txt = str(d2 or '')
                    cond_groups = []
                if not txt:
                    continue
                has_cond = bool(cond_groups) or (
                    not A._trait_line_is_supercharged_ex_section(txt)
                    and bool(re.search(r'when\s+|if\s+|搭乗|時', txt, re.I))
                )
                if has_cond:
                    if not cp_on:
                        continue
                    if cond_groups:
                        if not _msy_ability_cond_meets(uid, cid, lc, cond_groups):
                            continue
                    elif not _pilot_bonus_text_applies(uid, cid, ld, lc, txt, d2 if isinstance(d2, dict) else None):
                        continue
                elif not is_attack:
                    continue
                elif unit_is_attack and is_attack and re.search(
                    r'support attack|counter attack|ally|squad member|teammate|same squad',
                    txt, re.I,
                ) and not re.search(r'when piloting|搭乘|搭乗', txt, re.I):
                    continue
                for m in _DMG_DEALT_RE.finditer(txt):
                    for g in m.groups():
                        if g:
                            dmg_dealt += int(g)
                            break
                for m in _CRIT_DMG_RE.finditer(txt):
                    for g in m.groups():
                        if g:
                            crit_up = max(crit_up, int(g))
    return dmg_dealt, crit_up


def _char_skill_bonuses(cid, lc):
    A = _app()
    ld = _ldc(lc)
    cid = A.normalize_id(cid)
    dmg_by_base = {}
    atk_pct = 0
    fs = [x for x in A.extract_data_list(A.char_skill) if A.normalize_id(x.get('CharacterId', '')) == cid]
    seen = set()
    for sk in sorted(fs, key=lambda x: int(x.get('SortOrder', 0))):
        sid = A.normalize_id(sk.get('CharacterSkillId') or sk.get('SkillId') or '')
        if not sid or sid in seen or sid == '0':
            continue
        seen.add(sid)
        resolved = A.resolve_char_skill(sid, ld, int(sk.get('SortOrder', 0)), False)
        name = str(resolved.get('name') or '')
        base = re.sub(r'\s*LV\s*\d+\s*$', '', name, flags=re.I).strip().lower()
        blob = '\n'.join(
            str(x.get('text') if isinstance(x, dict) else x or '')
            for x in (resolved.get('details') or [])
        ) + '\n' + str(resolved.get('desc') or '')
        sk_dmg = 0
        for m in _SKILL_DMG_RE.finditer(blob):
            g = m.group(m.lastindex)
            if g and str(g).isdigit():
                sk_dmg = max(sk_dmg, int(g))
        if sk_dmg > 0:
            dmg_by_base[base] = max(dmg_by_base.get(base, 0), sk_dmg)
        for m in _SKILL_ATK_RE.finditer(blob):
            g = m.group(m.lastindex)
            if g and str(g).isdigit():
                atk_pct = max(atk_pct, int(g))
    return sum(dmg_by_base.values()), atk_pct


def _char_active_skill_dmg_bonuses(cid, lc):
    """Damage-dealt % from auto-enabled active skills only (matches _dcGetActiveSkillBonuses)."""
    stat_mode = _msy_char_stat_mode(cid)
    rows = _msy_char_skill_rows(cid, lc)
    active_ids = _msy_auto_active_skill_ids(cid, lc)
    dmg_by_base = {}
    for row in _msy_pilot_skills_visible(stat_mode, rows):
        sid = row['id']
        if sid not in active_ids:
            continue
        rsk = _msy_resolve_skill_for_mode(row, rows, stat_mode)
        name = str(rsk.get('name') or '')
        base = _msy_skill_base_name(name)
        blob = _msy_skill_blob(rsk)
        sk_dmg = 0
        for m in _SKILL_DMG_RE.finditer(blob):
            g = m.group(m.lastindex)
            if g and str(g).isdigit():
                sk_dmg = max(sk_dmg, int(g))
        if sk_dmg > 0:
            dmg_by_base[base] = max(dmg_by_base.get(base, 0), sk_dmg)
    return sum(dmg_by_base.values())


def _weapon_pow_lv_to_max_pct(lv):
    try:
        i = int(lv) - 1
    except (TypeError, ValueError):
        return 0
    return _POW_LV_MAX_PCT[i] if 0 <= i < len(_POW_LV_MAX_PCT) else 0


def _parse_weapon_scaling_traits(trait_lines, *, include_ssp=True):
    """Mirror static/js/app.js _dcParseWeaponTraits power-scaling fields."""
    dist_power = hp_power = mp_power = dist_core = 0
    for raw in trait_lines or []:
        txt = str(raw or '').replace('\n', ' ')
        if not txt:
            continue
        matched = False
        for name, pat in _WEAPON_TRAIT_PATTERNS:
            m = pat.search(txt)
            if not m:
                continue
            g = m.group(1) if m.lastindex else None
            if g is None and name == 'mp_lv_en':
                p = 0
            elif g and str(g).isdigit():
                p = _weapon_pow_lv_to_max_pct(g) if 'lv' in name else int(g)
            elif name == 'mp_lv_en':
                p = 0
            else:
                continue
            matched = True
            if name.startswith('dist') and 'core' not in name:
                dist_power = max(dist_power, p)
            elif name.startswith('hp'):
                hp_power = max(hp_power, p)
            elif name.startswith('mp'):
                mp_power = max(mp_power, p)
            elif name.startswith('core'):
                dist_core = max(dist_core, p)
            break
        if matched:
            continue
    return {
        'dist_power_max': dist_power,
        'hp_power_max': hp_power,
        'mp_power_max': mp_power,
        'dist_core_max': dist_core,
    }


def _weapon_trait_lines(ws, wm, uid, ld, lc, stat_mode, level_idx=-1):
    """Collect weapon trait text blobs for a level (DC-style)."""
    A = _app()
    lines = []
    levels = ws.get('levels') or {}
    if isinstance(levels, dict) and levels:
        keys = sorted(int(k) for k in levels.keys() if str(k).isdigit())
        if level_idx >= 0 and keys:
            li = keys[min(max(0, level_idx), len(keys) - 1)]
            lv = levels.get(li) or levels.get(str(li)) or {}
            for tr in (lv.get('traits') or []):
                lines.append(str(tr or ''))
        else:
            for k in keys:
                lv = levels.get(k) or levels.get(str(k)) or {}
                for tr in (lv.get('traits') or []):
                    lines.append(str(tr or ''))
    for tr in (ws.get('traits') or []):
        lines.append(str(tr or ''))
    sm = (stat_mode or 'normal').strip().lower()
    if sm == 'ssp':
        wid = A.normalize_id(wm.get('id'))
        mwid = A.normalize_id(wm.get('main_weapon_id') or '0')
        wtdm = ld.get('weapon_trait_detail_map', {}) or {}
        ccl = '[Custom Core Effect] ' if (lc or 'EN').upper() == 'EN' else '[Custom Core效果] '
        for cid2 in (wid, mwid):
            if not cid2 or cid2 == '0':
                continue
            for tid in A.unit_ssp_weapon_effect_map.get(cid2) or []:
                tt = wtdm.get(tid, '')
                if tt:
                    ft = ccl + tt
                    if ft not in lines:
                        lines.append(ft)
            break
    return lines


def _ssp_power_bonus(wid, wm):
    A = _app()
    bonus = 0
    wid = A.normalize_id(wid)
    mwid = A.normalize_id(wm.get('main_weapon_id') or '0')
    for cid2 in (wid, mwid):
        if not cid2 or cid2 == '0':
            continue
        for enh in A.unit_ssp_weapon_enhance_map.get(cid2) or []:
            if str(enh.get('type')) == '1':
                bonus += int(enh.get('value', 0) or 0)
        break
    return bonus


def _weapon_level_row(ws, level_idx):
    levels = ws.get('levels') or {}
    if isinstance(levels, dict) and levels:
        keys = sorted(int(k) for k in levels.keys() if str(k).isdigit())
        if not keys:
            return {'power': int(ws.get('power', 0) or 0), 'critical': int(ws.get('critical', 0) or 0)}
        li = keys[min(max(0, level_idx), len(keys) - 1)]
        lv = levels.get(li) or levels.get(str(li)) or {}
        return {
            'power': int(lv.get('power', 0) or ws.get('power', 0) or 0),
            'critical': int(lv.get('critical', 0) or ws.get('critical', 0) or 0),
        }
    return {'power': int(ws.get('power', 0) or 0), 'critical': int(ws.get('critical', 0) or 0)}


def _computed_weapon_power_at_level(ws, wm, uid, ld, lc, stat_mode, level_idx):
    """ceil(basePower * (1 + traitPct/100)) + SSP flat — matches DC."""
    lv = _weapon_level_row(ws, level_idx)
    base = int(lv.get('power', 0) or 0)
    traits = _parse_weapon_scaling_traits(
        _weapon_trait_lines(ws, wm, uid, ld, lc, stat_mode, level_idx=level_idx),
    )
    trait_dist = min(100, traits['dist_power_max'] + traits['dist_core_max'])
    trait_scale = traits['hp_power_max'] + traits['mp_power_max']
    scaled = math.ceil(base * (1 + (trait_dist + trait_scale) / 100))
    ssp_flat = _ssp_power_bonus(wm.get('id'), wm) if stat_mode == 'ssp' else 0
    return scaled + ssp_flat


def _best_weapon_level_index(ws, wm, uid, ld, lc, stat_mode):
    levels = ws.get('levels') or {}
    if isinstance(levels, dict) and levels:
        keys = sorted(int(k) for k in levels.keys() if str(k).isdigit())
        if not keys:
            return 0
        best_pow = -1
        best_j = 0
        best_raw = -1
        for j, k in enumerate(keys):
            p = _computed_weapon_power_at_level(ws, wm, uid, ld, lc, stat_mode, j)
            raw = int((levels.get(k) or levels.get(str(k)) or {}).get('power', 0) or 0)
            if p > best_pow or (p == best_pow and (raw > best_raw or (raw == best_raw and j > best_j))):
                best_pow, best_j, best_raw = p, j, raw
        return best_j
    return 0


def _weapon_def_debuff_components(ws, wm, uid, ld, lc, stat_mode, pep_def_dn=0):
    """Return (base_pct, supercharged_only_pct) with optional PEP additive on def_dn."""
    A = _app()
    base_m = vig_m = 0

    def _accum(text):
        nonlocal base_m, vig_m
        b, v = A.parse_enemy_def_debuff_pcts_from_trait_text(str(text or ''))
        if pep_def_dn and b:
            b = min(100, b + pep_def_dn)
        if pep_def_dn and v:
            v = min(100, v + pep_def_dn)
        base_m = max(base_m, b)
        vig_m = max(vig_m, v)

    for tr in (ws.get('traits') or []):
        _accum(tr)
    levels = ws.get('levels') or {}
    level_rows = levels.values() if isinstance(levels, dict) else levels
    for lv in level_rows or []:
        if isinstance(lv, dict):
            for tr in (lv.get('traits') or []):
                _accum(tr)
    for line in _weapon_trait_lines(ws, wm, uid, ld, lc, stat_mode):
        _accum(line)
    return base_m, vig_m


def _effective_def_debuff_pct(ws, wm, uid, ld, lc, stat_mode, vigor, pep_def_dn=0):
    base_m, vig_m = _weapon_def_debuff_components(ws, wm, uid, ld, lc, stat_mode, pep_def_dn)
    use_super = (vigor or 'super') == 'super'
    raw = max(base_m, vig_m if use_super else base_m)
    return min(_DEF_DEBUFF_CAP, max(0, int(raw)))


def _collect_pilot_pep_bonuses(cid, uid, lc):
    """Pilot weapon-effect PEP for this unit×pilot (not recommend UR)."""
    A = _app()
    ld = _ldc(lc)
    uid = A.normalize_id(uid)
    cid = A.normalize_id(cid)
    merged = {}
    for bab in _build_char_ac_calc(cid, lc):
        for src in (bab, bab.get('sp_replacement')):
            if not src:
                continue
            for d2 in src.get('details') or []:
                if isinstance(d2, dict):
                    txt = str(d2.get('text') or '')
                    detail = d2
                else:
                    txt = str(d2 or '')
                    detail = None
                if not txt:
                    continue
                if not re.search(
                    r'when\s+piloting|搭乘|搭乗|weapon effects by|武装効果値が\d+%加算|武裝效果值增加\d+%|武裝效果.*?增加\d+%',
                    txt, re.I,
                ):
                    continue
                if not _pilot_bonus_text_applies(uid, cid, ld, lc, txt, detail):
                    continue
                for k, v in A._parse_pilot_weapon_effect_additive_from_text(txt, uid, ld).items():
                    merged[k] = max(merged.get(k, 0), v)
    return merged


def _parse_pep_squad_line_stats(txt):
    """Parse squad-style ATK bonus lines for pilot-exclusive passives (mirrors app.js _scParseSquadLineStats)."""
    raw = str(txt or '').replace('\r', '')
    t = re.sub(r'\s+', ' ', raw)
    m = re.search(
        r'increase own ATK by (\d+)%[\s\S]*?\(up to (\d+)%\)', t, re.I,
    )
    if m:
        return {'kind': 'dual_stack_atk', 'max': int(m.group(2) or 0)}
    if re.search(r'(?:\[condition\s*1\]|【條件1】|【条件1】)', raw, re.I):
        m = re.search(r'自身の攻撃力が(\d+)%上昇（最大(\d+)%）', raw)
        if m:
            return {'kind': 'dual_stack_atk', 'max': int(m.group(2) or 0)}
        m = re.search(r'自身攻擊力提升(\d+)%（最高(\d+)%）', raw)
        if m:
            return {'kind': 'dual_stack_atk', 'max': int(m.group(2) or 0)}
    m = re.search(r'Increase ATK by (\d+)% \(up to (\d+)%\)', t, re.I)
    if m:
        return {'kind': 'stack_atk', 'max': int(m.group(2) or 0)}
    m = re.search(r'攻撃力が(\d+)%上昇（最大(\d+)%）', raw)
    if m:
        return {'kind': 'stack_atk', 'max': int(m.group(2) or 0)}
    m = re.search(r'自身攻擊力提升(\d+)%（最高(\d+)%）', raw)
    if m:
        return {'kind': 'stack_atk', 'max': int(m.group(2) or 0)}
    m = re.search(r'increases ATK and DEF by (\d+)%', t, re.I)
    if m:
        return {'kind': 'flat_ad', 'flat': int(m.group(1) or 0)}
    m = re.search(r'(?:also\s+)?(?:grant|grants)\s+\+(\d+)%\s+ATK\s+and\s+DEF', t, re.I)
    if m:
        return {'kind': 'flat_ad', 'flat': int(m.group(1) or 0)}
    m = re.search(r'increase ATK by (\d+)%', t, re.I)
    if m and not re.search(r'\(up to \d+%\)', t, re.I):
        return {'kind': 'flat_atk', 'flat': int(m.group(1) or 0)}
    m = re.search(r'攻撃力.*?(\d+)%', raw)
    if m and re.search(r'上昇|提升|アップ', raw) and not re.search(r'最大|最高|up to', raw, re.I):
        return {'kind': 'flat_atk', 'flat': int(m.group(1) or 0)}
    return None


def _pilot_pep_unit_stat_bonus_pct(cid, uid, lc, *, cp_on=True, pair_ok=False):
    """Pilot-exclusive MS ATK % for this unit×pilot (max-damage: stack caps at max)."""
    A = _app()
    uid = A.normalize_id(uid)
    cid = A.normalize_id(cid)
    ld = _ldc(lc)
    atk_pct = 0

    if not (cp_on and pair_ok):
        row = (A.CHAR_PAIR_UNIT_STAT_MOD_PCT.get(cid) or {}).get(uid)
        if row:
            atk_pct += int(row.get('atk_pct') or 0) if isinstance(row, dict) else 0

    for bab in _build_char_ac_calc(cid, lc):
        for src in (bab, bab.get('sp_replacement')):
            if not src:
                continue
            for d2 in src.get('details') or []:
                if isinstance(d2, dict):
                    txt = str(d2.get('text') or '')
                    detail = d2
                else:
                    txt = str(d2 or '')
                    detail = None
                if not txt:
                    continue
                if not re.search(r'when piloting|搭乘|搭乗', txt, re.I):
                    continue
                if not _pilot_bonus_text_applies(uid, cid, ld, lc, txt, detail):
                    continue
                parsed = _parse_pep_squad_line_stats(txt)
                if parsed:
                    kind = parsed.get('kind')
                    if kind in ('stack_atk', 'dual_stack_atk'):
                        atk_pct += int(parsed.get('max') or 0)
                    elif kind in ('flat_atk', 'flat_ad'):
                        atk_pct += int(parsed.get('flat') or 0)
                    continue
                for m in re.finditer(
                    r'(?:increase|increases|提升|上昇).*?(?:own )?(?:MS )?ATK(?:ack)?(?: and DEF)? by (\d+)\s*%',
                    txt, re.I,
                ):
                    atk_pct += int(m.group(1) or 0)
    return max(0, atk_pct)


def _msy_pilot_unit_affinities(cid, uid, lc):
    """Tag-affinity ability lines that match this unit×pilot pair (for MSY UI)."""
    A = _app()
    uid = A.normalize_id(uid)
    cid = A.normalize_id(cid)
    unit_tag_map = {}
    for t in A.resolve_tags(A.unit_lin_map, uid, lc, 'unit'):
        nm = (t.get('name') or '').strip()
        if nm:
            unit_tag_map[nm.lower()] = nm
    if not unit_tag_map:
        return []
    out = []
    seen = set()
    for bab in _build_char_ac_calc(cid, lc):
        ab_name = str(bab.get('name') or '').strip()
        for src in (bab, bab.get('sp_replacement')):
            if not src:
                continue
            for d2 in src.get('details') or []:
                if not isinstance(d2, dict):
                    continue
                txt = str(d2.get('text') or '').strip()
                if not txt or not A._trait_detail_implies_piloting_tag_affinity(txt):
                    continue
                req_names = A._collect_detail_lineage_tag_names(d2)
                matched = []
                for rn in req_names:
                    disp = unit_tag_map.get(str(rn).strip().lower())
                    if disp:
                        matched.append(disp)
                if not matched:
                    continue
                key = (ab_name, tuple(sorted(matched)), txt[:120])
                if key in seen:
                    continue
                seen.add(key)
                out.append({
                    'ability': ab_name,
                    'tags': matched,
                    'detail': txt,
                })
    return out


def _pilot_affinity_weapon_crit(cid, uid, lc):
    """Tag-affinity ACC/Crit bonuses from the ranked pilot (CP on)."""
    A = _app()
    ld = _ldc(lc)
    uid = A.normalize_id(uid)
    cid = A.normalize_id(cid)
    out = 0
    for bab in _build_char_ac_calc(cid, lc):
        for src in (bab, bab.get('sp_replacement')):
            if not src:
                continue
            for d2 in src.get('details') or []:
                if not isinstance(d2, dict):
                    continue
                txt = str(d2.get('text') or '')
                if not A._trait_detail_implies_piloting_tag_affinity(txt):
                    continue
                names = A._collect_detail_lineage_tag_names(d2)
                if names and not A._unit_has_any_lineage_tag(uid, lc, names):
                    continue
                row = A._extract_pilot_weapon_stat_pct_from_text(txt)
                out = max(out, int(row.get('crit') or 0))
    return out


def _char_skill_crit_rate(cid, lc):
    stat_mode = _msy_char_stat_mode(cid)
    rows = _msy_char_skill_rows(cid, lc)
    active_ids = _msy_auto_active_skill_ids(cid, lc)
    crit = 0
    for row in _msy_pilot_skills_visible(stat_mode, rows):
        sid = row['id']
        if sid not in active_ids:
            continue
        rsk = _msy_resolve_skill_for_mode(row, rows, stat_mode)
        blob = _msy_skill_blob(rsk)
        for m in _SKILL_CRIT_RE.finditer(blob):
            for g in m.groups():
                if g and str(g).isdigit():
                    crit = max(crit, int(g))
    return crit


def _weapon_grants_guaranteed_crit(ws, wm, uid, ld, lc, stat_mode):
    for line in _weapon_trait_lines(ws, wm, uid, ld, lc, stat_mode):
        if _GUARANTEED_CRIT_RE.search(str(line or '')):
            return True
    return False


def _pair_guaranteed_crit(uid, cid, lc, wpn, crit_rate, *, vigor='super'):
    if _char_guaranteed_crit(cid, lc, vigor=vigor, cp_on=True):
        return True
    if wpn and _weapon_grants_guaranteed_crit(
        wpn.get('ws'), wpn.get('wm'), uid, _ldc(lc), lc, _unit_stat_mode(
            str((_app().unit_info_map.get(_app().normalize_id(uid)) or {}).get('rarity', '1')),
        ),
    ):
        return True
    return int(crit_rate or 0) >= 100


def _weapon_entry_power(ws):
    power = int(ws.get('power', 0) or 0)
    levels = ws.get('levels') or {}
    if isinstance(levels, dict) and levels:
        mx_lv = max(int(k) for k in levels.keys() if str(k).isdigit())
        power = max(power, int((levels.get(mx_lv) or levels.get(str(mx_lv)) or {}).get('power', 0) or 0))
    return power


def _best_ranking_weapon(uid, stat_mode, lc):
    """Highest computed-power non-map weapon (active + normal), matching Damage Simulator."""
    del stat_mode  # per-weapon stat mode (SSP when weapon is SSP)
    A = _app()
    ldc = _ldc(lc)
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    ri = str(info.get('rarity', '1'))
    wtm = ldc.get('weapon_trait_map', {}) or {}
    wcm = ldc.get('weapon_capability_map', {}) or {}
    wtdm = ldc.get('weapon_trait_detail_map', {}) or {}
    best = None
    best_power = -1
    for wp in A.unit_weapon_map.get(uid, []) or []:
        wid = A.normalize_id(wp.get('id'))
        wm = A.weapon_info_map.get(wid, {})
        wt = str(wm.get('weapon_type', '1') or '1')
        if wt == '3':
            continue
        sm = _unit_stat_mode(ri, wid=wid, wm=wm)
        try:
            ws = A.resolve_weapon_stats(
                wm, A.weapon_status_map, A.weapon_correction_map,
                wtm, wcm, A.growth_pattern_map, A.weapon_trait_change_map, wtdm,
                wid=wid, lang_code=lc, unit_id=uid,
            )
        except Exception:
            continue
        lv_idx = _best_weapon_level_index(ws, wm, uid, ldc, lc, sm)
        power = _computed_weapon_power_at_level(ws, wm, uid, ldc, lc, sm, lv_idx)
        if power <= 0:
            continue
        lv_row = _weapon_level_row(ws, lv_idx)
        if power > best_power:
            best_power = power
            best = {
                'wid': wid, 'wm': wm, 'ws': ws, 'power': power,
                'wpn_lv': lv_idx,
                'base_crit': int(lv_row.get('critical', 0) or 0),
                'attr': wm.get('attack_attribute', '1'), 'weapon_type': wt,
                'stat_mode': sm,
            }
    return best


def _best_ex_weapon(uid, stat_mode, lc):
    """Legacy alias — ranking uses best non-map weapon, not EX-only."""
    return _best_ranking_weapon(uid, stat_mode, lc)


def _unit_atk_max(uid, info, stat_mode, lc, cid, pair_ok, *, cp_on=True):
    A = _app()
    ldc = _ldc(lc)
    block = A._unit_max_lb_stat_block(uid, info, A.unit_stat_map.get(uid, {}), ldc)
    if not block:
        return 0
    fs = A._unit_lb_row_to_api(block, stat_mode, bool(cp_on))
    unit_atk = float(fs.get('ATK', 0) or 0)
    row = (A.CHAR_PAIR_UNIT_STAT_MOD_PCT.get(A.normalize_id(cid)) or {}).get(A.normalize_id(uid))
    if cp_on and pair_ok and row:
        atk_pct = int(row.get('atk_pct') or 0) if isinstance(row, dict) else (int(row) if isinstance(row, int) else 0)
        if atk_pct:
            unit_atk = math.floor(unit_atk * (100 + atk_pct) / 100)
    return unit_atk


_unit_weapon_cache = {}
_char_pair_cache = {}
_rankings_result_cache = {}
_rankings_browse_payload_cache = {}
_MSY_BROWSE_PAYLOAD_CACHE_TTL = max(15, min(300, int(os.environ.get('MSY_BROWSE_CACHE_TTL', '60') or '60')))
_rankings_build_lock = threading.Lock()
_rankings_inflight = set()
_MSY_DISK_VERSION = 'v14'
SHINN_EX_CHAR_ID = '1330000103'
_MSY_BUILD_WORKERS = max(1, min(8, int(os.environ.get('MSY_BUILD_WORKERS', '6') or '6')))
_MSY_USE_PROCESS_BUILD = os.environ.get('MSY_USE_PROCESS_BUILD', '').strip().lower() in ('1', 'true', 'yes')
_MSY_PUBLISH_PILOT_CAP = max(32, min(128, int(os.environ.get('MSY_PUBLISH_PILOT_CAP', '64') or '64')))
_BUILD_POOL_CTX = {}
_MSY_PAGE_BUILD_LIMIT = max(0, min(40, int(os.environ.get('MSY_PAGE_BUILD_LIMIT', '0') or '0')))
_MSY_PAGE_BUILD_BUDGET_SEC = max(5.0, min(60.0, float(os.environ.get('MSY_PAGE_BUILD_BUDGET_SEC', '18') or '18')))
_MSY_BROWSE_BUILD_BUDGET_SEC = max(1.0, min(45.0, float(os.environ.get('MSY_BROWSE_BUILD_BUDGET_SEC', '14') or '14')))
_MSY_BROWSE_PAGE_BUILD_LIMIT = max(0, min(20, int(os.environ.get('MSY_BROWSE_PAGE_BUILD_LIMIT', '12') or '12')))
_MSY_PILOT_BUILD_PER_REQUEST = max(1, min(4, int(os.environ.get('MSY_PILOT_BUILD_PER_REQUEST', '1') or '1')))
_MSY_LITE_PILOT_NEED = max(6, min(16, int(os.environ.get('MSY_LITE_PILOT_NEED', '8') or '8')))
_MSY_LITE_PILOT_CAP = max(6, min(20, int(os.environ.get('MSY_LITE_PILOT_CAP', '8') or '8')))
_MSY_LITE_NON_UR_RESERVE = max(2, min(6, int(os.environ.get('MSY_LITE_NON_UR_RESERVE', '4') or '4')))
_MSY_PREVIEW_PILOT_SCAN = max(16, min(80, int(os.environ.get('MSY_PREVIEW_PILOT_SCAN', '32') or '32')))
# Older published caches to load when the current v14 master file is missing (Railway deploy).
_MSY_LEGACY_MASTER_CACHE_KEYS = (
    ('_v13_dc_master', 'EN', 3, 20, None, None),
    ('_v12_dc_master', 'EN', 3, 20, None, None),
    ('_v11_master', 'EN', 3, 20, None, None),
)
_MSY_SORT_DAMAGE_INDEX = {}
_MSY_SORT_DAMAGE_INDEX_LOCK = threading.Lock()

_MAX_UNITS_FULL_SIM = 120
_PREFILTER_THRESHOLD = 80
_TOP_PILOTS_PREFILTER = 128
_FULL_SIM_PILOT_CAP = 128
# Each rank tab uses the vigor tier required in-game for that hit type (Damage Simulator rules).
_RANK_MODE_VIGOR = (
    ('super_crit', 'super_crit_dmg', 'super'),
    ('crit', 'crit_dmg', 'max'),
    ('normal', 'normal_dmg', 'high'),
)
_MSY_VIGOR_LEVELS = ('super', 'max', 'high')
_VIGOR_FOR_RANK_MODE = {mode: vigor for mode, _dmg, vigor in _RANK_MODE_VIGOR}


def _msy_app_root():
    return os.path.dirname(os.path.abspath(_app().__file__))


def _msy_persistent_dir():
    vol = (os.environ.get('GGEN_PERSISTENT_DIR') or os.environ.get('RAILWAY_VOLUME_MOUNT_PATH') or '').strip()
    if vol:
        d = os.path.join(vol, 'meta_synergy')
    else:
        d = os.path.join(_msy_app_root(), 'data', 'persistent', 'meta_synergy')
    os.makedirs(d, exist_ok=True)
    return d


def _msy_cache_basename(cache_key):
    tag, lc, lb_tier, top_pilots, du, dc = cache_key
    du_s = str(du) if du is not None else '0'
    dc_s = str(dc) if dc is not None else '0'
    return f'msy_{tag}_{lc}_lb{lb_tier}_tp{top_pilots}_du{du_s}_dc{dc_s}.json.gz'


def _msy_disk_path(cache_key):
    return os.path.join(_msy_persistent_dir(), _msy_cache_basename(cache_key))


def _msy_published_path(cache_key):
    return os.path.join(_msy_app_root(), 'data', 'published', _msy_cache_basename(cache_key))


def _msy_python_build_allowed():
    return os.environ.get('MSY_ALLOW_PYTHON_BUILD', '').strip().lower() in ('1', 'true', 'yes')


def _msy_page_build_allowed():
    """On-demand builds for the current results page (bounded by _MSY_PAGE_BUILD_LIMIT)."""
    return _MSY_PAGE_BUILD_LIMIT > 0


def _trim_group_pilots(g, top_n):
    """Trim pilot lists inside a group blob to top_n entries per ranking block."""
    if not g or top_n <= 0:
        return g
    g = dict(g)
    top_n = int(top_n)

    def _trim_block(block):
        if not block or not isinstance(block, dict):
            return block
        block = dict(block)
        pilots = block.get('pilots') or []
        if len(pilots) > top_n:
            block['pilots'] = pilots[:top_n]
        return block

    def _trim_rankings(rk):
        if not rk or not isinstance(rk, dict):
            return rk
        return {k: _trim_block(v) for k, v in rk.items()}

    for key in ('rankings', 'rankings_no_ur', 'rankings_no_shinn', 'rankings_no_gc', 'rankings_no_cp', 'rankings_no_pep'):
        if g.get(key):
            g[key] = _trim_rankings(g[key])
    for key in ('rankings_by_tier', 'rankings_no_ur_by_tier', 'rankings_no_shinn_by_tier',
                'rankings_no_gc_by_tier', 'rankings_no_cp_by_tier', 'rankings_no_pep_by_tier'):
        blob = g.get(key)
        if not blob:
            continue
        g[key] = {dt: _trim_rankings(rk) for dt, rk in blob.items()}
    if g.get('pilots') and len(g['pilots']) > top_n:
        g['pilots'] = g['pilots'][:top_n]
    return g


def _load_master_from_disk(cache_key, *, allow_legacy=False):
    for label, path in (
        ('persistent', _msy_disk_path(cache_key)),
        ('published', _msy_published_path(cache_key)),
    ):
        if not os.path.isfile(path):
            continue
        try:
            with gzip.open(path, 'rt', encoding='utf-8') as f:
                data = json.load(f)
            if data.get('version') != _MSY_DISK_VERSION:
                continue
            if tuple(data.get('cache_key') or ()) != tuple(cache_key):
                continue
            groups = data.get('groups')
            if not groups:
                continue
            print(f'MSY {label} cache hit: {len(groups)} units ({path})')
            return {
                'groups': groups,
                'total_pilot_candidates': int(data.get('total_pilot_candidates') or 0),
            }
        except Exception as e:
            print(f'MSY disk cache load failed ({path}): {e}')

    if not allow_legacy:
        return None

    want_top = int(cache_key[3] or 10)
    best = None
    best_n = 0
    best_label = ''
    for legacy_key in _MSY_LEGACY_MASTER_CACHE_KEYS:
        for label, path in (
            ('published', _msy_published_path(legacy_key)),
            ('persistent', _msy_disk_path(legacy_key)),
        ):
            if not os.path.isfile(path):
                continue
            try:
                with gzip.open(path, 'rt', encoding='utf-8') as f:
                    data = json.load(f)
                groups = data.get('groups')
                if not groups:
                    continue
                n = len(groups)
                if n > best_n or (n == best_n and label == 'published' and best_label != 'published'):
                    trimmed = groups
                    if want_top and want_top < int(legacy_key[3] or 20):
                        trimmed = [_trim_group_pilots(g, want_top) for g in groups]
                    best = {
                        'groups': trimmed,
                        'total_pilot_candidates': int(data.get('total_pilot_candidates') or 0),
                        'legacy': True,
                    }
                    best_n = n
                    best_label = label
            except Exception as e:
                print(f'MSY legacy disk cache load failed ({path}): {e}')
    if best:
        print(
            f'MSY legacy {best_label} cache hit: {best_n} units '
            f'(wanted {cache_key[0]})'
        )
    return best


def _save_master_to_disk(cache_key, result):
    path = _msy_disk_path(cache_key)
    try:
        payload = {
            'version': _MSY_DISK_VERSION,
            'cache_key': list(cache_key),
            'groups': result.get('groups') or [],
            'total_pilot_candidates': result.get('total_pilot_candidates', 0),
        }
        tmp = path + '.tmp'
        with gzip.open(tmp, 'wt', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
        os.replace(tmp, path)
        print(f'MSY disk cache saved: {len(payload["groups"])} units ({path})')
    except Exception as e:
        print(f'MSY disk cache save failed ({path}): {e}')


def _cached_best_ex_weapon(uid, stat_mode, lc):
    del stat_mode  # weapon pick derives per-weapon stat mode internally
    key = (str(uid), str(lc))
    if key not in _unit_weapon_cache:
        _unit_weapon_cache[key] = _best_ex_weapon(uid, None, lc)
    return _unit_weapon_cache[key]


def _cached_char_pair_totals(cid, uid, lc, *, cp_on=True):
    key = (str(cid), str(uid), str(lc), bool(cp_on))
    if key not in _char_pair_cache:
        if cp_on:
            _char_pair_cache[key] = _char_totals_for_pair_max(cid, uid, lc)
        else:
            _char_pair_cache[key] = _char_totals_for_pair_no_cp(cid, uid, lc)
    return _char_pair_cache[key]


def compute_pair_damage(uid, cid, lc='EN', *, lb_tier=3, vigor='super', def_tier=1,
                        def_unit_override=None, def_char_override=None, wpn=None,
                        cp_on=True, pep_on=True):
    A = _app()
    uid = A.normalize_id(uid)
    cid = A.normalize_id(cid)
    if cid not in A.char_list_playable_ids:
        return None
    info = A.unit_info_map.get(uid)
    if not info:
        return None
    ri = str(info.get('rarity', '1'))
    ldc = _ldc(lc)
    if wpn is None:
        wpn = _cached_best_ex_weapon(uid, None, lc)
    if not wpn or wpn['power'] <= 0:
        return None
    stat_mode = wpn.get('stat_mode') or _unit_stat_mode(
        ri, wid=wpn.get('wid'), wm=wpn.get('wm'),
    )

    def_total, defender_char_def, def_label = _resolve_defender_stats(
        def_tier, def_unit_override=def_unit_override, def_char_override=def_char_override,
    )
    tier_key = max(1, min(4, int(def_tier or 1)))

    totals, pair_ok = _cached_char_pair_totals(cid, uid, lc, cp_on=cp_on)
    skill_dmg = _char_active_skill_dmg_bonuses(cid, lc)
    char_atk, formula_stat = _formula_char_atk_for_pair(cid, uid, lc, wpn.get('attr'), cp_on=cp_on)
    unit_atk = _unit_atk_max(uid, info, stat_mode, lc, cid, pair_ok, cp_on=cp_on)
    if pep_on:
        pep_atk_pct = _pilot_pep_unit_stat_bonus_pct(
            cid, uid, lc, cp_on=cp_on, pair_ok=pair_ok,
        )
        if pep_atk_pct:
            unit_atk = math.floor(unit_atk * (100 + pep_atk_pct) / 100)

    dmg_dealt, crit_up = _char_pilot_dmg_bonuses(cid, uid, lc, cp_on=cp_on)
    dmg_dealt += skill_dmg

    pep_def_dn = 0
    if pep_on:
        pep = _collect_pilot_pep_bonuses(cid, uid, lc)
        pep_def_dn = int(pep.get('def_dn') or 0)
    def_debuff = _effective_def_debuff_pct(
        wpn['ws'], wpn['wm'], uid, ldc, lc, stat_mode, vigor, pep_def_dn,
    )

    crit_rate = int(wpn.get('base_crit') or 0)
    if pep_on:
        crit_rate += _pilot_affinity_weapon_crit(cid, uid, lc)
    crit_rate += _char_skill_crit_rate(cid, lc)
    crit_rate = min(100, max(0, crit_rate))

    guaranteed_crit = _pair_guaranteed_crit(uid, cid, lc, wpn, crit_rate, vigor=vigor) if cp_on else False

    vp = _VIGOR.get(vigor) or _VIGOR['super']
    unit_def_after = _sim_def_after_debuff(def_total, 0, def_debuff)
    dmg_mult = dmg_dealt + vp['dmg_bonus_pct']

    normal, battle, cwp = _calc_damage_core(
        unit_atk, char_atk, defender_char_def, unit_def_after, wpn['power'],
        def_debuff_pct=def_debuff,
        extra_dmg_pct=dmg_mult,
    )
    plain_crit, super_crit = _calc_crit_damage(
        battle, cwp,
        extra_dmg_pct=dmg_mult,
        crit_dmg_up_pct=crit_up,
        vigor=vigor,
    )
    expected = int(normal * (100 - crit_rate) / 100 + super_crit * crit_rate / 100)
    peak = super_crit if guaranteed_crit else max(super_crit, expected)

    return {
        'normal_dmg': normal,
        'crit_dmg': plain_crit,
        'super_crit_dmg': super_crit,
        'expected_dmg': expected,
        'peak_dmg': peak,
        'guaranteed_crit': guaranteed_crit,
        'crit_rate': crit_rate,
        'weapon_power': wpn['power'],
        'def_debuff_pct': def_debuff,
        'def_tier': tier_key,
        'def_unit_def': def_total,
        'def_char_def': int(defender_char_def),
        'def_label': def_label,
        'pair_ok': pair_ok,
        'char_atk': char_atk,
        'formula_stat': formula_stat,
    }


@lru_cache(maxsize=1)
def _linked_char_by_unit():
    """UnitId → Linked CharacterId from master m_linked_character_unit."""
    A = _app()
    path = os.path.join(_msy_app_root(), 'data', 'EN', 'master', 'm_linked_character_unit.json')
    out = {}
    try:
        with open(path, encoding='utf-8') as fh:
            rows = json.load(fh)
        for row in rows or []:
            uid = A.normalize_id(row.get('UnitId'))
            cid = A.normalize_id(row.get('CharacterId'))
            if uid and cid and cid in A.char_info_map:
                out[uid] = cid
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        pass
    return out


def _bundled_pilot_id(uid):
    A = _app()
    uid = A.normalize_id(uid)
    linked = _linked_char_by_unit()
    rec = linked.get(uid)
    if not rec:
        info = A.unit_info_map.get(uid) or {}
        rec = A.normalize_id(info.get('recommend_character_id') or '0')
        if rec == '0':
            rec = A.normalize_id(A.MANUAL_UNIT_RECOMMEND_CHARACTER_MAP.get(uid, '0'))
    if rec != '0' and rec in A.char_info_map:
        return rec
    return None


@lru_cache(maxsize=1)
def _linked_character_ids():
    """Characters bound to SD units (Linked Character) — cannot pilot other units."""
    A = _app()
    out = set(_linked_char_by_unit().values())
    for uid in A.unit_list_playable_ids:
        info = A.unit_info_map.get(uid)
        if not info or not A._unit_has_sd_mechanism(info, uid):
            continue
        bp = _bundled_pilot_id(uid)
        if bp:
            out.add(A.normalize_id(bp))
    return frozenset(out)


def _is_sd_unit(uid, info=None):
    A = _app()
    info = info or A.unit_info_map.get(A.normalize_id(uid)) or {}
    return A._unit_has_sd_mechanism(info, uid)


def _eligible_pilots_for_unit(uid, pilot_ids, exclude, same_role_only=False):
    uid = _app().normalize_id(uid)
    if _is_sd_unit(uid):
        bp = _bundled_pilot_id(uid)
        if not bp or (uid, bp) in exclude:
            return []
        return [bp]
    linked = _linked_character_ids()
    out = []
    for cid in pilot_ids:
        cid_n = _app().normalize_id(cid)
        if cid_n in linked:
            continue
        if (uid, cid_n) in exclude:
            continue
        if same_role_only and not _pilot_role_matches_unit(uid, cid_n):
            continue
        out.append(cid_n)
    return out


def _filter_non_ur(pilot_ids):
    A = _app()
    out = []
    for cid in pilot_ids:
        ri = str((A.char_info_map.get(cid) or {}).get('rarity', '1'))
        if A.RARITY_MAP.get(ri, 'N') != 'UR':
            out.append(cid)
    return out


def _filter_non_shinn(pilot_ids):
    A = _app()
    sid = A.normalize_id(SHINN_EX_CHAR_ID)
    return [cid for cid in pilot_ids if A.normalize_id(cid) != sid]


def _filter_non_guaranteed_crit(uid, pilot_ids, unit_wpn, lc, exclude):
    """Drop pilots with guaranteed crit (ability, EX weapon trait, or 100% crit rate)."""
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    ldc = _ldc(lc)
    out = []
    for cid in pilot_ids:
        if (uid, cid) in exclude:
            continue
        if _char_guaranteed_crit(cid, lc, vigor='super', cp_on=True):
            continue
        if unit_wpn and _weapon_grants_guaranteed_crit(
            unit_wpn.get('ws'), unit_wpn.get('wm'), uid, ldc, lc, stat_mode,
        ):
            continue
        crit = int(unit_wpn.get('base_crit') or 0) if unit_wpn else 0
        crit += _pilot_affinity_weapon_crit(cid, uid, lc)
        crit += _char_skill_crit_rate(cid, lc)
        if crit >= 100:
            continue
        out.append(cid)
    return out


def _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc):
    """Build super/crit/normal leaderboards using the correct vigor per mode."""
    rankings = {}
    for mode, dmg_key, vigor_key in _RANK_MODE_VIGOR:
        scored = []
        for cid, by_vigor in all_pairs:
            d = (by_vigor or {}).get(vigor_key)
            if not d:
                continue
            sc = d.get(dmg_key, 0) or 0
            if sc <= 0:
                continue
            scored.append((sc, cid, d))
        if not scored:
            continue
        scored.sort(key=lambda x: (-x[0], x[1]))
        top = scored[: max(1, int(top_pilots or 10))]
        rankings[mode] = {
            'max_damage': top[0][0],
            'vigor': vigor_key,
            'pilots': [
                {
                    'rank': i + 1,
                    'char': _entity_brief_char(cid, lc),
                    'normal_dmg': d['normal_dmg'],
                    'crit_dmg': d['crit_dmg'],
                    'super_crit_dmg': d['super_crit_dmg'],
                    'expected_dmg': d['expected_dmg'],
                    'peak_dmg': d['peak_dmg'],
                    'guaranteed_crit': d['guaranteed_crit'],
                    'crit_rate': d['crit_rate'],
                    'pair_ok': d['pair_ok'],
                    'char_atk': d.get('char_atk', 0),
                    'formula_stat': d.get('formula_stat', ''),
                    'dmg_dealt_pct': d.get('dmg_dealt_pct', 0),
                    'vigor_dmg_pct': d.get('vigor_dmg_pct', 0),
                    'vigor': vigor_key,
                    'active_skills': _msy_pilot_active_skills(cid, lc),
                    'score': sc,
                }
                for i, (sc, cid, d) in enumerate(top)
            ],
        }
    return rankings


def _multi_vigor_pairs_for_candidates(uid, candidates, lc, lb_tier, def_tier, unit_wpn, *,
                                      def_unit_override=None, def_char_override=None, cp_on=True,
                                      pep_on=True, lite=False, rank_mode=None):
    vigors = _MSY_VIGOR_LEVELS
    if lite:
        vigors = (_VIGOR_FOR_RANK_MODE.get(rank_mode or 'super_crit', 'super'),)
    pairs = []
    for cid in candidates:
        by_vigor = {}
        for v in vigors:
            dmg = compute_pair_damage(
                uid, cid, lc, lb_tier=lb_tier, vigor=v,
                def_tier=def_tier, def_unit_override=def_unit_override,
                def_char_override=def_char_override, wpn=unit_wpn,
                cp_on=cp_on, pep_on=pep_on,
            )
            if dmg:
                by_vigor[v] = dmg
        if by_vigor:
            pairs.append((cid, by_vigor))
    return pairs


def _rankings_no_cp_for_tier_lite(dt, all_pairs, top_pilots, uid, lc, lb_tier, unit_wpn, *,
                                    def_unit_override=None, def_char_override=None, rank_mode='super_crit'):
    """CP-off rankings for lite page builds — re-sim only pilots in the CP-on top list."""
    rk_on = _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
    top_cids = []
    for block in (rk_on or {}).values():
        for pilot in block.get('pilots') or []:
            cid = _app().normalize_id((pilot.get('char') or {}).get('id'))
            if cid and cid not in top_cids:
                top_cids.append(cid)
    if not top_cids:
        return rk_on
    pairs_ncp = _multi_vigor_pairs_for_candidates(
        uid, top_cids, lc, lb_tier, dt, unit_wpn,
        def_unit_override=def_unit_override, def_char_override=def_char_override,
        cp_on=False, lite=True, rank_mode=rank_mode,
    )
    return _rankings_from_multi_vigor_pairs(pairs_ncp, top_pilots, lc) if pairs_ncp else {}


def _rankings_no_pep_for_tier_lite(dt, all_pairs, top_pilots, uid, lc, lb_tier, unit_wpn, *,
                                    def_unit_override=None, def_char_override=None, rank_mode='super_crit'):
    """PEP-off rankings for lite page builds — re-sim only pilots in the PEP-on top list."""
    rk_on = _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
    top_cids = []
    for block in (rk_on or {}).values():
        for pilot in block.get('pilots') or []:
            cid = _app().normalize_id((pilot.get('char') or {}).get('id'))
            if cid and cid not in top_cids:
                top_cids.append(cid)
    if not top_cids:
        return rk_on
    pairs_npep = _multi_vigor_pairs_for_candidates(
        uid, top_cids, lc, lb_tier, dt, unit_wpn,
        def_unit_override=def_unit_override, def_char_override=def_char_override,
        cp_on=True, pep_on=False, lite=True, rank_mode=rank_mode,
    )
    return _rankings_from_multi_vigor_pairs(pairs_npep, top_pilots, lc) if pairs_npep else {}


def _rankings_no_cp_pep_for_tier_lite(dt, all_pairs, top_pilots, uid, lc, lb_tier, unit_wpn, *,
                                      def_unit_override=None, def_char_override=None, rank_mode='super_crit'):
    """CP+PEP off rankings for lite builds — re-sim top pilots with both passives disabled."""
    rk_on = _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
    top_cids = []
    for block in (rk_on or {}).values():
        for pilot in block.get('pilots') or []:
            cid = _app().normalize_id((pilot.get('char') or {}).get('id'))
            if cid and cid not in top_cids:
                top_cids.append(cid)
    if not top_cids:
        return rk_on
    pairs_off = _multi_vigor_pairs_for_candidates(
        uid, top_cids, lc, lb_tier, dt, unit_wpn,
        def_unit_override=def_unit_override, def_char_override=def_char_override,
        cp_on=False, pep_on=False, lite=True, rank_mode=rank_mode,
    )
    return _rankings_from_multi_vigor_pairs(pairs_off, top_pilots, lc) if pairs_off else {}


def _passive_cp_on_from_kwargs(kwargs):
    v = (kwargs or {}).get('cp_on')
    if v is None:
        return True
    return str(v) not in ('0', 'false', 'no', '')


def _passive_pep_on_from_kwargs(kwargs):
    v = (kwargs or {}).get('pep_on')
    if v is None:
        return True
    return str(v) not in ('0', 'false', 'no', '')


def _backfill_pilot_formula_stats(g, lc, rank_mode='super_crit', kwargs=None):
    """Fill char_atk / formula_stat on pilot rows (disk cache omits these)."""
    if not g:
        return g
    A = _app()
    uid = A.normalize_id((g.get('unit') or {}).get('id'))
    if not uid:
        return g
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not unit_wpn:
        return g
    attr = str(unit_wpn.get('attr', '1'))

    def _patch_pilot(pilot):
        if not pilot:
            return
        cid = A.normalize_id((pilot.get('char') or {}).get('id'))
        if not cid:
            return
        cp_on = _passive_cp_on_from_kwargs(kwargs or {})
        char_atk, formula_stat = _formula_char_atk_for_pair(cid, uid, lc, attr, cp_on=cp_on)
        if pilot.get('char_atk') in (None, 0):
            pilot['char_atk'] = char_atk
        if not pilot.get('formula_stat'):
            pilot['formula_stat'] = formula_stat

    def _patch_block(block):
        if not block:
            return
        for pilot in block.get('pilots') or []:
            _patch_pilot(pilot)

    rank_mode = rank_mode or 'super_crit'
    for key in (
        'rankings', 'rankings_no_cp', 'rankings_no_pep', 'rankings_no_cp_pep',
        'rankings_no_ur', 'rankings_no_shinn',
    ):
        rk = g.get(key)
        if isinstance(rk, dict):
            _patch_block(rk.get(rank_mode))
    for tier_rk in (g.get('rankings_by_tier') or {}).values():
        if isinstance(tier_rk, dict):
            _patch_block(tier_rk.get(rank_mode))
    for tier_map in (
        g.get('rankings_no_cp_by_tier'), g.get('rankings_no_pep_by_tier'),
        g.get('rankings_no_cp_pep_by_tier'),
    ):
        if isinstance(tier_map, dict):
            for tier_rk in tier_map.values():
                if isinstance(tier_rk, dict):
                    _patch_block(tier_rk.get(rank_mode))
    _patch_block({'pilots': g.get('pilots') or []})
    return g


def _ensure_passive_variant_for_request(g, lc, rank_mode, def_tier, kwargs):
    """Backfill CP/PEP-off rankings only when the client requests that toggle state."""
    if not g or g.get('pending'):
        return g
    cp_on = _passive_cp_on_from_kwargs(kwargs)
    pep_on = _passive_pep_on_from_kwargs(kwargs)
    if cp_on and pep_on:
        return g
    if not cp_on and not pep_on:
        return _ensure_rankings_no_cp_pep(g, lc, rank_mode, def_tier, kwargs)
    if not cp_on:
        return _ensure_rankings_no_cp(g, lc, rank_mode, def_tier, kwargs)
    return _ensure_rankings_no_pep(g, lc, rank_mode, def_tier, kwargs)


def _ensure_rankings_no_cp(g, lc, rank_mode, def_tier, kwargs):
    """Backfill CP-off rankings when missing (legacy cache / fast browse builds)."""
    if not g or g.get('pending') or g.get('pilot_preview'):
        return g
    A = _app()
    rank_mode = rank_mode or 'super_crit'
    rncp = g.get('rankings_no_cp') or {}
    cp_block = (rncp.get(rank_mode) if isinstance(rncp, dict) else None) or {}
    if cp_block.get('pilots'):
        return g
    block = (g.get('rankings') or {}).get(rank_mode)
    if not block or not block.get('pilots'):
        return g
    uid = A.normalize_id((g.get('unit') or {}).get('id'))
    if not uid:
        return g
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not unit_wpn:
        return g
    top_p = int((kwargs or {}).get('top_pilots', 10) or 10)
    lb = int((kwargs or {}).get('lb_tier', 3) or 3)
    dt = max(1, min(4, int(def_tier or 3)))
    top_cids = []
    for pilot in block.get('pilots') or []:
        cid = A.normalize_id((pilot.get('char') or {}).get('id'))
        if cid and cid not in top_cids:
            top_cids.append(cid)
    if not top_cids:
        return g
    pairs_on = _multi_vigor_pairs_for_candidates(
        uid, top_cids, lc, lb, dt, unit_wpn,
        cp_on=True, lite=True, rank_mode=rank_mode,
    )
    if not pairs_on:
        return g
    built = _rankings_no_cp_for_tier_lite(
        dt, pairs_on, top_p, uid, lc, lb, unit_wpn,
        rank_mode=rank_mode,
    )
    if not built:
        return g
    out = dict(g)
    out['rankings_no_cp'] = built
    return out


def _ensure_rankings_no_pep(g, lc, rank_mode, def_tier, kwargs):
    """Backfill PEP-off rankings when missing (legacy cache / fast browse builds)."""
    if not g or g.get('pending') or g.get('pilot_preview'):
        return g
    A = _app()
    rank_mode = rank_mode or 'super_crit'
    rnpep = g.get('rankings_no_pep') or {}
    pep_block = (rnpep.get(rank_mode) if isinstance(rnpep, dict) else None) or {}
    if pep_block.get('pilots'):
        return g
    block = (g.get('rankings') or {}).get(rank_mode)
    if not block or not block.get('pilots'):
        return g
    uid = A.normalize_id((g.get('unit') or {}).get('id'))
    if not uid:
        return g
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not unit_wpn:
        return g
    top_p = int((kwargs or {}).get('top_pilots', 10) or 10)
    lb = int((kwargs or {}).get('lb_tier', 3) or 3)
    dt = max(1, min(4, int(def_tier or 3)))
    top_cids = []
    for pilot in block.get('pilots') or []:
        cid = A.normalize_id((pilot.get('char') or {}).get('id'))
        if cid and cid not in top_cids:
            top_cids.append(cid)
    if not top_cids:
        return g
    pairs_on = _multi_vigor_pairs_for_candidates(
        uid, top_cids, lc, lb, dt, unit_wpn,
        cp_on=True, pep_on=True, lite=True, rank_mode=rank_mode,
    )
    if not pairs_on:
        return g
    built = _rankings_no_pep_for_tier_lite(
        dt, pairs_on, top_p, uid, lc, lb, unit_wpn,
        rank_mode=rank_mode,
    )
    if not built:
        return g
    out = dict(g)
    out['rankings_no_pep'] = built
    return out


def _ensure_rankings_no_cp_pep(g, lc, rank_mode, def_tier, kwargs):
    """Backfill CP+PEP-off rankings when missing."""
    if not g or g.get('pending') or g.get('pilot_preview'):
        return g
    A = _app()
    rank_mode = rank_mode or 'super_crit'
    rnb = g.get('rankings_no_cp_pep') or {}
    off_block = (rnb.get(rank_mode) if isinstance(rnb, dict) else None) or {}
    if off_block.get('pilots'):
        return g
    block = (g.get('rankings') or {}).get(rank_mode)
    if not block or not block.get('pilots'):
        return g
    uid = A.normalize_id((g.get('unit') or {}).get('id'))
    if not uid:
        return g
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not unit_wpn:
        return g
    top_p = int((kwargs or {}).get('top_pilots', 10) or 10)
    lb = int((kwargs or {}).get('lb_tier', 3) or 3)
    dt = max(1, min(4, int(def_tier or 3)))
    top_cids = []
    for pilot in block.get('pilots') or []:
        cid = A.normalize_id((pilot.get('char') or {}).get('id'))
        if cid and cid not in top_cids:
            top_cids.append(cid)
    if not top_cids:
        return g
    pairs_on = _multi_vigor_pairs_for_candidates(
        uid, top_cids, lc, lb, dt, unit_wpn,
        cp_on=True, pep_on=True, lite=True, rank_mode=rank_mode,
    )
    if not pairs_on:
        return g
    built = _rankings_no_cp_pep_for_tier_lite(
        dt, pairs_on, top_p, uid, lc, lb, unit_wpn,
        rank_mode=rank_mode,
    )
    if not built:
        return g
    out = dict(g)
    out['rankings_no_cp_pep'] = built
    return out


def _best_pilot_by_stat(uid, pilot_ids, wpn, lc, exclude, same_role_only=False):
    if not wpn:
        return None
    eligible = _eligible_pilots_for_unit(uid, pilot_ids, exclude, same_role_only=same_role_only)
    if not eligible:
        return None
    info = _app().unit_info_map.get(_app().normalize_id(uid)) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    best_cid = None
    best_score = -1.0
    for cid in eligible:
        sc = _cheap_pilot_score(uid, cid, info, wpn, stat_mode, lc)
        if sc > best_score:
            best_score = sc
            best_cid = cid
    return best_cid


def _prefilter_unit_ids(unit_rows, pilot_ids, lc, lb_tier, vigor, def_tier, exclude, *,
                        def_unit_override=None, def_char_override=None):
    A = _app()
    scored = []
    for uid in unit_rows:
        info = A.unit_info_map.get(uid) or {}
        stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
        unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
        if not unit_wpn:
            continue
        if _is_sd_unit(uid, info):
            best_cid = _bundled_pilot_id(uid)
        else:
            best_cid = _best_pilot_by_stat(uid, pilot_ids, unit_wpn, lc, exclude)
        if not best_cid or (uid, best_cid) in exclude:
            continue
        dmg = compute_pair_damage(
            uid, best_cid, lc, lb_tier=lb_tier, vigor=vigor,
            def_tier=def_tier, def_unit_override=def_unit_override,
            def_char_override=def_char_override, wpn=unit_wpn,
        )
        if not dmg:
            continue
        sc = max(
            dmg.get('super_crit_dmg', 0) or 0,
            dmg.get('crit_dmg', 0) or 0,
            dmg.get('normal_dmg', 0) or 0,
        )
        scored.append((sc, uid))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [uid for _, uid in scored[:_MAX_UNITS_FULL_SIM]]


def _cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc, *, cp_on=True, pep_on=True):
    """Unit×pilot damage proxy for prefilter (skills, affinity, pair ATK)."""
    totals, pair_ok = _cached_char_pair_totals(cid, uid, lc, cp_on=cp_on)
    skill_dmg, _skill_atk_pct = _char_skill_bonuses(cid, lc)
    char_atk = float(_formula_char_atk_for_pair(cid, uid, lc, unit_wpn.get('attr'), cp_on=cp_on)[0])
    unit_atk = _unit_atk_max(uid, info, stat_mode, lc, cid, pair_ok, cp_on=cp_on)
    if pep_on:
        pep_atk_pct = _pilot_pep_unit_stat_bonus_pct(
            cid, uid, lc, cp_on=cp_on, pair_ok=pair_ok,
        )
        if pep_atk_pct:
            unit_atk = math.floor(unit_atk * (100 + pep_atk_pct) / 100)
    dmg_dealt, crit_up = _char_pilot_dmg_bonuses(cid, uid, lc, cp_on=cp_on)
    wp = float(unit_wpn.get('power') or 0)
    score = (unit_atk + 2.0 * char_atk) * wp
    if dmg_dealt or crit_up:
        score *= (1.0 + (dmg_dealt + crit_up) / 100.0)
    if pair_ok:
        score *= 1.12
    score += float(skill_dmg) * 500.0
    return score


def _lite_candidates_for_unit(uid, active_pilots, need, info, unit_wpn, stat_mode, lc):
    """Bounded pilot pool for page builds — always reserve slots for non-UR pilots."""
    pilot_cap = _MSY_LITE_PILOT_CAP
    if len(active_pilots) <= pilot_cap:
        return list(active_pilots)
    cheap_scored = [
        (_cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc), cid)
        for cid in active_pilots
    ]
    cheap_scored.sort(key=lambda x: (-x[0], x[1]))
    top = [cid for _, cid in cheap_scored[:need]]
    merged = []
    non_ur = _filter_non_ur(active_pilots)
    if non_ur:
        nu_scored = [
            (_cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc), cid)
            for cid in non_ur
        ]
        nu_scored.sort(key=lambda x: (-x[0], x[1]))
        reserve = min(_MSY_LITE_NON_UR_RESERVE, len(nu_scored))
        for _, cid in nu_scored[:reserve]:
            if cid not in merged:
                merged.append(cid)
    for cid in top:
        if cid not in merged:
            merged.append(cid)
        if len(merged) >= pilot_cap:
            break
    return merged[:pilot_cap]


def _rankings_filtered_pool_lite(uid, active_pilots, filter_fn, top_pilots, lc, lb_tier, def_tier, unit_wpn,
                                 need, info, stat_mode, *, def_unit_override=None, def_char_override=None,
                                 rank_mode='super_crit'):
    """Sim max-damage rankings from a filtered pilot pool (non-UR, non-Shinn, etc.)."""
    filtered = filter_fn(active_pilots)
    if not filtered:
        return {}
    scored = [
        (_cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc), cid)
        for cid in filtered
    ]
    scored.sort(key=lambda x: (-x[0], x[1]))
    cap = max(int(top_pilots or 10) + 2, min(need, _MSY_LITE_PILOT_CAP))
    candidates = [cid for _, cid in scored[:cap]]
    pairs = _multi_vigor_pairs_for_candidates(
        uid, candidates, lc, lb_tier, def_tier, unit_wpn,
        def_unit_override=def_unit_override, def_char_override=def_char_override,
        cp_on=True, lite=True, rank_mode=rank_mode,
    )
    return _rankings_from_multi_vigor_pairs(pairs, top_pilots, lc) if pairs else {}


def _rankings_no_ur_pool_lite(uid, active_pilots, top_pilots, lc, lb_tier, def_tier, unit_wpn,
                               need, info, stat_mode, *, def_unit_override=None, def_char_override=None,
                               rank_mode='super_crit'):
    """Sim max-damage rankings from the non-UR pilot pool only (lite / browse builds)."""
    return _rankings_filtered_pool_lite(
        uid, active_pilots, _filter_non_ur, top_pilots, lc, lb_tier, def_tier, unit_wpn,
        need, info, stat_mode, def_unit_override=def_unit_override,
        def_char_override=def_char_override, rank_mode=rank_mode,
    )


def _rankings_no_shinn_pool_lite(uid, active_pilots, top_pilots, lc, lb_tier, def_tier, unit_wpn,
                                  need, info, stat_mode, *, def_unit_override=None, def_char_override=None,
                                  rank_mode='super_crit'):
    return _rankings_filtered_pool_lite(
        uid, active_pilots, _filter_non_shinn, top_pilots, lc, lb_tier, def_tier, unit_wpn,
        need, info, stat_mode, def_unit_override=def_unit_override,
        def_char_override=def_char_override, rank_mode=rank_mode,
    )


def _rankings_variant_for_tier_lite(filter_fn, active_pilots, all_pairs, top_pilots, uid, lc, lb_tier,
                                    def_tier, unit_wpn, need, info, stat_mode, *, def_unit_override=None,
                                    def_char_override=None, rank_mode='super_crit', browse_fast=False):
    """Lite variant rankings (no-UR / no-Shinn) without a full pilot-pool rescan."""
    filtered = filter_fn(active_pilots)
    if not filtered:
        return {}
    if len(filtered) >= len(active_pilots):
        return _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
    allowed = set(filtered)
    variant_pairs = [(cid, bv) for cid, bv in all_pairs if cid in allowed]
    simmed = {cid for cid, _ in variant_pairs}
    missing = [cid for cid in filtered if cid not in simmed]
    if missing and not browse_fast:
        scored = [
            (_cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc), cid)
            for cid in missing
        ]
        scored.sort(key=lambda x: (-x[0], x[1]))
        extra_cids = [cid for _, cid in scored[:need]]
        extra_pairs = _multi_vigor_pairs_for_candidates(
            uid, extra_cids, lc, lb_tier, def_tier, unit_wpn,
            def_unit_override=def_unit_override, def_char_override=def_char_override,
            cp_on=True, lite=True, rank_mode=rank_mode,
        )
        variant_pairs.extend(extra_pairs)
    return _rankings_from_multi_vigor_pairs(variant_pairs, top_pilots, lc) if variant_pairs else {}


def _build_single_unit_group(uid, pilot_ids, lc, lb_tier, vigor, def_tier, exclude, top_pilots, metric, *,
                             def_unit_override=None, def_char_override=None, def_tiers=None, lite=False,
                             rank_mode='super_crit', same_role_only=False, browse_fast=False,
                             publish_build=False):
    A = _app()
    info = A.unit_info_map.get(uid) or {}
    unit_wpn = _cached_best_ex_weapon(uid, None, lc)
    if not unit_wpn:
        return None
    stat_mode = unit_wpn.get('stat_mode') or _unit_stat_mode(str(info.get('rarity', '1')))

    active_pilots = _eligible_pilots_for_unit(uid, pilot_ids, exclude, same_role_only=same_role_only)
    if not active_pilots:
        return None

    need = max(_TOP_PILOTS_PREFILTER, int(top_pilots or 10) + 8)
    if lite:
        need = max(int(top_pilots or 10) + 4, _MSY_LITE_PILOT_NEED)
    if publish_build:
        pilot_cap = _MSY_PUBLISH_PILOT_CAP
    elif lite:
        pilot_cap = _MSY_LITE_PILOT_CAP
    else:
        pilot_cap = _FULL_SIM_PILOT_CAP
    if lite:
        candidates = _lite_candidates_for_unit(
            uid, active_pilots, need, info, unit_wpn, stat_mode, lc,
        )
    elif len(active_pilots) <= pilot_cap:
        candidates = list(active_pilots)
    else:
        cheap_scored = []
        for cid in active_pilots:
            cheap_scored.append((
                _cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc),
                cid,
            ))
        cheap_scored.sort(key=lambda x: (-x[0], x[1]))
        candidates = [cid for _, cid in cheap_scored[:need]]

    tiers = tuple(def_tiers) if def_tiers else (def_tier,)
    use_multi_tier = (
        len(tiers) > 1
        and not def_unit_override
        and not def_char_override
    )

    def _pairs_for_tier(dt, *, cp_on=True, pep_on=True):
        return _multi_vigor_pairs_for_candidates(
            uid, candidates, lc, lb_tier, dt, unit_wpn,
            def_unit_override=def_unit_override, def_char_override=def_char_override,
            cp_on=cp_on, pep_on=pep_on, lite=lite, rank_mode=rank_mode,
        )

    def _rankings_no_cp_for_tier(dt, _all_pairs):
        pairs_ncp = _pairs_for_tier(dt, cp_on=False)
        return _rankings_from_multi_vigor_pairs(pairs_ncp, top_pilots, lc) if pairs_ncp else {}

    def _rankings_no_pep_for_tier(dt, _all_pairs):
        pairs_npep = _pairs_for_tier(dt, pep_on=False)
        return _rankings_from_multi_vigor_pairs(pairs_npep, top_pilots, lc) if pairs_npep else {}

    def _rankings_no_cp_pep_for_tier(dt, _all_pairs):
        pairs_off = _pairs_for_tier(dt, cp_on=False, pep_on=False)
        return _rankings_from_multi_vigor_pairs(pairs_off, top_pilots, lc) if pairs_off else {}

    def _rankings_no_ur_for_tier(dt, all_pairs):
        non_ur = _filter_non_ur(active_pilots)
        if not non_ur:
            return {}
        if len(non_ur) >= len(active_pilots):
            return _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
        return _rankings_no_ur_pool_lite(
            uid, active_pilots, top_pilots, lc, lb_tier, dt, unit_wpn,
            need, info, stat_mode, def_unit_override=def_unit_override,
            def_char_override=def_char_override, rank_mode=rank_mode,
        )

    def _rankings_no_shinn_for_tier(dt, all_pairs):
        non_shinn = _filter_non_shinn(active_pilots)
        if not non_shinn:
            return {}
        if len(non_shinn) >= len(active_pilots):
            return _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
        return _rankings_no_shinn_pool_lite(
            uid, active_pilots, top_pilots, lc, lb_tier, dt, unit_wpn,
            need, info, stat_mode, def_unit_override=def_unit_override,
            def_char_override=def_char_override, rank_mode=rank_mode,
        )

    def _rankings_no_gc_for_tier(dt, all_pairs):
        non_gc = _filter_non_guaranteed_crit(uid, active_pilots, unit_wpn, lc, exclude)
        if len(non_gc) >= len(active_pilots):
            return _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
        ng_cids = set(non_gc)
        all_pairs_ng = [(cid, bv) for cid, bv in all_pairs if cid in ng_cids]
        if not all_pairs_ng and non_gc:
            ng_scored = []
            for cid in non_gc:
                ng_scored.append((
                    _cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc),
                    cid,
                ))
            ng_scored.sort(key=lambda x: (-x[0], x[1]))
            ng_candidates = [cid for _, cid in ng_scored[:need]]
            all_pairs_ng = _multi_vigor_pairs_for_candidates(
                uid, ng_candidates, lc, lb_tier, dt, unit_wpn,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
            )
        return _rankings_from_multi_vigor_pairs(all_pairs_ng, top_pilots, lc)

    if use_multi_tier:
        rankings_by_tier = {}
        rankings_no_ur_by_tier = {}
        rankings_no_shinn_by_tier = {}
        rankings_no_gc_by_tier = {}
        rankings_no_cp_by_tier = {}
        rankings_no_pep_by_tier = {}
        for dt in tiers:
            pairs = _pairs_for_tier(dt, cp_on=True, pep_on=True)
            if not pairs:
                continue
            rk = _rankings_from_multi_vigor_pairs(pairs, top_pilots, lc)
            if rk:
                rankings_by_tier[int(dt)] = rk
                if publish_build:
                    rankings_no_ur_by_tier[int(dt)] = _rankings_no_ur_pool_lite(
                        uid, active_pilots, top_pilots, lc, lb_tier, dt, unit_wpn,
                        need, info, stat_mode, def_unit_override=def_unit_override,
                        def_char_override=def_char_override, rank_mode=rank_mode,
                    )
                    rankings_no_cp_by_tier[int(dt)] = _rankings_no_cp_for_tier_lite(
                        dt, pairs, top_pilots, uid, lc, lb_tier, unit_wpn,
                        def_unit_override=def_unit_override, def_char_override=def_char_override,
                        rank_mode=rank_mode,
                    )
                    rankings_no_pep_by_tier[int(dt)] = _rankings_no_pep_for_tier_lite(
                        dt, pairs, top_pilots, uid, lc, lb_tier, unit_wpn,
                        def_unit_override=def_unit_override, def_char_override=def_char_override,
                        rank_mode=rank_mode,
                    )
                else:
                    rankings_no_ur_by_tier[int(dt)] = _rankings_no_ur_for_tier(dt, pairs)
                    rankings_no_shinn_by_tier[int(dt)] = _rankings_no_shinn_for_tier(dt, pairs)
                    rankings_no_gc_by_tier[int(dt)] = _rankings_no_gc_for_tier(dt, pairs)
                    rankings_no_cp_by_tier[int(dt)] = _rankings_no_cp_for_tier(dt, pairs)
                    rankings_no_pep_by_tier[int(dt)] = _rankings_no_pep_for_tier(dt, pairs)
        if not rankings_by_tier:
            return None
        dt_primary = int(def_tier) if int(def_tier) in rankings_by_tier else next(iter(rankings_by_tier))
        rankings = rankings_by_tier[dt_primary]
        rankings_no_ur = rankings_no_ur_by_tier.get(dt_primary) or rankings
        rankings_no_shinn = rankings_no_shinn_by_tier.get(dt_primary) or rankings
        rankings_no_gc = rankings_no_gc_by_tier.get(dt_primary) or rankings
        rankings_no_cp = rankings_no_cp_by_tier.get(dt_primary) or rankings
        rankings_no_pep = rankings_no_pep_by_tier.get(dt_primary) or rankings
        rankings_no_cp_pep = None
    else:
        dt = int(tiers[0])
        all_pairs = _pairs_for_tier(dt, cp_on=True, pep_on=True)
        if not all_pairs:
            return None
        rankings = _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
        if not rankings:
            return None
        if lite and browse_fast:
            rankings_no_gc = rankings
            rankings_no_cp = _rankings_no_cp_for_tier_lite(
                dt, all_pairs, top_pilots, uid, lc, lb_tier, unit_wpn,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
                rank_mode=rank_mode,
            )
            rankings_no_pep = _rankings_no_pep_for_tier_lite(
                dt, all_pairs, top_pilots, uid, lc, lb_tier, unit_wpn,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
                rank_mode=rank_mode,
            )
            rankings_no_cp_pep = _rankings_no_cp_pep_for_tier_lite(
                dt, all_pairs, top_pilots, uid, lc, lb_tier, unit_wpn,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
                rank_mode=rank_mode,
            )
            rankings_no_ur = _rankings_no_ur_pool_lite(
                uid, active_pilots, top_pilots, lc, lb_tier, dt, unit_wpn,
                need, info, stat_mode, def_unit_override=def_unit_override,
                def_char_override=def_char_override, rank_mode=rank_mode,
            )
            rankings_no_shinn = None
        elif lite:
            rankings_no_gc = rankings
            rankings_no_cp = _rankings_no_cp_for_tier_lite(
                dt, all_pairs, top_pilots, uid, lc, lb_tier, unit_wpn,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
                rank_mode=rank_mode,
            )
            rankings_no_pep = _rankings_no_pep_for_tier_lite(
                dt, all_pairs, top_pilots, uid, lc, lb_tier, unit_wpn,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
                rank_mode=rank_mode,
            )
            rankings_no_cp_pep = _rankings_no_cp_pep_for_tier_lite(
                dt, all_pairs, top_pilots, uid, lc, lb_tier, unit_wpn,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
                rank_mode=rank_mode,
            )
            rankings_no_ur = _rankings_no_ur_pool_lite(
                uid, active_pilots, top_pilots, lc, lb_tier, dt, unit_wpn,
                need, info, stat_mode, def_unit_override=def_unit_override,
                def_char_override=def_char_override, rank_mode=rank_mode,
            )
            rankings_no_shinn = None
        else:
            rankings_no_ur = _rankings_no_ur_for_tier(dt, all_pairs)
            rankings_no_shinn = _rankings_no_shinn_for_tier(dt, all_pairs)
            rankings_no_gc = _rankings_no_gc_for_tier(dt, all_pairs)
            rankings_no_cp = _rankings_no_cp_for_tier(dt, all_pairs)
            rankings_no_pep = _rankings_no_pep_for_tier(dt, all_pairs)
            rankings_no_cp_pep = _rankings_no_cp_pep_for_tier(dt, all_pairs)
        rankings_by_tier = None
        rankings_no_ur_by_tier = None
        rankings_no_shinn_by_tier = None
        rankings_no_gc_by_tier = None
        rankings_no_cp_by_tier = None
        rankings_no_pep_by_tier = None

    primary = rankings.get('super_crit') or rankings.get('crit') or rankings.get('normal')
    is_sd = _is_sd_unit(uid, info)
    out = {
        'unit': _entity_brief_unit(uid, lc),
        'weapon_elems': _weapon_elem_label(uid, lc),
        'weapon_info': _weapon_info_for_msy(uid, lc),
        'rankings': rankings,
        'max_damage': primary['max_damage'],
        'metric': metric,
        'pilots': primary['pilots'],
        'is_sd': is_sd,
        'bundled_pilot_id': _bundled_pilot_id(uid) if is_sd else None,
    }
    if rankings_no_ur is not None:
        out['rankings_no_ur'] = rankings_no_ur
    if rankings_no_shinn is not None:
        out['rankings_no_shinn'] = rankings_no_shinn
    if rankings_no_gc is not None:
        out['rankings_no_gc'] = rankings_no_gc
    if rankings_no_cp is not None:
        out['rankings_no_cp'] = rankings_no_cp
    if rankings_no_pep is not None:
        out['rankings_no_pep'] = rankings_no_pep
    if rankings_no_cp_pep is not None:
        out['rankings_no_cp_pep'] = rankings_no_cp_pep
    if rankings_by_tier:
        out['rankings_by_tier'] = rankings_by_tier
        out['rankings_no_ur_by_tier'] = rankings_no_ur_by_tier
        out['rankings_no_shinn_by_tier'] = rankings_no_shinn_by_tier
        out['rankings_no_gc_by_tier'] = rankings_no_gc_by_tier
        out['rankings_no_cp_by_tier'] = rankings_no_cp_by_tier
        out['rankings_no_pep_by_tier'] = rankings_no_pep_by_tier
    if not same_role_only:
        out['cross_role_built'] = True
    return out


def assemble_unit_group_from_dc(uid, pairs_by_tier, pilot_ids, lc, top_pilots, exclude, metric='super_crit',
                                pairs_by_tier_no_cp=None, same_role_only=False):
    """Build one MSY unit group from Damage Simulator pair results."""
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not unit_wpn or not pairs_by_tier:
        return None

    active_pilots = _eligible_pilots_for_unit(uid, pilot_ids, exclude, same_role_only=same_role_only)
    if not active_pilots:
        return None
    active_set = set(active_pilots)
    need = max(_TOP_PILOTS_PREFILTER, int(top_pilots or 10) + 8)

    def _filter_pairs(all_pairs):
        return [(cid, bv) for cid, bv in all_pairs if cid in active_set and bv]

    def _rankings_no_ur_for_tier(dt, all_pairs):
        non_ur = _filter_non_ur(active_pilots)
        if not non_ur:
            return {}
        if len(non_ur) >= len(active_pilots):
            return _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
        return _rankings_no_ur_pool_lite(
            uid, active_pilots, top_pilots, lc, 3, dt, unit_wpn,
            need, info, stat_mode, rank_mode=metric,
        )

    def _rankings_no_shinn_for_tier(dt, all_pairs):
        non_shinn = _filter_non_shinn(active_pilots)
        if not non_shinn:
            return {}
        if len(non_shinn) >= len(active_pilots):
            return _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
        return _rankings_no_shinn_pool_lite(
            uid, active_pilots, top_pilots, lc, 3, dt, unit_wpn,
            need, info, stat_mode, rank_mode=metric,
        )

    def _rankings_no_gc_for_tier(dt, all_pairs):
        non_gc = _filter_non_guaranteed_crit(uid, active_pilots, unit_wpn, lc, exclude)
        if len(non_gc) >= len(active_pilots):
            return _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
        ng_cids = set(non_gc)
        filtered = [(cid, bv) for cid, bv in all_pairs if cid in ng_cids]
        return _rankings_from_multi_vigor_pairs(filtered, top_pilots, lc) if filtered else {}

    def _rankings_no_cp_for_tier(dt, _all_pairs):
        if not pairs_by_tier_no_cp:
            return {}
        raw = pairs_by_tier_no_cp.get(dt) or pairs_by_tier_no_cp.get(str(dt)) or []
        filtered = _filter_pairs(raw)
        return _rankings_from_multi_vigor_pairs(filtered, top_pilots, lc) if filtered else {}

    use_multi_tier = len(pairs_by_tier) > 1
    if use_multi_tier:
        rankings_by_tier = {}
        rankings_no_ur_by_tier = {}
        rankings_no_shinn_by_tier = {}
        rankings_no_gc_by_tier = {}
        rankings_no_cp_by_tier = {}
        for dt, raw_pairs in pairs_by_tier.items():
            pairs = _filter_pairs(raw_pairs)
            if not pairs:
                continue
            rk = _rankings_from_multi_vigor_pairs(pairs, top_pilots, lc)
            if rk:
                rankings_by_tier[int(dt)] = rk
                rankings_no_ur_by_tier[int(dt)] = _rankings_no_ur_for_tier(dt, pairs)
                rankings_no_shinn_by_tier[int(dt)] = _rankings_no_shinn_for_tier(dt, pairs)
                rankings_no_gc_by_tier[int(dt)] = _rankings_no_gc_for_tier(dt, pairs)
                rankings_no_cp_by_tier[int(dt)] = _rankings_no_cp_for_tier(dt, pairs)
        if not rankings_by_tier:
            return None
        dt_primary = next(iter(sorted(rankings_by_tier)))
        rankings = rankings_by_tier[dt_primary]
        rankings_no_ur = rankings_no_ur_by_tier.get(dt_primary) or rankings
        rankings_no_shinn = rankings_no_shinn_by_tier.get(dt_primary) or rankings
        rankings_no_gc = rankings_no_gc_by_tier.get(dt_primary) or rankings
        rankings_no_cp = rankings_no_cp_by_tier.get(dt_primary) or rankings
    else:
        dt = int(next(iter(pairs_by_tier)))
        pairs = _filter_pairs(pairs_by_tier[dt])
        if not pairs:
            return None
        rankings = _rankings_from_multi_vigor_pairs(pairs, top_pilots, lc)
        if not rankings:
            return None
        rankings_no_ur = _rankings_no_ur_for_tier(dt, pairs)
        rankings_no_shinn = _rankings_no_shinn_for_tier(dt, pairs)
        rankings_no_gc = _rankings_no_gc_for_tier(dt, pairs)
        rankings_no_cp = _rankings_no_cp_for_tier(dt, pairs)
        rankings_by_tier = None
        rankings_no_ur_by_tier = None
        rankings_no_shinn_by_tier = None
        rankings_no_gc_by_tier = None
        rankings_no_cp_by_tier = None

    primary = rankings.get('super_crit') or rankings.get('crit') or rankings.get('normal')
    if not primary:
        return None
    is_sd = _is_sd_unit(uid, info)
    out = {
        'unit': _entity_brief_unit(uid, lc),
        'weapon_elems': _weapon_elem_label(uid, lc),
        'weapon_info': _weapon_info_for_msy(uid, lc),
        'rankings': rankings,
        'rankings_no_ur': rankings_no_ur,
        'rankings_no_shinn': rankings_no_shinn,
        'rankings_no_gc': rankings_no_gc,
        'rankings_no_cp': rankings_no_cp,
        'max_damage': primary['max_damage'],
        'metric': metric,
        'pilots': primary['pilots'],
        'is_sd': is_sd,
        'bundled_pilot_id': _bundled_pilot_id(uid) if is_sd else None,
    }
    if rankings_by_tier:
        out['rankings_by_tier'] = rankings_by_tier
        out['rankings_no_ur_by_tier'] = rankings_no_ur_by_tier
        out['rankings_no_shinn_by_tier'] = rankings_no_shinn_by_tier
        out['rankings_no_gc_by_tier'] = rankings_no_gc_by_tier
        out['rankings_no_cp_by_tier'] = rankings_no_cp_by_tier
    return out


def save_published_master_cache(cache_key, result):
    """Write MSY master cache to data/published/ (for Railway deploy)."""
    path = _msy_published_path(cache_key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    payload = {
        'version': _MSY_DISK_VERSION,
        'cache_key': list(cache_key),
        'groups': result.get('groups') or [],
        'total_pilot_candidates': result.get('total_pilot_candidates', 0),
    }
    tmp = path + '.tmp'
    with gzip.open(tmp, 'wt', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, path)
    print(f'MSY published cache saved: {len(payload["groups"])} units ({path})')
    return path


def dc_candidate_pilots_for_unit(uid, pilot_ids, exclude, lc):
    """Prefilter pilots for DC evaluation (same cap as Python build)."""
    uid = _app().normalize_id(uid)
    info = _app().unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not unit_wpn:
        return []
    active = _eligible_pilots_for_unit(uid, pilot_ids, exclude)
    if not active:
        return []
    need = max(_TOP_PILOTS_PREFILTER, 128)
    if len(active) <= _FULL_SIM_PILOT_CAP:
        return list(active)
    cheap_scored = [
        (_cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc), cid)
        for cid in active
    ]
    cheap_scored.sort(key=lambda x: (-x[0], x[1]))
    return [cid for _, cid in cheap_scored[:need]]


def _msy_pilot_ids_from_kwargs(kwargs):
    """Pilot pool for MSY (same filters as build_meta_synergy_rankings)."""
    A = _app()
    pilot_rarity = kwargs.get('pilot_rarity', 'ALL')
    pilot_rarity_filter = (
        None if not pilot_rarity or str(pilot_rarity).upper() == 'ALL'
        else str(pilot_rarity).upper()
    )
    role_raw = kwargs.get('role') if kwargs.get('role') is not None else kwargs.get('unit_role')
    if role_raw is None or str(role_raw).upper() in ('ALL', ''):
        role_filter = None
    else:
        role_filter = A.parse_list_role_filter(str(role_raw))
    pilot_roles = kwargs.get('pilot_roles')
    if isinstance(pilot_roles, str):
        pilot_roles = tuple(x.strip() for x in pilot_roles.split(',') if x.strip()) or None
    pilot_role_set = _pilot_role_set_for_filters(role_filter, pilot_roles)
    pilot_ids = []
    for cid in _pilot_pool_ids():
        info = A.char_info_map.get(cid) or {}
        ri = str(info.get('rarity', '1'))
        role = str(info.get('role', '0'))
        if role not in pilot_role_set:
            continue
        if pilot_rarity_filter and A.RARITY_MAP.get(ri, 'N') != pilot_rarity_filter:
            continue
        pilot_ids.append(cid)
    return pilot_ids


def _msy_dc_kwargs_from_request(args):
    """Normalize Flask request.args (or similar) into MSY kwargs dict."""
    pilot_roles_raw = (args.get('pilot_roles') or '').strip()
    pilot_roles = (
        tuple(x.strip() for x in pilot_roles_raw.split(',') if x.strip())
        if pilot_roles_raw else None
    )
    exclude_pairs = []
    for part in (args.get('exclude') or '').split(';'):
        part = part.strip()
        if not part or ':' not in part:
            continue
        uid, cid = part.split(':', 1)
        if uid.strip() and cid.strip():
            exclude_pairs.append((uid.strip(), cid.strip()))
    return {
        'lc': args.get('lang', 'EN'),
        'unit_rarity': args.get('unit_rarity', 'ALL'),
        'unit_role': args.get('unit_role', 'ALL'),
        'rarity': (args.get('rarity') or '').strip() or None,
        'role': (args.get('role') or '').strip() or None,
        'series_id': (args.get('series_id') or '').strip() or None,
        'series_op': (args.get('series_op') or '').strip() or None,
        'source': (args.get('source') or '').strip() or None,
        'lineage_id': (args.get('lineage_id') or '').strip() or None,
        'lineage_op': (args.get('lineage_op') or '').strip() or None,
        'pilot_rarity': args.get('pilot_rarity', 'ALL'),
        'pilot_roles': pilot_roles,
        'metric': args.get('metric', 'super_crit'),
        'vigor': args.get('vigor', 'super'),
        'lb_tier': int(args.get('lb_tier', '3') or 3),
        'def_tier': int(args.get('def_tier', '3') or 3),
        'top_pilots': int(args.get('top_pilots', '10') or 10),
        'rank_mode': (args.get('rank_mode') or 'super_crit').strip() or 'super_crit',
        'unit_q': args.get('unit_q', '') or '',
        'exclude_pairs': exclude_pairs or None,
        'same_role_only': args.get('same_role_only', '0') in ('1', 'true', 'yes'),
        'cp_on': args.get('cp_on', '1') not in ('0', 'false', 'no', ''),
        'pep_on': args.get('pep_on', '1') not in ('0', 'false', 'no', ''),
    }


def _dc_pairs_from_json(raw):
    """Convert client pairs_by_tier JSON to {int: [(cid, vigor_dict), ...]}."""
    if not raw:
        return {}
    out = {}
    for dt, pairs in raw.items():
        py_pairs = []
        for item in pairs or []:
            if not isinstance(item, (list, tuple)) or len(item) < 2:
                continue
            cid, by_vigor = item[0], item[1]
            if by_vigor:
                py_pairs.append((str(cid), dict(by_vigor)))
        if py_pairs:
            out[int(dt)] = py_pairs
    return out


def _msy_dc_cache_version(lc):
    """Version stamp for browser IndexedDB MSY cache invalidation."""
    A = _app()
    root = _msy_app_root()
    parts = [
        str(lc or 'EN'),
        str(len(getattr(A, 'char_info_map', {}) or {})),
        str(len(getattr(A, 'unit_info_map', {}) or {})),
    ]
    for rel in (
        'static/js/app.js',
        'static/js/msy_dc_engine.js',
        'static/js/msy_dc_worker.js',
        'static/js/msy_idb_cache.js',
    ):
        p = os.path.join(root, rel)
        try:
            st = os.stat(p)
            parts.append(f'{rel}:{st.st_mtime_ns}:{st.st_size}')
        except OSError:
            parts.append(f'{rel}:0')
    si = _msy_sort_index_path(lc)
    try:
        if os.path.isfile(si):
            parts.append(str(os.stat(si).st_mtime_ns))
    except OSError:
        pass
    return hashlib.sha256('|'.join(parts).encode('utf-8')).hexdigest()[:16]


def dc_bootstrap_payload(kwargs):
    """Bootstrap data for in-browser MSY DC rankings."""
    lc = kwargs.get('lc', 'EN')
    browse = _parse_browse_filters(kwargs, lc)
    unit_q = kwargs.get('unit_q', '') or ''
    unit_ids = _filtered_rankable_unit_ids(lc, browse, unit_q)
    pilot_ids = _msy_pilot_ids_from_kwargs(kwargs)
    browse_active = _browse_filters_active(browse, unit_q)
    dt = max(1, min(4, int(kwargs.get('def_tier') or 3)))
    role_raw = kwargs.get('role') if kwargs.get('role') is not None else kwargs.get('unit_role')
    unit_ids.sort(
        key=lambda uid: (
            -_cheap_unit_peak_score(uid, lc, kwargs),
            _app().normalize_id(uid),
        ),
    )
    return {
        'engine': 'dc',
        'unit_ids': unit_ids,
        'total': len(unit_ids),
        'pilot_ids': [str(x) for x in pilot_ids],
        'total_pilot_candidates': len(pilot_ids),
        'cache_version': _msy_dc_cache_version(lc),
        'defender_tiers': defender_tiers_public(),
        'filtered_browse': browse_active,
        'def_tier': dt,
        'metric': kwargs.get('metric', 'super_crit'),
        'settings': {
            'unit_rarity': kwargs.get('rarity') or kwargs.get('unit_rarity') or 'ALL',
            'unit_role': role_raw,
            'series_id': kwargs.get('series_id') or '',
            'source': kwargs.get('source') or '',
            'lineage_id': kwargs.get('lineage_id') or '',
            'lineage_op': kwargs.get('lineage_op') or '',
            'pilot_rarity': kwargs.get('pilot_rarity', 'ALL'),
            'pilot_roles': list(_pilot_role_set_for_filters(
                browse.get('role_filter'),
                kwargs.get('pilot_roles'),
            )),
            'same_role_only': bool(kwargs.get('same_role_only')),
            'lb_tier': int(kwargs.get('lb_tier', 3) or 3),
            'def_tier': dt,
            'defender_note': _settings_note(dt),
        },
    }


def unit_is_rankable(uid, lc='EN'):
    """Whether a single unit has a sim-eligible best weapon."""
    A = _app()
    lc = lc or A.DEFAULT_LANG
    uid = A.normalize_id(uid)
    if uid not in A.unit_list_playable_ids:
        return False
    info = A.unit_info_map.get(uid)
    if not info:
        return False
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    return bool(_cached_best_ex_weapon(uid, stat_mode, lc))


def unit_best_synergy_pilots_bootstrap_payload(unit_id, kwargs):
    """Bootstrap for per-unit Best Synergy Pilot panel (one unit × filtered pilots)."""
    lc = kwargs.get('lc', 'EN')
    uid = _app().normalize_id(unit_id)
    if not unit_is_rankable(uid, lc):
        return {'eligible': False, 'unit_id': uid}
    pilot_ids = _msy_pilot_ids_from_kwargs(kwargs)
    candidates = dc_candidate_pilots_for_unit(uid, pilot_ids, set(), lc)
    return {
        'eligible': True,
        'unit_id': uid,
        'defender_tiers': defender_tiers_public(),
        'pilot_ids': candidates,
        'def_tier': max(1, min(4, int(kwargs.get('def_tier') or 3))),
    }


def dc_candidates_payload(unit_id, kwargs):
    """Pilot candidate IDs for one unit (DC prefilter)."""
    lc = kwargs.get('lc', 'EN')
    pilot_ids = _msy_pilot_ids_from_kwargs(kwargs)
    exclude = _exclude_set_from_kwargs(kwargs)
    uid = _app().normalize_id(unit_id)
    candidates = dc_candidate_pilots_for_unit(uid, pilot_ids, exclude, lc)
    return {'unit_id': uid, 'pilot_ids': candidates}


def dc_candidates_batch_payload(unit_ids, kwargs):
    """Pilot candidates for multiple units (one round-trip)."""
    out = {}
    for raw_uid in unit_ids or []:
        uid = _app().normalize_id(raw_uid)
        if not uid:
            continue
        row = dc_candidates_payload(uid, kwargs)
        out[uid] = row.get('pilot_ids') or []
    return {'candidates': out}


def dc_page_shells_payload(unit_ids, kwargs):
    """Instant index-only rows for a page of units (Soshage-style lazy fill)."""
    lc = kwargs.get('lc', 'EN')
    rank_mode = kwargs.get('rank_mode', 'super_crit') or 'super_crit'
    def_tier = max(1, min(4, int(kwargs.get('def_tier') or 3)))
    sort_index = _ensure_msy_sort_damage_index(lc)
    groups = []
    for raw_uid in unit_ids or []:
        uid = _app().normalize_id(raw_uid)
        if not uid:
            continue
        shell = _index_shell_group_for_uid(
            uid, lc, kwargs, rank_mode, def_tier, sort_index=sort_index,
        )
        shell = dict(shell)
        shell['pending'] = True
        groups.append(shell)
    return {'groups': groups}


def dc_assemble_payload(unit_id, pairs_by_tier, kwargs, *, pairs_by_tier_no_cp=None):
    """Assemble one MSY unit group from client DC pair results."""
    lc = kwargs.get('lc', 'EN')
    pilot_ids = _msy_pilot_ids_from_kwargs(kwargs)
    exclude = _exclude_set_from_kwargs(kwargs)
    top_pilots = int(kwargs.get('top_pilots') or 10)
    rank_mode = kwargs.get('rank_mode', 'super_crit') or 'super_crit'
    def_tier = max(1, min(4, int(kwargs.get('def_tier') or 3)))
    same_role_only = bool(kwargs.get('same_role_only'))
    uid = _app().normalize_id(unit_id)
    by_tier = _dc_pairs_from_json(pairs_by_tier)
    by_tier_no_cp = _dc_pairs_from_json(pairs_by_tier_no_cp) if pairs_by_tier_no_cp else None
    if not by_tier:
        return None
    g = assemble_unit_group_from_dc(
        uid, by_tier, pilot_ids, lc, top_pilots, exclude,
        pairs_by_tier_no_cp=by_tier_no_cp,
        same_role_only=same_role_only,
    )
    if not g:
        return None
    g = _ensure_passive_variant_for_request(g, lc, rank_mode, def_tier, kwargs)
    g = _backfill_pilot_formula_stats(g, lc, rank_mode, kwargs)
    row = _group_for_def_tier(g, def_tier) if g.get('rankings_by_tier') else g
    if not row:
        return None
    return _normalize_group_for_mode(row, rank_mode) or row


def _msy_build_worker_init(ctx):
    """Load app once per process worker (Windows spawn-safe)."""
    os.environ.setdefault('MSY_ALLOW_PYTHON_BUILD', '1')
    import app  # noqa: F401
    global _BUILD_POOL_CTX
    _BUILD_POOL_CTX = ctx


def _msy_build_worker_unit(uid):
    ctx = _BUILD_POOL_CTX
    return _build_single_unit_group(
        uid, ctx['pilot_ids'], ctx['lc'], ctx['lb_tier'], 'super', 1,
        ctx['exclude'], ctx['top_pilots'], 'super_crit',
        def_unit_override=ctx.get('def_unit_override'),
        def_char_override=ctx.get('def_char_override'),
        def_tiers=ctx.get('def_tiers'),
        publish_build=bool(ctx.get('publish_build')),
    )


def _build_all_unit_groups(unit_ids, pilot_ids, lc, lb_tier, vigor, def_tier, exclude, top_pilots, metric, *,
                             def_unit_override=None, def_char_override=None, def_tiers=None,
                             on_progress=None, publish_build=False, use_processes=None):
    if not unit_ids:
        return []
    groups = []
    use_proc = _MSY_USE_PROCESS_BUILD if use_processes is None else bool(use_processes)
    workers = min(_MSY_BUILD_WORKERS, max(1, len(unit_ids)))
    build_kw = dict(
        pilot_ids=pilot_ids, lc=lc, lb_tier=lb_tier, exclude=exclude, top_pilots=top_pilots,
        def_unit_override=def_unit_override, def_char_override=def_char_override,
        def_tiers=def_tiers, publish_build=publish_build,
    )

    def _maybe_progress():
        if on_progress and groups:
            on_progress(list(groups))

    if use_proc and workers > 1:
        ctx = {
            'pilot_ids': list(pilot_ids),
            'lc': lc,
            'lb_tier': lb_tier,
            'exclude': set(exclude or ()),
            'top_pilots': top_pilots,
            'def_unit_override': def_unit_override,
            'def_char_override': def_char_override,
            'def_tiers': def_tiers,
            'publish_build': publish_build,
        }
        with ProcessPoolExecutor(
            max_workers=workers,
            initializer=_msy_build_worker_init,
            initargs=(ctx,),
        ) as ex:
            futs = {ex.submit(_msy_build_worker_unit, uid): uid for uid in unit_ids}
            for fut in as_completed(futs):
                try:
                    g = fut.result()
                    if g:
                        groups.append(g)
                        _maybe_progress()
                except Exception as e:
                    print(f'MSY unit build error ({futs.get(fut)}): {e}')
        _maybe_progress()
        return groups

    if workers <= 1:
        for uid in unit_ids:
            try:
                g = _build_single_unit_group(
                    uid, pilot_ids, lc, lb_tier, vigor, def_tier, exclude, top_pilots, metric,
                    def_unit_override=def_unit_override, def_char_override=def_char_override,
                    def_tiers=def_tiers, publish_build=publish_build,
                )
                if g:
                    groups.append(g)
                    _maybe_progress()
            except Exception as e:
                print(f'MSY unit build error: {e}')
        return groups
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [
            ex.submit(
                _build_single_unit_group, uid, pilot_ids, lc, lb_tier, vigor,
                def_tier, exclude, top_pilots, metric,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
                def_tiers=def_tiers, publish_build=publish_build,
            )
            for uid in unit_ids
        ]
        for fut in as_completed(futs):
            try:
                g = fut.result()
                if g:
                    groups.append(g)
                    _maybe_progress()
            except Exception as e:
                print(f'MSY unit build error: {e}')
    _maybe_progress()
    return groups


def _entity_brief_unit(uid, lc, role_filter=None):
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    if role_filter:
        uid = A._unit_role_filter_display_id(uid, info, role_filter)
        info = A.unit_info_map.get(uid) or info
    ri = str(info.get('rarity', '1'))
    thum = A.find_list_thumb(info.get('resource_ids', []), uid, 'images/unit_portraits')
    return {
        'id': uid,
        'name': _resolve_unit_name(uid, lc),
        'thum': thum or '',
        'rarity': A.RARITY_MAP.get(ri, 'N'),
        'rarity_id': ri,
        'rarity_icon': A.RARITY_ICON_MAP.get(ri, ''),
        'role': A.resolve_role_label(info.get('role', '0'), lc),
        'role_id': str(info.get('role', '0')),
        'role_icon': A.ROLE_ICON_MAP.get(str(info.get('role', '0')), ''),
        'is_ultimate': bool(info.get('is_ultimate', False)),
    }


def _entity_brief_char(cid, lc):
    A = _app()
    cid = A.normalize_id(cid)
    info = A.char_info_map.get(cid) or {}
    ri = str(info.get('rarity', '1'))
    portrait = A.find_portrait(info.get('resource_ids', []), cid, 'images/portraits')
    thum = A.find_list_thumb(info.get('resource_ids', []), cid, 'images/portraits') or portrait
    return {
        'id': cid,
        'name': _resolve_char_name(cid, lc),
        'thum': thum or '',
        'portrait': portrait or thum or '',
        'rarity': A.RARITY_MAP.get(ri, 'N'),
        'rarity_id': ri,
        'rarity_icon': A.RARITY_ICON_MAP.get(ri, ''),
        'role': A.resolve_role_label(info.get('role', '0'), lc),
        'role_id': str(info.get('role', '0')),
        'role_icon': A.ROLE_ICON_MAP.get(str(info.get('role', '0')), ''),
    }


def _weapon_elem_label(uid, lc):
    stat_mode = _unit_stat_mode((_app().unit_info_map.get(_app().normalize_id(uid)) or {}).get('rarity', '1'))
    wpn = _best_ex_weapon(uid, stat_mode, lc)
    if not wpn:
        return ''
    attr = str((wpn.get('wm') or {}).get('attack_attribute', '1') or '1')
    return {'1': 'Beam', '2': 'Physical', '3': 'Special', '7': 'Special'}.get(attr, 'Mixed')


_WPN_TYPE_LABEL = {'1': 'Normal', '2': 'Active', '3': 'Map'}
_SKILL_AUTO_ACTIVE_RE = re.compile(r'(?:damage\s+dealt|造成的損傷|傷害|ダメージ)', re.I)
_AWAKEN_BOOST_SKILL_ID_RE = re.compile(r'^200170[1-5]01$')


def _msy_skill_relevant_for_sim(blob, sid='', name=''):
    """Skills that MSY damage sim auto-applies at max level (display + active flags)."""
    text = str(blob or '')
    if _SKILL_DMG_RE.search(text) or _SKILL_ATK_RE.search(text):
        return True
    sid = str(sid or '').strip()
    if sid and _AWAKEN_BOOST_SKILL_ID_RE.match(sid):
        return True
    nm = str(name or '')
    if re.search(r'awaken\s+boost|覺醒值增幅|覚醒ブースト', nm, re.I):
        return True
    return False


@lru_cache(maxsize=2048)
def _weapon_info_for_msy(uid, lc):
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not wpn:
        return None
    wm = wpn.get('wm') or {}
    ld = _ldc(lc)
    wid = wpn.get('wid')
    wn = ld.get('weapon_text_map', {}).get(wm.get('name_lang_id', '0'), 'Unknown')
    ai = wm.get('attribute', '0')
    attr_label = A.resolve_weapon_attribute_label(ai, ld)
    at = A.resolve_attack_attribute_types(wm.get('attack_attribute', '0'), ld)
    wt = str(wm.get('weapon_type', '1') or '1')
    attack_types = [str(x.get('label') or '').strip() for x in (at or []) if x.get('label')]
    return {
        'id': wid,
        'name': wn,
        'weapon_type': _WPN_TYPE_LABEL.get(wt, wt),
        'attribute': attr_label,
        'attack_types': attack_types,
        'power': int(wpn.get('power') or 0),
        'level': int(wpn.get('wpn_lv', 0) or 0) + 1,
    }


@lru_cache(maxsize=8192)
def _msy_auto_active_skill_ids(cid, lc):
    """Auto-enable max-LV sim-relevant skills (resolved text — SP mode uses SP skill copy)."""
    stat_mode = _msy_char_stat_mode(cid)
    rows = _msy_char_skill_rows(cid, lc)
    by_base = {}
    for row in _msy_pilot_skills_visible(stat_mode, rows):
        sid = row['id']
        rsk = _msy_resolve_skill_for_mode(row, rows, stat_mode)
        name = str(rsk.get('name') or '')
        base = _msy_skill_base_name(name)
        blob = _msy_skill_blob(rsk)
        if not _msy_skill_relevant_for_sim(blob, sid, name):
            continue
        lv = _msy_skill_lv_from_name(name)
        prev = by_base.get(base)
        if not prev or lv > prev[0]:
            by_base[base] = (lv, sid)
    return {sid for _, sid in by_base.values()}


@lru_cache(maxsize=8192)
def _msy_pilot_active_skills(cid, lc):
    stat_mode = _msy_char_stat_mode(cid)
    rows = _msy_char_skill_rows(cid, lc)
    active_ids = _msy_auto_active_skill_ids(cid, lc)
    out = []
    seen_base = set()
    for row in _msy_pilot_skills_visible(stat_mode, rows):
        sid = row['id']
        rsk = _msy_resolve_skill_for_mode(row, rows, stat_mode)
        name = str(rsk.get('name') or '')
        base = _msy_skill_base_name(name)
        blob = _msy_skill_blob(rsk)
        if not _msy_skill_relevant_for_sim(blob, sid, name):
            continue
        if base in seen_base:
            continue
        seen_base.add(base)
        details = []
        for x in (rsk.get('details') or []):
            if isinstance(x, dict):
                t = str(x.get('text') or '').strip()
            else:
                t = str(x or '').strip()
            if t:
                details.append(t)
        desc = str(rsk.get('desc') or '').strip()
        if desc and desc not in details:
            details.insert(0, desc)
        out.append({
            'id': sid,
            'name': name,
            'icon': rsk.get('icon') or '',
            'active': sid in active_ids,
            'level': _msy_skill_lv_from_name(name) or None,
            'desc': desc or (details[0] if details else ''),
            'details': details,
        })
    return out


_MSY_ALL_PILOT_ROLES = ('1', '2', '3')
_MSY_STD_DEF_TIERS = (1, 2, 3)


def _pilot_role_set_for_filters(role_filter, pilot_roles):
    """Pilot pool must match unit role filter (same as Units browse tab)."""
    if pilot_roles is not None:
        explicit = {str(r) for r in pilot_roles if str(r).strip()}
        if explicit:
            return explicit
    if role_filter is not None:
        if not role_filter:
            return set()
        return {str(r) for r in role_filter}
    return {str(r) for r in _MSY_ALL_PILOT_ROLES}


@lru_cache(maxsize=1)
def _pilot_pool_ids():
    return tuple(sorted(_app().char_list_playable_ids))


def _settings_note(def_tier, *, def_unit_override=None, def_char_override=None):
    return ''


def build_meta_synergy_rankings(
    lc='EN',
    *,
    unit_rarity='ALL',
    unit_role='ALL',
    rarity=None,
    role=None,
    series_id=None,
    source=None,
    lineage_id=None,
    lineage_op=None,
    pilot_rarity='ALL',
    pilot_roles=None,
    metric='super_crit',
    vigor='super',
    lb_tier=3,
    def_tier=1,
    def_unit_override=None,
    def_char_override=None,
    top_pilots=20,
    page=1,
    per_page=50,
    exclude_pairs=None,
    unit_q='',
):
    A = _app()
    lc = lc or A.DEFAULT_LANG
    exclude = set()
    for p in exclude_pairs or []:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            exclude.add((A.normalize_id(p[0]), A.normalize_id(p[1])))
    pilot_rarity_filter = None if not pilot_rarity or pilot_rarity.upper() == 'ALL' else pilot_rarity.upper()

    rarity_raw = (rarity if rarity is not None else unit_rarity) or ''
    if str(rarity_raw).upper() in ('ALL', ''):
        rarity_filter = None
    elif ',' in str(rarity_raw) or str(rarity_raw).upper() in ('LT', 'ULT', 'NLT', '__NONE__'):
        rarity_filter = A.parse_list_rarity_filter(str(rarity_raw))
    elif str(rarity_raw).upper() in A.RARITY_LETTERS:
        rarity_filter = A.parse_list_rarity_filter(str(rarity_raw).upper())
    else:
        rarity_filter = None

    role_raw = role if role is not None else unit_role
    if role_raw is None or str(role_raw).upper() in ('ALL', ''):
        role_filter = None
    else:
        role_filter = A.parse_list_role_filter(str(role_raw))

    pilot_role_set = _pilot_role_set_for_filters(role_filter, pilot_roles)

    series_filter = A.parse_list_series_filter(series_id or '')
    source_filter = A.parse_list_source_filter(source or '')
    lineage_filter = A.parse_list_lineage_filter(lineage_id or '')
    lineage_combine = A.normalize_filter_combine_op(lineage_op or 'and', 'and')

    unit_rows = []
    for uid in sorted(A.unit_list_playable_ids):
        info = A.unit_info_map.get(uid)
        if not info:
            continue
        ri = str(info.get('rarity', '1'))
        role_id = str(info.get('role', '0'))
        if role_filter is not None:
            if not role_filter:
                continue
            if not A.unit_matches_role_filter(uid, info, role_filter):
                continue
        if rarity_filter is not None:
            if not rarity_filter:
                continue
            letter = A.RARITY_MAP.get(ri, 'N')
            lim = uid in A.LIMITED_TIME_UNIT_IDS
            if not A.row_matches_rarity_filter(
                rarity_filter, letter, lim, bool(info.get('is_ultimate', False)),
            ):
                continue
        acq_route = str(info.get('acquisition_route', '0'))
        if source_filter is not None:
            if not A.entity_matches_source_category(acq_route, role_id, source_filter):
                continue
        if series_filter is not None:
            if not A.entity_matches_series(_unit_series_set_id(uid, info), series_filter, lc):
                continue
        if lineage_filter is not None:
            if not A.entity_matches_lineage(A.unit_lin_map, uid, lineage_filter, lineage_combine):
                continue
        if not _cached_best_ex_weapon(uid, _unit_stat_mode(ri), lc):
            continue
        unit_rows.append(uid)

    pilot_ids = []
    for cid in _pilot_pool_ids():
        info = A.char_info_map.get(cid) or {}
        ri = str(info.get('rarity', '1'))
        role = str(info.get('role', '0'))
        if role not in pilot_role_set:
            continue
        if pilot_rarity_filter and A.RARITY_MAP.get(ri, 'N') != pilot_rarity_filter:
            continue
        pilot_ids.append(cid)

    sim_units = unit_rows
    if len(unit_rows) > _PREFILTER_THRESHOLD:
        sim_units = _prefilter_unit_ids(
            unit_rows, pilot_ids, lc, lb_tier, vigor, def_tier, exclude,
            def_unit_override=def_unit_override, def_char_override=def_char_override,
        )

    use_multi_tier = (
        not def_unit_override
        and not def_char_override
    )
    def_tiers = _MSY_STD_DEF_TIERS if use_multi_tier else None

    groups = _build_all_unit_groups(
        sim_units, pilot_ids, lc, lb_tier, vigor, def_tier, exclude, top_pilots, metric,
        def_unit_override=def_unit_override, def_char_override=def_char_override,
        def_tiers=def_tiers,
    )

    dt = max(1, min(4, int(def_tier or 1)))
    display_groups = groups
    if use_multi_tier:
        display_groups = [_group_for_def_tier(g, dt) for g in groups]
        display_groups = [g for g in display_groups if g]

    display_groups.sort(
        key=lambda g: (
            -((g.get('rankings') or {}).get('super_crit', {}).get('max_damage', g.get('max_damage', 0))),
            (g.get('unit') or {}).get('name', '').lower(),
        ),
    )
    total = len(display_groups)
    page = max(1, int(page or 1))
    per_page = max(1, min(100, int(per_page or 50)))
    start = (page - 1) * per_page
    page_groups = display_groups[start:start + per_page]
    total_pages = max(1, (total + per_page - 1) // per_page)

    return {
        'groups': page_groups,
        'all_groups': groups if use_multi_tier else display_groups,
        'total': total,
        'total_pilot_candidates': len(pilot_ids),
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
        'metric': metric,
        'vigor': vigor,
        'def_tier': dt,
        'defender_tiers': defender_tiers_public(),
        'settings': {
            'unit_rarity': rarity_raw,
            'unit_role': role_raw,
            'series_id': series_id or '',
            'source': source or '',
            'lineage_id': lineage_id or '',
            'lineage_op': lineage_op or '',
            'pilot_rarity': pilot_rarity,
            'pilot_roles': list(pilot_role_set),
            'same_role_only': False,
            'lb_tier': lb_tier,
            'def_tier': dt,
            'def_unit_override': def_unit_override,
            'def_char_override': def_char_override,
            'defender_note': _settings_note(
                dt, def_unit_override=def_unit_override, def_char_override=def_char_override,
            ),
        },
    }


def _group_for_def_tier(g, def_tier):
    """Expand a multi-tier group blob into a single-tier view for sorting/display."""
    if not g:
        return None
    dt = int(def_tier or 1)
    rbt = g.get('rankings_by_tier')
    if not rbt:
        return g
    rankings = rbt.get(dt) or rbt.get(str(dt))
    if not rankings:
        return None
    rnub = (g.get('rankings_no_ur_by_tier') or {}).get(dt) or (g.get('rankings_no_ur_by_tier') or {}).get(str(dt))
    rnsh = (g.get('rankings_no_shinn_by_tier') or {}).get(dt) or (g.get('rankings_no_shinn_by_tier') or {}).get(str(dt))
    rngc = (g.get('rankings_no_gc_by_tier') or {}).get(dt) or (g.get('rankings_no_gc_by_tier') or {}).get(str(dt))
    rncp = (g.get('rankings_no_cp_by_tier') or {}).get(dt) or (g.get('rankings_no_cp_by_tier') or {}).get(str(dt))
    rnpep = (g.get('rankings_no_pep_by_tier') or {}).get(dt) or (g.get('rankings_no_pep_by_tier') or {}).get(str(dt))
    rncp_pep = (g.get('rankings_no_cp_pep_by_tier') or {}).get(dt) or (g.get('rankings_no_cp_pep_by_tier') or {}).get(str(dt))
    primary = rankings.get('super_crit') or rankings.get('crit') or rankings.get('normal')
    if not primary:
        return None
    return {
        'unit': g.get('unit'),
        'weapon_elems': g.get('weapon_elems'),
        'weapon_info': g.get('weapon_info'),
        'rankings': rankings,
        'rankings_no_ur': rnub or rankings,
        'rankings_no_shinn': rnsh or g.get('rankings_no_shinn') or rankings,
        'rankings_no_gc': rngc or g.get('rankings_no_gc') or rankings,
        'rankings_no_cp': rncp or g.get('rankings_no_cp') or rankings,
        'rankings_no_pep': rnpep or g.get('rankings_no_pep') or rankings,
        'rankings_no_cp_pep': rncp_pep or g.get('rankings_no_cp_pep') or rankings,
        'max_damage': primary.get('max_damage', 0),
        'metric': g.get('metric'),
        'pilots': primary.get('pilots') or [],
        'is_sd': g.get('is_sd', False),
        'bundled_pilot_id': g.get('bundled_pilot_id'),
    }


def _expand_unit_search_query(q):
    s = (q or '').strip()
    if not s:
        return ''
    import re
    s = re.sub(r'\bdevil\s+gundam\b', 'dark gundam', s, flags=re.I)
    s = re.sub(r'\bfatb\b', 'full armor gundam thunderbolt', s, flags=re.I)
    s = re.sub(r'\bsf\b', 'strike freedom', s, flags=re.I)
    s = re.sub(r'\bgod\b', 'burning gundam', s, flags=re.I)
    return s.strip()


def _unit_matches_q(uid, info, unit_q, lc):
    sq = _expand_unit_search_query(unit_q).lower()
    if not sq:
        return True
    A = _app()
    uid = A.normalize_id(uid)
    ld = _ldc(lc)
    lid = ld.get('unit_id_map', {}).get(uid, '')
    name = ld.get('unit_text_map', {}).get(lid, '') if lid else ''
    if not name:
        name = f'Unknown ({uid})'
    ser_list = A.resolve_series(_unit_series_set_id(uid, info), lc)
    ser_names_lower = A.series_names_lower_for_search(ser_list)
    alias_h = ' '.join(A.series_alias_tokens_for_haystack(ser_list))
    ss = (
        f'{name} {uid} '
        + ' '.join([t['name'] for t in A.resolve_tags(A.unit_lin_map, uid, lc, 'unit')])
        + ' '
        + ' '.join([s['name'] for s in ser_list])
        + ' '
        + alias_h
    ).strip()
    extra = getattr(A, 'UNIT_SEARCH_HAYSTACK_EXTRA_BY_ID', {}).get(uid, '')
    ss = (ss + extra).strip().lower()
    return A.search_row_matches_query(
        sq, ss, ser_names_lower, ser_list, entity_id=uid, primary=True,
    )


def _filter_groups_by_unit_q(groups, unit_q, lc):
    if not (unit_q or '').strip():
        return groups
    out = []
    for g in groups:
        u = g.get('unit') or {}
        uid = u.get('id')
        info = _app().unit_info_map.get(_app().normalize_id(uid)) if uid else None
        if uid and info and _unit_matches_q(uid, info, unit_q, lc):
            out.append(g)
    return out


def _browse_request_active(browse, unit_q):
    """Browse filters only — text search (unit_q) filters the master cache in memory."""
    return any(
        browse.get(k) is not None
        for k in ('role_filter', 'rarity_filter', 'series_filter', 'source_filter', 'lineage_filter')
    )


def _msy_rankable_unit_ids(lc='EN'):
    """Playable units with a sim-eligible weapon (non-map, max power)."""
    A = _app()
    lc = lc or A.DEFAULT_LANG
    out = []
    for uid in sorted(A.unit_list_playable_ids):
        info = A.unit_info_map.get(uid)
        if not info:
            continue
        stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
        if _cached_best_ex_weapon(uid, stat_mode, lc):
            out.append(uid)
    return out


def _msy_default_master_unit_ids(lc='EN'):
    """Default bundled master cache: units whose best weapon is an active skill (EX meta pool)."""
    A = _app()
    lc = lc or A.DEFAULT_LANG
    out = []
    for uid in _msy_rankable_unit_ids(lc):
        info = A.unit_info_map.get(uid) or {}
        stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
        wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
        if wpn and str(wpn.get('weapon_type', '1') or '1') == '2':
            out.append(uid)
    return out


def _filtered_rankable_unit_ids(lc, browse, unit_q=''):
    ids = []
    for uid in _msy_rankable_unit_ids(lc):
        info = _app().unit_info_map.get(uid)
        if not info:
            continue
        if not _unit_passes_browse_filters(uid, info, lc, browse):
            continue
        if not _unit_matches_q(uid, info, unit_q, lc):
            continue
        ids.append(uid)
    return ids


def _exclude_set_from_kwargs(kwargs):
    exclude = set()
    for p in kwargs.get('exclude_pairs') or []:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            exclude.add((_app().normalize_id(p[0]), _app().normalize_id(p[1])))
    return exclude


def _cheap_unit_peak_score(uid, lc, kwargs):
    """Fast unit sort key for filtered browse (weapon power × unit ATK)."""
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not wpn:
        return 0
    block = A._unit_max_lb_stat_block(uid, info, A.unit_stat_map.get(uid, {}), _ldc(lc))
    if not block:
        return 0
    fs = A._unit_lb_row_to_api(block, stat_mode, True)
    unit_atk = float(fs.get('ATK', 0) or 0)
    return unit_atk * float(wpn.get('power') or 0)


def _unit_browse_sort_damage(g, rank_mode, def_tier=None):
    """Peak damage for a unit group in the active rank mode (for browse ordering)."""
    if not g:
        return 0
    row = g
    if def_tier and g.get('rankings_by_tier'):
        row = _group_for_def_tier(g, def_tier) or g
    rk = row.get('rankings') or {}
    block = rk.get(rank_mode) or rk.get('super_crit') or rk.get('crit') or rk.get('normal') or {}
    return block.get('max_damage') or row.get('max_damage') or 0


_CHEAP_SCORE_TO_DAMAGE = 480.0
_MSY_ORDER_PREBUILD_LIMIT = 0


def _msy_sort_index_path(lc):
    return os.path.join(_msy_app_root(), 'data', 'published', f'msy_sort_index_{lc or "EN"}.json.gz')


def _load_msy_sort_index_from_disk(lc):
    path = _msy_sort_index_path(lc)
    if not os.path.isfile(path):
        return None
    try:
        with gzip.open(path, 'rt', encoding='utf-8') as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return None
        A = _app()
        return {A.normalize_id(k): int(v or 0) for k, v in data.items()}
    except Exception as e:
        print(f'MSY sort index load failed ({path}): {e}')
        return None


def _build_msy_sort_damage_index(lc, master_groups=None):
    """Precompute per-unit browse sort keys (sim peak when cached, else weapon×ATK proxy)."""
    A = _app()
    lc = lc or A.DEFAULT_LANG
    idx = {}
    for g in master_groups or []:
        uid = A.normalize_id((g.get('unit') or {}).get('id'))
        if not uid:
            continue
        dm = _unit_browse_sort_damage(g, 'super_crit', None) or g.get('max_damage') or 0
        if dm:
            idx[uid] = int(dm)
    for uid in _msy_rankable_unit_ids(lc):
        uid = A.normalize_id(uid)
        if uid in idx:
            continue
        idx[uid] = int(_cheap_unit_peak_score(uid, lc, {}) / _CHEAP_SCORE_TO_DAMAGE)
    return idx


def _ensure_msy_sort_damage_index(lc='EN', master_groups=None):
    lc = lc or 'EN'
    with _MSY_SORT_DAMAGE_INDEX_LOCK:
        cached = _MSY_SORT_DAMAGE_INDEX.get(lc)
        if cached is not None:
            return cached
    disk = _load_msy_sort_index_from_disk(lc)
    if disk is not None:
        with _MSY_SORT_DAMAGE_INDEX_LOCK:
            _MSY_SORT_DAMAGE_INDEX[lc] = disk
            return disk
    idx = _build_msy_sort_damage_index(lc, master_groups)
    with _MSY_SORT_DAMAGE_INDEX_LOCK:
        _MSY_SORT_DAMAGE_INDEX[lc] = idx
        return idx


def save_published_sort_index(lc='EN', master_groups=None):
    """Write browse sort index for instant filtered MSY browse (no per-request scoring)."""
    lc = lc or 'EN'
    idx = _build_msy_sort_damage_index(lc, master_groups)
    path = _msy_sort_index_path(lc)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with gzip.open(path, 'wt', encoding='utf-8') as f:
        json.dump(idx, f, separators=(',', ':'))
    with _MSY_SORT_DAMAGE_INDEX_LOCK:
        _MSY_SORT_DAMAGE_INDEX[lc] = idx
    return path


def _estimate_uncached_unit_damage(uid, lc, kwargs, *, sort_index=None):
    """Rough super-crit peak proxy for units not yet in the master cache."""
    if sort_index is None:
        sort_index = _ensure_msy_sort_damage_index(lc)
    return sort_index.get(_app().normalize_id(uid), 0)


def _ordered_unit_ids_for_browse(unit_ids, master_groups, lc, kwargs, rank_mode, def_tier=None,
                                   *, browse=None, unit_q=''):
    A = _app()
    same_role_only = _same_role_only_from_kwargs(kwargs)
    by_uid = {}
    for g in master_groups or []:
        uid = A.normalize_id((g.get('unit') or {}).get('id'))
        if uid:
            by_uid[uid] = g

    browse_active = _browse_filters_active(browse or {}, unit_q)
    sort_index = _ensure_msy_sort_damage_index(lc, master_groups) if browse_active else None

    if not browse_active:
        cached_scored = []
        uncached_ids = []
        for uid in unit_ids:
            uid = A.normalize_id(uid)
            g = by_uid.get(uid)
            if g:
                cached_scored.append((_unit_browse_sort_damage(g, rank_mode, def_tier), uid))
            else:
                uncached_ids.append(uid)
        cached_scored.sort(key=lambda x: (-x[0], x[1]))
        return [uid for _, uid in cached_scored] + uncached_ids

    scored = []
    for uid in unit_ids:
        uid = A.normalize_id(uid)
        g = by_uid.get(uid)
        if g:
            sc = _unit_browse_sort_damage(g, rank_mode, def_tier)
        else:
            sc = sort_index.get(uid, 0)
        scored.append((sc, uid))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [uid for _, uid in scored]


def _browse_filters_active(browse, unit_q=''):
    if (unit_q or '').strip():
        return True
    for k in ('role_filter', 'rarity_filter', 'series_filter', 'source_filter', 'lineage_filter'):
        if browse.get(k) is not None:
            return True
    return False


def _resolve_groups_for_unit_ids(unit_ids, master_groups, lc, kwargs, *, browse_fast=False, def_tier=3,
                                   max_build=None, page_build_lite=False, build_budget_sec=None,
                                   rank_mode='super_crit', unit_q=''):
    A = _app()
    same_role_only = _same_role_only_from_kwargs(kwargs)
    browse = _parse_browse_filters(kwargs, lc)
    browse_active = _browse_filters_active(browse, unit_q)
    by_uid = {}
    for g in master_groups or []:
        uid = A.normalize_id((g.get('unit') or {}).get('id'))
        if uid:
            by_uid[uid] = g
    out = []
    to_build = []
    for uid in unit_ids:
        uid = A.normalize_id(uid)
        cached = by_uid.get(uid)
        if _is_ready_cached_group(cached):
            out.append(cached)
        else:
            to_build.append(uid)
    if to_build:
        if not _msy_page_build_allowed():
            build_cap = 0
        elif max_build is None:
            build_cap = _MSY_PAGE_BUILD_LIMIT
        else:
            build_cap = min(_MSY_PAGE_BUILD_LIMIT, max(0, int(max_build)))
        if build_cap > 0:
            to_build = to_build[:build_cap]
            exclude = _exclude_set_from_kwargs(kwargs)
            top_p = int(kwargs.get('top_pilots', 10) or 10)
            dt = max(1, min(4, int(kwargs.get('def_tier', def_tier) or def_tier)))
            budget = build_budget_sec if build_budget_sec is not None else _MSY_PAGE_BUILD_BUDGET_SEC
            deadline = time.monotonic() + budget
            pilot_ids = list(_pilot_pool_ids())
            lb = int(kwargs.get('lb_tier', 3) or 3)
            du = kwargs.get('def_unit_override')
            dc = kwargs.get('def_char_override')
            tiers = None if browse_fast else _MSY_STD_DEF_TIERS
            built = []
            workers = min(_MSY_BUILD_WORKERS, max(1, len(to_build)))

            def _build_one(uid):
                return _build_single_unit_group(
                    uid, pilot_ids, lc, lb, 'super', dt, exclude, top_p, 'super_crit',
                    def_unit_override=du, def_char_override=dc, def_tiers=tiers, lite=page_build_lite,
                    rank_mode=rank_mode, same_role_only=same_role_only, browse_fast=browse_fast,
                )

            if workers <= 1:
                for uid in to_build:
                    if time.monotonic() >= deadline:
                        break
                    try:
                        g = _build_one(uid)
                        if g:
                            built.append(g)
                    except Exception as e:
                        print(f'MSY page build error ({uid}): {e}')
            else:
                ex = ThreadPoolExecutor(max_workers=workers)
                try:
                    futs = {ex.submit(_build_one, uid): uid for uid in to_build}
                    for fut in as_completed(futs):
                        if time.monotonic() >= deadline:
                            break
                        uid = futs[fut]
                        try:
                            g = fut.result(timeout=max(0.05, deadline - time.monotonic()))
                            if g:
                                built.append(g)
                        except Exception as e:
                            print(f'MSY page build error ({uid}): {e}')
                finally:
                    ex.shutdown(wait=False, cancel_futures=True)
            out.extend(built)
    # Preserve caller page order; prefer freshly simmed rows over cache/preview.
    def _group_rank(g):
        if g.get('cross_role_built'):
            return 3
        if not g.get('pilot_preview') and not g.get('pending'):
            return 2
        if g.get('pilot_preview'):
            return 1
        return 0

    out_by_uid = {}
    for g in out:
        uid = A.normalize_id((g.get('unit') or {}).get('id'))
        if not uid:
            continue
        prev = out_by_uid.get(uid)
        if not prev or _group_rank(g) > _group_rank(prev):
            out_by_uid[uid] = g
    return [out_by_uid[uid] for uid in unit_ids if uid in out_by_uid]


def _parse_browse_filters(kwargs, lc):
    """Parse unit browse filter kwargs (same semantics as /api/units)."""
    A = _app()
    rarity_raw = kwargs.get('rarity') or kwargs.get('unit_rarity') or ''
    if str(rarity_raw).upper() in ('ALL', ''):
        rarity_filter = None
    elif ',' in str(rarity_raw) or str(rarity_raw).upper() in ('LT', 'ULT', 'NLT', '__NONE__'):
        rarity_filter = A.parse_list_rarity_filter(str(rarity_raw))
    elif str(rarity_raw).upper() in A.RARITY_LETTERS:
        rarity_filter = A.parse_list_rarity_filter(str(rarity_raw).upper())
    else:
        rarity_filter = None

    role_raw = kwargs.get('role') if kwargs.get('role') is not None else kwargs.get('unit_role')
    if role_raw is None or str(role_raw).upper() in ('ALL', ''):
        role_filter = None
    else:
        role_filter = A.parse_list_role_filter(str(role_raw))

    return {
        'role_filter': role_filter,
        'rarity_filter': rarity_filter,
        'series_filter': A.parse_list_series_filter(kwargs.get('series_id') or ''),
        'series_combine': A.normalize_filter_combine_op(kwargs.get('series_op') or 'or', 'or'),
        'source_filter': A.parse_list_source_filter(kwargs.get('source') or ''),
        'lineage_filter': A.parse_list_lineage_filter(kwargs.get('lineage_id') or ''),
        'lineage_combine': A.normalize_filter_combine_op(kwargs.get('lineage_op') or 'and', 'and'),
    }


def _unit_passes_browse_filters(uid, info, lc, filters):
    A = _app()
    uid = A.normalize_id(uid)
    ri = str(info.get('rarity', '1'))
    role_id = str(info.get('role', '0'))
    role_filter = filters.get('role_filter')
    if role_filter is not None:
        if not role_filter:
            return False
        if not A.unit_matches_role_filter(uid, info, role_filter):
            return False
    rarity_filter = filters.get('rarity_filter')
    if rarity_filter is not None:
        if not rarity_filter:
            return False
        letter = A.RARITY_MAP.get(ri, 'N')
        lim = uid in A.LIMITED_TIME_UNIT_IDS
        if not A.row_matches_rarity_filter(
            rarity_filter, letter, lim, bool(info.get('is_ultimate', False)),
        ):
            return False
    source_filter = filters.get('source_filter')
    if source_filter is not None:
        acq_route = str(info.get('acquisition_route', '0'))
        if not A.entity_matches_source_category(acq_route, role_id, source_filter):
            return False
    series_filter = filters.get('series_filter')
    if series_filter is not None:
        if not A.entity_matches_series(
            _unit_series_set_id(uid, info), series_filter, lc,
            filters.get('series_combine', 'or'),
        ):
            return False
    lineage_filter = filters.get('lineage_filter')
    if lineage_filter is not None:
        if not A.entity_matches_lineage(
            A.unit_lin_map, uid, lineage_filter, filters.get('lineage_combine', 'and'),
        ):
            return False
    return True


def _filter_master_groups(groups, lc, filters):
    A = _app()
    if not filters or not any(
        filters.get(k) is not None
        for k in ('role_filter', 'rarity_filter', 'series_filter', 'source_filter', 'lineage_filter')
    ):
        return list(groups or [])
    out = []
    for g in groups or []:
        uid = A.normalize_id((g.get('unit') or {}).get('id'))
        info = A.unit_info_map.get(uid)
        if not info:
            continue
        if _unit_passes_browse_filters(uid, info, lc, filters):
            out.append(g)
    return out


def _master_cache_key(lc, kwargs):
    return (
        '_v14_dc_master',
        lc or 'EN',
        int(kwargs.get('lb_tier', 3) or 3),
        int(kwargs.get('top_pilots', 10) or 10),
        kwargs.get('def_unit_override'),
        kwargs.get('def_char_override'),
    )


def _browse_payload_cache_key(lc, rank_mode, page, per_page, unit_q, def_tier, kwargs, summary_only):
    return (
        lc or 'EN',
        rank_mode or 'super_crit',
        int(page or 1),
        int(per_page or 10),
        (unit_q or '').strip().lower(),
        int(def_tier or 3),
        bool(summary_only),
        bool(_passive_cp_on_from_kwargs(kwargs)),
        bool(_passive_pep_on_from_kwargs(kwargs)),
        kwargs.get('rarity') or kwargs.get('unit_rarity') or '',
        kwargs.get('role') or kwargs.get('unit_role') or '',
        kwargs.get('series_id') or '',
        kwargs.get('series_op') or '',
        kwargs.get('source') or '',
        kwargs.get('lineage_id') or '',
        kwargs.get('lineage_op') or '',
        int(kwargs.get('lb_tier', 3) or 3),
        int(kwargs.get('top_pilots', 10) or 10),
        bool(_same_role_only_from_kwargs(kwargs)),
    )


def _get_browse_payload_cache(key):
    if not key:
        return None
    entry = _rankings_browse_payload_cache.get(key)
    if not entry:
        return None
    if time.monotonic() - entry['ts'] > _MSY_BROWSE_PAYLOAD_CACHE_TTL:
        _rankings_browse_payload_cache.pop(key, None)
        return None
    return entry['payload']


def _group_quality_rank(g):
    """Higher = better cached row (prefer full sim over preview/pending)."""
    if not g:
        return -1
    if g.get('cross_role_built'):
        return 3
    if not g.get('pilot_preview') and not g.get('pending'):
        return 2
    if g.get('pilot_preview'):
        return 1
    return 0


def _group_has_ranked_pilots(g, rank_mode='super_crit'):
    """True when a group carries a real top-pilot ranking block."""
    if not g or g.get('pending') or g.get('pilot_preview'):
        return False
    rm = rank_mode or 'super_crit'
    for key in (rm, 'super_crit', 'crit', 'normal'):
        block = (g.get('rankings') or {}).get(key)
        if block and (block.get('pilots') or []):
            return True
    return bool(g.get('pilots'))


def _set_browse_payload_cache(key, payload):
    if not key or not payload:
        return
    if payload.get('warming') or payload.get('partial'):
        return
    if payload.get('cache_incomplete'):
        return
    if not payload.get('groups'):
        return
    if any((g or {}).get('pending') or (g or {}).get('pilot_preview') or (g or {}).get('index_only') for g in payload.get('groups') or []):
        return
    _rankings_browse_payload_cache[key] = {'ts': time.monotonic(), 'payload': payload}
    if len(_rankings_browse_payload_cache) > 48:
        oldest = min(
            _rankings_browse_payload_cache,
            key=lambda k: _rankings_browse_payload_cache[k]['ts'],
        )
        _rankings_browse_payload_cache.pop(oldest, None)


def build_meta_synergy_master(lc='EN', *, lb_tier=3, top_pilots=20, exclude_pairs=None,
                            def_unit_override=None, def_char_override=None, on_progress=None,
                            unit_ids=None, publish_build=False, use_processes=None):
    """One-time full rankings build (all units, all roles). Filters applied afterward."""
    A = _app()
    lc = lc or A.DEFAULT_LANG
    exclude = set()
    for p in exclude_pairs or []:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            exclude.add((A.normalize_id(p[0]), A.normalize_id(p[1])))

    pilot_ids = list(_pilot_pool_ids())
    if unit_ids is None:
        unit_ids = _msy_rankable_unit_ids(lc)

    use_multi_tier = not def_unit_override and not def_char_override
    def_tiers = _MSY_STD_DEF_TIERS if use_multi_tier else None
    groups = _build_all_unit_groups(
        unit_ids, pilot_ids, lc, lb_tier, 'super', 1, exclude, top_pilots, 'super_crit',
        def_unit_override=def_unit_override, def_char_override=def_char_override,
        def_tiers=def_tiers, on_progress=on_progress,
        publish_build=publish_build, use_processes=use_processes,
    )
    return {
        'groups': groups,
        'total_pilot_candidates': len(pilot_ids),
    }


def _store_partial_master(cache_key, groups, total_pilot_candidates=0):
    if not groups:
        return
    with _rankings_build_lock:
        _rankings_result_cache[cache_key] = {
            'groups': groups,
            'total_pilot_candidates': total_pilot_candidates,
            'partial': True,
        }


def _rankings_cache_key(lc, def_tier, kwargs):
    return _master_cache_key(lc, kwargs)


def _sort_groups_by_mode(groups, rank_mode):
    rank_mode = rank_mode or 'super_crit'

    def _key(g):
        block = (g.get('rankings') or {}).get(rank_mode) or {}
        md = block.get('max_damage', 0) or g.get('max_damage', 0) or 0
        return (-md, ((g.get('unit') or {}).get('name') or '').lower())

    return sorted(groups, key=_key)


def _enrich_pilot_row(pilot, lc):
    if not pilot or pilot.get('active_skills'):
        return pilot
    cid = _app().normalize_id((pilot.get('char') or {}).get('id'))
    if not cid:
        return pilot
    row = dict(pilot)
    row['active_skills'] = _msy_pilot_active_skills(cid, lc)
    return row


def _enrich_rankings_pilots(rankings, lc):
    if not isinstance(rankings, dict):
        return rankings
    out = {}
    for mode, block in rankings.items():
        if not isinstance(block, dict):
            out[mode] = block
            continue
        pilots = block.get('pilots') or []
        if pilots and not pilots[0].get('active_skills'):
            block = dict(block)
            block['pilots'] = [_enrich_pilot_row(p, lc) for p in pilots]
        out[mode] = block
    return out


def _copy_pilot_skills_from_main(main_rankings, variant_rankings):
    """Reuse resolved active_skills from main rankings for CP-off variants."""
    if not isinstance(main_rankings, dict) or not isinstance(variant_rankings, dict):
        return variant_rankings
    skill_by_cid = {}
    for block in main_rankings.values():
        for pilot in (block or {}).get('pilots') or []:
            cid = _app().normalize_id((pilot.get('char') or {}).get('id'))
            if cid and pilot.get('active_skills'):
                skill_by_cid[cid] = pilot['active_skills']
    if not skill_by_cid:
        return variant_rankings
    out = {}
    for mode, block in variant_rankings.items():
        if not isinstance(block, dict):
            out[mode] = block
            continue
        pilots = block.get('pilots') or []
        if pilots and not pilots[0].get('active_skills'):
            block = dict(block)
            patched = []
            for pilot in pilots:
                row = dict(pilot)
                cid = _app().normalize_id((row.get('char') or {}).get('id'))
                if cid in skill_by_cid:
                    row['active_skills'] = skill_by_cid[cid]
                patched.append(row)
            block['pilots'] = patched
        out[mode] = block
    return out


def _slim_rankings_for_mode(rankings, rank_mode):
    if not isinstance(rankings, dict) or not rank_mode:
        return rankings
    block = rankings.get(rank_mode)
    return {rank_mode: block} if block else {}


def _ensure_group_enriched(g, lc, rank_mode='super_crit', include_skills=True):
    """Backfill weapon/subtitle and (optionally) pilot skills once per cached unit group (per rank mode)."""
    if not g:
        return g
    rank_mode = rank_mode or 'super_crit'
    done_modes = g.get('_msy_enriched_rm')
    if not isinstance(done_modes, dict):
        done_modes = {}
        g['_msy_enriched_rm'] = done_modes
    block = (g.get('rankings') or {}).get(rank_mode) or {}
    pilots = block.get('pilots') or []
    if rank_mode in done_modes and g.get('weapon_info'):
        if not include_skills or not pilots or pilots[0].get('active_skills'):
            return g
    uid = _app().normalize_id((g.get('unit') or {}).get('id'))
    if uid and not g.get('weapon_info'):
        wi = _weapon_info_for_msy(uid, lc)
        if wi:
            g['weapon_info'] = wi
        info = _app().unit_info_map.get(uid) or {}
        is_sd = _is_sd_unit(uid, info)
        g['is_sd'] = is_sd
        if is_sd:
            g['bundled_pilot_id'] = _bundled_pilot_id(uid)
    if include_skills and g.get('rankings') and rank_mode not in done_modes:
        src = (g.get('rankings') or {}).get(rank_mode)
        if src:
            enriched = _enrich_rankings_pilots({rank_mode: src}, lc)
            g['rankings'] = dict(g.get('rankings') or {})
            g['rankings'][rank_mode] = enriched.get(rank_mode, src)
            done_modes[rank_mode] = True
    elif not include_skills and g.get('weapon_info') and rank_mode not in done_modes:
        done_modes[rank_mode] = True
    if include_skills and g.get('rankings_no_cp'):
        slim_cp = _slim_rankings_for_mode(g['rankings_no_cp'], rank_mode)
        cp_block = (slim_cp or {}).get(rank_mode) or {}
        cp_pilots = cp_block.get('pilots') or []
        if cp_pilots and not cp_pilots[0].get('active_skills'):
            g['rankings_no_cp'] = dict(g.get('rankings_no_cp') or {})
            g['rankings_no_cp'][rank_mode] = _copy_pilot_skills_from_main(
                g.get('rankings'), {rank_mode: cp_block},
            ).get(rank_mode, cp_block)
    return g


def _slim_variant_rankings_if_populated(rankings, rank_mode):
    """Slim CP/PEP variant blobs only when they contain pilot rows (skip empty shells)."""
    if not rankings:
        return None
    slim = _slim_rankings_for_mode(rankings, rank_mode)
    block = (slim or {}).get(rank_mode) or {}
    if block.get('pilots'):
        return slim
    return None


def _normalize_group_for_mode(g, rank_mode):
    block = (g.get('rankings') or {}).get(rank_mode)
    if block:
        rankings = _slim_rankings_for_mode(g.get('rankings'), rank_mode)
        rankings_no_cp = _slim_variant_rankings_if_populated(g.get('rankings_no_cp'), rank_mode)
        rankings_no_pep = _slim_variant_rankings_if_populated(g.get('rankings_no_pep'), rank_mode)
        rankings_no_cp_pep = _slim_variant_rankings_if_populated(g.get('rankings_no_cp_pep'), rank_mode)
        rankings_no_ur = _slim_variant_rankings_if_populated(g.get('rankings_no_ur'), rank_mode)
        rankings_no_shinn = _slim_variant_rankings_if_populated(g.get('rankings_no_shinn'), rank_mode)
        return {
            'unit': g.get('unit'),
            'weapon_elems': g.get('weapon_elems'),
            'max_damage': block.get('max_damage', 0),
            'pilots': block.get('pilots') or [],
            'rankings': rankings,
            'rankings_no_cp': rankings_no_cp,
            'rankings_no_pep': rankings_no_pep,
            'rankings_no_cp_pep': rankings_no_cp_pep,
            'rankings_no_ur': rankings_no_ur,
            'rankings_no_shinn': rankings_no_shinn,
            'weapon_info': g.get('weapon_info'),
            'is_sd': g.get('is_sd', False),
            'bundled_pilot_id': g.get('bundled_pilot_id'),
            'pending': g.get('pending'),
            'cross_role_built': g.get('cross_role_built'),
            'pilot_preview': g.get('pilot_preview'),
            'index_only': g.get('index_only'),
        }
    if rank_mode == 'super_crit' and g.get('pilots'):
        return g
    return None


def _merge_groups_into_cache(cache_key, new_groups):
    """Append freshly built unit groups to the in-memory master cache."""
    if not new_groups:
        return
    with _rankings_build_lock:
        entry = _rankings_result_cache.get(cache_key)
        if entry is None:
            entry = {'groups': [], 'total_pilot_candidates': len(_pilot_pool_ids())}
            _rankings_result_cache[cache_key] = entry
        by_uid = {}
        for g in entry.get('groups') or []:
            uid = _app().normalize_id((g.get('unit') or {}).get('id'))
            if uid:
                by_uid[uid] = g
        merged = list(entry.get('groups') or [])
        for g in new_groups:
            uid = _app().normalize_id((g.get('unit') or {}).get('id'))
            if not uid:
                continue
            prev = by_uid.get(uid)
            if prev:
                if _group_quality_rank(g) > _group_quality_rank(prev):
                    merged = [x for x in merged if _app().normalize_id((x.get('unit') or {}).get('id')) != uid]
                    merged.append(g)
                    by_uid[uid] = g
                continue
            merged.append(g)
            by_uid[uid] = g
        entry['groups'] = merged


def _ensure_rankings_cache(cache_key, build_fn):
    cached = _rankings_result_cache.get(cache_key)
    if cached is not None:
        return cached, False
    disk = _load_master_from_disk(cache_key, allow_legacy=True)
    if disk is not None:
        _rankings_result_cache[cache_key] = disk
        return disk, False
    with _rankings_build_lock:
        cached = _rankings_result_cache.get(cache_key)
        if cached is not None:
            return cached, False
        disk = _load_master_from_disk(cache_key, allow_legacy=True)
        if disk is not None:
            _rankings_result_cache[cache_key] = disk
            return disk, False
        if not _msy_python_build_allowed():
            empty = {
                'groups': [],
                'total_pilot_candidates': len(_pilot_pool_ids()),
            }
            _rankings_result_cache[cache_key] = empty
            return empty, False
        if cache_key in _rankings_inflight:
            return None, True
        _rankings_inflight.add(cache_key)

    def _worker():
        tpc = len(_pilot_pool_ids())
        try:
            def _on_progress(groups):
                _store_partial_master(cache_key, groups, total_pilot_candidates=tpc)

            result = build_fn(on_progress=_on_progress)
            with _rankings_build_lock:
                _rankings_result_cache[cache_key] = result
            _save_master_to_disk(cache_key, result)
        except Exception as e:
            print(f'MSY rankings build failed ({cache_key!r}): {e}')
            import traceback
            traceback.print_exc()
            with _rankings_build_lock:
                _rankings_inflight.discard(cache_key)
            return
        with _rankings_build_lock:
            _rankings_inflight.discard(cache_key)

    threading.Thread(
        target=_worker, daemon=True, name=f'msy-rank-{hash(cache_key) & 0xffff:x}',
    ).start()
    return None, True


def _warming_payload(rank_mode, vigor, def_tier, kwargs):
    role_raw = kwargs.get('role') or kwargs.get('unit_role')
    if role_raw is None or str(role_raw).upper() in ('ALL', ''):
        role_filter = None
    else:
        role_filter = _app().parse_list_role_filter(str(role_raw))
    pilot_role_set = _pilot_role_set_for_filters(role_filter, kwargs.get('pilot_roles'))
    dt = def_tier
    du = kwargs.get('def_unit_override')
    dc = kwargs.get('def_char_override')
    return {
        'warming': True,
        'retry_after': 3,
        'groups': [],
        'total': 0,
        'total_pilot_candidates': 0,
        'page': 1,
        'per_page': 50,
        'total_pages': 1,
        'rank_mode': rank_mode or 'super_crit',
        'metric': kwargs.get('metric', 'super_crit'),
        'vigor': vigor,
        'def_tier': dt,
        'defender_tiers': defender_tiers_public(),
        'settings': {
            'unit_rarity': kwargs.get('rarity') or kwargs.get('unit_rarity', 'ALL'),
            'unit_role': kwargs.get('role') or kwargs.get('unit_role', 'ALL'),
            'series_id': kwargs.get('series_id') or '',
            'source': kwargs.get('source') or '',
            'lineage_id': kwargs.get('lineage_id') or '',
            'lineage_op': kwargs.get('lineage_op') or '',
            'pilot_rarity': kwargs.get('pilot_rarity', 'ALL'),
            'pilot_roles': list(pilot_role_set),
            'same_role_only': _same_role_only_from_kwargs(kwargs),
            'lb_tier': int(kwargs.get('lb_tier', 3) or 3),
            'def_tier': dt,
            'def_unit_override': du,
            'def_char_override': dc,
            'defender_note': _settings_note(dt, def_unit_override=du, def_char_override=dc),
        },
    }


def _is_ready_cached_group(g):
    return bool(g) and not g.get('pending') and not g.get('pilot_preview')


def _preview_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc, *, cp_on=True, pep_on=True):
    """Lightweight pilot ranking for instant preview cards (no pair-total sim)."""
    char_atk = float(_formula_char_atk_for_pair(
        cid, uid, lc, unit_wpn.get('attr'), cp_on=cp_on,
    )[0])
    unit_atk = _unit_atk_max(uid, info, stat_mode, lc, cid, False, cp_on=cp_on)
    if pep_on:
        pep_atk_pct = _pilot_pep_unit_stat_bonus_pct(cid, uid, lc, cp_on=cp_on, pair_ok=False)
        if pep_atk_pct:
            unit_atk = math.floor(unit_atk * (100 + pep_atk_pct) / 100)
    wp = float(unit_wpn.get('power') or 0)
    return (unit_atk + 2.0 * char_atk) * wp


def _preview_pilot_id_sample():
    """Small stable pilot id sample for instant MSY preview cards."""
    ids = list(_pilot_pool_ids())
    cap = min(len(ids), _MSY_PREVIEW_PILOT_SCAN * 4)
    if len(ids) <= cap:
        return ids
    step = max(1, len(ids) // cap)
    return [ids[i] for i in range(0, len(ids), step)][:cap]


def _cheap_pilot_top_for_unit(uid, lc, kwargs, need, info, unit_wpn, stat_mode, *, non_ur_only=False,
                              cp_on=True, pep_on=True):
    """Score a bounded pilot sample for one unit (preview / fast browse)."""
    import heapq
    A = _app()
    uid = A.normalize_id(uid)
    exclude = _exclude_set_from_kwargs(kwargs)
    same_role_only = _same_role_only_from_kwargs(kwargs)
    linked = _linked_character_ids()
    need = max(1, int(need or 10))
    if _is_sd_unit(uid, info):
        bp = _bundled_pilot_id(uid)
        if bp and (uid, bp) not in exclude:
            sc = _cheap_pilot_score(uid, bp, info, unit_wpn, stat_mode, lc, cp_on=cp_on, pep_on=pep_on)
            return [(sc, bp)]
        return []
    heap = []
    use_fast_score = cp_on and pep_on
    for cid in _preview_pilot_id_sample():
        cid_n = A.normalize_id(cid)
        if cid_n in linked:
            continue
        if (uid, cid_n) in exclude:
            continue
        if same_role_only and not _pilot_role_matches_unit(uid, cid_n):
            continue
        if non_ur_only:
            ri = str((A.char_info_map.get(cid_n) or {}).get('rarity', '1'))
            if A.RARITY_MAP.get(ri, 'N') == 'UR':
                continue
        if use_fast_score:
            sc = _preview_pilot_score(uid, cid_n, info, unit_wpn, stat_mode, lc, cp_on=cp_on, pep_on=pep_on)
        else:
            sc = _cheap_pilot_score(uid, cid_n, info, unit_wpn, stat_mode, lc, cp_on=cp_on, pep_on=pep_on)
        if len(heap) < need:
            heapq.heappush(heap, (sc, cid_n))
        elif sc > heap[0][0]:
            heapq.heapreplace(heap, (sc, cid_n))
    heap.sort(key=lambda x: (-x[0], x[1]))
    return heap


def _cheap_pilot_top_candidates(uid, active_pilots, need, info, unit_wpn, stat_mode, lc, *,
                                  non_ur_only=False):
    """Top pilot ids by cheap score without scanning the full pool."""
    del active_pilots
    return _cheap_pilot_top_for_unit(
        uid, lc, {}, need, info, unit_wpn, stat_mode, non_ur_only=non_ur_only,
    )


def _cheap_preview_pilot_rows(uid, active_pilots, top_pilots, info, unit_wpn, stat_mode, lc, *,
                              non_ur_only=False, kwargs=None, cp_on=True, pep_on=True):
    """Instant pilot cards from cheap affinity/stat scores (no damage sim)."""
    scored = _cheap_pilot_top_for_unit(
        uid, lc, kwargs or {}, top_pilots, info, unit_wpn, stat_mode, non_ur_only=non_ur_only,
        cp_on=cp_on, pep_on=pep_on,
    )
    rows = []
    attr = str(unit_wpn.get('attr', '1'))
    top_score = scored[0][0] if scored else 0.0
    top_dmg = max(1, int(top_score / _CHEAP_SCORE_TO_DAMAGE)) if top_score > 0 else 1
    for i, (score, cid) in enumerate(scored):
        if i == 0 or top_score <= 0:
            dmg = top_dmg
        else:
            dmg = max(1, int(round(top_dmg * float(score) / float(top_score))))
        char_atk, formula_stat = _formula_char_atk_for_pair(cid, uid, lc, attr, cp_on=cp_on)
        rows.append({
            'rank': i + 1,
            'char': _entity_brief_char(cid, lc),
            'normal_dmg': dmg,
            'crit_dmg': dmg,
            'super_crit_dmg': dmg,
            'expected_dmg': dmg,
            'peak_dmg': dmg,
            'guaranteed_crit': False,
            'crit_rate': 0,
            'pair_ok': False,
            'char_atk': char_atk,
            'formula_stat': formula_stat,
            'score': dmg,
        })
    return rows


def _preview_rankings_block(uid, lc, kwargs, rank_mode, info, unit_wpn, stat_mode, top_p, *,
                            cp_on=True, pep_on=True, non_ur_only=False):
    """One rank-mode preview block for a CP/PEP variant."""
    pilots = _cheap_preview_pilot_rows(
        uid, [], top_p, info, unit_wpn, stat_mode, lc, non_ur_only=non_ur_only, kwargs=kwargs,
        cp_on=cp_on, pep_on=pep_on,
    )
    if not pilots:
        return None
    return {
        'max_damage': pilots[0]['score'],
        'pilots': pilots,
        'vigor': _VIGOR_FOR_RANK_MODE.get(rank_mode, 'super'),
    }


def _preview_group_for_uid(uid, lc, kwargs, rank_mode, def_tier, *, role_filter=None):
    """Fast pilot preview for browse/search rows (upgraded to full sim in background)."""
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not unit_wpn:
        return _stub_group_for_uid(uid, lc, kwargs, rank_mode, def_tier, role_filter=role_filter)
    top_p = int(kwargs.get('top_pilots', 10) or 10)
    cp_on = _passive_cp_on_from_kwargs(kwargs)
    pep_on = _passive_pep_on_from_kwargs(kwargs)
    block = _preview_rankings_block(
        uid, lc, kwargs, rank_mode, info, unit_wpn, stat_mode, top_p, cp_on=cp_on, pep_on=pep_on,
    )
    if not block:
        return _stub_group_for_uid(uid, lc, kwargs, rank_mode, def_tier, role_filter=role_filter)
    nu_block = _preview_rankings_block(
        uid, lc, kwargs, rank_mode, info, unit_wpn, stat_mode, top_p,
        cp_on=cp_on, pep_on=pep_on, non_ur_only=True,
    )
    wi = _weapon_info_for_msy(uid, lc)
    is_sd = _is_sd_unit(uid, info)
    out = {
        'unit': _entity_brief_unit(uid, lc, role_filter=role_filter),
        'weapon_elems': _weapon_elem_label(uid, lc),
        'weapon_info': wi,
        'max_damage': block['max_damage'],
        'pilot_preview': True,
        'rankings': {rank_mode: block},
        'pilots': block['pilots'],
        'is_sd': is_sd,
        'bundled_pilot_id': _bundled_pilot_id(uid) if is_sd else None,
    }
    if nu_block:
        out['rankings_no_ur'] = {rank_mode: nu_block}
    return out


def _stub_group_for_uid(uid, lc, kwargs, rank_mode, def_tier, *, role_filter=None):
    """Fast placeholder row for filtered browse (unit shell + estimated peak damage)."""
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    est = int(_estimate_uncached_unit_damage(uid, lc, kwargs))
    wi = _weapon_info_for_msy(uid, lc)
    is_sd = _is_sd_unit(uid, info)
    block = {'max_damage': est, 'pilots': []}
    return {
        'unit': _entity_brief_unit(uid, lc, role_filter=role_filter),
        'weapon_elems': _weapon_elem_label(uid, lc),
        'weapon_info': wi,
        'max_damage': est,
        'pending': True,
        'rankings': {rank_mode: block},
        'pilots': [],
        'is_sd': is_sd,
        'bundled_pilot_id': _bundled_pilot_id(uid) if is_sd else None,
    }


def _index_shell_group_for_uid(uid, lc, kwargs, rank_mode, def_tier, *, role_filter=None, sort_index=None):
    """Instant filtered-browse row: unit shell + precomputed peak damage, no pilot sim."""
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    if sort_index is None:
        sort_index = _ensure_msy_sort_damage_index(lc)
    est = int(sort_index.get(uid, 0))
    wi = _weapon_info_for_msy(uid, lc)
    is_sd = _is_sd_unit(uid, info)
    block = {'max_damage': est, 'pilots': [], 'vigor': _VIGOR_FOR_RANK_MODE.get(rank_mode, 'super')}
    return {
        'unit': _entity_brief_unit(uid, lc, role_filter=role_filter),
        'weapon_elems': _weapon_elem_label(uid, lc),
        'weapon_info': wi,
        'max_damage': est,
        'index_only': True,
        'rankings': {rank_mode: block},
        'pilots': [],
        'is_sd': is_sd,
        'bundled_pilot_id': _bundled_pilot_id(uid) if is_sd else None,
    }


def _build_browse_group_for_uid(uid, lc, kwargs, rank_mode, def_tier, *, role_filter=None, browse_fast=True):
    """On-demand real damage sim for one browse row (no cheap preview)."""
    if not _msy_page_build_allowed():
        return None
    A = _app()
    uid = A.normalize_id(uid)
    exclude = _exclude_set_from_kwargs(kwargs)
    top_p = int(kwargs.get('top_pilots', 10) or 10)
    dt = max(1, min(4, int(kwargs.get('def_tier', def_tier) or def_tier)))
    pilot_ids = list(_pilot_pool_ids())
    lb = int(kwargs.get('lb_tier', 3) or 3)
    du = kwargs.get('def_unit_override')
    dc = kwargs.get('def_char_override')
    same_role_only = _same_role_only_from_kwargs(kwargs)
    try:
        g = _build_single_unit_group(
            uid, pilot_ids, lc, lb, 'super', dt, exclude, top_p, 'super_crit',
            def_unit_override=du, def_char_override=dc,
            def_tiers=None if browse_fast else _MSY_STD_DEF_TIERS,
            lite=True, rank_mode=rank_mode, same_role_only=same_role_only, browse_fast=browse_fast,
        )
    except Exception as e:
        print(f'MSY browse build error ({uid}): {e}')
        return None
    if g and role_filter:
        u = g.get('unit') or {}
        g = dict(g)
        g['unit'] = _entity_brief_unit(u.get('id'), lc, role_filter=role_filter)
    return g


def _ready_units_set_from_kwargs(kwargs):
    """Unit ids the client already has pilot rankings for (stateless progressive builds)."""
    A = _app()
    out = set()
    for part in (kwargs.get('ready_units') or '').split(','):
        part = part.strip()
        if part:
            out.add(A.normalize_id(part))
    return out


def _resolve_browse_page_groups(page_ids, working_groups, lc, kwargs, rank_mode, def_tier, *,
                                unit_q='', cache_key=None, role_filter=None, pilot_build_limit=None):
    """Page units: cache first; bounded real-sim builds; instant index shells for the rest."""
    del unit_q
    dt = max(1, min(4, int(def_tier or 3)))
    kwargs_resolve = dict(kwargs)
    kwargs_resolve['def_tier'] = dt
    ready_uids = _ready_units_set_from_kwargs(kwargs_resolve)
    master_by_uid = {}
    for g in working_groups or []:
        uid = _app().normalize_id((g.get('unit') or {}).get('id'))
        if uid:
            master_by_uid[uid] = g
    sort_index = _ensure_msy_sort_damage_index(lc, working_groups)
    if pilot_build_limit is None:
        pilot_build_limit = _MSY_PILOT_BUILD_PER_REQUEST
    pilot_build_limit = max(0, int(pilot_build_limit or 0))

    def _shell(uid):
        shell = _index_shell_group_for_uid(
            uid, lc, kwargs, rank_mode, dt, role_filter=role_filter, sort_index=sort_index,
        )
        if pilot_build_limit > 0:
            shell = dict(shell)
            shell['pending'] = True
        return shell

    if pilot_build_limit == 0:
        out = []
        for uid in page_ids or []:
            uid = _app().normalize_id(uid)
            cached = master_by_uid.get(uid)
            if cached and _group_has_ranked_pilots(cached, rank_mode):
                out.append(cached)
            else:
                out.append(_index_shell_group_for_uid(
                    uid, lc, kwargs, rank_mode, dt, role_filter=role_filter, sort_index=sort_index,
                ))
        return out

    built_by_uid = {}
    built_count = 0
    for uid in page_ids or []:
        uid = _app().normalize_id(uid)
        cached = master_by_uid.get(uid)
        if cached and _group_has_ranked_pilots(cached, rank_mode):
            continue
        if uid in ready_uids:
            continue
        if built_count >= pilot_build_limit or not _msy_page_build_allowed():
            continue
        built = _build_browse_group_for_uid(
            uid, lc, kwargs_resolve, rank_mode, dt, role_filter=role_filter,
        )
        if built and _group_has_ranked_pilots(built, rank_mode):
            if cache_key:
                _merge_groups_into_cache(cache_key, [built])
            built_by_uid[uid] = built
            built_count += 1

    out = []
    for uid in page_ids or []:
        uid = _app().normalize_id(uid)
        cached = master_by_uid.get(uid)
        if cached and _group_has_ranked_pilots(cached, rank_mode):
            out.append(cached)
            continue
        if uid in built_by_uid:
            out.append(built_by_uid[uid])
            continue
        out.append(_shell(uid))
    return out


def _filtered_browse_row_for_uid(uid, by_uid, lc, kwargs, rank_mode, def_tier, role_filter, sort_index,
                                  *, include_skills=True):
    """Cached sim when available; otherwise on-demand real sim for this page row."""
    del sort_index
    A = _app()
    uid = A.normalize_id(uid)
    g = by_uid.get(uid)
    if _is_ready_cached_group(g):
        row = _group_for_def_tier(g, def_tier) if g.get('rankings_by_tier') else g
        if row:
            row = _ensure_passive_variant_for_request(row, lc, rank_mode, def_tier, kwargs)
            row = _backfill_pilot_formula_stats(row, lc, rank_mode, kwargs)
            if include_skills:
                _ensure_group_enriched(row, lc, rank_mode, include_skills=True)
            norm = _normalize_group_for_mode(row, rank_mode)
            if norm:
                if role_filter:
                    u = norm.get('unit') or {}
                    norm = dict(norm)
                    norm['unit'] = _entity_brief_unit(u.get('id'), lc, role_filter=role_filter)
                return norm
    built = _build_browse_group_for_uid(
        uid, lc, kwargs, rank_mode, def_tier, role_filter=role_filter,
    )
    if not built:
        built = _stub_group_for_uid(uid, lc, kwargs, rank_mode, def_tier, role_filter=role_filter)
    built = _backfill_pilot_formula_stats(built, lc, rank_mode, kwargs)
    if include_skills:
        _ensure_group_enriched(built, lc, rank_mode, include_skills=True)
    norm = _normalize_group_for_mode(built, rank_mode)
    return norm or built


def _cached_summary_from_groups(groups, *, total_pilot_candidates, rank_mode, page, per_page, vigor,
                                 def_tier, kwargs, unit_q='', include_skills=True):
    """Filtered browse page rows with cached or on-demand real damage sim."""
    dt = max(1, min(4, int(def_tier or 3)))
    lc = kwargs.get('lc', 'EN')
    browse = _parse_browse_filters(kwargs, lc)
    page = max(1, int(page or 1))
    per_page = max(1, min(100, int(per_page or 50)))
    browse_active = _browse_filters_active(browse, unit_q)
    role_filter = browse.get('role_filter')
    matching_ids = _filtered_rankable_unit_ids(lc, browse, unit_q)
    working_groups = list(groups or [])
    ordered_ids = _ordered_unit_ids_for_browse(
        matching_ids, working_groups, lc, kwargs, rank_mode, def_tier=dt,
        browse=browse, unit_q=unit_q,
    )
    total = len(ordered_ids)
    start = (page - 1) * per_page
    page_ids = ordered_ids[start:start + per_page]
    by_uid = {}
    for g in working_groups:
        uid = _app().normalize_id((g.get('unit') or {}).get('id'))
        if uid:
            by_uid[uid] = g

    if browse_active:
        page_groups_raw = _resolve_browse_page_groups(
            page_ids, working_groups, lc, kwargs, rank_mode, dt,
            unit_q=unit_q, role_filter=role_filter, pilot_build_limit=0,
        )
        expanded = []
        for g in page_groups_raw:
            g = _ensure_passive_variant_for_request(g, lc, rank_mode, dt, kwargs)
            g = _backfill_pilot_formula_stats(g, lc, rank_mode, kwargs)
            if include_skills:
                _ensure_group_enriched(g, lc, rank_mode, include_skills=True)
            row = _group_for_def_tier(g, dt) if g.get('rankings_by_tier') else g
            if row:
                norm = _normalize_group_for_mode(row, rank_mode)
                if norm:
                    if role_filter:
                        u = norm.get('unit') or {}
                        norm = dict(norm)
                        norm['unit'] = _entity_brief_unit(u.get('id'), lc, role_filter=role_filter)
                    expanded.append(norm)
    else:
        def _summary_row_for_uid(uid):
            uid = _app().normalize_id(uid)
            g = by_uid.get(uid)
            if _is_ready_cached_group(g):
                row = _group_for_def_tier(g, dt) if g.get('rankings_by_tier') else g
                if row:
                    row = _ensure_passive_variant_for_request(row, lc, rank_mode, dt, kwargs)
                    row = _backfill_pilot_formula_stats(row, lc, rank_mode, kwargs)
                    if include_skills:
                        _ensure_group_enriched(row, lc, rank_mode, include_skills=True)
                    norm = _normalize_group_for_mode(row, rank_mode)
                    if norm:
                        if role_filter:
                            u = norm.get('unit') or {}
                            norm = dict(norm)
                            norm['unit'] = _entity_brief_unit(u.get('id'), lc, role_filter=role_filter)
                        return norm
            preview = _preview_group_for_uid(uid, lc, kwargs, rank_mode, dt, role_filter=role_filter)
            norm = _normalize_group_for_mode(preview, rank_mode)
            return norm or preview

        if len(page_ids) > 1:
            workers = min(6, len(page_ids))
            with ThreadPoolExecutor(max_workers=workers) as ex:
                expanded = list(ex.map(_summary_row_for_uid, page_ids))
        else:
            expanded = [_summary_row_for_uid(uid) for uid in page_ids]
    expanded.sort(key=lambda g: (
        -_unit_browse_sort_damage(g, rank_mode, dt),
        _app().normalize_id((g.get('unit') or {}).get('id')),
    ))
    total_pages = max(1, (total + per_page - 1) // per_page)
    pilot_role_set = _pilot_role_set_for_filters(role_filter, kwargs.get('pilot_roles'))
    du = kwargs.get('def_unit_override')
    dc = kwargs.get('def_char_override')
    return {
        'groups': expanded,
        'total': total,
        'total_pilot_candidates': total_pilot_candidates,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
        'rank_mode': rank_mode or 'super_crit',
        'metric': kwargs.get('metric', 'super_crit'),
        'vigor': vigor,
        'def_tier': dt,
        'defender_tiers': defender_tiers_public(),
        'summary': True,
        'cache_incomplete': any(
            not _group_has_ranked_pilots(g, rank_mode) for g in expanded
        ),
        'index_browse': browse_active,
        'filtered_browse': browse_active,
        'settings': {
            'unit_rarity': kwargs.get('rarity') or kwargs.get('unit_rarity', 'ALL'),
            'unit_role': kwargs.get('role') or kwargs.get('unit_role', 'ALL'),
            'series_id': kwargs.get('series_id') or '',
            'source': kwargs.get('source') or '',
            'lineage_id': kwargs.get('lineage_id') or '',
            'lineage_op': kwargs.get('lineage_op') or '',
            'pilot_rarity': kwargs.get('pilot_rarity', 'ALL'),
            'pilot_roles': list(pilot_role_set),
            'same_role_only': _same_role_only_from_kwargs(kwargs),
            'lb_tier': int(kwargs.get('lb_tier', 3) or 3),
            'def_tier': dt,
            'def_unit_override': du,
            'def_char_override': dc,
            'defender_note': _settings_note(dt, def_unit_override=du, def_char_override=dc),
        },
    }


def _cached_payload_from_groups(groups, *, total_pilot_candidates, rank_mode, page, per_page, vigor,
                                def_tier, kwargs, unit_q='', cache_key=None, include_skills=True):
    dt = max(1, min(4, int(def_tier or 3)))
    lc = kwargs.get('lc', 'EN')
    browse = _parse_browse_filters(kwargs, lc)
    page = max(1, int(page or 1))
    per_page = max(1, min(100, int(per_page or 50)))
    matching_ids = _filtered_rankable_unit_ids(lc, browse, unit_q)
    working_groups = list(groups or [])
    browse_active = _browse_filters_active(browse, unit_q)
    ordered_ids = _ordered_unit_ids_for_browse(
        matching_ids, working_groups, lc, kwargs, rank_mode, def_tier=dt,
        browse=browse, unit_q=unit_q,
    )
    total = len(ordered_ids)
    start = (page - 1) * per_page
    page_ids = ordered_ids[start:start + per_page]
    role_filter = browse.get('role_filter')
    pilot_build_limit = kwargs.get('pilot_build')
    if pilot_build_limit is None:
        pilot_build_limit = _MSY_PILOT_BUILD_PER_REQUEST
    page_groups_raw = _resolve_browse_page_groups(
        page_ids, working_groups, lc, kwargs, rank_mode, dt,
        unit_q=unit_q, cache_key=cache_key, role_filter=role_filter,
        pilot_build_limit=pilot_build_limit,
    )
    expanded = []
    for g in page_groups_raw:
        g = _ensure_passive_variant_for_request(g, lc, rank_mode, dt, kwargs)
        g = _backfill_pilot_formula_stats(g, lc, rank_mode, kwargs)
        _ensure_group_enriched(g, lc, rank_mode, include_skills=include_skills)
        row = _group_for_def_tier(g, dt) if g.get('rankings_by_tier') else g
        if row:
            norm = _normalize_group_for_mode(row, rank_mode)
            if norm:
                if role_filter:
                    u = norm.get('unit') or {}
                    norm = dict(norm)
                    norm['unit'] = _entity_brief_unit(u.get('id'), lc, role_filter=role_filter)
                expanded.append(norm)
    expanded.sort(key=lambda g: (
        -_unit_browse_sort_damage(g, rank_mode, dt),
        _app().normalize_id((g.get('unit') or {}).get('id')),
    ))
    total_pages = max(1, (total + per_page - 1) // per_page)
    page_incomplete = any(
        not _group_has_ranked_pilots(g, rank_mode) for g in expanded
    ) or len(expanded) < len(page_ids)
    role_raw = kwargs.get('role') or kwargs.get('unit_role')
    if role_raw is None or str(role_raw).upper() in ('ALL', ''):
        role_filter = None
    else:
        role_filter = _app().parse_list_role_filter(str(role_raw))
    pilot_role_set = _pilot_role_set_for_filters(role_filter, kwargs.get('pilot_roles'))
    du = kwargs.get('def_unit_override')
    dc = kwargs.get('def_char_override')
    return {
        'groups': expanded,
        'total': total,
        'total_pilot_candidates': total_pilot_candidates,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
        'rank_mode': rank_mode or 'super_crit',
        'metric': kwargs.get('metric', 'super_crit'),
        'vigor': vigor,
        'def_tier': dt,
        'defender_tiers': defender_tiers_public(),
        'cache_incomplete': page_incomplete,
        'index_browse': browse_active,
        'filtered_browse': browse_active,
        'settings': {
            'unit_rarity': kwargs.get('rarity') or kwargs.get('unit_rarity', 'ALL'),
            'unit_role': kwargs.get('role') or kwargs.get('unit_role', 'ALL'),
            'series_id': kwargs.get('series_id') or '',
            'source': kwargs.get('source') or '',
            'lineage_id': kwargs.get('lineage_id') or '',
            'lineage_op': kwargs.get('lineage_op') or '',
            'pilot_rarity': kwargs.get('pilot_rarity', 'ALL'),
            'pilot_roles': list(pilot_role_set),
            'same_role_only': _same_role_only_from_kwargs(kwargs),
            'lb_tier': int(kwargs.get('lb_tier', 3) or 3),
            'def_tier': dt,
            'def_unit_override': du,
            'def_char_override': dc,
            'defender_note': _settings_note(dt, def_unit_override=du, def_char_override=dc),
        },
    }


def _msy_sim_unit_ids(lc='EN'):
    """Rankable units (used for MSY browse-filter option pools)."""
    return _msy_rankable_unit_ids(lc)


def msy_browse_filter_pools(lc='EN', query_args=None):
    """Series/lineage filter options scoped to MSY sim-eligible units."""
    A = _app()
    lc = lc or A.DEFAULT_LANG
    args = dict(query_args or {})
    filters = _parse_browse_filters({
        'rarity': args.get('rarity'),
        'role': args.get('role'),
        'source': args.get('source'),
        'series_id': args.get('series_id'),
        'series_op': args.get('series_op'),
        'lineage_id': args.get('lineage_id'),
        'lineage_op': args.get('lineage_op'),
    }, lc)
    unit_ids = []
    for uid in _msy_sim_unit_ids(lc):
        info = A.unit_info_map.get(uid)
        if info and _unit_passes_browse_filters(uid, info, lc, filters):
            unit_ids.append(uid)
    series_seen = {}
    lineage_seen = {}
    for uid in unit_ids:
        info = A.unit_info_map.get(uid) or {}
        for s in A.resolve_series(_unit_series_set_id(uid, info), lc):
            sid = A.normalize_id(s.get('id'))
            if sid and sid not in ('', '0') and sid not in series_seen:
                series_seen[sid] = {
                    'id': sid,
                    'name': s.get('name') or sid,
                    'icon': s.get('icon') or '',
                }
        for t in A.resolve_tags(A.unit_lin_map, uid, lc, 'unit'):
            lid = A.normalize_id(t.get('id'))
            if not lid or lid in lineage_seen:
                continue
            lineage_seen[lid] = {
                'id': lid,
                'name': t.get('name') or lid,
                'icon': t.get('icon') or '',
            }
    return {
        'series': sorted(series_seen.values(), key=lambda x: (x.get('name') or '').lower()),
        'lineages': sorted(lineage_seen.values(), key=lambda x: (x.get('name') or '').lower()),
    }


def prewarm_default_rankings():
    """Load published MSY rankings cache (built via scripts/build_msy_rankings_dc.py)."""
    A = _app()
    lc = A.DEFAULT_LANG
    kwargs = {
        'lb_tier': 3,
        'top_pilots': 10,
        'def_unit_override': None,
        'def_char_override': None,
    }
    cache_key = _rankings_cache_key(lc, 3, kwargs)
    disk = _load_master_from_disk(cache_key, allow_legacy=True)
    if disk:
        _rankings_result_cache[cache_key] = disk
        print(f'MSY prewarm: loaded {len(disk.get("groups") or [])} units from disk')
        def _prewarm_sort_index():
            try:
                path = save_published_sort_index(lc, disk.get('groups'))
                print(f'MSY prewarm: sort index ready ({len(_MSY_SORT_DAMAGE_INDEX.get(lc) or {})} units) -> {path}')
            except Exception as e:
                print(f'MSY prewarm: sort index build failed: {e}')
        threading.Thread(target=_prewarm_sort_index, daemon=True).start()
        return
    print('MSY prewarm: no published cache — run scripts/build_msy_rankings_dc.py')


def build_meta_synergy_rankings_cached(lc='EN', **kwargs):
    rank_mode = kwargs.pop('rank_mode', 'super_crit') or 'super_crit'
    page = max(1, int(kwargs.pop('page', 1) or 1))
    per_page = max(1, min(100, int(kwargs.pop('per_page', 50) or 50)))
    unit_q = kwargs.pop('unit_q', '') or ''
    def_tier = max(1, min(4, int(kwargs.pop('def_tier', 1) or 1)))
    include_skills = kwargs.pop('include_skills', True)
    summary_only = kwargs.pop('summary', False)
    pilot_build = kwargs.pop('pilot_build', None)
    if summary_only:
        kwargs['pilot_build'] = 0
    elif pilot_build is not None:
        kwargs['pilot_build'] = max(0, min(4, int(pilot_build or 0)))
    if isinstance(include_skills, str):
        include_skills = include_skills not in ('0', 'false', 'no', '')
    vigor = _VIGOR_FOR_RANK_MODE.get(rank_mode, kwargs.pop('vigor', 'super') or 'super')
    kwargs.pop('vigor', None)
    cache_key = _master_cache_key(lc, kwargs)
    browse_cache_key = _browse_payload_cache_key(
        lc, rank_mode, page, per_page, unit_q, def_tier, kwargs, summary_only,
    )
    cached_browse = _get_browse_payload_cache(browse_cache_key)
    if cached_browse is not None:
        return cached_browse

    def _do_build(on_progress=None):
        if not _msy_python_build_allowed():
            raise RuntimeError(
                'MSY Python build disabled — run scripts/build_msy_rankings_dc.py and deploy published cache'
            )
        return build_meta_synergy_master(
            lc=lc,
            lb_tier=int(kwargs.get('lb_tier', 3) or 3),
            top_pilots=int(kwargs.get('top_pilots', 20) or 20),
            exclude_pairs=kwargs.get('exclude_pairs'),
            def_unit_override=kwargs.get('def_unit_override'),
            def_char_override=kwargs.get('def_char_override'),
            on_progress=on_progress,
        )

    cached, warming = _ensure_rankings_cache(cache_key, _do_build)
    if warming:
        partial = _rankings_result_cache.get(cache_key)
        if partial and (partial.get('groups') or []):
            kwargs['lc'] = lc
            payload = _cached_payload_from_groups(
                partial.get('groups') or [],
                total_pilot_candidates=partial.get('total_pilot_candidates', 0),
                rank_mode=rank_mode,
                page=page,
                per_page=per_page,
                vigor=vigor,
                def_tier=def_tier,
                kwargs=kwargs,
                unit_q=unit_q,
                cache_key=cache_key,
                include_skills=include_skills,
            )
            payload['warming'] = True
            payload['partial'] = bool(partial.get('partial'))
            payload['retry_after'] = 5
            return payload
        return _warming_payload(rank_mode, vigor, def_tier, kwargs)

    all_groups = cached.get('groups') or []
    kwargs['lc'] = lc
    if summary_only:
        payload = _cached_summary_from_groups(
            all_groups,
            total_pilot_candidates=cached.get('total_pilot_candidates', 0),
            rank_mode=rank_mode,
            page=page,
            per_page=per_page,
            vigor=vigor,
            def_tier=def_tier,
            kwargs=kwargs,
            unit_q=unit_q,
            include_skills=include_skills,
        )
        _set_browse_payload_cache(browse_cache_key, payload)
        return payload
    payload = _cached_payload_from_groups(
        all_groups,
        total_pilot_candidates=cached.get('total_pilot_candidates', 0),
        rank_mode=rank_mode,
        page=page,
        per_page=per_page,
        vigor=vigor,
        def_tier=def_tier,
        kwargs=kwargs,
        unit_q=unit_q,
        cache_key=cache_key,
        include_skills=include_skills,
    )
    if cached.get('legacy'):
        payload['cache_incomplete'] = True
    _set_browse_payload_cache(browse_cache_key, payload)
    return payload


def build_msy_pilot_skills_batch(lc, char_ids, pairs=None):
    """Resolve active skill + unit affinity metadata for MSY pilot cards (lazy load)."""
    lc = lc or 'EN'
    A = _app()
    skills = {}
    affinity = {}
    for raw in char_ids or []:
        cid = A.normalize_id(raw)
        if not cid or cid in skills:
            continue
        skills[cid] = _msy_pilot_active_skills(cid, lc)
    for pair in pairs or []:
        if not isinstance(pair, (list, tuple)) or len(pair) < 2:
            continue
        uid = A.normalize_id(pair[0])
        cid = A.normalize_id(pair[1])
        if not uid or not cid:
            continue
        key = f'{uid}:{cid}'
        if key in affinity:
            continue
        affinity[key] = _msy_pilot_unit_affinities(cid, uid, lc)
    return {'skills_by_char': skills, 'affinity_by_pair': affinity}
