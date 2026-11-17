// Spanish speech (SPEC 5.2, 8): speechSynthesis with an es-ES voice. With no es-ES voice (or no
// speechSynthesis at all) the game stays text-only: Castilian is the dialect, so another
// Spanish voice is not used in its place (DECISIONS #80). Everything spoken is also on screen.
export type SpeechStatus = { kind: 'voice'; name: string } | { kind: 'noVoice' } | { kind: 'unsupported' };

/** What a sentence sounds like: blanks become a pause, quote marks are dropped. */
export function speakable(text: string): string {
  return text.replace(/_{2,}/g, '…').replace(/[«»"]/g, '').trim();
}

export class Speech {
  private voice: SpeechSynthesisVoice | null = null;
  private readonly synth: SpeechSynthesis | null;
  enabled = true;
  /** Last line spoken, for the repeat key. */
  last: string | null = null;

  constructor() {
    this.synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
    if (!this.synth) return;
    this.pickVoice();
    this.synth.addEventListener('voiceschanged', () => this.pickVoice());
  }

  private pickVoice(): void {
    const voices = this.synth?.getVoices() ?? [];
    const es = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === 'es-es');
    this.voice = es.find((v) => v.localService) ?? es[0] ?? null;
  }

  get status(): SpeechStatus {
    if (!this.synth) return { kind: 'unsupported' };
    return this.voice ? { kind: 'voice', name: this.voice.name } : { kind: 'noVoice' };
  }

  /** True while a line is being spoken (drawn as a ♪ next to the text). */
  get speaking(): boolean {
    return this.synth?.speaking ?? false;
  }

  speak(text: string): void {
    const line = speakable(text);
    if (!line) return;
    this.last = line;
    if (!this.enabled || !this.synth || !this.voice) return;
    this.synth.cancel();
    const u = new SpeechSynthesisUtterance(line);
    u.voice = this.voice;
    u.lang = 'es-ES';
    u.rate = 0.9;
    this.synth.speak(u);
  }

  repeat(): void {
    if (this.last) this.speak(this.last);
  }

  cancel(): void {
    this.synth?.cancel();
  }
}
