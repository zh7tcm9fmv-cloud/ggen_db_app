"""Regression: DC correction rounding (Firered ⑦ + in-game spot checks).

Graze Ein (hard DEF): per-slice round-away — float-sum overshoots +2.
Versal vs Xi (stage squad DEF): combined float round-away when sum fraction ≥ 0.1.

Run: python scripts/dc_correction_round_away_test.py
"""
from __future__ import annotations

import math


def C(x: float) -> int:
    return math.ceil(x)


def F(x: float) -> int:
    return math.floor(x)


def round_away_0(x: float) -> int:
    return C(x) if x >= 0 else F(x)


def damage_correction(off: float, deff: float, base: int, *, mode: str) -> int:
    off_raw = off * base
    def_raw = deff * base
    sum_raw = off_raw + def_raw
    split = round_away_0(off_raw) + round_away_0(def_raw)
    if mode == "float":
        return round_away_0(sum_raw)
    if mode == "both_ceil":
        return C(off_raw) + C(def_raw)
    if mode == "away0":
        return split
    if mode == "hybrid":
        frac = sum_raw - F(sum_raw)
        return round_away_0(sum_raw) if frac >= 0.1 else split
    raise ValueError(mode)


def normal_dmg(
    unit_atk: int,
    char_atk: int,
    unit_def: int,
    char_def: int,
    wpn: int,
    di: int,
    vigor: int,
    *,
    mode: str,
) -> int:
    MX, EXP = max, math.exp
    character_stat_ratio = MX(0, char_atk - char_def) / 5000
    unit_stat_ratio = MX(0, C(unit_atk / 10 - unit_def / 10)) / 5000
    char_sigmoid = 1 / (EXP(250 * (char_def - char_atk) / 100000) + 1)
    unit_sigmoid = 1 / (EXP(25 * (unit_def - unit_atk) / 100000) + 1)
    base = C((character_stat_ratio + unit_stat_ratio + char_sigmoid + unit_sigmoid) * wpn)
    atk_c = C((unit_atk + 2 * char_atk) / 10)
    def_c = C((unit_def + 2 * char_def) / 10)
    off = 100 / (EXP(((5000 - atk_c) * 30) / 100000) + 1)
    deff = -40 / (EXP(((5000 - def_c) * 3) / 100000) + 1)
    corr = damage_correction(off, deff, base, mode=mode)
    battle = C(base + corr)
    return MX(0, C(battle + C((di + vigor) * battle / 100)))


def main() -> None:
    ge = dict(unit_atk=18689, char_atk=1062, unit_def=20780, char_def=608, wpn=9648, di=35, vigor=30)
    kv = dict(unit_atk=17170, char_atk=885, unit_def=11494, char_def=602, wpn=9648, di=35, vigor=10)
    xi = dict(unit_atk=17252, char_atk=885, unit_def=15478, char_def=738, wpn=9648, di=35, vigor=10)
    nu = dict(unit_atk=17252, char_atk=885, unit_def=20400, char_def=706, wpn=9648, di=35, vigor=10)
    wing = dict(unit_atk=17252, char_atk=885, unit_def=20343, char_def=696, wpn=9648, di=35, vigor=10)

    assert normal_dmg(**ge, mode="hybrid") == 218515
    assert normal_dmg(**ge, mode="float") == 218517
    assert normal_dmg(**kv, mode="hybrid") == 238778
    assert normal_dmg(**xi, mode="hybrid") == 182303
    assert normal_dmg(**xi, mode="away0") == 182302
    assert normal_dmg(**nu, mode="hybrid") == 136213
    assert normal_dmg(**wing, mode="hybrid") == 137807

    print("dc_correction_round_away_test: OK (Graze 218515, Xi 182303, Nu/Wing/Vidar)")


if __name__ == "__main__":
    main()
