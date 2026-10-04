import { describe, expect, it } from 'vitest';
import { createFx } from '../src/render/fx';
import { createWorld } from '../src/game/sim';
import { launch } from './helpers';

function peakShake(fx: ReturnType<typeof createFx>): number {
  let peak = 0;
  for (let i = 0; i < 400; i++) {
    const o = fx.shakeOffset();
    peak = Math.max(peak, Math.abs(o.x), Math.abs(o.y));
  }
  return peak;
}

const death = { type: 'death' as const, x: 0, y: 0, by: 'missile' as const, hx: 5, hy: 0 };

describe('screen shake', () => {
  it('hits hard on death (about 9 world units, ~14 px at the itch size)', () => {
    const fx = createFx(false);
    fx.handle([death], createWorld());
    const peak = peakShake(fx);
    expect(peak).toBeGreaterThan(7);
    expect(peak).toBeLessThanOrEqual(9);
  });

  it('is gentle on a launch', () => {
    const fx = createFx(false);
    fx.handle([{ type: 'launch', id: 0, x: -312, y: 0 }], createWorld());
    expect(peakShake(fx)).toBeLessThan(3);
  });

  it('settles within 0.6 s', () => {
    const fx = createFx(false);
    fx.handle([death], createWorld());
    fx.update(0.6);
    expect(peakShake(fx)).toBe(0);
  });

  it('does not shake with reduced motion', () => {
    const fx = createFx(true);
    fx.handle([death], createWorld());
    expect(peakShake(fx)).toBe(0);
  });
});

describe('effect timing', () => {
  it('never draws a negative radius, even after a negative frame delta', () => {
    const fx = createFx(false);
    const world = createWorld();
    fx.handle([{ type: 'launch', id: 0, x: -312, y: 0 }, death, { type: 'blink', id: 0, x: -312, y: 0, n: 1 }], world);
    fx.update(-0.05); // a rAF timestamp can be earlier than the clock read at startup
    const radii: number[] = [];
    const noop = () => {};
    const ctx = new Proxy(
      { arc: (_x: number, _y: number, r: number) => radii.push(r), ellipse: (_x: number, _y: number, rx: number, ry: number) => radii.push(rx, ry) },
      { get: (t, k) => (k in t ? t[k as keyof typeof t] : noop), set: () => true },
    );
    fx.draw(ctx as unknown as CanvasRenderingContext2D);
    expect(radii.length).toBeGreaterThan(0);
    for (const r of radii) expect(r).toBeGreaterThanOrEqual(0);
  });
});

describe('win confetti', () => {
  it('pops each flying missile in turn', () => {
    const fx = createFx(false);
    const world = createWorld();
    launch(world, 0, -50, 0, 0);
    launch(world, 3, 50, 0, 0);
    fx.handle([{ type: 'win', x: 0, y: 0 }], world);
    expect(fx.popped(0)).toBe(false);
    fx.update(0.01);
    expect(fx.popped(0)).toBe(true);
    expect(fx.popped(3)).toBe(false);
    fx.update(0.5);
    expect(fx.popped(3)).toBe(true);
    fx.reset();
    expect(fx.popped(0)).toBe(false);
  });
});

describe('frame pulse', () => {
  it('pulses on a stage change and fades out', () => {
    const fx = createFx(false);
    fx.handle([{ type: 'stage', stage: 2 }], createWorld());
    expect(fx.pulse()).toBeCloseTo(1);
    fx.update(1);
    expect(fx.pulse()).toBeLessThan(0.05);
  });
});
