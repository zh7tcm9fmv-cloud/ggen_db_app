#!/usr/bin/env python3
"""Build data/published/ogk_board_scales.json for /develop koma normalization.

Railway has no ogk files on disk, so runtime PIL measure returns 1.0 and
mixed trees (G-UNIT: padded 512 + tight crops) look wildly uneven. Commit
this JSON so production applies the same --ogk-norm as local.

Must stay in sync with app._ogk_compute_board_scale_from_disk constants:
  ALPHA_THR=24  TARGET_FILL=0.72  SCALE_MIN=0.52  SCALE_MAX=2.05

Usage:
  python scripts/build_ogk_board_scales.py
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ALPHA_THR = 24
TARGET_FILL = 0.72
SCALE_MIN = 0.52
SCALE_MAX = 2.05


def _ogk_dirs():
    dirs = []
    for d in (
        os.path.join(ROOT, "static", "images", "ogk"),
        os.path.join(os.path.expanduser("~"), "Desktop", "ggen_db_images", "images", "ogk"),
        r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\ogk",
        os.environ.get("GGEN_OGK_DIR") or "",
    ):
        if d and os.path.isdir(d) and d not in dirs:
            dirs.append(d)
    return dirs


def compute_scale(disk: str) -> float:
    from PIL import Image

    with Image.open(disk) as im:
        im = im.convert("RGBA")
        w, h = im.size
        alpha = im.split()[-1]
        ink = alpha.point(lambda p: 255 if p >= ALPHA_THR else 0)
        bbox = ink.getbbox() or alpha.getbbox()
    if not bbox or w <= 0 or h <= 0:
        return 1.0
    cw = max(1, bbox[2] - bbox[0])
    ch = max(1, bbox[3] - bbox[1])
    fill = max(cw, ch) / float(max(w, h))
    if fill <= 0.05:
        return 1.0
    scale = TARGET_FILL / fill
    return round(max(SCALE_MIN, min(SCALE_MAX, scale)), 3)


def main():
    dirs = _ogk_dirs()
    if not dirs:
        print("No ogk directory found", file=sys.stderr)
        return 1

    scales = {}
    for d in dirs:
        for name in sorted(os.listdir(d)):
            low = name.lower()
            if not low.startswith("ogk_") or not low.endswith(".webp"):
                continue
            if name in scales:
                continue
            scales[name] = compute_scale(os.path.join(d, name))

    out_path = os.path.join(ROOT, "data", "published", "ogk_board_scales.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    payload = {"version": 2, "count": len(scales), "scales": scales}
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    samples = [
        "ogk_g2170u00100.webp",
        "ogk_g2170u00200.webp",
        "ogk_g2170u00800.webp",
        "ogk_g2170u02100.webp",
        "ogk_g2100u00100.webp",
    ]
    print(f"Wrote {len(scales)} scales -> {out_path}")
    for s in samples:
        print(f"  {s}: {scales.get(s, 'MISSING')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
