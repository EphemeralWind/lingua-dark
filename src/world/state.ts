// The player's run: where they are and what the world remembers. Knowledge lives in the
// Profile, which outlives runs (DECISIONS #75). Pure logic. Functions mutate the state they are given; the scenes own one GameState and
// save it through src/save/store.ts. Rules: SPEC 3.6, 6 and 7; readings in DECISIONS #62+.
import { createRng } from '../content/rng';
import type { Direction } from '../content/types';
import { recordInProfile, type Profile } from '../learning/profile';
import { AMBUSH_DAMAGE, BOSS_XP, ENEMY_XP, FLASKS_PER_REST, GHOST_XP, MAX_GHOSTS_PER_ROOM, PLAYER_VITALITY, WARDEN_XP } from '../tuning';
import { edgeKey, type Zone } from './zone';

/** Who a fight is against: the room's regular enemy, its boss, or a ghost of one component. */
export type FoeKey = 'enemy' | 'boss' | `ghost:${string}`;

export interface Echo {
  room: string;
  xp: number;
  killer: FoeKey;
  /** Component the killing strike tested; the killer asks it again (null: none fits a card). */
  target: string | null;
}

export interface GameState {
  version: 1;
  zone: number;
  /** Base seed of the run; each fight derives its own seed from it and `fights`. */
  seed: number;
  fights: number;
  bonfire: string;
  room: string;
  /** Where the current room's `$back` exit leads (its entry in `backOf`). */
  cameFrom: string | null;
  /**
   * Room -> the room it was last entered from going forward. `$back` follows this, so walking
   * back into a room does not turn its way back around (DECISIONS #28).
   */
  backOf: Record<string, string>;
  visited: string[];
  walked: string[];
  openDoors: string[];
  /** Rooms whose regular enemy is dead until the next rest or death. */
  defeated: string[];
  /** Rooms whose warden is beaten. Wardens never respawn (DECISIONS #73). */
  wardensBeaten: string[];
  /** Seals held this run; the boss gate needs all of the zone's. */
  seals: string[];
  /** Rooms whose boss is beaten. Bosses never respawn. */
  bossesBeaten: string[];
  /** Room -> components of the ghosts waiting there. */
  ghosts: Record<string, string[]>;
  echo: Echo | null;
  xp: number;
  flasks: number;
  vitality: number;
  /** Rooms whose reading choice has been made (each counts once, DECISIONS #62). */
  readingsDone: string[];
}

export function newGame(zone: Zone, seed: number): GameState {
  return {
    version: 1,
    zone: zone.number,
    seed: seed >>> 0,
    fights: 0,
    bonfire: zone.start,
    room: zone.start,
    cameFrom: null,
    backOf: {},
    visited: [zone.start],
    walked: [],
    openDoors: [],
    defeated: [],
    wardensBeaten: [],
    seals: [],
    bossesBeaten: [],
    ghosts: {},
    echo: null,
    xp: 0,
    flasks: FLASKS_PER_REST,
    vitality: PLAYER_VITALITY,
    readingsDone: [],
  };
}

/** Walks to `to`. `viaBack` is true when the player took a `$back` exit. */
export function walk(s: GameState, to: string, opens: string | null, viaBack = false): void {
  if (opens && !s.openDoors.includes(opens)) s.openDoors.push(opens);
  const key = edgeKey(s.room, to);
  if (!s.walked.includes(key)) s.walked.push(key);
  if (viaBack) {
    s.cameFrom = s.backOf[to] ?? null;
  } else {
    s.backOf = { ...s.backOf, [to]: s.room };
    s.cameFrom = s.room;
  }
  s.room = to;
  if (!s.visited.includes(to)) s.visited.push(to);
}

/** Bonfire rest: refill vitality and flasks, respawn regular enemies. Ghosts and wardens stay. */
export function rest(s: GameState, bonfire: string): void {
  s.bonfire = bonfire;
  s.vitality = PLAYER_VITALITY;
  s.flasks = FLASKS_PER_REST;
  s.defeated = [];
}

/** Back at the last bonfire without resting (after loading a save). */
export function returnToBonfire(s: GameState): void {
  s.room = s.bonfire;
  s.cameFrom = null;
}

/**
 * Death: unspent XP drops as an echo in the room, replacing any older echo. The player wakes
 * at the last bonfire, refilled, with regular enemies respawned (DECISIONS #64).
 */
export function die(s: GameState, killer: FoeKey, target: string | null): void {
  // Dying again before recovering loses the older echo.
  s.echo = s.xp > 0 ? { room: s.room, xp: s.xp, killer, target } : null;
  s.xp = 0;
  rest(s, s.bonfire);
  returnToBonfire(s);
}

/** The room's enemy (regular or warden), if it is alive. It blocks every exit but the way back. */
export function enemyAlive(s: GameState, zone: Zone, room: string): boolean {
  if (zone.room(room).contents.enemy === undefined) return false;
  return zone.wardenSeal(room) ? !s.wardensBeaten.includes(room) : !s.defeated.includes(room);
}

/** The room's boss, if it has one and it is not beaten. */
export function bossAlive(s: GameState, zone: Zone, room: string): boolean {
  return zone.room(room).contents.boss !== undefined && !s.bossesBeaten.includes(room);
}

/** Foes in a room: the boss, the regular enemy, then ghosts. Ghosts never block (DECISIONS #63). */
export function foesIn(s: GameState, zone: Zone, room: string): FoeKey[] {
  const out: FoeKey[] = bossAlive(s, zone, room) ? ['boss'] : enemyAlive(s, zone, room) ? ['enemy'] : [];
  for (const c of s.ghosts[room] ?? []) out.push(`ghost:${c}`);
  return out;
}

/** Missed components come back as ghosts in the room where they were missed, up to three. */
export function addGhosts(s: GameState, room: string, components: readonly string[]): void {
  const list = s.ghosts[room] ?? [];
  for (const c of components) if (list.length < MAX_GHOSTS_PER_ROOM && !list.includes(c)) list.push(c);
  if (list.length > 0) s.ghosts[room] = list;
}

export function ghostComponent(foe: FoeKey): string | null {
  return foe.startsWith('ghost:') ? foe.slice('ghost:'.length) : null;
}

/** The echo is fought for when the foe that dropped it is fought in its room. */
export function echoAt(s: GameState, room: string, foe: FoeKey): Echo | null {
  return s.echo && s.echo.room === room && s.echo.killer === foe ? s.echo : null;
}

/**
 * A won fight: XP, the foe stays dead (enemy), is banished (ghost), or yields its seal for good
 * (warden), and the echo comes back if this foe held it.
 */
export function winFight(s: GameState, zone: Zone, room: string, foe: FoeKey): { recovered: number; seal: string | null } {
  let seal: string | null = null;
  const ghost = ghostComponent(foe);
  if (foe === 'boss') {
    if (!s.bossesBeaten.includes(room)) s.bossesBeaten.push(room);
    s.xp += BOSS_XP;
  } else if (ghost) {
    const left = (s.ghosts[room] ?? []).filter((c) => c !== ghost);
    s.ghosts = Object.fromEntries(Object.entries({ ...s.ghosts, [room]: left }).filter(([, list]) => list.length > 0));
    s.xp += GHOST_XP;
  } else if (zone.wardenSeal(room)) {
    seal = zone.wardenSeal(room);
    if (!s.wardensBeaten.includes(room)) s.wardensBeaten.push(room);
    if (seal && !s.seals.includes(seal)) s.seals.push(seal);
    s.xp += WARDEN_XP;
  } else {
    if (!s.defeated.includes(room)) s.defeated.push(room);
    s.xp += ENEMY_XP;
  }
  const echo = echoAt(s, room, foe);
  if (!echo) return { recovered: 0, seal };
  s.xp += echo.xp;
  s.echo = null;
  return { recovered: echo.xp, seal };
}

/** Seed for the next fight, derived from the run seed. Advances the fight counter. */
export function nextFightSeed(s: GameState): number {
  const seed = createRng((s.seed ^ Math.imul(s.fights + 1, 0x9e3779b1)) >>> 0).nextSeed();
  s.fights += 1;
  return seed;
}

export interface ReadingOutcome {
  correct: boolean;
  components: string[];
  /** Vitality lost to an ambush. */
  damage: number;
}

/**
 * Leaving a room with an unanswered reading choice records it as an untelegraphed answer.
 * Each reading counts once per save. Returns null when the room has no pending reading.
 */
export function chooseReading(s: GameState, profile: Profile, zone: Zone, dir: Direction, day: number): ReadingOutcome | null {
  const reading = zone.room(s.room).contents.reading;
  if (!reading || s.readingsDone.includes(s.room)) return null;
  s.readingsDone.push(s.room);
  const correct = dir === reading.correct;
  recordInProfile(profile, reading.components, correct, 'reading', day);
  let damage = 0;
  if (!correct && reading.wrongCost === 'ambush') {
    damage = Math.min(AMBUSH_DAMAGE, s.vitality - 1);
    s.vitality -= damage;
  }
  return { correct, components: reading.components, damage };
}
