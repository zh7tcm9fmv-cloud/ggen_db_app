# -*- coding: utf-8 -*-
import os, sys
sys.path.insert(0, r"c:\Users\Mikew0911\Desktop\ggen_db_app")
os.chdir(r"c:\Users\Mikew0911\Desktop\ggen_db_app")
import meta_synergy_rank as M

A = M._app()
c = A.app.test_client()
uid = "1080003860"
data = c.get(f"/api/unit/{uid}?lang=EN&lb_tier=3").get_json() or {}
for w in data.get("weapons") or []:
    if not (w.get("is_ssp_weapon") or str(w.get("id", "")).endswith("90")):
        continue
    print("id", w.get("id"), "name", w.get("name"))
    print(" is_ssp", w.get("is_ssp_weapon"), "ssp_power_bonus", w.get("ssp_power_bonus"))
    print(" ssp_traits", w.get("ssp_traits"))
    print(" top traits", w.get("traits"))
    levels = w.get("levels") or []
    print(" n levels", len(levels))
    if levels:
        print(" last level", levels[-1].get("level"), "power", levels[-1].get("power"), "traits", levels[-1].get("traits"))
    # simulate JS final power: base * (1+(hp+distCore)/100)
    base = (levels[-1].get("power") if levels else w.get("power")) or 0
    # from python lines
    ld = M._ldc("EN")
    wm = A.weapon_info_map.get(A.normalize_id(w.get("id")), {})
    ws = None
    # get best power from python with fixed parse
    print(" expected if 15%:", int(__import__("math").ceil(base * 1.15)))
    print(" expected if 12%:", int(__import__("math").ceil(base * 1.12)))
