from pathlib import Path

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')
js_path = root / 'static/js/app.js'
js = js_path.read_text(encoding='utf-8')

old = """function updateSearchHintVisibility(inputId){const inp=document.getElementById(inputId);if(!inp)return;const wrap=inp.closest('.filter-input-wrap');if(!wrap)return;if(inp.value.trim()){wrap.classList.add('hint-suppressed');wrap.classList.remove('show-hint')}else{wrap.classList.remove('hint-suppressed')}}
function initSearchHints(){document.querySelectorAll('.filter-input-wrap').forEach(wrap=>{const inp=wrap.querySelector('.filter-input');if(!inp)return;function refresh(){updateSearchHintVisibility(inp.id);if(inp.classList.contains('filter-input--organic'))syncBrowseSearchWidth(inp.id)}inp.addEventListener('input',refresh);inp.addEventListener('mouseenter',()=>{if(!inp.value.trim())wrap.classList.add('show-hint')});inp.addEventListener('mouseleave',()=>{wrap.classList.remove('show-hint')});refresh()})}
"""

new = """function updateSearchHintVisibility(inputId){const inp=document.getElementById(inputId);if(!inp)return;const wrap=inp.closest('.filter-input-wrap');if(!wrap)return;const has=!!inp.value.trim();wrap.classList.toggle('has-value',has);wrap.classList.remove('show-hint');if(has)wrap.classList.add('hint-suppressed');else wrap.classList.remove('hint-suppressed')}
function clearFilterInput(inputId){const inp=document.getElementById(inputId);if(!inp)return;inp.value='';updateSearchHintVisibility(inputId);if(inp.classList.contains('filter-input--organic'))syncBrowseSearchWidth(inputId);const tabById={charFilter:'characters',unitFilter:'units',suppFilter:'supporters',stageFilter:'stages',modFilter:'modifications'};if(inputId==='rankCharFilter'||inputId==='rankUnitFilter')scheduleRankingListReload();else if(tabById[inputId])debounceLoad(tabById[inputId]);inp.focus()}
function initSearchHints(){document.querySelectorAll('.filter-input-wrap').forEach(wrap=>{const inp=wrap.querySelector('.filter-input');if(!inp)return;if(!wrap.querySelector('.filter-input-clear')){const btn=document.createElement('button');btn.type='button';btn.className='filter-input-clear';btn.setAttribute('aria-label','Clear search');btn.title='Clear';btn.textContent='\\u00d7';btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();clearFilterInput(inp.id)});wrap.appendChild(btn)}function refresh(){updateSearchHintVisibility(inp.id);if(inp.classList.contains('filter-input--organic'))syncBrowseSearchWidth(inp.id)}inp.addEventListener('input',refresh);refresh()})}
"""

if old not in js:
    raise SystemExit('exact block not found')
js = js.replace(old, new, 1)
js_path.write_text(js, encoding='utf-8')
print('search clear patched')

# organic sizer padding
html_path = root / 'templates/index.html'
html = html_path.read_text(encoding='utf-8')
old_sizer = ".filter-input-wrap--organic .filter-input-sizer{position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:pre;overflow:hidden;height:0;font-size:16px;font-weight:400;padding:9px 14px;font-family:inherit;box-sizing:border-box;border:1px solid transparent}"
new_sizer = ".filter-input-wrap--organic .filter-input-sizer{position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:pre;overflow:hidden;height:0;font-size:16px;font-weight:400;padding:9px 36px 9px 14px;font-family:inherit;box-sizing:border-box;border:1px solid transparent}"
if old_sizer in html:
    html = html.replace(old_sizer, new_sizer, 1)
    print('sizer ok')
elif 'padding:9px 36px 9px 14px' in html:
    print('sizer already')
else:
    print('sizer MISSING')
html_path.write_text(html, encoding='utf-8')

# ZH reaction in app.py
py_path = root / 'app.py'
py = py_path.read_text(encoding='utf-8')
if "zh_map = {'射擊值': 'Ranged', '格鬥值': 'Melee', '覺醒值': 'Awaken', '反應值': 'Reaction'}" in py:
    print('zh already')
elif "zh_map = {'射擊值': 'Ranged', '格鬥值': 'Melee', '覺醒值': 'Awaken'}" in py:
    py = py.replace(
        "zh_map = {'射擊值': 'Ranged', '格鬥值': 'Melee', '覺醒值': 'Awaken'}",
        "zh_map = {'射擊值': 'Ranged', '格鬥值': 'Melee', '覺醒值': 'Awaken', '反應值': 'Reaction'}",
        1,
    )
    py = py.replace(
        r"自身(射擊值|格鬥值|覺醒值)((?:及(?:射擊值|格鬥值|覺醒值))*)提升(\d+)%",
        r"自身(射擊值|格鬥值|覺醒值|反應值)((?:及(?:射擊值|格鬥值|覺醒值|反應值))*)提升(\d+)%",
        1,
    )
    py = py.replace(
        r"及(射擊值|格鬥值|覺醒值)",
        r"及(射擊值|格鬥值|覺醒值|反應值)",
        1,
    )
    # also add standalone 反應值 line if missing
    if "自身反應值提升" not in py:
        py = py.replace(
            "for mm in re.finditer(r'自身覺醒值提升(\\d+)%', text):\n        bonuses['Awaken'] = bonuses.get('Awaken', 0) + int(mm.group(1))\n    return bonuses",
            "for mm in re.finditer(r'自身覺醒值提升(\\d+)%', text):\n        bonuses['Awaken'] = bonuses.get('Awaken', 0) + int(mm.group(1))\n    for mm in re.finditer(r'自身反應值提升(\\d+)%', text):\n        bonuses['Reaction'] = bonuses.get('Reaction', 0) + int(mm.group(1))\n    return bonuses",
            1,
        )
    py_path.write_text(py, encoding='utf-8')
    print('zh patched')
else:
    print('zh map not found')

# verify key bits
js2 = js_path.read_text(encoding='utf-8')
print('clearFilterInput', 'function clearFilterInput' in js2)
print('no mouseenter hint', "wrap.classList.add('show-hint')" not in js2 or js2.count("wrap.classList.add('show-hint')"))
print('ex default', "S.charSuperchargedExTier=d.ex_supercharged_tiers.length-1" in js2)
print('filter-input-clear css', 'filter-input-clear' in html_path.read_text(encoding='utf-8'))
print('stats_with_ex max', "ex_supercharged_tiers_payload[-1]" in py_path.read_text(encoding='utf-8'))
print('JA regex', r'超一[擊撃]EX' in py_path.read_text(encoding='utf-8'))
