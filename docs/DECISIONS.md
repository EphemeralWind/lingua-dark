# Decisions log

Settled in the design discussion:

- **Dialect:** Castilian Spanish from Spain. `vosotros` included, es-ES voice, Spain vocabulary.
- **Saving:** local only for now. Accounts and cross-device sync are deferred.
- **Strike timing:** the strike resolves the moment the player locks in an answer, or when the window closes with no answer.
- **Fleeing:** a started fight cannot be fled.
- **Focus:** removed. Guessing is discouraged by taking the hit, a one-in-four random-guess success rate, stance refill on hits, and the typed riposte.
- **Reading choices:** signposts and notes in exploration count as untelegraphed contexts for mastery.
- **Boss gate:** the locked door in front of a boss's arena. It opens when at least 80% of the zone's components are Learned.

Still open:

- Whether Hollow mode (no timers) counts toward mastery or only progress.
- Whether 80% is the right gate threshold.
- Which pixel font covers á é í ó ú ñ ü ¿ ¡.

Add new entries below as you make them. Format: date, what you chose, why.

### 2026-11-17: Kickoff readings (spec ambiguities)

Each entry: what was ambiguous, the reading picked, and why. Revisit any of them if the design says otherwise.

**Rules and anti-shortcut**

1. **Seven rules vs nine.** CLAUDE.md lists seven non-negotiables; SPEC §4 lists nine anti-shortcut rules. The seven in CLAUDE.md are the binding, tested list. SPEC §4's extra items (feints test reading, guessing is costly, the litmus test) are design intent that the seven already cover. *Why:* CLAUDE.md calls itself the override.
2. **Feint flicker vs "identical wind-up".** A feint flicker does change the wind-up, which looks like it breaks rule 1. Reading: rule 1 means the wind-up must not depend on the question or the answer. Feint flicker is drawn from an animation RNG stream seeded separately from the question/shuffle stream. Its direction and timing are uniform and never read the answer. The blind bot sees the flicker and must still score at chance. *Why:* this keeps feints in the game without leaking anything.
3. **Direction shuffle.** Each strike's correct direction is drawn uniformly and independently. There is no "don't repeat last direction" rule, because that would let a bot score 1/3 by avoiding the last strike direction. The strike animation reveals the correct direction after lock-in, so this independence matters.
4. **Text-shape leak (beyond the spec's blind bot).** A language-blind player can still read card *shapes*. For example, with `levanta / levantas / levantan / levanto`, the answer is the prefix of two other cards. Reading: distractor sets are drawn so that, given the four shown forms, each one is equally likely to be the answer. In practice: pick the answer's feature value uniformly (person first, then a pronoun for that person, so 3sg is not twice as likely just because él and ella both exist), then take a uniform random subset of the paradigm that contains the answer. M1 adds a second bot to the blind-bot suite that uses only card text features (length, shared prefixes, edit-distance medoid) and must also score at chance. *Why:* rule zero is "not winnable without Spanish". The animation-only bot is necessary but not sufficient.
5. **Strike index.** `EncounterState.strike` is the index of the *blank* in a combo, not of an answer. That is allowed. Answers are only ever referred to by `Direction`.
6. **Render reads a view, not state.** The renderer and the blind bot both consume the same `EncounterView` projection. During wind-up, that type has no `correct` field at all. *Why:* the rule is then enforced by the type system, not by discipline.

**Combat**

7. **Combo windows.** "2.5 s per blank" means each blank gets its own 2.5 s window (× zone factor), as SPEC §3.4 says. It is not a shared total.
8. **Combo clear bonus.** `COMBO_CLEAR_BONUS` = 0.25 × `stanceMax`, not 25% of current stance. It applies only if every strike in the combo was parried.
9. **Stance break mid-combo.** Stance clamps at 0 and the break happens right away. Remaining strikes of that combo are skipped. The riposte uses the full sentence with all its blanks.
10. **Riposte.** It uses the sentence of the question that broke stance, with every blank of that question as a typed field. It is untimed in M1 and submitted with Enter. Each correct word deals `RIPOSTE_DAMAGE_PER_WORD`. A wrong word deals nothing and shows the correction. Afterwards stance resets to `stanceMax` and a new exchange starts. Enemy HP only drops during ripostes.
    - *Known risk, kept as spec:* the riposte word was on the winning card moments earlier, so it can be copied. A blind player rarely gets that far, because expected stance change per guessed exchange is 0.25·25 − 0.75·20 ≈ −8.75. Revisit at playtest.
11. **Riposte matching.** Matching ignores case and surrounding whitespace. In Zone 1 it accepts a missing acute accent or diaeresis (á é í ó ú ü) but shows the correction. `ñ` is a separate letter, so `n` for `ñ` is wrong.
12. **Quality on a hit or timeout.** `quality` is still computed (0 on timeout) and stored in `resolving`, but only parries use it.
13. **Hits.** A hit deals the attack's damage tier and refills stance by `HIT_STANCE_REFILL`, capped at `stanceMax`.
14. **Grab "unblockable except by answering".** No special rule. Every attack is blocked only by answering. The phrase is flavour that stresses no dodge exists. Flasks still apply.
15. **Inputs outside wind-up** (during resolving, riposte, or before the first wind-up) are ignored as directions. During the riposte, keys go to the hidden `<input>`, so WASD typing does not fire directions.
16. **Lock-in timestamp.** Input events carry `performance.now()` taken in `platform` when the event fires, and q uses that time. q is not quantised to the 60 Hz step.
17. **Type extensions.** SPEC §9 types are kept as a subset. `windup` gains `startMs` (the wind-up is time-stretched, so it needs progress). `resolving` gains `question` and `untilMs`. An `Encounter` wrapper holds `enemy`, player `vitality`, `attack`, `state`, and the RNG streams.
18. **New tunables.** These are not in the design doc and go into `tuning.ts` marked "default (not in design doc)": `RESOLVE_MS` = 600 (strike/parry animation before the next wind-up), `RIPOSTE_RESULT_MS` = 800, and the damage tier per attack type (jab low, overhead high, delayed medium, grab high, sweep medium, combo medium per strike, per SPEC §3.3).
19. **Attack ids.** `AttackType = 'jab' | 'overhead' | 'delayed' | 'grab' | 'sweep' | 'combo'`, matching `zone1-rooms.json`. These map to `Question.kind` as vocab, grammar, translate, listen, order, combo.

**Content**

20. **Article slots with no `agreesWith`.** `t_definite_article` and `t_indefinite_article` leave out `agreesWith`. Reading: an article slot always agrees with the noun that follows it, and a missing `agreesWith` defaults to the next noun slot. *Why:* the `tests` field (`art:definite:{gender}:sg`) already assumes agreement.
21. **"Change exactly one feature" vs three distractors.** An article blank that varies gender and number has only two one-feature neighbours (`la` → `el`, `las`). Reading: distractors come from the paradigm cells spanned by the template's `vary` list (here `el`, `las`, `los`). One-feature errors are preferred when there are more cells than needed. This also gives the symmetric sets that decision 4 wants.
22. **Pattern spacing.** `{art:definite}{noun}` has no space in the pattern. The generator joins adjacent slot tokens with one space. The tight spacing is kept so contractions (`a el` → `al`, `de el` → `del`) can be added later.
23. **Component id format.** CLAUDE.md uses `v_levantar:present:3sg` and `art:definite:f`, while templates use `verb:{verb}:present:{person}` with person keys such as `el`. Canonical form: `v_levantar:present:3sg` (persons map yo→1sg, tu→2sg, el→3sg, nosotros→1pl, vosotros→2pl, ellos→3pl), `art:definite:f:sg` (number kept, since the plural template tests it separately), and `n_manzana:plural`. M2 makes a targeted edit to the `tests` strings in templates.json to match. This is an edit, not a rewrite.
24. **Template placeholders.** `{person}` / `{person1}` means the person of `subj` / `subj1`, and `{gender}` means the gender of the noun the blank agrees with.
25. **No English glosses in the lexicon.** Jab (vocab) and delayed swing (translate) need an English prompt, and the lexicon has none. M1's hand-written questions carry their own English. M2 adds a `gloss_en` field to lexicon entries (extending the file) and flags it for review.
26. **Content to flag for native review** (not changed now):
    - Mass nouns (`vino`, `leche`, `sopa`) in `t_plural_object` give odd sentences (`las leches`). M2 should add a `mass` tag and exclude those nouns from plural templates.
    - `mirar` + animals (`lobo`, `cuervo`) may want personal *a* (`al lobo`).
    - Feminine nouns with stressed initial *a* (`agua`, `hacha`) take `el` and need an exception tag before any are added.
    - The `r1_chapel` sign "La puerta del norte está cerrada" sits next to an open north exit. Read it as referring to the boss gate further on.
27. **Reading choices need a correct exit.** Signs have no machine-readable answer. M3 adds an optional `reading: { correct: Direction, components, wrongCost }` to room contents. Signs without it are flavour and record nothing.
28. **`$back` after a shortcut.** `$back` is whichever room the player last came from. After entering the cellar through the bonfire shortcut, both `$back` and `north` lead to the bonfire. That is acceptable.

**Mastery**

29. **Blind rounds happen in combat.** CLAUDE.md says combat answers never mark Learned, but SPEC counts "blind rounds where the enemy is hidden" (such as the boss's blind phase) as untelegraphed. Reading: blind-round answers count toward mastery even inside a fight. The exclusion covers ordinary exchanges with a visible enemy and attack icon.

**Milestone 1 scope**

30. **Playwright smoke in M1.** Prompt 1 lists only dev/build/typecheck/lint/test, but CLAUDE.md requires `test:e2e`. It is added in M1. The smoke test loads `/?seed=N`, recomputes the correct directions in Node from the same pure content module and seed, and presses them. No debug hook exposes answers in the page. Dependency: `@playwright/test`, needed for the required smoke test.
31. **Text before the pixel font exists.** M1 draws text with `fillText` on the scaled display canvas (crisp, full accent support), not on the 320×180 buffer. The pixel font choice stays open until M4.
32. **M1 question set.** 20 hand-written questions using only seed-lexicon Spanish: jab, overhead, delayed (no feint yet), and one two-blank combo. No grab in M1, because it needs audio. Directions are assigned when a question is drawn, not stored in the hand-written data.

### 2026-11-17: Milestone 1 build

33. **Blind-bot bound is one-sided.** The test asserts each bot scores at most 25% + 2 points, matching "no better than chance". A bot well *below* chance could be exploited by doing the opposite, so each such text bot also has its complement tested ("anything but the longest card", and so on). *Why:* the longest-card bot scores about 22%, because the combo's fixed answers (levanta, llevo) are short. That is not a leak. Measured rates for all 12 bots fall between 21.9% and 26.8%.
34. **JSON imports use `with { type: 'json' }`.** Playwright's Node loader requires it, and Vite and TypeScript accept it. This lets the smoke test import the same pure content module the game uses.
35. **Smoke-test hook.** The page writes `data-phase`, `data-question` (`id#seed`, the same tag printed on screen for bug reports), `data-strike` (blank index) and `data-deadline` on `<body>`. None of these is the answer. The test recomputes the answer from the seed in Node.
36. **What the riposte asks you to type.** You type each strike's correct card text. For vocabulary that is the article and noun (`el libro`). For translation it is the whole sentence. Punctuation and case are ignored.
37. **State additions.** `EncounterState` adds `idle` (before `start`) and `riposteResult` (shows the verdicts for `RIPOSTE_RESULT_MS`) to SPEC §9's union.
38. **Hidden tab.** Wind-up deadlines run on real time, so if the tab is hidden during a wind-up, the strike times out as a hit. This is acceptable for M1. Pausing on `visibilitychange` belongs with Hollow mode and settings in M4.
39. **Text-shape residue from the fixed combo.** The combo always asks 3sg and 1sg, which tilts the deck slightly toward short, prefix-shaped answers. The "prefix of most other cards" bot measures 26.8%, inside the bound. Generated content in M2 picks persons uniformly, which removes this.

### 2026-11-17: Milestone 2 build (procedural content)

40. **Uniform answers, feature first.** The generator draws each subject's person uniformly and then a pronoun of that person. It draws each noun's gender uniformly, then a verb that can take a noun of that gender (slot rule), then the noun. Distractors are a uniform random subset of the blank's paradigm. Given the four cards on screen, each is equally likely to be the answer. The deck gives every template equal weight, so the singular and plural article templates balance each other. `t_indefinite_plural` was added for the same reason: with only the singular indefinite template, `unos`/`unas` would never be the answer and a bot could rule out half the cards. A generator test checks the answer spread inside each card set over the deck mix.
41. **Combo distractors leave out the other subject's person.** In `Ella ___ la espada y yo ___ el escudo.`, blank 2's cards never include the 3sg form, and blank 1's never include the 1sg form. Otherwise, once blank 1 is revealed (`levanta`), a player could rule out the blank-2 card with the same ending (`lleva`) without knowing any Spanish. The blind-bot suite has an "avoid / match the ending of the last revealed answer" bot pair for this.
42. **The deck draws templates independently, not in shuffled passes.** With passes, the template just used cannot come up again until the pass ends, so the previous answer predicts the next template. The "avoid the last ending" bot scored 33% on singular article questions (26.6% overall). Independent uniform draws bring it to 23.8%. All 14 blind bots now measure 23.8% to 25.7%.
43. **"Prefer realistic learner errors."** Distractors come only from the errors a template varies: wrong person for verbs, wrong gender or number for articles, another word for vocabulary. They are not weighted toward the "most common" error, because weights that depend on the answer would let the card set reveal it (#40). Article blanks always show the whole paradigm, so `el espada` is always a card for `la espada`. The fourth card changes two features (`los` for `la`), per #21. Any candidate whose text is also a correct answer is dropped (tested with a fake verb whose yo and él forms are the same).
44. **Capitalisation.** A pattern ending in `.`, `?` or `!` is a sentence: its first letter is capitalised (skipping `¿ ¡`), so `Tú`, `Él`. A bare phrase (the vocabulary card `la espada`) stays lower case. If a sentence opens with a blank, the four cards are capitalised instead of the following word.
45. **Schema and build check.** zod is a dev dependency, used only at build time and in tests. The game bundle imports schema *types* only (checked: no zod in `dist`). `validate.ts` adds the cross-reference checks: pattern ↔ slots, `requires` → verb slot, `agreesWith` / `distinctFrom` / `distinctPersonFrom` targets, every `tags` / `excludeTags` / verb `takes` tag carried by some noun, every noun slot fillable under the slot rule, blanks and `vary` lists, `tests` and `gloss_en` placeholders, pronouns for all six persons, room exits, doors, and items. A Vite plugin runs it in `buildStart`, so `npm run build` and `npm run dev` fail on bad content. `vite-node` (already in the tree through vitest, now pinned) runs `npm run review-pack`. `@types/node` is referenced only from that script.
46. **Template format extensions** (additions, nothing removed): noun-slot `tags` / `excludeTags`; template `gloss_en` (English prompt pattern); `blanks: ["$sentence"]` for a whole-phrase answer, with `vary: ["lemma"]` (vocabulary) or two features making a 2x2 grid (translation, as in #4); pronoun `gloss_en`; lexicon `gloss_en` (#25). A verb agrees with the nearest subject before it. Test strings now use the canonical ids from #23 (`{verb}:present:{person}` → `v_levantar:present:3sg`, `{noun}:plural` → `n_manzana:plural`).
47. **Mass nouns (#26).** `sopa`, `vino` and `leche` are tagged `mass` and excluded from the plural and indefinite templates. `mirar` + animal (`miro el lobo` vs `al lobo`) is unchanged and listed as a question in the review pack.
48. **Hand-written questions removed.** Jab, delayed swing, overhead and combo questions all come from the eight Zone 1 templates. The bug-report tag is now `templateId#seed`, and `questionFromTag` rebuilds the question from it (the smoke test uses it).
49. **Accepted residue, revisit at playtest.** The blind bots see card text only. A player reading the sentence can pick up shallow cues: a noun ending in `-s` takes a plural article, `-a` usually takes `la`, and some vocabulary words are cognates (`vino`, `sopa`, `torre`). Picking these up is learning the grammar the question tests, so this is not treated as a leak. The litmus playtest should watch for it.
