#!/usr/bin/env python3
"""Diff two MasterData folders -> data/published/recent_adjustments.json (7-day UI highlight).

Does not import app.py (avoids full DB load).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_json(path):
    if not os.path.isfile(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def extract_data_list(data):
    if data is None:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for k in ('data', 'Data', 'list', 'List', 'rows', 'Rows'):
            if isinstance(data.get(k), list):
                return data[k]
        # common wrap: {"xxx":[...]}
        for v in data.values():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return v
    return []


def normalize_id(v, default='0'):
    if v is None:
        return default
    s = str(v).strip()
    return s if s else default


def create_unit_status_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId') or item.get('id') or item.get('Id'))
        if uid == '0':
            continue
        mhp = int(item.get('MaxHp') or 0)
        spmhp = int(item.get('SpMaxHp') or item.get('MaxHp') or 0)
        men = int(item.get('MaxEn') or 0)
        spmen = int(item.get('SpMaxEn') or item.get('MaxEn') or 0)
        matk = int(item.get('MaxAttack') or 0)
        spmatk = int(item.get('SpMaxAttack') or item.get('MaxAttack') or 0)
        mdef = int(item.get('MaxDefense') or 0)
        spmdef = int(item.get('SpMaxDefense') or item.get('MaxDefense') or 0)
        mmob = int(item.get('MaxMobility') or 0)
        spmmob = int(item.get('SpMaxMobility') or item.get('MaxMobility') or 0)
        mmov = int(item.get('MaxMovement') or 0)
        spmmov = int(item.get('SpMaxMovement') or item.get('MaxMovement') or 0)
        lookup[uid] = {
            'HP': (int(item.get('Hp') or 0), mhp, spmhp),
            'EN': (int(item.get('En') or 0), men, spmen),
            'Attack': (int(item.get('Attack') or 0), matk, spmatk),
            'Defense': (int(item.get('Defense') or 0), mdef, spmdef),
            'Mobility': (int(item.get('Mobility') or 0), mmob, spmmob),
            'Move': (mmov, spmmov),
        }
    return lookup


def create_char_status_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        cid = normalize_id(item.get('CharacterId') or item.get('characterId') or item.get('id') or item.get('Id'))
        if cid == '0':
            continue

        def cv(k, mk, smk):
            v = int(item.get(k) or 0)
            m = int(item.get(mk) or 0)
            sm = int(item.get(smk) or item.get(mk) or 0)
            return (v, m, sm)

        lookup[cid] = {
            'Ranged': cv('Ranged', 'MaxRanged', 'SpMaxRanged'),
            'Melee': cv('Melee', 'MaxMelee', 'SpMaxMelee'),
            'Defense': cv('Defense', 'MaxDefense', 'SpMaxDefense'),
            'Reaction': cv('Reaction', 'MaxReaction', 'SpMaxReaction'),
            'Awaken': cv('Awaken', 'MaxAwaken', 'SpMaxAwaken'),
        }
    return lookup


def create_unit_lineage_link_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId'))
        lid = normalize_id(item.get('LineageId') or item.get('lineageId'))
        if uid != '0' and lid != '0':
            lookup.setdefault(uid, [])
            if lid not in lookup[uid]:
                lookup[uid].append(lid)
    return lookup


def create_char_lineage_link_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        cid = normalize_id(item.get('CharacterId') or item.get('characterId'))
        lid = normalize_id(item.get('LineageId') or item.get('lineageId'))
        if cid != '0' and lid != '0':
            lookup.setdefault(cid, [])
            if lid not in lookup[cid]:
                lookup[cid].append(lid)
    return lookup


def create_unit_ability_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId'))
        aid = normalize_id(item.get('AbilityId') or item.get('abilityId'))
        sort = int(item.get('SortOrder') or 0)
        if uid != '0' and aid != '0':
            lookup.setdefault(uid, []).append({'id': aid, 'sort': sort})
    for k in lookup:
        lookup[k].sort(key=lambda x: x['sort'])
    return lookup


def create_char_ability_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        cid = normalize_id(item.get('CharacterId') or item.get('characterId'))
        aid = normalize_id(item.get('AbilityId') or item.get('abilityId'))
        sp = normalize_id(item.get('SpAbilityId') or item.get('spAbilityId') or '0')
        sort = int(item.get('SortOrder') or 0)
        if cid == '0':
            continue
        eff = sp if sp and sp != '0' else aid
        if eff and eff != '0':
            lookup.setdefault(cid, []).append({'sort': sort, 'id': eff})
    out = {}
    for cid, rows in lookup.items():
        rows.sort(key=lambda x: x['sort'])
        out[cid] = [r['id'] for r in rows]
    return out


def create_unit_weapon_map(d):
    lookup = {}
    for item in extract_data_list(d):
        if not isinstance(item, dict):
            continue
        uid = normalize_id(item.get('UnitId') or item.get('unitId'))
        wid = normalize_id(item.get('WeaponId') or item.get('weaponId') or item.get('Id') or item.get('id'))
        sort = int(item.get('SortOrder') or item.get('Slot') or 0)
        if uid != '0' and wid != '0':
            lookup.setdefault(uid, []).append({'id': wid, 'sort': sort})
    for k in lookup:
        lookup[k].sort(key=lambda x: x['sort'])
    return lookup


def _diff_stats(old_map, new_map):
    changed = {}
    for eid, nrow in new_map.items():
        orow = old_map.get(eid)
        if orow is None:
            continue
        keys = [sk for sk in nrow if orow.get(sk) != nrow.get(sk)]
        if keys:
            changed[eid] = keys
    return changed


def _diff_tags(old_map, new_map):
    changed = {}
    for eid, ntags in new_map.items():
        otags = old_map.get(eid) or []
        if list(otags) != list(ntags):
            added = [t for t in ntags if t not in otags]
            changed[eid] = added or list(ntags)
    return changed


def _diff_id_lists(old_map, new_map):
    changed = {}
    for eid, na in new_map.items():
        oa = old_map.get(eid) or []
        na_ids = [str(x.get('id') if isinstance(x, dict) else x) for x in na]
        oa_ids = [str(x.get('id') if isinstance(x, dict) else x) for x in oa]
        if oa_ids != na_ids:
            added = [x for x in na_ids if x not in oa_ids]
            changed[eid] = added or na_ids
    return changed


def load_side(master_dir: str):
    return {
        'unit_status': create_unit_status_map(load_json(os.path.join(master_dir, 'm_unit_status.json'))),
        'char_status': create_char_status_map(load_json(os.path.join(master_dir, 'm_character_status.json'))),
        'unit_tags': create_unit_lineage_link_map(load_json(os.path.join(master_dir, 'm_unit_lineage.json'))),
        'char_tags': create_char_lineage_link_map(load_json(os.path.join(master_dir, 'm_character_lineage.json'))),
        'unit_abil': create_unit_ability_map(load_json(os.path.join(master_dir, 'm_unit_ability_set.json'))),
        'char_abil': create_char_ability_map(load_json(os.path.join(master_dir, 'm_character_ability_set.json'))),
        'unit_wpn': create_unit_weapon_map(load_json(os.path.join(master_dir, 'm_unit_weapon.json'))),
    }


def merge_entity(bucket, eid, **parts):
    row = bucket.setdefault(eid, {})
    for k, v in parts.items():
        if v:
            row[k] = v


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--old', required=True)
    ap.add_argument('--new', required=True)
    ap.add_argument('--patch-date', default='')
    ap.add_argument('--days', type=int, default=7)
    ap.add_argument('--out', default=os.path.join(ROOT, 'data', 'published', 'recent_adjustments.json'))
    args = ap.parse_args()
    old_dir = os.path.abspath(args.old)
    new_dir = os.path.abspath(args.new)
    if not os.path.isdir(old_dir) or not os.path.isdir(new_dir):
        print('Missing master folders', file=sys.stderr)
        return 1

    patch = (args.patch_date or '').strip()
    if not patch:
        m = os.path.basename(new_dir)
        if 'MasterData_' in m:
            patch = m.split('MasterData_', 1)[1][:10]
        else:
            patch = date.today().isoformat()
    until = (datetime.strptime(patch, '%Y-%m-%d').date() + timedelta(days=args.days)).isoformat()

    print(f'Diff {os.path.basename(old_dir)} -> {os.path.basename(new_dir)}', flush=True)
    a = load_side(old_dir)
    b = load_side(new_dir)

    u_stats = _diff_stats(a['unit_status'], b['unit_status'])
    c_stats = _diff_stats(a['char_status'], b['char_status'])
    u_tags = _diff_tags(a['unit_tags'], b['unit_tags'])
    c_tags = _diff_tags(a['char_tags'], b['char_tags'])
    u_abil = _diff_id_lists(a['unit_abil'], b['unit_abil'])
    c_abil = _diff_id_lists(a['char_abil'], b['char_abil'])
    u_wpn = _diff_id_lists(a['unit_wpn'], b['unit_wpn'])

    units = {}
    chars = {}
    for eid, keys in u_stats.items():
        merge_entity(units, eid, stats=keys)
    for eid, tags in u_tags.items():
        merge_entity(units, eid, tags=tags)
    for eid, aids in u_abil.items():
        merge_entity(units, eid, abilities=aids)
    for eid, wids in u_wpn.items():
        merge_entity(units, eid, weapons=wids)

    for eid, keys in c_stats.items():
        merge_entity(chars, eid, stats=keys)
    for eid, tags in c_tags.items():
        merge_entity(chars, eid, tags=tags)
    for eid, aids in c_abil.items():
        merge_entity(chars, eid, abilities=aids)

    payload = {
        'version': 1,
        'patch_date': patch,
        'until': until,
        'source_old': os.path.basename(old_dir),
        'source_new': os.path.basename(new_dir),
        'units': units,
        'characters': chars,
        'counts': {
            'units': len(units),
            'characters': len(chars),
            'unit_stats': len(u_stats),
            'char_stats': len(c_stats),
            'unit_tags': len(u_tags),
            'char_tags': len(c_tags),
            'unit_abilities': len(u_abil),
            'char_abilities': len(c_abil),
            'unit_weapons': len(u_wpn),
        },
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
    print(json.dumps(payload['counts'], indent=2))
    print(f'Wrote {args.out} (until {until})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
