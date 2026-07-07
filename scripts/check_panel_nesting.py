"""Check whether browse tab panels are nested incorrectly in served HTML."""
import re
import sys
import urllib.request
from pathlib import Path

source = sys.argv[1] if len(sys.argv) > 1 else 'https://ggendb.up.railway.app/'
if source.startswith('http'):
    html = urllib.request.urlopen(source, timeout=60).read().decode('utf-8', 'replace')
else:
    html = Path(source).read_text(encoding='utf-8')

def panel_close_offset(panel_id):
    start = html.find(f'id="{panel_id}"')
    if start < 0:
        return None, None
    # walk back to opening <div
    open_start = html.rfind('<div', 0, start)
    depth = 0
    i = open_start
    while i < len(html):
        if html.startswith('<div', i):
            depth += 1
            i = html.find('>', i) + 1
        elif html.startswith('</div>', i):
            depth -= 1
            if depth == 0:
                return open_start, i + 6
            i += 6
        else:
            i += 1
    return open_start, None

for pid in ['panel-characters', 'panel-ranking', 'panel-meta_synergy', 'panel-units', 'panel-supporters']:
    s, e = panel_close_offset(pid)
    print(pid, 'start', s, 'end', e, 'len', (e - s) if e else None)

_, char_end = panel_close_offset('panel-characters')
_, msy_end = panel_close_offset('panel-meta_synergy')
units_start = html.find('id="panel-units"')
print('units inside meta_synergy?', units_start < msy_end if msy_end else 'meta_synergy unclosed')
if not msy_end:
    # depth at units
    open_start = html.rfind('<div', 0, html.find('id="panel-meta_synergy"'))
    depth = 0
    i = open_start
    while i <= units_start:
        if html.startswith('<div', i):
            depth += 1
            i = html.find('>', i) + 1
        elif html.startswith('</div>', i):
            depth -= 1
            i += 6
        else:
            i += 1
    print('depth at panel-units open', depth)
