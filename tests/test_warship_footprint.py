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


def _warship_map_origin(x, y, direction):
    ax = int(x)
    ay = int(y)
    d = str(direction or '1')
    if d == '3':
        return {'x': ax - 1, 'y': ay + 1}
    if d == '1':
        return {'x': ax, 'y': ay + 1}
    if d == '2':
        return {'x': ax, 'y': ay}
    if d == '4':
        return {'x': ax, 'y': ay + 1}
    return {'x': ax, 'y': ay + 1}


def _footprint_bbox(cells):
    xs = [c['x'] for c in cells]
    ys = [c['y'] for c in cells]
    return (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


class TestWarshipFootprint(unittest.TestCase):
    def test_archangel_west_cells_match_buff_anchor(self):
        """Occupied tiles y=9–10 (1-based 10–11); icon origin one row north at y=10."""
        cells = _warship_footprint_cells(16, 9, 3)
        self.assertEqual(_footprint_bbox(cells), (15, 9, 3, 2))
        self.assertEqual(_warship_map_origin(16, 9, 3), {'x': 15, 'y': 10})

    def test_minerva_east_cells_match_buff_anchor(self):
        cells = _warship_footprint_cells(4, 9, 1)
        self.assertEqual(_footprint_bbox(cells), (2, 9, 3, 2))
        self.assertIn({'x': 4, 'y': 9}, cells)
        self.assertEqual(_warship_map_origin(4, 9, 1), {'x': 4, 'y': 10})


if __name__ == '__main__':
    unittest.main()
