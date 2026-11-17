import type { Rng } from './rng';
import { DIRECTIONS, type Direction, type Strike } from './types';

/**
 * Places the answer and three distractors on the four directions, uniformly at random.
 * Each strike is placed independently of every other strike (DECISIONS #3).
 */
export function assignStrike(answer: string, distractors: readonly string[], rng: Rng): Strike {
  if (distractors.length !== 3) throw new Error(`need exactly 3 distractors, got ${distractors.length}`);
  const all = [answer, ...distractors];
  if (new Set(all).size !== 4) throw new Error(`duplicate card text in [${all.join(', ')}]`);

  const order = rng.shuffle(DIRECTIONS);
  const options = {} as Record<Direction, string>;
  let correct: Direction | undefined;
  all.forEach((text, i) => {
    const dir = order[i] as Direction;
    options[dir] = text;
    if (text === answer) correct = dir;
  });
  if (correct === undefined) throw new Error('unreachable: answer not placed');
  return { options, correct };
}
