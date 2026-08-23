"""Regression: MS growth % bucket rounding (ceil ATK/HP, floor DEF/MOB/EN/Move).

Mirrors _dcMsGrowthFromPct in static/js/app.js.
Also locks supporter ATK flat floor (Atra LV50/1★ → 191, not half-up 192).

Run: python scripts/dc_ms_stat_rounding_test.py
"""
from __future__ import annotations

import math

C = math.ceil
F = math.floor


def ms_growth_from_pct(base: int | float, pct_sum: int | float, stat_name: str) -> int:
    b = F(max(0, float(base)))
    raw = b * (100 + float(pct_sum)) / 100
    if stat_name in ("Attack", "HP"):
        return int(C(raw))
    return int(F(raw))


def supporter_flat(base: int, rate: int) -> int:
    return max(0, F(base * rate / 10000))


def main() -> None:
    # Sandaime LB2 + OP 12% ATK + squad 5/5 + Sumeragi LB1 leader 36% + flats
    sand = dict(
        hp=(90448, 36, 3600, 126610),
        atk=(9370, 53, 240, 14577),
        defense=(8515, 46, 0, 12431),
        mob=(9711, 36, 0, 13206),
        en=(421, 15, 0, 484),
    )
    name_map = {
        "hp": "HP",
        "atk": "Attack",
        "defense": "Defense",
        "mob": "Mobility",
        "en": "EN",
    }
    for stat, (base, pct, flat, want) in sand.items():
        got = ms_growth_from_pct(base, pct, name_map[stat]) + flat
        assert got == want, f"Sandaime {stat}: got {got}, want {want}"

    # Versal LB1 +15% unit passive ATK +12% OP +5% squad +36% leader +240 ATK flat
    versal_atk = ms_growth_from_pct(10126, 15 + 12 + 5 + 36, "Attack") + 240
    assert versal_atk == 17252, versal_atk

    # Barbatos Lupus Rex (EX) LB2 + Atra LV50/1★: floor support ATK 191 (not half-up 192)
    assert supporter_flat(300, 6384) == 191
    assert ms_growth_from_pct(10801, 15 + 12 + 36, "Attack") + 191 == 17797
    assert ms_growth_from_pct(10801, 30 + 12 + 36, "Attack") + 191 == 19417
    assert ms_growth_from_pct(8816, -10 + 36, "Defense") == 11108

    # Round (old bug) would undershoot ATK/HP and overshoot DEF/MOB on Sandaime
    assert int(round(9370 * 1.53)) + 240 == 14576
    assert int(round(8515 * 1.46)) == 12432

    print("dc_ms_stat_rounding_test: OK (ceil MS ATK + floor supporter flat)")


if __name__ == "__main__":
    main()
