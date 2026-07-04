"""Probe weapon range filtering for SSP-upgraded regular weapons."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import app as a  # noqa: E402

ld = a.LANG_DATA.get("EN")
lc = "EN"


def dump_unit(uid):
    print(f"=== Unit {uid} ===")
    for sm in ("normal", "ssp"):
        for sub in ("non_map", "ssp_ex", "all"):
            r = a._unit_weapon_subset_effective_ranges(uid, ld, lc, sm, sub)
            print(f"  stat={sm} subset={sub}: {sorted(r)}")
        sub_nm = a._weapon_range_non_map_filter_subset(sm, True)
        print(
            f"  nm_ssp_ex_only subset={sub_nm} has_6: "
            f"{a.unit_weapon_subset_has_range_tier(uid, ld, lc, sm, sub_nm, 6)}"
        )
        print(f"  has_range_6_ge: {a.unit_has_non_map_weapon_max_range_ge(uid, ld, lc, sm, 6)}")
    print()


def all_range6_units():
    out = []
    for uid in a.unit_info_map:
        if a.unit_has_non_map_weapon_max_range_ge(uid, ld, lc, "ssp", 6):
            out.append(uid)
    print(f"Units with any weapon range>=6 under SSP: {len(out)}")
    for uid in sorted(out)[:20]:
        print(f"  {uid}")
    if len(out) > 20:
        print(f"  ... and {len(out) - 20} more")
    print()
    missed = []
    for uid in out:
        sub = a._weapon_range_non_map_filter_subset("ssp", True)
        if not a.unit_weapon_subset_has_range_tier(uid, ld, lc, "ssp", sub, 6):
            missed.append(uid)
    print(f"SSP range-6 units missed by SSP/EX-only filter (fixed subset): {len(missed)}")
    for uid in sorted(missed)[:30]:
        print(f"  {uid}")


if __name__ == "__main__":
    dump_unit("1307000310")
    all_range6_units()
