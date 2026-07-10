from pathlib import Path
import re
t = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js').read_text(encoding='utf-8')
m = re.search(r'id="ubpMetricDropdown".{0,2200}', t)
Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\_metric_snip.txt').write_text(m.group(0) if m else 'MISSING', encoding='utf-8')
print('len', len(m.group(0)) if m else 0)
