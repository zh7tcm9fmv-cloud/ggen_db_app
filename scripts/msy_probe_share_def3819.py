import asyncio
import json

from playwright.async_api import async_playwright

SHARE = (
    "https://ggendb.up.railway.app/cal?d=AXicpdExSwNBEMXx7_Kvp3h7m0V3am1tLEOKsBclGOT0cklx3HeX2xMFMUSwerDDvvnBjJzwYGxxGY_4emTACY0kxZyEUb4eFBQxznu8Mc4HfGW0ezwmowy1pGtLrTzh9EO3e8foX_A1ISskJQU2Rl-elqX9W6l5bPFGxlC6-r985naHa7JLrhhzdelX1-pPrpu5YHbZD-MF2hWScpLCbe37N-kqY2McnnHuHzDu8JFXnKy0XKzRkvPd-u9BwzR9ACgueGg"
)
DEF_U, DEF_C = 3819, 193


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(SHARE, wait_until="networkidle", timeout=180_000)
        await page.wait_for_function(
            "() => S.dc.atkSlots && S.dc.atkSlots[0] && typeof calculateDamage === 'function'",
            timeout=180_000,
        )
        await page.wait_for_timeout(2000)

        # Override defender to MSY tier 1 custom stats (no OP/sup already in share)
        out = await page.evaluate(
            """({ defU, defC }) => {
              S.dc.defTargetMode = 'custom';
              S.dc.defNpc = _dcManualDefNpcFromDefC({
                un: 'Defender (MSY)', cn: 'Defender Pilot (MSY)',
                uHP: 0, uATK: 0, uDEF: defU, uMOB: 0,
                cRNG: 0, cMEL: 0, cAWK: 0, cDEF: defC, cREA: 0,
              });
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
                  cid: sl.atkChar,
                  superCrit: r?.critDmg,
                  normal: r?.normalDmg,
                  di: S.dc.dmgIncrease,
                  cu: S.dc.critDmgUp,
                  charCP: sl.charCondPassive,
                  pairOk: _dcUnitCharPairMatch(sl.atkCharData, sl.atkUnitData),
                  wpn: _dcNonMapWeapons(sl.atkUnitData)[sl.wpnIdx]?.name,
                  skills: Object.keys(sl._activeSkills || {}).filter(k => sl._activeSkills[k]),
                  td: sl._wpnTraitDistPow,
                  ae: sl.applyAdvantageEnemyTag,
                });
              }
              rows.sort((a, b) => b.superCrit - a.superCrit);
              return { unit: S.dc.atkUnitData?.name, rows };
            }""",
            {"defU": DEF_U, "defC": DEF_C},
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
