// Typed access to the seed lexicon and article tables. Schema validation arrives in milestone 2;
// until then this module checks the few fields milestone 1 relies on.
import lexiconJson from './data/lexicon.json' with { type: 'json' };
import templatesJson from './data/templates.json' with { type: 'json' };

export type Gender = 'm' | 'f';
export type GramNumber = 'sg' | 'pl';
export type Person = 'yo' | 'tu' | 'el' | 'nosotros' | 'vosotros' | 'ellos';
export type Definiteness = 'definite' | 'indefinite';

export const PERSONS: readonly Person[] = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'];

/** Canonical component person codes (DECISIONS #23). */
export const PERSON_CODE: Record<Person, string> = {
  yo: '1sg',
  tu: '2sg',
  el: '3sg',
  nosotros: '1pl',
  vosotros: '2pl',
  ellos: '3pl',
};

export interface Noun {
  id: string;
  lemma: string;
  gender: Gender;
  plural: string;
  tags: string[];
}

export interface Verb {
  id: string;
  lemma: string;
  takes: string[];
  present: Record<Person, string>;
}

interface RawEntry {
  id: string;
  pos: string;
  lemma: string;
  gender?: string;
  plural?: string;
  tags?: string[];
  takes?: string[];
  present?: Record<string, string>;
}

const nouns = new Map<string, Noun>();
const verbs = new Map<string, Verb>();

for (const raw of lexiconJson.entries as RawEntry[]) {
  if (raw.pos === 'noun') {
    if ((raw.gender !== 'm' && raw.gender !== 'f') || !raw.plural || !raw.tags) {
      throw new Error(`lexicon: bad noun ${raw.id}`);
    }
    nouns.set(raw.id, { id: raw.id, lemma: raw.lemma, gender: raw.gender, plural: raw.plural, tags: raw.tags });
  } else if (raw.pos === 'verb') {
    const present = raw.present;
    if (!present || !raw.takes || PERSONS.some((p) => typeof present[p] !== 'string')) {
      throw new Error(`lexicon: bad verb ${raw.id}`);
    }
    verbs.set(raw.id, { id: raw.id, lemma: raw.lemma, takes: raw.takes, present: present as Record<Person, string> });
  }
}

const articleTable = templatesJson.articles as Record<Definiteness, Record<Gender, Record<GramNumber, string>>>;

export function noun(id: string): Noun {
  const n = nouns.get(id);
  if (!n) throw new Error(`lexicon: unknown noun ${id}`);
  return n;
}

export function verb(id: string): Verb {
  const v = verbs.get(id);
  if (!v) throw new Error(`lexicon: unknown verb ${id}`);
  return v;
}

export function allNouns(): Noun[] {
  return [...nouns.values()];
}

export function article(def: Definiteness, gender: Gender, num: GramNumber): string {
  return articleTable[def][gender][num];
}

/** Noun form for a number. */
export function nounForm(n: Noun, num: GramNumber): string {
  return num === 'sg' ? n.lemma : n.plural;
}

/** The slot rule from SPEC 5.3: verb.takes must intersect noun.tags. */
export function verbTakes(v: Verb, n: Noun): boolean {
  return v.takes.some((t) => n.tags.includes(t));
}
