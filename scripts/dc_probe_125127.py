"""Probe final damage rounding for Ranged Boost LV5 loadout (want 125127 not 125128)."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "https://ggendb.up.railway.app"
SHARE = (
    "AXicRY-xbsMwDET_5c0cTnZkuJzbtUvGIEMrp0EQJXVgOBkM_3sheehC4h3B43HhiQfjC5exxw8LM04IXSspRGGkTWiKoAbjdcFb45XxnTEUikaaq8k4pGr5xLmdhst8w5iu-IHQK3SKChyNKf1sV_M33hjTI1VMadwinSr-jjg7SX1XfAoF9ZIUa7hpLOur3eecazka-Yzz8Ynxji_ccd4US_76Qe1t2f0fBNb1D66hQDM"
)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/cal?d={SHARE}", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)
        await page.wait_for_timeout(3000)

        out = await page.evaluate(
            """async () => {
              const cd = S.dc.atkCharData;
              const sk = (cd.skills || []).find(s => /Ranged Boost LV 5/i.test(s.name || ''));
              if (sk) {
                S.dc._activeSkills = S.dc._activeSkills || {};
                S.dc._activeSkills[sk.id] = true;
              }
              const r = calculateDamage();
              if (!r) return { error: 'no result' };

              const F = Math.floor, C = Math.ceil;
              const bd = r.battleDamage;
              const pct = r.totalNormalMultPct | 0;
              const dm = r.defendMult;
              const sn = C(pct * bd / 100);
              const snF = F(pct * bd / 100);
              const snR = Math.round(pct * bd / 100);

              const variants = {
                current: r.normalDmg,
                ceil_bd_plus_ceil_sn: C((bd + C(pct * bd / 100)) * dm),
                floor_bd_plus_ceil_sn: C((bd + F(pct * bd / 100)) * dm),
                ceil_bd_plus_floor_sn: C((bd + F(pct * bd / 100)) * dm),
                floor_combined: F((bd + pct * bd / 100) * dm),
                floor_bd_plus_sn_floor: F(bd * dm) + F(pct * bd / 100 * dm),
                ceil_combined_no_split: C((bd + (pct * bd / 100)) * dm),
                floor_final_only: F((bd + C(pct * bd / 100)) * dm),
                battle_floor_then_scale: C(F(bd) + C(F(bd) * pct / 100)),
              };

              // split correction path
              const off = r.offenseComponent * r.baseDamage;
              const def = r.defenseComponent * r.baseDamage;
              const bds = C((r.baseDamage + C(off) + C(def)) * r.terrainCorrection);
              const skipSplit = pct > 0 && ((bd * pct) % 100 === 0);
              const bdAdj = (!skipSplit && bds === bd + 1) ? bds : bd;

              return {
                target: 125127,
                skillOn: !!(sk && S.dc._activeSkills[sk.id]),
                charAtk: r.charAtk,
                unitAtk: r.unitAtk,
                weaponPower: r.weaponPower,
                combatWeaponPower: r.combatWeaponPower,
                baseDamage: r.baseDamage,
                battleDamage: r.battleDamage,
                battleDamageSplit: bds,
                skipSplit,
                bdAdj,
                totalNormalMultPct: r.totalNormalMultPct,
                scaledNormal: r.scaledNormal,
                defendMult: r.defendMult,
                normalDmg: r.normalDmg,
                variants,
                match: Object.fromEntries(
                  Object.entries(variants).filter(([, v]) => v === 125127)
                ),
              };
            }"""
        )
        print(json.dumps(out, indent=2, default=str))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
