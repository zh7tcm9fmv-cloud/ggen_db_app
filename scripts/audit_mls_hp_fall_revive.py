#!/usr/bin/env python3
"""
Audit MLS HP-fall revive / threshold restore pairings.

Owner lesson: recommend pilot + gated unit (Char↔Zeong, Guel↔Darilbalde, …)
must not silently lose revive because chips/name matching failed.

Gate (class-wide):
  For every character ability line that is HP-falls → restore HP:
    - Parse unit-id chips on that detail (and ability root)
    - If chips exist: at least one chip unit must load, and with that pilot
      the restore must apply (id / main_unit_id)
    - Else if "When piloting …": name or recommend_unit pair must apply
    - Recommend character on those units should be this pilot when chips
      point at a single kit (soft warn if not)

Requires local Flask:  python scripts/audit_mls_hp_fall_revive.py
Optional:             --base https://ggendb.up.railway.app
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from typing import Any

HP_FALL_RE = re.compile(
    r"HP\s+falls\s+to\s+(\d+)\s*%(?:\s*or\s+below)?|"
    r"HP(?:が|為|为)\s*(\d+)\s*%\s*(?:以下|未満|になった|になった時|時|时)|"
    r"自身HP為\s*(\d+)\s*%|"
    r"(?:降至|降到)\s*(\d+)\s*%",
    re.I,
)
HEAL_RE = re.compile(
    r"restores?\s+own\s+HP\s+by\s+(\d+)\s*%|"
    r"HP(?:を|が|為|为)?\s*(\d+)\s*%\s*回復|"
    r"HP\s*恢復\s*(\d+)\s*%|"
    r"HP\s*回复\s*(\d+)\s*%|"
    r"恢復(?:自身)?HP\s*(\d+)\s*%|"
    r"回复(?:自身)?HP\s*(\d+)\s*%|"
    r"(?:恢復|回复)\s*(\d+)\s*%",
    re.I,
)
PILOT_NAME_RE = re.compile(
    r"When\s+piloting\s+(.+?)\s+and\s+HP\s+falls|"
    r"HP\s+falls\s+to\s+\d+\s*%(?:\s*or\s+below)?\s+when\s+piloting\s+(.+?)(?:,|\s+restores)|"
    r"搭乗ユニットが[「『](.+?)[」』]|"
    r"搭乘單位為[「『](.+?)[」』]",
    re.I,
)
RESTORE_HINT = re.compile(r"restor|回復|恢復|回复", re.I)
FALL_HINT = re.compile(r"HP\s+falls\s+to|HPが|HP為|HP为|自身HP|耐久.*(?:以下|以下に|降至)", re.I)


def fetch_json(base: str, path: str, timeout: float = 60.0) -> Any:
    url = base.rstrip("/") + path
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def detail_text(d: Any) -> str:
    if isinstance(d, str):
        return d
    if isinstance(d, dict):
        return str(d.get("text") or "")
    return ""


def collect_unit_ids(obj: Any) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    def add_conds(conds: Any, groups: Any) -> None:
        bag = list(conds or [])
        for g in groups or []:
            if isinstance(g, dict):
                bag.extend(g.get("conditions") or [])
        for c in bag:
            if not isinstance(c, dict):
                continue
            if str(c.get("type") or "") == "unit" or str(c.get("source") or "") == "unit_ids":
                uid = str(c.get("id") or "")
                if uid and uid != "0" and uid not in seen:
                    seen.add(uid)
                    out.append(uid)

    if not isinstance(obj, dict):
        return out
    add_conds(obj.get("conditions"), obj.get("condition_groups"))
    return out


def first_int(*groups: str | None) -> int | None:
    for g in groups:
        if g is not None and str(g).isdigit():
            return int(g)
    return None


def parse_restore_rows(char: dict) -> list[dict]:
    rows: list[dict] = []
    for ab in char.get("abilities") or []:
        if not isinstance(ab, dict):
            continue
        ab_ids = collect_unit_ids(ab)
        details = ab.get("details") or []
        for di, d in enumerate(details):
            t = detail_text(d).replace("\n", " ").strip()
            if not t or not FALL_HINT.search(t) or not RESTORE_HINT.search(t):
                continue
            m = HP_FALL_RE.search(t)
            if not m:
                continue
            thr = first_int(*m.groups())
            if thr is None:
                continue
            m2 = HEAL_RE.search(t)
            if not m2:
                continue
            heal = first_int(*m2.groups())
            if not heal:
                continue
            ids = collect_unit_ids(d) if isinstance(d, dict) else []
            for uid in ab_ids:
                if uid not in ids:
                    ids.append(uid)
            unit_name = ""
            m3 = PILOT_NAME_RE.search(t)
            if m3:
                unit_name = next((g for g in m3.groups() if g), "") or ""
                unit_name = unit_name.strip().rstrip(".,，、")
            rows.append(
                {
                    "ability_id": str(ab.get("id") or ""),
                    "ability_name": str(ab.get("name") or ""),
                    "threshold": thr,
                    "heal_pct": heal,
                    "unit_ids": ids,
                    "unit_name": unit_name,
                    "text": t,
                }
            )
    return rows


def name_matches(unit_name: str, filter_name: str) -> bool:
    if not filter_name:
        return True
    want = re.sub(r"\s+", " ", filter_name.lower()).strip()
    have = re.sub(r"\s+", " ", (unit_name or "").lower()).strip()
    if not want or not have:
        return not want
    if have == want:
        return True
    a = re.sub(r"[()（）]", "", want)
    b = re.sub(r"[()（）]", "", have)
    return a in b or b in a


def applies(unit: dict, char: dict, row: dict) -> bool:
    uid = str(unit.get("id") or "")
    main = str(unit.get("main_unit_id") or "")
    id_set = {x for x in (uid, main) if x and x != "0"}
    ids = row.get("unit_ids") or []
    if ids:
        return any(str(i) in id_set for i in ids)
    if name_matches(str(unit.get("name") or ""), row.get("unit_name") or ""):
        return True
    if row.get("unit_name"):
        rec = (char.get("recommend_unit") or {}).get("id") or char.get("recommend_unit_id")
        return bool(rec and str(rec) in id_set)
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:5000")
    ap.add_argument("--lang", default="EN")
    ap.add_argument("--per-page", type=int, default=200)
    args = ap.parse_args()
    base = args.base
    lang = args.lang

    try:
        health = fetch_json(base, "/health", timeout=10)
    except Exception as e:
        print(f"FAIL health: {e}", file=sys.stderr)
        return 2
    if not health.get("ok") or health.get("booting"):
        print(f"FAIL server not ready: {health}", file=sys.stderr)
        return 2

    page = 1
    char_ids: list[str] = []
    while True:
        data = fetch_json(
            base,
            f"/api/characters?lang={lang}&page={page}&per_page={args.per_page}",
            timeout=120,
        )
        rows = data.get("rows") or data.get("items") or data.get("characters") or []
        if not rows and isinstance(data, list):
            rows = data
        if not rows:
            break
        for r in rows:
            cid = str((r or {}).get("id") or "")
            if cid:
                char_ids.append(cid)
        total_pages = int(data.get("total_pages") or data.get("pages") or 0)
        served = int(data.get("per_page") or len(rows) or args.per_page)
        if total_pages and page >= total_pages:
            break
        if len(rows) < served:
            break
        page += 1
        if page > 80:
            break

    print(f"Scanning {len(char_ids)} characters for HP-fall restores…")
    fails: list[str] = []
    warns: list[str] = []
    hit_chars = 0
    hit_rows = 0
    unit_cache: dict[str, dict] = {}

    def get_unit(uid: str) -> dict | None:
        if uid in unit_cache:
            return unit_cache[uid]
        try:
            u = fetch_json(base, f"/api/unit/{uid}?lang={lang}", timeout=60)
        except urllib.error.HTTPError as e:
            unit_cache[uid] = {"_error": e.code}  # type: ignore
            return None
        except Exception as e:
            unit_cache[uid] = {"_error": str(e)}  # type: ignore
            return None
        if not u or u.get("error"):
            unit_cache[uid] = None  # type: ignore
            return None
        unit_cache[uid] = u
        return u

    for cid in char_ids:
        try:
            char = fetch_json(base, f"/api/character/{cid}?lang={lang}", timeout=60)
        except Exception as e:
            fails.append(f"character {cid} fetch: {e}")
            continue
        if not char or char.get("error"):
            continue
        restores = parse_restore_rows(char)
        if not restores:
            continue
        hit_chars += 1
        cname = char.get("name") or cid
        rec_uid = str((char.get("recommend_unit") or {}).get("id") or char.get("recommend_unit_id") or "")

        for row in restores:
            hit_rows += 1
            targets = list(row["unit_ids"] or [])
            if not targets and rec_uid and row.get("unit_name"):
                targets = [rec_uid]
            if not targets and not row.get("unit_name"):
                # Ungated restore — always on; nothing to pair-check.
                continue
            if not targets:
                # Piloting name only — resolve via recommend if present.
                if not rec_uid:
                    fails.append(
                        f"{cname} ({cid}): piloting '{row['unit_name']}' but no recommend_unit "
                        f"and no unit chips — cannot verify pair"
                    )
                    continue
                targets = [rec_uid]

            ok_any = False
            for uid in targets:
                unit = get_unit(uid)
                if not unit:
                    fails.append(f"{cname} ({cid}): gated unit {uid} missing/404")
                    continue
                if applies(unit, char, row):
                    ok_any = True
                    urec = str((unit.get("recommend_character") or {}).get("id") or "")
                    if urec and urec != str(cid):
                        warns.append(
                            f"{cname} ({cid}) → {unit.get('name')} ({uid}): "
                            f"unit recommend_character={urec} (not this pilot)"
                        )
                else:
                    fails.append(
                        f"{cname} ({cid}) + {unit.get('name')} ({uid}): "
                        f"HP-fall {row['threshold']}%→{row['heal_pct']}% does NOT apply "
                        f"(chips={row['unit_ids']}, name={row['unit_name']!r})"
                    )
            if targets and not ok_any:
                # per-target fails already recorded
                pass

    print(f"Characters with HP-fall restore: {hit_chars}")
    print(f"Restore rows checked: {hit_rows}")
    if warns:
        print(f"WARN {len(warns)} (recommend mismatch — not fatal):")
        for w in warns[:30]:
            print(" ", w)
        if len(warns) > 30:
            print(f"  … +{len(warns) - 30} more")
    if fails:
        print(f"FAIL {len(fails)}:")
        for f in fails:
            print(" ", f)
        return 1
    print("OK — all gated HP-fall restores apply on chip/recommend unit with that pilot")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
