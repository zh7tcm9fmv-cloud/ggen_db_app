"""Parse official Unit Assembly proportion JSON into structured drop rates."""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache

_PCT_RE = re.compile(r'([0-9]+(?:\.[0-9]+)?)\s*%')


def _cell_text(cell) -> str:
    if not isinstance(cell, dict):
        return str(cell or '')
    return ' '.join(str(x) for x in (cell.get('contents') or [])).strip()


def _parse_pct(text: str):
    if not text or text.strip() in ('-', '—', ''):
        return None
    m = _PCT_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _table_rows(content: str):
    try:
        obj = json.loads(content)
    except Exception:
        return []
    return list(obj.get('rows') or [])


def _classify_section(title: str) -> str:
    """Map official EN/JA/TW/HK section titles → rate bucket keys."""
    t = title or ''
    low = t.lower()
    # 100th guaranteed UR (JA 累計100回目 / TW·HK 累計第100次)
    if (
        re.search(r'100\s*(th|回目|次)', t, re.I)
        or 'guaranteed ur' in low
        or '保障獲得ur' in low
        or ('ur' in low and '確定' in t)
    ):
        return 'pity_100'
    # 1st–9th range must win over bare "10 times"
    if re.search(r'1\s*[-~～〜至到]\s*9', t) or '1st' in low:
        return 'single_or_1to9'
    if re.search(r'(?<!\d)10\s*(th|回目|次)', t, re.I):
        return 'multi_10th'
    if 'use 1 time' in low or re.search(r'(?<!\d)1\s*time', low) or '1回引く' in t or '補給1次' in t:
        return 'single_or_1to9'
    return 'other'


def _header_norm(h: str) -> str:
    return (h or '').strip().lower()


def _header_is_rarity(h: str) -> bool:
    n = _header_norm(h)
    return n in ('rarity', 'レアリティ', '稀有度')


def _header_is_drop_rate(h: str) -> bool:
    n = _header_norm(h)
    return n in ('drop rate', '提供割合', '出現機率', '出現確率', '掉落率') or 'drop rate' in n


def _header_is_entity_name(h: str) -> bool:
    """Name column in per-entity tables (not the category Unit/Supporters % columns)."""
    n = _header_norm(h)
    if n in (
        'units', 'unit', 'supporters', 'supporter',
        'ユニット', 'ユニット名', 'サポーター', 'サポーター名',
        '單位', '單位名', '支援人員', '支援人員名',
    ):
        # Category tables use bare Unit/Supporters as % columns — those also match.
        # Caller distinguishes via _header_is_drop_rate presence.
        return True
    # JA/TW name columns often end with 名
    if n.endswith('名') and any(k in n for k in ('ユニット', 'サポーター', '單位', '支援')):
        return True
    return False


def _entity_kind_from_title(title: str) -> str:
    t = (title or '').strip()
    low = t.lower()
    if low in ('unit', 'units') or t in ('ユニット', '單位', '単位'):
        return 'unit'
    if low in ('supporters', 'supporter') or t in ('サポーター', '支援人員'):
        return 'supporter'
    return ''


def _rates_parsed_ok(parsed: dict | None) -> bool:
    if not parsed:
        return False
    cat = parsed.get('category') or {}
    return bool(cat.get('single_or_1to9') or cat.get('multi_10th') or cat.get('pity_100'))


def parse_gasha_proportion(payload: dict) -> dict:
    """Return structured drop-rate summary from official proportion JSON."""
    blocks = list((payload or {}).get('information_block_list') or [])
    notes = []
    category = {}
    by_name = {}
    section = ''
    entity_kind = ''  # unit | supporter

    def _ensure_name(name: str):
        if name not in by_name:
            by_name[name] = {}
        return by_name[name]

    for b in blocks:
        if not isinstance(b, dict):
            continue
        typ = int(b.get('information_block_type') or 0)
        content = b.get('content') or ''
        if typ == 4:
            notes.append(content)
            continue
        if typ == 1:
            # e.g. "Use 10 times (10th)Drop Rate" / 「10回引く(10回目)」提供割合
            section = _classify_section(content)
            entity_kind = ''
            continue
        if typ == 8:
            title = content.strip()
            kind = _entity_kind_from_title(title)
            if kind:
                entity_kind = kind
                continue
            # Category subsection headings
            section = _classify_section(title)
            entity_kind = ''
            continue
        if typ != 7:
            continue
        rows = _table_rows(content)
        if len(rows) < 2:
            continue
        header = [_cell_text(c) for c in (rows[0].get('cells') or [])]
        has_rarity = any(_header_is_rarity(h) for h in header)
        has_drop = any(_header_is_drop_rate(h) for h in header)
        # Category table: Rarity | Unit | Supporters (no per-row Drop Rate column)
        if has_rarity and not has_drop:
            bucket = category.setdefault(section or 'other', {})
            for row in rows[1:]:
                cells = [_cell_text(c) for c in (row.get('cells') or [])]
                if len(cells) < 2:
                    continue
                rarity = cells[0]
                unit_pct = _parse_pct(cells[1]) if len(cells) > 1 else None
                supp_pct = _parse_pct(cells[2]) if len(cells) > 2 else None
                bucket[rarity] = {
                    'unit_pct': unit_pct,
                    'supporter_pct': supp_pct,
                }
            continue
        # Per-entity table
        name_idx = None
        rate_idx = None
        for i, h in enumerate(header):
            if _header_is_entity_name(h):
                name_idx = i
            if _header_is_drop_rate(h):
                rate_idx = i
        if name_idx is None or rate_idx is None:
            # fallback: last col rate, third or second col name
            rate_idx = len(header) - 1 if rate_idx is None else rate_idx
            name_idx = (2 if len(header) >= 4 else 1) if name_idx is None else name_idx
        for row in rows[1:]:
            cells = [_cell_text(c) for c in (row.get('cells') or [])]
            if rate_idx >= len(cells) or name_idx >= len(cells):
                continue
            name = cells[name_idx]
            pct = _parse_pct(cells[rate_idx])
            if not name or pct is None:
                continue
            # Skip mis-parsed rows where the "name" is itself a percentage.
            if _PCT_RE.fullmatch(name.strip()) or name.strip().endswith('%') and _parse_pct(name) is not None and len(name) < 16:
                continue
            slot = _ensure_name(name)
            key = section or 'other'
            # keep max if duplicate
            prev = slot.get(key)
            if prev is None or pct > prev:
                slot[key] = pct
            if entity_kind:
                slot['kind'] = entity_kind

    return {
        'notes': notes,
        'category': category,
        'by_name': by_name,
    }


def _official_gasha_dir() -> str:
    root = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(root, 'data', 'published', 'official_gasha')


def lang_num_for_lc(lc: str) -> int:
    return {'JA': 1, 'JP': 1, 'EN': 2, 'TW': 3, 'HK': 4}.get((lc or 'EN').upper(), 2)


@lru_cache(maxsize=8)
def load_official_gasha_list(lang_num: int):
    path = os.path.join(_official_gasha_dir(), f'gasha_list_{lang_num}.json')
    if not os.path.isfile(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return list(data.get('gasha_list') or [])
    except Exception:
        return []


@lru_cache(maxsize=64)
def load_official_proportion(gasha_id, lang_num: int):
    gid = str(gasha_id)
    path = os.path.join(_official_gasha_dir(), f'gasha_proportion_{gid}_{lang_num}.json')
    if not os.path.isfile(path):
        return None
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def drop_rates_for_gasha(gasha_id, lc='EN') -> dict | None:
    """Load official proportion for locale; fall back to EN if locale parse fails."""
    lang_num = lang_num_for_lc(lc)
    raw = load_official_proportion(gasha_id, lang_num)
    parsed = parse_gasha_proportion(raw) if raw else None
    if _rates_parsed_ok(parsed):
        return parsed
    if lang_num != 2:
        raw_en = load_official_proportion(gasha_id, 2)
        parsed_en = parse_gasha_proportion(raw_en) if raw_en else None
        if _rates_parsed_ok(parsed_en):
            return parsed_en
    return parsed if parsed else None


def _lookup_rate_by_name(by_name: dict, name: str, kind_hint: str = ''):
    if not name or not by_name:
        return None
    hit = by_name.get(name)
    if hit:
        return hit
    low = name.lower()
    # exact case-insensitive
    for k, v in by_name.items():
        if str(k).lower() == low:
            return v
    # Official tables often append " & Ship/Series" to supporter/character rows.
    # Prefer kind_hint when several names share a prefix.
    candidates = []
    for k, v in by_name.items():
        kl = str(k).lower()
        if kl.startswith(low + ' &') or kl.startswith(low + ' ('):
            candidates.append((k, v))
        elif low.startswith(kl + ' &') or low.startswith(kl + ' ('):
            candidates.append((k, v))
    if not candidates:
        return None
    if kind_hint:
        for _k, v in candidates:
            if v.get('kind') == kind_hint:
                return v
    return candidates[0][1]


def attach_drop_rates_to_featured(featured_items, rates: dict | None, *, kind_hint=''):
    """Add drop_pct / drop_pct_10th onto featured unit/char/supporter dicts (by name)."""
    if not rates or not featured_items:
        return featured_items
    by_name = rates.get('by_name') or {}
    for it in featured_items:
        if not isinstance(it, dict):
            continue
        name = str(it.get('name') or '').strip()
        hint = kind_hint or {
            'unit': 'unit',
            'character': 'supporter',
            'supporter': 'supporter',
        }.get(str(it.get('type') or ''), '')
        hit = _lookup_rate_by_name(by_name, name, hint)
        if not hit:
            continue
        p1 = hit.get('single_or_1to9')
        p10 = hit.get('multi_10th')
        pity = hit.get('pity_100')
        if p1 is not None:
            it['drop_pct'] = p1
        if p10 is not None:
            it['drop_pct_10th'] = p10
        elif p1 is not None:
            it['drop_pct_10th'] = p1
        if pity is not None:
            it['drop_pct_pity100'] = pity
    return featured_items


def category_summary(rates: dict | None) -> dict:
    if not rates:
        return {}
    cat = rates.get('category') or {}
    out = {}
    for key in ('single_or_1to9', 'multi_10th', 'pity_100'):
        bucket = cat.get(key)
        if bucket:
            out[key] = bucket
    return out


def build_pity_summary(rates: dict | None, featured_units=None, featured_chars=None, featured_supporters=None):
    """Explain 100th pull: guaranteed UR, featured share split, other UR equal share."""
    if not rates:
        return None
    by_name = rates.get('by_name') or {}
    featured_rows = []
    matched_keys = set()

    def _add_featured(items, kind_hint=''):
        for it in items or []:
            if not isinstance(it, dict):
                continue
            name = str(it.get('name') or '').strip()
            pct = it.get('drop_pct_pity100')
            hit = _lookup_rate_by_name(by_name, name, kind_hint) if name else None
            if pct is None and hit:
                pct = hit.get('pity_100')
            if pct is None:
                continue
            featured_rows.append({
                'name': name or str(it.get('id') or ''),
                'pct': float(pct),
                'id': it.get('id'),
                'type': it.get('type'),
            })
            if hit:
                for k, v in by_name.items():
                    if v is hit:
                        matched_keys.add(k)
                        break

    _add_featured(featured_units, 'unit')
    _add_featured(featured_chars)
    _add_featured(featured_supporters, 'supporter')

    other_rows = []
    for name, slot in by_name.items():
        if name in matched_keys:
            continue
        pct = slot.get('pity_100')
        if pct is None:
            continue
        if slot.get('kind') == 'supporter':
            continue
        other_rows.append({'name': name, 'pct': float(pct)})

    feat_sum = round(sum(r['pct'] for r in featured_rows), 6)
    other_sum = round(sum(r['pct'] for r in other_rows), 6)
    other_count = len(other_rows)
    other_each = None
    if other_count:
        pcts = [r['pct'] for r in other_rows]
        if max(pcts) - min(pcts) < 0.02:
            other_each = round(sum(pcts) / other_count, 6)

    ur_cat = ((rates.get('category') or {}).get('pity_100') or {}).get('UR') or {}
    guaranteed = ur_cat.get('unit_pct')
    if guaranteed is None:
        total = feat_sum + other_sum
        guaranteed = 100.0 if total >= 99.5 else (total if total > 0 else None)
    if not featured_rows and not other_rows and guaranteed is None:
        return None

    if other_count == 0 and feat_sum > 0 and guaranteed is not None:
        other_share = max(0.0, round(float(guaranteed) - feat_sum, 4))
    else:
        other_share = (
            round(other_sum, 4) if other_count
            else max(0.0, round(float(guaranteed or 100) - feat_sum, 4))
        )
    # Prefer clean complementary share when near 100%.
    if guaranteed is not None and abs((feat_sum + other_share) - float(guaranteed)) < 0.05:
        other_share = round(float(guaranteed) - feat_sum, 4)

    return {
        'guaranteed_ur': True,
        'guaranteed_pct': float(guaranteed) if guaranteed is not None else 100.0,
        'featured_share_pct': feat_sum,
        'featured': featured_rows,
        'other_share_pct': other_share,
        'other_count': other_count,
        'other_each_pct': other_each,
    }