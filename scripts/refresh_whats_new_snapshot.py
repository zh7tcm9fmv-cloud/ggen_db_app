#!/usr/bin/env python3
"""
Write data/whats_new_snapshot.json from master JSON.

Default: snapshot matches the same masters the running app loads (newest MasterData_*).

Use --second-latest to set the baseline to the previous MasterData_* folder (e.g. "yesterday"
when you have two dated folders and the app points at the newest).

Usage (from ggen_db_app):
  python scripts/refresh_whats_new_snapshot.py
  python scripts/refresh_whats_new_snapshot.py --second-latest
  python scripts/refresh_whats_new_snapshot.py --from-master-dir "C:/path/to/MasterData_2026-03-24"
"""
import argparse
import json
import os
import sys

_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _APP_DIR not in sys.path:
    sys.path.insert(0, _APP_DIR)


def _nth_latest_master_dir(root, prefix, n):
    """n=0: newest folder name after sort desc; n=1: second-newest (yesterday's tree if two exist)."""
    if not root or not os.path.isdir(root):
        return None
    candidates = [
        f for f in os.listdir(root)
        if f.startswith(prefix) and os.path.isdir(os.path.join(root, f))
    ]
    if len(candidates) <= n:
        return None
    candidates.sort(reverse=True)
    return os.path.join(root, candidates[n])


def main():
    parser = argparse.ArgumentParser(description='Write data/whats_new_snapshot.json baseline.')
    parser.add_argument(
        '--from-master-dir',
        metavar='DIR',
        help='Absolute path to a MasterData_* folder to snapshot (e.g. yesterday\'s export).',
    )
    parser.add_argument(
        '--second-latest',
        action='store_true',
        help='Use EN local GGen_Database: second-newest MasterData_* (newest = app data; this = baseline).',
    )
    parser.add_argument(
        '--captured-at',
        metavar='YYYY-MM-DD',
        help='Optional captured_at stored in JSON (default: today UTC).',
    )
    args = parser.parse_args()

    import app as app_module

    if args.from_master_dir and args.second_latest:
        parser.error('Use only one of --from-master-dir or --second-latest')

    if args.from_master_dir:
        sn = app_module.build_whats_new_snapshot_dict_from_master_dir(args.from_master_dir)
        src = os.path.abspath(args.from_master_dir)
    elif args.second_latest:
        if not app_module.IS_LOCAL:
            parser.error('--second-latest only works in LOCAL mode (GGen_Database path). Use --from-master-dir instead.')
        root = app_module.LANG_CONFIG['EN']['root']
        prefix = app_module.LANG_CONFIG['EN']['master_prefix']
        prev = _nth_latest_master_dir(root, prefix, 1)
        if not prev:
            parser.error(
                f'Need at least two {prefix}* folders under {root} to use --second-latest.')
        sn = app_module.build_whats_new_snapshot_dict_from_master_dir(prev)
        src = prev
        print(f'Baseline from: {src}')
    else:
        sn = app_module.serialize_whats_new_snapshot()
        src = '(current app masters)'

    if args.captured_at:
        sn['captured_at'] = args.captured_at.strip()
    else:
        sn['captured_at'] = app_module.datetime.now(app_module.timezone.utc).date().isoformat()

    path = app_module.WHATS_NEW_SNAPSHOT_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(sn, f, indent=2, ensure_ascii=False)
    print(f'Wrote {path}')
    print(f'  source: {src}')
    print(f'  units: {len(sn.get("units", []))}, characters: {len(sn.get("characters", []))}, option parts: {len(sn.get("option_parts", []))}')


if __name__ == '__main__':
    main()
