// Practice fight (`/?seed=N`): one fight from a fixed seed, no world, no save. Kept for quick
// testing and for the Playwright smoke test, which reads the <body> data attributes.
import { createDeck } from '../content/deck';
import { createRng } from '../content/rng';
import { Encounter } from '../combat/encounter';
import type { InputEvent } from '../platform/input';
import { C } from '../platform/palette';
import type { Renderer } from '../platform/renderer';
import { Fight } from './fight';
import type { Services } from './services';

type Mode = 'ready' | 'fighting';

export class CombatScene {
  private mode: Mode = 'ready';
  private fight: Fight;
  private seed: number;

  constructor(
    seed: number,
    private readonly svc: Services,
  ) {
    this.seed = seed;
    this.fight = this.newFight();
  }

  private newFight(): Fight {
    const enc = new Encounter(createDeck(createRng(this.seed)), { zone: 1 });
    return new Fight(enc, this.svc, { label: 'Hollow villager', character: 'hollow_villager' });
  }

  update(nowMs: number, events: InputEvent[]): void {
    this.svc.sound.setMood('fight');
    for (const ev of events) this.handle(ev);
    if (this.mode === 'fighting') this.fight.update(nowMs);
    this.publishTestState();
  }

  private handle(ev: InputEvent): void {
    const go = ev.type === 'confirm' || ev.type === 'point';
    if (this.mode === 'ready') {
      if (go) {
        this.mode = 'fighting';
        this.fight.start(ev.atMs);
      }
      return;
    }
    if (this.fight.finished) {
      if (go) {
        this.seed = (this.seed + 1) >>> 0;
        this.fight = this.newFight();
        this.mode = 'ready';
      }
      return;
    }
    this.fight.handle(ev);
  }

  /** Public state for the Playwright smoke test (see Fight.publishTestState). */
  private publishTestState(): void {
    if (this.mode === 'ready') document.body.dataset['phase'] = 'ready';
    else this.fight.publishTestState();
  }

  render(r: Renderer, nowMs: number): void {
    const view = this.fight.render(r, nowMs, this.mode === 'fighting');
    if (this.mode === 'ready') {
      this.drawReady(r);
      return;
    }
    if (view.phase === 'won' || view.phase === 'lost') this.drawEnd(r, view.phase === 'won');
  }

  private drawReady(r: Renderer): void {
    r.text('LINGUA DARK', 160, 30, { size: 14, align: 'center', outline: C.void });
    r.text('Practice fight', 160, 46, { size: 7, align: 'center', color: C.dim, outline: C.void });
    r.text('Every attack is a question. The right answer is the parry.', 160, 64, { size: 6, align: 'center', maxWidth: 300, outline: C.void });
    r.text('Answer with arrow keys, WASD, or click a card.', 160, 74, { size: 6, align: 'center', maxWidth: 300, outline: C.void });
    r.text('Break the stance, then type the missing words to strike.', 160, 84, { size: 6, align: 'center', maxWidth: 300, outline: C.void });
    r.text('Press Enter or click to begin.   O: settings', 160, 104, { size: 7, align: 'center', color: C.signal, outline: C.void });
  }

  private drawEnd(r: Renderer, won: boolean): void {
    r.text(won ? 'ENEMY DEFEATED' : 'YOU DIED', 160, 60, { size: 14, align: 'center', color: won ? C.signal : C.hurt, outline: C.void });
    r.text('Press Enter or click to fight again', 160, 78, { size: 7, align: 'center', color: C.dim, outline: C.void });
  }
}
