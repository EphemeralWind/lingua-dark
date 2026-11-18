// Settings overlay (Prompt 4, SPEC 8 accessibility). O opens it from any scene except while
// typing; game time pauses while it is open, so a fight waits. Changes apply at once and save.
import { downloadText } from '../platform/files';
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
  /** X was pressed once; a second X clears the playtest log. */
  private clearArmed = false;
  private playtestNote: string | null = null;

  constructor(
    private readonly svc: Services,
    /** Applies and saves the settings after a change. */
    private readonly onChange: () => void,
  ) {}

  open(): void {
    this.isOpen = true;
    this.clearArmed = false;
    this.playtestNote = null;
    this.svc.time.pause('menu');
    this.svc.cues.play('menu', this.svc.time.now());
  }

  close(): void {
    this.isOpen = false;
    this.svc.time.resume('menu');
  }

  handle(ev: InputEvent): void {
    if (ev.type === 'key' && ev.code === 'KeyP') {
      this.exportPlaytest();
    } else if (ev.type === 'key' && ev.code === 'KeyX') {
      if (this.clearArmed) {
        this.svc.playtest.clear();
        this.playtestNote = 'Playtest log cleared.';
      } else {
        this.playtestNote = 'Press X again to clear the playtest log.';
      }
      this.clearArmed = !this.clearArmed;
    } else if (ev.type === 'key' && (ev.code === 'KeyO' || ev.code === 'Escape')) {
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

  /** Downloads the playtest log as JSON (Prompt 5, docs/PLAYTEST.md). Nothing leaves the machine otherwise. */
  private exportPlaytest(): void {
    this.clearArmed = false;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    downloadText(`lingua-dark-playtest-${stamp}.json`, this.svc.playtest.exportText());
    this.playtestNote = `Exported ${this.svc.playtest.exchanges} strikes.`;
  }

  /** Draws over the finished frame. */
  render(r: Renderer): void {
    r.panel(30, 14, 260, 152, 'rgba(11,13,18,0.94)');
    r.panel(30, 14, 260, 1, C.cardEdge);
    r.panel(30, 165, 260, 1, C.cardEdge);
    r.text('SETTINGS', 160, 24, { size: 10, align: 'center', color: C.signal });
    // The small lines below the toggles stack up from the footer; the toggles fit above them.
    const small = r.lineHeight(5) + 1;
    const noteY = 158 - small;
    const voiceY = noteY - small;
    const helpY = voiceY - small;
    const lh = Math.min(Math.max(14, r.lineHeight(7) + 4), (helpY - small - 42) / (ITEMS.length - 1));
    ITEMS.forEach((item, i) => {
      const y = 42 + i * lh;
      const on = this.svc.settings[item.key];
      const here = i === this.cursor;
      // On/off by word and by box shape, not by colour.
      r.text(`${here ? '▶' : ' '} ${item.label}`, 40, y, { size: 7, color: here ? C.text : C.dim, maxWidth: 160 });
      r.text(on ? '[■] ON ' : '[ ] OFF', 280, y, { size: 7, align: 'right', color: on ? C.signal : C.dim });
    });
    const item = ITEMS[this.cursor];
    if (item) r.text(item.help, 160, helpY, { size: 5, align: 'center', color: C.dim, maxWidth: 250 });
    const st = this.svc.speech.status;
    const voice = st.kind === 'voice' ? `Voice: ${st.name} (es-ES)` : st.kind === 'noVoice' ? 'No es-ES voice on this device: text only.' : 'No speech on this browser: text only.';
    r.text(voice, 160, voiceY, { size: 5, align: 'center', color: C.dim, maxWidth: 250 });
    const pt = this.svc.playtest;
    const note = this.playtestNote ?? (pt.lastError ? `Playtest log not saved: ${pt.lastError}` : `Playtest log: ${pt.exchanges} strikes, on this device only.  P: export  X: clear`);
    r.text(note, 160, noteY, { size: 5, align: 'center', color: C.dim, maxWidth: 250 });
    r.text('↑↓ choose   ←→ / Enter: switch   O / Esc: close', 160, 158, { size: 5, align: 'center', color: C.dim, maxWidth: 250 });
  }
}
