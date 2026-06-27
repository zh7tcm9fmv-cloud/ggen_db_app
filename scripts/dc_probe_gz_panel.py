"""Match user Great Zeong panel stats and damage."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5050"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/?tab=calculator", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof pickDcItem === 'function'", timeout=120_000)

        result = await page.evaluate(
            """async () => {
              initDmgCalc();
              const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier=2').then(r=>r.json());
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r=>r.json());
              S.dc.atkUnit = '1850001650';
              S.dc.atkUnitData = gz;
              S.dc.atkChar = '1850001501';
              S.dc.atkCharData = pilot;
              S.dc.lbTier = 2;
              _dcDetectVigorCondAbilities(gz);
              _dcSyncCharCondPassiveFromPair();
              const exIdx = S.dc.atkUnitData.weapons.findIndex(w=>w.is_ex);
              S.dc.wpnIdx = exIdx;
              S.dc.wpnLv = S.dc.atkUnitData.weapons[exIdx].levels.length - 1;
              // 12% OP
              S.dc.optionParts = [{ details: 'Increase Attack by 12%' }];
              // 33% leader
              const supRes = await fetch('/api/supporters?lang=EN&page=1&per_page=100&q=33').then(r=>r.json());
              let supId = null;
              for (const row of supRes.items||[]) {
                const s = await fetch(`/api/supporter/${row.id}?lang=EN&level=100&lb_tier=3&for_unit_id=1850001650&for_char_id=1850001501`).then(r=>r.json());
                if ((s.leader_skills||[]).some(x=>(x.desc||'').includes('33%'))) { supId = row.id; Object.assign(s, {_dcLevel:100,_dcLbTier:3}); S.dc.supporters=[s]; break; }
              }
              S.dc.mpLevel = 'medium';
              S.dc.charCondPassive = false;
              S.dc.unitCondPassive = false;
              S.dc.defTargetMode = 'preset';
              const stage = await fetch('/api/stage/90520001?lang=EN').then(r=>r.json());
              S.dc.defNpc = stage.npc_details.find(n=>n.npc_id==='905200000102000003');
              S.dc.dtuPhysical = 0;
              S.dc.dmgIncrease = 0;
              _dcUpdateSupportCounterAtkUi();
              renderDcAtkUnit(); renderDcAtkChar();
              if (S.dc.atkCharData) _dcRecalcPilotBonuses(true);
              const r = calculateDamage();
              const uMod = _dcGetModifiedAttackerUnitStats(S.dc.atkUnitData.lb_data[2][_dcGetUnitStatKeyForCp(false)]);
              const stats = S.dc.atkUnitData.lb_data[2][_dcGetUnitStatKeyForCp(false)];
              const atkEnt = stats.find(s=>s.name==='Attack');
              return {
                unitId: S.dc.atkUnitData.id,
                roleId: S.dc.atkUnitData.role_id,
                lbTier: S.dc.lbTier,
                atkBase: atkEnt&&atkEnt.base,
                atkTotalLb: atkEnt&&atkEnt.total,
                unitAtkPanel: document.getElementById('dcAtkUnitAtkMain')?.textContent,
                charAwaken: _dcFindStat(_dcGetCharStats(), 'Awaken'),
                charRanged: _dcFindStat(_dcGetCharStats(), 'Ranged'),
                leaderPct: uMod.leaderPct,
                supportCounterPct: uMod.supportCounterPct,
                supportCounterOn: S.dc.supportCounterAtk,
                dmgIncrease: S.dc.dmgIncrease,
                normalDmg: r.normalDmg,
                battleDamage: r.battleDamage,
                unitAtk: r.unitAtk,
                charAtk: r.charAtk,
                weaponPower: r.weaponPower,
                totalNormalMultPct: r.totalNormalMultPct,
                scaledNormal: r.scaledNormal,
                userDmgIncreasePct: r.userDmgIncreasePct,
                charCondPassive: S.dc.charCondPassive,
              };
            }"""
        )
        print(json.dumps(result, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
