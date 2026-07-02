#!/usr/bin/env python3
"""Notify the site that a new Ko-fi post was published (shows header badge for visitors).

Usage (after posting on Ko-fi):
  set KOFI_PUBLISH_SECRET=your-secret
  python scripts/publish_kofi_update.py --title "March tier list preview"
  python scripts/publish_kofi_update.py --title "Update" --url "https://ko-fi.com/post/abc123"

Railway: add KOFI_PUBLISH_SECRET to environment variables, then run locally or via curl:
  curl -X POST https://ggendb.up.railway.app/api/kofi/publish \\
    -H "Authorization: Bearer YOUR_SECRET" \\
    -H "Content-Type: application/json" \\
    -d "{\"title\":\"My new post\"}"
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

try:
    from dotenv import load_dotenv

    load_dotenv(
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'),
        override=True,
        encoding='utf-8-sig',
    )
except ImportError:
    pass


def main() -> int:
    p = argparse.ArgumentParser(description='Publish Ko-fi post notice to GGen DB')
    p.add_argument('--base', default=os.environ.get('GGEN_PUBLISH_BASE', 'http://127.0.0.1:5050'))
    p.add_argument('--title', default='', help='Optional post title (stored for debugging)')
    p.add_argument('--url', default='', help='Optional direct Ko-fi post URL')
    p.add_argument('--secret', default=os.environ.get('KOFI_PUBLISH_SECRET', ''))
    args = p.parse_args()
    secret = (args.secret or '').strip()
    if not secret:
        print('Set KOFI_PUBLISH_SECRET in .env or pass --secret', file=sys.stderr)
        return 1
    body = {'title': args.title.strip(), 'post_url': args.url.strip()}
    req = urllib.request.Request(
        args.base.rstrip('/') + '/api/kofi/publish',
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + secret,
        },
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            out = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'replace')[:500]
        print(f'HTTP {e.code}: {detail}', file=sys.stderr)
        return 1
    except Exception as e:
        print('Request failed:', e, file=sys.stderr)
        return 1
    print(json.dumps(out, indent=2))
    if out.get('content_fp'):
        print('\nVisitors will see the Ko-fi button notice until they click it.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
