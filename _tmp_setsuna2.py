import sys
from pathlib import Path
root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
sys.path.insert(0, str(root))

# Avoid full get_character; use internal helpers after import
import app as A
from flask import Flask

cid = '1370003701'
# Build ac like meta_synergy
from meta_synergy_rank import _build_char_ac_calc, _char_totals_for_pair_max

ac = _build_char_ac_calc(cid, 'EN')
print('abilities', len(ac))
for bab in ac:
    print('-', bab.get('id'), bab.get('name'), 'is_ex', bab.get('is_ex'))
    if bab.get('is_ex'):
        for d2 in bab.get('details') or []:
            txt = d2.get('text') or ''
            print(txt[:2500])
            print('---')

tiers = A.collect_supercharged_ex_stat_tiers(ac, cid)
print('TIERS:')
for t in tiers:
    print(t)

# Compare totals with a sample unit (any)
# Find Setsuna recommend unit or a melee unit
totals, pair_ok = _char_totals_for_pair_max(cid, '1370003700', 'EN')  # guess
print('totals vs 1370003700', totals, 'pair_ok', pair_ok)

# Check BSP cache for Setsuna char_atk
import gzip, json
p = root/'data/published/msy__v16_bsp_dc_EN_lb3_tp10_du0_dc0.json.gz'
if not p.exists():
    p = root/'data/published/msy__v16_bsp_dc_EN_lb3_tp20_du0_dc0.json.gz'
print('cache', p, p.exists())
if p.exists():
    with gzip.open(p, 'rt', encoding='utf-8') as f:
        d = json.load(f)
    found = 0
    for g in d.get('groups') or []:
        for pil in (g.get('pilots') or [])[:15]:
            ch = pil.get('char') or {}
            if str(ch.get('id')) == cid:
                found += 1
                if found <= 3:
                    print('unit', (g.get('unit') or {}).get('name'), (g.get('unit') or {}).get('id'))
                    print('  rank', pil.get('rank'), 'char_atk', pil.get('char_atk'), 'dmg', pil.get('super_crit') or pil.get('dmg') or pil.get('rank_super_crit'))
                    print('  keys', sorted(pil.keys())[:30])
                    print('  sample', {k: pil.get(k) for k in ['char_atk','pilot_atk','crit_rate','guaranteed_crit','dmg_dealt_pct','affinity_matches','weapon_atk_type']})
                break
    print('found in', found, 'unit top lists')
