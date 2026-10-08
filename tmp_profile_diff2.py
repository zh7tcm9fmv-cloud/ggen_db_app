import json
from pathlib import Path
from collections import Counter, defaultdict

OLD = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-07")
NEW = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-08")
LANG = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-08")
LOLD = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-07")

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def by_id(rows, key="Id"):
    out = {}
    for r in rows:
        if not isinstance(r, dict):
            continue
        k = r.get(key)
        if k is None: k = r.get("id")
        if k is not None: out[str(k)] = r
    return out

def lmap(folder, name):
    p = folder / name
    if not p.exists(): return {}
    rows = load(p)
    return {str(r.get("id") or r.get("Id")): str(r.get("value") or r.get("Value") or "") for r in rows if isinstance(r, dict)}

pt = lmap(LANG, "m_profile_title.json")
print("TITLE NAMES:")
for lid in ["240210230002000001","240210230002000002","240310230002000001","240310230002000002","240110230002000002"]:
    print(f"  {lid}: {pt.get(lid)!r}")

# ranks structure
ranks = load(NEW/"m_profile_rank.json")
print("\nrank type:", type(ranks), "len", len(ranks))
print("first elem type", type(ranks[0]), ranks[0] if not isinstance(ranks[0], list) else ("list len", len(ranks[0]), ranks[0][:2]))
# flatten if nested
flat = ranks
if ranks and isinstance(ranks[0], list):
    flat = ranks
    print("nested lists count", len(ranks), "inner0", ranks[0][:3])
elif ranks and isinstance(ranks[0], dict):
    print("keys", ranks[0].keys())
    for r in ranks[:3]: print(r)
    for r in ranks[-3]: print(r)

# deep compare achievement + cumulative with json dumps
import json as J
for fn in ["m_profile_achievement_record.json","m_profile_cumulative_record.json","m_profile_user_record.json","m_profile_achievement_category.json","m_profile_rank.json"]:
    a,b = load(OLD/fn), load(NEW/fn)
    sa, sb = J.dumps(a, ensure_ascii=False, sort_keys=True), J.dumps(b, ensure_ascii=False, sort_keys=True)
    print(f"\n{fn} identical={sa==sb} len {len(a)}->{len(b)}")
    if sa!=sb:
        # find first differing records
        if isinstance(a, list) and isinstance(b, list) and a and isinstance(a[0], dict):
            ba, bb = by_id(a), by_id(b)
            for i in sorted(set(ba)|set(bb), key=lambda x: int(x) if x.isdigit() else x):
                if ba.get(i)!=bb.get(i):
                    print(" DIFF id", i)
                    print("  OLD", ba.get(i))
                    print("  NEW", bb.get(i))
        else:
            # show short dump lengths
            print("  raw len delta", len(sb)-len(sa))
            # try line diff of pretty
            pa = J.dumps(a, ensure_ascii=False, indent=2).splitlines()
            pb = J.dumps(b, ensure_ascii=False, indent=2).splitlines()
            diffs=0
            for i,(x,y) in enumerate(zip(pa,pb)):
                if x!=y:
                    print(f"  L{i}: -{x}\n       +{y}")
                    diffs+=1
                    if diffs>=12: break
            if len(pa)!=len(pb):
                print(f"  linecount {len(pa)}->{len(pb)}")

# game function release
print("\n=== m_game_function_release ===")
gf_o, gf_n = by_id(load(OLD/"m_game_function_release.json")), by_id(load(NEW/"m_game_function_release.json"))
for i in sorted(set(gf_o)|set(gf_n), key=lambda x: int(x) if x.isdigit() else x):
    if gf_o.get(i)!=gf_n.get(i):
        print("DIFF", i)
        print(" OLD", gf_o.get(i))
        print(" NEW", gf_n.get(i))

# help mentions of profile?
help_lang = lmap(LANG, "m_help.json")
hits=[(k,v) for k,v in help_lang.items() if "profile" in v.lower() or "プロフィール" in v or "稱號" in v or "称号" in v or "Profile" in v]
print("\nhelp profile hits", len(hits))
for k,v in hits[:15]:
    print(f"  {k}: {v[:160]}")
