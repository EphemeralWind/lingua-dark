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
 * Perks are paused (DECISIONS #96), so flasks stay at FLASK_POWER_BASE for now.
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
/** A ghost breaks on one parry (any drain exceeds this) and dies to one riposte word. */
export const GHOST_STANCE_MAX = 1;
export const GHOST_HP = 15;
export const ENEMY_XP = 50;
export const GHOST_XP = 10;
/** Vitality lost to an ambush after a wrong reading choice. Never kills. */
export const AMBUSH_DAMAGE = 15;
/** Seeds tried when looking for a question that shows a target component on its cards. */
export const TARGET_TRIES = 800;
/** Room-to-room walk transition. */
export const ROOM_TRANSITION_MS = 350;
/** Warden HP: a warden guards one seal of the boss gate (DECISIONS #73). */
export const WARDEN_HP = 90;
export const WARDEN_XP = 150;

// --- default (not in design doc), added in Milestone 4 ---
/** Bonfire lesson pages (DECISIONS #96): how long a page takes to slide when turned (none with reduced motion). */
export const LESSON_TURN_MS = 150;

/** Zone boss (SPEC 3.7): HP of each phase in order (the harder second phase lasts longer), and the stance meter. */
export const BOSS_PHASE_HP: readonly number[] = [60, 80];
export const BOSS_STANCE_MAX = 100;
/** Questions chained into one flurry per phase: the boss's longer combos (DECISIONS #77, #95). */
export const BOSS_CHAIN: readonly number[] = [2, 3];
export const BOSS_XP = 500;
/** Title card between boss phases. */
export const PHASE_TRANSITION_MS = 2200;
/** A phase card that carries a battle cry stays up longer, so the line can be heard. */
export const BATTLE_CRY_MS = 3600;
/** The boss shakes as it shouts, for this long at the start of the cry card (none with reduced motion). */
export const CRY_SHAKE_MS = 700;
/** How long a sound caption stays on screen. */
export const CAPTION_MS = 900;
/** Larger-text setting: text scale factor. */
export const LARGE_TEXT_SCALE = 1.5;
/** Screen shake on a hit, in internal pixels (off with reduced motion). */
export const HIT_SHAKE_PX = 2;

// --- Playtest (M5) ---
/**
 * Events kept in the local playtest log; the oldest drop first. About 400 bytes each, so this
 * stays near 2 MB, well inside localStorage's usual 5 MB. An hour of play is about 1,000 strikes.
 * Default (not in design doc).
 */
export const PLAYTEST_MAX_EVENTS = 5_000;
/** Chance of guessing one four-card strike. The litmus test compares accuracy against it. */
export const CHANCE_ACCURACY = 0.25;
/** Litmus: a session's timed accuracy is "above chance" when the one-sided binomial p is below this. */
export const LITMUS_ALPHA = 0.01;
/** Report hint: flag an attack when more than this share of timed strikes time out. */
export const REPORT_TIMEOUT_WARN = 0.2;
/** Report hint: flag a window as generous when accurate players answer within this share of it. */
export const REPORT_FAST_SHARE = 0.4;
/** Litmus: the first this-many timed strikes of a session, before revealed answers can teach much. */
export const LITMUS_EARLY_STRIKES = 40;
