import gzip
import json
import statistics
import time
import urllib.request

BASE = "https://ggendb.up.railway.app"


def fetch(url):
    req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=90) as r:
        raw = r.read()
        enc = r.headers.get("Content-Encoding", "")
    ms = int((time.perf_counter() - t0) * 1000)
    body = gzip.decompress(raw) if (enc == "gzip" or raw[:2] == b"\x1f\x8b") else raw
    return ms, len(raw), body


def health_line():
    ms, _g, b = fetch(BASE + "/health")
    h = json.loads(b)
    m = h["memory"]
    a = m["msy_adaptive"]
    return {
        "ms": ms,
        "rss": m.get("rss_mb"),
        "band": a.get("band"),
        "pair": f"{a.get('pair_len')}/{a.get('pair_max')}",
        "rpm": a.get("requests_per_min"),
        "detail_body": m.get("http_json_detail_body_cache_keys"),
    }


print("health", health_line(), flush=True)
uids = ["1001000150", "1001003050", "1003000250"]
ums, cms, bms = [], [], []
for u in uids:
    for _ in range(3):
        ms, _, _ = fetch(f"{BASE}/api/unit/{u}?lang=EN")
        ums.append(ms)
for c in ["1013000100", "1850001501"]:
    for _ in range(3):
        ms, _, _ = fetch(f"{BASE}/api/character/{c}?lang=EN")
        cms.append(ms)
for u in uids:
    for _ in range(2):
        ms, _, _ = fetch(f"{BASE}/api/unit/{u}/best_synergy_pilots?lang=EN")
        bms.append(ms)


def pack(xs):
    return {
        "p50": int(statistics.median(xs)),
        "mean": int(statistics.mean(xs)),
        "max": max(xs),
        "min": min(xs),
        "n": len(xs),
    }


print("unit_warm", pack(ums), flush=True)
print("char_warm", pack(cms), flush=True)
print("bsp_warm", pack(bms), flush=True)
print("health_after", health_line(), flush=True)
