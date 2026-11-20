#!/usr/bin/env node
/**
 * Opaque pack shell for small owned engines (gge-sim class).
 * Reads *.min.js → writes *.pack.js (base64 + new Function).
 * Production prefers .pack.js; Railway 404s .js/.min when pack exists.
 *
 * Usage (from repo root, after minify):
 *   node scripts/pack_feature_js.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobs = [
  ['ml_sim_rules.min.js', 'ml_sim_rules.pack.js'],
  ['gacha_sim.min.js', 'gacha_sim.pack.js'],
];

for (const [srcName, outName] of jobs) {
  const infile = path.join(root, 'static', 'js', srcName);
  const outfile = path.join(root, 'static', 'js', outName);
  if (!fs.existsSync(infile)) {
    console.error('Missing', infile, '— run node scripts/minify_app_js.mjs first');
    process.exit(1);
  }
  const raw = fs.readFileSync(infile);
  const b64 = raw.toString('base64');
  const shell =
    '(function(){\n' +
    'try{\n' +
    'var _b64="' +
    b64 +
    '";\n' +
    'var _decoded;\n' +
    "if(typeof window!=='undefined'&&typeof window.atob==='function'){\n" +
    'var binStr=window.atob(_b64);\n' +
    'var len=binStr.length;\n' +
    'var bytes=new Uint8Array(len);\n' +
    'for(var i=0;i<len;i++)bytes[i]=binStr.charCodeAt(i);\n' +
    "_decoded=new window.TextDecoder('utf-8').decode(bytes);\n" +
    '}else{\n' +
    "_decoded=Buffer.from(_b64,'base64').toString('utf-8');\n" +
    '}\n' +
    'var _appFn=new Function(_decoded);\n' +
    '_appFn();\n' +
    '}catch(e){\n' +
    'console.error("Initialization Failed.",e);\n' +
    '}\n' +
    '})();\n';
  fs.writeFileSync(outfile, shell, 'utf8');
  console.log('Wrote', outfile, '(' + Math.round(fs.statSync(outfile).size / 1024) + ' KB)');
}
