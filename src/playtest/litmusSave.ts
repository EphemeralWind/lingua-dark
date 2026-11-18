// The litmus save (docs/PLAYTEST.md): a fresh run with every seal and every warden beaten, so a
// tester walks from the bonfire (lane, chapel, gate) straight to the first boss. The lane's
// villager starts defeated; like any regular enemy it is back after a death. Nothing is learned,
// no XP. Pure; `npm run litmus-save` writes it to public/playtest/ for the deployed site.
import { newProfile } from '../learning/profile';
import { serialize } from '../save/store';
import { newGame, returnToBonfire, walk, type GameState } from '../world/state';
import { ZONE1, type Zone } from '../world/zone';

/** Rooms on the walk from the bonfire to the gate, in order. */
export const LITMUS_ROUTE = ['r1_lane', 'r1_chapel', 'r1_gate'] as const;
export const LITMUS_SEED = 20261118;

export function litmusGame(zone: Zone = ZONE1): GameState {
  const g = newGame(zone, LITMUS_SEED);
  for (const room of LITMUS_ROUTE) walk(g, room, null);
  // A loaded game always wakes at its bonfire.
  returnToBonfire(g);
  g.seals = Object.keys(zone.seals);
  g.wardensBeaten = zone.rooms.map((r) => r.id).filter((id) => zone.wardenSeal(id) !== null);
  g.defeated = ['r1_lane'];
  return g;
}

export function litmusSaveText(): string {
  return `${serialize(litmusGame(), Date.UTC(2026, 10, 18), newProfile())}\n`;
}
