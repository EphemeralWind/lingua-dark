// Arrow keys, WASD, and card clicks all produce a Direction. Events carry the
// performance.now() time they fired, so parry quality is not quantised to frames.
import type { Direction } from '../content/types';
import type { Renderer } from './renderer';

export type InputEvent =
  | { type: 'direction'; dir: Direction; atMs: number }
  | { type: 'point'; x: number; y: number; atMs: number }
  | { type: 'confirm'; atMs: number }
  /** Any other key, by KeyboardEvent.code (KeyF flask, KeyM map, Escape, ...). */
  | { type: 'key'; code: string; atMs: number };

/** Other keys the game uses; their browser default is suppressed. */
const GAME_KEYS = new Set(['KeyF', 'KeyM', 'KeyE', 'KeyI', 'KeyN', 'Escape', 'F8', 'F9', 'F10']);

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'north',
  ArrowRight: 'east',
  ArrowDown: 'south',
  ArrowLeft: 'west',
  KeyW: 'north',
  KeyD: 'east',
  KeyS: 'south',
  KeyA: 'west',
};

export class Input {
  private queue: InputEvent[] = [];
  /** While true, keys belong to the riposte text field (DECISIONS #15). */
  textMode = false;

  constructor(renderer: Renderer, target: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (this.textMode || e.repeat) return;
      const atMs = performance.now();
      const dir = KEY_DIRECTIONS[e.code];
      if (dir) {
        e.preventDefault();
        this.queue.push({ type: 'direction', dir, atMs });
      } else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.queue.push({ type: 'confirm', atMs });
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (GAME_KEYS.has(e.code)) e.preventDefault();
        this.queue.push({ type: 'key', code: e.code, atMs });
      }
    });
    target.addEventListener('pointerdown', (e) => {
      const atMs = performance.now();
      const p = renderer.toInternal(e.clientX, e.clientY);
      if (p) this.queue.push({ type: 'point', x: p.x, y: p.y, atMs });
    });
  }

  drain(): InputEvent[] {
    const out = this.queue;
    this.queue = [];
    return out;
  }
}
