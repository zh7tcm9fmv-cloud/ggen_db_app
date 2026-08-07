"""Golden tests for SP investment pure scorer (no app import)."""

import copy
import unittest

from sp_investment_rank import (
    band_points,
    bucket_for_letter,
    clear_rules_cache,
    detect_weapon_bonus_type,
    er_access_points,
    filter_scored_unit_tags,
    letter_for_total,
    load_rules,
    map_coverage_points,
    pilot_tag_count_points,
    score_abilities,
    score_ability_effects,
    score_features,
    score_pilot_features,
    score_pilot_kit_structured,
    strategic_tag_points,
    tag_count_points,
    terrain_coverage_points,
    weapon_power_bands_for_mode,
)


class TestSpInvestmentBands(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        clear_rules_cache()
        cls.rules = load_rules()

    def test_rules_version_5(self):
        self.assertEqual(self.rules.get("version"), 5)
        self.assertEqual(self.rules["bucket_labels"]["recommended"], "Recommended")
        self.assertEqual(self.rules["bucket_labels"]["niche"], "Niche")

    def test_tag_points_disabled(self):
        self.assertEqual(tag_count_points(self.rules, 2), 0)
        self.assertEqual(tag_count_points(self.rules, 9), 0)

    def test_flavor_tags_excluded_from_count(self):
        scored = filter_scored_unit_tags(
            self.rules,
            [
                "Wing Series",
                "Operation Meteor",
                "Zero System",
                "SSR and Below",
                "One-Shot Killer",
                "Land",
                "Aerial Use",
            ],
        )
        self.assertEqual(scored, ["One-Shot Killer", "Land", "Aerial Use"])

    def test_strategic_tag_bands(self):
        table = {
            "one-shot killer": {"ur_weight": 10.0, "er_mentions": 2, "effective_weight": 13.0},
            "land": {"ur_weight": 8.0, "er_mentions": 0, "effective_weight": 8.0},
        }
        pts, meta = strategic_tag_points(
            self.rules,
            ["One-Shot Killer", "Land", "Wing Series"],
            table,
        )
        self.assertEqual(pts, 2)  # weight 21 → band 15-25 = +2
        self.assertGreaterEqual(meta["weight"], 15)

    def test_er_access_bands(self):
        self.assertEqual(er_access_points(self.rules, 1), -1)
        self.assertEqual(er_access_points(self.rules, 10), 0)
        self.assertEqual(er_access_points(self.rules, 20), 2)
        self.assertEqual(er_access_points(self.rules, 28), 3)

    def test_atk_attacker_bands_sheet(self):
        bands = self.rules["stat_bands"]["ATK"]["Attack"]
        self.assertEqual(band_points(bands, 11599), -2)
        self.assertEqual(band_points(bands, 11600), 0)
        self.assertEqual(band_points(bands, 12000), 1)
        self.assertEqual(band_points(bands, 12400), 2)

    def test_weapon_power_sp_vs_ssp(self):
        sp = weapon_power_bands_for_mode(self.rules, "sp", "Attack")
        ssp = weapon_power_bands_for_mode(self.rules, "ssp", "Attack")
        self.assertEqual(band_points(sp, 5200), 0)
        self.assertEqual(band_points(sp, 5500), 1)
        self.assertEqual(band_points(sp, 6100), 3)
        self.assertEqual(band_points(ssp, 5800), -1)
        self.assertEqual(band_points(ssp, 6100), 0)
        self.assertEqual(band_points(ssp, 6800), 2)

    def test_def_move_4_is_minus_one(self):
        base = _minimal_features(role="Defense", MOV=4)
        scored = score_features(base, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["movement"], -1)

    def test_mov6_attacker_plus_two(self):
        scored = score_features(_minimal_features(MOV=6), self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["movement"], 2)

    def test_range6_attacker_plus_three(self):
        scored = score_features(_minimal_features(weapon_range=6), self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["weapon_range"], 3)

    def test_range2_attacker_harder_penalty(self):
        scored = score_features(_minimal_features(weapon_range=2), self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["weapon_range"], -3)

    def test_terrain_space_land_base_zero(self):
        feats = _minimal_features(
            terrain={"Space": 2, "Atmospheric": 1, "Ground": 2, "Sea": 1, "Underwater": 1}
        )
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["terrain"], 0)

    def test_terrain_extra_atmo_and_water(self):
        feats = _minimal_features(
            terrain={"Space": 3, "Atmospheric": 3, "Ground": 3, "Sea": 1, "Underwater": 2}
        )
        scored = score_features(feats, self.rules, mode="sp")
        # Atmo+UW extras = 2; deployable Space/Land/Atmo/UW = 4 → perfect +1 → 3
        self.assertEqual(scored["breakdown"]["terrain"], 3)

    def test_terrain_missing_land_penalty(self):
        feats = _minimal_features(
            MOV=5,
            weapon_range=5,
            terrain={"Space": 3, "Atmospheric": 3, "Ground": 1, "Sea": 1, "Underwater": 1},
        )
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["terrain"], -3)
        pts, meta = terrain_coverage_points(self.rules, feats["terrain"])
        self.assertEqual(pts, -3)
        self.assertFalse(meta["has_land"])

    def test_rarity_adjustment_n_vs_ssr(self):
        n = score_features(_minimal_features(rarity_id="1"), self.rules)
        ssr = score_features(_minimal_features(rarity_id="4"), self.rules)
        self.assertEqual(n["breakdown"]["rarity"], -5)
        self.assertEqual(ssr["breakdown"]["rarity"], 0)
        self.assertEqual(ssr["total"] - n["total"], 5)

    def test_map_ammo_and_coverage_cap(self):
        # Presence +1; coverage <6 → 0; total 1
        feats = _minimal_features(has_map_weapon=True, map_ammo=1, map_coverage_cells=5)
        self.assertEqual(score_features(feats, self.rules)["breakdown"]["map"], 1)
        # Presence + dash + ammo2+ + coverage3 = 6 → cap 4
        feats2 = _minimal_features(
            has_map_weapon=True,
            has_dash_map=True,
            map_ammo=3,
            map_coverage_cells=50,
        )
        self.assertEqual(score_features(feats2, self.rules)["breakdown"]["map"], 4)
        self.assertEqual(map_coverage_points(self.rules, 20), 2)

    def test_map_presence_and_dash(self):
        none = score_features(_minimal_features(has_map_weapon=False, map_ammo=0), self.rules)
        any_map = score_features(
            _minimal_features(has_map_weapon=True, map_ammo=1, map_coverage_cells=0),
            self.rules,
        )
        dash = score_features(
            _minimal_features(
                has_map_weapon=True,
                has_dash_map=True,
                map_ammo=1,
                map_coverage_cells=0,
            ),
            self.rules,
        )
        self.assertEqual(none["breakdown"]["map"], 0)
        self.assertEqual(any_map["breakdown"]["map"], 1)
        self.assertEqual(dash["breakdown"]["map"], 2)
        self.assertEqual(dash["total"] - any_map["total"], 1)

    def test_shield_strictly_better(self):
        a = score_features(_minimal_features(has_shield=False), self.rules)
        b = score_features(_minimal_features(has_shield=True), self.rules)
        self.assertEqual(b["total"] - a["total"], 1)
        self.assertEqual(b["breakdown"]["shield"], 1)
        self.assertEqual(a["breakdown"]["shield"], 0)

    def test_shield_defender_missing(self):
        feats = _minimal_features(role="Defense", has_shield=False)
        self.assertEqual(score_features(feats, self.rules)["breakdown"]["shield"], -2)

    def test_gn_field_excluded_from_abilities(self):
        pts, meta = score_abilities(
            self.rules,
            "Attack",
            ["GN Field\nReduces beam damage"],
        )
        self.assertEqual(pts, 0)
        self.assertEqual(meta["count"], 0)

    def test_pure_stat_passive_ignored(self):
        pts, meta = score_abilities(
            self.rules,
            "Attack",
            ["Increased Attack\nIncrease Attack by 10%."],
        )
        self.assertEqual(pts, 0)

    def test_weapon_bonus_typed(self):
        tid, pts = detect_weapon_bonus_type(
            self.rules,
            ["Increases critical rate when HP is high"],
        )
        self.assertIn(tid, (1, 2))
        self.assertGreaterEqual(pts, 1)
        tid_low, pts_low = detect_weapon_bonus_type(
            self.rules,
            ["Deals more damage when HP is low"],
        )
        self.assertEqual(tid_low, 3)
        self.assertEqual(pts_low, 0)
        tid_hp, pts_hp = detect_weapon_bonus_type(
            self.rules,
            ["The higher your remaining HP is, the greater Weapon Power increases (up to 25%)."],
        )
        self.assertEqual(tid_hp, 2)
        self.assertEqual(pts_hp, 1)

    def test_extra_life_structured_not_heuristic(self):
        feats = _minimal_features(has_extra_life=True, extra_life_source="structured")
        scored = score_features(feats, self.rules)
        self.assertGreater(scored["breakdown"]["extra_life"], 0)
        self.assertNotIn("extra_life", scored["meta"].get("heuristic_keys") or [])
        self.assertTrue((scored["meta"].get("extra_life") or {}).get("structured"))

    def test_transform_requires_advantage(self):
        cosmetic = _minimal_features(has_transform=True, transform_gains=[], has_transform_advantage=False)
        useful = _minimal_features(
            has_transform=True,
            has_transform_advantage=True,
            transform_gains=["terrain"],
        )
        multi = _minimal_features(
            has_transform=True,
            transform_gains=["terrain", "movement", "map"],
        )
        self.assertEqual(score_features(cosmetic, self.rules)["breakdown"]["transform"], 0)
        self.assertEqual(score_features(useful, self.rules)["breakdown"]["transform"], 1)
        # base +1 and +1 for two extra gain types, capped at 2
        self.assertEqual(score_features(multi, self.rules)["breakdown"]["transform"], 2)

    def test_affinity_pilot_pool_bands(self):
        zero = _minimal_features(affinity_pilot_count=0)
        few = _minimal_features(affinity_pilot_count=2)
        mid = _minimal_features(affinity_pilot_count=4)
        deep = _minimal_features(affinity_pilot_count=8)
        self.assertEqual(score_features(zero, self.rules)["breakdown"]["linked_pilot"], -1)
        self.assertEqual(score_features(few, self.rules)["breakdown"]["linked_pilot"], 0)
        self.assertEqual(score_features(mid, self.rules)["breakdown"]["linked_pilot"], 1)
        self.assertEqual(score_features(deep, self.rules)["breakdown"]["linked_pilot"], 2)
        self.assertEqual(
            (score_features(deep, self.rules)["meta"].get("linked_pilot") or {}).get("count"),
            8,
        )

    def test_linked_pilot_legacy_when_no_affinity_cfg(self):
        rules = copy.deepcopy(self.rules)
        rules.pop("affinity_pilots", None)
        feats = _minimal_features(has_linked_pilot=True, linked_pilot_very_good=True)
        feats.pop("affinity_pilot_count", None)
        scored = score_features(feats, rules)
        self.assertEqual(scored["breakdown"]["linked_pilot"], 1)

    def test_weapon_bonus_structured_flag(self):
        feats = _minimal_features(
            weapon_bonus_type=1,
            weapon_bonus_points=2,
            weapon_bonus_structured=True,
        )
        scored = score_features(feats, self.rules)
        self.assertEqual(scored["breakdown"]["weapon_bonus"], 2)
        self.assertTrue((scored["meta"].get("weapon_bonus") or {}).get("structured"))
        self.assertNotIn("weapon_bonus", scored["meta"].get("heuristic_keys") or [])

    def test_higher_range_bonus_ignored_when_short_range(self):
        short = _minimal_features(
            weapon_range=2,
            weapon_bonus_type=4,
            weapon_bonus_points=2,
        )
        self.assertEqual(score_features(short, self.rules)["breakdown"]["weapon_bonus"], 0)
        long = _minimal_features(
            weapon_range=5,
            weapon_bonus_type=4,
            weapon_bonus_points=2,
        )
        self.assertEqual(score_features(long, self.rules)["breakdown"]["weapon_bonus"], 2)

    def test_weapon_bonus_in_score(self):
        base = _minimal_features(weapon_bonus_type=0, weapon_bonus_points=0)
        with_bonus = _minimal_features(weapon_bonus_type=1, weapon_bonus_points=2)
        self.assertEqual(
            score_features(with_bonus, self.rules)["breakdown"]["weapon_bonus"]
            - score_features(base, self.rules)["breakdown"]["weapon_bonus"],
            2,
        )

    def test_pilot_tag_points_zeroed(self):
        self.assertEqual(pilot_tag_count_points(self.rules, 1), 0)
        self.assertEqual(pilot_tag_count_points(self.rules, 10), 0)

    def test_pilot_hard_er_tag_bonus(self):
        feats = {
            "role": "Attack",
            "tag_count": 4,
            "tags": ["Alternative Series", "Protagonist", "Hard ER", "Mono-Eye Pilot"],
            "ability_effects": [],
            "skill_effects": [
                {"trait_type_index": 9, "trait_value": 15},
                {"trait_type_index": 6, "trait_value": 100},
            ],
            "series_affinity_count": 1,
            "best_rec_ms_letter": "S",
            "rec_ms_bplus_or_better_count": 2,
            "Ranged": 800,
            "Melee": 720,
            "Awaken": 660,
            "Defense": 530,
            "Reaction": 620,
        }
        scored = score_pilot_features(feats, self.rules)
        self.assertEqual(scored["breakdown"]["tags"], 1)  # Hard ER only
        self.assertEqual(scored["breakdown"]["series_affinity"], 3)
        self.assertEqual(scored["breakdown"]["recommend_ms"], 6)  # S=5 + multi bonus
        self.assertEqual(scored["breakdown"]["ranged"], 6)
        self.assertEqual(scored["specialty"], "Ranged")
        self.assertGreaterEqual(scored["breakdown"]["skills_abilities"], 3)
        self.assertFalse((scored["meta"].get("kit") or {}).get("heuristic"))
        self.assertTrue(any(x.get("kind") == "stat" and x.get("key") == "Ranged" for x in scored["detail_lines"]))

    def test_strong_attacker_golden_total(self):
        """Hand-built strong attacker against v5 bands."""
        feats = {
            "role": "Attack",
            "rarity_id": "4",
            "tag_count_scored": 5,
            "tags": ["One-Shot Killer", "Land", "Aerial Use", "Tough as Nails"],
            "tag_strategic_table": {
                "one-shot killer": {"ur_weight": 12.0, "er_mentions": 1, "effective_weight": 13.8},
                "land": {"ur_weight": 10.0, "er_mentions": 0, "effective_weight": 10.0},
                "aerial use": {"ur_weight": 6.0, "er_mentions": 0, "effective_weight": 6.0},
                "tough as nails": {"ur_weight": 4.0, "er_mentions": 0, "effective_weight": 4.0},
            },
            "er_expert_eligible_count": 20,
            "terrain": {"Space": 3, "Atmospheric": 3, "Ground": 2, "Sea": 1, "Underwater": 1},
            "has_transform": True,
            "has_transform_advantage": True,
            "transform_gains": ["terrain", "weapon_range"],
            "map_ammo": 2,
            "map_coverage_cells": 22,
            "has_map_weapon": True,
            "has_dash_map": False,
            "ability_effects": [
                {
                    "trait_type_index": 17,
                    "trait_type_key": "DamageGivenCorrectionRate",
                    "trait_value": 15,
                    "has_active_cond": True,
                }
            ],
            "has_linked_pilot": True,
            "linked_pilot_very_good": True,
            "affinity_pilot_count": 4,
            "has_shield": True,
            "HP": 96000,
            "ATK": 12500,
            "DEF": 9200,
            "MOB": 10100,
            "MOV": 6,
            "weapon_range": 6,
            "weapon_power": 6100,
            "weapon_bonus_type": 1,
            "weapon_bonus_points": 2,
            "has_max_tension_higher_weapon": False,
            "has_preemptive": True,
            "has_rare_debuff": False,
            "has_extra_life": False,
            "has_after_move_map": False,
            "has_extra_move_kit": False,
            "max_debuff_pct": 0,
            "support_debuffs_range4_count": 0,
        }
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["tags"], 0)
        self.assertEqual(scored["breakdown"]["tags_weight"], 0)
        self.assertEqual(scored["breakdown"]["tags_strategic"], 2)  # weight ~33.8 → capped +2
        self.assertEqual(scored["breakdown"]["er_access"], 2)
        self.assertEqual(scored["breakdown"]["terrain"], 1)  # Atmo only (2 deployable extras? Space Land Atmo = 3, not perfect)
        self.assertEqual(scored["breakdown"]["map"], 4)  # presence + ammo2+ + cov2
        self.assertEqual(scored["breakdown"]["weapon_power"], 3)
        self.assertEqual(scored["breakdown"]["weapon_bonus"], 2)
        self.assertEqual(scored["breakdown"]["abilities"], 2)  # dmg given 15% magnitude band
        self.assertFalse(scored["meta"].get("abilities", {}).get("heuristic"))
        self.assertNotIn("abilities", scored["meta"].get("heuristic_keys") or [])
        self.assertEqual(scored["letter"], "S+")
        self.assertEqual(scored["bucket"], "recommended")
        self.assertEqual(bucket_for_letter(self.rules, "A"), "solid")
        self.assertEqual(bucket_for_letter(self.rules, "C"), "niche")

    def test_structured_permanent_atk_scores_zero(self):
        pts, meta = score_ability_effects(
            self.rules,
            "Attack",
            [
                {
                    "trait_type_index": 7,
                    "trait_value": 20,
                    "has_active_cond": False,
                    "trait_type_key": "AttackChangeRate",
                }
            ],
        )
        self.assertEqual(pts, 0)
        self.assertFalse(meta.get("heuristic"))

    def test_structured_conditional_dmg_scores(self):
        pts, _meta = score_ability_effects(
            self.rules,
            "Attack",
            [
                {
                    "trait_type_index": 17,
                    "trait_value": 15,
                    "has_active_cond": True,
                }
            ],
        )
        self.assertEqual(pts, 2)  # magnitude band 10–19 → 2

    def test_structured_dmg_high_magnitude(self):
        pts, _meta = score_ability_effects(
            self.rules,
            "Attack",
            [
                {
                    "trait_type_index": 17,
                    "trait_value": 25,
                    "has_active_cond": True,
                }
            ],
        )
        self.assertEqual(pts, 3)

    def test_classify_range_down_beam(self):
        from sp_investment_rank import classify_debuff_keys_from_meta

        keys = classify_debuff_keys_from_meta(
            {
                "type_index": 12,
                "status_type_index": 72,
                "status_value": -2,
                "twc_id": "5",
                "weapon_attrs": [2],
                "magnitude": 2,
                "timing": 3,
                "limit": 1,
            }
        )
        self.assertEqual(keys, {"range_beam"})

    def test_pilot_kit_structured_cap(self):
        ability_effects = [
            {"trait_type_index": 17, "trait_value": 20, "has_active_cond": True},
            {"trait_type_index": 94, "trait_value": 1, "has_active_cond": True},
            {"trait_type_index": 49, "trait_value": 1, "has_active_cond": True},
        ]
        skill_effects = [
            {"trait_type_index": 8, "trait_value": 30},
            {"trait_type_index": 13, "trait_value": 1},
            {"trait_type_index": 9, "trait_value": 20},
        ]
        pts, meta = score_pilot_kit_structured(
            self.rules, "Attack", "Ranged", ability_effects, skill_effects
        )
        self.assertLessEqual(pts, int(self.rules.get("pilot_kit_cap", 14)))
        self.assertTrue(meta.get("structured"))
        self.assertFalse(meta.get("heuristic"))

    def test_scoring_guide_has_no_en_cost(self):
        guide = self.rules.get("scoring_guide") or {}
        blob = " ".join(guide.get("overrides") or []) + " ".join(guide.get("gaps") or [])
        self.assertNotIn("EN cost", blob)

    def test_public_criteria_from_live_rules(self):
        from sp_investment_rank import build_public_criteria, scoring_guide_payload

        crit = build_public_criteria(self.rules)
        ids = [c["id"] for c in crit]
        self.assertIn("er_access", ids)
        self.assertIn("weapon_power_sp_attack", ids)
        self.assertIn("role_focus_attack", ids)
        self.assertIn("map", ids)
        self.assertNotIn("not_scored", ids)
        er = next(c for c in crit if c["id"] == "er_access")
        self.assertTrue(er["objective"])
        self.assertGreaterEqual(len(er["rows"]), 4)
        self.assertEqual(er.get("roles"), ["Attack", "Defense", "Support"])
        atk_focus = next(c for c in crit if c["id"] == "role_focus_attack")
        self.assertEqual(atk_focus.get("roles"), ["Attack"])
        debuffs = next(c for c in crit if c["id"] == "debuffs")
        self.assertEqual(debuffs.get("roles"), ["Defense", "Support"])
        guide = scoring_guide_payload(self.rules)
        self.assertEqual(len(guide.get("criteria") or []), len(crit))
        map_c = next(c for c in crit if c["id"] == "map")
        blob = " ".join(f"{r['when']} {r['result']}" for r in map_c["rows"])
        self.assertIn("Any MAP weapon", blob)
        self.assertIn("Dash", blob)

    def test_support_weapon_range_floor_at_five(self):
        r4 = score_features(
            _minimal_features(role="Support", weapon_range=4), self.rules
        )
        r5 = score_features(
            _minimal_features(role="Support", weapon_range=5), self.rules
        )
        self.assertEqual(r4["breakdown"]["weapon_range"], -1)
        self.assertEqual(r5["breakdown"]["weapon_range"], 0)
        self.assertEqual(
            r5["breakdown"]["weapon_range"] - r4["breakdown"]["weapon_range"], 1
        )

    def test_defense_missing_atmospheric_tax(self):
        terrain = {
            "Space": 2,
            "Atmospheric": 1,
            "Ground": 2,
            "Sea": 1,
            "Underwater": 1,
        }
        atk = score_features(
            _minimal_features(role="Attack", terrain=terrain), self.rules
        )
        defense = score_features(
            _minimal_features(role="Defense", terrain=terrain), self.rules
        )
        support = score_features(
            _minimal_features(role="Support", terrain=terrain), self.rules
        )
        self.assertEqual(atk["breakdown"]["terrain"], 0)
        self.assertEqual(support["breakdown"]["terrain"], 0)
        self.assertEqual(defense["breakdown"]["terrain"], -2)
        pts, meta = terrain_coverage_points(self.rules, terrain, role="Defense")
        self.assertEqual(pts, -2)
        self.assertTrue(meta.get("defense_missing_atmospheric"))

    def test_support_debuff_kinds_require_range5(self):
        # R4-only kinds help Defense, not Support
        defense = score_features(
            _minimal_features(
                role="Defense",
                support_debuffs_range4_count=2,
                support_debuffs_range5_count=0,
            ),
            self.rules,
        )
        support = score_features(
            _minimal_features(
                role="Support",
                support_debuffs_range4_count=2,
                support_debuffs_range5_count=0,
            ),
            self.rules,
        )
        self.assertEqual(defense["breakdown"]["support_r4_debuffs"], 1)
        self.assertEqual(support["breakdown"]["support_r4_debuffs"], -1)

    def test_map_cap_lower_for_support_defense(self):
        feats = _minimal_features(
            has_map_weapon=True,
            has_dash_map=True,
            map_ammo=2,
            map_coverage_cells=40,
        )
        atk = score_features({**feats, "role": "Attack"}, self.rules)
        defense = score_features({**feats, "role": "Defense"}, self.rules)
        support = score_features({**feats, "role": "Support"}, self.rules)
        self.assertEqual(atk["breakdown"]["map"], 4)
        self.assertEqual(defense["breakdown"]["map"], 2)
        self.assertEqual(support["breakdown"]["map"], 2)

    def test_lasting_def_down_feeds_max_debuff(self):
        from sp_investment_rank import classify_debuff_keys_from_meta

        keys = classify_debuff_keys_from_meta(
            {
                "type_index": 12,
                "status_type_index": 9,
                "status_value": -25,
                "magnitude": 25,
                "timing": 1,
                "limit": 1,
                "weapon_attrs": [],
            }
        )
        self.assertIn("def_dn", keys)
        # score_features uses max_debuff_pct bands — 25% → level 4 → Defense 0 / Support -1
        defense = score_features(
            _minimal_features(role="Defense", max_debuff_pct=25), self.rules
        )
        support = score_features(
            _minimal_features(role="Support", max_debuff_pct=25), self.rules
        )
        self.assertEqual(defense["breakdown"]["max_debuff"], 0)
        self.assertEqual(support["breakdown"]["max_debuff"], -1)
        support_strong = score_features(
            _minimal_features(role="Support", max_debuff_pct=40), self.rules
        )
        self.assertEqual(support_strong["breakdown"]["max_debuff"], 2)

    def test_low_hp_attacker_penalty(self):
        scored = score_features(_minimal_features(HP=79000), self.rules)
        self.assertEqual(scored["breakdown"]["hp"], -3)

    def test_movement_followup_after_move_map(self):
        a = score_features(_minimal_features(has_after_move_map=True), self.rules)
        self.assertEqual(a["breakdown"]["movement_followup"], 1)

    def test_movement_followup_stacks(self):
        both = score_features(
            _minimal_features(has_after_move_map=True, has_extra_move_kit=True),
            self.rules,
        )
        self.assertEqual(both["breakdown"]["movement_followup"], 2)

    def test_large_footprint_bonus(self):
        a = score_features(_minimal_features(is_large_footprint=True), self.rules)
        self.assertEqual(a["breakdown"]["large_footprint"], 1)
        d = score_features(
            _minimal_features(role="Defense", is_large_footprint=True), self.rules
        )
        self.assertEqual(d["breakdown"]["large_footprint"], 1)
        s = score_features(
            _minimal_features(role="Support", is_large_footprint=True), self.rules
        )
        self.assertEqual(s["breakdown"]["large_footprint"], 1)

    def test_debuff_axes_defense_support_only(self):
        atk = score_features(
            _minimal_features(
                role="Attack",
                max_debuff_pct=0,
                support_debuffs_range4_count=0,
                support_debuffs_range5_count=0,
            ),
            self.rules,
        )
        self.assertNotIn("support_r4_debuffs", atk["breakdown"])
        self.assertNotIn("max_debuff", atk["breakdown"])

        defense_none = score_features(
            _minimal_features(
                role="Defense",
                max_debuff_pct=0,
                support_debuffs_range4_count=0,
                support_debuffs_range5_count=0,
            ),
            self.rules,
        )
        # Defense: light debuff-kind axis (0 kinds → 0, not −1)
        self.assertEqual(defense_none["breakdown"]["support_r4_debuffs"], 0)
        self.assertEqual(defense_none["breakdown"]["max_debuff"], -2)

        support_good = score_features(
            _minimal_features(
                role="Support",
                max_debuff_pct=40,
                support_debuffs_range4_count=2,
                support_debuffs_range5_count=2,
            ),
            self.rules,
        )
        self.assertEqual(support_good["breakdown"]["support_r4_debuffs"], 1)
        self.assertEqual(support_good["breakdown"]["max_debuff"], 2)

    def test_pilot_er_and_rarity(self):
        feats = {
            "role": "Attack",
            "rarity_id": "1",
            "tag_count": 0,
            "tags": ["Hard ER"],
            "tag_strategic_table": {},
            "er_expert_eligible_count": 20,
            "kit_items": [],
            "series_affinity_count": 0,
            "best_rec_ms_letter": "",
            "rec_ms_bplus_or_better_count": 0,
            "Ranged": 700,
            "Melee": 700,
            "Awaken": 600,
            "Defense": 500,
            "Reaction": 550,
        }
        scored = score_pilot_features(feats, self.rules)
        self.assertEqual(scored["breakdown"]["er_access"], 2)
        self.assertEqual(scored["breakdown"]["rarity"], -5)
        self.assertEqual(scored["breakdown"]["tags"], 1)  # Hard ER curated
        self.assertEqual(scored["bucket"], bucket_for_letter(self.rules, scored["letter"]))


def _minimal_features(**overrides):
    base = {
        "role": "Attack",
        "rarity_id": "4",
        "tag_count": 0,
        "tag_count_scored": 0,
        "tags": [],
        "tag_strategic_table": {},
        "er_expert_eligible_count": 10,
        "terrain": {"Space": 1, "Atmospheric": 1, "Ground": 1, "Sea": 1, "Underwater": 1},
        "has_transform": False,
        "map_ammo": 0,
        "map_coverage_cells": 0,
        "has_map_weapon": False,
        "has_dash_map": False,
        "ability_blobs": [],
        "has_linked_pilot": False,
        "linked_pilot_very_good": False,
        "affinity_pilot_count": 4,
        "has_shield": True,
        "is_large_footprint": False,
        "HP": 88000,
        "ATK": 11800,
        "DEF": 8200,
        "MOB": 9300,
        "MOV": 4,
        "weapon_range": 4,
        "weapon_power": 5200,
        "weapon_bonus_type": 0,
        "weapon_bonus_points": 0,
        "has_max_tension_higher_weapon": False,
        "has_preemptive": False,
        "has_rare_debuff": False,
        "has_extra_life": False,
        "has_after_move_map": False,
        "has_extra_move_kit": False,
        "max_debuff_pct": 0,
        "support_debuffs_range4_count": 0,
        "support_debuffs_range5_count": 0,
    }
    base.update(overrides)
    return base


if __name__ == "__main__":
    unittest.main()
