// A real hidden <input> for riposte typing, so accents, dead keys, IMEs and
// on-screen keyboards work (SPEC 8).

export class RiposteInput {
  private onEnter: (() => void) | null = null;
  private active = false;

  constructor(private readonly el: HTMLInputElement) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        this.onEnter?.();
      }
    });
    // Keep focus while typing, even if the player clicks the canvas.
    el.addEventListener('blur', () => {
      if (this.active) setTimeout(() => this.el.focus(), 0);
    });
  }

  get value(): string {
    return this.el.value;
  }

  open(onEnter: () => void): void {
    this.onEnter = onEnter;
    this.active = true;
    this.el.value = '';
    this.el.focus();
  }

  clear(): void {
    this.el.value = '';
  }

  close(): void {
    this.active = false;
    this.onEnter = null;
    this.el.value = '';
    this.el.blur();
  }
}
