/**
 * MAP sector / sniping coverage audit for /mls.
 * Run: node scripts/audit_ml_map_sectors.mjs
 * Needs local Flask on :5000 (or GGEN_BASE_URL).
 *
 * Closes the “do we even have MAP?” question with numbers:
 * - how many MAP weapons ship map_coords
 * - how many parse 選択地点 / designate N (sniping cap)
 * - sample cell counts after facing transform
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const base = (process.env.GGEN_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

function normalizeFullwidth(s) {
  return String(s || '')
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/％/g, '%')
    .replace(/＋/g, '+');
}

function maxSelFromWeapon(w) {
  const blob = normalizeFullwidth(
    [w.name, w.effect, ...(w.usage_restrictions || []), ...(w.traits || []).map((t) => (typeof t === 'string' ? t : t && (t.text || t.name)))].join(' ')
  );
  const m = blob.match(/(?:選択地点|ターゲット|designate|spots?).*?(\d+)/i);
  return m ? (parseInt(m[1], 10) || 0) : 0;
}

function worldCells(actor, coords, dir) {
  const ax = actor.x | 0;
  const ay = actor.y | 0;
  return (coords || []).map((c) => {
    const lx = c.x | 0;
    const ly = c.y | 0;
    if (dir === 1) return { x: ax + ly, y: ay + lx };
    if (dir === 3) return { x: ax - ly, y: ay - lx };
    if (dir === 2) return { x: ax + lx, y: ay + ly };
    return { x: ax - lx, y: ay - ly };
  });
}

async function main() {
  const list = await fetchJson(base + '/api/units?lang=EN&per_page=500');
  const units = list.rows || list.units || (Array.isArray(list) ? list : []);
  let mapWeapons = 0;
  let withCoords = 0;
  let emptyCoords = 0;
  let sniping = 0;
  const samples = [];

  for (const row of units.slice(0, 500)) {
    const id = row.id || row.unit_id;
    if (!id) continue;
    let detail;
    try {
      detail = await fetchJson(base + '/api/unit/' + id + '?lang=EN');
    } catch (e) {
      continue;
    }
    const weapons = detail.weapons || [];
    for (const w of weapons) {
      if (!(w.is_map || w.is_map_weapon)) continue;
      mapWeapons++;
      const coords = w.map_coords || [];
      if (coords.length) withCoords++;
      else emptyCoords++;
      const maxSel = maxSelFromWeapon(w);
      if (maxSel > 0) sniping++;
      if (samples.length < 12) {
        const cellsAlly = worldCells({ x: 10, y: 7, side: 'ally' }, coords, 3);
        samples.push({
          unit: detail.name || id,
          weapon: w.name,
          coords: coords.length,
          maxSel,
          sampleCells: cellsAlly.slice(0, 8)
        });
      }
    }
  }

  const report = {
    base,
    mapWeapons,
    withCoords,
    emptyCoords,
    snipingMaxSel: sniping,
    note:
      emptyCoords === 0
        ? 'All sampled MAP weapons have map_coords — sector paint is data-complete; remaining gap is facing/parity vs live client.'
        : emptyCoords + ' MAP weapons lack map_coords (fall back to range ring in evaluateMapWeapon).',
    samples
  };
  const out = path.join(root, 'data', 'persistent', 'ml_map_sector_audit.json');
  try {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
  } catch (e) {
    /* non-fatal */
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
