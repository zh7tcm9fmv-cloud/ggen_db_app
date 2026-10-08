# -*- coding: utf-8 -*-
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps, ImageFont
from psd_tools import PSDImage

OUT = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\assets\watermarks")
DESK = Path(r"C:\Users\Mikew0911\Desktop\GGENDB_Watermarks")
LOGO = OUT / "IMG_Common_Logo_ETERNALBASE.webp"
TEKO = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app\static\font\Teko-Bold.ttf")
SEGOE = Path(r"C:\Windows\Fonts\segoeuib.ttf")
SEGOE_R = Path(r"C:\Windows\Fonts\segoeui.ttf")
SITE_URL = "ggendb.up.railway.app"
TITLE = "GGEN ETERNAL DATABASE"
SUB = "SD Gundam G Generation"
CYAN = (0, 212, 255, 255)
CYAN_DIM = (120, 210, 240, 230)
WHITE = (255, 255, 255, 255)


def font(path, size):
    return ImageFont.truetype(str(path), size)


def prep_logo(size):
    """Make logo pop on dark plates: soft light disc + brightened emblem."""
    raw = Image.open(LOGO).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    # brighten non-transparent pixels
    r, g, b, a = raw.split()
    rgb = Image.merge("RGB", (r, g, b))
    rgb = ImageEnhance.Brightness(rgb).enhance(1.35)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.25)
    raw = Image.merge("RGBA", (*rgb.split(), a))

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    # soft cyan-tinted disc behind so dark logo ink still reads
    disc = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    dd = ImageDraw.Draw(disc)
    m = int(size * 0.04)
    dd.ellipse((m, m, size - m, size - m), fill=(18, 36, 52, 230))
    dd.ellipse((m, m, size - m, size - m), outline=(0, 212, 255, 120), width=max(2, size // 64))
    out = Image.alpha_composite(out, disc)
    out = Image.alpha_composite(out, raw)
    return out


def save_psd(path, size, layers):
    psd = PSDImage.new(mode="RGBA", size=size, color=0)
    for name, im in layers:
        if im.size != size:
            c = Image.new("RGBA", size, (0, 0, 0, 0))
            c.paste(im, (0, 0), im)
            im = c
        psd.create_pixel_layer(im, name=name, opacity=255)
    psd.save(str(path))


def opacity(im, f):
    r, g, b, a = im.split()
    return Image.merge("RGBA", (r, g, b, a.point(lambda p: int(p * f))))


def badge(scale=2):
    pad = 28 * scale
    logo_sz = 120 * scale
    logo = prep_logo(logo_sz)
    f_title = font(TEKO if TEKO.exists() else SEGOE, 52 * scale)
    f_url = font(SEGOE_R, 22 * scale)
    f_sub = font(SEGOE_R, 16 * scale)
    tmp = Image.new("RGBA", (8, 8))
    d = ImageDraw.Draw(tmp)
    tw = max(d.textlength(TITLE, font=f_title), d.textlength(SITE_URL, font=f_url), d.textlength(SUB, font=f_sub))
    text_h = int(52 * scale + 8 * scale + 16 * scale + 10 * scale + 22 * scale)
    w = int(pad + logo_sz + 20 * scale + tw + pad)
    h = int(pad + max(logo_sz, text_h) + pad)

    plate = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.rounded_rectangle((0, 0, w - 1, h - 1), radius=18 * scale, fill=(8, 14, 24, 200))
    pd.rounded_rectangle((1, 1, w - 2, h - 2), radius=18 * scale, outline=(0, 212, 255, 180), width=max(2, 2 * scale))

    logo_l = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    logo_l.paste(logo, (pad, (h - logo_sz) // 2), logo)

    text_l = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(text_l)
    tx = pad + logo_sz + 20 * scale
    ty0 = (h - text_h) // 2
    td.text((tx, ty0 - 4 * scale), TITLE, font=f_title, fill=WHITE)
    td.text((tx, ty0 + 48 * scale), SUB, font=f_sub, fill=CYAN_DIM)
    td.text((tx, ty0 + 48 * scale + 20 * scale), SITE_URL, font=f_url, fill=CYAN)
    composed = Image.alpha_composite(Image.alpha_composite(plate, logo_l), text_l)
    return composed, plate, logo_l, text_l, (w, h)


def stamp(scale=2):
    pad = 16 * scale
    logo_sz = 110 * scale
    logo = prep_logo(logo_sz)
    f_url = font(SEGOE_R, 18 * scale)
    f_mark = font(TEKO if TEKO.exists() else SEGOE, 30 * scale)
    tmp = Image.new("RGBA", (8, 8))
    d = ImageDraw.Draw(tmp)
    content_w = max(logo_sz, d.textlength(SITE_URL, font=f_url), d.textlength("GGEN DB", font=f_mark))
    w = int(pad * 2 + content_w)
    h = int(pad + logo_sz + 8 * scale + 30 * scale + 6 * scale + 18 * scale + pad)
    plate = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.rounded_rectangle((0, 0, w - 1, h - 1), radius=16 * scale, fill=(8, 14, 24, 200))
    pd.rounded_rectangle((1, 1, w - 2, h - 2), radius=16 * scale, outline=(0, 212, 255, 160), width=max(2, 2 * scale))
    logo_l = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    logo_l.paste(logo, ((w - logo_sz) // 2, pad), logo)
    text_l = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(text_l)
    ty = pad + logo_sz + 6 * scale
    tw = d.textlength("GGEN DB", font=f_mark)
    td.text(((w - tw) / 2, ty), "GGEN DB", font=f_mark, fill=WHITE)
    uw = d.textlength(SITE_URL, font=f_url)
    td.text(((w - uw) / 2, ty + 32 * scale), SITE_URL, font=f_url, fill=CYAN)
    composed = Image.alpha_composite(Image.alpha_composite(plate, logo_l), text_l)
    return composed, plate, logo_l, text_l, (w, h)


def footer(scale=2):
    bar_h, bar_w = 72 * scale, 1200 * scale
    logo_sz = 56 * scale
    logo = prep_logo(logo_sz)
    f_title = font(TEKO if TEKO.exists() else SEGOE, 36 * scale)
    f_url = font(SEGOE_R, 20 * scale)
    plate = Image.new("RGBA", (bar_w, bar_h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(plate)
    pd.rectangle((0, 0, bar_w, bar_h), fill=(6, 10, 18, 190))
    pd.rectangle((0, 0, bar_w, max(2, 2 * scale)), fill=(0, 212, 255, 210))
    logo_l = Image.new("RGBA", (bar_w, bar_h), (0, 0, 0, 0))
    logo_l.paste(logo, (24 * scale, (bar_h - logo_sz) // 2), logo)
    text_l = Image.new("RGBA", (bar_w, bar_h), (0, 0, 0, 0))
    td = ImageDraw.Draw(text_l)
    tx = 24 * scale + logo_sz + 16 * scale
    td.text((tx, 8 * scale), TITLE, font=f_title, fill=WHITE)
    td.text((tx, 42 * scale), SITE_URL, font=f_url, fill=CYAN)
    composed = Image.alpha_composite(Image.alpha_composite(plate, logo_l), text_l)
    return composed, plate, logo_l, text_l, (bar_w, bar_h)


for name, maker in (("badge", badge), ("stamp", stamp), ("footer", footer)):
    composed, plate, logo_l, text_l, size = maker()
    composed.save(OUT / f"ggendb_watermark_{name}.png")
    if name != "footer":
        opacity(composed, 0.55).save(OUT / f"ggendb_watermark_{name}_soft.png")
    save_psd(OUT / f"ggendb_watermark_{name}.psd", size, [("Plate", plate), ("Logo", logo_l), ("Text", text_l)])
    print("ok", name, size)

# sync desktop pack
DESK.mkdir(exist_ok=True)
for p in OUT.glob("ggendb_watermark_*"):
    dest = DESK / p.name
    dest.write_bytes(p.read_bytes())
print("synced", DESK)
