/**
 * Pure check of the map-home collision pattern that caused “4 units / overlap”
 * after roster edits (stale slot.x/y from map-drag).
 */
function reconcile(slots, cells) {
  const SLOT_COUNT = 5;
  const claimed = Object.create(null);
  let dirty = false;

  function cellKey(x, y) {
    return (x | 0) + ',' + (y | 0);
  }
  function tryClaim(slotIdx, x, y) {
    const k = cellKey(x, y);
    if (claimed[k] != null && claimed[k] !== slotIdx) return false;
    claimed[k] = slotIdx;
    return true;
  }
  function effective(i) {
    const base = cells[i] || { x: 0, y: 0 };
    const sl = slots[i];
    const x = sl && sl.x != null ? (sl.x | 0) : (base.x | 0);
    const y = sl && sl.y != null ? (sl.y | 0) : (base.y | 0);
    return { x, y, base };
  }

  for (let i = 0; i < SLOT_COUNT; i++) {
    const sl = slots[i];
    if (!sl || !sl.unitId) continue;
    const { x, y, base } = effective(i);
    if (tryClaim(i, x, y)) continue;
    if (sl.x != null || sl.y != null) {
      delete sl.x;
      delete sl.y;
      dirty = true;
    }
    if (tryClaim(i, base.x | 0, base.y | 0)) continue;
    for (let bi = 0; bi < cells.length; bi++) {
      const c = cells[bi];
      if (!tryClaim(i, c.x | 0, c.y | 0)) continue;
      if ((base.x | 0) === (c.x | 0) && (base.y | 0) === (c.y | 0)) {
        delete sl.x;
        delete sl.y;
      } else {
        sl.x = c.x | 0;
        sl.y = c.y | 0;
      }
      dirty = true;
      break;
    }
  }
  return dirty;
}

function homes(slots, cells) {
  return slots.map((sl, i) => {
    if (!sl || !sl.unitId) return null;
    const base = cells[i];
    return {
      i,
      x: sl.x != null ? sl.x : base.x,
      y: sl.y != null ? sl.y : base.y
    };
  }).filter(Boolean);
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exitCode = 1;
  }
}

const cells = [
  { n: 1, x: 12, y: 7 },
  { n: 2, x: 12, y: 9 },
  { n: 3, x: 12, y: 11 },
  { n: 4, x: 12, y: 13 },
  { n: 5, x: 12, y: 15 }
];

/* Repro: slot0 default at (12,7); slot2 still has map-drag home on (12,7) after a swap. */
const slots = [
  { unitId: 'a' },
  { unitId: 'b' },
  { unitId: 'c', x: 12, y: 7 },
  { unitId: 'd' },
  { unitId: 'e' }
];

const before = homes(slots, cells);
const keysBefore = before.map((h) => h.x + ',' + h.y);
assert(new Set(keysBefore).size < before.length, 'repro starts with a collision');

reconcile(slots, cells);
const after = homes(slots, cells);
const keysAfter = after.map((h) => h.x + ',' + h.y);
assert(new Set(keysAfter).size === after.length, 'after reconcile all homes unique, got ' + keysAfter.join(' | '));
assert(after.length === 5, 'still 5 filled homes');
assert(slots[2].x == null && slots[2].y == null, 'colliding override cleared on slot2');

if (!process.exitCode) console.log('mls map homes audit OK');
