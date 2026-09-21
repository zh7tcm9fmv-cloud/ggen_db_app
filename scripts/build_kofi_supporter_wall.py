"""
Build public Ko-fi supporter wall JSON (names + thumbs only; no emails/amounts).

Preferred (payments export — unique by email):
  python scripts/build_kofi_supporter_wall.py \\
    --transactions path/to/Transaction_All.csv

Legacy (Supporters + Subscriber exports):
  python scripts/build_kofi_supporter_wall.py \\
    --supporters path/to/Supporters_*.csv \\
    --subscribers path/to/Subscriber_*.csv

Defaults look in data/kofi/raw/ for transactions.csv, supporters.csv, subscribers.csv.
Custom thumbs live under images/KofiSupporters/ on the image CDN (WebP).
Local static/images/KofiSupporters/ copies are optional (build no longer requires them).
"""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "kofi" / "raw"
PUB_PATH = ROOT / "data" / "published" / "kofi_supporter_wall.json"
FALLBACK_THUMB = "/static/images/UI/UI_Home_Menu_Icon_Shop.webp"
CROWN_NAME = None  # crown = highest total after sort (not a fixed name)

# When Ko-fi Supporters CSV lags behind payments, bump known totals here.
TOTAL_OVERRIDES = {
    # Fire Red already $60 in Transaction_All as of 2026-09-21
}

# People present on payments but not yet in Supporters export (legacy path only)
EXTRA_SUPPORTERS = []

# Anonymous / placeholder From names that collide across people → Unknown A, Unknown B, …
# (Leave "Ko-fi User" as-is when it maps to a single email.)
GENERIC_FROM_NAMES = {
    "ko-fi supporter",
    "kofi supporter",
    "supporter",
}

# Stale wall labels to drop when rebuilding (replaced by Unknown A–Z or real names)
STALE_WALL_NAMES = {
    "ko-fi supporter",
    "supporter",
    "unknown",  # bare "Unknown" from older exports
}

# Display name (casefold) → WebP filename under images/KofiSupporters/ (CDN + image_index)
THUMB_FILES = {
    "phil": "phil.webp",
    "fortexfiend": "fortexfiend.webp",
    "manafusion": "manafusion.webp",
    "2pmgaming": "2pmgaming.webp",
    "theothermc": "theothermc.webp",
    "fire red": "fire_red.webp",
    "kamen rider decade": "kamen_rider_decade.webp",
    "大漢erection": "dahan_erection.webp",
    "a俊": "ajun.webp",
    "休閒享樂": "xiuxian_xiangle.webp",
    "老狗司機": "laogou_siji.webp",
    "岳尚賢": "yue_shangxian.webp",
    "yoko": "yoko.webp",
    "剎那": "setsuna.webp",
    "戳戳": "chuochuo.webp",
}


def money(s) -> float:
    try:
        return float(str(s or "0").replace(",", "").strip() or 0)
    except (TypeError, ValueError):
        return 0.0


def truthy(s) -> bool:
    return str(s or "").strip().lower() in ("true", "1", "yes")


def is_generic_from(name: str) -> bool:
    return (name or "").strip().casefold() in GENERIC_FROM_NAMES


def unknown_letter(index: int) -> str:
    """0 → Unknown A … 25 → Unknown Z, then Unknown AA, etc."""
    if index < 0:
        index = 0
    letters = []
    n = index
    while True:
        letters.append(chr(ord("A") + (n % 26)))
        n = n // 26 - 1
        if n < 0:
            break
    return "Unknown " + "".join(reversed(letters))


def apply_display_name_prefs(name: str) -> str:
    key = name.casefold()
    if key == "fire red":
        return "Fire Red"
    if key == "kamen rider decade":
        return "Kamen Rider Decade"
    if key == "a俊":
        return "A俊"
    # Do not collapse "YMCA" / "ymca" — those are different emails on the wall.
    return name


def load_from_transactions(transactions_csv: Path) -> list[dict]:
    """One wall person per BuyerEmail; anonymous From names → Unknown A–Z by first gift."""
    by_email: dict[str, dict] = {}
    with transactions_csv.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            email = (row.get("BuyerEmail") or "").strip().lower()
            if not email:
                continue
            name = (row.get("From") or "").strip()
            amt = money(row.get("Received"))
            dt = (row.get("DateTime (UTC)") or "").strip()
            item = row.get("Item") or ""
            tt = row.get("TransactionType") or ""
            kind = "monthly" if ("Monthly" in tt or "Exclusive" in item) else "one_time"
            if email not in by_email:
                by_email[email] = {
                    "email": email,
                    "names": [],
                    "total": 0.0,
                    "kinds": set(),
                    "first": dt or None,
                }
            e = by_email[email]
            e["total"] += amt
            e["kinds"].add(kind)
            if name:
                e["names"].append((dt, name))
            if dt and (e["first"] is None or dt < e["first"]):
                e["first"] = dt

    # Anonymous emails in first-donation order → Unknown A, B, …
    anon_emails = sorted(
        (
            e["email"]
            for e in by_email.values()
            if all(is_generic_from(n) for _, n in e["names"]) or not e["names"]
        ),
        key=lambda em: (by_email[em]["first"] or "", em),
    )
    anon_map = {em: unknown_letter(i) for i, em in enumerate(anon_emails)}

    people: list[dict] = []
    for e in by_email.values():
        if e["email"] in anon_map:
            display = anon_map[e["email"]]
        else:
            # Prefer the latest non-generic From name
            non_generic = [(dt, n) for dt, n in e["names"] if not is_generic_from(n)]
            if non_generic:
                non_generic.sort(key=lambda x: x[0] or "")
                display = non_generic[-1][1]
            else:
                display = e["names"][-1][1] if e["names"] else "Unknown"
            display = apply_display_name_prefs(display)
        people.append(
            {
                "name": display,
                "total": float(e["total"]),
                "kinds": sorted(e["kinds"]),
                "first": e["first"],
            }
        )

    for key, amt in TOTAL_OVERRIDES.items():
        for p in people:
            if p["name"].casefold() == key and float(amt) > float(p["total"]):
                p["total"] = float(amt)

    people.sort(key=lambda x: (-float(x["total"]), x["name"].casefold()))
    return people


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

    for key, row in merged.items():
        row["name"] = apply_display_name_prefs(row["name"])

    for key, amt in TOTAL_OVERRIDES.items():
        if key in merged and float(amt) > float(merged[key]["total"]):
            merged[key]["total"] = float(amt)

    for extra in EXTRA_SUPPORTERS:
        ek = extra["name"].casefold()
        if ek not in merged:
            merged[ek] = {
                "name": extra["name"],
                "total": float(extra.get("total") or 0),
                "kinds": list(extra.get("kinds") or ["one_time"]),
            }

    people = sorted(merged.values(), key=lambda x: (-float(x["total"]), x["name"].casefold()))
    return people


def thumb_for(name: str) -> str:
    fn = THUMB_FILES.get(name.casefold())
    if not fn:
        return FALLBACK_THUMB
    return f"/static/images/KofiSupporters/{fn}"


def build(people: list[dict], *, keep_prior: bool = True) -> dict:
    crown_key = people[0]["name"].casefold() if people else ""

    supporters = []
    seen = set()
    for p in people:
        key = p["name"].casefold()
        # Same display name from different people: keep both, but track for prior-merge.
        seen.add(key)
        supporters.append(
            {
                "name": p["name"],
                "thumb": thumb_for(p["name"]),
                "crown": key == crown_key and not any(s.get("crown") for s in supporters),
            }
        )

    # Keep prior wall members missing from this export (e.g. custom thumbs / old gifts).
    if keep_prior and PUB_PATH.is_file():
        try:
            prev = json.loads(PUB_PATH.read_text(encoding="utf-8"))
        except Exception:
            prev = {}
        for s in prev.get("supporters") or []:
            name = (s.get("name") or "").strip()
            if not name:
                continue
            key = name.casefold()
            if key in seen or key in STALE_WALL_NAMES:
                continue
            seen.add(key)
            supporters.append(
                {
                    "name": name,
                    "thumb": s.get("thumb") or thumb_for(name),
                    "crown": False,
                }
            )

    return {
        "version": 1,
        "title": "Thank you to {n} Newtypes keeping this database alive.",
        "join_label": "Join the wall",
        "count": len(supporters),
        "supporters": supporters,
    }


def _copy_into_raw(src: Path, dest_name: str) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = RAW_DIR / dest_name
    if src.is_file() and src.resolve() != dest.resolve():
        shutil.copy2(src, dest)
        return dest
    return src if src.is_file() else dest


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--transactions", type=Path, default=RAW_DIR / "transactions.csv")
    ap.add_argument("--supporters", type=Path, default=RAW_DIR / "supporters.csv")
    ap.add_argument("--subscribers", type=Path, default=RAW_DIR / "subscribers.csv")
    ap.add_argument(
        "--no-prior",
        action="store_true",
        help="Do not keep previous wall members missing from this export",
    )
    args = ap.parse_args(argv)

    tx = args.transactions
    if tx.is_file():
        tx = _copy_into_raw(tx, "transactions.csv")
        people = load_from_transactions(tx)
        print(f"Loaded {len(people)} people from transactions ({tx})")
    else:
        if args.supporters.is_file():
            args.supporters = _copy_into_raw(args.supporters, "supporters.csv")
        if args.subscribers.is_file():
            args.subscribers = _copy_into_raw(args.subscribers, "subscribers.csv")
        if not args.supporters.is_file() and not args.subscribers.is_file():
            print(
                "No CSV inputs found. Pass --transactions and/or --supporters / --subscribers.",
                file=sys.stderr,
            )
            return 1
        people = load_merged(args.supporters, args.subscribers)
        print(f"Loaded {len(people)} people from supporters/subscribers")

    payload = build(people, keep_prior=not args.no_prior)
    PUB_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUB_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {PUB_PATH} ({payload['count']} supporters)")
    crown = next((s["name"] for s in payload["supporters"] if s.get("crown")), None)
    print(f"Crown: {crown}")
    unknowns = [s["name"] for s in payload["supporters"] if s["name"].startswith("Unknown ")]
    if unknowns:
        print("Anonymous:", ", ".join(unknowns))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
