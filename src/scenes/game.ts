// The game: title, exploration of the zone graph, fights, bonfire rest and review, map, and
// saving. Rules live in the pure modules (world/, learning/, save/); this scene wires them to
// input, the clock, the renderer and localStorage.
import { cardRepresentable, zoneComponents } from '../content/components';
import { createRng } from '../content/rng';
import type { Direction } from '../content/types';
import { Encounter } from '../combat/encounter';
import { gateProgress, type GateProgress } from '../learning/gate';
import { recordAnswer } from '../learning/learner';
import { createPicker, reviewQuestion, reviewTargets } from '../learning/picker';
import type { DayClock } from '../platform/clock';
import { downloadText, pickTextFile } from '../platform/files';
import type { InputEvent } from '../platform/input';
import type { Renderer } from '../platform/renderer';
import type { RiposteInput } from '../platform/riposteInput';
import type { SaveStore } from '../save/store';
import { GHOST_HP, GHOST_STANCE_MAX, PLAYER_VITALITY, REVIEW_ROUND_SIZE, ROOM_TRANSITION_MS } from '../tuning';
import {
  addGhosts,
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
import { C, Fight } from './fight';
import { Review } from './review';
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
}

type Mode = { kind: 'title'; confirmNew: boolean } | { kind: 'explore' } | FightMode | { kind: 'review'; review: Review } | { kind: 'map' };

const MESSAGE_MS = 4000;

function enemyLabel(id: string): string {
  const s = id.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface GameDeps {
  riposte: RiposteInput;
  setTextMode: (on: boolean) => void;
  store: SaveStore;
  clock: DayClock;
  /** Dev builds only: F8 skips a day, F9 marks the zone Learned. */
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

  constructor(private readonly deps: GameDeps) {
    const loaded = deps.store.load();
    this.saved = loaded.game;
    this.titleError = loaded.error ? `Saved game unreadable: ${loaded.error}` : null;
    if (loaded.game && !this.zone.has(loaded.game.bonfire)) this.titleError = 'Saved game is from another map version.';
  }

  // --- helpers ---------------------------------------------------------------

  private get day(): number {
    return this.deps.clock.today();
  }

  private gate(): GateProgress {
    return gateProgress(this.game?.learner ?? { components: {} }, this.universe);
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
    this.say(`You wake by the bonfire. Learned ${this.gate().learned}/${this.gate().total}.`, 'Enter: rest and review.  M: map.');
  }

  private exportSave(): void {
    if (!this.game) return;
    const date = new Date(this.deps.clock.nowMs()).toISOString().slice(0, 10);
    downloadText(`lingua-dark-save-${date}.json`, this.deps.store.exportText(this.game, this.deps.clock.nowMs()));
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
      this.startGame(r.game);
      this.say('Save imported. You wake by the bonfire.');
    });
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
        m.review.update(events);
        if (m.review.finished) {
          m.review.dispose();
          this.save();
          this.mode = { kind: 'explore' };
          const g = this.gate();
          this.say(`Learned ${g.learned}/${g.total}. The gate needs ${g.needed}.`);
        }
        break;
    }
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
    const g = newGame(this.zone, this.deps.clock.nowMs() >>> 0);
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
        g.learner = recordAnswer(recordAnswer(g.learner, this.universe, true, 'review', this.day - 1), this.universe, true, 'review', this.day);
        this.save();
        this.say('Dev: every Zone 1 component marked Learned.');
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
      return;
    }
    let res = resolveExit(this.zone, g.room, dir, { cameFrom: g.cameFrom, openDoors: g.openDoors, gateOpen: this.gate().open });
    // The boss arena has no exits yet; ↓ walks back out (DECISIONS #66).
    if (res.kind === 'none' && Object.keys(room.exits).length === 0 && dir === 'south' && g.cameFrom) {
      res = { kind: 'move', to: g.cameFrom, opens: null };
    }
    switch (res.kind) {
      case 'none':
        this.say('There is no way through there.');
        return;
      case 'locked':
        this.say('The door is barred. It does not open from this side.');
        return;
      case 'gate': {
        const p = this.gate();
        this.say('The gate is sealed. Only those who know the words may pass.', `Learned ${p.learned}/${p.total}. It opens at ${p.needed}.`);
        return;
      }
      case 'move': {
        const lines: string[] = [];
        const reading = chooseReading(g, this.zone, dir, this.day);
        if (reading) lines.push(reading.correct ? 'You read the sign right.' : reading.damage > 0 ? `A wrong turn. An ambush! −${reading.damage}` : 'A wrong turn: a detour.');
        walk(g, res.to, res.opens);
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
    if (echo) out.push(`Your echo lies here (${echo.xp} XP). Beat ${echo.killer === 'enemy' ? 'the foe that killed you' : 'the ghost'} to take it back.`);
    const ghosts = g.ghosts[g.room]?.length ?? 0;
    if (ghosts > 0 && !enemyAlive(g, this.zone, g.room)) out.push(`${ghosts} ghost${ghosts > 1 ? 's' : ''} of missed words linger. Enter to face one.`);
    if (room.contents.reading && !g.readingsDone.includes(g.room)) out.push(`Goal: ${room.contents.reading.goal_en}`);
    return out;
  }

  // --- fights ----------------------------------------------------------------

  private startFight(g: GameState, foe: FoeKey): void {
    const rng = createRng(nextFightSeed(g));
    const ghost = ghostComponent(foe);
    const echo = echoAt(g, g.room, foe);
    const picker = createPicker({
      rng: createRng(rng.nextSeed()),
      target: ghost ?? echo?.target ?? null,
      learner: () => ({ state: g.learner, day: this.day }),
      among: this.universe,
    });
    const enc = new Encounter(picker, {
      zone: g.zone,
      vitality: g.vitality,
      vitalityMax: PLAYER_VITALITY,
      flaskRng: createRng(rng.nextSeed()),
      ...(ghost ? { enemyHp: GHOST_HP, stanceMax: GHOST_STANCE_MAX } : {}),
    });
    const label = ghost ? 'Ghost' : enemyLabel(this.zone.room(g.room).contents.enemy?.id ?? 'enemy');
    const fight = new Fight(enc, this.deps.riposte, this.deps.setTextMode, {
      label,
      ghost: ghost !== null,
      flasks: { count: () => g.flasks, spend: () => (g.flasks = Math.max(0, g.flasks - 1)) },
      ...(echo ? { note: `ECHO ${echo.xp} XP` } : {}),
    });
    fight.start(this.now);
    this.mode = { kind: 'fight', fight, foe, room: g.room, missed: [], lastMiss: null };
    this.message = [];
  }

  private updateFight(m: FightMode, nowMs: number, events: InputEvent[]): void {
    const g = this.game;
    if (!g) return;
    if (m.fight.finished) {
      if (events.some((ev) => ev.type === 'confirm' || ev.type === 'point')) this.endFight(g, m);
      return;
    }
    for (const ev of events) m.fight.handle(ev);
    m.fight.update(nowMs);
    for (const rec of m.fight.drainLog()) {
      const parried = rec.result === 'parry';
      g.learner = recordAnswer(g.learner, rec.components, parried, 'combat', this.day, { assisted: rec.assisted });
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
      const { recovered } = winFight(g, m.room, m.foe);
      addGhosts(g, m.room, m.missed.filter((c) => c !== ghost));
      const lines = [ghost ? 'The ghost fades.' : 'The foe falls.'];
      if (recovered > 0) lines.push(`Echo recovered: +${recovered} XP.`);
      const ghosts = g.ghosts[m.room]?.length ?? 0;
      if (ghosts > 0) lines.push(`${ghosts} ghost${ghosts > 1 ? 's' : ''} of missed words linger here.`);
      this.say(...lines);
    } else {
      addGhosts(g, m.room, m.missed);
      const xp = g.xp;
      die(g, m.foe, m.lastMiss);
      this.say('YOU DIED. You wake by the bonfire.', xp > 0 ? `Your echo (${xp} XP) waits where you fell.` : 'You carried no XP.');
    }
    this.save();
    this.mode = { kind: 'explore' };
    this.enteredAt = this.now;
  }

  // --- bonfire ---------------------------------------------------------------

  private restAt(g: GameState): void {
    rest(g, g.room);
    const rng = createRng(nextFightSeed(g));
    const day = this.day;
    const targets = reviewTargets(g.learner, this.universe, day, REVIEW_ROUND_SIZE, rng);
    const questions = targets.flatMap((t) => reviewQuestion(rng, t) ?? []);
    this.save();
    const review = new Review(
      questions,
      this.deps.riposte,
      this.deps.setTextMode,
      (q, correct) => {
        g.learner = recordAnswer(g.learner, q.components, correct, 'review', day);
        this.save();
      },
      g.zone <= 1,
    );
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
            ? ['Enter: continue', 'N: new game   I: import save']
            : ['Enter: new game', 'I: import save'];
      drawTitle(r, lines, this.titleError);
      return;
    }
    if (m.kind === 'fight') {
      const view = m.fight.render(r, nowMs);
      if (view.phase === 'won' || view.phase === 'lost') {
        const won = view.phase === 'won';
        r.text(won ? 'FOE DEFEATED' : 'YOU DIED', 160, 60, { size: 14, align: 'center', bold: true, color: won ? C.signal : C.hurt });
        r.text('Press Enter', 160, 78, { size: 7, align: 'center', color: C.dim });
      }
      return;
    }
    const gate = this.gate();
    if (m.kind === 'review') {
      m.review.render(r, `Learned ${gate.learned}/${gate.total}. The boss gate opens at ${gate.needed}.`);
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
        lines: [
          `${this.deps.dev ? `Day ${this.day}   ` : ''}XP ${g.xp}   Flasks ${g.flasks}   Learned ${gate.learned}/${gate.total} (gate opens at ${gate.needed})`,
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
      else if (typeof exit === 'object' && exit.gate) exits[dir] = gate.open ? 'gateOpen' : 'sealed';
      else exits[dir] = 'open';
    }
    if (Object.keys(room.exits).length === 0 && g.cameFrom) exits.south = 'open';
    const alive = enemyAlive(g, this.zone, g.room);
    const fade = nowMs - this.enteredAt < ROOM_TRANSITION_MS ? (nowMs - this.enteredAt) / ROOM_TRANSITION_MS : null;
    const hint = alive ? 'Enter: fight   M: map' : room.contents.bonfire ? 'Enter: rest   M: map' : (g.ghosts[g.room]?.length ?? 0) > 0 ? 'Enter: face a ghost   M: map' : 'Arrows: walk   M: map';
    drawRoom(r, {
      room,
      exits,
      enemyName: alive ? enemyLabel(room.contents.enemy?.id ?? 'enemy') : null,
      ghosts: g.ghosts[g.room]?.length ?? 0,
      echo: g.echo && g.echo.room === g.room ? g.echo : null,
      readingGoal: room.contents.reading && !g.readingsDone.includes(g.room) ? room.contents.reading.goal_en : null,
      hud: { vitality: g.vitality, vitalityMax: PLAYER_VITALITY, flasks: g.flasks, xp: g.xp, gate, day: this.deps.dev ? this.day : null },
      hint,
      message: this.message,
      fade,
    });
  }
}
