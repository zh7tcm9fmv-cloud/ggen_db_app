#!/usr/bin/env python3
import os
import time

os.environ.setdefault("IMAGE_CDN", "https://zh7tcm9fmv-cloud.github.io/ggen_db_images")
from app import app

c = app.test_client()
r = c.get("/")
html = r.data.decode("utf-8", "replace")
assert "brand-emblem-panel.webp" in html
assert "brand-emblem-url" not in html, "CSS var url() must not be used (Dark Reader crash)"
assert "ggen_db_images/images/UI/brand-emblem-panel.webp" in html or "/static/images/UI/brand-emblem-panel.webp" in html
print("index emblem override OK (no CSS var)")

r2 = c.get("/static/images/UI/brand-emblem-panel.webp")
assert r2.status_code == 200 and len(r2.data) > 1000, r2.status_code
print("static webp", r2.status_code, len(r2.data))

r3 = c.get("/static/css/app_shell.css")
assert b"var(--brand-emblem-url" not in r3.data
assert b"brand-emblem-panel.webp" in r3.data
print("css plain url OK")

# warm lists then detail
url = "/api/characters?lang=EN&page=1&per_page=5&sort=rarity&dir=desc&q="
chars = None
for _ in range(60):
    chars = c.get(url)
    if chars.status_code == 200:
        break
    time.sleep(0.5)
assert chars is not None and chars.status_code == 200, getattr(chars, "status_code", None)
rows = (chars.get_json() or {}).get("rows") or []
cid = str(rows[0]["id"])
det = c.get(f"/api/character/{cid}?lang=EN")
data = det.get_json() or {}
assert det.status_code == 200 and data.get("name"), (det.status_code, data)
print("char detail OK", cid, data.get("name"))

# JS bundle present
js = c.get("/static/js/app.min.js")
print("app.min.js", js.status_code, len(js.data))
assert js.status_code == 200
print("ALL CHECKS PASSED")
