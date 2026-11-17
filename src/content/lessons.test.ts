import { describe, expect, it } from 'vitest';
import lessonsJson from './data/lessons.json' with { type: 'json' };
import lexiconJson from './data/lexicon.json' with { type: 'json' };
import templatesJson from './data/templates.json' with { type: 'json' };
import roomsJson from './data/zone1-rooms.json' with { type: 'json' };
import { LESSON_OBJECTS, lessonObjectsFor, lessonPage } from './lessons';
import { validateContent } from './validate';

const stele = LESSON_OBJECTS.find((o) => o.id === 'stele');
const page = (i: number) => {
  const p = stele?.pages[i];
  if (!p) throw new Error(`stele has no page ${i}`);
  return lessonPage(p);
};

describe('lessons', () => {
  it('Zone 1 has the four-sided stele', () => {
    expect(lessonObjectsFor(1).map((o) => o.id)).toEqual(['stele']);
    expect(stele?.pages).toHaveLength(4);
    expect(lessonObjectsFor(2)).toEqual([]);
  });

  it('spells article rows from the lexicon, singular then plural', () => {
    const rows = page(0).rows;
    expect(rows).toContainEqual(['el escudo', 'los escudos']);
    expect(rows).toContainEqual(['la llave', 'las llaves']);
    expect(rows).toContainEqual(['el pan', 'los panes']);
    expect(page(1).rows).toContainEqual(['una antorcha', 'unas antorchas']);
  });

  it('spells conjugation rows with every pronoun of the person', () => {
    const rows = page(2).rows;
    expect(rows).toHaveLength(6);
    expect(rows[2]).toEqual(['él / ella', 'levanta']);
    expect(rows[4]).toEqual(['vosotros', 'levantáis']);
    expect(page(3).rows[3]).toEqual(['nosotros', 'comemos', 'escribimos']);
    expect(page(3).rows.every((r) => r.length === 3)).toBe(true);
  });

  it('speaks each form with its pronoun', () => {
    expect(page(2).spoken[0]).toBe('yo levanto');
    expect(page(3).spoken.slice(0, 2)).toEqual(['yo como', 'yo escribo']);
    expect(page(0).spoken.slice(0, 2)).toEqual(['el escudo', 'los escudos']);
  });

  /* eslint-disable @typescript-eslint/no-explicit-any -- mutating loosely typed JSON copies */
  const withLessons = (mutate: (l: any) => void): string[] => {
    const lessons: any = structuredClone(lessonsJson);
    mutate(lessons);
    return validateContent({ lexicon: lexiconJson, templates: templatesJson, rooms: { 'zone1-rooms.json': roomsJson }, lessons });
  };

  it('fails validation for a missing noun or verb, a mass noun, or a bad row kind', () => {
    expect(withLessons(() => {})).toEqual([]);
    expect(withLessons((l) => l.objects[0].pages[0].rows.nouns.push('n_dragon')).join()).toMatch(/missing noun n_dragon/);
    expect(withLessons((l) => (l.objects[0].pages[2].rows.verbs = ['v_volar'])).join()).toMatch(/missing verb v_volar/);
    expect(withLessons((l) => (l.objects[0].pages[1].rows.nouns = ['n_leche'])).join()).toMatch(/mass noun n_leche/);
    expect(withLessons((l) => (l.objects[0].pages[0].rows.kind = 'riddle')).length).toBeGreaterThan(0);
    expect(withLessons((l) => l.objects.push(structuredClone(l.objects[0]))).join()).toMatch(/duplicate object stele/);
  });
});
