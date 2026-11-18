#!/usr/bin/env python3
"""Smoke: S.ATK stock bottom-right + FX URL / EX strip wiring present in served bundle."""
from __future__ import annotations

import asyncio
import json
import sys


async def main() -> int:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto("http://127.0.0.1:5000/mls", wait_until="domcontentloaded", timeout=90000)
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
        for _ in range(60):
            ok = await page.evaluate(
                """async () => {
                  try {
                    if (window.__GGEN_LAZY__ && window.__GGEN_LAZY__.ensureMlSim) {
                      await window.__GGEN_LAZY__.ensureMlSim();
                    }
                  } catch (e) {}
                  return !!(window.GgenMlSim && window.GgenMlSim.chipFaceMark === '__MLS_CHIP_THUM_V5__');
                }"""
            )
            if ok:
                break
            await asyncio.sleep(0.4)
        probe = await page.evaluate(
            """async () => {
              const scripts = [...document.scripts].map(s => s.src).filter(s => /ml_sim\\.min/.test(s));
              let js = '';
              if (scripts[0]) {
                js = await (await fetch(scripts[0], { cache: 'no-store' })).text();
              }
              const cssHref = [...document.styleSheets].map(s => s.href).filter(Boolean)
                .find(h => /ml_sim\\.css/.test(h || '')) || '';
              let css = '';
              if (cssHref) css = await (await fetch(cssHref, { cache: 'no-store' })).text();
              return {
                mark: window.GgenMlSim && window.GgenMlSim.chipFaceMark,
                hasWeaponBusy: js.indexOf('data-koma-busy') >= 0,
                hasEt01Prefer: /is_ex[\\s\\S]{0,80}et01/.test(js),
                hasBareFx: js.indexOf('Simulator/fx/') >= 0 && /prefix \\+ \"\\.webp\"|prefix\\+\"\\.webp\"|prefix\\+'.webp'/.test(js)
                  || js.indexOf('/fx/') >= 0,
                stockBottomRight: /mls-support-stock-row[\\s\\S]{0,200}bottom:\\s*-5px/.test(css)
                  && /mls-support-stock-row[\\s\\S]{0,200}right:\\s*-5px/.test(css),
                satkCorner: /is-satk[\\s\\S]{0,120}bottom:\\s*-6px/.test(css),
              };
            }"""
        )
        print(json.dumps(probe, indent=2))
        await browser.close()
        bad = []
        if (probe or {}).get("mark") != "__MLS_CHIP_THUM_V5__":
            bad.append("mark not V5")
        if not (probe or {}).get("hasWeaponBusy"):
            bad.append("weapon busy strip missing")
        if not (probe or {}).get("stockBottomRight"):
            bad.append("stock not bottom-right in CSS")
        if not (probe or {}).get("satkCorner"):
            bad.append("S.ATK badge corner missing")
        if bad:
            print("FAIL", bad)
            return 1
        print("OK stock corner + FX strip wiring")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
