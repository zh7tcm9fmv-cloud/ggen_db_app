from pathlib import Path
import re

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
js_path = root / 'static/js/app.js'
js = js_path.read_text(encoding='utf-8')

# 1) openDetail EX2 default
old = "S.currentDetailData=d;S.currentDetailType=type;if(type==='supporter')"
new = (
    "S.currentDetailData=d;S.currentDetailType=type;"
    "if(type==='character'&&S.conditionalPassiveActive&&d.ex_supercharged_tiers&&d.ex_supercharged_tiers.length>1)"
    "S.charSuperchargedExTier=d.ex_supercharged_tiers.length-1;"
    "if(type==='supporter')"
)
if old in js:
    js = js.replace(old, new, 1)
    print('openDetail EX default: ok')
elif "S.currentDetailData=d;S.currentDetailType=type;if(type==='character'&&S.conditionalPassiveActive" in js:
    print('openDetail EX default: already')
else:
    print('openDetail EX default: MISSING')

# 2) search hint / clear
m = re.search(
    r"function updateSearchHintVisibility\(inputId\)\{.*?\}"
    r"function initSearchHints\(\)\{.*?\}",
    js,
)
if not m:
    # try looser: find both separately
    m1 = re.search(r"function updateSearchHintVisibility\(inputId\)\{[^}]+\}", js)
    m2 = re.search(r"function initSearchHints\(\)\{[^}]+(?:\{[^}]*\}[^}]*)*\}", js)
    print('m1', bool(m1), m1.group(0) if m1 else None)
    print('m2', bool(m2), (m2.group(0)[:300] if m2 else None))
else:
    print('combined found', len(m.group(0)))
    Path(root / '_hint.txt').write_text(m.group(0), encoding='utf-8')

js_path.write_text(js, encoding='utf-8')
print('wrote js')
