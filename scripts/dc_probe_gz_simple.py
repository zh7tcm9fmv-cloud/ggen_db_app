"""GZ damage with user-stated buffs only (no support counter)."""
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

              S.dc.atkUnitData = gz;
              S.dc.atkCharData = pilot;
              S.dc.lbTier = 2;
              S.dc.wpnIdx = gz.weapons.findIndex(w => w.is_ex);
              S.dc.wpnLv = gz.weapons[S.dc.wpnIdx].levels.length - 1;
              S.dc.optionParts = [{ details: 'Increase Attack by 12%' }];
              sup._dcLevel = 100; sup._dcLbTier = 3;
              S.dc.supporters = [sup];
              S.dc.supportCounterAtk = false;
              S.dc.defNpc = npc;
              S.dc.terrain = 0;
              S.dc.defending = false;
              S.dc.finalWpnPow = 0;
              setDcMp('medium');
              S.dc.charCondPassive = false;
              S.dc.dcSuperchargedExTier = 0;

              renderDcAtkUnit();
              renderDcAtkChar();
              _dcRecalcPilotBonuses(true);

              const r = calculateDamage();
              const d = _dcDerivePilotDmgCritForSlotContext({ atkCharData: pilot, charStatMode: 'normal' }, 0);
              S.dc.dmgIncrease = d.dmgIncrease;
              const r2 = calculateDamage();

              // rounding variants on r2 intermediates
              const C = Math.ceil;
              const bd = r2.baseDamage;
              const oc = r2.offenseComponent * bd;
              const dc = r2.defenseComponent * bd;
              const variants = {};
              variants.current = r2.normalDmg;
              variants.bdCeilCorr = C(bd + C(r2.offenseComponent * bd + r2.defenseComponent * bd));
              variants.splitCeil = C(bd + C(oc) + C(dc));
              variants.bdmSplit = C((bd + C(oc) + C(dc)) * r2.terrainCorrection);
              variants.splitFinal = C(variants.bdmSplit + C(r2.totalNormalMultPct * variants.bdmSplit / 100));

              return {
                charCondPassive: S.dc.charCondPassive,
                dmgIncrease: S.dc.dmgIncrease,
                totalNormalMultPct: r2.totalNormalMultPct,
                unitAtk: r2.unitAtk,
                charAtk: r2.charAtk,
                weaponPower: r2.weaponPower,
                combatWeaponPower: r2.combatWeaponPower,
                baseDamage: r2.baseDamage,
                battleDamage: r2.battleDamage,
                damageCorrection: r2.damageCorrection,
                normalDmg: r2.normalDmg,
                variants,
                lb2BaseAtk: gz.lb_data?.[2]?.stats_no_cond?.find(s=>s.name==='Attack')?.total,
              };
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
