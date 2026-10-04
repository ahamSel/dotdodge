import { describe, expect, it } from 'vitest';
import { createMotion } from '../src/render/motion';

const run = (m: ReturnType<typeof createMotion>, vx: number, vy: number, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) m.update(vx, vy, 1 / 60);
};

describe('dot squash & stretch', () => {
  it('is round at rest', () => {
    const m = createMotion();
    run(m, 0, 0, 0.5);
    expect(m.pose().along).toBeCloseTo(1, 3);
  });

  it('stretches along its motion, capped', () => {
    const m = createMotion();
    run(m, 900, 0, 1);
    expect(m.pose().along).toBeGreaterThan(1.12);
    expect(m.pose().along).toBeLessThan(1.2);
    expect(m.pose().angle).toBeCloseTo(0, 2);
    run(m, 5000, 0, 1);
    expect(m.pose().along).toBeLessThan(1.2);
  });

  it('flattens against a wall on a bounce, hugging it, then recovers', () => {
    const m = createMotion();
    m.bounce(1, 0, 600); // left wall, normal points right
    run(m, 0, 0, 0.05);
    const p = m.pose();
    expect(p.along).toBeLessThan(0.95);
    expect(p.shiftX).toBeLessThan(0); // pulled toward the wall so the dot keeps touching it
    run(m, 0, 0, 0.6);
    expect(Math.abs(m.pose().along - 1)).toBeLessThan(0.02);
    expect(m.pose().shiftX).toBe(0);
  });

  it('ignores non-positive frame deltas', () => {
    const m = createMotion();
    m.bounce(0, 1, 800);
    const before = m.pose();
    m.update(0, 0, 0);
    m.update(0, 0, -0.1);
    expect(m.pose()).toEqual(before);
  });
});
