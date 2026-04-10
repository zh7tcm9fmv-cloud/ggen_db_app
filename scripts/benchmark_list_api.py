#!/usr/bin/env python3
"""Measure browse load contributors: HTML shell size, JS bundle size, /api/characters and /api/units latency.

Run from repo root: python scripts/benchmark_list_api.py

Uses Flask test_client (no network). Cold API numbers are after startup caches are built;
repeat the same URL to see in-process _api_cache hits (typically much faster).
"""
from __future__ import annotations

import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


def main():
    idx = os.path.join(ROOT, 'templates', 'index.html')
    js = os.path.join(ROOT, 'static', 'js', 'app.js')
    print('templates/index.html bytes:', os.path.getsize(idx) if os.path.isfile(idx) else 'missing')
    print('static/js/app.js bytes:', os.path.getsize(js) if os.path.isfile(js) else 'missing')

    import app as app_module  # noqa: WPS433 — loads full dataset

    client = app_module.app.test_client()
    paths = [
        ('/api/characters?lang=EN&page=1&per_page=50', 'GET /api/characters (cold in-process cache)'),
        ('/api/units?lang=EN&page=1&per_page=50', 'GET /api/units (cold in-process cache)'),
    ]
    for path, label in paths:
        t0 = time.perf_counter()
        r = client.get(path)
        ms = (time.perf_counter() - t0) * 1000
        print(f'{label}: HTTP {r.status_code}  {ms:.1f} ms')
    for path, label in paths:
        t0 = time.perf_counter()
        r = client.get(path)
        ms = (time.perf_counter() - t0) * 1000
        print(f'{label} [repeat / _api_cache]: HTTP {r.status_code}  {ms:.1f} ms')


if __name__ == '__main__':
    main()
