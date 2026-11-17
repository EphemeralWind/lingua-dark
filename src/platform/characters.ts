// Every character the game draws, with its sprite size and placeholder look. Pure data.
// Wardens wear a crown and a seal diamond so they read as wardens by shape, not by label.
import { requiredTags } from '../combat/sprites';
import type { SheetCharacter } from './atlas';
import { C, type PaletteColor } from './palette';

export type Head = 'hood' | 'helm' | 'beak' | 'bare' | 'bell' | 'cowl' | 'player';
export type Weapon = 'sword' | 'staff' | 'hammer' | 'claw' | 'bellHammer' | 'fork';

export interface Look {
  body: PaletteColor;
  dark: PaletteColor;
  light: PaletteColor;
  head: Head;
  weapon: Weapon;
  /** Body width factor. */
  bulk: number;
  /** Drawn as a hollow outline. */
  hollow?: boolean;
}

export interface CharacterSpec extends SheetCharacter {
  kind: 'enemy' | 'player';
  warden?: boolean;
  boss?: boolean;
  look: Look;
}

const enemy = (id: string, look: Look, extra: Partial<CharacterSpec> = {}): CharacterSpec => ({
  id,
  kind: 'enemy',
  w: 64,
  h: 64,
  tags: requiredTags('enemy'),
  look,
  ...extra,
});

export const CHARACTERS: readonly CharacterSpec[] = [
  {
    id: 'player',
    kind: 'player',
    w: 48,
    h: 64,
    tags: requiredTags('player'),
    look: { body: C.player, dark: C.floorNear, light: C.playerEdge, head: 'player', weapon: 'sword', bulk: 1 },
  },
  enemy('hollow_villager', { body: C.enemy, dark: C.enemyDark, light: C.cardEdge, head: 'bare', weapon: 'fork', bulk: 1 }),
  enemy('hollow_smith', { body: C.leather, dark: C.warmFloor, light: C.wood, head: 'helm', weapon: 'hammer', bulk: 1.25 }),
  enemy('hollow_monk', { body: C.wood, dark: C.leather, light: C.dim, head: 'cowl', weapon: 'staff', bulk: 1.1 }, { warden: true }),
  enemy('whisperer', { body: C.ghost, dark: C.playerEdge, light: C.pale, head: 'hood', weapon: 'claw', bulk: 0.85 }, { warden: true }),
  enemy('crow', { body: C.player, dark: C.night, light: C.cardEdge, head: 'beak', weapon: 'sword', bulk: 1 }, { warden: true }),
  enemy('ghost', { body: C.dim, dark: C.enemyDark, light: C.pale, head: 'bare', weapon: 'sword', bulk: 1, hollow: true }),
  enemy(
    'boss_zone1',
    { body: C.bossLight, dark: C.bossDeep, light: C.wood, head: 'bell', weapon: 'bellHammer', bulk: 1.3 },
    { w: 128, h: 112, boss: true },
  ),
];

export function character(id: string): CharacterSpec | undefined {
  return CHARACTERS.find((c) => c.id === id);
}
