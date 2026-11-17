import { describe, expect, it } from 'vitest';
import { zoneComponents } from '../content/components';
import { GATE_THRESHOLD } from '../tuning';
import { gateProgress } from './gate';
import { newLearner, recordAnswer, type LearnerState } from './learner';

function learnAll(l: LearnerState, ids: readonly string[]): LearnerState {
  return recordAnswer(recordAnswer(l, ids, true, 'review', 0), ids, true, 'review', 1);
}

describe('boss gate', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `c${i}`);

  it('uses an 80% threshold by default', () => {
    expect(GATE_THRESHOLD).toBe(0.8);
  });

  it('is closed with nothing learned', () => {
    expect(gateProgress(newLearner(), ids)).toEqual({ learned: 0, total: 10, needed: 8, open: false });
  });

  it('stays closed at 7 of 10 and opens at exactly 8 of 10', () => {
    expect(gateProgress(learnAll(newLearner(), ids.slice(0, 7)), ids).open).toBe(false);
    expect(gateProgress(learnAll(newLearner(), ids.slice(0, 8)), ids).open).toBe(true);
  });

  it('counts only Learned components, not schedule boxes', () => {
    let l = newLearner();
    for (let day = 0; day < 40; day++) l = recordAnswer(l, ids, true, 'combat', day);
    expect(gateProgress(l, ids).learned).toBe(0);
  });

  it('ignores Learned components outside the zone', () => {
    const l = learnAll(newLearner(), ['w_izquierda', 'other', ...ids.slice(0, 7)]);
    expect(gateProgress(l, ids)).toMatchObject({ learned: 7, open: false });
  });

  it('closes again if an untelegraphed miss un-learns a component', () => {
    let l = learnAll(newLearner(), ids.slice(0, 8));
    expect(gateProgress(l, ids).open).toBe(true);
    l = recordAnswer(l, ['c0'], false, 'review', 2);
    expect(gateProgress(l, ids).open).toBe(false);
  });

  it('never opens for an empty zone', () => {
    expect(gateProgress(newLearner(), []).open).toBe(false);
  });

  it('works on the real Zone 1 universe', () => {
    const zone = zoneComponents(1);
    const needed = Math.ceil(zone.length * 0.8);
    expect(gateProgress(learnAll(newLearner(), zone.slice(0, needed - 1)), zone).open).toBe(false);
    expect(gateProgress(learnAll(newLearner(), zone.slice(0, needed)), zone).open).toBe(true);
  });
});
