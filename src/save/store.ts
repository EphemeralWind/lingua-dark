// Save store (SPEC 6): one JSON save in a key-value store (localStorage in the browser), with
// JSON export and import. Local only. Pure: the store and the time are injected.
import type { GameState } from '../world/state';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'lingua-dark/save';
const FORMAT = 'lingua-dark-save';

export interface SaveFile {
  format: typeof FORMAT;
  version: 1;
  /** Wall-clock time of the save, epoch ms (from platform). */
  savedAtMs: number;
  game: GameState;
}

export type ParseResult = { ok: true; game: GameState; savedAtMs: number } | { ok: false; error: string };

export function serialize(game: GameState, savedAtMs: number): string {
  const file: SaveFile = { format: FORMAT, version: 1, savedAtMs, game };
  return JSON.stringify(file, null, 2);
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string');
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isDayOrNull = (x: unknown): boolean => x === null || isNum(x);

/** Field-by-field shape check. The game bundle does not ship zod (DECISIONS #45). */
export function gameStateProblems(g: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(g)) return ['game is not an object'];
  if (g['version'] !== 1) errs.push('game.version must be 1');
  for (const k of ['zone', 'seed', 'fights', 'xp', 'flasks', 'vitality']) if (!isNum(g[k])) errs.push(`game.${k} must be a number`);
  for (const k of ['bonfire', 'room']) if (typeof g[k] !== 'string') errs.push(`game.${k} must be a string`);
  if (g['cameFrom'] !== null && typeof g['cameFrom'] !== 'string') errs.push('game.cameFrom must be a string or null');
  for (const k of ['visited', 'walked', 'openDoors', 'defeated', 'readingsDone']) if (!isStrArr(g[k])) errs.push(`game.${k} must be a list of strings`);
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
  const learner = g['learner'];
  if (!isObj(learner) || !isObj(learner['components'])) {
    errs.push('game.learner.components must be an object');
  } else {
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
        errs.push(`game.learner.components["${id}"] is malformed`);
        if (errs.length > 10) break;
      }
    }
  }
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
  if (data['version'] !== 1) return { ok: false, error: `unsupported save version ${String(data['version'])}` };
  const problems = gameStateProblems(data['game']);
  if (problems.length > 0) return { ok: false, error: problems.join('; ') };
  return { ok: true, game: data['game'] as GameState, savedAtMs: isNum(data['savedAtMs']) ? data['savedAtMs'] : 0 };
}

export class SaveStore {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly key = SAVE_KEY,
  ) {}

  /** The stored game, or null if there is none or it is unreadable (the error is returned too). */
  load(): { game: GameState | null; error: string | null } {
    const text = this.kv.getItem(this.key);
    if (text === null) return { game: null, error: null };
    const r = parseSave(text);
    return r.ok ? { game: r.game, error: null } : { game: null, error: r.error };
  }

  save(game: GameState, nowMs: number): void {
    this.kv.setItem(this.key, serialize(game, nowMs));
  }

  clear(): void {
    this.kv.removeItem(this.key);
  }

  exportText(game: GameState, nowMs: number): string {
    return serialize(game, nowMs);
  }

  /** Validates and stores an exported save. Nothing is written if it is invalid. */
  importText(text: string): ParseResult {
    const r = parseSave(text);
    if (r.ok) this.kv.setItem(this.key, text);
    return r;
  }
}
