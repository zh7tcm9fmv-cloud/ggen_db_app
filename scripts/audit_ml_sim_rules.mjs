import fs from 'fs';
import vm from 'vm';

const ctx = { module: { exports: {} }, exports: {}, console };
ctx.globalThis = ctx;
vm.runInNewContext(fs.readFileSync(new URL('../static/js/ml_sim_rules.js', import.meta.url), 'utf8'), ctx);
const rules = ctx.module.exports;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exitCode = 1;
  }
}

const units = [
  { id: 'a', hp: 10, mobility: 5, reaction: 1, x: 0, y: 0 },
  { id: 'b', hp: 10, mobility: 9, reaction: 2, x: 1, y: 0 },
  { id: 'c', hp: 0, mobility: 99, reaction: 99, x: 2, y: 0 }
];
const order = rules.actionOrder(units).map((u) => u.id);
assert(order.join(',') === 'b,a', 'order is mobility+reaction, dead skipped, got ' + order.join(','));

/* Manhattan (not Chebyshev): (0,0)→(3,4) = 7 */
assert(rules.distance({ x: 0, y: 0 }, { x: 3, y: 4 }) === 7, 'manhattan 3+4=7');
assert(rules.distance({ x: 8, y: 11, size: 1 }, { x: 12, y: 11, size: 1 }) === 4, 'LINE gap x 8→12 = 4');

const atk = {
  x: 12, y: 11, move: 5, size: 1, side: 'ally',
  weapons: [{ name: 'short', min_range: 1, max_range: 2, power: 100 }, { name: 'long', min_range: 1, max_range: 5, power: 500 }]
};
const foes = [
  { id: 'near', hp: 80, x: 8, y: 10, n: 1, move: 5, size: 1, side: 'enemy', sdLimit: 1, usedSupportDefendCount: 0 },
  { id: 'low', hp: 20, x: 8, y: 9, n: 2, move: 5, size: 1, side: 'enemy', sdLimit: 0, usedSupportDefendCount: 0 }
];
const bounds = { minX: 0, maxX: 20, minY: 0, maxY: 20 };
const all = [atk].concat(foes);

const engage = rules.pickEngage(atk, foes, all, bounds, (a, d, w) => w.power | 0);
assert(engage && engage.target.id === 'low', 'engage lowest HP reachable, got ' + (engage && engage.target && engage.target.id));
assert(engage.weapon.name === 'long', 'engage picks highest-damage in-range weapon');

const next = rules.getBestMoveDestination(atk, engage.target, 5, engage.minR, engage.maxR, all, bounds);
assert(next && typeof next.x === 'number', 'getBestMoveDestination returns a cell');
/* From (12,11) to hit (8,9) with maxR=5: manhattan 4+2=6 > 5, so must move closer */
assert(next.moved === true, 'must move when current dist 6 > maxR 5, got ' + JSON.stringify(next));

const guard = rules.pickSupportDefender(engage.target, foes);
assert(guard && guard.id === 'near', 'support defend is other ally with SD uses in move range, got ' + (guard && guard.id));

const tank = { id: 'tank', hp: 90, x: 8, y: 10, move: 5, sdLimit: 1, usedSupportDefendCount: 0 };
const noSd = rules.pickSupportDefender(tank, [
  tank,
  { id: 'spent', hp: 99, x: 8, y: 9, move: 5, sdLimit: 1, usedSupportDefendCount: 1 }
]);
assert(noSd == null, 'no SD when only self / spent uses');

const sa = rules.pickSupportAttacker(
  { id: 'atk', n: 1, x: 12, y: 11, mobility: 8, reaction: 2, weapons: [{ name: 'gun', min_range: 1, max_range: 5 }] },
  [
    { id: 'atk', n: 1, x: 12, y: 11, mobility: 8, reaction: 2, weapons: [{ name: 'gun', min_range: 1, max_range: 5 }] },
    { id: 'sa', n: 2, x: 9, y: 9, mobility: 10, reaction: 3, hp: 50, weapons: [{ name: 'beam', min_range: 1, max_range: 3 }] },
    { id: 'far', n: 3, x: 0, y: 0, mobility: 99, reaction: 99, hp: 50, weapons: [{ name: 'beam', min_range: 1, max_range: 3 }] }
  ],
  { id: 'low', hp: 20, x: 8, y: 9 },
  1
);
assert(sa && sa.id === 'sa', 'support attack picks in-range ally, got ' + (sa && sa.id));

const kit = rules.buildPilotSkillKit({
  skills: [
    { name: 'High Speed LV 1', sp: 5 },
    { name: 'HP Repair LV 3', sp: 5 },
    { name: 'Force Guard LV 4', sp: 5 }
  ]
});
assert(kit.list.length === 3, 'pilot skill kit parses known skills');

const skill = rules.pickSkill({
  hp: 40, maxHp: 100, mp: 3, skillUsed: false, currentSp: 10,
  pilotSkills: kit,
  weapons: [{ min_range: 1, max_range: 5 }]
}, foes);
assert(skill && skill.key === 'repair', 'repair beats others under 50% HP, got ' + (skill && skill.key));

const lim = rules.supportDefendLimit({
  char: {
    abilities: [{
      name: 'Support Defense LV 4',
      details: [{ text: 'Support Defense +1 time(s).' }]
    }]
  }
});
assert(lim === 1, 'SD limit parses +1 time(s), got ' + lim);

/* Full Frontal kit: Support Defense LV + EX each +1 → 2 per turn */
const ffNz = {
  id: 'nz', hp: 90000, x: 5, y: 5, move: 4, size: 2, side: 'ally',
  usedSupportDefendCount: 0, battleSupportDefendedCount: 0, mp: 0,
  unit: { id: '1125001550', name: 'Neo Zeong (EX)', role: 'Durability', abilities: [] },
  char: {
    role: 'Durability',
    abilities: [
      {
        name: 'Support Defense LV 5',
        details: [
          { text: 'Support Defense +1 time(s).', conditions: [] },
          {
            text: 'When piloting units with specified types and executing Support Defense, increase own DEF by 25%.',
            conditions: [{ id: 'role_2', name: 'Durability Type', type: 'unit_role' }]
          }
        ]
      },
      {
        name: 'EX Character Ability',
        details: [
          { text: 'Support Defense +1 time(s).', conditions: [] },
          {
            text: 'When piloting the Neo Zeong (EX), improve Cond:Area…',
            conditions: [{ id: '1125001550', name: 'Neo Zeong (EX)', type: 'unit' }]
          }
        ]
      }
    ]
  }
};
assert(rules.supportDefendLimit(ffNz) === 2, 'FF+NZ SD limit 2, got ' + rules.supportDefendLimit(ffNz));
const allyA = { id: 'ally', hp: 40000, x: 6, y: 5, move: 3, size: 1, side: 'ally' };
let g = rules.pickSupportDefender(allyA, [ffNz, allyA]);
assert(g === ffNz, 'first SD picks NZ');
ffNz.usedSupportDefendCount = 1;
ffNz.battleSupportDefendedCount = 1;
g = rules.pickSupportDefender(allyA, [ffNz, allyA]);
assert(g === ffNz, 'second SD still available with stock 2');
ffNz.usedSupportDefendCount = 2;
assert(rules.pickSupportDefender(allyA, [ffNz, allyA]) == null, 'third SD blocked after 2 uses');

/* SA: two +1 lines sum to 2; SD text must not inflate SA (no bare 支援) */
const saPilot = {
  mp: 0, usedSupportCount: 0,
  unit: { role: 'Support', abilities: [] },
  char: {
    abilities: [
      { name: 'Support Attack LV 5', details: [{ text: 'Support Attack / Support Counter +1 time(s).', conditions: [] }] },
      { name: 'EX', details: [{ text: 'Support Attack / Support Counter +1 time(s).', conditions: [] }] }
    ]
  }
};
assert(rules.supportAttackLimit(saPilot) === 2, 'SA limit sums two +1 lines, got ' + rules.supportAttackLimit(saPilot));
assert(rules.supportAttackLimit(ffNz) === 0, 'FF SD lines must not count as SA, got ' + rules.supportAttackLimit(ffNz));

const saJa = {
  mp: 0,
  unit: { abilities: [] },
  char: { abilities: [{ name: 'x', details: [{ text: '「支援攻撃／反撃」+2回', conditions: [] }] }] }
};
assert(rules.supportAttackLimit(saJa) === 2, 'JA SA +2, got ' + rules.supportAttackLimit(saJa));
const sdJaOnly = {
  mp: 0,
  unit: { abilities: [] },
  char: { abilities: [{ name: 'x', details: [{ text: '「支援防御」+1回', conditions: [] }] }] }
};
assert(rules.supportAttackLimit(sdJaOnly) === 0, 'JA SD must not count as SA');
assert(rules.supportDefendLimit(sdJaOnly) === 1, 'JA SD +1 parsed');

assert(rules.rankedPoints('attack', true, 1, false) === 15, '1-turn win +15');
assert(rules.rankedPoints('attack', true, 1, true) === 30, 'upset doubles a win');

/* gge combat systems */
const preW = { name: 'P', min_range: 1, max_range: 3, power: 100, en: 10, ammo: 0, is_preemptive: true, traits: ['Preemptive Strike'], raw: { is_preemptive: true } };
assert(rules.isPreemptiveWeapon({}, preW) === true, 'preemptive flag');
assert(rules.isAbsoluteHitWeapon({ traits: ['Absolute Hit'] }) === true, 'absolute hit');
assert(rules.determineDefenseAction({ hp: 100, unit: { mechanisms: [] } }, 200, true, false) === 'evade', 'evade when defend still dies');
assert(rules.determineDefenseAction({ hp: 100, unit: { mechanisms: ['シールド'] } }, 50, true, true) === 'none', 'preemptive counter skips defend');
const enActor = { maxEn: 100, currentEn: 100, mp: 0, weapons: [], unit: { abilities: [] }, char: { abilities: [] } };
assert(rules.getEffectiveEnCost(enActor, { en: 20 }, false) === 20, 'base EN cost');
assert(Array.isArray(rules.getValidWeapons({ ...enActor, weapons: [preW], currentEn: 100, mp: 0 }, 2, false)), 'getValidWeapons');
const cqAtk = {
  x: 12, y: 5, size: 1, side: 'ally', hp: 5000, maxEn: 200, currentEn: 200, mp: 0,
  mobility: 5, reaction: 1, saLimit: 0, sdLimit: 0, usedSupportCount: 0, usedSupportDefendCount: 0,
  weapons: [preW], unit: { mechanisms: [] }, char: { abilities: [] }
};
const cqDef = {
  x: 8, y: 5, size: 1, side: 'enemy', hp: 4000, maxEn: 180, currentEn: 180, mp: 0,
  mobility: 4, reaction: 1, saLimit: 0, sdLimit: 0, usedSupportCount: 0, usedSupportDefendCount: 0,
  weapons: [{ name: 'R', min_range: 1, max_range: 5, power: 50, en: 5, ammo: 0, traits: [], raw: {} }],
  unit: { mechanisms: [] }, char: { abilities: [] }
};
const cq = rules.buildCombatQueue(cqAtk, cqDef, preW, [cqAtk], [cqDef], (a, d, w) => w.power | 0);
assert(cq.queue.some((q) => q.wave === 0), 'preemptive pulled to wave 0');
assert(cq.queue.some((q) => q.wave === 4 || q.type === 'counter'), 'counter wave present when surviving');
enActor.mp = 12;
enActor.hp = 100;
enActor.char = { abilities: [{ name: 'u', details: ['無条件チャンスステップ'] }] };
assert(rules.checkAndAcquireUnconditionalCS(enActor) === true, 'unconditional CS acquire');
assert((enActor.unconditionalCSStock | 0) === 1, 'unconditional CS stock');

/* Neo Zeong Cond:Area −20 + Full Frontal addition −15 → −35 on beam/physical ranged */
const auraSrc = {
  x: 8, y: 5, size: 1, side: 'ally', hp: 1,
  unit: {
    abilities: [{
      sim_effects: [{
        kind: 'weapon_power_pct', is_area_aura: true, value: -20,
        range_min: 1, range_max: 4, weapon_attrs: ['beam', 'physical'], attack_types: ['ranged']
      }]
    }]
  },
  char: {
    abilities: [{ sim_effects: [{ kind: 'aura_buff_value_addition', value: -15 }] }]
  }
};
const atkAura = { x: 12, y: 5, size: 1, side: 'enemy', hp: 1 };
const beamRanged = {
  power: 6000, attribute: 'Beam',
  raw: { attribute: 'Beam', attack_types: [{ key: 'ranged' }] }
};
const meleeBeam = {
  power: 4800, attribute: 'Beam',
  raw: { attribute: 'Beam', attack_types: [{ key: 'melee' }] }
};
assert(rules.areaWeaponPowerAuraPct(atkAura, [auraSrc], beamRanged) === -35, 'NZ+FF aura −35 on beam ranged');
assert(rules.areaWeaponPowerAuraPct(atkAura, [auraSrc], meleeBeam) === 0, 'melee exempt from ranged aura');

const ranked = rules.rankWeaponsByDamage(
  { }, { },
  [
    { name: 'Claw', power: 4440, is_ex: false },
    { name: 'Mega Cannon EX', power: 6120, is_ex: true }
  ],
  (a, d, w) => (w.is_ex ? w.power : 160000) /* simulate EX cal-fail vs Claw success */
);
assert(ranked[0].weapon.name === 'Mega Cannon EX', 'rank prefers EX when cal collapses to raw power');

if (!process.exitCode) console.log('ml sim rules audit OK');
