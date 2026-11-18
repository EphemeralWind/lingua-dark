// Tuning report over playtest logs (Prompt 5): per-attack accuracy, median answer time and
// stance-break rate, per-foe outcomes, card-direction bias, and the litmus verdict per session.
// Pure; `scripts/playtest-report.ts` reads the files and prints `formatReport`.
import type { AttackType } from '../combat/types';
import { DIRECTIONS, type Direction } from '../content/types';
import { CHANCE_ACCURACY, LITMUS_ALPHA, LITMUS_EARLY_STRIKES, REPORT_FAST_SHARE, REPORT_TIMEOUT_WARN } from '../tuning';
import type { ExchangeEvent, FightEndEvent, FightStartEvent, PlaytestEvent } from './log';

export interface AttackRow {
  attack: AttackType;
  hollow: boolean;
  strikes: number;
  accuracy: number;
  /** Median ms to answer over strikes that were answered (timeouts excluded); null if none. */
  medianAnswerMs: number | null;
  /** Median answer time as a share of the window. */
  medianWindowShare: number | null;
  windowMs: number;
  timeoutRate: number;
  /** Share of this attack's strikes that broke the enemy's stance. */
  stanceBreakRate: number;
  meanQuality: number;
}

export interface FoeRow {
  foe: string;
  bossPhase?: number;
  fights: number;
  won: number;
  lost: number;
  /** Started but never ended: the page closed or the fight was left. */
  unfinished: number;
  strikes: number;
  accuracy: number;
  /** Stance breaks per fight. */
  breaksPerFight: number;
  /** Strikes between breaks; null if the stance never broke. */
  strikesPerBreak: number | null;
  /** Riposte words that landed (exact or accent-forgiven), as a share of words asked. */
  riposteHitRate: number | null;
}

export interface DirectionRow {
  dir: Direction;
  /** Share of answered strikes where the player picked this card. */
  pickShare: number;
  /** Share of strikes whose answer was this card (should be near 25%). */
  answerShare: number;
}

export interface SessionVerdict {
  session: string;
  strikes: number;
  /** Timed strikes only: Hollow mode removes the pressure the litmus test is about. */
  timedStrikes: number;
  timedAccuracy: number;
  /** One-sided p-value that timed accuracy this high comes from guessing at 25%. */
  pChance: number;
  /**
   * The first LITMUS_EARLY_STRIKES timed strikes: before the revealed answers can teach much, so
   * accuracy above chance here points to a leak rather than learning.
   */
  earlyStrikes: number;
  earlyAccuracy: number;
  earlyPChance: number;
  /** The last LITMUS_EARLY_STRIKES timed strikes. Rising from early to late is learning. */
  lateAccuracy: number;
  /** Highest boss phase reached (0 = never fought the boss) and phases won. */
  bossPhaseReached: number;
  bossPhasesWon: number;
  bossCleared: boolean;
  /** Played any strike in Hollow mode. */
  usedHollow: boolean;
}

export interface Report {
  events: number;
  sessions: number;
  fights: number;
  strikes: number;
  accuracy: number;
  attacks: AttackRow[];
  foes: FoeRow[];
  directions: DirectionRow[];
  verdicts: SessionVerdict[];
  hints: string[];
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** P(X ≥ k) for X ~ Binomial(n, p), summed exactly in log space. */
export function binomialTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let logC = 0; // log C(n, 0)
  let total = 0;
  for (let i = 0; i <= n; i++) {
    if (i > 0) logC += Math.log(n - i + 1) - Math.log(i);
    if (i >= k) total += Math.exp(logC + i * Math.log(p) + (n - i) * Math.log(1 - p));
  }
  return Math.min(1, total);
}

const share = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

function attackRows(ex: readonly ExchangeEvent[]): AttackRow[] {
  const groups = new Map<string, ExchangeEvent[]>();
  for (const e of ex) {
    const k = `${e.attack}|${e.hollow}`;
    const g = groups.get(k);
    if (g) g.push(e);
    else groups.set(k, [e]);
  }
  const rows: AttackRow[] = [];
  for (const g of groups.values()) {
    const first = g[0] as ExchangeEvent;
    const answered = g.filter((e) => !e.timedOut);
    const med = median(answered.map((e) => e.answerMs));
    const medShare = median(answered.map((e) => e.answerMs / e.windowMs));
    rows.push({
      attack: first.attack,
      hollow: first.hollow,
      strikes: g.length,
      accuracy: share(g.filter((e) => e.correct).length, g.length),
      medianAnswerMs: med,
      medianWindowShare: medShare,
      windowMs: median(g.map((e) => e.windowMs)) ?? 0,
      timeoutRate: share(g.length - answered.length, g.length),
      stanceBreakRate: share(g.filter((e) => e.stanceBroken).length, g.length),
      meanQuality: share(g.reduce((t, e) => t + (e.correct ? e.quality : 0), 0), g.filter((e) => e.correct).length),
    });
  }
  return rows.sort((a, b) => a.attack.localeCompare(b.attack) || Number(a.hollow) - Number(b.hollow));
}

function foeRows(events: readonly PlaytestEvent[]): FoeRow[] {
  const key = (foe: string, phase?: number): string => (phase === undefined ? foe : `${foe}#${phase}`);
  const rows = new Map<string, FoeRow & { hits: number; words: number; landed: number; breaks: number }>();
  const row = (foe: string, phase?: number) => {
    const k = key(foe, phase);
    let r = rows.get(k);
    if (!r) {
      r = { foe, ...(phase !== undefined ? { bossPhase: phase } : {}), fights: 0, won: 0, lost: 0, unfinished: 0, strikes: 0, accuracy: 0, breaksPerFight: 0, strikesPerBreak: null, riposteHitRate: null, hits: 0, words: 0, landed: 0, breaks: 0 };
      rows.set(k, r);
    }
    return r;
  };
  const phaseOf = new Map<string, number | undefined>();
  for (const e of events) {
    if (e.type === 'fightStart') {
      phaseOf.set(e.fight, e.bossPhase);
      const r = row(e.foe, e.bossPhase);
      r.fights += 1;
      r.unfinished += 1;
    } else if (e.type === 'fightEnd') {
      const r = row(e.foe, e.bossPhase);
      r.unfinished = Math.max(0, r.unfinished - 1);
      if (e.outcome === 'won') r.won += 1;
      else r.lost += 1;
    } else if (e.type === 'exchange') {
      const r = row(e.foe, e.bossPhase);
      r.strikes += 1;
      if (e.correct) r.hits += 1;
      if (e.stanceBroken) r.breaks += 1;
    } else {
      const r = row(e.foe, phaseOf.get(e.fight));
      r.words += e.verdicts.length;
      r.landed += e.verdicts.filter((v) => v !== 'wrong').length;
    }
  }
  return [...rows.values()]
    .map(({ hits, words, landed, breaks, ...r }) => ({
      ...r,
      accuracy: share(hits, r.strikes),
      breaksPerFight: share(breaks, r.fights),
      strikesPerBreak: breaks === 0 ? null : r.strikes / breaks,
      riposteHitRate: words === 0 ? null : landed / words,
    }))
    .sort((a, b) => a.foe.localeCompare(b.foe) || (a.bossPhase ?? 0) - (b.bossPhase ?? 0));
}

function directionRows(ex: readonly ExchangeEvent[]): DirectionRow[] {
  const answered = ex.filter((e) => e.chosen !== null);
  return DIRECTIONS.map((dir) => ({
    dir,
    pickShare: share(answered.filter((e) => e.chosen === dir).length, answered.length),
    answerShare: share(ex.filter((e) => e.answerDir === dir).length, ex.length),
  }));
}

/** Boss fights are the ones that carry a phase number; the last phase's win clears the boss. */
function verdicts(events: readonly PlaytestEvent[]): SessionVerdict[] {
  const sessions = [...new Set(events.map((e) => e.session))];
  return sessions.map((session) => {
    const mine = events.filter((e) => e.session === session);
    const ex = mine.filter((e): e is ExchangeEvent => e.type === 'exchange');
    const timed = ex.filter((e) => !e.hollow);
    const hits = timed.filter((e) => e.correct).length;
    const early = timed.slice(0, LITMUS_EARLY_STRIKES);
    const earlyHits = early.filter((e) => e.correct).length;
    const late = timed.slice(-LITMUS_EARLY_STRIKES);
    const starts = mine.filter((e): e is FightStartEvent => e.type === 'fightStart' && e.bossPhase !== undefined);
    const startOf = new Map(starts.map((e) => [e.fight, e]));
    const wins = mine.filter((e): e is FightEndEvent => e.type === 'fightEnd' && e.bossPhase !== undefined && e.outcome === 'won');
    const wonPhases = new Set(wins.map((e) => e.bossPhase));
    const cleared = wins.some((e) => {
      const st = startOf.get(e.fight);
      return st?.bossPhases !== undefined && e.bossPhase === st.bossPhases;
    });
    return {
      session,
      strikes: ex.length,
      timedStrikes: timed.length,
      timedAccuracy: share(hits, timed.length),
      pChance: binomialTail(hits, timed.length, CHANCE_ACCURACY),
      earlyStrikes: early.length,
      earlyAccuracy: share(earlyHits, early.length),
      earlyPChance: binomialTail(earlyHits, early.length, CHANCE_ACCURACY),
      lateAccuracy: share(late.filter((e) => e.correct).length, late.length),
      bossPhaseReached: Math.max(0, ...starts.map((e) => e.bossPhase ?? 0)),
      bossPhasesWon: wonPhases.size,
      bossCleared: cleared,
      usedHollow: ex.some((e) => e.hollow),
    };
  });
}

function hints(attacks: readonly AttackRow[]): string[] {
  const out: string[] = [];
  for (const a of attacks) {
    if (a.hollow || a.strikes < 10) continue;
    if (a.timeoutRate > REPORT_TIMEOUT_WARN) {
      out.push(`${a.attack}: ${pct(a.timeoutRate)} of strikes time out. The window (${secs(a.windowMs)}) may be too short.`);
    }
    if (a.medianWindowShare !== null && a.medianWindowShare < REPORT_FAST_SHARE && a.accuracy >= 0.8) {
      out.push(`${a.attack}: median answer uses ${pct(a.medianWindowShare)} of the window at ${pct(a.accuracy)} accuracy. The window may be generous.`);
    }
  }
  return out;
}

export function buildReport(events: readonly PlaytestEvent[]): Report {
  const ex = events.filter((e): e is ExchangeEvent => e.type === 'exchange');
  const attacks = attackRows(ex);
  return {
    events: events.length,
    sessions: new Set(events.map((e) => e.session)).size,
    fights: events.filter((e) => e.type === 'fightStart').length,
    strikes: ex.length,
    accuracy: share(ex.filter((e) => e.correct).length, ex.length),
    attacks,
    foes: foeRows(events),
    directions: directionRows(ex),
    verdicts: verdicts(events),
    hints: hints(attacks),
  };
}

// --- text output -------------------------------------------------------------

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function pValue(p: number): string {
  return `${p < 0.001 ? '<0.001' : p.toFixed(3)}${p < LITMUS_ALPHA ? ' above' : ''}`;
}

function secs(ms: number | null): string {
  return ms === null ? '-' : `${(ms / 1000).toFixed(2)} s`;
}

function table(head: string[], rows: string[][]): string {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells: string[]): string => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i] ?? 0) : c.padStart(widths[i] ?? 0))).join('  ');
  return [line(head), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

export function formatReport(r: Report): string {
  const out: string[] = [];
  out.push('LINGUA DARK PLAYTEST REPORT', '');
  out.push(`${r.sessions} session(s), ${r.fights} fight(s), ${r.strikes} strike(s), overall accuracy ${pct(r.accuracy)}`);
  if (r.strikes === 0) {
    out.push('', 'No strikes in the log.');
    return out.join('\n');
  }

  out.push('', 'PER ATTACK (answer time over answered strikes; break rate = strikes that broke the stance)');
  out.push(
    table(
      ['attack', 'mode', 'strikes', 'accuracy', 'median', 'of window', 'window', 'timeouts', 'break rate', 'mean q'],
      r.attacks.map((a) => [
        a.attack,
        a.hollow ? 'hollow' : 'timed',
        String(a.strikes),
        pct(a.accuracy),
        secs(a.medianAnswerMs),
        a.medianWindowShare === null ? '-' : pct(a.medianWindowShare),
        secs(a.windowMs),
        pct(a.timeoutRate),
        pct(a.stanceBreakRate),
        a.meanQuality.toFixed(2),
      ]),
    ),
  );

  out.push('', 'PER FOE');
  out.push(
    table(
      ['foe', 'fights', 'won', 'lost', 'left', 'strikes', 'accuracy', 'breaks/fight', 'strikes/break', 'riposte'],
      r.foes.map((f) => [
        f.bossPhase === undefined ? f.foe : `${f.foe} (phase ${f.bossPhase})`,
        String(f.fights),
        String(f.won),
        String(f.lost),
        String(f.unfinished),
        String(f.strikes),
        pct(f.accuracy),
        f.breaksPerFight.toFixed(2),
        f.strikesPerBreak === null ? '-' : f.strikesPerBreak.toFixed(1),
        f.riposteHitRate === null ? '-' : pct(f.riposteHitRate),
      ]),
    ),
  );

  out.push('', 'CARD DIRECTIONS (a player pressing one key shows up here)');
  out.push(table(['dir', 'picked', 'answer was'], r.directions.map((d) => [d.dir, pct(d.pickShare), pct(d.answerShare)])));

  out.push('', `LITMUS (timed strikes vs ${pct(CHANCE_ACCURACY)} chance; "above chance" means p < ${LITMUS_ALPHA})`);
  out.push(
    table(
      ['session', 'strikes', 'timed', 'timed acc', 'p(chance)', `first ${LITMUS_EARLY_STRIKES}`, 'p(chance)', `last ${LITMUS_EARLY_STRIKES}`, 'boss phase', 'phases won', 'boss', 'hollow'],
      r.verdicts.map((v) => [
        v.session,
        String(v.strikes),
        String(v.timedStrikes),
        pct(v.timedAccuracy),
        v.timedStrikes === 0 ? '-' : pValue(v.pChance),
        v.earlyStrikes === 0 ? '-' : `${pct(v.earlyAccuracy)} of ${v.earlyStrikes}`,
        v.earlyStrikes === 0 ? '-' : pValue(v.earlyPChance),
        v.earlyStrikes === 0 ? '-' : pct(v.lateAccuracy),
        String(v.bossPhaseReached),
        String(v.bossPhasesWon),
        v.bossCleared ? 'CLEARED' : '-',
        v.usedHollow ? 'yes' : 'no',
      ]),
    ),
  );

  if (r.hints.length > 0) out.push('', 'TUNING HINTS (heuristics; see docs/PLAYTEST.md)', ...r.hints.map((h) => `- ${h}`));
  return out.join('\n');
}
