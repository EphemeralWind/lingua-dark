// The only things the renderer (and the blind bot) may read about an encounter.
// `Animation` drives every shape on screen. During a wind-up it is a function of
// elapsed progress alone, so it cannot carry anything about the question or the
// answer (CLAUDE.md non-negotiable 1). The type has no `correct` field before lock-in.
import { DIRECTIONS, type Direction } from '../content/types';
import { HIT_STOP_MS, PARRY_FLASH_MS, PERFECT_PARRY_Q } from '../tuning';
import type { Encounter } from './encounter';
import type { AttackType, RiposteVerdict } from './types';

export type EnemyPose = 'idle' | 'windup' | 'strike' | 'recoil' | 'staggered' | 'dead';
export type PlayerPose = 'idle' | 'guard' | 'parry' | 'hit' | 'dead';
export type Flash = 'none' | 'parry' | 'perfect' | 'hit';

export interface Animation {
  enemyPose: EnemyPose;
  /** 0 to 1 through the current pose. */
  progress: number;
  /** Direction of the strike and the parry. Null until the strike resolves. */
  toward: Direction | null;
  playerPose: PlayerPose;
  flash: Flash;
  /** Share of the answer window left, or null when no window is open. */
  timerLeft: number | null;
  /** True during hit-stop, when motion freezes. */
  frozen: boolean;
  /** How the strike resolved; null until lock-in or window close. */
  resolved: 'parry' | 'perfect' | 'hit' | null;
}

export interface Hud {
  attack: AttackType | null;
  enemyHp: number;
  enemyHpMax: number;
  stance: number;
  stanceMax: number;
  vitality: number;
  vitalityMax: number;
}

export interface CardText {
  dir: Direction;
  text: string;
  /** Marks appear only after resolution. Shapes, not colour (accessibility). */
  mark: 'none' | 'correct' | 'wrongPick';
  /** Greyed out by a flask the player drank. Only ever a wrong card. */
  greyed: boolean;
}

export interface Prompt {
  sentence: string;
  prompt: string;
  strike: number;
  strikeCount: number;
  /** Position in a boss flurry (chain): 0-based question index and chain length. */
  chainIndex: number;
  chainLength: number;
  /** Bug-report tag: question id and seed. Not the answer. */
  tag: string;
}

export interface RiposteView {
  sentence: string;
  prompt: string;
  blanks: number;
  /** Filled in once submitted. */
  results: { typed: string; answer: string; verdict: RiposteVerdict }[] | null;
}

export type Phase = 'idle' | 'windup' | 'resolving' | 'riposte' | 'riposteResult' | 'won' | 'lost';

export interface EncounterView {
  phase: Phase;
  animation: Animation;
  hud: Hud;
  /** Cards, always in N/E/S/W order. Empty outside wind-up and resolving. */
  cards: CardText[];
  prompt: Prompt | null;
  riposte: RiposteView | null;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

const REST: Animation = {
  enemyPose: 'idle',
  progress: 0,
  toward: null,
  playerPose: 'idle',
  flash: 'none',
  timerLeft: null,
  frozen: false,
  resolved: null,
};

export function animationOf(enc: Encounter, nowMs: number): Animation {
  const s = enc.state;
  switch (s.kind) {
    case 'windup': {
      const progress = clamp01((nowMs - s.startMs) / (s.deadlineMs - s.startMs));
      // Hollow mode has no timer: the wind-up holds its last pose until the player answers.
      return { ...REST, enemyPose: 'windup', progress, playerPose: 'guard', timerLeft: enc.untimed ? null : 1 - progress };
    }
    case 'resolving': {
      const elapsed = nowMs - s.startMs;
      const frozen = elapsed < HIT_STOP_MS;
      const progress = frozen ? 0 : clamp01((elapsed - HIT_STOP_MS) / (s.untilMs - s.startMs - HIT_STOP_MS));
      const parried = s.result === 'parry';
      const resolved = parried ? (s.quality >= PERFECT_PARRY_Q ? 'perfect' : 'parry') : 'hit';
      const flash: Flash = elapsed < PARRY_FLASH_MS ? resolved : 'none';
      return {
        enemyPose: parried ? (s.stanceBroken ? 'staggered' : 'recoil') : 'strike',
        progress,
        toward: s.correct,
        playerPose: parried ? 'parry' : 'hit',
        flash,
        timerLeft: null,
        frozen,
        resolved,
      };
    }
    case 'riposte':
    case 'riposteResult':
      return { ...REST, enemyPose: 'staggered' };
    case 'won':
      return { ...REST, enemyPose: 'dead' };
    case 'lost':
      return { ...REST, playerPose: 'dead' };
    case 'idle':
      return REST;
  }
}

export function viewOf(enc: Encounter, nowMs: number): EncounterView {
  const s = enc.state;
  const hud: Hud = {
    attack: enc.attack,
    enemyHp: enc.enemy.hp,
    enemyHpMax: enc.enemy.hpMax,
    stance: enc.enemy.stance,
    stanceMax: enc.enemy.stanceMax,
    vitality: enc.vitality,
    vitalityMax: enc.vitalityMax,
  };
  const view: EncounterView = { phase: s.kind, animation: animationOf(enc, nowMs), hud, cards: [], prompt: null, riposte: null };

  if (s.kind === 'windup' || s.kind === 'resolving') {
    const strike = s.question.strikes[s.strike];
    if (strike) {
      view.cards = DIRECTIONS.map((dir) => {
        let mark: CardText['mark'] = 'none';
        if (s.kind === 'resolving') {
          if (dir === s.correct) mark = 'correct';
          else if (dir === s.chosen) mark = 'wrongPick';
        }
        const greyed = s.kind === 'windup' && s.greyed.includes(dir);
        return { dir, text: strike.options[dir], mark, greyed };
      });
    }
    view.prompt = {
      sentence: s.question.sentence,
      prompt: s.question.prompt ?? '',
      strike: s.strike,
      strikeCount: s.question.strikes.length,
      chainIndex: enc.chainPosition.index,
      chainLength: enc.chainPosition.length,
      tag: `${s.question.id}#${s.question.seed}`,
    };
  } else if (s.kind === 'riposte' || s.kind === 'riposteResult') {
    view.riposte = {
      sentence: s.question.sentence,
      prompt: s.question.prompt ?? '',
      blanks: s.question.strikes.length,
      results:
        s.kind === 'riposteResult'
          ? s.question.strikes.map((st, i) => ({
              typed: s.typed[i] ?? '',
              answer: st.options[st.correct],
              verdict: s.verdicts[i] ?? 'wrong',
            }))
          : null,
    };
  }
  return view;
}
