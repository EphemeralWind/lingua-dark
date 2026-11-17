// Lesson objects at bonfires (DECISIONS #96): a stele, and later books or tablets. Each has
// pages; a page's example rows name lexicon entries and are spelled out here from the same
// data the fights use, so a lesson never shows a form the game would mark wrong.
// lessons.json is schema-checked at build time and in tests (validate.ts).
import lessonsJson from './data/lessons.json' with { type: 'json' };
import { CONTENT, NUMBERS, PERSONS, nounForm, type Content } from './lexicon';
import type { LessonObjectDef, LessonPageDef, LessonRows, LessonsFile } from './schema';

export type LessonObject = LessonObjectDef;

export const LESSON_OBJECTS: readonly LessonObject[] = (lessonsJson as unknown as LessonsFile).objects;

/** The lesson objects found at a bonfire in `zone`. */
export function lessonObjectsFor(zone: number, objects: readonly LessonObject[] = LESSON_OBJECTS): LessonObject[] {
  return objects.filter((o) => o.zone === zone);
}

export interface LessonPage {
  title: string;
  verse: readonly string[];
  /** Rows of cells, every row the same length: the carved table. */
  rows: readonly (readonly string[])[];
  /** The page's Spanish as phrases for the speech voice ("el escudo", "yo levanto"). */
  spoken: readonly string[];
}

interface Spelled {
  rows: string[][];
  spoken: string[];
}

/** Spells out a page's example rows from the lexicon and grammar tables. */
export function lessonRows(rows: LessonRows, content: Content = CONTENT): Spelled {
  switch (rows.kind) {
    case 'articles': {
      const table = rows.nouns.map((id) => {
        const n = content.noun(id);
        return NUMBERS.map((num) => `${content.articles[rows.art][n.gender][num]} ${nounForm(n, num)}`);
      });
      return { rows: table, spoken: table.flat() };
    }
    case 'conjugation': {
      const verbs = rows.verbs.map((id) => content.verb(id));
      const table: string[][] = [];
      const spoken: string[] = [];
      for (const p of PERSONS) {
        const pronouns = content.pronouns.filter((pr) => pr.person === p).map((pr) => pr.surface);
        const forms = verbs.map((v) => v[rows.tense][p]);
        table.push([pronouns.join(' / '), ...forms]);
        spoken.push(...forms.map((f) => `${pronouns[0] ?? ''} ${f}`.trim()));
      }
      return { rows: table, spoken };
    }
  }
}

export function lessonPage(page: LessonPageDef, content: Content = CONTENT): LessonPage {
  const { rows, spoken } = lessonRows(page.rows, content);
  return { title: page.title_en, verse: page.verse_en, rows, spoken };
}
