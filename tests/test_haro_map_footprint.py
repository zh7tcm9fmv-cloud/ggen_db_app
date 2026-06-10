"""Haro units must not use 2×2 stage-map footprint despite OccupiedAreaId 2."""

import importlib
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


class TestHaroMapFootprint(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ.setdefault('GGEN_SKIP_WARMUP', '1')
        cls.app = importlib.import_module('app')

    def test_haro_detected_by_model(self):
        self.assertTrue(self.app.is_haro_map_unit('1850001300'))
        self.assertTrue(self.app.is_haro_map_unit('1850001210'))
        self.assertFalse(self.app.is_haro_map_unit('1001002700'))

    def test_haro_single_cell_footprint(self):
        cells = self.app.get_map_unit_footprint_cells('1850001300', 4, 14, '4')
        self.assertEqual(cells, [{'x': 4, 'y': 14}])

    def test_haro_not_large_npc(self):
        self.assertFalse(self.app.is_large_map_npc('907000201702000001'))


if __name__ == '__main__':
    unittest.main()
