"""Probe Great Zeong with user-reported loadout."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5050"


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)

        result = await page.evaluate(
            """async () => {
              const gz = await fetch('/api/unit/1850001650?lang=EN&lb_tier=2').then(r=>r.json());
              const pilot = await fetch('/api/character/1850001501?lang=EN').then(r=>r.json());
              const stage = await fetch('/api/stage/90520001?lang=EN').then(r=>r.json());
              const npc = stage.npc_details.find(n=>n.npc_id==='905200000102000003');
              const supRes = await fetch('/api/supporters?lang=EN&page=1&per_page=100&q=33').then(r=>r.json());
              let supId = null;
              for (const row of supRes.items||[]) {
                const s = await fetch(`/api/supporter/${row.id}?lang=EN&level=100&lb_tier=3`).then(r=>r.json());
                if ((s.leader_skills||[]).some(x=>(x.desc||'').includes('33%'))) { supId = row.id; break; }
              }
              const supData = supId ? await fetch(`/api/supporter/${supId}?lang=EN&level=100&lb_tier=3`).then(r=>r.json()) : null;

              async function runCase(label, cfg) {
                S.dc.atkUnitData = gz;
                S.dc.atkCharData = pilot;
                S.dc.defNpc = npc;
                S.dc.lbTier = 2;
                S.dc.wpnIdx = gz.weapons.findIndex(w=>w.is_ex);
                const ex = gz.weapons[S.dc.wpnIdx];
                S.dc.wpnLv = ex.levels.length - 1;
                S.dc.optionParts = [{ details: 'Increase Attack by 12%' }];
                S.dc.supporters = supData ? [{ ...supData, _dcLevel:100, _dcLbTier:3 }] : [];
                S.dc.dtuPhysical = cfg.dtu ?? 35;
                S.dc.dmgIncrease = cfg.dmgInc ?? 0;
                S.dc.critDmgUp = 0;
                S.dc.mpLevel = cfg.mp ?? 'medium';
                S.dc.terrain = 0;
                S.dc.defending = false;
                S.dc.defNpcMapBonusesOn = false;
                S.dc.unitCondPassive = !!cfg.ucp;
                S.dc.charCondPassive = !!cfg.ccp;
                S.dc.supportCounterAtk = !!cfg.sac;
                S.dc.finalWpnPow = 0;
                S.dc.exSquadAtkPct = 0;
                S.dc.squadCondPct = 0;
                if (S.dc.atkCharData && !S.dc.atkCharData._manual) _dcRecalcPilotBonuses(true);
                const r = calculateDamage();
                return { label, cfg, normalDmg: r.normalDmg, battleDamage: r.battleDamage, baseDamage: r.baseDamage,
                  unitAtk: r.unitAtk, charAtk: r.charAtk, charDef: r.charDef, weaponPower: r.weaponPower,
                  totalNormalMultPct: r.totalNormalMultPct, scaledNormal: r.scaledNormal,
                  userDmgIncreasePct: r.userDmgIncreasePct, supportCounterAtkPctApplied: r.supportCounterAtkPctApplied };
              }

              const cases = [
                ['baseline med vigor no CP', { mp:'medium', ccp:0, ucp:0, sac:0 }],
                ['super vigor no CP', { mp:'super', ccp:0, ucp:0, sac:0 }],
                ['super vigor CP on', { mp:'super', ccp:1, ucp:0, sac:0 }],
                ['med vigor CP on (wrong?)', { mp:'medium', ccp:1, ucp:0, sac:0 }],
                ['super CP + support counter', { mp:'super', ccp:1, ucp:0, sac:1 }],
                ['med no CP + support counter', { mp:'medium', ccp:0, ucp:0, sac:1 }],
                ['med no CP + sac + dmgInc 20', { mp:'medium', ccp:0, ucp:0, sac:1, dmgInc:20 }],
              ];
              const out = [];
              for (const [label, cfg] of cases) out.push(await runCase(label, cfg));
              return out;
            }"""
        )
        print(json.dumps(result, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
