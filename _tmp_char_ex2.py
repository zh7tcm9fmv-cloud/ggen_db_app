import json, re
from pathlib import Path

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
ability_ids = [2010005, 2011505, 2024401, 2000101]

# Find ability master
for name in ['m_character_ability.json', 'm_ability.json', 'm_trait.json']:
    p = root/'data/EN/master'/name
    print(name, p.exists())

# Try common structures
masters = list((root/'data/EN/master').glob('*abilit*'))
print('ability masters', [p.name for p in masters])
langs = list((root/'data/EN/lang').glob('*abilit*'))
print('ability langs', [p.name for p in langs])
