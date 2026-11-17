// The Hollow Villager: a gaunt, hollow-eyed peasant with a pitchfork. 64x64, facing the camera.
// Colour keys (art/kit.ts): A outline, R/Q/P sickly skin, O/N/L tunic, V belt, U/T trousers,
// W/V fork shaft, Q/R tines. Moves on the shared pole rig.
import { at, flipX, mirrored, part, recolor, type CharacterArt } from '../kit';
import { armUpFwd as monkArmUpFwd, heap as monkHeap, sleeve as monkSleeve } from './hollowMonk';
import { poleFighter } from './rig';

/** Bald crown, lank hair hanging at the sides, sunken eyes with a faint glint. */
export const head = mirrored('villager head', 6, [
  '2. 4A',
  '1. A U 3R',
  'A U R 3Q',
  'A U 4Q',
  'A U 3A Q',
  'A U A S A Q',
  'A U 3A Q',
  'A U 4Q',
  'A U P 3Q',
  '1. A P 3Q',
  '1. A 2P 2A',
  '2. A 3P',
  '3. 3A',
]);

/** Sloped, hunched shoulders, a patched tunic cinched by a rope, a torn hem. */
export const tunic = mirrored('villager tunic', 14, [
  '8. 6A',
  '5. 3A 3O 3N',
  '3. 2A 4O 5N',
  '2. A 5O 6N',
  '1. A 5O 7N',
  '1. A 4O 8N',
  'A 4O 9N',
  ...Array.from({ length: 6 }, () => 'A 3O 6N L 3N'),
  'A 2O 3N 3L N L 3N',
  'A 2O 3N 3L N L 3N',
  '1. A 3V W 8V',
  '1. A O 7N L 3N',
  'A 2O 7N L 3N',
  'A 2O 7N L 3N',
  'A 2O 3N A 3N L 3N',
  'A O 3N A 1. A 2N L 3N',
  '1. 4A 2. 7A',
]);

const leg = part('villager leg', 7, [
  ...Array.from({ length: 18 }, () => 'A 4U T A'),
  'A V U V U T A',
  'A U V U V T A',
  'A 5T A',
  '7A',
]);

const CLOTH = { W: 'O', V: 'N', U: 'L', T: 'K', N: 'Q' };
export const sleeve = recolor(monkSleeve, CLOTH, 'villager sleeve');
export const armUpFwd = recolor(monkArmUpFwd, CLOTH, 'villager arm raised');
export const heap = recolor(monkHeap, { ...CLOTH, R: 'Q' }, 'villager heap');

const forkHead = ['Q 2. Q 2. Q', 'R 2. R 2. R', 'R 2. R 2. R', 'Q 2. Q 2. Q', 'Q 2. Q 2. Q', 'P 2. Q 2. P', '7P', '1. A 3P A', '2. A Q A'];
/** Pitchfork, tines up. */
const fork = part('pitchfork', 7, [...forkHead, ...Array.from({ length: 35 }, () => '2. A W V A')]);
const forkShort = part('pitchfork, foreshortened', 7, [...forkHead, ...Array.from({ length: 12 }, () => '2. A W V A')]);

export const HOLLOW_VILLAGER: CharacterArt = poleFighter({
  id: 'hollow_villager',
  figure: (dx, dy, bow) => [
    // Legs stay planted; the body sinks over them when it kneels.
    at(leg, 23, 42),
    at(flipX(leg), 34, 42),
    at(tunic, 18 + dx, 27 + dy),
    at(sleeve, 13 + dx, 28 + dy),
    at(head, 26 + dx, 17 + dy + bow),
  ],
  sleeve,
  armUpFwd,
  pole: fork,
  poleShort: forkShort,
  ground: (y) => [at(heap, 10, 50 + y)],
});
