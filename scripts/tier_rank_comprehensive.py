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

import app as A  # noqa: E402

LC = "EN"
LD = A.LANG_DATA[LC]
LDC = LD

TIER_ORDER = ("SSS", "SS", "S", "A")
TIER_MIN_SCORE = {"SSS": 78, "SS": 70, "S": 62, "A": 0}
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
    "1200003950": "SSS",  # Burning Gundam — highest range-5 EX power among limited attackers
    "1330000750": "SSS",  # Destiny Gundam — 8000+ EX; AppMedia top limited attacker
    "1219000150": "SSS",  # Wing Zero — MAP after move (AppMedia S-tier)
    "1850001350": "SSS",  # Psycho Haro — peak EX weapon power
    "1430003450": "SS",   # Barbatos Lupus Rex — crit-focused (Shinn synergy)
}
COMMUNITY_CHAR_META_FLOOR = {
    "1330000103": "SSS",  # Shinn EX — Supercharged EX → guaranteed super crit; fits all units
}
COMMUNITY_UNIT_SCORE_BUMP = {
    "1200003950": 4.0,
    "1330000750": 3.0,
    "1850001350": 2.0,
}
COMMUNITY_CHAR_SCORE_BUMP = {
    "1330000103": 28.0,
}


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
            bumped = min(100.0, r["score"] + score_bump[rid])
            r["score"] = round(bumped, 1)
            r["tier"] = score_to_tier(bumped)
        floor = meta_floor.get(rid)
        if floor and tier_rank_index(r.get("tier_meta", "A")) > tier_rank_index(floor):
            r["tier_meta"] = floor
            r["community_anchor"] = True


def assign_meta_tiers(rows: list, key: str = "is_meta_pool") -> None:
    pool = [r for r in rows if r.get(key)]
    by_role = defaultdict(list)
    for r in pool:
        by_role[r.get("role", "All")].append(r)
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
        return min(100.0, score + LIMITED_SCORE_BONUS)
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


def terrain_score(uid: str) -> float:
    info = A.unit_info_map.get(uid, {})
    td = A.unit_ter_map.get(info.get("terrain_set", ""), {})
    if not td:
        return 50.0
    tiers = [int(td.get(k, 1) or 1) for k in TERRAIN_KEYS]
    good = sum(1 for t in tiers if t >= 2)
    bad = sum(1 for t in tiers if t <= 1)
    base = (sum(tiers) / len(tiers)) / 3.0 * 100
    if bad >= 4 and good <= 1:
        base *= 0.55
    return min(100, base)


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
                    if A._affinity_ability_name_matches_tags(bab.get("name") or "", tokens, "or"):
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
    bundle = bundled_pilot_id(uid)
    if bundle and cid == bundle:
        score += 35.0
        reasons.append("Gacha bundled pilot (comes with unit)")
    flags, totals = char_analysis(cid, deep=True)
    urole = str(A.unit_info_map.get(uid, {}).get("role", "1"))
    if flags["chance_step_x2"]:
        score += 6.0 if urole == "1" else 12.0
        reasons.append("Chance Step ×2")
    if urole == "1" and flags.get("guaranteed_crit"):
        score += 30.0
        reasons.append("Guaranteed Critical (Supercharged EX) — universal attack pilot")
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


def supporter_leader_profile(sid: str) -> dict:
    sid = A.normalize_id(sid)
    tag_ids = A.supporter_leader_tag_ids(sid, LD, LC)
    tag_names = tag_labels_from_ids(tag_ids)
    max_pct = 0
    desc_snip = ""
    for ls in A.supporter_leader_map.get(sid, []) or []:
        if ls.get("tier") != 3:
            continue
        desc = LD.get("supporter_leader_text_map", {}).get(ls.get("desc_lang_id", ""), "")
        max_pct = max(max_pct, A._leader_skill_pct_from_desc(desc))
        if desc and not desc_snip:
            desc_snip = desc[:120]
    match_units = 0
    for uid in A.unit_list_playable_ids:
        if A.supporter_leader_applies_to_unit(sid, uid, LD, LC):
            match_units += 1
    pool = max(1, len(A.unit_list_playable_ids))
    return {
        "tag_ids": tag_ids,
        "tag_names": tag_names,
        "max_leader_pct": max_pct,
        "desc_snippet": desc_snip,
        "matching_units": match_units,
        "matching_units_pct": round(100.0 * match_units / pool, 1),
    }


def score_supporter_for_unit(uid: str, sid: str) -> tuple[float, list[str]]:
    if not A.supporter_leader_applies_to_unit(sid, uid, LD, LC):
        return 0.0, []
    prof = supporter_leader_profile(sid)
    reasons = [f"Leader up to {prof['max_leader_pct']}% for tags: {', '.join(prof['tag_names'][:3])}"]
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
            "matching_units_pct": prof["matching_units_pct"],
            "is_limited_time": is_limited_supporter(sid),
        })
    ranked.sort(key=lambda x: (-x["fit_score"], x["name"]))
    return ranked[:limit]


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
    raw = A.unit_stat_map.get(uid, {})
    block = A._unit_max_lb_stat_block(uid, info, raw, LDC)
    ssp = A._unit_lb_row_to_api(block, "ssp", False) if block else {}
    cov = sortie_coverage(uid, er_stages)
    wpn = weapon_signals(uid, "ssp")
    abil = ability_blob_unit(uid)
    ter = terrain_score(uid)
    limited = is_limited_unit(uid)

    sortie_pts = min(30, cov["adj_pct"] * 0.30)
    ter_pts = min(8, ter * 0.08)
    atk = float(ssp.get("ATK", 0) or 0)
    hp = float(ssp.get("HP", 0) or 0)
    df = float(ssp.get("DEF", 0) or 0)
    mob = float(ssp.get("MOB", 0) or 0)
    move = float(ssp.get("MOV", 0) or 0)

    peak_pts = peak_damage_pts(wpn["max_power"], wpn["max_range"], role)
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
    if pilots:
        team_pts += min(10, pilots[0]["fit_score"] * 0.22)
        if role == "1" and pilots[0].get("guaranteed_crit"):
            crit_synergy_pts = 8.0
    if supporters:
        team_pts += min(8, supporters[0]["fit_score"] * 0.18)

    total = sortie_pts + ter_pts + stat_pts + wpn_pts + abil_pts + team_pts + crit_synergy_pts + (3 if acq == "1" else 1)
    total = apply_limited_bonus(min(100, total), limited)

    bullets = []
    if limited:
        bullets.append("Limited availability — prioritize while on banner")
    if wpn["map_after_move"]:
        bullets.append("MAP after moving (safe poke)")
    elif wpn["has_map"]:
        bullets.append("Has MAP weapon")
    if wpn["max_range"] >= 5:
        bullets.append(f"Reach {wpn['max_range']}")
    if role == "1" and wpn["max_power"] >= 7500:
        bullets.append(f"Peak EX power {wpn['max_power']} (top-tier burst DPS)")
    if pilots:
        bullets.append(f"Best pilot: {pilots[0]['name']}" + (" (bundled)" if pilots[0].get("is_bundled") else ""))
    if supporters:
        bullets.append(f"Best UR supporter: {supporters[0]['name']} ({supporters[0]['leader_pct']}% — {', '.join(supporters[0]['tags'][:2])})")
    if cov["adj_pct"] < 60:
        bullets.append(f"ER coverage ~{cov['adj_pct']:.0f}%")

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
        "coverage": cov, "weapons": wpn, "stats_ssp": ssp,
        "top_pilots": pilots, "top_supporters": supporters,
        "bundled_pilot_id": bundled_pilot_id(uid),
        "bullets": bullets[:8],
        "is_meta_pool": acq == "1" and str(uid).endswith("50") and ri == "5",
    }


def score_character(cid: str, pop: dict) -> dict:
    info = A.char_info_map.get(cid, {})
    role = str(info.get("role", "0"))
    ri = str(info.get("rarity", "1"))
    limited = is_limited_char(cid)
    deep = ri == "5" or is_limited_char(cid)
    flags, totals = char_analysis(cid, deep=deep)
    squad = flags["squad_buffs"]
    debuff = char_debuff_potential(cid)

    if role == "1":
        primary = totals.get("Ranged", 0) + totals.get("Melee", 0) + totals.get("Awaken", 0)
        stat_pts = percentile_rank(primary, pop["primary"]) * 0.35
    elif role == "3":
        stat_pts = percentile_rank(totals.get("Defense", 0), pop["defense"]) * 0.2 + min(15, debuff * 0.35)
    else:
        stat_pts = percentile_rank(totals.get("Defense", 0), pop["defense"]) * 0.25 + percentile_rank(totals.get("Reaction", 0), pop["reaction"]) * 0.1

    special_pts = 0.0
    if flags.get("guaranteed_crit") and role == "1":
        special_pts += 32
    elif flags.get("supercharged_ex") and role == "1":
        special_pts += 10
    if flags["chance_step_x2"]:
        special_pts += 9 if role == "1" else 14
    if flags["support_defense_x2"]:
        special_pts += 12
    if flags["support_attack_x2"]:
        special_pts += 12
    squad_pts = min(18, sum(b.get("atk_pct", 0) + b.get("def_pct", 0) * 0.5 for b in squad) * 0.4 + len(squad) * 2)
    aff_pts = min(8, len(flags["affinity_matches"]) * 4)

    total = stat_pts + special_pts + squad_pts + aff_pts
    total = apply_limited_bonus(min(100, total), limited)

    bullets = []
    if limited:
        bullets.append("Limited availability")
    if flags.get("guaranteed_crit"):
        bullets.append("Guaranteed Critical (Supercharged EX) — pairs with any attack unit")
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
        "stats": totals, "special": flags,
        "tag_names": tag_labels_from_ids(char_tag_ids(cid))[:10],
        "bullets": bullets[:8],
        "is_meta_pool": ri == "5",
    }


def score_supporter(sid: str) -> dict:
    info = A.supporter_info_map.get(sid, {})
    ri = str(info.get("rarity", "1"))
    limited = is_limited_supporter(sid)
    prof = supporter_leader_profile(sid)
    total = prof["max_leader_pct"] * 0.9 + prof["matching_units_pct"] * 0.15
    total = apply_limited_bonus(min(100, total), limited)
    bullets = [
        f"Buffs tags: {', '.join(prof['tag_names'][:4]) or '—'}",
        f"Up to {prof['max_leader_pct']}% leader skill",
        f"Applies to ~{prof['matching_units_pct']:.0f}% of units",
    ]
    if limited:
        bullets.insert(0, "Limited availability — UR gacha only")
    return {
        "id": sid, "name": supporter_name(sid), "rarity": A.RARITY_MAP.get(ri, "?"),
        "is_limited_time": limited, "pull_priority": "critical" if limited else "normal",
        "score": round(total, 1), "tier": score_to_tier(total), "tier_meta": "A",
        "leader_profile": prof, "bullets": bullets,
        "is_meta_pool": ri == "5", "role": "Supporter",
    }


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
    print("Tier mockup v2 — comprehensive scoring...")
    er = build_er_stage_weights()
    print(f"  ER stages: {len(er)}")

    uids = [u for u in A.unit_list_playable_ids if int(A.unit_info_map.get(u, {}).get("rarity", 0) or 0) >= 4]
    pop_u = {"atk": [], "hp": [], "def": [], "mob": []}
    for uid in uids:
        info = A.unit_info_map.get(uid, {})
        block = A._unit_max_lb_stat_block(uid, info, A.unit_stat_map.get(uid, {}), LDC)
        s = A._unit_lb_row_to_api(block, "ssp", False) if block else {}
        pop_u["atk"].append(float(s.get("ATK", 0)))
        pop_u["hp"].append(float(s.get("HP", 0)))
        pop_u["def"].append(float(s.get("DEF", 0)))
        pop_u["mob"].append(float(s.get("MOB", 0)))

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
    assign_meta_tiers(unit_rows, "is_meta_pool")
    apply_community_anchors(unit_rows, COMMUNITY_UNIT_META_FLOOR, COMMUNITY_UNIT_SCORE_BUMP)
    unit_rows.sort(key=lambda r: (-r["score"], r["name"]))
    unit_by_id = {r["id"]: r for r in unit_rows}

    cids = [c for c in A.char_list_playable_ids if int(A.char_info_map.get(c, {}).get("rarity", 0) or 0) >= 4]
    pop_c = {"primary": [], "defense": [], "reaction": []}
    for cid in cids:
        _, t = char_analysis(cid, deep=False)
        pop_c["primary"].append(t.get("Ranged", 0) + t.get("Melee", 0) + t.get("Awaken", 0))
        pop_c["defense"].append(t.get("Defense", 0))
        pop_c["reaction"].append(t.get("Reaction", 0))
    print(f"  Scoring {len(cids)} characters...")
    char_rows = [score_character(cid, pop_c) for cid in cids]
    assign_meta_tiers(char_rows, "is_meta_pool")
    apply_community_anchors(char_rows, COMMUNITY_CHAR_META_FLOOR, COMMUNITY_CHAR_SCORE_BUMP)
    char_rows.sort(key=lambda r: (-r["score"], r["name"]))

    sids = [s for s, info in A.supporter_info_map.items() if str(info.get("rarity")) == "5"]
    supp_rows = [score_supporter(sid) for sid in sids]
    assign_meta_tiers(supp_rows, "is_meta_pool")
    supp_rows.sort(key=lambda r: (-r["score"], r["name"]))

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
        if r.get("is_meta_pool"):
            by_um[r["tier_meta"]].append(r)
    for r in char_rows:
        if r.get("is_meta_pool"):
            by_cm[r["tier_meta"]].append(r)
    for r in supp_rows:
        if r.get("is_meta_pool"):
            by_sm[r["tier_meta"]].append(r)

    payload = {
        "version": 2,
        "tier_bands": TIER_MIN_SCORE,
        "method": {
            "tiers": list(TIER_ORDER),
            "eternal_stages": len(er),
            "includes": [
                "Units: SSP LB3, weapons, ER sortie, top 3 pilots, top 3 UR supporters",
                "Characters: dossier stats, Guaranteed Critical / Supercharged EX, Chance Step x2, Support Atk/Def x2, squad tag buffs",
                "Attack DPS: peak EX weapon power weighted above Chance Step",
                "Supporters: leader tag % and unit coverage",
                "Limited-time bonus on units/characters/supporters",
                "Tag ecosystem index and banner pickup hints",
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
