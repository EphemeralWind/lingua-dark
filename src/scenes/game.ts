// The game: title, exploration of the zone graph, fights, bonfire rest and review, map, and
// saving. Rules live in the pure modules (world/, learning/, save/); this scene wires them to
// input, the clock, the renderer and localStorage.
import { cardRepresentable, templateComponents, zoneComponents } from '../content/components';
import { createRng } from '../content/rng';
import type { Template } from '../content/schema';
import type { Direction } from '../content/types';
import { Encounter } from '../combat/encounter';
import { nextPerkAt, perkLines, perksFor, type Perks } from '../learning/perks';
import type { AnswerContext } from '../learning/mastery';
import { learnedCount, recordInProfile, type Profile } from '../learning/profile';
import { createPicker, reviewQuestion, reviewTargets } from '../learning/picker';
import type { Mood } from '../platform/audio';
import type { DayClock } from '../platform/clock';
import { downloadText, pickTextFile } from '../platform/files';
import type { InputEvent } from '../platform/input';
import { C } from '../platform/palette';
import type { Renderer } from '../platform/renderer';
import type { SaveStore } from '../save/store';
import { BATTLE_CRY_MS, CRY_SHAKE_MS, GHOST_HP, HIT_SHAKE_PX, GHOST_STANCE_MAX, PHASE_TRANSITION_MS, REVIEW_ROUND_SIZE, ROOM_TRANSITION_MS, WARDEN_HP } from '../tuning';
import { bossIn, type BossDef } from '../world/boss';
import { sealProgress, sealTemplates, socketLine, type SealProgress } from '../world/seals';
import {
  addGhosts,
  bossAlive,
  chooseReading,
  die,
  echoAt,
  enemyAlive,
  foesIn,
  ghostComponent,
  newGame,
  nextFightSeed,
  rest,
  returnToBonfire,
  walk,
  winFight,
  type FoeKey,
  type GameState,
} from '../world/state';
import { BACK, layoutZone, resolveExit, ZONE1, type Zone } from '../world/zone';
import { drawArena, Fight } from './fight';
import { Review } from './review';
import type { Services } from './services';
import { drawMap, drawRoom, drawTitle, type ExitLook } from './worldView';

interface FightMode {
  kind: 'fight';
  fight: Fight;
  foe: FoeKey;
  room: string;
  /** Card-representable components missed in this fight, for ghosts. */
  missed: string[];
  /** Component of the last missed strike: the echo's target if the player dies. */
  lastMiss: string | null;
  /** Boss fights: the phases, the one in play, and the title card between phases. */
  boss: { def: BossDef; index: number; cardUntil: number | null; cardFrom: number } | null;
}

type Mode = { kind: 'title'; confirmNew: boolean } | { kind: 'explore' } | FightMode | { kind: 'review'; review: Review } | { kind: 'map' };

const MESSAGE_MS = 4000;

function enemyLabel(id: string): string {
  const s = id.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface GameDeps {
  store: SaveStore;
  clock: DayClock;
  /** Dev builds only: F8 skips a day, F9 marks the zone Learned, F10 grants every seal. */
  dev: boolean;
}

export class GameScene {
  private mode: Mode = { kind: 'title', confirmNew: false };
  private game: GameState | null = null;
  private readonly zone: Zone = ZONE1;
  private readonly universe = zoneComponents(1);
  private readonly layout = layoutZone(ZONE1);
  private message: string[] = [];
  private messageUntil = 0;
  private enteredAt = -Infinity;
  private titleError: string | null = null;
  private importing = false;
  private now = 0;
  /** The stored game as of the last title visit, for the title menu. */
  private saved: GameState | null = null;
  /** Knowledge and perks that outlive runs (DECISIONS #75). */
  private profile: Profile;

  constructor(
    private readonly svc: Services,
    private readonly deps: GameDeps,
  ) {
    const loaded = deps.store.load();
    this.saved = loaded.game;
    this.profile = loaded.profile;
    this.titleError = loaded.error ? `Unreadable: ${loaded.error}` : null;
    if (loaded.game && !this.zone.has(loaded.game.bonfire)) this.titleError = 'Saved game is from another map version.';
  }

  // --- helpers ---------------------------------------------------------------

  private get day(): number {
    return this.deps.clock.today();
  }

  private seals(): SealProgress {
    return sealProgress(this.game?.seals ?? [], this.zone);
  }

  private perks(): Perks {
    return perksFor(this.profile.bestLearned);
  }

  /** "Learned 37/120 (all time). Next perk at 40." */
  private learnedLine(): string {
    const next = nextPerkAt(this.profile.bestLearned);
    const n = learnedCount(this.profile.learner);
    return `Learned ${n}/${this.universe.length} (all time).${next === null ? ' All perks earned.' : ` Next perk at ${next}.`}`;
  }

  private record(ids: readonly string[], correct: boolean, ctx: AnswerContext, assisted = false): void {
    recordInProfile(this.profile, ids, correct, ctx, this.day, { assisted });
    this.deps.store.saveProfile(this.profile);
  }

  private say(...lines: string[]): void {
    this.message = lines;
    this.messageUntil = this.now + MESSAGE_MS;
  }

  private save(): void {
    if (this.game) this.deps.store.save(this.game, this.deps.clock.nowMs());
  }

  private startGame(game: GameState): void {
    this.game = game;
    returnToBonfire(game);
    this.mode = { kind: 'explore' };
    this.enteredAt = this.now;
    this.say(`You wake by the bonfire. Seals ${this.seals().held}/${this.seals().total}.`, 'Enter: rest and review.  M: map.');
  }

  private exportSave(): void {
    if (!this.game) return;
    const date = new Date(this.deps.clock.nowMs()).toISOString().slice(0, 10);
    downloadText(`lingua-dark-save-${date}.json`, this.deps.store.exportText(this.game, this.profile, this.deps.clock.nowMs()));
    this.say('Save exported as a JSON file.');
  }

  private importSave(): void {
    if (this.importing) return;
    this.importing = true;
    void pickTextFile().then((text) => {
      this.importing = false;
      if (text === null) return;
      const r = this.deps.store.importText(text);
      if (!r.ok) {
        this.titleError = `Import failed: ${r.error}`;
        this.say(`Import failed: ${r.error}`);
        return;
      }
      this.titleError = null;
      if (r.profile) this.profile = r.profile;
      this.saved = r.game;
      this.startGame(r.game);
      this.say('Save imported. You wake by the bonfire.');
    });
  }

  private mood(): Mood {
    const m = this.mode;
    if (m.kind === 'title') return 'title';
    if (m.kind === 'fight') return m.boss ? 'boss' : 'fight';
    if (m.kind === 'review') return 'rest';
    const g = this.game;
    return g && this.zone.room(g.room).contents.bonfire ? 'rest' : 'explore';
  }

  // --- update ----------------------------------------------------------------

  update(nowMs: number, events: InputEvent[]): void {
    this.now = nowMs;
    if (nowMs > this.messageUntil) this.message = [];
    const m = this.mode;
    switch (m.kind) {
      case 'title':
        for (const ev of events) this.handleTitle(m, ev);
        break;
      case 'explore':
        for (const ev of events) {
          if (this.mode.kind !== 'explore') break;
          this.handleExplore(ev);
        }
        break;
      case 'map':
        for (const ev of events) {
          if (ev.type === 'confirm' || (ev.type === 'key' && (ev.code === 'KeyM' || ev.code === 'Escape'))) this.mode = { kind: 'explore' };
          else if (ev.type === 'key' && ev.code === 'KeyE') this.exportSave();
          else if (ev.type === 'key' && ev.code === 'KeyI') this.importSave();
        }
        break;
      case 'fight':
        this.updateFight(m, nowMs, events);
        break;
      case 'review':
        m.review.update(events, nowMs);
        if (m.review.finished) {
          m.review.dispose();
          this.save();
          this.mode = { kind: 'explore' };
          this.say(this.learnedLine());
        }
        break;
    }
    this.svc.sound.setMood(this.mood());
    const ds = document.body.dataset;
    ds['scene'] = this.mode.kind;
    ds['room'] = this.game?.room ?? '';
    if (this.mode.kind === 'fight') this.mode.fight.publishTestState();
    else ds['phase'] = this.mode.kind;
  }

  private handleTitle(m: { kind: 'title'; confirmNew: boolean }, ev: InputEvent): void {
    const saved = this.saved;
    if (ev.type === 'confirm' || ev.type === 'point') {
      if (saved && this.zone.has(saved.bonfire)) this.startGame(saved);
      else this.newGame();
    } else if (ev.type === 'key' && ev.code === 'KeyN') {
      if (!saved || m.confirmNew) this.newGame();
      else m.confirmNew = true;
    } else if (ev.type === 'key' && ev.code === 'KeyI') {
      this.importSave();
    } else if (ev.type === 'key' && ev.code === 'Escape') {
      m.confirmNew = false;
    }
  }

  private newGame(): void {
    // A new run's base seed comes from the wall clock (platform code, not game logic).
    const g = newGame(this.zone, this.deps.clock.nowMs() >>> 0, this.perks());
    this.deps.store.save(g, this.deps.clock.nowMs());
    this.startGame(g);
    const reading = this.zone.room(g.room).contents.reading;
    this.say('A cold hearth in a hollow village.', reading ? `Read the sign. ${reading.goal_en}` : '');
  }

  private handleExplore(ev: InputEvent): void {
    const g = this.game;
    if (!g) return;
    if (this.now - this.enteredAt < ROOM_TRANSITION_MS) return;
    if (ev.type === 'direction') {
      this.tryWalk(g, ev.dir);
    } else if (ev.type === 'confirm') {
      const foes = foesIn(g, this.zone, g.room);
      const first = foes[0];
      if (first) this.startFight(g, first);
      else if (this.zone.room(g.room).contents.bonfire) this.restAt(g);
    } else if (ev.type === 'key') {
      if (ev.code === 'KeyM') this.mode = { kind: 'map' };
      else if (this.deps.dev && ev.code === 'F8') {
        this.deps.clock.skipDay();
        this.say(`Dev: skipped to day ${this.day}.`);
      } else if (this.deps.dev && ev.code === 'F9') {
        recordInProfile(this.profile, this.universe, true, 'review', this.day - 1);
        recordInProfile(this.profile, this.universe, true, 'review', this.day);
        this.deps.store.saveProfile(this.profile);
        this.say('Dev: every Zone 1 component marked Learned.', 'Perks apply from the next rest or fight.');
      } else if (this.deps.dev && ev.code === 'F10') {
        g.seals = Object.keys(this.zone.seals);
        this.save();
        this.say('Dev: every seal granted.');
      }
    }
  }

  /** Is this exit the way back (always open, even past a living enemy)? */
  private isRetreat(g: GameState, dir: Direction): boolean {
    const exit = this.zone.room(g.room).exits[dir];
    if (exit === BACK) return true;
    const to = typeof exit === 'string' ? exit : exit?.to;
    return to !== undefined && to === g.cameFrom;
  }

  private tryWalk(g: GameState, dir: Direction): void {
    const room = this.zone.room(g.room);
    if (enemyAlive(g, this.zone, g.room) && !this.isRetreat(g, dir)) {
      this.say(`The ${enemyLabel(room.contents.enemy?.id ?? 'enemy').toLowerCase()} blocks the way.`, 'Enter: fight.  Or go back.');
      this.svc.cues.play('blocked', this.now);
      return;
    }
    let res = resolveExit(this.zone, g.room, dir, { cameFrom: g.cameFrom, openDoors: g.openDoors, gateOpen: this.seals().open });
    // The boss arena has no exits yet; ↓ walks back out (DECISIONS #66).
    if (res.kind === 'none' && Object.keys(room.exits).length === 0 && dir === 'south' && g.cameFrom) {
      res = { kind: 'move', to: g.cameFrom, opens: null, back: true };
    }
    if (res.kind !== 'move') this.svc.cues.play('blocked', this.now);
    switch (res.kind) {
      case 'none':
        this.say('There is no way through there.');
        return;
      case 'locked':
        this.say('The door is barred. It does not open from this side.');
        return;
      case 'gate': {
        const p = this.seals();
        this.say(`The gate bears ${p.total} sockets. Win the seals from the wardens.`, socketLine(p));
        return;
      }
      case 'move': {
        const lines: string[] = [];
        const reading = chooseReading(g, this.profile, this.zone, dir, this.day);
        if (reading) this.deps.store.saveProfile(this.profile);
        if (reading) lines.push(reading.correct ? 'You read the sign right.' : reading.damage > 0 ? `A wrong turn. An ambush! −${reading.damage}` : 'A wrong turn: a detour.');
        walk(g, res.to, res.opens, res.back);
        this.svc.cues.play('step', this.now);
        const sign = this.zone.room(g.room).contents.sign;
        if (sign) this.svc.speech.speak(sign);
        if (res.opens) lines.push('You lift the bar. A shortcut back to the bonfire.');
        lines.push(...this.arrivalLines(g));
        this.enteredAt = this.now;
        this.save();
        if (lines.length > 0) this.say(...lines);
        else this.message = [];
        return;
      }
    }
  }

  private arrivalLines(g: GameState): string[] {
    const room = this.zone.room(g.room);
    const out: string[] = [];
    const echo = g.echo && g.echo.room === g.room ? g.echo : null;
    if (echo) out.push(`Your echo lies here (${echo.xp} XP). Beat ${echo.killer.startsWith('ghost:') ? 'the ghost' : 'the foe that killed you'} to take it back.`);
    const ghosts = g.ghosts[g.room]?.length ?? 0;
    if (ghosts > 0 && !enemyAlive(g, this.zone, g.room)) out.push(`${ghosts} ghost${ghosts > 1 ? 's' : ''} of missed words linger. Enter to face one.`);
    if (room.contents.reading && !g.readingsDone.includes(g.room)) out.push(`Goal: ${room.contents.reading.goal_en}`);
    const boss = bossIn(this.zone, g.room);
    if (boss && bossAlive(g, this.zone, g.room)) out.push(`${boss.name} waits. ${boss.phases.length} phases.`, 'Enter: fight.  ↓: leave.');
    return out;
  }

  // --- fights ----------------------------------------------------------------

  private startFight(g: GameState, foe: FoeKey): void {
    if (foe === 'boss') {
      const def = bossIn(this.zone, g.room);
      if (def) this.startBossPhase(g, { def, index: 0, cardUntil: null, cardFrom: 0 }, [], null);
      return;
    }
    const ghost = ghostComponent(foe);
    // A warden asks only its seal's grammar aspect (DECISIONS #73); ghosts and others the whole zone.
    const seal = ghost ? null : this.zone.wardenSeal(g.room);
    const templates = seal ? sealTemplates(this.zone, seal) : undefined;
    const enemyId = this.zone.room(g.room).contents.enemy?.id ?? 'enemy';
    const enemyName = enemyLabel(enemyId);
    const echo = echoAt(g, g.room, foe);
    const fight = this.makeFight(g, foe, templates, {
      label: ghost ? 'Ghost' : seal ? `${enemyName} (warden)` : enemyName,
      character: ghost ? 'ghost' : enemyId,
      ...(ghost ? { enemyHp: GHOST_HP, stanceMax: GHOST_STANCE_MAX } : seal ? { enemyHp: WARDEN_HP } : {}),
      ...(echo ? { note: `ECHO ${echo.xp} XP` } : {}),
    });
    fight.start(this.now);
    this.mode = { kind: 'fight', fight, foe, room: g.room, missed: [], lastMiss: null, boss: null };
    this.message = [];
  }

  /** One fight against `foe` with a deck (default: the whole zone) and the player's perks. */
  private makeFight(
    g: GameState,
    foe: FoeKey,
    templates: Template[] | undefined,
    o: { label: string; character: string; enemyHp?: number; stanceMax?: number; chain?: number; note?: string; arena?: 'boss' },
  ): Fight {
    const rng = createRng(nextFightSeed(g));
    const ghost = ghostComponent(foe);
    const echo = echoAt(g, g.room, foe);
    const among = templates ? [...new Set(templates.flatMap((t) => templateComponents(t)))] : this.universe;
    const target = ghost ?? echo?.target ?? null;
    const picker = createPicker({
      rng: createRng(rng.nextSeed()),
      // A target the deck cannot show falls back to the deck's own due-first order.
      target: target && among.includes(target) ? target : null,
      learner: () => ({ state: this.profile.learner, day: this.day }),
      among,
      ...(templates ? { templates } : {}),
    });
    const perks = this.perks();
    const enc = new Encounter(picker, {
      zone: g.zone,
      vitality: Math.min(g.vitality, perks.vitalityMax),
      vitalityMax: perks.vitalityMax,
      riposteDamage: perks.riposteDamage,
      flaskPower: perks.flaskPower,
      flaskRng: createRng(rng.nextSeed()),
      untimed: this.svc.settings.hollow,
      ...(o.enemyHp !== undefined ? { enemyHp: o.enemyHp } : {}),
      ...(o.stanceMax !== undefined ? { stanceMax: o.stanceMax } : {}),
      ...(o.chain !== undefined ? { chain: o.chain } : {}),
    });
    return new Fight(enc, this.svc, {
      label: o.label,
      character: o.character,
      flasks: { count: () => g.flasks, spend: () => (g.flasks = Math.max(0, g.flasks - 1)), power: perks.flaskPower },
      ...(o.note ? { note: o.note } : {}),
      ...(o.arena ? { arena: o.arena } : {}),
    });
  }

  /** Starts boss phase `boss.index`; vitality carries over from the phase before. */
  private startBossPhase(g: GameState, boss: NonNullable<FightMode['boss']>, missed: string[], lastMiss: string | null): void {
    const phase = boss.def.phases[boss.index];
    if (!phase) return;
    const echo = echoAt(g, g.room, 'boss');
    const fight = this.makeFight(g, 'boss', phase.templates, {
      label: `${boss.def.name} ${boss.index + 1}/${boss.def.phases.length}`,
      character: boss.def.id,
      enemyHp: phase.hp,
      stanceMax: phase.stanceMax,
      chain: phase.chain,
      arena: 'boss',
      ...(echo ? { note: `ECHO ${echo.xp} XP` } : {}),
    });
    // Each phase opens on a title card; the fight starts when it ends. A phase with a battle cry
    // keeps its card up longer and the bell shouts it (spoken in Spanish; the card shows the text).
    const cardMs = phase.cry ? BATTLE_CRY_MS : PHASE_TRANSITION_MS;
    this.mode = { kind: 'fight', fight, foe: 'boss', room: g.room, missed, lastMiss, boss: { ...boss, cardFrom: this.now, cardUntil: this.now + cardMs } };
    this.svc.cues.play('phase', this.now);
    if (phase.cry) this.svc.speech.speak(phase.cry.es);
    this.message = [];
  }

  private updateFight(m: FightMode, nowMs: number, events: InputEvent[]): void {
    const g = this.game;
    if (!g) return;
    if (m.boss?.cardUntil !== null && m.boss?.cardUntil !== undefined) {
      // Phase title card: Enter skips it.
      if (nowMs >= m.boss.cardUntil || events.some((ev) => ev.type === 'confirm')) {
        m.boss.cardUntil = null;
        m.fight.start(nowMs);
      }
      return;
    }
    if (m.fight.finished) {
      if (!events.some((ev) => ev.type === 'confirm' || ev.type === 'point')) return;
      const next = m.boss && m.fight.won ? m.boss.def.phases[m.boss.index + 1] : undefined;
      if (m.boss && next) {
        m.fight.dispose();
        g.vitality = m.fight.enc.vitality;
        this.startBossPhase(g, { ...m.boss, index: m.boss.index + 1 }, m.missed, m.lastMiss);
      } else {
        this.endFight(g, m);
      }
      return;
    }
    for (const ev of events) m.fight.handle(ev);
    m.fight.update(nowMs);
    for (const rec of m.fight.drainLog()) {
      const parried = rec.result === 'parry';
      // Combat answers move the review schedule but never count toward mastery (CLAUDE.md rule 6).
      this.record(rec.components, parried, 'combat', rec.assisted);
      if (!parried) {
        const c = rec.components.find((x) => cardRepresentable(x)) ?? null;
        if (c) m.missed.push(c);
        m.lastMiss = c;
      }
    }
    g.vitality = m.fight.enc.vitality;
  }

  private endFight(g: GameState, m: FightMode): void {
    m.fight.dispose();
    const ghost = ghostComponent(m.foe);
    if (m.fight.won) {
      const { recovered, seal } = winFight(g, this.zone, m.room, m.foe);
      addGhosts(g, m.room, m.missed.filter((c) => c !== ghost));
      const lines = [m.boss ? `${m.boss.def.name} falls silent. The Hollow Village is free.` : ghost ? 'The ghost fades.' : 'The foe falls.'];
      if (seal) {
        lines.push(`You take the ${this.zone.seals[seal]?.name_en ?? seal}. ${socketLine(this.seals())}`);
        this.svc.cues.play('seal', this.now);
      }
      if (recovered > 0) lines.push(`Echo recovered: +${recovered} XP.`);
      const ghosts = g.ghosts[m.room]?.length ?? 0;
      if (ghosts > 0) lines.push(`${ghosts} ghost${ghosts > 1 ? 's' : ''} of missed words linger here.`);
      if (m.boss) lines.push('Zone 1 cleared. The road to the Drowned Library is not built yet.');
      this.say(...lines);
    } else {
      addGhosts(g, m.room, m.missed);
      const xp = g.xp;
      die(g, m.foe, m.lastMiss, this.perks());
      this.say('YOU DIED. You wake by the bonfire.', xp > 0 ? `Your echo (${xp} XP) waits where you fell.` : 'You carried no XP.');
    }
    this.save();
    this.mode = { kind: 'explore' };
    this.enteredAt = this.now;
  }

  // --- bonfire ---------------------------------------------------------------

  private restAt(g: GameState): void {
    rest(g, g.room, this.perks());
    const rng = createRng(nextFightSeed(g));
    const day = this.day;
    const targets = reviewTargets(this.profile.learner, this.universe, day, REVIEW_ROUND_SIZE, rng);
    const questions = targets.flatMap((t) => reviewQuestion(rng, t) ?? []);
    this.save();
    const review = new Review(questions, this.svc, (q, correct) => this.record(q.components, correct, 'review'), g.zone <= 1);
    this.svc.cues.play('bonfire', this.now);
    this.mode = { kind: 'review', review };
    this.message = [];
  }

  // --- render ----------------------------------------------------------------

  render(r: Renderer, nowMs: number): void {
    const m = this.mode;
    const g = this.game;
    if (m.kind === 'title' || !g) {
      const saved = this.saved;
      const lines =
        m.kind === 'title' && m.confirmNew
          ? ['Press N again to erase your save and start over', 'Esc: cancel']
          : saved
            ? ['Enter: continue', 'N: new game   I: import save   O: settings']
            : ['Enter: new game', 'I: import save   O: settings'];
      const perks = perkLines(this.profile.bestLearned);
      drawTitle(r, lines, [this.learnedLine(), perks.length > 0 ? `Perks: ${perks.join(', ')}` : 'Perks: none yet. Learn words at the bonfire.'], this.titleError);
      return;
    }
    if (m.kind === 'fight') {
      if (m.boss?.cardUntil !== null && m.boss?.cardUntil !== undefined) {
        this.drawPhaseCard(r, nowMs, m.boss);
        return;
      }
      const view = m.fight.render(r, nowMs);
      if (view.phase === 'won' || view.phase === 'lost') {
        const won = view.phase === 'won';
        const more = won && m.boss && m.boss.index + 1 < m.boss.def.phases.length;
        const title = won ? (more ? `PHASE ${(m.boss?.index ?? 0) + 1} BROKEN` : m.boss ? 'THE BELL FALLS SILENT' : 'FOE DEFEATED') : 'YOU DIED';
        r.text(title, 160, 60, { size: 14, align: 'center', color: won ? C.signal : C.hurt, outline: C.void, maxWidth: 300 });
        r.text(more ? 'Press Enter for the next phase' : 'Press Enter', 160, 78, { size: 7, align: 'center', color: C.dim, outline: C.void });
      }
      return;
    }
    const seals = this.seals();
    const perks = this.perks();
    if (m.kind === 'review') {
      m.review.render(r, this.learnedLine(), nowMs);
      return;
    }
    if (m.kind === 'map') {
      drawMap(r, {
        rooms: this.zone.rooms,
        layout: this.layout,
        visited: g.visited,
        walked: g.walked,
        current: g.room,
        ghosts: g.ghosts,
        echoRoom: g.echo?.room ?? null,
        wardens: Object.fromEntries(
          this.zone.rooms.flatMap((room) => (this.zone.wardenSeal(room.id) ? [[room.id, g.wardensBeaten.includes(room.id)]] : [])),
        ),
        lines: [
          `${this.deps.dev ? `Day ${this.day}   ` : ''}XP ${g.xp}   Flasks ${g.flasks}   Seals: ${socketLine(seals)}`,
          this.learnedLine(),
          'M / Esc: back    E: export save    I: import save',
        ],
      });
      return;
    }

    const room = this.zone.room(g.room);
    const exits: Partial<Record<Direction, ExitLook>> = {};
    for (const [dir, exit] of Object.entries(room.exits) as [Direction, (typeof room.exits)[Direction]][]) {
      if (exit === undefined) continue;
      if (exit === BACK && !g.cameFrom) continue;
      if (typeof exit === 'object' && exit.locked && !g.openDoors.includes(exit.locked)) exits[dir] = 'locked';
      else if (typeof exit === 'object' && exit.gate) exits[dir] = seals.open ? 'gateOpen' : 'sealed';
      else exits[dir] = 'open';
    }
    if (Object.keys(room.exits).length === 0 && g.cameFrom) exits.south = 'open';
    const alive = enemyAlive(g, this.zone, g.room);
    const boss = bossAlive(g, this.zone, g.room) ? bossIn(this.zone, g.room) : null;
    // Reduced motion: rooms cut instead of fading in.
    const fade = !this.svc.settings.reducedMotion && nowMs - this.enteredAt < ROOM_TRANSITION_MS ? (nowMs - this.enteredAt) / ROOM_TRANSITION_MS : null;
    const hint = alive || boss ? 'Enter: fight   M: map' : room.contents.bonfire ? 'Enter: rest   M: map' : (g.ghosts[g.room]?.length ?? 0) > 0 ? 'Enter: face a ghost   M: map' : 'Arrows: walk   M: map';
    const warden = this.zone.wardenSeal(g.room);
    const enemyId = room.contents.enemy?.id ?? 'enemy';
    const name = enemyLabel(enemyId);
    drawRoom(r, this.svc.sprites, nowMs, {
      room,
      exits,
      enemy: boss
        ? { name: boss.name, character: boss.id, warden: false }
        : alive
          ? { name: warden ? `${name}: warden of the ${this.zone.seals[warden]?.name_en ?? warden}` : name, character: enemyId, warden: warden !== null }
          : null,
      bossBeaten: room.contents.boss !== undefined && !boss,
      ghosts: g.ghosts[g.room]?.length ?? 0,
      echo: g.echo && g.echo.room === g.room ? g.echo : null,
      readingGoal: room.contents.reading && !g.readingsDone.includes(g.room) ? room.contents.reading.goal_en : null,
      hud: { vitality: g.vitality, vitalityMax: perks.vitalityMax, flasks: g.flasks, xp: g.xp, seals, day: this.deps.dev ? this.day : null },
      hint,
      message: this.message,
      fade,
      calm: this.svc.settings.reducedMotion,
    });
    this.svc.cues.draw(r, nowMs, 312, 40);
  }

  /**
   * Title card before each boss phase (with its sound, the visual twin of the bell). A phase
   * with a battle cry shows the boss raising its maul, shaking as it shouts (still with reduced
   * motion), and the cry in Spanish with its English line under it.
   */
  private drawPhaseCard(r: Renderer, nowMs: number, boss: NonNullable<FightMode['boss']>): void {
    const phase = boss.def.phases[boss.index];
    const calm = this.svc.settings.reducedMotion;
    r.begin(C.bossDeep);
    drawArena(r, nowMs, 'boss', calm, this.svc.sprites);
    const head = `PHASE ${boss.index + 1} OF ${boss.def.phases.length}`;
    if (phase?.cry) {
      const shaking = !calm && nowMs - boss.cardFrom < CRY_SHAKE_MS;
      const dx = shaking ? Math.round(Math.sin(nowMs / 25) * HIT_SHAKE_PX) : 0;
      this.svc.sprites.draw(r.low, boss.def.id, { tag: 'windup', frame: 5, flip: false }, 160 + dx, 108);
      r.low.fillStyle = 'rgba(11,13,18,0.8)';
      r.low.fillRect(0, 112, 320, 62);
      r.present();
      r.text(`${head} · ${phase.name}`, 160, 118, { size: 6, align: 'center', color: C.dim, outline: C.void });
      // One exclamation per line: «¡Escucha!» / «¡La campana dobla por ti!»
      phase.cry.es.split(/(?<=!)\s+(?=¡)/).forEach((line, i) => r.text(line, 160 + dx, 132 + i * 14, { size: 12, align: 'center', color: C.signal, outline: C.void, maxWidth: 312 }));
      r.text(phase.cry.en, 160, 162, { size: 6, align: 'center', color: C.text, outline: C.void });
      r.text('Enter to begin', 160, 172, { size: 6, align: 'center', color: C.dim });
      this.svc.cues.draw(r, nowMs, 312, 104);
      return;
    }
    r.low.fillStyle = 'rgba(11,13,18,0.75)';
    r.low.fillRect(0, 40, 320, 80);
    r.present();
    r.text(boss.def.name.toUpperCase(), 160, 54, { size: 8, align: 'center', color: C.dim, outline: C.void });
    r.text(head, 160, 72, { size: 14, align: 'center', color: C.signal, outline: C.void });
    r.text(phase?.name ?? '', 160, 90, { size: 8, align: 'center', outline: C.void, maxWidth: 300 });
    r.text('Enter to begin', 160, 114, { size: 6, align: 'center', color: C.dim });
    this.svc.cues.draw(r, nowMs, 312, 132);
  }

}
