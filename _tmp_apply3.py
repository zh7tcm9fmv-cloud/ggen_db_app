from pathlib import Path

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
js_path = root / 'static/js/app.js'
js = js_path.read_text(encoding='utf-8')

start = js.find('function updateSearchHintVisibility(inputId){')
end_marker = 'function onSearchSpotlightInput'
end = js.find(end_marker, start)
print('start', start, 'end', end)
print(repr(js[start:end]))
Path(root / '_hint.txt').write_text(js[start:end], encoding='utf-8')
