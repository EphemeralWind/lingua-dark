// Distractor selection (SPEC 5.3, CLAUDE.md non-negotiable 5).
//
// Every distractor changes one grammatical feature of the right answer (person, gender, or
// number) or, for vocabulary, swaps the word. Any candidate whose text is also a correct
// answer is dropped. Duplicates are dropped too.
//
// Anti-shortcut (DECISIONS #4, #40): the generator draws the answer's feature value
// uniformly, and the three distractors here are a uniform random subset of the paradigm.
// So given the four cards on screen, each card is equally likely to be the answer, and card
// text shape (length, prefixes, similarity) says nothing about which one it is.
import type { ArticleTable, Definiteness, Gender, GramNumber, Person, Verb } from './lexicon';
import { GENDERS, NUMBERS, PERSONS } from './lexicon';
import type { Rng } from './rng';

export const DISTRACTOR_COUNT = 3;

/**
 * Picks `DISTRACTOR_COUNT` distractors uniformly from `candidates`, after removing the
 * answer, every form in `correct` (correct-by-accident), and duplicate texts.
 */
export function pickDistractors(candidates: readonly string[], correct: ReadonlySet<string>, rng: Rng): string[] {
  const pool = [...new Set(candidates)].filter((c) => !correct.has(c));
  if (pool.length < DISTRACTOR_COUNT) {
    throw new Error(`only ${pool.length} distractor candidates left from [${candidates.join(', ')}]`);
  }
  return rng.shuffle(pool).slice(0, DISTRACTOR_COUNT);
}

/**
 * Verb blank: the same verb in other persons. `excludePersons` are persons of other
 * subjects in the same sentence. Leaving them out stops a player from ruling out a card by
 * matching the ending of a combo blank they have already seen answered (DECISIONS #41).
 */
export function verbDistractors(verb: Verb, person: Person, excludePersons: readonly Person[], rng: Rng): string[] {
  const answer = verb.present[person];
  const candidates = PERSONS.filter((p) => p !== person && !excludePersons.includes(p)).map((p) => verb.present[p]);
  return pickDistractors(candidates, new Set([answer]), rng);
}

/**
 * Article blank: the other cells of the gender x number paradigm. The full paradigm is
 * always shown, so the classic learner error (el espada for la espada) is always a card.
 */
export function articleDistractors(
  articles: ArticleTable,
  def: Definiteness,
  gender: Gender,
  num: GramNumber,
  rng: Rng,
): string[] {
  const answer = articles[def][gender][num];
  const candidates = GENDERS.flatMap((g) => NUMBERS.map((n) => articles[def][g][n]));
  return pickDistractors(candidates, new Set([answer]), rng);
}

/**
 * Whole-sentence answer, two features varied: a 2x2 grid of (right or wrong first feature)
 * x (right or wrong second feature). The grid is the same set of four whichever cell is
 * the answer, so it carries no answer information (DECISIONS #4). `render(a, b)` builds the
 * sentence with each feature right (false) or swapped (true).
 */
export function gridDistractors(render: (swapFirst: boolean, swapSecond: boolean) => string, rng: Rng): string[] {
  const answer = render(false, false);
  const cells = [render(true, false), render(false, true), render(true, true)];
  return pickDistractors(cells, new Set([answer]), rng);
}

/** Vocabulary: other words rendered the same way (with their own correct article). */
export function lemmaDistractors(answer: string, others: readonly string[], rng: Rng): string[] {
  return pickDistractors(others, new Set([answer]), rng);
}
