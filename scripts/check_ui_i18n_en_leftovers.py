# -*- coding: utf-8 -*-
"""Fail if matrix/gacha/roadmap rotate (and similar) chrome is still English outside EN.

Usage (repo root):
  python scripts/check_ui_i18n_en_leftovers.py

Catches the class of bugs where JA/TW/HK/KR packs keep the EN sentence
(e.g. rotate-to-landscape) so we do not have to spot them one UI node at a time.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EN_ROTATE = "Rotate to landscape for a better viewing"

# Keys that may intentionally stay English (codes / paths / shared chrome).
ALLOW_SAME = {
    "ssrPlus",
    "ssrMinus",
    "ur",
    "foot",
    "clearFocus",
    "clear",
    "Clear",
}


def extract_locale_packs(text: str, root_name: str) -> dict[str, dict[str, str]]:
    m = re.search(rf"(?:var|const|let)\s+{root_name}\s*=\s*\{{", text)
    if not m:
        return {}
    start = m.end()
    depth = 1
    i = start
    while i < len(text) and depth:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    block = text[start : i - 1]
    out: dict[str, dict[str, str]] = {}
    for loc in ("EN", "JA", "TW", "HK", "HR", "KR", "JP"):
        mm = re.search(rf"\n\s*{loc}:\s*\{{", block)
        if not mm:
            continue
        s = mm.end()
        d = 1
        j = s
        while j < len(block) and d:
            if block[j] == "{":
                d += 1
            elif block[j] == "}":
                d -= 1
            j += 1
        body = block[s : j - 1]
        keys: dict[str, str] = {}
        for km in re.finditer(
            r"([a-zA-Z0-9_]+)\s*:\s*(('([^'\\]|\\.)*'|\"([^\"\\]|\\.)*\"))",
            body,
        ):
            key = km.group(1)
            raw = km.group(2)
            try:
                val = eval(raw)  # noqa: S307 — string literals from our source only
            except Exception:
                val = raw[1:-1]
            keys[key] = val
        out[loc] = keys
    return out


def check_packs(path: Path, root: str, required_locs: list[str]) -> list[str]:
    text = path.read_text(encoding="utf-8")
    packs = extract_locale_packs(text, root)
    errs: list[str] = []
    en = packs.get("EN") or {}
    if not en:
        errs.append(f"{path.name}: no EN pack under {root}")
        return errs
    for loc in required_locs:
        pack = packs.get(loc)
        if not pack:
            # KR may alias HR elsewhere — only require HR for matrix files
            if loc == "KR" and "HR" in packs:
                continue
            errs.append(f"{path.name}: missing {root}.{loc}")
            continue
        for k, ev in en.items():
            if k in ALLOW_SAME or not isinstance(ev, str):
                continue
            if k not in pack:
                errs.append(f"{path.name}: {loc}.{k} MISSING")
                continue
            pv = pack[k]
            if pv == ev and re.search(r"[A-Za-z]{4,}", ev) and " " in ev:
                errs.append(f"{path.name}: {loc}.{k} still EN: {ev!r}")
    return errs


def check_app_gs_rotate() -> list[str]:
    app = (ROOT / "static/js/app.js").read_text(encoding="utf-8")
    errs: list[str] = []
    # Every gs_rotate_hint except EN Supporters context must be localized
    for m in re.finditer(r"gs_supp_label:'([^']*)',gs_rotate_hint:'([^']*)'", app):
        supp, hint = m.group(1), m.group(2)
        if supp == "Supporters":
            if hint != EN_ROTATE:
                errs.append(f"app.js EN gs_rotate_hint unexpected: {hint!r}")
        elif hint == EN_ROTATE:
            errs.append(f"app.js gs_rotate_hint still EN after supp={supp!r}")
    # KR_CORE path (no gs_supp_label immediately before in same pattern)
    if re.search(
        r"gs_results_title:'[^']*',gs_rotate_hint:'Rotate to landscape for a better viewing'",
        app,
    ):
        errs.append("app.js KR_CORE gs_rotate_hint still EN")
    return errs


def check_roadmap() -> list[str]:
    rm = (ROOT / "templates/roadmap.html").read_text(encoding="utf-8")
    errs: list[str] = []
    for loc in ("TW", "HK", "JP", "JA", "KR", "HR"):
        if not re.search(rf"\b{loc}\s*:\s*'[^']+'", rm[rm.find("ROTATE_COPY") : rm.find("ROTATE_ARIA") + 400]):
            # looser: require KR in ROTATE_COPY block
            pass
    block = rm[rm.find("const ROTATE_COPY") : rm.find("function syncRotateHint")]
    for loc in ("KR", "HR", "JP", "TW", "HK"):
        if f"{loc}:" not in block and f"{loc} :" not in block:
            errs.append(f"roadmap.html ROTATE_* missing {loc}")
        elif loc in ("KR", "HR", "JP", "TW", "HK"):
            m = re.search(rf"{loc}\s*:\s*'([^']*)'", block)
            if m and m.group(1) == EN_ROTATE:
                errs.append(f"roadmap.html ROTATE_COPY.{loc} still EN")
    return errs


def check_late_unit_filter_kr() -> list[str]:
    """Late T.EN.unit_filter_* / unit_map_preview_* must also set T.KR.* (T.HR aliases T.KR)."""
    errs: list[str] = []
    app = (ROOT / "static/js/app.js").read_text(encoding="utf-8")
    keys = sorted(
        set(re.findall(r"T\.EN\.(unit_filter_[a-z0-9_]+)=", app))
        | set(re.findall(r"T\.EN\.(unit_map_preview_[a-z0-9_]+)=", app))
    )
    for k in keys:
        if f"T.KR.{k}=" not in app:
            errs.append(f"app.js late T.EN.{k} missing T.KR.{k}")
    # After-move must not keep the old JA armor mistranslation
    if "移動後のマップアーマー" in app:
        errs.append("app.js unit_filter_mwrt_after_move still has マップアーマー")
    if "After Move MAP weapon" in app and "T.KR.unit_filter_mwrt_after_move=" not in app:
        errs.append("app.js KR after-move MAP label missing")
    return errs


def check_op_mod_filter_locales() -> list[str]:
    """/op effect filters must not keep EN Max HP/EN in TW·HK (or KR_CORE)."""
    errs: list[str] = []
    app = (ROOT / "static/js/app.js").read_text(encoding="utf-8")
    # TW/HK historically shipped English Max HP/EN next to Chinese Effect label
    bad = re.findall(
        r"mod_filter_effect:'效果類型',mod_filter_effect_hp:'(Max HP ↑)',mod_filter_effect_en:'(Max EN ↑)'",
        app,
    )
    if bad:
        errs.append("app.js TW/HK mod_filter_effect_hp/en still EN (Max HP/EN)")
    # KR must differ from EN for these keys somewhere in KR_CORE or overlays
    for key, en in (
        ("mod_filter_effect_hp", "Max HP ↑"),
        ("mod_filter_effect_en", "Max EN ↑"),
    ):
        if f"{key}:'{en}'" in app and f"{key}:'최대" not in app and f"{key}:'최대 " not in app:
            # allow either 최대 HP or 최대HP
            if not re.search(rf"{key}:'최대\s*HP", app) and key.endswith("_hp"):
                errs.append(f"app.js KR {key} missing Korean")
            if not re.search(rf"{key}:'최대\s*EN", app) and key.endswith("_en"):
                errs.append(f"app.js KR {key} missing Korean")
    # Collections standalone must expose KR pack
    col = (ROOT / "static/js/collections.js").read_text(encoding="utf-8")
    if not re.search(r"\n\s*KR:\s*\{", col):
        errs.append("collections.js missing COL_T.KR")
    return errs


def check_op_server_locale_helpers() -> list[str]:
    """OP detail condition/acquisition helpers must cover HR (KR UI), not EN-only fallthrough."""
    errs: list[str] = []
    py = (ROOT / "app.py").read_text(encoding="utf-8")
    if "다음 태그를 가진 유닛 장비 시" not in py:
        errs.append("app.py missing HR OP condition-line template")
    if "입수 방법" not in py:
        errs.append("app.py missing HR OP acquisition_method_label")
    if "_format_fierce_enemy_assault_acq" not in py:
        errs.append("app.py missing localized fierce-enemy assault acq helper")
    # Old hard-coded EN-only path for type 22
    if re.search(
        r"methods\.append\(f'Clear Stage \"Fierce Enemy Assault Vs\. \{enemy_name\} \(Challenge\) Level 8\"'\)",
        py,
    ):
        errs.append("app.py still hardcodes EN Fierce Enemy Assault Clear Stage line")
    if "'경우'" not in py and '"경우"' not in py:
        errs.append("app.py OP conditional-phrase hints missing Korean 경우")
    return errs


def check_kr_core_rotate_and_key_kr() -> list[str]:
    """KR_CORE must not keep the EN rotate sentence; KEY_KR leftovers must differ from EN."""
    import importlib.util

    errs: list[str] = []
    app = (ROOT / "static/js/app.js").read_text(encoding="utf-8")
    ks = app.find("const KR_CORE_LABELS=")
    ke = app.find("\nT.KR=Object.assign", ks)
    if ks < 0 or ke < 0:
        return ["app.js: KR_CORE_LABELS missing"]
    block = app[ks:ke]
    if EN_ROTATE in block:
        errs.append("app.js KR_CORE still has EN rotate sentence")
    # Light gate: KEY_KR multi-word overrides must not still equal EN inside KR_CORE
    spec = importlib.util.spec_from_file_location(
        "gen_kr_ui_labels", ROOT / "scripts" / "gen_kr_ui_labels.py"
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(mod)
    en_body = app[app.find("const T={EN:{") : app.find("\nTW:{")]
    en = dict(re.findall(r"([a-zA-Z0-9_]+):'((?:\\'|[^'])*)'", en_body))
    kr = dict(re.findall(r"([a-zA-Z0-9_]+):'((?:\\'|[^'])*)'", block))
    for key in (
        "gs_rotate_hint",
        "victory_conditions",
        "applies_to",
        "dc_defend",
        "tb_batch",
        "whats_new_label_new_unit",
    ):
        if key in mod.KEY_KR and kr.get(key) == en.get(key):
            errs.append(f"app.js KR_CORE.{key} still EN")
    return errs


def main() -> int:
    errs: list[str] = []
    errs += check_packs(ROOT / "static/js/tag_matrix.js", "I18N", ["JA", "TW", "HK", "HR"])
    errs += check_packs(ROOT / "static/js/debuff_matrix.js", "I18N", ["JA", "TW", "HK", "HR"])
    errs += check_app_gs_rotate()
    errs += check_roadmap()
    errs += check_kr_core_rotate_and_key_kr()
    errs += check_late_unit_filter_kr()
    errs += check_op_mod_filter_locales()
    errs += check_op_server_locale_helpers()
    for rel in (
        "static/js/tag_matrix.js",
        "static/js/debuff_matrix.js",
    ):
        text = (ROOT / rel).read_text(encoding="utf-8")
        count = text.count(EN_ROTATE)
        if count != 1:
            errs.append(f"{rel}: expected exactly 1 EN rotate sentence, found {count}")
    if errs:
        print("check_ui_i18n_en_leftovers: FAIL")
        for e in errs:
            print(" -", e)
        return 1
    print("check_ui_i18n_en_leftovers: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
