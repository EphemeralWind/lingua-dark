import { describe, expect, it } from 'vitest';
import { FLASKS_PER_REST, FLASK_POWER_BASE, FLASK_POWER_MAX, PLAYER_VITALITY, RIPOSTE_DAMAGE_PER_WORD } from '../tuning';
import { nextPerkAt, perkLines, perksFor } from './perks';
import { learnedCount, newProfile, recordInProfile } from './profile';

describe('perks', () => {
  it('a new player has the base stats and a flask that greys out one card', () => {
    expect(perksFor(0)).toEqual({
      vitalityMax: PLAYER_VITALITY,
      riposteDamage: RIPOSTE_DAMAGE_PER_WORD,
      flaskPower: FLASK_POWER_BASE,
      flasksPerRest: FLASKS_PER_REST,
    });
    expect(FLASK_POWER_BASE).toBe(1);
  });

  it('follows the threshold table', () => {
    expect(perksFor(9).vitalityMax).toBe(100);
    expect(perksFor(10).vitalityMax).toBe(110);
    expect(perksFor(25).flaskPower).toBe(2);
    expect(perksFor(40).riposteDamage).toBe(18);
    expect(perksFor(80).flasksPerRest).toBe(4);
    expect(perksFor(120)).toEqual({ vitalityMax: 130, riposteDamage: 21, flaskPower: 2, flasksPerRest: 4 });
  });

  it('flask power never exceeds 2, even if the table asks for more', () => {
    expect(FLASK_POWER_MAX).toBe(2);
    expect(perksFor(5, [{ at: 1, flaskPower: 1 }, { at: 2, flaskPower: 1 }, { at: 3, flaskPower: 5 }]).flaskPower).toBe(2);
  });

  it('describes earned perks and the next threshold', () => {
    expect(perkLines(0)).toEqual([]);
    expect(perkLines(25)).toEqual(['+10 vitality', 'stronger flasks']);
    expect(nextPerkAt(25)).toBe(40);
  });

  it('sums repeated perks of one kind into one line, in first-earned order', () => {
    const table = [
      { at: 1, vitality: 10 },
      { at: 2, flasks: 1 },
      { at: 3, riposte: 3 },
      { at: 4, vitality: 10 },
      { at: 5, flasks: 1 },
      { at: 6, riposte: 3 },
    ];
    expect(perkLines(6, table)).toEqual(['+20 vitality', '+2 flasks per rest', '+6 riposte damage']);
    expect(perkLines(3, table)).toEqual(['+10 vitality', '+1 flask per rest', '+3 riposte damage']);
    expect(perkLines(500)).toEqual(['+30 vitality', 'stronger flasks', '+6 riposte damage', '+1 flask per rest']);
  });

  it('gives the next perk threshold', () => {
    expect(nextPerkAt(0)).toBe(10);
    expect(nextPerkAt(500)).toBeNull();
  });
});

describe('profile', () => {
  const learnTwice = (ids: string[]) => {
    const p = newProfile();
    recordInProfile(p, ids, true, 'review', 0);
    recordInProfile(p, ids, true, 'review', 1);
    return p;
  };

  it('counts Learned components and tracks the best count', () => {
    const p = learnTwice(['a', 'b', 'c']);
    expect(learnedCount(p.learner)).toBe(3);
    expect(p.bestLearned).toBe(3);
  });

  it('bestLearned never decreases when a component is un-learned', () => {
    const p = learnTwice(['a', 'b', 'c']);
    recordInProfile(p, ['a'], false, 'review', 2);
    expect(learnedCount(p.learner)).toBe(2);
    expect(p.bestLearned).toBe(3);
  });

  it('combat answers do not raise the count', () => {
    const p = newProfile();
    for (let d = 0; d < 5; d++) recordInProfile(p, ['a'], true, 'combat', d);
    expect(p.bestLearned).toBe(0);
  });

  it('a profile built from an old learner starts with its Learned count', () => {
    expect(newProfile(learnTwice(['x', 'y']).learner).bestLearned).toBe(2);
  });
});
