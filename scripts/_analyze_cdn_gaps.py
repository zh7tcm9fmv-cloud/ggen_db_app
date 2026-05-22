#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path
from urllib.parse import unquote

APP = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_app")
STATIC = APP / "static" / "images"
CDN = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_images\images")

cdn_files: dict[str, Path] = {}
for p in CDN.rglob("*"):
    if not p.is_file():
        continue
    rel = p.relative_to(CDN).as_posix()
    cdn_files[rel] = p
    dec = unquote(rel)
    if dec != rel:
        cdn_files[dec] = p


def cdn_has(rel: str) -> tuple[str, str | None]:
    rel = rel.lstrip("/")
    if rel.startswith("static/images/"):
        rel = rel[len("static/images/") :]
    if rel.startswith("images/"):
        rel = rel[len("images/") :]
    for key in (rel, unquote(rel)):
        if key in cdn_files:
            return "ok", key
    base, ext = os.path.splitext(unquote(rel))
    if ext.lower() in (".png", ".jpg", ".jpeg"):
        w = base + ".webp"
        if w in cdn_files:
            return "ok", w
    if unquote(rel).endswith(".webp"):
        for alt in (base + ".png", base + ".jpg", base + ".jpeg"):
            if alt in cdn_files:
                return "png_only", alt
    return "missing", None


pat = re.compile(r"/static/images/[^\s\"'<>\\)]+", re.I)
refs: set[str] = set()
for root, dirs, files in os.walk(APP):
    dirs[:] = [d for d in dirs if d not in {".git", "__pycache__", "node_modules", ".venv", "venv"}]
    for fn in files:
        if not fn.endswith((".py", ".js", ".html", ".css", ".json", ".md")):
            continue
        try:
            text = (Path(root) / fn).read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for m in pat.finditer(text):
            refs.add(m.group(0).split("?")[0])

need: set[str] = set()
for r in refs:
    rel = r[len("/static/images/") :]
    base, ext = os.path.splitext(rel)
    if ext.lower() == ".webp" or "%" in rel:
        need.add(rel)
    elif ext.lower() in (".png", ".jpg", ".jpeg"):
        need.add(base + ".webp")

missing = []
encoding = []
png_only = []
for rel in sorted(need):
    if "{" in rel:
        continue
    status, info = cdn_has(rel)
    if status == "ok":
        if info and info != rel and unquote(rel) != rel:
            encoding.append({"requested": rel, "on_cdn": info})
    elif status == "png_only":
        png_only.append({"requested": rel, "png": info})
    else:
        missing.append(rel)

# static webp not on cdn (exact path)
static_only = []
for p in STATIC.rglob("*.webp"):
    rel = p.relative_to(STATIC).as_posix()
    if rel not in cdn_files and unquote(rel) not in cdn_files:
        static_only.append(rel)

# static png/jpg without webp on cdn
convert_candidates = []
for p in STATIC.rglob("*"):
    if p.suffix.lower() not in (".png", ".jpg", ".jpeg"):
        continue
    rel = p.relative_to(STATIC).as_posix()
    webp = rel.rsplit(".", 1)[0] + ".webp"
    if webp not in cdn_files and unquote(webp) not in cdn_files:
        convert_candidates.append({"webp": webp, "src": rel})

out = {
    "refs_total": len(refs),
    "need_total": len(need),
    "missing_on_cdn": missing,
    "encoding_mismatch": encoding,
    "png_only_on_cdn": png_only,
    "static_webp_not_on_cdn": static_only,
    "static_convert_candidates_count": len(convert_candidates),
    "static_convert_candidates_sample": convert_candidates[:30],
}
report = APP / "scripts" / "_cdn_gap_analysis.json"
report.write_text(json.dumps(out, indent=2), encoding="utf-8")
print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in out.items()}, indent=2))
print("report", report)
