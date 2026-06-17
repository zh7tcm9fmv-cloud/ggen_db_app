"""Preview SP conversion chip composite (SSR base + unit + Sp frame)."""
from __future__ import annotations

import math
import os
import urllib.request

from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = BASE
CANVAS = (136, 146)


def _flat_top_hex_points(cx: float, cy: float, radius: float) -> list[tuple[float, float]]:
    return [
        (cx + radius * math.cos(math.pi / 6 + i * math.pi / 3),
         cy + radius * math.sin(math.pi / 6 + i * math.pi / 3))
        for i in range(6)
    ]


def _ensure(path: str, url: str) -> None:
    if not os.path.isfile(path):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        urllib.request.urlretrieve(url, path)


def composite_sp_chip(unit_path: str, out_path: str) -> None:
    ui = os.path.join(BASE, "static/images/UI")
    ssr_base = os.path.join(ui, "UI_Common_Tmb_Square_SSR_Base.webp")
    sp_frame = os.path.join(ui, "UI_Common_Sp_Frame.webp")
    cdn = "https://zh7tcm9fmv-cloud.github.io/ggen_db_images/images"
    _ensure(sp_frame, f"{cdn}/UI/UI_Common_Sp_Frame.webp")
    _ensure(ssr_base, f"{cdn}/UI/UI_Common_Tmb_Square_SSR_Base.webp")

    w, h = CANVAS
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # SSR square base — center-crop scale to canvas.
    base = Image.open(ssr_base).convert("RGBA")
    side = min(base.size)
    left = (base.width - side) // 2
    top = (base.height - side) // 2
    base = base.crop((left, top, left + side, top + side))
    base = base.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(base)

    unit = Image.open(unit_path).convert("RGBA")
    frame = Image.open(sp_frame).convert("RGBA")
    if frame.size != (w, h):
        frame = frame.resize((w, h), Image.LANCZOS)

    # Portrait area inside hex opening (tuned against spm_0015).
    cx, cy = w / 2, h / 2 + 1
    inner_r = min(w, h) * 0.295
    inner = Image.new("L", (w, h), 0)
    ImageDraw.Draw(inner).polygon(_flat_top_hex_points(cx, cy, inner_r), fill=255)

    scale = max((inner_r * 2.05) / unit.width, (inner_r * 2.05) / unit.height)
    nu = unit.resize((int(unit.width * scale), int(unit.height * scale)), Image.LANCZOS)
    ux = int(cx - nu.width / 2)
    uy = int(cy - nu.height / 2 - 1)

    portrait = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    portrait.paste(nu, (ux, uy), nu)
    masked = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    mp = masked.load()
    pp = portrait.load()
    ip = inner.load()
    for y in range(h):
        for x in range(w):
            if ip[x, y]:
                mp[x, y] = pp[x, y]
    canvas.alpha_composite(masked)
    canvas.alpha_composite(frame)
    canvas.save(out_path, "WEBP", quality=92, method=6)


def main() -> None:
    unit_url = (
        "https://zh7tcm9fmv-cloud.github.io/ggen_db_images/images/Trait/thum/"
        "thum_g0800u03860.webp"
    )
    unit_path = os.path.join(BASE, "_tmp_unit.webp")
    _ensure(unit_path, unit_url)

    ref_url = "https://zh7tcm9fmv-cloud.github.io/ggen_db_images/images/Item/spm_0015.webp"
    ref_path = os.path.join(BASE, "_ref_spm_0015.webp")
    _ensure(ref_path, ref_url)

    out = os.path.join(BASE, "static/images/Item/spm_0026.webp")
    composite_sp_chip(unit_path, out)
    print("Wrote", out)


if __name__ == "__main__":
    main()
