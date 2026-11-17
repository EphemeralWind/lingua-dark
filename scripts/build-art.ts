// `npm run build-art`: writes public/art/atlas.json and atlas.png from the hand-drawn parts in
// art/sprites, and public/art/scenery.{json,png} from art/scenery (rooms, doors, arenas). The
// game loads both at startup; anything they lack is drawn from placeholders.
import { mkdirSync, writeFileSync } from 'node:fs';
import { atlasJsonText, buildSheet, encodePng } from '../art/build';
import { SCENERY } from '../art/scenery/index';

const sheet = buildSheet();
mkdirSync('public/art', { recursive: true });
writeFileSync('public/art/atlas.json', atlasJsonText(sheet));
writeFileSync('public/art/atlas.png', encodePng(sheet.width, sheet.height, sheet.rgba));
const scenery = buildSheet(SCENERY, 'scenery.png');
writeFileSync('public/art/scenery.json', atlasJsonText(scenery));
writeFileSync('public/art/scenery.png', encodePng(scenery.width, scenery.height, scenery.rgba));
console.log(`public/art/scenery.png: ${scenery.width}x${scenery.height}`);
console.log(`public/art/atlas.png: ${sheet.width}x${sheet.height}, ${Array.isArray(sheet.json.frames) ? sheet.json.frames.length : 0} frames`);
