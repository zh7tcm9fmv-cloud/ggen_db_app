"""Warship (OccupiedAreaId 3) footprint orientation for stage maps."""

import unittest


def _warship_footprint_cells(x, y, direction):
    """Mirror of app.get_warship_footprint_cells — keep in sync."""
    ax = int(x)
    ay = int(y)
    d = str(direction or '1')

    def cells_3x2(ox, oy):
        return [
            {'x': ox, 'y': oy}, {'x': ox + 1, 'y': oy},
            {'x': ox, 'y': oy + 1}, {'x': ox + 1, 'y': oy + 1},
            {'x': ox, 'y': oy + 2}, {'x': ox + 1, 'y': oy + 2},
        ]

    def cells_2x3(ox, oy):
        return [
            {'x': ox, 'y': oy}, {'x': ox + 1, 'y': oy}, {'x': ox + 2, 'y': oy},
            {'x': ox, 'y': oy + 1}, {'x': ox + 1, 'y': oy + 1}, {'x': ox + 2, 'y': oy + 1},
        ]

    if d in ('1', '3'):
        ox = ax - 2 if d == '1' else ax - 1
        return cells_2x3(ox, ay)
    oy = ay - 2 if d == '2' else ay - 1
    return cells_3x2(ax, oy)


def _warship_map_origin(x, y, direction):
    ax = int(x)
    ay = int(y)
    d = str(direction or '1')
    if d == '3':
        return {'x': ax - 1, 'y': ay}
    if d == '1':
        return {'x': ax, 'y': ay}
    if d == '2':
        return {'x': ax, 'y': ay - 1}
    if d == '4':
        return {'x': ax, 'y': ay}
    return {'x': ax, 'y': ay}


def _footprint_bbox(cells):
    xs = [c['x'] for c in cells]
    ys = [c['y'] for c in cells]
    return (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


class TestWarshipFootprint(unittest.TestCase):
    def test_archangel_west_pivot_anchor(self):
        """EN m_map_npc: Murrue X=16 Y=9 Direction=3 — bow one cell west of pivot."""
        cells = _warship_footprint_cells(16, 9, 3)
        min_x, min_y, w, h = _footprint_bbox(cells)
        self.assertEqual((min_x, min_y, w, h), (15, 9, 3, 2))
        origin = _warship_map_origin(16, 9, 3)
        self.assertEqual(origin, {'x': 15, 'y': 9})

    def test_minerva_east_bow_anchor(self):
        """EN m_map_npc: Talia X=4 Y=9 Direction=1 — bow at anchor, hull west."""
        cells = _warship_footprint_cells(4, 9, 1)
        min_x, min_y, w, h = _footprint_bbox(cells)
        self.assertEqual((min_x, min_y, w, h), (2, 9, 3, 2))
        self.assertIn({'x': 4, 'y': 9}, cells)
        origin = _warship_map_origin(4, 9, 1)
        self.assertEqual(origin, {'x': 4, 'y': 9})


if __name__ == '__main__':
    unittest.main()
