#!/usr/bin/env python3
"""Ensure brand-emblem WebP exists in app static (CDN already has it)."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
CDN_UI = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\UI")
APP_UI = ROOT / "static" / "images" / "UI"
src = CDN_UI / "brand-emblem-panel.webp"
dst = APP_UI / "brand-emblem-panel.webp"
if not src.is_file():
    raise SystemExit(f"missing CDN source: {src}")
APP_UI.mkdir(parents=True, exist_ok=True)
shutil.copy2(src, dst)
print(f"copied {src} -> {dst} ({dst.stat().st_size} bytes)")

css_path = ROOT / "static" / "css" / "app_shell.css"
css = css_path.read_text(encoding="utf-8")
if "var(--brand-emblem-url" in css:
    css = css.replace(
        "background:var(--brand-emblem-url,url('/static/images/UI/brand-emblem-panel.webp'))",
        "background:url('/static/images/UI/brand-emblem-panel.webp')",
    )
    css_path.write_text(css, encoding="utf-8")
    print("removed CSS var from app_shell.css (Dark Reader-safe)")
else:
    print("app_shell.css already uses plain emblem url")
