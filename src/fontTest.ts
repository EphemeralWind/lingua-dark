// Font test page (font-test.html): proves the bitmap font draws á é í ó ú ñ ü ¿ ¡ at every
// size the game uses, on the real renderer. `data-missing` on <body> lists any character the
// font lacks (empty means full coverage); missing glyphs would show as hollow boxes.
import { GLYPHS, missingChars } from './platform/font';
import { Renderer } from './platform/renderer';

const REQUIRED = 'á é í ó ú ñ ü ¿ ¡   Á É Í Ó Ú Ñ Ü';
const SAMPLES = ['¿Qué levantáis vosotros? ¡Sí, la espada!', 'El niño lee: «Pingüino»', 'Ñandú · ¡Ánimo! · ¿Útil? · Él, tú, más'];

const canvas = document.getElementById('screen');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('font-test.html is missing #screen');
const r = new Renderer(canvas);
const all = [...GLYPHS.keys()].join('');
document.body.dataset['missing'] = missingChars(REQUIRED + SAMPLES.join('')).join('');
document.body.dataset['glyphs'] = String(GLYPHS.size);

function draw(): void {
  r.begin('#1c2230');
  r.low.fillStyle = '#141824';
  r.low.fillRect(4, 4, 312, 24);
  r.present();
  r.text('REQUIRED (2x, prompt size)', 8, 8, { size: 6, color: '#9aa1b1' });
  r.text(REQUIRED, 8, 20, { size: 12 });
  SAMPLES.forEach((s, i) => r.text(s, 8, 40 + i * 14, { size: 12, maxWidth: 304 }));
  r.text('1x body text: ' + SAMPLES[0], 8, 86, { size: 6, color: '#f2e6a0' });
  r.text('card size: levantáis · comemos · la espada · unas manzanas', 8, 96, { size: 8 });
  r.text(`ALL ${GLYPHS.size} GLYPHS:`, 8, 110, { size: 6, color: '#9aa1b1' });
  const perLine = 64;
  for (let i = 0; i * perLine < all.length; i++) r.text(all.slice(i * perLine, (i + 1) * perLine), 8, 120 + i * 9, { size: 8 });
  r.text(`missing: ${document.body.dataset['missing'] || 'none'}`, 8, 172, { size: 6, color: document.body.dataset['missing'] ? '#c85a5a' : '#f2e6a0' });
}
draw();
window.addEventListener('resize', draw);
