"""
Guard: pilot-dossier CP/EX lines that decrease (or increase) stats must parse.

Florence (1850001501) regression — official EN uses \"decrease DEF by N%\" while the
character parser historically only matched \"Defense\". Silent miss: Awaken/Reaction
applied, Defense stayed flat.

Run after MasterData / LANG updates (or whenever touching extract_stat_percent_char):

  python scripts/check_char_cp_stat_parse.py

Exit 0 = OK. Exit 1 = parser miss (print every failing line).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Pilot dossier stats (not MS ATK/DEF combat lines, not "improve decrease DEF weapon").
_PILOT_STAT = r"(?:Defense|DEF|Reaction|Awaken|Melee|Ranged|Range)"
_DECREASE_LINE = re.compile(
    rf"(?:decrease|reduce|decreases|reduces)\s+(?:own\s+)?({_PILOT_STAT}(?:\s+and\s+{_PILOT_STAT})*)\s+by\s*(\d+)\s*%",
    re.IGNORECASE,
)
_WEAPON_EFFECT = re.compile(
    r"improve\s+decrease\s+DEF\s+weapon\s+effects",
    re.IGNORECASE,
)
_CANON = {
    "defense": "Defense",
    "def": "Defense",
    "reaction": "Reaction",
    "awaken": "Awaken",
    "melee": "Melee",
    "ranged": "Ranged",
    "range": "Ranged",
}


def _expected_from_decrease_line(line: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for m in _DECREASE_LINE.finditer(line):
        pct = int(m.group(2))
        for raw in re.split(r"\s+and\s+", m.group(1), flags=re.IGNORECASE):
            key = _CANON.get((raw or "").strip().lower())
            if key:
                out[key] = out.get(key, 0) - pct
    return out


def _load_en_trait_values(path: Path) -> list[tuple[str, str]]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    out: list[tuple[str, str]] = []
    if isinstance(rows, list):
        for row in rows:
            if not isinstance(row, dict):
                continue
            tid = str(row.get("id") or row.get("Id") or "")
            val = row.get("value") or row.get("Value") or ""
            if tid and isinstance(val, str) and val.strip():
                out.append((tid, val))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Character CP dossier parse coverage (DEF etc.)")
    ap.add_argument(
        "--traits",
        type=Path,
        default=ROOT / "data" / "EN" / "lang" / "m_trait.json",
        help="EN m_trait.json path",
    )
    ap.add_argument(
        "--sample",
        action="store_true",
        help="Also assert Florence EX line parses Defense -25",
    )
    args = ap.parse_args()

    sys.path.insert(0, str(ROOT))
    os.chdir(ROOT)
    os.environ.setdefault("GGEN_TIER_USE_BUNDLED_EN", "1")

    from app import extract_stat_percent_char  # noqa: E402

    if not args.traits.is_file():
        print(f"Missing traits file: {args.traits}", file=sys.stderr)
        return 2

    fails: list[str] = []
    checked = 0
    for tid, blob in _load_en_trait_values(args.traits):
        if _WEAPON_EFFECT.search(blob):
            continue
        for line in blob.splitlines():
            line = line.strip()
            if not line or not _DECREASE_LINE.search(line):
                continue
            if _WEAPON_EFFECT.search(line):
                continue
            expected = _expected_from_decrease_line(line)
            if not expected:
                continue
            checked += 1
            got = extract_stat_percent_char(line, blob)
            for stat, want in expected.items():
                have = int(got.get(stat, 0) or 0)
                if have != want:
                    fails.append(
                        f"trait {tid}: line={line!r} expected {stat}={want}, got {have} (full={got})"
                    )

    # Hard sample: Florence EX wording (class canary).
    sample = (
        'When Vigor is "Supercharged" or greater,\n'
        "increase Awaken and Reaction by 25%,\n"
        "and decrease DEF by 25%."
    )
    if args.sample or True:
        checked += 1
        line3 = "and decrease DEF by 25%."
        got = extract_stat_percent_char(line3, sample)
        if int(got.get("Defense", 0) or 0) != -25:
            fails.append(
                f"Florence canary: expected Defense=-25 from {line3!r}, got {got}"
            )

    # Sthesia Max EX: Accuracy sits in the dossier Oxford list (weapon sheet only).
    checked += 1
    sthesia_line = "Increase own Ranged, Accuracy, and Reaction by 15% (1 turn)"
    got_st = extract_stat_percent_char(sthesia_line, sthesia_line)
    if int(got_st.get("Ranged", 0) or 0) != 15 or int(got_st.get("Reaction", 0) or 0) != 15:
        fails.append(
            f"Sthesia Max EX canary: expected Ranged=15 Reaction=15 from {sthesia_line!r}, got {got_st}"
        )
    if "Accuracy" in got_st:
        fails.append(
            f"Sthesia Max EX canary: Accuracy must not enter dossier buckets, got {got_st}"
        )

    print(f"Checked {checked} pilot-dossier decrease line(s) in {args.traits.name}")
    if fails:
        print(f"FAIL: {len(fails)} parser miss(es):", file=sys.stderr)
        for row in fails[:40]:
            print(f"  {row}", file=sys.stderr)
        if len(fails) > 40:
            print(f"  … +{len(fails) - 40} more", file=sys.stderr)
        return 1
    print("Coverage: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
