#!/usr/bin/env python3
"""Dump Main Stage Challenge metadata (EN) for CDN asset planning."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "data", "EN")


def main():
    with open(os.path.join(BASE, "master", "m_main_scenario_stage_challenge.json"), encoding="utf-8") as f:
        ch = json.load(f)
    with open(os.path.join(BASE, "master", "m_scenario_stage.json"), encoding="utf-8") as f:
        ss = {str(x["Id"]): x for x in json.load(f)}
    with open(os.path.join(BASE, "master", "m_main_stage_challenge.json"), encoding="utf-8") as f:
        mc = {str(x["Id"]): x for x in json.load(f)}
    with open(os.path.join(BASE, "master", "m_capturable_unit.json"), encoding="utf-8") as f:
        cap = json.load(f)
    with open(os.path.join(BASE, "lang", "m_scenario_stage.json"), encoding="utf-8") as f:
        lang = {str(x["id"]): x["value"] for x in json.load(f)}

    rows = []
    sca, thum = set(), set()
    for item in ch:
        st = str(item["ScenarioStageId"])
        s = ss[st]
        m = mc[st]
        caps = [c for c in cap if str(c.get("StageId")) == st]
        rid = s.get("ThumbnailResourceId", "")
        if rid.startswith("sca_"):
            sca.add(rid)
        elif rid.startswith("thum_map_bg_"):
            thum.add(rid)
        lid = str(s.get("TitleNameLanguageId", ""))
        rows.append({
            "id": st,
            "stage_number": item.get("StageNumber"),
            "series_challenge_id": item.get("MainStageSeriesChallengeId"),
            "name": lang.get(lid, "?"),
            "thumbnail_resource_id": rid,
            "lane": "alternate" if rid.startswith("thum_map_bg_") else "main",
            "recommended_cp": m.get("RecommendedCombatPower"),
            "group1_sortie": m.get("Group1SortieCount"),
            "group2_sortie": m.get("Group2SortieCount"),
            "capturable_count": len(caps),
            "capturable_pickup_unit_ids": [
                str(c["MainUnitId"]) for c in caps if c.get("IsStageSelectPickupCaptureUnit")
            ],
            "has_capturable_units": len(caps) > 0,
        })

    out = {
        "stage_count": len(rows),
        "sca_thumbnails": sorted(sca),
        "thum_map_bg_thumbnails": sorted(thum),
        "cdn_paths": {
            "sca": [f"images/Stages/{x}.webp" for x in sorted(sca)],
            "thum_map_bg": [f"images/Stages/{x}.webp" for x in sorted(thum)],
        },
        "stages": sorted(rows, key=lambda r: (r["series_challenge_id"], r["stage_number"], r["id"])),
    }
    dest = os.path.join(ROOT, "data", "challenge_stages_en.json")
    with open(dest, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Wrote {dest} ({len(rows)} stages, {len(sca)} sca, {len(thum)} thum_map_bg)")


if __name__ == "__main__":
    main()
