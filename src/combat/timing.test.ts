import { describe, expect, it } from 'vitest';
import { attackFor, damageFor, parryQuality, stanceDrain, windowMs, zoneMultiplier } from './timing';

describe('timing', () => {
  it('scales windows by zone', () => {
    expect(windowMs('jab', 1)).toBe(4500);
    expect(windowMs('overhead', 1)).toBe(7500);
    expect(windowMs('combo', 1)).toBe(3750);
    expect(windowMs('jab', 3)).toBe(3000);
    expect(zoneMultiplier(2)).toBe(1.25);
    expect(zoneMultiplier(9)).toBe(1.0);
  });

  it('measures quality as share of window left', () => {
    expect(parryQuality(0, 1000, 0)).toBe(1);
    expect(parryQuality(0, 1000, 250)).toBe(0.75);
    expect(parryQuality(0, 1000, 1000)).toBe(0);
    expect(parryQuality(0, 1000, 2000)).toBe(0);
  });

  it('drains stance with a floor', () => {
    expect(stanceDrain(1)).toBe(25);
    expect(stanceDrain(0.5)).toBe(12.5);
    expect(stanceDrain(0.1)).toBe(6.25);
    expect(stanceDrain(0)).toBe(6.25);
  });

  it('maps question kinds to attacks and damage tiers', () => {
    expect(attackFor('vocab')).toBe('jab');
    expect(attackFor('grammar')).toBe('overhead');
    expect(attackFor('translate')).toBe('delayed');
    expect(attackFor('combo')).toBe('combo');
    expect(damageFor('jab')).toBe(10);
    expect(damageFor('overhead')).toBe(35);
    expect(damageFor('delayed')).toBe(20);
  });
});
