// Combat scene with placeholder art (flat shapes). Every shape is drawn from
// `view.animation` and the HUD numbers; the wind-up is a function of progress alone.
// Card text and marks come from `view.cards`; marks only exist after resolution.
import { createDeck } from '../content/deck';
import { createRng } from '../content/rng';
import type { Direction } from '../content/types';
import { Encounter } from '../combat/encounter';
import type { AttackType } from '../combat/types';
import { viewOf, type Animation, type CardText, type EncounterView } from '../combat/view';
import type { InputEvent } from '../platform/input';
import type { Renderer } from '../platform/renderer';
import type { RiposteInput } from '../platform/riposteInput';

// 32-colour budget later; placeholder tones: desaturated blues/greys, bonfire orange
// accent, one signal colour for parry flashes.
const C = {
  sky: '#1c2230',
  floor: '#2a3142',
  floorNear: '#343c50',
  enemy: '#6b7385',
  enemyDark: '#4a5061',
  weapon: '#a9b0bf',
  player: '#3d4558',
  playerEdge: '#566079',
  card: '#20263a',
  cardEdge: '#7d869c',
  signal: '#f2e6a0',
  ember: '#e08a3c',
  hurt: '#c85a5a',
  text: '#e8e6df',
  dim: '#9aa1b1',
  barBack: '#141824',
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CARD_RECTS: Record<Direction, Rect> = {
  north: { x: 100, y: 27, w: 120, h: 14 },
  east: { x: 212, y: 65, w: 102, h: 14 },
  south: { x: 100, y: 109, w: 120, h: 14 },
  west: { x: 6, y: 65, w: 102, h: 14 },
};

const ARROW: Record<Direction, string> = { north: '↑', east: '→', south: '↓', west: '←' };
const UNIT: Record<Direction, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

const ENEMY_CX = 160;
const ENEMY_TOP = 46;

const ATTACK_LABEL: Record<AttackType, string> = {
  jab: 'JAB',
  overhead: 'OVERHEAD',
  delayed: 'DELAYED',
  grab: 'GRAB',
  sweep: 'SWEEP',
  combo: 'COMBO',
};

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

type Mode = 'ready' | 'fighting';

export class CombatScene {
  private mode: Mode = 'ready';
  private enc: Encounter;
  private seed: number;
  private riposteOpen = false;
  private riposteFields: string[] = [];
  private pendingSubmit = false;

  constructor(
    seed: number,
    private readonly riposteInput: RiposteInput,
    private readonly setTextMode: (on: boolean) => void,
  ) {
    this.seed = seed;
    this.enc = this.newEncounter();
  }

  private newEncounter(): Encounter {
    return new Encounter(createDeck(createRng(this.seed)), { zone: 1 });
  }

  update(nowMs: number, events: InputEvent[]): void {
    for (const ev of events) this.handle(ev);

    if (this.mode === 'fighting') {
      if (this.pendingSubmit) {
        this.pendingSubmit = false;
        this.enc.submitRiposte(this.riposteFields, nowMs);
        this.closeRiposte();
      }
      this.enc.tick(nowMs);
      if (this.enc.state.kind === 'riposte' && !this.riposteOpen) this.openRiposte();
    }
    this.publishTestState();
  }

  private handle(ev: InputEvent): void {
    if (this.mode === 'ready') {
      if (ev.type === 'confirm' || ev.type === 'point') {
        this.mode = 'fighting';
        this.enc.start(ev.atMs);
      }
      return;
    }
    if (this.enc.finished) {
      if (ev.type === 'confirm' || ev.type === 'point') {
        this.seed = (this.seed + 1) >>> 0;
        this.enc = this.newEncounter();
        this.mode = 'ready';
      }
      return;
    }
    if (ev.type === 'direction') {
      this.enc.lockIn(ev.dir, ev.atMs);
    } else if (ev.type === 'point') {
      for (const dir of Object.keys(CARD_RECTS) as Direction[]) {
        if (inside(CARD_RECTS[dir], ev.x, ev.y)) this.enc.lockIn(dir, ev.atMs);
      }
    }
  }

  private openRiposte(): void {
    this.riposteOpen = true;
    this.riposteFields = [];
    this.setTextMode(true);
    this.riposteInput.open(() => {
      const s = this.enc.state;
      if (s.kind !== 'riposte' || this.pendingSubmit) return;
      this.riposteFields.push(this.riposteInput.value);
      this.riposteInput.clear();
      if (this.riposteFields.length >= s.question.strikes.length) this.pendingSubmit = true;
    });
  }

  private closeRiposte(): void {
    this.riposteOpen = false;
    this.riposteInput.close();
    this.setTextMode(false);
  }

  /**
   * Public state for the Playwright smoke test: phase, the question tag (id and seed,
   * also printed on screen for bug reports) and the blank index. Never the answer.
   */
  private publishTestState(): void {
    const ds = document.body.dataset;
    const s = this.enc.state;
    ds['phase'] = this.mode === 'ready' ? 'ready' : s.kind;
    if (s.kind === 'windup') {
      ds['question'] = `${s.question.id}#${s.question.seed}`;
      ds['strike'] = String(s.strike);
      ds['deadline'] = String(s.deadlineMs);
    }
  }

  // --- rendering ------------------------------------------------------------

  render(r: Renderer, nowMs: number): void {
    const view = viewOf(this.enc, nowMs);
    r.begin(C.sky);
    this.drawArena(r);
    this.drawEnemy(r, view.animation);
    this.drawPlayer(r, view.animation);
    if (this.mode === 'fighting') {
      this.drawCards(r, view.cards);
      this.drawBars(r, view);
      this.drawFlash(r, view.animation);
      if (view.riposte) {
        r.low.fillStyle = C.barBack;
        r.low.fillRect(16, 40, 288, 58);
      }
    }
    r.present();

    if (this.mode === 'ready') {
      this.drawReady(r);
      return;
    }
    this.drawCardText(r, view.cards);
    this.drawHudText(r, view);
    if (view.prompt) {
      r.text(view.prompt.sentence, 160, 8, { size: 8, align: 'center', bold: true, maxWidth: 300 });
      const step = view.prompt.strikeCount > 1 ? `  [blank ${view.prompt.strike + 1}/${view.prompt.strikeCount}]` : '';
      r.text(view.prompt.prompt + step, 160, 17, { size: 6, align: 'center', color: C.dim, maxWidth: 300 });
    }
    if (view.riposte) this.drawRiposte(r, view);
    if (view.phase === 'won' || view.phase === 'lost') this.drawEnd(r, view.phase === 'won');
  }

  private drawArena(r: Renderer): void {
    const g = r.low;
    // Depth gradient in flat bands.
    g.fillStyle = C.floor;
    g.fillRect(0, 96, 320, 84);
    g.fillStyle = C.floorNear;
    g.fillRect(0, 140, 320, 40);
    g.fillStyle = C.enemyDark;
    g.fillRect(0, 95, 320, 1);
  }

  private drawEnemy(r: Renderer, a: Animation): void {
    const g = r.low;
    if (a.enemyPose === 'dead') {
      g.fillStyle = C.enemyDark;
      g.fillRect(ENEMY_CX - 22, 92, 44, 8);
      return;
    }
    let dx = 0;
    let dy = 0;
    if (a.enemyPose === 'windup') dy = -Math.round(a.progress * 3);
    if ((a.enemyPose === 'recoil' || a.enemyPose === 'staggered') && a.toward) {
      const k = Math.round(Math.sin(a.progress * Math.PI) * 4);
      dx = -UNIT[a.toward].x * k;
      dy = -UNIT[a.toward].y * k;
    }
    if (a.enemyPose === 'staggered' && !a.toward) dy = 3;

    const bodyX = ENEMY_CX - 14 + dx;
    const top = ENEMY_TOP + 8 + dy;
    g.fillStyle = C.enemy;
    g.fillRect(bodyX, top, 28, 40); // body
    g.fillRect(bodyX + 6, top - 10, 16, 12); // head
    g.fillStyle = C.sky;
    g.fillRect(bodyX + 9, top - 6, 3, 2); // eyes
    g.fillRect(bodyX + 16, top - 6, 3, 2);

    // Weapon. Wind-up: one shared pose, raised by progress. Strike: toward the answer.
    g.fillStyle = C.weapon;
    if (a.enemyPose === 'windup' || a.enemyPose === 'idle') {
      const raise = a.enemyPose === 'windup' ? Math.round(4 + a.progress * 10) : 2;
      g.fillRect(ENEMY_CX - 1 + dx, top - 10 - raise, 3, raise + 6);
      g.fillRect(ENEMY_CX - 4 + dx, top - 10 - raise, 9, 2);
    } else if (a.toward) {
      const u = UNIT[a.toward];
      const reach = a.enemyPose === 'strike' ? 10 + Math.round(a.progress * 24) : 10;
      const cx = ENEMY_CX + dx;
      const cy = top + 14;
      for (let i = 0; i < reach; i++) g.fillRect(cx + u.x * i - 1, cy + u.y * i - 1, 3, 3);
    }
  }

  private drawPlayer(r: Renderer, a: Animation): void {
    const g = r.low;
    const dead = a.playerPose === 'dead';
    const shake = a.playerPose === 'hit' && !a.frozen ? Math.round(Math.sin(a.progress * 20) * 2) : 0;
    const x = 160 + shake;
    const y = dead ? 150 : 128;
    // Seen from behind: head, shoulders, back.
    g.fillStyle = C.playerEdge;
    g.fillRect(x - 24, y + 14, 48, 40);
    g.fillStyle = C.player;
    g.fillRect(x - 22, y + 16, 44, 40);
    g.fillRect(x - 9, y, 18, 16);
    if (dead) return;

    // Shield: centred while guarding, swung to the strike direction on a parry.
    let sx = x - 5;
    let sy = y + 6;
    if (a.playerPose === 'parry' && a.toward) {
      const u = UNIT[a.toward];
      sx += u.x * 22;
      sy += u.y === -1 ? -10 : u.y === 1 ? 4 : 0;
    }
    if (a.playerPose === 'guard' || a.playerPose === 'parry') {
      g.fillStyle = C.weapon;
      g.fillRect(sx, sy, 10, 14);
      g.fillStyle = C.playerEdge;
      g.fillRect(sx + 2, sy + 2, 6, 10);
    }
  }

  private drawCards(r: Renderer, cards: CardText[]): void {
    const g = r.low;
    for (const c of cards) {
      const b = CARD_RECTS[c.dir];
      g.fillStyle = c.mark === 'correct' ? C.signal : c.mark === 'wrongPick' ? C.hurt : C.cardEdge;
      g.fillRect(b.x, b.y, b.w, b.h);
      // Correct: thick border. Wrong pick: thin border. Plus ✓ / ✗ in text (not colour alone).
      const inset = c.mark === 'correct' ? 2 : 1;
      g.fillStyle = C.card;
      g.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    }
  }

  private drawCardText(r: Renderer, cards: CardText[]): void {
    for (const c of cards) {
      const b = CARD_RECTS[c.dir];
      const mark = c.mark === 'correct' ? '✓' : c.mark === 'wrongPick' ? '✗' : ARROW[c.dir];
      r.text(mark, b.x + 6, b.y + b.h / 2 + 0.5, { size: 7, align: 'center', color: C.dim });
      r.text(c.text, b.x + b.w / 2 + 4, b.y + b.h / 2 + 0.5, { size: 7, align: 'center', maxWidth: b.w - 16 });
    }
  }

  private drawBars(r: Renderer, view: EncounterView): void {
    const g = r.low;
    const bar = (x: number, y: number, w: number, h: number, frac: number, color: string): void => {
      g.fillStyle = C.barBack;
      g.fillRect(x, y, w, h);
      g.fillStyle = color;
      g.fillRect(x, y, Math.round(w * Math.min(1, Math.max(0, frac))), h);
    };
    const h = view.hud;
    // Deadline: shrinks symmetrically toward the centre.
    const t = view.animation.timerLeft;
    if (t !== null) {
      const half = Math.round(120 * t);
      g.fillStyle = C.barBack;
      g.fillRect(40, 22, 240, 2);
      g.fillStyle = C.text;
      g.fillRect(160 - half, 22, half * 2, 2);
    }
    bar(130, 101, 60, 3, h.stance / h.stanceMax, C.signal); // stance under the enemy
    bar(236, 156, 76, 4, h.enemyHp / h.enemyHpMax, C.hurt);
    bar(8, 156, 76, 4, h.vitality / h.vitalityMax, C.ember);
    this.drawAttackIcon(r, h.attack);
  }

  /** Attack-type icon: a distinct shape per type, nothing about the answer. */
  private drawAttackIcon(r: Renderer, attack: AttackType | null): void {
    if (!attack) return;
    const g = r.low;
    g.fillStyle = C.dim;
    const x = 8;
    const y = 30;
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
      default:
        g.fillRect(x, y, 10, 10);
    }
  }

  private drawFlash(r: Renderer, a: Animation): void {
    if (a.flash === 'none') return;
    const g = r.low;
    if (a.flash === 'hit') {
      // X over the player.
      g.fillStyle = C.hurt;
      for (let i = 0; i < 12; i++) {
        g.fillRect(154 + i, 132 + i, 2, 2);
        g.fillRect(166 - i, 132 + i, 2, 2);
      }
      return;
    }
    // Parry: ring. High-quality parry: diamond on top (distinct shape, not just colour).
    g.fillStyle = C.signal;
    const cx = a.toward ? 160 + UNIT[a.toward].x * 30 : 160;
    const cy = a.toward ? 110 + UNIT[a.toward].y * 14 : 110;
    g.fillRect(cx - 8, cy - 8, 16, 2);
    g.fillRect(cx - 8, cy + 6, 16, 2);
    g.fillRect(cx - 8, cy - 8, 2, 16);
    g.fillRect(cx + 6, cy - 8, 2, 16);
    if (a.flash === 'perfect') {
      for (let i = 0; i < 6; i++) {
        g.fillRect(cx - i, cy - 12 + i, 1 + i * 2, 1);
        g.fillRect(cx - i, cy + 12 - i, 1 + i * 2, 1);
      }
    }
  }

  private drawHudText(r: Renderer, view: EncounterView): void {
    const h = view.hud;
    if (h.attack) r.text(ATTACK_LABEL[h.attack], 22, 35, { size: 6, color: C.dim });
    r.text(`VITALITY ${Math.ceil(h.vitality)}`, 8, 150, { size: 6, color: C.dim });
    r.text(`ENEMY ${Math.ceil(h.enemyHp)}`, 236, 150, { size: 6, color: C.dim });
    r.text('STANCE', 160, 96 + 12, { size: 5, color: C.dim, align: 'center' });
    if (view.prompt) r.text(view.prompt.tag, 316, 176, { size: 4, color: C.enemyDark, align: 'right' });
  }

  private drawRiposte(r: Renderer, view: EncounterView): void {
    const rp = view.riposte;
    if (!rp) return;
    r.text('RIPOSTE: type the missing words', 160, 8, { size: 8, align: 'center', bold: true, color: C.signal });
    r.text(rp.prompt, 160, 17, { size: 6, align: 'center', color: C.dim, maxWidth: 300 });

    let i = 0;
    const filled = rp.sentence.replace(/___/g, () => {
      const idx = i++;
      if (rp.results) {
        const res = rp.results[idx];
        return res ? `[${res.answer}]` : '___';
      }
      if (idx < this.riposteFields.length) return `[${this.riposteFields[idx] ?? ''}]`;
      if (idx === this.riposteFields.length) return `[${this.riposteInput.value}▌]`;
      return '___';
    });
    r.text(filled, 160, 50, { size: 8, align: 'center', maxWidth: 300 });

    if (rp.results) {
      rp.results.forEach((res, k) => {
        const line =
          res.verdict === 'exact'
            ? `✓ ${res.answer}`
            : res.verdict === 'accent'
              ? `≈ ${res.typed} → ${res.answer} (mind the accent)`
              : `✗ ${res.typed || '(blank)'} → ${res.answer}`;
        r.text(line, 160, 64 + k * 9, { size: 7, align: 'center', color: res.verdict === 'wrong' ? C.hurt : C.signal });
      });
    } else {
      const left = rp.blanks - this.riposteFields.length;
      r.text(`Enter to confirm (${left} left)`, 160, 64, { size: 6, align: 'center', color: C.dim });
    }
  }

  private drawReady(r: Renderer): void {
    r.text('LINGUA DARK', 160, 30, { size: 14, align: 'center', bold: true });
    r.text('Practice fight', 160, 46, { size: 7, align: 'center', color: C.dim });
    r.text('Every attack is a question. The right answer is the parry.', 160, 64, { size: 6, align: 'center', maxWidth: 300 });
    r.text('Answer with arrow keys, WASD, or click a card.', 160, 74, { size: 6, align: 'center', maxWidth: 300 });
    r.text('Break the stance, then type the missing words to strike.', 160, 84, { size: 6, align: 'center', maxWidth: 300 });
    r.text('Press Enter or click to begin', 160, 104, { size: 7, align: 'center', color: C.signal });
  }

  private drawEnd(r: Renderer, won: boolean): void {
    r.text(won ? 'ENEMY DEFEATED' : 'YOU DIED', 160, 60, { size: 14, align: 'center', bold: true, color: won ? C.signal : C.hurt });
    r.text('Press Enter or click to fight again', 160, 78, { size: 7, align: 'center', color: C.dim });
  }
}
