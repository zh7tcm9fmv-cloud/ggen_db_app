"""Dump live /health memory + adaptive fields for RSS diagnosis."""
from __future__ import annotations

import gzip
import json
import urllib.request

BASE = "https://ggendb.up.railway.app"


def main():
    req = urllib.request.Request(BASE + "/health", headers={"Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=45) as r:
        raw = r.read()
        enc = r.headers.get("Content-Encoding", "")
    body = gzip.decompress(raw) if (enc == "gzip" or raw[:2] == b"\x1f\x8b") else raw
    j = json.loads(body)
    mem = j.get("memory") or {}
    print(json.dumps({"ok": j.get("ok"), "booting": j.get("booting"), "browse_ready": j.get("browse_ready"), "memory": mem}, indent=2))
    out = __file__.replace(".py", "_out.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(j, f, indent=2)
    print("wrote", out)


if __name__ == "__main__":
    main()
