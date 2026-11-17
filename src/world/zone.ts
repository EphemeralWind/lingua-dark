// The room graph of one zone (SPEC 7). Pure: walking rules, doors, the boss gate, and the map
// layout. Room data comes from src/content/data/zone<N>-rooms.json (validated at build).
import zone1Json from '../content/data/zone1-rooms.json' with { type: 'json' };
import type { RoomsFile } from '../content/schema';
import { DIRECTIONS, type Direction } from '../content/types';

export type Room = RoomsFile['rooms'][number];
export type ExitDef = NonNullable<Room['exits'][Direction]>;
export const BACK = '$back';
export type SealDef = NonNullable<RoomsFile['seals']>[string];

export class Zone {
  readonly number: number;
  readonly name: string;
  readonly start: string;
  readonly rooms: readonly Room[];
  /** Seals the boss gate needs, in data order (DECISIONS #73). */
  readonly seals: Readonly<Record<string, SealDef>>;
  private readonly byId: Map<string, Room>;

  constructor(file: RoomsFile) {
    this.number = file.zone;
    this.name = file.name;
    this.start = file.start;
    this.rooms = file.rooms;
    this.seals = file.seals ?? {};
    this.byId = new Map(file.rooms.map((r) => [r.id, r]));
  }

  room(id: string): Room {
    const r = this.byId.get(id);
    if (!r) throw new Error(`unknown room ${id}`);
    return r;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** The seal this room's warden guards, or null if its enemy (if any) is not a warden. */
  wardenSeal(roomId: string): string | null {
    return this.room(roomId).contents.enemy?.seal ?? null;
  }
}

export const ZONE1 = new Zone(zone1Json as unknown as RoomsFile);

export interface WalkContext {
  /** Where the current room's `$back` leads; null at the bonfire after a rest, death, or load. */
  cameFrom: string | null;
  openDoors: readonly string[];
  gateOpen: boolean;
}

export type ExitResult =
  | { kind: 'none' }
  | {
      kind: 'move';
      to: string;
      /** Door this walk opens (shortcut from its far side). */
      opens: string | null;
      /** True when walking a `$back` exit: the destination keeps its own way back. */
      back: boolean;
    }
  | { kind: 'locked'; door: string }
  | { kind: 'gate'; to: string };

/** What pressing `dir` in `roomId` does. */
export function resolveExit(zone: Zone, roomId: string, dir: Direction, ctx: WalkContext): ExitResult {
  const exit = zone.room(roomId).exits[dir];
  if (exit === undefined) return { kind: 'none' };
  if (typeof exit === 'string') {
    if (exit !== BACK) return { kind: 'move', to: exit, opens: null, back: false };
    return ctx.cameFrom ? { kind: 'move', to: ctx.cameFrom, opens: null, back: true } : { kind: 'none' };
  }
  if (exit.locked && !ctx.openDoors.includes(exit.locked)) return { kind: 'locked', door: exit.locked };
  if (exit.gate === 'boss' && !ctx.gateOpen) return { kind: 'gate', to: exit.to };
  return { kind: 'move', to: exit.to, opens: exit.unlocks ?? null, back: false };
}

/** The room an exit leads to, for the map (null for $back). */
export function exitTarget(exit: ExitDef): string | null {
  if (typeof exit === 'string') return exit === BACK ? null : exit;
  return exit.to;
}

const STEP: Record<Direction, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };

/**
 * Grid positions for the map. Breadth-first from the start room, plain exits first and doors
 * and gates after, so a shortcut does not pull its room out of the branch it belongs to.
 * A taken cell moves the room to the nearest free cell.
 */
export function layoutZone(zone: Zone): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = { [zone.start]: { x: 0, y: 0 } };
  const taken = new Set(['0,0']);
  const place = (id: string, x: number, y: number): void => {
    for (let r = 0; r < 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const key = `${x + dx},${y + dy}`;
          if (!taken.has(key)) {
            taken.add(key);
            pos[id] = { x: x + dx, y: y + dy };
            return;
          }
        }
      }
    }
    throw new Error(`layout: no room for ${id}`);
  };
  for (const pass of ['plain', 'door'] as const) {
    const queue = Object.keys(pos);
    while (queue.length > 0) {
      const id = queue.shift() as string;
      const from = pos[id] as { x: number; y: number };
      for (const dir of DIRECTIONS) {
        const exit = zone.room(id).exits[dir];
        if (exit === undefined) continue;
        const isDoor = typeof exit === 'object';
        if ((pass === 'plain') === isDoor) continue;
        const to = exitTarget(exit);
        if (!to || pos[to]) continue;
        const [dx, dy] = STEP[dir];
        place(to, from.x + dx, from.y + dy);
        queue.push(to);
      }
    }
  }
  return pos;
}

/** Undirected key for a walked connection, for the map. */
export function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
