"""Refine NORMAL label to better match Critical letter spacing / stroke weight."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import shutil

cdn_ui = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_images\images\UI')
app_ui = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\images\UI')

crit = Image.open(cdn_ui / 'UI_Battle_MapUI_Label_Critical.png').convert('RGBA')
W, H = crit.size

# Use Arial Black / Impact for heavy game look; expand tracking by drawing letter-by-letter
font_path = None
for p in [
    r'C:\Windows\Fonts\ariblk.ttf',
    r'C:\Windows\Fonts\impact.ttf',
    r'C:\Windows\Fonts\arialbd.ttf',
]:
    if Path(p).exists():
        font_path = p
        break

text = 'NORMAL'
font_size = 26
font = ImageFont.truetype(font_path, font_size)

# Measure with tracking
tracking = 2  # px between letters
def text_size(fnt, tracking_px):
    d = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    total_w = 0
    heights = []
    for i, ch in enumerate(text):
        bbox = d.textbbox((0, 0), ch, font=fnt)
        total_w += (bbox[2] - bbox[0])
        if i < len(text) - 1:
            total_w += tracking_px
        heights.append(bbox[3] - bbox[1])
    return total_w, max(heights) if heights else 0

tw, th = text_size(font, tracking)
while tw > W - 8 and font_size > 14:
    font_size -= 1
    font = ImageFont.truetype(font_path, font_size)
    tw, th = text_size(font, tracking)

print('font', font_path, font_size, tw, th)

mask = Image.new('L', (W, H), 0)
md = ImageDraw.Draw(mask)
# vertical center using a sample glyph bbox
sample = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textbbox((0, 0), 'N', font=font)
glyph_h = sample[3] - sample[1]
oy = (H - glyph_h) // 2 - sample[1]
x = (W - tw) // 2
dprobe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
for i, ch in enumerate(text):
    bbox = dprobe.textbbox((0, 0), ch, font=font)
    md.text((x - bbox[0], oy), ch, font=font, fill=255)
    x += (bbox[2] - bbox[0]) + tracking

FILL = (255, 242, 238, 255)
OUTLINE = (18, 78, 210, 255)
GLOW = (50, 140, 255, 160)

glow_mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.4))
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
glow.paste(Image.new('RGBA', (W, H), GLOW), (0, 0), glow_mask)

outline_mask = mask.filter(ImageFilter.MaxFilter(9))
outline = Image.new('RGBA', (W, H), (0, 0, 0, 0))
outline.paste(Image.new('RGBA', (W, H), OUTLINE), (0, 0), outline_mask)

fill = Image.new('RGBA', (W, H), (0, 0, 0, 0))
fill.paste(Image.new('RGBA', (W, H), FILL), (0, 0), mask)

out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
out = Image.alpha_composite(out, glow)
out = Image.alpha_composite(out, outline)
out = Image.alpha_composite(out, fill)

out_png = cdn_ui / 'UI_Battle_MapUI_Label_Normal.png'
out_webp = cdn_ui / 'UI_Battle_MapUI_Label_Normal.webp'
out.save(out_png)
out.save(out_webp, 'WEBP', quality=92)
shutil.copy2(out_png, app_ui / out_png.name)
shutil.copy2(out_webp, app_ui / out_webp.name)
print('refined', out_png.stat().st_size)
