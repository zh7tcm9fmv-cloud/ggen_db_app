#!/usr/bin/env python3
"""Verify BSP Top-10 Damage Dealt % matches live Damage Calculator passive %.

Compares published ``dmg_dealt_pct`` (and what the card UI would show) against
``userDmgIncreasePct`` from MsyDcEngine / calculateDamage for the same pairs.
"""
from __future__ import annotations

import argparse
import asyncio
import gzip
import json
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from playwright.async_api import async_playwright  # noqa: E402

import meta_synergy_rank as msy  # noqa: E402

EVAL_JS = """
async ({ unitId, pilotIds, defTiers, lang }) => {
  return await MsyDcEngine.evalUnit(unitId, pilotIds, defTiers, {
    lang: lang,
    cpOn: true,
    pepOn: true,
  });
}
"""

UI_SHOW_JS = """
({ pilots }) => {
  // Mirror unit_best_pilots.js / meta_synergy.js card label (passive only).
  return (pilots || []).map(p => ({
    id: String((p.char && p.char.id) || p.cid || ''),
    name: (p.char && p.char.name) || '',
    stored: (p.dmg_dealt_pct == null || p.dmg_dealt_pct === '') ? null : (p.dmg_dealt_pct | 0),
    ui_shown: (p.dmg_dealt_pct == null || p.dmg_dealt_pct === '') ? null : (p.dmg_dealt_pct | 0),
  }));
}
"""


async def setup_page(page, base):
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


def load_published_group(uid, lang='EN'):
    cache_key = msy._bsp_published_cache_key(lang, {'lb_tier': 3, 'top_pilots': 20})
    return msy._lookup_bsp_published_group(uid, lang, {'lb_tier': 3, 'top_pilots': 20})


def pilots_from_group(g, top_n=15):
    rankings = (g.get('rankings') or {}).get('super_crit') or {}
    pilots = rankings.get('pilots') or g.get('pilots') or []
    return list(pilots)[:top_n]


def extract_live_dmg(raw, cid, vigor='super', tier=3):
    by_tier = (raw or {}).get('byTier') or {}
    pairs = by_tier.get(str(tier)) or by_tier.get(tier) or []
    for pair_cid, by_vigor in pairs:
        if msy._app().normalize_id(pair_cid) != msy._app().normalize_id(cid):
            continue
        row = (by_vigor or {}).get(vigor) or {}
        if not row:
            return None
        return int(row.get('dmg_dealt_pct') or row.get('userDmgIncreasePct') or 0)
    return None


async def verify_unit(page, base, uid, lang='EN', top_n=15):
    g = load_published_group(uid, lang)
    if not g:
        return {'uid': uid, 'error': 'not in published cache', 'mismatches': []}
    unit_name = (g.get('unit') or {}).get('name') or uid
    pilots = pilots_from_group(g, top_n=top_n)
    if not pilots:
        return {'uid': uid, 'name': unit_name, 'error': 'no pilots', 'mismatches': []}

    ui_rows = await page.evaluate(UI_SHOW_JS, {'pilots': pilots})
    ui_by_id = {r['id']: r for r in ui_rows if r.get('id')}

    cids = [msy._app().normalize_id((p.get('char') or {}).get('id')) for p in pilots]
    cids = [c for c in cids if c]

    def_tiers = msy._defender_tiers()
    dt = 3
    stats = def_tiers[dt]
    def_payload = {str(dt): {'unit_def': stats['unit_def'], 'char_def': stats['char_def']}}

    raw = await page.evaluate(
        EVAL_JS,
        {'unitId': uid, 'pilotIds': cids, 'defTiers': def_payload, 'lang': lang},
    )
    mismatches = []
    rows = []
    for p in pilots:
        cid = msy._app().normalize_id((p.get('char') or {}).get('id'))
        name = (p.get('char') or {}).get('name') or cid
        stored = int(p.get('dmg_dealt_pct') or 0)
        ui_shown = (ui_by_id.get(cid) or {}).get('ui_shown')
        if ui_shown is None:
            ui_shown = stored
        live = extract_live_dmg(raw, cid, vigor='super', tier=3)
        py_dmg, _ = msy._char_pilot_dmg_bonuses(cid, uid, lang)
        aff = msy._msy_pilot_unit_affinities(cid, uid, lang)
        row = {
            'cid': cid,
            'name': name,
            'stored': stored,
            'ui_shown': ui_shown,
            'live_dc': live,
            'py_passive': int(py_dmg or 0),
            'affinity_rows': len(aff or []),
        }
        rows.append(row)
        problems = []
        if ui_shown != stored:
            problems.append(f'UI {ui_shown} != stored {stored}')
        if live is None:
            problems.append('live DC missing')
        elif live != stored:
            problems.append(f'stored {stored} != live DC {live}')
        elif live != ui_shown:
            problems.append(f'UI {ui_shown} != live DC {live}')
        if problems:
            mismatches.append({**row, 'problems': problems})
    return {
        'uid': uid,
        'name': unit_name,
        'checked': len(rows),
        'mismatches': mismatches,
        'rows': rows,
        'dc_error': (raw or {}).get('error'),
    }


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default=os.environ.get('MSY_DC_BASE', 'http://127.0.0.1:5000'))
    ap.add_argument('--lang', default='EN')
    ap.add_argument('--top-n', type=int, default=15)
    ap.add_argument(
        '--unit',
        action='append',
        default=[],
        help='Unit id (repeatable). Default: Strike Noir + affinity sample set.',
    )
    args = ap.parse_args()

    units = [msy._app().normalize_id(u) for u in (args.unit or [])]
    if not units:
        units = [
            '1336000100',  # Strike Noir — user report
            '1210000300',  # Operation Meteor sample (Heero)
            '1211000100',  # Epyon
            '1300004300',  # common SSR
            '1150000100',
        ]

    # Wait for local server
    import urllib.request
    for _ in range(60):
        try:
            urllib.request.urlopen(args.base + '/', timeout=2)
            break
        except Exception:
            time.sleep(2)
    else:
        print(f'ERROR: server not ready at {args.base}', flush=True)
        sys.exit(2)

    print(f'Verifying Damage Dealt %% vs live calculator @ {args.base}', flush=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await setup_page(page, args.base)

        all_mismatches = []
        for uid in units:
            print(f'\\n=== {uid} ===', flush=True)
            try:
                result = await verify_unit(page, args.base, uid, args.lang, top_n=args.top_n)
            except Exception as e:
                print(f'  ERROR: {e}', flush=True)
                all_mismatches.append({'uid': uid, 'error': str(e)})
                try:
                    await setup_page(page, args.base)
                except Exception:
                    pass
                continue
            if result.get('error'):
                print(f'  skip: {result["error"]}', flush=True)
                continue
            print(f'  {result.get("name")} — checked {result["checked"]} pilots', flush=True)
            if result.get('dc_error'):
                print(f'  DC error: {result["dc_error"]}', flush=True)
            for row in result.get('rows') or []:
                mark = 'OK' if row['cid'] not in {m['cid'] for m in result['mismatches']} else 'FAIL'
                print(
                    f'  [{mark}] {row["name"]} ({row["cid"]}): '
                    f'UI={row["ui_shown"]} stored={row["stored"]} live={row["live_dc"]} '
                    f'py={row["py_passive"]} aff={row["affinity_rows"]}',
                    flush=True,
                )
            for m in result.get('mismatches') or []:
                all_mismatches.append({'uid': uid, 'name': result.get('name'), **m})

        await browser.close()

    print('\\n======== SUMMARY ========', flush=True)
    if not all_mismatches:
        print('ALL CHECKS PASSED — UI Damage Dealt % matches live calculator passive %.', flush=True)
        return 0
    print(f'{len(all_mismatches)} mismatch(es):', flush=True)
    for m in all_mismatches:
        print(
            f'  - {m.get("uid")} / {m.get("name")} / {m.get("cid")}: '
            f'{m.get("problems") or m.get("error")}',
            flush=True,
        )
    return 1


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
