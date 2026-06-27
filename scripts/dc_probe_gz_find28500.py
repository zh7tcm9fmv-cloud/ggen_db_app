"""Find live DC configs yielding normalDmg 28499-28502."""
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
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r=>r.json());
              const stage = await fetch('/api/stage/90520001?lang=EN').then(r=>r.json());
              const npc = stage.npc_details.find(n=>n.npc_id==='905200000102000003');
              const hits = [];
              for (const lb of [0,1,2,3]) {
                const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier='+lb).then(r=>r.json());
                const wIdx = gz.weapons.findIndex(w=>w.is_ex);
                for (const wlv of [0, gz.weapons[wIdx].levels.length-1]) {
                  for (const op of [0,12]) {
                    for (const supOn of [0,1]) {
                      for (const sac of [0,1]) {
                        for (const ccp of [0,1]) {
                          for (const mp of ['medium','super']) {
                            S.dc.atkUnitData=gz; S.dc.atkCharData=pilot; S.dc.lbTier=lb;
                            S.dc.wpnIdx=wIdx; S.dc.wpnLv=wlv;
                            S.dc.optionParts=op?[{details:'Increase Attack by '+op+'%'}]:[];
                            S.dc.supporters=[];
                            if (supOn) {
                              const sup = await fetch('/api/supporter/1080000550?lang=EN&level=100&lb_tier=3&for_unit_id=1850001650&for_char_id=1850001501').then(r=>r.json());
                              sup._dcLevel=100; sup._dcLbTier=3; S.dc.supporters=[sup];
                            }
                            S.dc.supportCounterAtk=!!sac;
                            S.dc.mpLevel=mp; S.dc.charCondPassive=!!ccp;
                            S.dc.defNpc=npc; S.dc.finalWpnPow=0;
                            setDcMp(mp);
                            S.dc.charCondPassive=!!ccp;
                            const d=_dcDerivePilotDmgCritForSlotContext({atkCharData:pilot,charStatMode:'normal',charCondPassive:!!ccp},0);
                            S.dc.dmgIncrease=d.dmgIncrease;
                            const r=calculateDamage();
                            if (r && r.normalDmg>=28499 && r.normalDmg<=28502) {
                              hits.push({lb,wlv,op,supOn,sac,ccp,mp,nd:r.normalDmg,bd:r.battleDamage,ua:r.unitAtk,ca:r.charAtk,wp:r.weaponPower,N:r.totalNormalMultPct});
                            }
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
