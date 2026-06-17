"""Generate spm_0026.webp — Psycho Gundam SP Conversion Chip composite."""
from __future__ import annotations

import math
import os
import urllib.request

from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(BASE, "_tmp_spm_0015.webp")
UNIT_URL = (
    "https://zh7tcm9fmv-cloud.github.io/ggen_db_images/images/Trait/thum/"
    "thum_g0800u03860.webp"
)
OUT = os.path.join(BASE, "static/images/Item/spm_0026.webp")


def _flat_top_hex_points(cx: float, cy: float, radius: float) -> list[tuple[float, float]]:
    return [
        (cx + radius * math.cos(math.pi / 6 + i * math.pi / 3),
         cy + radius * math.sin(math.pi / 6 + i * math.pi / 3))
        for i in range(6)
    ]


def main() -> None:
    unit_path = os.path.join(BASE, "_tmp_unit.webp")
    if not os.path.isfile(TEMPLATE):
        tmpl_url = (
            "https://zh7tcm9fmv-cloud.github.io/ggen_db_images/images/Item/spm_0015.webp"
        )
        urllib.request.urlretrieve(tmpl_url, TEMPLATE)
    urllib.request.urlretrieve(UNIT_URL, unit_path)

    spm = Image.open(TEMPLATE).convert("RGBA")
    unit = Image.open(unit_path).convert("RGBA")
    w, h = spm.size
    cx, cy = w / 2, h / 2
    # Inner portrait hex — tuned to match spm_0015 center cutout.
    inner_r = min(w, h) * 0.305
    inner = Image.new("L", (w, h), 0)
    ImageDraw.Draw(inner).polygon(_flat_top_hex_points(cx, cy, inner_r), fill=255)

    scale = max((inner_r * 2) / unit.width, (inner_r * 2) / unit.height) * 1.12
    nu = unit.resize((int(unit.width * scale), int(unit.height * scale)), Image.LANCZOS)
    ux = int(cx - nu.width / 2)
    uy = int(cy - nu.height / 2)

    out = spm.copy()
    ou = out.load()
    up = nu.load()
    inner_px = inner.load()
    for y in range(h):
        for x in range(w):
            if not inner_px[x, y]:
                continue
            sx, sy = x - ux, y - uy
            if 0 <= sx < nu.width and 0 <= sy < nu.height:
                r, g, b, a = up[sx, sy]
                if a > 16:
                    ou[x, y] = (r, g, b, a)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out.save(OUT, "WEBP", quality=92, method=6)
    print(f"Wrote {OUT} ({w}x{h})")


if __name__ == "__main__":
    main()
