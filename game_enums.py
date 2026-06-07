"""
Load Eternal.Domain.Enums registry (data/game_enums.json) for API labels and tier utility scoring.
EN is the primary display language — labels are humanized from dump OriginalName keys.
"""
from __future__ import annotations

import json
import os
import re

_BASE = os.path.dirname(os.path.abspath(__file__))
_ENUM_FILE = os.path.join(_BASE, "data", "game_enums.json")

_CACHE: dict | None = None

# TraitType weights for multi-axis tier utility scoring (0–100 scale after normalization).
TRAIT_UTILITY_WEIGHTS: dict[int, float] = {
    7: 3.0, 8: 2.5, 17: 3.5, 18: 3.0, 35: 2.0, 39: 4.0, 40: 3.5, 44: 2.5, 45: 2.5,
    49: 2.5, 62: 3.0, 73: 3.5, 79: 4.0, 80: 4.5, 85: 4.0, 94: 5.0, 100: 4.0, 107: 3.5,
    3: 2.0, 9: 2.0, 10: 2.0, 11: 2.0, 14: 2.5, 15: 2.0, 16: 2.5, 31: 2.0, 32: 2.0,
    33: 2.0, 34: 2.0, 83: 2.5, 84: 3.0, 93: 3.0,
    5: 2.0, 6: 2.0, 13: 2.5, 20: 2.5, 51: 2.5, 52: 2.5, 86: 3.0, 87: 3.0, 90: 2.5,
    38: 3.0, 75: 2.5, 88: 2.0, 89: 2.0,
    104: 2.0, 105: 2.0, 106: 2.5,
}

# MapNpcStrategyHintType dispatch (matches Eternal.Domain.Enums).
MAP_NPC_HINT_WEAPON = 1
MAP_NPC_HINT_CHARACTER_SKILL = 2
MAP_NPC_HINT_UNIT_ABILITY = 3
MAP_NPC_HINT_CHARACTER_ABILITY = 4
MAP_NPC_HINT_UNIT_HP = 5
MAP_NPC_HINT_UNIT_EN = 6
MAP_NPC_HINT_UNIT_ATTACK = 7
MAP_NPC_HINT_UNIT_DEFENSE = 8
MAP_NPC_HINT_UNIT_MOBILITY = 9
MAP_NPC_HINT_UNIT_MOVEMENT = 10

MAP_NPC_STAT_HINT_FIELDS = {
    MAP_NPC_HINT_UNIT_HP: "strategy_hint_hp_icon",
    MAP_NPC_HINT_UNIT_EN: "strategy_hint_en_icon",
    MAP_NPC_HINT_UNIT_ATTACK: "strategy_hint_atk_icon",
    MAP_NPC_HINT_UNIT_DEFENSE: "strategy_hint_def_icon",
    MAP_NPC_HINT_UNIT_MOBILITY: "strategy_hint_mob_icon",
}


def _load() -> dict:
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    try:
        with open(_ENUM_FILE, "r", encoding="utf-8") as f:
            _CACHE = json.load(f)
    except (OSError, json.JSONDecodeError):
        _CACHE = {"version": "0", "enums": {}}
    return _CACHE


def payload() -> dict:
    return _load()


def enum_entries(enum_name: str) -> dict:
    return (_load().get("enums") or {}).get(enum_name, {}).get("entries") or {}


def enum_key(enum_name: str, index: int | str) -> str:
    idx = str(int(index) if str(index).lstrip("-").isdigit() else index)
    return enum_entries(enum_name).get(idx, "")


def enum_label(enum_name: str, index: int | str) -> str:
    idx = str(int(index) if str(index).lstrip("-").isdigit() else index)
    block = (_load().get("enums") or {}).get(enum_name) or {}
    lbl = (block.get("labels") or {}).get(idx)
    if lbl:
        return lbl
    key = enum_key(enum_name, idx)
    if not key:
        return f"Unknown ({idx})"
    return re.sub(r"([a-z])([A-Z])", r"\1 \2", key).replace("_", " ")


def trait_utility_weight(trait_type_index: int) -> float:
    return float(TRAIT_UTILITY_WEIGHTS.get(int(trait_type_index or 0), 0.0))


def enrich_enum_fields(enum_name: str, index: int | str) -> dict:
    idx = int(index) if str(index).lstrip("-").isdigit() else 0
    return {
        "type_index": idx,
        "type_key": enum_key(enum_name, idx),
        "type_label": enum_label(enum_name, idx),
    }
