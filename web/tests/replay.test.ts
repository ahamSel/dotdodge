import { describe, expect, it } from 'vitest';
import { encodeDir, replayInput } from '../src/dev/replay';

describe('recorded runs (dev replay)', () => {
  it('turns each step character back into the same input', () => {
    const r = { dirs: encodeDir(-1) + encodeDir(0) + encodeDir(4) + encodeDir(8), slowmo: 2 };
    expect(replayInput(r, 0)).toEqual({ move: { x: 0, y: 0 }, slowmo: false });
    expect(replayInput(r, 1).move.x).toBeCloseTo(1);
    expect(replayInput(r, 2).move.y).toBeCloseTo(1);
    expect(replayInput(r, 2).slowmo).toBe(true);
    expect(replayInput(r, 3).move.x).toBeCloseTo(-1);
  });

  it('gives no input once the recording runs out', () => {
    expect(replayInput({ dirs: 'a', slowmo: -1 }, 5)).toEqual({ move: { x: 0, y: 0 }, slowmo: false });
  });
});
