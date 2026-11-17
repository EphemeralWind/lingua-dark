// Fixed 60 Hz update steps, rendering on requestAnimationFrame.
import { UPDATE_STEP_MS } from '../tuning';

const MAX_FRAME_MS = 250;

export interface LoopHooks {
  /** `nowMs` is performance.now() read in platform and passed in (CLAUDE.md). */
  update(nowMs: number): void;
  render(nowMs: number): void;
}

export function startLoop(hooks: LoopHooks): () => void {
  let last = performance.now();
  let acc = 0;
  let handle = 0;

  const frame = (ts: number): void => {
    acc += Math.min(ts - last, MAX_FRAME_MS);
    last = ts;
    while (acc >= UPDATE_STEP_MS) {
      hooks.update(performance.now());
      acc -= UPDATE_STEP_MS;
    }
    hooks.render(performance.now());
    handle = requestAnimationFrame(frame);
  };
  handle = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(handle);
}
