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
| 4. Art, audio, settings | Done (placeholder art; real sprites pending) | `dc82e6f`–`e71e126` (branch `m4-art-audio-settings`) |
| 5. Playtest and tuning | Not started | |

All checks pass at the end of M4: `npm run typecheck`, `npm run lint`, `npm test` (372 tests),
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

## Milestone 4: Art, audio, settings, boss (done)

`npm run dev`, then `/` (world), `/?seed=N` (practice fight), `/font-test.html` (font proof).
Decisions #77–#90.

- **Sprites:**
  - `platform/atlas.ts`: Aseprite JSON parser (hash or array), atlas layout, a loader for
    `/art/atlas.json` and `SpriteBank`, which draws real art first and falls back to the
    placeholder sheet per character and tag.
  - `platform/placeholderArt.ts` paints every frame from `platform/characters.ts` (player 48×64,
    enemies 64×64, boss 128×112) with flat shapes.
  - `combat/sprites.ts` picks frames from the Animation alone. Frame counts follow SPEC 8. West
    mirrors east. The wind-up is one shared 6-frame animation stretched over the window.
  - Wardens wear a crown and a seal diamond. Ghosts are hollow outlines.
- **Font:** `platform/font.ts` is an original bitmap font (#78). The renderer draws it in whole
  screen pixels: body text at 1x, the prompt at 2x (#79). `font.test.ts` checks coverage, including
  every string literal in `src` and the content JSON.
- **Fight UI** (`scenes/fight.ts`):
  - the 2x prompt on a dark band, and the cards at N/E/S/W with arrow tabs and glyphs;
  - the deadline bar, the stance bar under the enemy, the attack icon (all six types), and FLURRY n/m for boss chains;
  - a 3-frame parry flash, the hit-stop, a four-point star for clean parries, and a hit cross;
  - an arena with depth bands and three layers.
- **Audio:**
  - `platform/audio.ts`: synthesised effects and an ambient loop with a mood per scene.
  - `combat/cues.ts`: cues derived from the view, and `CUE_VISUAL`.
  - `CuePlayer` in `scenes/services.ts` shows a ♪ caption for every sound.
  - `platform/speech.ts`: es-ES only, else text-only. What is spoken and when: #80.
- **Settings** (`save/settings.ts`, `scenes/settingsMenu.ts`, key O): reduced motion, larger text,
  Hollow mode, sound effects, music, speech. `platform/gameTime.ts` pauses the game clock for a
  hidden tab and the open menu (#83).
- **Encounter:** `chain` (boss flurries, #77) and `untimed` (Hollow, #82). The Animation gains
  `resolved`.
- **Boss:**
  - `world/boss.ts` builds the three phases from `phaseDecks` in the rooms JSON.
  - `game.ts` chains three encounters with title cards, carrying vitality between them.
  - The blind phase hides the enemy, the icon and the strike animation, and records its answers as `blind`.
  - `bossesBeaten` is saved, and the boss can hold an echo.
- **Blind bots:** 14 bots × 9 arenas: the whole deck, three wardens, three boss phases, and the whole deck in Hollow mode.
  - Boss phases and Hollow mode measure 23.8%–25.9%, with no wins.
  - The wind-up identity test now also compares sprite frames and sound cues, with and without chain or Hollow.
- **Verified by hand with throwaway browser scripts** (not kept as tests):
  - The font page shows every glyph with nothing missing.
  - A save at the gate with all seals → walk into the arena → all three phases cleared by answering
    from the question tags → the arena is silent afterwards. Blind-phase answers created mastery days.
  - The settings menu toggles and saves. In Hollow mode a wind-up was still open after 9 s. Larger text works.
  - Reduced motion removes the full-screen flash and keeps the steady parry ring and star.

### After M4: hand-drawn art sample (#91)

- `art/` holds hand-drawn sprites: the player (48×64, from behind) and the Hollow Monk warden
  (64×64, crown and seal diamond), every SPEC 8 tag. `npm run build-art` writes
  `public/art/atlas.{json,png}`; `art/art.test.ts` checks tags, sizes, the crown in every warden
  frame, PNG round-trip, and that the committed files match a fresh build.
- Review: `/art-test.html` (drawn vs placeholder, `?scale=N`), `/?seed=N&enemy=hollow_monk`.
- Player revision (#92): shield and readied sword drawn in front of the body (hidden where the
  body covers them), and a new `guard` tag for the fight stance with the sword readied.
- The rest of the cast (#93), drawn after the designer approved the sample:
  - Hollow Villager: pitchfork, hunched, torn tunic.
  - Hollow Smith: pot helm with embers behind the slit, apron, sledgehammer.
  - Whisperer (warden): floating pointed hood, the cellar's great key.
  - Crow (warden): feather mantle, bone beak, billhook.
  - Ghost: a see-through villager with a spear.
  - The Hollow Bell (boss, 128×112): a living bronze bell with a maul. It cracks and sinks when it dies.

  Every character now has hand-drawn art. The room backdrops are still drawn in code.

## Open items and known risks

- **Native review pending** (M2 gate) for `docs/review/zone1-sentences.md`. M4 adds no Spanish:
  the boss name, phase names, captions and settings are English UI.
- **Real art:** all eight characters are hand-drawn (#91, #93). Room backdrops are still drawn in code. An artist's Aseprite
  export with tags `<character>/<animation>` (see `requiredTags` and `CHARACTERS`) can replace
  `public/art/atlas.{json,png}`; missing tags fall back to placeholders.
- **Design questions:**
  - Hollow mode and mastery: provisionally no effect (#82). Designer to confirm.
  - Grab (listening) attacks: matching sound to written cards may be possible without Spanish (#89).
    Needs a design before it is built. Feints, sweep, NPC dialogue and items are also not built.
  - Tune `BOSS_CHAIN`, `BOSS_PHASE_HP`, the perk table and `WARDEN_HP` at playtest.
  - Only one sign has a reading choice (#62). More need hand-written, native-checked Spanish.
  - Reading components (`w_*`) count toward the profile but are outside the 120 shown as Learned.
- Accepted risks, to watch at the playtest:
  - Riposte words can be copied from the card that just won (#10).
  - A reader can pick up shallow sentence cues and cognates (#49).
- A content change changes what each seed produces (#50).
- Translation questions show `___` as the whole sentence, even after the answer is revealed. The
  answer is on the ✓ card and is spoken.

## Next: Milestone 5

Follow Prompt 5 in `docs/PROMPTS.md`. Notes:
- Log `settings.hollow` per exchange (the setting is live in `Services.settings`).
- The litmus test now has a real boss: `r1_boss_arena`, three phases, the last one blind.
