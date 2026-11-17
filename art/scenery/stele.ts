// The four-sided stele by the bonfire (DECISIONS #96): a small pillar in the rest scene, and
// each of its four faces seen up close. The lesson text is drawn by the game over a face, so
// every face keeps the same clean, flat text area (STELE_TEXT) and its wear stays in the rim
// around it. Each face wears differently in shape, not only in colour, so the player can tell
// which side they are looking at: cracked, mossed, chipped, rain-streaked.
import type { CharacterArt, Part } from '../kit';
import { PixelCanvas, hash, states, still } from './canvas';
import { masonry } from './rooms';

/** The stone slab on the 320x180 face view. */
export const STELE_SLAB = { x: 24, y: 4, w: 272, h: 158 } as const;
/** Kept smooth on every face: the title, verse and carved rows are written here. */
export const STELE_TEXT = { x: 46, y: 16, w: 228, h: 134 } as const;

const S = STELE_SLAB;
const T = STELE_TEXT;
const inSlab = (x: number, y: number): boolean => x >= S.x && x < S.x + S.w && y >= S.y && y < S.y + S.h;
const inText = (x: number, y: number): boolean => x >= T.x && x < T.x + T.w && y >= T.y && y < T.y + T.h;

const wall = masonry(16, 8, ['B', 'C', 'C'], 'D', 'A');
function background(x: number, y: number): string {
  const id = wall.id(x, y);
  return id !== wall.id(x - 1, y) || id !== wall.id(x, y - 1) ? wall.joint : wall.color(x, y, id);
}

/** Paints wear: only on the slab and never over the text area. */
function wear(c: PixelCanvas, x: number, y: number, k: string): void {
  if (inSlab(x, y) && !inText(x, y)) c.set(x, y, k);
}

/** A crack along the points: a dark split `width` pixels wide with a lit lip on its right. */
function line(c: PixelCanvas, pts: readonly (readonly [number, number])[], k: string, hi: string, width = 1): void {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1] ?? [0, 0];
    const [x1, y1] = pts[i] ?? [0, 0];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= n; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / n);
      const y = Math.round(y0 + ((y1 - y0) * s) / n);
      for (let w = 0; w < width; w++) wear(c, x - w, y, k);
      wear(c, x + 1, y, hi);
    }
  }
}

/** Face I: a jagged crack across the upper-left corner with flakes spalled off along it, and a hairline at the lower right. */
function cracked(c: PixelCanvas): void {
  const main = [[24, 62], [30, 49], [33, 40], [38, 30], [41, 22], [46, 13], [52, 9], [60, 4]] as const;
  for (const [x, y] of main) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (hash(x + dx, y + dy, 13) < 0.35) wear(c, x + dx, y + dy, 'M');
  }
  line(c, main, 'A', 'Q', 2);
  line(c, [[33, 40], [28, 36], [24, 37]], 'A', 'Q');
  line(c, [[41, 22], [36, 19], [33, 12]], 'B', 'P');
  line(c, [[295, 118], [290, 131], [286, 140], [281, 151], [278, 161]], 'B', 'P');
}

/** Face II: moss climbing from the bottom corners, lichen rosettes on the upper rim. */
function mossed(c: PixelCanvas): void {
  const bottom = S.y + S.h;
  for (let y = S.y; y < bottom; y++) {
    for (let x = S.x; x < S.x + S.w; x++) {
      const fromLeft = x - S.x;
      const fromRight = S.x + S.w - 1 - x;
      const side = Math.min(fromLeft, fromRight);
      const up = bottom - 1 - y;
      // How far the moss reaches in from the side at this height, and up from the floor here.
      const reach = Math.max(0, ((y - 70) / (bottom - 70)) * 18) + hash(x >> 1, y >> 1, 21) * 4;
      const rise = Math.max(0, 22 - side * 0.35) + hash(x >> 1, y >> 1, 22) * 4;
      if (side < reach || up < rise) {
        const n = hash(x, y, 23);
        wear(c, x, y, n < 0.55 ? 'f' : n < 0.85 ? 'K' : 'L');
      }
    }
  }
  for (const [cx, cy] of [[34, 10], [282, 14], [160, 9], [40, 30], [290, 50]] as const) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d = dx * dx + dy * dy;
        if (d <= 4) wear(c, cx + dx, cy + dy, d >= 3 ? 'R' : d === 0 ? 'P' : 'Q');
      }
    }
  }
}

/** Face III: the top-right corner broken off, and pits all round the rim. */
function chipped(c: PixelCanvas): void {
  for (let y = S.y; y < S.y + 36; y++) {
    const edge = 262 + (y - S.y) * 1.15 + (hash(y >> 1, 0, 31) - 0.5) * 4;
    for (let x = Math.floor(edge); x < S.x + S.w; x++) {
      if (inText(x, y)) continue;
      c.set(x, y, background(x, y));
    }
    const e = Math.floor(edge) - 1;
    wear(c, e, y, 'L');
    wear(c, e - 1, y, 'M');
  }
  for (let y = S.y; y < S.y + S.h; y++) {
    for (let x = S.x; x < S.x + S.w; x++) {
      if (c.get(x, y) !== 'O' && c.get(x, y) !== 'N' && c.get(x, y) !== 'P') continue;
      const n = hash(x >> 1, y >> 1, 33);
      if (n < 0.06) wear(c, x, y, (x + y) % 2 === 0 ? 'L' : 'M');
    }
  }
}

/** Face IV: soot blackening the top edge, rain streaks down both sides. */
function weathered(c: PixelCanvas): void {
  for (let x = S.x; x < S.x + S.w; x++) {
    // Soot reaches down unevenly, thickest where smoke curled over the top.
    const reach = 5 + Math.floor(hash(x >> 3, 0, 44) * 5 + hash(x, 0, 45) * 2);
    for (let y = S.y; y < T.y; y++) {
      const depth = y - S.y;
      const k = depth < reach - 3 ? 'K' : depth < reach ? ((x + y) % 2 === 0 ? 'K' : 'L') : depth < reach + 2 && (x + y) % 2 === 0 ? 'L' : null;
      if (k) wear(c, x, y, k);
    }
  }
  for (let x = S.x + 2; x < S.x + S.w - 2; x++) {
    const n = hash(x, 0, 41);
    if (n > 0.35) continue;
    const length = 30 + Math.floor(hash(x, 1, 42) * (S.h - 30));
    for (let y = S.y + 4; y < S.y + length; y++) wear(c, x, y, hash(x, y >> 2, 43) < 0.7 ? 'N' : 'M');
  }
}

const WEAR = [cracked, mossed, chipped, weathered] as const;

function face(index: number): Part {
  const c = new PixelCanvas(320, 180);
  c.each(0, 0, 320, 180, background);
  c.fill(S.x + 4, S.y + 4, S.w, S.h, 'A'); // the slab's shadow on the wall
  c.each(S.x, S.y, S.w, S.h, (x, y) => {
    const n = hash(x, y, 11);
    const speckle = inText(x, y) ? 0.012 : 0.05;
    return n < speckle ? 'P' : n < speckle * 2 ? 'N' : 'O';
  });
  // Bevel: lit from the upper left.
  c.fill(S.x, S.y, S.w, 1, 'Q');
  c.fill(S.x, S.y, 1, S.h, 'Q');
  c.fill(S.x + 1, S.y + 1, S.w - 2, 1, 'P');
  c.fill(S.x + 1, S.y + 1, 1, S.h - 2, 'P');
  c.fill(S.x, S.y + S.h - 1, S.w, 1, 'L');
  c.fill(S.x + S.w - 1, S.y, 1, S.h, 'L');
  c.fill(S.x + 1, S.y + S.h - 2, S.w - 2, 1, 'M');
  c.fill(S.x + S.w - 2, S.y + 1, 1, S.h - 2, 'M');
  WEAR[index]?.(c);
  return c.toPart(`stele face ${index + 1}`);
}

/** The stele in the rest scene: a pillar seen at an angle, its face lit by the fire. */
function pillar(): Part {
  const c = new PixelCanvas(24, 56);
  // Plinth.
  c.fill(0, 50, 24, 6, 'L');
  c.fill(0, 50, 24, 1, 'N');
  c.fill(16, 51, 8, 5, 'K');
  // Shaft: the fire-facing side warm, the far side in shadow.
  c.each(3, 6, 18, 44, (x, y) => {
    if (x >= 15) return x === 15 ? 'K' : hash(x, y, 51) < 0.1 ? 'G' : 'L';
    const n = hash(x, y, 52);
    return x === 3 ? 'd' : n < 0.08 ? 'V' : n < 0.16 ? 'U' : 'W';
  });
  // Carved lines on the face, too small to read from here.
  for (let y = 12; y < 46; y += 4) c.fill(6, y, 6 + Math.floor(hash(y, 0, 53) * 4), 1, 'V');
  // Capstone: a low pyramid.
  for (let r = 0; r < 6; r++) {
    const half = 2 + Math.round(r * 1.4);
    c.fill(12 - half, r, half, 1, r === 0 ? 'd' : 'W');
    c.fill(12, r, half, 1, 'L');
  }
  return c.toPart('stele');
}

export const STELE: readonly CharacterArt[] = [
  still('stele', pillar()),
  states('stele_face', 320, 180, { face: WEAR.map((_, i) => face(i)) }),
];
