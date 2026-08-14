"""Regression: pilot active skill % uses one floor bucket on growth base (trait%+skill%).

Sandaime Ranged Boost LV4: 664 base +20% trait +20% skill → 929 (+265), not 928.
Versal Melee Boost LV5: 708 +25%+25% → 1062 (unchanged).
713 +20% trait +25% skill spot check → 1033 (not 1034).

Run: python scripts/dc_pilot_skill_rounding_test.py
"""
from __future__ import annotations

import math

F = math.floor


def pilot_passive_pct(base: int, passive_total: int) -> int:
    b = max(0, base)
    bon = max(0, passive_total - b)
    if b <= 0 or bon <= 0:
        return 0
    for p in range(501):
        if F(b * p / 100) == bon:
            return p
    return 0


def skill_adjusted(base: int, passive_total: int, skill_pct: int) -> int:
    if skill_pct <= 0:
        return passive_total
    pp = pilot_passive_pct(base, passive_total)
    return F(base * (100 + pp + skill_pct) / 100)


def main() -> None:
    # Sandaime self-pilot Ranged Boost
    assert skill_adjusted(664, 796, 20) == 929
    assert skill_adjusted(664, 796, 0) == 796
    # Versal Melee Boost
    assert skill_adjusted(708, 885, 25) == 1062
    # Legacy 713 +25% skill with ~20% trait passive total 855
    assert skill_adjusted(713, 855, 25) == 1033
    # Old bug: passiveTotal + floor(base*skill%)
    assert 796 + F(664 * 20 / 100) == 928

    print("dc_pilot_skill_rounding_test: OK (Sandaime 929, Versal 1062, 713->1033)")


if __name__ == "__main__":
    main()
