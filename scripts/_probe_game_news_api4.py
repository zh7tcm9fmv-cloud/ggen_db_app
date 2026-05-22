#!/usr/bin/env python3
import json
import urllib.request

HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://web.gl.eternal.channel.or.jp/en/information/update.html"}

for tab in range(0, 6):
    for lang in range(1, 6):
        url = f"https://web.gl.eternal.channel.or.jp/server_assets/api/information_{tab}_{lang}_0.json"
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=12)
            data = json.loads(r.read().decode())
            lst = data.get("information_list") or []
            if lst:
                title = str(lst[0].get("title", ""))[:50]
                print(f"tab={tab} lang={lang} count={len(lst)} title={title}")
        except Exception:
            pass

page = urllib.request.urlopen(
    urllib.request.Request(
        "https://web.gl.eternal.channel.or.jp/_next/static/chunks/app/%5Blang%5D/information/%5Btab%5D/page-917e2c3a3b85ed2f.js",
        headers=HEADERS,
    ),
    timeout=20,
).read().decode()
for mod in ("2029:function", "2030:function", "2031:function"):
    i = page.find(mod)
    if i >= 0:
        print("\n===", mod, "===")
        print(page[i : i + 900])
