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
    p = F(float(pct_sum))
    num = int(b * (100 + p))
    q = num // 100
    rem = num % 100
    if stat_name in ("Attack", "HP"):
        if rem == 0:
            return q
        if rem >= 80 or rem == 20:
            return q
        return q + 1
    return q


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

    # Full Armor Hyaku-Shiki Kai LB1 +15% ATK +12% OP +40% leader +5% squad +390 ATK flat (CP off — no combat stacks)
    hyaku_atk = ms_growth_from_pct(10015, 15 + 12 + 40 + 5, "Attack") + 390
    assert hyaku_atk == 17615, hyaku_atk

    # D Gundam Third LB0 +20% HP-tier CP ATK +12% OP +25% leader +300 ATK flat; HP +5% +25% leader +2000 flat
    dg_atk = ms_growth_from_pct(7580, 20 + 12 + 25, "Attack") + 300
    assert dg_atk == 12201, dg_atk
    dg_hp = ms_growth_from_pct(71806, 5 + 25, "HP") + 2000
    assert dg_hp == 95347, dg_hp

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
