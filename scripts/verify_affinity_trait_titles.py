#!/usr/bin/env python3
"""Regression check: TW/HK affinity trait titles must be recognized for /api/tag_affinity.

Official TW/HK strings use the prefix 契合度 (not 親和). Run after importing new master data:

  python scripts/verify_affinity_trait_titles.py

Requires bundled data under data/<LANG>/lang/m_trait_set_detail.json (repo copy).
Marker list must match app._AFFINITY_TITLE_MARKERS_CJK and the 'affinity' substring rule.
"""
from __future__ import annotations

import json
import os
import sys


def _repo_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _name_indicates_affinity_ability(ab_name):
    """Mirror app._name_indicates_affinity_ability — update both when changing rules."""
    if not ab_name:
        return False
    n = ab_name.lower()
    if 'affinity' in n:
        return True
    markers = frozenset(('親和', '亲和', 'アフィニティ', '契合度'))
    return any(m in ab_name for m in markers)


def main():
    root = _repo_root()
    langs = ('TW', 'HK')
    errors = []
    checked = 0
    for lang in langs:
        path = os.path.join(root, 'data', lang, 'lang', 'm_trait_set_detail.json')
        if not os.path.isfile(path):
            print(f'skip (no file): {path}')
            continue
        with open(path, encoding='utf-8') as f:
            rows = json.load(f)
        if not isinstance(rows, list):
            errors.append(f'{path}: expected JSON array')
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            v = (row.get('value') or '').strip()
            if '契合度' not in v:
                continue
            checked += 1
            if not _name_indicates_affinity_ability(v):
                errors.append(f'{lang}: not detected: {v[:72]!r}…' if len(v) > 72 else f'{lang}: not detected: {v!r}')
    if errors:
        print('verify_affinity_trait_titles: FAILED', file=sys.stderr)
        for e in errors[:40]:
            print(e, file=sys.stderr)
        if len(errors) > 40:
            print(f'... and {len(errors) - 40} more', file=sys.stderr)
        sys.exit(1)
    print(f'verify_affinity_trait_titles: ok ({checked} 契合度 titles checked across {", ".join(langs)})')


if __name__ == '__main__':
    main()
