// Zone bosses (SPEC 3.7, DECISIONS #73, #77). Pure. Three phases, each its own encounter with
// its own stance meter and HP, chained questions (longer combos), and one seal deck or a mix.
// The phase named "blind" hides every visual cue; its answers count as untelegraphed.
import { CONTENT, type Content } from '../content/lexicon';
import type { Template } from '../content/schema';
import { BOSS_CHAIN, BOSS_PHASE_HP, BOSS_STANCE_MAX } from '../tuning';
import { sealTemplates } from './seals';
import type { Zone } from './zone';

export interface BossPhase {
  id: string;
  /** English UI name of the phase. */
  name: string;
  seals: string[];
  templates: Template[];
  blind: boolean;
  hp: number;
  stanceMax: number;
  chain: number;
}

export interface BossDef {
  id: string;
  name: string;
  phases: BossPhase[];
}

/** The boss in a room, or null. */
export function bossIn(zone: Zone, roomId: string, content: Content = CONTENT): BossDef | null {
  const boss = zone.room(roomId).contents.boss;
  if (!boss) return null;
  const phases = boss.phases.map((id, i): BossPhase => {
    const seals = boss.phaseDecks[id] ?? [];
    const blind = id === 'blind';
    const names = seals.map((s) => (zone.seals[s]?.name_en ?? s).replace(/^Seal of /, ''));
    return {
      id,
      name: blind ? 'Blind: every seal, no cues' : names.join(' + '),
      seals,
      // A mixed deck lists each seal's templates once, in seal order.
      templates: [...new Map(seals.flatMap((s) => sealTemplates(zone, s, content)).map((t) => [t.id, t])).values()],
      blind,
      hp: BOSS_PHASE_HP,
      stanceMax: BOSS_STANCE_MAX,
      chain: BOSS_CHAIN[i] ?? BOSS_CHAIN[BOSS_CHAIN.length - 1] ?? 1,
    };
  });
  return { id: boss.id, name: boss.name_en ?? boss.id, phases };
}
