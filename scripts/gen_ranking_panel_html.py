"""One-off: emit ranking toolbar HTML fragments from templates/index.html."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "templates" / "index.html"
OUT = ROOT / "_ranking_panel_fragments.html"


def extract_panel_inner(html: str, panel_id: str) -> str:
    open_tag = f'id="panel-{panel_id}">'
    pos = html.find(open_tag)
    if pos < 0:
        raise SystemExit(f"panel {panel_id} open not found")
    start = pos + len(open_tag)
    nxt = html.find('<div class="tab-panel"', start)
    if nxt < 0:
        raise SystemExit(f"panel {panel_id} end not found")
    return html[start:nxt]


def to_rank_char(inner: str) -> str:
    s = inner
    # Toolbar ids: char -> rankChar (avoid double replace)
    s = s.replace("id=\"char", 'id="rankChar')
    s = s.replace("id='char", "id='rankChar")
    s = s.replace("getElementById('char", "getElementById('rankChar")
    s = s.replace('getElementById("char', 'getElementById("rankChar')
    # onclick / oninput string args
    s = re.sub(r"toggleSeriesPanel\(&quot;char&quot;", 'toggleSeriesPanel(&quot;rankChar&quot;', s)
    s = re.sub(r"toggleLineagePanel\(&quot;char&quot;", 'toggleLineagePanel(&quot;rankChar&quot;', s)
    s = s.replace("toggleAbilPanel('char'", "toggleAbilPanel('rankChar'")
    s = s.replace("toggleSkillPanel('char'", "toggleSkillPanel('rankChar'")
    s = s.replace("toggleRarityPanel('char'", "toggleRarityPanel('rankChar'")
    s = s.replace("toggleRolePanel('char'", "toggleRolePanel('rankChar'")
    s = s.replace("toggleSourcePanel('char'", "toggleSourcePanel('rankChar'")
    s = s.replace("clearBrowseFilters('char')", "clearRankingBrowseFilters('rankChar')")
    s = s.replace("onRarityStarCheckboxChange('char',", "onRarityStarCheckboxChange('rankChar',")
    s = s.replace("onRarityRowClick('char',", "onRarityRowClick('rankChar',")
    s = s.replace("onRarityRowKey(event,'char',", "onRarityRowKey(event,'rankChar',")
    s = s.replace("onRarityLtCheckboxChange('char'", "onRarityLtCheckboxChange('rankChar'")
    s = s.replace("onRarityLtRowClick('char'", "onRarityLtRowClick('rankChar'")
    s = s.replace("onRarityLtRowKey(event,'char'", "onRarityLtRowKey(event,'rankChar'")
    s = s.replace("onRoleCheckboxChange('char',", "onRoleCheckboxChange('rankChar',")
    s = s.replace("onRoleRowClick('char',", "onRoleRowClick('rankChar',")
    s = s.replace("onRoleRowKey(event,'char',", "onRoleRowKey(event,'rankChar',")
    s = s.replace("onSourceCheckboxChange('char')", "onSourceCheckboxChange('rankChar')")
    s = s.replace("onSourceRowClick('char',", "onSourceRowClick('rankChar',")
    s = s.replace("onSourceRowKey(event,'char',", "onSourceRowKey(event,'rankChar',")
    s = s.replace(
        "debounceLoad('characters');updateSearchHintVisibility('charFilter');syncBrowseSearchWidth('charFilter')",
        "scheduleRankingListReload();updateSearchHintVisibility('rankCharFilter');syncBrowseSearchWidth('rankCharFilter')",
    )
    s = s.replace("debounceFilterSkillDropdown('char')", "debounceFilterSkillDropdown('rankChar')")
    s = s.replace("debounceFilterAbilDropdown('char')", "debounceFilterAbilDropdown('rankChar')")
    s = s.replace("toggleListCharSp()", "toggleRankListCharSp()")
    s = s.replace("toggleListCharCond()", "toggleRankListCharCond()")
    # Remove grid/table/compare row — ranking uses custom list only
    s = re.sub(
        r'<div class="list-toolbar-right">.*?</div></div></div>\s*<div class="rarity-filter-wrap series-filter-wrap" id="rankCharSeriesWrap">',
        '<div class="rarity-filter-wrap series-filter-wrap" id="rankCharSeriesWrap">',
        s,
        count=1,
        flags=re.DOTALL,
    )
    return s


def to_rank_unit(inner: str) -> str:
    s = inner
    s = s.replace('id="unit', 'id="rankUnit')
    s = s.replace("id='unit", "id='rankUnit")
    s = re.sub(r"toggleSeriesPanel\(&quot;unit&quot;", 'toggleSeriesPanel(&quot;rankUnit&quot;', s)
    s = re.sub(r"toggleLineagePanel\(&quot;unit&quot;", 'toggleLineagePanel(&quot;rankUnit&quot;', s)
    s = s.replace("toggleSkillPanel('unit'", "toggleSkillPanel('rankUnit'")
    s = s.replace("toggleRarityPanel('unit'", "toggleRarityPanel('rankUnit'")
    s = s.replace("toggleRolePanel('unit'", "toggleRolePanel('rankUnit'")
    s = s.replace("toggleSourcePanel('unit'", "toggleSourcePanel('rankUnit'")
    s = s.replace("clearBrowseFilters('unit')", "clearRankingBrowseFilters('rankUnit')")
    s = s.replace("onRarityStarCheckboxChange('unit',", "onRarityStarCheckboxChange('rankUnit',")
    s = s.replace("onRarityRowClick('unit',", "onRarityRowClick('rankUnit',")
    s = s.replace("onRarityRowKey(event,'unit',", "onRarityRowKey(event,'rankUnit',")
    s = s.replace("onRarityLtCheckboxChange('unit'", "onRarityLtCheckboxChange('rankUnit'")
    s = s.replace("onRarityLtRowClick('unit'", "onRarityLtRowClick('rankUnit'")
    s = s.replace("onRarityLtRowKey(event,'unit'", "onRarityLtRowKey(event,'rankUnit'")
    s = s.replace("onRoleCheckboxChange('unit',", "onRoleCheckboxChange('rankUnit',")
    s = s.replace("onRoleRowClick('unit',", "onRoleRowClick('rankUnit',")
    s = s.replace("onRoleRowKey(event,'unit',", "onRoleRowKey(event,'rankUnit',")
    s = s.replace("onSourceCheckboxChange('unit')", "onSourceCheckboxChange('rankUnit')")
    s = s.replace("onSourceRowClick('unit',", "onSourceRowClick('rankUnit',")
    s = s.replace("onSourceRowKey(event,'unit',", "onSourceRowKey(event,'rankUnit',")
    s = s.replace(
        "debounceLoad('units');updateSearchHintVisibility('unitFilter');syncBrowseSearchWidth('unitFilter')",
        "scheduleRankingListReload();updateSearchHintVisibility('rankUnitFilter');syncBrowseSearchWidth('rankUnitFilter')",
    )
    s = s.replace("debounceFilterSkillDropdown('unit')", "debounceFilterSkillDropdown('rankUnit')")
    s = s.replace("toggleListUnitSp()", "toggleRankListUnitSp()")
    s = s.replace("toggleListUnitSsp()", "toggleRankListUnitSsp()")
    s = s.replace("toggleListUnitCond()", "toggleRankListUnitCond()")
    s = re.sub(
        r'<div class="list-toolbar-right">.*?</div></div></div>\s*<div class="rarity-filter-wrap series-filter-wrap" id="rankUnitSeriesWrap">',
        '<div class="rarity-filter-wrap series-filter-wrap" id="rankUnitSeriesWrap">',
        s,
        count=1,
        flags=re.DOTALL,
    )
    return s


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    char_panel = extract_panel_inner(html, "characters")
    unit_panel = extract_panel_inner(html, "units")
    # list-toolbar only (drop list-view-area and below)
    def toolbar_only(panel: str) -> str:
        i = panel.find('<div class="list-toolbar">')
        if i < 0:
            raise SystemExit("list-toolbar not found")
        j = panel.find('<div class="list-view-area"', i)
        if j < 0:
            raise SystemExit("list-view-area not found")
        return panel[i:j]

    ct = toolbar_only(char_panel)
    ut = toolbar_only(unit_panel)

    rc = to_rank_char(ct)
    ru = to_rank_unit(ut)

    OUT.write_text(
        "<!-- RANK_CHAR_TOOLBAR -->\n"
        + rc
        + "\n<!-- RANK_UNIT_TOOLBAR -->\n"
        + ru
        + "\n",
        encoding="utf-8",
    )
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
