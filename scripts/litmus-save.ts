/// <reference types="node" />
// Writes public/playtest/litmus-save.json, the save the litmus protocol imports (docs/PLAYTEST.md).
// Run with `npm run litmus-save` after a change to the zone data; a test checks it is current.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { litmusSaveText } from '../src/playtest/litmusSave';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/playtest/litmus-save.json');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, litmusSaveText());
console.log(`wrote ${OUT}`);
