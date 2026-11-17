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
} as const;

export const STILL: SpriteFrame = { tag: 'still', frame: 0, flip: false };

/** The door sprite tag for an exit's look. */
export const DOOR_TAG = { open: 'open', locked: 'locked', sealed: 'sealed', gateOpen: 'gate_open' } as const;
