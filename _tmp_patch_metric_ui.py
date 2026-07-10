from pathlib import Path
import json
import re

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')

# --- image_index.json ---
idx_path = root / 'image_index.json'
idx = json.loads(idx_path.read_text(encoding='utf-8'))
# find UI folder key
ui_key = None
for k in idx:
    if k.endswith('/UI') or k == 'UI' or k.endswith('\\UI') or '/UI' in k.replace('\\', '/'):
        files = idx[k]
        if isinstance(files, list) and any('Label_Critical' in str(f) for f in files):
            ui_key = k
            break
print('ui_key', ui_key)
if ui_key:
    files = idx[ui_key]
    for name in ['UI_Battle_MapUI_Label_Normal.png', 'UI_Battle_MapUI_Label_Normal.webp']:
        if name not in files:
            # insert after SuperCritical entries
            insert_at = None
            for i, f in enumerate(files):
                if 'Label_SuperCritical.webp' in str(f):
                    insert_at = i + 1
                    break
            if insert_at is None:
                files.append(name)
            else:
                files.insert(insert_at, name)
            print('added', name)
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # also update CDN index if present
    cdn_idx = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_images\image_index.json')
    if cdn_idx.exists():
        cidx = json.loads(cdn_idx.read_text(encoding='utf-8'))
        for k in cidx:
            files = cidx[k]
            if isinstance(files, list) and any('Label_Critical' in str(f) for f in files):
                for name in ['UI_Battle_MapUI_Label_Normal.png', 'UI_Battle_MapUI_Label_Normal.webp']:
                    if name not in files:
                        insert_at = None
                        for i, f in enumerate(files):
                            if 'Label_SuperCritical.webp' in str(f):
                                insert_at = i + 1
                                break
                        if insert_at is None:
                            files.append(name)
                        else:
                            files.insert(insert_at, name)
                break
        cdn_idx.write_text(json.dumps(cidx, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('cdn index updated')

# --- unit_best_pilots.js ---
js = (root / 'static/js/unit_best_pilots.js').read_text(encoding='utf-8')
js = js.replace(
    """  var RANK_MODE_ICON = {
    super_crit: '/static/images/UI/UI_Tention_Up_03.webp',
    crit: '/static/images/UI/UI_Battle_MapUI_Label_Critical.webp',
    normal: '/static/images/UI/UI_Tention_Up_02.webp'
  };
  // Always show Critical label icon on the metric dropdown toggle.
  var METRIC_TOGGLE_ICON = '/static/images/UI/UI_Battle_MapUI_Label_Critical.webp';""",
    """  var RANK_MODE_ICON = {
    super_crit: '/static/images/UI/UI_Battle_MapUI_Label_SuperCritical.webp',
    crit: '/static/images/UI/UI_Battle_MapUI_Label_Critical.webp',
    normal: '/static/images/UI/UI_Battle_MapUI_Label_Normal.webp'
  };"""
)
js = js.replace("rankMode: 'super_crit',", "rankMode: 'normal',")

old_sync = """  function syncMetricButtons() {
    var mode = state.rankMode || 'super_crit';
    var label = metricLabel(mode);
    var btn = global.document.getElementById('ubpMetricDdToggle');
    if (btn) {
      btn.setAttribute('data-ubp-metric', mode);
      btn.setAttribute('aria-label', label);
      btn.title = label;
      var img = btn.querySelector('.ubp-metric-icon');
      if (img) {
        var url = typeof global.imgUrl === 'function' ? global.imgUrl(METRIC_TOGGLE_ICON) : METRIC_TOGGLE_ICON;
        if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      }
      var lab = btn.querySelector('.ubp-metric-label');
      if (lab) lab.textContent = label;
      btn.classList.add('is-active');
      btn.classList.add('active');
    }
    global.document.querySelectorAll('#ubpMetricDdMenu [data-ubp-metric]').forEach(function (el) {
      var on = el.getAttribute('data-ubp-metric') === mode;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      var itemLab = el.querySelector('span');
      if (itemLab) {
        var m = el.getAttribute('data-ubp-metric');
        if (m) itemLab.textContent = metricLabel(m);
      }
    });
  }"""

new_sync = """  function metricIconUrl(mode) {
    var path = RANK_MODE_ICON[mode] || RANK_MODE_ICON.normal;
    return typeof global.imgUrl === 'function' ? global.imgUrl(path) : path;
  }

  function syncMetricButtons() {
    var mode = state.rankMode || 'normal';
    var label = metricLabel(mode);
    var btn = global.document.getElementById('ubpMetricDdToggle');
    if (btn) {
      btn.setAttribute('data-ubp-metric', mode);
      btn.setAttribute('aria-label', label);
      btn.title = label;
      var img = btn.querySelector('.ubp-metric-icon');
      if (img) {
        var url = metricIconUrl(mode);
        if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      }
      btn.classList.add('is-active');
      btn.classList.add('active');
    }
    global.document.querySelectorAll('#ubpMetricDdMenu [data-ubp-metric]').forEach(function (el) {
      var m = el.getAttribute('data-ubp-metric');
      var on = m === mode;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      el.title = metricLabel(m);
      el.setAttribute('aria-label', metricLabel(m));
      var img = el.querySelector('.ubp-metric-icon');
      if (img && m) {
        var url = metricIconUrl(m);
        if (img.getAttribute('src') !== url) img.setAttribute('src', url);
      }
    });
  }"""

if old_sync not in js:
    raise SystemExit('syncMetricButtons block not found')
js = js.replace(old_sync, new_sync, 1)

# fallbacks that still say super_crit as default mode in a few places — leave data fields,
# but UI default is state.rankMode = normal. Also fix || 'super_crit' used for display mode.
# Only change the UI-facing defaults carefully — keep API bootstrap rank_mode as-is for cache keys.
(root / 'static/js/unit_best_pilots.js').write_text(js, encoding='utf-8')
print('unit_best_pilots.js updated')

# --- app.js shell HTML ---
app = (root / 'static/js/app.js').read_text(encoding='utf-8')
old_html = (
    'id="ubpMetricDropdown"><button type="button" class="unit-best-pilot-metric-btn unit-best-pilot-metric-dd-toggle is-active" '
    'id="ubpMetricDdToggle" data-ubp-metric="super_crit" aria-haspopup="listbox" aria-expanded="false" '
    'aria-controls="ubpMetricDdMenu" title="${escAttr(t(\'msy_metric_super_crit\')||\'Super Critical\')}" '
    'aria-label="${escAttr(t(\'msy_metric_super_crit\')||\'Super Critical\')}">'
    '<span class="ubp-metric-mark" aria-hidden="true">'
    '<img class="ubp-metric-icon ubp-metric-icon--mark" src="${imgUrl(\'/static/images/UI/UI_Battle_MapUI_Label_Critical.webp\')}" '
    'alt="" width="40" height="16" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '</span>'
    '<span class="ubp-metric-label">${esc(t(\'msy_metric_super_crit\')||\'Super Critical\')}</span>'
    '<span class="unit-best-pilot-metric-dd-caret" aria-hidden="true">▾</span></button>'
    '<div class="unit-best-pilot-metric-dd-menu" id="ubpMetricDdMenu" role="listbox" '
    'aria-label="${escAttr(t(\'unit_best_pilot_metrics\')||\'Damage metric\')}">'
    '<button type="button" class="unit-best-pilot-metric-dd-item is-active" role="option" data-ubp-metric="super_crit" aria-selected="true">'
    '<img class="ubp-metric-icon" src="${imgUrl(\'/static/images/UI/UI_Tention_Up_03.webp\')}" alt="" width="14" height="14" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '<span>${esc(t(\'msy_metric_super_crit\')||\'Super Critical\')}</span></button>'
    '<button type="button" class="unit-best-pilot-metric-dd-item" role="option" data-ubp-metric="crit" aria-selected="false">'
    '<img class="ubp-metric-icon" src="${imgUrl(\'/static/images/UI/UI_Battle_MapUI_Label_Critical.webp\')}" alt="" width="18" height="14" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '<span>${esc(t(\'msy_metric_crit\')||\'Critical\')}</span></button>'
    '<button type="button" class="unit-best-pilot-metric-dd-item" role="option" data-ubp-metric="normal" aria-selected="false">'
    '<img class="ubp-metric-icon" src="${imgUrl(\'/static/images/UI/UI_Tention_Up_02.webp\')}" alt="" width="14" height="14" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '<span>${esc(t(\'msy_metric_normal\')||\'Normal\')}</span></button></div></div>'
)

new_html = (
    'id="ubpMetricDropdown"><button type="button" class="unit-best-pilot-metric-btn unit-best-pilot-metric-dd-toggle is-active" '
    'id="ubpMetricDdToggle" data-ubp-metric="normal" aria-haspopup="listbox" aria-expanded="false" '
    'aria-controls="ubpMetricDdMenu" title="${escAttr(t(\'msy_metric_normal\')||\'Normal\')}" '
    'aria-label="${escAttr(t(\'msy_metric_normal\')||\'Normal\')}">'
    '<span class="ubp-metric-mark" aria-hidden="true">'
    '<img class="ubp-metric-icon ubp-metric-icon--mark" src="${imgUrl(\'/static/images/UI/UI_Battle_MapUI_Label_Normal.webp\')}" '
    'alt="" width="40" height="16" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '</span>'
    '<span class="unit-best-pilot-metric-dd-caret" aria-hidden="true">▾</span></button>'
    '<div class="unit-best-pilot-metric-dd-menu" id="ubpMetricDdMenu" role="listbox" '
    'aria-label="${escAttr(t(\'unit_best_pilot_metrics\')||\'Damage metric\')}">'
    '<button type="button" class="unit-best-pilot-metric-dd-item" role="option" data-ubp-metric="super_crit" aria-selected="false" '
    'title="${escAttr(t(\'msy_metric_super_crit\')||\'Super Critical\')}" aria-label="${escAttr(t(\'msy_metric_super_crit\')||\'Super Critical\')}">'
    '<img class="ubp-metric-icon ubp-metric-icon--label" src="${imgUrl(\'/static/images/UI/UI_Battle_MapUI_Label_SuperCritical.webp\')}" alt="" width="36" height="16" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '</button>'
    '<button type="button" class="unit-best-pilot-metric-dd-item" role="option" data-ubp-metric="crit" aria-selected="false" '
    'title="${escAttr(t(\'msy_metric_crit\')||\'Critical\')}" aria-label="${escAttr(t(\'msy_metric_crit\')||\'Critical\')}">'
    '<img class="ubp-metric-icon ubp-metric-icon--label" src="${imgUrl(\'/static/images/UI/UI_Battle_MapUI_Label_Critical.webp\')}" alt="" width="40" height="14" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '</button>'
    '<button type="button" class="unit-best-pilot-metric-dd-item is-active" role="option" data-ubp-metric="normal" aria-selected="true" '
    'title="${escAttr(t(\'msy_metric_normal\')||\'Normal\')}" aria-label="${escAttr(t(\'msy_metric_normal\')||\'Normal\')}">'
    '<img class="ubp-metric-icon ubp-metric-icon--label" src="${imgUrl(\'/static/images/UI/UI_Battle_MapUI_Label_Normal.webp\')}" alt="" width="40" height="14" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '</button></div></div>'
)

if old_html not in app:
    # try find current toggle block
    m = re.search(r'id="ubpMetricDropdown".{0,2200}?unit-best-pilot-filters', app)
    Path(root / '_metric_cur.txt').write_text(m.group(0) if m else 'MISSING', encoding='utf-8')
    raise SystemExit('metric HTML not found exactly — wrote _metric_cur.txt')
app = app.replace(old_html, new_html, 1)
(root / 'static/js/app.js').write_text(app, encoding='utf-8')
print('app.js shell updated')
