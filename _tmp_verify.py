from pathlib import Path
p = Path('static/js/app.js')
text = p.read_text(encoding='utf-8')
idx = text.find('data-ubp-metric="crit"')
print('crit idx', idx)
print(text[idx:idx+320] if idx >= 0 else 'missing')
print('has Label_Critical', 'UI_Battle_MapUI_Label_Critical.webp' in text)
print('has embed removed', 'best_synergy_pilots' not in Path('app.py').read_text(encoding='utf-8')[Path('app.py').read_text(encoding='utf-8').find('best_synergy_pilot_eligible'):Path('app.py').read_text(encoding='utf-8').find('best_synergy_pilot_eligible')+400] or 'embed' )
# simpler check
ap = Path('app.py').read_text(encoding='utf-8')
snip = ap[ap.find('best_synergy_pilot_eligible'):ap.find('best_synergy_pilot_eligible')+350]
print('app snip:', snip)
