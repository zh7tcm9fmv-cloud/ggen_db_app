from pathlib import Path

p = Path('static/js/app.js')
text = p.read_text(encoding='utf-8')
marker = 'ubpMetricCritBtn'
idx = text.find(marker)
if idx < 0:
    raise SystemExit('crit btn not found')
# Replace only the first UI_Tention_Up_01.webp after the crit button marker
window = text[idx:idx + 600]
old = 'UI_Tention_Up_01.webp'
new = 'UI_Battle_MapUI_Label_Critical.webp'
pos = window.find(old)
if pos < 0:
    if new in window:
        print('already swapped')
    else:
        raise SystemExit('icon not found near crit btn')
else:
    abs_pos = idx + pos
    text = text[:abs_pos] + new + text[abs_pos + len(old):]
    p.write_text(text, encoding='utf-8')
    print('swapped at', abs_pos)

# cleanup verify
text2 = p.read_text(encoding='utf-8')
i = text2.find(marker)
print(text2[i:i + 320])
