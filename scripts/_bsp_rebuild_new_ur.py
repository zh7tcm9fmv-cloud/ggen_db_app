#!/usr/bin/env python3
"""Rebuild BSP damage (+ skills-off + defender via assemble) for new + UR units."""
from __future__ import annotations

import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import meta_synergy_rank as msy  # noqa: E402


def selected_unit_ids():
    A = msy._app()
    ck = msy._bsp_published_cache_key('EN', {'lb_tier': 3, 'top_pilots': 20})
    disk = msy._load_bsp_published_cache(ck) or {}
    cached = msy._bsp_cached_unit_ids_from_disk(disk)
    rankable = [A.normalize_id(u) for u in msy._msy_rankable_unit_ids('EN')]
    new_ids = [u for u in rankable if u not in cached]
    ur_ids = []
    for u in rankable:
        info = A.unit_info_map.get(u) or {}
        if A.RARITY_MAP.get(str(info.get('rarity', '1')), 'N') == 'UR':
            ur_ids.append(u)
    # Preserve order: new first, then UR (dedupe). Skip SD (not rankable for Top 10).
    seen = set()
    out = []
    for u in new_ids + ur_ids:
        if u in seen or msy._is_sd_unit(u):
            continue
        seen.add(u)
        out.append(u)
    return out, new_ids, ur_ids


def _clear_archangel_skip():
    """Railway 404 skip is stale once local master data has Archangel."""
    path = os.path.join(ROOT, 'data', 'published', 'bsp_v16_permanent_skips.json')
    legacy = os.path.join(ROOT, 'data', 'published', 'bsp_v15_permanent_skips.json')
    for p in (path, legacy):
        if not os.path.isfile(p):
            continue
        try:
            import json
            with open(p, encoding='utf-8') as f:
                data = json.load(f)
            skips = data.get('skips') if isinstance(data, dict) else None
            if not isinstance(skips, dict) or '2300000100' not in skips:
                continue
            skips.pop('2300000100', None)
            with open(p, 'w', encoding='utf-8') as f:
                json.dump({'skips': skips}, f, ensure_ascii=False, indent=2)
            print(f'Cleared Archangel permanent skip from {p}', flush=True)
        except Exception as e:
            print(f'Warn: could not clear skip in {p}: {e}', flush=True)


def main():
    _clear_archangel_skip()
    ids, new_ids, ur_ids = selected_unit_ids()
    # Always include Archangel if rankable (may have been permanently skipped).
    A = msy._app()
    arch = A.normalize_id('2300000100')
    if arch and msy.unit_is_rankable(arch, 'EN') and arch not in ids:
        ids.insert(0, arch)
        if arch not in new_ids:
            new_ids.insert(0, arch)
    print(f'Selected {len(ids)} units (new={len(new_ids)} UR={len(ur_ids)})', flush=True)
    print('new:', ', '.join(new_ids), flush=True)
    base = os.environ.get('MSY_DC_BASE', 'http://127.0.0.1:5000')
    cmd = [
        sys.executable, '-u', os.path.join(ROOT, 'scripts', 'build_msy_rankings_dc.py'),
        '--base', base,
        '--lang', 'EN',
        '--force',
        '--checkpoint', '10',
        '--loop',
        '--workers', '0',
    ]
    for u in ids:
        cmd.extend(['--unit', u])
    print('Running:', ' '.join(cmd[:14]), f'... (+{len(ids)} --unit)', flush=True)
    return subprocess.call(cmd)


if __name__ == '__main__':
    raise SystemExit(main())
