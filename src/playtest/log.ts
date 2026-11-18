// Local playtest log (Prompt 5). Every resolved strike, every fight's start and end, and every
// riposte, kept in the browser's own storage and exported as JSON by hand. Nothing is ever sent
// over the network. Pure: storage and the wall clock are injected.
import type { AttackType, ExchangeRecord, RiposteVerdict } from '../combat/types';
import type { Direction, QuestionKind } from '../content/types';
import type { KeyValueStore } from '../save/store';
import { PLAYTEST_MAX_EVENTS } from '../tuning';

export const PLAYTEST_KEY = 'lingua-dark/playtest';
export const PLAYTEST_FORMAT = 1;

interface EventBase {
  /** Page load the event belongs to: one sitting of one player, usually. */
  session: string;
  /** Wall-clock ms (Date.now) when it was logged. */
  atMs: number;
}

export interface FightInfo {
  /** Sprite character id: hollow_villager, crow, hollow_bell, … */
  foe: string;
  /** HUD name, e.g. "The Hollow Bell 2/2". */
  label: string;
  /** 1-based boss phase, absent outside boss fights. */
  bossPhase?: number;
  /** Phases the boss has; winning the last one clears it. */
  bossPhases?: number;
}

export interface FightStartEvent extends EventBase, FightInfo {
  type: 'fightStart';
  fight: string;
  hollow: boolean;
  vitality: number;
  enemyHp: number;
}

export interface ExchangeEvent extends EventBase {
  type: 'exchange';
  fight: string;
  foe: string;
  bossPhase?: number;
  questionId: string;
  seed: number;
  kind: QuestionKind;
  attack: AttackType;
  strike: number;
  chainIndex: number;
  /** The card picked, or null when the window closed. */
  chosen: Direction | null;
  /** Where the answer was. Written only after the strike resolved, like everything here. */
  answerDir: Direction;
  correct: boolean;
  timedOut: boolean;
  /** Ms from the start of the wind-up to the answer (or to the timeout). */
  answerMs: number;
  windowMs: number;
  quality: number;
  stanceBroken: boolean;
  /** Hollow mode (no timers) was on. */
  hollow: boolean;
  /** A flask greyed two cards. */
  assisted: boolean;
  components: string[];
}

export interface RiposteEvent extends EventBase {
  type: 'riposte';
  fight: string;
  foe: string;
  verdicts: RiposteVerdict[];
}

export interface FightEndEvent extends EventBase {
  type: 'fightEnd';
  fight: string;
  foe: string;
  bossPhase?: number;
  outcome: 'won' | 'lost';
  vitality: number;
  enemyHp: number;
}

export type PlaytestEvent = FightStartEvent | ExchangeEvent | RiposteEvent | FightEndEvent;

/** The exported file. */
export interface PlaytestFile {
  game: 'lingua-dark';
  format: number;
  exportedAt: string;
  events: PlaytestEvent[];
}

export class PlaytestLog {
  private events: PlaytestEvent[];
  private fights = 0;
  private exchangeCount = 0;
  readonly session: string;
  /** Last storage error, if a write failed (full storage, private window). */
  lastError: string | null = null;

  constructor(
    private readonly kv: KeyValueStore,
    private readonly wallMs: () => number,
    private readonly maxEvents = PLAYTEST_MAX_EVENTS,
  ) {
    this.events = parseEvents(kv.getItem(PLAYTEST_KEY));
    this.exchangeCount = this.events.filter((e) => e.type === 'exchange').length;
    this.session = `s${wallMs().toString(36)}`;
  }

  get size(): number {
    return this.events.length;
  }

  /** Resolved strikes in the log. Counted as they come; the menu reads it every frame. */
  get exchanges(): number {
    return this.exchangeCount;
  }

  all(): readonly PlaytestEvent[] {
    return this.events;
  }

  /** Logs a fight's start and returns its id for the events that follow. */
  beginFight(info: FightInfo, state: { hollow: boolean; vitality: number; enemyHp: number }): string {
    this.fights += 1;
    const fight = `${this.session}-f${this.fights}`;
    this.push({ type: 'fightStart', ...this.base(), fight, ...info, ...state });
    return fight;
  }

  exchange(fight: string, info: FightInfo, rec: ExchangeRecord): void {
    this.push({
      type: 'exchange',
      ...this.base(),
      fight,
      foe: info.foe,
      ...(info.bossPhase !== undefined ? { bossPhase: info.bossPhase } : {}),
      questionId: rec.questionId,
      seed: rec.seed,
      kind: rec.kind,
      attack: rec.attack,
      strike: rec.strike,
      chainIndex: rec.chainIndex,
      chosen: rec.chosen,
      answerDir: rec.correct,
      correct: rec.result === 'parry',
      timedOut: rec.timedOut,
      answerMs: Math.round(rec.answerMs),
      windowMs: Math.round(rec.windowMs),
      quality: Math.round(rec.quality * 1000) / 1000,
      stanceBroken: rec.stanceBroken,
      hollow: rec.untimed,
      assisted: rec.assisted,
      components: rec.components,
    });
  }

  riposte(fight: string, info: FightInfo, verdicts: readonly RiposteVerdict[]): void {
    this.push({ type: 'riposte', ...this.base(), fight, foe: info.foe, verdicts: [...verdicts] });
  }

  endFight(fight: string, info: FightInfo, end: { outcome: 'won' | 'lost'; vitality: number; enemyHp: number }): void {
    this.push({
      type: 'fightEnd',
      ...this.base(),
      fight,
      foe: info.foe,
      ...(info.bossPhase !== undefined ? { bossPhase: info.bossPhase } : {}),
      ...end,
    });
  }

  exportText(): string {
    const file: PlaytestFile = {
      game: 'lingua-dark',
      format: PLAYTEST_FORMAT,
      exportedAt: new Date(this.wallMs()).toISOString(),
      events: this.events,
    };
    return JSON.stringify(file, null, 1);
  }

  /** Empties the log (between participants). */
  clear(): void {
    this.events = [];
    this.exchangeCount = 0;
    try {
      this.kv.removeItem(PLAYTEST_KEY);
    } catch (e) {
      this.lastError = String(e);
    }
  }

  private base(): EventBase {
    return { session: this.session, atMs: this.wallMs() };
  }

  private push(ev: PlaytestEvent): void {
    this.events.push(ev);
    if (ev.type === 'exchange') this.exchangeCount += 1;
    // Oldest first out, so a forgotten log cannot fill the browser's storage.
    if (this.events.length > this.maxEvents) {
      const dropped = this.events.splice(0, this.events.length - this.maxEvents);
      this.exchangeCount -= dropped.filter((e) => e.type === 'exchange').length;
    }
    try {
      this.kv.setItem(PLAYTEST_KEY, JSON.stringify(this.events));
      this.lastError = null;
    } catch (e) {
      this.lastError = String(e);
    }
  }
}

function parseEvents(text: string | null): PlaytestEvent[] {
  if (text === null) return [];
  try {
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data.filter(isEvent) : [];
  } catch {
    return [];
  }
}

function isEvent(x: unknown): x is PlaytestEvent {
  if (typeof x !== 'object' || x === null) return false;
  const t = (x as { type?: unknown }).type;
  return t === 'fightStart' || t === 'exchange' || t === 'riposte' || t === 'fightEnd';
}

/**
 * Reads an exported file, or a bare event array. Throws with a readable message if it is not a
 * playtest log.
 */
export function parsePlaytestFile(text: string): PlaytestEvent[] {
  const data: unknown = JSON.parse(text);
  if (Array.isArray(data)) return data.filter(isEvent);
  if (typeof data === 'object' && data !== null) {
    const f = data as Partial<PlaytestFile>;
    if (f.game === 'lingua-dark' && Array.isArray(f.events)) {
      if (f.format !== PLAYTEST_FORMAT) throw new Error(`unknown playtest log format ${String(f.format)}`);
      return f.events.filter(isEvent);
    }
  }
  throw new Error('not a Lingua Dark playtest log');
}
