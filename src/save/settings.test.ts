import { describe, expect, it } from 'vitest';
import { defaultSettings, loadSettings, parseSettings, saveSettings, SETTINGS_KEY } from './settings';

class MemKv {
  data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
}

describe('settings', () => {
  it('defaults follow the system reduced-motion preference', () => {
    expect(defaultSettings(true).reducedMotion).toBe(true);
    expect(defaultSettings(false)).toEqual({ reducedMotion: false, largerText: false, hollow: false, sfx: true, music: true, speech: true });
  });

  it('round-trips through the store', () => {
    const kv = new MemKv();
    const s = { ...defaultSettings(), hollow: true, largerText: true };
    saveSettings(kv, s);
    expect(kv.data.has(SETTINGS_KEY)).toBe(true);
    expect(loadSettings(kv, defaultSettings())).toEqual(s);
  });

  it('keeps defaults for missing, malformed or unknown fields', () => {
    const d = defaultSettings(true);
    expect(parseSettings(null, d)).toEqual(d);
    expect(parseSettings('{oops', d)).toEqual(d);
    expect(parseSettings('[1]', d)).toEqual(d);
    expect(parseSettings('{"hollow": "yes", "music": false, "extra": 1}', d)).toEqual({ ...d, music: false });
  });
});
