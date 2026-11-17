import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { requiredTags } from '../src/combat/sprites';
import { missingTags, parseAtlas } from '../src/platform/atlas';
import { CHARACTERS } from '../src/platform/characters';
import { ART, atlasJsonText, buildSheet, encodePng } from './build';
import zone1 from '../src/content/data/zone1-rooms.json';
import lessons from '../src/content/data/lessons.json';
import { DOOR_TAG, PAGE_SLAB, PAGE_TEXT, PROP_AT } from '../src/scenes/sceneryLayout';
import { decodeRow, flipX, ghostly, KEYS, mirrored, part, rasterize, recolor, rotCW, type CharacterArt } from './kit';
import { SCENERY } from './scenery/index';
import { SIDE } from './scenery/props';
import { ROOM_BACKDROPS } from './scenery/rooms';
import { STELE_SLAB, STELE_TEXT } from './scenery/stele';

describe('art kit', () => {
  it('mirrors a half with the right side one shade darker', () => {
    expect(mirrored('m', 2, ['A W']).rows).toEqual(['AWVA']);
    expect(mirrored('m', 2, ['A R'], true).rows).toEqual(['ARA']);
  });

  it('recolours a part and leaves other keys alone', () => {
    expect(recolor(part('p', 3, ['AWV']), { W: 'O' }).rows).toEqual(['AOV']);
  });

  it('makes a see-through ghost: pale outer edge, dark inner lines, dithered mid tones', () => {
    const g = ghostly(part('g', 4, ['4A', 'A N A A', 'A 2N A', '4A']));
    expect(g.rows[0]).toBe('RRRR');
    expect(g.rows[1]).toBe('RfAR');
    expect(g.rows[2]).toBe('R.fR');
  });

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

  it('every warden wears its crown in every frame, even fallen', () => {
    const wardens = ART.filter((c) => CHARACTERS.find((x) => x.id === c.id)?.warden);
    expect(wardens.map((c) => c.id).sort()).toEqual(['crow', 'hollow_monk', 'whisperer']);
    for (const c of wardens) {
      for (const [tag, frames] of Object.entries(c.tags)) {
        frames.forEach((f, i) => expect(f.some((p) => p.part.name === 'warden crown'), `${c.id}/${tag} ${i}`).toBe(true));
      }
    }
  });

  it("the boss's wind-up stays below the rows the fight's prompt band covers", () => {
    const boss = ART.find((c) => c.id === 'boss_zone1')!;
    // fight.ts draws the boss's bottom at y 108, so frame row 32 is screen row 28, under the band.
    boss.tags['windup']!.forEach((f, i) => {
      const px = rasterize(f, boss.w, boss.h);
      expect(px.subarray(0, 32 * boss.w).some((k) => k >= 0), `windup ${i}`).toBe(false);
    });
  });

  it('every character in the game has hand-drawn art', () => {
    expect(ART.map((c) => c.id).sort()).toEqual(CHARACTERS.map((c) => c.id).sort());
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

describe('scenery', () => {
  const sheet = buildSheet(SCENERY, 'scenery.png');
  const piece = (id: string): CharacterArt => {
    const p = SCENERY.find((c) => c.id === id);
    if (!p) throw new Error(`no scenery ${id}`);
    return p;
  };

  it('has a hand-drawn room for every backdrop the zone uses', () => {
    const used = new Set(zone1.rooms.map((r) => r.backdrop));
    for (const b of used) expect(ROOM_BACKDROPS, b).toContain(b);
    for (const b of ROOM_BACKDROPS) expect([piece(`room_${b}`).w, piece(`room_${b}`).h]).toEqual([320, 180]);
  });

  it('draws every door state, each a different picture', () => {
    for (const id of ['door_far', 'door_side']) {
      const tags = piece(id).tags;
      expect(Object.keys(tags).sort()).toEqual(Object.values(DOOR_TAG).sort());
      const pics = Object.values(tags).map((f) => [...rasterize(f[0] ?? [], piece(id).w, piece(id).h)].join());
      expect(new Set(pics).size, id).toBe(pics.length);
    }
    expect(Object.keys(piece('door_near').tags).sort()).toEqual(['closed', 'open']);
  });

  it("puts the far door's opening where the room's exits are (x 146..173, y 60..103)", () => {
    const door = piece('door_far');
    const left = PROP_AT.doorFar.x - door.w / 2;
    const top = PROP_AT.doorFar.bottom - door.h;
    const px = rasterize(door.tags['open']?.[0] ?? [], door.w, door.h);
    // The opening is dark; just outside it is the stone frame.
    expect(KEYS[px[(80 - top) * door.w + (160 - left)] ?? -1]).toBe('A');
    expect(KEYS[px[(80 - top) * door.w + (143 - left)] ?? -1]).not.toBe('A');
  });

  it('places the side doors where the props expect them', () => {
    expect(PROP_AT.doorWest).toEqual({ x: SIDE.x + SIDE.w / 2, bottom: SIDE.y + SIDE.h });
    expect(PROP_AT.doorEast).toEqual({ x: 320 - (SIDE.x + SIDE.w / 2), bottom: SIDE.y + SIDE.h });
  });

  it('has three arena layers for each fight arena, the far strip tiling', () => {
    for (const k of ['village', 'boss']) {
      expect([piece(`arena_${k}_back`).w, piece(`arena_${k}_back`).h]).toEqual([320, 180 - 28]);
      expect([piece(`arena_${k}_near`).w, piece(`arena_${k}_near`).h]).toEqual([320, 180 - 28]);
      expect(piece(`arena_${k}_far`).w).toBe(PROP_AT.arenaFar.tile);
    }
  });

  it('the near arena layer is clear above the horizon, so the far strip shows', () => {
    for (const k of ['village', 'boss']) {
      const near = piece(`arena_${k}_near`);
      const px = rasterize(near.tags['still']?.[0] ?? [], near.w, near.h);
      expect(px[10 * near.w + 160]).toBe(-1);
    }
  });

  it('draws every lesson object, with one page frame per page (DECISIONS #96)', () => {
    for (const o of lessons.objects) {
      expect(piece(o.sprite).tags['still'], o.sprite).toHaveLength(1);
      const page = piece(o.pageSprite);
      expect([page.w, page.h]).toEqual([320, 180]);
      expect(page.tags['face'], o.pageSprite).toHaveLength(o.pages.length);
    }
  });

  it('gives each stele face its own wear, and keeps the text area the game writes in clean', () => {
    expect(STELE_TEXT).toEqual(PAGE_TEXT);
    expect(STELE_SLAB).toEqual(PAGE_SLAB);
    const face = piece('stele_face');
    const frames = (face.tags['face'] ?? []).map((f) => rasterize(f, 320, 180));
    const outside = (px: ArrayLike<number>): string => {
      const out: number[] = [];
      for (let y = 0; y < 180; y++) {
        for (let x = 0; x < 320; x++) {
          const inText = x >= PAGE_TEXT.x && x < PAGE_TEXT.x + PAGE_TEXT.w && y >= PAGE_TEXT.y && y < PAGE_TEXT.y + PAGE_TEXT.h;
          if (!inText) out.push(px[y * 320 + x] ?? -1);
        }
      }
      return out.join();
    };
    const inside = (px: ArrayLike<number>): string => {
      const out: number[] = [];
      for (let y = PAGE_TEXT.y; y < PAGE_TEXT.y + PAGE_TEXT.h; y++) for (let x = PAGE_TEXT.x; x < PAGE_TEXT.x + PAGE_TEXT.w; x++) out.push(px[y * 320 + x] ?? -1);
      return out.join();
    };
    // Four different rims; one identical text area.
    expect(new Set(frames.map(outside)).size).toBe(4);
    expect(new Set(frames.map(inside)).size).toBe(1);
  });

  it('has the bonfire rest scene: a backdrop and the seated player breathing', () => {
    expect([piece('rest_backdrop').w, piece('rest_backdrop').h]).toEqual([320, 180]);
    expect(piece('rest_player').tags['sit']).toHaveLength(2);
  });

  it('the committed public/art/scenery files match a fresh build (run `npm run build-art`)', () => {
    expect(readFileSync('public/art/scenery.json', 'utf8')).toBe(atlasJsonText(sheet));
    expect(Buffer.from(readFileSync('public/art/scenery.png')).equals(Buffer.from(encodePng(sheet.width, sheet.height, sheet.rgba)))).toBe(true);
  });
});
