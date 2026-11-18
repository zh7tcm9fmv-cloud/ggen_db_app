#!/usr/bin/env python3
"""Measure #panel-units .browse-toolbar-leading size through detail Esc."""
from __future__ import annotations

import asyncio
import json
import sys


async def main() -> int:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto("http://127.0.0.1:5000/u", wait_until="domcontentloaded", timeout=60000)
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
        await page.wait_for_selector("#panel-units .browse-toolbar-leading", timeout=60000)
        await page.wait_for_function(
            """() => !!document.querySelector('[data-detail-type="unit"][data-detail-id]')""",
            timeout=60000,
        )

        async def metrics():
            return await page.evaluate(
                """() => {
                  const el = document.querySelector('#panel-units .browse-toolbar-leading');
                  if (!el) return null;
                  const r = el.getBoundingClientRect();
                  const wrap = el.querySelector('.filter-input-wrap--organic');
                  const wr = wrap ? wrap.getBoundingClientRect() : null;
                  return {
                    w: Math.round(r.width),
                    h: Math.round(r.height),
                    wrapW: wr ? Math.round(wr.width) : null,
                    bodyPos: getComputedStyle(document.body).position,
                    lock: document.documentElement.classList.contains('page-scroll-lock'),
                    hold: document.documentElement.classList.contains('detail-close-scroll-hold'),
                    frozen: el.dataset.ggenLeadingFrozen || '',
                  };
                }"""
            )

        before = await metrics()
        await page.evaluate(
            """() => {
              const el = document.querySelector('[data-detail-type="unit"][data-detail-id]');
              openDetail('unit', el.getAttribute('data-detail-id'));
            }"""
        )
        await page.wait_for_selector("#detailModal.active", timeout=30000)
        await page.wait_for_function(
            """() => {
              const i = document.getElementById('detailInner');
              return !!(i && !i.querySelector('.spinner') && i.children.length);
            }""",
            timeout=30000,
        )
        during = await metrics()
        await page.evaluate(
            """() => {
              window.__leadTrace = [];
              const el = document.querySelector('#panel-units .browse-toolbar-leading');
              window.__leadPoll = setInterval(() => {
                if (!el) return;
                const r = el.getBoundingClientRect();
                const wrap = el.querySelector('.filter-input-wrap--organic');
                window.__leadTrace.push({
                  t: performance.now(),
                  w: Math.round(r.width),
                  wrapW: wrap ? Math.round(wrap.getBoundingClientRect().width) : null,
                  active: document.getElementById('detailModal')?.classList.contains('active'),
                  lock: document.documentElement.classList.contains('page-scroll-lock'),
                  hold: document.documentElement.classList.contains('detail-close-scroll-hold'),
                  bodyPos: getComputedStyle(document.body).position,
                });
              }, 8);
            }"""
        )
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.7)
        after = await metrics()
        lead = await page.evaluate(
            """() => {
              clearInterval(window.__leadPoll);
              return (window.__leadTrace || []).slice(0, 50);
            }"""
        )
        await browser.close()

    widths = [r["w"] for r in lead if r.get("w") is not None]
    wrap_ws = [r["wrapW"] for r in lead if r.get("wrapW") is not None]
    changed = len(set(widths)) > 1 or len(set(wrap_ws)) > 1
    out = {
        "before": before,
        "during": during,
        "after": after,
        "unique_leading_w": sorted(set(widths)),
        "unique_wrap_w": sorted(set(wrap_ws)),
        "width_changed_during_exit": changed,
        "samples": lead[:25],
    }
    print(json.dumps(out, indent=2))
    if changed:
        print("FAIL: browse-toolbar-leading width changed during exit", file=sys.stderr)
        return 1
    print("OK: leading width stable through exit")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
