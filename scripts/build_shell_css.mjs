#!/usr/bin/env node
/**
 * Concatenate + minify critical shell CSS into one long-cacheable file.
 * Sources (edit these):
 *   static/css/app_shell.css
 *   static/css/mobile_layout.css
 *   static/css/ui_motion.css
 * Output:
 *   static/css/app_shell_bundle.min.css
 *
 * Usage (repo root):
 *   node scripts/build_shell_css.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssDir = path.join(root, 'static', 'css');
const sources = ['app_shell.css', 'mobile_layout.css', 'ui_motion.css'];
const outfile = path.join(cssDir, 'app_shell_bundle.min.css');
const tmp = path.join(os.tmpdir(), `ggen_shell_css_${process.pid}.css`);

const parts = sources.map((name) => {
  const p = path.join(cssDir, name);
  if (!fs.existsSync(p)) {
    console.error('Missing', p);
    process.exit(1);
  }
  return `/* === ${name} === */\n` + fs.readFileSync(p, 'utf8');
});
fs.writeFileSync(tmp, parts.join('\n\n'), 'utf8');

const r = spawnSync(
  'npx',
  ['--yes', 'esbuild', tmp, '--minify', `--outfile=${outfile}`],
  { cwd: root, stdio: 'inherit', shell: true },
);
try {
  fs.unlinkSync(tmp);
} catch (_) {}
if (r.status !== 0) process.exit(r.status || 1);
const st = fs.statSync(outfile);
console.log('Wrote', outfile, `(${st.size} bytes)`);
