#!/usr/bin/env python3
"""
Write data/whats_new_snapshot.json from master JSON.

If whats_new_snapshot.json already exists, it is copied to data/whats_new_history_snapshots/
and recorded in data/whats_new_history_index.json so the What's New UI can show separate
tabs for each baseline update (diffs between archived snapshots).

Default: snapshot matches the same masters the running app loads (newest MasterData_*).

Use --second-latest to set the baseline to the previous MasterData_* folder (e.g. "yesterday"
when you have two dated folders and the app points at the newest).

Usage (from ggen_db_app):
  python scripts/refresh_whats_new_snapshot.py
      # DEFAULT one-shot post-import:
      #   1) What's New baseline (whats_new_snapshot.json + history archive)
      #   2) Official gacha drop % → data/published/official_gasha/
      #   3) Investment Priority (/ip) → data/published/sp_investment_v1.json
      #   4) /ip coverage gate
  python scripts/refresh_whats_new_snapshot.py --snapshot-only
      # Baseline only (skip gacha + /ip)
  python scripts/refresh_whats_new_snapshot.py --rebuild-spi
      # /ip only (skip gacha sync; still writes baseline first)
  python scripts/refresh_whats_new_snapshot.py --second-latest
  python scripts/refresh_whats_new_snapshot.py --from-master-dir "C:/path/to/MasterData_2026-03-24"

Published caches only (no What's New baseline):
  python scripts/refresh_published_after_master.py

If you already have whats_new_snapshot.json but no files under data/whats_new_history_snapshots/, use
  python scripts/backfill_whats_new_history.py --prior-master-dir "C:/path/to/older/MasterData_*"
to add the first baseline so What's New can show older period tabs.
"""
import argparse
import json
import os
import shutil
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
    parser = argparse.ArgumentParser(
        description=(
            'Write Whats New baseline, then (by default) refresh published gacha drop % '
            'and Investment Priority (/ip).'
        ),
    )
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
    parser.add_argument(
        '--snapshot-only',
        action='store_true',
        help='Only write whats_new_snapshot.json (skip gacha drop % + /ip rebuild).',
    )
    parser.add_argument(
        '--publish',
        action='store_true',
        help='Force published cache refresh (default unless --snapshot-only; kept for compatibility).',
    )
    parser.add_argument(
        '--rebuild-spi',
        action='store_true',
        help='Rebuild /ip only after baseline (skip gacha sync). Default already rebuilds /ip.',
    )
    parser.add_argument(
        '--skip-spi',
        action='store_true',
        help='After baseline, refresh gacha drop %% only (skip /ip rebuild).',
    )
    args = parser.parse_args()

    if args.snapshot_only and (args.rebuild_spi or args.skip_spi or args.publish):
        parser.error('--snapshot-only cannot be combined with --publish / --rebuild-spi / --skip-spi')
    if args.rebuild_spi and args.skip_spi:
        parser.error('Use only one of --rebuild-spi or --skip-spi')

    publish = not args.snapshot_only
    # --rebuild-spi → /ip only; --skip-spi → gacha only; else both (default one-shot).
    skip_gasha = bool(args.rebuild_spi)
    skip_spi = bool(args.skip_spi)

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
    # Archive previous baseline so What's New can show per-update tabs (diff between baselines).
    prev = app_module._load_whats_new_snapshot_from_path(path)
    if prev:
        hist_dir = app_module.WHATS_NEW_HISTORY_DIR
        os.makedirs(hist_dir, exist_ok=True)
        aid = app_module.datetime.now(app_module.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        dest = os.path.join(hist_dir, '%s.json' % aid)
        shutil.copy2(path, dest)
        idx_path = app_module.WHATS_NEW_HISTORY_INDEX_PATH
        os.makedirs(os.path.dirname(idx_path), exist_ok=True)
        idx = app_module._load_whats_new_history_index()
        archives = idx.setdefault('archives', [])
        archives.append({
            'id': aid,
            'captured_at': (prev.get('captured_at') or '').strip(),
            'filename': '%s.json' % aid,
        })
        with open(idx_path, 'w', encoding='utf-8') as f:
            json.dump(idx, f, indent=2, ensure_ascii=False)
        print('Archived previous baseline to %s' % dest)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(sn, f, indent=2, ensure_ascii=False)
    print(f'Wrote {path}')
    print(f'  source: {src}')
    print(f'  units: {len(sn.get("units", []))}, characters: {len(sn.get("characters", []))}, option parts: {len(sn.get("option_parts", []))}')

    if publish:
        import subprocess

        pub_script = os.path.join(_APP_DIR, 'scripts', 'refresh_published_after_master.py')
        pub_cmd = [sys.executable, pub_script]
        steps = []
        if skip_gasha:
            pub_cmd.append('--skip-gasha')
        else:
            steps.append('gacha drop %')
        if skip_spi:
            pub_cmd.append('--skip-spi')
        else:
            steps.append('/ip (Investment Priority)')
        print('Refreshing published caches (%s)…' % (' + '.join(steps) if steps else 'none'))
        rc = subprocess.call(pub_cmd, cwd=_APP_DIR)
        if rc != 0:
            raise SystemExit(rc)
        print('Published cache refresh finished (%s).' % (' + '.join(steps) if steps else 'skipped'))
    else:
        print('Skipped published caches (--snapshot-only). /ip was NOT rebuilt.')


if __name__ == '__main__':
    main()
