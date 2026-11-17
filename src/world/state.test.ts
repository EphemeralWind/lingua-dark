import { describe, expect, it } from 'vitest';
import { ENEMY_XP, FLASKS_PER_REST, GHOST_XP, MAX_GHOSTS_PER_ROOM, PLAYER_VITALITY } from '../tuning';
import { resolveExit } from './zone';
import { newProfile } from '../learning/profile';
import { addGhosts, chooseReading, die, echoAt, foesIn, newGame, nextFightSeed, rest, walk, winFight } from './state';
import { ZONE1 } from './zone';

describe('game state', () => {
  it('walking records the visit, the connection and where the player came from', () => {
    const s = newGame(ZONE1, 1);
    walk(s, 'r1_lane', null);
    expect(s).toMatchObject({ room: 'r1_lane', cameFrom: 'r1_bonfire', visited: ['r1_bonfire', 'r1_lane'], walked: ['r1_bonfire|r1_lane'] });
  });

  /** Presses a direction the way the world scene does. */
  const press = (s: ReturnType<typeof newGame>, dir: 'north' | 'east' | 'south' | 'west'): void => {
    const r = resolveExit(ZONE1, s.room, dir, { cameFrom: s.cameFrom, openDoors: s.openDoors, gateOpen: false });
    if (r.kind !== 'move') throw new Error(`${s.room} ${dir}: ${r.kind}`);
    walk(s, r.to, r.opens, r.back);
  };

  it('walking back into a room keeps its own way back (chapel bug)', () => {
    const s = newGame(ZONE1, 1);
    press(s, 'north'); // lane
    press(s, 'north'); // chapel
    press(s, 'north'); // gate
    press(s, 'south'); // back to the chapel
    expect(s.room).toBe('r1_chapel');
    press(s, 'south'); // must go on toward the bonfire, not back up to the gate
    expect(s.room).toBe('r1_lane');
    press(s, 'south');
    expect(s.room).toBe('r1_bonfire');
  });

  it('going back and forth repeatedly never reverses a way back', () => {
    const s = newGame(ZONE1, 1);
    press(s, 'north');
    press(s, 'north');
    for (let i = 0; i < 3; i++) {
      press(s, 'north');
      press(s, 'south');
    }
    press(s, 'south');
    press(s, 'south');
    expect(s.room).toBe('r1_bonfire');
  });

  it("the cellar's way back is whichever side it was entered from", () => {
    const s = newGame(ZONE1, 1);
    press(s, 'west');
    press(s, 'north'); // cellar, from the well
    press(s, 'south');
    expect(s.room).toBe('r1_well');
    s.openDoors.push('shortcut_cellar');
    walk(s, 'r1_bonfire', null, true);
    s.cameFrom = null;
    press(s, 'south'); // cellar, through the open shortcut
    press(s, 'south');
    expect(s.room).toBe('r1_bonfire');
  });

  it('walking through a shortcut from its far side opens the door for good', () => {
    const s = newGame(ZONE1, 1);
    walk(s, 'r1_well', null);
    walk(s, 'r1_cellar', null);
    walk(s, 'r1_bonfire', 'shortcut_cellar');
    expect(s.openDoors).toEqual(['shortcut_cellar']);
  });

  it('resting refills vitality and flasks and respawns regular enemies, not ghosts', () => {
    const s = newGame(ZONE1, 1);
    s.vitality = 10;
    s.flasks = 0;
    s.defeated = ['r1_lane'];
    addGhosts(s, 'r1_lane', ['v_comer:present:1sg']);
    rest(s, 'r1_bonfire');
    expect(s).toMatchObject({ vitality: PLAYER_VITALITY, flasks: FLASKS_PER_REST, defeated: [] });
    expect(foesIn(s, ZONE1, 'r1_lane')).toEqual(['enemy', 'ghost:v_comer:present:1sg']);
  });

  it('ghosts: at most three per room, no duplicates', () => {
    const s = newGame(ZONE1, 1);
    addGhosts(s, 'r1_lane', ['a', 'a', 'b']);
    addGhosts(s, 'r1_lane', ['c', 'd', 'e']);
    expect(s.ghosts['r1_lane']).toHaveLength(MAX_GHOSTS_PER_ROOM);
    expect(s.ghosts['r1_lane']).toEqual(['a', 'b', 'c']);
  });

  it('a won ghost fight banishes that ghost and gives ghost XP', () => {
    const s = newGame(ZONE1, 1);
    addGhosts(s, 'r1_lane', ['a', 'b']);
    winFight(s, ZONE1, 'r1_lane', 'ghost:a');
    expect(s.ghosts['r1_lane']).toEqual(['b']);
    winFight(s, ZONE1, 'r1_lane', 'ghost:b');
    expect(s.ghosts['r1_lane']).toBeUndefined();
    expect(s.xp).toBe(2 * GHOST_XP);
  });

  it('death drops XP as an echo where the player fell and wakes them at the bonfire', () => {
    const s = newGame(ZONE1, 1);
    s.xp = 120;
    walk(s, 'r1_lane', null);
    s.defeated = ['r1_forge'];
    die(s, 'enemy', 'v_levantar:present:3sg');
    expect(s.echo).toEqual({ room: 'r1_lane', xp: 120, killer: 'enemy', target: 'v_levantar:present:3sg' });
    expect(s).toMatchObject({ xp: 0, room: 'r1_bonfire', cameFrom: null, vitality: PLAYER_VITALITY, defeated: [] });
  });

  it('beating the killer in that room recovers the echo', () => {
    const s = newGame(ZONE1, 1);
    s.xp = 120;
    walk(s, 'r1_lane', null);
    die(s, 'enemy', null);
    expect(echoAt(s, 'r1_lane', 'enemy')).not.toBeNull();
    expect(echoAt(s, 'r1_chapel', 'enemy')).toBeNull();
    expect(winFight(s, ZONE1, 'r1_lane', 'enemy')).toEqual({ recovered: 120, seal: null });
    expect(s.xp).toBe(ENEMY_XP + 120);
    expect(s.echo).toBeNull();
  });

  it('a ghost that kills the player holds the echo; the room enemy does not', () => {
    const s = newGame(ZONE1, 1);
    s.xp = 30;
    addGhosts(s, 'r1_lane', ['a']);
    walk(s, 'r1_lane', null);
    die(s, 'ghost:a', 'a');
    expect(winFight(s, ZONE1, 'r1_lane', 'enemy').recovered).toBe(0);
    expect(winFight(s, ZONE1, 'r1_lane', 'ghost:a').recovered).toBe(30);
  });

  it('dying again before recovering loses the older echo', () => {
    const s = newGame(ZONE1, 1);
    s.xp = 100;
    walk(s, 'r1_lane', null);
    die(s, 'enemy', null);
    walk(s, 'r1_well', null);
    die(s, 'enemy', null);
    expect(s.echo).toBeNull();
  });

  it('fight seeds are reproducible and differ from fight to fight', () => {
    const a = newGame(ZONE1, 5);
    const b = newGame(ZONE1, 5);
    const sa = [nextFightSeed(a), nextFightSeed(a)];
    expect([nextFightSeed(b), nextFightSeed(b)]).toEqual(sa);
    expect(sa[0]).not.toBe(sa[1]);
  });

  it('a reading choice records an untelegraphed answer once per save', () => {
    const s = newGame(ZONE1, 1);
    const p = newProfile();
    const first = chooseReading(s, p, ZONE1, 'west', 0);
    expect(first).toEqual({ correct: true, components: ['w_izquierda', 'w_pozo'], damage: 0 });
    expect(p.learner.components['w_pozo']?.days).toEqual([0]);
    expect(chooseReading(s, p, ZONE1, 'west', 1)).toBeNull();
  });

  it('a wrong reading choice records a miss', () => {
    const s = newGame(ZONE1, 1);
    const p = newProfile();
    expect(chooseReading(s, p, ZONE1, 'east', 0)?.correct).toBe(false);
    expect(p.learner.components['w_izquierda']).toMatchObject({ box: 1, misses: 1 });
  });

  it('rooms without a reading record nothing', () => {
    const s = newGame(ZONE1, 1);
    walk(s, 'r1_lane', null);
    const p = newProfile();
    expect(chooseReading(s, p, ZONE1, 'north', 0)).toBeNull();
    expect(p.learner.components).toEqual({});
  });
});
