import type { Vec } from './types';

/** Distance from point P to segment AB. */
export function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  let t = len2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / len2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

/** Gap between a circle and a capsule (centre x,y, heading angle); negative when they overlap. */
export function circleCapsuleGap(
  cx: number,
  cy: number,
  cr: number,
  x: number,
  y: number,
  angle: number,
  length: number,
  radius: number,
): number {
  const half = length / 2 - radius;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  return segmentDistance(cx, cy, x - dx, y - dy, x + dx, y + dy) - radius - cr;
}

function side(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

/** True when a circle overlaps triangle ABQ. */
export function circleTriangle(
  cx: number,
  cy: number,
  r: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  qx: number,
  qy: number,
): boolean {
  const d1 = side(cx, cy, ax, ay, bx, by);
  const d2 = side(cx, cy, bx, by, qx, qy);
  const d3 = side(cx, cy, qx, qy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  if (!(hasNeg && hasPos)) return true; // centre inside
  return (
    segmentDistance(cx, cy, ax, ay, bx, by) < r ||
    segmentDistance(cx, cy, bx, by, qx, qy) < r ||
    segmentDistance(cx, cy, qx, qy, ax, ay) < r
  );
}

/** The corners of a spike arrow: two base corners, then the tip. */
export function arrowCorners(x: number, y: number, tip: 1 | -1, w: number, h: number): [Vec, Vec, Vec] {
  const base = y - (tip * h) / 2;
  return [
    { x: x - w / 2, y: base },
    { x: x + w / 2, y: base },
    { x, y: y + (tip * h) / 2 },
  ];
}
