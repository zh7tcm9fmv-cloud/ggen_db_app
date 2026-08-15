# -*- coding: utf-8 -*-
"""
Local preview of Investment Priority (/ip) scoring deltas.

Does NOT write data/published/sp_investment_v1.json.

Reports:
  - Range Condition Damage Reduction → special_defense floor +2
  - Special weapon damage-type preference +1
  - SP vs SSP weapon_range audit (enhance / Custom Core)

Usage:
  python scripts/preview_sp_investment_deltas.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ.setdefault("GGEN_TIER_USE_BUNDLED_EN", "1")
os.environ.setdefault("GGEN_SKIP_PREWARM", "1")

import app as A  # noqa: E402
import sp_investment_rank as SIR  # noqa: E402

LC = "EN"


def _score(uid: str, mode: str, rules: dict) -> dict | None:
    try:
        return SIR.score_unit(A, uid, mode=mode, lc=LC, rules=rules, er_expert_ids=[])
    except Exception as e:
        print(f"  skip {uid} {mode}: {e}")
        return None


def main() -> None:
    SIR.clear_rules_cache()
    rules = SIR.load_rules()
    # Baseline: disable new premiums
    base_rules = json_deepcopy(rules)
    base_rules.setdefault("special_defense", {})["ex_range_dr_min_points"] = 0
    base_rules["weapon_damage_attr"] = {"enabled": False, "special_points": 0, "other_points": 0}

    eligible = SIR.iter_eligible_unit_ids(A, rules)
    print(f"Eligible units: {len(eligible)}")
    print()

    rc_hits = []
    special_hits = []
    total_deltas = []
    ssp_range_audit = []

    for uid in eligible:
        for mode in ("sp", "ssp"):
            old = _score(uid, mode, base_rules)
            new = _score(uid, mode, rules)
            if not old or not new:
                continue
            od = old.get("breakdown") or {}
            nd = new.get("breakdown") or {}
            dt = int(new.get("total") or 0) - int(old.get("total") or 0)
            name = new.get("name") or uid
            role = new.get("role")

            feats_new = SIR.extract_unit_features(A, uid, mode=mode, lc=LC, rules=rules) or {}
            if feats_new.get("has_ex_range_damage_reduction") and int(nd.get("special_defense") or 0) != int(
                od.get("special_defense") or 0
            ):
                rc_hits.append(
                    (
                        uid,
                        name,
                        role,
                        mode,
                        od.get("special_defense"),
                        nd.get("special_defense"),
                        old.get("total"),
                        new.get("total"),
                        old.get("letter"),
                        new.get("letter"),
                    )
                )

            if int(nd.get("weapon_damage_attr") or 0) > int(od.get("weapon_damage_attr") or 0):
                special_hits.append(
                    (
                        uid,
                        name,
                        role,
                        mode,
                        feats_new.get("best_weapon_dmg_attr_keys"),
                        old.get("total"),
                        new.get("total"),
                        old.get("letter"),
                        new.get("letter"),
                    )
                )

            if dt:
                total_deltas.append((dt, uid, name, role, mode, old.get("letter"), new.get("letter"), old.get("total"), new.get("total")))

            if mode == "ssp":
                fsp = SIR.extract_unit_features(A, uid, mode="sp", lc=LC, rules=rules) or {}
                fssp = SIR.extract_unit_features(A, uid, mode="ssp", lc=LC, rules=rules) or {}
                rsp, rssp = int(fsp.get("weapon_range") or 0), int(fssp.get("weapon_range") or 0)
                if rssp != rsp or rssp <= 4:
                    ssp_range_audit.append((uid, name, role, rsp, rssp, od.get("weapon_range"), nd.get("weapon_range")))

    print("=== B1 Range Condition DR (special_defense floor +2) ===")
    print(f"hits: {len(rc_hits)}")
    for row in rc_hits[:40]:
        print(
            f"  {row[0]} {row[1]} [{row[2]}/{row[3]}] sd {row[4]}->{row[5]} total {row[6]}->{row[7]} letter {row[8]}->{row[9]}"
        )
    print()

    print("=== B2 Special damage-type +1 (sample / count) ===")
    # Deduplicate by uid+mode
    print(f"hits: {len(special_hits)}")
    for row in special_hits[:25]:
        print(
            f"  {row[0]} {row[1]} [{row[2]}/{row[3]}] attrs={row[4]} total {row[5]}->{row[6]} letter {row[7]}->{row[8]}"
        )
    if len(special_hits) > 25:
        print(f"  ... +{len(special_hits) - 25} more")
    print()

    print("=== Total deltas (non-zero, top 40 by |delta|) ===")
    total_deltas.sort(key=lambda x: (-abs(x[0]), x[1], x[4]))
    for row in total_deltas[:40]:
        print(
            f"  {row[0]:+d} {row[1]} {row[2]} [{row[3]}/{row[4]}] letter {row[5]}->{row[6]} total {row[7]}->{row[8]}"
        )
    print(f"units/modes with any delta: {len(total_deltas)}")
    print()

    print("=== B3 SSP range audit (SP range != SSP or SSP<=4; sample 40) ===")
    short = [r for r in ssp_range_audit if r[4] <= 4]
    gained = [r for r in ssp_range_audit if r[4] > r[3]]
    print(f"SSP still <=4: {len(short)}; SSP range > SP range: {len(gained)}")
    for row in short[:20]:
        print(f"  short {row[0]} {row[1]} [{row[2]}] range SP{row[3]}->SSP{row[4]}")
    for row in gained[:20]:
        print(f"  gain  {row[0]} {row[1]} [{row[2]}] range SP{row[3]}->SSP{row[4]}")
    print()
    print("Published board NOT updated. Run build_sp_investment_rankings.py only after you approve.")


def json_deepcopy(obj):
    import copy

    return copy.deepcopy(obj)


if __name__ == "__main__":
    main()
