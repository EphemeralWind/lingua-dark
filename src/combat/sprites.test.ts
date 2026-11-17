import { describe, expect, it } from 'vitest';
import { DIRECTIONS } from '../content/types';
import { enemyFrame, playerFrame, requiredTags } from './sprites';
import type { Animation } from './view';

const base: Animation = { enemyPose: 'idle', progress: 0, toward: null, playerPose: 'idle', flash: 'none', timerLeft: null, frozen: false, resolved: null };
const clock = { nowMs: 0, sinceEndMs: 0 };

describe('sprite frames', () => {
  it('lists the SPEC 8 frame counts, one directional set for north, east and south', () => {
    const enemy = requiredTags('enemy');
    expect(enemy).toMatchObject({ idle: 4, windup: 6, strike_north: 3, strike_east: 3, strike_south: 3, recoil_east: 4, break: 4, death: 6 });
    expect(enemy['strike_west']).toBeUndefined();
    expect(requiredTags('player')).toMatchObject({ idle: 4, parry_north: 4, parry_south: 4, hit_east: 3, death: 6 });
  });

  it('time-stretches one wind-up over the window: six frames by progress', () => {
    const frames = [0, 0.1, 0.2, 0.4, 0.6, 0.8, 0.99, 1].map((progress) => enemyFrame({ ...base, enemyPose: 'windup', progress }, clock));
    expect(frames.map((f) => f.frame)).toEqual([0, 0, 1, 2, 3, 4, 5, 5]);
    expect(new Set(frames.map((f) => f.tag))).toEqual(new Set(['windup']));
  });

  it('ignores the clock during a wind-up', () => {
    const a: Animation = { ...base, enemyPose: 'windup', progress: 0.5, playerPose: 'guard', timerLeft: 0.5 };
    expect(enemyFrame(a, { nowMs: 0, sinceEndMs: 0 })).toEqual(enemyFrame(a, { nowMs: 12345, sinceEndMs: 999 }));
    expect(playerFrame(a, { nowMs: 0, sinceEndMs: 0 })).toEqual(playerFrame(a, { nowMs: 12345, sinceEndMs: 999 }));
  });

  it('mirrors the east set for west', () => {
    const east = enemyFrame({ ...base, enemyPose: 'strike', toward: 'east', progress: 0.5 }, clock);
    const west = enemyFrame({ ...base, enemyPose: 'strike', toward: 'west', progress: 0.5 }, clock);
    expect(west).toEqual({ ...east, flip: true });
    expect(east.flip).toBe(false);
    const parry = playerFrame({ ...base, playerPose: 'parry', toward: 'west', progress: 0.9 }, clock);
    expect(parry).toEqual({ tag: 'parry_east', frame: 3, flip: true });
  });

  it('every resolved direction maps to a required tag', () => {
    const enemyTags = requiredTags('enemy');
    const playerTags = requiredTags('player');
    for (const toward of DIRECTIONS) {
      for (const enemyPose of ['strike', 'recoil'] as const) {
        const f = enemyFrame({ ...base, enemyPose, toward, progress: 0.99 }, clock);
        expect(f.frame).toBeLessThan(enemyTags[f.tag]!);
      }
      for (const playerPose of ['parry', 'hit'] as const) {
        const f = playerFrame({ ...base, playerPose, toward, progress: 0.99 }, clock);
        expect(f.frame).toBeLessThan(playerTags[f.tag]!);
      }
    }
  });

  it('plays death once and holds the last frame', () => {
    expect(enemyFrame({ ...base, enemyPose: 'dead' }, { nowMs: 0, sinceEndMs: 0 }).frame).toBe(0);
    expect(enemyFrame({ ...base, enemyPose: 'dead' }, { nowMs: 0, sinceEndMs: 100_000 }).frame).toBe(5);
  });
});
