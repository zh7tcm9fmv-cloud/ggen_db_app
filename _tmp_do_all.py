from pathlib import Path
import re

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
out = []

# Apply i18n if needed
p = root / 'static/js/app.js'
text = p.read_text(encoding='utf-8')
changed = False
for key, val in [
    ('msy_metric_super_crit', 'Super Critical'),
    ('msy_metric_crit', 'Critical'),
]:
    new_text, n = re.subn(re.escape(key) + r":'[^']*'", f"{key}:'{val}'", text, count=1)
    out.append(f'{key} replacements={n}')
    if n:
        text = new_text
        changed = True

new_text, n = re.subn(
    r"unit_best_pilot_note:'[^']*'",
    "unit_best_pilot_note:'Eternal Expert: MS DEF: {ms} Pilot DEF: {pilot}'",
    text,
    count=1,
)
out.append(f'note replacements={n}')
if n:
    text = new_text
    changed = True

if "||'Super Crit'" in text:
    text = text.replace("||'Super Crit'", "||'Super Critical'")
    changed = True
    out.append('replaced Super Crit fallback')
if "||'Crit'" in text:
    # careful: only exact Crit fallback in metric menu
    text2 = text.replace("||'Crit'", "||'Critical'")
    if text2 != text:
        text = text2
        changed = True
        out.append('replaced Crit fallback')

if changed:
    p.write_text(text, encoding='utf-8')
    out.append('app.js written')
else:
    out.append('app.js unchanged')

t = p.read_text(encoding='utf-8')
for k in ['msy_metric_super_crit', 'msy_metric_crit', 'unit_best_pilot_note']:
    m = re.search(re.escape(k) + r":'([^']*)'", t)
    out.append(f'final {k} => {m.group(1) if m else None}')

# Extract shell HTML around unitBestPilotPanelWrap
m = re.search(r"id=\"unitBestPilotPanelWrap\".{0,3500}", t)
if m:
    snip = m.group(0)
    (root / '_tmp_shell_snip.txt').write_text(snip, encoding='utf-8')
    out.append(f'shell snip len={len(snip)}')
else:
    # try single-quoted template
    m = re.search(r"unitBestPilotPanelWrap.{0,3500}", t)
    if m:
        (root / '_tmp_shell_snip.txt').write_text(m.group(0), encoding='utf-8')
        out.append(f'shell snip2 len={len(m.group(0))}')
    else:
        out.append('shell snip NOT FOUND')

(root / '_tmp_out.txt').write_text('\n'.join(out), encoding='utf-8')
print('DONE')
