"""
Build SP/SSP investment ranking JSON for /sp-list preview.

Includes unit SP/SSP boards, pilot SP board, ER Expert filter metadata.

Run: python scripts/build_sp_investment_rankings.py
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
            pct_from_bottom = 1.0 - (i / n)
            letter = SIR.letter_for_total(rules, int(row.get("total") or 0))
            for gate, lit in pct_letters:
                if pct_from_bottom >= gate:
                    order = ["D", "C", "B", "B+", "A", "A+", "S", "S+"]
                    if order.index(lit) > order.index(letter if letter in order else "D"):
                        letter = lit
                    break
            row["letter"] = letter
            row["bucket"] = SIR.bucket_for_letter(rules, letter)
            row["calibration"] = "absolute_plus_role_percentile"


def _sort_rows(rows: list[dict]) -> list[dict]:
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


def _enrich_acq(row: dict, kind: str) -> None:
    info = (A.unit_info_map if kind == "unit" else A.char_info_map).get(row.get("id"), {}) or {}
    acq = str(info.get("acquisition_route", "0") or "0")
    row["acquisition_icon"] = (getattr(A, "ACQUISITION_ROUTE_ICONS", {}) or {}).get(acq, "")
    row["entity"] = kind if kind != "unit" else "unit"


def build_unit_board(mode: str, rules: dict, expert_ids: list[str]) -> list[dict]:
    rows = []
    for uid in A.unit_list_playable_ids:
        try:
            row = SIR.score_unit(A, uid, mode=mode, lc=LC, rules=rules)
        except Exception as e:
            print(f"  skip unit {uid}: {e}")
            continue
        if not row:
            continue
        _enrich_acq(row, "unit")
        SIR.attach_er_expert_ids(A, row, "unit", expert_ids, LC)
        rows.append(row)
    _calibrate_letters_by_role(rows, rules)
    return _sort_rows(rows)


def build_pilot_board(rules: dict, unit_letter_by_id: dict, expert_ids: list[str]) -> list[dict]:
    rows = []
    for cid in A.char_list_playable_ids:
        try:
            row = SIR.score_character(A, cid, lc=LC, rules=rules, unit_letter_by_id=unit_letter_by_id)
        except Exception as e:
            print(f"  skip char {cid}: {e}")
            continue
        if not row:
            continue
        _enrich_acq(row, "character")
        SIR.attach_er_expert_ids(A, row, "character", expert_ids, LC)
        rows.append(row)
    _calibrate_letters_by_role(rows, rules)
    return _sort_rows(rows)


def bucketize(rows: list[dict]) -> dict:
    out = {b: [] for b in BUCKET_ORDER}
    for r in rows:
        b = r.get("bucket") or "dont"
        if b not in out:
            b = "dont"
        out[b].append(r)
    return out


def collect_tag_catalog(rows_lists: list[list[dict]]) -> list[str]:
    tags = set()
    for rows in rows_lists:
        for r in rows:
            for t in r.get("tags") or []:
                if t:
                    tags.add(str(t))
    return sorted(tags, key=lambda s: s.lower())


def main():
    rules = SIR.load_rules()
    print("Building ER Expert filter list…")
    er_filters = SIR.build_er_expert_filters(A, LC)
    expert_ids = [e["id"] for e in er_filters]
    print(f"  {len(er_filters)} expert stages")

    print("Building unit SP board…")
    sp_rows = build_unit_board("sp", rules, expert_ids)
    print(f"  {len(sp_rows)} units")
    print("Building unit SSP board…")
    ssp_rows = build_unit_board("ssp", rules, expert_ids)
    print(f"  {len(ssp_rows)} units")

    unit_letter_by_id = {r["id"]: r.get("letter") or "" for r in sp_rows}
    # Prefer higher letter when SSP is better
    order = ["D", "C", "B", "B+", "A", "A+", "S", "S+"]
    for r in ssp_rows:
        cur = unit_letter_by_id.get(r["id"], "")
        lit = r.get("letter") or ""
        if not cur:
            unit_letter_by_id[r["id"]] = lit
        elif lit in order and cur in order and order.index(lit) > order.index(cur):
            unit_letter_by_id[r["id"]] = lit

    print("Building pilot SP board…")
    pilot_rows = build_pilot_board(rules, unit_letter_by_id, expert_ids)
    print(f"  {len(pilot_rows)} characters")

    guide = SIR.scoring_guide_payload(rules)
    guide["gaps"] = list(guide.get("gaps") or [])
    guide["gaps"].append(
        "Letters use absolute cutoffs, then within-role percentile soft uplift."
    )
    guide["gaps"].append(
        "Pilot recommend-MS points use this list's unit letters (SP/SSP best)."
    )
    guide["intro"] = (
        "Point-sum heuristic inspired by eternalsp’s SP/SSP suggestion lists for Mobile Suits "
        "and pilots. Not a damage calculator. Filter by tag or Eternal Road Expert stage to plan investments."
    )

    tag_catalog = collect_tag_catalog([sp_rows, ssp_rows, pilot_rows])

    payload = {
        "version": int(rules.get("version", 1)) + 1,
        "lang": LC,
        "bucket_order": list(BUCKET_ORDER),
        "bucket_labels": rules.get("bucket_labels") or {},
        "er_expert_filters": er_filters,
        "tag_catalog": tag_catalog,
        "units": {
            "sp": bucketize(sp_rows),
            "ssp": bucketize(ssp_rows),
        },
        "characters": {
            "sp": bucketize(pilot_rows),
        },
        # Back-compat aliases for older client
        "sp": bucketize(sp_rows),
        "ssp": bucketize(ssp_rows),
        "scoring_guide": guide,
        "counts": {
            "units_sp": len(sp_rows),
            "units_ssp": len(ssp_rows),
            "characters_sp": len(pilot_rows),
            "sp": len(sp_rows),
            "ssp": len(ssp_rows),
        },
    }

    out_dir = ROOT / "scripts" / "output"
    pub_dir = ROOT / "data" / "published"
    out_dir.mkdir(parents=True, exist_ok=True)
    pub_dir.mkdir(parents=True, exist_ok=True)
    pub_path = pub_dir / "sp_investment_v1.json"
    with open(pub_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {pub_path} ({pub_path.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
