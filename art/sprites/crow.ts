// The Crow: warden of the Seal of Words (orchard). A crow-headed figure in a black feather
// mantle, a bone beak, talons, and an orchard billhook. 64x64, facing the camera.
// Colour keys (art/kit.ts): A outline, M/K/J/H feathers light to deep, Q/P/O bone beak and
// talons, S eyes, R/Q blade, W/V shaft, crown and seal as every warden. Shared pole rig.
import { at, mirrored, part, recolor, type CharacterArt } from '../kit';
import { armUpFwd as monkArmUpFwd, heap as monkHeap, sleeve as monkSleeve } from './hollowMonk';
import { poleFighter } from './rig';
import { crown, seal } from './warden';

/** Round feathered head, eyes set wide, a long bone beak pointing down at the viewer. */
const head = mirrored('crow head', 8, [
  '4. 4A',
  '2. 2A 2M 2K',
  '1. A 2M 4K',
  'A 2M 5K',
  'A M 2K A S A K',
  'A M 2K 2A 2K',
  'A M 4K A Q',
  'A M 3K A 2Q',
  'A 3K A R 2Q',
  '1. A 2K A R 2Q',
  '2. 3A R 2Q',
  '4. A R 2Q',
  '5. A R Q',
  '5. A 2Q',
  '6. A Q',
  '6. A Q',
  '7. A',
]);

/**
 * Feather mantle in three tiers. Each tier ends in a row of downward feather points that
 * overlap the tier below; the hem is a last row of points.
 */
const points = (hi: string, lo: string): string[] => [
  `A A 4${hi} A A 4${hi} A A ${hi}`,
  `A ${lo} A 2${hi} A 2${lo} A 2${hi} A 2${lo} A`,
  `A 2${lo} 2A 4${lo} 2A 4${lo}`,
];
const mantle = mirrored('crow mantle', 15, [
  '8. 7A',
  '5. 3A 2M 5K',
  '3. 2A 3M 7K',
  '1. 2A 4M 8K',
  'A 5M 9K',
  'A 4M 10K',
  ...Array.from({ length: 6 }, () => 'A 3M 11K'),
  ...points('K', 'J'),
  ...Array.from({ length: 9 }, () => 'A K 13J'),
  ...points('J', 'I'),
  ...Array.from({ length: 6 }, () => 'A J 13I'),
  `A A 4I A A 4I A A I`,
  '2. A 2I A 2. A 2I A 2. A',
  '3. 2A 4. 2A 4.',
]);

const foot = part('crow talons', 7, ['2. A O A', '2. A O A', '1. A P O N A', 'A P A O A N A', '7A']);

const FEATHER = { W: 'M', V: 'K', U: 'J', T: 'H', N: 'O' };
const sleeve = recolor(monkSleeve, FEATHER, 'crow wing-sleeve');
const armUpFwd = recolor(monkArmUpFwd, FEATHER, 'crow arm raised');
const heap = recolor(monkHeap, { ...FEATHER, R: 'S' }, 'crow heap');

/** Billhook: a blade rising from the collar and hooking over to the left. */
const billHead = ['1. 4A', 'A 2R 2Q A', 'A R A 1. A Q A', '2A 2. A Q A', '4. A Q A', '3. A R Q A', '2. A R Q P A', '2. A 2P A', '2. A 2P A'];
const billhook = part('billhook', 7, [...billHead, ...Array.from({ length: 35 }, () => '2. A W V A')]);
const billhookShort = part('billhook, foreshortened', 7, [...billHead, ...Array.from({ length: 12 }, () => '2. A W V A')]);

const CROWN_REST: Record<number, { x: number; y: number }> = { [-2]: { x: 46, y: 52 }, [-1]: { x: 47, y: 55 }, 0: { x: 48, y: 57 } };

export const CROW: CharacterArt = poleFighter({
  id: 'crow',
  figure: (dx, dy, bow) => [
    at(foot, 23, 59),
    at(foot, 34, 59),
    at(mantle, 17 + dx, 24 + dy),
    at(sleeve, 13 + dx, 28 + dy),
    at(head, 24 + dx, 12 + dy + bow),
    at(crown, 24 + dx, 6 + dy + bow),
    at(seal, 29 + dx, 34 + dy),
  ],
  sleeve,
  armUpFwd,
  pole: billhook,
  poleShort: billhookShort,
  ground: (y) => [at(heap, 10, 50 + y), at(crown, CROWN_REST[y]?.x ?? 48, CROWN_REST[y]?.y ?? 57)],
});
