import { describe, expect, it } from 'vitest';
import { createDeck, questionFromTag, zoneTemplates } from './deck';
import { createRng } from './rng';

describe('deck', () => {
  const templates = zoneTemplates(1);

  it('draws every Zone 1 template equally often', () => {
    const deck = createDeck(createRng(5));
    const counts = new Map<string, number>();
    const N = 16_000;
    for (let i = 0; i < N; i++) {
      const id = deck().id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(templates.map((t) => t.id).sort());
    for (const c of counts.values()) expect(Math.abs(c / N - 1 / templates.length)).toBeLessThan(0.01);
  });

  it('draws templates independently of the previous one (DECISIONS #42)', () => {
    const deck = createDeck(createRng(6));
    let prev = deck().id;
    let repeats = 0;
    const N = 16_000;
    for (let i = 0; i < N; i++) {
      const id = deck().id;
      if (id === prev) repeats++;
      prev = id;
    }
    expect(Math.abs(repeats / N - 1 / templates.length)).toBeLessThan(0.01);
  });

  it('reproduces the same sequence from the same seed', () => {
    const a = createDeck(createRng(11));
    const b = createDeck(createRng(11));
    for (let i = 0; i < 100; i++) expect(a()).toEqual(b());
  });

  it('rebuilds any question from its id#seed tag', () => {
    const deck = createDeck(createRng(12));
    for (let i = 0; i < 100; i++) {
      const q = deck();
      expect(questionFromTag(`${q.id}#${q.seed}`)).toEqual(q);
    }
  });

  it('uses only generated questions in every attack kind the fight needs', () => {
    const kinds = new Set(templates.map((t) => t.kind));
    expect([...kinds].sort()).toEqual(['combo', 'grammar', 'translate', 'vocab']);
  });
});
