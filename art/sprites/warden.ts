// Warden marks, shared by every warden (SPEC 2): a crown and a seal diamond, so a warden reads
// as one by shape, not by colour or label.
import { part } from '../kit';

/** The warden's crown: three spikes and three jewels. Shape, not colour, marks a warden. */
export const crown = part('warden crown', 15, [
  '7. S',
  '2. R 4. S 4. R',
  '2. R 3. R S R 3. R',
  '1. 3R 2. 3R 2. 3R',
  '1. 13R',
  '1. R e R P R e R P R e R P R',
  '1. 13P',
]);

/** The seal diamond on the chest. */
export const seal = part('seal diamond', 7, ['3. e', '2. 3e', '1. 2e A 2e', '2e A S A 2e', '1. 2e A 2e', '2. 3e', '3. e']);
