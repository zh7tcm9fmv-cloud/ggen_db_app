"""Dissect sheet Pilot SP picks for objective kit properties (no video priors)."""
from __future__ import annotations

import csv
import os
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(r"c:\Users\Mikew0911\Desktop\ggen_db_app")
sys.path.insert(0, str(ROOT))
os.chdir(ROOT)
os.environ.setdefault("GGEN_TIER_USE_BUNDLED_EN", "1")

import app as A  # noqa: E402
from sp_investment_rank import (  # noqa: E402
    build_er_expert_filters,
    collect_character_ability_effects,
    collect_character_skill_effects,
    entity_eligible_on_stage,
    load_rules,
)

CS_SA_SD = {19, 80, 85, 51, 52, 86, 87, 90}


def norm(n: str) -> str:
    n = re.sub(r"^(SSR |SR |UR2? )", "", n)
    n = re.sub(r"\s*\(SP\)\s*", "", n)
    return re.sub(r"\s+", " ", n).strip().lower()


def main() -> None:
    rules = load_rules()
    ld = A.LANG_DATA.get("EN") or {}
    idx: dict[str, tuple[str, str]] = {}
    for cid in A.char_info_map:
        nm = A._wn_char_name(cid, ld) or ""
        if nm:
            idx[norm(nm)] = (cid, nm)

    def find(name: str):
        key = norm(name)
        if key in idx:
            return idx[key]
        for k, v in idx.items():
            if key in k or k.startswith(key):
                return v
        return None

    filters = build_er_expert_filters(A, "EN")
    expert = [f["id"] for f in filters]
    restricted = [f["id"] for f in filters if not f.get("character_free_for_all")]
    free = [f["id"] for f in filters if f.get("character_free_for_all")]
    print(f"stages={len(expert)} restricted={len(restricted)} free={len(free)}")

    picks = []
    with (ROOT / "_sheet_export" / "pilot_sp.csv").open(encoding="utf-8") as f:
        rows = list(csv.reader(f))
    for row in rows[7:]:
        for role, ni, ri in (("Attack", 1, 2), ("Support", 3, 4), ("Defense", 5, 6)):
            if len(row) > ni and row[ni].strip() and row[ni].strip() != "Free":
                picks.append(
                    (
                        row[0],
                        role,
                        row[ni].strip(),
                        row[ri].strip() if len(row) > ri else "",
                    )
                )

    reason_tok: Counter[str] = Counter()
    ab_types: Counter[int] = Counter()
    sk_types: Counter[int] = Counter()
    rarities: Counter[str] = Counter()
    elig_r_vals = []

    print("=== SHEET PICKS OBJECTIVE PROFILE ===")
    for series, role, name, reason in picks:
        hit = find(name)
        if not hit:
            print("MISS", name, reason)
            continue
        cid, nm = hit
        info = A.char_info_map.get(cid) or {}
        rar = str(info.get("rarity") or "")
        rarities[rar] += 1
        abils = collect_character_ability_effects(A, cid, "EN", rules)
        skills = collect_character_skill_effects(A, cid)
        elig_r = sum(
            1
            for sid in restricted
            if entity_eligible_on_stage(A, cid, sid, "character", "EN")
        )
        elig_a = sum(
            1
            for sid in expert
            if entity_eligible_on_stage(A, cid, sid, "character", "EN")
        )
        elig_r_vals.append(elig_r)
        cs = []
        for e in abils:
            tti = int(e.get("trait_type_index") or 0)
            ab_types[tti] += 1
            if tti in CS_SA_SD:
                cs.append(
                    {
                        "tti": tti,
                        "val": int(e.get("trait_value") or 0),
                        "name": e.get("ability_name"),
                        "cond": bool(e.get("has_active_cond")),
                    }
                )
        sk_tti = []
        for e in skills:
            tti = int(e.get("trait_type_index") or 0)
            sk_types[tti] += 1
            sk_tti.append(tti)
        for tok in re.findall(
            r"2cs|2sa|2sd|Mp Up|dmg boost|Sway|force guard|\d{3,}\s*(?:range|melee|awaken|def)",
            reason,
            flags=re.I,
        ):
            reason_tok[tok.lower()] += 1
        print(
            f"{nm:28} rar={rar:4} sheet={role:8} ERr={elig_r}/{len(restricted)} "
            f"ERa={elig_a} CS={cs} skill_tti={sk_tti} :: {reason}"
        )

    print("\nReason tokens", reason_tok)
    print("Rarities", rarities)
    print("Ability types", ab_types.most_common(15))
    print("Skill types", sk_types.most_common(15))
    if elig_r_vals:
        elig_r_vals.sort()
        print(
            "Sheet pick restricted ER: "
            f"min={elig_r_vals[0]} p50={elig_r_vals[len(elig_r_vals)//2]} "
            f"max={elig_r_vals[-1]} avg={sum(elig_r_vals)/len(elig_r_vals):.2f}"
        )

    print("\n=== Population CS/SA/SD (non-UR) ===")
    pop: Counter[str] = Counter()
    for cid, info in A.char_info_map.items():
        if str(info.get("rarity") or "") in ("5", "UR"):
            continue
        abils = collect_character_ability_effects(A, cid, "EN", rules)
        uncond = [
            int(e.get("trait_value") or 0)
            for e in abils
            if int(e.get("trait_type_index") or 0) in CS_SA_SD
            and not e.get("has_active_cond")
        ]
        if any(v >= 2 for v in uncond):
            pop["uncond_val>=2"] += 1
        elif any(v >= 1 for v in uncond):
            pop["uncond_val=1"] += 1
        elif any(int(e.get("trait_type_index") or 0) in CS_SA_SD for e in abils):
            pop["cond_or_other"] += 1
        else:
            pop["none"] += 1
    print(dict(pop))

    print("\n=== Population restricted ER hist (non-UR) ===")
    hist: Counter[int] = Counter()
    for cid, info in A.char_info_map.items():
        if str(info.get("rarity") or "") in ("5", "UR"):
            continue
        n = sum(
            1
            for sid in restricted
            if entity_eligible_on_stage(A, cid, sid, "character", "EN")
        )
        hist[n] += 1
    print(dict(sorted(hist.items())))


if __name__ == "__main__":
    main()
