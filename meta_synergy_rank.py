"""
Meta Synergistic Rankings — max-damage unit × pilot pairs mirroring the Damage Simulator
(calculateDamage in static/js/app.js): CP on, max Supercharged EX tier, paired traits,
active skills, super vigor, NPC DEF tiers.
"""
from __future__ import annotations

import gzip
import json
import math
import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    r'[Ii]ncreases?\s+(?:own\s+)?damage\s+dealt.{0,24}by\s*(\d+)%|'
    r'對敵方造成的損傷提升(\d+)%',
    re.I,
)
_SKILL_ATK_RE = re.compile(
    r'[Ii]ncreases?\s+(?:own\s+)?(?:Ranged|Melee|Awaken)\s+(?:and\s+(?:Ranged|Melee|Awaken)\s+)?by\s*(\d+)%|'
    r'自身(射擊值|格鬥值|覺醒值).{0,12}提升(\d+)%',
    re.I,
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


def _pilot_atk_for_weapon(totals, attack_attr, skill_atk_pct=0):
    keys = _ATTACK_ATTR_TO_KEYS.get(str(attack_attr or '1'), ('Ranged',))
    vals = []
    for k in keys:
        v = float(totals.get(k, 0) or 0)
        if skill_atk_pct and v > 0:
            v += math.floor(v * skill_atk_pct / 100)
        vals.append(v)
    return max(vals) if vals else 0.0


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
    A = _app()
    cid = A.normalize_id(cid)
    info = A.char_info_map.get(cid) or {}
    ri = str(info.get('rarity', '1'))
    raw = A.char_stat_map.get(cid, {})
    grown = {}
    for s in A.CHAR_STAT_ORDER:
        st = raw.get(s, (0, 0, 0))
        if isinstance(st, (list, tuple)) and len(st) >= 2:
            grown[s] = A.calc_growth_char(st[0], st[1], ri)
        else:
            grown[s] = 0
    return grown, ri


def _char_totals_for_pair_max(cid, uid, lc):
    """CP on: conditional + max Supercharged EX tier + pair-gated traits when unit matches."""
    A = _app()
    ldc = _calc_lang_data()
    cid = A.normalize_id(cid)
    uid = A.normalize_id(uid)
    grown, _ = _char_grown(cid)
    ac = _build_char_ac_calc(cid, lc)
    buckets = A._accumulate_character_trait_percent_buckets(ac, cid, ldc)
    spbn_u, spbn_c, spbn_pair, spen, spen_pair = buckets[0], buckets[1], buckets[2], buckets[3], buckets[4]
    trait_pair_unit_ids = buckets[10]
    pair_ok = _pair_ok_for_unit(uid, cid, trait_pair_unit_ids)
    ex_tiers = A.collect_supercharged_ex_stat_tiers(ac, cid)
    totals = {}
    if ex_tiers:
        tier = ex_tiers[-1]
        for s in A.CHAR_STAT_ORDER:
            bv = grown.get(s, 0)
            pct = spbn_u[s] + spbn_c[s] + tier['ex_pct'][s]
            if pair_ok:
                pct += spbn_pair[s] + spen_pair[s]
            totals[s] = bv + math.floor(bv * pct / 100) if bv > 0 else 0
    else:
        for s in A.CHAR_STAT_ORDER:
            bv = grown.get(s, 0)
            pct = spbn_u[s] + spbn_c[s] + spen[s]
            if pair_ok:
                pct += spbn_pair[s] + spen_pair[s]
            totals[s] = bv + math.floor(bv * pct / 100) if bv > 0 else 0
    return totals, pair_ok


def _char_guaranteed_crit(cid, lc):
    A = _app()
    for bab in _build_char_ac_calc(cid, lc):
        for blob_src in (bab, bab.get('sp_replacement') or {}):
            if not blob_src:
                continue
            parts = [str(blob_src.get('name') or '')]
            for d2 in blob_src.get('details') or []:
                parts.append(str((d2 or {}).get('text') or d2 or ''))
            if _GUARANTEED_CRIT_RE.search('\n'.join(parts)):
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
                has_cond = bool(cond_groups) or bool(
                    re.search(r'when\s+|if\s+|搭乗|時', txt, re.I)
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
                            dmg_dealt = max(dmg_dealt, int(g))
                for m in _CRIT_DMG_RE.finditer(txt):
                    for g in m.groups():
                        if g:
                            crit_up = max(crit_up, int(g))
    return dmg_dealt, crit_up


def _char_skill_bonuses(cid, lc):
    A = _app()
    ld = _ldc(lc)
    cid = A.normalize_id(cid)
    dmg = 0
    atk_pct = 0
    fs = [x for x in A.extract_data_list(A.char_skill) if A.normalize_id(x.get('CharacterId', '')) == cid]
    seen = set()
    for sk in sorted(fs, key=lambda x: int(x.get('SortOrder', 0))):
        sid = A.normalize_id(sk.get('CharacterSkillId') or sk.get('SkillId') or '')
        if not sid or sid in seen or sid == '0':
            continue
        seen.add(sid)
        resolved = A.resolve_char_skill(sid, ld, int(sk.get('SortOrder', 0)), False)
        blob = '\n'.join(
            str(x.get('text') if isinstance(x, dict) else x or '')
            for x in (resolved.get('details') or [])
        ) + '\n' + str(resolved.get('desc') or '')
        for m in _SKILL_DMG_RE.finditer(blob):
            for g in m.groups():
                if g and str(g).isdigit():
                    dmg = max(dmg, int(g))
        for m in _SKILL_ATK_RE.finditer(blob):
            g = m.group(m.lastindex)
            if g and str(g).isdigit():
                atk_pct = max(atk_pct, int(g))
    return dmg, atk_pct


def _weapon_def_debuff_from_ws(ws, wm, uid, ld, lc, stat_mode):
    A = _app()
    debuff = 0
    for tr in (ws.get('traits') or []):
        b, v = A.parse_enemy_def_debuff_pcts_from_trait_text(str(tr or ''))
        debuff = max(debuff, b, v)
    levels = ws.get('levels') or {}
    level_rows = levels.values() if isinstance(levels, dict) else levels
    for lv in level_rows or []:
        if isinstance(lv, dict):
            for tr in (lv.get('traits') or []):
                b, v = A.parse_enemy_def_debuff_pcts_from_trait_text(str(tr or ''))
                debuff = max(debuff, b, v)
    sm = (stat_mode or 'normal').strip().lower()
    if sm == 'ssp':
        wid = A.normalize_id(wm.get('id'))
        mwid = A.normalize_id(wm.get('main_weapon_id') or '0')
        for cid2 in (wid, mwid):
            if not cid2 or cid2 == '0':
                continue
            for tid in A.unit_ssp_weapon_effect_map.get(cid2) or []:
                tt = (ld.get('weapon_trait_detail_map', {}) or {}).get(tid, '')
                b, v = A.parse_enemy_def_debuff_pcts_from_trait_text(str(tt or ''))
                debuff = max(debuff, b, v)
            break
    return debuff


def _weapon_entry_power(ws):
    power = int(ws.get('power', 0) or 0)
    levels = ws.get('levels') or {}
    if isinstance(levels, dict) and levels:
        mx_lv = max(int(k) for k in levels.keys() if str(k).isdigit())
        power = max(power, int((levels.get(mx_lv) or levels.get(str(mx_lv)) or {}).get('power', 0) or 0))
    return power


def _best_ranking_weapon(uid, stat_mode, lc):
    """Highest-power non-map weapon (active + normal), matching Damage Simulator weapon list."""
    A = _app()
    ldc = _ldc(lc)
    wtm = ldc.get('weapon_trait_map', {}) or {}
    wcm = ldc.get('weapon_capability_map', {}) or {}
    wtdm = ldc.get('weapon_trait_detail_map', {}) or {}
    best = None
    best_power = -1
    for wp in A.unit_weapon_map.get(A.normalize_id(uid), []) or []:
        wid = A.normalize_id(wp.get('id'))
        wm = A.weapon_info_map.get(wid, {})
        wt = str(wm.get('weapon_type', '1') or '1')
        if wt == '3':
            continue
        try:
            ws = A.resolve_weapon_stats(
                wm, A.weapon_status_map, A.weapon_correction_map,
                wtm, wcm, A.growth_pattern_map, A.weapon_trait_change_map, wtdm,
                wid=wid, lang_code=lc, unit_id=uid,
            )
        except Exception:
            continue
        power = _weapon_entry_power(ws)
        if power <= 0:
            continue
        debuff = _weapon_def_debuff_from_ws(ws, wm, uid, ldc, lc, stat_mode)
        if power > best_power:
            best_power = power
            best = {'wid': wid, 'wm': wm, 'ws': ws, 'power': power, 'debuff': debuff,
                    'attr': wm.get('attack_attribute', '1'), 'weapon_type': wt}
    return best


def _best_ex_weapon(uid, stat_mode, lc):
    """Legacy alias — ranking uses best non-map weapon, not EX-only."""
    return _best_ranking_weapon(uid, stat_mode, lc)


def _unit_atk_max(uid, info, stat_mode, lc, cid, pair_ok):
    A = _app()
    ldc = _ldc(lc)
    block = A._unit_max_lb_stat_block(uid, info, A.unit_stat_map.get(uid, {}), ldc)
    if not block:
        return 0
    fs = A._unit_lb_row_to_api(block, stat_mode, True)
    unit_atk = float(fs.get('ATK', 0) or 0)
    row = (A.CHAR_PAIR_UNIT_STAT_MOD_PCT.get(A.normalize_id(cid)) or {}).get(A.normalize_id(uid))
    if pair_ok and row:
        atk_pct = int(row.get('atk_pct') or 0) if isinstance(row, dict) else (int(row) if isinstance(row, int) else 0)
        if atk_pct:
            unit_atk = math.floor(unit_atk * (100 + atk_pct) / 100)
    return unit_atk


_unit_weapon_cache = {}
_char_pair_cache = {}
_rankings_result_cache = {}
_rankings_build_lock = threading.Lock()
_rankings_inflight = set()
_MSY_DISK_VERSION = 'v8'
_MSY_BUILD_WORKERS = max(1, min(4, int(os.environ.get('MSY_BUILD_WORKERS', '1') or '1')))

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


def _load_master_from_disk(cache_key):
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
    return None


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
    key = (str(uid), str(stat_mode), str(lc))
    if key not in _unit_weapon_cache:
        _unit_weapon_cache[key] = _best_ex_weapon(uid, stat_mode, lc)
    return _unit_weapon_cache[key]


def _cached_char_pair_totals(cid, uid, lc):
    key = (str(cid), str(uid), str(lc))
    if key not in _char_pair_cache:
        _char_pair_cache[key] = _char_totals_for_pair_max(cid, uid, lc)
    return _char_pair_cache[key]


def compute_pair_damage(uid, cid, lc='EN', *, lb_tier=3, vigor='super', def_tier=1,
                        def_unit_override=None, def_char_override=None, wpn=None):
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

    def_total, defender_char_def, def_label = _resolve_defender_stats(
        def_tier, def_unit_override=def_unit_override, def_char_override=def_char_override,
    )
    tier_key = max(1, min(4, int(def_tier or 1)))

    totals, pair_ok = _cached_char_pair_totals(cid, uid, lc)
    skill_dmg, skill_atk_pct = _char_skill_bonuses(cid, lc)
    char_atk = _pilot_atk_for_weapon(totals, wpn.get('attr'), skill_atk_pct)
    unit_atk = _unit_atk_max(uid, info, stat_mode, lc, cid, pair_ok)

    dmg_dealt, crit_up = _char_pilot_dmg_bonuses(cid, uid, lc, cp_on=True)
    dmg_dealt += skill_dmg
    guaranteed_crit = _char_guaranteed_crit(cid, lc)

    vp = _VIGOR.get(vigor) or _VIGOR['super']
    def_debuff = min(_DEF_DEBUFF_CAP, max(0, int(wpn.get('debuff') or 0)))
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
    crit_rate = int(wpn['ws'].get('critical', 0) or 0) if wpn.get('ws') else 0
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
    }


def _bundled_pilot_id(uid):
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
    rec = A.normalize_id(info.get('recommend_character_id') or '0')
    if rec == '0':
        rec = A.normalize_id(A.MANUAL_UNIT_RECOMMEND_CHARACTER_MAP.get(uid, '0'))
    if rec != '0' and rec in A.char_info_map:
        return rec
    return None


def _is_sd_unit(uid, info=None):
    A = _app()
    info = info or A.unit_info_map.get(A.normalize_id(uid)) or {}
    return A._unit_has_sd_mechanism(info, uid)


def _eligible_pilots_for_unit(uid, pilot_ids, exclude):
    uid = _app().normalize_id(uid)
    if _is_sd_unit(uid):
        bp = _bundled_pilot_id(uid)
        if not bp or (uid, bp) in exclude:
            return []
        return [bp]
    out = []
    for cid in pilot_ids:
        if (uid, cid) in exclude:
            continue
        if not _pilot_role_matches_unit(uid, cid):
            continue
        out.append(cid)
    return out


def _filter_non_ur(pilot_ids):
    A = _app()
    out = []
    for cid in pilot_ids:
        ri = str((A.char_info_map.get(cid) or {}).get('rarity', '1'))
        if A.RARITY_MAP.get(ri, 'N') != 'UR':
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
                    'vigor': vigor_key,
                    'score': sc,
                }
                for i, (sc, cid, d) in enumerate(top)
            ],
        }
    return rankings


def _multi_vigor_pairs_for_candidates(uid, candidates, lc, lb_tier, def_tier, unit_wpn, *,
                                      def_unit_override=None, def_char_override=None):
    pairs = []
    for cid in candidates:
        by_vigor = {}
        for v in _MSY_VIGOR_LEVELS:
            dmg = compute_pair_damage(
                uid, cid, lc, lb_tier=lb_tier, vigor=v,
                def_tier=def_tier, def_unit_override=def_unit_override,
                def_char_override=def_char_override, wpn=unit_wpn,
            )
            if dmg:
                by_vigor[v] = dmg
        if by_vigor:
            pairs.append((cid, by_vigor))
    return pairs


def _best_pilot_by_stat(uid, pilot_ids, wpn, lc, exclude):
    if not wpn:
        return None
    eligible = _eligible_pilots_for_unit(uid, pilot_ids, exclude)
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


def _cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc):
    """Unit×pilot damage proxy for prefilter (skills, affinity, pair ATK)."""
    totals, pair_ok = _cached_char_pair_totals(cid, uid, lc)
    skill_dmg, skill_atk_pct = _char_skill_bonuses(cid, lc)
    char_atk = _pilot_atk_for_weapon(totals, unit_wpn.get('attr'), skill_atk_pct)
    unit_atk = _unit_atk_max(uid, info, stat_mode, lc, cid, pair_ok)
    dmg_dealt, crit_up = _char_pilot_dmg_bonuses(cid, uid, lc, cp_on=True)
    wp = float(unit_wpn.get('power') or 0)
    score = (unit_atk + 2.0 * char_atk) * wp
    if dmg_dealt or crit_up:
        score *= (1.0 + (dmg_dealt + crit_up) / 100.0)
    if pair_ok:
        score *= 1.12
    score += float(skill_dmg) * 500.0
    return score


def _build_single_unit_group(uid, pilot_ids, lc, lb_tier, vigor, def_tier, exclude, top_pilots, metric, *,
                             def_unit_override=None, def_char_override=None, def_tiers=None):
    A = _app()
    info = A.unit_info_map.get(uid) or {}
    stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
    unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
    if not unit_wpn:
        return None

    active_pilots = _eligible_pilots_for_unit(uid, pilot_ids, exclude)
    if not active_pilots:
        return None

    need = max(_TOP_PILOTS_PREFILTER, int(top_pilots or 10) + 8)
    if len(active_pilots) <= _FULL_SIM_PILOT_CAP:
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

    def _pairs_for_tier(dt):
        return _multi_vigor_pairs_for_candidates(
            uid, candidates, lc, lb_tier, dt, unit_wpn,
            def_unit_override=def_unit_override, def_char_override=def_char_override,
        )

    def _rankings_no_ur_for_tier(dt, all_pairs):
        non_ur = _filter_non_ur(active_pilots)
        if len(non_ur) >= len(active_pilots):
            return _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
        nu_cids = set(non_ur)
        all_pairs_nu = [(cid, bv) for cid, bv in all_pairs if cid in nu_cids]
        if not all_pairs_nu and non_ur:
            nu_scored = []
            for cid in non_ur:
                nu_scored.append((
                    _cheap_pilot_score(uid, cid, info, unit_wpn, stat_mode, lc),
                    cid,
                ))
            nu_scored.sort(key=lambda x: (-x[0], x[1]))
            nu_candidates = [cid for _, cid in nu_scored[:need]]
            all_pairs_nu = _multi_vigor_pairs_for_candidates(
                uid, nu_candidates, lc, lb_tier, dt, unit_wpn,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
            )
        return _rankings_from_multi_vigor_pairs(all_pairs_nu, top_pilots, lc)

    if use_multi_tier:
        rankings_by_tier = {}
        rankings_no_ur_by_tier = {}
        for dt in tiers:
            pairs = _pairs_for_tier(dt)
            if not pairs:
                continue
            rk = _rankings_from_multi_vigor_pairs(pairs, top_pilots, lc)
            if rk:
                rankings_by_tier[int(dt)] = rk
                rankings_no_ur_by_tier[int(dt)] = _rankings_no_ur_for_tier(dt, pairs)
        if not rankings_by_tier:
            return None
        dt_primary = int(def_tier) if int(def_tier) in rankings_by_tier else next(iter(rankings_by_tier))
        rankings = rankings_by_tier[dt_primary]
        rankings_no_ur = rankings_no_ur_by_tier.get(dt_primary) or rankings
    else:
        dt = int(tiers[0])
        all_pairs = _pairs_for_tier(dt)
        if not all_pairs:
            return None
        rankings = _rankings_from_multi_vigor_pairs(all_pairs, top_pilots, lc)
        if not rankings:
            return None
        rankings_no_ur = _rankings_no_ur_for_tier(dt, all_pairs)
        rankings_by_tier = None
        rankings_no_ur_by_tier = None

    primary = rankings.get('super_crit') or rankings.get('crit') or rankings.get('normal')
    is_sd = _is_sd_unit(uid, info)
    out = {
        'unit': _entity_brief_unit(uid, lc),
        'weapon_elems': _weapon_elem_label(uid, lc),
        'rankings': rankings,
        'rankings_no_ur': rankings_no_ur,
        'max_damage': primary['max_damage'],
        'metric': metric,
        'pilots': primary['pilots'],
        'is_sd': is_sd,
        'bundled_pilot_id': _bundled_pilot_id(uid) if is_sd else None,
    }
    if rankings_by_tier:
        out['rankings_by_tier'] = rankings_by_tier
        out['rankings_no_ur_by_tier'] = rankings_no_ur_by_tier
    return out


def _build_all_unit_groups(unit_ids, pilot_ids, lc, lb_tier, vigor, def_tier, exclude, top_pilots, metric, *,
                             def_unit_override=None, def_char_override=None, def_tiers=None,
                             on_progress=None):
    if not unit_ids:
        return []
    groups = []
    workers = min(_MSY_BUILD_WORKERS, max(1, len(unit_ids)))
    if workers <= 1:
        for uid in unit_ids:
            try:
                g = _build_single_unit_group(
                    uid, pilot_ids, lc, lb_tier, vigor, def_tier, exclude, top_pilots, metric,
                    def_unit_override=def_unit_override, def_char_override=def_char_override,
                    def_tiers=def_tiers,
                )
                if g:
                    groups.append(g)
                    if on_progress:
                        on_progress(list(groups))
            except Exception as e:
                print(f'MSY unit build error: {e}')
        return groups
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [
            ex.submit(
                _build_single_unit_group, uid, pilot_ids, lc, lb_tier, vigor,
                def_tier, exclude, top_pilots, metric,
                def_unit_override=def_unit_override, def_char_override=def_char_override,
                def_tiers=def_tiers,
            )
            for uid in unit_ids
        ]
        for fut in as_completed(futs):
            try:
                g = fut.result()
                if g:
                    groups.append(g)
                    if on_progress and len(groups) % 5 == 0:
                        on_progress(list(groups))
            except Exception as e:
                print(f'MSY unit build error: {e}')
    if on_progress and groups:
        on_progress(list(groups))
    return groups


def _entity_brief_unit(uid, lc):
    A = _app()
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid) or {}
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
    u, c, label = _resolve_defender_stats(
        def_tier, def_unit_override=def_unit_override, def_char_override=def_char_override,
    )
    return (
        f"Max-damage sim: CP on, active skills, LB3; pilots matched to unit role. "
        f"Super Crit @ Super vigor, Crit @ Max, Normal @ High. "
        f"Difficulty ({label}): MS DEF {u:,}, pilot DEF {c:,} "
        f"(weapon DEF debuff capped at {_DEF_DEBUFF_CAP}%)"
    )


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
    primary = rankings.get('super_crit') or rankings.get('crit') or rankings.get('normal')
    if not primary:
        return None
    return {
        'unit': g.get('unit'),
        'weapon_elems': g.get('weapon_elems'),
        'rankings': rankings,
        'rankings_no_ur': rnub or rankings,
        'max_damage': primary.get('max_damage', 0),
        'metric': g.get('metric'),
        'pilots': primary.get('pilots') or [],
        'is_sd': g.get('is_sd', False),
        'bundled_pilot_id': g.get('bundled_pilot_id'),
    }


def _filter_groups_by_unit_q(groups, unit_q, lc):
    q_lower = (unit_q or '').strip().lower()
    if not q_lower:
        return groups
    out = []
    for g in groups:
        u = g.get('unit') or {}
        uid = str(u.get('id') or '')
        name = str(u.get('name') or '').lower()
        if q_lower in name or q_lower in uid.lower():
            out.append(g)
    return out


def _unit_matches_q(uid, info, unit_q, lc):
    q_lower = (unit_q or '').strip().lower()
    if not q_lower:
        return True
    uid = _app().normalize_id(uid)
    name = _resolve_unit_name(uid, lc).lower()
    return q_lower in name or q_lower in uid.lower()


def _browse_request_active(browse, unit_q):
    if (unit_q or '').strip():
        return True
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


def _ordered_unit_ids_for_browse(unit_ids, master_groups, lc, kwargs, rank_mode):
    by_uid = {}
    for g in master_groups or []:
        uid = _app().normalize_id((g.get('unit') or {}).get('id'))
        if uid:
            by_uid[uid] = g
    scored = []
    for uid in unit_ids:
        uid = _app().normalize_id(uid)
        g = by_uid.get(uid)
        if g:
            rk = g.get('rankings') or {}
            block = rk.get(rank_mode) or rk.get('super_crit') or rk.get('crit') or rk.get('normal') or {}
            sc = block.get('max_damage') or g.get('max_damage') or 0
        else:
            sc = _cheap_unit_peak_score(uid, lc, kwargs)
        scored.append((sc, uid))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [uid for _, uid in scored]


def _resolve_groups_for_unit_ids(unit_ids, master_groups, lc, kwargs, *, browse_fast=False):
    A = _app()
    by_uid = {}
    for g in master_groups or []:
        uid = A.normalize_id((g.get('unit') or {}).get('id'))
        if uid:
            by_uid[uid] = g
    out = []
    to_build = []
    for uid in unit_ids:
        uid = A.normalize_id(uid)
        if uid in by_uid:
            out.append(by_uid[uid])
        else:
            to_build.append(uid)
    if to_build:
        exclude = _exclude_set_from_kwargs(kwargs)
        top_p = 10 if browse_fast else int(kwargs.get('top_pilots', 20) or 20)
        built = _build_all_unit_groups(
            to_build,
            list(_pilot_pool_ids()),
            lc,
            int(kwargs.get('lb_tier', 3) or 3),
            'super',
            1,
            exclude,
            top_p,
            'super_crit',
            def_unit_override=kwargs.get('def_unit_override'),
            def_char_override=kwargs.get('def_char_override'),
            def_tiers=None if browse_fast else _MSY_STD_DEF_TIERS,
        )
        out.extend(built)
    return out


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
        '_v8_master',
        lc or 'EN',
        int(kwargs.get('lb_tier', 3) or 3),
        int(kwargs.get('top_pilots', 20) or 20),
        kwargs.get('def_unit_override'),
        kwargs.get('def_char_override'),
    )


def build_meta_synergy_master(lc='EN', *, lb_tier=3, top_pilots=20, exclude_pairs=None,
                            def_unit_override=None, def_char_override=None, on_progress=None):
    """One-time full rankings build (all units, all roles). Filters applied afterward."""
    A = _app()
    lc = lc or A.DEFAULT_LANG
    exclude = set()
    for p in exclude_pairs or []:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            exclude.add((A.normalize_id(p[0]), A.normalize_id(p[1])))

    pilot_ids = list(_pilot_pool_ids())
    unit_ids = _msy_default_master_unit_ids(lc)

    use_multi_tier = not def_unit_override and not def_char_override
    def_tiers = _MSY_STD_DEF_TIERS if use_multi_tier else None
    groups = _build_all_unit_groups(
        unit_ids, pilot_ids, lc, lb_tier, 'super', 1, exclude, top_pilots, 'super_crit',
        def_unit_override=def_unit_override, def_char_override=def_char_override,
        def_tiers=def_tiers,
        on_progress=on_progress,
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


def _normalize_group_for_mode(g, rank_mode):
    block = (g.get('rankings') or {}).get(rank_mode)
    if block:
        return {
            'unit': g.get('unit'),
            'weapon_elems': g.get('weapon_elems'),
            'max_damage': block.get('max_damage', 0),
            'pilots': block.get('pilots') or [],
            'rankings': g.get('rankings'),
            'rankings_no_ur': g.get('rankings_no_ur'),
            'is_sd': g.get('is_sd', False),
            'bundled_pilot_id': g.get('bundled_pilot_id'),
        }
    if rank_mode == 'super_crit' and g.get('pilots'):
        return g
    return None


def _ensure_rankings_cache(cache_key, build_fn):
    cached = _rankings_result_cache.get(cache_key)
    if cached is not None:
        return cached, False
    disk = _load_master_from_disk(cache_key)
    if disk is not None:
        _rankings_result_cache[cache_key] = disk
        return disk, False
    with _rankings_build_lock:
        cached = _rankings_result_cache.get(cache_key)
        if cached is not None:
            return cached, False
        disk = _load_master_from_disk(cache_key)
        if disk is not None:
            _rankings_result_cache[cache_key] = disk
            return disk, False
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
            'lb_tier': int(kwargs.get('lb_tier', 3) or 3),
            'def_tier': dt,
            'def_unit_override': du,
            'def_char_override': dc,
            'defender_note': _settings_note(dt, def_unit_override=du, def_char_override=dc),
        },
    }


def _cached_payload_from_groups(groups, *, total_pilot_candidates, rank_mode, page, per_page, vigor,
                                def_tier, kwargs, unit_q=''):
    dt = max(1, min(4, int(def_tier or 1)))
    lc = kwargs.get('lc', 'EN')
    browse = _parse_browse_filters(kwargs, lc)
    page = max(1, int(page or 1))
    per_page = max(1, min(100, int(per_page or 50)))
    browse_active = _browse_request_active(browse, unit_q)
    if browse_active:
        unit_ids = _filtered_rankable_unit_ids(lc, browse, unit_q)
        ordered_ids = _ordered_unit_ids_for_browse(unit_ids, groups, lc, kwargs, rank_mode)
        total = len(ordered_ids)
        start = (page - 1) * per_page
        page_uids = ordered_ids[start:start + per_page]
        filtered = _resolve_groups_for_unit_ids(page_uids, groups, lc, kwargs, browse_fast=True)
        by_uid = {_app().normalize_id((g.get('unit') or {}).get('id')): g for g in filtered}
        filtered = [by_uid[uid] for uid in page_uids if uid in by_uid]
    else:
        filtered = _filter_master_groups(groups, lc, browse)
        total = None
    expanded = []
    for g in filtered:
        row = _group_for_def_tier(g, dt) if g.get('rankings_by_tier') else g
        if row:
            expanded.append(row)
    sorted_groups = _sort_groups_by_mode(expanded, rank_mode) if not browse_active else expanded
    if not browse_active:
        sorted_groups = _filter_groups_by_unit_q(sorted_groups, unit_q, lc)
        total = len(sorted_groups)
    if total is None:
        total = len(sorted_groups)
    start = (page - 1) * per_page if browse_active else (page - 1) * per_page
    if browse_active:
        raw_page = sorted_groups
    else:
        raw_page = sorted_groups[start:start + per_page]
    page_groups = []
    for g in raw_page:
        row = _normalize_group_for_mode(g, rank_mode)
        if row:
            page_groups.append(row)
    total_pages = max(1, (total + per_page - 1) // per_page)
    role_raw = kwargs.get('role') or kwargs.get('unit_role')
    if role_raw is None or str(role_raw).upper() in ('ALL', ''):
        role_filter = None
    else:
        role_filter = _app().parse_list_role_filter(str(role_raw))
    pilot_role_set = _pilot_role_set_for_filters(role_filter, kwargs.get('pilot_roles'))
    du = kwargs.get('def_unit_override')
    dc = kwargs.get('def_char_override')
    return {
        'groups': page_groups,
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
        'settings': {
            'unit_rarity': kwargs.get('rarity') or kwargs.get('unit_rarity', 'ALL'),
            'unit_role': kwargs.get('role') or kwargs.get('unit_role', 'ALL'),
            'series_id': kwargs.get('series_id') or '',
            'source': kwargs.get('source') or '',
            'lineage_id': kwargs.get('lineage_id') or '',
            'lineage_op': kwargs.get('lineage_op') or '',
            'pilot_rarity': kwargs.get('pilot_rarity', 'ALL'),
            'pilot_roles': list(pilot_role_set),
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
    """Background-build default MSY rankings (first /msy paint after deploy)."""
    A = _app()
    lc = A.DEFAULT_LANG
    kwargs = {
        'unit_rarity': 'ALL',
        'unit_role': 'ALL',
        'rarity': None,
        'role': None,
        'series_id': None,
        'source': None,
        'pilot_rarity': 'ALL',
        'pilot_roles': None,
        'metric': 'super_crit',
        'vigor': 'super',
        'lb_tier': 3,
        'top_pilots': 20,
        'exclude_pairs': None,
        'lineage_id': None,
        'lineage_op': None,
        'def_unit_override': None,
        'def_char_override': None,
    }
    def_tier = 1
    cache_key = _rankings_cache_key(lc, def_tier, kwargs)

    def _do_build():
        t0 = __import__('time').perf_counter()
        result = build_meta_synergy_master(
            lc=lc,
            lb_tier=int(kwargs.get('lb_tier', 3) or 3),
            top_pilots=int(kwargs.get('top_pilots', 20) or 20),
            exclude_pairs=kwargs.get('exclude_pairs'),
            def_unit_override=kwargs.get('def_unit_override'),
            def_char_override=kwargs.get('def_char_override'),
        )
        groups = result.get('groups') or []
        elapsed = __import__('time').perf_counter() - t0
        print(f'MSY prewarm: {len(groups)} units ({elapsed:.1f}s)')
        return result

    _, warming = _ensure_rankings_cache(cache_key, _do_build)
    if warming:
        print('MSY prewarm: started background build')


def build_meta_synergy_rankings_cached(lc='EN', **kwargs):
    rank_mode = kwargs.pop('rank_mode', 'super_crit') or 'super_crit'
    page = max(1, int(kwargs.pop('page', 1) or 1))
    per_page = max(1, min(100, int(kwargs.pop('per_page', 50) or 50)))
    unit_q = kwargs.pop('unit_q', '') or ''
    def_tier = max(1, min(4, int(kwargs.pop('def_tier', 1) or 1)))
    vigor = _VIGOR_FOR_RANK_MODE.get(rank_mode, kwargs.pop('vigor', 'super') or 'super')
    kwargs.pop('vigor', None)
    cache_key = _master_cache_key(lc, kwargs)

    def _do_build(on_progress=None):
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
            )
            payload['warming'] = True
            payload['partial'] = bool(partial.get('partial'))
            payload['retry_after'] = 5
            return payload
        return _warming_payload(rank_mode, vigor, def_tier, kwargs)

    all_groups = cached.get('groups') or []
    kwargs['lc'] = lc
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
    )
    return payload
