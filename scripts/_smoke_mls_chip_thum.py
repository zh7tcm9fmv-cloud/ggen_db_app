#!/usr/bin/env python3
"""Assert MLS order/HP chips use Trait/thum — never Simulator/koma."""
from __future__ import annotations

import asyncio
import json
import sys


KOMA_SAMPLE = (
    "https://zh7tcm9fmv-cloud.github.io/ggen_db_images/images/"
    "Master%20League/Simulator/koma/g1250u01250/k1250u01250_standby_right.webp"
)
SINANJU_ID = "1125001250"


async def main() -> int:
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        await page.goto("http://127.0.0.1:5000/", wait_until="domcontentloaded", timeout=90000)
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

        unit = await page.evaluate(
            """async (uid) => {
              const r = await fetch('/api/unit/' + encodeURIComponent(uid) + '?lang=EN',
                { credentials: 'same-origin' });
              if (!r.ok) return { err: r.status };
              return await r.json();
            }""",
            SINANJU_ID,
        )
        if not unit or unit.get("err") or unit.get("error"):
            print("FAIL unit fetch", unit)
            await browser.close()
            return 1

        char = (unit.get("recommend_character") or {}) if isinstance(unit, dict) else {}
        slot = {
            "unitId": str(unit.get("id") or SINANJU_ID),
            "name": unit.get("name") or "Sinanju",
            "thum": unit.get("thum") or unit.get("portrait") or "",
            "rarity": unit.get("rarity") or "UR",
            "roleIcon": unit.get("role_icon") or unit.get("roleIcon") or "",
            "roleId": str(unit.get("role_id") or unit.get("roleId") or ""),
            "lb": 3,
            "charId": str(char.get("id") or "") or None,
            "charName": char.get("name") or "",
            "charThum": char.get("thum") or char.get("portrait") or "",
        }
        roster = {
            "eventId": "300021",
            "enemy": {"supporter": None, "slots": [dict(slot), None, None, None, None]},
            "ally": {"supporter": None, "slots": [slot, None, None, None, None]},
        }
        await page.goto("http://127.0.0.1:5000/mls", wait_until="domcontentloaded", timeout=90000)
        await page.evaluate(
            """(roster) => {
              localStorage.setItem('ggen_mls_roster_v3', JSON.stringify(roster));
            }""",
            roster,
        )
        await page.reload(wait_until="domcontentloaded", timeout=90000)
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

        await page.wait_for_selector("#mlsShell", timeout=90000)
        for _ in range(80):
            ready = await page.evaluate(
                """async () => {
                  try {
                    if (window.__GGEN_LAZY__ && window.__GGEN_LAZY__.ensureMlSim) {
                      await window.__GGEN_LAZY__.ensureMlSim();
                    }
                    if (window.GgenMlSim && window.GgenMlSim.onTabShown) {
                      await window.GgenMlSim.onTabShown();
                    }
                  } catch (e) {}
                  return !!(window.GgenMlSim && window.GgenMlSim.chipFaceUrl
                    && window.GgenMlSim.chipFaceMark === '__MLS_CHIP_THUM_V4__');
                }"""
            )
            if ready:
                break
            await asyncio.sleep(0.4)

        probe = await page.evaluate(
            """(koma) => {
              const fn = window.GgenMlSim && window.GgenMlSim.chipFaceUrl;
              if (!fn) return { err: 'no chipFaceUrl' };
              return {
                mark: window.GgenMlSim.chipFaceMark || '',
                a: fn({ thum: koma, portraitThum: '', komaKit: { komaId: 'g1250u01250' } }),
                b: fn({ thum: koma, portraitThum: koma, komaKit: null }),
                c: fn({ thum: koma, portraitThum: '', komaKit: null }),
              };
            }""",
            KOMA_SAMPLE,
        )
        print("helper", json.dumps(probe, indent=2))

        # Switch to battle so order + HP HUD paint with koma tokens on the map.
        await page.evaluate(
            """async () => {
              const btn = document.getElementById('mlsFight');
              if (btn) btn.click();
            }"""
        )
        await page.wait_for_timeout(4000)

        out_shot = (
            r"C:\Users\Mikew0911\.cursor\projects\c-Users-Mikew0911-Desktop-ggen-db-app"
            r"\assets\_mls_timeline_chip_smoke.png"
        )
        for sel in ("#mlsTimeline", "#mlsFormOrder"):
            loc = page.locator(sel)
            if await loc.count() and await loc.first.is_visible():
                await loc.first.screenshot(path=out_shot)
                print("screenshot", sel, out_shot)
                break
        else:
            print("screenshot skipped (order strip not visible)")

        dom = await page.evaluate(
            """() => {
              const pick = (sel) => [...document.querySelectorAll(sel)].map((img) => ({
                src: img.getAttribute('src') || '',
                face: img.getAttribute('data-mls-face') || '',
              }));
              return {
                formOrder: pick('#mlsFormOrder img'),
                timeline: pick('#mlsTimeline img'),
                boardHp: pick('img.mls-board-hp-thum'),
                tokens: pick('.mls-token-thum').slice(0, 3),
              };
            }"""
        )
        print("dom", json.dumps(dom, indent=2)[:5000])

        bad = []
        if (probe or {}).get("mark") != "__MLS_CHIP_THUM_V4__":
            bad.append("chipFaceMark missing: " + str((probe or {}).get("mark")))
        for key in ("a", "b", "c"):
            url = (probe or {}).get(key) or ""
            if "Simulator/koma" in url or "/koma/" in url:
                bad.append(f"helper {key} still koma: {url}")
            if url and "Trait/thum" not in url and "thum_" not in url:
                bad.append(f"helper {key} not Trait: {url}")

        chip_rows = list((dom or {}).get("formOrder") or []) + list(
            (dom or {}).get("timeline") or []
        ) + list((dom or {}).get("boardHp") or [])
        if not chip_rows:
            bad.append("no chip imgs painted (formOrder/timeline/boardHp empty)")
        for row in chip_rows:
            src = (row.get("src") if isinstance(row, dict) else row) or ""
            face = (row.get("face") if isinstance(row, dict) else "") or ""
            if "Simulator/koma" in src or "/koma/" in src:
                bad.append("chip DOM still koma: " + src)
            elif src and "Trait/thum" not in src and "thum_" not in src:
                bad.append("chip DOM not Trait: " + src)
            if src and face != "trait":
                bad.append("chip missing data-mls-face=trait: " + src)

        # Map tokens MAY be koma — just report.
        tok = (dom or {}).get("tokens") or []
        print("token sample (koma OK):", tok[:2])

        await browser.close()
        if bad:
            print("FAIL")
            for line in bad:
                print(" -", line)
            return 1
        print("OK chips Trait/thum")
        return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
