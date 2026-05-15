#!/usr/bin/env python3
"""Audit stage NPC unit ability/weapon source consistency.

Checks that stage NPC unit detail is sourced from map-NPC set tables, not regular unit DB fallbacks.
"""

from __future__ import annotations

import argparse
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(SCRIPT_DIR)
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

import app


def normalize(v: str) -> str:
    return app.normalize_id(v)


def audit(lang: str) -> int:
    issues: list[str] = []
    npc_rows = app.map_npc_unit_lookup or {}

    for npc_id, rows in npc_rows.items():
        if not rows:
            continue
        ue = rows[0]
        unit_id = normalize(ue.get("unit_id", "0"))
        ability_set_id = normalize(ue.get("ability_set_id", "0"))
        weapon_set_id = normalize(ue.get("weapon_set_id", "0"))

        abilities = app.resolve_npc_unit_abilities(ability_set_id, lang, unit_id) or []
        weapons = app.resolve_npc_unit_weapons(weapon_set_id, unit_id, "", lang, []) or []

        # No set id -> no NPC-derived entries should exist.
        if ability_set_id == "0" and abilities:
            issues.append(
                f"NPC {npc_id}: ability_set_id=0 but resolved {len(abilities)} abilities"
            )
        if weapon_set_id == "0" and weapons:
            issues.append(
                f"NPC {npc_id}: weapon_set_id=0 but resolved {len(weapons)} weapons"
            )

        # Set id present -> resolved entries should come from that set.
        if ability_set_id != "0":
            expected = {normalize(e.get("id", "0")) for e in app.map_npc_unit_ability_set_lookup.get(ability_set_id, [])}
            actual = {normalize(a.get("id", "0")) for a in abilities if isinstance(a, dict)}
            extra = sorted(x for x in actual if x and x not in expected)
            if extra:
                issues.append(
                    f"NPC {npc_id}: abilities not in set {ability_set_id}: {extra}"
                )
        if weapon_set_id != "0":
            expected = {
                normalize(e.get("weapon_id", "0"))
                for e in app.map_npc_unit_weapon_set_lookup.get(weapon_set_id, [])
            }
            actual = {normalize(w.get("id", "0")) for w in weapons if isinstance(w, dict)}
            extra = sorted(x for x in actual if x and x not in expected)
            if extra:
                issues.append(
                    f"NPC {npc_id}: weapons not in set {weapon_set_id}: {extra}"
                )

    total_npcs = len(npc_rows)
    if issues:
        print(f"Audit failed: {len(issues)} issue(s) across {total_npcs} NPC unit rows.")
        for msg in issues:
            print(" -", msg)
        return 1

    print(f"Audit passed: {total_npcs} NPC unit rows use NPC set sources only.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit stage NPC unit set-source integrity.")
    parser.add_argument("--lang", default="EN", help="Language code for resolver paths (default: EN)")
    args = parser.parse_args()
    lang = app.validate_lang_code(args.lang)
    return audit(lang)


if __name__ == "__main__":
    sys.exit(main())
