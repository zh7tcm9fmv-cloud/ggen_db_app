#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Freestyle AssetStudio export: pick assetbundle files by Windows creation date
and dump textures/sprites as WebP into a destination folder.

Example (latest drop ~2026-11-17):

  python scripts/export_astudio_by_ctime.py \\
    --date 2026-11-17 \\
    --out C:\\Users\\Mikew0911\\Desktop\\Texture2D\\export_2026-11-17
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

DEFAULT_AB = Path(
    r"C:\Users\Mikew0911\Desktop\Texture2D\12.22"
    r"\SD Gundam G Generation ETERNAL_GL\assetbundle"
)
DEFAULT_CLI = Path(r"C:\Users\Mikew0911\Desktop\AStudio_CLI_v0.20.0\AssetStudioModCLI.exe")
WORK_ROOT = Path(r"C:\Users\Mikew0911\Desktop\AStudio_CLI_v0.20.0")
UNITY = "2022.3.61f1"
DEFAULT_TYPES = "tex2d,tex2dArray,sprite"


def files_for_dates(ab: Path, dates: set[str]) -> list[Path]:
    """Return files whose local creation date (YYYY-MM-DD) is in dates."""
    out: list[Path] = []
    for p in ab.iterdir():
        if not p.is_file():
            continue
        try:
            day = datetime.fromtimestamp(p.stat().st_ctime).strftime("%Y-%m-%d")
        except OSError:
            continue
        if day in dates:
            out.append(p)
    out.sort(key=lambda x: x.name.lower())
    return out


def list_date_counts(ab: Path) -> list[tuple[str, int]]:
    buckets: dict[str, int] = {}
    for p in ab.iterdir():
        if not p.is_file():
            continue
        try:
            day = datetime.fromtimestamp(p.stat().st_ctime).strftime("%Y-%m-%d")
        except OSError:
            continue
        buckets[day] = buckets.get(day, 0) + 1
    return sorted(buckets.items(), key=lambda kv: kv[0], reverse=True)


def run_cli(cli: Path, inputs: list[Path], out_dir: Path, types: str, work: Path) -> None:
    if not inputs:
        return
    stage = work / "_stage_freestyle"
    if stage.exists():
        shutil.rmtree(stage, ignore_errors=True)
    stage.mkdir(parents=True, exist_ok=True)
    for src in inputs:
        dst = stage / src.name
        try:
            if dst.exists() or dst.is_symlink():
                dst.unlink()
        except OSError:
            pass
        try:
            os.link(src, dst)
        except OSError:
            shutil.copy2(src, dst)

    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        str(cli),
        str(stage),
        "-t",
        types,
        "-g",
        "type",
        "-o",
        str(out_dir),
        "--image-format",
        "webp",
        "--unity-version",
        UNITY,
        "-r",
        "--log-level",
        "warning",
        "--max-export-tasks",
        "4",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        sys.stderr.write(r.stdout[-2000:] if r.stdout else "")
        sys.stderr.write(r.stderr[-2000:] if r.stderr else "")
        raise RuntimeError(f"CLI failed rc={r.returncode} for {len(inputs)} inputs")


def main() -> int:
    # App Update GUI streams stdout on Windows cp1252 — keep logs ASCII-safe.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    ap = argparse.ArgumentParser(description="Export assetbundle files by creation date to WebP")
    ap.add_argument("--ab", type=Path, default=DEFAULT_AB)
    ap.add_argument("--cli", type=Path, default=DEFAULT_CLI)
    ap.add_argument("--out", type=Path, default=None, help="Destination folder (required unless --list-dates)")
    ap.add_argument(
        "--date",
        action="append",
        default=[],
        dest="dates",
        help="Creation date YYYY-MM-DD (repeatable). Required unless --list-dates.",
    )
    ap.add_argument("--list-dates", action="store_true", help="Print date -> file count and exit")
    ap.add_argument("--types", default=DEFAULT_TYPES, help=f"AssetStudio -t (default {DEFAULT_TYPES})")
    ap.add_argument("--chunk", type=int, default=40, help="Bundles per CLI batch")
    args = ap.parse_args()

    if not args.ab.is_dir():
        print("assetbundle missing:", args.ab, file=sys.stderr)
        return 2
    if args.list_dates:
        for day, n in list_date_counts(args.ab):
            print(f"{day}\t{n}")
        return 0
    if not args.dates:
        print("Pass --date YYYY-MM-DD (or --list-dates)", file=sys.stderr)
        return 2
    if args.out is None:
        print("--out is required unless --list-dates", file=sys.stderr)
        return 2
    if not args.cli.is_file():
        print("CLI missing:", args.cli, file=sys.stderr)
        return 2

    dates = {str(d).strip() for d in args.dates if str(d).strip()}
    files = files_for_dates(args.ab, dates)
    if not files:
        print(f"No files for dates {sorted(dates)} under {args.ab}")
        return 1

    work = WORK_ROOT / "_freestyle_ctime_work"
    work.mkdir(parents=True, exist_ok=True)
    args.out.mkdir(parents=True, exist_ok=True)

    print(
        f"Freestyle export -> WebP\n"
        f"  dates: {', '.join(sorted(dates))}\n"
        f"  files: {len(files)}\n"
        f"  out:   {args.out}\n"
        f"  types: {args.types}\n",
        flush=True,
    )
    t0 = time.time()
    chunk = max(1, int(args.chunk))
    batches = (len(files) + chunk - 1) // chunk
    fail = 0
    for i in range(0, len(files), chunk):
        batch = files[i : i + chunk]
        bi = i // chunk + 1
        # Keep batch outputs under dated subfolders so re-runs don't wipe everything
        batch_out = args.out / f"_batch_{bi:03d}"
        print(f"[{bi}/{batches}] {len(batch)} bundles -> {batch_out.name} ...", flush=True)
        try:
            if batch_out.exists():
                shutil.rmtree(batch_out, ignore_errors=True)
            run_cli(args.cli, batch, batch_out, args.types, work)
            # Flatten batch into out (type folders merge)
            for root, _dirs, names in os.walk(batch_out):
                for name in names:
                    src = Path(root) / name
                    rel = src.relative_to(batch_out)
                    dst = args.out / rel
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    if dst.exists():
                        dst.unlink()
                    shutil.move(str(src), str(dst))
            shutil.rmtree(batch_out, ignore_errors=True)
        except Exception as e:
            fail += 1
            print(f"  FAIL batch {bi}: {e}", flush=True)

    elapsed = round(time.time() - t0, 1)
    print(f"\nDone. files={len(files)} fail_batches={fail} elapsed_sec={elapsed}")
    print(f"Output: {args.out}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
