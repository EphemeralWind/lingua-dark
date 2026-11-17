// The Hollow Monk: warden of the Seal of Verbs (chapel). 64x64, facing the camera.
// Hand-drawn parts; light falls from the upper left. Colour keys (art/kit.ts): A outline,
// W/V/U/T robe light to deep, O/P rope, N hands, R/S crown and staff metal, e/d seal and lantern.
//
// The wind-up frames depend on the frame index only: one shared animation for every question.
import { requiredTags } from '../../src/combat/sprites';
import { at, flipX, part, rot180, rotCCW, rotCW, type CharacterArt, type Frame, type Placed } from '../kit';

// --- parts -----------------------------------------------------------------

const robe = part('monk robe', 32, [
  '4. 24A 4.',
  '3. A 5W 15V 4U A 3.',
  '2. A 6W 15V 5U A 2.',
  '1. A 6W 16V 6U A 1.',
  'A 7W 7V T 9V 6U A',
  'A 7W 7V T 9V 6U A',
  'A 7W 7V T 9V 6U A',
  'A 6W 8V T 9V 6U A',
  'A 6W 8V T 9V 6U A',
  'A 6W 8V T 8V 7U A',
  'A 6W 8V T 8V 7U A',
  'A 7W 7V T 8V 7U A',
  'A 2P 5O 15O 6N 1N A',
  'A 7P 16O 7N A',
  'A 6W 7V O T 8V 7U A',
  'A 6W 7V O T 8V 7U A',
  'A 6W 7V P T 8V 7U A',
  'A 6W 8V T 4V T 3V 7U A',
  'A 6W 8V T 4V T 3V 7U A',
  'A 5W 9V T 4V T 3V 7U A',
  'A 5W 9V T 4V T 3V 7U A',
  'A 5W 4V T 4V T 4V T 3V 7U A',
  'A 5W 4V T 4V T 4V T 3V 7U A',
  'A 4W 5V T 4V T 4V T 3V 7U A',
  'A 4W 5V T 4V T 4V T 2V 8U A',
  'A 4W 5V T 4V T 4V T 2V 8U A',
  'A 4W 5V T 4V T 4V T 2V 8U A',
  'A 3W 6V T 4V T 4V T 2V 8U A',
  'A 3W 6V T 4V T 4V T 2V 8U A',
  'A 3W 6V T 4V T 4V T 2V 8U A',
  'A 3W 6V T 4V T 4V T 1V 9U A',
  'A 2V 7U T 4U T 4U T 9T A',
  'A 30T A',
  '32A',
]);

const hood = part('monk hood', 20, [
  '9. 2A',
  '8. A 2V A',
  '7. A W 2V U A',
  '6. A 2W 3V U A',
  '5. A 2W 4V 2U A',
  '4. A 2W 6V 2U A',
  '3. A 2W 8V 2U A',
  '2. A 2W 3V 4T 3V 2U A',
  '2. A 2W 2V T 4A T 2V 2U A',
  '2. A 2W V T 6A T V 2U A',
  '2. A 2W V T A R 2A R A T V 2U A',
  '2. A 2W V T A S 2A S A T V 2U A',
  '2. A 2W V T 6A T V 2U A',
  '2. A 2W 2V T 4A T 2V 2U A',
  '2. A 2W 3V 4T 3V 2U A',
  '1. A 3W 10V 3U A',
  'A 3W 12V 3U A',
  'A 3W 12V 3U A',
]);

/** The warden's crown: three spikes and three jewels. Shape, not colour, marks a warden. */
const crown = part('warden crown', 15, [
  '7. S',
  '2. R 4. S 4. R',
  '2. R 3. R S R 3. R',
  '1. 3R 2. 3R 2. 3R',
  '1. 13R',
  '1. R e R P R e R P R e R P R',
  '1. 13P',
]);

/** The seal diamond on the chest. */
const seal = part('seal diamond', 7, ['3. e', '2. 3e', '1. 2e A 2e', '2e A S A 2e', '1. 2e A 2e', '2. 3e', '3. e']);

/** A sleeve hanging down, hand at the bottom (the monk's right arm, screen left). */
const sleeve = part('monk sleeve', 7, [
  '1. 4A',
  'A 4W A',
  'A 4W A',
  'A 3W V A',
  'A 3W V A',
  'A 3W V A',
  'A 3W V A',
  'A 2W 2V A',
  'A 2W 2V A',
  'A 2W 2V U A',
  'A 2W 2V U A',
  'A 2W 2V U A',
  'A W 3V U A',
  'A W 3V U A',
  'A 5T A',
  '1. A 3N A',
  '1. A 3N A',
  '2. 3A',
]);

/** Forearm raised forward and up: shoulder at the bottom left, hand at the top right. */
const armUpFwd = part('monk arm raised', 10, [
  '6. 3A',
  '5. A 3N A',
  '5. A 3N A',
  '4. A T 3A',
  '3. A 2W V T A',
  '2. A 2W 2V T A',
  '1. A 2W 2V U A',
  'A 2W 2V U A',
  'A W 2V 2U A',
  'A 2V 2U A',
  'A 3U A',
  '1. 3A',
]);

/** The lantern staff, upright: a caged lantern with the seal light, a collar, a long shaft. */
const staff = part('lantern staff', 7, [
  '3. R',
  '2. R S R',
  '1. R e d e R',
  'R 2e S 2e R',
  '1. R e d e R',
  '2. R S R',
  '3. R',
  '2. 3P',
  '2. P Q P',
  ...Array.from({ length: 35 }, () => '2. A W U A'),
]);

/** The same staff seen end-on, thrust at the camera: the shaft looks short. */
const staffShort = part('lantern staff, foreshortened', 7, [
  '3. R',
  '2. R S R',
  '1. R e d e R',
  'R 2e S 2e R',
  '1. R e d e R',
  '2. R S R',
  '3. R',
  '2. 3P',
  '2. P Q P',
  ...Array.from({ length: 12 }, () => '2. A W U A'),
]);

/** The monk on the ground, hood to the left, robe heaped to the right. */
const heap = part('monk heap', 44, [
  '7. 5A',
  '6. A 4V A 6. 14A',
  '5. A 2W 3V U A 4. A 12W 2V A',
  '4. A 2W 3V 2U A 2. A 13W 4V 2U A',
  '3. A 2W V T 2A T U A A 14W 5V 3U A',
  '3. A 2W V T R A T U A 2W 12V 4U 2T A',
  '3. A 3W 4T 2U A 3W 11V 5U 2T A',
  '2. A 3W 5V 3U 2A W 10V 6U 3T A',
  '2. A 2W 6V 4U 2T 9V T 6U 4T A',
  '1. A 2W 7V 5U 2T 8V T 5U 5T A',
  '1. A W 8V 6U 3T 6V T 5U 6T A',
  'A 2W 8V 7U 4T 4V 2T 4U 7T A',
  'A 3U 10V 10U 8T 6U 5T A',
  '2. 41A',
]);

// Arm and staff variants, all from the parts above.
const armDown = flipX(sleeve);
const armUp = rot180(sleeve);
const armSide = rotCCW(sleeve);
const armDownFwd = rot180(armUpFwd);
const staffDown = rot180(staffShort);
const staffAcross = rotCW(staff);

// --- poses -----------------------------------------------------------------

interface Pose {
  /** Whole body offset. */
  dx: number;
  dy: number;
  /** Extra drop of the hood and crown (head bowed). */
  bow?: number;
  arm: Placed;
  /** The staff, and whether it is drawn in front of the body. */
  staff: Placed | null;
  front?: boolean;
}

function body(p: Pose): Frame {
  const { dx, dy } = p;
  const bow = p.bow ?? 0;
  const behind = p.staff && !p.front ? [p.staff] : [];
  const ahead = p.staff && p.front ? [p.staff] : [];
  return [
    ...behind,
    at(robe, 16 + dx, 28 + dy),
    at(sleeve, 13 + dx, 29 + dy),
    at(hood, 22 + dx, 12 + dy + bow),
    at(crown, 25 + dx, 6 + dy + bow),
    at(seal, 29 + dx, 34 + dy),
    { ...p.arm, x: p.arm.x + dx, y: p.arm.y + dy },
    ...ahead,
  ];
}

/** Resting: staff upright in the right hand. */
const rest = (dx = 0, dy = 0): Pose => ({ dx, dy, arm: at(armDown, 44, 29), staff: at(staff, 43 + dx, 19 + dy) });

const idle = [0, 0, 1, 1].map((dy) => body(rest(0, dy)));

/** One shared wind-up: the staff rises, then is lifted crosswise above the head. Frame index only. */
const windup: Frame[] = [
  body(rest()),
  body({ ...rest(0, -1), staff: at(staff, 43, 16) }),
  body({ dx: 0, dy: -1, arm: at(armUpFwd, 42, 26), staff: at(staff, 46, 6) }),
  body({ dx: 0, dy: -2, arm: at(armUpFwd, 42, 25), staff: at(staff, 46, 3) }),
  body({ dx: 0, dy: -2, arm: at(armUp, 44, 12), staff: at(staffAcross, 10, -2), front: true }),
  body({ dx: 0, dy: -3, arm: at(armUp, 44, 11), staff: at(staffAcross, 10, -3), front: true }),
];

const strike: Record<'north' | 'east' | 'south', Frame[]> = {
  // Thrust straight up toward the north card.
  north: [0, -2, -1].map((y, f) => body({ dx: 0, dy: -([3, 4, 2][f] ?? 0), arm: at(armUp, 44, 12), staff: at(staff, 43, y) })),
  // Swung out to the right, lantern first.
  east: [0, 1, 2].map((f) => body({ dx: ([2, 4, 3][f] ?? 0), dy: 0, arm: at(armSide, 44, 33), staff: at(staffAcross, ([22, 26, 24][f] ?? 0), 31), front: true })),
  // Driven down toward the player.
  south: [0, 1, 2].map((f) => body({ dx: 0, dy: ([2, 4, 3][f] ?? 0), bow: 1, arm: at(armDownFwd, 37, 35), staff: at(staffDown, 36, ([34, 38, 36][f] ?? 0)), front: true })),
};

const UNIT = { north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 } };

const recoil = Object.fromEntries(
  (['north', 'east', 'south'] as const).map((d) => [
    d,
    [3, 5, 4, 2].map((push) => {
      const dx = -UNIT[d].x * push;
      const dy = -UNIT[d].y * Math.min(push, 3);
      return body({ dx, dy, bow: d === 'north' ? 0 : 1, arm: at(armDown, 44, 29), staff: at(staff, 43 + dx - UNIT[d].x * 2, 19 + dy + 2) });
    }),
  ]),
) as Record<'north' | 'east' | 'south', Frame[]>;

/** Stance broken: the monk sinks to its knees and the staff falls. */
const breakFrames: Frame[] = [
  body({ ...rest(0, 2), bow: 1 }),
  body({ ...rest(0, 4), bow: 2, staff: at(staff, 45, 26) }),
  body({ dx: 0, dy: 6, bow: 3, arm: at(armDown, 44, 29), staff: at(staffAcross, 18, 57), front: true }),
  body({ dx: 0, dy: 7, bow: 3, arm: at(armDown, 44, 29), staff: at(staffAcross, 18, 57), front: true }),
];

const ground = (y: number): Placed[] => [at(staffAcross, 18, 57), at(heap, 10, 50 + y)];
const death: Frame[] = [
  body({ dx: 0, dy: 7, bow: 3, arm: at(armDown, 44, 29), staff: at(staffAcross, 18, 57), front: true }),
  body({ dx: -1, dy: 10, bow: 4, arm: at(armDown, 44, 29), staff: at(staffAcross, 18, 57), front: true }),
  [...ground(-2), at(crown, 46, 52)],
  [...ground(-1), at(crown, 47, 55)],
  [...ground(0), at(crown, 48, 57)],
  [...ground(0), at(crown, 48, 57)],
];

export const HOLLOW_MONK: CharacterArt = {
  id: 'hollow_monk',
  w: 64,
  h: 64,
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

// Every required tag, in the SPEC 8 frame counts (checked again by the tests).
for (const [tag, n] of Object.entries(requiredTags('enemy'))) {
  if (HOLLOW_MONK.tags[tag]?.length !== n) throw new Error(`hollow_monk ${tag}: ${HOLLOW_MONK.tags[tag]?.length ?? 0} frames, need ${n}`);
}
