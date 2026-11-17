// Content validation: zod shapes (schema.ts) plus cross-reference checks. Runs at build time
// through the vite plugin in vite.config.ts and in tests. A template that references a
// missing slot or tag, or that can never be filled, fails the build rather than the game.
import type { ZodType } from 'zod';
import lexiconJson from './data/lexicon.json' with { type: 'json' };
import templatesJson from './data/templates.json' with { type: 'json' };
import zone1RoomsJson from './data/zone1-rooms.json' with { type: 'json' };
import { nounMatches } from './generator';
import { GENDERS, PERSONS, buildContent, verbTakes, type Content } from './lexicon';
import { PERSON_KEYS, lexiconSchema, roomsFileSchema, templatesFileSchema, type RoomsFile, type Template } from './schema';
import { analyzeTemplate } from './template';

export interface RawContent {
  lexicon: unknown;
  templates: unknown;
  rooms: Record<string, unknown>;
}

function parse<T>(schema: ZodType<T>, data: unknown, file: string, errors: string[]): T | null {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  for (const issue of r.error.issues) errors.push(`${file}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  return null;
}

function duplicates(ids: readonly string[]): string[] {
  return ids.filter((id, i) => ids.indexOf(id) !== i);
}

function checkLexicon(c: Content, errors: string[]): void {
  for (const id of duplicates([...c.nouns, ...c.verbs].map((e) => e.id))) errors.push(`lexicon: duplicate id ${id}`);
  for (const v of c.verbs) {
    for (const tag of v.takes) {
      if (!c.nounTags.has(tag)) errors.push(`lexicon: ${v.id} takes missing tag "${tag}" (no noun carries it)`);
    }
  }
}

function checkGrammar(c: Content, persons: readonly string[], errors: string[]): void {
  if (persons.join() !== PERSON_KEYS.join()) errors.push(`templates: persons must be [${PERSON_KEYS.join(', ')}]`);
  for (const id of duplicates(c.pronouns.map((p) => p.id))) errors.push(`templates: duplicate pronoun ${id}`);
  for (const p of PERSONS) {
    if (!c.pronouns.some((pr) => pr.person === p)) errors.push(`templates: no pronoun for person ${p}`);
  }
  for (const id of duplicates(c.templates.map((t) => t.id))) errors.push(`templates: duplicate template ${id}`);
}

/** Every noun slot must have at least one noun (and verb, under the slot rule) that fits. */
function checkFillable(t: Template, c: Content, errors: string[]): void {
  for (const [name, def] of Object.entries(t.slots)) {
    if (def.type !== 'noun') continue;
    const needsVerb = def.requires !== undefined;
    const fits = c.nouns.filter((n) => (needsVerb ? c.verbs.some((v) => verbTakes(v, n) && nounMatches(def, n, v)) : nounMatches(def, n, null)));
    if (fits.length === 0) {
      errors.push(`template ${t.id}: noun slot "${name}" can never be filled (no noun fits its tags and the slot rule)`);
    } else if (def.distinctFrom && fits.length < 2) {
      errors.push(`template ${t.id}: noun slot "${name}" needs two different nouns but only one fits`);
    }
    if (!GENDERS.some((g) => fits.some((n) => n.gender === g))) errors.push(`template ${t.id}: slot "${name}" has no gender`);
    if (t.blanks.includes('$sentence') && t.distractors['$sentence']?.vary.includes('lemma') && fits.length < 4) {
      errors.push(`template ${t.id}: vocabulary needs at least four nouns, ${fits.length} fit`);
    }
  }
}

function checkRooms(file: string, rooms: RoomsFile, c: Content, errors: string[]): void {
  const ids = new Set(rooms.rooms.map((r) => r.id));
  for (const id of duplicates(rooms.rooms.map((r) => r.id))) errors.push(`${file}: duplicate room ${id}`);
  if (!ids.has(rooms.start)) errors.push(`${file}: start room ${rooms.start} does not exist`);
  const locks = new Set<string>();
  const keys = new Set<string>();
  for (const r of rooms.rooms) {
    for (const [dir, exit] of Object.entries(r.exits)) {
      const to = typeof exit === 'string' ? exit : exit?.to;
      if (to !== undefined && to !== '$back' && !ids.has(to)) errors.push(`${file}: ${r.id}.${dir} leads to missing room ${to}`);
      if (typeof exit === 'object' && exit) {
        if (exit.to === '$back') errors.push(`${file}: ${r.id}.${dir} exit objects need a real room`);
        if (exit.locked) locks.add(exit.locked);
        if (exit.unlocks) keys.add(exit.unlocks);
      }
    }
    const reading = r.contents.reading;
    if (reading) {
      if (!r.contents.sign) errors.push(`${file}: ${r.id} has a reading choice but no sign`);
      if (!r.exits[reading.correct]) errors.push(`${file}: ${r.id} reading answer ${reading.correct} is not an exit`);
      const exitCount = Object.keys(r.exits).length;
      if (exitCount < 3) errors.push(`${file}: ${r.id} reading choice needs at least three exits, has ${exitCount}`);
    }
    if (r.contents.item) {
      try {
        c.noun(r.contents.item);
      } catch {
        errors.push(`${file}: ${r.id} item ${r.contents.item} is not in the lexicon`);
      }
    }
  }
  const seals = rooms.seals ?? {};
  const wardens = new Map<string, string[]>();
  for (const r of rooms.rooms) {
    const seal = r.contents.enemy?.seal;
    if (seal === undefined) continue;
    if (!seals[seal]) errors.push(`${file}: ${r.id} warden guards unknown seal ${seal}`);
    wardens.set(seal, [...(wardens.get(seal) ?? []), r.id]);
  }
  for (const [id, seal] of Object.entries(seals)) {
    for (const t of seal.templates) {
      const tmpl = c.templates.find((x) => x.id === t);
      if (!tmpl) errors.push(`${file}: seal ${id} uses missing template ${t}`);
      else if (tmpl.zone !== rooms.zone) errors.push(`${file}: seal ${id} uses template ${t} from zone ${tmpl.zone}`);
    }
    const n = wardens.get(id)?.length ?? 0;
    if (n !== 1) errors.push(`${file}: seal ${id} needs exactly one warden, has ${n}`);
  }
  const hasGate = rooms.rooms.some((r) => Object.values(r.exits).some((e) => typeof e === 'object' && e?.gate === 'boss'));
  if (Object.keys(seals).length > 0 && !hasGate) errors.push(`${file}: declares seals but has no boss gate`);
  for (const lock of locks) if (!keys.has(lock)) errors.push(`${file}: door ${lock} is locked but nothing unlocks it`);
  for (const key of keys) if (!locks.has(key)) errors.push(`${file}: exit unlocks ${key} but no door uses it`);
}

/** Returns every problem found; an empty list means the content is valid. */
export function validateContent(raw: RawContent): string[] {
  const errors: string[] = [];
  const lexicon = parse(lexiconSchema, raw.lexicon, 'lexicon.json', errors);
  const templates = parse(templatesFileSchema, raw.templates, 'templates.json', errors);
  const rooms = Object.entries(raw.rooms).map(([file, data]) => [file, parse(roomsFileSchema, data, file, errors)] as const);
  if (!lexicon || !templates) return errors;

  const content = buildContent(lexicon, templates);
  checkLexicon(content, errors);
  checkGrammar(content, templates.persons, errors);
  for (const t of content.templates) {
    const shape = analyzeTemplate(t, content);
    errors.push(...shape.errors);
    if (shape.errors.length === 0) checkFillable(t, content, errors);
  }
  for (const [file, r] of rooms) if (r) checkRooms(file, r, content, errors);
  return errors;
}

/** Validates the JSON files shipped in src/content/data. */
export function validateBundled(): string[] {
  return validateContent({ lexicon: lexiconJson, templates: templatesJson, rooms: { 'zone1-rooms.json': zone1RoomsJson } });
}
