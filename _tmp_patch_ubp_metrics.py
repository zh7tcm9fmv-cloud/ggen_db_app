from pathlib import Path

p = Path('static/js/app.js')
text = p.read_text(encoding='utf-8')
marker = '<div class="unit-best-pilot-filters" role="group" aria-label="${escAttr(t(\'unit_best_pilot_filters\')||\'Pilot filters\')}">'
if marker not in text:
    raise SystemExit('marker not found')

metrics = (
    '<div class="unit-best-pilot-metrics" role="group" aria-label="${escAttr(t(\'unit_best_pilot_metrics\')||\'Damage metric\')}">'
    '<button type="button" class="unit-best-pilot-metric-btn is-active" id="ubpMetricSuperCritBtn" data-ubp-metric="super_crit" aria-pressed="true" title="${escAttr(t(\'msy_metric_super_crit\')||\'Super Crit\')}">'
    '<img class="ubp-metric-icon" src="${imgUrl(\'/static/images/UI/UI_Tention_Up_03.webp\')}" alt="" width="14" height="14" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '<span class="ubp-metric-label">${esc(t(\'msy_metric_super_crit\')||\'Super Crit\')}</span></button>'
    '<button type="button" class="unit-best-pilot-metric-btn" id="ubpMetricCritBtn" data-ubp-metric="crit" aria-pressed="false" title="${escAttr(t(\'msy_metric_crit\')||\'Crit\')}">'
    '<img class="ubp-metric-icon" src="${imgUrl(\'/static/images/UI/UI_Tention_Up_01.webp\')}" alt="" width="14" height="14" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '<span class="ubp-metric-label">${esc(t(\'msy_metric_crit\')||\'Crit\')}</span></button>'
    '<button type="button" class="unit-best-pilot-metric-btn" id="ubpMetricNormalBtn" data-ubp-metric="normal" aria-pressed="false" title="${escAttr(t(\'msy_metric_normal\')||\'Normal\')}">'
    '<img class="ubp-metric-icon" src="${imgUrl(\'/static/images/UI/UI_Tention_Up_02.webp\')}" alt="" width="14" height="14" loading="lazy" decoding="async" onerror="this.style.display=\'none\'">'
    '<span class="ubp-metric-label">${esc(t(\'msy_metric_normal\')||\'Normal\')}</span></button>'
    '</div>'
)
text = text.replace(marker, metrics + marker, 1)
p.write_text(text, encoding='utf-8')
print('ok')
