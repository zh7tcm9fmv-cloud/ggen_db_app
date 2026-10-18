"""Post-deploy live audit for ggendb.up.railway.app."""
from __future__ import annotations

import concurrent.futures
import gzip
import json
import statistics
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://ggendb.up.railway.app"
UNITS = ["1001000150", "1001003050", "1003000250", "1009000550", "1013000350"]
CHARS = ["1013000100", "1001000100", "1850001501"]


def fetch(url: str, timeout: float = 90.0):
    req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip"})
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
        return {"ok": False, "ms": int((time.perf_counter() - t0) * 1000), "err": str(e)}
    ms = int((time.perf_counter() - t0) * 1000)
    body = gzip.decompress(raw) if (enc == "gzip" or raw[:2] == b"\x1f\x8b") else raw
    return {"ok": 200 <= status < 300, "status": status, "ms": ms, "gzip": len(raw), "body": body}


def health():
    r = fetch(BASE + "/health", 30)
    j = json.loads(r["body"]) if r.get("ok") else {}
    m = j.get("memory") or {}
    a = m.get("msy_adaptive") or {}
    return {
        "ms": r.get("ms"),
        "rss": m.get("rss_mb"),
        "band": a.get("band"),
        "pair_len": a.get("pair_len"),
        "pair_max": a.get("pair_max"),
        "pair_ceiling": a.get("pair_ceiling"),
        "rpm": a.get("requests_per_min"),
        "detail_body": m.get("http_json_detail_body_cache_keys"),
        "body": m.get("http_json_body_cache_keys"),
        "browse": j.get("browse_ready"),
    }


def summ(xs):
    ok = [x for x in xs if x.get("ok")]
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


def main():
    out = {}
    print("=== HEALTH ===", flush=True)
    h0 = health()
    print(h0, flush=True)
    out["health"] = h0

    print("=== ASSETS ===", flush=True)
    css = fetch(BASE + "/static/css/app_shell_bundle.min.css", 60)
    s = css["body"].decode("utf-8", "ignore") if css.get("ok") else ""
    js = fetch(BASE + "/static/js/unit_best_pilots.js", 60)
    sj = js["body"].decode("utf-8", "ignore") if js.get("ok") else ""
    amin = fetch(BASE + "/static/js/app.min.js", 90)
    sa = amin["body"].decode("utf-8", "ignore") if amin.get("ok") else ""
    assets = {
        "css_240": "240px,62vw" in s,
        "css_300_78": "300px,78vw" in s,
        "css_koma": "unit-detail-koma-row" in s,
        "js_abort": "abortActiveFetch" in sj,
        "js_1600": "1600" in sj and "scheduleDetailPrefetch" in sj,
        "appmin_koma": "unit-detail-koma" in sa or "unitKomaRowHtml" in sa,
        "css_ms": css.get("ms"),
        "js_ms": js.get("ms"),
    }
    print(assets, flush=True)
    out["assets"] = assets

    print("=== CALM DETAIL ===", flush=True)
    uc, uw, cw = [], [], []
    for u in UNITS[:3]:
        uc.append(fetch(f"{BASE}/api/unit/{u}?lang=EN"))
        uw.append(fetch(f"{BASE}/api/unit/{u}?lang=EN"))
        uw.append(fetch(f"{BASE}/api/unit/{u}?lang=EN"))
    for c in CHARS[:2]:
        fetch(f"{BASE}/api/character/{c}?lang=EN")
        cw.append(fetch(f"{BASE}/api/character/{c}?lang=EN"))
        cw.append(fetch(f"{BASE}/api/character/{c}?lang=EN"))
    out["unit_cold"] = summ(uc)
    out["unit_warm"] = summ(uw)
    out["char_warm"] = summ(cw)
    print("unit_cold", out["unit_cold"], flush=True)
    print("unit_warm", out["unit_warm"], flush=True)
    print("char_warm", out["char_warm"], flush=True)

    print("=== BSP ===", flush=True)
    uid = UNITS[0]
    bc = fetch(f"{BASE}/api/unit/{uid}/best_synergy_pilots?lang=EN")
    bw = [fetch(f"{BASE}/api/unit/{uid}/best_synergy_pilots?lang=EN") for _ in range(3)]
    out["bsp_cold"] = summ([bc])
    out["bsp_warm"] = summ(bw)
    j = json.loads(bc["body"]) if bc.get("ok") else {}
    out["bsp_feat"] = {
        "source": j.get("source"),
        "pilots": len(j.get("pilots") or []),
        "modes": sorted((j.get("modes") or {}).keys()),
        "no_ur": len(j.get("pilots_no_ur") or []),
        "same_role": len(j.get("pilots_same_role") or []),
        "eligible": j.get("eligible"),
    }
    print("bsp_cold", out["bsp_cold"], flush=True)
    print("bsp_warm", out["bsp_warm"], flush=True)
    print("bsp_feat", out["bsp_feat"], flush=True)

    uj = json.loads(fetch(f"{BASE}/api/unit/{uid}?lang=EN")["body"])
    out["unit_feat"] = {
        "name": uj.get("name"),
        "abilities": len(uj.get("abilities") or []),
        "weapons": len(uj.get("weapons") or []),
        "model": uj.get("model"),
        "portrait": bool(uj.get("portrait")),
    }
    print("unit_feat", out["unit_feat"], flush=True)

    print("=== STORM SEQ ===", flush=True)
    su, sb = [], []
    for u in UNITS:
        su.append(fetch(f"{BASE}/api/unit/{u}?lang=EN"))
        sb.append(fetch(f"{BASE}/api/unit/{u}/best_synergy_pilots?lang=EN"))
    out["storm_unit"] = summ(su)
    out["storm_bsp"] = summ(sb)
    print("storm_unit", out["storm_unit"], flush=True)
    print("storm_bsp", out["storm_bsp"], flush=True)

    print("=== PARALLEL ===", flush=True)
    paths = []
    for u in UNITS:
        paths.append(f"/api/unit/{u}?lang=EN")
        paths.append(f"/api/unit/{u}/best_synergy_pilots?lang=EN")
    t0 = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(fetch, BASE + p) for p in paths]
        rows = [f.result() for f in futs]
    wall = int((time.perf_counter() - t0) * 1000)
    ums = [rows[i]["ms"] for i, p in enumerate(paths) if "best_" not in p and rows[i].get("ok")]
    bms = [rows[i]["ms"] for i, p in enumerate(paths) if "best_" in p and rows[i].get("ok")]
    out["parallel"] = {
        "wall": wall,
        "unit_max": max(ums),
        "unit_p50": int(statistics.median(ums)),
        "bsp_max": max(bms),
        "bsp_p50": int(statistics.median(bms)),
    }
    print(out["parallel"], flush=True)

    print("=== CRITICAL ===", flush=True)
    crit = {}
    for path in [
        "/",
        "/api/characters?lang=EN",
        "/api/units?lang=EN",
        "/api/banner_timeline?lang=EN&sv=23",
    ]:
        a = fetch(BASE + path)
        b = fetch(BASE + path)
        crit[path] = {"cold": a.get("ms"), "warm": b.get("ms"), "gzip": b.get("gzip")}
        print(path, crit[path], flush=True)
    out["critical"] = crit

    print("=== HEALTH AFTER ===", flush=True)
    h1 = health()
    print(h1, flush=True)
    out["health_after"] = h1

    # Gate
    gate = {
        "detail_body_present": h1.get("detail_body") is not None,
        "css_240": assets["css_240"],
        "css_not_300_78": not assets["css_300_78"],
        "js_abort": assets["js_abort"],
        "js_1600": assets["js_1600"],
        "appmin_koma": assets["appmin_koma"],
        "bsp_features_ok": out["bsp_feat"].get("source") == "published_dc"
        and out["bsp_feat"].get("pilots") == 10
        and len(out["bsp_feat"].get("modes") or []) == 3,
        "band_not_stuck_pressure_only": h1.get("band") in ("calm", "mid", "pressure"),
    }
    out["gate"] = gate
    print("=== GATE ===", flush=True)
    print(gate, flush=True)
    print("GATE_PASS", all(gate.values()), flush=True)

    path = Path("scripts/_live_post_deploy_audit_out.json")
    path.write_text(json.dumps(out, indent=2), encoding="utf-8")
    print("Wrote", path, flush=True)


if __name__ == "__main__":
    main()
