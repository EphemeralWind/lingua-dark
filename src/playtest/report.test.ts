import { describe, expect, it } from 'vitest';
import type { ExchangeEvent, PlaytestEvent } from './log';
import { binomialTail, buildReport, formatReport, median } from './report';
import { sampleLog } from './sample';

let n = 0;
function ex(over: Partial<ExchangeEvent> = {}): ExchangeEvent {
  n += 1;
  return {
    type: 'exchange',
    session: 's1',
    atMs: n,
    fight: 'f1',
    foe: 'hollow_villager',
    questionId: 'q',
    seed: n,
    kind: 'vocab',
    attack: 'jab',
    strike: 0,
    chainIndex: 0,
    chosen: 'north',
    answerDir: 'north',
    correct: true,
    timedOut: false,
    answerMs: 1000,
    windowMs: 4500,
    quality: 0.78,
    stanceBroken: false,
    hollow: false,
    assisted: false,
    components: [],
    ...over,
  };
}

describe('report math', () => {
  it('median', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('binomial tail', () => {
    expect(binomialTail(0, 10, 0.25)).toBe(1);
    expect(binomialTail(11, 10, 0.25)).toBe(0);
    expect(binomialTail(10, 10, 0.5)).toBeCloseTo(1 / 1024, 10);
    expect(binomialTail(1, 2, 0.5)).toBeCloseTo(0.75, 10);
    // A guesser at 25% over 400 strikes is not "above chance"; 40% over 400 is.
    expect(binomialTail(100, 400, 0.25)).toBeGreaterThan(0.4);
    expect(binomialTail(160, 400, 0.25)).toBeLessThan(1e-9);
  });
});

describe('buildReport', () => {
  it('computes per-attack accuracy, median answer time, timeouts and stance-break rate', () => {
    const r = buildReport([
      ex({ answerMs: 1000 }),
      ex({ answerMs: 2000, stanceBroken: true }),
      ex({ answerMs: 3000, correct: false, chosen: 'east' }),
      ex({ chosen: null, correct: false, timedOut: true, answerMs: 4500 }),
      ex({ attack: 'overhead', kind: 'grammar', windowMs: 7500, answerMs: 9000, hollow: true }),
    ]);
    const jab = r.attacks.find((a) => a.attack === 'jab');
    expect(jab).toMatchObject({ strikes: 4, accuracy: 0.5, medianAnswerMs: 2000, timeoutRate: 0.25, stanceBreakRate: 0.25, windowMs: 4500, hollow: false });
    expect(jab?.medianWindowShare).toBeCloseTo(2000 / 4500);
    expect(r.attacks.find((a) => a.attack === 'overhead')).toMatchObject({ hollow: true, medianAnswerMs: 9000 });
    expect(r.directions.find((d) => d.dir === 'north')?.pickShare).toBe(0.75);
  });

  it('per foe: wins, unfinished fights, breaks and riposte words', () => {
    const events: PlaytestEvent[] = [
      { type: 'fightStart', session: 's', atMs: 0, fight: 'a', foe: 'crow', label: 'Crow', hollow: false, vitality: 100, enemyHp: 90 },
      ex({ session: 's', fight: 'a', foe: 'crow', stanceBroken: true }),
      ex({ session: 's', fight: 'a', foe: 'crow' }),
      { type: 'riposte', session: 's', atMs: 0, fight: 'a', foe: 'crow', verdicts: ['exact', 'accent', 'wrong', 'wrong'] },
      { type: 'fightEnd', session: 's', atMs: 0, fight: 'a', foe: 'crow', outcome: 'lost', vitality: 0, enemyHp: 60 },
      { type: 'fightStart', session: 's', atMs: 0, fight: 'b', foe: 'crow', label: 'Crow', hollow: false, vitality: 100, enemyHp: 90 },
    ];
    const crow = buildReport(events).foes[0];
    expect(crow).toMatchObject({ foe: 'crow', fights: 2, won: 0, lost: 1, unfinished: 1, strikes: 2, breaksPerFight: 0.5, strikesPerBreak: 2, riposteHitRate: 0.5 });
  });

  it('litmus: the boss is cleared only by winning its last phase, and Hollow strikes do not count', () => {
    const boss = (fight: string, phase: number, outcome: 'won' | 'lost'): PlaytestEvent[] => [
      { type: 'fightStart', session: 'p', atMs: 0, fight, foe: 'bell', label: 'Bell', bossPhase: phase, bossPhases: 2, hollow: false, vitality: 100, enemyHp: 60 },
      { type: 'fightEnd', session: 'p', atMs: 0, fight, foe: 'bell', bossPhase: phase, outcome, vitality: 50, enemyHp: 0 },
    ];
    const strikes = [...Array.from({ length: 40 }, (_, i) => ex({ session: 'p', correct: i < 10 })), ex({ session: 'p', hollow: true })];
    const half = buildReport([...boss('x', 1, 'won'), ...boss('y', 2, 'lost'), ...strikes]).verdicts[0];
    expect(half).toMatchObject({ bossPhaseReached: 2, bossPhasesWon: 1, bossCleared: false, timedStrikes: 40, timedAccuracy: 0.25, usedHollow: true });
    expect(half?.pChance).toBeGreaterThan(0.4);
    // All 40 timed strikes fall inside the early window.
    expect(half).toMatchObject({ earlyStrikes: 40, earlyAccuracy: 0.25 });
    // 50 timed strikes: the first 40 hold every hit, the last 40 hold none of the first 10.
    const rising = buildReport(Array.from({ length: 50 }, (_, i) => ex({ session: 'q', correct: i >= 10 }))).verdicts[0];
    expect(rising).toMatchObject({ earlyAccuracy: 0.75, lateAccuracy: 1 });
    const full = buildReport([...boss('x', 1, 'won'), ...boss('y', 2, 'won')]).verdicts[0];
    expect(full?.bossCleared).toBe(true);
  });

  it('runs on the simulated sample: fluent clears, the no-Spanish gamer sits at chance', () => {
    const r = buildReport(sampleLog());
    const v = Object.fromEntries(r.verdicts.map((x) => [x.session, x]));
    expect(v['fluent']?.bossCleared).toBe(true);
    expect(v['gamer-no-spanish']?.bossCleared).toBe(false);
    expect(v['gamer-no-spanish']?.pChance).toBeGreaterThan(0.01);
    expect(v['learner-hollow']?.usedHollow).toBe(true);
    const text = formatReport(r);
    for (const h of ['PER ATTACK', 'PER FOE', 'CARD DIRECTIONS', 'LITMUS']) expect(text).toContain(h);
    expect(sampleLog()).toEqual(sampleLog()); // seeded: the same every run
  });

  it('formats an empty log', () => {
    expect(formatReport(buildReport([]))).toContain('No strikes');
  });
});
