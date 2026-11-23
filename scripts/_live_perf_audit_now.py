#!/usr/bin/env python3
"""Live gzip warm audit vs snappy bar (browser signals)."""
from __future__ import annotations

import gzip
import json
import time
import urllib.error
import urllib.request

BASE = "https://ggendb.up.railway.app"
BROWSER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json,*/*",
    "Accept-Encoding": "gzip",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Origin": BASE,
    "Referer": BASE + "/",
}

PATHS = [
    "/health",
    "/",
    "/api/characters?lang=EN",
    "/api/units?lang=EN",
    "/api/banner_timeline?lang=EN&sv=23",
    "/api/banner_timeline/votes",
    "/api/whats_new?lang=EN",
    "/api/sp_investment?lang=EN",
    "/api/unit/1001000150?lang=EN",
    "/api/character/1001000100?lang=EN",
    "/api/unit/1001000150/best_synergy_pilots?lang=EN",
    "/api/tag_matrix?lang=EN",
    "/api/debuff_matrix?lang=EN",
    "/api/develop/series",
    "/develop",
]


def fetch(path: str, timeout: float = 45.0) -> dict:
    url = BASE + path
    req = urllib.request.Request(url, headers=BROWSER)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            status = r.status
            enc = r.headers.get("Content-Encoding", "") or ""
            ctype = r.headers.get("Content-Type", "") or ""
    except urllib.error.HTTPError as e:
        raw = e.read()
        status = e.code
        enc = (e.headers.get("Content-Encoding") if e.headers else "") or ""
        ctype = (e.headers.get("Content-Type") if e.headers else "") or ""
    except Exception as e:
        return {"path": path, "ms": int((time.perf_counter() - t0) * 1000), "ok": False, "err": str(e)[:200]}
    ms = int((time.perf_counter() - t0) * 1000)
    body = raw
    if "gzip" in enc.lower() or (len(raw) >= 2 and raw[0] == 0x1F and raw[1] == 0x8B):
        try:
            body = gzip.decompress(raw)
        except Exception:
            body = raw
    out = {
        "path": path,
        "ms": ms,
        "ok": 200 <= status < 400,
        "status": status,
        "wire": len(raw),
        "body": len(body),
        "ctype": ctype[:60],
    }
    if path == "/health":
        try:
            j = json.loads(body.decode("utf-8", "replace"))
            mem = j.get("memory") or {}
            msy = mem.get("msy_adaptive") or {}
            out["health"] = {
                "booting": j.get("booting"),
                "ok": j.get("ok"),
                "rss_mb": mem.get("rss_mb"),
                "band": msy.get("band"),
                "rpm": msy.get("requests_per_min"),
                "pair_len": msy.get("pair_len"),
                "pair_max": msy.get("pair_max"),
            }
        except Exception:
            pass
    return out


def best_of(path: str, n: int = 3) -> dict:
    runs = [fetch(path) for _ in range(n)]
    ok = [r for r in runs if r.get("ok")]
    pick = min(ok or runs, key=lambda r: r.get("ms", 10**9))
    pick["runs"] = [r.get("ms") for r in runs]
    return pick


def main() -> None:
    # Cold-ish first pass then warm best-of
    cold = {p: fetch(p) for p in PATHS}
    time.sleep(0.35)
    warm = {p: best_of(p, 3) for p in PATHS}
    report = {"base": BASE, "cold": cold, "warm": warm, "at": time.strftime("%Y-%m-%d %H:%M:%S %z")}
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
