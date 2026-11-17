// Boot: platform setup, then the world (default) or a practice fight (`/?seed=N`, used by the
// smoke test). Only platform and scenes touch the browser.
import { DayClock } from './platform/clock';
import { Input } from './platform/input';
import { startLoop } from './platform/loop';
import { Renderer } from './platform/renderer';
import { RiposteInput } from './platform/riposteInput';
import { BrowserStore } from './platform/storage';
import { SaveStore } from './save/store';
import { CombatScene } from './scenes/combat';
import { GameScene } from './scenes/game';

const canvas = document.getElementById('screen');
const field = document.getElementById('riposte-input');
if (!(canvas instanceof HTMLCanvasElement) || !(field instanceof HTMLInputElement)) {
  throw new Error('index.html is missing #screen or #riposte-input');
}

const renderer = new Renderer(canvas);
const input = new Input(renderer, canvas);
const riposte = new RiposteInput(field);
const setTextMode = (on: boolean): void => {
  input.textMode = on;
};

const seedParam = new URLSearchParams(window.location.search).get('seed');
const seed = seedParam === null ? NaN : Number(seedParam);

const scene = Number.isFinite(seed)
  ? new CombatScene(seed >>> 0, riposte, setTextMode)
  : new GameScene({ riposte, setTextMode, store: new SaveStore(new BrowserStore()), clock: new DayClock(), dev: import.meta.env.DEV });

startLoop({
  update: (now) => scene.update(now, input.drain()),
  render: (now) => scene.render(renderer, now),
});
