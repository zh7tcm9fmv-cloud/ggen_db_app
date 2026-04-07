"""
Regression for Master League MS stat stacking (matches templates/index.html
_dcGetModifiedAttackerUnitStats).

In-game: one floor on growth base —
  floor(base * (100 + passive% + OP% + leader% + EX% + turn% + ML(+50 if on)) / 100) + flats.

ML is +50 in the same % bucket (e.g. 1.63 without ML, 2.13 with ML on base 12065 + 360 flat → 20025 / 26058).

Run: python scripts/ml_master_league_stat_math_test.py
"""
from __future__ import annotations

import math


def F(x: float) -> int:
    return math.floor(max(0.0, float(x)))


def ms_attack_from_base(
    base: int,
    *,
    passive_pct: int,
    master_league: bool,
    op_attack_pct: int,
    ex_squad_pct: int,
    leader_pct: int,
    turn_atk_pct: int,
    op_attack_flat: int,
    atk_support_flat: int,
) -> int:
    ml = 50 if master_league else 0
    ext = (
        (passive_pct or 0)
        + (op_attack_pct or 0)
        + (ex_squad_pct or 0)
        + (leader_pct or 0)
        + (turn_atk_pct or 0)
        + ml
    )
    return F(base * (100 + ext) / 100) + (op_attack_flat or 0) + (atk_support_flat or 0)


def _main() -> None:
    # Burning-style: base 12065, passive 15%, OP ATK 12%, leader 36%, flat 360 total
    base = 12_065
    p, o, l, flat = 15, 12, 36, 360
    no_ml = ms_attack_from_base(
        base,
        passive_pct=p,
        master_league=False,
        op_attack_pct=o,
        ex_squad_pct=0,
        leader_pct=l,
        turn_atk_pct=0,
        op_attack_flat=0,
        atk_support_flat=flat,
    )
    yes_ml = ms_attack_from_base(
        base,
        passive_pct=p,
        master_league=True,
        op_attack_pct=o,
        ex_squad_pct=0,
        leader_pct=l,
        turn_atk_pct=0,
        op_attack_flat=0,
        atk_support_flat=flat,
    )
    assert no_ml == 20_025, no_ml
    assert yes_ml == 26_058, yes_ml

    # Synthetic
    assert (
        ms_attack_from_base(
            10_000,
            passive_pct=0,
            master_league=True,
            op_attack_pct=10,
            ex_squad_pct=0,
            leader_pct=20,
            turn_atk_pct=0,
            op_attack_flat=5,
            atk_support_flat=7,
        )
        == F(10_000 * (100 + 10 + 20 + 50) / 100) + 5 + 7
    )

    print("ml_master_league_stat_math_test: OK (Burning 20025 / 26058 + synthetic)")


if __name__ == "__main__":
    _main()
