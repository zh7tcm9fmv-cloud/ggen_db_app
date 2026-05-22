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


def get(url: str) -> str:
    return urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=20).read().decode(
        "utf-8", "replace"
    )


page = get(
    "https://web.gl.eternal.channel.or.jp/_next/static/chunks/app/%5Blang%5D/information/%5Btab%5D/page-917e2c3a3b85ed2f.js"
)
# find module id before M and v - search for n.d(e,{M:
for m in re.finditer(r"n\.d\(e,\{M:function\(\)\{return [a-z]\}\}\)", page):
    print("M export", m.group(0))
for m in re.finditer(r"n\.d\(e,\{v:function\(\)\{return [a-z]\}\}\)", page):
    print("v export", m.group(0))

# Extract mapping objects near update_info
for m in re.finditer(r"update_info.{0,120}", page):
    print(m.group(0))

# Try API with defaults from code: country JP, os 1, tab type 4, lang 1
combos = [
    {"language_type": "1", "os_type": "1", "country_code": "JP", "information_tab_type": "4"},
    {"language_type": "1", "os_type": "3", "country_code": "JP", "information_tab_type": "4"},
    {"language_type": "2", "os_type": "1", "country_code": "TW", "information_tab_type": "4"},
    {"language_type": "3", "os_type": "1", "country_code": "HK", "information_tab_type": "4"},
    {"language_type": "1", "os_type": "1", "country_code": "JP", "information_tab_type": "0"},
    {"language_type": "1", "os_type": "1", "country_code": "JP", "information_tab_type": "1"},
    {"language_type": "1", "os_type": "1", "country_code": "JP", "information_tab_type": "2"},
    {"language_type": "1", "os_type": "1", "country_code": "JP", "information_tab_type": "3"},
]
for base in combos:
    p = {**base, "offset": "0", "last_viewed_at": "0", "last_updated_at": "0", "trace_id": "0"}
    url = "https://api.gl.eternal.channel.or.jp/api/information?" + urllib.parse.urlencode(p)
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=15)
        data = json.loads(r.read().decode())
        gi = data.get("get_information", {})
        lst = gi.get("information_list") or []
        tabs = gi.get("information_tab_list") or []
        print("OK", base, "items", len(lst), "tabs", len(tabs), "has_more", gi.get("has_more"))
        if tabs:
            print(" tabs sample", tabs[:3])
        if lst:
            print(" item0", {k: lst[0].get(k) for k in list(lst[0].keys())[:15]})
            break
    except Exception as e:
        print("fail", base, e)
