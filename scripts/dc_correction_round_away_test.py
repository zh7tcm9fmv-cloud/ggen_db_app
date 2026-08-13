"""Regression: DC correction slices round away from 0 (Graze Ein +2 bug).

In-game Versal LB1 + UCP + Melee Boost + Super vs Graze Ein (90520024) → 218515.
Float-sum then ceil overshoots to 218517. Both-Math.ceil also wrong on soft targets.

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
    if mode == "float":
        corr = (off + deff) * base
        battle = C(base + corr)
    elif mode == "both_ceil":
        battle = C(base + C(off * base) + C(deff * base))
    elif mode == "away0":
        battle = base + round_away_0(off * base) + round_away_0(deff * base)
    else:
        raise ValueError(mode)
    return MX(0, C(battle + C((di + vigor) * battle / 100)))


def main() -> None:
    # Graze Ein hard DEF, UCP unit ATK 18689, melee 1062, EX+20% WP, +35% dealt, Super
    ge = dict(unit_atk=18689, char_atk=1062, unit_def=20780, char_def=608, wpn=9648, di=35, vigor=30)
    assert normal_dmg(**ge, mode="away0") == 218515, normal_dmg(**ge, mode="away0")
    assert normal_dmg(**ge, mode="float") == 218517

    # Prior soft-target check: Kimaris Vidar, no UCP/skill, High vigor → 238778
    kv = dict(unit_atk=17170, char_atk=885, unit_def=11494, char_def=602, wpn=9648, di=35, vigor=10)
    assert normal_dmg(**kv, mode="away0") == 238778, normal_dmg(**kv, mode="away0")
    assert normal_dmg(**kv, mode="float") == 238778

    print("dc_correction_round_away_test: OK (Graze Ein 218515 + Vidar 238778)")


if __name__ == "__main__":
    main()
