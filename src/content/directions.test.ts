import { describe, expect, it } from 'vitest';
import { assignStrike } from './directions';
import { createRng } from './rng';
import { DIRECTIONS, type Direction } from './types';

describe('assignStrike', () => {
  it('places all four cards and marks the answer', () => {
    const s = assignStrike('la', ['el', 'las', 'los'], createRng(3));
    expect(Object.keys(s.options).sort()).toEqual([...DIRECTIONS].sort());
    expect(s.options[s.correct]).toBe('la');
    expect(new Set(Object.values(s.options)).size).toBe(4);
  });

  it('puts the answer in each direction about a quarter of the time', () => {
    const rng = createRng(42);
    const counts: Record<Direction, number> = { north: 0, east: 0, south: 0, west: 0 };
    const N = 40_000;
    for (let i = 0; i < N; i++) counts[assignStrike('a', ['b', 'c', 'd'], rng).correct]++;
    for (const d of DIRECTIONS) expect(Math.abs(counts[d] / N - 0.25)).toBeLessThan(0.01);
  });

  it('rejects duplicate cards and the wrong distractor count', () => {
    expect(() => assignStrike('a', ['a', 'b', 'c'], createRng(1))).toThrow();
    expect(() => assignStrike('a', ['b', 'c'], createRng(1))).toThrow();
  });
});
