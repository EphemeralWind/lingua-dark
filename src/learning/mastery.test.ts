import { describe, expect, it } from 'vitest';
import { isLearned, newLearner, recordAnswer, type LearnerState } from './learner';
import { markMastery, newMastery, type AnswerContext } from './mastery';

const answer = (l: LearnerState, correct: boolean, ctx: AnswerContext, day: number): LearnerState =>
  recordAnswer(l, ['c'], correct, ctx, day);

describe('mastery', () => {
  it('two correct untelegraphed answers on different days make a component Learned', () => {
    let l = answer(newLearner(), true, 'review', 0);
    expect(isLearned(l, 'c')).toBe(false);
    l = answer(l, true, 'review', 1);
    expect(isLearned(l, 'c')).toBe(true);
  });

  it('two correct answers on the same day are not enough', () => {
    let l = newLearner();
    for (let i = 0; i < 5; i++) l = answer(l, true, 'review', 7);
    expect(isLearned(l, 'c')).toBe(false);
    expect(l.components['c']?.days).toEqual([7]);
  });

  it('every untelegraphed context counts: review and reading choice', () => {
    for (const [a, b] of [
      ['review', 'reading'],
      ['reading', 'review'],
    ] as const) {
      expect(isLearned(answer(answer(newLearner(), true, a, 0), true, b, 3), 'c')).toBe(true);
    }
  });

  it('combat answers never mark Learned, however many days', () => {
    let l = newLearner();
    for (let day = 0; day < 30; day++) l = answer(l, true, 'combat', day);
    expect(isLearned(l, 'c')).toBe(false);
    expect(l.components['c']?.days).toEqual([]);
    expect(l.components['c']?.box).toBe(5); // but the schedule moved
  });

  it('combat plus one untelegraphed day is not enough', () => {
    let l = answer(newLearner(), true, 'combat', 0);
    l = answer(l, true, 'review', 1);
    expect(isLearned(l, 'c')).toBe(false);
  });

  it('an untelegraphed miss clears the streak', () => {
    let l = answer(newLearner(), true, 'review', 0);
    l = answer(l, false, 'review', 1);
    l = answer(l, true, 'review', 2);
    expect(isLearned(l, 'c')).toBe(false);
    l = answer(l, true, 'review', 3);
    expect(isLearned(l, 'c')).toBe(true);
  });

  it('an untelegraphed miss un-learns; a combat miss does not', () => {
    let l = answer(answer(newLearner(), true, 'review', 0), true, 'review', 1);
    l = answer(l, false, 'combat', 2);
    expect(isLearned(l, 'c')).toBe(true);
    l = answer(l, false, 'reading', 2);
    expect(isLearned(l, 'c')).toBe(false);
  });

  it('markMastery ignores combat entirely', () => {
    const m = newMastery();
    expect(markMastery(m, true, 'combat', 0)).toBe(m);
    expect(markMastery(m, false, 'combat', 0)).toBe(m);
  });

  it('a four-card guesser rarely reaches Learned (streak resets on misses)', () => {
    // Expected tries before two consecutive successes at p = 1/4 is (1 + p) / p^2 = 20.
    // With one review a day, a guesser needs about three weeks per component.
    let state = 1;
    const rand = (): number => ((state = (state * 48271) % 2147483647) / 2147483647);
    let total = 0;
    const runs = 400;
    for (let r = 0; r < runs; r++) {
      let l = newLearner();
      let day = 0;
      while (!isLearned(l, 'c')) l = answer(l, rand() < 0.25, 'reading', day++);
      total += day;
    }
    expect(total / runs).toBeGreaterThan(15);
  });
});
