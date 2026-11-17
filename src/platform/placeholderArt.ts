// Programmatic placeholder art (CLAUDE.md: flat coloured shapes until real sprites exist).
// Paints every frame of every character into one canvas laid out as an Aseprite atlas, so the
// game draws placeholders and real art through the same SpriteBank.
//
// The wind-up frames depend only on the frame index: one shared animation that the game
// time-stretches to the answer window. Directional frames exist for north, east and south;
// the game mirrors east for west.
import { layoutAtlas, parseAtlas, type Sheet } from './atlas';
import { CHARACTERS, type CharacterSpec, type Look } from './characters';
import { C } from './palette';

type G = CanvasRenderingContext2D;
type Dir = 'north' | 'east' | 'south';

const UNIT: Record<Dir, { x: number; y: number }> = { north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 } };
/** Weapon angle per strike direction: 0 is up, 90 is screen-right, 180 is down. */
const STRIKE_ANGLE: Record<Dir, number> = { north: 0, east: 90, south: 180 };

function rect(g: G, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A thick line from (x0, y0) at `angle` degrees for `len` pixels. Returns the end point. */
function ray(g: G, x0: number, y0: number, angle: number, len: number, thick: number, color: string): { x: number; y: number } {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  g.fillStyle = color;
  for (let i = 0; i <= len; i++) g.fillRect(Math.round(x0 + dx * i - thick / 2), Math.round(y0 + dy * i - thick / 2), thick, thick);
  return { x: x0 + dx * len, y: y0 + dy * len };
}

function diamond(g: G, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle = color;
  for (let i = -r; i <= r; i++) {
    const w = r - Math.abs(i);
    g.fillRect(Math.round(cx - w), Math.round(cy + i), w * 2 + 1, 1);
  }
}

// --- enemies (facing the camera) -------------------------------------------

interface Pose {
  dx: number;
  dy: number;
  /** 0 standing, 1 kneeling. */
  crouch: number;
  /** 0 standing, 1 lying flat (death). */
  flat: number;
  /** Weapon angle (degrees, 0 up) and length; null when dropped. */
  weapon: { angle: number; reach: number; raise: number } | null;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function enemyPose(tag: string, f: number): Pose {
  const rest: Pose = { dx: 0, dy: 0, crouch: 0, flat: 0, weapon: { angle: 150, reach: 18, raise: 0 } };
  if (tag === 'idle') return { ...rest, dy: [0, 0, 1, 1][f] ?? 0 };
  if (tag === 'windup') {
    // One shared wind-up: the weapon rises overhead and the body draws back, by frame only.
    const t = f / 5;
    return { ...rest, dy: -Math.round(t * 2), weapon: { angle: lerp(150, -25, t), reach: 18, raise: Math.round(t * 6) } };
  }
  const [name, dir] = tag.split('_') as [string, Dir | undefined];
  if (name === 'strike' && dir) {
    const u = UNIT[dir];
    const lunge = [2, 4, 3][f] ?? 0;
    return { ...rest, dx: u.x * lunge, dy: u.y * lunge, weapon: { angle: STRIKE_ANGLE[dir], reach: [20, 28, 24][f] ?? 20, raise: dir === 'north' ? 6 : 0 } };
  }
  if (name === 'recoil' && dir) {
    const u = UNIT[dir];
    const push = [3, 5, 4, 2][f] ?? 0;
    return { ...rest, dx: -u.x * push, dy: -u.y * Math.min(push, 3), weapon: { angle: STRIKE_ANGLE[dir] + 150 + f * 10, reach: 16, raise: 0 } };
  }
  if (tag === 'break') return { ...rest, crouch: (f + 1) / 4, dy: 0, weapon: f < 2 ? { angle: 200, reach: 16, raise: 0 } : null };
  if (tag === 'death') return { ...rest, crouch: Math.min(1, f / 2), flat: Math.max(0, (f - 2) / 3), weapon: null };
  return rest;
}

function paintHead(g: G, look: Look, cx: number, top: number, s: number): void {
  const k = (n: number): number => Math.round(n * s);
  switch (look.head) {
    case 'bare':
      rect(g, cx - k(6), top, k(12), k(12), look.body);
      rect(g, cx - k(4), top + k(5), k(2), k(2), C.void);
      rect(g, cx + k(2), top + k(5), k(2), k(2), C.void);
      rect(g, cx - k(3), top + k(9), k(6), 1, look.dark);
      break;
    case 'hood':
      for (let i = 0; i < k(14); i++) {
        const w = Math.min(k(14), Math.round(i * 1.1) + 2);
        rect(g, cx - w / 2, top - k(2) + i, w, 1, look.dark);
      }
      rect(g, cx - k(4), top + k(5), k(8), k(7), C.void);
      rect(g, cx - k(3), top + k(7), k(2), 1, look.light);
      rect(g, cx + k(1), top + k(7), k(2), 1, look.light);
      break;
    case 'helm':
      rect(g, cx - k(7), top, k(14), k(12), look.dark);
      rect(g, cx - k(8), top + k(3), k(16), k(2), look.light);
      rect(g, cx - k(5), top + k(6), k(10), k(2), C.void);
      break;
    case 'cowl':
      rect(g, cx - k(7), top - k(1), k(14), k(13), look.dark);
      rect(g, cx - k(5), top + k(3), k(10), k(8), C.void);
      rect(g, cx - k(3), top + k(6), k(2), k(1), look.light);
      rect(g, cx + k(1), top + k(6), k(2), k(1), look.light);
      break;
    case 'beak':
      rect(g, cx - k(6), top, k(12), k(11), look.dark);
      for (let i = 0; i < k(8); i++) rect(g, cx - k(2) + i, top + k(5) + Math.floor(i / 2), Math.max(1, k(8) - i), 1, C.wood);
      rect(g, cx - k(4), top + k(3), k(2), k(2), C.signal);
      // Feather crest.
      for (let i = 0; i < 3; i++) rect(g, cx - k(5) + i * k(3), top - k(3) + i, k(2), k(4), look.dark);
      break;
    case 'bell': {
      // A cracked bell for a head: narrow crown, wide mouth, one ember eye.
      for (let i = 0; i < k(22); i++) {
        const w = lerp(k(12), k(30), (i / k(22)) ** 2);
        rect(g, cx - w / 2, top + i, w, 1, look.body);
      }
      rect(g, cx - k(15), top + k(21), k(30), k(3), look.light);
      rect(g, cx - k(10), top + k(16), k(20), k(5), C.void);
      diamond(g, cx, top + k(18), k(2), C.ember);
      rect(g, cx + k(3), top + k(2), 1, k(10), look.dark);
      rect(g, cx - k(2), top - k(4), k(4), k(4), look.dark);
      break;
    }
    case 'player':
      break;
  }
}

function paintWeapon(g: G, look: Look, hx: number, hy: number, angle: number, reach: number, s: number): void {
  const len = Math.round(reach * s);
  const end = ray(g, hx, hy, angle, len, Math.max(2, Math.round(2 * s)), look.weapon === 'staff' || look.weapon === 'fork' ? C.wood : C.weapon);
  const t = Math.max(2, Math.round(3 * s));
  switch (look.weapon) {
    case 'hammer':
    case 'bellHammer':
      rect(g, end.x - t * 1.5, end.y - t * 1.5, t * 3, t * 3, look.weapon === 'bellHammer' ? look.light : C.weapon);
      break;
    case 'fork':
      ray(g, end.x, end.y, angle - 20, Math.round(5 * s), 1, C.weapon);
      ray(g, end.x, end.y, angle, Math.round(6 * s), 1, C.weapon);
      ray(g, end.x, end.y, angle + 20, Math.round(5 * s), 1, C.weapon);
      break;
    case 'staff':
      diamond(g, end.x, end.y, t, C.pale);
      break;
    case 'claw':
      for (const off of [-25, 0, 25]) ray(g, end.x, end.y, angle + off, Math.round(5 * s), 1, C.pale);
      break;
    case 'sword':
      ray(g, end.x, end.y, angle, Math.round(4 * s), 1, C.pale);
      rect(g, hx - t, hy - 1, t * 2, 2, C.wood);
      break;
  }
}

function paintEnemy(g: G, spec: CharacterSpec, tag: string, f: number, ox: number, oy: number): void {
  const look = spec.look;
  const s = spec.h / 64;
  const k = (n: number): number => Math.round(n * s);
  const p = enemyPose(tag, f);
  const cx = ox + spec.w / 2 + p.dx;
  const base = oy + spec.h - 1;
  const bw = k(20 * look.bulk);

  if (p.flat > 0) {
    // Collapsing: the body tips over into a heap.
    const h = Math.round(lerp(k(30), k(8), p.flat));
    const w = Math.round(lerp(bw, k(40), p.flat));
    rect(g, cx - w / 2, base - h, w, h, look.body);
    rect(g, cx - w / 2, base - 2, w, 2, look.dark);
    if (p.flat < 1) paintHead(g, look, cx + Math.round(p.flat * k(14)), base - h - k(10), s);
    else rect(g, cx + w / 2 - k(10), base - k(10), k(10), k(10), look.body);
    return;
  }

  const legH = Math.round(lerp(k(12), k(4), p.crouch));
  const torsoH = k(26);
  const top = base - legH - torsoH + p.dy;
  // Legs.
  rect(g, cx - bw / 2 + k(2), base - legH, k(6), legH, look.dark);
  rect(g, cx + bw / 2 - k(8), base - legH, k(6), legH, look.dark);
  // Torso: a tapered robe.
  for (let i = 0; i < torsoH; i++) {
    const w = Math.round(lerp(bw * 0.8, bw, i / torsoH));
    rect(g, cx - w / 2, top + i, w, 1, look.body);
  }
  rect(g, cx - bw / 2, top + torsoH - k(3), bw, k(3), look.dark);
  rect(g, cx - k(1), top + k(4), k(2), torsoH - k(8), look.dark);
  // Head (lowered when kneeling).
  const headTop = top - k(12) + Math.round(p.crouch * k(3));
  paintHead(g, look, cx, headTop, s);
  if (spec.warden) {
    // Warden: a three-spiked crown and a seal diamond on the chest (shape, not colour).
    for (const off of [-5, 0, 5]) rect(g, cx + k(off) - 1, headTop - k(off === 0 ? 7 : 5), k(2), k(off === 0 ? 6 : 4), C.pale);
    rect(g, cx - k(7), headTop - k(2), k(14), k(2), C.pale);
    diamond(g, cx, top + k(9), k(3), C.signal);
    diamond(g, cx, top + k(9), k(1), look.dark);
  }
  // Off arm.
  rect(g, cx - bw / 2 - k(4), top + k(2), k(4), k(14), look.dark);
  // Weapon arm and weapon.
  const hx = cx + bw / 2 + k(1);
  const hy = top + k(12) - (p.weapon?.raise ?? 0) * s;
  rect(g, cx + bw / 2, top + k(2), k(4), k(10) - (p.weapon?.raise ?? 0) * s + k(2), look.dark);
  if (p.weapon) paintWeapon(g, look, hx, hy, p.weapon.angle, p.weapon.reach, s);
  else rect(g, cx + bw / 2 + k(2), base - k(2), k(16), k(2), C.weapon);
}

// --- the player (seen from behind) -----------------------------------------

function paintPlayer(g: G, spec: CharacterSpec, tag: string, f: number, ox: number, oy: number): void {
  const look = spec.look;
  const [name, dir] = tag.split('_') as [string, Dir | undefined];
  let dx = 0;
  let dy = 0;
  let crouch = 0;
  let flat = 0;
  let shield = { x: -14, y: 26 };
  let leg = 0;
  if (name === 'idle') dy = [0, 0, 1, 1][f] ?? 0;
  if (name === 'walk') {
    dy = [0, 1, 0, 1][f] ?? 0;
    leg = [1, 0, -1, 0][f] ?? 0;
  }
  if (name === 'parry' && dir) {
    // Contact on frame 0, then the shield eases back.
    const ext = [1, 0.85, 0.55, 0.25][f] ?? 0;
    const target = dir === 'north' ? { x: 0, y: 2 } : dir === 'east' ? { x: 16, y: 18 } : { x: 0, y: 36 };
    shield = { x: Math.round(lerp(-14, target.x, ext)), y: Math.round(lerp(26, target.y, ext)) };
    dx = UNIT[dir].x * Math.round(2 * ext);
  }
  if (name === 'hit' && dir) {
    const push = [4, 3, 1][f] ?? 0;
    dx = -UNIT[dir].x * push;
    dy = dir === 'north' ? push : dir === 'south' ? -Math.min(push, 2) : 1;
    shield = { x: -18, y: 32 };
  }
  if (name === 'death') {
    crouch = Math.min(1, f / 2);
    flat = Math.max(0, (f - 2) / 3);
  }
  const cx = ox + spec.w / 2 + dx;
  const base = oy + spec.h - 1;
  if (flat > 0) {
    const h = Math.round(lerp(30, 10, flat));
    rect(g, cx - 18, base - h, 36, h, look.body);
    rect(g, cx - 18, base - h, 36, 2, look.light);
    rect(g, cx - 6, base - h - Math.round(lerp(10, 0, flat)), 12, 10, C.void);
    return;
  }
  const legH = Math.round(lerp(14, 5, crouch));
  const top = base - legH - 30 + dy;
  rect(g, cx - 10 + leg, base - legH, 7, legH, look.dark);
  rect(g, cx + 3 - leg, base - legH, 7, legH, look.dark);
  // Cloak and shoulders, from behind.
  rect(g, cx - 16, top, 32, 30, look.light);
  rect(g, cx - 15, top + 1, 30, 29, look.body);
  rect(g, cx - 18, top + 1, 36, 6, look.light);
  rect(g, cx - 1, top + 8, 2, 20, look.dark);
  // Head: hair from behind.
  rect(g, cx - 6, top - 13 + Math.round(crouch * 4), 12, 13, C.void);
  rect(g, cx - 5, top - 12 + Math.round(crouch * 4), 10, 4, look.dark);
  // Sword down the right side.
  ray(g, cx + 17, top + 10, 175, 26, 2, C.weapon);
  // Shield (its back, with the grip): left hand, moved to the parry direction.
  const sx = cx + shield.x;
  const sy = top - 14 + shield.y;
  rect(g, sx - 7, sy - 9, 14, 18, C.weapon);
  rect(g, sx - 5, sy - 7, 10, 14, look.light);
  rect(g, sx - 1, sy - 5, 2, 10, C.wood);
}

// --- sheet -----------------------------------------------------------------

/** Turns opaque pixels with four opaque neighbours transparent: a hollow outline (ghosts). */
function hollowOut(g: G, x: number, y: number, w: number, h: number): void {
  const img = g.getImageData(x, y, w, h);
  const a = (i: number, j: number): number => (i < 0 || j < 0 || i >= w || j >= h ? 0 : (img.data[(j * w + i) * 4 + 3] ?? 0));
  const clear: number[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (a(i, j) && a(i - 1, j) && a(i + 1, j) && a(i, j - 1) && a(i, j + 1)) clear.push((j * w + i) * 4 + 3);
    }
  }
  for (const k of clear) img.data[k] = 0;
  g.putImageData(img, x, y);
}

export function buildPlaceholderSheet(): Sheet {
  const json = layoutAtlas(CHARACTERS);
  const data = parseAtlas(json);
  if (typeof data === 'string') throw new Error(`placeholder atlas: ${data}`);
  const canvas = document.createElement('canvas');
  canvas.width = json.meta.size?.w ?? 1;
  canvas.height = json.meta.size?.h ?? 1;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('Canvas 2D not available');
  for (const spec of CHARACTERS) {
    for (const tag of Object.keys(spec.tags)) {
      const frames = data.tags.get(`${spec.id}/${tag}`) ?? [];
      frames.forEach((index, f) => {
        const r = data.frames[index];
        if (!r) return;
        g.save();
        g.beginPath();
        g.rect(r.x, r.y, r.w, r.h);
        g.clip();
        if (spec.kind === 'player') paintPlayer(g, spec, tag, f, r.x, r.y);
        else paintEnemy(g, spec, tag, f, r.x, r.y);
        g.restore();
        if (spec.look.hollow) hollowOut(g, r.x, r.y, r.w, r.h);
      });
    }
  }
  return { data, image: canvas };
}
