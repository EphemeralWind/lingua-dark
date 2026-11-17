// The automated litmus test (CLAUDE.md non-negotiable 7, SPEC 10).
//
// Bots play 1,000 seeded fights each against the real question deck and the real
// encounter machine. Animation bots see only `animationOf()` (the exact data the
// renderer draws shapes from) plus the fixed card positions. Text-shape bots also
// see card text but cannot read Spanish (DECISIONS #4). Every bot must score within
// TOLERANCE above chance ("no better than chance"; a bot below chance is covered by
// also testing its complement). Everything is seeded, so the test is deterministic.
import { describe, expect, it } from 'vitest';
import { QUESTION_SPECS, buildQuestion, createDeck } from '../content/handwritten';
import { createRng, type Rng } from '../content/rng';
import { DIRECTIONS, type Direction } from '../content/types';
import { Encounter } from './encounter';
import { animationOf, viewOf, type Animation } from './view';

const FIGHTS = 1000;
const CHANCE = 0.25;
/**
 * Guessers die fast, so 1,000 fights give ~5,900 strikes per bot: one standard error is
 * ~0.0056, and 0.02 above chance is ~3.5 standard errors. Seeded, so never flaky.
 */
const TOLERANCE = 0.02;
const STEP_MS = 1000 / 60;

interface Observation {
  /** Animation frames seen since the previous decision (includes the last strike). */
  history: Animation[];
  /** Card text in N/E/S/W order. Animation bots must not read it. */
  cards: Record<Direction, string>;
}

interface Bot {
  name: string;
  reads: 'animation' | 'text';
  /** Returns a direction and how long to wait (ms) after the wind-up starts. */
  decide(obs: Observation, rng: Rng): { dir: Direction; delayMs: number };
}

function lastStrikeDirection(history: Animation[]): Direction | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i]?.toward;
    if (t) return t;
  }
  return null;
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0] as number;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j] as number;
      dp[j] = Math.min((dp[j] as number) + 1, (dp[j - 1] as number) + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length] as number;
}

/** Picks the direction(s) with the best score; ties broken by the bot's own RNG. */
function argBest(score: (d: Direction) => number, rng: Rng): Direction {
  const scores = DIRECTIONS.map(score);
  const best = Math.max(...scores);
  return rng.pick(DIRECTIONS.filter((_, i) => scores[i] === best));
}

const fast = (dir: Direction) => ({ dir, delayMs: 50 });

const BOTS: Bot[] = [
  { name: 'always north', reads: 'animation', decide: () => fast('north') },
  { name: 'uniform random', reads: 'animation', decide: (_o, r) => fast(r.pick(DIRECTIONS)) },
  {
    name: 'repeat last strike direction',
    reads: 'animation',
    decide: (o, r) => fast(lastStrikeDirection(o.history) ?? r.pick(DIRECTIONS)),
  },
  {
    name: 'avoid last strike direction',
    reads: 'animation',
    decide: (o, r) => {
      const last = lastStrikeDirection(o.history);
      return fast(r.pick(DIRECTIONS.filter((d) => d !== last)));
    },
  },
  {
    name: 'rotate after last strike',
    reads: 'animation',
    decide: (o, r) => {
      const last = lastStrikeDirection(o.history);
      if (!last) return fast(r.pick(DIRECTIONS));
      return fast(DIRECTIONS[(DIRECTIONS.indexOf(last) + 1) % 4] as Direction);
    },
  },
  {
    name: 'late presser (waits most of the window)',
    reads: 'animation',
    decide: (_o, r) => ({ dir: r.pick(DIRECTIONS), delayMs: 2500 + r.int(800) }),
  },
  {
    name: 'text: longest card',
    reads: 'text',
    decide: (o, r) => fast(argBest((d) => o.cards[d].length, r)),
  },
  {
    name: 'text: shortest card',
    reads: 'text',
    decide: (o, r) => fast(argBest((d) => -o.cards[d].length, r)),
  },
  {
    // A bot below chance would be exploitable through its complement, so test those too.
    name: 'text: anything but the longest card',
    reads: 'text',
    decide: (o, r) => fast(argBest((d) => -Number(o.cards[d].length === Math.max(...DIRECTIONS.map((e) => o.cards[e].length))), r)),
  },
  {
    name: 'text: anything but the shortest card',
    reads: 'text',
    decide: (o, r) => fast(argBest((d) => -Number(o.cards[d].length === Math.min(...DIRECTIONS.map((e) => o.cards[e].length))), r)),
  },
  {
    name: 'text: edit-distance medoid',
    reads: 'text',
    decide: (o, r) =>
      fast(argBest((d) => -DIRECTIONS.reduce((sum, e) => sum + editDistance(o.cards[d], o.cards[e]), 0), r)),
  },
  {
    name: 'text: prefix of most other cards',
    reads: 'text',
    decide: (o, r) =>
      fast(argBest((d) => DIRECTIONS.filter((e) => e !== d && o.cards[e].startsWith(o.cards[d])).length, r)),
  },
];

interface Score {
  strikes: number;
  correct: number;
  wins: number;
}

function playFight(bot: Bot, seed: number): Score {
  const gameRng = createRng(seed);
  const botRng = createRng(seed ^ 0x9e3779b9);
  const enc = new Encounter(createDeck(gameRng), { zone: 1 });
  let now = 0;
  enc.start(now);

  let history: Animation[] = [];
  let pending: { dir: Direction; atMs: number } | null = null;
  let decidedFor: unknown = null;

  for (let guard = 0; guard < 200_000 && !enc.finished; guard++) {
    const s = enc.state;
    if (s.kind === 'windup' && decidedFor !== s) {
      const view = viewOf(enc, now);
      const cards = {} as Record<Direction, string>;
      for (const c of view.cards) cards[c.dir] = bot.reads === 'text' ? c.text : '';
      const d = bot.decide({ history, cards }, botRng);
      pending = { dir: d.dir, atMs: s.startMs + d.delayMs };
      decidedFor = s;
      history = [];
    }
    if (pending && now >= pending.atMs) {
      enc.lockIn(pending.dir, pending.atMs);
      pending = null;
    }
    if (enc.state.kind === 'riposte') {
      // A bot that cannot read Spanish types nothing useful.
      enc.submitRiposte([], now);
    }
    history.push(animationOf(enc, now));
    now += STEP_MS;
    enc.tick(now);
  }
  if (!enc.finished) throw new Error(`fight ${seed} did not finish`);
  const correct = enc.log.filter((r) => r.result === 'parry').length;
  return { strikes: enc.log.length, correct, wins: enc.state.kind === 'won' ? 1 : 0 };
}

describe('blind bot', () => {
  it.each(BOTS.map((b) => [b.name, b] as const))('%s scores no better than chance', (_name, bot) => {
    const total: Score = { strikes: 0, correct: 0, wins: 0 };
    for (let seed = 1; seed <= FIGHTS; seed++) {
      const s = playFight(bot, seed);
      total.strikes += s.strikes;
      total.correct += s.correct;
      total.wins += s.wins;
    }
    const rate = total.correct / total.strikes;
    expect(total.strikes).toBeGreaterThan(FIGHTS * 5);
    expect(rate, `${bot.name}: ${total.correct}/${total.strikes}`).toBeLessThanOrEqual(CHANCE + TOLERANCE);
    // A guesser must not be able to clear a fight.
    expect(total.wins).toBe(0);
  });
});

describe('wind-up animation carries no answer information', () => {
  it('is identical for every question and every answer direction at the same progress', () => {
    const fractions = [0, 0.1, 0.37, 0.5, 0.92, 0.999];
    const reference = new Map<number, Animation>();
    for (const spec of QUESTION_SPECS) {
      for (let seed = 0; seed < 50; seed++) {
        const q = buildQuestion(spec, seed);
        const enc = new Encounter(() => q, { zone: 1 });
        enc.start(0);
        const s = enc.state;
        if (s.kind !== 'windup') throw new Error('expected wind-up');
        const span = s.deadlineMs - s.startMs;
        for (const f of fractions) {
          const a = animationOf(enc, f * span);
          const ref = reference.get(f);
          if (ref) expect(a).toEqual(ref);
          else reference.set(f, a);
        }
      }
    }
  });

  it('only reveals a direction after lock-in', () => {
    const q = buildQuestion(QUESTION_SPECS[0]!, 3);
    const enc = new Encounter(() => q, { zone: 1 });
    enc.start(0);
    expect(animationOf(enc, 100).toward).toBeNull();
    enc.lockIn('north', 200);
    expect(animationOf(enc, 210).toward).toBe(q.strikes[0]!.correct);
  });
});
