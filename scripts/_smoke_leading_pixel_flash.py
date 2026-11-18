#!/usr/bin/env python3
"""Pixel-diff #panel-units .browse-toolbar-leading across detail Esc."""
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
        # ensure leading in view
        await page.evaluate(
            """() => {
              const el = document.querySelector('#panel-units .browse-toolbar-leading');
              if (el) el.scrollIntoView({block:'start'});
              window.scrollTo(0, 0);
            }"""
        )
        await asyncio.sleep(0.2)
        lead = page.locator("#panel-units .browse-toolbar-leading")
        before_bytes = await lead.screenshot(type="png")
        before = Image.open(io.BytesIO(before_bytes)).convert("RGB")

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

        frames = []
        await page.evaluate(
            """() => {
              window.__shotReq = 0;
              window.__shotReady = 0;
            }"""
        )

        async def grab(tag):
            # hide overlay briefly? No — capture after Esc as overlay drops.
            b = await lead.screenshot(type="png")
            im = Image.open(io.BytesIO(b)).convert("RGB")
            if im.size != before.size:
                im = im.resize(before.size)
            diff = ImageChops.difference(before, im)
            # mean abs diff
            hist = diff.histogram()
            # RGB hist length 768
            total = sum(i * hist[i] for i in range(256))
            total += sum(i * hist[256 + i] for i in range(256))
            total += sum(i * hist[512 + i] for i in range(256))
            n = before.size[0] * before.size[1] * 3
            mad = total / n if n else 0
            frames.append({"tag": tag, "mad": round(mad, 3), "size": list(im.size)})
            return mad

        await page.keyboard.press("Escape")
        # rapid captures while unlock settles
        for i in range(12):
            await grab(f"t{i}")
            await asyncio.sleep(0.016)

        await asyncio.sleep(0.25)
        await grab("settled")
        await browser.close()

    peak = max(frames, key=lambda x: x["mad"]) if frames else None
    out = {"before_size": list(before.size), "frames": frames, "peak": peak}
    print(json.dumps(out, indent=2))
    # Any visible flash should show elevated MAD vs settled
    settled = next((f for f in frames if f["tag"] == "settled"), None)
    early = [f for f in frames if f["tag"].startswith("t")]
    early_peak = max((f["mad"] for f in early), default=0)
    if early_peak > 2.0 and settled and early_peak > settled["mad"] + 1.0:
        print(
            f"FAIL: pixel flash on leading (early peak MAD {early_peak} vs settled {settled['mad']})",
            file=sys.stderr,
        )
        return 1
    print("OK: no significant pixel flash on leading")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
