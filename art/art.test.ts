import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { requiredTags } from '../src/combat/sprites';
import { missingTags, parseAtlas } from '../src/platform/atlas';
import { CHARACTERS } from '../src/platform/characters';
import { ART, atlasJsonText, buildSheet, encodePng } from './build';
import { decodeRow, flipX, KEYS, part, rasterize, rotCW } from './kit';

describe('art kit', () => {
  it('decodes run-length rows and pads them to the part width', () => {
    expect(decodeRow('3. A 2W', 8, 't')).toBe('...AWW..');
    expect(decodeRow('12A', 12, 't')).toBe('A'.repeat(12));
  });

  it('rejects rows that are too long and unknown colour keys', () => {
    expect(() => decodeRow('9A', 8, 'wide')).toThrow(/9 pixels in a row of 8/);
    expect(() => decodeRow('2z', 8, 'key')).toThrow(/unknown colour key "z"/);
  });

  it('turns and mirrors parts exactly', () => {
    const p = part('L', 2, ['A.', 'AB']);
    expect(rotCW(p).rows).toEqual(['AA', 'B.']);
    expect(flipX(p).rows).toEqual(['.A', 'BA']);
  });

  it('later parts draw over earlier ones and off-frame pixels clip', () => {
    const a = part('a', 2, ['AA']);
    const b = part('b', 1, ['B']);
    const px = rasterize([{ part: a, x: -1, y: 0 }, { part: b, x: 0, y: 0 }], 2, 1);
    expect([...px]).toEqual([1, -1]);
  });
});

describe('hand-drawn characters', () => {
  it.each(ART.map((c) => [c.id, c] as const))('%s has every SPEC 8 tag at the right size', (_id, c) => {
    const spec = CHARACTERS.find((x) => x.id === c.id);
    expect(spec).toBeDefined();
    expect([c.w, c.h]).toEqual([spec!.w, spec!.h]);
    const required = requiredTags(spec!.kind);
    expect(Object.keys(c.tags).sort()).toEqual(Object.keys(required).sort());
    for (const [tag, n] of Object.entries(required)) expect(c.tags[tag]?.length, tag).toBe(n);
  });

  it('every frame draws something inside the frame', () => {
    for (const c of ART) {
      for (const [tag, frames] of Object.entries(c.tags)) {
        frames.forEach((f, i) => expect(rasterize(f, c.w, c.h).some((k) => k >= 0), `${c.id}/${tag} ${i}`).toBe(true));
      }
    }
  });

  it("the readied sword's hilt stays hidden behind the body in every fight frame", () => {
    const player = ART.find((c) => c.id === 'player')!;
    const hilt = [KEYS.indexOf('c'), KEYS.indexOf('d')];
    for (const tag of ['guard', 'parry_north', 'parry_east', 'parry_south', 'hit_north', 'hit_east', 'hit_south']) {
      player.tags[tag]!.forEach((f, i) => {
        const shown = [...rasterize(f, player.w, player.h)].filter((k) => hilt.includes(k)).length;
        expect(shown, `${tag} ${i}`).toBe(0);
      });
    }
  });

  it('the warden wears its crown in every frame, even fallen', () => {
    const monk = ART.find((c) => c.id === 'hollow_monk')!;
    for (const [tag, frames] of Object.entries(monk.tags)) {
      frames.forEach((f, i) => expect(f.some((p) => p.part.name === 'warden crown'), `${tag} ${i}`).toBe(true));
    }
  });
});

describe('built sheet', () => {
  const sheet = buildSheet();

  it('is a valid atlas with every required tag for each hand-drawn character', () => {
    const atlas = parseAtlas(sheet.json);
    if (typeof atlas === 'string') throw new Error(atlas);
    for (const c of ART) {
      const kind = CHARACTERS.find((x) => x.id === c.id)!.kind;
      expect(missingTags(atlas, c.id, requiredTags(kind)), c.id).toEqual([]);
    }
  });

  it('encodes a PNG whose pixels round-trip', () => {
    const png = encodePng(sheet.width, sheet.height, sheet.rgba);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([sheet.width, sheet.height]);
    const idatLen = view.getUint32(33);
    const raw = inflateSync(png.subarray(41, 41 + idatLen));
    const stride = sheet.width * 4 + 1;
    for (const y of [0, Math.floor(sheet.height / 2), sheet.height - 1]) {
      expect(raw[y * stride]).toBe(0);
      expect([...raw.subarray(y * stride + 1, (y + 1) * stride)]).toEqual([...sheet.rgba.subarray(y * sheet.width * 4, (y + 1) * sheet.width * 4)]);
    }
  });

  it('the committed public/art files match a fresh build (run `npm run build-art`)', () => {
    expect(readFileSync('public/art/atlas.json', 'utf8')).toBe(atlasJsonText(sheet));
    expect(Buffer.from(readFileSync('public/art/atlas.png')).equals(Buffer.from(encodePng(sheet.width, sheet.height, sheet.rgba)))).toBe(true);
  });
});
