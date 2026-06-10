"""Map NPC buff aura geometry (stage map buff_areas)."""

import unittest


def _cross_cells_1based(cx, cy, rng_min, rng_max, width, height):
    """Mirror of app._map_buff_range_cells_1based — keep in sync."""
    rmin = max(0, int(rng_min or 0))
    rmax = max(rmin, int(rng_max or 0))
    if rmax <= 0:
        return []
    out = []
    seen = set()
    for d in range(rmin, rmax + 1):
        for ox, oy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            x, y = cx + ox, cy + oy
            if x < 0 or y < 0 or x >= max(0, width) or y >= max(0, height):
                continue
            key = (x + 1, y + 1)
            if key in seen:
                continue
            seen.add(key)
            out.append(key)
    return out


class TestMapBuffRangeCells(unittest.TestCase):
    def test_range_1_is_four_orthogonal_neighbors(self):
        # Source at 0-based (5, 5) → grid key (6, 6)
        cells = _cross_cells_1based(5, 5, 1, 1, 20, 20)
        self.assertEqual(len(cells), 4)
        self.assertEqual(
            set(cells),
            {(7, 6), (5, 6), (6, 7), (6, 5)},
        )

    def test_range_1_to_3_is_cross_not_square(self):
        cells = _cross_cells_1based(5, 5, 1, 3, 20, 20)
        self.assertEqual(len(cells), 12)
        self.assertNotIn((7, 7), cells)
        self.assertNotIn((5, 5), cells)
        self.assertIn((6, 3), cells)
        self.assertIn((9, 6), cells)

    def test_clips_to_map_bounds(self):
        cells = _cross_cells_1based(0, 0, 1, 3, 3, 3)
        self.assertEqual(len(cells), 4)
        for x, y in cells:
            self.assertGreaterEqual(x, 1)
            self.assertGreaterEqual(y, 1)
            self.assertLessEqual(x, 3)
            self.assertLessEqual(y, 3)

    def test_footprint_union_is_fat_cross_not_square(self):
        footprint = [
            {'x': 16, 'y': 9}, {'x': 17, 'y': 9},
            {'x': 16, 'y': 10}, {'x': 17, 'y': 10},
            {'x': 16, 'y': 11}, {'x': 17, 'y': 11},
        ]
        seen = set()
        for cell in footprint:
            for key in _cross_cells_1based(cell['x'], cell['y'], 1, 2, 24, 24):
                seen.add(key)
        self.assertNotIn((15, 8), seen)
        self.assertNotIn((20, 8), seen)
        self.assertIn((18, 8), seen)
        self.assertIn((18, 13), seen)
        self.assertIn((15, 10), seen)
        self.assertIn((20, 10), seen)


if __name__ == '__main__':
    unittest.main()
