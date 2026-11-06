import re
from pathlib import Path
t = Path("static/js/app.js").read_text(encoding="utf-8")
# EN labels near unit_filter_weapon_debuff
i = t.find("unit_filter_wb_atk_dn:")
print("first", i)
print(t[i : i + 1200])
print("---")
# JA Object.assign with unit_filter_wb
j = t.find("Object.assign(T.JA,{")
# find unit_filter_wb in JA assigns
for m in re.finditer(r"Object\.assign\(T\.(EN|JA|TW|HK),\{[^}]*unit_filter_wb_atk_dn:'([^']*)'", t):
    print(m.group(1), m.group(2)[:80])
