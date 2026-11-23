#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.load_perf_lib import DEFAULT_STORE, run_audit  # noqa: E402


def main() -> None:
    print("running audit...")
    report = run_audit(include_local=True, include_matrix=True)
    DEFAULT_STORE.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("saved", DEFAULT_STORE)
    print("at", report.get("at"))
    print("verdict", json.dumps(report.get("verdict"), indent=2)[:2500])
    print("insights", json.dumps(report.get("insights"), indent=2)[:3500])
    live = report.get("live") or {}
    h = live.get("health") or {}
    print(
        "health_ms",
        h.get("ms"),
        "rss",
        h.get("rss_mb"),
        "band",
        h.get("band"),
        "rpm",
        h.get("rpm"),
    )
    warm = live.get("warm") or {}
    for p, v in sorted(warm.items(), key=lambda x: x[0]):
        if isinstance(v, dict):
            print(f"WARM {p}: {v.get('ms')}ms gzip={v.get('gzip')} ok={v.get('ok')}")


if __name__ == "__main__":
    main()
