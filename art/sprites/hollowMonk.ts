// The Hollow Monk: warden of the Seal of Verbs (chapel). 64x64, facing the camera.
// Hand-drawn parts; light falls from the upper left. Colour keys (art/kit.ts): A outline,
// W/V/U/T robe light to deep, O/P rope, N hands, R/S crown and staff metal, e/d seal and lantern.
//
// The wind-up frames depend on the frame index only: one shared animation for every question.
import { at, part, type CharacterArt } from '../kit';
import { poleFighter } from './rig';
import { crown, seal } from './warden';

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

/** A sleeve hanging down, hand at the bottom (the monk's right arm, screen left). */
export const sleeve = part('monk sleeve', 7, [
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
export const armUpFwd = part('monk arm raised', 10, [
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
export const heap = part('monk heap', 44, [
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

// --- the figure ------------------------------------------------------------

/** Where the crown rolls as the body settles. */
const CROWN_REST: Record<number, { x: number; y: number }> = { [-2]: { x: 46, y: 52 }, [-1]: { x: 47, y: 55 }, 0: { x: 48, y: 57 } };

export const HOLLOW_MONK: CharacterArt = poleFighter({
  id: 'hollow_monk',
  figure: (dx, dy, bow) => [
    at(robe, 16 + dx, 28 + dy),
    at(sleeve, 13 + dx, 29 + dy),
    at(hood, 22 + dx, 12 + dy + bow),
    at(crown, 25 + dx, 6 + dy + bow),
    at(seal, 29 + dx, 34 + dy),
  ],
  sleeve,
  armUpFwd,
  pole: staff,
  poleShort: staffShort,
  ground: (y) => [at(heap, 10, 50 + y), at(crown, CROWN_REST[y]?.x ?? 48, CROWN_REST[y]?.y ?? 57)],
});
