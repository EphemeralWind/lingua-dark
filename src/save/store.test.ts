import { describe, expect, it } from 'vitest';
import { newProfile, recordInProfile } from '../learning/profile';
import { newGame, walk } from '../world/state';
import { ZONE1 } from '../world/zone';
import { PROFILE_KEY, SAVE_KEY, parseSave, SaveStore, serialize, type KeyValueStore } from './store';

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
  g.echo = { room: 'r1_lane', xp: 50, killer: 'enemy', target: null };
  g.ghosts = { r1_lane: ['n_espada'] };
  g.seals = ['words'];
  g.wardensBeaten = ['r1_orchard'];
  return g;
}

function sampleProfile() {
  const p = newProfile();
  recordInProfile(p, ['v_levantar:present:3sg'], true, 'review', 3);
  recordInProfile(p, ['v_levantar:present:3sg'], true, 'review', 4);
  return p;
}

/** A save file as Milestone 3 wrote it: version 1, learner inside the game, no seals. */
function v1SaveText(): string {
  const g = sampleGame() as unknown as Record<string, unknown>;
  delete g['seals'];
  delete g['wardensBeaten'];
  g['learner'] = sampleProfile().learner;
  return JSON.stringify({ format: 'lingua-dark-save', version: 1, savedAtMs: 7, game: g });
}

describe('save store', () => {
  it('round-trips a run and a profile through separate keys', () => {
    const store = new SaveStore(memoryStore());
    expect(store.load()).toEqual({ game: null, profile: newProfile(), error: null });
    const g = sampleGame();
    const p = sampleProfile();
    store.save(g, 1000);
    store.saveProfile(p);
    expect(store.load()).toEqual({ game: g, profile: p, error: null });
  });

  it('New Game replaces the run but keeps the profile', () => {
    const kv = memoryStore();
    const store = new SaveStore(kv);
    store.saveProfile(sampleProfile());
    store.save(sampleGame(), 1);
    store.save(newGame(ZONE1, 9), 2);
    expect(store.load().profile.bestLearned).toBe(1);
    expect(store.load().game?.seals).toEqual([]);
  });

  it('migrates a v1 save: its learner becomes the profile, once', () => {
    const kv = memoryStore();
    kv.setItem(SAVE_KEY, v1SaveText());
    const first = new SaveStore(kv).load();
    expect(first.error).toBeNull();
    expect(first.profile.bestLearned).toBe(1);
    expect(first.profile.learner).toEqual(sampleProfile().learner);
    expect(first.game).toMatchObject({ seals: [], wardensBeaten: [] });
    expect(first.game).not.toHaveProperty('learner');
    expect(kv.data.has(PROFILE_KEY)).toBe(true);
    expect(JSON.parse(kv.data.get(SAVE_KEY)!).version).toBe(2);
    expect(new SaveStore(kv).load()).toEqual({ ...first, game: first.game });
  });

  it('a v1 save does not overwrite an existing profile', () => {
    const kv = memoryStore();
    const store = new SaveStore(kv);
    const p = newProfile();
    p.bestLearned = 50;
    store.saveProfile(p);
    kv.setItem(SAVE_KEY, v1SaveText());
    expect(store.load().profile.bestLearned).toBe(50);
  });

  it('exports one file with run and profile that imports back', () => {
    const a = new SaveStore(memoryStore());
    const b = new SaveStore(memoryStore());
    const g = sampleGame();
    const p = sampleProfile();
    const text = a.exportText(g, p, 123);
    expect(JSON.parse(text)).toMatchObject({ format: 'lingua-dark-save', version: 2, savedAtMs: 123 });
    expect(b.importText(text)).toEqual({ ok: true, game: g, savedAtMs: 123, profile: p });
    expect(b.load()).toEqual({ game: g, profile: p, error: null });
  });

  it('imports a v1 file by migrating it', () => {
    const store = new SaveStore(memoryStore());
    const r = store.importText(v1SaveText());
    expect(r.ok && r.profile?.bestLearned).toBe(1);
    expect(store.load().profile.bestLearned).toBe(1);
  });

  it('rejects bad imports and keeps the current save and profile', () => {
    const kv = memoryStore();
    const store = new SaveStore(kv);
    store.save(sampleGame(), 1);
    store.saveProfile(sampleProfile());
    const before = new Map(kv.data);
    const badProfile = JSON.parse(store.exportText(sampleGame(), sampleProfile(), 1));
    badProfile.profile.bestLearned = 'many';
    for (const text of ['nope', '{}', JSON.stringify({ format: 'lingua-dark-save', version: 3, game: {} }), JSON.stringify(badProfile)]) {
      expect(store.importText(text).ok).toBe(false);
    }
    expect(kv.data).toEqual(before);
  });

  it('names the broken fields', () => {
    const g = sampleGame() as unknown as Record<string, unknown>;
    g['xp'] = 'lots';
    delete g['seals'];
    const r = parseSave(JSON.stringify({ format: 'lingua-dark-save', version: 2, savedAtMs: 0, game: g }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/game\.xp/);
      expect(r.error).toMatch(/game\.seals/);
    }
  });

  it('reports a corrupt run or profile instead of throwing, and keeps a usable profile', () => {
    const kv = memoryStore();
    kv.setItem(SAVE_KEY, '{broken');
    kv.setItem(PROFILE_KEY, '{broken');
    const r = new SaveStore(kv).load();
    expect(r.game).toBeNull();
    expect(r.error).toMatch(/saved game: not valid JSON; profile: profile is not valid JSON/);
    expect(r.profile).toEqual(newProfile());
    expect(kv.data.get(PROFILE_KEY)).toBe('{broken'); // left for the player to export or fix
  });

  it('loads a save from before backOf existed', () => {
    const g = sampleGame() as unknown as Record<string, unknown>;
    delete g['backOf'];
    const r = parseSave(JSON.stringify({ format: 'lingua-dark-save', version: 2, savedAtMs: 0, game: g }));
    expect(r.ok && r.game.backOf).toEqual({});
  });

  it('loads a save from before the boss existed', () => {
    const g = sampleGame() as unknown as Record<string, unknown>;
    delete g['bossesBeaten'];
    const r = parseSave(JSON.stringify({ format: 'lingua-dark-save', version: 2, savedAtMs: 0, game: g }));
    expect(r.ok && r.game.bossesBeaten).toEqual([]);
  });

  it('accepts an echo held by the boss', () => {
    const g = { ...sampleGame(), echo: { room: 'r1_boss_arena', xp: 10, killer: 'boss', target: null } };
    expect(parseSave(serialize(g as never, 0)).ok).toBe(true);
  });

  it('serialize is plain JSON', () => {
    expect(() => JSON.parse(serialize(sampleGame(), 0))).not.toThrow();
  });
});
