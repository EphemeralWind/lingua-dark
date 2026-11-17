// Procedural question generator (SPEC 5.3, 9). Pure: a template, a seed and the content in,
// a Question out. The same (template, seed, content) always gives the same question, card
// placement included, so a bug report's `id#seed` tag reproduces the exact sentence.
//
// Sampling is feature-first (DECISIONS #4): each subject's grammatical person is drawn
// uniformly, then a pronoun of that person; each noun's gender is drawn uniformly, then a
// verb that can take a noun of that gender (slot rule), then the noun.
import { assignStrike } from './directions';
import { articleDistractors, gridDistractors, lemmaDistractors, verbDistractors } from './distractors';
import {
  CONTENT,
  GENDERS,
  PERSONS,
  PERSON_CODE,
  nounForm,
  verbTakes,
  type Content,
  type Definiteness,
  type Gender,
  type GramNumber,
  type Noun,
  type Person,
  type Verb,
} from './lexicon';
import { FEATURE_PLACEHOLDER, capitalizeFirst, fillPlaceholders, isSentence } from './pattern';
import { createRng, type Rng } from './rng';
import type { SlotDef, Template } from './schema';
import { SENTENCE_BLANK, analyzeTemplate, type TemplateShape } from './template';
import type { Question, Strike } from './types';

export const BLANK = '___';

export type SlotFill =
  | { type: 'subject'; pronoun: string; person: Person }
  | { type: 'verb'; verb: string; subject: string }
  | { type: 'noun'; noun: string; number: GramNumber }
  | { type: 'article'; definiteness: Definiteness; noun: string };

export interface Generated {
  question: Question;
  /** What went into each slot, so tests can check agreement independently. */
  fills: Record<string, SlotFill>;
}

/** Changes applied to a whole-sentence render to build a distractor. */
interface Overrides {
  person?: Person;
  gender?: Gender;
  number?: GramNumber;
  noun?: string;
}

/** Filters a noun slot puts on its noun, plus the slot rule when a verb is given. */
export function nounMatches(def: SlotDef, n: Noun, verb: Verb | null): boolean {
  if (def.tags && !def.tags.every((t) => n.tags.includes(t))) return false;
  if (def.excludeTags?.some((t) => n.tags.includes(t))) return false;
  return verb === null || verbTakes(verb, n);
}

const shapeCache = new WeakMap<Template, TemplateShape>();

function shapeOf(t: Template, content: Content): TemplateShape {
  let shape = shapeCache.get(t);
  if (!shape) {
    shape = analyzeTemplate(t, content);
    shapeCache.set(t, shape);
  }
  if (shape.errors.length > 0) throw new Error(shape.errors.join('\n'));
  return shape;
}

function pickOrFail<T>(rng: Rng, items: readonly T[], what: string): T {
  if (items.length === 0) throw new Error(`generator: no ${what}`);
  return rng.pick(items);
}

function fillSlots(t: Template, shape: TemplateShape, content: Content, rng: Rng): Record<string, SlotFill> {
  const fills: Record<string, SlotFill> = {};
  const def = (name: string): SlotDef => t.slots[name] as SlotDef;
  const ofType = (type: SlotDef['type']): string[] => shape.order.filter((s) => def(s).type === type);

  for (const name of ofType('subject')) {
    const other = def(name).distinctPersonFrom;
    const banned = other ? (fills[other] as Extract<SlotFill, { type: 'subject' }>).person : null;
    const persons = PERSONS.filter((p) => p !== banned && content.pronouns.some((pr) => pr.person === p));
    const person = pickOrFail(rng, persons, `person for ${name}`);
    const pronoun = rng.pick(content.pronouns.filter((pr) => pr.person === person));
    fills[name] = { type: 'subject', pronoun: pronoun.id, person };
  }

  for (const name of ofType('noun')) {
    const d = def(name);
    const verbSlot = d.requires?.split('.')[0] ?? null;
    const chosenVerb = verbSlot && fills[verbSlot] ? content.verb((fills[verbSlot] as Extract<SlotFill, { type: 'verb' }>).verb) : null;
    const taken = d.distinctFrom ? (fills[d.distinctFrom] as Extract<SlotFill, { type: 'noun' }>).noun : null;
    const ok = (n: Noun, v: Verb | null): boolean => n.id !== taken && nounMatches(d, n, v);
    const verbOptions: (Verb | null)[] = verbSlot === null ? [null] : chosenVerb ? [chosenVerb] : [...content.verbs];
    const fits = (g: Gender, v: Verb | null): boolean => content.nouns.some((n) => n.gender === g && ok(n, v));

    const gender = pickOrFail(rng, GENDERS.filter((g) => verbOptions.some((v) => fits(g, v))), `gender for ${name}`);
    const verb = verbSlot === null ? null : (chosenVerb ?? rng.pick(content.verbs.filter((v) => fits(gender, v))));
    if (verbSlot && verb && !chosenVerb) fills[verbSlot] = { type: 'verb', verb: verb.id, subject: shape.verbSubject[verbSlot] as string };
    const noun = rng.pick(content.nouns.filter((n) => n.gender === gender && ok(n, verb)));
    fills[name] = { type: 'noun', noun: noun.id, number: d.number as GramNumber };
  }

  for (const name of ofType('verb')) {
    if (!fills[name]) fills[name] = { type: 'verb', verb: rng.pick(content.verbs).id, subject: shape.verbSubject[name] as string };
  }
  for (const name of ofType('article')) {
    fills[name] = { type: 'article', definiteness: shape.articleDef[name] as Definiteness, noun: shape.articleNoun[name] as string };
  }
  return fills;
}

export function generateDetailed(t: Template, seed: number, content: Content = CONTENT): Generated {
  const shape = shapeOf(t, content);
  const rng = createRng(seed);
  const fills = fillSlots(t, shape, content, rng);

  const fill = <K extends SlotFill['type']>(name: string, type: K): Extract<SlotFill, { type: K }> => {
    const f = fills[name];
    if (f?.type !== type) throw new Error(`generator: slot ${name} is not a ${type}`);
    return f as Extract<SlotFill, { type: K }>;
  };
  const personOf = (verbSlot: string): Person => fill(fill(verbSlot, 'verb').subject, 'subject').person;
  const nounOf = (nounSlot: string): Noun => content.noun(fill(nounSlot, 'noun').noun);

  const slotText = (name: string, ov: Overrides): string => {
    const f = fills[name] as SlotFill;
    switch (f.type) {
      case 'subject':
        return content.pronoun(f.pronoun).surface;
      case 'verb':
        return content.verb(f.verb).present[ov.person ?? personOf(name)];
      case 'noun':
        return nounForm(content.noun(ov.noun ?? f.noun), f.number);
      case 'article': {
        const n = content.noun(ov.noun ?? fill(f.noun, 'noun').noun);
        return content.articles[f.definiteness][ov.gender ?? n.gender][ov.number ?? fill(f.noun, 'noun').number];
      }
    }
  };

  const sentence = isSentence(t.pattern);
  // If a sentence opens with a blank, its cards carry the capital letter instead.
  const firstLettered = shape.parts.find((p) => p.kind === 'slot' || /\p{L}/u.test(p.text));
  const openingBlank = sentence && firstLettered?.kind === 'slot' && t.blanks.includes(firstLettered.slot) ? firstLettered.slot : null;

  const render = (ov: Overrides, blanks: ReadonlySet<string>): string => {
    const text = shape.parts.map((p) => (p.kind === 'literal' ? p.text : blanks.has(p.slot) ? BLANK : slotText(p.slot, ov))).join('');
    return sentence && openingBlank === null ? capitalizeFirst(text) : text;
  };

  const none = new Set<string>();
  const strikes: Strike[] = [];
  const hints: string[] = [];
  for (const blank of t.blanks) {
    const vary = t.distractors[blank]?.vary ?? [];
    if (blank === SENTENCE_BLANK) {
      const answer = render({}, none);
      let distractors: string[];
      if (vary[0] === 'lemma') {
        const nounSlot = shape.order.find((s) => t.slots[s]?.type === 'noun') as string;
        const d = t.slots[nounSlot] as SlotDef;
        const self = nounOf(nounSlot);
        const others = content.nouns.filter((n) => n.id !== self.id && n.gloss_en !== self.gloss_en && nounMatches(d, n, null));
        distractors = lemmaDistractors(answer, others.map((n) => render({ noun: n.id }, none)), rng);
      } else {
        distractors = gridDistractors(gridRender(vary, render, personOf, nounOf, shape, fills, content, rng), rng);
      }
      strikes.push(assignStrike(answer, distractors, rng));
      continue;
    }

    const f = fills[blank] as SlotFill;
    let answer: string;
    let distractors: string[];
    if (f.type === 'verb') {
      const v = content.verb(f.verb);
      const person = personOf(blank);
      // Persons of the other subjects in this sentence (DECISIONS #41).
      const others = shape.order
        .filter((s) => s !== f.subject && fills[s]?.type === 'subject')
        .map((s) => fill(s, 'subject').person);
      answer = v.present[person];
      distractors = verbDistractors(v, person, others, rng);
      hints.push(`(${v.lemma})`);
    } else if (f.type === 'article') {
      const n = nounOf(f.noun);
      const num = fill(f.noun, 'noun').number;
      answer = content.articles[f.definiteness][n.gender][num];
      distractors = articleDistractors(content.articles, f.definiteness, n.gender, num, rng);
      hints.push('(article)');
    } else {
      throw new Error(`generator: blank ${blank} is a ${f.type}`);
    }
    if (blank === openingBlank) {
      answer = capitalizeFirst(answer);
      distractors = distractors.map(capitalizeFirst);
    }
    strikes.push(assignStrike(answer, distractors, rng));
  }

  let prompt: string;
  if (t.gloss_en) {
    const gloss = fillPlaceholders(t.gloss_en, (name) => {
      const f = fills[name] as SlotFill;
      if (f.type === 'subject') return content.pronoun(f.pronoun).gloss_en;
      if (f.type === 'verb') return personOf(name) === 'el' ? content.verb(f.verb).gloss_en.s3 : content.verb(f.verb).gloss_en.base;
      if (f.type === 'noun') return content.noun(f.noun).gloss_en;
      throw new Error(`generator: gloss placeholder ${name}`);
    });
    prompt = `"${isSentence(t.gloss_en) ? capitalizeFirst(gloss) : gloss}"`;
  } else {
    prompt = hints.length === 1 && hints[0] === '(article)' ? 'Choose the article.' : hints.join(' … ');
  }

  const components = t.tests.map((test) =>
    fillPlaceholders(test, (name) => {
      const f = fills[name];
      if (f?.type === 'verb') return f.verb;
      if (f?.type === 'noun') return f.noun;
      const [, feature, n = ''] = FEATURE_PLACEHOLDER.exec(name) ?? [];
      if (feature === 'person') return PERSON_CODE[fill(`subj${n}`, 'subject').person];
      if (feature === 'gender') return nounOf(`noun${n}`).gender;
      if (feature === 'number') return fill(`noun${n}`, 'noun').number;
      throw new Error(`generator: test placeholder ${name}`);
    }),
  );

  const blanks = new Set(t.blanks);
  const question: Question = {
    id: t.id,
    kind: t.kind,
    sentence: blanks.has(SENTENCE_BLANK) ? BLANK : render({}, blanks),
    prompt,
    strikes,
    components,
    seed,
  };
  return { question, fills };
}

/** Builds the 2x2 grid renderer for a whole-sentence answer that varies two features. */
function gridRender(
  vary: readonly string[],
  render: (ov: Overrides, blanks: ReadonlySet<string>) => string,
  personOf: (verbSlot: string) => Person,
  nounOf: (nounSlot: string) => Noun,
  shape: TemplateShape,
  fills: Record<string, SlotFill>,
  content: Content,
  rng: Rng,
): (swapFirst: boolean, swapSecond: boolean) => string {
  const verbSlots = shape.order.filter((s) => fills[s]?.type === 'verb');
  const articleSlots = shape.order.filter((s) => fills[s]?.type === 'article');
  const swaps = vary.map((feature): Overrides => {
    if (feature === 'person') {
      const first = verbSlots[0] as string;
      const person = personOf(first);
      const verbs = verbSlots.map((s) => content.verb((fills[s] as Extract<SlotFill, { type: 'verb' }>).verb));
      const alts = PERSONS.filter((p) => verbs.every((v) => v.present[p] !== v.present[person]));
      return { person: pickOrFail(rng, alts, 'alternative person') };
    }
    const art = fills[articleSlots[0] as string] as Extract<SlotFill, { type: 'article' }>;
    if (feature === 'gender') return { gender: nounOf(art.noun).gender === 'm' ? 'f' : 'm' };
    if (feature === 'number') return { number: (fills[art.noun] as Extract<SlotFill, { type: 'noun' }>).number === 'sg' ? 'pl' : 'sg' };
    throw new Error(`generator: cannot vary ${feature} in a sentence grid`);
  });
  const none = new Set<string>();
  return (a, b) => render({ ...(a ? swaps[0] : {}), ...(b ? swaps[1] : {}) }, none);
}

export function generate(t: Template, seed: number, content: Content = CONTENT): Question {
  return generateDetailed(t, seed, content).question;
}
