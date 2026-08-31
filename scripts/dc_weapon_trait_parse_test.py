#!/usr/bin/env python3
"""Smoke-test EN weapon trait regex patterns used by _dcParseWeaponTraits (mirrors app.js)."""
import re
import sys

DIST_ENEMIES = re.compile(
    r"(?:the\s+)?(?:closer|farther|further)\s+enemies\s+are,?\s*the\s+(?:greater|more)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)",
    re.I,
)
HP_OWN = re.compile(
    r"(?:the\s+)?(?:lower|higher)\s+own\s+remaining\s+HP.*?(?:more|greater)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)",
    re.I,
)
HP_GENERIC = re.compile(
    r"(?:the\s+)?(?:lower|higher)\s+(?:(?:this\s+unit'?s|your|own)\s+)?remaining\s+HP.*?(?:more|greater)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)",
    re.I,
)


def parse_hp_pct(txt: str) -> int:
    txt = txt.replace("\n", " ")
    m = HP_OWN.search(txt)
    if not m:
        m = HP_GENERIC.search(txt)
    return int(m.group(1)) if m else 0


def parse_dist_pct(txt: str) -> int:
    txt = txt.replace("\n", " ")
    m = DIST_ENEMIES.search(txt)
    return int(m.group(1)) if m else 0


def wpn_pow(base: int, pct: int) -> int:
    return (base * (100 + pct)) // 100


def main() -> int:
    explosive = "The farther enemies are, the greater Weapon Power increases (up to 20% increase)."
    long_mega = "The lower own remaining HP, the greater Weapon Power increases (up to 15% increase)."

    assert parse_dist_pct(explosive) == 20
    assert wpn_pow(6360, 20) == 7632

    assert parse_hp_pct(long_mega) == 15
    assert wpn_pow(5280, 15) == 6072

    # Old regex without `own` in alternation must not match official EN wording.
    old_hp = re.compile(
        r"(?:the\s+)?(?:lower|higher)\s+(?:(?:this\s+unit'?s|your)\s+)?remaining\s+HP.*?(?:more|greater)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)",
        re.I,
    )
    assert not old_hp.search(long_mega.replace("\n", " "))

    print("dc_weapon_trait_parse_test: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
