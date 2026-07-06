#!/usr/bin/env python3
"""Build MSY rankings cache from live calculateDamage() — authoritative damage sim."""
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

EVAL_UNIT_JS = """
async ({ unitId, pilotIds, defTiers, lang }) => {
  const ud = await fetch(`/api/unit/${unitId}?lang=${lang}&lb_tier=3`).then(r => r.json());
  if (!ud || ud.error) return { error: ud && ud.error, unitId };
  const bw = _dcPickBestWeaponIndices(ud);
  const vigors = ['super', 'max', 'high'];
  const charCache = {};
  async function loadChar(cid) {
    if (charCache[cid]) return charCache[cid];
    const cd = await fetch(`/api/character/${cid}?lang=${lang}`).then(r => r.json());
    charCache[cid] = cd;
    return cd;
  }
  function defNpc(uDef, cDef) {
    return _dcManualDefNpcFromDefC({
      un: 'Defender (MSY)', cn: 'Defender Pilot (MSY)',
      uHP: 0, uATK: 0, uDEF: uDef, uMOB: 0,
      cRNG: 0, cMEL: 0, cAWK: 0, cDEF: cDef, cREA: 0,
    });
  }
  function evalPair(cd, uDef, cDef, vigor) {
    S.dc.defTargetMode = 'custom';
    S.dc.defNpc = defNpc(uDef, cDef);
    S.dc.atkUnit = String(unitId);
    S.dc.atkUnitData = ud;
    S.dc.atkChar = String(cd.id);
    S.dc.atkCharData = cd;
    S.dc.lbTier = 3;
    S.dc.defLbTier = 3;
    S.dc.wpnIdx = bw.wpnIdx;
    S.dc.wpnLv = bw.wpnLv;
    S.dc.unitStatMode = 'normal';
    S.dc.unitCondPassive = true;
    S.dc.charStatMode = 'normal';
    S.dc.optionParts = [];
    S.dc.supporters = [];
    S.dc.supportCounterAtk = false;
    S.dc.finalWpnPow = 0;
    S.dc.terrain = 0;
    S.dc.terrainMode = 'normal';
    S.dc.defending = false;
    S.dc.shield = false;
    S.dc.applyAdvantageEnemyTag = true;
    setDcMp(vigor);
    S.dc.charCondPassive = true;
    if (typeof _dcSyncCharCondPassiveFromPair === 'function') _dcSyncCharCondPassiveFromPair();
    if (typeof _dcSyncSuperchargedExTierForVigor === 'function') _dcSyncSuperchargedExTierForVigor();
    if (typeof _dcAutoEnableMaxDamageSkills === 'function') _dcAutoEnableMaxDamageSkills();
    if (typeof _dcRecalcPilotBonuses === 'function') _dcRecalcPilotBonuses(true);
    const r = calculateDamage();
    if (!r) return null;
    const critRate = Math.min(100, Math.max(0, r.critical | 0));
    const gc = typeof _dcCharGuaranteedCritActive === 'function' ? _dcCharGuaranteedCritActive() : false;
    const normalDmg = r.normalDmg | 0;
    const critDmgVal = r.critDmg | 0;
    const expected = Math.floor(normalDmg * (100 - critRate) / 100 + critDmgVal * critRate / 100);
    const peak = gc ? critDmgVal : Math.max(critDmgVal, expected);
    const pairOk = typeof _dcUnitCharPairMatch === 'function' ? _dcUnitCharPairMatch(cd, ud) : false;
    const row = {
      expected_dmg: expected,
      peak_dmg: peak,
      guaranteed_crit: gc,
      crit_rate: critRate,
      weapon_power: r.weaponPower | 0,
      def_debuff_pct: r.defDebuffPct | 0,
      pair_ok: pairOk,
      vigor,
      normal_dmg: normalDmg,
      crit_dmg: critDmgVal,
      super_crit_dmg: critDmgVal,
    };
    if (vigor === 'high') row.normal_dmg = normalDmg;
    else if (vigor === 'max') row.crit_dmg = critDmgVal;
    else row.super_crit_dmg = critDmgVal;
    return row;
  }
  const byTier = {};
  for (const [dt, stats] of Object.entries(defTiers)) {
    const tierPairs = [];
    for (const cid of pilotIds) {
      const cd = await loadChar(cid);
      if (!cd || cd.error) continue;
      const byVigor = {};
      for (const v of vigors) {
        const d = evalPair(cd, stats.unit_def, stats.char_def, v);
        if (d) byVigor[v] = d;
      }
      if (Object.keys(byVigor).length) tierPairs.push([String(cid), byVigor]);
    }
    byTier[dt] = tierPairs;
  }
  return { unitId, unitName: ud.name, byTier };
}
"""


async def build_units(base: str, lang: str, unit_ids, pilot_ids, exclude, top_pilots, def_tiers, *, limit=None):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{base}/?tab=calculator", wait_until="networkidle", timeout=180_000)
        await page.wait_for_function(
            "() => typeof calculateDamage === 'function' && typeof _dcPickBestWeaponIndices === 'function'",
            timeout=180_000,
        )
        await page.evaluate("() => { if (typeof initDmgCalc === 'function') initDmgCalc(); }")

        def_tier_payload = {
            str(k): {'unit_def': v['unit_def'], 'char_def': v['char_def']}
            for k, v in def_tiers.items() if int(k) in msy._MSY_STD_DEF_TIERS
        }

        groups = []
        ids = unit_ids[:limit] if limit else unit_ids
        t0 = time.perf_counter()
        for i, uid in enumerate(ids):
            candidates = msy.dc_candidate_pilots_for_unit(uid, pilot_ids, exclude, lang)
            if not candidates:
                continue
            raw = await page.evaluate(
                EVAL_UNIT_JS,
                {
                    'unitId': uid,
                    'pilotIds': candidates,
                    'defTiers': def_tier_payload,
                    'lang': lang,
                },
            )
            if not raw or raw.get('error'):
                print(f"  skip {uid}: {raw and raw.get('error')}")
                continue
            by_tier = {}
            for dt, pairs in (raw.get('byTier') or {}).items():
                py_pairs = []
                for cid, by_vigor in pairs:
                    dmg_by_v = {}
                    for v, d in (by_vigor or {}).items():
                        if not d:
                            continue
                        dt_key = int(dt)
                        dmg_by_v[v] = {
                            **d,
                            'def_tier': dt_key,
                            'def_unit_def': def_tier_payload[str(dt)]['unit_def'],
                            'def_char_def': def_tier_payload[str(dt)]['char_def'],
                            'def_label': def_tiers[dt_key]['label'],
                        }
                    if dmg_by_v:
                        py_pairs.append((cid, dmg_by_v))
                if py_pairs:
                    by_tier[int(dt)] = py_pairs
            g = msy.assemble_unit_group_from_dc(
                uid, by_tier, pilot_ids, lang, top_pilots, exclude,
            )
            if g:
                groups.append(g)
                top = (g.get('pilots') or [{}])[0]
                print(
                    f"[{i + 1}/{len(ids)}] {g['unit'].get('name')} "
                    f"#1 {top.get('char', {}).get('name')} {top.get('super_crit_dmg', top.get('score', 0)):,}"
                )
            if (i + 1) % 5 == 0:
                elapsed = time.perf_counter() - t0
                print(f"  ... {len(groups)} groups, {elapsed:.0f}s elapsed")
        await browser.close()
        return groups


def main():
    ap = argparse.ArgumentParser(description='Build MSY cache from Damage Simulator')
    ap.add_argument('--base', default=os.environ.get('MSY_DC_BASE', 'http://127.0.0.1:5050'))
    ap.add_argument('--lang', default='EN')
    ap.add_argument('--top-pilots', type=int, default=20)
    ap.add_argument('--limit', type=int, default=0, help='Max units (0 = all)')
    ap.add_argument('--unit', action='append', default=[], help='Single unit id (repeatable)')
    ap.add_argument('--out', default='', help='Optional JSON debug output path')
    args = ap.parse_args()

    lang = args.lang
    exclude = set()
    pilot_ids = list(msy._pilot_pool_ids())
    if args.unit:
        unit_ids = [msy._app().normalize_id(u) for u in args.unit]
    else:
        unit_ids = msy._msy_default_master_unit_ids(lang)

    def_tiers = msy._defender_tiers()
    limit = args.limit or None

    print(f"MSY DC build: {len(unit_ids)} units, base={args.base}")
    groups = asyncio.run(build_units(
        args.base, lang, unit_ids, pilot_ids, exclude, args.top_pilots, def_tiers, limit=limit,
    ))
    print(f"Built {len(groups)} unit groups")

    if args.unit and len(args.unit) == 1:
        g = groups[0] if groups else {}
        for p in (g.get('pilots') or [])[:10]:
            ch = p.get('char') or {}
            print(f"  #{p.get('rank')} {ch.get('name')} sc={p.get('super_crit_dmg')} pair={p.get('pair_ok')}")

    cache_key = msy._master_cache_key(lang, {
        'lb_tier': 3,
        'top_pilots': args.top_pilots,
        'def_unit_override': None,
        'def_char_override': None,
    })
    result = {'groups': groups, 'total_pilot_candidates': len(pilot_ids)}
    path = msy.save_published_master_cache(cache_key, result)
    msy._save_master_to_disk(cache_key, result)
    print(f"Saved: {path}")

    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
