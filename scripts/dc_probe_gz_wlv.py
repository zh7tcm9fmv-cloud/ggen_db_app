"""GZ damage by EX weapon level."""
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
              const wIdx = gz.weapons.findIndex(w=>w.is_ex);
              const res = [];
              for (let wlv=0; wlv<5; wlv++) {
                S.dc.atkUnitData=gz; S.dc.atkCharData=pilot; S.dc.lbTier=2;
                S.dc.wpnIdx=wIdx; S.dc.wpnLv=wlv;
                S.dc.optionParts=[{details:'Increase Attack by 12%'}];
                const sup = await fetch('/api/supporter/1080000550?lang=EN&level=100&lb_tier=3&for_unit_id=1850001650&for_char_id=1850001501').then(r=>r.json());
                sup._dcLevel=100; sup._dcLbTier=3; S.dc.supporters=[sup];
                S.dc.supportCounterAtk=false; S.dc.mpLevel='medium'; S.dc.charCondPassive=false;
                S.dc.defNpc=npc; S.dc.dmgIncrease=0;
                const r=calculateDamage();
                res.push({wlv, wp:r.weaponPower, nd:r.normalDmg, ua:r.unitAtk, bd:r.battleDamage});
              }
              return res;
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
