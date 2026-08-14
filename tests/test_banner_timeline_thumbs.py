# -*- coding: utf-8 -*-
import unittest


class TestFeaturedUaVer2Logo(unittest.TestCase):
    def test_cutover_predicate(self):
        from app import _bt_banner_thumb_should_use_ver2_logo as should

        # 2026-04-16 12:00 JST and later Featured ticket pools
        self.assertTrue(should("gasha_2604300102", 1776308400000))
        self.assertTrue(should("gasha_2604300102", 1778641200000))
        self.assertTrue(should("gasha_2604300102", 1786590000000))
        # Before cutover keeps legacy appeal art
        self.assertFalse(should("gasha_2604300102", 1773370800000))
        self.assertFalse(should("gasha_2604300102", 1760065200000))
        # Wrong appeal resource
        self.assertFalse(should("gasha_2604300101", 1776308400000))
        # Permanent shop schedule year 2099
        self.assertFalse(should("gasha_2604300102", 4070908800000))


if __name__ == "__main__":
    unittest.main()
