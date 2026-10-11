#!/usr/bin/env node
/**
 * Minify static/js/app.js → static/js/app.min.js via esbuild.
 * Usage (from repo root):
 *   npx --yes esbuild static/js/app.js --minify --outfile=static/js/app.min.js
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
];

for (const [srcName, outName] of jobs) {
  const infile = path.join(root, 'static', 'js', srcName);
  const outfile = path.join(root, 'static', 'js', outName);
  const r = spawnSync(
    'npx',
    ['--yes', 'esbuild', infile, '--minify', `--outfile=${outfile}`],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  if (r.status !== 0) {
    process.exit(r.status || 1);
  }
  console.log('Wrote', outfile);
}
