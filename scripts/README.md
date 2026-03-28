# Scripts

## Convert New DB Images to WebP (`convert_db_images_webp.py`)

**For updates:** Run after adding new images to `ggen_db_images`. Recursively scans **all folders and subfolders** under `ggen_db_images/images` (including `Option-Part (Modification)`, portraits, UI, etc.). Only converts:

- Images with no `.webp` yet (new)
- Images where the source PNG/JPG is newer than the existing `.webp` (updated)

```bash
# From ggen_db_app (defaults to ../ggen_db_images/images)
python scripts/convert_db_images_webp.py

# Use whole repo root instead (recurses into images/ and any other dirs)
python scripts/convert_db_images_webp.py --dir "C:/path/to/ggen_db_images"

# Preview first
python scripts/convert_db_images_webp.py --dry-run
```

---

## WebP Conversion (`convert_to_webp.py`)

Converts PNG/JPG images to WebP for faster page loads. Requires Pillow: `pip install Pillow`.

### Option 1: All PNG/JPG under `ggen_db_images/images` (recursive)

```bash
python scripts/convert_to_webp.py --base-dir "C:/path/to/ggen_db_images/images" --recursive
```

Walks every subfolder (same coverage as `convert_db_images_webp.py` when using the default `images` root). Use `--dry-run` first to preview.

You can also point at the repo root; that converts PNG/JPG everywhere under it:

```bash
python scripts/convert_to_webp.py --base-dir "C:/path/to/ggen_db_images" --recursive
```

### Option 2: Indexed images (`image_index.json`)

Uses `image_index.json` keys (paths like `images/Option-Part (Modification)/Sprite`). Set `--base-dir` to either:

- `…/ggen_db_images` (repo root), or  
- `…/ggen_db_images/images`

The script joins paths so `images/` is **not** duplicated when you use the `…/images` form (this was why Option-Part sprites could be skipped before).

```bash
python scripts/convert_to_webp.py --base-dir "C:/path/to/ggen_db_images"
# or
python scripts/convert_to_webp.py --base-dir "C:/path/to/ggen_db_images/images"
```

### Option 3: Local `static/` folder

```bash
python scripts/convert_to_webp.py
```

Defaults to `static/` if it exists. Override with `--base-dir`.

### Options

| Flag | Description |
|------|-------------|
| `--base-dir PATH` | `ggen_db_images`, `…/images`, or `static` — see above |
| `--recursive` | Convert all PNG/JPG recursively under `--base-dir`, ignore image_index |
| `--quality N` | WebP quality 1-100 (default: 85) |
| `--dry-run` | Show what would be converted, don't write files |
| `--no-skip-existing` | Re-convert even if .webp already exists |

### After conversion

1. **Local dev**: Place .webp files in `static/images/` next to originals.
2. **CDN (ggen_db_images)**: Commit .webp files to the repo and push. The app's `imgUrlWebp()` will request `.webp` URLs automatically.
