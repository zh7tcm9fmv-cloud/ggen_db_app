# Master League Simulator (`/mls`) — owner playbook

**Audience:** you explaining the tool to users / community.  
**Code:** `static/js/ml_sim.js` (UI, fight playback, `/cal` damage, Formation Optimizer) + `static/js/ml_sim_rules.js` (movement, combat queue, MP / SA / SD / CS / MAP / Cond:Area).  
**Rules port:** `ml_sim_rules.js` is a client port of **gge-simulator.jp** `battle.js` (distance, BFS move, support limits, combat waves). No local `battle.js` tree on this machine — treat the port comments + `scripts/audit_ml_sim_rules.mjs` as the gge audit harness.  
**Last audited:** 2026-11-03 against EN/TW `m_help.json` + live rules code. Re-run: `node scripts/audit_ml_sim_rules.mjs`.

---

## One-sentence pitch

`/mls` is a **client-side auto-battle twin** of Master League: you set both teams (enemy left / ally right), pick season board + LB/OP/supporter, then the sim moves and fights for you using the same **Damage Calculator (`/cal`)** numbers plus gge-style turn rules.

It is **not** the live game server and **not** a guarantee of Master League ranked points.

---

## What players can do

| Surface | What it is |
|--------|------------|
| **Formation** | 5+1 slots per side (units + supporter). LB, option part, pilot. Drag slots to change LINE map positions. |
| **Battle** | Auto-play map: move → combat → floats / HP / vigor. Pause, speed, SKIP, RESET. |
| **Area aura toggle** | Cond:Area rings (e.g. Neo Zeong EX) on/off for visibility. Combat still applies aura damage math when relevant. |
| **Formation Optimizer** | Tries ally **slot order** permutations only; keeps the fastest clear under a fixed RNG seed. |
| **Password gate** | Soft lock via `GGEN_MLS_PASSWORD` (Railway / env). Default when unset: `ggenmls`. Empty env = gate off. |

Roster saves in browser `localStorage` (`ggen_mls_roster_v3`).

---

## How a battle runs (user-facing flow)

1. Pick **season** → board spawn points + season buff % + terrain flavor (Ground / Space).  
2. Fill **enemy** (left) and **ally** (right).  
3. **SIMULATION START** → READY? GO!! → units act until wipe or turn limit.  
4. End card: victory / defeat / draw.

**Turn order (sim):** every living unit on **both** sides acts once per turn, sorted by **Mobility + Reaction** (higher first).  
This is **not** the official phase script (Your → Friendly → Enemy → Third). Say: *“We use a single shared MOB timeline so both sides fight under the same AI.”*

**Per unit (simplified):**

1. Supporter heal skill may fire once per side (HP threshold).  
2. Optional character skill (small fixed set: Repair, Force Guard, Range Boost, Sway, MP Up, damage boosts…).  
3. Chance Step loop if stock remains.  
4. MAP weapon check (special).  
5. Else: pick lowest-HP enemy in move+range → walk (4-dir) → fight.

---

## Distance, move, targeting

- **Distance** = Manhattan gap between **footprints** (large units size 2). Not Chebyshev.  
- **Move** = 4-direction BFS. Allies are passable; enemies block.  
- **Target** = lowest **current HP** among enemies you can still reach with some non-MAP weapon.  
- **Weapon pick** = highest estimated damage via `/cal` (with a fallback if cal collapses to raw power).

---

## Combat inside one engagement

Waves (gge order), then sorted by Mobility+Reaction inside a wave:

| Wave | What |
|------|------|
| 0 | Preemptive Strike |
| 1 | Support Attack |
| 2 | Main attack |
| 3 | Support Counter |
| 4 | Counter |

**Support Defense:** highest-HP ally with remaining SD stock, within move (+ SD range bonus), who **can enter the ally’s space** (Terrain Capabilities — matches EN/TW help). Takes the hits with defend ×0.8 or Shield ×0.6.

**Hit / crit / EN / ammo / tension gates** follow the rules module; damage body is `/cal` with live MP (Vigor), ML season buff, LB, OP, supporters, terrain index, defending/shield flags, SA flag.

If Cond:Area auras from the **opposing** side apply to the attacker’s weapon (attr + attack type), damage is scaled after `/cal` (`ceil(dmg * (100 + auraPct) / 100)`).

---

## MP / Vigor (戰意)

**Bands (same as `/cal`):**

| MP | EN | TW |
|----|----|----|
| 0–3 | Normal | 一般 |
| 4–7 | High | 強勢 |
| 8–11 | Max | 超強勢 |
| 12 | Supercharged | 超一擊 |

**LANG (`m_help`) says MP goes up when you land a hit or perform SA/SD; down when you take a hit or your attack is evaded.**

**What the sim does on a resolved hit:**

| Event | MP |
|-------|-----|
| Attacker lands hit | +1 |
| Target takes hit (not SD) | −1 |
| SD body takes hit | +2 |
| Attacker misses (evade) | −1 |
| Kill | **+4** main, **+1** if Support Attack / Support Counter |

So a main kill is **+1 (hit) +4 (kill) = +5**; SA kill is **+1 +1 = +2**.

> **Honesty note:** kill +4 / +1 is from the **gge-sim** port (完全撃破-style), **not** listed as separate bullets in official Vigor help. If a user asks “is that exact live ML?”, say we match gge-sim / our twin, and Bandai’s help text only lists the general actions.

**Battle-start MP:** parses “Increase MP by N” / JA・TW equivalents + unit-skill MpBoost (trait type 12), same family as `/cal`.

---

## Support Attack / Support Defense (支援攻擊 / 支援防禦)

**Stock per turn:** sum of ability lines like “Support Attack / Support Counter +N time(s)” / “Support Defense +N” (EN/JA/TW/HK). Tension and detail conditions are live.

**Important fidelity gaps (tell advanced users):**

1. **Role baseline** — Official help: Support-type / Durability-type characters “typically have” SA / SD. The **dossier** often gives role base 1. The sim **does not** auto-add that base; it only counts **written +N lines**. A Durability pilot with no “+1 time(s)” text can show **0 SD** in `/mls`.  
2. **Max 3 SA/SC per combat** — EN/TW help: *“Up to three allied units…”* / *「單次對戰中最多允許三架…」*. The sim currently queues **all** eligible SA/SC with stock (no hard cap of 3).  
3. SA order uses **Mobility + Reaction** (help stresses Mobility; Reaction is the same tie-break family as turn order).

HUD labels on the map: **S. Attack** / **S. Defense** (not SD/SA abbreviations).

---

## Chance Step (額外行動) & MAP (MAP兵器)

- Kill → Chance Step for the killer if stock remains (character limit; ability text can raise it).  
- **MAP kill does not grant Chance Step** (matches help).  
- Auto / Guaranteed Chance Step types from help are only partially covered (unconditional stock path exists; full live special CS types are not a complete twin).

MAP: no normal move-after (except specials coded), uses map footprint cells + facing where present.

---

## Cond:Area (e.g. Neo Zeong EX)

- Master traits → server `sim_effects` (`weapon_power_pct` + range, optional pilot `aura_buff_value_addition`).  
- Example stack: NZ −20% on matching beam+ranged area + Full Frontal −15 addition → **−35** on matching weapons (asserted in audit script).  
- Battle map paints purple WeaponArea tiles (tinted `#571e9f`); toggle does not remove combat math.

---

## Formation Optimizer

- Permutes **filled ally LINE slots only** (≤120 orders).  
- Same seeded RNG every try (`rngState = 1`) so hit/crit luck is comparable.  
- Prefers: win → fewer turns → lower enemy HP after turn 1 → higher ally HP left.  
- Does **not** re-pick pilots, LB, OP, or enemy formation.

---

## Damage source (`/cal`)

Always explain: *“Numbers come from the same Damage Simulator engine as `/cal`, with Master League season buff and the unit’s live Vigor.”*

Fallback if pilot JSON missing or cal unavailable: weapon power only (weaker fidelity).

---

## What we intentionally do **not** simulate (yet)

Say these clearly when users compare to the app:

- Full official **phase** structure (Your / Friendly / Enemy / Third)  
- Player micro-control (manual move, weapon choice, defend/evade)  
- Transform / Rearm / Escape / full Mechanisms beyond Shield  
- Parry, Lock On vs Sway interactions (Sway is partially handled)  
- Full Unit Skill activation UI mid-battle  
- Live Master League **score table** (`rankedPoints` exists in rules but is not the optimizer score)  
- Server-authoritative ML matchmaking / ranking

---

## Glossary (in-game LANG)

| Concept | EN | JA (common) | TW | HK note |
|---------|----|-------------|----|---------|
| Vigor | Vigor | テンション | **戰意** | |
| Normal / High / Max / Supercharged | same | 普通 / 強気 / 超強気 / 超一撃 | 一般 / 強勢 / 超強勢 / 超一擊 | |
| Chance Step | Chance Step | チャンスステップ | **額外行動** | not 先制 |
| Support Attack | Support Attack | 支援攻撃 | **支援攻擊** | |
| Support Counter | Support Counter | 支援反撃 | **支援反擊** | |
| Support Defense | Support Defense | 支援防御 | **支援防禦** | |
| Preemptive Strike | Preemptive Strike | 先制攻撃 | **先發攻擊** | |
| MAP Weapon | MAP Weapon | MAP兵器 | **MAP兵器** | |
| Beam | Beam | ビーム | **光束** | HK **鐳射** |
| Damage (noun) | damage | ダメージ | **損傷** | |
| Critical | Critical | クリティカル | **爆擊** | |
| Mechanisms / Shield | Shield Defense | シールド | 盾牌防禦 | |

---

## Audit checklist (for you / agents)

### Matches LANG / MD well

- [x] Vigor bands + hit/miss/take-hit MP directions  
- [x] MAP: no CS on MAP kill  
- [x] Preemptive wave + attacker priority when both preempt  
- [x] SD blocked by terrain occupancy (help wording)  
- [x] SA order by mobility (plus reaction)  
- [x] Cond:Area typed effects from MasterData  
- [x] Damage through `/cal` + ML buff  

### Known gaps vs LANG (priority if users push)

| Gap | Severity | Notes |
|-----|----------|--------|
| No role-default SA/SD stock | High | Text-sum only |
| No 3-unit SA/SC cap | Medium | Help is explicit |
| Kill MP +4/+1 | Medium | gge; not in help bullets |
| Shared MOB timeline vs phase model | Medium | Product choice |
| Parry / Lock On / transform / etc. | Low–Med | Document as out of scope |

### gge-sim

- Rules header + combat queue / BFS / support math = intentional gge twin.  
- Re-verify kill MP and any new systems against a fresh gge decode when available.  
- Regression: `node scripts/audit_ml_sim_rules.mjs` (must print `ml sim rules audit OK`).

---

## Short reply templates

**“Is this the real Master League?”**  
> It’s a practice twin: same season boards and `/cal` damage, with auto AI for both sides. It doesn’t replace the game’s ranked match or phase UI.

**“Why didn’t my Durability pilot SD?”**  
> The sim only counts Support Defense **+N** lines on the kit. Role alone doesn’t grant a free use yet — if the dossier shows SD from role but the ability text has no +times line, `/mls` may show 0.

**“Why so many Support Attacks?”**  
> Official help caps participants at three per combat; the twin currently lets every in-range ally with stock join. We’re tracking that gap.

**“Where do the damage numbers come from?”**  
> The Damage Simulator (`/cal`) with Master League buff and live Vigor/MP.

**“What does Formation Optimizer do?”**  
> It only reshuffles your five LINE slots, re-sims with the same random seed, and keeps the order that clears fastest.

---

## Key files / APIs

| Piece | Location |
|-------|----------|
| UI / fight / optimizer | `static/js/ml_sim.js` |
| Rules | `static/js/ml_sim_rules.js` |
| Panel markup | `templates/_ml_sim_panel.html` |
| Styles | `static/css/ml_sim.css` |
| Board API | `/api/master_league/sim_board?event_id=` |
| Unlock | `/api/ml_sim/status`, `/api/ml_sim/unlock` |
| Env | `GGEN_MLS_PASSWORD` |
| Audit | `scripts/audit_ml_sim_rules.mjs` |
