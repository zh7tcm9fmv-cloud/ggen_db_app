#!/usr/bin/env python3
import re
import urllib.request

url = "https://web.gl.eternal.channel.or.jp/_next/static/chunks/app/%5Blang%5D/information/%5Btab%5D/page-917e2c3a3b85ed2f.js"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
js = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "replace")
print("len", len(js))
for pat in [
    r"https?://[a-zA-Z0-9._/-]+",
    r"/api[a-zA-Z0-9/_-]*",
    r"information[a-zA-Z0-9/_-]*",
    r"graphql[a-zA-Z0-9/_-]*",
]:
    ms = re.findall(pat, js)
    if ms:
        print("---", pat, "---")
        for m in sorted(set(ms))[:40]:
            print(m)
