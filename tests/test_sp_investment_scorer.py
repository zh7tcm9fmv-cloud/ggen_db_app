"""Golden tests for SP investment pure scorer (no app import)."""

import unittest

from sp_investment_rank import (
    band_points,
    bucket_for_letter,
    clear_rules_cache,
    detect_weapon_bonus_type,
    filter_scored_unit_tags,
    letter_for_total,
    load_rules,
    pilot_tag_count_points,
    score_abilities,
    score_features,
    score_pilot_features,
    tag_count_points,
    tag_weight_points,
    terrain_coverage_points,
)


class TestSpInvestmentBands(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        clear_rules_cache()
        cls.rules = load_rules()

    def test_rules_version_4(self):
        self.assertEqual(self.rules.get("version"), 4)

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

    def test_tag_weight_cap(self):
        pts, meta = tag_weight_points(
            self.rules,
            ["One-Shot Killer", "Tough as Nails", "Land", "Aerial Use"],
        )
        self.assertEqual(pts, 2)
        self.assertGreaterEqual(len(meta["matches"]), 2)

    def test_atk_attacker_bands_sheet(self):
        bands = self.rules["stat_bands"]["ATK"]["Attack"]
        self.assertEqual(band_points(bands, 11599), -2)
        self.assertEqual(band_points(bands, 11600), 0)
        self.assertEqual(band_points(bands, 12000), 1)
        self.assertEqual(band_points(bands, 12400), 2)

    def test_weapon_power_top_tier_6200(self):
        bands = self.rules["weapon_power"]["Attack"]
        self.assertEqual(band_points(bands, 5899), 0)
        self.assertEqual(band_points(bands, 5900), 1)
        self.assertEqual(band_points(bands, 6200), 3)

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
        self.assertEqual(scored["breakdown"]["terrain"], 2)

    def test_terrain_missing_land_penalty(self):
        feats = _minimal_features(
            MOV=5,
            weapon_range=5,
            terrain={"Space": 3, "Atmospheric": 3, "Ground": 1, "Sea": 1, "Underwater": 1},
        )
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["terrain"], -2)
        pts, meta = terrain_coverage_points(self.rules, feats["terrain"])
        self.assertEqual(pts, -2)
        self.assertFalse(meta["has_land"])

    def test_rarity_adjustment_n_vs_ssr(self):
        n = score_features(_minimal_features(rarity_id="1"), self.rules)
        ssr = score_features(_minimal_features(rarity_id="4"), self.rules)
        self.assertEqual(n["breakdown"]["rarity"], -5)
        self.assertEqual(ssr["breakdown"]["rarity"], 0)
        self.assertEqual(ssr["total"] - n["total"], 5)

    def test_map_ammo(self):
        feats = _minimal_features(map_ammo=1)
        self.assertEqual(score_features(feats, self.rules)["breakdown"]["map"], 1)
        feats2 = _minimal_features(map_ammo=3)
        self.assertEqual(score_features(feats2, self.rules)["breakdown"]["map"], 2)

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
            ["Increased Attack LV 3\nIncrease Attack by 15%."],
        )
        self.assertEqual(pts, 0)
        self.assertEqual(meta.get("skipped_stat"), 1)

    def test_tension_gated_ability_ignored(self):
        pts, meta = score_abilities(
            self.rules,
            "Support",
            ["Overdrive\nWhen tension is Super Strong, increases attack by 20%"],
        )
        self.assertEqual(pts, 0)
        self.assertGreaterEqual(meta.get("skipped_tension", 0), 1)

    def test_great_ability_attacker(self):
        pts, meta = score_abilities(
            self.rules,
            "Attack",
            ["Overboost\nIncreases attack by 20%"],
        )
        self.assertEqual(pts, 2)
        self.assertEqual(meta["great"], 1)

    def test_letter_and_bucket_sheet(self):
        self.assertEqual(letter_for_total(self.rules, 22), "S+")
        self.assertEqual(letter_for_total(self.rules, 18), "S")
        self.assertEqual(letter_for_total(self.rules, 14), "A+")
        self.assertEqual(letter_for_total(self.rules, 12), "A")
        self.assertEqual(letter_for_total(self.rules, 10), "B+")
        self.assertEqual(letter_for_total(self.rules, 8), "B")
        self.assertEqual(letter_for_total(self.rules, 5), "C")
        self.assertEqual(letter_for_total(self.rules, 3), "D")
        self.assertEqual(letter_for_total(self.rules, 2), "E")
        self.assertEqual(bucket_for_letter(self.rules, "S+"), "priority")
        self.assertEqual(bucket_for_letter(self.rules, "A"), "strong")
        self.assertEqual(bucket_for_letter(self.rules, "B"), "situational")
        self.assertEqual(bucket_for_letter(self.rules, "E"), "low")

    def test_support_r4_debuffs(self):
        feats = _minimal_features(role="Support", support_debuffs_range4_count=0)
        self.assertEqual(score_features(feats, self.rules)["breakdown"]["support_r4_debuffs"], -1)
        feats2 = _minimal_features(role="Support", support_debuffs_range4_count=2)
        self.assertEqual(score_features(feats2, self.rules)["breakdown"]["support_r4_debuffs"], 1)

    def test_support_max_debuff_softened(self):
        feats = _minimal_features(role="Support", max_debuff_pct=0)
        self.assertEqual(score_features(feats, self.rules)["breakdown"]["max_debuff"], -2)

    def test_weapon_bonus_typed(self):
        tid, pts = detect_weapon_bonus_type(
            self.rules,
            ["Increases critical rate when HP is high"],
        )
        self.assertIn(tid, (1, 2))
        self.assertEqual(pts, 1)
        tid_low, pts_low = detect_weapon_bonus_type(
            self.rules,
            ["Deals more damage when HP is low"],
        )
        self.assertEqual(tid_low, 3)
        self.assertEqual(pts_low, 0)

    def test_higher_range_bonus_ignored_when_short_range(self):
        short = _minimal_features(
            weapon_range=2,
            weapon_bonus_type=4,
            weapon_bonus_points=1,
        )
        self.assertEqual(score_features(short, self.rules)["breakdown"]["weapon_bonus"], 0)
        long = _minimal_features(
            weapon_range=5,
            weapon_bonus_type=4,
            weapon_bonus_points=1,
        )
        self.assertEqual(score_features(long, self.rules)["breakdown"]["weapon_bonus"], 1)

    def test_weapon_bonus_in_score(self):
        base = _minimal_features(weapon_bonus_type=0, weapon_bonus_points=0)
        with_bonus = _minimal_features(weapon_bonus_type=1, weapon_bonus_points=1)
        self.assertEqual(
            score_features(with_bonus, self.rules)["breakdown"]["weapon_bonus"]
            - score_features(base, self.rules)["breakdown"]["weapon_bonus"],
            1,
        )

    def test_pilot_tag_points_zeroed(self):
        self.assertEqual(pilot_tag_count_points(self.rules, 1), 0)
        self.assertEqual(pilot_tag_count_points(self.rules, 10), 0)

    def test_pilot_hard_er_tag_bonus(self):
        feats = {
            "role": "Attack",
            "tag_count": 4,
            "tags": ["Alternative Series", "Protagonist", "Hard ER", "Mono-Eye Pilot"],
            "kit_items": [
                {
                    "kind": "skill",
                    "name": "Ranged Boost LV 3",
                    "blob": "Ranged Boost LV 3\nIncrease Ranged by 15% [1 turn].",
                    "is_affinity": False,
                },
                {
                    "kind": "skill",
                    "name": "Sway LV 1",
                    "blob": "Sway LV 1\nDuring the next fight after activating the effect, increase Evasion by 100%.",
                    "is_affinity": False,
                },
                {
                    "kind": "ability",
                    "name": "Affinity: Operation Meteor LV 2",
                    "blob": "Affinity: Operation Meteor LV 2\nWhen piloting units with specified tags…",
                    "is_affinity": True,
                },
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
        self.assertEqual(scored["breakdown"]["skills_abilities"], 8)
        self.assertGreaterEqual(scored["total"], 18)
        self.assertTrue(any(x.get("kind") == "stat" and x.get("key") == "Ranged" for x in scored["detail_lines"]))

    def test_strong_attacker_golden_total(self):
        """Hand-built strong attacker against sheet v4 bands."""
        feats = {
            "role": "Attack",
            "rarity_id": "4",
            "tag_count_scored": 5,
            "tags": ["One-Shot Killer", "Land", "Aerial Use", "Tough as Nails"],
            "terrain": {"Space": 3, "Atmospheric": 3, "Ground": 2, "Sea": 1, "Underwater": 1},
            # terrain: Space+Land + Atmo = +1
            "has_transform": True,  # +1
            "map_ammo": 2,  # +2
            "ability_blobs": ["Boost\nIncreases damage dealt by 15%"],  # +2 great
            "has_linked_pilot": True,
            "linked_pilot_very_good": True,  # +1
            "has_shield": True,  # +1
            "HP": 96000,  # +1
            "ATK": 12500,  # +2
            "DEF": 9200,  # +2
            "MOB": 10100,  # +2
            "MOV": 6,  # +2
            "weapon_range": 6,  # +3
            "weapon_power": 6300,  # +3
            "weapon_bonus_type": 1,
            "weapon_bonus_points": 1,  # +1
            "has_max_tension_higher_weapon": False,
            "has_preemptive": True,  # +1
            "has_rare_debuff": False,
            "has_extra_life": False,
            "max_debuff_pct": 0,
            "support_debuffs_range4_count": 0,
        }
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["tags"], 0)
        self.assertEqual(scored["breakdown"]["tags_weight"], 2)
        self.assertEqual(scored["breakdown"]["terrain"], 1)
        self.assertEqual(scored["breakdown"]["weapon_bonus"], 1)
        self.assertEqual(scored["breakdown"]["rarity"], 0)
        # weight2 +terrain1 +transform1+map2+abil2+linked1 +pre1
        # +hp1+atk2+def2+mob2+shield1+mov2+wr3+wp3+wb1 = 27
        self.assertEqual(scored["total"], 27)
        self.assertEqual(scored["letter"], "S+")
        self.assertEqual(scored["bucket"], "priority")

    def test_low_hp_attacker_penalty(self):
        scored = score_features(_minimal_features(HP=79000), self.rules)
        self.assertEqual(scored["breakdown"]["hp"], -3)


def _minimal_features(**overrides):
    base = {
        "role": "Attack",
        "rarity_id": "4",
        "tag_count": 0,
        "tag_count_scored": 0,
        "tags": [],
        "terrain": {"Space": 1, "Atmospheric": 1, "Ground": 1, "Sea": 1, "Underwater": 1},
        "has_transform": False,
        "map_ammo": 0,
        "ability_blobs": [],
        "has_linked_pilot": False,
        "linked_pilot_very_good": False,
        "has_shield": True,
        "HP": 88000,
        "ATK": 11800,
        "DEF": 8200,
        "MOB": 9300,
        "MOV": 4,
        "weapon_range": 4,
        "weapon_power": 5500,
        "weapon_bonus_type": 0,
        "weapon_bonus_points": 0,
        "has_max_tension_higher_weapon": False,
        "has_preemptive": False,
        "has_rare_debuff": False,
        "has_extra_life": False,
        "max_debuff_pct": 0,
        "support_debuffs_range4_count": 0,
    }
    base.update(overrides)
    return base


if __name__ == "__main__":
    unittest.main()
