"""Verify char CP auto: medium vigor off, super vigor on for 1850001501 + GZ."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5050"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/?tab=calculator", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof _dcShouldAutoCharCondPassive === 'function'", timeout=120_000)

        result = await page.evaluate(
            """async () => {
              initDmgCalc();
              const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier=2').then(r=>r.json());
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r=>r.json());
              S.dc.atkUnitData=gz; S.dc.atkCharData=pilot;
              S.dc.defNpc=(await fetch('/api/stage/90520001?lang=EN').then(r=>r.json())).npc_details.find(n=>n.npc_id==='905200000102000003');
              S.dc.mpLevel='medium';
              _dcSyncCharCondPassiveFromPair();
              const med = { charCondPassive: S.dc.charCondPassive, awaken: _dcFindStat(_dcGetCharStats(), 'Awaken') };
              const dMed = _dcDerivePilotDmgCritForSlotContext({ atkCharData: pilot, charStatMode: 'normal', charCondPassive: false }, 0);
              med.dmgInc = dMed.dmgIncrease;
              setDcMp('super');
              const sup = { charCondPassive: S.dc.charCondPassive, awaken: _dcFindStat(_dcGetCharStats(), 'Awaken') };
              const dSup = _dcDerivePilotDmgCritForSlotContext({ atkCharData: pilot, charStatMode: 'normal', charCondPassive: true }, 0);
              sup.dmgInc = dSup.dmgIncrease;
              return { med, sup, vReq: _dcCharCpVigorRequirement(pilot), pair: _dcUnitCharPairMatch(pilot, gz) };
            }"""
        )
        print(json.dumps(result, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
