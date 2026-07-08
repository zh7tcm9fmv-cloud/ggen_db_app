#!/usr/bin/env python3
"""Build BSP v15 published cache from live /cal (MsyDcEngine — same path as the site)."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time

from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

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


def _load_existing_v15(lang, top_pilots):
    cache_key = msy._bsp_published_cache_key(lang, {'lb_tier': 3, 'top_pilots': top_pilots})
    disk = msy._load_bsp_published_cache(cache_key)
    if disk and disk.get('groups'):
        return cache_key, list(disk['groups'])
    return cache_key, []


def _save_v15(cache_key, groups, pilot_count):
    result = {'groups': groups, 'total_pilot_candidates': pilot_count}
    path = msy.save_published_master_cache(
        cache_key, result, build_engine=msy._BSP_DC_BUILD_ENGINE,
    )
    msy._save_master_to_disk(cache_key, {**result, 'build_engine': msy._BSP_DC_BUILD_ENGINE})
    return path


async def _setup_dc_page(page, base):
    await page.goto(f'{base}/?tab=calculator', wait_until='networkidle', timeout=180_000)
    await page.wait_for_function(
        '() => typeof _dcCalculateDamageWithSlot === "function"'
        ' && typeof _dcCreateEmptyAttackerSlot === "function"',
        timeout=180_000,
    )
    await page.evaluate('() => { if (typeof initDmgCalc === "function") initDmgCalc(); }')
    await page.add_script_tag(url=f'{base.rstrip("/")}/static/js/msy_dc_engine.js')
    await page.wait_for_function(
        '() => window.MsyDcEngine && typeof window.MsyDcEngine.ensureReady === "function"',
        timeout=120_000,
    )
    await page.evaluate('() => MsyDcEngine.ensureReady()')


async def _build_one_unit(page, uid, lang, pilot_ids, exclude, top_pilots, def_tiers, def_tier_payload):
    candidates = msy.dc_candidate_pilots_for_unit(uid, pilot_ids, exclude, lang, bsp=True)
    if not candidates:
        return None
    raw = await page.evaluate(
        EVAL_VIA_MSY_DC_JS,
        {
            'unitId': uid,
            'pilotIds': candidates,
            'defTiers': def_tier_payload,
            'lang': lang,
        },
    )
    if not raw or raw.get('error') or not raw.get('byTier'):
        print(f'  skip {uid}: {raw and raw.get("error")}')
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
        for _ in range(workers):
            pg = await browser.new_page()
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
                page, uid, lang, pilot_ids, exclude, top_pilots, def_tiers, def_tier_payload,
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
    ap = argparse.ArgumentParser(description='Build BSP v15 cache from live Damage Calculator')
    ap.add_argument('--base', default=os.environ.get('MSY_DC_BASE', 'https://ggendb.up.railway.app'))
    ap.add_argument('--lang', default='EN')
    ap.add_argument('--top-pilots', type=int, default=10)
    ap.add_argument('--limit', type=int, default=0, help='Max units (0 = all)')
    ap.add_argument('--unit', action='append', default=[], help='Single unit id (repeatable)')
    ap.add_argument('--resume', action='store_true', help='Skip units already in v15 published cache')
    ap.add_argument('--checkpoint', type=int, default=25, help='Save partial cache every N units')
    ap.add_argument('--workers', type=int, default=3, help='Parallel browser tabs (1-6)')
    ap.add_argument('--out', default='', help='Optional JSON debug output path')
    args = ap.parse_args()

    lang = args.lang
    exclude = set()
    pilot_ids = list(msy._pilot_pool_ids())
    cache_key, existing_groups = _load_existing_v15(lang, args.top_pilots)
    done = {
        msy._app().normalize_id((g.get('unit') or {}).get('id'))
        for g in existing_groups
    }

    if args.unit:
        unit_ids = [msy._app().normalize_id(u) for u in args.unit]
    else:
        unit_ids = msy._msy_rankable_unit_ids(lang)

    if args.resume:
        unit_ids = [u for u in unit_ids if msy._app().normalize_id(u) not in done]
        print(f'Resume: {len(done)} units cached, {len(unit_ids)} remaining')

    def_tiers = msy._defender_tiers()
    limit = args.limit or None
    checkpoint = max(1, int(args.checkpoint))

    print(f'BSP v15 DC build: {len(unit_ids)} units, base={args.base}, pool=bsp (~88 pilots/unit)')

    merged_holder = {'groups': list(existing_groups)}

    def on_checkpoint(session_groups):
        merged = _merge_groups(existing_groups, session_groups)
        merged_holder['groups'] = merged
        path = _save_v15(cache_key, merged, len(pilot_ids))
        print(f'  checkpoint {len(merged)} units -> {path}')

    t0 = time.perf_counter()
    new_groups = asyncio.run(build_units(
        args.base, lang, unit_ids, pilot_ids, exclude, args.top_pilots, def_tiers,
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
