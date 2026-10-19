"""Shared live/local load-performance probes for the dashboard app."""
from __future__ import annotations

import gzip
import json
import statistics
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

LIVE_BASE = "https://ggendb.up.railway.app"
LOCAL_BASE = "http://127.0.0.1:5000"
UA = "ggen-load-perf-dashboard/1.0"

CRITICAL_PATHS = (
    "/",
    "/api/characters?lang=EN",
    "/api/units?lang=EN",
    "/api/banner_timeline?lang=EN&sv=23",
    "/api/unit/1001000150?lang=EN",
    "/api/character/1001000100?lang=EN",
    "/api/unit/1001000150/best_synergy_pilots?lang=EN",
)

MATRIX_PATHS = (
    "/api/tag_matrix?lang=EN",
    "/api/debuff_matrix?lang=EN",
    "/api/tag_matrix?lang=JA",
    "/api/debuff_matrix?lang=JA",
)

DEFAULT_STORE = Path(__file__).with_name("load_perf_dashboard_last.json")
HISTORY_STORE = Path(__file__).with_name("load_perf_dashboard_history.json")


def fetch(base: str, path: str, timeout: float = 45.0) -> dict[str, Any]:
    url = base.rstrip("/") + path
    req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip", "User-Agent": UA})
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            status = r.status
            enc = r.headers.get("Content-Encoding", "") or ""
    except urllib.error.HTTPError as e:
        raw = e.read()
        status = e.code
        enc = (e.headers.get("Content-Encoding") if e.headers else "") or ""
    except Exception as e:
        return {
            "path": path,
            "ms": int((time.perf_counter() - t0) * 1000),
            "err": str(e)[:240],
            "ok": False,
        }
    ms = int((time.perf_counter() - t0) * 1000)
    body = gzip.decompress(raw) if (enc == "gzip" or raw[:2] == b"\x1f\x8b") else raw
    return {
        "path": path,
        "ms": ms,
        "status": status,
        "gzip": len(raw),
        "body": body,
        "ok": 200 <= status < 300,
    }


def parse_health(row: dict[str, Any]) -> dict[str, Any]:
    j: dict[str, Any] = {}
    if row.get("body"):
        try:
            j = json.loads(row["body"])
        except Exception:
            pass
    m = j.get("memory") or {}
    a = m.get("msy_adaptive") or {}
    return {
        "ms": row.get("ms"),
        "ok": j.get("ok"),
        "reachable": bool(row.get("ok")),
        "err": row.get("err"),
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
        "body_keys": m.get("http_json_body_cache_keys"),
        "detail_keys": m.get("http_json_detail_body_cache_keys"),
        "body_mb": m.get("http_json_body_cache_mb"),
        "detail_mb": m.get("http_json_detail_body_cache_mb"),
        "body_budget_mb": m.get("http_json_body_cache_budget_mb"),
        "bsp_lru": m.get("bsp_group_lru"),
        "bsp_lru_max": m.get("bsp_group_lru_max"),
        "bsp_sharded": m.get("bsp_sharded"),
    }


def _summ(ms_list: list[int]) -> dict[str, Any] | None:
    if not ms_list:
        return None
    return {
        "n": len(ms_list),
        "p50": int(statistics.median(ms_list)),
        "mean": int(statistics.mean(ms_list)),
        "min": min(ms_list),
        "max": max(ms_list),
    }


def probe_target(base: str, *, label: str, include_matrix: bool = True) -> dict[str, Any]:
    """One full audit of a base URL (live or local)."""
    t0 = time.perf_counter()
    health0 = parse_health(fetch(base, "/health"))
    paths = list(CRITICAL_PATHS)
    if include_matrix:
        paths.extend(MATRIX_PATHS)

    cold: dict[str, Any] = {}
    warm: dict[str, Any] = {}
    for path in paths:
        a = fetch(base, path)
        b = fetch(base, path)
        cold[path] = {
            "ms": a.get("ms"),
            "ok": a.get("ok"),
            "status": a.get("status"),
            "gzip": a.get("gzip"),
            "err": a.get("err"),
        }
        warm[path] = {
            "ms": b.get("ms"),
            "ok": b.get("ok"),
            "status": b.get("status"),
            "gzip": b.get("gzip"),
            "err": b.get("err"),
        }
        time.sleep(0.03)

    # Steady warm for detail/BSP (more samples)
    unit_ms = []
    char_ms = []
    bsp_ms = []
    for _ in range(4):
        u = fetch(base, "/api/unit/1001000150?lang=EN")
        if u.get("ok"):
            unit_ms.append(int(u["ms"]))
        c = fetch(base, "/api/character/1001000100?lang=EN")
        if c.get("ok"):
            char_ms.append(int(c["ms"]))
        bp = fetch(base, "/api/unit/1001000150/best_synergy_pilots?lang=EN")
        if bp.get("ok"):
            bsp_ms.append(int(bp["ms"]))

    health1 = parse_health(fetch(base, "/health"))
    wall = int((time.perf_counter() - t0) * 1000)
    return {
        "label": label,
        "base": base,
        "wall_ms": wall,
        "health": health0,
        "health_after": health1,
        "cold": cold,
        "warm": warm,
        "steady": {
            "unit": _summ(unit_ms),
            "char": _summ(char_ms),
            "bsp": _summ(bsp_ms),
        },
    }


def _ms(row: dict[str, Any] | None) -> int | None:
    if not row:
        return None
    if row.get("err") or not row.get("ok", True):
        return None
    try:
        return int(row["ms"])
    except (TypeError, ValueError, KeyError):
        return None


def build_insights(live: dict[str, Any], local: dict[str, Any] | None) -> list[str]:
    tips: list[str] = []
    lh = live.get("health_after") or live.get("health") or {}
    if not lh.get("reachable") and not lh.get("ok"):
        tips.append("Live /health unreachable — check Railway deploy or network.")
        return tips

    rss = lh.get("rss_mb")
    body_mb = lh.get("body_mb")
    band = lh.get("band")
    rpm = lh.get("rpm")

    if rss is not None:
        if float(rss) >= 1250:
            tips.append(
                f"Live RSS {rss} MB is in the pressure zone (≥1250). "
                "Expect GIL thrash if browse/detail feel laggy; restart Railway if it stays stuck high."
            )
        elif float(rss) >= 1100:
            tips.append(f"Live RSS {rss} MB is elevated (mid band). Watch if it keeps climbing.")
        else:
            tips.append(f"Live RSS {rss} MB looks calm relative to the ~1.1–1.25 GB pressure bands.")

    if body_mb is not None:
        if float(body_mb) > 8:
            tips.append(f"Live body cache {body_mb} MB is over the 8 MB budget — unexpected retention.")
        else:
            tips.append(f"Live body cache {body_mb} MB is within budget (gzip-first boards OK).")
    else:
        tips.append("Live /health missing body_mb — older deploy without the RSS retention fields.")

    if band == "pressure" and rss is not None and float(rss) < 1250 and (rpm or 0) >= 80:
        tips.append(
            f"Band is pressure from traffic (rpm≈{rpm}), not only RSS. Pair cache stays floored — expected under load."
        )

    unit = (live.get("steady") or {}).get("unit") or {}
    bsp = (live.get("steady") or {}).get("bsp") or {}
    if unit.get("p50") is not None:
        if unit["p50"] > 600:
            tips.append(f"Live unit warm p50 {unit['p50']} ms is heavy (RTT + worker).")
        else:
            tips.append(f"Live unit warm p50 {unit['p50']} ms is in the normal TW→Railway range.")
    if bsp.get("max") is not None and bsp.get("p50") is not None and bsp["max"] > 2000 and bsp["p50"] < 500:
        tips.append(
            f"Live BSP had a cold-shard spike (max {bsp['max']} ms) while warm p50 stayed {bsp['p50']} ms — normal."
        )

    home = _ms((live.get("warm") or {}).get("/"))
    if home is not None and home > 1500:
        tips.append(f"Live homepage warm {home} ms — above snappy bar; check RSS / worker.")

    if local:
        loc_h = local.get("health_after") or local.get("health") or {}
        if not loc_h.get("reachable") and not loc_h.get("ok"):
            tips.append("Local :5000 not reachable — start `python wsgi.py` to compare.")
        else:
            lu = ((local.get("steady") or {}).get("unit") or {}).get("p50")
            if lu is not None and unit.get("p50") is not None:
                tips.append(
                    f"Local unit warm p50 {lu} ms vs live {unit['p50']} ms "
                    "(local should be near 1–20 ms if the process is warm)."
                )
            if loc_h.get("body_mb") is not None and body_mb is not None:
                tips.append(
                    f"Body cache MB — local {loc_h.get('body_mb')} · live {body_mb}."
                )
            # Gate: new fields on live match local capability
            if loc_h.get("body_budget_mb") is not None and lh.get("body_budget_mb") is None:
                tips.append("Local has body_budget_mb but live does not — live may be behind this tree.")
            elif loc_h.get("body_budget_mb") is not None and lh.get("body_budget_mb") is not None:
                tips.append("Live and local both expose body cache budget fields (deploy fingerprint OK).")

    if not tips:
        tips.append("No strong signals — see the tables for raw timings.")
    return tips


def build_verdict(live: dict[str, Any], insights: list[str]) -> dict[str, str]:
    """Short Callout-style headline for the dashboard UI."""
    lh = live.get("health_after") or live.get("health") or {}
    if not lh.get("reachable") and not lh.get("ok"):
        return {
            "tone": "bad",
            "title": "Verdict: live unreachable",
            "body": insights[0] if insights else "Could not reach live /health.",
        }

    rss = lh.get("rss_mb")
    body_mb = lh.get("body_mb")
    unit = ((live.get("steady") or {}).get("unit") or {}).get("p50")
    bsp = ((live.get("steady") or {}).get("bsp") or {}).get("p50")
    band = lh.get("band")
    rpm = lh.get("rpm")

    body = " ".join(insights[:3]) if insights else ""

    if rss is not None and float(rss) >= 1250:
        return {
            "tone": "bad",
            "title": "Verdict: live under RSS pressure — snappy bar at risk",
            "body": body,
        }
    if body_mb is not None and float(body_mb) > 8:
        return {
            "tone": "warn",
            "title": "Verdict: body cache over budget — check matrix retention",
            "body": body,
        }
    if unit is not None and unit > 600:
        return {
            "tone": "warn",
            "title": "Verdict: warm detail paths are heavy",
            "body": body,
        }

    title = "Verdict: live warm paths look under control"
    if rss is not None and body_mb is not None and unit is not None and bsp is not None:
        title = (
            f"Verdict: warm paths OK — RSS {rss} MB · body {body_mb} MB · "
            f"unit p50 {unit} ms · BSP p50 {bsp} ms"
        )
        if band == "pressure" and (rpm or 0) >= 80 and float(rss) < 1250:
            title = "Verdict: snappy warm paths — band=pressure is traffic, not a stuck heap"
    return {"tone": "ok", "title": title, "body": body}


def chart_bars(live: dict[str, Any]) -> list[dict[str, Any]]:
    """Bars for the dashboard warm-TTFB chart (label + ms) — same set as the canvas."""
    bars: list[dict[str, Any]] = []
    steady = live.get("steady") or {}
    for key, label in (("unit", "unit warm p50"), ("char", "char warm p50"), ("bsp", "BSP warm p50")):
        p50 = (steady.get(key) or {}).get("p50")
        if p50 is not None:
            bars.append({"label": label, "ms": int(p50)})
    ha = live.get("health_after") or {}
    if ha.get("ms") is not None:
        bars.append({"label": "/health after", "ms": int(ha["ms"])})
    warm = live.get("warm") or {}
    for path, label in (
        ("/api/characters?lang=EN", "/api/characters"),
        ("/api/banner_timeline?lang=EN&sv=23", "/api/banner_timeline"),
        ("/api/tag_matrix?lang=EN", "tag_matrix EN"),
        ("/api/debuff_matrix?lang=EN", "debuff_matrix EN"),
    ):
        ms = _ms(warm.get(path))
        if ms is not None:
            bars.append({"label": label, "ms": ms})
    return bars


def _gzip_kb(row: dict[str, Any] | None) -> str:
    if not row or row.get("gzip") is None:
        return "—"
    try:
        n = int(row["gzip"])
    except (TypeError, ValueError):
        return "—"
    if n >= 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n} B"


def load_history(path: Path | None = None) -> list[dict[str, Any]]:
    path = path or HISTORY_STORE
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return list(data) if isinstance(data, list) else []
    except Exception:
        return []


def append_history(live: dict[str, Any], at: str, path: Path | None = None) -> list[dict[str, Any]]:
    """Keep last 12 health snaps so RSS-over-day table can grow across Updates."""
    path = path or HISTORY_STORE
    lh = live.get("health_after") or live.get("health") or {}
    entry = {
        "at": at,
        "rss_mb": lh.get("rss_mb"),
        "body_mb": lh.get("body_mb"),
        "detail_mb": lh.get("detail_mb"),
        "band": lh.get("band"),
        "rpm": lh.get("rpm"),
        "pair_len": lh.get("pair_len"),
        "pair_max": lh.get("pair_max"),
        "body_budget_mb": lh.get("body_budget_mb"),
        "bsp_lru": lh.get("bsp_lru"),
        "bsp_lru_max": lh.get("bsp_lru_max"),
        "api_cache_keys": lh.get("api_cache_keys"),
        "bsp_sharded": lh.get("bsp_sharded"),
        "weapon_len": lh.get("weapon_len"),
        "weapon_max": lh.get("weapon_max"),
    }
    hist = load_history(path)
    hist.append(entry)
    hist = hist[-12:]
    path.write_text(json.dumps(hist, indent=2, default=str), encoding="utf-8")
    return hist


def build_dashboard(live: dict[str, Any], local: dict[str, Any] | None, history: list[dict[str, Any]]) -> dict[str, Any]:
    """Canvas-parity sections for the desktop UI."""
    lh = live.get("health_after") or live.get("health") or {}
    h0 = live.get("health") or {}
    steady = live.get("steady") or {}
    cold = live.get("cold") or {}
    warm = live.get("warm") or {}
    prior = history[-2] if len(history) >= 2 else None
    current = history[-1] if history else None

    pills: list[dict[str, Any]] = []
    if lh.get("body_budget_mb") is not None and lh.get("body_mb") is not None:
        pills.append({"text": "Live: deploy fields OK", "active": True})
    rss = lh.get("rss_mb")
    if prior and prior.get("rss_mb") is not None and rss is not None:
        try:
            pills.append(
                {
                    "text": f"RSS {prior['rss_mb']} → {rss} MB",
                    "active": float(rss) < float(prior["rss_mb"]),
                }
            )
        except (TypeError, ValueError):
            pass
    if lh.get("body_mb") is not None:
        bud = lh.get("body_budget_mb") if lh.get("body_budget_mb") is not None else 8
        pills.append({"text": f"Body cache ~{lh['body_mb']} MB (budget {bud})", "active": False})
    if prior and prior.get("rss_mb") is not None and rss is not None:
        try:
            if float(rss) >= 1100:
                pills.append({"text": f"RSS elevated ~{rss} MB", "active": False})
        except (TypeError, ValueError):
            pass
    if lh.get("band"):
        pills.append({"text": f"Band: {lh.get('band')}", "active": False})

    stats_primary = [
        {"key": "rss", "label": "Live RSS", "value": f"{rss} MB" if rss is not None else "—", "tone": _rss_tone(rss)},
        {
            "key": "body",
            "label": "Body cache",
            "value": f"{lh.get('body_mb')} MB" if lh.get("body_mb") is not None else "—",
            "tone": "bad" if (lh.get("body_mb") is not None and float(lh["body_mb"]) > 8) else "ok",
        },
        {
            "key": "unit",
            "label": "Unit warm p50",
            "value": f"{(steady.get('unit') or {}).get('p50')}ms" if (steady.get("unit") or {}).get("p50") is not None else "—",
            "tone": "ok",
        },
        {
            "key": "bsp",
            "label": "BSP warm p50",
            "value": f"{(steady.get('bsp') or {}).get('p50')}ms" if (steady.get("bsp") or {}).get("p50") is not None else "—",
            "tone": "ok",
        },
    ]
    prior_rss = prior.get("rss_mb") if prior else None
    prior_body = prior.get("body_mb") if prior else None
    stats_secondary = [
        {
            "key": "prior_rss",
            "label": "Prior Update RSS",
            "value": f"{prior_rss} MB" if prior_rss is not None else "—",
            "tone": _rss_tone(prior_rss),
        },
        {
            "key": "prior_body",
            "label": "Prior body cache",
            "value": f"{prior_body} MB" if prior_body is not None else "—",
            "tone": "ok",
        },
        {
            "key": "char",
            "label": "Char warm p50",
            "value": f"{(steady.get('char') or {}).get('p50')}ms" if (steady.get("char") or {}).get("p50") is not None else "—",
            "tone": "ok",
        },
        {
            "key": "health",
            "label": "/health after",
            "value": f"{lh.get('ms')}ms" if lh.get("ms") is not None else "—",
            "tone": "ok",
        },
    ]

    steady_rows = []
    for key, name in (("unit", "Unit warm"), ("char", "Char warm"), ("bsp", "BSP warm")):
        s = steady.get(key) or {}
        if not s:
            continue
        steady_rows.append(
            {
                "metric": name,
                "n": s.get("n"),
                "p50": s.get("p50"),
                "mean": s.get("mean"),
                "min": s.get("min"),
                "max": s.get("max"),
            }
        )

    critical_spec = [
        ("/", "/"),
        ("/api/characters?lang=EN", "/api/characters"),
        ("/api/units?lang=EN", "/api/units"),
        ("/api/banner_timeline?lang=EN&sv=23", "/api/banner_timeline"),
        ("/api/unit/1001000150?lang=EN", "/api/unit/… (detail)"),
        ("/api/character/1001000100?lang=EN", "/api/character/…"),
        ("/api/unit/1001000150/best_synergy_pilots?lang=EN", "/api/…/best_synergy_pilots"),
    ]
    critical_rows = []
    for path, label in critical_spec:
        c = cold.get(path) or {}
        w = warm.get(path) or {}
        critical_rows.append(
            {
                "path": label,
                "cold": _ms(c),
                "warm": _ms(w),
                "gzip": _gzip_kb(w if w.get("gzip") is not None else c),
                "local_warm": _ms(((local or {}).get("warm") or {}).get(path)) if local else None,
            }
        )

    matrix_spec = [
        ("/api/tag_matrix?lang=EN", "tag_matrix EN"),
        ("/api/debuff_matrix?lang=EN", "debuff_matrix EN"),
        ("/api/tag_matrix?lang=JA", "tag_matrix JA"),
        ("/api/debuff_matrix?lang=JA", "debuff_matrix JA"),
    ]
    matrix_rows = []
    for path, label in matrix_spec:
        c = cold.get(path) or {}
        w = warm.get(path) or {}
        vals = [v for v in (_ms(c), _ms(w)) if v is not None]
        if not vals:
            continue
        matrix_rows.append(
            {
                "path": label,
                "p50": _ms(w) if _ms(w) is not None else vals[0],
                "min": min(vals),
                "max": max(vals),
                "gzip": _gzip_kb(w if w.get("gzip") is not None else c),
            }
        )

    rss_rows: list[dict[str, str]] = []
    for i, e in enumerate(history[-6:]):
        note = ""
        if i == 0 and len(history) <= 6:
            note = "earliest kept snap"
        if e is current:
            note = "this Update"
        elif e is prior:
            note = "previous Update"
        try:
            if e.get("rss_mb") is not None and float(e["rss_mb"]) >= 1250:
                note = (note + " · pressure zone").strip(" ·")
        except (TypeError, ValueError):
            pass
        rss_rows.append(
            {
                "when": str(e.get("at") or "—"),
                "rss": f"{e.get('rss_mb')} MB" if e.get("rss_mb") is not None else "—",
                "body": (
                    f"{e.get('body_mb')} MB"
                    + (f" · detail {e.get('detail_mb')}" if e.get("detail_mb") is not None else "")
                    if e.get("body_mb") is not None
                    else "—"
                ),
                "note": note or "—",
            }
        )

    def _fp_cell(h: dict[str, Any] | None) -> dict[str, str]:
        if not h:
            return {}
        band = h.get("band") or "—"
        rpm = h.get("rpm")
        band_s = f"{band}" + (f" (rpm ~{rpm})" if rpm is not None else "")
        pair = "—"
        if h.get("pair_len") is not None:
            pair = f"{h.get('pair_len')} / {h.get('pair_max')}"
        weapon = "—"
        if h.get("weapon_len") is not None:
            weapon = f"{h.get('weapon_len')} / {h.get('weapon_max')}"
        body = "—"
        if h.get("body_mb") is not None:
            bud = h.get("body_budget_mb") if h.get("body_budget_mb") is not None else 8
            body = f"{h.get('body_mb')} / {bud}"
        bsp = "—"
        if h.get("bsp_lru") is not None:
            bsp = f"{h.get('bsp_lru')} / {h.get('bsp_lru_max')}"
        return {
            "band": band_s,
            "pair cache": pair,
            "weapon cache": weapon,
            "body cache MB": body,
            "detail body MB": str(h.get("detail_mb") if h.get("detail_mb") is not None else "—"),
            "BSP group LRU": bsp,
            "api_cache keys": str(h.get("api_cache_keys") if h.get("api_cache_keys") is not None else "—"),
            "bsp_sharded": "yes" if h.get("bsp_sharded") else ("no" if h.get("bsp_sharded") is False else "—"),
        }

    start_fp = _fp_cell(h0)
    end_fp = _fp_cell(lh)
    prior_fp = _fp_cell(prior)
    fields = [
        "band",
        "pair cache",
        "weapon cache",
        "body cache MB",
        "detail body MB",
        "BSP group LRU",
        "api_cache keys",
        "bsp_sharded",
    ]
    adaptive_rows = [
        {
            "field": f,
            "start": start_fp.get(f, "—"),
            "after": end_fp.get(f, "—"),
            "prior": prior_fp.get(f, "—") if prior else "—",
        }
        for f in fields
    ]

    gate_rows = []
    def _gate(check: str, value: str, ok: bool) -> None:
        gate_rows.append({"check": check, "value": value, "pass": ok})

    _gate(
        "http_json_body_cache_mb on /health",
        str(lh.get("body_mb")) if lh.get("body_mb") is not None else "missing",
        lh.get("body_mb") is not None,
    )
    _gate(
        "body_budget_mb present",
        str(lh.get("body_budget_mb")) if lh.get("body_budget_mb") is not None else "missing",
        lh.get("body_budget_mb") is not None,
    )
    _gate(
        "browse_ready / not booting",
        f"ready={lh.get('browse_ready')} boot={lh.get('booting')}",
        bool(lh.get("browse_ready")) and not lh.get("booting"),
    )
    _gate("BSP sharded", "yes" if lh.get("bsp_sharded") else "no", bool(lh.get("bsp_sharded")))
    body_ok = lh.get("body_mb") is not None and float(lh["body_mb"]) <= float(lh.get("body_budget_mb") or 8)
    _gate(
        "Body cache within budget after warm",
        f"{lh.get('body_mb')} / {lh.get('body_budget_mb') or 8}",
        body_ok if lh.get("body_mb") is not None else False,
    )
    unit_p50 = (steady.get("unit") or {}).get("p50")
    _gate(
        "Unit warm p50 under 600 ms",
        f"{unit_p50} ms" if unit_p50 is not None else "n/a",
        unit_p50 is not None and unit_p50 <= 600,
    )

    caveats = [
        "Homepage warm still includes TW→Railway RTT under high rpm.",
        "First BSP hit after recycle can cold-load a shard (~seconds); warm p50 is the steady path.",
        "Prior Update RSS row uses local history from earlier Updates on this machine.",
        "Press Update again anytime — nothing auto-refreshes.",
    ]

    return {
        "pills": pills,
        "stats_primary": stats_primary,
        "stats_secondary": stats_secondary,
        "steady_rows": steady_rows,
        "critical_rows": critical_rows,
        "matrix_rows": matrix_rows,
        "rss_rows": rss_rows,
        "adaptive_rows": adaptive_rows,
        "gate_rows": gate_rows,
        "caveats": caveats,
        "chart_caption": (
            "Source: this Update run · Y-axis = response time (ms). "
            "First BSP after recycle can cold-shard once; warm p50 is the settled path."
        ),
    }


def _rss_tone(rss: Any) -> str:
    if rss is None:
        return "muted"
    try:
        v = float(rss)
    except (TypeError, ValueError):
        return "muted"
    if v >= 1250:
        return "bad"
    if v >= 1100:
        return "warn"
    return "ok"


def run_audit(
    *,
    live_base: str = LIVE_BASE,
    local_base: str = LOCAL_BASE,
    include_local: bool = True,
    include_matrix: bool = True,
) -> dict[str, Any]:
    live = probe_target(live_base, label="live", include_matrix=include_matrix)
    local = None
    if include_local:
        # Quick reachability — skip full probe if down
        ping = fetch(local_base, "/health", timeout=3.0)
        if ping.get("ok"):
            local = probe_target(local_base, label="local", include_matrix=include_matrix)
        else:
            local = {
                "label": "local",
                "base": local_base,
                "reachable": False,
                "err": ping.get("err") or "not reachable",
                "health": parse_health(ping),
            }

    local_for_insights = local if local and local.get("steady") else local
    insights = build_insights(live, local_for_insights)
    at = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    history = append_history(live, at)
    report = {
        "at": at,
        "live": live,
        "local": local,
        "insights": insights,
        "verdict": build_verdict(live, insights),
        "chart_bars": chart_bars(live),
        "compare_rows": _compare_rows(live, local if local and local.get("steady") else None),
        "dashboard": build_dashboard(live, local_for_insights, history),
        "history": history,
    }
    return report


def _compare_rows(live: dict[str, Any], local: dict[str, Any] | None) -> list[dict[str, Any]]:
    keys = [
        ("/", "Homepage"),
        ("/api/characters?lang=EN", "Characters list"),
        ("/api/units?lang=EN", "Units list"),
        ("/api/banner_timeline?lang=EN&sv=23", "Banner timeline"),
        ("/api/unit/1001000150?lang=EN", "Unit detail"),
        ("/api/character/1001000100?lang=EN", "Character detail"),
        ("/api/unit/1001000150/best_synergy_pilots?lang=EN", "BSP Top 10"),
        ("/api/tag_matrix?lang=EN", "Tag matrix EN"),
        ("/api/debuff_matrix?lang=EN", "Debuff matrix EN"),
        ("/api/tag_matrix?lang=JA", "Tag matrix JA"),
        ("/api/debuff_matrix?lang=JA", "Debuff matrix JA"),
    ]
    rows = []
    lw = live.get("warm") or {}
    locw = (local or {}).get("warm") or {}
    for path, name in keys:
        lv = _ms(lw.get(path))
        lc = _ms(locw.get(path)) if local and local.get("warm") else None
        rows.append({"name": name, "path": path, "live_ms": lv, "local_ms": lc})
    # Steady
    for key, name in (("unit", "Unit steady p50"), ("char", "Char steady p50"), ("bsp", "BSP steady p50")):
        lv = ((live.get("steady") or {}).get(key) or {}).get("p50")
        lc = ((local or {}).get("steady") or {}).get(key) or {}
        lc = lc.get("p50") if isinstance(lc, dict) else None
        rows.append({"name": name, "path": key, "live_ms": lv, "local_ms": lc})
    return rows


def save_report(report: dict[str, Any], path: Path | None = None) -> Path:
    path = path or DEFAULT_STORE
    # Drop raw bodies if any slipped in
    path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    return path


def load_report(path: Path | None = None) -> dict[str, Any] | None:
    path = path or DEFAULT_STORE
    if not path.is_file():
        return None
    try:
        report = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(report, dict):
        return None
    # Rebuild canvas sections for older JSON that lacked dashboard
    if not report.get("dashboard") and report.get("live"):
        hist = report.get("history") or load_history()
        report["dashboard"] = build_dashboard(
            report["live"],
            report.get("local") if (report.get("local") or {}).get("steady") else report.get("local"),
            hist,
        )
        report["chart_bars"] = report.get("chart_bars") or chart_bars(report["live"])
        if not report.get("verdict"):
            tips = report.get("insights") or build_insights(report["live"], report.get("local"))
            report["verdict"] = build_verdict(report["live"], tips)
    return report
