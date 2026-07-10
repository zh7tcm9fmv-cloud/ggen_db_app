from pathlib import Path
import re

t = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js').read_text(encoding='utf-8')
m = re.search(r'async function openDetail\(type,id,opts\).{0,4500}', t)
if m:
    Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\_od.txt').write_text(m.group(0), encoding='utf-8')
    print('wrote', len(m.group(0)))
# Find where CP is auto-enabled for characters
for m in re.finditer(r'.{0,100}conditionalPassiveActive.{0,120}', t):
    s = m.group(0)
    if 'character' in s.lower() or 'has_ex' in s or 'has_cond' in s or 'true' in s:
        print('---')
        print(s[:220])
