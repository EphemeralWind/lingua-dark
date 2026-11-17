// The Hollow Smith: broad, in an iron pot helm with embers behind the slit, a leather apron
// over a dark shirt, bare arms and a long sledgehammer. 64x64, facing the camera.
// Colour keys (art/kit.ts): A outline, R/Q/P/O helm iron, c/d embers, L/K/J shirt, W/V/U apron,
// O/N/L bare skin, J/I trousers, U/T boots. Moves on the shared pole rig.
import { at, flipX, mirrored, part, recolor, type CharacterArt } from '../kit';
import { armUpFwd as monkArmUpFwd, heap as monkHeap, sleeve as monkSleeve } from './hollowMonk';
import { poleFighter } from './rig';

/** Pot helm with a T-shaped visor; two embers glow in the slit. */
const helm = mirrored('smith helm', 7, [
  '3. 4A',
  '2. A 4R',
  '1. A R 4Q',
  'A R 5Q',
  'A R 5Q',
  'A Q 5P',
  'A Q 2P 3A',
  'A Q P A c 2A',
  'A Q 2P 3A',
  'A Q 4P A',
  'A Q 4P A',
  'A P 4O A',
  'A 6O',
  '1. 6A',
]);

/** Shirt shoulders, apron bib on a strap, a belt, the apron's skirt to the knee. */
const apron = mirrored('smith apron', 15, [
  '7. 8A',
  '4. 3A 2L 6K',
  '2. 2A 3L 8K',
  '1. A 3L 4K A V 4K',
  'A 3L 5K A V 4K',
  'A 2L 6K A V 4K',
  ...Array.from({ length: 6 }, () => 'A 2L 5K A W 5V'),
  'A 2L 5K A W 2V U 2V',
  'A 2L 5K A W 5V',
  'A 14U',
  'A 2K 2J A W 8V',
  'A 2K 2J A W 8V',
  'A 2K 2J A W 4V U 3V',
  'A 2K 2J A W 3V 2U 3V',
  'A 2K 2J A W 8V',
  'A 2K 2J A W 8V',
  '1. A K J A W 8V',
  '1. 14A',
]);

const leg = part('smith leg', 8, [
  ...Array.from({ length: 12 }, () => 'A 5J I A'),
  '8A',
  'A 2V 3U T A',
  'A V 4U T A',
  'A V 4U T A',
  'A 6T A',
  '8A',
]);

const SKIN = { W: 'O', V: 'N', U: 'L', T: 'V', N: 'N' };
const sleeve = recolor(monkSleeve, SKIN, 'smith arm');
const armUpFwd = recolor(monkArmUpFwd, SKIN, 'smith arm raised');
const heap = recolor(monkHeap, { R: 'c' }, 'smith heap');

const hammerHead = ['1. 5A', 'A 2R 3Q A', 'A R 3Q P A', 'A R 3Q P A', 'A Q 3P O A', 'A Q 3P O A', '1. 5A', '2. A 2V A', '2. A 2U A'];
/** Sledgehammer, head up. */
const hammer = part('sledgehammer', 7, [...hammerHead, ...Array.from({ length: 35 }, () => '2. A W V A')]);
const hammerShort = part('sledgehammer, foreshortened', 7, [...hammerHead, ...Array.from({ length: 12 }, () => '2. A W V A')]);

export const HOLLOW_SMITH: CharacterArt = poleFighter({
  id: 'hollow_smith',
  figure: (dx, dy, bow) => [
    at(leg, 22, 46),
    at(flipX(leg), 34, 46),
    at(apron, 17 + dx, 26 + dy),
    at(sleeve, 13 + dx, 28 + dy),
    at(helm, 25 + dx, 14 + dy + bow),
  ],
  sleeve,
  armUpFwd,
  pole: hammer,
  poleShort: hammerShort,
  ground: (y) => [at(heap, 10, 50 + y)],
});
