// Encounter state machine (SPEC 3.1, 3.2, 3.4, 9). Pure logic: time comes in as arguments,
// questions come from an injected source. No DOM, no clock reads, no Math.random.
import type { Direction, Question } from '../content/types';
import {
  COMBO_CLEAR_BONUS,
  ENEMY_HP,
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
  vitality?: number;
}

export class Encounter {
  readonly enemy: Enemy;
  readonly vitalityMax: number;
  vitality: number;
  readonly log: ExchangeRecord[] = [];
  private current: EncounterState = { kind: 'idle' };
  /** True while every strike of the current question has been parried. */
  private cleanSoFar = true;
  private readonly zone: number;
  private readonly nextQuestion: () => Question;

  constructor(nextQuestion: () => Question, config: EncounterConfig) {
    this.nextQuestion = nextQuestion;
    this.zone = config.zone;
    const hp = config.enemyHp ?? ENEMY_HP;
    const stanceMax = config.stanceMax ?? STANCE_MAX;
    this.enemy = { hp, hpMax: hp, stance: stanceMax, stanceMax };
    this.vitalityMax = config.vitality ?? PLAYER_VITALITY;
    this.vitality = this.vitalityMax;
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
        if (nowMs >= s.deadlineMs) this.resolve(null, s.deadlineMs);
        return;
      case 'resolving':
        if (nowMs < s.untilMs) return;
        if (this.vitality <= 0) {
          this.current = { kind: 'lost' };
        } else if (s.stanceBroken) {
          this.current = { kind: 'riposte', question: s.question, typed: [] };
        } else if (s.strike + 1 < s.question.strikes.length) {
          this.beginStrike(s.question, s.strike + 1, nowMs);
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
    if (atMs >= s.deadlineMs) {
      this.resolve(null, s.deadlineMs);
      return false;
    }
    this.resolve(dir, Math.max(atMs, s.startMs));
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
    this.enemy.hp = Math.max(0, this.enemy.hp - landed * RIPOSTE_DAMAGE_PER_WORD);
    this.current = {
      kind: 'riposteResult',
      question: s.question,
      typed: s.question.strikes.map((_, i) => words[i] ?? ''),
      verdicts,
      untilMs: nowMs + RIPOSTE_RESULT_MS,
    };
  }

  private beginQuestion(nowMs: number): void {
    this.beginStrike(this.nextQuestion(), 0, nowMs);
  }

  private beginStrike(question: Question, strike: number, nowMs: number): void {
    if (strike === 0) this.cleanSoFar = true;
    const attack = attackFor(question.kind);
    this.current = { kind: 'windup', question, strike, startMs: nowMs, deadlineMs: nowMs + windowMs(attack, this.zone) };
  }

  private resolve(chosen: Direction | null, atMs: number): void {
    const s = this.current;
    if (s.kind !== 'windup') return;
    const strike = s.question.strikes[s.strike];
    if (!strike) throw new Error(`question ${s.question.id} has no strike ${s.strike}`);

    const attack = attackFor(s.question.kind);
    const quality = chosen === null ? 0 : parryQuality(s.startMs, s.deadlineMs, atMs);
    const parried = chosen === strike.correct;
    const e = this.enemy;

    if (parried) {
      e.stance -= stanceDrain(quality);
    } else {
      this.vitality = Math.max(0, this.vitality - damageFor(attack));
      e.stance = Math.min(e.stanceMax, e.stance + HIT_STANCE_REFILL);
      this.cleanSoFar = false;
    }

    const isLast = s.strike === s.question.strikes.length - 1;
    const comboCleared = parried && isLast && s.question.strikes.length > 1 && this.cleanSoFar;
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
    };
  }
}
