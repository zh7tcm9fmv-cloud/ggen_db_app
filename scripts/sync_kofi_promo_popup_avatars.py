#!/usr/bin/env python3
"""Sync Ko-fi donate promo Popup avatars → static/js/kofi_donate_promo.js.

Keeps PROMO_POPUP_FILES in sync with images/Popup WebPs from:
  1. ggen_db_images/image_index.json (preferred when present)
  2. app image_index.json
  3. Disk under …/images/Popup/*.webp (CDN mirror and/or app static)

Usage (from ggen_db_app):
  python scripts/sync_kofi_promo_popup_avatars.py
  python scripts/sync_kofi_promo_popup_avatars.py --check
  python scripts/sync_kofi_promo_popup_avatars.py --dry-run
  python scripts/sync_kofi_promo_popup_avatars.py --update-index

Runs automatically from refresh_published_after_master.py / refresh_whats_new_snapshot.py.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

_APP_DIR = Path(__file__).resolve().parent.parent
_DEFAULT_CDN_ROOT = _APP_DIR.parent / 'ggen_db_images'
_PROMO_JS = _APP_DIR / 'static' / 'js' / 'kofi_donate_promo.js'
_POPUP_KEY = 'images/Popup'
_ARRAY_RE = re.compile(
    r'(var PROMO_POPUP_FILES = \[)(.*?)(\];)',
    re.DOTALL,
)


def _load_index_popup(index_path: Path) -> list[str]:
    if not index_path.is_file():
        return []
    try:
        data = json.loads(index_path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as e:
        print(f'Warning: could not read {index_path}: {e}', file=sys.stderr)
        return []
    rows = data.get(_POPUP_KEY) if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return []
    return [str(x) for x in rows if isinstance(x, str) and x.strip()]


def _disk_popup_names(popup_dir: Path) -> list[str]:
    if not popup_dir.is_dir():
        return []
    return sorted(p.name for p in popup_dir.iterdir() if p.is_file())


def _webp_only(names: list[str] | set[str]) -> list[str]:
    out = {n for n in names if n.lower().endswith('.webp')}
    return sorted(out, key=str.lower)


def collect_popup_webps(*, cdn_root: Path, app_dir: Path) -> tuple[list[str], dict]:
    """Return sorted unique Popup *.webp names + source diagnostics."""
    cdn_index = cdn_root / 'image_index.json'
    app_index = app_dir / 'image_index.json'
    cdn_popup = cdn_root / 'images' / 'Popup'
    app_popup = app_dir / 'static' / 'images' / 'Popup'

    from_cdn_idx = _webp_only(_load_index_popup(cdn_index))
    from_app_idx = _webp_only(_load_index_popup(app_index))
    from_cdn_disk = _webp_only(_disk_popup_names(cdn_popup))
    from_app_disk = _webp_only(_disk_popup_names(app_popup))

    union: set[str] = set()
    union.update(from_cdn_idx)
    union.update(from_app_idx)
    union.update(from_cdn_disk)
    union.update(from_app_disk)

    diag = {
        'cdn_index': str(cdn_index) if cdn_index.is_file() else None,
        'app_index': str(app_index) if app_index.is_file() else None,
        'cdn_popup_dir': str(cdn_popup) if cdn_popup.is_dir() else None,
        'app_popup_dir': str(app_popup) if app_popup.is_dir() else None,
        'counts': {
            'cdn_index_webp': len(from_cdn_idx),
            'app_index_webp': len(from_app_idx),
            'cdn_disk_webp': len(from_cdn_disk),
            'app_disk_webp': len(from_app_disk),
            'union_webp': len(union),
        },
        'disk_not_in_index': sorted(
            (set(from_cdn_disk) | set(from_app_disk))
            - (set(from_cdn_idx) | set(from_app_idx))
        ),
    }
    return sorted(union, key=str.lower), diag


def read_promo_list(promo_js: Path) -> list[str]:
    text = promo_js.read_text(encoding='utf-8')
    m = _ARRAY_RE.search(text)
    if not m:
        raise RuntimeError(f'PROMO_POPUP_FILES array not found in {promo_js}')
    return re.findall(r"'([^']+\.webp)'", m.group(2))


def rewrite_promo_js(promo_js: Path, names: list[str], *, dry_run: bool) -> bool:
    """Rewrite PROMO_POPUP_FILES. Returns True if file would change / changed."""
    text = promo_js.read_text(encoding='utf-8')
    m = _ARRAY_RE.search(text)
    if not m:
        raise RuntimeError(f'PROMO_POPUP_FILES array not found in {promo_js}')
    inner_lines = [f"    '{n}'," for n in names]
    new_inner = ('\n' + '\n'.join(inner_lines) + '\n  ') if names else ''
    new_text = text[: m.start(2)] + new_inner + text[m.end(2) :]
    if new_text == text:
        return False
    if dry_run:
        return True
    promo_js.write_text(new_text, encoding='utf-8', newline='\n')
    return True


def update_image_indexes(
    *,
    cdn_root: Path,
    app_dir: Path,
    dry_run: bool,
) -> list[str]:
    """Rebuild images/Popup in CDN + app indexes from disk (png+webp), prefer CDN disk."""
    cdn_popup = cdn_root / 'images' / 'Popup'
    app_popup = app_dir / 'static' / 'images' / 'Popup'
    names = set(_disk_popup_names(cdn_popup)) | set(_disk_popup_names(app_popup))
    # Prefer indexed names that still exist conceptually: keep png+webp from disk only
    sorted_names = sorted(names, key=str.lower)
    if not sorted_names:
        print('Warning: no Popup files on disk; image_index not updated.', file=sys.stderr)
        return []

    updated: list[str] = []
    for label, index_path in (
        ('cdn', cdn_root / 'image_index.json'),
        ('app', app_dir / 'image_index.json'),
    ):
        if not index_path.is_file():
            continue
        data = json.loads(index_path.read_text(encoding='utf-8'))
        if not isinstance(data, dict):
            continue
        prev = data.get(_POPUP_KEY)
        if prev == sorted_names:
            continue
        data[_POPUP_KEY] = sorted_names
        updated.append(f'{label}:{index_path}')
        if not dry_run:
            index_path.write_text(
                json.dumps(data, indent=2, ensure_ascii=False) + '\n',
                encoding='utf-8',
                newline='\n',
            )
    return updated


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        '--cdn-root',
        type=Path,
        default=Path(os.environ.get('GGEN_DB_IMAGES', str(_DEFAULT_CDN_ROOT))),
        help='ggen_db_images repo root (default: sibling ../ggen_db_images or GGEN_DB_IMAGES).',
    )
    ap.add_argument(
        '--promo-js',
        type=Path,
        default=_PROMO_JS,
        help='Path to kofi_donate_promo.js',
    )
    ap.add_argument(
        '--check',
        action='store_true',
        help='Exit 1 if PROMO_POPUP_FILES is out of sync (no write).',
    )
    ap.add_argument('--dry-run', action='store_true', help='Report changes without writing.')
    ap.add_argument(
        '--update-index',
        action='store_true',
        help='Rebuild images/Popup in CDN + app image_index.json from disk before syncing JS.',
    )
    args = ap.parse_args()

    cdn_root = args.cdn_root.resolve()
    promo_js = args.promo_js.resolve()
    if not promo_js.is_file():
        print(f'Error: promo JS missing: {promo_js}', file=sys.stderr)
        return 1

    if args.update_index:
        touched = update_image_indexes(
            cdn_root=cdn_root,
            app_dir=_APP_DIR,
            dry_run=args.dry_run or args.check,
        )
        if touched:
            verb = 'Would update' if (args.dry_run or args.check) else 'Updated'
            print(f'{verb} image_index Popup lists ({len(touched)}):')
            for t in touched:
                print(f'  {t}')
        else:
            print('image_index Popup lists already match disk.')

    names, diag = collect_popup_webps(cdn_root=cdn_root, app_dir=_APP_DIR)
    if not names:
        print('Error: no Popup *.webp found in indexes or on disk.', file=sys.stderr)
        print(f'  diagnostics: {diag}', file=sys.stderr)
        return 1

    current = read_promo_list(promo_js)
    missing = [n for n in names if n not in current]
    extra = [n for n in current if n not in names]
    in_sync = current == names

    print(f'Popup WebP pool: {len(names)} (promo JS: {len(current)})')
    for k, v in diag['counts'].items():
        print(f'  {k}: {v}')
    if diag['disk_not_in_index']:
        print(
            f'  note: {len(diag["disk_not_in_index"])} disk WebP(s) not in image_index '
            f'(still included in promo list)'
        )
        for n in diag['disk_not_in_index'][:12]:
            print(f'    + {n}')
        if len(diag['disk_not_in_index']) > 12:
            print(f'    … +{len(diag["disk_not_in_index"]) - 12} more')

    if in_sync:
        print('PROMO_POPUP_FILES already in sync.')
        return 0

    print(f'Out of sync: +{len(missing)} missing in JS, -{len(extra)} extra in JS')
    for n in missing[:20]:
        print(f'  + {n}')
    if len(missing) > 20:
        print(f'  … +{len(missing) - 20} more')
    for n in extra[:10]:
        print(f'  - {n}')
    if len(extra) > 10:
        print(f'  … -{len(extra) - 10} more')

    if args.check:
        print('Check failed: update with: python scripts/sync_kofi_promo_popup_avatars.py')
        return 1

    changed = rewrite_promo_js(promo_js, names, dry_run=args.dry_run)
    if args.dry_run:
        print(f'Dry run: would rewrite {promo_js} ({len(names)} files).')
        return 0
    if changed:
        print(f'Updated {promo_js} → {len(names)} Popup avatars.')
    else:
        print('No JS write needed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
