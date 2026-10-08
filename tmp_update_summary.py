import json
from pathlib import Path
from collections import Counter

OLD = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-07")
NEW = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-08")
LANG = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-08")

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def lmap(name):
    p=LANG/name
    if not p.exists(): return {}
    return {str(r.get("id") or r.get("Id")): str(r.get("value") or r.get("Value") or "") for r in load(p) if isinstance(r, dict)}
def by_id(rows):
    return {str(r["Id"]): r for r in rows if isinstance(r, dict) and "Id" in r}
def added(fn):
    a,b=by_id(load(OLD/fn)), by_id(load(NEW/fn))
    return sorted(set(b)-set(a), key=lambda x: int(x) if x.isdigit() else x), a, b

ul, cl, sl, il, ol, stl, erl, msl = lmap("m_unit.json"), lmap("m_character.json"), lmap("m_series.json"), lmap("m_item.json"), lmap("m_option_parts.json"), lmap("m_stage.json"), lmap("m_eternal_road_stage.json"), lmap("m_mission.json")

print("=== SERIES ===")
ids,a,b=added("m_series.json")
for i in ids:
    r=b[i]; lid=str(r.get("NameLanguageId") or r.get("LanguageId") or "")
    print(i, sl.get(lid) or sl.get(str(r.get("Id")),""), r)

print("\n=== UNITS ===")
ids,a,b=added("m_unit.json")
for i in ids:
    r=b[i]
    lid=str(r.get("NameLanguageId") or 0)
    print(f"unit {i}: {ul.get(lid,'?')} rarity={r.get('RarityTypeIndex')} role={r.get('RoleTypeIndex')} recChar={r.get('RecommendCharacterId')} seriesSet={r.get('SeriesSetId')} acq={r.get('UnitAcquisitionRouteTypeIndex')} sched={r.get('ScheduleId')}")

print("\n=== CHARACTERS ===")
ids,a,b=added("m_character.json")
for i in ids:
    r=b[i]
    lid=str(r.get("NameLanguageId") or 0)
    print(f"char {i}: {cl.get(lid,'?')} rarity={r.get('RarityTypeIndex')} role={r.get('RoleTypeIndex')} recUnit={r.get('RecommendUnitId')} sched={r.get('ScheduleId')}")

print("\n=== ETERNAL ROAD STAGES ===")
ids,a,b=added("m_eternal_road_stage.json")
for i in ids:
    r=b[i]
    lid=str(r.get("NameLanguageId") or 0)
    print(f"ER {i}: {erl.get(lid) or stl.get(lid,'?')} diff={r.get('StageDifficultyTypeIndex')} no={r.get('StageNumber')} stageId={r.get('StageId')}")

print("\n=== LITE SCENARIO / COLLAB ===")
for fn in ["m_lite_scenario_event.json","m_lite_scenario_event_stage.json","m_lite_scenario_event_total_reward_diamond.json"]:
    a,b=by_id(load(OLD/fn)) if (OLD/fn).exists() else {}, by_id(load(NEW/fn))
    print(fn, f"{len(a)}->{len(b)} +{len(set(b)-set(a))}")
    for i in sorted(set(b)-set(a), key=lambda x: int(x) if x.isdigit() else x):
        print(" ", i, b[i])

print("\n=== OPTION PARTS ===")
ids,a,b=added("m_option_parts.json")
print("added", len(ids))
for i in ids[:30]:
    r=b[i]; lid=str(r.get("NameLanguageId") or 0)
    print(f"  OP {i}: {ol.get(lid,'?')} rarity={r.get('RarityTypeIndex')}")

print("\n=== LOGIN BONUS ===")
ids,a,b=added("m_login_bonus.json")
for i in ids:
    print(i, b[i])
# rewards count
lbr_a, lbr_b = load(OLD/"m_login_bonus_reward.json"), load(NEW/"m_login_bonus_reward.json")
print("login rewards", len(lbr_a), "->", len(lbr_b))

print("\n=== ITEMS (new sample) ===")
ids,a,b=added("m_item.json")
print("added items", len(ids))
for i in ids[:40]:
    r=b[i]; lid=str(r.get("NameLanguageId") or 0)
    print(f"  {i}: {il.get(lid,'?')[:80]} type={r.get('ItemTypeIndex')}")

print("\n=== MISSIONS new count ===")
ids,a,b=added("m_mission.json")
print("added missions", len(ids))
for i in ids[:25]:
    r=b[i]; lid=str(r.get("NameLanguageId") or r.get("DescriptionLanguageId") or 0)
    print(f"  {i}: {msl.get(str(r.get('NameLanguageId') or ''), msl.get(str(r.get('DescriptionLanguageId') or ''), '?'))[:100]}")

print("\n=== CAMPAIGN ===")
if (NEW/"m_campaign.json").exists():
    ca,cb=by_id(load(OLD/"m_campaign.json")), by_id(load(NEW/"m_campaign.json"))
    print(f"{len(ca)}->{len(cb)} +{len(set(cb)-set(ca))} ~{sum(1 for i in set(ca)&set(cb) if ca[i]!=cb[i])}")
    camp_l=lmap("m_campaign.json")
    for i in sorted(set(cb)-set(ca), key=lambda x: int(x) if x.isdigit() else x)[:20]:
        r=cb[i]
        print(i, camp_l.get(str(r.get("NameLanguageId") or ""), r))

print("\n=== TRAIT / ABILITY new counts ===")
for fn in ["m_trait.json","m_ability.json","m_trait_set.json","m_weapon.json"]:
    a,b=by_id(load(OLD/fn)), by_id(load(NEW/fn))
    print(fn, f"+{len(set(b)-set(a))} ~{sum(1 for i in set(a)&set(b) if a[i]!=b[i])}")
