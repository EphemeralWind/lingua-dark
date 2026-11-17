import type { QuestionKind } from '../content/types';
import {
  COMBO_WINDOW_PER_BLANK_S,
  DAMAGE_HIGH,
  DAMAGE_LOW,
  DAMAGE_MEDIUM,
  DELAYED_WINDOW_S,
  GRAB_WINDOW_S,
  JAB_WINDOW_S,
  OVERHEAD_WINDOW_S,
  STANCE_DRAIN,
  STANCE_FLOOR,
  SWEEP_WINDOW_S,
  ZONE_WINDOW_MULT,
} from '../tuning';
import type { AttackType } from './types';

const ATTACK_FOR_KIND: Record<QuestionKind, AttackType> = {
  vocab: 'jab',
  grammar: 'overhead',
  translate: 'delayed',
  listen: 'grab',
  order: 'sweep',
  combo: 'combo',
};

export function attackFor(kind: QuestionKind): AttackType {
  return ATTACK_FOR_KIND[kind];
}

const BASE_WINDOW_S: Record<AttackType, number> = {
  jab: JAB_WINDOW_S,
  overhead: OVERHEAD_WINDOW_S,
  delayed: DELAYED_WINDOW_S,
  grab: GRAB_WINDOW_S,
  sweep: SWEEP_WINDOW_S,
  // Each combo blank gets its own window (DECISIONS #7).
  combo: COMBO_WINDOW_PER_BLANK_S,
};

const DAMAGE: Record<AttackType, number> = {
  jab: DAMAGE_LOW,
  overhead: DAMAGE_HIGH,
  delayed: DAMAGE_MEDIUM,
  grab: DAMAGE_HIGH,
  sweep: DAMAGE_MEDIUM,
  combo: DAMAGE_MEDIUM,
};

export function zoneMultiplier(zone: number): number {
  const i = Math.min(Math.max(Math.floor(zone) - 1, 0), ZONE_WINDOW_MULT.length - 1);
  return ZONE_WINDOW_MULT[i] ?? 1;
}

/** Answer window for one strike, in milliseconds. */
export function windowMs(attack: AttackType, zone: number): number {
  return BASE_WINDOW_S[attack] * zoneMultiplier(zone) * 1000;
}

/** Share of the window left at lock-in: 1.0 instant, 0 at the deadline. */
export function parryQuality(startMs: number, deadlineMs: number, atMs: number): number {
  const span = deadlineMs - startMs;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (deadlineMs - atMs) / span));
}

export function stanceDrain(quality: number): number {
  return STANCE_DRAIN * Math.max(quality, STANCE_FLOOR);
}

export function damageFor(attack: AttackType): number {
  return DAMAGE[attack];
}
