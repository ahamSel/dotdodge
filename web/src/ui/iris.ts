export type IrisPhase = 'close' | 'open';

export interface IrisSequencer {
  /** Closes the iris, runs `onCovered` while the screen is hidden, then opens it. */
  request(onCovered: () => void): void;
}

/**
 * Orders iris wipes so screen swaps never race: a request made while the iris is closing replaces
 * the pending swap (the latest wins, and it runs once), and one made while it is opening swaps at once.
 * `play` runs one animation phase and calls `done` when it ends.
 */
export function createIrisSequencer(play: (phase: IrisPhase, done: () => void) => void): IrisSequencer {
  let state: 'idle' | 'closing' | 'opening' = 'idle';
  let pending: (() => void) | null = null;

  return {
    request(onCovered) {
      if (state === 'closing') {
        pending = onCovered;
        return;
      }
      if (state === 'opening') {
        onCovered();
        return;
      }
      state = 'closing';
      pending = onCovered;
      play('close', () => {
        const swap = pending;
        pending = null;
        state = 'opening';
        swap?.();
        play('open', () => {
          state = 'idle';
        });
      });
    },
  };
}
