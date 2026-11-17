// The bonfire rest scene (scenes/hub.ts): a close view of the fire against a stone wall,
// and the player sitting before it, seen from behind, shield leaning at his side and sword
// planted in the ground. The wall is darkest at the top behind the title and the lines under
// it; the lesson objects stand at REST_SPOTS (scenes/sceneryLayout.ts).
import { mirrored, type CharacterArt, type Part } from '../kit';
import { cloak, head, shield, sword } from '../sprites/player';
import { PixelCanvas, still, states } from './canvas';
import { masonry, slabs } from './rooms';

/** Screen row where the floor meets the wall, and the floor's vanishing point. */
const HORIZON = 128;
const VP_Y = 100;
/** The fire's centre, for the glow. Matches PROP_AT.restFire in scenes/sceneryLayout.ts. */
const FIRE = { x: 160, y: 156 };

const WARM: Record<string, string> = { E: 'T', F: 'T', G: 'U', H: 'U', I: 'V', J: 'V', K: 'W', L: 'W' };
const EMBER: Record<string, string> = { E: 'T', F: 'T', G: 'T', H: 'T', I: 'U', J: 'U', K: 'V', L: 'V' };

function backdrop(): Part {
  const c = new PixelCanvas(320, 180);
  const wall = masonry(14, 7, ['H', 'I', 'I'], 'J', 'F');
  const floor = slabs(20, 10, ['H', 'I'], 'J', 'F');
  const floorAt = (x: number, y: number): [number, number] => {
    const k = (y + 0.5 - VP_Y) / (HORIZON - VP_Y);
    return [(x + 0.5 - 160) / k, 100 / k];
  };
  c.each(0, 0, 320, 180, (x, y) => {
    let k: string;
    if (y < HORIZON) {
      const id = wall.id(x, y);
      k = id !== wall.id(x - 1, y) || id !== wall.id(x, y - 1) ? wall.joint : wall.color(x, y, id);
      // Darker toward the top, where the title is written: an ordered fade into shadow.
      if (y < 20 || (y < 34 && (x + y) % 2 === 0)) k = y < 12 ? 'B' : 'C';
    } else if (y === HORIZON) k = 'E';
    else {
      const [u, v] = floorAt(x, y);
      const [lu, lv] = floorAt(x - 1, y);
      const [uu, uv] = floorAt(x, y - 1);
      const id = floor.id(u, v);
      k = id !== floor.id(lu, lv) || id !== floor.id(uu, uv) ? floor.joint : floor.color(u, v, id);
    }
    // Firelight: a warm pool round the fire, fading in a checkerboard.
    const d = Math.hypot(x - FIRE.x, (y - FIRE.y) * 1.6);
    if (d < 46) return WARM[k] ?? k;
    if (d < 90) return EMBER[k] ?? k;
    if (d < 120 && (x + y) % 2 === 0) return EMBER[k] ?? k;
    return k;
  });
  // The sword, planted point-down in the floor on the far side of the fire.
  c.stamp(sword, 210, 136);
  return c.toPart('rest backdrop');
}

/** The cloak where it pools on the ground around a seated body. */
const pooled = mirrored('player cloak pooled', 22, [
  '6. 2A 14K',
  '4. 2A 2M 14K',
  '2. 2A 3M 15K',
  '1. A 3M 9K J 7K',
  'A 3M 10K J 7J',
  'A 2M 11K J 7J',
  '1. A 20J',
  '2. 20A',
]);

/** Shoulders and back only: the top rows of the standing cloak. */
const shoulders: Part = { ...cloak, name: 'player cloak shoulders', h: 20, rows: cloak.rows.slice(0, 20) };

/** Seated by the fire, back to us, head bowed a little. Two breaths. */
function seated(breath: number): Part {
  const c = new PixelCanvas(48, 44);
  c.stamp(shield, 0, 21); // leaning against his left side
  c.stamp(pooled, 2, 36);
  c.stamp(shoulders, 7, 18 + breath);
  c.stamp(head, 17, 9 + breath); // bowed toward the fire
  return c.toPart(`player seated ${breath}`);
}

export const REST: readonly CharacterArt[] = [still('rest_backdrop', backdrop()), states('rest_player', 48, 44, { sit: [seated(0), seated(1)] })];
