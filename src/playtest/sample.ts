// Sample playtest logs from simulated players, so the report can be run and tested without a
// real playtest. Pure: real encounters on a fake clock, seeded throughout. The players are crude
// models (know the answer with some probability, else guess); they are not evidence about people.
import { Encounter } from '../combat/encounter';
import type { EncounterState } from '../combat/types';
import type { Template } from '../content/schema';
import { createDeck, zoneTemplates } from '../content/deck';
import { createRng, type Rng } from '../content/rng';
import { DIRECTIONS, type Direction } from '../content/types';
import { UPDATE_STEP_MS } from '../tuning';
import { bossIn } from '../world/boss';
import { ZONE1 } from '../world/zone';
import { PlaytestLog, type FightInfo, type PlaytestEvent } from './log';
import type { KeyValueStore } from '../save/store';

export interface SimPlayer {
  name: string;
  /** Chance the player knows a strike's answer. 0 = no Spanish at all. */
  knows: number;
  /** Known answers come after this share of the window (uniform between the two). */
  fast: [number, number];
  /** Guesses come after this share of the window; past 1 is a timeout in timed mode. */
  slow: [number, number];
  hollow: boolean;
  /** Regular fights before the boss. */
  fights: number;
}

export const SAMPLE_PLAYERS: readonly SimPlayer[] = [
  { name: 'fluent', knows: 0.95, fast: [0.15, 0.45], slow: [0.4, 0.9], hollow: false, fights: 4 },
  { name: 'learner', knows: 0.7, fast: [0.3, 0.75], slow: [0.5, 1.15], hollow: false, fights: 6 },
  { name: 'gamer-no-spanish', knows: 0, fast: [0.2, 0.5], slow: [0.15, 0.6], hollow: false, fights: 6 },
  { name: 'learner-hollow', knows: 0.7, fast: [0.4, 1.6], slow: [0.8, 2.5], hollow: true, fights: 4 },
];

class MemoryStore implements KeyValueStore {
  private readonly m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

const between = (rng: Rng, [a, b]: [number, number]): number => a + (b - a) * rng.next();

interface FightSetup {
  info: FightInfo;
  templates: Template[];
  enemyHp?: number;
  stanceMax?: number;
  chain?: number;
}

/** Plays one fight to the end; returns the vitality left. */
function playFight(log: PlaytestLog, p: SimPlayer, setup: FightSetup, vitality: number, rng: Rng, clock: { now: number }): { won: boolean; vitality: number } {
  const enc = new Encounter(createDeck(createRng(rng.nextSeed()), setup.templates), {
    zone: 1,
    vitality,
    untimed: p.hollow,
    ...(setup.enemyHp !== undefined ? { enemyHp: setup.enemyHp } : {}),
    ...(setup.stanceMax !== undefined ? { stanceMax: setup.stanceMax } : {}),
    ...(setup.chain !== undefined ? { chain: setup.chain } : {}),
  });
  const fight = log.beginFight(setup.info, { hollow: p.hollow, vitality, enemyHp: enc.enemy.hp });
  enc.start(clock.now);
  let logged = 0;
  let decided: unknown = null;
  let pending: { dir: Direction; atMs: number } | null = null;
  for (let guard = 0; guard < 500_000 && !enc.finished; guard++) {
    const s = enc.state;
    if (s.kind === 'windup' && decided !== s) {
      decided = s;
      const strike = s.question.strikes[s.strike];
      const window = s.deadlineMs - s.startMs;
      const known = strike !== undefined && rng.next() < p.knows;
      const dir = known && strike ? strike.correct : rng.pick(DIRECTIONS);
      pending = { dir, atMs: s.startMs + window * between(rng, known ? p.fast : p.slow) };
    }
    if (pending && clock.now >= pending.atMs) {
      enc.lockIn(pending.dir, pending.atMs);
      pending = null;
    }
    if (enc.state.kind === 'riposte') {
      const q = enc.state.question;
      // Knowing the word means typing it right.
      enc.submitRiposte(q.strikes.map((st) => (rng.next() < p.knows ? st.options[st.correct] : '')), clock.now);
      const r = enc.state as EncounterState; // submitRiposte moved it on; TS keeps the old narrowing.
      if (r.kind === 'riposteResult') log.riposte(fight, setup.info, r.verdicts);
    }
    for (; logged < enc.log.length; logged++) {
      const rec = enc.log[logged];
      if (rec) log.exchange(fight, setup.info, rec);
    }
    clock.now += UPDATE_STEP_MS;
    enc.tick(clock.now);
  }
  // The last strike resolves on the final tick.
  for (; logged < enc.log.length; logged++) {
    const rec = enc.log[logged];
    if (rec) log.exchange(fight, setup.info, rec);
  }
  const won = enc.state.kind === 'won';
  log.endFight(fight, setup.info, { outcome: won ? 'won' : 'lost', vitality: enc.vitality, enemyHp: enc.enemy.hp });
  return { won, vitality: enc.vitality };
}

/**
 * One session per player: some regular fights on the whole Zone 1 deck, then the first boss,
 * phase by phase with vitality carried over, until it falls or the player dies.
 */
export function sampleLog(seed = 1, players: readonly SimPlayer[] = SAMPLE_PLAYERS): PlaytestEvent[] {
  const boss = bossIn(ZONE1, 'r1_boss_arena');
  if (!boss) throw new Error('zone 1 has no boss in r1_boss_arena');
  const events: PlaytestEvent[] = [];
  const rng = createRng(seed);
  // A fake wall clock: each session starts a day after the last.
  const clock = { now: Date.UTC(2026, 10, 18) + seed * 1000 };
  for (const p of players) {
    clock.now += 86_400_000;
    const log = new PlaytestLog(new MemoryStore(), () => clock.now);
    for (let i = 0; i < p.fights; i++) {
      playFight(log, p, { info: { foe: 'hollow_villager', label: 'Hollow villager' }, templates: zoneTemplates(1) }, 100, rng, clock);
    }
    let vitality = 100;
    for (const [i, phase] of boss.phases.entries()) {
      const info: FightInfo = { foe: boss.id, label: `${boss.name} ${i + 1}/${boss.phases.length}`, bossPhase: i + 1, bossPhases: boss.phases.length };
      const r = playFight(log, p, { info, templates: phase.templates, enemyHp: phase.hp, stanceMax: phase.stanceMax, chain: phase.chain }, vitality, rng, clock);
      if (!r.won) break;
      vitality = r.vitality;
    }
    // Sessions are named after the model, so the sample report reads at a glance.
    events.push(...log.all().map((e) => ({ ...e, session: p.name })));
  }
  return events;
}
