import json, urllib.request, re
# search via characters/units browse with q
for q in ("Burning Gundam", "Pharact"):
  url = "http://127.0.0.1:5000/api/units?lang=EN&q=" + urllib.parse.quote(q) + "&per_page=20"
  import urllib.parse
  data = json.load(urllib.request.urlopen(url, timeout=60))
  items = data.get("items") or data.get("units") or data.get("rows") or []
  print("q", q, "keys", list(data)[:12], "n", len(items) if isinstance(items,list) else type(items))
  if isinstance(items, list):
    for it in items[:8]:
      print(" ", it.get("id"), it.get("name"))
