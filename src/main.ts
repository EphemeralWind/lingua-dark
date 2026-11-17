// Boot: platform setup, art, sound and settings, then the world (default) or a practice fight
// (`/?seed=N`, used by the smoke test). Only platform and scenes touch the browser.
import { loadAtlas, SpriteBank, type Sheet } from './platform/atlas';
import { Sound } from './platform/audio';
import { DayClock } from './platform/clock';
import { GameTime } from './platform/gameTime';
import { Input, type InputEvent } from './platform/input';
import { startLoop } from './platform/loop';
import { buildPlaceholderSheet } from './platform/placeholderArt';
import { Renderer } from './platform/renderer';
import { RiposteInput } from './platform/riposteInput';
import { Speech } from './platform/speech';
import { BrowserStore } from './platform/storage';
import { defaultSettings, loadSettings, saveSettings } from './save/settings';
import { SaveStore } from './save/store';
import { CombatScene } from './scenes/combat';
import { GameScene } from './scenes/game';
import { CuePlayer, type Services } from './scenes/services';
import { SettingsMenu } from './scenes/settingsMenu';
import { LARGE_TEXT_SCALE } from './tuning';

async function boot(): Promise<void> {
  const canvas = document.getElementById('screen');
  const field = document.getElementById('riposte-input');
  if (!(canvas instanceof HTMLCanvasElement) || !(field instanceof HTMLInputElement)) {
    throw new Error('index.html is missing #screen or #riposte-input');
  }

  const kv = new BrowserStore();
  const prefersCalm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const settings = loadSettings(kv, defaultSettings(prefersCalm));
  const renderer = new Renderer(canvas);
  const time = new GameTime();
  const input = new Input(renderer, canvas, () => time.now());
  const sound = new Sound();
  const speech = new Speech();

  // Real art if /art/atlas.json exists; the generated placeholder sheet covers anything missing.
  const real = await loadAtlas('/art/atlas.json');
  const sheets: Sheet[] = real ? [real, buildPlaceholderSheet()] : [buildPlaceholderSheet()];

  const svc: Services = {
    sprites: new SpriteBank(sheets),
    sound,
    speech,
    cues: new CuePlayer(sound),
    time,
    settings,
    riposte: new RiposteInput(field),
    setTextMode: (on) => {
      input.textMode = on;
    },
  };
  const apply = (): void => {
    renderer.textScale = settings.largerText ? LARGE_TEXT_SCALE : 1;
    sound.sfxOn = settings.sfx;
    sound.setMusic(settings.music);
    speech.enabled = settings.speech;
    if (!settings.speech) speech.cancel();
    document.body.dataset['reducedMotion'] = String(settings.reducedMotion);
    saveSettings(kv, settings);
  };
  apply();
  const menu = new SettingsMenu(svc, apply);

  const seedParam = new URLSearchParams(window.location.search).get('seed');
  const seed = seedParam === null ? NaN : Number(seedParam);
  const scene = Number.isFinite(seed)
    ? new CombatScene(seed >>> 0, svc)
    : new GameScene(svc, { store: new SaveStore(kv), clock: new DayClock(), dev: import.meta.env.DEV });

  startLoop(
    {
      update: (now) => {
        // Route events one at a time: O opens the menu, and the menu takes everything until it
        // closes; events after that, even in the same tick, go to the scene.
        const toScene: InputEvent[] = [];
        for (const ev of input.drain()) {
          if (menu.isOpen) menu.handle(ev);
          else if (!input.textMode && ev.type === 'key' && ev.code === 'KeyO') menu.open();
          else toScene.push(ev);
        }
        scene.update(now, toScene);
      },
      render: (now) => {
        scene.render(renderer, now);
        if (menu.isOpen) menu.render(renderer);
      },
    },
    () => time.now(),
  );
}

void boot();
