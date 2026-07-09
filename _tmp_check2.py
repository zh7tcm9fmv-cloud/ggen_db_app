from pathlib import Path
import re
t = Path('static/js/app.js').read_text(encoding='utf-8')
for k in ['msy_metric_super_crit', 'msy_metric_crit', 'unit_best_pilot_note']:
    m = re.search(re.escape(k) + r":'([^']*)'", t)
    print(k, '=>', m.group(1) if m else None)
# Extract BSP shell snippet
m = re.search(r'unitBestPilotPanelWrap.{0,2500}', t)
if m:
    Path('_tmp_shell_snip.txt').write_text(m.group(0), encoding='utf-8')
    print('wrote shell snip', len(m.group(0)))
