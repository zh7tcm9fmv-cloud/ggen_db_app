#!/usr/bin/env python3
"""Scan UR koma dirs: catalog standbyFrame vs actual standby files / sibling ids."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAT = ROOT / "data" / "published" / "mls_koma_catalog_v1.json"
SIM = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\Master League\Simulator\koma")
MASTER = ROOT / "data" / "EN" / "master" / "m_unit.json"

rows = json.loads(MASTER.read_text(encoding="utf-8"))
ur_kids = sorted(
    {
        str(r.get("KomaResourceId") or "").strip()
        for r in rows
        if str(r.get("RarityTypeIndex")) == "5" and r.get("KomaResourceId")
    }
)

missing_standby = []
has_sibling_only = []
ok = 0
for kid in ur_kids:
    d = SIM / kid
    if not d.is_dir():
        missing_standby.append((kid, "no_dir"))
        continue
    own = list(d.glob(f"{kid}_standby*.webp"))
    any_standby = list(d.glob("*_standby*.webp"))
    if own:
        ok += 1
        continue
    if any_standby:
        ids = sorted({p.name.split("_standby")[0] for p in any_standby})
        has_sibling_only.append((kid, ids, [p.name for p in any_standby[:4]]))
    else:
        missing_standby.append((kid, "no_standby_files"))

print("UR koma ids", len(ur_kids))
print("ok own standby", ok)
print("sibling-only standby", len(has_sibling_only))
for row in has_sibling_only[:20]:
    print(" ", row)
print("missing standby", len(missing_standby))
for row in missing_standby[:30]:
    print(" ", row)
