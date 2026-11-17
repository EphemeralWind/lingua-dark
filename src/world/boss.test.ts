import { describe, expect, it } from 'vitest';
import { bossIn } from './boss';
import { ZONE1 } from './zone';

describe('Zone 1 boss', () => {
  const boss = bossIn(ZONE1, 'r1_boss_arena');
  const phases = boss?.phases ?? [];

  it('has two phases: an easier pool, then a harder one (DECISIONS #95)', () => {
    expect(phases.map((p) => p.id)).toEqual(['toll', 'knell']);
  });

  it('mixes every seal in each phase', () => {
    for (const p of phases) {
      const ids = new Set(p.templates.map((t) => t.id));
      for (const [seal, def] of Object.entries(ZONE1.seals)) {
        expect(def.templates.some((t) => ids.has(t)), `${p.id} has ${seal}`).toBe(true);
      }
    }
  });

  it('keeps the pools apart: no template is in both phases', () => {
    const [easy, hard] = phases;
    const shared = (easy?.templates ?? []).filter((t) => hard?.templates.some((u) => u.id === t.id));
    expect(shared).toEqual([]);
  });

  it('saves the two-blank combos and whole-sentence translations for phase 2', () => {
    const [easy, hard] = phases;
    expect(new Set(easy?.templates.map((t) => t.kind))).toEqual(new Set(['grammar', 'vocab']));
    expect(hard?.templates.map((t) => t.kind)).toEqual(expect.arrayContaining(['combo', 'translate']));
  });

  it('balances singular and plural articles inside each phase, so card length gives nothing away', () => {
    // A phase of only singular articles would make "pick the shortest card" beat chance (the
    // blind-bot test caught exactly that); split by article kind instead (DECISIONS #95).
    for (const p of phases) {
      const articles = p.templates.filter((t) => t.blanks.includes('art'));
      const plural = articles.filter((t) => t.tests.some((x) => x.endsWith(':pl')));
      expect(plural.length * 2, p.id).toBe(articles.length);
    }
  });

  it('grows harder in its numbers too: a longer chain and more HP in phase 2', () => {
    const [easy, hard] = phases;
    expect(easy!.chain).toBeGreaterThan(1);
    expect(hard!.chain).toBeGreaterThan(easy!.chain);
    expect(hard!.hp).toBeGreaterThan(easy!.hp);
  });

  it('shouts its battle cry on the card that opens phase 2, not phase 1', () => {
    expect(phases[0]?.cry).toBeNull();
    expect(phases[1]?.cry?.es).toMatch(/^¡.+!$/);
    expect(phases[1]?.cry?.en.length).toBeGreaterThan(0);
  });

  it('other rooms have no boss', () => {
    expect(bossIn(ZONE1, 'r1_bonfire')).toBeNull();
  });
});
