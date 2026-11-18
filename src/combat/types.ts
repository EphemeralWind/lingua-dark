// Encounter types from docs/SPEC.md section 9, extended per DECISIONS #17.
import type { Direction, Question, QuestionKind } from '../content/types';

export type AttackType = 'jab' | 'overhead' | 'delayed' | 'grab' | 'sweep' | 'combo';

export interface Enemy {
  hp: number;
  hpMax: number;
  stance: number;
  stanceMax: number;
}

export type EncounterState =
  | { kind: 'idle' }
  | {
      kind: 'windup';
      question: Question;
      strike: number;
      startMs: number;
      deadlineMs: number;
      /** Wrong cards a flask greyed out; empty until the player drinks one (SPEC 3.6). */
      greyed: Direction[];
    }
  | {
      kind: 'resolving';
      question: Question;
      /** Index of the blank within the question, never of an answer. */
      strike: number;
      chosen: Direction | null;
      /** Where the strike came from. Only exists after lock-in or window close. */
      correct: Direction;
      result: 'parry' | 'hit';
      /** 0 to 1, share of the answer window left at lock-in. */
      quality: number;
      startMs: number;
      untilMs: number;
      stanceBroken: boolean;
      comboCleared: boolean;
      /** A flask was used on this strike. */
      assisted: boolean;
    }
  | { kind: 'riposte'; question: Question; typed: string[] }
  | {
      kind: 'riposteResult';
      question: Question;
      typed: string[];
      verdicts: RiposteVerdict[];
      untilMs: number;
    }
  | { kind: 'won' }
  | { kind: 'lost' };

export type RiposteVerdict = 'exact' | 'accent' | 'wrong';

/** One resolved strike, kept for tests, the review schedule and the playtest log. */
export interface ExchangeRecord {
  questionId: string;
  seed: number;
  kind: QuestionKind;
  attack: AttackType;
  strike: number;
  /** 0-based question index within a boss flurry; 0 outside chains. */
  chainIndex: number;
  chosen: Direction | null;
  correct: Direction;
  result: 'parry' | 'hit';
  quality: number;
  /** Knowledge components this strike tested. */
  components: string[];
  /** A flask greyed out two cards on this strike. */
  assisted: boolean;
  /** Ms from the start of the wind-up to lock-in, or to the window closing on a timeout. */
  answerMs: number;
  /** Length of the answer window in ms (it still exists in Hollow mode, where it never closes). */
  windowMs: number;
  /** The window closed with no answer. */
  timedOut: boolean;
  /** This strike broke the enemy's stance. */
  stanceBroken: boolean;
  /** Hollow mode (no timers) was on when the strike resolved. */
  untimed: boolean;
}
