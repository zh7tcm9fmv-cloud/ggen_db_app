"""Extract Team Builder–only code from app.js into static/js/team_builder.js."""
from __future__ import annotations

import gzip
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "static" / "js" / "app.js"
OUT = ROOT / "static" / "js" / "team_builder.js"
BACKUP = ROOT / "static" / "js" / "app.js.pre_tb_extract"

KEEP = {
    "PHENEX_STACK_UNIT_ID",
    "PHENEX_SQUAD_FLAT_AD_PER_STACK_PCT",
    "PHENEX_SQUAD_FLAT_AD_MAX_STACKS",
    "PHENEX_SQUAD_FLAT_AD_MAX_TOTAL_PCT",
    "_scIsQubeleyExCombo",
    "_scTextImpliesSquadBuff",
    "_scTraitLineImpliesPerSquadUnitFlatStack",
    "_scParseSquadLineStats",
    "_scBuildBindingFromParsed",
    "_scWalkAbilityDetailsForSquad",
    "_scSquadBindingCacheKey",
    "_scFindSquadConditionBinding",
    "_dcOptionPartRowIsSsr",
    "_dcCollectUsedSsrDcOptionPartIds",
    "_dcDcOptionPartSsrDeniedForSlot",
    "_dcStatTotalsForAutoRank",
    "_dcRankOptionForAutoFill",
    "_dcDedupeSsrOptionPartsAcrossDcSlots",
    "_dcAutoFitContextValid",
    "_dcSlotNeedsAutoFit",
    "_dcScheduleAutoFitOptionPartAndSupporter",
    "dcAutoFitOptionPartAndSupporter",
    "_tbOptionPartIsSsr",
    "_tbGetUnitStatKey",
    "renderEntityPickerItemCell",
    "renderOptionPartPickerCell",
    "renderSupporterPickerCell",
    "_tbSortPickerEntityRows",
    "_tbPickerRowSearchHay",
}

EXPORTS = [
    "initTeamBuilder",
    "renderTeamBuilder",
    "tbRefreshSlottedUnitData",
    "tbAutoFillEmptyOptionParts",
    "tbPrimePickerCaches",
    "tbApplyLangStatic",
    "wireTbPickerBodyClicks",
    "closeTbPicker",
    "_tbCheckUrlParams",
    "tbClearSupporter",
    "tbClearSquad",
    "onTbTerrainChange",
    "toggleTbMasterLeague",
    "toggleTbGrandOffensive",
    "openTbFormationModal",
    "closeTbFormationModal",
    "tbStartRearrange",
    "openTbSupporterPicker",
    "tbSlotClick",
    "tbPilotAddClick",
    "tbPilotPickRecommended",
    "tbSetSlotLbTier",
    "tbSetSlotUnitStatMode",
    "tbSlotContextMenu",
    "tbOpenOptionPartsPicker",
    "tbOpenOptionReplacePicker",
    "tbClearOptionPart",
    "tbSetSupporterLbFromIcon",
    "tbOnSupporterLevelInput",
    "filterTbPicker",
    "filterTbPickerList",
    "pickTbItem",
    "tbRearrangeLinkedToggle",
    "tbRearrangeTapPart",
    "tbRearrangeTap",
    "tbRearrangeCancel",
    "tbRearrangeConfirm",
    "tbFormationCopyLink",
    "tbFormationScreenshot",
    "tbClearFormationSlot",
    "tbSaveFormationSlot",
    "tbLoadFormationSlot",
    "tbSyncSquadNameFromFormation",
    "openTbPicker",
    "tbFillTerrainSelects",
    "renderTbSlots",
    "renderTbSupporter",
    "renderTbStats",
    "tbRenderFormationPreview",
    "tbRenderRearrangeBody",
]


def end_function(src: str, start: int) -> int:
    depth = 0
    i = start
    n = len(src)
    in_s = None
    line_c = False
    block_c = False
    started = False
    while i < n:
        ch = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if line_c:
            if ch == "\n":
                line_c = False
            i += 1
            continue
        if block_c:
            if ch == "*" and nxt == "/":
                block_c = False
                i += 2
                continue
            i += 1
            continue
        if in_s:
            if ch == "\\" and in_s != "`":
                i += 2
                continue
            if ch == in_s:
                in_s = None
            i += 1
            continue
        if ch == "/" and nxt == "/":
            line_c = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            block_c = True
            i += 2
            continue
        if ch in ("'", '"', "`"):
            in_s = ch
            i += 1
            continue
        if ch == "{":
            depth += 1
            started = True
        elif ch == "}":
            depth -= 1
            if started and depth == 0:
                end = i + 1
                if end < n and src[end] == "\n":
                    end += 1
                return end
        i += 1
    raise SystemExit(f"Unclosed function at {start}")


def end_const(src: str, start: int) -> int:
    depth = 0
    i = start
    n = len(src)
    in_s = None
    line_c = False
    block_c = False
    while i < n:
        ch = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if line_c:
            if ch == "\n":
                line_c = False
            i += 1
            continue
        if block_c:
            if ch == "*" and nxt == "/":
                block_c = False
                i += 2
                continue
            i += 1
            continue
        if in_s:
            if ch == "\\" and in_s != "`":
                i += 2
                continue
            if ch == in_s:
                in_s = None
            i += 1
            continue
        if ch == "/" and nxt == "/":
            line_c = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            block_c = True
            i += 2
            continue
        if ch in ("'", '"', "`"):
            in_s = ch
            i += 1
            continue
        if ch in "{[(":
            depth += 1
        elif ch in "}])":
            depth -= 1
        elif ch == ";" and depth == 0:
            return i + 1
        i += 1
    raise SystemExit(f"Unclosed const at {start}")


def decls_in_region(region: str, base: int):
    """Yield (name, abs_start, abs_end) for top-level decls in region text."""
    # Match only at beginning of lines
    for m in re.finditer(
        r"(?m)^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(|^(?:const|let|var)\s+([A-Za-z0-9_$,\s]+)=",
        region,
    ):
        rel = m.start()
        # Ensure this match is at brace-depth 0 within region (skip nested column-0 funcs)
        # Approximate: count braces before this point in region with string awareness
        prefix = region[:rel]
        if brace_depth(prefix) != 0:
            continue
        is_fn = m.group(1) is not None
        names = [m.group(1)] if is_fn else [x.strip() for x in m.group(2).split(",") if x.strip()]
        abs_start = base + rel
        if is_fn:
            abs_end = end_function(region, rel) + base
            # end_function was given region-relative start; fix:
            abs_end = base + end_function(region, rel)
        else:
            abs_end = base + end_const(region, rel)
        for name in names:
            yield name, abs_start, abs_end


def brace_depth(text: str) -> int:
    depth = 0
    i = 0
    n = len(text)
    in_s = None
    line_c = False
    block_c = False
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if line_c:
            if ch == "\n":
                line_c = False
            i += 1
            continue
        if block_c:
            if ch == "*" and nxt == "/":
                block_c = False
                i += 2
                continue
            i += 1
            continue
        if in_s:
            if ch == "\\" and in_s != "`":
                i += 2
                continue
            if ch == in_s:
                in_s = None
            i += 1
            continue
        if ch == "/" and nxt == "/":
            line_c = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            block_c = True
            i += 2
            continue
        if ch in ("'", '"', "`"):
            in_s = ch
            i += 1
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
        i += 1
    return depth


def main() -> None:
    src = APP.read_text(encoding="utf-8")
    start = src.find("const TB_FORMS_KEY=")
    if start < 0:
        raise SystemExit("TB_FORMS_KEY not found")
    fn = src.find("function _tbCheckUrlParams()", start)
    if fn < 0:
        raise SystemExit("_tbCheckUrlParams not found")
    end = end_function(src, fn)
    region = src[start:end]
    print(f"TB region bytes {len(region):,}")

    spans = list(decls_in_region(region, start))
    # unique by range
    extract = []
    kept = []
    seen = set()
    for name, a, b in spans:
        key = (a, b)
        if key in seen:
            continue
        seen.add(key)
        if name in KEEP:
            kept.append(name)
        else:
            extract.append((name, a, b))

    extract.sort(key=lambda x: x[1])
    merged = []
    for name, a, b in extract:
        if merged and a <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))

    body = "\n".join(src[a:b] for a, b in merged)
    print(f"MOVE {len(extract)} KEEP {len(kept)}")
    print("kept:", ", ".join(kept))
    print(f"moved raw={len(body):,} gzip9={len(gzip.compress(body.encode(), 9)):,}")

    export_lines = "\n".join(f"if(typeof {n}==='function') global.{n}={n};" for n in EXPORTS)
    OUT.write_text(
        "/* Team Builder — lazy-loaded via __GGEN_LAZY__.ensureTeamBuilder */\n"
        "(function(global){\n'use strict';\n"
        "// Uses app.js globals: S, t, esc, imgUrl, fetchJsonWithWarmupRetry, _sc*, _dc*, picker cells, etc.\n"
        f"{body}\n{export_lines}\n"
        "if(typeof wireTbPickerBodyClicks==='function') try{wireTbPickerBodyClicks()}catch(_){}\n"
        "global.GgenTeamBuilder={loaded:1};\n"
        "})(typeof window!=='undefined'?window:globalThis);\n",
        encoding="utf-8",
    )
    print("Wrote", OUT)

    shutil.copy2(APP, BACKUP)
    pieces = []
    cursor = 0
    for a, b in merged:
        pieces.append(src[cursor:a])
        cursor = b
    pieces.append(src[cursor:])
    joined = "".join(pieces)

    marker = "function ensureCraftUiCss()"
    idx = joined.find(marker)
    if idx < 0:
        raise SystemExit("ensureCraftUiCss missing")
    line_end = joined.find("\n", idx) + 1
    joined = joined[:line_end] + build_stubs() + joined[line_end:]
    joined = patch_sites(joined)
    APP.write_text(joined, encoding="utf-8")
    print("Updated", APP)
    print("app.js", APP.stat().st_size, "tb.js", OUT.stat().st_size)


def build_stubs() -> str:
    return (
        "function ensureTeamBuilderLoaded(){"
        "if(window.GgenTeamBuilder&&window.GgenTeamBuilder.loaded)return Promise.resolve(window.GgenTeamBuilder);"
        "const lazy=window.__GGEN_LAZY__;"
        "if(lazy&&typeof lazy.ensureTeamBuilder==='function')return lazy.ensureTeamBuilder();"
        "return Promise.resolve(null)}"
        "async function runTeamBuilder(name,args){"
        "await ensureTeamBuilderLoaded();"
        "const fn=window[name];"
        "if(typeof fn!=='function')throw new Error('Team Builder missing '+name);"
        "return fn.apply(null,args||[])}"
        "function initTeamBuilder(){return runTeamBuilder('initTeamBuilder',arguments)}"
        "function renderTeamBuilder(){return runTeamBuilder('renderTeamBuilder',arguments)}"
        "function tbRefreshSlottedUnitData(){return runTeamBuilder('tbRefreshSlottedUnitData',arguments)}"
        "function tbAutoFillEmptyOptionParts(){return runTeamBuilder('tbAutoFillEmptyOptionParts',arguments)}"
        "function tbPrimePickerCaches(){return runTeamBuilder('tbPrimePickerCaches',arguments)}"
        "function tbApplyLangStatic(){if(!(window.GgenTeamBuilder&&window.GgenTeamBuilder.loaded))return;return runTeamBuilder('tbApplyLangStatic',arguments)}"
        "function wireTbPickerBodyClicks(){return runTeamBuilder('wireTbPickerBodyClicks',arguments)}"
        "function closeTbPicker(){if(!(window.GgenTeamBuilder&&window.GgenTeamBuilder.loaded)){const po=document.getElementById('tbPickerOverlay');if(po){po.classList.remove('active');po.setAttribute('aria-hidden','true')}return}return runTeamBuilder('closeTbPicker',arguments)}"
        "function _tbCheckUrlParams(){return runTeamBuilder('_tbCheckUrlParams',arguments)}"
        "function tbClearSupporter(){return runTeamBuilder('tbClearSupporter',arguments)}"
        "function tbClearSquad(){return runTeamBuilder('tbClearSquad',arguments)}"
        "function onTbTerrainChange(){return runTeamBuilder('onTbTerrainChange',arguments)}"
        "function toggleTbMasterLeague(){return runTeamBuilder('toggleTbMasterLeague',arguments)}"
        "function toggleTbGrandOffensive(){return runTeamBuilder('toggleTbGrandOffensive',arguments)}"
        "function openTbFormationModal(){return runTeamBuilder('openTbFormationModal',arguments)}"
        "function closeTbFormationModal(){return runTeamBuilder('closeTbFormationModal',arguments)}"
        "function tbStartRearrange(){return runTeamBuilder('tbStartRearrange',arguments)}"
        "function openTbSupporterPicker(){return runTeamBuilder('openTbSupporterPicker',arguments)}"
        "function tbSlotClick(){return runTeamBuilder('tbSlotClick',arguments)}"
        "function tbPilotAddClick(){return runTeamBuilder('tbPilotAddClick',arguments)}"
        "function tbPilotPickRecommended(){return runTeamBuilder('tbPilotPickRecommended',arguments)}"
        "function tbSetSlotLbTier(){return runTeamBuilder('tbSetSlotLbTier',arguments)}"
        "function tbSetSlotUnitStatMode(){return runTeamBuilder('tbSetSlotUnitStatMode',arguments)}"
        "function tbSlotContextMenu(){return runTeamBuilder('tbSlotContextMenu',arguments)}"
        "function tbOpenOptionPartsPicker(){return runTeamBuilder('tbOpenOptionPartsPicker',arguments)}"
        "function tbOpenOptionReplacePicker(){return runTeamBuilder('tbOpenOptionReplacePicker',arguments)}"
        "function tbClearOptionPart(){return runTeamBuilder('tbClearOptionPart',arguments)}"
        "function tbSetSupporterLbFromIcon(){return runTeamBuilder('tbSetSupporterLbFromIcon',arguments)}"
        "function tbOnSupporterLevelInput(){return runTeamBuilder('tbOnSupporterLevelInput',arguments)}"
        "function filterTbPicker(){return runTeamBuilder('filterTbPicker',arguments)}"
        "function filterTbPickerList(){return runTeamBuilder('filterTbPickerList',arguments)}"
        "function pickTbItem(){return runTeamBuilder('pickTbItem',arguments)}"
        "function tbRearrangeLinkedToggle(){return runTeamBuilder('tbRearrangeLinkedToggle',arguments)}"
        "function tbRearrangeTapPart(){return runTeamBuilder('tbRearrangeTapPart',arguments)}"
        "function tbRearrangeTap(){return runTeamBuilder('tbRearrangeTap',arguments)}"
        "function tbRearrangeCancel(){return runTeamBuilder('tbRearrangeCancel',arguments)}"
        "function tbRearrangeConfirm(){return runTeamBuilder('tbRearrangeConfirm',arguments)}"
        "function tbFormationCopyLink(){return runTeamBuilder('tbFormationCopyLink',arguments)}"
        "function tbFormationScreenshot(){return runTeamBuilder('tbFormationScreenshot',arguments)}"
        "function tbClearFormationSlot(){return runTeamBuilder('tbClearFormationSlot',arguments)}"
        "function tbSaveFormationSlot(){return runTeamBuilder('tbSaveFormationSlot',arguments)}"
        "function tbLoadFormationSlot(){return runTeamBuilder('tbLoadFormationSlot',arguments)}"
        "function tbSyncSquadNameFromFormation(){return runTeamBuilder('tbSyncSquadNameFromFormation',arguments)}"
        "function openTbPicker(){return runTeamBuilder('openTbPicker',arguments)}"
        "async function bootTeamBuilderTab(){"
        "await ensureTeamBuilderLoaded();"
        "await runTeamBuilder('initTeamBuilder');"
        "await runTeamBuilder('tbRefreshSlottedUnitData');"
        "await runTeamBuilder('tbAutoFillEmptyOptionParts',[{skipRender:true}]);"
        "await runTeamBuilder('renderTeamBuilder');"
        "setTimeout(()=>{void runTeamBuilder('tbPrimePickerCaches')},0)}\n"
    )


def patch_sites(src: str) -> str:
    old_switch = (
        "else if(tab==='team_builder'){if(/^\\/op\\/[^/]+\\/?$/.test(location.pathname))"
        "replaceHistoryToBrowsePath('/');initTeamBuilder();void tbRefreshSlottedUnitData()"
        ".then(async()=>{await tbAutoFillEmptyOptionParts({skipRender:true});renderTeamBuilder();"
        "setTimeout(tbPrimePickerCaches,0)})}"
    )
    new_switch = (
        "else if(tab==='team_builder'){if(/^\\/op\\/[^/]+\\/?$/.test(location.pathname))"
        "replaceHistoryToBrowsePath('/');void bootTeamBuilderTab()}"
    )
    if old_switch not in src:
        raise SystemExit("switchTab TB branch not found")
    src = src.replace(old_switch, new_switch, 1)
    old_lang = (
        "if(S.currentTab==='team_builder'){S._tbPickerRowCache=null;initTeamBuilder();"
        "void tbRefreshSlottedUnitData().then(async()=>{await tbAutoFillEmptyOptionParts({skipRender:true});"
        "renderTeamBuilder();setTimeout(tbPrimePickerCaches,0)})}"
    )
    new_lang = "if(S.currentTab==='team_builder'){S._tbPickerRowCache=null;void bootTeamBuilderTab()}"
    if old_lang not in src:
        raise SystemExit("selLang TB branch not found")
    src = src.replace(old_lang, new_lang, 1)
    src = src.replace("wireTbPickerBodyClicks();", "/* Team Builder picker wired on module load */;", 1)
    src = src.replace(
        "if(typeof globalThis.tbApplyLangStatic!=='function'){globalThis.tbApplyLangStatic=function(){}}\n",
        "",
        1,
    )
    return src


if __name__ == "__main__":
    main()
