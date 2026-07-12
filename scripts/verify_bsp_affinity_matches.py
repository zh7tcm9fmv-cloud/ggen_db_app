#!/usr/bin/env python3
"""Verify BSP affinity UI metadata: SP-only + series affinities for known pairs."""
from __future__ import annotations

import json
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import meta_synergy_rank as msy  # noqa: E402


CASES = [
    # unit, char, expect_min, must_contain_ability_substr, forbid_ability_substr
    ('1211000360', '1219000100', 1, 'Operation Meteor LV 2', 'LV 1'),
    ('1336000100', '1336000100', 1, 'EX Character Ability', None),  # Sven series affinity
    ('1336000100', '1219000100', 0, None, None),  # Heero SSR — no Operation Meteor on Strike Noir
    ('1210000300', '1219000100', 1, 'Operation Meteor LV 2', 'LV 1'),
]


def main():
    fails = []
    for uid, cid, expect_min, must, forbid in CASES:
        rows = msy._msy_pilot_unit_affinities(cid, uid, 'EN')
        names = [str(r.get('ability') or '') for r in rows]
        detail = f'{uid}x{cid} -> {names}'
        if len(rows) < expect_min:
            fails.append(f'{detail}: expected >= {expect_min} rows')
            continue
        if must and not any(must in n for n in names):
            fails.append(f'{detail}: missing {must!r}')
        if forbid and any(forbid in n for n in names):
            fails.append(f'{detail}: still has forbidden {forbid!r}')
        # Dual LV1+LV2 of same family must never appear
        bases = {}
        for n in names:
            base = __import__('re').sub(r'\s*LV\s*\d+\s*$', '', n, flags=__import__('re').I).strip().lower()
            bases.setdefault(base, []).append(n)
        for base, group in bases.items():
            if len(group) > 1:
                fails.append(f'{detail}: duplicate affinity family {group}')
        print('OK', detail)
    if fails:
        print('FAIL')
        for f in fails:
            print(' -', f)
        return 1
    print('ALL AFFINITY CHECKS PASSED')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
