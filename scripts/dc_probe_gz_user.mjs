/**
 * Probe Great Zeong damage with user-reported stats.
 * Run: node scripts/dc_probe_gz_user.mjs  (server on :5050)
 */
const BASE = 'http://127.0.0.1:5050';

async function fetchJson(path) {
  const r = await fetch(`${BASE}${path}`);
  return r.json();
}

const F = Math.floor;
const C = Math.ceil;
const MX = Math.max;
const EXP = Math.exp;
const DC_SHEET_UNIT_STAT_RATIO = true;

function calcStepByStep({
  unitAtk,
  charAtk,
  charDef,
  unitDef,
  wp,
  N,
  defDebuffPct = 0,
}) {
  const terrainCorrection = 1;
  const characterStatRatio = MX(0, charAtk - charDef) / 5000;
  const unitStatRatio = MX(0, C(unitAtk / 10 - unitDef / 10)) / 5000;
  const charSigmoid = 1 / (EXP((250 * (charDef - charAtk)) / 100000) + 1);
  const unitSigmoid = 1 / (EXP((25 * (unitDef - unitAtk)) / 100000) + 1);
  const baseDamage = C((characterStatRatio + unitStatRatio + charSigmoid + unitSigmoid) * wp);
  const atkCombined = C((unitAtk + 2 * charAtk) / 10);
  const defCombined = C((unitDef + 2 * charDef) / 10);
  const offExp = ((5000 - atkCombined) * 30) / 100000;
  const defExp = ((5000 - defCombined) * 3) / 100000;
  const offenseComponent = 100 / (EXP(offExp) + 1);
  const defenseComponent = -40 / (EXP(defExp) + 1);
  const offenseCorrection = C(offenseComponent * baseDamage);
  const defenseCorrection = C(defenseComponent * baseDamage);
  const damageCorrection = (offenseComponent + defenseComponent) * baseDamage;
  let battleDamage = C((baseDamage + damageCorrection) * terrainCorrection);
  const battleDamageSplit = C((baseDamage + offenseCorrection + defenseCorrection) * terrainCorrection);
  const scaledNormal = C((N * battleDamage) / 100);
  const scaledNormalSplit = C((N * battleDamageSplit) / 100);
  const normalDmg = C(battleDamage + scaledNormal);
  const normalDmgSplit = C(battleDamageSplit + scaledNormalSplit);
  return {
    baseDamage,
    battleDamage,
    battleDamageSplit,
    scaledNormal,
    scaledNormalSplit,
    normalDmg,
    normalDmgSplit,
    atkCombined,
    defCombined,
    offenseCorrection,
    defenseCorrection,
    damageCorrection: C(damageCorrection),
  };
}

async function main() {
  const gz = await fetchJson('/api/unit/1850001650?lang=EN&lb_tier=2');
  const pilot = await fetchJson('/api/character/1850001501?lang=EN');
  const stage = await fetchJson('/api/stage/90520001?lang=EN');
  const npc = stage.npc_details.find((n) => n.npc_id === '905200000102000003');
  const exWpn = gz.weapons.find((w) => w.is_ex);
  const exPow = exWpn?.levels?.[exWpn.levels.length - 1]?.power;
  console.log('EX weapon power from API LB2 max lv:', exPow);

  // User-reported panel values
  const user = {
    unitAtk: 16460,
    charRanged: 633,
    charAwaken: 807,
    wp: 6360,
    charDef: 705,
    unitDef: 25072,
  };

  for (const charAtk of [807, 633, Math.max(633, 807)]) {
    for (const N of [0, 12, 20, 33, 45, 53, 65]) {
      const r = calcStepByStep({ ...user, charAtk, wp: user.wp, N });
      if (r.normalDmg >= 28498 && r.normalDmg <= 28503) {
        console.log(`charAtk=${charAtk} N=${N}% → normal=${r.normalDmg} (split=${r.normalDmgSplit}) BD=${r.battleDamage}/${r.battleDamageSplit}`);
      }
    }
  }

  // Brute: find N that gives 28501 with user stats
  console.log('\n--- brute N for normalDmg=28501 ---');
  for (let N = 0; N <= 100; N++) {
    const r = calcStepByStep({ ...user, charAtk: 807, wp: user.wp, N });
    if (r.normalDmg === 28501 || r.normalDmgSplit === 28501) {
      console.log(`N=${N} normal=${r.normalDmg} split=${r.normalDmgSplit} BD=${r.battleDamage} bds=${r.battleDamageSplit}`);
    }
  }

  // Live browser calc if playwright available - skip, use evaluate via fetch to a test endpoint? 
  // Instead dump what unit atk LB2 base is
  const lb2 = gz.lb_data?.[2]?.stats_no_cond || gz.stats;
  const atkBase = lb2?.find?.((s) => s.name === 'Attack')?.total;
  console.log('\nAPI LB2 base Attack:', atkBase);
  console.log('User unitAtk 16460 implies +6681 bonus → base ~', 16460 - 6681);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
