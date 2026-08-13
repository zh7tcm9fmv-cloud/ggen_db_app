"""2×2 dual-line dash MAP: match in-game Leveler / GP03 placement.

In-game layout (OccupiedAreaId 2):
  start 2×2 at y=-1..0 (cols 0..1)
  effect = minkowski(master 3×4) → 4×5 (x=-1..2, y=1..5)
  end 2×2 immediately above effect (y=6..7, cols 0..1)
"""

import importlib
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


class TestMap2x2DashEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault('GGEN_SKIP_WARMUP', '1')
        cls.app = importlib.import_module('app')

    def test_minkowski_expands_3x4_to_4x5(self):
        raw = [
            {'x': x, 'y': y}
            for y in (1, 2, 3, 4)
            for x in (-1, 0, 1)
        ]
        out = self.app.minkowski_map_coords_with_2x2_footprint(raw)
        got = {(c['x'], c['y']) for c in out}
        expect = {(x, y) for y in (1, 2, 3, 4, 5) for x in (-1, 0, 1, 2)}
        self.assertEqual(got, expect)

    def test_end_coords_above_expanded_effect(self):
        mc = [{'x': x, 'y': y} for y in (1, 2, 3, 4, 5) for x in (-1, 0, 1, 2)]
        end = self.app.map_dash_dual_end_coords_above_effect(mc, [])
        self.assertEqual(
            {(c['x'], c['y']) for c in end},
            {(0, 6), (1, 6), (0, 7), (1, 7)},
        )

    def _assert_dual_dash_ingame(self, uid, wid):
        with self.app.app.test_client() as c:
            d = c.get(f'/api/unit/{uid}?lang=EN').get_json()
        w = next(x for x in (d.get('weapons') or []) if str(x.get('id')) == wid)
        self.assertTrue(w.get('map_dash_dual_wide'))
        self.assertTrue(w.get('is_dash'))
        got_ec = {(c['x'], c['y']) for c in (w.get('map_coords') or [])}
        expect_ec = {(x, y) for y in (1, 2, 3, 4, 5) for x in (-1, 0, 1, 2)}
        self.assertEqual(got_ec, expect_ec)
        end = {(c['x'], c['y']) for c in (w.get('map_dash_dual_end_coords') or [])}
        self.assertEqual(end, {(0, 6), (1, 6), (0, 7), (1, 7)})
        self.assertEqual(min(y for _, y in end), max(y for _, y in got_ec) + 1)

    def test_1705003100_matches_ingame_leveler(self):
        self._assert_dual_dash_ingame('1705003100', '170500310003')

    def test_gp03_same_class(self):
        self._assert_dual_dash_ingame('1060000500', '106000050005')
        self._assert_dual_dash_ingame('1060000550', '106000055005')


if __name__ == '__main__':
    unittest.main()
