"""Probe ATK source for 1163000150 — sim 19308 vs in-game 19307."""
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
              const r0 = calculateDamage();
              const lb = S.dc.atkUnitData.lb_data;
              const tier = Math.min(S.dc.lbTier, lb.length - 1);
              const statKey = _dcGetUnitStatKey();
              const td = lb[tier];
              const atkUnitStats = td[statKey] || td.stats_no_cond;

              const uFloor = _dcGetModifiedAttackerUnitStatsFromCtx(S.dc, atkUnitStats, { forDamage: false });
              const uCeil = _dcGetModifiedAttackerUnitStatsFromCtx(S.dc, atkUnitStats, { forDamage: true });

              function dmgWithUnitAtk(ua) {
                const F = Math.floor, C = Math.ceil, MX = Math.max, EXP = Math.exp;
                const ud = S.dc.atkUnitData, cd = S.dc.atkCharData, npc = S.dc.defNpc;
                const atkCharStats = _dcGetCharStats();
                const wpns = _dcNonMapWeapons(ud);
                const wpn = wpns[S.dc.wpnIdx];
                const lvData = _dcWeaponLevelRow(wpn, S.dc.wpnLv);
                const defUnit = npc.unit, defChar = npc.character;
                const us = _dcDefNpcUnitMapStatsPair(defUnit).stats;
                const cs = defChar && defChar.stats_raw || {};
                let unitDef = Math.max(0, Number(us.Defense) || 0);
                let charDef = Math.max(0, Number(cs.Defense) || 0);
                let charAtk = _dcGetCharAtkStatWithSkills(atkCharStats, wpn);
                const rawWpnPower = lvData.power;
                const computedWpnPow = _dcComputedWeaponPowerForLevel(wpn, S.dc.wpnLv);
                const weaponPower = S.dc.finalWpnPow || computedWpnPow;
                const defDebuffPct = _dcManualPlusWeaponDefDebuffPct(wpn, S.dc.wpnLv);
                const combatWeaponPower = _dcCombatWeaponPowerNominal(weaponPower, defDebuffPct, false);
                const terrainCorrection = 1 - (S.dc.terrain / 100);
                const mp = _dcMpProfile(S.dc.mpLevel);
                const vigorDmgBonusPct = Math.round((mp.dmgBonus || 0) * 100);
                const characterStatRatio = MX(0, charAtk - charDef) / 5000;
                let unitStatRatio;
                if (DC_SHEET_UNIT_STAT_RATIO) {
                  unitStatRatio = MX(0, C((ua / 10) - (unitDef / 10))) / 5000;
                } else {
                  unitStatRatio = MX(0, F(F(ua / 10) - F(unitDef / 10))) / 5000;
                }
                const charSigmoid = 1 / (EXP(250 * (charDef - charAtk) / 100000) + 1);
                const unitSigmoid = 1 / (EXP(25 * (unitDef - ua) / 100000) + 1);
                const baseDamage = C((characterStatRatio + unitStatRatio + charSigmoid + unitSigmoid) * combatWeaponPower);
                const atkCombined = C((ua + 2 * charAtk) / 10);
                const defCombined = C((unitDef + 2 * charDef) / 10);
                const offExp = ((5000 - atkCombined) * 30) / 100000;
                const defExp = ((5000 - defCombined) * 3) / 100000;
                const offenseComponent = (10000 / 100) / (EXP(offExp) + 1);
                const defenseComponent = (-4000 / 100) / (EXP(defExp) + 1);
                const offenseCorrection = C(offenseComponent * baseDamage);
                const defenseCorrection = C(defenseComponent * baseDamage);
                const damageCorrection = (offenseComponent + defenseComponent) * baseDamage;
                let battleDamage = C((baseDamage + damageCorrection) * terrainCorrection);
                const battleDamageSplit = C((baseDamage + offenseCorrection + defenseCorrection) * terrainCorrection);
                const userDmgIncreasePct = S.dc.dmgIncrease || 0;
                const dmgTakenUpPct = _dcWeaponDtuSumPct(wpn);
                const takenDown = S.dc.dmgTakenDownPilot || 0;
                const normalMultEarly = userDmgIncreasePct + vigorDmgBonusPct + dmgTakenUpPct - takenDown;
                const pct = normalMultEarly | 0;
                const skipSplit = pct > 0 && ((battleDamage * pct) % 100 === 0);
                if (!skipSplit && battleDamageSplit === battleDamage + 1) battleDamage = battleDamageSplit;
                const totalNormalMultPct = normalMultEarly;
                const scaledNormal = C(totalNormalMultPct * battleDamage / 100);
                return C((battleDamage + scaledNormal) * (S.dc.defending ? (S.dc.shield ? 0.6 : 0.8) : 1));
              }

              const pairFloor = _dcPilotPairUnitAtkDefPct(uFloor.unitAtk, uFloor.unitDefVal);
              const pairCeil = _dcPilotPairUnitAtkDefPct(uCeil.unitAtk, uCeil.unitDefVal);
              const atkFloor = _dcApplyAdvantageTagAtkToUnitAtk(
                _dcApplyCounterOwnAtkToUnitAtk(pairFloor.unitAtk),
                _dcAdvantageTagAtkPctFromAbilities(S.dc.atkUnitData, S.dc.defNpc),
                uFloor.advantageFlatGrowthAtk | 0
              );
              const atkCeil = r0.unitAtk;

              return {
                normalDmg: r0.normalDmg,
                unitAtkCeil: atkCeil,
                unitAtkFloor: atkFloor,
                uFloorRaw: uFloor.unitAtk,
                uCeilRaw: uCeil.unitAtk,
                dmgWithFloorAtk: dmgWithUnitAtk(atkFloor),
                dmgWithCeilAtk: dmgWithUnitAtk(atkCeil),
                dmgWith19307: dmgWithUnitAtk(19307),
                target: """
            + str(TARGET)
            + """,
              };
            }"""
        )
        print(json.dumps(out, indent=2, default=str))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
