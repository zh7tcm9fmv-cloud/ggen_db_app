import json, pathlib, re
# Find trait ids for Damage Taken from Beam
lang = json.loads(pathlib.Path("data/EN/lang/m_trait.json").read_text(encoding="utf-8"))
hits=[]
for row in lang:
  if not isinstance(row, dict): continue
  v=str(row.get("value") or "")
  if "Damage Taken from Beam" in v or "Damage Taken from Physical" in v or "Damage Taken from Special" in v:
    hits.append((row.get("id"), v))
print("lang hits", len(hits))
for h in hits[:12]: print(h)

# master trait for icons / ResourceId
for name in ["m_trait.json","m_trait_set_detail.json"]:
  p=pathlib.Path("data/EN/master")/name
  if p.exists():
    print("has", name, p.stat().st_size)
