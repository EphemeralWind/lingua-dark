// A ghost: the echo of a missed word, drawn as a see-through villager with a spear and a wisp
// for legs. 64x64, facing the camera. A pale outline and a dithered fill (art/kit.ts ghostly)
// let the arena show through; the shape, not only the colour, says "ghost". Shared pole rig.
import { at, ghostly, mirrored, part, type CharacterArt } from '../kit';
import { poleFighter } from './rig';
import * as villager from './hollowVillager';

/** The body trails off into a wisp instead of legs. */
const wisp = mirrored('ghost wisp', 9, [
  'A 2O 6f',
  'A 2O 6f',
  '1. A O 6f',
  '1. A O 6f',
  '1. A O 6f',
  '2. A O 5f',
  '2. A O 5f',
  '3. A O 4f',
  '3. A O 4f',
  '4. A O 3f',
  '5. A O 2f',
  '6. A 2f',
  '7. A f',
  '8. A',
]);

const spearHead = ['3. A', '2. A R A', '1. A R Q A', '1. A R Q A', '1. A R Q A', '2. A Q A', '2. A Q A', '2. A 2P A', '2. 4A'];
/** A spectral spear, solid so it reads clearly against the see-through body. */
const spear = part('spear', 7, [...spearHead, ...Array.from({ length: 35 }, () => '2. A f M A')]);
const spearShort = part('spear, foreshortened', 7, [...spearHead, ...Array.from({ length: 12 }, () => '2. A f M A')]);

const head = ghostly(villager.head);
const tunic = ghostly(villager.tunic);
const tail = ghostly(wisp);
const sleeve = ghostly(villager.sleeve);

export const GHOST: CharacterArt = poleFighter({
  id: 'ghost',
  figure: (dx, dy, bow) => [
    // The wisp sways with the body: a ghost has nothing planted on the ground.
    at(tail, 23 + dx, 46 + dy),
    at(tunic, 18 + dx, 27 + dy),
    at(sleeve, 13 + dx, 28 + dy),
    at(head, 26 + dx, 17 + dy + bow),
  ],
  sleeve,
  armUpFwd: ghostly(villager.armUpFwd),
  pole: spear,
  poleShort: spearShort,
  ground: (y) => [at(ghostly(villager.heap), 10, 50 + y)],
});
