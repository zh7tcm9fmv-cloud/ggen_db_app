"""
Jinja2 treats `{#` as the start of a comment. In inline CSS, a block like
`@media (...){#id` is parsed as `{` + comment start, which breaks the template.

Compile templates here (no Flask app / DB) so CI or pre-push runs catch this class of error.
"""

from pathlib import Path
import unittest

from jinja2 import Environment, FileSystemLoader


class TestTemplatesParse(unittest.TestCase):
    def test_index_html_compiles(self):
        root = Path(__file__).resolve().parent.parent
        env = Environment(loader=FileSystemLoader(str(root / "templates")))
        env.get_template("index.html")


if __name__ == "__main__":
    unittest.main()
