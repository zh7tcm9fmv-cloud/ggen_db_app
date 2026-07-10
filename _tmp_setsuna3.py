import sys
from pathlib import Path
root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
sys.path.insert(0, str(root))
import app as A
from meta_synergy_rank import _build_char_ac_calc, _char_grown_bases, _msy_char_stat_mode
import math

cid = '1370003701'
ac = _build_char_ac_calc(cid, 'EN')
grown, grown_sp, ri, has_sp = _char_grown_bases(cid)
print('rarity', ri, 'has_sp', has_sp, 'mode', _msy_char_stat_mode(cid))
print('grown Melee', grown.get('Melee'), 'sp', grown_sp.get('Melee'))

buckets = A._accumulate_character_trait_percent_buckets(ac, cid, A.lang_data['EN'] if hasattr(A,'lang_data') else None)
# print bucket lengths
print('bucket lens', len(buckets))
spbn_u, spbn_c, spbn_pair, spen, spen_pair = buckets[0], buckets[1], buckets[2], buckets[3], buckets[4]
print('spbn_u Melee', spbn_u.get('Melee'), 'spbn_c', spbn_c.get('Melee'), 'spen', spen.get('Melee'), 'spen_pair', spen_pair.get('Melee'))
print('spbn_u Reaction', spbn_u.get('Reaction'), 'spbn_c', spbn_c.get('Reaction'), 'spen', spen.get('Reaction'))

tiers = A.collect_supercharged_ex_stat_tiers(ac, cid)
for t in tiers:
    bv = grown['Melee']
    pct = spbn_u['Melee'] + spbn_c['Melee'] + t['ex_pct']['Melee']
    total = bv + math.floor(bv * pct / 100)
    print(f"EX{t['tier']} Melee pct={pct} total={total} ex={t['ex_pct']}")

# What does EX1 look like if mistakenly used
# Compare with get_character via test client
client = A.app.test_client()
r = client.get('/api/character/1370003701?lang=EN')
print('status', r.status_code)
d = r.get_json()
print('name', d.get('name'))
for t in d.get('ex_supercharged_tiers') or []:
    print('API tier', t.get('tier'), t.get('label'))
    for s in t.get('stats') or []:
        if s.get('name') in ('Melee','Reaction','Defense','Ranged'):
            print(' ', s)
print('stats_with_ex', d.get('stats_with_ex'))
