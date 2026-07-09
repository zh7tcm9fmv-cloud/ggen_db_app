from pathlib import Path
import re
t = Path('static/js/app.js').read_text(encoding='utf-8')
for k in ['msy_metric_super_crit', 'msy_metric_crit', 'unit_best_pilot_note']:
    m = re.search(re.escape(k) + r":'([^']*)'", t)
    print(k, '=>', m.group(1) if m else None)
print('Super Critical', t.count('Super Critical'))
print('Super Crit leftover', len(re.findall(r"Super Crit(?!ical)", t)))
