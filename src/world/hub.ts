// The bonfire lesson hub (DECISIONS #96): pick an object by the fire, zoom in, turn its pages.
// Pure: the scene passes each object's page count and its hit box on the 320x180 buffer, and
// gets back the next state plus what happened, for sound and leaving. Any object kind works
// the same way, so a new one is data plus art.
import type { InputEvent } from '../platform/input';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HubTarget {
  pages: number;
  hit: Box;
}

export interface HubState {
  /** The highlighted object while browsing. */
  selected: number;
  /** The object zoomed in on, and its page; null while browsing. */
  viewing: { object: number; page: number } | null;
}

export type HubAction = 'selected' | 'opened' | 'turned' | 'closed' | 'leave';

export interface HubStep {
  state: HubState;
  action: HubAction | null;
}

export const HUB_START: HubState = { selected: 0, viewing: null };

const inside = (b: Box, x: number, y: number): boolean => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
const wrap = (i: number, n: number): number => ((i % n) + n) % n;

/** One input event. `width` is the buffer width, for the click-to-turn thirds. */
export function hubInput(s: HubState, targets: readonly HubTarget[], ev: InputEvent, width = 320): HubStep {
  const none: HubStep = { state: s, action: null };
  const escape = ev.type === 'key' && ev.code === 'Escape';
  const v = s.viewing;
  if (v) {
    const pages = targets[v.object]?.pages ?? 1;
    const turn = (by: number): HubStep =>
      pages > 1 ? { state: { ...s, viewing: { ...v, page: wrap(v.page + by, pages) } }, action: 'turned' } : none;
    if (ev.type === 'direction' && ev.dir === 'east') return turn(1);
    if (ev.type === 'direction' && ev.dir === 'west') return turn(-1);
    if (ev.type === 'point' && ev.x < width / 3) return turn(-1);
    if (ev.type === 'point' && ev.x >= (width * 2) / 3) return turn(1);
    if (ev.type === 'confirm' || escape || ev.type === 'point') return { state: { ...s, viewing: null }, action: 'closed' };
    return none;
  }
  if (escape) return { state: s, action: 'leave' };
  if (targets.length === 0) return ev.type === 'confirm' ? { state: s, action: 'leave' } : none;
  if (ev.type === 'direction' && (ev.dir === 'east' || ev.dir === 'west')) {
    if (targets.length < 2) return none;
    return { state: { ...s, selected: wrap(s.selected + (ev.dir === 'east' ? 1 : -1), targets.length) }, action: 'selected' };
  }
  const open = (i: number): HubStep => ({ state: { selected: i, viewing: { object: i, page: 0 } }, action: 'opened' });
  if (ev.type === 'confirm') return open(wrap(s.selected, targets.length));
  if (ev.type === 'point') {
    const i = targets.findIndex((t) => inside(t.hit, ev.x, ev.y));
    if (i >= 0) return open(i);
  }
  return none;
}
