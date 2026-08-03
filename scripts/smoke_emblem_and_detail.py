#!/usr/bin/env python3
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

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

html = c.get("/").data.decode("utf-8", "replace")
assert "app_shell_bundle.min.css" in html, "index must use shell CSS bundle"
assert "css/app_shell.css" not in html
assert "css/mobile_layout.css" not in html
assert "css/ui_motion.css" not in html
rb = c.get("/static/css/app_shell_bundle.min.css")
assert rb.status_code == 200 and len(rb.data) > 10000
assert b"var(--brand-emblem-url" not in rb.data
assert b"brand-emblem-panel.webp" in rb.data
assert b"ability-icon-stack--ex" in rb.data, "EX ability icon CSS must be in shell bundle (not lazy craft_ui)"
print("shell CSS bundle OK", len(rb.data))

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
etag = det.headers.get("ETag")
assert etag, "detail response missing ETag"
print("char detail OK", cid, data.get("name"), "etag", etag)

det304 = c.get(f"/api/character/{cid}?lang=EN", headers={"If-None-Match": etag})
assert det304.status_code == 304, det304.status_code
print("char detail 304 OK")

# JS bundle present; Top 10 pilots + ML/craft CSS are lazy (not on cold /)
js = c.get("/static/js/app.min.js")
print("app.min.js", js.status_code, len(js.data))
assert js.status_code == 200
html = c.get("/").data.decode("utf-8", "replace")
assert "unit_best_pilots.js" not in html or "ensureUnitBestPilots" in html
assert 'unit_best_pilots.css' not in html.split("__GGEN_LAZY__")[0], "UBP CSS must not be eager in <head>"
assert "ensureUnitBestPilots" in html and "ensureMasterLeagueCss" in html and "ensureCraftUiCss" in html
assert "ensureContentNotices" in html
assert "ensureTeamBuilder" in html
import re
assert not re.search(r'<script[^>]+src="[^"]*content_notices\.js"', html), "content_notices.js must not be an eager <script src>"
assert not re.search(r'<script[^>]+src="[^"]*team_builder\.js"', html), "team_builder.js must not be an eager <script src>"
assert b"ensureContentNoticesLoaded" in js.data
assert b"ensureTeamBuilderLoaded" in js.data
assert b"bootTeamBuilderTab" in js.data
assert b"ensureUnitBestPilotsLoaded" in js.data
tb = c.get("/static/js/team_builder.js")
assert tb.status_code == 200 and b"GgenTeamBuilder" in tb.data
print("lazy asset wiring OK")
print("ALL CHECKS PASSED")
