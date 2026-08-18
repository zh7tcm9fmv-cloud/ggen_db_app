#!/usr/bin/env python3
"""Rebuild published caches after a MasterData import.

Runs (in order):
  1. Official gacha drop-rate JSON → data/published/official_gasha/
  2. Investment Priority (/ip) board → data/published/sp_investment_v1.json
  3. Coverage gate (eligible catalog vs published /ip)

Usage (from ggen_db_app):
  python scripts/refresh_published_after_master.py
  python scripts/refresh_published_after_master.py --skip-gasha
  python scripts/refresh_published_after_master.py --skip-spi

Typical full post-import workflow (What's New baseline + published caches):
  python scripts/refresh_whats_new_snapshot.py --publish
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys

_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _run_step(label: str, script_name: str, extra_args=None) -> int:
    path = os.path.join(_APP_DIR, 'scripts', script_name)
    cmd = [sys.executable, path] + list(extra_args or [])
    print(f'\n=== {label} ===', flush=True)
    print(' '.join(cmd), flush=True)
    return subprocess.call(cmd, cwd=_APP_DIR)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    ap = argparse.ArgumentParser(description='Rebuild /ip + gacha drop % published caches.')
    ap.add_argument('--skip-gasha', action='store_true', help='Skip official gasha proportion sync.')
    ap.add_argument('--skip-spi', action='store_true', help='Skip Investment Priority (/ip) rebuild.')
    ap.add_argument('--skip-coverage', action='store_true', help='Skip SPI coverage check.')
    args = ap.parse_args()

    os.environ.setdefault('GGEN_TIER_USE_BUNDLED_EN', '1')

    if not args.skip_gasha:
        rc = _run_step(
            'Sync official gacha drop rates',
            'sync_official_gasha_proportions.py',
        )
        if rc != 0:
            print('Gasha sync failed.', file=sys.stderr)
            return rc

    if not args.skip_spi:
        rc = _run_step(
            'Rebuild Investment Priority (/ip)',
            'build_sp_investment_rankings.py',
        )
        if rc != 0:
            print('SPI rebuild failed.', file=sys.stderr)
            return rc

    if not args.skip_spi and not args.skip_coverage:
        rc = _run_step(
            'Verify /ip coverage',
            'check_sp_investment_coverage.py',
        )
        if rc != 0:
            return rc

    print('\nPublished cache refresh complete.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
