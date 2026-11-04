import json, pathlib
# Find trait master row for beam DTU and ResourceId / icon
mt = json.loads(pathlib.Path("data/EN/master/m_trait.json").read_text(encoding="utf-8"))
# structure
if isinstance(mt, list):
  print("list", len(mt), "sample keys", list(mt[0].keys())[:30] if mt else None)
  # find by id ending 160501 or similar for 35%
  for row in mt:
    rid = str(row.get("Id") or row.get("id") or "")
    if "300160" in rid or rid.endswith("00160105") or "1605" in rid:
      print(row)
      break
  # print a few with Resource
  for row in mt[:3]:
    print("sample", {k:row.get(k) for k in list(row)[:15]})
elif isinstance(mt, dict):
  print("dict keys", list(mt)[:10])
  rows = mt.get("rows") or mt.get("Records") or list(mt.values())[:1]
