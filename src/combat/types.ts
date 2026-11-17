// Encounter types from docs/SPEC.md section 9, extended per DECISIONS #17.
import type { Direction, Question } from '../content/types';

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

/** One resolved strike, kept for tests and later for playtest logs. */
export interface ExchangeRecord {
  questionId: string;
  seed: number;
  strike: number;
  chosen: Direction | null;
  correct: Direction;
  result: 'parry' | 'hit';
  quality: number;
  /** Knowledge components this strike tested. */
  components: string[];
  /** A flask greyed out two cards on this strike. */
  assisted: boolean;
}
