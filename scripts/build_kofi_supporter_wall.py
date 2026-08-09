"""
Build public Ko-fi supporter wall JSON (names + thumbs only; no emails/amounts).

Usage:
  python scripts/build_kofi_supporter_wall.py \\
    --supporters path/to/Supporters_*.csv \\
    --subscribers path/to/Subscriber_*.csv

Defaults look in data/kofi/raw/supporters.csv and subscribers.csv.
Custom thumbs live in static/images/KofiSupporters/ (see THUMB_FILES).
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "kofi" / "raw"
PUB_PATH = ROOT / "data" / "published" / "kofi_supporter_wall.json"
THUMB_DIR = ROOT / "static" / "images" / "KofiSupporters"
FALLBACK_THUMB = "/static/images/UI/UI_Home_Menu_Icon_Shop.webp"
CROWN_NAME = "Phil"

# Display name (casefold) -> filename under static/images/KofiSupporters/
THUMB_FILES = {
    "phil": "phil.png",
    "fortexfiend": "fortexfiend.png",
    "manafusion": "manafusion.png",
    "2pmgaming": "2pmgaming.png",
    "theothermc": "theothermc.png",
    "fire red": "fire_red.png",
    "kamen rider decade": "kamen_rider_decade.png",
    "大漢erection": "dahan_erection.png",
    "a俊": "ajun.png",
    "休閒享樂": "xiuxian_xiangle.png",
    "老狗司機": "laogou_siji.png",
    "岳尚賢": "yue_shangxian.png",
    "yoko": "yoko.png",
    "剎那": "setsuna.png",
    "戳戳": "chuochuo.png",
}


def money(s) -> float:
    try:
        return float(str(s or "0").replace(",", "").strip() or 0)
    except (TypeError, ValueError):
        return 0.0


def truthy(s) -> bool:
    return str(s or "").strip().lower() in ("true", "1", "yes")


def load_merged(supporters_csv: Path, subscribers_csv: Path) -> list[dict]:
    merged: dict[str, dict] = {}

    if supporters_csv.is_file():
        with supporters_csv.open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                name = (row.get("Name") or "").strip()
                if not name:
                    continue
                key = name.casefold()
                kinds = []
                if truthy(row.get("OneOff")):
                    kinds.append("one_time")
                if truthy(row.get("Monthly")):
                    kinds.append("monthly")
                merged[key] = {
                    "name": name,
                    "total": money(row.get("Total")),
                    "kinds": kinds,
                }

    if subscribers_csv.is_file():
        with subscribers_csv.open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                name = (row.get("Name") or "").strip()
                if not name:
                    continue
                key = name.casefold()
                total = money(row.get("Total"))
                active = truthy(row.get("IsActive"))
                if key in merged:
                    if total > float(merged[key]["total"]):
                        merged[key]["total"] = total
                    if "monthly" not in merged[key]["kinds"]:
                        merged[key]["kinds"].append("monthly")
                    merged[key]["subscriber_active"] = active
                else:
                    merged[key] = {
                        "name": name,
                        "total": total,
                        "kinds": ["monthly"],
                        "subscriber_active": active,
                    }

    # Prefer canonical casing for known custom-thumb names + Phil
    preferred = {k: k.title() if k == "phil" else None for k in ()}
    preferred = {CROWN_NAME.casefold(): CROWN_NAME}
    for disp, _fn in THUMB_FILES.items():
        # recover original casing from keys that match casefold of known names
        for key, row in merged.items():
            if key == disp:
                # keep existing Unicode display names from CSV when possible
                preferred[key] = row["name"]
    for key, row in merged.items():
        if key in preferred:
            row["name"] = preferred[key]
        # Force known English display names
        if key == "fire red":
            row["name"] = "Fire Red"
        elif key == "kamen rider decade":
            row["name"] = "Kamen Rider Decade"
        elif key == "a俊":
            row["name"] = "A俊"
        elif key == "剎那":
            row["name"] = "剎那"
        elif key == "戳戳":
            row["name"] = "戳戳"
        elif key == CROWN_NAME.casefold():
            row["name"] = CROWN_NAME

    people = sorted(merged.values(), key=lambda x: (-float(x["total"]), x["name"].casefold()))
    return people


def thumb_for(name: str) -> str:
    fn = THUMB_FILES.get(name.casefold())
    if not fn:
        return FALLBACK_THUMB
    if not (THUMB_DIR / fn).is_file():
        return FALLBACK_THUMB
    return f"/static/images/KofiSupporters/{fn}"


def build(supporters_csv: Path, subscribers_csv: Path) -> dict:
    people = load_merged(supporters_csv, subscribers_csv)
    crown_key = CROWN_NAME.casefold()
    if crown_key not in {p["name"].casefold() for p in people} and people:
        crown_key = people[0]["name"].casefold()

    supporters = []
    for p in people:
        key = p["name"].casefold()
        supporters.append(
            {
                "name": p["name"],
                "thumb": thumb_for(p["name"]),
                "crown": key == crown_key,
            }
        )

    return {
        "version": 1,
        "title": "Thank you to {n} Newtypes keeping this database alive.",
        "join_label": "Join the wall",
        "count": len(supporters),
        "supporters": supporters,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--supporters", type=Path, default=RAW_DIR / "supporters.csv")
    ap.add_argument("--subscribers", type=Path, default=RAW_DIR / "subscribers.csv")
    args = ap.parse_args(argv)

    if not args.supporters.is_file() and not args.subscribers.is_file():
        print("No CSV inputs found. Pass --supporters / --subscribers.", file=sys.stderr)
        return 1

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    # Keep local copies when paths are outside raw/
    if args.supporters.is_file() and args.supporters.resolve() != (RAW_DIR / "supporters.csv").resolve():
        shutil.copy2(args.supporters, RAW_DIR / "supporters.csv")
        args.supporters = RAW_DIR / "supporters.csv"
    if args.subscribers.is_file() and args.subscribers.resolve() != (RAW_DIR / "subscribers.csv").resolve():
        shutil.copy2(args.subscribers, RAW_DIR / "subscribers.csv")
        args.subscribers = RAW_DIR / "subscribers.csv"

    payload = build(args.supporters, args.subscribers)
    PUB_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUB_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {PUB_PATH} ({payload['count']} supporters)")
    crown = next((s["name"] for s in payload["supporters"] if s.get("crown")), None)
    print(f"Crown: {crown}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
