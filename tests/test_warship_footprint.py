"""Warship (OccupiedAreaId 3) footprint orientation for stage maps."""

import unittest


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
        cells = cells_2x3(ox, ay)
    else:
        oy = ay - 2 if d == '2' else ay - 1
        cells = [
            {'x': ax, 'y': oy}, {'x': ax + 1, 'y': oy},
            {'x': ax, 'y': oy + 1}, {'x': ax + 1, 'y': oy + 1},
            {'x': ax, 'y': oy + 2}, {'x': ax + 1, 'y': oy + 2},
        ]
    if not for_buff and d in ('1', '3'):
        cells = [{'x': c['x'], 'y': c['y'] + 1} for c in cells]
    return cells


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
    def test_archangel_west_buff_vs_display(self):
        buff = _warship_footprint_cells(16, 9, 3, for_buff=True)
        display = _warship_footprint_cells(16, 9, 3, for_buff=False)
        self.assertEqual(_footprint_bbox(buff), (15, 9, 3, 2))
        self.assertEqual(_footprint_bbox(display), (15, 10, 3, 2))
        self.assertEqual(_warship_map_origin(16, 9, 3), {'x': 15, 'y': 10})

    def test_minerva_east_display_matches_icon_row(self):
        buff = _warship_footprint_cells(4, 9, 1, for_buff=True)
        display = _warship_footprint_cells(4, 9, 1, for_buff=False)
        self.assertEqual(_footprint_bbox(buff), (2, 9, 3, 2))
        self.assertEqual(_footprint_bbox(display), (2, 10, 3, 2))
        origin = _warship_map_origin(4, 9, 1)
        self.assertEqual(origin, {'x': 4, 'y': 10})
        self.assertIn(origin, display)

    def test_ptolemy_down_stage_90520014(self):
        """Down-facing icon at anchor y+1 (north row of footprint), occupancy unchanged."""
        display = _warship_footprint_cells(3, 17, 4, for_buff=False)
        buff = _warship_footprint_cells(3, 17, 4, for_buff=True)
        self.assertEqual(_footprint_bbox(display), (3, 16, 2, 3))
        self.assertEqual(buff, display)
        origin = _warship_map_origin(3, 17, 4)
        self.assertEqual(origin, {'x': 3, 'y': 18})
        self.assertIn(origin, display)

    def test_horizontal_display_shift_only_when_not_buff(self):
        for x, y, d in ((16, 9, 3), (4, 9, 1)):
            buff = _warship_footprint_cells(x, y, d, for_buff=True)
            display = _warship_footprint_cells(x, y, d, for_buff=False)
            self.assertEqual(len(display), 6)
            for b, disp in zip(buff, display):
                self.assertEqual(disp['x'], b['x'])
                self.assertEqual(disp['y'], b['y'] + 1)


if __name__ == '__main__':
    unittest.main()
