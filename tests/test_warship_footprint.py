"""Warship (OccupiedAreaId 3) footprint orientation for stage maps."""

import unittest


def _warship_footprint_cells(x, y, direction):
    """Mirror of app.get_warship_footprint_cells — keep in sync."""
    d = str(direction or '1')

    def cells_3x2():
        return [
            {'x': x, 'y': y}, {'x': x + 1, 'y': y},
            {'x': x, 'y': y + 1}, {'x': x + 1, 'y': y + 1},
            {'x': x, 'y': y + 2}, {'x': x + 1, 'y': y + 2},
        ]

    def cells_2x3():
        return [
            {'x': x, 'y': y}, {'x': x + 1, 'y': y}, {'x': x + 2, 'y': y},
            {'x': x, 'y': y + 1}, {'x': x + 1, 'y': y + 1}, {'x': x + 2, 'y': y + 1},
        ]

    if d == '1':
        return cells_2x3()
    return cells_3x2()


def _footprint_bbox(cells):
    xs = [c['x'] for c in cells]
    ys = [c['y'] for c in cells]
    return (max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)


class TestWarshipFootprint(unittest.TestCase):
    def test_right_is_horizontal_3x2(self):
        cells = _warship_footprint_cells(4, 9, 1)
        self.assertEqual(len(cells), 6)
        self.assertEqual(_footprint_bbox(cells), (3, 2))

    def test_left_is_vertical_2x3(self):
        cells = _warship_footprint_cells(16, 9, 3)
        self.assertEqual(len(cells), 6)
        self.assertEqual(_footprint_bbox(cells), (2, 3))

    def test_up_is_vertical_2x3(self):
        cells = _warship_footprint_cells(10, 5, 2)
        self.assertEqual(_footprint_bbox(cells), (2, 3))


if __name__ == '__main__':
    unittest.main()
