"""NORMAL label with per-letter blue stroke (not a bounding box)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import shutil

cdn_ui = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_images\images\UI')
app_ui = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\images\UI')
W, H = 157, 38

font_path = r'C:\Windows\Fonts\ariblk.ttf'
if not Path(font_path).exists():
    font_path = r'C:\Windows\Fonts\impact.ttf'

text = 'NORMAL'
font_size = 24
font = ImageFont.truetype(font_path, font_size)
tracking = 1

def layout(fnt, track):
    d = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    widths = []
    for ch in text:
        b = d.textbbox((0, 0), ch, font=fnt)
        widths.append(b[2] - b[0])
    total = sum(widths) + track * (len(text) - 1)
    return widths, total

widths, tw = layout(font, tracking)
while tw > W - 12 and font_size > 14:
    font_size -= 1
    font = ImageFont.truetype(font_path, font_size)
    widths, tw = layout(font, tracking)

sample = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textbbox((0, 0), 'N', font=font)
oy = (H - (sample[3] - sample[1])) // 2 - sample[1]
start_x = (W - tw) // 2

FILL = (255, 242, 238, 255)
OUTLINE = (16, 72, 200, 255)
GLOW = (55, 145, 255, 140)
STROKE = 3  # outline radius in px

# Draw outline by offset stamps, then fill on top
out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
# Glow layer
glow_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow_layer)
x = start_x
for i, ch in enumerate(text):
    b = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textbbox((0, 0), ch, font=font)
    for dx in range(-STROKE - 2, STROKE + 3):
        for dy in range(-STROKE - 2, STROKE + 3):
            if dx * dx + dy * dy <= (STROKE + 2) ** 2:
                gd.text((x - b[0] + dx, oy + dy), ch, font=font, fill=GLOW)
    x += widths[i] + tracking
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(1.6))

# Outline layer
outline_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(outline_layer)
x = start_x
for i, ch in enumerate(text):
    b = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textbbox((0, 0), ch, font=font)
    for dx in range(-STROKE, STROKE + 1):
        for dy in range(-STROKE, STROKE + 1):
            if dx * dx + dy * dy <= STROKE * STROKE + 1:
                od.text((x - b[0] + dx, oy + dy), ch, font=font, fill=OUTLINE)
    x += widths[i] + tracking

# Fill layer
fill_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
fd = ImageDraw.Draw(fill_layer)
x = start_x
for i, ch in enumerate(text):
    b = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textbbox((0, 0), ch, font=font)
    fd.text((x - b[0], oy), ch, font=font, fill=FILL)
    x += widths[i] + tracking

out = Image.alpha_composite(out, glow_layer)
out = Image.alpha_composite(out, outline_layer)
out = Image.alpha_composite(out, fill_layer)

out_png = cdn_ui / 'UI_Battle_MapUI_Label_Normal.png'
out_webp = cdn_ui / 'UI_Battle_MapUI_Label_Normal.webp'
out.save(out_png)
out.save(out_webp, 'WEBP', quality=92)
shutil.copy2(out_png, app_ui / out_png.name)
shutil.copy2(out_webp, app_ui / out_webp.name)
print('ok', font_size, tw, out_png.stat().st_size)
