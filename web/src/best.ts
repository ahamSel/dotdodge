import { CONFIG } from './game/config';
import { formatTime, stageAt } from './game/schedule';

/** Best = the most countdown seconds survived (120 = cleared). */
export interface BestTracker {
  readonly value: number;
  /** Call when a run starts: "new best" is judged against the best from before this run. */
  startRun(): void;
  /** Saves `seconds` if it beats the best. */
  record(seconds: number): void;
  isNewBest(seconds: number): boolean;
}

export function createBestTracker(initial: number, save: (value: number) => void): BestTracker {
  let best = initial;
  let beforeRun = initial;
  return {
    get value() {
      return best;
    },
    startRun() {
      beforeRun = best;
    },
    record(seconds) {
      if (seconds <= best) return;
      best = seconds;
      save(best);
    },
    isNewBest(seconds) {
      return seconds > beforeRun;
    },
  };
}

/** "1:23 · Stage 5", or "Cleared ★" for a full run. */
export function describeRun(seconds: number): string {
  return seconds >= CONFIG.countdown ? 'Cleared ★' : `${formatTime(seconds)} · Stage ${stageAt(seconds)}`;
}
