// localStorage behind the save store's KeyValueStore interface. Storage can throw (private
// windows, blocked site data), so every access is guarded; a failed write is reported.
import type { KeyValueStore } from '../save/store';

export class BrowserStore implements KeyValueStore {
  lastError: string | null = null;

  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      this.lastError = String(e);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
      this.lastError = null;
    } catch (e) {
      this.lastError = String(e);
    }
  }

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      this.lastError = String(e);
    }
  }
}
