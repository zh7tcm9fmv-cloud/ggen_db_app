#!/usr/bin/env python3
"""Extract missing lmb_map_bg_* minimap textures from GGen asset bundles → ggen_db_images.

Usage (repo root, after GameResDownload2 pull):
  python scripts/extract_lmb_map_bgs.py
  python scripts/extract_lmb_map_bgs.py --dry-run
  python scripts/extract_lmb_map_bgs.py --bundle-dir "C:/path/to/assetbundle"

Updates image_index.json in both ggen_db_images and ggen_db_app for images/Stages.
"""
from __future__ import annotations

import argparse
import json
import sys
import warnings
from pathlib import Path

try:
    import UnityPy
    from UnityPy.exceptions import UnityVersionFallbackWarning
except ImportError:
    print('UnityPy required: pip install UnityPy', file=sys.stderr)
    raise SystemExit(1)

APP = Path(__file__).resolve().parents[1]
CDN_IMAGES = APP.parent / 'ggen_db_images' / 'images' / 'Stages'
DEFAULT_BUNDLE = Path(
    r'C:\Users\Mikew0911\Desktop\Texture2D\12.22\SD Gundam G Generation ETERNAL_GL\assetbundle'
)
MASTER_MAP = APP / 'data' / 'EN' / 'master' / 'm_map.json'
UNITY_VER = '2022.3.61f1'


def load_map_bg_filenames() -> set[str]:
    data = json.loads(MASTER_MAP.read_text(encoding='utf-8'))
    rows = data if isinstance(data, list) else next(v for v in data.values() if isinstance(v, list))
    out: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        asset = str(row.get('BackgroundAsset') or row.get('backgroundAsset') or '').strip()
        if not asset or asset == '0':
            continue
        if asset.startswith('map_bg_'):
            out.add('lmb_' + asset)
        elif asset.startswith('lmb_map_bg_'):
            out.add(asset)
        else:
            out.add('lmb_map_bg_' + asset)
    return out


def extract_texture(bundle_path: Path, dest: Path) -> None:
    warnings.filterwarnings('ignore', category=UnityVersionFallbackWarning)
    UnityPy.config.FALLBACK_UNITY_VERSION = UNITY_VER
    env = UnityPy.load(str(bundle_path))
    for obj in env.objects:
        if obj.type.name != 'Texture2D':
            continue
        img = obj.read().image
        dest.parent.mkdir(parents=True, exist_ok=True)
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGBA')
            img.save(dest, 'WEBP', lossless=True, method=6)
        else:
            img = img.convert('RGB')
            img.save(dest, 'WEBP', quality=85, method=6)
        return
    raise RuntimeError('no Texture2D in bundle')


def patch_image_index(index_path: Path, new_names: set[str]) -> int:
    if not index_path.is_file():
        return 0
    data = json.loads(index_path.read_text(encoding='utf-8'))
    key = 'images/Stages'
    existing = set(data.get(key) or [])
    added = sorted(n for n in new_names if n not in existing)
    if not added:
        return 0
    data[key] = sorted(existing | new_names)
    index_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return len(added)


def main() -> int:
    ap = argparse.ArgumentParser(description='Extract lmb_map_bg_* from Unity asset bundles')
    ap.add_argument('--bundle-dir', type=Path, default=DEFAULT_BUNDLE)
    ap.add_argument('--cdn-dir', type=Path, default=CDN_IMAGES)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if not args.bundle_dir.is_dir():
        print(f'Bundle dir not found: {args.bundle_dir}', file=sys.stderr)
        return 1
    if not MASTER_MAP.is_file():
        print(f'Master map not found: {MASTER_MAP}', file=sys.stderr)
        return 1

    needed = load_map_bg_filenames()
    have = {p.stem for p in args.cdn_dir.glob('lmb_map_bg_*.webp')}
    missing = sorted(needed - have)
    print(f'm_map backgrounds: {len(needed)}  on CDN: {len(have & needed)}  to extract: {len(missing)}')

    ok = fail = 0
    extracted: set[str] = set()
    no_bundle: list[str] = []

    for stem in missing:
        src = args.bundle_dir / stem
        dest = args.cdn_dir / f'{stem}.webp'
        if not src.is_file():
            no_bundle.append(stem)
            continue
        if args.dry_run:
            print(f'[dry-run] would extract {stem}')
            ok += 1
            continue
        try:
            extract_texture(src, dest)
            extracted.add(f'{stem}.webp')
            ok += 1
            print(f'OK {stem} ({dest.stat().st_size} bytes)')
        except Exception as exc:
            fail += 1
            print(f'FAIL {stem}: {exc}', file=sys.stderr)

    if no_bundle:
        print(f'No bundle file for {len(no_bundle)} map(s):', ', '.join(no_bundle[:12])
              + (' …' if len(no_bundle) > 12 else ''))

    if extracted and not args.dry_run:
        for idx in (APP.parent / 'ggen_db_images' / 'image_index.json', APP / 'image_index.json'):
            n = patch_image_index(idx, extracted)
            if n:
                print(f'Updated {idx.name}: +{n} entries')

    print(f'Done: extracted={ok} failed={fail} no_bundle={len(no_bundle)}')
    return 1 if fail else 0


if __name__ == '__main__':
    raise SystemExit(main())
