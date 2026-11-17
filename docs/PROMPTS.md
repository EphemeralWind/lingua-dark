# Prompts for Claude Code

## How to use this kit

1. Create an empty repo and copy this kit into its root (`CLAUDE.md`, `docs/`, `src/content/data/`).
2. Open Claude Code in the repo. It loads `CLAUDE.md` automatically.
3. Run the prompts below in order, one per session, in plan mode first. Commit between milestones.
4. If a prompt's acceptance criteria are not met, say so and continue the same session until they are.

Milestones match the roadmap in `docs/SPEC.md` section 11.

---

## Prompt 0: Kickoff (read and plan, no code yet)

```
Read CLAUDE.md, docs/SPEC.md, and the three JSON files in src/content/data.
Then reply with:
1. The game in five sentences, in your own words.
2. The seven non-negotiable anti-shortcut rules, restated.
3. Anything in the spec that is ambiguous or contradictory, with the simplest reading you would pick for each.
4. A file-by-file plan for milestone 1.
Do not write code yet. Record the readings you pick in docs/DECISIONS.md.
```

---

## Prompt 1: Milestone 1, Engine (weeks 1 to 2)

```
Build milestone 1 from docs/SPEC.md: one playable fight with placeholder art.

Scaffold:
- Vite + TypeScript (strict), Vitest, ESLint, and scripts: dev, build, typecheck, lint, test.
- src/ layout exactly as CLAUDE.md describes.
- src/tuning.ts holding every constant from the tuning table in SPEC section 3.8.
- src/content/rng.ts: a seeded RNG (e.g. mulberry32). No Math.random in game logic.

Platform:
- A 320x180 offscreen canvas scaled by whole numbers with smoothing off, letterboxed.
- Fixed 60 Hz update with requestAnimationFrame rendering.
- Input: arrow keys, WASD, and clicks on cards all produce a Direction.

Combat (pure logic, no DOM):
- The EncounterState machine from SPEC section 9, driven by an injected clock.
- Wind-up, lock-in, resolve (parry or hit), stance drain with the floor, stance refill on hit, combo handling, riposte typing, win and lose.
- Hand-written list of 20 questions is fine for now; one of them a 2-blank combo.

Scene:
- Placeholder art only: flat colored shapes for player (seen from behind), enemy, four cards at N/E/S/W, a deadline bar, a stance bar, a vitality bar.
- The wind-up must be visually identical for every question and direction. Strike and parry animations play only after lock-in.

Tests:
- Encounter state machine with a fake clock, including combos and stance math.
- A blind-bot test: a bot that sees only animation state and card positions plays 1,000 seeded fights and must stay within a stated tolerance of 25% correct.

Acceptance: npm run typecheck, lint, and test pass; I can play one fight start to finish in the browser; the blind-bot test passes.
```

---

## Prompt 2: Milestone 2, Content (weeks 3 to 4)

```
Build milestone 2: the procedural Spanish content system.

- A JSON schema (or zod) for lexicon.json, templates.json, and zone1-rooms.json, validated at build time and in tests. A template referencing a missing tag must fail the build.
- src/content/generator.ts: given a template, a seed, and the lexicon, produce a Question (SPEC section 9) with strikes, components, and the seed. Enforce the slot rule: verb.takes must intersect noun.tags. Capitalize sentence starts correctly.
- src/content/distractors.ts: change exactly one feature (person, gender, or number), never include a form that is also correct, and prefer realistic learner errors (el espada for la espada).
- Handle combos: each blank gets its own four cards, and the two subjects use different persons.
- Tests: every template over 1,000 seeds checking agreement, slot rule, no duplicate or correct-by-accident distractors, and that the same seed reproduces the same question.
- A script `npm run review-pack` that writes docs/review/zone1-sentences.md with 200 generated sentences (with their blanks and answers) for a native speaker to check.
- Replace the hand-written questions in the fight with generated ones.

Do not invent Spanish beyond the seed data. If you need a new word, add it to lexicon.json with tags and list it in your summary for review.

Acceptance: all tests pass, the review pack builds, and fights now use generated questions.
```

---

## Prompt 3: Milestone 3, Learning and world (weeks 5 to 6)

```
Build milestone 3: review, mastery, bonfires, and the world.

Learning (pure logic):
- Knowledge components and the Leitner scheduler from SPEC section 6 (boxes with intervals 1, 3, 7, 14, 30 days, injected clock).
- Mastery: a component is Learned only after two correct answers in untelegraphed contexts on different days. Combat answers update the schedule but never mark Learned.
- The question picker draws from the player's due components first.

Game systems:
- Bonfire scene: save, refill flasks, short review round (untelegraphed), respawn normal enemies.
- Ghosts: missed components return as ghost enemies, max three per room.
- Echoes: dropped XP on death, recovered by beating the enemy that killed the player (it asks the same target word).
- Flasks grey out two wrong answers.
- Save store: localStorage with JSON export and import. Local only.

World:
- A world scene that walks the room graph in zone1-rooms.json using the four directions, with '$back', locked shortcut doors, and the boss gate.
- Signs shown as Spanish text. Choosing an exit after reading a sign records a reading choice as an untelegraphed answer.
- The boss gate opens when at least 80% of the zone's components are Learned (GATE_THRESHOLD in tuning.ts).
- A map screen that reveals rooms as they are visited.

Acceptance: tests for scheduler, mastery, and gate logic pass; I can walk the Zone 1 graph, rest at the bonfire, die, recover echoes, and see the gate stay locked until mastery is reached.
```

---

## Prompt 4: Milestone 4, Art, audio, and settings (weeks 7 to 8)

```
Build milestone 4: replace placeholders and add polish.

- A sprite sheet + JSON atlas loader. Keep working with placeholder atlases if real art is not ready.
- Directional animations: the enemy strike and recoil and the player parry and hit, one set per direction with the east set mirrored for west. The wind-up is one shared animation time-stretched to the answer window.
- UI: prompt at 2x scale, cards at the four cardinal points with arrow marks, deadline bar, stance bar, attack-type icon.
- Effects: 3-frame parry flash, hit-stop of HIT_STOP_MS, and a distinct shape for high-quality parries.
- Audio: Web Audio effects and ambient loop; speechSynthesis with an es-ES voice and a text-only fallback; visual cue for every audio cue except listening grabs.
- Font: pick a pixel font and prove with a test page that it renders á é í ó ú ñ ü ¿ ¡.
- Settings: reduced motion, larger text, and Hollow mode (no timers).
- Zone 1 boss with the three phases from the spec, including the blind phase.

Acceptance: the whole Zone 1 slice is playable, accessibility settings work, and the blind-bot test still passes after the art changes.
```

---

## Prompt 5: Milestone 5, Playtest and tuning (weeks 9 to 10)

```
Prepare milestone 5.

- Add local-only playtest logging (no network): per exchange, question kind, answer time, correctness, and whether the player was in Hollow mode. Export as JSON.
- Write docs/PLAYTEST.md with a protocol for the litmus test: a skilled gamer with no Spanish tries the first boss. Include what to record and how to decide pass or fail.
- Write a tuning report script that reads the logs and prints per-attack accuracy, median answer time, and stance-break rate, so windows and stance drain can be tuned.
- Fix anything the blind-bot test or the litmus test finds.

Acceptance: logs export, the report script runs on sample data, and docs/PLAYTEST.md exists.
```

---

## Utility prompts

### Audit for shortcut leaks

```
Audit the codebase against the seven non-negotiable rules in CLAUDE.md. For each rule, list the files and functions that enforce it and any place it could be violated. Check especially: anything in the render loop that varies with the correct answer before lock-in, any use of array index for answers, any Math.random in game logic, and any distractor that could also be correct. Propose fixes and add tests for what you find.
```

### Extend to Zone 2

```
Add Zone 2 (The Drowned Library) per SPEC section 6: ser and estar, adjective agreement, and tener and ir. Extend lexicon.json and templates.json (do not rewrite them), add a zone2 room graph, and add agreement tests for the new templates. Flag every new Spanish word and sentence for native review.
```

### Prepare the native-speaker review

```
Generate docs/review/ with: all lexicon entries as a table (lemma, gender, plural, forms), 300 generated sentences, every static string from the room graphs and signs, and a checklist for the reviewer (agreement, naturalness, Spain usage, accents and punctuation). Do not change any content.
```
