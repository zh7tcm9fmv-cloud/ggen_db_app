"""
Comprehensive offline tier ranking (SSS–A): units, characters, supporters, tags, banners.

Run: python scripts/tier_rank_mockup.py  (delegates here)
Outputs: scripts/output/tier_mockup_v2.json, tier_mockup_v2.md
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ["GGEN_TIER_USE_BUNDLED_EN"] = "1"

import app as A  # noqa: E402
import game_enums  # noqa: E402

LC = "EN"
LD = A.LANG_DATA[LC]
LDC = LD

TIER_ORDER = ("SSS", "SS", "S", "A")
# Display cap — no unit/pilot is perfect across every scenario.
DISPLAY_SCORE_CAP = 92.0
TIER_MIN_SCORE = {"SSS": 78, "SS": 70, "S": 62, "A": 0}
META_TIER_PCTS = {"SSS": 0.08, "SS": 0.25, "S": 0.50}
SSS_CAP = {
    "UR": {"Attack": 4, "Defense": 3, "Support": 3, "Supporter": 4},
    "SSR": {"Attack": 5, "Defense": 4, "Support": 4, "Supporter": 4},
}
REASON_LIMIT = 5
LIMITED_SCORE_BONUS = 7.0
LIMITED_META_BOOST = True

TERRAIN_KEYS = ("Space", "Atmospheric", "Ground", "Sea", "Underwater")
HEAL_RE = re.compile(
    r"(recover|restore|heal|回復|恢復|恢复).{0,24}(hp|HP|生命)|"
    r"(hp|HP|生命).{0,24}(recover|restore|heal|回復|恢復|恢复)|"
    r"Recovers?\s+\d+\s*%\s*HP",
    re.I,
)
DR_RE = re.compile(
    r"reduce.{0,20}damage taken|被(?:ダメ|伤|傷)|damage.{0,12}reduc|軽減|减伤|減傷",
    re.I,
)
MAP_AFTER_MOVE_RE = re.compile(
    r"after moving|移動後|移动后|移動后|can be used after move",
    re.I,
)
EN_RECOVER_RE = re.compile(r"recover.{0,16}\s*EN|EN.{0,16}recover|回復.{0,8}EN", re.I)
SQUAD_MS_ATK_RE = re.compile(
    r"(?:increase|increases|raise).{0,40}?(?:attack|atk).{0,12}?by\s+(\d+)\s*%|"
    r"攻撃力.{0,8}?(\d+)\s*[%％].{0,8}?上昇",
    re.I,
)
SQUAD_MS_DEF_RE = re.compile(
    r"(?:increase|increases).{0,40}?(?:defense|def).{0,12}?by\s+(\d+)\s*%|"
    r"防御力.{0,8}?(\d+)\s*[%％].{0,8}?上昇",
    re.I,
)
DEF_DEBUFF_CHAR_RE = re.compile(
    r"(?:reduce|decrease).{0,24}(?:enemy|hostile).{0,16}(?:def|defense).{0,12}(\d+)\s*%|"
    r"防御力.{0,12}(\d+)\s*[%％].{0,8}減",
    re.I,
)
GUARANTEED_CRIT_RE = re.compile(
    r"guaranteed\s+critical|grant\s+guaranteed\s+critical|activate\s+guaranteed\s+critical|"
    r"確定クリティカル|確定.*クリティカル",
    re.I,
)
SUPERCHARGED_EX_RE = re.compile(r"supercharged\s+ex", re.I)

# AppMedia / community anchors (tier_meta floor). Peak DPS > Chance Step for attack meta.
COMMUNITY_UNIT_META_FLOOR = {
    "1200003950": "SSS",  # Burning Gundam — sim-verified peak DPS
    "1330000750": "SSS",  # Destiny Gundam — sim + bundled Shinn crit
    "1219000150": "SSS",  # Wing Zero — MAP after move (AppMedia S-tier)
    "1430003450": "SS",   # Barbatos Lupus Rex — crit-focused (Shinn synergy)
}
COMMUNITY_CHAR_META_FLOOR = {
    "1330000103": "SSS",  # Shinn EX — Guaranteed Critical kit (intrinsic, not versatility)
}
COMMUNITY_UNIT_SCORE_BUMP = {
    "1200003950": 4.0,
    "1330000750": 3.0,
}
COMMUNITY_CHAR_SCORE_BUMP = {}

# Eternal Road stage terrain mix (79 stages): Space dominates, then Ground; Air/Sea niche.
ER_TERRAIN_STAGE_WEIGHTS = {"1": 51, "2": 1, "3": 22, "4": 1, "5": 4}
TAG_LEADER_QUALITY_WEIGHT = {
    "Ace Unit": 1.4,
    "Protagonist": 1.1,
    "One-Shot Killer": 1.08,
    "Tough as Nails": 1.06,
}
DMG_DEALT_RE = re.compile(
    r"increases?.{0,24}damage dealt.{0,12}(\d+)\s*%|"
    r"与(?:え|给)(?:ダメ|伤害).{0,12}(\d+)\s*[%％]",
    re.I,
)


def score_to_tier(score: float) -> str:
    for t in TIER_ORDER:
        if score >= TIER_MIN_SCORE[t]:
            return t
    return "A"


def tier_rank_index(tier: str) -> int:
    try:
        return TIER_ORDER.index(tier)
    except ValueError:
        return len(TIER_ORDER)


def apply_community_anchors(rows: list, meta_floor: dict, score_bump: dict | None = None) -> None:
    """Raise scores / tier_meta for community-verified meta picks (AppMedia, guides)."""
    score_bump = score_bump or {}
    for r in rows:
        rid = r.get("id", "")
        if rid in score_bump:
            bumped = min(DISPLAY_SCORE_CAP, r["score"] + score_bump[rid])
            r["score"] = round(bumped, 1)
            r["tier"] = score_to_tier(bumped)
        floor = meta_floor.get(rid)
        if floor and tier_rank_index(r.get("tier_meta", "A")) > tier_rank_index(floor):
            r["tier_meta"] = floor
            r["community_anchor"] = True


def assign_meta_tiers(rows: list, key: str = "is_tier_pool", group_fn=None) -> None:
    """Legacy percentile tiers — kept for reference; use assign_gated_meta_tiers in production."""
    pool = [r for r in rows if r.get(key)]
    by_role = defaultdict(list)
    for r in pool:
        gk = group_fn(r) if group_fn else r.get("role", "All")
        by_role[gk].append(r)
    for _role, lst in by_role.items():
        lst.sort(key=lambda x: (-x["score"], x.get("name", "")))
        n = len(lst)
        if not n:
            continue
        t_sss = max(1, int(round(n * 0.08)))
        t_ss = max(t_sss, int(round(n * 0.25)))
        t_s = max(t_ss, int(round(n * 0.50)))
        for i, r in enumerate(lst):
            if i < t_sss:
                r["tier_meta"] = "SSS"
            elif i < t_ss:
                r["tier_meta"] = "SS"
            elif i < t_s:
                r["tier_meta"] = "S"
            else:
                r["tier_meta"] = "A"


def _attack_sss_eligible(row: dict, peers: list) -> bool:
    """Permanent attackers need top sim burst or a unique kit — not terrain/team breadth alone."""
    if row.get("community_anchor"):
        return True
    wpn = row.get("weapons") or {}
    sub = row.get("subscores") or {}
    sim = row.get("sim_damage") or {}
    peak = int(sim.get("effective_peak") or 0)
    if not peak:
        return False
    sim_peaks = [int((p.get("sim_damage") or {}).get("effective_peak") or 0) for p in peers]
    sr, _ = _rank_desc(peak, sim_peaks)
    if sr <= 3:
        return True
    if wpn.get("map_after_move"):
        return True
    if float(sub.get("crit_synergy") or 0) >= 8:
        return True
    if row.get("is_limited_time") and sr <= 8:
        return True
    return False


def _tier_sort_score(row: dict, peers: list) -> float:
    """Meta sort key — down-ranks permanent attackers whose sim burst lags their composite score."""
    sc = float(row.get("score") or 0)
    if row.get("role") != "Attack":
        return sc
    sim = row.get("sim_damage") or {}
    peak = int(sim.get("effective_peak") or 0)
    if not peak:
        return sc
    sim_peaks = [int((p.get("sim_damage") or {}).get("effective_peak") or 0) for p in peers]
    sr, _ = _rank_desc(peak, sim_peaks)
    wpn = row.get("weapons") or {}
    sub = row.get("subscores") or {}
    if row.get("is_limited_time"):
        return sc
    if sr <= 3 or wpn.get("map_after_move") or float(sub.get("crit_synergy") or 0) >= 8:
        return sc
    if sr > 8:
        return max(0.0, sc - 12.0)
    if sr > 5:
        return max(0.0, sc - 8.0)
    return max(0.0, sc - 4.0)


def assign_gated_meta_tiers(rows: list, key: str = "is_tier_pool", group_fn=None) -> None:
    """Score-percentile meta tiers with attack SSS gates and per-group SSS caps."""
    groups: dict = defaultdict(list)
    for r in rows:
        if r.get(key):
            gk = group_fn(r) if group_fn else r.get("role", "All")
            groups[gk].append(r)

    for gk, lst in groups.items():
        rarity = gk[1] if isinstance(gk, tuple) and len(gk) > 1 else "UR"
        role = gk[0] if isinstance(gk, tuple) else str(gk)

        lst.sort(key=lambda x: (-_tier_sort_score(x, lst), x.get("name", "")))
        n = len(lst)
        if not n:
            continue
        t_sss = max(1, int(round(n * META_TIER_PCTS["SSS"])))
        t_ss = max(t_sss, int(round(n * META_TIER_PCTS["SS"])))
        t_s = max(t_ss, int(round(n * META_TIER_PCTS["S"])))

        for i, r in enumerate(lst):
            if i < t_sss:
                r["tier_meta"] = "SSS"
            elif i < t_ss:
                r["tier_meta"] = "SS"
            elif i < t_s:
                r["tier_meta"] = "S"
            else:
                r["tier_meta"] = "A"

        if role == "Attack":
            for r in lst:
                if r.get("tier_meta") == "SSS" and not _attack_sss_eligible(r, lst):
                    r["tier_meta"] = "SS"

        cap = SSS_CAP.get(rarity, {}).get(role if role != "Supporter" else "Supporter", 4)
        over = [r for r in lst if r.get("tier_meta") == "SSS"]
        if len(over) > cap:
            over.sort(key=lambda x: (-_tier_sort_score(x, lst), x.get("name", "")))
            for r in over[cap:]:
                r["tier_meta"] = "SS"


def unit_name(uid: str) -> str:
    return A._wn_unit_name(uid, LD)


def char_name(cid: str) -> str:
    return A._wn_char_name(cid, LD)


def supporter_name(sid: str) -> str:
    return A._wn_supporter_name(sid, LD)


def tag_labels_from_ids(tag_ids: list) -> list[str]:
    llk = LD.get("lineage_lookup", {})
    names = []
    seen = set()
    for tid in tag_ids or []:
        t = str(tid).strip()
        if not t:
            continue
        n = llk.get(t)
        if not n:
            for k, v in llk.items():
                if k.endswith(t):
                    n = v
                    break
        if n and n not in seen:
            names.append(n)
            seen.add(n)
    return names


def unit_tag_ids(uid: str) -> list:
    return list(A.unit_lin_map.get(uid, []) or [])


def char_tag_ids(cid: str) -> list:
    return list(A.char_lin_map.get(cid, []) or [])


def same_series(uid: str, cid: str) -> bool:
    us = A.unit_ser_map.get(uid, "")
    cs = LD.get("char_ser_map", {}).get(cid, "")
    return bool(us and cs and us == cs)


def bundled_pilot_id(uid: str) -> str:
    info = A.unit_info_map.get(uid, {})
    rec = A.normalize_id(info.get("recommend_character_id") or "0")
    if rec == "0":
        rec = A.normalize_id(A.MANUAL_UNIT_RECOMMEND_CHARACTER_MAP.get(uid, "0"))
    if rec != "0" and rec in A.char_info_map:
        return rec
    return ""


def is_limited_unit(uid: str) -> bool:
    return uid in A.LIMITED_TIME_UNIT_IDS


def is_limited_char(cid: str) -> bool:
    return cid in A.LIMITED_TIME_CHARACTER_IDS


def is_limited_supporter(sid: str) -> bool:
    return sid in A.LIMITED_TIME_SUPPORTER_IDS


def apply_limited_bonus(score: float, limited: bool) -> float:
    if limited:
        return min(DISPLAY_SCORE_CAP, score + LIMITED_SCORE_BONUS)
    return score


# --- Sortie (from v1) ---


def unit_matches_group(uid: str, group_id: str) -> bool:
    items = A.stage_sortie_group_content_map.get(group_id, [])
    if not items:
        return True
    for gc in items:
        rt = gc.get("restriction_type_index", "0")
        tid = gc.get("target_id", "0")
        if rt == "1":
            if A.entity_matches_series(A.unit_ser_map.get(uid, ""), tid, LC):
                return True
        elif rt == "2":
            if A._entity_matches_one_lineage(A.unit_lin_map, uid, tid):
                return True
    return False


def unit_matches_sortie_set(uid: str, set_id: str) -> bool:
    if not set_id or set_id == "0":
        return True
    rows = A.stage_sortie_set_content_map.get(set_id, [])
    unit_rows = [r for r in rows if str(r.get("target_type_index")) == "1"]
    if not unit_rows:
        return True
    for r in unit_rows:
        if not unit_matches_group(uid, r.get("group_id", "0")):
            return False
    return True


def unit_eligible_on_stage(uid: str, stage_id: str) -> bool:
    sm = A.stage_map.get(stage_id, {})
    sets = [sm.get("group1_set_id"), sm.get("group2_set_id")]
    sets = [s for s in sets if s and s != "0"]
    if not sets:
        return True
    return any(unit_matches_sortie_set(uid, s) for s in sets)


def build_er_stage_weights():
    stages = []
    for sid, est in A.eternal_stage_map.items():
        sm = A.stage_map.get(sid, {})
        cp = int(sm.get("recommended_cp") or 0)
        diff = int(est.get("stage_difficulty_type_index") or 1)
        w = 1.0
        if cp > 0:
            w += 0.35 * math.log10(max(cp, 500) / 500.0)
        if diff >= 3:
            w += 0.25
        has_restrict = bool(
            (sm.get("group1_set_id") or "0") != "0"
            or (sm.get("group2_set_id") or "0") != "0"
        )
        stages.append(
            {"id": sid, "cp": cp, "diff": diff, "weight": w, "restricted": has_restrict}
        )
    return stages


def sortie_coverage(uid: str, er_stages: list) -> dict:
    total_w = ok_w = hard_w = hard_ok = restricted_w = restricted_ok = 0.0
    for st in er_stages:
        w = st["weight"]
        total_w += w
        ok = unit_eligible_on_stage(uid, st["id"])
        if ok:
            ok_w += w
        if st["restricted"]:
            restricted_w += w
            if ok:
                restricted_ok += w
        if st["diff"] >= 3 or st["cp"] >= 80000:
            hard_w += w
            if ok:
                hard_ok += w
    pct = (ok_w / total_w * 100) if total_w else 100.0
    tag_n = len(unit_tag_ids(uid))
    tag_penalty = 0.82 if tag_n <= 1 else (0.92 if tag_n == 2 else 1.0)
    adj_pct = pct * tag_penalty
    return {
        "pct": round(pct, 1),
        "adj_pct": round(adj_pct, 1),
        "hard_pct": round((hard_ok / hard_w * 100) if hard_w else 100.0, 1),
        "tag_count": tag_n,
        "tag_names": tag_labels_from_ids(unit_tag_ids(uid))[:8],
    }


def unit_stat_mode_for_rarity(ri: str) -> str:
    if str(ri) == "5":
        return "ssp"
    if str(ri) == "4":
        return "sp"
    return "normal"


def effective_unit_terrain(uid: str) -> dict:
    info = A.unit_info_map.get(uid, {})
    ri = str(info.get("rarity", "1"))
    if int(ri) >= 5:
        base = A._ssp_base_terrain_levels(info)
        core = A.get_ssp_custom_core_bonuses_for_unit(uid)
        eff = dict(base)
        for tn, _fr, to in core.get("terrain_upgrades", []):
            eff[tn] = max(eff.get(tn, 1), to)
        return eff
    td = A.unit_ter_map.get(info.get("terrain_set", ""), {})
    return {k: int(td.get(k, 1) or 1) for k in TERRAIN_KEYS}


def terrain_score_er_weighted(uid: str) -> tuple[float, dict]:
    """Score terrain by ER stage mix: Space+Ground matter most; Air/Sea/Water are bonuses."""
    eff = effective_unit_terrain(uid)
    space = int(eff.get("Space", 1) or 1)
    ground = int(eff.get("Ground", 1) or 1)
    air = int(eff.get("Atmospheric", 1) or 1)
    sea = int(eff.get("Sea", 1) or 1)
    water = int(eff.get("Underwater", 1) or 1)

    def tier_mult(t: int) -> float:
        if t >= 3:
            return 1.0
        if t >= 2:
            return 0.88
        return 0.42

    total_w = sum(ER_TERRAIN_STAGE_WEIGHTS.values()) or 1
    weighted = (
        ER_TERRAIN_STAGE_WEIGHTS["1"] * tier_mult(space)
        + ER_TERRAIN_STAGE_WEIGHTS["3"] * tier_mult(ground)
        + ER_TERRAIN_STAGE_WEIGHTS["2"] * tier_mult(air) * 0.4
        + ER_TERRAIN_STAGE_WEIGHTS["4"] * tier_mult(sea) * 0.45
        + ER_TERRAIN_STAGE_WEIGHTS["5"] * tier_mult(max(sea, water)) * 0.45
    )
    pts = weighted / total_w * 12.0
    if space >= 2 and ground >= 2:
        pts += 3.0
    elif (space >= 2 and ground <= 1) or (ground >= 2 and space <= 1):
        pts *= 0.9
    if water >= 3 or sea >= 3:
        pts += 1.0
    detail = {
        "space": space, "ground": ground, "air": air, "sea": sea, "water": water,
        "er_stage_fit_pct": round(weighted / total_w * 100, 1),
        "space_ground_dual": space >= 2 and ground >= 2,
    }
    return min(15.0, pts), detail


def terrain_score(uid: str) -> float:
    pts, _ = terrain_score_er_weighted(uid)
    return pts / 15.0 * 100.0


def weapon_signals(uid: str, stat_mode: str = "ssp"):
    max_range = max_power = 0
    has_map = map_after_move = False
    max_def_debuff = 0
    for wp in A.unit_weapon_map.get(uid, []) or []:
        wid = A.normalize_id(wp.get("id"))
        wm = A.weapon_info_map.get(wid, {})
        wt = str(wm.get("weapon_type", "1") or "1")
        try:
            ws = A.resolve_weapon_stats(
                wm, A.weapon_status_map, A.weapon_correction_map,
                LD.get("weapon_trait_map", {}), LD.get("weapon_capability_map", {}),
                A.growth_pattern_map, A.weapon_trait_change_map,
                LD.get("weapon_trait_detail_map", {}),
                wid=wid, lang_code=LC, unit_id=uid,
            )
        except Exception:
            continue
        rx = int(ws.get("range_max", 0) or 0)
        if stat_mode == "ssp":
            mwid = A.normalize_id(wm.get("main_weapon_id", "0") or "0")
            for cid in (wid, mwid):
                for enh in A.unit_ssp_weapon_enhance_map.get(cid) or []:
                    if str(enh.get("type")) == "4":
                        rx += int(enh.get("value", 0) or 0)
                break
        levels = ws.get("levels", {})
        power = int(ws.get("power", 0) or 0)
        if isinstance(levels, dict):
            power = max(power, int((levels.get(5, {}) or {}).get("power", 0) or 0))
        if wt == "3":
            has_map = True
            if A.is_map_weapon_after_move_unit_weapon(uid, wid, wt):
                map_after_move = True
        else:
            max_range = max(max_range, rx)
            max_power = max(max_power, power)
        for line in A.iter_unit_weapon_trait_texts(uid, LD, LC, stat_mode=stat_mode):
            b, v = A.parse_enemy_def_debuff_pcts_from_trait_text(line)
            max_def_debuff = max(max_def_debuff, b, v)
    return {
        "max_range": max_range, "max_power": max_power, "has_map": has_map,
        "map_after_move": map_after_move, "max_def_debuff": max_def_debuff,
    }


# Reference defender for tier DPS estimates (mirrors damage-calc sheet defaults).
_SIM_REF_DEF_TOTAL = 25072
_SIM_REF_CHAR_DEF = 705
_SIM_REF_DEF_DEBUFF_PCT = 40
_SIM_CRIT125_TRIM_MIN = 356500
_SIM_CRIT125_TRIM_DIV = 1181


def _sim_def_after_debuff(total_def: int, bonus_def: int, pct: int) -> int:
    u = int(total_def)
    bon = max(0, int(bonus_def))
    base = max(0, u - bon)
    p = max(0, min(100, int(pct)))
    if p <= 0 or u <= 0:
        return u
    reduc = (base * p) // 100 if base > 0 else 0
    return max(0, u - reduc)


def _sim_combat_weapon_power(nominal: int, def_debuff_pct: int) -> int:
    n = int(nominal) or 0
    p = int(def_debuff_pct) or 0
    if p <= 35:
        return n
    return n + 1


def _sim_calc_normal_damage(
    unit_atk: float,
    char_atk: float,
    char_def: float,
    unit_def_after: float,
    weapon_power: int,
    *,
    def_debuff_pct: int = 0,
    terrain_pct: int = 0,
    dmg_mult_pct: int = 0,
) -> tuple[int, int, int]:
    """Firered sheet order — matches static/js/app.js calculateDamage core."""
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
    scaled_normal = C(dmg_mult_pct * battle_damage / 100)
    normal_dmg = MX(0, C(battle_damage + scaled_normal))
    return int(normal_dmg), int(battle_damage), int(wp)


def _sim_calc_super_crit_damage(
    battle_damage: int,
    combat_weapon_power: int,
    *,
    dmg_mult_pct: int = 0,
) -> int:
    F, C, MX = math.floor, math.ceil, max
    total_crit_mult = 125 + int(dmg_mult_pct)
    scaled_crit = C(total_crit_mult * battle_damage / 100)
    crit125_trim = 0
    if total_crit_mult == 125 and battle_damage >= _SIM_CRIT125_TRIM_MIN and combat_weapon_power > 0:
        crit125_trim = F(MX(0, battle_damage - combat_weapon_power) / _SIM_CRIT125_TRIM_DIV)
    combined_crit = MX(0, battle_damage + scaled_crit - crit125_trim)
    return MX(0, C(combined_crit))


def _pilot_atk_for_weapon(totals: dict) -> float:
    return float(max(
        totals.get("Ranged", 0),
        totals.get("Melee", 0),
        totals.get("Awaken", 0),
    ))


def estimate_attack_ex_damage(uid: str, pilot_cid: str | None = None) -> dict:
    """
    Estimated EX normal/crit damage using bundled pilot (or override) and damage-calc formula.
    Does not search the full pilot roster — pilots are swappable per stage.
    """
    uid = A.normalize_id(uid)
    info = A.unit_info_map.get(uid, {})
    if str(info.get("role", "1")) != "1":
        return {"normal_dmg": 0, "crit_dmg": 0, "effective_peak": 0, "pilot_id": "", "weapon_power": 0}

    ri = str(info.get("rarity", "1"))
    stat_mode = unit_stat_mode_for_rarity(ri)
    block = A._unit_max_lb_stat_block(uid, info, A.unit_stat_map.get(uid, {}), LDC)
    stats = A._unit_lb_row_to_api(block, stat_mode, False) if block else {}
    unit_atk = float(stats.get("ATK", 0) or 0)

    cid = A.normalize_id(pilot_cid or bundled_pilot_id(uid) or "0")
    char_atk = char_def = 0.0
    guaranteed_crit = False
    dmg_mult = 0
    if cid != "0" and cid in A.char_info_map:
        cri = str((A.char_info_map.get(cid) or {}).get("rarity", "1"))
        totals, _ = char_totals_for_tier(cid, cri)
        char_atk = _pilot_atk_for_weapon(totals)
        char_def = float(totals.get("Defense", 0) or 0)
        flags, _ = char_analysis(cid, deep=cri == "5")
        guaranteed_crit = bool(flags.get("guaranteed_crit"))
        dmg_mult = char_damage_dealt_bonus(cid)

    wpn = weapon_signals(uid, stat_mode)
    weapon_power = int(wpn.get("max_power") or 0)
    if weapon_power <= 0:
        return {"normal_dmg": 0, "crit_dmg": 0, "effective_peak": 0, "pilot_id": cid, "weapon_power": 0}

    def_debuff = min(40, max(_SIM_REF_DEF_DEBUFF_PCT, int(wpn.get("max_def_debuff") or 0)))
    unit_def_after = _sim_def_after_debuff(_SIM_REF_DEF_TOTAL, 0, def_debuff)

    normal_dmg, battle_dmg, combat_wp = _sim_calc_normal_damage(
        unit_atk, char_atk, char_def, unit_def_after, weapon_power,
        def_debuff_pct=def_debuff, dmg_mult_pct=dmg_mult,
    )
    crit_dmg = 0
    if guaranteed_crit:
        crit_dmg = _sim_calc_super_crit_damage(battle_dmg, combat_wp, dmg_mult_pct=dmg_mult)

    effective = max(normal_dmg, crit_dmg) if guaranteed_crit else normal_dmg
    return {
        "normal_dmg": normal_dmg,
        "crit_dmg": crit_dmg,
        "effective_peak": effective,
        "pilot_id": cid,
        "weapon_power": weapon_power,
        "guaranteed_crit": guaranteed_crit,
        "unit_atk": int(unit_atk),
        "char_atk": int(char_atk),
        "def_debuff_pct": def_debuff,
    }


def peak_damage_pts_from_sim(sim: dict, max_range: int, role: str, pop_sim: list) -> float:
    """Peak burst score from damage-calc estimate percentile, not nominal weapon power alone."""
    if role != "1":
        return 0.0
    peak = float(sim.get("effective_peak") or 0)
    if peak <= 0:
        return 0.0
    pts = percentile_rank(peak, pop_sim) * 0.17
    if max_range >= 5:
        pts += 2.5
    if sim.get("guaranteed_crit") and int(sim.get("crit_dmg") or 0) > int(sim.get("normal_dmg") or 0):
        pts += 1.5
    return min(20.0, pts)


def percentile_rank(value: float, population: list) -> float:
    if not population:
        return 50.0
    return 100.0 * sum(1 for x in population if x < value) / len(population)


# --- Character abilities ---


_TAG_TO_CHARS: dict | None = None
_CHAR_ANALYSIS_CACHE: dict = {}


def _ensure_tag_char_index():
    global _TAG_TO_CHARS
    if _TAG_TO_CHARS is not None:
        return
    _TAG_TO_CHARS = defaultdict(set)
    for cid in A.char_list_playable_ids:
        for lid in char_tag_ids(cid):
            _TAG_TO_CHARS[lid].add(cid)


def char_analysis(cid: str, *, deep: bool = False) -> tuple:
    cid = A.normalize_id(cid)
    key = (cid, deep)
    if key in _CHAR_ANALYSIS_CACHE:
        return _CHAR_ANALYSIS_CACHE[key]
    flags = char_special_flags(cid, deep=deep)
    cr = A.CHAR_BROWSE_LIST_ROW_CACHE.get(cid)
    if cr:
        totals, _ = cr[("n", False)]
    else:
        totals = char_grown_stats(cid)
    _CHAR_ANALYSIS_CACHE[key] = (flags, totals)
    return _CHAR_ANALYSIS_CACHE[key]


def build_char_abilities(cid: str) -> list:
    fa = [x for x in A.extract_data_list(A.char_abil or []) if A.normalize_id(x.get("CharacterId", "")) == cid]
    out = []
    for ab in sorted(fa, key=lambda x: int(x.get("SortOrder", 0))):
        bid = A.normalize_id(ab.get("AbilityId", ""))
        spid = A.normalize_id(ab.get("SpAbilityId") or ab.get("spAbilityId"))
        try:
            bab = A.build_ability_entry(
                bid, LDC["abil_name_map"], A.abil_link_map, A.trait_set_traits_map,
                A.trait_data_map, LDC["lang_text_map"], LDC["lang_text_map"],
                A.trait_condition_raw_map, LDC["lineage_lookup"], LDC["series_name_map"],
                A.ability_resource_map, LDC["abil_desc_map"],
                sort_order=int(ab.get("SortOrder", 0)), lang_code=LC,
            )
            if spid and spid not in ("0", "None", bid):
                bab["sp_replacement"] = A.build_ability_entry(
                    spid, LDC["abil_name_map"], A.abil_link_map, A.trait_set_traits_map,
                    A.trait_data_map, LDC["lang_text_map"], LDC["lang_text_map"],
                    A.trait_condition_raw_map, LDC["lineage_lookup"], LDC["series_name_map"],
                    A.ability_resource_map, LDC["abil_desc_map"],
                    sort_order=int(ab.get("SortOrder", 0)), lang_code=LC,
                )
            out.append(bab)
        except Exception:
            continue
    return out


def parse_squad_buffs(cid: str) -> list:
    """Squad-wide MS buffs this pilot can grant (tag conditions from ability lines)."""
    buffs = []
    for bab in build_char_abilities(cid):
        for d2 in bab.get("details", []) or []:
            if not isinstance(d2, dict):
                continue
            text = (d2.get("text") or "").strip()
            if not text:
                continue
            if not A._char_trait_line_is_squad_unit_effect(text, bab) and not A._blob_has_squad_unit_stat_context(text):
                continue
            atk_m = SQUAD_MS_ATK_RE.search(text)
            def_m = SQUAD_MS_DEF_RE.search(text)
            atk_pct = int(atk_m.group(1)) if atk_m else 0
            def_pct = int(def_m.group(1)) if def_m else 0
            if atk_pct <= 0 and def_pct <= 0:
                continue
            cond_tags = []
            for c in d2.get("conditions", []) or []:
                cn = (c.get("name") or "").strip()
                if cn:
                    cond_tags.append(cn)
            buffs.append({
                "ability": (bab.get("name") or "")[:80],
                "atk_pct": atk_pct,
                "def_pct": def_pct,
                "condition_tags": cond_tags,
            })
    return buffs


def _char_ability_id_set(cid: str) -> set:
    aids = set()
    for ab in A.extract_data_list(A.char_abil or []):
        if A.normalize_id(ab.get("CharacterId", "")) != cid:
            continue
        for key in ("AbilityId", "SpAbilityId", "spAbilityId"):
            aid = A.normalize_id(ab.get(key) or "")
            if aid and aid not in ("0", "None"):
                aids.add(aid)
    return aids


def char_offensive_extras(cid: str) -> dict:
    """Limited EX pilots: guaranteed crit chains (e.g. Shinn Supercharged EX)."""
    guaranteed_crit = supercharged_ex = False
    for bab in build_char_abilities(cid):
        blob = (bab.get("name") or "") + "\n"
        for d2 in bab.get("details", []) or []:
            if isinstance(d2, dict):
                blob += (d2.get("text") or "") + "\n"
            else:
                blob += str(d2) + "\n"
        if GUARANTEED_CRIT_RE.search(blob):
            guaranteed_crit = True
        if SUPERCHARGED_EX_RE.search(blob):
            supercharged_ex = True
        sp = bab.get("sp_replacement") or {}
        for d2 in sp.get("details", []) or []:
            if isinstance(d2, dict):
                blob2 = d2.get("text") or ""
            else:
                blob2 = str(d2)
            if GUARANTEED_CRIT_RE.search(blob2):
                guaranteed_crit = True
            if SUPERCHARGED_EX_RE.search(blob2):
                supercharged_ex = True
    return {"guaranteed_crit": guaranteed_crit, "supercharged_ex": supercharged_ex}


def peak_damage_pts(max_power: int, max_range: int, role: str) -> float:
    """Attack units: reward raw EX weapon power (AppMedia: long range OR one-shot burst)."""
    if role != "1" or max_power <= 0:
        return 0.0
    pts = 0.0
    if max_power >= 8500:
        pts += 14.0
    elif max_power >= 8000:
        pts += 11.0
    elif max_power >= 7500:
        pts += 8.0
    elif max_power >= 7000:
        pts += 5.0
    elif max_power >= 6500:
        pts += 2.0
    if max_range >= 5:
        if max_power >= 7500:
            pts += 6.0
        elif max_power >= 6500:
            pts += 3.0
    return min(20.0, pts)


def char_special_flags(cid: str, *, deep: bool = False) -> dict:
    cid = A.normalize_id(cid)
    info = A.char_info_map.get(cid) or {}
    role = str(info.get("role", "0"))
    ri = str(info.get("rarity", "1"))
    aids = _char_ability_id_set(cid)
    chance = bool(aids & A.CHANCE_STEP_EX_ABILITY_IDS) or (
        deep and A._char_matches_special_x2_filter(cid, A.CHANCE_STEP_EX_FILTER_ID, include_sp=True)
    )
    sup_def = cid in A.SUPPORT_DEF_X2_CHARACTER_IDS or (
        deep and role == "2" and A._char_matches_special_x2_filter(cid, A.SUPPORT_DEF_X2_FILTER_ID, include_sp=True)
    )
    sup_atk = cid in A.SUPPORT_ATK_X2_CHARACTER_IDS or (
        deep and role == "3" and A._char_matches_special_x2_filter(cid, A.SUPPORT_ATK_X2_FILTER_ID, include_sp=True)
    )
    affinities = []
    squad = []
    extras = {"guaranteed_crit": False, "supercharged_ex": False}
    if deep or ri == "5" or is_limited_char(cid):
        tags = char_tag_ids(cid)
        tokens = [t.lower() for t in tag_labels_from_ids(tags)]
        if tokens:
            for bab in build_char_abilities(cid):
                if A._name_indicates_affinity_ability(bab.get("name") or ""):
                    if A._affinity_ability_name_matches_tags(bab.get("name") or "", tokens, "or", A.DEFAULT_LANG):
                        affinities.append(bab.get("name") or "Affinity")
        squad = parse_squad_buffs(cid)
        extras = char_offensive_extras(cid)
    return {
        "chance_step_x2": chance,
        "support_defense_x2": sup_def and role == "2",
        "support_attack_x2": sup_atk and role == "3",
        "guaranteed_crit": extras["guaranteed_crit"],
        "supercharged_ex": extras["supercharged_ex"],
        "affinity_matches": affinities[:4],
        "squad_buffs": squad,
    }


def char_grown_stats(cid: str) -> dict:
    raw = A.char_stat_map.get(cid, {})
    ri = (A.char_info_map.get(cid) or {}).get("rarity", "1")
    grown = {}
    for s in A.CHAR_STAT_ORDER:
        st = raw.get(s, (0, 0, 0))
        if isinstance(st, (list, tuple)) and len(st) >= 2:
            grown[s] = A.calc_growth_char(st[0], st[1], ri)
        else:
            grown[s] = 0
    return A.compute_char_stat_totals_with_abilities(cid, ri, LDC, grown)


def char_totals_for_tier(cid: str, ri: str) -> tuple[dict, str]:
    """UR uses EX kit; SSR uses SP column (user-requested)."""
    cid = A.normalize_id(cid)
    ri = str(ri)
    if ri == "5":
        _, totals = char_analysis(cid, deep=True)
        return totals, "ex"
    grown = {}
    raw = A.char_stat_map.get(cid, {})
    for s in A.CHAR_STAT_ORDER:
        st = raw.get(s, (0, 0, 0))
        if isinstance(st, (list, tuple)) and len(st) >= 2:
            grown[s] = A.calc_growth_char(st[0], st[1], ri)
        else:
            grown[s] = 0
    if ri == "4":
        return A.compute_char_stat_totals_sp_list(cid, ri, LDC, grown), "sp"
    return A.compute_char_stat_totals_with_abilities(cid, ri, LDC, grown), "normal"


def char_damage_dealt_bonus(cid: str) -> int:
    best = 0
    for bab in build_char_abilities(cid):
        for d2 in bab.get("details", []) or []:
            text = d2.get("text", "") if isinstance(d2, dict) else str(d2)
            for m in DMG_DEALT_RE.finditer(text or ""):
                best = max(best, int(m.group(1) or m.group(2) or 0))
    return best


def char_debuff_potential(cid: str) -> int:
    best = 0
    for bab in build_char_abilities(cid):
        for d2 in bab.get("details", []) or []:
            text = d2.get("text", "") if isinstance(d2, dict) else str(d2)
            for m in DEF_DEBUFF_CHAR_RE.finditer(text or ""):
                best = max(best, int(m.group(1)))
    return best


def score_pilot_for_unit(uid: str, cid: str) -> tuple[float, list[str]]:
    """How well this pilot fits this unit (higher = better)."""
    reasons = []
    score = 0.0
    cid = A.normalize_id(cid)
    if cid not in A.char_list_playable_ids:
        return 0.0, []
    u_tags = set(unit_tag_ids(uid))
    c_tags = set(char_tag_ids(cid))
    overlap = u_tags & c_tags
    if overlap:
        score += 4.0 * len(overlap)
        reasons.append(f"Tag overlap ({len(overlap)})")
    if same_series(uid, cid):
        score += 10.0
        reasons.append("Same series as unit")
    bundled = bundled_pilot_id(uid)
    if bundled and cid == bundled:
        score += 35.0
        reasons.append("Gacha bundled pilot (comes with unit)")
    flags, totals = char_analysis(cid, deep=True)
    urole = str(A.unit_info_map.get(uid, {}).get("role", "1"))
    if flags["chance_step_x2"]:
        score += 6.0 if urole == "1" else 12.0
        reasons.append("Chance Step ×2")
    if urole == "1" and flags.get("guaranteed_crit"):
        score += 22.0 if cid == bundled else 12.0
        reasons.append("Guaranteed Critical (Supercharged EX)")
    elif urole == "1" and flags.get("supercharged_ex"):
        score += 10.0
        reasons.append("Supercharged EX offensive chain")
    if urole == "1" and flags["support_attack_x2"]:
        score += 8.0
        reasons.append("Support Attack ×2")
    if urole in ("2", "3") and flags["support_defense_x2"]:
        score += 10.0
        reasons.append("Support Defense ×2")
    if flags["affinity_matches"]:
        score += 6.0 * len(flags["affinity_matches"])
        reasons.append("Affinity ability matches tags")
    if urole == "1":
        score += min(12, (totals.get("Ranged", 0) + totals.get("Melee", 0) + totals.get("Awaken", 0)) / 2500.0)
    elif urole == "3":
        score += min(8, char_debuff_potential(cid) * 0.2)
    elif urole == "2":
        score += min(10, totals.get("Defense", 0) / 400.0)
    for buff in flags["squad_buffs"]:
        cond = buff.get("condition_tags") or []
        if not cond:
            continue
        cond_l = [c.lower() for c in cond]
        unit_names = [n.lower() for n in tag_labels_from_ids(list(u_tags))]
        if any(any(ct in un for un in unit_names) for ct in cond_l):
            score += 8.0 + buff.get("atk_pct", 0) * 0.15 + buff.get("def_pct", 0) * 0.1
            reasons.append(
                f"Squad buff +{buff.get('atk_pct', 0)}% ATK / +{buff.get('def_pct', 0)}% DEF for matching tags"
            )
    return round(score, 1), reasons[:6]


def top_pilots_for_unit(uid: str, limit: int = 3) -> list:
    _ensure_tag_char_index()
    cands = set()
    b = bundled_pilot_id(uid)
    if b:
        cands.add(b)
    us = A.unit_ser_map.get(uid, "")
    if us:
        for cid, cs in LD.get("char_ser_map", {}).items():
            if cs == us and cid in A.char_list_playable_ids:
                cands.add(cid)
    for lid in unit_tag_ids(uid):
        cands |= _TAG_TO_CHARS.get(lid, set())
    ranked = []
    for cid in cands:
        sc, rs = score_pilot_for_unit(uid, cid)
        if sc <= 0:
            continue
        fl, _ = char_analysis(cid, deep=True)
        ranked.append({
            "id": cid,
            "name": char_name(cid),
            "fit_score": sc,
            "reasons": rs,
            "chance_step_x2": fl["chance_step_x2"],
            "support_attack_x2": fl["support_attack_x2"],
            "support_defense_x2": fl["support_defense_x2"],
            "guaranteed_crit": fl.get("guaranteed_crit", False),
            "supercharged_ex": fl.get("supercharged_ex", False),
            "squad_buffs": fl["squad_buffs"][:3],
            "is_bundled": cid == b,
            "is_limited_time": is_limited_char(cid),
        })
    ranked.sort(key=lambda x: (-x["fit_score"], x["name"]))
    out, seen = [], set()
    for row in ranked:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        out.append(row)
        if len(out) >= limit:
            break
    return out


def supporter_leader_skill_rows(sid: str) -> list[dict]:
    """Tier-3 leader rows with tags from resolve_condition_tags (same as /api supporter detail)."""
    sid = A.normalize_id(sid)
    llk = LD.get("lineage_lookup", {})
    snm = LD.get("series_name_map", {})
    rows = []
    for ls in A.supporter_leader_map.get(sid, []) or []:
        if ls.get("tier") != 3:
            continue
        tcid = A.normalize_id(ls.get("trait_cond_id", "0"))
        desc = LD.get("supporter_leader_text_map", {}).get(ls.get("desc_lang_id", ""), "")
        pct = A._leader_skill_pct_from_desc(desc)
        tags = A.resolve_condition_tags(tcid, A.trait_condition_raw_map, llk, snm, LC)
        sep = "and" if "44%" in desc else ("or" if "36%" in desc or len(tags) >= 2 else "default")
        rows.append({
            "pct": pct,
            "desc": desc,
            "trait_cond_id": tcid,
            "tags": tags,
            "tag_names": [t.get("name") for t in tags if t.get("name")],
            "separator": sep,
        })
    rows.sort(key=lambda x: (-x["pct"], x.get("trait_cond_id", "")))
    return rows


def _format_leader_target(tags: list, separator: str = "default") -> str:
    """Human-readable buff target from leader skill condition tags."""
    if not tags:
        return "all squad units (no tag filter)"
    lineage = [t["name"] for t in tags if t.get("type") in ("unit", "group", "unit_role")]
    series = [t["name"] for t in tags if t.get("type") == "series"]
    specific = [t["name"] for t in tags if t.get("type") == "unit" and t.get("source") == "unit_ids"]
    parts = []
    if lineage:
        joiner = " AND " if separator == "and" else (" OR " if separator == "or" else ", ")
        parts.append(f"MS tagged {joiner.join(lineage)}")
    if series:
        parts.append(f"MS from {', '.join(series)}")
    if specific:
        parts.append(f"specific units: {', '.join(specific[:3])}")
    return " · ".join(parts) if parts else "matching leader condition"


def _format_leader_skill_line(skill: dict) -> str:
    pct = int(skill.get("pct") or 0)
    target = _format_leader_target(skill.get("tags") or [], skill.get("separator", "default"))
    return f"+{pct}% all stats to {target}"


def supporter_leader_profile(sid: str, quality_index: dict | None = None) -> dict:
    sid = A.normalize_id(sid)
    leader_skills = supporter_leader_skill_rows(sid)
    tag_names = []
    tag_ids = []
    seen_n, seen_i = set(), set()
    for sk in leader_skills:
        for t in sk.get("tags") or []:
            nm = (t.get("name") or "").strip()
            tid = str(t.get("id", "")).strip()
            if nm and nm not in seen_n:
                tag_names.append(nm)
                seen_n.add(nm)
            if tid and tid != "0" and tid not in seen_i:
                tag_ids.append(tid)
                seen_i.add(tid)
    max_pct = max((int(sk.get("pct") or 0) for sk in leader_skills), default=0)
    desc_snip = (leader_skills[0].get("desc") or "")[:160] if leader_skills else ""
    match_units = 0
    matched_scores: list[float] = []
    ace_covered = 0
    ace_score_sum = 0.0
    high_tier = 0
    tag_weighted_sum = 0.0
    for uid in A.unit_list_playable_ids:
        if not A.supporter_leader_applies_to_unit(sid, uid, LD, LC):
            continue
        match_units += 1
        if not quality_index:
            continue
        sc = float(quality_index.get(uid, 0) or 0)
        if sc <= 0:
            continue
        w = 1.0
        for tn in tag_labels_from_ids(unit_tag_ids(uid)):
            w = max(w, TAG_LEADER_QUALITY_WEIGHT.get(tn, 1.0))
        tag_weighted_sum += sc * w
        matched_scores.append(sc)
        if sc >= 70:
            high_tier += 1
        utags = tag_labels_from_ids(unit_tag_ids(uid))
        if any("Ace Unit" in t for t in utags):
            ace_covered += 1
            ace_score_sum += sc
    pool = max(1, len(A.unit_list_playable_ids))
    q_pool = sum(quality_index.values()) if quality_index else 0
    out = {
        "tag_ids": tag_ids,
        "tag_names": tag_names,
        "leader_skills": leader_skills,
        "max_leader_pct": max_pct,
        "desc_snippet": desc_snip,
        "matching_units": match_units,
        "matching_units_pct": round(100.0 * match_units / pool, 1),
        "quality_avg": round(sum(matched_scores) / len(matched_scores), 1) if matched_scores else 0.0,
        "quality_capture_pct": round(100.0 * sum(matched_scores) / q_pool, 2) if q_pool and matched_scores else 0.0,
        "tag_weighted_capture_pct": round(100.0 * tag_weighted_sum / q_pool, 2) if q_pool and tag_weighted_sum else 0.0,
        "high_tier_units": high_tier,
        "ace_units_covered": ace_covered,
        "ace_quality_avg": round(ace_score_sum / ace_covered, 1) if ace_covered else 0.0,
    }
    return out


def score_supporter_for_unit(uid: str, sid: str) -> tuple[float, list[str]]:
    if not A.supporter_leader_applies_to_unit(sid, uid, LD, LC):
        return 0.0, []
    prof = supporter_leader_profile(sid)
    sk0 = (prof.get("leader_skills") or [{}])[0]
    reasons = [_format_leader_skill_line(sk0)] if sk0.get("pct") else [
        f"Leader up to {prof['max_leader_pct']}%"
    ]
    score = prof["max_leader_pct"] * 0.85 + min(12, prof["matching_units_pct"] * 0.12)
    if is_limited_supporter(sid):
        score += 5.0
        reasons.append("Limited-time supporter — high pull priority")
    return round(score, 1), reasons


_UR_SUPPORTER_IDS: list | None = None


def _ur_supporter_ids():
    global _UR_SUPPORTER_IDS
    if _UR_SUPPORTER_IDS is None:
        _UR_SUPPORTER_IDS = [
            sid for sid, info in A.supporter_info_map.items()
            if str(info.get("rarity", "1")) == "5"
        ]
    return _UR_SUPPORTER_IDS


def top_supporters_for_unit(uid: str, limit: int = 3) -> list:
    ranked = []
    for sid in _ur_supporter_ids():
        sc, rs = score_supporter_for_unit(uid, sid)
        if sc <= 0:
            continue
        prof = supporter_leader_profile(sid)
        ranked.append({
            "id": sid,
            "name": supporter_name(sid),
            "fit_score": sc,
            "reasons": rs,
            "leader_pct": prof["max_leader_pct"],
            "tags": prof["tag_names"],
            "leader_skills": prof.get("leader_skills") or [],
            "matching_units_pct": prof["matching_units_pct"],
            "is_limited_time": is_limited_supporter(sid),
        })
    ranked.sort(key=lambda x: (-x["fit_score"], x["name"]))
    return ranked[:limit]


# --- Multi-axis tier v1 (stat / damage / ML buff / utility) ---

AXIS_KEYS = ("stat", "damage", "ml_buff", "utility")
_STAT_AXIS_CAP = {"1": 14.0, "2": 20.0, "3": 10.0}
_DAMAGE_AXIS_CAP = {"1": 54.0, "2": 14.0, "3": 14.0}
_ML_BUFF_SETS: dict | None = None


def build_ml_buff_target_sets() -> dict:
    """LeagueBuffTargetSetId → [{type_index, target_id}] from bundled EN master."""
    path = ROOT / "data" / "EN" / "master" / "m_league_buff_target.json"
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out = {}
    for row in data if isinstance(data, list) else (data.get("data") or []):
        if not isinstance(row, dict):
            continue
        bset = A.normalize_id(row.get("LeagueBuffTargetSetId") or row.get("leagueBuffTargetSetId"))
        if bset == "0":
            continue
        ttype = int(row.get("LeagueBuffTargetTypeIndex") or row.get("leagueBuffTargetTypeIndex") or 0)
        tid = A.normalize_id(row.get("TargetId") or row.get("targetId"))
        out.setdefault(bset, []).append({"type_index": ttype, "target_id": tid})
    return out


def unit_lineage_tag_ids(uid: str) -> set:
    ids = set()
    for row in A.unit_lin_map.get(uid, []) or []:
        if isinstance(row, (list, tuple)):
            for tid in row:
                nid = A.normalize_id(tid)
                if nid != "0":
                    ids.add(nid)
        else:
            nid = A.normalize_id(row)
            if nid != "0":
                ids.add(nid)
    return ids


def unit_series_ids(uid: str) -> set:
    sset = A.unit_ser_map.get(uid, "")
    ids = set()
    if sset and str(sset) != "0":
        for sid in (LDC.get("ser_set_map") or {}).get(sset, []):
            nid = A.normalize_id(sid)
            if nid != "0":
                ids.add(nid)
    return ids


def ml_buff_fit_raw(uid: str, buff_sets: dict | None = None) -> float:
    """How many ML seasons' buff targets this unit matches (tag or series)."""
    buff_sets = buff_sets if buff_sets is not None else (_ML_BUFF_SETS or {})
    if not buff_sets:
        return 0.0
    tags = unit_lineage_tag_ids(uid)
    series = unit_series_ids(uid)
    seasons = 0
    for _set_id, targets in buff_sets.items():
        for t in targets:
            ti = int(t.get("type_index") or 0)
            tid = t.get("target_id", "0")
            if ti == 2 and tid in tags:
                seasons += 1
                break
            if ti == 1 and tid in series:
                seasons += 1
                break
    return float(seasons)


def collect_unit_trait_type_indices(uid: str) -> list[int]:
    seen = set()
    out = []
    for ab in A.unit_abil_map.get(uid, []) or []:
        ab_id = str(ab.get("id", ""))
        tsid = A.normalize_id(A.abil_link_map.get(ab_id, ab_id))
        lookup_id = tsid[:-2] if len(tsid) > 2 else tsid
        tids = A.trait_set_traits_map.get(tsid, []) or A.trait_set_traits_map.get(lookup_id, [])
        for tid in tids:
            tdata = A.trait_data_map.get(tid, {}) or {}
            tti = int(tdata.get("trait_type_index") or 0)
            if tti and tti not in seen:
                seen.add(tti)
                out.append(tti)
    return out


def utility_raw_score(uid: str) -> float:
    return sum(game_enums.trait_utility_weight(tti) for tti in collect_unit_trait_type_indices(uid))


def axis_stat_raw(role: str, stat_pts: float) -> float:
    cap = _STAT_AXIS_CAP.get(role, 14.0)
    return min(DISPLAY_SCORE_CAP, (float(stat_pts) / cap) * DISPLAY_SCORE_CAP) if cap else 0.0


def axis_damage_raw(role: str, wpn_pts: float, peak_pts: float) -> float:
    cap = _DAMAGE_AXIS_CAP.get(role, 54.0)
    pts = float(wpn_pts) + (float(peak_pts) if role == "1" else 0.0)
    return min(DISPLAY_SCORE_CAP, (pts / cap) * DISPLAY_SCORE_CAP) if cap else 0.0


def finalize_unit_axes(unit_rows: list) -> None:
    """Percentile-normalize ml_buff + utility; attach tier per axis."""
    pools = {k: [] for k in AXIS_KEYS}
    for r in unit_rows:
        raw = r.get("axes_raw") or {}
        for k in AXIS_KEYS:
            pools[k].append(float(raw.get(k) or 0))
    for r in unit_rows:
        raw = r.pop("axes_raw", {}) or {}
        axes = {}
        for k in AXIS_KEYS:
            if k in ("ml_buff", "utility"):
                sc = percentile_rank(float(raw.get(k) or 0), pools[k]) * DISPLAY_SCORE_CAP
            else:
                sc = float(raw.get(k) or 0)
            sc = round(min(DISPLAY_SCORE_CAP, max(0.0, sc)), 1)
            axes[k] = {"score": sc, "tier": score_to_tier(sc)}
            if k == "utility":
                ttypes = collect_unit_trait_type_indices(r.get("id", ""))
                axes[k]["trait_types"] = [
                    {
                        "index": tti,
                        "key": game_enums.enum_key("TraitType", tti),
                        "label": game_enums.enum_label("TraitType", tti),
                        "weight": game_enums.trait_utility_weight(tti),
                    }
                    for tti in sorted(ttypes, key=lambda x: -game_enums.trait_utility_weight(x))[:6]
                ]
            if k == "ml_buff" and raw.get("ml_buff_seasons") is not None:
                axes[k]["season_matches"] = int(raw.get("ml_buff_seasons") or 0)
        r["axes"] = axes


# --- Unit scoring ---


def ability_blob_unit(uid: str) -> str:
    parts = []
    for ab in A.unit_abil_map.get(uid, []):
        try:
            entry = A.build_ability_entry(
                str(ab["id"]), LDC["abil_name_map"], A.abil_link_map,
                A.trait_set_traits_map, A.trait_data_map, LDC["lang_text_map"], LDC["lang_text_map"],
                A.trait_condition_raw_map, LDC["lineage_lookup"], LDC["series_name_map"],
                A.ability_resource_map, LDC["abil_desc_map"], sort_order=ab.get("sort", 0), lang_code=LC,
            )
            for d in entry.get("details", []):
                parts.append(d.get("text", "") if isinstance(d, dict) else str(d))
        except Exception:
            pass
    return "\n".join(parts)


def score_unit(uid: str, er_stages: list, pop: dict) -> dict:
    info = A.unit_info_map.get(uid, {})
    role = str(info.get("role", "1"))
    ri = str(info.get("rarity", "1"))
    acq = str(info.get("acquisition_route", "0"))
    stat_mode = unit_stat_mode_for_rarity(ri)
    raw = A.unit_stat_map.get(uid, {})
    block = A._unit_max_lb_stat_block(uid, info, raw, LDC)
    ssp = A._unit_lb_row_to_api(block, stat_mode, False) if block else {}
    cov = sortie_coverage(uid, er_stages)
    wpn = weapon_signals(uid, stat_mode)
    abil = ability_blob_unit(uid)
    ter_pts, ter_detail = terrain_score_er_weighted(uid)
    limited = is_limited_unit(uid)

    sortie_pts = min(30, cov["adj_pct"] * 0.30)
    atk = float(ssp.get("ATK", 0) or 0)
    hp = float(ssp.get("HP", 0) or 0)
    df = float(ssp.get("DEF", 0) or 0)
    mob = float(ssp.get("MOB", 0) or 0)
    move = float(ssp.get("MOV", 0) or 0)

    sim_dmg = estimate_attack_ex_damage(uid) if role == "1" else {}
    pop_sim = pop.get("sim_peak") or [sim_dmg.get("effective_peak", 0)]
    peak_pts = peak_damage_pts_from_sim(sim_dmg, wpn["max_range"], role, pop_sim)
    if role == "1":
        stat_pts = percentile_rank(atk, pop["atk"]) * 0.10 + percentile_rank(mob, pop["mob"]) * 0.04
        wpn_pts = sum([
            8 if wpn["max_range"] >= 5 else (5 if wpn["max_range"] >= 4 else (2 if wpn["max_range"] >= 3 else 0)),
            6 if wpn["has_map"] else 0, 8 if wpn["map_after_move"] else 0,
        ]) + peak_pts
        abil_pts = min(6, (4 if EN_RECOVER_RE.search(abil) else 0) + (2 if DR_RE.search(abil) else 0))
    elif role == "3":
        stat_pts = percentile_rank(df, pop["def"]) * 0.04 + percentile_rank(mob, pop["mob"]) * 0.06
        wpn_pts = min(14, wpn["max_def_debuff"] * 0.28) + (6 if wpn["max_range"] >= 5 else (4 if wpn["max_range"] >= 4 else 0)) + (3 if wpn["has_map"] else 0)
        abil_pts = min(12, (6 if HEAL_RE.search(abil) else 0) + (3 if DR_RE.search(abil) else 0))
    else:
        stat_pts = percentile_rank(hp, pop["hp"]) * 0.08 + percentile_rank(df, pop["def"]) * 0.08 + percentile_rank(mob, pop["mob"]) * 0.04
        wpn_pts = min(6, wpn["max_def_debuff"] * 0.12) + (5 if move >= 5 else (2 if move >= 4 else 0)) + (3 if wpn["max_range"] >= 4 else 0)
        abil_pts = min(10, (5 if DR_RE.search(abil) else 0) + (4 if HEAL_RE.search(abil) else 0))

    pilots = top_pilots_for_unit(uid, 3)
    supporters = top_supporters_for_unit(uid, 3)
    team_pts = 0.0
    crit_synergy_pts = 0.0
    bundle = bundled_pilot_id(uid)
    if bundle:
        bsc, _ = score_pilot_for_unit(uid, bundle)
        team_pts += min(6, bsc * 0.15)
        if role == "1":
            bflags, _ = char_analysis(bundle, deep=True)
            if bflags.get("guaranteed_crit"):
                crit_synergy_pts = 8.0
    if supporters:
        team_pts += min(4, supporters[0]["fit_score"] * 0.10)

    total = sortie_pts + ter_pts + stat_pts + wpn_pts + abil_pts + team_pts + crit_synergy_pts + (3 if acq == "1" else 1)
    total = apply_limited_bonus(min(DISPLAY_SCORE_CAP, total), limited)

    bullets = []
    if limited:
        bullets.append("Limited availability — prioritize while on banner")
    if wpn["map_after_move"]:
        bullets.append("MAP after moving (safe poke)")
    elif wpn["has_map"]:
        bullets.append("Has MAP weapon")
    if wpn["max_range"] >= 5:
        bullets.append(f"Reach {wpn['max_range']}")
    if role == "1" and sim_dmg.get("effective_peak"):
        bullets.append(
            f"Sim EX hit ~{sim_dmg['effective_peak']:,} (bundled pilot, {_SIM_REF_DEF_DEBUFF_PCT}% DEF debuff ref boss)"
        )
    if bundle:
        bullets.append(f"Bundled pilot: {char_name(bundle)}")
    elif pilots:
        bullets.append(f"Swap-in pilot option: {pilots[0]['name']}")
    if supporters:
        bullets.append(f"Best UR supporter: {supporters[0]['name']} ({supporters[0]['leader_pct']}% — {', '.join(supporters[0]['tags'][:2])})")
    if cov["adj_pct"] < 60:
        bullets.append(f"ER coverage ~{cov['adj_pct']:.0f}%")
    if ter_detail.get("space_ground_dual"):
        bullets.append(
            f"Space+Ground terrain (ER fit {ter_detail.get('er_stage_fit_pct', 0):.0f}%) — covers most stages"
        )

    ml_seasons = ml_buff_fit_raw(uid)
    util_raw = utility_raw_score(uid)
    return {
        "id": uid, "name": unit_name(uid), "role": A.ROLE_MAP.get(role, "?"),
        "rarity": A.RARITY_MAP.get(ri, "?"), "acquisition": acq,
        "is_gacha_ex": acq == "1" and str(uid).endswith("50") and ri == "5",
        "is_limited_time": limited, "pull_priority": "high" if limited else "normal",
        "score": round(total, 1), "tier": score_to_tier(total), "tier_meta": "A",
        "subscores": {
            "sortie": round(sortie_pts, 1), "terrain": round(ter_pts, 1),
            "stats": round(stat_pts, 1), "weapons": round(wpn_pts, 1),
            "peak_damage": round(peak_pts if role == "1" else 0, 1),
            "abilities": round(abil_pts, 1), "team_synergy": round(team_pts, 1),
            "crit_synergy": round(crit_synergy_pts, 1),
        },
        "axes_raw": {
            "stat": axis_stat_raw(role, stat_pts),
            "damage": axis_damage_raw(role, wpn_pts, peak_pts if role == "1" else 0),
            "ml_buff": ml_seasons,
            "ml_buff_seasons": int(ml_seasons),
            "utility": util_raw,
        },
        "coverage": cov, "weapons": wpn, "stats_ssp": ssp, "stat_mode": stat_mode,
        "terrain_detail": ter_detail, "sim_damage": sim_dmg,
        "top_pilots": pilots, "top_supporters": supporters,
        "bundled_pilot_id": bundled_pilot_id(uid),
        "bullets": bullets[:8],
        "is_tier_pool": int(ri) >= 4,
        "is_meta_pool": acq == "1" and str(uid).endswith("50") and ri == "5",
    }


def score_character(cid: str, pop: dict) -> dict:
    info = A.char_info_map.get(cid, {})
    role = str(info.get("role", "0"))
    ri = str(info.get("rarity", "1"))
    limited = is_limited_char(cid)
    deep = ri == "5" or is_limited_char(cid)
    flags, _ = char_analysis(cid, deep=deep)
    totals, kit_mode = char_totals_for_tier(cid, ri)
    squad = flags["squad_buffs"]
    debuff = char_debuff_potential(cid)
    dmg_dealt = char_damage_dealt_bonus(cid)

    if role == "1":
        primary = totals.get("Ranged", 0) + totals.get("Melee", 0) + totals.get("Awaken", 0)
        stat_pts = percentile_rank(primary, pop["primary"]) * 0.18
    elif role == "3":
        stat_pts = percentile_rank(totals.get("Defense", 0), pop["defense"]) * 0.2 + min(15, debuff * 0.35)
    else:
        stat_pts = percentile_rank(totals.get("Defense", 0), pop["defense"]) * 0.25 + percentile_rank(totals.get("Reaction", 0), pop["reaction"]) * 0.1

    special_pts = 0.0
    burst_pts = 0.0
    if flags.get("guaranteed_crit") and role == "1":
        special_pts += 28
        burst_pts += 24
    elif flags.get("supercharged_ex") and role == "1":
        special_pts += 10
        burst_pts += 12
    if dmg_dealt >= 10 and role == "1":
        burst_pts += min(14, dmg_dealt * 0.35)
    if flags["chance_step_x2"]:
        special_pts += 6 if role == "1" else 14
    if flags["support_defense_x2"]:
        special_pts += 12
    if flags["support_attack_x2"]:
        special_pts += 12
    squad_pts = min(18, sum(b.get("atk_pct", 0) + b.get("def_pct", 0) * 0.5 for b in squad) * 0.4 + len(squad) * 2)
    aff_pts = min(8, len(flags["affinity_matches"]) * 4)

    total = stat_pts + special_pts + burst_pts + squad_pts + aff_pts
    total = apply_limited_bonus(min(DISPLAY_SCORE_CAP, total), limited)

    bullets = []
    if limited:
        bullets.append("Limited availability")
    if dmg_dealt >= 10 and role == "1":
        bullets.append(f"+{dmg_dealt}% Damage Dealt ability (multiplies final hit harder than flat stats)")
    if flags.get("guaranteed_crit"):
        bullets.append("Guaranteed Critical (Supercharged EX) — assign on unrestricted stages for burst turns")
    if flags.get("supercharged_ex") and not flags.get("guaranteed_crit"):
        bullets.append("Supercharged EX offensive chain")
    if flags["chance_step_x2"]:
        bullets.append("Chance Step ×2")
    if flags["support_defense_x2"]:
        bullets.append("Support Defense ×2")
    if flags["support_attack_x2"]:
        bullets.append("Support Attack ×2")
    for b in squad[:2]:
        tags = ", ".join(b["condition_tags"][:3]) or "conditional"
        bullets.append(f"Squad buff +{b['atk_pct']}% ATK for {tags}")

    return {
        "id": cid, "name": char_name(cid), "role": A.ROLE_MAP.get(role, "?"),
        "rarity": A.RARITY_MAP.get(ri, "?"),
        "is_limited_time": limited, "pull_priority": "high" if limited else "normal",
        "score": round(total, 1), "tier": score_to_tier(total), "tier_meta": "A",
        "stats": totals, "special": flags, "kit_mode": kit_mode,
        "damage_dealt_bonus_pct": dmg_dealt,
        "tag_names": tag_labels_from_ids(char_tag_ids(cid))[:10],
        "bullets": bullets[:8],
        "is_tier_pool": int(ri) >= 4,
        "is_meta_pool": ri == "5",
    }


def score_supporter(sid: str, quality_index: dict | None = None) -> dict:
    info = A.supporter_info_map.get(sid, {})
    ri = str(info.get("rarity", "1"))
    limited = is_limited_supporter(sid)
    prof = supporter_leader_profile(sid, quality_index)
    leader_pts = prof["max_leader_pct"] * 0.55
    quality_pts = min(22, prof.get("quality_avg", 0) * 0.22)
    capture_pts = min(14, prof.get("tag_weighted_capture_pct", 0) * 0.55)
    ace_pts = min(10, prof.get("ace_units_covered", 0) * 0.12 + prof.get("ace_quality_avg", 0) * 0.04)
    high_pts = min(6, prof.get("high_tier_units", 0) * 0.08)
    total = leader_pts + quality_pts + capture_pts + ace_pts + high_pts
    total = apply_limited_bonus(min(DISPLAY_SCORE_CAP, total), limited)
    skill_lines = [_format_leader_skill_line(sk) for sk in prof.get("leader_skills") or []]
    bullets = []
    if skill_lines:
        bullets.append(skill_lines[0])
        if len(skill_lines) > 1:
            bullets.append(f"Alt leader: {skill_lines[1]}")
    else:
        bullets.append(f"Leader up to {prof['max_leader_pct']}%")
    if prof.get("ace_units_covered"):
        bullets.append(
            f"Covers {prof['ace_units_covered']} Ace Unit MS (avg score {prof.get('ace_quality_avg', 0)})"
        )
    if prof.get("quality_avg"):
        bullets.append(
            f"Quality-weighted coverage: avg unit score {prof['quality_avg']}, "
            f"tag-weighted capture {prof.get('tag_weighted_capture_pct', 0):.1f}%"
        )
    else:
        bullets.append(f"Raw roster coverage ~{prof['matching_units_pct']:.0f}% of units")
    if limited:
        bullets.insert(0, "Limited availability — UR gacha only")
    return {
        "id": sid, "name": supporter_name(sid), "rarity": A.RARITY_MAP.get(ri, "?"),
        "is_limited_time": limited, "pull_priority": "critical" if limited else "normal",
        "score": round(total, 1), "tier": score_to_tier(total), "tier_meta": "A",
        "leader_profile": prof, "bullets": bullets,
        "is_tier_pool": ri == "5",
        "is_meta_pool": ri == "5", "role": "Supporter",
    }


def _pool_median(values: list) -> float:
    vals = sorted(v for v in values if v is not None)
    n = len(vals)
    if not n:
        return 0.0
    mid = n // 2
    if n % 2:
        return float(vals[mid])
    return (vals[mid - 1] + vals[mid]) / 2.0


def _rank_desc(value: float, population: list) -> tuple[int, int]:
    """1 = best (highest value)."""
    pop = [v for v in population if v is not None]
    if not pop:
        return 1, 0
    return 1 + sum(1 for v in pop if v > value), len(pop)


def _top_n_label(rank: int, total: int) -> str:
    if total <= 0 or rank <= 0:
        return ""
    if rank == 1:
        return "#1 in pool"
    if rank <= 3:
        return f"top {rank} of {total}"
    pct = int(round(100.0 * (total - rank + 1) / total))
    if pct >= 75:
        return f"top {pct}% of {total}"
    return ""


def _pick_reasons(candidates: list[tuple[int, str]], limit: int = REASON_LIMIT) -> list[str]:
    seen = set()
    out = []
    for _prio, text in sorted(candidates, key=lambda x: (-x[0], x[1])):
        if text in seen:
            continue
        seen.add(text)
        out.append(text)
        if len(out) >= limit:
            break
    return out


def _short_attack_reasons(row: dict, peers: list) -> list[str]:
    out: list[tuple[int, str]] = []
    wpn = row.get("weapons") or {}
    ter = row.get("terrain_detail") or {}
    cov = row.get("coverage") or {}
    sim = row.get("sim_damage") or {}
    sim_peak = int(sim.get("effective_peak") or 0)
    sim_peaks = [int((p.get("sim_damage") or {}).get("effective_peak") or 0) for p in peers]
    sr, st = _rank_desc(sim_peak, sim_peaks) if sim_peak else (0, len(peers))
    pool = f"{row.get('rarity', 'UR')} Attack"

    if sim_peak:
        lbl = _top_n_label(sr, st) or f"#{sr} sim EX"
        out.append((100, f"{lbl} — ~{sim_peak:,} hit ({pool}, bundled pilot)"))
    if row.get("is_limited_time"):
        out.append((92, "Limited banner — prioritize while available"))
    if float((row.get("subscores") or {}).get("crit_synergy") or 0) >= 8:
        out.append((90, "Bundled Guaranteed Critical pilot"))
    if wpn.get("map_after_move"):
        out.append((88, "MAP after move — rare safe poke on ER"))
    elif wpn.get("has_map"):
        out.append((58, "Has MAP for wave clear"))
    if ter.get("space_ground_dual"):
        out.append((72, f"Space + Ground terrain ({ter.get('er_stage_fit_pct', 0):.0f}% ER stages)"))
    adj = float(cov.get("adj_pct") or 0)
    if adj >= 75:
        out.append((55, f"Wide ER sortie tags (~{adj:.0f}%)"))
    elif adj < 55:
        out.append((45, f"Narrow ER tags (~{adj:.0f}%)"))
    sups = row.get("top_supporters") or []
    if sups:
        out.append((50, f"Best leader: {sups[0]['name']} ({sups[0].get('leader_pct', 0)}%)"))
    if not row.get("is_limited_time") and sr > 8 and int(wpn.get("max_power") or 0) >= 8000:
        out.append((42, f"High sheet power but only #{sr} sim — below SSS burst bar"))
    sc = float(row.get("score") or 0)
    out.append((20, f"Meta {row.get('tier_meta', '?')} · score {sc:.1f} vs {len(peers)} {pool}"))
    return _pick_reasons(out)


def _short_defense_reasons(row: dict, peers: list) -> list[str]:
    out: list[tuple[int, str]] = []
    wpn = row.get("weapons") or {}
    ssp = row.get("stats_ssp") or {}
    ter = row.get("terrain_detail") or {}
    pool = f"{row.get('rarity', 'UR')} Defense"
    hp = float(ssp.get("HP") or 0)
    df = float(ssp.get("DEF") or 0)
    mob = float(ssp.get("MOV") or 0)
    deb = int(wpn.get("max_def_debuff") or 0)
    hps = [float((p.get("stats_ssp") or {}).get("HP") or 0) for p in peers]
    dfs = [float((p.get("stats_ssp") or {}).get("DEF") or 0) for p in peers]

    hr, ht = _rank_desc(hp, hps)
    dr, dt = _rank_desc(df, dfs)
    if hr <= 5:
        out.append((90, f"Top HP bulk — {int(hp)} ({_top_n_label(hr, ht) or f'#{hr}'})"))
    if dr <= 5:
        out.append((86, f"Top DEF — {int(df)} ({_top_n_label(dr, dt) or f'#{dr}'})"))
    if mob >= 5:
        out.append((78, f"MOV {int(mob)} — full reposition without losing step"))
    if deb >= 20:
        dbr, _ = _rank_desc(deb, [int((p.get("weapons") or {}).get("max_def_debuff") or 0) for p in peers])
        out.append((74, f"{deb}% DEF debuff weapon ({_top_n_label(dbr, len(peers)) or f'#{dbr}'})"))
    if ter.get("space_ground_dual"):
        out.append((62, f"Space + Ground ({ter.get('er_stage_fit_pct', 0):.0f}% ER fit)"))
    if row.get("is_limited_time"):
        out.append((55, "Limited banner tank"))
    sc = float(row.get("score") or 0)
    out.append((20, f"Meta {row.get('tier_meta', '?')} · score {sc:.1f} vs {len(peers)} {pool}"))
    return _pick_reasons(out)


def _short_support_reasons(row: dict, peers: list) -> list[str]:
    out: list[tuple[int, str]] = []
    wpn = row.get("weapons") or {}
    pool = f"{row.get('rarity', 'UR')} Support"
    deb = int(wpn.get("max_def_debuff") or 0)
    rng = int(wpn.get("max_range") or 0)

    if deb >= 25:
        dr, _ = _rank_desc(deb, [int((p.get("weapons") or {}).get("max_def_debuff") or 0) for p in peers])
        out.append((92, f"{deb}% DEF debuff at range {rng} ({_top_n_label(dr, len(peers)) or f'#{dr}'})"))
    elif deb >= 15:
        out.append((72, f"Range-{rng} with {deb}% DEF debuff"))
    if wpn.get("map_after_move"):
        out.append((88, "MAP after move — rare on support MS"))
    elif wpn.get("has_map"):
        out.append((55, "Has MAP for backline control"))
    bundle = row.get("bundled_pilot_id") or ""
    if bundle:
        fl, _ = char_analysis(bundle, deep=True)
        if fl.get("support_attack_x2"):
            out.append((70, f"Bundled {char_name(bundle)} — Support Attack ×2"))
    if row.get("is_limited_time"):
        out.append((50, "Limited banner support"))
    sc = float(row.get("score") or 0)
    out.append((20, f"Meta {row.get('tier_meta', '?')} · score {sc:.1f} vs {len(peers)} {pool}"))
    return _pick_reasons(out)


def _short_character_reasons(row: dict, peers: list) -> list[str]:
    out: list[tuple[int, str]] = []
    role = row.get("role", "")
    sp = row.get("special") or {}
    stats = row.get("stats") or {}
    pool = f"{row.get('rarity', 'UR')} {role} pilot"
    dmg_dealt = int(row.get("damage_dealt_bonus_pct") or 0)

    if role == "Attack":
        if sp.get("guaranteed_crit"):
            n = sum(1 for p in peers if (p.get("special") or {}).get("guaranteed_crit"))
            out.append((98, f"Guaranteed Critical — only {n}/{len(peers)} {pool}s"))
        elif sp.get("supercharged_ex"):
            out.append((82, "Supercharged EX burst kit"))
        if dmg_dealt >= 10:
            out.append((88, f"+{dmg_dealt}% Damage Dealt ability"))
        primary = stats.get("Ranged", 0) + stats.get("Melee", 0) + stats.get("Awaken", 0)
        pr, pt = _rank_desc(primary, [
            p.get("stats", {}).get("Ranged", 0) + p.get("stats", {}).get("Melee", 0) + p.get("stats", {}).get("Awaken", 0)
            for p in peers
        ])
        if pr <= 6:
            out.append((50, f"Strong dossier offense ({_top_n_label(pr, pt) or f'#{pr}'})"))
    elif role == "Defense":
        if sp.get("support_defense_x2"):
            n = sum(1 for p in peers if (p.get("special") or {}).get("support_defense_x2"))
            out.append((90, f"Support Defense ×2 — {n}/{len(peers)} {pool}s"))
        df = stats.get("Defense", 0)
        dr, dt = _rank_desc(df, [p.get("stats", {}).get("Defense", 0) for p in peers])
        if dr <= 8:
            out.append((72, f"Defense {df} ({_top_n_label(dr, dt) or f'#{dr}'})"))
    elif role == "Support":
        if sp.get("support_attack_x2"):
            n = sum(1 for p in peers if (p.get("special") or {}).get("support_attack_x2"))
            out.append((88, f"Support Attack ×2 — {n}/{len(peers)} {pool}s"))

    squad = sp.get("squad_buffs") or []
    if squad:
        best = max(squad, key=lambda b: b.get("atk_pct", 0) + b.get("def_pct", 0) * 0.5)
        if best.get("atk_pct", 0) + best.get("def_pct", 0) >= 7:
            tags = ", ".join((best.get("condition_tags") or [])[:2]) or "tag match"
            out.append((68, f"Squad buff +{best.get('atk_pct', 0)}% ATK when [{tags}]"))
    if row.get("is_limited_time"):
        out.append((48, "Limited banner pilot"))
    sc = float(row.get("score") or 0)
    out.append((20, f"Meta {row.get('tier_meta', '?')} · score {sc:.1f} vs {len(peers)} {pool}"))
    return _pick_reasons(out)


def _short_supporter_reasons(row: dict, peers: list) -> list[str]:
    out: list[tuple[int, str]] = []
    prof = row.get("leader_profile") or {}
    pct = int(prof.get("max_leader_pct") or 0)
    skills = prof.get("leader_skills") or supporter_leader_skill_rows(row.get("id", ""))
    pcts = [int((p.get("leader_profile") or {}).get("max_leader_pct") or 0) for p in peers]
    pr, pt = _rank_desc(pct, pcts)

    if skills:
        out.append((98, f"Leader {pct}% — {_format_leader_skill_line(skills[0])}"))
    elif pct:
        out.append((85, f"Leader buff up to {pct}%"))
    if pr <= 3:
        out.append((90, f"{_top_n_label(pr, pt) or f'#{pr}'} leader % among {pt} UR supporters"))
    qavg = float(prof.get("quality_avg") or 0)
    qmed = _pool_median([float((p.get("leader_profile") or {}).get("quality_avg") or 0) for p in peers])
    if qavg >= qmed + 3:
        out.append((82, f"Buffs strong MS (quality avg {qavg:.1f} vs {qmed:.1f} median)"))
    ace_n = int(prof.get("ace_units_covered") or 0)
    if ace_n >= 3:
        out.append((75, f"Covers {ace_n} Ace Unit MS"))
    cov = float(prof.get("matching_units_pct") or 0)
    if cov >= 25:
        out.append((55, f"Wide tag reach (~{cov:.0f}% of roster)"))
    elif pct >= 36 and cov < 15:
        out.append((60, f"Elite specialist — high {pct}% but narrow roster fit"))
    if row.get("is_limited_time"):
        out.append((45, "Limited banner supporter"))
    sc = float(row.get("score") or 0)
    out.append((20, f"Meta {row.get('tier_meta', '?')} · score {sc:.1f} vs {len(peers)} UR supporters"))
    return _pick_reasons(out)


def enrich_rank_advantages(unit_rows: list, char_rows: list, supp_rows: list) -> None:
    """4-5 short bullets explaining why this card ranks above peers."""
    unit_peers = defaultdict(list)
    for r in unit_rows:
        if r.get("is_tier_pool"):
            unit_peers[(r.get("role", ""), r.get("rarity", ""))].append(r)

    char_peers = defaultdict(list)
    for r in char_rows:
        if r.get("is_tier_pool"):
            char_peers[(r.get("role", ""), r.get("rarity", ""))].append(r)

    supp_peers = [r for r in supp_rows if r.get("is_tier_pool")]

    for r in unit_rows:
        role = r.get("role", "")
        peers = unit_peers.get((role, r.get("rarity", ""))) or []
        if not peers:
            r["rank_advantages"] = (r.get("bullets") or [])[:REASON_LIMIT]
            continue
        if role == "Attack":
            r["rank_advantages"] = _short_attack_reasons(r, peers)
        elif role == "Defense":
            r["rank_advantages"] = _short_defense_reasons(r, peers)
        else:
            r["rank_advantages"] = _short_support_reasons(r, peers)

    for r in char_rows:
        peers = char_peers.get((r.get("role", ""), r.get("rarity", ""))) or []
        if not peers:
            r["rank_advantages"] = (r.get("bullets") or [])[:REASON_LIMIT]
            continue
        r["rank_advantages"] = _short_character_reasons(r, peers)

    for r in supp_rows:
        if not supp_peers:
            r["rank_advantages"] = (r.get("bullets") or [])[:REASON_LIMIT]
            continue
        r["rank_advantages"] = _short_supporter_reasons(r, supp_peers)


def build_tag_ecosystem(unit_rows: list, char_rows: list, supp_rows: list) -> list:
    by_tag = defaultdict(lambda: {"units": [], "chars": [], "supporters": []})
    for r in unit_rows:
        for tn in r.get("coverage", {}).get("tag_names", []):
            by_tag[tn]["units"].append({"id": r["id"], "name": r["name"], "score": r["score"]})
    for r in char_rows:
        for tn in r.get("tag_names", []):
            by_tag[tn]["chars"].append({"id": r["id"], "name": r["name"], "score": r["score"]})
        for b in (r.get("special", {}) or {}).get("squad_buffs", []):
            for tn in b.get("condition_tags", []):
                by_tag[tn]["chars"].append({"id": r["id"], "name": r["name"], "note": "squad buffer"})
    for r in supp_rows:
        for tn in r.get("leader_profile", {}).get("tag_names", []):
            by_tag[tn]["supporters"].append({
                "id": r["id"], "name": r["name"], "leader_pct": r["leader_profile"]["max_leader_pct"],
            })
    out = []
    for tag, data in by_tag.items():
        data["units"].sort(key=lambda x: -x["score"])
        data["chars"].sort(key=lambda x: -x.get("score", 0))
        data["supporters"].sort(key=lambda x: -x["leader_pct"])
        out.append({
            "tag": tag,
            "unit_count": len(data["units"]),
            "top_units": data["units"][:5],
            "squad_buffers": data["chars"][:5],
            "supporters": data["supporters"][:4],
        })
    out.sort(key=lambda x: (-x["unit_count"], x["tag"]))
    return out[:40]


def build_banner_snapshots(unit_by_id: dict) -> list:
    """Recent gacha banners with pickup tier hints."""
    lp = A.LANG_PATHS.get(LC) or A.LANG_PATHS.get(A.DEFAULT_LANG)
    base, lang_dir = lp.get("base"), lp.get("lang")
    if not base:
        return []
    def _mf(name):
        p = os.path.join(base, name)
        return p if os.path.isfile(p) else os.path.join(ROOT, "data", LC, "master", name)

    gasha_lang = A.load_json(os.path.join(lang_dir, "m_gasha.json")) if lang_dir else None
    gasha_name_map = A.create_lang_text_map(gasha_lang) if gasha_lang else {}
    m_gasha = A.load_json(_mf("m_gasha.json"))
    m_pickup = A.load_json(_mf("m_gasha_pickup.json"))
    m_content = A.load_json(_mf("m_gasha_content_detail.json"))
    content_by_id = {A.normalize_id(r.get("Id") or r.get("id")): r for r in A.extract_data_list(m_content) if isinstance(r, dict)}
    pickup_by = defaultdict(list)
    for row in A.extract_data_list(m_pickup):
        gid = A.normalize_id(row.get("GashaId") or row.get("gashaId"))
        if gid != "0":
            pickup_by[gid].append(row)
    banners = []
    for gx in A.extract_data_list(m_gasha):
        gid = A.normalize_id(gx.get("Id") or gx.get("id"))
        if gid == "0" or gx.get("IsShown") is False:
            continue
        nl = A.normalize_id(gx.get("NameLanguageId") or "0")
        name = gasha_name_map.get(nl, "") if nl != "0" else ""
        units = []
        for pu in pickup_by.get(gid, []):
            dcid = A.normalize_id(pu.get("GashaContentDetailId") or "0")
            cd = content_by_id.get(dcid)
            if not cd:
                continue
            rut = A.normalize_id(cd.get("RewardTargetId") or "0")
            if rut in A.unit_info_map:
                ur = unit_by_id.get(rut)
                units.append({
                    "id": rut,
                    "name": unit_name(rut),
                    "tier_meta": ur.get("tier_meta") if ur else None,
                    "score": ur.get("score") if ur else None,
                    "is_limited_time": is_limited_unit(rut),
                })
        if units:
            banners.append({"gasha_id": gid, "name": name or gid, "featured_units": units})
    return banners[:12]


def render_markdown(payload: dict) -> str:
    lines = [
        "# Tier ranking mockup (v2 — comprehensive)",
        "",
        "Offline only — **not** on the website. SSS → A tiers.",
        "",
        f"- ER stages: **{payload['method']['eternal_stages']}**",
        f"- Units (SSR+): **{payload['counts']['units']}**",
        f"- Characters (SSR+): **{payload['counts']['characters']}**",
        f"- Supporters (UR): **{payload['counts']['supporters']}**",
        "",
        "## Pull priority legend",
        "",
        "- **critical** / **high**: limited-time; may not return soon",
        "- Team building is supporter-driven (leader tags buff matching units)",
        "",
    ]
    for section, key in [
        ("Gacha UR (EX) units", "units_meta"),
        ("Characters (UR meta)", "characters_meta"),
        ("Supporters (UR meta)", "supporters_meta"),
    ]:
        lines.append(f"## {section}")
        lines.append("")
        for t in TIER_ORDER:
            for r in payload[key].get(t, [])[:8]:
                bl = "; ".join(r.get("bullets", [])[:2])
                lines.append(f"- **{t}** {r['name']} ({r['score']}) — {bl}")
            extra = len(payload[key].get(t, [])) - 8
            if extra > 0:
                lines.append(f"- … +{extra} more in JSON")
        lines.append("")

    lines.append("## Example: full team note (unit + pilots + supporter)")
    ex = payload.get("example_wing_zero")
    if ex:
        lines.append(f"### {ex['name']}")
        for p in ex.get("top_pilots", []):
            lines.append(f"- Pilot: **{p['name']}** (fit {p['fit_score']}) — {'; '.join(p.get('reasons', [])[:3])}")
        for s in ex.get("top_supporters", []):
            lines.append(f"- Supporter: **{s['name']}** — {s['leader_pct']}% on {', '.join(s.get('tags', [])[:3])}")
    lines.append("")
    lines.append("## Tag ecosystems (top tags)")
    for te in payload.get("tag_ecosystem", [])[:8]:
        lines.append(f"### {te['tag']} ({te['unit_count']} units)")
        if te.get("supporters"):
            s = te["supporters"][0]
            lines.append(f"- Key supporter: {s['name']} ({s['leader_pct']}%)")
        if te.get("squad_buffers"):
            lines.append(f"- Squad buffer pilot: {te['squad_buffers'][0]['name']}")
    lines.append("")
    lines.append("## Recent banners (pickup tier hints)")
    for b in payload.get("banners", [])[:5]:
        lines.append(f"### {b['name']}")
        for u in b.get("featured_units", [])[:4]:
            lines.append(f"- {u['name']}: meta **{u.get('tier_meta', '?')}** score {u.get('score', '?')}")
    return "\n".join(lines) + "\n"


def main():
    global _ML_BUFF_SETS
    print("Tier mockup v6 — gated meta tiers + multi-axis v1 (data/EN)...")
    _ML_BUFF_SETS = build_ml_buff_target_sets()
    print(f"  ML buff target sets: {len(_ML_BUFF_SETS)}")
    er = build_er_stage_weights()
    print(f"  ER stages: {len(er)}")

    uids = [u for u in A.unit_list_playable_ids if int(A.unit_info_map.get(u, {}).get("rarity", 0) or 0) >= 4]
    pop_u = {"atk": [], "hp": [], "def": [], "mob": [], "sim_peak": []}
    for uid in uids:
        info = A.unit_info_map.get(uid, {})
        ri = str(info.get("rarity", "1"))
        role = str(info.get("role", "1"))
        sm = unit_stat_mode_for_rarity(ri)
        block = A._unit_max_lb_stat_block(uid, info, A.unit_stat_map.get(uid, {}), LDC)
        s = A._unit_lb_row_to_api(block, sm, False) if block else {}
        pop_u["atk"].append(float(s.get("ATK", 0)))
        pop_u["hp"].append(float(s.get("HP", 0)))
        pop_u["def"].append(float(s.get("DEF", 0)))
        pop_u["mob"].append(float(s.get("MOB", 0)))
        if role == "1":
            pop_u["sim_peak"].append(float(estimate_attack_ex_damage(uid).get("effective_peak") or 0))

    _ensure_tag_char_index()
    ur_chars = [
        c for c in A.char_list_playable_ids
        if str((A.char_info_map.get(c) or {}).get("rarity")) == "5"
    ]
    print(f"  Pre-analyzing {len(ur_chars)} UR pilots (squad/affinity)...")
    for cid in ur_chars:
        char_analysis(cid, deep=True)

    print(f"  Scoring {len(uids)} units (with pilot/supporter pairing)...")
    unit_rows = []
    for i, uid in enumerate(uids):
        if i and i % 50 == 0:
            print(f"    units {i}/{len(uids)}")
        unit_rows.append(score_unit(uid, er, pop_u))
    finalize_unit_axes(unit_rows)
    assign_gated_meta_tiers(unit_rows, "is_tier_pool", lambda r: (r.get("role", "?"), r.get("rarity", "?")))
    apply_community_anchors(unit_rows, COMMUNITY_UNIT_META_FLOOR, COMMUNITY_UNIT_SCORE_BUMP)
    unit_rows.sort(key=lambda r: (-r["score"], r["name"]))
    unit_by_id = {r["id"]: r for r in unit_rows}
    quality_index = {r["id"]: float(r.get("score") or 0) for r in unit_rows if r.get("is_tier_pool")}

    cids = [c for c in A.char_list_playable_ids if int(A.char_info_map.get(c, {}).get("rarity", 0) or 0) >= 4]
    pop_c = {"primary": [], "defense": [], "reaction": []}
    for cid in cids:
        ri = str((A.char_info_map.get(cid) or {}).get("rarity", "1"))
        t, _ = char_totals_for_tier(cid, ri)
        pop_c["primary"].append(t.get("Ranged", 0) + t.get("Melee", 0) + t.get("Awaken", 0))
        pop_c["defense"].append(t.get("Defense", 0))
        pop_c["reaction"].append(t.get("Reaction", 0))
    print(f"  Scoring {len(cids)} characters...")
    char_rows = [score_character(cid, pop_c) for cid in cids]
    assign_gated_meta_tiers(char_rows, "is_tier_pool", lambda r: (r.get("role", "?"), r.get("rarity", "?")))
    apply_community_anchors(char_rows, COMMUNITY_CHAR_META_FLOOR, COMMUNITY_CHAR_SCORE_BUMP)
    char_rows.sort(key=lambda r: (-r["score"], r["name"]))

    sids = [s for s, info in A.supporter_info_map.items() if str(info.get("rarity")) == "5"]
    supp_rows = [score_supporter(sid, quality_index) for sid in sids]
    assign_gated_meta_tiers(supp_rows, "is_tier_pool", lambda r: ("Supporter", r.get("rarity", "UR")))
    supp_rows.sort(key=lambda r: (-r["score"], r["name"]))

    print("  Building comparative rank advantages...")
    enrich_rank_advantages(unit_rows, char_rows, supp_rows)

    tag_eco = build_tag_ecosystem(unit_rows, char_rows, supp_rows)
    banners = build_banner_snapshots(unit_by_id)

    ex_uid = "1219000150"
    example = unit_by_id.get(ex_uid)
    if example:
        example = dict(example)
        example["example_note"] = "Full ER team depends on UR supporter tags + bundled pilot squad buffs"

    by_um = defaultdict(list)
    by_cm = defaultdict(list)
    by_sm = defaultdict(list)
    for r in unit_rows:
        if r.get("is_tier_pool"):
            by_um[r["tier_meta"]].append(r)
    for r in char_rows:
        if r.get("is_tier_pool"):
            by_cm[r["tier_meta"]].append(r)
    for r in supp_rows:
        if r.get("is_tier_pool"):
            by_sm[r["tier_meta"]].append(r)

    payload = {
        "version": 6,
        "tier_bands": TIER_MIN_SCORE,
        "axes_v1": {
            "keys": list(AXIS_KEYS),
            "labels": {
                "stat": "Stat",
                "damage": "Damage",
                "ml_buff": "ML buff fit",
                "utility": "Utility",
            },
            "score_cap": DISPLAY_SCORE_CAP,
            "ml_buff_sets": len(_ML_BUFF_SETS or {}),
            "trait_type_source": "TraitType enum (game_enums.json)",
        },
        "meta_tier_pcts": META_TIER_PCTS,
        "sss_caps": SSS_CAP,
        "method": {
            "tiers": list(TIER_ORDER),
            "eternal_stages": len(er),
            "er_terrain_weights": ER_TERRAIN_STAGE_WEIGHTS,
            "includes": [
                "Multi-axis v1: stat, damage, ML buff fit, utility (TraitType-driven)",
                "Meta tier (v6): score percentiles within role/rarity + attack SSS gates",
                "UR Attack SSS needs top-3 sim, MAP-after-move, bundled crit, or limited + top-8 sim",
                "Permanent generalists (e.g. Atlas) cannot SSS on terrain/team breadth alone",
                "Why ranked here: 4-5 short bullets vs same pool — no meta merit jargon",
                "Data source: bundled data/EN master + lang",
            ],
            "limits": [
                "No SP-per-stage budgeting", "No battle sim", "No owned-roster personalization",
            ],
        },
        "counts": {"units": len(unit_rows), "characters": len(char_rows), "supporters": len(supp_rows)},
        "units_meta": dict(by_um),
        "characters_meta": dict(by_cm),
        "supporters_meta": dict(by_sm),
        "units_top30": unit_rows[:30],
        "characters_top30": char_rows[:30],
        "supporters_all": supp_rows,
        "tag_ecosystem": tag_eco,
        "banners": banners,
        "example_wing_zero": example,
        "spotlight_char_1110000202": next((r for r in char_rows if r["id"] == "1110000202"), None),
    }

    out_dir = ROOT / "scripts" / "output"
    pub_dir = ROOT / "data" / "published"
    out_dir.mkdir(parents=True, exist_ok=True)
    pub_dir.mkdir(parents=True, exist_ok=True)
    jpath = out_dir / "tier_mockup_v2.json"
    pub_jpath = pub_dir / "tier_mockup_v2.json"
    mpath = out_dir / "tier_mockup_v2.md"
    json_text = json.dumps(payload, ensure_ascii=False, indent=2)
    jpath.write_text(json_text, encoding="utf-8")
    pub_jpath.write_text(json_text, encoding="utf-8")
    mpath.write_text(render_markdown(payload), encoding="utf-8")
    print(f"Wrote {jpath}")
    print(f"Wrote {pub_jpath} (deploy snapshot)")
    print(f"Wrote {mpath}")
    print("Unit meta tiers:", {t: len(by_um[t]) for t in TIER_ORDER})
    if example:
        print(f"Example: {example['name']} meta {example['tier_meta']} pilots:", [p['name'] for p in example.get('top_pilots', [])])


if __name__ == "__main__":
    main()
