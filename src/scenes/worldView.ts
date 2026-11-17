// Drawing for the world: rooms (placeholder backdrops with exits and contents), the map,
// and the title. Flat shapes on the 320x180 buffer, text on the display layer. Exits never
// name the room behind them, so a sign's reading choice cannot be read off the screen.
import { enemyFrame, playerFrame } from '../combat/sprites';
import type { Animation } from '../combat/view';
import type { Direction } from '../content/types';
import type { SpriteBank } from '../platform/atlas';
import { C } from '../platform/palette';
import type { Renderer } from '../platform/renderer';
import type { SealProgress } from '../world/seals';
import type { Echo } from '../world/state';
import { edgeKey, exitTarget, type Room } from '../world/zone';

const IDLE: Animation = { enemyPose: 'idle', progress: 0, toward: null, playerPose: 'idle', flash: 'none', timerLeft: null, frozen: false, resolved: null };

/** Palette swaps per backdrop type (SPEC 7: about five backdrops per zone). */
const BACKDROP: Record<string, { wall: string; floor: string; far: string }> = {
  bonfire_room: { wall: '#2b2a33', floor: '#3a3430', far: '#1e1c22' },
  corridor: { wall: '#262d3d', floor: '#2f3748', far: '#191e2a' },
  hall: { wall: '#2c3244', floor: '#363e52', far: '#1d2230' },
  crossroads: { wall: '#28323a', floor: '#34403f', far: '#1a2125' },
  boss_gate: { wall: '#2f2730', floor: '#3a3038', far: '#1c1519' },
  boss_arena: { wall: '#331f24', floor: '#40282d', far: '#1f1215' },
};

export type ExitLook = 'open' | 'locked' | 'sealed' | 'gateOpen';

export interface RoomScene {
  room: Room;
  exits: Partial<Record<Direction, ExitLook>>;
  /** The living foe in plain view (enemy, warden or boss). */
  enemy: { name: string; character: string; warden: boolean } | null;
  /** The arena after its boss fell. */
  bossBeaten: boolean;
  ghosts: number;
  echo: Echo | null;
  /** Pending reading goal (English), shown under the sign until the choice is made. */
  readingGoal: string | null;
  hud: { vitality: number; vitalityMax: number; flasks: number; xp: number; seals: SealProgress; /** Shown in dev builds only. */ day: number | null };
  hint: string;
  message: string[];
  /** 0 to 1 through the room-entry fade, or null. */
  fade: number | null;
  /** Reduced motion: no flicker. */
  calm: boolean;
}

export function drawRoom(r: Renderer, sprites: SpriteBank, nowMs: number, s: RoomScene): void {
  const pal = BACKDROP[s.room.backdrop] ?? { wall: '#262d3d', floor: '#2f3748', far: '#191e2a' };
  r.begin(C.sky);
  const g = r.low;

  // Far wall, floor, and side walls converging toward the far end.
  g.fillStyle = pal.far;
  g.fillRect(70, 34, 180, 70);
  g.fillStyle = pal.floor;
  g.fillRect(0, 104, 320, 76);
  g.fillStyle = pal.wall;
  for (let y = 0; y < 180; y++) {
    const inset = y < 104 ? 70 : 70 - Math.round(((y - 104) / 76) * 70);
    g.fillRect(0, y, inset, 1);
    g.fillRect(320 - inset, y, inset, 1);
  }

  const doorFill = (look: ExitLook): string => (look === 'open' || look === 'gateOpen' ? '#0b0d12' : pal.wall);
  const bars = (x: number, y: number, w: number, h: number, step: number): void => {
    g.fillStyle = C.weapon;
    for (let i = x + 2; i < x + w - 1; i += step) g.fillRect(i, y, 1, h);
    g.fillRect(x, y + Math.floor(h / 2), w, 1);
  };
  const ex = s.exits;
  if (ex.north) {
    g.fillStyle = doorFill(ex.north);
    g.fillRect(146, 60, 28, 44);
    if (ex.north === 'locked') bars(146, 60, 28, 44, 5);
    if (ex.north === 'sealed') bars(146, 60, 28, 44, 3);
  }
  if (ex.west) {
    g.fillStyle = doorFill(ex.west);
    g.fillRect(36, 70, 22, 40);
    if (ex.west !== 'open') bars(36, 70, 22, 40, ex.west === 'sealed' ? 3 : 5);
  }
  if (ex.east) {
    g.fillStyle = doorFill(ex.east);
    g.fillRect(262, 70, 22, 40);
    if (ex.east !== 'open') bars(262, 70, 22, 40, ex.east === 'sealed' ? 3 : 5);
  }
  if (ex.south) {
    // Foreground arch at the bottom edge.
    g.fillStyle = pal.wall;
    g.fillRect(96, 168, 128, 12);
    g.fillStyle = ex.south === 'open' ? pal.far : C.weapon;
    g.fillRect(104, 172, 112, 8);
  }

  const c = s.room.contents;
  if (c.bonfire) {
    // Beside the player, clear of the message box. The flame flickers unless motion is reduced.
    const lick = s.calm ? 0 : Math.floor(nowMs / 160) % 2;
    g.fillStyle = C.emberDark;
    for (let i = 0; i < 12; i++) g.fillRect(232 - (12 - i), 156 - i * 2 - lick, (12 - i) * 2, 2);
    g.fillStyle = C.ember;
    for (let i = 0; i < 8; i++) g.fillRect(232 - (8 - i), 156 - i * 2, (8 - i) * 2, 2);
    g.fillStyle = C.wood;
    g.fillRect(216, 156, 32, 3);
    g.fillRect(220, 159, 24, 2);
  }
  if (s.echo) {
    // Echo: a ring on the floor.
    g.fillStyle = C.signal;
    g.fillRect(104, 128, 20, 1);
    g.fillRect(104, 136, 20, 1);
    g.fillRect(102, 129, 1, 7);
    g.fillRect(125, 129, 1, 7);
  }
  const clock = { nowMs, sinceEndMs: 0 };
  for (let i = 0; i < s.ghosts; i++) {
    // Ghosts: hollow outlines, small and far, along the left wall.
    sprites.draw(g, 'ghost', enemyFrame(IDLE, { nowMs: nowMs + i * 300, sinceEndMs: 0 }), 92 + i * 18, 110, { half: true });
  }
  if (s.enemy) sprites.draw(g, s.enemy.character, enemyFrame(IDLE, clock), 160, 112);
  if (s.bossBeaten) {
    // The silent bell lies on its side.
    g.fillStyle = C.bossMid;
    g.fillRect(132, 98, 56, 12);
    g.fillStyle = C.bossDeep;
    g.fillRect(180, 96, 10, 16);
  }

  // Player from behind; walks while the room fades in.
  const walking = s.fade !== null;
  const pf = walking ? { tag: 'walk', frame: Math.floor(nowMs / 120) % 4, flip: false } : playerFrame(IDLE, clock);
  sprites.draw(g, 'player', pf, 160, 186);

  // HUD bars.
  g.fillStyle = C.barBack;
  g.fillRect(8, 156, 76, 4);
  g.fillStyle = C.ember;
  g.fillRect(8, 156, Math.round((76 * s.hud.vitality) / s.hud.vitalityMax), 4);
  if (s.message.length > 0) {
    g.fillStyle = C.barBack;
    g.fillRect(40, 108, 240, 8 + s.message.length * 9);
  }
  if (s.fade !== null) {
    g.fillStyle = `rgba(0,0,0,${(1 - s.fade).toFixed(3)})`;
    g.fillRect(0, 0, 320, 180);
  }
  r.present();

  // --- text layer
  if (c.sign) {
    r.text(`« ${c.sign} »`, 160, 10, { size: 7, align: 'center', maxWidth: 300 });
    if (s.readingGoal) r.text(`Goal: ${s.readingGoal}`, 160, 20, { size: 6, align: 'center', color: C.signal });
  }
  const arrow = (dir: Direction, x: number, y: number): void => {
    const look = ex[dir];
    if (!look) return;
    const glyph = { north: '↑', east: '→', south: '↓', west: '←' }[dir];
    const word = look === 'locked' ? ' locked' : look === 'sealed' ? ' sealed' : '';
    r.text(glyph + word, x, y, { size: 6, align: 'center', color: look === 'open' || look === 'gateOpen' ? C.text : C.dim });
  };
  arrow('north', 160, 54);
  arrow('west', 47, 64);
  arrow('east', 273, 64);
  arrow('south', 160, 164);
  if (s.enemy) {
    // Wardens: the seal diamond by the name, as well as the crown on the sprite.
    r.text(`${s.enemy.warden ? '◆ ' : ''}${s.enemy.name}`, 160, 38, { size: 6, align: 'center', color: C.hurt, maxWidth: 260, outline: C.void });
  }
  if (s.ghosts > 0) r.text(`ghost ×${s.ghosts}`, 80 + s.ghosts * 9, 74, { size: 5, align: 'center', color: C.dim });
  if (s.echo) r.text(`echo ${s.echo.xp} XP`, 114, 142, { size: 5, align: 'center', color: C.signal });
  if (c.bonfire) r.text('bonfire', 232, 166, { size: 5, align: 'center', color: C.ember, outline: C.void });
  if (s.bossBeaten) r.text('The arena is silent. The Hollow Village is free.', 160, 38, { size: 6, align: 'center', color: C.dim, outline: C.void });

  s.message.forEach((line, i) => r.text(line, 160, 113 + i * 9, { size: 6, align: 'center', maxWidth: 232 }));

  const h = s.hud;
  r.text(`VITALITY ${Math.ceil(h.vitality)}`, 8, 150, { size: 6, color: C.dim });
  r.text(`FLASKS ${h.flasks}   XP ${h.xp}`, 8, 166, { size: 6, color: C.dim });
  r.text(`SEALS ${h.seals.sockets.map((x) => (x.held ? '◆' : '◇')).join('')} ${h.seals.held}/${h.seals.total}`, 312, 150, { size: 6, color: C.dim, align: 'right' });
  if (h.day !== null) r.text(`DEV DAY ${h.day}  F8 +1 day  F9 learn all  F10 seals`, 312, 158, { size: 5, color: C.enemyDark, align: 'right' });
  r.text(s.hint, 312, 174, { size: 5, color: C.dim, align: 'right', maxWidth: 200 });
}

export interface MapScene {
  rooms: readonly Room[];
  layout: Record<string, { x: number; y: number }>;
  visited: readonly string[];
  walked: readonly string[];
  current: string;
  ghosts: Record<string, string[]>;
  echoRoom: string | null;
  /** Warden rooms: true once beaten (its seal is held). */
  wardens: Record<string, boolean>;
  lines: string[];
}

const CELL_W = 40;
const CELL_H = 24;

const shortName = (id: string): string => id.replace(/^r\d+_/, '').replace(/_/g, ' ');

/** The map: visited rooms and walked connections only (SPEC 7). */
export function drawMap(r: Renderer, s: MapScene): void {
  r.begin('#10131b');
  const g = r.low;
  const shown = s.rooms.filter((room) => s.visited.includes(room.id));
  const xs = shown.map((room) => s.layout[room.id]?.x ?? 0);
  const ys = shown.map((room) => s.layout[room.id]?.y ?? 0);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const at = (id: string): { x: number; y: number } => {
    const p = s.layout[id] ?? { x: 0, y: 0 };
    return { x: Math.round(160 + (p.x - cx) * CELL_W), y: Math.round(82 + (p.y - cy) * CELL_H) };
  };

  g.fillStyle = C.cardEdge;
  for (const room of shown) {
    for (const exit of Object.values(room.exits)) {
      const to = exit === undefined ? null : exitTarget(exit);
      if (!to || !s.walked.includes(edgeKey(room.id, to))) continue;
      const a = at(room.id);
      const b = at(to);
      const steps = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      for (let i = 0; i <= steps; i++) g.fillRect(Math.round(a.x + ((b.x - a.x) * i) / steps), Math.round(a.y + ((b.y - a.y) * i) / steps), 1, 1);
    }
  }
  for (const room of shown) {
    const p = at(room.id);
    const here = room.id === s.current;
    g.fillStyle = here ? C.signal : C.cardEdge;
    g.fillRect(p.x - 15, p.y - 8, 30, 16);
    g.fillStyle = C.card;
    const inset = here ? 2 : 1;
    g.fillRect(p.x - 15 + inset, p.y - 8 + inset, 30 - inset * 2, 16 - inset * 2);
    if (room.contents.bonfire) {
      g.fillStyle = C.ember;
      for (let i = 0; i < 4; i++) g.fillRect(p.x + 10 - (4 - i), p.y + 4 - i, (4 - i) * 2, 1);
    }
  }
  r.present();

  r.text('MAP', 160, 8, { size: 8, align: 'center' });
  for (const room of shown) {
    const p = at(room.id);
    const marks = [
      room.id === s.current ? '@' : '',
      room.id === s.echoRoom ? 'E' : '',
      (s.ghosts[room.id]?.length ?? 0) > 0 ? `g${s.ghosts[room.id]?.length}` : '',
      room.id in s.wardens ? (s.wardens[room.id] ? '◆' : '◇') : '',
    ].join('');
    r.text(shortName(room.id), p.x, p.y - 2, { size: 4, align: 'center', maxWidth: 28 });
    if (marks) r.text(marks, p.x, p.y + 4, { size: 4, align: 'center', color: C.signal });
  }
  r.text('@ you   E echo   g ghosts   ▲ bonfire   ◇ warden / ◆ seal won', 160, 142, { size: 5, align: 'center', color: C.dim });
  s.lines.forEach((line, i) => r.text(line, 160, 152 + i * 8, { size: 5, align: 'center', color: C.dim, maxWidth: 300 }));
}

export function drawTitle(r: Renderer, lines: string[], profile: string[], error: string | null): void {
  r.begin(C.sky);
  r.present();
  r.text('LINGUA DARK', 160, 34, { size: 14, align: 'center' });
  r.text('The Hollow Village', 160, 50, { size: 7, align: 'center', color: C.dim });
  lines.forEach((line, i) => r.text(line, 160, 76 + i * 11, { size: 7, align: 'center', color: i === 0 ? C.signal : C.text }));
  profile.forEach((line, i) => r.text(line, 160, 120 + i * 9, { size: 6, align: 'center', color: C.dim, maxWidth: 300 }));
  if (error) r.text(error, 160, 150, { size: 5, align: 'center', color: C.hurt, maxWidth: 300 });
}
