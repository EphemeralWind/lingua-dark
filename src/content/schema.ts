// Content schemas for lexicon.json, templates.json and zone1-rooms.json (SPEC 5.3, 7).
// Structural shape is checked with zod; cross-references (slots, tags, rooms) are checked
// in validate.ts. Both run at build time (vite plugin) and in tests, not in the game bundle:
// runtime code imports only the types from this file.
import { z } from 'zod';

export const PERSON_KEYS = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'] as const;
const person = z.enum(PERSON_KEYS);
const gender = z.enum(['m', 'f']);
const gramNumber = z.enum(['sg', 'pl']);
const id = (prefix: string) => z.string().regex(new RegExp(`^${prefix}[a-zñ_]+$`), `id must look like ${prefix}<lemma>`);
const tag = z.string().regex(/^[a-z_]+$/, 'tags are lowercase words');

export const nounSchema = z.strictObject({
  id: id('n_'),
  lemma: z.string().min(1),
  pos: z.literal('noun'),
  gender,
  plural: z.string().min(1),
  tags: z.array(tag).min(1),
  cefr: z.string(),
  gloss_en: z.string().min(1),
});

export const verbSchema = z.strictObject({
  id: id('v_'),
  lemma: z.string().regex(/(ar|er|ir)$/),
  pos: z.literal('verb'),
  class: z.enum(['ar', 'er', 'ir']),
  cefr: z.string(),
  takes: z.array(tag).min(1),
  present: z.strictObject({
    yo: z.string().min(1),
    tu: z.string().min(1),
    el: z.string().min(1),
    nosotros: z.string().min(1),
    vosotros: z.string().min(1),
    ellos: z.string().min(1),
  }),
  /** English base form and third-person-singular form, e.g. lift / lifts. */
  gloss_en: z.strictObject({ base: z.string().min(1), s3: z.string().min(1) }),
});

export const lexiconSchema = z.strictObject({
  version: z.literal(1),
  dialect: z.literal('es-ES'),
  note: z.string().optional(),
  entries: z.array(z.discriminatedUnion('pos', [nounSchema, verbSchema])).min(1),
});

export const SLOT_TYPES = ['subject', 'verb', 'noun', 'article'] as const;
export const VARY_FEATURES = ['person', 'gender', 'number', 'lemma'] as const;

const slotSchema = z.strictObject({
  type: z.enum(SLOT_TYPES),
  /** Noun slots: grammatical number. */
  number: gramNumber.optional(),
  /** Noun slots: "<verbSlot>.takes", the slot rule. */
  requires: z.string().regex(/^\w+\.takes$/, 'requires must be "<verbSlot>.takes"').optional(),
  /** Noun slots: the noun must carry all of these tags. */
  tags: z.array(tag).optional(),
  /** Noun slots: the noun must carry none of these tags. */
  excludeTags: z.array(tag).optional(),
  /** Article slots: the noun it agrees with (default: the next noun in the pattern). */
  agreesWith: z.string().optional(),
  /** Noun slots: must be a different noun from this slot. */
  distinctFrom: z.string().optional(),
  /** Subject slots: must be a different grammatical person from this slot. */
  distinctPersonFrom: z.string().optional(),
});

export const templateSchema = z.strictObject({
  id: z.string().regex(/^t_\w+$/),
  zone: z.number().int().min(1).max(3),
  kind: z.enum(['vocab', 'grammar', 'translate', 'listen', 'order', 'combo']),
  pattern: z.string().min(1),
  /** English prompt pattern; required for vocab and translate. */
  gloss_en: z.string().optional(),
  slots: z.record(z.string().regex(/^\w+$/), slotSchema),
  /** Slot names, in answer order, or ["$sentence"] for a whole-phrase answer. */
  blanks: z.array(z.string()).min(1).max(4),
  distractors: z.record(z.string(), z.strictObject({ vary: z.array(z.enum(VARY_FEATURES)).min(1) })),
  tests: z.array(z.string()).min(1),
});

export const templatesFileSchema = z.strictObject({
  version: z.literal(1),
  dialect: z.literal('es-ES'),
  note: z.string().optional(),
  persons: z.array(person),
  pronouns: z.array(z.strictObject({ id: z.string(), surface: z.string().min(1), person, gloss_en: z.string().min(1) })).min(1),
  articles: z.strictObject({
    definite: z.strictObject({ m: z.strictObject({ sg: z.string(), pl: z.string() }), f: z.strictObject({ sg: z.string(), pl: z.string() }) }),
    indefinite: z.strictObject({ m: z.strictObject({ sg: z.string(), pl: z.string() }), f: z.strictObject({ sg: z.string(), pl: z.string() }) }),
  }),
  templates: z.array(templateSchema).min(1),
});

const direction = z.enum(['north', 'east', 'south', 'west']);
const exitSchema = z.union([
  z.string(),
  z.strictObject({ to: z.string(), locked: z.string().optional(), unlocks: z.string().optional(), gate: z.literal('boss').optional() }),
]);

export const roomsFileSchema = z.strictObject({
  version: z.literal(1),
  zone: z.number().int().min(1).max(3),
  name: z.string(),
  start: z.string(),
  note: z.string().optional(),
  /** Seals the boss gate needs, one per grammar aspect; each is won from one warden. */
  seals: z.record(z.string().regex(/^[a-z_]+$/), z.strictObject({ name_en: z.string().min(1), templates: z.array(z.string()).min(1) })).optional(),
  rooms: z
    .array(
      z.strictObject({
        id: z.string().regex(/^r\d+_\w+$/),
        backdrop: z.string(),
        exits: z.partialRecord(direction, exitSchema),
        contents: z.strictObject({
          bonfire: z.boolean().optional(),
          sign: z.string().optional(),
          /** Makes the sign a reading choice (DECISIONS #27, #62). */
          reading: z
            .strictObject({
              goal_en: z.string().min(1),
              correct: direction,
              components: z.array(z.string().min(1)).min(1),
              wrongCost: z.enum(['detour', 'ambush']),
            })
            .optional(),
          item: z.string().optional(),
          enemy: z
            .strictObject({
              id: z.string(),
              attack: z.enum(['jab', 'overhead', 'delayed', 'grab', 'sweep', 'combo']),
              /** Makes this enemy the warden of a seal: its deck is the seal's templates. */
              seal: z.string().optional(),
            })
            .optional(),
          boss: z
            .strictObject({
              id: z.string(),
              /** English UI name. */
              name_en: z.string().min(1).optional(),
              /**
               * Phases in order. Each deck is a list of templates that must mix every seal of the
               * zone (DECISIONS #95). `cry_es` is a static battle cry shouted on the card that opens
               * the phase, with its English line under it.
               */
              phases: z
                .array(
                  z.strictObject({
                    id: z.string(),
                    name_en: z.string().min(1),
                    templates: z.array(z.string()).min(1),
                    cry_es: z.string().min(1).optional(),
                    cry_en: z.string().min(1).optional(),
                  }),
                )
                .min(1),
            })
            .optional(),
          npc: z.strictObject({ id: z.string(), dialogue: z.string() }).optional(),
        }),
      }),
    )
    .min(1),
});

export type NounEntry = z.infer<typeof nounSchema>;
export type VerbEntry = z.infer<typeof verbSchema>;
export type LexiconFile = z.infer<typeof lexiconSchema>;
export type SlotDef = z.infer<typeof slotSchema>;
export type Template = z.infer<typeof templateSchema>;
export type TemplatesFile = z.infer<typeof templatesFileSchema>;
export type RoomsFile = z.infer<typeof roomsFileSchema>;
export type VaryFeature = (typeof VARY_FEATURES)[number];
