#!/usr/bin/env python3
"""Pack local ms_panel.py for Railway env GGEN_MS_PANEL_Z (zlib+base64).

Does not print the formula — only the opaque blob length + optional write path.
"""
from __future__ import annotations

import argparse
import base64
import pathlib
import sys
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "ms_panel.py"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=pathlib.Path, help="Write blob to this file (not stdout)")
    ap.add_argument("--stdout", action="store_true", help="Print blob to stdout")
    args = ap.parse_args()
    if not SRC.is_file():
        print(f"missing {SRC}", file=sys.stderr)
        return 1
    raw = SRC.read_bytes()
    blob = base64.b64encode(zlib.compress(raw, 9)).decode("ascii")
    print(f"packed {len(raw)} bytes -> {len(blob)} b64 chars", file=sys.stderr)
    if args.out:
        args.out.write_text(blob, encoding="ascii")
        print(f"wrote {args.out}", file=sys.stderr)
    if args.stdout:
        sys.stdout.write(blob)
        if not blob.endswith("\n"):
            sys.stdout.write("\n")
    if not args.out and not args.stdout:
        print("pass --out PATH or --stdout", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
