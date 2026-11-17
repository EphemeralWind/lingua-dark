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
export const FLASK_GREYS_OUT = 2;
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
