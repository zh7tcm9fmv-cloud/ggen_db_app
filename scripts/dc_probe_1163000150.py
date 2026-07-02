"""Probe damage calc for unit 1163000150 — in-game 104972 vs sim 104987 (+15)."""
import asyncio
import json
from playwright.async_api import async_playwright

SHARE = (
    "AXicRY6xDoJAEET_5dVb7IEQ3FpbG0tjoQcakgMxBCgI_27uKGx282YzO7MyY054YCpcsdvKhOFcmauqKxTB70IWBc0QlhbLhSVgB6GOVAh-Sk-G2qeXM0bX1O3UIYz-tUeEJ5YJ49cn9H7Y85uEnwHjoKpVGU2RnFaqqkVqMg7Rvkk_hZDGXQhvjPMF4YSt9BhHLWLZVDftPHr_B8e2_QA9Jjvp"
)
BASE = "https://ggendb.up.railway.app"
TARGET = 104972


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/cal?d={SHARE}", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)
        await page.wait_for_timeout(3000)

        out = await page.evaluate(
            """() => {
              const r = calculateDamage();
              if (!r) return { error: 'no result' };
              const C = Math.ceil, F = Math.floor;
              const bd = r.baseDamage;
              const oc = r.offenseComponent * bd;
              const dc = r.defenseComponent * bd;
              const tc = r.terrainCorrection;
              const N = r.totalNormalMultPct;
              const dm = r.defendMult;

              const bdmCombined = C((bd + r.damageCorrection) * tc);
              const bdmSplit = C((bd + C(oc) + C(dc)) * tc);
              const pct = (r.userDmgIncreasePct + r.vigorDmgBonusPct + r.dmgTakenUpPct - r.takenDown) | 0;
              const skipSplit = pct > 0 && ((bdmCombined * pct) % 100 === 0);
              const useSplit = !skipSplit && bdmSplit === bdmCombined + 1;

              function finalFromBD(BD, multPct, defend) {
                const sn = C(multPct * BD / 100);
                return C((BD + sn) * defend);
              }

              const variants = {};
              for (const [label, BD] of [
                ['combined', bdmCombined],
                ['split', bdmSplit],
                ['current', r.battleDamage],
              ]) {
                variants[label + '_double_ceil'] = finalFromBD(BD, N, dm);
                variants[label + '_single_ceil'] = C(BD * (100 + N) / 100 * dm);
                variants[label + '_sn_floor'] = C((BD + F(N * BD / 100)) * dm);
                variants[label + '_sn_round'] = C((BD + Math.round(N * BD / 100)) * dm);
                variants[label + '_defend_on_sn'] = C(BD * dm + C(C(N * BD / 100) * dm));
              }

              // skipSplit what-if
              variants['force_combined_bd'] = finalFromBD(bdmCombined, N, dm);
              variants['force_split_bd'] = finalFromBD(bdmSplit, N, dm);

              return {
                normalDmg: r.normalDmg,
                target: """
            + str(TARGET)
            + """,
                delta: r.normalDmg - """
            + str(TARGET)
            + """,
                battleDamage: r.battleDamage,
                bdmCombined,
                bdmSplit,
                skipSplit,
                useSplit,
                baseDamage: r.baseDamage,
                damageCorrection: r.damageCorrection,
                offenseCorrection: C(oc),
                defenseCorrection: C(dc),
                totalNormalMultPct: N,
                scaledNormal: r.scaledNormal,
                defendMult: dm,
                unitAtk: r.unitAtk,
                charAtk: r.charAtk,
                unitDef: r.unitDef,
                weaponPower: r.weaponPower,
                combatWeaponPower: r.combatWeaponPower,
                dmgIncrease: S.dc.dmgIncrease,
                defending: S.dc.defending,
                shield: S.dc.shield,
                variants,
                matching: Object.fromEntries(
                  Object.entries(variants).filter(([, v]) => v === """
            + str(TARGET)
            + """)
                ),
              };
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
