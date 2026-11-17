# Progress

Handoff notes between sessions. Update at the end of each milestone. For the reasoning
behind each choice, see `docs/DECISIONS.md`. Numbers like #4 refer to entries there.

## Status

| Milestone | State | Commit |
| --- | --- | --- |
| 0. Kickoff readings | Done | in `bd260db` (DECISIONS #1–32) |
| 1. Engine: one playable fight | Done | `bd260db` |
| 2. Content: procedural Spanish | Done, waiting for native review | `c332f2e`, `d1d64d2` |
| 3. Learning and world | Done | `d944d25`–`f5af689`; `$back` fix `09b7257`; seals and meta-progression `c00868f`–`058d3eb` |
| 4. Art, audio, settings | Not started | |
| 5. Playtest and tuning | Not started | |

All checks pass at `058d3eb`: `npm run typecheck`, `npm run lint`, `npm test` (274 tests),
`npm run build`, `npm run test:e2e`.

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

## Milestone 3: Learning and world (done)

`npm run dev`, then open `/` for the world. `/?seed=N` is still the practice fight.

After the first M3 build, the designer changed two things (DECISIONS #73–#76):
- **The boss gate needs seals from wardens, not 80% Learned**, so a zone can be cleared in one
  sitting.
- **Learned is meta-progression**: a profile that survives New Game and grants perks.

The notes below describe the current state.

- **Learning (pure, `src/learning/`):**
  - `scheduler.ts`: Leitner boxes 1–5 (1/3/7/14/30 days), at most one promotion a day (#57).
  - `mastery.ts`: Learned = untelegraphed correct answers on 2 different days. Combat never
    counts; an untelegraphed miss resets the streak and un-learns (#59).
  - `learner.ts`: per-component records, `recordAnswer`, `dueComponents`.
  - `profile.ts`: the learner plus `bestLearned` (high-water mark). Survives New Game (#75).
  - `perks.ts`: `perksFor(bestLearned)` from `PERKS` in `tuning.ts`. The perks are vitality,
    riposte damage, flask power 1 → 2 (never 3), and +1 flask per rest (#74, #75).
  - `picker.ts`: due-first, ghost and echo questions by card-set membership (#58); typed review
    questions and review order (#60).
- **Content:**
  - `components.ts` enumerates the zone universe (120 for Zone 1, #68), maps components to card
    text, and splits a question's components per strike.
  - `zone1-rooms.json` has a `seals` map and `enemy.seal` on three wardens, both validated.
  - The bonfire room has a `reading` (goal "Find the well.", answer west). No new Spanish.
- **Combat:**
  - Flasks: `useFlask`, with configurable `flaskPower`; greyed cards can't be picked.
  - Configurable `riposteDamage`.
  - The exchange log carries components and `assisted` (#61).
- **World (pure, `src/world/`):**
  - `zone.ts`: exits, shortcut doors, the map layout, and `wardenSeal`. `$back` follows each
    room's own way back (`backOf`, #72).
  - `seals.ts`: `sealProgress`, `sealTemplates`, `socketLine` (#73).
  - `state.ts`: the run (visits, doors, defeated enemies, beaten wardens, seals, ghosts, echo,
    XP, flasks, readings) and the rest/die/win rules (#62–#64). Wardens never respawn.
- **Save (`src/save/store.ts`):**
  - Two localStorage keys: the run (`lingua-dark/save`, format v2) and the profile
    (`lingua-dark/profile`).
  - v1 saves migrate on load.
  - Export bundles run and profile; import validates both (#65, #75).
- **Platform:** `clock.ts` (local day plus the dev day skip), `storage.ts`, `files.ts`; input
  emits `key` events.
- **Scenes:**
  - `fight.ts`: the shared fight presenter.
  - `combat.ts`: the practice fight.
  - `game.ts`: title (with Learned and perks), explore, fights (wardens use their seal deck and
    `WARDEN_HP`), rest and review, map.
  - `review.ts`, `worldView.ts` (seal sockets ◆/◇ on the HUD, the gate and the map).
- **Controls:** arrows/WASD walk and answer. Enter fights a foe or rests at the bonfire. F
  drinks a flask. M opens the map, where E exports and I imports a save. Dev only: F8 skips a
  day, F9 marks everything Learned, F10 grants every seal.
- **Blind bots:** all 14 now play the whole deck and each seal deck: 23.8%–25.9%, no wins. The
  articles warden runs 1,500 fights, because guessers die faster there (#73). Memory bots
  against the due-first picker: 25.5% / 25.3% (#58).
- **Verified by hand with throwaway browser scripts, not kept as tests** (CLAUDE.md allows one
  Playwright test):
  - Original M3 world:
    - new game, then the reading choice
    - win at the well, then die in the cellar, which drops a 50 XP echo and three ghosts
    - beat the well again, then the cellar enemy to recover the echo
    - open the shortcut, check the gate stays shut without dev keys, then into the arena
    - flask greying and a ghost fight
  - Seals:
    - beat all three wardens with no dev keys; each asked only its own templates
    - die with a seal held: the seal and the dead warden stay
    - the gate opens into the arena
    - F9 → title lists all perks; a new run has 130 vitality and 4 flasks, and a flask greys 2
      cards

## Open items and known risks

- **Native review pending** (M2 gate) for `docs/review/zone1-sentences.md`. M3 adds no Spanish.
  The seal names and perk text are English UI.
- **Design questions raised by M3:**
  - Perk table and warden toughness (`WARDEN_HP`) need tuning at playtest. The articles warden
    asks only high-damage overheads, so it is the hardest of the three.
  - The boss fight should reuse the seal decks per phase (#73).
  - Only one sign has a reading choice (#62). More need hand-written, native-checked Spanish.
  - Reading components (`w_*`) count toward the profile, but no template teaches them, so they
    are outside the 120 shown as "Learned N/120".
  - Should Hollow mode count toward mastery? Still open.
- Accepted risks, to watch at the playtest:
  - Riposte words can be copied from the card that just won (#10).
  - A reader can pick up shallow sentence cues and cognates (#49).
  - The tab hidden during a wind-up times out as a hit (#38).
- A content change changes what each seed produces (#50).
- Not built yet: grab (listening/audio), sweep (word order), feints, boss fight and blind
  rounds (the `blind` mastery context exists but nothing records it), items, NPC dialogue,
  settings (Hollow mode, reduced motion, larger text), pixel font, real art and audio.

## Next: Milestone 4

Follow Prompt 4 in `docs/PROMPTS.md`. Notes:
- The room-entry fade in `worldView.ts` and the hit shake in `fight.ts` must respect reduced motion.
- Hollow mode (no timers) should pause wind-ups. Fixing #38 (visibility pause) fits there.
- Sprites replace the flat shapes in `fight.ts` (combat) and `worldView.ts` (rooms, map).
  Wardens need a look that sets them apart from regular enemies (today only the label does).
- The Zone 1 boss is part of Prompt 4. It should take its phase decks from
  `sealTemplates` (#73).
