#!/usr/bin/env python3
"""Scan ggen_db_videos/unit for eub_*.mp4 and uub_*.mp4; write data/lb_video_ids.json."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'lb_video_ids.json'
DEFAULT_VIDEOS = ROOT.parent / 'ggen_db_videos' / 'unit'
MASTER = ROOT / 'data' / 'EN' / 'master'


def _load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _weapon50_map(unit_weapon_rows):
    out = {}
    for row in unit_weapon_rows:
        if not isinstance(row, dict):
            continue
        uid = str(row.get('UnitId') or row.get('unitId') or '').strip()
        wbm = str(row.get('WeaponBattleMovieId') or row.get('weaponBattleMovieId') or '').strip()
        if wbm != '50':
            continue
        ubmid = str(row.get('UnitBattleMovieId') or row.get('unitBattleMovieId') or '').strip()
        if uid and ubmid:
            out[uid] = ubmid
    return out


def audit_manifest(ids, unit_rows, unit_weapon_rows):
    """Report units whose weapon-50 movie id differs from bromide and manifest coverage."""
    w50 = _weapon50_map(unit_weapon_rows)
    units = {str(u.get('Id')): u for u in unit_rows if isinstance(u, dict) and u.get('Id')}
    manifest = set(ids)
    mismatches = []
    missing = []
    for uid, u in sorted(units.items()):
        bid = str(u.get('BromideResourceId') or '').strip()
        if not bid:
            continue
        is_ult = bool(u.get('IsUltimateDevelopment'))
        prefix = 'uub_' if is_ult else 'eub_'
        w50_id = w50.get(uid, '')
        bromide_mid = f'{prefix}{bid}'
        w50_mid = f'{prefix}{w50_id}' if w50_id else ''
        if w50_id and w50_id != bid:
            resolved = w50_mid if w50_mid in manifest else (bromide_mid if bromide_mid in manifest else '')
            mismatches.append((uid, bid, w50_id, resolved))
        resolved = w50_mid if w50_mid in manifest else (bromide_mid if bromide_mid in manifest else '')
        if not resolved and not u.get('IsNotLimitBreakReleasedMovie'):
            if w50_id or bid:
                missing.append((uid, bid, w50_id))
    return mismatches, missing


def main():
    videos_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_VIDEOS
    if not videos_dir.is_dir():
        print(f'Videos dir not found: {videos_dir}', file=sys.stderr)
        sys.exit(1)
    ids = []
    for p in videos_dir.glob('*.mp4'):
        stem = p.stem.replace('_40534656', '')
        if stem.startswith('eub_'):
            ids.append(stem)
        elif stem.startswith('uub_') and stem.endswith('02'):
            # Ultimate MLB cinematics: finalized form only (resource id ends with 02).
            ids.append(stem)
    ids = sorted(set(ids))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(ids, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(ids)} movie ids to {OUT}')

    if MASTER.is_dir():
        unit_rows = _load_json(MASTER / 'm_unit.json')
        uw_rows = _load_json(MASTER / 'm_unit_weapon.json')
        mismatches, missing = audit_manifest(ids, unit_rows, uw_rows)
        if mismatches:
            print(f'Weapon-50 vs bromide mismatches ({len(mismatches)}):')
            for uid, bid, w50_id, resolved in mismatches:
                print(f'  {uid}: bromide={bid} weapon50={w50_id} resolved={resolved or "(none)"}')
        else:
            print('Weapon-50 vs bromide: no mismatches needing alternate ids')
        if missing:
            print(f'Units without manifest video ({len(missing)} shown, first 10):')
            for row in missing[:10]:
                print(f'  {row[0]}: bromide={row[1]} weapon50={row[2] or "-"}')


if __name__ == '__main__':
    main()
