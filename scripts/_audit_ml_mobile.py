"""One-shot mobile layout audit for /ml stage-boost-deploy."""
from __future__ import annotations

import json
import os
from playwright.sync_api import sync_playwright

URL = os.environ.get("ML_AUDIT_URL", "http://127.0.0.1:5000/ml")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_ml_mobile_audit")
os.makedirs(OUT, exist_ok=True)


def dismiss_gate(page) -> None:
    # Human gate: tap gold Haro, or Continue.
    for _ in range(3):
        try:
            gold = page.locator(
                '#humanGateOverlay img[alt*="gold" i], #humanGateOverlay .haro-gold, '
                '#humanGateOverlay button, #humanGateContinue'
            )
            if gold.count():
                for i in range(gold.count()):
                    el = gold.nth(i)
                    if el.is_visible():
                        el.click(timeout=2000)
                        page.wait_for_timeout(600)
            ov = page.locator("#humanGateOverlay")
            if not ov.count() or ov.first.get_attribute("aria-hidden") == "true":
                return
            if ov.count() and not ov.first.is_visible():
                return
        except Exception:
            pass
        page.wait_for_timeout(400)
    # Force-hide if still blocking screenshots
    page.evaluate(
        """() => {
          const ov = document.getElementById('humanGateOverlay');
          if (ov) { ov.style.display='none'; ov.setAttribute('aria-hidden','true'); }
          document.documentElement.classList.remove('human-gate-lock');
          document.body && document.body.classList.remove('human-gate-lock');
        }"""
    )


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
            user_agent=(
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
                "Mobile/15E148 Safari/604.1"
            ),
        )
        page = context.new_page()
        page.goto(URL, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(1500)
        dismiss_gate(page)
        page.wait_for_selector(".ml-boost-card, .ml-deploy", timeout=120000)
        # Drop cached stylesheet + force a fresh master_league.css (Playwright HTTP cache).
        page.evaluate(
            """() => {
              [...document.querySelectorAll('link[rel="stylesheet"]')].forEach((l) => {
                if (l.href && l.href.includes('master_league.css')) l.remove();
              });
              const l = document.createElement('link');
              l.rel = 'stylesheet';
              l.href = '/static/css/master_league.css?v=mlmob' + Date.now();
              document.head.appendChild(l);
            }"""
        )
        page.wait_for_function(
            """() => {
              const el = document.querySelector('.ml-boost-inner--info-base');
              return !!(el && el.getBoundingClientRect().width > 300);
            }""",
            timeout=30000,
        )
        page.wait_for_timeout(400)
        dismiss_gate(page)
        # Ensure ML panel visible
        page.evaluate(
            """() => {
              const p = document.getElementById('panel-master_league');
              if (p) p.classList.add('active','is-ml-skin-ready');
            }"""
        )
        page.wait_for_timeout(800)
        # Scroll plate into view before measuring
        page.evaluate(
            """() => {
              const el = document.querySelector('.ml-boost-banner') || document.querySelector('.ml-deploy');
              if (el) el.scrollIntoView({block:'start'});
            }"""
        )
        page.wait_for_timeout(400)
        for sel, name in (
            (".ml-boost-banner", "boost"),
            (".ml-boost-inner--info-base", "info_base"),
            (".ml-boost-schedule", "sched"),
            (".ml-deploy", "deploy"),
            (".ml-deploy-stage", "deploy_stage"),
        ):
            loc = page.locator(sel).first
            if loc.count():
                loc.scroll_into_view_if_needed()
                page.wait_for_timeout(200)
                loc.screenshot(path=os.path.join(OUT, f"{name}.png"))
                print(name, loc.bounding_box())
            else:
                print(name, "MISSING")
        info = page.evaluate(
            """() => {
              const q = (s) => document.querySelector(s);
              const cs = (el) => (el ? getComputedStyle(el) : null);
              const rect = (el) => {
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return {x:r.x,y:r.y,w:r.width,h:r.height};
              };
              const plate = q('.ml-boost-inner--info-base');
              const tags = q('.ml-boost-tags');
              const pct = q('.ml-boost-pct');
              const boost = q('.ml-boost-info-boost-main');
              const stage = q('.ml-boost-info-stage');
              const bg = plate ? cs(plate).backgroundImage : '';
              const overflow = {};
              if (plate && tags) {
                const pr = plate.getBoundingClientRect();
                const tr = tags.getBoundingClientRect();
                overflow.tagsRightPastPlate = Math.round(tr.right - pr.right);
                overflow.tagsBottomPastPlate = Math.round(tr.bottom - pr.bottom);
              }
              if (plate && pct) {
                const pr = plate.getBoundingClientRect();
                const tr = pct.getBoundingClientRect();
                overflow.pctRightPastPlate = Math.round(tr.right - pr.right);
                overflow.pctBottomPastPlate = Math.round(tr.bottom - pr.bottom);
              }
              if (boost && tags) {
                const br = boost.getBoundingClientRect();
                const tr = tags.getBoundingClientRect();
                overflow.tagsRightPastBoost = Math.round(tr.right - br.right);
                overflow.tagsBottomPastBoost = Math.round(tr.bottom - br.bottom);
              }
              return {
                vw: window.innerWidth,
                bgSample: (bg || '').slice(0, 120),
                plate: rect(plate),
                title: rect(q('.ml-boost-info-title')),
                stage: rect(stage),
                boost: rect(boost),
                tags: rect(tags),
                pct: rect(pct),
                terrainName: cs(q('.ml-boost-terrain-name'))?.fontSize,
                heading: cs(q('.ml-boost-heading'))?.fontSize,
                titleFs: cs(q('.ml-boost-info-title'))?.fontSize,
                deployBody: rect(q('.ml-deploy-body')),
                deployStage: rect(q('.ml-deploy-stage')),
                grid: rect(q('.ml-deploy-grid')),
                sideE: rect(q('.ml-deploy-side--enemy')),
                sideA: rect(q('.ml-deploy-side--ally')),
                forceFs: cs(q('.ml-deploy-force-name'))?.fontSize,
                overflow,
                plateHtml: plate ? plate.innerText.slice(0, 200) : null,
              };
            }"""
        )
        print(json.dumps(info, indent=2))
        with open(os.path.join(OUT, "metrics.json"), "w", encoding="utf-8") as f:
            json.dump(info, f, indent=2)
        # Viewport shot of boost+deploy area
        page.screenshot(path=os.path.join(OUT, "viewport.png"))
        browser.close()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
