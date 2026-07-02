#!/usr/bin/env python3
"""List weapon trait lines on playable units that fail DC power-scaling regexes."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import (  # noqa: E402
    unit_list_playable_ids,
    get_lang_data,
    iter_unit_weapon_trait_texts,
)

PATTERNS = {
    'dist_en': re.compile(
        r'(?:the\s+)?(?:closer|farther|further)\s+(?:you\s+are(?:\s+(?:to|from)\s+the\s+enemy)?|the\s+enemy\s+is).*?(?:greater|more)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)',
        re.I,
    ),
    'dist_zh': re.compile(r'距離敵方越(?:近|遠)，武裝POWER越為提升（最高提升(\d+)%）'),
    'dist_ja': re.compile(r'敵から(?:近い|遠い)ほど武装POWERが上昇[（(]最大(\d+)%上昇[）)]'),
    'hp_en': re.compile(
        r'(?:the\s+)?(?:lower|higher)\s+(?:(?:this\s+unit\'?s|your|own)\s+)?remaining\s+HP.*?(?:more|greater)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)',
        re.I,
    ),
    'hp_zh1': re.compile(r'自身剩餘HP越(?:高|低)，武裝POWER越為提升（最高提升(\d+)%）'),
    'hp_ja1': re.compile(r'自身の残HPが(?:多い|少ない)ほど武装POWERが上昇（最大(\d+)%上昇）'),
    'hp_lv_en': re.compile(r'(?:With\s+More|With\s+Less)\s+Remaining\s+HP,?\s*Higher\s+Weapon\s+Power\s*LV\s*(\d+)', re.I),
    'hp_lv_en2': re.compile(r'Scaling\s+Weapon\s+Power\s+\((?:More|Less)\s+Remaining\s+HP\)\s*LV\s*(\d+)', re.I),
    'hp_lv_zh': re.compile(r'剩餘HP越(?:高|低)武裝POWER提升\s*LV\s*(\d+)', re.I),
    'hp_lv_ja': re.compile(r'残HP(?:多い|少ない)ほど武装POWER上昇\s*LV\s*(\d+)', re.I),
    'mp_en': re.compile(
        r'the\s+higher\s+(?:your|own)\s+MP\s+is,?\s*the\s+(?:greater|more)\s+weapon\s+power\s+increases?\s*\(\s*up\s+to\s+(\d+)%(?:\s+increase)?\s*\)(?:\s+at\s+the\s+start\s+of\s+battle)?\.?',
        re.I,
    ),
    'mp_zh': re.compile(r'(?:戰鬥開始時，)?自身MP越高，武裝POWER越為提升（最高提升(\d+)%）'),
    'mp_ja': re.compile(r'(?:戦闘開始時、)?自身のMPが多いほど武装POWERが上昇（最大(\d+)%上昇）'),
    'mp_lv_en': re.compile(r'Scaling\s+Weapon\s+Power\s+\(High\s+(?:Max\s+)?MP\)(?:\s*LV\s*(\d+))?', re.I),
    'mp_lv_zh': re.compile(r'MP越高武裝POWER提升\s*LV\s*(\d+)', re.I),
    'mp_lv_ja': re.compile(r'MP(?:高い|多い)ほど武装POWER上昇\s*LV\s*(\d+)', re.I),
    'dist_lv_en': re.compile(r'Increased\s+(?:Close|Long)\s+Range\s+Weapon\s+Power\s*LV\s*(\d+)', re.I),
    'dist_lv_zh': re.compile(r'(?:近距離|遠距離)時武裝POWER提升\s*LV\s*(\d+)', re.I),
    'dist_lv_ja': re.compile(r'(?:近距離|遠距離)時武装POWER上昇\s*LV\s*(\d+)', re.I),
}

SCALING_HINT = re.compile(
    r'(?:weapon\s+power|武裝POWER|武装POWER).*(?:up\s+to|最高|最大|LV\s*\d|上昇|提升|increases?)',
    re.I,
)


def is_scaling_candidate(txt):
    if re.search(r'\bdown\b|下降|減少|低下', txt, re.I):
        return False
    if re.search(r'weapon\s+power\s+down|武裝POWER下降|武装POWER下降', txt, re.I):
        return False
    return bool(SCALING_HINT.search(txt))


def match_any(txt):
    flat = txt.replace('\n', ' ')
    for pat in PATTERNS.values():
        if pat.search(flat):
            return True
    return False


def main():
    langs = ('EN', 'TW', 'JA')
    unmatched = {}  # text -> set(unit ids sample)
    matched = 0
    total = 0
    for lc in langs:
        ld = get_lang_data(lc)
        for uid in unit_list_playable_ids:
            for mode in ('normal', 'ssp'):
                for line in iter_unit_weapon_trait_texts(uid, ld, lc, stat_mode=mode):
                    if not is_scaling_candidate(line):
                        continue
                    total += 1
                    if match_any(line):
                        matched += 1
                        continue
                    key = f'[{lc}] {line}'
                    unmatched.setdefault(key, set()).add(uid)

    out = ROOT / 'scripts' / 'audit_dc_weapon_power_on_units_report.txt'
    lines = [
        f'playable weapon scaling trait lines: {total}',
        f'matched: {matched}',
        f'unmatched: {sum(len(v) for v in unmatched.values())} unique lines: {len(unmatched)}',
        '',
    ]
    for key in sorted(unmatched):
        uids = sorted(unmatched[key])[:5]
        lines.append('---')
        lines.append(key)
        lines.append(f'units (sample): {", ".join(uids)}')
    out.write_text('\n'.join(lines), encoding='utf-8')
    print(out)
    print(f'total={total} matched={matched} unmatched_lines={len(unmatched)}')
    return 1 if unmatched else 0


if __name__ == '__main__':
    sys.exit(main())
