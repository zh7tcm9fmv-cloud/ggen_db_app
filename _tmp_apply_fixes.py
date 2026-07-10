from pathlib import Path
import re

root = Path(r'c:\Users\Mikew0911\Desktop\ggen_db_app')

# --- app.js: default max EX tier on character open ---
js = (root / 'static/js/app.js').read_text(encoding='utf-8')
old = "S.currentDetailData=d;S.currentDetailType=type;if(type==='supporter')"
new = (
    "S.currentDetailData=d;S.currentDetailType=type;"
    "if(type==='character'&&S.conditionalPassiveActive&&d.ex_supercharged_tiers&&d.ex_supercharged_tiers.length>1)"
    "S.charSuperchargedExTier=d.ex_supercharged_tiers.length-1;"
    "if(type==='supporter')"
)
if old not in js:
    raise SystemExit('openDetail assign pattern not found')
js = js.replace(old, new, 1)

# Search hint + clear button helpers
old_hint = (
    "function updateSearchHintVisibility(inputId){const inp=document.getElementById(inputId);if(!inp)return;"
    "const wrap=inp.closest('.filter-input-wrap');if(!wrap)return;"
    "if(inp.value.trim()){wrap.classList.add('hint-suppressed');wrap.classList.remove('show-hint')}"
    "else{wrap.classList.remove('hint-suppressed')}}"
    "function initSearchHints(){document.querySelectorAll('.filter-input-wrap').forEach(wrap=>{"
    "const inp=wrap.querySelector('.filter-input');if(!inp)return;"
    "function refresh(){updateSearchHintVisibility(inp.id);if(inp.classList.contains('filter-input--organic'))syncBrowseSearchWidth(inp.id)}"
    "inp.addEventListener('input',refresh);"
    "inp.addEventListener('mouseenter',()=>{if(!inp.value.trim())wrap.classList.add('show-hint')});"
    "inp.addEventListener('mouseleave',()=>{wrap.classList.remove('show-hint')});"
    "refresh()})}"
)
new_hint = (
    "function updateSearchHintVisibility(inputId){const inp=document.getElementById(inputId);if(!inp)return;"
    "const wrap=inp.closest('.filter-input-wrap');if(!wrap)return;"
    "const has=!!inp.value.trim();"
    "wrap.classList.toggle('has-value',has);"
    "wrap.classList.remove('show-hint');"
    "if(has)wrap.classList.add('hint-suppressed');else wrap.classList.remove('hint-suppressed')}"
    "function clearFilterInput(inputId){"
    "const inp=document.getElementById(inputId);if(!inp)return;"
    "inp.value='';"
    "updateSearchHintVisibility(inputId);"
    "if(inp.classList.contains('filter-input--organic'))syncBrowseSearchWidth(inputId);"
    "const tabById={charFilter:'characters',unitFilter:'units',suppFilter:'supporters',stageFilter:'stages',modFilter:'modifications'};"
    "if(inputId==='rankCharFilter'||inputId==='rankUnitFilter')scheduleRankingListReload();"
    "else if(tabById[inputId])debounceLoad(tabById[inputId]);"
    "inp.focus()}"
    "function initSearchHints(){document.querySelectorAll('.filter-input-wrap').forEach(wrap=>{"
    "const inp=wrap.querySelector('.filter-input');if(!inp)return;"
    "if(!wrap.querySelector('.filter-input-clear')){"
    "const btn=document.createElement('button');"
    "btn.type='button';btn.className='filter-input-clear';btn.setAttribute('aria-label','Clear search');"
    "btn.title='Clear';btn.textContent='\\u00d7';"
    "btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();clearFilterInput(inp.id)});"
    "wrap.appendChild(btn)}"
    "function refresh(){updateSearchHintVisibility(inp.id);if(inp.classList.contains('filter-input--organic'))syncBrowseSearchWidth(inp.id)}"
    "inp.addEventListener('input',refresh);"
    "refresh()})}"
)
if old_hint not in js:
    raise SystemExit('search hint block not found')
js = js.replace(old_hint, new_hint, 1)
(root / 'static/js/app.js').write_text(js, encoding='utf-8')
print('app.js patched')

# --- index.html: organic sizer padding for clear btn ---
html = (root / 'templates/index.html').read_text(encoding='utf-8')
html2 = html.replace(
    ".filter-input-wrap--organic .filter-input-sizer{position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:pre;overflow:hidden;height:0;font-size:16px;font-weight:400;padding:9px 14px;font-family:inherit;box-sizing:border-box;border:1px solid transparent}",
    ".filter-input-wrap--organic .filter-input-sizer{position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:pre;overflow:hidden;height:0;font-size:16px;font-weight:400;padding:9px 36px 9px 14px;font-family:inherit;box-sizing:border-box;border:1px solid transparent}",
    1,
)
if html2 == html:
    print('WARN: sizer padding not updated')
else:
    print('sizer padding updated')
(root / 'templates/index.html').write_text(html2, encoding='utf-8')

# --- app.py ZH reaction ---
py = (root / 'app.py').read_text(encoding='utf-8')
old_zh = "zh_map = {'射擊值': 'Ranged', '格鬥值': 'Melee', '覺醒值': 'Awaken'}"
new_zh = "zh_map = {'射擊值': 'Ranged', '格鬥值': 'Melee', '覺醒值': 'Awaken', '反應值': 'Reaction'}"
if old_zh in py:
    py = py.replace(old_zh, new_zh, 1)
    # also extend the regex groups if present
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
    (root / 'app.py').write_text(py, encoding='utf-8')
    print('zh reaction patched')
else:
    print('zh_map already patched or missing')
