"""Decode and probe share link with defend+shield."""
import asyncio
import json
import zlib
import base64
import re
from playwright.async_api import async_playwright

SHARE = (
    "AXicjZCxbsJAEET_ZeotZm0fcraGNg1llMLcmcTSQYyMobD87-jOCCtSilSrmd0ZPe2EG0wFDYyCPexjwgiD1o6kbhwh8KvhqBDcO1gluMc8QgdTJ_BjLumDz5U3GE5t6MYTBIM_NtmNB1ghGC4-Hw_Ncty0Wf70MFQkN3UKJaWsSdJlkqFP8VmekFpVr5VfDWXxhCx_QZb_hcx0TnANsIIC7_s_KWu-KFW5_AeznMcYPwXxC4bdOwRb2IQzDG90Bbkg5lmmgnWRnhva4wLxDdN5fgA8aGNN"
)
BASE = "http://127.0.0.1:5050"


def b64url_decode(s):
    pad = s.replace("-", "+").replace("_", "/")
    while len(pad) % 4:
        pad += "="
    return base64.b64decode(pad)


def decode_share(raw):
    u8 = b64url_decode(raw)
    kind = u8[0]
    body = u8[1:]
    if kind == 1:
        return json.loads(zlib.decompress(body, 15))
    if kind == 2:
        return json.loads(body.decode("utf-8"))
    return json.loads(b64url_decode(raw).decode("utf-8"))


async def main():
    obj = decode_share(SHARE)
    print("=== decoded share (summary) ===")
    print(json.dumps(obj, indent=2)[:4000])

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        url = f"{BASE}/cal?d={SHARE}"
        await page.goto(url, wait_until="networkidle", timeout=120_000)
        await page.wait_for_function("() => typeof calculateDamage === 'function'", timeout=120_000)
        await page.wait_for_timeout(2000)

        out = await page.evaluate(
            """() => {
              function snap(label) {
                const r = calculateDamage();
                if (!r) return { label, error: 'no result' };
                return {
                  label,
                  normalDmg: r.normalDmg,
                  critDmg: r.critDmg,
                  battleDamage: r.battleDamage,
                  baseDamage: r.baseDamage,
                  damageCorrection: r.damageCorrection,
                  unitAtk: r.unitAtk,
                  charAtk: r.charAtk,
                  weaponPower: r.weaponPower,
                  totalNormalMultPct: r.totalNormalMultPct,
                  defendMult: r.defendMult,
                  scaledNormal: r.scaledNormal,
                  defending: S.dc.defending,
                  shield: S.dc.shield,
                  charCondPassive: S.dc.charCondPassive,
                  mpLevel: S.dc.mpLevel,
                  dmgIncrease: S.dc.dmgIncrease,
                };
              }
              const results = [snap('loaded')];
              S.dc.defending = true;
              S.dc.shield = true;
              results.push(snap('defend+shield'));
              S.dc.defending = true;
              S.dc.shield = false;
              results.push(snap('defend only'));
              S.dc.defending = false;
              S.dc.shield = false;
              results.push(snap('off'));

              // rounding variants on defend+shield
              S.dc.defending = true;
              S.dc.shield = true;
              const r = calculateDamage();
              const C = Math.ceil;
              const bd = r.baseDamage;
              const oc = r.offenseComponent * bd;
              const dc = r.defenseComponent * bd;
              const dm = 0.6;
              const bdm = C((bd + (oc + dc)) * r.terrainCorrection);
              const bdmSplit = C((bd + C(oc) + C(dc)) * r.terrainCorrection);
              const N = r.totalNormalMultPct;
              const variants = {};
              for (const [name, b] of [['cur', r.battleDamage], ['split', bdmSplit]]) {
                const sn = C(N * b / 100);
                variants[name + '_ceil'] = C((b + sn) * dm);
                variants[name + '_sn_ceil'] = C(b * dm + C(sn * dm));
                variants[name + '_combined_ceil'] = C((b + C(N * b / 100)) * dm);
              }
              return { results, variants, offenseComponent: r.offenseComponent, defenseComponent: r.defenseComponent };
            }"""
        )
        print("\n=== live calc ===")
        print(json.dumps(out, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
