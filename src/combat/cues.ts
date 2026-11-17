// Sound cues and their visual twins (SPEC 8: every audio cue has a visual cue, except the
// listening grab, where audio is the question). Pure.
//
// Fight cues are derived from the view's phase, animation and riposte verdicts only, the same
// data the renderer draws from. The wind-up cue is the same for every question and direction,
// so sound carries nothing about the answer before lock-in.
import type { EncounterView } from './view';

export type Cue =
  // fight
  | 'windup'
  | 'parry'
  | 'perfect'
  | 'hit'
  | 'break'
  | 'riposteHit'
  | 'riposteMiss'
  | 'won'
  | 'lost'
  // world and menus
  | 'step'
  | 'blocked'
  | 'bonfire'
  | 'seal'
  | 'phase'
  | 'stone'
  | 'menu';

/**
 * The visual cue that goes with each sound. `caption` is shown in the sound-caption strip;
 * an empty caption means another on-screen element already shows it (named in `visual`).
 */
export const CUE_VISUAL: Record<Cue, { caption: string; visual: string }> = {
  windup: { caption: '', visual: 'the wind-up animation and the deadline bar' },
  parry: { caption: 'clang', visual: 'parry flash (or the steady parry ring with reduced motion) and caption' },
  perfect: { caption: 'clang! (clean)', visual: 'diamond spark shape and caption' },
  hit: { caption: 'thud', visual: 'hit cross over the player and caption' },
  break: { caption: 'crack', visual: 'enemy break pose, RIPOSTE banner and caption' },
  riposteHit: { caption: 'slash', visual: 'riposte verdict lines and caption' },
  riposteMiss: { caption: 'whiff', visual: 'riposte verdict lines and caption' },
  won: { caption: 'foe falls', visual: 'FOE DEFEATED banner and caption' },
  lost: { caption: 'you fall', visual: 'YOU DIED banner and caption' },
  step: { caption: 'steps', visual: 'room transition and caption' },
  blocked: { caption: 'clunk', visual: 'message line and caption' },
  bonfire: { caption: 'fire crackles', visual: 'bonfire rest scene and caption' },
  seal: { caption: 'chime', visual: 'seal socket ◆ and message' },
  phase: { caption: 'bell tolls', visual: 'phase title card and caption' },
  stone: { caption: 'stone grinds', visual: 'the lesson page opens or turns, its numeral marker moves, and caption' },
  menu: { caption: '', visual: 'menu cursor moves' },
};

type CueSource = Pick<EncounterView, 'phase' | 'animation' | 'riposte'>;

/** Cues to play when the fight view changes from `prev` to `next`. */
export function cuesBetween(prev: CueSource | null, next: CueSource): Cue[] {
  const out: Cue[] = [];
  const from = prev?.phase ?? 'idle';
  if (next.phase === 'windup' && from !== 'windup') out.push('windup');
  if (next.phase === 'resolving' && from !== 'resolving') {
    const r = next.animation.resolved;
    if (r) out.push(r);
    if (next.animation.enemyPose === 'staggered') out.push('break');
  }
  if (next.phase === 'riposteResult' && from !== 'riposteResult') {
    const landed = next.riposte?.results?.some((x) => x.verdict !== 'wrong') ?? false;
    out.push(landed ? 'riposteHit' : 'riposteMiss');
  }
  if (next.phase === 'won' && from !== 'won') out.push('won');
  if (next.phase === 'lost' && from !== 'lost') out.push('lost');
  return out;
}
