---
name: ggen-motion
description: >-
  GGen Eternal Database motion design — Corporate UI personality, CSS-only,
  transform/opacity on hot paths. Use when adding or changing animations,
  transitions, modal entrances, micro-interactions, or reviewing motion UX.
  Extends LottieFiles motion-design-skill with site performance constraints.
---

# GGen motion design

## Personality

**Corporate** (database / tools): 200–400ms, no overshoot, MD3-style ease-out entrances.

| Token | Value | Use |
|-------|-------|-----|
| `--motion-ease-enter` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Modals, panels, cards appearing |
| `--motion-ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` | Dismissals |
| `--motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Buttons, toggles, hover |
| `--motion-dur-quick` | `120ms` | Hover, press feedback |
| `--motion-dur-standard` | `220ms` | Icons, toggles |
| `--motion-dur-modal` | `320ms` | Modals, overlays |
| `--motion-interactive` | see `static/css/ui_motion.css` | Chrome controls (not `all`) |

**Playful** spring (`--ui-spring`) is reserved for Ko-fi promo, notice pulse rings, and rubber-band range sliders only.

## Hard rules (performance)

1. **Browse first** — never animate browse grid row entrance, list recycle, or block first paint for motion.
2. **GPU-only on hot paths** — `transform` + `opacity` only for modals/overlays; no `width`/`height`/`margin` animation.
3. **No new JS animation libraries** — no GSAP, Framer, Lottie runtime on `/` or browse tabs.
4. **Never `transition: all`** on new chrome — use `--motion-interactive` or explicit property lists.
5. **`prefers-reduced-motion`** — spatial motion → opacity fade only; kill infinite loops.
6. **Stagger budget** — total sequence < 500ms; no stagger on 50+ list rows.
7. **One lever at a time** — measure `/`, browse, detail after motion changes; rebuild `app_shell_bundle.min.css` when `ui_motion.css` changes.

## Where motion lives

- `static/css/ui_motion.css` — tokens, modals, overlays, chrome transition overrides (bundled last)
- `static/css/kofi_donate_promo.css` — Playful promo bubble (isolated)
- Search spotlight — reference pattern for overlay + card entrance

## Checklist before shipping motion

- [ ] Properties limited to transform/opacity (or color/border on chrome only)
- [ ] Entrance uses `--motion-ease-enter`; exit uses `--motion-ease-exit`
- [ ] Reduced-motion block added or extended in `ui_motion.css`
- [ ] No change to `app.js` browse/instantBrowse paths unless unavoidable
- [ ] `node scripts/build_shell_css.mjs` run after CSS edits

## Reference

Upstream principles: [LottieFiles/motion-design-skill](https://github.com/LottieFiles/motion-design-skill) (philosophy, not runtime).
