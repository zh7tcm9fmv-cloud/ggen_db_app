#!/usr/bin/env python3
"""Prune duplicate / redundant files from ggen_db_images (CDN repo).

Safe removals (website uses WebP + canonical folder names):
  - URL-encoded duplicate folders (Key%20Unit, Option-Part%20%28Modification%29)
  - PNG/JPG files when a matching .webp exists in the same folder

Also updates image_index.json in ggen_db_images and ggen_db_app.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

ENCODED_DUPLICATE_DIRS = (
    'Key%20Unit',
    'Option-Part%20%28Modification%29',
)

CANONICAL_DIR_CHECKS = (
    ('Key%20Unit', 'Key Unit'),
    ('Option-Part%20%28Modification%29', 'Option-Part (Modification)'),
)


def load_index(path: Path) -> dict:
    if not path.is_file():
        return {}
    with path.open(encoding='utf-8') as f:
        return json.load(f)


def save_index(path: Path, data: dict) -> None:
    with path.open('w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')


def prune_index(data: dict) -> tuple[dict, int]:
    """Drop encoded folder keys and raster names that have a .webp sibling."""
    removed_keys = 0
    out = {}
    for key, names in data.items():
        if any(enc in key for enc in ENCODED_DUPLICATE_DIRS):
            removed_keys += 1
            continue
        kept = []
        name_set = set(names or [])
        for name in names or []:
            low = name.lower()
            if low.endswith('.png'):
                if name[:-4] + '.webp' in name_set or name[:-4] + '.WEBP' in name_set:
                    continue
            elif low.endswith('.jpg') or low.endswith('.jpeg'):
                base = name.rsplit('.', 1)[0]
                if base + '.webp' in name_set:
                    continue
            kept.append(name)
        out[key] = kept
    return out, removed_keys


def remove_raster_duplicates(images_root: Path, *, dry_run: bool) -> tuple[int, int]:
    """Delete PNG/JPG when .webp exists. Returns (files_removed, bytes_freed)."""
    removed = 0
    freed = 0
    for dirpath, _, filenames in os.walk(images_root):
        for fn in filenames:
            low = fn.lower()
            if not (low.endswith('.png') or low.endswith('.jpg') or low.endswith('.jpeg')):
                continue
            full = Path(dirpath) / fn
            webp = full.with_suffix('.webp')
            if not webp.is_file():
                continue
            size = full.stat().st_size
            if dry_run:
                print(f'  [dry-run] delete {full} ({size} bytes)')
            else:
                full.unlink()
            removed += 1
            freed += size
    return removed, freed


def remove_encoded_dirs(images_root: Path, *, dry_run: bool) -> tuple[int, int]:
    removed = 0
    freed = 0
    for enc, canonical in CANONICAL_DIR_CHECKS:
        enc_path = images_root / enc
        can_path = images_root / canonical
        if not enc_path.is_dir():
            continue
        if not can_path.is_dir():
            print(f'  skip {enc_path}: canonical {can_path} missing')
            continue
        size = sum(f.stat().st_size for f in enc_path.rglob('*') if f.is_file())
        if dry_run:
            print(f'  [dry-run] rmtree {enc_path} ({size} bytes)')
        else:
            shutil.rmtree(enc_path)
        removed += 1
        freed += size
    return removed, freed


def main():
    ap = argparse.ArgumentParser(description='Prune duplicate CDN image assets')
    ap.add_argument('--images-root', default=r'C:\Users\Mikew0911\Desktop\ggen_db_images\images')
    ap.add_argument('--app-root', default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument('--cdn-root', default=r'C:\Users\Mikew0911\Desktop\ggen_db_images')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    images_root = Path(args.images_root)
    if not images_root.is_dir():
        print(f'Images root not found: {images_root}', file=sys.stderr)
        return 1

    print(f'Images root: {images_root}')
    print('Removing URL-encoded duplicate folders…')
    d_dirs, d_dir_bytes = remove_encoded_dirs(images_root, dry_run=args.dry_run)
    print(f'  duplicate dirs: {d_dirs} ({d_dir_bytes / 1024 / 1024:.2f} MB)')

    print('Removing PNG/JPG where WebP exists…')
    d_files, d_file_bytes = remove_raster_duplicates(images_root, dry_run=args.dry_run)
    print(f'  raster files: {d_files} ({d_file_bytes / 1024 / 1024:.1f} MB)')

    if args.dry_run:
        print('Dry run — image_index.json not modified.')
        return 0

    for label, index_path in (
        ('cdn', Path(args.cdn_root) / 'image_index.json'),
        ('app', Path(args.app_root) / 'image_index.json'),
    ):
        if not index_path.is_file():
            print(f'  skip {label} index (missing {index_path})')
            continue
        data = load_index(index_path)
        pruned, dropped_keys = prune_index(data)
        save_index(index_path, pruned)
        print(f'  updated {label} image_index.json (dropped {dropped_keys} encoded folder keys)')

    total_mb = (d_dir_bytes + d_file_bytes) / 1024 / 1024
    print(f'Done. Freed ~{total_mb:.1f} MB on disk.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
