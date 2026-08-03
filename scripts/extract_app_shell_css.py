#!/usr/bin/env python3
"""Extract inline CSS from index.html to static/css/app_shell.css (no Jinja, no Flask).

Keeps @font-face in the HTML (needs ?v= cache-bust). Replaces CDN Jinja image URLs
with /static/images/... so the stylesheet is a plain cacheable static file.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "templates" / "index.html"
OUT = ROOT / "static" / "css" / "app_shell.css"


def strip_jinja_urls(css: str) -> str:
    # {% if image_cdn %}{{ image_cdn }}/images/FOO{% else %}/static/images/FOO{% endif %}
    css = re.sub(
        r"\{%\s*if\s+image_cdn\s*%\}\{\{\s*image_cdn\s*\}\}/images/([^\{]+?)\{%\s*else\s*%\}/static/images/\1\{%\s*endif\s*%\}",
        r"/static/images/\1",
        css,
    )
    # leftover app_js_version in non-font urls (shouldn't remain after font split)
    css = re.sub(r"\?v=\{\{\s*app_js_version\s*\}\}", "", css)
    if "{{" in css or "{%" in css:
        raise SystemExit("Jinja still present in extracted CSS — aborting")
    return css


def main() -> None:
    text = INDEX.read_text(encoding="utf-8")
    start = text.find("<style>")
    end = text.find("</style>", start)
    if start < 0 or end < 0:
        raise SystemExit("no <style> block")
    full = text[start + 7 : end]

    # Split @font-face (keep in HTML) from the rest
    font_faces = re.findall(r"@font-face\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", full)
    # Simpler: lines/blocks starting with @font-face until matching }
    font_blocks = []
    rest = full
    while True:
        m = re.search(r"@font-face\{", rest)
        if not m:
            break
        i = m.start()
        depth = 0
        j = i
        while j < len(rest):
            if rest[j] == "{":
                depth += 1
            elif rest[j] == "}":
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        font_blocks.append(rest[i:j])
        rest = rest[:i] + rest[j:]

    shell = strip_jinja_urls(rest.strip()) + "\n"
    OUT.write_text(
        "/* Extracted shell CSS — static only. Fonts stay inline in index.html for ?v= bust. */\n"
        + shell,
        encoding="utf-8",
    )

    fonts_html = "\n".join(font_blocks)
    if not fonts_html.strip():
        raise SystemExit("no @font-face extracted to keep inline")

    # Find existing external CSS links after </style>
    after = text[end + len("</style>") :]
    link_block = (
        f'<style>\n{fonts_html}\n</style>\n'
        f'<link rel="stylesheet" href="{{{{ url_for(\'static\', filename=\'css/app_shell.css\') }}}}?v={{{{ app_js_version }}}}">\n'
    )
    # Avoid duplicating if already present
    if "css/app_shell.css" in text:
        raise SystemExit("app_shell.css already linked")

    new_text = text[:start] + link_block + after
    INDEX.write_text(new_text, encoding="utf-8")

    import gzip

    old_html = text.encode("utf-8")
    new_html = new_text.encode("utf-8")
    css_b = OUT.read_bytes()
    print("HTML raw", len(old_html), "->", len(new_html), "delta", len(new_html) - len(old_html))
    print(
        "HTML gzip",
        len(gzip.compress(old_html, 9)),
        "->",
        len(gzip.compress(new_html, 9)),
    )
    print("app_shell.css raw", len(css_b), "gzip", len(gzip.compress(css_b, 9)))
    print(
        "cold total gzip (html+css)",
        len(gzip.compress(new_html, 9)) + len(gzip.compress(css_b, 9)),
        "vs old html gzip",
        len(gzip.compress(old_html, 9)),
    )
    print(
        "repeat visit html gzip (css cached)",
        len(gzip.compress(new_html, 9)),
        "save vs old",
        len(gzip.compress(old_html, 9)) - len(gzip.compress(new_html, 9)),
    )


if __name__ == "__main__":
    main()
