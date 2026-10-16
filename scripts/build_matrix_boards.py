#!/usr/bin/env python3
"""Build published /tm + /dm JSON boards (gzip) for snappy cold opens.

Writes (committed under data/published/matrix_boards/):
  tag_matrix_v8_{LANG}.json.gz
  debuff_matrix_v14_{LANG}.json.gz

Same payload shape/CDN URLs as the live API (look/features unchanged).
Railway serves these from disk on first miss — no boot prewarm, no extra egress
beyond the same gzip JSON browsers already download for /tm /dm.

Usage (Flask must be running for --base; preferred):
  python scripts/build_matrix_boards.py
  python scripts/build_matrix_boards.py --base http://127.0.0.1:5000
  python scripts/build_matrix_boards.py --lang EN --lang JA

Rebuild after MasterData / trait changes that affect matrix boards.

Parity gate (Oct 2026): after fetching every locale, unit ID sets for the same
board kind must match across langs. A short EN board (empty LANG / resolve_tags
miss) used to ship while JA/TW/HK were complete — this script now retries the
short locale(s) and refuses to write mismatched published files.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'data', 'published', 'matrix_boards')
TAG_V = 8
DEBUFF_V = 14
LANGS_DEFAULT = ('EN', 'JA', 'TW', 'HK')
PARITY_RETRIES = 3
PARITY_RETRY_SLEEP_S = 2.0


def _fetch(base: str, path: str) -> dict:
    url = base.rstrip('/') + path
    req = urllib.request.Request(url, headers={'Accept-Encoding': 'identity', 'User-Agent': 'build_matrix_boards'})
    with urllib.request.urlopen(req, timeout=300) as r:
        raw = r.read()
    return json.loads(raw.decode('utf-8'))


def _write_gz(path: str, payload: dict) -> int:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    with gzip.open(path, 'wb', compresslevel=9) as f:
        f.write(raw)
    return len(raw)


def _collect_entity_ids(payload: dict) -> set[str]:
    """Unique unit/supporter card ids on a matrix board (locale-independent coverage)."""
    out: set[str] = set()

    def walk(obj):
        if isinstance(obj, dict):
            eid = obj.get('id')
            # Lean matrix cards always carry rarity + thum (or rarity_sort)
            if eid is not None and (
                'rarity' in obj or 'rarity_sort' in obj or 'thum' in obj or 'debuffs' in obj
            ):
                out.add(str(eid))
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for x in obj:
                walk(x)

    if isinstance(payload, dict):
        for row in payload.get('rows') or []:
            walk(row)
    return out


def _parity_report(by_lang: dict[str, set[str]]) -> list[str]:
    """Return human lines describing locale coverage mismatches (empty if OK)."""
    if len(by_lang) < 2:
        return []
    langs = sorted(by_lang.keys())
    union: set[str] = set()
    for s in by_lang.values():
        union |= s
    lines = []
    for lc in langs:
        miss = sorted(union - by_lang[lc])
        if miss:
            preview = ', '.join(miss[:12])
            more = f' (+{len(miss) - 12} more)' if len(miss) > 12 else ''
            lines.append(
                f'{lc}: {len(by_lang[lc])} ids, missing {len(miss)} vs union '
                f'({preview}{more})'
            )
    return lines


def _fetch_board(base: str, kind: str, ver: int, lc: str) -> dict:
    path_q = f'/api/{kind}_matrix?lang={lc}&sv={ver}&live=1'
    return _fetch(base, path_q)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    ap = argparse.ArgumentParser(description='Publish /tm+/dm matrix boards to data/published/matrix_boards/')
    ap.add_argument('--base', default='http://127.0.0.1:5000', help='Local Flask base (uses ?live=1)')
    ap.add_argument('--lang', action='append', dest='langs', help='Locale (repeatable). Default: EN JA TW HK')
    ap.add_argument(
        '--skip-parity',
        action='store_true',
        help='Allow writing boards even when locale ID sets differ (not recommended)',
    )
    args = ap.parse_args()
    langs = [x.upper() for x in (args.langs or list(LANGS_DEFAULT))]
    for i, L in enumerate(langs):
        if L == 'JP':
            langs[i] = 'JA'
    # Dedupe, keep order; build EN last so other locales warm LANG first.
    seen = set()
    ordered = []
    for lc in langs:
        if lc not in seen:
            seen.add(lc)
            ordered.append(lc)
    if 'EN' in seen and ordered[-1] != 'EN':
        ordered = [x for x in ordered if x != 'EN'] + ['EN']
    langs = ordered

    print(f'OUT {OUT_DIR}', flush=True)
    print(f'BASE {args.base} (live=1)', flush=True)
    print(f'LANGS {" ".join(langs)}', flush=True)

    # Health gate
    t0 = time.time()
    while time.time() - t0 < 180:
        try:
            h = _fetch(args.base, '/health')
            if h.get('ok') and not h.get('booting'):
                break
        except Exception:
            pass
        time.sleep(2)
    else:
        print('ERROR: Flask /health not ready — start python wsgi.py first.', file=sys.stderr)
        return 1

    # Warm browse + one live matrix so LANG maps are touched before EN publish.
    print('WARM /api/units + live tag_matrix …', flush=True)
    try:
        _fetch(args.base, f'/api/units?lang={langs[0]}')
    except Exception as e:
        print(f'  WARN warm units: {e}', flush=True)
    try:
        _fetch_board(args.base, 'tag', TAG_V, langs[0])
    except Exception as e:
        print(f'  WARN warm tag_matrix: {e}', flush=True)

    payloads: dict[tuple[str, str], dict] = {}
    id_sets: dict[str, dict[str, set[str]]] = {'tag': {}, 'debuff': {}}

    for kind, ver in (('tag', TAG_V), ('debuff', DEBUFF_V)):
        for lc in langs:
            print(f'BUILD {kind}/{lc} …', flush=True)
            t1 = time.time()
            try:
                payload = _fetch_board(args.base, kind, ver, lc)
            except urllib.error.HTTPError as e:
                print(f'  FAIL HTTP {e.code}: {e}', file=sys.stderr)
                return 1
            except Exception as e:
                print(f'  FAIL {e}', file=sys.stderr)
                return 1
            rows = payload.get('rows') if isinstance(payload, dict) else None
            if not isinstance(rows, list) or not rows:
                print(f'  FAIL empty rows for {kind}/{lc}', file=sys.stderr)
                return 1
            ids = _collect_entity_ids(payload)
            payloads[(kind, lc)] = payload
            id_sets[kind][lc] = ids
            print(
                f'  OK rows={len(rows)} entities={len(ids)} '
                f'{time.time() - t1:.1f}s',
                flush=True,
            )

        # Cross-locale parity: same board kind must cover the same entity ids.
        report = _parity_report(id_sets[kind])
        attempt = 0
        while report and attempt < PARITY_RETRIES:
            attempt += 1
            print(
                f'PARITY {kind} mismatch (retry {attempt}/{PARITY_RETRIES}):',
                flush=True,
            )
            for line in report:
                print(f'  {line}', flush=True)
            union: set[str] = set()
            for s in id_sets[kind].values():
                union |= s
            short = [lc for lc, s in id_sets[kind].items() if s != union]
            time.sleep(PARITY_RETRY_SLEEP_S)
            for lc in short:
                print(f'RETRY {kind}/{lc} …', flush=True)
                t1 = time.time()
                try:
                    payload = _fetch_board(args.base, kind, ver, lc)
                except Exception as e:
                    print(f'  FAIL retry {e}', file=sys.stderr)
                    return 1
                ids = _collect_entity_ids(payload)
                payloads[(kind, lc)] = payload
                id_sets[kind][lc] = ids
                print(f'  OK entities={len(ids)} {time.time() - t1:.1f}s', flush=True)
            report = _parity_report(id_sets[kind])

        if report:
            print(f'ERROR: {kind} matrix locale coverage still mismatched:', file=sys.stderr)
            for line in report:
                print(f'  {line}', file=sys.stderr)
            if not args.skip_parity:
                print(
                    'Refusing to write published boards. Fix LANG/master or re-run '
                    'after Flask reload. Use --skip-parity only if intentional.',
                    file=sys.stderr,
                )
                return 1
            print('WARN: --skip-parity set; writing mismatched boards anyway.', flush=True)
        else:
            n = len(next(iter(id_sets[kind].values()))) if id_sets[kind] else 0
            print(f'PARITY {kind} OK — {n} entities across {len(id_sets[kind])} locale(s)', flush=True)

    wrote = 0
    for kind, ver in (('tag', TAG_V), ('debuff', DEBUFF_V)):
        for lc in langs:
            payload = payloads[(kind, lc)]
            out = os.path.join(OUT_DIR, f'{kind}_matrix_v{ver}_{lc}.json.gz')
            blob = json.dumps(payload)
            if 'cdn.jsdelivr.net' not in blob and '/static/images/' not in blob:
                print(f'  WARN: no image paths found in {kind}/{lc}', flush=True)
            nbytes = _write_gz(out, payload)
            gz = os.path.getsize(out)
            print(
                f'WRITE {kind}/{lc} json={nbytes:,}B gz={gz:,}B → {os.path.relpath(out, ROOT)}',
                flush=True,
            )
            wrote += 1

    print(f'Done — {wrote} board file(s). Commit data/published/matrix_boards/ before deploy.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
