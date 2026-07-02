"""Deep probe battleDamage rounding for 125127 case."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "https://ggendb.up.railway.app"
SHARE = (
    "AXicRY-xbsMwDET_5c0cTnZkuJzbtUvGIEMrp0EQJXVgOBkM_3sheehC4h3B43HhiQfjC5exxw8LM04IXSspRGGkTWiKoAbjdcFb45XxnTEUikaaq8k4pGr5xLmdhst8w5iu-IHQK3SKChyNKf1sV_M33hjTI1VMadwinSr-jjg7SX1XfAoF9ZIUa7hpLOur3eecazka-Yzz8Ynxji_ccd4US_76Qe1t2f0fBNb1D66hQDM"
)
SHARE_NO_SKILL = (
    "AXicRY6xDoJAEET_5dVb7IEQ3FpbG0tjoQcakgMxBCgI_27uKGx282YzO7MyY054YCpcsdvKhOFcmauqKxTB70IWBc0QlhbLhSVgB6GOVAh-Sk-G2qeXM0bX1O3UIYz-tUeEJ5YJ49cn9H7Y85uEnwHjoKpVGU2RnFaqqkVqMg7Rvkk_hZDGXQhvjPMF4YSt9BhHLWLZVDftPHr_B8e2_QA9Jjvp"
)


async def probe(page, share, skill_on):
    await page.goto(f"{BASE}/cal?d={share}", wait_until="networkidle", timeout=120_000)
    await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)
    await page.wait_for_timeout(1500)
    return await page.evaluate(
        """([skillOn]) => {
          if (skillOn) {
            const sk = (S.dc.atkCharData.skills || []).find(s => /Ranged Boost LV 5/i.test(s.name || ''));
            if (sk) {
              S.dc._activeSkills = S.dc._activeSkills || {};
              S.dc._activeSkills[sk.id] = true;
            }
          }
          const r = calculateDamage();
          const F = Math.floor, C = Math.ceil;
          const pct = r.totalNormalMultPct | 0;
          const bd = r.battleDamage;
          const raw = (r.baseDamage + r.damageCorrection) * r.terrainCorrection;
          const rawSplit = (r.baseDamage + C(r.offenseComponent * r.baseDamage) + C(r.defenseComponent * r.baseDamage)) * r.terrainCorrection;
          const bdFloor = F(raw);
          const bdFloorSplit = F(rawSplit);
          function final(b) {
            const snC = C(pct * b / 100);
            const snF = F(pct * b / 100);
            return {
              b,
              snC,
              snF,
              dmgCeilSn: C((b + snC) * r.defendMult),
              dmgFloorSn: C((b + snF) * r.defendMult),
            };
          }
          return {
            charAtk: r.charAtk,
            unitAtk: r.unitAtk,
            baseDamage: r.baseDamage,
            damageCorrection: r.damageCorrection,
            offenseCorrection: C(r.offenseComponent * r.baseDamage),
            defenseCorrection: C(r.defenseComponent * r.baseDamage),
            terrainCorrection: r.terrainCorrection,
            rawBdFloat: raw,
            rawBdSplitFloat: rawSplit,
            battleDamage: bd,
            bdFloor,
            bdFloorSplit,
            current: final(bd),
            ifBdMinus1: final(bd - 1),
            ifBdFloor: final(bdFloor),
            ifBdFloorSplit: final(bdFloorSplit),
          };
        }""",
        [skill_on],
    )


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        out = {
            "no_skill": await probe(page, SHARE_NO_SKILL, False),
            "ranged_boost": await probe(page, SHARE, True),
        }
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
