import { describe, expect, it } from 'vitest';
import { DIRECTIONS, type Direction, type Question, type QuestionKind } from '../content/types';
import { createRng } from '../content/rng';
import { RESOLVE_MS, RIPOSTE_RESULT_MS } from '../tuning';
import { Encounter, type EncounterConfig } from './encounter';
import type { EncounterState } from './types';

// --- fixtures -------------------------------------------------------------

/** A question whose strike i has its answer at corrects[i]. Answer text is "ok<i>". */
function question(kind: QuestionKind, corrects: Direction[]): Question {
  return {
    id: `q_${kind}`,
    kind,
    sentence: corrects.map(() => '___').join(' y '),
    strikes: corrects.map((correct, i) => {
      const options = {} as Record<Direction, string>;
      DIRECTIONS.forEach((d, j) => (options[d] = d === correct ? `ok${i}` : `no${i}_${j}`));
      return { options, correct };
    }),
    components: ['c'],
    seed: 0,
  };
}

/** Fake clock plus an encounter that always serves the given question. */
function setup(q: Question, config: Partial<EncounterConfig> = {}) {
  let now = 1000;
  const enc = new Encounter(() => q, { zone: 1, ...config });
  enc.start(now);
  return {
    enc,
    get now() {
      return now;
    },
    advance(ms: number) {
      now += ms;
      enc.tick(now);
    },
    lock(dir: Direction, afterMs = 0) {
      now += afterMs;
      return enc.lockIn(dir, now);
    },
  };
}

function expectKind<K extends EncounterState['kind']>(s: EncounterState, kind: K): Extract<EncounterState, { kind: K }> {
  expect(s.kind).toBe(kind);
  return s as Extract<EncounterState, { kind: K }>;
}

const N: Direction = 'north';
const E: Direction = 'east';

// --- tests ----------------------------------------------------------------

describe('Encounter: single strikes', () => {
  it('opens a wind-up with the zone-scaled window', () => {
    const t = setup(question('grammar', [N]));
    const s = expectKind(t.enc.state, 'windup');
    expect(s.deadlineMs - s.startMs).toBe(7500);
  });

  it('an instant correct answer is a full-quality parry', () => {
    const t = setup(question('grammar', [N]));
    expect(t.lock(N)).toBe(true);
    const s = expectKind(t.enc.state, 'resolving');
    expect(s.result).toBe('parry');
    expect(s.quality).toBe(1);
    expect(t.enc.enemy.stance).toBe(75);
    expect(t.enc.vitality).toBe(100);
  });

  it('a later parry drains less, down to the floor', () => {
    const t1 = setup(question('grammar', [N]));
    t1.lock(N, 3750); // half the 7500 ms window left
    expect(t1.enc.enemy.stance).toBe(87.5);

    const t2 = setup(question('grammar', [N]));
    t2.lock(N, 7000); // q ~ 0.067, floored to 0.25
    expect(t2.enc.enemy.stance).toBe(100 - 6.25);
  });

  it('a wrong answer deals damage and refills stance, capped at max', () => {
    const t = setup(question('grammar', [N]));
    t.lock(N);
    t.advance(RESOLVE_MS); // stance 75, next wind-up
    t.lock(E);
    const s = expectKind(t.enc.state, 'resolving');
    expect(s.result).toBe('hit');
    expect(s.chosen).toBe(E);
    expect(s.correct).toBe(N);
    expect(t.enc.vitality).toBe(65); // overhead deals high damage
    expect(t.enc.enemy.stance).toBe(95);

    t.advance(RESOLVE_MS);
    t.lock(E);
    expect(t.enc.enemy.stance).toBe(100);
  });

  it('jab damage is low', () => {
    const t = setup(question('vocab', [N]));
    t.lock(E);
    expect(t.enc.vitality).toBe(90);
  });

  it('a closed window with no answer is a hit at quality 0', () => {
    const t = setup(question('grammar', [N]));
    t.advance(7499);
    expect(t.enc.state.kind).toBe('windup');
    t.advance(1);
    const s = expectKind(t.enc.state, 'resolving');
    expect(s.chosen).toBeNull();
    expect(s.result).toBe('hit');
    expect(s.quality).toBe(0);
    expect(s.startMs).toBe(t.now);
  });

  it('a press after the deadline counts as no answer', () => {
    const t = setup(question('grammar', [N]));
    expect(t.lock(N, 8000)).toBe(false);
    expect(expectKind(t.enc.state, 'resolving').result).toBe('hit');
  });

  it('ignores presses outside a wind-up', () => {
    const t = setup(question('grammar', [N]));
    t.lock(N);
    const before = t.enc.enemy.stance;
    expect(t.lock(N, 10)).toBe(false);
    expect(t.enc.enemy.stance).toBe(before);
    expect(t.enc.log).toHaveLength(1);
  });

  it('starts the next wind-up after the resolve animation', () => {
    const t = setup(question('grammar', [N]));
    t.lock(N);
    t.advance(RESOLVE_MS - 1);
    expect(t.enc.state.kind).toBe('resolving');
    t.advance(1);
    expect(expectKind(t.enc.state, 'windup').startMs).toBe(t.now);
  });
});

describe('Encounter: combos', () => {
  it('gives every blank its own window and fresh wind-up', () => {
    const t = setup(question('combo', [N, E]));
    const first = expectKind(t.enc.state, 'windup');
    expect(first.strike).toBe(0);
    expect(first.deadlineMs - first.startMs).toBe(3750);
    t.lock(N);
    t.advance(RESOLVE_MS);
    const second = expectKind(t.enc.state, 'windup');
    expect(second.strike).toBe(1);
    expect(second.question).toBe(first.question);
    expect(second.deadlineMs - second.startMs).toBe(3750);
  });

  it('clearing every strike drains the combo bonus', () => {
    const t = setup(question('combo', [N, E]));
    t.lock(N);
    t.advance(RESOLVE_MS);
    t.lock(E);
    const s = expectKind(t.enc.state, 'resolving');
    expect(s.comboCleared).toBe(true);
    expect(t.enc.enemy.stance).toBe(100 - 25 - 25 - 25);
  });

  it('a miss does not cancel the rest, but loses the bonus', () => {
    const t = setup(question('combo', [N, E]));
    t.lock(E); // miss: stance stays capped at 100
    t.advance(RESOLVE_MS);
    expect(expectKind(t.enc.state, 'windup').strike).toBe(1);
    t.lock(E);
    const s = expectKind(t.enc.state, 'resolving');
    expect(s.result).toBe('parry');
    expect(s.comboCleared).toBe(false);
    expect(t.enc.enemy.stance).toBe(75);
  });

  it('a timeout mid-combo moves on to the next blank', () => {
    const t = setup(question('combo', [N, E]));
    t.advance(3750);
    expect(expectKind(t.enc.state, 'resolving').chosen).toBeNull();
    t.advance(RESOLVE_MS);
    expect(expectKind(t.enc.state, 'windup').strike).toBe(1);
  });

  it('a stance break mid-combo skips the remaining strikes and ripostes the whole sentence', () => {
    const t = setup(question('combo', [N, E]), { stanceMax: 20 });
    t.lock(N);
    expect(expectKind(t.enc.state, 'resolving').stanceBroken).toBe(true);
    t.advance(RESOLVE_MS);
    const r = expectKind(t.enc.state, 'riposte');
    expect(r.question.strikes).toHaveLength(2);
  });

  it('the combo bonus can be what breaks stance', () => {
    const t = setup(question('combo', [N, E]), { stanceMax: 60 });
    t.lock(N); // 35
    t.advance(RESOLVE_MS);
    t.lock(E); // 10, then bonus 15 -> 0
    expect(expectKind(t.enc.state, 'resolving').stanceBroken).toBe(true);
    expect(t.enc.enemy.stance).toBe(0);
  });
});

describe('Encounter: riposte, win, lose', () => {
  function breakStance(t: ReturnType<typeof setup>) {
    for (let i = 0; i < 4; i++) {
      const s = expectKind(t.enc.state, 'windup');
      const strike = s.question.strikes[s.strike];
      t.lock(strike!.correct);
      t.advance(RESOLVE_MS);
    }
    expectKind(t.enc.state, 'riposte');
  }

  it('four perfect parries break stance and open the riposte', () => {
    const t = setup(question('grammar', [N]));
    breakStance(t);
    expect(t.enc.enemy.stance).toBe(0);
  });

  it('each correct word lands one strike; a partly right answer still hurts', () => {
    const t = setup(question('combo', [N, E]), { stanceMax: 20 });
    t.lock(N);
    t.advance(RESOLVE_MS);
    t.enc.submitRiposte(['OK0', 'wrong'], t.now);
    const s = expectKind(t.enc.state, 'riposteResult');
    expect(s.verdicts).toEqual(['exact', 'wrong']);
    expect(t.enc.enemy.hp).toBe(60 - 15);
  });

  it('after the riposte, stance resets and a new exchange begins', () => {
    const t = setup(question('grammar', [N]));
    breakStance(t);
    t.enc.submitRiposte(['ok0'], t.now);
    t.advance(RIPOSTE_RESULT_MS);
    expectKind(t.enc.state, 'windup');
    expect(t.enc.enemy.stance).toBe(100);
    expect(t.enc.enemy.hp).toBe(45);
  });

  it('the enemy dies at zero HP', () => {
    const t = setup(question('grammar', [N]), { enemyHp: 15 });
    breakStance(t);
    t.enc.submitRiposte(['ok0'], t.now);
    t.advance(RIPOSTE_RESULT_MS);
    expect(t.enc.state.kind).toBe('won');
    expect(t.enc.finished).toBe(true);
  });

  it('the player dies at zero vitality, after the hit plays', () => {
    const t = setup(question('grammar', [N]), { vitality: 35 });
    t.lock(E);
    expect(t.enc.vitality).toBe(0);
    expect(t.enc.state.kind).toBe('resolving');
    t.advance(RESOLVE_MS);
    expect(t.enc.state.kind).toBe('lost');
    t.advance(10_000);
    expect(t.enc.state.kind).toBe('lost');
  });

  it('a full fight of perfect play wins', () => {
    const t = setup(question('grammar', [N]));
    for (let round = 0; round < 4; round++) {
      breakStance(t);
      t.enc.submitRiposte(['ok0'], t.now);
      t.advance(RIPOSTE_RESULT_MS);
    }
    expect(t.enc.state.kind).toBe('won');
    expect(t.enc.vitality).toBe(100);
  });
});

describe('Encounter: flasks and the exchange log', () => {
  it('a flask greys out exactly two wrong cards, never the answer', () => {
    for (let seed = 0; seed < 50; seed++) {
      const t = setup(question('grammar', [E]), { flaskRng: createRng(seed) });
      expect(t.enc.useFlask()).toBe(true);
      const s = expectKind(t.enc.state, 'windup');
      expect(s.greyed).toHaveLength(2);
      expect(new Set(s.greyed).size).toBe(2);
      expect(s.greyed).not.toContain(E);
    }
  });

  it('one flask per strike; none outside a wind-up or without a flask RNG', () => {
    const t = setup(question('grammar', [E]), { flaskRng: createRng(1) });
    expect(t.enc.useFlask()).toBe(true);
    expect(t.enc.useFlask()).toBe(false);
    t.lock(E);
    expect(t.enc.useFlask()).toBe(false);
    expect(setup(question('grammar', [E])).enc.useFlask()).toBe(false);
  });

  it('greyed cards cannot be picked; the answer still can', () => {
    const t = setup(question('grammar', [E]), { flaskRng: createRng(3) });
    t.enc.useFlask();
    const grey = expectKind(t.enc.state, 'windup').greyed[0]!;
    expect(t.lock(grey)).toBe(false);
    expect(t.enc.state.kind).toBe('windup');
    expect(t.lock(E)).toBe(true);
    expect(expectKind(t.enc.state, 'resolving')).toMatchObject({ result: 'parry', assisted: true });
  });

  it('the next strike starts with no greyed cards', () => {
    const t = setup(question('combo', [E, N]), { flaskRng: createRng(3) });
    t.enc.useFlask();
    t.lock(E);
    t.advance(RESOLVE_MS);
    expect(expectKind(t.enc.state, 'windup').greyed).toEqual([]);
  });

  it('logs each strike with its components and whether a flask helped', () => {
    const q = question('combo', [E, N]);
    q.components = ['first', 'second'];
    const t = setup(q, { flaskRng: createRng(3) });
    t.lock(E);
    t.advance(RESOLVE_MS);
    t.enc.useFlask();
    const greyed = expectKind(t.enc.state, 'windup').greyed;
    t.lock(DIRECTIONS.find((d) => d !== N && !greyed.includes(d))!);
    expect(t.enc.log.map((r) => [r.components, r.assisted, r.result])).toEqual([
      [['first'], false, 'parry'],
      [['second'], true, 'hit'],
    ]);
  });
});
