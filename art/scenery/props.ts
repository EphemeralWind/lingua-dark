// Props the world view draws over a room backdrop: doors in each state, and the bonfire.
// Door states differ by shape, never only by colour: an open arch, a portcullis (locked), a
// planked door with three empty seal sockets (sealed), and the open arch with the sockets lit
// (gate open). Positions match scenes/worldView.ts: the far door's opening is x 146..173,
// y 60..103; the side doors stand on the side walls in perspective (art/scenery/rooms.ts).
import { mirrored, type CharacterArt, type Part } from '../kit';
import { hash, PixelCanvas, states } from './canvas';
import { VP } from './rooms';

const DOOR_STATES = ['open', 'locked', 'sealed', 'gate_open'] as const;
type DoorState = (typeof DOOR_STATES)[number];

/** A seal socket: a diamond, empty or lit. */
function socket(c: PixelCanvas, cx: number, cy: number, lit: boolean): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      // Empty: a pale stone rim round a dark hole. Lit: filled with seal light.
      if (d === 2) c.set(cx + dx, cy + dy, lit ? 'A' : 'O');
      else if (d < 2) c.set(cx + dx, cy + dy, lit ? (d === 0 ? 'S' : 'e') : 'A');
    }
  }
}

/** What fills an opening: dark beyond, iron bars, or a planked door. `a`/`b` run across and down it. */
function opening(state: DoorState, a: number, b: number, depth: number): string {
  if (state === 'locked') {
    const bar = a % 5;
    if (b % 14 < 2) return b % 14 < 1 ? 'Q' : 'P'; // cross bars
    if (bar < 2) return bar < 1 ? 'Q' : 'P';
    if (bar === 2) return 'A';
  }
  if (state === 'sealed') {
    if (b % 16 >= 6 && b % 16 < 8) return b % 16 === 6 ? 'R' : 'P'; // iron straps
    if (a % 6 === 0) return 'A';
    return hash(Math.floor(a / 6), Math.floor(b / 2), 3) < 0.15 ? 'U' : 'V';
  }
  // Dark beyond, a little floor light at the bottom.
  return depth > 0.85 ? 'C' : 'A';
}

/** The far door: a round-arched stone frame, 40x50, opening 28x44 at (6, 6). */
function farDoor(state: DoorState): Part {
  const c = new PixelCanvas(40, 50);
  const cx = 19.5;
  const cy = 20;
  c.each(0, 0, 40, 50, (x, y) => {
    const px = x + 0.5;
    const py = y + 0.5;
    const outer = py >= cy ? px >= 0 && px <= 40 : Math.hypot(px - cx, py - cy) <= 20;
    const hole = px >= 6 && px <= 34 && (py >= cy ? true : Math.hypot(px - cx, py - cy) <= 14);
    if (!outer) return null;
    if (hole) return opening(state, x - 6, y - 6, (y - 6) / 44);
    const rim = py >= cy ? x === 0 || x === 39 || x === 5 || x === 34 : Math.abs(Math.hypot(px - cx, py - cy) - 20) < 0.8 || Math.abs(Math.hypot(px - cx, py - cy) - 14) < 0.8;
    if (rim) return 'A';
    // Voussoirs and jambs: stone blocks with joints.
    const block = py >= cy ? Math.floor(y / 6) : Math.floor((Math.atan2(py - cy, px - cx) + Math.PI) * 4);
    const joint = py >= cy ? y % 6 === 0 : Math.abs(Math.sin((Math.atan2(py - cy, px - cx) + Math.PI) * 4 * Math.PI)) < 0.12;
    if (joint) return 'K';
    return hash(block, x < 20 ? 0 : 1, 5) < 0.5 ? (x < 20 ? 'N' : 'M') : x < 20 ? 'M' : 'L';
  });
  if (state === 'sealed' || state === 'gate_open') {
    const lit = state === 'gate_open';
    socket(c, 20, 3, lit);
    socket(c, 9, 8, lit);
    socket(c, 30, 8, lit);
  }
  return c.toPart(`door far ${state}`);
}

/** Side-door box on screen (left wall): x 33..60, y 58..119. The right wall's is its mirror. */
export const SIDE = { x: 33, y: 58, w: 28, h: 62 } as const;
const zAt = (sx: number): number => 100 / ((VP.x - sx) / 90);

function sideDoor(state: DoorState): Part {
  const c = new PixelCanvas(SIDE.w, SIDE.h);
  const zNear = zAt(36);
  const zFar = zAt(58);
  const zc = (zNear + zFar) / 2;
  const r = (zFar - zNear) / 2;
  const vTop = 5;
  c.each(0, 0, SIDE.w, SIDE.h, (i, j) => {
    const sx = SIDE.x + i + 0.5;
    const s = (VP.x - sx) / 90;
    const z = 100 / s;
    const v = (SIDE.y + j + 0.5 - VP.y) / s;
    if (v > 35) return null;
    const archV = vTop + r;
    const inHole = (pad: number): boolean =>
      z >= zNear - pad && z <= zFar + pad && v >= vTop - pad && (v >= archV ? true : Math.hypot(z - zc, v - archV) <= r + pad);
    if (inHole(0)) return opening(state, Math.floor(z - zNear), Math.floor(v - vTop), (v - vTop) / 30);
    if (inHole(0.9)) return 'A';
    if (inHole(3.2)) return (z < zc ? 'M' : 'L');
    if (inHole(4)) return 'A';
    return null;
  });
  if (state === 'sealed' || state === 'gate_open') {
    // Three seal sockets on the wall above the door, following the wall's slope.
    for (const sx of [39, 47, 55]) {
      const s = (VP.x - sx - 0.5) / 90;
      socket(c, sx - SIDE.x, Math.round(VP.y - 6 * s) - SIDE.y, state === 'gate_open');
    }
  }
  return c.toPart(`door side ${state}`);
}

/** The near (south) exit: the top of an arch at the bottom edge of the screen, 128x14. */
function nearDoor(closed: boolean): Part {
  const c = new PixelCanvas(128, 14);
  c.each(0, 0, 128, 14, (x, y) => {
    const inner = x >= 10 && x <= 117 && y >= 4 && !((x < 14 || x > 113) && y < 8 && Math.hypot(x < 14 ? x - 14 : x - 113, y - 8) > 4);
    const edge = x >= 9 && x <= 118 && y >= 3 && !inner;
    if (inner) return closed ? ((x - 10) % 6 < 2 ? ((x - 10) % 6 < 1 ? 'Q' : 'P') : (x - 10) % 6 === 2 ? 'A' : y > 10 ? 'C' : 'B') : y > 10 ? 'D' : 'C';
    if (edge || y === 0 || x === 0 || x === 127) return 'A';
    return hash(Math.floor(x / 10), Math.floor(y / 7), 9) < 0.5 ? 'L' : 'K';
  });
  return c.toPart(`door near ${closed ? 'closed' : 'open'}`);
}

// --- the bonfire ---------------------------------------------------------------

const logs = mirrored('bonfire logs', 14, [
  '2. 3A',
  '1. A W V A',
  '2. A W V A',
  '3. A W V A',
  '4. A W V 2A',
  '5. A W V A W',
  '6. A V 2W',
  '6. 2A V U',
]);

/** A ring of stones around the fire, 44 wide. */
function stones(c: PixelCanvas): void {
  c.each(0, 24, 44, 10, (x, y) => {
    const d = Math.hypot((x + 0.5 - 22) / 21, (y + 0.5 - 29) / 4.6);
    if (d > 1 || d < 0.62) return null;
    const ang = Math.atan2(y + 0.5 - 29, x + 0.5 - 22);
    const stone = Math.floor((ang + Math.PI) * 3.2);
    if (Math.abs(Math.sin((ang + Math.PI) * 3.2 * Math.PI)) < 0.25 || d > 0.92) return 'A';
    return y < 28 ? (hash(stone, 1, 11) < 0.5 ? 'O' : 'N') : hash(stone, 2, 11) < 0.5 ? 'N' : 'L';
  });
}

/** A flame, swaying by `phase`. White-hot core, orange body, deep orange edge. */
function flame(c: PixelCanvas, phase: number): void {
  c.each(10, 0, 24, 30, (x, y) => {
    const t = (y + 0.5) / 28; // 0 at the tip, 1 at the base
    if (t > 1) return null;
    const sway = Math.sin(t * 5 + phase) * (1 - t) * 3;
    const half = 8.5 * Math.pow(t, 0.75);
    const d = Math.abs(x + 0.5 - 22 - sway) / Math.max(half, 0.01);
    if (d > 1) return null;
    if (d < 0.35 && t > 0.45) return 'e';
    if (d < 0.7) return 'c';
    return 'd';
  });
}

function bonfire(phase: number): Part {
  const c = new PixelCanvas(44, 34);
  flame(c, phase);
  c.stamp(logs, 8, 23);
  stones(c);
  return c.toPart(`bonfire ${phase}`);
}

export const PROPS: readonly CharacterArt[] = [
  states('door_far', 40, 50, Object.fromEntries(DOOR_STATES.map((s) => [s, [farDoor(s)]]))),
  states('door_side', SIDE.w, SIDE.h, Object.fromEntries(DOOR_STATES.map((s) => [s, [sideDoor(s)]]))),
  states('door_near', 128, 14, { open: [nearDoor(false)], closed: [nearDoor(true)] }),
  states('bonfire', 44, 34, { burn: [bonfire(0), bonfire(2.4)] }),
];
