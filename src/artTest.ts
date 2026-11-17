// Art test page (art-test.html): every tag of each hand-drawn character from /art/atlas.json,
// with the placeholder sheet's version underneath, so new art can be reviewed frame by frame.
// `?scale=N` sets the zoom (default 3). A dev tool; labels use the browser font.
import { loadAtlas, SpriteBank } from './platform/atlas';
import { CHARACTERS } from './platform/characters';
import { buildPlaceholderSheet } from './platform/placeholderArt';

const canvas = document.getElementById('sheet');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('art-test.html is missing #sheet');
const scale = Number(new URLSearchParams(window.location.search).get('scale') ?? 3) || 3;

void (async () => {
  const real = await loadAtlas(`${import.meta.env.BASE_URL}art/atlas.json`);
  const placeholder = new SpriteBank([buildPlaceholderSheet()]);
  const drawn = real ? new SpriteBank([real]) : null;
  const ids = CHARACTERS.filter((c) => real?.data.tags.has(`${c.id}/idle`));
  document.body.dataset['characters'] = ids.map((c) => c.id).join(',');
  const rows = ids.flatMap((c) => [...Object.keys(c.tags)].map((tag) => ({ c, tag })));
  // Each row: the drawn frames on top, the placeholder's underneath, sized to the character.
  const heightOf = (c: (typeof ids)[number]): number => 2 * (c.h + 2) + 16;
  const tops: number[] = [];
  let total = 0;
  for (const { c } of rows) {
    tops.push(total);
    total += heightOf(c);
  }
  const widest = Math.max(...rows.map(({ c, tag }) => 40 + (c.tags[tag] ?? 0) * (c.w + 2)));
  canvas.width = widest * scale;
  canvas.height = total * scale;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  g.scale(scale, scale);
  rows.forEach(({ c, tag }, r) => {
    const top = tops[r] ?? 0;
    g.fillStyle = r % 2 ? '#20263a' : '#191e2a';
    g.fillRect(0, top, widest, heightOf(c));
    g.fillStyle = '#e8e6df';
    g.font = '6px monospace';
    g.fillText(`${c.id}/${tag}`, 2, top + 9);
    g.fillStyle = '#9aa1b1';
    g.fillText('drawn', 2, top + 14 + c.h / 2);
    g.fillText('placeholder', 2, top + 16 + c.h + c.h / 2);
    for (let f = 0; f < (c.tags[tag] ?? 0); f++) {
      const x = 40 + f * (c.w + 2) + c.w / 2;
      drawn?.draw(g, c.id, { tag, frame: f, flip: false }, x, top + 12 + c.h);
      placeholder.draw(g, c.id, { tag, frame: f, flip: false }, x, top + 14 + 2 * c.h);
    }
  });
})();
