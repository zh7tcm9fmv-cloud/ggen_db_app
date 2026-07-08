#!/usr/bin/env python3
"""Build MSY v14 published master cache using Python lite damage sim (browse-fast path)."""
from __future__ import annotations

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault('MSY_ALLOW_PYTHON_BUILD', '1')

import app  # noqa: F401 — load game data
import meta_synergy_rank as msy


def _build_one(uid, pilot_ids, lang, top_pilots, lb_tier):
    try:
        return msy._build_single_unit_group(
            uid, pilot_ids, lang, lb_tier, 'super', 3, set(), top_pilots, 'super_crit',
            def_unit_override=None, def_char_override=None, def_tiers=None,
            lite=True, rank_mode='super_crit', same_role_only=False, browse_fast=True,
        )
    except Exception as e:
        print(f'MSY lite build error ({uid}): {e}')
        return None


def main():
    ap = argparse.ArgumentParser(description='Build MSY v14 published cache (Python lite sim)')
    ap.add_argument('--lang', default='EN')
    ap.add_argument('--top-pilots', type=int, default=10)
    ap.add_argument('--lb-tier', type=int, default=3)
    ap.add_argument('--limit', type=int, default=0, help='Max units (0 = all rankable)')
    ap.add_argument('--workers', type=int, default=0, help='Thread workers (0 = MSY_BUILD_WORKERS)')
    ap.add_argument('--unit', action='append', default=[], help='Single unit id (repeatable)')
    args = ap.parse_args()

    lang = args.lang
    pilot_ids = list(msy._pilot_pool_ids())
    if args.unit:
        unit_ids = [msy._app().normalize_id(u) for u in args.unit]
    else:
        unit_ids = msy._msy_rankable_unit_ids(lang)
    if args.limit and args.limit > 0:
        unit_ids = unit_ids[: args.limit]

    workers = args.workers or msy._MSY_BUILD_WORKERS
    workers = max(1, min(workers, len(unit_ids) or 1))
    top_p = max(1, int(args.top_pilots))
    lb = max(1, int(args.lb_tier))

    print(f'MSY lite published build: {len(unit_ids)} units, workers={workers}, top_pilots={top_p}')
    t0 = time.perf_counter()
    groups = []
    done = 0

    def _report(g):
        nonlocal done
        if g:
            groups.append(g)
        done += 1
        if done % 10 == 0 or done == len(unit_ids):
            elapsed = time.perf_counter() - t0
            print(f'  ... {done}/{len(unit_ids)} processed, {len(groups)} ok, {elapsed:.0f}s')

    if workers <= 1:
        for uid in unit_ids:
            g = _build_one(uid, pilot_ids, lang, top_p, lb)
            _report(g)
    else:
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futs = {
                ex.submit(_build_one, uid, pilot_ids, lang, top_p, lb): uid
                for uid in unit_ids
            }
            for fut in as_completed(futs):
                g = fut.result()
                _report(g)

    elapsed = time.perf_counter() - t0
    print(f'Built {len(groups)} unit groups in {elapsed:.0f}s')

    cache_key = msy._master_cache_key(lang, {
        'lb_tier': lb,
        'top_pilots': top_p,
        'def_unit_override': None,
        'def_char_override': None,
    })
    result = {'groups': groups, 'total_pilot_candidates': len(pilot_ids)}
    path = msy.save_published_master_cache(cache_key, result)
    msy._save_master_to_disk(cache_key, result)
    print(f'Saved: {path}')
    sort_path = msy.save_published_sort_index(lang, groups)
    print(f'Sort index: {sort_path} ({len(msy._MSY_SORT_DAMAGE_INDEX.get(lang) or {})} units)')


if __name__ == '__main__':
    main()
