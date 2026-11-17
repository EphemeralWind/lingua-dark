// The bonfire lesson hub (DECISIONS #96), which replaced the review round. Resting puts the
// player by the fire with the zone's lesson objects around it. Pick one to zoom in and read
// its pages; Left/Right turns them. The rules live in world/hub.ts and the pages are spelled
// from content/lessons.ts, so a new object kind is a lessons.json entry plus its art.
import { lessonPage, type LessonObject, type LessonPage } from '../content/lessons';
import type { InputEvent } from '../platform/input';
import { C } from '../platform/palette';
import type { Renderer } from '../platform/renderer';
import { LESSON_TURN_MS } from '../tuning';
import { HUB_START, hubInput, type Box, type HubState, type HubTarget } from '../world/hub';
import { PAGE_SLAB, PAGE_TEXT, PROP_AT, REST_SPOTS, STILL } from './sceneryLayout';
import type { Services } from './services';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
/** Hit box when an object has no art: the flat-shape stand-in's size. */
const FALLBACK_SIZE = { w: 18, h: 50 };

export class Hub {
  private state: HubState = HUB_START;
  private readonly pages: readonly (readonly LessonPage[])[];
  /** When the last page turn started, and which way, for the slide. */
  private turn: { at: number; dir: 1 | -1 } | null = null;
  finished = false;

  constructor(
    private readonly objects: readonly LessonObject[],
    private readonly svc: Services,
  ) {
    this.pages = objects.map((o) => o.pages.map((p) => lessonPage(p)));
  }

  /** Where object i stands and the box that selects it, on the 320x180 buffer. */
  private box(i: number): Box {
    const spot = REST_SPOTS[i] ?? REST_SPOTS[REST_SPOTS.length - 1] ?? { x: 160, bottom: 150 };
    const id = this.objects[i]?.sprite ?? '';
    const size = this.svc.sprites.frameSize(id, 'still') ?? FALLBACK_SIZE;
    return { x: Math.round(spot.x - size.w / 2), y: spot.bottom - size.h, w: size.w, h: size.h };
  }

  private targets(): HubTarget[] {
    return this.objects.map((o, i) => ({ pages: o.pages.length, hit: this.box(i) }));
  }

  private current(): LessonPage | null {
    const v = this.state.viewing;
    return v ? (this.pages[v.object]?.[v.page] ?? null) : null;
  }

  update(events: InputEvent[], nowMs: number): void {
    for (const ev of events) {
      if (ev.type === 'key' && ev.code === 'KeyR') {
        const page = this.current();
        if (page) this.svc.speech.speak(page.spoken.join('. '));
        continue;
      }
      const before = this.state.viewing?.page ?? 0;
      const step = hubInput(this.state, this.targets(), ev);
      this.state = step.state;
      switch (step.action) {
        case 'opened':
          this.turn = null;
          this.svc.cues.play('stone', nowMs);
          break;
        case 'turned': {
          const after = this.state.viewing?.page ?? 0;
          const forward = ev.type === 'direction' ? ev.dir === 'east' : ev.type === 'point' && ev.x >= 160;
          this.turn = { at: nowMs, dir: forward ? 1 : -1 };
          if (after !== before) this.svc.cues.play('stone', nowMs);
          this.svc.speech.cancel();
          break;
        }
        case 'closed':
          this.svc.speech.cancel();
          break;
        case 'selected':
          this.svc.cues.play('menu', nowMs);
          break;
        case 'leave':
          this.finished = true;
          return;
        case null:
          break;
      }
    }
  }

  /** The public state for the e2e test (no answers here: lessons carry no questions). */
  get publicState(): { viewing: string; page: string } {
    const v = this.state.viewing;
    return { viewing: v ? (this.objects[v.object]?.id ?? '') : '', page: v ? String(v.page) : '' };
  }

  dispose(): void {
    this.svc.speech.cancel();
  }

  render(r: Renderer, footer: string, nowMs: number): void {
    const v = this.state.viewing;
    const obj = v ? this.objects[v.object] : undefined;
    const page = this.current();
    if (v && obj && page) this.renderPage(r, obj, v.page, page, nowMs);
    else this.renderFire(r, footer, nowMs);
  }

  private renderFire(r: Renderer, footer: string, nowMs: number): void {
    r.begin(C.sky);
    const g = r.low;
    const calm = this.svc.settings.reducedMotion;
    const sprites = this.svc.sprites;
    if (sprites.draw(g, 'rest_backdrop', STILL, PROP_AT.room.x, PROP_AT.room.bottom)) {
      sprites.draw(g, 'bonfire', { tag: 'burn', frame: calm ? 0 : Math.floor(nowMs / 160) % 2, flip: false }, PROP_AT.restFire.x, PROP_AT.restFire.bottom);
      sprites.draw(g, 'rest_player', { tag: 'sit', frame: calm ? 0 : Math.floor(nowMs / 1100) % 2, flip: false }, PROP_AT.restPlayer.x, PROP_AT.restPlayer.bottom);
    } else {
      g.fillStyle = C.floor;
      g.fillRect(0, 120, 320, 60);
      g.fillStyle = C.ember;
      for (let i = 0; i < 10; i++) g.fillRect(160 - (10 - i), 150 - i * 2, (10 - i) * 2, 2);
    }
    this.objects.forEach((o, i) => {
      const b = this.box(i);
      if (!sprites.draw(g, o.sprite, STILL, b.x + b.w / 2, b.y + b.h)) {
        g.fillStyle = C.enemy;
        g.fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle = C.enemyDark;
        g.fillRect(b.x + b.w - 5, b.y, 5, b.h);
      }
    });
    r.present();

    r.text('BONFIRE', 160, 12, { size: 8, align: 'center', color: C.ember });
    r.text('Vitality and flasks refilled. Enemies have risen again. Game saved.', 160, 22, { size: 5, align: 'center', color: C.dim, maxWidth: 300 });
    if (footer) r.text(footer, 160, 30, { size: 5, align: 'center', color: C.dim, maxWidth: 300 });

    const sel = this.objects[this.state.selected];
    if (sel) {
      // Selection: a drawn frame and a ↓ marker, not colour alone.
      const b = this.box(this.state.selected);
      const t = 1 / 4;
      r.panel(b.x - 2, b.y - 2, b.w + 4, t, C.signal);
      r.panel(b.x - 2, b.y + b.h + 2 - t, b.w + 4, t, C.signal);
      r.panel(b.x - 2, b.y - 2, t, b.h + 4, C.signal);
      r.panel(b.x + b.w + 2 - t, b.y - 2, t, b.h + 4, C.signal);
      const bob = this.svc.settings.reducedMotion ? 0 : Math.floor(nowMs / 400) % 2;
      r.text('↓', b.x + b.w / 2, b.y - 7 - bob, { size: 7, align: 'center', color: C.signal, outline: C.void });
      r.text(`${sel.name_en}: Enter to read`, 160, 40, { size: 6, align: 'center', color: C.text, outline: C.void });
    }
    const choose = this.objects.length > 1 ? '←→ choose   ' : '';
    r.text(`${choose}Enter: read   Esc: leave the fire`, 160, 175, { size: 5, align: 'center', color: C.dim, outline: C.void });
    this.svc.cues.draw(r, nowMs, 312, 116);
  }

  private renderPage(r: Renderer, obj: LessonObject, index: number, page: LessonPage, nowMs: number): void {
    // The new face slides in from the side it was turned toward (instant with reduced motion).
    let dx = 0;
    if (this.turn && !this.svc.settings.reducedMotion) {
      const k = (nowMs - this.turn.at) / LESSON_TURN_MS;
      if (k < 1) dx = Math.round((1 - k) * (1 - k) * 40 * this.turn.dir);
      else this.turn = null;
    }
    r.begin(C.void);
    const g = r.low;
    if (!this.svc.sprites.draw(g, obj.pageSprite, { tag: 'face', frame: index, flip: false }, 160 + dx, 180)) {
      g.fillStyle = C.cardEdge;
      g.fillRect(PAGE_SLAB.x + dx, PAGE_SLAB.y, PAGE_SLAB.w, PAGE_SLAB.h);
    }
    r.present();

    const T = PAGE_TEXT;
    const ink = C.void;
    const cx = T.x + T.w / 2 + dx;
    let y = T.y + 6;
    r.text(page.title.toUpperCase(), cx, y, { size: 8, align: 'center', color: ink, bold: true, maxWidth: T.w });
    y += r.lineHeight(8) + 4;
    const verseStep = r.lineHeight(6) + 2;
    for (const line of page.verse) {
      r.text(line, cx, y, { size: 6, align: 'center', color: C.sky, maxWidth: T.w });
      y += verseStep;
    }
    // A carved rule between the riddle and the examples.
    r.panel(cx - 40, y, 80, 1 / 2, C.enemyDark);
    y += 8;

    const rows = page.rows;
    const cols = rows[0]?.length ?? 0;
    const room = T.y + T.h - y;
    const pitch = Math.min(r.lineHeight(7) + 6, room / Math.max(1, rows.length));
    // Columns sit close together so each row reads as one line: "el pan   los panes".
    const colW = Math.min(T.w / Math.max(1, cols), 80);
    const tableLeft = cx - (colW * cols) / 2;
    rows.forEach((row, i) => {
      row.forEach((cell, j) => {
        r.text(cell, tableLeft + colW * (j + 0.5), y + pitch * (i + 0.5), { size: 7, align: 'center', color: ink, maxWidth: colW - 4 });
      });
    });

    // Which face: carved numerals, the current one boxed (shape, not just colour).
    const n = obj.pages.length;
    const gap = 18;
    const left = 160 - (gap * (n - 1)) / 2 + dx;
    for (let i = 0; i < n; i++) {
      const x = left + gap * i;
      const label = ROMAN[i] ?? String(i + 1);
      r.text(label, x, 156, { size: 6, align: 'center', color: i === index ? ink : C.floor, bold: i === index });
      if (i === index) {
        const w = r.measure(label, { size: 6, bold: true }) + 4;
        const t = 1 / 4;
        r.panel(x - w / 2, 152, w, t, ink);
        r.panel(x - w / 2, 160 - t, w, t, ink);
        r.panel(x - w / 2, 152, t, 8, ink);
        r.panel(x + w / 2 - t, 152, t, 8, ink);
      }
    }
    const hear = this.svc.speech.status.kind === 'voice' ? '   R: hear it' : '';
    r.text(`${obj.name_en}: face ${ROMAN[index] ?? index + 1} of ${ROMAN[n - 1] ?? n}`, 160, 168, { size: 5, align: 'center', color: C.dim });
    r.text(`←→ turn${hear}   Esc: step back`, 160, 175, { size: 5, align: 'center', color: C.dim });
    this.svc.cues.draw(r, nowMs, 316, 170);
  }
}
