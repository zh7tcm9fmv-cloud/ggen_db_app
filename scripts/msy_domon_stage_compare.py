import asyncio
import json

from playwright.async_api import async_playwright

SHARE_URL = (
    "https://ggendb.up.railway.app/cal?d=AXicpdExSwNBEMXx7_Kvp3h7m0V3am1tLEOKsBclGOT0cklx3HeX2xMFMUSwerDDvvnBjJzwYGxxGY_4emTACY0kxZyEUb4eFBQxznu8Mc4HfGW0ezwmowy1pGtLrTzh9EO3e8foX_A1ISskJQU2Rl-elqX9W6l5bPFGxlC6-r985naHa7JLrhhzdelX1-pPrpu5YHbZD-MF2hWScpLCbe37N-kqY2McnnHuHzDu8JFXnKy0XKzRkvPd-u9BwzR9ACgueGg"
)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(SHARE_URL, wait_until="networkidle", timeout=180_000)
        await page.wait_for_function(
            "() => S.dc.atkSlots && S.dc.atkSlots[0] && typeof calculateDamage === 'function'",
            timeout=180_000,
        )
        await page.wait_for_timeout(2500)

        out = await page.evaluate(
            """async () => {
              function evalSlots(label) {
                const rows = [];
                for (let i = 0; i < 3; i++) {
                  S.dc.atkSlotIndex = i;
                  _dcWriteAttackerToDc(S.dc.atkSlots[i]);
                  S.dc._wpnCritDmgUp = _dcCritDmgUpFromWeapon(S.dc.atkUnitData, S.dc.wpnIdx, S.dc.wpnLv) | 0;
                  _dcRecalcPilotBonuses(true);
                  const r = calculateDamage();
                  const sl = S.dc.atkSlots[i];
                  const ud = sl.atkUnitData, cd = sl.atkCharData;
                  const wpns = _dcNonMapWeapons(ud);
                  const wpn = wpns[sl.wpnIdx];
                  const lv = wpn && wpn.levels && wpn.levels[sl.wpnLv] ? wpn.levels[sl.wpnLv] : {};
                  rows.push({
                    slot: i,
                    pilot: cd?.name,
                    cid: sl.atkChar,
                    superCrit: r?.critDmg,
                    normal: r?.normalDmg,
                    battle: r?.battleDamage,
                    base: r?.baseDamage,
                    cwp: r?.combatWeaponPower,
                    wpnPow: r?.weaponPower,
                    defDebuffPct: r?.defDebuffPct,
                    unitAtk: r?.unitAtk,
                    charAtk: r?.charAtk,
                    unitDef: r?.unitDef,
                    charDef: r?.charDef,
                    di: S.dc.dmgIncrease,
                    cu: S.dc.critDmgUp,
                    totalCritMult: r?.totalCritMultPct,
                    totalNormalMult: r?.totalNormalMultPct,
                    charCP: sl.charCondPassive,
                    pairOk: _dcUnitCharPairMatch(cd, ud),
                    defU: S.dc.defNpc?.unit?.stats_raw?.Defense,
                    defC: S.dc.defNpc?.character?.stats_raw?.Defense,
                    defLabel: S.dc.defNpc?.unit?.name || S.dc.defNpc?.npc_id,
                    stage: document.getElementById('dcStageSelect')?.value || '',
                    skills: Object.keys(sl._activeSkills || {}).filter(k => sl._activeSkills[k]),
                  });
                }
                rows.sort((a, b) => (b.superCrit || 0) - (a.superCrit || 0));
                return { label, stage: document.getElementById('dcStageSelect')?.value, rows };
              }

              const stageDef = evalSlots('stage preset (90520002)');

              // swap to MSY custom defender only
              S.dc.defTargetMode = 'custom';
              S.dc.defNpc = _dcManualDefNpcFromDefC({
                un: 'Defender (MSY)', cn: 'Defender Pilot (MSY)',
                uHP: 0, uATK: 0, uDEF: 3819, uMOB: 0,
                cRNG: 0, cMEL: 0, cAWK: 0, cDEF: 193, cREA: 0,
              });
              const customDef = evalSlots('custom MSY 3819/193');

              return { stageDef, customDef };
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
