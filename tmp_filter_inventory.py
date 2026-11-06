import json
from pathlib import Path
from collections import Counter, defaultdict

base = Path(r"c:\Users\Mikew0911\Desktop\ggen_db_app\data\EN")


def load(p):
    return json.load(open(p, encoding="utf-8"))


def rows(d):
    if isinstance(d, list):
        return d
    if isinstance(d, dict) and "data" in d:
        return d["data"]
    return []


cs = rows(load(base / "master" / "m_character_skill_search_filter_generate.json"))
print("char skill raw type", type(cs[0]) if cs else None, cs[0] if cs else None)
# maybe array of arrays
cslang = {str(r["id"]): r["value"] for r in load(base / "lang" / "m_character_skill_search_filter_generate.json")}
print("cslang sample", list(cslang.items())[:5])
print("cs count", len(cs))
for r in cs:
    if isinstance(r, dict):
        print(" ", r.get("Id"), cslang.get(str(r.get("NameLanguageId")), "?"))
    elif isinstance(r, list):
        print(" listrow", r, "->", cslang.get(str(r[1] if len(r) > 1 else ""), "?"))

print("\n--- ability count ---")
ac = rows(load(base / "master" / "m_character_ability_count_search_filter_generate.json"))
print(ac)
# lang?
for p in (base / "lang").glob("*ability_count*"):
    print("lang", p.name, load(p)[:5] if False else "exists")

print("\n--- weapon items ---")
wi = rows(load(base / "master" / "m_weapon_search_filter_item_generate.json"))
wilang = {str(r["id"]): r["value"] for r in load(base / "lang" / "m_weapon_search_filter_item_generate.json")}
print("keys", wi[0].keys() if isinstance(wi[0], dict) else type(wi[0]))
for r in wi:
    # find name lid field
    lid = None
    for k, v in r.items():
        if str(v) in wilang:
            lid = (k, v)
            break
    name = wilang.get(str(lid[1]), "?") if lid else "?"
    print(r, "=>", name, "via", lid)

print("\n--- weapon generate sample ---")
wf = rows(load(base / "master" / "m_weapon_search_filter_generate.json"))
print("weapon generate count", len(wf), "sample", wf[0] if wf else None)
# huge file - maybe maps weapon id to filter item tags
if wf and isinstance(wf[0], dict):
    print("keys", wf[0].keys())
elif wf and isinstance(wf[0], list):
    print("list len", len(wf[0]), wf[0][:10])

print("\n--- MOV lang? ---")
# MOV labels might be just numbers; check help for Movement
help_map = {str(r["id"]): r["value"] for r in load(base / "lang" / "m_help.json")}
for k, v in help_map.items():
    if "Mov" in v or "MOV" in v or "移動" in v or v == "Move":
        if "1702" in k or "Movement" in v or v in ("Move", "Movement", "移動力"):
            print(k, v)
