# Prep notes — EW Wing update (2026-07-31)

Preview-only; IDs TBD when master data lands. Implement after ingest.

---

## 1. UR Altron Gundam (EW) (EX) — **Limited unit**

**Preview weapons**
- Dragon Fang EX — Special, range 1–4, Power 5800  
  Absolute Hit · Ignore weapon attribute DR · Inflict “Damage Taken from Special Weapons Up **25%**” [1 turn]
- Dragon Fang — MAP, Power 3800  
  Absolute Hit · Physical Taken Up 15% [1 turn] · After move

**Ability → CP**
- Title: `(When Supporting) Physical Weapon Increased Max Range LV 1`
- Body: When Support Attack/Counter, Physical Weapon max range **+1**
- Action: treat as **CP** (title already matches `(when supporting)` marker in `trait_title_implies_conditional_stat_bonuses`). Confirm `_parse_weapon_max_range_increases_from_text` picks up “max range of Physical Weapon is increased by 1” → physical weapons get +1 max range when CP on.

**Pilot exclusive passive (like `1125001450`)**
- Pilot: **Chang Wufei (EW)** when piloting Altron (EW)(EX), Vigor Supercharged+
  - Melee **+15%**
  - **Additively improve “increased Special Damage taken” weapon effects by 5%**
- With PEP: Dragon Fang EX special debuff **25% → 30%** (detail + Damage Sim)
- Wire via existing `_collect_pilot_weapon_effect_additive_bonuses` / `dmg_spec` once master text matches “improve … weapon effects by N% additively”

**Limited**
- Add unit id to `LIMITED_TIME_UNIT_IDS` in `app.py` when known (recommend char will pull Wufei into limited chars if linked).

---

## 2. UR Chang Wufei (EW) — **Limited character**

**Preview**
- EX: Support Attack/Counter +1; Wing Series: MP +5, damage dealt +15%
- Unit-gated (Altron EW EX + Supercharged+): Melee +15%; special-taken weapon effects **+5% additive**
- `(When supporting) Increased ATK LV 5` — Support type: +25% ATK on Support/Counter
- Skill: MP Up LV 5 (+7 MP)

**Limited**
- Expect via recommend link from Altron in `LIMITED_TIME_UNIT_IDS`, or add char id explicitly to `LIMITED_TIME_CHARACTER_IDS` if recommend link is missing.

---

## 3. UR Gundam Heavyarms Custom (EW) (EX)

**Ability → CP**
- Title: `(EN Conditions) Increased ATK and Critical Rate & Increased EN Cost LV 2`
- When **EN ≥ 75%**:
  - ATK **+20%**
  - Critical Rate **+10%**
  - EN Cost **+40%**
- Action: force into **CP** bucket. **Gap today:** `(en conditions)` is **not** in `trait_title_implies_conditional_stat_bonuses` — add EN-condition title markers (EN/TW/JP) tomorrow so ATK/Crit land in `stats_with_cond`, not base.

**EN cost calculation (once weapon `en_cost` known)**
```
EN_display_CP_on = round/ceil? (base_en_cost × 1.40)
```
- Apply **only when CP on** (EN ≥ 75% assumed).
- Absolute values TBD after master weapon EN lands; verify in-game rounding (likely ceil or floor to int).
- **Gap today:** no parser for “Increase own EN Cost by N%” on unit weapons/detail/DC — add if we show adjusted EN on detail/DC when CP on.

**Full Burst Attack EX — remaining-EN weapon power**
- Preview: Absolute Hit · Ignore attr DR · “The higher your remaining EN is, the greater Weapon Power increases (**up to 12%**)”
- Like HP/distance/MP power scalers in Damage Sim.
- **Gap today:** `_dcParseWeaponTraits` has `hpPowerMax` / `mpPowerMax` / `distPowerMax` only — **no `enPowerMax`**. Tomorrow:
  1. Parse EN remaining power text (EN/TW/JP) → `enPowerMax: 12`
  2. Apply max in `_dcComputedWeaponPowerForLevel` (same pattern as HP/MP)
  3. UI trait line for remaining-EN power

**Other preview**
- Barrage MAP 3600 Absolute Hit; Full Burst range 2–5, Power 5400

**Limited?** Not called out as limited in prep — treat as normal unless pickup flag says otherwise.

---

## 4. UR Trowa Barton (EW) — **not limited**

- EX (Wing Series): damage dealt +15%, weapon EN consumption −25%
- Skills: Attack Burst LV 4 (+20% dmg 1T); EN Charge Lite LV 3 (Restore EN 15%)
- No special code expected; do **not** add to limited lists.

---

## 5. UR Milliardo Peacecraft & Libra — **not limited supporter**

**Leader skill** (“highest value applies” — already `_resolve_supporter_leader_skill_applies`)
- Wing Series → all stats **+20%** (except EN)
- Wing Series **&** Mobile Suit Gundam Wing Endless Waltz → all stats **+30%** (except EN)
- Team Builder: unit with both tags must get **30% only** (not stacked). Same pattern as dual-tier leaders (e.g. IBO / Alaya-Vijnana).

**Support skill**
- EN Restoration: allies in range Restore EN **50%** — same skill pattern as **`1430000550`** (Atra Mixta & Hotarubi). Leader tiers are the Milliardo-specific part; EN restore is the Atra-like piece.

**Limited**
- Do **not** mark limited (leader % alone must not trip limited-supporter heuristics incorrectly).

---

## Tomorrow checklist

| # | Item | Touch points |
|---|------|----------------|
| 1 | Ingest master + images | data pipeline / CDN |
| 2 | Altron CP physical range +1 | `app.py` CP range (verify text match) |
| 3 | Wufei PEP special-taken +5% | PEP parsers; detail + DC |
| 4 | Limited: Altron + Wufei | `LIMITED_TIME_UNIT_IDS` (+ char if needed) |
| 5 | Heavyarms: `(EN conditions)` → CP | title markers; ATK/Crit in cond stats |
| 6 | Heavyarms: EN cost ×1.40 when CP | detail/DC EN display if desired |
| 7 | Full Burst: remaining EN power up to 12% | `app.js` `_dcParseWeaponTraits` + power compute |
| 8 | Trowa: not limited | skip limited lists |
| 9 | Milliardo TB leader 20/30 | verify applies + highest-value; not limited |

More details expected with live master text/IDs.
