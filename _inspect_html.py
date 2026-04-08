import pathlib
t = pathlib.Path(__file__).resolve().parent.joinpath("templates", "index.html").read_text(encoding="utf-8")
i = t.find('id="charViewTable"')
s = t[i : i + 1200]
print(s.encode("unicode_escape").decode("ascii"))
i2 = t.find('id="unitSeriesWrap"')
print("--- unit ---")
print(t[i2 - 200 : i2 + 120].encode("unicode_escape").decode("ascii"))
