// The player's profile: knowledge that outlives a run (DECISIONS #75). New Game wipes the run
// (GameState) but keeps this. Pure and serialisable.
import { newLearner, recordAnswer, type AnswerOptions, type LearnerState } from './learner';
import type { AnswerContext } from './mastery';

export interface Profile {
  version: 1;
  learner: LearnerState;
  /** Highest Learned count ever reached. Perks read this, so forgetting never takes them back. */
  bestLearned: number;
}

export function newProfile(learner: LearnerState = newLearner()): Profile {
  return { version: 1, learner, bestLearned: learnedCount(learner) };
}

export function learnedCount(learner: LearnerState): number {
  return Object.values(learner.components).filter((r) => r.learned).length;
}

/** Records an answer (see recordAnswer) and raises bestLearned if it grew. Mutates the profile. */
export function recordInProfile(
  p: Profile,
  ids: readonly string[],
  correct: boolean,
  ctx: AnswerContext,
  day: number,
  opts: AnswerOptions = {},
): void {
  p.learner = recordAnswer(p.learner, ids, correct, ctx, day, opts);
  p.bestLearned = Math.max(p.bestLearned, learnedCount(p.learner));
}
