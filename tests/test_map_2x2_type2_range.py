"""2×2 OccupiedAreaId units with type-2 (impact) MAP: do not double-widen master coords."""

import importlib
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


class TestMap2x2Type2Range(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault('GGEN_SKIP_WARMUP', '1')
        cls.app = importlib.import_module('app')

    def test_footprint_aware_detector(self):
        # Symmetric about x=0.5 (2×2 midline)
        aware = [{'x': -4, 'y': 0}, {'x': 5, 'y': 0}, {'x': 0, 'y': 5}, {'x': 1, 'y': 5}]
        self.assertTrue(self.app.map_coords_already_2x2_footprint_aware(aware))
        # Pivot-centered 1×1-style ring
        pivot = [{'x': -4, 'y': 0}, {'x': 4, 'y': 0}, {'x': 0, 'y': 5}]
        self.assertFalse(self.app.map_coords_already_2x2_footprint_aware(pivot))

    def test_augment_skips_footprint_aware_shooting(self):
        uid = '1705004310'
        raw = self.app.weapon_status_map.get('170500431002') or {}
        sc = [dict(c) for c in (raw.get('shooting_coords') or [])]
        self.assertTrue(sc)
        self.assertTrue(self.app.map_coords_already_2x2_footprint_aware(sc))
        out = self.app.augment_map_coords_for_occupied_area_2(sc, uid)
        self.assertEqual(
            {(c['x'], c['y']) for c in out},
            {(c['x'], c['y']) for c in sc},
        )

    def test_unit_1705004310_type2_map_matches_master(self):
        """Only OccupiedAreaId-2 type-2 MAP in catalog; master is already correct."""
        uid = '1705004310'
        wid = '170500431002'
        raw = self.app.weapon_status_map.get(wid) or {}
        raw_ec = {(c['x'], c['y']) for c in (raw.get('map_coords') or [])}
        raw_sc = {(c['x'], c['y']) for c in (raw.get('shooting_coords') or [])}
        self.assertEqual(len(raw_ec), 13)
        self.assertEqual(len(raw_sc), 36)

        with self.app.app.test_client() as c:
            d = c.get(f'/api/unit/{uid}?lang=EN').get_json()
        weapons = d.get('weapons') or []
        w = next((x for x in weapons if str(x.get('id')) == wid), None)
        self.assertIsNotNone(w)
        self.assertEqual(str(w.get('map_range_type') or ''), '2')
        got_ec = {(c['x'], c['y']) for c in (w.get('map_coords') or [])}
        got_sc = {(c['x'], c['y']) for c in (w.get('shooting_coords') or [])}
        self.assertEqual(got_ec, raw_ec)
        self.assertEqual(got_sc, raw_sc)
        # Effect diamond stays pivot-centered (impact-relative)
        xs = [x for x, _ in got_ec]
        self.assertEqual(min(xs) + max(xs), 0)
        # Shooting stays 2×2-midline centered (matches use-point at (0,0)(1,0)(0,1)(1,1))
        sxs = [x for x, _ in got_sc]
        sys_ = [y for _, y in got_sc]
        self.assertEqual(min(sxs) + max(sxs), 1)
        self.assertAlmostEqual(sum(sxs) / len(sxs), 0.5, places=5)
        self.assertAlmostEqual(sum(sys_) / len(sys_), 0.5, places=5)

    def test_large_unit_cells_match_map_footprint_dxdy(self):
        self.assertEqual(
            set(self.app.MAP_FOOTPRINT_2X2_DXDY),
            {(0, 0), (1, 0), (0, 1), (1, 1)},
        )
        cells = self.app.get_large_unit_cells(0, 0)
        self.assertEqual(
            {(c['x'], c['y']) for c in cells},
            {(0, 0), (1, 0), (0, 1), (1, 1)},
        )


if __name__ == '__main__':
    unittest.main()
