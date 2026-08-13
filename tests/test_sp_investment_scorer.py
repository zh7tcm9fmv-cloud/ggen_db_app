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
    letter_meets_min,
    letter_pts_allowed,
    load_rules,
    map_coverage_points,
    pilot_tag_count_points,
    recommend_ms_min_letter,
    score_abilities,
    score_ability_effects,
    score_features,
    score_pilot_features,
    score_pilot_kit_structured,
    strategic_tag_points,
    tag_count_points,
    terrain_coverage_points,
    weapon_power_bands_for_mode,
    _weapon_is_ssp_custom_core_id,
)


class TestSpInvestmentBands(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        clear_rules_cache()
        cls.rules = load_rules()

    def test_rules_version_5(self):
        self.assertEqual(self.rules.get("version"), 5)
        self.assertEqual(self.rules["bucket_labels"]["priority"], "BEYOND THE TIME")
        self.assertEqual(self.rules["bucket_labels"]["recommended"], "Recommended")
        self.assertEqual(self.rules["bucket_labels"]["niche"], "Niche")

    def test_pilot_beyond_the_time_cutoff_23(self):
        from sp_investment_rank import letter_for_total

        s_plus = next(
            r for r in self.rules["pilot_letter_cutoffs"] if r["letter"] == "S+"
        )
        self.assertEqual(s_plus["min"], 23)
        self.assertEqual(
            letter_for_total(self.rules, 22, cutoffs_key="pilot_letter_cutoffs"), "S"
        )
        self.assertEqual(
            letter_for_total(self.rules, 23, cutoffs_key="pilot_letter_cutoffs"), "S+"
        )
        unit_s_plus = next(
            r for r in self.rules["letter_cutoffs"] if r["letter"] == "S+"
        )
        self.assertEqual(unit_s_plus["min"], 17)

    def test_pilot_letter_cutoffs_by_role(self):
        from sp_investment_rank import letter_for_total

        by = self.rules.get("pilot_letter_cutoffs_by_role") or {}
        self.assertIn("Attack", by)
        self.assertIn("Defense", by)
        self.assertIn("Support", by)
        # Shared fallback still Attack-scale
        self.assertEqual(
            letter_for_total(self.rules, 20, cutoffs_key="pilot_letter_cutoffs"), "S"
        )
        self.assertEqual(
            letter_for_total(
                self.rules, 20, cutoffs_key="pilot_letter_cutoffs", role="Attack"
            ),
            "S",
        )
        self.assertEqual(
            letter_for_total(
                self.rules, 20, cutoffs_key="pilot_letter_cutoffs", role="Defense"
            ),
            "A+",
        )
        self.assertEqual(
            letter_for_total(
                self.rules, 23, cutoffs_key="pilot_letter_cutoffs", role="Defense"
            ),
            "S",
        )
        self.assertEqual(
            letter_for_total(
                self.rules, 22, cutoffs_key="pilot_letter_cutoffs", role="Support"
            ),
            "S",
        )
        self.assertEqual(
            letter_for_total(
                self.rules, 21, cutoffs_key="pilot_letter_cutoffs", role="Support"
            ),
            "A+",
        )

    def test_defense_pilot_attack_stats_upside_only(self):
        for stat in ("Ranged", "Melee", "Awaken"):
            bands = self.rules["pilot_stat_bands"][stat]["Defense"]
            tip = int((bands or [{}])[-1].get("points") or 0)
            self.assertLessEqual(tip, 1, f"{stat}/Defense tip {tip} exceeds +1")
            self.assertEqual(band_points(bands, 599), 0)
            self.assertEqual(band_points(bands, 800), 1)

    def test_defense_unit_hp_def_floors_soft(self):
        hp = self.rules["stat_bands"]["HP"]["Defense"]
        self.assertEqual(band_points(hp, 100000), -1)
        self.assertEqual(band_points(hp, 105000), 0)
        self.assertEqual(band_points(hp, 110000), 1)
        self.assertEqual(band_points(hp, 120000), 2)
        de = self.rules["stat_bands"]["DEF"]["Defense"]
        self.assertEqual(band_points(de, 9000), -1)
        self.assertEqual(band_points(de, 9500), 0)
        self.assertEqual(band_points(de, 10500), 1)
        self.assertEqual(band_points(de, 11100), 2)
        self.assertEqual(band_points(de, 12000), 3)
        bands = self.rules["pilot_stat_bands"]["Defense"]["Defense"]
        tip = bands[-1]["points"]
        self.assertLessEqual(tip, 3)
        self.assertEqual(band_points(bands, 950), 3)

    def test_defense_unit_splus_cutoff_is_18(self):
        from sp_investment_rank import letter_for_total, letter_for_unit_total

        self.assertEqual(
            letter_for_total(self.rules, 17, cutoffs_key="letter_cutoffs", role="Attack"),
            "S+",
        )
        self.assertEqual(
            letter_for_total(self.rules, 17, cutoffs_key="letter_cutoffs", role="Defense"),
            "S",
        )
        self.assertEqual(
            letter_for_total(self.rules, 18, cutoffs_key="letter_cutoffs", role="Defense"),
            "S+",
        )
        paper = {"hp": -1, "shield": 1, "special_defense": 0, "extra_life": 0, "preemptive": 1, "movement": 2, "max_debuff": 1}
        self.assertEqual(
            letter_for_unit_total(
                self.rules, 19, role="Defense", has_sp=True, breakdown=paper
            ),
            "S",
        )
        # Fat kit without lasting ATK Down stays Recommended (Support-symmetric).
        no_atk_down = {
            "hp": 2,
            "shield": 1,
            "special_defense": 1,
            "extra_life": 0,
            "preemptive": 0,
            "movement": 2,
            "max_debuff": 0,
        }
        self.assertEqual(
            letter_for_unit_total(
                self.rules, 18, role="Defense", has_sp=True, breakdown=no_atk_down
            ),
            "S",
        )
        tank = {
            "hp": 2,
            "shield": 1,
            "special_defense": 1,
            "extra_life": 0,
            "preemptive": 0,
            "movement": 2,
            "max_debuff": 1,
        }
        self.assertEqual(
            letter_for_unit_total(
                self.rules, 18, role="Defense", has_sp=True, breakdown=tank
            ),
            "S+",
        )
        no_edge = {
            "hp": 2,
            "shield": 1,
            "special_defense": 1,
            "extra_life": 0,
            "preemptive": 0,
            "movement": 0,
            "max_debuff": 1,
        }
        self.assertEqual(
            letter_for_unit_total(
                self.rules, 19, role="Defense", has_sp=True, breakdown=no_edge
            ),
            "S",
        )
        first_strike = {
            "hp": 1,
            "shield": 1,
            "special_defense": 0,
            "extra_life": 0,
            "preemptive": 1,
            "movement": 0,
            "max_debuff": 1,
        }
        self.assertEqual(
            letter_for_unit_total(
                self.rules, 18, role="Defense", has_sp=True, breakdown=first_strike
            ),
            "S+",
        )
        # ATK Down alone is not enough — still need HP/shield tankiness.
        atk_down_only = {
            "hp": 0,
            "shield": 0,
            "special_defense": 0,
            "extra_life": 0,
            "preemptive": 0,
            "movement": 2,
            "max_debuff": 1,
        }
        self.assertEqual(
            letter_for_unit_total(
                self.rules, 18, role="Defense", has_sp=True, breakdown=atk_down_only
            ),
            "S",
        )

    def test_support_unit_splus_needs_def_down(self):
        from sp_investment_rank import letter_for_unit_total

        map_only = {"max_debuff": 0, "map": 2, "support_r4_debuffs": 1}
        self.assertEqual(
            letter_for_unit_total(
                self.rules, 18, role="Support", has_sp=True, breakdown=map_only
            ),
            "S",
        )
        with_def_down = {"max_debuff": 1, "map": 2, "support_r4_debuffs": 1}
        self.assertEqual(
            letter_for_unit_total(
                self.rules, 17, role="Support", has_sp=True, breakdown=with_def_down
            ),
            "S+",
        )

    def test_specialty_tip_capped_at_5(self):
        for stat in ("Ranged", "Melee", "Awaken"):
            for role, bands in (self.rules["pilot_stat_bands"].get(stat) or {}).items():
                tip = int((bands or [{}])[-1].get("points") or 0)
                self.assertLessEqual(
                    tip, 5, f"{stat}/{role} specialty tip {tip} exceeds +5"
                )

    def test_er_series_restriction_name_lookup(self):
        from sp_investment_rank import _lookup_series_display_name, _restriction_label

        snm = {
            "0010": "Mobile Suit Gundam",
            "0800": "Mobile Suit Z Gundam",
            "0950": "Mobile Suit Gundam ZZ",
        }
        self.assertEqual(_lookup_series_display_name(snm, "10"), "Mobile Suit Gundam")
        self.assertEqual(_lookup_series_display_name(snm, "800"), "Mobile Suit Z Gundam")
        self.assertEqual(_lookup_series_display_name(snm, "950"), "Mobile Suit Gundam ZZ")

        class A:
            LANG_DATA = {"EN": {"series_name_map": snm, "lineage_lookup": {}}}

            @staticmethod
            def normalize_id(x, default="0"):
                s = str(x if x is not None else default).strip()
                if not s:
                    return default
                if s.isdigit():
                    return str(int(s))
                return s

        lab = _restriction_label(A, "1", "10", "EN")
        self.assertEqual(lab["name"], "Mobile Suit Gundam")
        self.assertNotEqual(lab["name"], "10")

    def test_pilot_letter_hybrid_top_pct(self):
        from sp_investment_rank import calibrate_pilot_letters_hybrid

        # 100 Attack rows: top 3% → 3 S+, top 8% → 8 S-or-better
        rows = []
        for i in range(100):
            rows.append(
                {
                    "id": f"a{i}",
                    "name": f"Attack {i:03d}",
                    "role": "Attack",
                    "total": 100 - i,  # 100 .. 1
                    "has_sp": True,
                }
            )
        # Force absolute floor to A+ via high totals + Attack cutoffs (S at 20)
        calibrate_pilot_letters_hybrid(
            rows, self.rules, cutoffs_key="pilot_letter_cutoffs"
        )
        letters = [r["letter"] for r in rows]
        self.assertEqual(letters.count("S+"), 3)
        self.assertEqual(letters.count("S"), 5)  # 8 - 3
        self.assertEqual(rows[0]["letter"], "S+")
        self.assertEqual(rows[2]["letter"], "S+")
        self.assertEqual(rows[3]["letter"], "S")
        self.assertEqual(rows[7]["letter"], "S")
        self.assertEqual(rows[8]["letter"], "A+")  # outside window, demoted/capped
        hy = self.rules.get("pilot_letter_hybrid") or {}
        self.assertTrue(hy.get("enabled"))
        self.assertAlmostEqual(float(hy.get("s_plus_top_pct") or 0), 0.03)
        self.assertAlmostEqual(float(hy.get("s_top_pct") or 0), 0.08)

    def test_defense_pilot_splus_needs_def_or_reaction(self):
        from sp_investment_rank import calibrate_pilot_letters_hybrid

        rows = []
        for i in range(100):
            # Kit-only Durability (#0) has no DEF/Reaction band; everyone else does
            # so skipped S+ slots refill from the next eligible pilots.
            if i == 0:
                bd = {"defense": 0, "reaction": 0, "skills_abilities": 11}
            else:
                bd = {"defense": 2, "reaction": 0, "skills_abilities": 8}
            rows.append(
                {
                    "id": f"d{i}",
                    "name": f"Defense {i:03d}",
                    "role": "Defense",
                    "total": 100 - i,
                    "has_sp": True,
                    "breakdown": bd,
                }
            )
        calibrate_pilot_letters_hybrid(
            rows, self.rules, cutoffs_key="pilot_letter_cutoffs"
        )
        self.assertEqual(rows[0]["letter"], "S")
        self.assertEqual(rows[1]["letter"], "S+")
        self.assertEqual(sum(1 for r in rows if r["letter"] == "S+"), 3)

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
        # v5.29: OSK has ER mentions → skipped; Land-only weight 8 → band +1
        self.assertEqual(pts, 1)
        self.assertEqual(meta["weight"], 8.0)
        self.assertEqual(len(meta.get("skipped_er_tags") or []), 1)

    def test_strategic_tag_excludes_er_mentioned(self):
        table = {
            "one-shot killer": {"ur_weight": 20.0, "er_mentions": 3, "effective_weight": 20.0},
        }
        pts, meta = strategic_tag_points(self.rules, ["One-Shot Killer"], table)
        self.assertEqual(pts, 0)
        self.assertEqual(meta["weight"], 0.0)
        self.assertEqual(meta["skipped_er_tags"][0]["name"], "One-Shot Killer")

    def test_er_access_bands(self):
        self.assertEqual(er_access_points(self.rules, 0), 0)
        self.assertEqual(er_access_points(self.rules, 1), 0)
        self.assertEqual(er_access_points(self.rules, 2), 1)
        self.assertEqual(er_access_points(self.rules, 4), 1)
        self.assertEqual(er_access_points(self.rules, 5), 1)
        self.assertEqual(er_access_points(self.rules, 6), 1)
        self.assertEqual(er_access_points(self.rules, 7), 2)
        self.assertEqual(er_access_points(self.rules, 20), 2)

    def test_atk_attacker_bands_sheet(self):
        bands = self.rules["stat_bands"]["ATK"]["Attack"]
        self.assertEqual(band_points(bands, 11199), -2)
        self.assertEqual(band_points(bands, 11200), -1)
        self.assertEqual(band_points(bands, 11599), -1)
        self.assertEqual(band_points(bands, 11600), 1)
        self.assertEqual(band_points(bands, 11919), 1)
        self.assertEqual(band_points(bands, 12000), 2)
        self.assertEqual(band_points(bands, 12400), 3)
        self.assertEqual(band_points(bands, 12800), 3)

    def test_atk_defense_upside_only(self):
        bands = self.rules["stat_bands"]["ATK"]["Defense"]
        self.assertEqual(band_points(bands, 7500), 0)
        self.assertEqual(band_points(bands, 8999), 0)
        self.assertEqual(band_points(bands, 9000), 1)
        self.assertEqual(band_points(bands, 10000), 2)

    def test_atk_support_no_floor_penalty(self):
        bands = self.rules["stat_bands"]["ATK"]["Support"]
        self.assertEqual(band_points(bands, 8000), 0)
        self.assertEqual(band_points(bands, 10500), 1)

    def test_def_not_scored_for_attack(self):
        bands = self.rules["stat_bands"]["DEF"]["Attack"]
        self.assertEqual(band_points(bands, 5000), 0)
        self.assertEqual(band_points(bands, 8944), 0)
        self.assertEqual(band_points(bands, 12000), 0)

    def test_ssp_custom_core_weapon_ids(self):
        self.assertTrue(_weapon_is_ssp_custom_core_id("121900020080"))
        self.assertTrue(_weapon_is_ssp_custom_core_id("121900020090"))
        self.assertFalse(_weapon_is_ssp_custom_core_id("121900020001"))
        self.assertFalse(_weapon_is_ssp_custom_core_id("115900100004"))

    def test_mob_attacker_soft_ceiling(self):
        bands = self.rules["stat_bands"]["MOB"]["Attack"]
        self.assertEqual(band_points(bands, 10100), 1)
        self.assertEqual(band_points(bands, 9600), 0)

    def test_mob_support_higher_ceiling(self):
        bands = self.rules["stat_bands"]["MOB"]["Support"]
        self.assertEqual(band_points(bands, 10500), 2)

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
        self.assertEqual(scored["breakdown"]["movement"], -2)

    def test_mov6_attacker_plus_one(self):
        scored = score_features(_minimal_features(MOV=6), self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["movement"], 1)

    def test_mov5_is_neutral(self):
        scored = score_features(_minimal_features(MOV=5), self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["movement"], 0)

    def test_range6_attacker_plus_three(self):
        scored = score_features(_minimal_features(weapon_range=6), self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["weapon_range"], 3)

    def test_range2_attacker_harder_penalty(self):
        scored = score_features(_minimal_features(weapon_range=2), self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["weapon_range"], -2)

    def test_range1_attacker_soft_floor(self):
        scored = score_features(_minimal_features(weapon_range=1), self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["weapon_range"], -3)

    def test_terrain_space_land_base_zero(self):
        feats = _minimal_features(
            terrain={"Space": 3, "Atmospheric": 1, "Ground": 3, "Sea": 1, "Underwater": 1}
        )
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["terrain"], 0)

    def test_terrain_triangle_space_penalty(self):
        feats = _minimal_features(
            terrain={"Space": 2, "Atmospheric": 1, "Ground": 3, "Sea": 1, "Underwater": 1}
        )
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["terrain"], -1)

    def test_terrain_perfect_blocked_by_triangle_space(self):
        # Atlas-like: water trifecta + triangle Space — extras ok, perfect withheld
        feats = _minimal_features(
            terrain={"Space": 2, "Atmospheric": 3, "Ground": 3, "Sea": 3, "Underwater": 3}
        )
        scored = score_features(feats, self.rules, mode="sp")
        pts, meta = terrain_coverage_points(self.rules, feats["terrain"])
        self.assertEqual(pts, 2)  # Atmo+UW+Sea extras − Space triangle
        self.assertEqual(scored["breakdown"]["terrain"], 2)
        self.assertIn("Space", meta.get("triangle_keys") or [])
        self.assertTrue(meta.get("perfect_blocked_by_triangle"))
        self.assertFalse(meta.get("perfect"))

    def test_terrain_extra_atmo_and_water(self):
        feats = _minimal_features(
            terrain={"Space": 3, "Atmospheric": 3, "Ground": 3, "Sea": 1, "Underwater": 3}
        )
        scored = score_features(feats, self.rules, mode="sp")
        # Atmo+UW extras = 2; full-affinity Space/Land/Atmo/UW = 4 → perfect +1 → 3
        self.assertEqual(scored["breakdown"]["terrain"], 3)

    def test_terrain_missing_land_ok_with_atmosphere(self):
        # Space + Atmospheric (no Land) — e.g. Byarlant — is a valid floor, not −3
        feats = _minimal_features(
            MOV=5,
            weapon_range=5,
            terrain={"Space": 3, "Atmospheric": 3, "Ground": 1, "Sea": 1, "Underwater": 1},
        )
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["terrain"], 0)
        pts, meta = terrain_coverage_points(self.rules, feats["terrain"])
        self.assertEqual(pts, 0)
        self.assertTrue(meta["has_space"])
        self.assertFalse(meta["has_land"])
        self.assertTrue(meta["has_atmospheric"])
        self.assertTrue(meta.get("atmos_substitutes_land"))

    def test_terrain_missing_space_still_penalty(self):
        feats = _minimal_features(
            terrain={"Space": 1, "Atmospheric": 3, "Ground": 3, "Sea": 1, "Underwater": 1},
        )
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["terrain"], -3)

    def test_rarity_adjustment_disabled(self):
        n = score_features(_minimal_features(rarity_id="1"), self.rules)
        ssr = score_features(_minimal_features(rarity_id="4"), self.rules)
        self.assertEqual(n["breakdown"]["rarity"], 0)
        self.assertEqual(ssr["breakdown"]["rarity"], 0)

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
        self.assertEqual(map_coverage_points(self.rules, 20), 1)
        self.assertEqual(map_coverage_points(self.rules, 14), 0)
        self.assertEqual(map_coverage_points(self.rules, 25), 2)

    def test_map_presence_and_dash(self):
        none = score_features(_minimal_features(has_map_weapon=False, map_ammo=0), self.rules)
        tiny = score_features(
            _minimal_features(has_map_weapon=True, map_ammo=1, map_coverage_cells=1),
            self.rules,
        )
        any_map = score_features(
            _minimal_features(has_map_weapon=True, map_ammo=1, map_coverage_cells=5),
            self.rules,
        )
        dash = score_features(
            _minimal_features(
                has_map_weapon=True,
                has_dash_map=True,
                map_ammo=1,
                map_coverage_cells=5,
            ),
            self.rules,
        )
        self.assertEqual(none["breakdown"]["map"], 0)
        self.assertEqual(tiny["breakdown"]["map"], 0)  # <3 cells: no presence
        self.assertEqual(any_map["breakdown"]["map"], 1)
        self.assertEqual(dash["breakdown"]["map"], 2)

    def test_support_map_separate_from_damage_map(self):
        """Recovery/ally MAP scores map_support_points only — not presence/coverage."""
        support = score_features(
            _minimal_features(
                has_map_weapon=False,
                has_support_map=True,
                map_ammo=0,
                map_coverage_cells=40,
            ),
            self.rules,
        )
        damage = score_features(
            _minimal_features(
                has_map_weapon=True,
                has_support_map=False,
                map_ammo=1,
                map_coverage_cells=40,
            ),
            self.rules,
        )
        self.assertEqual(support["breakdown"]["map"], 1)
        self.assertEqual(support["meta"]["map"]["support_map_points"], 1)
        self.assertEqual(support["meta"]["map"]["presence_points"], 0)
        self.assertEqual(support["meta"]["map"]["coverage_points"], 0)
        # Presence + coverage (+2 at 40 cells) without support
        self.assertGreaterEqual(damage["breakdown"]["map"], 3)
        self.assertEqual(damage["meta"]["map"]["support_map_points"], 0)

    def test_shield_strictly_better(self):
        a = score_features(_minimal_features(has_shield=False), self.rules)
        b = score_features(_minimal_features(has_shield=True), self.rules)
        self.assertEqual(b["total"] - a["total"], 1)
        self.assertEqual(b["breakdown"]["shield"], 1)
        self.assertEqual(a["breakdown"]["shield"], 0)

    def test_shield_defender_missing(self):
        feats = _minimal_features(role="Defense", has_shield=False)
        self.assertEqual(score_features(feats, self.rules)["breakdown"]["shield"], -2)

    def test_gn_field_not_name_excluded(self):
        for key in ("ability_structured", "ability"):
            excl = [str(x).lower() for x in ((self.rules.get(key) or {}).get("exclude_name_substrings") or [])]
            self.assertFalse(any("gn field" in x for x in excl), key)
            self.assertFalse(any("positron" in x for x in excl), key)
        pts, meta = score_abilities(
            self.rules,
            "Defense",
            ["GN Field\nReduces damage taken"],
        )
        self.assertGreater(pts, 0)
        self.assertGreater(meta["count"], 0)

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
            ["Increase Critical Damage by 20%."],
        )
        self.assertEqual(tid, 1)
        self.assertEqual(pts, 1)
        tid_rate, pts_rate = detect_weapon_bonus_type(
            self.rules,
            ["Increase Critical Rate by 20%."],
        )
        self.assertEqual(tid_rate, 9)
        self.assertEqual(pts_rate, 1)
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

    def test_source_bucket_points(self):
        gacha = score_features(_minimal_features(source="gacha"), self.rules)
        free = score_features(_minimal_features(source="dev"), self.rules)
        event = score_features(_minimal_features(source="event"), self.rules)
        self.assertEqual(gacha["breakdown"]["source"], 0)
        self.assertEqual(free["breakdown"]["source"], 0)
        self.assertEqual(event["breakdown"]["source"], 0)

    def test_limited_supporter_tag_points(self):
        from sp_investment_rank import limited_supporter_tag_points

        pts, meta = limited_supporter_tag_points(
            self.rules,
            ["One-Shot Killer", "Land"],
            {"one-shot killer", "hard er"},
        )
        self.assertEqual(pts, 1)
        self.assertEqual(meta["matched"], ["One-Shot Killer"])
        pts0, _ = limited_supporter_tag_points(self.rules, ["Land"], {"one-shot killer"})
        self.assertEqual(pts0, 0)
        pts2, meta2 = limited_supporter_tag_points(
            self.rules,
            ["One-Shot Killer", "Test Type", "Tough as Nails"],
            {"one-shot killer", "test type", "tough as nails"},
        )
        self.assertEqual(pts2, 2)  # cap 2
        self.assertEqual(len(meta2["matched"]), 3)

    def test_dual_attack_attr_bonus(self):
        none = score_features(_minimal_features(best_attack_attr_count=1), self.rules)
        dual = score_features(_minimal_features(best_attack_attr_count=2), self.rules)
        self.assertEqual(none["breakdown"]["dual_attack_attr"], 0)
        self.assertEqual(dual["breakdown"]["dual_attack_attr"], 1)

    def test_multi_weapon_attr_replaces_lupus_allowlist(self):
        none = score_features(_minimal_features(has_multi_weapon_attr=False, max_weapon_attr_types=1), self.rules)
        multi = score_features(_minimal_features(has_multi_weapon_attr=True, max_weapon_attr_types=2), self.rules)
        self.assertEqual(none["breakdown"].get("multi_weapon_attr", 0), 0)
        self.assertEqual(multi["breakdown"]["multi_weapon_attr"], 2)
        # Old allowlist must not grant a free +3 anymore.
        lupus = score_features(_minimal_features(id="1430003600"), self.rules)
        self.assertEqual(lupus["breakdown"].get("signature_weapon", 0), 0)
        self.assertEqual(lupus["breakdown"].get("multi_weapon_attr", 0), 0)

    def test_multi_weapon_attr_live_examples(self):
        """Feedback examples + former allowlist — catalog rule, not ID list."""
        import app as A
        from sp_investment_rank import extract_unit_features, score_unit

        cases = {
            "1430003400": True,  # Lupus Rex
            "1430004800": True,  # Kimaris Vidar
            "1200005200": True,  # Grand Master
            "1501002500": True,  # Michaelis S2
            "1031000300": True,  # Psycho Zaku (MAP multi)
            "1031000100": True,  # FA Thunderbolt (MAP multi)
        }
        if "1430003400" not in (A.unit_weapon_map or {}):
            self.skipTest("master data not loaded")
        for uid, expect in cases.items():
            feats = extract_unit_features(A, uid, mode="sp", lc="EN", rules=self.rules)
            self.assertEqual(bool(feats and feats.get("has_multi_weapon_attr")), expect, uid)
            scored = score_unit(A, uid, mode="sp", lc="EN", rules=self.rules)
            if not scored:
                continue
            pts = int((scored.get("breakdown") or {}).get("multi_weapon_attr") or 0)
            self.assertEqual(pts, 2 if expect else 0, uid)

    def test_community_adj_clamp(self):
        from sp_investment_rank import community_adj_points, apply_community_adj_to_row

        self.assertEqual(community_adj_points(0, 0, self.rules), 0)
        self.assertEqual(community_adj_points(1, 0, self.rules), 1)
        self.assertEqual(community_adj_points(5, 0, self.rules), 2)
        self.assertEqual(community_adj_points(0, 9, self.rules), -2)
        self.assertEqual(community_adj_points(3, 3, self.rules), 0)
        row = {
            "entity": "unit",
            "total": 10,
            "has_sp": True,
            "role": "Attack",
            "breakdown": {"map": 2},
            "letter": "A",
            "bucket": "recommended",
        }
        out = apply_community_adj_to_row(row, 2, self.rules)
        self.assertEqual(out["total_objective"], 10)
        self.assertEqual(out["community_adj"], 2)
        self.assertEqual(out["total"], 12)
        self.assertEqual(out["breakdown"].get("community"), 2)

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

    def test_support_weapon_bonus_capped(self):
        atk = score_features(
            _minimal_features(
                role="Attack",
                weapon_range=5,
                weapon_bonus_type=4,
                weapon_bonus_points=2,
            ),
            self.rules,
        )
        support = score_features(
            _minimal_features(
                role="Support",
                weapon_range=5,
                weapon_bonus_type=4,
                weapon_bonus_points=2,
            ),
            self.rules,
        )
        self.assertEqual(atk["breakdown"]["weapon_bonus"], 2)
        self.assertEqual(support["breakdown"]["weapon_bonus"], 1)

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

    def test_pilot_hard_er_tag_not_scored(self):
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
        self.assertEqual(scored["breakdown"]["tags"], 0)
        self.assertEqual(scored["breakdown"]["series_affinity"], 2)
        # Portfolio: single S letter → +2 (cap 2); multi-match bonus disabled
        self.assertEqual(scored["breakdown"]["recommend_ms"], 2)

    def test_recommend_ms_requires_a_or_higher(self):
        self.assertEqual(recommend_ms_min_letter(self.rules), "A")
        self.assertNotIn("B+", letter_pts_allowed(self.rules))
        self.assertTrue(letter_meets_min("A", "A"))
        self.assertFalse(letter_meets_min("B+", "A"))
        bplus = {
            "role": "Attack",
            "rarity_id": "4",
            "tag_count": 0,
            "tags": [],
            "ability_effects": [],
            "skill_effects": [],
            "series_affinity_count": 0,
            "best_rec_ms_letter": "B+",
            "rec_ms_bplus_or_better_count": 1,
            "Ranged": 750,
            "Melee": 700,
            "Awaken": 600,
            "Defense": 500,
            "Reaction": 550,
        }
        scored = score_pilot_features(bplus, self.rules)
        self.assertEqual(scored["breakdown"]["recommend_ms"], 0)
        a_grade = dict(bplus, best_rec_ms_letter="A")
        self.assertEqual(score_pilot_features(a_grade, self.rules)["breakdown"]["recommend_ms"], 1)

    def test_recommend_ms_portfolio_cap(self):
        feats = {
            "role": "Attack",
            "rarity_id": "4",
            "tag_count": 0,
            "tags": [],
            "ability_effects": [],
            "skill_effects": [],
            "series_affinity_count": 0,
            "recommended_units": [
                {"id": "1", "letter": "S+"},
                {"id": "2", "letter": "S"},
                {"id": "3", "letter": "A+"},
                {"id": "4", "letter": "A"},
            ],
            "best_rec_ms_letter": "S+",
            "rec_ms_bplus_or_better_count": 4,
            "Ranged": 750,
            "Melee": 700,
            "Awaken": 600,
            "Defense": 500,
            "Reaction": 550,
        }
        # Top 3: S+ + S + A+ = 2+2+1 = 5 → cap 2
        self.assertEqual(score_pilot_features(feats, self.rules)["breakdown"]["recommend_ms"], 2)

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
            "terrain": {"Space": 3, "Atmospheric": 3, "Ground": 3, "Sea": 1, "Underwater": 1},
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
            "weapon_bonus_points": 1,
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
        self.assertEqual(scored["breakdown"]["terrain"], 1)  # Atmo extra only (Space/Land/Atmo full; not 4 for perfect)
        self.assertEqual(scored["breakdown"]["map"], 3)  # presence + ammo2+ + cov1 (22 cells)
        self.assertEqual(scored["breakdown"]["weapon_power"], 3)
        self.assertEqual(scored["breakdown"]["weapon_bonus"], 1)
        self.assertEqual(scored["breakdown"]["abilities"], 2)  # dmg given 15% magnitude band
        self.assertFalse(scored["meta"].get("abilities", {}).get("heuristic"))
        self.assertNotIn("abilities", scored["meta"].get("heuristic_keys") or [])
        self.assertEqual(scored["letter"], "S+")
        self.assertEqual(scored["bucket"], "priority")
        self.assertEqual(bucket_for_letter(self.rules, "S+"), "priority")
        self.assertEqual(bucket_for_letter(self.rules, "S"), "recommended")
        self.assertEqual(bucket_for_letter(self.rules, "C"), "niche")

    def test_structured_permanent_atk_scores_light_for_attack(self):
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
        self.assertEqual(pts, 1)
        self.assertFalse(meta.get("heuristic"))
        # Support still 0 for permanent ATK%
        pts_sup, _ = score_ability_effects(
            self.rules,
            "Support",
            [
                {
                    "trait_type_index": 7,
                    "trait_value": 20,
                    "has_active_cond": False,
                    "trait_type_key": "AttackChangeRate",
                }
            ],
        )
        self.assertEqual(pts_sup, 0)

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

    def test_defense_regeneration_hp_restore(self):
        pts, meta = score_ability_effects(
            self.rules,
            "Defense",
            [
                {
                    "trait_type_index": 83,
                    "trait_type_key": "Regeneration",
                    "trait_value": 30,
                    "has_active_cond": True,
                }
            ],
        )
        self.assertEqual(pts, 2)
        self.assertEqual(meta["contributing"][0]["trait_type_index"], 83)

    def test_max_tension_weapon_is_penalty(self):
        self.assertEqual(int(self.rules.get("max_tension_higher_tier_weapon_points")), -1)
        scored = score_features(
            _minimal_features(has_max_tension_higher_weapon=True),
            self.rules,
            mode="sp",
        )
        self.assertEqual(scored["breakdown"]["max_tension_weapon"], -1)

    def test_ssp_custom_core_bypasses_max_tension_juice(self):
        """00 Raiser Final: SSP …90 bypass; gated SP +type1 enhance must not re-apply −1."""
        import app as A
        from sp_investment_rank import extract_unit_features, score_unit

        uid = "1370005900"
        if uid not in (A.unit_weapon_map or {}):
            self.skipTest("master data not loaded")
        sp_f = extract_unit_features(A, uid, mode="sp", lc="EN", rules=self.rules)
        ssp_f = extract_unit_features(A, uid, mode="ssp", lc="EN", rules=self.rules)
        self.assertTrue(sp_f.get("has_max_tension_higher_weapon"))
        self.assertFalse(ssp_f.get("has_max_tension_higher_weapon"))
        # Damage reference still includes full SSP power on the gated gun.
        self.assertGreaterEqual(int(ssp_f.get("weapon_power") or 0), int(sp_f.get("weapon_power") or 0))
        scored = score_unit(A, uid, mode="ssp", lc="EN", rules=self.rules)
        if scored:
            self.assertEqual(int((scored.get("breakdown") or {}).get("max_tension_weapon") or 0), 0)

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
            {"trait_type_index": 8, "trait_value": 30, "skill_id": "s1"},
            {"trait_type_index": 13, "trait_value": 1, "skill_id": "s2"},
            {"trait_type_index": 9, "trait_value": 20, "skill_id": "s3"},
        ]
        pts, meta = score_pilot_kit_structured(
            self.rules, "Attack", "Ranged", ability_effects, skill_effects
        )
        self.assertLessEqual(pts, int(self.rules.get("pilot_kit_cap", 14)))
        self.assertTrue(meta.get("structured"))
        self.assertFalse(meta.get("heuristic"))
        # conditional +1 flat on top of trait points; role-weighted skills: dmg+2, sure-hit 0, dmg+2
        self.assertEqual(meta.get("ability_flat_points"), 1)
        self.assertEqual(meta.get("skill_points"), 4)

    def test_pilot_ability_flat_conditional_and_mp(self):
        from sp_investment_rank import _score_pilot_ability_flat

        pts, meta = _score_pilot_ability_flat(
            self.rules,
            [
                {"trait_type_index": 17, "trait_value": 10, "has_active_cond": True},
                {"trait_type_index": 46, "trait_value": 20, "has_active_cond": False},
            ],
        )
        self.assertEqual(pts, 2)  # other cond +1 + mp +1
        self.assertEqual(meta["conditional_points"], 1)
        self.assertEqual(meta["initial_mp_points"], 1)

    def test_pilot_ability_flat_conditional_cs_is_plus_one(self):
        from sp_investment_rank import _score_pilot_ability_flat

        pts, meta = _score_pilot_ability_flat(
            self.rules,
            [
                {"trait_type_index": 80, "trait_value": 1, "has_active_cond": True},
            ],
        )
        self.assertEqual(pts, 1)
        self.assertTrue(meta["has_conditional_cs_sa_sd"])
        self.assertFalse(meta["has_unconditional_cs_sa_sd"])
        self.assertEqual(meta["conditional_points"], 1)

    def test_pilot_ability_flat_unconditional_cs_is_plus_two(self):
        from sp_investment_rank import _score_pilot_ability_flat

        pts, meta = _score_pilot_ability_flat(
            self.rules,
            [
                {"trait_type_index": 80, "trait_value": 1, "has_active_cond": False},
            ],
        )
        self.assertEqual(pts, 2)
        self.assertTrue(meta["has_unconditional_cs_sa_sd"])
        self.assertEqual(meta["conditional_points"], 2)

    def test_pilot_skills_flat_per_skill_sum(self):
        from sp_investment_rank import score_pilot_skill_effects

        # role-weighted: two dmg skills +2 each; range_mobility type7 +2; sway type14 +2 → but per skill best trait
        pts, meta = score_pilot_skill_effects(
            self.rules,
            "Attack",
            "Ranged",
            [
                {"trait_type_index": 8, "trait_value": 30, "skill_id": "a"},
                {"trait_type_index": 12, "trait_value": 20, "skill_id": "b"},
                {"trait_type_index": 7, "trait_value": 1, "skill_id": "c"},
                {"trait_type_index": 14, "trait_value": 1, "skill_id": "d"},
            ],
        )
        self.assertEqual(pts, 8)  # 2+2+2+2 role-weighted
        self.assertEqual(meta.get("mode"), "role_weighted")

        pts_sup, _ = score_pilot_skill_effects(
            self.rules,
            "Support",
            "Ranged",
            [{"trait_type_index": 4, "trait_value": 20, "skill_id": "mp"}],
        )
        self.assertEqual(pts_sup, 1)  # MP Up role-weighted +1

        pts_def, _ = score_pilot_skill_effects(
            self.rules,
            "Defense",
            "Melee",
            [{"trait_type_index": 14, "trait_value": 1, "skill_id": "sway"}],
        )
        self.assertEqual(pts_def, 2)  # Sway in range_mobility_surv → +2 Defense

    def test_unit_ability_scoring_unchanged_by_pilot_flat(self):
        # unit path still uses ability_structured only (no pilot flat)
        pts, _ = score_ability_effects(
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
        self.assertEqual(pts, 2)

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
        self.assertIn("pilot_kit_flat", ids)
        self.assertIn("buckets_units", ids)
        self.assertIn("buckets_pilots", ids)
        self.assertNotIn("not_scored", ids)
        er = next(c for c in crit if c["id"] == "er_access")
        self.assertTrue(er["objective"])
        self.assertGreaterEqual(len(er["rows"]), 3)
        self.assertEqual(er.get("roles"), ["Attack", "Defense", "Support"])
        atk_focus = next(c for c in crit if c["id"] == "role_focus_attack")
        self.assertEqual(atk_focus.get("roles"), ["Attack"])
        debuffs = next(c for c in crit if c["id"] == "debuffs")
        self.assertEqual(debuffs.get("roles"), ["Defense", "Support"])
        guide = scoring_guide_payload(self.rules)
        self.assertEqual(len(guide.get("criteria") or []), len(crit))
        map_c = next(c for c in crit if c["id"] == "map")
        blob = " ".join(f"{r['when']} {r['result']}" for r in map_c["rows"])
        self.assertIn("Damage MAP", blob)
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

    def test_defense_no_atmospheric_tax(self):
        terrain = {
            "Space": 3,
            "Atmospheric": 1,
            "Ground": 3,
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
        self.assertEqual(defense["breakdown"]["terrain"], 0)

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
        # Support strength still uses DEF Down / pierce. Defense strength is ATK Down.
        defense = score_features(
            _minimal_features(role="Defense", max_debuff_pct=25, max_atk_dn_pct=0),
            self.rules,
        )
        support = score_features(
            _minimal_features(role="Support", max_debuff_pct=25), self.rules
        )
        self.assertEqual(defense["breakdown"]["max_debuff"], -2)
        self.assertEqual(support["breakdown"]["max_debuff"], 0)
        support_strong = score_features(
            _minimal_features(role="Support", max_debuff_pct=40), self.rules
        )
        self.assertEqual(support_strong["breakdown"]["max_debuff"], 2)

    def test_lasting_atk_down_feeds_defense_max_debuff(self):
        from sp_investment_rank import classify_debuff_keys_from_meta

        keys = classify_debuff_keys_from_meta(
            {
                "type_index": 12,
                "status_type_index": 7,
                "status_value": -30,
                "magnitude": 30,
                "timing": 1,
                "limit": 1,
                "weapon_attrs": [],
            }
        )
        self.assertIn("atk_dn", keys)
        defense = score_features(
            _minimal_features(role="Defense", max_atk_dn_pct=30, max_debuff_pct=0),
            self.rules,
        )
        support = score_features(
            _minimal_features(role="Support", max_atk_dn_pct=30, max_debuff_pct=0),
            self.rules,
        )
        self.assertEqual(defense["breakdown"]["max_debuff"], 1)
        self.assertEqual(support["breakdown"]["max_debuff"], -2)
        defense_strong = score_features(
            _minimal_features(role="Defense", max_atk_dn_pct=40), self.rules
        )
        self.assertEqual(defense_strong["breakdown"]["max_debuff"], 2)

    def test_low_hp_attacker_no_floor_penalty(self):
        scored = score_features(_minimal_features(HP=79000), self.rules)
        self.assertEqual(scored["breakdown"]["hp"], 0)
        high = score_features(_minimal_features(HP=102000), self.rules)
        self.assertEqual(high["breakdown"]["hp"], 2)

    def test_ssp_attack_en_upside_only(self):
        low = score_features(_minimal_features(EN=350), self.rules, mode="ssp")
        self.assertEqual(low["breakdown"]["en"], 0)
        mid = score_features(_minimal_features(EN=420), self.rules, mode="ssp")
        self.assertEqual(mid["breakdown"]["en"], 1)
        hi = score_features(_minimal_features(EN=500), self.rules, mode="ssp")
        self.assertEqual(hi["breakdown"]["en"], 2)
        sp = score_features(_minimal_features(EN=500), self.rules, mode="sp")
        self.assertEqual(sp["breakdown"]["en"], 0)

    def test_stat_outlier_attack_hp(self):
        scored = score_features(_minimal_features(HP=106000), self.rules)
        self.assertEqual(scored["breakdown"]["stat_outlier"], 1)

    def test_special_defense_presence(self):
        none = score_features(_minimal_features(special_defense_kinds=[]), self.rules)
        self.assertEqual(none["breakdown"]["special_defense"], 0)
        one = score_features(
            _minimal_features(special_defense_kinds=["14"]), self.rules
        )
        self.assertEqual(one["breakdown"]["special_defense"], 1)
        two = score_features(
            _minimal_features(special_defense_kinds=["14", "109"]), self.rules
        )
        self.assertEqual(two["breakdown"]["special_defense"], 2)

    def test_ur_pilot_dependence_tax(self):
        free = score_features(_minimal_features(ur_pilot_dependent=False), self.rules)
        self.assertEqual(free["breakdown"]["ur_pilot_dependence"], 0)
        dep = score_features(_minimal_features(ur_pilot_dependent=True), self.rules)
        self.assertEqual(dep["breakdown"]["ur_pilot_dependence"], -1)

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
        self.assertEqual(scored["breakdown"]["er_access"], 2)  # character-restricted: 2+ → +2
        base = {
            "id": "p1",
            "role": "Attack",
            "rarity_id": "4",
            "specialty": "Ranged",
            "tag_count": 0,
            "tags": [],
            "tag_strategic_table": {},
            "er_expert_eligible_count": 12,
            "ability_effects": [],
            "skill_effects": [],
            "kit_items": [],
            "series_affinity_count": 0,
            "best_rec_ms_letter": "",
            "rec_ms_bplus_or_better_count": 0,
            "Ranged": 700,
            "Melee": 700,
            "Awaken": 600,
            "Defense": 500,
            "Reaction": 550,
            "combat_action_flags": {},
        }
        zero = score_pilot_features({**base, "er_expert_restricted_count": 0}, self.rules)
        one = score_pilot_features({**base, "er_expert_restricted_count": 1}, self.rules)
        two = score_pilot_features({**base, "er_expert_restricted_count": 2}, self.rules)
        self.assertEqual(zero["breakdown"]["er_access"], 0)
        self.assertEqual(one["breakdown"]["er_access"], 1)
        self.assertEqual(two["breakdown"]["er_access"], 2)

    def test_pilot_combat_actions_role_weighted(self):
        from sp_investment_rank import score_pilot_combat_actions

        pts, meta = score_pilot_combat_actions(
            self.rules,
            "Support",
            {"support_attack_plus": True, "chance_step_plus": False, "support_defense_plus": False},
        )
        self.assertEqual(pts, 2)
        self.assertEqual(meta["parts"][0]["label"], "Support Attack +1")

        atk_pts, _ = score_pilot_combat_actions(
            self.rules,
            "Attack",
            {"chance_step_plus": True, "support_attack_plus": True, "support_defense_plus": True},
        )
        # Attack: CS+2 + SA+1 + SD+0 = 3, cap 4
        self.assertEqual(atk_pts, 3)

        def_one, _ = score_pilot_combat_actions(
            self.rules,
            "Defense",
            {"support_defense_plus": True, "support_defense_plus_count": 1},
        )
        self.assertEqual(def_one, 2)
        def_two, meta_two = score_pilot_combat_actions(
            self.rules,
            "Defense",
            {"support_defense_plus": True, "support_defense_plus_count": 2},
        )
        self.assertEqual(def_two, 3)
        self.assertEqual(meta_two["parts"][0]["count"], 2)

        sup_sd, _ = score_pilot_combat_actions(
            self.rules,
            "Support",
            {
                "support_attack_plus": True,
                "support_defense_plus": True,
                "support_defense_plus_count": 1,
            },
        )
        # Support SA+2 + SD+2 = 4, cap 4
        self.assertEqual(sup_sd, 4)

    def test_transform_better_combat_stats(self):
        from sp_investment_rank import (
            merge_better_combat_stats,
            transform_alt_improves_combat_stats,
        )

        base = {"HP": 100000, "DEF": 9000, "ATK": 8000, "MOB": 7000}
        alt = {"HP": 120000, "DEF": 11000, "ATK": 8500, "MOB": 7000}
        self.assertTrue(transform_alt_improves_combat_stats(base, alt, self.rules))
        merged = merge_better_combat_stats(base, alt, self.rules)
        self.assertEqual(merged["HP"], 120000)
        self.assertEqual(merged["DEF"], 11000)
        self.assertEqual(merged["ATK"], 8500)
        same = {"HP": 100000, "DEF": 9000, "ATK": 8000}
        self.assertFalse(transform_alt_improves_combat_stats(base, same, self.rules))

    def test_pilot_series_affinity_cap(self):
        from sp_investment_rank import _pilot_series_affinity_points

        self.assertEqual(_pilot_series_affinity_points(self.rules, 0), 0)
        self.assertEqual(_pilot_series_affinity_points(self.rules, 1), 2)
        self.assertEqual(_pilot_series_affinity_points(self.rules, 3), 2)

    def test_pilot_sr_rarity_not_penalized(self):
        feats = {
            "id": "p1",
            "role": "Attack",
            "rarity_id": "3",
            "specialty": "Ranged",
            "tag_count": 0,
            "tags": [],
            "tag_strategic_table": {},
            "er_expert_eligible_count": 5,
            "ability_effects": [],
            "skill_effects": [],
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
        self.assertEqual(scored["breakdown"]["rarity"], 0)

    def test_public_criteria_includes_pilot_stats_and_v515_axes(self):
        from sp_investment_rank import build_public_criteria

        crit = build_public_criteria(self.rules)
        ids = {c["id"] for c in crit}
        self.assertIn("pilot_stats_attack", ids)
        self.assertIn("special_defense", ids)
        self.assertIn("ur_pilot_dependence", ids)
        self.assertIn("stat_outlier", ids)
        self.assertIn("pilot_rarity", ids)
        self.assertIn("pilot_er_access", ids)
        self.assertIn("pilot_combat_actions", ids)


class TestSeriesAdvantageHelpers(unittest.TestCase):
    def test_parse_advantage_series_name(self):
        from sp_investment_rank import (
            _is_series_advantage_ability_name,
            _match_tags_for_series_advantage,
            _parse_series_advantage_name,
        )

        self.assertTrue(_is_series_advantage_ability_name("Advantage: Mobile Suit Gundam Wing LV 2"))
        self.assertFalse(_is_series_advantage_ability_name("Increased ATK LV 2"))
        self.assertEqual(
            _parse_series_advantage_name("Advantage: Mobile Suit Gundam Wing LV 2"),
            "Mobile Suit Gundam Wing",
        )
        tags = _match_tags_for_series_advantage(
            "Mobile Suit Gundam Wing",
            ["Wing Series", "Gundam", "Newtype", "Rival"],
        )
        self.assertEqual(tags, ["Wing Series"])
        self.assertNotIn("Gundam", tags)
        self.assertNotIn("Newtype", tags)

    def test_exclude_ur_units_flag(self):
        clear_rules_cache()
        rules = load_rules()
        self.assertTrue(rules.get("exclude_ur_units", True))
        self.assertTrue(rules.get("exclude_ur_characters", True))

    def test_character_eligibility_drops_ur(self):
        from sp_investment_rank import character_is_investment_eligible

        class _FakeA:
            char_list_playable_ids = {"c_ssr", "c_ur"}
            char_info_map = {
                "c_ssr": {"rarity": 4, "role": "1"},
                "c_ur": {"rarity": 5, "role": "1"},
            }

            @staticmethod
            def normalize_id(x):
                return str(x)

        A = _FakeA()
        rules = load_rules()
        self.assertTrue(character_is_investment_eligible(A, "c_ssr", rules))
        self.assertFalse(character_is_investment_eligible(A, "c_ur", rules))

    def test_unit_eligibility_drops_schedule_shell_and_ur(self):
        from sp_investment_rank import unit_is_investment_eligible

        class _FakeA:
            unit_list_playable_ids = {"u_ok", "u_shell", "u_ur", "u_ult"}
            unit_info_map = {
                "u_ok": {"rarity": 4, "body_type": "1", "schedule_id": "0"},
                "u_shell": {"rarity": 3, "body_type": "1", "schedule_id": "9999990001"},
                "u_ur": {"rarity": 5, "body_type": "1", "is_ultimate": False},
                "u_ult": {"rarity": 5, "body_type": "1", "is_ultimate": True},
            }

            @staticmethod
            def normalize_id(x):
                return str(x)

        A = _FakeA()
        rules = load_rules()
        self.assertTrue(unit_is_investment_eligible(A, "u_ok", rules))
        self.assertFalse(unit_is_investment_eligible(A, "u_shell", rules))
        self.assertFalse(unit_is_investment_eligible(A, "u_ur", rules))
        self.assertTrue(unit_is_investment_eligible(A, "u_ult", rules))

    def test_character_eligibility_drops_schedule_shell(self):
        from sp_investment_rank import character_is_investment_eligible

        class _FakeA:
            char_list_playable_ids = {"c_ok", "c_shell"}
            char_info_map = {
                "c_ok": {"rarity": 4, "role": "1", "schedule_id": "0"},
                "c_shell": {"rarity": 2, "role": "3", "schedule_id": "9999990001"},
            }

            @staticmethod
            def normalize_id(x):
                return str(x)

        A = _FakeA()
        rules = load_rules()
        self.assertTrue(character_is_investment_eligible(A, "c_ok", rules))
        self.assertFalse(character_is_investment_eligible(A, "c_shell", rules))


def _minimal_features(**overrides):
    base = {
        "id": "0",
        "role": "Attack",
        "rarity_id": "4",
        "source": "gacha",
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
        "EN": 380,
        "ATK": 11800,
        "DEF": 8200,
        "MOB": 9300,
        "MOV": 5,
        "weapon_range": 4,
        "weapon_power": 5200,
        "weapon_bonus_type": 0,
        "weapon_bonus_points": 0,
        "best_attack_attr_count": 1,
        "has_max_tension_higher_weapon": False,
        "has_preemptive": False,
        "has_rare_debuff": False,
        "has_extra_life": False,
        "has_after_move_map": False,
        "has_extra_move_kit": False,
        "max_debuff_pct": 0,
        "max_atk_dn_pct": 0,
        "support_debuffs_range4_count": 0,
        "support_debuffs_range5_count": 0,
        "special_defense_kinds": [],
        "ur_pilot_dependent": False,
    }
    base.update(overrides)
    return base


class TestRecommendedCharactersSpecialty(unittest.TestCase):
    """Unit → Character recs must match peak-weapon specialty (Defense exempt)."""

    def test_melee_peak_excludes_ranged_ssr_prefers_melee_sr(self):
        from unittest.mock import patch

        from sp_investment_rank import match_recommended_characters

        class _FakeA:
            unit_info_map = {"u_melee": {"role": "1", "recommend_character_id": "c_ranged_ssr"}}
            LANG_DATA = {"EN": {}}

            @staticmethod
            def normalize_id(x):
                return str(x)

            @staticmethod
            def resolve_unit_recommend_character_id(uid, info=None):
                return "c_ranged_ssr"

            @staticmethod
            def _factions_for_playable_unit_ids(uids, lc):
                return {"wing"}

        char_by_id = {
            "c_ranged_ssr": {
                "id": "c_ranged_ssr",
                "name": "Heero",
                "letter": "S",
                "role": "Attack",
                "rarity": "SSR",
                "specialty": "Ranged",
            },
            "c_melee_sr": {
                "id": "c_melee_sr",
                "name": "Duo",
                "letter": "A",
                "role": "Attack",
                "rarity": "SR",
                "specialty": "Melee",
            },
            "c_melee_ssr": {
                "id": "c_melee_ssr",
                "name": "Wufei",
                "letter": "A+",
                "role": "Attack",
                "rarity": "SSR",
                "specialty": "Melee",
            },
        }
        board_aff = [
            {
                "id": "c_ranged_ssr",
                "factions": frozenset({"wing"}),
                "pair_unit_ids": frozenset(),
                "role": "Attack",
            },
            {
                "id": "c_melee_sr",
                "factions": frozenset({"wing"}),
                "pair_unit_ids": frozenset(),
                "role": "Attack",
            },
            {
                "id": "c_melee_ssr",
                "factions": frozenset({"wing"}),
                "pair_unit_ids": frozenset(),
                "role": "Attack",
            },
        ]
        with patch(
            "sp_investment_rank.unit_peak_weapon_specialties",
            return_value=frozenset({"Melee"}),
        ), patch(
            "sp_investment_rank.count_affinity_pilots_for_unit",
            return_value=(
                3,
                {
                    "pilot_ids": ["c_ranged_ssr", "c_melee_ssr", "c_melee_sr"],
                    "sample_pilot_ids": ["c_ranged_ssr", "c_melee_ssr", "c_melee_sr"],
                },
            ),
        ):
            rows = match_recommended_characters(
                _FakeA(),
                "u_melee",
                "Attack",
                "1",
                char_by_id,
                affinity_pool=[],
                board_affinity=board_aff,
                cap=3,
            )
        ids = [r["id"] for r in rows]
        self.assertNotIn("c_ranged_ssr", ids)
        self.assertIn("c_melee_ssr", ids)
        self.assertIn("c_melee_sr", ids)
        self.assertEqual(ids[0], "c_melee_ssr")

    def test_dual_attr_peak_accepts_either_specialty(self):
        from unittest.mock import patch

        from sp_investment_rank import match_recommended_characters

        class _FakeA:
            unit_info_map = {"u_dual": {"role": "1"}}
            LANG_DATA = {"EN": {}}

            @staticmethod
            def normalize_id(x):
                return str(x)

            @staticmethod
            def resolve_unit_recommend_character_id(uid, info=None):
                return ""

            @staticmethod
            def _factions_for_playable_unit_ids(uids, lc):
                return {"f"}

        char_by_id = {
            "c_r": {
                "id": "c_r",
                "name": "R",
                "letter": "A",
                "role": "Attack",
                "specialty": "Ranged",
            },
            "c_m": {
                "id": "c_m",
                "name": "M",
                "letter": "A",
                "role": "Attack",
                "specialty": "Melee",
            },
        }
        board_aff = [
            {
                "id": "c_r",
                "factions": frozenset({"f"}),
                "pair_unit_ids": frozenset(),
                "role": "Attack",
            },
            {
                "id": "c_m",
                "factions": frozenset({"f"}),
                "pair_unit_ids": frozenset(),
                "role": "Attack",
            },
        ]
        with patch(
            "sp_investment_rank.unit_peak_weapon_specialties",
            return_value=frozenset({"Ranged", "Melee"}),
        ), patch(
            "sp_investment_rank.count_affinity_pilots_for_unit",
            return_value=(2, {"pilot_ids": ["c_r", "c_m"]}),
        ):
            rows = match_recommended_characters(
                _FakeA(),
                "u_dual",
                "Attack",
                "1",
                char_by_id,
                affinity_pool=[],
                board_affinity=board_aff,
                cap=3,
            )
        self.assertEqual({r["id"] for r in rows}, {"c_r", "c_m"})

    def test_defense_unit_skips_specialty(self):
        from unittest.mock import patch

        from sp_investment_rank import match_recommended_characters

        class _FakeA:
            unit_info_map = {"u_def": {"role": "2"}}
            LANG_DATA = {"EN": {}}

            @staticmethod
            def normalize_id(x):
                return str(x)

            @staticmethod
            def resolve_unit_recommend_character_id(uid, info=None):
                return ""

            @staticmethod
            def _factions_for_playable_unit_ids(uids, lc):
                return {"f"}

        char_by_id = {
            "c_ranged": {
                "id": "c_ranged",
                "name": "Ranged Def",
                "letter": "S",
                "role": "Defense",
                "specialty": "Ranged",
            },
        }
        board_aff = [
            {
                "id": "c_ranged",
                "factions": frozenset({"f"}),
                "pair_unit_ids": frozenset(),
                "role": "Defense",
            }
        ]
        with patch(
            "sp_investment_rank.unit_peak_weapon_specialties",
            return_value=frozenset({"Melee"}),
        ), patch(
            "sp_investment_rank.count_affinity_pilots_for_unit",
            return_value=(1, {"pilot_ids": ["c_ranged"]}),
        ):
            rows = match_recommended_characters(
                _FakeA(),
                "u_def",
                "Defense",
                "2",
                char_by_id,
                affinity_pool=[],
                board_affinity=board_aff,
                cap=3,
            )
        self.assertEqual([r["id"] for r in rows], ["c_ranged"])

    def test_official_mismatch_omitted_when_no_match(self):
        from unittest.mock import patch

        from sp_investment_rank import match_recommended_characters

        class _FakeA:
            unit_info_map = {"u_x": {"role": "1"}}
            LANG_DATA = {"EN": {}}

            @staticmethod
            def normalize_id(x):
                return str(x)

            @staticmethod
            def resolve_unit_recommend_character_id(uid, info=None):
                return "c_official_ranged"

            @staticmethod
            def _factions_for_playable_unit_ids(uids, lc):
                return set()

        char_by_id = {
            "c_official_ranged": {
                "id": "c_official_ranged",
                "name": "Official",
                "letter": "S+",
                "role": "Attack",
                "specialty": "Ranged",
            },
        }
        with patch(
            "sp_investment_rank.unit_peak_weapon_specialties",
            return_value=frozenset({"Melee"}),
        ), patch(
            "sp_investment_rank.count_affinity_pilots_for_unit",
            return_value=(0, {"pilot_ids": []}),
        ):
            rows = match_recommended_characters(
                _FakeA(),
                "u_x",
                "Attack",
                "1",
                char_by_id,
                affinity_pool=[],
                board_affinity=[],
                cap=3,
            )
        self.assertEqual(rows, [])


class TestDecisionAids(unittest.TestCase):
    def test_ssp_gains_mov_map_and_tension_bypass(self):
        from sp_investment_rank import ssp_conversion_gains

        sp = {
            "has_map": False,
            "stats": {"MOV": 5},
            "breakdown": {
                "map": 0,
                "weapon_range": 1,
                "weapon_power": 2,
                "terrain": 0,
                "max_tension_weapon": -1,
                "preemptive": 0,
                "abilities": 1,
            },
            "abilities": [{"id": "a1", "name": "Old"}],
        }
        ssp = {
            "has_map": True,
            "stats": {"MOV": 6},
            "breakdown": {
                "map": 3,
                "weapon_range": 2,
                "weapon_power": 4,
                "terrain": 1,
                "max_tension_weapon": 0,
                "preemptive": 1,
                "abilities": 2,
            },
            "abilities": [
                {"id": "a1", "name": "Old"},
                {"id": "a2", "name": "New Core"},
            ],
        }
        kinds = [g["kind"] for g in ssp_conversion_gains(sp, ssp)]
        self.assertIn("movement", kinds)
        self.assertIn("map_new", kinds)
        self.assertIn("weapon_range", kinds)
        self.assertIn("weapon_power", kinds)
        self.assertIn("terrain", kinds)
        self.assertIn("preemptive", kinds)
        self.assertIn("max_tension_bypass", kinds)
        self.assertIn("ability_new", kinds)
        mov = next(g for g in ssp_conversion_gains(sp, ssp) if g["kind"] == "movement")
        self.assertEqual(mov["from"], 5)
        self.assertEqual(mov["to"], 6)

    def test_ssp_gains_empty_when_identical(self):
        from sp_investment_rank import ssp_conversion_gains

        row = {
            "has_map": True,
            "stats": {"MOV": 5},
            "breakdown": {"map": 2, "weapon_range": 1},
            "abilities": [{"id": "a1", "name": "X"}],
        }
        self.assertEqual(ssp_conversion_gains(row, dict(row)), [])

    def test_kit_highlights_unit_and_character(self):
        from sp_investment_rank import kit_highlight_chips

        unit = {
            "entity": "unit",
            "has_map": True,
            "stats": {"MOV": 6},
            "breakdown": {"max_debuff": 2, "preemptive": 0},
            "has_after_move_map": True,
            "er_expert_ids": ["s1", "s2", "s3"],
        }
        kinds = [c["kind"] for c in kit_highlight_chips(unit)]
        self.assertIn("mov6", kinds)
        self.assertIn("map", kinds)
        self.assertIn("after_move_map", kinds)
        self.assertLessEqual(len(kinds), 4)
        # ER is later after mov/map/after_move_map/debuff — still shown when there is room.
        er_only = kit_highlight_chips(
            {"entity": "unit", "stats": {"MOV": 5}, "er_expert_ids": ["s1", "s2"]}
        )
        self.assertIn("er", [c["kind"] for c in er_only])

        char = {
            "entity": "character",
            "specialty": "Melee",
            "skills": [{"id": "1", "name": "Sway LV 2"}, {"id": "2", "name": "MP Up LV 5"}],
            "breakdown": {"combat_actions": 2},
            "er_expert_ids": ["s1"],
        }
        ck = [c["kind"] for c in kit_highlight_chips(char)]
        self.assertIn("specialty", ck)
        self.assertIn("sway", ck)
        self.assertIn("mp_up", ck)
        self.assertLessEqual(len(ck), 4)

    def test_kit_highlights_sway_ja_and_tw(self):
        from sp_investment_rank import kit_highlight_chips

        ja = {
            "entity": "character",
            "skills": [{"id": "1", "name": "スウェーLV1"}],
        }
        tw = {
            "entity": "character",
            "skills": [{"id": "1", "name": "搖擺閃避 LV3"}],
        }
        self.assertIn("sway", [c["kind"] for c in kit_highlight_chips(ja)])
        self.assertIn("sway", [c["kind"] for c in kit_highlight_chips(tw)])

    def test_increased_mov_is_not_movement_followup(self):
        from sp_investment_rank import effects_have_movement_followup, load_rules

        rules = load_rules()
        # TraitType 70 = MovementChangeValue (Increased MOV) — not Chance Step / after-move MAP.
        self.assertFalse(
            effects_have_movement_followup(rules, [{"trait_type_index": 70}])
        )
        self.assertTrue(
            effects_have_movement_followup(rules, [{"trait_type_index": 19}])
        )
        unit_mov = {
            "entity": "unit",
            "stats": {"MOV": 5},
            "breakdown": {"movement_followup": 1},
            "has_after_move_map": False,
        }
        from sp_investment_rank import kit_highlight_chips

        kinds = [c["kind"] for c in kit_highlight_chips(unit_mov)]
        self.assertNotIn("after_move_map", kinds)
        self.assertNotIn("followup", kinds)

    def test_sd_pair_gate_drops_character_free_for_all(self):
        from sp_investment_rank import apply_sd_er_pair_gate

        payload = {
            "er_expert_filters": [
                {
                    "id": "90520001",
                    "character_free_for_all": True,
                    "unit_restrictions": [{"kind": "tag", "id": "1001", "name": "U.C. Series"}],
                    "character_restrictions": [],
                },
                {
                    "id": "90520003",
                    "character_free_for_all": True,
                    "unit_restrictions": [{"kind": "tag", "id": "1005", "name": "Protagonist"}],
                    "character_restrictions": [],
                },
                {
                    "id": "90520020",
                    "character_free_for_all": True,
                    "unit_restrictions": [{"kind": "tag", "id": "1007", "name": "Specialized Unit"}],
                    "character_restrictions": [],
                },
            ],
            "units": {
                "sp": {
                    "solid": [
                        {
                            "id": "1709000100",
                            "is_sd": True,
                            "er_expert_ids": ["90520003", "90520020"],
                        }
                    ]
                }
            },
            "characters": {
                "sp": {
                    "solid": [
                        {
                            "id": "1709000100",
                            "is_sd_linked": True,
                            "tags": ["Protagonist", "SD Gundam", "Gundam Pilot"],
                            "er_expert_ids": [
                                "90520001",
                                "90520003",
                                "90520020",
                            ],
                        }
                    ]
                }
            },
        }
        apply_sd_er_pair_gate(
            payload, linked_char_to_unit={"1709000100": "1709000100"}
        )
        ids = payload["characters"]["sp"]["solid"][0]["er_expert_ids"]
        self.assertEqual(ids, ["90520003"])
        unit_ids = payload["units"]["sp"]["solid"][0]["er_expert_ids"]
        self.assertEqual(unit_ids, ["90520003"])

    def test_sd_pair_gate_uses_linked_unit_id(self):
        from sp_investment_rank import apply_sd_er_pair_gate

        payload = {
            "er_expert_filters": [
                {
                    "id": "90520001",
                    "character_restrictions": [],
                    "unit_restrictions": [{"kind": "tag", "id": "1001", "name": "U.C. Series"}],
                },
                {
                    "id": "90520003",
                    "character_restrictions": [],
                    "unit_restrictions": [{"kind": "tag", "id": "1005", "name": "Protagonist"}],
                },
                {
                    "id": "90520027",
                    "character_restrictions": [{"kind": "tag", "id": "1105", "name": "Gundam Pilot"}],
                    "unit_restrictions": [{"kind": "tag", "id": "1003", "name": "Gundam"}],
                },
            ],
            "units": {
                "sp": {
                    "solid": [
                        {
                            "id": "1705000400",
                            "is_sd": True,
                            "er_expert_ids": ["90520003", "90520027"],
                        }
                    ]
                }
            },
            "characters": {
                "sp": {
                    "solid": [
                        {
                            "id": "1705001700",
                            "is_sd_linked": True,
                            "tags": ["Protagonist", "Gundam Pilot"],
                            "er_expert_ids": ["90520001", "90520003", "90520027"],
                        }
                    ]
                }
            },
        }
        apply_sd_er_pair_gate(
            payload, linked_char_to_unit={"1705001700": "1705000400"}
        )
        ids = payload["characters"]["sp"]["solid"][0]["er_expert_ids"]
        self.assertEqual(ids, ["90520003", "90520027"])


if __name__ == "__main__":
    unittest.main()
