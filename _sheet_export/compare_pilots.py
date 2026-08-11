import csv
import json
import re
from collections import Counter
from pathlib import Path

base = Path(__file__).resolve().parent
pub = json.loads(
    Path(r"c:\Users\Mikew0911\Desktop\ggen_db_app\data\published\sp_investment_v1.json").read_text(
        encoding="utf-8"
    )
)
chars = pub["characters"]["sp"]

all_c = []
for bucket, rows in chars.items():
    for r in rows:
        all_c.append(
            {
                "bucket": bucket,
                "name": r.get("name") or r.get("name_en") or "",
                "id": r.get("id") or r.get("character_id"),
                "role": r.get("role"),
                "letter": r.get("letter") or r.get("grade"),
                "score": r.get("score") or r.get("total"),
                "rarity": r.get("rarity"),
                "er": (r.get("features") or {}).get("er_expert_eligible_count")
                or r.get("er_expert_eligible_count"),
                "breakdown": r.get("breakdown") or {},
            }
        )

print("sample keys from row:", sorted((chars["priority"][0] or {}).keys())[:40])
print("sample row snippet:", {k: chars["priority"][0].get(k) for k in list(chars["priority"][0])[:25]})
print("total", len(all_c))
print("letters", Counter(c["letter"] for c in all_c))
print("buckets", Counter(c["bucket"] for c in all_c))

for role in ("Attack", "Support", "Defense"):
    sub = [c for c in all_c if c["role"] == role]
    sub.sort(key=lambda x: -(x["score"] or 0))
    print(f"\n=== {role} top 15 ===")
    for c in sub[:15]:
        print(
            f"  {c['letter']!s:>3} {c['score']!s:>3} {c['bucket']:12} {c['name']} [{c['rarity']}] er={c['er']}"
        )

suggested = []
with base.joinpath("pilot_sp.csv").open(encoding="utf-8") as f:
    rows = list(csv.reader(f))
for row in rows[7:]:
    series = row[0] if row else ""
    for role, ni, ri in (("Attack", 1, 2), ("Support", 3, 4), ("Defense", 5, 6)):
        if len(row) > ni and row[ni].strip():
            name = row[ni].strip()
            reason = row[ri].strip() if len(row) > ri else ""
            if name == "Free":
                continue
            suggested.append((series, role, name, reason))


def norm(n: str) -> str:
    n = re.sub(r"^(SSR |SR |UR2? )", "", n)
    n = re.sub(r"\s*\(SP\)\s*", "", n)
    n = re.sub(r"\s+", " ", n).strip().lower()
    return n


name_index = {norm(c["name"]): c for c in all_c}

print("\n=== Spreadsheet Pilot SP Suggestions vs our scores ===")
found = miss = 0
for series, role, name, reason in suggested:
    key = norm(name)
    hit = name_index.get(key)
    if not hit:
        for k, c in name_index.items():
            if key in k or k.startswith(key) or key.startswith(k):
                hit = c
                break
    if hit:
        found += 1
        print(
            f"{series:12} {role:8} sheet={name:30} -> {hit['letter']} {hit['score']} "
            f"{hit['bucket']:12} our={hit['role']} er={hit['er']} :: {reason[:60]}"
        )
    else:
        miss += 1
        print(f"{series:12} {role:8} sheet={name:30} -> NOT FOUND :: {reason[:60]}")
print(f"matched {found} missed {miss}")

# Count pilot name frequency in Expert ER (all cells)
er_text = base.joinpath("expert_er.csv").read_text(encoding="utf-8")
# known high-frequency generics from sheet criteria
watch = [
    "Kelley Layzner",
    "Sampo",
    "Quatre",
    "Christina Mackenzie",
    "Monique",
    "Ramba Ral",
    "Andrew",
    "Lockon",
    "Shiro",
    "Kou",
    "Sayla",
    "Herbert Von Kuspen",
    "Johnny",
    "Xavier",
    "Lane Aim",
    "Haman",
    "Amuro",
    "Lalah",
    "Elpeo",
    "Meer",
    "Lacus",
    "Witz",
    "Gaelio",
    "Marida",
    "Jona",
    "Mika",
    "Setsuna",
    "Heero",
    "Dorothy",
    "Allenby",
    "Auel",
    "Asemu",
    "Desil",
    "Woolf",
    "Zeheart",
    "Wufei",
    "Trowa",
    "Milliardo",
    "Bosch",
    "Seabook",
    "Carozzo",
    "Athrun",
    "Kira",
    "Norea",
    "Elan",
    "Shagia",
    "Watts",
    "Rain",
    "Hush",
    "Kamille",
    "Judau",
    "Char",
    "Quattro",
]
print("\n=== Expert ER name hit counts (substring) ===")
for w in watch:
    c = len(re.findall(re.escape(w), er_text, flags=re.I))
    if c:
        # our best match
        hits = [x for x in all_c if w.lower() in norm(x["name"])]
        hits.sort(key=lambda x: -(x["score"] or 0))
        top = hits[0] if hits else None
        if top:
            print(
                f"  ER×{c:3} {w:22} -> best {top['letter']} {top['score']} {top['bucket']:12} {top['name']} [{top['role']}]"
            )
        else:
            print(f"  ER×{c:3} {w:22} -> no SPI match")
