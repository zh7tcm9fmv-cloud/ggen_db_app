from pathlib import Path
import re

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
t = (root / 'static/js/app.js').read_text(encoding='utf-8')
for k in ['msy_metric_super_crit', 'msy_metric_crit', 'unit_best_pilot_note']:
    m = re.search(re.escape(k) + r":'([^']*)'", t)
    print(k, '=>', m.group(1) if m else None)
print('ubp-metric-mark', 'ubp-metric-mark' in t)
print('25,072', '25,072' in t)
print('leftover Super Crit', len(re.findall(r'Super Crit(?!ical)', t)))
print('tmp leftovers', [p.name for p in root.glob('_tmp*')])
js = (root / 'static/js/unit_best_pilots.js').read_text(encoding='utf-8')
print('canScrollY', 'function canScrollY' in js)
print('collectScrollTargets', 'function collectScrollTargets' in js)
print('chromeOffsetPx', 'function chromeOffsetPx' in js)
css = (root / 'static/css/unit_best_pilots.css').read_text(encoding='utf-8')
print('metric-mark css', '.ubp-metric-mark' in css)
