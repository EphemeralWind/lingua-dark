// Proves the pixel font covers what the game prints (Prompt 4, SPEC 12 open question).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_ROWS, GLYPHS, glyphOf, measureText, MISSING, missingChars } from './font';

const SPANISH = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ñ', 'Ü'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|json)$/.test(name) && !name.endsWith('.test.ts') ? [p] : [];
  });
}

/** Text in string literals and JSON: the only text that can reach the screen. */
function printable(source: string, json: boolean): string {
  if (json) return source;
  const out: string[] = [];
  const re = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
  for (const m of source.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '').matchAll(re)) out.push(m[0]);
  return out.join('');
}

describe('pixel font', () => {
  it('renders á é í ó ú ñ ü ¿ ¡ and the Spanish capitals', () => {
    expect(missingChars(SPANISH.join(''))).toEqual([]);
  });

  it('gives each accented letter its own glyph, the base letter plus a mark above it', () => {
    const pairs: [string, string][] = [
      ['á', 'a'], ['é', 'e'], ['ó', 'o'], ['ú', 'u'], ['ñ', 'n'], ['ü', 'u'],
      ['Á', 'A'], ['É', 'E'], ['Í', 'I'], ['Ó', 'O'], ['Ú', 'U'], ['Ñ', 'N'], ['Ü', 'U'],
    ];
    for (const [accented, base] of pairs) {
      const a = glyphOf(accented);
      const b = glyphOf(base);
      const firstInk = b.rows.findIndex((r) => r.some(Boolean));
      const body = b.rows.slice(firstInk);
      // The mark starts above the letter, and the letter itself is unchanged below it.
      expect(a.top, accented).toBeLessThan(b.top + firstInk);
      expect(a.rows.slice(-body.length), accented).toEqual(body);
    }
    // ¿ and ¡ are not ? and ! turned upside down by accident: they hang below the baseline.
    expect(glyphOf('¿').top + glyphOf('¿').rows.length).toBe(FONT_ROWS);
    expect(glyphOf('¡').top + glyphOf('¡').rows.length).toBe(FONT_ROWS);
  });

  it('covers printable ASCII', () => {
    const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
    expect(missingChars(ascii)).toEqual([]);
  });

  it('covers every character in the game text and the content data', () => {
    const all = files('src')
      .map((f) => printable(readFileSync(f, 'utf8'), f.endsWith('.json')))
      .join('');
    expect(missingChars(all)).toEqual([]);
  });

  it('every glyph fits the 11-row box and has rectangular rows', () => {
    for (const [ch, g] of GLYPHS) {
      expect(g.top + g.rows.length, ch).toBeLessThanOrEqual(FONT_ROWS);
      for (const row of g.rows) expect(row.length, ch).toBe(g.width);
      expect(g.rows.some((r) => r.some(Boolean)) || ch === ' ', ch).toBe(true);
    }
  });

  it('measures text and draws a visible box for unknown characters', () => {
    expect(measureText('')).toBe(0);
    expect(measureText('la')).toBe(glyphOf('l').advance + glyphOf('a').advance - 1);
    expect(glyphOf('€')).toBe(MISSING);
    expect(missingChars('ok€')).toEqual(['€']);
  });
});
