import { describe, expect, it } from 'vitest';
import { QUESTION_SPECS, buildQuestion, createDeck, specById } from './handwritten';
import { createRng } from './rng';
import { DIRECTIONS } from './types';

const SEEDS = 1000;

describe('hand-written question set', () => {
  it('has 20 questions, exactly one of them a two-blank combo', () => {
    expect(QUESTION_SPECS).toHaveLength(20);
    expect(new Set(QUESTION_SPECS.map((s) => s.id)).size).toBe(20);
    const combos = QUESTION_SPECS.map((s) => buildQuestion(s, 1)).filter((q) => q.kind === 'combo');
    expect(combos).toHaveLength(1);
    expect(combos[0]?.strikes).toHaveLength(2);
  });

  it.each(QUESTION_SPECS.map((s) => [s.id, s] as const))('%s builds cleanly over 1000 seeds', (_id, spec) => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const q = buildQuestion(spec, seed);
      expect(q.seed).toBe(seed);
      expect(q.strikes.length).toBe((q.sentence.match(/___/g) ?? []).length);
      expect(q.components.length).toBeGreaterThan(0);
      for (const strike of q.strikes) {
        const texts = DIRECTIONS.map((d) => strike.options[d]);
        expect(new Set(texts).size).toBe(4);
        expect(texts.every((t) => t.length > 0)).toBe(true);
        expect(DIRECTIONS).toContain(strike.correct);
      }
    }
  });

  it('reproduces the exact question from its seed', () => {
    for (const spec of QUESTION_SPECS) {
      expect(buildQuestion(spec, 777)).toEqual(buildQuestion(specById(spec.id), 777));
    }
  });

  it('uses canonical component ids', () => {
    const ids = QUESTION_SPECS.flatMap((s) => buildQuestion(s, 1).components);
    for (const id of ids) {
      expect(id).toMatch(/^(v_\w+:present:[123](sg|pl)|art:definite:[mf]:(sg|pl)|n_\w+)$/);
    }
  });

  it('builds the spec example combo sentence', () => {
    const q = buildQuestion(specById('h_combo_two'), 1);
    expect(q.sentence).toBe('Ella ___ la espada y yo ___ el escudo.');
    expect(q.strikes.map((s) => s.options[s.correct])).toEqual(['levanta', 'llevo']);
  });

  it('balances answer persons across single-blank verb questions', () => {
    const persons = QUESTION_SPECS.flatMap((s) => (s.kind === 'verb' ? [buildQuestion(s, 1).components[0]?.split(':')[2]] : []));
    expect(new Set(persons).size).toBe(6);
    expect(persons).toHaveLength(6);
  });

  it('deck reproduces the same sequence from the same seed', () => {
    const a = createDeck(createRng(11));
    const b = createDeck(createRng(11));
    for (let i = 0; i < 50; i++) expect(a()).toEqual(b());
  });
});
