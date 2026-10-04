import { describe, expect, it } from 'vitest';
import { HH, HW } from '../src/game/arena';
import { createMissiles, gapToPlayer, keepInside, separate, steer, updateMissiles, wrapAngle } from '../src/game/missile';
import { createPlayer } from '../src/game/player';
import type { Missile } from '../src/game/types';

const DT = 1 / 60;
const DEG = Math.PI / 180;

function flying(x: number, y: number, angle: number, speed = 300, turnDeg = 470): Missile {
  const m = createMissiles()[0];
  Object.assign(m, { state: 'flying', x, y, px: x, py: y, angle, pangle: angle, speed, turn: turnDeg * DEG });
  return m;
}

describe('createMissiles', () => {
  it('builds the seven 2020 missiles facing into the arena, warning at the wall', () => {
    const ms = createMissiles();
    expect(ms).toHaveLength(7);
    expect(ms.every((m) => m.state === 'idle')).toBe(true);
    expect(ms[0].angle).toBeCloseTo(0); // from the left, facing right
    expect(ms[0]).toMatchObject({ warnX: -HW, warnY: 0, warnAt: 0, launchAt: 2.75, color: '#ffffff' });
    expect(ms[1].angle).toBeCloseTo(-Math.PI / 2); // from the top, facing down
    expect(ms[1]).toMatchObject({ warnX: 0, warnY: HH });
    expect(ms[4]).toMatchObject({ warnX: HW, warnY: -HH }); // purple, bottom-right corner
    expect(ms[6].speed).toBe(700);
    expect(ms[6].turn).toBeCloseTo(830 * DEG);
  });
});

describe('steer', () => {
  it('turns at sin(error) × turn rate, the 2020 formula', () => {
    const m = flying(0, 0, 0);
    steer(m, 0, 100, DT); // target 90° to the left: full turn rate
    expect(m.angle).toBeCloseTo(470 * DEG * DT, 9);
  });

  it('barely turns when the target is straight behind (sin of 180° is 0)', () => {
    const m = flying(0, 0, 0);
    steer(m, -100, 0, DT);
    expect(Math.abs(m.angle)).toBeLessThan(1e-6);
  });

  it('always flies at its own speed', () => {
    const m = flying(0, 0, 0.3, 450);
    steer(m, 50, 80, DT);
    expect(Math.hypot(m.x, m.y)).toBeCloseTo(450 * DT, 9);
  });

  it('locks onto a target within half a second', () => {
    const m = flying(-300, 0, Math.PI / 2);
    for (let i = 0; i < 30; i++) steer(m, 0, 0, DT);
    const err = wrapAngle(Math.atan2(-m.y, -m.x) - m.angle);
    expect(Math.abs(err)).toBeLessThan(0.1);
  });
});

describe('keepInside', () => {
  it('lets a missile fly in from outside, then keeps it inside', () => {
    const m = flying(-336, 0, 0);
    keepInside(m);
    expect(m.entered).toBe(false);
    expect(m.x).toBe(-336);
    m.x = 0;
    keepInside(m);
    expect(m.entered).toBe(true);
    m.x = 400;
    m.y = -400;
    keepInside(m);
    expect(m.x).toBe(HW - 8);
    expect(m.y).toBe(-(HH - 8));
  });
});

describe('separate', () => {
  it('pushes overlapping flying missiles apart evenly', () => {
    const a = flying(0, 0, 0);
    const b = flying(10, 0, 0);
    separate([a, b]);
    expect(a.x).toBeCloseTo(-2);
    expect(b.x).toBeCloseTo(12);
  });

  it('leaves idle missiles alone', () => {
    const a = flying(0, 0, 0);
    const b = createMissiles()[1];
    b.x = 5;
    b.y = 0;
    separate([a, b]);
    expect(a.x).toBe(0);
    expect(b.x).toBe(5);
  });
});

describe('updateMissiles', () => {
  it('coasts in a straight line after the player dies, ignoring the walls', () => {
    const m = flying(300, 0, 0, 300);
    m.state = 'coasting';
    m.entered = true;
    const p = createPlayer();
    for (let i = 0; i < 30; i++) updateMissiles([m], p, DT);
    expect(m.x).toBeCloseTo(450);
    expect(m.angle).toBe(0);
  });

  it('records the previous pose for interpolation', () => {
    const m = flying(0, 0, 0);
    updateMissiles([m], createPlayer(), DT);
    expect(m.px).toBe(0);
    expect(m.x).toBeGreaterThan(0);
  });

  it('measures the gap to the player from the capsule surface', () => {
    const m = flying(30, 0, 0);
    expect(gapToPlayer(m, createPlayer())).toBeCloseTo(30 - 4.5 - 3.5 - 9.6);
  });
});
