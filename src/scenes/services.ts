// What every scene can use: sprites, sound, speech, game time, settings and the riposte field.
import { CUE_VISUAL, type Cue } from '../combat/cues';
import type { SpriteBank } from '../platform/atlas';
import type { Sound } from '../platform/audio';
import type { GameTime } from '../platform/gameTime';
import type { Renderer } from '../platform/renderer';
import type { RiposteInput } from '../platform/riposteInput';
import type { Speech } from '../platform/speech';
import { C } from '../platform/palette';
import type { Settings } from '../save/settings';
import { CAPTION_MS } from '../tuning';

/**
 * Plays a cue's sound and shows its caption: the visual twin of every sound (SPEC 8). Captions
 * show even with sound off, so the visual cue never depends on hearing.
 */
export class CuePlayer {
  private caption: { text: string; until: number } | null = null;

  constructor(private readonly sound: Sound) {}

  play(cue: Cue, nowMs: number): void {
    this.sound.play(cue);
    const text = CUE_VISUAL[cue].caption;
    if (text) this.caption = { text, until: nowMs + CAPTION_MS };
  }

  /** Draws the current caption ("♪ clang") right-aligned at (x, y). */
  draw(r: Renderer, nowMs: number, x = 312, y = 33): void {
    if (!this.caption || nowMs > this.caption.until) return;
    r.text(`♪ ${this.caption.text}`, x, y, { size: 6, color: C.signal, align: 'right', outline: C.void });
  }
}

export interface Services {
  sprites: SpriteBank;
  sound: Sound;
  speech: Speech;
  cues: CuePlayer;
  time: GameTime;
  /** Live settings object; the settings menu edits it in place. */
  settings: Settings;
  riposte: RiposteInput;
  setTextMode: (on: boolean) => void;
}
