"""Regression: floor vs ceil unit ATK for GZ (28501) and 1163000150 (104972)."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "https://ggendb.up.railway.app"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/?tab=calculator", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)

        out = await page.evaluate(
            """async () => {
              function dmgWithForDamage(forDamage, setup) {
                setup();
                const lb = S.dc.atkUnitData.lb_data;
                const tier = Math.min(S.dc.lbTier, lb.length - 1);
                const statKey = _dcGetUnitStatKey();
                const td = lb[tier];
                const atkUnitStats = td[statKey] || td.stats_no_cond;
                const uMod = _dcGetModifiedAttackerUnitStatsFromCtx(S.dc, atkUnitStats, { forDamage });
                const pair = _dcPilotPairUnitAtkDefPct(uMod.unitAtk, uMod.unitDefVal);
                const orig = calculateDamage();
                // patch: temporarily override uMod path by storing flag
                return {
                  forDamage,
                  unitAtkRaw: uMod.unitAtk,
                  normalDmg: orig.normalDmg,
                };
              }

              // GZ loadout
              const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier=2').then(r => r.json());
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r => r.json());
              const sup = await fetch('/api/supporter/1080000550?lang=EN&level=100&lb_tier=3&for_unit_id=1850001650&for_char_id=1850001501').then(r => r.json());
              const npc = (await fetch('/api/stage/90520001?lang=EN').then(r => r.json())).npc_details.find(n => n.npc_id === '905200000102000003');

              function setupGz() {
                S.dc.atkUnitData = gz;
                S.dc.atkCharData = pilot;
                S.dc.lbTier = 2;
                S.dc.wpnIdx = gz.weapons.findIndex(w => w.is_ex);
                S.dc.wpnLv = gz.weapons[S.dc.wpnIdx].levels.length - 1;
                S.dc.optionParts = [{ details: 'Increase Attack by 12%' }];
                sup._dcLevel = 100; sup._dcLbTier = 3;
                S.dc.supporters = [sup];
                S.dc.mpLevel = 'medium';
                S.dc.defNpc = npc;
                S.dc.charCondPassive = false;
                S.dc.supportCounterAtk = true;
                _dcRecalcPilotBonuses(true);
              }

              setupGz();
              const gzCur = calculateDamage();
              const lb = gz.lb_data[2];
              const st = lb.stats_no_cond;
              const gzFloor = _dcGetModifiedAttackerUnitStatsFromCtx(S.dc, st, { forDamage: false });
              const gzCeil = _dcGetModifiedAttackerUnitStatsFromCtx(S.dc, st, { forDamage: true });

              return {
                gz: {
                  normalDmg: gzCur.normalDmg,
                  unitAtk: gzCur.unitAtk,
                  panelFloor: gzFloor.unitAtk,
                  dmgCeil: gzCeil.unitAtk,
                  want: 28501,
                },
              };
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
