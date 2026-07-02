"""Regression: normal damage with floor vs ceil on scaledNormal pct term."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "https://ggendb.up.railway.app"
CASES = [
    {
        "label": "1163000150 no skill",
        "share": "AXicRY6xDoJAEET_5dVb7IEQ3FpbG0tjoQcakgMxBCgI_27uKGx282YzO7MyY054YCpcsdvKhOFcmauqKxTB70IWBc0QlhbLhSVgB6GOVAh-Sk-G2qeXM0bX1O3UIYz-tUeEJ5YJ49cn9H7Y85uEnwHjoKpVGU2RnFaqqkVqMg7Rvkk_hZDGXQhvjPMF4YSt9BhHLWLZVDftPHr_B8e2_QA9Jjvp",
        "want": 104972,
        "skill": None,
    },
    {
        "label": "1163000150 ranged boost",
        "share": "AXicRY-xbsMwDET_5c0cTnZkuJzbtUvGIEMrp0EQJXVgOBkM_3sheehC4h3B43HhiQfjC5exxw8LM04IXSspRGGkTWiKoAbjdcFb45XxnTEUikaaq8k4pGr5xLmdhst8w5iu-IHQK3SKChyNKf1sV_M33hjTI1VMadwinSr-jjg7SX1XfAoF9ZIUa7hpLOur3eecazka-Yzz8Ynxji_ccd4US_76Qe1t2f0fBNb1D66hQDM",
        "want": 125127,
        "skill": "Ranged Boost LV 5",
    },
    {
        "label": "qubeley",
        "share": "eyJ2IjoxLCJhIjowLCJTIjpbeyJ1IjoiMTA5NTAwMjU1MCIsImMiOiIxMDk1MDAxODAxIiwid2kiOjMsIndsIjo0LCJkaSI6MzUsImV4YSI6MjAsInRkIjoyMCwib3AiOiI0MDAwMjUiLCJzcCI6IjEwODAwMDA1NTAiLCJzcGIiOjJ9LG51bGwsbnVsbF0sIkQiOnsibiI6IjkwNTIwMDAwMDEwMjAwMDAwMyIsInMiOiI5MDUyMDAwMSIsImRlZnAiOjQwfX0",
        "want": 244944,
        "skill": None,
    },
]


async def probe(page, case):
    await page.goto(f"{BASE}/cal?d={case['share']}", wait_until="networkidle", timeout=120_000)
    await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)
    await page.wait_for_timeout(1500)
    return await page.evaluate(
        """([skillName]) => {
          if (skillName) {
            const cd = S.dc.atkCharData;
            const sk = (cd.skills || []).find(s => new RegExp(skillName, 'i').test(s.name || ''));
            if (sk) {
              S.dc._activeSkills = S.dc._activeSkills || {};
              S.dc._activeSkills[sk.id] = true;
            }
          }
          const r = calculateDamage();
          const F = Math.floor, C = Math.ceil;
          const bd = r.battleDamage, pct = r.totalNormalMultPct | 0, dm = r.defendMult;
          const snCeil = C(pct * bd / 100);
          const snFloor = F(pct * bd / 100);
          return {
            normalDmg: r.normalDmg,
            ceilPath: C((bd + snCeil) * dm),
            floorSnPath: C((bd + snFloor) * dm),
            floorAllPath: F((bd + pct * bd / 100) * dm),
            battleDamage: bd,
            scaledNormal: r.scaledNormal,
            pct,
          };
        }""",
        [case.get("skill")],
    )


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        rows = []
        for case in CASES:
            d = await probe(page, case)
            rows.append(
                {
                    "label": case["label"],
                    "want": case["want"],
                    **d,
                    "floorSnMatch": d["floorSnPath"] == case["want"],
                    "ceilMatch": d["ceilPath"] == case["want"],
                    "currentMatch": d["normalDmg"] == case["want"],
                }
            )
        print(json.dumps(rows, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
