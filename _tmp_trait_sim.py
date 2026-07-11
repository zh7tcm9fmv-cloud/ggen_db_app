# -*- coding: utf-8 -*-
"""Simulate what JS _dcParseWeaponTraits would return for Psycho SSP weapon."""
import math
import re

traits_lines = [
    "The lower your remaining HP is, the greater Weapon Power increases (up to 12% increase).",
]
ssp_traits = [
    "[Custom Core Effect] Weapon Effect Value Up (& Maximum Up 3%)",
]

def extract_max_up(txt):
    s = str(txt)
    for pat in [
        r"Maximum\s+Up\s+(\d+)%",
        r"\(\s*&\s*Maximum\s+Up\s+(\d+)%\s*\)",
        r"さらに最大値(\d+)%上昇",
        r"且最大值提升(\d+)%",
    ]:
        m = re.search(pat, s, re.I)
        if m:
            return int(m.group(1))
    return 0

hp = 0
dist = 0
dist_core = 0
mp = 0
for txt in traits_lines:
    m = re.search(
        r"(?:lower|higher)\s+(?:(?:this\s+unit'?s|your|own)\s+)?remaining\s+HP.*?"
        r"(?:more|greater)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%",
        txt,
        re.I,
    )
    if m:
        hp = max(hp, int(m.group(1)))

ssp_core = 0
for raw in ssp_traits:
    ssp_core = max(ssp_core, extract_max_up(raw))

# JS SSP-variant branch: always distCoreMax
dist_core_ssp = ssp_core
# Non-SSP branch: add to hp if hp>0
hp_non = hp + (ssp_core if hp else 0)

base = 6060
js_ssp = math.ceil(base * (1 + (dist + dist_core_ssp + hp + mp) / 100))
js_fix = math.ceil(base * (1 + (0 + 0 + hp_non + 0) / 100))
print("ssp_core", ssp_core, "hp", hp)
print("JS SSP-branch total%", dist + dist_core_ssp + hp, "power", js_ssp)
print("JS HP-stack total%", hp_non, "power", js_fix)

# Python current parse
from meta_synergy_rank import _parse_weapon_scaling_traits, _weapon_trait_lines, _app, _ldc, _computed_weapon_power_at_level, _best_ranking_weapon, _unit_stat_mode
import os, sys
sys.path.insert(0, r"c:\Users\Mikew0911\Desktop\ggen_db_app")
os.chdir(r"c:\Users\Mikew0911\Desktop\ggen_db_app")
import meta_synergy_rank as M
A = M._app()
uid = "1080003860"
wpn = M._best_ranking_weapon(uid, "ssp", "EN")
lines = M._weapon_trait_lines(wpn["ws"], wpn["wm"], uid, M._ldc("EN"), "EN", "ssp", level_idx=4)
print("python lines", lines)
print("python parse", M._parse_weapon_scaling_traits(lines))
print("python power", wpn["power"])
# show which pattern matches Maximum Up line
for raw in lines:
    txt = str(raw)
    for name, pat in M._WEAPON_TRAIT_PATTERNS:
        m = pat.search(txt.replace("\n", " "))
        if m:
            print(" matched", name, "on", txt[:80], "groups", m.groups())
            break
    else:
        print(" NO MATCH", txt[:100])
