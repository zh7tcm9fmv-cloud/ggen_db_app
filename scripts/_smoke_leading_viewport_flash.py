#!/usr/bin/env python3
"""Capture viewport crops of .browse-toolbar-leading screen rect across Esc."""
from __future__ import annotations

import asyncio
import io
import json
import sys

from PIL import Image, ImageChops


async def main() -> int:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900}, device_scale_factor=1)
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
        await page.evaluate(
            """() => {
              window.scrollTo(0, 0);
              const el = document.querySelector('#panel-units .browse-toolbar-leading');
              if (el) el.scrollIntoView({block:'nearest'});
            }"""
        )
        await asyncio.sleep(0.25)

        def rect_js():
            return """() => {
              const el = document.querySelector('#panel-units .browse-toolbar-leading');
              if (!el) return null;
              const r = el.getBoundingClientRect();
              return {
                x: Math.round(r.x), y: Math.round(r.y),
                w: Math.round(r.width), h: Math.round(r.height),
                bodyTop: document.body.style.top || '',
                bodyPos: getComputedStyle(document.body).position,
                lock: document.documentElement.classList.contains('page-scroll-lock'),
                hold: document.documentElement.classList.contains('detail-close-scroll-hold'),
                scrollY: window.scrollY|0,
                active: !!document.getElementById('detailModal')?.classList.contains('active'),
              };
            }"""

        before_meta = await page.evaluate(rect_js())
        # Full page screenshot crop of leading screen box
        before_shot = await page.screenshot(type="png", full_page=False)
        before_img = Image.open(io.BytesIO(before_shot)).convert("RGB")

        def crop(im, meta):
            x, y, w, h = meta["x"], meta["y"], meta["w"], meta["h"]
            # pad a bit to catch neighbors
            x0 = max(0, x - 4)
            y0 = max(0, y - 4)
            x1 = min(im.size[0], x + w + 4)
            y1 = min(im.size[1], y + h + 4)
            return im.crop((x0, y0, x1, y1))

        before_crop = crop(before_img, before_meta)

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
        during_meta = await page.evaluate(rect_js())

        frames = []
        await page.keyboard.press("Escape")
        for i in range(16):
            meta = await page.evaluate(rect_js())
            shot = await page.screenshot(type="png", full_page=False)
            im = Image.open(io.BytesIO(shot)).convert("RGB")
            # Crop using BEFORE screen rect (what user eyes watch)
            c = crop(im, before_meta)
            if c.size != before_crop.size:
                c = c.resize(before_crop.size)
            diff = ImageChops.difference(before_crop, c)
            hist = diff.histogram()
            total = sum(i * hist[i] for i in range(256))
            total += sum(i * hist[256 + i] for i in range(256))
            total += sum(i * hist[512 + i] for i in range(256))
            n = before_crop.size[0] * before_crop.size[1] * 3
            mad = total / n if n else 0
            frames.append({"i": i, "mad": round(mad, 3), "meta": meta})
            await asyncio.sleep(0.012)

        await asyncio.sleep(0.3)
        meta = await page.evaluate(rect_js())
        shot = await page.screenshot(type="png", full_page=False)
        im = Image.open(io.BytesIO(shot)).convert("RGB")
        c = crop(im, before_meta)
        if c.size != before_crop.size:
            c = c.resize(before_crop.size)
        diff = ImageChops.difference(before_crop, c)
        hist = diff.histogram()
        total = sum(i * hist[i] for i in range(256))
        total += sum(i * hist[256 + i] for i in range(256))
        total += sum(i * hist[512 + i] for i in range(256))
        n = before_crop.size[0] * before_crop.size[1] * 3
        mad = total / n if n else 0
        frames.append({"i": "settled", "mad": round(mad, 3), "meta": meta})

        await browser.close()

    peak = max((f for f in frames if f["i"] != "settled"), key=lambda x: x["mad"], default=None)
    scroll_ys = sorted({(f.get("meta") or {}).get("scrollY") for f in frames})
    lead_ys = sorted({(f.get("meta") or {}).get("y") for f in frames})
    out = {
        "before_meta": before_meta,
        "during_meta": during_meta,
        "peak": peak,
        "unique_scrollY": scroll_ys,
        "unique_leading_y": lead_ys,
        "frames": frames,
    }
    print(json.dumps(out, indent=2))
    if len(scroll_ys) > 1 or (before_meta and before_meta.get("scrollY") not in scroll_ys):
        print(
            f"FAIL: scrollY jumped during exit (before={before_meta.get('scrollY')}, seen={scroll_ys})",
            file=sys.stderr,
        )
        return 1
    if len(lead_ys) > 1:
        print(f"FAIL: leading viewport y jumped (seen={lead_ys})", file=sys.stderr)
        return 1
    if peak and peak["mad"] > 5:
        print(f"FAIL: viewport crop flash MAD={peak['mad']}", file=sys.stderr)
        return 1
    print("OK: viewport leading crop stable (no scroll spike)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
