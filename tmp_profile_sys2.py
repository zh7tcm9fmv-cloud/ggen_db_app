import json
from pathlib import Path
from collections import Counter, defaultdict

NEW = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-08")
OLD = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-07")
LANG = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-08")
LOLD = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-07")

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def lmap(folder, name):
    p=folder/name
    if not p.exists(): return {}
    return {str(r.get("id") or r.get("Id")): str(r.get("value") or r.get("Value") or "") for r in load(p) if isinstance(r, dict)}
def by_id(rows):
    out={}
    for r in rows:
        if isinstance(r, dict) and "Id" in r: out[str(r["Id"])]=r
        elif isinstance(r, list) and r: out[str(r[0])]=r
    return out

print("=== ACHIEVEMENT CATEGORIES ===")
cats=load(NEW/"m_profile_achievement_category.json")
cl=lmap(LANG,"m_profile_achievement_category.json")
print("row0", cats[0], "lang", len(cl), list(cl.items())[:8])
for r in cats:
    if isinstance(r, list):
        print(r, "->", cl.get(str(r[1] if len(r)>1 else ""), cl.get(str(r[2] if len(r)>2 else ""),"")))
    else:
        print(r)

print("\n=== ACHIEVEMENT RECORDS ===")
ach=load(NEW/"m_profile_achievement_record.json")
al=lmap(LANG,"m_profile_achievement_record.json")
print("row0", ach[0], "lang samples", list(al.items())[:6])
for r in ach:
    print(r)

print("\n=== CUMULATIVE ===")
cum=load(NEW/"m_profile_cumulative_record.json")
cul=lmap(LANG,"m_profile_cumulative_record.json")
print("row0", cum[0])
print("lang", list(cul.items())[:8])
cum_o=load(OLD/"m_profile_cumulative_record.json")
for i,(a,b) in enumerate(zip(cum_o, cum)):
    if a!=b:
        print(f"CHANGED idx {i}")
        print(" OLD", a)
        print(" NEW", b)
        # resolve names
        for row in (a,b):
            if isinstance(row, list):
                for cell in row:
                    if str(cell) in cul: print("  lang", cell, cul[str(cell)])
for r in cum:
    name=""
    if isinstance(r, list):
        for cell in r:
            if str(cell) in cul: name=cul[str(cell)]
        print(f"  {name}: {r}")
    else:
        print(r)

print("\n=== USER RECORDS ===")
ur=load(NEW/"m_profile_user_record.json")
ul=lmap(LANG,"m_profile_user_record.json")
print("row0", ur[0], "lang", list(ul.items())[:10])
for r in ur:
    name=""
    if isinstance(r, list):
        for cell in r:
            if str(cell) in ul: name=ul[str(cell)]
        print(f"  {name}: {r}")
    else:
        print(r)

# reward links for profile titles / points
print("\n=== How titles/points connect (scan m_reward for profile) ===")
# too big maybe - check reward set for new title ids
titles_new = {"10230002000001","10230002000002"}
rw = load(NEW/"m_reward.json")
hits=[]
for r in rw:
    s=json.dumps(r, ensure_ascii=False)
    if "10230002000001" in s or "10230002000002" in s or "profile_title" in s.lower():
        hits.append(r)
print("reward hits", len(hits))
for h in hits[:20]:
    print(" ", h)

# reward_set_content
rsc = load(NEW/"m_reward_set_content.json")
hits2=[]
for r in rsc:
    s=json.dumps(r, ensure_ascii=False)
    if "10230002000001" in s or "10230002000002" in s:
        hits2.append(r)
print("reward_set_content hits", len(hits2))
for h in hits2[:30]:
    print(" ", h)
