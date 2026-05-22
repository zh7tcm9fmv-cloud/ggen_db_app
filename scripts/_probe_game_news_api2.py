#!/usr/bin/env python3
import json
import re
import urllib.parse
import urllib.request

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Origin": "https://web.gl.eternal.channel.or.jp",
    "Referer": "https://web.gl.eternal.channel.or.jp/en/information/update.html",
}


def fetch_js(path: str) -> str:
    url = f"https://web.gl.eternal.channel.or.jp{path}"
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=20).read().decode(
        "utf-8", "replace"
    )


layout = fetch_js("/_next/static/chunks/app/%5Blang%5D/information/%5Btab%5D/layout-a6a23264d5a65f62.js")
page = fetch_js("/_next/static/chunks/app/%5Blang%5D/information/%5Btab%5D/page-917e2c3a3b85ed2f.js")

for name, js in [("layout", layout), ("page", page)]:
    print(f"=== {name} ===")
    for kw in ("update", "event", "bug", "last_viewed_at", "is_new", "new_list"):
        if kw in js:
            print(" has", kw)
    for m in re.finditer(r".{0,50}update.{0,80}", js):
        s = m.group(0)
        if "information" in s or "tab" in s:
            print(" ", s[:160])

# brute force API
print("\n=== API brute ===")
for tab in range(0, 8):
    for lang in range(1, 8):
        for country in ("US", "HK", "TW", "JP", "GL"):
            params = {
                "language_type": str(lang),
                "os_type": "3",
                "country_code": country,
                "information_tab_type": str(tab),
                "offset": "0",
                "last_viewed_at": "0",
                "last_updated_at": "0",
            }
            url = f"https://api.gl.eternal.channel.or.jp/api/information_{tab}_{lang}_0.json?{urllib.parse.urlencode(params)}"
            try:
                r = urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=12)
                data = json.loads(r.read().decode())
                lst = data.get("information_list") or []
                if lst:
                    print("HIT", tab, lang, country, "n=", len(lst))
                    print(" first keys", list(lst[0].keys()))
                    print(" first item sample", {k: lst[0].get(k) for k in list(lst[0].keys())[:12]})
                    raise SystemExit
            except SystemExit:
                raise
            except Exception:
                pass
print("no hit")
