"""Build technical journal drop table from master data.

Rate model (2026-06-08 verification):
- Client libil2cpp.so @ RVA 0x927AA9C (_CreateStageDropRewardList) has NO random/lottery;
  it flattens all m_stage_drop / m_stage_drop_content rows into StageDropRewardEntityList (UI only).
- Actual clear drops are server-rolled (IngameResultRewardDto.DropRewardList).
- Per-clear journal rates are inferred from weight_sum in m_stage_drop_content and match
  community drop tests (Kamigame ~10% overall, AppMedia ~10–30% by journal count).
"""
import csv
import json
import os
from collections import Counter, defaultdict

BASE = os.path.join(os.path.dirname(__file__), "..", "data", "EN", "master")
LANGBASE = os.path.join(os.path.dirname(__file__), "..", "data", "EN", "lang")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "journal_drop_rates_inferred.csv")


def extract(d):
    if isinstance(d, dict):
        for v in d.values():
            if isinstance(v, list):
                return v
    return d if isinstance(d, list) else []


def item_label(tid, item_name_id, names):
    return names.get(item_name_id.get(str(tid), ""), str(tid))


def is_technical_journal_name(name):
    return "technical journal" in (name or "").lower()


def infer_journal_rates(wsum, journal_count, pool_rows):
    """Server-side lottery model inferred from master weight_sum + community testing.

    Client decompile (2.2.0 libil2cpp) confirms no roll logic in _CreateStageDropRewardList.
    """
    if wsum >= 1000:
        return None, None, "wsum>=1000 (weapon-mat style pool; not journal gate)"
    if wsum == 100:
        # Event/special stages: weights sum to 100 (e.g. 50+50) → roll /100, always proc when sum=100.
        return 100.0, None, "d100 weighted (wsum=100 → always awards one journal)"
    if wsum <= 10:
        any_pct = wsum * 10.0
        each_pct = any_pct / journal_count if journal_count else None
        return any_pct, each_pct, "d10 gate: P(any)=wsum×10%; then uniform among journals"
    return None, None, f"unknown wsum={wsum}"


def main():
    drops = extract(json.load(open(os.path.join(BASE, "m_stage_drop.json"), encoding="utf-8")))
    contents = extract(json.load(open(os.path.join(BASE, "m_stage_drop_content.json"), encoding="utf-8")))
    rewards = extract(json.load(open(os.path.join(BASE, "m_reward.json"), encoding="utf-8")))
    items = extract(json.load(open(os.path.join(BASE, "m_item.json"), encoding="utf-8")))
    stages = extract(json.load(open(os.path.join(BASE, "m_stage.json"), encoding="utf-8")))
    lang_items = extract(json.load(open(os.path.join(LANGBASE, "m_item.json"), encoding="utf-8")))
    lang_stage = extract(json.load(open(os.path.join(LANGBASE, "m_stage.json"), encoding="utf-8")))

    item_name_id = {str(i["Id"]): str(i.get("NameLanguageId")) for i in items}
    names = {str(x.get("id") or x.get("Id")): x.get("value") or x.get("Value") for x in lang_items}
    stage_names = {str(x.get("id") or x.get("Id")): x.get("value") or x.get("Value") for x in lang_stage}

    content_by_set = defaultdict(list)
    for c in contents:
        content_by_set[str(c.get("StageDropContentSetId"))].append(c)

    def rewards_for_set(rsid):
        rs = str(rsid)
        return [r for r in rewards if str(r["Id"]).startswith(rs)]

    drop_set_stages = defaultdict(list)
    for s in stages:
        drop_set_stages[str(s.get("StageDropSetId"))].append(s)

    rows_out = []
    for d in drops:
        cset = str(d.get("StageDropContentSetId"))
        dsid = str(d.get("StageDropSetId"))
        pool_rows = content_by_set[cset]
        journals = []
        for pr in pool_rows:
            rsid = str(pr.get("RewardSetId"))
            for rw in rewards_for_set(rsid):
                tid = str(rw.get("TargetId"))
                nm = item_label(tid, item_name_id, names)
                if is_technical_journal_name(nm):
                    journals.append(
                        {
                            "name": nm,
                            "weight": int(pr.get("Weight", 0)),
                            "count": int(rw.get("Count", 1)),
                        }
                    )
        if not journals:
            continue

        wsum = sum(int(r.get("Weight", 0)) for r in pool_rows)
        n = len(journals)
        lottery = int(d.get("LotteryCount", 1))
        stage_list = drop_set_stages.get(dsid) or [{"Id": "", "StageNameLanguageId": 0}]

        for sm in stage_list:
            sid = str(sm.get("Id", ""))
            sname = stage_names.get(str(sm.get("StageNameLanguageId", "")), "")
            any_pct, each_pct, rate_model = infer_journal_rates(wsum, n, pool_rows)
            rows_out.append(
                {
                    "stage_id": sid,
                    "stage_name": sname,
                    "stage_drop_set_id": dsid,
                    "journal_pool_id": cset,
                    "lottery_count": lottery,
                    "journal_count": n,
                    "pool_entry_count": len(pool_rows),
                    "weight_sum": wsum,
                    "inferred_any_journal_pct": any_pct,
                    "inferred_each_journal_pct": each_pct,
                    "rate_model": rate_model,
                    "journals": journals,
                }
            )

    rows_out.sort(key=lambda r: (r["stage_id"], r["journal_pool_id"]))

    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "stage_id",
                "stage_name",
                "stage_drop_set_id",
                "journal_pool_id",
                "lottery_count",
                "journal_count",
                "pool_entry_count",
                "weight_sum",
                "any_journal_pct",
                "each_journal_pct",
                "rate_model",
                "verification",
                "journal_1",
                "journal_2",
                "journal_3",
                "journal_4",
            ]
        )
        verify = (
            "Client 0x927AA9C=UI-only (no lottery). "
            "Rates: master weight_sum + Kamigame/AppMedia drop tests."
        )
        for r in rows_out:
            jnames = [j["name"] for j in r["journals"]]
            while len(jnames) < 4:
                jnames.append("")
            w.writerow(
                [
                    r["stage_id"],
                    r["stage_name"],
                    r["stage_drop_set_id"],
                    r["journal_pool_id"],
                    r["lottery_count"],
                    r["journal_count"],
                    r["pool_entry_count"],
                    r["weight_sum"],
                    r["inferred_any_journal_pct"],
                    round(r["inferred_each_journal_pct"], 2) if r["inferred_each_journal_pct"] is not None else "",
                    r["rate_model"],
                    verify,
                ]
                + jnames[:4]
            )

    print(f"technical journal stages: {len(rows_out)}")
    print(f"journal count distribution: {dict(Counter(r['journal_count'] for r in rows_out))}")
    print(f"weight sum distribution: {dict(Counter(r['weight_sum'] for r in rows_out))}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
