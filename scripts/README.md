# Scripts

## Convert New DB Images to WebP (`convert_db_images_webp.py`)

**For updates:** Run after adding new images to `ggen_db_images`. Only converts:
- Images with no `.webp` yet (new)
- Images where the source PNG/JPG is newer than the existing `.webp` (updated)

```bash
# From ggen_db_app (defaults to ../ggen_db_images)
python scripts/convert_db_images_webp.py

# Custom path
python scripts/convert_db_images_webp.py --dir "C:/path/to/ggen_db_images"

# Preview first
python scripts/convert_db_images_webp.py --dry-run
```

---

## WebP Conversion (`convert_to_webp.py`)

Converts PNG/JPG images to WebP for faster page loads. Requires Pillow: `pip install Pillow`.

### Option 1: Convert images in the ggen_db_images repo

If your images live in a separate repo (e.g. `ggen_db_images`):

```bash
python scripts/convert_to_webp.py --base-dir "C:/path/to/ggen_db_images" --recursive
```

This recursively converts all PNG/JPG under that directory. Use `--dry-run` first to preview.

### Option 2: Convert indexed images in local static folder

Uses `image_index.json` to convert only cataloged images:

```bash
python scripts/convert_to_webp.py
```

Defaults to `static/` if it exists. Override with `--base-dir`.

### Options

| Flag | Description |
|------|-------------|
| `--base-dir PATH` | Base directory (contains `images/` or is the images root) |
| `--recursive` | Convert all PNG/JPG recursively, ignore image_index |
| `--quality N` | WebP quality 1-100 (default: 85) |
| `--dry-run` | Show what would be converted, don't write files |
| `--no-skip-existing` | Re-convert even if .webp already exists |

### After conversion

1. **Local dev**: Place .webp files in `static/images/` next to originals.
2. **CDN (ggen_db_images)**: Commit .webp files to the repo and push. The app's `imgUrlWebp()` will request `.webp` URLs automatically.
