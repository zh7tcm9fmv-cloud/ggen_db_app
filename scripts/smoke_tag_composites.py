#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Smoke Tag/Series composites: CSS locks + live DOM geometry.

Nov 2026: text-stroke / translateY looked fine in local preview but stretched
SERIES plates and clipped value text on Railway. This gate catches both.

Usage:
  python scripts/smoke_tag_composites.py
  python scripts/smoke_tag_composites.py --base https://ggendb.up.railway.app
  python scripts/smoke_tag_composites.py --css-only
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


PLATE_EXPECT = {
    "UI_Common_Label_Tag_icon_Base.webp": (42, 36),
    "UI_Common_Label_Tag_Text.webp": (53, 36),
    "UI_Common_Label_Series_icon_Base.webp": (42, 36),
    "UI_Common_Label_Series_Text.webp": (53, 36),
}


def check_plate_assets(cdn_base: str | None = None) -> list[str]:
    """Tight crops must stay 42×36 / 53×36 — live CDN 50-tall plates stretch SERIES."""
    errs: list[str] = []
    try:
        from PIL import Image
    except ImportError:
        return ["PIL required to verify plate pixel sizes"]
    ui = ROOT / "static" / "images" / "UI"
    for name, size in PLATE_EXPECT.items():
        path = ui / name
        if not path.is_file():
            errs.append(f"missing plate {name}")
            continue
        got = Image.open(path).size
        if got != size:
            errs.append(f"local {name} is {got}, expected {size} (tight crop)")
    if cdn_base:
        import urllib.request
        from io import BytesIO

        base = cdn_base.rstrip("/")
        for name, size in PLATE_EXPECT.items():
            url = f"{base}/images/UI/{name}"
            try:
                with urllib.request.urlopen(url, timeout=20) as resp:
                    data = resp.read()
                got = Image.open(BytesIO(data)).size
            except Exception as e:
                errs.append(f"CDN fetch failed {url}: {e}")
                continue
            if got != size:
                errs.append(
                    f"CDN {name} is {got}, expected {size} — push ggen_db_images tight crops"
                )
    return errs


def check_css() -> list[str]:
    """Static guards in source + shipped bundle."""
    errs: list[str] = []
    shell = ROOT / "static" / "css" / "app_shell.css"
    bundle = ROOT / "static" / "css" / "app_shell_bundle.min.css"
    for label, path in (("app_shell.css", shell), ("app_shell_bundle.min.css", bundle)):
        if not path.is_file():
            errs.append(f"missing {label}")
            continue
        text = _read(path)
        # Narrow to tag-part-value* rules where possible
        for m in re.finditer(
            r"\.tag-part-value(?:-text|-word)?\s*\{[^}]*\}",
            text,
            flags=re.S,
        ):
            block = m.group(0)
            if "-webkit-text-stroke" in block and re.search(
                r"-webkit-text-stroke\s*:\s*(?!0(?:px)?\b)[^;]+", block
            ):
                errs.append(f"{label}: non-zero -webkit-text-stroke inside {m.group(0)[:48]}…")
            if re.search(r"translateY\s*\(", block):
                errs.append(f"{label}: translateY on tag value (use flex center; crawl X-only)")
        if "--tag-h:20px" not in text and "--tag-h: 20px" not in text:
            # minified may keep --tag-h:20px
            if "--tag-h:20px" not in text.replace(" ", ""):
                errs.append(f"{label}: missing --tag-h:20px lock")
        if "tag-part-value" in text and "max-height:var(--tag-h)" not in text.replace(" ", ""):
            # allow spaced form
            if not re.search(r"max-height\s*:\s*var\(\s*--tag-h\s*\)", text):
                errs.append(f"{label}: tag parts should max-height:var(--tag-h)")
    # Bundle must be newer-or-equal intent: contain shadow frame, not stroke on values
    if bundle.is_file():
        b = _read(bundle)
        if ".tag-part-value-text" in b or "tag-part-value-text" in b:
            # stroke:0 is ok; positive stroke not
            if re.search(
                r"tag-part-value-text\{[^}]*-webkit-text-stroke:(?!0(?:px)?\b)[^;]+",
                b,
            ):
                errs.append("bundle: tag-part-value-text still has active text-stroke")
    return errs


def check_dom(base: str, timeout_ms: int) -> tuple[dict, list[str]]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {}, ["playwright required: pip install playwright && playwright install chromium"]

    errs: list[str] = []
    out: dict = {}
    # /s = supporters short path (same as live browse)
    url = base.rstrip("/") + "/s?design=15"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        page_errors: list[str] = []
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
        page.evaluate(
            """() => {
              try { localStorage.setItem('ggen_design_15', '1'); } catch (_) {}
              try { localStorage.setItem('ggen_list_view_supporters', 'grid'); } catch (_) {}
            }"""
        )
        page.reload(wait_until="domcontentloaded", timeout=timeout_ms)
        # Boot may take a while on cold local
        try:
            page.wait_for_function(
                """() => {
                  const n = document.querySelectorAll(
                    '#suppGrid .tag-composite:not(.list-filter-tag-composite), #suppTable .tag-composite:not(.list-filter-tag-composite), #panel-supporters .tag-composite:not(.list-filter-tag-composite)'
                  ).length;
                  return n > 0;
                }""",
                timeout=timeout_ms,
            )
        except Exception as e:
            browser.close()
            return {"url": url, "pageErrors": page_errors}, [f"no tag-composite on supporters: {e}"]

        page.wait_for_timeout(800)
        info = page.evaluate(
            """() => {
              const nodes = Array.from(document.querySelectorAll(
                '#suppGrid .tag-composite:not(.list-filter-tag-composite), #suppTable .tag-composite:not(.list-filter-tag-composite), #panel-supporters .tag-composite:not(.list-filter-tag-composite)'
              )).slice(0, 12);
              const rows = [];
              for (const el of nodes) {
                const icon = el.querySelector('.tag-part-icon');
                const label = el.querySelector('.tag-part-label');
                const value = el.querySelector('.tag-part-value');
                const text = el.querySelector('.tag-part-value-text');
                if (!icon || !label || !value) continue;
                const ir = icon.getBoundingClientRect();
                const lr = label.getBoundingClientRect();
                const vr = value.getBoundingClientRect();
                const tr = text ? text.getBoundingClientRect() : null;
                const cs = getComputedStyle(el);
                const tagH = parseFloat(cs.getPropertyValue('--tag-h')) || 20;
                rows.push({
                  cls: el.className,
                  tagH,
                  iconH: Math.round(ir.height * 100) / 100,
                  labelH: Math.round(lr.height * 100) / 100,
                  valueH: Math.round(vr.height * 100) / 100,
                  tops: [ir.top, lr.top, vr.top].map(x => Math.round(x * 10) / 10),
                  textTop: tr ? Math.round(tr.top * 10) / 10 : null,
                  valueTop: Math.round(vr.top * 10) / 10,
                  textBottom: tr ? Math.round(tr.bottom * 10) / 10 : null,
                  valueBottom: Math.round(vr.bottom * 10) / 10,
                  stroke: text ? getComputedStyle(text).webkitTextStrokeWidth || getComputedStyle(text).getPropertyValue('-webkit-text-stroke-width') : '',
                  valueText: (text && text.textContent || '').trim().slice(0, 40),
                });
              }
              return { count: rows.length, rows, pageErrors: [] };
            }"""
        )
        info["pageErrors"] = list(page_errors)
        info["url"] = url
        out = info
        browser.close()

    if page_errors:
        errs.append("pageerror: " + "; ".join(page_errors[:3]))
    rows = out.get("rows") or []
    if len(rows) < 1:
        errs.append("no measurable tag-composite rows")
        return out, errs

    for i, row in enumerate(rows):
        tag_h = float(row.get("tagH") or 20)
        for key in ("iconH", "labelH", "valueH"):
            h = float(row.get(key) or 0)
            if abs(h - tag_h) > 1.25:
                errs.append(
                    f"row{i} {key}={h} != --tag-h={tag_h} (plate stretch risk) text={row.get('valueText')!r}"
                )
        tops = row.get("tops") or []
        if len(tops) == 3:
            if max(tops) - min(tops) > 1.25:
                errs.append(
                    f"row{i} stair-step tops={tops} text={row.get('valueText')!r}"
                )
        # Value ink must sit inside the value box (not clipped top/bottom)
        if row.get("textTop") is not None:
            if float(row["textTop"]) < float(row["valueTop"]) - 0.75:
                errs.append(
                    f"row{i} value text clipped top textTop={row['textTop']} valueTop={row['valueTop']}"
                )
            if float(row["textBottom"]) > float(row["valueBottom"]) + 0.75:
                errs.append(
                    f"row{i} value text clipped bottom textBottom={row['textBottom']} valueBottom={row['valueBottom']}"
                )
        stroke = str(row.get("stroke") or "").strip()
        if stroke and stroke not in ("0px", "0", ""):
            errs.append(f"row{i} active webkitTextStrokeWidth={stroke!r}")

    return out, errs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:5000")
    ap.add_argument("--timeout-ms", type=int, default=120000)
    ap.add_argument("--css-only", action="store_true")
    ap.add_argument(
        "--cdn",
        default="https://zh7tcm9fmv-cloud.github.io/ggen_db_images",
        help="CDN root to verify plate pixel sizes (empty to skip)",
    )
    args = ap.parse_args()

    plate_errs = check_plate_assets(args.cdn or None)
    css_errs = check_css()
    report: dict = {"plate_errors": plate_errs, "css_errors": css_errs}
    dom_errs: list[str] = []
    if not args.css_only:
        dom, dom_errs = check_dom(args.base, args.timeout_ms)
        report["dom"] = dom
        report["dom_errors"] = dom_errs

    print(json.dumps(report, indent=2))
    all_errs = plate_errs + css_errs + dom_errs
    if all_errs:
        print("FAIL:", *all_errs, sep="\n  ", file=sys.stderr)
        return 1
    print("smoke_tag_composites: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
