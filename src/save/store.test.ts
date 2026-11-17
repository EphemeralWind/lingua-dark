import { describe, expect, it } from 'vitest';
import { recordAnswer } from '../learning/learner';
import { newGame, walk } from '../world/state';
import { ZONE1 } from '../world/zone';
import { parseSave, SaveStore, serialize, type KeyValueStore } from './store';

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function sampleGame() {
  const g = newGame(ZONE1, 42);
  walk(g, 'r1_lane', null);
  g.learner = recordAnswer(g.learner, ['v_levantar:present:3sg'], true, 'review', 3);
  g.echo = { room: 'r1_lane', xp: 50, killer: 'enemy', target: null };
  g.ghosts = { r1_lane: ['n_espada'] };
  return g;
}

describe('save store', () => {
  it('round-trips a game through the store', () => {
    const kv = memoryStore();
    const store = new SaveStore(kv);
    expect(store.load()).toEqual({ game: null, error: null });
    const g = sampleGame();
    store.save(g, 1000);
    expect(store.load()).toEqual({ game: g, error: null });
  });

  it('exports JSON that imports back', () => {
    const a = new SaveStore(memoryStore());
    const b = new SaveStore(memoryStore());
    const g = sampleGame();
    const text = a.exportText(g, 123);
    expect(JSON.parse(text)).toMatchObject({ format: 'lingua-dark-save', version: 1, savedAtMs: 123 });
    expect(b.importText(text)).toEqual({ ok: true, game: g, savedAtMs: 123 });
    expect(b.load().game).toEqual(g);
  });

  it('rejects bad imports and keeps the current save', () => {
    const kv = memoryStore();
    const store = new SaveStore(kv);
    store.save(sampleGame(), 1);
    const before = kv.data.get('lingua-dark/save');
    for (const text of ['nope', '{}', JSON.stringify({ format: 'lingua-dark-save', version: 2, game: {} })]) {
      expect(store.importText(text).ok).toBe(false);
    }
    expect(kv.data.get('lingua-dark/save')).toBe(before);
  });

  it('names the broken fields', () => {
    const g = sampleGame() as unknown as Record<string, unknown>;
    g['xp'] = 'lots';
    (g['learner'] as { components: Record<string, unknown> }).components['x'] = { box: 9 };
    const r = parseSave(JSON.stringify({ format: 'lingua-dark-save', version: 1, savedAtMs: 0, game: g }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/game\.xp/);
      expect(r.error).toMatch(/components\["x"\]/);
    }
  });

  it('reports a corrupt stored save instead of throwing', () => {
    const kv = memoryStore();
    kv.setItem('lingua-dark/save', '{broken');
    expect(new SaveStore(kv).load()).toEqual({ game: null, error: 'not valid JSON' });
  });

  it('serialize is plain JSON', () => {
    expect(() => JSON.parse(serialize(sampleGame(), 0))).not.toThrow();
  });
});
