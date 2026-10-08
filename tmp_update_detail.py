import json
from pathlib import Path

OLD = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-07")
NEW = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\MasterData_2026-10-08")
LANG = Path(r"C:\Users\Mikew0911\Desktop\GGen_Database\Lang_MasterData_2026-10-08")

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))
def lmap(name):
    p=LANG/name
    if not p.exists(): return {}
    return {str(r.get("id") or r.get("Id")): str(r.get("value") or r.get("Value") or "") for r in load(p) if isinstance(r, dict)}

def keyset(rows):
    out=set()
    for r in rows:
        if isinstance(r, dict):
            k=r.get("Id", r.get("StageId", r.get("id")))
            out.add(str(k))
    return out

print("=== ER stages ===")
ao, an = load(OLD/"m_eternal_road_stage.json"), load(NEW/"m_eternal_road_stage.json")
print(len(ao), "->", len(an))
# compare by StageId
def by_stage(rows):
    d={}
    for r in rows:
        d[str(r.get("StageId") or r.get("Id"))]=r
    return d
bo,bn=by_stage(ao),by_stage(an)
print("added stage ids", sorted(set(bn)-set(bo)))
stl=lmap("m_stage.json"); erl=lmap("m_eternal_road_stage.json"); scn=lmap("m_scenario_stage.json")
for i in sorted(set(bn)-set(bo)):
    r=bn[i]
    print(i, r)
    for lid in [r.get("NameLanguageId"), r.get("StageId")]:
        pass

# stages table
so,sn=load(OLD/"m_stage.json"), load(NEW/"m_stage.json")
print("\nm_stage", len(so),"->",len(sn))
def byid(rows):
    return {str(r["Id"]):r for r in rows if isinstance(r,dict) and "Id" in r}
bs_o,bs_n=byid(so),byid(sn)
new_stages=sorted(set(bs_n)-set(bs_o), key=lambda x:int(x) if x.isdigit() else x)
print("new stage count", len(new_stages))
for i in new_stages:
    r=bs_n[i]
    name=stl.get(str(r.get("NameLanguageId") or ""), scn.get(str(r.get("NameLanguageId") or ""), "?"))
    print(f"  stage {i}: {name} cat? keys sample { {k:r[k] for k in list(r)[:12]} }")

print("\n=== collab scenario stages 90800201/02 ===")
ss=byid(load(NEW/"m_scenario_stage.json"))
for i in ["90800201","90800202"]:
    r=ss.get(i)
    if not r: print("missing", i); continue
    name=scn.get(str(r.get("NameLanguageId") or ""), "?")
    print(i, name, {k:r[k] for k in r if k in ("Id","NameLanguageId","StageDifficultyTypeIndex","ScenarioStageSeriesId","ScheduleId","StageId") or "Diff" in k or "Hard" in k})

print("\n=== OP 400097 ===")
op=byid(load(NEW/"m_option_parts.json"))["400097"]
ol=lmap("m_option_parts.json")
print(op)
print("name", ol.get(str(op.get("NameLanguageId"))))
# trait text?
print("desc", ol.get(str(op.get("DescriptionLanguageId") or "")))

print("\n=== Sthesia abilities ===")
cas=load(NEW/"m_character_ability_set.json")
for r in cas:
    if str(r.get("CharacterId"))=="1795000101":
        print(r)
tsd=lmap("m_trait_set_detail.json"); tl=lmap("m_trait.json")
# ability names via ability set -> ability id
abil=byid(load(NEW/"m_ability.json"))
for r in cas:
    if str(r.get("CharacterId"))!="1795000101": continue
    aid=str(r.get("AbilityId"))
    a=abil.get(aid,{})
    print(" ability", aid, a.get("NameLanguageId"), "-> check trait set")

print("\n=== Excellia abilities ===")
uas=load(NEW/"m_unit_ability_set.json")
for r in uas:
    if str(r.get("UnitId"))=="1795000100":
        print(r)

print("\n=== lite scenario event ===")
# maybe list not by Id
for fn in ["m_lite_scenario_event.json"]:
    print(fn, load(NEW/fn))

print("\n=== game function release diff ===")
gfo,gfn=byid(load(OLD/"m_game_function_release.json")), byid(load(NEW/"m_game_function_release.json"))
for i in sorted(set(gfo)|set(gfn), key=lambda x:int(x) if x.isdigit() else x):
    if gfo.get(i)!=gfn.get(i):
        print("DIFF", i)
        print("O", gfo.get(i))
        print("N", gfn.get(i))

# schedule for today content
print("\n=== schedules of interest ===")
sch=byid(load(NEW/"m_schedule.json"))
for sid in ["2610209901","2610202201","2610202101","2610202103","2610202104"]:
    print(sid, sch.get(sid))

# campaign lang
cl=lmap("m_campaign.json")
print("\n=== campaign texts (first 10 new) ===")
for i in range(126102001, 126102021):
    # find description from campaign row
    pass
camp=byid(load(NEW/"m_campaign.json"))
for i in sorted(camp)[:]:
    if str(i).startswith("126102"):
        r=camp[i]
        print(i, cl.get(str(r.get("DescriptionLanguageId") or ""), "")[:120])
