// Save store (SPEC 6): the run and the profile as JSON in a key-value store (localStorage in the
// browser), with JSON export and import. Local only. Pure: the store and the time are injected.
//
// Two keys (DECISIONS #75): the run (`lingua-dark/save`), which New Game replaces, and the
// profile (`lingua-dark/profile`: knowledge and Learned perks), which outlives runs. An export
// file bundles both. Version 1 saves kept the learner inside the game; they migrate on load.
import { newProfile, type Profile } from '../learning/profile';
import type { LearnerState } from '../learning/learner';
import type { GameState } from '../world/state';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'lingua-dark/save';
export const PROFILE_KEY = 'lingua-dark/profile';
const FORMAT = 'lingua-dark-save';
const PROFILE_FORMAT = 'lingua-dark-profile';
const VERSION = 2;

export interface SaveFile {
  format: typeof FORMAT;
  version: typeof VERSION;
  /** Wall-clock time of the save, epoch ms (from platform). */
  savedAtMs: number;
  game: GameState;
  /** Present in export files only. */
  profile?: Profile;
}

export type ParseResult =
  | { ok: true; game: GameState; savedAtMs: number; /** From an export file or a v1 migration. */ profile: Profile | null }
  | { ok: false; error: string };

export function serialize(game: GameState, savedAtMs: number, profile?: Profile): string {
  const file: SaveFile = { format: FORMAT, version: VERSION, savedAtMs, game, ...(profile ? { profile } : {}) };
  return JSON.stringify(file, null, 2);
}

export function serializeProfile(profile: Profile): string {
  return JSON.stringify({ format: PROFILE_FORMAT, profile });
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string');
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isDayOrNull = (x: unknown): boolean => x === null || isNum(x);

/** Field-by-field shape checks. The game bundle does not ship zod (DECISIONS #45). */
export function learnerProblems(learner: unknown, where: string): string[] {
  const errs: string[] = [];
  if (!isObj(learner) || !isObj(learner['components'])) return [`${where}.components must be an object`];
  for (const [id, r] of Object.entries(learner['components'])) {
    const ok =
      isObj(r) &&
      isNum(r['box']) &&
      r['box'] >= 1 &&
      r['box'] <= 5 &&
      isNum(r['dueDay']) &&
      isDayOrNull(r['promotedDay']) &&
      Array.isArray(r['days']) &&
      r['days'].every(isNum) &&
      typeof r['learned'] === 'boolean' &&
      isNum(r['seen']) &&
      isNum(r['misses']) &&
      isDayOrNull(r['reviewedDay']);
    if (!ok) {
      errs.push(`${where}.components["${id}"] is malformed`);
      if (errs.length > 10) break;
    }
  }
  return errs;
}

export function profileProblems(p: unknown): string[] {
  if (!isObj(p)) return ['profile is not an object'];
  const errs: string[] = [];
  if (p['version'] !== 1) errs.push('profile.version must be 1');
  if (!isNum(p['bestLearned'])) errs.push('profile.bestLearned must be a number');
  return [...errs, ...learnerProblems(p['learner'], 'profile.learner')];
}

/** `fileVersion` 1 games carry a learner and no seals; 2 games carry seals and no learner. */
export function gameStateProblems(g: unknown, fileVersion = VERSION): string[] {
  const errs: string[] = [];
  if (!isObj(g)) return ['game is not an object'];
  if (g['version'] !== 1) errs.push('game.version must be 1');
  for (const k of ['zone', 'seed', 'fights', 'xp', 'flasks', 'vitality']) if (!isNum(g[k])) errs.push(`game.${k} must be a number`);
  for (const k of ['bonfire', 'room']) if (typeof g[k] !== 'string') errs.push(`game.${k} must be a string`);
  if (g['cameFrom'] !== null && typeof g['cameFrom'] !== 'string') errs.push('game.cameFrom must be a string or null');
  const lists = ['visited', 'walked', 'openDoors', 'defeated', 'readingsDone', ...(fileVersion >= 2 ? ['seals', 'wardensBeaten'] : [])];
  for (const k of lists) if (!isStrArr(g[k])) errs.push(`game.${k} must be a list of strings`);
  const backOf = g['backOf'];
  if (backOf !== undefined && (!isObj(backOf) || !Object.values(backOf).every((v) => typeof v === 'string'))) {
    errs.push('game.backOf must map rooms to rooms');
  }
  const ghosts = g['ghosts'];
  if (!isObj(ghosts) || !Object.values(ghosts).every(isStrArr)) errs.push('game.ghosts must map rooms to lists of strings');
  const echo = g['echo'];
  if (echo !== null) {
    const ok =
      isObj(echo) &&
      typeof echo['room'] === 'string' &&
      isNum(echo['xp']) &&
      typeof echo['killer'] === 'string' &&
      (echo['killer'] === 'enemy' || echo['killer'].startsWith('ghost:')) &&
      (echo['target'] === null || typeof echo['target'] === 'string');
    if (!ok) errs.push('game.echo is malformed');
  }
  if (fileVersion === 1) errs.push(...learnerProblems(g['learner'], 'game.learner'));
  return errs;
}

export function parseSave(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }
  if (!isObj(data) || data['format'] !== FORMAT) return { ok: false, error: 'not a Lingua Dark save file' };
  const version = data['version'];
  if (version !== 1 && version !== VERSION) return { ok: false, error: `unsupported save version ${String(version)}` };
  const problems = gameStateProblems(data['game'], version);
  if (data['profile'] !== undefined) problems.push(...profileProblems(data['profile']));
  if (problems.length > 0) return { ok: false, error: problems.join('; ') };

  const raw = data['game'] as Record<string, unknown>;
  let profile = (data['profile'] as Profile | undefined) ?? null;
  if (version === 1) {
    // v1 kept knowledge in the run; it moves to the profile (DECISIONS #75).
    profile ??= newProfile(raw['learner'] as LearnerState);
    delete raw['learner'];
    raw['seals'] = [];
    raw['wardensBeaten'] = [];
  }
  // Saves from before `backOf` existed get an empty one.
  raw['backOf'] ??= {};
  return { ok: true, game: raw as unknown as GameState, savedAtMs: isNum(data['savedAtMs']) ? data['savedAtMs'] : 0, profile };
}

export function parseProfile(text: string): { ok: true; profile: Profile } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'profile is not valid JSON' };
  }
  if (!isObj(data) || data['format'] !== PROFILE_FORMAT) return { ok: false, error: 'not a Lingua Dark profile' };
  const problems = profileProblems(data['profile']);
  return problems.length > 0 ? { ok: false, error: problems.join('; ') } : { ok: true, profile: data['profile'] as Profile };
}

export interface Loaded {
  game: GameState | null;
  profile: Profile;
  /** Problems reading either key; an unreadable key is left untouched. */
  error: string | null;
}

export class SaveStore {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly key = SAVE_KEY,
    private readonly profileKey = PROFILE_KEY,
  ) {}

  /**
   * The stored run and profile. A missing profile is created, from a v1 save's learner if there
   * is one (and written back, so the migration happens once).
   */
  load(): Loaded {
    const errors: string[] = [];
    let game: GameState | null = null;
    let migrated: Profile | null = null;
    const text = this.kv.getItem(this.key);
    if (text !== null) {
      const r = parseSave(text);
      if (r.ok) {
        game = r.game;
        migrated = r.profile;
      } else {
        errors.push(`saved game: ${r.error}`);
      }
    }
    let profile: Profile | null = null;
    const ptext = this.kv.getItem(this.profileKey);
    if (ptext !== null) {
      const r = parseProfile(ptext);
      if (r.ok) profile = r.profile;
      else errors.push(`profile: ${r.error}`);
    }
    if (!profile && ptext === null) {
      profile = migrated ?? newProfile();
      if (migrated) {
        this.saveProfile(profile);
        if (game) this.kv.setItem(this.key, serialize(game, 0));
      }
    }
    return { game, profile: profile ?? newProfile(), error: errors.length > 0 ? errors.join('; ') : null };
  }

  save(game: GameState, nowMs: number): void {
    this.kv.setItem(this.key, serialize(game, nowMs));
  }

  saveProfile(profile: Profile): void {
    this.kv.setItem(this.profileKey, serializeProfile(profile));
  }

  clear(): void {
    this.kv.removeItem(this.key);
  }

  /** One file with the run and the profile. */
  exportText(game: GameState, profile: Profile, nowMs: number): string {
    return serialize(game, nowMs, profile);
  }

  /**
   * Validates and stores an exported save (or an old v1 save). Nothing is written if it is
   * invalid. A file without a profile leaves the current profile alone.
   */
  importText(text: string): ParseResult {
    const r = parseSave(text);
    if (!r.ok) return r;
    this.kv.setItem(this.key, serialize(r.game, r.savedAtMs));
    if (r.profile) this.saveProfile(r.profile);
    return r;
  }
}
