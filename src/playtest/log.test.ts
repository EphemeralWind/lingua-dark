import { describe, expect, it } from 'vitest';
import type { ExchangeRecord } from '../combat/types';
import type { KeyValueStore } from '../save/store';
import { PLAYTEST_MAX_EVENTS } from '../tuning';
import { parsePlaytestFile, PLAYTEST_KEY, PlaytestLog } from './log';

class Mem implements KeyValueStore {
  m = new Map<string, string>();
  fail = false;
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.fail) throw new Error('QuotaExceededError');
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

const rec = (over: Partial<ExchangeRecord> = {}): ExchangeRecord => ({
  questionId: 't_definite_article',
  seed: 42,
  kind: 'grammar',
  attack: 'overhead',
  strike: 0,
  chainIndex: 0,
  chosen: 'east',
  correct: 'east',
  result: 'parry',
  quality: 0.61234,
  components: ['art:definite:f'],
  assisted: false,
  answerMs: 2900.4,
  windowMs: 7500,
  timedOut: false,
  stanceBroken: false,
  untimed: true,
  ...over,
});

const villager = { foe: 'hollow_villager', label: 'Hollow villager' };

describe('PlaytestLog', () => {
  it('logs a fight with its strikes, riposte and outcome, and survives a reload', () => {
    const kv = new Mem();
    let t = 1_000;
    const log = new PlaytestLog(kv, () => t);
    const f = log.beginFight(villager, { hollow: true, vitality: 100, enemyHp: 60 });
    t += 3000;
    log.exchange(f, villager, rec());
    log.exchange(f, villager, rec({ chosen: null, result: 'hit', timedOut: true }));
    log.riposte(f, villager, ['exact', 'wrong']);
    log.endFight(f, villager, { outcome: 'won', vitality: 80, enemyHp: 0 });
    expect(log.exchanges).toBe(2);

    const [start, hit] = log.all();
    expect(start).toMatchObject({ type: 'fightStart', fight: f, hollow: true, foe: 'hollow_villager' });
    expect(hit).toMatchObject({ type: 'exchange', correct: true, answerDir: 'east', hollow: true, answerMs: 2900, quality: 0.612, kind: 'grammar', attack: 'overhead', atMs: 4000 });

    const again = new PlaytestLog(kv, () => t + 1);
    expect(again.all()).toHaveLength(5);
    expect(again.exchanges).toBe(2);
    expect(again.session).not.toBe(log.session);
  });

  it('exports a file the report can read back', () => {
    const log = new PlaytestLog(new Mem(), () => Date.UTC(2026, 10, 18));
    const f = log.beginFight({ foe: 'boss_zone1', label: 'Bell 1/2', bossPhase: 1, bossPhases: 2 }, { hollow: false, vitality: 100, enemyHp: 60 });
    log.exchange(f, { foe: 'boss_zone1', label: 'Bell 1/2', bossPhase: 1 }, rec({ untimed: false }));
    const text = log.exportText();
    const file = JSON.parse(text);
    expect(file).toMatchObject({ game: 'lingua-dark', format: 1, exportedAt: '2026-11-18T00:00:00.000Z' });
    expect(parsePlaytestFile(text)).toEqual(log.all());
    expect(parsePlaytestFile(JSON.stringify(log.all()))).toEqual(log.all());
    expect(() => parsePlaytestFile('{"game":"other"}')).toThrow(/not a Lingua Dark playtest log/);
    expect(() => parsePlaytestFile('{"game":"lingua-dark","format":99,"events":[]}')).toThrow(/format 99/);
  });

  it('clears between participants', () => {
    const kv = new Mem();
    const log = new PlaytestLog(kv, () => 0);
    log.exchange('f', villager, rec());
    log.clear();
    expect(log.all()).toEqual([]);
    expect(log.exchanges).toBe(0);
    expect(kv.getItem(PLAYTEST_KEY)).toBeNull();
  });

  it('drops the oldest events past the cap', () => {
    const log = new PlaytestLog(new Mem(), () => 0, 50);
    for (let i = 0; i < 55; i++) log.exchange('f', villager, rec({ seed: i }));
    expect(log.size).toBe(50);
    expect(log.exchanges).toBe(50);
    expect(log.all()[0]).toMatchObject({ seed: 5 });
  });

  it('a full log fits in localStorage', () => {
    const log = new PlaytestLog(new Mem(), () => 1_800_000_000_000);
    const long = rec({ components: ['v_levantar:present:3sg', 'art:definite:f'], questionId: 't_combo_two' });
    log.exchange('s1abcdefg-f12', { ...villager, bossPhase: 2 }, long);
    const bytes = JSON.stringify(log.all()).length;
    expect(bytes * PLAYTEST_MAX_EVENTS).toBeLessThan(4_000_000);
  });

  it('keeps logging in memory and reports a failed write', () => {
    const kv = new Mem();
    kv.fail = true;
    const log = new PlaytestLog(kv, () => 0);
    log.exchange('f', villager, rec());
    expect(log.size).toBe(1);
    expect(log.lastError).toMatch(/Quota/);
  });

  it('ignores a corrupt stored log', () => {
    const kv = new Mem();
    kv.setItem(PLAYTEST_KEY, '{oops');
    expect(new PlaytestLog(kv, () => 0).all()).toEqual([]);
    kv.setItem(PLAYTEST_KEY, '[{"type":"exchange"},{"type":"junk"},3]');
    expect(new PlaytestLog(kv, () => 0).all()).toHaveLength(1);
  });
});
