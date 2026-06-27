"""Probe damage calc for Great Zeong vs Psycho (Eternal Expert 1)."""
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

        async def load_unit(uid, lb=2):
            return await page.evaluate(
                """async ({ uid, lb }) => {
                  const res = await fetch(`/api/unit/${uid}?lang=EN&lb_tier=${lb}`);
                  return res.json();
                }""",
                {"uid": uid, "lb": lb},
            )

        async def load_char(cid):
            return await page.evaluate(
                """async ({ cid }) => {
                  const res = await fetch(`/api/character/${cid}?lang=EN&level=100&lb_tier=3`);
                  return res.json();
                }""",
                {"cid": cid},
            )

        async def load_stage(sid):
            return await page.evaluate(
                """async ({ sid }) => {
                  const res = await fetch(`/api/stage/${sid}?lang=EN`);
                  return res.json();
                }""",
                {"sid": sid},
            )

        gz = await load_unit("1850001650", 2)
        pilot = await load_char("1850001501")
        stage = await load_stage("90520001")
        npc = next(
            n
            for n in stage.get("npc_details", [])
            if n.get("npc_id") == "905200000102000003"
        )

        # Find 33% all-stats supporter (Psycommu lineage tag filter in UI; use known leader skill text)
        supp_id = await page.evaluate(
            """async () => {
              const res = await fetch('/api/supporters?lang=EN&page=1&per_page=100&q=33');
              const d = await res.json();
              for (const row of d.items || []) {
                const r2 = await fetch(`/api/supporter/${row.id}?lang=EN&level=100&lb_tier=3`);
                const s = await r2.json();
                const ls = (s.leader_skills || []).find(x => (x.desc||'').includes('33%'));
                if (ls) return row.id;
              }
              return null;
            }"""
        )

        result = await page.evaluate(
            """async ({ gz, pilot, npc, suppId }) => {
              S.dc.atkUnitData = gz;
              S.dc.atkCharData = pilot;
              S.dc.defNpc = npc;
              S.dc.lbTier = 2;
              S.dc.wpnIdx = (gz.weapons||[]).findIndex(w => w.is_ex);
              const ex = gz.weapons[S.dc.wpnIdx];
              S.dc.wpnLv = ex && ex.levels ? ex.levels.length - 1 : 0;
              S.dc.optionParts = [{ details: 'Increase Attack by 12%' }];
              S.dc.supporters = suppId ? [{ id: suppId, _dcLevel: 100, _dcLbTier: 3 }] : [];
              if (suppId) {
                const r = await fetch(`/api/supporter/${suppId}?lang=EN&level=100&lb_tier=3`);
                Object.assign(S.dc.supporters[0], await r.json());
              }
              S.dc.dtuPhysical = 35;
              S.dc.dmgIncrease = 0;
              S.dc.critDmgUp = 0;
              S.dc.mpLevel = 'medium';
              S.dc.terrain = 0;
              S.dc.defending = false;
              S.dc.defNpcMapBonusesOn = false;
              S.dc.unitCondPassive = false;
              S.dc.charCondPassive = false;
              S.dc.finalWpnPow = 0;
              const r = calculateDamage();
              return {
                normalDmg: r.normalDmg,
                battleDamage: r.battleDamage,
                baseDamage: r.baseDamage,
                unitAtk: r.unitAtk,
                charAtk: r.charAtk,
                charDef: r.charDef,
                unitDef: r.unitDef,
                weaponPower: r.weaponPower,
                totalNormalMultPct: r.totalNormalMultPct,
                scaledNormal: r.scaledNormal,
                atkCombined: r.atkCombined,
                defCombined: r.defCombined,
                damageCorrection: r.damageCorrection,
              };
            }""",
            {"gz": gz, "pilot": pilot, "npc": npc, "suppId": supp_id},
        )

        print("live:", json.dumps(result, indent=2))

        variants = await page.evaluate(
            """() => {
              function ndFrom(bdm, N) {
                const C = Math.ceil;
                const sn = C((N * bdm) / 100);
                return C(bdm + sn);
              }
              function bdmFrom(ua, ca, defCd, defUd, wp, mode) {
                const C = Math.ceil, MX = Math.max, EXP = Math.exp;
                const csr = MX(0, ca - defCd) / 5000;
                const usr = MX(0, C(ua / 10 - defUd / 10)) / 5000;
                const csig = 1 / (EXP((250 * (defCd - ca)) / 100000) + 1);
                const usig = 1 / (EXP((25 * (defUd - ua)) / 100000) + 1);
                const bd = C((csr + usr + csig + usig) * wp);
                const ac = C((ua + 2 * ca) / 10);
                const dc = C((defUd + 2 * defCd) / 10);
                const oc = 100 / (EXP(((5000 - ac) * 30) / 100000) + 1);
                const df = -40 / (EXP(((5000 - dc) * 3) / 100000) + 1);
                const dcorr = (oc + df) * bd;
                if (mode === 'sep') return C(bd + C(dcorr));
                if (mode === 'addC') return C(bd) + C(dcorr);
                return C(bd + dcorr);
              }
              const wp = 6360;
              const ca = 807, defCd = 705, defUd = 25072;
              const out = [];
              for (let lp of [0, 12, 33, 45]) {
                const ua = Math.ceil(9779 * (100 + lp) / 100);
                for (const mode of ['cur', 'sep', 'addC']) {
                  const bdm = bdmFrom(ua, ca, defCd, defUd, wp, mode);
                  for (const N of [0, 35]) {
                    out.push({ lp, ua, mode, N, bdm, nd: ndFrom(bdm, N) });
                  }
                }
              }
              return out;
            }"""
        )
        print("variants:", json.dumps([v for v in variants if 28495 <= v["nd"] <= 28505], indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
