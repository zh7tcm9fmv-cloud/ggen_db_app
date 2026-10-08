import json, os
from pathlib import Path
from collections import Counter, defaultdict

OLD = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-07")
NEW = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-08")
LANG = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-08")

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def by_id(rows, key="Id"):
    out = {}
    for r in rows:
        if isinstance(r, dict) and key in r:
            out[str(r[key])] = r
        elif isinstance(r, dict) and "id" in r:
            out[str(r["id"])] = r
    return out

def lang_map(name):
    rows = load(LANG / name)
    return {str(r.get("id") or r.get("Id")): r.get("value") or r.get("Value") or "" for r in rows if isinstance(r, dict)}

# ---- Profile system deep dive ----
print("=" * 60)
print("PROFILE SYSTEM")
print("=" * 60)
for fn in ["m_profile_rank.json","m_profile_title.json","m_profile_achievement_record.json","m_profile_cumulative_record.json","m_profile_user_record.json","m_profile_achievement_category.json"]:
    op, np = OLD/fn, NEW/fn
    if not np.exists():
        print(fn, "MISSING in new"); continue
    a = load(op) if op.exists() else []
    b = load(np)
    print(f"\n{fn}: {len(a)} -> {len(b)}")
    if not a and b:
        print("  NEW FILE")
    ba, bb = by_id(a), by_id(b)
    added = sorted(set(bb)-set(ba), key=lambda x: int(x) if x.isdigit() else x)
    removed = sorted(set(ba)-set(bb), key=lambda x: int(x) if x.isdigit() else x)
    changed = []
    for i in sorted(set(ba)&set(bb), key=lambda x: int(x) if x.isdigit() else x):
        if ba[i] != bb[i]:
            changed.append(i)
    print(f"  +{len(added)} -{len(removed)} ~{len(changed)}")
    if added[:20]:
        print("  added ids:", ", ".join(added[:30]), ("..." if len(added)>30 else ""))
    if changed[:15]:
        print("  changed ids:", ", ".join(changed[:20]), ("..." if len(changed)>20 else ""))

# titles with names
pt_lang = lang_map("m_profile_title.json")
pt_new = by_id(load(NEW/"m_profile_title.json"))
pt_old = by_id(load(OLD/"m_profile_title.json")) if (OLD/"m_profile_title.json").exists() else {}
print("\n--- New profile titles ---")
for i in sorted(set(pt_new)-set(pt_old), key=lambda x: int(x) if x.isdigit() else x):
    r = pt_new[i]
    lid = str(r.get("NameLanguageId") or r.get("nameLanguageId") or "")
    print(f"  id={i} name={pt_lang.get(lid) or lid} keys={list(r.keys())}")
    print("   ", {k:r[k] for k in r})

print("\n--- Sample profile_rank tiers (first/last 5) ---")
ranks = load(NEW/"m_profile_rank.json")
print("fields:", list(ranks[0].keys()) if ranks else None)
for r in ranks[:5]:
    print(" ", r)
print(" ...")
for r in ranks[-5:]:
    print(" ", r)
print("max rank id/level:", ranks[-1] if ranks else None)

print("\n--- achievement categories ---")
cats = load(NEW/"m_profile_achievement_category.json")
cat_lang = lang_map("m_profile_achievement_category.json") if (LANG/"m_profile_achievement_category.json").exists() else {}
for r in cats:
    lid = str(r.get("NameLanguageId") or r.get("nameLanguageId") or "")
    print(f"  {r.get('Id')}: {cat_lang.get(lid) or lid} | { {k:r[k] for k in r if k!='Id'} }")

print("\n--- cumulative records changed/new ---")
cum_lang = lang_map("m_profile_cumulative_record.json")
cum_n = by_id(load(NEW/"m_profile_cumulative_record.json"))
cum_o = by_id(load(OLD/"m_profile_cumulative_record.json"))
for i in sorted(set(cum_n)|set(cum_o), key=lambda x: int(x) if x.isdigit() else x):
    if i not in cum_o or (i in cum_o and cum_o[i] != cum_n.get(i)):
        r = cum_n.get(i) or cum_o.get(i)
        lid = str(r.get("NameLanguageId") or r.get("nameLanguageId") or r.get("LanguageId") or "")
        # try common lang id fields
        name = ""
        for k in r:
            if "Language" in k or "language" in k:
                name = cum_lang.get(str(r[k]), "") or name
        print(f"  id={i} name={name or '?'} NEW={i not in cum_o}")
        print("   ", r)

print("\n--- achievement records changed (sample) ---")
ach_n = by_id(load(NEW/"m_profile_achievement_record.json"))
ach_o = by_id(load(OLD/"m_profile_achievement_record.json"))
ch=[i for i in ach_n if i in ach_o and ach_n[i]!=ach_o[i]]
ad=sorted(set(ach_n)-set(ach_o), key=lambda x: int(x) if x.isdigit() else x)
print(f"added {len(ad)} changed {len(ch)}")
for i in (ad+ch)[:25]:
    print(f"  {i}: {ach_n[i]}")
