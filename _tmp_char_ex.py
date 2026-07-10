import json
from pathlib import Path

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
cid = 1370003701
lang = json.loads((root/'data/EN/lang/m_character.json').read_text(encoding='utf-8'))
name = None
for row in lang:
    if row.get('id') == 100100001370003701:
        name = row.get('text') or row.get('Text') or row
        break
print('NAME', name)

# ability set
asets = json.loads((root/'data/EN/master/m_character_ability_set.json').read_text(encoding='utf-8'))
rows = [r for r in asets if r.get('CharacterId') == cid]
print('ability set rows', len(rows))
for r in rows:
    print(r)
