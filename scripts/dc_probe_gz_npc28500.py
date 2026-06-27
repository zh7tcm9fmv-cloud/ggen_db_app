"""Sweep Psycho stage NPCs for normalDmg near 28500."""
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

        out = await page.evaluate(
            """async () => {
              initDmgCalc();
              const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier=2').then(r=>r.json());
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r=>r.json());
              const sup = await fetch('/api/supporter/1080000550?lang=EN&level=100&lb_tier=3&for_unit_id=1850001650&for_char_id=1850001501').then(r=>r.json());
              const stage = await fetch('/api/stage/90520001?lang=EN').then(r=>r.json());
              const hits = [];
              for (const npc of stage.npc_details) {
                S.dc.atkUnitData=gz; S.dc.atkCharData=pilot; S.dc.lbTier=2;
                S.dc.wpnIdx=gz.weapons.findIndex(w=>w.is_ex);
                S.dc.wpnLv=gz.weapons[S.dc.wpnIdx].levels.length-1;
                S.dc.optionParts=[{details:'Increase Attack by 12%'}];
                sup._dcLevel=100; sup._dcLbTier=3; S.dc.supporters=[sup];
                S.dc.supportCounterAtk=false; S.dc.mpLevel='medium';
                S.dc.charCondPassive=false; S.dc.defNpc=npc; S.dc.finalWpnPow=0;
                const d=_dcDerivePilotDmgCritForSlotContext({atkCharData:pilot,charStatMode:'normal',charCondPassive:false},0);
                S.dc.dmgIncrease=d.dmgIncrease;
                const r=calculateDamage();
                if (r && r.normalDmg>=28400 && r.normalDmg<=28600) {
                  hits.push({npc:npc.npc_id,name:npc.name,nd:r.normalDmg,ua:r.unitAtk,ud:r.unitDef,wp:r.weaponPower,N:r.totalNormalMultPct});
                }
              }
              return hits;
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
