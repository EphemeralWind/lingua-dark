// The Hollow Bell, Zone 1's boss: a living bronze bell gone green with age, light leaking from
// cracks for eyes and mouth, an ember clapper glowing in its open lip, two long grey arms and
// a banded bell-maul. 128x112, standing on the bottom edge. Cracked and sunk into the ground
// when it dies. Colour keys (art/kit.ts): A outline, W/Z/Y/X bronze highlight to deep,
// f verdigris, c/d/e ember light, B the dark inside, O/N/L arms, W/V/U maul wood, R/Q/P bands.
//
// The fight's prompt band hides the top of the frame (fight.ts), so the wind-up keeps the
// maul below row 32. The wind-up frames depend on the frame index only.
import { at, blank, flipX, mirrored, paint, part, rot180, rotCCW, rotCW, type CharacterArt, type Frame, type Placed } from '../kit';
import { checkTags } from './rig';

// --- the bell ----------------------------------------------------------------

/** Half-width of the bell by row: crown, shoulder, waist, the flaring sound bow, the lip. */
const PROFILE: readonly (readonly [number, number])[] = [
  [6, 10], [8, 14], [10, 18], [12, 20], [14, 21], [30, 23], [42, 25], [48, 29], [52, 33], [55, 36], [57, 38], [59, 39], [63, 39],
];
function halfWidth(y: number): number {
  for (let i = 1; i < PROFILE.length; i++) {
    const [y1, w1] = PROFILE[i] ?? [0, 0];
    const [y0, w0] = PROFILE[i - 1] ?? [0, 0];
    if (y <= y1) return Math.round(w0 + ((w1 - w0) * (y - y0)) / (y1 - y0));
  }
  return 0;
}

/** Left half of one row (40 pixels). Light from the upper left; the right half is mirrored darker. */
function bellRow(y: number): string {
  if (y < 6) return '.'.repeat(40);
  const s = 40 - halfWidth(y);
  const above = y > 6 ? 40 - halfWidth(y - 1) : 40;
  let out = '';
  for (let i = 0; i < 40; i++) {
    if (i < s) out += '.';
    else if (i === s || i < above || y === 6 || y === 63) out += 'A';
    else if (y >= 60) out += i <= s + 2 ? 'Y' : 'B'; // the lip, then the dark inside
    else if (y === 13 || y === 45) out += 'A'; // raised bands
    else if (y === 14 || y === 46) out += i <= s + 2 ? 'Y' : 'W';
    else out += i <= s + 2 ? 'Y' : i <= s + 5 ? 'W' : 'Z';
  }
  return out;
}

/** Cracked eyes and mouth with ember light inside (left half; mirrored). */
const FACE: readonly (readonly [number, number, string])[] = [
  ...[27, 28, 29, 30, 31].map((x) => [x, 21, 'A'] as const),
  [26, 22, 'A'], [27, 22, 'c'], [28, 22, 'c'], [29, 22, 'c'], [30, 22, 'c'], [31, 22, 'c'], [32, 22, 'A'],
  [26, 23, 'A'], [27, 23, 'c'], [28, 23, 'e'], [29, 23, 'c'], [30, 23, 'c'], [31, 23, 'd'], [32, 23, 'A'],
  [27, 24, 'A'], [28, 24, 'c'], [29, 24, 'c'], [30, 24, 'd'], [31, 24, 'A'],
  [28, 25, 'A'], [29, 25, 'd'], [30, 25, 'A'],
  [29, 26, 'A'],
  ...[30, 31, 32, 33, 34, 35, 36, 37, 38, 39].flatMap((x) => [[x, 32, 'A'], [x, 33, 'd'], [x, 34, 'A']] as const),
  [29, 33, 'A'],
];

const halfRows = Array.from({ length: 64 }, (_, y) => {
  const row = [...bellRow(y)];
  for (const [x, fy, k] of FACE) if (fy === y) row[x] = k;
  return row.join('');
});

/** An old crack down the right shoulder, and patches of verdigris. */
const OLD_CRACK: [number, number][] = [[52, 7], [53, 8], [53, 9], [54, 10], [53, 11], [53, 12], [54, 13], [55, 14], [55, 15], [56, 16], [55, 17], [55, 18], [56, 19], [57, 20], [57, 21], [58, 22]];
const VERDIGRIS: [number, number][] = [[30, 40], [31, 40], [31, 41], [32, 41], [22, 52], [23, 52], [23, 53], [60, 15], [61, 15], [61, 16], [48, 50], [49, 51], [50, 51], [36, 9], [37, 9], [66, 40], [67, 41]];
const bell = paint(
  mirrored('bell', 40, halfRows),
  [...VERDIGRIS.map(([x, y]) => [x, y, 'f'] as const), ...OLD_CRACK.map(([x, y]) => [x, y, 'A'] as const)],
  true,
  'bell',
);

/** The loop the bell once hung from. */
const canon = mirrored('bell canon', 6, ['2. 4A', '1. A W Z 2A', 'A W Z A', 'A W Z A', 'A Z Y A', 'A 2Y 3A']);

/** The clapper, glowing in the open lip. */
const clapper = mirrored('bell clapper', 4, ['1. 3A', 'A e 2c', 'A 3c', 'A 3c', '1. A 2d']);

/** The crack that splits it when it dies: a jagged line from crown to lip, lit from inside. */
const deathCrack = paint(
  blank('bell death crack', 80, 64),
  Array.from({ length: 53 }, (_, i) => {
    const y = 7 + i;
    const x = 38 + Math.round(2 * Math.sin(y * 0.7)) - Math.floor(i / 13);
    return [
      [x, y, 'A'],
      [x + 1, y, 'c'],
    ] as const;
  }).flat(),
);

// --- arms and maul -------------------------------------------------------------

/** A long grey arm hanging, shoulder at the top, a big hand at the bottom. */
const arm = part('bell arm', 10, [
  '2. 6A',
  '1. A 2O 3N A',
  ...Array.from({ length: 20 }, () => '1. A O 3N L A'),
  '1. A 2N 2L A',
  ...Array.from({ length: 5 }, () => 'A 2O 4N 2L A'),
  'A O A N A N A L A',
  '1. A 1. A 1. A 1. A',
]);
const armR = flipX(arm);
const armUp = rot180(arm);
const armOut = rotCCW(arm); // shoulder left, hand right
const armIn = flipX(armOut); // shoulder right, hand left

const maulHead = [
  '1. 16A',
  'A 2W 9V 5U A',
  'A 2R 9Q 5P A',
  ...Array.from({ length: 5 }, () => 'A 2W 9V 5U A'),
  'A 2R 9Q 5P A',
  'A 2W 9V 5U A',
  '1. 16A',
  '6. A 4Q A',
];
const maulEnd = ['6. A 4Q A', '7. 4A'];
const shaft = (n: number): string[] => Array.from({ length: n }, () => '7. A W V A');
/** The bell-maul, head up. */
const maul = part('bell maul', 18, [...maulHead, ...shaft(50), ...maulEnd]);
const maulShort = part('bell maul, foreshortened', 18, [...maulHead, ...shaft(16), ...maulEnd]);
const maulAcross = rotCW(maul); // head to the right
const maulDown = rot180(maulShort);
const maulOut = rotCW(maulShort); // short and level, head to the right

// --- poses -------------------------------------------------------------------

interface Pose {
  dx: number;
  dy: number;
  /** The weapon arm, and whether it is drawn behind the bell. */
  arm: Placed;
  armBehind?: boolean;
  maul: Placed | null;
  maulBehind?: boolean;
  /** The maul lies on the ground in front, unmoved by the body. */
  maulGround?: Placed;
  crack?: boolean;
}

const shift = (p: Placed, dx: number, dy: number): Placed => ({ ...p, x: p.x + dx, y: p.y + dy });

function body(p: Pose): Frame {
  const o = (q: Placed): Placed => shift(q, p.dx, p.dy);
  const behind = [...(p.maul && p.maulBehind ? [o(p.maul)] : []), ...(p.armBehind ? [o(p.arm)] : [])];
  return [
    ...behind,
    o(at(canon, 58, 43)),
    o(at(bell, 24, 48)),
    ...(p.crack ? [o(at(deathCrack, 24, 48))] : []),
    o(at(clapper, 60, 106)),
    ...(p.maulGround ? [p.maulGround] : []),
    o(at(arm, 36, 60)),
    ...(p.maul && !p.maulBehind ? [o(p.maul)] : []),
    ...(p.armBehind ? [] : [o(p.arm)]),
  ];
}

const REST_ARM = at(armR, 82, 60);
const REST_MAUL = at(maul, 79, 53);
const rest = (dx = 0, dy = 0): Pose => ({ dx, dy, arm: REST_ARM, maul: REST_MAUL });

const idle = [0, 0, 1, 1].map((dy) => body(rest(0, dy)));

/** The maul is raised up the right side, then swung crosswise above the bell. */
const windup: Frame[] = [
  body(rest()),
  body({ ...rest(0, -1), maul: shift(REST_MAUL, 0, -3) }),
  body({ dx: 0, dy: -1, arm: at(armUp, 84, 51), armBehind: true, maul: at(maul, 81, 38), maulBehind: true }),
  body({ dx: 0, dy: -2, arm: at(armUp, 84, 48), armBehind: true, maul: at(maul, 81, 35), maulBehind: true }),
  body({ dx: 0, dy: -2, arm: at(armUp, 84, 44), armBehind: true, maul: at(maulAcross, 30, 36) }),
  body({ dx: 0, dy: -3, arm: at(armUp, 84, 43), armBehind: true, maul: at(maulAcross, 30, 35) }),
];

const strike: Record<'north' | 'east' | 'south', Frame[]> = {
  // Driven straight up from behind the bell.
  north: [0, 1, 2].map((f) =>
    body({ dx: 0, dy: -([3, 4, 2][f] ?? 0), arm: at(armUp, 59, [44, 40, 42][f] ?? 0), armBehind: true, maul: at(maul, 55, [32, 28, 30][f] ?? 0), maulBehind: true }),
  ),
  // Swung out to the right, head first.
  east: [0, 1, 2].map((f) => body({ dx: [3, 6, 4][f] ?? 0, dy: 0, arm: at(armOut, 84, 64), maul: at(maulOut, 92, 62) })),
  // Slammed down in front.
  south: [0, 1, 2].map((f) => body({ dx: 0, dy: [2, 4, 3][f] ?? 0, arm: at(armIn, 60, 70), maul: at(maulDown, 55, [74, 78, 76][f] ?? 0) })),
};

const UNIT = { north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 } };
const recoil = Object.fromEntries(
  (['north', 'east', 'south'] as const).map((d) => [
    d,
    [3, 5, 4, 2].map((push) => body(rest(-UNIT[d].x * push, -UNIT[d].y * Math.min(push, 3)))),
  ]),
) as Record<'north' | 'east' | 'south', Frame[]>;

/** Stance broken: the bell sinks and the maul falls. */
const DROPPED = at(maulAcross, 34, 94);
const sunk = (dy: number, crack = false): Frame => body({ dx: 0, dy, arm: REST_ARM, maul: null, maulGround: DROPPED, crack });
const breakFrames: Frame[] = [body(rest(0, 3)), body({ ...rest(0, 6), maul: shift(REST_MAUL, 0, 8) }), sunk(9), sunk(10)];

/** Death: it cracks open and sinks into the ground. */
const death: Frame[] = [sunk(10), sunk(14, true), sunk(22, true), sunk(30, true), sunk(38, true), sunk(40, true)];

export const BOSS_BELL: CharacterArt = {
  id: 'boss_zone1',
  w: 128,
  h: 112,
  tags: {
    idle,
    windup,
    strike_north: strike.north,
    strike_east: strike.east,
    strike_south: strike.south,
    recoil_north: recoil.north,
    recoil_east: recoil.east,
    recoil_south: recoil.south,
    break: breakFrames,
    death,
  },
};
checkTags(BOSS_BELL, 'enemy');
