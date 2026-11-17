// Template pattern parsing, shared by the validator and the generator.
// "{subj} {verb:present} {art:definite}{noun}." -> literal and slot parts.
// Adjacent slot parts with no literal between them are joined with one space (DECISIONS #22).

export interface SlotPart {
  kind: 'slot';
  slot: string;
  /** Text after the colon: present, definite, indefinite, plural. */
  modifier: string | null;
}

export interface LiteralPart {
  kind: 'literal';
  text: string;
}

export type PatternPart = SlotPart | LiteralPart;

const PLACEHOLDER = /\{([^{}]*)\}/g;

export function parsePattern(pattern: string): PatternPart[] {
  const parts: PatternPart[] = [];
  let last = 0;
  let prevWasSlot = false;
  for (const m of pattern.matchAll(PLACEHOLDER)) {
    const start = m.index;
    if (start > last) parts.push({ kind: 'literal', text: pattern.slice(last, start) });
    else if (prevWasSlot) parts.push({ kind: 'literal', text: ' ' });
    const [slot = '', modifier] = (m[1] ?? '').split(':');
    parts.push({ kind: 'slot', slot, modifier: modifier ?? null });
    last = start + m[0].length;
    prevWasSlot = true;
  }
  if (last < pattern.length) parts.push({ kind: 'literal', text: pattern.slice(last) });
  return parts;
}

/** Placeholder names in a free-text pattern (tests, gloss_en). */
export function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1] ?? '');
}

/** Replaces each {name} through `resolve`. */
export function fillPlaceholders(text: string, resolve: (name: string) => string): string {
  return text.replace(PLACEHOLDER, (_m, name: string) => resolve(name));
}

/** A pattern ending in . ? or ! is a sentence and gets a capital letter; a bare phrase does not. */
export function isSentence(pattern: string): boolean {
  return /[.?!]\s*$/.test(pattern);
}

/** Uppercases the first letter, skipping leading ¿ ¡ and quotes. */
export function capitalizeFirst(s: string): string {
  const i = s.search(/\p{L}/u);
  if (i < 0) return s;
  return s.slice(0, i) + s.charAt(i).toLocaleUpperCase('es-ES') + s.slice(i + 1);
}

/** Feature names a test or gloss placeholder may use besides slot names: {person}, {gender2}, ... */
export const FEATURE_PLACEHOLDER = /^(person|gender|number)(\d*)$/;
