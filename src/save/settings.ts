// Player settings (SPEC 8 accessibility, Prompt 4). Pure: parsed from and written to a key-value
// store under their own key, separate from the run and the profile.
import type { KeyValueStore } from './store';

export const SETTINGS_KEY = 'lingua-dark/settings';

export interface Settings {
  /** No shake, no flashes, no fades or drifting layers (a steady mark replaces the parry flash). */
  reducedMotion: boolean;
  /** Text drawn larger (LARGE_TEXT_SCALE). */
  largerText: boolean;
  /** Hollow mode: no timers. Wind-ups wait for the answer. */
  hollow: boolean;
  /** Sound effects (each has a visual twin and a caption). */
  sfx: boolean;
  /** Quiet ambient loop. */
  music: boolean;
  /** Spanish speech synthesis, when an es-ES voice exists. */
  speech: boolean;
}

export type SettingKey = keyof Settings;
export const SETTING_KEYS: readonly SettingKey[] = ['reducedMotion', 'largerText', 'hollow', 'sfx', 'music', 'speech'];

export function defaultSettings(prefersReducedMotion = false): Settings {
  return { reducedMotion: prefersReducedMotion, largerText: false, hollow: false, sfx: true, music: true, speech: true };
}

/** Reads settings, keeping a default for anything missing or malformed. */
export function parseSettings(text: string | null, defaults: Settings): Settings {
  if (text === null) return { ...defaults };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ...defaults };
  }
  const out = { ...defaults };
  if (typeof data !== 'object' || data === null) return out;
  const rec = data as Record<string, unknown>;
  for (const k of SETTING_KEYS) {
    const v = rec[k];
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export function loadSettings(kv: KeyValueStore, defaults: Settings): Settings {
  return parseSettings(kv.getItem(SETTINGS_KEY), defaults);
}

export function saveSettings(kv: KeyValueStore, s: Settings): void {
  kv.setItem(SETTINGS_KEY, JSON.stringify(s));
}
