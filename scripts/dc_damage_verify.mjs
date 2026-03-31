/**
 * Mirrors templates/index.html calculateDamage core (no traits / manual final POW).
 * Run: node scripts/dc_damage_verify.mjs
 *
 * Note: In the live app, NPC unit stats_raw.* already includes map team bonuses (fst);
 * bonus_amounts.* is the increment only — damage uses stats_raw Defense as the total line.
 * This script uses defRaw+defBon explicitly to match the "11402 (+2829)" display split.
 */
const F = Math.floor;
const C = Math.ceil;
const MX = Math.max;
const EXP = Math.exp;

function calcNormal({
  unitAtk,
  charAtk,
  charDef,
  unitDefAfterDebuff,
  weaponPower,
  terrainPct,
  totalNormalMultPct,
  defendMult,
}) {
  const terrainCorrection = 1 - terrainPct / 100;
  const characterStatRatio = MX(0, charAtk - charDef) / 5000;
  const unitDiffRaw = F(unitAtk / 10) - F(unitDefAfterDebuff / 10);
  const unitStatRatio = MX(0, F(unitDiffRaw)) / 5000;
  const charSigmoid = 1 / (EXP((250 * (charDef - charAtk)) / 100000) + 1);
  const unitSigmoid = 1 / (EXP((25 * (unitDefAfterDebuff - unitAtk)) / 100000) + 1);
  const baseDamage = C(
    (characterStatRatio + unitStatRatio + charSigmoid + unitSigmoid) * weaponPower
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
  return { normalDmg, battleDamage, baseDamage };
}

/** Same as _dcApplyDefDebuffToUnitDef: u − floor(u×p/100), not floor(u×(100−p)/100). */
function defAfterDebuff(defRaw, defBon, pct) {
  const u = defRaw + defBon;
  const p = Math.max(0, Math.min(100, pct | 0));
  if (p <= 0 || u <= 0) return MX(0, u);
  return MX(0, u - F((u * p) / 100));
}

const TARGET = 244907;

/** Defender: 11402 (+2829) map DEF, 40% debuff — same as UI */
const defRaw = 11402;
const defBon = 2829;
const defDebuffPct = 40;
const unitDef = defAfterDebuff(defRaw, defBon, defDebuffPct);

/** Pilot Four — from earlier context */
const charDef = 705;

/**
 * Example that hits TARGET exactly (formula mirror):
 * unitAtk 23663, charAtk 806, defender after debuff 8539 (14231 total DEF, 40%: 14231−floor(5692)),
 * charDef 705, weaponPower 6730, ⑨ net +35%, no terrain/defend.
 * battleDamage 181412 → ceil(181412 * 1.35) = 244907
 */
const scenario = {
  unitAtk: 23663,
  charAtk: 806,
  charDef,
  unitDefAfterDebuff: unitDef,
  weaponPower: 6730,
  terrainPct: 0,
  totalNormalMultPct: 35,
  defendMult: 1,
};

const r = calcNormal(scenario);
console.log('DEF display:', `${defRaw} (+${defBon}) → ${unitDef} after ${defDebuffPct}%`);
console.log('Params:', JSON.stringify(scenario, null, 2));
console.log('battleDamage:', r.battleDamage, 'baseDamage:', r.baseDamage);
console.log('Result normalDmg:', r.normalDmg, 'TARGET:', TARGET, r.normalDmg === TARGET ? '✓ EXACT' : '✗');

if (r.normalDmg !== TARGET) {
  let best = null;
  for (let wp = 4000; wp <= 9000; wp++) {
    const n = calcNormal({ ...scenario, weaponPower: wp }).normalDmg;
    const d = Math.abs(n - TARGET);
    if (!best || d < best.d) best = { wp, n, d };
    if (n === TARGET) console.log('EXACT weaponPower =', wp);
  }
  if (best) console.log('Closest wp in [4000..9000]:', best);
}
