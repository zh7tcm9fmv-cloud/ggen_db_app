"""Verify 1163000150 damage fix on local server."""
import asyncio
import json
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:5050"
SHARE = (
    "AXicRY6xDoJAEET_5dVb7IEQ3FpbG0tjoQcakgMxBCgI_27uKGx282YzO7MyY054YCpcsdvKhOFcmauqKxTB70IWBc0QlhbLhSVgB6GOVAh-Sk-G2qeXM0bX1O3UIYz-tUeEJ5YJ49cn9H7Y85uEnwHjoKpVGU2RnFaqqkVqMg7Rvkk_hZDGXQhvjPMF4YSt9BhHLWLZVDftPHr_B8e2_QA9Jjvp"
)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{BASE}/cal?d={SHARE}", wait_until="networkidle", timeout=120_000)
        await page.wait_for_function(
            "() => typeof calculateDamage === 'function' && S.dc.atkUnitData && S.dc.defNpc",
            timeout=120_000,
        )
        await page.wait_for_timeout(3000)
        out = await page.evaluate(
            """() => {
              const r = calculateDamage();
              if (!r) return { error: 'no result' };
              return {
                normalDmg: r.normalDmg,
                unitAtk: r.unitAtk,
                weaponPower: r.weaponPower,
                wantDmg: 104972,
                wantWp: 8496,
                ok: r.normalDmg === 104972 && r.weaponPower === 8496 && r.unitAtk === 19307,
              };
            }"""
        )
        print(json.dumps(out, indent=2))
        if not out.get("ok"):
            raise SystemExit(1)
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
