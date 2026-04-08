import pathlib
p = pathlib.Path(__file__).resolve().parent / "templates" / "index.html"
text = p.read_text(encoding="utf-8")
btn_char = (
    '</svg></button><button type="button" class="cmp-mobile-pick-toggle" id="charCmpPickToggle" '
    'onclick="toggleCmpMobilePickMode()" title="Enable compare pick" aria-pressed="false" '
    'aria-label="Enable compare pick">\u2694</button></div></div></div><div class="rarity-filter-wrap series-filter-wrap" id="charSeriesWrap">'
)
btn_unit = (
    '</svg></button><button type="button" class="cmp-mobile-pick-toggle" id="unitCmpPickToggle" '
    'onclick="toggleCmpMobilePickMode()" title="Enable compare pick" aria-pressed="false" '
    'aria-label="Enable compare pick">\u2694</button></div></div></div><div class="rarity-filter-wrap series-filter-wrap" id="unitSeriesWrap">'
)
old1 = '</svg></button></div></div></div><div class="rarity-filter-wrap series-filter-wrap" id="charSeriesWrap">'
old2 = '</svg></button></div></div></div><div class="rarity-filter-wrap series-filter-wrap" id="unitSeriesWrap">'
if old1 not in text:
    raise SystemExit("char anchor missing")
if old2 not in text:
    raise SystemExit("unit anchor missing")
text = text.replace(old1, btn_char, 1)
text = text.replace(old2, btn_unit, 1)
p.write_text(text, encoding="utf-8")
print("ok")
