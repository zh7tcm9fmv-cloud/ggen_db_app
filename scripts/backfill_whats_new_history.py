#!/usr/bin/env python3
"""
Add one archived baseline snapshot under data/whats_new_history_snapshots/ so What's New can show
the diff from an earlier date (e.g. 23rd) to the next baseline still stored in whats_new_snapshot.json (e.g. 25th).

Use this when you already have data/whats_new_snapshot.json as your *current* saved baseline but you never
ran refresh_whats_new_snapshot.py when moving from the first baseline, so the history folder is empty.

Example (first baseline was Mar 23, current snapshot on disk reflects Mar 25):
  python scripts/backfill_whats_new_history.py --prior-master-dir "C:/path/MasterData_2026-03-23" --captured-at 2026-03-23

Or run with no path arguments to open a folder dialog (requires tkinter):
  python scripts/backfill_whats_new_history.py
  python scripts/backfill_whats_new_history.py --captured-at 2026-03-23

Then restart the app. You should see two auto tabs: label of the *end* of the first period (25 if your
snapshot file has captured_at 2026-03-25), and the pending tab with today's data date (e.g. 27).

If the index already has entries, use --append to add another archive (e.g. you are repairing data).
"""
import argparse
import json
import os
import re
import sys

_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _APP_DIR not in sys.path:
    sys.path.insert(0, _APP_DIR)


def _parse_date_from_basename(name):
    m = re.search(r'(\d{4}-\d{2}-\d{2})', name or '')
    return m.group(1) if m else ''


def _pick_prior_master_dir():
    try:
        import tkinter as tk
        from tkinter import filedialog
    except ImportError as e:
        raise SystemExit(
            'Folder picker needs tkinter. Install it for your Python, or pass --prior-master-dir instead.\n'
            'Original error: %s' % e
        )
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    root.update_idletasks()
    path = filedialog.askdirectory(
        title='Select prior MasterData folder (older baseline)',
        mustexist=True,
    )
    root.destroy()
    return os.path.abspath(path) if path else ''


def main():
    parser = argparse.ArgumentParser(description='Backfill one archived whats_new baseline (older MasterData folder).')
    src = parser.add_mutually_exclusive_group(required=False)
    src.add_argument(
        '--prior-master-dir',
        metavar='DIR',
        help='Folder of master JSON for the older baseline (e.g. MasterData_2026-03-23). If omitted, a folder dialog opens.',
    )
    src.add_argument(
        '--pick',
        action='store_true',
        help='Open a folder dialog (same as omitting --prior-master-dir).',
    )
    parser.add_argument(
        '--captured-at',
        metavar='YYYY-MM-DD',
        help='Date label stored on the archive (default: from folder name, else today UTC).',
    )
    parser.add_argument(
        '--append',
        action='store_true',
        help='Allow appending when data/whats_new_history_index.json already has archives.',
    )
    args = parser.parse_args()

    import app as app_module

    if args.prior_master_dir:
        prior = os.path.abspath(args.prior_master_dir)
    else:
        prior = _pick_prior_master_dir()
        if not prior:
            raise SystemExit('No folder selected.')
    if not os.path.isdir(prior):
        raise SystemExit('Not a directory: %s' % prior)

    ca = (args.captured_at or '').strip()
    if not ca:
        ca = _parse_date_from_basename(os.path.basename(prior.rstrip('/\\')))
    if not ca:
        ca = app_module.datetime.now(app_module.timezone.utc).date().isoformat()

    sn = app_module.build_whats_new_snapshot_dict_from_master_dir(prior)
    sn['captured_at'] = ca

    hist_dir = app_module.WHATS_NEW_HISTORY_DIR
    os.makedirs(hist_dir, exist_ok=True)
    idx_path = app_module.WHATS_NEW_HISTORY_INDEX_PATH
    idx = app_module._load_whats_new_history_index()
    archives = idx.setdefault('archives', [])
    if archives and not args.append:
        raise SystemExit(
            'History index already has %d archive(s). Use --append to add another, or edit %s manually.'
            % (len(archives), idx_path)
        )

    aid = app_module.datetime.now(app_module.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    fn = '%s.json' % aid
    dest = os.path.join(hist_dir, fn)
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(sn, f, indent=2, ensure_ascii=False)

    archives.append({
        'id': aid,
        'captured_at': ca,
        'filename': fn,
    })
    os.makedirs(os.path.dirname(idx_path), exist_ok=True)
    with open(idx_path, 'w', encoding='utf-8') as f:
        json.dump(idx, f, indent=2, ensure_ascii=False)

    cur = app_module.load_whats_new_snapshot()
    cur_ca = (cur.get('captured_at') or '').strip() if cur else ''
    print('Wrote archive: %s' % dest)
    print('  captured_at on archive: %s' % ca)
    print('  data/whats_new_snapshot.json captured_at: %s' % (cur_ca or '(missing — set with refresh script --captured-at)'))
    print('Restart the Flask app. What\'s New: history tab(s) = diff between archived baselines; last tab = diff from snapshot on disk to live loaded masters.')


if __name__ == '__main__':
    main()
