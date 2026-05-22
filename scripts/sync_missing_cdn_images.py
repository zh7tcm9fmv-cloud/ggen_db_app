#!/usr/bin/env python3
"""
Sync missing game images from ggen_db_app/static/images into ggen_db_images/images.

- Copies .webp that exist locally but not on the CDN mirror
- Converts .png/.jpg/.jpeg to .webp when the webp is missing on CDN
- Adds URL-encoded duplicate paths (e.g. %20, %23) so IMAGE_CDN links resolve on GitHub
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import quote, unquote

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore

APP = Path(__file__).resolve().parent.parent
STATIC = APP / "static" / "images"
CDN = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_images\images")
RASTER_SUFFIXES = {".png", ".jpg", ".jpeg"}
REF_PAT = re.compile(r"/static/images/[^\s\"'<>\\)]+", re.I)


def save_webp(src: Path, dest: Path) -> None:
    if Image is None:
        raise RuntimeError("Pillow required: pip install Pillow")
    with Image.open(src) as img:
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            img.save(dest, "WEBP", lossless=True, method=6)
        else:
            img = img.convert("RGB")
            img.save(dest, "WEBP", quality=85, method=6)


def cdn_rel_exists(cdn_dir: Path, rel: str, cache: set[str], *, exact: bool = False) -> bool:
    if rel in cache:
        return True
    if exact:
        return (cdn_dir / rel).is_file()
    if unquote(rel) in cache:
        return True
    return False


def build_cdn_cache(cdn_dir: Path) -> set[str]:
    out: set[str] = set()
    for p in cdn_dir.rglob("*"):
        if p.is_file():
            rel = p.relative_to(cdn_dir).as_posix()
            out.add(rel)
            dec = unquote(rel)
            if dec != rel:
                out.add(dec)
    return out


def collect_encoded_refs() -> set[str]:
    refs: set[str] = set()
    for root, dirs, files in os.walk(APP):
        dirs[:] = [d for d in dirs if d not in {".git", "__pycache__", "node_modules", ".venv", "venv"}]
        for fn in files:
            if not fn.endswith((".py", ".js", ".html", ".css", ".json", ".md")):
                continue
            fp = Path(root) / fn
            try:
                text = fp.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            for m in REF_PAT.finditer(text):
                raw = m.group(0).split("?")[0].split("#")[0]
                if raw.startswith("/static/images/"):
                    refs.add(raw[len("/static/images/") :])
    return refs


def encoded_alias_rel(rel: str) -> str | None:
    """Build a URL-encoded path when the app serves %20/%23 in CDN URLs."""
    if "%" in rel:
        return None
    parts = rel.split("/")
    enc_parts = [quote(p, safe="") for p in parts]
    enc = "/".join(enc_parts)
    return enc if enc != rel else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cdn-dir", type=Path, default=CDN)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cdn_dir = args.cdn_dir.resolve()
    if not cdn_dir.exists():
        print(f"Error: CDN dir missing: {cdn_dir}")
        sys.exit(1)
    if not STATIC.exists():
        print(f"Error: static dir missing: {STATIC}")
        sys.exit(1)

    cache = build_cdn_cache(cdn_dir)
    copied = converted = aliased = errors = 0
    actions: list[dict] = []

    def log(action: str, rel: str, detail: str = "") -> None:
        actions.append({"action": action, "path": rel, "detail": detail})
        msg = f"[{action}] {rel}"
        if detail:
            msg += f" ({detail})"
        print(msg)

    # 1) Copy local webp missing on CDN
    for src in sorted(STATIC.rglob("*.webp")):
        rel = src.relative_to(STATIC).as_posix()
        if cdn_rel_exists(cdn_dir, rel, cache):
            continue
        dest = cdn_dir / rel
        if args.dry_run:
            log("would copy", rel)
            copied += 1
            continue
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            cache.add(rel)
            log("copy", rel)
            copied += 1
        except OSError as e:
            log("error", rel, str(e))
            errors += 1

    # 2) Convert local raster when webp missing on CDN
    for src in sorted(STATIC.rglob("*")):
        if src.suffix.lower() not in RASTER_SUFFIXES:
            continue
        rel = src.relative_to(STATIC).as_posix()
        webp_rel = rel.rsplit(".", 1)[0] + ".webp"
        if cdn_rel_exists(cdn_dir, webp_rel, cache):
            continue
        dest = cdn_dir / webp_rel
        if args.dry_run:
            log("would convert", webp_rel, f"from {rel}")
            converted += 1
            continue
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            save_webp(src, dest)
            cache.add(webp_rel)
            log("convert", webp_rel, f"from {rel}")
            converted += 1
        except Exception as e:
            log("error", webp_rel, str(e))
            errors += 1

    # 3) Encoded aliases for referenced paths and existing CDN files with special chars
    alias_sources: set[str] = set()
    for rel in collect_encoded_refs():
        if "%" in rel:
            alias_sources.add(unquote(rel))
        enc = encoded_alias_rel(rel)
        if enc:
            alias_sources.add(rel)

    for p in cdn_dir.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(cdn_dir).as_posix()
        if re.search(r"[ #]", rel):
            alias_sources.add(rel)

    for rel in sorted(alias_sources):
        src = cdn_dir / rel
        if not src.is_file():
            # maybe only on static after step 1/2
            src = STATIC / rel
        if not src.is_file():
            continue
        enc = encoded_alias_rel(rel)
        if not enc or cdn_rel_exists(cdn_dir, enc, cache, exact=True):
            continue
        dest = cdn_dir / enc
        if args.dry_run:
            log("would alias", enc, f"from {rel}")
            aliased += 1
            continue
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            cache.add(enc)
            log("alias", enc, f"from {rel}")
            aliased += 1
        except OSError as e:
            log("error", enc, str(e))
            errors += 1

    # Also alias encoded refs that point at existing decoded CDN files
    for rel in sorted(collect_encoded_refs()):
        if "%" not in rel:
            continue
        dec = unquote(rel)
        src = cdn_dir / dec
        if not src.is_file():
            src = STATIC / dec
        if not src.is_file() or cdn_rel_exists(cdn_dir, rel, cache, exact=True):
            continue
        dest = cdn_dir / rel
        if args.dry_run:
            log("would alias", rel, f"from {dec}")
            aliased += 1
            continue
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            cache.add(rel)
            log("alias", rel, f"from {dec}")
            aliased += 1
        except OSError as e:
            log("error", rel, str(e))
            errors += 1

    report = APP / "scripts" / "_sync_cdn_images_result.json"
    report.write_text(
        json.dumps(
            {
                "copied": copied,
                "converted": converted,
                "aliased": aliased,
                "errors": errors,
                "actions": actions,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nDone: {copied} copied, {converted} converted, {aliased} aliased, {errors} errors")
    print(f"Report: {report}")


if __name__ == "__main__":
    main()
