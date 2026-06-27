"""Targeted sweep: LB2 Great Zeong EX, 12% OP, 33% leader."""
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
            "async () => (await fetch('/api/unit/1850001650?lang=EN&lb_tier=2')).json()"
        )
        pilot = await page.evaluate(
            "async () => (await fetch('/api/character/1850001501?lang=EN&level=100&lb_tier=3')).json()"
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
              const exIdx = gz.weapons.findIndex(w => w.name.includes('Sieben Angriff EX'));
              for (let wlv = 0; wlv < 5; wlv++) {
                for (const dtu of [0, 35]) {
                  for (const cp of [false, true]) {
                    for (const mp of ['medium', 'max', 'high']) {
                      S.dc.atkUnitData = gz;
                      S.dc.atkCharData = pilot;
                      S.dc.defNpc = npc;
                      S.dc.lbTier = 2;
                      S.dc.wpnIdx = exIdx;
                      S.dc.wpnLv = wlv;
                      S.dc.optionParts = [{ details: 'Increase Attack by 12%' }];
                      S.dc.supporters = [{
                        id: 'm',
                        leader_skills: [{ desc: 'Increase all stats by 33%', applies: true }],
                        hp_support: 0,
                        atk_support: 0,
                      }];
                      S.dc.dtuPhysical = dtu;
                      S.dc.dmgIncrease = 0;
                      S.dc.critDmgUp = 0;
                      S.dc.mpLevel = mp;
                      S.dc.unitCondPassive = cp;
                      S.dc.charCondPassive = false;
                      S.dc.terrain = 0;
                      S.dc.defending = false;
                      S.dc.finalWpnPow = 0;
                      S.dc.defNpcMapBonusesOn = false;
                      const r = calculateDamage();
                      if (r.normalDmg >= 28495 && r.normalDmg <= 28505) {
                        hits.push({
                          wlv,
                          dtu,
                          cp,
                          mp,
                          normalDmg: r.normalDmg,
                          battleDamage: r.battleDamage,
                          unitAtk: r.unitAtk,
                          charAtk: r.charAtk,
                          totalNormalMultPct: r.totalNormalMultPct,
                          weaponPower: r.weaponPower,
                          scaledNormal: r.scaledNormal,
                          baseDamage: r.baseDamage,
                        });
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

        rows = await page.evaluate(
            """({ gz, pilot, npc }) => {
              const exIdx = gz.weapons.findIndex(w => w.name.includes('Sieben Angriff EX'));
              const rows = [];
              for (let wlv = 0; wlv < 5; wlv++) {
                for (const dtu of [0, 35]) {
                  S.dc.atkUnitData = gz;
                  S.dc.atkCharData = pilot;
                  S.dc.defNpc = npc;
                  S.dc.lbTier = 2;
                  S.dc.wpnIdx = exIdx;
                  S.dc.wpnLv = wlv;
                  S.dc.optionParts = [{ details: 'Increase Attack by 12%' }];
                  S.dc.supporters = [{
                    id: 'm',
                    leader_skills: [{ desc: 'Increase all stats by 33%', applies: true }],
                    hp_support: 0,
                    atk_support: 0,
                  }];
                  S.dc.dtuPhysical = dtu;
                  S.dc.dmgIncrease = 0;
                  S.dc.unitCondPassive = false;
                  S.dc.mpLevel = 'medium';
                  const r = calculateDamage();
                  rows.push({
                    wlv,
                    dtu,
                    nd: r.normalDmg,
                    bdm: r.battleDamage,
                    ua: r.unitAtk,
                    wp: r.weaponPower,
                    N: r.totalNormalMultPct,
                  });
                }
              }
              return rows;
            }""",
            {"gz": gz, "pilot": pilot, "npc": npc},
        )
        print("all rows:", json.dumps(rows, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
