"""Verify removing split battleDamage +1 bump fixes ranged boost without breaking no-skill."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "https://ggendb.up.railway.app"
CASES = [
    (
        "no_skill",
        "AXicRY6xDoJAEET_5dVb7IEQ3FpbG0tjoQcakgMxBCgI_27uKGx282YzO7MyY054YCpcsdvKhOFcmauqKxTB70IWBc0QlhbLhSVgB6GOVAh-Sk-G2qeXM0bX1O3UIYz-tUeEJ5YJ49cn9H7Y85uEnwHjoKpVGU2RnFaqqkVqMg7Rvkk_hZDGXQhvjPMF4YSt9BhHLWLZVDftPHr_B8e2_QA9Jjvp",
        False,
        104972,
    ),
    (
        "ranged_boost",
        "AXicRY-xbsMwDET_5c0cTnZkuJzbtUvGIEMrp0EQJXVgOBkM_3sheehC4h3B43HhiQfjC5exxw8LM04IXSspRGGkTWiKoAbjdcFb45XxnTEUikaaq8k4pGr5xLmdhst8w5iu-IHQK3SKChyNKf1sV_M33hjTI1VMadwinSr-jjg7SX1XfAoF9ZIUa7hpLOur3eecazka-Yzz8Ynxji_ccd4US_76Qe1t2f0fBNb1D66hQDM",
        True,
        125127,
    ),
]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        rows = []
        for label, share, skill, want in CASES:
            await page.goto(f"{BASE}/cal?d={share}", wait_until="networkidle", timeout=120_000)
            await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)
            d = await page.evaluate(
                """(skillOn) => {
                  if (skillOn) {
                    const sk = (S.dc.atkCharData.skills || []).find(s => /Ranged Boost LV 5/i.test(s.name || ''));
                    if (sk) {
                      S.dc._activeSkills = S.dc._activeSkills || {};
                      S.dc._activeSkills[sk.id] = true;
                    }
                  }
                  const r = calculateDamage();
                  const C = Math.ceil;
                  const bd = r.baseDamage;
                  const tc = r.terrainCorrection;
                  const pct = r.totalNormalMultPct | 0;
                  const dm = r.defendMult;
                  const combined = C((bd + r.damageCorrection) * tc);
                  const split = C((bd + C(r.offenseComponent * bd) + C(r.defenseComponent * bd)) * tc);
                  const skip = pct > 0 && (combined * pct) % 100 === 0;
                  const useSplit = !skip && split === combined + 1;
                  const fin = (BD) => C((BD + C((pct * BD) / 100)) * dm);
                  return {
                    combined,
                    split,
                    skip,
                    useSplit,
                    currentBD: r.battleDamage,
                    current: r.normalDmg,
                    noSplitBump: fin(combined),
                    withSplitBump: fin(useSplit ? split : combined),
                  };
                }""",
                skill,
            )
            rows.append(
                {
                    "label": label,
                    "want": want,
                    **d,
                    "noSplitMatch": d["noSplitBump"] == want,
                    "currentMatch": d["current"] == want,
                }
            )
        print(json.dumps(rows, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
