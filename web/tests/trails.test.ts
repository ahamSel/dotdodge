import { describe, expect, it } from 'vitest';
import { trailSegments } from '../src/render/trails';

describe('trailSegments', () => {
  const samples = [0, 0.05, 0.1, 0.15, 0.2].map((t, i) => ({ x: i * 10, y: 0, t }));

  it('keeps only segments younger than maxAge, oldest first and thinnest first', () => {
    const segs = trailSegments(samples, 0.2, 0.12);
    expect(segs.length).toBe(2);
    expect(segs[0].x0).toBe(20);
    expect(segs[1].x1).toBe(40);
    expect(segs[0].k).toBeLessThan(segs[1].k);
  });

  it('never returns a negative weight', () => {
    for (const s of trailSegments(samples, 5, 10)) expect(s.k).toBeGreaterThanOrEqual(0);
  });
});
