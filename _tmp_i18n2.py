from pathlib import Path
import re
t = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js').read_text(encoding='utf-8')
out = []
for lang, marker in [
    ('EN', 'Object.assign(T.EN,{'),
    ('TW', 'Object.assign(T.TW,{'),
    ('HK', 'Object.assign(T.HK,{'),
    ('JA', 'Object.assign(T.JA,{'),
]:
    i = t.find(marker)
    out.append(f'=== {lang} at {i}')
    if i < 0:
        continue
    # take until next Object.assign or 8000 chars
    chunk = t[i:i+12000]
    for k in ['msy_metric_super_crit','msy_metric_crit','msy_metric_normal','msy_abbr_crit','msy_crit_rate','msy_affinity_match','msy_guaranteed_crit','unit_best_pilot']:
        m = re.search(re.escape(k) + r":'([^']*)'", chunk)
        out.append(f'  {k} => {m.group(1) if m else None}')
Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\_i18n_out.txt').write_text('\n'.join(out), encoding='utf-8')
