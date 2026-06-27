"""Great Zeong with Beltorchika supporter - full breakdown."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5050"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/?tab=calculator", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)

        result = await page.evaluate(
            """async () => {
              initDmgCalc();
              const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier=2').then(r=>r.json());
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r=>r.json());
              const sup = await fetch('/api/supporter/1080000550?lang=EN&level=100&lb_tier=3&for_unit_id=1850001650&for_char_id=1850001501').then(r=>r.json());
              S.dc.atkUnitData = gz;
              S.dc.atkCharData = pilot;
              S.dc.atkUnit = '1850001650';
              S.dc.atkChar = '1850001501';
              S.dc.lbTier = 2;
              const exIdx = gz.weapons.findIndex(w=>w.is_ex);
              S.dc.wpnIdx = exIdx;
              S.dc.wpnLv = gz.weapons[exIdx].levels.length - 1;
              S.dc.optionParts = [{ details: 'Increase Attack by 12%' }];
              sup._dcLevel = 100; sup._dcLbTier = 3;
              S.dc.supporters = [sup];
              S.dc.mpLevel = 'medium';
              S.dc.charCondPassive = false;
              S.dc.unitCondPassive = false;
              const stage = await fetch('/api/stage/90520001?lang=EN').then(r=>r.json());
              S.dc.defNpc = stage.npc_details.find(n=>n.npc_id==='905200000102000003');
              S.dc.dtuPhysical = 0;
              // Do NOT call _dcSyncCharCondPassiveFromPair — user medium vigor, CP off
              _dcUpdateSupportCounterAtkUi();
              renderDcAtkUnit(); renderDcAtkChar();
              _dcRecalcPilotBonuses(true);
              const stats = gz.lb_data[2][_dcGetUnitStatKeyForCp(false)];
              const uPanel = _dcGetModifiedAttackerUnitStats(stats);
              const uDmg = _dcGetModifiedAttackerUnitStatsFromCtx(S.dc, stats, {forDamage:true});
              const r = calculateDamage();
              return {
                panelAtk: document.getElementById('dcAtkUnitAtkMain')?.textContent,
                panelBonus: document.getElementById('dcAtkUnitAtkInlineBonus')?.textContent,
                uPanelAtk: uPanel.unitAtk,
                uDmgAtk: uDmg.unitAtk,
                leaderPct: uPanel.leaderPct,
                supportCounterPct: uPanel.supportCounterPct,
                supportCounterOn: S.dc.supportCounterAtk,
                dmgIncrease: S.dc.dmgIncrease,
                wpnPow: r.weaponPower,
                combatWpnPow: r.combatWeaponPower,
                unitAtk: r.unitAtk,
                charAtk: r.charAtk,
                battleDamage: r.battleDamage,
                normalDmg: r.normalDmg,
                totalNormalMultPct: r.totalNormalMultPct,
                scaledNormal: r.scaledNormal,
                charCondPassive: S.dc.charCondPassive,
                offenseCorrection: r.offenseComponent,
              };
            }"""
        )
        print(json.dumps(result, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
