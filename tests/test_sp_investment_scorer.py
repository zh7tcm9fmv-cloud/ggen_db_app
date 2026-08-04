"""Golden tests for SP investment pure scorer (no app import)."""

import unittest

from sp_investment_rank import (
    band_points,
    bucket_for_letter,
    letter_for_total,
    load_rules,
    pilot_tag_count_points,
    score_abilities,
    score_features,
    score_pilot_features,
    tag_count_points,
)


class TestSpInvestmentBands(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rules = load_rules()

    def test_tag_points(self):
        self.assertEqual(tag_count_points(self.rules, 3), 0)
        self.assertEqual(tag_count_points(self.rules, 4), 1)
        self.assertEqual(tag_count_points(self.rules, 7), 2)
        self.assertEqual(tag_count_points(self.rules, 10), 4)

    def test_atk_attacker_bands(self):
        bands = self.rules["stat_bands"]["ATK"]["Attack"]
        self.assertEqual(band_points(bands, 10699), -2)
        self.assertEqual(band_points(bands, 10700), 0)
        self.assertEqual(band_points(bands, 11500), 1)
        self.assertEqual(band_points(bands, 12000), 2)

    def test_weapon_power_top_tier_5800(self):
        bands = self.rules["weapon_power"]["Attack"]
        self.assertEqual(band_points(bands, 5799), 2)
        self.assertEqual(band_points(bands, 5800), 3)

    def test_def_move_4_is_minus_one(self):
        # scored via score_features
        base = _minimal_features(role="Defense", MOV=4)
        scored = score_features(base, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["movement"], -1)

    def test_terrain_dual_space_ground(self):
        feats = _minimal_features(
            terrain={"Space": 2, "Atmospheric": 1, "Ground": 2, "Sea": 1, "Underwater": 1}
        )
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["terrain_dual"], 2)

    def test_terrain_dual_not_space_air_only(self):
        # Dual requires Space+Ground deploy; niche perfect needs level 3 (●).
        feats = _minimal_features(
            terrain={"Space": 3, "Atmospheric": 3, "Ground": 1, "Sea": 1, "Underwater": 1}
        )
        scored = score_features(feats, self.rules, mode="sp")
        self.assertEqual(scored["breakdown"]["terrain_dual"], 0)
        self.assertEqual(scored["breakdown"]["terrain_niche"], 1)

    def test_map_ammo(self):
        feats = _minimal_features(map_ammo=1)
        self.assertEqual(score_features(feats, self.rules)["breakdown"]["map"], 1)
        feats2 = _minimal_features(map_ammo=3)
        self.assertEqual(score_features(feats2, self.rules)["breakdown"]["map"], 2)

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

    def test_great_ability_attacker(self):
        pts, meta = score_abilities(
            self.rules,
            "Attack",
            ["Overboost\nIncreases attack by 20%"],
        )
        self.assertEqual(pts, 2)
        self.assertEqual(meta["great"], 1)

    def test_letter_and_bucket(self):
        self.assertEqual(letter_for_total(self.rules, 18), "S+")
        self.assertEqual(bucket_for_letter(self.rules, "S+"), "no_regrets")
        self.assertEqual(bucket_for_letter(self.rules, "A"), "good")
        self.assertEqual(bucket_for_letter(self.rules, "B"), "better_options")
        self.assertEqual(bucket_for_letter(self.rules, "D"), "dont")

    def test_support_r4_debuffs(self):
        feats = _minimal_features(role="Support", support_debuffs_range4_count=0)
        self.assertEqual(score_features(feats, self.rules)["breakdown"]["support_r4_debuffs"], -1)
        feats2 = _minimal_features(role="Support", support_debuffs_range4_count=2)
        self.assertEqual(score_features(feats2, self.rules)["breakdown"]["support_r4_debuffs"], 1)

    def test_pilot_tag_points(self):
        self.assertEqual(pilot_tag_count_points(self.rules, 1), 0)
        self.assertEqual(pilot_tag_count_points(self.rules, 2), 1)
        self.assertEqual(pilot_tag_count_points(self.rules, 4), 3)
        self.assertEqual(pilot_tag_count_points(self.rules, 10), 6)

    def test_pilot_ranged_and_recommend(self):
        feats = {
            "role": "Attack",
            "tag_count": 4,
            "skill_blobs": ["Focus\nIncreases attack by 10%"],
            "ability_blobs": [],
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
        self.assertEqual(scored["breakdown"]["tags"], 3)
        self.assertEqual(scored["breakdown"]["series_affinity"], 3)
        self.assertEqual(scored["breakdown"]["recommend_ms"], 6)  # S=5 + multi bonus
        self.assertEqual(scored["breakdown"]["ranged"], 6)
        self.assertGreaterEqual(scored["total"], 20)

    def test_strong_attacker_golden_total(self):
        """Hand-built strong attacker — verify deterministic total."""
        feats = {
            "role": "Attack",
            "tag_count": 8,  # +3
            "terrain": {"Space": 3, "Atmospheric": 3, "Ground": 2, "Sea": 1, "Underwater": 1},
            # dual +2, niche +1
            "has_transform": True,  # +1
            "map_ammo": 2,  # +2
            "ability_blobs": ["Boost\nIncreases ATK by 15%"],  # +2 great
            "has_linked_pilot": True,
            "linked_pilot_very_good": True,  # +1
            "has_shield": True,  # +1
            "HP": 92000,  # +1
            "ATK": 12100,  # +2
            "DEF": 8700,  # +1
            "MOB": 9600,  # +2
            "MOV": 5,  # +1
            "weapon_range": 5,  # +2
            "weapon_power": 6000,  # +3
            "has_max_tension_higher_weapon": False,
            "has_preemptive": True,  # +1
            "has_rare_debuff": False,
            "has_extra_life": False,
            "max_debuff_pct": 0,
            "support_debuffs_range4_count": 0,
            "ssp_weapon_conditional_count": 0,
        }
        scored = score_features(feats, self.rules, mode="sp")
        # 3+2+1+1+2+2+1+1 + hp1+atk2+def1+mob2+mov1+wr2+wp3+pre1 = 26
        self.assertEqual(scored["breakdown"]["tags"], 3)
        self.assertEqual(scored["total"], 26)
        self.assertEqual(scored["letter"], "S+")
        self.assertEqual(scored["bucket"], "no_regrets")


def _minimal_features(**overrides):
    base = {
        "role": "Attack",
        "tag_count": 0,
        "terrain": {"Space": 1, "Atmospheric": 1, "Ground": 1, "Sea": 1, "Underwater": 1},
        "has_transform": False,
        "map_ammo": 0,
        "ability_blobs": [],
        "has_linked_pilot": False,
        "linked_pilot_very_good": False,
        "has_shield": True,
        "HP": 85000,
        "ATK": 11200,
        "DEF": 8200,
        "MOB": 9000,
        "MOV": 4,
        "weapon_range": 4,
        "weapon_power": 4500,
        "has_max_tension_higher_weapon": False,
        "has_preemptive": False,
        "has_rare_debuff": False,
        "has_extra_life": False,
        "max_debuff_pct": 0,
        "support_debuffs_range4_count": 0,
        "ssp_weapon_conditional_count": 0,
    }
    base.update(overrides)
    return base


if __name__ == "__main__":
    unittest.main()
