// Encounter state machine (SPEC 3.1, 3.2, 3.4, 9). Pure logic: time comes in as arguments,
// questions come from an injected source. No DOM, no clock reads, no Math.random.
import { strikeComponents } from '../content/components';
import type { Rng } from '../content/rng';
import { DIRECTIONS, type Direction, type Question } from '../content/types';
import {
  COMBO_CLEAR_BONUS,
  ENEMY_HP,
  FLASK_POWER_BASE,
  FLASK_POWER_MAX,
  HIT_STANCE_REFILL,
  PLAYER_VITALITY,
  RESOLVE_MS,
  RIPOSTE_DAMAGE_PER_WORD,
  RIPOSTE_RESULT_MS,
  STANCE_MAX,
} from '../tuning';
import { judgeWord } from './riposte';
import { attackFor, damageFor, parryQuality, stanceDrain, windowMs } from './timing';
import type { AttackType, EncounterState, Enemy, ExchangeRecord } from './types';

export interface EncounterConfig {
  /** 1-based zone, picks the window multiplier. */
  zone: number;
  enemyHp?: number;
  stanceMax?: number;
  /** Starting vitality, if the player enters hurt. Defaults to vitalityMax. */
  vitality?: number;
  vitalityMax?: number;
  /** Picks which wrong cards a flask greys out. Needed only if flasks are used. */
  flaskRng?: Rng;
  /** Wrong cards one flask greys out, capped at FLASK_POWER_MAX (perks raise it). */
  flaskPower?: number;
  /** Damage per correct riposte word (perks raise it). */
  riposteDamage?: number;
  /**
   * Questions per exchange (default 1). A boss chains several questions into one flurry: the
   * combo-clear bonus needs every strike of the whole chain parried (DECISIONS #77).
   */
  chain?: number;
  /** Hollow mode: no timers. A wind-up never times out; a late answer parries at the floor. */
  untimed?: boolean;
}

export class Encounter {
  readonly enemy: Enemy;
  readonly vitalityMax: number;
  vitality: number;
  readonly log: ExchangeRecord[] = [];
  private current: EncounterState = { kind: 'idle' };
  /** True while every strike of the current exchange (question or chain) has been parried. */
  private cleanSoFar = true;
  /** Questions answered so far in the current chain, and strikes across them. */
  private chainIndex = 0;
  private chainStrikes = 0;
  readonly chainLength: number;
  /** Hollow mode (no timers). Can change mid-fight from the settings menu. */
  untimed: boolean;
  private readonly zone: number;
  private readonly nextQuestion: () => Question;
  private readonly flaskRng: Rng | null;
  private readonly flaskPower: number;
  private readonly riposteDamage: number;

  constructor(nextQuestion: () => Question, config: EncounterConfig) {
    this.nextQuestion = nextQuestion;
    this.zone = config.zone;
    const hp = config.enemyHp ?? ENEMY_HP;
    const stanceMax = config.stanceMax ?? STANCE_MAX;
    this.enemy = { hp, hpMax: hp, stance: stanceMax, stanceMax };
    this.vitalityMax = config.vitalityMax ?? PLAYER_VITALITY;
    this.vitality = config.vitality ?? this.vitalityMax;
    this.flaskRng = config.flaskRng ?? null;
    this.flaskPower = Math.max(1, Math.min(FLASK_POWER_MAX, config.flaskPower ?? FLASK_POWER_BASE));
    this.riposteDamage = config.riposteDamage ?? RIPOSTE_DAMAGE_PER_WORD;
    this.chainLength = Math.max(1, Math.floor(config.chain ?? 1));
    this.untimed = config.untimed ?? false;
  }

  /** Position in the current chain: 0-based question index and the chain length. */
  get chainPosition(): { index: number; length: number } {
    return { index: this.chainIndex, length: this.chainLength };
  }

  get state(): EncounterState {
    return this.current;
  }

  get finished(): boolean {
    return this.current.kind === 'won' || this.current.kind === 'lost';
  }

  /** Attack type of the question in play, or null between questions. */
  get attack(): AttackType | null {
    const s = this.current;
    if (s.kind === 'windup' || s.kind === 'resolving' || s.kind === 'riposte' || s.kind === 'riposteResult') {
      return attackFor(s.question.kind);
    }
    return null;
  }

  start(nowMs: number): void {
    if (this.current.kind !== 'idle') throw new Error('encounter already started');
    this.beginQuestion(nowMs);
  }

  /** Advance time. Call every update step. */
  tick(nowMs: number): void {
    const s = this.current;
    switch (s.kind) {
      case 'windup':
        if (!this.untimed && nowMs >= s.deadlineMs) this.resolve(null, s.deadlineMs);
        return;
      case 'resolving':
        if (nowMs < s.untilMs) return;
        if (this.vitality <= 0) {
          this.current = { kind: 'lost' };
        } else if (s.stanceBroken) {
          this.current = { kind: 'riposte', question: s.question, typed: [] };
        } else if (s.strike + 1 < s.question.strikes.length) {
          this.beginStrike(s.question, s.strike + 1, nowMs);
        } else if (this.chainIndex + 1 < this.chainLength) {
          this.chainIndex += 1;
          this.beginStrike(this.nextQuestion(), 0, nowMs);
        } else {
          this.beginQuestion(nowMs);
        }
        return;
      case 'riposteResult':
        if (nowMs < s.untilMs) return;
        if (this.enemy.hp <= 0) {
          this.current = { kind: 'won' };
        } else {
          this.enemy.stance = this.enemy.stanceMax;
          this.beginQuestion(nowMs);
        }
        return;
      default:
        return;
    }
  }

  /**
   * The player presses a direction. Ignored outside a wind-up (DECISIONS #15).
   * Returns true if the press locked in an answer.
   */
  lockIn(dir: Direction, atMs: number): boolean {
    const s = this.current;
    if (s.kind !== 'windup') return false;
    if (this.untimed) {
      if (s.greyed.includes(dir)) return false;
      // No deadline: past the window, quality is 0 and the drain sits at the floor.
      this.resolve(dir, Math.min(Math.max(atMs, s.startMs), s.deadlineMs));
      return true;
    }
    if (s.greyed.includes(dir) && atMs < s.deadlineMs) return false;
    if (atMs >= s.deadlineMs) {
      this.resolve(null, s.deadlineMs);
      return false;
    }
    this.resolve(dir, Math.max(atMs, s.startMs));
    return true;
  }

  /**
   * Drink a flask: greys out `flaskPower` wrong cards (1 or 2, never all 3) of the current strike, picked by the
   * flask RNG. Returns false if there is no open wind-up or it was already used on this strike.
   * The caller owns the flask count.
   */
  useFlask(): boolean {
    const s = this.current;
    if (s.kind !== 'windup' || s.greyed.length > 0 || !this.flaskRng) return false;
    const strike = s.question.strikes[s.strike];
    if (!strike) return false;
    const wrong = DIRECTIONS.filter((d) => d !== strike.correct);
    s.greyed = this.flaskRng.shuffle(wrong).slice(0, this.flaskPower);
    return true;
  }

  /** Submit the typed riposte, one entry per blank. */
  submitRiposte(words: readonly string[], nowMs: number): void {
    const s = this.current;
    if (s.kind !== 'riposte') return;
    const verdicts = s.question.strikes.map((strike, i) =>
      judgeWord(words[i] ?? '', strike.options[strike.correct], this.zone <= 1),
    );
    const landed = verdicts.filter((v) => v !== 'wrong').length;
    this.enemy.hp = Math.max(0, this.enemy.hp - landed * this.riposteDamage);
    this.current = {
      kind: 'riposteResult',
      question: s.question,
      typed: s.question.strikes.map((_, i) => words[i] ?? ''),
      verdicts,
      untilMs: nowMs + RIPOSTE_RESULT_MS,
    };
  }

  /** Starts a new exchange: the first question of a chain. */
  private beginQuestion(nowMs: number): void {
    this.chainIndex = 0;
    this.chainStrikes = 0;
    this.cleanSoFar = true;
    this.beginStrike(this.nextQuestion(), 0, nowMs);
  }

  private beginStrike(question: Question, strike: number, nowMs: number): void {
    const attack = attackFor(question.kind);
    this.current = { kind: 'windup', question, strike, startMs: nowMs, deadlineMs: nowMs + windowMs(attack, this.zone), greyed: [] };
  }

  private resolve(chosen: Direction | null, atMs: number): void {
    const s = this.current;
    if (s.kind !== 'windup') return;
    const strike = s.question.strikes[s.strike];
    if (!strike) throw new Error(`question ${s.question.id} has no strike ${s.strike}`);

    const attack = attackFor(s.question.kind);
    const quality = chosen === null ? 0 : parryQuality(s.startMs, s.deadlineMs, atMs);
    const parried = chosen === strike.correct;
    const assisted = s.greyed.length > 0;
    const e = this.enemy;

    if (parried) {
      e.stance -= stanceDrain(quality);
    } else {
      this.vitality = Math.max(0, this.vitality - damageFor(attack));
      e.stance = Math.min(e.stanceMax, e.stance + HIT_STANCE_REFILL);
      this.cleanSoFar = false;
    }

    this.chainStrikes += 1;
    const isLast = s.strike === s.question.strikes.length - 1 && this.chainIndex === this.chainLength - 1;
    const comboCleared = parried && isLast && this.chainStrikes > 1 && this.cleanSoFar;
    if (comboCleared) e.stance -= COMBO_CLEAR_BONUS * e.stanceMax;
    e.stance = Math.max(0, e.stance);

    this.log.push({
      questionId: s.question.id,
      seed: s.question.seed,
      strike: s.strike,
      chosen,
      correct: strike.correct,
      result: parried ? 'parry' : 'hit',
      quality,
      components: strikeComponents(s.question, s.strike),
      assisted,
    });

    this.current = {
      kind: 'resolving',
      question: s.question,
      strike: s.strike,
      chosen,
      correct: strike.correct,
      result: parried ? 'parry' : 'hit',
      quality,
      startMs: atMs,
      untilMs: atMs + RESOLVE_MS,
      // A break skips the rest of a combo (DECISIONS #9).
      stanceBroken: e.stance <= 0,
      comboCleared,
      assisted,
    };
  }
}
