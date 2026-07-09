from pathlib import Path
import re

# Patch renderUnitShell metric toggle HTML for tighter icon-first button
p = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\static\js\app.js')
text = p.read_text(encoding='utf-8')

old = (
    '<button type="button" class="unit-best-pilot-metric-btn unit-best-pilot-metric-dd-toggle is-active" '
    'id="ubpMetricDdToggle" data-ubp-metric="super_crit" aria-haspopup="listbox" aria-expanded="false" '
    'aria-controls="ubpMetricDdMenu" title="${escAttr(t(\'msy_metric_super_crit\')||\'Super Critical\')}">'
    '<img class="ubp-metric-icon" src="${imgUrl(\'/static/images/UI/UI_Battle_MapUI_Label_Critical.webp\')}" '
    'alt="" width="18" height="14" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '<span class="ubp-metric-label">${esc(t(\'msy_metric_super_crit\')||\'Super Critical\')}</span>'
    '<span class="unit-best-pilot-metric-dd-caret" aria-hidden="true">▾</span></button>'
)

new = (
    '<button type="button" class="unit-best-pilot-metric-btn unit-best-pilot-metric-dd-toggle is-active" '
    'id="ubpMetricDdToggle" data-ubp-metric="super_crit" aria-haspopup="listbox" aria-expanded="false" '
    'aria-controls="ubpMetricDdMenu" title="${escAttr(t(\'msy_metric_super_crit\')||\'Super Critical\')}" '
    'aria-label="${escAttr(t(\'msy_metric_super_crit\')||\'Super Critical\')}">'
    '<span class="ubp-metric-mark" aria-hidden="true">'
    '<img class="ubp-metric-icon ubp-metric-icon--mark" src="${imgUrl(\'/static/images/UI/UI_Battle_MapUI_Label_Critical.webp\')}" '
    'alt="" width="40" height="16" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '</span>'
    '<span class="ubp-metric-label">${esc(t(\'msy_metric_super_crit\')||\'Super Critical\')}</span>'
    '<span class="unit-best-pilot-metric-dd-caret" aria-hidden="true">▾</span></button>'
)

if old not in text:
    # try to find a looser match
    m = re.search(r'id="ubpMetricDdToggle".{0,800}?</button>', text)
    print('OLD exact match?', old in text)
    print('found toggle?', bool(m))
    if m:
        Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app\_tmp_toggle.txt').write_text(m.group(0), encoding='utf-8')
        print('wrote toggle snip', len(m.group(0)))
else:
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')
    print('patched toggle HTML')

# Also fix initial note to use defaults so {ms}/{pilot} don't flash
old_note = '<span class="unit-best-pilot-panel-note">${esc(t(\'unit_best_pilot_note\'))}</span>'
# Keep as-is; syncPanelSubtitle fills values. But replace placeholders in initial render:
# Use a small inline replace for the note span.
note_pat = r'<span class="unit-best-pilot-panel-note">\$\{esc\(t\(\'unit_best_pilot_note\'\)\)\}</span>'
note_new = (
    '<span class="unit-best-pilot-panel-note">${esc((t(\'unit_best_pilot_note\')||\'Eternal Expert: MS DEF: {ms} Pilot DEF: {pilot}\')'
    '.replace(\'{ms}\',\'25,072\').replace(\'{pilot}\',\'705\'))}</span>'
)
text2 = p.read_text(encoding='utf-8')
text3, n = re.subn(note_pat, note_new, text2, count=1)
print('note shell patch', n)
if n:
    p.write_text(text3, encoding='utf-8')
