# -*- coding: utf-8 -*-
"""CLI worker: RapidOCR one image path → newline text on stdout.

Used by /api/profile_insights/ocr when the Flask interpreter cannot import
rapidocr (e.g. system Python 3.14 numpy ABI) — call via .venv-paddle.
"""
from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: profile_rapidocr_worker.py <image>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    if not path.is_file():
        print(f"missing:{path}", file=sys.stderr)
        return 2
    from rapidocr_onnxruntime import RapidOCR

    engine = RapidOCR()
    result, _ = engine(str(path))
    if not result:
        return 0
    for item in result:
        if len(item) >= 2 and item[1]:
            print(str(item[1]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
