/**
 * Mirrors templates/index.html calculateDamage core.
 * Run: node scripts/dc_damage_verify.mjs
 *
 * Verified against live API data for share link:
 * dc=eyJ2IjoxLCJhIjowLCJTIjpbeyJ1IjoiMTA5NTAwMjU1MCIsImMiOiIxMDk1MDAxODAxIiwid2kiOjMsIndsIjo0LCJkaSI6MzUsImV4YSI6MjAsInRkIjoyMCwib3AiOiI0MDAwMjUiLCJzcCI6IjEwODAwMDA1NTAiLCJzcGIiOjJ9LG51bGwsbnVsbF0sIkQiOnsibiI6IjkwNTIwMDAwMDEwMjAwMDAwMyIsInMiOiI5MDUyMDAwMSIsImRlZnAiOjQwfX0
 *
 * Attacker: Qubeley ZZ EX (1095002550) LB3 + Haman (1095001801)
 *   - Weapon: Funnels EX Lv5 — nominal power 7776 (ceil of raw×trait); hidden +1 when DEF debuff >35%
 *   - Option / supporter / EX squad / Advantage as in share link
 *
 * Defender: Psycho Gundam, 40% DEF debuff → UnDef 15044
 *
 * Expected: normalDmg = 244907
 */
const F = Math.floor;
const C = Math.ceil;
const MX = Math.max;
const EXP = Math.exp;

function combatWpnPow(nominalPow, defDebuffPct, hasFinalOverride) {
  const n = Number(nominalPow) || 0;
  const p = parseInt(defDebuffPct, 10) || 0;
  if (hasFinalOverride || p <= 35) return n;
  return n + 1;
}

function calcNormal({
  unitAtk,
  charAtk,
  charDef,
  unitDefAfterDebuff,
  weaponPowerNominal,
  defDebuffPct,
  hasFinalWeaponOverride,
  terrainPct,
  totalNormalMultPct,
  defendMult,
}) {
  const wp = combatWpnPow(weaponPowerNominal, defDebuffPct, hasFinalWeaponOverride);
  const terrainCorrection = 1 - terrainPct / 100;
  const characterStatRatio = MX(0, charAtk - charDef) / 5000;
  const unitDiffRaw = F(unitAtk / 10) - F(unitDefAfterDebuff / 10);
  const unitStatRatio = MX(0, F(unitDiffRaw)) / 5000;
  const charSigmoid = 1 / (EXP((250 * (charDef - charAtk)) / 100000) + 1);
  const unitSigmoid = 1 / (EXP((25 * (unitDefAfterDebuff - unitAtk)) / 100000) + 1);
  const baseDamage = C(
    (characterStatRatio + unitStatRatio + charSigmoid + unitSigmoid) * wp
  );
  const atkCombined = C((unitAtk + 2 * charAtk) / 10);
  const defCombined = C((unitDefAfterDebuff + 2 * charDef) / 10);
  const offExp = ((5000 - atkCombined) * 30) / 100000;
  const defExp = ((5000 - defCombined) * 3) / 100000;
  const offenseComponent = 100 / (EXP(offExp) + 1);
  const defenseComponent = -40 / (EXP(defExp) + 1);
  const damageCorrection = (offenseComponent + defenseComponent) * baseDamage;
  const battleDamage = C((baseDamage + damageCorrection) * terrainCorrection);
  const normalDmg = MX(
    0,
    C(battleDamage * (1 + totalNormalMultPct / 100) * defendMult)
  );
  return { normalDmg, battleDamage, baseDamage, combatWeaponPower: wp };
}

function defAfterDebuff(totalDef, pct) {
  const u = totalDef;
  const p = pct;
  return MX(0, u - F((u * p) / 100));
}

const TARGET = 244907;
const defTotal = 25072;
const defDebuffPct = 40;
const unitDef = defAfterDebuff(defTotal, defDebuffPct);

const scenario = {
  unitAtk: 23475,
  charAtk: 812,
  charDef: 705,
  unitDefAfterDebuff: unitDef,
  weaponPowerNominal: 7776,
  defDebuffPct,
  hasFinalWeaponOverride: false,
  terrainPct: 0,
  totalNormalMultPct: 35,
  defendMult: 1,
};

const r = calcNormal(scenario);
console.log('DEF:', `${defTotal} → ${unitDef} after ${defDebuffPct}%`);
console.log('Nominal WP:', scenario.weaponPowerNominal, '→ combat WP:', r.combatWeaponPower);
console.log('battleDamage:', r.battleDamage, 'normalDmg:', r.normalDmg, 'TARGET:', TARGET, r.normalDmg === TARGET ? '✓' : '✗');
