#!/usr/bin/env python3
"""
Write data/whats_new_snapshot.json from the currently loaded master data.

After you publish a data update and are satisfied with the "What's new" diff shown
in the app, run this to reset the baseline so the next import only shows new deltas.

Usage (from ggen_db_app):
  python scripts/refresh_whats_new_snapshot.py
"""
import json
import os
import sys

_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _APP_DIR not in sys.path:
    sys.path.insert(0, _APP_DIR)


def main():
    import app as app_module

    sn = app_module.serialize_whats_new_snapshot()
    sn['captured_at'] = app_module.datetime.now(app_module.timezone.utc).date().isoformat()
    path = app_module.WHATS_NEW_SNAPSHOT_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(sn, f, indent=2, ensure_ascii=False)
    print(f'Wrote {path} ({len(sn.get("units", []))} units, {len(sn.get("characters", []))} characters, {len(sn.get("option_parts", []))} option parts).')


if __name__ == '__main__':
    main()
