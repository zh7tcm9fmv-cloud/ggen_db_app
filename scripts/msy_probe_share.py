"""Load user share link and compare DC damage vs MSY preset."""
import asyncio
import json

from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5050"
SHARE = (
    "AXicrZIxT8MwEIX_yzff8OzUlNwMKwtj1SFyCqqoICWkHaL8dxQXgYSoqATLnc7P9-6zdSMHPBhNiff4amTACVGSqjoJI38eKKjCOG7xaBx3"
    "-MJot3iVjDzgMro2F7MDTj90m1eM_glfEWqFpKTA2uj3uVx_a_EoY8hdacsfudkU-aXDWUi6qmefuQohJkkxicnO4VZVXXD1I-7iItzlbDDj2jf0_NCU3nNv"
    "-CO76iSF6zL4H9ijFJa_fftlyGtj94hze4dxg48849RKp-2IOuV5R_ovITJN76pJjtw"
)

MSY_EVAL = """
async ({ unitId, pilotIds, defUnitDef, defCharDef }) => {
  const lang = 'EN';
  const ud = await fetch(`/api/unit/${unitId}?lang=${lang}&lb_tier=3`).then(r => r.json());
  const bw = _dcPickBestWeaponIndices(ud);
  const defNpc = _dcManualDefNpcFromDefC({
    un: 'Defender (MSY)', cn: 'Defender Pilot (MSY)',
    uHP: 0, uATK: 0, uDEF: defUnitDef, uMOB: 0,
    cRNG: 0, cMEL: 0, cAWK: 0, cDEF: defCharDef, cREA: 0,
  });
  const out = [];
  for (const cid of pilotIds) {
    const cd = await fetch(`/api/character/${cid}?lang=${lang}`).then(r => r.json());
    S.dc.defTargetMode = 'custom';
    S.dc.defNpc = defNpc;
    S.dc.atkUnitData = ud;
    S.dc.atkCharData = cd;
    S.dc.lbTier = 3;
    S.dc.wpnIdx = bw.wpnIdx;
    S.dc.wpnLv = bw.wpnLv;
    S.dc.unitStatMode = 'normal';
    S.dc.unitCondPassive = true;
    S.dc.charStatMode = 'normal';
    S.dc.optionParts = [];
    S.dc.supporters = [];
    S.dc.supportCounterAtk = false;
    S.dc.finalWpnPow = 0;
    S.dc.applyAdvantageEnemyTag = true;
    setDcMp('super');
    S.dc.charCondPassive = true;
    _dcSyncCharCondPassiveFromPair();
    _dcSyncSuperchargedExTierForVigor();
    _dcAutoEnableMaxDamageSkills();
    _dcRecalcPilotBonuses(true);
    const r = calculateDamage();
    out.push({
      cid,
      name: cd.name,
      wpnIdx: S.dc.wpnIdx,
      wpnLv: S.dc.wpnLv,
      wpnName: _dcNonMapWeapons(ud)[S.dc.wpnIdx]?.name,
      charCP: S.dc.charCondPassive,
      critDmg: r?.critDmg,
      normalDmg: r?.normalDmg,
      di: S.dc.dmgIncrease,
      skills: Object.keys(S.dc._activeSkills || {}).filter(k => S.dc._activeSkills[k]),
    });
  }
  return { unit: ud.name, bw, rows: out };
}
"""


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/?tab=calculator", wait_until="networkidle", timeout=180_000)
        await page.wait_for_function("() => typeof _dcApplyPackedShareState === 'function'", timeout=180_000)
        await page.evaluate("() => initDmgCalc()")

        share_rows = await page.evaluate(
            """async (raw) => {
              const u8 = _dcB64UrlToU8(raw);
              const kind = u8[0], body = u8.slice(1);
              const ds = new DecompressionStream('deflate');
              const stream = new Blob([body]).stream().pipeThrough(ds);
              const buf = await new Response(stream).arrayBuffer();
              const obj = JSON.parse(new TextDecoder().decode(buf));
              await loadDcStages();
              await _dcApplyPackedShareState(obj);
              onDcParamChange();
              const rows = [];
              for (let i = 0; i < 3; i++) {
                S.dc.atkSlotIndex = i;
                _dcWriteAttackerToDc(S.dc.atkSlots[i]);
                S.dc._wpnCritDmgUp = _dcCritDmgUpFromWeapon(S.dc.atkUnitData, S.dc.wpnIdx, S.dc.wpnLv) | 0;
                _dcRecalcPilotBonuses(true);
                const r = calculateDamage();
                const sl = S.dc.atkSlots[i];
                const def = S.dc.defNpc;
                rows.push({
                  slot: i,
                  pilot: sl.atkCharData?.name,
                  cid: sl.atkChar,
                  charCP: sl.charCondPassive,
                  wpnIdx: sl.wpnIdx,
                  wpnLv: sl.wpnLv,
                  wpnName: _dcNonMapWeapons(sl.atkUnitData)[sl.wpnIdx]?.name,
                  critDmg: r?.critDmg,
                  normalDmg: r?.normalDmg,
                  di: S.dc.dmgIncrease,
                  defUnitDef: def?.unit?.stats_raw?.Defense,
                  defCharDef: def?.character?.stats_raw?.Defense,
                  skills: Object.keys(sl._activeSkills || {}).filter(k => sl._activeSkills[k]),
                });
              }
              return { rows };
            }""",
            SHARE,
        )

        msy_rows = await page.evaluate(
            MSY_EVAL,
            {
                "unitId": "1200003950",
                "pilotIds": ["1200000103", "1339000100", "1095001801"],
                "defUnitDef": 3819,
                "defCharDef": 193,
            },
        )

        print("=== SHARE LINK (user example) ===")
        print(json.dumps(share_rows, indent=2))
        print("\n=== MSY PRESET (openInSimulator) ===")
        print(json.dumps(msy_rows, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
