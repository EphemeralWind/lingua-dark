// Toolkit for hand-drawn sprites. Pure (no DOM), so tests and the build script run in Node.
//
// A part is a small pixel grid drawn by hand, one character per pixel. Rows are written
// run-length so they are easy to count: "3. A 5W 13V 4U A" is 3 transparent pixels, one A,
// five W, and so on (spaces are ignored). Rows shorter than the part are padded with '.'; a
// row longer than the part is an error. Frames place parts at positions, in draw order.
import { PALETTE } from '../src/platform/palette';

/** One key per palette colour, in PALETTE order: A is PALETTE[0], f is PALETTE[31]. '.' is clear. */
export const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
if (KEYS.length !== PALETTE.length) throw new Error('art keys and palette differ in length');

export interface Part {
  name: string;
  w: number;
  h: number;
  /** Decoded rows, exactly `w` characters each. */
  rows: string[];
}

export function decodeRow(rle: string, w: number, where: string): string {
  let out = '';
  const src = rle.replace(/\s+/g, '');
  for (let i = 0; i < src.length; ) {
    let n = '';
    while (i < src.length && /\d/.test(src[i] ?? '')) n += src[i++];
    const ch = src[i++];
    if (ch === undefined) throw new Error(`${where}: count with no pixel`);
    if (ch !== '.' && !KEYS.includes(ch)) throw new Error(`${where}: unknown colour key "${ch}"`);
    out += ch.repeat(n === '' ? 1 : Number(n));
  }
  if (out.length > w) throw new Error(`${where}: ${out.length} pixels in a row of ${w}`);
  return out.padEnd(w, '.');
}

/** A hand-drawn part. `h` defaults to the number of rows; missing rows are clear. */
export function part(name: string, w: number, rle: readonly string[], h = rle.length): Part {
  const rows = rle.map((r, i) => decodeRow(r, w, `${name} row ${i}`));
  while (rows.length < h) rows.push('.'.repeat(w));
  return { name, w, h, rows };
}

export const flipX = (p: Part): Part => ({ ...p, name: `${p.name}~x`, rows: p.rows.map((r) => [...r].reverse().join('')) });
export const flipY = (p: Part): Part => ({ ...p, name: `${p.name}~y`, rows: [...p.rows].reverse() });
/** Quarter turn clockwise. */
export function rotCW(p: Part): Part {
  const rows = Array.from({ length: p.w }, (_, x) => Array.from({ length: p.h }, (_, y) => p.rows[p.h - 1 - y]?.[x] ?? '.').join(''));
  return { name: `${p.name}~cw`, w: p.h, h: p.w, rows };
}
export const rot180 = (p: Part): Part => flipY(flipX(p));
export const rotCCW = (p: Part): Part => rotCW(rot180(p));

export interface Placed {
  part: Part;
  x: number;
  y: number;
}
export type Frame = Placed[];

export const at = (part: Part, x: number, y: number): Placed => ({ part, x: Math.round(x), y: Math.round(y) });

export interface CharacterArt {
  id: string;
  w: number;
  h: number;
  /** Tag -> frames, e.g. `windup` -> six frames. */
  tags: Record<string, Frame[]>;
}

/** Palette index per pixel, -1 where clear. Later parts draw over earlier ones; off-frame pixels clip. */
export function rasterize(frame: Frame, w: number, h: number): Int8Array {
  const out = new Int8Array(w * h).fill(-1);
  for (const { part, x, y } of frame) {
    part.rows.forEach((row, j) => {
      const py = y + j;
      if (py < 0 || py >= h) return;
      for (let i = 0; i < row.length; i++) {
        const px = x + i;
        const k = KEYS.indexOf(row[i] ?? '.');
        if (k >= 0 && px >= 0 && px < w) out[py * w + px] = k;
      }
    });
  }
  return out;
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
