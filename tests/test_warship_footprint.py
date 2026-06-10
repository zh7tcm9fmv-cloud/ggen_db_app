"""Warship (OccupiedAreaId 3) footprint orientation for stage maps."""

import unittest


def _warship_footprint_cells(x, y, direction):
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
        return {'x': mn_x, 'y': mn_y}
    return {'x': mn_x, 'y': mx_y}


def _footprint_bbox(cells):
    xs = [c['x'] for c in cells]
    ys = [c['y'] for c in cells]
    return (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


class TestWarshipFootprint(unittest.TestCase):
    def test_archangel_west_cells_match_buff_anchor(self):
        """Occupied tiles y=9–10 (1-based 10–11); icon origin at southwest bow corner."""
        cells = _warship_footprint_cells(16, 9, 3)
        self.assertEqual(_footprint_bbox(cells), (15, 9, 3, 2))
        origin = _map_unit_icon_origin(cells, 3)
        self.assertEqual(origin, {'x': 15, 'y': 10})
        self.assertIn(origin, cells)

    def test_minerva_east_cells_match_buff_anchor(self):
        cells = _warship_footprint_cells(4, 9, 1)
        self.assertEqual(_footprint_bbox(cells), (2, 9, 3, 2))
        self.assertIn({'x': 4, 'y': 9}, cells)
        origin = _map_unit_icon_origin(cells, 1)
        self.assertEqual(origin, {'x': 4, 'y': 10})
        self.assertIn(origin, cells)

    def test_ptolemy_down_stage_90520014(self):
        """Stage 90520014 warship at (3, 17) facing down — icon at bow (3, 16), not stern."""
        cells = _warship_footprint_cells(3, 17, 4)
        self.assertEqual(_footprint_bbox(cells), (3, 16, 2, 3))
        origin = _map_unit_icon_origin(cells, 4)
        self.assertEqual(origin, {'x': 3, 'y': 16})
        self.assertIn(origin, cells)
        self.assertNotEqual(origin, {'x': 3, 'y': 18})

    def test_all_directions_origin_lies_on_footprint(self):
        anchors = [(16, 9), (4, 9), (10, 12), (3, 17)]
        for x, y in anchors:
            for d in ('1', '2', '3', '4'):
                cells = _warship_footprint_cells(x, y, d)
                origin = _map_unit_icon_origin(cells, d)
                self.assertIn(origin, cells, msg=f'anchor ({x},{y}) dir {d}')


if __name__ == '__main__':
    unittest.main()
