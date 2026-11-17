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
  const real = await loadAtlas('/art/atlas.json');
  const placeholder = new SpriteBank([buildPlaceholderSheet()]);
  const drawn = real ? new SpriteBank([real]) : null;
  const ids = CHARACTERS.filter((c) => real?.data.tags.has(`${c.id}/idle`));
  document.body.dataset['characters'] = ids.map((c) => c.id).join(',');
  const rows = ids.flatMap((c) => [...Object.keys(c.tags)].map((tag) => ({ c, tag })));
  const cellW = 66;
  const rowH = 2 * 66 + 16;
  canvas.width = 120 + 6 * cellW * scale;
  canvas.height = rows.length * rowH * scale;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.imageSmoothingEnabled = false;
  g.scale(scale, scale);
  rows.forEach(({ c, tag }, r) => {
    const top = r * rowH;
    g.fillStyle = r % 2 ? '#20263a' : '#191e2a';
    g.fillRect(0, top, canvas.width, rowH);
    g.fillStyle = '#e8e6df';
    g.font = '6px monospace';
    g.fillText(`${c.id}/${tag}`, 2, top + 9);
    g.fillStyle = '#9aa1b1';
    g.fillText('drawn', 2, top + 50);
    g.fillText('placeholder', 2, top + 116);
    for (let f = 0; f < (c.tags[tag] ?? 0); f++) {
      const x = 40 + f * cellW + c.w / 2;
      drawn?.draw(g, c.id, { tag, frame: f, flip: false }, x, top + 12 + 64);
      placeholder.draw(g, c.id, { tag, frame: f, flip: false }, x, top + 12 + 64 + 66);
    }
  });
})();
