// A rig for an enemy facing the camera with a pole weapon in its right hand (screen right).
// The pose table was first drawn for the Hollow Monk; every pole fighter shares it, so they
// all move alike and only their parts differ. Part sizes are fixed so the table fits them all:
// sleeve 7x18 (hand at the bottom), raised forearm 10x12, pole 7x44 and foreshortened pole
// 7x21, each with its business end at the top.
//
// The wind-up frames depend on the frame index only: one shared animation for every question.
import { requiredTags } from '../../src/combat/sprites';
import { at, flipX, rot180, rotCCW, rotCW, type CharacterArt, type Frame, type Part, type Placed } from '../kit';

export interface PoleRig {
  id: string;
  /** Everything but the weapon arm and the weapon: body offset (dx, dy), head dropped by `bow`. */
  figure(dx: number, dy: number, bow: number): Placed[];
  /** The figure's own left sleeve hanging (screen left); the weapon arm is its mirror. 7x18. */
  sleeve: Part;
  /** Forearm raised forward and up, shoulder bottom left, hand top right. 10x12. */
  armUpFwd: Part;
  /** The weapon upright. 7x44. */
  pole: Part;
  /** The weapon thrust at the camera, so its shaft looks short. 7x21. */
  poleShort: Part;
  /** The fallen body (and anything that rolls off it), settling from -2 to 0. */
  ground(settle: number): Placed[];
}

interface Pose {
  dx: number;
  dy: number;
  bow?: number;
  arm: Placed;
  /** The weapon, and whether it is drawn in front of the body. */
  pole: Placed | null;
  front?: boolean;
}

const UNIT = { north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 } };
type Drawn = keyof typeof UNIT;
const DIRS: readonly Drawn[] = ['north', 'east', 'south'];

export function poleFighter(r: PoleRig): CharacterArt {
  const armDown = flipX(r.sleeve);
  const armUp = rot180(r.sleeve);
  const armSide = rotCCW(r.sleeve);
  const armDownFwd = rot180(r.armUpFwd);
  const poleDown = rot180(r.poleShort);
  const poleAcross = rotCW(r.pole);

  const body = (p: Pose): Frame => {
    const behind = p.pole && !p.front ? [p.pole] : [];
    const ahead = p.pole && p.front ? [p.pole] : [];
    return [...behind, ...r.figure(p.dx, p.dy, p.bow ?? 0), { ...p.arm, x: p.arm.x + p.dx, y: p.arm.y + p.dy }, ...ahead];
  };

  /** Resting: weapon upright in the right hand. */
  const rest = (dx = 0, dy = 0): Pose => ({ dx, dy, arm: at(armDown, 44, 29), pole: at(r.pole, 43 + dx, 19 + dy) });

  const idle = [0, 0, 1, 1].map((dy) => body(rest(0, dy)));

  /** The weapon rises, then is lifted crosswise above the head. */
  const windup: Frame[] = [
    body(rest()),
    body({ ...rest(0, -1), pole: at(r.pole, 43, 16) }),
    body({ dx: 0, dy: -1, arm: at(r.armUpFwd, 42, 26), pole: at(r.pole, 46, 6) }),
    body({ dx: 0, dy: -2, arm: at(r.armUpFwd, 42, 25), pole: at(r.pole, 46, 3) }),
    body({ dx: 0, dy: -2, arm: at(armUp, 44, 12), pole: at(poleAcross, 10, -2), front: true }),
    body({ dx: 0, dy: -3, arm: at(armUp, 44, 11), pole: at(poleAcross, 10, -3), front: true }),
  ];

  const strike: Record<Drawn, Frame[]> = {
    // Thrust straight up toward the north card.
    north: [0, -2, -1].map((y, f) => body({ dx: 0, dy: -([3, 4, 2][f] ?? 0), arm: at(armUp, 44, 12), pole: at(r.pole, 43, y) })),
    // Swung out to the right, business end first.
    east: [0, 1, 2].map((f) => body({ dx: [2, 4, 3][f] ?? 0, dy: 0, arm: at(armSide, 44, 33), pole: at(poleAcross, [22, 26, 24][f] ?? 0, 31), front: true })),
    // Driven down toward the player.
    south: [0, 1, 2].map((f) => body({ dx: 0, dy: [2, 4, 3][f] ?? 0, bow: 1, arm: at(armDownFwd, 37, 35), pole: at(poleDown, 36, [34, 38, 36][f] ?? 0), front: true })),
  };

  const recoil = Object.fromEntries(
    DIRS.map((d) => [
      d,
      [3, 5, 4, 2].map((push) => {
        const dx = -UNIT[d].x * push;
        const dy = -UNIT[d].y * Math.min(push, 3);
        return body({ dx, dy, bow: d === 'north' ? 0 : 1, arm: at(armDown, 44, 29), pole: at(r.pole, 43 + dx - UNIT[d].x * 2, 19 + dy + 2) });
      }),
    ]),
  ) as Record<Drawn, Frame[]>;

  /** Stance broken: down on its knees, the weapon falls. */
  const fallen = (dx: number, dy: number, bow: number): Frame =>
    body({ dx, dy, bow, arm: at(armDown, 44, 29), pole: at(poleAcross, 18, 57), front: true });
  const breakFrames: Frame[] = [
    body({ ...rest(0, 2), bow: 1 }),
    body({ ...rest(0, 4), bow: 2, pole: at(r.pole, 45, 26) }),
    fallen(0, 6, 3),
    fallen(0, 7, 3),
  ];

  const ground = (settle: number): Frame => [at(poleAcross, 18, 57), ...r.ground(settle)];
  const death: Frame[] = [fallen(0, 7, 3), fallen(-1, 10, 4), ground(-2), ground(-1), ground(0), ground(0)];

  const art: CharacterArt = {
    id: r.id,
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
  checkTags(art, 'enemy');
  return art;
}

/** Every required tag, in the SPEC 8 frame counts (checked again by the tests). */
export function checkTags(art: CharacterArt, kind: 'enemy' | 'player'): void {
  for (const [tag, n] of Object.entries(requiredTags(kind))) {
    if (art.tags[tag]?.length !== n) throw new Error(`${art.id} ${tag}: ${art.tags[tag]?.length ?? 0} frames, need ${n}`);
  }
}
