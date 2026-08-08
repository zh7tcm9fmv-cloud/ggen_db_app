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
RULES_PATH = ROOT / "data" / "sp_investment" / "sp_investment_rules_v5.json"

ROLE_BY_ID = {"1": "Attack", "2": "Defense", "3": "Support"}
TERRAIN_KEYS = ("Space", "Atmospheric", "Ground", "Sea", "Underwater")
HEURISTIC_KEYS = frozenset(
    {"abilities", "extra_life", "rare_debuff", "tags_strategic", "movement_followup"}
)
# Distinct debuff-kind axes for Defense/Support variety scoring
_SUPPORT_DEBUFF_KIND_KEYS = (
    "def_dn",
    "atk_dn",
    "mob_dn",
    "acc_dn",
    "range_beam",
    "range_phys",
)
_SUPPORT_DEBUFF_KIND_GROUPS = (
    ("dmg_dn", frozenset({"dmg_phys", "dmg_beam", "dmg_spec"})),
    ("wp_dn", frozenset({"wp_phys", "wp_beam", "wp_spec"})),
)


def _support_debuff_kind_set(debuff_keys: set[str]) -> set[str]:
    """Collapse damage-taken / weapon-power downs into single kinds for variety scoring."""
    out: set[str] = set()
    for key in _SUPPORT_DEBUFF_KIND_KEYS:
        if key in debuff_keys:
            out.add(key)
    for label, group in _SUPPORT_DEBUFF_KIND_GROUPS:
        if debuff_keys & group:
            out.add(label)
    return out


@lru_cache(maxsize=1)
def load_rules() -> dict:
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def clear_rules_cache() -> None:
    load_rules.cache_clear()
    clear_tag_strategic_cache()
    clear_structured_effect_caches()
    clear_affinity_pilot_pool_cache()


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


def pilot_rarity_adjustment_points(rules: dict, rarity_id: str | int | None) -> int:
    """Softer rarity floors for pilots (SR SP pilots are often still investable)."""
    tbl = rules.get("pilot_rarity_adjustment") or rules.get("rarity_adjustment") or {}
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


def letter_for_total(
    rules: dict, total: int, *, cutoffs_key: str = "letter_cutoffs"
) -> str:
    rows = rules.get(cutoffs_key) or rules.get("letter_cutoffs") or []
    for row in rows:
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


def _er_expert_tag_mention_counts(A, lc: str = "EN") -> dict[str, int]:
    """lineageId / lowercase name → how many ER Expert stages mention the tag."""
    counts: dict[str, int] = {}
    for sid, est in (getattr(A, "eternal_stage_map", None) or {}).items():
        if int(est.get("stage_difficulty_type_index") or 1) != 3:
            continue
        sm = (getattr(A, "stage_map", None) or {}).get(sid, {}) or {}
        for set_id in (sm.get("group1_set_id"), sm.get("group2_set_id")):
            if not set_id or set_id == "0":
                continue
            for r in (getattr(A, "stage_sortie_set_content_map", None) or {}).get(set_id, []) or []:
                tt = str(r.get("target_type_index") or "0")
                if tt not in ("1", "3"):
                    continue
                for gc in (getattr(A, "stage_sortie_group_content_map", None) or {}).get(
                    r.get("group_id", "0"), []
                ) or []:
                    if str(gc.get("restriction_type_index", "0")) != "2":
                        continue
                    tid = A.normalize_id(gc.get("target_id", "0"))
                    if not tid or tid == "0":
                        continue
                    counts[tid] = counts.get(tid, 0) + 1
                    lab = _restriction_label(A, "2", tid, lc)
                    if lab and lab.get("name"):
                        key = str(lab["name"]).strip().lower()
                        counts[key] = counts.get(key, 0) + 1
    return counts


def build_tag_strategic_table(A, rules: dict | None = None, lc: str = "EN") -> dict[str, dict]:
    """
    Per scored tag name (lowercase): ur_weight, er_mentions, effective_weight.
    Limited UR MS = 1.5, permanent UR MS = 1.0.
    """
    rules = rules or load_rules()
    cfg = rules.get("tag_strategic") or {}
    lim_w = float(cfg.get("limited_ur_weight", 1.5) or 1.5)
    perm_w = float(cfg.get("permanent_ur_weight", 1.0) or 1.0)
    er_bonus = float(cfg.get("er_mention_bonus_per_stage", 0.15) or 0.0)
    limited = {A.normalize_id(x) for x in (getattr(A, "LIMITED_TIME_UNIT_IDS", None) or set())}
    er_mentions = _er_expert_tag_mention_counts(A, lc)
    ld = A.LANG_DATA.get(lc) or {}
    lin_lookup = ld.get("lineage_lookup") or {}
    id_to_names: dict[str, set[str]] = {}
    for lid, entry in lin_lookup.items():
        lid_n = A.normalize_id(lid)
        if isinstance(entry, dict):
            name = str(entry.get("name") or "").strip()
        else:
            name = str(entry or "").strip()
        if name:
            id_to_names.setdefault(lid_n, set()).add(name)

    ur_weight_by_name: dict[str, float] = {}
    for uid, info in (getattr(A, "unit_info_map", None) or {}).items():
        main_id = A.normalize_id(info.get("main_unit_id") or "0")
        uid_n = A.normalize_id(uid)
        if main_id and main_id != "0" and main_id != uid_n:
            continue
        if str(info.get("body_type") or "1") == "2":
            continue
        if int(info.get("rarity", 1) or 1) < 5:
            continue
        w = lim_w if uid_n in limited else perm_w
        tags = []
        try:
            tags = A.resolve_tags(A.unit_lin_map, uid, lc, "unit") or []
        except Exception:
            tags = A.unit_lin_map.get(uid, []) or []
        for t in tags:
            if isinstance(t, dict):
                name = str(t.get("name") or "").strip()
            else:
                name = str(t or "").strip()
            if not name or not filter_scored_unit_tags(rules, [name]):
                continue
            key = name.lower()
            ur_weight_by_name[key] = ur_weight_by_name.get(key, 0.0) + w

    table: dict[str, dict] = {}
    for key, uw in ur_weight_by_name.items():
        er_n = int(er_mentions.get(key, 0) or 0)
        table[key] = {
            "ur_weight": round(uw, 3),
            "er_mentions": er_n,
            "effective_weight": round(uw * (1.0 + er_bonus * er_n), 3),
        }
    for tid, n in er_mentions.items():
        if not str(tid).isdigit():
            continue
        for name in id_to_names.get(A.normalize_id(tid), set()):
            key = name.lower()
            row = table.setdefault(
                key,
                {
                    "ur_weight": float(ur_weight_by_name.get(key, 0.0) or 0.0),
                    "er_mentions": 0,
                    "effective_weight": 0.0,
                },
            )
            row["er_mentions"] = max(int(row.get("er_mentions") or 0), int(n))
            uw = float(row.get("ur_weight") or 0.0)
            row["effective_weight"] = round(uw * (1.0 + er_bonus * int(row["er_mentions"])), 3)
    return table


_TAG_STRATEGIC_CACHE: dict[tuple, dict] = {}


def get_tag_strategic_table(A, rules: dict | None = None, lc: str = "EN") -> dict[str, dict]:
    rules = rules or load_rules()
    key = (id(A), int(rules.get("version") or 0), lc)
    cached = _TAG_STRATEGIC_CACHE.get(key)
    if cached is not None:
        return cached
    table = build_tag_strategic_table(A, rules, lc)
    _TAG_STRATEGIC_CACHE[key] = table
    return table


_PILOT_TAG_STRATEGIC_CACHE: dict[tuple, dict] = {}


def clear_tag_strategic_cache() -> None:
    _TAG_STRATEGIC_CACHE.clear()
    _PILOT_TAG_STRATEGIC_CACHE.clear()


def build_pilot_tag_strategic_table(A, rules: dict | None = None, lc: str = "EN") -> dict[str, dict]:
    """Strategic tag weights from UR pilots (Limited 1.5 / permanent UR 1.0)."""
    rules = rules or load_rules()
    cfg = rules.get("pilot_tag_strategic") or rules.get("tag_strategic") or {}
    lim_w = float(cfg.get("limited_ur_weight", 1.5) or 1.5)
    perm_w = float(cfg.get("permanent_ur_weight", 1.0) or 1.0)
    er_bonus = float(cfg.get("er_mention_bonus_per_stage", 0.15) or 0.0)
    limited = {A.normalize_id(x) for x in (getattr(A, "LIMITED_TIME_CHARACTER_IDS", None) or set())}
    er_mentions = _er_expert_tag_mention_counts(A, lc)
    ur_weight_by_name: dict[str, float] = {}
    for cid, info in (getattr(A, "char_info_map", None) or {}).items():
        if int(info.get("rarity", 1) or 1) < 5:
            continue
        cid_n = A.normalize_id(cid)
        w = lim_w if cid_n in limited else perm_w
        tags = []
        try:
            tags = A.resolve_tags(A.char_lin_map, cid, lc, "character") or []
        except Exception:
            tags = A.char_lin_map.get(cid, []) or []
        for t in tags:
            name = str(t.get("name") if isinstance(t, dict) else t or "").strip()
            if not name or not filter_scored_unit_tags(rules, [name]):
                continue
            key = name.lower()
            ur_weight_by_name[key] = ur_weight_by_name.get(key, 0.0) + w
    table: dict[str, dict] = {}
    for key, uw in ur_weight_by_name.items():
        er_n = int(er_mentions.get(key, 0) or 0)
        table[key] = {
            "ur_weight": round(uw, 3),
            "er_mentions": er_n,
            "effective_weight": round(uw * (1.0 + er_bonus * er_n), 3),
        }
    return table


def get_pilot_tag_strategic_table(A, rules: dict | None = None, lc: str = "EN") -> dict[str, dict]:
    rules = rules or load_rules()
    key = (id(A), int(rules.get("version") or 0), lc, "pilot")
    cached = _PILOT_TAG_STRATEGIC_CACHE.get(key)
    if cached is not None:
        return cached
    table = build_pilot_tag_strategic_table(A, rules, lc)
    _PILOT_TAG_STRATEGIC_CACHE[key] = table
    return table


def strategic_tag_points(
    rules: dict, tag_names: list[str] | None, tag_table: dict[str, dict] | None
) -> tuple[int, dict]:
    """Sum effective UR weights for strategic tags on the unit, then band to points."""
    cfg = rules.get("tag_strategic") or {}
    if not cfg:
        return 0, {"weight": 0.0, "tags": []}
    min_w = float(cfg.get("min_ur_weight_to_count", 2.0) or 2.0)
    include_er = bool(cfg.get("include_er_mentioned_below_min", True))
    scored = filter_scored_unit_tags(rules, tag_names)
    table = tag_table or {}
    used = []
    total_w = 0.0
    for name in scored:
        key = name.lower()
        row = table.get(key) or {}
        uw = float(row.get("ur_weight") or 0.0)
        er_n = int(row.get("er_mentions") or 0)
        eff = float(row.get("effective_weight") or 0.0)
        if uw >= min_w or (include_er and er_n >= 1):
            total_w += eff if eff else uw
            used.append({"name": name, "ur_weight": uw, "er_mentions": er_n, "effective_weight": eff or uw})
    if not used:
        return 0, {"weight": 0.0, "tags": []}
    pts = band_points(cfg.get("weight_bands") or [], total_w)
    cap = int(cfg.get("cap_points", 3) or 3)
    if pts > cap:
        pts = cap
    if pts < -cap:
        pts = -cap
    return pts, {"weight": round(total_w, 3), "tags": used[:12]}


def weapon_power_bands_for_mode(rules: dict, mode: str, role: str) -> list:
    """v5: weapon_power.sp|ssp.Role; fall back to flat weapon_power.Role (v4)."""
    wp = rules.get("weapon_power") or {}
    mode_key = "ssp" if str(mode).lower() == "ssp" else "sp"
    if isinstance(wp.get(mode_key), dict):
        return (wp.get(mode_key) or {}).get(role) or []
    return wp.get(role) or []


def movement_followup_points(rules: dict, features: dict) -> tuple[int, dict]:
    cfg = rules.get("movement_followup") or {}
    if not cfg:
        return 0, {}
    cap = int(cfg.get("cap", 1) or 1)
    pts = 0
    reasons = []
    heuristic = False
    if features.get("has_after_move_map"):
        pts += int(cfg.get("after_move_map_points", 1) or 0)
        reasons.append("after_move_map")
    if features.get("has_extra_move_kit"):
        pts += int(cfg.get("extra_move_points", 1) or 0)
        reasons.append("extra_move_kit")
        # Structured Chance Step / PostAttackMove is not heuristic; blob regex is.
        heuristic = bool(features.get("extra_move_from_regex"))
    pts = min(cap, pts)
    return pts, {"reasons": reasons, "heuristic": heuristic}


def detect_weapon_bonus_type(rules: dict, trait_lines: list[str]) -> tuple[int, int]:
    """
    Text fallback: (bonus_type_id, points) for the highest-scoring typed bonus on
    trait lines. Type 3 (Low HP) scores 0; other matches beat it.
    Prefer detect_weapon_bonus_structured when master trait IDs are available.
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


def detect_weapon_bonus_structured(
    A, uid: str, rules: dict, trait_ids: list[str] | None = None
) -> tuple[int, int, dict]:
    """
    Map weapon PassiveTrait → status TraitTypeIndex to maxweapon bonus types.
    Returns (bonus_type_id, points, meta).
    When trait_ids is provided (strongest weapon), only those traits are scored.
    """
    cfg = rules.get("maxweapon_bonus") or {}
    pts_map = cfg.get("points_by_type") or {}
    type_map = cfg.get("trait_type_to_bonus_type") or {}
    crit_rate_min = int(cfg.get("crit_rate_min_value", 20) or 20)
    if not type_map:
        return 0, 0, {"structured": False, "reason": "no_trait_map"}
    meta_by_id = _weapon_trait_meta_by_id(A)
    best_type = 0
    best_pts = -1
    hit_types: list[int] = []
    ids = trait_ids if trait_ids is not None else collect_unit_weapon_trait_ids(A, uid)
    for tid in ids:
        meta = meta_by_id.get(tid) or {}
        # PassiveTrait (3) carries status TraitType; some bonuses are bare indices
        st_tti = int(meta.get("status_type_index") or 0)
        wtti = int(meta.get("type_index") or 0)
        candidates = [st_tti] if st_tti else []
        if wtti == 3 and not st_tti:
            continue
        for st in candidates:
            btype_s = type_map.get(str(st))
            if btype_s is None:
                continue
            btype = int(btype_s)
            pts = int(pts_map.get(str(btype), 0) or 0)
            # Crit rate (type 9): only score at/above configured % (default 20)
            if btype == 9:
                mag = abs(int(meta.get("magnitude") or meta.get("status_value") or 0))
                if mag < crit_rate_min:
                    pts = 0
            hit_types.append(st)
            if pts > best_pts or (pts == best_pts and btype > best_type):
                best_type = btype
                best_pts = pts
    if best_pts < 0:
        return 0, 0, {"structured": True, "hits": hit_types}
    return best_type, best_pts, {"structured": True, "hits": hit_types, "type": best_type}


def collect_weapon_trait_ids_for_weapon(
    A, wid: str, wm: dict | None = None, mode: str = "sp"
) -> list[str]:
    """Trait ids attached to one weapon (growth / change patterns + SSP grants when mode=ssp)."""
    ids: list[str] = []
    seen: set[str] = set()
    gpm = getattr(A, "growth_pattern_map", None) or {}
    wm = wm or A.weapon_info_map.get(A.normalize_id(wid), {}) or {}
    wid = A.normalize_id(wid)

    def _add_from_pattern(tsi: str) -> None:
        if not tsi or tsi == "0":
            return
        by_lv = (getattr(A, "weapon_trait_change_map", None) or {}).get(tsi) or {}
        for _lv, tids in by_lv.items():
            for tid in tids or []:
                nid = A.normalize_id(tid)
                if nid and nid not in seen:
                    seen.add(nid)
                    ids.append(nid)
        if tsi not in seen and tsi in _weapon_trait_meta_by_id(A):
            seen.add(tsi)
            ids.append(tsi)

    wsid = A.normalize_id(wm.get("weapon_status_id") or wid)
    ws = A.weapon_status_map.get(wsid) or A.weapon_status_map.get(wid) or {}
    candidates = [
        A.normalize_id(ws.get("trait_correction_id") or "0"),
        wid,
        wsid,
        A.normalize_id(wm.get("main_weapon_id") or "0"),
    ]
    gi = A.normalize_id(ws.get("growth_pattern_id") or "0")
    if gi and gi != "0":
        gd = gpm.get(gi) or {}
        candidates.append(A.normalize_id(gd.get("trait_change_set_id") or "0"))
    for tsi in candidates:
        _add_from_pattern(tsi)
    if str(mode).lower() == "ssp":
        mwid = A.normalize_id(wm.get("main_weapon_id", "0") or "0")
        for cid in (wid, mwid):
            if not cid or cid == "0":
                continue
            for tid in (getattr(A, "unit_ssp_weapon_effect_map", {}) or {}).get(cid) or []:
                nid = A.normalize_id(tid)
                if nid and nid not in seen:
                    seen.add(nid)
                    ids.append(nid)
    return ids


def _weapon_is_ssp_custom_core_id(wid: str) -> bool:
    """SSP Custom Core weapon ids end in …80 (MAP) or …90 (attack)."""
    w = str(wid or "")
    return w.endswith("80") or w.endswith("90")


def bucket_for_letter(rules: dict, letter: str) -> str:
    return str((rules.get("bucket_by_letter") or {}).get(letter, "niche"))


def er_access_points(rules: dict, eligible_count: int) -> int:
    n = int(eligible_count or 0)
    for row in rules.get("er_access_points") or []:
        if int(row.get("min", 0)) <= n <= int(row.get("max", 999)):
            return int(row.get("points", 0) or 0)
    return 0


def map_coverage_points(rules: dict, cell_count: int) -> int:
    return band_points(rules.get("map_coverage_points") or [], int(cell_count or 0))


def score_transform(rules: dict, features: dict) -> tuple[int, dict]:
    """
    Transform is not free points. Score only when the alt form gains strategic tools
    vs the base form (terrain unlock, MOV, range, power, or MAP).
    """
    cfg = rules.get("transform") or {}
    gains = list(features.get("transform_gains") or [])
    # Explicit advantage flag (tests / overrides)
    if features.get("has_transform_advantage") is True and not gains:
        gains = ["advantage"]
    if features.get("has_transform_advantage") is False:
        meta = {"gains": [], "has_transform": bool(features.get("has_transform"))}
        if features.get("transform_meta"):
            meta.update(features.get("transform_meta") or {})
        return 0, meta
    if not gains:
        if features.get("has_transform") and not cfg:
            # Legacy flat points when no transform config
            return int(rules.get("transform_points", 1) or 0), {
                "gains": [],
                "legacy_flat": True,
            }
        meta = {"gains": [], "has_transform": bool(features.get("has_transform"))}
        if features.get("transform_meta"):
            meta.update(features.get("transform_meta") or {})
        return 0, meta

    base_pts = int(cfg.get("points_if_advantage", rules.get("transform_points", 1)) or 0)
    extra = int(cfg.get("extra_gain_type_points", 0) or 0)
    # Distinct gain kinds beyond the first
    kinds = {g for g in gains if g and g != "advantage"}
    n_kinds = len(kinds) if kinds else (1 if gains else 0)
    pts = base_pts
    if extra and n_kinds > 1:
        pts += extra * (n_kinds - 1)
    cap = int(cfg.get("max_points", pts) or pts)
    if pts > cap:
        pts = cap
    meta = {"gains": sorted(kinds) if kinds else list(gains), "gain_types": n_kinds}
    if features.get("transform_meta"):
        meta.update({k: v for k, v in (features.get("transform_meta") or {}).items() if k not in meta})
    return pts, meta


def analyze_transform_gains(
    A,
    uid: str,
    info: dict,
    partner_id: str | None,
    mode: str,
    lc: str,
    ld: dict,
    rules: dict,
    base_stats: dict | None = None,
) -> tuple[bool, list[str], dict]:
    """
    Compare base MS ↔ transform alt. Returns (has_partner, gain_keys, meta).
    Gain keys: terrain, movement, weapon_range, weapon_power, map.
    """
    if not partner_id:
        return False, [], {}
    uid = A.normalize_id(uid)
    partner_id = A.normalize_id(partner_id)
    mid = A.normalize_id(info.get("main_unit_id") or uid)
    if mid in ("0", ""):
        mid = uid
    # Always evaluate alt advantages over the main/base form
    if uid == mid:
        base_id, alt_id = uid, partner_id
    else:
        base_id, alt_id = mid, uid
        if partner_id == mid:
            alt_id = uid

    cfg = rules.get("transform") or {}
    terr_cfg = rules.get("terrain") or {}
    deploy_min = int(terr_cfg.get("deploy_min_level", 2))
    mov_need = int(cfg.get("mov_min_increase", 1) or 1)
    range_need = int(cfg.get("range_min_increase", 1) or 1)
    power_need = int(cfg.get("power_min_increase", 1) or 1)

    use_mode = mode if mode in ("sp", "ssp") else "sp"
    base_info = A.unit_info_map.get(base_id, {}) or info
    alt_info = A.unit_info_map.get(alt_id, {}) or {}
    if not alt_info:
        return True, [], {"base_id": base_id, "alt_id": alt_id, "missing_alt": True}

    base_terr = _effective_terrain(A, base_id, base_info, use_mode)
    alt_terr = _effective_terrain(A, alt_id, alt_info, use_mode)

    def _deployable(terr: dict) -> set[str]:
        return {k for k in TERRAIN_KEYS if int(terr.get(k, 1) or 1) >= deploy_min}

    base_dep = _deployable(base_terr)
    alt_dep = _deployable(alt_terr)
    terrain_unlock = sorted(alt_dep - base_dep)

    # Movement
    base_mov = int((base_stats or {}).get("MOV") or (base_stats or {}).get("Move") or 0)
    alt_mov = 0
    try:
        ldc = A.LANG_DATA.get(lc) or ld
        pblock = A._unit_max_lb_stat_block(
            alt_id, alt_info, A.unit_stat_map.get(alt_id, {}), ldc
        )
        pstats = A._unit_lb_row_to_api(pblock, use_mode, False) or {}
        alt_mov = int(pstats.get("MOV") or pstats.get("Move") or 0)
        if not base_mov:
            bblock = A._unit_max_lb_stat_block(
                base_id, base_info, A.unit_stat_map.get(base_id, {}), ldc
            )
            bstats = A._unit_lb_row_to_api(bblock, use_mode, False) or {}
            base_mov = int(bstats.get("MOV") or bstats.get("Move") or 0)
    except Exception:
        pass

    base_w = _weapon_features(A, base_id, ld, lc, use_mode, rules)
    alt_w = _weapon_features(A, alt_id, ld, lc, use_mode, rules)
    base_range = int(base_w.get("weapon_range") or 0)
    alt_range = int(alt_w.get("weapon_range") or 0)
    base_power = int(base_w.get("weapon_power") or 0)
    alt_power = int(alt_w.get("weapon_power") or 0)
    base_map = bool(base_w.get("has_map_weapon")) or int(base_w.get("map_ammo") or 0) > 0
    alt_map = bool(alt_w.get("has_map_weapon")) or int(alt_w.get("map_ammo") or 0) > 0

    gains: list[str] = []
    if terrain_unlock:
        gains.append("terrain")
    if alt_mov >= base_mov + mov_need:
        gains.append("movement")
    if alt_range >= base_range + range_need:
        gains.append("weapon_range")
    if alt_power >= base_power + power_need:
        gains.append("weapon_power")
    if alt_map and not base_map:
        gains.append("map")

    meta = {
        "base_id": base_id,
        "alt_id": alt_id,
        "terrain_unlock": terrain_unlock,
        "mov": {"base": base_mov, "alt": alt_mov},
        "weapon_range": {"base": base_range, "alt": alt_range},
        "weapon_power": {"base": base_power, "alt": alt_power},
        "map": {"base": base_map, "alt": alt_map},
        "gains": list(gains),
    }
    return True, gains, meta


def terrain_coverage_points(
    rules: dict, terrain: dict | None, role: str | None = None
) -> tuple[int, dict]:
    """
    Terrain floor: Space + (Land or Atmospheric) → 0.
    Extra +1 each for Atmospheric / Underwater / Sea when truly extra
    (Atmospheric does not double-dip when it is substituting for Land).
    Perfect coverage bonus when 4+ deployable terrains.
    """
    terr_cfg = rules.get("terrain") or {}
    deploy_min = int(terr_cfg.get("deploy_min_level", 2))
    terrain = terrain or {}
    space = int(terrain.get("Space", 1) or 1)
    ground = int(terrain.get("Ground", 1) or 1)
    has_space = space >= deploy_min
    has_land = ground >= deploy_min
    atmos = int(terrain.get("Atmospheric", 1) or 1)
    has_atmos = atmos >= deploy_min
    has_ground_cover = has_land or has_atmos
    atmos_substitutes_land = has_atmos and not has_land
    meta = {
        "has_space": has_space,
        "has_land": has_land,
        "has_atmospheric": has_atmos,
        "has_ground_cover": has_ground_cover,
        "atmos_substitutes_land": atmos_substitutes_land,
        "extra": [],
        "deployable_count": 0,
    }
    if not has_space or not has_ground_cover:
        pts = int(terr_cfg.get("missing_space_or_land_penalty", -3))
        return pts, meta

    pts = 0
    deployable = 0
    for key in TERRAIN_KEYS:
        if int(terrain.get(key, 1) or 1) >= deploy_min:
            deployable += 1
    meta["deployable_count"] = deployable
    extra_keys = terr_cfg.get("extra_terrain_keys") or ["Atmospheric", "Underwater", "Sea"]
    per = int(terr_cfg.get("extra_terrain_points", 1))
    for key in extra_keys:
        lvl = int(terrain.get(key, 1) or 1)
        if lvl < deploy_min:
            continue
        # Atmos already satisfied the Land/Atmos floor — do not also award +1 extra
        if key == "Atmospheric" and atmos_substitutes_land:
            continue
        pts += per
        meta["extra"].append(key)
    perfect_min = int(terr_cfg.get("perfect_min_deployable", 4) or 4)
    if deployable >= perfect_min:
        pts += int(terr_cfg.get("perfect_bonus", 1) or 0)
        meta["perfect"] = True
    return pts, meta


def support_debuff_kinds_points(rules: dict, role: str, features: dict) -> int | None:
    """Defense/Support only. Returns points, or None if role does not score this axis."""
    if role not in ("Defense", "Support"):
        return None
    kinds_cfg = (rules.get("support_debuffs_kinds") or {}).get(role)
    if isinstance(kinds_cfg, dict) and ("0" in kinds_cfg or "2_or_more" in kinds_cfg):
        min_range = int(kinds_cfg.get("min_range", 4 if role == "Defense" else 5) or 4)
        tbl = kinds_cfg
    else:
        # Legacy flat table
        min_range = 5 if role == "Support" else 4
        legacy = rules.get("support_debuffs_at_range_4") or {}
        if role == "Defense":
            tbl = {
                "0": 0,
                "1": int(legacy.get("1", 0)),
                "2_or_more": int(legacy.get("2_or_more", 1)),
            }
        else:
            tbl = legacy
    feat_key = f"support_debuffs_range{min_range}_count"
    if feat_key in features:
        n = int(features.get(feat_key) or 0)
    elif min_range == 5 and "support_debuffs_range4_count" in features:
        # Older feature payloads lacked the R5 counter — treat as no R5 kinds
        n = 0
    else:
        n = int(features.get("support_debuffs_range4_count") or 0)
    if n >= 2:
        return int(tbl.get("2_or_more", 1))
    return int(tbl.get(str(n), 0 if n == 1 else (-1 if role == "Support" else 0)))


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
    """Legacy blob regex scorer (kept for tests). Prefer score_ability_effects."""
    abil_cfg = rules.get("ability") or {}
    excl = [str(x).lower() for x in (abil_cfg.get("exclude_name_substrings") or [])]
    ignore_stat = bool(abil_cfg.get("ignore_pure_stat_passives", False))
    tension_re = re.compile(abil_cfg.get("tension_gate_regex") or r"$a")
    tension_scale = float(abil_cfg.get("tension_gated_points_scale", 0) or 0)
    family_pats = [
        re.compile(p) for p in ((abil_cfg.get("effect_families") or {}).get(role) or [])
    ]
    great_pats = [
        re.compile(p) for p in ((abil_cfg.get("great_for_role") or {}).get(role) or [])
    ]
    kept: list[str] = []
    skipped_stat = 0
    skipped_tension = 0
    for blob in ability_blobs or []:
        text = str(blob or "")
        low = text.lower()
        if any(x and x in low for x in excl):
            continue
        if ignore_stat and _is_pure_stat_passive(text):
            skipped_stat += 1
            continue
        if tension_re.search(text) and tension_scale <= 0:
            skipped_tension += 1
            continue
        if text.strip():
            kept.append(text)
    if not kept:
        return 0, {
            "count": 0,
            "great": 0,
            "skipped_stat": skipped_stat,
            "skipped_tension": skipped_tension,
            "heuristic": True,
        }
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
    return pts, {
        "count": len(kept),
        "great": great,
        "skipped_stat": skipped_stat,
        "skipped_tension": skipped_tension,
        "heuristic": True,
    }


def _ability_name_excluded(rules: dict, name: str) -> bool:
    cfg = rules.get("ability_structured") or rules.get("ability") or {}
    excl = [str(x).lower() for x in (cfg.get("exclude_name_substrings") or []) if str(x).strip()]
    low = str(name or "").lower()
    return any(x and x in low for x in excl)


def _cond_id_active(raw) -> bool:
    s = str(raw or "").strip()
    return bool(s) and s not in ("0", "None", "none")


def _points_for_trait_type(
    rules: dict,
    role: str,
    tti: int,
    has_active_cond: bool,
    trait_value: int | float = 0,
) -> int:
    cfg = rules.get("ability_structured") or {}
    tti = int(tti or 0)
    if not tti:
        return 0
    if tti in {int(x) for x in (cfg.get("zero_types") or [])}:
        return 0
    # Owned by the extra_life axis (Unbreakable etc.) — do not double-count
    el_types = {
        int(x) for x in ((rules.get("extra_life") or {}).get("structured_trait_types") or [])
    }
    if tti in el_types:
        return 0
    permanent = {int(x) for x in (cfg.get("permanent_stat_types") or [])}
    if tti in permanent and not has_active_cond:
        return 0
    # Prefer magnitude bands when present for this role+type
    mag_tbl = ((cfg.get("magnitude_points") or {}).get(role) or {}).get(str(tti))
    if mag_tbl:
        return int(band_points(mag_tbl, abs(float(trait_value or 0))))
    role_map = (cfg.get("role_points") or {}).get(role) or {}
    return int(role_map.get(str(tti), 0) or 0)


def score_ability_effects(
    rules: dict, role: str, effects: list[dict] | None
) -> tuple[int, dict]:
    """Score unit/pilot ability traits from TraitTypeIndex (0–cap)."""
    cfg = rules.get("ability_structured") or {}
    cap = int(cfg.get("cap", 3) or 3)
    by_type: dict[int, dict] = {}
    for eff in effects or []:
        tti = int(eff.get("trait_type_index") or 0)
        if not tti:
            continue
        has_cond = bool(eff.get("has_active_cond"))
        tval = int(eff.get("trait_value") or 0)
        pts = _points_for_trait_type(rules, role, tti, has_cond, tval)
        prev = by_type.get(tti)
        if prev is None or pts > int(prev.get("points") or 0) or (
            pts == int(prev.get("points") or 0)
            and abs(tval) > abs(int(prev.get("trait_value") or 0))
        ):
            by_type[tti] = {
                "trait_type_index": tti,
                "trait_type_key": eff.get("trait_type_key") or "",
                "trait_value": tval,
                "has_active_cond": has_cond,
                "points": pts,
            }
    contributing = [v for v in by_type.values() if int(v.get("points") or 0) > 0]
    total = min(cap, sum(int(v["points"]) for v in contributing))
    return total, {
        "count": len(by_type),
        "contributing": contributing,
        "cap": cap,
        "heuristic": False,
        "structured": True,
    }


def effects_have_movement_followup(rules: dict, effects: list[dict] | None) -> bool:
    move_types = {
        int(x) for x in ((rules.get("ability_structured") or {}).get("movement_types") or [])
    }
    if not move_types:
        move_types = {19, 70, 80, 85, 107}
    for eff in effects or []:
        if int(eff.get("trait_type_index") or 0) in move_types:
            return True
    return False


def _trait_set_ids_for_ability(A, ab_id: str) -> list[str]:
    tsid = A.normalize_id(A.abil_link_map.get(ab_id, ab_id))
    if not tsid or tsid == "0":
        return []
    lookup_id = tsid[:-2] if len(tsid) > 2 else tsid
    tids = A.trait_set_traits_map.get(tsid, []) or A.trait_set_traits_map.get(lookup_id, [])
    return [A.normalize_id(t) for t in (tids or []) if A.normalize_id(t) not in ("", "0")]


def _effects_from_trait_ids(A, trait_ids: list[str]) -> list[dict]:
    out: list[dict] = []
    seen: set[int] = set()
    for tid in trait_ids:
        tdata = A.trait_data_map.get(tid, {}) or {}
        tti = int(tdata.get("trait_type_index") or 0)
        if not tti or tti in seen:
            continue
        seen.add(tti)
        out.append(
            {
                "trait_id": tid,
                "trait_type_index": tti,
                "trait_type_key": tdata.get("trait_type_key") or "",
                "trait_type_label": tdata.get("trait_type_label") or "",
                "trait_value": int(tdata.get("trait_value") or 0),
                "has_active_cond": _cond_id_active(tdata.get("active_cond_id")),
            }
        )
    return out


def _ability_display_name(A, ab_id: str, lc: str) -> str:
    ldc = A.LANG_DATA.get(lc) or {}
    anm = ldc.get("abil_name_map") or {}
    name = anm.get(A.normalize_id(ab_id)) or anm.get(ab_id) or ""
    if isinstance(name, dict):
        name = name.get("name") or name.get("text") or ""
    return str(name or "")


def collect_unit_ability_effects(
    A, uid: str, mode: str = "sp", lc: str = "EN", rules: dict | None = None
) -> list[dict]:
    """Unique TraitType effects for a unit's abilities (SSP replaces + gains in ssp mode)."""
    rules = rules or load_rules()
    merged: dict[int, dict] = {}
    ability_ids: list[str] = []
    replace_map = {}
    if mode == "ssp":
        replace_map = A.unit_ssp_abil_replace_map.get(uid, {}) or {}
    for ab in A.unit_abil_map.get(uid, []) or []:
        ab_id = A.normalize_id(ab.get("id"))
        if mode == "ssp" and ab_id in replace_map:
            ab_id = A.normalize_id(replace_map.get(ab_id))
        ability_ids.append(ab_id)
    if mode == "ssp":
        for abid in A.unit_ssp_abil_gain_list.get(uid, []) or []:
            ability_ids.append(A.normalize_id(abid))
    for ab_id in ability_ids:
        if not ab_id or ab_id == "0":
            continue
        name = _ability_display_name(A, ab_id, lc)
        if _ability_name_excluded(rules, name):
            continue
        for eff in _effects_from_trait_ids(A, _trait_set_ids_for_ability(A, ab_id)):
            tti = int(eff["trait_type_index"])
            prev = merged.get(tti)
            if prev is None or int(eff.get("trait_value") or 0) >= int(prev.get("trait_value") or 0):
                row = dict(eff)
                row["ability_id"] = ab_id
                row["ability_name"] = name
                merged[tti] = row
    return list(merged.values())


def collect_character_ability_effects(
    A, cid: str, lc: str = "EN", rules: dict | None = None
) -> list[dict]:
    """Unique TraitType effects for a character's SP/normal abilities (excl. affinity names)."""
    rules = rules or load_rules()
    merged: dict[int, dict] = {}
    try:
        fa = [
            x
            for x in A.extract_data_list(A.char_abil)
            if A.normalize_id(x.get("CharacterId", "")) == cid
        ]
    except Exception:
        fa = []
    for ab in fa:
        bid = A.normalize_id(ab.get("AbilityId", ""))
        spid = A.normalize_id(ab.get("SpAbilityId") or ab.get("spAbilityId") or "0")
        use_id = spid if spid and spid not in ("0", "None", bid) else bid
        if not use_id or use_id == "0":
            continue
        name = _ability_display_name(A, use_id, lc)
        is_aff = False
        try:
            is_aff = bool(A._name_indicates_affinity_ability(name))
        except Exception:
            is_aff = bool(re.search(r"(?i)affinity|勢力|シリーズ", name))
        if is_aff or _ability_name_excluded(rules, name):
            continue
        for eff in _effects_from_trait_ids(A, _trait_set_ids_for_ability(A, use_id)):
            tti = int(eff["trait_type_index"])
            prev = merged.get(tti)
            if prev is None or int(eff.get("trait_value") or 0) >= int(prev.get("trait_value") or 0):
                row = dict(eff)
                row["ability_id"] = use_id
                row["ability_name"] = name
                merged[tti] = row
    return list(merged.values())


_char_skill_trait_cache: dict[str, Any] | None = None


def _load_char_skill_trait_maps(A) -> dict[str, Any]:
    """skill_id -> [{trait_type_index, trait_value, ...}] from master skill trait tables."""
    global _char_skill_trait_cache
    if _char_skill_trait_cache is not None:
        return _char_skill_trait_cache

    def _rows(raw) -> list:
        if raw is None:
            return []
        if hasattr(A, "extract_data_list"):
            try:
                return list(A.extract_data_list(raw) or [])
            except Exception:
                pass
        if isinstance(raw, list):
            return raw
        if isinstance(raw, dict):
            return list(raw.get("Data") or raw.get("data") or [])
        return []

    trait_by_id: dict[str, dict] = {}
    for item in _rows(getattr(A, "skill_trait_base", None)):
        if not isinstance(item, dict):
            continue
        tid = A.normalize_id(item.get("Id") or item.get("id"))
        if not tid or tid == "0":
            continue
        tti = int(item.get("TraitTypeIndex") or item.get("traitTypeIndex") or 0)
        trait_by_id[tid] = {
            "trait_id": tid,
            "trait_type_index": tti,
            "trait_value": int(item.get("TraitValue") or item.get("traitValue") or 0),
        }
    set_to_traits: dict[str, list[str]] = {}
    base_dir = getattr(A, "BASE_DIR", None) or str(ROOT / "data" / "EN" / "master")
    set_path = Path(base_dir) / "m_character_skill_trait_set.json"
    try:
        raw_set = json.loads(set_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raw_set = []
    for item in _rows(raw_set):
        if not isinstance(item, dict):
            continue
        sid = A.normalize_id(item.get("Id") or item.get("id"))
        tid = A.normalize_id(
            item.get("CharacterSkillTraitId") or item.get("characterSkillTraitId")
        )
        if sid and sid != "0" and tid and tid != "0":
            set_to_traits.setdefault(sid, []).append(tid)
    skill_to_effects: dict[str, list[dict]] = {}
    skill_base = getattr(A, "char_skill_base_data", None)
    for item in _rows(skill_base):
        if not isinstance(item, dict):
            continue
        skid = A.normalize_id(item.get("Id") or item.get("id"))
        set_id = A.normalize_id(
            item.get("CharacterSkillTraitSetId") or item.get("characterSkillTraitSetId")
        )
        if not skid or skid == "0" or not set_id or set_id == "0":
            continue
        effects = []
        seen = set()
        for tid in set_to_traits.get(set_id, []):
            tr = trait_by_id.get(tid)
            if not tr:
                continue
            tti = int(tr.get("trait_type_index") or 0)
            if not tti or tti in seen:
                continue
            seen.add(tti)
            effects.append(dict(tr))
        if effects:
            skill_to_effects[skid] = effects
    _char_skill_trait_cache = {
        "trait_by_id": trait_by_id,
        "set_to_traits": set_to_traits,
        "skill_to_effects": skill_to_effects,
    }
    return _char_skill_trait_cache


def collect_character_skill_effects(A, cid: str) -> list[dict]:
    """Active skill CharacterSkillTraitType effects for a character (deduped by type)."""
    maps = _load_char_skill_trait_maps(A)
    skill_map = maps.get("skill_to_effects") or {}
    merged: dict[int, dict] = {}
    try:
        fs = [
            x
            for x in A.extract_data_list(A.char_skill)
            if A.normalize_id(x.get("CharacterId", "")) == cid
        ]
    except Exception:
        fs = []
    for sk in fs:
        for key in (
            "SkillId",
            "CharacterSkillId",
            "skillId",
            "SpSkillId",
            "spSkillId",
        ):
            sid = A.normalize_id(sk.get(key) or "")
            if not sid or sid == "0":
                continue
            for eff in skill_map.get(sid) or []:
                tti = int(eff.get("trait_type_index") or 0)
                if not tti:
                    continue
                prev = merged.get(tti)
                if prev is None or int(eff.get("trait_value") or 0) >= int(
                    prev.get("trait_value") or 0
                ):
                    row = dict(eff)
                    row["skill_id"] = sid
                    merged[tti] = row
    return list(merged.values())


def score_pilot_skill_effects(
    rules: dict, role: str, specialty: str, effects: list[dict] | None
) -> tuple[int, dict]:
    cfg = rules.get("pilot_skill_structured") or {}
    role_map = (cfg.get("role_points") or {}).get(role) or {}
    mag_tbl_role = (cfg.get("magnitude_points") or {}).get(role) or {}
    spec_types = cfg.get("specialty_types") or {}
    spec_tti = int(spec_types.get(specialty) or 0)
    spec_bonus = int(cfg.get("specialty_bonus", 1) or 1)
    lines = []
    total = 0
    for eff in effects or []:
        tti = int(eff.get("trait_type_index") or 0)
        tval = abs(int(eff.get("trait_value") or 0))
        mag_bands = mag_tbl_role.get(str(tti))
        if mag_bands:
            pts = int(band_points(mag_bands, tval))
        else:
            pts = int(role_map.get(str(tti), 0) or 0)
        if spec_tti and tti == spec_tti:
            pts += spec_bonus
        if pts <= 0:
            continue
        total += pts
        lines.append(
            {
                "trait_type_index": tti,
                "trait_value": int(eff.get("trait_value") or 0),
                "points": pts,
                "skill_id": eff.get("skill_id") or "",
            }
        )
    return total, {"lines": lines, "structured": True, "heuristic": False}


def score_pilot_kit_structured(
    rules: dict,
    role: str,
    specialty: str,
    ability_effects: list[dict] | None,
    skill_effects: list[dict] | None,
    affinity_count: int = 0,
) -> tuple[int, dict]:
    """Combined pilot kit points from structured ability + skill traits (capped)."""
    abil_pts, abil_meta = score_ability_effects(rules, role, ability_effects)
    # Ability axis for pilots is uncapped by unit cap — re-sum contributing without unit cap
    cfg = rules.get("ability_structured") or {}
    by_type: dict[int, int] = {}
    for eff in ability_effects or []:
        tti = int(eff.get("trait_type_index") or 0)
        pts = _points_for_trait_type(
            rules,
            role,
            tti,
            bool(eff.get("has_active_cond")),
            int(eff.get("trait_value") or 0),
        )
        if pts > by_type.get(tti, 0):
            by_type[tti] = pts
    abil_raw = sum(by_type.values())
    skill_pts, skill_meta = score_pilot_skill_effects(
        rules, role, specialty, skill_effects
    )
    aff_each = int(rules.get("series_affinity_points_each", 3))
    # affinity counted separately in score_pilot_features
    raw = abil_raw + skill_pts
    cap = int(rules.get("pilot_kit_cap", 14) or 14)
    capped = min(cap, raw)
    return capped, {
        "ability_points": abil_raw,
        "skill_points": skill_pts,
        "raw": raw,
        "cap": cap,
        "abilities": abil_meta,
        "skills": skill_meta,
        "affinity_count": affinity_count,
        "affinity_points_each": aff_each,
        "structured": True,
        "heuristic": False,
    }


_weapon_trait_meta_cache: dict[str, dict] | None = None
_status_trait_raw_cache: dict[str, dict] | None = None
_twc_attr_cache: dict[str, set[int]] | None = None


def clear_structured_effect_caches() -> None:
    global _char_skill_trait_cache, _weapon_trait_meta_cache, _status_trait_raw_cache
    global _twc_attr_cache
    _char_skill_trait_cache = None
    _weapon_trait_meta_cache = None
    _status_trait_raw_cache = None
    _twc_attr_cache = None


def _status_trait_raw_by_id(A) -> dict[str, dict]:
    global _status_trait_raw_cache
    if _status_trait_raw_cache is not None:
        return _status_trait_raw_cache
    out: dict[str, dict] = {}
    for item in A.extract_data_list(getattr(A, "trait_logic_data", None) or []):
        if not isinstance(item, dict):
            continue
        tid = A.normalize_id(item.get("Id") or item.get("id"))
        if not tid or tid == "0":
            continue
        out[tid] = item
    _status_trait_raw_cache = out
    return out


def _twc_weapon_attrs(A) -> dict[str, set[int]]:
    """TargetWeaponConditionId -> set of WeaponAttributeType ints (1 phys, 2 beam, 3 special)."""
    global _twc_attr_cache
    if _twc_attr_cache is not None:
        return _twc_attr_cache
    out: dict[str, set[int]] = {}
    base_dir = getattr(A, "BASE_DIR", None) or str(ROOT / "data" / "EN" / "master")
    path = Path(base_dir) / "m_trait_condition_target_weapon.json"
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raw = []
    rows = []
    if hasattr(A, "extract_data_list"):
        try:
            rows = list(A.extract_data_list(raw) or [])
        except Exception:
            rows = raw if isinstance(raw, list) else []
    elif isinstance(raw, list):
        rows = raw
    for item in rows:
        if not isinstance(item, dict):
            continue
        cid = A.normalize_id(item.get("Id") or item.get("id"))
        if not cid or cid == "0":
            continue
        attrs: set[int] = set()
        for part in str(item.get("WeaponAttributeTypes") or "").split(","):
            part = part.strip()
            if part.isdigit():
                attrs.add(int(part))
        out[cid] = attrs
    _twc_attr_cache = out
    return out


def _weapon_trait_meta_by_id(A) -> dict[str, dict]:
    """weapon_trait_id -> structured meta (type, status, magnitude, attrs)."""
    global _weapon_trait_meta_cache
    if _weapon_trait_meta_cache is not None:
        return _weapon_trait_meta_cache
    status = _status_trait_raw_by_id(A)
    twc = _twc_weapon_attrs(A)
    out: dict[str, dict] = {}
    for item in A.extract_data_list(getattr(A, "weapon_trait_base_data", None) or []):
        if not isinstance(item, dict):
            continue
        tid = A.normalize_id(item.get("Id") or item.get("id"))
        if not tid or tid == "0":
            continue
        wtti = int(
            item.get("WeaponTraitTypeIndex") or item.get("weaponTraitTypeIndex") or 0
        )
        target = A.normalize_id(item.get("TargetValue") or item.get("targetValue") or "0")
        status_id = target if target and target != "0" and target in status else (
            tid if tid in status else ""
        )
        st = status.get(status_id) or {}
        st_tti = int(st.get("TraitTypeIndex") or st.get("traitTypeIndex") or 0)
        st_val = int(st.get("TraitValue") or st.get("traitValue") or 0)
        timing = int(st.get("ActionTimingTypeIndex") or 0)
        limit = int(st.get("Limit") or 0)
        twc_id = A.normalize_id(
            st.get("TargetWeaponConditionId") or st.get("targetWeaponConditionId") or "0"
        )
        attrs = set(twc.get(twc_id) or ())
        # ActiveConditionSetId can also encode phys/beam/special for damage-taken
        # (handled lightly via twc only for investment keys).
        magnitude = abs(st_val) if st else 0
        if wtti in (8, 9, 10, 11, 14) and target and target.isdigit():
            # Some non-debuff types store magnitude directly in TargetValue
            magnitude = abs(int(target))
        out[tid] = {
            "type_index": wtti,
            "status_trait_id": status_id,
            "status_type_index": st_tti,
            "status_value": st_val,
            "magnitude": magnitude,
            "timing": timing,
            "limit": limit,
            "twc_id": twc_id,
            "weapon_attrs": sorted(attrs),
        }
    _weapon_trait_meta_cache = out
    return out


def _weapon_trait_type_by_id(A) -> dict[str, int]:
    return {k: int(v.get("type_index") or 0) for k, v in _weapon_trait_meta_by_id(A).items()}


def classify_debuff_keys_from_meta(meta: dict) -> set[str]:
    """Map structured weapon-trait meta to browse/investment debuff keys."""
    keys: set[str] = set()
    wtti = int(meta.get("type_index") or 0)
    st_tti = int(meta.get("status_type_index") or 0)
    st_val = int(meta.get("status_value") or 0)
    attrs = set(meta.get("weapon_attrs") or [])
    timing = int(meta.get("timing") or 0)
    limit = int(meta.get("limit") or 0)

    if wtti == 13:
        keys.add("preemptive")
        return keys
    if wtti == 5:
        keys.add("absolute_hit")
        return keys
    if wtti == 9 and int(meta.get("magnitude") or 0) == 1:
        keys.add("mp_1")
        return keys

    # Piercing: PassiveTrait → lasting DEF down for this attack (timing 0, limit 0)
    if wtti == 3 and st_tti == 9 and st_val < 0 and timing == 0 and limit == 0:
        keys.add("enemy_def_atk")
        return keys

    if wtti != 12:
        return keys

    if st_val >= 0 and st_tti not in (68, 70):
        # Debuffs should reduce; skip ups
        if st_tti != 72:
            return keys

    if st_tti == 7 and st_val < 0:
        keys.add("atk_dn")
    elif st_tti == 9 and st_val < 0:
        keys.add("def_dn")
    elif st_tti == 11 and st_val < 0:
        keys.add("mob_dn")
    elif st_tti == 1 and st_val < 0:
        keys.add("acc_dn")
    elif st_tti == 72 and st_val < 0:
        # Range down — rare keys for phys/beam; awaken-only (twc 23) ignored for rare
        twc_id = str(meta.get("twc_id") or "0")
        if twc_id == "23":
            return keys
        if not attrs:
            keys.update({"range_phys", "range_beam"})
        else:
            if 1 in attrs:
                keys.add("range_phys")
            if 2 in attrs:
                keys.add("range_beam")
    elif st_tti == 14 and st_val < 0:
        if not attrs:
            keys.update({"dmg_phys", "dmg_beam", "dmg_spec"})
        else:
            if 1 in attrs:
                keys.add("dmg_phys")
            if 2 in attrs:
                keys.add("dmg_beam")
            if 3 in attrs:
                keys.add("dmg_spec")
    elif st_tti == 78 and st_val < 0:
        if not attrs:
            keys.update({"wp_phys", "wp_beam", "wp_spec"})
        else:
            if 1 in attrs:
                keys.add("wp_phys")
            if 2 in attrs:
                keys.add("wp_beam")
            if 3 in attrs:
                keys.add("wp_spec")
    return keys


def collect_unit_weapon_trait_ids(A, uid: str, mode: str = "sp") -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()
    gpm = getattr(A, "growth_pattern_map", None) or {}

    def _add_from_pattern(tsi: str) -> None:
        if not tsi or tsi == "0":
            return
        by_lv = (getattr(A, "weapon_trait_change_map", None) or {}).get(tsi) or {}
        for _lv, tids in by_lv.items():
            for tid in tids or []:
                nid = A.normalize_id(tid)
                if nid and nid not in seen:
                    seen.add(nid)
                    ids.append(nid)
        if tsi not in seen and tsi in _weapon_trait_meta_by_id(A):
            seen.add(tsi)
            ids.append(tsi)

    for wp in A.unit_weapon_map.get(uid, []) or []:
        wid = A.normalize_id(wp.get("id"))
        if mode != "ssp" and _weapon_is_ssp_custom_core_id(wid):
            continue
        wm = A.weapon_info_map.get(wid, {}) or {}
        wsid = A.normalize_id(wm.get("weapon_status_id") or wid)
        ws = A.weapon_status_map.get(wsid) or A.weapon_status_map.get(wid) or {}
        candidates = [
            A.normalize_id(ws.get("trait_correction_id") or "0"),
            wid,
            wsid,
            A.normalize_id(wm.get("main_weapon_id") or "0"),
        ]
        # EX / growth weapons often stash traits on WeaponLevelGrowthPatternSetId
        # → trait_change_set_id when OverrideWeaponTraitChangePatternSetId is 0.
        gi = A.normalize_id(ws.get("growth_pattern_id") or "0")
        if gi and gi != "0":
            gd = gpm.get(gi) or {}
            candidates.append(A.normalize_id(gd.get("trait_change_set_id") or "0"))
        for tsi in candidates:
            _add_from_pattern(tsi)
    # SSP weapon effect trait ids (Custom Core / SSP grant lines)
    if str(mode).lower() == "ssp":
        for wp in A.unit_weapon_map.get(uid, []) or []:
            wid = A.normalize_id(wp.get("id"))
            wm = A.weapon_info_map.get(wid, {}) or {}
            mwid = A.normalize_id(wm.get("main_weapon_id", "0") or "0")
            for cid in (wid, mwid):
                if not cid or cid == "0":
                    continue
                for tid in getattr(A, "unit_ssp_weapon_effect_map", {}).get(cid) or []:
                    nid = A.normalize_id(tid)
                    if nid and nid not in seen:
                        seen.add(nid)
                        ids.append(nid)
    return ids


def collect_unit_structured_debuff_keys(
    A, uid: str, mode: str = "sp"
) -> tuple[set[str], dict]:
    """Return (keys, meta) from WeaponTraitType + m_trait TargetValue resolution."""
    meta_by_id = _weapon_trait_meta_by_id(A)
    keys: set[str] = set()
    max_pierce = 0
    types: set[int] = set()
    for tid in collect_unit_weapon_trait_ids(A, uid, mode=mode):
        meta = meta_by_id.get(tid)
        if not meta:
            continue
        types.add(int(meta.get("type_index") or 0))
        classified = classify_debuff_keys_from_meta(meta)
        keys |= classified
        mag = abs(int(meta.get("magnitude") or 0))
        # Instant pierce (WeaponTraitType 3) and lasting DEF-down both feed debuff strength
        if "enemy_def_atk" in classified or "def_dn" in classified:
            max_pierce = max(max_pierce, mag)
        wtti = int(meta.get("type_index") or 0)
        if (
            wtti == 3
            and int(meta.get("status_type_index") or 0) == 9
            and int(meta.get("status_value") or 0) < 0
            and int(meta.get("timing") or 0) == 0
            and int(meta.get("limit") or 0) == 0
        ):
            max_pierce = max(max_pierce, mag)
    return keys, {
        "structured": True,
        "type_indices": sorted(types),
        "max_pierce_pct": max_pierce,
        "heuristic": False,
    }


def collect_unit_weapon_trait_type_indices(A, uid: str) -> set[int]:
    """WeaponTraitTypeIndex values attached to a unit's weapons via change patterns."""
    meta_by_id = _weapon_trait_meta_by_id(A)
    found: set[int] = set()
    for tid in collect_unit_weapon_trait_ids(A, uid):
        tti = int((meta_by_id.get(tid) or {}).get("type_index") or 0)
        if tti:
            found.add(tti)
    return found


def score_linked_pilot(rules: dict, has_linked: bool, linked_very_good: bool) -> tuple[int, dict]:
    """Deprecated: kept for older fixtures. Prefer score_affinity_pilots."""
    cfg = rules.get("linked_pilot") or {}
    heuristic = bool(cfg.get("heuristic", False))
    if not has_linked:
        return int(cfg.get("none_points", 0)), {"heuristic": heuristic, "status": "none"}
    if linked_very_good:
        return int(cfg.get("very_good_points", 1)), {"heuristic": heuristic, "status": "very_good"}
    return int(cfg.get("any_points", -1)), {"heuristic": heuristic, "status": "any"}


_AFFINITY_PILOT_POOL_CACHE: dict[str, list[dict]] = {}


def clear_affinity_pilot_pool_cache() -> None:
    _AFFINITY_PILOT_POOL_CACHE.clear()


def build_affinity_pilot_pool(A, rules: dict | None = None, lc: str = "EN") -> list[dict]:
    """
    Playable SSR+ pilots with piloting-tag affinity factions and/or EX unit pairs.
    Used to score how many high-quality affinity options a unit has.
    """
    rules = rules or load_rules()
    cfg = rules.get("affinity_pilots") or {}
    min_ri = int(cfg.get("min_rarity_index", 4) or 4)
    cache_key = f"{lc}:{min_ri}"
    cached = _AFFINITY_PILOT_POOL_CACHE.get(cache_key)
    if cached is not None:
        return cached

    playable = getattr(A, "char_list_playable_ids", None) or set()
    rows: list[dict] = []
    for cid, info in (getattr(A, "char_info_map", None) or {}).items():
        cid = A.normalize_id(cid)
        if not cid or cid == "0":
            continue
        if playable and cid not in playable:
            continue
        try:
            if hasattr(A, "entity_hidden_by_lr_schedule_lock") and A.entity_hidden_by_lr_schedule_lock(
                info.get("schedule_id", "0")
            ):
                continue
        except Exception:
            pass
        role_id = str(info.get("role", "0") or "0")
        if role_id not in ("1", "2", "3"):
            continue
        ri = int(info.get("rarity", 1) or 1)
        if ri < min_ri:
            continue
        factions: set = set()
        pair_uids: list[str] = []
        try:
            if hasattr(A, "_character_affinity_faction_set"):
                factions = set(A._character_affinity_faction_set(cid) or set())
            meta = A._scan_character_affinity_meta(cid) if hasattr(A, "_scan_character_affinity_meta") else {}
            if meta:
                factions.update(meta.get("tag_factions") or set())
                pair_uids = [A.normalize_id(u) for u in (meta.get("pair_unit_ids") or []) if u]
        except Exception:
            factions = set()
            pair_uids = []
        if not factions and not pair_uids:
            continue
        rows.append(
            {
                "id": cid,
                "role_id": role_id,
                "rarity_id": str(ri),
                "factions": frozenset(factions),
                "pair_unit_ids": frozenset(u for u in pair_uids if u and u != "0"),
            }
        )
    _AFFINITY_PILOT_POOL_CACHE[cache_key] = rows
    return rows


def count_affinity_pilots_for_unit(
    A,
    uid: str,
    unit_role_id: str,
    rules: dict | None = None,
    lc: str = "EN",
    pool: list[dict] | None = None,
) -> tuple[int, dict]:
    """How many quality affinity-matched pilots can unlock kit on this MS."""
    rules = rules or load_rules()
    cfg = rules.get("affinity_pilots") or {}
    require_same_role = bool(cfg.get("require_same_role", True))
    include_pairs = bool(cfg.get("include_ex_unit_pairs", True))
    uid = A.normalize_id(uid)
    pool = pool if pool is not None else build_affinity_pilot_pool(A, rules, lc)

    unit_factions: set = set()
    try:
        if hasattr(A, "_factions_for_playable_unit_ids"):
            unit_factions = set(A._factions_for_playable_unit_ids([uid], lc) or set())
    except Exception:
        unit_factions = set()

    matched: list[str] = []
    for p in pool:
        if require_same_role and str(p.get("role_id") or "") != str(unit_role_id or ""):
            continue
        hit = False
        if include_pairs and uid in (p.get("pair_unit_ids") or ()):
            hit = True
        elif unit_factions and (p.get("factions") or frozenset()) & unit_factions:
            hit = True
        if hit:
            matched.append(str(p.get("id") or ""))

    return len(matched), {
        "count": len(matched),
        "unit_factions": sorted(unit_factions)[:16],
        "sample_pilot_ids": matched[:12],
        "require_same_role": require_same_role,
    }


def score_affinity_pilots(rules: dict, count: int, meta_extra: dict | None = None) -> tuple[int, dict]:
    cfg = rules.get("affinity_pilots") or {}
    bands = cfg.get("count_bands")
    if not bands:
        # Legacy fallback
        return 0, {"count": int(count or 0), "legacy": True}
    pts = band_points(bands, int(count or 0))
    meta = {"count": int(count or 0), "points": pts}
    if meta_extra:
        meta.update(meta_extra)
    return pts, meta


def score_features(features: dict, rules: dict | None = None, mode: str = "sp") -> dict:
    """
    Score a unit from a normalized feature dict (v5 unit criteria).

    Required keys: role, terrain, has_transform, map_ammo, map_coverage_cells,
    ability_blobs, has_linked_pilot, linked_pilot_very_good, has_shield,
    HP, ATK, DEF, MOB, MOV, weapon_range, weapon_power,
    has_max_tension_higher_weapon, has_preemptive, has_rare_debuff,
    has_extra_life, max_debuff_pct, support_debuffs_range4_count,
    weapon_bonus_type, er_expert_eligible_count (optional).
    """
    rules = rules or load_rules()
    role = features.get("role") or "Attack"
    if role not in ("Attack", "Defense", "Support"):
        role = "Attack"
    breakdown: dict[str, Any] = {}
    meta: dict[str, Any] = {"heuristic_keys": []}

    # Tag count bands (disabled) + strategic UR-weight tags
    scored_tags = features.get("scored_tags")
    if scored_tags is None:
        scored_tags = filter_scored_unit_tags(rules, features.get("tags") or [])
    tag_n = int(
        features.get("tag_count_scored")
        if features.get("tag_count_scored") is not None
        else len(scored_tags)
    )
    breakdown["tags"] = tag_count_points(rules, tag_n)
    meta["scored_tag_count"] = tag_n

    tag_table = features.get("tag_strategic_table")
    st_pts, st_meta = strategic_tag_points(rules, features.get("tags") or scored_tags, tag_table)
    # Legacy curated weight only if strategic config absent
    if not (rules.get("tag_strategic") or {}):
        tw_pts, tw_meta = tag_weight_points(rules, features.get("tags") or [])
        breakdown["tags_weight"] = tw_pts
        if tw_pts:
            meta["tags_weight"] = tw_meta
            meta["heuristic_keys"].append("tags_weight")
        breakdown["tags_strategic"] = 0
    else:
        breakdown["tags_weight"] = 0
        breakdown["tags_strategic"] = st_pts
        meta["tags_strategic"] = st_meta
        if st_pts:
            meta["heuristic_keys"].append("tags_strategic")

    # ER Expert access
    er_n = int(features.get("er_expert_eligible_count") or 0)
    breakdown["er_access"] = er_access_points(rules, er_n)
    meta["er_expert_eligible_count"] = er_n

    # Terrain coverage
    terr_pts, terr_meta = terrain_coverage_points(
        rules, features.get("terrain") or {}, role=role
    )
    breakdown["terrain"] = terr_pts
    meta["terrain"] = terr_meta

    # Transform
    # Transform — only when alt form gains strategic tools vs base
    tr_pts, tr_meta = score_transform(rules, features)
    breakdown["transform"] = tr_pts
    if tr_meta:
        meta["transform"] = tr_meta

    # MAP presence + dash + multi-ammo + coverage (capped)
    has_map = bool(features.get("has_map_weapon")) or int(features.get("map_ammo") or 0) > 0
    presence_pts = int(rules.get("map_presence_points", 1) or 0) if has_map else 0
    dash_pts = (
        int(rules.get("map_dash_points", 1) or 0)
        if features.get("has_dash_map")
        else 0
    )
    map_ammo = int(features.get("map_ammo") or 0)
    ammo_key = str(min(max(map_ammo, 0), 4))
    map_tbl = rules.get("map_ammo_points") or {}
    if ammo_key in map_tbl:
        ammo_pts = int(map_tbl.get(ammo_key, 0))
    elif map_ammo >= 2:
        ammo_pts = int(map_tbl.get("2", 1))
    else:
        ammo_pts = 0
    cov_pts = map_coverage_points(rules, int(features.get("map_coverage_cells") or 0))
    map_pts = presence_pts + dash_pts + ammo_pts + cov_pts
    cap_by_role = rules.get("map_axis_cap_by_role") or {}
    if role in cap_by_role:
        cap = int(cap_by_role.get(role, rules.get("map_axis_cap", 4)) or 4)
    else:
        cap = int(rules.get("map_axis_cap", 4) or 4)
    if map_pts > cap:
        map_pts = cap
    breakdown["map"] = map_pts
    meta["map"] = {
        "presence_points": presence_pts,
        "dash_points": dash_pts,
        "ammo_points": ammo_pts,
        "coverage_points": cov_pts,
        "cells": int(features.get("map_coverage_cells") or 0),
        "has_dash_map": bool(features.get("has_dash_map")),
    }

    # Abilities — structured TraitType when ability_effects is provided
    if features.get("ability_effects") is not None and rules.get("ability_structured"):
        abil_pts, abil_meta = score_ability_effects(
            rules, role, features.get("ability_effects") or []
        )
        breakdown["abilities"] = abil_pts
        meta["abilities"] = abil_meta
    else:
        abil_pts, abil_meta = score_abilities(
            rules, role, features.get("ability_blobs") or []
        )
        breakdown["abilities"] = abil_pts
        meta["abilities"] = abil_meta
        meta["heuristic_keys"].append("abilities")

    # Affinity pilot pool — SSR+ same-role pilots whose affinity matches this MS
    if "affinity_pilot_count" in features:
        aff_n = int(features.get("affinity_pilot_count") or 0)
        lp_pts, lp_meta = score_affinity_pilots(
            rules, aff_n, features.get("affinity_pilot_meta")
        )
        breakdown["linked_pilot"] = lp_pts  # keep key for UI compatibility
        meta["linked_pilot"] = lp_meta
        meta["affinity_pilots"] = lp_meta
    elif (rules.get("affinity_pilots") or {}).get("count_bands"):
        lp_pts, lp_meta = score_affinity_pilots(rules, 0, None)
        breakdown["linked_pilot"] = lp_pts
        meta["linked_pilot"] = lp_meta
        meta["affinity_pilots"] = lp_meta
    else:
        lp_pts, lp_meta = score_linked_pilot(
            rules,
            bool(features.get("has_linked_pilot")),
            bool(features.get("linked_pilot_very_good")),
        )
        breakdown["linked_pilot"] = lp_pts
        meta["linked_pilot"] = lp_meta
        if lp_meta.get("heuristic"):
            meta["heuristic_keys"].append("linked_pilot")

    breakdown["max_tension_weapon"] = (
        int(rules.get("max_tension_higher_tier_weapon_points", -1))
        if features.get("has_max_tension_higher_weapon")
        else 0
    )
    breakdown["preemptive"] = (
        int(rules.get("preemptive_strike_points", 1)) if features.get("has_preemptive") else 0
    )

    rare_pts = int(rules.get("rare_debuff_points", 1)) if features.get("has_rare_debuff") else 0
    breakdown["rare_debuff"] = rare_pts
    if rare_pts and str(features.get("debuff_keys_source") or "").startswith("text"):
        meta["heuristic_keys"].append("rare_debuff")
    elif rare_pts:
        meta["rare_debuff"] = {"structured": True, "source": features.get("debuff_keys_source")}

    el_pts = 0
    if features.get("has_extra_life"):
        el_pts = int((rules.get("extra_life") or {}).get(role, 1))
        if features.get("extra_life_source") == "prose":
            meta["heuristic_keys"].append("extra_life")
        else:
            meta["extra_life"] = {"structured": True, "source": features.get("extra_life_source")}
    breakdown["extra_life"] = el_pts

    r4_pts = support_debuff_kinds_points(rules, role, features)
    if r4_pts is not None:
        breakdown["support_r4_debuffs"] = int(r4_pts)

    for key, feat_key in (("HP", "HP"), ("ATK", "ATK"), ("DEF", "DEF"), ("MOB", "MOB")):
        bands = ((rules.get("stat_bands") or {}).get(key) or {}).get(role) or []
        breakdown[key.lower()] = band_points(bands, features.get(feat_key) or 0)

    # EN: SSP Attack upside-only (SP and non-Attack stay 0 unless bands say otherwise)
    en_modes = {str(m) for m in (rules.get("en_stat_modes") or ["ssp"])}
    if str(mode) in en_modes:
        en_bands = ((rules.get("stat_bands") or {}).get("EN") or {}).get(role) or []
        breakdown["en"] = band_points(en_bands, features.get("EN") or 0)
    else:
        breakdown["en"] = 0

    outlier_pts, outlier_meta = score_stat_outlier(rules, features, role, mode)
    breakdown["stat_outlier"] = outlier_pts
    if outlier_pts:
        meta["stat_outlier"] = outlier_meta

    sd_pts, sd_meta = score_special_defense(rules, features.get("special_defense_kinds") or [])
    breakdown["special_defense"] = sd_pts
    if sd_pts or sd_meta.get("count"):
        meta["special_defense"] = sd_meta

    ur_dep = bool(features.get("ur_pilot_dependent"))
    ur_pts, ur_meta = score_ur_pilot_dependence(rules, ur_dep)
    breakdown["ur_pilot_dependence"] = ur_pts
    if ur_dep or ur_pts:
        meta["ur_pilot_dependence"] = {
            **ur_meta,
            **(features.get("ur_pilot_dependence_meta") or {}),
        }

    sh = (rules.get("shield") or {}).get(role) or {}
    breakdown["shield"] = int(sh.get("has", 0) if features.get("has_shield") else sh.get("missing", 0))

    mov = int(features.get("MOV") or 0)
    mov_key = str(max(3, min(6, mov))) if mov else "3"
    if mov < 3:
        mov_key = "3"
    breakdown["movement"] = lookup_role_table(rules.get("movement") or {}, role, mov_key, 0)
    mf_pts, mf_meta = movement_followup_points(rules, features)
    breakdown["movement_followup"] = mf_pts
    if mf_pts:
        meta["movement_followup"] = mf_meta
        if mf_meta.get("heuristic"):
            meta["heuristic_keys"].append("movement_followup")

    wr = int(features.get("weapon_range") or 0)
    wr_key = str(max(1, min(6, wr))) if wr else "1"
    breakdown["weapon_range"] = lookup_role_table(rules.get("weapon_range") or {}, role, wr_key, 0)
    power_bands = weapon_power_bands_for_mode(rules, mode, role)
    breakdown["weapon_power"] = band_points(power_bands, features.get("weapon_power") or 0)

    if role in ("Defense", "Support"):
        lvl = debuff_pct_to_level(rules, int(features.get("max_debuff_pct") or 0))
        tbl = (rules.get("max_debuff_level") or {}).get(role) or {}
        if lvl is None:
            breakdown["max_debuff"] = int(tbl.get("none", tbl.get("0", 0)))
        else:
            breakdown["max_debuff"] = int(tbl.get(str(lvl), 0))

    bonus_type = int(features.get("weapon_bonus_type") or 0)
    bonus_pts = int(features.get("weapon_bonus_points") or 0)
    if not bonus_type and features.get("best_weapon_trait_lines"):
        bonus_type, bonus_pts = detect_weapon_bonus_type(rules, features.get("best_weapon_trait_lines") or [])
    elif bonus_type and not features.get("weapon_bonus_points"):
        pts_map = ((rules.get("maxweapon_bonus") or {}).get("points_by_type") or {})
        bonus_pts = int(pts_map.get(str(bonus_type), 0) or 0)
    if not bonus_type and mode == "ssp" and int(features.get("ssp_weapon_conditional_count") or 0) > 0:
        bonus_type = 2
        bonus_pts = int(((rules.get("maxweapon_bonus") or {}).get("points_by_type") or {}).get("2", 1))
    ignore_hi_rng = int(
        ((rules.get("maxweapon_bonus") or {}).get("ignore_higher_range_when_max_range_lte", 0) or 0)
    )
    if bonus_type == 4 and wr <= ignore_hi_rng:
        bonus_type = 0
        bonus_pts = 0
    breakdown["weapon_bonus"] = bonus_pts
    if bonus_type:
        labels = ((rules.get("maxweapon_bonus") or {}).get("type_labels") or {})
        meta["weapon_bonus"] = {
            "type": bonus_type,
            "label": labels.get(str(bonus_type), str(bonus_type)),
            "structured": bool(features.get("weapon_bonus_structured")),
        }
        if not features.get("weapon_bonus_structured"):
            meta["heuristic_keys"].append("weapon_bonus")

    rarity_pts = rarity_adjustment_points(rules, features.get("rarity_id"))
    breakdown["rarity"] = rarity_pts

    # Acquisition: free/dev/event mild upside; gacha/assembly stays 0
    src = str(features.get("source") or "")
    src_pts = rules.get("source_bucket_points") or {}
    breakdown["source"] = int(src_pts.get(src, 0) or 0)

    # Strongest weapon uses 2+ of Ranged/Melee/Awaken (e.g. Enhanced ZZ)
    da = rules.get("dual_attack_attr") or {}
    min_attrs = int(da.get("min_types", 2) or 2)
    if int(features.get("best_attack_attr_count") or 0) >= min_attrs:
        breakdown["dual_attack_attr"] = int(da.get("points", 1) or 0)
    else:
        breakdown["dual_attack_attr"] = 0

    # Signature kits (Barbatos Lupus / Rex family)
    sig = rules.get("signature_weapon_units") or {}
    sig_ids = {str(x) for x in (sig.get("unit_ids") or [])}
    if str(features.get("id") or "") in sig_ids:
        breakdown["signature_weapon"] = int(sig.get("points", 0) or 0)
    else:
        breakdown["signature_weapon"] = 0

    # Large footprint (OccupiedAreaId 2) — mild upside (wider MAP/buff coverage)
    fp_tbl = rules.get("large_footprint") or {}
    if features.get("is_large_footprint"):
        breakdown["large_footprint"] = int(fp_tbl.get(role, 0) or 0)
    else:
        breakdown["large_footprint"] = 0

    total = int(sum(int(v) for v in breakdown.values()))
    letter = letter_for_total(rules, total)
    bucket = bucket_for_letter(rules, letter)
    detail_lines: list[dict] = []
    for c in (meta.get("abilities") or {}).get("contributing") or []:
        detail_lines.append(
            {
                "kind": "ability",
                "label": c.get("trait_type_key") or f"type {c.get('trait_type_index')}",
                "name": c.get("trait_type_key") or "",
                "points": int(c.get("points") or 0),
                "estimated": False,
                "trait_type_index": c.get("trait_type_index"),
                "trait_value": c.get("trait_value"),
            }
        )
    return {
        "total": total,
        "letter": letter,
        "bucket": bucket,
        "breakdown": breakdown,
        "meta": meta,
        "mode": mode,
        "role": role,
        "detail_lines": detail_lines,
    }


def _ability_blobs_for_unit(A, uid: str, lc: str, ld: dict, mode: str) -> list[str]:
    blobs: list[str] = []
    ldc = A.LANG_DATA.get(lc) or ld
    replace_map = (A.unit_ssp_abil_replace_map.get(uid, {}) or {}) if mode == "ssp" else {}
    for ab in A.unit_abil_map.get(uid, []) or []:
        base_id = str(ab.get("id") or "")
        use_id = str(replace_map.get(base_id) or replace_map.get(A.normalize_id(base_id)) or base_id)
        try:
            entry = A.build_ability_entry(
                use_id,
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
    map_coverage_cells = 0
    has_map_weapon = False
    has_dash_map = False
    has_after_move_map = False
    has_preemptive = False
    has_rare = False
    max_debuff_pct = 0
    support_debuff_kinds_r4: set[str] = set()
    support_debuff_kinds_r5: set[str] = set()
    rare_keys = set(rules.get("rare_debuff_keys") or [])
    best_weapon_trait_lines: list[str] = []
    best_weapon_id = ""
    best_weapon_wm: dict = {}
    best_attack_attr_count = 0
    structured_keys: set[str] = set()
    debuff_source = "text"
    map_require_damage = bool(rules.get("map_require_damage", True))
    map_min_power = int(rules.get("map_min_power", 1) or 1)

    try:
        structured_keys, s_meta = collect_unit_structured_debuff_keys(A, uid, mode=mode)
        debuff_source = "structured"
        if structured_keys & rare_keys:
            has_rare = True
        if "preemptive" in structured_keys:
            has_preemptive = True
        max_debuff_pct = max(max_debuff_pct, int(s_meta.get("max_pierce_pct") or 0))
    except Exception:
        structured_keys = set()
        s_meta = {}

    # Text fallback for Custom Core / orphan traits (union, does not replace structure)
    try:
        text_keys = A.collect_unit_weapon_debuff_keys(uid, ld, lc, stat_mode=mode) or set()
    except Exception:
        text_keys = set()
    debuff_keys = set(structured_keys) | set(text_keys)
    if debuff_keys & rare_keys:
        has_rare = True
    if "preemptive" in debuff_keys:
        has_preemptive = True
    if text_keys - structured_keys:
        debuff_source = "structured+text_fallback"

    for wp in A.unit_weapon_map.get(uid, []) or []:
        wid = A.normalize_id(wp.get("id"))
        # SSP Custom Core weapons (…80 MAP / …90 attack) only exist after SSP.
        if mode != "ssp" and _weapon_is_ssp_custom_core_id(wid):
            continue
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
        elif isinstance(levels, list):
            for lv in levels:
                if isinstance(lv, dict) and int(lv.get("level") or 0) == 5:
                    power = max(power, int(lv.get("power", 0) or 0))
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
        elif isinstance(levels, list):
            for lv in levels:
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
            # Non-damage MAP (e.g. Live Concert Zaku buff MAP) — skip for MAP axis
            if map_require_damage and power < map_min_power:
                continue
            has_map_weapon = True
            ammo = int(ws.get("ammo", 0) or wm.get("ammo", 0) or 0)
            if mode == "ssp":
                mwid = A.normalize_id(wm.get("main_weapon_id", "0") or "0")
                for cid in (wid, mwid):
                    for enh in A.unit_ssp_weapon_enhance_map.get(cid) or []:
                        if str(enh.get("type")) == "3":
                            ammo += int(enh.get("value", 0) or 0)
                    break
            map_ammo = max(map_ammo, ammo)
            cells = len(ws.get("map_coords") or [])
            shoot_cells = len(ws.get("shooting_coords") or [])
            if cells <= 0:
                raw_ws = A.weapon_status_map.get(
                    A.normalize_id(wm.get("weapon_status_id") or wid)
                ) or A.weapon_status_map.get(wid) or {}
                cells = len(raw_ws.get("map_coords") or [])
                if shoot_cells <= 0:
                    shoot_cells = len(raw_ws.get("shooting_coords") or [])
            try:
                mrt = int(A.normalize_id(wm.get("map_range_type", "0") or "0", "0"))
            except Exception:
                mrt = 0
            is_dash = bool(ws.get("is_dash")) or mrt == 4  # MovingAttack
            if is_dash:
                has_dash_map = True
                # Dash MAPs often store the practical line in shooting_coords.
                cells = max(cells, shoot_cells)
            map_coverage_cells = max(map_coverage_cells, cells)
            try:
                if A.is_map_weapon_after_move_unit_weapon(uid, wid, wt):
                    has_after_move_map = True
            except Exception:
                if (A.weapon_status_map.get(wid) or {}).get("map_can_use_after_move"):
                    has_after_move_map = True
        else:
            max_range = max(max_range, rx)
            aa = str(wm.get("attack_attribute") or "0")
            attr_keys = (getattr(A, "ATTACK_ATTR_SET_TYPE_KEYS", None) or {}).get(aa) or []
            attr_n = len(attr_keys)
            if power > max_power:
                max_power = power
                best_weapon_trait_lines = list(trait_lines)
                best_weapon_id = wid
                best_weapon_wm = wm
                best_attack_attr_count = attr_n
            if tension_max:
                max_power_tension = max(max_power_tension, power)
            else:
                max_power_unrestricted = max(max_power_unrestricted, power)
            if rx >= 4:
                for key in _support_debuff_kind_set(debuff_keys):
                    support_debuff_kinds_r4.add(key)
                    if rx >= 5:
                        support_debuff_kinds_r5.add(key)

    if max_power <= 0 or not has_map_weapon:
        try:
            for prev in A.build_unit_browse_map_weapon_previews(uid, stat_mode=mode, ld=ld, lc=lc) or []:
                prev_power = int(prev.get("power") or 0)
                if map_require_damage and prev_power < map_min_power:
                    continue
                has_map_weapon = True
                map_ammo = max(map_ammo, int(prev.get("ammo") or 0))
                cells = len(prev.get("map_coords") or [])
                shoot_cells = len(prev.get("shooting_coords") or [])
                if prev.get("is_dash") or str(prev.get("map_range_type") or "") == "4":
                    has_dash_map = True
                    cells = max(cells, shoot_cells)
                map_coverage_cells = max(map_coverage_cells, cells)
                if prev.get("map_can_use_after_move"):
                    has_after_move_map = True
        except Exception:
            pass

    for line in A.iter_unit_weapon_trait_texts(uid, ld, lc, stat_mode=mode) or []:
        try:
            b, v = A.parse_enemy_def_debuff_pcts_from_trait_text(line)
            max_debuff_pct = max(max_debuff_pct, int(b or 0), int(v or 0))
        except Exception:
            pass

    has_max_tension_higher = max_power_tension > max_power_unrestricted > 0
    strongest_trait_ids: list[str] | None = None
    from_strongest = bool(
        (rules.get("maxweapon_bonus") or {}).get("from_strongest_weapon_only", True)
    )
    if from_strongest and best_weapon_id:
        strongest_trait_ids = collect_weapon_trait_ids_for_weapon(
            A, best_weapon_id, best_weapon_wm, mode=mode
        )
    elif from_strongest:
        strongest_trait_ids = []
    else:
        strongest_trait_ids = collect_unit_weapon_trait_ids(A, uid, mode=mode)
    bonus_type, bonus_pts, bonus_meta = detect_weapon_bonus_structured(
        A, uid, rules, trait_ids=strongest_trait_ids
    )
    weapon_bonus_structured = bool(bonus_meta.get("structured") and bonus_type)
    if not bonus_type:
        bonus_type, bonus_pts = detect_weapon_bonus_type(rules, best_weapon_trait_lines)
        weapon_bonus_structured = False

    return {
        "weapon_range": max_range,
        "weapon_power": max_power,
        "map_ammo": map_ammo,
        "map_coverage_cells": map_coverage_cells,
        "has_map_weapon": has_map_weapon,
        "has_dash_map": has_dash_map,
        "has_after_move_map": has_after_move_map,
        "has_preemptive": has_preemptive,
        "has_rare_debuff": has_rare,
        "has_max_tension_higher_weapon": has_max_tension_higher,
        "max_debuff_pct": max_debuff_pct,
        "support_debuffs_range4_count": len(support_debuff_kinds_r4),
        "support_debuffs_range5_count": len(support_debuff_kinds_r5),
        "weapon_bonus_type": bonus_type,
        "weapon_bonus_points": bonus_pts,
        "weapon_bonus_structured": weapon_bonus_structured,
        "best_weapon_trait_lines": best_weapon_trait_lines[:12],
        "best_attack_attr_count": best_attack_attr_count,
        "debuff_keys_source": debuff_source,
        "debuff_keys_structured": sorted(structured_keys),
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


def _ur_recommend_pilot_dependence(A, uid: str, info: dict, rules: dict) -> tuple[bool, dict]:
    """True when the MS recommend / linked pilot is UR+ (peak kit often UR-gated)."""
    cfg = rules.get("ur_pilot_dependence") or {}
    min_ri = int(cfg.get("min_recommend_rarity_index", 5) or 5)
    cid = ""
    try:
        cid = A.resolve_unit_recommend_character_id(uid, info) or ""
    except Exception:
        cid = ""
    if not cid:
        return False, {"recommend_character_id": "", "recommend_rarity_index": 0}
    cinfo = A.char_info_map.get(cid, {}) or {}
    ri = int(cinfo.get("rarity", 1) or 1)
    is_ult = bool(cinfo.get("is_ultimate", False))
    dependent = ri >= min_ri or is_ult
    return dependent, {
        "recommend_character_id": str(cid),
        "recommend_rarity_index": ri,
        "recommend_is_ultimate": is_ult,
    }


def _special_defense_kinds(rules: dict, ability_effects: list[dict] | None) -> list[str]:
    """Distinct special-defense TraitType ids present on unit abilities (not the shield mechanism)."""
    cfg = rules.get("special_defense") or {}
    wanted = {int(x) for x in (cfg.get("trait_types") or [])}
    if not wanted:
        return []
    found: set[int] = set()
    for eff in ability_effects or []:
        try:
            tti = int(eff.get("trait_type_index") or eff.get("TraitTypeIndex") or 0)
        except (TypeError, ValueError):
            continue
        if tti in wanted:
            found.add(tti)
    return [str(x) for x in sorted(found)]


def score_special_defense(rules: dict, kinds: list[str] | None) -> tuple[int, dict]:
    cfg = rules.get("special_defense") or {}
    pts_tbl = cfg.get("points") or {}
    n = len(kinds or [])
    if n <= 0:
        pts = int(pts_tbl.get("0", 0) or 0)
    elif n == 1:
        pts = int(pts_tbl.get("1", 1) or 0)
    else:
        pts = int(pts_tbl.get("2_or_more", pts_tbl.get("2", 2)) or 0)
    labels = cfg.get("kind_labels") or {}
    return pts, {
        "kinds": list(kinds or []),
        "labels": [labels.get(k, k) for k in (kinds or [])],
        "count": n,
    }


def score_stat_outlier(rules: dict, features: dict, role: str, mode: str) -> tuple[int, dict]:
    """Small niche bonus when secondary stats are clearly exceptional for the role."""
    cfg = rules.get("stat_outlier") or {}
    cap = int(cfg.get("cap", 2) or 2)
    per = int(cfg.get("points_per_hit", 1) or 1)
    hits: list[dict] = []
    for row in (cfg.get("by_role") or {}).get(role) or []:
        modes = row.get("modes")
        if modes is not None and str(mode) not in {str(m) for m in modes}:
            continue
        stat = str(row.get("stat") or "")
        if not stat:
            continue
        try:
            min_v = int(row.get("min", 0) or 0)
        except (TypeError, ValueError):
            continue
        val = int(features.get(stat) or 0)
        if val >= min_v:
            hits.append({"stat": stat, "value": val, "min": min_v})
    pts = min(cap, per * len(hits))
    return pts, {"hits": hits, "cap": cap}


def score_ur_pilot_dependence(rules: dict, dependent: bool) -> tuple[int, dict]:
    cfg = rules.get("ur_pilot_dependence") or {}
    if dependent:
        pts = int(cfg.get("dependent_points", -1) or 0)
    else:
        pts = int(cfg.get("independent_points", 0) or 0)
    return pts, {"dependent": bool(dependent)}


def _has_extra_life(
    rules: dict,
    uid: str,
    ability_blobs: list[str],
    ability_effects: list[dict] | None = None,
) -> tuple[bool, str]:
    """
    Detect Unbreakable / revive-style survival.
    Prefer TraitType 84 (Unbreakable); fall back to allowlist + prose regex.
    Returns (has_extra_life, source) where source is structured|allowlist|prose|"".
    """
    cfg = rules.get("extra_life") or {}
    structured_types = {
        int(x) for x in (cfg.get("structured_trait_types") or [84])
    }
    for eff in ability_effects or []:
        try:
            tti = int(eff.get("trait_type_index") or eff.get("TraitTypeIndex") or 0)
        except (TypeError, ValueError):
            continue
        if tti in structured_types:
            return True, "structured"
    allow = set(str(x) for x in (cfg.get("unit_id_allowlist") or []))
    if uid in allow:
        return True, "allowlist"
    pat = cfg.get("ability_regex")
    if pat:
        rx = re.compile(pat)
        if any(rx.search(b or "") for b in ability_blobs):
            return True, "prose"
    return False, ""


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
    transform_gains: list[str] = []
    transform_meta: dict = {}
    if partner:
        _has_p, transform_gains, transform_meta = analyze_transform_gains(
            A,
            uid,
            info,
            partner,
            use_mode if use_mode in ("sp", "ssp") else "sp",
            lc,
            ld,
            rules,
            base_stats=stats,
        )
        has_transform = bool(_has_p) or has_transform
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
    ability_effects = collect_unit_ability_effects(
        A, uid, mode=use_mode if use_mode in ("sp", "ssp") else "sp", lc=lc, rules=rules
    )
    has_linked, linked_vg = _linked_pilot_flags(A, uid, info, rules)
    aff_n, aff_meta = count_affinity_pilots_for_unit(
        A, uid, role_id, rules=rules, lc=lc
    )
    has_shield = False
    try:
        has_shield = "1" in (A.collect_unit_mechanism_mids(info, uid) or set())
    except Exception:
        has_shield = False

    special_def_kinds = _special_defense_kinds(rules, ability_effects)
    ur_dep, ur_dep_meta = _ur_recommend_pilot_dependence(A, uid, info, rules)

    is_large_footprint = int(info.get("occupied_area_id") or 1) == 2

    wfeat = _weapon_features(A, uid, ld, lc, use_mode if use_mode in ("sp", "ssp") else "sp", rules)
    has_extra, extra_src = _has_extra_life(rules, uid, ability_blobs, ability_effects)

    has_extra_move_kit = effects_have_movement_followup(rules, ability_effects)
    extra_move_from_regex = False

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
        "has_transform_advantage": bool(transform_gains),
        "transform_gains": transform_gains,
        "transform_meta": transform_meta,
        "ability_blobs": ability_blobs,
        "ability_effects": ability_effects,
        "has_linked_pilot": has_linked,
        "linked_pilot_very_good": linked_vg,
        "affinity_pilot_count": aff_n,
        "affinity_pilot_meta": aff_meta,
        "has_shield": has_shield,
        "special_defense_kinds": special_def_kinds,
        "ur_pilot_dependent": ur_dep,
        "ur_pilot_dependence_meta": ur_dep_meta,
        "is_large_footprint": is_large_footprint,
        "HP": int(stats.get("HP") or 0),
        "EN": int(stats.get("EN") or 0),
        "ATK": int(stats.get("ATK") or 0),
        "DEF": int(stats.get("DEF") or 0),
        "MOB": int(stats.get("MOB") or 0),
        "MOV": int(stats.get("MOV") or stats.get("Move") or 0),
        "has_extra_life": has_extra,
        "extra_life_source": extra_src,
        "has_extra_move_kit": has_extra_move_kit,
        "extra_move_from_regex": extra_move_from_regex,
        "has_map": bool(wfeat.get("has_map_weapon")) or int(wfeat.get("map_ammo") or 0) > 0,
        **wfeat,
    }


def score_unit(
    A,
    uid: str,
    mode: str = "sp",
    lc: str = "EN",
    rules: dict | None = None,
    tag_strategic_table: dict | None = None,
    er_expert_ids: list[str] | None = None,
) -> dict | None:
    rules = rules or load_rules()
    feats = extract_unit_features(A, uid, mode=mode, lc=lc, rules=rules)
    if not feats:
        return None
    if feats.get("is_warship") and rules.get("exclude_warships", True):
        return None
    if tag_strategic_table is not None:
        feats["tag_strategic_table"] = tag_strategic_table
    elif rules.get("tag_strategic"):
        feats["tag_strategic_table"] = get_tag_strategic_table(A, rules, lc)
    if er_expert_ids is not None:
        elig = [sid for sid in er_expert_ids if entity_eligible_on_stage(A, uid, sid, kind="unit", lc=lc)]
        feats["er_expert_eligible_count"] = len(elig)
        feats["er_expert_ids"] = elig
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
        "detail_lines": scored.get("detail_lines") or [],
        "stats": {
            "HP": feats.get("HP"),
            "EN": feats.get("EN"),
            "ATK": feats.get("ATK"),
            "DEF": feats.get("DEF"),
            "MOB": feats.get("MOB"),
            "MOV": feats.get("MOV"),
        },
        "peaks_with_ur_pilot": bool(feats.get("ur_pilot_dependent")),
    }
    if feats.get("er_expert_ids") is not None:
        row["er_expert_ids"] = list(feats.get("er_expert_ids") or [])
    return row


def _fmt_points(pts) -> str:
    n = int(pts or 0)
    if n > 0:
        return f"+{n}"
    return str(n)


def _humanize_effect_name(raw: str) -> str:
    """Turn enum-ish CamelCase into short player-facing labels."""
    s = str(raw or "").strip()
    if not s:
        return ""
    spaced = re.sub(r"(?<!^)([A-Z])", r" \1", s.replace("_", " "))
    spaced = re.sub(r"\s+", " ", spaced).strip()
    replacements = (
        (r"(?i)\btrait type\b", "effect"),
        (r"(?i)\bcharacter skill trait type\b", "skill effect"),
        (r"(?i)\bweapon trait type\b", "weapon effect"),
        (r"(?i)\bweapon power high hp boost\b", "Weapon power rises with remaining HP"),
        (r"(?i)\bweapon power low hp boost\b", "Weapon power rises when HP is low"),
        (r"(?i)\bweapon power high mp boost\b", "Weapon power rises with MP"),
        (r"(?i)\bweapon power low mp boost\b", "Weapon power rises when MP is low"),
        (r"(?i)\bweapon power change proximity\b", "Weapon power (closer range)"),
        (r"(?i)\bweapon power change remoteness\b", "Weapon power (longer range)"),
        (r"(?i)\bdamage given correction rate\b", "Damage dealt"),
        (r"(?i)\bdamage taken correction rate\b", "Damage taken"),
        (r"(?i)\bcritical damage given correction rate\b", "Critical damage"),
        (r"(?i)\battack critical rate change rate\b", "Critical rate"),
        (r"(?i)\bguaranteed critical\b", "Guaranteed critical"),
    )
    out = spaced
    for pat, rep in replacements:
        out = re.sub(pat, rep, out)
    return out


def build_public_criteria(rules: dict | None = None) -> list[dict]:
    """
    User-facing objective criteria blocks derived from the live rules sheet.
    Keep this in sync with score_features / score_pilot_features axes.
    Each block includes ``roles`` (Attack/Defense/Support) for UI filtering.
    """
    rules = rules or load_rules()
    criteria: list[dict] = []
    ROLE_ALL = ["Attack", "Defense", "Support"]

    criteria.append(
        {
            "id": "buckets",
            "title": "Buckets from letters",
            "applies": ["units", "pilots"],
            "objective": True,
            "summary": "Point total maps to a letter, then to a bucket. Players mainly see buckets.",
            "rows": [
                {"when": "S+ or S", "result": "Recommended"},
                {"when": "A+ or A", "result": "Solid"},
                {"when": "B+ or B", "result": "Situational"},
                {"when": "C, D, or E", "result": "Niche"},
            ],
        }
    )

    criteria.append(
        {
            "id": "role_focus_attack",
            "title": "Attack priorities",
            "applies": ["units"],
            "objective": True,
            "summary": "Damage ceiling first (ATK + weapon power), then MOV/MAP. HP and SSP EN are upside-only — high is a bonus, low is not punished. MOB is a soft secondary.",
            "rows": [
                {"when": "Primary", "result": "ATK · weapon power · MOV"},
                {"when": "Upside only", "result": "HP · SSP EN (no floor penalty)"},
                {"when": "Soft secondary", "result": "MOB (lower ceiling than ATK)"},
                {"when": "Great extras", "result": "MAP presence / dash / coverage · special defense kits"},
                {"when": "Not scored", "result": "DEF · Debuff kinds · Debuff strength · SP EN"},
            ],
        }
    )
    criteria.append(
        {
            "id": "role_focus_defense",
            "title": "Defense priorities",
            "applies": ["units"],
            "objective": True,
            "summary": "High HP or DEF, a shield (~20% damage neglect), high MOV for support-defense coverage, solid terrain (Space + Land or Atmos), survivability kits (damage reduction / HP restore), plus a few good debuffs. ATK is upside only (≥9000). Special defenses (I-field / barrier / DR) are extra presence bonuses.",
            "rows": [
                {"when": "Primary", "result": "HP · DEF · shield · MOV · terrain · survivability abilities"},
                {"when": "Secondary", "result": "A few good pierce / DEF-down debuffs (R4+ kinds)"},
                {"when": "ATK upside", "result": "≥9000 mild bonus; below that, no penalty"},
                {"when": "Special defense", "result": "Presence bonus for DR / barrier / negation kits"},
            ],
        }
    )
    criteria.append(
        {
            "id": "role_focus_support",
            "title": "Support priorities",
            "applies": ["units"],
            "objective": True,
            "summary": "Debuff weapon range should be at least 5 (lower is weaker), then variety and strength of debuffs, then high MOB/MOV. ATK and HP are mild upside only — no floor penalty for lower values.",
            "rows": [
                {"when": "Primary", "result": "Weapon range ≥5 · R5+ debuff kinds · debuff strength · MOB · MOV"},
                {"when": "Secondary", "result": "ATK / weapon power / HP (mild upside, no floor penalty)"},
            ],
        }
    )

    er_rows = []
    for row in rules.get("er_access_points") or []:
        er_rows.append(
            {
                "when": f"{row.get('min')}–{row.get('max')} Expert stages",
                "result": _fmt_points(row.get("points")),
            }
        )
    criteria.append(
        {
            "id": "er_access",
            "title": "Eternal Road Expert access",
            "applies": ["units", "pilots"],
            "objective": True,
            "summary": "How many ER Expert stages the unit or pilot can sortie into (tag/series eligibility, including unit+character type-3 rules).",
            "rows": er_rows,
        }
    )

    st = rules.get("tag_strategic") or {}
    tag_rows = []
    prev = 0
    for band in st.get("weight_bands") or []:
        mx = band.get("max_exclusive")
        pts = band.get("points")
        if mx is None:
            tag_rows.append({"when": f"weight ≥ {prev}", "result": _fmt_points(pts)})
        else:
            tag_rows.append(
                {"when": f"weight {prev}–{int(mx) - 1}", "result": _fmt_points(pts)}
            )
            prev = int(mx)
    criteria.append(
        {
            "id": "strategic_tags",
            "title": "Strategic tags",
            "applies": ["units", "pilots"],
            "objective": True,
            "summary": (
                f"Non-flavor tags scored by how often they appear on UR units "
                f"(limited UR counts more than permanent UR). "
                f"Cap {_fmt_points(st.get('cap_points', 3))}."
            ),
            "rows": tag_rows,
        }
    )

    terr = rules.get("terrain") or {}
    criteria.append(
        {
            "id": "terrain",
            "title": "Terrain coverage (units)",
            "applies": ["units"],
            "objective": True,
            "summary": (
                "Deploy tier ≥2 counts as usable. SSP board uses SSP-upgraded terrain. "
                "Floor is Space plus Land or Atmospheric (Byarlant-style Space+Atmos is fine)."
            ),
            "rows": [
                {
                    "when": "Missing Space, or missing both Land and Atmospheric",
                    "result": _fmt_points(terr.get("missing_space_or_land_penalty", -3)),
                },
                {"when": "Space + Land (or Space + Atmospheric)", "result": "0"},
                {
                    "when": "+ Atmospheric / Underwater / Sea (each)",
                    "result": _fmt_points(terr.get("extra_terrain_points", 1)),
                },
                {
                    "when": "Atmospheric used as Land substitute (no Land)",
                    "result": "0 extra for Atmospheric",
                },
                {
                    "when": f"Perfect ({terr.get('perfect_min_deployable', 4)}+ of Space/Land/Atmo/UW/Sea)",
                    "result": _fmt_points(terr.get("perfect_bonus", 1)) + " extra",
                },
            ],
        }
    )

    mov = rules.get("movement") or {}
    for role_name in ROLE_ALL:
        mov_rows = []
        for key in ("3", "4", "5", "6"):
            label = "MOV ≤3" if key == "3" else ("MOV ≥6" if key == "6" else f"MOV {key}")
            mov_rows.append(
                {
                    "when": label,
                    "result": _fmt_points((mov.get(role_name) or {}).get(key, 0)),
                }
            )
        criteria.append(
            {
                "id": f"movement_{role_name.lower()}",
                "title": f"MOV — {role_name}",
                "applies": ["units"],
                "objective": True,
                "summary": (
                    "Primary movement axis. Follow-up (stacks, cap +2): after-move MAP "
                    "and/or Chance Step / PostAttackMove."
                ),
                "rows": mov_rows,
            }
        )

    def _power_rows(bands: list) -> list[dict]:
        out = []
        prev = None
        for b in bands or []:
            mx = b.get("max_exclusive")
            pts = _fmt_points(b.get("points"))
            if prev is None:
                when = f"power < {mx}" if mx is not None else "any"
            elif mx is None:
                when = f"power ≥ {prev}"
            else:
                when = f"power {prev}–{int(mx) - 1}"
            out.append({"when": when, "result": pts})
            if mx is not None:
                prev = int(mx)
        return out

    for mode_key, title_mode in (("sp", "SP"), ("ssp", "SSP")):
        for role_name in ROLE_ALL:
            bands = ((rules.get("weapon_power") or {}).get(mode_key) or {}).get(role_name) or []
            criteria.append(
                {
                    "id": f"weapon_power_{mode_key}_{role_name.lower()}",
                    "title": f"Weapon power — {title_mode} — {role_name}",
                    "applies": ["units"],
                    "objective": True,
                    "summary": (
                        "Max non-MAP Lv5 power for the board. "
                        + (
                            "Attack damage priority."
                            if role_name == "Attack"
                            else (
                                "Mild for Support — damage is secondary."
                                if role_name == "Support"
                                else "Defense capped softer than Attack."
                            )
                        )
                    ),
                    "rows": _power_rows(bands),
                }
            )

    mwb = rules.get("maxweapon_bonus") or {}
    mwb_rows = []
    labels = mwb.get("type_labels") or {}
    pts_by = mwb.get("points_by_type") or {}
    for tid in sorted(pts_by.keys(), key=lambda x: int(x)):
        if tid == "0":
            continue
        mwb_rows.append(
            {
                "when": labels.get(str(tid), f"Type {tid}"),
                "result": _fmt_points(pts_by.get(str(tid), 0)),
            }
        )
    criteria.append(
        {
            "id": "weapon_bonus",
            "title": "Weapon conditional bonus (units)",
            "applies": ["units"],
            "objective": True,
            "summary": (
                "Conditional bonus on the strongest (highest sheet power) non-MAP attack only — "
                "not other weapons on the kit. "
                "Critical damage is mild (+1); critical rate needs ≥20% for +1; guaranteed crit is +2. "
                "Tile/map-position prose bonus is retired (0). "
                f"Higher-range bonus ignored when max range ≤{mwb.get('ignore_higher_range_when_max_range_lte', 3)}."
            ),
            "rows": mwb_rows,
        }
    )

    da = rules.get("dual_attack_attr") or {}
    criteria.append(
        {
            "id": "dual_attack_attr",
            "title": "Multi-type attack attribute (units)",
            "applies": ["units"],
            "objective": True,
            "summary": (
                "Strongest attack uses 2+ of Ranged / Melee / Awaken "
                "(e.g. Enhanced ZZ High Mega Cannon)."
            ),
            "rows": [
                {
                    "when": f"≥{int(da.get('min_types', 2))} attack types on strongest weapon",
                    "result": _fmt_points(da.get("points", 1)),
                }
            ],
        }
    )

    sig = rules.get("signature_weapon_units") or {}
    if sig.get("unit_ids"):
        criteria.append(
            {
                "id": "signature_weapon",
                "title": "Signature weapon kits (units)",
                "applies": ["units"],
                "objective": True,
                "summary": str(
                    sig.get("note")
                    or "Allowlisted units with uniquely strong EX-style weapon kits."
                ),
                "rows": [
                    {
                        "when": "Barbatos Lupus / Lupus Rex family",
                        "result": _fmt_points(sig.get("points", 3)),
                    }
                ],
            }
        )

    src_pts = rules.get("source_bucket_points") or {}
    if src_pts:
        criteria.append(
            {
                "id": "source_bucket",
                "title": "Acquisition route (units)",
                "applies": ["units"],
                "objective": True,
                "summary": "Dev / event / other free units get a mild upside; gacha/assembly stays flat.",
                "rows": [
                    {"when": "Gacha / assembly", "result": _fmt_points(src_pts.get("gacha", 0))},
                    {"when": "Development", "result": _fmt_points(src_pts.get("dev", 1))},
                    {"when": "Event / other", "result": _fmt_points(src_pts.get("event", 1))},
                ],
            }
        )

    wr_tbl = rules.get("weapon_range") or {}
    for role_name in ROLE_ALL:
        wr_rows = []
        for rng in ("1", "2", "3", "4", "5", "6"):
            wr_rows.append(
                {
                    "when": f"Max range {rng}",
                    "result": _fmt_points((wr_tbl.get(role_name) or {}).get(rng, 0)),
                }
            )
        summary = "Highest non-MAP weapon range on the board."
        if role_name == "Support":
            summary = "Support baseline is range 5; anything lower is weaker."
        criteria.append(
            {
                "id": f"weapon_range_{role_name.lower()}",
                "title": f"Weapon range — {role_name}",
                "applies": ["units"],
                "objective": True,
                "summary": summary,
                "rows": wr_rows,
            }
        )

    el = rules.get("extra_life") or {}
    criteria.append(
        {
            "id": "combat_flags",
            "title": "Combat flags (units)",
            "applies": ["units"],
            "objective": True,
            "summary": "Combat bonuses only when they add practical tools (not a free transform checkbox).",
            "rows": [
                {
                    "when": (
                        "Transform alt unlocks deployable terrain, higher MOV, longer range, "
                        "higher weapon power, and/or adds MAP vs base form"
                    ),
                    "result": (
                        f"{_fmt_points((rules.get('transform') or {}).get('points_if_advantage', rules.get('transform_points', 1)))}"
                        + (
                            f" (cap {_fmt_points((rules.get('transform') or {}).get('max_points', 2))} "
                            f"with +{_fmt_points((rules.get('transform') or {}).get('extra_gain_type_points', 1))} per extra gain type)"
                            if (rules.get("transform") or {}).get("extra_gain_type_points")
                            else ""
                        )
                    ),
                },
                {
                    "when": "Transform with no strategic gain vs base",
                    "result": "0",
                },
                {
                    "when": (
                        "Best weapon only usable at Max Vigor (stronger than unrestricted best) "
                        "— MP/pilot-gated; weak for ML / one-turn kill"
                    ),
                    "result": _fmt_points(rules.get("max_tension_higher_tier_weapon_points", -1)),
                },
                {
                    "when": "Preemptive Strike",
                    "result": _fmt_points(rules.get("preemptive_strike_points", 1)),
                },
                {
                    "when": "Rare physical/beam range-down on hit",
                    "result": _fmt_points(rules.get("rare_debuff_points", 1)),
                },
                {
                    "when": "Unbreakable (survive lethal once)",
                    "result": (
                        f"Atk {_fmt_points(el.get('Attack', 1))} / "
                        f"Def {_fmt_points(el.get('Defense', 2))} / "
                        f"Sup {_fmt_points(el.get('Support', 1))}"
                    ),
                },
            ],
        }
    )

    sh = rules.get("shield") or {}
    for role_name in ROLE_ALL:
        rows = [
            {
                "when": "Has shield",
                "result": _fmt_points((sh.get(role_name) or {}).get("has", 0)),
            },
            {
                "when": "Missing shield",
                "result": _fmt_points((sh.get(role_name) or {}).get("missing", 0)),
            },
        ]
        summary = "Whether the unit has a shield (from unit mechanisms)."
        if role_name == "Defense":
            summary = "Shield neglects ~20% damage — Defense is punished hard without one."
        criteria.append(
            {
                "id": f"shield_{role_name.lower()}",
                "title": f"Shield — {role_name}",
                "applies": ["units"],
                "objective": True,
                "summary": summary,
                "rows": rows,
            }
        )

    sd_cfg = rules.get("special_defense") or {}
    if sd_cfg:
        sd_pts = sd_cfg.get("points") or {}
        criteria.append(
            {
                "id": "special_defense",
                "title": "Special defense kits (units)",
                "applies": ["units"],
                "objective": True,
                "summary": (
                    "Presence bonus for ability-based mitigation beyond the shield mechanism "
                    "(damage taken down, defensive DR, negation, HP% barrier / I-field-style cut). "
                    "No missing penalty — Attack/Support glass cannons are not taxed."
                ),
                "rows": [
                    {"when": "No special defense traits", "result": _fmt_points(sd_pts.get("0", 0))},
                    {"when": "1 distinct special-defense trait", "result": _fmt_points(sd_pts.get("1", 1))},
                    {
                        "when": "2+ distinct special-defense traits",
                        "result": _fmt_points(sd_pts.get("2_or_more", 2)),
                    },
                ],
            }
        )

    ur_cfg = rules.get("ur_pilot_dependence") or {}
    if ur_cfg:
        criteria.append(
            {
                "id": "ur_pilot_dependence",
                "title": "UR recommend-pilot dependence (units)",
                "applies": ["units"],
                "objective": True,
                "summary": (
                    "Mild tax when the MS recommend / linked pilot is UR or Ultimate "
                    "(peak kit often assumes that pilot). Still investable with SSR affinity pilots — "
                    "this is disclosure, not a tombstone."
                ),
                "rows": [
                    {
                        "when": "Recommend pilot is SSR or below",
                        "result": _fmt_points(ur_cfg.get("independent_points", 0)),
                    },
                    {
                        "when": (
                            f"Recommend pilot rarity index ≥{ur_cfg.get('min_recommend_rarity_index', 5)} "
                            "or Ultimate"
                        ),
                        "result": _fmt_points(ur_cfg.get("dependent_points", -1)),
                    },
                ],
            }
        )

    outlier_cfg = rules.get("stat_outlier") or {}
    if outlier_cfg:
        out_rows = []
        for role_name in ROLE_ALL:
            for hit in (outlier_cfg.get("by_role") or {}).get(role_name) or []:
                modes = hit.get("modes")
                mode_note = f" ({'/'.join(str(m).upper() for m in modes)} only)" if modes else ""
                out_rows.append(
                    {
                        "when": f"{role_name}: {hit.get('stat')} ≥ {hit.get('min')}{mode_note}",
                        "result": _fmt_points(outlier_cfg.get("points_per_hit", 1)),
                    }
                )
        criteria.append(
            {
                "id": "stat_outlier",
                "title": "Exceptional secondary stats (units)",
                "applies": ["units"],
                "objective": True,
                "summary": (
                    f"Niche bonus when a secondary stat is clearly above average for the role. "
                    f"Cap {_fmt_points(outlier_cfg.get('cap', 2))}."
                ),
                "rows": out_rows,
            }
        )

    def _stat_band_rows_for_role(stat_key: str, role_name: str) -> list[dict]:
        bands = ((rules.get("stat_bands") or {}).get(stat_key) or {}).get(role_name) or []
        out = []
        prev = None
        for b in bands:
            mx = b.get("max_exclusive")
            pts = _fmt_points(b.get("points"))
            if prev is None:
                when = f"{stat_key} < {mx}" if mx is not None else "any"
            elif mx is None:
                when = f"{stat_key} ≥ {prev}"
            else:
                when = f"{stat_key} {prev}–{int(mx) - 1}"
            out.append({"when": when, "result": pts})
            if mx is not None:
                prev = int(mx)
        return out

    for role_name in ROLE_ALL:
        if role_name == "Attack":
            stat_summary = (
                "Attack favors ATK ceiling over MOB. HP is upside-only (no floor penalty). "
                "DEF not scored. EN scores on the SSP board only (upside-only). MOB soft-capped."
            )
            stat_rows = (
                _stat_band_rows_for_role("HP", role_name)
                + _stat_band_rows_for_role("EN", role_name)
                + _stat_band_rows_for_role("ATK", role_name)
                + _stat_band_rows_for_role("DEF", role_name)
                + _stat_band_rows_for_role("MOB", role_name)
            )
        elif role_name == "Defense":
            stat_summary = (
                "Defense focuses on HP + DEF (floor penalties kept). "
                "ATK is upside only (≥9000 → +1, ≥10000 → +2; no floor penalty)."
            )
            stat_rows = (
                _stat_band_rows_for_role("HP", role_name)
                + _stat_band_rows_for_role("ATK", role_name)
                + _stat_band_rows_for_role("DEF", role_name)
                + _stat_band_rows_for_role("MOB", role_name)
            )
        else:
            stat_summary = (
                "Support favors MOB ceiling; ATK and HP are mild upside with no floor penalty."
            )
            stat_rows = (
                _stat_band_rows_for_role("HP", role_name)
                + _stat_band_rows_for_role("ATK", role_name)
                + _stat_band_rows_for_role("DEF", role_name)
                + _stat_band_rows_for_role("MOB", role_name)
            )
        criteria.append(
            {
                "id": f"unit_stats_{role_name.lower()}",
                "title": f"Unit SP-grown stats — {role_name}",
                "applies": ["units"],
                "objective": True,
                "summary": stat_summary,
                "rows": stat_rows,
            }
        )

    md = rules.get("max_debuff_level") or {}
    kinds = rules.get("support_debuffs_kinds") or {}
    debuff_rows = [
        {"when": "Attack role", "result": "Not scored (axes omitted)"},
    ]
    for role_name in ("Defense", "Support"):
        kcfg = kinds.get(role_name) or {}
        min_r = int(kcfg.get("min_range", 4 if role_name == "Defense" else 5) or 4)
        debuff_rows.append(
            {
                "when": f"{role_name}: 0 / 1 / 2+ distinct R{min_r}+ debuff kinds",
                "result": (
                    f"{_fmt_points(kcfg.get('0', 0 if role_name == 'Defense' else -1))} / "
                    f"{_fmt_points(kcfg.get('1', 0))} / "
                    f"{_fmt_points(kcfg.get('2_or_more', 1))}"
                ),
            }
        )
    for role_name in ("Defense", "Support"):
        tbl = md.get(role_name) or {}
        bits = []
        for key in ("none", "3", "4", "5", "6"):
            if key in tbl:
                label = "none" if key == "none" else f"Lv{key}"
                bits.append(f"{label} {_fmt_points(tbl.get(key))}")
        if bits:
            debuff_rows.append({"when": f"{role_name} pierce / DEF-down level", "result": " · ".join(bits)})
    criteria.append(
        {
            "id": "debuffs",
            "title": "Debuffs (Defense / Support units)",
            "applies": ["units"],
            "objective": True,
            "summary": (
                "Attack units skip these axes. Debuff strength uses lasting DEF-down % "
                "or instant pierce (≈10%→3 … 40%+→6). "
                "Defense counts distinct debuff kinds at range ≥4 (light; damage-taken downs count as one kind). "
                "Support counts kinds at range ≥5 and cares more about strength."
            ),
            "rows": debuff_rows,
        }
    )

    lp = rules.get("affinity_pilots") or rules.get("linked_pilot") or {}
    if rules.get("affinity_pilots"):
        aff_rows = []
        prev = 0
        for band in lp.get("count_bands") or []:
            mx = band.get("max_exclusive")
            pts = band.get("points")
            if mx is None:
                aff_rows.append(
                    {"when": f"≥ {prev} matching SSR+ pilots", "result": _fmt_points(pts)}
                )
            else:
                hi = int(mx) - 1
                if prev == hi:
                    label = f"{prev} matching SSR+ pilot" + ("" if prev == 1 else "s")
                    aff_rows.append({"when": label, "result": _fmt_points(pts)})
                else:
                    aff_rows.append(
                        {
                            "when": f"{prev}–{hi} matching SSR+ pilots",
                            "result": _fmt_points(pts),
                        }
                    )
                prev = int(mx)
        role_note = "same role" if lp.get("require_same_role", True) else "any role"
        criteria.append(
            {
                "id": "linked_pilot",
                "title": "Affinity pilot pool (units)",
                "applies": ["units"],
                "objective": True,
                "summary": (
                    f"Count of SSR+ ({role_note}) pilots whose piloting-tag / EX-pair "
                    "affinity matches this MS. A deeper pool beats one linked recommend."
                ),
                "rows": aff_rows,
            }
        )
    else:
        criteria.append(
            {
                "id": "linked_pilot",
                "title": "Linked / recommend pilot (units)",
                "applies": ["units"],
                "objective": True,
                "summary": "From recommend-character link: rarity index + same role as the unit.",
                "rows": [
                    {"when": "No linked pilot", "result": _fmt_points(lp.get("none_points", 0))},
                    {
                        "when": (
                            f"Linked, rarity index ≥{lp.get('very_good_min_rarity_index', 4)} "
                            "and same role"
                        ),
                        "result": _fmt_points(lp.get("very_good_points", 1)),
                    },
                    {"when": "Linked otherwise", "result": _fmt_points(lp.get("any_points", -1))},
                ],
            }
        )

    map_cov = []
    prev = 0
    for band in rules.get("map_coverage_points") or []:
        mx = band.get("max_exclusive")
        pts = band.get("points")
        if mx is None:
            map_cov.append({"when": f"≥ {prev} cells", "result": _fmt_points(pts)})
        else:
            map_cov.append(
                {"when": f"{prev}–{int(mx) - 1} cells", "result": _fmt_points(pts)}
            )
            prev = int(mx)
    criteria.append(
        {
            "id": "map",
            "title": "MAP weapons (units)",
            "applies": ["units"],
            "objective": True,
            "summary": (
                "Damage MAP only (power ≥1) — non-damage MAPs like Live Concert Zaku are ignored. "
                "Presence for any damage MAP, extra for dash/MovingAttack, ammo 2+, and coverage "
                "(0–14 cells = 0, 15–24 = +1, 25+ = +2). Attack cap "
                f"{_fmt_points((rules.get('map_axis_cap_by_role') or {}).get('Attack', rules.get('map_axis_cap', 4)))}; "
                f"Defense/Support cap "
                f"{_fmt_points((rules.get('map_axis_cap_by_role') or {}).get('Support', 2))}."
            ),
            "rows": [
                {
                    "when": "Any MAP weapon",
                    "result": _fmt_points(rules.get("map_presence_points", 1)),
                },
                {
                    "when": "Dash / MovingAttack MAP",
                    "result": _fmt_points(rules.get("map_dash_points", 1)),
                },
                {"when": "Ammo 1", "result": "0 (covered by presence)"},
                {"when": "Ammo ≥2", "result": _fmt_points((rules.get("map_ammo_points") or {}).get("2", 1))},
                *map_cov,
            ],
        }
    )

    criteria.append(
        {
            "id": "abilities",
            "title": "Abilities / kit",
            "applies": ["units", "pilots"],
            "objective": True,
            "summary": (
                "Scored from ability and skill effect data in the game masters. "
                "Permanent ATK/DEF/HP/MOV with no condition scores 0 here. "
                "Strong % effects use size bands (for example damage dealt 10/20/30%+). "
                f"Unit ability axis caps at +3; pilot kit caps at +{int(rules.get('pilot_kit_cap', 14))}."
            ),
            "rows": [
                {"when": "Role-relevant combat effects", "result": "Points by effect (+ size bands)"},
                {"when": "Permanent flat/rate stats, no condition", "result": "0"},
                {"when": "MAP ammo effects", "result": "0 here (counted on MAP axis)"},
                {"when": "Physical/beam weapon range-down on hit", "result": "Rare debuff +1"},
                {"when": "Unbreakable (mainly pilots)", "result": "Extra-life role bonus (separate axis)"},
            ],
        }
    )

    # Publish flat role→effect point tables for transparency
    try:
        import game_enums as _ge
    except Exception:
        _ge = None

    def _type_label(tti: int) -> str:
        if _ge is not None:
            try:
                return _humanize_effect_name(str(_ge.enum_key("TraitType", tti) or tti))
            except Exception:
                pass
        return str(tti)

    abil_cfg = rules.get("ability_structured") or {}
    for role in ("Attack", "Defense", "Support"):
        rp = (abil_cfg.get("role_points") or {}).get(role) or {}
        rows = []
        for tti_s, pts in sorted(rp.items(), key=lambda kv: (-int(kv[1]), int(kv[0]))):
            mag = ((abil_cfg.get("magnitude_points") or {}).get(role) or {}).get(tti_s)
            label = _type_label(int(tti_s))
            if mag:
                bits = []
                prev = 0
                for b in mag:
                    mx = b.get("max_exclusive")
                    if mx is None:
                        bits.append(f"≥{prev}%→{_fmt_points(b.get('points'))}")
                    else:
                        bits.append(f"{prev}–{int(mx)-1}%→{_fmt_points(b.get('points'))}")
                        prev = int(mx)
                result = "; ".join(bits)
            else:
                result = _fmt_points(pts)
            rows.append({"when": label, "result": result})
        criteria.append(
            {
                "id": f"ability_table_{role.lower()}",
                "title": f"Unit ability effect points — {role}",
                "applies": ["units"],
                "objective": True,
                "summary": "Base points when size bands are absent; otherwise the size table applies.",
                "rows": rows[:24],
            }
        )

    fp = rules.get("large_footprint") or {}
    criteria.append(
        {
            "id": "footprint",
            "title": "Large footprint (2×2)",
            "applies": ["units"],
            "objective": True,
            "summary": "2×2 units get a mild bonus — wider MAP/buff coverage usually outweighs placement inconvenience.",
            "rows": [
                {"when": "Attack", "result": _fmt_points(fp.get("Attack", 1))},
                {"when": "Support", "result": _fmt_points(fp.get("Support", 1))},
                {"when": "Defense", "result": _fmt_points(fp.get("Defense", 1))},
            ],
        }
    )

    rar = rules.get("rarity_adjustment") or {}
    criteria.append(
        {
            "id": "rarity",
            "title": "Rarity adjustment (units)",
            "applies": ["units"],
            "objective": True,
            "summary": "Stops N/R/SR units from sharing SSR/UR letters.",
            "rows": [
                {"when": "N", "result": _fmt_points(rar.get("1", -5))},
                {"when": "R", "result": _fmt_points(rar.get("2", -4))},
                {"when": "SR", "result": _fmt_points(rar.get("3", -2))},
                {"when": "SSR / UR", "result": _fmt_points(rar.get("4", 0))},
            ],
        }
    )

    prar = rules.get("pilot_rarity_adjustment") or rar
    criteria.append(
        {
            "id": "pilot_rarity",
            "title": "Rarity adjustment (pilots)",
            "applies": ["pilots"],
            "objective": True,
            "summary": (
                "Softer than units — cracked SR SP pilots should not be buried by rarity alone. "
                "SSR/UR start even."
            ),
            "rows": [
                {"when": "N", "result": _fmt_points(prar.get("1", -2))},
                {"when": "R", "result": _fmt_points(prar.get("2", -1))},
                {"when": "SR", "result": _fmt_points(prar.get("3", 0))},
                {"when": "SSR / UR", "result": _fmt_points(prar.get("4", 0))},
            ],
        }
    )

    def _pilot_stat_band_rows(stat_key: str, role_name: str) -> list[dict]:
        bands = ((rules.get("pilot_stat_bands") or {}).get(stat_key) or {}).get(role_name) or []
        out = []
        prev = None
        for b in bands:
            mx = b.get("max_exclusive")
            pts = _fmt_points(b.get("points"))
            if prev is None:
                when = f"{stat_key} < {mx}" if mx is not None else "any"
            elif mx is None:
                when = f"{stat_key} ≥ {prev}"
            else:
                when = f"{stat_key} {prev}–{int(mx) - 1}"
            out.append({"when": when, "result": pts})
            if mx is not None:
                prev = int(mx)
        return out

    for role_name in ROLE_ALL:
        pstat_rows = []
        for sk in ("Ranged", "Melee", "Awaken", "Defense", "Reaction"):
            pstat_rows.extend(_pilot_stat_band_rows(sk, role_name))
        if pstat_rows:
            criteria.append(
                {
                    "id": f"pilot_stats_{role_name.lower()}",
                    "title": f"Pilot SP-grown stats — {role_name}",
                    "applies": ["pilots"],
                    "objective": True,
                    "summary": (
                        "SP-list grown stats for this pilot role. Specialty axes (Ranged/Melee/Awaken) "
                        "matter most for Attack; Defense/Reaction matter more for Defense pilots."
                    ),
                    "rows": pstat_rows,
                }
            )

    criteria.append(
        {
            "id": "pilots_extra",
            "title": "Pilot-only axes",
            "applies": ["pilots"],
            "objective": True,
            "summary": "Pilots use the SP board only. See Pilot SP-grown stats blocks for band tables.",
            "rows": [
                {"when": "SP grown stats (Ranged / Melee / Awaken / Defense / Reaction)", "result": "Band points by role (see tables above)"},
                {"when": "Series affinity abilities", "result": f"+{int(rules.get('series_affinity_points_each', 3))} each"},
                {"when": "Best recommended MS letter (B+ and up)", "result": "From this guide’s unit letters"},
                {"when": "Unbreakable on pilot abilities", "result": "Extra-life role bonus"},
            ],
        }
    )

    role_map = {
        "role_focus_attack": ["Attack"],
        "role_focus_defense": ["Defense"],
        "role_focus_support": ["Support"],
        "debuffs": ["Defense", "Support"],
        "ability_table_attack": ["Attack"],
        "ability_table_defense": ["Defense"],
        "ability_table_support": ["Support"],
        "movement_attack": ["Attack"],
        "movement_defense": ["Defense"],
        "movement_support": ["Support"],
        "weapon_range_attack": ["Attack"],
        "weapon_range_defense": ["Defense"],
        "weapon_range_support": ["Support"],
        "weapon_power_sp_attack": ["Attack"],
        "weapon_power_sp_defense": ["Defense"],
        "weapon_power_sp_support": ["Support"],
        "weapon_power_ssp_attack": ["Attack"],
        "weapon_power_ssp_defense": ["Defense"],
        "weapon_power_ssp_support": ["Support"],
        "shield_attack": ["Attack"],
        "shield_defense": ["Defense"],
        "shield_support": ["Support"],
        "unit_stats_attack": ["Attack"],
        "unit_stats_defense": ["Defense"],
        "unit_stats_support": ["Support"],
        "pilot_stats_attack": ["Attack"],
        "pilot_stats_defense": ["Defense"],
        "pilot_stats_support": ["Support"],
    }
    for c in criteria:
        c["roles"] = list(role_map.get(c.get("id"), ROLE_ALL))

    return criteria


def scoring_guide_payload(rules: dict | None = None) -> dict:
    rules = rules or load_rules()
    guide = dict(rules.get("scoring_guide") or {})
    guide["bucket_labels"] = rules.get("bucket_labels") or {}
    guide["letter_cutoffs"] = rules.get("letter_cutoffs") or []
    guide["ur_letter_cutoffs"] = rules.get("ur_letter_cutoffs") or []
    guide["pilot_letter_cutoffs"] = rules.get("pilot_letter_cutoffs") or rules.get(
        "letter_cutoffs"
    ) or []
    guide["ur_pilot_letter_cutoffs"] = rules.get("ur_pilot_letter_cutoffs") or []
    # Prefer nested guide version (e.g. 5.4) over top-level rules.version
    guide["version"] = (rules.get("scoring_guide") or {}).get("version") or rules.get(
        "version", 1
    )
    guide["covers"] = ["units_sp", "units_ssp", "pilots_sp"]
    # Always rebuild criteria from live bands so the UI matches the scorer.
    guide["criteria"] = build_public_criteria(rules)
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
    tension_re = re.compile(
        rules.get("pilot_skill_tension_gate_regex")
        or ((rules.get("ability") or {}).get("tension_gate_regex") or r"$a")
    )
    if tension_re.search(blob) or tension_re.search(name):
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
    """Score a pilot (character) for SP investment (v5 axes)."""
    rules = rules or load_rules()
    role = features.get("role") or "Attack"
    if role not in ("Attack", "Defense", "Support"):
        role = "Attack"
    specialty = features.get("specialty") or pilot_specialty(features)
    breakdown: dict[str, Any] = {}
    meta: dict[str, Any] = {"heuristic_keys": []}
    detail_lines: list[dict] = []

    tag_pts = pilot_tag_count_points(rules, int(features.get("tag_count") or 0))
    tw_pts, tw_meta = tag_weight_points(
        {"tag_weight": rules.get("pilot_tag_weight") or {}},
        features.get("tags") or [],
    )
    st_cfg = rules.get("pilot_tag_strategic") or rules.get("tag_strategic") or {}
    st_pts = 0
    st_meta: dict = {}
    if st_cfg:
        st_pts, st_meta = strategic_tag_points(
            {**rules, "tag_strategic": st_cfg},
            features.get("tags") or [],
            features.get("tag_strategic_table"),
        )
    tags_total = tag_pts + tw_pts + st_pts
    breakdown["tags"] = tags_total
    tag_names = [str(t) for t in (features.get("tags") or []) if t]
    detail_lines.append(
        {
            "kind": "tags",
            "label": "Strategic / combat tags",
            "detail": ", ".join(tag_names) if tag_names else "—",
            "points": tags_total,
        }
    )
    if tw_pts:
        meta["tags_weight"] = tw_meta
        meta["heuristic_keys"].append("tags_weight")
    if st_pts:
        meta["tags_strategic"] = st_meta
        meta["heuristic_keys"].append("tags_strategic")

    er_rows = rules.get("pilot_er_access_points") or rules.get("er_access_points") or []
    er_n = int(features.get("er_expert_eligible_count") or 0)
    er_pts = 0
    for row in er_rows:
        if int(row.get("min", 0)) <= er_n <= int(row.get("max", 999)):
            er_pts = int(row.get("points", 0) or 0)
            break
    breakdown["er_access"] = er_pts
    meta["er_expert_eligible_count"] = er_n
    detail_lines.append(
        {
            "kind": "er_access",
            "label": "ER Expert access",
            "detail": f"{er_n} stages",
            "points": er_pts,
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

    use_structured = bool(rules.get("pilot_skill_structured") or rules.get("ability_structured")) and (
        features.get("ability_effects") is not None or features.get("skill_effects") is not None
    )
    if use_structured:
        aff_n = int(features.get("series_affinity_count") or 0)
        kit_pts, kit_meta = score_pilot_kit_structured(
            rules,
            role,
            specialty,
            features.get("ability_effects") or [],
            features.get("skill_effects") or [],
            affinity_count=aff_n,
        )
        breakdown["skills_abilities"] = kit_pts
        meta["kit"] = kit_meta
        for line in (kit_meta.get("skills") or {}).get("lines") or []:
            detail_lines.append(
                {
                    "kind": "skill",
                    "label": f"Skill trait {line.get('trait_type_index')}",
                    "name": f"type {line.get('trait_type_index')}",
                    "points": int(line.get("points") or 0),
                    "is_affinity": False,
                    "estimated": False,
                    "trait_type_index": line.get("trait_type_index"),
                    "trait_value": line.get("trait_value"),
                }
            )
        for eff in features.get("ability_effects") or []:
            tti = int(eff.get("trait_type_index") or 0)
            pts = _points_for_trait_type(
                rules,
                role,
                tti,
                bool(eff.get("has_active_cond")),
                int(eff.get("trait_value") or 0),
            )
            if pts <= 0:
                continue
            detail_lines.append(
                {
                    "kind": "ability",
                    "label": eff.get("ability_name")
                    or eff.get("trait_type_key")
                    or f"type {tti}",
                    "name": eff.get("ability_name") or eff.get("trait_type_key") or "",
                    "points": pts,
                    "is_affinity": False,
                    "estimated": False,
                    "trait_type_index": tti,
                    "trait_value": eff.get("trait_value"),
                    "trait_type_key": eff.get("trait_type_key") or "",
                }
            )
        breakdown["series_affinity"] = aff_n * int(
            rules.get("series_affinity_points_each", 3)
        )
    else:
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
        aff_from_lines = sum(
            int(x.get("points") or 0)
            for x in (kit_meta.get("lines") or [])
            if x.get("is_affinity")
        )
        breakdown["series_affinity"] = aff_from_lines if aff_from_lines else aff_n * aff_each

    el_pts = 0
    if features.get("has_extra_life"):
        el_pts = int((rules.get("extra_life") or {}).get(role, 1))
        if features.get("extra_life_source") == "prose":
            meta["heuristic_keys"].append("extra_life")
        else:
            meta["extra_life"] = {
                "structured": True,
                "source": features.get("extra_life_source"),
            }
    breakdown["extra_life"] = el_pts
    if el_pts:
        detail_lines.append(
            {
                "kind": "extra_life",
                "label": "Unbreakable / extra life",
                "detail": features.get("extra_life_source") or "yes",
                "points": el_pts,
            }
        )

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

    rarity_pts = pilot_rarity_adjustment_points(rules, features.get("rarity_id"))
    breakdown["rarity"] = rarity_pts

    total = int(sum(int(v) for v in breakdown.values()))
    letter = letter_for_total(rules, total, cutoffs_key="pilot_letter_cutoffs")
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
    use the pilot's Ranged/Melee/Awaken specialty (Defense units exempt),
    and match v4 role gates (Attack→Attack, Support→Attack+Support, Defense→Defense).
    Official/linked pairs always allowed.
    """
    rules = rules or load_rules()
    by_id = unit_index.get("by_id") or {}
    allowed = letter_pts_allowed(rules)
    role_gate = (rules.get("pilot_recommend_role_gate") or {}).get(role) or None
    cand: dict[str, dict] = {}

    def _role_ok(u_role: str, reason: str) -> bool:
        if reason in ("official", "linked"):
            return True
        if not role_gate:
            return True
        return (u_role or "") in role_gate

    def _add(uid: str, reason: str):
        uid = A.normalize_id(uid)
        ent = by_id.get(uid)
        if not ent:
            return
        lit = ent.get("letter") or ""
        if lit not in allowed or _LETTER_ORDER.index(lit) < _LETTER_ORDER.index("B+"):
            return
        u_role = ent.get("role") or ""
        if not _role_ok(u_role, reason):
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


def character_is_investment_eligible(
    A, cid: str, rules: dict | None = None, unit_index: dict | None = None
) -> bool:
    """Playable filter plus optional denylist / usable unit-link requirement."""
    rules = rules or load_rules()
    cid = A.normalize_id(cid) if hasattr(A, "normalize_id") else str(cid)
    if not cid or cid == "0":
        return False
    denylist = {str(x) for x in (rules.get("exclude_character_ids") or []) if str(x)}
    if cid in denylist:
        return False
    info = (getattr(A, "char_info_map", None) or {}).get(cid) or {}
    # Role 0 = NPC / story-only — never investment targets (even if they have kit rows).
    if str(info.get("role", "0") or "0") == "0":
        return False
    playable = getattr(A, "char_list_playable_ids", None)
    if playable is not None and cid not in playable:
        return False
    if not rules.get("require_character_usable_unit_link", False):
        return True
    # Official recommend MS, linked MS, or reverse-linked from unit index.
    try:
        rec = ""
        if hasattr(A, "resolve_character_recommend_unit_id"):
            rec = A.normalize_id(A.resolve_character_recommend_unit_id(cid) or "")
        if not rec or rec == "0":
            rec = A.normalize_id((getattr(A, "CHAR_RECOMMEND_UNIT_MAP", None) or {}).get(cid) or "0")
        if rec and rec != "0" and rec in (getattr(A, "unit_info_map", None) or {}):
            return True
        linked = A.normalize_id((getattr(A, "LINKED_CHARACTER_UNIT_MAP", None) or {}).get(cid) or "0")
        if linked and linked != "0" and linked in (getattr(A, "unit_info_map", None) or {}):
            return True
    except Exception:
        pass
    if unit_index and cid in (unit_index.get("by_recommend_char") or {}):
        return True
    return False


def extract_character_features(
    A,
    cid: str,
    lc: str = "EN",
    rules: dict | None = None,
    unit_letter_by_id: dict | None = None,
    unit_index: dict | None = None,
) -> dict | None:
    rules = rules or load_rules()
    cid = A.normalize_id(cid) if hasattr(A, "normalize_id") else str(cid)
    if not character_is_investment_eligible(A, cid, rules, unit_index=unit_index):
        return None
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
    ability_effects = collect_character_ability_effects(A, cid, lc=lc, rules=rules)
    skill_effects = collect_character_skill_effects(A, cid)
    has_extra, extra_src = _has_extra_life(rules, cid, ability_blobs, ability_effects)

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
        "ability_effects": ability_effects,
        "skill_effects": skill_effects,
        "has_extra_life": has_extra,
        "extra_life_source": extra_src,
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
    tag_strategic_table: dict | None = None,
    er_expert_ids: list[str] | None = None,
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
    if tag_strategic_table is not None:
        feats["tag_strategic_table"] = tag_strategic_table
    elif rules.get("pilot_tag_strategic") or rules.get("tag_strategic"):
        feats["tag_strategic_table"] = get_pilot_tag_strategic_table(A, rules, lc)
    if er_expert_ids is not None:
        elig = [
            sid
            for sid in er_expert_ids
            if entity_eligible_on_stage(A, cid, sid, kind="character", lc=lc)
        ]
        feats["er_expert_eligible_count"] = len(elig)
        feats["er_expert_ids"] = elig
    scored = score_pilot_features(feats, rules=rules)
    row = {
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
    if feats.get("er_expert_ids") is not None:
        row["er_expert_ids"] = list(feats.get("er_expert_ids") or [])
    return row


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
    # Target type 3 = unit + character; treat as applying to both kinds.
    typed = [r for r in rows if str(r.get("target_type_index")) in (want, "3")]
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
                if tt == "1":
                    bucket = unit_labels
                elif tt == "2":
                    bucket = char_labels
                elif tt == "3":
                    # Both — collect into unit and character label lists
                    for gc in A.stage_sortie_group_content_map.get(r.get("group_id", "0"), []) or []:
                        lab = _restriction_label(
                            A,
                            str(gc.get("restriction_type_index", "0")),
                            gc.get("target_id", "0"),
                            lc,
                        )
                        if lab:
                            unit_labels.append(lab)
                            char_labels.append(lab)
                    continue
                else:
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
