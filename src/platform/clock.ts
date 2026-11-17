// Wall-clock days for the learning system. Pure logic takes a whole local day number;
// this is the only place that reads the date. Days start at local midnight.
const MS_PER_DAY = 86_400_000;

/** Whole local days since 1970-01-01 for an epoch time and a Date.getTimezoneOffset() value. */
export function localDay(epochMs: number, tzOffsetMin: number): number {
  return Math.floor((epochMs - tzOffsetMin * 60_000) / MS_PER_DAY);
}

export class DayClock {
  /** Dev builds can skip days forward to test spacing and mastery (F8). */
  private offset = 0;

  today(): number {
    const now = new Date();
    return localDay(now.getTime(), now.getTimezoneOffset()) + this.offset;
  }

  skipDay(): void {
    this.offset += 1;
  }

  /** Epoch ms for save timestamps. */
  nowMs(): number {
    return Date.now();
  }
}
