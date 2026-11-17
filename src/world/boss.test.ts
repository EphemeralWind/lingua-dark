import { describe, expect, it } from 'vitest';
import { zoneTemplates } from '../content/deck';
import { bossIn } from './boss';
import { sealTemplates } from './seals';
import { ZONE1 } from './zone';

describe('Zone 1 boss', () => {
  const boss = bossIn(ZONE1, 'r1_boss_arena');

  it('has the three SPEC phases: articles, present tense, blind', () => {
    expect(boss?.phases.map((p) => [p.id, p.blind])).toEqual([
      ['articles_gender', false],
      ['present_regular', false],
      ['blind', true],
    ]);
  });

  it('takes each phase deck from the seals (DECISIONS #73)', () => {
    const [articles, present, blind] = boss!.phases;
    expect(articles!.templates).toEqual(sealTemplates(ZONE1, 'articles'));
    expect(present!.templates).toEqual(sealTemplates(ZONE1, 'present'));
    expect(new Set(blind!.templates.map((t) => t.id))).toEqual(new Set(zoneTemplates(1).map((t) => t.id)));
  });

  it('chains questions: every phase has longer combos than a regular fight', () => {
    for (const p of boss!.phases) expect(p.chain).toBeGreaterThan(1);
  });

  it('other rooms have no boss', () => {
    expect(bossIn(ZONE1, 'r1_bonfire')).toBeNull();
  });
});
