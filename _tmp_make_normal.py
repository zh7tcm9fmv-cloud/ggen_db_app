"""Create UI_Battle_MapUI_Label_Normal matching Critical style with blue outline."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import shutil

cdn_ui = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_images\images\UI')
app_ui = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\images\UI')
app_ui.mkdir(parents=True, exist_ok=True)

crit = Image.open(cdn_ui / 'UI_Battle_MapUI_Label_Critical.png').convert('RGBA')
W, H = crit.size  # 157 x 38
print('template', W, H)

# Try fonts that look game-UI bold
font_candidates = [
    r'C:\Windows\Fonts\impact.ttf',
    r'C:\Windows\Fonts\arialbd.ttf',
    r'C:\Windows\Fonts\seguibl.ttf',
    r'C:\Windows\Fonts\bahnschrift.ttf',
    r'C:\Windows\Fonts\arial.ttf',
]
font_path = None
for p in font_candidates:
    if Path(p).exists():
        font_path = p
        break
print('font', font_path)

text = 'NORMAL'
# Fit text into ~157x38 with padding similar to CRITICAL
font_size = 28
font = ImageFont.truetype(font_path, font_size) if font_path else ImageFont.load_default()

def measure(fnt):
    tmp = Image.new('RGBA', (1, 1))
    d = ImageDraw.Draw(tmp)
    bbox = d.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

tw, th = measure(font)
while (tw > W - 10 or th > H - 6) and font_size > 12:
    font_size -= 1
    font = ImageFont.truetype(font_path, font_size)
    tw, th = measure(font)
print('font_size', font_size, 'text', tw, th)

# Layers: glow (blue), thick outline (deep blue), fill (pale cream/white)
FILL = (255, 245, 240, 255)       # pale pinkish-white like Critical
OUTLINE = (20, 70, 190, 255)      # deep blue outline
GLOW = (40, 120, 255, 180)        # blue glow

# Build mask of text
mask = Image.new('L', (W, H), 0)
md = ImageDraw.Draw(mask)
# Center text
bbox = ImageDraw.Draw(Image.new('RGBA', (1, 1))).textbbox((0, 0), text, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
# textbbox can have negative top; account for that
ox = (W - tw) // 2 - bbox[0]
oy = (H - th) // 2 - bbox[1]
md.text((ox, oy), text, font=font, fill=255)

# Glow: dilate mask then blur
glow_mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.2))
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
glow_col = Image.new('RGBA', (W, H), GLOW)
glow.paste(glow_col, (0, 0), glow_mask)

# Outline: thicker dilation of mask
outline_mask = mask.filter(ImageFilter.MaxFilter(7))
# subtract inner to leave ring? Actually Critical has filled outline around letters —
# draw outline by pasting solid outline under fill
outline = Image.new('RGBA', (W, H), (0, 0, 0, 0))
outline_col = Image.new('RGBA', (W, H), OUTLINE)
outline.paste(outline_col, (0, 0), outline_mask)

# Fill
fill = Image.new('RGBA', (W, H), (0, 0, 0, 0))
fill_col = Image.new('RGBA', (W, H), FILL)
fill.paste(fill_col, (0, 0), mask)

# Composite
out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
out = Image.alpha_composite(out, glow)
out = Image.alpha_composite(out, outline)
out = Image.alpha_composite(out, fill)

out_png = cdn_ui / 'UI_Battle_MapUI_Label_Normal.png'
out_webp = cdn_ui / 'UI_Battle_MapUI_Label_Normal.webp'
out.save(out_png)
out.save(out_webp, 'WEBP', quality=92)

# Copy all three labels into app static
for name in [
    'UI_Battle_MapUI_Label_Critical.png',
    'UI_Battle_MapUI_Label_Critical.webp',
    'UI_Battle_MapUI_Label_SuperCritical.png',
    'UI_Battle_MapUI_Label_SuperCritical.webp',
    'UI_Battle_MapUI_Label_Normal.png',
    'UI_Battle_MapUI_Label_Normal.webp',
]:
    s = cdn_ui / name
    d = app_ui / name
    if s.exists():
        shutil.copy2(s, d)
        print('copied', name)
    else:
        print('missing', name)

print('done', out_png.stat().st_size, out_webp.stat().st_size)
