"""Top 10 pilots for Burning/God Gundam (EX) via calculateDamage — user MSY preset."""
import asyncio
import json
import sys

from playwright.async_api import async_playwright

ROOT = __import__("os").path.dirname(__import__("os").path.dirname(__import__("os").path.abspath(__file__)))
sys.path.insert(0, ROOT)

import meta_synergy_rank as msy

BASE = "https://ggendb.up.railway.app"
UNIT = "1200003950"
DEF_U = 3819
DEF_C = 193

SWEEP_JS = """
async ({ unitId, pilotIds, defUnitDef, defCharDef, lang, wpnIdx, wpnLv, traitDist, advTag }) => {
  const ud = await fetch(`/api/unit/${unitId}?lang=${lang}&lb_tier=3`).then(r => r.json());
  if (!ud || ud.error) return { error: ud && ud.error };
  const defNpc = _dcManualDefNpcFromDefC({
    un: 'Defender (MSY)', cn: 'Defender Pilot (MSY)',
    uHP: 0, uATK: 0, uDEF: defUnitDef, uMOB: 0,
    cRNG: 0, cMEL: 0, cAWK: 0, cDEF: defCharDef, cREA: 0,
  });
  const vigors = ['super'];
  const out = [];
  for (const cid of pilotIds) {
    const cd = await fetch(`/api/character/${cid}?lang=${lang}`).then(r => r.json());
    if (!cd || cd.error) continue;
    for (const vigor of vigors) {
      S.dc.defTargetMode = 'custom';
      S.dc.defNpc = defNpc;
      const slot = _dcCreateEmptyAttackerSlot();
      slot.atkUnit = String(unitId);
      slot.atkChar = String(cid);
      slot.atkUnitData = ud;
      slot.atkCharData = cd;
      const bw = (wpnIdx != null && wpnLv != null)
        ? { wpnIdx, wpnLv }
        : _dcPickBestWeaponIndices(ud);
      slot.wpnIdx = bw.wpnIdx;
      slot.wpnLv = bw.wpnLv;
      slot.lbTier = 3;
      slot.unitStatMode = 'normal';
      slot.unitCondPassive = true;
      slot.charStatMode = 'normal';
      slot.mpLevel = 'super';
      slot.optionParts = [];
      slot.supporters = [];
      slot.supportCounterAtk = false;
      slot.finalWpnPow = 0;
      slot.applyAdvantageEnemyTag = !!advTag;
      slot._wpnTraitDistPow = traitDist | 0;
      slot.charCondPassive = _dcShouldAutoCharCondPassive(cd, ud);
      slot.dcSuperchargedExTier = 0;
      if (slot.charCondPassive && cd.ex_supercharged_tiers && cd.ex_supercharged_tiers.length > 1) {
        slot.dcSuperchargedExTier = cd.ex_supercharged_tiers.length - 1;
      }
      S.dc.atkCharData = cd;
      S.dc.atkUnitData = ud;
      S.dc.charStatMode = 'normal';
      S.dc._activeSkills = {};
      _dcAutoEnableMaxDamageSkills();
      slot._activeSkills = { ...(S.dc._activeSkills || {}) };
      S.dc.atkSlotIndex = 0;
      S.dc.atkSlots[0] = slot;
      _dcWriteAttackerToDc(slot, 0);
      S.dc._wpnCritDmgUp = _dcCritDmgUpFromWeapon(ud, slot.wpnIdx, slot.wpnLv) | 0;
      _dcRecalcPilotBonuses(true);
      const r = calculateDamage();
      if (!r) continue;
      out.push({
        cid: String(cid),
        name: cd.name,
        superCrit: r.critDmg | 0,
        normal: r.normalDmg | 0,
        charCP: slot.charCondPassive,
        pairOk: _dcUnitCharPairMatch(cd, ud),
        di: S.dc.dmgIncrease | 0,
        wpn: _dcNonMapWeapons(ud)[slot.wpnIdx]?.name,
        skills: Object.keys(slot._activeSkills || {}).filter(k => slot._activeSkills[k]),
        gc: _dcCharGuaranteedCritActive ? _dcCharGuaranteedCritActive() : false,
      });
    }
  }
  out.sort((a, b) => b.superCrit - a.superCrit || a.cid.localeCompare(b.cid));
  return { unit: ud.name, rows: out };
}
"""


async def main():
    A = msy._app()
    uid = A.normalize_id(UNIT)
    pilot_ids = msy.dc_candidate_pilots_for_unit(uid, list(msy._pilot_pool_ids()), set(), "EN")
    print(f"Evaluating {len(pilot_ids)} pilot candidates for {UNIT}...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/?tab=calculator", wait_until="networkidle", timeout=180_000)
        await page.wait_for_function(
            "() => typeof _dcCalculateDamageWithSlot === 'function'",
            timeout=180_000,
        )
        await page.evaluate("() => initDmgCalc()")

        for label, kwargs in [
            ("share-like (Shuffle Alliance EX, td=20, ae=0, auto damage skills)", dict(wpnIdx=2, wpnLv=4, traitDist=20, advTag=False)),
        ]:
            raw = await page.evaluate(
                SWEEP_JS,
                {
                    "unitId": UNIT,
                    "pilotIds": pilot_ids,
                    "defUnitDef": DEF_U,
                    "defCharDef": DEF_C,
                    "lang": "EN",
                    **kwargs,
                },
            )
            rows = raw.get("rows") or []
            print(f"\n=== {label} — {raw.get('unit')} @ DEF {DEF_U}/{DEF_C} ===")
            for i, r in enumerate(rows[:10], 1):
                print(
                    f"  #{i} {r['name']} ({r['cid']})  super_crit={r['superCrit']:,}  "
                    f"di={r['di']}%  pair={r['pairOk']}  cp={r['charCP']}  gc={r['gc']}"
                )
            for name in ("Domon Kasshu", "Lowe Guele", "Haman Karn"):
                hit = next((x for x in rows if name in (x.get("name") or "")), None)
                if hit:
                    rank = rows.index(hit) + 1
                    print(f"  >> {name}: rank #{rank}, {hit['superCrit']:,}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
