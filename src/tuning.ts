// Every tunable number lives here, named after the tuning table in docs/SPEC.md section 3.8.
// Values tagged "default (not in design doc)" are placeholders to tune, not rules.

// --- Answer windows (design doc) ---
export const JAB_WINDOW_S = 3;
export const OVERHEAD_WINDOW_S = 5;
export const DELAYED_WINDOW_S = 4;
export const GRAB_WINDOW_S = 5;
export const SWEEP_WINDOW_S = 8;
export const COMBO_WINDOW_PER_BLANK_S = 2.5;
/** Zone 1 from design doc, Zones 2 and 3 suggested. Index 0 is Zone 1. */
export const ZONE_WINDOW_MULT: readonly number[] = [1.5, 1.25, 1.0];

// --- Stance and parry (design doc) ---
export const STANCE_FLOOR = 0.25;
/** Fraction of stanceMax drained when every strike of a combo is parried. */
export const COMBO_CLEAR_BONUS = 0.25;
export const FLASKS_PER_REST = 3;
/**
 * Wrong cards one flask greys out. The design doc says 2; the user changed it to start at 1 and
 * grow to 2 through Learned perks. Never 3: at least two cards always stay (DECISIONS #74).
 */
export const FLASK_POWER_BASE = 1;
export const FLASK_POWER_MAX = 2;
export const HIT_STOP_MS = 80;

// --- default (not in design doc) ---
export const STANCE_MAX = 100;
/** Four perfect parries break stance. */
export const STANCE_DRAIN = 25;
export const HIT_STANCE_REFILL = 20;
export const PLAYER_VITALITY = 100;
export const DAMAGE_LOW = 10;
export const DAMAGE_MEDIUM = 20;
export const DAMAGE_HIGH = 35;
export const RIPOSTE_DAMAGE_PER_WORD = 15;
export const ENEMY_HP = 60;

// --- default (not in design doc), added in DECISIONS.md #18 ---
/** How long the strike or parry plays before the next wind-up. */
export const RESOLVE_MS = 600;
/** How long the riposte result is shown before the next exchange. */
export const RIPOSTE_RESULT_MS = 800;
/** Fixed update step, 60 Hz. */
export const UPDATE_STEP_MS = 1000 / 60;
/** Parry quality at or above this shows the distinct high-quality parry shape (SPEC 8). */
export const PERFECT_PARRY_Q = 0.75;
/** Parry flash length: 3 frames at 60 Hz (SPEC 8). */
export const PARRY_FLASH_MS = 50;

// --- Learning (SPEC 6, design doc) ---
/** Review interval for Leitner boxes 1 to 5, in days. */
export const LEITNER_INTERVALS_DAYS: readonly number[] = [1, 3, 7, 14, 30];
/** Untelegraphed correct answers, on different days, that make a component Learned. */
export const MASTERY_CORRECT_DAYS = 2;
export const MAX_GHOSTS_PER_ROOM = 3;

// --- default (not in design doc), added in Milestone 3 ---
/** Questions in one bonfire review round. */
export const REVIEW_ROUND_SIZE = 5;
/** A ghost breaks on one parry (any drain exceeds this) and dies to one riposte word. */
export const GHOST_STANCE_MAX = 1;
export const GHOST_HP = 15;
export const ENEMY_XP = 50;
export const GHOST_XP = 10;
/** Vitality lost to an ambush after a wrong reading choice. Never kills. */
export const AMBUSH_DAMAGE = 15;
/** Seeds tried when looking for a question that shows a target component on its cards. */
export const TARGET_TRIES = 800;
/** Seeds tried when looking for a review question that tests a component exactly. */
export const REVIEW_TRIES = 8000;
/** Room-to-room walk transition. */
export const ROOM_TRANSITION_MS = 350;
/** Warden HP: a warden guards one seal of the boss gate (DECISIONS #73). */
export const WARDEN_HP = 90;
export const WARDEN_XP = 150;

/**
 * Meta-progression perks by all-time best Learned count (DECISIONS #75). Each row adds to the
 * base: vitality to max vitality, riposte to damage per riposte word, flaskPower to wrong
 * cards greyed (capped at FLASK_POWER_MAX), flasks to flasks per rest. Default (not in design doc).
 */
export interface PerkRow {
  at: number;
  vitality?: number;
  riposte?: number;
  flaskPower?: number;
  flasks?: number;
}
export const PERKS: readonly PerkRow[] = [
  { at: 10, vitality: 10 },
  { at: 25, flaskPower: 1 },
  { at: 40, riposte: 3 },
  { at: 60, vitality: 10 },
  { at: 80, flasks: 1 },
  { at: 100, vitality: 10 },
  { at: 115, riposte: 3 },
];
