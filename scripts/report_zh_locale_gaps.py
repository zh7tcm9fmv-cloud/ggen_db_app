#!/usr/bin/env python3
"""Report language-string rows present in EN but missing or empty in TW/HK lang JSON.

Run after importing new client exports so translators know what still needs zh strings.
The server fills blanks from EN at runtime (`apply_en_lang_data_fallback`), but this report
helps prevent shipping bundles that drift far behind EN.

Usage:
  python scripts/report_zh_locale_gaps.py
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = os.path.join(ROOT, "data")


def norm(x):
    if x is None:
        return "0"
    s = str(x).strip()
    return "0" if s == "" or s.lower() == "none" else s


def extract_rows(path):
    if not os.path.isfile(path):
        return []
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    if isinstance(d, dict) and isinstance(d.get("data"), list):
        return d["data"]
    if isinstance(d, list):
        return d
    if isinstance(d, dict):
        return list(d.values())
    return []


def lang_nonempty_ids(lang_dir: str, filename: str) -> set[str]:
    rows = extract_rows(os.path.join(lang_dir, filename))
    out = set()
    for it in rows:
        if not isinstance(it, dict):
            continue
        lid = norm(it.get("id") or it.get("Id"))
        if lid == "0":
            continue
        v = (
            it.get("value")
            or it.get("Value")
            or it.get("name")
            or it.get("Name")
            or it.get("text")
            or it.get("Text")
        )
        if v and str(v).strip():
            out.add(lid)
    return out


def name_lids_from_master(master_path: str) -> set[str]:
    need = set()
    for it in extract_rows(master_path):
        if not isinstance(it, dict):
            continue
        lid = norm(it.get("NameLanguageId") or it.get("nameLanguageId"))
        if lid != "0":
            need.add(lid)
    return need


def trait_name_lids_from_master(master_path: str) -> set[str]:
    need = set()
    for it in extract_rows(master_path):
        if not isinstance(it, dict):
            continue
        lid = norm(it.get("NameLanguageId") or it.get("nameLanguageId"))
        if lid != "0":
            need.add(lid)
    return need


def main() -> int:
    en_lang = os.path.join(DATA, "EN", "lang")
    en_master = os.path.join(DATA, "EN", "master")

    pairs = [
        ("characters", os.path.join(en_master, "m_character.json"), "m_character.json", name_lids_from_master),
        ("units", os.path.join(en_master, "m_unit.json"), "m_unit.json", name_lids_from_master),
        ("weapons", os.path.join(en_master, "m_weapon.json"), "m_weapon.json", name_lids_from_master),
        ("trait cards", os.path.join(en_master, "m_trait_set_detail.json"), "m_trait_set_detail.json", trait_name_lids_from_master),
    ]

    any_issue = False
    for lc in ("TW", "HK"):
        loc_lang = os.path.join(DATA, lc, "lang")
        print(f"=== {lc} ({loc_lang}) ===")
        if not os.path.isdir(loc_lang):
            print(f"  missing lang dir")
            any_issue = True
            continue
        en_nonempty = {}
        for label, master_path, lang_file, collector in pairs:
            lids = collector(master_path)
            en_ok = lang_nonempty_ids(en_lang, lang_file)
            loc_ok = lang_nonempty_ids(loc_lang, lang_file)
            miss = sorted(lid for lid in lids if lid in en_ok and lid not in loc_ok)
            print(f"  {label}: EN-named lids lacking localized row w/ text: {len(miss)}")
            if miss[:8]:
                print(f"    e.g. {miss[:8]}")
            if miss:
                any_issue = True
        print()

    # Exit 1 only when invoked with --strict (optional CI gate)
    if "--strict" in sys.argv and any_issue:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
