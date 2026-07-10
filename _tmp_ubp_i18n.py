# -*- coding: utf-8 -*-
from pathlib import Path
import re

t = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js').read_text(encoding='utf-8')
out = []
for m in re.finditer(r"unit_best_pilot_[a-z_]+:'[^']*'", t):
    prev = t[max(0, m.start() - 400):m.start()]
    lm = list(re.finditer(r'Object\.assign\(T\.(EN|TW|HK|JA),', prev))
    lang = lm[-1].group(1) if lm else '?'
    out.append(f'{lang}: {m.group(0)}')
Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\_i18n_out.txt').write_text('\n'.join(out), encoding='utf-8')
print(len(out))
