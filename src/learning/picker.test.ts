// Picker tests, including the memory bots: a language-blind player who remembers the card
// text it missed must still score at chance against due-first, ghost and echo questions
// (CLAUDE.md rule zero, DECISIONS #58).
import { describe, expect, it } from 'vitest';
import { cardRepresentable, componentSurfaces, zoneComponents } from '../content/components';
import { createRng } from '../content/rng';
import { DIRECTIONS, type Direction } from '../content/types';
import { Encounter } from '../combat/encounter';
import { RESOLVE_MS } from '../tuning';
import { newLearner, recordAnswer, type LearnerState } from './learner';
import { createPicker, targetedQuestion } from './picker';

const universe = zoneComponents(1);
const representable = universe.filter((c) => cardRepresentable(c));
const lower = (s: string): string => s.toLowerCase();

describe('targeted questions (combat)', () => {
  it('always show the target on a card', () => {
    const rng = createRng(7);
    for (const c of representable) {
      const q = targetedQuestion(rng, c);
      expect(q, c).not.toBeNull();
      const surface = lower(componentSurfaces(c)[0]!);
      expect(q!.strikes.some((s) => Object.values(s.options).some((t) => lower(t) === surface))).toBe(true);
    }
  });

  it('return null for a component that never shows on a card', () => {
    expect(targetedQuestion(createRng(1), 'n_manzana:plural')).toBeNull();
  });

  // The target card is the answer one time in four, for each kind of component.
  it.each([
    ['verbs', /^v_/],
    ['articles', /^art:/],
    ['vocabulary', /^n_[^:]+$/],
  ])('the target card is the answer at chance: %s', (_name, re) => {
    const targets = representable.filter((c) => re.test(c));
    const rng = createRng(99);
    let shown = 0;
    let answer = 0;
    while (shown < 3000) {
      const c = rng.pick(targets);
      const q = targetedQuestion(rng, c)!;
      const surface = lower(componentSurfaces(c)[0]!);
      for (const s of q.strikes) {
        if (!Object.values(s.options).some((t) => lower(t) === surface)) continue;
        shown++;
        if (lower(s.options[s.correct]) === surface) answer++;
      }
    }
    // 3,000 strikes: one standard error is ~0.008.
    expect(Math.abs(answer / shown - 0.25)).toBeLessThan(0.03);
  });
});

describe('memory bots against the due-first picker', () => {
  type Strategy = (cards: Record<Direction, string>, missed: string[], rng: ReturnType<typeof createRng>) => Direction;
  const pickMissed: Strategy = (cards, missed, rng) => {
    for (let i = missed.length - 1; i >= 0; i--) {
      const hit = DIRECTIONS.filter((d) => lower(cards[d]) === missed[i]);
      if (hit.length > 0) return hit[0]!;
    }
    return rng.pick(DIRECTIONS);
  };
  const avoidMissed: Strategy = (cards, missed, rng) => {
    const fresh = DIRECTIONS.filter((d) => !missed.includes(lower(cards[d])));
    return rng.pick(fresh.length > 0 ? fresh : DIRECTIONS);
  };

  it.each([
    ['pick a card it missed before', pickMissed],
    ['avoid cards it missed before', avoidMissed],
  ])('%s: scores at chance', (_name, strategy) => {
    const rng = createRng(2024);
    let learner: LearnerState = newLearner();
    let strikes = 0;
    let parries = 0;
    const missed: string[] = [];
    let missedStrikes = 0;
    let shownMissed = 0;
    for (let fight = 0; fight < 500; fight++) {
      const day = fight; // one fight a day, so missed components fall due
      const enc = new Encounter(createPicker({ rng: createRng(rng.nextSeed()), learner: () => ({ state: learner, day }), among: universe }), {
        zone: 1,
      });
      let now = 0;
      enc.start(now);
      let logged = 0;
      for (let step = 0; step < 400 && !enc.finished; step++) {
        const s = enc.state;
        if (s.kind === 'windup') {
          const strike = s.question.strikes[s.strike]!;
          if (DIRECTIONS.some((d) => missed.includes(lower(strike.options[d])))) shownMissed++;
          enc.lockIn(strategy(strike.options, missed, rng), now + 50);
          // The bot sees the revealed answer of every strike it missed.
          const r = enc.state;
          if (r.kind === 'resolving' && r.result === 'hit') {
            const text = lower(strike.options[r.correct]);
            if (missed[missed.length - 1] !== text) missed.push(text);
            missedStrikes++;
          }
        } else if (s.kind === 'riposte') {
          enc.submitRiposte([], now);
        }
        now += RESOLVE_MS + 100;
        enc.tick(now);
        for (; logged < enc.log.length; logged++) {
          const rec = enc.log[logged]!;
          strikes++;
          if (rec.result === 'parry') parries++;
          learner = recordAnswer(learner, rec.components, rec.result === 'parry', 'combat', day);
        }
      }
    }
    expect(strikes).toBeGreaterThan(3000);
    // The due-first picker really does bring missed forms back onto the cards.
    expect(missedStrikes).toBeGreaterThan(2000);
    expect(shownMissed / strikes).toBeGreaterThan(0.5);
    expect(parries / strikes).toBeLessThanOrEqual(0.25 + 0.025);
  });
});
