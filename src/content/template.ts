// Structural analysis of one template: which subject each verb agrees with, which noun each
// article agrees with, and every reference error. The validator reports the errors; the
// generator refuses to run on a template that has any.
import type { Content } from './lexicon';
import { FEATURE_PLACEHOLDER, parsePattern, placeholders, type PatternPart, type SlotPart } from './pattern';
import type { SlotDef, Template, VaryFeature } from './schema';

export const SENTENCE_BLANK = '$sentence';

export interface TemplateShape {
  parts: PatternPart[];
  /** Slot names in pattern order. */
  order: string[];
  /** Verb slot -> the subject slot it agrees with (nearest one before it). */
  verbSubject: Record<string, string>;
  /** Article slot -> the noun slot it agrees with (agreesWith, else the next noun). */
  articleNoun: Record<string, string>;
  /** Article slot -> definite or indefinite, from the pattern modifier. */
  articleDef: Record<string, 'definite' | 'indefinite'>;
  errors: string[];
}

const MODIFIERS: Record<SlotDef['type'], (string | null)[]> = {
  subject: [null],
  verb: ['present'],
  article: ['definite', 'indefinite'],
  noun: [null, 'plural'],
};

export function analyzeTemplate(t: Template, content: Content): TemplateShape {
  const errors: string[] = [];
  const err = (msg: string): void => {
    errors.push(`template ${t.id}: ${msg}`);
  };
  const parts = parsePattern(t.pattern);
  const slotParts = parts.filter((p): p is SlotPart => p.kind === 'slot');
  const order = slotParts.map((p) => p.slot);
  const slot = (name: string): SlotDef | undefined => t.slots[name];
  const typeOf = (name: string): SlotDef['type'] | undefined => slot(name)?.type;
  const position = (name: string): number => order.indexOf(name);

  // Pattern placeholders <-> declared slots.
  for (const p of slotParts) {
    const def = slot(p.slot);
    if (!def) {
      err(`pattern references unknown slot "${p.slot}"`);
      continue;
    }
    if (!MODIFIERS[def.type].includes(p.modifier)) err(`slot "${p.slot}" (${def.type}) has bad modifier "${p.modifier ?? ''}"`);
    if (def.type === 'noun' && (p.modifier === 'plural') !== (def.number === 'pl')) {
      err(`noun slot "${p.slot}" pattern form and "number" disagree`);
    }
  }
  for (const name of Object.keys(t.slots)) {
    const n = order.filter((o) => o === name).length;
    if (n === 0) err(`slot "${name}" is declared but not in the pattern`);
    if (n > 1) err(`slot "${name}" appears ${n} times in the pattern`);
  }

  const verbSubject: Record<string, string> = {};
  const articleNoun: Record<string, string> = {};
  const articleDef: Record<string, 'definite' | 'indefinite'> = {};

  const refersEarlier = (from: string, field: string, to: string, type: SlotDef['type']): void => {
    if (typeOf(to) !== type) err(`slot "${from}".${field} must name a ${type} slot, got "${to}"`);
    else if (position(to) > position(from)) err(`slot "${from}".${field} must name an earlier slot`);
  };

  for (const [name, def] of Object.entries(t.slots)) {
    const nounOnly = ['number', 'requires', 'tags', 'excludeTags', 'distinctFrom'] as const;
    for (const f of nounOnly) if (def[f] !== undefined && def.type !== 'noun') err(`"${f}" is only for noun slots (slot "${name}")`);
    if (def.agreesWith !== undefined && def.type !== 'article') err(`"agreesWith" is only for article slots (slot "${name}")`);
    if (def.distinctPersonFrom !== undefined && def.type !== 'subject') err(`"distinctPersonFrom" is only for subject slots`);

    switch (def.type) {
      case 'noun': {
        if (!def.number) err(`noun slot "${name}" needs "number"`);
        if (def.requires) {
          const verbSlot = def.requires.split('.')[0] ?? '';
          if (typeOf(verbSlot) !== 'verb') err(`slot "${name}" requires "${def.requires}" but "${verbSlot}" is not a verb slot`);
        }
        for (const tag of [...(def.tags ?? []), ...(def.excludeTags ?? [])]) {
          if (!content.nounTags.has(tag)) err(`slot "${name}" references missing tag "${tag}" (no noun carries it)`);
        }
        if (def.distinctFrom) refersEarlier(name, 'distinctFrom', def.distinctFrom, 'noun');
        break;
      }
      case 'verb': {
        const before = order.slice(0, Math.max(0, position(name))).filter((s) => typeOf(s) === 'subject');
        const subj = before[before.length - 1];
        if (subj) verbSubject[name] = subj;
        else err(`verb slot "${name}" has no subject before it`);
        break;
      }
      case 'article': {
        const part = slotParts.find((p) => p.slot === name);
        if (part?.modifier === 'definite' || part?.modifier === 'indefinite') articleDef[name] = part.modifier;
        const target = def.agreesWith ?? order.slice(position(name) + 1).find((s) => typeOf(s) === 'noun');
        if (!target || typeOf(target) !== 'noun') err(`article slot "${name}" has no noun to agree with`);
        else articleNoun[name] = target;
        break;
      }
      case 'subject':
        if (def.distinctPersonFrom) refersEarlier(name, 'distinctPersonFrom', def.distinctPersonFrom, 'subject');
        break;
    }
  }

  // Blanks and distractors.
  const sentenceBlank = t.blanks.includes(SENTENCE_BLANK);
  if (sentenceBlank && t.blanks.length !== 1) err(`"${SENTENCE_BLANK}" must be the only blank`);
  if (new Set(t.blanks).size !== t.blanks.length) err('blanks repeat');
  if (t.kind === 'combo' ? t.blanks.length < 2 : t.blanks.length !== 1) err(`kind "${t.kind}" has ${t.blanks.length} blanks`);
  for (const b of t.blanks) {
    if (b === SENTENCE_BLANK) continue;
    const type = typeOf(b);
    if (type !== 'verb' && type !== 'article') err(`blank "${b}" must be a verb or article slot`);
  }
  const distractorKeys = Object.keys(t.distractors).sort();
  if (distractorKeys.join() !== [...t.blanks].sort().join()) err('distractors must have exactly one entry per blank');

  const same = (a: readonly string[], b: readonly string[]): boolean => [...a].sort().join() === [...b].sort().join();
  for (const b of t.blanks) {
    const vary = t.distractors[b]?.vary ?? [];
    if (new Set(vary).size !== vary.length) err(`blank "${b}" repeats a vary feature`);
    if (b === SENTENCE_BLANK) {
      const nounSlots = order.filter((s) => typeOf(s) === 'noun');
      if (vary.includes('lemma')) {
        if (vary.length !== 1 || nounSlots.length !== 1) err('"lemma" needs to be the only vary feature, with exactly one noun slot');
      } else if (vary.length !== 2) {
        err(`"${SENTENCE_BLANK}" varies exactly two features to make a 2x2 card grid`);
      }
      const carrier: Record<VaryFeature, SlotDef['type']> = { person: 'verb', gender: 'article', number: 'article', lemma: 'noun' };
      for (const f of vary) if (!order.some((s) => typeOf(s) === carrier[f])) err(`vary "${f}" has no ${carrier[f]} slot to change`);
    } else if (typeOf(b) === 'verb' && !same(vary, ['person'])) {
      err(`verb blank "${b}" must vary ["person"]`);
    } else if (typeOf(b) === 'article' && !same(vary, ['gender', 'number'])) {
      // Four cards need the whole gender x number paradigm (DECISIONS #21).
      err(`article blank "${b}" must vary ["gender", "number"]`);
    }
  }

  // Free-text placeholders.
  const checkPlaceholder = (where: string, name: string, allowed: SlotDef['type'][]): void => {
    const feature = FEATURE_PLACEHOLDER.exec(name);
    if (typeOf(name) && allowed.includes(typeOf(name) as SlotDef['type'])) return;
    if (feature && where === 'tests') {
      const [, f, n] = feature;
      const target = `${f === 'person' ? 'subj' : 'noun'}${n ?? ''}`;
      const want = f === 'person' ? 'subject' : 'noun';
      if (typeOf(target) !== want) err(`${where} placeholder {${name}} needs a ${want} slot "${target}"`);
      return;
    }
    err(`${where} placeholder {${name}} does not name a usable slot`);
  };
  for (const test of t.tests) for (const p of placeholders(test)) checkPlaceholder('tests', p, ['verb', 'noun']);
  if (t.kind === 'vocab' || t.kind === 'translate') {
    if (!t.gloss_en) err(`kind "${t.kind}" needs gloss_en`);
  }
  if (t.gloss_en) {
    for (const p of placeholders(t.gloss_en)) {
      checkPlaceholder('gloss_en', p, ['subject', 'verb', 'noun']);
      if (typeOf(p) === 'noun' && slot(p)?.number !== 'sg') err(`gloss_en uses plural noun "${p}"; only singular glosses exist`);
    }
  }

  return { parts, order, verbSubject, articleNoun, articleDef, errors };
}
