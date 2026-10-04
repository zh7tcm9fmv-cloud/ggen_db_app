"""Regression: MS growth % is integer floor for every stat.

Mirrors _dcMsGrowthFromPct in static/js/app.js.
Also locks supporter ATK flat floor (Atra LV50/1★ → 191, not half-up 192).

Run: python scripts/dc_ms_stat_rounding_test.py
"""
from __future__ import annotations

import math

F = math.floor


def ms_growth_from_pct(base: int | float, pct_sum: int | float, stat_name: str) -> int:
    del stat_name
    b = F(max(0, float(base)))
    p = F(float(pct_sum))
    return (b * (100 + p)) // 100


def supporter_flat(base: int, rate: int) -> int:
    return max(0, F(base * rate / 10000))


def main() -> None:
    # V2 Assault Buster (EX) LB3 + Limiter OFF 12% ATK + Carozzo LB1 leader 36% / flats (in-game 2026-10)
    assert ms_growth_from_pct(98260, 10 + 36, "HP") + 2400 == 145859
    assert ms_growth_from_pct(11961, 15 + 12 + 36, "Attack") + 360 == 19856
    assert ms_growth_from_pct(9081, 36, "Defense") == 12350
    assert ms_growth_from_pct(10095, 36, "Mobility") == 13729

    # Sandaime LB2 + OP 12% ATK + squad 5/5 + Sumeragi LB1 leader 36% + flats (integer floor)
    sand = dict(
        hp=(90448, 36, 3600, 126609),
        atk=(9370, 53, 240, 14576),
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

    versal_atk = ms_growth_from_pct(10126, 15 + 12 + 5 + 36, "Attack") + 240
    assert versal_atk == 17251, versal_atk

    hyaku_atk = ms_growth_from_pct(10015, 15 + 12 + 40 + 5, "Attack") + 390
    assert hyaku_atk == 17615, hyaku_atk

    dg_atk = ms_growth_from_pct(7580, 20 + 12 + 25 + 2, "Attack") + 300
    assert dg_atk == 12352, dg_atk
    dg_def = ms_growth_from_pct(6535, 25 + 2, "Defense")
    assert dg_def == 8299, dg_def
    dg_hp = ms_growth_from_pct(71806, 5 + 25, "HP") + 2000
    assert dg_hp == 95347, dg_hp
    dg_mob = ms_growth_from_pct(7192, 25, "Mobility")
    assert dg_mob == 8990, dg_mob

    assert ms_growth_from_pct(8476, 15 + 12 + 36, "Attack") + 240 == 14055
    assert ms_growth_from_pct(6237, 36, "Defense") == 8482
    assert ms_growth_from_pct(69725, 36, "HP") + 3600 == 98426
    assert ms_growth_from_pct(7238, 36, "Mobility") == 9843

    assert supporter_flat(300, 6384) == 191
    assert ms_growth_from_pct(10801, 15 + 12 + 36, "Attack") + 191 == 17796
    assert ms_growth_from_pct(10801, 30 + 12 + 36, "Attack") + 191 == 19416
    assert ms_growth_from_pct(8816, -10 + 36, "Defense") == 11108

    print("dc_ms_stat_rounding_test: OK (integer-floor MS growth + supporter flat)")


if __name__ == "__main__":
    main()
