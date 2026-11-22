/**
 * Duplicate gradient declarations with `in oklch` color interpolation
 * (sanyam tip: far hues stay vivid mid-blend instead of muddy sRGB grey).
 *
 * Keeps the original declaration as fallback; adds a second with oklch.
 * Skips masks like linear-gradient(#fff 0 0) and already-interpolated gradients.
 *
 * Usage: node scripts/oklch_gradients.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cssDir = path.join(root, 'static', 'css');

const GRAD_RE = /\b((?:repeating-)?(?:linear|radial|conic)-gradient)\(/gi;
const HAS_INTERP = /\bin\s+(?:oklch|oklab|lab|lch|srgb|srgb-linear|hsl|hwb|xyz|display-p3)\b/i;
const MASK_WHITE = /^\s*#fff(?:fff)?\s+0\s+0\s*$/i;
const PROP_PREFIX =
  /(?:^|[;\{\}])\s*((?:background(?:-image)?|border-image(?:-source)?|mask(?:-image)?|-webkit-mask(?:-image)?|fill|stroke)\s*:\s*)([^;{}]+)/gi;

function findClosingParen(s, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function injectOklchIntoGradientCall(fullCall) {
  // fullCall includes trailing ')'
  const open = fullCall.indexOf('(');
  if (open < 0) return null;
  const name = fullCall.slice(0, open);
  const inner = fullCall.slice(open + 1, -1);
  if (HAS_INTERP.test(inner)) return null;
  if (MASK_WHITE.test(inner.trim())) return null;

  // Split first arg vs rest only when first arg is angle / "to …" / shape — else prepend.
  const trimmed = inner.trimStart();
  let injected;

  const angleOrTo = /^(?:-?\d*\.?\d+(?:deg|grad|rad|turn)|to\s+(?:top|bottom|left|right)(?:\s+(?:top|bottom|left|right))?)/i;
  const radialShape =
    /^(?:circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|at\s)/i;
  const conicFrom = /^from\s+/i;

  if (angleOrTo.test(trimmed) || radialShape.test(trimmed) || conicFrom.test(trimmed)) {
    // Insert ` in oklch` before the first comma that separates direction from color stops.
    // Direction can contain nested functions rarely; find top-level comma.
    let depth = 0;
    let comma = -1;
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0) {
        comma = i;
        break;
      }
    }
    if (comma < 0) {
      // single-arg gradient — still add interpolation
      injected = `${name}(in oklch, ${inner.trim()})`;
    } else {
      const head = inner.slice(0, comma).trimEnd();
      const tail = inner.slice(comma); // starts with comma
      injected = `${name}(${head} in oklch${tail})`;
    }
  } else {
    injected = `${name}(in oklch, ${inner.trim()})`;
  }
  return injected;
}

function rewriteGradientValue(value) {
  if (!/\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.test(value)) return null;

  let out = '';
  let i = 0;
  let changed = false;
  while (i < value.length) {
    GRAD_RE.lastIndex = i;
    const m = GRAD_RE.exec(value);
    if (!m) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, m.index);
    const openParen = m.index + m[0].length - 1;
    const close = findClosingParen(value, openParen);
    if (close < 0) {
      out += value.slice(m.index);
      break;
    }
    const call = value.slice(m.index, close + 1);
    const next = injectOklchIntoGradientCall(call);
    if (next) {
      out += next;
      changed = true;
    } else {
      out += call;
    }
    i = close + 1;
  }
  return changed ? out : null;
}

function transformCss(text) {
  // Walk property matches; if value has gradients, emit original + oklch duplicate.
  // Avoid double-processing already-paired declarations.
  let out = '';
  let last = 0;
  PROP_PREFIX.lastIndex = 0;
  let m;
  while ((m = PROP_PREFIX.exec(text)) !== null) {
    const fullStart = m.index;
    // m[0] may start with ; or { — find property start
    const lead = m[0].match(/^[^a-zA-Z-]*/)?.[0] || '';
    const propStart = fullStart + lead.length;
    const prop = m[1];
    const value = m[2];
    const declEnd = propStart + prop.length + value.length;

    // Skip if next non-ws sibling already looks like our oklch duplicate of same prop
    const after = text.slice(declEnd);
    const alreadyPaired = new RegExp(
      `^\\s*;\\s*${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^;{}]*\\bin\\s+oklch\\b`,
      'i'
    ).test(after);
    if (alreadyPaired || HAS_INTERP.test(value)) {
      continue;
    }

    const oklchVal = rewriteGradientValue(value);
    if (!oklchVal || oklchVal === value) continue;

    out += text.slice(last, declEnd);
    out += `; ${prop}${oklchVal}`;
    last = declEnd;
  }
  out += text.slice(last);
  return out;
}

function listCssFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter(
      (n) =>
        n.endsWith('.css') &&
        !n.endsWith('.min.css') &&
        n !== 'app_shell_bundle.min.css'
    )
    .map((n) => path.join(dir, n));
}

let files = 0;
let bytes = 0;
for (const file of listCssFiles(cssDir)) {
  const before = fs.readFileSync(file, 'utf8');
  const after = transformCss(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    files++;
    bytes += after.length - before.length;
    console.log('updated', path.relative(root, file), `(+${after.length - before.length} bytes)`);
  }
}
console.log(`done: ${files} files, net +${bytes} bytes`);
