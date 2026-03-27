#!/usr/bin/env python3
"""
Rebuild data/whats_new_history_* and data/whats_new_snapshot.json from two MasterData_* folders.

Older folder → one archive (history tab: diff up to the baseline date).
Baseline folder → whats_new_snapshot.json on disk (pending tab: diff from this to live masters).

Lang folders are not used here; snapshots are built only from master JSON in each MasterData path.

Example (defaults match common GGen_Database layout):
  python scripts/setup_whats_new_chain.py
"""
import argparse
import json
import os
import sys

_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _APP_DIR not in sys.path:
    sys.path.insert(0, _APP_DIR)

_DEFAULT_OLDER = os.path.join(os.path.expanduser('~'), 'Desktop', 'GGen_Database', 'MasterData_2026-03-23')
_DEFAULT_BASELINE = os.path.join(os.path.expanduser('~'), 'Desktop', 'GGen_Database', 'MasterData_2026-03-25')


def main():
    p = argparse.ArgumentParser(description='Set Whats New archive (older) + on-disk baseline (newer).')
    p.add_argument('--older-master', default=_DEFAULT_OLDER, help='Older MasterData_* (e.g. 23rd)')
    p.add_argument('--older-captured-at', default='2026-03-23', metavar='YYYY-MM-DD')
    p.add_argument('--baseline-master', default=_DEFAULT_BASELINE, help='Newer MasterData_* written to whats_new_snapshot.json (e.g. 25th)')
    p.add_argument('--baseline-captured-at', default='2026-03-25', metavar='YYYY-MM-DD')
    args = p.parse_args()

    older = os.path.abspath(args.older_master)
    baseline = os.path.abspath(args.baseline_master)
    if not os.path.isdir(older):
        raise SystemExit('Not a directory: %s' % older)
    if not os.path.isdir(baseline):
        raise SystemExit('Not a directory: %s' % baseline)

    import app as app_module

    sn_old = app_module.build_whats_new_snapshot_dict_from_master_dir(older)
    sn_old['captured_at'] = args.older_captured_at.strip()

    sn_base = app_module.build_whats_new_snapshot_dict_from_master_dir(baseline)
    sn_base['captured_at'] = args.baseline_captured_at.strip()

    def _data_equal(a, b):
        keys = ('version', 'units', 'characters', 'option_parts', 'unit_abilities', 'unit_weapons', 'char_abilities')
        return all(a.get(k) == b.get(k) for k in keys)

    if _data_equal(sn_old, sn_base):
        raise SystemExit(
            'Older and baseline MasterData produce identical snapshots. Check folder paths and dates.'
        )

    hist_dir = app_module.WHATS_NEW_HISTORY_DIR
    if os.path.isdir(hist_dir):
        for name in os.listdir(hist_dir):
            if name.endswith('.json'):
                os.remove(os.path.join(hist_dir, name))
    else:
        os.makedirs(hist_dir, exist_ok=True)

    aid = app_module.datetime.now(app_module.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    fn = '%s.json' % aid
    dest = os.path.join(hist_dir, fn)
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(sn_old, f, indent=2, ensure_ascii=False)

    idx = {
        'version': 1,
        'archives': [
            {
                'id': aid,
                'captured_at': args.older_captured_at.strip(),
                'filename': fn,
            }
        ],
    }
    idx_path = app_module.WHATS_NEW_HISTORY_INDEX_PATH
    os.makedirs(os.path.dirname(idx_path), exist_ok=True)
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump(idx, f, indent=2, ensure_ascii=False)

    snap_path = app_module.WHATS_NEW_SNAPSHOT_PATH
    os.makedirs(os.path.dirname(snap_path), exist_ok=True)
    with open(snap_path, 'w', encoding='utf-8') as f:
        json.dump(sn_base, f, indent=2, ensure_ascii=False)

    print('Wrote archive: %s (captured_at %s)' % (dest, args.older_captured_at))
    print('Wrote baseline: %s (captured_at %s)' % (snap_path, args.baseline_captured_at))
    print('Restart the app. What\'s New: history tab = %s -> %s; pending = live masters vs %s.' % (
        args.older_captured_at, args.baseline_captured_at, args.baseline_captured_at))


if __name__ == '__main__':
    main()
