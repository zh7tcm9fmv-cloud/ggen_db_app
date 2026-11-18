#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Export all UR IngameKoma strips + referenced hit FX into
  ggen_db_images/images/Master League/Simulator/{koma,fx,meta}

Uses AssetStudioModCLI (v0.20) against the 12.22 GL assetbundle dump.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER_UNIT = ROOT / "data" / "EN" / "master" / "m_unit.json"
DEFAULT_AB = Path(
    r"C:\Users\Mikew0911\Desktop\Texture2D\12.22"
    r"\SD Gundam G Generation ETERNAL_GL\assetbundle"
)
DEFAULT_CLI = Path(r"C:\Users\Mikew0911\Desktop\AStudio_CLI_v0.20.0\AssetStudioModCLI.exe")
DEFAULT_OUT = Path(
    r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\Master League\Simulator"
)
WORK = Path(r"C:\Users\Mikew0911\Desktop\AStudio_CLI_v0.20.0\_ur_export_work")
UNITY = "2022.3.61f1"

SPRITE_HASH_RE = re.compile(r"^(?P<base>.+?)\s+#\d+\.(?P<ext>png|webp)$", re.I)
EF_NAME_RE = re.compile(r'"(?:AssetName|_default\w*AbName)"\s*:\s*"(ef_mp[^"]+)"', re.I)
KOMA_BUNDLE_SUFFIXES = (
    "_standby",
    "_motion",
    "_et01",
    "_et02",
    "_map01",
    "_map02",
    "_event01",
    "_event02",
)


def load_ur_koma_ids() -> list[str]:
    rows = json.loads(MASTER_UNIT.read_text(encoding="utf-8"))
    ids = sorted(
        {
            str(r.get("KomaResourceId") or "").strip()
            for r in rows
            if str(r.get("RarityTypeIndex")) == "5" and r.get("KomaResourceId")
        }
    )
    return [k for k in ids if k]


def ur_unit_rows() -> list[dict]:
    rows = json.loads(MASTER_UNIT.read_text(encoding="utf-8"))
    out = []
    for r in rows:
        if str(r.get("RarityTypeIndex")) != "5":
            continue
        kid = str(r.get("KomaResourceId") or "").strip()
        if not kid:
            continue
        out.append({"id": str(r.get("Id")), "koma_id": kid})
    return out


def list_koma_bundles(ab: Path, koma_id: str) -> list[Path]:
    hits = []
    exact = ab / koma_id
    if exact.is_file():
        hits.append(exact)
    for suf in KOMA_BUNDLE_SUFFIXES:
        p = ab / f"{koma_id}{suf}"
        if p.is_file():
            hits.append(p)
    # any other top-level {komaId}_*
    for p in ab.glob(f"{koma_id}_*"):
        if p.is_file() and p not in hits:
            # skip portrait / thum / ogk (not IngameKoma battle strips)
            name = p.name.lower()
            if name.startswith(("thum_", "ub_", "ogk_", "win_")):
                continue
            if p.name.startswith(("thum_", "ub_", "ogk_")):
                continue
            hits.append(p)
    # de-dupe preserve order
    seen = set()
    out = []
    for p in hits:
        if p.name in seen:
            continue
        seen.add(p.name)
        out.append(p)
    return out


def run_cli(cli: Path, inputs: list[Path], out_dir: Path, types: str) -> None:
    if not inputs:
        return
    stage = WORK / "_stage"
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

    if out_dir.exists():
        shutil.rmtree(out_dir, ignore_errors=True)
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
        raise RuntimeError(f"CLI failed rc={r.returncode} for {len(inputs)} inputs → {out_dir}")


def clean_sprite_name(name: str) -> str | None:
    m = SPRITE_HASH_RE.match(name)
    if m:
        return f"{m.group('base')}.{m.group('ext').lower()}"
    low = name.lower()
    if low.endswith(".webp") or low.endswith(".png"):
        return name if low.endswith(".webp") else (name[:-4] + ".webp")
    return None


def collect_sprites(export_root: Path, koma_id: str, dest_dir: Path) -> dict:
    """Copy/rename koma sprites; prefer non-# hashed names."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    sprite_dir = export_root / "Sprite"
    counts = defaultdict(int)
    best: dict[str, Path] = {}
    if not sprite_dir.is_dir():
        return {"files": 0, "strips": {}}

    for p in sprite_dir.iterdir():
        if not p.is_file():
            continue
        if not p.name.startswith(koma_id + "_") and not p.name.startswith(koma_id + " "):
            if not p.name.startswith(koma_id):
                continue
        cleaned = clean_sprite_name(p.name)
        if not cleaned or not cleaned.startswith(koma_id + "_"):
            continue
        # prefer unhashed source when both exist
        hashed = " #" in p.name
        prev = best.get(cleaned)
        if prev is None:
            best[cleaned] = p
        else:
            prev_hashed = " #" in prev.name
            if prev_hashed and not hashed:
                best[cleaned] = p

    for cleaned, src in best.items():
        dst = dest_dir / cleaned
        shutil.copy2(src, dst)
        # strip key: komaId_action_facing
        stem = Path(cleaned).stem
        parts = stem.split("_")
        # g2170u02150_weapon1_front_01 → weapon1_front
        if len(parts) >= 4:
            strip = "_".join(parts[1:-1])
        elif len(parts) >= 3:
            strip = "_".join(parts[1:])
        else:
            strip = stem
        counts[strip] += 1

    return {"files": len(best), "strips": dict(sorted(counts.items()))}


def collect_meta(export_root: Path, koma_id: str, dest_dir: Path) -> list[str]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    mb = export_root / "MonoBehaviour"
    saved = []
    if not mb.is_dir():
        return saved
    want_prefixes = (
        f"{koma_id}_motion",
        f"{koma_id}_et",
        f"{koma_id}_map",
        f"{koma_id}_event",
    )
    for p in mb.iterdir():
        if not p.is_file() or not p.name.endswith(".json"):
            continue
        if any(p.name.startswith(pref) for pref in want_prefixes):
            dst = dest_dir / p.name
            shutil.copy2(p, dst)
            saved.append(p.name)
    return saved


def parse_fx_names_from_meta(export_root: Path) -> set[str]:
    names: set[str] = set()
    mb = export_root / "MonoBehaviour"
    if not mb.is_dir():
        return names
    for p in mb.iterdir():
        if not p.is_file() or not p.name.endswith(".json"):
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for m in EF_NAME_RE.finditer(text):
            names.add(m.group(1).strip())
    return names


def expand_fx_pair(name: str) -> set[str]:
    """When motion refs mpa_*, also try matching mpd_* (impact plate)."""
    out = {name}
    if name.startswith("ef_mpa_"):
        out.add("ef_mpd_" + name[len("ef_mpa_") :])
    elif name.startswith("ef_mpd_"):
        out.add("ef_mpa_" + name[len("ef_mpd_") :])
    return out


def resolve_fx_bundles(ab: Path, names: set[str]) -> list[Path]:
    paths = []
    seen = set()
    for n in sorted(names):
        for cand in expand_fx_pair(n):
            p = ab / cand
            if p.is_file() and cand not in seen:
                seen.add(cand)
                paths.append(p)
    return paths


def collect_fx_images(export_root: Path, dest_dir: Path) -> int:
    dest_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    for folder in ("Texture2DArrayImage", "Sprite", "Texture2D"):
        src_dir = export_root / folder
        if not src_dir.is_dir():
            continue
        for p in src_dir.iterdir():
            if not p.is_file():
                continue
            cleaned = clean_sprite_name(p.name)
            if not cleaned:
                continue
            # only keep effect flipbooks
            if not cleaned.lower().startswith("ef_"):
                continue
            dst = dest_dir / cleaned
            if dst.exists() and " #" in p.name:
                continue
            shutil.copy2(p, dst)
            n += 1
    return n


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ab", type=Path, default=DEFAULT_AB)
    ap.add_argument("--cli", type=Path, default=DEFAULT_CLI)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--only", action="append", default=[], help="Only these koma ids")
    ap.add_argument("--limit", type=int, default=0, help="Process at most N koma ids")
    ap.add_argument("--skip-fx", action="store_true")
    ap.add_argument("--resume", action="store_true", help="Skip koma dirs that already have webps")
    args = ap.parse_args()

    if not args.cli.is_file():
        print("CLI missing:", args.cli, file=sys.stderr)
        return 2
    if not args.ab.is_dir():
        print("assetbundle missing:", args.ab, file=sys.stderr)
        return 2

    WORK.mkdir(parents=True, exist_ok=True)
    koma_out = args.out / "koma"
    fx_out = args.out / "fx"
    meta_out = args.out / "meta"
    koma_out.mkdir(parents=True, exist_ok=True)
    fx_out.mkdir(parents=True, exist_ok=True)
    meta_out.mkdir(parents=True, exist_ok=True)

    all_ids = load_ur_koma_ids()
    if args.only:
        want = set(args.only)
        all_ids = [k for k in all_ids if k in want]
    if args.limit and args.limit > 0:
        all_ids = all_ids[: args.limit]

    unit_rows = ur_unit_rows()
    units_by_koma: dict[str, list[str]] = defaultdict(list)
    for u in unit_rows:
        units_by_koma[u["koma_id"]].append(u["id"])

    manifest = {
        "purpose": "UR IngameKoma + referenced FX for /mls Simulator",
        "cdn_folder": "images/Master League/Simulator",
        "unity": UNITY,
        "source_ab": str(args.ab),
        "units": {},
        "fx_bundles": [],
        "stats": {},
    }

    all_fx_names: set[str] = set()
    t0 = time.time()
    ok = 0
    fail = []

    print(f"UR koma ids to process: {len(all_ids)}")
    for i, kid in enumerate(all_ids, 1):
        dest = koma_out / kid
        if args.resume and dest.is_dir() and any(dest.glob("*.webp")):
            print(f"[{i}/{len(all_ids)}] SKIP resume {kid}")
            ok += 1
            continue

        bundles = list_koma_bundles(args.ab, kid)
        if not bundles:
            print(f"[{i}/{len(all_ids)}] MISS bundles {kid}")
            fail.append({"koma_id": kid, "reason": "no_bundles"})
            continue

        exp = WORK / f"exp_{kid}"
        print(f"[{i}/{len(all_ids)}] {kid}  bundles={len(bundles)} …", flush=True)
        try:
            run_cli(args.cli, bundles, exp, "sprite,monoBehaviour,tex2dArray")
        except Exception as e:
            print("  FAIL export", e)
            fail.append({"koma_id": kid, "reason": str(e)})
            continue

        info = collect_sprites(exp, kid, dest)
        metas = collect_meta(exp, kid, meta_out)
        fx_names = parse_fx_names_from_meta(exp)
        all_fx_names |= fx_names

        manifest["units"][kid] = {
            "unit_ids": units_by_koma.get(kid, []),
            "bundles": [b.name for b in bundles],
            "sprite_files": info["files"],
            "strips": info["strips"],
            "meta": metas,
            "fx_refs": sorted(fx_names),
        }
        print(f"  sprites={info['files']} meta={len(metas)} fx_refs={len(fx_names)}")
        ok += 1

        # free disk of per-koma export tree
        shutil.rmtree(exp, ignore_errors=True)

    fx_copied = 0
    if not args.skip_fx and all_fx_names:
        fx_paths = resolve_fx_bundles(args.ab, all_fx_names)
        manifest["fx_bundles"] = [p.name for p in fx_paths]
        print(f"\nFX names referenced: {len(all_fx_names)}  bundles found: {len(fx_paths)}")
        # batch FX export in chunks of 40
        chunk = 40
        for j in range(0, len(fx_paths), chunk):
            batch = fx_paths[j : j + chunk]
            exp = WORK / f"exp_fx_{j}"
            print(f"  FX batch {j // chunk + 1}/{(len(fx_paths) + chunk - 1) // chunk} ({len(batch)} files)")
            try:
                run_cli(args.cli, batch, exp, "tex2dArray,sprite,tex2d")
                fx_copied += collect_fx_images(exp, fx_out)
            except Exception as e:
                print("  FX batch FAIL", e)
                fail.append({"fx_batch": j, "reason": str(e)})
            shutil.rmtree(exp, ignore_errors=True)

    manifest["stats"] = {
        "koma_ok": ok,
        "koma_total": len(all_ids),
        "fail": fail,
        "fx_files_copied": fx_copied,
        "elapsed_sec": round(time.time() - t0, 1),
    }
    man_path = meta_out / "UR_EXPORT_MANIFEST.json"
    man_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    readme = args.out / "README_UR_EXPORT.txt"
    readme.write_text(
        "\n".join(
            [
                "UR IngameKoma + FX export for /mls",
                f"koma ok: {ok}/{len(all_ids)}",
                f"fx webp copied: {fx_copied}",
                f"manifest: meta/UR_EXPORT_MANIFEST.json",
                f"elapsed_sec: {manifest['stats']['elapsed_sec']}",
                "",
                "Push ggen_db_images to GitHub when ready for CDN.",
                "App wiring (MLS_KOMA_TEST expansion) is separate.",
                "",
            ]
        ),
        encoding="utf-8",
    )
    print("\nDONE", json.dumps(manifest["stats"], indent=2))
    print("manifest →", man_path)
    return 0 if not fail else 1


if __name__ == "__main__":
    raise SystemExit(main())
