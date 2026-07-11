# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, r"c:\Users\Mikew0911\Desktop\ggen_db_app")
os.chdir(r"c:\Users\Mikew0911\Desktop\ggen_db_app")
import meta_synergy_rank as M

uid = "1080003860"
lc = "EN"
A = M._app()
info = A.unit_info_map.get(uid) or {}
print("unit", uid, "rarity", info.get("rarity"))
sm = M._unit_stat_mode(str(info.get("rarity", "1")))
print("stat_mode", sm)
wpn = M._best_ranking_weapon(uid, sm, lc)
print("best wid", wpn.get("wid"), "power", wpn.get("power"), "mode", wpn.get("stat_mode"))
wm, ws = wpn["wm"], wpn["ws"]
print("ssp_flat", M._ssp_power_bonus(wm.get("id"), wm))
ld = M._ldc(lc)
for j in range(5):
    lv = M._weapon_level_row(ws, j)
    lines = M._weapon_trait_lines(ws, wm, uid, ld, lc, sm, level_idx=j)
    traits = M._parse_weapon_scaling_traits(lines)
    p = M._computed_weapon_power_at_level(ws, wm, uid, ld, lc, sm, j)
    print(f"lv{j} base={lv.get('power')} traits={traits} computed={p} lines={lines[:3]}")

# weapon_info payload
print("weapon_info", M._weapon_info_for_msy(uid, lc))

# Try unit API path for weapon_passive_pct
c = A.app.test_client()
r = c.get(f"/api/unit/{uid}?lang=EN&lb_tier=3")
data = r.get_json() or {}
print("api weapon_passive_pct", data.get("weapon_passive_pct"))
wpns = data.get("weapons") or []
for w in wpns:
    if w.get("is_ssp_weapon") or str(w.get("id", "")).endswith("90"):
        print(
            "api wpn",
            w.get("id"),
            w.get("name"),
            "power",
            w.get("power"),
            "ssp_bonus",
            w.get("ssp_power_bonus"),
            "lv0",
            (w.get("levels") or [{}])[0] if w.get("levels") else None,
        )
