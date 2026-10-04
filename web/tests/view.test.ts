import { describe, expect, it } from 'vitest';
import { HH, HW } from '../src/game/arena';
import { fitView, HUD_MARGIN, hudBand, screenDirToWorld, toScreen, worldMatrix, type View } from '../src/render/view';

function fitsInside(v: View) {
  expect(v.x).toBeGreaterThanOrEqual(HUD_MARGIN - 1e-9);
  expect(v.x + v.w).toBeLessThanOrEqual(v.cssW - HUD_MARGIN + 1e-9);
  expect(v.y).toBeGreaterThanOrEqual(hudBand(v.cssH) - 1e-9); // the HUD band stays clear of the arena
  expect(v.y + v.h).toBeLessThanOrEqual(v.cssH - HUD_MARGIN + 1e-9);
}

describe('fitView', () => {
  it('fits the 1.95:1 arena under the HUD band of the itch embed', () => {
    const v = fitView(1024, 576);
    expect(v.portrait).toBe(false);
    expect(v.w / v.h).toBeCloseTo((2 * HW) / (2 * HH), 6);
    expect(v.w).toBeGreaterThan(950);
    fitsInside(v);
  });

  it('fits a landscape phone', () => {
    const v = fitView(844, 390);
    expect(v.portrait).toBe(false);
    fitsInside(v);
  });

  it('turns the arena a quarter turn on a portrait phone', () => {
    const v = fitView(390, 844);
    expect(v.portrait).toBe(true);
    expect(v.h / v.w).toBeCloseTo((2 * HW) / (2 * HH), 6);
    fitsInside(v);
  });

  it('keeps the band between 44 and 64 px', () => {
    expect(hudBand(300)).toBe(44);
    expect(hudBand(1400)).toBe(64);
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
