// Zone bosses (SPEC 3.7, DECISIONS #77, #95). Pure. Each phase is its own encounter with its
// own stance meter and HP, chained questions (longer combos), and a deck of templates that
// mixes every seal of the zone. Later phases draw from a harder pool and can open with a
// static battle cry.
import { CONTENT, type Content } from '../content/lexicon';
import type { Template } from '../content/schema';
import { BOSS_CHAIN, BOSS_PHASE_HP, BOSS_STANCE_MAX } from '../tuning';
import type { Zone } from './zone';

export interface BossPhase {
  id: string;
  /** English UI name of the phase. */
  name: string;
  templates: Template[];
  /** Shouted on the card that opens the phase: Spanish, and its English line. */
  cry: { es: string; en: string } | null;
  hp: number;
  stanceMax: number;
  chain: number;
}

export interface BossDef {
  id: string;
  name: string;
  phases: BossPhase[];
}

const nth = (xs: readonly number[], i: number, fallback: number): number => xs[Math.min(i, xs.length - 1)] ?? fallback;

/** The boss in a room, or null. */
export function bossIn(zone: Zone, roomId: string, content: Content = CONTENT): BossDef | null {
  const boss = zone.room(roomId).contents.boss;
  if (!boss) return null;
  const phases = boss.phases.map(
    (p, i): BossPhase => ({
      id: p.id,
      name: p.name_en,
      templates: p.templates.map((id) => {
        const t = content.templates.find((x) => x.id === id);
        if (!t) throw new Error(`boss phase ${p.id}: missing template ${id}`);
        return t;
      }),
      cry: p.cry_es !== undefined && p.cry_en !== undefined ? { es: p.cry_es, en: p.cry_en } : null,
      hp: nth(BOSS_PHASE_HP, i, 60),
      stanceMax: BOSS_STANCE_MAX,
      chain: nth(BOSS_CHAIN, i, 1),
    }),
  );
  return { id: boss.id, name: boss.name_en ?? boss.id, phases };
}
