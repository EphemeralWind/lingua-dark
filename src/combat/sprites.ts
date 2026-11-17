// Which sprite frame to draw, from the encounter's Animation (SPEC 8 frame counts). Pure.
//
// During a wind-up the enemy frame is a function of wind-up progress alone: one shared
// animation, time-stretched to the answer window, and the player holds one guard frame. So the
// sprites carry no more about the answer than the Animation does (CLAUDE.md non-negotiable 1);
// the blind-bot test checks this. Directional sets exist for north, east and south; west draws
// the east set mirrored.
import type { Direction } from '../content/types';
import type { Animation } from './view';

/** Frames per animation tag (SPEC 8). Directional tags get one set per drawn direction. */
export const ENEMY_FRAMES = { idle: 4, windup: 6, strike: 3, recoil: 4, break: 4, death: 6 } as const;
export const PLAYER_FRAMES = { idle: 4, walk: 4, parry: 4, hit: 3, death: 6 } as const;

/** Directions with their own art. West mirrors east. */
export const DRAWN_DIRECTIONS = ['north', 'east', 'south'] as const;
export type DrawnDirection = (typeof DRAWN_DIRECTIONS)[number];

const DIRECTIONAL_ENEMY = new Set(['strike', 'recoil']);
const DIRECTIONAL_PLAYER = new Set(['parry', 'hit']);

/** Every tag a character's atlas must provide, with its frame count. */
export function requiredTags(kind: 'enemy' | 'player'): Record<string, number> {
  const frames: Record<string, number> = kind === 'enemy' ? ENEMY_FRAMES : PLAYER_FRAMES;
  const directional = kind === 'enemy' ? DIRECTIONAL_ENEMY : DIRECTIONAL_PLAYER;
  const out: Record<string, number> = {};
  for (const [name, n] of Object.entries(frames)) {
    if (directional.has(name)) for (const d of DRAWN_DIRECTIONS) out[`${name}_${d}`] = n;
    else out[name] = n;
  }
  return out;
}

export interface SpriteFrame {
  tag: string;
  frame: number;
  /** Draw mirrored (west uses the east set). */
  flip: boolean;
}

/** Idle cycle speed and the length of one death frame, in ms. */
export const IDLE_FRAME_MS = 220;
export const DEATH_FRAME_MS = 110;

const frameOf = (progress: number, count: number): number => Math.min(count - 1, Math.max(0, Math.floor(progress * count)));

function directional(name: string, dir: Direction, progress: number, count: number): SpriteFrame {
  const drawn: DrawnDirection = dir === 'west' ? 'east' : dir;
  return { tag: `${name}_${drawn}`, frame: frameOf(progress, count), flip: dir === 'west' };
}

export interface FrameClock {
  /** Free-running time, used only by idle cycles (never during a wind-up). */
  nowMs: number;
  /** Time since the fight ended, for death animations. */
  sinceEndMs: number;
}

export function enemyFrame(a: Animation, clock: FrameClock): SpriteFrame {
  switch (a.enemyPose) {
    case 'windup':
      return { tag: 'windup', frame: frameOf(a.progress, ENEMY_FRAMES.windup), flip: false };
    case 'strike':
      return a.toward ? directional('strike', a.toward, a.progress, ENEMY_FRAMES.strike) : { tag: 'windup', frame: 5, flip: false };
    case 'recoil':
      return a.toward ? directional('recoil', a.toward, a.progress, ENEMY_FRAMES.recoil) : { tag: 'idle', frame: 0, flip: false };
    case 'staggered':
      // Breaking on a parry plays through; during the riposte it holds the last frame.
      return { tag: 'break', frame: a.toward ? frameOf(a.progress, ENEMY_FRAMES.break) : ENEMY_FRAMES.break - 1, flip: false };
    case 'dead':
      return { tag: 'death', frame: Math.min(ENEMY_FRAMES.death - 1, Math.floor(clock.sinceEndMs / DEATH_FRAME_MS)), flip: false };
    case 'idle':
      return { tag: 'idle', frame: Math.floor(clock.nowMs / IDLE_FRAME_MS) % ENEMY_FRAMES.idle, flip: false };
  }
}

export function playerFrame(a: Animation, clock: FrameClock): SpriteFrame {
  switch (a.playerPose) {
    case 'guard':
      // One held guard frame for the whole wind-up.
      return { tag: 'idle', frame: 0, flip: false };
    case 'parry':
      return a.toward ? directional('parry', a.toward, a.progress, PLAYER_FRAMES.parry) : { tag: 'idle', frame: 0, flip: false };
    case 'hit':
      return a.toward ? directional('hit', a.toward, a.progress, PLAYER_FRAMES.hit) : { tag: 'idle', frame: 0, flip: false };
    case 'dead':
      return { tag: 'death', frame: Math.min(PLAYER_FRAMES.death - 1, Math.floor(clock.sinceEndMs / DEATH_FRAME_MS)), flip: false };
    case 'idle':
      return { tag: 'idle', frame: Math.floor(clock.nowMs / IDLE_FRAME_MS) % PLAYER_FRAMES.idle, flip: false };
  }
}
