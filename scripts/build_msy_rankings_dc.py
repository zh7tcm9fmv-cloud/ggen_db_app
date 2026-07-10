#!/usr/bin/env python3
"""Build BSP published cache from live /cal (MsyDcEngine — same path as the site).

v17 (Supporters-only): Attack units store rankings_support_role from calculator pairs.
Rebuild Attack units with ``--unit-role 1`` (v16 remains fallback for other units).

v16 (rules v3): full-catalog DC rankings with deeper store (top 20), real
No UR / No Shinn / same-role variant lists from calculator pairs only.
Never merge python-lite damage into published BSP caches.

Routine formula tweaks after v16: use ``--incremental`` (top 250 + new units).
Variant-list / pool-size changes need a full-catalog rebuild (omit ``--incremental``).
"""
from __future__ import annotations

import argparse
import asyncio
import gzip
import json
import os
import sys
import time

from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# Cursor sandbox sets PLAYWRIGHT_BROWSERS_PATH to a temp dir without browsers.
if not os.environ.get('PLAYWRIGHT_BROWSERS_PATH') or 'cursor-sandbox-cache' in os.environ.get('PLAYWRIGHT_BROWSERS_PATH', ''):
    os.environ['PLAYWRIGHT_BROWSERS_PATH'] = os.path.join(
        os.environ.get('LOCALAPPDATA') or os.path.expanduser('~'), 'ms-playwright',
    )

import meta_synergy_rank as msy

EVAL_VIA_MSY_DC_JS = """
async ({ unitId, pilotIds, defTiers, lang }) => {
  return await MsyDcEngine.evalUnit(unitId, pilotIds, defTiers, {
    lang: lang,
    cpOn: true,
    pepOn: true,
  });
}
"""

PERMANENT_SKIP_PATH = os.path.join(ROOT, 'data', 'published', 'bsp_v16_permanent_skips.json')
# Carry forward known permanent skips from v15 if the v16 file is new.
_LEGACY_SKIP_PATH = os.path.join(ROOT, 'data', 'published', 'bsp_v15_permanent_skips.json')


def _load_permanent_skips():
    """Unit ids that cannot be ranked on the live DC host (e.g. 404 / not found)."""
    paths = [PERMANENT_SKIP_PATH]
    if not os.path.isfile(PERMANENT_SKIP_PATH) and os.path.isfile(_LEGACY_SKIP_PATH):
        paths.append(_LEGACY_SKIP_PATH)
    for path in paths:
        if not os.path.isfile(path):
            continue
        try:
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            continue
        skips = data.get('skips') if isinstance(data, dict) else None
        if isinstance(skips, dict) and skips:
            return {msy._app().normalize_id(k): str(v or '') for k, v in skips.items() if k}
    return {}


def _add_permanent_skip(uid, reason):
    uid = msy._app().normalize_id(uid)
    if not uid:
        return
    skips = _load_permanent_skips()
    reason = str(reason or 'permanent skip')[:240]
    if skips.get(uid) == reason:
        return
    skips[uid] = reason
    os.makedirs(os.path.dirname(PERMANENT_SKIP_PATH), exist_ok=True)
    tmp = PERMANENT_SKIP_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump({'skips': skips}, f, ensure_ascii=False, indent=2)
    os.replace(tmp, PERMANENT_SKIP_PATH)
    print(f'  permanent skip recorded: {uid} ({reason})', flush=True)


def _is_permanent_skip_error(err):
    msg = str(err or '').lower()
    return 'not found' in msg or '404' in msg


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


def _load_bsp_build_progress(cache_key, *, min_rules=None):
    """Load BSP DC build progress from disk.

    ``min_rules`` defaults to current ``_BSP_DC_RULES_VERSION`` (same-rules resume).
    Pass ``min_rules=0`` for incremental formula updates that keep long-tail rows
    from an older rules version.
    """
    if min_rules is None:
        min_rules = msy._BSP_DC_RULES_VERSION
    paths = (msy._msy_disk_path(cache_key), msy._msy_published_path(cache_key))
    best = None
    best_rules = -1
    for path in paths:
        if not os.path.isfile(path):
            continue
        try:
            with gzip.open(path, 'rt', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f'  build progress read failed ({path}): {e}')
            continue
        if data.get('build_engine') != msy._BSP_DC_BUILD_ENGINE:
            continue
        rules = int(data.get('bsp_rules_version') or 0)
        if rules < int(min_rules):
            continue
        groups = data.get('groups') or []
        if not groups:
            continue
        if rules >= best_rules:
            best = list(groups)
            best_rules = rules
    return best or []


def _load_existing_v15(lang, top_pilots, *, for_build=False, allow_stale_rules=False):
    cache_key = msy._bsp_published_cache_key(lang, {'lb_tier': 3, 'top_pilots': top_pilots})
    if for_build:
        # Mid-build checkpoints may lag the current rules version by 1–2 bumps
        # (e.g. Boost Critical regex fix). Keep progress unless --force wiped it.
        min_rules = 0 if allow_stale_rules else max(2, int(msy._BSP_DC_RULES_VERSION) - 2)
        groups = _load_bsp_build_progress(cache_key, min_rules=min_rules)
        if groups:
            label = 'any rules' if allow_stale_rules else f'rules>={min_rules}'
            print(f'Build resume: {len(groups)} units ({label})')
        return cache_key, groups
    disk = msy._load_bsp_published_cache(cache_key)
    if disk and disk.get('groups'):
        return cache_key, list(disk['groups'])
    return cache_key, []


def _save_v15(cache_key, groups, pilot_count):
    result = {'groups': groups, 'total_pilot_candidates': pilot_count}
    path = msy.save_published_master_cache(
        cache_key, result, build_engine=msy._BSP_DC_BUILD_ENGINE,
    )
    msy._save_master_to_disk(cache_key, {
        **result,
        'build_engine': msy._BSP_DC_BUILD_ENGINE,
        'bsp_rules_version': msy._BSP_DC_RULES_VERSION,
    })
    return path


async def _setup_dc_page(page, base):
    await page.goto(f'{base}/?tab=calculator', wait_until='domcontentloaded', timeout=120_000)
    await page.wait_for_function(
        '() => typeof _dcCalculateDamageWithSlot === "function"'
        ' && typeof _dcCreateEmptyAttackerSlot === "function"'
        ' && window.S && window.S.dc',
        timeout=180_000,
    )
    await page.evaluate('() => { if (typeof initDmgCalc === "function") initDmgCalc(); }')
    engine_path = os.path.join(ROOT, 'static', 'js', 'msy_dc_engine.js')
    with open(engine_path, encoding='utf-8') as f:
        engine_js = f.read()
    await page.add_script_tag(content=engine_js)
    await page.wait_for_function(
        '() => window.MsyDcEngine && typeof window.MsyDcEngine.ensureReady === "function"',
        timeout=120_000,
    )
    await page.evaluate('() => MsyDcEngine.ensureReady()')


async def _build_one_unit(page, base, uid, lang, pilot_ids, exclude, top_pilots, def_tiers, def_tier_payload):
    candidates = msy.dc_candidate_pilots_for_unit(uid, pilot_ids, exclude, lang, bsp=True)
    if not candidates:
        return None
    last_err = None
    for attempt in range(3):
        try:
            raw = await page.evaluate(
                EVAL_VIA_MSY_DC_JS,
                {
                    'unitId': uid,
                    'pilotIds': candidates,
                    'defTiers': def_tier_payload,
                    'lang': lang,
                },
            )
            break
        except Exception as e:
            last_err = e
            print(f'  retry {uid} attempt {attempt + 1}/3: {e}', flush=True)
            if attempt < 2:
                try:
                    await _setup_dc_page(page, base)
                except Exception as setup_err:
                    print(f'  tab re-setup failed: {setup_err}', flush=True)
                await asyncio.sleep(2 * (attempt + 1))
    else:
        print(f'  skip {uid}: {last_err}')
        return None
    if not raw or raw.get('error') or not raw.get('byTier'):
        err = (raw and raw.get('error')) or 'empty result'
        print(f'  skip {uid}: {err}')
        if _is_permanent_skip_error(err):
            _add_permanent_skip(uid, err)
        return None
    by_tier = {}
    for tier_key, pairs in (raw.get('byTier') or {}).items():
        py_pairs = []
        for cid, by_vigor in pairs:
            dmg_by_v = {}
            for v, d in (by_vigor or {}).items():
                if not d:
                    continue
                dt_key = int(tier_key)
                dmg_by_v[v] = {
                    **d,
                    'def_tier': dt_key,
                    'def_unit_def': def_tier_payload[str(dt_key)]['unit_def'],
                    'def_char_def': def_tier_payload[str(dt_key)]['char_def'],
                    'def_label': def_tiers[dt_key]['label'],
                }
            if dmg_by_v:
                py_pairs.append((cid, dmg_by_v))
        if py_pairs:
            by_tier[int(tier_key)] = py_pairs
    if not by_tier:
        return None
    return msy.assemble_unit_group_from_dc(
        uid, by_tier, pilot_ids, lang, top_pilots, exclude,
    )


async def build_units(base, lang, unit_ids, pilot_ids, exclude, top_pilots, def_tiers, *,
                      limit=None, on_checkpoint=None, workers=1):
    workers = max(1, min(6, int(workers or 1)))
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        pages = []
        for wi in range(workers):
            pg = await browser.new_page()
            print(f'  setup browser tab {wi + 1}/{workers}...', flush=True)
            await _setup_dc_page(pg, base)
            pages.append(pg)

        dt = 3
        stats = def_tiers[dt]
        def_tier_payload = {
            str(dt): {'unit_def': stats['unit_def'], 'char_def': stats['char_def']},
        }

        ids = unit_ids[:limit] if limit else unit_ids
        groups = []
        t0 = time.perf_counter()
        done = 0
        lock = asyncio.Lock()

        async def run_unit(i, uid, page):
            nonlocal done
            g = await _build_one_unit(
                page, base, uid, lang, pilot_ids, exclude, top_pilots, def_tiers, def_tier_payload,
            )
            async with lock:
                done += 1
                if g:
                    groups.append(g)
                    top = (g.get('pilots') or [{}])[0]
                    peak = top.get('peak_dmg') or top.get('super_crit_dmg') or top.get('score') or 0
                    print(
                        f'[{done}/{len(ids)}] {g["unit"].get("name")} '
                        f'#1 {top.get("char", {}).get("name")} {peak:,}'
                    )
                if on_checkpoint and groups and done % 25 == 0:
                    on_checkpoint(list(groups))
                if done % 20 == 0:
                    elapsed = time.perf_counter() - t0
                    rate = done / max(elapsed, 0.1)
                    eta = (len(ids) - done) / max(rate, 0.01)
                    print(f'  ... {len(groups)} groups, {elapsed:.0f}s, ETA ~{eta / 60:.0f}m')
            return g

        sem = asyncio.Semaphore(workers)

        async def bounded(i, uid):
            async with sem:
                page = pages[i % workers]
                return await run_unit(i, uid, page)

        await asyncio.gather(*[bounded(i, uid) for i, uid in enumerate(ids)])
        await browser.close()
        return groups


def main():
    ap = argparse.ArgumentParser(description='Build BSP cache from live Damage Calculator')
    ap.add_argument('--base', default=os.environ.get('MSY_DC_BASE', 'https://ggendb.up.railway.app'))
    ap.add_argument('--lang', default='EN')
    ap.add_argument(
        '--top-pilots',
        type=int,
        default=0,
        help='Pilots stored per unit (default: BSP_STORE_TOP_PILOTS / 20). UI still shows top 10.',
    )
    ap.add_argument('--limit', type=int, default=0, help='Max units (0 = all selected)')
    ap.add_argument('--unit', action='append', default=[], help='Single unit id (repeatable)')
    ap.add_argument(
        '--unit-role',
        default='',
        help='Only rebuild units with this role id (1=Attack, 2=Defense, 3=Support). '
             'Use 1 for v17 Supporters-only boards.',
    )
    ap.add_argument('--resume', action='store_true', help='Skip units already in published cache')
    ap.add_argument('--force', action='store_true', help='Ignore existing cache rows for selected units')
    ap.add_argument(
        '--incremental',
        action='store_true',
        help='v16+ formula updates: rebuild top-N + newly added/uncached only (keep long-tail cache)',
    )
    ap.add_argument(
        '--top-n',
        type=int,
        default=0,
        help='With --incremental, top-N by sort damage (default: BSP_INCREMENTAL_TOP_N / 250)',
    )
    ap.add_argument('--checkpoint', type=int, default=25, help='Save partial cache every N units')
    ap.add_argument('--workers', type=int, default=3, help='Parallel browser tabs (1-6)')
    ap.add_argument('--out', default='', help='Optional JSON debug output path')
    ap.add_argument('--loop', action='store_true', help='Auto-restart on crash until complete')
    args = ap.parse_args()

    if args.loop:
        log_path = os.path.join(ROOT, 'data', 'published', 'bsp_v17_build.log')
        attempt = 0
        while True:
            attempt += 1
            stamp = time.strftime('%Y-%m-%d %H:%M:%S')
            line = f'\n=== BSP build attempt {attempt} @ {stamp} ===\n'
            print(line, end='', flush=True)
            try:
                with open(log_path, 'a', encoding='utf-8') as lf:
                    lf.write(line)
            except PermissionError:
                # Log may be locked by an editor / previous Tee-Object — don't kill the loop.
                alt = log_path + f'.attempt{attempt}.log'
                try:
                    with open(alt, 'a', encoding='utf-8') as lf:
                        lf.write(line)
                    print(f'(log locked; wrote {alt})', flush=True)
                except Exception:
                    pass
            child = [
                sys.executable, '-u', __file__,
                '--base', args.base,
                '--lang', args.lang,
                '--top-pilots', str(int(args.top_pilots) or msy._BSP_STORE_TOP_PILOTS),
                '--checkpoint', str(max(5, int(args.checkpoint) or 10)),
                '--workers', str(args.workers),
            ]
            # Full-catalog crash recovery uses --resume. Incremental formula rebuilds
            # must re-sim top-N; only pass --resume when the user asked for it.
            if args.resume or not args.incremental:
                child.append('--resume')
            if args.incremental:
                child.append('--incremental')
            if args.top_n:
                child.extend(['--top-n', str(args.top_n)])
            if args.limit:
                child.extend(['--limit', str(args.limit)])
            child.extend(sum([['--unit', u] for u in args.unit], []))
            if args.unit_role:
                child.extend(['--unit-role', str(args.unit_role)])
            rc = os.spawnv(os.P_WAIT, sys.executable, child)
            if rc == 0:
                cache_key = msy._bsp_published_cache_key(
                    args.lang, {'lb_tier': 3, 'top_pilots': int(args.top_pilots) or msy._BSP_STORE_TOP_PILOTS},
                )
                groups = _load_bsp_build_progress(cache_key)
                done_n = len(groups)
                skip_n = len(_load_permanent_skips())
                if args.incremental:
                    selected, meta = msy._bsp_incremental_rebuild_unit_ids(
                        args.lang,
                        existing_groups=groups,
                        top_n=(args.top_n or None),
                    )
                    target = len(selected)
                    covered = sum(
                        1 for u in selected
                        if msy._app().normalize_id(u) in {
                            msy._app().normalize_id((g.get('unit') or {}).get('id'))
                            for g in groups
                        }
                        or msy._app().normalize_id(u) in _load_permanent_skips()
                    )
                    if covered >= target:
                        print(
                            f'BSP incremental complete: {covered}/{target} selected '
                            f'(cache {done_n} units, +{skip_n} permanent skips; '
                            f'top={meta["top_count"]} new={meta["new_count"]})'
                        )
                        return
                    print(
                        f'Build exited 0 but only {covered}/{target} incremental units '
                        f'(cache {done_n}, +{skip_n} skips) — restarting'
                    )
                else:
                    all_ids = msy._msy_rankable_unit_ids(args.lang)
                    role_want = str(args.unit_role or '').strip()
                    if role_want and role_want.upper() not in ('ALL', ''):
                        target_ids = [
                            u for u in all_ids
                            if str(
                                (msy._app().unit_info_map.get(msy._app().normalize_id(u)) or {})
                                .get('role', '0')
                            ) == role_want
                        ]
                    else:
                        target_ids = list(all_ids)
                    done_ids = {
                        msy._app().normalize_id((g.get('unit') or {}).get('id'))
                        for g in groups
                    }
                    skips = _load_permanent_skips()
                    covered = sum(
                        1 for u in target_ids
                        if msy._app().normalize_id(u) in done_ids
                        or msy._app().normalize_id(u) in skips
                    )
                    total = len(target_ids)
                    if covered >= total:
                        print(
                            f'BSP complete: {covered}/{total} units'
                            + (f' (role={role_want})' if role_want else '')
                            + f' (+{skip_n} permanent skips; cache {done_n})'
                        )
                        return
                    print(
                        f'Build exited 0 but only {covered}/{total} units'
                        + (f' (role={role_want})' if role_want else '')
                        + f' (+{skip_n} permanent skips) — restarting'
                    )
            else:
                print(f'Build crashed (exit {rc}), restarting in 5s...', flush=True)
            time.sleep(5)
        return

    lang = args.lang
    exclude = set()
    pilot_ids = list(msy._pilot_pool_ids())
    top_pilots = int(args.top_pilots) or int(msy._BSP_STORE_TOP_PILOTS)
    role_want = str(args.unit_role or '').strip()
    cache_key, existing_groups = _load_existing_v15(
        lang, top_pilots, for_build=True, allow_stale_rules=bool(args.incremental),
    )
    if args.force and not args.incremental:
        if role_want and role_want.upper() not in ('ALL', ''):
            # Role-scoped force: drop only matching role rows; keep other units in this tag.
            existing_groups = [
                g for g in existing_groups
                if str(
                    (msy._app().unit_info_map.get(
                        msy._app().normalize_id((g.get('unit') or {}).get('id'))
                    ) or {}).get('role', '0')
                ) != role_want
            ]
        else:
            # Full-catalog wipe. Incremental force still keeps long-tail rows.
            existing_groups = []
    done = {
        msy._app().normalize_id((g.get('unit') or {}).get('id'))
        for g in existing_groups
    }
    permanent_skips = set(_load_permanent_skips())

    if args.unit:
        unit_ids = [msy._app().normalize_id(u) for u in args.unit]
        scope_label = 'explicit'
    elif args.incremental:
        unit_ids, meta = msy._bsp_incremental_rebuild_unit_ids(
            lang,
            existing_groups=existing_groups,
            top_n=(args.top_n or None),
        )
        scope_label = (
            f'incremental top={meta["top_count"]} new={meta["new_count"]} '
            f'(of {meta["rankable_count"]} rankable)'
        )
        print(
            f'Incremental scope: rebuild {meta["selected_count"]} units '
            f'(top {meta["top_n"]} + {meta["new_count"]} newly added/uncached); '
            f'keep {meta["cached_count"]} cached long-tail rows'
        )
    else:
        unit_ids = msy._msy_rankable_unit_ids(lang)
        scope_label = 'full catalog'

    if role_want and role_want.upper() not in ('ALL', ''):
        before = len(unit_ids)
        unit_ids = [
            u for u in unit_ids
            if str((msy._app().unit_info_map.get(msy._app().normalize_id(u)) or {}).get('role', '0'))
            == role_want
        ]
        scope_label = f'{scope_label} role={role_want}'
        print(f'Unit-role filter {role_want}: {len(unit_ids)}/{before} units')

    if args.resume:
        # Formula incremental rebuilds re-sim top-N even when cached, unless --resume.
        unit_ids = [
            u for u in unit_ids
            if msy._app().normalize_id(u) not in done
            and msy._app().normalize_id(u) not in permanent_skips
        ]
        print(
            f'Resume: {len(done)} units cached, {len(permanent_skips)} permanent skips, '
            f'{len(unit_ids)} remaining'
        )
    elif args.incremental and not args.unit:
        # Default incremental: re-rank selected units; drop them from merge base first
        # so stale formula rows are replaced, then merge keeps untouched long-tail.
        rebuild = {msy._app().normalize_id(u) for u in unit_ids}
        existing_groups = [
            g for g in existing_groups
            if msy._app().normalize_id((g.get('unit') or {}).get('id')) not in rebuild
        ]
        unit_ids = [
            u for u in unit_ids
            if msy._app().normalize_id(u) not in permanent_skips
        ]

    def_tiers = msy._defender_tiers()
    limit = args.limit or None
    checkpoint = max(1, int(args.checkpoint))

    print(
        f'BSP DC build ({scope_label}): {len(unit_ids)} units, '
        f'base={args.base}, store_top={top_pilots}, '
        f'pool=bsp (~{msy._BSP_PILOT_CAP} pilots/unit, nonUR reserve {msy._BSP_NON_UR_RESERVE})'
    )

    merged_holder = {'groups': list(existing_groups)}

    def on_checkpoint(session_groups):
        merged = _merge_groups(existing_groups, session_groups)
        merged_holder['groups'] = merged
        path = _save_v15(cache_key, merged, len(pilot_ids))
        print(f'  checkpoint {len(merged)} units -> {path}')

    t0 = time.perf_counter()
    new_groups = asyncio.run(build_units(
        args.base, lang, unit_ids, pilot_ids, exclude, top_pilots, def_tiers,
        limit=limit, on_checkpoint=on_checkpoint if checkpoint else None,
        workers=args.workers,
    ))
    merged = _merge_groups(existing_groups, new_groups)
    print(f'Built {len(new_groups)} new groups ({len(merged)} total) in {time.perf_counter() - t0:.0f}s')

    if args.unit and len(args.unit) == 1 and merged:
        g = next(
            (x for x in merged if msy._app().normalize_id((x.get('unit') or {}).get('id'))
             == msy._app().normalize_id(args.unit[0])),
            merged[-1],
        )
        for p in (g.get('pilots') or [])[:10]:
            ch = p.get('char') or {}
            print(
                f'  #{p.get("rank")} {ch.get("name")} '
                f'peak={p.get("peak_dmg")} sc={p.get("super_crit_dmg")}'
            )

    path = _save_v15(cache_key, merged, len(pilot_ids))
    print(f'Saved: {path}')
    sort_path = msy.save_published_sort_index(lang, merged)
    print(f'Sort index: {sort_path} ({len(msy._MSY_SORT_DAMAGE_INDEX.get(lang) or {})} units)')

    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump({'groups': merged}, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
