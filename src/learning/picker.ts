// Question pickers. Pure: a seeded RNG and the learner state in, questions out.
//
// Combat (telegraphed, four cards): the picker serves the player's due components first, but
// it never chooses the answer. It draws from the same uniform deck stream as a plain fight and
// keeps the first question that shows the target component on one of its cards, as the answer
// or as a distractor. Acceptance depends only on the card set, so every card in the set stays
// equally likely to be the answer, even to a bot that remembers which forms it missed
// (DECISIONS #58). Ghosts and echoes use the same rule with a fixed target.
//
// Review (untelegraphed, typed, no cards): the question must test the component exactly.
import { componentSurfaces, showsOnCards } from '../content/components';
import { zoneTemplates } from '../content/deck';
import { generate } from '../content/generator';
import { CONTENT, type Content } from '../content/lexicon';
import type { Rng } from '../content/rng';
import type { Template } from '../content/schema';
import type { Question } from '../content/types';
import { REVIEW_TRIES, TARGET_TRIES } from '../tuning';
import { dueComponents, type LearnerState } from './learner';

/** One question from the uniform deck stream whose cards show `target`, or null. */
export function targetedQuestion(
  rng: Rng,
  target: string,
  templates: readonly Template[] = zoneTemplates(1),
  content: Content = CONTENT,
  tries = TARGET_TRIES,
): Question | null {
  if (componentSurfaces(target, content).length === 0) return null;
  for (let i = 0; i < tries; i++) {
    const t = rng.pick(templates);
    const q = generate(t, rng.nextSeed(), content);
    if (showsOnCards(q, target, content)) return q;
  }
  return null;
}

export interface PickerOptions {
  rng: Rng;
  /** Every draw targets this component (ghosts, echoes). */
  target?: string | null;
  /** Read at each draw: the learner state and today's day, for due-first picks. */
  learner?: () => { state: LearnerState; day: number };
  /** Limits due-first picks to these components (the zone's). */
  among?: readonly string[];
  templates?: readonly Template[];
  content?: Content;
}

/** A question source for an Encounter. */
export function createPicker(opts: PickerOptions): () => Question {
  const templates = opts.templates ?? zoneTemplates(1, opts.content);
  const content = opts.content ?? CONTENT;
  const served = new Set<string>();
  const uniform = (): Question => generate(opts.rng.pick(templates), opts.rng.nextSeed(), content);

  return () => {
    if (opts.target) return targetedQuestion(opts.rng, opts.target, templates, content) ?? uniform();
    if (opts.learner) {
      const { state, day } = opts.learner();
      // Each due component is targeted once per fight: a target that showed only as a
      // distractor stays due, and must not pin the whole fight on itself.
      const next = dueComponents(state, day, opts.among).find((id) => !served.has(id) && componentSurfaces(id, content).length > 0);
      if (next) {
        served.add(next);
        const q = targetedQuestion(opts.rng, next, templates, content);
        if (q) return q;
      }
    }
    return uniform();
  };
}

/** Templates usable for typed review: one blank, and not a whole translated sentence. */
export function reviewTemplates(templates: readonly Template[] = zoneTemplates(1)): Template[] {
  return templates.filter((t) => t.blanks.length === 1 && t.kind !== 'translate');
}

/** A single-blank question that tests `target` exactly, or null. */
export function reviewQuestion(
  rng: Rng,
  target: string,
  templates: readonly Template[] = reviewTemplates(),
  content: Content = CONTENT,
  tries = REVIEW_TRIES,
): Question | null {
  for (let i = 0; i < tries; i++) {
    const q = generate(rng.pick(templates), rng.nextSeed(), content);
    if (q.components.includes(target)) return q;
  }
  return null;
}

/**
 * What a bonfire review asks, in order: due components not yet reviewed today, then met but
 * not Learned ones not reviewed today (lowest box first), then components never met.
 */
export function reviewTargets(state: LearnerState, universe: readonly string[], day: number, size: number, rng: Rng): string[] {
  const out: string[] = [];
  const take = (ids: readonly string[]): void => {
    for (const id of ids) if (out.length < size && !out.includes(id)) out.push(id);
  };
  const notToday = (id: string): boolean => state.components[id]?.reviewedDay !== day;
  take(dueComponents(state, day, universe).filter(notToday));
  const met = universe
    .filter((id) => state.components[id] && !state.components[id]?.learned && notToday(id))
    .sort((a, b) => (state.components[a]?.box ?? 0) - (state.components[b]?.box ?? 0));
  take(met);
  take(rng.shuffle(universe.filter((id) => !state.components[id])));
  return out;
}
