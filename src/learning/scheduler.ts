// Leitner scheduler (SPEC 6). Five boxes with review intervals of 1, 3, 7, 14 and 30 days.
// Pure: time comes in as a whole local day number from the caller (see platform/clock.ts).
import { LEITNER_INTERVALS_DAYS } from '../tuning';

export const BOX_COUNT = LEITNER_INTERVALS_DAYS.length;

export interface Schedule {
  /** 1 to 5. */
  box: number;
  /** First day the component is due again. */
  dueDay: number;
  /** Day of the last promotion, so a component climbs at most one box per day (DECISIONS #57). */
  promotedDay: number | null;
}

export function intervalDays(box: number): number {
  return LEITNER_INTERVALS_DAYS[Math.min(BOX_COUNT, Math.max(1, box)) - 1] as number;
}

/** A component the player has never answered: box 1, due now. */
export function newSchedule(day: number): Schedule {
  return { box: 1, dueDay: day, promotedDay: null };
}

/** A correct answer moves the component up one box, once per day. */
export function promote(s: Schedule, day: number): Schedule {
  if (s.promotedDay === day) return s;
  const box = Math.min(BOX_COUNT, s.box + 1);
  return { box, dueDay: day + intervalDays(box), promotedDay: day };
}

/** A wrong answer sends the component back to box 1, due tomorrow. */
export function demote(_s: Schedule, day: number): Schedule {
  return { box: 1, dueDay: day + intervalDays(1), promotedDay: null };
}

export function isDue(s: Schedule, day: number): boolean {
  return s.dueDay <= day;
}
