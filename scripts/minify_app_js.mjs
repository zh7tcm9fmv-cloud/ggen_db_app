#!/usr/bin/env node
/**
 * Minify SPA /calc /mls engines via esbuild (production prefers *.min.js; Railway 404s sources).
 * Usage (from repo root):
 *   node scripts/minify_app_js.mjs
 *
 * After CSS source edits, also rebuild the cold shell bundle:
 *   node scripts/build_shell_css.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobs = [
  ['app.js', 'app.min.js'],
  ['unit_holo_card.js', 'unit_holo_card.min.js'],
  ['ml_sim.js', 'ml_sim.min.js'],
  ['ml_sim_rules.js', 'ml_sim_rules.min.js'],
  ['msy_dc_engine.js', 'msy_dc_engine.min.js'],
  ['msy_dc_worker.js', 'msy_dc_worker.min.js'],
];

for (const [srcName, outName] of jobs) {
  const infile = path.join(root, 'static', 'js', srcName);
  const outfile = path.join(root, 'static', 'js', outName);
  const r = spawnSync(
    'npx',
    ['--yes', 'esbuild', infile, '--minify', `--legal-comments=none`, `--outfile=${outfile}`],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
  console.log('Wrote', outfile);
}
