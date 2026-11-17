// Mastery (SPEC 6, CLAUDE.md rule 6). A component is Learned after correct answers in
// untelegraphed contexts on MASTERY_CORRECT_DAYS different days. Combat answers never count.
// An untelegraphed miss clears the streak and un-learns the component, so guessing four-way
// choices cannot add up to Learned over many tries (DECISIONS #59).
import { MASTERY_CORRECT_DAYS } from '../tuning';

/** Where an answer was given. Only `combat` is telegraphed. */
export type AnswerContext = 'combat' | 'review' | 'reading';

export function isUntelegraphed(ctx: AnswerContext): boolean {
  return ctx !== 'combat';
}

export interface Mastery {
  /** Distinct days with an untelegraphed correct answer since the last untelegraphed miss. */
  days: number[];
  learned: boolean;
}

export function newMastery(): Mastery {
  return { days: [], learned: false };
}

export function markMastery(m: Mastery, correct: boolean, ctx: AnswerContext, day: number): Mastery {
  if (!isUntelegraphed(ctx)) return m;
  if (!correct) return newMastery();
  const days = m.days.includes(day) ? m.days : [...m.days, day].slice(-MASTERY_CORRECT_DAYS);
  return { days, learned: m.learned || days.length >= MASTERY_CORRECT_DAYS };
}
