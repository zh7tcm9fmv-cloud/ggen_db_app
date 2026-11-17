from __future__ import annotations

import json
from playwright.sync_api import sync_playwright


def main() -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True,
        )
        page = context.new_page()
        page.goto("https://ggendb.up.railway.app/ml", wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(2500)
        page.evaluate(
            """() => {
              const ov = document.getElementById('humanGateOverlay');
              if (ov) { ov.style.display='none'; ov.setAttribute('aria-hidden','true'); }
            }"""
        )
        page.wait_for_selector(".ml-boost-inner--info-base", timeout=120000)
        page.wait_for_timeout(2500)
        info = page.evaluate(
            """() => {
              const el = document.querySelector('.ml-boost-inner--info-base');
              const tags = document.querySelector('.ml-boost-tags');
              const boost = document.querySelector('.ml-boost-info-boost-main');
              const dep = document.querySelector('.ml-deploy-stage');
              const pr = el.getBoundingClientRect();
              const tr = tags.getBoundingClientRect();
              const br = boost.getBoundingClientRect();
              const sheets = [...document.styleSheets]
                .filter(s => s.href && s.href.includes('master_league'))
                .map(s => s.href);
              return {
                plateW: Math.round(pr.width),
                plateH: Math.round(pr.height),
                tagsPastBoost: Math.round(tr.right - br.right),
                tagsDisplay: getComputedStyle(tags).display,
                deployDisplay: getComputedStyle(dep).display,
                gridW: Math.round(document.querySelector('.ml-deploy-grid').getBoundingClientRect().width),
                sheets,
              };
            }"""
        )
        print(json.dumps(info, indent=2))
        browser.close()


if __name__ == "__main__":
    main()
