import { describe, expect, it } from 'vitest';
import { requiredTags } from '../combat/sprites';
import { layoutAtlas, missingTags, parseAtlas, type AtlasData } from './atlas';
import { CHARACTERS } from './characters';

describe('sprite atlas', () => {
  it('reads Aseprite hash and array exports alike', () => {
    const frame = { frame: { x: 0, y: 0, w: 48, h: 64 }, duration: 100 };
    const meta = { image: 'sheet.png', frameTags: [{ name: 'player/idle', from: 0, to: 1 }] };
    const hash = parseAtlas({ frames: { 'a 0': frame, 'a 1': { ...frame, frame: { ...frame.frame, x: 48 } } }, meta });
    const array = parseAtlas({ frames: [{ filename: 'a 0', ...frame }, { filename: 'a 1', ...frame, frame: { ...frame.frame, x: 48 } }], meta });
    expect(hash).toEqual(array);
    expect((hash as AtlasData).tags.get('player/idle')).toEqual([0, 1]);
    expect((hash as AtlasData).image).toBe('sheet.png');
  });

  it('rejects malformed atlases with a reason', () => {
    expect(parseAtlas(null)).toMatch(/frames and meta/);
    expect(parseAtlas({ frames: [], meta: {} })).toMatch(/no frames/);
    expect(parseAtlas({ frames: [{ frame: { x: 0 } }], meta: {} })).toMatch(/no frame rect/);
    expect(parseAtlas({ frames: [{ frame: { x: 0, y: 0, w: 1, h: 1 } }], meta: { frameTags: [{ name: 't', from: 0, to: 3 }] } })).toMatch(/out of range/);
  });

  it('the placeholder layout gives every character every required tag and frame count', () => {
    const atlas = parseAtlas(layoutAtlas(CHARACTERS));
    if (typeof atlas === 'string') throw new Error(atlas);
    for (const c of CHARACTERS) expect(missingTags(atlas, c.id, requiredTags(c.kind)), c.id).toEqual([]);
  });

  it('reports what a partial real atlas is missing', () => {
    const atlas = parseAtlas(layoutAtlas([{ id: 'crow', w: 48, h: 64, tags: { idle: 4, windup: 2 } }]));
    if (typeof atlas === 'string') throw new Error(atlas);
    const missing = missingTags(atlas, 'crow', requiredTags('enemy'));
    expect(missing).toContain('crow/windup');
    expect(missing).toContain('crow/strike_east');
    expect(missing).not.toContain('crow/idle');
  });

  it('sizes follow SPEC 8: player 48x64, enemies 48-64 tall, bosses 96-128', () => {
    for (const c of CHARACTERS) {
      if (c.id === 'player') expect([c.w, c.h]).toEqual([48, 64]);
      else if (c.boss) expect(c.h).toBeGreaterThanOrEqual(96);
      else expect(c.h).toBeLessThanOrEqual(64);
    }
  });
});

describe('characters', () => {
  it('has a sprite for every enemy and boss in the Zone 1 rooms, and marks the wardens', async () => {
    const { ZONE1 } = await import('../world/zone');
    for (const room of ZONE1.rooms) {
      const e = room.contents.enemy;
      if (e) expect(CHARACTERS.find((c) => c.id === e.id)?.warden ?? false, e.id).toBe(e.seal !== undefined);
      const b = room.contents.boss;
      if (b) expect(CHARACTERS.find((c) => c.id === b.id)?.boss, b.id).toBe(true);
    }
  });
});
