#!/usr/bin/env python3
"""Sync official Unit Assembly drop-rate pages into data/published/official_gasha/.

Source: https://web.gl.eternal.channel.or.jp
  - /server_assets/api/gasha_list_{lang}.json
  - /server_assets/api/gasha_proportion_{gashaId}_{lang}.json

Lang map (official): ja=1, en=2, tw=3, hk=4
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'data', 'published', 'official_gasha')
BASE = 'https://web.gl.eternal.channel.or.jp'
LANG_NUM = {'JA': 1, 'EN': 2, 'TW': 3, 'HK': 4}

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'application/json,*/*',
    'Referer': f'{BASE}/en/gasha/officialsite.html',
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main() -> int:
    # Windows consoles often default to cp1252; names include CJK.
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--langs', default='EN,JA,TW,HK')
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)
    langs = [x.strip().upper() for x in args.langs.split(',') if x.strip()]
    index = {'source': BASE, 'langs': {}}
    for lc in langs:
        num = LANG_NUM.get(lc)
        if not num:
            print(f'skip unknown lang {lc}', flush=True)
            continue
        list_url = f'{BASE}/server_assets/api/gasha_list_{num}.json'
        print(f'list {lc} <- {list_url}', flush=True)
        raw = fetch(list_url)
        list_path = os.path.join(OUT_DIR, f'gasha_list_{num}.json')
        with open(list_path, 'wb') as f:
            f.write(raw)
        payload = json.loads(raw.decode('utf-8'))
        banners = payload.get('gasha_list') or []
        saved = []
        for b in banners:
            gid = b.get('gasha_id')
            if gid is None:
                continue
            prop_url = f'{BASE}/server_assets/api/gasha_proportion_{gid}_{num}.json'
            try:
                prop = fetch(prop_url)
            except Exception as e:
                print(f'  FAIL {gid}: {e}', flush=True)
                continue
            prop_path = os.path.join(OUT_DIR, f'gasha_proportion_{gid}_{num}.json')
            with open(prop_path, 'wb') as f:
                f.write(prop)
            saved.append({'gasha_id': gid, 'name': b.get('name') or '', 'file': os.path.basename(prop_path)})
            print(f'  OK {gid} {b.get("name")} ({len(prop)} bytes)', flush=True)
        index['langs'][lc] = {'lang_num': num, 'banners': saved}
    with open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f'Wrote {OUT_DIR}', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
