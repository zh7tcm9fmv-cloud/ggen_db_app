from pathlib import Path
import re
t = Path('static/js/app.js').read_text(encoding='utf-8')
for k in ['unit_best_pilot_note','msy_metric_super_crit','msy_metric_crit','msy_metric_normal','unit_best_pilot_title']:
    m = re.search(re.escape(k) + r":'([^']*)'", t)
    print(k, '=>', m.group(1) if m else 'MISSING')
# also find note in shell
i = t.find('unit_best_pilot_note')
print('shell ctx', t[i:i+120] if i>=0 else '')
