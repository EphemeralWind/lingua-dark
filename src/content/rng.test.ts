import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('createRng', () => {
  it('reproduces the same stream from the same seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('gives different streams for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('keeps next() in [0, 1) and int() in range', () => {
    const r = createRng(99);
    for (let i = 0; i < 10_000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = r.int(4);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(4);
    }
  });

  it('is roughly uniform over int(4)', () => {
    const r = createRng(7);
    const counts = [0, 0, 0, 0];
    const N = 40_000;
    for (let i = 0; i < N; i++) counts[r.int(4)]!++;
    for (const c of counts) expect(Math.abs(c / N - 0.25)).toBeLessThan(0.01);
  });

  it('shuffle returns a permutation and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5];
    const out = createRng(5).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual(input);
  });

  it('rejects bad int() bounds and empty picks', () => {
    const r = createRng(1);
    expect(() => r.int(0)).toThrow();
    expect(() => r.pick([])).toThrow();
  });
});
