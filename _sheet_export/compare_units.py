import csv
import json
import re
from pathlib import Path

pub = json.loads(
    Path(r"c:\Users\Mikew0911\Desktop\ggen_db_app\data\published\sp_investment_v1.json").read_text(
        encoding="utf-8"
    )
)
sheet = []
with open(
    r"c:\Users\Mikew0911\Desktop\ggen_db_app\_sheet_export\unit_investment.csv", encoding="utf-8"
) as f:
    for i, row in enumerate(csv.reader(f)):
        if i == 0:
            continue
        if not row or not row[0]:
            continue
        sheet.append(
            {
                "name": row[0],
                "stages": int(row[3] or 0),
                "sp_req": row[2],
                "role": row[4],
                "rarity": row[5],
            }
        )
flat = []
for b, rows in pub["units"]["sp"].items():
    flat.extend(rows)


def norm(n):
    n = re.sub(r"^(SSR |SR |UR2? )", "", n)
    n = re.sub(r"\s*\(SP\)\s*", "", n)
    return n.strip().lower()


idx = {norm(u["name"]): u for u in flat}
print("sheet top 25 vs SPI")
for s in sheet[:25]:
    u = idx.get(norm(s["name"]))
    if not u:
        for k, v in idx.items():
            if norm(s["name"]) in k or k in norm(s["name"]):
                u = v
                break
    if u:
        print(
            f"  ER*{s['stages']} {s['name'][:34]:34} -> {u.get('letter')} {u.get('total')} {u.get('bucket')}"
        )
    else:
        print(f"  ER*{s['stages']} {s['name'][:34]:34} -> MISS")

# Breakdown weight analysis for characters: avg points by axis for priority vs niche
print("\nAvg breakdown by bucket (characters):")
from collections import defaultdict

sums = defaultdict(lambda: defaultdict(float))
counts = defaultdict(int)
for b, rows in pub["characters"]["sp"].items():
    for r in rows:
        counts[b] += 1
        for k, v in (r.get("breakdown") or {}).items():
            sums[b][k] += float(v or 0)
for b in ("priority", "recommended", "solid", "situational", "niche"):
    n = counts[b] or 1
    parts = ", ".join(f"{k}={sums[b][k]/n:.1f}" for k in sorted(sums[b]))
    print(f"  {b} (n={counts[b]}): {parts}")
