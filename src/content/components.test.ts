import { describe, expect, it } from 'vitest';
import { cardRepresentable, componentSurfaces, showsOnCards, strikeComponents, zoneComponents } from './components';
import { zoneTemplates } from './deck';
import { generate } from './generator';
import { CONTENT } from './lexicon';
import type { Question } from './types';

describe('zone components', () => {
  const universe = zoneComponents(1);

  it('enumerates exactly what the Zone 1 templates generate over many seeds', () => {
    const seen = new Set<string>();
    for (const t of zoneTemplates(1)) for (let seed = 1; seed <= 3000; seed++) for (const c of generate(t, seed).components) seen.add(c);
    expect([...seen].sort()).toEqual(universe);
  });

  it('has the expected shape: 11 verbs x 6 persons, 8 article cells, plurals, vocabulary', () => {
    const count = (re: RegExp): number => universe.filter((c) => re.test(c)).length;
    expect(count(/^v_.*:present:/)).toBe(CONTENT.verbs.length * 6);
    expect(count(/^art:/)).toBe(8);
    expect(count(/^n_[^:]+$/)).toBe(CONTENT.nouns.length);
    expect(count(/:plural$/)).toBeGreaterThan(0);
  });
});

describe('component surfaces', () => {
  it('maps verbs, articles and vocabulary nouns to their card text', () => {
    expect(componentSurfaces('v_levantar:present:3sg')).toEqual(['levanta']);
    expect(componentSurfaces('v_vender:present:2pl')).toEqual(['vendéis']);
    expect(componentSurfaces('art:indefinite:f:pl')).toEqual(['unas']);
    expect(componentSurfaces('n_espada')).toEqual(['la espada']);
  });

  it('has no surface for components carried by the sentence or unknown ids', () => {
    expect(componentSurfaces('n_manzana:plural')).toEqual([]);
    expect(componentSurfaces('w_izquierda')).toEqual([]);
    expect(cardRepresentable('n_manzana:plural')).toBe(false);
  });

  it('every generated answer card shows its own strike component', () => {
    for (const t of zoneTemplates(1)) {
      for (let seed = 1; seed <= 200; seed++) {
        const q = generate(t, seed);
        q.strikes.forEach((s, i) => {
          for (const c of strikeComponents(q, i).filter((x) => cardRepresentable(x))) {
            if (t.kind === 'translate') continue; // whole-sentence cards
            expect(componentSurfaces(c).map((x) => x.toLowerCase())).toContain(s.options[s.correct].toLowerCase());
          }
        });
      }
    }
  });
});

describe('strike components', () => {
  const q = (n: number, components: string[]): Question => ({
    id: 'q',
    kind: 'combo',
    sentence: '',
    strikes: Array.from({ length: n }, () => ({ options: { north: 'a', east: 'b', south: 'c', west: 'd' }, correct: 'north' as const })),
    components,
    seed: 0,
  });

  it('a single strike tests all the question components', () => {
    expect(strikeComponents(q(1, ['a', 'b']), 0)).toEqual(['a', 'b']);
  });

  it('a combo strike tests its own blank component', () => {
    expect(strikeComponents(q(2, ['a', 'b']), 1)).toEqual(['b']);
  });

  it('showsOnCards matches card text, ignoring case', () => {
    const x = q(1, []);
    x.strikes[0]!.options.east = 'Levanta';
    expect(showsOnCards(x, 'v_levantar:present:3sg')).toBe(true);
    expect(showsOnCards(x, 'v_levantar:present:1sg')).toBe(false);
  });
});
