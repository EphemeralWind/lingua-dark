// The player, seen from behind (SPEC 2, 8). 48x64. Hand-drawn parts; light from the upper left.
// Colour keys (art/kit.ts): A outline, M/K/J cloak light to dark, R/Q/P steel, V/U hair and
// leather, W wood, I/J trousers.
import { requiredTags } from '../../src/combat/sprites';
import { at, flipX, lerp, part, rotCW, type CharacterArt, type Frame, type Placed } from '../kit';

// --- parts -----------------------------------------------------------------

const cloak = part('player cloak', 34, [
  '9. 16A',
  '4. 5A 16M 5A',
  '2. 2A 3R 2Q A 14M A 2Q 3P 2A',
  '1. A 2R 4Q A 2M 14K A 4Q 2P A',
  '1. A R 5Q A 2M 15K A 5P A',
  '1. A 6Q A 2M 15K A 4P L A',
  '1. 2A 4P A 2M 17K A 3L 2A',
  '1. A 4M 19K 7J A',
  '1. A 4M 8K J 3K J 6K 7J A',
  ...Array.from({ length: 16 }, () => '1. A 3M 8K J 4K J 6K 7J A'),
  '2. A 2M 8K J 4K J 6K 6J A',
  '2. A 2M 3K A 4K J 4K J 2K A 3K 5J A',
  '3. A M 2K A 1. A 3K J 4K J A 1. A 2K 3J A',
  '4. 4A 2. 10A 2. 5A',
]);

const head = part('player head', 14, [
  '4. 6A',
  '2. 2A 6V 2A',
  '1. A 3V 6U A',
  'A 4V 8U A',
  'A 3V 9U A',
  'A 2V 10U A',
  'A 2V 5U T 4U A',
  'A V 5U T 5U A',
  'A V 5U T 5U A',
  'A 12U A',
  '1. A 4U 2T 4U A',
  '1. A 2U 6T 2U A',
  '3. A 6W A',
  '3. A 6W A',
]);

const legL = part('player leg', 9, ['A 7I A', 'A 6J I A', 'A 6J I A', 'A 6J I A', 'A 6J I A', 'A 6J I A', 'A W 6V A', 'A W 6V A', 'A W 6V A', 'A 7U A', '9A']);
const legR = flipX(legL);

/** The back of a round-topped plank shield: steel rim, wooden planks, a leather strap. */
const shield = part('player shield', 16, [
  '2. 12Q',
  '1. Q R 11W Q',
  'Q R 3W U 3W U 4W P Q',
  'Q R 3W U 3W U 4W P Q',
  'Q R 3W U 3W U 4W P Q',
  'Q R 3W U 3W U 4W P Q',
  'Q R 2W 8V 2W P Q',
  'Q R 2W V 6U V 2W P Q',
  'Q R 2W 8V 2W P Q',
  'Q R 3W U 3W U 4W P Q',
  'Q R 3W U 3W U 4W P Q',
  'Q R 3W U 3W U 4W P Q',
  'Q R 3W U 3W U 4W P Q',
  'Q R 3W U 3W U 4W P Q',
  'Q R 3W U 3W U 4W P Q',
  '1. Q 3W U 3W U 4W Q',
  '1. Q 3W U 3W U 3W P Q',
  '2. Q 2W U 3W U 3W Q',
  '3. Q 8W Q',
  '4. 8Q',
]);

/** Sword at the hip, point down. */
const sword = part('player sword', 5, [
  '1. 3d',
  '1. d c d',
  '2. V',
  '2. V',
  '5d',
  ...Array.from({ length: 21 }, () => '1. R Q P'),
  '1. R Q',
  '2. Q',
]);

/**
 * The sword readied, point up, leaning toward the centre: aimed forward at the enemy, as seen
 * from behind. The guard and grip sit low, where the cloak hides them.
 */
const swordReady = part('player sword readied', 12, [
  '1. Q',
  '1. R Q',
  '1. R Q P',
  '1. R Q P',
  '2. R Q P',
  '2. R Q P',
  '2. R Q P',
  '2. R Q P',
  '3. R Q P',
  '3. R Q P',
  '3. R Q P',
  '3. R Q P',
  '4. R Q P',
  '4. R Q P',
  '4. R Q P',
  '4. R Q P',
  '5. R Q P',
  '5. R Q P',
  '5. R Q P',
  '5. R Q P',
  '6. R Q P',
  '6. R Q P',
  '6. R Q P',
  '6. R Q P',
  '5. 5d',
  '6. d c d',
  '7. V',
  '7. V',
  '6. 3d',
]);

const sleeveUp = part('player sleeve up', 6, ['1. 4A', 'A 2M 2K A', 'A M 3K A', 'A M 3K A', 'A M 3K A', 'A M 3K A', 'A M 3K A', 'A M 3J A', 'A M 3J A', '1. 4A']);
const sleeveAcross = part('player sleeve across', 20, ['1. 18A', 'A 18M A', 'A 18K A', 'A 18K A', 'A 18J A', '1. 18A']);

/** Fallen forward, away from the camera: hair at the top, the cloak spread below. */
const fallen = part('player fallen', 40, [
  '17. 6A',
  '16. A 6U A',
  '16. A V 5U A',
  '8. 9A 6U 9A',
  '6. 2A 8M 2A 4U 2A 8K 2A',
  '4. 2A 10M 10K 8K 2J 2A',
  '3. A 11M 12K 9K 3J A',
  '2. A 11M 13K 9K 3J A',
  '2. A 10M 14K J 8K 3J A',
  '2. A 9M 15K J 8K 3J A',
  '3. A 8M 15K J 7K 4J A',
  '4. A 7M 14K J 7K 4J A',
  '5. 2A 2M 3A 9K 2A 7K 2A 3J 2A',
  '7. 2A 4. 2V 3. 9A 4. 2V',
  '13. 2A 15. 2A',
]);

// --- poses -----------------------------------------------------------------
//
// The camera is behind the player, so anything held toward the enemy is in front of the body:
// shield and readied sword are drawn first and the legs, head and cloak cover what they overlap.
// Only what sticks out past the body shows. Sleeves are nearer the camera than the shield, so
// they are drawn last. The relaxed sword hangs at the hip, beside the body, and is drawn on top.

/** Shield in front of the left side: its rim peeks out past the cloak. */
const SHIELD_REST = { x: 0, y: 32 };
/** Readied sword: hilt hidden in front of the chest, blade rising past the right of the head. */
const SWORD_READY = { x: 28, y: 4 };

interface Pose {
  dx?: number;
  dy?: number;
  /** Head offset on top of the body's. */
  head?: { x: number; y: number };
  legs?: { l: number; r: number };
  shield?: { x: number; y: number };
  /** `ready` in fights (offset from SWORD_READY), `hip` when exploring. */
  sword?: { x: number; y: number } | 'hip';
  extra?: Placed[];
}

function pose(p: Pose = {}): Frame {
  const dx = p.dx ?? 0;
  const dy = p.dy ?? 0;
  const s = p.shield ?? SHIELD_REST;
  const sw = p.sword ?? 'hip';
  return [
    at(shield, s.x + dx, s.y + dy),
    ...(sw === 'hip' ? [] : [at(swordReady, SWORD_READY.x + sw.x + dx, SWORD_READY.y + sw.y + dy)]),
    at(legL, 12, 53 + (p.legs?.l ?? 0)),
    at(legR, 27, 53 + (p.legs?.r ?? 0)),
    at(head, 17 + dx + (p.head?.x ?? 0), 12 + dy + (p.head?.y ?? 0)),
    at(cloak, 7 + dx, 25 + dy),
    ...(sw === 'hip' ? [at(sword, 40 + dx, 33 + dy)] : []),
    ...(p.extra ?? []),
  ];
}

const READY = { x: 0, y: 0 };
const idle = [0, 0, 1, 1].map((dy) => pose({ dy }));
const walk = [
  pose({ legs: { l: -2, r: 0 } }),
  pose({ dy: 1 }),
  pose({ legs: { l: 0, r: -2 } }),
  pose({ dy: 1 }),
];
/** Fight stance: sword readied, a slow breath. Frame 0 is held through every wind-up. */
const guard = [0, 0, 1, 1].map((dy) => pose({ dy, sword: READY }));

const PARRY: Record<'north' | 'east' | 'south', { shield: { x: number; y: number }; dy: number; sleeve: Placed | null; sword: { x: number; y: number } }> = {
  // Raised in front of the face: the head hides its lower edge.
  north: { shield: { x: 15, y: -1 }, dy: 0, sleeve: at(sleeveUp, 11, 15), sword: { x: 2, y: 2 } },
  // Pushed out past the right shoulder.
  east: { shield: { x: 33, y: 16 }, dy: 0, sleeve: at(sleeveAcross, 14, 29), sword: { x: -3, y: 2 } },
  // Low on the left, the player crouching behind it.
  south: { shield: { x: -1, y: 40 }, dy: 2, sleeve: null, sword: { x: 0, y: 2 } },
};
/** Contact on frame 0 (held through the hit-stop), then the shield eases back. */
const EASE = [1, 0.85, 0.55, 0.25];

const parry = Object.fromEntries(
  (['north', 'east', 'south'] as const).map((d) => {
    const t = PARRY[d];
    return [
      d,
      EASE.map((k) =>
        pose({
          dy: Math.round(t.dy * k),
          shield: { x: lerp(SHIELD_REST.x, t.shield.x, k), y: lerp(SHIELD_REST.y, t.shield.y, k) },
          sword: { x: Math.round(t.sword.x * k), y: Math.round(t.sword.y * k) },
          extra: t.sleeve && k > 0.6 ? [t.sleeve] : [],
        }),
      ),
    ];
  }),
) as Record<'north' | 'east' | 'south', Frame[]>;

const UNIT = { north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 } };
/** Hit: knocked back, shield sagging, sword knocked low and outward, then recovering. */
const hit = Object.fromEntries(
  (['north', 'east', 'south'] as const).map((d) => [
    d,
    [4, 3, 1].map((push, f) => {
      const dx = -UNIT[d].x * push;
      const dy = d === 'north' ? ([3, 2, 0][f] ?? 0) : d === 'south' ? -([2, 1, 0][f] ?? 0) : 1;
      const knock = [6, 4, 1][f] ?? 0;
      return pose({
        dx,
        dy,
        head: { x: f === 0 ? -UNIT[d].x : 0, y: f === 0 ? 1 : 0 },
        shield: { x: SHIELD_REST.x + 1, y: SHIELD_REST.y + 4 },
        sword: { x: Math.floor(knock / 3), y: knock },
      });
    }),
  ]),
) as Record<'north' | 'east' | 'south', Frame[]>;

const lying = (y: number): Frame => [at(rotCW(shield), -3, 51), at(rotCW(sword), 21, 60), at(fallen, 4, y)];
const death: Frame[] = [
  pose({ dy: 4, head: { x: 0, y: 1 }, shield: { x: 1, y: 38 }, sword: { x: 1, y: 10 } }),
  pose({ dy: 8, head: { x: 0, y: 2 }, shield: { x: 2, y: 44 }, sword: 'hip' }),
  lying(44),
  lying(46),
  lying(47),
  lying(47),
];

export const PLAYER: CharacterArt = {
  id: 'player',
  w: 48,
  h: 64,
  tags: {
    idle,
    walk,
    guard,
    parry_north: parry.north,
    parry_east: parry.east,
    parry_south: parry.south,
    hit_north: hit.north,
    hit_east: hit.east,
    hit_south: hit.south,
    death,
  },
};

for (const [tag, n] of Object.entries(requiredTags('player'))) {
  if (PLAYER.tags[tag]?.length !== n) throw new Error(`player ${tag}: ${PLAYER.tags[tag]?.length ?? 0} frames, need ${n}`);
}
