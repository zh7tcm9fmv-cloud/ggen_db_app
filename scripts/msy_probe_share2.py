import asyncio
import json

from playwright.async_api import async_playwright

SHARE_RAW = (
    "AXicpdExSwNBEMXx7_Kvp3h7m0V3am1tLEOKsBclGOT0cklx3HeX2xMFMUSwerDDvvnBjJzwYGxxGY_4emTACY0kxZyEUb4eFBQxznu8Mc4HfGW0ezwmowy1pGtLrTzh9EO3e8foX_A1ISskJQU2Rl-elqX9W6l5bPFGxlC6-r985naHa7JLrhhzdelX1-pPrpu5YHbZD-MF2hWScpLCbe37N-kqY2McnnHuHzDu8JFXnKy0XKzRkvPd-u9BwzR9ACgueGg"
)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("https://ggendb.up.railway.app/?tab=calculator", wait_until="networkidle", timeout=180_000)
        await page.wait_for_function("() => typeof _dcApplyPackedShareState === 'function'", timeout=180_000)
        await page.evaluate("() => initDmgCalc()")

        out = await page.evaluate(
            """async (raw) => {
              const u8 = _dcB64UrlToU8(raw);
              const ds = new DecompressionStream('deflate');
              const stream = new Blob([u8.slice(1)]).stream().pipeThrough(ds);
              const obj = JSON.parse(new TextDecoder().decode(await new Response(stream).arrayBuffer()));
              await _dcApplyPackedShareState(obj);
              // stage defender from share
              const rowsA = [];
              for (let i = 0; i < 3; i++) {
                S.dc.atkSlotIndex = i;
                _dcWriteAttackerToDc(S.dc.atkSlots[i]);
                S.dc._wpnCritDmgUp = _dcCritDmgUpFromWeapon(S.dc.atkUnitData, S.dc.wpnIdx, S.dc.wpnLv) | 0;
                _dcRecalcPilotBonuses(true);
                const r = calculateDamage();
                const sl = S.dc.atkSlots[i];
                rowsA.push({ pilot: sl.atkCharData?.name, superCrit: r?.critDmg, defU: S.dc.defNpc?.unit?.stats_raw?.Defense, defC: S.dc.defNpc?.character?.stats_raw?.Defense, di: S.dc.dmgIncrease, pair: _dcUnitCharPairMatch(sl.atkCharData, sl.atkUnitData) });
              }
              // override to 3819/193
              S.dc.defTargetMode = 'custom';
              S.dc.defNpc = _dcManualDefNpcFromDefC({ un: 'D', cn: 'D', uHP: 0, uATK: 0, uDEF: 3819, uMOB: 0, cRNG: 0, cMEL: 0, cAWK: 0, cDEF: 193, cREA: 0 });
              const rowsB = [];
              for (let i = 0; i < 3; i++) {
                S.dc.atkSlotIndex = i;
                _dcWriteAttackerToDc(S.dc.atkSlots[i]);
                S.dc._wpnCritDmgUp = _dcCritDmgUpFromWeapon(S.dc.atkUnitData, S.dc.wpnIdx, S.dc.wpnLv) | 0;
                _dcRecalcPilotBonuses(true);
                const r = calculateDamage();
                const sl = S.dc.atkSlots[i];
                rowsB.push({ pilot: sl.atkCharData?.name, superCrit: r?.critDmg, di: S.dc.dmgIncrease, pair: _dcUnitCharPairMatch(sl.atkCharData, sl.atkUnitData) });
              }
              rowsA.sort((a,b)=>b.superCrit-a.superCrit);
              rowsB.sort((a,b)=>b.superCrit-a.superCrit);
              return { stageDef: rowsA, custom3819: rowsB };
            }""",
            SHARE_RAW,
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
