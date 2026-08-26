#!/usr/bin/env python3
"""Extract published BSP monolith into per-unit shards (low Railway RSS).

Run after a BSP catalog rebuild / before deploy:

  python scripts/build_bsp_shards.py

Writes to data/published/bsp_shards/<catalog>/ so the next boot can skip
the in-process monolith parse when shards are shipped with the deploy.
"""
from __future__ import annotations

import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import meta_synergy_rank as msy  # noqa: E402


def main():
    ck = msy._bsp_published_cache_key('EN', {'lb_tier': 3, 'top_pilots': 20})
    path = msy._msy_published_path(ck)
    if not os.path.isfile(path):
        print(f'Missing published BSP catalog: {path}')
        return 1
    # Force a fresh extract into the published tree (keep_groups loads monolith once).
    disk = msy._load_bsp_published_cache(ck, use_memory=False, keep_groups=True, min_rules=2)
    if not disk or not disk.get('groups'):
        print('Failed to load published BSP catalog')
        return 1
    pub_dir = msy._bsp_shard_dir_candidates(ck)[0]
    t0 = time.perf_counter()
    shard_dir, manifest = msy._bsp_write_shards_from_groups(
        ck,
        disk['groups'],
        source_path=path,
        total_pilot_candidates=disk.get('total_pilot_candidates') or 0,
        bsp_rules_version=disk.get('bsp_rules_version') or msy._BSP_DC_RULES_VERSION,
        shard_dir=pub_dir,
    )
    print(
        f'Done: {manifest.get("unit_count")} units in {round(time.perf_counter() - t0, 1)}s '
        f'-> {shard_dir}'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
