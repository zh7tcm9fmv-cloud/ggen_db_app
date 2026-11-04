import json, pathlib
# TraitTypeIndex 14 might be DTU - find NameLanguageId / description for 300160
mt = json.loads(pathlib.Path("data/EN/master/m_trait.json").read_text(encoding="utf-8"))
lang = {row["id"]: row["value"] for row in json.loads(pathlib.Path("data/EN/lang/m_trait.json").read_text(encoding="utf-8")) if isinstance(row,dict)}
# Trait for inflict beam 35% - DescriptionLanguageId 141200000300160401 or similar
for row in mt:
  did = row.get("DescriptionLanguageId")
  txt = lang.get(did) or lang.get(int(did) if did else 0) or ""
  if "Damage Taken from Beam Weapons Up" in txt and int(row.get("TraitValue") or 0)==35:
    print("FOUND", row.get("Id"), "type", row.get("TraitTypeIndex"), "val", row.get("TraitValue"), txt[:80])
# Also check m_trait_set for icons on weapon traits
# Look at API weapon for icon on traits - maybe traits are just strings
u=json.load(__import__("urllib.request").request.urlopen("http://127.0.0.1:5000/api/unit/1501002450?lang=EN"))
for w in u["weapons"]:
  if w.get("is_ex") and "Beam Musket" in (w.get("name") or ""):
    print("traits type", type(w["traits"][0]), w["traits"])
    print("levels traits", w["levels"][-1].get("traits"))
