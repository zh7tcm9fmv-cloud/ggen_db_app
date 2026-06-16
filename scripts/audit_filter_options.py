"""Audit browse filter options: flag any UI key with zero matching entities."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as A


def count_units(fn):
    n = 0
    for uid, info in A.unit_info_map.items():
        if fn(uid, info):
            n += 1
    return n


def count_chars(fn):
    n = 0
    for cid, info in A.char_info_map.items():
        if fn(cid, info):
            n += 1
    return n


def main():
    ld = A.LANG_DATA.get("EN")
    lc = "EN"
    issues = []

    # --- Unit weapon debuff keys ---
    debuff_counts = {}
    for key in sorted(A.UNIT_WEAPON_DEBUFF_FILTER_KEYS):
        want = (key,)

        def _match(uid, _info, k=key):
            return A.unit_matches_weapon_debuff_filter(
                uid, ld, lc, (k,), stat_mode="normal", combine="and"
            )

        debuff_counts[key] = count_units(_match)

    present = set(A.WEAPON_DEBUFF_KEYS_PRESENT_UNION)
    for key, n in debuff_counts.items():
        if n == 0:
            issues.append(
                {
                    "area": "unit_weapon_debuff",
                    "key": key,
                    "count": 0,
                    "in_present_union": key in present,
                }
            )

    # --- Terrain tokens (UI: 5 terrains × 3 levels) ---
    terrains = ["Space", "Atmospheric", "Ground", "Sea", "Underwater"]
    for name in terrains:
        for lv in (1, 2, 3):
            token = f"{name}:{lv}"
            want = A.parse_unit_terrain_filter(token)

            def _terr(uid, info, w=want):
                return A.unit_matches_terrain_filter(
                    uid, info, w, stat_mode="normal", combine="and"
                )

            n = count_units(_terr)
            if n == 0:
                issues.append({"area": "unit_terrain", "key": token, "count": 0})

    # --- Weapon max range 1-6 (highest-damage weapon) ---
    for rv in range(1, 7):
        want = (rv,)

        def _wr(uid, _info, w=want):
            return A.unit_matches_weapon_range_filter(
                uid, ld, lc, w, stat_mode="normal", combine="and"
            )

        n = count_units(_wr)
        if n == 0:
            issues.append({"area": "unit_weapon_range", "key": str(rv), "count": 0})

    # --- Non-map weapon range 1-6 ---
    for rv in range(1, 7):
        want = (rv,)

        def _wrnm(uid, _info, w=want):
            return A.unit_matches_weapon_range_non_map_filter(
                uid, ld, lc, w, stat_mode="normal", combine="and", subset="non_map"
            )

        n = count_units(_wrnm)
        if n == 0:
            issues.append({"area": "unit_weapon_range_non_map", "key": str(rv), "count": 0})

    # --- Map weapon range types 0-6 ---
    for mrt in range(0, 7):

        def _mwr(uid, _info, t=mrt):
            return A.unit_matches_map_weapon_range_filter(uid, (t,), combine="and")

        n = count_units(_mwr)
        if n == 0:
            issues.append({"area": "unit_map_weapon_range", "key": str(mrt), "count": 0})

    # --- Mechanisms (from cache) ---
    mech_ids = set()
    for mids in A.UNIT_MECHANISM_MIDS_CACHE.values():
        mech_ids.update(mids)
    for mid in sorted(mech_ids, key=str):
        mid = str(mid)

        def _mech(uid, _info, m=mid):
            return m in set(A.UNIT_MECHANISM_MIDS_CACHE.get(uid, ()))

        n = count_units(_mech)
        if n == 0:
            issues.append({"area": "unit_mechanism", "key": mid, "count": 0})

    # --- Browse pack: unit lineages / series / abilities ---
    unit_lineages = A.lineages_for_entity_browse(A.unit_lin_map, ld)
    for row in unit_lineages:
        lid = str(row.get("id", ""))
        if not lid:
            continue

        def _lin(uid, _info, w=lid):
            return A.entity_matches_lineage(A.unit_lin_map, uid, w, "and")

        n = count_units(_lin)
        if n == 0:
            issues.append({"area": "unit_lineage", "key": lid, "name": row.get("name"), "count": 0})

    unit_series = A.series_for_entity_browse(ld, "units")
    for row in unit_series:
        sid = str(row.get("id", ""))
        if not sid:
            continue

        def _ser(uid, _info, w=sid):
            return A.entity_matches_series(A.unit_ser_map.get(uid, ""), w, lc, "or")

        n = count_units(_ser)
        if n == 0:
            issues.append({"area": "unit_series", "key": sid, "name": row.get("name"), "count": 0})

    unit_abilities = A.abilities_for_unit_browse(ld, lc)
    for row in unit_abilities:
        aid = str(row.get("id", ""))
        if not aid:
            continue

        def _abil(uid, _info, w=aid):
            return A.entity_matches_unit_abilities_filter(uid, w, "and")

        n = count_units(_abil)
        if n == 0:
            issues.append({"area": "unit_ability", "key": aid, "name": row.get("name"), "count": 0})

    # --- Character browse packs ---
    char_lineages = A.lineages_for_entity_browse(A.char_lin_map, ld)
    for row in char_lineages:
        lid = str(row.get("id", ""))
        if not lid:
            continue

        def _clin(cid, _info, w=lid):
            return A.entity_matches_lineage(A.char_lin_map, cid, w, "and")

        n = count_chars(_clin)
        if n == 0:
            issues.append({"area": "char_lineage", "key": lid, "name": row.get("name"), "count": 0})

    char_series = A.series_for_entity_browse(ld, "characters")
    for row in char_series:
        sid = str(row.get("id", ""))
        if not sid:
            continue

        def _cser(cid, _info, w=sid):
            return A.entity_matches_series(
                ld.get("char_ser_map", {}).get(cid, ""), w, lc, "or"
            )

        n = count_chars(_cser)
        if n == 0:
            issues.append({"area": "char_series", "key": sid, "name": row.get("name"), "count": 0})

    char_skills = A.skills_for_character_browse(ld)
    for row in char_skills:
        skid = str(row.get("id", ""))
        if not skid:
            continue

        def _sk(cid, _info, w=skid):
            return A.entity_matches_char_skills(cid, w, "and")

        n = count_chars(_sk)
        if n == 0:
            issues.append({"area": "char_skill", "key": skid, "name": row.get("name"), "count": 0})

    char_abilities = A.abilities_for_character_browse(ld, lc)
    special_abil_ids = {
        A.CHANCE_STEP_EX_FILTER_ID,
        A.SUPPORT_DEF_X2_FILTER_ID,
        A.SUPPORT_ATK_X2_FILTER_ID,
    }
    for row in char_abilities:
        aid = str(row.get("id", ""))
        if not aid or aid in special_abil_ids:
            continue
        want = A.normalize_id(aid)
        char_hits = set()
        for ab_row in A.extract_data_list(A.char_abil):
            cid = A.normalize_id(ab_row.get("CharacterId", ""))
            if cid not in A.char_info_map:
                continue
            for key in ("AbilityId", "SpAbilityId", "spAbilityId"):
                if A.normalize_id(ab_row.get(key) or "") == want:
                    char_hits.add(cid)
                    break
        n = len(char_hits)
        if n == 0:
            issues.append({"area": "char_ability", "key": aid, "name": row.get("name"), "count": 0})

    # --- Character special filters ---
    for fid, label, id_set in [
        (A.CHANCE_STEP_EX_FILTER_ID, "chance_step_ex", None),
        (A.SUPPORT_DEF_X2_FILTER_ID, "support_def_x2", A.SUPPORT_DEF_X2_CHARACTER_IDS),
        (A.SUPPORT_ATK_X2_FILTER_ID, "support_atk_x2", A.SUPPORT_ATK_X2_CHARACTER_IDS),
    ]:
        if id_set is not None:
            n = len(id_set)
        else:
            n = count_chars(
                lambda cid, _info, f=fid: A._char_matches_special_x2_filter(
                    cid, f, include_sp=False, include_conditional=False
                )
            )
        if n == 0:
            issues.append({"area": "char_special", "key": label, "count": 0})

    # --- Mod effect filters ---
    ltm = ld.get("lang_text_map", {})
    for ef in ["HP", "EN", "ATK", "DEF", "MOB", "OTHER"]:
        n = 0
        for item in A.extract_data_list(A.option_parts_data):
            if not isinstance(item, dict):
                continue
            opid = str(item.get("Id") or item.get("id", 0))
            if opid == "0":
                continue
            trait_set_id = A.normalize_id(item.get("TraitSetId") or item.get("traitSetId"))
            trait_ids = A.trait_set_traits_map.get(trait_set_id, [])
            details_list = []
            for tid in trait_ids:
                tdata = A.trait_data_map.get(tid, {})
                dlid = tdata.get("desc_lang_id", "")
                if dlid:
                    desc = ltm.get(dlid, "")
                    if desc:
                        details_list.append(desc.strip())
            details = " ".join(details_list) if details_list else ""
            if A.option_part_matches_effect_filter(details, ef):
                n += 1
        if n == 0:
            issues.append({"area": "mod_effect", "key": ef, "count": 0})

    # --- Compare UI debuff defs vs present union ---
    js_defs = [
        "atk_dn", "def_dn", "enemy_def_atk", "mob_dn", "acc_dn",
        "dmg_phys", "dmg_beam", "dmg_spec",
        "wp_phys", "wp_beam", "wp_spec",
        "range_beam", "range_phys", "range_6",
        "mp_1", "preemptive", "map_weapon",
    ]
    ui_stale = [k for k in js_defs if k not in present and debuff_counts.get(k, 0) > 0]
    ui_dead = [k for k in js_defs if debuff_counts.get(k, 0) == 0]

    print("=== Weapon debuff counts ===")
    for k in js_defs:
        print(f"  {k}: {debuff_counts.get(k, 0)}")

    print(f"\n=== Summary ===")
    print(f"Total issues (zero-match options): {len(issues)}")
    if issues:
        by_area = {}
        for it in issues:
            by_area.setdefault(it["area"], []).append(it)
        for area, rows in sorted(by_area.items()):
            print(f"\n{area} ({len(rows)}):")
            for r in rows[:20]:
                extra = f" — {r['name']}" if r.get("name") else ""
                print(f"  {r['key']}{extra}")
            if len(rows) > 20:
                print(f"  ... and {len(rows) - 20} more")

    print(f"\nUI debuff keys with 0 matches (should hide after API): {ui_dead}")
    print(f"UI debuff keys matching units but missing from present union: {ui_stale}")

    out_path = os.path.join(os.path.dirname(__file__), "output", "filter_audit.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "debuff_counts": debuff_counts,
                "issues": issues,
                "ui_dead_debuff_keys": ui_dead,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
