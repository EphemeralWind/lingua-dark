// A pixel canvas for scenery: big pictures are painted pixel by pixel from textures in world
// units (bricks, flagstones, planks, leaves), then hand-drawn parts are stamped on top.
// Keys are the palette keys of art/kit.ts. Pure and deterministic: noise comes from a hash.
import { type CharacterArt, type Part } from '../kit';

export class PixelCanvas {
  private readonly px: string[][];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));
  }

  get(x: number, y: number): string {
    return this.px[y]?.[x] ?? '.';
  }

  /** Sets a pixel; '.' clears it. Off-canvas writes are ignored. */
  set(x: number, y: number, k: string): void {
    const row = this.px[y];
    if (row && x >= 0 && x < this.w) row[x] = k;
  }

  fill(x: number, y: number, w: number, h: number, k: string): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, k);
  }

  /** Paints every pixel of a box from a function; null leaves the pixel as it is. */
  each(x: number, y: number, w: number, h: number, fn: (x: number, y: number) => string | null): void {
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const k = fn(i, j);
        if (k !== null) this.set(i, j, k);
      }
    }
  }

  /** Draws a part's opaque pixels with its top left at (x, y). */
  stamp(p: Part, x: number, y: number): void {
    p.rows.forEach((row, j) => [...row].forEach((k, i) => k !== '.' && this.set(x + i, y + j, k)));
  }

  toPart(name: string): Part {
    return { name, w: this.w, h: this.h, rows: this.px.map((r) => r.join('')) };
  }
}

/** Deterministic noise in [0, 1) from integer coordinates. */
export function hash(a: number, b: number, c = 0): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1440662683)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A one-frame scenery piece, tag `still`. */
export const still = (id: string, p: Part): CharacterArt => ({ id, w: p.w, h: p.h, tags: { still: [[{ part: p, x: 0, y: 0 }]] } });

/** A scenery piece with named states, one frame each (or several for an animated state). */
export const states = (id: string, w: number, h: number, tags: Record<string, Part[]>): CharacterArt => ({
  id,
  w,
  h,
  tags: Object.fromEntries(Object.entries(tags).map(([t, parts]) => [t, parts.map((p) => [{ part: p, x: 0, y: 0 }])])),
});
