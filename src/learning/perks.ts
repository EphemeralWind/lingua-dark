// Meta-progression perks (DECISIONS #75). Pure: an all-time best Learned count in, the
// player's stats out. Learned needs untelegraphed typed answers, so a player who cannot read
// Spanish never earns a perk.
import { FLASKS_PER_REST, FLASK_POWER_BASE, FLASK_POWER_MAX, PERKS, PLAYER_VITALITY, RIPOSTE_DAMAGE_PER_WORD, type PerkRow } from '../tuning';

export interface Perks {
  vitalityMax: number;
  riposteDamage: number;
  /** Wrong cards one flask greys out: 1 or 2. */
  flaskPower: number;
  flasksPerRest: number;
}

export function perksFor(bestLearned: number, table: readonly PerkRow[] = PERKS): Perks {
  const p: Perks = {
    vitalityMax: PLAYER_VITALITY,
    riposteDamage: RIPOSTE_DAMAGE_PER_WORD,
    flaskPower: FLASK_POWER_BASE,
    flasksPerRest: FLASKS_PER_REST,
  };
  for (const row of table) {
    if (bestLearned < row.at) continue;
    p.vitalityMax += row.vitality ?? 0;
    p.riposteDamage += row.riposte ?? 0;
    p.flaskPower += row.flaskPower ?? 0;
    p.flasksPerRest += row.flasks ?? 0;
  }
  p.flaskPower = Math.min(FLASK_POWER_MAX, p.flaskPower);
  return p;
}

/** One line per perk earned, for the title and map screens. */
export function perkLines(bestLearned: number, table: readonly PerkRow[] = PERKS): string[] {
  return table
    .filter((row) => bestLearned >= row.at)
    .map((row) => {
      if (row.vitality) return `+${row.vitality} vitality`;
      if (row.riposte) return `+${row.riposte} riposte damage`;
      if (row.flaskPower) return 'stronger flasks';
      return `+${row.flasks ?? 0} flask per rest`;
    });
}

/** The next perk threshold above `bestLearned`, or null when all are earned. */
export function nextPerkAt(bestLearned: number, table: readonly PerkRow[] = PERKS): number | null {
  return table.find((row) => row.at > bestLearned)?.at ?? null;
}
