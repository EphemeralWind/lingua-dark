// Typed, indexed access to the content JSON. The JSON is schema-checked at build time and in
// tests (validate.ts), so this module only indexes it. `buildContent` takes the raw files so
// tests can inject modified copies.
import lexiconJson from './data/lexicon.json' with { type: 'json' };
import templatesJson from './data/templates.json' with { type: 'json' };
import type { LexiconFile, NounEntry, Template, TemplatesFile, VerbEntry } from './schema';

export type Gender = 'm' | 'f';
export type GramNumber = 'sg' | 'pl';
export type Person = 'yo' | 'tu' | 'el' | 'nosotros' | 'vosotros' | 'ellos';
export type Definiteness = 'definite' | 'indefinite';

export const PERSONS: readonly Person[] = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'];
export const GENDERS: readonly Gender[] = ['m', 'f'];
export const NUMBERS: readonly GramNumber[] = ['sg', 'pl'];

/** Canonical component person codes (DECISIONS #23). */
export const PERSON_CODE: Record<Person, string> = {
  yo: '1sg',
  tu: '2sg',
  el: '3sg',
  nosotros: '1pl',
  vosotros: '2pl',
  ellos: '3pl',
};

export type Noun = NounEntry;
export type Verb = VerbEntry;

export interface Pronoun {
  id: string;
  surface: string;
  person: Person;
  gloss_en: string;
}

export type ArticleTable = Record<Definiteness, Record<Gender, Record<GramNumber, string>>>;

export interface Content {
  nouns: readonly Noun[];
  verbs: readonly Verb[];
  pronouns: readonly Pronoun[];
  articles: ArticleTable;
  templates: readonly Template[];
  /** Every tag carried by at least one noun. */
  nounTags: ReadonlySet<string>;
  noun(id: string): Noun;
  verb(id: string): Verb;
  pronoun(id: string): Pronoun;
  template(id: string): Template;
}

function indexBy<T extends { id: string }>(items: readonly T[], what: string): (id: string) => T {
  const map = new Map(items.map((x) => [x.id, x]));
  return (id) => {
    const x = map.get(id);
    if (!x) throw new Error(`unknown ${what} ${id}`);
    return x;
  };
}

export function buildContent(lexicon: LexiconFile, templates: TemplatesFile): Content {
  const nouns = lexicon.entries.filter((e): e is Noun => e.pos === 'noun');
  const verbs = lexicon.entries.filter((e): e is Verb => e.pos === 'verb');
  return {
    nouns,
    verbs,
    pronouns: templates.pronouns,
    articles: templates.articles,
    templates: templates.templates,
    nounTags: new Set(nouns.flatMap((n) => n.tags)),
    noun: indexBy(nouns, 'noun'),
    verb: indexBy(verbs, 'verb'),
    pronoun: indexBy(templates.pronouns, 'pronoun'),
    template: indexBy(templates.templates, 'template'),
  };
}

/** The bundled seed content. */
export const CONTENT: Content = buildContent(lexiconJson as unknown as LexiconFile, templatesJson as unknown as TemplatesFile);

/** Noun form for a number. */
export function nounForm(n: Noun, num: GramNumber): string {
  return num === 'sg' ? n.lemma : n.plural;
}

/** The slot rule from SPEC 5.3: verb.takes must intersect noun.tags. */
export function verbTakes(v: Verb, n: Noun): boolean {
  return v.takes.some((t) => n.tags.includes(t));
}
