// Knowledge components (SPEC 6) as seen from the content side: which components a zone can
// teach, which components a strike tests, and how a component looks on a card.
// Pure: no DOM, no clock.
import { nounMatches } from './generator';
import { CONTENT, GENDERS, PERSONS, PERSON_CODE, type Content, type Person } from './lexicon';
import { FEATURE_PLACEHOLDER, fillPlaceholders, placeholders } from './pattern';
import type { SlotDef, Template } from './schema';
import type { Question } from './types';

const PERSON_FROM_CODE = Object.fromEntries(Object.entries(PERSON_CODE).map(([p, code]) => [code, p as Person])) as Record<
  string,
  Person
>;

/** Components tested by one strike: all of them for a single-blank question, else the blank's own. */
export function strikeComponents(q: Question, strike: number): string[] {
  if (q.strikes.length === 1) return q.components;
  const c = q.components[strike];
  return c === undefined ? [] : [c];
}

/**
 * Card texts that stand for a component when it is the answer: `v_levantar:present:3sg` ->
 * `levanta`, `art:definite:f:sg` -> `la`, `n_espada` -> `la espada` (the vocabulary card).
 * Components that never appear as a card (`n_manzana:plural`, carried by the sentence) give [].
 */
export function componentSurfaces(id: string, content: Content = CONTENT): string[] {
  let m = /^(v_[^:]+):present:(\w+)$/.exec(id);
  if (m) {
    const person = PERSON_FROM_CODE[m[2] ?? ''];
    const verb = content.verbs.find((v) => v.id === m?.[1]);
    return verb && person ? [verb.present[person]] : [];
  }
  m = /^art:(definite|indefinite):(m|f):(sg|pl)$/.exec(id);
  if (m) {
    const [, def, g, n] = m as unknown as [string, 'definite' | 'indefinite', 'm' | 'f', 'sg' | 'pl'];
    return [content.articles[def][g][n]];
  }
  m = /^(n_[^:]+)$/.exec(id);
  if (m) {
    const noun = content.nouns.find((n) => n.id === m?.[1]);
    return noun ? [`${content.articles.definite[noun.gender].sg} ${noun.lemma}`] : [];
  }
  return [];
}

const lower = (s: string): string => s.toLocaleLowerCase('es-ES');

/**
 * True when some strike of the question shows the component on one of its cards, whether as
 * the answer or as a distractor. This depends on the card set only, so a question accepted by
 * it keeps every card in its set equally likely to be the answer (DECISIONS #40, #58).
 */
export function showsOnCards(q: Question, id: string, content: Content = CONTENT): boolean {
  const surfaces = componentSurfaces(id, content).map(lower);
  if (surfaces.length === 0) return false;
  return q.strikes.some((s) => Object.values(s.options).some((text) => surfaces.includes(lower(text))));
}

/** Can a component ever show on a card? */
export function cardRepresentable(id: string, content: Content = CONTENT): boolean {
  return componentSurfaces(id, content).length > 0;
}

/** Every value a test placeholder can take in a template, given the slot filters and slot rule. */
function placeholderValues(t: Template, name: string, content: Content): string[] {
  const def = t.slots[name] as SlotDef | undefined;
  const nounSlotFor = (verbSlot: string): [string, SlotDef] | undefined =>
    Object.entries(t.slots).find(([, d]) => d.type === 'noun' && d.requires?.split('.')[0] === verbSlot);
  const nounsFor = (slot: string): string[] => {
    const d = t.slots[slot] as SlotDef;
    const verbSlot = d.requires?.split('.')[0];
    return content.nouns
      .filter((n) => (verbSlot ? content.verbs.some((v) => nounMatches(d, n, v)) : nounMatches(d, n, null)))
      .map((n) => n.id);
  };

  if (def?.type === 'verb') {
    const ns = nounSlotFor(name);
    return content.verbs.filter((v) => !ns || content.nouns.some((n) => nounMatches(ns[1], n, v))).map((v) => v.id);
  }
  if (def?.type === 'noun') return nounsFor(name);
  const [, feature, n = ''] = FEATURE_PLACEHOLDER.exec(name) ?? [];
  if (feature === 'person') return PERSONS.filter((p) => content.pronouns.some((pr) => pr.person === p)).map((p) => PERSON_CODE[p]);
  if (feature === 'gender') {
    const ids = new Set(nounsFor(`noun${n}`));
    return GENDERS.filter((g) => content.nouns.some((x) => ids.has(x.id) && x.gender === g));
  }
  if (feature === 'number') return [(t.slots[`noun${n}`] as SlotDef).number ?? 'sg'];
  throw new Error(`components: template ${t.id} placeholder ${name}`);
}

/** Every component one template can test. */
export function templateComponents(t: Template, content: Content = CONTENT): string[] {
  const out = new Set<string>();
  for (const test of t.tests) {
    const names = [...new Set(placeholders(test))];
    let combos: Record<string, string>[] = [{}];
    for (const name of names) {
      const values = placeholderValues(t, name, content);
      combos = combos.flatMap((c) => values.map((v) => ({ ...c, [name]: v })));
    }
    for (const c of combos) out.add(fillPlaceholders(test, (name) => c[name] as string));
  }
  return [...out];
}

/** The zone's component universe: everything its templates can test (the gate counts these). */
export function zoneComponents(zone: number, content: Content = CONTENT): string[] {
  const all = new Set<string>();
  for (const t of content.templates.filter((x) => x.zone === zone)) for (const c of templateComponents(t, content)) all.add(c);
  return [...all].sort();
}
