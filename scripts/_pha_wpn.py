import json, urllib.request
u = json.load(urllib.request.urlopen("http://127.0.0.1:5000/api/unit/1501002450?lang=EN", timeout=60))
print(u.get("name"))
for w in (u.get("weapons") or []):
  name = w.get("name") or ""
  if "EX" in name or "Barrage" in name or w.get("is_ex"):
    print("---", name, "is_ex", w.get("is_ex"))
    for k in ("traits","effects","debuffs","usage_restrictions","attribute","weapon_type"):
      if w.get(k): print(" ", k, w.get(k)[:5] if isinstance(w.get(k),list) and len(str(w.get(k)))>200 else w.get(k))
    lv = (w.get("levels") or [{}])[-1]
    print("  lv keys", list(lv.keys())[:20])
    for k in ("traits","effects","power","accuracy"):
      if lv.get(k) is not None: print("  lv", k, str(lv.get(k))[:300])
    if w.get("raw"): print("  raw traits", (w["raw"].get("traits") or "")[:200])
