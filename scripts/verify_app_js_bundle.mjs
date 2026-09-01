#!/usr/bin/env node
/**
 * Pre-ship gate for static/js/app.js — syntax + critical symbol survival.
 * Sep 2026: greedy regex deleted renderUnitT/renderSuppT; node --check alone did not catch it.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appJs = path.join(root, 'static', 'js', 'app.js');
const appMin = path.join(root, 'static', 'js', 'app.min.js');

/** Top-level function declarations the browse shell must keep (runtime ReferenceError if missing). */
const REQUIRED_FUNCTIONS = [
  'applyLang',
  'tbApplyLangStatic',
  'openDetail',
  'loadCharacters',
  'loadUnits',
  'instantBrowseApply',
  'renderCharT',
  'renderCharTable',
  'renderUnitT',
  'renderUnitTable',
  'renderUnitGrid',
  'renderUnitGridStats',
  'renderUnitGridSkills',
  'renderSuppT',
  'renderSuppTable',
  'renderModT',
  'renderModTable',
  'renderStageT',
];

const REQUIRED_CONSTS = ['TB_TRASH_ICON'];

function fail(msg) {
  console.error(`verify_app_js_bundle: ${msg}`);
  process.exit(1);
}

function hasFunctionDecl(src, name) {
  const re = new RegExp(`\\bfunction\\s+${name}\\s*\\(`);
  return re.test(src);
}

function hasConstDecl(src, name) {
  const re = new RegExp(`\\bconst\\s+${name}\\s*=`);
  return re.test(src);
}

if (!fs.existsSync(appJs)) fail(`missing ${appJs}`);

const src = fs.readFileSync(appJs, 'utf8');

try {
  new vm.Script(src, { filename: 'app.js' });
} catch (e) {
  fail(`app.js syntax error: ${e.message}`);
}

const missingFns = REQUIRED_FUNCTIONS.filter((n) => !hasFunctionDecl(src, n));
if (missingFns.length) {
  fail(`app.js missing function declaration(s): ${missingFns.join(', ')}`);
}

const missingConsts = REQUIRED_CONSTS.filter((n) => !hasConstDecl(src, n));
if (missingConsts.length) {
  fail(`app.js missing const declaration(s): ${missingConsts.join(', ')}`);
}

// Production serves app.min.js — ensure it was rebuilt and still contains entrypoints.
if (!fs.existsSync(appMin)) {
  fail(`missing ${appMin} — run: node scripts/minify_app_js.mjs`);
}

const minSrc = fs.readFileSync(appMin, 'utf8');
const minMissing = ['renderUnitT', 'renderCharT', 'tbApplyLangStatic', 'TB_TRASH_ICON'].filter(
  (s) => !minSrc.includes(s),
);
if (minMissing.length) {
  fail(
    `app.min.js stale or broken (missing: ${minMissing.join(', ')}). Run: node scripts/minify_app_js.mjs`,
  );
}

const jsMtime = fs.statSync(appJs).mtimeMs;
const minMtime = fs.statSync(appMin).mtimeMs;
if (minMtime < jsMtime - 1000) {
  fail('app.min.js older than app.js — run: node scripts/minify_app_js.mjs');
}

console.log(
  `verify_app_js_bundle: OK (${REQUIRED_FUNCTIONS.length} functions, ${REQUIRED_CONSTS.length} consts)`,
);
