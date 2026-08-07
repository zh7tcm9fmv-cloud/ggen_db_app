"""
Check published Investment Guide buckets against a provisional gold set.

Usage:
  python scripts/check_sp_investment_gold.py
  python scripts/check_sp_investment_gold.py --published data/published/sp_investment_v1.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GOLD = ROOT / "data" / "sp_investment" / "gold_set_v5.json"
DEFAULT_PUB = ROOT / "data" / "published" / "sp_investment_v1.json"


def _index_board(board: dict) -> dict[str, dict]:
    out = {}
    for bucket, rows in (board or {}).items():
        for row in rows or []:
            rid = str(row.get("id") or "")
            if rid:
                out[rid] = row
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gold", type=Path, default=DEFAULT_GOLD)
    ap.add_argument("--published", type=Path, default=DEFAULT_PUB)
    args = ap.parse_args()

    gold = json.loads(args.gold.read_text(encoding="utf-8"))
    pub = json.loads(args.published.read_text(encoding="utf-8"))

    boards = {
        "units_sp": _index_board((pub.get("units") or {}).get("sp") or {}),
        "units_ssp": _index_board((pub.get("units") or {}).get("ssp") or {}),
        "pilots_sp": _index_board((pub.get("characters") or {}).get("sp") or {}),
    }

    mismatches = []
    missing = []
    checked = 0
    for key, entries in gold.items():
        if key not in boards or not isinstance(entries, list):
            continue
        idx = boards[key]
        for ent in entries:
            eid = str(ent.get("id") or "")
            expect = str(ent.get("expect_bucket") or "")
            if not eid or not expect:
                continue
            checked += 1
            row = idx.get(eid)
            if not row:
                missing.append((key, eid, ent.get("name"), expect))
                continue
            got = str(row.get("bucket") or "")
            if got != expect:
                mismatches.append(
                    {
                        "board": key,
                        "id": eid,
                        "name": ent.get("name") or row.get("name"),
                        "expect": expect,
                        "got": got,
                        "letter": row.get("letter"),
                        "total": row.get("total"),
                    }
                )

    print(f"Gold check: {checked} entries against {args.published.name}")
    if missing:
        print(f"  missing {len(missing)}:")
        for board, eid, name, expect in missing[:20]:
            print(f"    [{board}] {eid} {name} (expect {expect})")
    if mismatches:
        print(f"  mismatches {len(mismatches)}:")
        for m in mismatches[:40]:
            print(
                f"    [{m['board']}] {m['id']} {m['name']}: "
                f"expect={m['expect']} got={m['got']} "
                f"({m['letter']} / {m['total']})"
            )
    else:
        print("  all present gold entries matched expected buckets")

    if missing or mismatches:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
