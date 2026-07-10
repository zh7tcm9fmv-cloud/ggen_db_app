from pathlib import Path
import re

js_path = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js')
js = js_path.read_text(encoding='utf-8')

# Check openDetail patch
print('ex default open', "ex_supercharged_tiers.length-1" in js and "S.currentDetailData=d;S.currentDetailType=type;if(type==='character'&&S.conditionalPassiveActive" in js)

# Extract exact updateSearchHintVisibility / initSearchHints
m = re.search(r'function updateSearchHintVisibility\(inputId\)\{.*?function initSearchHints\(\)\{.*?\}', js)
if not m:
    m = re.search(r'function updateSearchHintVisibility\(inputId\)\{.{0,400}', js)
    print('partial', m.group(0) if m else None)
else:
    Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\_hint.txt').write_text(m.group(0), encoding='utf-8')
    print('wrote hint', len(m.group(0)))
