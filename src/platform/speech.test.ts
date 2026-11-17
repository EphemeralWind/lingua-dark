import { describe, expect, it } from 'vitest';
import { speakable } from './speech';

describe('speakable', () => {
  it('turns blanks into a pause and drops quote marks', () => {
    expect(speakable('Ella ___ la espada y yo ___ el escudo.')).toBe('Ella … la espada y yo … el escudo.');
    expect(speakable('« A la izquierda hay un pozo. »')).toBe('A la izquierda hay un pozo.');
  });
});
