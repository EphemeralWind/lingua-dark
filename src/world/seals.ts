// Boss gate seals (DECISIONS #73). One seal per grammar aspect of the zone, each won by beating
// its warden, whose deck is that aspect's templates only. The gate opens when every seal is
// held, which a player can do in one sitting but never by guessing: wardens are fights, and
// the blind-bot test runs on every seal deck.
import { CONTENT, type Content } from '../content/lexicon';
import type { Template } from '../content/schema';
import type { Zone } from './zone';

export interface Socket {
  id: string;
  name: string;
  held: boolean;
}

export interface SealProgress {
  sockets: Socket[];
  held: number;
  total: number;
  open: boolean;
}

export function sealProgress(held: readonly string[], zone: Zone): SealProgress {
  const sockets = Object.entries(zone.seals).map(([id, def]) => ({ id, name: def.name_en, held: held.includes(id) }));
  const n = sockets.filter((x) => x.held).length;
  return { sockets, held: n, total: sockets.length, open: sockets.length > 0 && n === sockets.length };
}

/** A seal's deck: its templates, in data order. */
export function sealTemplates(zone: Zone, sealId: string, content: Content = CONTENT): Template[] {
  const def = zone.seals[sealId];
  if (!def) throw new Error(`unknown seal ${sealId}`);
  return def.templates.map((id) => content.template(id));
}

/** "Articles ◆  Verbs ◇  Words ◇": shape, not colour, shows held vs empty. */
export function socketLine(p: SealProgress): string {
  return p.sockets.map((x) => `${x.name.replace(/^Seal of /, '')} ${x.held ? '◆' : '◇'}`).join('   ');
}
