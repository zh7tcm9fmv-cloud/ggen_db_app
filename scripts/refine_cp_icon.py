"""Rebuild UI_Common_Icon_Cp.webp: drop white matte, enlarge glyph fill to match Sp footprint."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CP = ROOT / "static/images/UI/UI_Common_Icon_Cp.webp"
SP = ROOT / "static/images/UI/UI_Common_Icon_Sp.webp"


def dewhite_and_expand(src_path: Path, out_path: Path) -> None:
    im = Image.open(src_path).convert("RGBA")
    rgba = np.array(im, dtype=np.uint8)
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    a = rgba[:, :, 3].astype(np.float32)

    lum = 0.299 * r + 0.587 * g + 0.114 * b
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    kill = (
        ((lum >= 232) & (sat <= 50))
        | ((lum >= 246) & (sat <= 70))
        | ((r > 249) & (g > 249) & (b > 249))
    )
    rgba[:, :, 3] = np.where(kill & (a > 8), 0, rgba[:, :, 3])
    cleaned = Image.fromarray(rgba, "RGBA")

    aa = cleaned.split()[3]
    bbox = aa.getbbox()
    if not bbox:
        cleaned.save(out_path, "WEBP", quality=92, method=6)
        return

    crop = cleaned.crop(bbox)
    tw, th = Image.open(SP).convert("RGBA").size
    cw, ch = crop.size

    aa_sp = Image.open(SP).convert("RGBA").split()[3]
    sp_bbox = aa_sp.getbbox() or (0, 0, tw, th)
    sp_art_w = sp_bbox[2] - sp_bbox[0]
    sp_art_h = sp_bbox[3] - sp_bbox[1]

    pad = min(tw, th) * 0.012
    max_w = tw - pad * 2
    max_h = th - pad * 2

    min_w_goal = int(min(sp_art_w, max_w))
    scale = min(max_w / cw, max_h / ch)
    floor_scale = min_w_goal / cw
    scale = max(scale, floor_scale)
    if scale * ch > max_h:
        scale = max_h / ch

    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))

    scaled = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    nh_goal = int(min(sp_art_h, max_h))
    if scaled.height > 12 and scaled.height < nh_goal - 4:
        f_boost = nh_goal / scaled.height
        f_boost = min(f_boost, max_w / scaled.width, max_h / scaled.height)
        scaled = scaled.resize(
            (
                max(1, int(round(scaled.width * f_boost))),
                max(1, int(round(scaled.height * f_boost))),
            ),
            Image.Resampling.LANCZOS,
        )

    min_w_px = min(int(min(sp_art_w, max_w)), int(max_w))
    if scaled.width < min_w_px - 2:
        scaled = scaled.resize((min_w_px, scaled.height), Image.Resampling.LANCZOS)

    if scaled.height < nh_goal:
        scaled = scaled.resize((scaled.width, nh_goal), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    canvas.paste(scaled, ((tw - scaled.width) // 2, (th - scaled.height) // 2), scaled)
    canvas.save(out_path, "WEBP", quality=93, method=6)


def report(path: Path, label: str) -> None:
    im = Image.open(path).convert("RGBA")
    rgb = np.array(im)[:, :, :3]
    a = np.array(im.split()[3])
    wpx = (
        (rgb[:, :, 0] > 248)
        & (rgb[:, :, 1] > 248)
        & (rgb[:, :, 2] > 248)
        & (a > 40)
    ).mean()
    print(label, path.name, im.size, f"opaque near-white%{100*wpx:.1f}")


if __name__ == "__main__":
    src = CP
    if len(sys.argv) > 1:
        src = Path(sys.argv[1]).resolve()
    dewhite_and_expand(src, CP)
    report(CP, "CP out")
    report(SP, "SP ref")
