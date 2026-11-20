#!/usr/bin/env node
/**
 * Minify SPA /calc /mls /gacha engines via esbuild (production prefers *.min.js; Railway 404s sources).
 * Then opaque-packs small feature engines (ml_sim_rules, gacha_sim) → *.pack.js.
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
  ['gacha_sim.js', 'gacha_sim.min.js'],
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

const pack = spawnSync('node', [path.join(root, 'scripts', 'pack_feature_js.mjs')], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (pack.status !== 0) {
  process.exit(pack.status || 1);
}
