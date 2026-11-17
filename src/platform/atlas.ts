// Sprite sheets: a PNG plus an Aseprite JSON atlas (CLAUDE.md, Rendering and art).
//
// Tag names are `<character>/<animation>`, e.g. `whisperer/strike_east`, with the frame counts in
// src/combat/sprites.ts. Frames are anchored at their bottom centre. Real art lives at
// /art/atlas.json + its PNG; any character it lacks (or the whole sheet, if absent) is drawn
// from the generated placeholder atlas, which uses the same format.
//
// `parseAtlas` and `layoutAtlas` are pure and tested; the loader and SpriteBank touch the browser.
import type { SpriteFrame } from '../combat/sprites';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The subset of Aseprite's JSON export the game reads ("hash" or "array" frames). */
export interface AsepriteJson {
  frames: Record<string, { frame: Rect; duration?: number }> | { filename: string; frame: Rect; duration?: number }[];
  meta: { image?: string; size?: { w: number; h: number }; frameTags?: { name: string; from: number; to: number }[] };
}

export interface AtlasData {
  /** Frames in sheet order. */
  frames: Rect[];
  /** Tag -> frame indices into `frames`. */
  tags: Map<string, number[]>;
  image: string | null;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isRect = (x: unknown): x is Rect => isObj(x) && ['x', 'y', 'w', 'h'].every((k) => typeof x[k] === 'number');

/** Reads an Aseprite atlas. Returns an error string for anything malformed. */
export function parseAtlas(json: unknown): AtlasData | string {
  if (!isObj(json) || !isObj(json['meta'])) return 'atlas needs frames and meta';
  const raw = json['frames'];
  const list: unknown[] = Array.isArray(raw) ? raw : isObj(raw) ? Object.values(raw) : [];
  if (list.length === 0) return 'atlas has no frames';
  const frames: Rect[] = [];
  for (const f of list) {
    if (!isObj(f) || !isRect(f['frame'])) return `frame ${frames.length} has no frame rect`;
    frames.push({ ...f['frame'] });
  }
  const tags = new Map<string, number[]>();
  const tagList = json['meta']['frameTags'];
  if (tagList !== undefined && !Array.isArray(tagList)) return 'meta.frameTags must be a list';
  for (const t of tagList ?? []) {
    if (!isObj(t) || typeof t['name'] !== 'string' || typeof t['from'] !== 'number' || typeof t['to'] !== 'number') return 'malformed frame tag';
    const { name, from, to } = t as { name: string; from: number; to: number };
    if (from < 0 || to >= frames.length || to < from) return `tag ${name} is out of range`;
    tags.set(name, Array.from({ length: to - from + 1 }, (_, i) => from + i));
  }
  const image = json['meta']['image'];
  return { frames, tags, image: typeof image === 'string' ? image : null };
}

/** Required tags (from requiredTags) a character is missing in an atlas, or too short. */
export function missingTags(atlas: AtlasData, character: string, required: Record<string, number>): string[] {
  return Object.entries(required)
    .filter(([tag, n]) => (atlas.tags.get(`${character}/${tag}`)?.length ?? 0) < n)
    .map(([tag]) => `${character}/${tag}`);
}

export interface SheetCharacter {
  id: string;
  w: number;
  h: number;
  /** Tag -> frame count. */
  tags: Record<string, number>;
}

/** Lays characters out one row each, frames left to right, as an Aseprite atlas. */
export function layoutAtlas(chars: readonly SheetCharacter[]): AsepriteJson {
  const frames: { filename: string; frame: Rect }[] = [];
  const frameTags: { name: string; from: number; to: number }[] = [];
  let y = 0;
  let width = 0;
  for (const c of chars) {
    let x = 0;
    for (const [tag, n] of Object.entries(c.tags)) {
      const from = frames.length;
      for (let i = 0; i < n; i++) {
        frames.push({ filename: `${c.id}/${tag} ${i}`, frame: { x, y, w: c.w, h: c.h } });
        x += c.w;
      }
      frameTags.push({ name: `${c.id}/${tag}`, from, to: frames.length - 1 });
    }
    width = Math.max(width, x);
    y += c.h;
  }
  return { frames, meta: { image: 'placeholder', size: { w: width, h: y }, frameTags } };
}

// --- browser side ----------------------------------------------------------

export interface Sheet {
  data: AtlasData;
  image: CanvasImageSource;
}

/** Loads /art/atlas.json and its image. Resolves null when there is no real art (or it is broken). */
export async function loadAtlas(url: string): Promise<Sheet | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    const data = parseAtlas(await res.json());
    if (typeof data === 'string') {
      console.warn(`art atlas ignored: ${data}`);
      return null;
    }
    const img = new Image();
    img.src = new URL(data.image ?? 'atlas.png', new URL(url, window.location.href)).href;
    await img.decode();
    return { data, image: img };
  } catch {
    return null;
  }
}

export interface DrawOpts {
  /** 0 to 1. */
  alpha?: number;
  /** Draw at half size (distant figures in rooms). */
  half?: boolean;
}

/** Real sheets first, then the placeholder sheet, per tag. */
export class SpriteBank {
  constructor(private readonly sheets: readonly Sheet[]) {}

  /** Size of a character's first idle frame, or null if no sheet has it. */
  size(character: string): { w: number; h: number } | null {
    return this.frameSize(character, 'idle');
  }

  /** Size of the first frame of one of a character's tags, or null if no sheet has it. */
  frameSize(character: string, tag: string): { w: number; h: number } | null {
    for (const s of this.sheets) {
      const i = s.data.tags.get(`${character}/${tag}`)?.[0];
      const f = i === undefined ? undefined : s.data.frames[i];
      if (f) return { w: f.w, h: f.h };
    }
    return null;
  }

  /** Draws a frame with its bottom centre at (x, bottom), in internal pixels. */
  draw(g: CanvasRenderingContext2D, character: string, f: SpriteFrame, x: number, bottom: number, opts: DrawOpts = {}): boolean {
    for (const s of this.sheets) {
      const frames = s.data.tags.get(`${character}/${f.tag}`);
      if (!frames) continue;
      const rect = s.data.frames[frames[Math.min(f.frame, frames.length - 1)] ?? 0];
      if (!rect) continue;
      const k = opts.half ? 0.5 : 1;
      const w = Math.round(rect.w * k);
      const h = Math.round(rect.h * k);
      const left = Math.round(x - w / 2);
      const top = Math.round(bottom - h);
      g.save();
      g.imageSmoothingEnabled = false;
      if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
      if (f.flip) {
        g.translate(left + w, top);
        g.scale(-1, 1);
        g.drawImage(s.image, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
      } else {
        g.drawImage(s.image, rect.x, rect.y, rect.w, rect.h, left, top, w, h);
      }
      g.restore();
      return true;
    }
    return false;
  }
}
