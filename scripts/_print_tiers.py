import json
from pathlib import Path

d = json.load(open(Path(__file__).parent / "output/tier_mockup_v2.json", encoding="utf-8"))

def print_section(title, key, fmt):
    print(f"\n{'='*60}\n{title}\n{'='*60}")
    for t in ("SSS", "SS", "S", "A"):
        rows = sorted(d.get(key, {}).get(t, []), key=lambda r: (-r["score"], r["name"]))
        print(f"\n## {t} ({len(rows)})")
        for r in rows:
            print(fmt(r))

print_section(
    "GACHA UR (EX) UNITS — meta tier",
    "units_meta",
    lambda r: (
        f"- {r['name']} [{r['role']}] score {r['score']}"
        f" | ER {r.get('coverage',{}).get('adj_pct')}%"
        + (" | LIMITED" if r.get("is_limited_time") else "")
        + (f" | pilot: {r['top_pilots'][0]['name']}" if r.get("top_pilots") else "")
        + (f" | supp: {r['top_supporters'][0]['name']} ({r['top_supporters'][0]['leader_pct']}%)" if r.get("top_supporters") else "")
    ),
)

print_section(
    "UR CHARACTERS — meta tier",
    "characters_meta",
    lambda r: (
        f"- {r['name']} [{r['role']}] score {r['score']}"
        + (" | LIMITED" if r.get("is_limited_time") else "")
        + (" | Chance Step x2" if r.get("special", {}).get("chance_step_x2") else "")
        + (" | Supp Def x2" if r.get("special", {}).get("support_defense_x2") else "")
        + (" | Supp Atk x2" if r.get("special", {}).get("support_attack_x2") else "")
        + (
            f" | squad buff: +{r['special']['squad_buffs'][0]['atk_pct']}% ATK for {', '.join(r['special']['squad_buffs'][0].get('condition_tags',[])[:2])}"
            if r.get("special", {}).get("squad_buffs") else ""
        )
    ),
)

print_section(
    "UR SUPPORTERS — meta tier",
    "supporters_meta",
    lambda r: (
        f"- {r['name']} score {r['score']}"
        f" | {r['leader_profile']['max_leader_pct']}% leader"
        f" | tags: {', '.join(r['leader_profile']['tag_names'][:3])}"
        f" | fits {r['leader_profile']['matching_units_pct']}% of units"
        + (" | LIMITED" if r.get("is_limited_time") else "")
    ),
)
