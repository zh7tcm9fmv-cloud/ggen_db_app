import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

NEW = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-08")
LANG = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-08")
APP_LANG = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\data\EN\lang")

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def lmap(folder, name):
    p=folder/name
    if not p.exists(): return {}
    return {str(r.get("id") or r.get("Id")): str(r.get("value") or r.get("Value") or "") for r in load(p) if isinstance(r, dict)}

JST = timezone(timedelta(hours=8))  # user is UTC+8; game often JST=+9 — show both
def ms(ts):
    if not ts: return None
    dt = datetime.fromtimestamp(ts/1000, tz=timezone.utc)
    return dt.astimezone(timezone(timedelta(hours=9))).strftime("%Y-%m-%d %H:%M JST")

erl = lmap(LANG, "m_eternal_road_stage.json")
stl = lmap(LANG, "m_stage.json")
# also try app lang if richer
erl2 = lmap(APP_LANG, "m_eternal_road_stage.json")
stl2 = lmap(APP_LANG, "m_stage.json")
scn = lmap(LANG, "m_scenario_stage.json"); scn2=lmap(APP_LANG,"m_scenario_stage.json")

for lid in ["130100000090500031","130100000090510040","130100000090520033","130100000090800201","130100000090800202"]:
    print(lid, "ER", erl.get(lid) or erl2.get(lid), "| stage", stl.get(lid) or stl2.get(lid), "| scn", scn.get(lid) or scn2.get(lid))

# OP name via sort name / trait set detail
ol = lmap(LANG, "m_option_parts.json"); ol2=lmap(APP_LANG,"m_option_parts.json")
print("OP sort", ol.get("270100000000400097"), ol2.get("270100000000400097"))
tsd=lmap(LANG,"m_trait_set_detail.json"); tsd2=lmap(APP_LANG,"m_trait_set_detail.json")
tl=lmap(LANG,"m_trait.json"); tl2=lmap(APP_LANG,"m_trait.json")
# trait set 407010101
ts = load(NEW/"m_trait_set.json")
for r in ts:
    if str(r.get("Id"))=="407010101" or str(r.get("TraitSetId"))=="407010101":
        print("trait_set", r)
# trait_set_detail
for r in load(NEW/"m_trait_set_detail.json"):
    if str(r.get("Id")).startswith("40701") or str(r.get("TraitSetId"))=="407010101":
        print("tsd", r, tsd.get(str(r.get("NameLanguageId")), tsd2.get(str(r.get("NameLanguageId")),"")))

# ability display names from trait_set_detail for Sthesia/Excellia ability ids
print("\nAbility names:")
an=lmap(LANG,"m_ability.json"); an2=lmap(APP_LANG,"m_ability.json") # may not exist
for aid in ["2012903","2000203","2031001","2000201","1000202","1001602","1018001"]:
    # resolve via abil_link -> trait set detail name
    pass
# m_trait_set_detail often keyed by ability-related ids
for r in load(NEW/"m_trait_set_detail.json"):
    rid=str(r.get("Id"))
    if rid.startswith(("2012903","2000203","2031001","2000201","1000202","1001602","1018001","203100")):
        nm=tsd.get(str(r.get("NameLanguageId")), tsd2.get(str(r.get("NameLanguageId")),""))
        print(rid, nm)

# schedules
print("\nSchedules:")
for sid, label in [("2610209901","EXA kits"),("2610202901","collab stages"),("2610202201","login bonus"),("2610202101","dev mat campaign"),("2610202103","wpn mat wave1"),("2610202104","wpn mat wave2")]:
    sch=None
    for r in load(NEW/"m_schedule.json"):
        if str(r.get("Id"))==sid: sch=r; break
    print(label, sid, "start", ms(sch["StartDatetime"]), "end", ms(sch["EndDatetime"]), "hideEnd", sch.get("HideEndDatetime"))

# comic
print("\nComics:")
co=load(NEW/"m_comic_series.json"); print("series", len(co))
for r in co[-3:]:
    print(r)
ce=load(NEW/"m_comic_episode.json"); print("episodes", len(ce), "last", ce[-2:])

# lite event lang
ll=lmap(LANG,"m_lite_scenario_event.json"); ll2=lmap(APP_LANG,"m_lite_scenario_event.json")
print("\nlite promo", ll.get("330100000000230002") or ll2.get("330100000000230002"))

# achievement record decode conjecture:
# [id, categoryId, ?, nameLangId, sort?, type?, bool, ?, filterKey]
print("\nAch records with lang:")
al=lmap(LANG,"m_profile_achievement_record.json")
for r in load(NEW/"m_profile_achievement_record.json"):
    print(r, "->", al.get(str(r[3]),""))

# cumulative field guess: [id, userRecordTypeIndex, nameLang, sort, goldThreshold?, silverThreshold?, points?, ?, categoryKey, group?]
print("\nCumul with points fields:")
cul=lmap(LANG,"m_profile_cumulative_record.json")
for r in load(NEW/"m_profile_cumulative_record.json"):
    print(f"{cul.get(str(r[2]),'?')}: typeIdx={r[1]} sort={r[3]} hi={r[4]} mid={r[5]} pts?={r[6]} flag={r[7]} key={r[8]} g={r[9]}")
