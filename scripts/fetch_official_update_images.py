# -*- coding: utf-8 -*-
"""Fetch 1.5 update (id=2026092303) detail JSON for all locales; download + WebP."""
from __future__ import annotations

import json
import os
import re
import time
import urllib.request
from pathlib import Path

OUT = Path(r"C:\Users\Mikew0911\Desktop\1.5 update")
OUT.mkdir(parents=True, exist_ok=True)

# Official: ja=1, en=2, tw=3, hk=4
LOCALES = {
    "JP": ("https://web.jp.eternal.channel.or.jp", 1),
    "EN": ("https://web.gl.eternal.channel.or.jp", 2),
    "TW": ("https://web.gl.eternal.channel.or.jp", 3),
    "HK": ("https://web.gl.eternal.channel.or.jp", 4),
}
INFO_ID = "2026092303"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json,*/*",
    "Referer": "https://web.gl.eternal.channel.or.jp/en/information/update/",
}

# Content markup image refs: #ba HASH.png / #img / paths
IMG_RE = re.compile(
    r"(?:#ba\s+|#bb\s+|/server_assets/img/|server_assets/img/)"
    r"([0-9a-f]{40}\.(?:png|jpe?g|webp|gif))",
    re.I,
)
HASH_FILE_RE = re.compile(r"\b([0-9a-f]{40}\.(?:png|jpe?g|webp|gif))\b", re.I)


def fetch(url: str, timeout: int = 90) -> bytes:
    last = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last = e
            time.sleep(0.35 * (attempt + 1))
    raise last  # type: ignore


def to_webp(src: Path, dest: Path, quality: int = 82) -> bool:
    from PIL import Image

    try:
        im = Image.open(src)
        if im.mode in ("P", "RGBA"):
            im = im.convert("RGBA")
        elif im.mode != "RGB":
            im = im.convert("RGB")
        im.save(dest, "WEBP", quality=quality, method=6)
        return True
    except Exception as e:
        print(f"  webp fail {src.name}: {e}")
        return False


def collect_image_names(obj, bag: set[str]):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str):
                if k.endswith("_path") or "image" in k.lower() or "banner" in k.lower():
                    m = HASH_FILE_RE.search(v)
                    if m:
                        bag.add(m.group(1).lower())
                for m in IMG_RE.finditer(v):
                    bag.add(m.group(1).lower())
                for m in HASH_FILE_RE.finditer(v):
                    # only accept hashes that look like assets (avoid random hex in text)
                    if v.strip().endswith(m.group(1)) or "/img/" in v or "#ba" in v or "#bb" in v:
                        bag.add(m.group(1).lower())
            else:
                collect_image_names(v, bag)
    elif isinstance(obj, list):
        for it in obj:
            collect_image_names(it, bag)
    elif isinstance(obj, str):
        for m in IMG_RE.finditer(obj):
            bag.add(m.group(1).lower())


def main():
    manifest = {"info_id": INFO_ID, "locales": {}, "images": {}}
    all_names: dict[str, set[str]] = {}  # filename -> locales

    for loc, (base, lang) in LOCALES.items():
        url = f"{base}/server_assets/api/information_detail_{INFO_ID}_{lang}.json"
        print(f"\n=== {loc} {url} ===")
        try:
            raw = fetch(url)
        except Exception as e:
            print(f"FAIL: {e}")
            continue
        data = json.loads(raw.decode("utf-8"))
        out_json = OUT / f"_detail_{INFO_ID}_{loc}.json"
        out_json.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"saved {out_json.name} ({len(raw)} bytes)")

        names: set[str] = set()
        collect_image_names(data, names)
        # also scan full text dump
        text = json.dumps(data, ensure_ascii=False)
        for m in IMG_RE.finditer(text):
            names.add(m.group(1).lower())
        # banner
        banner = data.get("banner_image_path") or ""
        bm = HASH_FILE_RE.search(banner)
        if bm:
            names.add(bm.group(1).lower())

        print(f"images in content: {len(names)}")
        for n in sorted(names):
            print(f"  {n}")
            all_names.setdefault(n, set()).add(loc)

        # Study: print block summary
        blocks = data.get("information_block_list") or []
        print(f"blocks: {len(blocks)}")
        for i, b in enumerate(blocks[:30]):
            if not isinstance(b, dict):
                continue
            t = b.get("information_block_type")
            c = str(b.get("content") or "")[:120].replace("\n", " | ")
            print(f"  [{i}] type={t} {c}")

        manifest["locales"][loc] = {
            "api": url,
            "title": data.get("title"),
            "image_names": sorted(names),
            "block_count": len(blocks),
        }

    print(f"\n=== download {len(all_names)} unique assets ===")
    # Prefer GL CDN for downloads (same hashes across locales usually)
    cdn_bases = [
        "https://web.gl.eternal.channel.or.jp/server_assets/img/",
        "https://web.jp.eternal.channel.or.jp/server_assets/img/",
    ]
    for name, locs in sorted(all_names.items()):
        stem = name.rsplit(".", 1)[0]
        raw_path = OUT / name
        webp_path = OUT / f"{stem}.webp"
        meta = {"name": name, "locales": sorted(locs)}
        ok = False
        if raw_path.exists() and raw_path.stat().st_size > 100:
            print(f"skip raw {name}")
            ok = True
        else:
            for base in cdn_bases:
                url = base + name
                try:
                    print(f"DL {name} from {base.split('//')[1].split('/')[0]} ({','.join(sorted(locs))})")
                    data = fetch(url, timeout=120)
                    raw_path.write_bytes(data)
                    print(f"  wrote {len(data)} bytes")
                    ok = True
                    meta["url"] = url
                    break
                except Exception as e:
                    print(f"  fail {e}")
        if ok:
            meta["raw"] = raw_path.name
            if not webp_path.exists() or webp_path.stat().st_size < 50:
                if to_webp(raw_path, webp_path):
                    print(f"  webp {webp_path.name} ({webp_path.stat().st_size})")
                    meta["webp"] = webp_path.name
            else:
                print(f"skip webp {webp_path.name}")
                meta["webp"] = webp_path.name
        else:
            meta["error"] = "download_failed"
        manifest["images"][stem] = meta

    print("\n=== convert remaining local PNGs ===")
    for png in sorted(OUT.glob("*.png")):
        webp = png.with_suffix(".webp")
        if webp.exists() and webp.stat().st_size > 50:
            continue
        if to_webp(png, webp):
            print(f"  {png.name} -> {webp.name} ({webp.stat().st_size})")

    man = OUT / f"_manifest_{INFO_ID}.json"
    man.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nmanifest -> {man}")


if __name__ == "__main__":
    main()
