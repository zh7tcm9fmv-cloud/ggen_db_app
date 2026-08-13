"""2×2 dual-line dash MAP: landing use-point sits above effect (not GP03-only)."""

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

    def test_end_coords_derived_above_effect(self):
        mc = [{'x': -1, 'y': 4}, {'x': 0, 'y': 4}, {'x': 1, 'y': 1}]
        end = self.app.map_dash_dual_end_coords_above_effect(mc, [])
        self.assertEqual(
            {(c['x'], c['y']) for c in end},
            {(0, 5), (1, 5), (0, 6), (1, 6)},
        )

    def _assert_dual_dash(self, uid, wid):
        raw = self.app.weapon_status_map.get(wid) or {}
        raw_ec = {(c['x'], c['y']) for c in (raw.get('map_coords') or [])}
        with self.app.app.test_client() as c:
            d = c.get(f'/api/unit/{uid}?lang=EN').get_json()
        w = next(x for x in (d.get('weapons') or []) if str(x.get('id')) == wid)
        self.assertTrue(w.get('map_dash_dual_wide'))
        self.assertTrue(w.get('is_dash'))
        end = {(c['x'], c['y']) for c in (w.get('map_dash_dual_end_coords') or [])}
        self.assertEqual(end, {(0, 5), (1, 5), (0, 6), (1, 6)})
        got_ec = {(c['x'], c['y']) for c in (w.get('map_coords') or [])}
        self.assertEqual(got_ec, raw_ec)
        # Effect must stay master-centered (-1..1), not +1-x widened to x=2
        self.assertEqual(max(x for x, _ in got_ec), 1)
        # End band sits immediately above effect top
        self.assertEqual(min(y for _, y in end), max(y for _, y in got_ec) + 1)

    def test_1705003100_dash_end_above_effect(self):
        self._assert_dual_dash('1705003100', '170500310003')

    def test_gp03_same_class_not_id_special(self):
        self._assert_dual_dash('1060000500', '106000050005')
        self._assert_dual_dash('1060000550', '106000055005')


if __name__ == '__main__':
    unittest.main()
