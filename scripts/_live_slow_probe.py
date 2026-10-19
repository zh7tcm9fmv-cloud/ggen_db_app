"""Quick live slowness probe for ggendb.up.railway.app."""
from __future__ import annotations

import gzip
import json
import time
import urllib.error
import urllib.request

BASE = "https://ggendb.up.railway.app"


def fetch(path: str, timeout: float = 60.0):
    req = urllib.request.Request(
        BASE + path,
        headers={"Accept-Encoding": "gzip", "User-Agent": "ggen-slow-probe"},
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            status = r.status
            enc = r.headers.get("Content-Encoding", "")
    except urllib.error.HTTPError as e:
        raw = e.read()
        status = e.code
        enc = (e.headers.get("Content-Encoding") if e.headers else "") or ""
    except Exception as e:
        return {
            "path": path,
            "ms": int((time.perf_counter() - t0) * 1000),
            "err": str(e)[:240],
        }
    ms = int((time.perf_counter() - t0) * 1000)
    body = gzip.decompress(raw) if (enc == "gzip" or raw[:2] == b"\x1f\x8b") else raw
    out = {"path": path, "ms": ms, "status": status, "gzip": len(raw)}
    if path.startswith("/health"):
        try:
            j = json.loads(body)
            m = j.get("memory") or {}
            a = m.get("msy_adaptive") or {}
            out.update(
                {
                    "ok": j.get("ok"),
                    "booting": j.get("booting"),
                    "browse_ready": j.get("browse_ready"),
                    "rss_mb": m.get("rss_mb"),
                    "band": a.get("band"),
                    "pair_len": a.get("pair_len"),
                    "pair_max": a.get("pair_max"),
                    "pair_ceiling": a.get("pair_ceiling"),
                    "rpm": a.get("requests_per_min"),
                    "detail_body": m.get("http_json_detail_body_cache_keys"),
                    "body_cache": m.get("http_json_body_cache_keys"),
                }
            )
        except Exception as e:
            out["parse_err"] = str(e)
    return out


def main():
    paths = [
        "/health",
        "/",
        "/api/characters?lang=EN",
        "/api/units?lang=EN",
        "/api/banner_timeline?lang=EN&sv=23",
        "/api/unit/1001000150?lang=EN",
        "/api/character/1001000100?lang=EN",
        "/api/unit/1001000150/best_synergy_pilots?lang=EN",
    ]
    rows = []
    for p in paths:
        r = fetch(p)
        rows.append(r)
        print(json.dumps(r, ensure_ascii=False), flush=True)
    # settle + second health
    time.sleep(1.5)
    h2 = fetch("/health")
    rows.append(h2)
    print(json.dumps(h2, ensure_ascii=False), flush=True)
    out_path = __file__.replace(".py", "_out.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)
    print("wrote", out_path, flush=True)


if __name__ == "__main__":
    main()
