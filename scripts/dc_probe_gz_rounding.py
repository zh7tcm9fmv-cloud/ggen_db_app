"""Live DC probe: Great Zeong user loadout + rounding variants."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5050"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/?tab=calculator", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)

        out = await page.evaluate(
            """async () => {
              initDmgCalc();
              const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier=2').then(r=>r.json());
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r=>r.json());
              const sup = await fetch('/api/supporter/1080000550?lang=EN&level=100&lb_tier=3&for_unit_id=1850001650&for_char_id=1850001501').then(r=>r.json());
              const stage = await fetch('/api/stage/90520001?lang=EN').then(r=>r.json());
              const npc = stage.npc_details.find(n=>n.npc_id==='905200000102000003');

              function setup(opts) {
                S.dc.atkUnitData = gz;
                S.dc.atkCharData = pilot;
                S.dc.lbTier = 2;
                S.dc.wpnIdx = gz.weapons.findIndex(w => w.is_ex);
                S.dc.wpnLv = gz.weapons[S.dc.wpnIdx].levels.length - 1;
                S.dc.optionParts = [{ details: 'Increase Attack by 12%' }];
                sup._dcLevel = 100; sup._dcLbTier = 3;
                S.dc.supporters = [sup];
                S.dc.mpLevel = opts.mp || 'medium';
                S.dc.defNpc = npc;
                S.dc.terrain = 0;
                S.dc.defending = false;
                S.dc.supportCounterAtk = !!opts.sac;
                S.dc.unitCondPassive = false;
                S.dc.charCondPassive = !!opts.ccp;
                S.dc.finalWpnPow = 0;
                _dcSyncCharCondPassiveFromPair();
                if (opts.ccp === undefined) { /* use sync */ }
                else S.dc.charCondPassive = !!opts.ccp;
                _dcRecalcPilotBonuses(true);
                return calculateDamage();
              }

              const med = setup({ sac: true, mp: 'medium' });
              const medManualCpOff = setup({ sac: true, mp: 'medium', ccp: false });
              const supVigor = setup({ sac: true, mp: 'super', ccp: true });

              const pb = _dcParsePilotAbilBonuses(pilot);
              const autoCp = _dcShouldAutoCharCondPassive(pilot, gz);
              const vReq = _dcCharCpVigorRequirement(pilot);

              // Split correction what-if
              function splitVariant(r) {
                const F = Math.floor, C = Math.ceil;
                const bd = r.baseDamage;
                const oc = r.offenseComponent * bd;
                const dc = r.defenseComponent * bd;
                const bdmSplit = C((bd + C(oc) + C(dc)) * r.terrainCorrection);
                const sn = C(r.totalNormalMultPct * bdmSplit / 100);
                return C(bdmSplit + sn);
              }

              return {
                autoCp, vReq,
                charCondAfterSync: S.dc.charCondPassive,
                dmgIncrease: S.dc.dmgIncrease,
                pilotBonuses: pb.items.filter(i => i.key === 'dmgDealt'),
                med: med ? {
                  normalDmg: med.normalDmg, battleDamage: med.battleDamage,
                  unitAtk: med.unitAtk, charAtk: med.charAtk, weaponPower: med.weaponPower,
                  combatWeaponPower: med.combatWeaponPower, totalNormalMultPct: med.totalNormalMultPct,
                  baseDamage: med.baseDamage, damageCorrection: med.damageCorrection,
                  atkCombined: med.atkCombined, defCombined: med.defCombined,
                  splitNormal: splitVariant(med),
                } : null,
                medCpOff: medManualCpOff ? {
                  normalDmg: medManualCpOff.normalDmg, charAtk: medManualCpOff.charAtk,
                  dmgInc: S.dc.dmgIncrease,
                } : null,
                supCp: supVigor ? { normalDmg: supVigor.normalDmg, charAtk: supVigor.charAtk } : null,
              };
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
