# /tl 1.5 featured HUD — parked mock (not live)

Parked **Oct 2026**. Live `/tl` uses classic unit/char/supporter strips only.

## Contents

| File | Role |
|---|---|
| `bt_feat_15.css` | Chamfer HUD card styles (was `static/css/bt_feat_15.css`) |
| `bt_feat_15_app_snippet.js` | JS helpers that rendered the HUD (not loaded by the app) |
| `lazy_placeholder_fragment.css` | Moved into `app_shell.css` for classic lazy-ended pools |

## Re-enable later

1. Restore CSS under `static/css/` and link from `templates/index.html` behind an explicit env gate.
2. Re-integrate the snippet into `app.js` (or a deferred module) and branch from `btFeaturedMergedCell`.
3. Do **not** ship thum-for-portrait or stripped glow/clip “perf” shortcuts — design first; leave off live if too heavy.

Special Design (`html.ggen-15` / `ggen_15.css`) for the rest of the site is unrelated and stays.
