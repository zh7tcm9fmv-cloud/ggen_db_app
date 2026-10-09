"""
Gate: unit detail CP/PEP feature flags must match EN for every other locale.

Locales are translations only — has_pilot_cond_passive, has_cond_weapon_range,
has_cond_stats, and pilot_tag_weapon_stat_bonuses must not silently drop on KR/JA/TW/HK.

  python scripts/check_locale_pep_parity.py
  python scripts/check_locale_pep_parity.py --langs KR,JA --limit 0

Exit 0 = OK. Exit 1 = parity miss (prints failing unit ids).
Requires local Flask on :5000 with DB ready.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:5000"


def _get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=120) as r:
        return json.load(r)


def _unit_flags(u: dict) -> tuple:
    pep = u.get("pilot_tag_weapon_stat_bonuses") or {}
    return (
        bool(u.get("has_pilot_cond_passive")),
        bool(u.get("has_cond_weapon_range")),
        bool(u.get("has_cond_stats")),
        int(pep.get("acc") or 0),
        int(pep.get("crit") or 0),
        len(u.get("cp_weapon_range_mods") or []),
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", default="KR,JA,TW,HK", help="Comma locales to compare vs EN")
    ap.add_argument("--limit", type=int, default=0, help="Max unit ids (0 = all playable from /api/units pages)")
    ap.add_argument("--per-page", type=int, default=100)
    args = ap.parse_args()
    langs = [x.strip().upper() for x in args.langs.split(",") if x.strip()]

    try:
        health = _get("/health")
    except Exception as e:
        print(f"Flask not reachable at {BASE}: {e}", file=sys.stderr)
        return 2
    if health.get("booting"):
        print("Flask still booting", file=sys.stderr)
        return 2

    ids: list[str] = []
    page = 1
    while True:
        data = _get(f"/api/units?lang=EN&page={page}&per_page={args.per_page}&sort=rarity&dir=desc")
        rows = data.get("rows") or []
        for r in rows:
            uid = str(r.get("id") or "")
            if uid:
                ids.append(uid)
        tp = int(data.get("total_pages") or 1)
        if page >= tp or (args.limit and len(ids) >= args.limit):
            break
        page += 1
    if args.limit:
        ids = ids[: args.limit]

    fails: list[str] = []
    checked = 0
    for uid in ids:
        try:
            en = _get(f"/api/unit/{uid}?lang=EN")
        except urllib.error.HTTPError:
            continue
        en_f = _unit_flags(en)
        # Only compare units that have any of these features on EN (or always compare zeros).
        checked += 1
        for lang in langs:
            try:
                other = _get(f"/api/unit/{uid}?lang={lang}")
            except urllib.error.HTTPError as e:
                fails.append(f"{uid} {lang}: HTTP {e.code}")
                continue
            ot = _unit_flags(other)
            if en_f != ot:
                fails.append(
                    f"{uid} {en.get('name')}: EN={en_f} {lang}={ot}"
                )

    print(f"Checked {checked} units vs EN for {langs}")
    if fails:
        print(f"FAIL: {len(fails)} parity miss(es):", file=sys.stderr)
        for row in fails[:60]:
            print(f"  {row}", file=sys.stderr)
        if len(fails) > 60:
            print(f"  … +{len(fails) - 60} more", file=sys.stderr)
        return 1
    print("Coverage: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
