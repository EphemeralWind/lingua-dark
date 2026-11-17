# Progress

Handoff notes between sessions. Update at the end of each milestone. For the reasoning
behind each choice, see `docs/DECISIONS.md`. Numbers like #4 refer to entries there.

## Status

| Milestone | State | Commit |
| --- | --- | --- |
| 0. Kickoff readings | Done | in `bd260db` (DECISIONS #1–32) |
| 1. Engine: one playable fight | Done | `bd260db` |
| 2. Content: procedural Spanish | Done, waiting for native review | `c332f2e`, `d1d64d2` |
| 3. Learning and world | Not started | |
| 4. Art, audio, settings | Not started | |
| 5. Playtest and tuning | Not started | |

All checks pass at `d1d64d2`: `npm run typecheck`, `npm run lint`, `npm test` (120 tests),
`npm run build`, `npm run test:e2e`, `npm run review-pack`.

## Milestone 1: Engine (done)

One fight, playable start to finish in the browser (`npm run dev`, then press Enter). Placeholder art only.

- **Scaffold:** Vite, strict TypeScript, Vitest, ESLint, one Playwright smoke test. ESLint bans
  `Math.random` everywhere and browser globals (`window`, `document`, `performance`, …) in the pure
  dirs `combat`, `content`, `learning`, `save`.
- **`src/tuning.ts`:** every constant from SPEC 3.8, plus the M1 additions (#18): `RESOLVE_MS`,
  `RIPOSTE_RESULT_MS`, `PERFECT_PARRY_Q`, `PARRY_FLASH_MS`, `UPDATE_STEP_MS`.
- **`src/content/rng.ts`:** mulberry32 seeded RNG (`next`, `int`, `pick`, `shuffle`, `nextSeed`).
- **Platform:**
  - `renderer.ts`: a 320×180 buffer, scaled by whole numbers, letterboxed, no smoothing. Text
    is drawn with `fillText` on the display canvas until a pixel font is chosen (#31).
  - `loop.ts`: fixed 60 Hz updates, drawn with requestAnimationFrame.
  - `input.ts`: arrows, WASD and card clicks, each stamped with `performance.now()` (#16).
  - `riposteInput.ts`: the hidden `<input>` for typing.
- **Combat (pure):**
  - `encounter.ts`: the state machine. States are idle, windup, resolving, riposte,
    riposteResult, won, lost (#17, #37).
  - `timing.ts`: answer windows × zone factor, parry quality, stance drain with its floor, damage tiers.
  - `riposte.ts`: answer matching. Accents are forgiven in Zone 1; `ñ` is not (#11).
  - `view.ts`: the projection the renderer and the blind bot both read. During a wind-up it has
    no `correct` field at all (#6).
- **Scene:** `src/scenes/combat.ts` draws flat shapes: player from behind, enemy, four cards,
  deadline/stance/vitality bars, an attack icon, parry/hit flashes. Marks use shapes as well as colour.
  The `<body>` data attributes (`data-phase`, `data-question`, `data-strike`, `data-deadline`) feed the
  smoke test and never hold the answer (#35).
- **Tests:**
  - `encounter.test.ts`: fake-clock tests (21), covering combos, stance math, riposte, win and lose.
  - `blind-bot.test.ts`: animation bots and text-shape bots, 1,000 seeded fights each. Each
    must score ≤ 25% + 2 points and win no fights (#33). It also checks that the wind-up looks
    identical for every question and direction.
  - Smoke: loads `/?seed=12345`, rebuilds the answers in Node from the seed, and clears the fight (#30).
- M1 used 20 hand-written questions (#32). M2 replaced them.

## Milestone 2: Content (done; gate = native review)

- **Content JSON**, extended, not rewritten:
  - lexicon: `gloss_en` on every entry, `mass` tag on sopa/vino/leche.
  - templates: pronoun `gloss_en`, `excludeTags`, canonical `tests` ids, and three new templates.
    The eight Zone 1 templates are now present_object, definite_article, indefinite_article,
    plural_object, indefinite_plural, combo_two, vocab_noun, translate_object.
- **Pipeline** (`src/content/`):
  - `schema.ts`: zod shapes (dev only; runtime imports types only).
  - `validate.ts`: cross-reference checks.
  - `vite.config.ts` plugin: runs validation, so bad content fails `build` and `dev` (#45).
  - `pattern.ts`: pattern parsing.
  - `template.ts`: slot links and structural errors.
  - `generator.ts`: template + seed + content → `Question` (plus `fills` for tests).
  - `distractors.ts`: picks the wrong cards.
  - `deck.ts`: independent uniform template draws, plus `questionFromTag("id#seed")`.
- **Anti-shortcut:**
  - Features are drawn first and distractors are uniform subsets of the paradigm, so each card
    in a set is equally likely to be the answer (#40).
  - Combo blanks leave out the other subject's person (#41).
  - The deck doesn't use shuffled passes, because passes leaked the next template (#42).
  - Blind bots (14 now) measure 23.8%–25.7%.
- **Tests:**
  - `generator.test.ts`: every template over 1,000 seeds, against an independent re-render. It
    checks agreement, the slot rule, tag filters, capitalisation, clean cards (no duplicates, no
    correct-by-accident) and component ids. Also uniformity checks and reproducibility with fresh content.
  - `validate.test.ts`: 19 kinds of broken content, each rejected.
  - Also `distractors.test.ts` and `deck.test.ts`.
- **Review pack:** `npm run review-pack` (vite-node) writes `docs/review/zone1-sentences.md`: 200
  sentences with a reviewer checklist and open questions.

## Open items and known risks

- **Native review pending.** Milestone 2's gate needs a native speaker to go through
  `docs/review/zone1-sentences.md`. Its open questions: `mirar` + animal (`al lobo`?), which nouns
  are mass nouns, whether `unos/unas` + plural sounds natural, and the `tocar`/`llevar` glosses.
- Accepted risks, to watch at the playtest:
  - Riposte words can be copied from the card that just won (#10).
  - A reader can pick up shallow sentence cues and cognates (#49).
  - The tab hidden during a wind-up times out as a hit (#38).
- A content change changes what each seed produces (#50).
- Not built yet: grab (listening/audio), sweep (word order), feints, flasks, echoes, ghosts,
  bonfire, world, save, settings, pixel font.

## Next: Milestone 3 (Learning and world)

Follow Prompt 3 in `docs/PROMPTS.md`. Hooks already in place:
- Every `Question` carries canonical `components` (`v_levantar:present:3sg`,
  `art:definite:f:sg`, `n_manzana:plural`, `n_espada`). The scheduler can key on them.
- `createDeck(rng, templates)` is the seam for a question picker that serves due components
  first. It will need a way to target a component (for example, constrain a template's fills),
  which the generator doesn't support yet.
- Mastery counts only untelegraphed answers (CLAUDE.md rule 6, #29). Reading choices need the
  `reading` field on room contents described in #27.
- `src/learning/` and `src/save/` are empty placeholders. `zone1-rooms.json` is validated but
  not used by any scene yet.
