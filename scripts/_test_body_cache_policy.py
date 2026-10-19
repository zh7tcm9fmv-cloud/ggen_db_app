"""Sanity: large published boards keep gzip only in the body LRU."""
from __future__ import annotations

import gzip
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Import after path — loads full app (slow once).
import app as A  # noqa: E402


def main():
    boards = list((ROOT / "data" / "published" / "matrix_boards").glob("tag_matrix_*.json.gz"))
    assert boards, "missing published matrix boards"
    path = str(boards[0])
    ck = "tag_matrix_policy_test"
    with open(path, "rb") as f:
        gz = f.read()
    raw = gzip.decompress(gz)
    assert len(raw) > A._HTTP_JSON_BODY_RAW_KEEP_MAX
    A._http_json_body_cache_put(ck, raw, gz, 'W/"t"')
    hit = A._http_json_body_cache_get(ck)
    assert hit is not None
    assert hit.get("gzip") is not None
    assert hit.get("raw") is None, f"large raw should not be retained ({len(hit.get('raw') or b'')})"
    body, as_gzip = A._http_json_resolve_body(hit, True)
    assert as_gzip and body == gz
    body2, as_gzip2 = A._http_json_resolve_body(hit, False)
    assert not as_gzip2 and body2 == raw
    stats = A._http_json_body_cache_stats()
    print(json.dumps({"ok": True, "raw_mb": round(len(raw) / 1024 / 1024, 2), "stats": stats}, indent=2))


if __name__ == "__main__":
    main()
