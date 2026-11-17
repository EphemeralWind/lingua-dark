// The Whisperer: warden of the Seal of Articles (cellar). A tall, pointed hood with two pale
// eyes in the dark, ghost-blue robes that end in tatters above the floor (it floats), and the
// cellar's great iron key carried like a mace. 64x64, facing the camera.
// Colour keys (art/kit.ts): A outline, O/f/M/L robe light to deep, R eyes, Q/P iron key,
// crown and seal as every warden. Shared pole rig.
import { at, mirrored, part, recolor, type CharacterArt } from '../kit';
import { armUpFwd as monkArmUpFwd, heap as monkHeap, sleeve as monkSleeve } from './hollowMonk';
import { poleFighter } from './rig';
import { crown, seal } from './warden';

/** A tall pointed hood; the face is only dark and two eyes. */
const hood = mirrored(
  'whisperer hood',
  8,
  [
    '7. A',
    '6. A O',
    '5. A 2O',
    '5. A O f',
    '4. A O 2f',
    '4. A O 2f',
    '3. A O 3f',
    '3. A O 3f',
    '2. A O 2f 2A',
    '2. A O f 3A',
    '1. A O f A R 2A',
    '1. A O f A R 2A',
    '1. A O f 4A',
    '1. A O 2f 3A',
    'A O 3f 3A',
    'A O 4f 2A',
    'A O 5f A',
  ],
  true,
);

const robe = mirrored('whisperer robe', 13, [
  '7. 6A',
  '4. 3A 2O 4f',
  '2. 2A 3O 6f',
  '1. A 4O 7f',
  'A 4O 8f',
  ...Array.from({ length: 6 }, () => 'A 3O 6f M 2f'),
  'A 12P',
  ...Array.from({ length: 17 }, () => 'A 2O 3f M 3f M 2f'),
  'A O 4f M 3f M 2f',
  'A A 4f A A 4f A',
  '2. A 2f A 2. A 2f A 1.',
  '3. 2A 4. 2A 2.',
]);

const SHROUD = { W: 'O', V: 'f', U: 'M', T: 'L', N: 'R' };
const sleeve = recolor(monkSleeve, SHROUD, 'whisperer sleeve');
const armUpFwd = recolor(monkArmUpFwd, SHROUD, 'whisperer arm raised');
const heap = recolor(monkHeap, SHROUD, 'whisperer heap');

/** The cellar key: a ring bow at the top, a long iron shank, the bit at the bottom. */
const bow = ['1. 5A', 'A Q 3A Q A', 'A Q A 1. A Q A', 'A Q A 1. A Q A', 'A Q 3A Q A', '1. A 3Q A', '2. A Q A', '1. A 3P A', '2. A Q A'];
const bit = ['2. A Q 3A', '2. A Q 2P A', '2. A Q 3A', '2. A Q 2P A', '2. A Q 3A', '2. 2A'];
const shank = (n: number): string[] => Array.from({ length: n }, () => '2. A Q P A');
const key = part('cellar key', 7, [...bow, ...shank(29), ...bit]);
const keyShort = part('cellar key, foreshortened', 7, [...bow, ...shank(6), ...bit]);

const CROWN_REST: Record<number, { x: number; y: number }> = { [-2]: { x: 46, y: 52 }, [-1]: { x: 47, y: 55 }, 0: { x: 48, y: 57 } };

export const WHISPERER: CharacterArt = poleFighter({
  id: 'whisperer',
  figure: (dx, dy, bow) => [
    at(robe, 19 + dx, 27 + dy),
    at(sleeve, 13 + dx, 28 + dy),
    at(hood, 25 + dx, 11 + dy + bow),
    at(crown, 25 + dx, 8 + dy + bow),
    at(seal, 29 + dx, 34 + dy),
  ],
  sleeve,
  armUpFwd,
  pole: key,
  poleShort: keyShort,
  ground: (y) => [at(heap, 10, 50 + y), at(crown, CROWN_REST[y]?.x ?? 48, CROWN_REST[y]?.y ?? 57)],
});
