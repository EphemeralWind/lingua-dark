// Room backdrops (320x180), one per backdrop type in the zone data. A room is a box seen in
// one-point perspective: the far wall fills x 70..249, y 34..103, as the world view's doors
// expect (scenes/worldView.ts), and the side walls, floor and ceiling run to the screen edges.
// Each pixel is traced to the surface it lands on and textured there in world units, so bricks
// and flagstones foreshorten toward the vanishing point; mortar is drawn wherever a pixel's
// brick differs from its neighbour's. Hand-drawn props are stamped on top. Doors, the
// bonfire and the echo are drawn by the game over the backdrop (art/scenery/props.ts).
import { darken, mirrored, part, type CharacterArt, type Part } from '../kit';
import { hash, PixelCanvas, still } from './canvas';

export const VP = { x: 160, y: 69 } as const;
const HALF_W = 90;
const HALF_H = 35;
/** The far wall's distance from the eye, in world units (1 unit = 1 pixel on the far wall). */
const FAR_Z = 100;

type Plane = 'far' | 'left' | 'right' | 'floor' | 'ceiling';
interface Hit {
  plane: Plane;
  /** Along the surface: across (far wall, floor, ceiling) or depth (side walls). */
  u: number;
  /** Up the surface (walls, down is positive) or depth (floor, ceiling). */
  v: number;
  z: number;
}

/** Which surface a pixel shows, and where on it. */
export function trace(x: number, y: number, plane?: Plane): Hit {
  const cx = x + 0.5 - VP.x;
  const cy = y + 0.5 - VP.y;
  const sx = Math.abs(cx) / HALF_W;
  const sf = cy / HALF_H;
  const sc = -cy / HALF_H;
  const s = Math.max(sx, sf, sc);
  const p: Plane = plane ?? (s < 1 ? 'far' : s === sx ? (cx < 0 ? 'left' : 'right') : sf >= sc ? 'floor' : 'ceiling');
  switch (p) {
    case 'far':
      return { plane: p, u: cx, v: cy, z: FAR_Z };
    case 'left':
    case 'right': {
      const k = Math.max(sx, 0.01);
      return { plane: p, u: FAR_Z / k, v: cy / k, z: FAR_Z / k };
    }
    case 'floor':
    case 'ceiling': {
      const k = Math.max(p === 'floor' ? sf : sc, 0.01);
      return { plane: p, u: cx / k, v: FAR_Z / k, z: FAR_Z / k };
    }
  }
}

/** A point on a side wall (depth z, height v; v = 35 is the floor) in screen pixels. */
export function onSideWall(z: number, v: number, side: 'left' | 'right'): { x: number; y: number } {
  const s = FAR_Z / z;
  return { x: Math.round(side === 'left' ? VP.x - HALF_W * s : VP.x + HALF_W * s - 1), y: Math.round(VP.y + v * s) };
}

// --- surfaces ----------------------------------------------------------------

export interface Surface {
  /** Which brick, stone or plank a point is on; a change of id between pixels is a joint. */
  id(u: number, v: number): string;
  color(u: number, v: number, id: string): string;
  joint: string;
}

const pick = (keys: readonly string[], n: number): string => keys[Math.floor(n * keys.length)] ?? keys[0] ?? 'A';

/** Running-bond masonry: blocks w by h, every other course offset by half a block. */
export function masonry(w: number, h: number, bases: readonly string[], hi: string, joint: string): Surface {
  const at = (u: number, v: number): [number, number] => {
    const row = Math.floor(v / h);
    return [row, Math.floor((u + (row & 1) * (w / 2)) / w)];
  };
  return {
    id: (u, v) => at(u, v).join(','),
    color: (u, v) => {
      const [row, col] = at(u, v);
      const base = pick(bases, hash(row, col, 7));
      if (v - row * h < 0.9) return hi;
      return hash(Math.floor(u * 1.5), Math.floor(v * 1.5), 3) < 0.07 ? darken(base) : base;
    },
    joint,
  };
}

/** Floor slabs w wide and d deep; `checker` alternates two bases like chapel tiles. */
export function slabs(w: number, d: number, bases: readonly string[], hi: string, joint: string, checker = false): Surface {
  const at = (u: number, v: number): [number, number] => {
    const row = Math.floor(v / d);
    return [row, Math.floor((u + (checker ? 0 : (row & 1) * (w / 2))) / w)];
  };
  return {
    id: (u, v) => at(u, v).join(','),
    color: (u, v) => {
      const [row, col] = at(u, v);
      const base = checker ? (bases[(row + col) & 1] ?? 'H') : pick(bases, hash(row, col, 11));
      if (v - row * d > d - 1.2) return hi; // the lit near edge of each slab
      return hash(Math.floor(u), Math.floor(v), 5) < 0.05 ? darken(base) : base;
    },
    joint,
  };
}

/** Planks running away from the eye, w wide, with staggered butt joints and grain. */
export function planks(w: number, bases: readonly string[], joint: string): Surface {
  const at = (u: number, v: number): [number, number] => {
    const col = Math.floor(u / w);
    return [col, Math.floor((v + hash(col, 1, 13) * 40) / 40)];
  };
  return {
    id: (u, v) => at(u, v).join(','),
    color: (u, v) => {
      const [col, seg] = at(u, v);
      const base = pick(bases, hash(col, seg, 17));
      return hash(col, Math.floor(v / 2), 19) < 0.12 ? darken(base) : base;
    },
    joint,
  };
}

/** Beams across the ceiling every `gap` units, dark between. */
function beams(gap: number, wood: readonly string[], dark: string, joint: string): Surface {
  return {
    id: (_u, v) => String(Math.floor(v / gap) * 2 + (v % gap < 4 ? 1 : 0)),
    color: (u, v) => (v % gap < 4 ? (v % gap < 1.2 ? (wood[0] ?? 'W') : pick(wood.slice(1), hash(Math.floor(u / 6), Math.floor(v / gap), 23))) : dark),
    joint,
  };
}

const flat = (key: string): Surface => ({ id: () => '', color: () => key, joint: key });

// --- light -------------------------------------------------------------------

/** Firelight: greys turn warm and a step lighter near a flame; dimmer farther out. */
const WARM: Record<string, string> = { E: 'T', F: 'T', G: 'U', H: 'U', I: 'V', J: 'V', K: 'W', L: 'W', M: 'W', N: 'W', O: 'W' };
const EMBER: Record<string, string> = { E: 'T', F: 'T', G: 'T', H: 'T', I: 'U', J: 'U', K: 'V', L: 'V', M: 'V', N: 'W', O: 'W' };
export interface Light {
  x: number;
  y: number;
  r: number;
}
function lit(k: string, x: number, y: number, lights: readonly Light[]): string {
  for (const l of lights) {
    const d = Math.hypot(x - l.x, (y - l.y) * 1.4);
    // A bright core, a dimmer pool, then a checkerboard edge: ordered falloff reads cleaner than noise.
    if (d < l.r * 0.4) return WARM[k] ?? k;
    if (d < l.r * 0.75) return EMBER[k] ?? k;
    if (d < l.r && (x + y) % 2 === 0) return EMBER[k] ?? k;
  }
  return k;
}

// --- the room ------------------------------------------------------------------

export interface RoomStyle {
  far: Surface;
  side: Surface;
  floor: Surface;
  ceiling: Surface;
  /** The corner line where two surfaces meet. */
  edge: string;
  lights?: readonly Light[];
  /** Outdoor rooms paint their own sky, trees or hedges over the box. */
  paint?: (c: PixelCanvas) => void;
  /** Hand-drawn props, stamped last. */
  props?: (c: PixelCanvas) => void;
}

export function renderRoom(name: string, style: RoomStyle): Part {
  const c = new PixelCanvas(320, 180);
  const surface = (p: Plane): Surface => (p === 'far' ? style.far : p === 'floor' ? style.floor : p === 'ceiling' ? style.ceiling : style.side);
  c.each(0, 0, 320, 180, (x, y) => {
    const h = trace(x, y);
    const s = surface(h.plane);
    const left = trace(x - 1, y);
    const up = trace(x, y - 1);
    let k: string;
    if ((x > 0 && left.plane !== h.plane) || (y > 0 && up.plane !== h.plane)) k = style.edge;
    else {
      const id = s.id(h.u, h.v);
      const l = trace(x - 1, y, h.plane);
      const u = trace(x, y - 1, h.plane);
      k = id !== s.id(l.u, l.v) || id !== s.id(u.u, u.v) ? s.joint : s.color(h.u, h.v, id);
    }
    return lit(k, x, y, style.lights ?? []);
  });
  style.paint?.(c);
  style.props?.(c);
  return c.toPart(name);
}

// --- props -------------------------------------------------------------------

/** An iron wall sconce with a burning torch. */
const torch = part('wall torch', 7, [
  '3. e',
  '2. e c',
  '2. c e d',
  '1. d c e c',
  '1. d c c d',
  '2. A d A',
  '1. 5A',
  'A Q 3P Q A',
  '2. A O A',
  '2. A W A',
  '2. A V A',
  '2. A V A',
  '2. A U A',
  '1. A 3P A',
  '2. 3A',
]);

/** A pointed chapel window, moonlit glass in lead cames. */
const windowArch = mirrored('chapel window', 8, [
  '6. 2A',
  '5. A R',
  '4. A R Q',
  '3. A R Q P',
  '3. A R A P',
  '2. A R Q A P',
  '2. A Q Q A P',
  '2. A Q P A P',
  ...Array.from({ length: 3 }, () => '2. A Q P A P'),
  '2. 6A',
  ...Array.from({ length: 4 }, () => '2. A P O A O'),
  '2. 6A',
  ...Array.from({ length: 4 }, () => '2. A O N A N'),
  '1. 7A',
  '1. A 3M 3L',
  '1. 7A',
]);

/** A square column standing against the far wall. */
const column = (h: number): Part =>
  part('column', 12, ['12A', 'A 2M 6L 2K A', '12A', ...Array.from({ length: h - 6 }, () => '1. A M 2L 3K 2J A'), '12A', 'A 2M 6L 2K A', '12A']);

/** The bell carved above the boss gate. */
const bellRelief = mirrored('bell relief', 14, [
  '11. 3A',
  '10. A Z A',
  '8. 3A Y 2A',
  '6. 2A Z 3Y X',
  '5. A Z 4Y 2X',
  '4. A Z 5Y 2X',
  '4. A Z 5Y 2X',
  '4. A Z 5Y 2X',
  '3. A Z 6Y 2X',
  '3. A Z 6Y 2X',
  '2. A Z 7Y 2X',
  '1. A Z 8Y 2X',
  'A Z 9Y 2X',
  'A Z 9Y 2X',
  '14A',
  '10. A 3c',
  '11. A 2d',
  '12. 2A',
]);

/** A hanging bell rope. */
const rope = (len: number): Part => part('bell rope', 3, [...Array.from({ length: len }, (_, i) => (i % 3 === 0 ? 'A V A' : 'A W A')), 'A V A', '3A', 'A U A', '1. A']);

/** The moon. */
export const moon = mirrored('moon', 5, ['2. 3S', '1. S 2R', 'S 2R 2Q', 'S R 3Q', 'S R 2Q P', 'S 2R 2Q', '1. S 2R', '2. 3S']);

function stampSide(c: PixelCanvas, p: Part, z: number, v: number): void {
  const l = onSideWall(z, v, 'left');
  const r = onSideWall(z, v, 'right');
  c.stamp(p, l.x - Math.floor(p.w / 2), l.y);
  c.stamp({ ...p, rows: p.rows.map((row) => [...row].reverse().join('')) }, r.x - Math.ceil(p.w / 2) + 1, r.y);
}

// --- the rooms -----------------------------------------------------------------

const TORCH_Z = 72;
const TORCH_V = -14;
const torchLights = (): Light[] => {
  const l = onSideWall(TORCH_Z, TORCH_V, 'left');
  const r = onSideWall(TORCH_Z, TORCH_V, 'right');
  return [
    { x: l.x, y: l.y + 2, r: 26 },
    { x: r.x, y: r.y + 2, r: 26 },
  ];
};

const STYLES: Record<string, RoomStyle> = {
  /** Lanes, the well and the cellar: grey brick, flagstones, torches. */
  corridor: {
    far: masonry(12, 6, ['I', 'I', 'J'], 'K', 'G'),
    side: masonry(12, 6, ['J', 'K', 'K'], 'L', 'H'),
    floor: slabs(22, 12, ['I', 'J'], 'K', 'G'),
    ceiling: masonry(16, 8, ['F', 'G'], 'G', 'D'),
    edge: 'E',
    lights: torchLights(),
    props: (c) => stampSide(c, torch, TORCH_Z, TORCH_V),
  },
  /** Chapel and forge: dressed stone, moonlit windows, columns, a tiled floor and a runner. */
  hall: {
    far: masonry(18, 9, ['J', 'J', 'K'], 'L', 'H'),
    side: masonry(18, 9, ['K', 'L'], 'M', 'I'),
    floor: {
      ...slabs(16, 10, ['I', 'K'], 'L', 'G', true),
      color: (u, v, id) => (Math.abs(u) < 14 ? (Math.abs(u) > 12 ? 'X' : v % 10 > 9 ? 'Y' : 'Z') : slabs(16, 10, ['I', 'K'], 'L', 'G', true).color(u, v, id)),
      id: (u, v) => (Math.abs(u) < 14 ? `runner${Math.abs(u) > 12 ? 'edge' : ''}` : slabs(16, 10, ['I', 'K'], 'L', 'G', true).id(u, v)),
    },
    ceiling: beams(18, ['W', 'V', 'U'], 'C', 'B'),
    edge: 'G',
    lights: torchLights(),
    props: (c) => {
      for (const x of [94, 210]) c.stamp(windowArch, x, 40);
      c.stamp(column(70), 70, 34);
      c.stamp(column(70), 238, 34);
      stampSide(c, torch, TORCH_Z, TORCH_V);
    },
  },
  /** The orchard: night sky, apple trees behind a low wall, hedges, grass and a crossing path. */
  crossroads: {
    far: masonry(10, 5, ['K', 'L'], 'M', 'I'),
    side: flat('F'),
    floor: {
      id: () => '',
      joint: 'F',
      color: (u, v) => {
        const path = Math.abs(u) < 18 || (v > 64 && v < 74);
        if (path) return hash(Math.floor(u * 2), Math.floor(v * 2), 31) < 0.05 ? 'V' : hash(Math.floor(u / 3), Math.floor(v / 3), 37) < 0.5 ? 'U' : 'T';
        if (hash(Math.floor(u * 2), Math.floor(v * 2), 71) < 0.06) return 'H';
        return hash(Math.floor(u / 5), Math.floor(v / 4), 41) < 0.5 ? 'G' : 'F';
      },
    },
    ceiling: flat('B'),
    edge: 'E',
    paint: (c) => {
      // Sky over everything above the wall and hedges, with stars.
      c.each(0, 0, 320, 180, (x, y) => {
        const h = trace(x, y);
        const sky = h.plane === 'ceiling' || (h.plane === 'far' && h.v < 4) || ((h.plane === 'left' || h.plane === 'right') && h.v < -6);
        if (!sky) return null;
        if (hash(x, y, 43) < 0.012) return hash(x, y, 47) < 0.5 ? 'P' : 'N';
        return y < 14 ? 'B' : y < 34 ? 'C' : 'D';
      });
      // Hedges along the sides: clumped leaves.
      c.each(0, 0, 320, 180, (x, y) => {
        const h = trace(x, y);
        if ((h.plane !== 'left' && h.plane !== 'right') || h.v < -6) return null;
        if (h.v < -4.5) return 'A';
        if (hash(x, y, 59) < 0.06) return 'H';
        const clump = hash(Math.floor(h.u / 5), Math.floor(h.v / 5), 53);
        return clump < 0.4 ? 'G' : clump < 0.85 ? 'F' : 'E';
      });
      // Apple trees above the wall: dark crowns with a few apples, trunks to the wall.
      const trees = [
        { x: 92, y: 30, r: 20 },
        { x: 132, y: 22, r: 18 },
        { x: 186, y: 26, r: 21 },
        { x: 232, y: 32, r: 19 },
      ];
      for (const t of trees) {
        c.fill(t.x - 2, t.y + 8, 5, 73 - t.y - 8, 'T');
        c.fill(t.x - 2, t.y + 8, 1, 73 - t.y - 8, 'U');
      }
      c.each(60, 0, 200, 75, (x, y) => {
        for (const t of trees) {
          const d = Math.hypot(x - t.x, (y - t.y) * 1.2);
          const wobble = (hash(Math.floor(Math.atan2(y - t.y, x - t.x) * 6), 0, t.x) - 0.5) * 5;
          if (d < t.r + wobble - 1) {
            if (hash(x, y, 61) < 0.025) return 'a';
            const n = hash(Math.floor(x / 3), Math.floor(y / 3), 67);
            return x - t.x < -(y - t.y) * 0.5 ? (n < 0.5 ? 'G' : 'H') : n < 0.5 ? 'E' : 'F';
          }
          if (d < t.r + wobble) return 'A';
        }
        return null;
      });
    },
    props: (c) => c.stamp(moon, 268, 8),
  },
  /** The bonfire room: grey stone warmed by the fire's glow. The fire itself is a prop. */
  bonfire_room: {
    far: masonry(12, 6, ['I', 'I', 'J'], 'K', 'G'),
    side: masonry(12, 6, ['J', 'K'], 'L', 'H'),
    floor: slabs(20, 12, ['I', 'J'], 'K', 'G'),
    ceiling: beams(16, ['V', 'U', 'T'], 'B', 'A'),
    edge: 'E',
    lights: [
      { x: 232, y: 146, r: 64 },
      { x: 276, y: 96, r: 40 },
    ],
  },
  /** Before the boss: great dark blocks, the bell carved over the door, braziers. */
  boss_gate: {
    far: masonry(24, 12, ['U', 'T', 'T'], 'V', 'A'),
    side: masonry(24, 12, ['T', 'U'], 'V', 'A'),
    floor: slabs(28, 14, ['T', 'U'], 'V', 'A'),
    ceiling: flat('A'),
    edge: 'A',
    lights: torchLights(),
    props: (c) => {
      c.stamp(bellRelief, 146, 36);
      stampSide(c, torch, TORCH_Z, TORCH_V);
    },
  },
  /** The bell tower: rust-red brick, plank floor, beams and hanging ropes. */
  boss_arena: {
    far: masonry(12, 6, ['X', 'X', 'Y'], 'Z', 'A'),
    side: masonry(12, 6, ['Y', 'Z'], 'W', 'X'),
    floor: planks(9, ['U', 'V', 'U'], 'T'),
    ceiling: beams(14, ['W', 'V', 'U'], 'X', 'A'),
    edge: 'X',
    props: (c) => {
      for (const [x, len] of [
        [104, 40],
        [126, 22],
        [198, 30],
        [220, 46],
      ] as const)
        c.stamp(rope(len), x, 0);
    },
  },
};

/** Backdrop types that have a hand-drawn room. */
export const ROOM_BACKDROPS = Object.keys(STYLES);

export const ROOMS: readonly CharacterArt[] = Object.entries(STYLES).map(([k, s]) => still(`room_${k}`, renderRoom(`room ${k}`, s)));
