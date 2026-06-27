"""Debug support counter after share load."""
import asyncio
import json
from playwright.async_api import async_playwright

SHARE = "AXicjZCxbsJAEET_ZeotZm0fcraGNg1llMLcmcTSQYyMobD87-jOCCtSilSrmd0ZPe2EG0wFDYyCPexjwgiD1o6kbhwh8KvhqBDcO1gluMc8QgdTJ_BjLumDz5U3GE5t6MYTBIM_NtmNB1ghGC4-Hw_Ncty0Wf70MFQkN3UKJaWsSdJlkqFP8VmekFpVr5VfDWXxhCx_QZb_hcx0TnANsIIC7_s_KWu-KFW5_AeznMcYPwXxC4bdOwRb2IQzDG90Bbkg5lmmgnWRnhva4wLxDdN5fgA8aGNN"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"http://127.0.0.1:5050/cal?d={SHARE}", wait_until="networkidle", timeout=120_000)
        await page.wait_for_timeout(3000)
        out = await page.evaluate(
            """() => {
              const cd = S.dc.atkCharData, ud = S.dc.atkUnitData;
              let line2 = null;
              if (cd && cd.abilities) {
                for (const ab of cd.abilities) {
                  for (const ln of (ab.details || [])) {
                    const tx = (ln.text || '');
                    if (tx.includes('Support Attack/Counter') && tx.includes('ATK')) line2 = { tx, cond: ln.condition_groups };
                  }
                }
              }
              const r = calculateDamage();
              return {
                parse: _dcParseMaxSupportCounterAtkPctFromChar(cd, ud),
                eff: _dcEffectiveSupportCounterAtkPct(),
                sac: S.dc.supportCounterAtk,
                scp: S.dc._supportCounterAtkPct,
                role: ud && ud.role_id,
                line2,
                ua: r && r.unitAtk,
                nd: r && r.normalDmg,
                bd: r && r.battleDamage,
              };
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
