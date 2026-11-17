// Seeded RNG (mulberry32). All randomness in game logic goes through here; never Math.random.

export interface Rng {
  /** The seed this stream started from. */
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** New array, Fisher-Yates shuffled. */
  shuffle<T>(items: readonly T[]): T[];
  /** A fresh 32-bit seed drawn from this stream, for deriving sub-streams. */
  nextSeed(): number;
}

export function createRng(seed: number): Rng {
  const start = seed >>> 0;
  let state = start;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (n: number): number => {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`rng.int needs a positive integer, got ${n}`);
    return Math.floor(next() * n);
  };

  return {
    seed: start,
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick on empty array');
      return items[int(items.length)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const tmp = out[i] as T;
        out[i] = out[j] as T;
        out[j] = tmp;
      }
      return out;
    },
    nextSeed(): number {
      return Math.floor(next() * 4294967296) >>> 0;
    },
  };
}
