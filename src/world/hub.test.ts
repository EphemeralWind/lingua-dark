import { describe, expect, it } from 'vitest';
import type { InputEvent } from '../platform/input';
import { HUB_START, hubInput, type HubState, type HubTarget } from './hub';

const stele: HubTarget = { pages: 4, hit: { x: 240, y: 100, w: 24, h: 56 } };
const book: HubTarget = { pages: 2, hit: { x: 40, y: 140, w: 20, h: 12 } };

const right: InputEvent = { type: 'direction', dir: 'east', atMs: 0 };
const left: InputEvent = { type: 'direction', dir: 'west', atMs: 0 };
const enter: InputEvent = { type: 'confirm', atMs: 0 };
const esc: InputEvent = { type: 'key', code: 'Escape', atMs: 0 };
const click = (x: number, y: number): InputEvent => ({ type: 'point', x, y, atMs: 0 });

function run(targets: HubTarget[], events: InputEvent[], from: HubState = HUB_START): { state: HubState; actions: (string | null)[] } {
  let state = from;
  const actions: (string | null)[] = [];
  for (const ev of events) {
    const step = hubInput(state, targets, ev);
    state = step.state;
    actions.push(step.action);
  }
  return { state, actions };
}

describe('bonfire hub', () => {
  it('opens the selected object at its first page', () => {
    expect(run([stele], [enter]).state).toEqual({ selected: 0, viewing: { object: 0, page: 0 } });
  });

  it('turns pages with wraparound, both ways', () => {
    expect(run([stele], [enter, right, right, right, right]).state.viewing?.page).toBe(0);
    expect(run([stele], [enter, left]).state.viewing?.page).toBe(3);
    expect(run([stele], [enter, right, right]).actions).toEqual(['opened', 'turned', 'turned']);
  });

  it('closes on Enter or Esc, then Esc leaves the bonfire', () => {
    expect(run([stele], [enter, right, esc, esc]).actions).toEqual(['opened', 'turned', 'closed', 'leave']);
    expect(run([stele], [enter, enter]).state.viewing).toBeNull();
  });

  it('cycles the selection between objects while browsing', () => {
    expect(run([stele, book], [right]).state.selected).toBe(1);
    expect(run([stele, book], [left]).state.selected).toBe(1);
    expect(run([stele, book], [right, right]).state.selected).toBe(0);
    expect(run([stele], [right]).actions).toEqual([null]);
  });

  it('opens an object by clicking it, and turns with clicks on the outer thirds', () => {
    expect(run([stele, book], [click(45, 145)]).state.viewing).toEqual({ object: 1, page: 0 });
    expect(run([stele], [click(10, 10)]).state.viewing).toBeNull();
    const { state, actions } = run([stele], [click(250, 120), click(300, 90), click(300, 90), click(10, 90), click(160, 90)]);
    expect(actions).toEqual(['opened', 'turned', 'turned', 'turned', 'closed']);
    expect(state.viewing).toBeNull();
  });

  it('with nothing to read, Enter leaves', () => {
    expect(run([], [enter]).actions).toEqual(['leave']);
  });
});
