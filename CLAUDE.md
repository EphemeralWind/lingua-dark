# Lingua Dark (working title)

A third-person pixel-art action game that teaches Spanish. Every enemy attack is a question, and answering correctly is the parry. Runs in a desktop browser, written in TypeScript, drawn on one Canvas 2D element with no game engine.

Read `docs/SPEC.md` before writing code. It holds the rules, numbers, types, and milestones. Build milestone by milestone with `docs/PROMPTS.md`.

## The one rule that matters most

The game must not be winnable without knowing Spanish. Nothing on screen may reveal the correct answer before the player locks in. If a change makes a language-blind player able to clear a fight, the change is wrong.

Non-negotiables:

1. The enemy wind-up animation is identical for every question and every answer direction until the player locks in or the window closes. Only then do the strike and parry animations play.
2. Answers are four directions (north, east, south, west), reshuffled every exchange. Never refer to answers by array index in game logic.
3. A small HUD icon may name the attack type. It must never carry anything about the answer.
4. No rhythm skill: the answer is the parry. Earlier answers parry better, but there is no narrow timing window.
5. Distractors are plausible near-misses (same verb other person, wrong gender or number). Never include a form that is also correct.
6. Mastery (Learned) is paused while the bonfire is a lesson hub (DECISIONS #96). If it returns, it counts only answers in untelegraphed contexts, such as exploration reading choices. Combat answers update the review schedule only and never mark a component Learned.
7. The `blind-bot` test must pass in CI: a bot that sees only animation state and card positions scores no better than chance (25% on four cards, with a tolerance defined in the test).

## Stack and commands

- TypeScript (strict), Vite, Vitest, ESLint, one Playwright smoke test.
- No game engine and no UI framework. Add a dependency only when the task needs it, and say why.
- Scripts to keep working: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`.

## Architecture rules

- Layout: `src/platform` (renderer, input, audio, assets), `src/scenes` (world, combat, title), `src/combat` (encounter state machine, timing), `src/content` (generator, distractors, rng, data/*.json), `src/learning` (components, scheduler, mastery), `src/save` (store).
- Pure-logic modules (`combat`, `content`, `learning`, `save` logic) must not touch the DOM, Canvas, `window`, or `performance.now()`. They take an injected clock and a seeded RNG, so they run under Vitest with no browser.
- Only `platform` and `scenes` touch the browser. Answer deadlines use `performance.now()` read in `platform` and passed in, never frame counts.
- No `Math.random()` in game logic. Use the seeded RNG in `src/content/rng.ts`. Every generated question stores its seed so a bug report reproduces the exact sentence.
- Fixed 60 Hz update steps, render with `requestAnimationFrame`.
- All tunable numbers live in one `src/tuning.ts`, named after the table in `docs/SPEC.md`. Do not scatter magic numbers.
- Content is JSON in `src/content/data`, validated against a schema at build and in tests. A template that references a missing tag must fail the build, not the game.

## Spanish content rules

- Default dialect is Castilian Spanish from Spain (es-ES voice, `vosotros` included, Spain vocabulary such as ordenador).
- The review system tracks knowledge components (a word form or a grammar feature), not sentences. Example ids: `v_levantar:present:3sg`, `art:definite:f`.
- Regular combat uses procedurally generated sentences from the tagged lexicon and templates. Bosses, NPC dialogue, signs, and lore are static, hand-written text.
- Slot rule: a verb's `takes` tags must intersect the noun's `tags`, so a knight can lift a sword but not a river.
- Every template needs an automated agreement test over many seeds (start at 1,000).
- All Spanish text is a draft until a native speaker reviews it. Do not invent Spanish beyond the seed data without flagging it in the PR description.
- No live AI generation of content at runtime.

## Rendering and art

- Internal canvas 320 x 180, scaled by whole numbers (4x to 1280 x 720, 6x to 1920 x 1080), letterboxed otherwise, nearest-neighbor, no smoothing.
- Use programmatic placeholder art (flat colored shapes) until real sprites exist. Real art arrives as a PNG sprite sheet plus a JSON atlas (Aseprite export), loaded at startup.
- The pixel font must include á é í ó ú ñ ü ¿ ¡. Verify this before choosing one.
- All art is original. Do not copy characters, items, or layouts from existing games.
- Accessibility is not optional: no meaning by color alone, a reduced-motion setting, larger text, and a Hollow mode with no timers.

## Working agreements

- Work one milestone at a time. Plan first, then implement, then run typecheck, lint, and tests before saying you are done.
- Write the test with each module. Pure logic gets unit tests; the encounter state machine gets a fake-clock test.
- Small commits with clear messages. Do not rewrite the seed data files wholesale; extend them.
- If the spec is silent or contradictory, pick the simplest reading, note the choice in `docs/DECISIONS.md`, and continue.
- Values marked "default (not in design doc)" in `docs/SPEC.md` are placeholders to tune, not rules.
