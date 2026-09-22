"""Mock: /collections possession save-as-image — 84 UR units pyramid.

Stacking: centered pyramid with moderate overlap; paint base→apex so
upper faces sit in front.

LB tier: official Grade_M star icons (same as collections UI).
  missing : black silhouette, no stars
  0–2 LB  : star pips only
  MAX     : star pips + conic gradient silhouette border (3D bevel/extrude)
            — no per-unit HUD card
"""
from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\_mocks\collections_possession_pyramid_mock.png")
BG_PATH = Path(r"C:\Users\Mikew0911\Desktop\GGen\Eternal UI\v2.6\New\40cad315e6ba.webp")
BADGE_PATH = Path(r"C:\Users\Mikew0911\Desktop\GGen\Eternal UI\v2.6\New\4edfa4b3577f.webp")
CDN_ROOT = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_images\images")
UI = CDN_ROOT / "UI"

ROWS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 12]
assert sum(ROWS) == 84

LB_CYCLE = [-1, 0, 1, 2, 3]

# conic stops from .gradborder
GRAD_STOPS = [
    (0.00, (255, 138, 0)),
    (0.25, (91, 141, 239)),
    (0.50, (76, 208, 138)),
    (0.75, (255, 92, 92)),
    (1.00, (255, 138, 0)),
]


def fetch_units():
    with urllib.request.urlopen("http://127.0.0.1:5000/api/collections/catalog?lang=EN", timeout=60) as r:
        data = json.load(r)
    units = data.get("units") or []
    if len(units) != 84:
        raise SystemExit(f"expected 84 UR units, got {len(units)}")
    return units


def local_art(unit: dict) -> Path | None:
    art = unit.get("art") or unit.get("thum") or ""
    marker = "/images/"
    if marker not in art:
        return None
    rel = art.split(marker, 1)[1].split("?")[0]
    p = CDN_ROOT / Path(rel)
    return p if p.is_file() else None


def load_rgba(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA"))


def fit_rgba(rgba: np.ndarray, max_w: int, max_h: int) -> np.ndarray:
    im = Image.fromarray(rgba, "RGBA")
    w, h = im.size
    s = min(max_w / w, max_h / h, 1.0)
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    return np.array(im.resize((nw, nh), Image.Resampling.LANCZOS))


def silhouette(rgba: np.ndarray, rgb: tuple[int, int, int], alpha: int = 255) -> Image.Image:
    m = rgba[:, :, 3] > 40
    out = np.zeros_like(rgba)
    out[m, 0] = rgb[0]
    out[m, 1] = rgb[1]
    out[m, 2] = rgb[2]
    out[m, 3] = alpha
    return Image.fromarray(out, "RGBA")


def cover_background(path: Path, w: int, h: int) -> Image.Image:
    bg = Image.open(path).convert("RGBA")
    bw, bh = bg.size
    s = max(w / bw, h / bh)
    nw, nh = int(bw * s), int(bh * s)
    bg = bg.resize((nw, nh), Image.Resampling.LANCZOS)
    x0 = (nw - w) // 2
    y0 = (nh - h) // 2
    return bg.crop((x0, y0, x0 + w, y0 + h))


def load_lb_icons() -> dict[str, Image.Image]:
    return {
        "none": Image.open(UI / "UI_Common_Icon_Grade_M_None.webp").convert("RGBA"),
        "neutral": Image.open(UI / "UI_Common_Icon_Grade_M_Neutral.webp").convert("RGBA"),
        "max": Image.open(UI / "UI_Common_Icon_Grade_M_Max.webp").convert("RGBA"),
    }


def lb_pip_keys(lb: int) -> list[str] | None:
    if lb < 0:
        return None
    if lb == 0:
        return ["none", "none", "none"]
    if lb == 1:
        return ["neutral", "none", "none"]
    if lb == 2:
        return ["neutral", "neutral", "none"]
    return ["max", "max", "max"]


def pip_h_for(art_w: int) -> int:
    return max(14, min(22, art_w // 8))


def _dilate(mask_l: Image.Image, px: int) -> Image.Image:
    if px <= 0:
        return mask_l
    return mask_l.filter(ImageFilter.MaxFilter(px * 2 + 1))


def _erode(mask_l: Image.Image, px: int) -> Image.Image:
    if px <= 0:
        return mask_l
    return mask_l.filter(ImageFilter.MinFilter(px * 2 + 1))


def _conic_rgb(ang: np.ndarray, spin: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    t = (ang + spin) % 1.0
    r = np.zeros_like(t, dtype=np.float32)
    g = np.zeros_like(t, dtype=np.float32)
    b = np.zeros_like(t, dtype=np.float32)
    for i in range(len(GRAD_STOPS) - 1):
        t0, c0 = GRAD_STOPS[i]
        t1, c1 = GRAD_STOPS[i + 1]
        m = (t >= t0) & (t <= t1)
        if not m.any():
            continue
        u = (t[m] - t0) / max(1e-6, t1 - t0)
        r[m] = c0[0] + (c1[0] - c0[0]) * u
        g[m] = c0[1] + (c1[1] - c0[1]) * u
        b[m] = c0[2] + (c1[2] - c0[2]) * u
    return r, g, b


def max_conic_border_3d(rgba: np.ndarray, spin: float = 0.18) -> tuple[Image.Image, Image.Image, int]:
    """Silhouette-following conic border with extrusion + bevel for 3D pop.

    Returns (extrude_layer, border_layer, pad) — paste at (x0-pad, y0-pad).
    """
    h, w = rgba.shape[:2]
    # border thickness ~4–6px around the art
    thick = max(4, min(7, min(w, h) // 28))
    # Pad so flush-edge art (e.g. Crossbone left blade) can grow a full ring
    pad = thick + 12
    padded = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    padded.paste(Image.fromarray(rgba, "RGBA"), (pad, pad))
    pr = np.array(padded)
    ph, pw = pr.shape[:2]
    body = Image.fromarray(((pr[:, :, 3] > 8).astype(np.uint8) * 255), "L")
    outer = _dilate(body, thick + 1)
    inner = _erode(body, 1)
    ring = np.clip(np.array(outer).astype(np.int16) - np.array(inner).astype(np.int16), 0, 255).astype(np.uint8)
    # keep ring outside the soft body so it frames the unit
    body_a = np.array(body) > 8
    ring[body_a] = 0
    ys, xs = np.where(ring > 40)
    border = np.zeros((ph, pw, 4), dtype=np.uint8)
    extrude = np.zeros((ph, pw, 4), dtype=np.uint8)
    if not len(xs):
        return Image.fromarray(extrude, "RGBA"), Image.fromarray(border, "RGBA"), pad

    cy = ph * 0.5
    cx = pw * 0.5
    ang = (np.arctan2(ys.astype(np.float32) - cy, xs.astype(np.float32) - cx) + math.pi) / (2 * math.pi)
    r, g, b = _conic_rgb(ang, spin)

    # 3D bevel: light from top-left — brighten NW, darken SE
    nx = (xs.astype(np.float32) - cx) / max(1.0, pw * 0.5)
    ny = (ys.astype(np.float32) - cy) / max(1.0, ph * 0.5)
    lit = np.clip(0.55 + (-0.55 * nx + -0.7 * ny) * 0.55, 0.35, 1.35)

    br = np.clip(r * lit, 0, 255).astype(np.uint8)
    bg_ = np.clip(g * lit, 0, 255).astype(np.uint8)
    bb = np.clip(b * lit, 0, 255).astype(np.uint8)
    ba = np.clip(ring[ys, xs].astype(np.int16) + 40, 0, 255).astype(np.uint8)

    border[ys, xs, 0] = br
    border[ys, xs, 1] = bg_
    border[ys, xs, 2] = bb
    border[ys, xs, 3] = ba

    # thin inner highlight lip (top-left bias) for chrome edge
    lip_outer = _dilate(body, 2)
    lip_inner = body
    lip = np.clip(np.array(lip_outer).astype(np.int16) - np.array(lip_inner).astype(np.int16), 0, 255)
    lip[body_a] = 0
    ly, lx = np.where(lip > 40)
    if len(lx):
        lnx = (lx.astype(np.float32) - cx) / max(1.0, pw * 0.5)
        lny = (ly.astype(np.float32) - cy) / max(1.0, ph * 0.5)
        keep = (-lnx - lny) > 0.05
        ly, lx = ly[keep], lx[keep]
        border[ly, lx, 0] = 255
        border[ly, lx, 1] = 255
        border[ly, lx, 2] = 255
        border[ly, lx, 3] = np.maximum(border[ly, lx, 3], 160)

    extrude[ys, xs, 0] = 12
    extrude[ys, xs, 1] = 14
    extrude[ys, xs, 2] = 18
    extrude[ys, xs, 3] = np.clip(ba.astype(np.int16) + 30, 0, 220).astype(np.uint8)

    extrude_im = Image.fromarray(extrude, "RGBA").filter(ImageFilter.GaussianBlur(radius=0.8))
    border_im = Image.fromarray(border, "RGBA")
    return extrude_im, border_im, pad


def paste_lb_pips(
    canvas: Image.Image,
    icons: dict[str, Image.Image],
    keys: list[str],
    cx: int,
    foot_y: int,
    pip_h: int = 18,
) -> None:
    gap = 1
    scaled = []
    for k in keys:
        im = icons[k]
        s = pip_h / im.height
        nw = max(1, int(im.width * s))
        scaled.append(im.resize((nw, pip_h), Image.Resampling.LANCZOS))
    total_w = sum(im.width for im in scaled) + gap * (len(scaled) - 1)
    x = cx - total_w // 2
    y = foot_y
    # Drop shadow so stars stay readable under overlapping art
    for im in scaled:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        arr = np.array(im)
        m = arr[:, :, 3] > 40
        sh_arr = np.zeros_like(arr)
        sh_arr[m, 3] = 160
        sh = Image.fromarray(sh_arr, "RGBA").filter(ImageFilter.GaussianBlur(radius=1.2))
        canvas.alpha_composite(sh, (x + 1, y + 2))
        canvas.alpha_composite(im, (x, y))
        x += im.width + gap


def paste_unit(
    canvas: Image.Image,
    rgba: np.ndarray,
    lb: int,
    cx: int,
    cy: int,
    icons: dict[str, Image.Image],
    spin: float = 0.18,
) -> None:
    h, w = rgba.shape[:2]
    x0 = cx - w // 2
    y0 = cy - h // 2
    art = Image.fromarray(rgba, "RGBA")

    if lb < 0:
        canvas.alpha_composite(silhouette(rgba, (6, 8, 12), 245), (x0, y0))
        return

    if lb >= 3:
        extrude, border, bpad = max_conic_border_3d(rgba, spin=spin)
        # extrude offset down-right for 3D pop (depth only — not an LB-tier shadow language)
        ox, oy = max(3, w // 40), max(3, h // 36)
        canvas.alpha_composite(extrude, (x0 - bpad + ox, y0 - bpad + oy))
        canvas.alpha_composite(border, (x0 - bpad, y0 - bpad))
        canvas.alpha_composite(art, (x0, y0))
        # border again lightly so it sits in front of toes/weapons that poke out
        canvas.alpha_composite(border, (x0 - bpad, y0 - bpad))
    else:
        canvas.alpha_composite(art, (x0, y0))

    keys = lb_pip_keys(lb)
    if keys:
        ph = pip_h_for(w)
        # Tight to feet — slight overlap so stars read as attached to the unit
        paste_lb_pips(canvas, icons, keys, cx, y0 + h - ph + 1, pip_h=ph)


def main() -> None:
    units = fetch_units()
    icons = load_lb_icons()
    arts: list[tuple[np.ndarray, int]] = []
    missing_files = 0
    for i, u in enumerate(units):
        p = local_art(u)
        if p is None:
            missing_files += 1
            ph = np.zeros((200, 160, 4), dtype=np.uint8)
            ph[20:180, 30:130] = (40, 50, 60, 200)
            rgba = ph
        else:
            rgba = load_rgba(p)
        arts.append((rgba, LB_CYCLE[i % len(LB_CYCLE)]))
    if missing_files:
        print(f"warning: {missing_files} arts missing locally")

    cell_w, cell_h = 168, 188
    overlap_x = 0.30
    overlap_y = 0.26
    step_x = int(cell_w * (1 - overlap_x))
    step_y = int(cell_h * (1 - overlap_y))
    pad_x, pad_top, pad_bot = 96, 160, 90
    max_cols = max(ROWS)
    content_w = (max_cols - 1) * step_x + cell_w
    content_h = (len(ROWS) - 1) * step_y + cell_h
    edge = 56
    W = pad_x * 2 + content_w + edge * 2
    H = pad_top + pad_bot + content_h + edge

    canvas = cover_background(BG_PATH, W, H).convert("RGBA")
    canvas = Image.alpha_composite(canvas, Image.new("RGBA", (W, H), (0, 0, 0, 55)))

    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 26)
        font_s = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 14)
        font_xs = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 12)
    except OSError:
        font = font_s = font_xs = ImageFont.load_default()

    draw.text((pad_x, 26), "POSSESSION  ·  UR UNITS  ·  MOCK", fill=(0, 220, 255, 255), font=font)
    draw.text(
        (pad_x, 58),
        "84 units  ·  centered pyramid  ·  LB stars  ·  MAX = 3D conic silhouette border",
        fill=(180, 200, 215, 255),
        font=font_s,
    )

    leg_y = 88
    leg_x = pad_x
    draw.text((leg_x, leg_y), "Missing", fill=(160, 170, 180, 255), font=font_xs)
    leg_x += 70
    samples = [
        ("0 LB", ["none", "none", "none"]),
        ("1 LB", ["neutral", "none", "none"]),
        ("2 LB", ["neutral", "neutral", "none"]),
        ("MAX", ["max", "max", "max"]),
    ]
    for label, keys in samples:
        draw.text((leg_x, leg_y), label, fill=(200, 210, 220, 255), font=font_xs)
        paste_lb_pips(canvas, icons, keys, leg_x + 55, leg_y - 2, pip_h=16)
        leg_x += 130

    badge = Image.open(BADGE_PATH).convert("RGBA")
    bw = 200
    bh = int(badge.height * (bw / badge.width))
    badge = badge.resize((bw, bh), Image.Resampling.LANCZOS)
    canvas.alpha_composite(badge, (W - pad_x - bw, 16))

    # slots: paint base → apex; origin shifted by edge pad
    cursor = 0
    row_slots: list[list[tuple[np.ndarray, int, int, int, float]]] = []
    y = pad_top + edge // 2
    origin_x = pad_x + edge
    for ri, n in enumerate(ROWS):
        row_span = (n - 1) * step_x + cell_w
        x_start = origin_x + (content_w - row_span) // 2
        scale = 0.82 + 0.18 * (ri / max(1, len(ROWS) - 1))
        mw = int(cell_w * scale)
        mh = int(cell_h * scale)
        slots = []
        for j in range(n):
            rgba, lb = arts[cursor]
            fitted = fit_rgba(rgba, mw - 6, mh - 6)
            cx = x_start + j * step_x + cell_w // 2
            cy = y + cell_h // 2
            spin = (0.12 + cursor * 0.07) % 1.0
            slots.append((fitted, lb, cx, cy, spin))
            cursor += 1
        row_slots.append(slots)
        y += step_y

    assert cursor == 84
    for slots in reversed(row_slots):
        for fitted, lb, cx, cy, spin in slots:
            paste_unit(canvas, fitted, lb, cx, cy, icons, spin=spin)

    draw = ImageDraw.Draw(canvas)
    draw.text(
        (pad_x, H - 40),
        "Idea mock only — not wired to /collections save-as-image",
        fill=(140, 155, 170, 255),
        font=font_s,
    )
    counts = {s: sum(1 for _, lb in arts if lb == s) for s in LB_CYCLE}
    draw.text(
        (pad_x, H - 22),
        f"mix  missing:{counts[-1]}  0:{counts[0]}  1:{counts[1]}  2:{counts[2]}  MAX:{counts[3]}",
        fill=(120, 140, 155, 255),
        font=font_xs,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({W}x{H})")


if __name__ == "__main__":
    main()
