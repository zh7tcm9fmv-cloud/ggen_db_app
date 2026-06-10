"""Warship enhancement-area geometry (stage 11000418 / Murrue reference)."""

import unittest


def _warship_enhancement_1based(footprint, direction, pivot, rng_min, rng_max, width, height):
    """Mirror of app._map_buff_range_cells_warship_enhancement — keep in sync."""
    fp_set = {(c['x'], c['y']) for c in footprint}
    xs = [x for x, _y in fp_set]
    ys = [y for _x, y in fp_set]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    rmin = max(0, int(rng_min or 0))
    rmax = max(rmin, int(rng_max or 0))
    buff = set()
    d = str(direction or '1')
    if d in ('1', '3'):
        rear_cols = (
            range(min_x, min_x + pivot)
            if d == '1'
            else range(max_x - pivot + 1, max_x + 1)
        )
        for dist in range(rmin, rmax + 1):
            if d == '1':
                band_x = (max_x + dist, min_x - dist)
            else:
                band_x = (min_x - dist, max_x + dist)
            for bx in band_x:
                for y in range(min_y, max_y + 1):
                    buff.add((bx, y))
        for dist in range(rmin, rmax + 1):
            for x in rear_cols:
                buff.add((x, min_y - dist))
                buff.add((x, max_y + dist))
    buff -= fp_set
    out = set()
    for x, y in buff:
        if x < 0 or y < 0 or x >= width or y >= height:
            continue
        out.add((x + 1, y + 1))
    return out


class TestWarshipBuffArea(unittest.TestCase):
    def test_murrue_left_facing_fat_cross(self):
        """Guest warship at (16,9) facing left, range 1–2, pivot 2 — matches in-game Strategy Info."""
        footprint = [
            {'x': 16, 'y': 9}, {'x': 17, 'y': 9}, {'x': 18, 'y': 9},
            {'x': 16, 'y': 10}, {'x': 17, 'y': 10}, {'x': 18, 'y': 10},
        ]
        cells = _warship_enhancement_1based(footprint, '3', 2, 1, 2, 24, 24)
        xs = [x for x, _y in cells]
        ys = [y for _x, y in cells]
        self.assertEqual(min(xs), 15)
        self.assertEqual(max(xs), 21)
        self.assertEqual(min(ys), 8)
        self.assertEqual(max(ys), 13)
        self.assertNotIn((15, 8), cells)
        self.assertNotIn((21, 8), cells)
        horiz_y10 = sorted(x for x, y in cells if y == 10)
        self.assertEqual(horiz_y10, [15, 16, 20, 21])
        vert_x18 = sorted(y for x, y in cells if x == 18)
        self.assertEqual(vert_x18, [8, 9, 12, 13])
        self.assertEqual(len(cells), 16)


if __name__ == '__main__':
    unittest.main()
