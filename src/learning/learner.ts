// The player's knowledge state: one record per component, combining the Leitner schedule
// and mastery. Pure and serialisable (it is saved as plain JSON).
import { newMastery, markMastery, type AnswerContext, type Mastery } from './mastery';
import { demote, isDue, newSchedule, promote, type Schedule } from './scheduler';

export interface ComponentRecord extends Schedule, Mastery {
  /** Answers given, any context. */
  seen: number;
  misses: number;
  /** Last day reviewed untelegraphed, so one bonfire day does not ask the same thing twice. */
  reviewedDay: number | null;
}

export interface LearnerState {
  components: Record<string, ComponentRecord>;
}

export function newLearner(): LearnerState {
  return { components: {} };
}

export function recordOf(state: LearnerState, id: string, day: number): ComponentRecord {
  return state.components[id] ?? { ...newSchedule(day), ...newMastery(), seen: 0, misses: 0, reviewedDay: null };
}

export interface AnswerOptions {
  /** A flask greyed out two cards: a correct pick does not promote (DECISIONS #61). */
  assisted?: boolean;
}

/** Records one answer for each component the strike tested. Returns a new state. */
export function recordAnswer(
  state: LearnerState,
  ids: readonly string[],
  correct: boolean,
  ctx: AnswerContext,
  day: number,
  opts: AnswerOptions = {},
): LearnerState {
  const components = { ...state.components };
  for (const id of ids) {
    const r = recordOf(state, id, day);
    let sched: Schedule = r;
    if (!correct) sched = demote(r, day);
    else if (!opts.assisted) sched = promote(r, day);
    const mastery = markMastery(r, correct, ctx, day);
    components[id] = {
      box: sched.box,
      dueDay: sched.dueDay,
      promotedDay: sched.promotedDay,
      days: mastery.days,
      learned: mastery.learned,
      seen: r.seen + 1,
      misses: r.misses + (correct ? 0 : 1),
      reviewedDay: ctx === 'combat' ? r.reviewedDay : day,
    };
  }
  return { components };
}

/**
 * Components due today, most urgent first: lowest box, then earliest due day, then id.
 * Only components the player has met are scheduled; the rest are not due yet.
 */
export function dueComponents(state: LearnerState, day: number, among?: readonly string[]): string[] {
  const pool = among ? new Set(among) : null;
  return Object.entries(state.components)
    .filter(([id, r]) => (!pool || pool.has(id)) && isDue(r, day))
    .sort(([a, ra], [b, rb]) => ra.box - rb.box || ra.dueDay - rb.dueDay || (a < b ? -1 : a > b ? 1 : 0))
    .map(([id]) => id);
}

export function isLearned(state: LearnerState, id: string): boolean {
  return state.components[id]?.learned ?? false;
}
