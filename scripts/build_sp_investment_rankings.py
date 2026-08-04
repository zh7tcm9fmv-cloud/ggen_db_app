"""
Build SP/SSP investment ranking JSON for /sp-list preview.

Run: python scripts/build_sp_investment_rankings.py
Outputs: data/published/sp_investment_v1.json (+ scripts/output copy)
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ.setdefault("GGEN_TIER_USE_BUNDLED_EN", "1")

import app as A  # noqa: E402
import sp_investment_rank as SIR  # noqa: E402

LC = "EN"
BUCKET_ORDER = ("no_regrets", "good", "better_options", "dont")


def _calibrate_letters_by_role(rows: list[dict], rules: dict) -> None:
    """
    Keep raw totals; optionally nudge letter via within-role percentiles when
    provisional cutoffs leave a bucket empty or overfull.
    Uses fixed percentile gates as a soft calibration pass documented in scoring_guide.
    """
    # Soft gates within each role: top 8% S+, next 12% S, next 20% A+, next 20% A,
    # next 20% B+, next 12% B, rest C/D by absolute cutoffs if lower.
    pct_letters = [
        (0.92, "S+"),
        (0.80, "S"),
        (0.60, "A+"),
        (0.40, "A"),
        (0.20, "B+"),
        (0.08, "B"),
    ]
    by_role: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_role[r.get("role") or "Attack"].append(r)
    for role, group in by_role.items():
        group.sort(key=lambda x: (-int(x.get("total") or 0), x.get("name") or "", x.get("id") or ""))
        n = len(group) or 1
        for i, row in enumerate(group):
            # higher rank = better; percentile from top
            pct_from_bottom = 1.0 - (i / n)
            letter = SIR.letter_for_total(rules, int(row.get("total") or 0))
            for gate, lit in pct_letters:
                if pct_from_bottom >= gate:
                    # take the better of absolute vs percentile (by letter order)
                    order = ["D", "C", "B", "B+", "A", "A+", "S", "S+"]
                    if order.index(lit) > order.index(letter if letter in order else "D"):
                        letter = lit
                    break
            row["letter"] = letter
            row["bucket"] = SIR.bucket_for_letter(rules, letter)
            row["calibration"] = "absolute_plus_role_percentile"


def build_board(mode: str, rules: dict) -> list[dict]:
    rows = []
    for uid in A.unit_list_playable_ids:
        info = A.unit_info_map.get(uid) or {}
        if not info:
            continue
        # Skip transform alternates that are not main forms when main differs
        main = str(info.get("main_unit_id") or "") or uid
        # Still score distinct SP-able IDs; skip pure alternate bodies without own rarity path
        try:
            row = SIR.score_unit(A, uid, mode=mode, lc=LC, rules=rules)
        except Exception as e:
            print(f"  skip {uid}: {e}")
            continue
        if not row:
            continue
        rows.append(row)
    _calibrate_letters_by_role(rows, rules)
    rows.sort(
        key=lambda x: (
            BUCKET_ORDER.index(x.get("bucket") or "dont")
            if (x.get("bucket") or "dont") in BUCKET_ORDER
            else 99,
            -int(x.get("total") or 0),
            x.get("name") or "",
            x.get("id") or "",
        )
    )
    return rows


def bucketize(rows: list[dict]) -> dict:
    out = {b: [] for b in BUCKET_ORDER}
    for r in rows:
        b = r.get("bucket") or "dont"
        if b not in out:
            b = "dont"
        # slim list row for grid; keep breakdown for click
        out[b].append(r)
    return out


def main():
    rules = SIR.load_rules()
    print("Building SP board…")
    sp_rows = build_board("sp", rules)
    print(f"  {len(sp_rows)} units")
    print("Building SSP board…")
    ssp_rows = build_board("ssp", rules)
    print(f"  {len(ssp_rows)} units")

    guide = SIR.scoring_guide_payload(rules)
    guide["gaps"] = list(guide.get("gaps") or [])
    guide["gaps"].append(
        "Letters use absolute cutoffs, then within-role percentile soft uplift (calibration=absolute_plus_role_percentile)."
    )

    payload = {
        "version": rules.get("version", 1),
        "entity": "unit",
        "lang": LC,
        "bucket_order": list(BUCKET_ORDER),
        "bucket_labels": rules.get("bucket_labels") or {},
        "sp": bucketize(sp_rows),
        "ssp": bucketize(ssp_rows),
        "scoring_guide": guide,
        "counts": {
            "sp": len(sp_rows),
            "ssp": len(ssp_rows),
        },
    }

    # Dev-only flat copies for debugging (not served by API).
    debug_payload = dict(payload)
    debug_payload["sp_flat"] = sp_rows
    debug_payload["ssp_flat"] = ssp_rows

    out_dir = ROOT / "scripts" / "output"
    pub_dir = ROOT / "data" / "published"
    out_dir.mkdir(parents=True, exist_ok=True)
    pub_dir.mkdir(parents=True, exist_ok=True)
    pub_path = pub_dir / "sp_investment_v1.json"
    out_path = out_dir / "sp_investment_v1.json"
    with open(pub_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {pub_path} ({pub_path.stat().st_size // 1024} KB)")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(debug_payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {out_path} ({out_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
