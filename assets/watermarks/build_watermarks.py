# -*- coding: utf-8 -*-
"""Build GGen Eternal Database share watermarks (PNG + layered PSD)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from psd_tools import PSDImage

OUT = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\assets\watermarks")
LOGO = OUT / "IMG_Common_Logo_ETERNALBASE.webp"
TEKO = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\static\font\Teko-Bold.ttf")
SEGOE = Path(r"C:\Windows\Fonts\segoeuib.ttf")
SEGOE_R = Path(r"C:\Windows\Fonts\segoeui.ttf")

SITE_URL = "ggendb.up.railway.app"
TITLE = "GGEN ETERNAL DATABASE"
SUB = "SD Gundam G Generation"

CYAN = (0, 212, 255, 255)
CYAN_DIM = (0, 180, 220, 230)
WHITE = (255, 255, 255, 255)
WHITE_SOFT = (230, 240, 250, 240)


def font(path, size):
    return ImageFont.truetype(str(path), size)


def rounded_rect(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def make_badge(scale=2, opacity=0.92):
    """Horizontal corner badge: logo + title + URL on dark plate."""
    pad = 28 * scale
    logo_sz = 120 * scale
    logo = Image.open(LOGO).convert("RGBA").resize((logo_sz, logo_sz), Image.Resampling.LANCZOS)

    f_title = font(TEKO if TEKO.exists() else SEGOE, 52 * scale)
    f_url = font(SEGOE_R if SEGOE_R.exists() else SEGOE, 22 * scale)
    f_sub = font(SEGOE_R if SEGOE_R.exists() else SEGOE, 16 * scale)

    # measure text
    tmp = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(tmp)
    tw = max(d.textlength(TITLE, font=f_title), d.textlength(SITE_URL, font=f_url), d.textlength(SUB, font=f_sub))
    text_block_h = int(52 * scale + 8 * scale + 16 * scale + 10 * scale + 22 * scale)

    w = int(pad + logo_sz + 20 * scale + tw + pad)
    h = int(pad + max(logo_sz, text_block_h) + pad)

    # layers for PSD
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    plate = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    # dark plate ~70% black + thin cyan edge
    rounded_rect(pd, (0, 0, w - 1, h - 1), radius=18 * scale, fill=(8, 14, 24, int(180 * opacity)))
    # cyan border
    pd.rounded_rectangle((1, 1, w - 2, h - 2), radius=18 * scale, outline=(0, 212, 255, int(160 * opacity)), width=max(2, 2 * scale))

    logo_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ly = (h - logo_sz) // 2
    logo_layer.paste(logo, (pad, ly), logo)

    text_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)
    tx = pad + logo_sz + 20 * scale
    # vertically center text block
    ty0 = (h - text_block_h) // 2
    td.text((tx, ty0 - 4 * scale), TITLE, font=f_title, fill=WHITE)
    td.text((tx, ty0 + 48 * scale), SUB, font=f_sub, fill=CYAN_DIM)
    td.text((tx, ty0 + 48 * scale + 20 * scale), SITE_URL, font=f_url, fill=CYAN)

    # soften overall slightly for "watermark" feel variants later
    composed = Image.alpha_composite(Image.alpha_composite(plate, logo_layer), text_layer)
    return {
        "composed": composed,
        "plate": plate,
        "logo": logo_layer,
        "text": text_layer,
        "size": (w, h),
    }


def make_stamp(scale=2, opacity=0.85):
    """Compact circular-ish stamp: logo over URL (minimal)."""
    pad = 16 * scale
    logo_sz = 96 * scale
    logo = Image.open(LOGO).convert("RGBA").resize((logo_sz, logo_sz), Image.Resampling.LANCZOS)
    f_url = font(SEGOE_R, 18 * scale)
    f_mark = font(TEKO if TEKO.exists() else SEGOE, 28 * scale)

    tmp = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(tmp)
    url_w = d.textlength(SITE_URL, font=f_url)
    title_w = d.textlength("GGEN DB", font=f_mark)
    content_w = max(logo_sz, url_w, title_w)
    w = int(pad * 2 + content_w)
    h = int(pad + logo_sz + 8 * scale + 28 * scale + 6 * scale + 18 * scale + pad)

    plate = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    rounded_rect(pd, (0, 0, w - 1, h - 1), radius=16 * scale, fill=(8, 14, 24, int(170 * opacity)))
    pd.rounded_rectangle((1, 1, w - 2, h - 2), radius=16 * scale, outline=(0, 212, 255, int(140 * opacity)), width=max(2, 2 * scale))

    logo_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    lx = (w - logo_sz) // 2
    logo_layer.paste(logo, (lx, pad), logo)

    text_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(text_layer)
    ty = pad + logo_sz + 6 * scale
    tw = d.textlength("GGEN DB", font=f_mark)
    td.text(((w - tw) / 2, ty), "GGEN DB", font=f_mark, fill=WHITE)
    uw = d.textlength(SITE_URL, font=f_url)
    td.text(((w - uw) / 2, ty + 30 * scale), SITE_URL, font=f_url, fill=CYAN)

    composed = Image.alpha_composite(Image.alpha_composite(plate, logo_layer), text_layer)
    return {
        "composed": composed,
        "plate": plate,
        "logo": logo_layer,
        "text": text_layer,
        "size": (w, h),
    }


def apply_opacity(im, factor):
    if factor >= 0.999:
        return im
    r, g, b, a = im.split()
    a = a.point(lambda p: int(p * factor))
    return Image.merge("RGBA", (r, g, b, a))


def save_psd_layers(path, size, layers):
    """Create layered PSD via psd-tools."""
    psd = PSDImage.new(mode="RGBA", size=size, color=0)
    # add from bottom to top
    for name, im in layers:
        # ensure exact size
        if im.size != size:
            canvas = Image.new("RGBA", size, (0, 0, 0, 0))
            canvas.paste(im, (0, 0), im)
            im = canvas
        psd.create_pixel_layer(im, name=name, opacity=255)
    psd.save(str(path))
    print("saved PSD", path, "size", size)


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    badge = make_badge(scale=2)
    stamp = make_stamp(scale=2)

    # Full opacity paste-ready
    badge["composed"].save(OUT / "ggendb_watermark_badge.png", "PNG")
    stamp["composed"].save(OUT / "ggendb_watermark_stamp.png", "PNG")

    # Softer watermark variants (~55%)
    apply_opacity(badge["composed"], 0.55).save(OUT / "ggendb_watermark_badge_soft.png", "PNG")
    apply_opacity(stamp["composed"], 0.55).save(OUT / "ggendb_watermark_stamp_soft.png", "PNG")

    # Layered PSDs (editable in Photoshop)
    save_psd_layers(
        OUT / "ggendb_watermark_badge.psd",
        badge["size"],
        [
            ("Plate", badge["plate"]),
            ("Logo", badge["logo"]),
            ("Text", badge["text"]),
        ],
    )
    save_psd_layers(
        OUT / "ggendb_watermark_stamp.psd",
        stamp["size"],
        [
            ("Plate", stamp["plate"]),
            ("Logo", stamp["logo"]),
            ("Text", stamp["text"]),
        ],
    )

    # Also a wide "footer bar" for video/screenshot bottoms
    scale = 2
    bar_h = 72 * scale
    bar_w = 1200 * scale
    logo_sz = 56 * scale
    logo = Image.open(LOGO).convert("RGBA").resize((logo_sz, logo_sz), Image.Resampling.LANCZOS)
    f_title = font(TEKO if TEKO.exists() else SEGOE, 36 * scale)
    f_url = font(SEGOE_R, 20 * scale)

    plate = Image.new("RGBA", (bar_w, bar_h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.rectangle((0, 0, bar_w, bar_h), fill=(6, 10, 18, 170))
    # top cyan hairline
    pd.rectangle((0, 0, bar_w, max(2, 2 * scale)), fill=(0, 212, 255, 200))

    logo_l = Image.new("RGBA", (bar_w, bar_h), (0, 0, 0, 0))
    logo_l.paste(logo, (24 * scale, (bar_h - logo_sz) // 2), logo)

    text_l = Image.new("RGBA", (bar_w, bar_h), (0, 0, 0, 0))
    td = ImageDraw.Draw(text_l)
    tx = 24 * scale + logo_sz + 16 * scale
    td.text((tx, 8 * scale), TITLE, font=f_title, fill=WHITE)
    td.text((tx, 42 * scale), SITE_URL, font=f_url, fill=CYAN)
    # right-side anchor
    rw = td.textlength("SOURCE", font=f_url)
    td.text((bar_w - 24 * scale - rw, (bar_h - 20 * scale) // 2), "SOURCE", font=f_url, fill=CYAN_DIM)

    bar = Image.alpha_composite(Image.alpha_composite(plate, logo_l), text_l)
    bar.save(OUT / "ggendb_watermark_footer.png", "PNG")
    save_psd_layers(
        OUT / "ggendb_watermark_footer.psd",
        (bar_w, bar_h),
        [("Plate", plate), ("Logo", logo_l), ("Text", text_l)],
    )

    for p in sorted(OUT.glob("ggendb_watermark*")):
        print(f"{p.name:40s} {p.stat().st_size:8d}")


if __name__ == "__main__":
    main()
