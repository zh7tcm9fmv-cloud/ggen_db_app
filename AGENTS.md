# AGENTS.md

## Cursor Cloud specific instructions

This repo is **GGen Database** — a single Flask monolith (`app.py`) + vanilla-JS SPA (`templates/`, `static/js/app.js`) backed by bundled JSON game data under `data/{EN,TW,HK,JA}/`. There is **no SQL/NoSQL database** and **no Node build step** (pip is the only package manager).

Dependencies are installed by the startup update script into a virtualenv at `.venv/`. Use `.venv/bin/python` for all commands below.

### Run (development)
- `FLASK_DEBUG=0 .venv/bin/python app.py` serves on `http://127.0.0.1:5000` (override with `FLASK_PORT`/`PORT`).
- **Cold start is slow (~10–40s):** the app loads ~6k units × 4 languages and builds browse caches *before* the server accepts requests. Wait for `Running on http://127.0.0.1:5000` in the log and poll `GET /health` (returns `{"ok":true,...}`) before testing.
- Auto-reload is **off by default** (`FLASK_USE_RELOADER=1` to enable) because the reloader loads the full DB twice. After changing Python/data files you must restart the process to pick up changes.
- Image art is served from an optional CDN; locally most cards show a default avatar fallback (not a bug). Set `IMAGE_CDN=...` for full art.

### Test
- `.venv/bin/python -m unittest discover -s tests -v` runs the unit suite (~17 tests; note these also load the full DB so they take ~10s+).

### Lint / Build
- No linter and no build step are configured for the app itself.
