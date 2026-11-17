import { describe, expect, it } from 'vitest';
import { edgeKey, layoutZone, resolveExit, ZONE1, type WalkContext } from './zone';

const ctx = (over: Partial<WalkContext> = {}): WalkContext => ({ cameFrom: null, openDoors: [], gateOpen: false, ...over });

describe('Zone 1 graph', () => {
  it('starts at the bonfire', () => {
    expect(ZONE1.start).toBe('r1_bonfire');
    expect(ZONE1.room(ZONE1.start).contents.bonfire).toBe(true);
  });

  it('plain exits move to their room', () => {
    expect(resolveExit(ZONE1, 'r1_bonfire', 'north', ctx())).toEqual({ kind: 'move', to: 'r1_lane', opens: null, back: false });
  });

  it('a missing exit does nothing', () => {
    expect(resolveExit(ZONE1, 'r1_lane', 'east', ctx()).kind).toBe('none');
  });

  it('$back returns to the room the player came from', () => {
    expect(resolveExit(ZONE1, 'r1_lane', 'south', ctx({ cameFrom: 'r1_bonfire' }))).toEqual({ kind: 'move', to: 'r1_bonfire', opens: null, back: true });
    expect(resolveExit(ZONE1, 'r1_cellar', 'south', ctx({ cameFrom: 'r1_bonfire' }))).toMatchObject({ to: 'r1_bonfire' });
    expect(resolveExit(ZONE1, 'r1_cellar', 'south', ctx({ cameFrom: 'r1_well' }))).toMatchObject({ to: 'r1_well' });
  });

  it('$back with no previous room does nothing', () => {
    expect(resolveExit(ZONE1, 'r1_lane', 'south', ctx()).kind).toBe('none');
  });

  it('the shortcut is locked from the bonfire side until opened from the far side', () => {
    expect(resolveExit(ZONE1, 'r1_bonfire', 'south', ctx())).toEqual({ kind: 'locked', door: 'shortcut_cellar' });
    expect(resolveExit(ZONE1, 'r1_cellar', 'north', ctx())).toEqual({ kind: 'move', to: 'r1_bonfire', opens: 'shortcut_cellar', back: false });
    expect(resolveExit(ZONE1, 'r1_bonfire', 'south', ctx({ openDoors: ['shortcut_cellar'] }))).toEqual({
      kind: 'move',
      to: 'r1_cellar',
      opens: null,
      back: false,
    });
  });

  it('the boss gate blocks until it is open', () => {
    expect(resolveExit(ZONE1, 'r1_gate', 'north', ctx())).toEqual({ kind: 'gate', to: 'r1_boss_arena' });
    expect(resolveExit(ZONE1, 'r1_gate', 'north', ctx({ gateOpen: true }))).toMatchObject({ kind: 'move', to: 'r1_boss_arena' });
  });

  it('every room is reachable from the start', () => {
    const seen = new Set([ZONE1.start]);
    const queue = [ZONE1.start];
    while (queue.length) {
      const id = queue.shift()!;
      for (const dir of ['north', 'east', 'south', 'west'] as const) {
        const r = resolveExit(ZONE1, id, dir, { cameFrom: null, openDoors: ['shortcut_cellar'], gateOpen: true });
        if (r.kind === 'move' && !seen.has(r.to)) {
          seen.add(r.to);
          queue.push(r.to);
        }
      }
    }
    expect([...seen].sort()).toEqual(ZONE1.rooms.map((r) => r.id).sort());
  });

  it('lays out every room on its own map cell, following plain exits', () => {
    const pos = layoutZone(ZONE1);
    expect(Object.keys(pos).sort()).toEqual(ZONE1.rooms.map((r) => r.id).sort());
    const cells = Object.values(pos).map((p) => `${p.x},${p.y}`);
    expect(new Set(cells).size).toBe(cells.length);
    expect(pos['r1_lane']).toEqual({ x: 0, y: -1 });
    expect(pos['r1_well']).toEqual({ x: -1, y: 0 });
    expect(pos['r1_cellar']).toEqual({ x: -1, y: -1 });
  });

  it('edge keys are undirected', () => {
    expect(edgeKey('a', 'b')).toBe(edgeKey('b', 'a'));
  });
});
