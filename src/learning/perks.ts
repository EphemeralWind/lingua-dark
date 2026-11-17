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

/**
 * One line per kind of perk earned, for the title and map screens. Repeats of a kind are
 * summed into one line ("+30 vitality", not "+10 vitality" three times), in the order each
 * kind was first earned.
 */
export function perkLines(bestLearned: number, table: readonly PerkRow[] = PERKS): string[] {
  const totals = new Map<'vitality' | 'riposte' | 'flaskPower' | 'flasks', number>();
  for (const row of table) {
    if (bestLearned < row.at) continue;
    for (const kind of ['vitality', 'riposte', 'flaskPower', 'flasks'] as const) {
      const n = row[kind];
      if (n) totals.set(kind, (totals.get(kind) ?? 0) + n);
    }
  }
  return [...totals].map(([kind, n]) => {
    switch (kind) {
      case 'vitality':
        return `+${n} vitality`;
      case 'riposte':
        return `+${n} riposte damage`;
      case 'flaskPower':
        return 'stronger flasks';
      case 'flasks':
        return `+${n} ${n === 1 ? 'flask' : 'flasks'} per rest`;
    }
  });
}

/** The next perk threshold above `bestLearned`, or null when all are earned. */
export function nextPerkAt(bestLearned: number, table: readonly PerkRow[] = PERKS): number | null {
  return table.find((row) => row.at > bestLearned)?.at ?? null;
}
