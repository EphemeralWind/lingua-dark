// Builds the hand-drawn sprite sheet: an Aseprite-format JSON atlas plus a PNG, laid out by the
// same layoutAtlas() the placeholder sheet uses. Deterministic, so the committed files can be
// checked against a fresh build. PNG encoding uses node:zlib only (no dependency).
import { deflateSync } from 'node:zlib';
import { layoutAtlas, type AsepriteJson } from '../src/platform/atlas';
import { PALETTE } from '../src/platform/palette';
import { rasterize, type CharacterArt } from './kit';
import { BOSS_BELL } from './sprites/bossBell';
import { CROW } from './sprites/crow';
import { GHOST } from './sprites/ghost';
import { HOLLOW_MONK } from './sprites/hollowMonk';
import { HOLLOW_SMITH } from './sprites/hollowSmith';
import { HOLLOW_VILLAGER } from './sprites/hollowVillager';
import { PLAYER } from './sprites/player';
import { WHISPERER } from './sprites/whisperer';

/** Characters with hand-drawn art. Everything else falls back to the placeholder sheet. */
export const ART: readonly CharacterArt[] = [PLAYER, HOLLOW_MONK, HOLLOW_VILLAGER, HOLLOW_SMITH, CROW, GHOST, WHISPERER, BOSS_BELL];

export interface BuiltSheet {
  json: AsepriteJson;
  width: number;
  height: number;
  rgba: Uint8Array;
}

const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

export function buildSheet(chars: readonly CharacterArt[] = ART, image = 'atlas.png'): BuiltSheet {
  const json = layoutAtlas(chars.map((c) => ({ id: c.id, w: c.w, h: c.h, tags: Object.fromEntries(Object.entries(c.tags).map(([t, f]) => [t, f.length])) })));
  json.meta.image = image;
  const width = json.meta.size?.w ?? 0;
  const height = json.meta.size?.h ?? 0;
  const rgba = new Uint8Array(width * height * 4);
  const frames = Array.isArray(json.frames) ? json.frames : [];
  let i = 0;
  for (const c of chars) {
    for (const list of Object.values(c.tags)) {
      for (const frame of list) {
        const rect = frames[i++]?.frame;
        if (!rect) throw new Error('atlas layout and frames disagree');
        const px = rasterize(frame, c.w, c.h);
        for (let y = 0; y < c.h; y++) {
          for (let x = 0; x < c.w; x++) {
            const k = px[y * c.w + x] ?? -1;
            if (k < 0) continue;
            const [r, g, b] = rgbOf(PALETTE[k] ?? '#000000');
            const o = ((rect.y + y) * width + rect.x + x) * 4;
            rgba.set([r, g, b, 255], o);
          }
        }
      }
    }
  }
  return { json, width, height, rgba };
}

// --- PNG -------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** 8-bit RGBA PNG, no filtering. */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function atlasJsonText(sheet: BuiltSheet): string {
  return `${JSON.stringify(sheet.json, null, 1)}\n`;
}
