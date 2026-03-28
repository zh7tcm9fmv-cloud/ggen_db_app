#!/usr/bin/env python3
"""
Convert NEW images under ggen_db_images/images to WebP (all folders and subfolders).

Scans recursively from the `images` root so every category is included
(Option-Part (Modification), portraits, UI, etc.).

Only converts when:
  - No .webp exists yet, OR
  - Source PNG/JPG is newer than the existing .webp (updated image)

Run after adding new images in updates. Safe to run repeatedly.

Usage:
  # From ggen_db_app folder (default: ../ggen_db_images/images)
  python scripts/convert_db_images_webp.py

  # Whole ggen_db_images repo root (also OK — still scans all nested dirs)
  python scripts/convert_db_images_webp.py --dir "C:/path/to/ggen_db_images"

  # Dry run (show what would be converted)
  python scripts/convert_db_images_webp.py --dry-run
"""

import argparse
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Default: …/ggen_db_images/images (all asset subfolders, recursive)
DEFAULT_DB_IMAGES = PROJECT_ROOT.parent / "ggen_db_images" / "images"

try:
    from PIL import Image
except ImportError:
    print("Error: Pillow required. Run: pip install Pillow")
    sys.exit(1)


def needs_conversion(src_path: Path, webp_path: Path) -> bool:
    """True if we should convert: no webp yet, or source is newer than webp."""
    if not webp_path.exists():
        return True
    return src_path.stat().st_mtime > webp_path.stat().st_mtime


def convert_new_images(
    base_dir: Path,
    quality: int = 85,
    dry_run: bool = False,
) -> tuple[int, int, int]:
    """
    Convert only new/updated PNG/JPG to WebP.
    Returns (converted, skipped, errors).
    """
    converted = 0
    skipped = 0
    errors = 0

    for src_path in sorted(base_dir.rglob("*")):
        if not src_path.is_file():
            continue
        if src_path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
            continue

        webp_path = src_path.with_suffix(".webp")
        if not needs_conversion(src_path, webp_path):
            skipped += 1
            continue

        rel = src_path.relative_to(base_dir)
        is_new = not webp_path.exists()
        reason = "new" if is_new else "updated"
        if dry_run:
            print(f"  [{reason}] {rel}")
            converted += 1
            continue

        try:
            with Image.open(src_path) as img:
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGBA")
                    img.save(webp_path, "WEBP", quality=quality, method=6)
                else:
                    img = img.convert("RGB")
                    img.save(webp_path, "WEBP", quality=quality, method=6)
            converted += 1
            print(f"  [ok] {rel} ({reason})")
        except Exception as e:
            errors += 1
            print(f"  [error] {rel}: {e}")

    return converted, skipped, errors


def main():
    parser = argparse.ArgumentParser(
        description="Convert new/updated images in db_images to WebP"
    )
    parser.add_argument(
        "--dir",
        type=Path,
        default=DEFAULT_DB_IMAGES,
        help=(
            f"Root folder to scan recursively (default: {DEFAULT_DB_IMAGES}). "
            "Use …/ggen_db_images or …/ggen_db_images/images; both recurse into subfolders."
        ),
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=85,
        help="WebP quality 1-100 (default: 85)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be converted without writing",
    )
    args = parser.parse_args()

    base_dir = Path(args.dir).resolve()
    if not base_dir.exists():
        print(f"Error: Directory not found: {base_dir}")
        sys.exit(1)

    quality = min(100, max(1, args.quality))
    print(f"Scanning: {base_dir}")
    print("Converting only: new images, or updated (source newer than .webp)")
    if args.dry_run:
        print("(Dry run - no files will be written)")
    print()

    converted, skipped, errors = convert_new_images(
        base_dir=base_dir,
        quality=quality,
        dry_run=args.dry_run,
    )

    print()
    print(f"Done: {converted} converted, {skipped} skipped (up to date), {errors} errors")


if __name__ == "__main__":
    main()
