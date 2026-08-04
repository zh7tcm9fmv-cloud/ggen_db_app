"""
SP/SSP investment point scorer (eternalsp-inspired suggestion guide).

Pure scoring lives in score_features(); feature extraction uses app helpers.
"""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
RULES_PATH = ROOT / "data" / "sp_investment" / "sp_investment_rules_v2.json"

ROLE_BY_ID = {"1": "Attack", "2": "Defense", "3": "Support"}
TERRAIN_KEYS = ("Space", "Atmospheric", "Ground", "Sea", "Underwater")
HEURISTIC_KEYS = frozenset({"abilities", "linked_pilot", "extra_life", "rare_debuff", "tags_weight"})


@lru_cache(maxsize=1)
def load_rules() -> dict:
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def clear_rules_cache() -> None:
    load_rules.cache_clear()


def band_points(bands: list, value: float | int) -> int:
    """First band where value < max_exclusive, else last (max_exclusive null)."""
    v = float(value or 0)
    for b in bands or []:
        mx = b.get("max_exclusive")
        if mx is None or v < float(mx):
            return int(b.get("points", 0) or 0)
    return 0


def tag_count_points(rules: dict, n: int) -> int:
    n = int(n or 0)
    for row in rules.get("tag_points") or []:
        if int(row["min"]) <= n <= int(row["max"]):
            return int(row["points"])
    return 0


def role_points(value, role: str, default: int = 0) -> int:
    """Resolve a flat int or per-role dict to points."""
    if isinstance(value, dict):
        if role in value:
            return int(value[role])
        if "default" in value:
            return int(value["default"])
        return int(default)
    if value is None:
        return int(default)
    return int(value)


def filter_scored_unit_tags(rules: dict, tag_names: list[str] | None) -> list[str]:
    """Drop series/flavor/color tags that inflate raw tag-count bands."""
    excl = {str(x).strip().lower() for x in (rules.get("tag_count_exclude_names") or []) if str(x).strip()}
    suffixes = [str(x) for x in (rules.get("tag_count_exclude_suffixes") or []) if str(x)]
    out: list[str] = []
    seen = set()
    for raw in tag_names or []:
        name = str(raw or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in excl:
            continue
        if any(name.endswith(sfx) or key.endswith(sfx.lower()) for sfx in suffixes):
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(name)
    return out


def rarity_adjustment_points(rules: dict, rarity_id: str | int | None) -> int:
    tbl = rules.get("rarity_adjustment") or {}
    return int(tbl.get(str(rarity_id if rarity_id is not None else ""), 0) or 0)


def lookup_role_table(table: dict, role: str, key: str, default: int = 0) -> int:
    role_map = (table or {}).get(role) or {}
    if key in role_map:
        return int(role_map[key])
    # clamp movement / range to nearest known key
    try:
        ik = int(key)
    except (TypeError, ValueError):
        return int(default)
    keys = sorted(int(k) for k in role_map.keys() if str(k).isdigit())
    if not keys:
        return int(default)
    if ik <= keys[0]:
        return int(role_map[str(keys[0])])
    if ik >= keys[-1]:
        return int(role_map[str(keys[-1])])
    return int(role_map.get(str(ik), default))


def letter_for_total(rules: dict, total: int) -> str:
    for row in rules.get("letter_cutoffs") or []:
        if total >= int(row["min"]):
            return str(row["letter"])
    return "E"


def tag_weight_points(rules: dict, tag_names: list[str] | None) -> tuple[int, dict]:
    """Curated high-value tag bonus on top of tag-count bands. Cap from rules."""
    cfg = rules.get("tag_weight") or {}
    allow = {str(x).strip().lower() for x in (cfg.get("high_value_names") or []) if str(x).strip()}
    if not allow:
        return 0, {"matches": [], "heuristic": True}
    matches = []
    seen = set()
    for raw in tag_names or []:
        name = str(raw or "").strip()
        key = name.lower()
        if key in allow and key not in seen:
            seen.add(key)
            matches.append(name)
    per = int(cfg.get("bonus_per_match", 1) or 1)
    cap = int(cfg.get("cap", 2) or 2)
    pts = min(cap, per * len(matches))
    return pts, {"matches": matches, "heuristic": True}


def detect_weapon_bonus_type(rules: dict, trait_lines: list[str]) -> tuple[int, int]:
    """
    Return (bonus_type_id, points) for the highest-scoring typed bonus on the
    given trait lines. Type 3 (Low HP) scores 0; other matches beat it.
    """
    cfg = rules.get("maxweapon_bonus") or {}
    pts_map = cfg.get("points_by_type") or {}
    detect = cfg.get("detect") or {}
    best_type = 0
    best_pts = -1
    for type_id in sorted(detect.keys(), key=lambda x: int(x)):
        tid = int(type_id)
        compiled = [re.compile(p) for p in (detect.get(str(type_id)) or detect.get(type_id) or [])]
        hit = False
        for line in trait_lines or []:
            text = str(line or "")
            if any(p.search(text) for p in compiled):
                hit = True
                break
        if not hit:
            continue
        pts = int(pts_map.get(str(tid), 0) or 0)
        if pts > best_pts:
            best_type = tid
            best_pts = pts
    if best_pts < 0:
        return 0, 0
    return best_type, best_pts


def bucket_for_letter(rules: dict, letter: str) -> str:
    return str((rules.get("bucket_by_letter") or {}).get(letter, "dont"))


def debuff_pct_to_level(rules: dict, pct: int) -> int | None:
    level = None
    for row in rules.get("debuff_pct_to_level") or []:
        if int(pct or 0) >= int(row.get("min_pct", 0) or 0):
            level = row.get("level")
    return None if level is None else int(level)


_PURE_STAT_PASSIVE_NAME = re.compile(
    r"(?i)^\s*(?:\([^)]*\)\s*)?(?:increased?|increase)\s+"
    r"(?:attack|atk|defense|def|hp|en|mobility|mob)\b"
)
_COMBAT_ABILITY_HINT = re.compile(
    r"(?i)\b(?:affinity|chance\s*step|damage|debuff|critical|evasion|shield|map|"
    r"support\s+attack|support\s+defense|reduce|reduces|heal|recover|mp\b|en\s+cost)\b"
)


def _is_pure_stat_passive(blob: str) -> bool:
    """Permanent ATK/DEF/HP/MOB % passives already inflate SP/SSP totals — don't double-count."""
    text = str(blob or "").strip()
    if not text:
        return False
    if _COMBAT_ABILITY_HINT.search(text):
        return False
    name = text.split("\n", 1)[0].strip()
    return bool(_PURE_STAT_PASSIVE_NAME.search(name))


def score_abilities(rules: dict, role: str, ability_blobs: list[str]) -> tuple[int, dict]:
    """Return (points, meta). Heuristic — effect families first, then great_for_role regex."""
    abil_cfg = rules.get("ability") or {}
    excl = [str(x).lower() for x in (abil_cfg.get("exclude_name_substrings") or [])]
    ignore_stat = bool(abil_cfg.get("ignore_pure_stat_passives", False))
    family_pats = [
        re.compile(p) for p in ((abil_cfg.get("effect_families") or {}).get(role) or [])
    ]
    great_pats = [
        re.compile(p) for p in ((abil_cfg.get("great_for_role") or {}).get(role) or [])
    ]
    kept: list[str] = []
    skipped_stat = 0
    for blob in ability_blobs or []:
        text = str(blob or "")
        low = text.lower()
        if any(x and x in low for x in excl):
            continue
        if ignore_stat and _is_pure_stat_passive(text):
            skipped_stat += 1
            continue
        if text.strip():
            kept.append(text)
    if not kept:
        return 0, {"count": 0, "great": 0, "skipped_stat": skipped_stat, "heuristic": True}
    great = 0
    for text in kept:
        if any(p.search(text) for p in family_pats) or any(p.search(text) for p in great_pats):
            great += 1
    if great >= 2:
        pts = int(abil_cfg.get("two_great_for_role_points", 3))
    elif great == 1:
        pts = int(abil_cfg.get("one_great_for_role_points", 2))
    else:
        pts = int(abil_cfg.get("has_passive_points", 1))
    return pts, {"count": len(kept), "great": great, "skipped_stat": skipped_stat, "heuristic": True}


def score_linked_pilot(rules: dict, has_linked: bool, linked_very_good: bool) -> tuple[int, dict]:
    cfg = rules.get("linked_pilot") or {}
    if not has_linked:
        return int(cfg.get("none_points", 0)), {"heuristic": True, "status": "none"}
    if linked_very_good:
        return int(cfg.get("very_good_points", 1)), {"heuristic": True, "status": "very_good"}
    return int(cfg.get("any_points", -1)), {"heuristic": True, "status": "any"}


def score_features(features: dict, rules: dict | None = None, mode: str = "sp") -> dict:
    """
    Score a unit from a normalized feature dict.

    Required keys: role, tag_count, terrain (dict of levels), has_transform,
    map_ammo, ability_blobs, has_linked_pilot, linked_pilot_very_good,
    has_shield, HP, ATK, DEF, MOB, MOV, weapon_range, weapon_power,
    has_max_tension_higher_weapon, has_preemptive, has_rare_debuff,
    has_extra_life, max_debuff_pct, support_debuffs_range4_count,
    weapon_bonus_type (typed maxweapon_bonus; SP and SSP).
    Optional: tags (names) for high-value tag weight bonus.
    """
    rules = rules or load_rules()
    role = features.get("role") or "Attack"
    if role not in ("Attack", "Defense", "Support"):
        role = "Attack"
    breakdown: dict[str, Any] = {}
    meta: dict[str, Any] = {"heuristic_keys": []}

    # A1 tags (meaningful-count bands + curated weight bonus)
    scored_tags = features.get("scored_tags")
    if scored_tags is None:
        scored_tags = filter_scored_unit_tags(rules, features.get("tags") or [])
    tag_n = int(features.get("tag_count_scored") if features.get("tag_count_scored") is not None else len(scored_tags))
    tags_pts = tag_count_points(rules, tag_n)
    breakdown["tags"] = tags_pts
    tw_pts, tw_meta = tag_weight_points(rules, features.get("tags") or [])
    breakdown["tags_weight"] = tw_pts
    if tw_pts:
        meta["tags_weight"] = tw_meta
        meta["heuristic_keys"].append("tags_weight")
    meta["scored_tag_count"] = tag_n

    # A2 / A3 terrain + content coverage (limited ship / theater options proxy)
    terr_cfg = rules.get("terrain") or {}
    terrain = features.get("terrain") or {}
    deploy_min = int(terr_cfg.get("deploy_min_level", 2))
    perfect_min = int(terr_cfg.get("perfect_min_level", 3))
    space = int(terrain.get("Space", 1) or 1)
    ground = int(terrain.get("Ground", 1) or 1)
    air = int(terrain.get("Atmospheric", 1) or 1)
    water = int(terrain.get("Underwater", 1) or 1)
    has_dual = space >= deploy_min and ground >= deploy_min
    dual = role_points(terr_cfg.get("dual_space_ground_deploy_points", 2), role, 2) if has_dual else 0
    breakdown["terrain_dual"] = dual
    triple = 0
    if space >= deploy_min and air >= deploy_min and ground >= deploy_min:
        triple = role_points(terr_cfg.get("triple_space_air_ground_deploy_points", 0), role, 0)
    breakdown["terrain_triple"] = triple
    niche = 0
    # Niche only when not already triple-covered (avoid stacking Space+Air perfect with triple)
    if triple <= 0:
        if space >= perfect_min and air >= perfect_min:
            niche = role_points(terr_cfg.get("perfect_space_and_atmospheric_points", 1), role, 1)
        elif water >= perfect_min:
            niche = role_points(terr_cfg.get("else_perfect_underwater_points", 1), role, 1)
    breakdown["terrain_niche"] = niche
    gap = 0
    if not has_dual:
        min_mov = int(terr_cfg.get("high_mobility_min_mov", 5))
        min_rng = int(terr_cfg.get("high_mobility_min_range", 5))
        mov = int(features.get("MOV") or 0)
        wr = int(features.get("weapon_range") or 0)
        if mov >= min_mov or wr >= min_rng:
            gap = role_points(terr_cfg.get("high_mobility_no_dual_penalty", 0), role, 0)
    breakdown["terrain_gap"] = gap

    # A4 transform
    breakdown["transform"] = int(rules.get("transform_points", 1)) if features.get("has_transform") else 0

    # A5 MAP ammo only (no flat mapweapon stack)
    map_ammo = int(features.get("map_ammo") or 0)
    ammo_key = str(min(max(map_ammo, 0), 4))
    map_tbl = rules.get("map_ammo_points") or {}
    if ammo_key in map_tbl:
        map_pts = int(map_tbl.get(ammo_key, 0))
    elif map_ammo >= 2:
        map_pts = int(map_tbl.get("2_or_more", 2))
    elif map_ammo == 1:
        map_pts = int(map_tbl.get("1", 1))
    else:
        map_pts = 0
    breakdown["map"] = map_pts

    # A6 abilities
    abil_pts, abil_meta = score_abilities(rules, role, features.get("ability_blobs") or [])
    breakdown["abilities"] = abil_pts
    meta["abilities"] = abil_meta
    meta["heuristic_keys"].append("abilities")

    # A7 linked pilot
    lp_pts, lp_meta = score_linked_pilot(
        rules,
        bool(features.get("has_linked_pilot")),
        bool(features.get("linked_pilot_very_good")),
    )
    breakdown["linked_pilot"] = lp_pts
    meta["linked_pilot"] = lp_meta
    meta["heuristic_keys"].append("linked_pilot")

    # A8 max tension higher weapon
    breakdown["max_tension_weapon"] = (
        int(rules.get("max_tension_higher_tier_weapon_points", 1))
        if features.get("has_max_tension_higher_weapon")
        else 0
    )

    # A9 preemptive
    breakdown["preemptive"] = (
        int(rules.get("preemptive_strike_points", 1)) if features.get("has_preemptive") else 0
    )

    # A10 rare debuff
    rare_pts = int(rules.get("rare_debuff_points", 1)) if features.get("has_rare_debuff") else 0
    breakdown["rare_debuff"] = rare_pts
    if rare_pts:
        meta["heuristic_keys"].append("rare_debuff")

    # A11 extra life
    el_pts = 0
    if features.get("has_extra_life"):
        el_pts = int((rules.get("extra_life") or {}).get(role, 1))
        meta["heuristic_keys"].append("extra_life")
    breakdown["extra_life"] = el_pts

    # A12 support long-range debuffs
    if role == "Support":
        n = int(features.get("support_debuffs_range4_count") or 0)
        tbl = rules.get("support_debuffs_at_range_4") or {}
        if n >= 2:
            breakdown["support_r4_debuffs"] = int(tbl.get("2_or_more", 1))
        else:
            breakdown["support_r4_debuffs"] = int(tbl.get(str(n), 0 if n == 1 else -1))
    else:
        breakdown["support_r4_debuffs"] = 0

    # B stats
    for key, feat_key in (("HP", "HP"), ("ATK", "ATK"), ("DEF", "DEF"), ("MOB", "MOB")):
        bands = ((rules.get("stat_bands") or {}).get(key) or {}).get(role) or []
        breakdown[key.lower()] = band_points(bands, features.get(feat_key) or 0)

    # Shield
    sh = (rules.get("shield") or {}).get(role) or {}
    breakdown["shield"] = int(sh.get("has", 0) if features.get("has_shield") else sh.get("missing", 0))

    # Movement
    mov = int(features.get("MOV") or 0)
    mov_key = str(max(3, min(6, mov))) if mov else "3"
    if mov < 3:
        mov_key = "3"
    breakdown["movement"] = lookup_role_table(rules.get("movement") or {}, role, mov_key, 0)

    # Weapon range / power
    wr = int(features.get("weapon_range") or 0)
    wr_key = str(max(1, min(6, wr))) if wr else "1"
    breakdown["weapon_range"] = lookup_role_table(rules.get("weapon_range") or {}, role, wr_key, 0)
    power_bands = ((rules.get("weapon_power") or {}).get(role) or [])
    breakdown["weapon_power"] = band_points(power_bands, features.get("weapon_power") or 0)

    # Max debuff level (Def/Sup only)
    if role in ("Defense", "Support"):
        lvl = debuff_pct_to_level(rules, int(features.get("max_debuff_pct") or 0))
        tbl = (rules.get("max_debuff_level") or {}).get(role) or {}
        if lvl is None:
            breakdown["max_debuff"] = int(tbl.get("none", tbl.get("0", 0)))
        else:
            breakdown["max_debuff"] = int(tbl.get(str(lvl), 0))
    else:
        breakdown["max_debuff"] = 0

    # C typed weapon bonus (SP and SSP) — replaces coarse SSP-only conditional
    bonus_type = int(features.get("weapon_bonus_type") or 0)
    bonus_pts = int(features.get("weapon_bonus_points") or 0)
    if not bonus_type and features.get("best_weapon_trait_lines"):
        bonus_type, bonus_pts = detect_weapon_bonus_type(rules, features.get("best_weapon_trait_lines") or [])
    elif bonus_type and not features.get("weapon_bonus_points"):
        pts_map = ((rules.get("maxweapon_bonus") or {}).get("points_by_type") or {})
        bonus_pts = int(pts_map.get(str(bonus_type), 0) or 0)
    # Legacy fallback: ssp_weapon_conditional_count treated as High-HP-style +1 each (capped 1)
    if not bonus_type and mode == "ssp" and int(features.get("ssp_weapon_conditional_count") or 0) > 0:
        bonus_type = 2
        bonus_pts = int(((rules.get("maxweapon_bonus") or {}).get("points_by_type") or {}).get("2", 1))
    breakdown["weapon_bonus"] = bonus_pts
    if bonus_type:
        labels = ((rules.get("maxweapon_bonus") or {}).get("type_labels") or {})
        meta["weapon_bonus"] = {"type": bonus_type, "label": labels.get(str(bonus_type), str(bonus_type))}

    # Rarity: N/R/SR must earn more raw points to match SSR letters
    rarity_pts = rarity_adjustment_points(rules, features.get("rarity_id"))
    breakdown["rarity"] = rarity_pts
    if rarity_pts:
        meta["heuristic_keys"].append("rarity")

    total = int(sum(int(v) for v in breakdown.values()))
    letter = letter_for_total(rules, total)
    bucket = bucket_for_letter(rules, letter)
    return {
        "total": total,
        "letter": letter,
        "bucket": bucket,
        "breakdown": breakdown,
        "meta": meta,
        "mode": mode,
        "role": role,
    }


def _ability_blobs_for_unit(A, uid: str, lc: str, ld: dict, mode: str) -> list[str]:
    blobs: list[str] = []
    ldc = A.LANG_DATA.get(lc) or ld
    for ab in A.unit_abil_map.get(uid, []) or []:
        try:
            entry = A.build_ability_entry(
                str(ab.get("id")),
                ldc.get("abil_name_map", {}),
                A.abil_link_map,
                A.trait_set_traits_map,
                A.trait_data_map,
                ldc.get("lang_text_map", {}),
                ldc.get("lang_text_map", {}),
                A.trait_condition_raw_map,
                ldc.get("lineage_lookup", {}),
                ldc.get("series_name_map", {}),
                A.ability_resource_map,
                ldc.get("abil_desc_map", {}),
                sort_order=ab.get("sort", 0),
                lang_code=lc,
            )
        except Exception:
            continue
        if not entry:
            continue
        if mode != "ssp" and entry.get("ssp_only"):
            continue
        name = str(entry.get("name") or "")
        parts = [name]
        for d in entry.get("details") or []:
            if isinstance(d, dict) and d.get("text"):
                parts.append(str(d["text"]))
            elif isinstance(d, str):
                parts.append(d)
        blobs.append("\n".join(parts))
    if mode == "ssp":
        for abid in A.unit_ssp_abil_gain_list.get(uid, []) or []:
            try:
                entry = A.build_ability_entry(
                    str(abid),
                    ldc.get("abil_name_map", {}),
                    A.abil_link_map,
                    A.trait_set_traits_map,
                    A.trait_data_map,
                    ldc.get("lang_text_map", {}),
                    ldc.get("lang_text_map", {}),
                    A.trait_condition_raw_map,
                    ldc.get("lineage_lookup", {}),
                    ldc.get("series_name_map", {}),
                    A.ability_resource_map,
                    ldc.get("abil_desc_map", {}),
                    lang_code=lc,
                )
            except Exception:
                continue
            if not entry:
                continue
            name = str(entry.get("name") or "")
            parts = [name]
            for d in entry.get("details") or []:
                if isinstance(d, dict) and d.get("text"):
                    parts.append(str(d["text"]))
            blobs.append("\n".join(parts))
    return blobs


def _effective_terrain(A, uid: str, info: dict, mode: str) -> dict:
    base = A.unit_ter_map.get(info.get("terrain_set", ""), {}) or {}
    out = {k: int(base.get(k, 1) or 1) for k in TERRAIN_KEYS}
    if mode == "ssp":
        try:
            ssp_base = A._ssp_base_terrain_levels(info)
            for k in TERRAIN_KEYS:
                out[k] = max(out.get(k, 1), int(ssp_base.get(k, 1) or 1))
        except Exception:
            pass
        try:
            core = A.get_ssp_custom_core_bonuses_for_unit(uid)
            for tn, _fr, to in core.get("terrain_upgrades", []) or []:
                out[tn] = max(out.get(tn, 1), int(to))
        except Exception:
            pass
    return out


def _weapon_features(A, uid: str, ld: dict, lc: str, mode: str, rules: dict) -> dict:
    max_range = 0
    max_power = 0
    max_power_unrestricted = 0
    max_power_tension = 0
    map_ammo = 0
    has_preemptive = False
    has_rare = False
    max_debuff_pct = 0
    support_debuff_kinds: set[str] = set()
    rare_keys = set(rules.get("rare_debuff_keys") or [])
    best_weapon_trait_lines: list[str] = []

    try:
        debuff_keys = A.collect_unit_weapon_debuff_keys(uid, ld, lc, stat_mode=mode) or set()
    except Exception:
        debuff_keys = set()
    if debuff_keys & rare_keys:
        has_rare = True
    if "preemptive" in debuff_keys:
        has_preemptive = True

    for wp in A.unit_weapon_map.get(uid, []) or []:
        wid = A.normalize_id(wp.get("id"))
        wm = A.weapon_info_map.get(wid, {})
        wt = str(wm.get("weapon_type", "1") or "1")
        try:
            ws = A.resolve_weapon_stats(
                wm,
                A.weapon_status_map,
                A.weapon_correction_map,
                ld.get("weapon_trait_map", {}),
                ld.get("weapon_capability_map", {}),
                A.growth_pattern_map,
                A.weapon_trait_change_map,
                ld.get("weapon_trait_detail_map", {}),
                wid=wid,
                lang_code=lc,
                unit_id=uid,
            )
        except Exception:
            continue
        rx = int(ws.get("range_max", 0) or 0)
        if mode == "ssp":
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
        if mode == "ssp":
            mwid = A.normalize_id(wm.get("main_weapon_id", "0") or "0")
            for cid in (wid, mwid):
                for enh in A.unit_ssp_weapon_enhance_map.get(cid) or []:
                    if str(enh.get("type")) == "1":
                        power += int(enh.get("value", 0) or 0)
                break
        tension_max = str(wm.get("tension_type", "0") or "0") == "4"
        trait_lines: list[str] = []
        for tr in ws.get("traits", []) or []:
            if tr:
                trait_lines.append(str(tr))
        if isinstance(levels, dict):
            for lv in levels.values():
                if isinstance(lv, dict):
                    for tr in lv.get("traits", []) or []:
                        if tr:
                            trait_lines.append(str(tr))
        if mode == "ssp":
            mwid = A.normalize_id(wm.get("main_weapon_id", "0") or "0")
            for cid in (wid, mwid):
                if cid and cid != "0" and cid in getattr(A, "unit_ssp_weapon_effect_map", {}):
                    for tid in A.unit_ssp_weapon_effect_map.get(cid) or []:
                        tt2 = (ld.get("weapon_trait_detail_map", {}) or {}).get(tid, "")
                        if tt2:
                            trait_lines.append(str(tt2))
                    break

        if wt == "3":
            ammo = int(ws.get("ammo", 0) or wm.get("ammo", 0) or 0)
            if mode == "ssp":
                mwid = A.normalize_id(wm.get("main_weapon_id", "0") or "0")
                for cid in (wid, mwid):
                    for enh in A.unit_ssp_weapon_enhance_map.get(cid) or []:
                        if str(enh.get("type")) == "3":
                            ammo += int(enh.get("value", 0) or 0)
                    break
            map_ammo = max(map_ammo, ammo)
        else:
            max_range = max(max_range, rx)
            if power > max_power:
                max_power = power
                best_weapon_trait_lines = list(trait_lines)
            if tension_max:
                max_power_tension = max(max_power_tension, power)
            else:
                max_power_unrestricted = max(max_power_unrestricted, power)
            if rx >= 4:
                for key in ("def_dn", "atk_dn", "mob_dn", "acc_dn", "range_beam", "range_phys"):
                    if key in debuff_keys:
                        support_debuff_kinds.add(key)

    # MAP ammo fallback from browse previews
    if max_power <= 0:
        try:
            for prev in A.build_unit_browse_map_weapon_previews(uid, stat_mode=mode, ld=ld, lc=lc) or []:
                map_ammo = max(map_ammo, int(prev.get("ammo") or 0))
        except Exception:
            pass

    for line in A.iter_unit_weapon_trait_texts(uid, ld, lc, stat_mode=mode) or []:
        try:
            b, v = A.parse_enemy_def_debuff_pcts_from_trait_text(line)
            max_debuff_pct = max(max_debuff_pct, int(b or 0), int(v or 0))
        except Exception:
            pass

    has_max_tension_higher = max_power_tension > max_power_unrestricted > 0
    bonus_type, bonus_pts = detect_weapon_bonus_type(rules, best_weapon_trait_lines)

    return {
        "weapon_range": max_range,
        "weapon_power": max_power,
        "map_ammo": map_ammo,
        "has_preemptive": has_preemptive,
        "has_rare_debuff": has_rare,
        "has_max_tension_higher_weapon": has_max_tension_higher,
        "max_debuff_pct": max_debuff_pct,
        "support_debuffs_range4_count": len(support_debuff_kinds),
        "weapon_bonus_type": bonus_type,
        "weapon_bonus_points": bonus_pts,
        "best_weapon_trait_lines": best_weapon_trait_lines[:12],
    }


def _linked_pilot_flags(A, uid: str, info: dict, rules: dict) -> tuple[bool, bool]:
    cid = A.resolve_unit_recommend_character_id(uid, info)
    if not cid:
        return False, False
    cinfo = A.char_info_map.get(cid, {}) or {}
    ri = int(cinfo.get("rarity", 1) or 1)
    min_ri = int((rules.get("linked_pilot") or {}).get("very_good_min_rarity_index", 4))
    # role-aligned specialty: char role matches unit role
    very = ri >= min_ri and str(cinfo.get("role", "0")) == str(info.get("role", "0"))
    return True, very


def _has_extra_life(rules: dict, uid: str, ability_blobs: list[str]) -> bool:
    cfg = rules.get("extra_life") or {}
    allow = set(str(x) for x in (cfg.get("unit_id_allowlist") or []))
    if uid in allow:
        return True
    pat = cfg.get("ability_regex")
    if not pat:
        return False
    rx = re.compile(pat)
    return any(rx.search(b or "") for b in ability_blobs)


def _source_bucket(A, info: dict) -> str:
    acq = str(info.get("acquisition_route", "0") or "0")
    role = str(info.get("role", "0") or "0")
    if A.entity_matches_source_category(acq, role, "assembly"):
        return "gacha"
    if A.entity_matches_source_category(acq, role, "development"):
        return "dev"
    return "event"


def extract_unit_features(A, uid: str, mode: str = "sp", lc: str = "EN", rules: dict | None = None) -> dict | None:
    """Build feature dict for one unit under sp|ssp. Returns None if not scoreable."""
    rules = rules or load_rules()
    info = A.unit_info_map.get(uid) or {}
    if not info:
        return None
    ri = int(info.get("rarity", 1) or 1)
    is_ult = bool(info.get("is_ultimate", False))
    has_sp = ri <= 4 and not is_ult
    is_warship = str(info.get("body_type") or "1") == "2"
    # Score UR/ULT for comparison boards too, using ssp/sp best-effort
    role_id = str(info.get("role", "0") or "0")
    role = ROLE_BY_ID.get(role_id, "Attack")
    ld = A.get_lang_data(lc) if hasattr(A, "get_lang_data") else A.LANG_DATA.get(lc, {})
    ldc = A.LANG_DATA.get(lc) or ld

    # Stats: prefer requested mode; UR uses ssp-like stats when available
    use_mode = mode
    if not has_sp and mode == "sp":
        use_mode = "ssp" if ri >= 5 else "normal"
    try:
        block = A._unit_max_lb_stat_block(uid, info, A.unit_stat_map.get(uid, {}), ldc)
        stats = A._unit_lb_row_to_api(block, use_mode if use_mode in ("sp", "ssp", "normal") else "sp", False) or {}
    except Exception:
        stats = {}

    # Transform override (Reborns allowlist)
    override_ids = set(str(x) for x in (rules.get("transform_stat_override_unit_ids") or []))
    partner = None
    try:
        partner = A.unit_transform_partner_map.get(uid)
    except Exception:
        partner = None
    has_transform = bool(partner) or bool(info.get("main_unit_id") and str(info.get("main_unit_id")) != str(uid))
    if uid in override_ids and partner:
        try:
            pinfo = A.unit_info_map.get(partner, {})
            pblock = A._unit_max_lb_stat_block(partner, pinfo, A.unit_stat_map.get(partner, {}), ldc)
            pstats = A._unit_lb_row_to_api(pblock, use_mode, False) or {}
            if pstats:
                stats = pstats
        except Exception:
            pass

    tags = []
    try:
        tags = A.resolve_tags(A.unit_lin_map, uid, lc, "unit") or []
    except Exception:
        tags = A.unit_lin_map.get(uid, []) or []
    tag_names = [t.get("name") if isinstance(t, dict) else str(t) for t in tags][:40]
    scored_tags = filter_scored_unit_tags(rules, tag_names)

    terrain = _effective_terrain(A, uid, info, use_mode if use_mode == "ssp" else "sp")
    ability_blobs = _ability_blobs_for_unit(A, uid, lc, ld, use_mode)
    has_linked, linked_vg = _linked_pilot_flags(A, uid, info, rules)
    has_shield = False
    try:
        has_shield = "1" in (A.collect_unit_mechanism_mids(info, uid) or set())
    except Exception:
        has_shield = False

    wfeat = _weapon_features(A, uid, ld, lc, use_mode if use_mode in ("sp", "ssp") else "sp", rules)
    has_extra = _has_extra_life(rules, uid, ability_blobs)

    rarity_letter = A.RARITY_MAP.get(str(ri), "Unknown") if hasattr(A, "RARITY_MAP") else str(ri)
    name = ""
    try:
        name = A._wn_unit_name(uid, ld) or ""
        if name.startswith("Unit "):
            name = A._wn_unit_name(uid, ldc) or name
    except Exception:
        name = ""
    if not name or name.startswith("Unit "):
        name = ""

    return {
        "id": uid,
        "name": name,
        "role": role,
        "role_id": role_id,
        "rarity": rarity_letter,
        "rarity_id": str(ri),
        "is_ultimate": is_ult,
        "is_warship": is_warship,
        "has_sp": has_sp,
        "source": _source_bucket(A, info),
        "tag_count": len(tag_names),
        "tag_count_scored": len(scored_tags),
        "scored_tags": scored_tags,
        "tags": tag_names,
        "terrain": terrain,
        "has_transform": has_transform,
        "ability_blobs": ability_blobs,
        "has_linked_pilot": has_linked,
        "linked_pilot_very_good": linked_vg,
        "has_shield": has_shield,
        "HP": int(stats.get("HP") or 0),
        "ATK": int(stats.get("ATK") or 0),
        "DEF": int(stats.get("DEF") or 0),
        "MOB": int(stats.get("MOB") or 0),
        "MOV": int(stats.get("MOV") or stats.get("Move") or 0),
        "has_extra_life": has_extra,
        "has_map": int(wfeat.get("map_ammo") or 0) > 0,
        **wfeat,
    }


def score_unit(A, uid: str, mode: str = "sp", lc: str = "EN", rules: dict | None = None) -> dict | None:
    rules = rules or load_rules()
    feats = extract_unit_features(A, uid, mode=mode, lc=lc, rules=rules)
    if not feats:
        return None
    if feats.get("is_warship") and rules.get("exclude_warships", True):
        return None
    scored = score_features(feats, rules=rules, mode=mode)
    row = {
        "id": feats["id"],
        "name": feats.get("name") or "",
        "role": feats["role"],
        "role_id": feats.get("role_id"),
        "rarity": feats.get("rarity"),
        "rarity_id": feats.get("rarity_id"),
        "is_ultimate": feats.get("is_ultimate"),
        "has_sp": feats.get("has_sp"),
        "source": feats.get("source"),
        "has_map": bool(feats.get("has_map")),
        "tags": feats.get("tags") or [],
        "total": scored["total"],
        "letter": scored["letter"],
        "bucket": scored["bucket"],
        "breakdown": scored["breakdown"],
        "meta": scored.get("meta") or {},
        "mode": mode,
        "stats": {
            "HP": feats.get("HP"),
            "ATK": feats.get("ATK"),
            "DEF": feats.get("DEF"),
            "MOB": feats.get("MOB"),
            "MOV": feats.get("MOV"),
        },
    }
    return row


def scoring_guide_payload(rules: dict | None = None) -> dict:
    rules = rules or load_rules()
    guide = dict(rules.get("scoring_guide") or {})
    guide["bucket_labels"] = rules.get("bucket_labels") or {}
    guide["letter_cutoffs"] = rules.get("letter_cutoffs") or []
    guide["version"] = rules.get("version", 1)
    guide["covers"] = ["units_sp", "units_ssp", "pilots_sp"]
    return guide


def pilot_tag_count_points(rules: dict, n: int) -> int:
    n = int(n or 0)
    for row in rules.get("pilot_tag_points") or []:
        if int(row["min"]) <= n <= int(row["max"]):
            return int(row["points"])
    return 0


_PILOT_STAT_BOOST_NAME = re.compile(
    r"(?i)^\s*(?:increased|increase)\s+(?:ranged|melee|awaken|defense|reaction)\b"
)
_PILOT_GREAT_UTILITY = re.compile(
    r"(?i)chance\s*step|\bsway\b|evasion\s+by\s+100|support\s+attack|support\s+defense|"
    r"援護攻撃|援護防御|ステップ|スウェイ"
)
_LETTER_ORDER = ("E", "D", "C", "B", "B+", "A", "A+", "S", "S+")


def pilot_specialty(features: dict) -> str:
    """Highest of Ranged / Melee / Awaken (ties prefer Ranged → Melee → Awaken)."""
    best = "Ranged"
    best_v = -1
    for key in ("Ranged", "Melee", "Awaken"):
        v = int(features.get(key) or 0)
        if v > best_v:
            best_v = v
            best = key
    return best


def score_pilot_skills(rules: dict, role: str, skill_blobs: list[str]) -> tuple[int, dict]:
    """Legacy aggregate skill score (kept for tests / fallbacks)."""
    lines = []
    for blob in skill_blobs or []:
        text = str(blob or "").strip()
        if not text:
            continue
        name = text.split("\n", 1)[0].strip() or text[:48]
        lines.append({"kind": "skill", "name": name, "blob": text, "is_affinity": False})
    pts, meta = _score_pilot_kit_lines(rules, role, "Ranged", lines)
    return pts, meta


def _score_one_pilot_kit_line(
    rules: dict, role: str, specialty: str, item: dict
) -> int:
    """Per-skill / per-ability points (eternalsp-style additive lines)."""
    name = str(item.get("name") or "")
    blob = str(item.get("blob") or name)
    if item.get("is_affinity"):
        return int(rules.get("series_affinity_points_each", 3))
    # Permanent stat % is already reflected in scored SP totals.
    if _PILOT_STAT_BOOST_NAME.search(name) or _PILOT_STAT_BOOST_NAME.search(blob.split("\n", 1)[0]):
        return 0
    cfg = rules.get("pilot_skill") or {}
    ignore = re.compile(cfg.get("defense_ignore_regex") or r"$a")
    if role == "Defense" and ignore.search(blob):
        return 0
    abil_cfg = rules.get("ability") or {}
    excl = [str(x).lower() for x in (abil_cfg.get("exclude_name_substrings") or [])]
    low = blob.lower()
    if any(x and x in low for x in excl):
        return 0
    if _PILOT_GREAT_UTILITY.search(blob) or _PILOT_GREAT_UTILITY.search(name):
        return 5
    spec = (specialty or "Ranged").lower()
    if re.search(rf"(?i)(?:boost|increase|increased)\s+{re.escape(spec)}\b", name) or re.search(
        rf"(?i){re.escape(spec)}\s+boost", name
    ):
        return 3
    if item.get("kind") == "skill":
        great_pats = [re.compile(p) for p in ((cfg.get("great_for_role") or {}).get(role) or [])]
        if any(p.search(blob) for p in great_pats):
            return int(cfg.get("great_for_role_points", 2))
        return int(cfg.get("has_useful_points", 1))
    family_pats = [re.compile(p) for p in ((abil_cfg.get("effect_families") or {}).get(role) or [])]
    great_pats = [re.compile(p) for p in ((abil_cfg.get("great_for_role") or {}).get(role) or [])]
    if any(p.search(blob) for p in family_pats) or any(p.search(blob) for p in great_pats):
        return int(abil_cfg.get("one_great_for_role_points", 2))
    return int(abil_cfg.get("has_passive_points", 1))


def _score_pilot_kit_lines(
    rules: dict, role: str, specialty: str, items: list[dict]
) -> tuple[int, dict]:
    scored = []
    total = 0
    for item in items or []:
        pts = _score_one_pilot_kit_line(rules, role, specialty, item)
        row = dict(item)
        row["points"] = int(pts)
        scored.append(row)
        # Affinity points live under series_affinity breakdown, not skills_abilities.
        if not item.get("is_affinity"):
            total += int(pts)
    return total, {"lines": scored, "heuristic": True, "count": len(scored)}


def score_pilot_features(features: dict, rules: dict | None = None) -> dict:
    """Score a pilot (character) for SP investment."""
    rules = rules or load_rules()
    role = features.get("role") or "Attack"
    if role not in ("Attack", "Defense", "Support"):
        role = "Attack"
    specialty = features.get("specialty") or pilot_specialty(features)
    breakdown: dict[str, Any] = {}
    meta: dict[str, Any] = {"heuristic_keys": []}
    detail_lines: list[dict] = []

    tag_pts = pilot_tag_count_points(rules, int(features.get("tag_count") or 0))
    breakdown["tags"] = tag_pts
    tag_names = [str(t) for t in (features.get("tags") or []) if t]
    detail_lines.append(
        {
            "kind": "tags",
            "label": "Tags",
            "detail": ", ".join(tag_names) if tag_names else "—",
            "points": tag_pts,
        }
    )

    for key in ("Ranged", "Melee", "Awaken", "Defense", "Reaction"):
        bands = ((rules.get("pilot_stat_bands") or {}).get(key) or {}).get(role) or []
        val = int(features.get(key) or 0)
        pts = band_points(bands, val)
        breakdown[key.lower()] = pts
        detail_lines.append(
            {
                "kind": "stat",
                "key": key,
                "label": key,
                "value": val,
                "points": pts,
                "highlight": key == specialty,
            }
        )

    kit_items = list(features.get("kit_items") or [])
    if not kit_items:
        for blob in features.get("skill_blobs") or []:
            text = str(blob or "").strip()
            if text:
                kit_items.append(
                    {
                        "kind": "skill",
                        "name": text.split("\n", 1)[0].strip(),
                        "blob": text,
                        "is_affinity": False,
                    }
                )
        for blob in features.get("ability_blobs") or []:
            text = str(blob or "").strip()
            if not text:
                continue
            name = text.split("\n", 1)[0].strip()
            is_aff = bool(re.search(r"(?i)affinity|勢力|シリーズ", name))
            kit_items.append(
                {"kind": "ability", "name": name, "blob": text, "is_affinity": is_aff}
            )

    kit_pts, kit_meta = _score_pilot_kit_lines(rules, role, specialty, kit_items)
    breakdown["skills_abilities"] = kit_pts
    meta["kit"] = kit_meta
    meta["heuristic_keys"].append("skills_abilities")
    for line in kit_meta.get("lines") or []:
        detail_lines.append(
            {
                "kind": line.get("kind") or "ability",
                "label": line.get("name") or "",
                "name": line.get("name") or "",
                "points": int(line.get("points") or 0),
                "is_affinity": bool(line.get("is_affinity")),
                "estimated": True,
            }
        )

    aff_n = int(features.get("series_affinity_count") or 0)
    aff_each = int(rules.get("series_affinity_points_each", 3))
    # Prefer counting from scored affinity kit lines when present.
    aff_from_lines = sum(
        int(x.get("points") or 0)
        for x in (kit_meta.get("lines") or [])
        if x.get("is_affinity")
    )
    breakdown["series_affinity"] = aff_from_lines if aff_from_lines else aff_n * aff_each

    letter_pts_map = rules.get("recommend_ms_letter_points") or {}
    best_letter = features.get("best_rec_ms_letter") or ""
    rec_pts = int(letter_pts_map.get(best_letter, 0) or 0)
    if int(features.get("rec_ms_bplus_or_better_count") or 0) > 1:
        rec_pts += int(rules.get("recommend_ms_multi_bplus_bonus", 1))
    breakdown["recommend_ms"] = rec_pts
    detail_lines.append(
        {
            "kind": "recommend",
            "label": "Recommended MS (B+ and up)",
            "detail": best_letter or "—",
            "points": rec_pts,
        }
    )

    total = int(sum(int(v) for v in breakdown.values()))
    letter = letter_for_total(rules, total)
    bucket = bucket_for_letter(rules, letter)
    return {
        "total": total,
        "letter": letter,
        "bucket": bucket,
        "breakdown": breakdown,
        "meta": meta,
        "mode": "sp",
        "role": role,
        "specialty": specialty,
        "detail_lines": detail_lines,
    }


def _char_sp_totals(A, cid: str, ri: str, ldc: dict) -> dict:
    """SP-list max column (index 2) + unconditional SP ability % — matches eternalsp pilot popup stats."""
    grown_sp = {}
    raw = A.char_stat_map.get(cid, {}) or {}
    for s in A.CHAR_STAT_ORDER:
        st = raw.get(s, (0, 0, 0))
        if isinstance(st, (list, tuple)) and len(st) >= 3:
            grown_sp[s] = int(st[2] or st[1] or 0)
        elif isinstance(st, (list, tuple)) and len(st) >= 2:
            grown_sp[s] = int(st[1] or 0)
        else:
            grown_sp[s] = 0
    if int(ri) <= 4:
        try:
            return A.compute_char_stat_totals_sp_list(cid, ri, ldc, grown_sp) or grown_sp
        except Exception:
            return grown_sp
    try:
        if hasattr(A, "compute_char_stat_totals_detail_style"):
            grown = {}
            for s in A.CHAR_STAT_ORDER:
                st = raw.get(s, (0, 0, 0))
                if isinstance(st, (list, tuple)) and len(st) >= 2:
                    try:
                        grown[s] = A.calc_growth_char(st[0], st[1], ri)
                    except Exception:
                        grown[s] = int(st[1] or 0)
                else:
                    grown[s] = 0
            return A.compute_char_stat_totals_detail_style(cid, ri, ldc, grown) or grown
        return A.compute_char_stat_totals_with_abilities(cid, ri, ldc, grown_sp) or grown_sp
    except Exception:
        return grown_sp


def _collect_ability_conditions(entry: dict) -> tuple[list[str], list[str]]:
    """Return (unit_tag_ids, series_ids) required by ability detail conditions."""
    tag_ids: list[str] = []
    series_ids: list[str] = []
    for d in entry.get("details") or []:
        if not isinstance(d, dict):
            continue
        conds = list(d.get("conditions") or [])
        for g in d.get("condition_groups") or []:
            if isinstance(g, dict):
                conds.extend(g.get("conditions") or [])
        for c in conds:
            if not isinstance(c, dict):
                continue
            cid = str(c.get("id") or "")
            if not cid or cid == "0":
                continue
            ctype = str(c.get("type") or c.get("source") or "").lower()
            if ctype in ("unit", "unit_tags", "tag", "lineage") or c.get("source") == "unit_tags":
                tag_ids.append(cid)
            elif ctype in ("series",) or c.get("source") == "series":
                series_ids.append(cid)
    return tag_ids, series_ids


def _char_kit_blobs(A, cid: str, lc: str, ldc: dict) -> tuple[list[str], list[str], int]:
    """Return ability_blobs, skill_blobs, series_affinity_count (compat wrapper)."""
    items, aff, _tags, _series = _char_kit_items(A, cid, lc, ldc)
    ability_blobs = [x["blob"] for x in items if x.get("kind") == "ability"]
    skill_blobs = [x["blob"] for x in items if x.get("kind") == "skill"]
    return ability_blobs, skill_blobs, aff


def _char_kit_items(A, cid: str, lc: str, ldc: dict) -> tuple[list[dict], int, list[str], list[str]]:
    """Structured kit lines + affinity count + required unit-tag / series ids for MS match."""
    items: list[dict] = []
    aff = 0
    req_tags: list[str] = []
    req_series: list[str] = []
    try:
        fa = [x for x in A.extract_data_list(A.char_abil) if A.normalize_id(x.get("CharacterId", "")) == cid]
    except Exception:
        fa = []
    for ab in sorted(fa, key=lambda x: int(x.get("SortOrder", 0) or 0)):
        bid = A.normalize_id(ab.get("AbilityId", ""))
        spid = A.normalize_id(ab.get("SpAbilityId") or ab.get("spAbilityId") or "0")
        use_id = spid if spid and spid not in ("0", "None", bid) else bid
        try:
            entry = A.build_ability_entry(
                str(use_id),
                ldc.get("abil_name_map", {}),
                A.abil_link_map,
                A.trait_set_traits_map,
                A.trait_data_map,
                ldc.get("lang_text_map", {}),
                ldc.get("lang_text_map", {}),
                A.trait_condition_raw_map,
                ldc.get("lineage_lookup", {}),
                ldc.get("series_name_map", {}),
                A.ability_resource_map,
                ldc.get("abil_desc_map", {}),
                sort_order=int(ab.get("SortOrder", 0) or 0),
                lang_code=lc,
            )
        except Exception:
            continue
        if not entry:
            continue
        name = str(entry.get("name") or "")
        parts = [name]
        for d in entry.get("details") or []:
            if isinstance(d, dict) and d.get("text"):
                parts.append(str(d["text"]))
        blob = "\n".join(parts)
        is_aff = False
        try:
            is_aff = bool(A._name_indicates_affinity_ability(name))
        except Exception:
            is_aff = bool(re.search(r"(?i)affinity|勢力|シリーズ", name))
        if is_aff:
            aff += 1
        t_ids, s_ids = _collect_ability_conditions(entry)
        req_tags.extend(t_ids)
        req_series.extend(s_ids)
        items.append(
            {
                "kind": "ability",
                "name": name,
                "blob": blob,
                "is_affinity": is_aff,
                "required_tag_ids": t_ids,
                "required_series_ids": s_ids,
            }
        )
    try:
        fs = [x for x in A.extract_data_list(A.char_skill) if A.normalize_id(x.get("CharacterId", "")) == cid]
    except Exception:
        fs = []
    for sk in sorted(fs, key=lambda x: int(x.get("SortOrder", 0) or 0)):
        sid = A.normalize_id(sk.get("SkillId") or sk.get("CharacterSkillId") or sk.get("skillId") or "")
        if not sid:
            continue
        try:
            sname = ""
            blob = ""
            if hasattr(A, "resolve_char_skill"):
                r = A.resolve_char_skill(str(sid), ldc, 0, False) or {}
                sname = str(r.get("name") or "")
                details = r.get("details") or []
                texts = [sname]
                for d in details:
                    if isinstance(d, dict) and d.get("text"):
                        texts.append(str(d["text"]))
                    elif isinstance(d, str):
                        texts.append(d)
                blob = "\n".join(texts).strip()
            else:
                stm = ldc.get("skill_text_map") or {}
                blob = str(stm.get(sid) or sid)
                sname = blob.split("\n", 1)[0].strip()
            if blob:
                items.append(
                    {
                        "kind": "skill",
                        "name": sname or blob.split("\n", 1)[0].strip(),
                        "blob": blob,
                        "is_affinity": False,
                    }
                )
        except Exception:
            continue
    # Deduplicate required ids preserving order
    def _uniq(xs: list[str]) -> list[str]:
        seen = set()
        out = []
        for x in xs:
            if x not in seen:
                seen.add(x)
                out.append(x)
        return out

    return items, aff, _uniq(req_tags), _uniq(req_series)


def unit_primary_specialty(A, uid: str, lc: str = "EN") -> str:
    """Specialty of the unit's strongest non-MAP weapon (Ranged/Melee/Awaken)."""
    ld = A.get_lang_data(lc) if hasattr(A, "get_lang_data") else A.LANG_DATA.get(lc, {})
    best_power = -1
    best_keys: list[str] = []
    for wp in A.unit_weapon_map.get(uid, []) or []:
        wid = A.normalize_id(wp.get("id"))
        wm = A.weapon_info_map.get(wid, {}) or {}
        if str(wm.get("weapon_type", "1") or "1") == "3":
            continue
        try:
            ws = A.resolve_weapon_stats(
                wm,
                A.weapon_status_map,
                A.weapon_correction_map,
                ld.get("weapon_trait_map", {}),
                ld.get("weapon_capability_map", {}),
                A.growth_pattern_map,
                A.weapon_trait_change_map,
                ld.get("weapon_trait_detail_map", {}),
                wid=wid,
                lang_code=lc,
                unit_id=uid,
            )
        except Exception:
            continue
        power = int(ws.get("power", 0) or 0)
        levels = ws.get("levels", {})
        if isinstance(levels, dict):
            power = max(power, int((levels.get(5, {}) or {}).get("power", 0) or 0))
        keys = list((getattr(A, "ATTACK_ATTR_SET_TYPE_KEYS", {}) or {}).get(str(wm.get("attack_attribute") or "0"), []) or [])
        if not keys:
            continue
        if power > best_power:
            best_power = power
            best_keys = keys
    canon = {"ranged": "Ranged", "melee": "Melee", "awaken": "Awaken"}
    for k in best_keys:
        if k in canon:
            return canon[k]
    return "Ranged"


def build_unit_recommend_index(A, unit_rows: list[dict], lc: str = "EN") -> dict:
    """Index SP/SSP-scored units for pilot→MS recommendation matching."""
    allowed = letter_pts_allowed(load_rules())
    index = {
        "by_id": {},
        "by_recommend_char": {},
        "bplus_ids": [],
    }
    for row in unit_rows or []:
        uid = A.normalize_id(row.get("id") or "")
        if not uid:
            continue
        lit = str(row.get("letter") or "")
        info = A.unit_info_map.get(uid, {}) or {}
        main_uid = A.normalize_id(info.get("main_unit_id") or uid)
        # Skip transform / alt forms that point at another main unit
        if main_uid and main_uid not in ("0", uid):
            continue
        tag_rows = []
        try:
            tag_rows = A.resolve_tags(A.unit_lin_map, uid, lc, "unit") or []
        except Exception:
            tag_rows = []
        tag_ids = []
        tag_names = []
        for t in tag_rows:
            if isinstance(t, dict):
                if t.get("id"):
                    tag_ids.append(str(t["id"]))
                if t.get("name"):
                    tag_names.append(str(t["name"]))
            else:
                tag_names.append(str(t))
        entry = {
            "id": uid,
            "name": row.get("name") or "",
            "letter": lit,
            "role": row.get("role") or ROLE_BY_ID.get(str(info.get("role", "0")), "Attack"),
            "role_id": str(info.get("role", "0") or "0"),
            "rarity": row.get("rarity") or "",
            "rarity_id": str(info.get("rarity", "1") or "1"),
            "is_ultimate": bool(row.get("is_ultimate")),
            "source": row.get("source") or "",
            "acquisition_icon": row.get("acquisition_icon") or "",
            "tag_ids": tag_ids,
            "tags": tag_names,
            "specialty": unit_primary_specialty(A, uid, lc),
            "series_set": str(info.get("series_set") or A.unit_ser_map.get(uid, "") or ""),
        }
        index["by_id"][uid] = entry
        if lit in allowed and _LETTER_ORDER.index(lit) >= _LETTER_ORDER.index("B+"):
            index["bplus_ids"].append(uid)
        try:
            rc = A.resolve_unit_recommend_character_id(uid, info) if hasattr(A, "resolve_unit_recommend_character_id") else ""
        except Exception:
            rc = A.normalize_id(info.get("recommend_character_id") or "0")
            if rc == "0":
                rc = ""
        if rc:
            index["by_recommend_char"].setdefault(rc, []).append(uid)
    return index


def match_recommended_units(
    A,
    cid: str,
    specialty: str,
    role: str,
    req_tag_ids: list[str],
    req_series_ids: list[str],
    unit_index: dict,
    rules: dict | None = None,
    lc: str = "EN",
) -> list[dict]:
    """
    MS recommendations: B+ and up, must satisfy pilot ability tag/series gates,
    and use the pilot's Ranged/Melee/Awaken specialty (Defense units exempt).
    """
    rules = rules or load_rules()
    by_id = unit_index.get("by_id") or {}
    allowed = letter_pts_allowed(rules)
    cand: dict[str, dict] = {}

    def _add(uid: str, reason: str):
        uid = A.normalize_id(uid)
        ent = by_id.get(uid)
        if not ent:
            return
        lit = ent.get("letter") or ""
        if lit not in allowed or _LETTER_ORDER.index(lit) < _LETTER_ORDER.index("B+"):
            return
        row = {
            "id": uid,
            "name": ent.get("name") or "",
            "letter": lit,
            "role": ent.get("role"),
            "rarity": ent.get("rarity"),
            "is_ultimate": ent.get("is_ultimate"),
            "acquisition_icon": ent.get("acquisition_icon") or "",
            "specialty": ent.get("specialty"),
            "reason": reason,
        }
        prev = cand.get(uid)
        if not prev or _LETTER_ORDER.index(lit) > _LETTER_ORDER.index(prev.get("letter") or "E"):
            cand[uid] = row

    # Official / reverse-linked pairs always considered
    try:
        rec_uid = A.resolve_character_recommend_unit_id(cid) if hasattr(A, "resolve_character_recommend_unit_id") else ""
    except Exception:
        rec_uid = ""
    if rec_uid:
        _add(rec_uid, "official")
    for uid in (unit_index.get("by_recommend_char") or {}).get(cid, []) or []:
        _add(uid, "linked")

    req_tags = [str(x) for x in (req_tag_ids or []) if x]
    req_series = [str(x) for x in (req_series_ids or []) if x]
    # If the pilot has no gated kit conditions, keep official/linked only.
    if req_tags or req_series:
        for uid in unit_index.get("bplus_ids") or []:
            ent = by_id.get(uid) or {}
            u_tags = set(ent.get("tag_ids") or [])
            if req_tags and not all(t in u_tags for t in req_tags):
                continue
            if req_series:
                sset = ent.get("series_set") or ""
                ok = False
                for sid in req_series:
                    try:
                        if A.entity_matches_series(sset, sid, lc):
                            ok = True
                            break
                    except Exception:
                        continue
                if not ok:
                    continue
            # Specialty: Defense MS exempt; else strongest weapon type must match
            u_role = ent.get("role") or ""
            if u_role != "Defense":
                if (ent.get("specialty") or "") != specialty:
                    continue
            _add(uid, "tags_specialty")

    rows = list(cand.values())
    rows.sort(
        key=lambda r: (
            -_LETTER_ORDER.index(r.get("letter") or "E") if (r.get("letter") or "E") in _LETTER_ORDER else 0,
            r.get("name") or "",
            r.get("id") or "",
        )
    )
    return rows[:24]


def extract_character_features(
    A,
    cid: str,
    lc: str = "EN",
    rules: dict | None = None,
    unit_letter_by_id: dict | None = None,
    unit_index: dict | None = None,
) -> dict | None:
    rules = rules or load_rules()
    info = A.char_info_map.get(cid) or {}
    if not info:
        return None
    ri = int(info.get("rarity", 1) or 1)
    has_sp = ri <= 4
    role_id = str(info.get("role", "0") or "0")
    role = ROLE_BY_ID.get(role_id, "Attack")
    ld = A.get_lang_data(lc) if hasattr(A, "get_lang_data") else A.LANG_DATA.get(lc, {})
    ldc = A.LANG_DATA.get(lc) or ld
    totals = _char_sp_totals(A, cid, str(ri), ldc)
    tags = []
    try:
        tags = A.resolve_tags(A.char_lin_map, cid, lc, "character") or []
    except Exception:
        tags = A.char_lin_map.get(cid, []) or []
    kit_items, aff, req_tags, req_series = _char_kit_items(A, cid, lc, ldc)
    ability_blobs = [x["blob"] for x in kit_items if x.get("kind") == "ability"]
    skill_blobs = [x["blob"] for x in kit_items if x.get("kind") == "skill"]

    specialty = pilot_specialty(
        {
            "Ranged": int(totals.get("Ranged") or 0),
            "Melee": int(totals.get("Melee") or 0),
            "Awaken": int(totals.get("Awaken") or 0),
        }
    )

    is_sd_linked = False
    try:
        linked_uid = A.normalize_id((getattr(A, "LINKED_CHARACTER_UNIT_MAP", None) or {}).get(cid) or "0")
        if linked_uid and linked_uid != "0" and hasattr(A, "_unit_has_sd_mechanism"):
            is_sd_linked = bool(A._unit_has_sd_mechanism(A.unit_info_map.get(linked_uid), linked_uid))
    except Exception:
        is_sd_linked = False

    recommended_units: list[dict] = []
    # SD characters are permanently paired — do not list interchangeable MS recommendations.
    if not is_sd_linked and unit_index:
        recommended_units = match_recommended_units(
            A,
            cid,
            specialty,
            role,
            req_tags,
            req_series,
            unit_index,
            rules=rules,
            lc=lc,
        )

    # Fallback / supplement letter discovery from linked ids when index missing
    unit_letter_by_id = unit_letter_by_id or {}
    if not is_sd_linked and not recommended_units:
        cand_uids = []
        try:
            rec_uid = (
                A.resolve_character_recommend_unit_id(cid)
                if hasattr(A, "resolve_character_recommend_unit_id")
                else ""
            )
        except Exception:
            rec_uid = ""
        if not rec_uid:
            rec_uid = A.normalize_id((getattr(A, "CHAR_RECOMMEND_UNIT_MAP", None) or {}).get(cid) or "0")
            if rec_uid == "0":
                rec_uid = ""
        if rec_uid:
            cand_uids.append(rec_uid)
        try:
            linked = (getattr(A, "LINKED_CHARACTER_UNIT_MAP", None) or {}).get(cid)
            if linked:
                cand_uids.append(A.normalize_id(linked))
        except Exception:
            pass
        allowed = letter_pts_allowed(rules)
        for uid in cand_uids:
            lit = unit_letter_by_id.get(uid) or ""
            if lit in allowed and _LETTER_ORDER.index(lit) >= _LETTER_ORDER.index("B+"):
                recommended_units.append(
                    {
                        "id": uid,
                        "name": "",
                        "letter": lit,
                        "role": "",
                        "rarity": "",
                        "reason": "official",
                    }
                )

    allowed = letter_pts_allowed(rules)
    bplus_or_better = 0
    best = ""
    for u in recommended_units:
        lit = u.get("letter") or unit_letter_by_id.get(u.get("id") or "") or ""
        u["letter"] = lit
        if lit in allowed and _LETTER_ORDER.index(lit) >= _LETTER_ORDER.index("B+"):
            bplus_or_better += 1
        if lit in _LETTER_ORDER and (
            not best or _LETTER_ORDER.index(lit) > _LETTER_ORDER.index(best if best in _LETTER_ORDER else "E")
        ):
            best = lit

    rarity_letter = A.RARITY_MAP.get(str(ri), "Unknown") if hasattr(A, "RARITY_MAP") else str(ri)
    try:
        name = A._wn_char_name(cid, ld) or ""
        if name.startswith("Character "):
            name = ""
    except Exception:
        name = ""

    return {
        "id": cid,
        "name": name,
        "role": role,
        "role_id": role_id,
        "rarity": rarity_letter,
        "rarity_id": str(ri),
        "has_sp": has_sp,
        "source": _source_bucket(A, info),
        "tag_count": len(tags),
        "tags": [t.get("name") if isinstance(t, dict) else str(t) for t in tags][:40],
        "ability_blobs": ability_blobs,
        "skill_blobs": skill_blobs,
        "kit_items": kit_items,
        "series_affinity_count": aff,
        "required_unit_tag_ids": req_tags,
        "required_series_ids": req_series,
        "specialty": specialty,
        "is_sd_linked": is_sd_linked,
        "recommended_units": recommended_units,
        "best_rec_ms_letter": best,
        "rec_ms_bplus_or_better_count": bplus_or_better,
        "Ranged": int(totals.get("Ranged") or 0),
        "Melee": int(totals.get("Melee") or 0),
        "Awaken": int(totals.get("Awaken") or 0),
        "Defense": int(totals.get("Defense") or 0),
        "Reaction": int(totals.get("Reaction") or 0),
    }


def letter_pts_allowed(rules: dict) -> set[str]:
    return set((rules.get("recommend_ms_letter_points") or {}).keys())


def score_character(
    A,
    cid: str,
    lc: str = "EN",
    rules: dict | None = None,
    unit_letter_by_id: dict | None = None,
    unit_index: dict | None = None,
) -> dict | None:
    rules = rules or load_rules()
    feats = extract_character_features(
        A,
        cid,
        lc=lc,
        rules=rules,
        unit_letter_by_id=unit_letter_by_id,
        unit_index=unit_index,
    )
    if not feats:
        return None
    scored = score_pilot_features(feats, rules=rules)
    return {
        "id": feats["id"],
        "name": feats.get("name") or "",
        "entity": "character",
        "role": feats["role"],
        "role_id": feats.get("role_id"),
        "rarity": feats.get("rarity"),
        "rarity_id": feats.get("rarity_id"),
        "has_sp": feats.get("has_sp"),
        "source": feats.get("source"),
        "has_map": False,
        "tags": feats.get("tags") or [],
        "total": scored["total"],
        "letter": scored["letter"],
        "bucket": scored["bucket"],
        "breakdown": scored["breakdown"],
        "meta": scored.get("meta") or {},
        "mode": "sp",
        "specialty": scored.get("specialty") or feats.get("specialty") or "",
        "is_sd_linked": bool(feats.get("is_sd_linked")),
        "detail_lines": scored.get("detail_lines") or [],
        "recommended_units": feats.get("recommended_units") or [],
        "stats": {
            "Ranged": feats.get("Ranged"),
            "Melee": feats.get("Melee"),
            "Awaken": feats.get("Awaken"),
            "Defense": feats.get("Defense"),
            "Reaction": feats.get("Reaction"),
        },
        "best_rec_ms_letter": feats.get("best_rec_ms_letter") or "",
    }


def entity_matches_group(A, eid: str, group_id: str, kind: str, lc: str = "EN") -> bool:
    items = A.stage_sortie_group_content_map.get(group_id, []) or []
    if not items:
        return True
    lin = A.unit_lin_map if kind == "unit" else A.char_lin_map
    ser = A.unit_ser_map if kind == "unit" else (A.LANG_DATA.get(lc) or {}).get("char_ser_map") or {}
    for gc in items:
        rt = str(gc.get("restriction_type_index", "0"))
        tid = A.normalize_id(gc.get("target_id", "0"))
        if rt == "1":
            if A.entity_matches_series(ser.get(eid, ""), tid, lc):
                return True
        elif rt == "2":
            if A._entity_matches_one_lineage(lin, eid, tid):
                return True
    return False


def entity_matches_sortie_set(A, eid: str, set_id: str, kind: str, lc: str = "EN") -> bool:
    if not set_id or set_id == "0":
        return True
    rows = A.stage_sortie_set_content_map.get(set_id, []) or []
    want = "1" if kind == "unit" else "2"
    typed = [r for r in rows if str(r.get("target_type_index")) == want]
    if not typed:
        # If stage only restricts the other entity type, treat as unrestricted for this kind
        return True
    for r in typed:
        if not entity_matches_group(A, eid, r.get("group_id", "0"), kind, lc):
            return False
    return True


def entity_eligible_on_stage(A, eid: str, stage_id: str, kind: str = "unit", lc: str = "EN") -> bool:
    sm = A.stage_map.get(stage_id, {}) or {}
    sets = [sm.get("group1_set_id"), sm.get("group2_set_id")]
    sets = [s for s in sets if s and s != "0"]
    if not sets:
        return True
    return any(entity_matches_sortie_set(A, eid, s, kind, lc) for s in sets)


def _restriction_label(A, rt: str, tid: str, lc: str = "EN") -> dict | None:
    ld = A.LANG_DATA.get(lc) or {}
    tid = A.normalize_id(tid)
    if not tid or tid == "0":
        return None
    if rt == "1":
        name = (ld.get("series_name_map") or {}).get(tid) or tid
        return {"kind": "series", "id": tid, "name": str(name)}
    if rt == "2":
        entry = (ld.get("lineage_lookup") or {}).get(tid)
        if isinstance(entry, dict):
            name = entry.get("name") or tid
        elif isinstance(entry, str) and entry.strip():
            name = entry
        else:
            name = tid
        return {"kind": "tag", "id": tid, "name": str(name)}
    return None


def _dedupe_restrictions(labels: list[dict]) -> list[dict]:
    seen = set()
    uniq = []
    for L in labels:
        key = (L.get("kind"), L.get("id"))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(L)
    return uniq


def build_er_expert_filters(A, lc: str = "EN") -> list[dict]:
    """Eternal Road Expert stages for filter dropdown.

    Unit labels use unit sortie restrictions. Character labels use character
    sortie restrictions only; stages with none are marked free-for-all.
    """
    out = []
    for sid, est in sorted(
        A.eternal_stage_map.items(),
        key=lambda x: int(x[1].get("stage_number") or x[1].get("number") or 0) or 0,
    ):
        diff = int(est.get("stage_difficulty_type_index") or 1)
        if diff != 3:
            continue
        sm = A.stage_map.get(sid, {}) or {}
        num = int(est.get("stage_number") or est.get("number") or 0)
        unit_labels: list[dict] = []
        char_labels: list[dict] = []
        for set_id in (sm.get("group1_set_id"), sm.get("group2_set_id")):
            if not set_id or set_id == "0":
                continue
            for r in A.stage_sortie_set_content_map.get(set_id, []) or []:
                tt = str(r.get("target_type_index") or "0")
                bucket = unit_labels if tt == "1" else (char_labels if tt == "2" else None)
                if bucket is None:
                    continue
                for gc in A.stage_sortie_group_content_map.get(r.get("group_id", "0"), []) or []:
                    lab = _restriction_label(
                        A,
                        str(gc.get("restriction_type_index", "0")),
                        gc.get("target_id", "0"),
                        lc,
                    )
                    if lab:
                        bucket.append(lab)
        unit_uniq = _dedupe_restrictions(unit_labels)
        char_uniq = _dedupe_restrictions(char_labels)
        char_free = len(char_uniq) == 0
        unit_short = ", ".join(x["name"] for x in unit_uniq[:3]) or "restricted"
        if char_free:
            char_short = "Free for all"
        else:
            char_short = ", ".join(x["name"] for x in char_uniq[:3]) or "restricted"
        stage_prefix = f"Stage {num}" if num else str(sid)
        out.append({
            "id": sid,
            "number": num,
            "label": f"{stage_prefix} ({unit_short})",
            "unit_label": f"{stage_prefix} ({unit_short})",
            "character_label": f"{stage_prefix} ({char_short})",
            "restrictions": unit_uniq,
            "unit_restrictions": unit_uniq,
            "character_restrictions": char_uniq,
            "character_free_for_all": char_free,
        })
    out.sort(key=lambda x: (x.get("number") or 999, x.get("id") or ""))
    return out


def attach_er_expert_ids(A, row: dict, kind: str, expert_ids: list[str], lc: str = "EN") -> None:
    eid = row.get("id")
    if not eid:
        row["er_expert_ids"] = []
        return
    row["er_expert_ids"] = [
        sid for sid in expert_ids if entity_eligible_on_stage(A, eid, sid, kind=kind, lc=lc)
    ]
