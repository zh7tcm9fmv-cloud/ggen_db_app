#!/usr/bin/env python3
"""Sync official Unit Assembly drop-rate JSON into data/published/official_gasha/.

Official site (detail page — only gasha_id changes):
  https://web.gl.eternal.channel.or.jp/en/gasha/detail.html?gasha_id={GASHA_ID}

CDN API (what we fetch):
  https://web.gl.eternal.channel.or.jp/server_assets/api/gasha_list_{lang}.json
  https://web.gl.eternal.channel.or.jp/server_assets/api/gasha_proportion_{gashaId}_{lang}.json

Lang map (official): ja=1, en=2, tw=3, hk=4

After a new banner lands in MasterData, run this once (no manual gasha_id needed):
  python scripts/sync_official_gasha_proportions.py

The banner timeline also lazy-fetches missing proportion files on first view.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from gasha_official_rates import (  # noqa: E402
    OFFICIAL_GASHA_BASE,
    _OFFICIAL_FETCH_HEADERS,
    fetch_official_proportion,
    official_gasha_detail_url,
)

OUT_DIR = os.path.join(ROOT, 'data', 'published', 'official_gasha')
LANG_NUM = {'JA': 1, 'EN': 2, 'TW': 3, 'HK': 4}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=_OFFICIAL_FETCH_HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def _master_gasha_ids() -> set[str]:
    """All gasha ids from bundled EN master (covers new banners before officialsite list updates)."""
    paths = [
        os.path.join(ROOT, 'data', 'EN', 'master', 'm_gasha.json'),
    ]
    try:
        import app as A  # noqa: WPS433

        base = getattr(A, 'BASE_DIR', None)
        if base:
            paths.insert(0, os.path.join(base, 'm_gasha.json'))
    except Exception:
        pass
    ids: set[str] = set()
    for path in paths:
        if not os.path.isfile(path):
            continue
        try:
            with open(path, 'r', encoding='utf-8') as f:
                rows = json.load(f)
        except Exception:
            continue
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            gid = row.get('Id') or row.get('id')
            if gid is not None and str(gid) not in ('', '0'):
                ids.add(str(gid))
        if ids:
            break
    return ids


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--langs', default='EN,JA,TW,HK')
    ap.add_argument(
        '--no-master',
        action='store_true',
        help='Only sync ids listed on official gasha_list (skip m_gasha.json union).',
    )
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)
    langs = [x.strip().upper() for x in args.langs.split(',') if x.strip()]
    master_ids = set() if args.no_master else _master_gasha_ids()
    if master_ids:
        print(f'master m_gasha.json: {len(master_ids)} ids (union with official list)', flush=True)
    index = {'source': OFFICIAL_GASHA_BASE, 'langs': {}}
    for lc in langs:
        num = LANG_NUM.get(lc)
        if not num:
            print(f'skip unknown lang {lc}', flush=True)
            continue
        list_url = f'{OFFICIAL_GASHA_BASE}/server_assets/api/gasha_list_{num}.json'
        print(f'list {lc} <- {list_url}', flush=True)
        raw = fetch(list_url)
        list_path = os.path.join(OUT_DIR, f'gasha_list_{num}.json')
        with open(list_path, 'wb') as f:
            f.write(raw)
        payload = json.loads(raw.decode('utf-8'))
        banners = list(payload.get('gasha_list') or [])
        by_id: dict[str, dict] = {}
        for b in banners:
            gid = b.get('gasha_id')
            if gid is None:
                continue
            by_id[str(gid)] = b
        for gid in sorted(master_ids, key=lambda x: int(x) if x.isdigit() else 0):
            by_id.setdefault(gid, {'gasha_id': int(gid) if gid.isdigit() else gid, 'name': ''})
        saved = []
        for gid in sorted(by_id.keys(), key=lambda x: int(x) if x.isdigit() else 0):
            b = by_id[gid]
            prop = fetch_official_proportion(gid, num, save=True)
            if not prop:
                print(f'  FAIL {gid} (no proportion JSON)', flush=True)
                continue
            prop_path = os.path.join(OUT_DIR, f'gasha_proportion_{gid}_{num}.json')
            size = os.path.getsize(prop_path) if os.path.isfile(prop_path) else 0
            detail = official_gasha_detail_url(gid, lc)
            saved.append({
                'gasha_id': int(gid) if gid.isdigit() else gid,
                'name': b.get('name') or '',
                'file': os.path.basename(prop_path),
                'detail_url': detail,
            })
            print(f'  OK {gid} {b.get("name") or ""} ({size} bytes)', flush=True)
        index['langs'][lc] = {'lang_num': num, 'banners': saved}
    with open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f'Wrote {OUT_DIR}', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
