import { CONFIG } from './config';
import type { Vec } from './types';

export const HW = CONFIG.arena.hw;
export const HH = CONFIG.arena.hh;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Where a point outside the arena meets the wall (the warning chevron's spot). */
export function wallPoint(x: number, y: number): Vec {
  return { x: clamp(x, -HW, HW), y: clamp(y, -HH, HH) };
}
