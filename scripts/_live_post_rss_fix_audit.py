"""Post-deploy live audit after RSS body-cache retention fix."""
from __future__ import annotations

import gzip
import json
import statistics
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://ggendb.up.railway.app"
OUT = Path(__file__).with_name("_live_post_rss_fix_audit_out.json")


def fetch(path: str, timeout: float = 60.0):
    req = urllib.request.Request(
        BASE + path,
        headers={"Accept-Encoding": "gzip", "User-Agent": "ggen-rss-audit"},
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
    return {
        "path": path,
        "ms": ms,
        "status": status,
        "gzip": len(raw),
        "body": body,
        "enc": enc,
    }


def health():
    r = fetch("/health")
    j = {}
    if r.get("body"):
        try:
            j = json.loads(r["body"])
        except Exception:
            pass
    m = j.get("memory") or {}
    a = m.get("msy_adaptive") or {}
    return {
        "ms": r.get("ms"),
        "ok": j.get("ok"),
        "booting": j.get("booting"),
        "browse_ready": j.get("browse_ready"),
        "rss_mb": m.get("rss_mb"),
        "band": a.get("band"),
        "pair_len": a.get("pair_len"),
        "pair_max": a.get("pair_max"),
        "pair_ceiling": a.get("pair_ceiling"),
        "weapon_len": a.get("weapon_len"),
        "weapon_max": a.get("weapon_max"),
        "rpm": a.get("requests_per_min"),
        "api_cache_keys": m.get("api_cache_keys"),
        "detail_body_keys": m.get("http_json_detail_body_cache_keys"),
        "body_keys": m.get("http_json_body_cache_keys"),
        "body_mb": m.get("http_json_body_cache_mb"),
        "detail_mb": m.get("http_json_detail_body_cache_mb"),
        "body_budget_mb": m.get("http_json_body_cache_budget_mb"),
        "bsp_lru": m.get("bsp_group_lru"),
        "bsp_lru_max": m.get("bsp_group_lru_max"),
        "bsp_sharded": m.get("bsp_sharded"),
        "err": r.get("err"),
    }


def summ(rows):
    ok = [x for x in rows if x.get("status") and 200 <= x["status"] < 300]
    if not ok:
        return None
    ms = [x["ms"] for x in ok]
    return {
        "n": len(ok),
        "p50": int(statistics.median(ms)),
        "mean": int(statistics.mean(ms)),
        "max": max(ms),
        "min": min(ms),
        "gzip": ok[0].get("gzip"),
    }


def warm(path, n=4):
    rows = []
    for _ in range(n):
        r = fetch(path)
        rows.append({k: r.get(k) for k in ("path", "ms", "status", "gzip", "err")})
        time.sleep(0.05)
    return summ(rows), rows


def main():
    out = {}
    print("=== HEALTH (coldish) ===", flush=True)
    h0 = health()
    print(json.dumps(h0, ensure_ascii=False), flush=True)
    out["health"] = h0

    gate = {
        "body_mb_field_present": h0.get("body_mb") is not None,
        "body_budget_present": h0.get("body_budget_mb") is not None,
        "browse_ready": bool(h0.get("browse_ready")),
        "not_booting": h0.get("booting") is False,
        "bsp_sharded": bool(h0.get("bsp_sharded")),
    }
    out["gate"] = gate
    print("gate", gate, flush=True)

    # Warm matrices (the retainer class)
    print("=== MATRIX WARM ===", flush=True)
    for p in (
        "/api/tag_matrix?lang=EN",
        "/api/debuff_matrix?lang=EN",
        "/api/tag_matrix?lang=JA",
        "/api/debuff_matrix?lang=JA",
    ):
        s, _ = warm(p, 2)
        out[p] = s
        print(p, s, flush=True)

    print("=== CRITICAL ===", flush=True)
    crit = {}
    for p in (
        "/",
        "/api/characters?lang=EN",
        "/api/units?lang=EN",
        "/api/banner_timeline?lang=EN&sv=23",
        "/api/unit/1001000150?lang=EN",
        "/api/character/1001000100?lang=EN",
        "/api/unit/1001000150/best_synergy_pilots?lang=EN",
    ):
        cold = fetch(p)
        warm2 = fetch(p)
        crit[p] = {
            "cold_ms": cold.get("ms"),
            "warm_ms": warm2.get("ms"),
            "gzip": warm2.get("gzip") or cold.get("gzip"),
            "status": warm2.get("status") or cold.get("status"),
            "err": cold.get("err") or warm2.get("err"),
        }
        print(p, crit[p], flush=True)
    out["critical"] = crit

    # Steady repeats
    print("=== STEADY ===", flush=True)
    time.sleep(1.0)
    unit_s, _ = warm("/api/unit/1001000150?lang=EN", 6)
    char_s, _ = warm("/api/character/1001000100?lang=EN", 4)
    bsp_s, _ = warm("/api/unit/1001000150/best_synergy_pilots?lang=EN", 4)
    out["unit_warm"] = unit_s
    out["char_warm"] = char_s
    out["bsp_warm"] = bsp_s
    print("unit_warm", unit_s, flush=True)
    print("char_warm", char_s, flush=True)
    print("bsp_warm", bsp_s, flush=True)

    print("=== HEALTH AFTER ===", flush=True)
    h1 = health()
    print(json.dumps(h1, ensure_ascii=False), flush=True)
    out["health_after"] = h1

    # Compare to pre-fix probe (~1321 MB, no body_mb field)
    out["vs_pre_fix"] = {
        "rss_before_mb": 1321.1,
        "rss_after_mb": h1.get("rss_mb"),
        "rss_delta_mb": (
            None
            if h1.get("rss_mb") is None
            else round(float(h1["rss_mb"]) - 1321.1, 1)
        ),
        "body_mb_after": h1.get("body_mb"),
        "detail_mb_after": h1.get("detail_mb"),
    }
    print("vs_pre_fix", out["vs_pre_fix"], flush=True)

    OUT.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("wrote", OUT, flush=True)


if __name__ == "__main__":
    main()
