"""Warship (OccupiedAreaId 3) footprint + icon alignment for stage maps."""

import json
import unittest
from pathlib import Path


def _warship_footprint_cells(x, y, direction, for_buff=False):
    ax = int(x)
    ay = int(y)
    d = str(direction or '1')

    def cells_2x3(ox, oy):
        return [
            {'x': ox, 'y': oy}, {'x': ox + 1, 'y': oy}, {'x': ox + 2, 'y': oy},
            {'x': ox, 'y': oy + 1}, {'x': ox + 1, 'y': oy + 1}, {'x': ox + 2, 'y': oy + 1},
        ]

    if d in ('1', '3'):
        ox = ax - 2 if d == '1' else ax - 1
        return cells_2x3(ox, ay)
    oy = ay - 2 if d == '2' else ay - 1
    return [
        {'x': ax, 'y': oy}, {'x': ax + 1, 'y': oy},
        {'x': ax, 'y': oy + 1}, {'x': ax + 1, 'y': oy + 1},
        {'x': ax, 'y': oy + 2}, {'x': ax + 1, 'y': oy + 2},
    ]


def _map_unit_icon_origin(cells, direction):
    if not cells:
        return None
    xs = [c['x'] for c in cells]
    ys = [c['y'] for c in cells]
    mn_x, mx_x = min(xs), max(xs)
    mn_y, mx_y = min(ys), max(ys)
    d = str(direction or '1')
    if d == '1':
        return {'x': mx_x, 'y': mx_y}
    if d == '3':
        return {'x': mn_x, 'y': mx_y}
    if d == '2':
        return {'x': mn_x, 'y': mx_y}
    if d == '4':
        return {'x': mn_x, 'y': mx_y}
    return {'x': mn_x, 'y': mx_y}


def _footprint_bbox(cells):
    xs = [c['x'] for c in cells]
    ys = [c['y'] for c in cells]
    return (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


def _assert_icon_matches_cells(test, cells, direction):
    origin = _map_unit_icon_origin(cells, direction)
    cell_set = {(c['x'], c['y']) for c in cells}
    test.assertIn((origin['x'], origin['y']), cell_set)


class TestWarshipFootprint(unittest.TestCase):
    def test_stage_11000418_archangel_west(self):
        cells = _warship_footprint_cells(16, 9, 3)
        self.assertEqual(_footprint_bbox(cells), (15, 9, 3, 2))
        origin = _map_unit_icon_origin(cells, 3)
        self.assertEqual(origin, {'x': 15, 'y': 10})
        _assert_icon_matches_cells(self, cells, 3)

    def test_stage_11000418_minerva_east(self):
        cells = _warship_footprint_cells(4, 9, 1)
        self.assertEqual(_footprint_bbox(cells), (2, 9, 3, 2))
        origin = _map_unit_icon_origin(cells, 1)
        self.assertEqual(origin, {'x': 4, 'y': 10})
        _assert_icon_matches_cells(self, cells, 1)

    def test_stage_90520014_ptolemy_down(self):
        cells = _warship_footprint_cells(3, 17, 4)
        self.assertEqual(_footprint_bbox(cells), (3, 16, 2, 3))
        origin = _map_unit_icon_origin(cells, 4)
        self.assertEqual(origin, {'x': 3, 'y': 18})
        _assert_icon_matches_cells(self, cells, 4)

    def test_buff_and_display_footprint_identical(self):
        for x, y, d in ((16, 9, 3), (4, 9, 1), (3, 17, 4)):
            buff = _warship_footprint_cells(x, y, d, for_buff=True)
            display = _warship_footprint_cells(x, y, d, for_buff=False)
            self.assertEqual(buff, display)

    def test_all_en_oa3_warships_icon_origin_on_footprint(self):
        root = Path(__file__).resolve().parent.parent / 'data' / 'EN' / 'master'
        npcs = json.loads((root / 'm_map_npc.json').read_text(encoding='utf-8'))
        npc_unit = {}
        for row in json.loads((root / 'm_map_npc_unit.json').read_text(encoding='utf-8')):
            npc_unit.setdefault(str(row['MapNpcId']), []).append(row)
        units = {str(u['Id']): u for u in json.loads((root / 'm_unit.json').read_text(encoding='utf-8'))}
        for n in npcs:
            nu = npc_unit.get(str(n['Id']))
            if not nu:
                continue
            uid = str(nu[0].get('UnitId', 0))
            if units.get(uid, {}).get('OccupiedAreaId') != 3:
                continue
            d = str(n.get('DirectionTypeIndex', 1))
            cells = _warship_footprint_cells(n['X'], n['Y'], d)
            _assert_icon_matches_cells(self, cells, d)


if __name__ == '__main__':
    unittest.main()
