#!/usr/bin/env python3
"""Rebuild BSP for newly added units only (not top-250 incremental).

Finds rankable mobile suits missing from the published BSP cache, skips
warships + SD units, then:

  1. python scripts/build_msy_rankings_dc.py --force --unit … --loop
  2. python scripts/build_bsp_shards.py

Keep local Flask/ggen running (Playwright hits /cal).

Usage:
  python scripts/rebuild_bsp_latest_units.py
  python scripts/rebuild_bsp_latest_units.py --dry-run
  python scripts/rebuild_bsp_latest_units.py --base http://127.0.0.1:5055
  python scripts/rebuild_bsp_latest_units.py --unit 1095003460
  python scripts/rebuild_bsp_latest_units.py --fallback-highest 8
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import meta_synergy_rank as msy  # noqa: E402


def _is_mobile_suit(uid: str) -> bool:
    A = msy._app()
    info = A.unit_info_map.get(uid) or {}
    return str(info.get('body_type') or '1') != '2'


def _unit_label(uid: str, lang: str = 'EN') -> str:
    name = (msy._resolve_unit_name(uid, lang) or '').strip()
    if name.startswith('Unknown'):
        return uid
    return f'{uid} ({name})'


def latest_uncached_unit_ids(*, lang: str = 'EN') -> tuple[list[str], dict]:
    """Rankable non-SD mobile suits missing from published BSP."""
    A = msy._app()
    ck = msy._bsp_published_cache_key(lang, {'lb_tier': 3, 'top_pilots': 20})
    disk = msy._load_bsp_published_cache(ck, use_memory=False) or {}
    cached = msy._bsp_cached_unit_ids_from_disk(disk)
    rankable = [A.normalize_id(u) for u in msy._msy_rankable_unit_ids(lang)]
    rankable_ms = [
        u for u in rankable
        if u and _is_mobile_suit(u) and not msy._is_sd_unit(u)
    ]
    new_ids = [u for u in rankable_ms if u not in cached]
    # Prefer newest ids first (stable for logs / --limit).
    new_ids.sort(key=lambda x: int(x) if str(x).isdigit() else 0, reverse=True)
    meta = {
        'rankable_ms': len(rankable_ms),
        'cached': len(cached),
        'uncached': len(new_ids),
        'cache_key': list(ck) if not isinstance(ck, list) else ck,
    }
    return new_ids, meta


def highest_ms_unit_ids(n: int, *, lang: str = 'EN') -> list[str]:
    A = msy._app()
    rankable = [A.normalize_id(u) for u in msy._msy_rankable_unit_ids(lang)]
    ms = [
        u for u in rankable
        if u and _is_mobile_suit(u) and not msy._is_sd_unit(u)
    ]
    ms.sort(key=lambda x: int(x) if str(x).isdigit() else 0, reverse=True)
    return ms[: max(0, int(n))]


def _preflight_base(base: str) -> bool:
    url = base.rstrip('/') + '/'
    try:
        urllib.request.urlopen(url, timeout=5).read(64)
        return True
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f'ERROR: server not reachable at {base} — start Flask/ggen first ({e})', flush=True)
        return False


def _run(cmd: list[str]) -> int:
    print('Running:', ' '.join(cmd), flush=True)
    return subprocess.call(cmd, cwd=ROOT)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description='Rebuild published BSP for newly added units only, then refresh shards.',
    )
    ap.add_argument(
        '--base',
        default=os.environ.get('MSY_DC_BASE', 'http://127.0.0.1:5055'),
        help='Local ggen base URL for Playwright /cal (default: http://127.0.0.1:5055)',
    )
    ap.add_argument('--lang', default='EN')
    ap.add_argument(
        '--unit',
        action='append',
        default=[],
        help='Force these unit ids (repeatable). Skips auto-detect when set.',
    )
    ap.add_argument(
        '--fallback-highest',
        type=int,
        default=0,
        help='If nothing is uncached, rebuild this many highest MS ids (default: 0 = exit).',
    )
    ap.add_argument('--limit', type=int, default=0, help='Cap how many units to rebuild (0 = all).')
    ap.add_argument('--checkpoint', type=int, default=5)
    ap.add_argument('--workers', type=int, default=0, help='0 = auto by RAM')
    ap.add_argument('--dry-run', action='store_true', help='Print selected units and exit.')
    ap.add_argument('--skip-shards', action='store_true', help='Skip build_bsp_shards.py after sim.')
    ap.add_argument('--no-loop', action='store_true', help='Do not pass --loop to the builder.')
    args = ap.parse_args()

    A = msy._app()
    if args.unit:
        ids = [A.normalize_id(u) for u in args.unit if A.normalize_id(u)]
        reason = 'explicit --unit'
    else:
        ids, meta = latest_uncached_unit_ids(lang=args.lang)
        print(
            f'Published BSP: {meta["cached"]} cached / {meta["rankable_ms"]} rankable MS; '
            f'{meta["uncached"]} uncached (non-SD)',
            flush=True,
        )
        reason = 'uncached'
        if not ids and args.fallback_highest > 0:
            ids = highest_ms_unit_ids(args.fallback_highest, lang=args.lang)
            reason = f'fallback-highest {args.fallback_highest}'

    if args.limit and args.limit > 0:
        ids = ids[: int(args.limit)]

    if not ids:
        print('No latest units to rebuild (published BSP already covers catalog MS).', flush=True)
        print('Tip: pass --unit ID or --fallback-highest N to force a small resim.', flush=True)
        return 0

    print(f'Selected {len(ids)} unit(s) [{reason}]:', flush=True)
    for uid in ids:
        print(f'  {_unit_label(uid, args.lang)}', flush=True)

    if args.dry_run:
        return 0

    if not _preflight_base(args.base):
        return 1

    build = [
        sys.executable, '-u', os.path.join(ROOT, 'scripts', 'build_msy_rankings_dc.py'),
        '--base', args.base,
        '--lang', args.lang,
        '--force',
        '--checkpoint', str(max(1, int(args.checkpoint) or 5)),
        '--workers', str(int(args.workers) or 0),
    ]
    if not args.no_loop:
        build.append('--loop')
    for uid in ids:
        build.extend(['--unit', uid])

    rc = _run(build)
    if rc != 0:
        print(f'BSP sim failed (exit {rc}); skipping shards.', flush=True)
        return rc

    if args.skip_shards:
        print('Skipping shard refresh (--skip-shards).', flush=True)
        return 0

    shard = [sys.executable, '-u', os.path.join(ROOT, 'scripts', 'build_bsp_shards.py')]
    rc = _run(shard)
    if rc != 0:
        print(f'Shard refresh failed (exit {rc}).', flush=True)
        return rc

    print('Done: latest-unit BSP + shards updated under data/published/.', flush=True)
    print('Commit data/published/msy__*.json.gz and data/published/bsp_shards/ to ship live.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
