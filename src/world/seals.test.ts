import { describe, expect, it } from 'vitest';
import { perksFor } from '../learning/perks';
import { WARDEN_XP } from '../tuning';
import { sealProgress, sealTemplates, socketLine } from './seals';
import { die, enemyAlive, newGame, rest, walk, winFight } from './state';
import { ZONE1 } from './zone';

const WARDENS = { articles: 'r1_cellar', present: 'r1_chapel', words: 'r1_orchard' } as const;

describe('seals', () => {
  it('Zone 1 has three seals, each guarded by one warden', () => {
    expect(Object.keys(ZONE1.seals)).toEqual(['articles', 'present', 'words']);
    for (const [seal, room] of Object.entries(WARDENS)) expect(ZONE1.wardenSeal(room)).toBe(seal);
    expect(ZONE1.wardenSeal('r1_lane')).toBeNull();
    expect(ZONE1.wardenSeal('r1_bonfire')).toBeNull();
  });

  it('each seal deck is one grammar aspect', () => {
    const ids = (seal: string) => sealTemplates(ZONE1, seal).map((t) => t.id);
    expect(ids('articles')).toEqual(['t_definite_article', 't_indefinite_article', 't_plural_object', 't_indefinite_plural']);
    expect(ids('present')).toEqual(['t_present_object', 't_combo_two']);
    expect(ids('words')).toEqual(['t_vocab_noun', 't_translate_object']);
    expect(() => sealTemplates(ZONE1, 'nope')).toThrow();
  });

  it('every Zone 1 template belongs to exactly one seal', () => {
    const all = Object.keys(ZONE1.seals).flatMap((id) => sealTemplates(ZONE1, id).map((t) => t.id));
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(8);
  });

  it('the gate is closed at 0/3 and 2/3 and open at 3/3', () => {
    expect(sealProgress([], ZONE1)).toMatchObject({ held: 0, total: 3, open: false });
    expect(sealProgress(['articles', 'words'], ZONE1)).toMatchObject({ held: 2, open: false });
    expect(sealProgress(['words', 'present', 'articles'], ZONE1)).toMatchObject({ held: 3, open: true });
  });

  it('describes the sockets by shape', () => {
    expect(socketLine(sealProgress(['articles'], ZONE1))).toBe('Articles ◆   Verbs ◇   Words ◇');
  });

  it('beating a warden grants its seal, once', () => {
    const s = newGame(ZONE1, 1);
    expect(enemyAlive(s, ZONE1, 'r1_chapel')).toBe(true);
    expect(winFight(s, ZONE1, 'r1_chapel', 'enemy')).toEqual({ recovered: 0, seal: 'present' });
    expect(s.seals).toEqual(['present']);
    expect(s.xp).toBe(WARDEN_XP);
    expect(enemyAlive(s, ZONE1, 'r1_chapel')).toBe(false);
  });

  it('a regular enemy grants no seal', () => {
    const s = newGame(ZONE1, 1);
    expect(winFight(s, ZONE1, 'r1_lane', 'enemy').seal).toBeNull();
    expect(s.seals).toEqual([]);
  });

  it('seals and beaten wardens survive rest and death; regular enemies respawn', () => {
    const s = newGame(ZONE1, 1);
    winFight(s, ZONE1, 'r1_cellar', 'enemy');
    winFight(s, ZONE1, 'r1_lane', 'enemy');
    rest(s, 'r1_bonfire');
    walk(s, 'r1_well', null);
    die(s, 'enemy', null);
    expect(s.seals).toEqual(['articles']);
    expect(enemyAlive(s, ZONE1, 'r1_cellar')).toBe(false);
    expect(enemyAlive(s, ZONE1, 'r1_lane')).toBe(true);
  });

  it('a new run starts with no seals', () => {
    expect(newGame(ZONE1, 2).seals).toEqual([]);
  });

  it('rest and new runs use the perk stats', () => {
    const perks = perksFor(120);
    const s = newGame(ZONE1, 1, perks);
    expect([s.vitality, s.flasks]).toEqual([130, 4]);
    s.vitality = 5;
    s.flasks = 0;
    rest(s, 'r1_bonfire', perks);
    expect([s.vitality, s.flasks]).toEqual([130, 4]);
  });
});
