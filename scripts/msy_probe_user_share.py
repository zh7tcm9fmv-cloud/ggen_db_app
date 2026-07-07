import asyncio
import json

from playwright.async_api import async_playwright

SHARE_URL = (
    "https://ggendb.up.railway.app/cal?d=AXicrdExSwNBEMXx7_Kvp3i7lyXe1NraWIYUYS9KMMjpeklx3HeX2xMFMZjC6sEO--YHM3LCg7HDZTzgm5EBJ0RJatokjPz1oKAG43zAo3E-4iujO-BNMvJQS_ou18oTThn6_RtGecY3hFYhKSmwNUp-XJaW11zzvcOjjCH39X_-zN0e12SXXE3TVpd-da2ucq3ngtllP4wXaH-Q1CYp3NS-fyBFKayvI22N4xPO3T3GLT7ygtMqLdeLWnK-YfkeRKbpA6LMepg"
)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(SHARE_URL, wait_until="networkidle", timeout=180_000)
        await page.wait_for_function(
            "() => S.dc.atkSlots && S.dc.atkSlots[0] && typeof calculateDamage === 'function'",
            timeout=180_000,
        )
        await page.wait_for_timeout(3000)

        out = await page.evaluate(
            """() => {
              const rows = [];
              for (let i = 0; i < 3; i++) {
                S.dc.atkSlotIndex = i;
                _dcWriteAttackerToDc(S.dc.atkSlots[i]);
                S.dc._wpnCritDmgUp = _dcCritDmgUpFromWeapon(S.dc.atkUnitData, S.dc.wpnIdx, S.dc.wpnLv) | 0;
                _dcRecalcPilotBonuses(true);
                const r = calculateDamage();
                const sl = S.dc.atkSlots[i];
                const cd = sl.atkCharData, ud = sl.atkUnitData;
                rows.push({
                  slot: i,
                  pilot: cd?.name,
                  cid: sl.atkChar,
                  superCrit: r?.critDmg,
                  normal: r?.normalDmg,
                  battle: r?.battleDamage,
                  base: r?.baseDamage,
                  unitAtk: r?.unitAtk,
                  charAtk: r?.charAtk,
                  unitDef: r?.unitDef,
                  charDef: r?.charDef,
                  di: S.dc.dmgIncrease,
                  cu: S.dc.critDmgUp,
                  totalCritMult: r?.totalCritMultPct,
                  charCP: sl.charCondPassive,
                  ucp: sl.unitCondPassive,
                  ccp: sl.charCondPassiveOn,
                  pairOk: _dcUnitCharPairMatch(cd, ud),
                  defU: S.dc.defNpc?.unit?.stats_raw?.Defense,
                  defC: S.dc.defNpc?.character?.stats_raw?.Defense,
                  defName: S.dc.defNpc?.unit?.name,
                  stage: document.getElementById('dcStageSelect')?.value || '',
                  defMode: S.dc.defTargetMode,
                  skills: Object.keys(sl._activeSkills || {}).filter(k => sl._activeSkills[k]),
                  uiCrit: document.querySelectorAll('.dc-dmg-crit-val')[i]?.textContent?.trim(),
                  uiNormal: document.querySelectorAll('.dc-dmg-normal-val')[i]?.textContent?.trim(),
                });
              }
              rows.sort((a, b) => (b.superCrit || 0) - (a.superCrit || 0));
              return {
                stage: document.getElementById('dcStageSelect')?.value,
                defName: S.dc.defNpc?.unit?.name,
                defNpc: S.dc.defNpc?.npc_id,
                rows,
              };
            }"""
        )
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
