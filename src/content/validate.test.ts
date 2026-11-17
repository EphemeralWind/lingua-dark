import { describe, expect, it } from 'vitest';
import lexiconJson from './data/lexicon.json' with { type: 'json' };
import templatesJson from './data/templates.json' with { type: 'json' };
import roomsJson from './data/zone1-rooms.json' with { type: 'json' };
import { generate } from './generator';
import { buildContent } from './lexicon';
import type { LexiconFile, TemplatesFile } from './schema';
import { validateBundled, validateContent, type RawContent } from './validate';

/* eslint-disable @typescript-eslint/no-explicit-any -- tests mutate loosely typed JSON copies */
function raw(): { lexicon: any; templates: any; rooms: any } {
  return structuredClone({ lexicon: lexiconJson, templates: templatesJson, rooms: roomsJson });
}

function errorsFor(mutate: (c: { lexicon: any; templates: any; rooms: any }) => void): string[] {
  const c = raw();
  mutate(c);
  const input: RawContent = { lexicon: c.lexicon, templates: c.templates, rooms: { 'zone1-rooms.json': c.rooms } };
  return validateContent(input);
}

const tpl = (c: { templates: any }, id: string): any => c.templates.templates.find((t: any) => t.id === id);
const entry = (c: { lexicon: any }, id: string): any => c.lexicon.entries.find((e: any) => e.id === id);

describe('content validation', () => {
  it('accepts the shipped content', () => {
    expect(validateBundled()).toEqual([]);
  });

  it.each<[string, (c: { lexicon: any; templates: any; rooms: any }) => void, RegExp]>([
    ['a template slot referencing a missing tag', (c) => (tpl(c, 't_present_object').slots.noun.tags = ['flying']), /missing tag "flying"/],
    ['an excludeTags entry naming a missing tag', (c) => (tpl(c, 't_plural_object').slots.noun.excludeTags = ['masss']), /missing tag "masss"/],
    ['a verb that takes a tag no noun carries', (c) => entry(c, 'v_beber').takes.push('potion'), /v_beber takes missing tag "potion"/],
    ['a pattern naming an undeclared slot', (c) => (tpl(c, 't_present_object').pattern = '{subj} {verb:present} {art:definite}{obj}.'), /unknown slot "obj"/],
    ['requires pointing at a non-verb slot', (c) => (tpl(c, 't_present_object').slots.noun.requires = 'subj.takes'), /"subj" is not a verb slot/],
    ['a blank that is not a slot', (c) => (tpl(c, 't_definite_article').blanks = ['adjective']), /blank "adjective"/],
    ['an article blank varying only gender', (c) => (tpl(c, 't_definite_article').distractors.art.vary = ['gender']), /must vary \["gender", "number"\]/],
    ['a test placeholder with no slot', (c) => tpl(c, 't_present_object').tests.push('{adjective}:x'), /placeholder \{adjective\}/],
    ['a noun slot no noun can fill', (c) => (tpl(c, 't_present_object').slots.noun.tags = ['weapon', 'food']), /can never be filled/],
    ['a pattern form that disagrees with number', (c) => (tpl(c, 't_plural_object').slots.noun.number = 'sg'), /disagree/],
    ['a combo with one blank', (c) => (tpl(c, 't_combo_two').blanks = ['verb1']), /kind "combo" has 1 blanks/],
    ['a noun with no gender', (c) => delete entry(c, 'n_espada').gender, /lexicon\.json: entries\.0\.gender/],
    ['a verb missing the vosotros form', (c) => delete entry(c, 'v_abrir').present.vosotros, /present\.vosotros/],
    ['a translate template with no English', (c) => delete tpl(c, 't_translate_object').gloss_en, /needs gloss_en/],
    ['a person with no pronoun', (c) => (c.templates.pronouns = c.templates.pronouns.filter((p: any) => p.person !== 'vosotros')), /no pronoun for person vosotros/],
    ['an exit to a missing room', (c) => (c.rooms.rooms[0].exits.north = 'r1_nowhere'), /missing room r1_nowhere/],
    ['a locked door nothing unlocks', (c) => delete c.rooms.rooms.find((r: any) => r.id === 'r1_cellar').exits.north.unlocks, /shortcut_cellar is locked but nothing unlocks it/],
    ['an item missing from the lexicon', (c) => (c.rooms.rooms[0].contents.item = 'n_grial'), /n_grial is not in the lexicon/],
    ['an unknown enemy attack', (c) => (c.rooms.rooms[1].contents.enemy.attack = 'kick'), /zone1-rooms\.json: rooms\.1\.contents\.enemy\.attack/],
  ])('rejects %s', (_name, mutate, pattern) => {
    const errors = errorsFor(mutate);
    expect(errors.join('\n')).toMatch(pattern);
  });

  it('the generator refuses a template that fails validation', () => {
    const c = raw();
    tpl(c, 't_present_object').slots.noun.tags = ['flying'];
    const content = buildContent(c.lexicon as LexiconFile, c.templates as TemplatesFile);
    expect(() => generate(content.template('t_present_object'), 1, content)).toThrow(/missing tag "flying"/);
  });
});
