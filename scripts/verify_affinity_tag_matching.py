#!/usr/bin/env python3
"""Verify lineage tag names align with affinity ability faction titles (all locales).

Run after changing app affinity matching helpers:

  python scripts/verify_affinity_tag_matching.py

Uses the same rules as app.py (import app after repo root is on sys.path).
"""
from __future__ import annotations

import os
import sys


def _repo_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _playable_char_faction_map(A, lc):
    for _ in (lc,):
        pass
    out = {}
    for cid in A.char_list_playable_ids:
        if not A.browse_entity_has_resolved_lineage_tags(A.char_lin_map, cid, lc, 'character'):
            continue
        fs = A._character_affinity_faction_set(cid)
        if fs:
            out[cid] = fs
    return out


def _count_tag(A, char_map, tag, lc):
    keys = A._resolve_affinity_canonical_keys_for_tag(tag, lc)
    return sum(1 for fs in char_map.values() if keys & fs)


def main():
    root = _repo_root()
    sys.path.insert(0, root)
    import app as A  # noqa: WPS433 — loads master data

    errors = []
    warnings = []
    langs = ('EN', 'TW', 'HK', 'JA')

    A._ensure_affinity_lineage_canonical()

    for lc in langs:
        ld = A.get_lang_data(lc)
        abnm = ld.get('abil_name_map', {}) or {}

        affinity_factions = set()
        for name in abnm.values():
            if not isinstance(name, str):
                continue
            if not A._name_indicates_affinity_ability(name):
                continue
            f = A._extract_affinity_faction_from_ability_name(name)
            if f:
                affinity_factions.add(f)
            else:
                errors.append(f'{lc}: unparsed affinity title: {name[:80]!r}')

        tag_names = sorted({v for v in (ld.get('lineage_lookup') or {}).values() if v})
        matched_tags = 0
        orphan_factions = set(affinity_factions)
        char_map = _playable_char_faction_map(A, lc)
        char_factions = set()
        for fs in char_map.values():
            char_factions.update(fs)

        for tag in tag_names:
            keys = A._resolve_affinity_canonical_keys_for_tag(tag, lc)
            canon_hit = bool(keys & affinity_factions) or bool(keys & char_factions)
            if canon_hit:
                matched_tags += 1
                for k in keys:
                    if k in affinity_factions:
                        orphan_factions.discard(k)
            n_chars = _count_tag(A, char_map, tag, lc)
            _ = n_chars  # informational only; some factions have passives but no playable pilots yet

        for f in char_factions:
            if f not in affinity_factions and lc == 'EN' and f in set(A._ensure_affinity_lineage_canonical().values()):
                errors.append(f'EN: canonical affinity faction missing from EN titles: {f!r}')

        if orphan_factions and lc == 'EN':
            for f in sorted(orphan_factions):
                warnings.append(f'EN: affinity faction {f!r} has no lineage tag with same normalized name')

        print(
            f'{lc}: {len(affinity_factions)} local affinity titles, '
            f'{len(char_factions)} canonical factions on characters, '
            f'{matched_tags}/{len(tag_names)} tags with affinity mapping, '
            f'{sum(len(v) for v in char_map.values())} character-faction links'
        )

    char_map_en = _playable_char_faction_map(A, 'EN')

    checks = [
        ('Zeon', 49),
        ('Neo Zeon', 26),
        ('EFSF (U.C.)', 50),
        ('Gundam', 0),
    ]
    for tag, expected in checks:
        actual = _count_tag(A, char_map_en, tag, 'EN')
        if actual != expected:
            errors.append(f'EN regression {tag}: got {actual}, expected {expected}')

    if not A._character_has_affinity_tag_match('1001000100', ['efsf (u.c.)'], 'or', A.get_lang_data('EN'), 'EN'):
        errors.append('EN regression: Amuro Ray (1001000100) EX ability must match EFSF (U.C.) affinity')

    neo_only_ids = [cid for cid, fs in char_map_en.items() if fs == {'neo zeon'}]
    for cid in neo_only_ids:
        if A._character_has_affinity_tag_match(cid, ['zeon'], 'or', A.get_lang_data('EN'), 'EN'):
            errors.append(f'EN regression: neo-only char {cid} matched Zeon tag')

    # JA UC EFSF tag must resolve via lineage id → EN canonical key
    ja_efsf = _count_tag(A, _playable_char_faction_map(A, 'JA'), '地球連邦軍(宇宙世紀)', 'JA')
    if ja_efsf != 50:
        errors.append(f'JA regression EFSF UC: got {ja_efsf}, expected 50')

    if warnings:
        print('warnings:')
        for w in warnings[:40]:
            print(' ', w)
        if len(warnings) > 40:
            print(f' ... +{len(warnings) - 40} more')

    if errors:
        print('verify_affinity_tag_matching: FAILED', file=sys.stderr)
        for e in errors:
            print(e, file=sys.stderr)
        sys.exit(1)

    print('verify_affinity_tag_matching: ok')


if __name__ == '__main__':
    main()
