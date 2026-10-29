#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smoke /tm and /dm: board must have rows and no pageerror.

Oct 2026: mid-function IME helper inject aborted init before loadMatrix.
Usage: python scripts/smoke_matrix_boards.py [--base http://127.0.0.1:5000]
"""
from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:5000")
    ap.add_argument("--timeout-ms", type=int, default=120000)
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright required: pip install playwright && playwright install chromium", file=sys.stderr)
        return 2

    checks = [
        ("/tm", "tmBoard", ".tm-row"),
        ("/dm", "dmBoard", ".dm-row, .dm-rail-group, [data-tag-id]"),
    ]
    out = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        for path, board_id, sel in checks:
            errors.clear()
            page.goto(args.base.rstrip("/") + path, wait_until="networkidle", timeout=args.timeout_ms)
            page.wait_for_timeout(2000)
            info = page.evaluate(
                """([boardId, sel]) => {
                  const b = document.getElementById(boardId);
                  return {
                    hasBoard: !!b,
                    rows: b ? b.querySelectorAll(sel).length : -1,
                    htmlLen: b ? (b.innerHTML || '').length : 0,
                  };
                }""",
                [board_id, sel],
            )
            info["pageErrors"] = list(errors)
            out[path] = info
        browser.close()

    print(json.dumps(out, indent=2))
    ok = all(
        v.get("hasBoard") and int(v.get("rows") or 0) > 0 and not v.get("pageErrors")
        for v in out.values()
    )
    if not ok:
        print("FAIL: matrix board smoke", file=sys.stderr)
        return 1
    print("OK: /tm and /dm boards have rows")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
