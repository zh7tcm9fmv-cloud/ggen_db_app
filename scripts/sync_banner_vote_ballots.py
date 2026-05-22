#!/usr/bin/env python3
"""After editing totals in banner_pool_votes.json, run this to add ballot rows.

The live app recomputes totals from ballots on load — editing totals alone is ignored.
This script adds synthetic manual_restore_* ballots so displayed counts match totals.

Usage:
  python scripts/sync_banner_vote_ballots.py
  python scripts/sync_banner_vote_ballots.py path/to/banner_pool_votes.json
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATHS = (
    ROOT / "data" / "persistent" / "banner_pool_votes.json",
    ROOT / "data" / "published" / "banner_pool_votes.json",
)


def normalize_ballot(ballot):
    if not isinstance(ballot, dict):
        return {}
    if "choices" in ballot:
        ts = int(ballot.get("ts") or 0)
        return {str(ch).strip(): ts or 1 for ch in (ballot.get("choices") or []) if str(ch).strip()}
    out = {}
    for key, val in ballot.items():
        if key in ("ts", "choices") or not isinstance(key, str):
            continue
        out[key] = int(val) if isinstance(val, (int, float)) else 1
    return out


def recompute_totals(ballots):
    totals: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for bkey, ballot in ballots.items():
        if ":" not in bkey:
            continue
        gid = bkey.rsplit(":", 1)[1]
        for choice in normalize_ballot(ballot):
            totals[gid][choice] += 1
    return {gid: dict(choices) for gid, choices in totals.items()}


def sync_ballots_to_totals(data):
    desired = data.get("totals") or {}
    ballots = dict(data.get("ballots") or {})
    base_ts = 1735689600
    counter = sum(1 for k in ballots if str(k).startswith("manual_restore_"))
    added = 0
    for gid, choices in desired.items():
        gid = str(gid)
        for choice, want in choices.items():
            want = int(want or 0)
            if want <= 0:
                continue
            have = sum(
                1
                for bkey, ballot in ballots.items()
                if bkey.endswith(":" + gid) and choice in normalize_ballot(ballot)
            )
            for _ in range(want - have):
                counter += 1
                ballots[f"manual_restore_{counter:04d}:{gid}"] = {choice: base_ts + counter}
                added += 1
    data["ballots"] = ballots
    data["totals"] = recompute_totals(ballots)
    return data, added


def main():
    paths = [Path(p) for p in sys.argv[1:]] if len(sys.argv) > 1 else list(DEFAULT_PATHS)
    for path in paths:
        if not path.is_file():
            print(f"skip (missing): {path}")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        data, added = sync_ballots_to_totals(data)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{path}: added {added} ballot row(s)")


if __name__ == "__main__":
    main()
