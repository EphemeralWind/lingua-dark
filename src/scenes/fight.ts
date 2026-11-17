// One fight on screen: an Encounter drawn with sprites, riposte typing, flasks, sound cues and
// speech. Used by the practice scene, the world and the boss.
//
// Every figure is drawn from `view.animation` through src/combat/sprites.ts: during a wind-up
// that is one shared animation driven by progress alone, the same for every question and
// direction (CLAUDE.md non-negotiable 1). Card text and marks come from `view.cards`; marks
// exist only after resolution, greyed cards only after a flask. Sounds come from cuesBetween(),
// which reads the same view. Speech never says a blank's answer before it is revealed.
import { cuesBetween } from '../combat/cues';
import type { Encounter } from '../combat/encounter';
import { enemyFrame, playerFrame } from '../combat/sprites';
import type { AttackType, ExchangeRecord } from '../combat/types';
import { viewOf, type Animation, type CardText, type EncounterView } from '../combat/view';
import type { Direction, Question } from '../content/types';
import type { InputEvent } from '../platform/input';
import { C } from '../platform/palette';
import type { Renderer } from '../platform/renderer';
import { HIT_SHAKE_PX, RESOLVE_MS } from '../tuning';
import type { Services } from './services';

export { C };

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cards at the four cardinal points around the enemy (SPEC 2). */
export const CARD_RECTS: Record<Direction, Rect> = {
  north: { x: 100, y: 30, w: 120, h: 14 },
  east: { x: 216, y: 66, w: 98, h: 14 },
  south: { x: 100, y: 112, w: 120, h: 14 },
  west: { x: 6, y: 66, w: 98, h: 14 },
};

const ARROW: Record<Direction, string> = { north: '↑', east: '→', south: '↓', west: '←' };
export const UNIT: Record<Direction, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

const ENEMY_X = 160;
const ENEMY_BOTTOM = 108;
const ENEMY_MID_Y = 76;
const PLAYER_BOTTOM = 186;
/** Where the strike meets the shield, per direction. */
const contact = (d: Direction): { x: number; y: number } => ({ x: ENEMY_X + UNIT[d].x * 34, y: ENEMY_MID_Y + UNIT[d].y * 30 });

const ATTACK_LABEL: Record<AttackType, string> = {
  jab: 'JAB',
  overhead: 'OVERHEAD',
  delayed: 'DELAYED',
  grab: 'GRAB',
  sweep: 'SWEEP',
  combo: 'COMBO',
};

export function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** The sentence with each blank filled by its strike's answer, for speech after it is revealed. */
export function completed(q: Question): string {
  let i = 0;
  return q.sentence.replace(/_{2,}/g, () => {
    const s = q.strikes[i++];
    return s ? s.options[s.correct] : '…';
  });
}

export interface FightOptions {
  /** Name on the HUD, e.g. "Hollow villager". */
  label: string;
  /** Sprite character id (src/platform/characters.ts). */
  character: string;
  /** Flask supply owned by the caller; omit for no flasks. */
  flasks?: { count(): number; spend(): void; /** Wrong cards one flask greys out. */ power: number };
  /** Extra HUD line, e.g. that an echo waits on this foe. */
  note?: string;
  /** Blind round: no enemy, no attack icon, no strike animation (SPEC 3.7). */
  blind?: boolean;
  /** Arena look: the boss arena has its own palette and silhouettes. */
  arena?: 'village' | 'boss';
}

export class Fight {
  private riposteOpen = false;
  private riposteFields: string[] = [];
  private pendingSubmit = false;
  private logged = 0;
  private prevView: EncounterView | null = null;
  private endedAt: number | null = null;
  private lastSpokenStrike: string | null = null;

  constructor(
    readonly enc: Encounter,
    private readonly svc: Services,
    private readonly opts: FightOptions,
  ) {}

  get finished(): boolean {
    return this.enc.finished;
  }

  get won(): boolean {
    return this.enc.state.kind === 'won';
  }

  get blind(): boolean {
    return this.opts.blind ?? false;
  }

  start(nowMs: number): void {
    this.enc.untimed = this.svc.settings.hollow;
    this.enc.start(nowMs);
  }

  /** Strikes resolved since the last call. */
  drainLog(): ExchangeRecord[] {
    const out = this.enc.log.slice(this.logged);
    this.logged = this.enc.log.length;
    return out;
  }

  handle(ev: InputEvent): void {
    if (this.enc.finished) return;
    if (ev.type === 'direction') {
      this.enc.lockIn(ev.dir, ev.atMs);
    } else if (ev.type === 'point') {
      for (const dir of Object.keys(CARD_RECTS) as Direction[]) {
        if (inside(CARD_RECTS[dir], ev.x, ev.y)) this.enc.lockIn(dir, ev.atMs);
      }
    } else if (ev.type === 'key' && ev.code === 'KeyF') {
      const f = this.opts.flasks;
      if (f && f.count() > 0 && this.enc.useFlask()) f.spend();
    } else if (ev.type === 'key' && ev.code === 'KeyR') {
      this.svc.speech.repeat();
    }
  }

  update(nowMs: number): void {
    // Hollow mode can be switched in the settings menu mid-fight.
    this.enc.untimed = this.svc.settings.hollow;
    if (this.pendingSubmit) {
      this.pendingSubmit = false;
      this.enc.submitRiposte(this.riposteFields, nowMs);
      this.closeRiposte();
    }
    this.enc.tick(nowMs);
    if (this.enc.state.kind === 'riposte' && !this.riposteOpen) this.openRiposte();

    const view = viewOf(this.enc, nowMs);
    for (const cue of cuesBetween(this.prevView, view)) this.svc.cues.play(cue, nowMs);
    if ((view.phase === 'won' || view.phase === 'lost') && this.endedAt === null) this.endedAt = nowMs;
    this.speakFor(view);
    this.prevView = view;
  }

  /**
   * Speech. A sentence is spoken whole only once every blank is revealed: after the last strike
   * of a question that did not break stance (a break leads to the riposte, which asks for those
   * words), or after the riposte verdict. In a blind round the sentence is also read out, with
   * pauses for its blanks, when its wind-up opens: the same words that are on screen.
   */
  private speakFor(view: EncounterView): void {
    const s = this.enc.state;
    const key = (q: Question, strike: number, what: string): string => `${q.id}#${q.seed}:${strike}:${what}`;
    let line: string | null = null;
    let k: string | null = null;
    if (s.kind === 'windup' && this.blind && s.strike === 0 && view.prompt) {
      k = key(s.question, s.strike, `ask${this.enc.log.length}`);
      line = s.question.sentence;
    } else if (s.kind === 'resolving' && !s.stanceBroken && s.strike === s.question.strikes.length - 1) {
      k = key(s.question, s.strike, `done${this.enc.log.length}`);
      line = completed(s.question);
    } else if (s.kind === 'riposteResult') {
      k = key(s.question, 0, `riposte${this.enc.log.length}`);
      line = completed(s.question);
    }
    if (line && k !== this.lastSpokenStrike) {
      this.lastSpokenStrike = k;
      this.svc.speech.speak(line);
    }
  }

  /**
   * Public state for tests: phase, the question tag (id and seed, also printed on screen for
   * bug reports) and the blank index. Never the answer (DECISIONS #35).
   */
  publishTestState(): void {
    const ds = document.body.dataset;
    const s = this.enc.state;
    ds['phase'] = s.kind;
    if (s.kind === 'windup') {
      ds['question'] = `${s.question.id}#${s.question.seed}`;
      ds['strike'] = String(s.strike);
      ds['deadline'] = String(s.deadlineMs);
    }
  }

  /** Closes the riposte field if the fight is torn down mid-riposte. */
  dispose(): void {
    if (this.riposteOpen) this.closeRiposte();
  }

  private openRiposte(): void {
    this.riposteOpen = true;
    this.riposteFields = [];
    this.svc.setTextMode(true);
    this.svc.riposte.open(() => {
      const s = this.enc.state;
      if (s.kind !== 'riposte' || this.pendingSubmit) return;
      this.riposteFields.push(this.svc.riposte.value);
      this.svc.riposte.clear();
      if (this.riposteFields.length >= s.question.strikes.length) this.pendingSubmit = true;
    });
  }

  private closeRiposte(): void {
    this.riposteOpen = false;
    this.svc.riposte.close();
    this.svc.setTextMode(false);
  }

  // --- rendering ------------------------------------------------------------

  /** Draws the fight. `active` is false on a title card before the first wind-up. */
  render(r: Renderer, nowMs: number, active = true): EncounterView {
    const view = viewOf(this.enc, nowMs);
    const a = view.animation;
    const calm = this.svc.settings.reducedMotion;
    r.begin(C.sky);
    drawArena(r, nowMs, this.opts.arena ?? 'village', calm);
    if (!this.blind) this.drawEnemy(r, a, nowMs);
    else drawFog(r);
    this.drawPlayer(r, a, nowMs, calm);
    if (active) {
      this.drawEffects(r, a, calm);
      this.drawCards(r, view.cards);
      this.drawBars(r, view);
      // Prompt band: high contrast behind the 2x prompt.
      r.low.fillStyle = C.void;
      r.low.fillRect(0, 0, 320, 28);
      if (view.riposte) {
        r.low.fillStyle = C.barBack;
        r.low.fillRect(14, 36, 292, 62);
        r.low.fillStyle = C.cardEdge;
        r.low.fillRect(14, 36, 292, 1);
        r.low.fillRect(14, 97, 292, 1);
      }
      this.drawDeadline(r, a);
    }
    r.present();
    if (!active) return view;

    this.drawCardText(r, view.cards);
    this.drawHudText(r, view);
    if (view.prompt) {
      const speaking = this.svc.speech.speaking ? '♪ ' : '';
      r.text(speaking + view.prompt.sentence, 160, 10, { size: 12, align: 'center', maxWidth: 312 });
      const steps: string[] = [];
      if (view.prompt.strikeCount > 1) steps.push(`blank ${view.prompt.strike + 1}/${view.prompt.strikeCount}`);
      r.text(view.prompt.prompt + (steps.length ? `   [${steps.join(', ')}]` : ''), 160, 22, { size: 6, align: 'center', color: C.dim, maxWidth: 312 });
    }
    if (view.riposte) this.drawRiposte(r, view);
    this.svc.cues.draw(r, nowMs, 312, view.riposte ? 104 : 50);
    return view;
  }

  private drawEnemy(r: Renderer, a: Animation, nowMs: number): void {
    const f = enemyFrame(a, { nowMs, sinceEndMs: this.endedAt === null ? 0 : nowMs - this.endedAt });
    this.svc.sprites.draw(r.low, this.opts.character, f, ENEMY_X, ENEMY_BOTTOM);
  }

  private drawPlayer(r: Renderer, a: Animation, nowMs: number, calm: boolean): void {
    const f = playerFrame(a, { nowMs, sinceEndMs: this.endedAt === null ? 0 : nowMs - this.endedAt });
    // Hit shake, after the hit-stop; none with reduced motion.
    const shake = a.playerPose === 'hit' && !a.frozen && !calm ? Math.round(Math.sin(a.progress * 24) * HIT_SHAKE_PX) : 0;
    this.svc.sprites.draw(r.low, 'player', f, 160 + shake, PLAYER_BOTTOM);
  }

  /**
   * Parry and hit effects. The 3-frame flash and the hit-stop come from the Animation. A clean
   * (high-quality) parry adds a four-point star: a distinct shape, not just a colour. With
   * reduced motion there is no flash: the ring and star stay steady through the resolve.
   */
  private drawEffects(r: Renderer, a: Animation, calm: boolean): void {
    if (!a.resolved || !a.toward) return;
    const g = r.low;
    const elapsedMs = a.frozen ? 0 : a.progress * RESOLVE_MS;
    const p = contact(a.toward);
    if (a.resolved === 'hit') {
      if (a.flash === 'hit' && !calm) {
        g.fillStyle = 'rgba(200,90,90,0.28)';
        g.fillRect(0, 0, 320, 180);
      }
      if (elapsedMs < 300 || calm) {
        // A cross over the player: the hit, by shape.
        g.fillStyle = C.hurt;
        for (let i = 0; i < 14; i++) {
          g.fillRect(153 + i, 132 + i, 2, 2);
          g.fillRect(166 - i, 132 + i, 2, 2);
        }
      }
      return;
    }
    if ((a.flash === 'parry' || a.flash === 'perfect') && !calm) {
      g.fillStyle = 'rgba(242,230,160,0.35)';
      g.fillRect(0, 0, 320, 180);
    }
    const ringShown = calm ? true : a.flash !== 'none' || a.frozen;
    if (ringShown) {
      g.fillStyle = C.signal;
      const s = 9;
      g.fillRect(p.x - s, p.y - s, s * 2, 2);
      g.fillRect(p.x - s, p.y + s - 2, s * 2, 2);
      g.fillRect(p.x - s, p.y - s, 2, s * 2);
      g.fillRect(p.x + s - 2, p.y - s, 2, s * 2);
    }
    if (a.resolved === 'perfect' && (calm || elapsedMs < 320)) {
      // Four-point star around the contact point.
      g.fillStyle = C.signal;
      for (let i = 0; i < 14; i++) {
        const w = Math.max(1, 5 - Math.floor(i / 3));
        g.fillRect(p.x - Math.floor(w / 2), p.y - 15 + i, w, 1);
        g.fillRect(p.x - Math.floor(w / 2), p.y + 15 - i, w, 1);
        g.fillRect(p.x - 15 + i, p.y - Math.floor(w / 2), 1, w);
        g.fillRect(p.x + 15 - i, p.y - Math.floor(w / 2), 1, w);
      }
      g.fillStyle = C.void;
      g.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
  }

  private drawCards(r: Renderer, cards: CardText[]): void {
    const g = r.low;
    for (const c of cards) {
      const b = CARD_RECTS[c.dir];
      g.fillStyle = c.mark === 'correct' ? C.signal : c.mark === 'wrongPick' ? C.hurt : c.greyed ? C.barBack : C.cardEdge;
      g.fillRect(b.x, b.y, b.w, b.h);
      // Correct: thick border. Wrong pick: thin border. Plus ✓ / ✗ marks (not colour alone).
      const inset = c.mark === 'correct' ? 2 : 1;
      g.fillStyle = c.greyed ? C.sky : C.card;
      g.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
      if (c.greyed) {
        g.fillStyle = C.enemyDark;
        g.fillRect(b.x + 3, b.y + Math.floor(b.h / 2), b.w - 6, 1);
      }
      // Arrow tab on the outer edge, pointing where the key sends you.
      g.fillStyle = c.greyed ? C.enemyDark : C.cardEdge;
      const u = UNIT[c.dir];
      const tipX = u.x === 0 ? b.x + b.w / 2 : u.x > 0 ? b.x + b.w + 4 : b.x - 5;
      const tipY = u.y === 0 ? b.y + b.h / 2 : u.y > 0 ? b.y + b.h + 4 : b.y - 5;
      for (let i = 0; i < 4; i++) {
        if (u.x === 0) g.fillRect(Math.round(tipX - i), Math.round(tipY - u.y * i), i * 2 + 1, 1);
        else g.fillRect(Math.round(tipX - u.x * i), Math.round(tipY - i), 1, i * 2 + 1);
      }
    }
  }

  private drawCardText(r: Renderer, cards: CardText[]): void {
    for (const c of cards) {
      const b = CARD_RECTS[c.dir];
      const mark = c.mark === 'correct' ? '✓' : c.mark === 'wrongPick' ? '✗' : c.greyed ? '·' : ARROW[c.dir];
      r.text(mark, b.x + 7, b.y + b.h / 2, { size: 6, align: 'center', color: c.mark === 'none' ? C.dim : C.text });
      const color = c.greyed ? C.enemyDark : C.text;
      r.text(c.text, b.x + b.w / 2 + 5, b.y + b.h / 2, { size: 8, align: 'center', maxWidth: b.w - 18, color });
    }
  }

  private drawDeadline(r: Renderer, a: Animation): void {
    const t = a.timerLeft;
    if (t === null) return;
    // A thin bar under the prompt, shrinking toward the centre.
    const g = r.low;
    const half = Math.round(150 * t);
    g.fillStyle = C.barBack;
    g.fillRect(10, 26, 300, 2);
    g.fillStyle = C.text;
    g.fillRect(160 - half, 26, half * 2, 2);
  }

  private drawBars(r: Renderer, view: EncounterView): void {
    const g = r.low;
    const bar = (x: number, y: number, w: number, h: number, frac: number, color: string): void => {
      g.fillStyle = C.void;
      g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = C.barBack;
      g.fillRect(x, y, w, h);
      g.fillStyle = color;
      g.fillRect(x, y, Math.round(w * Math.min(1, Math.max(0, frac))), h);
    };
    const h = view.hud;
    bar(130, 108, 60, 3, h.stance / h.stanceMax, C.signal); // stance, under the enemy
    bar(236, 167, 76, 4, h.enemyHp / h.enemyHpMax, C.hurt);
    bar(8, 167, 76, 4, h.vitality / h.vitalityMax, C.ember);
    if (!this.blind) this.drawAttackIcon(r, h.attack);
  }

  /** Attack-type icon: a distinct shape per type, nothing about the answer. */
  private drawAttackIcon(r: Renderer, attack: AttackType | null): void {
    if (!attack) return;
    const g = r.low;
    const x = 8;
    const y = 32;
    g.fillStyle = C.void;
    g.fillRect(x - 2, y - 2, 14, 14);
    g.fillStyle = C.dim;
    switch (attack) {
      case 'jab':
        g.fillRect(x, y + 4, 10, 2);
        g.fillRect(x + 8, y + 2, 2, 6);
        break;
      case 'overhead':
        g.fillRect(x + 4, y, 2, 10);
        g.fillRect(x + 1, y, 8, 2);
        break;
      case 'delayed':
        g.fillRect(x, y, 10, 2);
        g.fillRect(x, y + 8, 10, 2);
        g.fillRect(x + 4, y + 2, 2, 6);
        break;
      case 'combo':
        g.fillRect(x, y + 2, 3, 6);
        g.fillRect(x + 4, y + 2, 3, 6);
        g.fillRect(x + 8, y + 2, 3, 6);
        break;
      case 'grab':
        g.fillRect(x, y, 2, 10);
        g.fillRect(x + 8, y, 2, 10);
        g.fillRect(x, y + 8, 10, 2);
        break;
      case 'sweep':
        g.fillRect(x, y + 8, 10, 2);
        g.fillRect(x, y + 4, 2, 4);
        break;
    }
  }

  private drawHudText(r: Renderer, view: EncounterView): void {
    const h = view.hud;
    const o = { outline: C.void };
    if (this.blind) r.text('BLIND: read or listen  (R: repeat)', 8, 36, { size: 6, color: C.signal, ...o });
    else if (h.attack) r.text(ATTACK_LABEL[h.attack], 22, 36, { size: 6, color: C.dim, ...o });
    const chain = view.prompt && view.prompt.chainLength > 1 ? `FLURRY ${view.prompt.chainIndex + 1}/${view.prompt.chainLength}` : null;
    if (chain) r.text(chain, 8, 48, { size: 6, color: C.dim, ...o });
    if (this.svc.settings.hollow && view.phase === 'windup') r.text('HOLLOW: no timer', 8, chain ? 58 : 48, { size: 5, color: C.dim, ...o });
    r.text(`VITALITY ${Math.ceil(h.vitality)}`, 8, 161, { size: 6, color: C.dim, ...o });
    r.text(`${this.opts.label.toUpperCase()} ${Math.ceil(h.enemyHp)}`, 312, 161, { size: 6, color: C.dim, align: 'right', maxWidth: 150, ...o });
    if (this.opts.flasks) {
      const left = this.opts.flasks.count();
      const canUse = view.phase === 'windup' && left > 0;
      r.text(`FLASKS ${left} (−${this.opts.flasks.power})${canUse ? '  [F]' : ''}`, 8, 176, { size: 6, color: canUse ? C.ember : C.dim, ...o });
    }
    if (this.opts.note) r.text(this.opts.note, 312, 176, { size: 6, color: C.signal, align: 'right', ...o });
    r.text('STANCE', 194, 109.5, { size: 5, color: C.dim, ...o });
    if (view.prompt && !this.opts.note) r.text(view.prompt.tag, 312, 177, { size: 4, color: C.cardEdge, align: 'right' });
  }

  private drawRiposte(r: Renderer, view: EncounterView): void {
    const rp = view.riposte;
    if (!rp) return;
    r.text('RIPOSTE: type the missing words', 160, 10, { size: 10, align: 'center', color: C.signal });
    r.text(rp.prompt, 160, 22, { size: 6, align: 'center', color: C.dim, maxWidth: 312 });

    let i = 0;
    const filled = rp.sentence.replace(/_{2,}/g, () => {
      const idx = i++;
      if (rp.results) {
        const res = rp.results[idx];
        return res ? `[${res.answer}]` : '___';
      }
      if (idx < this.riposteFields.length) return `[${this.riposteFields[idx] ?? ''}]`;
      if (idx === this.riposteFields.length) return `[${this.svc.riposte.value}▌]`;
      return '___';
    });
    r.text(filled, 160, 48, { size: 10, align: 'center', maxWidth: 284 });

    if (rp.results) {
      rp.results.forEach((res, k) => {
        const line =
          res.verdict === 'exact'
            ? `✓ ${res.answer}`
            : res.verdict === 'accent'
              ? `≈ ${res.typed} → ${res.answer} (mind the accent)`
              : `✗ ${res.typed || '(blank)'} → ${res.answer}`;
        r.text(line, 160, 64 + k * 10, { size: 8, align: 'center', color: res.verdict === 'wrong' ? C.hurt : C.signal, maxWidth: 284 });
      });
    } else {
      const left = rp.blanks - this.riposteFields.length;
      r.text(`Enter to confirm (${left} left)`, 160, 66, { size: 6, align: 'center', color: C.dim });
    }
  }
}

/**
 * Arena backdrop (SPEC 8): a depth gradient with three layers. The far layer drifts slowly;
 * with reduced motion it stands still.
 */
export function drawArena(r: Renderer, nowMs: number, kind: 'village' | 'boss', calm: boolean): void {
  const g = r.low;
  const boss = kind === 'boss';
  const bands = boss ? [C.bossDeep, C.bossDeep, C.bossMid, C.bossMid] : [C.night, C.far, C.sky, C.sky];
  bands.forEach((col, i) => {
    g.fillStyle = col;
    g.fillRect(0, 28 + i * 10, 320, 10);
  });
  // Far layer: rooftops (village) or a bell tower ridge (boss), drifting.
  const drift = calm ? 0 : Math.floor(nowMs / 400) % 64;
  g.fillStyle = boss ? C.bossMid : C.wall;
  for (let x = -64; x < 384; x += 64) {
    const bx = x + drift;
    for (let i = 0; i < 14; i++) g.fillRect(bx + 14 - i, 56 + i, i * 2 + 4, 1);
    g.fillRect(bx, 70, 40, 12);
    g.fillRect(bx + 44, 64, 10, 18);
  }
  if (boss) {
    g.fillStyle = C.bossDeep;
    g.fillRect(148, 34, 24, 48);
    for (let i = 0; i < 10; i++) g.fillRect(160 - i, 24 + i, i * 2, 1);
  }
  // Floor with a depth gradient.
  const floor = boss ? [C.bossMid, C.bossLight, C.bossLight] : [C.floor, C.floorMid, C.floorNear];
  g.fillStyle = floor[0] ?? C.floor;
  g.fillRect(0, 82, 320, 30);
  g.fillStyle = floor[1] ?? C.floor;
  g.fillRect(0, 112, 320, 34);
  g.fillStyle = floor[2] ?? C.floor;
  g.fillRect(0, 146, 320, 34);
  // Near layer: pillars at the edges, perspective lines on the floor.
  g.fillStyle = boss ? C.bossDeep : C.far;
  g.fillRect(0, 28, 10, 152);
  g.fillRect(310, 28, 10, 152);
  g.fillRect(10, 28, 4, 4);
  g.fillRect(306, 28, 4, 4);
  g.fillStyle = boss ? C.bossDeep : C.wall;
  for (const x0 of [40, 100, 220, 280]) {
    for (let y = 82; y < 180; y += 2) g.fillRect(Math.round(x0 + (x0 - 160) * ((y - 82) / 60)), y, 1, 1);
  }
}

/** Blind round: the enemy is hidden in fog. */
function drawFog(r: Renderer): void {
  const g = r.low;
  g.fillStyle = C.void;
  g.fillRect(40, 28, 240, 84);
  g.fillStyle = C.night;
  for (let y = 28; y < 112; y += 3) g.fillRect(40, y, 240, 1);
}
