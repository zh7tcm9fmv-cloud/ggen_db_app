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
        ox = ax - 2 if d == '1' else ax
        return cells_2x3(ox, ay)
    oy = ay - 2 if d == '2' else ay
    return cells_3x2(ax, oy)


def _footprint_bbox(cells):
    xs = [c['x'] for c in cells]
    ys = [c['y'] for c in cells]
    return (min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


class TestWarshipFootprint(unittest.TestCase):
    def test_west_anchor_is_bow_top_left(self):
        cells = _warship_footprint_cells(16, 9, 3)
        min_x, min_y, w, h = _footprint_bbox(cells)
        self.assertEqual((min_x, min_y, w, h), (16, 9, 3, 2))

    def test_east_anchor_is_bow_top_right(self):
        cells = _warship_footprint_cells(4, 9, 1)
        min_x, min_y, w, h = _footprint_bbox(cells)
        self.assertEqual((min_x, min_y, w, h), (2, 9, 3, 2))
        self.assertIn({'x': 4, 'y': 9}, cells)

    def test_up_down_are_vertical_2x3(self):
        for d in ('2', '4'):
            cells = _warship_footprint_cells(10, 5, d)
            _min_x, _min_y, w, h = _footprint_bbox(cells)
            self.assertEqual((w, h), (2, 3))


if __name__ == '__main__':
    unittest.main()
