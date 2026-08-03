#!/usr/bin/env node
/**
 * Minify SPA bundles via esbuild.
 *   node scripts/minify_app_js.mjs
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function minify(infile, outfile) {
  const r = spawnSync(
    'npx',
    ['--yes', 'esbuild', infile, '--minify', `--outfile=${outfile}`],
    { cwd: root, stdio: 'inherit', shell: true },
  );
  if (r.status !== 0) process.exit(r.status || 1);
  console.log('Wrote', outfile);
}

minify(path.join(root, 'static', 'js', 'app.js'), path.join(root, 'static', 'js', 'app.min.js'));
minify(path.join(root, 'static', 'js', 'app_tools.js'), path.join(root, 'static', 'js', 'app_tools.min.js'));
