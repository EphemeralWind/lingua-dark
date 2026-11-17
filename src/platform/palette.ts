// The 32-colour palette (SPEC 8): desaturated blues and greys, warm greys and browns for the
// bonfire and the boss, one warm accent (bonfire orange) and one signal colour (parry flashes).
// Meaning never rides on colour alone: every state also has a shape (DECISIONS #6, SPEC 8).
export const PALETTE = [
  '#0b0d12', '#10131b', '#141824', '#191e2a', '#1c2230', '#20263a', '#262d3d', '#2a3142',
  '#2f3748', '#343c50', '#3d4558', '#4a5061', '#566079', '#6b7385', '#7d869c', '#9aa1b1',
  '#a9b0bf', '#c5cad4', '#e8e6df', '#2b2a33', '#3a3430', '#4f4640', '#6e6259', '#331f24',
  '#40282d', '#5c3a40', '#c85a5a', '#8a3d3d', '#e08a3c', '#b0682c', '#f2e6a0', '#5f7a8a',
] as const;

export type PaletteColor = (typeof PALETTE)[number];

/** Named roles. */
export const C = {
  void: '#0b0d12',
  night: '#10131b',
  barBack: '#141824',
  far: '#191e2a',
  sky: '#1c2230',
  card: '#20263a',
  wall: '#262d3d',
  floor: '#2a3142',
  floorMid: '#2f3748',
  floorNear: '#343c50',
  player: '#3d4558',
  enemyDark: '#4a5061',
  playerEdge: '#566079',
  enemy: '#6b7385',
  cardEdge: '#7d869c',
  dim: '#9aa1b1',
  weapon: '#a9b0bf',
  pale: '#c5cad4',
  text: '#e8e6df',
  warmWall: '#2b2a33',
  warmFloor: '#3a3430',
  leather: '#4f4640',
  wood: '#6e6259',
  bossDeep: '#331f24',
  bossMid: '#40282d',
  bossLight: '#5c3a40',
  hurt: '#c85a5a',
  hurtDark: '#8a3d3d',
  ember: '#e08a3c',
  emberDark: '#b0682c',
  signal: '#f2e6a0',
  ghost: '#5f7a8a',
} as const satisfies Record<string, PaletteColor>;
