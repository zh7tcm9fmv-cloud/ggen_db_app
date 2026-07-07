import asyncio
import json

from playwright.async_api import async_playwright

SHARE = (
    "https://ggendb.up.railway.app/cal?d=AXicrZIxT8MwEIX_yzff8OzUlNwMKwtj1SFyCqqoICWkHaL8dxQXgYSoqATLnc7P9-6zdSMHPBhNiff4amTACVGSqjoJI38eKKjCOG7xaBx3"
    "-MJot3iVjDzgMro2F7MDTj90m1eM_glfEWqFpKTA2uj3uVx_a_EoY8hdacsfudkU-aXDWUi6qmefuQohJkkxicnO4VZVXXD1I-7iItzlbDDj2jf0_NCU3nNv"
    "-CO76iSF6zL4H9ijFJa_fftlyGtj94hze4dxg48849RKp-2IOuV5R_ovITJN76pJjtw"
)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(SHARE, wait_until="networkidle", timeout=180_000)
        await page.wait_for_function(
            "() => typeof calculateDamage === 'function' && S.dc.atkSlots && S.dc.atkSlots[0]",
            timeout=180_000,
        )
        await page.wait_for_timeout(3000)
        out = await page.evaluate(
            """() => {
              const rows = [];
              for (let i = 0; i < 3; i++) {
                S.dc.atkSlotIndex = i;
                _dcWriteAttackerToDc(S.dc.atkSlots[i]);
                S.dc._wpnCritDmgUp = _dcCritDmgUpFromWeapon(S.dc.atkUnitData, S.dc.wpnIdx, S.dc.wpnLv) | 0;
                _dcRecalcPilotBonuses(true);
                const r = calculateDamage();
                const sl = S.dc.atkSlots[i];
                rows.push({
                  pilot: sl.atkCharData?.name,
                  critDmg: r?.critDmg,
                  normalDmg: r?.normalDmg,
                  di: S.dc.dmgIncrease,
                  charCP: sl.charCondPassive,
                  defU: S.dc.defNpc?.unit?.stats_raw?.Defense,
                  defC: S.dc.defNpc?.character?.stats_raw?.Defense,
                  skills: Object.keys(sl._activeSkills || {}).filter(k => sl._activeSkills[k]),
                });
              }
              return rows;
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
