from pathlib import Path
import re

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
js = (root / 'static/js/app.js').read_text(encoding='utf-8')

# Fix clear button glyph if escaped wrong
if "btn.textContent='\\\\u00d7'" in js or "btn.textContent='\\u00d7'" in js:
    js = js.replace("btn.textContent='\\\\u00d7'", "btn.textContent='×'")
    js = js.replace("btn.textContent='\\u00d7'", "btn.textContent='×'")
    print('fixed glyph')
elif "btn.textContent='×'" in js:
    print('glyph ok')
else:
    m = re.search(r'btn\.textContent=.{{0,20}}', js)
    print('glyph context', m.group(0) if m else 'missing')

print('show-hint add count', js.count("wrap.classList.add('show-hint')"))
print('mouseenter count', js.count("addEventListener('mouseenter'"))
print('clearFilterInput', 'function clearFilterInput' in js)

(root / 'static/js/app.js').write_text(js, encoding='utf-8')

# cleanup temps
for p in root.glob('_tmp_*'):
    if p.name.startswith('_tmp_'):
        try:
            p.unlink()
            print('rm', p.name)
        except Exception as e:
            print('skip', p.name, e)
for name in ['_od.txt', '_hint.txt', '_vr.txt', '_vr2.txt']:
    p = root / name
    if p.exists():
        p.unlink()
        print('rm', name)
