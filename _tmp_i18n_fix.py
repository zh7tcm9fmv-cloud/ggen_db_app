from pathlib import Path
import re

p = Path('static/js/app.js')
text = p.read_text(encoding='utf-8')

for key, val in [
    ('msy_metric_super_crit', 'Super Critical'),
    ('msy_metric_crit', 'Critical'),
]:
    text, n = re.subn(re.escape(key) + r":'[^']*'", f"{key}:'{val}'", text, count=1)
    print(key, n)

text, n = re.subn(
    r"unit_best_pilot_note:'[^']*'",
    "unit_best_pilot_note:'Eternal Expert: MS DEF: {ms} Pilot DEF: {pilot}'",
    text,
    count=1,
)
print('note', n)

text = text.replace("||'Super Crit'", "||'Super Critical'")
text = text.replace("||'Crit'", "||'Critical'")

p.write_text(text, encoding='utf-8')
t = p.read_text(encoding='utf-8')
for k in ['msy_metric_super_crit', 'msy_metric_crit', 'unit_best_pilot_note']:
    m = re.search(re.escape(k) + r":'([^']*)'", t)
    print('final', k, '=>', m.group(1) if m else None)
print('Super Critical', t.count('Super Critical'))
print('leftover Super Crit', len(re.findall(r'Super Crit(?!ical)', t)))
