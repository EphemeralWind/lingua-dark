// `npm run build-art`: writes public/art/atlas.json and atlas.png from the hand-drawn parts in
// art/sprites. The game loads them at startup; anything they lack is drawn from placeholders.
import { mkdirSync, writeFileSync } from 'node:fs';
import { atlasJsonText, buildSheet, encodePng } from '../art/build';

const sheet = buildSheet();
mkdirSync('public/art', { recursive: true });
writeFileSync('public/art/atlas.json', atlasJsonText(sheet));
writeFileSync('public/art/atlas.png', encodePng(sheet.width, sheet.height, sheet.rgba));
console.log(`public/art/atlas.png: ${sheet.width}x${sheet.height}, ${Array.isArray(sheet.json.frames) ? sheet.json.frames.length : 0} frames`);
