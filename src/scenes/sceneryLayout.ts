// Where scenery sprites go on the 320x180 buffer (bottom centre, internal pixels). The
// hand-drawn scenery (art/scenery) is drawn to these spots; art/art.test.ts checks they agree.
import type { SpriteFrame } from '../combat/sprites';

export const PROP_AT = {
  room: { x: 160, bottom: 180 },
  /** The far door's opening is x 146..173, y 60..103. */
  doorFar: { x: 160, bottom: 104 },
  doorWest: { x: 47, bottom: 120 },
  doorEast: { x: 273, bottom: 120 },
  doorNear: { x: 160, bottom: 180 },
  bonfire: { x: 232, bottom: 163 },
  /** Fight arena layers: back and near fill rows 28..179; the far strip stands on the horizon. */
  arena: { x: 160, bottom: 180 },
  arenaFar: { bottom: 82, tile: 64 },
  /** The bonfire rest scene: the fire close up, the player seated to its left. */
  restFire: { x: 160, bottom: 172 },
  restPlayer: { x: 112, bottom: 176 },
} as const;

/**
 * Where lesson objects stand in the bonfire rest scene, in the order lessons.json lists a
 * zone's objects (DECISIONS #96). The first is the stele, right of the fire beyond the sword.
 */
export const REST_SPOTS: readonly { x: number; bottom: number }[] = [
  { x: 258, bottom: 152 },
  { x: 52, bottom: 160 },
  { x: 290, bottom: 172 },
];

/**
 * A lesson page seen up close: every page sprite is 320x180 and keeps this box clean for the
 * text the game writes over it. art/art.test.ts checks the stele faces agree.
 */
export const PAGE_TEXT = { x: 46, y: 16, w: 228, h: 134 } as const;
/** The page's stone (or parchment) behind the text, for the flat-shape fallback. */
export const PAGE_SLAB = { x: 24, y: 4, w: 272, h: 158 } as const;

export const STILL: SpriteFrame = { tag: 'still', frame: 0, flip: false };

/** The door sprite tag for an exit's look. */
export const DOOR_TAG = { open: 'open', locked: 'locked', sealed: 'sealed', gateOpen: 'gate_open' } as const;
