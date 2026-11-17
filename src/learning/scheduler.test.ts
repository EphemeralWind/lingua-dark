import { describe, expect, it } from 'vitest';
import { demote, intervalDays, isDue, newSchedule, promote } from './scheduler';
import { dueComponents, newLearner, recordAnswer } from './learner';

describe('Leitner scheduler', () => {
  it('uses intervals of 1, 3, 7, 14 and 30 days for boxes 1 to 5', () => {
    expect([1, 2, 3, 4, 5].map(intervalDays)).toEqual([1, 3, 7, 14, 30]);
  });

  it('a new component starts in box 1, due today', () => {
    const s = newSchedule(10);
    expect(s).toEqual({ box: 1, dueDay: 10, promotedDay: null });
    expect(isDue(s, 10)).toBe(true);
  });

  it('a correct answer moves up one box and schedules by the new box', () => {
    let s = newSchedule(0);
    s = promote(s, 0);
    expect(s).toMatchObject({ box: 2, dueDay: 3 });
    s = promote(s, 3);
    expect(s).toMatchObject({ box: 3, dueDay: 10 });
    s = promote(s, 10);
    expect(s).toMatchObject({ box: 4, dueDay: 24 });
    s = promote(s, 24);
    expect(s).toMatchObject({ box: 5, dueDay: 54 });
  });

  it('box 5 is the top: another correct answer stays there and waits 30 days', () => {
    const s = promote({ box: 5, dueDay: 100, promotedDay: 70 }, 100);
    expect(s).toMatchObject({ box: 5, dueDay: 130 });
  });

  it('climbs at most one box per day', () => {
    const once = promote(newSchedule(0), 0);
    expect(promote(once, 0)).toBe(once);
    expect(promote(once, 1).box).toBe(3);
  });

  it('a wrong answer sends the component to box 1, due tomorrow, from any box', () => {
    for (const box of [1, 2, 3, 4, 5]) {
      expect(demote({ box, dueDay: 99, promotedDay: 5 }, 20)).toEqual({ box: 1, dueDay: 21, promotedDay: null });
    }
  });

  it('after a miss, the same day can still promote once (ghost recovery)', () => {
    let s = promote(newSchedule(0), 0);
    s = demote(s, 0);
    s = promote(s, 0);
    expect(s.box).toBe(2);
  });

  it('is due on and after its due day, not before', () => {
    const s = { box: 2, dueDay: 5, promotedDay: 2 };
    expect([isDue(s, 4), isDue(s, 5), isDue(s, 6)]).toEqual([false, true, true]);
  });
});

describe('learner records and due order', () => {
  it('combat answers move boxes', () => {
    let l = recordAnswer(newLearner(), ['a'], true, 'combat', 0);
    expect(l.components['a']).toMatchObject({ box: 2, dueDay: 3, seen: 1, misses: 0 });
    l = recordAnswer(l, ['a'], false, 'combat', 1);
    expect(l.components['a']).toMatchObject({ box: 1, dueDay: 2, seen: 2, misses: 1 });
  });

  it('a flask-assisted correct answer does not promote, a miss still demotes', () => {
    let l = recordAnswer(newLearner(), ['a'], true, 'combat', 0, { assisted: true });
    expect(l.components['a']).toMatchObject({ box: 1, dueDay: 0 });
    l = recordAnswer(recordAnswer(l, ['a'], true, 'combat', 0), ['a'], false, 'combat', 0, { assisted: true });
    expect(l.components['a']?.box).toBe(1);
  });

  it('records every component the strike tested', () => {
    const l = recordAnswer(newLearner(), ['v_x:present:3sg', 'art:definite:f:sg'], true, 'combat', 0);
    expect(Object.keys(l.components).sort()).toEqual(['art:definite:f:sg', 'v_x:present:3sg']);
  });

  it('does not mutate the old state', () => {
    const a = newLearner();
    recordAnswer(a, ['x'], true, 'combat', 0);
    expect(a.components).toEqual({});
  });

  it('lists due components lowest box first, then oldest due', () => {
    let l = newLearner();
    l = recordAnswer(l, ['high'], true, 'combat', 0); // box 2, due 3
    l = recordAnswer(l, ['low'], false, 'combat', 1); // box 1, due 2
    l = recordAnswer(l, ['later'], false, 'combat', 2); // box 1, due 3
    expect(dueComponents(l, 1)).toEqual([]);
    expect(dueComponents(l, 2)).toEqual(['low']);
    expect(dueComponents(l, 3)).toEqual(['low', 'later', 'high']);
    expect(dueComponents(l, 3, ['high', 'later'])).toEqual(['later', 'high']);
  });
});
