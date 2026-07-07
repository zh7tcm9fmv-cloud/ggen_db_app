#!/usr/bin/env python3
"""Quick MSY filtered-browse latency check."""
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import meta_synergy_rank as msr

import app as flask_app

flask_app.app.app_context().push()

t0 = time.perf_counter()
msr.prewarm_default_rankings()
print('prewarm', round(time.perf_counter() - t0, 2), 's')
time.sleep(8)
idx = msr._ensure_msy_sort_damage_index('EN')
print('sort index size', len(idx))

base = dict(
    lb_tier=3,
    top_pilots=10,
    def_unit_override=None,
    def_char_override=None,
    page=1,
    per_page=50,
    rank_mode='super_crit',
    def_tier=1,
)


def bench(label, **extra):
    msr._rankings_browse_payload_cache.clear()
    kw = {**base, **extra}
    t0 = time.perf_counter()
    r = msr.build_meta_synergy_rankings_cached('EN', **kw)
    dt = time.perf_counter() - t0
    g = r.get('groups') or []
    print(
        f'{label}: {dt:.3f}s groups={len(g)} total={r.get("total")} '
        f'incomplete={r.get("cache_incomplete")} index_only={sum(1 for x in g if x.get("index_only"))} '
        f'with_pilots={sum(1 for x in g if (x.get("pilots") or []))}'
    )


bench('default full')
bench('default summary', summary=True)
bench('role=Ace summary', summary=True, role='Ace Unit')
bench('role=Ace full', role='Ace Unit')
bench('rarity=UR summary', summary=True, rarity='UR')
bench('role=Ace summary warm', summary=True, role='Ace Unit')
