import json
from pathlib import Path
from collections import Counter, defaultdict

NEW = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-08")
OLD = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-07")
LANG = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-08")
APP = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\data\EN\master")
APPL = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\data\EN\lang")

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def lmap(folder, name):
    p = folder / name
    if not p.exists(): return {}
    rows = load(p)
    return {str(r.get("id") or r.get("Id")): str(r.get("value") or r.get("Value") or "") for r in rows if isinstance(r, dict)}

def by_id(rows):
    out={}
    for r in rows:
        if isinstance(r, dict) and "Id" in r: out[str(r["Id"])]=r
    return out

# Prefer app enums if present
enums = {}
for cand in [APP/"../game_enums.json", Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\game_enums.json"), Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\data\game_enums.json")]:
    if cand.exists():
        enums = load(cand); break
print("enums keys sample", list(enums)[:20] if enums else None)

# Try find Profile* in app.py or enums via grep-like
print("\n=== PROFILE RANK TABLE ===")
ranks = load(NEW/"m_profile_rank.json")
# format: [rank, pointsRequired?, langId?, ...]
print("row0", ranks[0])
print("row1", ranks[1])
print("row2", ranks[2])
print("lens", Counter(len(r) for r in ranks))
# resolve lang for third field
rl = lmap(LANG, "m_profile_rank.json")
print("rank lang entries", len(rl), "sample", list(rl.items())[:5])
for r in ranks:
    rid, pts, lid = r[0], r[1], r[2] if len(r)>2 else None
    name = rl.get(str(lid), "") if lid else ""
    extra = r[3:] if len(r)>3 else []
    print(f"  Rank {rid:2d}: need={pts:>6} name={name!r} extra={extra}")

print("\n=== PROFILE ACHIEVEMENT CATEGORIES ===")
cats = load(NEW/"m_profile_achievement_category.json")
cl = lmap(LANG, "m_profile_achievement_category.json")
for r in cats:
    print(r, "name=", cl.get(str(r.get("NameLanguageId") or r.get("LanguageId") or ""), ""))

print("\n=== PROFILE ACHIEVEMENT RECORDS ===")
ach = load(NEW/"m_profile_achievement_record.json")
al = lmap(LANG, "m_profile_achievement_record.json")
print("row0", ach[0] if isinstance(ach[0], dict) else ach[0])
if isinstance(ach[0], list):
    for r in ach:
        print(r)
else:
    for r in ach:
        name=""
        for k,v in r.items():
            if "Language" in k: name = al.get(str(v),"") or name
        print(name or "?", r)

print("\n=== PROFILE CUMULATIVE RECORDS ===")
cum = load(NEW/"m_profile_cumulative_record.json")
cul = lmap(LANG, "m_profile_cumulative_record.json")
print("row0", cum[0])
if isinstance(cum[0], list):
    for r in cum:
        lid = r[2] if len(r)>2 else None
        print(f"  {r} name={cul.get(str(lid),'')!r}")
else:
    for r in cum:
        name=""
        for k,v in r.items():
            if "Language" in k: name = cul.get(str(v),"") or name
        print(f"  {name}: {r}")

print("\n=== PROFILE USER RECORDS ===")
ur = load(NEW/"m_profile_user_record.json")
ul = lmap(LANG, "m_profile_user_record.json")
print("row0", ur[0])
if isinstance(ur[0], list):
    for r in ur:
        lid=r[2] if len(r)>2 else None
        print(f"  {r} name={ul.get(str(lid),'')!r}")
else:
    for r in ur:
        name=""
        for k,v in r.items():
            if "Language" in k: name = ul.get(str(v),"") or name
        print(f"  {name}: {r}")

print("\n=== PROFILE TITLE TYPES / RARITY COUNTS ===")
titles = load(NEW/"m_profile_title.json")
print("fields", list(titles[0].keys()))
print("typeIndex", Counter(t.get("ProfileTitleTypeIndex") for t in titles))
print("titleRarity", Counter(t.get("ProfileTitleRarityTypeIndex") for t in titles))
print("rarity", Counter(t.get("RarityTypeIndex") for t in titles))
print("simpleThumb", Counter(t.get("IsSimpleThumbnail") for t in titles))
# today's new ones already known
