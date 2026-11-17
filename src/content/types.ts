// Core content types from docs/SPEC.md section 9.

export type Direction = 'north' | 'east' | 'south' | 'west';

/** Fixed screen order of the four card slots. Never used to identify an answer. */
export const DIRECTIONS: readonly Direction[] = ['north', 'east', 'south', 'west'];

/** One blank, one strike. */
export interface Strike {
  /** Four cards, directions reshuffled every exchange. */
  options: Record<Direction, string>;
  correct: Direction;
}

export type QuestionKind = 'vocab' | 'grammar' | 'translate' | 'listen' | 'order' | 'combo';

export interface Question {
  id: string;
  kind: QuestionKind;
  /** Spanish text with ___ per blank; empty for listening grabs. */
  sentence: string;
  /** Instruction or English gloss shown with the sentence (DECISIONS #25). */
  prompt?: string;
  /** Spoken by speech synthesis. */
  audioText?: string;
  /** Length 1, or 2 to 4 for a combo. */
  strikes: Strike[];
  /** Knowledge components, e.g. 'v_levantar:present:3sg'. */
  components: string[];
  /** Reproduces the exact question, card placement included. */
  seed: number;
}
