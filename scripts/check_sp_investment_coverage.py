"""
Fail if published /ip boards miss investment-eligible playable units/characters.

Eligible = playable AND not excluded by SPI rules (non-Ultimate UR, warships, NPC chars).
After MasterData imports, rebuild then verify:

  python scripts/build_sp_investment_rankings.py
  python scripts/check_sp_investment_coverage.py

Usage:
  python scripts/check_sp_investment_coverage.py
  python scripts/check_sp_investment_coverage.py --published data/published/sp_investment_v1.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PUB = ROOT / "data" / "published" / "sp_investment_v1.json"


def main() -> int:
    ap = argparse.ArgumentParser(description="SPI published coverage vs eligible catalog")
    ap.add_argument("--published", type=Path, default=DEFAULT_PUB)
    ap.add_argument(
        "--limit",
        type=int,
        default=30,
        help="Max missing ids to print per side (default 30)",
    )
    args = ap.parse_args()

    sys.path.insert(0, str(ROOT))
    os.chdir(ROOT)
    os.environ.setdefault("GGEN_TIER_USE_BUNDLED_EN", "1")

    import app as A  # noqa: E402
    import sp_investment_rank as SIR  # noqa: E402

    if not args.published.is_file():
        print(f"Missing published file: {args.published}", file=sys.stderr)
        return 2

    payload = json.loads(args.published.read_text(encoding="utf-8"))
    rules = SIR.load_rules()
    cov = SIR.coverage_gaps_vs_published(A, payload, rules=rules)

    print(f"Published: {args.published}")
    print(f"  built_at={payload.get('built_at') or '(none)'}")
    print(
        f"  eligible units={cov['eligible_units']} chars={cov['eligible_characters']}"
    )
    print(
        f"  published units={cov['published_units']} chars={cov['published_characters']}"
    )
    lim = max(0, int(args.limit))
    if cov["missing_units"]:
        print(f"  missing units ({len(cov['missing_units'])}):")
        for uid in cov["missing_units"][:lim]:
            info = (A.unit_info_map or {}).get(uid) or {}
            print(f"    {uid} {info.get('name') or ''}")
        if len(cov["missing_units"]) > lim:
            print(f"    … +{len(cov['missing_units']) - lim} more")
    if cov["missing_characters"]:
        print(f"  missing characters ({len(cov['missing_characters'])}):")
        for cid in cov["missing_characters"][:lim]:
            info = (A.char_info_map or {}).get(cid) or {}
            print(f"    {cid} {info.get('name') or ''}")
        if len(cov["missing_characters"]) > lim:
            print(f"    … +{len(cov['missing_characters']) - lim} more")

    if cov["ok"]:
        print("Coverage: OK")
        return 0
    print(
        "Coverage: FAIL — rebuild with scripts/build_sp_investment_rankings.py",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
