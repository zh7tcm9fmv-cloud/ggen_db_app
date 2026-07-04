"""Audit max-range-up traits/abilities and classify condition types (read-only)."""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import (  # noqa: E402
    LANG_DATA,
    ability_name_implies_unit_stat_conditional_bucket,
    ability_resource_map,
    abil_link_map,
    build_ability_entry,
    char_skill,
    extract_data_list,
    trait_condition_raw_map,
    trait_data_map,
    trait_set_traits_map,
    unit_abil_map,
    unit_info_map,
    _is_conditional_stat_text,
    _parse_weapon_max_range_increases_from_text,
)

ld = LANG_DATA["EN"]


def classify_condition(name, text):
    blob = ((name or "") + " " + (text or "")).lower()
    orig = (name or "") + "\n" + (text or "")
    tags = []
    if (
        "vigor" in blob
        or "supercharged" in blob
        or "super high" in blob
        or "战意" in orig
        or "戰意" in orig
        or "テンション" in orig
        or "vigor conditions" in blob
        or "cnd: vigor" in blob
    ):
        tags.append("vigor")
    if "specified tag" in blob or "標籤" in orig or "标签" in orig or "タグ" in orig:
        tags.append("tag")
    if "piloting" in blob or "搭乘" in orig or "搭乗" in orig:
        tags.append("piloting/unit")
    if "specified series" in blob or "系列" in orig or "シリーズ" in orig:
        tags.append("series")
    if "carozzo" in blob or "卡羅" in orig or "カロッゾ" in orig:
        tags.append("squad/pilot-target")
    if "next fight" in blob or "activating the effect" in blob:
        tags.append("skill/next-fight")
    if "melee" in blob or "格鬥" in orig or "格斗" in orig:
        tags.append("melee")
    if not tags:
        if _is_conditional_stat_text(text or ""):
            tags.append("other-conditional")
        else:
            tags.append("unconditional?")
    return tags


def unit_name(uid):
    lid = ld["unit_id_map"].get(uid, "")
    return ld["unit_text_map"].get(lid, uid)


def main():
    unit_rows = []
    for uid in sorted(unit_abil_map.keys()):
        for ab in unit_abil_map.get(uid, []):
            try:
                bab = build_ability_entry(
                    str(ab["id"]),
                    ld["abil_name_map"],
                    abil_link_map,
                    trait_set_traits_map,
                    trait_data_map,
                    ld["lang_text_map"],
                    ld["lang_text_map"],
                    trait_condition_raw_map,
                    ld["lineage_lookup"],
                    ld["series_name_map"],
                    ability_resource_map,
                    ld["abil_desc_map"],
                    sort_order=ab["sort"],
                    lang_code="EN",
                )
            except Exception:
                continue
            text = "\n".join(
                (d.get("text", "") if isinstance(d, dict) else str(d))
                for d in bab.get("details", [])
            )
            blob = (bab.get("name", "") + text).lower()
            if "max range" not in blob or "increase" not in blob:
                continue
            incs = _parse_weapon_max_range_increases_from_text(text)
            unit_rows.append(
                {
                    "uid": uid,
                    "unit": unit_name(uid),
                    "ability": bab.get("name", ""),
                    "text": text.replace("\n", " | "),
                    "incs": incs,
                    "cond": classify_condition(bab.get("name", ""), text),
                    "cp_bucket": ability_name_implies_unit_stat_conditional_bucket(bab),
                }
            )

    print("=== UNIT MS ABILITIES WITH MAX RANGE UP ===")
    print("count:", len(unit_rows))
    for r in unit_rows:
        non_vigor = [c for c in r["cond"] if c != "vigor"]
        flag = " *** NON-VIGOR" if non_vigor else ""
        print(f"{r['uid']} | {r['ability'][:60]} | cond={r['cond']}{flag}")
        print(f"   {r['text'][:140]}")

    print("\n=== NON-VIGOR UNIT MS ABILITIES ===")
    nv = [r for r in unit_rows if any(c for c in r["cond"] if c != "vigor")]
    if not nv:
        print("(none on units)")
    for r in nv:
        print(f"  {r['uid']} {r['unit'][:35]}")
        print(f"    {r['ability']}")
        print(f"    cond={r['cond']} cp_bucket={r['cp_bucket']}")
        print(f"    {r['text'][:120]}")

    # Character skills with range up
    print("\n=== CHARACTER SKILLS WITH MAX RANGE UP ===")
    sk_rows = []
    for sk in extract_data_list(char_skill):
        cid = str(sk.get("CharacterId", "")).strip()
        for key in ("CharacterSkillId", "SkillId", "SpCharacterSkillId"):
            sid = str(sk.get(key) or "").strip()
            if not sid or sid in ("0", "None"):
                continue
            try:
                r = resolve_char_skill(sid, ld, 0, "Sp" in key)
            except Exception:
                continue
            for block in (r.get("desc"), r.get("sp_desc")):
                if not block:
                    continue
                blob = block.lower()
                if "max range" not in blob or "increase" not in blob:
                    continue
                sk_rows.append(
                    {
                        "char_id": cid,
                        "skill_id": sid,
                        "name": r.get("name", sid),
                        "text": block.replace("\n", " | "),
                        "cond": classify_condition(r.get("name", ""), block),
                    }
                )
    seen_sk = set()
    for r in sk_rows:
        k = r["text"][:80]
        if k in seen_sk:
            continue
        seen_sk.add(k)
        print(f"  char={r['char_id']} skill={r['skill_id']} | {r['name'][:50]}")
        print(f"    cond={r['cond']}")
        print(f"    {r['text'][:120]}")

    # All unique EN trait lines
    print("\n=== ALL UNIQUE EN m_trait.json RANGE-UP LINES ===")
    traits_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "EN", "lang", "m_trait.json"
    )
    traits = json.load(open(traits_path, encoding="utf-8"))
    seen = set()
    vigor_only = []
    non_vigor_lines = []
    for row in traits:
        v = (row.get("value") or "").strip()
        vl = v.lower()
        if not (
            ("increase max range" in vl or ("max range of" in vl and "increased" in vl))
            and "decrease" not in vl
            and "down" not in vl
        ):
            continue
        key = v[:100]
        if key in seen:
            continue
        seen.add(key)
        cond = classify_condition("", v)
        entry = (cond, v.replace("\n", " | "))
        if any(c for c in cond if c != "vigor"):
            non_vigor_lines.append(entry)
        else:
            vigor_only.append(entry)

    print(f"vigor-only lines: {len(vigor_only)}")
    print(f"non-vigor lines: {len(non_vigor_lines)}")
    print("\n--- Non-vigor trait text (may be on chars/units/stages, not all wired to units) ---")
    for cond, txt in non_vigor_lines:
        print(f"  [{', '.join(cond)}] {txt[:150]}")


if __name__ == "__main__":
    main()
