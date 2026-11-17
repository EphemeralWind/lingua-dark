# Lingua Dark: Implementation Spec

Distilled from the design document. Where a number is marked **default (not in design doc)**, it is a placeholder to tune, not a decision.

## 1. Summary

A third-person pixel-art action game, seen from behind the player, for adults learning Spanish at A1 to B1. Played in a desktop browser in 5 to 10 minute sessions. Every enemy attack is a question and answering it correctly is the parry.

In scope: Castilian Spanish from Spain, desktop browser, TypeScript, three planned zones, first playable slice of Zone 1 plus its boss.
Out of scope: multiplayer, mobile controls, accounts and cross-device sync, other languages, live AI generation.

## 2. Camera and input

- Camera sits behind the player and looks over their shoulder. The player's back is at the bottom center of the screen. The enemy faces the screen in the middle distance.
- Four answer cards sit at north, east, south, and west of the enemy, each marked with its arrow.
- Input: arrow keys, WASD, or a click on a card. All map to the same four directions. Directions are reshuffled every exchange.

## 3. Combat

### 3.1 Exchange loop

1. The enemy starts a wind-up. Its length is the answer deadline. The animation is identical for every question and every direction.
2. A prompt appears in Spanish (text, audio, or both) with four answer cards at the four cardinal points.
3. The player locks in an answer by pressing a direction. The strike resolves at that moment, or when the window closes with no answer.
4. The enemy's strike comes from the direction of the correct answer. If the player chose that direction, the parry connects: player parry animation plays, enemy recoils, enemy stance meter drains. Otherwise the strike lands and the player takes damage.
5. When the stance meter is empty, the riposte sequence begins. The sentence returns with its blanks and no cards. The player types the missing words. Each correct word lands one strike, so a partly right answer still hurts.
6. The enemy dies at zero HP. The player dies at zero vitality.

Fights cannot be fled once started.

### 3.2 Parry quality and stance

- Quality `q` is the share of the answer window still left when the player locks in, from 1.0 (instant) toward 0 (last moment).
- Stance drain per parry = `STANCE_DRAIN * max(q, STANCE_FLOOR)`.
- A hit on the player refills part of the enemy's stance meter, so guessing loses ground.
- There is no frame-precise window. Rhythm skill does not matter.

### 3.3 Attack types

| Attack | Question type | Base window (s) | Damage if it lands |
| --- | --- | --- | --- |
| Jab | Vocabulary: pick the Spanish word | 3 | Low |
| Overhead | Grammar: conjugation, agreement | 5 | High |
| Delayed swing | Translation, with a feint | 4 | Medium |
| Grab | Listening: audio only, no text | 5 | High, unblockable except by answering |
| Sweep | Word order: pick the correctly ordered sentence | 8 | Medium |
| Combo | Multi-blank sentence, 2 to 4 blanks, one per strike | 2.5 per blank | Medium per strike |

Windows are multiplied by a zone factor: 1.5 in Zone 1, shrinking toward 1.0 as the player advances (suggested: 1.5, 1.25, 1.0 for Zones 1 to 3).

### 3.4 Combos

- One sentence with a blank per strike, for example `Ella ___ la espada y yo ___ el escudo.`
- Blanks are answered in order, each in its own window with four fresh directional cards.
- Every strike uses the same wind-up and resolves on its own. A miss does not cancel the rest.
- Clearing every strike drains an extra 25% of the stance meter (`COMBO_CLEAR_BONUS`).

### 3.5 Feints

A delayed swing may show a fake flicker in its wind-up. The flicker is random noise, uncorrelated with the answer. Only the Spanish prompt tells the player what to answer.

### 3.6 Resources

- **Vitality:** the player's health.
- **Flasks:** three per bonfire rest. A flask greys out two wrong answers for the current question.
- **Echoes:** on death the player drops unspent XP at the spot. Recovering it means beating the enemy that killed them, which asks the same target word again.
- There is no Focus resource.

### 3.7 Bosses

Three phases per boss, each with its own stance meter and longer combos. Each phase tests one concept from the zone. The last phase hides all cues so the player must read or listen without visual help. Zone 1 boss phases: articles and gender, regular present tense, blind phase.

### 3.8 Tuning constants (`src/tuning.ts`)

| Constant | Value | Source |
| --- | --- | --- |
| `JAB_WINDOW_S` | 3 | design doc |
| `OVERHEAD_WINDOW_S` | 5 | design doc |
| `DELAYED_WINDOW_S` | 4 | design doc |
| `GRAB_WINDOW_S` | 5 | design doc |
| `SWEEP_WINDOW_S` | 8 | design doc |
| `COMBO_WINDOW_PER_BLANK_S` | 2.5 | design doc |
| `ZONE_WINDOW_MULT` | [1.5, 1.25, 1.0] | Zone 1 from design doc, rest suggested |
| `STANCE_FLOOR` | 0.25 | design doc |
| `COMBO_CLEAR_BONUS` | 0.25 of stance meter | design doc |
| `FLASKS_PER_REST` | 3 | design doc |
| `FLASK_GREYS_OUT` | 2 wrong answers | design doc |
| `HIT_STOP_MS` | 80 | design doc |
| `STANCE_MAX` | 100 | default (not in design doc) |
| `STANCE_DRAIN` | 25 (four perfect parries break stance) | default (not in design doc) |
| `HIT_STANCE_REFILL` | 20 | default (not in design doc) |
| `PLAYER_VITALITY` | 100 | default (not in design doc) |
| `DAMAGE_LOW / MEDIUM / HIGH` | 10 / 20 / 35 | default (not in design doc) |
| `RIPOSTE_DAMAGE_PER_WORD` | 15 | default (not in design doc) |
| `ENEMY_HP` | 60 for standard enemies | default (not in design doc) |

## 4. Anti-shortcut rules

1. The animation carries no answer information. The wind-up is identical for every question and every direction until lock-in or window close. Only then do strike and parry animations play.
2. A small icon names the attack type but shows nothing about the answer.
3. Answer directions, enemy order, and cosmetic details are randomized. Questions come from each player's own review queue.
4. No rhythm skill. Earlier answers parry better but there is no narrow timing window.
5. Distractors are near-misses: other forms of the same verb, wrong gender, false friends.
6. Feints test reading, not reflexes.
7. Guessing is costly: a wrong answer takes the hit, a random guess succeeds one time in four, hits refill the enemy's stance, and the riposte requires typing.
8. Winning is not mastery. A word counts as mastered only when answered correctly in untelegraphed contexts: bonfire reviews, blind rounds where the enemy is hidden, and exploration reading choices.
9. Litmus test for every build: a skilled gamer who speaks no Spanish must not be able to clear the first boss.

## 5. Content system

### 5.1 Procedural versus static

| Content | Source |
| --- | --- |
| Regular enemies, bonfire reviews, ghost enemies | Procedural (templates + lexicon) |
| Distractors | Procedural (change one grammatical feature) |
| Bosses, NPC dialogue, item text, lore, signs | Static, hand-written, native-checked |
| Idioms and cultural phrases | Static |

### 5.2 Dialect

Castilian Spanish from Spain. `vosotros` forms included from the start. Speech synthesis prefers an es-ES voice, with a text-only fallback. Vocabulary follows Spain usage (ordenador, not computadora). Latin American variants are a possible later add-on.

### 5.3 Lexicon and templates

Seed files are in `src/content/data`:

- `lexicon.json`: nouns (gender, plural, semantic tags) and regular present-tense verbs (all six persons, `takes` tags).
- `templates.json`: pronouns, articles, and five Zone 1 templates (single-blank grammar and a two-blank combo).
- `zone1-rooms.json`: the Zone 1 room graph.

Generation rules:

- Slot rule: `verb.takes` must intersect `noun.tags`.
- The generator fills slots from a seeded RNG and stores the seed on the question.
- Distractors change exactly one feature of the right answer (person, tense, gender, or number). Never include a form that is also correct. Prefer errors learners really make, such as `el espada` for `la espada`.
- Combo templates chain 2 to 4 slots, and each blank is tested and given distractors separately.

Quality control: automated agreement tests per template over many seeds (start at 1,000). A native speaker reviews the lexicon, templates, and all static text before release.

## 6. Learning system

- Track **knowledge components**: a word form or grammar feature, for example `v_levantar:present:3sg` and `art:definite:f`.
- **Leitner boxes:** five boxes, review intervals of 1, 3, 7, 14, and 30 days. A correct answer moves a component up one box. A wrong answer sends it to box 1.
- **Learned** requires two correct answers in untelegraphed contexts (bonfire review, blind round, exploration reading choice) on different days.
- **Bonfires:** save progress, refill flasks, run a short review of due components, and respawn normal enemies.
- **Ghosts:** missed components return as ghost enemies, up to three per room. Beating a ghost with a correct answer moves its component up a box.
- **Boss gate:** the locked door in front of each boss's arena. It opens when at least 80% of the zone's components are Learned (`GATE_THRESHOLD`, to tune).
- **Saving:** localStorage first (IndexedDB if saves grow), with JSON export and import. Local only for now.

| Zone | Focus |
| --- | --- |
| 1. The Hollow Village | Nouns, definite and indefinite articles, gender and number, regular present tense (-ar, -er, -ir) |
| 2. The Drowned Library | ser and estar, adjective agreement, common irregular verbs (tener, ir) |
| 3. The Ash Cathedral | Regular preterite, short reading passages from lore |

## 7. Exploration

Exploration keeps the behind-the-back view. The player walks a graph of painted rooms. The same four directions move them between rooms.

- Each room is a painted 320 x 180 backdrop with the player's back at the bottom center. Exits: far end (north), left (west), right (east). The way back (south) is a foreground arch at the bottom edge.
- Pressing a direction walks through that exit. Transition: the walk cycle plays while the backdrop scales up and fades into the next room.
- A room usually holds one thing: an enemy in plain view, a bonfire, a Spanish signpost or note, an NPC, an item, or a locked door (a shortcut or the boss gate).
- Zone shape: a bonfire hub, two or three branches of 3 to 5 rooms, one shortcut door that opens only from the far side and leads back to the bonfire, then the boss gate and boss arena. Zone 1 aims for about 8 rooms (the seed map has 8 plus the boss arena).
- Reading outside combat: signs and notes are Spanish text and choosing the right exit depends on reading them. A wrong reading costs something small (an ambush or a detour), never a game over. NPC replies are chosen with the four directions. These choices count as untelegraphed contexts for mastery.
- Map screen shows visited rooms, exits, and bonfires. Unexplored exits stay hidden until walked through.
- Death returns the player to the last bonfire. Resting respawns normal enemies.
- A zone reuses about five backdrop types (corridor, crossroads, hall, bonfire room, boss gate) with palette swaps.

Room JSON: `id`, `backdrop`, `exits` keyed by direction, `contents`. An exit is a room id, `"$back"` (return to where the player came from), or an object `{ to, locked?, unlocks?, gate? }`.

## 8. Art, UI, and audio

| Element | Spec (starting values) |
| --- | --- |
| Internal resolution | 320 x 180, scaled 4x to 1280 x 720 or 6x to 1920 x 1080, letterboxed otherwise |
| Rendering | Nearest-neighbor, no smoothing |
| Palette | 32 colors: desaturated blues and greys, one warm accent (bonfire orange), one signal color for parry flashes |
| Player sprite | 48 x 64 px, seen from behind |
| Standard enemies | 48 to 64 px tall, facing the camera |
| Bosses | 96 to 128 px tall |
| Frames | Enemy: idle 4, wind-up 6 (one shared version), strike 3 and recoil 4 per direction, stance break 4, death 6. Player: idle 4, parry 4 and hit 3 per direction, death 6 |

- Each enemy has one wind-up animation, time-stretched to match the answer window. East animations are mirrored for west.
- Arenas are painted backdrops with a depth gradient and two or three parallax layers. No 3D engine.
- The prompt renders at 2x pixel scale with high contrast. The timer is the wind-up plus a thin bar. A stance bar under the enemy drains with each parry.
- Parry gives a 3-frame flash and a short hit-stop. A high-quality parry adds a distinct shape, not just a color change.
- Audio: Web Audio for a quiet ambient score and short chiptune effects (parry, hit, bonfire). Every audio cue has a visual cue, except the listening grab, where audio is the question. `speechSynthesis` speaks Spanish with an es-ES voice and a text-only fallback.
- Riposte typing uses a real hidden `<input>` so accents and on-screen keyboards work. Zone 1 accepts a missing accent but shows the correction.
- Accessibility: no meaning by color alone, palette checked for color-blindness, reduced motion (no shake or flashes), larger text, Hollow mode with no timers.

## 9. Core types

```ts
type Direction = 'north' | 'east' | 'south' | 'west';

interface Strike {                        // one blank, one strike
  options: Record<Direction, string>;     // four cards, directions reshuffled
  correct: Direction;
}

interface Question {
  id: string;
  kind: 'vocab' | 'grammar' | 'translate' | 'listen' | 'order' | 'combo';
  sentence: string;      // Spanish text with ___ per blank; empty for listening grabs
  audioText?: string;    // spoken by speech synthesis
  strikes: Strike[];     // length 1, or 2 to 4 for a combo
  components: string[];  // e.g. 'v_levantar:present:3sg'
  seed: number;          // reproduces the exact sentence
}

interface Enemy { hp: number; stance: number; stanceMax: number }

type EncounterState =
  | { kind: 'windup'; question: Question; strike: number; deadlineMs: number }
  | { kind: 'resolving'; strike: number; chosen: Direction | null;
      result: 'parry' | 'hit'; quality: number }   // quality: 0 to 1, share of window left
  | { kind: 'riposte'; question: Question; typed: string[] }
  | { kind: 'won' }
  | { kind: 'lost' };
```

## 10. Testing requirements

- **Generator:** every template over many seeds (start at 1,000), checking agreement and tag rules.
- **Scheduler:** box transitions for correct and wrong answers.
- **Encounter:** state machine driven by a fake clock, covering combos and stance-meter math.
- **Blind bot:** a script that sees only animation state and card positions must score no better than chance (25% on four cards). This is the automated litmus test.
- **Content schema:** all JSON validated at build time.
- **Smoke:** one Playwright test that boots the game and clears a first encounter.

## 11. MVP slice and milestones

Slice contents: five attack types (jab, overhead, delayed swing, grab, combo), one boss with three phases, one bonfire with review, flasks, echoes, and ghosts inside the Zone 1 map, a starting lexicon of roughly 60 nouns and 20 regular verbs (the seed has 27 nouns and 11 verbs), Hollow mode and reduced motion.

| Phase | Weeks | Gate to pass |
| --- | --- | --- |
| 1. Engine | 1 to 2 | One fight playable, blind bot at chance |
| 2. Content | 3 to 4 | Native review of Zone 1 content passes |
| 3. Learning | 5 to 6 | Mastery counted in untelegraphed contexts |
| 4. Art and audio | 7 to 8 | Zone 1 art and audio complete |
| 5. Playtest | 9 to 10 | A skilled gamer with no Spanish cannot clear the boss |

Estimates assume one developer and are starting guesses.

## 12. Open questions

- Should Hollow mode (no timers) count toward mastery, or only toward progress?
- Is 80% Learned the right threshold for opening a boss gate?
- Which pixel font covers all Spanish accents and punctuation (á é í ó ú ñ ü ¿ ¡)?
