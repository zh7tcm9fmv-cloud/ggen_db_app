"""Escape vs reinforcement: NPC pilot Escape ability (not only unique-name sequels)."""

import importlib
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


def _live_stage_ids(A):
    out = set()
    for mapping in (
        A.eternal_stage_map,
        A.main_scenario_stage_challenge_map,
        A.map_event_score_attack_stage_map,
        A.special_event_stage_map,
    ):
        if mapping:
            out.update(A.normalize_id(k) for k in mapping)
    if A.tower_event_stage_map:
        for tes in A.tower_event_stage_map.values():
            sid = A.normalize_id((tes or {}).get('stage_id'))
            if sid != '0':
                out.add(sid)
    if A.scenario_stage_map and A.stage_map:
        for sid in A.stage_map:
            if sid in A.scenario_stage_map:
                out.add(A.normalize_id(sid))
    return out


def _light_map_units(A, npc_entries, challenge_stage_id=None):
    units = []
    for npc in npc_entries or []:
        nid = npc.get('id')
        if not nid:
            continue
        nc = A._resolve_map_npc_character_rows(
            A.normalize_id(nid), challenge_stage_id=challenge_stage_id,
        )
        ce = nc[0] if nc else None
        bst = A.normalize_id(npc.get('battle_side_type', '2'), '2')
        if bst == '1':
            side = 'guest'
        elif bst == '4':
            side = 'friendly'
        else:
            side = 'enemy'
        me = {
            'npc_id': nid,
            'x': npc.get('x', 0),
            'y': npc.get('y', 0),
            'side': side,
            'is_initially_placed': bool(npc.get('is_initially_placed', True)),
        }
        if ce:
            cid = A.normalize_id(ce.get('character_id', '0'))
            if cid != '0':
                me['character_id'] = cid
            if A._npc_ability_set_has_pilot_escape(ce.get('ability_set_id', '0')):
                me['pilot_has_escape'] = True
        units.append(me)
    return units


class TestStageMapEscapeVsReinforcement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault('GGEN_SKIP_WARMUP', '1')
        cls.app = importlib.import_module('app')

    def test_pilot_escape_pairs_same_character_nearest(self):
        A = self.app
        units = [
            {'npc_id': 'p1', 'x': 7, 'y': 8, 'side': 'enemy', 'is_initially_placed': True,
             'character_id': '1300000101', 'pilot_has_escape': True},
            {'npc_id': 's1', 'x': 8, 'y': 8, 'side': 'enemy', 'is_initially_placed': False,
             'character_id': '1300000101'},
            {'npc_id': 'r1', 'x': 1, 'y': 1, 'side': 'enemy', 'is_initially_placed': False,
             'character_id': '999'},
        ]
        rows = [{'id': u['npc_id'], 'x': u['x'], 'y': u['y'], 'NpcUniqueName': ''} for u in units]
        A.pair_map_npc_escape_spawns(units, rows)
        by = {u['npc_id']: u for u in units}
        self.assertEqual(by['p1'].get('escape_spawn_npc_id'), 's1')
        self.assertEqual(by['s1'].get('escape_from_npc_id'), 'p1')
        self.assertIsNone(by['r1'].get('escape_from_npc_id'))

    def test_seed_meteor_stage_is_escape_not_reinforcement(self):
        A = self.app
        mse = A.map_stage_lookup.get('90520009') or {}
        nt = A.map_npc_by_map_stage.get(mse.get('map_stage_id'), [])
        units = _light_map_units(A, nt)
        A.pair_map_npc_escape_spawns(units, nt)
        by = {str(u.get('npc_id')): u for u in units}
        self.assertEqual(by['905200000902000001'].get('escape_spawn_npc_id'), '905200000902000005')
        self.assertEqual(by['905200000902000002'].get('escape_spawn_npc_id'), '905200000902000006')
        self.assertTrue(by['905200000902000005'].get('escape_from_npc_id'))
        self.assertTrue(by['905200000902000006'].get('escape_from_npc_id'))

    def test_live_stages_pilot_escape_has_same_char_spawn_paired(self):
        A = self.app
        missed = []
        checked = 0
        for sid in sorted(_live_stage_ids(A)):
            mse = A.map_stage_lookup.get(sid) or {}
            msid = mse.get('map_stage_id')
            if not msid:
                continue
            nt = A.map_npc_by_map_stage.get(msid, [])
            if not nt:
                continue
            ch_sid = sid if sid in (A.main_scenario_stage_challenge_map or {}) else None
            units = _light_map_units(A, nt, challenge_stage_id=ch_sid)
            if not any(u.get('pilot_has_escape') for u in units):
                continue
            checked += 1
            A.pair_map_npc_escape_spawns(units, nt)
            unplaced = [u for u in units if not u.get('is_initially_placed', True)]
            for par in units:
                if not par.get('pilot_has_escape') or not par.get('is_initially_placed', True):
                    continue
                cid = A.normalize_id(par.get('character_id'))
                same = [
                    u for u in unplaced
                    if A.normalize_id(u.get('character_id')) == cid and not u.get('pilot_has_escape')
                ]
                if same and not par.get('escape_spawn_npc_id'):
                    missed.append((sid, par.get('npc_id'), cid, len(same)))
        self.assertGreater(checked, 0)
        self.assertEqual(missed, [], msg=f'unpaired Escape pilots: {missed[:20]}')


if __name__ == '__main__':
    unittest.main()
