#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build data/published/mls_koma_catalog_v1.json from Simulator koma/fx + UR export manifest.

Scans local ggen_db_images checkout (or --sim). Used by /mls to enable IngameKoma for all UR kits.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "data" / "EN" / "master" / "m_unit.json"
DEFAULT_SIM = Path(
    r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\Master League\Simulator"
)
OUT = ROOT / "data" / "published" / "mls_koma_catalog_v1.json"
MANIFEST = DEFAULT_SIM / "meta" / "UR_EXPORT_MANIFEST.json"

FRAME_RE = re.compile(
    r"^(?P<kid>[a-z0-9]+)_(?P<action>[a-z0-9]+)_(?P<facing>[A-Za-z]+)(?:_(?P<fr>\d+))?$",
    re.I,
)
FX_FRAME_RE = re.compile(r"^(?P<prefix>.+)_(?P<fr>\d+)\.webp$", re.I)

RANGED_HINTS = (
    "beambuster", "beamrifle", "beamcanon", "beamcannon", "bazooka", "rifle",
    "cannon", "gun", "funnel", "missile", "machinegun", "megabeam", "hyper",
    "railgun", "sniper", "shot", "blast", "buster",
)
MELEE_HINTS = (
    "stab", "slash", "saber", "sword", "punch", "tackle", "axe", "hammer",
    "blade", "melee", "crossslash", "beamsaber", "heat", "lance", "tomahawk",
)
AVOID_FX = (
    "muzzle", "vernier", "trailvernier", "charge", "ps_", "end", "beam_loop",
)


def load_ur_units() -> dict[str, list[str]]:
    rows = json.loads(MASTER.read_text(encoding="utf-8"))
    by: dict[str, list[str]] = defaultdict(list)
    for r in rows:
        if str(r.get("RarityTypeIndex")) != "5":
            continue
        kid = str(r.get("KomaResourceId") or "").strip()
        if not kid:
            continue
        by[kid].append(str(r.get("Id")))
    return dict(by)


def scan_koma_strips(koma_dir: Path, kid: str) -> tuple[dict, int]:
    strips: dict[str, dict] = {}
    facings_by_action: dict[str, set[str]] = defaultdict(set)
    frames_by_action_facing: dict[tuple[str, str], set[int]] = defaultdict(set)
    standby_frame = 0
    unnumbered_standby = False

    for p in koma_dir.glob(f"{kid}_*.webp"):
        stem = p.stem
        if not stem.startswith(kid + "_"):
            continue
        rest = stem[len(kid) + 1 :]
        parts = rest.split("_")
        if len(parts) < 2:
            continue
        action = parts[0]
        # et01_L_01 / weapon1_front_01 / standby_front / standby_front_01
        if action.startswith("et") and len(parts) >= 2:
            facing = parts[1]
            fr_s = parts[2] if len(parts) >= 3 else None
        elif action == "standby":
            facing = parts[1] if len(parts) >= 2 else "front"
            fr_s = parts[2] if len(parts) >= 3 else None
        elif action.startswith("weapon") or action == "map" or action.startswith("event"):
            facing = parts[1] if len(parts) >= 2 else "front"
            fr_s = parts[2] if len(parts) >= 3 else None
        else:
            # odd names (effects, FX, …) — skip for strip table
            continue

        if fr_s and fr_s.isdigit():
            fr = int(fr_s)
            frames_by_action_facing[(action, facing)].add(fr)
            if action == "standby" and facing == "front":
                standby_frame = max(standby_frame, fr)
        else:
            if action == "standby":
                unnumbered_standby = True
            else:
                frames_by_action_facing[(action, facing)].add(1)
        facings_by_action[action].add(facing)

    if unnumbered_standby and standby_frame == 0:
        standby_frame = 0
    elif standby_frame == 0 and "standby" in facings_by_action:
        standby_frame = 1

    for action, facings in facings_by_action.items():
        if action == "standby":
            continue
        counts = []
        for f in facings:
            frs = frames_by_action_facing.get((action, f)) or {1}
            counts.append(max(frs) if frs else 1)
        frames = max(counts) if counts else 1
        meta: dict = {"frames": frames}
        # only pin facings when not the usual 4-way set
        usual = {"front", "back", "left", "right"}
        if facings and facings != usual and not usual.issuperset(facings):
            # L/R only EX, etc.
            order = ["left", "right", "L", "R", "front", "back", "F", "B"]
            meta["facings"] = sorted(facings, key=lambda x: order.index(x) if x in order else 99)
        elif facings <= usual and facings and "front" not in facings and (
            "left" in facings or "L" in facings
        ):
            order = ["left", "right", "L", "R", "front", "back"]
            meta["facings"] = sorted(facings, key=lambda x: order.index(x) if x in order else 99)
        if action.startswith("et") and frames > 14:
            meta["maxPlay"] = 14
        strips[action] = meta

    return strips, standby_frame


def index_fx_prefixes(fx_dir: Path) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    if not fx_dir.is_dir():
        return {}
    for p in fx_dir.glob("ef_*.webp"):
        m = FX_FRAME_RE.match(p.name)
        if m:
            counts[m.group("prefix")] = max(counts[m.group("prefix")], int(m.group("fr")))
        else:
            # Single plate (…_flash01.webp) — treat whole stem as a 1-frame prefix.
            counts[p.stem] = max(counts.get(p.stem, 0), 1)
    return dict(counts)


def swap_mpa_mpd(name: str) -> str:
    if name.startswith("ef_mpa_"):
        return "ef_mpd_" + name[len("ef_mpa_") :]
    if name.startswith("ef_mpd_"):
        return "ef_mpa_" + name[len("ef_mpd_") :]
    return name


def score_prefix(prefix: str, kind: str) -> int:
    pl = prefix.lower()
    if any(a in pl for a in AVOID_FX):
        return -1000
    score = 0
    if "mpd_" in pl:
        score += 50
    if "spark" in pl:
        score += 40
    if "impact" in pl:
        score += 35
    if "shock" in pl:
        score += 10
    if kind == "ex" and "_ex" in pl:
        score += 30
    if kind == "ranged" and any(h in pl for h in RANGED_HINTS):
        score += 25
    if kind == "melee" and any(h in pl for h in MELEE_HINTS):
        score += 25
    if kind == "ranged" and any(h in pl for h in MELEE_HINTS):
        score -= 5
    if kind == "melee" and any(h in pl for h in RANGED_HINTS):
        score -= 5
    return score


# After a motion AssetName base, only allow generic VFX suffixes — never
# another kit's slug (…_tackle_hydra_… must not win for a plain …_tackle ref).
_FX_SUFFIX_OK = re.compile(
    r"^(?:_(?:spark|impact|shock|hit|flash|hibana|slash|stab|cross|"
    r"lightning|parti|ring|smoke|wave|null|dissolve|housya|muzzle|beam|"
    r"burst|gun|bomb|flare|wind|ray)\d*)+$",
    re.I,
)


def prefix_matches_ref(pref: str, base: str) -> bool:
    if pref == base:
        return True
    if not base or not pref.startswith(base + "_"):
        return False
    return bool(_FX_SUFFIX_OK.match(pref[len(base) :]))


def pick_fx(prefixes: dict[str, int], refs: list[str], kind: str) -> tuple[str, int]:
    cands: list[tuple[str, str]] = []
    bases = []
    for r in refs or []:
        if not r or r.startswith("ef_mpv_"):
            continue
        bases.append(r)
        bases.append(swap_mpa_mpd(r))
    for pref in prefixes:
        for b in bases:
            if prefix_matches_ref(pref, b):
                cands.append((pref, b))
                break
    if not cands:
        return "", 0
    best_pref, best_base = max(
        cands,
        key=lambda pb: (
            score_prefix(pb[0], kind),
            len(pb[1]),
            prefixes.get(pb[0], 0),
            -len(pb[0]),
        ),
    )
    if score_prefix(best_pref, kind) < 0:
        return "", 0
    n = min(prefixes.get(best_pref, 0), 16)
    return best_pref, n


# Hand-tuned FX for the original gated kits (keep proven look).
OVERRIDES = {
    "1217002150": {
        "impactFx": "ef_mpd_1000_000_beambuster_griepe_spark01",
        "impactFrames": 12,
        "meleeImpactFx": "ef_mpd_1000_000_stab_griepe_ex1_spark01",
        "meleeImpactFrames": 12,
        "exImpactFx": "ef_mpd_1000_000_stab_griepe_ex1_spark01",
        "exImpactFrames": 12,
        "stripsBySlot": ["map", "weapon2", "weapon1", "et01", "weapon3"],
    },
    "1217000650": {
        "impactFx": "ef_mpd_1000_000_beambuster_hydra_spark01",
        "impactFrames": 12,
        "meleeImpactFx": "ef_mpd_1000_000_stabspark_hydra_spark",
        "meleeImpactFrames": 12,
        "exImpactFx": "ef_mpd_1000_000_beamsaber_hydra_ex1_spark02",
        "exImpactFrames": 8,
        "stripsBySlot": ["weapon1", "weapon2", "et01", "weapon3"],
    },
}


def build_slot_heuristic(strips: dict) -> list[str]:
    """Default strip order hint — runtime remaps with live weapons[] when present."""
    order = []
    if "map" in strips:
        order.append("map")
    for w in ("weapon1", "weapon2", "weapon3", "weapon4"):
        if w in strips:
            order.append(w)
    if "et01" in strips:
        order.append("et01")
    return order


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--sim", type=Path, default=DEFAULT_SIM)
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()

    sim = args.sim
    koma_root = sim / "koma"
    fx_root = sim / "fx"
    if not koma_root.is_dir():
        print("missing koma dir", koma_root, file=sys.stderr)
        return 2

    man_units = {}
    man_path = sim / "meta" / "UR_EXPORT_MANIFEST.json"
    if man_path.is_file():
        man_units = (json.loads(man_path.read_text(encoding="utf-8")).get("units") or {})

    fx_prefixes = index_fx_prefixes(fx_root)
    ur_by_koma = load_ur_units()

    by_unit: dict[str, dict] = {}
    by_koma: dict[str, dict] = {}

    for kid_dir in sorted(koma_root.iterdir()):
        if not kid_dir.is_dir():
            continue
        kid = kid_dir.name
        strips, standby_frame = scan_koma_strips(kid_dir, kid)
        if not strips and standby_frame == 0:
            # still allow standby-only
            pass
        refs = list((man_units.get(kid) or {}).get("fx_refs") or [])
        impact, impact_n = pick_fx(fx_prefixes, refs, "ranged")
        melee, melee_n = pick_fx(fx_prefixes, refs, "melee")
        ex, ex_n = pick_fx(fx_prefixes, refs, "ex")
        if not melee:
            melee, melee_n = impact, impact_n
        if not ex:
            ex, ex_n = impact, impact_n

        kit = {
            "komaId": kid,
            "standbyFrame": standby_frame,
            "strips": strips,
            "stripsBySlot": build_slot_heuristic(strips),
            "impactFx": impact,
            "impactFrames": impact_n,
            "meleeImpactFx": melee,
            "meleeImpactFrames": melee_n,
            "exImpactFx": ex,
            "exImpactFrames": ex_n,
        }
        by_koma[kid] = kit
        unit_ids = ur_by_koma.get(kid) or list((man_units.get(kid) or {}).get("unit_ids") or [])
        for uid in unit_ids:
            entry = dict(kit)
            ov = OVERRIDES.get(str(uid))
            if ov:
                entry.update(ov)
            by_unit[str(uid)] = entry

    catalog = {
        "version": 1,
        "purpose": "MLS IngameKoma catalog for all UR kits",
        "cdn_folder": "images/Master League/Simulator",
        "unit_count": len(by_unit),
        "koma_count": len(by_koma),
        "byUnitId": by_unit,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    # also pretty for debugging
    pretty = args.out.with_name(args.out.stem + "_pretty.json")
    pretty.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {args.out}  units={len(by_unit)} koma={len(by_koma)} fx_prefixes={len(fx_prefixes)}")
    # spot checks
    for uid in ("1217002150", "1217000650", "1001000150"):
        k = by_unit.get(uid)
        if not k:
            print(" missing", uid)
            continue
        print(
            uid,
            k["komaId"],
            "strips",
            list(k["strips"].keys()),
            "impact",
            k.get("impactFx"),
            k.get("impactFrames"),
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
