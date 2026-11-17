#!/usr/bin/env python3
"""Sync Ko-fi donate promo Popup avatars → static/js/kofi_donate_promo.js.

Keeps in sync with images/Popup WebPs from:
  1. ggen_db_images/image_index.json (preferred when present)
  2. app image_index.json
  3. Disk under …/images/Popup/*.webp (CDN mirror and/or app static)

Also (default):
  - Rebuilds images/Popup in CDN + app image_index.json from disk
  - Sets PROMO_POPUP_FEATURED_FILES to the latest win_g#### batch (+ pinned Maria clip)

Usage (from ggen_db_app):
  python scripts/sync_kofi_promo_popup_avatars.py
  python scripts/sync_kofi_promo_popup_avatars.py --check
  python scripts/sync_kofi_promo_popup_avatars.py --dry-run
  python scripts/sync_kofi_promo_popup_avatars.py --no-update-index
  python scripts/sync_kofi_promo_popup_avatars.py --no-featured

Runs automatically from refresh_published_after_master.py / refresh_whats_new_snapshot.py
(and App Update → Update all).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

_APP_DIR = Path(__file__).resolve().parent.parent
_DEFAULT_CDN_ROOT = _APP_DIR.parent / 'ggen_db_images'
_PROMO_JS = _APP_DIR / 'static' / 'js' / 'kofi_donate_promo.js'
_POPUP_KEY = 'images/Popup'
_POOL_RE = re.compile(
    r'(var PROMO_POPUP_FILES = \[)(.*?)(\];)',
    re.DOTALL,
)
_FEATURED_RE = re.compile(
    r'(var PROMO_POPUP_FEATURED_FILES = \[)(.*?)(\];)',
    re.DOTALL,
)
_FEATURED_COMMENT_RE = re.compile(
    r'/\*\*\s*\n\s*\* Weighted featured set \(60%\):.*?\*/',
    re.DOTALL,
)
_BATCH_RE = re.compile(r'^win_(g\d+)', re.I)
# Keep the long-standing Maria pin in the 60% bucket when present in the pool.
_FEATURED_PIN = 'win_g8500n00100_02.webp'


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


def _parse_array_names(text: str, pattern: re.Pattern[str], label: str) -> list[str]:
    m = pattern.search(text)
    if not m:
        raise RuntimeError(f'{label} array not found')
    return re.findall(r"'([^']+\.webp)'", m.group(2))


def read_promo_list(promo_js: Path) -> list[str]:
    return _parse_array_names(promo_js.read_text(encoding='utf-8'), _POOL_RE, 'PROMO_POPUP_FILES')


def read_featured_list(promo_js: Path) -> list[str]:
    return _parse_array_names(
        promo_js.read_text(encoding='utf-8'), _FEATURED_RE, 'PROMO_POPUP_FEATURED_FILES'
    )


def _group_win_batches(names: list[str]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    for n in names:
        m = _BATCH_RE.match(n)
        if m:
            groups[m.group(1).lower()].append(n)
    return groups


def _batch_newest_mtime(files: list[str], *popup_dirs: Path) -> float:
    newest = 0.0
    for n in files:
        for d in popup_dirs:
            p = d / n
            if p.is_file():
                try:
                    newest = max(newest, p.stat().st_mtime)
                except OSError:
                    pass
    return newest


def latest_batch_prefix(
    names: list[str],
    *,
    cdn_root: Path | None = None,
    app_dir: Path | None = None,
) -> str | None:
    """Newest Popup drop family (win_g####), by disk mtime then size — not raw g-number.

    Series ids are not chronological (g8500 can outrank g2170 numerically), so prefer
    the batch whose WebPs were most recently written under images/Popup.
    """
    groups = _group_win_batches(names)
    # Ignore tiny leftovers; a real kit drop is usually a dozen+ poses.
    candidates = {g: files for g, files in groups.items() if len(files) >= 6}
    if not candidates:
        candidates = dict(groups)
    if not candidates:
        return None

    cdn_popup = (cdn_root or _DEFAULT_CDN_ROOT) / 'images' / 'Popup'
    app_popup = (app_dir or _APP_DIR) / 'static' / 'images' / 'Popup'

    def _g_num(g: str) -> int:
        return int(re.sub(r'\D', '', g) or '0')

    scored: list[tuple[float, int, int, str]] = []
    for g, files in candidates.items():
        mt = _batch_newest_mtime(files, cdn_popup, app_popup)
        scored.append((mt, len(files), _g_num(g), g))
    # Newest mtime wins; tie-break larger batch, then higher id.
    scored.sort(reverse=True)
    return scored[0][3]


def desired_featured_files(
    pool: list[str],
    *,
    cdn_root: Path | None = None,
    app_dir: Path | None = None,
) -> list[str]:
    """Latest win_g#### batch (sorted) + pinned clip when present."""
    prefix = latest_batch_prefix(pool, cdn_root=cdn_root, app_dir=app_dir)
    out: list[str] = []
    if prefix:
        out = sorted((n for n in pool if n.lower().startswith(f'win_{prefix}')), key=str.lower)
    if _FEATURED_PIN in pool and _FEATURED_PIN not in out:
        out.append(_FEATURED_PIN)
    return out


def _rewrite_array(text: str, pattern: re.Pattern[str], names: list[str], label: str) -> str:
    m = pattern.search(text)
    if not m:
        raise RuntimeError(f'{label} array not found')
    inner_lines = [f"    '{n}'," for n in names]
    new_inner = ('\n' + '\n'.join(inner_lines) + '\n  ') if names else ''
    return text[: m.start(2)] + new_inner + text[m.end(2) :]


def rewrite_promo_js(
    promo_js: Path,
    pool: list[str],
    featured: list[str] | None,
    *,
    dry_run: bool,
) -> tuple[bool, bool]:
    """Rewrite pool (+ optional featured). Returns (pool_changed, featured_changed)."""
    text = promo_js.read_text(encoding='utf-8')
    new_text = _rewrite_array(text, _POOL_RE, pool, 'PROMO_POPUP_FILES')
    pool_changed = new_text != text
    featured_changed = False
    if featured is not None:
        before_feat = new_text
        prefix = latest_batch_prefix(pool, cdn_root=None, app_dir=None) or 'g????'
        # Prefer prefix inferred from featured list itself when rewriting.
        feat_pref = latest_batch_prefix(featured) if featured else None
        if feat_pref:
            prefix = feat_pref
        comment = (
            '  /**\n'
            f'   * Weighted featured set (60%): latest Popup batch (win_{prefix})'
            f' + pinned {_FEATURED_PIN}.\n'
            '   * Must also exist in PROMO_POPUP_FILES. Sync script rewrites pool + featured.\n'
            '   */'
        )
        if _FEATURED_COMMENT_RE.search(new_text):
            new_text = _FEATURED_COMMENT_RE.sub(comment, new_text, count=1)
        new_text = _rewrite_array(new_text, _FEATURED_RE, featured, 'PROMO_POPUP_FEATURED_FILES')
        featured_changed = new_text != before_feat
    if new_text == text:
        return False, False
    if dry_run:
        return pool_changed or (featured is not None and featured_changed), featured_changed
    promo_js.write_text(new_text, encoding='utf-8', newline='\n')
    return pool_changed, featured_changed


def update_image_indexes(
    *,
    cdn_root: Path,
    app_dir: Path,
    dry_run: bool,
) -> list[str]:
    """Rebuild images/Popup in CDN + app indexes from disk (png+webp)."""
    cdn_popup = cdn_root / 'images' / 'Popup'
    app_popup = app_dir / 'static' / 'images' / 'Popup'
    names = set(_disk_popup_names(cdn_popup)) | set(_disk_popup_names(app_popup))
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
        help='Exit 1 if pool/featured/index are out of sync (no write).',
    )
    ap.add_argument('--dry-run', action='store_true', help='Report changes without writing.')
    ap.add_argument(
        '--update-index',
        action=argparse.BooleanOptionalAction,
        default=True,
        help='Rebuild images/Popup in CDN + app image_index.json from disk (default: on).',
    )
    ap.add_argument(
        '--featured',
        action=argparse.BooleanOptionalAction,
        default=True,
        help='Rewrite PROMO_POPUP_FEATURED_FILES to latest win_g#### batch + pin (default: on).',
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
    current_feat = read_featured_list(promo_js)
    want_feat = (
        desired_featured_files(names, cdn_root=cdn_root, app_dir=_APP_DIR)
        if args.featured
        else None
    )
    missing = [n for n in names if n not in current]
    extra = [n for n in current if n not in names]
    pool_ok = current == names
    featured_ok = (want_feat is None) or (current_feat == want_feat)
    in_sync = pool_ok and featured_ok

    print(f'Popup WebP pool: {len(names)} (promo JS: {len(current)})')
    for k, v in diag['counts'].items():
        print(f'  {k}: {v}')
    if diag['disk_not_in_index']:
        print(
            f'  note: {len(diag["disk_not_in_index"])} disk file(s) not in image_index '
            f'(webp still included in promo list)'
        )
        for n in diag['disk_not_in_index'][:12]:
            print(f'    + {n}')
        if len(diag['disk_not_in_index']) > 12:
            print(f'    … +{len(diag["disk_not_in_index"]) - 12} more')

    if want_feat is not None:
        prefix = latest_batch_prefix(names, cdn_root=cdn_root, app_dir=_APP_DIR) or '?'
        print(f'Featured target: win_{prefix}* + pin → {len(want_feat)} file(s)')
        if featured_ok:
            print('PROMO_POPUP_FEATURED_FILES already in sync.')
        else:
            print(
                f'Featured out of sync: JS has {len(current_feat)}, want {len(want_feat)}'
            )

    if pool_ok:
        print('PROMO_POPUP_FILES already in sync.')
    else:
        print(f'Out of sync: +{len(missing)} missing in JS, -{len(extra)} extra in JS')
        for n in missing[:20]:
            print(f'  + {n}')
        if len(missing) > 20:
            print(f'  … +{len(missing) - 20} more')
        for n in extra[:10]:
            print(f'  - {n}')
        if len(extra) > 10:
            print(f'  … -{len(extra) - 10} more')

    if in_sync:
        return 0

    if args.check:
        print('Check failed: update with: python scripts/sync_kofi_promo_popup_avatars.py')
        return 1

    pool_changed, feat_changed = rewrite_promo_js(
        promo_js,
        names,
        want_feat,
        dry_run=args.dry_run,
    )
    if args.dry_run:
        bits = []
        if not pool_ok:
            bits.append(f'pool→{len(names)}')
        if want_feat is not None and not featured_ok:
            bits.append(f'featured→{len(want_feat)}')
        print(f'Dry run: would rewrite {promo_js} ({", ".join(bits) or "no array changes"}).')
        return 0
    if pool_changed:
        print(f'Updated PROMO_POPUP_FILES → {len(names)} Popup avatars.')
    if feat_changed:
        print(f'Updated PROMO_POPUP_FEATURED_FILES → {len(want_feat or [])} featured.')
    if not pool_changed and not feat_changed:
        print('No JS write needed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
