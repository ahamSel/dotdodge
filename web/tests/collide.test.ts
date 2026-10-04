import { describe, expect, it } from 'vitest';
import { arrowCorners, circleCapsuleGap, circleTriangle, segmentDistance } from '../src/game/collide';

describe('segmentDistance', () => {
  it('measures to the nearest point, clamped to the ends', () => {
    expect(segmentDistance(0, 5, -10, 0, 10, 0)).toBeCloseTo(5);
    expect(segmentDistance(13, 4, -10, 0, 10, 0)).toBeCloseTo(5);
    expect(segmentDistance(3, 4, 0, 0, 0, 0)).toBeCloseTo(5);
  });
});

describe('circleCapsuleGap', () => {
  // Capsule 16 long, radius 3.5: its core segment runs ±4.5 along its heading.
  it('measures the gap beside the capsule', () => {
    expect(circleCapsuleGap(0, 3.5 + 9.6 + 1, 9.6, 0, 0, 0, 16, 3.5)).toBeCloseTo(1);
  });

  it('measures the gap past the rounded end, following the heading', () => {
    expect(circleCapsuleGap(8 + 9.6 + 2, 0, 9.6, 0, 0, 0, 16, 3.5)).toBeCloseTo(2);
    expect(circleCapsuleGap(0, 8 + 9.6 + 2, 9.6, 0, 0, Math.PI / 2, 16, 3.5)).toBeCloseTo(2);
  });

  it('goes negative when they overlap', () => {
    expect(circleCapsuleGap(0, 0, 9.6, 5, 0, 0, 16, 3.5)).toBeLessThan(0);
  });
});

describe('arrows', () => {
  it('puts the tip of a top-lane arrow below its base', () => {
    const [a, b, c] = arrowCorners(0, 156, -1, 12, 10.7);
    expect(a).toEqual({ x: -6, y: 156 + 5.35 });
    expect(b).toEqual({ x: 6, y: 156 + 5.35 });
    expect(c).toEqual({ x: 0, y: 156 - 5.35 });
  });

  it('hits a circle that reaches the tip, and misses one that does not', () => {
    const [a, b, c] = arrowCorners(0, 156, -1, 12, 10.7);
    const hit = (x: number, y: number) => circleTriangle(x, y, 9.6, a.x, a.y, b.x, b.y, c.x, c.y);
    expect(hit(0, 141.5)).toBe(true); // 9.15 from the tip
    expect(hit(0, 140)).toBe(false); // 10.65 from the tip
    expect(hit(20, 150)).toBe(false);
    expect(hit(0, 158)).toBe(true); // centre inside the triangle
  });
});
