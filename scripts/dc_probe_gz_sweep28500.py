"""Find DC configs yielding normalDmg 28499-28502."""
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

        hits = await page.evaluate(
            """async () => {
              initDmgCalc();
              const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier=2').then(r=>r.json());
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r=>r.json());
              const sup = await fetch('/api/supporter/1080000550?lang=EN&level=100&lb_tier=3&for_unit_id=1850001650&for_char_id=1850001501').then(r=>r.json());
              const stage = await fetch('/api/stage/90520001?lang=EN').then(r=>r.json());
              const npc = stage.npc_details.find(n=>n.npc_id==='905200000102000003');
              const hits = [];
              for (const lb of [0,1,2,3]) {
                const g = lb===2 ? gz : await fetch('/api/unit/1850001650?lang=EN&lb_tier='+lb).then(r=>r.json());
                for (const ccp of [0,1]) {
                  for (const mp of ['medium','super']) {
                    for (const supOn of [0,1]) {
                      for (const sac of [0,1]) {
                        for (const op of [0,1]) {
                          S.dc.atkUnitData=g; S.dc.atkCharData=pilot; S.dc.lbTier=lb;
                          S.dc.wpnIdx=g.weapons.findIndex(w=>w.is_ex);
                          S.dc.wpnLv=g.weapons[S.dc.wpnIdx].levels.length-1;
                          S.dc.optionParts=op?[{details:'Increase Attack by 12%'}]:[];
                          if (supOn) { sup._dcLevel=100; sup._dcLbTier=3; S.dc.supporters=[sup]; } else S.dc.supporters=[];
                          S.dc.mpLevel=mp; S.dc.charCondPassive=!!ccp; S.dc.unitCondPassive=false;
                          S.dc.defNpc=npc; S.dc.dtuPhysical=0; S.dc.supportCounterAtk=!!sac;
                          _dcRecalcPilotBonuses(true);
                          const r=calculateDamage();
                          if (r.normalDmg>=28499 && r.normalDmg<=28502) {
                            hits.push({lb,ccp,mp,supOn,sac,op,nd:r.normalDmg,bd:r.battleDamage,ua:r.unitAtk,ca:r.charAtk,wp:r.weaponPower,N:r.totalNormalMultPct,dmgInc:S.dc.dmgIncrease});
                          }
                        }
                      }
                    }
                  }
                }
              }
              return hits;
            }"""
        )
        print(json.dumps(hits, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
