#!/usr/bin/env python3
"""
Build complete MSY v14 published master cache.

Fast mode (default): multiprocess workers + publish_build optimizations:
  - 64 pilot cap (MSY_PUBLISH_PILOT_CAP) with full 3-vigor sim
  - DEF tiers 1–3 in rankings_by_tier
  - Lite CP/PEP/no-UR variant blocks (top-pilot re-sim only)
  - Shinn/GC filters: client-side rerank from primary rankings

Use --full for legacy slow build (128 pilots, full variant pools).

Resume: --resume skips units already in the published v14 cache on disk.
"""
from __future__ import annotations

import argparse
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault('MSY_ALLOW_PYTHON_BUILD', '1')

import app  # noqa: F401 — load game data
import meta_synergy_rank as msy


def _merge_groups(existing, new_groups):
    by_uid = {}
    for g in existing or []:
        uid = msy._app().normalize_id((g.get('unit') or {}).get('id'))
        if uid:
            by_uid[uid] = g
    for g in new_groups or []:
        uid = msy._app().normalize_id((g.get('unit') or {}).get('id'))
        if uid:
            by_uid[uid] = g
    return list(by_uid.values())


def main():
    ap = argparse.ArgumentParser(description='Build MSY v14 published master cache')
    ap.add_argument('--lang', default='EN')
    ap.add_argument('--top-pilots', type=int, default=10)
    ap.add_argument('--lb-tier', type=int, default=3)
    ap.add_argument('--checkpoint', type=int, default=25, help='Save partial cache every N units')
    ap.add_argument('--workers', type=int, default=0, help='Process workers (0 = MSY_BUILD_WORKERS)')
    ap.add_argument('--resume', action='store_true', help='Skip units already in published v14 cache')
    ap.add_argument('--full', action='store_true', help='Slow legacy build (128 pilots, full variant pools)')
    args = ap.parse_args()

    lang = args.lang
    top_p = max(1, int(args.top_pilots))
    lb = max(1, int(args.lb_tier))
    checkpoint = max(1, int(args.checkpoint))
    workers = args.workers or msy._MSY_BUILD_WORKERS
    publish_build = not args.full
    use_processes = not args.full

    if workers > 0:
        os.environ['MSY_BUILD_WORKERS'] = str(workers)
        msy._MSY_BUILD_WORKERS = max(1, min(8, workers))

    cache_key = msy._master_cache_key(lang, {
        'lb_tier': lb,
        'top_pilots': top_p,
        'def_unit_override': None,
        'def_char_override': None,
    })

    unit_ids = msy._msy_rankable_unit_ids(lang)
    pilot_ids = list(msy._pilot_pool_ids())
    existing_groups = []
    if args.resume:
        disk = msy._load_master_from_disk(cache_key)
        if disk and disk.get('groups'):
            existing_groups = list(disk['groups'])
            done = {
                msy._app().normalize_id((g.get('unit') or {}).get('id'))
                for g in existing_groups
            }
            unit_ids = [u for u in unit_ids if msy._app().normalize_id(u) not in done]
            print(f'Resume: {len(existing_groups)} units cached, {len(unit_ids)} remaining')

    mode = 'FAST (publish_build + processes)' if publish_build else 'FULL (legacy slow)'
    print(
        f'MSY v14 build [{mode}]: {len(unit_ids)} units to sim, top_pilots={top_p}, '
        f'lb_tier={lb}, workers={msy._MSY_BUILD_WORKERS}, checkpoint every {checkpoint}'
    )
    if publish_build:
        print(f'  pilot cap={msy._MSY_PUBLISH_PILOT_CAP}, lite CP/PEP/no-UR variants')
    t0 = time.perf_counter()
    last_save = len(existing_groups)

    def on_progress(new_groups):
        nonlocal last_save
        merged = _merge_groups(existing_groups, new_groups)
        n = len(merged)
        if n - last_save < checkpoint:
            return
        last_save = n
        partial = {'groups': merged, 'total_pilot_candidates': len(pilot_ids)}
        path = msy.save_published_master_cache(cache_key, partial)
        msy._save_master_to_disk(cache_key, partial)
        elapsed = time.perf_counter() - t0
        print(f'  checkpoint {n}/{len(existing_groups) + len(unit_ids)} units ({elapsed:.0f}s) -> {path}')

    result = msy.build_meta_synergy_master(
        lang,
        lb_tier=lb,
        top_pilots=top_p,
        on_progress=on_progress,
        unit_ids=unit_ids,
        publish_build=publish_build,
        use_processes=use_processes,
    )
    elapsed = time.perf_counter() - t0
    groups = _merge_groups(existing_groups, result.get('groups') or [])
    result['groups'] = groups
    print(f'Built {len(groups)} unit groups in {elapsed:.0f}s ({elapsed / max(1, len(unit_ids) or 1):.1f}s/new unit)')

    path = msy.save_published_master_cache(cache_key, result)
    msy._save_master_to_disk(cache_key, result)
    print(f'Saved: {path}')
    sort_path = msy.save_published_sort_index(lang, groups)
    print(f'Sort index: {sort_path} ({len(msy._MSY_SORT_DAMAGE_INDEX.get(lang) or {})} units)')


if __name__ == '__main__':
    main()
