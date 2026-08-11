import json
from collections import Counter
from pathlib import Path

pub = json.loads(
    Path(r"c:\Users\Mikew0911\Desktop\ggen_db_app\data\published\sp_investment_v1.json").read_text(
        encoding="utf-8"
    )
)
chars = []
for b, rows in pub["characters"]["sp"].items():
    chars.extend(rows)
print("letters", Counter(c["letter"] for c in chars))
print("buckets", Counter(c["bucket"] for c in chars))
print(
    "er_access pts",
    dict(Counter(int((c.get("breakdown") or {}).get("er_access") or 0) for c in chars)),
)
print(
    "combat_actions pts",
    dict(Counter(int((c.get("breakdown") or {}).get("combat_actions") or 0) for c in chars)),
)
for b in ("priority", "recommended", "solid", "situational", "niche"):
    rows = [c for c in chars if c["bucket"] == b]
    if not rows:
        continue
    n = len(rows)

    def avg(k):
        return sum(float((r.get("breakdown") or {}).get(k) or 0) for r in rows) / n

    print(
        f"{b} n={n} er={avg('er_access'):.2f} ca={avg('combat_actions'):.2f} "
        f"def={avg('defense'):.2f} kit={avg('skills_abilities'):.2f} aff={avg('series_affinity'):.2f}"
    )

watch = [
    "Sayla Mass",
    "Quatre Raberba Winner",
    "Johnny Ridden",
    "Xavier Olivette",
    "Shani Andras",
    "Auel Neider",
    "Christina Mackenzie",
    "Kelley Layzner",
    "Judau Ashta",
    "Lalah Sune",
    "Herbert Von Kuspen",
]
print("\nCanaries:")
for name in watch:
    for c in chars:
        if c.get("name") == name:
            print(
                f"  {c['letter']:3} {c['total']:3} {c['bucket']:12} {c['role']:8} "
                f"{name} bd={c.get('breakdown')}"
            )

print("\nDefense top 10:")
for c in sorted([c for c in chars if c["role"] == "Defense"], key=lambda x: -x["total"])[:10]:
    bd = c.get("breakdown") or {}
    print(
        f"  {c['letter']:3} {c['total']:3} {c['name']} def={bd.get('defense')} ca={bd.get('combat_actions')}"
    )

print("\nAttack top 10:")
for c in sorted([c for c in chars if c["role"] == "Attack"], key=lambda x: -x["total"])[:10]:
    bd = c.get("breakdown") or {}
    print(
        f"  {c['letter']:3} {c['total']:3} {c['name']} ca={bd.get('combat_actions')} er={bd.get('er_access')}"
    )
