// Settings overlay (Prompt 4, SPEC 8 accessibility). O opens it from any scene except while
// typing; game time pauses while it is open, so a fight waits. Changes apply at once and save.
import type { InputEvent } from '../platform/input';
import { C } from '../platform/palette';
import type { Renderer } from '../platform/renderer';
import type { SettingKey } from '../save/settings';
import type { Services } from './services';

interface Item {
  key: SettingKey;
  label: string;
  help: string;
}

const ITEMS: readonly Item[] = [
  { key: 'reducedMotion', label: 'Reduced motion', help: 'No shake, flashes, fades or drifting backgrounds.' },
  { key: 'largerText', label: 'Larger text', help: 'Draws all text half again as large.' },
  { key: 'hollow', label: 'Hollow mode', help: 'No timers: every wind-up waits for your answer.' },
  { key: 'sfx', label: 'Sound effects', help: 'Captions (♪) show every sound either way.' },
  { key: 'music', label: 'Ambient music', help: 'A quiet loop behind each place.' },
  { key: 'speech', label: 'Spanish voice', help: 'Reads Spanish aloud after it is revealed. R repeats.' },
];

export class SettingsMenu {
  isOpen = false;
  private cursor = 0;

  constructor(
    private readonly svc: Services,
    /** Applies and saves the settings after a change. */
    private readonly onChange: () => void,
  ) {}

  open(): void {
    this.isOpen = true;
    this.svc.time.pause('menu');
    this.svc.cues.play('menu', this.svc.time.now());
  }

  close(): void {
    this.isOpen = false;
    this.svc.time.resume('menu');
  }

  handle(ev: InputEvent): void {
    if (ev.type === 'key' && (ev.code === 'KeyO' || ev.code === 'Escape')) {
      this.close();
    } else if (ev.type === 'direction' && (ev.dir === 'north' || ev.dir === 'south')) {
      this.cursor = (this.cursor + (ev.dir === 'south' ? 1 : ITEMS.length - 1)) % ITEMS.length;
      this.svc.cues.play('menu', this.svc.time.now());
    } else if (ev.type === 'direction' || ev.type === 'confirm') {
      const item = ITEMS[this.cursor];
      if (!item) return;
      this.svc.settings[item.key] = !this.svc.settings[item.key];
      this.onChange();
      this.svc.cues.play('menu', this.svc.time.now());
    }
  }

  /** Draws over the finished frame. */
  render(r: Renderer): void {
    r.panel(30, 14, 260, 152, 'rgba(11,13,18,0.94)');
    r.panel(30, 14, 260, 1, C.cardEdge);
    r.panel(30, 165, 260, 1, C.cardEdge);
    r.text('SETTINGS', 160, 24, { size: 10, align: 'center', color: C.signal });
    const lh = Math.max(14, r.lineHeight(7) + 4);
    ITEMS.forEach((item, i) => {
      const y = 42 + i * lh;
      const on = this.svc.settings[item.key];
      const here = i === this.cursor;
      // On/off by word and by box shape, not by colour.
      r.text(`${here ? '▶' : ' '} ${item.label}`, 40, y, { size: 7, color: here ? C.text : C.dim, maxWidth: 160 });
      r.text(on ? '[■] ON ' : '[ ] OFF', 280, y, { size: 7, align: 'right', color: on ? C.signal : C.dim });
    });
    const item = ITEMS[this.cursor];
    if (item) r.text(item.help, 160, 42 + ITEMS.length * lh, { size: 5, align: 'center', color: C.dim, maxWidth: 250 });
    const st = this.svc.speech.status;
    const voice = st.kind === 'voice' ? `Voice: ${st.name} (es-ES)` : st.kind === 'noVoice' ? 'No es-ES voice on this device: text only.' : 'No speech on this browser: text only.';
    r.text(voice, 160, 42 + ITEMS.length * lh + 10, { size: 5, align: 'center', color: C.dim, maxWidth: 250 });
    r.text('↑↓ choose   ←→ / Enter: switch   O / Esc: close', 160, 158, { size: 5, align: 'center', color: C.dim, maxWidth: 250 });
  }
}
