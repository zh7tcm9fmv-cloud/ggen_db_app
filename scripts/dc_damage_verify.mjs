/**
 * Mirrors templates/index.html calculateDamage core (no traits / manual final POW).
 * Run: node scripts/dc_damage_verify.mjs
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

function defAfterDebuff(defRaw, defBon, pct) {
  const u = defRaw + defBon;
  return MX(0, F((u * (100 - pct)) / 100));
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
 * unitAtk 23663, charAtk 806, defender after debuff 8538, charDef 705,
 * weaponPower 6730, ⑨ net +35% (e.g. 0 user + 0 vigor + 35 dtu − 0 taken), no terrain/defend.
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
