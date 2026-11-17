import { describe, expect, it } from 'vitest';
import { zoneTemplates } from '../content/deck';
import { generate } from '../content/generator';
import { CUE_VISUAL, cuesBetween } from './cues';
import { Encounter } from './encounter';
import { viewOf } from './view';

describe('sound cues', () => {
  it('every cue has a visual cue', () => {
    for (const [cue, v] of Object.entries(CUE_VISUAL)) expect(v.visual.length, cue).toBeGreaterThan(0);
  });

  it('a wind-up sounds the same for every question and answer direction', () => {
    const seen = new Set<string>();
    for (const t of zoneTemplates(1)) {
      for (let seed = 0; seed < 40; seed++) {
        const enc = new Encounter(() => generate(t, seed), { zone: 1 });
        const before = viewOf(enc, 0);
        enc.start(0);
        const cues = [...cuesBetween(before, viewOf(enc, 0)), ...cuesBetween(viewOf(enc, 0), viewOf(enc, 1500))];
        seen.add(JSON.stringify(cues));
      }
    }
    expect([...seen]).toEqual([JSON.stringify(['windup'])]);
  });

  it('a parry, a clean parry and a hit sound different, after lock-in only', () => {
    const q = generate(zoneTemplates(1)[0]!, 7);
    const correct = q.strikes[0]!.correct;
    const wrong = correct === 'north' ? 'south' : 'north';
    const play = (dir: typeof correct, atMs: number): string[] => {
      const enc = new Encounter(() => q, { zone: 1 });
      enc.start(0);
      const before = viewOf(enc, atMs);
      enc.lockIn(dir, atMs);
      return cuesBetween(before, viewOf(enc, atMs));
    };
    expect(play(correct, 10)).toEqual(['perfect']);
    expect(play(correct, 6000)).toEqual(['parry']);
    expect(play(wrong, 10)).toEqual(['hit']);
  });
});
