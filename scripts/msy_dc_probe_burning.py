"""Probe live DC calculateDamage vs MSY Python for Burning Gundam (EX)."""
import asyncio
import json

from playwright.async_api import async_playwright

BASE = "https://ggendb.up.railway.app"
UNIT = "1200003950"
PILOTS = [
    ("1200000103", "Domon EX"),
    ("1330000103", "Shinn EX"),
    ("1339000100", "Lowe EX"),
    ("1095001801", "Haman EX"),
]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/", wait_until="networkidle", timeout=180_000)
        await page.wait_for_function(
            "() => typeof calculateDamage === 'function' && typeof _dcCalculateDamageWithSlot === 'function'",
            timeout=180_000,
        )
        rows = await page.evaluate(
            """async ({ unitId, pilots, defUnitDef, defCharDef }) => {
              const lang = 'EN';
              const ud = await (await fetch(`/api/unit/${unitId}?lang=${lang}`)).json();
              if (!ud || ud.error) return { error: ud && ud.error };
              const exIdx = (ud.weapons || []).findIndex(w => w && w.is_ex && !w.is_map);
              const wpnIdx = exIdx >= 0 ? exIdx : 0;
              const wpnLv = 4;
              const defNpc = {
                unit: { stats_raw: { HP: 999999, Defense: defUnitDef, Mobility: 0 }, bonus_amounts: {} },
                character: { stats_raw: { Defense: defCharDef, Reaction: 0 } },
              };
              function msySlot(cd) {
                return {
                  atkUnit: unitId,
                  atkChar: String(cd.id),
                  atkUnitData: ud,
                  atkCharData: cd,
                  lbTier: 3,
                  wpnIdx,
                  wpnLv,
                  unitStatMode: 'normal',
                  charStatMode: 'normal',
                  unitCondPassive: false,
                  charCondPassive: true,
                  dcSuperchargedExTier: 0,
                  mpLevel: 'super',
                  optionParts: [],
                  supporters: [],
                  _activeSkills: {},
                  dmgIncrease: 0,
                  critDmgUp: 0,
                  terrain: 0,
                  terrainMode: 'normal',
                  finalWpnPow: 0,
                  exSquadAtkPct: 0,
                  squadCondPct: 0,
                  applyAdvantageEnemyTag: true,
                };
              }
              function applyMsyChar(slot) {
                S.dc.atkUnitData = slot.atkUnitData;
                S.dc.atkCharData = slot.atkCharData;
                S.dc.lbTier = 3;
                S.dc.wpnIdx = slot.wpnIdx;
                S.dc.wpnLv = slot.wpnLv;
                S.dc.charCondPassive = true;
                S.dc.unitCondPassive = false;
                S.dc.mpLevel = 'super';
                S.dc.defNpc = defNpc;
                S.dc.defTargetMode = 'custom';
                S.dc.optionParts = [];
                S.dc.supporters = [];
                if (typeof _dcSyncCharCondPassiveFromPair === 'function') _dcSyncCharCondPassiveFromPair();
                if (typeof _dcAutoEnableMaxDamageSkills === 'function') _dcAutoEnableMaxDamageSkills();
                if (typeof _dcSyncSuperchargedExTierForVigor === 'function') _dcSyncSuperchargedExTierForVigor();
                slot.charCondPassive = !!S.dc.charCondPassive;
                slot.dcSuperchargedExTier = S.dc.dcSuperchargedExTier | 0;
                slot._activeSkills = { ...(S.dc._activeSkills || {}) };
                slot.mpLevel = 'super';
              }
              const out = [];
              for (const [cid, label] of pilots) {
                const cd = await (await fetch(`/api/character/${cid}?lang=${lang}`)).json();
                if (!cd || cd.error) { out.push({ label, cid, error: cd && cd.error }); continue; }
                const slot = msySlot(cd);
                if (cd.ex_supercharged_tiers && cd.ex_supercharged_tiers.length > 1) {
                  slot.dcSuperchargedExTier = cd.ex_supercharged_tiers.length - 1;
                }
                applyMsyChar(slot);
                S.dc.atkSlots = S.dc.atkSlots || [null, null];
                S.dc.atkSlotIndex = 0;
                S.dc.atkSlots[0] = slot;
                let r = null;
                try { r = _dcCalculateDamageWithSlot(0); } catch (e) { r = { error: String(e) }; }
                out.push({
                  label,
                  cid,
                  critDmg: r && r.critDmg,
                  normalDmg: r && r.normalDmg,
                  charCondPassive: S.dc.charCondPassive,
                  exTier: S.dc.dcSuperchargedExTier,
                  gc: typeof _dcCharGuaranteedCritActive === 'function' ? _dcCharGuaranteedCritActive() : null,
                  dmgIncrease: S.dc.dmgIncrease,
                  critDmgUp: S.dc.critDmgUp,
                  charAtk: r && r.charAtk,
                  unitAtk: r && r.unitAtk,
                });
              }
              return { unit: ud.name, rows: out };
            }""",
            {"unitId": UNIT, "pilots": PILOTS, "defUnitDef": 3819, "defCharDef": 193},
        )
        print(json.dumps(rows, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
