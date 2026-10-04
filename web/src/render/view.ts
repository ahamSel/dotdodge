import { HH, HW } from '../game/arena';
import type { Vec } from '../game/types';

/** Where the arena sits on screen, in CSS pixels. */
export interface View {
  cssW: number;
  cssH: number;
  /** Taller than wide: the arena is drawn a quarter turn round, world +x pointing up the screen. */
  portrait: boolean;
  /** CSS pixels per world unit. */
  scale: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

/**
 * Thickness of the red frame around the arena, the same on every side. The HUD lives in the top strip,
 * so it never drops below 40 px; it grows with the screen up to 52 px.
 */
export function frameWidth(cssW: number, cssH: number): number {
  return Math.min(52, Math.max(40, Math.round(Math.min(cssW, cssH) * 0.08)));
}

export function fitView(cssW: number, cssH: number): View {
  const portrait = cssH > cssW;
  const f = frameWidth(cssW, cssH);
  const worldW = portrait ? 2 * HH : 2 * HW;
  const worldH = portrait ? 2 * HW : 2 * HH;
  const availW = Math.max(1, cssW - 2 * f);
  const availH = Math.max(1, cssH - 2 * f);
  const scale = Math.min(availW / worldW, availH / worldH);
  const w = worldW * scale;
  const h = worldH * scale;
  const x = (cssW - w) / 2;
  const y = (cssH - h) / 2;
  return { cssW, cssH, portrait, scale, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
}

export function toScreen(v: View, wx: number, wy: number): Vec {
  return v.portrait
    ? { x: v.cx - wy * v.scale, y: v.cy - wx * v.scale }
    : { x: v.cx + wx * v.scale, y: v.cy - wy * v.scale };
}

/** A screen direction (x right, y up) as the world direction that looks the same on screen. */
export function screenDirToWorld(v: View, dx: number, dy: number): Vec {
  return v.portrait ? { x: dy, y: -dx } : { x: dx, y: dy };
}

/** Canvas setTransform() arguments (CSS pixels) for drawing in world units. */
export function worldMatrix(v: View): [number, number, number, number, number, number] {
  const k = v.scale;
  return v.portrait ? [0, -k, -k, 0, v.cx, v.cy] : [k, 0, 0, -k, v.cx, v.cy];
}
