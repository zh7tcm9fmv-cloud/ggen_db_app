"""
Build SP/SSP investment ranking JSON for /sp-list preview.

Includes unit SP/SSP boards, pilot SP board, ER Expert filter metadata.

Run: python scripts/build_sp_investment_rankings.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ.setdefault("GGEN_TIER_USE_BUNDLED_EN", "1")

import app as A  # noqa: E402
import sp_investment_rank as SIR  # noqa: E402

LC = "EN"
BUCKET_ORDER = ("recommended", "solid", "situational", "niche")


def _calibrate_letters_by_role(
    rows: list[dict],
    rules: dict,
    *,
    cutoffs_key: str = "letter_cutoffs",
    ur_cutoffs_key: str | None = None,
) -> None:
    """
    Absolute sheet cutoffs, split by investment cohort:
    SP-eligible (has_sp) vs UR/Ultimate — so UR does not monopolize Recommended.
    """
    ur_key = ur_cutoffs_key or (
        "ur_pilot_letter_cutoffs"
        if cutoffs_key == "pilot_letter_cutoffs"
        else "ur_letter_cutoffs"
    )
    for row in rows:
        has_sp = bool(row.get("has_sp"))
        key = cutoffs_key if has_sp else (ur_key if rules.get(ur_key) else cutoffs_key)
        letter = SIR.letter_for_total(
            rules, int(row.get("total") or 0), cutoffs_key=key
        )
        row["letter"] = letter
        row["bucket"] = SIR.bucket_for_letter(rules, letter)
        row["letter_cohort"] = "sp" if has_sp else "ur"
        row["calibration"] = f"absolute_sheet:{key}"


def _sort_rows(rows: list[dict]) -> list[dict]:
    rows.sort(
        key=lambda x: (
            BUCKET_ORDER.index(x.get("bucket") or "niche")
            if (x.get("bucket") or "niche") in BUCKET_ORDER
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


def build_unit_board(
    mode: str,
    rules: dict,
    expert_ids: list[str],
    tag_table: dict | None = None,
) -> list[dict]:
    rows = []
    for uid in A.unit_list_playable_ids:
        try:
            row = SIR.score_unit(
                A,
                uid,
                mode=mode,
                lc=LC,
                rules=rules,
                tag_strategic_table=tag_table,
                er_expert_ids=expert_ids,
            )
        except Exception as e:
            print(f"  skip unit {uid}: {e}")
            continue
        if not row:
            continue
        _enrich_acq(row, "unit")
        if "er_expert_ids" not in row:
            SIR.attach_er_expert_ids(A, row, "unit", expert_ids, LC)
        rows.append(row)
    _calibrate_letters_by_role(rows, rules)
    return _sort_rows(rows)


def build_pilot_board(
    rules: dict,
    unit_letter_by_id: dict,
    unit_index: dict,
    expert_ids: list[str],
    tag_table: dict | None = None,
) -> list[dict]:
    rows = []
    for cid in A.char_list_playable_ids:
        try:
            row = SIR.score_character(
                A,
                cid,
                lc=LC,
                rules=rules,
                unit_letter_by_id=unit_letter_by_id,
                unit_index=unit_index,
                tag_strategic_table=tag_table,
                er_expert_ids=expert_ids,
            )
        except Exception as e:
            print(f"  skip char {cid}: {e}")
            continue
        if not row:
            continue
        _enrich_acq(row, "character")
        if "er_expert_ids" not in row:
            SIR.attach_er_expert_ids(A, row, "character", expert_ids, LC)
        rows.append(row)
    _calibrate_letters_by_role(rows, rules, cutoffs_key="pilot_letter_cutoffs")
    return _sort_rows(rows)


def bucketize(rows: list[dict]) -> dict:
    out = {b: [] for b in BUCKET_ORDER}
    for r in rows:
        b = r.get("bucket") or "niche"
        if b not in out:
            b = "niche"
        out[b].append(_lean_public_row(r))
    return out


_SPI_DROP_ROW_KEYS = frozenset({"meta", "detail_lines", "calibration"})


def _lean_public_row(row: dict) -> dict:
    """Strip scorer debug fields the /IG client never reads (keeps payload snappy)."""
    out = {k: v for k, v in row.items() if k not in _SPI_DROP_ROW_KEYS}
    bd = out.get("breakdown")
    if isinstance(bd, dict):
        out["breakdown"] = {k: v for k, v in bd.items() if v}
    recs = out.get("recommended_units")
    if isinstance(recs, list) and not recs:
        out.pop("recommended_units", None)
    return out


def collect_tag_catalog(rows_lists: list[list[dict]]) -> list[str]:
    tags = set()
    for rows in rows_lists:
        for r in rows:
            for t in r.get("tags") or []:
                if t:
                    tags.add(str(t))
    return sorted(tags, key=lambda s: s.lower())


def _bucket_histogram(rows: list[dict]) -> dict[str, int]:
    counts = {b: 0 for b in BUCKET_ORDER}
    for r in rows:
        b = r.get("bucket") or "niche"
        if b not in counts:
            b = "niche"
        counts[b] += 1
    return counts


def main():
    rules = SIR.load_rules()
    print(f"Rules version {rules.get('version')} buckets={list((rules.get('bucket_labels') or {}).values())}")
    print("Building ER Expert filter list…")
    er_filters = SIR.build_er_expert_filters(A, LC)
    expert_ids = [e["id"] for e in er_filters]
    print(f"  {len(er_filters)} expert stages")

    print("Building strategic tag UR-weight tables…")
    tag_table = SIR.get_tag_strategic_table(A, rules, LC)
    pilot_tag_table = SIR.get_pilot_tag_strategic_table(A, rules, LC)
    print(f"  unit tags={len(tag_table)} pilot tags={len(pilot_tag_table)}")

    print("Building unit SP board…")
    sp_rows = build_unit_board("sp", rules, expert_ids, tag_table)
    print(f"  {len(sp_rows)} units {_bucket_histogram(sp_rows)}")
    print("Building unit SSP board…")
    ssp_rows = build_unit_board("ssp", rules, expert_ids, tag_table)
    print(f"  {len(ssp_rows)} units {_bucket_histogram(ssp_rows)}")

    unit_letter_by_id = {r["id"]: r.get("letter") or "" for r in sp_rows}
    # Prefer higher letter when SSP is better
    order = ["E", "D", "C", "B", "B+", "A", "A+", "S", "S+"]
    best_unit_rows = {r["id"]: r for r in sp_rows}
    for r in ssp_rows:
        cur = unit_letter_by_id.get(r["id"], "")
        lit = r.get("letter") or ""
        if not cur:
            unit_letter_by_id[r["id"]] = lit
            best_unit_rows[r["id"]] = r
        elif lit in order and cur in order and order.index(lit) > order.index(cur):
            unit_letter_by_id[r["id"]] = lit
            best_unit_rows[r["id"]] = r

    print("Indexing units for pilot MS recommendations…")
    unit_index = SIR.build_unit_recommend_index(A, list(best_unit_rows.values()), LC)
    print(f"  {len(unit_index.get('bplus_ids') or [])} A+ eligible units for pilot MS match")

    print("Building pilot SP board…")
    pilot_rows = build_pilot_board(rules, unit_letter_by_id, unit_index, expert_ids, pilot_tag_table)
    print(f"  {len(pilot_rows)} characters {_bucket_histogram(pilot_rows)}")

    guide = SIR.scoring_guide_payload(rules)
    if not guide.get("intro"):
        guide["intro"] = (
            "Point-sum suggestion guide for SP/SSP chip investment, separated by class. "
            "Not a damage calculator. Filter by tag or Eternal Road Expert stage to spot clear shortlist winners."
        )

    tag_catalog = collect_tag_catalog([sp_rows, ssp_rows, pilot_rows])

    units_sp = bucketize(sp_rows)
    units_ssp = bucketize(ssp_rows)
    chars_sp = bucketize(pilot_rows)

    print("Attaching thumbs/icons for published payload…")
    A._sp_investment_attach_board(units_sp, "unit")
    A._sp_investment_attach_board(units_ssp, "unit")
    A._sp_investment_attach_board(chars_sp, "character")

    payload = {
        "version": int(rules.get("version", 1)) + 1,
        "lang": LC,
        "bucket_order": list(BUCKET_ORDER),
        "bucket_labels": rules.get("bucket_labels") or {},
        "er_expert_filters": er_filters,
        "tag_catalog": tag_catalog,
        "units": {
            "sp": units_sp,
            "ssp": units_ssp,
        },
        "characters": {
            "sp": chars_sp,
        },
        # Back-compat aliases for older client
        "sp": units_sp,
        "ssp": units_ssp,
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
