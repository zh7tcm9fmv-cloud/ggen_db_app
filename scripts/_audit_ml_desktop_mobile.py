"""Compare desktop vs mobile /ml boost+deploy geometry (local CSS from disk)."""
from __future__ import annotations

import json
import os
from playwright.sync_api import sync_playwright

CSS_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "static", "css", "master_league.css"
)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_ml_mobile_audit")
os.makedirs(OUT, exist_ok=True)
URL = os.environ.get("ML_AUDIT_URL", "http://127.0.0.1:5000/ml")


def measure(page):
    return page.evaluate(
        """() => {
          const q = (s) => document.querySelector(s);
          const r = (el) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return {x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1)};
          };
          const cs = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
          const plate = q('.ml-boost-inner--info-base');
          const dep = q('.ml-deploy-stage');
          const grid = q('.ml-deploy-grid');
          return {
            vw: innerWidth,
            plate: r(plate),
            plateAspect: plate ? (plate.getBoundingClientRect().width / plate.getBoundingClientRect().height) : null,
            title: r(q('.ml-boost-info-title')),
            stage: r(q('.ml-boost-info-stage')),
            boost: r(q('.ml-boost-info-boost-main')),
            terrain: r(q('.ml-boost-terrain-line')),
            tags: r(q('.ml-boost-tags')),
            pct: r(q('.ml-boost-pct')),
            sched: r(q('.ml-boost-schedule')),
            deployBody: r(q('.ml-deploy-body')),
            deployStage: r(dep),
            deployDisplay: cs(dep, 'display'),
            deployCols: cs(dep, 'gridTemplateColumns'),
            sideE: r(q('.ml-deploy-side--enemy')),
            sideA: r(q('.ml-deploy-side--ally')),
            grid: r(grid),
            gridAspect: grid ? (grid.getBoundingClientRect().width / grid.getBoundingClientRect().height) : null,
            forceFs: cs(q('.ml-deploy-force-name'), 'fontSize'),
          };
        }"""
    )


def shot(page, name):
    for sel, key in (
        (".ml-boost-banner", "boost"),
        (".ml-boost-inner--info-base", "plate"),
        (".ml-deploy", "deploy"),
    ):
        loc = page.locator(sel).first
        if loc.count():
            loc.scroll_into_view_if_needed()
            loc.screenshot(path=os.path.join(OUT, f"{name}_{key}.png"))


def run_viewport(p, width, height, label, css_body):
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=2,
        is_mobile=width < 600,
        has_touch=width < 600,
    )
    page = context.new_page()

    def handle_route(route):
        if "master_league.css" in route.request.url:
            route.fulfill(status=200, content_type="text/css; charset=utf-8", body=css_body)
        else:
            route.continue_()

    page.route("**/*", handle_route)
    page.goto(URL, wait_until="domcontentloaded", timeout=120000)
    page.wait_for_timeout(1500)
    page.evaluate(
        """() => {
          const ov = document.getElementById('humanGateOverlay');
          if (ov) { ov.style.display='none'; ov.setAttribute('aria-hidden','true'); }
          document.getElementById('panel-master_league')?.classList.add('active','is-ml-skin-ready');
        }"""
    )
    page.wait_for_selector(".ml-boost-inner--info-base, .ml-deploy", timeout=120000)
    page.wait_for_timeout(1500)
    page.evaluate(
        """() => {
          const el = document.querySelector('.ml-boost-banner') || document.querySelector('.ml-deploy');
          if (el) el.scrollIntoView({block:'start'});
        }"""
    )
    page.wait_for_timeout(300)
    data = measure(page)
    shot(page, label)
    browser.close()
    return data


def main() -> None:
    css_body = open(CSS_PATH, encoding="utf-8").read()
    with sync_playwright() as p:
        desk = run_viewport(p, 1280, 900, "desk", css_body)
        mob = run_viewport(p, 390, 844, "mob", css_body)
    out = {"desktop": desk, "mobile": mob}
    print(json.dumps(out, indent=2))
    with open(os.path.join(OUT, "desk_vs_mob.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)


if __name__ == "__main__":
    main()
