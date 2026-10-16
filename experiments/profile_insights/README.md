# Profile Insights — parked experiment (Oct 2026)

**Status:** local R&D only. **Not** a live-site product. Do not wire to Railway.

## Why parked

Screenshot → OCR → catalog match for Sorties Top 20 was explored with RapidOCR, layout/box/column crops, Surya, and GOT-OCR 2.0. Fixture audits looked promising; real phone UI + cost/latency made a multi-tenant live path infeasible (CPU VLMs ~30s+/shot when warm; laptop cannot serve thousands of users; Railway would need GPU + queue + spend).

## Live safety

- `/profile` and `/api/profile_insights/*` are **hard-disabled when `RAILWAY_*` is set**, even if someone sets `GGEN_PROFILE_ENABLED`.
- Local opt-in only: `GGEN_PROFILE_ENABLED=1`.
- Not in `sitemap.xml`. Listed under `Disallow` in `robots.txt`.
- No main-nav link to `/profile`.

## What remains in-tree (dormant)

Page/API code still lives under the main app (`templates/profile.html`, `static/js/profile.js`, `profile_insights.py`, RapidOCR worker scripts) so the experiment can be reopened locally without archaeology. GOT/Surya/llama.cpp paths were removed.

## Local reopen (optional)

```powershell
$env:GGEN_PROFILE_ENABLED='1'
python wsgi.py
# → http://127.0.0.1:5000/profile
```

Requires `.venv-paddle` for RapidOCR workers if you exercise OCR again.

OCR fixtures (if kept): `experiments/profile_insights/fixtures/`.
