# -*- coding: utf-8 -*-
from pathlib import Path
import re

p = Path(__file__).resolve().parents[1] / "static" / "js" / "app.js"
src = p.read_text(encoding="utf-8")

# After each tab_banner_timeline (except EN which already has tab_gacha_sim), inject.
# EN already: tab_banner_timeline:'Unit Assembly',tab_gacha_sim:'Gacha Sim'

repls = [
    (
        "tab_banner_timeline:'機體補給'",
        "tab_banner_timeline:'機體補給',tab_gacha_sim:'抽卡模擬'",
    ),
]

# JA via JP_CORE_LABELS or Object.assign(T.JA
# Find JA banner timeline
for m in re.finditer(r"tab_banner_timeline:'([^']*)'", src):
    val = m.group(1)
    full = m.group(0)
    if "tab_gacha_sim" in src[m.end() : m.end() + 40]:
        continue
    if val == "Unit Assembly":
        continue  # already done
    if val == "機體補給":
        # TW and HK both use this — replace both
        pass

# Replace all remaining banner_timeline without following gacha_sim
pattern = re.compile(
    r"(tab_banner_timeline:'(?:機體補給|ユニットアセンブリ|Unit Assembly)')(?!,tab_gacha_sim)"
)

def sub(m):
    key = m.group(1)
    if "Unit Assembly" in key:
        return key + ",tab_gacha_sim:'Gacha Sim'"
    if "機體補給" in key:
        return key + ",tab_gacha_sim:'抽卡模擬'"
    if "ユニット" in key:
        return key + ",tab_gacha_sim:'ガチャシミュ'"
    return key

new_src, n = pattern.subn(sub, src)
print("locale injects", n)

# JP_CORE_LABELS may use different key — add Object.assign for JA if missing
if "tab_gacha_sim" not in new_src[new_src.find("T.JA=") : new_src.find("T.JA=") + 5000]:
    # Ensure JA gets it via a small Object.assign after JP_CORE
    needle = "T.JA=Object.assign({},T.EN,JP_CORE_LABELS);"
    if needle in new_src and "Object.assign(T.JA,{tab_gacha_sim" not in new_src:
        new_src = new_src.replace(
            needle,
            needle + "Object.assign(T.JA,{tab_gacha_sim:'ガチャシミュ'});",
            1,
        )
        print("JA assign added")

p.write_text(new_src, encoding="utf-8")
print("done")
