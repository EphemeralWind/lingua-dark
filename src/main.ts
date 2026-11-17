// Boot: platform setup and the combat scene. Only platform and scenes touch the browser.
import { Input } from './platform/input';
import { startLoop } from './platform/loop';
import { Renderer } from './platform/renderer';
import { RiposteInput } from './platform/riposteInput';
import { CombatScene } from './scenes/combat';

function readSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  const n = param === null ? NaN : Number(param);
  // No seed given: take one from the wall clock (platform code, not game logic).
  return Number.isFinite(n) ? n >>> 0 : Date.now() >>> 0;
}

const canvas = document.getElementById('screen');
const field = document.getElementById('riposte-input');
if (!(canvas instanceof HTMLCanvasElement) || !(field instanceof HTMLInputElement)) {
  throw new Error('index.html is missing #screen or #riposte-input');
}

const renderer = new Renderer(canvas);
const input = new Input(renderer, canvas);
const riposte = new RiposteInput(field);
const scene = new CombatScene(readSeed(), riposte, (on) => (input.textMode = on));

startLoop({
  update: (now) => scene.update(now, input.drain()),
  render: (now) => scene.render(renderer, now),
});
