// Every scenery piece, built into public/art/scenery.{json,png} by `npm run build-art`.
import type { CharacterArt } from '../kit';
import { ARENAS } from './arenas';
import { PROPS } from './props';
import { ROOMS } from './rooms';

export const SCENERY: readonly CharacterArt[] = [...ROOMS, ...PROPS, ...ARENAS];
