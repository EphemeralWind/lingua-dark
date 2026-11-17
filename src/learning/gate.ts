// Boss gate (SPEC 6): opens when at least GATE_THRESHOLD of the zone's components are Learned.
import { GATE_THRESHOLD } from '../tuning';
import { isLearned, type LearnerState } from './learner';

export interface GateProgress {
  learned: number;
  total: number;
  /** Learned components needed to open the gate. */
  needed: number;
  open: boolean;
}

export function gateProgress(state: LearnerState, zoneComponents: readonly string[], threshold = GATE_THRESHOLD): GateProgress {
  const total = zoneComponents.length;
  const learned = zoneComponents.filter((id) => isLearned(state, id)).length;
  const needed = Math.ceil(total * threshold - 1e-9);
  return { learned, total, needed, open: total > 0 && learned >= needed };
}
