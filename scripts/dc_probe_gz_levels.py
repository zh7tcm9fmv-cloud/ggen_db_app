"""GZ damage at various buff levels."""
import asyncio
import json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto("http://127.0.0.1:5050/?tab=calculator", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)
        out = await page.evaluate(
            """async () => {
              initDmgCalc();
              const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier=2').then(r=>r.json());
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r=>r.json());
              const npc = (await fetch('/api/stage/90520001?lang=EN').then(r=>r.json())).npc_details.find(n=>n.npc_id==='905200000102000003');
              const configs = [
                {name:'bare', op:0, sup:0, sac:0, ccp:0, di:0},
                {name:'op12', op:12, sup:0, sac:0, ccp:0, di:0},
                {name:'op12+sup', op:12, sup:1, sac:0, ccp:0, di:0},
                {name:'op12+sup+15', op:12, sup:1, sac:0, ccp:0, di:15},
                {name:'full+sac+15', op:12, sup:1, sac:1, ccp:0, di:15},
              ];
              const res = [];
              for (const cfg of configs) {
                S.dc.atkUnitData=gz; S.dc.atkCharData=pilot; S.dc.lbTier=2;
                S.dc.wpnIdx=gz.weapons.findIndex(w=>w.is_ex);
                S.dc.wpnLv=gz.weapons[S.dc.wpnIdx].levels.length-1;
                S.dc.optionParts=cfg.op?[{details:'Increase Attack by '+cfg.op+'%'}]:[];
                S.dc.supporters=[];
                if (cfg.sup) {
                  const sup = await fetch('/api/supporter/1080000550?lang=EN&level=100&lb_tier=3&for_unit_id=1850001650&for_char_id=1850001501').then(r=>r.json());
                  sup._dcLevel=100; sup._dcLbTier=3; S.dc.supporters=[sup];
                }
                S.dc.supportCounterAtk=!!cfg.sac;
                S.dc.mpLevel='medium'; S.dc.charCondPassive=!!cfg.ccp;
                S.dc.defNpc=npc; S.dc.dmgIncrease=cfg.di;
                const r=calculateDamage();
                res.push({...cfg, nd:r.normalDmg, ua:r.unitAtk, wp:r.weaponPower, bd:r.battleDamage, N:r.totalNormalMultPct});
              }
              return res;
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
