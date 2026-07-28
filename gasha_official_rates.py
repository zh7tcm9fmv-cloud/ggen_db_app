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
    t = (title or '').lower()
    if '100th' in t or 'guaranteed ur' in t:
        return 'pity_100'
    if '10th' in t and '1st' not in t:
        return 'multi_10th'
    if '1st' in t or 'use 1 time' in t or '1 time' in t:
        return 'single_or_1to9'
    return 'other'


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
            # e.g. "Use 10 times (10th)Drop Rate"
            section = _classify_section(content)
            entity_kind = ''
            continue
        if typ == 8:
            title = content.strip()
            low = title.lower()
            if low in ('unit', 'units'):
                entity_kind = 'unit'
                continue
            if low in ('supporters', 'supporter'):
                entity_kind = 'supporter'
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
        header = [_cell_text(c).lower() for c in (rows[0].get('cells') or [])]
        # Category table: Rarity | Unit | Supporters
        if 'rarity' in header and 'drop rate' not in header:
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
            if h in ('units', 'unit', 'supporters', 'supporter'):
                name_idx = i
            if h == 'drop rate':
                rate_idx = i
        if name_idx is None or rate_idx is None:
            # fallback: last col rate, third or second col name
            rate_idx = len(header) - 1
            name_idx = 2 if len(header) >= 4 else 1
        for row in rows[1:]:
            cells = [_cell_text(c) for c in (row.get('cells') or [])]
            if rate_idx >= len(cells) or name_idx >= len(cells):
                continue
            name = cells[name_idx]
            pct = _parse_pct(cells[rate_idx])
            if not name or pct is None:
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
    lang_num = lang_num_for_lc(lc)
    raw = load_official_proportion(gasha_id, lang_num)
    if raw is None and lang_num != 2:
        raw = load_official_proportion(gasha_id, 2)
    if raw is None:
        return None
    return parse_gasha_proportion(raw)


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
