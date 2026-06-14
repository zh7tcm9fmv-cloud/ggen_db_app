import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "EN")
ch = json.load(open(os.path.join(ROOT, "master", "m_main_scenario_stage_challenge.json"), encoding="utf-8"))
ss = {str(x["Id"]): x for x in json.load(open(os.path.join(ROOT, "master", "m_scenario_stage.json"), encoding="utf-8"))}
lang = {str(x["id"]): x["value"] for x in json.load(open(os.path.join(ROOT, "lang", "m_scenario_stage.json"), encoding="utf-8"))}
rewards = {str(x["Id"]): x for x in json.load(open(os.path.join(ROOT, "master", "m_reward.json"), encoding="utf-8"))}

for sid in ["10", "3000"]:
    items = [i for i in ch if str(i["MainStageSeriesChallengeId"]) == sid]
    items.sort(key=lambda x: (x["StageNumber"], x["ScenarioStageId"]))
    print(f"=== series {sid} total {len(items)} ===")
    for i in items:
        st = str(i["ScenarioStageId"])
        rid = ss[st]["ThumbnailResourceId"]
        lane = "HARD" if str(rid).startswith("thum_map_bg_") else "main"
        name = lang.get(str(ss[st]["TitleNameLanguageId"]), "?")
        print(f"  #{i['StageNumber']:2} {lane:4} {st} {rid} | {name}")

print("\n=== challenge first-clear rewards for 30001704 ===")
mc = json.load(open(os.path.join(ROOT, "master", "m_main_stage_challenge.json"), encoding="utf-8"))
row = next(x for x in mc if str(x["Id"]) == "30001704")
print("FirstClearRewardSetId", row["FirstClearRewardSetId"])
rsc = json.load(open(os.path.join(ROOT, "master", "m_reward_set_content.json"), encoding="utf-8"))
set_id = str(row["FirstClearRewardSetId"])
for item in rsc:
    if str(item.get("RewardSetId")) == set_id:
        rid = str(item.get("RewardId"))
        r = rewards.get(rid, {})
        print(" ", rid, "type", r.get("RewardTypeIndex"), "target", r.get("TargetId"), "count", r.get("Count"))
