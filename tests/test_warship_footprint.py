"""Warship (OccupiedAreaId 3) footprint orientation for stage maps."""

import unittest


def _warship_footprint_cells(x, y, direction, for_buff=False):
    """Mirror of app.get_warship_footprint_cells — keep in sync."""
    ax = int(x)
    ay = int(y)
    d = str(direction or '1')
    y_off = 0 if for_buff else 1

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
        return cells_2x3(ox, ay + y_off)
    oy = ay - 2 if d == '2' else ay - 1
    return cells_3x2(ax, oy + y_off)


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
    def test_archangel_west_display_one_row_north_of_buff(self):
        """Display footprint is one row above buff anchor (EN Y=9 → ship rows 10–11)."""
        display = _warship_footprint_cells(16, 9, 3)
        buff = _warship_footprint_cells(16, 9, 3, for_buff=True)
        self.assertEqual(_footprint_bbox(display)[1], 10)
        self.assertEqual(_footprint_bbox(buff)[1], 9)
        self.assertEqual(_warship_map_origin(16, 9, 3), {'x': 15, 'y': 10})

    def test_minerva_east_display_one_row_north_of_buff(self):
        display = _warship_footprint_cells(4, 9, 1)
        buff = _warship_footprint_cells(4, 9, 1, for_buff=True)
        min_x, min_y, w, h = _footprint_bbox(display)
        self.assertEqual((min_x, min_y, w, h), (2, 10, 3, 2))
        self.assertIn({'x': 4, 'y': 10}, display)
        self.assertIn({'x': 4, 'y': 9}, buff)
        self.assertEqual(_warship_map_origin(4, 9, 1), {'x': 4, 'y': 10})


if __name__ == '__main__':
    unittest.main()
