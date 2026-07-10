from pathlib import Path
import re
t = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js').read_text(encoding='utf-8')
for lang in ['EN', 'TW', 'HK', 'JA']:
    # Find Object.assign(T.LANG or T={EN
    keys = ['msy_metric_super_crit', 'msy_metric_crit', 'msy_metric_normal', 'msy_abbr_crit', 'msy_affinity_match', 'unit_best_pilot_note', 'msy_crit_rate']
    print('===', lang)
    for k in keys:
        # Prefer Object.assign(T.LANG block; for EN also T={EN
        patterns = [
            rf"Object\.assign\(T\.{lang},{{[^}}]*{k}:'([^']*)'",
            rf"{lang}:{{[^}}]*{k}:'([^']*)'",
        ]
        found = None
        # simpler: search all occurrences with nearby lang context is hard; just find all
        ms = list(re.finditer(re.escape(k) + r":'([^']*)'", t))
        # pick by scanning backwards for TW/HK/JA/EN assign
        for m in ms:
            start = max(0, m.start()-80)
            ctx = t[start:m.start()]
            if lang == 'EN' and ('Object.assign(T.EN' in ctx or "T={EN" in ctx or "EN:{" in ctx):
                # weak
                pass
            if f'T.{lang}' in ctx or (lang=='EN' and 'Object.assign(T.EN' in ctx):
                found = m.group(1)
                break
        if found is None and ms:
            # fallback: for TW/HK/JA the Object.assign lines are unique
            for m in ms:
                start = max(0, m.start()-200)
                if f'T.{lang}' in t[start:m.start()]:
                    found = m.group(1)
                    break
        print(f'  {k} => {found}')
