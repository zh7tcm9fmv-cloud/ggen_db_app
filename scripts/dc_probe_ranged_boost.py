"""Probe Ranged Boost LV 5 rounding for 1162000102 + 1163000150."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "https://ggendb.up.railway.app"
SHARE = (
    "AXicRY6xDoJAEET_5dVb7IEQ3FpbG0tjoQcakgMxBCgI_27uKGx282YzO7MyY054YCpcsdvKhOFcmauqKxTB70IWBc0QlhbLhSVgB6GOVAh-Sk-G2qeXM0bX1O3UIYz-tUeEJ5YJ49cn9H7Y85uEnwHjoKpVGU2RnFaqqkVqMg7Rvkk_hZDGXQhvjPMF4YSt9BhHLWLZVDftPHr_B8e2_QA9Jjvp"
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
              if (!sk) return { error: 'skill not found', skills: (cd.skills || []).map(s => s.name) };

              // enable skill
              S.dc._activeSkills = S.dc._activeSkills || {};
              S.dc._activeSkills[sk.id] = true;

              const stats = _dcGetCharStats();
              const wpns = _dcNonMapWeapons(S.dc.atkUnitData);
              const wpn = wpns[S.dc.wpnIdx];
              const ent = _dcFindStatEntry(stats, 'Ranged');
              const skPct = _dcGetActiveSkillStatPct();
              const pct = skPct.Ranged || 0;

              const passive = Math.round(Number(ent.total) || 0);
              const base = Math.max(0, Number(ent.base) || 0);
              const bonusCeil = Math.ceil(base * pct / 100);
              const bonusFloor = Math.floor(base * pct / 100);
              const totalCeil = passive + bonusCeil;
              const totalFloor = passive + bonusFloor;
              const charAtk = _dcGetCharAtkStatWithSkills(stats, wpn);

              const rOff = calculateDamage();
              return {
                skillId: sk.id,
                skillName: sk.name,
                pct,
                base,
                passive,
                bonusCeil,
                bonusFloor,
                totalCeil,
                totalFloor,
                charAtk,
                targetBonus: 1033,
                normalDmg: rOff ? rOff.normalDmg : null,
                ent,
              };
            }"""
        )
        print(json.dumps(out, indent=2, default=str))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
