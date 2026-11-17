import type { RiposteVerdict } from './types';

const PUNCTUATION = /[.,;:¿?¡!"'«»()]/g;
// Zone 1 forgives a missing acute accent or diaeresis, never ñ (DECISIONS #11).
const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' };

export function normalizeAnswer(s: string): string {
  return s.toLocaleLowerCase('es-ES').replace(PUNCTUATION, ' ').replace(/\s+/g, ' ').trim();
}

function stripAccents(s: string): string {
  return s.replace(/[áéíóúü]/g, (c) => ACCENTS[c] ?? c);
}

export function judgeWord(typed: string, answer: string, forgiveAccents = true): RiposteVerdict {
  const t = normalizeAnswer(typed);
  const a = normalizeAnswer(answer);
  if (t === a) return 'exact';
  // Only a missing accent is forgiven: the typed text has no accent where the answer has one.
  if (forgiveAccents && t === stripAccents(t) && t === stripAccents(a)) return 'accent';
  return 'wrong';
}
