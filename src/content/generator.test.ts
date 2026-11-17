// Every template over 1,000 seeds (SPEC 10, CLAUDE.md): agreement, slot rule, capitalisation,
// card sets with no duplicates and no correct-by-accident distractors, and reproducibility.
// Agreement is checked against an independent re-render built straight from the lexicon,
// not through the generator's own rendering code.
import { describe, expect, it } from 'vitest';
import lexiconJson from './data/lexicon.json' with { type: 'json' };
import templatesJson from './data/templates.json' with { type: 'json' };
import { BLANK, generate, generateDetailed, type SlotFill } from './generator';
import { CONTENT, PERSONS, buildContent, verbTakes, type Person } from './lexicon';
import type { LexiconFile, Template, TemplatesFile } from './schema';
import { DIRECTIONS, type Question, type Strike } from './types';

const SEEDS = 1000;
const C = CONTENT;

type Fills = Record<string, SlotFill>;
const get = <K extends SlotFill['type']>(fills: Fills, name: string, type: K): Extract<SlotFill, { type: K }> => {
  const f = fills[name];
  if (f?.type !== type) throw new Error(`${name} is not ${type}`);
  return f as Extract<SlotFill, { type: K }>;
};
const personOfVerb = (fills: Fills, verbSlot: string): Person => get(fills, get(fills, verbSlot, 'verb').subject, 'subject').person;

/** Independent render: the pattern with every placeholder replaced from the lexicon. */
function expectedText(t: Template, fills: Fills): string {
  const text = t.pattern.replace(/\}\{/g, '} {').replace(/\{(\w+)(?::(\w+))?\}/g, (_m, name: string, mod?: string) => {
    const f = fills[name];
    if (!f) throw new Error(`no fill for ${name}`);
    switch (f.type) {
      case 'subject':
        return C.pronoun(f.pronoun).surface;
      case 'verb':
        return C.verb(f.verb).present[personOfVerb(fills, name)];
      case 'noun': {
        const n = C.noun(f.noun);
        expect(mod === 'plural').toBe(f.number === 'pl');
        return f.number === 'pl' ? n.plural : n.lemma;
      }
      case 'article': {
        const nf = get(fills, f.noun, 'noun');
        expect(mod).toBe(f.definiteness);
        return C.articles[f.definiteness][C.noun(nf.noun).gender][nf.number];
      }
    }
  });
  return /[.?!]$/.test(t.pattern) ? text.charAt(0).toLocaleUpperCase('es-ES') + text.slice(1) : text;
}

function answerOf(s: Strike): string {
  return s.options[s.correct];
}

function wrongCards(s: Strike): string[] {
  return DIRECTIONS.filter((d) => d !== s.correct).map((d) => s.options[d]);
}

function filledSentence(q: Question): string {
  const parts = q.sentence.split(BLANK);
  return parts.map((p, i) => (i === 0 ? p : answerOf(q.strikes[i - 1]!) + p)).join('');
}

describe.each(C.templates.map((t) => [t.id, t] as const))('template %s', (_id, t) => {
  it(`agrees, obeys the slot rule and has clean cards over ${SEEDS} seeds`, () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const { question: q, fills } = generateDetailed(t, seed);
      expect(q.id).toBe(t.id);
      expect(q.kind).toBe(t.kind);
      expect(q.seed).toBe(seed);

      // Agreement: the answered sentence equals the independent render.
      const sentenceBlank = t.blanks.includes('$sentence');
      const expected = expectedText(t, fills);
      if (sentenceBlank) {
        expect(q.sentence).toBe(BLANK);
        expect(answerOf(q.strikes[0]!)).toBe(expected);
      } else {
        expect(q.strikes).toHaveLength(t.blanks.length);
        expect(q.sentence.split(BLANK)).toHaveLength(t.blanks.length + 1);
        expect(filledSentence(q)).toBe(expected);
      }

      // Slot rule, tag filters and distinctness.
      for (const [name, def] of Object.entries(t.slots)) {
        const f = fills[name]!;
        if (f.type === 'noun') {
          const n = C.noun(f.noun);
          expect(f.number).toBe(def.number);
          if (def.requires) {
            const v = C.verb(get(fills, def.requires.split('.')[0]!, 'verb').verb);
            expect(verbTakes(v, n), `${v.id} cannot take ${n.id}`).toBe(true);
          }
          for (const tag of def.tags ?? []) expect(n.tags).toContain(tag);
          for (const tag of def.excludeTags ?? []) expect(n.tags).not.toContain(tag);
          if (def.distinctFrom) expect(f.noun).not.toBe(get(fills, def.distinctFrom, 'noun').noun);
        }
        if (f.type === 'subject' && def.distinctPersonFrom) {
          expect(f.person).not.toBe(get(fills, def.distinctPersonFrom, 'subject').person);
        }
      }

      // Cards: four different non-empty texts, the answer among them.
      for (const s of q.strikes) {
        const texts = DIRECTIONS.map((d) => s.options[d]);
        expect(new Set(texts).size).toBe(4);
        expect(texts.every((x) => x.trim().length > 0)).toBe(true);
      }

      // No distractor is also a correct answer, and each changes one feature.
      t.blanks.forEach((blank, i) => {
        const s = q.strikes[i]!;
        const wrong = wrongCards(s);
        if (blank === '$sentence') {
          if (t.distractors[blank]?.vary[0] === 'lemma') {
            const nf = Object.values(fills).find((f) => f.type === 'noun') as Extract<SlotFill, { type: 'noun' }>;
            const self = C.noun(nf.noun);
            for (const w of wrong) {
              const other = C.nouns.find((n) => `${C.articles.definite[n.gender].sg} ${n.lemma}` === w);
              expect(other, `"${w}" is not a lexicon noun with its own article`).toBeDefined();
              expect(other!.gloss_en).not.toBe(self.gloss_en);
            }
          } else {
            // 2x2 grid: same words in the same order, only the varied features change.
            const words = expected.split(' ');
            for (const w of wrong) {
              expect(w).not.toBe(expected);
              const ww = w.split(' ');
              expect(ww).toHaveLength(words.length);
              expect(ww[0]).toBe(words[0]); // the subject is never changed
            }
          }
          return;
        }
        const f = fills[blank]!;
        if (f.type === 'verb') {
          const v = C.verb(f.verb);
          const person = personOfVerb(fills, blank);
          const correctForms = new Set(PERSONS.filter((p) => p === person).map((p) => v.present[p]));
          const otherSubjects = Object.entries(fills)
            .filter(([name, x]) => x.type === 'subject' && name !== f.subject)
            .map(([, x]) => (x as Extract<SlotFill, { type: 'subject' }>).person);
          for (const w of wrong) {
            expect(correctForms.has(w), `${w} is also correct`).toBe(false);
            const p = PERSONS.find((x) => v.present[x].toLowerCase() === w.toLowerCase());
            expect(p, `${w} is not a form of ${v.id}`).toBeDefined();
            expect(otherSubjects).not.toContain(p);
          }
        } else if (f.type === 'article') {
          const nf = get(fills, f.noun, 'noun');
          const right = C.articles[f.definiteness][C.noun(nf.noun).gender][nf.number];
          const paradigm = Object.values(C.articles[f.definiteness]).flatMap((x) => Object.values(x));
          for (const w of wrong) {
            expect(w.toLowerCase()).not.toBe(right);
            expect(paradigm).toContain(w.toLowerCase());
          }
        } else {
          throw new Error(`unexpected blank type ${f.type}`);
        }
      });

      // Capitalisation: a sentence starts with a capital, and nothing else is capitalised.
      const shown = sentenceBlank ? answerOf(q.strikes[0]!) : filledSentence(q);
      if (/[.?!]$/.test(t.pattern)) {
        const first = shown.search(/\p{L}/u);
        expect(shown.charAt(first)).toBe(shown.charAt(first).toLocaleUpperCase('es-ES'));
        expect(shown.slice(first + 1)).toBe(shown.slice(first + 1).toLocaleLowerCase('es-ES'));
      } else {
        expect(shown).toBe(shown.toLocaleLowerCase('es-ES'));
      }

      // Canonical component ids (DECISIONS #23).
      expect(q.components).toHaveLength(t.tests.length);
      for (const c of q.components) {
        expect(c).toMatch(/^(v_[a-zñ]+:present:[123](sg|pl)|art:(definite|indefinite):[mf]:(sg|pl)|n_[a-zñ]+(:plural)?)$/);
      }
    }
  });

  it('reproduces the same question from the same seed, with fresh content', () => {
    const fresh = buildContent(
      structuredClone(lexiconJson) as unknown as LexiconFile,
      structuredClone(templatesJson) as unknown as TemplatesFile,
    );
    for (const seed of [0, 1, 42, 999, 123456789, 0xffffffff]) {
      expect(generate(fresh.template(t.id), seed, fresh)).toEqual(generate(t, seed));
    }
  });

  it('gives different questions for different seeds', () => {
    const sentences = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const q = generate(t, seed);
      sentences.add(JSON.stringify(q.strikes.map((s) => s.options)));
    }
    expect(sentences.size).toBeGreaterThan(20);
  });
});

describe('answer features are drawn uniformly (DECISIONS #4)', () => {
  const N = 6000;

  it('verb blanks: each person about 1/6 of the time, in every blank', () => {
    for (const t of C.templates.filter((x) => x.blanks.some((b) => x.slots[b]?.type === 'verb'))) {
      for (const blank of t.blanks.filter((b) => t.slots[b]?.type === 'verb')) {
        const counts = new Map<Person, number>();
        for (let seed = 0; seed < N; seed++) {
          const { fills } = generateDetailed(t, seed);
          const p = personOfVerb(fills, blank);
          counts.set(p, (counts.get(p) ?? 0) + 1);
        }
        for (const p of PERSONS) expect(Math.abs((counts.get(p) ?? 0) / N - 1 / 6), `${t.id}.${blank} ${p}`).toBeLessThan(0.02);
      }
    }
  });

  it('article blanks: each gender about half the time', () => {
    for (const t of C.templates.filter((x) => x.blanks.some((b) => x.slots[b]?.type === 'article'))) {
      let fem = 0;
      for (let seed = 0; seed < N; seed++) {
        const { fills } = generateDetailed(t, seed);
        const nf = Object.values(fills).find((f) => f.type === 'noun') as Extract<SlotFill, { type: 'noun' }>;
        if (C.noun(nf.noun).gender === 'f') fem++;
      }
      expect(Math.abs(fem / N - 0.5), t.id).toBeLessThan(0.02);
    }
  });

  it('each card in a set is equally likely to be the answer, over the deck mix', () => {
    // The deck draws every template equally often, so pool them the same way. A single
    // template can be lopsided (t_definite_article only asks singulars); the singular and
    // plural templates together must not be (DECISIONS #40).
    const bySet = new Map<string, Map<string, number>>();
    for (const t of C.templates.filter((x) => x.zone === 1)) {
      for (let seed = 0; seed < N; seed++) {
        for (const s of generate(t, seed).strikes) {
          const key = DIRECTIONS.map((d) => s.options[d]).sort().join('|');
          const m = bySet.get(key) ?? new Map<string, number>();
          m.set(answerOf(s), (m.get(answerOf(s)) ?? 0) + 1);
          bySet.set(key, m);
        }
      }
    }
    let measured = 0;
    for (const [key, m] of bySet) {
      const total = [...m.values()].reduce((a, b) => a + b, 0);
      if (total < 400) continue; // only sets seen often enough to measure
      measured++;
      for (const card of key.split('|')) {
        expect(Math.abs((m.get(card) ?? 0) / total - 0.25), `${key}: ${card}`).toBeLessThan(0.07);
      }
    }
    expect(measured).toBeGreaterThanOrEqual(2); // at least the two article paradigms
  });
});

describe('combo', () => {
  const combo = C.template('t_combo_two');

  it('gives each blank its own four cards and the two subjects different persons', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const { question: q, fills } = generateDetailed(combo, seed);
      expect(q.strikes).toHaveLength(2);
      expect(get(fills, 'subj1', 'subject').person).not.toBe(get(fills, 'subj2', 'subject').person);
      const [a, b] = q.strikes.map((s) => DIRECTIONS.map((d) => s.options[d]));
      expect(a).toHaveLength(4);
      expect(b).toHaveLength(4);
    }
  });

  it('builds the spec example sentence shape', () => {
    const q = generate(combo, 1);
    expect(q.sentence).toMatch(/^[A-ZÁÉÍÓÚÑ]\p{L}* ___ (el|la) \p{L}+ y \p{Ll}+ ___ (el|la) \p{L}+\.$/u);
  });
});

describe('prompts', () => {
  it('glosses translations in English with the right verb form', () => {
    const t = C.template('t_translate_object');
    for (let seed = 0; seed < 200; seed++) {
      const { question: q, fills } = generateDetailed(t, seed);
      const v = C.verb(get(fills, 'verb', 'verb').verb);
      const s3 = get(fills, 'subj', 'subject').person === 'el';
      expect(q.prompt).toContain(` ${s3 ? v.gloss_en.s3 : v.gloss_en.base} the `);
      expect(q.prompt).toMatch(/^"[A-Z].*\."$/);
    }
  });

  it('never puts an answer form in a grammar prompt', () => {
    for (const t of C.templates.filter((x) => x.kind === 'grammar' || x.kind === 'combo')) {
      for (let seed = 0; seed < 200; seed++) {
        const q = generate(t, seed);
        for (const s of q.strikes) {
          for (const card of DIRECTIONS.map((d) => s.options[d])) {
            expect(q.prompt?.split(/[\s()…]+/)).not.toContain(card);
          }
        }
      }
    }
  });
});
