"""Seed team/collections share codes into local collections_share_v1.json.

Usage:
  python scripts/_seed_team_code.py H31N55          # team (live API)
  python scripts/_seed_team_code.py --team H31N55
  python scripts/_seed_team_code.py --col 7WQPRK    # collections (GitHub votes branch)
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "persistent" / "collections_share_v1.json"
SHARE_RAW = (
    "https://raw.githubusercontent.com/zh7tcm9fmv-cloud/ggen_db_app/"
    "banner-votes-data/data/published/collections_share_v1.json"
)


def _load_local():
    if PATH.is_file():
        data = json.loads(PATH.read_text(encoding="utf-8"))
    else:
        data = {"v": 1, "codes": {}, "by_ip": {}, "teams": {}}
    if not isinstance(data, dict):
        data = {"v": 1, "codes": {}, "by_ip": {}, "teams": {}}
    data.setdefault("codes", {})
    data.setdefault("by_ip", {})
    data.setdefault("teams", {})
    return data


def _save(data):
    PATH.parent.mkdir(parents=True, exist_ok=True)
    PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def seed_team(code: str):
    url = f"https://ggendb.up.railway.app/api/team/share/{code}"
    req = urllib.request.Request(url, headers={"User-Agent": "ggen-local-seed", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        live = json.loads(resp.read().decode("utf-8"))
    payload = live.get("payload")
    if not isinstance(payload, dict) or int(payload.get("v") or 0) != 2:
        raise SystemExit(f"bad live team payload for {code}: {live!r}")
    data = _load_local()
    data["teams"][code] = {"p": payload, "ts": int(time.time())}
    _save(data)
    print(f"seeded team {code} (teams={len(data['teams'])})")


def seed_collections(code: str):
    req = urllib.request.Request(SHARE_RAW, headers={"User-Agent": "ggen-local-seed"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        remote = json.loads(resp.read().decode("utf-8"))
    row = (remote.get("codes") or {}).get(code)
    if not isinstance(row, dict) or not row.get("p"):
        raise SystemExit(f"collections code {code} not on banner-votes-data")
    data = _load_local()
    data["codes"][code] = row
    _save(data)
    bag = row.get("p") or {}
    print(
        f"seeded collections {code} "
        f"(units={len(bag.get('u') or {})} supporters={len(bag.get('s') or {})} "
        f"local_codes={len(data['codes'])})"
    )


def main():
    args = [a.strip() for a in sys.argv[1:] if a.strip()]
    if not args:
        raise SystemExit(__doc__)
    if args[0] in ("--col", "--collections", "-c"):
        if len(args) < 2:
            raise SystemExit("need collections code")
        seed_collections(args[1].upper())
        return
    if args[0] in ("--team", "-t"):
        if len(args) < 2:
            raise SystemExit("need team code")
        seed_team(args[1].upper())
        return
    seed_team(args[0].upper())


if __name__ == "__main__":
    main()
