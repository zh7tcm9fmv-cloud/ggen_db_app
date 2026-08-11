"""Deep feature dump for reviewer unit pairs (SSP)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(r"c:\Users\Mikew0911\Desktop\ggen_db_app")
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ.setdefault("GGEN_TIER_USE_BUNDLED_EN", "1")

import app as A  # noqa: E402
import sp_investment_rank as SIR  # noqa: E402

rules = SIR.load_rules()
er_filters = SIR.build_er_expert_filters(A, "EN")
expert_ids = [e["id"] for e in er_filters]
unit_restricted = [e["id"] for e in er_filters if e.get("unit_restrictions")]
# stages with empty unit restrictions?
unit_free = [e for e in er_filters if not e.get("unit_restrictions")]
print(f"Expert {len(expert_ids)} unit-restricted-nonempty={len(unit_restricted)} unit-empty-restrictions={len(unit_free)}")
for e in unit_free[:5]:
    print("  free-ish", e.get("number"), e.get("unit_label"), "char_free", e.get("character_free_for_all"))

uids = {
    "Virsago CB": "1230003900",
    "Pharact S2": "1501002400",
    "Deathscythe EW": "1219000200",
    "Dark Gundam FF": "1200005300",
    "Banshee Destroy": "1125001100",
    "FA Mk-III": "1115000400",
    "Atlas": "1031001200",
}

for label, uid in uids.items():
    feats = SIR.extract_unit_features(A, uid, mode="ssp", lc="EN", rules=rules)
    if not feats:
        print(label, "NO FEATS")
        continue
    elig = [sid for sid in expert_ids if SIR.entity_eligible_on_stage(A, uid, sid, "unit", "EN")]
    # restricted = stages that have any unit restriction labels
    rest_ids = [e["id"] for e in er_filters if e.get("unit_restrictions")]
    elig_rest = [sid for sid in rest_ids if SIR.entity_eligible_on_stage(A, uid, sid, "unit", "EN")]
    scored = SIR.score_features({**feats, "er_expert_eligible_count": len(elig)}, rules)
    print(f"\n==== {label} {feats.get('name')} total={scored['total']} {scored['letter']} ====")
    print("terrain", feats.get("terrain"), "mov", feats.get("movement"), "range", feats.get("weapon_range"))
    print("weapon_power", feats.get("weapon_power"), "atk", feats.get("atk"), "weapon_bonus_type", feats.get("weapon_bonus_type"))
    print("has_map", feats.get("has_map"), "map_cells", feats.get("map_coverage_cells"), "map_dash", feats.get("map_is_dash"))
    print("weapon_condition", feats.get("weapon_condition"), "max_tension", feats.get("has_max_tension_higher"))
    print("low_hp_best?", feats.get("best_weapon_low_hp"), feats.get("weapon_hp_gate"))
    print("abilities sample", (feats.get("ability_effects") or [])[:4])
    print("debuff kinds", feats.get("support_debuff_kinds"), "max_debuff", feats.get("max_debuff_pct"), feats.get("max_debuff_level"))
    print("debuff ranges", feats.get("debuff_weapon_ranges"), feats.get("support_r4_debuff_kinds"))
    print("series_advantage", feats.get("series_advantage"))
    print("ER all", len(elig), "ER unit-restricted-eligible", len(elig_rest))
    bd = scored["breakdown"]
    print("breakdown", {k: v for k, v in bd.items() if int(v or 0)})
