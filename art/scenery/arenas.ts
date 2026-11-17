// Fight arenas, in the three layers drawArena (scenes/fight.ts) paints: a back layer (sky,
// walls), a far strip 64 wide that tiles and drifts slowly (still with reduced motion), and a
// near layer (floor and edge pillars, clear above the floor). Back and near cover screen rows
// 28..179, under the prompt band; the far strip's bottom sits on the horizon at row 82.
import { mirrored, type CharacterArt, type Part } from '../kit';
import { hash, PixelCanvas, still } from './canvas';
import { masonry, moon, planks, slabs, type Surface } from './rooms';

const W = 320;
const H = 152;
/** Screen row of the layers' top, and of the horizon where the floor starts. */
const TOP = 28;
const HORIZON = 82;
const VP_Y = 40;

/** The floor in perspective: each pixel below the horizon textured in world units. */
function floor(c: PixelCanvas, s: Surface): void {
  const at = (x: number, y: number): [number, number] => {
    const k = (y + TOP + 0.5 - VP_Y) / (HORIZON - VP_Y);
    return [(x + 0.5 - 160) / k, 100 / k];
  };
  c.each(0, HORIZON - TOP, W, H - (HORIZON - TOP), (x, y) => {
    const [u, v] = at(x, y);
    const id = s.id(u, v);
    const [lu, lv] = at(x - 1, y);
    const [uu, uv] = at(x, y - 1);
    if (y === HORIZON - TOP) return 'A';
    return id !== s.id(lu, lv) || id !== s.id(uu, uv) ? s.joint : s.color(u, v, id);
  });
}

/** Square stone posts at both edges, full height. */
function posts(c: PixelCanvas, bricks: readonly string[], joint: string, cap: string): void {
  for (const side of [0, 1]) {
    c.each(side ? W - 14 : 0, 0, 14, H, (x, y) => {
      const lx = side ? W - 1 - x : x;
      if (lx === 13) return 'A';
      if (y < 4) return y === 3 ? 'A' : cap;
      const row = Math.floor(y / 5);
      const col = Math.floor((lx + (row & 1) * 3) / 7);
      if (y % 5 === 0 || (lx + (row & 1) * 3) % 7 === 0) return joint;
      return bricks[Math.floor(hash(row, col + side * 9, 3) * bricks.length)] ?? joint;
    });
  }
}

// --- village -------------------------------------------------------------------

function villageBack(): Part {
  const c = new PixelCanvas(W, H);
  const ridge = (x: number): number => 30 + Math.round(6 * Math.sin(x * 0.031) + 4 * Math.sin(x * 0.077 + 1.3) + 2 * Math.sin(x * 0.19));
  c.each(0, 0, W, H, (x, y) => {
    if (y >= HORIZON - TOP) return 'H';
    const r = ridge(x);
    if (y > r) return y === r + 1 ? 'F' : 'E';
    if (y === r) return 'A';
    if (hash(x, y, 7) < 0.01) return hash(x, y, 11) < 0.5 ? 'P' : 'N';
    return y < 10 ? 'B' : y < 22 ? 'C' : 'D';
  });
  // Right of centre, clear of the HUD icon at the top left.
  c.stamp(moon, 236, 6);
  return c.toPart('arena village back');
}

/** A cottage and a shed, one lit window: the strip tiles every 64 pixels. */
const cottages = (): Part => {
  const c = new PixelCanvas(64, 28);
  // Cottage: walls x 6..37 rows 14..27, gable roof above, chimney.
  c.fill(6, 14, 32, 14, 'G');
  c.each(2, 2, 40, 13, (x, y) => (Math.abs(x + 0.5 - 22) <= (y - 1) * 1.6 ? (Math.abs(x + 0.5 - 22) > (y - 1) * 1.6 - 1.2 || y === 14 ? 'A' : 'F') : null));
  c.fill(30, 3, 4, 8, 'F');
  c.fill(30, 3, 4, 1, 'A');
  c.fill(13, 18, 4, 4, 'd');
  c.fill(14, 19, 2, 2, 'c');
  c.fill(24, 19, 6, 9, 'E');
  c.each(6, 14, 32, 14, (x) => (x === 6 || x === 37 ? 'A' : null));
  // Shed.
  c.each(44, 16, 16, 12, (x, y) => (y === 16 || x === 44 || x === 59 ? 'A' : y < 19 ? 'F' : 'G'));
  return c.toPart('arena village far');
};

function villageNear(): Part {
  const c = new PixelCanvas(W, H);
  floor(c, slabs(9, 6, ['H', 'I', 'I', 'J'], 'K', 'F'));
  posts(c, ['E', 'F', 'F'], 'D', 'G');
  return c.toPart('arena village near');
}

// --- bell tower --------------------------------------------------------------------

/** The bell's empty yoke: a beam on two posts, the hook it hung from. */
const yoke = mirrored('bell yoke', 60, [
  '20. 40A',
  '19. A 40W',
  '18. A W 40V',
  '18. A 41U',
  '18. 42A',
  ...Array.from({ length: 40 }, () => '20. A W U A 34.'),
]);
const hook = mirrored('yoke hook', 3, ['1. 2A', 'A 2Q', 'A Q 1.', 'A Q 1.', 'A 2Q', '1. 2A'], true);

function towerBack(): Part {
  const c = new PixelCanvas(W, H);
  const wall = masonry(12, 6, ['X', 'X', 'Y'], 'Z', 'A');
  c.each(0, 0, W, H, (x, y) => {
    const id = wall.id(x, y);
    return id !== wall.id(x - 1, y) || id !== wall.id(x, y - 1) ? wall.joint : wall.color(x, y, id);
  });
  // A tall arched window onto the night.
  c.each(124, 2, 72, 52, (x, y) => {
    const cx = 160;
    const inside = y >= 30 ? Math.abs(x + 0.5 - cx) <= 34 : Math.hypot(x + 0.5 - cx, (y - 30) * 1.3) <= 34;
    const frame = y >= 30 ? Math.abs(x + 0.5 - cx) <= 36 : Math.hypot(x + 0.5 - cx, (y - 30) * 1.3) <= 36;
    if (inside) return hash(x, y, 5) < 0.012 ? 'P' : y < 18 ? 'B' : 'C';
    if (frame) return 'A';
    return null;
  });
  c.stamp(moon, 172, 12);
  c.fill(0, HORIZON - TOP - 2, W, 2, 'A');
  c.stamp(yoke, 100, 4);
  c.stamp(hook, 157, 9);
  return c.toPart('arena boss back');
}

/** Embers and ash drifting through the tower: mostly clear. */
function embers(): Part {
  const c = new PixelCanvas(64, 54);
  c.each(0, 0, 64, 54, (x, y) => {
    const n = hash(x, y, 13);
    return n < 0.006 ? 'c' : n < 0.012 ? 'd' : n < 0.02 ? 'L' : null;
  });
  return c.toPart('arena boss far');
}

function towerNear(): Part {
  const c = new PixelCanvas(W, H);
  floor(c, planks(9, ['T', 'U', 'U'], 'A'));
  posts(c, ['X', 'Y', 'Y'], 'A', 'Z');
  return c.toPart('arena boss near');
}

export const ARENAS: readonly CharacterArt[] = [
  still('arena_village_back', villageBack()),
  still('arena_village_far', cottages()),
  still('arena_village_near', villageNear()),
  still('arena_boss_back', towerBack()),
  still('arena_boss_far', embers()),
  still('arena_boss_near', towerNear()),
];
