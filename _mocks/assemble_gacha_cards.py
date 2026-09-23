"""Composite in-game gasha gain cards to match Unit Assembly Results refs.

Layout (from owner screenshots):
  - Horizontal plate; rarity badge top-left
  - Role icon (Melee / Ranged / Defense) under rarity
  - Acquisition icon bottom-left
  - Close-up portrait filling the plate (soft left/bottom fade)
  - SSR/UR outer glow; UR optional New tag

Layer recipes:
  R:   Base + Frame
  SR:  Pat_01/02 (SR tone) + R_Frame (SR_Frame tone)
  SSR: Effect_U + Base + Frame
  UR:  Effect_Material + Pats (UR tone) + SSR-like frame (UR_Frame tone)
  Supp: Tmb_Supporter_Base + Gain_Supporter_{SSR|UR}_Effect
"""
from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

BASE = r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\UI\gasha_sim"
UI = r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\UI"
POR_UNIT = r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\unit_portraits\ub_g0800u00150.webp"
POR_CHAR = r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\Trait\thum\thum_g0800c00101.webp"
# Owner PSD (image.psd.psd): sb_g0310s00200 on native 354×190 Tmb_Supporter_Base
POR_SUPP = r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\Supporters\sb_g0310s00200.webp"
OUT = r"C:\Users\Mikew0911\Desktop\ggen_db_app\_mocks\gacha_card_assemble"
REFS = r"C:\Users\Mikew0911\Desktop\ggen_db_app\_mocks\gacha_card_refs"

CW, CH = 500, 280
BW, BH = 452, 237
# New Project(2).psd: Layer 6 frame 446×219; Layer 5 base at (−3,−16)
FW, FH = 446, 219
BASE_DX, BASE_DY = -3, -16
# Supporter plate = in-game / PSD native size
SUPP_W, SUPP_H = 354, 190
SUPP_POR = (50, 21, 260, 145)  # x, y, w, h from owner PSD


def load(name: str, folder: str = BASE) -> Image.Image:
    for ext in (".webp", ".png"):
        p = os.path.join(folder, name + ext)
        if os.path.exists(p):
            return Image.open(p).convert("RGBA")
    raise FileNotFoundError(os.path.join(folder, name))


def load_ui(name: str) -> Image.Image:
    return load(name, UI)


def average_tone(swatch: Image.Image, min_lum: int = 40) -> tuple[int, int, int]:
    s = swatch.convert("RGBA").resize((48, 48), Image.Resampling.BOX)
    cols = [(r, g, b) for r, g, b, a in s.getdata() if a > 40 and (r + g + b) // 3 > min_lum]
    if not cols:
        cols = [(180, 160, 90)]
    n = len(cols)
    return (sum(c[0] for c in cols) // n, sum(c[1] for c in cols) // n, sum(c[2] for c in cols) // n)


def dominant_vivid(swatch: Image.Image) -> tuple[int, int, int]:
    s = swatch.convert("RGBA").resize((64, 64), Image.Resampling.BOX)
    best, best_score = (200, 180, 80), -1
    for r, g, b, a in s.getdata():
        if a < 50:
            continue
        mx, mn = max(r, g, b), min(r, g, b)
        sat = mx - mn
        lum = (r + g + b) / 3
        score = sat * 2 + (lum if lum < 220 else 100)
        if score > best_score:
            best_score = score
            best = (r, g, b)
    return best


def tint_keep_alpha(img: Image.Image, rgb: tuple[int, int, int], strength: float) -> Image.Image:
    tint = Image.new("RGBA", img.size, (*rgb, 255))
    out = Image.blend(img.convert("RGBA"), tint, max(0.0, min(1.0, strength)))
    out.putalpha(img.split()[-1])
    return out


def build_sr_base() -> Image.Image:
    tone = load("UI_Gasha_Card_SR_Base")
    sil = load("UI_Gasha_Card_R_Base").resize((BW, BH), Image.Resampling.LANCZOS)
    rgb = average_tone(tone, min_lum=10)
    fill = tone.convert("RGBA").resize((BW, BH), Image.Resampling.LANCZOS)
    fill = ImageEnhance.Color(fill).enhance(1.2)
    fill.putalpha(sil.split()[-1])

    out = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    out = Image.alpha_composite(out, fill)

    for name, strength, pad in (("UI_Gasha_Card_Pat_01", 0.5, 0), ("UI_Gasha_Card_Pat_02", 0.35, 12)):
        pat = load(name).resize((BW - pad * 2, BH - pad * 2), Image.Resampling.LANCZOS)
        pat = tint_keep_alpha(pat, rgb, strength)
        layer = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
        layer.alpha_composite(pat, (pad, pad))
        a = Image.composite(layer.split()[-1], Image.new("L", layer.size, 0), sil.split()[-1])
        layer.putalpha(a)
        out = Image.alpha_composite(out, layer)
    return out


def build_ur_base() -> Image.Image:
    """R_Base silhouette + UR tone + Pat_03 only (owner fitment)."""
    tone = load("UI_Gasha_Card_UR_Base")
    sil = load("UI_Gasha_Card_R_Base").resize((BW, BH), Image.Resampling.LANCZOS)
    rgb = average_tone(tone, min_lum=10)
    fill = tone.convert("RGBA").resize((BW, BH), Image.Resampling.LANCZOS)
    fill = ImageEnhance.Color(fill).enhance(1.55)
    fill = ImageEnhance.Brightness(fill).enhance(1.12)
    fill.putalpha(sil.split()[-1])

    out = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    out = Image.alpha_composite(out, fill)

    pat = load("UI_Gasha_Card_Pat_03").resize((BW - 16, BH - 16), Image.Resampling.LANCZOS)
    pat = tint_keep_alpha(pat, rgb, 0.55)
    layer = Image.new("RGBA", (BW, BH), (0, 0, 0, 0))
    layer.alpha_composite(pat, (8, 8))
    a = Image.composite(layer.split()[-1], Image.new("L", layer.size, 0), sil.split()[-1])
    layer.putalpha(a)
    out = Image.alpha_composite(out, layer)
    return out


def recolor_frame_bottom(frame: Image.Image, accent: Image.Image) -> Image.Image:
    target = dominant_vivid(accent)
    px = frame.load()
    w, h = frame.size
    out = frame.copy()
    opx = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            warm = r > 90 and r >= g and r > b + 15 and (r + g) > b * 2
            bright = (r + g + b) > 200 and abs(r - g) < 40
            low = y > int(h * 0.72)
            if low and (warm or (bright and r > 140)):
                lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255.0
                nr = int(target[0] * (0.35 + 0.65 * lum))
                ng = int(target[1] * (0.35 + 0.65 * lum))
                nb = int(target[2] * (0.35 + 0.65 * lum))
                t = 0.85 if warm else 0.55
                opx[x, y] = (
                    int(r * (1 - t) + nr * t),
                    int(g * (1 - t) + ng * t),
                    int(b * (1 - t) + nb * t),
                    a,
                )
    piece = accent.convert("RGBA")
    target_h = max(28, int(h * 0.22))
    scale = target_h / piece.height
    piece = piece.resize((max(1, int(piece.width * scale)), target_h), Image.Resampling.LANCZOS)
    out.alpha_composite(piece, (w - piece.width - 4, h - piece.height - 2))
    return out


def black_to_alpha_glow(glow: Image.Image, thresh: int = 12) -> Image.Image:
    g = glow.convert("RGBA")
    px = g.load()
    for y in range(g.height):
        for x in range(g.width):
            r, gv, b, a = px[x, y]
            lum = (r + gv + b) // 3
            if lum < thresh:
                px[x, y] = (0, 0, 0, 0)
            else:
                na = max(a if a < 255 else 0, min(255, int(lum * 1.4)))
                if a == 255 and lum >= thresh:
                    na = min(255, int(lum * 1.35))
                px[x, y] = (r, gv, b, na)
    return g


def boost_rgba_glow(glow: Image.Image, factor: float = 1.65) -> Image.Image:
    g = glow.convert("RGBA")
    px = g.load()
    for y in range(g.height):
        for x in range(g.width):
            r, gv, b, a = px[x, y]
            if a > 0 and (r + gv + b) > 30:
                px[x, y] = (r, gv, b, min(255, int(a * factor)))
    return g


def closeup_portrait(
    por: Image.Image,
    tw: int,
    th: int,
    *,
    ur: bool = False,
    contain: bool = True,
    is_new: bool = False,
) -> Image.Image:
    """Match /collections Regular list-thumb: contain (not cover), ~94% of plate."""
    por = por.convert("RGBA")
    # letterbox into tw×th at ~94% like .list-thumb-portrait
    mw, mh = int(tw * 0.94), int(th * 0.94)
    if contain:
        scale = min(mw / por.width, mh / por.height)
        nw, nh = max(1, int(por.width * scale)), max(1, int(por.height * scale))
        fitted = por.resize((nw, nh), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
        ox = (tw - nw) // 2
        oy = (th - nh) // 2
        if is_new:
            ox = max(4, int(tw * 0.08))
        canvas.alpha_composite(fitted, (ox, oy))
        return canvas
    cx, cy = (0.30, 0.28 if ur else 0.22) if is_new else (0.50, 0.22 if ur else 0.14)
    # Stronger face zoom (matches live mock crop)
    scale = 1.42 if ur else 1.32
    tw2, th2 = int(tw * scale), int(th * scale)
    fitted = ImageOps.fit(por, (tw2, th2), method=Image.Resampling.LANCZOS, centering=(cx, cy))
    # center-crop back to target
    l = (fitted.width - tw) // 2
    t = (fitted.height - th) // 2
    return fitted.crop((l, t, l + tw, t + th))


def center(canvas: Image.Image, layer: Image.Image, dy: int = 0) -> None:
    x = (canvas.width - layer.width) // 2
    y = (canvas.height - layer.height) // 2 + dy
    canvas.alpha_composite(layer, (x, y))


def place_base_and_frame(canvas: Image.Image, base: Image.Image, frame: Image.Image) -> None:
    """PSD New ProjectCard: frame is the plate; base at (−3,−16) behind it."""
    fr = frame.resize((FW, FH), Image.Resampling.LANCZOS)
    bs = base.resize((BW, BH), Image.Resampling.LANCZOS)
    fx = (canvas.width - FW) // 2
    fy = (canvas.height - FH) // 2
    canvas.alpha_composite(bs, (fx + BASE_DX, fy + BASE_DY))
    canvas.alpha_composite(fr, (fx, fy))


def frame_origin(canvas: Image.Image) -> tuple[int, int]:
    return (canvas.width - FW) // 2, (canvas.height - FH) // 2


def place_unit_stack(
    canvas: Image.Image,
    base: Image.Image,
    por: Image.Image,
    frame: Image.Image,
) -> None:
    """New Project(2).psd: Layer 5 base at (−3,−16), Layer 6 frame = plate."""
    fx, fy = frame_origin(canvas)
    bs = base.resize((BW, BH), Image.Resampling.LANCZOS)
    fr = frame.resize((FW, FH), Image.Resampling.LANCZOS)
    canvas.alpha_composite(bs, (fx + BASE_DX, fy + BASE_DY))
    canvas.alpha_composite(por, (fx + (FW - por.width) // 2, fy + (FH - por.height) // 2 - 4))
    canvas.alpha_composite(fr, (fx, fy))


def place_hud(
    canvas: Image.Image,
    rarity: str,
    role_img: Image.Image,
    acq: Image.Image | None,
    *,
    is_new: bool = False,
    is_supp: bool = False,
) -> None:
    """Match in-game: rarity + role top-left; acquisition bottom-left."""
    left = (CW - FW) // 2 + 10
    top = (CH - FH) // 2 + 8

    rar = load_ui(f"UI_Common_RarityIcon_{rarity.upper()}")
    rar_sz = 42
    rar = rar.resize((rar_sz, rar_sz), Image.Resampling.LANCZOS)
    canvas.alpha_composite(rar, (left, top))

    role_sz = 30
    role = role_img.resize((role_sz, role_sz), Image.Resampling.LANCZOS)
    # Clear gap under rarity — no overlap with tier badge
    canvas.alpha_composite(role, (left + 6, top + rar_sz + 10))

    if acq is not None:
        acq_sz = 24
        acq = acq.resize((acq_sz, acq_sz), Image.Resampling.LANCZOS)
        bottom = (CH + FH) // 2 - acq_sz - 10
        canvas.alpha_composite(acq, (left + 8, bottom))

    if is_new:
        tag = Image.new("RGBA", (52, 20), (0, 0, 0, 0))
        d = ImageDraw.Draw(tag)
        d.polygon([(0, 0), (52, 0), (52, 14), (44, 20), (0, 20)], fill=(255, 200, 40, 235))
        try:
            font = ImageFont.truetype("arialbd.ttf", 12)
        except OSError:
            font = ImageFont.load_default()
        d.text((8, 2), "New", fill=(200, 30, 40, 255), font=font)
        canvas.alpha_composite(tag, (CW - (CW - FW) // 2 - 60, (CH - FH) // 2 + 6))
        # Related character — RecommendCharacterId list-thum (/c) at right
        try:
            char_por = Image.open(POR_CHAR).convert("RGBA")
            thumb = 64
            base = load_ui("UI_Common_Tmb_Square_UR_Base").resize((thumb, thumb), Image.Resampling.LANCZOS)
            fr = load_ui("UI_Common_Tmb_Square_UR_Frame").resize((thumb, thumb), Image.Resampling.LANCZOS)
            face = ImageOps.fit(char_por, (int(thumb * 0.78), int(thumb * 0.78)), centering=(0.5, 0.12))
            plate = Image.new("RGBA", (thumb, thumb), (0, 0, 0, 0))
            plate.alpha_composite(base)
            plate.alpha_composite(face, ((thumb - face.width) // 2, (thumb - face.height) // 2 - 2))
            plate.alpha_composite(fr)
            px = CW - (CW - FW) // 2 - thumb - 14
            py = (CH + FH) // 2 - thumb - 18
            canvas.alpha_composite(plate, (px, py))
            d2 = ImageDraw.Draw(canvas)
            try:
                f2 = ImageFont.truetype("arialbd.ttf", 11)
            except OSError:
                f2 = ImageFont.load_default()
            d2.text((px + 10, py + thumb + 2), "Level 1", fill=(255, 255, 255, 230), font=f2)
        except OSError:
            pass

    if is_supp:
        pass  # Supporters label only on live pull cards (kind===supp), not baked into plate


def assemble_unit(
    rarity: str,
    por: Image.Image,
    role_img: Image.Image,
    *,
    is_new: bool = False,
) -> Image.Image:
    c = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    por_soft = closeup_portrait(por, 410, 200, ur=(rarity == "ur"), is_new=is_new)
    acq = load_ui("UI_Common_Icon_Source_Gasha")

    if rarity == "r":
        place_unit_stack(c, load("UI_Gasha_Card_R_Base"), por_soft, load("UI_Gasha_Card_R_Frame"))
    elif rarity == "sr":
        # SR = R stack recolored (same geometry as good R)
        fr_path = os.path.join(OUT, "layer_SR_Frame.webp")
        bs_path = os.path.join(OUT, "layer_SR_Base.webp")
        fr = Image.open(fr_path).convert("RGBA") if os.path.isfile(fr_path) else recolor_frame_bottom(
            load("UI_Gasha_Card_R_Frame"), load("UI_Gasha_Card_SR_Frame")
        )
        bs = Image.open(bs_path).convert("RGBA") if os.path.isfile(bs_path) else build_sr_base()
        place_unit_stack(c, bs, por_soft, fr)
    elif rarity == "ssr":
        fx0, fy0 = frame_origin(c)
        fx = Image.open(os.path.join(OUT, "fx_unit_SSR_glow.webp")).convert("RGBA")
        c.alpha_composite(fx, (fx0 - 23, fy0 - 36))
        # New Project(2).psd Layer 5 base + Layer 6 frame
        base_path = os.path.join(OUT, "psd_unit_base.webp")
        fr_path = os.path.join(OUT, "psd_unit_frame.webp")
        bs = Image.open(base_path).convert("RGBA") if os.path.isfile(base_path) else load("UI_Gasha_Card_SSR_Base")
        fr = Image.open(fr_path).convert("RGBA") if os.path.isfile(fr_path) else load("UI_Gasha_Card_SSR_Frame")
        place_unit_stack(c, bs, por_soft, fr)
    elif rarity == "ur":
        fx0, fy0 = frame_origin(c)
        glow = Image.open(os.path.join(OUT, "fx_unit_UR_glow.webp")).convert("RGBA")
        c.alpha_composite(glow, (fx0 - 133, fy0 - 101))
        # New Project(3).psd Layer 2 glow + L8/L7/L1 base + rim frame
        bs_path = os.path.join(OUT, "layer_UR_Base.webp")
        fr_path = os.path.join(OUT, "layer_UR_Frame.webp")
        bs = Image.open(bs_path).convert("RGBA") if os.path.isfile(bs_path) else build_ur_base()
        fr = Image.open(fr_path).convert("RGBA") if os.path.isfile(fr_path) else recolor_frame_bottom(
            load("UI_Gasha_Card_SSR_Frame"), load("UI_Gasha_Card_UR_Frame")
        )
        place_unit_stack(c, bs, por_soft, fr)
    else:
        raise ValueError(rarity)

    place_hud(c, rarity, role_img, acq, is_new=is_new, is_supp=False)
    return c


def assemble_supp(rarity: str, por: Image.Image) -> Image.Image:
    """Match owner PSD exactly (354×190), layer order bottom→top.

    UR  (image.psd.psd):     Base → sb → L1–4 frames → Layer5 Gain → rarity
    SSR (image.psdssr.psd):  Base → sb → L7–10 frames → Layer11 Gain → L12 rarity
    Never flip CDN Frame_01/02; never stack Frame_*_Effect.
    """
    pad = 20
    c = Image.new("RGBA", (SUPP_W + pad * 2, SUPP_H + pad * 2), (0, 0, 0, 0))
    plate = Image.new("RGBA", (SUPP_W, SUPP_H), (0, 0, 0, 0))

    if rarity == "ur":
        plate.alpha_composite(Image.open(os.path.join(OUT, "psd_UR_Base.webp")).convert("RGBA"))
    else:
        plate.alpha_composite(Image.open(os.path.join(OUT, "psd_SSR_Base.webp")).convert("RGBA"))

    px, py, pw, ph = SUPP_POR
    fitted = ImageOps.fit(por.convert("RGBA"), (pw, ph), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))
    plate.alpha_composite(fitted, (px, py))

    if rarity == "ur":
        fr_l = Image.open(os.path.join(OUT, "psd_UR_Frame_L.webp")).convert("RGBA")
        fr_r = Image.open(os.path.join(OUT, "psd_UR_Frame_R.webp")).convert("RGBA")
        fr_t = Image.open(os.path.join(OUT, "psd_UR_Frame_T.webp")).convert("RGBA")
        fr_b = Image.open(os.path.join(OUT, "psd_UR_Frame_B.webp")).convert("RGBA")
        plate.alpha_composite(fr_l, (6, 0))
        plate.alpha_composite(fr_r, (297, 3))
        plate.alpha_composite(fr_t, (119, 0))
        plate.alpha_composite(fr_b, (121, 148))
        fx = Image.open(os.path.join(OUT, "fx_SUPP_UR_Gain.webp")).convert("RGBA")
        rar_pos, rar_sz = (23, 19), (61, 63)
    else:
        fr_l = Image.open(os.path.join(OUT, "psd_SSR_Frame_L.webp")).convert("RGBA")
        fr_r = Image.open(os.path.join(OUT, "psd_SSR_Frame_R.webp")).convert("RGBA")
        fr_t = Image.open(os.path.join(OUT, "psd_SSR_Frame_T.webp")).convert("RGBA")
        fr_b = Image.open(os.path.join(OUT, "psd_SSR_Frame_B.webp")).convert("RGBA")
        plate.alpha_composite(fr_l, (15, 19))
        plate.alpha_composite(fr_r, (308, 21))
        plate.alpha_composite(fr_t, (108, 11))
        plate.alpha_composite(fr_b, (114, 157))
        fx = Image.open(os.path.join(OUT, "fx_SUPP_SSR_Gain.webp")).convert("RGBA")
        rar_pos, rar_sz = (28, 27), (56, 54)

    c.alpha_composite(plate, (pad, pad))
    c.alpha_composite(fx, (pad - 12, pad - 12))

    rar = load_ui(f"UI_Common_RarityIcon_{rarity.upper()}").resize(rar_sz, Image.Resampling.LANCZOS)
    c.alpha_composite(rar, (pad + rar_pos[0], pad + rar_pos[1]))
    return c


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    por = Image.open(POR_UNIT).convert("RGBA")
    spor = Image.open(POR_SUPP).convert("RGBA") if os.path.isfile(POR_SUPP) else por

    melee = load_ui("UI_Common_TypeIcon_Attack_M")
    ranged = load_ui("UI_Common_TypeIcon_Support_M")
    defense = load_ui("UI_Common_TypeIcon_Defense_M")

    pairs = [
        ("r", melee, False),
        ("sr", ranged, False),
        ("ssr", defense, False),
        ("ur", melee, True),
    ]
    for rarity, role, is_new in pairs:
        c = assemble_unit(rarity, por, role, is_new=is_new)
        c.save(os.path.join(OUT, f"assemble_{rarity.upper()}.png"))
        c.save(os.path.join(OUT, f"assemble_{rarity.upper()}.webp"), "WEBP", quality=92)

    # Persist reusable SR/UR plates for CSS live stack
    build_sr_base().save(os.path.join(OUT, "layer_SR_Base.webp"), "WEBP", quality=92)
    recolor_frame_bottom(load("UI_Gasha_Card_R_Frame"), load("UI_Gasha_Card_SR_Frame")).resize(
        (FW, FH), Image.Resampling.LANCZOS
    ).save(os.path.join(OUT, "layer_SR_Frame.webp"), "WEBP", quality=92)
    build_ur_base().save(os.path.join(OUT, "layer_UR_Base.webp"), "WEBP", quality=92)
    recolor_frame_bottom(load("UI_Gasha_Card_SSR_Frame"), load("UI_Gasha_Card_UR_Frame")).resize(
        (FW, FH), Image.Resampling.LANCZOS
    ).save(os.path.join(OUT, "layer_UR_Frame.webp"), "WEBP", quality=92)

    for rarity in ("ssr", "ur"):
        c = assemble_supp(rarity, spor)
        c.save(os.path.join(OUT, f"assemble_SUPP_{rarity.upper()}.png"))
        c.save(os.path.join(OUT, f"assemble_SUPP_{rarity.upper()}.webp"), "WEBP", quality=92)
        # Gain assets stay as exact PSD exports — do not overwrite

    print("wrote", OUT)
    if os.path.isdir(REFS):
        n = len([f for f in os.listdir(REFS) if f.lower().endswith((".jpg", ".png", ".webp"))])
        print("refs available:", n)


if __name__ == "__main__":
    main()
