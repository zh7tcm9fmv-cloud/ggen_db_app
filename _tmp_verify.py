from pathlib import Path
import re
t = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js').read_text(encoding='utf-8')
# Check for accidental Critical replacements
for pat in [r"\|\|'Critical'", r"\|\|'Super Critical'", r"unit_best_pilot_note", r"ubp-metric-mark", r"25,072"]:
    print(pat, 'count', len(re.findall(pat, t)))
# Any weird Critical that shouldn't be
for m in re.finditer(r".{0,40}\|\|'Critical'.{0,40}", t):
    print('CRIT FALLBACK CTX:', m.group(0)[:120])
