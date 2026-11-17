import { describe, expect, it } from 'vitest';
import { judgeWord } from './riposte';

describe('judgeWord', () => {
  it('accepts exact answers ignoring case, spacing, and punctuation', () => {
    expect(judgeWord('levanta', 'levanta')).toBe('exact');
    expect(judgeWord('  La Espada ', 'la espada')).toBe('exact');
    expect(judgeWord('yo abro la puerta', 'Yo abro la puerta.')).toBe('exact');
  });

  it('forgives a missing accent in zone 1 but flags it', () => {
    expect(judgeWord('levantais', 'levantáis')).toBe('accent');
    expect(judgeWord('levantais', 'levantáis', false)).toBe('wrong');
  });

  it('does not treat n as ñ', () => {
    expect(judgeWord('nino', 'niño')).toBe('wrong');
  });

  it('rejects wrong forms and misplaced accents', () => {
    expect(judgeWord('levantas', 'levanta')).toBe('wrong');
    expect(judgeWord('lévantais', 'levantáis')).toBe('wrong');
    expect(judgeWord('', 'levanta')).toBe('wrong');
  });
});
