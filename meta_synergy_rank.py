"""
Meta Synergistic Rankings — unit × pilot max-damage pairs using the Firered damage sheet
(same core as static/js/app.js calculateDamage and scripts/tier_rank_comprehensive.py).
"""
from __future__ import annotations

import math
import re
from functools import lru_cache

# Vigor profiles mirror DC_MP in app.js
_VIGOR = {
    'medium': {'dmg_bonus_pct': 0, 'crit_mult_pct': 10},
    'high': {'dmg_bonus_pct': 10, 'crit_mult_pct': 20},
    'max': {'dmg_bonus_pct': 20, 'crit_mult_pct': 20},
    'super': {'dmg_bonus_pct': 30, 'crit_mult_pct': 30},
}

_CRIT125_TRIM_MIN = 356500
_CRIT125_TRIM_DIV = 1181

_DMG_DEALT_RE = re.compile(
    r'damage dealt.{0,16}(\d+)\s*%|'
    r'(\d+)\s*%\s*(?:more|additional).{0,12}damage|'
    r'与(?:え|与)(?:る|与)?.{0,8}?(\d+)\s*[%％].{0,8}?ダメージ|'
    r'造成.{0,8}?(\d+)\s*[%％].{0,8}?傷害',
    re.I,
)
_CRIT_DMG_RE = re.compile(
    r'critical damage.{0,16}(\d+)\s*%|'
    r'(\d+)\s*%\s*critical damage|'
    r'クリティカルダメージ.{0,8}?(\d+)\s*[%％]|'
    r'暴擊傷害.{0,8}?(\d+)\s*[%％]',
    re.I,
)
_DEF_DEBUFF_RE = re.compile(
    r'(?:reduce|decrease).{0,24}(?:enemy|hostile).{0,16}(?:def|defense).{0,12}(\d+)\s*%|'
    r'防御力.{0,12}(\d+)\s*[%％].{0,8}減',
    re.I,
)


def _app():
    import app as A
    return A


def _ldc(lc):
    A = _app()
    return A.get_lang_data(lc)


def _unit_stat_mode(ri):
    ri = str(ri or '1')
    if ri == '5':
        return 'ssp'
    if ri == '4':
        return 'sp'
    return 'normal'


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
    if p <= 35:
        return n
    return n + 1


def _calc_damage_core(unit_atk, char_atk, char_def, unit_def_after, weapon_power, *,
                      def_debuff_pct=0, terrain_pct=0, extra_dmg_pct=0):
    F, C, MX, EXP = math.floor, math.ceil, max, math.exp
    wp = _sim_combat_weapon_power(weapon_power, def_debuff_pct)
    terrain_correction = 1 - terrain_pct / 100
    character_stat_ratio = MX(0, char_atk - char_def) / 5000
    unit_stat_ratio = MX(0, C(unit_atk / 10 - unit_def_after / 10)) / 5000
    char_sigmoid = 1 / (EXP(250 * (char_def - char_atk) / 100000) + 1)
    unit_sigmoid = 1 / (EXP(25 * (unit_def_after - unit_atk) / 100000) + 1)
    base_damage = C((character_stat_ratio + unit_stat_ratio + char_sigmoid + unit_sigmoid) * wp)
    atk_combined = C((unit_atk + 2 * char_atk) / 10)
    def_combined = C((unit_def_after + 2 * char_def) / 10)
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


_ATTACK_ATTR_TO_KEYS = {
    '1': ('Ranged',),
    '2': ('Melee',),
    '3': ('Awaken',),
    '4': ('Ranged', 'Melee'),
    '5': ('Ranged', 'Awaken'),
    '6': ('Melee', 'Awaken'),
    '7': ('Ranged', 'Melee', 'Awaken'),
}

_char_bonus_cache = {}


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


def _pilot_atk_for_weapon(totals, attack_attr):
    keys = _ATTACK_ATTR_TO_KEYS.get(str(attack_attr or '1'), ('Ranged',))
    return float(max(totals.get(k, 0) or 0 for k in keys))


def _char_dmg_bonuses(cid, lc):
    key = (A.normalize_id(cid), lc) if (A := _app()) else (cid, lc)
    if key in _char_bonus_cache:
        return _char_bonus_cache[key]
    A = _app()
    ld = _ldc(lc)
    ldc = A.get_calc_lang_data()
    dmg_dealt = crit_up = 0
    fa = [x for x in A.extract_data_list(A.char_abil) if A.normalize_id(x.get('CharacterId', '')) == A.normalize_id(cid)]
    for ab in fa:
        for bid_key in ('AbilityId', 'SpAbilityId', 'spAbilityId'):
            bid = A.normalize_id(ab.get(bid_key) or '')
            if not bid or bid in ('0', 'None'):
                continue
            name = ld.get('abil_name_map', {}).get(bid, '') or ''
            desc = ld.get('abil_desc_map', {}).get(bid, '') or ''
            blob = f'{name}\n{desc}'
            for m in _DMG_DEALT_RE.finditer(blob):
                for g in m.groups():
                    if g:
                        dmg_dealt = max(dmg_dealt, int(g))
            for m in _CRIT_DMG_RE.finditer(blob):
                for g in m.groups():
                    if g:
                        crit_up = max(crit_up, int(g))
    _char_bonus_cache[key] = (dmg_dealt, crit_up)
    return dmg_dealt, crit_up


def _char_totals(cid, lc):
    A = _app()
    ldc = _ldc(lc)
    cid = A.normalize_id(cid)
    info = A.char_info_map.get(cid) or {}
    ri = str(info.get('rarity', '1'))
    if ri == '5':
        grown = {}
        raw = A.char_stat_map.get(cid, {})
        for s in A.CHAR_STAT_ORDER:
            st = raw.get(s, (0, 0, 0))
            if isinstance(st, (list, tuple)) and len(st) >= 2:
                grown[s] = A.calc_growth_char(st[0], st[1], ri)
            else:
                grown[s] = 0
        totals = A.compute_char_stat_totals_with_abilities(cid, ri, ldc, grown)
        return totals, 'ex'
    grown = {}
    raw = A.char_stat_map.get(cid, {})
    for s in A.CHAR_STAT_ORDER:
        st = raw.get(s, (0, 0, 0))
        if isinstance(st, (list, tuple)) and len(st) >= 2:
            grown[s] = A.calc_growth_char(st[0], st[1], ri)
        else:
            grown[s] = 0
    if ri == '4':
        return A.compute_char_stat_totals_sp_list(cid, ri, ldc, grown), 'sp'
    return A.compute_char_stat_totals_with_abilities(cid, ri, ldc, grown), 'normal'


def _best_ex_weapon(uid, stat_mode, lc):
    A = _app()
    ldc = _ldc(lc)
    ld = ldc
    wtm = ld.get('weapon_trait_map', {}) or {}
    wcm = ld.get('weapon_capability_map', {}) or {}
    wtdm = ld.get('weapon_trait_detail_map', {}) or {}
    best = None
    best_power = -1
    best_debuff = 0
    for wp in A.unit_weapon_map.get(A.normalize_id(uid), []) or []:
        wid = A.normalize_id(wp.get('id'))
        wm = A.weapon_info_map.get(wid, {})
        wt = str(wm.get('weapon_type', '1') or '1')
        if wt != '2':
            continue
        try:
            ws = A.resolve_weapon_stats(
                wm, A.weapon_status_map, A.weapon_correction_map,
                wtm, wcm, A.growth_pattern_map, A.weapon_trait_change_map, wtdm,
                wid=wid, lang_code=lc, unit_id=uid,
            )
        except Exception:
            continue
        levels = ws.get('levels') or {}
        power = int(ws.get('power', 0) or 0)
        if isinstance(levels, dict) and levels:
            mx_lv = max(int(k) for k in levels.keys() if str(k).isdigit())
            power = max(power, int((levels.get(mx_lv) or levels.get(str(mx_lv)) or {}).get('power', 0) or 0))
        debuff = 0
        for line in A.iter_unit_weapon_trait_texts(uid, ld, lc, stat_mode=stat_mode):
            b, v = A.parse_enemy_def_debuff_pcts_from_trait_text(line)
            debuff = max(debuff, b, v)
        if power > best_power:
            best_power = power
            best_debuff = debuff
            best = {'wid': wid, 'wm': wm, 'ws': ws, 'power': power, 'debuff': debuff,
                    'attr': wm.get('attack_attribute', '1')}
    return best


def _unit_atk(uid, info, stat_mode, cond=True):
    A = _app()
    block = A._unit_max_lb_stat_block(uid, info, A.unit_stat_map.get(uid, {}), _ldc(A.DEFAULT_LANG))
    if not block:
        return 0
    fs = A._unit_lb_row_to_api(block, stat_mode, cond)
    return int(fs.get('ATK', 0) or 0)


def _pair_unit_mod_pct(char_id, unit_id):
    A = _app()
    row = (A.CHAR_PAIR_UNIT_STAT_MOD_PCT.get(A.normalize_id(char_id)) or {}).get(A.normalize_id(unit_id))
    return int(row or 0)


_unit_weapon_cache = {}
_char_totals_cache = {}
_rankings_result_cache = {}


def _cached_best_ex_weapon(uid, stat_mode, lc):
    key = (str(uid), str(stat_mode), str(lc))
    if key not in _unit_weapon_cache:
        _unit_weapon_cache[key] = _best_ex_weapon(uid, stat_mode, lc)
    return _unit_weapon_cache[key]


def _cached_char_totals(cid, lc):
    key = (str(cid), str(lc))
    if key not in _char_totals_cache:
        _char_totals_cache[key] = _char_totals(cid, lc)
    return _char_totals_cache[key]


def compute_pair_damage(uid, cid, lc='EN', *, lb_tier=3, vigor='super', cond=True,
                        def_total=25072, def_char_def=705, def_debuff_pct=40, wpn=None):
    A = _app()
    uid = A.normalize_id(uid)
    cid = A.normalize_id(cid)
    if cid not in A.char_list_playable_ids:
        return None
    info = A.unit_info_map.get(uid)
    if not info:
        return None
    ri = str(info.get('rarity', '1'))
    stat_mode = _unit_stat_mode(ri)
    if wpn is None:
        wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not wpn or wpn['power'] <= 0:
        return None
    unit_atk = float(_unit_atk(uid, info, stat_mode, cond))
    pair_pct = _pair_unit_mod_pct(cid, uid)
    if pair_pct and cond:
        unit_atk = unit_atk * (100 + pair_pct) / 100
    totals, _ = _cached_char_totals(cid, lc)
    char_atk = _pilot_atk_for_weapon(totals, wpn.get('attr'))
    char_def = float(totals.get('Defense', 0) or 0)
    dmg_dealt, crit_up = _char_dmg_bonuses(cid, lc)
    vp = _VIGOR.get(vigor) or _VIGOR['super']
    def_debuff = max(int(def_debuff_pct or 0), int(wpn.get('debuff') or 0))
    unit_def_after = _sim_def_after_debuff(def_total, 0, def_debuff)
    normal, battle, cwp = _calc_damage_core(
        unit_atk, char_atk, char_def, unit_def_after, wpn['power'],
        def_debuff_pct=def_debuff,
        extra_dmg_pct=dmg_dealt + vp['dmg_bonus_pct'] + def_debuff,
    )
    plain_crit, super_crit = _calc_crit_damage(
        battle, cwp,
        extra_dmg_pct=dmg_dealt + vp['dmg_bonus_pct'] + def_debuff,
        crit_dmg_up_pct=crit_up,
        vigor=vigor,
    )
    crit_rate = int(wpn['ws'].get('critical', 0) or 0) if wpn.get('ws') else 0
    expected = int(normal * (100 - crit_rate) / 100 + super_crit * crit_rate / 100)
    return {
        'normal_dmg': normal,
        'crit_dmg': plain_crit,
        'super_crit_dmg': super_crit,
        'expected_dmg': expected,
        'crit_rate': crit_rate,
        'weapon_power': wpn['power'],
        'def_debuff_pct': def_debuff,
    }


def _entity_brief_unit(uid, lc):
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    ri = str(info.get('rarity', '1'))
    name = _resolve_unit_name(uid, lc)
    thum = A.find_list_thumb(info.get('resource_ids', []), uid, 'images/unit_portraits')
    return {
        'id': uid,
        'name': name,
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
    name = _resolve_char_name(cid, lc)
    thum = A.find_list_thumb(info.get('resource_ids', []), cid, 'images/character_portraits')
    return {
        'id': cid,
        'name': name,
        'thum': thum or '',
        'rarity': A.RARITY_MAP.get(ri, 'N'),
        'rarity_id': ri,
        'rarity_icon': A.RARITY_ICON_MAP.get(ri, ''),
        'role': A.resolve_role_label(info.get('role', '0'), lc),
        'role_id': str(info.get('role', '0')),
        'role_icon': A.ROLE_ICON_MAP.get(str(info.get('role', '0')), ''),
    }


def _weapon_elem_label(uid, lc):
    A = _app()
    stat_mode = _unit_stat_mode((A.unit_info_map.get(A.normalize_id(uid)) or {}).get('rarity', '1'))
    wpn = _best_ex_weapon(uid, stat_mode, lc)
    if not wpn:
        return ''
    wm = wpn.get('wm') or {}
    attr = str(wm.get('attack_attribute', '1') or '1')
    labels = {'1': 'Beam', '2': 'Physical', '3': 'Special', '7': 'Special'}
    return labels.get(attr, 'Mixed')


@lru_cache(maxsize=1)
def _pilot_pool_ids():
    A = _app()
    return tuple(sorted(A.char_list_playable_ids))


def build_meta_synergy_rankings(
    lc='EN',
    *,
    unit_rarity='UR',
    unit_role='1',
    pilot_rarity='ALL',
    pilot_roles=None,
    metric='super_crit',
    vigor='super',
    lb_tier=3,
    top_pilots=10,
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
    pilot_roles = pilot_roles or ('1', '2', '3')
    pilot_role_set = {str(r) for r in pilot_roles}
    rarity_filter = None if not unit_rarity or unit_rarity.upper() == 'ALL' else unit_rarity.upper()
    pilot_rarity_filter = None if not pilot_rarity or pilot_rarity.upper() == 'ALL' else pilot_rarity.upper()

    unit_rows = []
    q_lower = (unit_q or '').strip().lower()
    for uid in sorted(A.unit_list_playable_ids):
        info = A.unit_info_map.get(uid)
        if not info:
            continue
        ri = str(info.get('rarity', '1'))
        role = str(info.get('role', '0'))
        if rarity_filter and A.RARITY_MAP.get(ri, 'N') != rarity_filter:
            continue
        if unit_role and unit_role != 'ALL' and role != str(unit_role):
            continue
        name = _resolve_unit_name(uid, lc).lower()
        if q_lower and q_lower not in name and q_lower not in uid:
            continue
        wpn = _cached_best_ex_weapon(uid, _unit_stat_mode(ri), lc)
        if not wpn:
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

    groups = []
    metric_key = {
        'normal': 'normal_dmg',
        'crit': 'crit_dmg',
        'super_crit': 'super_crit_dmg',
        'expected': 'expected_dmg',
    }.get(metric, 'super_crit_dmg')

    for uid in unit_rows:
        info = A.unit_info_map.get(uid) or {}
        ri = str(info.get('rarity', '1'))
        stat_mode = _unit_stat_mode(ri)
        unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
        pairs = []
        for cid in pilot_ids:
            if (uid, cid) in exclude:
                continue
            dmg = compute_pair_damage(uid, cid, lc, lb_tier=lb_tier, vigor=vigor, wpn=unit_wpn)
            if not dmg:
                continue
            score = dmg.get(metric_key, 0) or 0
            if score <= 0:
                continue
            pairs.append((score, cid, dmg))
        if not pairs:
            continue
        pairs.sort(key=lambda x: (-x[0], x[1]))
        top = pairs[: max(1, int(top_pilots or 10))]
        max_score = top[0][0]
        groups.append({
            'unit': _entity_brief_unit(uid, lc),
            'weapon_elems': _weapon_elem_label(uid, lc),
            'max_damage': max_score,
            'metric': metric,
            'pilots': [
                {
                    'rank': i + 1,
                    'char': _entity_brief_char(cid, lc),
                    'normal_dmg': d['normal_dmg'],
                    'crit_dmg': d['crit_dmg'],
                    'super_crit_dmg': d['super_crit_dmg'],
                    'expected_dmg': d['expected_dmg'],
                    'crit_rate': d['crit_rate'],
                    'score': sc,
                }
                for i, (sc, cid, d) in enumerate(top)
            ],
        })

    groups.sort(key=lambda g: (-g['max_damage'], g['unit']['name'].lower()))
    total = len(groups)
    page = max(1, int(page or 1))
    per_page = max(1, min(100, int(per_page or 50)))
    start = (page - 1) * per_page
    page_groups = groups[start:start + per_page]
    total_pages = max(1, (total + per_page - 1) // per_page)

    return {
        'groups': page_groups,
        'all_groups': groups,
        'total': total,
        'total_pilot_candidates': len(pilot_ids),
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
        'metric': metric,
        'vigor': vigor,
        'settings': {
            'unit_rarity': unit_rarity,
            'unit_role': unit_role,
            'pilot_rarity': pilot_rarity,
            'pilot_roles': list(pilot_role_set),
            'lb_tier': lb_tier,
            'defender_note': 'Reference defender DEF 25,072 (−40% debuff applied)',
        },
    }


def build_meta_synergy_rankings_cached(lc='EN', **kwargs):
    """Cache full ranking scans (expensive); pagination applied after cache hit."""
    page = max(1, int(kwargs.pop('page', 1) or 1))
    per_page = max(1, min(100, int(kwargs.pop('per_page', 50) or 50)))
    cache_key = (
        lc or 'EN',
        kwargs.get('unit_rarity', 'UR'),
        kwargs.get('unit_role', '1'),
        kwargs.get('pilot_rarity', 'ALL'),
        tuple(sorted(str(r) for r in (kwargs.get('pilot_roles') or ('1', '2', '3')))),
        kwargs.get('metric', 'super_crit'),
        kwargs.get('vigor', 'super'),
        int(kwargs.get('lb_tier', 3) or 3),
        int(kwargs.get('top_pilots', 10) or 10),
        (kwargs.get('unit_q') or '').strip().lower(),
        tuple(tuple(p) for p in (kwargs.get('exclude_pairs') or ())),
    )
    if cache_key not in _rankings_result_cache:
        raw = build_meta_synergy_rankings(lc=lc, page=1, per_page=10000, **kwargs)
        _rankings_result_cache[cache_key] = raw.get('all_groups') or raw.get('groups') or []
    all_groups = _rankings_result_cache[cache_key]
    total = len(all_groups)
    start = (page - 1) * per_page
    page_groups = all_groups[start:start + per_page]
    total_pages = max(1, (total + per_page - 1) // per_page)
    metric = kwargs.get('metric', 'super_crit')
    vigor = kwargs.get('vigor', 'super')
    pilot_role_set = {str(r) for r in (kwargs.get('pilot_roles') or ('1', '2', '3'))}
    return {
        'groups': page_groups,
        'all_groups': all_groups,
        'total': total,
        'total_pilot_candidates': 0,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
        'metric': metric,
        'vigor': vigor,
        'settings': {
            'unit_rarity': kwargs.get('unit_rarity', 'UR'),
            'unit_role': kwargs.get('unit_role', '1'),
            'pilot_rarity': kwargs.get('pilot_rarity', 'ALL'),
            'pilot_roles': list(pilot_role_set),
            'lb_tier': int(kwargs.get('lb_tier', 3) or 3),
            'defender_note': 'Reference defender DEF 25,072 (−40% debuff applied)',
        },
    }
