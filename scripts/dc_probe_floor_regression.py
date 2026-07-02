"""Qubeley + 1163000150 floor vs ceil regression on production."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "https://ggendb.up.railway.app"
QUBELEY = "eyJ2IjoxLCJhIjowLCJTIjpbeyJ1IjoiMTA5NTAwMjU1MCIsImMiOiIxMDk1MDAxODAxIiwid2kiOjMsIndsIjo0LCJkaSI6MzUsImV4YSI6MjAsInRkIjoyMCwib3AiOiI0MDAwMjUiLCJzcCI6IjEwODAwMDA1NTAiLCJzcGIiOjJ9LG51bGwsbnVsbF0sIkQiOnsibiI6IjkwNTIwMDAwMDEwMjAwMDAwMyIsInMiOiI5MDUyMDAwMSIsImRlZnAiOjQwfX0"
UNIT1163 = "AXicRY6xDoJAEET_5dVb7IEQ3FpbG0tjoQcakgMxBCgI_27uKGx282YzO7MyY054YCpcsdvKhOFcmauqKxTB70IWBc0QlhbLhSVgB6GOVAh-Sk-G2qeXM0bX1O3UIYz-tUeEJ5YJ49cn9H7Y85uEnwHjoKpVGU2RnFaqqkVqMg7Rvkk_hZDGXQhvjPMF4YSt9BhHLWLZVDftPHr_B8e2_QA9Jjvp"


async def probe(page, share, label, want):
    await page.goto(f"{BASE}/cal?d={share}", wait_until="networkidle", timeout=120_000)
    await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)
    await page.wait_for_timeout(2000)
    return await page.evaluate(
        """([label, want]) => {
          const r = calculateDamage();
          const lb = S.dc.atkUnitData.lb_data;
          const tier = Math.min(S.dc.lbTier, lb.length - 1);
          const statKey = _dcGetUnitStatKey();
          const td = lb[tier];
          const atkUnitStats = td[statKey] || td.stats_no_cond;
          const uFloor = _dcGetModifiedAttackerUnitStatsFromCtx(S.dc, atkUnitStats, { forDamage: false });
          const uCeil = _dcGetModifiedAttackerUnitStatsFromCtx(S.dc, atkUnitStats, { forDamage: true });
          return {
            label,
            want,
            normalDmg: r.normalDmg,
            unitAtk: r.unitAtk,
            floorAtk: uFloor.unitAtk,
            ceilAtk: uCeil.unitAtk,
            matchWant: r.normalDmg === want,
          };
        }""",
        [label, want],
    )


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        results = []
        results.append(await probe(page, QUBELEY, "qubeley", 244944))
        results.append(await probe(page, UNIT1163, "1163000150", 104972))
        print(json.dumps(results, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
