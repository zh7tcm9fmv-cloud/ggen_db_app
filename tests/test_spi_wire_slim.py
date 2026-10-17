"""SPI /ip wire slim — no feature loss, smaller gzip."""
from __future__ import annotations

import gzip
import json
import unittest
from pathlib import Path

import sp_investment_rank as SIR

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / "data" / "published" / "sp_investment_v1.json"


class TestSpiWireSlim(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not PUB.is_file():
            raise unittest.SkipTest("published SPI board missing")
        with PUB.open(encoding="utf-8") as f:
            cls.raw = json.load(f)

    def test_drops_duplicate_top_level_boards(self):
        payload = json.loads(json.dumps(self.raw))
        SIR.strip_spi_wire_bloat(payload)
        self.assertIn("units", payload)
        self.assertIsInstance(payload["units"].get("sp"), dict)
        self.assertIsInstance(payload["units"].get("ssp"), dict)
        self.assertNotIn("sp", payload)
        self.assertNotIn("ssp", payload)

    def test_keeps_board_row_counts_and_rec_thumbs(self):
        payload = json.loads(json.dumps(self.raw))
        before_sp = sum(
            len(v)
            for v in (payload.get("units") or {}).get("sp", {}).values()
            if isinstance(v, list)
        )
        SIR.strip_spi_wire_bloat(payload)
        after_sp = sum(
            len(v)
            for v in (payload.get("units") or {}).get("sp", {}).values()
            if isinstance(v, list)
        )
        self.assertEqual(before_sp, after_sp)
        # Find a row with recommendations and ensure card fields survive.
        found = False
        for rows in ((payload.get("characters") or {}).get("sp") or {}).values():
            if not isinstance(rows, list):
                continue
            for row in rows:
                recs = row.get("recommended_units") or []
                if not recs:
                    continue
                found = True
                r0 = recs[0]
                self.assertIn("id", r0)
                self.assertIn("name", r0)
                self.assertIn("letter", r0)
                self.assertTrue(r0.get("thum") or r0.get("thumb"))
                self.assertNotIn("reason", r0)
                self.assertNotIn("rarity_icon", r0)
                break
            if found:
                break
        self.assertTrue(found, "expected at least one recommended_units entry")

    def test_gzip_shrinks_materially(self):
        raw = json.dumps(self.raw, separators=(",", ":")).encode()
        slim_obj = json.loads(raw)
        SIR.strip_spi_wire_bloat(slim_obj)
        slim = json.dumps(slim_obj, separators=(",", ":")).encode()
        gz_before = len(gzip.compress(raw, compresslevel=6))
        gz_after = len(gzip.compress(slim, compresslevel=6))
        # Expect ~40%+ cut from dropping duplicate sp/ssp alone.
        self.assertLess(gz_after, int(gz_before * 0.7))
        self.assertLess(gz_after, 900_000)


if __name__ == "__main__":
    unittest.main()
