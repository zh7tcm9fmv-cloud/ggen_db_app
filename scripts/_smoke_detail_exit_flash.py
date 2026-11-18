#!/usr/bin/env python3
"""Smoke: detail Esc is instant — no blank wash, no fade linger, browse restored."""
from __future__ import annotations

import asyncio
import json
import sys


async def main() -> int:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto("http://127.0.0.1:5000/", wait_until="domcontentloaded", timeout=60000)
        for _ in range(90):
            h = await page.evaluate(
                """async () => {
                  try { return await (await fetch('/health')).json(); }
                  catch (e) { return null; }
                }"""
            )
            if h and h.get("ok") and not h.get("booting"):
                break
            await asyncio.sleep(1)
        else:
            print("FAIL: /health never ready", file=sys.stderr)
            return 1

        await page.wait_for_selector(
            "#panel-characters .list-toolbar-left--browse", timeout=60000
        )
        await page.wait_for_function(
            """() => !!document.querySelector('[data-detail-type="character"][data-detail-id]')""",
            timeout=60000,
        )

        opened = await page.evaluate(
            """() => {
              const el = document.querySelector('[data-detail-type="character"][data-detail-id]');
              const id = el && el.getAttribute('data-detail-id');
              if (!id) return null;
              const y = window.scrollY || 0;
              window.__exitY = y;
              openDetail('character', id);
              return { id, y };
            }"""
        )
        if not opened:
            print("FAIL: no character card", file=sys.stderr)
            return 1

        await page.wait_for_selector("#detailModal.active", timeout=30000)
        await page.wait_for_function(
            """() => {
              const inn = document.getElementById('detailInner');
              return !!(inn && !inn.querySelector('.spinner') && inn.children.length);
            }""",
            timeout=30000,
        )

        t0 = await page.evaluate("() => performance.now()")
        await page.keyboard.press("Escape")
        # Instant: modal should be gone within a couple frames
        await page.wait_for_function(
            """() => !document.getElementById('detailModal')?.classList.contains('active')""",
            timeout=2000,
        )
        t1 = await page.evaluate("() => performance.now()")
        await asyncio.sleep(0.15)
        data = await page.evaluate(
            """() => {
              const m = document.getElementById('detailModal');
              const cs = m ? getComputedStyle(m) : null;
              return {
                active: !!(m && m.classList.contains('active')),
                wash: !!(m && m.classList.contains('is-detail-wash')),
                opacity: cs ? cs.opacity : null,
                bg: cs ? cs.backgroundColor : null,
                scrollY: window.scrollY || 0,
                coverHold: document.documentElement.classList.contains('browse-panel-cover-hold'),
                toolbar: !!document.querySelector('#panel-characters .list-toolbar-left--browse'),
              };
            }"""
        )
        await browser.close()

    elapsed = t1 - t0
    out = {
        "opened": opened,
        "close_ms": round(elapsed, 1),
        "after": data,
    }
    print(json.dumps(out, indent=2))

    if data["active"]:
        print("FAIL: modal still active", file=sys.stderr)
        return 1
    if data["wash"]:
        print("FAIL: opaque wash class present", file=sys.stderr)
        return 1
    # Playwright Esc + wait overhead is often 200–400ms; fail only if clearly animated.
    if elapsed > 800:
        print("FAIL: exit too slow (motion still lingering?)", file=sys.stderr)
        return 1
    if not data["toolbar"]:
        print("FAIL: browse toolbar missing after exit", file=sys.stderr)
        return 1
    print("OK: instant exit, no blank wash")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
