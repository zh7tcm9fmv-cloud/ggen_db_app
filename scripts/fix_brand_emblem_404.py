#!/usr/bin/env python3
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
CDN_UI = Path(r"C:\Users\Mikew0911\Desktop\ggen_db_images\images\UI")
APP_UI = ROOT / "static" / "images" / "UI"

# 1) Copy missing webp emblem into app static so /static/...webp works
src = CDN_UI / "brand-emblem-panel.webp"
dst = APP_UI / "brand-emblem-panel.webp"
if not src.is_file():
    raise SystemExit(f"missing CDN source: {src}")
APP_UI.mkdir(parents=True, exist_ok=True)
shutil.copy2(src, dst)
print(f"copied {src} -> {dst} ({dst.stat().st_size} bytes)")

# 2) Patch app_shell.css to use CSS var for emblem (CDN-aware from index.html)
css_path = ROOT / "static" / "css" / "app_shell.css"
css = css_path.read_text(encoding="utf-8")
old = "background:url('/static/images/UI/brand-emblem-panel.webp')"
new = "background:var(--brand-emblem-url,url('/static/images/UI/brand-emblem-panel.webp'))"
if old not in css:
    if "var(--brand-emblem-url" in css:
        print("css already uses --brand-emblem-url")
    else:
        raise SystemExit("emblem url pattern not found in app_shell.css")
else:
    css = css.replace(old, new, 1)
    css_path.write_text(css, encoding="utf-8")
    print("patched app_shell.css emblem to CSS variable")

# Report other hardcoded static image urls
urls = re.findall(r"url\(['\"]?(/static/images/[^'\")\s]+)['\"]?\)", css)
print(f"hardcoded /static/images urls in app_shell.css: {len(set(urls))} unique")
