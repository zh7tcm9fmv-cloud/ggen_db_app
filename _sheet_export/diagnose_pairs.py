"""Diagnose SSP/pilot pairs from reviewer feedback."""
from __future__ import annotations

import json
from pathlib import Path

pub = json.loads(
    Path(r"c:\Users\Mikew0911\Desktop\ggen_db_app\data\published\sp_investment_v1.json").read_text(
        encoding="utf-8"
    )
)


def find(board: dict, needles: list[str]) -> list[dict]:
    out = []
    for bucket, rows in board.items():
        for r in rows:
            name = r.get("name") or ""
            if any(n.lower() in name.lower() for n in needles):
                out.append(r)
    out.sort(key=lambda x: (-int(x.get("total") or 0), x.get("name") or ""))
    return out


def show(label: str, rows: list[dict]) -> None:
    print(f"\n===== {label} =====")
    for r in rows:
        bd = r.get("breakdown") or {}
        meta = r.get("meta") or {}
        print(
            f"{r.get('letter')} {r.get('total')} {r.get('bucket')} | {r.get('name')} "
            f"| role={r.get('role')} rarity={r.get('rarity')}"
        )
        # sort breakdown by abs points
        items = sorted(bd.items(), key=lambda kv: -abs(int(kv[1] or 0)))
        print("  breakdown:", ", ".join(f"{k}={v}" for k, v in items if int(v or 0) != 0))
        # useful feature hints
        for k in (
            "weapon_range",
            "movement",
            "has_map",
            "map_coverage",
            "terrain",
            "low_hp",
            "weapon_condition",
        ):
            if k in r:
                print(f"  {k}={r.get(k)}")
        if r.get("tags"):
            print("  tags:", ", ".join(r.get("tags")[:12]))
        if meta:
            interesting = {
                k: meta[k]
                for k in meta
                if k
                in (
                    "er_expert_eligible_count",
                    "er_access_mode",
                    "weapon_bonus",
                    "map",
                    "abilities",
                    "series_advantage",
                )
            }
            if interesting:
                print("  meta:", interesting)


ssp = pub["ssp"]
chars = pub["characters"]["sp"]

show("Virsago / Pharact", find(ssp, ["Virsago", "Pharact"]))
show("Deathscythe / Dark Gundam", find(ssp, ["Deathscythe", "Dark Gundam"]))
show("Banshee / FA MK / Atlas", find(ssp, ["Banshee Norn", "FA MK", "Mk-III", "MK-III", "Atlas"]))
show("Dozle / Chuchu", find(chars, ["Dozle", "Chuatury", "Panlunch"]))

# letter cutoffs reminder
guide = pub.get("scoring_guide") or {}
print("\nSSP priority count", len(ssp.get("priority") or []))
print("SSP S+/S sample sizes", sum(1 for b,rows in ssp.items() for r in rows if r.get("letter")=="S+"),
      sum(1 for b,rows in ssp.items() for r in rows if r.get("letter")=="S"))
