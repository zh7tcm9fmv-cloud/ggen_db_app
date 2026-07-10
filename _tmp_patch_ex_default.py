from pathlib import Path
import re

# Patch openDetail character init to default to max EX tier when CP on
p = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js')
text = p.read_text(encoding='utf-8')

# Find pattern around openDetail character setup - look for charSuperchargedExTier=0 near openDetail
# We'll add a helper and call it when character detail loads.

helper = '''function defaultCharSuperchargedExTier(d){const arr=d&&d.ex_supercharged_tiers;if(arr&&arr.length>1)return arr.length-1;return 0}
'''

if 'function defaultCharSuperchargedExTier' not in text:
    text = text.replace(
        'function setCharSuperchargedExTier(i){',
        helper + 'function setCharSuperchargedExTier(i){',
        1,
    )
    print('added helper')
else:
    print('helper exists')

# After assigning S.currentDetailData for character, set tier.
# Common pattern in openDetail - search for places that set charSuperchargedExTier=0 when opening character
# Better: patch updateDetailDynamicSections / first render path.

# When openDetail finishes for character, it likely sets S.charSuperchargedExTier=0 then renders.
# Replace the openDetail reset only when type is character after data load.

# Look for: S.charSuperchargedExTier=0; near currentDetailData assignment in openDetail
# Safer approach: in detailStatRows and render, if CP on and tier is 0 and tiers exist, use max?
# User wants EX2 as default - so when opening character with CP, set to max.

# Patch: after S.currentDetailData=d (character), set tier.
# Find in openDetail the block that sets S.charSuperchargedExTier=0 at start - keep that.
# After data loaded for character, set to max if CP will be on.

# Search for pattern where character detail data is assigned
m = re.search(r"S\.currentDetailType='character';.{0,200}", text)
print('char assign', bool(m))
if m:
    print(m.group(0)[:200])

# Also find where conditionalPassiveActive is set true for characters
for m in re.finditer(r'.{0,80}conditionalPassiveActive\s*=\s*true.{0,80}', text):
    print('CP true:', m.group(0)[:160])
    break

p.write_text(text, encoding='utf-8')
