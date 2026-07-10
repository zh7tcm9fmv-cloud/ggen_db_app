from pathlib import Path
import re
t = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js').read_text(encoding='utf-8')
m = re.search(r'id="ubpMetricDropdown".{0,1800}', t)
out = []
s = m.group(0) if m else 'MISSING'
out.append('has SuperCritical: ' + str('Label_SuperCritical' in s))
out.append('has Normal icon: ' + str('Label_Normal' in s))
out.append('has Critical: ' + str('Label_Critical' in s))
out.append('default data-ubp-metric=normal on toggle: ' + str('id="ubpMetricDdToggle" data-ubp-metric="normal"' in s))
out.append('no Tension icons: ' + str('UI_Tention_Up' not in s))
out.append('no metric-label span: ' + str('ubp-metric-label' not in s))
# count text spans in menu
out.append('menu text spans: ' + str(len(re.findall(r'<span>\$\{esc\(t\(', s))))
Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\_vr_metric.txt').write_text('\n'.join(out) + '\n' + s[:500], encoding='utf-8')
