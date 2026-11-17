from __future__ import annotations

import json
import os
from playwright.sync_api import sync_playwright

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_ml_mobile_audit")
os.makedirs(OUT, exist_ok=True)
CSS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static", "css", "master_league.css")


def main() -> None:
    css_body = open(CSS_PATH, encoding="utf-8").read()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()

        def handle_route(route):
            url = route.request.url
            if "master_league.css" in url:
                route.fulfill(status=200, content_type="text/css; charset=utf-8", body=css_body)
            else:
                route.continue_()

        page.route("**/*", handle_route)
        page.goto("http://127.0.0.1:5000/ml", wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(1500)
        page.evaluate(
            """() => {
              const ov = document.getElementById('humanGateOverlay');
              if (ov) { ov.style.display='none'; ov.setAttribute('aria-hidden','true'); }
              document.getElementById('panel-master_league')?.classList.add('active','is-ml-skin-ready');
            }"""
        )
        page.wait_for_selector(".ml-boost-inner--info-base", timeout=120000)
        page.wait_for_timeout(2000)
        info = page.evaluate(
            """() => {
              const el = document.querySelector('.ml-boost-inner--info-base');
              const cs = getComputedStyle(el);
              const tags = document.querySelector('.ml-boost-tags');
              const boost = document.querySelector('.ml-boost-info-boost-main');
              const pr = el.getBoundingClientRect();
              const tr = tags ? tags.getBoundingClientRect() : null;
              const br = boost ? boost.getBoundingClientRect() : null;
              const dep = document.querySelector('.ml-deploy-stage');
              const dcs = dep ? getComputedStyle(dep) : null;
              return {
                plateW: pr.width,
                plateH: pr.height,
                widthCss: cs.width,
                tagsW: tr && tr.width,
                boostW: br && br.width,
                tagsPastBoost: tr && br ? Math.round(tr.right - br.right) : null,
                tagsDisplay: tags ? getComputedStyle(tags).display : null,
                tagsWidthCss: tags ? getComputedStyle(tags).width : null,
                deployDisplay: dcs && dcs.display,
                deployCols: dcs && dcs.gridTemplateColumns,
                forceFs: getComputedStyle(document.querySelector('.ml-deploy-force-name')||document.body).fontSize,
                sideW: document.querySelector('.ml-deploy-side--enemy')?.getBoundingClientRect().width,
                gridW: document.querySelector('.ml-deploy-grid')?.getBoundingClientRect().width,
              };
            }"""
        )
        print(json.dumps(info, indent=2))
        for sel, name in (
            (".ml-boost-inner--info-base", "info_base"),
            (".ml-boost-banner", "boost"),
            (".ml-deploy", "deploy"),
            (".ml-deploy-stage", "deploy_stage"),
        ):
            loc = page.locator(sel).first
            if loc.count():
                loc.scroll_into_view_if_needed()
                loc.screenshot(path=os.path.join(OUT, f"{name}.png"))
        page.screenshot(path=os.path.join(OUT, "viewport.png"))
        browser.close()


if __name__ == "__main__":
    main()
