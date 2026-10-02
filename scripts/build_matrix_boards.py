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


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    ap = argparse.ArgumentParser(description='Publish /tm+/dm matrix boards to data/published/matrix_boards/')
    ap.add_argument('--base', default='http://127.0.0.1:5000', help='Local Flask base (uses ?live=1)')
    ap.add_argument('--lang', action='append', dest='langs', help='Locale (repeatable). Default: EN JA TW HK')
    args = ap.parse_args()
    langs = [x.upper() for x in (args.langs or list(LANGS_DEFAULT))]
    for i, L in enumerate(langs):
        if L == 'JP':
            langs[i] = 'JA'

    print(f'OUT {OUT_DIR}', flush=True)
    print(f'BASE {args.base} (live=1)', flush=True)

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

    wrote = 0
    for lc in langs:
        for kind, ver, path_q in (
            ('tag', TAG_V, f'/api/tag_matrix?lang={lc}&sv={TAG_V}&live=1'),
            ('debuff', DEBUFF_V, f'/api/debuff_matrix?lang={lc}&sv={DEBUFF_V}&live=1'),
        ):
            out = os.path.join(OUT_DIR, f'{kind}_matrix_v{ver}_{lc}.json.gz')
            print(f'BUILD {kind}/{lc} …', flush=True)
            t1 = time.time()
            try:
                payload = _fetch(args.base, path_q)
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
            # Sanity: published boards keep absolute CDN (or /static) image paths — same as live.
            blob = json.dumps(payload)
            if 'cdn.jsdelivr.net' not in blob and '/static/images/' not in blob:
                print(f'  WARN: no image paths found in {kind}/{lc}', flush=True)
            nbytes = _write_gz(out, payload)
            gz = os.path.getsize(out)
            print(
                f'  OK rows={len(rows)} json={nbytes:,}B gz={gz:,}B '
                f'{time.time() - t1:.1f}s → {os.path.relpath(out, ROOT)}',
                flush=True,
            )
            wrote += 1

    print(f'Done — {wrote} board file(s). Commit data/published/matrix_boards/ before deploy.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
