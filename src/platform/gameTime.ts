// Game time: performance.now() minus the time spent paused. Encounters, input timestamps and
// transitions all read this clock, so a hidden tab or an open settings menu freezes the fight
// instead of timing out the wind-up (fixes DECISIONS #38).
export class GameTime {
  private offset = 0;
  private pausedAt: number | null = null;
  private readonly reasons = new Set<string>();

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause('hidden');
      else this.resume('hidden');
    });
    if (document.hidden) this.pause('hidden');
  }

  now(): number {
    return (this.pausedAt ?? performance.now()) - this.offset;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  pause(reason: string): void {
    if (this.reasons.size === 0) this.pausedAt = performance.now();
    this.reasons.add(reason);
  }

  resume(reason: string): void {
    if (!this.reasons.delete(reason) || this.reasons.size > 0 || this.pausedAt === null) return;
    this.offset += performance.now() - this.pausedAt;
    this.pausedAt = null;
  }
}
