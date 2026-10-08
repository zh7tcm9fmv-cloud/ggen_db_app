import json
from pathlib import Path
LANG=Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-08")
APP=Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\data\EN\lang")
def lmap(folder,name):
 p=folder/name
 if not p.exists(): return {}
 return {str(r.get("id") or r.get("Id")): str(r.get("value") or r.get("Value") or "") for r in json.loads(p.read_text(encoding="utf-8")) if isinstance(r,dict)}
for folder in (LANG, APP):
 m=lmap(folder,"m_comic_series.json")
 for lid in ["350100000000090020","350100000000090021","350100000000090022"]:
  if lid in m: print(folder.name, lid, m[lid])
 m2=lmap(folder,"m_comic_episode.json")
 for lid in ["350309002100010001","350309002200010001","350209002100010001","350209002200010001"]:
  if lid in m2: print(folder.name, "ep", lid, m2[lid][:100])
# Max EX text
tl=lmap(APP,"m_trait.json")
# find by scanning for Ranged, Accuracy, and Reaction
hits=[(k,v) for k,v in tl.items() if "Ranged, Accuracy, and Reaction" in v or "Holo-Actor" in v or "GUNDAM EXA: 15th" in v]
print("trait hits", len(hits))
for k,v in hits[:5]:
 print(k, v[:300])
# Sthesia ability trait set names via ability id mapping in app - use trait_set_detail Resource
tsd=lmap(APP,"m_trait_set_detail.json")
for k,v in tsd.items():
 if "Max EX" in v or "EX LV" in v and "2031001" in k:
  print("tsd",k,v)
# search values Max EX
for k,v in tsd.items():
 if v.startswith("Max EX"):
  print("MaxEX name",k,v)
