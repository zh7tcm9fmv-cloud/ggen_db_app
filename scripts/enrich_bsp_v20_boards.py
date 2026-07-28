#!/usr/bin/env python3
"""Enrich published BSP v19 groups with skills-off + defender boards → v20.

Reads the latest legacy published cache (v19 preferred), attaches
``rankings_no_active_skills`` / ``rankings_defender`` via
``enrich_group_skills_off_and_defender``, and writes
``msy__v20_bsp_dc_*`` with ``bsp_rules_version`` = current rules.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import meta_synergy_rank as msy  # noqa: E402


def _load_groups(path: str) -> dict:
    with gzip.open(path, 'rt', encoding='utf-8') as f:
        return json.load(f)


def _find_source(lang: str, top_pilots: int) -> tuple[str, dict]:
    # Prefer v19 (or other legacy) full catalog; fall back to current tag if present.
    tags = list(msy._BSP_LEGACY_PUBLISHED_TAGS) + [msy._BSP_PUBLISHED_CACHE_TAG]
    store_n = int(getattr(msy, '_BSP_STORE_TOP_PILOTS', top_pilots) or top_pilots)
    pub_dir = os.path.join(ROOT, 'data', 'published')
    for tag in tags:
        key = (tag, lang or 'EN', 3, store_n, None, None)
        path = msy._msy_published_path(key)
        if not os.path.isfile(path):
            # Also try basename scan for older tp10 keys
            base = msy._msy_cache_basename(key)
            alt = os.path.join(pub_dir, base)
            path = alt if os.path.isfile(alt) else path
        if os.path.isfile(path):
            data = _load_groups(path)
            if data.get('groups'):
                return path, data
    raise FileNotFoundError(f'No published BSP cache found for lang={lang} top={top_pilots}')


def _write_catalog(lang: str, top_pilots: int, groups: list, pilot_count: int) -> str:
    cache_key = msy._bsp_published_cache_key(lang, {'lb_tier': 3, 'top_pilots': top_pilots})
    result = {
        'groups': groups,
        'total_pilot_candidates': pilot_count,
    }
    path = msy.save_published_master_cache(
        cache_key, result, build_engine=msy._BSP_DC_BUILD_ENGINE,
    )
    msy._save_master_to_disk(cache_key, {
        **result,
        'build_engine': msy._BSP_DC_BUILD_ENGINE,
        'bsp_rules_version': msy._BSP_DC_RULES_VERSION,
    })
    return path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--lang', default='EN')
    ap.add_argument('--top-pilots', type=int, default=20)
    ap.add_argument('--limit', type=int, default=0, help='Enrich only first N units (smoke)')
    ap.add_argument('--unit-id', action='append', default=[], help='Only enrich these unit ids')
    ap.add_argument('--checkpoint-every', type=int, default=25, help='Write catalog every N units')
    ap.add_argument('--skip-existing', action='store_true',
                    help='Skip units that already have skills-off (and defender if Defense)')
    ap.add_argument('--defense-only', action='store_true',
                    help='Only enrich Defense-role units (stale Top Def boards)')
    ap.add_argument('--defender-only', action='store_true',
                    help='Rebuild rankings_defender only (skip skills-off recompute)')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    src_path, data = _find_source(args.lang, args.top_pilots)
    # Prefer already-partial v20 as working set when present
    try:
        v20_key = msy._bsp_published_cache_key(args.lang, {'lb_tier': 3, 'top_pilots': args.top_pilots})
        v20_path = msy._msy_published_path(v20_key)
        if os.path.isfile(v20_path) and os.path.abspath(v20_path) != os.path.abspath(src_path):
            v20 = _load_groups(v20_path)
            if v20.get('groups'):
                data = v20
                src_path = v20_path
    except Exception:
        pass

    by_uid = {}
    for g in data.get('groups') or []:
        uid = msy._app().normalize_id((g.get('unit') or {}).get('id'))
        if uid:
            by_uid[uid] = g
    print(f'Source: {src_path} ({len(by_uid)} groups, rules={data.get("bsp_rules_version")})', flush=True)

    want = {msy._app().normalize_id(u) for u in (args.unit_id or []) if u}
    work_uids = list(by_uid.keys())
    if want:
        work_uids = [u for u in work_uids if u in want]
        print(f'Filtered to {len(work_uids)} requested units', flush=True)
    if args.defense_only:
        work_uids = [u for u in work_uids if msy._unit_is_defense_role(u)]
        print(f'Defense-only filter: {len(work_uids)} units', flush=True)
    if args.limit and args.limit > 0:
        work_uids = work_uids[: args.limit]
        print(f'Limited to {len(work_uids)} units', flush=True)

    exclude = set()
    pilot_ids = msy._pilot_pool_ids()
    t0 = time.time()
    done = 0
    for i, uid in enumerate(work_uids):
        g = by_uid[uid]
        if args.skip_existing:
            off_ver = int(g.get('skills_off_board_version') or 0)
            def_ver = int((g.get('rankings_defender') or {}).get('board_version') or 0)
            has_off = (
                off_ver >= int(msy._SKILLS_OFF_BOARD_VERSION)
                and bool((g.get('rankings_no_active_skills') or {}).get('super_crit', {}).get('pilots'))
            )
            need_def = msy._unit_is_defense_role(uid)
            has_def = (
                def_ver >= int(msy._DEFENDER_BOARD_VERSION)
                and bool(((g.get('rankings_defender') or {}).get('defender') or {}).get('pilots'))
            )
            if has_off and (has_def or not need_def):
                continue
        try:
            if args.defender_only:
                eg = msy.enrich_group_defender_rankings(
                    g, args.lang, pilot_ids=pilot_ids, exclude=exclude, force=True,
                )
            else:
                eg = msy.enrich_group_skills_off_and_defender(
                    g, args.lang, lite=False, rank_mode='super_crit', def_tier=3,
                    pilot_ids=pilot_ids, exclude=exclude, force=True,
                )
        except Exception as e:
            print(f'  FAIL {uid}: {e}', flush=True)
            eg = g
        by_uid[uid] = eg
        done += 1
        if done % 5 == 0 or (i + 1) == len(work_uids):
            off = bool((eg.get('rankings_no_active_skills') or {}).get('super_crit', {}).get('pilots'))
            deff = bool(((eg.get('rankings_defender') or {}).get('defender') or {}).get('pilots'))
            print(
                f'  [{i + 1}/{len(work_uids)}] {uid} skills_off={off} defender={deff} '
                f'({time.time() - t0:.1f}s)',
                flush=True,
            )
        if (
            not args.dry_run
            and args.checkpoint_every > 0
            and done % int(args.checkpoint_every) == 0
        ):
            path = _write_catalog(
                args.lang, args.top_pilots, list(by_uid.values()),
                data.get('total_pilot_candidates') or len(pilot_ids),
            )
            print(f'  checkpoint -> {path}', flush=True)

    if args.dry_run:
        print('Dry run — not writing', flush=True)
        return 0

    path = _write_catalog(
        args.lang, args.top_pilots, list(by_uid.values()),
        data.get('total_pilot_candidates') or len(pilot_ids),
    )
    print(f'Wrote {path} (rules={msy._BSP_DC_RULES_VERSION}, groups={len(by_uid)}, enriched={done})', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
