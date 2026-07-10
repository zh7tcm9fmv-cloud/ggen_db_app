# Probe Setsuna EX tiers via app helpers (no Flask server needed)
import sys
from pathlib import Path
root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
sys.path.insert(0, str(root))

import app as A

cid = '1370003701'
# Build abilities like get_character
info = A.char_info_map.get(cid) or A.char_info_map.get(1370003701)
print('info keys', list(info.keys())[:20] if info else None)

# Use get_character if available
try:
    d = A.get_character(cid, 'EN')
except TypeError:
    d = A.get_character(cid)
except Exception as e:
    print('get_character err', type(e), e)
    d = None

if d:
    print('name', d.get('name'))
    print('has_ex', d.get('has_ex_stats'))
    tiers = d.get('ex_supercharged_tiers') or []
    print('tiers', len(tiers))
    for t in tiers:
        print(' tier', t.get('tier'), t.get('label'))
        st = t.get('stats') or {}
        for k in ('Melee','Ranged','Reaction','Defense','Awaken'):
            if k in st: print('  ', k, st[k])
    swe = d.get('stats_with_ex') or {}
    print('stats_with_ex Melee', swe.get('Melee'))
    print('stats Melee', (d.get('stats') or {}).get('Melee'))

# Also check ability text for 2024401
ac = None
try:
    from meta_synergy_rank import _build_char_ac_calc
    ac = _build_char_ac_calc(cid, 'EN')
except Exception as e:
    print('ac err', e)

if ac:
    for bab in ac:
        if bab.get('is_ex'):
            print('EX ability', bab.get('name'), bab.get('id'))
            for d2 in bab.get('details') or []:
                txt = (d2.get('text') or '')
                if 'Supercharged' in txt or '超' in txt:
                    print('---TEXT---')
                    print(txt[:2000])
    tiers2 = A.collect_supercharged_ex_stat_tiers(ac, cid)
    print('collect tiers', tiers2)
