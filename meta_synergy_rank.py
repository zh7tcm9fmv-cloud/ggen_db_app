"""
Meta Synergistic Rankings — max-damage unit × pilot pairs mirroring the Damage Simulator
(calculateDamage in static/js/app.js): CP on, max Supercharged EX tier, paired traits,
active skills, super vigor, NPC DEF tiers.
"""
from __future__ import annotations

import math
import re
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


@lru_cache(maxsize=1)
def _defender_tiers():
    """Three NPC DEF tiers: below-average mean, overall mean, above-average mean (default tier 3)."""
    A = _app()
    unit_defs = []
    char_defs = []
    for item in A.extract_data_list(A.map_npc_unit_data):
        d = int(item.get('Defense', 0) or 0)
        if d > 0:
            unit_defs.append(d)
    for item in A.extract_data_list(A.map_npc_character_data):
        d = int(item.get('Defense', 0) or 0)
        if d > 0:
            char_defs.append(d)

    def _split(vals, fallback_u, fallback_c):
        if not vals:
            return fallback_u, fallback_c
        avg = sum(vals) / len(vals)
        low = [v for v in vals if v < avg]
        high = [v for v in vals if v >= avg]
        t1 = int(sum(low) / len(low)) if low else int(avg * 0.67)
        t2 = int(avg)
        t3 = int(sum(high) / len(high)) if high else int(avg * 1.33)
        return (t1, t2, t3)

    u1, u2, u3 = _split(unit_defs, 15000, 500)
    c1, c2, c3 = _split(char_defs, 189, 298)
    return {
        1: {'unit_def': u1, 'char_def': c1, 'label': 'Low'},
        2: {'unit_def': u2, 'char_def': c2, 'label': 'Mid'},
        3: {'unit_def': u3, 'char_def': c3, 'label': 'High'},
    }


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


def _char_pilot_dmg_bonuses(cid, lc, *, cp_on=True):
    """Max pilot passive dmg/crit bonuses — conditional lines count when CP is on (max-damage sim)."""
    dmg_dealt = crit_up = 0
    for bab in _build_char_ac_calc(cid, lc):
        for src in (bab, bab.get('sp_replacement')):
            if not src:
                continue
            for txt in _ability_blob_lines(src):
                if not txt:
                    continue
                has_cond = bool(re.search(r'when\s+|if\s+|搭乗|時', txt, re.I))
                if has_cond and not cp_on:
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


def _best_ex_weapon(uid, stat_mode, lc):
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
        if str(wm.get('weapon_type', '1') or '1') != '2':
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
        debuff = _weapon_def_debuff_from_ws(ws, wm, uid, ldc, lc, stat_mode)
        if power > best_power:
            best_power = power
            best = {'wid': wid, 'wm': wm, 'ws': ws, 'power': power, 'debuff': debuff,
                    'attr': wm.get('attack_attribute', '1')}
    return best


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


def compute_pair_damage(uid, cid, lc='EN', *, lb_tier=3, vigor='super', def_tier=3, wpn=None):
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

    tiers = _defender_tiers()
    tier_key = max(1, min(3, int(def_tier or 3)))
    def_row = tiers.get(tier_key) or tiers[3]
    def_total = int(def_row['unit_def'])
    defender_char_def = float(def_row['char_def'])

    totals, pair_ok = _cached_char_pair_totals(cid, uid, lc)
    skill_dmg, skill_atk_pct = _char_skill_bonuses(cid, lc)
    char_atk = _pilot_atk_for_weapon(totals, wpn.get('attr'), skill_atk_pct)
    unit_atk = _unit_atk_max(uid, info, stat_mode, lc, cid, pair_ok)

    dmg_dealt, crit_up = _char_pilot_dmg_bonuses(cid, lc, cp_on=True)
    dmg_dealt += skill_dmg
    guaranteed_crit = _char_guaranteed_crit(cid, lc)

    vp = _VIGOR.get(vigor) or _VIGOR['super']
    def_debuff = min(_DEF_DEBUFF_CAP, max(_DEF_DEBUFF_CAP, int(wpn.get('debuff') or 0)))
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
        'pair_ok': pair_ok,
    }


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


@lru_cache(maxsize=1)
def _pilot_pool_ids():
    return tuple(sorted(_app().char_list_playable_ids))


def _settings_note(def_tier):
    tiers = _defender_tiers()
    row = tiers.get(max(1, min(3, int(def_tier or 3)))) or tiers[3]
    return (
        f"Max-damage sim: CP on, super vigor, active skills, LB3. "
        f"Def tier {def_tier} ({row['label']}): MS DEF {row['unit_def']:,}, pilot DEF {row['char_def']:,} "
        f"(−{_DEF_DEBUFF_CAP}% debuff cap)"
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
    pilot_rarity='ALL',
    pilot_roles=None,
    metric='super_crit',
    vigor='super',
    lb_tier=3,
    def_tier=3,
    top_pilots=10,
    page=1,
    per_page=50,
    exclude_pairs=None,
    unit_q='',
):
    A = _app()
    lc = lc or A.DEFAULT_LANG
    ld = _ldc(lc)
    unit_ser_map = ld.get('unit_ser_map', {})
    exclude = set()
    for p in exclude_pairs or []:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            exclude.add((A.normalize_id(p[0]), A.normalize_id(p[1])))
    pilot_roles = pilot_roles or ('1', '2', '3')
    pilot_role_set = {str(r) for r in pilot_roles}
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

    series_filter = A.parse_list_series_filter(series_id or '')
    source_filter = A.parse_list_source_filter(source or '')

    unit_rows = []
    q_lower = (unit_q or '').strip().lower()
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
            if not A.entity_matches_series(unit_ser_map.get(uid, ''), series_filter, lc):
                continue
        name = _resolve_unit_name(uid, lc).lower()
        if q_lower and q_lower not in name and q_lower not in uid:
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

    _rank_modes = (
        ('super_crit', 'super_crit_dmg'),
        ('crit', 'crit_dmg'),
        ('normal', 'normal_dmg'),
    )

    groups = []
    for uid in unit_rows:
        info = A.unit_info_map.get(uid) or {}
        stat_mode = _unit_stat_mode(str(info.get('rarity', '1')))
        unit_wpn = _cached_best_ex_weapon(uid, stat_mode, lc)
        all_pairs = []
        for cid in pilot_ids:
            if (uid, cid) in exclude:
                continue
            dmg = compute_pair_damage(uid, cid, lc, lb_tier=lb_tier, vigor=vigor, def_tier=def_tier, wpn=unit_wpn)
            if not dmg:
                continue
            all_pairs.append((cid, dmg))
        if not all_pairs:
            continue

        rankings = {}
        for mode, dmg_key in _rank_modes:
            scored = []
            for cid, d in all_pairs:
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
                        'score': sc,
                    }
                    for i, (sc, cid, d) in enumerate(top)
                ],
            }

        if not rankings:
            continue

        primary = rankings.get('super_crit') or rankings.get('crit') or rankings.get('normal')
        groups.append({
            'unit': _entity_brief_unit(uid, lc),
            'weapon_elems': _weapon_elem_label(uid, lc),
            'rankings': rankings,
            'max_damage': primary['max_damage'],
            'metric': metric,
            'pilots': primary['pilots'],
        })

    groups.sort(key=lambda g: (-(g.get('rankings') or {}).get('super_crit', {}).get('max_damage', g.get('max_damage', 0)), g['unit']['name'].lower()))
    total = len(groups)
    page = max(1, int(page or 1))
    per_page = max(1, min(100, int(per_page or 50)))
    start = (page - 1) * per_page
    page_groups = groups[start:start + per_page]
    total_pages = max(1, (total + per_page - 1) // per_page)
    dt = max(1, min(3, int(def_tier or 3)))

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
        'def_tier': dt,
        'defender_tiers': defender_tiers_public(),
        'settings': {
            'unit_rarity': rarity_raw,
            'unit_role': role_raw,
            'series_id': series_id or '',
            'source': source or '',
            'pilot_rarity': pilot_rarity,
            'pilot_roles': list(pilot_role_set),
            'lb_tier': lb_tier,
            'def_tier': dt,
            'defender_note': _settings_note(dt),
        },
    }


def build_meta_synergy_rankings_cached(lc='EN', **kwargs):
    page = max(1, int(kwargs.pop('page', 1) or 1))
    per_page = max(1, min(100, int(kwargs.pop('per_page', 50) or 50)))
    def_tier = max(1, min(3, int(kwargs.pop('def_tier', 3) or 3)))
    cache_key = (
        lc or 'EN',
        kwargs.get('rarity') or kwargs.get('unit_rarity', 'ALL'),
        kwargs.get('role') or kwargs.get('unit_role', 'ALL'),
        kwargs.get('series_id') or '',
        kwargs.get('source') or '',
        kwargs.get('pilot_rarity', 'ALL'),
        tuple(sorted(str(r) for r in (kwargs.get('pilot_roles') or ('1', '2', '3')))),
        kwargs.get('vigor', 'super'),
        int(kwargs.get('lb_tier', 3) or 3),
        def_tier,
        int(kwargs.get('top_pilots', 10) or 10),
        (kwargs.get('unit_q') or '').strip().lower(),
        tuple(tuple(p) for p in (kwargs.get('exclude_pairs') or ())),
    )
    if cache_key not in _rankings_result_cache:
        raw = build_meta_synergy_rankings(lc=lc, page=1, per_page=10000, def_tier=def_tier, **kwargs)
        _rankings_result_cache[cache_key] = raw.get('all_groups') or raw.get('groups') or []
    all_groups = _rankings_result_cache[cache_key]
    total = len(all_groups)
    start = (page - 1) * per_page
    page_groups = all_groups[start:start + per_page]
    total_pages = max(1, (total + per_page - 1) // per_page)
    metric = kwargs.get('metric', 'super_crit')
    vigor = kwargs.get('vigor', 'super')
    pilot_role_set = {str(r) for r in (kwargs.get('pilot_roles') or ('1', '2', '3'))}
    dt = def_tier
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
        'def_tier': dt,
        'defender_tiers': defender_tiers_public(),
        'settings': {
            'unit_rarity': kwargs.get('rarity') or kwargs.get('unit_rarity', 'ALL'),
            'unit_role': kwargs.get('role') or kwargs.get('unit_role', 'ALL'),
            'series_id': kwargs.get('series_id') or '',
            'source': kwargs.get('source') or '',
            'pilot_rarity': kwargs.get('pilot_rarity', 'ALL'),
            'pilot_roles': list(pilot_role_set),
            'lb_tier': int(kwargs.get('lb_tier', 3) or 3),
            'def_tier': dt,
            'defender_note': _settings_note(dt),
        },
    }
