# Playtest protocol

This is the protocol for Milestone 5. The main goal is the **litmus test** (SPEC 4, rule 9): a
skilled gamer who speaks no Spanish must not be able to clear the first boss, the Hollow Bell. The
same sessions also produce the timing data used to tune answer windows and stance drain.

The game keeps its own log, so the facilitator does not time anything by hand. The facilitator
records what the log cannot show: what the player says, what they look at, and how they explain
their choices.

## 1. The tools

| What | Where |
| --- | --- |
| The game | https://ephemeralwind.github.io/lingua-dark/ (or `npm run dev`, then `http://localhost:5173/`) |
| Practice fight (warm-up) | the same URL plus `?seed=101` |
| Litmus save (all seals; the boss is three rooms north) | `…/lingua-dark/playtest/litmus-save.json` on the site, or `public/playtest/litmus-save.json` in the repo |
| Playtest log | kept in the browser. **O** opens settings, **P** exports the log as JSON, **X X** clears it |
| Report | `npm run playtest-report -- P01.json [P02.json …]` |
| Sample report | `npm run playtest-report -- --sample`, or run it on `docs/playtest/sample-log.json` |

**The log** is written to this browser's localStorage and nowhere else. The game makes no
network requests for it. Each resolved strike records:

- the question kind and attack type;
- the answer time, and the window it had;
- whether the answer was right, or the window closed;
- whether the strike broke the enemy's stance;
- whether Hollow mode was on, and whether a flask greyed cards;
- the question id and seed, so a strike can be replayed exactly.

Fight starts, fight ends (won or lost), and riposte results are logged too. A strike is written
only after it resolves. While a wind-up is open, nothing in the log or on screen knows the answer.

Each page load is a new **session** in the log. The report groups by session, so note the time of
each part in the record sheet.

The log holds no names and no device details. Name the exported file with a participant code
(`P01.json`), never a name.

## 2. Who to recruit

The litmus participant:

- plays action games often, and at least one game with parries or tight timing (Souls-likes,
  Sekiro, fighting games, rhythm games);
- has **no Spanish**: no classes beyond a few words, no time living where Spanish is spoken;
- does not speak Portuguese, Italian, Catalan, French or Galician. Cognates would make the test
  easier than it should be (DECISIONS #49). Record any other languages they speak;
- has not played Lingua Dark before.

Run **at least three** litmus participants per build that changes combat, content or timing. One
pass is not enough evidence; one fail is.

Tuning sessions can also include learners and people who speak Spanish. Mark them as such on the
record sheet, and keep them out of the litmus verdict.

## 3. Before each session

1. Use desktop Chrome or Edge, with a fresh profile or a private window. In a private window the log
   is lost when the window closes, so export before closing it.
2. Open the game, press **O** and check the settings. Hollow mode must be **OFF**. Sound and the
   Spanish voice stay ON. Note on the sheet whether an es-ES voice was found (shown in the menu).
3. Press **X** twice to clear the playtest log. The menu should read "0 strikes".
4. Download `litmus-save.json` to the desktop.
5. Have the record sheet (section 6) open. Screen and voice recording is optional and needs the
   participant's consent.

## 4. The session (about 60 minutes)

### Brief (read aloud; do not add to it)

> This is a combat game. Each enemy attack is a question in Spanish. Four answers appear around the
> enemy, and you parry by pressing the arrow of the right one. Answer sooner to parry better. If you
> break the enemy's stance, you type the missing words to strike back. Please think aloud: say what
> you look at and why you choose an answer. I can't help with the Spanish or with what to press.
> You can stop at any time.

During play, do not answer questions about Spanish, the answers or the strategy. Say "Do whatever
you think works." Help only with controls (arrows or WASD, Enter, F for a flask, M for the map).

### Part A: warm-up (5 minutes)

Open `/?seed=101`. The participant plays the practice fight to learn the controls. Stop after five
minutes, even mid-fight. Part A is its own session in the log, and it does not count toward the
verdict.

### Part B: the litmus (up to 40 minutes)

1. Open `/` (the world). On the title screen press **I** and pick `litmus-save.json`. The player
   wakes by the bonfire with all three seals.
2. Tell them: "The boss is through the gate to the north. Try to beat it."
3. They play until they **clear the boss**, **40 minutes pass**, or they **ask to stop**.

After a death the player wakes at the bonfire. The villager in the lane is back, so each attempt
passes one regular fight first. That fight is logged with everything else.

Resting at the bonfire opens the lesson stele (grammar examples). The player may use it. Write down
when they open it and for how long, because it is teaching, not a shortcut.

The boss has two phases. Phase 1, "The first toll", draws an easier pool. Then a battle cry opens
phase 2, "The death knell": a harder pool with 3-question flurries.

### Part C: Spanish check (5 minutes)

Open `/?seed=777`. Press **O** and turn **Hollow mode ON**: no timers, so the participant can take
their time. They answer about 20 strikes with no help. The log tags these strikes `hollow`, so they
are kept apart from the timed strikes in Part B.

Part C measures what the participant knows *now*, after the session. It tells learning apart from a
leak (section 7).

### Part D: debrief (5 to 10 minutes)

Ask, and write down the answers in their own words:

1. How did you decide which card to pick? Did that change over time?
2. Was there anything on screen, or in the sound, that told you which card was right before you
   picked it? (Ask them to show it.)
3. Did you notice any patterns in the cards, such as length, endings, position, or repeats?
4. What do you think *la*, *los* and *una* mean? Can you tell when to use *el* or *la*?
5. Did the stone stele help? What did you take from it?
6. Which attack felt too fast, and which too slow?

### Export

Press **O**, then **P**. Rename the downloaded file to the participant code (`P01.json`) and store it
with the record sheet. Then press **X** twice to clear the log for the next participant.

## 5. Running the report

```
npm run playtest-report -- P01.json
npm run playtest-report -- P01.json P02.json P03.json   # several participants together
npm run playtest-report -- P01.json --json              # machine-readable
```

The report has five parts.

- **PER ATTACK.** One row per attack type (jab, overhead, delayed, combo), split into timed and Hollow:
  - accuracy;
  - median answer time, over answered strikes only;
  - the median as a share of the window;
  - timeouts, and the mean parry quality of right answers;
  - **break rate**: the share of strikes that broke the enemy's stance.
- **PER FOE.** Fights won, lost and left unfinished, accuracy, stance breaks per fight, strikes per
  break, and riposte words that landed. Boss phases get their own rows.
- **CARD DIRECTIONS.** How often each arrow was picked, against how often it was the answer. A player
  who presses one key every time shows up here.
- **LITMUS.** One row per session:
  - timed accuracy, and the chance of scoring that well by guessing at 25%;
  - accuracy over the first 40 and the last 40 timed strikes;
  - the furthest boss phase reached, phases won, and whether the boss was **CLEARED**;
  - whether Hollow mode was used.
- **TUNING HINTS.** Rough flags: a window where more than 20% of strikes time out, or one that
  accurate players answer within 40% of its length.

## 6. Record sheet

One per participant.

| Field | Notes |
| --- | --- |
| Participant code | P01, … |
| Date, facilitator | |
| Build | site URL, or the commit hash for a local build |
| es-ES voice found | yes / no |
| Games played | titles, hours a week |
| Languages | every language and level; confirm no Spanish and no other Romance language |
| Part A session time | to match the report's session rows |
| Part B session time | |
| Part B attempts | per attempt: furthest phase, roughly how far the stance and HP bars got, how they died |
| Part B result | cleared (time) / not cleared at 40 min / stopped (time) |
| Stele | opened? when, how long, what they said |
| Strategy quotes | what they said while playing, word for word where possible |
| Suspected cues | anything they say they used that is not Spanish: card length, endings, position, sound, timing, the attack icon |
| Part C session time | |
| Debrief answers | questions 1 to 6 |
| Verdict | PASS / LEARNED / FAIL (section 7), with reasons |

## 7. Deciding pass or fail

Use the report's LITMUS row for the participant's Part B session, plus the record sheet. "Above
chance" means a one-sided binomial p below 0.01 against 25% (`LITMUS_ALPHA`). Over 40 strikes, that
is 18 or more right (45%).

**FAIL (a shortcut exists).** Any one of these:

1. **Cleared without Spanish.** The boss is CLEARED, and Part C accuracy is not above chance, or the
   participant cannot explain any rule in the debrief. The fight was won by something other than
   Spanish.
2. **Above chance from the start.** First-40 accuracy is above chance (p < 0.01) in Part B. Too
   little has been revealed by then to learn from, so a cue is likely. This counts even if the boss
   was not cleared.
3. **A named cue that works.** The participant describes a non-language cue, and the report shows
   accuracy above chance. This includes card length, endings, position, a sound, the timing, or the
   icon.

**LEARNED (not a fail; the game taught).** The boss may or may not have been cleared, but:

- first-40 accuracy is at chance;
- last-40 accuracy is higher;
- Part C accuracy is above chance;
- the participant can state a real rule in the debrief, such as "*la* goes with *espada*" or "*-o* is
  *I*".

The player now knows some Spanish, which is the aim of the game. Record how long it took. The
designer decides whether clearing the boss after N minutes of learning is acceptable.

**PASS.** The boss was not cleared, first-40 accuracy is at chance, and there is no working
non-language cue.

**A build passes the litmus test** when at least three participants are PASS or LEARNED, and none is
FAIL.

### After a FAIL

1. Write the participant's strategy as a new bot in `src/combat/blind-bot.test.ts`, using only what
   the bot may see: animation state, card text and positions, and earlier revealed answers.
2. If the new bot scores above chance, the leak is confirmed. Fix the cause in content, the
   distractors or the presentation, never by loosening the test. See DECISIONS #95 for an earlier
   case (card length by phase).
3. If the bot stays at chance, the cue lives in something the bot cannot see, such as sound,
   speech or timing. Investigate that in the browser.
4. Record the finding and the fix in `docs/DECISIONS.md`, then rerun the litmus test.

## 8. Using the numbers for tuning

All tunable numbers live in `src/tuning.ts`. Change them there and nowhere else, and note each
change in `docs/DECISIONS.md` with the report figures behind it. For tuning, read the rows from
learners and Spanish speakers, not from litmus participants: a non-speaker's timing only shows how
fast people guess.

- **Answer windows** (`*_WINDOW_S`, `ZONE_WINDOW_MULT`):
  - If learners time out on more than about 20% of an attack's strikes, its window is short.
  - If accurate players (80% or more) answer within 40% of a window, the window may be long. Keep
    some slack, because rule 4 (no rhythm skill) matters more than pace.
- **Stance drain** (`STANCE_DRAIN`, `STANCE_FLOOR`, `HIT_STANCE_REFILL`, `COMBO_CLEAR_BONUS`):
  - Look at strikes per break by foe. With `STANCE_DRAIN` 25, four perfect parries break the
    stance; real players need more.
  - If learners need more than about 10 strikes per break, fights drag, so raise the drain or the
    floor.
  - If guessers ever break the stance often, raise `HIT_STANCE_REFILL`.
- **Boss** (`BOSS_CHAIN`, `BOSS_PHASE_HP`, `BATTLE_CRY_MS`) and **wardens** (`WARDEN_HP`): compare
  the phase rows. Phase 2 should be lower in accuracy than phase 1, not only longer in strikes.
- **Hollow rows** show how long people take with no timer. They are a guide for how long a
  comfortable window would be, never a target.

After any tuning change, run `npm test`. The blind-bot suite must still sit at chance, because
longer windows or a stronger drain can change how far a guesser gets.
