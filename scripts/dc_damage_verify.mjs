/**
 * Mirrors templates/index.html calculateDamage core (Firered sheet order).
 * Run: node scripts/dc_damage_verify.mjs
 *
 * Verified against live API data for share link:
 * dc=eyJ2IjoxLCJhIjowLCJTIjpbeyJ1IjoiMTA5NTAwMjU1MCIsImMiOiIxMDk1MDAxODAxIiwid2kiOjMsIndsIjo0LCJkaSI6MzUsImV4YSI6MjAsInRkIjoyMCwib3AiOiI0MDAwMjUiLCJzcCI6IjEwODAwMDA1NTAiLCJzcGIiOjJ9LG51bGwsbnVsbF0sIkQiOnsibiI6IjkwNTIwMDAwMDEwMjAwMDAwMyIsInMiOiI5MDUyMDAwMSIsImRlZnAiOjQwfX0
 *
 * Attacker: Qubeley ZZ EX (1095002550) LB3 + Haman (1095001801)
 * Defender: Psycho Gundam, 40% DEF debuff → UnDef 15044
 *
 * Expected normal (DC_SHEET_UNIT_STAT_RATIO + sheet ⑨): normalDmg = 244944
 *
 * unitStatRatio: RoundUp((atk/10)−(def/10))/5000 — mirrors app.js DC_SHEET_UNIT_STAT_RATIO.
 */
const F = Math.floor;
const C = Math.ceil;
const MX = Math.max;
const EXP = Math.exp;

/** Must match static/js/app.js */
const DC_SHEET_UNIT_STAT_RATIO = true;
const DC_CRIT125_TRIM_MIN_BATTLE_DAMAGE = 356500;
const DC_CRIT125_TRIM_DIV = 1181;

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
  let unitStatRatio;
  if (DC_SHEET_UNIT_STAT_RATIO || (defDebuffPct | 0) === 20) {
    unitStatRatio = MX(0, C(unitAtk / 10 - unitDefAfterDebuff / 10)) / 5000;
  } else {
    const unitDiffRaw = F(unitAtk / 10) - F(unitDefAfterDebuff / 10);
    unitStatRatio = MX(0, F(unitDiffRaw)) / 5000;
  }
  const charSigmoid = 1 / (EXP((250 * (charDef - charAtk)) / 100000) + 1);
  const unitSigmoid = 1 / (EXP((25 * (unitDefAfterDebuff - unitAtk)) / 100000) + 1);
  const baseDamage = C((characterStatRatio + unitStatRatio + charSigmoid + unitSigmoid) * wp);
  const atkCombined = C((unitAtk + 2 * charAtk) / 10);
  const defCombined = C((unitDefAfterDebuff + 2 * charDef) / 10);
  const offExp = ((5000 - atkCombined) * 30) / 100000;
  const defExp = ((5000 - defCombined) * 3) / 100000;
  const offenseComponent = 100 / (EXP(offExp) + 1);
  const defenseComponent = -40 / (EXP(defExp) + 1);
  const damageCorrection = (offenseComponent + defenseComponent) * baseDamage;
  const battleDamage = C((baseDamage + damageCorrection) * terrainCorrection);
  const scaledNormal = C((totalNormalMultPct * battleDamage) / 100);
  const combinedNormal = (battleDamage + scaledNormal) * defendMult;
  const normalDmg = MX(0, C(combinedNormal));
  return { normalDmg, battleDamage, baseDamage, combatWeaponPower: wp, scaledNormal };
}

/** Firered: scaledCrit + combinedCrit (minus crit125Trim when N=125 & BD≥threshold) + ceil(vigor). */
function calcSuperCrit(
  battleDamage,
  totalCritMultPct,
  vigorCritPct,
  defendMult = 1,
  combatWeaponPower = 0
) {
  const scaledCrit = C((totalCritMultPct * battleDamage) / 100);
  let crit125Trim = 0;
  if (
    (totalCritMultPct | 0) === 125 &&
    defendMult === 1 &&
    (battleDamage | 0) >= DC_CRIT125_TRIM_MIN_BATTLE_DAMAGE &&
    (combatWeaponPower | 0) > 0
  ) {
    crit125Trim = F(MX(0, battleDamage - combatWeaponPower) / DC_CRIT125_TRIM_DIV);
  }
  const combinedCrit = MX(0, (battleDamage + scaledCrit) * defendMult - crit125Trim);
  return MX(0, C((combinedCrit * (100 + vigorCritPct)) / 100 - 1e-9));
}

/** Matches app.js _dcApplyEnemyDefDebuffToDefenderUnitDef: debuff % applies to (total − bonus) only. */
function defAfterEnemyDebuff(totalDef, bonusDefense, pct) {
  const u = totalDef | 0;
  const bon = MX(0, bonusDefense | 0);
  const base = MX(0, u - bon);
  const p = MX(0, Math.min(100, parseInt(pct, 10) || 0));
  if (p <= 0 || u <= 0) return u;
  const reduc = base > 0 ? F((base * p) / 100) : 0;
  return MX(0, u - reduc);
}

const TARGET = 244944;
const defTotal = 25072;
const defBonusDefense = 0;
const defDebuffPct = 40;
const unitDef = defAfterEnemyDebuff(defTotal, defBonusDefense, defDebuffPct);

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

/* defendMult=1: sheet steps match integer ceil(B×(100+N)/100); avoid B×(1+N/100) float (e.g. 244944.00000003 → wrong ceil). */
const Btest = r.battleDamage;
const Ntest = 35;
const sheetSteps = C((Btest + C((Ntest * Btest) / 100)) * 1);
const intCeilMult = Math.floor((Btest * (100 + Ntest) + 99) / 100);
if (sheetSteps !== intCeilMult) {
  console.error('FAIL: dm=1 sheet vs integer ceil', sheetSteps, intCeilMult);
  process.exitCode = 1;
}

console.log('\nUnicorn vs Throne Zwei (in-game: super = ceil(combinedNormal×1.3), same pool as normal):');
const throneUnicorn = {
  battleDamage: 320751,
  totalCritMultPct: 205,
  vigorCritPct: 30,
  wantNormal: 978291,
  wantSuper: 1271779,
};
{
  const sn = C((throneUnicorn.totalCritMultPct * throneUnicorn.battleDamage) / 100);
  const normalD = C(throneUnicorn.battleDamage + sn);
  const gotSuper = calcSuperCrit(
    throneUnicorn.battleDamage,
    throneUnicorn.totalCritMultPct,
    throneUnicorn.vigorCritPct,
    1
  );
  const okN = normalD === throneUnicorn.wantNormal;
  const okS = gotSuper === throneUnicorn.wantSuper;
  console.log(
    `  BD=${throneUnicorn.battleDamage} normal=${normalD} (want ${throneUnicorn.wantNormal}) ${okN ? '✓' : '✗'}; super=${gotSuper} (want ${throneUnicorn.wantSuper}) ${okS ? '✓' : '✗'}`
  );
  if (!okN || !okS) process.exitCode = 1;
}

console.log('\nSuper crit (Firered sheet, sample battleDamage values):');
const sheetSuperCases = [
  { battleDamage: 320720, totalCritMultPct: 205, vigorCritPct: 30, want: 1271655 },
  { battleDamage: 356367, totalCritMultPct: 125, vigorCritPct: 30, want: 1042374 },
  {
    battleDamage: 356517,
    totalCritMultPct: 125,
    vigorCritPct: 30,
    combatWeaponPower: 7863,
    want: 1042430,
    note: 'Exia vs Throne (trim only when ⑧≥356500 and W>0)',
  },
  { battleDamage: 309849, totalCritMultPct: 195, vigorCritPct: 30, want: 1188272 },
];
for (const c of sheetSuperCases) {
  const got = calcSuperCrit(
    c.battleDamage,
    c.totalCritMultPct,
    c.vigorCritPct,
    1,
    c.combatWeaponPower ?? 0
  );
  console.log(
    `  battleDamage=${c.battleDamage} → superCrit ${got} (want ${c.want}) ${got === c.want ? '✓' : '✗'}`
  );
  if (got !== c.want) process.exitCode = 1;
}

console.log('\nDefend / shield (sheet: combined fractional before vigor RoundUp):');
const defendCases = [
  {
    name: 'super + defend 0.8',
    battleDamage: 320720,
    totalCritMultPct: 205,
    vigorCritPct: 30,
    defendMult: 0.8,
    want: 1017324,
  },
  {
    name: 'normal + defend 0.8',
    battleDamage: 320720,
    totalNormalMultPct: 35,
    defendMult: 0.8,
    want: 346378,
  },
  {
    name: 'super + shield 0.6',
    battleDamage: 10000,
    totalCritMultPct: 50,
    vigorCritPct: 30,
    defendMult: 0.6,
    want: 11700,
  },
];
for (const c of defendCases) {
  if (c.totalCritMultPct != null) {
    const got = calcSuperCrit(c.battleDamage, c.totalCritMultPct, c.vigorCritPct, c.defendMult);
    console.log(`  ${c.name}: superCrit ${got} (want ${c.want}) ${got === c.want ? '✓' : '✗'}`);
    if (got !== c.want) process.exitCode = 1;
  } else {
    const scaled = C((c.totalNormalMultPct * c.battleDamage) / 100);
    const combined = (c.battleDamage + scaled) * c.defendMult;
    const got = MX(0, C(combined));
    console.log(`  ${c.name}: normalDmg ${got} (want ${c.want}) ${got === c.want ? '✓' : '✗'}`);
    if (got !== c.want) process.exitCode = 1;
  }
}
