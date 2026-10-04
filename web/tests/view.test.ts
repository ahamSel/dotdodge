import { describe, expect, it } from 'vitest';
import { HH, HW } from '../src/game/arena';
import { fitView, frameWidth, screenDirToWorld, toScreen, worldMatrix, type View } from '../src/render/view';

/** The red frame around the arena: every side at least the frame width, and as even as the fixed arena shape allows. */
function evenFrame(v: View, tolerance: number) {
  const f = frameWidth(v.cssW, v.cssH);
  const sides = [v.x, v.cssW - (v.x + v.w), v.y, v.cssH - (v.y + v.h)];
  for (const s of sides) expect(s).toBeGreaterThanOrEqual(f - 1e-9);
  expect(Math.max(...sides) - Math.min(...sides)).toBeLessThanOrEqual(tolerance);
  expect(sides[0]).toBeCloseTo(sides[1], 6); // centred left/right
  expect(sides[2]).toBeCloseTo(sides[3], 6); // centred top/bottom
}

describe('fitView', () => {
  it('frames the 1.95:1 arena evenly in the itch embed', () => {
    const v = fitView(1024, 576);
    expect(v.portrait).toBe(false);
    expect(v.w / v.h).toBeCloseTo((2 * HW) / (2 * HH), 6);
    expect(v.w).toBeGreaterThan(900);
    evenFrame(v, 6);
  });

  it('frames a landscape phone with the frame at least as thick on every side', () => {
    const v = fitView(844, 390);
    expect(v.portrait).toBe(false);
    evenFrame(v, 140); // a 2.16:1 screen around a 1.95:1 arena: the extra width goes to the sides, never the top
  });

  it('turns the arena a quarter turn on a portrait phone', () => {
    const v = fitView(390, 844);
    expect(v.portrait).toBe(true);
    expect(v.h / v.w).toBeCloseTo((2 * HW) / (2 * HH), 6);
    evenFrame(v, 80); // a tall phone leaves extra above and below the turned arena
  });

  it('keeps the frame between 40 and 52 px (room for a thumb-sized pause button in the top strip)', () => {
    expect(frameWidth(390, 300)).toBe(40);
    expect(frameWidth(1024, 576)).toBeGreaterThanOrEqual(44);
    expect(frameWidth(3000, 2000)).toBe(52);
  });
});

describe('transforms', () => {
  it('maps world corners onto the arena rectangle (landscape)', () => {
    const v = fitView(1024, 576);
    expect(toScreen(v, HW, HH).x).toBeCloseTo(v.x + v.w);
    expect(toScreen(v, HW, HH).y).toBeCloseTo(v.y);
    expect(toScreen(v, -HW, -HH).y).toBeCloseTo(v.y + v.h);
  });

  it('points world +x up the screen in portrait', () => {
    const v = fitView(390, 844);
    expect(toScreen(v, HW, 0).y).toBeCloseTo(v.y);
    expect(toScreen(v, 0, HH).x).toBeCloseTo(v.x);
  });

  it('turns screen directions into the world direction that looks the same on screen', () => {
    for (const v of [fitView(1024, 576), fitView(390, 844)]) {
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [0.6, -0.8]]) {
        const d = screenDirToWorld(v, dx, dy);
        const a = toScreen(v, 0, 0);
        const b = toScreen(v, d.x, d.y);
        expect((b.x - a.x) / v.scale).toBeCloseTo(dx);
        expect(-(b.y - a.y) / v.scale).toBeCloseTo(dy); // screen y grows downward
      }
    }
  });

  it('agrees with the canvas matrix the renderer uses', () => {
    for (const v of [fitView(1024, 576), fitView(390, 844)]) {
      const [a, b, c, d, e, f] = worldMatrix(v);
      const p = toScreen(v, 100, -40);
      expect(a * 100 + c * -40 + e).toBeCloseTo(p.x);
      expect(b * 100 + d * -40 + f).toBeCloseTo(p.y);
    }
  });
});
