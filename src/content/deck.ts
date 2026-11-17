// Question source for a fight: each draw picks a zone template uniformly and independently,
// then generates one question from it. Equal template weights keep the singular and plural
// article templates equally likely, so article answers stay uniform over the paradigm
// (DECISIONS #40). Draws are independent, not shuffled passes: with passes, the previous
// question predicts the next template (the one just used is used up), and a bot that
// reads the last revealed answer beat chance on article questions (DECISIONS #42).
// RNG draws per question do not depend on the player's answers, so a seed reproduces the fight.
import { generate } from './generator';
import { CONTENT, type Content } from './lexicon';
import type { Rng } from './rng';
import type { Template } from './schema';
import type { Question } from './types';

export function zoneTemplates(zone: number, content: Content = CONTENT): Template[] {
  return content.templates.filter((t) => t.zone === zone);
}

export function createDeck(rng: Rng, templates: readonly Template[] = zoneTemplates(1), content: Content = CONTENT): () => Question {
  if (templates.length === 0) throw new Error('deck needs at least one template');
  return () => {
    const t = rng.pick(templates);
    return generate(t, rng.nextSeed(), content);
  };
}

/** Rebuilds a question from its bug-report tag `templateId#seed`. */
export function questionFromTag(tag: string, content: Content = CONTENT): Question {
  const [id = '', seed = ''] = tag.split('#');
  return generate(content.template(id), Number(seed), content);
}
