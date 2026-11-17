// Milestone 1 question set: 20 hand-picked questions built only from seed-lexicon Spanish.
// Milestone 2 replaces this with the template generator. All Spanish here is a draft
// pending native-speaker review.
//
// Distractor sets are drawn so that, given the four cards shown, each card is equally
// likely to be the answer (DECISIONS #4):
// - verb blanks: a uniform 4-subset of the six-person paradigm containing the answer,
//   and the answer persons are balanced across the set;
// - article blanks: the full 2x2 gender/number paradigm, answers balanced across cells;
// - translations: a 2x2 grid (right/wrong person x right/wrong gender article);
// - vocabulary: three other nouns drawn uniformly from the lexicon.
import templatesJson from './data/templates.json' with { type: 'json' };
import { assignStrike } from './directions';
import {
  PERSONS,
  PERSON_CODE,
  allNouns,
  article,
  noun,
  nounForm,
  verb,
  verbTakes,
  type Gender,
  type GramNumber,
  type Person,
} from './lexicon';
import { createRng, type Rng } from './rng';
import type { Question, QuestionKind, Strike } from './types';

interface Pronoun {
  id: string;
  surface: string;
  person: Person;
}
const PRONOUNS = new Map<string, Pronoun>((templatesJson.pronouns as Pronoun[]).map((p) => [p.id, p]));

function pronoun(id: string): Pronoun {
  const p = PRONOUNS.get(id);
  if (!p) throw new Error(`unknown pronoun ${id}`);
  return p;
}

interface Clause {
  /** Pronoun id from templates.json. */
  subj: string;
  verb: string;
  noun: string;
  number: GramNumber;
}

export type QuestionSpec =
  | { id: string; kind: 'vocab'; gloss: string; noun: string }
  | { id: string; kind: 'verb'; clause: Clause }
  | { id: string; kind: 'article'; clause: Clause }
  | { id: string; kind: 'translate'; gloss: string; clause: Clause; altPerson: Person }
  | { id: string; kind: 'combo'; clauses: [Clause, Clause] };

const sg = 'sg' as const;
const pl = 'pl' as const;

export const QUESTION_SPECS: readonly QuestionSpec[] = [
  // Overhead: present-tense conjugation, one question per person.
  { id: 'h_verb_yo', kind: 'verb', clause: { subj: 'yo', verb: 'v_levantar', noun: 'n_escudo', number: sg } },
  { id: 'h_verb_tu', kind: 'verb', clause: { subj: 'tu', verb: 'v_buscar', noun: 'n_llave', number: sg } },
  { id: 'h_verb_el', kind: 'verb', clause: { subj: 'ella', verb: 'v_cortar', noun: 'n_pan', number: sg } },
  { id: 'h_verb_nos', kind: 'verb', clause: { subj: 'nosotros', verb: 'v_abrir', noun: 'n_puerta', number: sg } },
  { id: 'h_verb_vos', kind: 'verb', clause: { subj: 'vosotros', verb: 'v_beber', noun: 'n_leche', number: sg } },
  { id: 'h_verb_ellos', kind: 'verb', clause: { subj: 'ellos', verb: 'v_escribir', noun: 'n_carta', number: sg } },
  // Overhead: definite article, one question per gender/number cell.
  { id: 'h_art_fsg', kind: 'article', clause: { subj: 'el', verb: 'v_levantar', noun: 'n_espada', number: sg } },
  { id: 'h_art_msg', kind: 'article', clause: { subj: 'yo', verb: 'v_mirar', noun: 'n_puente', number: sg } },
  { id: 'h_art_fpl', kind: 'article', clause: { subj: 'nosotros', verb: 'v_comer', noun: 'n_manzana', number: pl } },
  { id: 'h_art_mpl', kind: 'article', clause: { subj: 'tu', verb: 'v_llevar', noun: 'n_libro', number: pl } },
  // Delayed swing: translation.
  { id: 'h_tr_abrir', kind: 'translate', gloss: 'I open the door.', altPerson: 'el',
    clause: { subj: 'yo', verb: 'v_abrir', noun: 'n_puerta', number: sg } },
  { id: 'h_tr_comer', kind: 'translate', gloss: 'She eats the cheese.', altPerson: 'yo',
    clause: { subj: 'ella', verb: 'v_comer', noun: 'n_queso', number: sg } },
  { id: 'h_tr_mirar', kind: 'translate', gloss: 'We look at the tower.', altPerson: 'ellos',
    clause: { subj: 'nosotros', verb: 'v_mirar', noun: 'n_torre', number: sg } },
  { id: 'h_tr_vender', kind: 'translate', gloss: 'They sell the hammer.', altPerson: 'nosotros',
    clause: { subj: 'ellos', verb: 'v_vender', noun: 'n_martillo', number: sg } },
  // Jab: vocabulary.
  { id: 'h_voc_espada', kind: 'vocab', gloss: 'the sword', noun: 'n_espada' },
  { id: 'h_voc_escudo', kind: 'vocab', gloss: 'the shield', noun: 'n_escudo' },
  { id: 'h_voc_llave', kind: 'vocab', gloss: 'the key', noun: 'n_llave' },
  { id: 'h_voc_libro', kind: 'vocab', gloss: 'the book', noun: 'n_libro' },
  { id: 'h_voc_campana', kind: 'vocab', gloss: 'the bell', noun: 'n_campana' },
  // Combo: two blanks, two different persons.
  { id: 'h_combo_two', kind: 'combo', clauses: [
    { subj: 'ella', verb: 'v_levantar', noun: 'n_espada', number: sg },
    { subj: 'yo', verb: 'v_llevar', noun: 'n_escudo', number: sg },
  ] },
];

const BLANK = '___';

function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('es-ES') + s.slice(1);
}

function genderOf(nounId: string): Gender {
  return noun(nounId).gender;
}

function checkClause(c: Clause): void {
  const v = verb(c.verb);
  const n = noun(c.noun);
  if (!verbTakes(v, n)) throw new Error(`slot rule: ${v.id} cannot take ${n.id}`);
  pronoun(c.subj);
}

function clauseParts(c: Clause): { subj: string; verb: string; art: string; noun: string; person: Person } {
  const p = pronoun(c.subj);
  const n = noun(c.noun);
  return {
    subj: p.surface,
    verb: verb(c.verb).present[p.person],
    art: article('definite', n.gender, c.number),
    noun: nounForm(n, c.number),
    person: p.person,
  };
}

function verbComponent(verbId: string, person: Person): string {
  return `${verbId}:present:${PERSON_CODE[person]}`;
}

function articleComponent(gender: Gender, num: GramNumber): string {
  return `art:definite:${gender}:${num}`;
}

function verbStrike(verbId: string, person: Person, rng: Rng): Strike {
  const forms = verb(verbId).present;
  const others = rng.shuffle(PERSONS.filter((p) => p !== person)).slice(0, 3);
  return assignStrike(forms[person], others.map((p) => forms[p]), rng);
}

function articleStrike(gender: Gender, num: GramNumber, rng: Rng): Strike {
  const cells: [Gender, GramNumber][] = [['m', 'sg'], ['f', 'sg'], ['m', 'pl'], ['f', 'pl']];
  const wrong = cells.filter(([g, n]) => g !== gender || n !== num).map(([g, n]) => article('definite', g, n));
  return assignStrike(article('definite', gender, num), wrong, rng);
}

const KIND: Record<QuestionSpec['kind'], QuestionKind> = {
  vocab: 'vocab',
  verb: 'grammar',
  article: 'grammar',
  translate: 'translate',
  combo: 'combo',
};

/** Builds a question from a spec and a seed. The same pair always yields the same question. */
export function buildQuestion(spec: QuestionSpec, seed: number): Question {
  const rng = createRng(seed);
  const base = { id: spec.id, kind: KIND[spec.kind], seed };

  switch (spec.kind) {
    case 'vocab': {
      const answer = noun(spec.noun);
      const card = (id: string): string => {
        const n = noun(id);
        return `${article('definite', n.gender, 'sg')} ${n.lemma}`;
      };
      const pool = allNouns().filter((n) => n.id !== answer.id && n.lemma !== answer.lemma);
      const distractors = rng.shuffle(pool).slice(0, 3).map((n) => card(n.id));
      return {
        ...base,
        sentence: BLANK,
        prompt: `"${spec.gloss}"`,
        strikes: [assignStrike(card(answer.id), distractors, rng)],
        components: [answer.id],
      };
    }
    case 'verb': {
      checkClause(spec.clause);
      const p = clauseParts(spec.clause);
      return {
        ...base,
        sentence: `${capitalize(p.subj)} ${BLANK} ${p.art} ${p.noun}.`,
        prompt: `(${verb(spec.clause.verb).lemma})`,
        strikes: [verbStrike(spec.clause.verb, p.person, rng)],
        components: [verbComponent(spec.clause.verb, p.person)],
      };
    }
    case 'article': {
      checkClause(spec.clause);
      const p = clauseParts(spec.clause);
      const g = genderOf(spec.clause.noun);
      return {
        ...base,
        sentence: `${capitalize(p.subj)} ${p.verb} ${BLANK} ${p.noun}.`,
        prompt: 'Choose the article.',
        strikes: [articleStrike(g, spec.clause.number, rng)],
        components: [articleComponent(g, spec.clause.number)],
      };
    }
    case 'translate': {
      checkClause(spec.clause);
      const p = clauseParts(spec.clause);
      if (spec.altPerson === p.person) throw new Error(`${spec.id}: altPerson must differ`);
      const g = genderOf(spec.clause.noun);
      const wrongG: Gender = g === 'm' ? 'f' : 'm';
      const forms = verb(spec.clause.verb).present;
      const line = (person: Person, gender: Gender): string =>
        `${capitalize(p.subj)} ${forms[person]} ${article('definite', gender, spec.clause.number)} ${p.noun}.`;
      return {
        ...base,
        sentence: BLANK,
        prompt: `"${spec.gloss}"`,
        strikes: [
          assignStrike(line(p.person, g), [line(spec.altPerson, g), line(p.person, wrongG), line(spec.altPerson, wrongG)], rng),
        ],
        components: [verbComponent(spec.clause.verb, p.person), articleComponent(g, spec.clause.number)],
      };
    }
    case 'combo': {
      const [ca, cb] = spec.clauses;
      checkClause(ca);
      checkClause(cb);
      const a = clauseParts(ca);
      const b = clauseParts(cb);
      if (a.person === b.person) throw new Error(`${spec.id}: combo subjects need different persons`);
      return {
        ...base,
        sentence: `${capitalize(a.subj)} ${BLANK} ${a.art} ${a.noun} y ${b.subj} ${BLANK} ${b.art} ${b.noun}.`,
        prompt: `(${verb(ca.verb).lemma}) … (${verb(cb.verb).lemma})`,
        strikes: [verbStrike(ca.verb, a.person, rng), verbStrike(cb.verb, b.person, rng)],
        components: [verbComponent(ca.verb, a.person), verbComponent(cb.verb, b.person)],
      };
    }
  }
}

export function specById(id: string): QuestionSpec {
  const spec = QUESTION_SPECS.find((s) => s.id === id);
  if (!spec) throw new Error(`unknown question spec ${id}`);
  return spec;
}

/**
 * Draws questions in shuffled passes over the spec list. The number of RNG draws per
 * question does not depend on how the player answers, so a seed reproduces the sequence.
 */
export function createDeck(rng: Rng): () => Question {
  let pass: QuestionSpec[] = [];
  return () => {
    if (pass.length === 0) pass = rng.shuffle(QUESTION_SPECS);
    const spec = pass.pop() as QuestionSpec;
    return buildQuestion(spec, rng.nextSeed());
  };
}
