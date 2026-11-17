from __future__ import annotations

import json
from playwright.sync_api import sync_playwright


def main() -> None:
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        c = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        page = c.new_page()
        page.goto("http://127.0.0.1:5000/ml", wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(2000)
        page.evaluate(
            """() => {
              const ov = document.getElementById('humanGateOverlay');
              if (ov) { ov.style.display = 'none'; ov.setAttribute('aria-hidden', 'true'); }
            }"""
        )
        page.wait_for_selector(".ml-boost-inner--info-base", timeout=120000)
        page.wait_for_timeout(1500)
        info = page.evaluate(
            """() => {
              const el = document.querySelector('.ml-boost-inner--info-base');
              const cs = getComputedStyle(el);
              const sheets = [...document.styleSheets]
                .map((s) => ({ href: s.href, rules: (s.cssRules && s.cssRules.length) || 0 }))
                .filter((s) => s.href && s.href.includes('master_league'));
              const matched = [];
              try {
                for (const s of document.styleSheets) {
                  if (!s.href || !s.href.includes('master_league')) continue;
                  for (const r of s.cssRules) {
                    if (r.cssText && r.cssText.includes('ml-boost-plate')) matched.push(r.cssText.slice(0, 180));
                    if (r.media && r.cssRules) {
                      for (const rr of r.cssRules) {
                        if (rr.selectorText && rr.selectorText.includes('info-base') && rr.style && rr.style.width) {
                          matched.push(r.media.mediaText + ' || ' + rr.selectorText + ' -> ' + rr.style.width);
                        }
                        if (rr.selectorText && rr.selectorText.includes('ml-deploy-stage') && rr.style && rr.style.display) {
                          matched.push(r.media.mediaText + ' || ' + rr.selectorText + ' display=' + rr.style.display);
                        }
                      }
                    }
                  }
                }
              } catch (e) {
                matched.push('err ' + e.message);
              }
              return {
                width: cs.width,
                w: el.getBoundingClientRect().width,
                cardCls: el.closest('.ml-boost-card')?.className,
                sheets,
                matched: matched.slice(0, 40),
                vw: innerWidth,
              };
            }"""
        )
        print(json.dumps(info, indent=2))
        b.close()


if __name__ == "__main__":
    main()
