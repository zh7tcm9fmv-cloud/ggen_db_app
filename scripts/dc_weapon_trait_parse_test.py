#!/usr/bin/env python3
"""Smoke-test EN weapon trait regex patterns used by _dcParseWeaponTraits (mirrors app.js)."""
import re
import sys

MP_OWN = re.compile(
    r"the\s+higher\s+(?:your|own)\s+MP\s+is,?\s*the\s+(?:greater|more)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)",
    re.I,
)


def parse_mp_pct(txt: str) -> int:
    txt = txt.replace("\n", " ")
    m = MP_OWN.search(txt)
    return int(m.group(1)) if m else 0


def mp_applied_pct(cap: int, vigor_step: int, super_step: int = 20) -> int:
    return round(cap * vigor_step / super_step)


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

    barrage = (
        "The higher own MP is, the greater Weapon Power increases "
        "(up to 20% increase) at the start of combat."
    )
    assert parse_mp_pct(barrage) == 20
    # MP weapon-power trait only (not vigor damage dealt): High 10 / Max 15 / Super 20 of a 20% cap.
    assert mp_applied_pct(20, 10) == 10
    assert mp_applied_pct(20, 15) == 15
    assert mp_applied_pct(20, 20) == 20
    assert wpn_pow(7200, 10) == 7920
    assert wpn_pow(7200, 20) == 8640

    print("dc_weapon_trait_parse_test: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
