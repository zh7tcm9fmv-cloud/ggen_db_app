"""Benchmark MSY filtered browse (summary + full) after app warm."""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('GGEN_SKIP_PREBUILD', '1')

import app as A

URL_SUM = (
    '/api/meta_synergy_rankings?lang=EN&def_tier=3&lb_tier=3&top_pilots=10'
    '&page=1&per_page=10&rank_mode=super_crit&role=2&summary=1'
)
URL_FULL = URL_SUM.replace('&summary=1', '')

app = A.app
with app.test_client() as c:
    c.get(URL_SUM)
    t0 = time.monotonic()
    r = c.get(URL_SUM)
    s = time.monotonic() - t0
    d = r.get_json()
    pending = sum(1 for g in (d.get('groups') or []) if g.get('pending'))
    print('summary_warm', round(s, 3), 's', 'total', d.get('total'), 'groups', len(d.get('groups') or []), 'pending', pending)

    t0 = time.monotonic()
    r = c.get(URL_FULL)
    f = time.monotonic() - t0
    d = r.get_json()
    groups = d.get('groups') or []
    built = sum(1 for g in groups if not g.get('pending'))
    pending = sum(1 for g in groups if g.get('pending'))
    nur = 0
    for g in groups:
        if g.get('pending'):
            continue
        block = (g.get('rankings_no_ur') or {}).get('super_crit') or {}
        pilots = block.get('pilots') or []
        if pilots:
            nur = len(pilots)
            break
    print('full_warm', round(f, 3), 's', 'groups', len(groups), 'built', built, 'pending', pending, 'no_ur_pilots', nur)

    t0 = time.monotonic()
    r = c.get(URL_FULL)
    f2 = time.monotonic() - t0
    d = r.get_json()
    groups = d.get('groups') or []
    built2 = sum(1 for g in groups if not g.get('pending'))
    print('full_warm2', round(f2, 3), 's', 'built', built2, 'pending', sum(1 for g in groups if g.get('pending')))
