import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSave } from '../save/store';
import { sealProgress } from '../world/seals';
import { bossAlive, enemyAlive } from '../world/state';
import { ZONE1 } from '../world/zone';
import { litmusGame, litmusSaveText } from './litmusSave';

describe('litmus save', () => {
  it('wakes at the bonfire with every seal, every warden beaten, and the boss alive', () => {
    const g = litmusGame();
    expect(g.room).toBe(ZONE1.start);
    const seals = sealProgress(g.seals, ZONE1);
    expect(seals.held).toBe(seals.total);
    for (const room of ['r1_chapel', 'r1_cellar', 'r1_orchard', 'r1_lane']) expect(enemyAlive(g, ZONE1, room)).toBe(false);
    expect(bossAlive(g, ZONE1, 'r1_boss_arena')).toBe(true);
    expect(g.xp).toBe(0);
  });

  it('the committed file is current and imports cleanly', () => {
    const text = readFileSync(new URL('../../public/playtest/litmus-save.json', import.meta.url), 'utf8');
    expect(text).toBe(litmusSaveText()); // if this fails: npm run litmus-save
    const r = parseSave(text);
    expect(r.ok).toBe(true);
  });
});
