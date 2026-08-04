"""
SP/SSP investment point scorer (eternalsp-inspired heuristic).

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
RULES_PATH = ROOT / "data" / "sp_investment" / "sp_investment_rules_v1.json"

ROLE_BY_ID = {"1": "Attack", "2": "Defense", "3": "Support"}
TERRAIN_KEYS = ("Space", "Atmospheric", "Ground", "Sea", "Underwater")
HEURISTIC_KEYS = frozenset({"abilities", "linked_pilot", "extra_life", "rare_debuff"})


@lru_cache(maxsize=1)
def load_rules() -> dict:
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


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
    return "D"


def bucket_for_letter(rules: dict, letter: str) -> str:
    return str((rules.get("bucket_by_letter") or {}).get(letter, "dont"))


def debuff_pct_to_level(rules: dict, pct: int) -> int | None:
    level = None
    for row in rules.get("debuff_pct_to_level") or []:
        if int(pct or 0) >= int(row.get("min_pct", 0) or 0):
            level = row.get("level")
    return None if level is None else int(level)


def score_abilities(rules: dict, role: str, ability_blobs: list[str]) -> tuple[int, dict]:
    """Return (points, meta). Heuristic."""
    abil_cfg = rules.get("ability") or {}
    excl = [str(x).lower() for x in (abil_cfg.get("exclude_name_substrings") or [])]
    great_pats = [
        re.compile(p) for p in ((abil_cfg.get("great_for_role") or {}).get(role) or [])
    ]
    kept: list[str] = []
    for blob in ability_blobs or []:
        text = str(blob or "")
        low = text.lower()
        if any(x and x in low for x in excl):
            continue
        if text.strip():
            kept.append(text)
    if not kept:
        return 0, {"count": 0, "great": 0, "heuristic": True}
    great = 0
    for text in kept:
        if any(p.search(text) for p in great_pats):
            great += 1
    if great >= 2:
        pts = int(abil_cfg.get("two_great_for_role_points", 3))
    elif great == 1:
        pts = int(abil_cfg.get("one_great_for_role_points", 2))
    else:
        pts = int(abil_cfg.get("has_passive_points", 1))
    return pts, {"count": len(kept), "great": great, "heuristic": True}


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
    ssp_weapon_conditional_count (SSP only, excluding low-HP).
    """
    rules = rules or load_rules()
    role = features.get("role") or "Attack"
    if role not in ("Attack", "Defense", "Support"):
        role = "Attack"
    breakdown: dict[str, Any] = {}
    meta: dict[str, Any] = {"heuristic_keys": []}

    # A1 tags
    tags_pts = tag_count_points(rules, int(features.get("tag_count") or 0))
    breakdown["tags"] = tags_pts

    # A2 / A3 terrain
    terr_cfg = rules.get("terrain") or {}
    terrain = features.get("terrain") or {}
    deploy_min = int(terr_cfg.get("deploy_min_level", 2))
    perfect_min = int(terr_cfg.get("perfect_min_level", 3))
    space = int(terrain.get("Space", 1) or 1)
    ground = int(terrain.get("Ground", 1) or 1)
    air = int(terrain.get("Atmospheric", 1) or 1)
    water = int(terrain.get("Underwater", 1) or 1)
    dual = 0
    if space >= deploy_min and ground >= deploy_min:
        dual = int(terr_cfg.get("dual_space_ground_deploy_points", 2))
    breakdown["terrain_dual"] = dual
    niche = 0
    if space >= perfect_min and air >= perfect_min:
        niche = int(terr_cfg.get("perfect_space_and_atmospheric_points", 1))
    elif water >= perfect_min:
        niche = int(terr_cfg.get("else_perfect_underwater_points", 1))
    breakdown["terrain_niche"] = niche

    # A4 transform
    breakdown["transform"] = int(rules.get("transform_points", 1)) if features.get("has_transform") else 0

    # A5 MAP
    map_ammo = int(features.get("map_ammo") or 0)
    map_pts = 0
    if map_ammo >= 2:
        map_pts = int((rules.get("map_ammo_points") or {}).get("2_or_more", 2))
    elif map_ammo == 1:
        map_pts = int((rules.get("map_ammo_points") or {}).get("1", 1))
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
            breakdown["max_debuff"] = int(tbl.get("none", 0))
        else:
            breakdown["max_debuff"] = int(tbl.get(str(lvl), 0))
    else:
        breakdown["max_debuff"] = 0

    # C SSP conditional weapon bonuses
    ssp_cond = 0
    if mode == "ssp":
        n = int(features.get("ssp_weapon_conditional_count") or 0)
        ssp_cond = n * int(rules.get("ssp_weapon_conditional_bonus_points", 1))
    breakdown["ssp_weapon_conditional"] = ssp_cond

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
    ssp_cond_count = 0
    rare_keys = set(rules.get("rare_debuff_keys") or [])
    excl_re = re.compile(rules.get("ssp_weapon_conditional_exclude_regex") or r"$a")
    incl_re = re.compile(rules.get("ssp_weapon_conditional_include_regex") or r"$a")

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
            if power > max_power and max_range <= 0:
                # keep MAP as power fallback only if no non-MAP later
                pass
            map_power = power
        else:
            max_range = max(max_range, rx)
            max_power = max(max_power, power)
            if tension_max:
                max_power_tension = max(max_power_tension, power)
            else:
                max_power_unrestricted = max(max_power_unrestricted, power)
            if rx >= 4:
                for key in ("def_dn", "atk_dn", "mob_dn", "acc_dn", "range_beam", "range_phys"):
                    if key in debuff_keys:
                        support_debuff_kinds.add(key)

        # trait texts for this weapon path (unit-level iter is fine once)
        _ = wt

    # MAP power fallback
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
        if mode == "ssp" and incl_re.search(str(line or "")) and not excl_re.search(str(line or "")):
            ssp_cond_count += 1

    has_max_tension_higher = max_power_tension > max_power_unrestricted > 0

    # If only MAP weapons contributed power, resolve map power from browse
    if max_power <= 0 and map_ammo > 0:
        # leave power 0 → weak band; acceptable
        pass

    return {
        "weapon_range": max_range,
        "weapon_power": max_power,
        "map_ammo": map_ammo,
        "has_preemptive": has_preemptive,
        "has_rare_debuff": has_rare,
        "has_max_tension_higher_weapon": has_max_tension_higher,
        "max_debuff_pct": max_debuff_pct,
        "support_debuffs_range4_count": len(support_debuff_kinds),
        "ssp_weapon_conditional_count": ssp_cond_count,
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
        "has_sp": has_sp,
        "source": _source_bucket(A, info),
        "tag_count": len(tags),
        "tags": [t.get("name") if isinstance(t, dict) else str(t) for t in tags][:40],
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
    return guide
