#!/usr/bin/env python3
"""Audit weapon-trait strings vs damage-calc power-scaling regexes in static/js/app.js."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'

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
    'hp_lv_zh': re.compile(r'剩餘HP越(?:高|低)武裝POWER提升\s*LV\s*(\d+)', re.I),
    'hp_lv_ja': re.compile(r'残HP(?:多い|少ない)ほど武装POWER上昇\s*LV\s*(\d+)', re.I),
    'hp_lv_en2': re.compile(r'Scaling\s+Weapon\s+Power\s+\((?:More|Less)\s+Remaining\s+HP\)\s*LV\s*(\d+)', re.I),
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

POW_LV = [5, 7, 10, 12, 15, 17, 20, 22, 25]


def lv_to_pct(lv):
    i = int(lv) - 1
    return POW_LV[i] if 0 <= i < len(POW_LV) else 0


def load_rows(path):
    d = json.loads(path.read_text(encoding='utf-8'))
    if isinstance(d, list):
        return d
    return d.get('data') or []


def collect_texts():
    texts = set()
    for path in DATA.rglob('m_weapon_trait.json'):
        for row in load_rows(path):
            if isinstance(row, dict):
                v = (row.get('value') or row.get('Value') or '').strip()
                if v:
                    texts.add(v)
    for path in DATA.rglob('m_trait.json'):
        for row in load_rows(path):
            if isinstance(row, dict):
                v = (row.get('value') or row.get('Value') or '').strip()
                if v and re.search(r'weapon\s+power|武裝POWER|武装POWER', v, re.I):
                    texts.add(v)
    return texts


def is_scaling_candidate(txt):
    if re.search(r'\bdown\b|下降|減少|低下', txt, re.I):
        return False
    if re.search(r'weapon\s+power\s+down|武裝POWER下降|武装POWER下降', txt, re.I):
        return False
    return bool(re.search(
        r'(?:weapon\s+power|武裝POWER|武装POWER).*(?:up\s+to|最高|最大|LV\s*\d|上昇|提升|increases?)',
        txt,
        re.I,
    ))


def match_any(txt):
    flat = txt.replace('\n', ' ')
    for name, pat in PATTERNS.items():
        m = pat.search(flat)
        if m:
            g = m.group(1) if m.lastindex else None
            if g and g.isdigit() and 'lv' in name:
                return name, lv_to_pct(g)
            return name, g or 'ok'
    return None, None


def main():
    texts = collect_texts()
    scaling = sorted(t for t in texts if is_scaling_candidate(t))
    unmatched = []
    matched = 0
    for t in scaling:
        name, _ = match_any(t)
        if name:
            matched += 1
        else:
            unmatched.append(t)

    out = ROOT / 'scripts' / 'audit_dc_weapon_power_traits_report.txt'
    lines = [
        f'total trait strings scanned: {len(texts)}',
        f'scaling increase candidates: {len(scaling)}',
        f'matched by current DC regexes: {matched}',
        f'unmatched increase candidates: {len(unmatched)}',
        '',
    ]
    for t in unmatched:
        lines.append('---')
        lines.append(t)
    out.write_text('\n'.join(lines), encoding='utf-8')
    print(out)
    print(f'matched={matched} unmatched={len(unmatched)}')
    return 1 if unmatched else 0


if __name__ == '__main__':
    sys.exit(main())
