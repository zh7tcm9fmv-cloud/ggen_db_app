"""Original user scenario: LB2, 12% OP, 33% leader only (no support counter ATK)."""
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
              sup._dcLevel=100; sup._dcLbTier=3;
              S.dc.atkUnitData=gz; S.dc.atkCharData=pilot; S.dc.lbTier=2;
              S.dc.wpnIdx=gz.weapons.findIndex(w=>w.is_ex);
              S.dc.wpnLv=gz.weapons[S.dc.wpnIdx].levels.length-1;
              S.dc.optionParts=[{details:'Increase Attack by 12%'}];
              S.dc.supporters=[];
              S.dc.supportCounterAtk=false;
              S.dc.mpLevel='medium'; S.dc.charCondPassive=false; S.dc.unitCondPassive=false;
              S.dc.defNpc=stage.npc_details.find(n=>n.npc_id==='905200000102000003');
              _dcRecalcPilotBonuses(true);
              const r=calculateDamage();
              return {
                panelAtk: document.getElementById('dcAtkUnitAtkMain')?.textContent,
                unitAtk: r.unitAtk, charAtk: r.charAtk, wp: r.weaponPower,
                bd: r.battleDamage, nd: r.normalDmg, N: r.totalNormalMultPct,
                dmgInc: S.dc.dmgIncrease, leader: _dcLeaderSkillPctAndFlags(S.dc.supporters).pct
              };
            }"""
        )
        print(json.dumps(result, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
