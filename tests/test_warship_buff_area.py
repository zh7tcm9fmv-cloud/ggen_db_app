"""Warship enhancement-area geometry (stage 11000418 / Archangel in-battle reference)."""

import unittest


def _stepped_rect_1based(footprint, rng_min, rng_max, width, height):
    """Mirror of app._map_buff_range_cells_stepped_rect — keep in sync."""
    fp_set = {(c['x'], c['y']) for c in footprint}
    xs = [x for x, _y in fp_set]
    ys = [y for _x, y in fp_set]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    rmin = max(0, int(rng_min or 0))
    rmax = max(rmin, int(rng_max or 0))
    buff = set()
    for dy in range(rmin, rmax + 1):
        span = rmax - dy
        for y in (min_y - dy, max_y + dy):
            for x in range(min_x - span, max_x + span + 1):
                if (x, y) not in fp_set:
                    buff.add((x, y))
    for dx in range(rmin, rmax + 1):
        span = rmax - dx
        for x in (min_x - dx, max_x + dx):
            for y in range(min_y - span, max_y + span + 1):
                if (x, y) not in fp_set:
                    buff.add((x, y))
    out = set()
    for x, y in buff:
        if x < 0 or y < 0 or x >= width or y >= height:
            continue
        out.add((x + 1, y + 1))
    return out


class TestWarshipBuffArea(unittest.TestCase):
    def test_archangel_west_stepped_cross(self):
        """Archangel at (16,9) facing west, range 1–2 — 6×7 stepped ring from in-game screenshot."""
        footprint = [
            {'x': 15, 'y': 9}, {'x': 16, 'y': 9}, {'x': 17, 'y': 9},
            {'x': 15, 'y': 10}, {'x': 16, 'y': 10}, {'x': 17, 'y': 10},
        ]
        cells = _stepped_rect_1based(footprint, 1, 2, 24, 24)
        row_w = {}
        for x, y in cells:
            row_w.setdefault(y, []).append(x)
        self.assertEqual(sorted(row_w[8]), [16, 17, 18])
        self.assertEqual(sorted(row_w[9]), [15, 16, 17, 18, 19])
        self.assertEqual(sorted(row_w[10]), [14, 15, 19, 20])
        self.assertEqual(sorted(row_w[13]), [16, 17, 18])
        self.assertNotIn((15, 8), cells)
        self.assertNotIn((21, 8), cells)
        self.assertEqual(len(cells), 24)

    def test_minerva_east_same_shape(self):
        footprint = [
            {'x': 4, 'y': 9}, {'x': 5, 'y': 9}, {'x': 6, 'y': 9},
            {'x': 4, 'y': 10}, {'x': 5, 'y': 10}, {'x': 6, 'y': 10},
        ]
        cells = _stepped_rect_1based(footprint, 1, 2, 24, 24)
        self.assertEqual(len(cells), 24)

    def test_single_tile_stepped_range_2(self):
        """1×1 gimmick (Dritte Guarder) range 1–2 — diamond step ring, not thin cross arms."""
        footprint = [{'x': 11, 'y': 15}]
        cells = _stepped_rect_1based(footprint, 1, 2, 30, 30)
        self.assertEqual(len(cells), 12)
        self.assertNotIn((12, 16), cells)
        self.assertIn((13, 15), cells)
        self.assertIn((11, 15), cells)


if __name__ == '__main__':
    unittest.main()
