import { describe, expect, it } from 'vitest';
import { articleDistractors, gridDistractors, lemmaDistractors, pickDistractors, verbDistractors } from './distractors';
import { CONTENT, PERSONS, type Verb } from './lexicon';
import { createRng } from './rng';

const levantar = CONTENT.verb('v_levantar');
const A = CONTENT.articles;

describe('pickDistractors', () => {
  it('drops the answer, other correct forms and duplicates', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const out = pickDistractors(['a', 'b', 'b', 'c', 'd', 'ok'], new Set(['a', 'ok']), rng);
      expect(out.sort()).toEqual(['b', 'c', 'd']);
    }
  });

  it('fails loudly when fewer than three candidates are left', () => {
    expect(() => pickDistractors(['a', 'b', 'b'], new Set(['a']), createRng(1))).toThrow(/only 1/);
  });
});

describe('verbDistractors', () => {
  it('uses other persons of the same verb, never the answer', () => {
    const rng = createRng(2);
    for (const p of PERSONS) {
      const out = verbDistractors(levantar, p, [], rng);
      expect(out).toHaveLength(3);
      expect(out).not.toContain(levantar.present[p]);
      for (const d of out) expect(Object.values(levantar.present)).toContain(d);
    }
  });

  it('draws a uniform subset of the other five persons', () => {
    const rng = createRng(3);
    const counts = new Map<string, number>();
    const N = 20_000;
    for (let i = 0; i < N; i++) for (const d of verbDistractors(levantar, 'yo', [], rng)) counts.set(d, (counts.get(d) ?? 0) + 1);
    expect(counts.size).toBe(5);
    for (const c of counts.values()) expect(Math.abs(c / N - 3 / 5)).toBeLessThan(0.02);
  });

  it('leaves out the persons of other subjects in the sentence', () => {
    const rng = createRng(4);
    for (let i = 0; i < 500; i++) {
      const out = verbDistractors(levantar, 'el', ['yo'], rng);
      expect(out).not.toContain('levanto');
    }
  });

  it('never offers a form that is also correct (shared forms, as in the imperfect)', () => {
    // hablaba is both yo and él: as a distractor for yo it would be correct by accident.
    const hablar: Verb = {
      ...levantar,
      id: 'v_hablar',
      present: { yo: 'hablaba', tu: 'hablabas', el: 'hablaba', nosotros: 'hablábamos', vosotros: 'hablabais', ellos: 'hablaban' },
    };
    const rng = createRng(5);
    for (let i = 0; i < 500; i++) {
      const out = verbDistractors(hablar, 'yo', [], rng);
      expect(out).not.toContain('hablaba');
      expect(new Set(out).size).toBe(3);
    }
  });
});

describe('articleDistractors', () => {
  it('shows the rest of the paradigm, including the gender error (el espada for la espada)', () => {
    const out = articleDistractors(A, 'definite', 'f', 'sg', createRng(6));
    expect(out.sort()).toEqual(['el', 'las', 'los']);
    expect(articleDistractors(A, 'indefinite', 'm', 'pl', createRng(6)).sort()).toEqual(['un', 'una', 'unas']);
  });
});

describe('gridDistractors', () => {
  it('returns the three swapped cells of the 2x2 grid', () => {
    const render = (a: boolean, b: boolean): string => `${a ? 'X' : 'x'}${b ? 'Y' : 'y'}`;
    expect(gridDistractors(render, createRng(7)).sort()).toEqual(['Xy', 'XY', 'xY'].sort());
  });
});

describe('lemmaDistractors', () => {
  it('picks three other words', () => {
    const out = lemmaDistractors('la espada', ['la espada', 'el pan', 'la torre', 'el lobo', 'la capa'], createRng(8));
    expect(out).toHaveLength(3);
    expect(out).not.toContain('la espada');
  });
});
