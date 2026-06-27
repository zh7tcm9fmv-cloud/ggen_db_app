"""Find DC config that yields normalDmg ~28500 for Great Zeong vs Psycho."""
import asyncio
import json

from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5050"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)

        gz = await page.evaluate(
            """async () => (await fetch('/api/unit/1850001650?lang=EN&lb_tier=2')).json()"""
        )
        pilot = await page.evaluate(
            """async () => (await fetch('/api/character/1850001501?lang=EN&level=100&lb_tier=3')).json()"""
        )
        npc = await page.evaluate(
            """async () => {
              const stage = await (await fetch('/api/stage/90520001?lang=EN')).json();
              return stage.npc_details.find(n => n.npc_id === '905200000102000003');
            }"""
        )

        hits = await page.evaluate(
            """({ gz, pilot, npc }) => {
              const hits = [];
              for (let lb = 0; lb <= 3; lb++) {
                for (let wIdx = 0; wIdx < gz.weapons.length; wIdx++) {
                  const w = gz.weapons[wIdx];
                  if (w.weapon_type === '3') continue;
                  const maxLv = (w.levels && w.levels.length) ? w.levels.length - 1 : 0;
                  for (let wlv = 0; wlv <= maxLv; wlv++) {
                    for (const lp of [33, 45, 12, 0]) {
                      for (const op of [12, 0]) {
                        for (const dtu of [0, 35]) {
                          for (const cp of [false, true]) {
                            S.dc.atkUnitData = gz;
                            S.dc.atkCharData = pilot;
                            S.dc.defNpc = npc;
                            S.dc.lbTier = lb;
                            S.dc.wpnIdx = wIdx;
                            S.dc.wpnLv = wlv;
                            S.dc.optionParts = op ? [{ details: `Increase Attack by ${op}%` }] : [];
                            S.dc.supporters = lp ? [{
                              id: 'mock',
                              leader_skills: [{ desc: `Increase all stats by ${lp}%`, applies: true }],
                              hp_support: 0,
                              atk_support: 0,
                            }] : [];
                            S.dc.dtuPhysical = dtu;
                            S.dc.dmgIncrease = 0;
                            S.dc.critDmgUp = 0;
                            S.dc.mpLevel = cp ? 'max' : 'medium';
                            S.dc.unitCondPassive = cp;
                            S.dc.charCondPassive = false;
                            S.dc.terrain = 0;
                            S.dc.defending = false;
                            S.dc.finalWpnPow = 0;
                            S.dc.defNpcMapBonusesOn = false;
                            const r = calculateDamage();
                            if (r && r.normalDmg >= 28490 && r.normalDmg <= 28510) {
                              hits.push({
                                lb, wIdx, wName: w.name, wlv, lp, op, dtu, cp,
                                normalDmg: r.normalDmg,
                                battleDamage: r.battleDamage,
                                unitAtk: r.unitAtk,
                                totalNormalMultPct: r.totalNormalMultPct,
                                weaponPower: r.weaponPower,
                              });
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
              return hits;
            }""",
            {"gz": gz, "pilot": pilot, "npc": npc},
        )
        print(json.dumps(hits, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
