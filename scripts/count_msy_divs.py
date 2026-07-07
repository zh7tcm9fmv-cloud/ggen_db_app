from pathlib import Path

html = Path('templates/index.html').read_text(encoding='utf-8')
i = html.find('id="panel-meta_synergy"')
j = html.find('id="panel-units"')
chunk = html[i:j]
print('opens', chunk.count('<div'))
print('closes', chunk.count('</div>'))
print('missing', chunk.count('<div') - chunk.count('</div>'))
print('tail:', repr(chunk[-200:]))
j = html.find('id="panel-units"')
print('boundary:', repr(html[j-80:j+50]))
