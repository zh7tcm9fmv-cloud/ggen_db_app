#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smoke /cal squad-condition + sheet-buff edge cases (Creuset pilot-swap class).

Nov 2026: inactive pilot-gated squad binding swallowed typed 小队条件 after pilot swap.
Usage: python scripts/smoke_dc_squad_cond.py [--base http://127.0.0.1:5000]
"""
from __future__ import annotations

import argparse
import json
import sys


CROSSBONE = "1166000250"
CREUSET = "1300001801"
KINCADE = "1166000100"
SANDAIME_U = "1700000250"
SANDAIME_C = "1700000200"
PROVIDENCE = "1300004650"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:5000")
    ap.add_argument("--timeout-ms", type=int, default=120000)
    args = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright required: pip install playwright && playwright install chromium", file=sys.stderr)
        return 2

    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(args.base.rstrip("/") + "/cal", wait_until="domcontentloaded", timeout=args.timeout_ms)
        page.wait_for_function(
            "() => !!(window.S && S.dc && typeof _dcSyncSquadCondEffectiveFromState === 'function')",
            timeout=args.timeout_ms,
        )

        result = page.evaluate(
            """async ([ids]) => {
              const {CROSSBONE, CREUSET, KINCADE, SANDAIME_U, SANDAIME_C, PROVIDENCE} = ids;
              const fetchJ = async (path) => (await fetch(path)).json();
              const unit = async (id) => fetchJ('/api/unit/'+id+'?lang=EN');
              const char = async (id) => fetchJ('/api/character/'+id+'?lang=EN');
              const [uXb, cCre, cKin, uSan, cSan, uProv] = await Promise.all([
                unit(CROSSBONE), char(CREUSET), char(KINCADE),
                unit(SANDAIME_U), char(SANDAIME_C), unit(PROVIDENCE)
              ]);
              const fail = [];
              const ok = (name, cond, detail) => { if (!cond) fail.push(name+(detail?(': '+detail):'')); };

              ok('DC_ATK_SLOT_COUNT', typeof DC_ATK_SLOT_COUNT==='number' && DC_ATK_SLOT_COUNT>=5, String(DC_ATK_SLOT_COUNT));
              ok('pill5_dom', !!document.getElementById('dcAtkSlotPill4'));

              _dcSnapActiveAttackerToSlot();
              while ((S.dc.atkSlots||[]).length < DC_ATK_SLOT_COUNT) S.dc.atkSlots.push(_dcCreateEmptyAttackerSlot());

              function loadPair(slotIdx, ud, cd, extra){
                const sl = _dcCreateEmptyAttackerSlot();
                sl.atkUnit = String(ud.id); sl.atkUnitData = ud;
                sl.atkChar = String(cd.id); sl.atkCharData = cd;
                sl.lbTier = 3;
                Object.assign(sl, extra||{});
                S.dc.atkSlots[slotIdx] = sl;
                return sl;
              }
              function statsAtk(ud){
                const lb = ud.lb_data;
                const tier = Math.min(3, lb ? lb.length-1 : 0);
                const row = (lb && lb[tier] && (lb[tier].stats_no_cond || lb[tier].stats)) || ud.stats || [];
                return _dcGetModifiedAttackerUnitStatsFromCtx(S.dc, row, false);
              }
              function syncPct(raw){
                S.dc.squadCondPct = raw|0;
                _dcSyncSquadCondEffectiveFromState();
                return {scAtk:S.dc.squadCondAtkPct|0, scDef:S.dc.squadCondDefPct|0};
              }

              // --- 1) Creuset + Crossbone: pilot gate fail → typed % must apply (manual ATK+DEF)
              {
                const sl = loadPair(0, uXb, cCre, {squadCondPct:10});
                S.dc.atkSlotIndex = 0;
                _dcWriteAttackerToDc(sl, 0);
                const b = _scFindSquadConditionBinding(cCre, uXb);
                const pilotOk = !!(b && b.pilotGroups && b.pilotGroups.length && _dcAbilityCondContextMeetsGroups(uXb, cCre, b.pilotGroups));
                const show = _dcCharShouldShowSquadCondUi(cCre, uXb);
                ok('creuset_xb_has_binding', !!b, b && b.kind);
                ok('creuset_xb_pilot_fail', !pilotOk);
                ok('creuset_xb_manual_ui', !show);
                const a10 = syncPct(10);
                const s10 = statsAtk(uXb);
                const a20 = syncPct(20);
                const s20 = statsAtk(uXb);
                ok('creuset_xb_sc_10', a10.scAtk===10 && a10.scDef===10, JSON.stringify(a10));
                ok('creuset_xb_sc_20', a20.scAtk===20 && a20.scDef===20, JSON.stringify(a20));
                ok('creuset_xb_atk_rises', (s20.unitAtk|0) > (s10.unitAtk|0), s10.unitAtk+'→'+s20.unitAtk);
              }

              // --- 2) Pilot swap preserve: Kincade typed 20 → Creuset keeps 20 and still applies
              {
                const slK = loadPair(0, uXb, cKin, {squadCondPct:20});
                S.dc.atkSlotIndex = 0;
                _dcWriteAttackerToDc(slK, 0);
                S.dc.squadCondPct = 20;
                // simulate pick Creuset without wiping typed %
                S.dc.atkChar = CREUSET; S.dc.atkCharData = cCre;
                _dcRefreshSquadCondPctForCurrentPair();
                ok('pilot_swap_preserve_raw', (S.dc.squadCondPct|0)===20, String(S.dc.squadCondPct));
                const a = syncPct(S.dc.squadCondPct|0);
                ok('pilot_swap_creuset_applies_20', a.scAtk===20 && a.scDef===20, JSON.stringify(a));
              }

              // --- 3) Creuset + Providence: active binding, typed clamps to ability cap (5)
              {
                const sl = loadPair(0, uProv, cCre, {squadCondPct:20});
                S.dc.atkSlotIndex = 0;
                _dcWriteAttackerToDc(sl, 0);
                const show = _dcCharShouldShowSquadCondUi(cCre, uProv);
                ok('creuset_prov_show_ui', show);
                const cap = _dcSquadCondInputCap(cCre, uProv)|0;
                ok('creuset_prov_cap_5', cap===5, String(cap));
                S.dc.squadCondPct = 20;
                _dcRefreshSquadCondPctForCurrentPair(); // should arm default (5), not keep 20 as uncapped manual
                const afterRefresh = S.dc.squadCondPct|0;
                ok('creuset_prov_default_on_refresh', afterRefresh===5 || afterRefresh===cap, String(afterRefresh));
                const a = syncPct(20);
                ok('creuset_prov_clamp', a.scAtk===cap && a.scDef===cap, JSON.stringify(a)+' cap='+cap);
              }

              // --- 4) External Sandaime +2% stacks on top of Creuset manual 10 on Crossbone
              {
                loadPair(0, uXb, cCre, {squadCondPct:10});
                loadPair(1, uSan, cSan, {squadCondPct:5});
                S.dc.atkSlotIndex = 0;
                _dcWriteAttackerToDc(S.dc.atkSlots[0], 0);
                S.dc.squadCondPct = 10;
                S.dc._dcCalcSlotIndex = 0;
                _dcSyncSquadCondEffectiveFromState();
                const sc = S.dc.squadCondAtkPct|0;
                ok('sandaime_ext_plus_manual', sc===12, 'scAtk='+sc); // 10 manual + 2 Gundam
                delete S.dc._dcCalcSlotIndex;
              }

              // --- 5) GO / ML team-wide: toggle one → all slots
              {
                for (let i=0;i<DC_ATK_SLOT_COUNT;i++){
                  if (!S.dc.atkSlots[i]) S.dc.atkSlots[i]=_dcCreateEmptyAttackerSlot();
                  S.dc.atkSlots[i].grandOffensiveBuff = false;
                  S.dc.atkSlots[i].masterLeagueBuff = false;
                }
                setDcGrandOffensiveBuff(true);
                setDcMasterLeagueBuff(true);
                const allGo = S.dc.atkSlots.every(sl => sl && sl.grandOffensiveBuff);
                const allMl = S.dc.atkSlots.every(sl => sl && sl.masterLeagueBuff);
                ok('go_all_slots', allGo && !!S.dc.grandOffensiveBuff);
                ok('ml_all_slots', allMl && !!S.dc.masterLeagueBuff);
                setDcGrandOffensiveBuff(false);
                setDcMasterLeagueBuff(false);
                ok('go_off_all', S.dc.atkSlots.every(sl => sl && !sl.grandOffensiveBuff));
              }

              // --- 6) Kincade + Crossbone still responds to squad % (regression: qualified path)
              {
                const sl = loadPair(0, uXb, cKin, {squadCondPct:10});
                S.dc.atkSlotIndex = 0;
                _dcWriteAttackerToDc(sl, 0);
                const s10 = (() => { syncPct(10); return statsAtk(uXb); })();
                const s20 = (() => { syncPct(20); return statsAtk(uXb); })();
                // If Kincade has no / inactive binding, manual path; either way ATK must rise 10→20
                ok('kincade_xb_atk_rises', (s20.unitAtk|0) > (s10.unitAtk|0), s10.unitAtk+'→'+s20.unitAtk);
              }

              return {fail, slotCount: DC_ATK_SLOT_COUNT};
            }""",
            [
                {
                    "CROSSBONE": CROSSBONE,
                    "CREUSET": CREUSET,
                    "KINCADE": KINCADE,
                    "SANDAIME_U": SANDAIME_U,
                    "SANDAIME_C": SANDAIME_C,
                    "PROVIDENCE": PROVIDENCE,
                }
            ],
        )
        browser.close()

    if errors:
        failures.extend("pageerror: " + e for e in errors)
    failures.extend(result.get("fail") or [])

    print(json.dumps({"result": result, "pageErrors": errors}, indent=2))
    if failures:
        print("FAIL:", "; ".join(failures), file=sys.stderr)
        return 1
    print("OK: /cal squad-cond + sheet-buff smoke")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
