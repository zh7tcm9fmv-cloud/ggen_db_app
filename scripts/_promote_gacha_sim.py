"""One-shot: promote _mocks/gacha_sim_mock.html → static + panel + published pool."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
mock = (ROOT / "_mocks" / "gacha_sim_mock.html").read_text(encoding="utf-8")

# --- CSS ---
m = re.search(r"<style>\n(.*?)\n</style>", mock, re.S)
assert m, "style block missing"
css = m.group(1)
css = css.replace(
    'html, body { margin: 0; min-height: 100%; background: var(--bg); color: #e8eef8; font-family: "Segoe UI", system-ui, sans-serif; }',
    '.gacha-sim-root { color: #e8eef8; font-family: "Segoe UI", system-ui, sans-serif; }',
)
css = re.sub(
    r"\n  html \{[^}]+\}\n  html::-webkit-scrollbar \{[^}]+\}\n",
    "\n",
    css,
    count=1,
)
# Keep pull stage under detail modal (~500+)
if ".stage {" in css:
    chunk = css[css.find(".stage {") : css.find(".stage {") + 180]
    if "z-index" not in chunk:
        css = css.replace(".stage {", ".stage {\n    z-index: 420;", 1)
css = "/* Gacha Sim — Unit Assembly pull simulator */\n" + css + "\n"
(ROOT / "static" / "css" / "gacha_sim.css").write_text(css, encoding="utf-8")
print("css", len(css))

# --- Panel HTML (lobby + hover + stage through skip) ---
body_m = re.search(
    r'(<div class="lobby" id="lobby">.*?<button class="skip"[^>]*>Skip</button>\s*</div>)',
    mock,
    re.S,
)
assert body_m, "lobby/stage body missing"
inner = body_m.group(1)
inner = inner.replace(
    '<p class="kicker">LOCAL MOCK</p>\n      <h1>Unit Assembly — card assemble</h1>\n'
    '      <p class="note">Simulator mock — not affiliated with Bandai Namco. Unit base/frame follow <code>New Project(2).psd</code> Layer 5 (−3,−16 / 452×237) under Layer 6 (446×219). Portraits use Collections Regular cover crop. No portrait fade animation.</p>',
    '<p class="kicker">GACHA SIM</p>\n      <h1>Unit Assembly Simulator</h1>\n'
    '      <p class="note">Unofficial pull simulator using official published drop tables. Not affiliated with Bandai Namco.</p>',
)
inner = inner.replace("SAMPLE PICKUP", "FEATURED PICKUP")
# Drop developer gallery sections for the live page (keep PULL SIM + session)
inner = re.sub(
    r'\s*<h2>IN-GAME REFS</h2>\s*<div class="ref-strip" id="refStrip"></div>\s*'
    r'<h2>ASSEMBLED TIERS</h2>\s*<div class="gc-grid" id="unitGallery"></div>\s*'
    r'<h2>SUPPORTERS</h2>\s*<div class="gc-grid" id="suppGallery"></div>\s*'
    r'<h2>LIVE CSS STACK</h2>\s*<div class="gc-grid" id="liveGallery"></div>\s*'
    r'<h2>PULL SIM</h2>',
    "\n      <h2>PULL</h2>",
    inner,
    count=1,
)
panel = (
    '{# Gacha Sim panel — Unit Assembly pull simulator #}\n'
    '<div class="gacha-sim-root" id="gachaSimRoot">\n'
    + inner
    + "\n</div>\n"
)
(ROOT / "templates" / "_gacha_sim_panel.html").write_text(panel, encoding="utf-8")
print("panel", len(panel))

# --- JS ---
js_m = re.search(
    r"<script>\n(\(function \(\) \{.*?\}\)\(\);\s*)\n</script>\s*</body>",
    mock,
    re.S,
)
assert js_m, "script block missing"
js = js_m.group(1)
js = js.replace(
    'var CDN = "https://cdn.jsdelivr.net/gh/zh7tcm9fmv-cloud/ggen_db_images@main/images/";',
    """var CDN = (function () {
    try {
      if (window.__GGEN_IMAGE_CDN__ && window.__GGEN_GAME_IMAGES_USE_CDN__ !== false) {
        return String(window.__GGEN_IMAGE_CDN__).replace(/\\/?$/, '/') + 'images/';
      }
    } catch (e) {}
    return "https://cdn.jsdelivr.net/gh/zh7tcm9fmv-cloud/ggen_db_images@main/images/";
  })();""",
)
js = js.replace('var LOCAL = "gacha_card_assemble/";', 'var LOCAL = "/static/gacha_sim/";')
js = js.replace('var REFS = "gacha_card_refs/";', 'var REFS = "/static/gacha_sim/refs/";')
js = js.replace('fetch("gacha_sim_pool.json")', 'fetch("/api/gacha_sim/pool")')
js = js.replace(
    """  function openDbDetail(kind, id) {
    var url = detailUrl(kind, id);
    if (!url) return;
    /* Same tab — navigate like /u/{id} or /s/{id} */
    location.assign(url);
  }""",
    """  function openDbDetail(kind, id) {
    if (!id) return;
    var type = (kind === "supp" || kind === "supporter") ? "supporter" : "unit";
    /* Stay on /gacha-sim — open site detail modal (same UX as /u / /s) */
    if (typeof window.openDetail === "function") {
      window.openDetail(type, String(id), { skipHistory: true });
      return;
    }
    var url = detailUrl(kind, id);
    if (url) location.assign(url);
  }""",
)
js = js.replace("Gacha sim mock", "Gacha Sim")
# Wrap as GgenGachaSim
assert js.startswith("(function () {")
assert js.rstrip().endswith("})();")
js = (
    "window.GgenGachaSim = (function () {\n"
    "  function onTabShown() { return Promise.resolve(window.GgenGachaSim); }\n"
    + js[len("(function () {") :].rstrip()[:-5]
    + "\n  return { onTabShown: onTabShown, openDbDetail: openDbDetail };\n"
    "})();\n"
)
(ROOT / "static" / "js" / "gacha_sim.js").write_text(js, encoding="utf-8")
print("js", len(js))

# --- Assets + pool ---
src = ROOT / "_mocks" / "gacha_card_assemble"
dst = ROOT / "static" / "gacha_sim"
dst.mkdir(parents=True, exist_ok=True)
n = 0
for pat in ("assemble_*.webp", "layer_*.webp", "fx_*.webp", "psd_*.webp", "psd_supporter_*.png"):
    for f in src.glob(pat):
        shutil.copy2(f, dst / f.name)
        n += 1
pub = ROOT / "data" / "published"
pub.mkdir(parents=True, exist_ok=True)
shutil.copy2(ROOT / "_mocks" / "gacha_sim_pool.json", pub / "gacha_sim_pool.json")
# Update builder OUT path note — keep writing _mocks for now; copy on promote
print("copied assets", n, "pool published")
